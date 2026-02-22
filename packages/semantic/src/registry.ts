import type {
  SemanticMetadata,
  MetricDefinition,
  DimensionDefinition,
  EntityRelationship,
} from "@heydata/shared";
import { HeyDataError } from "@heydata/shared";
import {
  MetricDefinitionSchema,
  DimensionDefinitionSchema,
} from "@heydata/shared";
import type { MetricYaml, DimensionYaml, EntityYaml } from "./schemas/index.js";
import { EntityYamlSchema } from "./schemas/entity.js";
import { loadDefinitions, type LoaderOptions } from "./loader.js";

/**
 * In-memory registry for semantic layer definitions
 * Provides fast lookup by name and synonym
 */
export class SemanticRegistry {
  private metrics: Map<string, MetricDefinition> = new Map();
  private dimensions: Map<string, DimensionDefinition> = new Map();
  private relationships: EntityRelationship[] = [];

  // Synonym maps for fuzzy matching
  private metricSynonyms: Map<string, string> = new Map();
  private dimensionSynonyms: Map<string, string> = new Map();

  /**
   * Load definitions from a directory
   */
  async load(options: LoaderOptions): Promise<{ errors: string[] }> {
    const result = loadDefinitions(options);

    // Process metrics
    for (const metric of result.metrics) {
      this.addMetric(metric);
    }

    // Process dimensions
    for (const dimension of result.dimensions) {
      this.addDimension(dimension);
    }

    // Process entities and build relationships
    for (const entity of result.entities) {
      this.addEntityRelationships(entity);
    }

    return {
      errors: result.errors.map((e) => `${e.file}: ${e.message}`),
    };
  }

  /**
   * Add a metric to the registry
   */
  addMetric(yaml: MetricYaml): void {
    const metric: MetricDefinition = {
      name: yaml.name,
      displayName: yaml.displayName,
      description: yaml.description,
      formula: yaml.formula,
      grain: yaml.grain,
      dimensions: yaml.dimensions,
      defaultFilters: yaml.defaultFilters,
      synonyms: yaml.synonyms,
      formatting: yaml.formatting,
      access: yaml.access,
    };

    this.metrics.set(yaml.name.toLowerCase(), metric);

    // Index synonyms
    if (yaml.synonyms) {
      for (const synonym of yaml.synonyms) {
        this.metricSynonyms.set(synonym.toLowerCase(), yaml.name.toLowerCase());
      }
    }
  }

  /**
   * Add a dimension to the registry
   */
  addDimension(yaml: DimensionYaml): void {
    const dimension: DimensionDefinition = {
      name: yaml.name,
      displayName: yaml.displayName,
      description: yaml.description,
      table: yaml.table,
      column: yaml.column,
      type: yaml.type,
      synonyms: yaml.synonyms,
      formatting: yaml.formatting,
    };

    this.dimensions.set(yaml.name.toLowerCase(), dimension);

    // Index synonyms
    if (yaml.synonyms) {
      for (const synonym of yaml.synonyms) {
        this.dimensionSynonyms.set(synonym.toLowerCase(), yaml.name.toLowerCase());
      }
    }
  }

  /**
   * Add relationships from an entity definition
   */
  addEntityRelationships(yaml: EntityYaml): void {
    if (!yaml.relationships) return;

    for (const rel of yaml.relationships) {
      this.relationships.push({
        from: {
          table: yaml.table,
          column: rel.foreignKey,
        },
        to: {
          table: rel.target,
          column: rel.targetKey,
        },
        type: rel.type,
        joinType: rel.joinType,
      });
    }
  }

  /**
   * Get a metric by name or synonym
   */
  getMetric(nameOrSynonym: string): MetricDefinition | undefined {
    const key = nameOrSynonym.toLowerCase();

    // Direct lookup
    const direct = this.metrics.get(key);
    if (direct) return direct;

    // Synonym lookup
    const canonical = this.metricSynonyms.get(key);
    if (canonical) return this.metrics.get(canonical);

    return undefined;
  }

  /**
   * Get a dimension by name or synonym
   */
  getDimension(nameOrSynonym: string): DimensionDefinition | undefined {
    const key = nameOrSynonym.toLowerCase();

    // Direct lookup
    const direct = this.dimensions.get(key);
    if (direct) return direct;

    // Synonym lookup
    const canonical = this.dimensionSynonyms.get(key);
    if (canonical) return this.dimensions.get(canonical);

    return undefined;
  }

  /**
   * Get metric by name, throw if not found
   */
  requireMetric(nameOrSynonym: string): MetricDefinition {
    const metric = this.getMetric(nameOrSynonym);
    if (!metric) {
      throw new HeyDataError("METRIC_NOT_FOUND", `Metric not found: ${nameOrSynonym}`);
    }
    return metric;
  }

