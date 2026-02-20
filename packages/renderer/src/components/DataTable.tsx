import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";

import type { ColumnMetadata, Row, VisualizationSpec } from "@heydata/shared";

export interface DataTableProps {
  spec: VisualizationSpec;
  data: Row[];
  columns?: ColumnMetadata[];
  className?: string;
  pageSize?: number;
}

/**
 * Data table component using TanStack Table for sortable, paginated data display
 */
export function DataTable({
  spec,
  data,
  columns: columnMeta,
  className,
  pageSize = 10,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Derive columns from spec series or column metadata
  const tableColumns = useMemo(() => {
    const columnHelper = createColumnHelper<Row>();

    // Use provided column metadata or derive from series
    const cols = columnMeta ?? spec.series.map((s) => ({
      name: s.dataKey,
      type: "string" as const,
      displayName: s.name,
    }));

    // If we have xAxis, add it as first column
    if (spec.xAxis && !cols.some((c) => c.name === spec.xAxis?.dataKey)) {
      cols.unshift({
        name: spec.xAxis.dataKey,
        type: "string" as const,
        displayName: spec.xAxis.label,
      });
    }

    return cols.map((col) =>
      columnHelper.accessor((row) => row[col.name], {
        id: col.name,
        header: () => col.displayName ?? col.name,
        cell: (info) => formatCellValue(info.getValue(), col.type),
      })
    );
  }, [columnMeta, spec.series, spec.xAxis]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  return (
    <div className={`overflow-hidden rounded-lg border bg-white shadow-sm ${className ?? ""}`}>
      {spec.title && (
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold">{spec.title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-sm text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </button>
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (type === "date" && (typeof value === "string" || typeof value === "number")) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  if (type === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}
