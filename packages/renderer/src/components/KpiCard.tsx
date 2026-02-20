import type { Row, VisualizationSpec } from "@heydata/shared";

export interface KpiCardProps {
  spec: VisualizationSpec;
  data: Row[];
  className?: string;
}

/**
 * KPI Card component for displaying single metric values with optional comparison
 */
export function KpiCard({ spec, data, className }: KpiCardProps) {
  const { title, kpiValue, kpiLabel, kpiComparison, series } = spec;

  // Extract value from data using kpiValue key or first series dataKey
  const valueKey = kpiValue ?? series[0]?.dataKey;
  const firstRow = data[0];
  const rawValue = valueKey && firstRow ? firstRow[valueKey] : null;

  // Format value based on type
  const formattedValue = formatValue(rawValue);

  // Parse comparison for styling
  const comparison = parseComparison(kpiComparison);

  return (
    <div className={`rounded-lg border bg-white p-6 shadow-sm ${className ?? ""}`}>
      {title && <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{formattedValue}</span>
        {kpiLabel && <span className="text-sm text-gray-500">{kpiLabel}</span>}
      </div>
      {comparison && (
        <div className={`mt-2 flex items-center text-sm ${comparison.colorClass}`}>
          <span className="mr-1">{comparison.icon}</span>
          <span>{comparison.text}</span>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    // Format large numbers with abbreviations
    if (Math.abs(value) >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    // Format with appropriate decimal places
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

interface ComparisonDisplay {
  text: string;
  colorClass: string;
  icon: string;
}

function parseComparison(comparison?: string): ComparisonDisplay | null {
  if (!comparison) return null;

  const trimmed = comparison.trim();

  // Check for percentage patterns like "+12.5%" or "-5%"
  const percentMatch = trimmed.match(/^([+-]?\d+\.?\d*)%\s*(.*)$/);
  if (percentMatch) {
    const [, numStr, rest] = percentMatch;
    const num = parseFloat(numStr ?? "0");
    const suffix = rest ? ` ${rest}` : "";

    if (num > 0) {
      return {
        text: `+${num}%${suffix}`,
        colorClass: "text-green-600",
        icon: "↑",
      };
    } else if (num < 0) {
      return {
        text: `${num}%${suffix}`,
        colorClass: "text-red-600",
        icon: "↓",
      };
    }
  }

  // Default neutral display
  return {
    text: trimmed,
    colorClass: "text-gray-600",
    icon: "→",
  };
}
