import { z } from "zod";

// ── Connection Config ────────────────────────────────────────────

export const ConnectionConfigSchema = z.object({
  /** Display name for the connection */
  name: z.string().min(1),
  /** Database type */
  dbType: z.enum(["postgresql"]).default("postgresql"),
  /** Full connection string (e.g. postgres://user:pass@host:5432/db) */
  connectionString: z.string().min(1),
  /** Whether SSL is enabled */
  sslEnabled: z.boolean().default(true),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

// ── Introspected Column ──────────────────────────────────────────

export const IntrospectedColumnSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  isNullable: z.boolean(),
  columnDefault: z.string().nullable(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  /** Referenced table if this is a foreign key */
  foreignTable: z.string().nullable(),
  /** Referenced column if this is a foreign key */
  foreignColumn: z.string().nullable(),
});

export type IntrospectedColumn = z.infer<typeof IntrospectedColumnSchema>;

// ── Introspected Table ───────────────────────────────────────────

export const IntrospectedTableSchema = z.object({
  name: z.string(),
  schema: z.string().default("public"),
  columns: z.array(IntrospectedColumnSchema),
  rowCountEstimate: z.number().optional(),
});

export type IntrospectedTable = z.infer<typeof IntrospectedTableSchema>;

// ── Introspected Schema ──────────────────────────────────────────

export const IntrospectedSchemaSchema = z.object({
  tables: z.array(IntrospectedTableSchema),
  introspectedAt: z.string().datetime(),
});

export type IntrospectedSchema = z.infer<typeof IntrospectedSchemaSchema>;
