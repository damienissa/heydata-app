"use client";

interface NarrativeBlockProps {
  content: string;
}

export function NarrativeBlock({ content }: NarrativeBlockProps) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
      <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {content}
      </p>
    </div>
  );
}
