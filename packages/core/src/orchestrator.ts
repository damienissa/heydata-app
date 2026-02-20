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

    console.log("\n" + "=".repeat(80));
    console.log(`[Orchestrator] Starting request: ${requestId}`);
    console.log(`[Orchestrator] Question: "${input.question}"`);
    console.log("=".repeat(80));

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get({
        question: input.question,
        sessionId: input.sessionContext?.sessionId,
        dialect: this.config.dialect,
      });
      if (cached) {
        console.log("[Orchestrator] Cache HIT - returning cached response");
        return cached;
      }
      console.log("[Orchestrator] Cache MISS - processing query");
    }

    try {
      // Step 1: Resolve intent
      console.log("\n" + "-".repeat(60));
      console.log("[Step 1] INTENT RESOLVER - Starting...");
      const intentResult = await resolveIntent({
        context,
        question: input.question,
        sessionContext: input.sessionContext,
        semanticMetadata: input.semanticMetadata,
      });
      agentTraces.push(intentResult.trace);
      console.log("[Step 1] INTENT RESOLVER - Complete");
      console.log("[Step 1] Query Type:", intentResult.data.queryType);
      console.log("[Step 1] Metrics:", intentResult.data.metrics);
      console.log("[Step 1] Dimensions:", intentResult.data.dimensions);
      console.log("[Step 1] Filters:", JSON.stringify(intentResult.data.filters));
      console.log("[Step 1] Time Range:", JSON.stringify(intentResult.data.timeRange));
      console.log("[Step 1] Confidence:", intentResult.data.confidence);
      if (intentResult.data.clarificationNeeded) {
        console.log("[Step 1] Clarification Needed:", intentResult.data.clarificationQuestion);
      }

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

      // Step 2 & 3: Generate and validate SQL with feedback loop
      console.log("\n" + "-".repeat(60));
      console.log("[Step 2-3] SQL GENERATION & VALIDATION - Starting...");
      const { sqlResult, validationResult } = await this.generateAndValidateSql(
        context,
        intentResult.data,
        input.semanticMetadata,
        agentTraces,
      );
      agentTraces.push(validationResult.trace);
      console.log("[Step 2-3] SQL GENERATION & VALIDATION - Complete");
      console.log("[Step 2-3] Generated SQL:\n", sqlResult.data.sql);
      console.log("[Step 2-3] Tables Touched:", sqlResult.data.tablesTouched);
      console.log("[Step 2-3] Complexity:", sqlResult.data.estimatedComplexity);
      console.log("[Step 2-3] Validation Valid:", validationResult.data.valid);
      if (validationResult.data.issues.length > 0) {
        console.log("[Step 2-3] Validation Issues:", JSON.stringify(validationResult.data.issues, null, 2));
      }

      // Step 4: Execute query
      console.log("\n" + "-".repeat(60));
      console.log("[Step 4] QUERY EXECUTION - Starting...");
      let resultSet: ResultSet;
      try {
        resultSet = await input.executeQuery(sqlResult.data.sql);
        console.log("[Step 4] QUERY EXECUTION - Complete");
        console.log("[Step 4] Row Count:", resultSet.rowCount);
        console.log("[Step 4] Columns:", resultSet.columns.map(c => `${c.name}(${c.type})`).join(", "));
        console.log("[Step 4] Truncated:", resultSet.truncated);
        if (resultSet.rowCount > 0 && resultSet.rowCount <= 5) {
          console.log("[Step 4] Sample Data:", JSON.stringify(resultSet.rows, null, 2));
        } else if (resultSet.rowCount > 5) {
          console.log("[Step 4] Sample Data (first 3 rows):", JSON.stringify(resultSet.rows.slice(0, 3), null, 2));
        }
      } catch (error) {
        console.error("[Step 4] QUERY EXECUTION - FAILED:", error);
        throw new HeyDataError(
          "QUERY_EXECUTION_FAILED",
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
          { agent: "orchestrator" },
        );
      }

      // Step 5: Validate data
      console.log("\n" + "-".repeat(60));
      console.log("[Step 5] DATA VALIDATION - Starting...");
      const dataValidationResult = await validateData({
        context,
        resultSet,
        intent: intentResult.data,
      });
      agentTraces.push(dataValidationResult.trace);
      console.log("[Step 5] DATA VALIDATION - Complete");
      console.log("[Step 5] Quality Flags:", dataValidationResult.data.qualityFlags.length);
      if (dataValidationResult.data.qualityFlags.length > 0) {
        console.log("[Step 5] Flags:", JSON.stringify(dataValidationResult.data.qualityFlags, null, 2));
      }
      console.log("[Step 5] Column Stats:", dataValidationResult.data.columnStats.map(s => `${s.column}: nulls=${s.nullCount}, distinct=${s.distinctCount}`).join("; "));

      // Step 6: Analyze data
      console.log("\n" + "-".repeat(60));
      console.log("[Step 6] DATA ANALYSIS - Starting...");
      const analysisResult = await analyzeData({
        context,
        resultSet,
        columnStats: dataValidationResult.data.columnStats,
        intent: intentResult.data,
      });
      agentTraces.push(analysisResult.trace);
      console.log("[Step 6] DATA ANALYSIS - Complete");
      console.log("[Step 6] Insights Found:", analysisResult.data.length);
      if (analysisResult.data.length > 0) {
        console.log("[Step 6] Insights:", JSON.stringify(analysisResult.data.slice(0, 3), null, 2));
      }

      // Step 7: Plan visualization
      console.log("\n" + "-".repeat(60));
      console.log("[Step 7] VISUALIZATION PLANNING - Starting...");
      const vizResult = await planVisualization({
        context,
        intent: intentResult.data,
        resultSet,
      });
      agentTraces.push(vizResult.trace);
      console.log("[Step 7] VISUALIZATION PLANNING - Complete");
      console.log("[Step 7] Chart Type:", vizResult.data.chartType);
      console.log("[Step 7] Title:", vizResult.data.title);
      console.log("[Step 7] Series Count:", vizResult.data.series?.length ?? 0);

      // Step 8: Generate narrative
      console.log("\n" + "-".repeat(60));
      console.log("[Step 8] NARRATIVE GENERATION - Starting...");
      const narrativeResult = await generateNarrative({
        context,
        intent: intentResult.data,
        resultSet,
        insights: analysisResult.data,
        qualityFlags: dataValidationResult.data.qualityFlags,
      });
      agentTraces.push(narrativeResult.trace);
      console.log("[Step 8] NARRATIVE GENERATION - Complete");
      console.log("[Step 8] Narrative Length:", narrativeResult.data.length, "chars");
      console.log("[Step 8] Narrative Preview:", narrativeResult.data.substring(0, 200) + "...");

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

      console.log("\n" + "=".repeat(80));
      console.log("[Orchestrator] Request COMPLETE:", requestId);
      console.log("[Orchestrator] Total Duration:", Date.now() - startedAt.getTime(), "ms");
      console.log("=".repeat(80) + "\n");

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

      console.error("\n" + "!".repeat(80));
      console.error("[Orchestrator] ❌ PIPELINE FAILED");
      console.error("[Orchestrator] Request ID:", requestId);
      console.error("[Orchestrator] Error:", error instanceof Error ? error.message : String(error));
      if (error instanceof HeyDataError) {
        console.error("[Orchestrator] Error Code:", error.code);
        console.error("[Orchestrator] Agent:", error.agent);
        if (error.details) {
          console.error("[Orchestrator] Details:", JSON.stringify(error.details, null, 2));
        }
      }
      console.error("[Orchestrator] Completed Agents:", agentTraces.map(t => t.agent).join(" → "));
      console.error("!".repeat(80) + "\n");

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
      console.log(`\n[Step 2-3] Attempt ${attempt + 1}/${this.config.maxSqlRetries}`);

      // Generate SQL (with previous errors if this is a retry)
      console.log("[Step 2] SQL GENERATOR - Starting...");
      if (previousSql && validationErrors) {
        console.log("[Step 2] Retrying with feedback from previous errors:");
        validationErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      }

      const sqlResult = await generateSql({
        context,
        intent,
        semanticMetadata,
        previousSql,
        validationErrors,
      });
      sqlResult.trace.retryCount = attempt;
      agentTraces.push(sqlResult.trace);

      console.log("[Step 2] SQL GENERATOR - Complete");
      console.log("[Step 2] Generated SQL:\n", sqlResult.data.sql);

      // Validate the generated SQL
      console.log("[Step 3] SQL VALIDATOR - Starting...");
      const validationResult = await validateSql({
        context,
        generatedSql: sqlResult.data,
        intent,
      });
      console.log("[Step 3] SQL VALIDATOR - Complete");
      console.log("[Step 3] Valid:", validationResult.data.valid);

      // If valid, return both results
      if (validationResult.data.valid) {
        console.log("[Step 3] ✅ Validation PASSED");
        return { sqlResult, validationResult };
      }

      // Validation failed - collect errors for next attempt
      const errorIssues = validationResult.data.issues.filter(
        (i) => i.severity === "error",
      );

      // If no error-level issues, treat as valid (warnings/info only)
      if (errorIssues.length === 0) {
        console.log("[Step 3] ✅ Validation PASSED (warnings only)");
        return { sqlResult, validationResult };
      }

      // Store for feedback loop
      previousSql = sqlResult.data.sql;
      validationErrors = errorIssues.map((i) => i.message);

      console.log("[Step 3] ❌ Validation FAILED with", errorIssues.length, "errors:");
      errorIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.type}] ${issue.message}`);
        if (issue.suggestion) console.log(`     Suggestion: ${issue.suggestion}`);
      });

      // Add validation trace for this failed attempt
      agentTraces.push(validationResult.trace);
    }

    // All retries exhausted
    console.error("[Step 2-3] ❌ All retries exhausted. Final errors:", validationErrors);
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
