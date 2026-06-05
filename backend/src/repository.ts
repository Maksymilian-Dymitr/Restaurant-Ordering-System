import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });

export async function verifyConnection(): Promise<void> {
  try {
    await pool.connect();
    console.log("✅ Connected to PostgreSQL database");
    await redis.connect();
    console.log("✅ Connected to Redis database");
  } catch (error) {
    console.error("❌ Error connecting to the database:", error);
  }
}

export async function getMenu(): Promise<any[]> {
  const query = "SELECT * FROM products";
  try {
    const cached = await redis.get("menu");
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await pool.query(query);
    await redis.set("menu", JSON.stringify(result.rows), { EX: 60 });
    return result.rows;
  } catch (error) {
    console.error("❌", error);
    return [];
  }
}

export async function getOrders(): Promise<any[]> {
  const query = `SELECT * FROM orders`;
  try {
    const cached = await redis.get("order");
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await pool.query(query);
    await redis.set("order", JSON.stringify(result.rows), { EX: 60 });
    return result.rows;
  } catch (error) {
    console.error("❌", error);
    return [];
  }
}

export async function getNotification(id: number): Promise<any> {
  const query = `SELECT * FROM notifications WHERE id = $1`;
  try {
    const result = await pool.query(query, [id]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("❌", error);
    return null;
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

export async function postNewOrder(customer_id: string): Promise<number | null> {
  const query = `INSERT INTO orders (customer_id, status) VALUES ($1, 'pending') RETURNING id`;
  try {
    const result = await pool.query(query, [customer_id]);
    return result.rows[0].id;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}

export async function postProductToOrder(
  orderId: number,
  products: Array<{ product_id: number; quantity: number }>,
): Promise<void> {
  const query = `INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)`;
  try {
    for (const product of products) {
      await pool.query(query, [orderId, product.product_id, product.quantity]);
    }
  } catch (error) {
    console.error("❌", error);
  }
}
