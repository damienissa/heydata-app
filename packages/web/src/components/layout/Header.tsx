"use client";

import Link from "next/link";
import { useState } from "react";
import type { Connection } from "@/hooks/use-connections";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react";

interface HeaderProps {
  connections?: Connection[];
  selectedConnectionId?: string;
  onSelectConnection?: (id: string | undefined) => void;
  onDeleteConnection?: (id: string) => Promise<void>;
}

export function Header({
  connections = [],
  selectedConnectionId,
  onSelectConnection,
  onDeleteConnection,
}: HeaderProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDeleteConnection) return;
    setDeletingId(id);
    try {
      await onDeleteConnection(id);
      if (selectedConnectionId === id) {
        onSelectConnection?.(undefined);
      }
    } finally {
      setDeletingId(null);
      if (connections.length <= 1) {
        setManageOpen(false);
      }
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">heydata</span>
      </div>
      <div className="flex items-center gap-2">
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
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setManageOpen(true)}
          aria-label="Manage connections"
        >
          <Settings2Icon className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage connections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {connections.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No connections yet. Add one to get started.
                </p>
              ) : (
                connections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <Link href="/setup" onClick={() => setManageOpen(false)}>
              <Button variant="outline" className="w-full">
                <PlusIcon className="mr-2 h-4 w-4" />
                Add new connection
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
