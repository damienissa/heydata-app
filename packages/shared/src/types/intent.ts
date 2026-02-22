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
  start: z.string().min(1),
  end: z.string().min(1),
  grain: z.enum(["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  rawExpression: z.string().optional(),
});

export type TimeRange = z.infer<typeof TimeRangeSchema>;

// Helper to validate timeRange - returns undefined if invalid
const validateTimeRange = (v: unknown): TimeRange | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;
  // Only valid if both start and end are non-empty strings
  if (typeof obj.start === "string" && obj.start.length > 0 &&
      typeof obj.end === "string" && obj.end.length > 0) {
    const result = TimeRangeSchema.safeParse(v);
    return result.success ? result.data : undefined;
  }
  return undefined;
};

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

type CanonicalOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "like" | "between";

const CANONICAL_OPERATORS: CanonicalOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "like", "between"];

const OPERATOR_MAP: Record<string, CanonicalOperator> = {
  equals: "eq",
  equal: "eq",
  "=": "eq",
  not_equals: "neq",
  "!=": "neq",
  "<>": "neq",
  not_contains: "not_in",
  greater_than: "gt",
  ">": "gt",
  less_than: "lt",
  "<": "lt",
  greater_than_or_equal: "gte",
  ">=": "gte",
  less_than_or_equal: "lte",
  "<=": "lte",
  contains: "like",
};

const FilterOperatorSchema = z
  .union([
    z.enum([
      "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "like", "between",
      "equals", "not_equals", "equal", "greater_than", "less_than",
      "greater_than_or_equal", "less_than_or_equal", "contains", "not_contains",
      ">=", "<=", ">", "<", "=", "!=", "<>",
    ]),
    z.unknown(), // Accept any LLM output, will be coerced below
  ])
  .transform((v) => {
    const str = String(v ?? "eq").toLowerCase().trim();
    const mapped = OPERATOR_MAP[str] ?? OPERATOR_MAP[v as string];
    if (mapped) return mapped;
    if (CANONICAL_OPERATORS.includes(str as CanonicalOperator)) return str as CanonicalOperator;
    return "eq";
  });

const FilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
  z.undefined(),
  z.null(),
]).transform((v) => {
  if (v === null || v === undefined) return "";
  return v;
});

export const FilterClauseSchema = z.object({
  dimension: z.union([z.string(), z.number()]).transform((v) => String(v ?? "")),
  operator: FilterOperatorSchema,
  value: FilterValueSchema,
});

export type FilterClause = z.infer<typeof FilterClauseSchema>;

// Coerce null/invalid to undefined for optional fields (LLM often returns null or partial objects)
const optionalTimeRange = z.unknown().transform(validateTimeRange);
const optionalComparisonMode = ComparisonModeSchema.optional()
  .nullable()
  .transform((v) => v ?? undefined);

// ── Intent Object ─────────────────────────────────────────────────

export const IntentObjectSchema = z.object({
  queryType: QueryTypeSchema,
  metrics: z.array(z.string()).min(1),
  dimensions: z
    .array(z.string())
    .optional()
    .nullable()
    .transform((v) => v ?? [])
    .default([]),
  filters: z
    .array(z.unknown())
    .optional()
    .nullable()
    .transform((v) => (v ?? []))
    .transform((arr) => {
      const result: z.infer<typeof FilterClauseSchema>[] = [];
      for (const item of arr) {
        const parsed = FilterClauseSchema.safeParse(item);
        if (parsed.success && parsed.data.dimension) result.push(parsed.data);
      }
      return result;
    })
    .default([]),
  timeRange: optionalTimeRange,
  comparisonMode: optionalComparisonMode.default("none"),
  sortBy: z
    .union([
      z.string(),
      z.record(z.string(), z.unknown()),
      z.array(z.union([z.string(), z.record(z.string(), z.unknown())])),
    ])
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      if (typeof v === "string") return v || undefined;
      if (Array.isArray(v)) {
        const first = v[0];
        if (typeof first === "string") return first || undefined;
        if (first && typeof first === "object") {
          const obj = first as Record<string, unknown>;
          const val =
            obj.dimension ?? obj.metric ?? obj.field ?? obj.column ?? obj.sortBy;
          return typeof val === "string" ? val : undefined;
        }
        return undefined;
      }
      const obj = v as Record<string, unknown>;
      const val =
        obj.dimension ?? obj.metric ?? obj.field ?? obj.column ?? obj.sortBy;
      return typeof val === "string" ? val : undefined;
    }),
  sortOrder: z.enum(["asc", "desc"]).optional().nullable().transform((v) => v ?? undefined),
  limit: z.number().int().positive().optional().nullable().transform((v) => v ?? undefined),
  isFollowUp: z.boolean().default(false),
  clarificationNeeded: z.boolean().default(false),
  clarificationQuestion: z.string().optional().nullable().transform((v) => v ?? undefined),
  confidence: z.number().min(0).max(1).default(0.9),
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
