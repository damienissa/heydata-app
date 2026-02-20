import { createOrchestrator, mockSemanticMetadata, executeMockQuery } from "@heydata/core";
import type { OrchestratorResponse, SemanticMetadata } from "@heydata/shared";

// For MVP, use mock implementations
// In production, replace with real semantic layer and bridge

const orchestrator = createOrchestrator({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: "claude-sonnet-4-20250514",
  dialect: "postgresql",
  enableCache: true,
});

// Use mock semantic metadata (from core package)
// In production, load from @heydata/semantic
const semanticMetadata: SemanticMetadata = mockSemanticMetadata;

// Use mock query executor (from core package)
// In production, use @heydata/bridge with real database
const executeQuery = async (sql: string) => {
  return executeMockQuery(sql);
};

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
