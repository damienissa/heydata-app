import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPoolManager } from "@heydata/bridge";

/** Connection row fields needed for introspection */
type ConnectionForIntrospect = {
  id: string;
  db_type: string;
  connection_string: string;
  ssl_enabled: boolean | null;
};

/**
 * POST /api/connections/:id/introspect — Introspect the database schema
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

  const { id } = await params;

  // Fetch connection details (RLS ensures user can only access their own)
  const { data: conn, error: fetchError } = await supabase
    .from("connections")
    .select("id, db_type, connection_string, ssl_enabled")
    .eq("id", id)
    .single();

  if (fetchError || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const c = conn as ConnectionForIntrospect;
  const poolManager = getPoolManager();
  try {
    const { pool, adapter } = await poolManager.getPool(c.id, c.db_type, {
      connectionString: c.connection_string,
      sslEnabled: c.ssl_enabled ?? true,
    });

    const schema = await adapter.introspect(pool);

    return NextResponse.json(schema);
  } catch (error) {
    return NextResponse.json(
      { error: `Introspection failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
