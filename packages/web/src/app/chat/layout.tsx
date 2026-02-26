"use client";

import { Assistant } from "./assistant";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/contexts/chat-context";
import { useConnections } from "@/hooks/use-connections";
import { useSessions } from "@/hooks/use-sessions";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Extract session ID from /chat/[id] pathname, or undefined for /chat */
function getSessionIdFromPathname(pathname: string): string | undefined {
  if (!pathname.startsWith("/chat/")) return undefined;
  const segment = pathname.slice("/chat/".length).split("/")[0];
  return segment ? decodeURIComponent(segment) : undefined;
}

export default function ChatLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Initialize sessionId + mountId from URL immediately so history loads
  // on the very first render (no waiting for async data).
  const idFromUrl = getSessionIdFromPathname(pathname);
  const [connectionId, setConnectionId] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>(idFromUrl);
  /**
   * mountId drives which runtime instance is mounted in <Assistant>.
   * It only changes on explicit session switches / explicit new-chat creation,
   * NOT when a session is auto-created on the first message (so the in-flight
   * conversation is never disrupted).
   */
  const [mountId, setMountId] = useState<string>(idFromUrl ?? "new");

  const {
    connections,
    isLoading: connectionsLoading,
    deleteConnection,
  } = useConnections();

  // Landing logic: no connections → /setup
  useEffect(() => {
    if (connectionsLoading) return;
    if (connections.length === 0) {
      router.replace("/setup");
    }
  }, [connectionsLoading, connections.length, router]);

  // Auto-select first connection when connections load
  useEffect(() => {
    if (!connectionsLoading && connections.length > 0 && !connectionId) {
      setConnectionId(connections[0]!.id);
    }
  }, [connections, connectionsLoading, connectionId]);

  const {
    sessions,
    isLoading: sessionsLoading,
    createSession,
    deleteSession,
    refetch: refetchSessions,
  } = useSessions(connectionId ?? undefined);

  // Derive connectionId from loaded session when visiting /chat/[id] directly
  useEffect(() => {
    if (!sessionId || !sessions.length) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.connection_id && session.connection_id !== connectionId) {
      setConnectionId(session.connection_id);
    }
  }, [sessionId, sessions, connectionId]);

  // Auto-select most recent session when landing on /chat with no ID in the URL
  useEffect(() => {
    if (sessionsLoading || sessionId || sessions.length === 0) return;
    const id = sessions[0]!.id;
    setSessionId(id);
    setMountId(id);
    window.history.replaceState(null, "", `/chat/${id}`);
  }, [sessions, sessionsLoading, sessionId]);

  const handleNewChat = () => {
    setSessionId(undefined);
    setMountId("new");
    router.replace("/chat");
  };

  /**
   * Auto-create a session when the user sends their very first message.
   * Updates sessionId for future message persistence but does NOT change
   * mountId, so the running runtime is never remounted.
   * Updates the URL silently via replaceState (no Next.js navigation).
   */
  const handleAutoCreateSession = useCallback(
    async (): Promise<string | undefined> => {
      const session = await createSession({
        title: "New Chat",
        connectionId: connectionId ?? null,
      });
      if (session) {
        setSessionId(session.id);
        // intentionally NOT updating mountId — keeps the conversation alive
        // Update URL silently without triggering navigation
        window.history.replaceState(null, "", `/chat/${session.id}`);
        // Refetch after a delay to pick up auto-generated title from the server
        setTimeout(() => refetchSessions(), 4000);
        return session.id;
      }
      return undefined;
    },
    [createSession, connectionId, refetchSessions],
  );

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    setMountId(id); // explicit switch → remount to load history
    const session = sessions.find((s) => s.id === id);
    if (session?.connection_id) {
      setConnectionId(session.connection_id);
    }
    router.replace(`/chat/${id}`, { scroll: false });
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    if (sessionId === id) {
      setSessionId(undefined);
      setMountId("new");
      router.replace("/chat");
    }
  };

  const conversations = sessions.map((s) => ({
    id: s.id,
    title: s.title,
  }));

  // Show nothing while redirecting to setup (avoids flash of chat UI)
  if (!connectionsLoading && connections.length === 0) {
    return null;
  }

  return (
    <ChatProvider
      sessionId={sessionId}
      connectionId={connectionId}
      mountId={mountId}
      onSessionCreate={handleAutoCreateSession}
    >
      <div className="flex h-dvh flex-col bg-background">
        {children}
        <Header
          connections={connections}
          selectedConnectionId={connectionId}
          onSelectConnection={setConnectionId}
          onDeleteConnection={deleteConnection}
        />
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
