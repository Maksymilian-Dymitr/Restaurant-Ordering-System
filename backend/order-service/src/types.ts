export interface Order {
  id: number;
  customerId: number;
  status: string;
  createdAt: string;
}

export interface OrderItem {
  orderId: number;
  productId: Array<number>;
  quantity: Array<number>;
}

export interface OrderPayload {
  customerId: string;
  products: Array<{ productId: number; quantity: number }>;
}
