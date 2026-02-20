import { describe, it, expect, vi, beforeEach } from "vitest";
import type pg from "pg";
import { executeQuery } from "../executor.js";

// Mock pg module
vi.mock("pg", () => {
  return {
    default: {
      Pool: vi.fn(),
    },
  };
});

describe("executeQuery", () => {
  let mockPool: pg.Pool;
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;
  });

  it("should execute query and return ResultSet", async () => {
    // First call is for setting timeout
    mockClient.query.mockResolvedValueOnce({});
    // Second call is the actual query
    mockClient.query.mockResolvedValueOnce({
      fields: [
        { name: "id", dataTypeID: 23 },
        { name: "name", dataTypeID: 25 },
      ],
      rows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      rowCount: 2,
    });

    const result = await executeQuery(mockPool, "SELECT id, name FROM users");

    expect(result.columns).toHaveLength(2);
    expect(result.columns[0]?.name).toBe("id");
    expect(result.columns[0]?.type).toBe("number");
    expect(result.columns[1]?.type).toBe("string");
    expect(result.rows).toHaveLength(2);
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("should handle null values", async () => {
    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockResolvedValueOnce({
      fields: [{ name: "value", dataTypeID: 25 }],
      rows: [{ value: null }],
      rowCount: 1,
    });

    const result = await executeQuery(mockPool, "SELECT null as value");

    expect(result.rows[0]?.value).toBeNull();
  });

  it("should convert Date objects to ISO strings", async () => {
    const testDate = new Date("2024-01-15T10:30:00Z");

    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockResolvedValueOnce({
      fields: [{ name: "created_at", dataTypeID: 1184 }],
      rows: [{ created_at: testDate }],
      rowCount: 1,
    });

    const result = await executeQuery(mockPool, "SELECT created_at FROM events");

    expect(result.rows[0]?.created_at).toBe(testDate.toISOString());
    expect(result.columns[0]?.type).toBe("date");
  });

  it("should apply SQL guards", async () => {
    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockResolvedValueOnce({
      fields: [],
      rows: [],
      rowCount: 0,
    });

    await executeQuery(mockPool, "SELECT * FROM users");

    // Check that LIMIT was injected
    const queryCall = mockClient.query.mock.calls[1];
    expect(queryCall?.[0]).toContain("LIMIT");
  });

  it("should reject forbidden operations", async () => {
    await expect(executeQuery(mockPool, "DROP TABLE users")).rejects.toThrow("DROP");
  });

  it("should release client on error", async () => {
    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockRejectedValueOnce(new Error("Query failed"));

    await expect(executeQuery(mockPool, "SELECT * FROM users")).rejects.toThrow();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("should handle timeout errors", async () => {
    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockRejectedValueOnce(
      new Error("canceling statement due to statement timeout"),
    );

    await expect(executeQuery(mockPool, "SELECT * FROM users")).rejects.toThrow("timeout");
  });
});
