"use client";

import { RendererRouter } from "@heydata/renderer";
import type { ColumnMetadata, Row, VisualizationSpec } from "@heydata/shared";

export interface ResultsCanvasProps {
  spec: VisualizationSpec | null;
  data: Row[];
  columns?: ColumnMetadata[];
  isLoading?: boolean;
  className?: string;
}

/**
 * ResultsCanvas displays visualizations from query results.
 * It uses the @heydata/renderer to render charts, KPIs, and tables
 * based on the VisualizationSpec from the AI agent pipeline.
 */
export function ResultsCanvas({
  spec,
  data,
  columns,
  isLoading = false,
  className = "",
}: ResultsCanvasProps) {
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Generating visualization...</span>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground ${className}`}>
        <p>Ask a question to see results here</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground">No data to display</p>
          <p className="text-sm text-muted-foreground/70">The query returned no results</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <RendererRouter
        spec={spec}
        data={data}
        columns={columns}
        height={400}
      />
    </div>
  );
}
