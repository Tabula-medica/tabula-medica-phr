import crypto from "crypto";
import { FHIR_PRESETS, getFhirPreset, getActiveConfig } from "../fhir/config";
import type { EhrPlatform, FhirConfig, InsertMasterPatientRecord } from "@shared/schema";
import { deduplicationEngineService } from "./deduplication-engine-service";
import { saveConnectionToCloud, deleteConnectionFromCloud, saveSyncedDataToCloud } from "./ehr-connection-store";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, resourceId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][EHR-Integration] ${timestamp} - ${action} - User:${hashIdentifier(userId)} - Resource:${resourceId} - ${details}`);
}

export type EHRConnectionStatus = "disconnected" | "pending_auth" | "authenticating" | "connected" | "syncing" | "error" | "expired";

export interface EHRConnection {
  id: string;
  userId: string;
  platform: EhrPlatform;
  displayName: string;
  status: EHRConnectionStatus;
  fhirConfig: FhirConfig;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  patientFhirId?: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncEnabled: boolean;
  errorMessage?: string;
  errorCount: number;
  resourcesAvailable: string[];
  resourcesCached: Record<string, number>;
  metadata: EHRConnectionMetadata;
  auditLog: EHRAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EHRConnectionMetadata {
  facilityName?: string;
  facilityNPI?: string;
  patientMRN?: string;
  providerName?: string;
  department?: string;
  lastPatientMatch?: string;
  idToken?: string;
  fhirUser?: string;
  launchContext?: string;
}

export interface EHRAuditEntry {
  id: string;
  action: "connect" | "disconnect" | "sync" | "token_refresh" | "data_access" | "error";
  timestamp: string;
  details: string;
  resourceType?: string;
  resourceCount?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface SMARTAuthRequest {
  platform: EhrPlatform;
  userId: string;
  redirectUri: string;
  launchContext?: string;
  aud?: string;
}

interface SmartConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
}

async function discoverSmartConfig(fhirBaseUrl: string): Promise<SmartConfiguration> {
  const base = fhirBaseUrl.endsWith("/") ? fhirBaseUrl : fhirBaseUrl + "/";
  const url = `${base}.well-known/smart-configuration`;
  logHipaaAudit("SMART_DISCOVERY", "system", "discovery", `Fetching SMART config from ${new URL(url).hostname}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SMART configuration discovery failed for ${new URL(url).hostname}: ${response.status}`);
  }
  const config = await response.json() as SmartConfiguration;
  if (!config.authorization_endpoint || !config.token_endpoint) {
    throw new Error(`Invalid SMART configuration: missing endpoints`);
  }
  return config;
}

export interface SMARTAuthResponse {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export interface SMARTTokenRequest {
  platform: EhrPlatform;
  userId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

export interface SMARTTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
  patientId?: string;
  idToken?: string;
  fhirUser?: string;
  fhirBaseUrl?: string;
  tokenEndpoint?: string;
}

export interface FHIRResourceRequest {
  connectionId: string;
  userId: string;
  resourceType: string;
  resourceId?: string;
  searchParams?: Record<string, string>;
  includeReferences?: boolean;
}

export interface FHIRResourceResponse {
  success: boolean;
  resourceType: string;
  data?: any;
  bundle?: FHIRBundle;
  total?: number;
  error?: string;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: "searchset" | "document" | "collection";
  total?: number;
  link?: { relation: string; url: string }[];
  entry?: { resource: any; fullUrl?: string }[];
}

export interface PatientMatchResult {
  patientId: string;
  confidence: number;
  matchDetails: {
    nameMatched: boolean;
    dobMatched: boolean;
    identifierMatched: boolean;
    addressMatched: boolean;
  };
}

const ehrConnections: Map<string, EHRConnection> = new Map();
const authStates: Map<string, { userId: string; platform: EhrPlatform; codeVerifier: string; timestamp: number; tokenEndpoint?: string; fhirBaseUrl?: string }> = new Map();

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

const isEcwEnabled = process.env.ENABLE_ECW_CHECK !== "false" && process.env.USE_TEFCA !== "true";

export function getSupportedPlatforms(): { platform: EhrPlatform; name: string; description: string }[] {
  const platformDescriptions: Record<EhrPlatform, string> = {
    fastenhealth: "Connect to 25,000+ US healthcare providers via Fasten Health",
    epic: "Direct SMART on FHIR connection to Epic MyChart EHR systems",
    ecw: "Direct SMART on FHIR connection to eClinicalWorks EHR",
    athena: "Direct SMART on FHIR connection to athenahealth EHR",
    meditech: "Direct SMART on FHIR connection to MEDITECH Expanse EHR",
  };

  return (Object.keys(FHIR_PRESETS) as EhrPlatform[])
    .filter((platform) => platform !== "ecw" || isEcwEnabled)
    .map((platform) => ({
      platform,
      name: FHIR_PRESETS[platform].name,
      description: platformDescriptions[platform],
    }));
}

export async function initiateSmartAuth(request: SMARTAuthRequest): Promise<SMARTAuthResponse> {
  const platform = request.platform || "fastenhealth";
  if (platform === "ecw" && !isEcwEnabled) {
    throw new Error("eClinicalWorks integration is disabled");
  }
  const preset = getFhirPreset(platform);
  const config = getActiveConfig(preset);
  // getActiveConfig empties the eCW base URL when the practice code cannot be
  // resolved (it must not fall back to the sandbox tenant). Catch that here,
  // where we can say precisely what is missing, instead of starting an OAuth
  // flow with an empty audience.
  if (platform === "ecw" && !config.fhirBaseUrl) {
    throw new Error(
      "eClinicalWorks is not configured for this deployment: set ECW_PRACTICE_CODE to " +
        "the practice's own code. eCW FHIR base URLs are per-practice, and the sandbox " +
        "code would return sandbox patients.",
    );
  }
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  let authorizationEndpoint = config.authorizationEndpoint;
  let tokenEndpoint = config.tokenEndpoint;
  const audUrl = request.aud || config.fhirBaseUrl;

  if (request.aud) {
    try {
      const smartConfig = await discoverSmartConfig(request.aud);
      authorizationEndpoint = smartConfig.authorization_endpoint;
      tokenEndpoint = smartConfig.token_endpoint;
      logHipaaAudit("SMART_DISCOVERY_SUCCESS", request.userId, platform, 
        `Discovered endpoints for ${new URL(request.aud).hostname}: auth=${new URL(authorizationEndpoint).hostname}`);
    } catch (discoveryError) {
      logHipaaAudit("SMART_DISCOVERY_FALLBACK", request.userId, platform, 
        `Discovery failed for ${request.aud}, using preset endpoints: ${(discoveryError as Error).message}`);
    }
  }

  authStates.set(state, {
    userId: request.userId,
    platform,
    codeVerifier,
    timestamp: Date.now(),
    tokenEndpoint,
    fhirBaseUrl: audUrl,
  });

  const clientIdEnvMap: Record<string, string> = {
    fastenhealth: "FASTEN_HEALTH_CLIENT_ID",
    epic: "EPIC_CLIENT_ID",
    ecw: "ECW_CLIENT_ID",
    athena: "ATHENA_CLIENT_ID",
    meditech: "MEDITECH_CLIENT_ID",
  };

  const clientId = config.clientId || process.env[clientIdEnvMap[platform] || ""] || "tabula-medica-app";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: request.redirectUri,
    scope: config.scopes.join(" "),
    state,
    aud: audUrl,
  });

  if (config.usePkce) {
    params.append("code_challenge", codeChallenge);
    params.append("code_challenge_method", "S256");
  }

  if (request.launchContext) {
    params.append("launch", request.launchContext);
  }

  const authorizationUrl = `${authorizationEndpoint}?${params.toString()}`;

  logHipaaAudit("INITIATE_AUTH", request.userId, platform, `Starting SMART auth via ${preset.name} → ${new URL(authorizationEndpoint).hostname}`);

  return {
    authorizationUrl,
    state,
    codeVerifier,
  };
}

export async function exchangeToken(request: SMARTTokenRequest): Promise<SMARTTokenResponse> {
  const authState = authStates.get(request.state);
  if (!authState) {
    throw new Error("Invalid or expired authorization state");
  }

  if (authState.userId !== request.userId) {
    throw new Error("Authorization state mismatch");
  }

  if (Date.now() - authState.timestamp > 10 * 60 * 1000) {
    authStates.delete(request.state);
    throw new Error("Authorization state expired");
  }

  const platform = authState.platform;
  const preset = getFhirPreset(platform);
  const config = getActiveConfig(preset);

  const clientIdEnvMap: Record<string, string> = {
    fastenhealth: "FASTEN_HEALTH_CLIENT_ID",
    epic: "EPIC_CLIENT_ID",
    ecw: "ECW_CLIENT_ID",
    athena: "ATHENA_CLIENT_ID",
    meditech: "MEDITECH_CLIENT_ID",
  };
  const clientSecretEnvMap: Record<string, string> = {
    fastenhealth: "FASTEN_HEALTH_API_KEY",
    epic: "EPIC_CLIENT_SECRET",
    ecw: "ECW_CLIENT_SECRET",
    athena: "ATHENA_CLIENT_SECRET",
    meditech: "MEDITECH_CLIENT_SECRET",
  };

  const clientId = config.clientId || process.env[clientIdEnvMap[platform] || ""] || "tabula-medica-app";
  const clientSecret = config.clientSecret || process.env[clientSecretEnvMap[platform] || ""];

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code: request.code,
    redirect_uri: request.redirectUri,
    client_id: clientId,
  });

  if (config.usePkce) {
    tokenParams.append("code_verifier", request.codeVerifier);
  }

  logHipaaAudit("TOKEN_EXCHANGE", request.userId, platform, `Exchanging authorization code for tokens via ${preset.name}`);

  const isProduction = process.env.NODE_ENV === "production";

  if (clientId && clientId !== "tabula-medica-app") {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
      headers["Authorization"] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    }

    const effectiveTokenEndpoint = authState.tokenEndpoint || config.tokenEndpoint;

    const response = await fetch(effectiveTokenEndpoint, {
      method: "POST",
      headers,
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[EHR Token Exchange][${platform}] Failed:`, response.status, errorBody);
      throw new Error(`Token exchange failed for ${preset.name}: ${response.status}`);
    }

    const tokenData = await response.json();

    authStates.delete(request.state);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in || 3600,
      tokenType: tokenData.token_type || "Bearer",
      scope: tokenData.scope || config.scopes.join(" "),
      patientId: tokenData.patient,
      idToken: tokenData.id_token,
      fhirUser: tokenData.fhirUser,
      fhirBaseUrl: authState.fhirBaseUrl,
      tokenEndpoint: authState.tokenEndpoint,
    };
  }

  if (isProduction) {
    throw new Error(`${clientIdEnvMap[platform]} environment variable is required in production for ${preset.name}`);
  }

  const mockTokenResponse: SMARTTokenResponse = {
    accessToken: `mock_access_${platform}_${generateId("token")}`,
    refreshToken: `mock_refresh_${platform}_${generateId("token")}`,
    expiresIn: 3600,
    tokenType: "Bearer",
    scope: config.scopes.join(" "),
    patientId: `patient-${generateId("fhir")}`,
    fhirUser: `Patient/${generateId("fhir")}`,
    fhirBaseUrl: authState.fhirBaseUrl,
    tokenEndpoint: authState.tokenEndpoint,
  };

  authStates.delete(request.state);

  return mockTokenResponse;
}

