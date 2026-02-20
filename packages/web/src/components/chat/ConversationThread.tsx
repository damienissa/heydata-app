"use client";

import { MessageBubble, type MessageRole } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface ConversationThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ConversationThread({
  messages,
  isLoading = false,
}: ConversationThreadProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.length === 0 && !isLoading && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Start a conversation by typing a question below.
        </p>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  );
}
