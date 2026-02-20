import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { mockSemanticMetadata } from "../mocks/semantic.mock.js";
import type { ResultSet, IntentObject, GeneratedSQL, ValidationResult, InsightAnnotation, VisualizationSpec } from "@heydata/shared";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;
  let mockExecuteQuery: ReturnType<typeof vi.fn>;

  const mockResultSet: ResultSet = {
    columns: [
      { name: "date", type: "date", semanticRole: "time" },
      { name: "revenue", type: "number", semanticRole: "metric" },
    ],
    rows: [
      { date: "2024-01-01", revenue: 50000 },
      { date: "2024-01-02", revenue: 52000 },
      { date: "2024-01-03", revenue: 48000 },
    ],
    rowCount: 3,
    truncated: false,
    executionTimeMs: 50,
  };

  const mockIntentResponse: IntentObject = {
    queryType: "trend",
    metrics: ["revenue"],
    dimensions: ["date"],
    filters: [],
    timeRange: { start: "2024-01-01", end: "2024-01-31" },
    isFollowUp: false,
    clarificationNeeded: false,
    confidence: 0.95,
  };

  const mockSqlResponse: GeneratedSQL = {
    sql: "SELECT date, SUM(total_amount) as revenue FROM orders GROUP BY date",
    dialect: "postgresql",
    tablesTouched: ["orders"],
    estimatedComplexity: "low",
  };

  const mockValidationResponse: ValidationResult = {
    valid: true,
    issues: [],
    confidence: 0.98,
  };

  const mockInsightsResponse: { insights: InsightAnnotation[] } = {
    insights: [
      {
        type: "trend",
        message: "Revenue shows a stable trend with slight variations",
        metric: "revenue",
        significance: "medium",
      },
    ],
  };

  const mockVizResponse: VisualizationSpec = {
    chartType: "line",
    title: "Revenue Trend",
    xAxis: { dataKey: "date", type: "datetime" },
    yAxis: { dataKey: "revenue", type: "number" },
    series: [{ dataKey: "revenue", name: "Revenue" }],
  };

  const mockNarrativeResponse = "Revenue showed stable performance over the period.";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamic import to get the mocked module
    const AnthropicModule = await import("@anthropic-ai/sdk");
    const MockAnthropic = AnthropicModule.default as unknown as ReturnType<typeof vi.fn>;

    // Set up sequential responses for the pipeline
    let callCount = 0;
    const responses = [
      JSON.stringify(mockIntentResponse), // Intent resolver
      JSON.stringify(mockSqlResponse), // SQL generator
      JSON.stringify(mockValidationResponse), // SQL validator
      JSON.stringify(mockInsightsResponse), // Data analyzer
      JSON.stringify(mockVizResponse), // Viz planner
      mockNarrativeResponse, // Narrative
    ];

    MockAnthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockImplementation(() => {
          const response = responses[callCount] ?? responses[responses.length - 1];
          callCount++;
          return Promise.resolve({
            id: `msg_${callCount}`,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: response }],
            model: "claude-sonnet-4-20250514",
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 50 },
          });
        }),
      },
    }));

    orchestrator = new Orchestrator({
      apiKey: "test-api-key",
      enableCache: false, // Disable cache for testing
    });

    mockExecuteQuery = vi.fn().mockResolvedValue(mockResultSet);
  });

  it("should process a question through the full pipeline", async () => {
    const result = await orchestrator.process({
      question: "Show me revenue trend for January",
      semanticMetadata: mockSemanticMetadata,
      executeQuery: mockExecuteQuery,
    });

    expect(result.requestId).toBeDefined();
    expect(result.intent).toBeDefined();
    expect(result.sql).toBeDefined();
    expect(result.results).toBeDefined();
    expect(result.visualization).toBeDefined();
    expect(result.narrative).toBeDefined();
    expect(result.trace).toBeDefined();
    expect(result.trace.agentTraces.length).toBeGreaterThan(0);
  });

  it("should return clarification when intent is ambiguous", async () => {
    const AnthropicModule = await import("@anthropic-ai/sdk");
    const MockAnthropic = AnthropicModule.default as unknown as ReturnType<typeof vi.fn>;

    const clarificationIntent: IntentObject = {
      queryType: "aggregation",
      metrics: ["revenue"], // At least one metric required by schema
      dimensions: [],
      filters: [],
      isFollowUp: false,
      clarificationNeeded: true,
      clarificationQuestion: "Which metric would you like to see?",
      confidence: 0.3,
    };

    MockAnthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: JSON.stringify(clarificationIntent) }],
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      },
    }));

    const newOrchestrator = new Orchestrator({
      apiKey: "test-api-key",
      enableCache: false,
    });

    const result = await newOrchestrator.process({
      question: "Show me the data",
      semanticMetadata: mockSemanticMetadata,
      executeQuery: mockExecuteQuery,
    });

    expect(result.clarificationQuestion).toBeDefined();
    expect(result.sql).toBeUndefined();
    expect(result.results).toBeUndefined();
  });

  it("should include all agent traces in the response", async () => {
    const result = await orchestrator.process({
      question: "Show me revenue",
      semanticMetadata: mockSemanticMetadata,
      executeQuery: mockExecuteQuery,
    });

    const agentNames = result.trace.agentTraces.map((t) => t.agent);

    // Should have traces for all agents in the pipeline
    expect(agentNames).toContain("intent_resolver");
    expect(agentNames).toContain("sql_generator");
    expect(agentNames).toContain("sql_validator");
    expect(agentNames).toContain("data_validator");
    expect(agentNames).toContain("data_analyzer");
    expect(agentNames).toContain("viz_planner");
    expect(agentNames).toContain("narrative");
  });

  it("should track total token usage", async () => {
    const result = await orchestrator.process({
      question: "Show me revenue",
      semanticMetadata: mockSemanticMetadata,
      executeQuery: mockExecuteQuery,
    });

    expect(result.trace.totalInputTokens).toBeGreaterThan(0);
    expect(result.trace.totalOutputTokens).toBeGreaterThan(0);
    expect(result.trace.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should call executeQuery with generated SQL", async () => {
    await orchestrator.process({
      question: "Show me revenue",
      semanticMetadata: mockSemanticMetadata,
      executeQuery: mockExecuteQuery,
    });

    expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
  });
});

