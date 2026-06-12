import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });

export async function verifyConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Connected to PostgreSQL");
    await redis.connect();
    console.log("✅ Connected to Redis");
  } catch (error) {
    console.error("❌ Error connecting:", error);
  }
}

export async function getOrders(): Promise<any[]> {
  const query = `SELECT * FROM orders`;
  try {
    const cached = await redis.get("order");
    if (cached) return JSON.parse(cached);
    const result = await pool.query(query);
    await redis.set("order", JSON.stringify(result.rows), { EX: 60 });
    return result.rows;
  } catch (error) {
    console.error("❌", error);
    return [];
  }
}

export async function getOrderById(id: number): Promise<any> {
  const query = `SELECT * FROM orders WHERE id = $1`;
  try {
    const result = await pool.query(query, [id]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}

export async function postNewOrder(customerId: string): Promise<number | null> {
  const query = `INSERT INTO orders (customer_id, status) VALUES ($1, 'pending') RETURNING id`;
  try {
    const result = await pool.query(query, [customerId]);
    await redis.del("order");
    return result.rows[0].id;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}

export async function postProductToOrder(
  orderId: number,
  products: Array<{ productId: number; quantity: number }>,
): Promise<void> {
  const query = `INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)`;
  try {
    for (const product of products) {
      await pool.query(query, [orderId, product.productId, product.quantity]);
    }
  } catch (error) {
    console.error("❌", error);
  }
}

export async function updateOrderStatus(orderId: number): Promise<void> {
  const query = `UPDATE orders SET status = 'ready' WHERE id = $1`;
  try {
    await pool.query(query, [orderId]);
    await redis.del("order");
  } catch (error) {
    console.error("❌", error);
  }
}
