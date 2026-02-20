"use client";

import { RendererRouter } from "@heydata/renderer";
import type { OrchestratorResponse } from "@heydata/shared";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface QueryResultProps {
  response: OrchestratorResponse;
  className?: string;
}

/**
 * Displays the full result from an orchestrator query including:
 * - Narrative summary
 * - Visualization
 * - Data quality insights
 */
export function QueryResult({ response, className = "" }: QueryResultProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { narrative, visualization, results, trace } = response;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Narrative Summary */}
      {narrative && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
        </div>
      )}

      {/* Visualization */}
      {visualization && results && results.rows.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <RendererRouter
            spec={visualization}
            data={results.rows}
            columns={results.columns}
            height={350}
          />
        </div>
      )}

      {/* Data Quality Flags */}
      {results?.qualityFlags && results.qualityFlags.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Data Quality Notes
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-yellow-700 dark:text-yellow-300">
            {results.qualityFlags.slice(0, 3).map((flag, i) => (
              <li key={i}>{flag.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights */}
      {results?.insights && results.insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {results.insights.slice(0, 4).map((insight, i) => (
            <span
              key={i}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                insight.significance === "high"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              {insight.type}: {insight.message.slice(0, 50)}
              {insight.message.length > 50 ? "..." : ""}
            </span>
          ))}
        </div>
      )}

      {/* Execution Details (collapsible) */}
      <div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:underline"
        >
          {showDetails ? "Hide" : "Show"} execution details
        </button>

        {showDetails && (
          <div className="mt-2 rounded bg-muted/50 p-2 text-xs">
            <p>Request ID: {trace.requestId}</p>
            <p>Duration: {trace.totalDurationMs}ms</p>
            <p>Tokens: {trace.totalInputTokens} in / {trace.totalOutputTokens} out</p>
            <p>Agents: {trace.agentTraces.map((t) => t.agent).join(" → ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
