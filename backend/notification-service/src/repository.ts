import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });

export async function verifyConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release()
    console.log("✅ Connected to PostgreSQL database");
    await redis.connect();
    console.log("✅ Connected to Redis database");
  } catch (error) {
    console.error("❌ Error connecting to the database:", error);
  }
}

export async function getNotification(customer_id: string): Promise<any> {
  const query = `SELECT * FROM notifications WHERE customer_id = $1`;
  const cacheKey = `notification:${customer_id}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await pool.query(query, [customer_id]);
    await redis.set(cacheKey, JSON.stringify(result.rows), { EX: 60 });
    return result.rows;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}

export async function postNotification(customer_id: string): Promise<number | null> {
  const query = `INSERT INTO notifications (customer_id, message) VALUES ($1, 'Your order is ready!') RETURNING id`;
  try {
    await redis.del(`notification:${customer_id}`);
    const result = await pool.query(query, [customer_id]);
    return result.rows[0].id;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}
