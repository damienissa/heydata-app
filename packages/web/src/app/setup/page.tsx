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
import { CheckIcon, DatabaseIcon, SparklesIcon, TableIcon } from "lucide-react";

const STEPS = [
  { id: 1, title: "Connect", icon: DatabaseIcon },
  { id: 2, title: "Introspect", icon: TableIcon },
  { id: 3, title: "Generate", icon: SparklesIcon },
  { id: 4, title: "Done", icon: CheckIcon },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState<string>("");
  const [schema, setSchema] = useState<IntrospectedSchema | null>(null);
  const [semanticLayer, setSemanticLayer] = useState<{
    metrics: unknown[];
    dimensions: unknown[];
    entities: unknown[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setSemanticLayer({
        metrics: data.metrics ?? [],
        dimensions: data.dimensions ?? [],
        entities: data.entities ?? [],
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8">
      <Link
        href="/"
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
              {schema && (
                <div className="mb-4">
                  <SchemaPreview schema={schema} />
                </div>
              )}
              <p className="mb-4 text-sm text-muted-foreground">
                AI will analyze the schema and generate metrics, dimensions, and
                entity relationships.
              </p>
              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating…" : "Generate semantic layer"}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-4 text-lg font-medium">All set!</h2>
              {semanticLayer && (
                <div className="mb-6">
                  <SemanticPreview layer={semanticLayer} />
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
