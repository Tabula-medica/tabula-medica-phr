import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error(
    "[db] Unexpected Postgres pool error (recovered, server stays up):",
    err.message,
  );
});

export const db = drizzle(pool, { schema });
export { pool };
