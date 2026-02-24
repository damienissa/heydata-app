import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateSemanticSchema = z.object({
  semantic_md: z.string(),
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
    .select("id, connection_id, semantic_md, raw_schema, generated_at, created_at, updated_at")
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
 * Update the semantic layer Markdown (user edits)
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

  const { data: layer, error } = await supabase
    .from("semantic_layers")
    .update({
      semantic_md: parsed.data.semantic_md,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("connection_id", connectionId)
    .select("id, connection_id, semantic_md, generated_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to update: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(layer);
}
