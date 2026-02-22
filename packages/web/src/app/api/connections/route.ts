import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ConnectionConfigSchema } from "@heydata/shared";
import { getPoolManager } from "@heydata/bridge";

/**
 * GET /api/connections — List all connections for the authenticated user
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("connections")
    .select("id, name, db_type, ssl_enabled, status, last_tested_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/connections — Create a new connection and test it
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ConnectionConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, dbType, connectionString, sslEnabled } = parsed.data;

  // Test the connection before saving
  const poolManager = getPoolManager();
  const tempId = `temp_${crypto.randomUUID()}`;
  try {
    const { pool, adapter } = await poolManager.getPool(tempId, dbType, {
      connectionString,
      sslEnabled,
    });
    await adapter.testConnection(pool);
    await poolManager.disposePool(tempId);
  } catch (error) {
    await poolManager.disposePool(tempId).catch(() => {});
    return NextResponse.json(
      { error: `Connection test failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    );
  }

  // Save to Supabase
  const insertData = {
    user_id: user.id,
    name,
    db_type: dbType,
    connection_string: connectionString,
    ssl_enabled: sslEnabled,
    status: "active",
    last_tested_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("connections")
    .insert(insertData as never)
    .select("id, name, db_type, ssl_enabled, status, last_tested_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
