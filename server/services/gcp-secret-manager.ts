import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

const MANAGED_SECRETS = [
  "FASTEN_HEALTH_API_KEY",
  "FASTEN_HEALTH_CLIENT_ID",
  "FASTEN_HEALTH_REDIRECT_URL",
  "PHI_ENCRYPTION_KEY",
  "PHI_ENCRYPTION_SALT",
  "PHI_ENCRYPTION_SALT_V2",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
];

const REPLIT_PRIORITY_SECRETS: string[] = [];


let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient | null {
  if (client) return client;
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return null;
  }
  try {
    client = new SecretManagerServiceClient();
    return client;
  } catch (err: any) {
    console.error("[GCP-SecretManager] Failed to initialize client:", err?.message);
    return null;
  }
}

let authFailureLogged = false;
let authFailureLatched = false;

async function fetchSecret(secretName: string): Promise<string | null> {
  if (authFailureLatched) return null;
  const smClient = getClient();
  if (!smClient || !GCP_PROJECT_ID) return null;

  try {
    const name = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
    const [version] = await smClient.accessSecretVersion({ name });
    const payload = version.payload?.data;
    if (payload) {
      return typeof payload === "string" ? payload : Buffer.from(payload).toString("utf8");
    }
    return null;
  } catch (err: any) {
    if (err?.code === 5) {
      return null;
    }
    if (err?.code === 16 || /UNAUTHENTICATED|invalid authentication/i.test(err?.message || "")) {
      if (!authFailureLogged) {
        authFailureLogged = true;
        authFailureLatched = true;
        console.warn(`[GCP-SecretManager] Credentials rejected by GCP — falling back to Replit secrets only (suppressing further per-secret errors). First failed secret: ${secretName}`);
      }
      return null;
    }
    console.warn(`[GCP-SecretManager] Error fetching ${secretName}:`, err?.message);
    return null;
  }
}

export async function loadSecretsFromGCP(): Promise<{ loaded: string[]; skipped: string[]; fallback: string[] }> {
  const loaded: string[] = [];
  const skipped: string[] = [];
  const fallback: string[] = [];

  if (!GCP_PROJECT_ID) {
    console.log("[GCP-SecretManager] No GCP_PROJECT_ID set — using Replit secrets only");
    return { loaded, skipped, fallback: MANAGED_SECRETS.filter(s => !!process.env[s]) };
  }

  const smClient = getClient();
  if (!smClient) {
    console.log("[GCP-SecretManager] No GCP credentials available — using Replit secrets only");
    return { loaded, skipped, fallback: MANAGED_SECRETS.filter(s => !!process.env[s]) };
  }

  console.log(`[GCP-SecretManager] Loading secrets from project: ${GCP_PROJECT_ID}`);

  const allSecrets = [...MANAGED_SECRETS, ...REPLIT_PRIORITY_SECRETS];

  for (const secretName of allSecrets) {
    const isReplitPriority = REPLIT_PRIORITY_SECRETS.includes(secretName);
    
    if (isReplitPriority && process.env[secretName]) {
      fallback.push(secretName);
      continue;
    }

    try {
      const value = await fetchSecret(secretName);
      if (value) {
        process.env[secretName] = value;
        loaded.push(secretName);
      } else if (process.env[secretName]) {
        fallback.push(secretName);
      } else {
        skipped.push(secretName);
      }
    } catch (err: any) {
      if (process.env[secretName]) {
        fallback.push(secretName);
      } else {
        skipped.push(secretName);
      }
    }
  }

  console.log(`[GCP-SecretManager] Loaded ${loaded.length} from GCP, ${fallback.length} from Replit, ${skipped.length} not found`);
  if (loaded.length > 0) console.log(`[GCP-SecretManager] GCP secrets: ${loaded.join(", ")}`);
  if (fallback.length > 0) console.log(`[GCP-SecretManager] Replit fallback: ${fallback.join(", ")}`);
  if (skipped.length > 0) console.warn(`[GCP-SecretManager] Missing: ${skipped.join(", ")}`);

  return { loaded, skipped, fallback };
}

export async function storeSecret(secretName: string, value: string): Promise<boolean> {
  const smClient = getClient();
  if (!smClient || !GCP_PROJECT_ID) {
    console.warn("[GCP-SecretManager] Cannot store secret — no GCP credentials");
    return false;
  }

  try {
    const parent = `projects/${GCP_PROJECT_ID}`;
    try {
      await smClient.createSecret({
        parent,
        secretId: secretName,
        secret: { replication: { automatic: {} } },
      });
    } catch (err: any) {
      if (err?.code !== 6) throw err;
    }

    const secretPath = `projects/${GCP_PROJECT_ID}/secrets/${secretName}`;
    await smClient.addSecretVersion({
      parent: secretPath,
      payload: { data: Buffer.from(value, "utf8") },
    });

    console.log(`[GCP-SecretManager] Stored secret: ${secretName}`);
    return true;
  } catch (err: any) {
    console.error(`[GCP-SecretManager] Failed to store ${secretName}:`, err?.message);
    return false;
  }
}

export function getSecretManagerStatus(): {
  available: boolean;
  projectId: string | null;
  hasCredentials: boolean;
} {
  return {
    available: !!getClient() && !!GCP_PROJECT_ID,
    projectId: GCP_PROJECT_ID || null,
    hasCredentials: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  };
}
