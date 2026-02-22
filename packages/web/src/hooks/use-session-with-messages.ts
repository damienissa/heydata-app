"use client";

import { useEffect, useState } from "react";

export interface DbMessage {
  id: string;
  role: string;
  content: string;
  tool_results: unknown;
  created_at: string | null;
}

export interface SessionWithMessages {
  id: string;
  title: string;
  connection_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  messages: DbMessage[];
}

/**
 * Fetches a session with its messages from the API.
 * Used to load chat history when switching sessions.
 */
export function useSessionWithMessages(sessionId: string | undefined) {
  const [data, setData] = useState<SessionWithMessages | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((session: SessionWithMessages) => {
        if (!cancelled) setData(session);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { session: data, isLoading, error };
}
