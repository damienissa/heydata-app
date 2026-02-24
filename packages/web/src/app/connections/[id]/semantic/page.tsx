"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { RefreshCwIcon, SaveIcon } from "lucide-react";

export default function SemanticEditorPage() {
  const { id: connectionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [markdown, setMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
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
    setError(null);
    try {
      const res = await fetch(
        `/api/connections/${connectionId}/semantic/generate`,
        { method: "POST" },
      );
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
      setRegenerating(false);
    }
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
          {isDirty && (
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
            <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
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

      {/* Split editor */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
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
