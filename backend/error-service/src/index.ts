import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { verifyConnection, saveError, getErrors, getErrorById } from "./repository";
import { connectRabbitMQ, consume } from "./rabbitmq";

await verifyConnection();
await connectRabbitMQ();

await consume("order.created", "order.created.error-service", async (message: any) => {
  await saveError({
    service: "order-service",
    message: `Order created: orderId=${message.orderId}, customerId=${message.customerId}`,
    severity: "info",
  });
  console.log(`Logged order.created event: orderId=${message.orderId}`);
});

await consume("service.error", "service.error.error-service", async (message: any) => {
  await saveError({
    service: message.service,
    message: message.message,
    stack: message.stack,
    severity: message.severity ?? "server",
  });
  console.log(`Logged [${message.severity ?? "server"}] error from ${message.service}: ${message.message}`);
});

new Elysia()
  .use(swagger({ documentation: { info: { title: "Error Service", version: "1.0.0" } } }))
  .onError(({ error, set }) => {
    set.status = 500;
    return { error: error.message };
  })
  .get("/errors", ({ query }) => getErrors(query.service as string | undefined))
  .get("/errors/:id", async ({ params, set }) => {
    const entry = await getErrorById(Number(params.id));
    if (!entry) {
      set.status = 404;
      return { error: "Error not found" };
    }
    return entry;
  })
  .listen(3004, () => console.log("🦊 Elysia is running on port 3004"));
