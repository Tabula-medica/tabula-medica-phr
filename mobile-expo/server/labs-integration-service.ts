import crypto from "crypto";

export interface LabsConfig {
  provider: "quest" | "labcorp" | "aggregate";
  apiKey: string;
  secretKey?: string;
  baseUrl: string;
  environment: "sandbox" | "production";
}

export interface LabProvider {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  patientPortalUrl: string;
  supportedTests: string[];
  locations: number;
  connectionType: "direct" | "aggregate" | "patient_portal";
}

export interface LabOrder {
  id: string;
  orderId: string;
  accessionNumber: string;
  status: "ordered" | "collected" | "received" | "processing" | "resulted" | "cancelled";
  orderDate: string;
  collectionDate?: string;
  resultDate?: string;
  provider: {
    name: string;
    npi: string;
    specialty?: string;
  };
  facility?: {
    name: string;
    address: string;
  };
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
  };
  tests: Array<{
    code: string;
    name: string;
    status: string;
    specimen?: string;
  }>;
  diagnoses?: Array<{
    code: string;
    description: string;
  }>;
  priority: "routine" | "stat" | "urgent";
  specialInstructions?: string;
}

export interface LabResult {
  id: string;
  orderId: string;
  accessionNumber: string;
  testCode: string;
  testName: string;
  loincCode?: string;
  category: "chemistry" | "hematology" | "microbiology" | "pathology" | "urinalysis" | "immunology" | "toxicology" | "genetics" | "other";
  status: "preliminary" | "final" | "corrected" | "amended" | "cancelled";
  resultDate: string;
  collectionDate: string;
  specimenType: string;
  components: Array<{
    name: string;
    value: string;
    valueNumeric?: number;
    units?: string;
    referenceRange?: {
      low?: number;
      high?: number;
      text?: string;
    };
    interpretation?: "normal" | "low" | "high" | "critical_low" | "critical_high" | "abnormal";
    loincCode?: string;
    notes?: string;
  }>;
  performingLab: {
    name: string;
    address: string;
    clia: string;
    director?: string;
  };
  orderingProvider: {
    name: string;
    npi: string;
  };
  notes?: string[];
  criticalValues?: Array<{
    component: string;
    value: string;
    communicatedTo?: string;
    communicatedAt?: string;
  }>;
}

export interface LabLocation {
  id: string;
  name: string;
  labProvider: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone: string;
  fax?: string;
  hours: Array<{
    day: string;
    open: string;
    close: string;
  }>;
  services: string[];
  isWalkIn: boolean;
  acceptsInsurance: boolean;
  latitude?: number;
  longitude?: number;
  distance?: number;
}

const LAB_PROVIDERS: LabProvider[] = [
  {
    id: "quest",
    name: "Quest Diagnostics",
    displayName: "Quest Diagnostics",
    logoUrl: "/assets/labs/quest-logo.png",
    patientPortalUrl: "https://myquest.questdiagnostics.com",
    supportedTests: ["blood_work", "urinalysis", "genetic", "drug_screening", "allergy", "hormone", "thyroid", "lipid", "diabetes"],
    locations: 2200,
    connectionType: "direct"
  },
  {
    id: "labcorp",
    name: "LabCorp",
    displayName: "LabCorp (Laboratory Corporation of America)",
    logoUrl: "/assets/labs/labcorp-logo.png",
    patientPortalUrl: "https://patient.labcorp.com",
    supportedTests: ["blood_work", "urinalysis", "genetic", "drug_screening", "oncology", "infectious_disease", "autoimmune", "cardiovascular"],
    locations: 2000,
    connectionType: "direct"
  },
  {
    id: "bioreference",
    name: "BioReference Laboratories",
    displayName: "BioReference Labs",
    logoUrl: "/assets/labs/bioreference-logo.png",
    patientPortalUrl: "https://www.bioreference.com/patients",
    supportedTests: ["blood_work", "genetic", "oncology", "women_health"],
    locations: 400,
    connectionType: "aggregate"
  },
  {
    id: "sonora",
    name: "Sonora Quest",
    displayName: "Sonora Quest Laboratories",
    logoUrl: "/assets/labs/sonora-logo.png",
    patientPortalUrl: "https://www.mysonoraquestcenter.com",
    supportedTests: ["blood_work", "urinalysis", "pathology"],
    locations: 85,
    connectionType: "patient_portal"
  }
];

