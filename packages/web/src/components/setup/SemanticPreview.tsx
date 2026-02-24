"use client";

import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";

interface SemanticPreviewProps {
  semanticMarkdown: string;
  className?: string;
}

export function SemanticPreview({ semanticMarkdown, className }: SemanticPreviewProps) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4 max-h-96 overflow-y-auto", className)}>
      <h3 className="mb-3 text-sm font-medium">Generated semantic layer</h3>
      <div className="text-xs prose prose-sm max-w-none dark:prose-invert">
        <MarkdownText>{semanticMarkdown}</MarkdownText>
      </div>
    </div>
  );
}
