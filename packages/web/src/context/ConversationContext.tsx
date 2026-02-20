"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

type ConversationAction =
  | { type: "SET_ACTIVE"; conversationId: string }
  | { type: "NEW_CONVERSATION"; conversation: Conversation }
  | { type: "ADD_MESSAGE"; conversationId: string; message: Message }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_ERROR" };

function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case "SET_ACTIVE":
      return { ...state, activeConversationId: action.conversationId };

    case "NEW_CONVERSATION":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
        activeConversationId: action.conversation.id,
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.conversationId
            ? {
                ...conv,
                messages: [...conv.messages, action.message],
                title:
                  conv.messages.length === 0 && action.message.role === "user"
                    ? action.message.content.slice(0, 40) +
                      (action.message.content.length > 40 ? "..." : "")
                    : conv.title,
              }
            : conv
        ),
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    default:
      return state;
  }
}

interface ConversationContextValue {
  state: ConversationState;
  setActiveConversation: (id: string) => void;
  createNewConversation: () => string;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

const initialState: ConversationState = {
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  error: null,
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  const setActiveConversation = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE", conversationId: id });
  }, []);

  const createNewConversation = useCallback((): string => {
    const newConversation: Conversation = {
      id: generateId(),
      title: "New conversation",
      messages: [],
    };
    dispatch({ type: "NEW_CONVERSATION", conversation: newConversation });
    return newConversation.id;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      let conversationId = state.activeConversationId;

      if (!conversationId) {
        const newConversation: Conversation = {
          id: generateId(),
          title: "New conversation",
          messages: [],
        };
        dispatch({ type: "NEW_CONVERSATION", conversation: newConversation });
        conversationId = newConversation.id;
      }

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
      };

      dispatch({
        type: "ADD_MESSAGE",
        conversationId,
        message: userMessage,
      });

      dispatch({ type: "SET_LOADING", isLoading: true });

      try {
        // TODO: Replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: `This is a mock response to: "${content}"`,
        };

        dispatch({
          type: "ADD_MESSAGE",
          conversationId,
          message: assistantMessage,
        });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "An error occurred",
        });
      } finally {
        dispatch({ type: "SET_LOADING", isLoading: false });
      }
    },
    [state.activeConversationId]
  );

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        state,
        setActiveConversation,
        createNewConversation,
        sendMessage,
        clearError,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversationContext(): ConversationContextValue {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversationContext must be used within a ConversationProvider"
    );
  }
  return context;
}
