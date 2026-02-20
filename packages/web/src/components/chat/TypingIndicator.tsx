"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start" data-role="assistant">
      <div className="flex gap-1 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
