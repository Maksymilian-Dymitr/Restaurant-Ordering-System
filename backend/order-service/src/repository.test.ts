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

const { getOrders, getOrderById, postNewOrder, postProductToOrder, updateOrderStatus } =
  await import("./repository");

function resetMocks() {
  mockQuery.mockClear();
  mockRedisGet.mockClear();
  mockRedisSet.mockClear();
  mockRedisDel.mockClear();
  mockQuery.mockResolvedValue({ rows: [] });
  mockRedisGet.mockResolvedValue(null);
}

describe("getOrders", () => {
  beforeEach(resetMocks);

  it("returns cached orders without hitting the DB", async () => {
    const cached = [{ id: 1, customer_id: "c1", status: "pending" }];
    mockRedisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getOrders();

    expect(result).toEqual(cached);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("queries DB on cache miss and caches result", async () => {
    const rows = [{ id: 2, customer_id: "c2", status: "ready" }];
    mockQuery.mockResolvedValue({ rows });

    const result = await getOrders();

    expect(result).toEqual(rows);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("returns empty array on error", async () => {
    mockRedisGet.mockImplementation(() => Promise.reject(new Error("Redis unavailable")));

    const result = await getOrders();

    expect(result).toEqual([]);
  });
});

describe("getOrderById", () => {
  beforeEach(resetMocks);

  it("returns the order when found", async () => {
    const order = { id: 1, customer_id: "c1", status: "pending" };
    mockQuery.mockResolvedValue({ rows: [order] });

    const result = await getOrderById(1);

    expect(result).toEqual(order);
  });

  it("returns null when order does not exist", async () => {
    const result = await getOrderById(999);

    expect(result).toBeNull();
  });

  it("returns null on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB error")));

    const result = await getOrderById(1);

    expect(result).toBeNull();
  });
});

describe("postNewOrder", () => {
  beforeEach(resetMocks);

  it("returns the new order id on success", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 42 }] });

    const result = await postNewOrder("customer-1");

    expect(result).toBe(42);
    expect(mockRedisDel).toHaveBeenCalled();
  });

  it("returns null on DB error", async () => {
    mockQuery.mockImplementation(() => Promise.reject(new Error("DB error")));

    const result = await postNewOrder("customer-1");

    expect(result).toBeNull();
  });
});

describe("postProductToOrder", () => {
  beforeEach(resetMocks);

  it("inserts one row per product", async () => {
    await postProductToOrder(1, [
      { productId: 10, quantity: 2 },
      { productId: 20, quantity: 1 },
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe("updateOrderStatus", () => {
  beforeEach(resetMocks);

  it("updates the order and clears the cache", async () => {
    await updateOrderStatus(1);

    expect(mockQuery).toHaveBeenCalled();
    expect(mockRedisDel).toHaveBeenCalled();
  });
});
