import type Anthropic from "@anthropic-ai/sdk";
import type { AgentName, AgentTrace, WarehouseDialect } from "@heydata/shared";

/**
 * Shared context passed to all agents in the pipeline
 */
export interface AgentContext {
  /** Unique identifier for this request */
  requestId: string;
  /** Anthropic client instance */
  client: Anthropic;
  /** Model to use for LLM calls */
  model: string;
  /** Target warehouse dialect */
  dialect: WarehouseDialect;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result wrapper for agent outputs with tracing
 */
export interface AgentResult<T> {
  /** The result data from the agent */
  data: T;
  /** Execution trace for observability */
  trace: AgentTrace;
}

/**
 * Configuration for creating agent traces
 */
export interface TraceConfig {
  agent: AgentName;
  model: string;
  startedAt: Date;
  inputTokens?: number;
  outputTokens?: number;
  retryCount?: number;
}

/**
 * Creates a successful agent trace
 */
export function createSuccessTrace(config: TraceConfig): AgentTrace {
  const completedAt = new Date();
  return {
    agent: config.agent,
    startedAt: config.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - config.startedAt.getTime(),
    inputTokens: config.inputTokens ?? 0,
    outputTokens: config.outputTokens ?? 0,
    model: config.model,
    success: true,
    retryCount: config.retryCount,
  };
}

/**
 * Creates a failed agent trace
 */
export function createErrorTrace(
  config: TraceConfig,
  error: Error,
): AgentTrace {
  const completedAt = new Date();
  return {
    agent: config.agent,
    startedAt: config.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - config.startedAt.getTime(),
    inputTokens: config.inputTokens ?? 0,
    outputTokens: config.outputTokens ?? 0,
    model: config.model,
    success: false,
    error: error.message,
    retryCount: config.retryCount,
  };
}

/**
 * Extracts token usage from Anthropic API response
 */
export function extractTokenUsage(response: Anthropic.Message): {
  inputTokens: number;
  outputTokens: number;
} {
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Base interface for agent inputs
 */
export interface AgentInput {
  context: AgentContext;
}

/**
 * Type for async agent functions
 */
export type AgentFunction<TInput extends AgentInput, TOutput> = (
  input: TInput,
) => Promise<AgentResult<TOutput>>;
