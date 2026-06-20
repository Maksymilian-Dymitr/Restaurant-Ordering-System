import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { connectRabbitMQ, consume, publish } from "./rabbitmq";
import { handleOrderCreated } from "./handler";
import { orders } from "./store";

const OrderId = t.Object({ id: t.Numeric() });

const UpdateStatusBody = t.Object({
  status: t.Union([t.Literal("pending"), t.Literal("ongoing"), t.Literal("done")]),
});

const KITCHEN_API_KEY = process.env.KITCHEN_API_KEY ?? "";

await connectRabbitMQ();

await consume("order.created", "order.created.kitchen-service", async (message: any) => {
  handleOrderCreated(message);
});

new Elysia()
  .use(swagger({ documentation: { info: { title: "Kitchen Service", version: "1.0.0" } } }))
  .onBeforeHandle(({ headers, set }) => {
    if (headers["x-kitchen-key"] !== KITCHEN_API_KEY) {
      set.status = 403;
      return { error: "Forbidden" };
    }
  })
  .get("/kitchen/orders", () => Array.from(orders.values()))
  .get("/kitchen/orders/stream", () => {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
      start(controller) {
        const push = () => {
          const payload = encoder.encode(`data: ${JSON.stringify(Array.from(orders.values()))}\n\n`);
          controller.enqueue(payload);
        };
        push();
        timer = setInterval(push, 5000);
      },
      cancel() {
        clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  })
  .patch(
    "/kitchen/orders/:id",
    ({ params, body, set }) => {
      const order = orders.get(params.id);
      if (!order) {
        set.status = 404;
        return { error: "Order not found" };
      }
      order.status = body.status;
      return order;
    },
    { params: OrderId, body: UpdateStatusBody },
  )
  .post(
    "/kitchen/orders/:id/done",
    async ({ params, set }) => {
      const order = orders.get(params.id);
      if (!order) {
        set.status = 404;
        return { error: "Order not found" };
      }
      order.status = "done";
      orders.delete(params.id);
      await publish("order.ready", { orderId: order.orderId, customerId: order.customerId });
      return { orderId: order.orderId, notified: true };
    },
    { params: OrderId },
  )
  .listen(3005, () => console.log("🦊 Kitchen Service is running on port 3005"));
