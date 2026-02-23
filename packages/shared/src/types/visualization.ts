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
  "pie",
  "donut",
  "funnel",
  "radar",
  "treemap",
  "waterfall",
  "histogram",
  "gauge",
  "heatmap",
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

// ── Chart-Specific Configs ────────────────────────────────────────

export const PieConfigSchema = z.object({
  type: z.enum(["pie", "donut"]),
  nameKey: z.string().min(1),
  valueKey: z.string().min(1),
  innerRadius: z.union([z.number(), z.string()]).optional(),
  outerRadius: z.union([z.number(), z.string()]).optional(),
  labelType: z.enum(["value", "percent", "name", "none"]).optional(),
});

export type PieConfig = z.infer<typeof PieConfigSchema>;

export const FunnelConfigSchema = z.object({
  type: z.literal("funnel"),
  nameKey: z.string().min(1),
  valueKey: z.string().min(1),
  reversed: z.boolean().optional(),
});

export type FunnelConfig = z.infer<typeof FunnelConfigSchema>;

export const RadarConfigSchema = z.object({
  type: z.literal("radar"),
  angleKey: z.string().min(1),
  radiusLabel: z.string().optional(),
});

export type RadarConfig = z.infer<typeof RadarConfigSchema>;

export const TreemapConfigSchema = z.object({
  type: z.literal("treemap"),
  nameKey: z.string().min(1),
  sizeKey: z.string().min(1),
  colorKey: z.string().optional(),
});

export type TreemapConfig = z.infer<typeof TreemapConfigSchema>;

export const WaterfallConfigSchema = z.object({
  type: z.literal("waterfall"),
  categoryKey: z.string().min(1),
  valueKey: z.string().min(1),
  totalLabel: z.string().optional(),
  positiveColor: z.string().optional(),
  negativeColor: z.string().optional(),
  totalColor: z.string().optional(),
});

export type WaterfallConfig = z.infer<typeof WaterfallConfigSchema>;

export const HistogramConfigSchema = z.object({
  type: z.literal("histogram"),
  valueKey: z.string().min(1),
  binCount: z.number().int().min(2).max(100).optional(),
});

export type HistogramConfig = z.infer<typeof HistogramConfigSchema>;

export const GaugeConfigSchema = z.object({
  type: z.literal("gauge"),
  valueKey: z.string().min(1),
  min: z.number().default(0),
  max: z.number().default(100),
  target: z.number().optional(),
  thresholds: z.array(z.object({
    value: z.number(),
    color: z.string(),
    label: z.string().optional(),
  })).optional(),
  unit: z.string().optional(),
});

export type GaugeConfig = z.infer<typeof GaugeConfigSchema>;

export const HeatmapConfigSchema = z.object({
  type: z.literal("heatmap"),
  xKey: z.string().min(1),
  yKey: z.string().min(1),
  valueKey: z.string().min(1),
  colorScale: z.enum(["blue", "green", "red", "diverging"]).optional(),
  showValues: z.boolean().optional(),
});

export type HeatmapConfig = z.infer<typeof HeatmapConfigSchema>;

export const ChartConfigSchema = z.discriminatedUnion("type", [
  PieConfigSchema,
  FunnelConfigSchema,
  RadarConfigSchema,
  TreemapConfigSchema,
  WaterfallConfigSchema,
  HistogramConfigSchema,
  GaugeConfigSchema,
  HeatmapConfigSchema,
]);

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

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
  chartConfig: ChartConfigSchema.optional(),
});

export type VisualizationSpec = z.infer<typeof VisualizationSpecSchema>;
