import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadMetrics, loadDimensions, loadEntities, loadDefinitions } from "../loader.js";

const definitionsDir = join(import.meta.dirname, "../../definitions");

describe("loadMetrics", () => {
  it("should load metrics from directory", () => {
    const result = loadMetrics(join(definitionsDir, "metrics"), false);

    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // Check a specific metric
    const revenue = result.metrics.find((m) => m.name === "revenue");
    expect(revenue).toBeDefined();
    expect(revenue?.formula).toContain("SUM");
    expect(revenue?.synonyms).toContain("sales");
  });

  it("should return errors for non-existent path", () => {
    const result = loadMetrics("/nonexistent/path", false);
    expect(result.metrics).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("loadDimensions", () => {
  it("should load dimensions from directory", () => {
    const result = loadDimensions(join(definitionsDir, "dimensions"), false);

    expect(result.dimensions.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // Check a specific dimension
    const date = result.dimensions.find((d) => d.name === "date");
    expect(date).toBeDefined();
    expect(date?.type).toBe("date");
    expect(date?.table).toBe("orders");
  });
});

describe("loadEntities", () => {
  it("should load entities from directory", () => {
    const result = loadEntities(join(definitionsDir, "entities"), false);

    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // Check relationships
    const orders = result.entities.find((e) => e.name === "orders");
    expect(orders).toBeDefined();
    expect(orders?.relationships).toBeDefined();
    expect(orders?.relationships?.length).toBeGreaterThan(0);
  });
});

describe("loadDefinitions", () => {
  it("should load all definitions from directory structure", () => {
    const result = loadDefinitions({ definitionsDir, strict: false });

    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.dimensions.length).toBeGreaterThan(0);
    expect(result.entities.length).toBeGreaterThan(0);
  });
});
