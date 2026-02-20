import { z } from "zod";
import { FormattingRuleSchema } from "@heydata/shared";

/**
 * Schema for a dimension definition YAML file
 */
export const DimensionYamlSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  table: z.string().min(1),
  column: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean"]),
  synonyms: z.array(z.string()).optional(),
  formatting: FormattingRuleSchema.optional(),
  // YAML-specific metadata
  version: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Hierarchies for drill-down
  hierarchy: z.object({
    parent: z.string().optional(),
    children: z.array(z.string()).optional(),
  }).optional(),
});

export type DimensionYaml = z.infer<typeof DimensionYamlSchema>;

/**
 * Schema for a dimensions collection file
 */
export const DimensionsFileSchema = z.object({
  version: z.string().optional(),
  dimensions: z.array(DimensionYamlSchema),
});

export type DimensionsFile = z.infer<typeof DimensionsFileSchema>;
