import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockQuery = mock(async () => ({ rows: [] }));
const mockRedisGet = mock(async (_key: string) => null);
const mockRedisSet = mock(async () => {});

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
  }),
}));

const { getMenu } = await import("./repository");

describe("getMenu", () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockRedisGet.mockClear();
    mockRedisSet.mockClear();
    mockQuery.mockResolvedValue({ rows: [] });
    mockRedisGet.mockResolvedValue(null);
  });

  it("returns cached data without hitting the DB", async () => {
    const cached = [{ id: 1, name: "Cheeseburger", price: 89, category: "Burger" }];
    mockRedisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getMenu();

    expect(result).toEqual(cached);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("queries DB on cache miss and stores result in cache", async () => {
    const rows = [{ id: 2, name: "Cola", price: 29, category: "Drink" }];
    mockQuery.mockResolvedValue({ rows });

    const result = await getMenu();

    expect(result).toEqual(rows);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("returns empty array when an error occurs", async () => {
    mockRedisGet.mockImplementation(() => Promise.reject(new Error("Redis unavailable")));

    const result = await getMenu();

    expect(result).toEqual([]);
  });
});
