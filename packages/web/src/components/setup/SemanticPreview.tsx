"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart3Icon, ChevronDownIcon, ChevronRightIcon, LayersIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MetricDef {
  name: string;
  displayName?: string;
  formula?: string;
  description?: string;
}

interface DimensionDef {
  name: string;
  displayName?: string;
  table?: string;
  column?: string;
  type?: string;
}

interface EntityDef {
  name?: string;
  table?: string;
  description?: string;
  relationships?: Array<{ target?: string; foreignKey?: string }>;
}

interface SemanticLayer {
  metrics: unknown[];
  dimensions: unknown[];
  entities: unknown[];
}

interface SemanticPreviewProps {
  layer: SemanticLayer;
  className?: string;
}

export function SemanticPreview({ layer, className }: SemanticPreviewProps) {
  const [openSection, setOpenSection] = useState<string | null>("metrics");

  const metrics = (layer.metrics ?? []) as MetricDef[];
  const dimensions = (layer.dimensions ?? []) as DimensionDef[];
  const entities = (layer.entities ?? []) as EntityDef[];

  const toggle = (key: string) => {
    setOpenSection((v) => (v === key ? null : key));
  };

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)}>
      <h3 className="mb-3 text-sm font-medium">Generated semantic layer</h3>

      <Collapsible open={openSection === "metrics"} onOpenChange={() => toggle("metrics")}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {openSection === "metrics" ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Metrics</span>
            <span className="text-muted-foreground">({metrics.length})</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 space-y-2 border-l border-muted pl-3 py-2">
            {metrics.slice(0, 10).map((m) => (
              <div key={m.name} className="text-xs">
                <span className="font-mono font-medium text-foreground">{m.name}</span>
                {m.formula && (
                  <span className="ml-2 text-muted-foreground">— {m.formula}</span>
                )}
              </div>
            ))}
            {metrics.length > 10 && (
              <p className="text-muted-foreground">+{metrics.length - 10} more</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSection === "dimensions"} onOpenChange={() => toggle("dimensions")}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {openSection === "dimensions" ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            <LayersIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Dimensions</span>
            <span className="text-muted-foreground">({dimensions.length})</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 space-y-2 border-l border-muted pl-3 py-2">
            {dimensions.slice(0, 10).map((d) => (
              <div key={d.name} className="text-xs">
                <span className="font-mono font-medium text-foreground">{d.name}</span>
                {d.table && d.column && (
                  <span className="ml-2 text-muted-foreground">
                    — {d.table}.{d.column}
                  </span>
                )}
              </div>
            ))}
            {dimensions.length > 10 && (
              <p className="text-muted-foreground">+{dimensions.length - 10} more</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSection === "entities"} onOpenChange={() => toggle("entities")}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {openSection === "entities" ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Entities</span>
            <span className="text-muted-foreground">({entities.length})</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 space-y-2 border-l border-muted pl-3 py-2">
            {entities.slice(0, 10).map((e, i) => (
              <div key={i} className="text-xs">
                <span className="font-mono font-medium text-foreground">
                  {e.table ?? e.name ?? "Unknown"}
                </span>
                {e.relationships && e.relationships.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    — {e.relationships.length} relationship(s)
                  </span>
                )}
              </div>
            ))}
            {entities.length > 10 && (
              <p className="text-muted-foreground">+{entities.length - 10} more</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
