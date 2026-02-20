import { z } from "zod";
import {
  FormattingRuleSchema,
  AccessRuleSchema,
} from "@heydata/shared";

/**
 * Schema for a metric definition YAML file
 * Extends the shared MetricDefinitionSchema with YAML-specific fields
 */
export const MetricYamlSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  formula: z.string().min(1),
  grain: z.enum(["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  dimensions: z.array(z.string()),
  defaultFilters: z.array(z.string()).optional(),
  synonyms: z.array(z.string()).optional(),
  formatting: FormattingRuleSchema.optional(),
  access: AccessRuleSchema.optional(),
  // YAML-specific metadata
  version: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type MetricYaml = z.infer<typeof MetricYamlSchema>;

/**
 * Schema for a metrics collection file (multiple metrics)
 */
export const MetricsFileSchema = z.object({
  version: z.string().optional(),
  metrics: z.array(MetricYamlSchema),
});

export type MetricsFile = z.infer<typeof MetricsFileSchema>;
