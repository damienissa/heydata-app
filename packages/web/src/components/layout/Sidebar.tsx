"use client";

interface Conversation {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New Chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                onClick={() => onSelect(conv.id)}
                className={`w-full truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeId === conv.id
                    ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {conv.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
