import {
  Cell,
  Funnel,
  FunnelChart as RechartsFunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { FunnelConfig } from "@heydata/shared";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

/**
 * Funnel chart component for sequential stage visualization
 */
export function FunnelChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { title } = spec;

  const config = spec.chartConfig as FunnelConfig | undefined;
  const nameKey = config?.nameKey ?? spec.xAxis?.dataKey ?? "name";
  const valueKey = config?.valueKey ?? spec.series[0]?.dataKey ?? "value";
  const reversed = config?.reversed ?? false;

  const sortedData = [...data].sort((a, b) => {
    const aVal = Number(a[valueKey]) || 0;
    const bVal = Number(b[valueKey]) || 0;
    return reversed ? aVal - bVal : bVal - aVal;
  });

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsFunnelChart>
          <Tooltip />
          <Funnel dataKey={valueKey} nameKey={nameKey} data={sortedData} isAnimationActive>
            {sortedData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getSeriesColor(index)} />
            ))}
            <LabelList position="right" fill="#333" stroke="none" dataKey={nameKey} fontSize={12} />
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
