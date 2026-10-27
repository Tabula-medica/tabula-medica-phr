/**
 * SMART-on-FHIR / TEFCA broker — payer-token storage.
 *
 * Historically this module proxied per-user payer-token storage through Auth0's
 * Management API (each user's encrypted tokens lived in
 * user_metadata.fhir_connections, keyed by the Auth0 sub). Task #104 retired
 * that path: payer tokens now live in our own Postgres table
 * (`payer_token_connections`), keyed by the internal `users.id`. Dropping the
 * Auth0 dependency for per-user storage is what allowed `users.auth0_id` and
 * the legacy `external_identities` rows with `provider="auth0"` to be removed.
 *
 * Auth0 itself is still the OIDC issuer for the upstream SMART/TEFCA broker
 * (Fasten Health) — that is a server-side trust relationship, not a per-user
 * identity. The post-login Action and Fasten config below still reference
 * `AUTH0_DOMAIN` because the broker needs the issuer URL, but no Auth0
 * Management API call (or AUTH0_MGMT_* credential) is made from this module
 * anymore.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { payerTokenConnections, auditLogs } from "@shared/schema";
import { encryptField, decryptField } from "./said-patient-service";
import { logger } from "./utils/logger";
import { isRetryableRefreshStatus, PAYER_REFRESH_TIMEOUT_MS } from "./payer-refresh-policy";

const getEncryptionKey = (): string => {
  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) throw new Error("PHI_ENCRYPTION_KEY required for token encryption");
  return key;
};

export interface PayerTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  fhirBaseUrl: string;
}

export interface StoredPayerConnection {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  fhirBaseUrl: string;
  connectedAt: string;
  sourceType: string;
}

export type SyncStatus = "active" | "needs_reauth" | "error";

/**
 * Short, non-PHI reason codes for a failed token refresh. These are the only
 * values ever written to `last_refresh_error` / logs / audit metadata — never
 * the token values, the upstream response body, or any secret.
 */
export type RefreshFailureReason =
  | "no_connection"
  | "missing_refresh_token"
  | "no_token_endpoint"
  | "refresh_rejected"
  | "refresh_exception";

export interface ConnectionHealth {
  sourceType: string;
  syncStatus: SyncStatus;
  needsReauth: boolean;
  lastRefreshError: string | null;
  lastRefreshAttemptAt: string | null;
  lastSyncedAt: string | null;
  expiresAt: string | null;
  connectedAt: string;
}

export async function storePayerToken(
  userId: string,
  sourceType: string,
  tokens: PayerTokens,
): Promise<void> {
  const key = getEncryptionKey();
  const encryptedAccess = encryptField(tokens.accessToken, key);
  const encryptedRefresh = tokens.refreshToken ? encryptField(tokens.refreshToken, key) : null;
  const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt) : null;
  const now = new Date();

  await db
    .insert(payerTokenConnections)
    .values({
      userId,
      sourceType,
      accessTokenEncrypted: encryptedAccess,
      refreshTokenEncrypted: encryptedRefresh,
      expiresAt,
      fhirBaseUrl: tokens.fhirBaseUrl || null,
      connectedAt: now,
      updatedAt: now,
      // A successful store/refresh clears any prior stale/needs-reauth state.
      syncStatus: "active",
      lastRefreshError: null,
      lastSyncedAt: now,
      consecutiveRefreshFailures: 0,
      nextRefreshRetryAt: null,
      lastRefreshAlertAt: null,
    })
    .onConflictDoUpdate({
      target: [payerTokenConnections.userId, payerTokenConnections.sourceType],
      set: {
        accessTokenEncrypted: encryptedAccess,
        refreshTokenEncrypted: encryptedRefresh,
        expiresAt,
        fhirBaseUrl: tokens.fhirBaseUrl || null,
        updatedAt: now,
        syncStatus: "active",
        lastRefreshError: null,
        lastSyncedAt: now,
        consecutiveRefreshFailures: 0,
        nextRefreshRetryAt: null,
        lastRefreshAlertAt: null,
      },
    });
}

