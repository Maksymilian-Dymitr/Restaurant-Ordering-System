import { describe, it, expect } from "bun:test";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://localhost";

// ── Menu ─────────────────────────────────────────────────────────────────────

describe("GET /menu", () => {
  it("returns HTTP 200", async () => {
    const res = await fetch(`${BASE}/menu`);
    expect(res.status).toBe(200);
  });

  it("returns a non-empty array of products", async () => {
    const res = await fetch(`${BASE}/menu`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("each product has id, name, price and category fields", async () => {
    const res = await fetch(`${BASE}/menu`);
    const data = await res.json();
    for (const product of data) {
      expect(typeof product.id).toBe("number");
      expect(typeof product.name).toBe("string");
      expect(typeof product.price).toBe("number");
      expect(typeof product.category).toBe("string");
    }
  });
});

// ── Order schema validation ───────────────────────────────────────────────────

describe("POST /orders — schema validation", () => {
  const post = (body: unknown) =>
    fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("returns 422 when body is empty", async () => {
    const res = await post({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when customerId is missing", async () => {
    const res = await post({ products: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(422);
  });

  it("returns 422 when customerId is an empty string", async () => {
    const res = await post({ customerId: "", products: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(422);
  });

  it("returns 422 when products array is empty", async () => {
    const res = await post({ customerId: "test", products: [] });
    expect(res.status).toBe(422);
  });

  it("returns 422 when products is missing", async () => {
    const res = await post({ customerId: "test" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when productId is not a number", async () => {
    const res = await post({ customerId: "test", products: [{ productId: "not-a-number", quantity: 1 }] });
    expect(res.status).toBe(422);
  });

  it("returns 422 when quantity is missing from a product", async () => {
    const res = await post({ customerId: "test", products: [{ productId: 1 }] });
    expect(res.status).toBe(422);
  });
});

// ── Full order flow ───────────────────────────────────────────────────────────

// Unique customer per test run to avoid cross-run data collisions
const TEST_CUSTOMER = `e2e-${Date.now()}`;
let createdOrderId: number;

describe("Full order flow", () => {
  it("POST /orders creates an order with status 'pending' and returns an orderId", async () => {
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: TEST_CUSTOMER,
        products: [{ productId: 1, quantity: 2 }],
      }),
    });
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(typeof order.orderId).toBe("number");
    expect(order.status).toBe("pending");
    createdOrderId = order.orderId;
  });

  it("GET /orders/:id returns the created order with status 'pending'", async () => {
    const res = await fetch(`${BASE}/orders/${createdOrderId}`);
    expect(res.status).toBe(200);
    const order = await res.json();
    expect(order.id).toBe(createdOrderId);
    expect(order.customer_id).toBe(TEST_CUSTOMER);
    expect(order.status).toBe("pending");
  });

  it("kitchen-service receives the order via RabbitMQ and it appears in GET /kitchen/orders", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${BASE}/kitchen/orders`);
    expect(res.status).toBe(200);
    const kitchenOrders = await res.json();
    expect(Array.isArray(kitchenOrders)).toBe(true);
    const order = kitchenOrders.find((o: any) => o.orderId === createdOrderId);
    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
    expect(order.customerId).toBe(TEST_CUSTOMER);
  });

  it("PATCH /kitchen/orders/:id changes the order status to 'ongoing'", async () => {
    const res = await fetch(`${BASE}/kitchen/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ongoing" }),
    });
    expect(res.status).toBe(200);
    const order = await res.json();
    expect(order.status).toBe("ongoing");
    expect(order.orderId).toBe(createdOrderId);
  });

  it("POST /kitchen/orders/:id/done triggers order.ready and order status becomes 'ready'", async () => {
    const kitchenRes = await fetch(`${BASE}/kitchen/orders/${createdOrderId}/done`, {
      method: "POST",
    });
    expect(kitchenRes.status).toBe(200);
    const result = await kitchenRes.json();
    expect(result.orderId).toBe(createdOrderId);
    expect(result.notified).toBe(true);

    // Give RabbitMQ time to deliver order.ready to order-service
    await new Promise((r) => setTimeout(r, 1000));

    const orderRes = await fetch(`${BASE}/orders/${createdOrderId}`);
    expect(orderRes.status).toBe(200);
    const order = await orderRes.json();
    expect(order.status).toBe("ready");
  });

  it("notification-service creates a notification for the customer once the kitchen marks done", async () => {
    const res = await fetch(`${BASE}/notification/${TEST_CUSTOMER}`);
    expect(res.status).toBe(200);
    const notifications = await res.json();
    expect(Array.isArray(notifications)).toBe(true);
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].message).toBe("Your order is ready!");
    expect(notifications[0].customer_id).toBe(TEST_CUSTOMER);
  });
});

// ── Kitchen API ───────────────────────────────────────────────────────────────

describe("Kitchen API", () => {
  it("GET /kitchen/orders returns an array", async () => {
    const res = await fetch(`${BASE}/kitchen/orders`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("PATCH /kitchen/orders/:id returns 404 for a non-existent order", async () => {
    const res = await fetch(`${BASE}/kitchen/orders/999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ongoing" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /kitchen/orders/:id/done returns 404 for a non-existent order", async () => {
    const res = await fetch(`${BASE}/kitchen/orders/999999/done`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

// ── Error service ─────────────────────────────────────────────────────────────

describe("GET /errors", () => {
  it("returns HTTP 200 and an array", async () => {
    const res = await fetch(`${BASE}/errors`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("logs the order.created event — error-service has an entry for the created order", async () => {
    const res = await fetch(`${BASE}/errors?service=order-service`);
    expect(res.status).toBe(200);
    const entries = await res.json();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e: any) => e.message.includes(String(createdOrderId)));
    expect(entry).toBeDefined();
    expect(entry.service).toBe("order-service");
    expect(entry.severity).toBe("info");
  });

  it("filters results by ?service= query parameter — only returns entries for that service", async () => {
    const res = await fetch(`${BASE}/errors?service=order-service`);
    const data = await res.json();
    for (const entry of data) {
      expect(entry.service).toBe("order-service");
    }
  });

  it("GET /errors/:id returns the correct entry by id", async () => {
    const listRes = await fetch(`${BASE}/errors?service=order-service`);
    const list = await listRes.json();
    const first = list[0];
    const res = await fetch(`${BASE}/errors/${first.id}`);
    expect(res.status).toBe(200);
    const entry = await res.json();
    expect(entry.id).toBe(first.id);
    expect(entry.service).toBe("order-service");
    expect(typeof entry.message).toBe("string");
  });

  it("returns 404 for a non-existent error id", async () => {
    const res = await fetch(`${BASE}/errors/999999`);
    expect(res.status).toBe(404);
  });
});
