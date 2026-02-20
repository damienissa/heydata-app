import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import yaml from "js-yaml";
import { HeyDataError } from "@heydata/shared";
import {
  MetricYamlSchema,
  MetricsFileSchema,
  DimensionYamlSchema,
  DimensionsFileSchema,
  EntityYamlSchema,
  EntitiesFileSchema,
  type MetricYaml,
  type DimensionYaml,
  type EntityYaml,
} from "./schemas/index.js";

export interface LoaderOptions {
  /** Base directory for definition files */
  definitionsDir: string;
  /** Whether to throw on validation errors */
  strict?: boolean;
}

export interface LoadResult {
  metrics: MetricYaml[];
  dimensions: DimensionYaml[];
  entities: EntityYaml[];
  errors: LoadError[];
}

export interface LoadError {
  file: string;
  message: string;
  details?: unknown;
}

/**
 * Load and parse a single YAML file
 */
function loadYamlFile(filePath: string): unknown {
  const content = readFileSync(filePath, "utf-8");
  return yaml.load(content);
}

/**
 * Get all YAML files in a directory (non-recursive)
 */
function getYamlFiles(dirPath: string): string[] {
  try {
    const files = readdirSync(dirPath);
    return files
      .filter((f) => [".yml", ".yaml"].includes(extname(f).toLowerCase()))
      .map((f) => join(dirPath, f));
  } catch {
    return [];
  }
}

/**
 * Load metrics from a file or directory
 */
export function loadMetrics(
  path: string,
  strict = true,
): { metrics: MetricYaml[]; errors: LoadError[] } {
  const metrics: MetricYaml[] = [];
  const errors: LoadError[] = [];

  const processFile = (filePath: string) => {
    try {
      const data = loadYamlFile(filePath);

      // Try parsing as a collection first
      const collectionResult = MetricsFileSchema.safeParse(data);
      if (collectionResult.success) {
        metrics.push(...collectionResult.data.metrics);
        return;
      }

      // Try parsing as a single metric
      const singleResult = MetricYamlSchema.safeParse(data);
      if (singleResult.success) {
        metrics.push(singleResult.data);
        return;
      }

      // Both failed
      const error: LoadError = {
        file: filePath,
        message: "Invalid metric definition",
        details: singleResult.error.issues,
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath, issues: singleResult.error.issues },
        });
      }
      errors.push(error);
    } catch (e) {
      if (e instanceof HeyDataError) throw e;
      const error: LoadError = {
        file: filePath,
        message: e instanceof Error ? e.message : String(e),
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath },
        });
      }
      errors.push(error);
    }
  };

  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      const files = getYamlFiles(path);
      for (const file of files) {
        processFile(file);
      }
    } else {
      processFile(path);
    }
  } catch (e) {
    if (e instanceof HeyDataError) throw e;
    errors.push({
      file: path,
      message: `Cannot access path: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return { metrics, errors };
}

/**
 * Load dimensions from a file or directory
 */
export function loadDimensions(
  path: string,
  strict = true,
): { dimensions: DimensionYaml[]; errors: LoadError[] } {
  const dimensions: DimensionYaml[] = [];
  const errors: LoadError[] = [];

  const processFile = (filePath: string) => {
    try {
      const data = loadYamlFile(filePath);

      // Try parsing as a collection first
      const collectionResult = DimensionsFileSchema.safeParse(data);
      if (collectionResult.success) {
        dimensions.push(...collectionResult.data.dimensions);
        return;
      }

      // Try parsing as a single dimension
      const singleResult = DimensionYamlSchema.safeParse(data);
      if (singleResult.success) {
        dimensions.push(singleResult.data);
        return;
      }

      const error: LoadError = {
        file: filePath,
        message: "Invalid dimension definition",
        details: singleResult.error.issues,
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath, issues: singleResult.error.issues },
        });
      }
      errors.push(error);
    } catch (e) {
      if (e instanceof HeyDataError) throw e;
      const error: LoadError = {
        file: filePath,
        message: e instanceof Error ? e.message : String(e),
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath },
        });
      }
      errors.push(error);
    }
  };

  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      const files = getYamlFiles(path);
      for (const file of files) {
        processFile(file);
      }
    } else {
      processFile(path);
    }
  } catch (e) {
    if (e instanceof HeyDataError) throw e;
    errors.push({
      file: path,
      message: `Cannot access path: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return { dimensions, errors };
}

/**
 * Load entities from a file or directory
 */
export function loadEntities(
  path: string,
  strict = true,
): { entities: EntityYaml[]; errors: LoadError[] } {
  const entities: EntityYaml[] = [];
  const errors: LoadError[] = [];

  const processFile = (filePath: string) => {
    try {
      const data = loadYamlFile(filePath);

      // Try parsing as a collection first
      const collectionResult = EntitiesFileSchema.safeParse(data);
      if (collectionResult.success) {
        entities.push(...collectionResult.data.entities);
        return;
      }

      // Try parsing as a single entity
      const singleResult = EntityYamlSchema.safeParse(data);
      if (singleResult.success) {
        entities.push(singleResult.data);
        return;
      }

      const error: LoadError = {
        file: filePath,
        message: "Invalid entity definition",
        details: singleResult.error.issues,
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath, issues: singleResult.error.issues },
        });
      }
      errors.push(error);
    } catch (e) {
      if (e instanceof HeyDataError) throw e;
      const error: LoadError = {
        file: filePath,
        message: e instanceof Error ? e.message : String(e),
      };
      if (strict) {
        throw new HeyDataError("SEMANTIC_LOAD_ERROR", error.message, {
          details: { file: filePath },
        });
      }
      errors.push(error);
    }
  };

  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      const files = getYamlFiles(path);
      for (const file of files) {
        processFile(file);
      }
    } else {
      processFile(path);
    }
  } catch (e) {
    if (e instanceof HeyDataError) throw e;
    errors.push({
      file: path,
      message: `Cannot access path: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return { entities, errors };
}

/**
 * Load all definitions from a directory structure
 *
 * Expected structure:
 * definitions/
 *   metrics/
 *     revenue.yml
 *     orders.yml
 *   dimensions/
 *     date.yml
 *     product.yml
 *   entities/
 *     orders.yml
 *     customers.yml
 */
export function loadDefinitions(options: LoaderOptions): LoadResult {
  const { definitionsDir, strict = true } = options;

  const metricsResult = loadMetrics(join(definitionsDir, "metrics"), strict);
  const dimensionsResult = loadDimensions(join(definitionsDir, "dimensions"), strict);
  const entitiesResult = loadEntities(join(definitionsDir, "entities"), strict);

  return {
    metrics: metricsResult.metrics,
    dimensions: dimensionsResult.dimensions,
    entities: entitiesResult.entities,
    errors: [
      ...metricsResult.errors,
      ...dimensionsResult.errors,
      ...entitiesResult.errors,
    ],
  };
}
