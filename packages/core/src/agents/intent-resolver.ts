import {
  HeyDataError,
  type IntentObject,
  IntentObjectSchema,
  type SessionContext,
  type SemanticMetadata,
} from "@heydata/shared";
import type {
  AgentContext,
  AgentInput,
  AgentResult,
} from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface IntentResolverInput extends AgentInput {
  question: string;
  sessionContext?: SessionContext;
  semanticMetadata: SemanticMetadata;
}

const SYSTEM_PROMPT = `You are an expert data analyst assistant that interprets natural language questions about business data and converts them into structured intent objects.

TODAY'S DATE: {{CURRENT_DATE}}

Your task is to analyze the user's question and the FULL semantic layer below to determine:
1. The type of analysis they want (trend, comparison, ranking, anomaly, drill_down, aggregation, distribution, correlation)
2. Which metrics they want to analyze - CAREFULLY READ each metric's formula to understand what it measures
3. Which dimensions to group by - check each metric's compatible dimensions
4. Any filters to apply
5. Time range if specified (use ABSOLUTE dates based on today's date)
6. Comparison mode if comparing periods
7. Sort order and limits if applicable

SEMANTIC LAYER:

METRICS (with formulas and compatible dimensions):
{{METRICS}}

DIMENSIONS (with table/column mappings):
{{DIMENSIONS}}

Guidelines:
- CAREFULLY ANALYZE each metric's FORMULA to understand what it actually measures before selecting it
- Prefer dimensions listed as compatible with the selected metrics
- If the user explicitly requests a dimension by name (e.g. "per username", "by username") and that dimension exists in DIMENSIONS, include it even if not in the metric's compatible list - the SQL generator can join tables as needed. Use lower confidence (e.g. 0.5) in such cases rather than asking for clarification
- Match names exactly as defined; use synonyms when user terms differ
- If ambiguous, set clarificationNeeded: true with a clarificationQuestion
- Set confidence (0.0-1.0) based on interpretation certainty
- CRITICAL: Convert relative time expressions to ABSOLUTE dates using today ({{CURRENT_DATE}}). Example: "last 2 months" with today=2026-02-21 → timeRange: {"start": "2025-12-21", "end": "2026-02-21"}
- For trend/graph queries, include a date dimension to group by and set appropriate grain
- When filtering to a single entity (e.g., one username), select metrics whose formulas make sense for that entity's data (e.g., SUM, COUNT of their records), not metrics that count distinct entities (which would trivially be 1)

Respond with JSON matching IntentObject schema. Required fields: queryType, metrics (array with at least one), dimensions (array), filters (array), isFollowUp (boolean), clarificationNeeded (boolean), confidence (0-1).
`;

function buildSystemPrompt(metadata: SemanticMetadata): string {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  const metricsDesc = metadata.metrics
    .map(
      (m) =>
        `- ${m.name} (${m.displayName})
    Description: ${m.description}
    Formula: ${m.formula}
    Compatible dimensions: ${m.dimensions.length > 0 ? m.dimensions.join(", ") : "all"}${m.grain ? `\n    Grain: ${m.grain}` : ""}${m.synonyms?.length ? `\n    Synonyms: ${m.synonyms.join(", ")}` : ""}`,
    )
    .join("\n\n");

  const dimensionsDesc = metadata.dimensions
    .map(
      (d) =>
        `- ${d.name} (${d.displayName}): ${d.description} [${d.table}.${d.column}, type: ${d.type}]${d.synonyms?.length ? ` [synonyms: ${d.synonyms.join(", ")}]` : ""}`,
    )
    .join("\n");

  return SYSTEM_PROMPT
    .replaceAll("{{CURRENT_DATE}}", currentDate!)
    .replace("{{METRICS}}", metricsDesc)
    .replace("{{DIMENSIONS}}", dimensionsDesc);
}

function buildUserMessage(
  question: string,
  sessionContext?: SessionContext,
): string {
  if (!sessionContext || sessionContext.turns.length === 0) {
    return question;
  }

  const recentTurns = sessionContext.turns.slice(-4);
  const conversationContext = recentTurns
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join("\n");

  return `Previous conversation:
${conversationContext}

Current question: ${question}`;
}

export async function resolveIntent(
  input: IntentResolverInput,
): Promise<AgentResult<IntentObject>> {
  const startedAt = new Date();
  const { context, question, sessionContext, semanticMetadata } = input;

  try {
    const systemPrompt = buildSystemPrompt(semanticMetadata);
    const userMessage = buildUserMessage(question, sessionContext);

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 1024,
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
        "INTENT_UNRESOLVABLE",
        "No text response from intent resolver",
        { agent: "intent_resolver" },
      );
    }

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = IntentObjectSchema.parse(parsed);

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: validated,
      trace: createSuccessTrace({
        agent: "intent_resolver",
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
        agent: "intent_resolver",
        model: context.model,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "INTENT_UNRESOLVABLE",
      `Failed to resolve intent: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "intent_resolver", details: { trace } },
    );
  }
}
