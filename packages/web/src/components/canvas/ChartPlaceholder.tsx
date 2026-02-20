"use client";

export function ChartPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 py-12 dark:border-zinc-600 dark:bg-zinc-800/30">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Chart will appear here
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        Visualization renderer will be wired in Phase 4
      </p>
    </div>
  );
}
