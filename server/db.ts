import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) {
  console.error("[DB] WARNING: DATABASE_URL is not set. Database operations will fail.");
}

const useCloudSqlSocket = Boolean(process.env.DATABASE_URL?.includes("/cloudsql/"));
const useIamAuth = process.env.DB_IAM_AUTH === "true";

async function getIamAccessToken(): Promise<string> {
  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const res = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch IAM token: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return data.access_token;
}

let poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: isProduction ? 30000 : 10000,
  max: isProduction ? 20 : 5,
  min: isProduction ? 2 : 0,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  allowExitOnIdle: !isProduction,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
};

if (isProduction && !useCloudSqlSocket) {
  poolConfig.ssl = { rejectUnauthorized: true };
}

const pool = new pg.Pool(poolConfig);

if (useIamAuth && isProduction && useCloudSqlSocket) {
  console.log("[DB] IAM authentication enabled — using short-lived access tokens (no password)");

  const originalConnect = pool.connect.bind(pool);
  pool.connect = async function (): Promise<pg.PoolClient> {
    try {
      const token = await getIamAccessToken();
      (pool.options as any).password = token;
    } catch (err: any) {
      console.error("[DB] IAM token fetch failed, connection may fail:", err.message);
    }
    return originalConnect();
  } as any;
} else if (isProduction && useCloudSqlSocket) {
  console.log("[DB] Using Cloud SQL Unix socket with password authentication");
} else if (isProduction) {
  console.log("[DB] Using TCP with TLS enforced (rejectUnauthorized: true)");
}

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
  if (err.message.includes("terminating connection") || err.message.includes("Connection terminated")) {
    console.log("[DB] Connection was terminated by server — pool will create new connections on demand");
  }
});

pool.on("connect", (client) => {
  client.on("error", (err) => {
    console.error("[DB] Client connection error:", err.message);
  });
});

if (isProduction) {
  console.log(`[DB] Pool configured: max=${poolConfig.max}, min=${poolConfig.min}, connectTimeout=${poolConfig.connectionTimeoutMillis}ms, idleTimeout=${poolConfig.idleTimeoutMillis}ms, keepAlive=true`);
}

export const db = drizzle(pool, { schema });
export { pool };