export async function getPayerToken(
  userId: string,
  sourceType: string,
): Promise<StoredPayerConnection | null> {
  const key = getEncryptionKey();
  const [row] = await db
    .select()
    .from(payerTokenConnections)
    .where(
      and(
        eq(payerTokenConnections.userId, userId),
        eq(payerTokenConnections.sourceType, sourceType),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    accessToken: decryptField(row.accessTokenEncrypted, key),
    refreshToken: row.refreshTokenEncrypted ? decryptField(row.refreshTokenEncrypted, key) : "",
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : 0,
    fhirBaseUrl: row.fhirBaseUrl ?? "",
    connectedAt: row.connectedAt.toISOString(),
    sourceType: row.sourceType,
  };
}

export async function getConnectedSources(userId: string): Promise<string[]> {
  const rows = await db
    .select({ sourceType: payerTokenConnections.sourceType })
    .from(payerTokenConnections)
    .where(eq(payerTokenConnections.userId, userId));
  return rows.map((r) => r.sourceType);
}

/**
 * Per-source sync health for a user's linked payer/EHR connections. Lets the
 * client (or ops) detect a connection that has silently stopped syncing and
 * re-prompt the patient to reconnect. Returns no token material.
 */
export async function getConnectionHealth(
  userId: string,
): Promise<ConnectionHealth[]> {
  const rows = await db
    .select({
      sourceType: payerTokenConnections.sourceType,
      syncStatus: payerTokenConnections.syncStatus,
      lastRefreshError: payerTokenConnections.lastRefreshError,
      lastRefreshAttemptAt: payerTokenConnections.lastRefreshAttemptAt,
      lastSyncedAt: payerTokenConnections.lastSyncedAt,
      expiresAt: payerTokenConnections.expiresAt,
      connectedAt: payerTokenConnections.connectedAt,
    })
    .from(payerTokenConnections)
    .where(eq(payerTokenConnections.userId, userId));

  return rows.map((r) => {
    const status = (r.syncStatus as SyncStatus) ?? "active";
    return {
      sourceType: r.sourceType,
      syncStatus: status,
      needsReauth: status === "needs_reauth",
      lastRefreshError: r.lastRefreshError ?? null,
      lastRefreshAttemptAt: r.lastRefreshAttemptAt
        ? r.lastRefreshAttemptAt.toISOString()
        : null,
      lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      connectedAt: r.connectedAt.toISOString(),
    };
  });
}

/**
 * Records a failed token refresh so it is not silently swallowed:
 *   - emits a structured warn/error log (no token values / secrets),
 *   - writes an audit entry attributing it to the affected user + sourceType,
 *   - flips the connection's `sync_status` so the stale / needs-reauth state is
 *     queryable (skipped when there is no row, i.e. `no_connection`).
 *
 * `needs_reauth` means the patient must reconnect (revoked consent / expired or
 * missing refresh token / rejected grant). `error` means a server-side/transient
 * problem (no token endpoint resolved, network/parse exception) where ops should
 * look before asking the patient to do anything.
 */
async function recordRefreshFailure(
  userId: string,
  sourceType: string,
  reason: RefreshFailureReason,
  status: SyncStatus,
  extra?: { httpStatus?: number },
): Promise<void> {
  const now = new Date();
  const meta = {
    sourceType,
    reason,
    syncStatus: status,
    ...(extra?.httpStatus !== undefined ? { httpStatus: extra.httpStatus } : {}),
  };

  if (status === "error") {
    logger.error("Payer/EHR token refresh failed", { userId, ...meta });
  } else {
    logger.warn("Payer/EHR connection needs re-authentication", {
      userId,
      ...meta,
    });
  }

  // Persist the stale/needs-reauth state on the connection row so the client
  // can surface a "reconnect" prompt. `no_connection` has no row to update.
  if (reason !== "no_connection") {
    try {
      await db
        .update(payerTokenConnections)
        .set({
          syncStatus: status,
          lastRefreshError: reason,
          lastRefreshAttemptAt: now,
          consecutiveRefreshFailures: status === "error"
            ? sql`${payerTokenConnections.consecutiveRefreshFailures} + 1`
            : 0,
          // RHS expressions see the old count, so the first failure waits 5m,
          // then 10m, 20m, ... up to 6h. Also clears the worker's retry lease.
          nextRefreshRetryAt: status === "error"
            ? sql`${now}::timestamp + LEAST(21600, 300 * POWER(2, LEAST(${payerTokenConnections.consecutiveRefreshFailures}, 16))) * INTERVAL '1 second'`
            : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(payerTokenConnections.userId, userId),
            eq(payerTokenConnections.sourceType, sourceType),
          ),
        );
    } catch (err) {
      logger.error("Failed to persist payer connection sync_status", {
        userId,
        sourceType,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Audit entry — attributed to the affected user + sourceType, no token values.
  try {
    await db.insert(auditLogs).values({
      userId,
      action: "payer_token_refresh_failed",
      resourceType: "data_source",
      resourceId: sourceType,
      metadata: meta,
    });
  } catch (err) {
    logger.error("Failed to write payer_token_refresh_failed audit entry", {
      userId,
      sourceType,
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function refreshPayerToken(
  userId: string,
  sourceType: string,
): Promise<PayerTokens | null> {
  let stored: StoredPayerConnection | null;
  try {
    stored = await getPayerToken(userId, sourceType);
  } catch {
    // Includes decryption/config errors; never echo exceptions that can contain
    // request/token material. Persist these so scheduled retries back off too.
    await recordRefreshFailure(userId, sourceType, "refresh_exception", "error");
    return null;
  }
  if (!stored) {
    await recordRefreshFailure(userId, sourceType, "no_connection", "error");
    return null;
  }
  if (!stored.refreshToken) {
    await recordRefreshFailure(
      userId,
      sourceType,
      "missing_refresh_token",
      "needs_reauth",
    );
    return null;
  }

  const tokenEndpoint = getTokenEndpointForSource(sourceType, stored.fhirBaseUrl);
  if (!tokenEndpoint) {
    await recordRefreshFailure(
      userId,
      sourceType,
      "no_token_endpoint",
      "error",
    );
    return null;
  }

  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      signal: AbortSignal.timeout(PAYER_REFRESH_TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
        client_id: process.env[`SMART_${sourceType.toUpperCase()}_CLIENT_ID`] || "",
        ...(process.env[`SMART_${sourceType.toUpperCase()}_CLIENT_SECRET`]
          ? { client_secret: process.env[`SMART_${sourceType.toUpperCase()}_CLIENT_SECRET`]! }
          : {}),
      }),
    });
  } catch (err) {
    // Network/DNS/timeout — transient, ops-actionable. Do NOT log the error
    // object verbatim (could echo the request incl. the refresh token).
    logger.error("Payer/EHR token endpoint request threw", {
      userId,
      sourceType,
    });
    await recordRefreshFailure(
      userId,
      sourceType,
      "refresh_exception",
      "error",
    );
    return null;
  }

  if (!response.ok) {
    // Rate limiting, timeouts and upstream outages are retryable, not evidence
    // that the patient revoked consent. Never capture the response body.
    await recordRefreshFailure(
      userId,
      sourceType,
      "refresh_rejected",
      isRetryableRefreshStatus(response.status) ? "error" : "needs_reauth",
      { httpStatus: response.status },
    );
    return null;
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    logger.error("Payer/EHR token endpoint returned unparseable body", {
      userId,
      sourceType,
    });
    await recordRefreshFailure(
      userId,
      sourceType,
      "refresh_exception",
      "error",
    );
    return null;
  }

  if (typeof data?.access_token !== "string" || !data.access_token) {
    await recordRefreshFailure(userId, sourceType, "refresh_exception", "error");
    return null;
  }

  const newTokens: PayerTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    fhirBaseUrl: stored.fhirBaseUrl,
  };

  // storePayerToken resets sync_status back to "active" and clears the error.
  await storePayerToken(userId, sourceType, newTokens);
  return newTokens;
}

function getTokenEndpointForSource(sourceType: string, fhirBaseUrl: string): string | null {
  // Use the same registered issuer as source-specific reauthorization.
  const configuredEndpoint = process.env[`SMART_${sourceType.toUpperCase()}_TOKEN_URL`];
  if (configuredEndpoint) return configuredEndpoint;
  const knownEndpoints: Record<string, string> = {
    cigna: "https://oauth.cigna.com/oauth2/token",
    united: "https://api.uhc.com/oauth2/token",
    aetna: "https://oauth.aetna.com/v2/token",
    humana: "https://api.humana.com/oauth2/token",
    anthem: "https://oauth.anthem.com/oauth2/token",
    kaiser: "https://api.kaiserpermanente.org/oauth2/token",
  };

  if (knownEndpoints[sourceType]) return knownEndpoints[sourceType];

  if (fhirBaseUrl.includes("epic.com") || fhirBaseUrl.includes("epicfhir")) {
    return `${fhirBaseUrl.replace(/\/api\/FHIR.*/, "")}/oauth2/token`;
  }

  return null;
}

export const AUTH0_POST_LOGIN_ACTION = `
exports.onExecutePostLogin = async (event, api) => {
  const connections = event.user.user_metadata?.fhir_connections ?? {};
  const connectedSources = Object.keys(connections);

  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/said",
    event.user.user_metadata?.said_patient_id
  );
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/fhir_sources",
    connectedSources
  );
};
`;

export const FASTEN_CONFIG_YAML = `
auth:
  oidc:
    issuer: "https://YOUR_TENANT.auth0.com/"
    audience: "https://tabulamedica.health/fasten"
    jwks_uri: "https://YOUR_TENANT.auth0.com/.well-known/jwks.json"

database:
  type: postgres
  dsn: "$POSTGRES_DSN"

fhir:
  output:
    type: gcp_healthcare_api
    project: "$GCP_PROJECT_ID"
    location: "$GCP_LOCATION"
    dataset: "$GCP_HEALTHCARE_DATASET_ID"
    fhir_store: "$GCP_FHIR_STORE_ID"
`;

export function isAuth0FhirBrokerConfigured(): boolean {
  return !!process.env.AUTH0_DOMAIN;
}
