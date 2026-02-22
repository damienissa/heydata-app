"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/connections")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: Connection[]) => {
        if (!cancelled) setConnections(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { connections, isLoading };
}
