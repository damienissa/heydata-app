import pg from "pg";
import type { ResultSet, IntrospectedSchema, IntrospectedTable, IntrospectedColumn } from "@heydata/shared";
import type { DatabaseAdapter, AdapterPool, AdapterConnectionConfig } from "../adapter.js";
import type { GuardConfig } from "../guards.js";
import { applySqlGuards } from "../guards.js";
import { connectionError, queryError, timeoutError } from "../errors.js";

const { Pool } = pg;

/**
 * Map PostgreSQL type OID to our type system
 */
function mapPgType(typeId: number): "string" | "number" | "date" | "boolean" | "null" {
  const typeMap: Record<number, "string" | "number" | "date" | "boolean"> = {
    16: "boolean",
    20: "number", 21: "number", 23: "number", 26: "number",
    700: "number", 701: "number", 1700: "number",
    18: "string", 19: "string", 25: "string", 1042: "string", 1043: "string",
    1082: "date", 1083: "date", 1114: "date", 1184: "date",
    114: "string", 3802: "string",
    2950: "string",
  };
  return typeMap[typeId] ?? "string";
}

const DEFAULT_GUARDS: Required<GuardConfig> = {
  maxRows: 10000,
  timeoutMs: 30000,
  validateOperations: true,
};

/**
 * PostgreSQL adapter implementing the DatabaseAdapter interface.
 */
export const postgresqlAdapter: DatabaseAdapter = {
  name: "PostgreSQL",
  dbType: "postgresql",

  async connect(id, config) {
    try {
      const pool = new Pool({
        connectionString: config.connectionString,
        ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
        max: config.maxPoolSize ?? 5,
        idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
        connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
      });
      return { id, _pool: pool };
    } catch (error) {
      throw connectionError(
        `Failed to create PostgreSQL pool: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  },

  async execute(pool, sql, params, guards) {
    const pgPool = pool._pool as pg.Pool;
    const mergedGuards = { ...DEFAULT_GUARDS, ...guards };
    const { sql: guardedSql } = applySqlGuards(sql, mergedGuards);

    const startTime = Date.now();

    try {
      const client = await pgPool.connect();
      try {
        if (mergedGuards.timeoutMs > 0) {
          await client.query({ text: `SET LOCAL statement_timeout = '${mergedGuards.timeoutMs}ms'` });
        }

        const result = await client.query({
          text: guardedSql,
          values: params ?? [],
        });

        const executionTimeMs = Date.now() - startTime;
        return toResultSet(result, executionTimeMs, mergedGuards.maxRows);
      } finally {
        client.release();
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("canceling statement due to statement timeout") ||
          error.message.includes("statement timeout"))
      ) {
        throw timeoutError(mergedGuards.timeoutMs);
      }
      throw queryError(
        `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  },

  async introspect(pool) {
    const pgPool = pool._pool as pg.Pool;
    const client = await pgPool.connect();

    try {
      // Get tables
      const tablesResult = await client.query<{
        table_schema: string;
        table_name: string;
      }>({
        text: `
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
          ORDER BY table_schema, table_name
        `,
      });

      // Get columns
      const columnsResult = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>({
        text: `
          SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_schema, table_name, ordinal_position
        `,
      });

      // Get primary keys
      const pksResult = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
      }>({
        text: `
          SELECT kcu.table_schema, kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
        `,
      });

      // Get foreign keys
      const fksResult = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        foreign_table_schema: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }>({
        text: `
          SELECT
            kcu.table_schema,
            kcu.table_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
        `,
      });

      // Get estimated row counts
      const rowCountsResult = await client.query<{
        schemaname: string;
        relname: string;
        n_live_tup: string;
      }>({
        text: `
          SELECT schemaname, relname, n_live_tup
          FROM pg_stat_user_tables
        `,
      });

      // Build lookup sets
      const pkSet = new Set(
        pksResult.rows.map((r) => `${r.table_schema}.${r.table_name}.${r.column_name}`),
      );

      const fkMap = new Map<string, { foreignTable: string; foreignColumn: string }>();
      for (const r of fksResult.rows) {
        fkMap.set(`${r.table_schema}.${r.table_name}.${r.column_name}`, {
          foreignTable: r.foreign_table_name,
          foreignColumn: r.foreign_column_name,
        });
      }

      const rowCountMap = new Map<string, number>();
      for (const r of rowCountsResult.rows) {
        rowCountMap.set(`${r.schemaname}.${r.relname}`, parseInt(r.n_live_tup, 10));
      }

      // Assemble tables
      const tables: IntrospectedTable[] = tablesResult.rows.map((table) => {
        const tableColumns = columnsResult.rows.filter(
          (col) => col.table_schema === table.table_schema && col.table_name === table.table_name,
        );

        const columns: IntrospectedColumn[] = tableColumns.map((col) => {
          const key = `${col.table_schema}.${col.table_name}.${col.column_name}`;
          const fk = fkMap.get(key);
          return {
            name: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable === "YES",
            columnDefault: col.column_default,
            isPrimaryKey: pkSet.has(key),
            isForeignKey: fk !== undefined,
            foreignTable: fk?.foreignTable ?? null,
            foreignColumn: fk?.foreignColumn ?? null,
          };
        });

        return {
          name: table.table_name,
          schema: table.table_schema,
          columns,
          rowCountEstimate: rowCountMap.get(`${table.table_schema}.${table.table_name}`),
        };
      });

      return {
        tables,
        introspectedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw queryError(
        `Schema introspection failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    } finally {
      client.release();
    }
  },

  async testConnection(pool) {
    const pgPool = pool._pool as pg.Pool;
    try {
      const client = await pgPool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      throw connectionError(
        `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  },

  async dispose(pool) {
    const pgPool = pool._pool as pg.Pool;
    await pgPool.end();
  },
};

/**
 * Convert pg.QueryResult to ResultSet
 */
function toResultSet(
  result: pg.QueryResult,
  executionTimeMs: number,
  maxRows: number,
): ResultSet {
  const columns = result.fields.map((field) => ({
    name: field.name,
    type: mapPgType(field.dataTypeID),
    displayName: field.name,
  }));

  const rows = result.rows.map((row: Record<string, unknown>) => {
    const converted: Record<string, string | number | boolean | null> = {};
    for (const col of columns) {
      const value = row[col.name];
      if (value === null || value === undefined) {
        converted[col.name] = null;
      } else if (typeof value === "boolean") {
        converted[col.name] = value;
      } else if (typeof value === "number") {
        converted[col.name] = value;
      } else if (value instanceof Date) {
        converted[col.name] = value.toISOString();
      } else {
        converted[col.name] = String(value);
      }
    }
    return converted;
  });

  const truncated = result.rowCount !== null && result.rowCount >= maxRows;

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
    executionTimeMs,
  };
}
