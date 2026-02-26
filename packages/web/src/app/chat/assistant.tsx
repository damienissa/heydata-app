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
import type { UIMessage } from "ai";

/**
 * Assistant — data-fetching shell.
 * Loads session history and shows a loading state until ready,
 * then mounts <ChatRuntime> which owns the useChatRuntime hook.
 */
export const Assistant = () => {
  const { mountId } = useChatContext();

  const isMountedSession = mountId !== "new";
  const { session, isLoading } = useSessionWithMessages(
    isMountedSession ? mountId : undefined,
  );

  // Still loading an existing session — show placeholder
  if (isMountedSession && (isLoading || !session)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading conversation...</p>
      </div>
    );
  }

  // Compute messages once, pass as prop to the runtime component
  const messages =
    isMountedSession && session?.messages?.length
      ? session.messages.map(dbMessageToUIMessage)
      : undefined;

  // Key ensures ChatRuntime fully remounts (fresh hook state) on session switch.
  // For a new chat the key is "new"; for an existing session it's the session id.
  return <ChatRuntime key={mountId} initialMessages={messages} />;
};

/**
 * ChatRuntime — owns useChatRuntime.
 * Mounts only when initial data is ready, so the runtime hook
 * initialises exactly once with the correct messages.
 */
function ChatRuntime({
  initialMessages,
}: {
  initialMessages: UIMessage[] | undefined;
}) {
  const { getContext, mountId, onSessionCreate } = useChatContext();
  const sendingRef = useRef(false);
  const isMountedSession = mountId !== "new";

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async (options) => {
          if (sendingRef.current) {
            throw new Error("Message already in flight");
          }
          sendingRef.current = true;

          try {
            const { sessionId: ctxSessionId, connectionId } = getContext();

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
    messages: initialMessages,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
