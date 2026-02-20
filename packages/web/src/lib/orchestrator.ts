import { createExecutor, createPool } from "@heydata/bridge";
import { createOrchestrator } from "@heydata/core";
import { loadRegistry } from "@heydata/semantic";
import type { OrchestratorResponse, ResultSet, SemanticMetadata } from "@heydata/shared";
import { HeyDataError } from "@heydata/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Configuration (no mocks: real semantic layer + real DB required)
// ============================================================================

// ============================================================================
// Orchestrator Setup
// ============================================================================

const orchestrator = createOrchestrator({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: "claude-sonnet-4-20250514",
  dialect: "postgresql",
  enableCache: true,
});

// ============================================================================
// Semantic Layer (real definitions include subscribers_count, etc.)
// ============================================================================

function resolveSemanticDefinitionsDir(): string {
  if (process.env.SEMANTIC_DEFINITIONS_DIR) {
    return process.env.SEMANTIC_DEFINITIONS_DIR;
  }
  const cwd = process.cwd();
  const fromWeb = join(cwd, "..", "semantic", "definitions");
  if (existsSync(fromWeb)) return fromWeb;
  const fromRoot = join(cwd, "packages", "semantic", "definitions");
  if (existsSync(fromRoot)) return fromRoot;
  return fromWeb;
}

const SEMANTIC_DEFINITIONS_DIR = resolveSemanticDefinitionsDir();

let semanticMetadataPromise: Promise<SemanticMetadata> | null = null;

async function getSemanticMetadata(): Promise<SemanticMetadata> {
  if (semanticMetadataPromise === null) {
    semanticMetadataPromise = (async () => {
      const registry = await loadRegistry(SEMANTIC_DEFINITIONS_DIR, { strict: false });
      const metadata = registry.toSemanticMetadata();
      console.log(
        "[heydata] Using semantic layer from",
        SEMANTIC_DEFINITIONS_DIR,
        `(${metadata.metrics.length} metrics, ${metadata.dimensions.length} dimensions)`,
      );
      return metadata;
    })();
  }
  return semanticMetadataPromise;
}

// ============================================================================
// Database Connection (real only; no mocks)
// ============================================================================

function getExecuteQuery(): (sql: string) => Promise<ResultSet> {
  const connectionString = process.env.DATABASE_URL;

  const pool = createPool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
    max: 10,
  });

  return createExecutor(pool, {
    maxRows: 10000,
    timeoutMs: 30000,
    validateOperations: true,
  });
}

let executeQueryInstance: ((sql: string) => Promise<ResultSet>) | null = null;

function getExecuteQueryLazy(): (sql: string) => Promise<ResultSet> {
  if (executeQueryInstance === null) {
    executeQueryInstance = getExecuteQuery();
    console.log("[heydata] Using real database connection");
  }
  return executeQueryInstance;
}

// ============================================================================
// Query Processing
// ============================================================================

export interface QueryRequest {
  question: string;
  sessionId?: string;
}

export async function processQuery(request: QueryRequest): Promise<OrchestratorResponse> {
  let semanticMetadata: SemanticMetadata;
  try {
    semanticMetadata = await getSemanticMetadata();
  } catch (err) {
    throw new HeyDataError(
      "CONFIG_ERROR",
      `Failed to load semantic layer from ${SEMANTIC_DEFINITIONS_DIR}. Ensure definitions exist (no mocks). ${err instanceof Error ? err.message : String(err)}`,
      { agent: "orchestrator" },
    );
  }

  const runQuery = getExecuteQueryLazy();

  return orchestrator.process({
    question: request.question,
    semanticMetadata,
    executeQuery: runQuery,
    sessionContext: request.sessionId
      ? {
        sessionId: request.sessionId,
        turns: [],
        activeMetrics: [],
        activeDimensions: [],
        activeFilters: [],
      }
      : undefined,
  });
}
