import crypto from "crypto";

interface SecretCacheEntry {
  value: string;
  cachedAt: number;
  ttlMs: number;
}

type SecretSource = "gcp_secret_manager" | "env_var" | "cache";

interface SecretAccessLog {
  secretName: string;
  source: SecretSource;
  timestamp: Date;
  success: boolean;
  error?: string;
}

const SECRET_CACHE = new Map<string, SecretCacheEntry>();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const accessLog: SecretAccessLog[] = [];

function isGCPConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GCP_PROJECT_ID
  );
}

async function fetchFromGCPSecretManager(
  secretName: string,
  projectId: string
): Promise<string | null> {
  try {
    let token: string | null = null;

    try {
      const metadataUrl =
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
      const resp = await fetch(metadataUrl, {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = await resp.json();
        token = data.access_token;
      }
    } catch {
    }

    if (!token && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const key = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" })
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          iss: key.client_email,
          scope: "https://www.googleapis.com/auth/cloud-platform",
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        })
      ).toString("base64url");

      const signInput = `${header}.${payload}`;
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(signInput);
      const signature = sign.sign(key.private_key, "base64url");
      const jwt = `${signInput}.${signature}`;

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });

      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        token = tokenData.access_token;
      }
    }

    if (!token) return null;

    const secretPath = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const resp = await fetch(
      `https://secretmanager.googleapis.com/v1/${secretPath}:access`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!resp.ok) return null;

    const data = await resp.json();
    return Buffer.from(data.payload.data, "base64").toString("utf-8");
  } catch (err) {
    console.warn(
      `[SecretManager] Failed to fetch ${secretName} from GCP:`,
      (err as Error).message
    );
    return null;
  }
}

export async function getSecret(
  secretName: string,
  options?: { envFallback?: string; cacheTtlMs?: number }
): Promise<string | null> {
  const envKey = options?.envFallback || secretName;
  const ttl = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  const cached = SECRET_CACHE.get(secretName);
  if (cached && Date.now() - cached.cachedAt < cached.ttlMs) {
    logAccess(secretName, "cache", true);
    return cached.value;
  }

  if (isGCPConfigured()) {
    const projectId = process.env.GCP_PROJECT_ID;
    if (projectId) {
      const gcpValue = await fetchFromGCPSecretManager(secretName, projectId);
      if (gcpValue) {
        SECRET_CACHE.set(secretName, {
          value: gcpValue,
          cachedAt: Date.now(),
          ttlMs: ttl,
        });
        logAccess(secretName, "gcp_secret_manager", true);
        return gcpValue;
      }
    }
  }

  const envValue = process.env[envKey];
  if (envValue) {
    SECRET_CACHE.set(secretName, {
      value: envValue,
      cachedAt: Date.now(),
      ttlMs: ttl,
    });
    logAccess(secretName, "env_var", true);
    return envValue;
  }

  logAccess(secretName, "env_var", false, "Secret not found in any source");
  return null;
}

export async function getRequiredSecret(
  secretName: string,
  options?: { envFallback?: string; cacheTtlMs?: number }
): Promise<string> {
  const value = await getSecret(secretName, options);
  if (!value) {
    throw new Error(
      `Required secret "${secretName}" not found. Set ${options?.envFallback || secretName} or configure GCP Secret Manager.`
    );
  }
  return value;
}

export function clearSecretCache(secretName?: string): void {
  if (secretName) {
    SECRET_CACHE.delete(secretName);
  } else {
    SECRET_CACHE.clear();
  }
}

function logAccess(
  secretName: string,
  source: SecretSource,
  success: boolean,
  error?: string
): void {
  accessLog.push({
    secretName,
    source,
    timestamp: new Date(),
    success,
    error,
  });

  if (accessLog.length > 1000) {
    accessLog.splice(0, accessLog.length - 500);
  }
}

export function getSecretAccessLog(limit = 50): SecretAccessLog[] {
  return accessLog.slice(-limit);
}

export function getSecretManagerStatus(): {
  gcpConfigured: boolean;
  cachedSecrets: number;
  recentAccesses: number;
  sources: Record<SecretSource, number>;
} {
  const recent = accessLog.filter(
    (l) => Date.now() - l.timestamp.getTime() < 3600000
  );

  const sources: Record<SecretSource, number> = {
    gcp_secret_manager: 0,
    env_var: 0,
    cache: 0,
  };
  for (const entry of recent) {
    sources[entry.source]++;
  }

  return {
    gcpConfigured: isGCPConfigured(),
    cachedSecrets: SECRET_CACHE.size,
    recentAccesses: recent.length,
    sources,
  };
}

export const ENV_SECRET_MAP: Record<string, string> = {
  DB_PASSWORD: "DATABASE_URL",
  AGGREGATOR_WEBHOOK_SECRET: "AGGREGATOR_WEBHOOK_SECRET",
  PARTICLE_WEBHOOK_SECRET: "PARTICLE_WEBHOOK_SECRET",
  REDOX_WEBHOOK_SECRET: "REDOX_WEBHOOK_SECRET",
  ONEUP_WEBHOOK_SECRET: "ONEUP_WEBHOOK_SECRET",
  HUMANAPI_WEBHOOK_SECRET: "HUMANAPI_WEBHOOK_SECRET",
  FLEXPA_WEBHOOK_SECRET: "FLEXPA_WEBHOOK_SECRET",
  HEALTH_GORILLA_WEBHOOK_SECRET: "HEALTH_GORILLA_WEBHOOK_SECRET",
  EPIC_WEBHOOK_SECRET: "EPIC_WEBHOOK_SECRET",
  CERNER_WEBHOOK_SECRET: "CERNER_WEBHOOK_SECRET",
  PHI_ENCRYPTION_KEY: "PHI_ENCRYPTION_KEY",
  TWILIO_AUTH_TOKEN: "TWILIO_AUTH_TOKEN",
  OPENAI_API_KEY: "OPENAI_API_KEY",
};
