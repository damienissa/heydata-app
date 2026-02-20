"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { OrchestratorResponseSchema, type OrchestratorResponse } from "@heydata/shared";
import { QueryResult } from "@/components/results/QueryResult";

/**
 * Renders the result of the query_data tool as narrative + chart (QueryResult).
 * Used in the chat thread when the model calls the query_data tool.
 */
export const QueryDataTool: ToolCallMessagePartComponent = ({ result, status }) => {
  console.log("[QueryDataTool] RENDERED - status:", status?.type, "result:", typeof result);

  // Handle running state
  if (status?.type === "running") {
    return (
      <div className="my-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        🔄 Running query...
      </div>
    );
  }

  // Handle no result
  if (!result) {
    console.log("[QueryDataTool] No result yet");
    return null;
  }

  // Handle error result
  if (typeof result === "object" && "error" in result) {
    const errorMsg = (result as { error: string }).error;
    return (
      <div className="my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-medium">Query failed</p>
        <p className="mt-1">{errorMsg}</p>
      </div>
    );
  }

  // Parse and validate result
  const parsed = OrchestratorResponseSchema.safeParse(result);

  if (!parsed.success) {
    console.error("[QueryDataTool] Schema validation failed:", parsed.error.issues);
    return (
      <div className="my-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
        <p className="font-medium">Invalid response format</p>
        <pre className="mt-2 text-xs overflow-auto max-h-40">
          {JSON.stringify(parsed.error.issues, null, 2)}
        </pre>
      </div>
    );
  }

  console.log("[QueryDataTool] Rendering QueryResult");

  return (
    <div className="my-3 w-full">
      <QueryResult response={parsed.data as OrchestratorResponse} />
    </div>
  );
};
