import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "../components/ChartTooltip.js";
import { useInteractiveLegend } from "../hooks/use-interactive-legend.js";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

/**
 * Scatter chart component for correlation and distribution visualization
 */
export function ScatterChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { xAxis, yAxis, series, legend, title } = spec;
  const { hiddenSeries, onLegendClick } = useInteractiveLegend();

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {xAxis && (
            <XAxis
              dataKey={xAxis.dataKey}
              type="number"
              name={xAxis.label ?? xAxis.dataKey}
              label={xAxis.label ? { value: xAxis.label, position: "bottom" } : undefined}
              domain={xAxis.domain as [number | string, number | string] | undefined}
            />
          )}
          {yAxis && (
            <YAxis
              dataKey={yAxis.dataKey}
              type="number"
              name={yAxis.label ?? yAxis.dataKey}
              label={yAxis.label ? { value: yAxis.label, angle: -90, position: "insideLeft" } : undefined}
              domain={yAxis.domain as [number | string, number | string] | undefined}
            />
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          {(legend?.show ?? true) && (
            <Legend
              verticalAlign={legend?.position === "top" ? "top" : "bottom"}
              onClick={onLegendClick}
              className="cursor-pointer"
            />
          )}
          {series.map((s, index) =>
            hiddenSeries.has(s.dataKey) ? null : (
              <Scatter
                key={s.dataKey}
                name={s.name ?? s.dataKey}
                data={data}
                fill={getSeriesColor(index, s.color)}
                {...ANIMATION_DEFAULTS}
              />
            ),
          )}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
