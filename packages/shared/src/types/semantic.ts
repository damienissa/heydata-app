import { z } from "zod";

// ── Formatting Rules ──────────────────────────────────────────────

export const FormattingRuleSchema = z.object({
  type: z.enum(["currency", "percentage", "number", "date", "text"]),
  currencyCode: z.string().optional(),
  decimalPlaces: z.number().int().min(0).optional(),
  dateFormat: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export type FormattingRule = z.infer<typeof FormattingRuleSchema>;

// ── Synonym Map ───────────────────────────────────────────────────

export const SynonymMapSchema = z.record(z.string(), z.array(z.string()));

export type SynonymMap = z.infer<typeof SynonymMapSchema>;

// ── Access Rule ───────────────────────────────────────────────────

export const AccessRuleSchema = z.object({
  roles: z.array(z.string()),
  filter: z.string().optional(),
});

export type AccessRule = z.infer<typeof AccessRuleSchema>;

// ── Metric Definition ─────────────────────────────────────────────

export const MetricDefinitionSchema = z.object({
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
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

// ── Dimension Definition ──────────────────────────────────────────

export const DimensionDefinitionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  table: z.string().min(1),
  column: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean"]),
  synonyms: z.array(z.string()).optional(),
  formatting: FormattingRuleSchema.optional(),
});

export type DimensionDefinition = z.infer<typeof DimensionDefinitionSchema>;

// ── Entity Relationship ───────────────────────────────────────────

export const EntityRelationshipSchema = z.object({
  from: z.object({
    table: z.string().min(1),
    column: z.string().min(1),
  }),
  to: z.object({
    table: z.string().min(1),
    column: z.string().min(1),
  }),
  type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
  joinType: z.enum(["inner", "left", "right", "full"]).optional(),
});

export type EntityRelationship = z.infer<typeof EntityRelationshipSchema>;

// ── Semantic Metadata (full registry) ─────────────────────────────

export const SemanticMetadataSchema = z.object({
  metrics: z.array(MetricDefinitionSchema),
  dimensions: z.array(DimensionDefinitionSchema),
  relationships: z.array(EntityRelationshipSchema),
  synonyms: SynonymMapSchema.optional(),
});

export type SemanticMetadata = z.infer<typeof SemanticMetadataSchema>;
