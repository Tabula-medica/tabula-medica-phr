import crypto from "crypto";

export interface InsuranceClaimsConfig {
  provider: "flexpa" | "stedi" | "change_healthcare";
  apiKey: string;
  secretKey?: string;
  baseUrl: string;
  environment: "sandbox" | "production";
}

export interface InsuranceCoverage {
  id: string;
  memberId: string;
  subscriberId: string;
  groupNumber: string;
  planName: string;
  planType: "HMO" | "PPO" | "EPO" | "POS" | "HDHP" | "Medicare" | "Medicaid" | "Other";
  payerId: string;
  payerName: string;
  effectiveDate: string;
  terminationDate?: string;
  relationship: "self" | "spouse" | "child" | "other";
  isPrimary: boolean;
  copay?: {
    primaryCare?: number;
    specialist?: number;
    urgentCare?: number;
    emergencyRoom?: number;
    preventiveCare?: number;
  };
  deductible?: {
    individual: number;
    family: number;
    remaining?: number;
  };
  outOfPocketMax?: {
    individual: number;
    family: number;
    remaining?: number;
  };
}

export interface Claim {
  id: string;
  claimNumber: string;
  claimType: "professional" | "institutional" | "dental" | "pharmacy";
  status: "pending" | "processing" | "approved" | "denied" | "appealed" | "paid";
  submissionDate: string;
  serviceDate: string;
  serviceEndDate?: string;
  provider: {
    name: string;
    npi: string;
    specialty?: string;
    facilityType?: string;
  };
  patient: {
    id: string;
    name: string;
    memberId: string;
  };
  diagnosis: Array<{
    code: string;
    codeSystem: "ICD-10" | "ICD-9";
    description: string;
    isPrimary: boolean;
  }>;
  procedures: Array<{
    code: string;
    codeSystem: "CPT" | "HCPCS" | "CDT";
    description: string;
    modifiers?: string[];
    quantity: number;
    chargedAmount: number;
    allowedAmount?: number;
    paidAmount?: number;
    patientResponsibility?: number;
  }>;
  amounts: {
    billed: number;
    allowed?: number;
    paid?: number;
    patientResponsibility?: number;
    coinsurance?: number;
    copay?: number;
    deductible?: number;
  };
  paymentInfo?: {
    checkNumber?: string;
    paymentDate?: string;
    paymentMethod?: string;
    eobDate?: string;
  };
  denialInfo?: {
    code: string;
    reason: string;
    appealDeadline?: string;
  };
  notes?: string[];
}

export interface ExplanationOfBenefits {
  id: string;
  claimId: string;
  claimNumber: string;
  issuedDate: string;
  serviceDate: string;
  provider: {
    name: string;
    npi: string;
  };
  patient: {
    name: string;
    memberId: string;
  };
  summary: {
    totalBilled: number;
    planPaid: number;
    youOwe: number;
    appliedToDeductible: number;
  };
  lineItems: Array<{
    service: string;
    serviceCode: string;
    serviceDate: string;
    billed: number;
    allowed: number;
    planPaid: number;
    youOwe: number;
    notes?: string;
  }>;
  adjustments: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  remarks: string[];
}

export interface EligibilityCheck {
  id: string;
  checkDate: string;
  memberId: string;
  payerId: string;
  payerName: string;
  isActive: boolean;
  effectiveDate: string;
  terminationDate?: string;
  planType: string;
  planName: string;
  groupNumber?: string;
  subscriberName: string;
  benefits: {
    inNetwork: {
      deductible?: { individual: number; family: number; met?: number };
      outOfPocketMax?: { individual: number; family: number; met?: number };
      coinsurance?: number;
    };
    outOfNetwork: {
      deductible?: { individual: number; family: number; met?: number };
      outOfPocketMax?: { individual: number; family: number; met?: number };
      coinsurance?: number;
    };
    copays?: Record<string, number>;
  };
  coverages: Array<{
    type: string;
    covered: boolean;
    limitations?: string;
    authorizationRequired?: boolean;
  }>;
}

export interface PriorAuthorizationRequest {
  id: string;
  requestDate: string;
  status: "pending" | "approved" | "denied" | "info_requested" | "expired";
  authorizationNumber?: string;
  procedure: {
    code: string;
    codeSystem: string;
    description: string;
  };
  diagnosis: Array<{
    code: string;
    description: string;
  }>;
  provider: {
    name: string;
    npi: string;
  };
  facility?: {
    name: string;
    npi: string;
  };
  requestedUnits?: number;
  approvedUnits?: number;
  effectiveDate?: string;
  expirationDate?: string;
  decisionDate?: string;
  decisionReason?: string;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    uploadDate: string;
  }>;
}

const COMMON_PAYERS = [
  { id: "BCBS", name: "Blue Cross Blue Shield", type: "commercial" },
  { id: "UHC", name: "UnitedHealthcare", type: "commercial" },
  { id: "AETNA", name: "Aetna", type: "commercial" },
  { id: "CIGNA", name: "Cigna", type: "commercial" },
  { id: "HUMANA", name: "Humana", type: "commercial" },
  { id: "KAISER", name: "Kaiser Permanente", type: "commercial" },
  { id: "ANTHEM", name: "Anthem", type: "commercial" },
  { id: "MEDICARE_A", name: "Medicare Part A", type: "government" },
  { id: "MEDICARE_B", name: "Medicare Part B", type: "government" },
  { id: "MEDICARE_D", name: "Medicare Part D", type: "government" },
  { id: "MEDICAID", name: "Medicaid", type: "government" },
  { id: "TRICARE", name: "TRICARE", type: "government" },
  { id: "VA", name: "Veterans Affairs", type: "government" }
];

