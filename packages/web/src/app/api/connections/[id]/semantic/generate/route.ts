import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPoolManager } from "@heydata/bridge";
import { generateSemanticFromSchema } from "@heydata/core";

/** Connection row fields needed for semantic generation */
type ConnectionForSemantic = {
  id: string;
  db_type: string;
  connection_string: string;
  ssl_enabled: boolean | null;
};

/**
 * POST /api/connections/:id/semantic/generate
 * Introspects the database, runs the semantic-generator agent, and saves to semantic_layers
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: connectionId } = await params;

  // Fetch connection (RLS ensures user owns it)
  const { data: conn, error: fetchError } = await supabase
    .from("connections")
    .select("id, db_type, connection_string, ssl_enabled")
    .eq("id", connectionId)
    .single();

  if (fetchError || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const c = conn as ConnectionForSemantic;
  const poolManager = getPoolManager();

  try {
    // 1. Introspect schema
    const { pool, adapter } = await poolManager.getPool(c.id, c.db_type, {
      connectionString: c.connection_string,
      sslEnabled: c.ssl_enabled ?? true,
    });

    const introspectedSchema = await adapter.introspect(pool);

    // 2. Run semantic generator
    const output = await generateSemanticFromSchema(introspectedSchema);

    // 3. Save to semantic_layers (insert or update)
    const payload = {
      metrics: output.metrics,
      dimensions: output.dimensions,
      entities: output.entities,
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

    let layer;
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("semantic_layers")
        .update(payload as never)
        .eq("connection_id", connectionId)
        .select("id, connection_id, metrics, dimensions, entities, generated_at")
        .single();
      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update semantic layer: ${updateError.message}` },
          { status: 500 },
        );
      }
      layer = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("semantic_layers")
        .insert({ connection_id: connectionId, ...payload } as never)
        .select("id, connection_id, metrics, dimensions, entities, generated_at")
        .single();
      if (insertError) {
        return NextResponse.json(
          { error: `Failed to save semantic layer: ${insertError.message}` },
          { status: 500 },
        );
      }
      layer = inserted;
    }

    return NextResponse.json(layer);
  } catch (error) {
    console.error("[semantic/generate] Error:", error);
    return NextResponse.json(
      { error: `Semantic generation failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
