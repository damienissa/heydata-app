import Anthropic from "@anthropic-ai/sdk";
import {
  HeyDataError,
  type AgentTrace,
  type EnrichedResultSet,
  type OrchestratorResponse,
  type OrchestratorTrace,
  type ResultSet,
  type SemanticMetadata,
  type SessionContext,
  type WarehouseDialect,
} from "@heydata/shared";
import {
  resolveIntent,
  generateSql,
  validateSql,
  validateData,
  analyzeData,
  planVisualization,
  generateNarrative,
} from "./agents/index.js";
import type { AgentContext } from "./types.js";
import { QueryCache } from "./cache.js";

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use for LLM calls */
  model?: string;
  /** Target warehouse dialect */
  dialect?: WarehouseDialect;
  /** Maximum retries for SQL generation */
  maxSqlRetries?: number;
  /** Maximum retries for data validation */
  maxDataRetries?: number;
  /** Enable response caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Input for the orchestrator
 */
export interface OrchestratorInput {
  /** User's natural language question */
  question: string;
  /** Session context for follow-up questions */
  sessionContext?: SessionContext;
  /** Semantic metadata (metrics, dimensions, relationships) */
  semanticMetadata: SemanticMetadata;
  /** Function to execute SQL queries */
  executeQuery: (sql: string) => Promise<ResultSet>;
  /** Optional abort signal */
  signal?: AbortSignal;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<OrchestratorConfig, "apiKey">> = {
  model: "claude-sonnet-4-20250514",
  dialect: "postgresql",
  maxSqlRetries: 3,
  maxDataRetries: 2,
  enableCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Orchestrator coordinates the AI agent pipeline
 */
export class Orchestrator {
  private client: Anthropic;
  private config: Required<OrchestratorConfig>;
  private cache: QueryCache | null;

  constructor(config: OrchestratorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.cache = this.config.enableCache
      ? new QueryCache({ ttlMs: this.config.cacheTtlMs })
      : null;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Create agent context for this request
   */
  private createContext(
    requestId: string,
    signal?: AbortSignal,
  ): AgentContext {
    return {
      requestId,
      client: this.client,
      model: this.config.model,
      dialect: this.config.dialect,
      signal,
    };
  }

  /**
   * Build orchestrator trace from agent traces
   */
  private buildTrace(
    requestId: string,
    startedAt: Date,
    agentTraces: AgentTrace[],
  ): OrchestratorTrace {
    const completedAt = new Date();
    return {
      requestId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      agentTraces,
      totalInputTokens: agentTraces.reduce((sum, t) => sum + t.inputTokens, 0),
      totalOutputTokens: agentTraces.reduce((sum, t) => sum + t.outputTokens, 0),
    };
  }

  /**
   * Process a user question through the full pipeline
   */
  async process(input: OrchestratorInput): Promise<OrchestratorResponse> {
    const requestId = this.generateRequestId();
    const startedAt = new Date();
    const agentTraces: AgentTrace[] = [];
    const context = this.createContext(requestId, input.signal);

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get({
        question: input.question,
        sessionId: input.sessionContext?.sessionId,
        dialect: this.config.dialect,
      });
      if (cached) {
        return cached;
      }
    }

    try {
      // Step 1: Resolve intent
      const intentResult = await resolveIntent({
        context,
        question: input.question,
        sessionContext: input.sessionContext,
        semanticMetadata: input.semanticMetadata,
      });
      agentTraces.push(intentResult.trace);

      // Check if clarification is needed
      if (intentResult.data.clarificationNeeded) {
        const trace = this.buildTrace(requestId, startedAt, agentTraces);
        return {
          requestId,
          intent: intentResult.data,
          trace,
          clarificationQuestion: intentResult.data.clarificationQuestion,
        };
      }

      // Step 2: Generate SQL with retry
      let sqlResult = await this.generateSqlWithRetry(
        context,
        intentResult.data,
        input.semanticMetadata,
        agentTraces,
      );

      // Step 3: Validate SQL
      const validationResult = await validateSql({
        context,
        generatedSql: sqlResult.data,
        intent: intentResult.data,
      });
      agentTraces.push(validationResult.trace);

      // If validation fails, try to regenerate SQL
      if (!validationResult.data.valid) {
        const errorMessages = validationResult.data.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ");

        throw new HeyDataError(
          "SQL_VALIDATION_FAILED",
          `SQL validation failed: ${errorMessages}`,
          { agent: "sql_validator", details: { issues: validationResult.data.issues } },
        );
      }

      // Step 4: Execute query
      let resultSet: ResultSet;
      try {
        resultSet = await input.executeQuery(sqlResult.data.sql);
      } catch (error) {
        throw new HeyDataError(
          "QUERY_EXECUTION_FAILED",
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
          { agent: "orchestrator" },
        );
      }

      // Step 5: Validate data
      const dataValidationResult = await validateData({
        context,
        resultSet,
      });
      agentTraces.push(dataValidationResult.trace);

      // Step 6: Analyze data
      const analysisResult = await analyzeData({
        context,
        resultSet,
        columnStats: dataValidationResult.data.columnStats,
        intent: intentResult.data,
      });
      agentTraces.push(analysisResult.trace);

      // Step 7: Plan visualization
      const vizResult = await planVisualization({
        context,
        intent: intentResult.data,
        resultSet,
      });
      agentTraces.push(vizResult.trace);

      // Step 8: Generate narrative
      const narrativeResult = await generateNarrative({
        context,
        intent: intentResult.data,
        resultSet,
        insights: analysisResult.data,
        qualityFlags: dataValidationResult.data.qualityFlags,
      });
      agentTraces.push(narrativeResult.trace);

      // Build enriched result set
      const enrichedResults: EnrichedResultSet = {
        ...resultSet,
        stats: dataValidationResult.data.columnStats,
        qualityFlags: dataValidationResult.data.qualityFlags,
        insights: analysisResult.data,
      };

      // Build final response
      const response: OrchestratorResponse = {
        requestId,
        intent: intentResult.data,
        sql: sqlResult.data,
        results: enrichedResults,
        visualization: vizResult.data,
        narrative: narrativeResult.data,
        trace: this.buildTrace(requestId, startedAt, agentTraces),
      };

      // Cache the response
      if (this.cache) {
        this.cache.set(
          {
            question: input.question,
            sessionId: input.sessionContext?.sessionId,
            dialect: this.config.dialect,
          },
          response,
        );
      }

      return response;
    } catch (error) {
      const trace = this.buildTrace(requestId, startedAt, agentTraces);

      if (error instanceof HeyDataError) {
        throw error;
      }

      throw new HeyDataError(
        "ORCHESTRATION_ERROR",
        `Pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        { agent: "orchestrator", details: { trace } },
      );
    }
  }

  /**
   * Generate SQL with retry logic
   */
  private async generateSqlWithRetry(
    context: AgentContext,
    intent: Awaited<ReturnType<typeof resolveIntent>>["data"],
    semanticMetadata: SemanticMetadata,
    agentTraces: AgentTrace[],
  ) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxSqlRetries; attempt++) {
      try {
        const result = await generateSql({
          context,
          intent,
          semanticMetadata,
        });
        result.trace.retryCount = attempt;
        agentTraces.push(result.trace);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to retry
      }
    }

    throw new HeyDataError(
      "MAX_RETRIES_EXCEEDED",
      `SQL generation failed after ${this.config.maxSqlRetries} attempts: ${lastError?.message}`,
      { agent: "sql_generator" },
    );
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache?.size ?? 0,
      enabled: this.config.enableCache,
    };
  }
}

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
