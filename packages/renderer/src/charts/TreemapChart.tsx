import { useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

import type { TreemapConfig } from "@heydata/shared";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  name: string;
}

function CustomContent({ x, y, width, height, index, name }: TreemapContentProps) {
  const showLabel = width > 40 && height > 20;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={getSeriesColor(index)}
        stroke="#fff"
        strokeWidth={2}
        className="transition-opacity hover:opacity-80 cursor-pointer"
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={12}
          fontWeight={500}
        >
          {name}
        </text>
      )}
    </g>
  );
}

/**
 * Treemap chart component for hierarchical proportional data
 */
export function TreemapChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { title } = spec;

  const config = spec.chartConfig as TreemapConfig | undefined;
  const nameKey = config?.nameKey ?? spec.xAxis?.dataKey ?? "name";
  const sizeKey = config?.sizeKey ?? spec.series[0]?.dataKey ?? "value";

  // Recharts Treemap expects data with 'name' property for tooltip
  const treemapData = data.map((row, i) => ({
    name: String(row[nameKey] ?? `Item ${i + 1}`),
    size: Number(row[sizeKey]) || 0,
    ...row,
  }));

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <Treemap
          data={treemapData}
          dataKey="size"
          nameKey="name"
          aspectRatio={4 / 3}
          content={<CustomContent x={0} y={0} width={0} height={0} index={0} name="" />}
          {...ANIMATION_DEFAULTS}
        >
          <Tooltip formatter={(value: number) => [value.toLocaleString(), "Value"]} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