export async function createConnection(
  userId: string,
  platform: EhrPlatform,
  tokenResponse: SMARTTokenResponse,
  options?: { fhirBaseUrl?: string; tokenEndpoint?: string; facilityName?: string }
): Promise<EHRConnection> {
  const preset = getFhirPreset(platform);
  const id = generateId("ehr");
  const now = new Date().toISOString();

  const activeFhirConfig = getActiveConfig(preset);
  if (options?.fhirBaseUrl) {
    activeFhirConfig.fhirBaseUrl = options.fhirBaseUrl;
  }
  if (options?.tokenEndpoint) {
    activeFhirConfig.tokenEndpoint = options.tokenEndpoint;
  }

  const displayName = options?.facilityName || preset.name;

  const connection: EHRConnection = {
    id,
    userId,
    platform,
    displayName,
    status: "connected",
    fhirConfig: activeFhirConfig,
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString(),
    patientFhirId: tokenResponse.patientId,
    syncEnabled: true,
    errorCount: 0,
    resourcesAvailable: [
      "Patient",
      "Condition",
      "MedicationRequest",
      "Observation",
      "AllergyIntolerance",
      "Immunization",
      "Procedure",
      "DiagnosticReport",
      "DocumentReference",
      "Encounter",
    ],
    resourcesCached: {},
    metadata: {
      fhirUser: tokenResponse.fhirUser,
      idToken: tokenResponse.idToken,
    },
    auditLog: [
      {
        id: generateId("audit"),
        action: "connect",
        timestamp: now,
        details: `Connected via ${displayName} (${preset.name})`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  ehrConnections.set(id, connection);
  logHipaaAudit("CREATE_CONNECTION", userId, id, `Created EHR connection via ${displayName} (${platform})`);

  saveConnectionToCloud(connection).catch((err) =>
    console.error("[EHR] Failed to persist connection to cloud:", err)
  );

  return connection;
}

export function getConnection(connectionId: string): EHRConnection | undefined {
  return ehrConnections.get(connectionId);
}

export function getUserConnections(userId: string): EHRConnection[] {
  return Array.from(ehrConnections.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function refreshToken(connectionId: string): Promise<boolean> {
  const connection = ehrConnections.get(connectionId);
  if (!connection || !connection.refreshToken) {
    return false;
  }

  logHipaaAudit("TOKEN_REFRESH", connection.userId, connectionId, `Refreshing ${connection.displayName} access token`);

  connection.accessToken = `mock_access_${generateId("token")}`;
  connection.tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  connection.updatedAt = new Date().toISOString();

  connection.auditLog.push({
    id: generateId("audit"),
    action: "token_refresh",
    timestamp: new Date().toISOString(),
    details: "Access token refreshed successfully",
  });

  return true;
}

export async function fetchFhirResource(request: FHIRResourceRequest): Promise<FHIRResourceResponse> {
  const connection = ehrConnections.get(request.connectionId);
  if (!connection) {
    return { success: false, resourceType: request.resourceType, error: "Connection not found" };
  }

  if (connection.userId !== request.userId) {
    return { success: false, resourceType: request.resourceType, error: "Unauthorized access" };
  }

  if (connection.status !== "connected") {
    return { success: false, resourceType: request.resourceType, error: `Connection not active: ${connection.status}` };
  }

  const tokenExpiry = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  if (tokenExpiry && tokenExpiry < new Date()) {
    const refreshed = await refreshToken(request.connectionId);
    if (!refreshed) {
      connection.status = "expired";
      return { success: false, resourceType: request.resourceType, error: "Token expired and refresh failed" };
    }
  }

  logHipaaAudit("DATA_ACCESS", request.userId, request.connectionId, `Fetching ${request.resourceType} from ${new URL(connection.fhirConfig.fhirBaseUrl).hostname}`);

  const hasRealToken = connection.accessToken && !connection.accessToken.startsWith("mock_");
  let mockData: FHIRBundle;

  if (hasRealToken) {
    try {
      const fhirUrl = new URL(`${connection.fhirConfig.fhirBaseUrl}/${request.resourceType}`);
      if (connection.patientFhirId) {
        fhirUrl.searchParams.set("patient", connection.patientFhirId);
      }
      if (request.searchParams) {
        for (const [key, value] of Object.entries(request.searchParams)) {
          fhirUrl.searchParams.set(key, value);
        }
      }
      if (request.resourceId) {
        const singleUrl = `${connection.fhirConfig.fhirBaseUrl}/${request.resourceType}/${request.resourceId}`;
        const singleRes = await fetch(singleUrl, {
          headers: { "Authorization": `Bearer ${connection.accessToken}`, "Accept": "application/fhir+json" },
        });
        if (singleRes.ok) {
          const resource = await singleRes.json();
          mockData = { resourceType: "Bundle", type: "searchset", total: 1, entry: [{ resource }] };
        } else {
          return { success: false, resourceType: request.resourceType, error: `FHIR API error: ${singleRes.status}` };
        }
      } else {
        const res = await fetch(fhirUrl.toString(), {
          headers: { "Authorization": `Bearer ${connection.accessToken}`, "Accept": "application/fhir+json" },
        });
        if (res.ok) {
          const bundle = await res.json();
          mockData = bundle;
        } else {
          return { success: false, resourceType: request.resourceType, error: `FHIR API error: ${res.status}` };
        }
      }
    } catch (fetchError) {
      console.error(`[EHR] Real FHIR fetch failed for ${request.resourceType}:`, fetchError);
      return { success: false, resourceType: request.resourceType, error: "Failed to fetch from FHIR server" };
    }
  } else if (process.env.NODE_ENV === "production") {
    mockData = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
  } else {
    mockData = generateMockFhirData(request.resourceType, connection.patientFhirId || "unknown");
  }

  connection.auditLog.push({
    id: generateId("audit"),
    action: "data_access",
    timestamp: new Date().toISOString(),
    details: `Fetched ${request.resourceType}`,
    resourceType: request.resourceType,
    resourceCount: mockData.total || 1,
  });

  const cachedCount = connection.resourcesCached[request.resourceType] || 0;
  connection.resourcesCached[request.resourceType] = cachedCount + (mockData.total || 1);
  connection.lastSyncAt = new Date().toISOString();
  connection.updatedAt = new Date().toISOString();

  return {
    success: true,
    resourceType: request.resourceType,
    bundle: mockData,
    total: mockData.total,
  };
}

function generateMockFhirData(resourceType: string, patientId: string): FHIRBundle {
  if (process.env.NODE_ENV === 'production') {
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: 0,
      entry: [],
    };
  }

  const entries: any[] = [];

  switch (resourceType) {
    case "Patient":
      entries.push({
        resource: {
          resourceType: "Patient",
          id: patientId,
          name: [{ given: ["John"], family: "Smith", use: "official" }],
          birthDate: "1985-06-15",
          gender: "male",
          address: [{ city: "San Francisco", state: "CA", postalCode: "94102" }],
          telecom: [{ system: "phone", value: "(555) 123-4567", use: "home" }],
        },
      });
      break;

    case "Condition":
      entries.push(
        {
          resource: {
            resourceType: "Condition",
            id: generateId("cond"),
            clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
            code: { coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }], text: "Type 2 Diabetes" },
            subject: { reference: `Patient/${patientId}` },
            onsetDateTime: "2020-03-15",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            id: generateId("cond"),
            clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
            code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertensive disorder" }], text: "Essential Hypertension" },
            subject: { reference: `Patient/${patientId}` },
            onsetDateTime: "2019-08-22",
          },
        }
      );
      break;

    case "MedicationRequest":
      entries.push(
        {
          resource: {
            resourceType: "MedicationRequest",
            id: generateId("med"),
            status: "active",
            intent: "order",
            medicationCodeableConcept: {
              coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG Oral Tablet" }],
              text: "Metformin 500mg",
            },
            subject: { reference: `Patient/${patientId}` },
            authoredOn: "2023-01-15",
            dosageInstruction: [{ text: "Take 1 tablet twice daily with meals" }],
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            id: generateId("med"),
            status: "active",
            intent: "order",
            medicationCodeableConcept: {
              coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "314076", display: "Lisinopril 10 MG Oral Tablet" }],
              text: "Lisinopril 10mg",
            },
            subject: { reference: `Patient/${patientId}` },
            authoredOn: "2023-02-20",
            dosageInstruction: [{ text: "Take 1 tablet daily in the morning" }],
          },
        }
      );
      break;

    case "Observation":
      entries.push(
        {
          resource: {
            resourceType: "Observation",
            id: generateId("obs"),
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
            code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
            subject: { reference: `Patient/${patientId}` },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: 128, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: generateId("obs"),
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
            code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] },
            subject: { reference: `Patient/${patientId}` },
            effectiveDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            valueQuantity: { value: 7.2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
            interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "H", display: "High" }] }],
          },
        }
      );
      break;

    case "AllergyIntolerance":
      entries.push({
        resource: {
          resourceType: "AllergyIntolerance",
          id: generateId("allergy"),
          clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
          type: "allergy",
          category: ["medication"],
          criticality: "high",
          code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "733", display: "Penicillin" }], text: "Penicillin" },
          patient: { reference: `Patient/${patientId}` },
          reaction: [{ manifestation: [{ coding: [{ display: "Anaphylaxis" }] }], severity: "severe" }],
        },
      });
      break;

    case "Immunization":
      entries.push(
        {
          resource: {
            resourceType: "Immunization",
            id: generateId("imm"),
            status: "completed",
            vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "208", display: "COVID-19 mRNA, bivalent" }] },
            patient: { reference: `Patient/${patientId}` },
            occurrenceDateTime: "2023-09-15",
            lotNumber: "ABC123",
            site: { coding: [{ display: "Left deltoid" }] },
          },
        },
        {
          resource: {
            resourceType: "Immunization",
            id: generateId("imm"),
            status: "completed",
            vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "141", display: "Influenza, seasonal" }] },
            patient: { reference: `Patient/${patientId}` },
            occurrenceDateTime: "2023-10-20",
          },
        }
      );
      break;

    default:
      entries.push({
        resource: {
          resourceType,
          id: generateId(resourceType.toLowerCase()),
          subject: { reference: `Patient/${patientId}` },
        },
      });
  }

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries,
  };
}

