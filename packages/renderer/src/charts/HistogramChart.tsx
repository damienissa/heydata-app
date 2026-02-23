import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HistogramConfig, Row } from "@heydata/shared";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

interface Bin {
  label: string;
  count: number;
  binStart: number;
  binEnd: number;
}

function computeBins(data: Row[], valueKey: string, binCount: number): Bin[] {
  const values = data.map((row) => Number(row[valueKey])).filter((v) => !isNaN(v));
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ label: String(min), count: values.length, binStart: min, binEnd: max }];
  }

  const binWidth = (max - min) / binCount;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    label: `${(min + i * binWidth).toFixed(1)}–${(min + (i + 1) * binWidth).toFixed(1)}`,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx]!.count++;
  }

  return bins;
}

/**
 * Histogram chart component for distribution visualization
 */
export function HistogramChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { title } = spec;

  const config = spec.chartConfig as HistogramConfig | undefined;
  const valueKey = config?.valueKey ?? spec.series[0]?.dataKey ?? "value";
  const binCount = config?.binCount ?? 10;

  const bins = computeBins(data, valueKey, binCount);

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsBarChart data={bins} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barCategoryGap={0}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" label={{ value: valueKey, position: "bottom" }} />
          <YAxis label={{ value: "Frequency", angle: -90, position: "insideLeft" }} />
          <Tooltip formatter={(value: number) => [value, "Count"]} />
          <Bar dataKey="count" fill={getSeriesColor(0)} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
