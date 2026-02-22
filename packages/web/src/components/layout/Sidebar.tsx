"use client";

import { MessageSquarePlus, MessageSquare, Trash2Icon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Conversation {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isLoading = false,
}: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
      <div className="p-3">
        <button
          onClick={onNewChat}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-50"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet
          </p>
        ) : (
          <nav>
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <div className="group flex items-center gap-1 rounded-lg hover:bg-accent/50">
                    <button
                      onClick={() => onSelect(conv.id)}
                      className={`flex flex-1 min-w-0 items-center gap-2 truncate rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                        activeId === conv.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                      <span className="truncate">{conv.title}</span>
                    </button>
                    {onDelete && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(conv.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}
