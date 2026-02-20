import type { Row, VisualizationSpec } from "@heydata/shared";

/**
 * Props shared by all chart components
 */
export interface ChartProps {
  spec: VisualizationSpec;
  data: Row[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Default chart dimensions
 */
export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 400;

/**
 * Default color palette for series
 */
export const DEFAULT_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#dc2626", // red-600
  "#ca8a04", // yellow-600
  "#9333ea", // purple-600
  "#0891b2", // cyan-600
  "#ea580c", // orange-600
  "#db2777", // pink-600
];

/**
 * Get color for a series by index
 */
export function getSeriesColor(index: number, customColor?: string): string {
  if (customColor) return customColor;
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? DEFAULT_COLORS[0]!;
}
