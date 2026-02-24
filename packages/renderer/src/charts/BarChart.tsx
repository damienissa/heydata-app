import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "../components/ChartTooltip.js";
import { useInteractiveLegend } from "../hooks/use-interactive-legend.js";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

/**
 * Bar chart component for categorical comparisons
 */
export function BarChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { xAxis, yAxis, yAxisRight, series, legend, title, stacked } = spec;
  const { hiddenSeries, onLegendClick } = useInteractiveLegend();

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {xAxis && (
            <XAxis
              dataKey={xAxis.dataKey}
              label={xAxis.label ? { value: xAxis.label, position: "bottom" } : undefined}
            />
          )}
          {yAxis && (
            <YAxis
              yAxisId="left"
              label={yAxis.label ? { value: yAxis.label, angle: -90, position: "insideLeft" } : undefined}
              domain={yAxis.domain as [number | string, number | string] | undefined}
            />
          )}
          {yAxisRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              label={yAxisRight.label ? { value: yAxisRight.label, angle: 90, position: "insideRight" } : undefined}
              domain={yAxisRight.domain as [number | string, number | string] | undefined}
            />
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
          {(legend?.show ?? true) && (
            <Legend
              verticalAlign={legend?.position === "top" ? "top" : "bottom"}
              onClick={onLegendClick}
              className="cursor-pointer"
            />
          )}
          {series.map((s, index) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              fill={getSeriesColor(index, s.color)}
              yAxisId={s.yAxisId ?? "left"}
              stackId={stacked ? "stack" : s.stackId}
              hide={hiddenSeries.has(s.dataKey)}
              {...ANIMATION_DEFAULTS}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
