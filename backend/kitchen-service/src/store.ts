export interface KitchenOrder {
  orderId: number;
  customerId: string;
  products: Array<{ productId: number; quantity: number }>;
  status: "pending" | "ongoing" | "done";
  receivedAt: string;
}

export const orders = new Map<number, KitchenOrder>();
