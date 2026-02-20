import { describe, it, expect } from "vitest";
import { validateSql, injectLimit, applySqlGuards } from "../guards.js";

describe("validateSql", () => {
  it("should allow SELECT queries", () => {
    expect(() => validateSql("SELECT * FROM users")).not.toThrow();
    expect(() => validateSql("SELECT id, name FROM users WHERE active = true")).not.toThrow();
  });

  it("should allow WITH (CTE) queries", () => {
    expect(() =>
      validateSql("WITH active_users AS (SELECT * FROM users WHERE active) SELECT * FROM active_users"),
    ).not.toThrow();
  });

  it("should reject DROP statements", () => {
    expect(() => validateSql("DROP TABLE users")).toThrow("DROP");
  });

  it("should reject DELETE statements", () => {
    expect(() => validateSql("DELETE FROM users WHERE id = 1")).toThrow("DELETE");
  });

  it("should reject INSERT statements", () => {
    expect(() => validateSql("INSERT INTO users (name) VALUES ('test')")).toThrow("INSERT");
  });

  it("should reject UPDATE statements", () => {
    expect(() => validateSql("UPDATE users SET name = 'test' WHERE id = 1")).toThrow("UPDATE");
  });

  it("should reject TRUNCATE statements", () => {
    expect(() => validateSql("TRUNCATE TABLE users")).toThrow("TRUNCATE");
  });

  it("should reject multiple statements", () => {
    expect(() => validateSql("SELECT 1; SELECT 2")).toThrow("Multiple statements");
  });

  it("should reject non-SELECT queries", () => {
    expect(() => validateSql("EXPLAIN SELECT * FROM users")).toThrow("Only SELECT");
  });

  it("should not false-positive on column names containing keywords", () => {
    // "dropdown" contains "drop" but should be allowed
    expect(() => validateSql("SELECT dropdown FROM ui_elements")).not.toThrow();
    // "updated_at" contains "update" but should be allowed
    expect(() => validateSql("SELECT updated_at FROM users")).not.toThrow();
  });
});

describe("injectLimit", () => {
  it("should add LIMIT when not present", () => {
    const sql = "SELECT * FROM users";
    const result = injectLimit(sql, 1000);
    expect(result).toBe("SELECT * FROM users LIMIT 1000");
  });

  it("should not add LIMIT when already present", () => {
    const sql = "SELECT * FROM users LIMIT 100";
    const result = injectLimit(sql, 1000);
    expect(result).toBe(sql);
  });

  it("should handle trailing semicolon", () => {
    const sql = "SELECT * FROM users;";
    const result = injectLimit(sql, 1000);
    expect(result).toBe("SELECT * FROM users LIMIT 1000");
  });

  it("should preserve existing LIMIT with different value", () => {
    const sql = "SELECT * FROM users LIMIT 50";
    const result = injectLimit(sql, 1000);
    expect(result).toBe(sql);
  });
});

describe("applySqlGuards", () => {
  it("should validate and inject limit", () => {
    const sql = "SELECT * FROM users";
    const result = applySqlGuards(sql, { maxRows: 500 });

    expect(result.sql).toBe("SELECT * FROM users LIMIT 500");
    expect(result.needsTimeout).toBe(true);
  });

  it("should throw on forbidden operations", () => {
    expect(() => applySqlGuards("DROP TABLE users")).toThrow();
  });

  it("should skip validation when disabled", () => {
    // This would normally throw, but validation is disabled
    const result = applySqlGuards("EXPLAIN SELECT 1", {
      validateOperations: false,
    });
    expect(result.sql).toContain("EXPLAIN");
  });
});
