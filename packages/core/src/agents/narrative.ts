import {
  HeyDataError,
  type DataQualityFlag,
  type InsightAnnotation,
  type IntentObject,
  type ResultSet,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface NarrativeInput extends AgentInput {
  intent: IntentObject;
  resultSet: ResultSet;
  insights: InsightAnnotation[];
  qualityFlags: DataQualityFlag[];
  question?: string;
}

const SYSTEM_PROMPT = `You are a business intelligence analyst writing data summaries for non-technical stakeholders.

Your task is to create a clear, concise narrative summary of the query results. The summary should:

1. Start with a direct answer to the user's question
2. Highlight the most important insights and findings
3. Mention any data quality issues that might affect interpretation
4. Use specific numbers and percentages
5. Be formatted in markdown for readability

Guidelines:
- Keep the summary to 2-4 paragraphs
- Use bullet points when listing 3 or more distinct findings; use prose for 1-2 findings
- Bold key numbers and metrics
- Avoid technical jargon
- If data quality issues exist, mention them briefly at the end
- If the results are truncated (Truncated: true), add a final note: "Note: showing the first N rows of a larger dataset."

Respond with only the markdown summary text, no JSON wrapper.`;

function buildUserMessage(
  intent: IntentObject,
  resultSet: ResultSet,
  insights: InsightAnnotation[],
  qualityFlags: DataQualityFlag[],
  question?: string,
): string {
  const sampleRows = resultSet.rows.slice(0, 20);
  const questionText = question ?? `${intent.queryType} of ${intent.metrics.join(", ")}`;

  return `Write a summary for the following data analysis:

Original question: "${questionText}"
Time range: ${intent.timeRange ? `${intent.timeRange.start} to ${intent.timeRange.end}` : "not specified"}

Results Overview:
- Total rows: ${resultSet.rowCount}
- Truncated: ${resultSet.truncated}

Data Sample:
${JSON.stringify(sampleRows, null, 2)}

Insights Generated:
${insights.map((i) => `- [${i.type}] ${i.message}${i.significance ? ` (${i.significance} significance)` : ""}`).join("\n")}

Data Quality Notes:
${qualityFlags.length > 0 ? qualityFlags.map((f) => `- [${f.severity}] ${f.message}`).join("\n") : "No quality issues detected."}

Write a clear narrative summary for business stakeholders.`;
}

export async function generateNarrative(
  input: NarrativeInput,
): Promise<AgentResult<string>> {
  const startedAt = new Date();
  const { context, intent, resultSet, insights, qualityFlags, question } = input;

  // For empty results, generate a simple message
  if (resultSet.rowCount === 0) {
    return {
      data: "**No data found** for the specified query. Consider:\n\n- Adjusting your time range\n- Checking your filter criteria\n- Verifying the metric or dimension names",
      trace: createSuccessTrace({
        agent: "narrative",
        model: context.model,
        startedAt,
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
  }

  try {
    const userMessage = buildUserMessage(
      intent,
      resultSet,
      insights,
      qualityFlags,
      question,
    );

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 1024,
      temperature: 0.3,
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
        "No text response from narrative agent",
        { agent: "narrative" },
      );
    }

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: textContent.text.trim(),
      trace: createSuccessTrace({
        agent: "narrative",
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
        agent: "narrative",
        model: context.model,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "AGENT_ERROR",
      `Failed to generate narrative: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "narrative", details: { trace } },
    );
  }
}
