import type { OAuthTokens, FhirConfig, EhrConnection } from "@shared/schema";
import { isTokenExpired, refreshAccessToken } from "./oauth";
import { storage } from "../storage";

export interface FhirBundle {
  resourceType: "Bundle";
  type: string;
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: FhirResource;
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
  [key: string]: unknown;
}

export interface FhirPatient extends FhirResource {
  resourceType: "Patient";
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: { text?: string };
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

export interface FhirCondition extends FhirResource {
  resourceType: "Condition";
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  subject?: { reference?: string };
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: { display?: string };
}

export interface FhirObservation extends FhirResource {
  resourceType: "Observation";
  status?: string;
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: { value?: number; unit?: string; code?: string };
  valueString?: string;
  valueCodeableConcept?: {
    coding?: Array<{ code?: string; display?: string }>;
    text?: string;
  };
  component?: Array<{
    code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
    valueQuantity?: { value?: number; unit?: string };
  }>;
  performer?: Array<{ display?: string }>;
}

export interface FhirMedicationRequest extends FhirResource {
  resourceType: "MedicationRequest";
  status?: string;
  intent?: string;
  medicationCodeableConcept?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  medicationReference?: { reference?: string; display?: string };
  subject?: { reference?: string };
  authoredOn?: string;
  requester?: { display?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
    doseAndRate?: Array<{
      doseQuantity?: { value?: number; unit?: string };
    }>;
  }>;
  dispenseRequest?: {
    numberOfRepeatsAllowed?: number;
    quantity?: { value?: number; unit?: string };
  };
}

export interface FhirImmunization extends FhirResource {
  resourceType: "Immunization";
  status?: string;
  vaccineCode?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  patient?: { reference?: string };
  occurrenceDateTime?: string;
  location?: { display?: string };
  performer?: Array<{ actor?: { display?: string } }>;
}

export interface FhirDocumentReference extends FhirResource {
  resourceType: "DocumentReference";
  status?: string;
  type?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  subject?: { reference?: string };
  date?: string;
  author?: Array<{ display?: string }>;
  description?: string;
  content?: Array<{
    attachment?: {
      contentType?: string;
      url?: string;
      title?: string;
      size?: number;
    };
  }>;
}

export interface FhirAllergyIntolerance extends FhirResource {
  resourceType: "AllergyIntolerance";
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  type?: string;
  category?: string[];
  criticality?: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  patient?: { reference?: string };
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: { display?: string };
  reaction?: Array<{
    substance?: { coding?: Array<{ display?: string }>; text?: string };
    manifestation?: Array<{ coding?: Array<{ display?: string }>; text?: string }>;
    severity?: string;
  }>;
}

export interface FhirProcedure extends FhirResource {
  resourceType: "Procedure";
  status?: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  subject?: { reference?: string };
  performedDateTime?: string;
  performedPeriod?: { start?: string; end?: string };
  performer?: Array<{ actor?: { display?: string } }>;
  location?: { display?: string };
  reasonCode?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

export interface FhirEncounter extends FhirResource {
  resourceType: "Encounter";
  status?: string;
  class?: { code?: string; display?: string };
  type?: Array<{ coding?: Array<{ display?: string }>; text?: string }>;
  subject?: { reference?: string };
  participant?: Array<{ individual?: { display?: string } }>;
  period?: { start?: string; end?: string };
  reasonCode?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
  location?: Array<{ location?: { display?: string } }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000];
const MAX_PAGES = 20;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429 || (response.status >= 500 && attempt < retries)) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAYS[attempt] || 8000;
        console.log(`[FhirClient] Retry ${attempt + 1}/${retries} after ${delay}ms for ${url}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      if (attempt < retries && (err.name === "AbortError" || err.code === "ECONNRESET")) {
        const delay = RETRY_DELAYS[attempt] || 8000;
        console.log(`[FhirClient] Retry ${attempt + 1}/${retries} after network error: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

export class FhirClient {
  private connection: EhrConnection;
  private tokens: OAuthTokens;

  constructor(connection: EhrConnection) {
    if (!connection.tokens) {
      throw new Error("Connection has no tokens");
    }
    if (!connection.fhirConfig) {
      throw new Error("Connection has no FHIR configuration");
    }
    this.connection = connection;
    this.tokens = connection.tokens;
  }

  private async ensureValidToken(): Promise<string> {
    if (isTokenExpired(this.tokens.expiresAt)) {
      if (!this.tokens.refreshToken) {
        throw new Error("Token expired and no refresh token available");
      }
      if (!this.connection.fhirConfig) {
        throw new Error("No FHIR config for token refresh");
      }
      const newTokens = await refreshAccessToken({
        fhirConfig: this.connection.fhirConfig,
        refreshToken: this.tokens.refreshToken,
        clientId: this.connection.fhirConfig.clientId,
      });
      this.tokens = newTokens;
      await storage.updateEhrConnectionTokens(this.connection.id, newTokens);
    }
    return this.tokens.accessToken;
  }

  private getHeaders(token: string): Record<string, string> {
    return {
      Authorization: `${this.tokens.tokenType} ${token}`,
      Accept: "application/fhir+json",
    };
  }

  private async fetchResource<T extends FhirResource>(path: string): Promise<T> {
    const token = await this.ensureValidToken();
    const baseUrl = this.connection.fhirConfig!.fhirBaseUrl;
    const url = `${baseUrl}/${path}`;

    const response = await fetchWithRetry(url, { headers: this.getHeaders(token) });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private async fetchAllBundlePages(initialPath: string): Promise<FhirResource[]> {
    const token = await this.ensureValidToken();
    const baseUrl = this.connection.fhirConfig!.fhirBaseUrl;
    const url = `${baseUrl}/${initialPath}`;
    const headers = this.getHeaders(token);

    const allResources: FhirResource[] = [];
    let nextUrl: string | null = url;
    let page = 0;

    while (nextUrl && page < MAX_PAGES) {
      const response = await fetchWithRetry(nextUrl, { headers });
      if (!response.ok) {
        if (page === 0) {
          const errorText = await response.text();
          throw new Error(`FHIR request failed: ${response.status} - ${errorText}`);
        }
        break;
      }

      const bundle: FhirBundle = await response.json();
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource) {
            allResources.push(entry.resource);
          }
        }
      }

      nextUrl = bundle.link?.find((l) => l.relation === "next")?.url || null;
      page++;
    }

    return allResources;
  }

