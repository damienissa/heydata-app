"use client";

interface ChartPlaceholderProps {
  type?: string;
}

export function ChartPlaceholder({ type = "chart" }: ChartPlaceholderProps) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {type} will render here
      </p>
    </div>
  );
}
