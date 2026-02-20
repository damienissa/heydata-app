"use client";

import { ResultsCanvas } from "@/components/canvas/ResultsCanvas";
import { ChatInput } from "@/components/chat/ChatInput";
import {
  ConversationThread,
  type Message,
} from "@/components/chat/ConversationThread";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { RetryButton } from "@/components/feedback/RetryButton";
import { ConversationProvider } from "@/context/ConversationContext";
import { useConversation } from "@/hooks/useConversation";

function ChatPageContent() {
  const {
    messages,
    loading,
    error,
    result,
    sendMessage,
    retry,
    clearError,
  } = useConversation();

  const threadMessages: Message[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
      <div className="flex min-h-0 w-full flex-col overflow-hidden lg:max-w-md">
        {error && (
          <div className="flex flex-wrap items-center gap-2">
            <ErrorBanner
              message={error}
              onDismiss={clearError}
              dismissible={true}
            />
            <RetryButton onRetry={retry} />
          </div>
        )}
        <ConversationThread messages={threadMessages} isLoading={loading} />
        <ChatInput onSubmit={sendMessage} disabled={loading} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ResultsCanvas
          narrative={result?.narrative ?? null}
          visualizationSpec={result?.visualizationSpec ?? null}
          sql={result?.sql ?? null}
          isLoading={loading}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ConversationProvider>
      <ChatPageContent />
    </ConversationProvider>
  );
}
