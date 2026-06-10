import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function testDatabaseConnection() {
  const result = await pool.query("select now() as current_time");
  return result.rows[0];
}