import type { HeatmapConfig, Row } from "@heydata/shared";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, type ChartProps } from "../types.js";
import { interpolateColor } from "../utils/color-scales.js";

/**
 * Heatmap chart component for matrix visualization
 */
export function HeatmapChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { title } = spec;

  const config = spec.chartConfig as HeatmapConfig | undefined;
  const xKey = config?.xKey ?? spec.xAxis?.dataKey ?? "x";
  const yKey = config?.yKey ?? spec.yAxis?.dataKey ?? "y";
  const valueKey = config?.valueKey ?? spec.series[0]?.dataKey ?? "value";
  const colorScale = config?.colorScale ?? "blue";
  const showValues = config?.showValues ?? false;

  // Extract unique axis values
  const xValues = [...new Set(data.map((row) => String(row[xKey] ?? "")))];
  const yValues = [...new Set(data.map((row) => String(row[yKey] ?? "")))];

  // Build lookup map
  const valueMap = new Map<string, number>();
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const row of data) {
    const key = `${String(row[xKey])}__${String(row[yKey])}`;
    const val = Number(row[valueKey]) || 0;
    valueMap.set(key, val);
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }

  if (minVal === maxVal) {
    maxVal = minVal + 1;
  }

  // Layout calculations
  const margin = { top: 10, right: 10, bottom: 40, left: 80 };
  const svgWidth = typeof width === "number" ? width : 600;
  const svgHeight = typeof height === "number" ? height : 400;
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;
  const cellWidth = xValues.length > 0 ? plotWidth / xValues.length : 0;
  const cellHeight = yValues.length > 0 ? plotHeight / yValues.length : 0;

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Cells */}
          {yValues.map((yVal, yi) =>
            xValues.map((xVal, xi) => {
              const key = `${xVal}__${yVal}`;
              const val = valueMap.get(key) ?? 0;
              const t = (val - minVal) / (maxVal - minVal);
              const fill = interpolateColor(t, colorScale);
              return (
                <g key={key}>
                  <rect
                    x={xi * cellWidth}
                    y={yi * cellHeight}
                    width={cellWidth}
                    height={cellHeight}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    <title>{`${xVal}, ${yVal}: ${val}`}</title>
                  </rect>
                  {showValues && cellWidth > 30 && cellHeight > 16 && (
                    <text
                      x={xi * cellWidth + cellWidth / 2}
                      y={yi * cellHeight + cellHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={Math.min(11, cellHeight * 0.5)}
                      fill={t > 0.5 ? "#fff" : "#333"}
                    >
                      {typeof val === "number" && !Number.isInteger(val) ? val.toFixed(1) : val}
                    </text>
                  )}
                </g>
              );
            }),
          )}
          {/* X-axis labels */}
          {xValues.map((xVal, xi) => (
            <text
              key={`x-${xi}`}
              x={xi * cellWidth + cellWidth / 2}
              y={plotHeight + 14}
              textAnchor="middle"
              fontSize={Math.min(11, cellWidth * 0.8)}
              fill="#666"
            >
              {xVal}
            </text>
          ))}
          {/* Y-axis labels */}
          {yValues.map((yVal, yi) => (
            <text
              key={`y-${yi}`}
              x={-6}
              y={yi * cellHeight + cellHeight / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={Math.min(11, cellHeight * 0.8)}
              fill="#666"
            >
              {yVal}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
