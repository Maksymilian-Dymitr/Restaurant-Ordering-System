import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockQuery = mock(async () => ({ rows: [] }));

mock.module("pg", () => ({
  Pool: class {
    query = mockQuery;
    connect = mock(async () => ({ release: () => {} }));
  },
}));

const { saveError, getErrors, getErrorById } = await import("./repository");

function resetMocks() {
  mockQuery.mockClear();
  mockQuery.mockResolvedValue({ rows: [] });
}

describe("saveError", () => {
  beforeEach(resetMocks);

  it("inserts a record with all fields", async () => {
    await saveError({
      service: "order-service",
      message: "something broke",
      stack: "Error: something broke\n  at ...",
      severity: "server",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT"),
      ["order-service", "something broke", "Error: something broke\n  at ...", "server"],
    );
  });

  it("uses null when stack is omitted", async () => {
    await saveError({ service: "product-service", message: "oops", severity: "client" });

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT"), [
      "product-service",
      "oops",
      null,
      "client",
    ]);
  });

  it("does not throw when the DB errors", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB down")));

    await expect(
      saveError({ service: "x", message: "y", severity: "server" }),
    ).resolves.toBeUndefined();
  });
});

describe("getErrors", () => {
  beforeEach(resetMocks);

  it("returns all errors when no service filter is given", async () => {
    const rows = [{ id: 1, service: "order-service", message: "err", severity: "server" }];
    mockQuery.mockResolvedValue({ rows });

    const result = await getErrors();

    expect(result).toEqual(rows);
  });

  it("filters by service when provided", async () => {
    const rows = [{ id: 2, service: "notification-service", message: "err", severity: "client" }];
    mockQuery.mockResolvedValue({ rows });

    const result = await getErrors("notification-service");

    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE service"),
      ["notification-service"],
    );
  });

  it("returns empty array on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB down")));

    const result = await getErrors();

    expect(result).toEqual([]);
  });
});

describe("getErrorById", () => {
  beforeEach(resetMocks);

  it("returns the error when found", async () => {
    const row = { id: 5, service: "order-service", message: "bad", severity: "server" };
    mockQuery.mockResolvedValue({ rows: [row] });

    const result = await getErrorById(5);

    expect(result).toEqual(row);
  });

  it("returns null when not found", async () => {
    const result = await getErrorById(999);

    expect(result).toBeNull();
  });

  it("returns null on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB down")));

    const result = await getErrorById(1);

    expect(result).toBeNull();
  });
});
