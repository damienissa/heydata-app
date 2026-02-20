"use client";

import { useState, useCallback } from "react";
import type { OrchestratorResponse } from "@heydata/shared";

export interface UseQueryState {
  response: OrchestratorResponse | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseQueryReturn extends UseQueryState {
  query: (question: string, sessionId?: string) => Promise<OrchestratorResponse | null>;
  reset: () => void;
}

/**
 * Hook to execute queries against the heydata orchestrator
 */
export function useQuery(): UseQueryReturn {
  const [state, setState] = useState<UseQueryState>({
    response: null,
    isLoading: false,
    error: null,
  });

  const query = useCallback(async (question: string, sessionId?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Query failed");
      }

      const response = await res.json() as OrchestratorResponse;
      setState({ response, isLoading: false, error: null });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ response: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    query,
    reset,
  };
}
