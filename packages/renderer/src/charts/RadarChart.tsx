import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { RadarConfig } from "@heydata/shared";
import { ChartTooltip } from "../components/ChartTooltip.js";
import { useInteractiveLegend } from "../hooks/use-interactive-legend.js";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

/**
 * Radar chart component for multi-dimensional comparison
 */
export function RadarChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { series, legend, title } = spec;
  const { hiddenSeries, onLegendClick } = useInteractiveLegend();

  const config = spec.chartConfig as RadarConfig | undefined;
  const angleKey = config?.angleKey ?? spec.xAxis?.dataKey ?? "subject";

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={angleKey} fontSize={12} />
          <PolarRadiusAxis label={config?.radiusLabel ? { value: config.radiusLabel, position: "insideStart" } : undefined} />
          <Tooltip content={<ChartTooltip />} />
          {(legend?.show ?? true) && (
            <Legend
              verticalAlign={legend?.position === "top" ? "top" : "bottom"}
              onClick={onLegendClick}
              className="cursor-pointer"
            />
          )}
          {series.map((s, index) => (
            <Radar
              key={s.dataKey}
              name={s.name ?? s.dataKey}
              dataKey={s.dataKey}
              stroke={getSeriesColor(index, s.color)}
              fill={getSeriesColor(index, s.color)}
              fillOpacity={0.2}
              hide={hiddenSeries.has(s.dataKey)}
              {...ANIMATION_DEFAULTS}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
