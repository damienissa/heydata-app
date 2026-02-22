"use client";

import { useEffect, useState } from "react";

export interface Session {
  id: string;
  title: string;
  connection_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useSessions(connectionId?: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = connectionId
      ? `/api/sessions?connectionId=${encodeURIComponent(connectionId)}`
      : "/api/sessions";
    setIsLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: Session[]) => {
        if (!cancelled) setSessions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  const createSession = async (opts: {
    title?: string;
    connectionId?: string | null;
  }) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) return null;
    const session = (await res.json()) as Session;
    setSessions((prev) => [session, ...prev]);
    return session;
  };

  const deleteSession = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const refetch = () => {
    const url = connectionId
      ? `/api/sessions?connectionId=${encodeURIComponent(connectionId)}`
      : "/api/sessions";
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data: Session[]) => setSessions(Array.isArray(data) ? data : []))
      .finally(() => setIsLoading(false));
  };

  return {
    sessions,
    isLoading,
    createSession,
    deleteSession,
    refetch,
  };
}
