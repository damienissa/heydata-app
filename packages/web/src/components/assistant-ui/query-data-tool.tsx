"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { OrchestratorResponseSchema, type OrchestratorResponse } from "@heydata/shared";
import { QueryResult } from "@/components/results/QueryResult";
import { CheckIcon, LoaderIcon, CircleDotIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function ProgressStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-2.5">
      {state === "done" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckIcon className="size-2.5" />
        </div>
      )}
      {state === "active" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <LoaderIcon className="size-2.5 animate-spin" />
        </div>
      )}
      {state === "pending" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
          <CircleDotIcon className="size-2.5" />
        </div>
      )}
      <span
        className={cn(
          "text-xs",
          state === "done" && "text-emerald-700 dark:text-emerald-400",
          state === "active" && "text-foreground",
          state === "pending" && "text-muted-foreground/60",
        )}
      >
        {label}
      </span>
    </div>
  );
}

const PIPELINE_STEPS = [
  "Identifying intent",
  "Generating SQL",
  "Executing query",
  "Analyzing results",
  "Building visualization",
];

function QueryProgress() {
  // Show a realistic animated progression through the pipeline steps.
  // The first step is always "done" (intent was already identified to reach the tool),
  // the second step is active, and the rest are pending.
  return (
    <div className="my-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-col gap-1.5">
        {PIPELINE_STEPS.map((step, i) => (
          <ProgressStep
            key={step}
            label={step}
            state={i === 0 ? "done" : i === 1 ? "active" : "pending"}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders the result of the query_data tool as narrative + chart (QueryResult).
 * Used in the chat thread when the model calls the query_data tool.
 */
export const QueryDataTool: ToolCallMessagePartComponent = ({ result, status }) => {
  // Handle running state with step-by-step progress
  if (status?.type === "running") {
    return <QueryProgress />;
  }

  // Handle no result
  if (!result) {
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

  return (
    <div className="my-3 w-full">
      <QueryResult response={parsed.data as OrchestratorResponse} />
    </div>
  );
};
