import type { SemanticMetadata } from "@heydata/shared";

/**
 * In-memory registry for the semantic layer Markdown document.
 * Stores a single `semantic_md` string that is injected into every AI agent request.
 */
export class SemanticRegistry {
  private semanticMarkdown = "";

  /**
   * Load from database metadata (semantic_layers table).
   * Accepts `{ semantic_md: string }` — the full Markdown document.
   */
  loadFromMetadata(metadata: { semantic_md: string }): void {
    this.semanticMarkdown = metadata.semantic_md ?? "";
  }

  /**
   * Export as SemanticMetadata for use with agents.
   */
  toSemanticMetadata(): SemanticMetadata {
    return { semanticMarkdown: this.semanticMarkdown };
  }

  /**
   * Return the raw Markdown string.
   */
  getMarkdown(): string {
    return this.semanticMarkdown;
  }
}

/**
 * Create a new registry instance.
 */
export function createRegistry(): SemanticRegistry {
  return new SemanticRegistry();
}

/**
 * Create a registry and populate it from database metadata.
 */
export function loadRegistryFromMetadata(metadata: { semantic_md: string }): SemanticRegistry {
  const registry = createRegistry();
  registry.loadFromMetadata(metadata);
  return registry;
}
