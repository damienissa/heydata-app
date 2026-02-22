import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadMetrics, loadDimensions, loadEntities, loadDefinitions } from "../loader.js";

describe("loadMetrics", () => {
  it("should load metrics from directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "loader-metrics-"));
    try {
      writeFileSync(
        join(tmpDir, "total_clicks.yml"),
        `name: total_clicks
displayName: Total clicks
description: Number of click events
formula: COUNT(click_logs.id)
grain: daily
dimensions:
  - click_date
  - link_slug
synonyms:
  - clicks
  - click count
formatting:
  type: number
  decimalPlaces: 0
`,
      );
      const result = loadMetrics(tmpDir, false);

      expect(result.metrics.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      const totalClicks = result.metrics.find((m) => m.name === "total_clicks");
      expect(totalClicks).toBeDefined();
      expect(totalClicks?.formula).toContain("COUNT");
      expect(totalClicks?.synonyms).toContain("clicks");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("should return errors for non-existent path", () => {
    const result = loadMetrics("/nonexistent/path", false);
    expect(result.metrics).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("loadDimensions", () => {
  it("should load dimensions from directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "loader-dims-"));
    try {
      writeFileSync(
        join(tmpDir, "click_date.yml"),
        `name: click_date
displayName: Click Date
description: Date of click
table: click_logs
column: created_at
type: date
synonyms:
  - date
formatting:
  type: date
`,
      );
      const result = loadDimensions(tmpDir, false);

      expect(result.dimensions.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      const clickDate = result.dimensions.find((d) => d.name === "click_date");
      expect(clickDate).toBeDefined();
      expect(clickDate?.type).toBe("date");
      expect(clickDate?.table).toBe("click_logs");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("loadEntities", () => {
  it("should load entities from directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "loader-entities-"));
    try {
      writeFileSync(
        join(tmpDir, "links.yml"),
        `name: links
table: links
description: Short links
primaryKey: slug
relationships:
  - target: click_logs
    foreignKey: slug
    targetKey: slug
    type: one-to-many
    joinType: left
`,
      );
      const result = loadEntities(tmpDir, false);

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      const links = result.entities.find((e) => e.name === "links");
      expect(links).toBeDefined();
      expect(links?.relationships).toBeDefined();
      expect(links?.relationships?.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("loadDefinitions", () => {
  it("should load all definitions from directory structure", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "loader-defs-"));
    try {
      const metricsDir = join(tmpDir, "metrics");
      const dimensionsDir = join(tmpDir, "dimensions");
      const entitiesDir = join(tmpDir, "entities");
      mkdirSync(metricsDir, { recursive: true });
      mkdirSync(dimensionsDir, { recursive: true });
      mkdirSync(entitiesDir, { recursive: true });

      writeFileSync(
        join(metricsDir, "m.yml"),
        `name: m1
displayName: M
description: M
formula: COUNT(*)
dimensions: []
`,
      );
      writeFileSync(
        join(dimensionsDir, "d.yml"),
        `name: d1
displayName: D
description: D
table: t
column: c
type: string
`,
      );
      writeFileSync(
        join(entitiesDir, "e.yml"),
        `name: e1
table: e1
description: E
primaryKey: id
relationships: []
`,
      );

      const result = loadDefinitions({ definitionsDir: tmpDir, strict: false });

      expect(result.metrics.length).toBeGreaterThan(0);
      expect(result.dimensions.length).toBeGreaterThan(0);
      expect(result.entities.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
