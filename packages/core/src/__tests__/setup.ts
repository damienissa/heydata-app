import { vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "../types.js";

/**
 * Create a mock Anthropic message response
 */
export function createMockMessage(
  content: string,
  inputTokens = 100,
  outputTokens = 50,
): Anthropic.Message {
  return {
    id: "msg_mock_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: content,
        citations: null,
      },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

/**
 * Create a mock Anthropic client
 */
export function createMockClient(
  responseContent: string,
): { client: Anthropic; createSpy: ReturnType<typeof vi.fn> } {
  const createSpy = vi.fn().mockResolvedValue(createMockMessage(responseContent));

  const mockClient = {
    messages: {
      create: createSpy,
    },
  } as unknown as Anthropic;

  return { client: mockClient, createSpy };
}

/**
 * Create a mock agent context
 */
export function createMockContext(
  client: Anthropic,
  overrides: Partial<AgentContext> = {},
): AgentContext {
  return {
    requestId: "test_req_123",
    client,
    model: "claude-sonnet-4-20250514",
    dialect: "postgresql",
    ...overrides,
  };
}