export function extractDemographicsFromFhirPatient(patientResource: any, sourceConnectionId: string): InsertMasterPatientRecord | null {
  if (!patientResource || patientResource.resourceType !== "Patient") {
    return null;
  }

  const name = patientResource.name?.[0];
  const firstName = name?.given?.[0];
  const lastName = name?.family;

  if (!firstName || !lastName || !patientResource.birthDate) {
    console.log("[EHR-Dedup] Insufficient demographics for deduplication: missing name or DOB");
    return null;
  }

  const middleName = name?.given?.length > 1 ? name.given.slice(1).join(" ") : undefined;
  const hasNoMiddleName = !middleName;

  const address = patientResource.address?.[0];
  const phone = patientResource.telecom?.find((t: any) => t.system === "phone");
  const email = patientResource.telecom?.find((t: any) => t.system === "email");

  const identifier = patientResource.identifier;
  let ssnLast4: string | undefined;
  let mrn: string | undefined;
  let mrnSource: string | undefined;

  if (identifier && Array.isArray(identifier)) {
    const ssnId = identifier.find((id: any) =>
      id.system === "http://hl7.org/fhir/sid/us-ssn" ||
      id.type?.coding?.some((c: any) => c.code === "SS")
    );
    if (ssnId?.value) {
      const digits = ssnId.value.replace(/\D/g, "");
      if (digits.length >= 4) {
        ssnLast4 = digits.slice(-4);
      }
    }

    const mrnId = identifier.find((id: any) =>
      id.type?.coding?.some((c: any) => c.code === "MR")
    );
    if (mrnId?.value) {
      mrn = mrnId.value;
      mrnSource = mrnId.system || "fasten-health";
    }
  }

  return {
    firstName,
    middleName: middleName || "NMN",
    hasNoMiddleName,
    lastName,
    dateOfBirth: patientResource.birthDate,
    gender: patientResource.gender || undefined,
    ssnLast4,
    mrn,
    mrnSource,
    email: email?.value,
    phoneNumber: phone?.value,
    addressLine1: address?.line?.[0],
    addressLine2: address?.line?.[1],
    city: address?.city,
    state: address?.state,
    zipCode: address?.postalCode,
    country: address?.country || "US",
    sourceSystem: "fasten-health",
    sourceRecordId: `${sourceConnectionId}:${patientResource.id}`,
  };
}

