import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { verifyConnection } from "./repository";
import * as type from "../types";
import * as repo from "./repository";
import { connectRabbitMQ, consume, publish } from "./rabbitmq";

await verifyConnection();
await connectRabbitMQ();

await consume("order.ready", "order.ready.order-service", async (message: any) => {
  await repo.updateOrderStatus(message.orderId);
});

const newOrder = async (payload: type.OrderPayload) => {
  const { customerId, products } = payload;

  const orderId = await repo.postNewOrder(customerId);
  if (!orderId) return null;

  await repo.postProductToOrder(orderId, products);
  await publish("order.created", { customerId, orderId, products });

  return { status: "pending", orderId };
};

new Elysia()
  .use(swagger({ documentation: { info: { title: "Order Service", version: "1.0.0" } } }))
  .get("/orders", () => repo.getOrders())
  .get("/orders/:id", ({ params }) => repo.getOrderById(Number(params.id)))
  .post("/orders", async ({ body, set }) => {
    set.status = 201;
    return newOrder(body as type.OrderPayload);
  })
  .listen(3002, () => console.log("🦊 Elysia is running on port 3002"));
