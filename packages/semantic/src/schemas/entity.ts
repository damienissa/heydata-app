import { z } from "zod";

/**
 * Schema for entity (table) relationship definitions
 */
export const EntityYamlSchema = z.object({
  name: z.string().min(1),
  table: z.string().min(1),
  description: z.string().optional(),
  primaryKey: z.string().min(1),
  // Relationships to other entities
  relationships: z.array(z.object({
    target: z.string().min(1), // Target entity name
    foreignKey: z.string().min(1),
    targetKey: z.string().min(1),
    type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
    joinType: z.enum(["inner", "left", "right", "full"]).optional(),
  })).optional(),
  // YAML metadata
  version: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type EntityYaml = z.infer<typeof EntityYamlSchema>;

/**
 * Schema for an entities collection file
 */
export const EntitiesFileSchema = z.object({
  version: z.string().optional(),
  entities: z.array(EntityYamlSchema),
});

export type EntitiesFile = z.infer<typeof EntitiesFileSchema>;
