import type { GaugeConfig } from "@heydata/shared";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, type ChartProps } from "../types.js";

const DEFAULT_THRESHOLDS = [
  { value: 33, color: "#dc2626" },
  { value: 66, color: "#ca8a04" },
  { value: 100, color: "#16a34a" },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * Gauge chart component for single metric against a range
 */
export function GaugeChart({
  spec,
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: ChartProps) {
  const { title } = spec;

  const config = spec.chartConfig as GaugeConfig | undefined;
  const valueKey = config?.valueKey ?? spec.kpiValue ?? spec.series[0]?.dataKey ?? "value";
  const min = config?.min ?? 0;
  const max = config?.max ?? 100;
  const target = config?.target;
  const unit = config?.unit ?? "";
  const thresholds = config?.thresholds ?? DEFAULT_THRESHOLDS.map((t) => ({
    ...t,
    value: min + ((t.value / 100) * (max - min)),
  }));

  const rawValue = data[0] ? Number(data[0][valueKey]) || 0 : 0;
  const clampedValue = Math.max(min, Math.min(max, rawValue));
  const normalizedValue = (clampedValue - min) / (max - min);

  // SVG dimensions and arc geometry
  const svgWidth = 300;
  const svgHeight = 180;
  const cx = svgWidth / 2;
  const cy = 150;
  const radius = 120;
  const arcStart = 0; // leftmost (180deg in standard)
  const arcEnd = 180; // rightmost (0deg in standard)

  // Draw threshold arcs
  const arcs: { path: string; color: string }[] = [];
  let prevAngle = arcStart;
  for (const threshold of thresholds) {
    const normalized = (threshold.value - min) / (max - min);
    const angle = normalized * (arcEnd - arcStart);
    arcs.push({ path: describeArc(cx, cy, radius, prevAngle, angle), color: threshold.color });
    prevAngle = angle;
  }

  // Needle angle
  const needleAngle = normalizedValue * 180;
  const needleRad = ((needleAngle - 180) * Math.PI) / 180;
  const needleLen = radius - 15;
  const needleX = cx + needleLen * Math.cos(needleRad);
  const needleY = cy + needleLen * Math.sin(needleRad);

  // Target marker
  let targetMarker = null;
  if (target !== undefined) {
    const targetNorm = (Math.max(min, Math.min(max, target)) - min) / (max - min);
    const targetAngle = targetNorm * 180;
    const targetRad = ((targetAngle - 180) * Math.PI) / 180;
    const innerR = radius - 10;
    const outerR = radius + 10;
    targetMarker = (
      <line
        x1={cx + innerR * Math.cos(targetRad)}
        y1={cy + innerR * Math.sin(targetRad)}
        x2={cx + outerR * Math.cos(targetRad)}
        y2={cy + outerR * Math.sin(targetRad)}
        stroke="#333"
        strokeWidth={3}
      />
    );
  }

  const displayValue = Number.isInteger(rawValue) ? rawValue : rawValue.toFixed(1);

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Background arc */}
          <path d={describeArc(cx, cy, radius, arcStart, arcEnd)} fill="none" stroke="#e5e7eb" strokeWidth={20} strokeLinecap="round" />
          {/* Threshold arcs */}
          {arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={20} strokeLinecap="butt" className="transition-opacity hover:opacity-80" />
          ))}
          {/* Target marker */}
          {targetMarker}
          {/* Needle with CSS transition for smooth animation */}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="#333"
            strokeWidth={3}
            strokeLinecap="round"
            style={{ transition: "x2 0.6s ease-out, y2 0.6s ease-out" }}
          />
          <circle cx={cx} cy={cy} r={6} fill="#333" />
          {/* Value text */}
          <text x={cx} y={cy - 20} textAnchor="middle" fontSize={28} fontWeight={700} fill="#111">
            {displayValue}{unit}
          </text>
          {/* Min/Max labels */}
          <text x={cx - radius} y={cy + 16} textAnchor="middle" fontSize={12} fill="#666">
            {min}
          </text>
          <text x={cx + radius} y={cy + 16} textAnchor="middle" fontSize={12} fill="#666">
            {max}
          </text>
        </svg>
      </div>
    </div>
  );
}
