import type { DbMessage } from "@/hooks/use-session-with-messages";

/**
 * Converts a DB chat_message to AI SDK UIMessage format.
 * UIMessage has: id, role, parts: Array<{ type, text?, ... }>
 * Tool parts: { type: 'tool-query_data', toolCallId, state, input, output }
 */
export function dbMessageToUIMessage(msg: DbMessage): {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<
    | { type: "text"; text: string }
    | {
        type: "tool-query_data";
        toolCallId: string;
        state: "output-available";
        input: { question?: string };
        output: unknown;
      }
  >;
} {
  const role = (msg.role === "user" || msg.role === "assistant" || msg.role === "system"
    ? msg.role
    : "user") as "user" | "assistant" | "system";

  const parts: Array<
    | { type: "text"; text: string }
    | {
        type: "tool-query_data";
        toolCallId: string;
        state: "output-available";
        input: { question?: string };
        output: unknown;
      }
  > = [];

  if (msg.content && msg.content.trim()) {
    parts.push({ type: "text", text: msg.content });
  }

  if (msg.role === "assistant" && msg.tool_results) {
    const invocations = Array.isArray(msg.tool_results) ? msg.tool_results : [msg.tool_results];
    for (const inv of invocations) {
      if (inv && typeof inv === "object") {
        const obj = inv as Record<string, unknown>;
        const toolCallId =
          (typeof obj.toolCallId === "string" ? obj.toolCallId : null) ??
          (typeof obj.id === "string" ? obj.id : null) ??
          `tc_${msg.id}`;
        const toolName = (typeof obj.toolName === "string" ? obj.toolName : null) ?? "query_data";
        const input = (typeof obj.args === "object" && obj.args !== null ? obj.args : {}) as {
          question?: string;
        };
        const output = obj.result ?? obj.output ?? obj;
        if (toolName === "query_data") {
          parts.push({
            type: "tool-query_data",
            toolCallId,
            state: "output-available",
            input,
            output,
          });
        }
      }
    }
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text: msg.content || "" });
  }

  return {
    id: msg.id,
    role,
    parts,
  };
}
