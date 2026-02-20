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
}

const SYSTEM_PROMPT = `You are an expert SQL query generator. Given a structured intent object and semantic layer metadata, generate a valid SQL query.

Target dialect: {{DIALECT}}

Semantic Layer Information:

METRICS (with formulas):
{{METRICS}}

DIMENSIONS (with table/column mappings):
{{DIMENSIONS}}

RELATIONSHIPS:
{{RELATIONSHIPS}}

Guidelines:
1. Generate parameterized queries when possible (use $1, $2, etc. for PostgreSQL)
2. Apply appropriate JOINs based on the relationships defined
3. Use the exact formulas from metric definitions
4. Apply filters using WHERE clauses
5. Group by all dimension columns when aggregating
6. Apply ORDER BY and LIMIT as specified in the intent
7. For time ranges, use appropriate date functions for the dialect
8. Estimate query complexity (low, medium, high) based on number of joins and aggregations

Respond with a JSON object containing:
- sql: The SQL query string
- dialect: The target dialect (must be "{{DIALECT}}")
- tablesTouched: Array of table names used
- estimatedComplexity: "low", "medium", or "high"`;

function buildSystemPrompt(
  semanticMetadata: SemanticMetadata,
  dialect: string,
): string {
  const metricsDesc = semanticMetadata.metrics
    .map((m) => `- ${m.name}: ${m.formula} (grain: ${m.grain ?? "any"})`)
    .join("\n");

  const dimensionsDesc = semanticMetadata.dimensions
    .map((d) => `- ${d.name}: ${d.table}.${d.column} (${d.type})`)
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

  return SYSTEM_PROMPT.replaceAll("{{DIALECT}}", dialect)
    .replace("{{METRICS}}", metricsDesc)
    .replace("{{DIMENSIONS}}", dimensionsDesc)
    .replace("{{RELATIONSHIPS}}", relationshipsDesc);
}

function buildUserMessage(intent: IntentObject): string {
  return `Generate a SQL query for the following intent:

${JSON.stringify(intent, null, 2)}`;
}

export async function generateSql(
  input: SqlGeneratorInput,
): Promise<AgentResult<GeneratedSQL>> {
  const startedAt = new Date();
  const { context, intent, semanticMetadata } = input;

  try {
    const systemPrompt = buildSystemPrompt(semanticMetadata, context.dialect);
    const userMessage = buildUserMessage(intent);

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
