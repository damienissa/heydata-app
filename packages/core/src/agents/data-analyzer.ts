import {
  HeyDataError,
  InsightAnnotationSchema,
  type ColumnStats,
  type InsightAnnotation,
  type IntentObject,
  type ResultSet,
} from "@heydata/shared";
import { z } from "zod";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface DataAnalyzerInput extends AgentInput {
  resultSet: ResultSet;
  columnStats: ColumnStats[];
  intent: IntentObject;
  question?: string;
}

const InsightsResponseSchema = z.object({
  insights: z.array(InsightAnnotationSchema),
});

const SYSTEM_PROMPT = `You are an expert data analyst. Analyze the query results and generate meaningful insights.

For each insight, provide:
- type: "trend", "outlier", "anomaly", "growth_rate", "comparison", "correlation", or "summary_stat"
- message: A human-readable description of the insight
- metric: The metric this insight relates to (optional)
- value: The numeric or string value (optional)
- significance: "low", "medium", or "high"

Focus on:
1. Identifying trends over time (increasing, decreasing, stable)
2. Calculating growth rates and changes
3. Spotting anomalies or unexpected values
4. Making comparisons when multiple series exist
5. Summarizing key statistics

Significance thresholds:
- "high": changes >20%, values >2 standard deviations from mean, or clear anomalies
- "medium": notable patterns worth mentioning
- "low": minor observations

Rules:
- Generate a MAXIMUM of 5 insights, prioritizing the highest-significance ones
- Only report insights that are meaningful and actionable — skip trivial observations
- Be concise and data-driven

Respond with a JSON object containing an "insights" array.`;

function buildUserMessage(
  resultSet: ResultSet,
  columnStats: ColumnStats[],
  intent: IntentObject,
  question?: string,
): string {
  // Limit the data sample to avoid token limits
  const sampleRows = resultSet.rows.slice(0, 50);

  // Compact column stats: one line per column instead of full JSON
  const compactStats = columnStats
    .map((s) => {
      const parts = [`nulls=${s.nullCount}`, `distinct=${s.distinctCount}`];
      if (s.min !== null && s.min !== undefined) parts.push(`min=${s.min}`);
      if (s.max !== null && s.max !== undefined) parts.push(`max=${s.max}`);
      if (s.mean !== null && s.mean !== undefined) parts.push(`mean=${Number(s.mean).toFixed(2)}`);
      return `${s.column}: ${parts.join(", ")}`;
    })
    .join("\n");

  return `Analyze the following query results:

Original question: "${question ?? `${intent.queryType} of ${intent.metrics.join(", ")}`}"
Query type: ${intent.queryType}
Metrics: ${intent.metrics.join(", ")}
Dimensions: ${intent.dimensions.join(", ")}

Column Statistics:
${compactStats}

Data Sample (first ${sampleRows.length} of ${resultSet.rowCount} rows):
${JSON.stringify(sampleRows, null, 2)}

Total rows: ${resultSet.rowCount}
Truncated: ${resultSet.truncated}

Generate insights based on this data.`;
}

export async function analyzeData(
  input: DataAnalyzerInput,
): Promise<AgentResult<InsightAnnotation[]>> {
  const startedAt = new Date();
  const { context, resultSet, columnStats, intent, question } = input;

  // For empty results, return basic insight
  if (resultSet.rowCount === 0) {
    return {
      data: [
        {
          type: "summary_stat",
          message: "The query returned no results. Consider adjusting your filters or time range.",
          significance: "high",
        },
      ],
      trace: createSuccessTrace({
        agent: "data_analyzer",
        model: context.model,
        startedAt,
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
  }

  try {
    const userMessage = buildUserMessage(resultSet, columnStats, intent, question);

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM_PROMPT,
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
        "AGENT_ERROR",
        "No text response from data analyzer",
        { agent: "data_analyzer" },
      );
    }

    // Extract JSON from the response
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = InsightsResponseSchema.parse(parsed);

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: validated.insights,
      trace: createSuccessTrace({
        agent: "data_analyzer",
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
        agent: "data_analyzer",
        model: context.model,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "AGENT_ERROR",
      `Failed to analyze data: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "data_analyzer", details: { trace } },
    );
  }
}
