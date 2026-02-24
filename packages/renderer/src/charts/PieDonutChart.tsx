import { useState } from "react";
import { Cell, Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";

import type { PieConfig } from "@heydata/shared";
import { ChartTooltip } from "../components/ChartTooltip.js";
import { useInteractiveLegend } from "../hooks/use-interactive-legend.js";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

const RADIAN = Math.PI / 180;

function renderLabel(
  labelType: PieConfig["labelType"],
  props: Record<string, number | string | undefined>,
) {
  if (!labelType || labelType === "none") return null;

  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? "");
  const value = props.value;

  const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  let text = "";
  if (labelType === "value") text = String(value);
  else if (labelType === "percent") text = `${(percent * 100).toFixed(0)}%`;
  else if (labelType === "name") text = name;

  return (
    <text x={x} y={y} fill="#333" textAnchor={x > Number(cx) ? "start" : "end"} dominantBaseline="central" fontSize={12}>
      {text}
    </text>
  );
}

function renderActiveShape(props: unknown) {
  const p = props as Record<string, number | string | undefined>;
  const cx = Number(p.cx ?? 0);
  const cy = Number(p.cy ?? 0);
  const innerRadius = Number(p.innerRadius ?? 0);
  const outerRadius = Number(p.outerRadius ?? 0);
  const startAngle = Number(p.startAngle ?? 0);
  const endAngle = Number(p.endAngle ?? 0);
  const fill = String(p.fill ?? "#888");

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

/**
 * Pie and Donut chart component for proportional data
 */
export function PieDonutChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { legend, title, chartConfig } = spec;
  const { hiddenSeries, onLegendClick } = useInteractiveLegend();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const config = chartConfig as PieConfig | undefined;

  // Auto-detect keys from data when chartConfig keys are missing or don't match actual columns
  const firstRow = data[0] ?? {};
  const columnKeys = Object.keys(firstRow);
  const numericKeys = columnKeys.filter((k) => typeof firstRow[k] === "number");
  const stringKeys = columnKeys.filter((k) => typeof firstRow[k] === "string");

  const nameKey =
    config?.nameKey && columnKeys.includes(config.nameKey)
      ? config.nameKey
      : (stringKeys[0] ?? spec.xAxis?.dataKey ?? columnKeys.find((k) => !numericKeys.includes(k)) ?? "name");

  const valueKey =
    config?.valueKey && columnKeys.includes(config.valueKey)
      ? config.valueKey
      : (numericKeys[0] ?? spec.series[0]?.dataKey ?? "value");

  const isDonut = spec.chartType === "donut";
  const innerRadius = config?.innerRadius ?? (isDonut ? "60%" : 0);
  const outerRadius = config?.outerRadius ?? "80%";
  const labelType = config?.labelType ?? "percent";

  // Filter out hidden slices
  const visibleData = data.filter((row) => !hiddenSeries.has(String(row[nameKey] ?? "")));

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsPieChart>
          <Pie
            data={visibleData}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            label={(props: Record<string, number | string | undefined>) => renderLabel(labelType, props)}
            labelLine={labelType !== "none"}
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            {...ANIMATION_DEFAULTS}
          >
            {visibleData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getSeriesColor(index)} className="cursor-pointer" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          {(legend?.show ?? true) && (
            <Legend
              verticalAlign={legend?.position === "top" ? "top" : "bottom"}
              onClick={onLegendClick}
              className="cursor-pointer"
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
