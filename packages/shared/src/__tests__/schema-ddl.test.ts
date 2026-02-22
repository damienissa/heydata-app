import { describe, expect, it } from "vitest";
import { introspectedSchemaToDDL } from "../utils/schema-ddl.js";
import type { IntrospectedSchema } from "../types/connection.js";

describe("introspectedSchemaToDDL", () => {
  it("converts a simple schema to compact DDL", () => {
    const schema: IntrospectedSchema = {
      tables: [
        {
          name: "orders",
          schema: "public",
          columns: [
            { name: "id", dataType: "uuid", isNullable: false, columnDefault: null, isPrimaryKey: true, isForeignKey: false, foreignTable: null, foreignColumn: null },
            { name: "amount", dataType: "numeric", isNullable: false, columnDefault: null, isPrimaryKey: false, isForeignKey: false, foreignTable: null, foreignColumn: null },
            { name: "customer_id", dataType: "uuid", isNullable: true, columnDefault: null, isPrimaryKey: false, isForeignKey: true, foreignTable: "customers", foreignColumn: "id" },
          ],
        },
      ],
      introspectedAt: "2026-01-01T00:00:00Z",
    };

    const result = introspectedSchemaToDDL(schema);
    expect(result).toBe("orders(id uuid PK, amount numeric NOT NULL, customer_id uuid FK->customers.id)");
  });

  it("handles multiple tables", () => {
    const schema: IntrospectedSchema = {
      tables: [
        {
          name: "users",
          schema: "public",
          columns: [
            { name: "id", dataType: "uuid", isNullable: false, columnDefault: null, isPrimaryKey: true, isForeignKey: false, foreignTable: null, foreignColumn: null },
            { name: "email", dataType: "text", isNullable: false, columnDefault: null, isPrimaryKey: false, isForeignKey: false, foreignTable: null, foreignColumn: null },
          ],
        },
        {
          name: "sessions",
          schema: "public",
          columns: [
            { name: "id", dataType: "uuid", isNullable: false, columnDefault: null, isPrimaryKey: true, isForeignKey: false, foreignTable: null, foreignColumn: null },
            { name: "user_id", dataType: "uuid", isNullable: false, columnDefault: null, isPrimaryKey: false, isForeignKey: true, foreignTable: "users", foreignColumn: "id" },
            { name: "duration", dataType: "integer", isNullable: true, columnDefault: null, isPrimaryKey: false, isForeignKey: false, foreignTable: null, foreignColumn: null },
          ],
        },
      ],
      introspectedAt: "2026-01-01T00:00:00Z",
    };

    const result = introspectedSchemaToDDL(schema);
    expect(result).toContain("users(");
    expect(result).toContain("sessions(");
    expect(result).toContain("FK->users.id");
    expect(result.split("\n")).toHaveLength(2);
  });

  it("returns empty string for empty schema", () => {
    const schema: IntrospectedSchema = {
      tables: [],
      introspectedAt: "2026-01-01T00:00:00Z",
    };
    expect(introspectedSchemaToDDL(schema)).toBe("");
  });
});
