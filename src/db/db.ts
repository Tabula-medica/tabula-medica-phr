import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  ssl:
    process.env.PGSSLMODE === "require" || /sslmode=require/i.test(process.env.DATABASE_URL ?? "")
      ? { rejectUnauthorized: false }
      : undefined,
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS ?? 30_000),
});

export const db = drizzle(pool);

export async function closeDb(): Promise<void> {
  await pool.end();
}
