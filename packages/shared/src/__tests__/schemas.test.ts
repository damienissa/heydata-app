import { describe, expect, it } from "vitest";
import {
  MetricDefinitionSchema,
  DimensionDefinitionSchema,
  EntityRelationshipSchema,
  SemanticMetadataSchema,
  IntentObjectSchema,
  FilterClauseSchema,
  TimeRangeSchema,
  SessionContextSchema,
  ResultSetSchema,
  EnrichedResultSetSchema,
  ColumnStatsSchema,
  DataQualityFlagSchema,
  InsightAnnotationSchema,
  VisualizationSpecSchema,
  SeriesConfigSchema,
  AgentTraceSchema,
  GeneratedSQLSchema,
  OrchestratorTraceSchema,
  OrchestratorResponseSchema,
  HeyDataErrorCodeSchema,
  HeyDataErrorSchema,
  SqlValidationIssueSchema,
  ValidationResultSchema,
  HeyDataError,
} from "../index.js";

// ── Semantic types ────────────────────────────────────────────────

describe("MetricDefinitionSchema", () => {
  const valid = {
    name: "daily_revenue",
    displayName: "Daily Revenue",
    description: "Total revenue per day, net of refunds",
    formula: "SUM(orders.gross_amount) - SUM(refunds.amount)",
    grain: "daily",
    dimensions: ["date", "region", "product_category"],
    synonyms: ["revenue", "sales"],
    formatting: { type: "currency", currencyCode: "USD", decimalPlaces: 2 },
  };

  it("accepts a valid metric definition", () => {
    expect(MetricDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing required fields", () => {
    expect(() => MetricDefinitionSchema.parse({ name: "x" })).toThrow();
  });

  it("rejects invalid grain", () => {
    expect(() => MetricDefinitionSchema.parse({ ...valid, grain: "minute" })).toThrow();
  });
});

describe("DimensionDefinitionSchema", () => {
  const valid = {
    name: "region",
    displayName: "Region",
    description: "Geographic region",
    table: "customers",
    column: "region",
    type: "string",
  };

  it("accepts a valid dimension", () => {
    expect(DimensionDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid type", () => {
    expect(() => DimensionDefinitionSchema.parse({ ...valid, type: "array" })).toThrow();
  });
});

describe("EntityRelationshipSchema", () => {
  const valid = {
    from: { table: "orders", column: "customer_id" },
    to: { table: "customers", column: "id" },
    type: "one-to-many",
  };

  it("accepts a valid relationship", () => {
    expect(EntityRelationshipSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing 'to' field", () => {
    expect(() =>
      EntityRelationshipSchema.parse({ from: { table: "a", column: "b" }, type: "one-to-one" }),
    ).toThrow();
  });
});

describe("SemanticMetadataSchema", () => {
  it("accepts a full semantic metadata object", () => {
    const result = SemanticMetadataSchema.parse({
      metrics: [
        {
          name: "revenue",
          displayName: "Revenue",
          description: "Total revenue",
          formula: "SUM(amount)",
          dimensions: ["date"],
        },
      ],
      dimensions: [
        {
          name: "date",
          displayName: "Date",
          description: "Order date",
          table: "orders",
          column: "created_at",
          type: "date",
        },
      ],
      relationships: [],
    });
    expect(result.metrics).toHaveLength(1);
  });
});

// ── Intent types ──────────────────────────────────────────────────

describe("IntentObjectSchema", () => {
  const valid = {
    queryType: "trend",
    metrics: ["daily_revenue"],
    dimensions: ["date"],
    filters: [],
    timeRange: { start: "2024-01-01", end: "2024-01-31", grain: "daily" },
    comparisonMode: "month_over_month",
    isFollowUp: false,
    clarificationNeeded: false,
    confidence: 0.95,
  };

  it("accepts a valid intent object", () => {
    expect(IntentObjectSchema.parse(valid)).toEqual(valid);
  });

  it("requires at least one metric", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, metrics: [] })).toThrow();
  });

  it("rejects confidence > 1", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, confidence: 1.5 })).toThrow();
  });

  it("rejects invalid query type", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, queryType: "invalid" })).toThrow();
  });
});

describe("FilterClauseSchema", () => {
  it("accepts string value filter", () => {
    expect(
      FilterClauseSchema.parse({ dimension: "region", operator: "eq", value: "US" }),
    ).toBeTruthy();
  });

  it("accepts array value for 'in' operator", () => {
    expect(
      FilterClauseSchema.parse({ dimension: "status", operator: "in", value: ["active", "pending"] }),
    ).toBeTruthy();
  });

  it("rejects invalid operator", () => {
    expect(() =>
      FilterClauseSchema.parse({ dimension: "x", operator: "contains", value: "y" }),
    ).toThrow();
  });
});

