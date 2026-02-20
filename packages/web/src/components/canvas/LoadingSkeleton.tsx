"use client";

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-64 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </div>
  );
}
