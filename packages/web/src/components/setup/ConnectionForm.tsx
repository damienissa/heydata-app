"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ConnectionFormData {
  name: string;
  connectionString: string;
  sslEnabled: boolean;
}

interface ConnectionFormProps {
  defaultValues?: Partial<ConnectionFormData>;
  onSubmit: (data: ConnectionFormData) => Promise<void>;
  className?: string;
}

export function ConnectionForm({
  defaultValues,
  onSubmit,
  className,
}: ConnectionFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [connectionString, setConnectionString] = useState(
    defaultValues?.connectionString ?? "",
  );
  const [sslEnabled, setSslEnabled] = useState(
    defaultValues?.sslEnabled ?? true,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ name, connectionString, sslEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div>
        <Label htmlFor="name">Connection name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My database"
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="connectionString">Connection string</Label>
        <Input
          id="connectionString"
          type="password"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          placeholder="postgresql://user:password@host:5432/database"
          required
          className="mt-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Format: postgresql://user:password@host:port/database
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="ssl"
          checked={sslEnabled}
          onCheckedChange={setSslEnabled}
        />
        <Label htmlFor="ssl">Enable SSL</Label>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Testing connection…" : "Test & Save"}
      </Button>
    </form>
  );
}
