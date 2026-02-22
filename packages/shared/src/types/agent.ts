import { z } from "zod";
import { IntentObjectSchema } from "./intent.js";
import { EnrichedResultSetSchema } from "./result.js";
import { VisualizationSpecSchema } from "./visualization.js";

// ── Agent Name ────────────────────────────────────────────────────

export const AgentNameSchema = z.enum([
  "orchestrator",
  "intent_resolver",
  "sql_generator",
  "sql_validator",
  "data_validator",
  "data_analyzer",
  "viz_planner",
  "narrative",
  "semantic_generator",
]);

export type AgentName = z.infer<typeof AgentNameSchema>;

// ── Warehouse Dialect ─────────────────────────────────────────────

export const WarehouseDialectSchema = z.enum([
  "postgresql",
  "bigquery",
  "snowflake",
  "redshift",
  "databricks",
]);

export type WarehouseDialect = z.infer<typeof WarehouseDialectSchema>;

// ── Agent Trace ───────────────────────────────────────────────────

export const AgentTraceSchema = z.object({
  agent: AgentNameSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  model: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  retryCount: z.number().int().min(0).optional(),
});

export type AgentTrace = z.infer<typeof AgentTraceSchema>;

// ── Generated SQL ─────────────────────────────────────────────────

export const GeneratedSQLSchema = z.object({
  sql: z.string().min(1),
  dialect: WarehouseDialectSchema,
  tablesTouched: z.array(z.string()),
  estimatedComplexity: z.enum(["low", "medium", "high"]).optional(),
});

export type GeneratedSQL = z.infer<typeof GeneratedSQLSchema>;

// ── Orchestrator Trace ────────────────────────────────────────────

export const OrchestratorTraceSchema = z.object({
  requestId: z.string().min(1),
  startedAt: z.string(),
  completedAt: z.string(),
  totalDurationMs: z.number().min(0),
  agentTraces: z.array(AgentTraceSchema),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
});

export type OrchestratorTrace = z.infer<typeof OrchestratorTraceSchema>;

// ── Orchestrator Response ─────────────────────────────────────────

export const OrchestratorResponseSchema = z.object({
  requestId: z.string().min(1),
  intent: IntentObjectSchema,
  sql: GeneratedSQLSchema.optional(),
  results: EnrichedResultSetSchema.optional(),
  visualization: VisualizationSpecSchema.optional(),
  narrative: z.string().optional(),
  trace: OrchestratorTraceSchema,
  clarificationQuestion: z.string().optional(),
});

export type OrchestratorResponse = z.infer<typeof OrchestratorResponseSchema>;
