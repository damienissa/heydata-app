import { Cell, Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { PieConfig } from "@heydata/shared";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getSeriesColor, type ChartProps } from "../types.js";

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

  const config = chartConfig as PieConfig | undefined;
  const nameKey = config?.nameKey ?? spec.xAxis?.dataKey ?? "name";
  const valueKey = config?.valueKey ?? spec.series[0]?.dataKey ?? "value";
  const isDonut = spec.chartType === "donut";
  const innerRadius = config?.innerRadius ?? (isDonut ? "60%" : 0);
  const outerRadius = config?.outerRadius ?? "80%";
  const labelType = config?.labelType ?? "percent";

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            label={(props: Record<string, number | string | undefined>) => renderLabel(labelType, props)}
            labelLine={labelType !== "none"}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getSeriesColor(index)} />
            ))}
          </Pie>
          <Tooltip />
          {(legend?.show ?? true) && (
            <Legend verticalAlign={legend?.position === "top" ? "top" : "bottom"} />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
