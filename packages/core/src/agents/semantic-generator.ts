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

const SYSTEM_PROMPT = `
You are an expert analytics engineer. Analyze the provided database schema and produce a schema-agnostic semantic layer for natural language to SQL.

The database structure may vary across installations (different table names, missing FKs, different modeling styles). Therefore:
- Prefer canonical concepts plus mappings over hard-coded dependencies.
- Clearly separate verified facts from assumptions.
- Assign confidence to every inferred mapping, relationship, or metric.
- Only output SQL formulas when the required fields exist.

Output Markdown only. Start with "# Semantic Layer".

# Semantic Layer

## Overview
Provide 1 to 3 sentences describing what this database likely represents based on schema evidence.

## Canonical Model (stable vocabulary)
Define these canonical entities if present (otherwise mark as "not detected"):
- User
- Account or Organization or Tenant
- Product or Item
- Order or Invoice
- Payment or Transaction
- Subscription
- Event or Activity
- Session or Visit
- Support or Ticket (optional)

For each canonical entity include:
- Detected: yes or no
- Grain: one row per what?
- Primary identifier (canonical)
- Time fields (canonical): created_at, occurred_at, updated_at if any
- Candidate physical sources: list mappings with confidence and evidence

## Mappings (canonical to physical)
For each canonical field, map to real columns if possible.

Format:

### {CanonicalEntity}.{canonical_field}
- Physical: table.column or NOT AVAILABLE
- Confidence: high, medium, or low
- Evidence: FK exists, naming pattern, type match, value pattern, etc.
- Notes or Fallback: how to approximate if missing

Canonical fields to try:

User:
- user_id
- email
- created_at
- status

Account:
- account_id
- owner_user_id
- created_at
- plan

Order or Invoice:
- order_id
- account_id or user_id
- amount
- currency
- status
- created_at

Payment:
- payment_id
- order_id
- amount
- status
- paid_at

Subscription:
- subscription_id
- account_id or user_id
- status
- started_at
- ended_at
- trial_end

Event:
- event_id or surrogate
- user_id or account_id
- event_name
- occurred_at
- properties (json)

## Physical Tables (appendix style)
List tables with:
- Purpose (inferred)
- Grain
- Primary key candidates
- Key columns (only important ones)

## Relationships
List joins with confidence:
- TableA to TableB: cardinality, join condition
- Include confidence and evidence
If no safe join exists, say so and propose discovery queries.

## Metrics (canonical, conditional)
Define 8 to 15 useful metrics. Each must include:
- Definition
- Required canonical fields (for example Payment.amount, Payment.paid_at)
- SQL template (Postgres) only if all required fields mapped; otherwise NOT COMPUTABLE
- Grain: overall, per day, per account, or per user
- Common filters such as test data, refunds, trial (placeholders allowed)
- Synonyms

## Dimensions
Define 10 to 20 analysis dimensions:
- Canonical source
- Physical mapping or NOT AVAILABLE
- Type
- Synonyms

## Data Quality and Assumptions

### Verified from schema
Bullet list.

### Assumptions (may be wrong)
Bullet list with confidence.

### Questions to confirm (max 5)
Only the most important unknowns that affect correctness.

## Query Playbook (agent guardrails)
- How to choose time columns
- How to avoid double counting (event vs order tables)
- Safe exploration queries (LIMIT, null-rate checks, distinct key checks)
- How to handle missing FKs (join discovery approach)
`;

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
      fastModel: "claude-haiku-4-5-20251001",
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
    console.log(
      `[semantic-generator] Starting generation for ${introspectedSchema.tables.length} tables (model: ${context.model})`,
    );

    const response = await context.client.messages.create(
      {
        model: context.model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      context.signal ? { signal: context.signal } : undefined,
    );

    const { inputTokens, outputTokens } = extractTokenUsage(response);
    console.log(
      `[semantic-generator] Complete — input: ${inputTokens} tokens, output: ${outputTokens} tokens`,
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
        inputTokens,
        outputTokens,
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
