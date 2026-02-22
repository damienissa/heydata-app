"use client";

import { useCallback, useEffect, useState } from "react";

export interface Connection {
  id: string;
  name: string;
  db_type: string;
  ssl_enabled: boolean | null;
  status: string | null;
  last_tested_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetch("/api/connections")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: Connection[]) => setConnections(Array.isArray(data) ? data : []))
      .catch(() => setConnections([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteConnection = useCallback(async (id: string) => {
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? res.statusText);
    }
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { connections, isLoading, refetch, deleteConnection };
}
