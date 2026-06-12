import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function verifyConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Connected to PostgreSQL");
  } catch (error) {
    console.error("❌ Error connecting:", error);
  }
}

export async function saveError(data: {
  service: string;
  message: string;
  stack?: string;
  severity: string;
}): Promise<void> {
  const query = `INSERT INTO service_errors (service, message, stack, severity) VALUES ($1, $2, $3, $4)`;
  try {
    await pool.query(query, [data.service, data.message, data.stack ?? null, data.severity]);
  } catch (error) {
    console.error("❌ Failed to persist error:", error);
  }
}

export async function getErrors(service?: string): Promise<any[]> {
  try {
    if (service) {
      const result = await pool.query(
        `SELECT * FROM service_errors WHERE service = $1 ORDER BY created_at DESC`,
        [service],
      );
      return result.rows;
    }
    const result = await pool.query(`SELECT * FROM service_errors ORDER BY created_at DESC`);
    return result.rows;
  } catch (error) {
    console.error("❌", error);
    return [];
  }
}

export async function getErrorById(id: number): Promise<any> {
  try {
    const result = await pool.query(`SELECT * FROM service_errors WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("❌", error);
    return null;
  }
}
