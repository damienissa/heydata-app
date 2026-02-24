import {
  HeyDataError,
  type IntrospectedSchema,
} from "@heydata/shared";
import type { AgentInput, AgentResult } from "../types.js";
import { createSuccessTrace, extractTokenUsage } from "../types.js";

export interface SemanticGeneratorOutput {
  semanticMarkdown: string;
}

export interface SemanticGeneratorInput extends AgentInput {
  introspectedSchema: IntrospectedSchema;
}

const SYSTEM_PROMPT = `You are an expert data modeler. Your task is to analyze a database schema and produce a Markdown semantic layer document that will power natural language queries.

The document gives AI agents full context about the database — what tables exist, what metrics can be computed, how tables relate, and any business rules — so they can generate accurate SQL queries from natural language questions.

## Output Format

Produce a Markdown document with these sections:

# Semantic Layer

## Overview
[1-2 sentences describing what this database represents and what it tracks]

## Tables

### {table_name}
**Purpose**: [what this table stores]
**Primary Key**: \`{pk_column}\`
**Columns**:
- \`{column}\` ({data_type}[, PK][, FK→{other_table}.{other_column}]) — [short description]
[repeat for each important column]

[repeat ### block for each table]

## Metrics

### {metric_name}
- **Formula**: \`{SQL aggregate expression using table.column references}\`
- **Description**: [what this metric measures]
- **Synonyms**: [comma-separated list of alternative names users might say]
- **Format**: [currency_usd | percentage | number] (omit if plain number)

[repeat for each metric — aim for 5-10 meaningful metrics]

## Dimensions

### {dimension_name}
- **Source**: \`{table}.{column}\`
- **Type**: [string | number | date | boolean]
- **Description**: [what this dimension represents]
- **Synonyms**: [comma-separated alternatives]

[repeat for each dimension — aim for 8-15 dimensions]

## Relationships
- \`{table_a}\` → \`{table_b}\`: [one-to-many | one-to-one | many-to-many] via \`{table_b}.{fk_col} = {table_a}.{pk_col}\`
[one line per relationship]

## Domain Knowledge
<!-- This section is intentionally left for the user to fill in.
Examples of what to add:
- Revenue always excludes trial periods and test accounts
- "Active user" means logged in within the last 30 days
- Data before a certain date is unreliable due to a migration
-->

## Guidelines

- Use ONLY table and column names that actually appear in the schema
- For COUNT metrics on entity tables, use the PRIMARY KEY column (e.g. COUNT(DISTINCT users.id))
- Metric formulas must be valid PostgreSQL aggregate expressions
- Synonyms are critical — add all terms a user might naturally say for each metric/dimension
- Keep descriptions concise but precise
- Output the Markdown document only, starting with "# Semantic Layer"`;

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

  return `Generate the semantic layer Markdown document for this schema (${schema.tables.length} tables):\n\n${tablesDesc}`;
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
 * a Markdown semantic layer document.
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

    return {
      data: { semanticMarkdown: textBlock.text.trim() },
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
