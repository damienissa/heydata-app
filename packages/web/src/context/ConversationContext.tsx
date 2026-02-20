"use client";

import type { VisualizationSpec } from "@heydata/shared";
import {
  createContext,
  useCallback,
  useReducer,
  type ReactNode,
} from "react";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ConversationResult {
  sql?: string;
  visualizationSpec?: VisualizationSpec;
  narrative?: string;
}

interface ConversationState {
  messages: ConversationMessage[];
  loading: boolean;
  error: string | null;
  result: ConversationResult | null;
}

type Action =
  | { type: "add_message"; payload: ConversationMessage }
  | { type: "set_loading"; payload: boolean }
  | { type: "set_error"; payload: string | null }
  | { type: "set_result"; payload: ConversationResult | null }
  | { type: "clear_error" }
  | { type: "clear" };

function nextId() {
  return Math.random().toString(36).slice(2, 11);
}

function reducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case "add_message":
      return { ...state, messages: [...state.messages, action.payload] };
    case "set_loading":
      return { ...state, loading: action.payload };
    case "set_error":
      return { ...state, error: action.payload };
    case "set_result":
      return { ...state, result: action.payload };
    case "clear_error":
      return { ...state, error: null };
    case "clear":
      return {
        messages: [],
        loading: false,
        error: null,
        result: null,
      };
    default:
      return state;
  }
}

const initialState: ConversationState = {
  messages: [],
  loading: false,
  error: null,
  result: null,
};

export interface ConversationContextValue extends ConversationState {
  sendMessage: (content: string) => void;
  retry: () => void;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const sendMessage = useCallback((content: string) => {
    dispatch({
      type: "add_message",
      payload: { id: nextId(), role: "user", content },
    });
    dispatch({ type: "set_loading", payload: true });
    dispatch({ type: "set_error", payload: null });
    // Mock: no API yet; simulate response
    setTimeout(() => {
      dispatch({
        type: "add_message",
        payload: {
          id: nextId(),
          role: "assistant",
          content:
            "This is a mock reply. The agent pipeline will be wired in Phase 8.",
        },
      });
      dispatch({ type: "set_loading", payload: false });
      dispatch({ type: "set_result", payload: null });
    }, 800);
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "clear_error" });
    // Caller can re-trigger last action; for now just clear error
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "clear_error" });
  }, []);

  const value: ConversationContextValue = {
    ...state,
    sendMessage,
    retry,
    clearError,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export { ConversationContext };
