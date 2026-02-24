// Charts
export { AreaChart } from "./charts/AreaChart.js";
export { BarChart } from "./charts/BarChart.js";
export { ComposedChart } from "./charts/ComposedChart.js";
export { FunnelChart } from "./charts/FunnelChart.js";
export { GaugeChart } from "./charts/GaugeChart.js";
export { HeatmapChart } from "./charts/HeatmapChart.js";
export { HistogramChart } from "./charts/HistogramChart.js";
export { LineChart } from "./charts/LineChart.js";
export { PieDonutChart } from "./charts/PieDonutChart.js";
export { RadarChart } from "./charts/RadarChart.js";
export { ScatterChart } from "./charts/ScatterChart.js";
export { TreemapChart } from "./charts/TreemapChart.js";
export { WaterfallChart } from "./charts/WaterfallChart.js";

// Components
export { DataTable, type DataTableProps } from "./components/DataTable.js";
export { KpiCard, type KpiCardProps } from "./components/KpiCard.js";

// Router
export { RendererRouter, type RendererRouterProps } from "./RendererRouter.js";

// Components (shared)
export { ChartTooltip } from "./components/ChartTooltip.js";

// Hooks
export { useInteractiveLegend } from "./hooks/use-interactive-legend.js";

// Types and utilities
export {
  ANIMATION_DEFAULTS,
  DEFAULT_COLORS,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  getSeriesColor,
  type ChartProps,
} from "./types.js";
export { interpolateColor } from "./utils/color-scales.js";
export { normalizeData } from "./utils/normalize-data.js";
