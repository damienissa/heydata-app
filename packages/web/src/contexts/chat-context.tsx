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
  /** Stable key used to mount/remount the runtime (changes only on explicit session switch). */
  mountId: string;
  /** Ref used by transport to read current values at request time */
  getContext: () => { sessionId?: string; connectionId?: string };
  /** Called by transport when first message is sent without a session — creates and returns a new session ID. */
  onSessionCreate?: () => Promise<string | undefined>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  sessionId,
  connectionId,
  mountId,
  onSessionCreate,
}: {
  children: ReactNode;
  sessionId?: string;
  connectionId?: string;
  mountId: string;
  onSessionCreate?: () => Promise<string | undefined>;
}) {
  const ref = useRef<{ sessionId?: string; connectionId?: string }>({});

  useEffect(() => {
    ref.current = { sessionId, connectionId };
  }, [sessionId, connectionId]);

  const getContext = useCallback(() => ({ ...ref.current }), []);

  const value = useMemo<ChatContextValue>(
    () => ({ sessionId, connectionId, mountId, getContext, onSessionCreate }),
    [sessionId, connectionId, mountId, getContext, onSessionCreate],
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
      mountId: "new",
      getContext: () => ({}),
    };
  }
  return ctx;
}
