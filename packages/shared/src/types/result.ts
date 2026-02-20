import { z } from "zod";

// ── Column Metadata ───────────────────────────────────────────────

export const ColumnMetadataSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean", "null"]),
  displayName: z.string().optional(),
  semanticRole: z.enum(["metric", "dimension", "time", "identifier"]).optional(),
});

export type ColumnMetadata = z.infer<typeof ColumnMetadataSchema>;

// ── Row ───────────────────────────────────────────────────────────

export const RowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export type Row = z.infer<typeof RowSchema>;

// ── Result Set ────────────────────────────────────────────────────

export const ResultSetSchema = z.object({
  columns: z.array(ColumnMetadataSchema),
  rows: z.array(RowSchema),
  rowCount: z.number().int().min(0),
  truncated: z.boolean(),
  executionTimeMs: z.number().min(0),
});

export type ResultSet = z.infer<typeof ResultSetSchema>;

// ── Column Stats ──────────────────────────────────────────────────

export const ColumnStatsSchema = z.object({
  column: z.string().min(1),
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  mean: z.number().optional(),
  median: z.number().optional(),
  stddev: z.number().optional(),
  nullCount: z.number().int().min(0),
  distinctCount: z.number().int().min(0),
});

export type ColumnStats = z.infer<typeof ColumnStatsSchema>;

// ── Data Quality Flag ─────────────────────────────────────────────

export const DataQualityFlagSchema = z.object({
  type: z.enum([
    "missing_values",
    "outlier",
    "unexpected_nulls",
    "duplicate_rows",
    "time_gap",
    "value_out_of_range",
    "grain_mismatch",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  column: z.string().optional(),
  message: z.string(),
  affectedRows: z.number().int().min(0).optional(),
});

export type DataQualityFlag = z.infer<typeof DataQualityFlagSchema>;

// ── Insight Annotation ────────────────────────────────────────────

export const InsightAnnotationSchema = z.object({
  type: z.enum([
    "trend",
    "outlier",
    "anomaly",
    "growth_rate",
    "comparison",
    "correlation",
    "summary_stat",
  ]),
  message: z.string(),
  metric: z.string().optional(),
  value: z.union([z.number(), z.string()]).optional(),
  significance: z.enum(["low", "medium", "high"]).optional(),
});

export type InsightAnnotation = z.infer<typeof InsightAnnotationSchema>;

// ── Enriched Result Set ───────────────────────────────────────────

export const EnrichedResultSetSchema = ResultSetSchema.extend({
  stats: z.array(ColumnStatsSchema).optional(),
  qualityFlags: z.array(DataQualityFlagSchema),
  insights: z.array(InsightAnnotationSchema),
});

export type EnrichedResultSet = z.infer<typeof EnrichedResultSetSchema>;
