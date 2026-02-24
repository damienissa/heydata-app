import { z } from "zod";

// ── Semantic Metadata ─────────────────────────────────────────────
// The semantic layer is stored as a Markdown document (semantic_md) in the
// semantic_layers table. It is injected as a "Semantic Layer Reference" block
// into every AI agent request, functioning as a persistent instruction set.

export const SemanticMetadataSchema = z.object({
  /** Full Markdown document describing the database's semantic layer */
  semanticMarkdown: z.string(),
  /** Compact DDL representation of the raw database schema for ad-hoc metric support */
  rawSchemaDDL: z.string().optional(),
});

export type SemanticMetadata = z.infer<typeof SemanticMetadataSchema>;