const COMMON_LAB_TESTS = [
  { code: "CBC", name: "Complete Blood Count", loinc: "58410-2", category: "hematology" },
  { code: "CMP", name: "Comprehensive Metabolic Panel", loinc: "24323-8", category: "chemistry" },
  { code: "BMP", name: "Basic Metabolic Panel", loinc: "24320-4", category: "chemistry" },
  { code: "LIPID", name: "Lipid Panel", loinc: "57698-3", category: "chemistry" },
  { code: "A1C", name: "Hemoglobin A1c", loinc: "4548-4", category: "chemistry" },
  { code: "TSH", name: "Thyroid Stimulating Hormone", loinc: "3016-3", category: "chemistry" },
  { code: "UA", name: "Urinalysis", loinc: "24356-8", category: "urinalysis" },
  { code: "PT", name: "Prothrombin Time", loinc: "5902-2", category: "hematology" },
  { code: "PSA", name: "Prostate-Specific Antigen", loinc: "2857-1", category: "chemistry" },
  { code: "VITD", name: "Vitamin D, 25-Hydroxy", loinc: "1989-3", category: "chemistry" },
  { code: "B12", name: "Vitamin B12", loinc: "2132-9", category: "chemistry" },
  { code: "IRON", name: "Iron Studies", loinc: "2498-4", category: "chemistry" },
  { code: "LFT", name: "Liver Function Tests", loinc: "24325-3", category: "chemistry" },
  { code: "CRP", name: "C-Reactive Protein", loinc: "1988-5", category: "chemistry" },
  { code: "ESR", name: "Erythrocyte Sedimentation Rate", loinc: "30341-2", category: "hematology" }
];

class LabsIntegrationService {
  private config: LabsConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  initialize(config: LabsConfig): void {
    this.config = config;
  }

  getLabProviders(): LabProvider[] {
    return LAB_PROVIDERS;
  }

  getCommonLabTests() {
    return COMMON_LAB_TESTS;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config) {
      throw new Error("Labs integration service not initialized");
    }

