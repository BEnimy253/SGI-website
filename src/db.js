import "dotenv/config";  // Load environment variables from .env file
import pg from "pg";

const { Pool } = pg;

// Create a connection pool to the PostgreSQL database using the connection string from environment variables
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Not check SSL certificate, because Supabase uses self-signed certificates
    ssl: {
        rejectUnauthorized: false,
    },
});

// Function to test the database connection by running a simple query
export async function testDatabaseConnection() {
    // Test the database connection by running a simple query
    const result = await pool.query("select now() as current_time");
    return result.rows[0];
}