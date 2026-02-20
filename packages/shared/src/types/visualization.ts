import { z } from "zod";

// ── Chart Type ────────────────────────────────────────────────────

export const ChartTypeSchema = z.enum([
  "line",
  "bar",
  "area",
  "scatter",
  "composed",
  "kpi",
  "table",
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

// ── Axis Config ───────────────────────────────────────────────────

export const AxisConfigSchema = z.object({
  dataKey: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(["category", "number", "datetime"]).optional(),
  format: z.string().optional(),
  domain: z.tuple([z.union([z.number(), z.string()]), z.union([z.number(), z.string()])]).optional(),
});

export type AxisConfig = z.infer<typeof AxisConfigSchema>;

// ── Series Config ─────────────────────────────────────────────────

export const SeriesConfigSchema = z.object({
  dataKey: z.string().min(1),
  name: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["line", "bar", "area"]).optional(),
  yAxisId: z.enum(["left", "right"]).optional(),
  stackId: z.string().optional(),
});

export type SeriesConfig = z.infer<typeof SeriesConfigSchema>;

// ── Legend Config ──────────────────────────────────────────────────

export const LegendConfigSchema = z.object({
  show: z.boolean(),
  position: z.enum(["top", "bottom", "left", "right"]).optional(),
});

export type LegendConfig = z.infer<typeof LegendConfigSchema>;

// ── Visualization Spec ────────────────────────────────────────────

export const VisualizationSpecSchema = z.object({
  chartType: ChartTypeSchema,
  title: z.string().optional(),
  xAxis: AxisConfigSchema.optional(),
  yAxis: AxisConfigSchema.optional(),
  yAxisRight: AxisConfigSchema.optional(),
  series: z.array(SeriesConfigSchema).default([]),
  legend: LegendConfigSchema.optional(),
  stacked: z.boolean().optional(),
  kpiValue: z.string().optional(),
  kpiLabel: z.string().optional(),
  kpiComparison: z.string().optional(),
});

export type VisualizationSpec = z.infer<typeof VisualizationSpecSchema>;
