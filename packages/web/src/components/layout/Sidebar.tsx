"use client";

import { MessageSquarePlus, MessageSquare } from "lucide-react";

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
    <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet
          </p>
        ) : (
          <nav>
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelect(conv.id)}
                    className={`group flex w-full items-center gap-2 truncate rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                      activeId === conv.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}
