import { describe, expect, it } from "vitest";
import {
  SemanticMetadataSchema,
  IntentObjectSchema,
  AdHocMetricSchema,
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
  ChartConfigSchema,
  PieConfigSchema,
  FunnelConfigSchema,
  RadarConfigSchema,
  TreemapConfigSchema,
  WaterfallConfigSchema,
  HistogramConfigSchema,
  GaugeConfigSchema,
  HeatmapConfigSchema,
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

describe("SemanticMetadataSchema", () => {
  it("accepts a Markdown semantic layer", () => {
    const md = "# Semantic Layer\n\n## Overview\nThis database powers analytics.\n";
    const result = SemanticMetadataSchema.parse({ semanticMarkdown: md });
    expect(result.semanticMarkdown).toBe(md);
  });

  it("accepts rawSchemaDDL when provided", () => {
    const result = SemanticMetadataSchema.parse({
      semanticMarkdown: "# Semantic Layer\n",
      rawSchemaDDL: "orders(id uuid PK, amount numeric, created_at timestamptz)",
    });
    expect(result.rawSchemaDDL).toBe("orders(id uuid PK, amount numeric, created_at timestamptz)");
  });

  it("rejects missing semanticMarkdown", () => {
    expect(() => SemanticMetadataSchema.parse({})).toThrow();
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

  it("requires at least one predefined or ad-hoc metric", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, metrics: [] })).toThrow();
  });

  it("accepts ad-hoc metrics when predefined metrics are empty", () => {
    const result = IntentObjectSchema.parse({
      ...valid,
      metrics: [],
      adHocMetrics: [
        {
          name: "avg_session_duration",
          displayName: "Avg Session Duration",
          formula: "AVG(sessions.duration_seconds)",
          tables: ["sessions"],
        },
      ],
    });
    expect(result.metrics).toEqual([]);
    expect(result.adHocMetrics).toHaveLength(1);
    expect(result.adHocMetrics[0].name).toBe("avg_session_duration");
  });

  it("accepts both predefined and ad-hoc metrics", () => {
    const result = IntentObjectSchema.parse({
      ...valid,
      adHocMetrics: [
        {
          name: "custom_metric",
          displayName: "Custom Metric",
          formula: "COUNT(events.id)",
          tables: ["events"],
          description: "Total events",
        },
      ],
    });
    expect(result.metrics).toHaveLength(1);
    expect(result.adHocMetrics).toHaveLength(1);
  });

  it("defaults adHocMetrics to empty array when not provided", () => {
    const result = IntentObjectSchema.parse(valid);
    expect(result.adHocMetrics).toEqual([]);
  });

  it("rejects confidence > 1", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, confidence: 1.5 })).toThrow();
  });

  it("rejects invalid query type", () => {
    expect(() => IntentObjectSchema.parse({ ...valid, queryType: "invalid" })).toThrow();
  });
});

