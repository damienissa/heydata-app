"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCwIcon,
  SaveIcon,
  CheckIcon,
  LoaderIcon,
  CircleDotIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "semantic" | "commands";

type RegenerationStep =
  | "connecting"
  | "introspecting"
  | "generating"
  | "saving"
  | "commands";

const REGENERATION_STEPS: { id: RegenerationStep; label: string }[] = [
  { id: "connecting", label: "Connecting to database" },
  { id: "introspecting", label: "Reading schema" },
  { id: "generating", label: "Generating semantic layer" },
  { id: "saving", label: "Saving" },
  { id: "commands", label: "Generating commands" },
];

type CommandRow = {
  _key: string;
  slashCommand: string;
  description: string;
  prompt: string;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-2.5">
      {state === "done" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckIcon className="size-2.5" />
        </div>
      )}
      {state === "active" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <LoaderIcon className="size-2.5 animate-spin" />
        </div>
      )}
      {state === "pending" && (
        <div className="flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
          <CircleDotIcon className="size-2.5" />
        </div>
      )}
      <span
        className={cn(
          "text-xs",
          state === "done" && "text-muted-foreground line-through",
          state === "active" && "font-medium text-foreground",
          state === "pending" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── SSE parsing ───────────────────────────────────────────────────────────────

function parseSseChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const results: Array<{ event: string; data: unknown }> = [];
  const lines = chunk.split("\n");
  let eventName = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventName = line.slice(7).trim();
    } else if (line.startsWith("data: ") && eventName) {
      try {
        results.push({ event: eventName, data: JSON.parse(line.slice(6)) });
      } catch {
        // ignore malformed data lines
      }
      eventName = "";
    }
  }
  return results;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SemanticEditorPage() {
  const { id: connectionId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("semantic");

  // Semantic layer state
  const [markdown, setMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<RegenerationStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isSemanticDirty = markdown !== savedMarkdown;

  // Commands state
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [savedCommands, setSavedCommands] = useState<CommandRow[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(true);
  const [commandsSaving, setCommandsSaving] = useState(false);
  const [commandsError, setCommandsError] = useState<string | null>(null);

  const isCommandsDirty =
    JSON.stringify(commands) !== JSON.stringify(savedCommands);

  // Load semantic layer
  const loadSemantic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/semantic`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const data = await res.json();
      const md = data.semantic_md ?? "";
      setMarkdown(md);
      setSavedMarkdown(md);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  // Load commands
  const loadCommands = useCallback(async () => {
    setCommandsLoading(true);
    setCommandsError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/commands`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const data: Array<{
        id: string;
        slash_command: string;
        description: string;
        prompt: string;
      }> = await res.json();
      const rows = data.map((c) => ({
        _key: c.id,
        slashCommand: c.slash_command,
        description: c.description,
        prompt: c.prompt,
      }));
      setCommands(rows);
      setSavedCommands(rows);
    } catch (err) {
      setCommandsError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommandsLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadSemantic();
    loadCommands();
  }, [loadSemantic, loadCommands]);

  // Save semantic layer
  const handleSaveSemantic = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/semantic`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semantic_md: markdown }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const data = await res.json();
      const md = data.semantic_md ?? markdown;
      setMarkdown(md);
      setSavedMarkdown(md);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // Save commands
  const handleSaveCommands = async () => {
    setCommandsSaving(true);
    setCommandsError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/commands`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: commands.map((c) => ({
            slashCommand: c.slashCommand,
            description: c.description,
            prompt: c.prompt,
          })),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const data: Array<{
        id: string;
        slash_command: string;
        description: string;
        prompt: string;
      }> = await res.json();
      const rows = data.map((c) => ({
        _key: c.id,
        slashCommand: c.slash_command,
        description: c.description,
        prompt: c.prompt,
      }));
      setCommands(rows);
      setSavedCommands(rows);
    } catch (err) {
      setCommandsError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommandsSaving(false);
    }
  };

  // Regenerate
  const handleRegenerate = async () => {
    setConfirmOpen(false);
    setRegenerating(true);
    setProgressStep("connecting");
    setError(null);

    try {
      const res = await fetch(
        `/api/connections/${connectionId}/semantic/generate`,
        { method: "POST" },
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? res.statusText);
      }

      if (!res.body) throw new Error("No response body from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const boundary = buffer.lastIndexOf("\n\n");
        if (boundary === -1) continue;

        const toProcess = buffer.slice(0, boundary + 2);
        buffer = buffer.slice(boundary + 2);

        for (const { event, data } of parseSseChunk(toProcess)) {
          const d = data as Record<string, unknown>;
          if (event === "progress") {
            setProgressStep(d.step as RegenerationStep);
          } else if (event === "complete") {
            const md = (d.semantic_md as string) ?? "";
            setMarkdown(md);
            setSavedMarkdown(md);

            setProgressStep("commands");
            try {
              const cmdRes = await fetch(
                `/api/connections/${connectionId}/commands/generate`,
                { method: "POST" },
              );
              if (cmdRes.ok) {
                const cmdData = await cmdRes.json();
                if (Array.isArray(cmdData.commands)) {
                  const newCmds = (
                    cmdData.commands as Array<{
                      slashCommand: string;
                      description: string;
                      prompt: string;
                    }>
                  ).map((c, i) => ({
                    _key: `gen_${i}`,
                    slashCommand: c.slashCommand,
                    description: c.description,
                    prompt: c.prompt,
                  }));
                  setCommands(newCmds);
                  setSavedCommands(newCmds);
                }
              }
            } catch {
              // non-fatal: commands failure should not block semantic regeneration
            }
          } else if (event === "error") {
            throw new Error((d.message as string) ?? "Regeneration failed.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
      setProgressStep(null);
    }
  };

  const stepState = (stepId: RegenerationStep): "done" | "active" | "pending" => {
    if (!progressStep) return "pending";
    const currentIdx = REGENERATION_STEPS.findIndex((s) => s.id === progressStep);
    const thisIdx = REGENERATION_STEPS.findIndex((s) => s.id === stepId);
    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  };

  const addCommand = () => {
    setCommands((prev) => [
      ...prev,
      { _key: `new_${Date.now()}`, slashCommand: "", description: "", prompt: "" },
    ]);
  };

  const updateCommand = (key: string, field: keyof Omit<CommandRow, "_key">, value: string) => {
    setCommands((prev) =>
      prev.map((c) => (c._key === key ? { ...c, [field]: value } : c)),
    );
  };

  const removeCommand = (key: string) => {
    setCommands((prev) => prev.filter((c) => c._key !== key));
  };

  const isBusy = regenerating || saving || commandsSaving;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to chat
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-sm font-medium">Connection Settings</h1>
          {activeTab === "semantic" && isSemanticDirty && !regenerating && (
            <span className="text-xs text-muted-foreground italic">Unsaved changes</span>
          )}
          {activeTab === "commands" && isCommandsDirty && (
            <span className="text-xs text-muted-foreground italic">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "semantic" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isBusy}
              >
                <RefreshCwIcon className={cn("mr-1.5 h-3.5 w-3.5", regenerating && "animate-spin")} />
                {regenerating ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button size="sm" onClick={handleSaveSemantic} disabled={!isSemanticDirty || isBusy}>
                <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
          {activeTab === "commands" && (
            <Button size="sm" onClick={handleSaveCommands} disabled={!isCommandsDirty || isBusy}>
              <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
              {commandsSaving ? "Saving…" : "Save commands"}
            </Button>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex shrink-0 gap-1 border-b border-border px-4">
        {(["semantic", "commands"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm transition-colors",
              activeTab === tab
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "semantic" ? "Semantic Layer" : "Commands"}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {(error || commandsError) && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error ?? commandsError}
        </div>
      )}

      {/* Semantic Layer tab */}
      {activeTab === "semantic" && (
        <>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : regenerating ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex w-64 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-medium text-foreground">Regenerating semantic layer</p>
                <div className="flex flex-col gap-3">
                  {REGENERATION_STEPS.map((s) => (
                    <ProgressStep key={s.id} label={s.label} state={stepState(s.id)} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-1 flex-col border-r border-border">
                <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Markdown
                </div>
                <textarea
                  className="flex-1 resize-none bg-background p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  spellCheck={false}
                  placeholder="Start writing your semantic layer…"
                />
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Preview
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Commands tab */}
      {activeTab === "commands" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {commandsLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl">
                <p className="mb-6 text-sm text-muted-foreground">
                  Slash commands let users type{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/commandName</code>{" "}
                  in the chat to quickly run a preset query. Commands are auto-generated from the
                  semantic layer and can be customised here.
                </p>

                <div className="flex flex-col gap-4">
                  {commands.map((cmd) => (
                    <div key={cmd._key} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">/</span>
                        <input
                          type="text"
                          value={cmd.slashCommand}
                          onChange={(e) => updateCommand(cmd._key, "slashCommand", e.target.value)}
                          placeholder="commandName"
                          className="flex-1 rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          onClick={() => removeCommand(cmd._key)}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete command"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={cmd.description}
                        onChange={(e) => updateCommand(cmd._key, "description", e.target.value)}
                        placeholder="Short description shown in the picker…"
                        className="mb-2 w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        maxLength={80}
                      />
                      <textarea
                        value={cmd.prompt}
                        onChange={(e) => updateCommand(cmd._key, "prompt", e.target.value)}
                        placeholder="Full prompt sent to the chat when this command is selected…"
                        rows={3}
                        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={addCommand}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <PlusIcon className="size-4" />
                  Add command
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Regenerate confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate semantic layer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will re-introspect your database schema and overwrite the current semantic layer
            and commands with newly AI-generated content. Any manual edits will be lost.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRegenerate}>
              Regenerate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
