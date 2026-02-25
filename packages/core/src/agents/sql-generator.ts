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

const PREAMBLE_PROMPT = `You are an expert SQL query generator. Given a structured intent object and semantic layer metadata, generate a valid SQL query.

TODAY'S DATE: {{CURRENT_DATE}}
Target dialect: {{DIALECT}}

Guidelines:
1. Use literal values in SQL (do NOT use parameterized placeholders like $1, $2)
2. Apply appropriate JOINs based on the relationships defined
3. Use the exact formulas from metric definitions
4. Apply filters using WHERE clauses with literal values (e.g., WHERE status = 'active')
5. Group by all dimension columns when aggregating
6. Apply ORDER BY and LIMIT as specified in the intent
7. CRITICAL: For time ranges in the intent, generate WHERE clauses with proper date comparisons. Use the timeRange.start and timeRange.end from the intent. If no timeRange is provided but the query is time-based, default to the last 30 days relative to today ({{CURRENT_DATE}}).
8. For trend queries with time dimensions, ensure results are aggregated by the time dimension (GROUP BY the date column) and ordered chronologically (ORDER BY date ASC)
9. Estimate query complexity (low, medium, high) based on number of joins and aggregations
10. Properly escape string literals (use single quotes for strings)
11. CRITICAL - AVOID CARTESIAN PRODUCTS: When querying multiple metrics from DIFFERENT tables, use CTEs (WITH clauses) or subqueries to compute each metric independently, then combine results. Do NOT join multiple fact tables directly as this creates cartesian products and inflated counts.
    Example pattern for multi-table metrics:
    WITH links_metrics AS (SELECT user_id, COUNT(*) as total_links FROM links WHERE ... GROUP BY user_id),
         clicks_metrics AS (SELECT user_id, COUNT(*) as total_clicks FROM click_logs WHERE ... GROUP BY user_id)
    SELECT COALESCE(l.total_links, 0), COALESCE(c.total_clicks, 0) FROM links_metrics l FULL JOIN clicks_metrics c USING (user_id)
12. When filtering to a single entity (e.g., one username), avoid COUNT(DISTINCT entity_id) metrics as they would trivially return 1. Instead, focus on activity metrics (counts, sums of that entity's data).
13. NULL handling: wrap aggregated columns in COALESCE(expression, 0) whenever a FULL JOIN may produce NULLs (e.g., COALESCE(SUM(orders.amount), 0) AS total_revenue).
14. Column aliases: always alias computed columns with readable snake_case names matching the metric displayName (e.g., SUM(orders.total) AS total_revenue).
15. Default time range: if no timeRange is provided for a time-based query, default to the last 30 days relative to today ({{CURRENT_DATE}}).

Respond with a JSON object containing:
- sql: The SQL query string
- dialect: The target dialect (must be "{{DIALECT}}")
- tablesTouched: Array of table names used
- estimatedComplexity: "low", "medium", or "high"`;

function buildPreamble(dialect: string): string {
  const currentDate = new Date().toISOString().split("T")[0];
  return PREAMBLE_PROMPT
    .replaceAll("{{CURRENT_DATE}}", currentDate!)
    .replaceAll("{{DIALECT}}", dialect);
}

function buildSemanticBlock(
  semanticMetadata: SemanticMetadata,
  hasAdHocMetrics: boolean,
): string {
  let block = `## Semantic Layer Reference\n\n${semanticMetadata.semanticMarkdown}`;

  if (hasAdHocMetrics && semanticMetadata.rawSchemaDDL) {
    block += `\n\n## Raw Database Schema (for ad-hoc metrics)\n${semanticMetadata.rawSchemaDDL}\n\nWhen the intent includes "adHocMetrics", use their formulas directly in the SQL.\nDetermine appropriate JOINs based on the foreign key relationships in the raw schema.\nApply the same best practices (CTEs for multi-table, GROUP BY, etc.) as for predefined metrics.`;
  }

  return block;
}

function buildUserMessage(
  intent: IntentObject,
  previousSql?: string,
  validationErrors?: string[],
): string {
  // Only pass SQL-relevant fields — strip intent resolution metadata
  const sqlIntent = {
    queryType: intent.queryType,
    metrics: intent.metrics,
    adHocMetrics: intent.adHocMetrics,
    dimensions: intent.dimensions,
    filters: intent.filters,
    timeRange: intent.timeRange,
    comparisonMode: intent.comparisonMode,
    sortBy: intent.sortBy,
    sortOrder: intent.sortOrder,
    limit: intent.limit,
  };

  let message = `Generate a SQL query for the following intent:

${JSON.stringify(sqlIntent, null, 2)}`;

  if (intent.adHocMetrics && intent.adHocMetrics.length > 0) {
    message += `\n\nAD-HOC METRIC FORMULAS TO USE:`;
    for (const m of intent.adHocMetrics) {
      message += `\n- ${m.name}: ${m.formula} (tables: ${m.tables.join(", ")})`;
    }
  }

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
    const hasAdHocMetrics = (intent.adHocMetrics?.length ?? 0) > 0;
    const preamble = buildPreamble(context.dialect);
    const semanticBlock = buildSemanticBlock(semanticMetadata, hasAdHocMetrics);
    const userMessage = buildUserMessage(intent, previousSql, validationErrors);

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 2048,
      temperature: 0,
      system: [
        { type: "text", text: preamble },
        { type: "text", text: semanticBlock, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // Log cache usage when available
    const usage = response.usage as unknown as Record<string, number>;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    if (cacheReadTokens > 0) {
      // Cache usage tracked via trace
    }

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
