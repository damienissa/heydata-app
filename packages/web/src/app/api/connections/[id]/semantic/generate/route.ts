export const maxDuration = 300;

import { createClient } from "@/lib/supabase/server";
import { getPoolManager } from "@heydata/bridge";
import { generateSemanticFromSchema } from "@heydata/core";
import { decryptConnectionString, CryptoDecryptionError } from "@/lib/crypto";

/** Connection row fields needed for semantic generation */
type ConnectionForSemantic = {
  id: string;
  db_type: string;
  connection_string: string;
  ssl_enabled: boolean | null;
};

type ProgressStep = "connecting" | "introspecting" | "generating" | "saving";

/**
 * POST /api/connections/:id/semantic/generate
 * Streams Server-Sent Events with per-step progress, then the final result.
 *
 * Event types:
 *   progress  { step: ProgressStep, message: string }
 *   complete  { id, connection_id, semantic_md, generated_at }
 *   error     { message: string }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: connectionId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      try {
        // ── Step 1: Fetch connection ──────────────────────────────────────
        send("progress", {
          step: "connecting" satisfies ProgressStep,
          message: "Fetching connection details…",
        });
        console.log(`[semantic/generate] Fetching connection ${connectionId}`);

        const { data: conn, error: fetchError } = await supabase
          .from("connections")
          .select("id, db_type, connection_string, ssl_enabled")
          .eq("id", connectionId)
          .single();

        if (fetchError || !conn) {
          send("error", { message: "Connection not found." });
          return;
        }

        const c = conn as ConnectionForSemantic;

        // ── Step 2: Decrypt credentials ───────────────────────────────────
        let plainConnectionString: string;
        try {
          plainConnectionString = decryptConnectionString(c.connection_string);
        } catch (err) {
          if (err instanceof CryptoDecryptionError) {
            console.error(
              "[semantic/generate] Decryption failed for connection:",
              connectionId,
              (err as Error).message,
            );
            send("error", {
              message: "Failed to decrypt connection credentials.",
            });
            return;
          }
          throw err;
        }

        // ── Step 3: Introspect schema ─────────────────────────────────────
        send("progress", {
          step: "introspecting" satisfies ProgressStep,
          message: "Reading database schema…",
        });
        console.log(
          `[semantic/generate] Introspecting schema for connection ${connectionId}`,
        );

        const poolManager = getPoolManager();
        const { pool, adapter } = await poolManager.getPool(
          c.id,
          c.db_type,
          {
            connectionString: plainConnectionString,
            sslEnabled: c.ssl_enabled ?? true,
          },
        );
        const introspectedSchema = await adapter.introspect(pool);
        console.log(
          `[semantic/generate] Schema introspected: ${introspectedSchema.tables.length} tables`,
        );

        // ── Step 4: Generate semantic layer ───────────────────────────────
        send("progress", {
          step: "generating" satisfies ProgressStep,
          message: "Generating semantic layer with AI…",
        });
        console.log(`[semantic/generate] Starting semantic generation`);

        const output = await generateSemanticFromSchema(introspectedSchema);
        console.log(`[semantic/generate] Generation complete`);

        // ── Step 5: Save to database ──────────────────────────────────────
        send("progress", {
          step: "saving" satisfies ProgressStep,
          message: "Saving to database…",
        });

        const payload = {
          semantic_md: output.semanticMarkdown,
          raw_schema: introspectedSchema as unknown as Record<string, unknown>,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("semantic_layers")
          .select("id")
          .eq("connection_id", connectionId)
          .limit(1)
          .single();

        let layer: { id: string; connection_id: string; semantic_md: string; generated_at: string } | null = null;

        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from("semantic_layers")
            .update(payload as never)
            .eq("connection_id", connectionId)
            .select("id, connection_id, semantic_md, generated_at")
            .single();
          if (updateError) {
            send("error", {
              message: `Failed to update semantic layer: ${updateError.message}`,
            });
            return;
          }
          layer = updated as typeof layer;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("semantic_layers")
            .insert({ connection_id: connectionId, ...payload } as never)
            .select("id, connection_id, semantic_md, generated_at")
            .single();
          if (insertError) {
            send("error", {
              message: `Failed to save semantic layer: ${insertError.message}`,
            });
            return;
          }
          layer = inserted as typeof layer;
        }

        console.log(
          `[semantic/generate] Saved semantic layer for connection ${connectionId}`,
        );
        send("complete", layer!);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error("[semantic/generate] Unexpected error:", error);
        send("error", { message: `Semantic generation failed: ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
