"use client";

import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface Conversation {
  id: string;
  title: string;
}

interface AppShellProps {
  children: ReactNode;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export function AppShell({
  children,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNewChat={onNewChat}
        />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
