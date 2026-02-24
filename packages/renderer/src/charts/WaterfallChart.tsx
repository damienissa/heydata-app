import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Row, WaterfallConfig } from "@heydata/shared";
import { ChartTooltip } from "../components/ChartTooltip.js";
import { ANIMATION_DEFAULTS, DEFAULT_HEIGHT, DEFAULT_WIDTH, type ChartProps } from "../types.js";

interface WaterfallRow {
  _category: string;
  _base: number;
  _value: number;
  _isPositive: boolean;
  _isTotal: boolean;
}

function computeWaterfallData(data: Row[], config: WaterfallConfig): WaterfallRow[] {
  let cumulative = 0;
  return data.map((row) => {
    const value = Number(row[config.valueKey]) || 0;
    const category = String(row[config.categoryKey] ?? "");
    const isTotal = !!(config.totalLabel && category === config.totalLabel);

    let base: number;
    if (isTotal) {
      base = 0;
    } else if (value >= 0) {
      base = cumulative;
    } else {
      base = cumulative + value;
    }

    if (!isTotal) {
      cumulative += value;
    }

    return {
      _category: category,
      _base: base,
      _value: isTotal ? Math.abs(value) : Math.abs(value),
      _isPositive: value >= 0,
      _isTotal: isTotal,
    };
  });
}

/**
 * Waterfall chart component for showing incremental changes
 */
export function WaterfallChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { legend, title } = spec;

  const config = spec.chartConfig as WaterfallConfig | undefined;
  const categoryKey = config?.categoryKey ?? spec.xAxis?.dataKey ?? "category";
  const valueKey = config?.valueKey ?? spec.series[0]?.dataKey ?? "value";
  const positiveColor = config?.positiveColor ?? "#16a34a";
  const negativeColor = config?.negativeColor ?? "#dc2626";
  const totalColor = config?.totalColor ?? "#2563eb";

  const resolvedConfig: WaterfallConfig = {
    type: "waterfall",
    categoryKey,
    valueKey,
    totalLabel: config?.totalLabel,
  };

  const waterfallData = computeWaterfallData(data, resolvedConfig);

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsBarChart data={waterfallData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="_category" />
          <YAxis />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />
          {(legend?.show !== false) && (
            <Legend
              verticalAlign={legend?.position === "top" ? "top" : "bottom"}
              payload={[
                { value: "Increase", type: "rect", color: positiveColor },
                { value: "Decrease", type: "rect", color: negativeColor },
                ...(config?.totalLabel ? [{ value: "Total", type: "rect" as const, color: totalColor }] : []),
              ]}
            />
          )}
          <ReferenceLine y={0} stroke="#666" />
          {/* Invisible base bar */}
          <Bar dataKey="_base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          {/* Visible value bar */}
          <Bar dataKey="_value" stackId="waterfall" {...ANIMATION_DEFAULTS}>
            {waterfallData.map((entry, index) => {
              let fill = entry._isPositive ? positiveColor : negativeColor;
              if (entry._isTotal) fill = totalColor;
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