describe("TimeRangeSchema", () => {
  it("accepts a valid time range", () => {
    expect(TimeRangeSchema.parse({ start: "2024-01-01", end: "2024-12-31" })).toBeTruthy();
  });
});

describe("SessionContextSchema", () => {
  it("accepts a valid session context", () => {
    const result = SessionContextSchema.parse({
      sessionId: "session-123",
      turns: [{ role: "user", content: "Show revenue", timestamp: "2024-01-01T00:00:00Z" }],
      activeMetrics: ["revenue"],
      activeDimensions: [],
      activeFilters: [],
    });
    expect(result.turns).toHaveLength(1);
  });
});

// ── Result types ──────────────────────────────────────────────────

describe("ResultSetSchema", () => {
  const valid = {
    columns: [
      { name: "date", type: "date", semanticRole: "time" },
      { name: "revenue", type: "number", semanticRole: "metric" },
    ],
    rows: [
      { date: "2024-01-01", revenue: 1000 },
      { date: "2024-01-02", revenue: 1200 },
    ],
    rowCount: 2,
    truncated: false,
    executionTimeMs: 150,
  };

  it("accepts a valid result set", () => {
    expect(ResultSetSchema.parse(valid)).toEqual(valid);
  });

  it("rejects negative row count", () => {
    expect(() => ResultSetSchema.parse({ ...valid, rowCount: -1 })).toThrow();
  });
});

describe("ColumnStatsSchema", () => {
  it("accepts valid column stats", () => {
    expect(
      ColumnStatsSchema.parse({
        column: "revenue",
        min: 100,
        max: 5000,
        mean: 2500,
        nullCount: 0,
        distinctCount: 30,
      }),
    ).toBeTruthy();
  });
});

describe("DataQualityFlagSchema", () => {
  it("accepts a valid quality flag", () => {
    expect(
      DataQualityFlagSchema.parse({
        type: "missing_values",
        severity: "warning",
        column: "revenue",
        message: "3 missing values found",
        affectedRows: 3,
      }),
    ).toBeTruthy();
  });

  it("rejects invalid type", () => {
    expect(() =>
      DataQualityFlagSchema.parse({ type: "bad_type", severity: "info", message: "x" }),
    ).toThrow();
  });
});

describe("InsightAnnotationSchema", () => {
  it("accepts a valid insight annotation", () => {
    expect(
      InsightAnnotationSchema.parse({
        type: "trend",
        message: "Revenue is up 12% month-over-month",
        metric: "revenue",
        significance: "high",
      }),
    ).toBeTruthy();
  });
});

describe("EnrichedResultSetSchema", () => {
  it("extends ResultSet with insights and quality flags", () => {
    const result = EnrichedResultSetSchema.parse({
      columns: [{ name: "revenue", type: "number" }],
      rows: [{ revenue: 1000 }],
      rowCount: 1,
      truncated: false,
      executionTimeMs: 50,
      qualityFlags: [],
      insights: [{ type: "summary_stat", message: "Average revenue: 1000" }],
    });
    expect(result.insights).toHaveLength(1);
  });
});

// ── Visualization types ───────────────────────────────────────────

