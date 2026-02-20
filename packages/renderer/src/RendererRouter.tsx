import type { ColumnMetadata, Row, VisualizationSpec } from "@heydata/shared";

import { AreaChart, BarChart, ComposedChart, LineChart, ScatterChart } from "./charts/index.js";
import { DataTable, KpiCard } from "./components/index.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./types.js";

export interface RendererRouterProps {
  spec: VisualizationSpec;
  data: Row[];
  columns?: ColumnMetadata[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Routes a VisualizationSpec to the appropriate chart or component
 */
export function RendererRouter({
  spec,
  data,
  columns,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: RendererRouterProps) {
  switch (spec.chartType) {
    case "line":
      return (
        <LineChart
          spec={spec}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
    case "bar":
      return (
        <BarChart
          spec={spec}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
    case "area":
      return (
        <AreaChart
          spec={spec}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
    case "scatter":
      return (
        <ScatterChart
          spec={spec}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
    case "composed":
      return (
        <ComposedChart
          spec={spec}
          data={data}
          width={width}
          height={height}
          className={className}
        />
      );
    case "kpi":
      return <KpiCard spec={spec} data={data} className={className} />;
    case "table":
      return <DataTable spec={spec} data={data} columns={columns} className={className} />;
    default: {
      const _exhaustive: never = spec.chartType;
      return (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
          Unknown chart type: {String(_exhaustive)}
        </div>
      );
    }
  }
}
