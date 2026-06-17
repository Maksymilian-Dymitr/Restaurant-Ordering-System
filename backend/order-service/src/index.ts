import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { verifyConnection } from "./repository";
import * as repo from "./repository";
import { connectRabbitMQ, consume, publish } from "./rabbitmq";

// ── Schemas ───────────────────────────────────────────────────────────────────

const OrderId = t.Object({ id: t.Numeric() });

const NewOrderBody = t.Object({
  customerId: t.String({ minLength: 1 }),
  products: t.Array(
    t.Object({
      productId: t.Integer({ minimum: 1 }),
      quantity: t.Integer({ minimum: 1 }),
    }),
    { minItems: 1 },
  ),
});

// ── Setup ─────────────────────────────────────────────────────────────────────

await verifyConnection();
await connectRabbitMQ();

await consume("order.ready", "order.ready.order-service", async (message: any) => {
  await repo.updateOrderStatus(message.orderId);
});

// ── Routes ────────────────────────────────────────────────────────────────────

new Elysia()
  .use(swagger({ documentation: { info: { title: "Order Service", version: "1.0.0" } } }))
  .get("/orders", () => repo.getOrders())
  .get("/orders/:id", ({ params }) => repo.getOrderById(params.id), { params: OrderId })
  .post(
    "/orders",
    async ({ body, set }) => {
      set.status = 201;
      const orderId = await repo.postNewOrder(body.customerId);
      if (!orderId) return null;
      await repo.postProductToOrder(orderId, body.products);
      await publish("order.created", { customerId: body.customerId, orderId, products: body.products });
      return { status: "pending", orderId };
    },
    { body: NewOrderBody },
  )
  .listen(3002, () => console.log("🦊 Elysia is running on port 3002"));
