import { describe, it, expect, beforeEach } from "bun:test";
import { handleOrderCreated } from "./handler";
import { orders } from "./store";

beforeEach(() => {
  orders.clear();
});

describe("handleOrderCreated", () => {
  it("adds the order to the kitchen queue with status 'pending'", () => {
    handleOrderCreated({ orderId: 42, customerId: "customer-1", products: [{ productId: 1, quantity: 2 }] });

    const stored = orders.get(42);
    expect(stored).toBeDefined();
    expect(stored!.orderId).toBe(42);
    expect(stored!.customerId).toBe("customer-1");
    expect(stored!.status).toBe("pending");
  });

  it("stores the products array from the message", () => {
    const products = [
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 1 },
    ];
    handleOrderCreated({ orderId: 7, customerId: "c1", products });

    expect(orders.get(7)!.products).toEqual(products);
  });

  it("defaults products to an empty array when omitted from message", () => {
    handleOrderCreated({ orderId: 1, customerId: "c1" });

    expect(orders.get(1)!.products).toEqual([]);
  });

  it("sets receivedAt to a valid ISO timestamp", () => {
    const before = new Date().toISOString();
    handleOrderCreated({ orderId: 5, customerId: "c2" });
    const after = new Date().toISOString();

    const { receivedAt } = orders.get(5)!;
    expect(receivedAt >= before).toBe(true);
    expect(receivedAt <= after).toBe(true);
  });

  it("overwrites a previously received order with the same orderId", () => {
    handleOrderCreated({ orderId: 10, customerId: "first" });
    handleOrderCreated({ orderId: 10, customerId: "second" });

    expect(orders.size).toBe(1);
    expect(orders.get(10)!.customerId).toBe("second");
  });
});
