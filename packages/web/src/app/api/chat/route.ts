import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { processQuery } from "@/lib/orchestrator";

const SYSTEM_PROMPT = `You are HeyData, an AI assistant that helps users analyze their data.

IMPORTANT: You MUST use the query_data tool for ANY question that involves:
- Metrics, KPIs, or analytics (revenue, installs, clicks, conversions, etc.)
- Trends over time (graphs, charts, time series)
- Entity lookups (information about a specific user, account, link, etc.)
- Data aggregations (totals, counts, averages, sums)
- Filtering or searching data (users by name, links by slug, etc.)
- Any question that could be answered by querying a database

Examples that REQUIRE the query_data tool:
- "show me revenue" → use tool
- "how many installs last month" → use tool
- "info about username: orbit" → use tool (this is an entity lookup!)
- "details for user X" → use tool
- "what links does user Y have" → use tool
- "show me the top users" → use tool

Do NOT answer data questions from memory — ALWAYS use the tool so they get real results.

For general conversation only (greetings like "hi", "help", "what can you do"), answer directly without calling tools.

After a query_data result, briefly summarize the insight in one or two sentences.`;

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
