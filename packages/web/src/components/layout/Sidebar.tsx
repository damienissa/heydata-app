"use client";

export function Sidebar() {
  return (
    <aside
      className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <span aria-hidden>+</span>
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          No conversations yet
        </p>
      </div>
    </aside>
  );
}
