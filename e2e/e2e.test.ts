import { describe, it, expect } from "bun:test";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://localhost";

describe("GET /menu", () => {
  it("returns a list of products", async () => {
    const res = await fetch(`${BASE}/menu`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe("full order flow", () => {
  it("creates an order, waits for kitchen, checks status and notification", async () => {
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: "customer-e2e",
        products: [{ productId: 1, quantity: 1 }],
      }),
    });
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.orderId).toBeDefined();
    expect(order.status).toBe("pending");

    await new Promise((r) => setTimeout(r, 10000));

    const orderRes = await fetch(`${BASE}/orders/${order.orderId}`);
    expect(orderRes.status).toBe(200);
    const updated = await orderRes.json();
    expect(updated.status).toBe("ready");

    const notifRes = await fetch(`${BASE}/notification/customer-e2e`);
    expect(notifRes.status).toBe(200);
    const notifications = await notifRes.json();
    expect(Array.isArray(notifications)).toBe(true);
    expect(notifications.length).toBeGreaterThan(0);
  }, 15000);
});

describe("GET /errors", () => {
  it("returns an array of logged errors", async () => {
    const res = await fetch(`${BASE}/errors`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 404 for a non-existent error id", async () => {
    const res = await fetch(`${BASE}/errors/999999`);
    expect(res.status).toBe(404);
  });
});
