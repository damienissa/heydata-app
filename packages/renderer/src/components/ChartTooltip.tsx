import type { TooltipProps } from "recharts";

/**
 * Styled chart tooltip shared across all Recharts-based charts.
 * Pass as `<Tooltip content={<ChartTooltip />} />`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number | string, string>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {label !== undefined && label !== null && (
        <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          {String(label)}
        </p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => {
          if (entry.value === undefined || entry.value === null) return null;
          return (
            <li key={`${entry.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#888" }}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {entry.name ?? entry.dataKey}:
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatTooltipValue(entry.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTooltipValue(value: number | string): string {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
