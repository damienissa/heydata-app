"use client";

import type { MetricDefinition } from "@heydata/shared";
import { useRef, useState } from "react";

interface MetricTooltipProps {
  children: React.ReactNode;
  /** Metric definition from semantic layer; tooltip shows displayName + description */
  metric?: MetricDefinition;
  /** Or plain text definition (used when metric is not available) */
  definition?: string;
}

export function MetricTooltip({
  children,
  metric,
  definition,
}: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text =
    metric
      ? `${metric.displayName}: ${metric.description}`
      : definition ?? "";

  if (!text) {
    return <>{children}</>;
  }

  const show = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 100);
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded bg-zinc-800 px-2 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-700"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}
