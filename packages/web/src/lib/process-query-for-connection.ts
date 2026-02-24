import { getPoolManager } from "@heydata/bridge";
import { createOrchestrator } from "@heydata/core";
import { decryptConnectionString } from "@/lib/crypto";
import type {
  OrchestratorResponse,
  ResultSet,
  SemanticMetadata,
  SessionContext,
} from "@heydata/shared";
import {
  HeyDataError,
  IntrospectedSchemaSchema,
  introspectedSchemaToDDL,
} from "@heydata/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@heydata/supabase";

type ConnectionRow = Database["public"]["Tables"]["connections"]["Row"];
type SemanticLayerRow = Database["public"]["Tables"]["semantic_layers"]["Row"];

export interface ProcessQueryForConnectionInput {
  connectionId: string;
  question: string;
  sessionId?: string;
  signal?: AbortSignal;
}

/**
 * Load connection and semantic layer from Supabase, then run the orchestrator.
 * Used when processing queries in a multi-connection, dynamic setup.
 */
export async function processQueryForConnection(
  supabase: SupabaseClient<Database>,
  input: ProcessQueryForConnectionInput,
): Promise<OrchestratorResponse> {
  const { connectionId, question, sessionId, signal } = input;

  // 1. Load connection
  const { data: connection, error: connError } = await supabase
    .from("connections")
    .select("id, connection_string, db_type, ssl_enabled")
    .eq("id", connectionId)
    .single();

  if (connError || !connection) {
    throw new HeyDataError(
      "CONNECTION_NOT_FOUND",
      `Connection not found: ${connectionId}. ${connError?.message ?? ""}`,
      { agent: "orchestrator" },
    );
  }

  const conn = connection as ConnectionRow;

  let plainConnectionString: string;
  try {
    plainConnectionString = decryptConnectionString(conn.connection_string);
  } catch (err) {
    throw new HeyDataError(
      "DECRYPTION_FAILED",
      `Failed to decrypt connection string for ${connectionId}: ${err instanceof Error ? err.message : String(err)}`,
      { agent: "orchestrator" },
    );
  }

  // 2. Load semantic layer for this connection
  const { data: layer, error: layerError } = await supabase
    .from("semantic_layers")
    .select("semantic_md, raw_schema")
    .eq("connection_id", connectionId)
    .limit(1)
    .single();

  if (layerError || !layer) {
    throw new HeyDataError(
      "SEMANTIC_LAYER_NOT_FOUND",
      `Semantic layer not found for connection ${connectionId}. Run semantic generation first. ${layerError?.message ?? ""}`,
      { agent: "orchestrator" },
    );
  }

  const semanticRow = layer as SemanticLayerRow;
  const semanticMetadata: SemanticMetadata = {
    semanticMarkdown: semanticRow.semantic_md ?? "",
  };

  // Attach compact DDL of raw schema for ad-hoc metric support
  if (semanticRow.raw_schema) {
    const parsed = IntrospectedSchemaSchema.safeParse(semanticRow.raw_schema);
    if (parsed.success) {
      semanticMetadata.rawSchemaDDL = introspectedSchemaToDDL(parsed.data);
    }
  }

  // 3. Get pool and create execute function
  const poolManager = getPoolManager();
  const { pool, adapter } = await poolManager.getPool(connectionId, conn.db_type, {
    connectionString: plainConnectionString,
    sslEnabled: conn.ssl_enabled ?? true,
  });

  const executeQuery = async (sql: string): Promise<ResultSet> => {
    return adapter.execute(pool, sql, undefined, {
      maxRows: 10000,
      timeoutMs: 30000,
      validateOperations: true,
    });
  };

  // 4. Build session context for follow-ups
  const sessionContext: SessionContext | undefined = sessionId
    ? {
        sessionId,
        turns: [],
        activeMetrics: [],
        activeDimensions: [],
        activeFilters: [],
      }
    : undefined;

  // 5. Run orchestrator
  const orchestrator = createOrchestrator({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: "claude-sonnet-4-20250514",
    dialect: "postgresql",
    enableCache: true,
  });

  return orchestrator.process({
    question,
    semanticMetadata,
    executeQuery,
    sessionContext,
    signal,
  });
}
