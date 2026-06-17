import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { connectRabbitMQ, consume, publish } from "./rabbitmq";
import { handleOrderCreated } from "./handler";
import { orders } from "./store";

// ── Schemas ───────────────────────────────────────────────────────────────────

const OrderId = t.Object({ id: t.Numeric() });

const UpdateStatusBody = t.Object({
  status: t.Union([t.Literal("pending"), t.Literal("ongoing"), t.Literal("done")]),
});

// ── Setup ─────────────────────────────────────────────────────────────────────

await connectRabbitMQ();

await consume("order.created", "order.created.kitchen-service", async (message: any) => {
  handleOrderCreated(message);
});

// ── Routes ────────────────────────────────────────────────────────────────────

new Elysia()
  .use(swagger({ documentation: { info: { title: "Kitchen Service", version: "1.0.0" } } }))
  .get("/kitchen/orders", () => Array.from(orders.values()))
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
      await publish("order.ready", { orderId: order.orderId, customerId: order.customerId });
      return { orderId: order.orderId, notified: true };
    },
    { params: OrderId },
  )
  .listen(3005, () => console.log("🦊 Kitchen Service is running on port 3005"));
