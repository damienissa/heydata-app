"use client";

import { Assistant } from "./assistant";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/contexts/chat-context";
import { useConnections } from "@/hooks/use-connections";
import { useSessions } from "@/hooks/use-sessions";
import { useState } from "react";

export default function Home() {
  const [connectionId, setConnectionId] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();

  const { connections, isLoading: connectionsLoading } = useConnections();
  const {
    sessions,
    isLoading: sessionsLoading,
    createSession,
    deleteSession,
    refetch,
  } = useSessions(connectionId ?? undefined);

  const handleNewChat = async () => {
    const session = await createSession({
      title: "New Chat",
      connectionId: connectionId ?? null,
    });
    if (session) {
      setSessionId(session.id);
    }
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    if (sessionId === id) {
      setSessionId(undefined);
    }
  };

  const conversations = sessions.map((s) => ({
    id: s.id,
    title: s.title,
  }));

  return (
    <ChatProvider sessionId={sessionId} connectionId={connectionId}>
      <div className="flex h-dvh flex-col bg-background">
        <Header connections={connections} selectedConnectionId={connectionId} onSelectConnection={setConnectionId} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            conversations={conversations}
            activeId={sessionId}
            onSelect={handleSelectSession}
            onNewChat={handleNewChat}
            onDelete={handleDeleteSession}
            isLoading={sessionsLoading}
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            <Assistant />
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
