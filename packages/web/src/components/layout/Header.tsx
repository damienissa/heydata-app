"use client";

import type { Connection } from "@/hooks/use-connections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeaderProps {
  connections?: Connection[];
  selectedConnectionId?: string;
  onSelectConnection?: (id: string | undefined) => void;
}

export function Header({
  connections = [],
  selectedConnectionId,
  onSelectConnection,
}: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">heydata</span>
      </div>
      {connections.length > 0 && onSelectConnection && (
        <Select
          value={selectedConnectionId ?? "none"}
          onValueChange={(v: string) =>
            onSelectConnection(v === "none" ? undefined : v)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select connection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No connection</SelectItem>
            {connections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </header>
  );
}
