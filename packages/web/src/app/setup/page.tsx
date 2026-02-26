"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectionForm, type ConnectionFormData } from "@/components/setup/ConnectionForm";
import {
  SchemaPreview,
  type IntrospectedSchema,
} from "@/components/setup/SchemaPreview";
import { SemanticPreview } from "@/components/setup/SemanticPreview";
import {
  CheckIcon,
  DatabaseIcon,
  SparklesIcon,
  TableIcon,
  LoaderIcon,
  CircleDotIcon,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Connect", icon: DatabaseIcon },
  { id: 2, title: "Introspect", icon: TableIcon },
  { id: 3, title: "Generate", icon: SparklesIcon },
  { id: 4, title: "Done", icon: CheckIcon },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type ProgressStep = "connecting" | "introspecting" | "generating" | "saving" | "commands";

const PROGRESS_STEPS: { id: ProgressStep; label: string }[] = [
  { id: "connecting", label: "Connecting to database" },
  { id: "introspecting", label: "Reading schema" },
  { id: "generating", label: "Generating semantic layer" },
  { id: "saving", label: "Saving" },
  { id: "commands", label: "Generating commands" },
];

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

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState<string>("");
  const [schema, setSchema] = useState<IntrospectedSchema | null>(null);
  const [semanticMarkdown, setSemanticMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null);

  const handleConnect = async (data: ConnectionFormData) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          dbType: "postgresql",
          connectionString: data.connectionString,
          sslEnabled: data.sslEnabled,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const conn = await res.json();
      setConnectionId(conn.id);
      setConnectionName(conn.name);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleIntrospect = async () => {
    if (!connectionId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/introspect`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? res.statusText);
      }
      const data = await res.json();
      setSchema(data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!connectionId) return;
    setError(null);
    setLoading(true);
    setProgressStep("connecting");
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
            setProgressStep(d.step as ProgressStep);
          } else if (event === "complete") {
            setSemanticMarkdown((d.semantic_md as string) ?? "");
            setProgressStep("commands");
            await fetch(`/api/connections/${connectionId}/commands/generate`, {
              method: "POST",
            }).catch(() => {});
            setStep(4);
          } else if (event === "error") {
            throw new Error((d.message as string) ?? "Generation failed.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  };

  const handleDone = () => {
    router.push("/chat");
    router.refresh();
  };

  const stepState = (stepId: ProgressStep): "done" | "active" | "pending" => {
    if (!progressStep) return "pending";
    const currentIdx = PROGRESS_STEPS.findIndex((s) => s.id === progressStep);
    const thisIdx = PROGRESS_STEPS.findIndex((s) => s.id === stepId);
    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8">
      <Link
        href="/chat"
        className="absolute top-4 left-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to chat
      </Link>
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your data connection
          </h1>
          <p className="mt-1 text-muted-foreground">
            4 steps to connect, introspect, and generate your semantic layer
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  step >= s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-8 ${
                    step > s.id ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {step === 1 && (
            <div>
              <h2 className="mb-4 text-lg font-medium">Connect to your database</h2>
              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}
              <ConnectionForm onSubmit={handleConnect} />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-4 text-lg font-medium">Introspect schema</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Discover tables and columns in {connectionName}
              </p>
              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}
              <Button onClick={handleIntrospect} disabled={loading}>
                {loading ? "Introspecting…" : "Introspect schema"}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-4 text-lg font-medium">Generate semantic layer</h2>
              {schema && !loading && (
                <div className="mb-4">
                  <SchemaPreview schema={schema} />
                </div>
              )}
              {loading && progressStep ? (
                <div className="flex flex-col gap-3 py-2">
                  {PROGRESS_STEPS.map((s) => {
                    const state = stepState(s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2.5">
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
                          className={`text-xs ${
                            state === "done"
                              ? "text-muted-foreground line-through"
                              : state === "active"
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    AI will analyze the schema and generate metrics, dimensions, and
                    entity relationships.
                  </p>
                  {error && (
                    <p className="mb-4 text-sm text-destructive">{error}</p>
                  )}
                  <Button onClick={handleGenerate} disabled={loading}>
                    Generate semantic layer
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-4 text-lg font-medium">All set!</h2>
              {semanticMarkdown && (
                <div className="mb-6">
                  <SemanticPreview semanticMarkdown={semanticMarkdown} />
                </div>
              )}
              <p className="mb-6 text-sm text-muted-foreground">
                Your connection is ready. Start asking questions about your data.
              </p>
              <Button onClick={handleDone}>Go to chat</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
