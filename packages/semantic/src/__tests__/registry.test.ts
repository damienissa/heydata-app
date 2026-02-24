import { describe, it, expect, beforeEach } from "vitest";
import { SemanticRegistry, loadRegistryFromMetadata } from "../registry.js";

const SAMPLE_MD = `# Semantic Layer

## Overview
This database powers analytics.

## Metrics

### total_clicks
- **Formula**: \`COUNT(click_logs.id)\`
- **Synonyms**: clicks, click count

## Dimensions

### click_date
- **Source**: \`click_logs.created_at\`
- **Type**: date

## Relationships
- \`links\` → \`click_logs\`: one-to-many via \`click_logs.slug = links.slug\`
`;

describe("SemanticRegistry", () => {
  let registry: SemanticRegistry;

  beforeEach(() => {
    registry = new SemanticRegistry();
  });

  describe("loadFromMetadata", () => {
    it("stores the Markdown string", () => {
      registry.loadFromMetadata({ semantic_md: SAMPLE_MD });
      expect(registry.getMarkdown()).toBe(SAMPLE_MD);
    });

    it("defaults to empty string when semantic_md is missing", () => {
      registry.loadFromMetadata({ semantic_md: "" });
      expect(registry.getMarkdown()).toBe("");
    });
  });

  describe("toSemanticMetadata", () => {
    it("returns semanticMarkdown in SemanticMetadata", () => {
      registry.loadFromMetadata({ semantic_md: SAMPLE_MD });
      const metadata = registry.toSemanticMetadata();
      expect(metadata.semanticMarkdown).toBe(SAMPLE_MD);
      expect(metadata.rawSchemaDDL).toBeUndefined();
    });
  });
});

describe("loadRegistryFromMetadata", () => {
  it("loads Markdown from metadata and returns a registry", () => {
    const registry = loadRegistryFromMetadata({ semantic_md: SAMPLE_MD });
    const metadata = registry.toSemanticMetadata();
    expect(metadata.semanticMarkdown).toBe(SAMPLE_MD);
  });
});
