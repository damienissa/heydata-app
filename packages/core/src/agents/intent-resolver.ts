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

Your task is to analyze the user's question and determine:
1. The type of analysis they want (trend, comparison, ranking, anomaly, drill_down, aggregation, distribution, correlation)
2. Which metrics they want to analyze
3. Which dimensions to group by
4. Any filters to apply
5. Time range if specified
6. Comparison mode if comparing periods
7. Sort order and limits if applicable

You have access to the following metrics and dimensions in the semantic layer:

METRICS:
{{METRICS}}

DIMENSIONS:
{{DIMENSIONS}}

Important guidelines:
- Match metric and dimension names exactly as defined in the semantic layer
- If the user's terms don't exactly match, use synonyms when available
- If a question is ambiguous, set clarificationNeeded to true and provide a clarificationQuestion
- For follow-up questions, consider the conversation context
- Set confidence based on how certain you are about the interpretation (0.0 to 1.0)
- Time expressions like "last month", "this quarter", "yesterday" should be converted to relative date ranges

Respond with a JSON object matching the IntentObject schema.`;

function buildSystemPrompt(metadata: SemanticMetadata): string {
  const metricsDesc = metadata.metrics
    .map(
      (m) =>
        `- ${m.name} (${m.displayName}): ${m.description}${m.synonyms?.length ? ` [synonyms: ${m.synonyms.join(", ")}]` : ""}`,
    )
    .join("\n");

  const dimensionsDesc = metadata.dimensions
    .map(
      (d) =>
        `- ${d.name} (${d.displayName}): ${d.description}${d.synonyms?.length ? ` [synonyms: ${d.synonyms.join(", ")}]` : ""}`,
    )
    .join("\n");

  return SYSTEM_PROMPT.replace("{{METRICS}}", metricsDesc).replace(
    "{{DIMENSIONS}}",
    dimensionsDesc,
  );
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
