"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useMemo, useRef } from "react";
import { Thread } from "@/components/assistant-ui/thread";
import { useChatContext } from "@/contexts/chat-context";
import { useSessionWithMessages } from "@/hooks/use-session-with-messages";
import { dbMessageToUIMessage } from "@/lib/db-message-to-ui-message";

export const Assistant = () => {
  const { getContext, mountId, onSessionCreate } = useChatContext();

  // Guard against concurrent sends (e.g. double-click, Enter key race)
  const sendingRef = useRef(false);

  // Load historical messages only when a specific session is explicitly mounted.
  // mountId === "new" means we are in a fresh (unsaved) conversation.
  const isMountedSession = mountId !== "new";
  const { session, isLoading } = useSessionWithMessages(
    isMountedSession ? mountId : undefined,
  );

  const initialMessages = useMemo(() => {
    if (!isMountedSession) return undefined;
    if (!session?.messages?.length) return [];
    return session.messages.map(dbMessageToUIMessage);
  }, [isMountedSession, session?.messages]);

  // Memoize transport to avoid re-creation on every render.
  // getContext is stable (useCallback), onSessionCreate changes only on connection switch.
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async (options) => {
          // Prevent concurrent sends
          if (sendingRef.current) {
            throw new Error("Message already in flight");
          }
          sendingRef.current = true;

          try {
            const { sessionId: ctxSessionId, connectionId } = getContext();

            // Auto-create a session on the very first message if none exists yet.
            let effectiveSessionId = ctxSessionId;
            if (!effectiveSessionId && onSessionCreate) {
              effectiveSessionId = await onSessionCreate();
            }

            const body = {
              ...options.body,
              messages: options.messages,
              ...(effectiveSessionId && { sessionId: effectiveSessionId }),
              ...(connectionId && { connectionId }),
            };
            return { ...options, body };
          } finally {
            // Reset after a short delay to allow the stream to start
            setTimeout(() => {
              sendingRef.current = false;
            }, 2000);
          }
        },
      }),
    [getContext, onSessionCreate],
  );

  const runtime = useChatRuntime({
    id: isMountedSession ? mountId : undefined,
    messages: isMountedSession ? initialMessages : undefined,
    transport,
  });

  // Key changes only when an explicit session switch happens (or loading finishes).
  // Auto-creating a session does NOT change mountId, so the runtime never remounts
  // mid-conversation.
  const mountKey = isMountedSession
    ? `${mountId}-${isLoading ? "loading" : "loaded"}`
    : "new";

  if (isMountedSession && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading conversation...</p>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider key={mountKey} runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
