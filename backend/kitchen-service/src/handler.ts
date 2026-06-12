import { publish as defaultPublish } from "./rabbitmq";

export async function handleOrderCreated(
  message: { orderId: number; customerId: string },
  delay = 3000,
  publish = defaultPublish,
) {
  console.log("new order:", message.orderId);
  await new Promise((r) => setTimeout(r, delay)); // kitchen sim
  await publish("order.ready", { orderId: message.orderId, customerId: message.customerId });
  console.log("Meal done");
}
