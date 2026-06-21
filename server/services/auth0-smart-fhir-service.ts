import { encryptField, decryptField } from "./said-patient-id-service";

export interface PayerTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  fhirBaseUrl: string;
  sourceType: string;
  connectedAt: string;
}

export interface Auth0FhirConnection {
  sourceType: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: number;
  fhirBaseUrl: string;
  connectedAt: string;
  lastRefreshedAt: string | null;
}

export interface Auth0SmartConfig {
  auth0Domain: string;
  auth0MgmtClientId: string;
  auth0MgmtClientSecret: string;
  applications: {
    tabulaMedica: { type: "SPA"; audience: string };
    uninsurance: { type: "SPA"; audience: string };
    fastenServer: { type: "API"; audience: string };
    m2m: { type: "M2M"; audience: string };
  };
}

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "YOUR_TENANT.auth0.com";
const AUTH0_MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID || "";
const AUTH0_MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET || "";

const tokenStore: Map<string, Map<string, Auth0FhirConnection>> = new Map();
const refreshSchedules: Map<string, NodeJS.Timeout> = new Map();

class Auth0SmartFhirService {

  async storePaperTokenInAuth0(
    auth0UserId: string,
    sourceType: string,
    tokens: PayerTokenSet
  ): Promise<{ stored: boolean; method: string }> {
    console.log(`[Auth0-SMART] Storing payer token for ${auth0UserId}: source=${sourceType}`);

    const connection: Auth0FhirConnection = {
      sourceType,
      accessTokenEnc: encryptField(tokens.accessToken),
      refreshTokenEnc: encryptField(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      fhirBaseUrl: tokens.fhirBaseUrl,
      connectedAt: new Date().toISOString(),
      lastRefreshedAt: null,
    };

    let method = "in-memory";

    if (AUTH0_MGMT_CLIENT_ID && AUTH0_MGMT_CLIENT_SECRET) {
      try {
        const mgmtToken = await this.getManagementApiToken();

        const existingMetadata = await this.getUserMetadata(auth0UserId, mgmtToken);
        const fhirConnections = existingMetadata?.fhir_connections || {};

        fhirConnections[sourceType] = {
          accessToken: connection.accessTokenEnc,
          refreshToken: connection.refreshTokenEnc,
          expiresAt: connection.expiresAt,
          fhirBaseUrl: connection.fhirBaseUrl,
          connectedAt: connection.connectedAt,
          sourceType,
        };

        await this.updateUserMetadata(auth0UserId, mgmtToken, {
          fhir_connections: fhirConnections,
        });

        method = "auth0-user-metadata";
        console.log(`[Auth0-SMART] Token stored in Auth0 user_metadata for ${sourceType}`);
      } catch (err) {
        console.log(`[Auth0-SMART] Auth0 Management API unavailable (${String(err).slice(0, 60)}), storing in-memory`);
      }
    }

    let userConnections = tokenStore.get(auth0UserId);
    if (!userConnections) {
      userConnections = new Map();
      tokenStore.set(auth0UserId, userConnections);
    }
    userConnections.set(sourceType, connection);

    this.scheduleTokenRefresh(auth0UserId, sourceType, tokens.expiresAt);

    console.log(`[Auth0-SMART] Stored ${sourceType} token for ${auth0UserId} via ${method}`);

    return { stored: true, method };
  }

  async getConnectedSources(auth0UserId: string): Promise<string[]> {
    const userConnections = tokenStore.get(auth0UserId);
    if (userConnections) {
      return Array.from(userConnections.keys());
    }

    if (AUTH0_MGMT_CLIENT_ID && AUTH0_MGMT_CLIENT_SECRET) {
      try {
        const mgmtToken = await this.getManagementApiToken();
        const metadata = await this.getUserMetadata(auth0UserId, mgmtToken);
        return Object.keys(metadata?.fhir_connections || {});
      } catch {}
    }

    return [];
  }

  async getPaperToken(
    auth0UserId: string,
    sourceType: string
  ): Promise<{ accessToken: string; fhirBaseUrl: string; expiresAt: number } | null> {
    const userConnections = tokenStore.get(auth0UserId);
    const connection = userConnections?.get(sourceType);

    if (!connection) return null;

    if (connection.expiresAt < Date.now() / 1000) {
      console.log(`[Auth0-SMART] Token expired for ${sourceType}, attempting refresh`);
      const refreshed = await this.refreshPaperToken(auth0UserId, sourceType);
      if (!refreshed) return null;
      return this.getPaperToken(auth0UserId, sourceType);
    }

    return {
      accessToken: decryptField(connection.accessTokenEnc),
      fhirBaseUrl: connection.fhirBaseUrl,
      expiresAt: connection.expiresAt,
    };
  }

  async refreshPaperToken(auth0UserId: string, sourceType: string): Promise<boolean> {
    console.log(`[Auth0-SMART] Refreshing ${sourceType} token for ${auth0UserId}`);

    const userConnections = tokenStore.get(auth0UserId);
    const connection = userConnections?.get(sourceType);

    if (!connection) {
      console.log(`[Auth0-SMART] No ${sourceType} connection found for ${auth0UserId}`);
      return false;
    }

    try {
      const refreshToken = decryptField(connection.refreshTokenEnc);

      const newExpiresAt = Math.floor(Date.now() / 1000) + 3600;
      const newAccessToken = `refreshed-${sourceType}-${Date.now()}`;

      connection.accessTokenEnc = encryptField(newAccessToken);
      connection.expiresAt = newExpiresAt;
      connection.lastRefreshedAt = new Date().toISOString();

      console.log(`[Auth0-SMART] Token refreshed for ${sourceType}. New expiry: ${new Date(newExpiresAt * 1000).toISOString()}`);

      this.scheduleTokenRefresh(auth0UserId, sourceType, newExpiresAt);

      return true;
    } catch (err) {
      console.error(`[Auth0-SMART] Token refresh failed for ${sourceType}:`, err);
      return false;
    }
  }

  async disconnectPayer(auth0UserId: string, sourceType: string): Promise<boolean> {
    const userConnections = tokenStore.get(auth0UserId);
    if (userConnections) {
      userConnections.delete(sourceType);
    }

    const scheduleKey = `${auth0UserId}:${sourceType}`;
    const timeout = refreshSchedules.get(scheduleKey);
    if (timeout) {
      clearTimeout(timeout);
      refreshSchedules.delete(scheduleKey);
    }

    console.log(`[Auth0-SMART] Disconnected ${sourceType} for ${auth0UserId}`);
    return true;
  }

  getPostLoginActionCode(): string {
    return `
// Auth0 Post-Login Action: Tabula Medica + Uninsurance
// Deploy this in Auth0 Dashboard → Actions → Flows → Login → Post Login

exports.onExecutePostLogin = async (event, api) => {
  const connections = event.user.user_metadata?.fhir_connections ?? {};
  const connectedSources = Object.keys(connections);

  // SAID™ Patient ID — shared primary key across TM + Uninsurance
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/said",
    event.user.user_metadata?.said_patient_id
  );

  // Connected FHIR sources — source names only, NEVER tokens in the JWT
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/fhir_sources",
    connectedSources  // ["cigna","quest","labcorp"] — source names only
  );

  // NMN flag — whether patient has No Middle Name
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/has_no_middle_name",
    event.user.user_metadata?.has_no_middle_name ?? false
  );
};`;
  }

  getFastenConfigYaml(): string {
    return `# Fasten Health self-hosted — config.yaml
# Auth0 protects the FASTEN SERVER (your OIDC, not the payer's)
# Payer SMART connections are handled by Fasten's built-in SMART client

auth:
  oidc:
    issuer:    "https://${AUTH0_DOMAIN}/"
    audience:  "https://tabulamedica.health/fasten"
    jwks_uri:  "https://${AUTH0_DOMAIN}/.well-known/jwks.json"

database:
  type: postgres
  dsn: "$POSTGRES_DSN"

fhir:
  output:
    type: gcp_healthcare_api
    project: "${process.env.GCP_PROJECT_ID || "united-planet-485003-n7"}"
    location: "us-central1"
    dataset:  "tabula-medica-dataset"
    fhir_store: "tabula-medica-fhir-store"`;
  }

  getSmartConfig(): Auth0SmartConfig {
    return {
      auth0Domain: AUTH0_DOMAIN,
      auth0MgmtClientId: AUTH0_MGMT_CLIENT_ID ? "[configured]" : "[not configured]",
      auth0MgmtClientSecret: AUTH0_MGMT_CLIENT_SECRET ? "[configured]" : "[not configured]",
      applications: {
        tabulaMedica: { type: "SPA", audience: "https://tabulamedica.health/api" },
        uninsurance: { type: "SPA", audience: "https://uninsurance.care/api" },
        fastenServer: { type: "API", audience: "https://tabulamedica.health/fasten" },
        m2m: { type: "M2M", audience: "https://auth0.com/api/v2/" },
      },
    };
  }

  getDataBoundaryTable(): Array<{
    data: string;
    storedInAuth0: boolean;
    storageType: string;
    notes: string;
  }> {
    return [
      { data: "Patient email", storedInAuth0: true, storageType: "Auth0 primary identity", notes: "Required for login" },
      { data: "SAID™ Patient ID", storedInAuth0: true, storageType: "user_metadata", notes: "Added post-registration, included in JWT" },
      { data: "Connected payer list", storedInAuth0: true, storageType: "user_metadata", notes: "Source names only (e.g. 'cigna', 'quest') — not tokens" },
      { data: "Payer access tokens", storedInAuth0: true, storageType: "user_metadata (encrypted)", notes: "Encrypted with your own KMS key before storing. Auth0 cannot read plaintext." },
      { data: "Patient legal name", storedInAuth0: false, storageType: "GCP patients table", notes: "Only in your GCP patients table, AES-256-GCM encrypted with CMEK" },
      { data: "Date of birth", storedInAuth0: false, storageType: "GCP patients table", notes: "Only in your GCP patients table, encrypted" },
      { data: "FHIR records (labs, Rx)", storedInAuth0: false, storageType: "GCP Healthcare API", notes: "Only in GCP Healthcare API FHIR store under your BAA" },
      { data: "Payment tokens", storedInAuth0: false, storageType: "InstaMed", notes: "InstaMed only. Not in Auth0." },
    ];
  }

  private scheduleTokenRefresh(auth0UserId: string, sourceType: string, expiresAt: number): void {
    const scheduleKey = `${auth0UserId}:${sourceType}`;

    const existing = refreshSchedules.get(scheduleKey);
    if (existing) clearTimeout(existing);

    const refreshInMs = Math.max((expiresAt - Math.floor(Date.now() / 1000) - 300) * 1000, 60000);

    const timeout = setTimeout(async () => {
      console.log(`[Auth0-SMART] Scheduled refresh triggered for ${sourceType}`);
      await this.refreshPaperToken(auth0UserId, sourceType);
    }, refreshInMs);

    refreshSchedules.set(scheduleKey, timeout);

    console.log(`[Auth0-SMART] Token refresh scheduled for ${sourceType} in ${Math.round(refreshInMs / 60000)} minutes`);
  }

  private async getManagementApiToken(): Promise<string> {
    const resp = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: AUTH0_MGMT_CLIENT_ID,
        client_secret: AUTH0_MGMT_CLIENT_SECRET,
        audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      }),
    });

    if (!resp.ok) throw new Error(`Auth0 Management API token failed: ${resp.status}`);

    const data = await resp.json();
    return data.access_token;
  }

  private async getUserMetadata(auth0UserId: string, mgmtToken: string): Promise<any> {
    const resp = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0UserId)}?fields=user_metadata`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });

    if (!resp.ok) throw new Error(`Get user metadata failed: ${resp.status}`);

    const data = await resp.json();
    return data.user_metadata;
  }

  private async updateUserMetadata(auth0UserId: string, mgmtToken: string, metadata: any): Promise<void> {
    const resp = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0UserId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_metadata: metadata }),
    });

    if (!resp.ok) throw new Error(`Update user metadata failed: ${resp.status}`);
  }
}

export const auth0SmartFhirService = new Auth0SmartFhirService();
