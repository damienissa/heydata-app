"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface MetricDefinition {
  name: string;
  description: string;
  calculation?: string;
}

interface MetricTooltipProps {
  metric: MetricDefinition;
  children: ReactNode;
}

export function MetricTooltip({ metric, children }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      let top = triggerRect.top - tooltipRect.height - 8;

      if (left < 8) left = 8;
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      if (top < 8) {
        top = triggerRect.bottom + 8;
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help border-b border-dashed border-neutral-400 dark:border-neutral-500"
      >
        {children}
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
          style={{ top: position.top, left: position.left }}
        >
          <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
            {metric.name}
          </p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {metric.description}
          </p>
          {metric.calculation && (
            <p className="mt-2 font-mono text-xs text-neutral-500 dark:text-neutral-500">
              {metric.calculation}
            </p>
          )}
        </div>
      )}
    </>
  );
}
