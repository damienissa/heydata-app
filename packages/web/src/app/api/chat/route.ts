export const maxDuration = 300;

import { processQueryForConnection } from "@/lib/process-query-for-connection";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@ai-sdk/anthropic";
import type { OrchestratorResponse } from "@heydata/shared";
import { convertToModelMessages, generateText, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

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

CRITICAL: Call query_data EXACTLY ONCE per user message. Never call it more than once, even for complex questions. Combine all aspects of the question into a single tool call.

Do NOT answer data questions from memory — ALWAYS use the tool so they get real results.

For general conversation only (greetings like "hi", "help", "what can you do"), answer directly without calling tools.

After calling query_data, do NOT add any text response. The tool result already contains the complete narrative, visualization, and analysis. Respond with the tool call only — no follow-up text.`;

const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()).default([]),
  sessionId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid request body", details: parsed.error.flatten().fieldErrors } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { messages: effectiveMessages, sessionId, connectionId } = parsed.data;

    const queryDataTool = tool({
      description:
        "Run an analytics query against the user's data. Use this for any question about metrics, dimensions, trends, or data (revenue, installs, clicks, etc.). Returns narrative, visualization spec, and result set.",
      inputSchema: z.object({
        question: z.string().describe("The user's natural language question about the data"),
      }),
      execute: async ({ question }) => {
        // Execute query via orchestrator pipeline
        if (!connectionId) {
          const noConnectionResponse: OrchestratorResponse = {
            requestId: `req_${Date.now()}_no_conn`,
            intent: {
              queryType: "aggregation",
              metrics: ["_none"],
              adHocMetrics: [],
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
        // Return orchestrator response to be rendered in chat
        return response;
      },
    });

    // Convert UI messages to model format (handles tool calls/results correctly).
    // Sanitize: ensure parts exist, Anthropic rejects empty text blocks, and
    // assistant-ui tool parts (tool-{name}) are converted to AI SDK format
    // (tool-invocation) so convertToModelMessages creates matching tool_use +
    // tool_result blocks.
    const sanitizedMessages = effectiveMessages.map((msg: unknown) => {
      const m = msg as { role: string; content?: string; parts?: Array<{ type: string; text?: string } & Record<string, unknown>> };
      let parts = m.parts && Array.isArray(m.parts) ? [...m.parts] : [];
      if (parts.length === 0 && (m.content != null || m.role === "user" || m.role === "assistant")) {
        const text = typeof m.content === "string" ? m.content : "";
        parts = [{ type: "text" as const, text: text || " " }];
      }
      return {
        ...m,
        parts: parts.map((p: { type: string; text?: string } & Record<string, unknown>) => {
          // Convert assistant-ui tool parts to AI SDK tool-invocation format
          if (p.type.startsWith("tool-") && p.type !== "tool-invocation") {
            const toolName = p.type.replace(/^tool-/, "");
            return {
              type: "tool-invocation" as const,
              toolCallId: (p.toolCallId ?? p.id ?? `tc_${Date.now()}`) as string,
              toolName,
              args: (p.input ?? p.args ?? {}) as Record<string, unknown>,
              state: "result" as const,
              result: p.output ?? p.result,
            };
          }
          // Fix empty text parts
          if (p.type === "text" && (p.text == null || p.text === "")) {
            return { ...p, text: " " };
          }
          return p;
        }),
      };
    });

    const modelMessages = await convertToModelMessages(
      sanitizedMessages as Array<Omit<UIMessage, "id">>,
      { tools: { query_data: queryDataTool } }
    );

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

          // Touch session updated_at so sidebar ordering reflects last activity.
          // Belt-and-suspenders: the DB trigger does this too, but this covers
          // cases where the migration hasn't been applied yet.
          await supabase
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() } as never)
            .eq("id", sessionId);

          // Fire-and-forget: auto-generate session title on first message
          void (async () => {
            try {
              const { data: sess } = await supabase
                .from("chat_sessions")
                .select("title")
                .eq("id", sessionId)
                .single();
              const sessTitle = (sess as { title?: string } | null)?.title;

              if (sessTitle === "New Chat") {
                const { text } = await generateText({
                  model: anthropic("claude-haiku-4-5-20251001"),
                  system:
                    "Generate a very short title (3-6 words) summarizing the user's message. Return ONLY the title text, no quotes, no punctuation at the end.",
                  prompt: userContent.slice(0, 200),
                });
                const title = text.trim().replace(/[."]+$/, "").slice(0, 100);
                if (title) {
                  await supabase
                    .from("chat_sessions")
                    .update({ title } as never)
                    .eq("id", sessionId);
                }
              }
            } catch {
              // Non-critical — title stays as "New Chat"
            }
          })();
        }
      }
    }

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { query_data: queryDataTool },
      // 2 steps: step 0 may call query_data, step 1 processes the tool result.
      // Disable tools after step 0 so the model can't call query_data twice.
      stopWhen: stepCountIs(2),
      prepareStep: ({ stepNumber }) => {
        if (stepNumber > 0) return { toolChoice: "none" as const };
        return {};
      },
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
    return new Response(
      JSON.stringify({ error: { message: "Internal server error" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
