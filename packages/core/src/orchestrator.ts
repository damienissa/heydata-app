import Anthropic from "@anthropic-ai/sdk";
import {
  HeyDataError,
  type AgentTrace,
  type EnrichedResultSet,
  type InsightAnnotation,
  type OrchestratorResponse,
  type OrchestratorTrace,
  type ResultSet,
  type SemanticMetadata,
  type SessionContext,
  type VisualizationSpec,
  type WarehouseDialect,
} from "@heydata/shared";
import {
  analyzeData,
  generateNarrative,
  generateSql,
  planVisualization,
  resolveIntent,
  validateData,
  validateSql,
} from "./agents/index.js";
import { QueryCache } from "./cache.js";
import { createLogger, type Logger, type LogLevel } from "./logger.js";
import type { AgentContext } from "./types.js";

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model for complex agents: SQL generation, data analysis, narrative */
  model?: string;
  /** Faster model for structured agents: intent, validation, viz planning */
  fastModel?: string;
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
  /** Logger instance (defaults to info-level console logger) */
  logger?: Logger;
  /** Log level (ignored if logger is provided) */
  logLevel?: LogLevel;
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
const DEFAULT_CONFIG: Required<Omit<OrchestratorConfig, "apiKey" | "logger" | "logLevel">> = {
  model: "claude-haiku-4-5-20251001",
  fastModel: "claude-haiku-4-5-20251001",
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
  private config: Required<Omit<OrchestratorConfig, "logger" | "logLevel">>;
  private cache: QueryCache | null;
  private log: Logger;

  constructor(config: OrchestratorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.cache = this.config.enableCache
      ? new QueryCache({ ttlMs: this.config.cacheTtlMs })
      : null;
    this.log = config.logger ?? createLogger({ level: config.logLevel ?? "info" });
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
      fastModel: this.config.fastModel,
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

    this.log.info(`[Orchestrator] Starting request: ${requestId}`);
    this.log.debug(`[Orchestrator] Question: "${input.question}"`);

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get({
        question: input.question,
        sessionId: input.sessionContext?.sessionId,
        dialect: this.config.dialect,
      });
      if (cached) {
        this.log.info("[Orchestrator] Cache HIT - returning cached response");
        return cached;
      }
      this.log.debug("[Orchestrator] Cache MISS - processing query");
    }

    try {
      // Step 1: Resolve intent
      this.log.info("[Step 1] Intent Resolver - starting");
      const intentResult = await resolveIntent({
        context,
        question: input.question,
        sessionContext: input.sessionContext,
        semanticMetadata: input.semanticMetadata,
      });
      agentTraces.push(intentResult.trace);
      this.log.info("[Step 1] Intent Resolver - complete", {
        queryType: intentResult.data.queryType,
        confidence: intentResult.data.confidence,
      });
      this.log.debug("[Step 1] Intent details", {
        metrics: intentResult.data.metrics,
        dimensions: intentResult.data.dimensions,
        filters: intentResult.data.filters,
        timeRange: intentResult.data.timeRange,
      });

      // Check if clarification is needed
      if (intentResult.data.clarificationNeeded) {
        this.log.info("[Step 1] Clarification needed", {
          question: intentResult.data.clarificationQuestion,
        });
        const trace = this.buildTrace(requestId, startedAt, agentTraces);
        return {
          requestId,
          intent: intentResult.data,
          trace,
          clarificationQuestion: intentResult.data.clarificationQuestion,
        };
      }

      // Step 2 & 3: Generate and validate SQL with feedback loop
      this.log.info("[Step 2-3] SQL Generation & Validation - starting");
      const { sqlResult, validationResult } = await this.generateAndValidateSql(
        context,
        intentResult.data,
        input.semanticMetadata,
        agentTraces,
      );
      agentTraces.push(validationResult.trace);
      this.log.info("[Step 2-3] SQL Generation & Validation - complete", {
        tablesTouched: sqlResult.data.tablesTouched,
        complexity: sqlResult.data.estimatedComplexity,
        valid: validationResult.data.valid,
      });
      this.log.debug("[Step 2-3] Generated SQL", { sql: sqlResult.data.sql });

      // Step 4: Execute query
      this.log.info("[Step 4] Query Execution - starting");
      let resultSet: ResultSet;
      try {
        resultSet = await input.executeQuery(sqlResult.data.sql);
        this.log.info("[Step 4] Query Execution - complete", {
          rowCount: resultSet.rowCount,
          columns: resultSet.columns.map(c => `${c.name}(${c.type})`).join(", "),
          truncated: resultSet.truncated,
        });
      } catch (error) {
        this.log.error("[Step 4] Query Execution - FAILED", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new HeyDataError(
          "QUERY_EXECUTION_FAILED",
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
          { agent: "orchestrator" },
        );
      }

      // Step 5: Validate data
      this.log.info("[Step 5] Data Validation - starting");
      const dataValidationResult = await validateData({
        context,
        resultSet,
        intent: intentResult.data,
      });
      agentTraces.push(dataValidationResult.trace);
      this.log.info("[Step 5] Data Validation - complete", {
        qualityFlags: dataValidationResult.data.qualityFlags.length,
      });
      this.log.debug("[Step 5] Column stats", {
        stats: dataValidationResult.data.columnStats.map(s =>
          `${s.column}: nulls=${s.nullCount}, distinct=${s.distinctCount}`
        ).join("; "),
      });

      // Steps 6+7: Analyze data and plan visualization (parallel — no dependency between them)
      this.log.info("[Step 6+7] Data Analysis + Visualization Planning - starting (parallel)");
      const [analysisSettled, vizSettled] = await Promise.allSettled([
        analyzeData({
          context,
          resultSet,
          columnStats: dataValidationResult.data.columnStats,
          intent: intentResult.data,
          question: input.question,
        }),
        planVisualization({
          context,
          intent: intentResult.data,
          resultSet,
          semanticMd: input.semanticMetadata.semanticMarkdown,
        }),
      ]);

      const analysisResult: { data: InsightAnnotation[]; trace: AgentTrace } =
        analysisSettled.status === "fulfilled"
          ? analysisSettled.value
          : (() => {
            this.log.error("[Step 6] Data Analysis - FAILED", {
              error: String(analysisSettled.reason),
            });
            return {
              data: [] as InsightAnnotation[],
              trace: {
                agent: "data_analyzer" as const,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                inputTokens: 0,
                outputTokens: 0,
                model: context.model,
                success: false,
                error: String(analysisSettled.reason),
              },
            };
          })();

      const vizResult: { data: VisualizationSpec; trace: AgentTrace } =
        vizSettled.status === "fulfilled"
          ? vizSettled.value
          : (() => {
            this.log.error("[Step 7] Visualization Planning - FAILED", {
              error: String(vizSettled.reason),
            });
            return {
              data: { chartType: "table" as const, series: [] } satisfies VisualizationSpec,
              trace: {
                agent: "viz_planner" as const,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                inputTokens: 0,
                outputTokens: 0,
                model: context.model,
                success: false,
                error: String(vizSettled.reason),
              },
            };
          })();

      agentTraces.push(analysisResult.trace, vizResult.trace);
      this.log.info("[Step 6+7] Data Analysis + Visualization Planning - complete", {
        insightsFound: analysisResult.data.length,
        chartType: vizResult.data.chartType,
        seriesCount: vizResult.data.series?.length ?? 0,
      });

      // Step 8: Generate narrative
      this.log.info("[Step 8] Narrative Generation - starting");
      const narrativeResult = await generateNarrative({
        context,
        intent: intentResult.data,
        resultSet,
        insights: analysisResult.data,
        qualityFlags: dataValidationResult.data.qualityFlags,
        question: input.question,
      });
      agentTraces.push(narrativeResult.trace);
      this.log.info("[Step 8] Narrative Generation - complete", {
        length: narrativeResult.data.length,
      });

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

      this.log.info(`[Orchestrator] Request COMPLETE: ${requestId}`, {
        durationMs: Date.now() - startedAt.getTime(),
      });

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

      this.log.error("[Orchestrator] Pipeline FAILED", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof HeyDataError ? error.code : undefined,
        agent: error instanceof HeyDataError ? error.agent : undefined,
        completedAgents: agentTraces.map(t => t.agent).join(" -> "),
      });

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
   * Generate and validate SQL with feedback loop
   * If validation fails, feed errors back to generator and retry
   */
  private async generateAndValidateSql(
    context: AgentContext,
    intent: Awaited<ReturnType<typeof resolveIntent>>["data"],
    semanticMetadata: SemanticMetadata,
    agentTraces: AgentTrace[],
  ) {
    let previousSql: string | undefined;
    let validationErrors: string[] | undefined;

    for (let attempt = 0; attempt < this.config.maxSqlRetries; attempt++) {
      this.log.info(`[Step 2-3] Attempt ${attempt + 1}/${this.config.maxSqlRetries}`);

      if (previousSql && validationErrors) {
        this.log.debug("[Step 2] Retrying with feedback from previous errors", {
          errors: validationErrors,
        });
      }

      // Generate SQL (with previous errors if this is a retry)
      this.log.debug("[Step 2] SQL Generator - starting");
      const sqlResult = await generateSql({
        context,
        intent,
        semanticMetadata,
        previousSql,
        validationErrors,
      });
      sqlResult.trace.retryCount = attempt;
      agentTraces.push(sqlResult.trace);
      this.log.debug("[Step 2] SQL Generator - complete", { sql: sqlResult.data.sql });

      // Validate the generated SQL
      this.log.debug("[Step 3] SQL Validator - starting");
      const validationResult = await validateSql({
        context,
        generatedSql: sqlResult.data,
        intent,
        semanticMetadata,
      });
      this.log.debug("[Step 3] SQL Validator - complete", {
        valid: validationResult.data.valid,
      });

      // If valid, return both results
      if (validationResult.data.valid) {
        this.log.info("[Step 3] Validation PASSED");
        return { sqlResult, validationResult };
      }

      // Validation failed - collect errors for next attempt
      const errorIssues = validationResult.data.issues.filter(
        (i) => i.severity === "error",
      );

      // If no error-level issues, treat as valid (warnings/info only)
      if (errorIssues.length === 0) {
        this.log.info("[Step 3] Validation PASSED (warnings only)");
        return { sqlResult, validationResult };
      }

      // Store for feedback loop
      previousSql = sqlResult.data.sql;
      validationErrors = errorIssues.map((i) => i.message);

      this.log.warn(`[Step 3] Validation FAILED with ${errorIssues.length} errors`, {
        issues: errorIssues.map(i => ({
          type: i.type,
          message: i.message,
          suggestion: i.suggestion,
        })),
      });

      // Add validation trace for this failed attempt
      agentTraces.push(validationResult.trace);
    }

    // All retries exhausted
    this.log.error("[Step 2-3] All retries exhausted", { lastErrors: validationErrors });
    throw new HeyDataError(
      "SQL_VALIDATION_FAILED",
      `SQL validation failed after ${this.config.maxSqlRetries} attempts. Last errors: ${validationErrors?.join("; ")}`,
      { agent: "sql_validator", details: { lastErrors: validationErrors } },
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
