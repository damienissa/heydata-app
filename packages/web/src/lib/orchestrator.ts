import { createOrchestrator, mockSemanticMetadata, executeMockQuery } from "@heydata/core";
import { createPool, createExecutor } from "@heydata/bridge";
import type { OrchestratorResponse, SemanticMetadata, ResultSet } from "@heydata/shared";

// ============================================================================
// Configuration
// ============================================================================

// Set to true to use real database, false for mock data
const USE_REAL_DATABASE = !!process.env.DATABASE_URL;

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
// Semantic Layer
// ============================================================================

// TODO: Replace with loadRegistry() from @heydata/semantic when you have
// your own YAML definitions. See GETTING_STARTED.md for details.
//
// import { loadRegistry } from "@heydata/semantic";
// const registry = await loadRegistry("./packages/semantic/definitions");
// const semanticMetadata = registry.toSemanticMetadata();

const semanticMetadata: SemanticMetadata = mockSemanticMetadata;

// ============================================================================
// Database Connection
// ============================================================================

let executeQuery: (sql: string) => Promise<ResultSet>;

if (USE_REAL_DATABASE) {
  // Real database connection using @heydata/bridge
  const pool = createPool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false }, // Required for Supabase
    max: 10,
  });

  executeQuery = createExecutor(pool, {
    maxRows: 10000,
    timeoutMs: 30000,
    validateOperations: true,
  });

  console.log("[heydata] Using real database connection");
} else {
  // Mock data for development/testing
  executeQuery = async (sql: string) => executeMockQuery(sql);
  console.log("[heydata] Using mock data (set DATABASE_URL to use real database)");
}

// ============================================================================
// Query Processing
// ============================================================================

export interface QueryRequest {
  question: string;
  sessionId?: string;
}

export async function processQuery(request: QueryRequest): Promise<OrchestratorResponse> {
  return orchestrator.process({
    question: request.question,
    semanticMetadata,
    executeQuery,
    sessionContext: request.sessionId ? {
      sessionId: request.sessionId,
      turns: [],
      activeMetrics: [],
      activeDimensions: [],
      activeFilters: [],
    } : undefined,
  });
}
