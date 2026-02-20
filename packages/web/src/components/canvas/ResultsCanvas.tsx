"use client";

import { ChartPlaceholder } from "./ChartPlaceholder";
import { NarrativeBlock } from "./NarrativeBlock";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface VisualizationSpec {
  type: string;
  data: unknown[];
  config?: Record<string, unknown>;
}

interface ResultsCanvasProps {
  visualization?: VisualizationSpec;
  narrative?: string;
  isLoading?: boolean;
}

export function ResultsCanvas({
  visualization,
  narrative,
  isLoading = false,
}: ResultsCanvasProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!visualization && !narrative) {
    return null;
  }

  return (
    <div className="space-y-4 p-4">
      {visualization && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <ChartPlaceholder type={visualization.type} />
        </div>
      )}
      {narrative && <NarrativeBlock content={narrative} />}
    </div>
  );
}
