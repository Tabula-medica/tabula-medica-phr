import { storage } from "../storage";
import type { InsertHealthRecord, InsertDataSource } from "@shared/schema";
import { mapFhirToHealthRecord } from "../fhir-client";
import { AuditService, AuditAction, ResourceType } from "../compliance/audit-service";

export type AggregatorProvider = "1uphealth" | "human_api" | "flexpa";

export interface AggregatorConfig {
  provider: AggregatorProvider;
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
}

export interface AggregatorConnection {
  id: string;
  userId: string;
  provider: AggregatorProvider;
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  connectedSources: ConnectedHealthSource[];
  createdAt: Date;
  lastSyncAt?: Date;
}

export interface ConnectedHealthSource {
  id: string;
  name: string;
  type: "hospital" | "pharmacy" | "lab" | "insurance" | "provider";
  logo?: string;
  lastSync?: Date;
  recordCount?: number;
}

const AGGREGATOR_ENDPOINTS: Record<AggregatorProvider, { sandbox: string; production: string }> = {
  "1uphealth": {
    sandbox: "https://api.1up.health/fhir/dstu2",
    production: "https://api.1up.health/fhir/r4",
  },
  human_api: {
    sandbox: "https://api.humanapi.co/v1",
    production: "https://api.humanapi.co/v1",
  },
  flexpa: {
    sandbox: "https://api.flexpa.com/fhir",
    production: "https://api.flexpa.com/fhir",
  },
};

const SUPPORTED_PROVIDERS: Record<AggregatorProvider, { name: string; description: string; supportedSources: string[] }> = {
  "1uphealth": {
    name: "1upHealth",
    description: "Connect to 250+ health systems including Epic, Cerner, and Allscripts",
    supportedSources: ["Epic MyChart", "Cerner Patient Portal", "Allscripts", "Quest Diagnostics", "CVS", "Walgreens"],
  },
  human_api: {
    name: "Human API",
    description: "Unified access to EHRs, pharmacies, labs, and wellness apps",
    supportedSources: ["Hospital Systems", "Pharmacies", "Labs", "Insurance", "Wellness Apps"],
  },
  flexpa: {
    name: "Flexpa",
    description: "Patient-authorized health data from insurance claims",
    supportedSources: ["United Healthcare", "Aetna", "Cigna", "Humana", "Blue Cross Blue Shield"],
  },
};

