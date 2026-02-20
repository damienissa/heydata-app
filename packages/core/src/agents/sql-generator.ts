import {
  GeneratedSQLSchema,
  HeyDataError,
  type GeneratedSQL,
  type IntentObject,
  type SemanticMetadata,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface SqlGeneratorInput extends AgentInput {
  intent: IntentObject;
  semanticMetadata: SemanticMetadata;
  /** Previous SQL that failed validation (for retry with feedback) */
  previousSql?: string;
  /** Validation errors from previous attempt */
  validationErrors?: string[];
}

const SYSTEM_PROMPT = `You are an expert SQL query generator. Given a structured intent object and semantic layer metadata, generate a valid SQL query.

TODAY'S DATE: {{CURRENT_DATE}}
Target dialect: {{DIALECT}}

Semantic Layer Information:

METRICS (with formulas):
{{METRICS}}

DIMENSIONS (with table/column mappings):
{{DIMENSIONS}}

RELATIONSHIPS:
{{RELATIONSHIPS}}

Guidelines:
1. Use literal values in SQL (do NOT use parameterized placeholders like $1, $2)
2. Apply appropriate JOINs based on the relationships defined
3. Use the exact formulas from metric definitions
4. Apply filters using WHERE clauses with literal values (e.g., WHERE status = 'active')
5. Group by all dimension columns when aggregating
6. Apply ORDER BY and LIMIT as specified in the intent
7. CRITICAL: For time ranges in the intent, generate WHERE clauses with proper date comparisons. Use the timeRange.start and timeRange.end from the intent. If no timeRange is provided but the query is time-based, default to a reasonable recent period relative to today ({{CURRENT_DATE}}).
8. For trend queries with time dimensions, ensure results are aggregated by the time dimension (GROUP BY the date column) and ordered chronologically (ORDER BY date ASC)
9. Estimate query complexity (low, medium, high) based on number of joins and aggregations
10. Properly escape string literals (use single quotes for strings)
11. CRITICAL - AVOID CARTESIAN PRODUCTS: When querying multiple metrics from DIFFERENT tables, use CTEs (WITH clauses) or subqueries to compute each metric independently, then combine results. Do NOT join multiple fact tables directly as this creates cartesian products and inflated counts.
    Example pattern for multi-table metrics:
    WITH links_metrics AS (SELECT user_id, COUNT(*) as total_links FROM links WHERE ... GROUP BY user_id),
         clicks_metrics AS (SELECT user_id, COUNT(*) as total_clicks FROM click_logs WHERE ... GROUP BY user_id)
    SELECT COALESCE(l.total_links, 0), COALESCE(c.total_clicks, 0) FROM links_metrics l FULL JOIN clicks_metrics c USING (user_id)
12. When filtering to a single entity (e.g., one username), avoid COUNT(DISTINCT entity_id) metrics as they would trivially return 1. Instead, focus on activity metrics (counts, sums of that entity's data).

Respond with a JSON object containing:
- sql: The SQL query string
- dialect: The target dialect (must be "{{DIALECT}}")
- tablesTouched: Array of table names used
- estimatedComplexity: "low", "medium", or "high"`;

function buildSystemPrompt(
  semanticMetadata: SemanticMetadata,
  dialect: string,
): string {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  const metricsDesc = semanticMetadata.metrics
    .map((m) => `- ${m.name}: ${m.formula}${m.grain ? ` (grain: ${m.grain})` : ""}${m.dimensions.length > 0 ? ` [dimensions: ${m.dimensions.join(", ")}]` : ""}`)
    .join("\n");

  const dimensionsDesc = semanticMetadata.dimensions
    .map((d) => `- ${d.name}: ${d.table}.${d.column} (type: ${d.type})`)
    .join("\n");

  const relationshipsDesc =
    semanticMetadata.relationships.length > 0
      ? semanticMetadata.relationships
          .map(
            (r) =>
              `- ${r.from.table}.${r.from.column} ${r.type} ${r.to.table}.${r.to.column} (${r.joinType ?? "inner"})`,
          )
          .join("\n")
      : "No relationships defined";

  return SYSTEM_PROMPT
    .replaceAll("{{CURRENT_DATE}}", currentDate!)
    .replaceAll("{{DIALECT}}", dialect)
    .replace("{{METRICS}}", metricsDesc)
    .replace("{{DIMENSIONS}}", dimensionsDesc)
    .replace("{{RELATIONSHIPS}}", relationshipsDesc);
}

function buildUserMessage(
  intent: IntentObject,
  previousSql?: string,
  validationErrors?: string[],
): string {
  let message = `Generate a SQL query for the following intent:

${JSON.stringify(intent, null, 2)}`;

  if (previousSql && validationErrors && validationErrors.length > 0) {
    message += `

PREVIOUS ATTEMPT FAILED VALIDATION. You must fix these issues:

Previous SQL:
\`\`\`sql
${previousSql}
\`\`\`

Validation Errors:
${validationErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Generate a CORRECTED SQL query that addresses ALL of these validation errors.`;
  }

  return message;
}

export async function generateSql(
  input: SqlGeneratorInput,
): Promise<AgentResult<GeneratedSQL>> {
  const startedAt = new Date();
  const { context, intent, semanticMetadata, previousSql, validationErrors } = input;

  try {
    const systemPrompt = buildSystemPrompt(semanticMetadata, context.dialect);
    const userMessage = buildUserMessage(intent, previousSql, validationErrors);

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new HeyDataError(
        "SQL_GENERATION_FAILED",
        "No text response from SQL generator",
        { agent: "sql_generator" },
      );
    }

    // Extract JSON from the response
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = GeneratedSQLSchema.parse(parsed);

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: validated,
      trace: createSuccessTrace({
        agent: "sql_generator",
        model: context.model,
        startedAt,
        inputTokens,
        outputTokens,
      }),
    };
  } catch (error) {
    if (error instanceof HeyDataError) {
      throw error;
    }

    const trace = createErrorTrace(
      {
        agent: "sql_generator",
        model: context.model,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "SQL_GENERATION_FAILED",
      `Failed to generate SQL: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "sql_generator", details: { trace } },
    );
  }
}
