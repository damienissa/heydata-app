"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { useConversation } from "@/hooks/useConversation";

export default function Home() {
  const {
    conversations,
    activeConversation,
    activeMessages,
    isLoading,
    error,
    setActiveConversation,
    createNewConversation,
    sendMessage,
    clearError,
  } = useConversation();

  return (
    <AppShell
      conversations={conversations}
      activeConversationId={activeConversation?.id}
      onSelectConversation={setActiveConversation}
      onNewChat={createNewConversation}
    >
      <div className="flex flex-1 flex-col bg-white dark:bg-neutral-950">
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onDismiss={clearError} />
          </div>
        )}
        <ConversationThread messages={activeMessages} isLoading={isLoading} />
        <ChatInput onSubmit={sendMessage} disabled={isLoading} />
      </div>
    </AppShell>
  );
}
