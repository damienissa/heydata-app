import {
  HeyDataError,
  type IntrospectedSchema,
  type MetricDefinition,
  type DimensionDefinition,
  type SemanticMetadata,
} from "@heydata/shared";
import {
  MetricDefinitionSchema,
  DimensionDefinitionSchema,
  EntityRelationshipSchema,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import { createSuccessTrace, extractTokenUsage } from "../types.js";
import { z } from "zod";

/**
 * Entity relationship as output by the LLM (matches EntityYaml.relationships item)
 */
const RELATIONSHIP_TYPE_MAP: Record<string, "one-to-one" | "one-to-many" | "many-to-many"> = {
  "one-to-one": "one-to-one",
  "one-to-many": "one-to-many",
  "many-to-many": "many-to-many",
  "many_to_one": "one-to-many",
  "one_to_many": "one-to-many",
  "one_to_one": "one-to-one",
  "many_to_many": "many-to-many",
};

const EntityRelOutputSchema = z.object({
  target: z.string().min(1),
  foreignKey: z.string().min(1),
  targetKey: z.string().min(1),
  type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
  joinType: z.enum(["inner", "left", "right", "full"]).optional(),
});

/**
 * Entity definition as output by the LLM (for storage; maps to EntityRelationship[])
 */
const EntityOutputSchema = z.object({
  name: z.string().min(1),
  table: z.string().min(1),
  description: z.string().optional(),
  primaryKey: z.string().min(1),
  relationships: z.array(EntityRelOutputSchema).optional(),
});

/**
 * Semantic generator output schema
 */
const SemanticGeneratorOutputSchema = z.object({
  metrics: z.array(MetricDefinitionSchema),
  dimensions: z.array(DimensionDefinitionSchema),
  entities: z.array(EntityOutputSchema),
});

export type SemanticGeneratorOutput = z.infer<typeof SemanticGeneratorOutputSchema>;

export interface SemanticGeneratorInput extends AgentInput {
  introspectedSchema: IntrospectedSchema;
  dialect?: string;
}

const SYSTEM_PROMPT = `You are an expert data modeler. Your task is to analyze a database schema and generate a semantic layer that will power natural language queries.

Given an introspected schema (tables, columns, types, foreign keys), you must produce:

1. **METRICS** — Business KPIs with SQL formulas
   - Identify numeric columns suitable for aggregation (SUM, COUNT, AVG, etc.)
   - Create meaningful metric names (e.g., total_revenue, user_count, average_order_value)
   - Define formulas using table.column references
   - Specify compatible dimensions for breakdown
   - Add synonyms for natural language matching (e.g., "revenue" → total_revenue)
   - Set grain (hourly, daily, weekly, monthly) for time-based metrics
   - Add formatting (currency, percentage, number) where appropriate

2. **DIMENSIONS** — Categorization axes
   - Map each dimension to table.column
   - Classify type: string, number, date, boolean
   - Add synonyms (e.g., "region" for geo, "date" for created_at)
   - Include temporal dimensions (date columns) and categorical dimensions (enums, text)
   - Create dimensions for columns on ALL relevant tables, including fact tables. E.g. if app_installs has a username column, create a dimension for app_installs.username (name could be "username" or "install_username"). This allows "app installs per username" to work when the fact table has that column directly.

3. **ENTITIES** — Table relationships from foreign keys
   - One entity per table that has relationships
   - primaryKey: the primary key column name
   - relationships: array of { target (table name), foreignKey, targetKey, type, joinType }

Guidelines:
- Use ONLY table and column names that appear in the schema. NEVER guess or assume column names.
- For user/person count metrics: Check the schema! Many profile tables use "id" as the primary key (e.g. user_profiles.id), NOT "user_id". If a table has no user_id column, use its primary key (marked PK) for COUNT(DISTINCT ...).
- For metrics, prefer aggregates that make business sense (SUM for amounts, COUNT for records, COUNT(DISTINCT x) for unique entities)
- Keep metric formulas simple and valid PostgreSQL
- Include at least 3-5 metrics and 5-10 dimensions for a useful layer
- Infer relationships from foreign key info in the schema
- Add displayName and description for each metric/dimension

Respond with a single JSON object: { "metrics": [...], "dimensions": [...], "entities": [...] }
No markdown, no code fences. Valid JSON only.

CRITICAL format requirements:
- Each dimension MUST have: name, displayName, description, table, column, type. The "column" MUST exist in that table per the schema.
- Each entity MUST have: name, table, primaryKey. Use "table" (not "tableName"). Relationship "type" must be exactly: "one-to-one", "one-to-many", or "many-to-many" (with hyphens, not underscores).
- Each metric formula MUST reference only table.column pairs that exist in the schema. For COUNT(DISTINCT x) on a profile/entity table, use the PRIMARY KEY column (e.g. user_profiles.id) if that table has no separate user_id column.`;

function buildUserMessage(schema: IntrospectedSchema): string {
  const tablesDesc = schema.tables
    .map((t) => {
      const cols = t.columns
        .map(
          (c) =>
            `    - ${c.name} (${c.dataType})${c.isPrimaryKey ? " PK" : ""}${c.isForeignKey ? ` FK→${c.foreignTable}.${c.foreignColumn}` : ""}`,
        )
        .join("\n");
      return `Table: ${t.schema}.${t.name}\n${cols}`;
    })
    .join("\n\n");

  return `Introspected schema (${schema.tables.length} tables):\n\n${tablesDesc}`;
}

/** Build a map of table -> Set of column names from introspected schema */
function buildTableColumnsMap(schema: IntrospectedSchema): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of schema.tables) {
    const tableKey = t.name.toLowerCase();
    const cols = new Set(t.columns.map((c) => c.name.toLowerCase()));
    map.set(tableKey, cols);
  }
  return map;
}

