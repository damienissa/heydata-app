import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processQueryForConnection } from "@/lib/process-query-for-connection";
import type { OrchestratorResponse } from "@heydata/shared";

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
    const body = await req.json();
    const {
      messages,
      sessionId,
      connectionId,
    }: {
      messages?: unknown[];
      sessionId?: string;
      connectionId?: string;
    } = body;

    const effectiveMessages = Array.isArray(messages) ? messages : [];
    console.log("[chat] Received sessionId:", sessionId, "connectionId:", connectionId);

    // Convert UI messages to simple format for the model
    // assistant-ui sends { parts: [...] } instead of { content: ... }
    const formattedMessages = effectiveMessages.map((msg: unknown) => {
      const m = msg as { role: string; content?: unknown; parts?: Array<{ type: string; text?: string }> };
      let content: string;

      if (m.parts && Array.isArray(m.parts)) {
        // assistant-ui format: extract text from parts
        content = m.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      } else if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = (m.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      } else {
        content = String(m.content || "");
      }

      return {
        role: m.role as "user" | "assistant",
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
        if (!connectionId) {
          const noConnectionResponse: OrchestratorResponse = {
            requestId: `req_${Date.now()}_no_conn`,
            intent: {
              queryType: "aggregation",
              metrics: ["_none"],
              dimensions: [],
              filters: [],
              comparisonMode: "none",
              isFollowUp: false,
              clarificationNeeded: false,
              confidence: 0,
            },
            narrative: "Please select a connection from the header to query your data.",
            trace: {
              requestId: `req_${Date.now()}_no_conn`,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              totalDurationMs: 0,
              agentTraces: [],
              totalInputTokens: 0,
              totalOutputTokens: 0,
            },
          };
          return noConnectionResponse;
        }
        const supabase = await createClient();
        const response = await processQueryForConnection(
          supabase as unknown as import("@supabase/supabase-js").SupabaseClient<import("@heydata/supabase").Database>,
          {
            connectionId,
            question,
            sessionId: sessionId ?? undefined,
          },
        );
        console.log("[chat] Query response received, requestId:", response.requestId);
        return response;
      },
    });

    // Persist user message when we have a session
    if (sessionId && effectiveMessages.length > 0) {
      const lastMsg = effectiveMessages[effectiveMessages.length - 1] as {
        role?: string;
        content?: string;
        parts?: Array<{ type: string; text?: string }>;
      };
      const isUser = lastMsg?.role === "user";
      if (isUser) {
        let userContent = "";
        if (lastMsg.parts && Array.isArray(lastMsg.parts)) {
          userContent = lastMsg.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text || "")
            .join("");
        } else {
          userContent = typeof lastMsg.content === "string" ? lastMsg.content : "";
        }
        if (userContent.trim()) {
          const supabase = await createClient();
          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "user",
            content: userContent,
          } as never);
        }
      }
    }

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
      tools: { query_data: queryDataTool },
    });

    return result.toUIMessageStreamResponse({
      onFinish: async (event) => {
        if (!sessionId || event.isAborted) return;
        try {
          const supabase = await createClient();
          const msg = event.responseMessage as {
            parts?: Array<Record<string, unknown>>;
            content?: unknown;
            toolInvocations?: unknown;
          } | undefined;
          let content = "";
          const toolParts: unknown[] = [];

          if (msg?.parts && Array.isArray(msg.parts)) {
            for (const p of msg.parts) {
              if (p.type === "text" && typeof p.text === "string") {
                content += p.text;
              } else if (typeof p.type === "string" && p.type.startsWith("tool-")) {
                toolParts.push({
                  toolCallId: p.toolCallId ?? p.id,
                  toolName: p.type.replace(/^tool-/, "") || "query_data",
                  args: p.input ?? {},
                  result: p.output,
                });
              }
            }
          } else if (msg?.content) {
            if (Array.isArray(msg.content)) {
              content = (msg.content as Array<{ type?: string; text?: string }>)
                .filter((p) => p.type === "text")
                .map((p) => p.text ?? "")
                .join("");
            } else if (typeof msg.content === "string") {
              content = msg.content;
            }
            if (msg.toolInvocations && Array.isArray(msg.toolInvocations)) {
              for (const inv of msg.toolInvocations as Array<Record<string, unknown>>) {
                toolParts.push({
                  toolCallId: inv.toolCallId ?? inv.id,
                  toolName: inv.toolName ?? "query_data",
                  args: inv.args ?? inv.input ?? {},
                  result: inv.result ?? inv.output,
                });
              }
            }
          }

          const toSave = content.trim() || (toolParts.length ? "[Query result]" : "[Response]");
          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: toSave,
            tool_results: toolParts.length ? toolParts : null,
          } as never);
        } catch (err) {
          console.error("[chat] Failed to persist assistant message:", err);
        }
      },
    });
  } catch (error) {
    console.error("[chat] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
