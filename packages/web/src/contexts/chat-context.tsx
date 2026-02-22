"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export interface ChatContextValue {
  sessionId: string | undefined;
  connectionId: string | undefined;
  /** Ref used by transport to read current values at request time */
  getContext: () => { sessionId?: string; connectionId?: string };
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  sessionId,
  connectionId,
}: {
  children: ReactNode;
  sessionId?: string;
  connectionId?: string;
}) {
  const ref = useRef<{ sessionId?: string; connectionId?: string }>({});

  useEffect(() => {
    ref.current = { sessionId, connectionId };
  }, [sessionId, connectionId]);

  const getContext = useCallback(() => ({ ...ref.current }), []);

  const value = useMemo<ChatContextValue>(
    () => ({ sessionId, connectionId, getContext }),
    [sessionId, connectionId, getContext],
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    return {
      sessionId: undefined,
      connectionId: undefined,
      getContext: () => ({}),
    };
  }
  return ctx;
}
