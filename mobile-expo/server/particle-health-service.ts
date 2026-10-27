import crypto from "crypto";

export interface ParticleHealthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  environment: "sandbox" | "production";
}

export interface EHRConnection {
  id: string;
  provider: "epic" | "athena" | "eclinicalworks" | "cerner" | "allscripts" | "meditech" | "nextgen";
  displayName: string;
  logoUrl: string;
  connectionStatus: "connected" | "pending" | "disconnected" | "error";
  lastSync: Date | null;
  patientId: string;
  facilityId: string;
  facilityName: string;
  capabilities: string[];
}

export interface PatientQuery {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  ssn4?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;
  email?: string;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    lastUpdated: string;
    source: string;
    versionId: string;
  };
  [key: string]: unknown;
}

export interface PatientMatch {
  confidence: number;
  matchType: "exact" | "probable" | "possible";
  source: string;
  patientId: string;
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  facilities: Array<{
    id: string;
    name: string;
    type: string;
    ehrSystem: string;
  }>;
}

export interface DataRetrievalRequest {
  patientId: string;
  connectionId: string;
  resourceTypes: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  purpose: "treatment" | "payment" | "operations" | "patient_request";
}

const SUPPORTED_EHR_SYSTEMS = [
  {
    id: "epic",
    name: "Epic MyChart",
    displayName: "Epic Health Records",
    capabilities: ["clinical_notes", "lab_results", "medications", "immunizations", "allergies", "conditions", "procedures", "encounters", "vitals", "imaging"],
    logoUrl: "/assets/ehr/epic-logo.png"
  },
  {
    id: "athena",
    name: "athenahealth",
    displayName: "athenahealth Patient Portal",
    capabilities: ["clinical_notes", "lab_results", "medications", "immunizations", "allergies", "conditions", "encounters", "vitals"],
    logoUrl: "/assets/ehr/athena-logo.png"
  },
  {
    id: "eclinicalworks",
    name: "eClinicalWorks",
    displayName: "eClinicalWorks healow",
    capabilities: ["clinical_notes", "lab_results", "medications", "immunizations", "allergies", "conditions", "encounters"],
    logoUrl: "/assets/ehr/ecw-logo.png"
  },
  {
    id: "cerner",
    name: "Oracle Health (Cerner)",
    displayName: "Oracle Health Portal",
    capabilities: ["clinical_notes", "lab_results", "medications", "immunizations", "allergies", "conditions", "procedures", "encounters", "vitals", "imaging"],
    logoUrl: "/assets/ehr/cerner-logo.png"
  },
  {
    id: "allscripts",
    name: "Allscripts",
    displayName: "Allscripts FollowMyHealth",
    capabilities: ["clinical_notes", "lab_results", "medications", "conditions", "encounters"],
    logoUrl: "/assets/ehr/allscripts-logo.png"
  },
  {
    id: "meditech",
    name: "MEDITECH",
    displayName: "MEDITECH Patient Portal",
    capabilities: ["clinical_notes", "lab_results", "medications", "conditions", "encounters"],
    logoUrl: "/assets/ehr/meditech-logo.png"
  },
  {
    id: "nextgen",
    name: "NextGen Healthcare",
    displayName: "NextGen Patient Portal",
    capabilities: ["clinical_notes", "lab_results", "medications", "conditions", "encounters"],
    logoUrl: "/assets/ehr/nextgen-logo.png"
  }
];

class ParticleHealthService {
  private config: ParticleHealthConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  initialize(config: ParticleHealthConfig): void {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config) {
      throw new Error("Particle Health service not initialized");
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=patient/*.read"
    });

    if (!response.ok) {
      throw new Error(`Failed to obtain access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
    return this.accessToken!;
  }

  getSupportedEHRSystems() {
    return SUPPORTED_EHR_SYSTEMS;
  }

  async searchPatientRecords(query: PatientQuery): Promise<PatientMatch[]> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/api/v1/patients/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName: query.firstName,
        lastName: query.lastName,
        birthDate: query.dateOfBirth,
        gender: query.gender,
        ssn: query.ssn4 ? `***-**-${query.ssn4}` : undefined,
        address: query.address,
        phone: query.phone,
        email: query.email,
        purpose: "treatment"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Patient search failed: ${error}`);
    }

    const data = await response.json();
    return data.matches || [];
  }

  async initiateDataRetrieval(request: DataRetrievalRequest): Promise<{ requestId: string; status: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/api/v1/data/retrieve`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId: request.patientId,
        connectionId: request.connectionId,
        resourceTypes: request.resourceTypes,
        dateRange: request.dateRange,
        purpose: request.purpose,
        callback: {
          url: `${process.env.BACKEND_URL || ""}/api/particle/webhook`,
          events: ["data.available", "data.complete", "data.error"]
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Data retrieval failed: ${error}`);
    }

    return response.json();
  }

  async getPatientData(patientId: string, resourceType: string): Promise<FHIRResource[]> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.config!.baseUrl}/api/v1/patients/${patientId}/fhir/${resourceType}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/fhir+json"
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get patient data: ${error}`);
    }

    const bundle = await response.json();
    return bundle.entry?.map((e: { resource: FHIRResource }) => e.resource) || [];
  }

  async createPatientConsent(patientId: string, ehrSystem: string, consentData: {
    scope: string[];
    expiration: Date;
    purpose: string;
  }): Promise<{ consentId: string; status: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/api/v1/consents`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        ehrSystem,
        scope: consentData.scope,
        expiration: consentData.expiration.toISOString(),
        purpose: consentData.purpose,
        consentType: "optin"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create consent: ${error}`);
    }

    return response.json();
  }

  async revokeConsent(consentId: string): Promise<{ success: boolean }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/api/v1/consents/${consentId}/revoke`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to revoke consent");
    }

    return { success: true };
  }

  async getConnectionStatus(connectionId: string): Promise<EHRConnection> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.config!.baseUrl}/api/v1/connections/${connectionId}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get connection status");
    }

    return response.json();
  }

  generateNonce(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async processWebhook(payload: unknown, signature: string): Promise<boolean> {
    if (!this.config) {
      throw new Error("Particle Health service not initialized");
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.config.clientSecret)
      .update(JSON.stringify(payload))
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

export const particleHealthService = new ParticleHealthService();

export function initializeParticleHealth(): void {
  const clientId = process.env.PARTICLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.PARTICLE_HEALTH_CLIENT_SECRET;

  if (clientId && clientSecret) {
    particleHealthService.initialize({
      clientId,
      clientSecret,
      baseUrl: process.env.PARTICLE_HEALTH_URL || "https://api.particlehealth.com",
      environment: (process.env.NODE_ENV === "production" ? "production" : "sandbox") as "sandbox" | "production"
    });
    console.log("Particle Health service initialized");
  } else {
    console.log("Particle Health credentials not configured - service disabled");
  }
}
