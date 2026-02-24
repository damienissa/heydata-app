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
2. Which metrics they want to analyze — read each metric's formula to understand what it measures
3. Which dimensions to group by
4. Any filters to apply
5. Time range if specified (use ABSOLUTE dates based on today's date)
6. Comparison mode if comparing periods
7. Sort order and limits if applicable

## Semantic Layer Reference

{{SEMANTIC_LAYER}}

Guidelines:
- CAREFULLY ANALYZE each metric's FORMULA to understand what it actually measures before selecting it
- Match metric/dimension names exactly as defined; use synonyms when user terms differ
- If ambiguous, set clarificationNeeded: true with a clarificationQuestion
- Set confidence (0.0-1.0) based on interpretation certainty
- CRITICAL: Convert relative time expressions to ABSOLUTE dates using today ({{CURRENT_DATE}}). Example: "last 2 months" with today=2026-02-21 → timeRange: {"start": "2025-12-21", "end": "2026-02-21"}
- For trend/graph queries, include a date dimension to group by and set appropriate grain
- When filtering to a single entity (e.g., one username), select metrics whose formulas make sense for that entity's data (e.g., SUM, COUNT of their records), not metrics that count distinct entities (which would trivially be 1)
- If the question has no clear metric match (e.g. "how is my business doing?"), set clarificationNeeded: true and list the top 3 most relevant metrics in clarificationQuestion

OUTPUT FORMAT — return exactly this JSON structure (no markdown wrapper):
{
  "queryType": "trend" | "comparison" | "ranking" | "anomaly" | "drill_down" | "aggregation" | "distribution" | "correlation",
  "metrics": ["predefined_metric_name"],
  "adHocMetrics": [],
  "dimensions": ["dimension_name"],
  "filters": [{"dimension": "dim_name", "operator": "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "contains", "value": "literal"}],
  "timeRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "grain": "daily" | "weekly" | "monthly" | "yearly" | null} | null,
  "comparisonMode": "none" | "period_over_period" | "year_over_year" | "month_over_month",
  "sortBy": "column_name" | null,
  "sortOrder": "asc" | "desc" | null,
  "limit": number | null,
  "isFollowUp": boolean,
  "clarificationNeeded": boolean,
  "clarificationQuestion": "string" | null,
  "confidence": 0.0-1.0
}

EXAMPLE:
Question: "Show me total clicks by day for last week"
Output: {"queryType":"trend","metrics":["total_clicks"],"adHocMetrics":[],"dimensions":["click_date"],"filters":[],"timeRange":{"start":"{{LAST_WEEK_START}}","end":"{{LAST_WEEK_END}}","grain":"daily"},"comparisonMode":"none","sortBy":"click_date","sortOrder":"asc","limit":null,"isFollowUp":false,"clarificationNeeded":false,"clarificationQuestion":null,"confidence":0.95}
`;

function buildSystemPrompt(metadata: SemanticMetadata): string {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  // Compute example dates for the few-shot (last week Mon–Sun)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 13 : dayOfWeek + 6));
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const lastWeekStart = lastMonday.toISOString().split("T")[0]!;
  const lastWeekEnd = lastSunday.toISOString().split("T")[0]!;

  let semanticLayer = metadata.semanticMarkdown;

  if (metadata.rawSchemaDDL) {
    semanticLayer += `

## Ad-Hoc Metrics (when no predefined metric matches)
If the user's question cannot be answered by any predefined metric above, you MAY define one or more ad-hoc metrics using the raw database schema below. Ad-hoc metrics must:
- Use valid SQL aggregate formulas referencing table.column from the schema (e.g., "AVG(sessions.duration_seconds)")
- Be placed in the "adHocMetrics" array with fields: name (snake_case), displayName, formula, tables (array of table names used), and optional description
- NOT be placed in the "metrics" array (that is only for predefined metric names)
- Result in a lower confidence score (0.3-0.6) since they bypass curated definitions

ONLY use ad-hoc metrics when predefined metrics clearly do not fit. Always prefer predefined metrics.

### Raw Database Schema
${metadata.rawSchemaDDL}`;
  }

  return SYSTEM_PROMPT
    .replaceAll("{{CURRENT_DATE}}", currentDate!)
    .replace("{{LAST_WEEK_START}}", lastWeekStart)
    .replace("{{LAST_WEEK_END}}", lastWeekEnd)
    .replace("{{SEMANTIC_LAYER}}", semanticLayer);
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

  return `RECENT CONVERSATION CONTEXT (for reference only):
${conversationContext}

NEW QUESTION TO RESOLVE: ${question}`;
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
      temperature: 0,
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

    // Cap confidence when ad-hoc metrics are used (safety net if LLM ignores instruction)
    if (validated.adHocMetrics.length > 0 && validated.confidence > 0.6) {
      validated.confidence = 0.6;
    }

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
