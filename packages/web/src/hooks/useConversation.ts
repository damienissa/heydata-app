"use client";

import { useConversationContext } from "@/context/ConversationContext";

export function useConversation() {
  const {
    state,
    setActiveConversation,
    createNewConversation,
    sendMessage,
    clearError,
  } = useConversationContext();

  const activeConversation = state.conversations.find(
    (conv) => conv.id === state.activeConversationId
  );

  return {
    conversations: state.conversations,
    activeConversation,
    activeMessages: activeConversation?.messages ?? [],
    isLoading: state.isLoading,
    error: state.error,
    setActiveConversation,
    createNewConversation,
    sendMessage,
    clearError,
  };
}