class InsuranceClaimsService {
  private config: InsuranceClaimsConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  initialize(config: InsuranceClaimsConfig): void {
    this.config = config;
  }

  getCommonPayers() {
    return COMMON_PAYERS;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config) {
      throw new Error("Insurance claims service not initialized");
    }

    if (this.config.provider === "flexpa") {
      const response = await fetch(`${this.config.baseUrl}/link/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          user: {
            external_id: "tabula-medica-user"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get Flexpa access token: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + 3600 * 1000);
      return this.accessToken!;
    }

    return this.config.apiKey;
  }

  async checkEligibility(memberId: string, payerId: string, serviceDate: string): Promise<EligibilityCheck> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/eligibility`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        memberId,
        payerId,
        serviceDate,
        serviceTypes: ["health_benefit_plan_coverage", "medical_care"]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Eligibility check failed: ${error}`);
    }

    return response.json();
  }

  async getClaims(patientId: string, options?: {
    status?: Claim["status"][];
    dateRange?: { start: string; end: string };
    claimType?: Claim["claimType"];
    limit?: number;
    offset?: number;
  }): Promise<Claim[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams();
    params.append("patient", patientId);

    if (options?.status && options.status.length > 0) {
      params.append("status", options.status.join(","));
    }

    if (options?.dateRange) {
      params.append("date", `ge${options.dateRange.start}`);
      params.append("date", `le${options.dateRange.end}`);
    }

    if (options?.claimType) {
      params.append("type", options.claimType);
    }

    if (options?.limit) {
      params.append("_count", options.limit.toString());
    }

    if (options?.offset) {
      params.append("_offset", options.offset.toString());
    }

    const response = await fetch(`${this.config!.baseUrl}/claims?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get claims: ${error}`);
    }

    return response.json();
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/claims/${claimId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get claim: ${response.statusText}`);
    }

    return response.json();
  }

  async getExplanationOfBenefits(claimId: string): Promise<ExplanationOfBenefits | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/claims/${claimId}/eob`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get EOB: ${response.statusText}`);
    }

    return response.json();
  }

  async getCoverage(patientId: string): Promise<InsuranceCoverage[]> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/coverage?patient=${patientId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get coverage: ${response.statusText}`);
    }

    return response.json();
  }

  async submitPriorAuthRequest(request: Omit<PriorAuthorizationRequest, "id" | "requestDate" | "status">): Promise<PriorAuthorizationRequest> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/prior-auth`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit prior auth: ${error}`);
    }

    return response.json();
  }

  async getPriorAuthStatus(authId: string): Promise<PriorAuthorizationRequest | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/prior-auth/${authId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get prior auth status: ${response.statusText}`);
    }

    return response.json();
  }

  async initiatePatientConnection(patientId: string): Promise<{ linkToken: string; expiresAt: string }> {
    if (this.config?.provider !== "flexpa") {
      throw new Error("Patient connection only supported with Flexpa");
    }

    const response = await fetch(`${this.config.baseUrl}/link/token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user: {
          external_id: patientId
        },
        language: "en",
        redirect_uri: `${process.env.FRONTEND_URL || ""}/insurance/callback`
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create link token: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      linkToken: data.link_token,
      expiresAt: data.expires_at
    };
  }

  async exchangePublicToken(publicToken: string): Promise<{ accessToken: string; payerId: string }> {
    if (this.config?.provider !== "flexpa") {
      throw new Error("Token exchange only supported with Flexpa");
    }

    const response = await fetch(`${this.config.baseUrl}/link/exchange`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        public_token: publicToken
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange token: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      payerId: data.payer_id
    };
  }

  generateClaimsSummary(claims: Claim[]): {
    totalClaims: number;
    totalBilled: number;
    totalPaid: number;
    totalPatientResponsibility: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recentClaims: Claim[];
  } {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalBilled = 0;
    let totalPaid = 0;
    let totalPatientResponsibility = 0;

    claims.forEach(claim => {
      byStatus[claim.status] = (byStatus[claim.status] || 0) + 1;
      byType[claim.claimType] = (byType[claim.claimType] || 0) + 1;
      totalBilled += claim.amounts.billed;
      totalPaid += claim.amounts.paid || 0;
      totalPatientResponsibility += claim.amounts.patientResponsibility || 0;
    });

    const recentClaims = [...claims]
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
      .slice(0, 5);

    return {
      totalClaims: claims.length,
      totalBilled,
      totalPaid,
      totalPatientResponsibility,
      byStatus,
      byType,
      recentClaims
    };
  }
}

export const insuranceClaimsService = new InsuranceClaimsService();

export function initializeInsuranceClaims(): void {
  const provider = process.env.INSURANCE_CLAIMS_PROVIDER as InsuranceClaimsConfig["provider"];
  const apiKey = process.env.INSURANCE_CLAIMS_API_KEY || process.env.FLEXPA_API_KEY;

  if (apiKey) {
    insuranceClaimsService.initialize({
      provider: provider || "flexpa",
      apiKey,
      secretKey: process.env.INSURANCE_CLAIMS_SECRET_KEY,
      baseUrl: process.env.INSURANCE_CLAIMS_URL || "https://api.flexpa.com/v1",
      environment: (process.env.NODE_ENV === "production" ? "production" : "sandbox") as "sandbox" | "production"
    });
    console.log(`Insurance claims service initialized (${provider || "flexpa"})`);
  } else {
    console.log("Insurance claims credentials not configured - service disabled");
  }
}
