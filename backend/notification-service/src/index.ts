import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { getNotification, postNotification, deleteNotification, verifyConnection } from "./repository";
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
  .delete("/notification/:customerId", async ({ params, set }) => {
    const ok = await deleteNotification(params.customerId);
    if (!ok) { set.status = 500; return { error: "Failed to delete notifications" }; }
    set.status = 204;
  })
  .listen(3003, () => console.log("🦊 Elysia is running on port 3003"));
