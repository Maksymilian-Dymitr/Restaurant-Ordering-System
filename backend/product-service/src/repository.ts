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

export async function getMenu(): Promise<any[]> {
  const query = "SELECT * FROM products";
  try {
    const cached = await redis.get("menu");
    if (cached) return JSON.parse(cached);
  } catch {
    console.error("❌ Redis unavailable, falling back to PostgreSQL");
  }
  const result = await pool.query(query);
  try {
    await redis.set("menu", JSON.stringify(result.rows), { EX: 60 });
  } catch {}
  return result.rows;
}