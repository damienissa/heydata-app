import type {
  ColumnStats,
  DataQualityFlag,
  IntentObject,
  ResultSet,
  Row,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import { createSuccessTrace } from "../types.js";

export interface DataValidatorInput extends AgentInput {
  resultSet: ResultSet;
  intent?: IntentObject;
}

export interface DataValidatorOutput {
  qualityFlags: DataQualityFlag[];
  columnStats: ColumnStats[];
}

/**
 * Calculate statistics for a numeric column
 */
function calculateNumericStats(
  values: number[],
  nullCount: number,
): { mean: number; median: number; stddev: number; min: number; max: number } {
  if (values.length === 0) {
    return { mean: 0, median: 0, stddev: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((acc, v) => acc + v, 0) / values.length;
  const stddev = Math.sqrt(avgSquaredDiff);

  return {
    mean,
    median,
    stddev,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

/**
 * Detect outliers using IQR method
 */
function detectOutliers(values: number[]): { count: number; threshold: number } {
  if (values.length < 4) {
    return { count: 0, threshold: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index] ?? 0;
  const q3 = sorted[q3Index] ?? 0;
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierCount = values.filter(
    (v) => v < lowerBound || v > upperBound,
  ).length;

  return { count: outlierCount, threshold: 1.5 * iqr };
}

/**
 * Check for time gaps in datetime columns
 */
function detectTimeGaps(
  values: Date[],
  expectedGrain?: string,
): { hasGaps: boolean; gapCount: number } {
  if (values.length < 2) {
    return { hasGaps: false, gapCount: 0 };
  }

  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = sorted[i - 1];
    const currDate = sorted[i];
    if (prevDate && currDate) {
      intervals.push(currDate.getTime() - prevDate.getTime());
    }
  }

  if (intervals.length === 0) {
    return { hasGaps: false, gapCount: 0 };
  }

  // Find the most common interval (mode)
  const intervalCounts = new Map<number, number>();
  for (const interval of intervals) {
    const rounded = Math.round(interval / 1000) * 1000; // Round to seconds
    intervalCounts.set(rounded, (intervalCounts.get(rounded) ?? 0) + 1);
  }

  let modeInterval = 0;
  let maxCount = 0;
  for (const [interval, count] of intervalCounts) {
    if (count > maxCount) {
      modeInterval = interval;
      maxCount = count;
    }
  }

  // Count intervals that are significantly larger than the mode
  const gapThreshold = modeInterval * 1.5;
  const gapCount = intervals.filter((i) => i > gapThreshold).length;

  return { hasGaps: gapCount > 0, gapCount };
}

/**
 * Pure TypeScript data validator - no LLM calls needed
 */
export async function validateData(
  input: DataValidatorInput,
): Promise<AgentResult<DataValidatorOutput>> {
  const startedAt = new Date();
  const { context, resultSet, intent } = input;

  const qualityFlags: DataQualityFlag[] = [];
  const columnStats: ColumnStats[] = [];

  // Check for empty results
  if (resultSet.rowCount === 0) {
    qualityFlags.push({
      type: "missing_values",
      severity: "warning",
      message: "Query returned no results",
      affectedRows: 0,
    });
  }

  // Check if results were truncated
  if (resultSet.truncated) {
    qualityFlags.push({
      type: "value_out_of_range",
      severity: "info",
      message: `Results were truncated. Only ${resultSet.rowCount} rows returned.`,
      affectedRows: resultSet.rowCount,
    });
  }

  // Validate date range against intent if provided
  if (intent?.timeRange && resultSet.rowCount > 0) {
    const dateColumns = resultSet.columns.filter(
      (c) => c.type === "date" || c.semanticRole === "time",
    );

    for (const dateCol of dateColumns) {
      const dateValues = resultSet.rows
        .map((row: Row) => {
          const val = row[dateCol.name];
          if (typeof val === "string") {
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? null : parsed;
          }
          return null;
        })
        .filter((v): v is Date => v !== null);

      if (dateValues.length > 0) {
        const sorted = [...dateValues].sort((a, b) => a.getTime() - b.getTime());
        const minDate = sorted[0]!;
        const maxDate = sorted[sorted.length - 1]!;

        const requestedStart = new Date(intent.timeRange.start);
        const requestedEnd = new Date(intent.timeRange.end);

        // Check if data falls outside requested range
        if (maxDate < requestedStart) {
          qualityFlags.push({
            type: "value_out_of_range",
            severity: "error",
            column: dateCol.name,
            message: `Data ends at ${maxDate.toISOString().split("T")[0]} but requested range starts at ${intent.timeRange.start}. The returned data does not overlap with the requested time period.`,
            affectedRows: resultSet.rowCount,
          });
        } else if (minDate > requestedEnd) {
          qualityFlags.push({
            type: "value_out_of_range",
            severity: "error",
            column: dateCol.name,
            message: `Data starts at ${minDate.toISOString().split("T")[0]} but requested range ends at ${intent.timeRange.end}. The returned data does not overlap with the requested time period.`,
            affectedRows: resultSet.rowCount,
          });
        }
      }
    }
  }

  // Analyze each column
  for (const column of resultSet.columns) {
    const values: (string | number | boolean | null)[] = resultSet.rows.map(
      (row: Row) => row[column.name] ?? null,
    );

    const nullCount = values.filter((v) => v === null).length;
    const nonNullValues = values.filter((v) => v !== null);

    // Track distinct values
    const distinctValues = new Set(nonNullValues.map((v) => String(v)));

    const stats: ColumnStats = {
      column: column.name,
      nullCount,
      distinctCount: distinctValues.size,
    };

    // Check for unexpected nulls
    if (nullCount > 0 && nullCount > resultSet.rowCount * 0.1) {
      qualityFlags.push({
        type: "unexpected_nulls",
        severity: nullCount > resultSet.rowCount * 0.5 ? "warning" : "info",
        column: column.name,
        message: `Column "${column.name}" has ${nullCount} null values (${((nullCount / resultSet.rowCount) * 100).toFixed(1)}%)`,
        affectedRows: nullCount,
      });
    }

    // Type-specific analysis
    if (column.type === "number") {
      const numericValues = nonNullValues.filter(
        (v): v is number => typeof v === "number",
      );

      if (numericValues.length > 0) {
        const numStats = calculateNumericStats(numericValues, nullCount);
        stats.min = numStats.min;
        stats.max = numStats.max;
        stats.mean = numStats.mean;
        stats.median = numStats.median;
        stats.stddev = numStats.stddev;

        // Check for outliers
        const outlierInfo = detectOutliers(numericValues);
        if (outlierInfo.count > 0) {
          qualityFlags.push({
            type: "outlier",
            severity: outlierInfo.count > numericValues.length * 0.1 ? "warning" : "info",
            column: column.name,
            message: `Column "${column.name}" has ${outlierInfo.count} potential outliers`,
            affectedRows: outlierInfo.count,
          });
        }
      }
    } else if (column.type === "date") {
      const dateValues = nonNullValues
        .map((v) => {
          if (typeof v === "string") {
            const parsed = new Date(v);
            return isNaN(parsed.getTime()) ? null : parsed;
          }
          return null;
        })
        .filter((v): v is Date => v !== null);

      if (dateValues.length > 0) {
        const sorted = [...dateValues].sort((a, b) => a.getTime() - b.getTime());
        stats.min = sorted[0]?.toISOString();
        stats.max = sorted[sorted.length - 1]?.toISOString();

        // Check for time gaps
        const gapInfo = detectTimeGaps(dateValues);
        if (gapInfo.hasGaps) {
          qualityFlags.push({
            type: "time_gap",
            severity: gapInfo.gapCount > 3 ? "warning" : "info",
            column: column.name,
            message: `Column "${column.name}" has ${gapInfo.gapCount} time gaps in the data`,
            affectedRows: gapInfo.gapCount,
          });
        }
      }
    } else if (column.type === "string") {
      // Check for low cardinality that might indicate data issues
      if (
        distinctValues.size === 1 &&
        nonNullValues.length > 10
      ) {
        qualityFlags.push({
          type: "grain_mismatch",
          severity: "info",
          column: column.name,
          message: `Column "${column.name}" has only 1 distinct value across ${nonNullValues.length} rows`,
        });
      }
    }

    columnStats.push(stats);
  }

  // Check for potential duplicate rows
  const rowHashes = resultSet.rows.map((row: Row) => JSON.stringify(row));
  const uniqueHashes = new Set(rowHashes);
  if (uniqueHashes.size < resultSet.rowCount) {
    const duplicateCount = resultSet.rowCount - uniqueHashes.size;
    qualityFlags.push({
      type: "duplicate_rows",
      severity: duplicateCount > resultSet.rowCount * 0.1 ? "warning" : "info",
      message: `Found ${duplicateCount} duplicate rows`,
      affectedRows: duplicateCount,
    });
  }

  return {
    data: {
      qualityFlags,
      columnStats,
    },
    trace: createSuccessTrace({
      agent: "data_validator",
      model: context.model,
      startedAt,
      inputTokens: 0,
      outputTokens: 0,
    }),
  };
}
