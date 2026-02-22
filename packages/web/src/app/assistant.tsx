"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { useChatContext } from "@/contexts/chat-context";

export const Assistant = () => {
  const { getContext } = useChatContext();

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async (options) => {
        const { sessionId, connectionId } = getContext();
        const body = {
          ...options.body,
          ...(sessionId && { sessionId }),
          ...(connectionId && { connectionId }),
        };
        return { ...options, body };
      },
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
