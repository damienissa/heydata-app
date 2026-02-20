import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart as RechartsComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

/**
 * Composed chart component for mixing line, bar, and area series
 * Supports dual Y-axis for comparing metrics with different scales
 */
export function ComposedChart({
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
        <RechartsComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          {series.map((s, index) => {
            const color = getSeriesColor(index, s.color);
            const yAxisId = s.yAxisId ?? "left";
            const name = s.name ?? s.dataKey;
            const stackId = stacked ? "stack" : s.stackId;

            switch (s.type) {
              case "bar":
                return (
                  <Bar
                    key={s.dataKey}
                    dataKey={s.dataKey}
                    name={name}
                    fill={color}
                    yAxisId={yAxisId}
                    stackId={stackId}
                  />
                );
              case "area":
                return (
                  <Area
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={name}
                    fill={color}
                    stroke={color}
                    fillOpacity={0.6}
                    yAxisId={yAxisId}
                    stackId={stackId}
                  />
                );
              case "line":
              default:
                return (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={name}
                    stroke={color}
                    yAxisId={yAxisId}
                    dot={false}
                    strokeWidth={2}
                  />
                );
            }
          })}
        </RechartsComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
