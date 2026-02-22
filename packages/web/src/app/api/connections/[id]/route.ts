import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPoolManager } from "@heydata/bridge";

/**
 * GET /api/connections/:id — Get a single connection
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

  const { id } = await params;

  const { data, error } = await supabase
    .from("connections")
    .select("id, name, db_type, ssl_enabled, status, last_tested_at, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/connections/:id — Update a connection
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

  const { id } = await params;
  const body = await req.json();

  // Only allow updating certain fields
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.connectionString !== undefined) updates.connection_string = body.connectionString;
  if (body.sslEnabled !== undefined) updates.ssl_enabled = body.sslEnabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If connection string changed, dispose the cached pool
  if (updates.connection_string) {
    await getPoolManager().disposePool(id).catch(() => {});
    updates.status = "pending";
  }

  const { data, error } = await supabase
    .from("connections")
    .update(updates as never)
    .eq("id", id)
    .select("id, name, db_type, ssl_enabled, status, last_tested_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/connections/:id — Delete a connection
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Dispose the pool if it exists
  await getPoolManager().disposePool(id).catch(() => {});

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
