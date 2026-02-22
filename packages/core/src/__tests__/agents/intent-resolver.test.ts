import { describe, it, expect, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { resolveIntent } from "../../agents/intent-resolver.js";
import { mockSemanticMetadata } from "../../mocks/semantic.mock.js";
import { createMockClient, createMockContext } from "../setup.js";
import type { IntentObject } from "@heydata/shared";

describe("Intent Resolver Agent", () => {
  let mockClient: Anthropic;

  const validIntentResponse: IntentObject = {
    queryType: "trend",
    metrics: ["revenue"],
    dimensions: ["date"],
    filters: [],
    timeRange: {
      start: "2024-01-01",
      end: "2024-01-31",
    },
    comparisonMode: "none",
    isFollowUp: false,
    clarificationNeeded: false,
    confidence: 0.95,
  };

  beforeEach(() => {
    const { client } = createMockClient(JSON.stringify(validIntentResponse));
    mockClient = client;
  });

  it("should resolve a simple question into an intent object", async () => {
    const context = createMockContext(mockClient);

    const result = await resolveIntent({
      context,
      question: "Show me revenue for last month",
      semanticMetadata: mockSemanticMetadata,
    });

    expect(result.data).toMatchObject({
      queryType: "trend",
      metrics: ["revenue"],
      dimensions: ["date"],
      isFollowUp: false,
      clarificationNeeded: false,
    });
    expect(result.trace.agent).toBe("intent_resolver");
    expect(result.trace.success).toBe(true);
  });

  it("should handle JSON wrapped in markdown code blocks", async () => {
    const wrappedResponse = "```json\n" + JSON.stringify(validIntentResponse) + "\n```";
    const { client } = createMockClient(wrappedResponse);
    const context = createMockContext(client);

    const result = await resolveIntent({
      context,
      question: "Show me revenue trends",
      semanticMetadata: mockSemanticMetadata,
    });

    expect(result.data.queryType).toBe("trend");
    expect(result.trace.success).toBe(true);
  });

  it("should include session context in follow-up questions", async () => {
    const { client, createSpy } = createMockClient(
      JSON.stringify({ ...validIntentResponse, isFollowUp: true }),
    );
    const context = createMockContext(client);

    await resolveIntent({
      context,
      question: "Break that down by region",
      sessionContext: {
        sessionId: "session_123",
        turns: [
          {
            role: "user",
            content: "Show me revenue",
            timestamp: new Date().toISOString(),
          },
          {
            role: "assistant",
            content: "Here is the revenue data...",
            timestamp: new Date().toISOString(),
          },
        ],
        activeMetrics: ["revenue"],
        activeDimensions: [],
        activeFilters: [],
      },
      semanticMetadata: mockSemanticMetadata,
    });

    // Verify the user message includes conversation context
    const callArgs = createSpy.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    expect(callArgs.messages[0]?.content).toContain("Previous conversation");
    expect(callArgs.messages[0]?.content).toContain("Show me revenue");
  });

  it("should track token usage in trace", async () => {
    const context = createMockContext(mockClient);

    const result = await resolveIntent({
      context,
      question: "Show me order count",
      semanticMetadata: mockSemanticMetadata,
    });

    expect(result.trace.inputTokens).toBeGreaterThan(0);
    expect(result.trace.outputTokens).toBeGreaterThan(0);
    expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle clarification requests", async () => {
    const clarificationIntent: IntentObject = {
      queryType: "aggregation",
      metrics: ["revenue"], // At least one metric is required by schema
      dimensions: [],
      filters: [],
      comparisonMode: "none",
      isFollowUp: false,
      clarificationNeeded: true,
      clarificationQuestion: "Which metric would you like to see? Revenue, orders, or customers?",
      confidence: 0.3,
    };

    const { client } = createMockClient(JSON.stringify(clarificationIntent));
    const context = createMockContext(client);

    const result = await resolveIntent({
      context,
      question: "Show me the data",
      semanticMetadata: mockSemanticMetadata,
    });

    expect(result.data.clarificationNeeded).toBe(true);
    expect(result.data.clarificationQuestion).toBeDefined();
    expect(result.data.confidence).toBeLessThan(0.5);
  });

  it("should throw HeyDataError on invalid JSON response", async () => {
    const { client } = createMockClient("This is not valid JSON");
    const context = createMockContext(client);

    await expect(
      resolveIntent({
        context,
        question: "Show me revenue",
        semanticMetadata: mockSemanticMetadata,
      }),
    ).rejects.toMatchObject({
      code: "INTENT_UNRESOLVABLE",
    });
  });
});
