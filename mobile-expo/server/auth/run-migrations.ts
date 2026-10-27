/**
 * Lightweight boot-time migration runner. Task #68.
 *
 * Drizzle-kit push handles schema deltas in dev, but our auth migrations
 * also include data statements (backfills, deletes, column drops) that
 * drizzle-kit will not run. This runner executes the raw SQL migration files
 * in `migrations/` once at boot, idempotently. Each migration file is
 * required to be safe to re-run.
 *
 * Failures are logged but do NOT crash the server — the migrations are
 * additive and the existing Auth0 path keeps working without them.
 */
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { sql } from "drizzle-orm";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

export async function runIdempotentMigrations(): Promise<void> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return;
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      if (!text.trim()) continue;
      await db.execute(sql.raw(text));
      console.log(`[migrations] applied ${file}`);
    } catch (err) {
      console.warn(`[migrations] ${file} failed (continuing):`, err instanceof Error ? err.message : err);
    }
  }
}
