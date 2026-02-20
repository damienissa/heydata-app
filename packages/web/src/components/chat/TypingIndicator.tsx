"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
