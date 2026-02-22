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

3. **ENTITIES** — Table relationships from foreign keys
   - One entity per table that has relationships
   - primaryKey: the primary key column name
   - relationships: array of { target (table name), foreignKey, targetKey, type, joinType }

Guidelines:
- Use exact table and column names from the schema
- For metrics, prefer aggregates that make business sense (SUM for amounts, COUNT for records, COUNT(DISTINCT x) for unique entities)
- Keep metric formulas simple and valid PostgreSQL
- Include at least 3-5 metrics and 5-10 dimensions for a useful layer
- Infer relationships from foreign key info in the schema
- Add displayName and description for each metric/dimension

Respond with a single JSON object: { "metrics": [...], "dimensions": [...], "entities": [...] }
No markdown, no code fences. Valid JSON only.`;

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

    const validated = SemanticGeneratorOutputSchema.parse(parsed);

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
