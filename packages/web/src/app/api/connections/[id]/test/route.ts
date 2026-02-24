import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPoolManager } from "@heydata/bridge";
import { decryptConnectionString, CryptoDecryptionError } from "@/lib/crypto";

/** Connection row fields needed for testing */
type ConnectionForTest = {
  id: string;
  db_type: string;
  connection_string: string;
  ssl_enabled: boolean | null;
};

/**
 * POST /api/connections/:id/test — Test an existing connection
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

  const c = conn as ConnectionForTest;

  let plainConnectionString: string;
  try {
    plainConnectionString = decryptConnectionString(c.connection_string);
  } catch (err) {
    if (err instanceof CryptoDecryptionError) {
      console.error("[test] Decryption failed for connection:", id, err.message);
      return NextResponse.json({ error: "Failed to decrypt connection credentials." }, { status: 500 });
    }
    throw err;
  }

  const poolManager = getPoolManager();
  try {
    const { pool, adapter } = await poolManager.getPool(c.id, c.db_type, {
      connectionString: plainConnectionString,
      sslEnabled: c.ssl_enabled ?? true,
    });
    await adapter.testConnection(pool);

    // Update status
    await supabase
      .from("connections")
      .update({ status: "active", last_tested_at: new Date().toISOString() } as never)
      .eq("id", id);

    return NextResponse.json({ ok: true, status: "active" });
  } catch (error) {
    // Update status to failed
    await supabase
      .from("connections")
      .update({ status: "failed", last_tested_at: new Date().toISOString() } as never)
      .eq("id", id);

    // Dispose potentially broken pool
    await poolManager.disposePool(id).catch(() => {});

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
