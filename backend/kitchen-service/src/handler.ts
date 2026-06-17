import { orders, type KitchenOrder } from "./store";

export function handleOrderCreated(message: {
  orderId: number;
  customerId: string;
  products?: Array<{ productId: number; quantity: number }>;
}) {
  const order: KitchenOrder = {
    orderId: message.orderId,
    customerId: message.customerId,
    products: message.products ?? [],
    status: "pending",
    receivedAt: new Date().toISOString(),
  };
  orders.set(message.orderId, order);
  console.log(`New order received: #${message.orderId}`);
}