describe("Orchestrator Cache", () => {
  it("should cache responses when enabled", async () => {
    const AnthropicModule = await import("@anthropic-ai/sdk");
    const MockAnthropic = AnthropicModule.default as unknown as ReturnType<typeof vi.fn>;

    let callCount = 0;
    MockAnthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockImplementation(() => {
          callCount++;
          const responses = [
            JSON.stringify({
              queryType: "trend",
              metrics: ["revenue"],
              dimensions: ["date"],
              filters: [],
              isFollowUp: false,
              clarificationNeeded: false,
              confidence: 0.95,
            }),
            JSON.stringify({
              sql: "SELECT 1",
              dialect: "postgresql",
              tablesTouched: ["orders"],
            }),
            JSON.stringify({ valid: true, issues: [], confidence: 0.98 }),
            JSON.stringify({ insights: [] }),
            JSON.stringify({ chartType: "line", series: [] }),
            "Summary text",
          ];
          return Promise.resolve({
            id: `msg_${callCount}`,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: responses[(callCount - 1) % responses.length] }],
            model: "claude-sonnet-4-20250514",
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 50 },
          });
        }),
      },
    }));

    const orchestrator = new Orchestrator({
      apiKey: "test-api-key",
      enableCache: true,
    });

    const mockResultSet: ResultSet = {
      columns: [{ name: "value", type: "number" }],
      rows: [{ value: 1 }],
      rowCount: 1,
      truncated: false,
      executionTimeMs: 10,
    };

    const executeQuery = vi.fn().mockResolvedValue(mockResultSet);

    // First call
    const result1 = await orchestrator.process({
      question: "Show me revenue",
      semanticMetadata: mockSemanticMetadata,
      executeQuery,
    });

    const callsBeforeCache = callCount;

    // Second call with same question - should use cache
    const result2 = await orchestrator.process({
      question: "Show me revenue",
      semanticMetadata: mockSemanticMetadata,
      executeQuery,
    });

    // No additional API calls should have been made
    expect(callCount).toBe(callsBeforeCache);
    expect(result1.requestId).toBe(result2.requestId);

    // Cache stats should show 1 entry
    expect(orchestrator.getCacheStats().size).toBe(1);
  });
});
