"use client";

import type { VisualizationSpec } from "@heydata/shared";
import { SqlViewer } from "@/components/transparency/SqlViewer";
import { ChartPlaceholder } from "./ChartPlaceholder";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { NarrativeBlock } from "./NarrativeBlock";

interface ResultsCanvasProps {
  visualizationSpec?: VisualizationSpec | null;
  narrative?: string | null;
  sql?: string | null;
  isLoading?: boolean;
}

export function ResultsCanvas({
  visualizationSpec,
  narrative,
  sql,
  isLoading = false,
}: ResultsCanvasProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingSkeleton />
      </div>
    );
  }

  const hasContent = visualizationSpec || (narrative && narrative.trim());

  if (!hasContent) {
    return (
      <div className="flex flex-col gap-4">
        <ChartPlaceholder />
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Ask a question to see results and narrative here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sql?.trim() && <SqlViewer sql={sql} />}
      <div className="min-h-[200px]">
        <ChartPlaceholder />
      </div>
      {narrative?.trim() && <NarrativeBlock content={narrative} />}
    </div>
  );
}