    const credentials = Buffer.from(
      `${this.config.apiKey}:${this.config.secretKey || ""}`
    ).toString("base64");

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with lab service: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
    return this.accessToken!;
  }

  async searchLocations(options: {
    labProvider?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    services?: string[];
    limit?: number;
  }): Promise<LabLocation[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams();

    if (options.labProvider) {
      params.append("provider", options.labProvider);
    }

    if (options.zipCode) {
      params.append("zip", options.zipCode);
    } else if (options.latitude && options.longitude) {
      params.append("lat", options.latitude.toString());
      params.append("lng", options.longitude.toString());
    }

    if (options.radius) {
      params.append("radius", options.radius.toString());
    }

    if (options.services && options.services.length > 0) {
      params.append("services", options.services.join(","));
    }

    if (options.limit) {
      params.append("limit", options.limit.toString());
    }

    const response = await fetch(`${this.config!.baseUrl}/locations?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to search locations: ${response.statusText}`);
    }

    return response.json();
  }

  async getOrders(patientId: string, options?: {
    status?: LabOrder["status"][];
    dateRange?: { start: string; end: string };
    limit?: number;
    offset?: number;
  }): Promise<LabOrder[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams();
    params.append("patient", patientId);

    if (options?.status && options.status.length > 0) {
      params.append("status", options.status.join(","));
    }

    if (options?.dateRange) {
      params.append("from", options.dateRange.start);
      params.append("to", options.dateRange.end);
    }

    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }

    if (options?.offset) {
      params.append("offset", options.offset.toString());
    }

    const response = await fetch(`${this.config!.baseUrl}/orders?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get orders: ${response.statusText}`);
    }

    return response.json();
  }

  async getResults(patientId: string, options?: {
    orderId?: string;
    category?: LabResult["category"];
    dateRange?: { start: string; end: string };
    status?: LabResult["status"][];
    limit?: number;
    offset?: number;
  }): Promise<LabResult[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams();
    params.append("patient", patientId);

    if (options?.orderId) {
      params.append("order", options.orderId);
    }

    if (options?.category) {
      params.append("category", options.category);
    }

    if (options?.dateRange) {
      params.append("from", options.dateRange.start);
      params.append("to", options.dateRange.end);
    }

    if (options?.status && options.status.length > 0) {
      params.append("status", options.status.join(","));
    }

    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }

    if (options?.offset) {
      params.append("offset", options.offset.toString());
    }

    const response = await fetch(`${this.config!.baseUrl}/results?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get results: ${response.statusText}`);
    }

    return response.json();
  }

  async getResult(resultId: string): Promise<LabResult | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/results/${resultId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get result: ${response.statusText}`);
    }

    return response.json();
  }

  async initiatePatientPortalConnection(labProvider: string, patientId: string): Promise<{ authUrl: string; state: string }> {
    const provider = LAB_PROVIDERS.find(p => p.id === labProvider);
    if (!provider) {
      throw new Error(`Unknown lab provider: ${labProvider}`);
    }

    const state = crypto.randomBytes(32).toString("hex");
    
    const params = new URLSearchParams({
      client_id: this.config!.apiKey,
      redirect_uri: `${process.env.BACKEND_URL || ""}/api/labs/callback`,
      response_type: "code",
      scope: "patient.read results.read",
      state,
      patient_id: patientId
    });

    return {
      authUrl: `${provider.patientPortalUrl}/oauth/authorize?${params.toString()}`,
      state
    };
  }

  async exchangeAuthCode(code: string, labProvider: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const provider = LAB_PROVIDERS.find(p => p.id === labProvider);
    if (!provider) {
      throw new Error(`Unknown lab provider: ${labProvider}`);
    }

    const response = await fetch(`${this.config!.baseUrl}/${labProvider}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.config!.apiKey,
        client_secret: this.config!.secretKey || "",
        redirect_uri: `${process.env.BACKEND_URL || ""}/api/labs/callback`
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange auth code: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  interpretResult(result: LabResult): {
    summary: string;
    abnormalCount: number;
    criticalCount: number;
    recommendations: string[];
  } {
    let abnormalCount = 0;
    let criticalCount = 0;
    const abnormalComponents: string[] = [];
    const criticalComponents: string[] = [];

    result.components.forEach(component => {
      if (component.interpretation === "critical_low" || component.interpretation === "critical_high") {
        criticalCount++;
        criticalComponents.push(component.name);
      } else if (component.interpretation && component.interpretation !== "normal") {
        abnormalCount++;
        abnormalComponents.push(`${component.name} (${component.interpretation})`);
      }
    });

    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push("Contact your healthcare provider immediately regarding critical values.");
    }

    if (abnormalCount > 0) {
      recommendations.push("Discuss abnormal results with your healthcare provider at your next appointment.");
    }

    let summary = `${result.testName}: `;
    if (criticalCount > 0) {
      summary += `${criticalCount} critical value(s) detected. `;
    }
    if (abnormalCount > 0) {
      summary += `${abnormalCount} abnormal result(s). `;
    }
    if (criticalCount === 0 && abnormalCount === 0) {
      summary += "All values within normal range.";
    }

    return {
      summary,
      abnormalCount,
      criticalCount,
      recommendations
    };
  }

  generateTrendAnalysis(results: LabResult[], componentName: string): {
    component: string;
    dataPoints: Array<{ date: string; value: number; interpretation?: string }>;
    trend: "improving" | "stable" | "worsening" | "insufficient_data";
    averageValue: number;
    percentChange?: number;
  } | null {
    const componentResults = results
      .flatMap(r => r.components)
      .filter(c => c.name === componentName && c.valueNumeric !== undefined)
      .map(c => ({
        date: results.find(r => r.components.includes(c))?.resultDate || "",
        value: c.valueNumeric!,
        interpretation: c.interpretation
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (componentResults.length < 2) {
      return null;
    }

    const averageValue = componentResults.reduce((sum, dp) => sum + dp.value, 0) / componentResults.length;

    const firstValue = componentResults[0].value;
    const lastValue = componentResults[componentResults.length - 1].value;
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    let trend: "improving" | "stable" | "worsening" | "insufficient_data" = "stable";

    if (Math.abs(percentChange) > 10) {
      trend = percentChange > 0 ? "worsening" : "improving";
    }

    return {
      component: componentName,
      dataPoints: componentResults,
      trend,
      averageValue,
      percentChange
    };
  }
}

export const labsIntegrationService = new LabsIntegrationService();

export function initializeLabsIntegration(): void {
  const apiKey = process.env.LABS_API_KEY || process.env.QUEST_API_KEY || process.env.LABCORP_API_KEY;
  const provider = process.env.LABS_PROVIDER as LabsConfig["provider"];

  if (apiKey) {
    labsIntegrationService.initialize({
      provider: provider || "aggregate",
      apiKey,
      secretKey: process.env.LABS_SECRET_KEY,
      baseUrl: process.env.LABS_API_URL || "https://api.healthgorilla.com",
      environment: (process.env.NODE_ENV === "production" ? "production" : "sandbox") as "sandbox" | "production"
    });
    console.log(`Labs integration service initialized (${provider || "aggregate"})`);
  } else {
    console.log("Labs credentials not configured - service disabled");
  }
}