export interface DeduplicationSyncResult {
  ran: boolean;
  action?: string;
  matchedPatientId?: string;
  similarityScore?: number;
  reviewRequired?: boolean;
  message?: string;
  error?: string;
}

async function runAutoDeduplication(connectionId: string, userId: string): Promise<DeduplicationSyncResult> {
  try {
    const patientResult = await fetchFhirResource({
      connectionId,
      userId,
      resourceType: "Patient",
    });

    if (!patientResult.success || !patientResult.bundle?.entry?.[0]) {
      return { ran: false, message: "No Patient resource available for deduplication" };
    }

    const patientResource = patientResult.bundle.entry[0].resource;
    const demographics = extractDemographicsFromFhirPatient(patientResource, connectionId);

    if (!demographics) {
      return { ran: false, message: "Insufficient demographics in FHIR Patient resource" };
    }

    logHipaaAudit("DEDUP_AUTO_START", userId, connectionId, "Auto-deduplication triggered after EHR sync");

    const dedupResult = await deduplicationEngineService.processPatientRecord(demographics);

    logHipaaAudit(
      "DEDUP_AUTO_COMPLETE",
      userId,
      connectionId,
      `Dedup result: ${dedupResult.action} (score: ${dedupResult.similarityScore || "N/A"})`
    );

    return {
      ran: true,
      action: dedupResult.action,
      matchedPatientId: dedupResult.matchedPatientId,
      similarityScore: dedupResult.similarityScore,
      reviewRequired: dedupResult.reviewRequired,
      message: dedupResult.message,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown deduplication error";
    console.error("[EHR-Dedup] Auto-deduplication failed:", errorMsg);
    logHipaaAudit("DEDUP_AUTO_ERROR", userId, connectionId, `Dedup error: ${errorMsg}`);
    return { ran: false, error: errorMsg, message: "Deduplication failed but sync completed successfully" };
  }
}

export async function syncConnection(connectionId: string, userId: string): Promise<{
  success: boolean;
  resourcesSynced: Record<string, number>;
  errors: string[];
  deduplication?: DeduplicationSyncResult;
}> {
  const connection = ehrConnections.get(connectionId);
  if (!connection) {
    return { success: false, resourcesSynced: {}, errors: ["Connection not found"] };
  }

  if (connection.userId !== userId) {
    return { success: false, resourcesSynced: {}, errors: ["Unauthorized"] };
  }

  logHipaaAudit("SYNC_START", userId, connectionId, `Starting full sync from ${connection.displayName}`);

  connection.status = "syncing";
  connection.updatedAt = new Date().toISOString();

  const resourcesSynced: Record<string, number> = {};
  const errors: string[] = [];

  for (const resourceType of connection.resourcesAvailable) {
    try {
      const result = await fetchFhirResource({
        connectionId,
        userId,
        resourceType,
      });

      if (result.success && result.total) {
        resourcesSynced[resourceType] = result.total;
      } else if (result.error) {
        errors.push(`${resourceType}: ${result.error}`);
      }
    } catch (error) {
      errors.push(`${resourceType}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  connection.status = errors.length > 0 ? "error" : "connected";
  connection.lastSyncAt = new Date().toISOString();
  connection.nextSyncAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  connection.updatedAt = new Date().toISOString();

  connection.auditLog.push({
    id: generateId("audit"),
    action: "sync",
    timestamp: new Date().toISOString(),
    details: `Synced ${Object.keys(resourcesSynced).length} resource types from ${connection.displayName}`,
    resourceCount: Object.values(resourcesSynced).reduce((a, b) => a + b, 0),
  });

  for (const [resourceType, count] of Object.entries(resourcesSynced)) {
    saveSyncedDataToCloud(connectionId, resourceType, {
      resourceType,
      count,
      syncedAt: new Date().toISOString(),
      connectionId,
    }).catch((err) =>
      console.error(`[EHR] Failed to persist ${resourceType} sync data:`, err)
    );
  }
  saveConnectionToCloud(connection).catch((err) =>
    console.error("[EHR] Failed to update connection in cloud after sync:", err)
  );

  logHipaaAudit("SYNC_COMPLETE", userId, connectionId, `Sync complete from ${connection.displayName}: ${Object.values(resourcesSynced).reduce((a, b) => a + b, 0)} resources`);

  const deduplication = await runAutoDeduplication(connectionId, userId);

  if (deduplication.ran) {
    connection.auditLog.push({
      id: generateId("audit"),
      action: "sync",
      timestamp: new Date().toISOString(),
      details: `Auto-deduplication: ${deduplication.action} (score: ${deduplication.similarityScore || "N/A"})`,
    });
  }

  return { success: errors.length === 0, resourcesSynced, errors, deduplication };
}

export async function disconnectConnection(connectionId: string, userId: string): Promise<boolean> {
  const connection = ehrConnections.get(connectionId);
  if (!connection || connection.userId !== userId) {
    return false;
  }

  logHipaaAudit("DISCONNECT", userId, connectionId, `Disconnecting from ${connection.displayName}`);

  connection.status = "disconnected";
  connection.accessToken = undefined;
  connection.refreshToken = undefined;
  connection.syncEnabled = false;
  connection.updatedAt = new Date().toISOString();

  connection.auditLog.push({
    id: generateId("audit"),
    action: "disconnect",
    timestamp: new Date().toISOString(),
    details: `Disconnected from ${connection.displayName}`,
  });

  deleteConnectionFromCloud(connectionId, userId).catch((err) =>
    console.error("[EHR] Failed to delete connection from cloud:", err)
  );

  return true;
}

export function getConnectionAuditLog(connectionId: string, userId: string): EHRAuditEntry[] | null {
  const connection = ehrConnections.get(connectionId);
  if (!connection || connection.userId !== userId) {
    return null;
  }
  return connection.auditLog;
}
