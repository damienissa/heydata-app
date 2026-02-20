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

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

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
          <Tooltip />
          {(legend?.show ?? true) && (
            <Legend verticalAlign={legend?.position === "top" ? "top" : "bottom"} />
          )}
          {series.map((s, index) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              fill={getSeriesColor(index, s.color)}
              yAxisId={s.yAxisId ?? "left"}
              stackId={stacked ? "stack" : s.stackId}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
