import { z } from "zod";

// ── Error Codes ───────────────────────────────────────────────────

export const HeyDataErrorCodeSchema = z.enum([
  // Config errors
  "CONFIG_ERROR",

  // Intent errors
  "INTENT_AMBIGUOUS",
  "INTENT_UNRESOLVABLE",

  // SQL errors
  "SQL_GENERATION_FAILED",
  "SQL_VALIDATION_FAILED",
  "SQL_SYNTAX_ERROR",
  "SQL_FORBIDDEN_OPERATION",

  // Execution errors
  "QUERY_TIMEOUT",
  "QUERY_EXECUTION_FAILED",
  "CONNECTION_FAILED",

  // Data validation errors
  "DATA_VALIDATION_FAILED",
  "DATA_EMPTY_RESULT",
  "DATA_SCHEMA_MISMATCH",

  // Pipeline errors
  "MAX_RETRIES_EXCEEDED",
  "AGENT_ERROR",
  "ORCHESTRATION_ERROR",

  // Semantic layer errors
  "METRIC_NOT_FOUND",
  "DIMENSION_NOT_FOUND",
  "SEMANTIC_LOAD_ERROR",
  "SEMANTIC_GENERATION_FAILED",
]);

export type HeyDataErrorCode = z.infer<typeof HeyDataErrorCodeSchema>;

// ── HeyDataError class ────────────────────────────────────────────

export class HeyDataError extends Error {
  public readonly code: HeyDataErrorCode;
  public readonly agent?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: HeyDataErrorCode,
    message: string,
    options?: { agent?: string; details?: Record<string, unknown>; cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = "HeyDataError";
    this.code = code;
    this.agent = options?.agent;
    this.details = options?.details;
  }
}

// Companion schema for serialization / validation at API boundaries
export const HeyDataErrorSchema = z.object({
  name: z.literal("HeyDataError"),
  code: HeyDataErrorCodeSchema,
  message: z.string(),
  agent: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SerializedHeyDataError = z.infer<typeof HeyDataErrorSchema>;

// ── SQL Validation Issue ──────────────────────────────────────────

export const SqlValidationIssueSchema = z.object({
  type: z.enum(["syntax", "semantic", "performance", "security", "intent_mismatch"]),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  suggestion: z.string().nullish(),
  line: z.number().int().positive().nullish(),
});

export type SqlValidationIssue = z.infer<typeof SqlValidationIssueSchema>;

// ── Validation Result ─────────────────────────────────────────────

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(SqlValidationIssueSchema),
  confidence: z.number().min(0).max(1).optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
