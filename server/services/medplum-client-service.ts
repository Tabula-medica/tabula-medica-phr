import { createHash } from "crypto";

const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL || "https://api.tabulamedica.health/";
const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID || "";
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET || "";
const MEDPLUM_BYPASS_HEADER = process.env.MEDPLUM_BYPASS_HEADER || "x-medplum-bypass";
const MEDPLUM_BYPASS_VALUE = process.env.MEDPLUM_BYPASS_VALUE || "";

export interface MedplumConnectionStatus {
  connected: boolean;
  baseUrl: string;
  authenticated: boolean;
  cloudflareBypass: boolean;
  lastCheckedAt: string;
  error?: string;
}

export interface MedplumPatientSearchParams {
  name?: string;
  identifier?: string;
  birthdate?: string;
  gender?: string;
  _count?: number;
  _offset?: number;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitized = { ...details };
  if (sanitized.patientId && typeof sanitized.patientId === "string") {
    sanitized.patientId = hashIdentifier(sanitized.patientId);
  }
  console.log(`[HIPAA-AUDIT][Medplum] ${timestamp} - ${action}`, JSON.stringify(sanitized));
}

function createBypassFetch(): typeof globalThis.fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set(MEDPLUM_BYPASS_HEADER, MEDPLUM_BYPASS_VALUE);
    return globalThis.fetch(input, { ...init, headers });
  };
}

// Lazy-load @medplum/core so that missing dependency / install failure cannot
// crash module import (which would block Cloud Run boot before the health
// probe can respond — root cause of revision 00142-ssr startup timeout).
let clientPromise: Promise<any | null> | null = null;

async function getClient(): Promise<any | null> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    try {
      const mod: any = await import("@medplum/core");
      const MedplumClient = mod.MedplumClient ?? mod.default?.MedplumClient;
      if (!MedplumClient) throw new Error("MedplumClient export not found");
      const client = new MedplumClient({
        baseUrl: MEDPLUM_BASE_URL,
        fetch: createBypassFetch(),
      });
      console.log(`[Medplum] Client initialized with baseUrl: ${MEDPLUM_BASE_URL}`);
      console.log(`[Medplum] Cloudflare WAF bypass header configured: ${MEDPLUM_BYPASS_HEADER}`);
      return client;
    } catch (err: any) {
      console.warn(
        `[Medplum] @medplum/core unavailable — Medplum endpoints will return 503. (${err?.message || err})`,
      );
      return null;
    }
  })();
  return clientPromise;
}

class MedplumClientService {
  private authenticated = false;

  async authenticate(): Promise<void> {
    if (this.authenticated) return;
    if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
      console.warn("[Medplum] Client credentials not configured — operating in unauthenticated mode");
      return;
    }
    const client = await getClient();
    if (!client) throw new Error("Medplum client not available (@medplum/core missing)");
    try {
      await client.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);
      this.authenticated = true;
      logHipaaAudit("MEDPLUM_AUTH_SUCCESS", { baseUrl: MEDPLUM_BASE_URL });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logHipaaAudit("MEDPLUM_AUTH_FAILURE", { baseUrl: MEDPLUM_BASE_URL, error: message });
      throw new Error(`Medplum authentication failed: ${message}`);
    }
  }

  async getStatus(): Promise<MedplumConnectionStatus> {
    const status: MedplumConnectionStatus = {
      connected: false,
      baseUrl: MEDPLUM_BASE_URL,
      authenticated: this.authenticated,
      cloudflareBypass: true,
      lastCheckedAt: new Date().toISOString(),
    };
    const client = await getClient();
    if (!client) {
      status.error = "@medplum/core dependency not installed";
      return status;
    }
    try {
      await this.authenticate();
      const result = await client.get("metadata");
      status.connected = !!result;
      status.authenticated = this.authenticated;
    } catch (err: unknown) {
      status.error = err instanceof Error ? err.message : String(err);
    }
    return status;
  }

  private async requireClient(): Promise<any> {
    const client = await getClient();
    if (!client) throw new Error("Medplum service unavailable: @medplum/core not installed");
    await this.authenticate();
    return client;
  }

  async searchPatients(params: MedplumPatientSearchParams): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_PATIENT_SEARCH", { searchParams: Object.keys(params) });
    const searchParams: Record<string, string> = {};
    if (params.name) searchParams["name"] = params.name;
    if (params.identifier) searchParams["identifier"] = params.identifier;
    if (params.birthdate) searchParams["birthdate"] = params.birthdate;
    if (params.gender) searchParams["gender"] = params.gender;
    if (params._count) searchParams["_count"] = String(params._count);
    if (params._offset) searchParams["_offset"] = String(params._offset);
    return client.search("Patient", searchParams);
  }

  async getPatient(id: string): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_PATIENT_READ", { patientId: id });
    return client.readResource("Patient", id);
  }

  async getResource(resourceType: string, id: string): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_RESOURCE_READ", { resourceType, resourceId: hashIdentifier(id) });
    return client.readResource(resourceType, id);
  }

  async searchResources(resourceType: string, params: Record<string, string> = {}): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_RESOURCE_SEARCH", { resourceType, searchParams: Object.keys(params) });
    return client.search(resourceType, params);
  }

  async createResource(resource: any): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_RESOURCE_CREATE", { resourceType: resource.resourceType });
    return client.createResource(resource);
  }

  async updateResource(resource: any): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_RESOURCE_UPDATE", {
      resourceType: resource.resourceType,
      resourceId: resource.id ? hashIdentifier(resource.id) : "new",
    });
    return client.updateResource(resource);
  }

  async getPatientEverything(patientId: string): Promise<any> {
    const client = await this.requireClient();
    logHipaaAudit("MEDPLUM_PATIENT_EVERYTHING", { patientId });
    return client.readPatientEverything(patientId);
  }
}

export const medplumService = new MedplumClientService();