describe("VisualizationSpecSchema", () => {
  const valid = {
    chartType: "line",
    title: "Daily Revenue Trend",
    xAxis: { dataKey: "date", type: "datetime" },
    yAxis: { dataKey: "revenue", label: "Revenue ($)" },
    series: [{ dataKey: "revenue", name: "Revenue", color: "#3b82f6" }],
    legend: { show: true, position: "bottom" },
  };

  it("accepts a valid visualization spec", () => {
    expect(VisualizationSpecSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid chart type", () => {
    expect(() => VisualizationSpecSchema.parse({ ...valid, chartType: "pie" })).toThrow();
  });

  it("accepts a KPI spec", () => {
    expect(
      VisualizationSpecSchema.parse({
        chartType: "kpi",
        series: [],
        kpiValue: "$125,000",
        kpiLabel: "Total Revenue",
      }),
    ).toBeTruthy();
  });
});

describe("SeriesConfigSchema", () => {
  it("accepts a series with yAxisId", () => {
    expect(
      SeriesConfigSchema.parse({ dataKey: "revenue", yAxisId: "left", type: "bar" }),
    ).toBeTruthy();
  });
});

// ── Agent types ───────────────────────────────────────────────────

describe("AgentTraceSchema", () => {
  const valid = {
    agent: "sql_generator",
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:00:02Z",
    durationMs: 2000,
    inputTokens: 500,
    outputTokens: 200,
    model: "claude-sonnet-4-6",
    success: true,
  };

  it("accepts a valid agent trace", () => {
    expect(AgentTraceSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid agent name", () => {
    expect(() => AgentTraceSchema.parse({ ...valid, agent: "unknown" })).toThrow();
  });
});

describe("GeneratedSQLSchema", () => {
  it("accepts valid generated SQL", () => {
    expect(
      GeneratedSQLSchema.parse({
        sql: "SELECT date, SUM(amount) FROM orders GROUP BY date",
        dialect: "postgresql",
        tablesTouched: ["orders"],
        estimatedComplexity: "low",
      }),
    ).toBeTruthy();
  });

  it("rejects empty SQL string", () => {
    expect(() =>
      GeneratedSQLSchema.parse({ sql: "", dialect: "postgresql", tablesTouched: [] }),
    ).toThrow();
  });
});

describe("OrchestratorTraceSchema", () => {
  it("accepts a valid orchestrator trace", () => {
    expect(
      OrchestratorTraceSchema.parse({
        requestId: "req-123",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:00:10Z",
        totalDurationMs: 10000,
        agentTraces: [],
        totalInputTokens: 1000,
        totalOutputTokens: 500,
      }),
    ).toBeTruthy();
  });
});

describe("OrchestratorResponseSchema", () => {
  it("accepts a valid orchestrator response with clarification", () => {
    const result = OrchestratorResponseSchema.parse({
      requestId: "req-123",
      intent: {
        queryType: "aggregation",
        metrics: ["revenue"],
        dimensions: [],
        filters: [],
        isFollowUp: false,
        clarificationNeeded: true,
        clarificationQuestion: "Which region did you mean?",
        confidence: 0.6,
      },
      trace: {
        requestId: "req-123",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:00:05Z",
        totalDurationMs: 5000,
        agentTraces: [],
        totalInputTokens: 300,
        totalOutputTokens: 100,
      },
      clarificationQuestion: "Which region did you mean?",
    });
    expect(result.clarificationQuestion).toBe("Which region did you mean?");
  });
});

// ── Error types ───────────────────────────────────────────────────

describe("HeyDataErrorCodeSchema", () => {
  it("accepts valid error codes", () => {
    expect(HeyDataErrorCodeSchema.parse("SQL_GENERATION_FAILED")).toBe("SQL_GENERATION_FAILED");
    expect(HeyDataErrorCodeSchema.parse("QUERY_TIMEOUT")).toBe("QUERY_TIMEOUT");
  });

  it("rejects unknown error code", () => {
    expect(() => HeyDataErrorCodeSchema.parse("UNKNOWN_CODE")).toThrow();
  });
});

describe("HeyDataError", () => {
  it("creates an error with code and message", () => {
    const error = new HeyDataError("SQL_GENERATION_FAILED", "Failed to generate SQL");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HeyDataError);
    expect(error.code).toBe("SQL_GENERATION_FAILED");
    expect(error.message).toBe("Failed to generate SQL");
    expect(error.name).toBe("HeyDataError");
  });

  it("includes agent and details", () => {
    const error = new HeyDataError("AGENT_ERROR", "Agent failed", {
      agent: "sql_validator",
      details: { retries: 3 },
    });
    expect(error.agent).toBe("sql_validator");
    expect(error.details).toEqual({ retries: 3 });
  });

  it("supports cause chaining", () => {
    const cause = new Error("connection reset");
    const error = new HeyDataError("CONNECTION_FAILED", "DB connection failed", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("HeyDataErrorSchema (serialized)", () => {
  it("validates a serialized error", () => {
    expect(
      HeyDataErrorSchema.parse({
        name: "HeyDataError",
        code: "QUERY_TIMEOUT",
        message: "Query timed out after 30s",
        agent: "sql_generator",
      }),
    ).toBeTruthy();
  });

  it("rejects wrong name", () => {
    expect(() =>
      HeyDataErrorSchema.parse({
        name: "TypeError",
        code: "QUERY_TIMEOUT",
        message: "x",
      }),
    ).toThrow();
  });
});

describe("SqlValidationIssueSchema", () => {
  it("accepts a valid issue", () => {
    expect(
      SqlValidationIssueSchema.parse({
        type: "syntax",
        severity: "error",
        message: "Unexpected token near 'FROM'",
        line: 3,
      }),
    ).toBeTruthy();
  });

  it("rejects invalid severity", () => {
    expect(() =>
      SqlValidationIssueSchema.parse({ type: "syntax", severity: "critical", message: "x" }),
    ).toThrow();
  });
});

describe("ValidationResultSchema", () => {
  it("accepts valid result", () => {
    expect(
      ValidationResultSchema.parse({
        valid: true,
        issues: [],
        confidence: 0.98,
      }),
    ).toBeTruthy();
  });

  it("accepts result with issues", () => {
    const result = ValidationResultSchema.parse({
      valid: false,
      issues: [
        { type: "performance", severity: "warning", message: "Full table scan detected" },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});
