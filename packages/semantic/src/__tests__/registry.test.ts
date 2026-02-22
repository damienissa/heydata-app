import { describe, it, expect, beforeEach } from "vitest";
import { SemanticRegistry, loadRegistryFromMetadata } from "../registry.js";
import type { MetricYaml, DimensionYaml, EntityYaml } from "../schemas/index.js";

describe("SemanticRegistry", () => {
  let registry: SemanticRegistry;

  beforeEach(() => {
    registry = new SemanticRegistry();
  });

  describe("addMetric", () => {
    it("should add a metric and retrieve by name", () => {
      const metric: MetricYaml = {
        name: "revenue",
        displayName: "Revenue",
        description: "Total revenue",
        formula: "SUM(orders.total)",
        dimensions: ["date"],
      };

      registry.addMetric(metric);

      const retrieved = registry.getMetric("revenue");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("revenue");
      expect(retrieved?.formula).toBe("SUM(orders.total)");
    });

    it("should retrieve metric by synonym", () => {
      const metric: MetricYaml = {
        name: "revenue",
        displayName: "Revenue",
        description: "Total revenue",
        formula: "SUM(orders.total)",
        dimensions: ["date"],
        synonyms: ["sales", "income"],
      };

      registry.addMetric(metric);

      expect(registry.getMetric("sales")).toBeDefined();
      expect(registry.getMetric("income")).toBeDefined();
      expect(registry.getMetric("SALES")).toBeDefined(); // Case insensitive
    });
  });

  describe("addDimension", () => {
    it("should add a dimension and retrieve by name", () => {
      const dimension: DimensionYaml = {
        name: "date",
        displayName: "Date",
        description: "Order date",
        table: "orders",
        column: "order_date",
        type: "date",
      };

      registry.addDimension(dimension);

      const retrieved = registry.getDimension("date");
      expect(retrieved).toBeDefined();
      expect(retrieved?.table).toBe("orders");
    });

    it("should retrieve dimension by synonym", () => {
      const dimension: DimensionYaml = {
        name: "product_category",
        displayName: "Product Category",
        description: "Product category",
        table: "products",
        column: "category",
        type: "string",
        synonyms: ["category", "product type"],
      };

      registry.addDimension(dimension);

      expect(registry.getDimension("category")).toBeDefined();
      expect(registry.getDimension("product type")).toBeDefined();
    });
  });

  describe("addEntityRelationships", () => {
    it("should add relationships from entity", () => {
      const entity: EntityYaml = {
        name: "orders",
        table: "orders",
        primaryKey: "order_id",
        relationships: [
          {
            target: "customers",
            foreignKey: "customer_id",
            targetKey: "customer_id",
            type: "one-to-many",
            joinType: "left",
          },
        ],
      };

      registry.addEntityRelationships(entity);

      const relationships = registry.getAllRelationships();
      expect(relationships).toHaveLength(1);
      expect(relationships[0]?.from.table).toBe("orders");
      expect(relationships[0]?.to.table).toBe("customers");
    });
  });

  describe("requireMetric / requireDimension", () => {
    it("should throw when metric not found", () => {
      expect(() => registry.requireMetric("nonexistent")).toThrow("Metric not found");
    });

    it("should throw when dimension not found", () => {
      expect(() => registry.requireDimension("nonexistent")).toThrow("Dimension not found");
    });
  });

  describe("search", () => {
    beforeEach(() => {
      registry.addMetric({
        name: "revenue",
        displayName: "Total Revenue",
        description: "Sum of all sales",
        formula: "SUM(total)",
        dimensions: [],
      });
      registry.addMetric({
        name: "order_count",
        displayName: "Order Count",
        description: "Number of orders",
        formula: "COUNT(*)",
        dimensions: [],
      });
    });

    it("should search metrics by name", () => {
      const results = registry.searchMetrics("revenue");
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("revenue");
    });

    it("should search metrics by description", () => {
      const results = registry.searchMetrics("sales");
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("revenue");
    });

    it("should return empty for no matches", () => {
      const results = registry.searchMetrics("xyz123");
      expect(results).toHaveLength(0);
    });
  });

  describe("toSemanticMetadata", () => {
    it("should export as SemanticMetadata", () => {
      registry.addMetric({
        name: "revenue",
        displayName: "Revenue",
        description: "Total",
        formula: "SUM(x)",
        dimensions: ["date"],
        synonyms: ["sales"],
      });
      registry.addDimension({
        name: "date",
        displayName: "Date",
        description: "Date",
        table: "orders",
        column: "order_date",
        type: "date",
      });

      const metadata = registry.toSemanticMetadata();

      expect(metadata.metrics).toHaveLength(1);
      expect(metadata.dimensions).toHaveLength(1);
      expect(metadata.synonyms).toHaveProperty("revenue");
    });
  });

  describe("getStats", () => {
    it("should return correct counts", () => {
      registry.addMetric({
        name: "m1",
        displayName: "M1",
        description: "M1",
        formula: "X",
        dimensions: [],
      });
      registry.addMetric({
        name: "m2",
        displayName: "M2",
        description: "M2",
        formula: "Y",
        dimensions: [],
      });
      registry.addDimension({
        name: "d1",
        displayName: "D1",
        description: "D1",
        table: "t",
        column: "c",
        type: "string",
      });

      const stats = registry.getStats();
      expect(stats.metrics).toBe(2);
      expect(stats.dimensions).toBe(1);
      expect(stats.relationships).toBe(0);
    });
  });
});

describe("loadRegistryFromMetadata", () => {
  it("should load from metadata (DB-style)", () => {
    const registry = loadRegistryFromMetadata({
      metrics: [
        {
          name: "total_clicks",
          displayName: "Total clicks",
          description: "Number of click events",
          formula: "COUNT(click_logs.id)",
          dimensions: ["click_date", "link_slug"],
          synonyms: ["clicks", "click count"],
        },
      ],
      dimensions: [
        {
          name: "click_date",
          displayName: "Click Date",
          description: "Date of click",
          table: "click_logs",
          column: "created_at",
          type: "date",
        },
        {
          name: "link_slug",
          displayName: "Link Slug",
          description: "Short link identifier",
          table: "click_logs",
          column: "link_slug",
          type: "string",
        },
      ],
      entities: [
        {
          name: "links",
          table: "links",
          primaryKey: "slug",
          relationships: [
            {
              target: "click_logs",
              foreignKey: "slug",
              targetKey: "slug",
              type: "one-to-many",
              joinType: "left",
            },
          ],
        },
      ],
    });

    const stats = registry.getStats();
    expect(stats.metrics).toBe(1);
    expect(stats.dimensions).toBe(2);
    expect(stats.relationships).toBe(1);

    const totalClicks = registry.getMetric("clicks");
    expect(totalClicks).toBeDefined();
    expect(totalClicks?.name).toBe("total_clicks");
  });
});
