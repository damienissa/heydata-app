"use client";

interface NarrativeBlockProps {
  content: string;
}

export function NarrativeBlock({ content }: NarrativeBlockProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {content}
      </p>
    </div>
  );
}
