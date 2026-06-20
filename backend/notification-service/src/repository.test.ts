import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockQuery = mock(async () => ({ rows: [] }));
const mockRedisGet = mock(async (_key: string) => null);
const mockRedisSet = mock(async () => {});
const mockRedisDel = mock(async () => {});

mock.module("pg", () => ({
  Pool: class {
    query = mockQuery;
    connect = mock(async () => ({ release: () => {} }));
  },
}));

mock.module("redis", () => ({
  createClient: () => ({
    connect: mock(async () => {}),
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  }),
}));

const { getNotification, postNotification, deleteNotification } = await import("./repository");

function resetMocks() {
  mockQuery.mockClear();
  mockRedisGet.mockClear();
  mockRedisSet.mockClear();
  mockRedisDel.mockClear();
  mockQuery.mockResolvedValue({ rows: [] });
  mockRedisGet.mockResolvedValue(null);
}

describe("getNotification", () => {
  beforeEach(resetMocks);

  it("returns cached notifications without hitting the DB", async () => {
    const cached = [{ id: 1, customer_id: "5", message: "Your order is ready!" }];
    mockRedisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getNotification(5);

    expect(result).toEqual(cached);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("queries DB on cache miss and caches result", async () => {
    const rows = [{ id: 2, customer_id: "7", message: "Your order is ready!" }];
    mockQuery.mockResolvedValue({ rows });

    const result = await getNotification(7);

    expect(result).toEqual(rows);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("returns null on error", async () => {
    mockRedisGet.mockImplementation(() => Promise.reject(new Error("Redis unavailable")));

    const result = await getNotification(1);

    expect(result).toBeNull();
  });
});

describe("deleteNotification", () => {
  beforeEach(resetMocks);

  it("deletes DB rows and clears the Redis cache key", async () => {
    const result = await deleteNotification("customer-1");

    expect(result).toBe(true);
    expect(mockRedisDel).toHaveBeenCalledWith("notification:customer-1");
    expect(mockQuery).toHaveBeenCalled();
  });

  it("returns false on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB error")));

    const result = await deleteNotification("customer-1");

    expect(result).toBe(false);
  });
});

describe("postNotification", () => {
  beforeEach(resetMocks);

  it("returns the new notification id on success", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 9 }] });

    const result = await postNotification("customer-3");

    expect(result).toBe(9);
    expect(mockRedisDel).toHaveBeenCalled();
  });

  it("returns null on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB error")));

    const result = await postNotification("customer-3");

    expect(result).toBeNull();
  });
});