/** Get the primary key column name for a table, or null */
function getPrimaryKeyColumn(schema: IntrospectedSchema, tableName: string): string | null {
  const table = schema.tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) return null;
  const pk = table.columns.find((c) => c.isPrimaryKey);
  return pk?.name ?? null;
}

/**
 * Validate metric formulas against the schema and auto-correct common mistakes.
 * E.g. user_profiles.user_id when user_profiles has only "id" -> replace with user_profiles.id
 */
function validateAndCorrectFormulas(
  metrics: Array<{ name: string; formula: string; [k: string]: unknown }>,
  schema: IntrospectedSchema,
): Array<{ name: string; formula: string; [k: string]: unknown }> {
  const tableCols = buildTableColumnsMap(schema);

  const extractTableColumnRefs = (formula: string): Array<[string, string]> => {
    const refs: Array<[string, string]> = [];
    const regex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(formula)) !== null) {
      refs.push([m[1]!.toLowerCase(), m[2]!.toLowerCase()]);
    }
    return refs;
  };

  return metrics.map((metric) => {
    let formula = metric.formula;
    const refs = extractTableColumnRefs(formula);

    for (const [table, column] of refs) {
      const cols = tableCols.get(table);
      if (!cols) continue;

      if (cols.has(column)) continue;

      const pk = getPrimaryKeyColumn(schema, table);
      const isCountDistinct =
        formula.toLowerCase().includes("count") && formula.toLowerCase().includes("distinct");
      const likelyEntityCount =
        column === "user_id" || column === "userid" || column === "customer_id" || column === "account_id";

      if (
        pk &&
        pk.toLowerCase() !== column &&
        (isCountDistinct || likelyEntityCount)
      ) {
        const oldRef = new RegExp(`\\b${escapeRegex(table)}\\.${escapeRegex(column)}\\b`, "gi");
        formula = formula.replace(oldRef, (match) => {
          const [t] = match.split(".");
          return `${t}.${pk}`;
        });
      }
    }

    return { ...metric, formula };
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize LLM output to match our schemas (handle common LLM variations)
 */
function normalizeLlmOutput(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = parsed as Record<string, unknown>;

  const dimensions = Array.isArray(obj.dimensions) ? obj.dimensions : [];
  const normalizedDimensions = dimensions.map((d: unknown) => {
    const dim = { ...(d as Record<string, unknown>) };
    let table = dim.table ?? dim.tableName;
    if (!table && typeof dim.column === "string" && dim.column.includes(".")) {
      const [t, col] = dim.column.split(".", 2);
      if (t && col) {
        table = t;
        dim.column = col;
      }
    }
    if (!table) table = "unknown";
    dim.table = String(table);
    return dim;
  });

  const entities = Array.isArray(obj.entities) ? obj.entities : [];
  const normalizedEntities = entities.map((e: unknown) => {
    const ent = e as Record<string, unknown>;
    const table = ent.table ?? ent.tableName ?? ent.name ?? "unknown";
    const relationships = Array.isArray(ent.relationships) ? ent.relationships : [];
    const normalizedRels = relationships.map((r: unknown) => {
      const rel = r as Record<string, unknown>;
      const rawType = rel.type ?? "one-to-many";
      const type = RELATIONSHIP_TYPE_MAP[String(rawType)] ?? "one-to-many";
      const rawJoinType = rel.joinType;
      const joinType =
        rawJoinType && ["inner", "left", "right", "full"].includes(String(rawJoinType).toLowerCase())
          ? (String(rawJoinType).toLowerCase() as "inner" | "left" | "right" | "full")
          : undefined;
      const { joinType: _omit, ...rest } = rel;
      return { ...rest, type, ...(joinType && { joinType }) };
    });
    return { ...ent, table: String(table), relationships: normalizedRels };
  });

  return {
    ...obj,
    dimensions: normalizedDimensions,
    entities: normalizedEntities,
  };
}

/**
 * Extract JSON from LLM response (handle markdown code blocks)
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) {
    return blockMatch[1]!.trim();
  }
  return trimmed;
}

/**
 * Run semantic generation with default context (API key from env).
 * Use this from API routes; no need to pass an Anthropic client.
 */
export async function generateSemanticFromSchema(
  introspectedSchema: IntrospectedSchema,
  options?: { signal?: AbortSignal },
): Promise<SemanticGeneratorOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HeyDataError("CONFIG_ERROR", "ANTHROPIC_API_KEY is required for semantic generation", {
      agent: "semantic_generator",
    });
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const result = await generateSemantic({
    context: {
      requestId: `sem_${Date.now()}`,
      client,
      model: "claude-sonnet-4-20250514",
      dialect: "postgresql",
      signal: options?.signal,
    },
    introspectedSchema,
  });

  return result.data;
}

/**
 * Semantic Generator Agent — analyzes introspected schema and produces
 * metrics, dimensions, and entity relationships for the semantic layer.
 */
export async function generateSemantic(
  input: SemanticGeneratorInput,
): Promise<AgentResult<SemanticGeneratorOutput>> {
  const startedAt = new Date();
  const { context, introspectedSchema } = input;

  try {
    const userMessage = buildUserMessage(introspectedSchema);

    const response = await context.client.messages.create(
      {
        model: context.model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      context.signal ? { signal: context.signal } : undefined,
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new HeyDataError("SEMANTIC_GENERATION_FAILED", "Semantic generator returned no text", {
        agent: "semantic_generator",
      });
    }

    const raw = extractJson(textBlock.text);
    const parsed = JSON.parse(raw);

    const normalized = normalizeLlmOutput(parsed);
    const obj = normalized as Record<string, unknown>;
    if (Array.isArray(obj.metrics)) {
      obj.metrics = validateAndCorrectFormulas(
        obj.metrics as Array<{ name: string; formula: string; [k: string]: unknown }>,
        introspectedSchema,
      );
    }
    const validated = SemanticGeneratorOutputSchema.parse(normalized);

    return {
      data: validated,
      trace: createSuccessTrace({
        agent: "semantic_generator",
        model: context.model,
        startedAt,
        inputTokens: extractTokenUsage(response).inputTokens,
        outputTokens: extractTokenUsage(response).outputTokens,
      }),
    };
  } catch (error) {
    if (error instanceof HeyDataError) {
      throw error;
    }
    throw new HeyDataError(
      "SEMANTIC_GENERATION_FAILED",
      `Semantic generation failed: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "semantic_generator", cause: error instanceof Error ? error : undefined },
    );
  }
}

/**
 * Convert SemanticGeneratorOutput to SemanticMetadata (for use with query pipeline)
 */
export function toSemanticMetadata(output: SemanticGeneratorOutput): SemanticMetadata {
  const relationships = output.entities.flatMap((ent) =>
    (ent.relationships ?? []).map((rel) =>
      EntityRelationshipSchema.parse({
        from: { table: ent.table, column: rel.foreignKey },
        to: { table: rel.target, column: rel.targetKey },
        type: rel.type,
        joinType: rel.joinType,
      }),
    ),
  );

  return {
    metrics: output.metrics,
    dimensions: output.dimensions,
    relationships,
    synonyms: buildSynonymMap(output),
  };
}

function buildSynonymMap(output: SemanticGeneratorOutput): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  for (const m of output.metrics) {
    if (m.synonyms && m.synonyms.length > 0) {
      map[m.name] = m.synonyms;
    }
  }

  for (const d of output.dimensions) {
    if (d.synonyms && d.synonyms.length > 0) {
      map[d.name] = d.synonyms;
    }
  }

  return map;
}
