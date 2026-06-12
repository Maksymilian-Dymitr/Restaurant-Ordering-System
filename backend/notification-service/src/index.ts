import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { getNotification, postNotification, verifyConnection } from "./repository";
import { connectRabbitMQ, consume } from "./rabbitmq";

await verifyConnection();
await connectRabbitMQ();

await consume("order.ready", "order.ready.notification-service", async (message: any) => {
  await postNotification(message.customerId);
  console.log(`Order ${message.orderId} for customer ${message.customerId} is ready`);
});

new Elysia()
  .use(swagger({ documentation: { info: { title: "Notification Service", version: "1.0.0" } } }))
  .get("/notification/:customerId", async ({ params }) => {
    return getNotification(params.customerId);
  })
  .listen(3003, () => console.log("🦊 Elysia is running on port 3003"));
