import { describe, it, expect, mock, beforeEach } from "bun:test";
import { handleOrderCreated } from "./handler";

const mockPublish = mock(async () => {});

describe("handleOrderCreated", () => {
  beforeEach(() => {
    mockPublish.mockClear();
  });

  it("publishes order.ready with orderId and customerId", async () => {
    await handleOrderCreated({ orderId: 42, customerId: "customer-1" }, 0, mockPublish);

    expect(mockPublish).toHaveBeenCalledWith("order.ready", {
      orderId: 42,
      customerId: "customer-1",
    });
  });

  it("publishes exactly once per order", async () => {
    await handleOrderCreated({ orderId: 7, customerId: "customer-2" }, 0, mockPublish);

    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it("propagates publish errors to the caller", async () => {
    mockPublish.mockImplementation(() => Promise.reject(new Error("channel closed")));

    await expect(
      handleOrderCreated({ orderId: 1, customerId: "c1" }, 0, mockPublish),
    ).rejects.toThrow("channel closed");
  });
});
