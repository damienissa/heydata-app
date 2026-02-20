"use client";

import { useCallback, useState } from "react";

interface SqlViewerProps {
  sql: string;
  defaultOpen?: boolean;
}

export function SqlViewer({ sql, defaultOpen = false }: SqlViewerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        <span>Generated SQL</span>
        <span aria-hidden>{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="relative border-t border-zinc-200 dark:border-zinc-700">
          <pre className="overflow-x-auto bg-zinc-900 p-3 text-xs text-zinc-100">
            <code>{sql}</code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded bg-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-600"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