  /**
   * Get dimension by name, throw if not found
   */
  requireDimension(nameOrSynonym: string): DimensionDefinition {
    const dimension = this.getDimension(nameOrSynonym);
    if (!dimension) {
      throw new HeyDataError("DIMENSION_NOT_FOUND", `Dimension not found: ${nameOrSynonym}`);
    }
    return dimension;
  }

  /**
   * Search metrics by partial name match
   */
  searchMetrics(query: string): MetricDefinition[] {
    const q = query.toLowerCase();
    const results: MetricDefinition[] = [];

    for (const metric of this.metrics.values()) {
      if (
        metric.name.toLowerCase().includes(q) ||
        metric.displayName.toLowerCase().includes(q) ||
        metric.description.toLowerCase().includes(q) ||
        metric.synonyms?.some((s) => s.toLowerCase().includes(q))
      ) {
        results.push(metric);
      }
    }

    return results;
  }

  /**
   * Search dimensions by partial name match
   */
  searchDimensions(query: string): DimensionDefinition[] {
    const q = query.toLowerCase();
    const results: DimensionDefinition[] = [];

    for (const dimension of this.dimensions.values()) {
      if (
        dimension.name.toLowerCase().includes(q) ||
        dimension.displayName.toLowerCase().includes(q) ||
        dimension.description.toLowerCase().includes(q) ||
        dimension.synonyms?.some((s) => s.toLowerCase().includes(q))
      ) {
        results.push(dimension);
      }
    }

    return results;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get all dimensions
   */
  getAllDimensions(): DimensionDefinition[] {
    return Array.from(this.dimensions.values());
  }

  /**
   * Get all relationships
   */
  getAllRelationships(): EntityRelationship[] {
    return [...this.relationships];
  }

  /**
   * Export as SemanticMetadata for use with agents
   */
  toSemanticMetadata(): SemanticMetadata {
    return {
      metrics: this.getAllMetrics(),
      dimensions: this.getAllDimensions(),
      relationships: this.getAllRelationships(),
      synonyms: this.buildSynonymMap(),
    };
  }

  /**
   * Build a combined synonym map
   */
  private buildSynonymMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};

    for (const metric of this.metrics.values()) {
      if (metric.synonyms && metric.synonyms.length > 0) {
        map[metric.name] = metric.synonyms;
      }
    }

    for (const dimension of this.dimensions.values()) {
      if (dimension.synonyms && dimension.synonyms.length > 0) {
        map[dimension.name] = dimension.synonyms;
      }
    }

    return map;
  }

  /**
   * Load definitions from database metadata (semantic_layers table).
   * Validates and populates the registry from metrics, dimensions, and entities JSONB.
   */
  loadFromMetadata(metadata: {
    metrics: unknown;
    dimensions: unknown;
    entities: unknown;
  }): { errors: string[] } {
    const errors: string[] = [];
    this.clear();

    const metricsArr = Array.isArray(metadata.metrics) ? metadata.metrics : [];
    const dimensionsArr = Array.isArray(metadata.dimensions) ? metadata.dimensions : [];
    const entitiesArr = Array.isArray(metadata.entities) ? metadata.entities : [];

    for (const m of metricsArr) {
      const parsed = MetricDefinitionSchema.safeParse(m);
      if (parsed.success) {
        this.addMetric(parsed.data as MetricYaml);
      } else {
        errors.push(`Metric: ${parsed.error.message}`);
      }
    }

    for (const d of dimensionsArr) {
      const parsed = DimensionDefinitionSchema.safeParse(d);
      if (parsed.success) {
        this.addDimension(parsed.data as DimensionYaml);
      } else {
        errors.push(`Dimension: ${parsed.error.message}`);
      }
    }

    for (const e of entitiesArr) {
      const parsed = EntityYamlSchema.safeParse(e);
      if (parsed.success) {
        this.addEntityRelationships(parsed.data);
      } else {
        errors.push(`Entity: ${parsed.error.message}`);
      }
    }

    return { errors };
  }

  /**
   * Clear all definitions
   */
  clear(): void {
    this.metrics.clear();
    this.dimensions.clear();
    this.relationships = [];
    this.metricSynonyms.clear();
    this.dimensionSynonyms.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): { metrics: number; dimensions: number; relationships: number } {
    return {
      metrics: this.metrics.size,
      dimensions: this.dimensions.size,
      relationships: this.relationships.length,
    };
  }
}

/**
 * Create a new registry instance
 */
export function createRegistry(): SemanticRegistry {
  return new SemanticRegistry();
}

/**
 * Create and load a registry from a definitions directory
 */
export async function loadRegistry(
  definitionsDir: string,
  options?: { strict?: boolean },
): Promise<SemanticRegistry> {
  const registry = createRegistry();
  await registry.load({ definitionsDir, strict: options?.strict });
  return registry;
}

/**
 * Create a registry and populate it from database metadata
 */
export function loadRegistryFromMetadata(metadata: {
  metrics: unknown;
  dimensions: unknown;
  entities: unknown;
}): SemanticRegistry {
  const registry = createRegistry();
  registry.loadFromMetadata(metadata);
  return registry;
}