  async getPatient(patientId: string): Promise<FhirPatient> {
    return this.fetchResource<FhirPatient>(`Patient/${patientId}`);
  }

  async getConditions(patientId: string): Promise<FhirCondition[]> {
    const resources = await this.fetchAllBundlePages(`Condition?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "Condition") as FhirCondition[];
  }

  async getObservations(patientId: string, category?: string): Promise<FhirObservation[]> {
    let path = `Observation?patient=${patientId}&_count=100`;
    if (category) path += `&category=${category}`;
    const resources = await this.fetchAllBundlePages(path);
    return resources.filter((r) => r.resourceType === "Observation") as FhirObservation[];
  }

  async getMedicationRequests(patientId: string): Promise<FhirMedicationRequest[]> {
    const resources = await this.fetchAllBundlePages(`MedicationRequest?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "MedicationRequest") as FhirMedicationRequest[];
  }

  async getImmunizations(patientId: string): Promise<FhirImmunization[]> {
    const resources = await this.fetchAllBundlePages(`Immunization?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "Immunization") as FhirImmunization[];
  }

  async getDocumentReferences(patientId: string): Promise<FhirDocumentReference[]> {
    const resources = await this.fetchAllBundlePages(`DocumentReference?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "DocumentReference") as FhirDocumentReference[];
  }

  async getAllergyIntolerances(patientId: string): Promise<FhirAllergyIntolerance[]> {
    const resources = await this.fetchAllBundlePages(`AllergyIntolerance?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "AllergyIntolerance") as FhirAllergyIntolerance[];
  }

  async getProcedures(patientId: string): Promise<FhirProcedure[]> {
    const resources = await this.fetchAllBundlePages(`Procedure?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "Procedure") as FhirProcedure[];
  }

  async getEncounters(patientId: string): Promise<FhirEncounter[]> {
    const resources = await this.fetchAllBundlePages(`Encounter?patient=${patientId}`);
    return resources.filter((r) => r.resourceType === "Encounter") as FhirEncounter[];
  }

  async getAllPatientData(patientId: string) {
    const [
      patient,
      conditions,
      observations,
      medications,
      immunizations,
      documents,
      allergies,
      procedures,
      encounters,
    ] = await Promise.all([
      this.getPatient(patientId),
      this.getConditions(patientId).catch((e) => { console.error("[FhirClient] Conditions fetch failed:", e.message); return []; }),
      this.getObservations(patientId).catch((e) => { console.error("[FhirClient] Observations fetch failed:", e.message); return []; }),
      this.getMedicationRequests(patientId).catch((e) => { console.error("[FhirClient] Medications fetch failed:", e.message); return []; }),
      this.getImmunizations(patientId).catch((e) => { console.error("[FhirClient] Immunizations fetch failed:", e.message); return []; }),
      this.getDocumentReferences(patientId).catch((e) => { console.error("[FhirClient] Documents fetch failed:", e.message); return []; }),
      this.getAllergyIntolerances(patientId).catch((e) => { console.error("[FhirClient] Allergies fetch failed:", e.message); return []; }),
      this.getProcedures(patientId).catch((e) => { console.error("[FhirClient] Procedures fetch failed:", e.message); return []; }),
      this.getEncounters(patientId).catch((e) => { console.error("[FhirClient] Encounters fetch failed:", e.message); return []; }),
    ]);

    return {
      patient,
      conditions,
      observations,
      medications,
      immunizations,
      documents,
      allergies,
      procedures,
      encounters,
    };
  }
}
