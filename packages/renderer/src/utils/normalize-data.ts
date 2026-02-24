import type { ColumnMetadata, Row } from "@heydata/shared";

/**
 * Normalizes row data so that numeric columns contain actual JS numbers.
 *
 * SQL drivers (notably node-pg) may return bigint / numeric values as strings.
 * Recharts and other charting libs expect numeric dataKey columns to hold real
 * numbers – passing strings causes blank or broken charts.
 *
 * When `columns` metadata is available we use it as the source of truth.
 * Otherwise we fall back to best-effort heuristic: if every non-null value in
 * a column parses as a finite number, treat the column as numeric.
 */
export function normalizeData(data: Row[], columns?: ColumnMetadata[]): Row[] {
  if (data.length === 0) return data;

  if (columns && columns.length > 0) {
    return coerceByMetadata(data, columns);
  }

  return coerceByHeuristic(data);
}

// ── Metadata-based coercion ──────────────────────────────────────────────────

function coerceByMetadata(data: Row[], columns: ColumnMetadata[]): Row[] {
  const numericCols = new Set(columns.filter((c) => c.type === "number").map((c) => c.name));

  if (numericCols.size === 0) return data;

  return data.map((row) => {
    let changed = false;
    const copy: Row = {};
    for (const key of Object.keys(row)) {
      const val = row[key] ?? null;
      if (numericCols.has(key) && typeof val === "string") {
        const num = Number(val);
        copy[key] = Number.isFinite(num) ? num : null;
        changed = true;
      } else {
        copy[key] = val;
      }
    }
    return changed ? copy : row;
  });
}

// ── Heuristic-based coercion ─────────────────────────────────────────────────

function coerceByHeuristic(data: Row[]): Row[] {
  const firstRow = data[0]!;
  const keys = Object.keys(firstRow);

  // Detect columns where every non-null value is a numeric string
  const numericStringCols = new Set<string>();
  for (const key of keys) {
    const val = firstRow[key] ?? null;
    if (typeof val === "string" && val !== "" && Number.isFinite(Number(val))) {
      // Check a sample (first + last + middle) to reduce false positives
      const sampled = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];
      const allNumeric = sampled.every((row) => {
        const v = row?.[key] ?? null;
        return v === null || (typeof v === "string" && v !== "" && Number.isFinite(Number(v)));
      });
      if (allNumeric) numericStringCols.add(key);
    }
  }

  if (numericStringCols.size === 0) return data;

  return data.map((row) => {
    let changed = false;
    const copy: Row = {};
    for (const key of Object.keys(row)) {
      const val = row[key] ?? null;
      if (numericStringCols.has(key) && typeof val === "string") {
        const num = Number(val);
        copy[key] = Number.isFinite(num) ? num : null;
        changed = true;
      } else {
        copy[key] = val;
      }
    }
    return changed ? copy : row;
  });
}
