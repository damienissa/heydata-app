"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useMemo } from "react";
import { Thread } from "@/components/assistant-ui/thread";
import { useChatContext } from "@/contexts/chat-context";
import { useSessionWithMessages } from "@/hooks/use-session-with-messages";
import { dbMessageToUIMessage } from "@/lib/db-message-to-ui-message";

export const Assistant = () => {
  const { getContext, sessionId } = useChatContext();
  const { session, isLoading } = useSessionWithMessages(sessionId);

  const initialMessages = useMemo(() => {
    if (!sessionId) return undefined;
    if (!session?.messages?.length) return [];
    return session.messages.map(dbMessageToUIMessage);
  }, [sessionId, session?.messages]);

  const runtime = useChatRuntime({
    id: sessionId ?? undefined,
    messages: sessionId ? initialMessages : undefined,
    transport: new AssistantChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async (options) => {
        const { sessionId: ctxSessionId, connectionId } = getContext();
        const body = {
          ...options.body,
          messages: options.messages,
          ...(ctxSessionId && { sessionId: ctxSessionId }),
          ...(connectionId && { connectionId }),
        };
        return { ...options, body };
      },
    }),
  });

  const mountKey =
    sessionId
      ? `${sessionId}-${isLoading ? "loading" : "loaded"}`
      : "new";

  if (sessionId && isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading conversation...</p>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider key={mountKey} runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
