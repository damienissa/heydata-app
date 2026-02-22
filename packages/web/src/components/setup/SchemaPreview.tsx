"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon, TableIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface IntrospectedTable {
  name: string;
  schema: string;
  columns: Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    foreignTable: string | null;
    foreignColumn: string | null;
  }>;
}

export interface IntrospectedSchema {
  tables: IntrospectedTable[];
  introspectedAt: string;
}

interface SchemaPreviewProps {
  schema: IntrospectedSchema;
  className?: string;
}

export function SchemaPreview({ schema, className }: SchemaPreviewProps) {
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());

  const toggleTable = (key: string) => {
    setOpenTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)}>
      <h3 className="mb-3 text-sm font-medium">
        {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""} found
      </h3>
      <div className="space-y-1">
        {schema.tables.map((table) => {
          const key = `${table.schema}.${table.name}`;
          const isOpen = openTables.has(key);
          return (
            <Collapsible
              key={key}
              open={isOpen}
              onOpenChange={() => toggleTable(key)}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {isOpen ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                  <TableIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {table.schema}.{table.name}
                  </span>
                  <span className="text-muted-foreground">
                    ({table.columns.length} cols)
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 space-y-1 border-l border-muted pl-3 py-1">
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="font-mono text-foreground">{col.name}</span>
                      <span>{col.dataType}</span>
                      {col.isPrimaryKey && (
                        <span className="rounded bg-primary/20 px-1">PK</span>
                      )}
                      {col.isForeignKey && col.foreignTable && (
                        <span className="rounded bg-blue-500/20 px-1">
                          FK→{col.foreignTable}.{col.foreignColumn}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
