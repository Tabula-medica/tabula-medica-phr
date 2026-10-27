import { createHash } from "crypto";
import { db } from "./db";
import { auditLogs } from "@shared/schema";
import { sql, isNull, asc, inArray } from "drizzle-orm";

const BATCH_SIZE = 100;
const CRON_INTERVAL_MS = 5 * 60 * 1000;

async function getLastAnchorHash(): Promise<string> {
  try {
    const latest = await db
      .select({ blockchainAnchor: auditLogs.blockchainAnchor })
      .from(auditLogs)
      .where(sql`${auditLogs.blockchainAnchor} IS NOT NULL`)
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(1);
    if (latest.length > 0 && latest[0].blockchainAnchor) {
      const match = latest[0].blockchainAnchor.match(/sha256:([a-f0-9]+):/);
      if (match) return match[1];
    }
  } catch {}
  return "genesis";
}

function computeBatchHash(rows: { id: string; action: string; userId: string | null; createdAt: Date }[]): string {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(`${row.id}|${row.action}|${row.userId || ""}|${row.createdAt.toISOString()}`);
  }
  return hash.digest("hex");
}

async function anchorBatch(): Promise<{ anchored: number; hash: string | null }> {
  try {
    const unanchored = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        userId: auditLogs.userId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(isNull(auditLogs.blockchainAnchor))
      .orderBy(asc(auditLogs.createdAt))
      .limit(BATCH_SIZE);

    if (unanchored.length < BATCH_SIZE) {
      return { anchored: 0, hash: null };
    }

    const batchHash = computeBatchHash(unanchored);
    const previousHash = await getLastAnchorHash();
    const chainedHash = createHash("sha256")
      .update(`${previousHash}|${batchHash}`)
      .digest("hex");

    const anchor = `sha256:${chainedHash}:${new Date().toISOString()}:batch=${unanchored.length}`;

    const ids = unanchored.map((r) => r.id);
    await db
      .update(auditLogs)
      .set({ blockchainAnchor: anchor })
      .where(inArray(auditLogs.id, ids));

    console.log(`[blockchain-anchor] Anchored ${ids.length} audit logs, hash=${chainedHash.slice(0, 16)}...`);
    return { anchored: ids.length, hash: chainedHash };
  } catch (error) {
    console.error("[blockchain-anchor] Error anchoring batch:", error);
    return { anchored: 0, hash: null };
  }
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function startBlockchainAnchorCron(): void {
  if (cronHandle) return;
  console.log(`[blockchain-anchor] Starting cron (interval=${CRON_INTERVAL_MS / 1000}s, batchSize=${BATCH_SIZE})`);
  cronHandle = setInterval(async () => {
    let total = 0;
    let result = await anchorBatch();
    total += result.anchored;
    while (result.anchored === BATCH_SIZE) {
      result = await anchorBatch();
      total += result.anchored;
    }
    if (total > 0) {
      console.log(`[blockchain-anchor] Cycle complete: ${total} rows anchored`);
    }
  }, CRON_INTERVAL_MS);
}

export function stopBlockchainAnchorCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}

export { anchorBatch };
