import { z } from "zod";

// ── Query Type ────────────────────────────────────────────────────

export const QueryTypeSchema = z.enum([
  "trend",
  "comparison",
  "ranking",
  "anomaly",
  "drill_down",
  "aggregation",
  "distribution",
  "correlation",
]);

export type QueryType = z.infer<typeof QueryTypeSchema>;

// ── Time Range ────────────────────────────────────────────────────

export const TimeRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
  grain: z.enum(["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  rawExpression: z.string().optional(),
});

export type TimeRange = z.infer<typeof TimeRangeSchema>;

// ── Comparison Mode ───────────────────────────────────────────────

export const ComparisonModeSchema = z.enum([
  "none",
  "period_over_period",
  "year_over_year",
  "month_over_month",
  "week_over_week",
  "custom",
]);

export type ComparisonMode = z.infer<typeof ComparisonModeSchema>;

// ── Filter Clause ─────────────────────────────────────────────────

export const FilterClauseSchema = z.object({
  dimension: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "like", "between"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});

export type FilterClause = z.infer<typeof FilterClauseSchema>;

// ── Intent Object ─────────────────────────────────────────────────

export const IntentObjectSchema = z.object({
  queryType: QueryTypeSchema,
  metrics: z.array(z.string()).min(1),
  dimensions: z.array(z.string()),
  filters: z.array(FilterClauseSchema),
  timeRange: TimeRangeSchema.optional(),
  comparisonMode: ComparisonModeSchema.optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().optional(),
  isFollowUp: z.boolean(),
  clarificationNeeded: z.boolean(),
  clarificationQuestion: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type IntentObject = z.infer<typeof IntentObjectSchema>;

// ── Conversation Turn ─────────────────────────────────────────────

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
  intent: IntentObjectSchema.optional(),
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

// ── Session Context ───────────────────────────────────────────────

export const SessionContextSchema = z.object({
  sessionId: z.string().min(1),
  turns: z.array(ConversationTurnSchema),
  activeMetrics: z.array(z.string()),
  activeDimensions: z.array(z.string()),
  activeFilters: z.array(FilterClauseSchema),
});

export type SessionContext = z.infer<typeof SessionContextSchema>;
