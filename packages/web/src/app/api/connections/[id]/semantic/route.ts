import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateSemanticSchema = z.object({
  metrics: z.array(z.unknown()).optional(),
  dimensions: z.array(z.unknown()).optional(),
  entities: z.array(z.unknown()).optional(),
});

/**
 * GET /api/connections/:id/semantic
 * Retrieve the semantic layer for a connection
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: connectionId } = await params;

  const { data: layer, error } = await supabase
    .from("semantic_layers")
    .select("id, connection_id, metrics, dimensions, entities, raw_schema, generated_at, created_at, updated_at")
    .eq("connection_id", connectionId)
    .limit(1)
    .single();

  if (error || !layer) {
    return NextResponse.json({ error: "Semantic layer not found" }, { status: 404 });
  }

  return NextResponse.json(layer);
}

/**
 * PUT /api/connections/:id/semantic
 * Update the semantic layer (user edits)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: connectionId } = await params;

  const body = await req.json();
  const parsed = UpdateSemanticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.metrics !== undefined) updates.metrics = parsed.data.metrics;
  if (parsed.data.dimensions !== undefined) updates.dimensions = parsed.data.dimensions;
  if (parsed.data.entities !== undefined) updates.entities = parsed.data.entities;

  const { data: layer, error } = await supabase
    .from("semantic_layers")
    .update(updates as never)
    .eq("connection_id", connectionId)
    .select("id, connection_id, metrics, dimensions, entities, generated_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to update: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(layer);
}
