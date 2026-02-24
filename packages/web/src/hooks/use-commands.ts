"use client";

import { useEffect, useState } from "react";

export interface Command {
  id: string;
  slashCommand: string;
  description: string;
  prompt: string;
  sortOrder: number;
}

export function useCommands(connectionId: string | undefined) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!connectionId) {
      setCommands([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/connections/${connectionId}/commands`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; slash_command: string; description: string; prompt: string; sort_order: number }>) => {
        if (cancelled) return;
        setCommands(
          data.map((c) => ({
            id: c.id,
            slashCommand: c.slash_command,
            description: c.description,
            prompt: c.prompt,
            sortOrder: c.sort_order,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCommands([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  return { commands, isLoading };
}
