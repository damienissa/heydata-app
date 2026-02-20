import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { processQuery } from "@/lib/orchestrator";

const SYSTEM_PROMPT = `You are HeyData, an AI assistant that helps users analyze their data.

When the user asks about metrics, trends, analytics, or anything that requires querying their data (e.g. "show revenue", "how many installs", "daily clicks"), you MUST use the query_data tool with their question. Do not answer data questions from memory — always use the tool so they get real results and a chart.

For general conversation (greetings, help, non-data questions), answer directly without calling tools.

After a query_data result, briefly summarize the insight in one or two sentences and point out the chart or table when present.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    console.log("[chat] Received messages:", JSON.stringify(messages, null, 2));

    // Convert UI messages to simple format for the model
    // assistant-ui sends { parts: [...] } instead of { content: ... }
    const formattedMessages = messages.map((msg: { role: string; content?: unknown; parts?: Array<{ type: string; text?: string }> }) => {
      let content: string;

      if (msg.parts && Array.isArray(msg.parts)) {
        // assistant-ui format: extract text from parts
        content = msg.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      } else if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = (msg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      } else {
        content = String(msg.content || "");
      }

      return {
        role: msg.role as "user" | "assistant",
        content,
      };
    });

    const queryDataTool = tool({
      description:
        "Run an analytics query against the user's data. Use this for any question about metrics, dimensions, trends, or data (revenue, installs, clicks, etc.). Returns narrative, visualization spec, and result set.",
      inputSchema: z.object({
        question: z.string().describe("The user's natural language question about the data"),
      }),
      execute: async ({ question }) => {
        console.log("[chat] Executing query_data tool with:", question);
        const response = await processQuery({ question });
        console.log("[chat] Query response received, requestId:", response.requestId);
        return response;
      },
    });

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
      tools: { query_data: queryDataTool },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