describe("AdHocMetricSchema", () => {
  const valid = {
    name: "avg_session_duration",
    displayName: "Avg Session Duration",
    formula: "AVG(sessions.duration_seconds)",
    tables: ["sessions"],
    description: "Average session duration in seconds",
  };

  it("accepts a valid ad-hoc metric", () => {
    expect(AdHocMetricSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing formula", () => {
    expect(() =>
      AdHocMetricSchema.parse({ name: "x", displayName: "X", tables: ["t"] }),
    ).toThrow();
  });

  it("rejects empty tables array", () => {
    expect(() =>
      AdHocMetricSchema.parse({ ...valid, tables: [] }),
    ).toThrow();
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
      FilterClauseSchema.parse({ dimension: "x", operator: "invalid_op", value: "y" }),
    ).toThrow();
  });

  it("coerces LLM-friendly operator aliases to canonical form", () => {
    expect(
      FilterClauseSchema.parse({ dimension: "status", operator: "equals", value: "active" }),
    ).toEqual({ dimension: "status", operator: "eq", value: "active" });
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
    expect(() => VisualizationSpecSchema.parse({ ...valid, chartType: "unknown_type" })).toThrow();
  });

  it("accepts pie chart type", () => {
    expect(
      VisualizationSpecSchema.parse({
        chartType: "pie",
        title: "Revenue by Region",
        series: [],
        chartConfig: { type: "pie", nameKey: "region", valueKey: "revenue" },
      }),
    ).toBeTruthy();
  });

  it("accepts donut chart type", () => {
    expect(
      VisualizationSpecSchema.parse({
        chartType: "donut",
        title: "Market Share",
        series: [],
        chartConfig: { type: "donut", nameKey: "company", valueKey: "share", innerRadius: "60%" },
      }),
    ).toBeTruthy();
  });

  it("accepts all new chart types", () => {
    const newTypes = ["pie", "donut", "funnel", "radar", "treemap", "waterfall", "histogram", "gauge", "heatmap"];
    for (const chartType of newTypes) {
      expect(() => VisualizationSpecSchema.parse({ chartType, series: [] })).not.toThrow();
    }
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

// ── Chart Config types ───────────────────────────────────────────

describe("PieConfigSchema", () => {
  it("accepts a valid pie config", () => {
    expect(PieConfigSchema.parse({ type: "pie", nameKey: "region", valueKey: "revenue" })).toBeTruthy();
  });

  it("accepts a donut config with innerRadius", () => {
    expect(
      PieConfigSchema.parse({ type: "donut", nameKey: "category", valueKey: "amount", innerRadius: "60%", labelType: "percent" }),
    ).toBeTruthy();
  });

  it("rejects missing nameKey", () => {
    expect(() => PieConfigSchema.parse({ type: "pie", valueKey: "revenue" })).toThrow();
  });
});

describe("FunnelConfigSchema", () => {
  it("accepts a valid funnel config", () => {
    expect(FunnelConfigSchema.parse({ type: "funnel", nameKey: "stage", valueKey: "count" })).toBeTruthy();
  });

  it("accepts reversed funnel", () => {
    expect(FunnelConfigSchema.parse({ type: "funnel", nameKey: "stage", valueKey: "count", reversed: true })).toBeTruthy();
  });
});

describe("RadarConfigSchema", () => {
  it("accepts a valid radar config", () => {
    expect(RadarConfigSchema.parse({ type: "radar", angleKey: "skill" })).toBeTruthy();
  });

  it("accepts with radiusLabel", () => {
    expect(RadarConfigSchema.parse({ type: "radar", angleKey: "dimension", radiusLabel: "Score" })).toBeTruthy();
  });
});

describe("TreemapConfigSchema", () => {
  it("accepts a valid treemap config", () => {
    expect(TreemapConfigSchema.parse({ type: "treemap", nameKey: "department", sizeKey: "budget" })).toBeTruthy();
  });

  it("accepts with colorKey", () => {
    expect(TreemapConfigSchema.parse({ type: "treemap", nameKey: "dept", sizeKey: "budget", colorKey: "growth" })).toBeTruthy();
  });
});

describe("WaterfallConfigSchema", () => {
  it("accepts a valid waterfall config", () => {
    expect(WaterfallConfigSchema.parse({ type: "waterfall", categoryKey: "item", valueKey: "amount" })).toBeTruthy();
  });

  it("accepts with colors and totalLabel", () => {
    expect(
      WaterfallConfigSchema.parse({
        type: "waterfall",
        categoryKey: "item",
        valueKey: "amount",
        totalLabel: "Total",
        positiveColor: "#16a34a",
        negativeColor: "#dc2626",
        totalColor: "#2563eb",
      }),
    ).toBeTruthy();
  });
});

describe("HistogramConfigSchema", () => {
  it("accepts a valid histogram config", () => {
    expect(HistogramConfigSchema.parse({ type: "histogram", valueKey: "duration" })).toBeTruthy();
  });

  it("accepts with binCount", () => {
    expect(HistogramConfigSchema.parse({ type: "histogram", valueKey: "age", binCount: 20 })).toBeTruthy();
  });

  it("rejects binCount < 2", () => {
    expect(() => HistogramConfigSchema.parse({ type: "histogram", valueKey: "x", binCount: 1 })).toThrow();
  });
});

describe("GaugeConfigSchema", () => {
  it("accepts a valid gauge config", () => {
    expect(GaugeConfigSchema.parse({ type: "gauge", valueKey: "completion" })).toBeTruthy();
  });

  it("accepts with thresholds and target", () => {
    expect(
      GaugeConfigSchema.parse({
        type: "gauge",
        valueKey: "utilization",
        min: 0,
        max: 100,
        target: 80,
        unit: "%",
        thresholds: [
          { value: 50, color: "#dc2626", label: "Low" },
          { value: 80, color: "#ca8a04", label: "Medium" },
          { value: 100, color: "#16a34a", label: "High" },
        ],
      }),
    ).toBeTruthy();
  });
});

describe("HeatmapConfigSchema", () => {
  it("accepts a valid heatmap config", () => {
    expect(HeatmapConfigSchema.parse({ type: "heatmap", xKey: "hour", yKey: "day", valueKey: "count" })).toBeTruthy();
  });

  it("accepts with colorScale and showValues", () => {
    expect(
      HeatmapConfigSchema.parse({
        type: "heatmap",
        xKey: "hour",
        yKey: "day",
        valueKey: "activity",
        colorScale: "diverging",
        showValues: true,
      }),
    ).toBeTruthy();
  });
});

describe("ChartConfigSchema (discriminated union)", () => {
  it("routes to correct schema based on type", () => {
    expect(ChartConfigSchema.parse({ type: "pie", nameKey: "a", valueKey: "b" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "funnel", nameKey: "a", valueKey: "b" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "radar", angleKey: "a" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "treemap", nameKey: "a", sizeKey: "b" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "waterfall", categoryKey: "a", valueKey: "b" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "histogram", valueKey: "a" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "gauge", valueKey: "a" })).toBeTruthy();
    expect(ChartConfigSchema.parse({ type: "heatmap", xKey: "a", yKey: "b", valueKey: "c" })).toBeTruthy();
  });

  it("rejects unknown type", () => {
    expect(() => ChartConfigSchema.parse({ type: "unknown", nameKey: "a" })).toThrow();
  });
});
