import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockAck = mock(() => {});
const mockNack = mock(() => {});
const mockAssertExchange = mock(async () => {});
const mockAssertQueue = mock(async () => ({ queue: "test-queue" }));
const mockBindQueue = mock(async () => {});

let capturedConsumer: ((msg: any) => Promise<void>) | null = null;
const mockConsume = mock(async (_queue: string, handler: (msg: any) => Promise<void>) => {
  capturedConsumer = handler;
});

const mockChannel = {
  assertExchange: mockAssertExchange,
  assertQueue: mockAssertQueue,
  bindQueue: mockBindQueue,
  publish: mock(() => {}),
  consume: mockConsume,
  ack: mockAck,
  nack: mockNack,
};

mock.module("amqplib", () => ({
  default: {
    connect: mock(async () => ({
      createChannel: mock(async () => mockChannel),
    })),
  },
}));

const { connectRabbitMQ, publish, consume } = await import("./rabbitmq");

describe("connectRabbitMQ", () => {
  it("establishes a channel", async () => {
    await connectRabbitMQ();
    expect(mockAssertExchange).not.toHaveBeenCalled();
  });
});

describe("publish", () => {
  beforeEach(async () => {
    mockAssertExchange.mockClear();
    mockChannel.publish.mockClear();
    await connectRabbitMQ();
  });

  it("asserts a fanout exchange and publishes the serialised message", async () => {
    const message = { orderId: 1, customerId: "c1" };

    await publish("order.ready", message);

    expect(mockAssertExchange).toHaveBeenCalledWith("order.ready", "fanout", { durable: true });
    expect(mockChannel.publish).toHaveBeenCalledWith(
      "order.ready",
      "",
      Buffer.from(JSON.stringify(message)),
    );
  });
});

describe("consume", () => {
  beforeEach(async () => {
    mockAssertExchange.mockClear();
    mockAssertQueue.mockClear();
    mockBindQueue.mockClear();
    mockAck.mockClear();
    mockNack.mockClear();
    capturedConsumer = null;
    await connectRabbitMQ();
  });

  it("asserts exchange and queue, binds them, and registers a consumer", async () => {
    const handler = mock(async () => {});

    await consume("order.created", "order.created.kitchen-service", handler);

    expect(mockAssertExchange).toHaveBeenCalledWith("order.created", "fanout", { durable: true });
    expect(mockAssertQueue).toHaveBeenCalledWith("order.created.kitchen-service", { durable: true });
    expect(mockBindQueue).toHaveBeenCalled();
    expect(mockConsume).toHaveBeenCalled();
  });

  it("calls handler with parsed message and acks on success", async () => {
    const handler = mock(async () => {});
    await consume("order.created", "order.created.kitchen-service", handler);

    const payload = { orderId: 42, customerId: "c1" };
    await capturedConsumer!({ content: Buffer.from(JSON.stringify(payload)) });

    expect(handler).toHaveBeenCalledWith(payload);
    expect(mockAck).toHaveBeenCalled();
    expect(mockNack).not.toHaveBeenCalled();
  });

  it("nacks when the handler throws", async () => {
    const handler = mock(async () => {
      throw new Error("handler failed");
    });
    await consume("order.created", "order.created.kitchen-service", handler);

    await capturedConsumer!({ content: Buffer.from(JSON.stringify({ orderId: 1 })) });

    expect(mockNack).toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
  });

  it("ignores null messages", async () => {
    const handler = mock(async () => {});
    await consume("order.created", "order.created.kitchen-service", handler);

    await capturedConsumer!(null);

    expect(handler).not.toHaveBeenCalled();
  });
});
