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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Progress types ────────────────────────────────────────────────────────────

type RegenerationStep = "connecting" | "introspecting" | "generating" | "saving";

const REGENERATION_STEPS: { id: RegenerationStep; label: string }[] = [
  { id: "connecting", label: "Connecting to database" },
  { id: "introspecting", label: "Reading schema" },
  { id: "generating", label: "Generating semantic layer" },
  { id: "saving", label: "Saving" },
];

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

// ── SSE event parsing ─────────────────────────────────────────────────────────

function parseSseChunk(
  chunk: string,
): Array<{ event: string; data: unknown }> {
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

// ── Page component ────────────────────────────────────────────────────────────

export default function SemanticEditorPage() {
  const { id: connectionId } = useParams<{ id: string }>();

  const [markdown, setMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<RegenerationStep | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDirty = markdown !== savedMarkdown;

  // Load current semantic layer
  const load = useCallback(async () => {
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

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
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

      // Pre-stream errors (e.g. 401)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? res.statusText,
        );
      }

      if (!res.body) throw new Error("No response body from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Process complete SSE messages (end with double newline)
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

  // Step state helper
  const stepState = (stepId: RegenerationStep): "done" | "active" | "pending" => {
    if (!progressStep) return "pending";
    const currentIdx = REGENERATION_STEPS.findIndex((s) => s.id === progressStep);
    const thisIdx = REGENERATION_STEPS.findIndex((s) => s.id === stepId);
    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to chat
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-sm font-medium">Semantic Layer Editor</h1>
          {isDirty && !regenerating && (
            <span className="text-xs text-muted-foreground italic">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={regenerating || saving}
          >
            <RefreshCwIcon
              className={cn(
                "mr-1.5 h-3.5 w-3.5",
                regenerating && "animate-spin",
              )}
            />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving || regenerating}
          >
            <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : regenerating ? (
        /* ── Regeneration progress panel ── */
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-64 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-foreground">
              Regenerating semantic layer
            </p>
            <div className="flex flex-col gap-3">
              {REGENERATION_STEPS.map((s) => (
                <ProgressStep
                  key={s.id}
                  label={s.label}
                  state={stepState(s.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Split editor ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left — raw Markdown editor */}
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

          {/* Right — rendered preview */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Preview
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate semantic layer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will re-introspect your database schema and overwrite the
            current semantic layer with a new AI-generated document. Any manual
            edits will be lost.
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