export class HealthAggregatorClient {
  private config: AggregatorConfig;
  private baseUrl: string;

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.baseUrl = AGGREGATOR_ENDPOINTS[config.provider][config.environment];
  }

  async getAuthorizationUrl(redirectUri: string, state: string): Promise<string> {
    switch (this.config.provider) {
      case "1uphealth":
        return this.get1upAuthUrl(redirectUri, state);
      case "human_api":
        return this.getHumanApiAuthUrl(redirectUri, state);
      case "flexpa":
        return this.getFlexpaAuthUrl(redirectUri, state);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private get1upAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user/*.read",
      state,
    });
    return `https://api.1up.health/connect/oauth/authorize?${params.toString()}`;
  }

  private getHumanApiAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `https://connect.humanapi.co/authorize?${params.toString()}`;
  }

  private getFlexpaAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `https://app.flexpa.com/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    userId?: string;
  }> {
    const tokenEndpoint = this.getTokenEndpoint();
    
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      userId: data.user_id || data.patient_id,
    };
  }

  private getTokenEndpoint(): string {
    switch (this.config.provider) {
      case "1uphealth":
        return "https://api.1up.health/connect/oauth/token";
      case "human_api":
        return "https://auth.humanapi.co/oauth/token";
      case "flexpa":
        return "https://api.flexpa.com/oauth/token";
    }
  }

  async getConnectedSources(accessToken: string): Promise<ConnectedHealthSource[]> {
    const endpoint = this.getSourcesEndpoint();
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to get connected sources:", await response.text());
      return [];
    }

    const data = await response.json();
    return this.mapToConnectedSources(data);
  }

  private getSourcesEndpoint(): string {
    switch (this.config.provider) {
      case "1uphealth":
        return `${this.baseUrl}/user/sources`;
      case "human_api":
        return `${this.baseUrl}/human/sources`;
      case "flexpa":
        return `${this.baseUrl}/user/payers`;
    }
  }

  private mapToConnectedSources(data: any): ConnectedHealthSource[] {
    if (Array.isArray(data)) {
      return data.map((source: any) => ({
        id: source.id || source.source_id || crypto.randomUUID(),
        name: source.name || source.display_name || "Unknown Source",
        type: this.inferSourceType(source),
        logo: source.logo || source.icon_url,
        lastSync: source.last_sync ? new Date(source.last_sync) : undefined,
        recordCount: source.record_count,
      }));
    }
    return [];
  }

  private inferSourceType(source: any): ConnectedHealthSource["type"] {
    const name = (source.name || "").toLowerCase();
    if (name.includes("hospital") || name.includes("health") || name.includes("medical")) {
      return "hospital";
    }
    if (name.includes("pharmacy") || name.includes("cvs") || name.includes("walgreens")) {
      return "pharmacy";
    }
    if (name.includes("lab") || name.includes("quest") || name.includes("labcorp")) {
      return "lab";
    }
    if (name.includes("insurance") || name.includes("aetna") || name.includes("united")) {
      return "insurance";
    }
    return "provider";
  }

  async fetchPatientData(accessToken: string, resourceTypes?: string[]): Promise<any[]> {
    const types = resourceTypes || [
      "Patient",
      "Observation",
      "Condition",
      "MedicationRequest",
      "Immunization",
      "Procedure",
      "AllergyIntolerance",
      "DiagnosticReport",
      "Encounter",
    ];

    const results: any[] = [];

    for (const type of types) {
      try {
        const resources = await this.fetchResourceType(accessToken, type);
        results.push(...resources);
      } catch (error) {
        console.error(`Failed to fetch ${type}:`, error);
      }
    }

    return results;
  }

  private async fetchResourceType(accessToken: string, resourceType: string): Promise<any[]> {
    const url = `${this.baseUrl}/${resourceType}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/fhir+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${resourceType}: ${response.statusText}`);
    }

    const bundle = await response.json();
    
    if (bundle.resourceType === "Bundle" && Array.isArray(bundle.entry)) {
      return bundle.entry.map((entry: any) => entry.resource).filter(Boolean);
    }
    
    return [];
  }

  async syncToDatabase(
    userId: string,
    sourceId: string,
    accessToken: string,
    req?: any
  ): Promise<{ imported: number; errors: number }> {
    const resources = await this.fetchPatientData(accessToken);
    let imported = 0;
    let errors = 0;

    for (const resource of resources) {
      try {
        const healthRecord = mapFhirToHealthRecord(resource, userId, sourceId);
        if (healthRecord) {
          await storage.createHealthRecord(healthRecord);
          imported++;
        }
      } catch (error) {
        console.error("Failed to import resource:", error);
        errors++;
      }
    }

    if (req) {
      AuditService.phiAccess(req, AuditAction.CREATE_PHI, ResourceType.HEALTH_RECORD, undefined, {
        phiDetails: {
          recordCount: imported,
          accessReason: `Health aggregator sync from ${this.config.provider}`,
        },
      });
    }

    return { imported, errors };
  }
}

export function getSupportedProviders(): typeof SUPPORTED_PROVIDERS {
  return SUPPORTED_PROVIDERS;
}

export function createAggregatorClient(provider: AggregatorProvider): HealthAggregatorClient | null {
  const envPrefix = provider.toUpperCase().replace("_", "");
  const clientId = process.env[`${envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];
  const environment = (process.env[`${envPrefix}_ENVIRONMENT`] || "sandbox") as "sandbox" | "production";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new HealthAggregatorClient({
    provider,
    clientId,
    clientSecret,
    environment,
  });
}

export const EHR_PROVIDER_REGISTRY = {
  epic: {
    name: "Epic MyChart",
    fhirEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    authEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
    tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
    scopes: ["patient/*.read", "launch/patient", "openid", "fhirUser"],
    logo: "https://www.epic.com/favicon.ico",
  },
  cerner: {
    name: "Cerner Patient Portal",
    fhirEndpoint: "https://fhir-myrecord.cerner.com/r4",
    authEndpoint: "https://authorization.cerner.com/tenants/{tenant}/protocol/openid-connect/auth",
    tokenEndpoint: "https://authorization.cerner.com/tenants/{tenant}/protocol/openid-connect/token",
    scopes: ["patient/*.read", "launch/patient", "openid"],
    logo: "https://www.cerner.com/favicon.ico",
  },
  allscripts: {
    name: "Allscripts FollowMyHealth",
    fhirEndpoint: "https://api.allscriptsunity.com/fhir/r4",
    authEndpoint: "https://api.allscriptsunity.com/oauth/authorize",
    tokenEndpoint: "https://api.allscriptsunity.com/oauth/token",
    scopes: ["patient/*.read", "launch/patient"],
    logo: "https://www.allscripts.com/favicon.ico",
  },
  athenahealth: {
    name: "athenahealth Patient Portal",
    fhirEndpoint: "https://api.platform.athenahealth.com/fhir/r4",
    authEndpoint: "https://api.platform.athenahealth.com/oauth2/authorize",
    tokenEndpoint: "https://api.platform.athenahealth.com/oauth2/token",
    scopes: ["patient/*.read", "openid"],
    logo: "https://www.athenahealth.com/favicon.ico",
  },
  meditech: {
    name: "MEDITECH Expanse",
    fhirEndpoint: "https://fhir.meditech.com/r4",
    authEndpoint: "https://fhir.meditech.com/oauth/authorize",
    tokenEndpoint: "https://fhir.meditech.com/oauth/token",
    scopes: ["patient/*.read", "launch/patient"],
    logo: "https://www.meditech.com/favicon.ico",
  },
};

export type EHRProvider = keyof typeof EHR_PROVIDER_REGISTRY;
