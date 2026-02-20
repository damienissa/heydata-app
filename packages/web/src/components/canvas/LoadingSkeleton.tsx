"use client";

export function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
      <div className="h-32 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
      <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
    </div>
  );
}
