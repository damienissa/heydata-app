import { useCallback, useState } from "react";

/**
 * Hook for interactive legend — clicking a legend entry toggles series visibility.
 *
 * Recharts Legend onClick passes `(Payload, index, event)`.
 * `Payload.dataKey` is `DataKey<any>` which can be string | number | function.
 * We coerce to string for our hidden set.
 */
export function useInteractiveLegend() {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const onLegendClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry: any) => {
      const key = String(entry?.dataKey ?? entry?.value ?? "");
      if (!key) return;
      setHiddenSeries((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  return { hiddenSeries, onLegendClick } as const;
}
