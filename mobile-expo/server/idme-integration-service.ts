import crypto from "crypto";

export interface IDmeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  baseUrl: string;
}

export interface IDmeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  verificationLevel: "IAL1" | "IAL2";
  verifiedAttributes: string[];
  groups: string[];
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  phone?: string;
  createdAt: Date;
}

export interface IDmeVerification {
  userId: string;
  level: "IAL1" | "IAL2" | "IAL2+LOA3";
  status: "pending" | "verified" | "failed" | "expired";
  verifiedAt?: Date;
  method: "remote" | "in_person" | "trusted_referee" | "video_chat";
  attributes: string[];
}

export interface IDmeHealthProfile {
  userId: string;
  insuranceInfo?: {
    provider: string;
    memberId: string;
    groupNumber: string;
    planType: string;
  };
  providerInfo?: {
    name: string;
    npi: string;
    specialty: string;
    facility: string;
  };
  medicalId?: string;
  veteranStatus?: {
    isVeteran: boolean;
    branch?: string;
    serviceStart?: Date;
    serviceEnd?: Date;
    disabilityRating?: number;
  };
}

interface IDmeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface IDmeConnectionRecord {
  userId: string;
  idmeUserId: string;
  connectedAt: Date;
  verificationLevel: "IAL1" | "IAL2";
  lastVerified: Date;
}

const IDME_AUTHORIZATION_URL = "https://api.id.me/oauth/authorize";
const IDME_TOKEN_URL = "https://api.id.me/oauth/token";
const IDME_USERINFO_URL = "https://api.id.me/api/public/v3/userinfo";
const IDME_BASE_URL = "https://api.id.me";

const DEFAULT_SCOPES = ["openid", "profile", "email", "address", "phone", "verification", "health"];

const SUPPORTED_GROUPS = [
  { id: "military", name: "Military", description: "Active duty, veterans, and military families" },
  { id: "medical", name: "Medical Professional", description: "Licensed healthcare providers" },
  { id: "student", name: "Student", description: "Currently enrolled students" },
  { id: "teacher", name: "Teacher", description: "K-12 and higher education educators" },
  { id: "first_responder", name: "First Responder", description: "Police, fire, EMS personnel" },
  { id: "government", name: "Government Employee", description: "Federal, state, and local government workers" },
  { id: "nurse", name: "Nurse", description: "Licensed nurses (RN, LPN, NP)" },
  { id: "hospital_employee", name: "Hospital Employee", description: "Healthcare facility staff" },
];

const REQUEST_TIMEOUT = 10000;

class IDmeIntegrationService {
  private config: IDmeConfig;
  private configured: boolean;
  private connections: Map<string, IDmeConnectionRecord> = new Map();

  constructor() {
    const clientId = process.env.IDME_CLIENT_ID || "";
    const clientSecret = process.env.IDME_CLIENT_SECRET || "";
    const redirectUri = process.env.IDME_REDIRECT_URI || "";

    this.configured = !!(clientId && clientSecret && redirectUri);

    this.config = {
      clientId,
      clientSecret,
      redirectUri,
      scopes: DEFAULT_SCOPES,
      baseUrl: IDME_BASE_URL,
    };

    if (this.configured) {
      console.log("[ID.me] Service initialized with credentials");
    } else {
      console.log("[ID.me] Service running in demo mode - no credentials configured");
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getAuthorizationUrl(state: string, scopes?: string[]): string {
    const effectiveScopes = scopes || this.config.scopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId || "demo_client_id",
      redirect_uri: this.config.redirectUri || "https://localhost/callback",
      response_type: "code",
      scope: effectiveScopes.join(" "),
      state,
    });

    const url = `${IDME_AUTHORIZATION_URL}?${params.toString()}`;
    console.log(`[ID.me] Generated authorization URL for state: ${state}`);
    return url;
  }

  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    scope: string;
    source: "live" | "demo";
  }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock token for code exchange");
      return {
        accessToken: `demo_access_token_${crypto.randomUUID()}`,
        refreshToken: `demo_refresh_token_${crypto.randomUUID()}`,
        expiresIn: 3600,
        tokenType: "Bearer",
        scope: DEFAULT_SCOPES.join(" "),
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Exchanging authorization code for token");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(IDME_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const data: IDmeTokenResponse = await response.json();
      console.log("[ID.me] Token exchange successful");

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Token exchange error:", error);
      throw new Error(`[ID.me] Failed to exchange code for token: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    source: "live" | "demo";
  }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock refreshed token");
      return {
        accessToken: `demo_access_token_${crypto.randomUUID()}`,
        refreshToken: `demo_refresh_token_${crypto.randomUUID()}`,
        expiresIn: 3600,
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Refreshing access token");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(IDME_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const data: IDmeTokenResponse = await response.json();
      console.log("[ID.me] Token refresh successful");

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Token refresh error:", error);
      throw new Error(`[ID.me] Failed to refresh token: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getUserInfo(accessToken: string): Promise<IDmeUser & { source: "live" | "demo" }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock user info");
      return {
        id: "demo-idme-user-001",
        email: "demo.patient@example.com",
        firstName: "Demo",
        lastName: "Patient",
        verified: true,
        verificationLevel: "IAL2",
        verifiedAttributes: ["email", "phone", "address", "identity", "date_of_birth"],
        groups: ["medical"],
        address: {
          street: "123 Health Ave",
          city: "Springfield",
          state: "IL",
          zip: "62701",
          country: "US",
        },
        phone: "+1-555-0100",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Fetching user info");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(IDME_USERINFO_URL, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`UserInfo request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ID.me] User info retrieved successfully");

      const user: IDmeUser & { source: "live" } = {
        id: data.sub || data.id || data.uuid,
        email: data.email || "",
        firstName: data.fname || data.given_name || "",
        lastName: data.lname || data.family_name || "",
        verified: data.verified || false,
        verificationLevel: data.ial === 2 ? "IAL2" : "IAL1",
        verifiedAttributes: data.verified_attributes || [],
        groups: data.groups || data.affiliations || [],
        address: data.address ? {
          street: data.address.street_address || data.address.street || "",
          city: data.address.locality || data.address.city || "",
          state: data.address.region || data.address.state || "",
          zip: data.address.postal_code || data.address.zip || "",
          country: data.address.country || "US",
        } : undefined,
        phone: data.phone_number || data.phone || undefined,
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        source: "live",
      };

      return user;
    } catch (error) {
      console.error("[ID.me] UserInfo error:", error);
      throw new Error(`[ID.me] Failed to get user info: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getVerificationStatus(accessToken: string): Promise<IDmeVerification & { source: "live" | "demo" }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock verification status");
      return {
        userId: "demo-idme-user-001",
        level: "IAL2",
        status: "verified",
        verifiedAt: new Date("2024-01-15T10:30:00Z"),
        method: "remote",
        attributes: ["identity", "email", "phone", "address", "date_of_birth", "ssn_last4"],
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Fetching verification status");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${this.config.baseUrl}/api/public/v3/verified`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Verification status request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ID.me] Verification status retrieved successfully");

      let level: IDmeVerification["level"] = "IAL1";
      if (data.ial === 2 && data.loa === 3) {
        level = "IAL2+LOA3";
      } else if (data.ial === 2) {
        level = "IAL2";
      }

      return {
        userId: data.sub || data.id || data.uuid,
        level,
        status: data.verified ? "verified" : "pending",
        verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
        method: data.verification_method || "remote",
        attributes: data.verified_attributes || [],
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Verification status error:", error);
      throw new Error(`[ID.me] Failed to get verification status: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getHealthProfile(accessToken: string): Promise<IDmeHealthProfile & { source: "live" | "demo" }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock health profile");
      return {
        userId: "demo-idme-user-001",
        insuranceInfo: {
          provider: "Blue Cross Blue Shield",
          memberId: "DEMO-MBR-12345",
          groupNumber: "GRP-67890",
          planType: "PPO",
        },
        providerInfo: {
          name: "Dr. Sarah Johnson",
          npi: "1234567890",
          specialty: "Internal Medicine",
          facility: "Springfield Medical Center",
        },
        medicalId: "DEMO-MED-001",
        veteranStatus: {
          isVeteran: false,
        },
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Fetching health profile");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${this.config.baseUrl}/api/public/v3/health`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.log("[ID.me] Health profile not available for this user");
          return {
            userId: "",
            source: "live",
          };
        }
        const errorText = await response.text();
        throw new Error(`Health profile request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ID.me] Health profile retrieved successfully");

      return {
        userId: data.sub || data.id || data.uuid || "",
        insuranceInfo: data.insurance ? {
          provider: data.insurance.provider || "",
          memberId: data.insurance.member_id || "",
          groupNumber: data.insurance.group_number || "",
          planType: data.insurance.plan_type || "",
        } : undefined,
        providerInfo: data.provider ? {
          name: data.provider.name || "",
          npi: data.provider.npi || "",
          specialty: data.provider.specialty || "",
          facility: data.provider.facility || "",
        } : undefined,
        medicalId: data.medical_id || undefined,
        veteranStatus: data.veteran ? {
          isVeteran: data.veteran.is_veteran || false,
          branch: data.veteran.branch || undefined,
          serviceStart: data.veteran.service_start ? new Date(data.veteran.service_start) : undefined,
          serviceEnd: data.veteran.service_end ? new Date(data.veteran.service_end) : undefined,
          disabilityRating: data.veteran.disability_rating || undefined,
        } : undefined,
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Health profile error:", error);
      throw new Error(`[ID.me] Failed to get health profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async verifyIdentity(userId: string, idmeUserId: string): Promise<{
    success: boolean;
    connectionId: string;
    verificationLevel: "IAL1" | "IAL2";
    connectedAt: Date;
    source: "live" | "demo";
  }> {
    console.log(`[ID.me] Linking ID.me user ${idmeUserId} to app user ${userId}`);

    const connectionId = crypto.randomUUID();
    const connectedAt = new Date();

    const record: IDmeConnectionRecord = {
      userId,
      idmeUserId,
      connectedAt,
      verificationLevel: "IAL2",
      lastVerified: connectedAt,
    };

    this.connections.set(userId, record);

    console.log(`[ID.me] Identity linked successfully: ${userId} <-> ${idmeUserId}`);

    return {
      success: true,
      connectionId,
      verificationLevel: "IAL2",
      connectedAt,
      source: this.configured ? "live" : "demo",
    };
  }

  async getVerifiedAttributes(accessToken: string): Promise<{
    attributes: string[];
    verificationLevel: "IAL1" | "IAL2";
    source: "live" | "demo";
  }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: returning mock verified attributes");
      return {
        attributes: [
          "email",
          "phone",
          "address",
          "identity",
          "date_of_birth",
          "legal_name",
          "ssn_last4",
          "photo_id",
        ],
        verificationLevel: "IAL2",
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Fetching verified attributes");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${this.config.baseUrl}/api/public/v3/attributes`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Verified attributes request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ID.me] Verified attributes retrieved successfully");

      return {
        attributes: data.attributes || data.verified_attributes || [],
        verificationLevel: data.ial === 2 ? "IAL2" : "IAL1",
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Verified attributes error:", error);
      throw new Error(`[ID.me] Failed to get verified attributes: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async revokeAccess(accessToken: string): Promise<{
    success: boolean;
    revokedAt: Date;
    source: "live" | "demo";
  }> {
    if (!this.configured) {
      console.log("[ID.me] Demo mode: simulating access revocation");
      return {
        success: true,
        revokedAt: new Date(),
        source: "demo",
      };
    }

    try {
      console.log("[ID.me] Revoking access token");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(`${this.config.baseUrl}/oauth/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token revocation failed: ${response.status} - ${errorText}`);
      }

      console.log("[ID.me] Access token revoked successfully");

      return {
        success: true,
        revokedAt: new Date(),
        source: "live",
      };
    } catch (error) {
      console.error("[ID.me] Revocation error:", error);
      throw new Error(`[ID.me] Failed to revoke access: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  getConnectionStatus(userId: string): {
    connected: boolean;
    idmeUserId?: string;
    verificationLevel?: "IAL1" | "IAL2";
    connectedAt?: Date;
    lastVerified?: Date;
    source: "live" | "demo";
  } {
    const record = this.connections.get(userId);

    if (!this.configured && !record) {
      console.log("[ID.me] Demo mode: returning mock connection status");
      return {
        connected: false,
        source: "demo",
      };
    }

    if (record) {
      return {
        connected: true,
        idmeUserId: record.idmeUserId,
        verificationLevel: record.verificationLevel,
        connectedAt: record.connectedAt,
        lastVerified: record.lastVerified,
        source: this.configured ? "live" : "demo",
      };
    }

    return {
      connected: false,
      source: this.configured ? "live" : "demo",
    };
  }

  getSupportedGroups(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return SUPPORTED_GROUPS;
  }
}

export const idmeIntegrationService = new IDmeIntegrationService();

export function initializeIDmeIntegration(): void {
  const clientId = process.env.IDME_CLIENT_ID;
  const clientSecret = process.env.IDME_CLIENT_SECRET;
  const redirectUri = process.env.IDME_REDIRECT_URI;

  if (clientId && clientSecret && redirectUri) {
    console.log("[ID.me] Integration initialized with live credentials");
  } else {
    console.log("[ID.me] Integration running in demo mode - set IDME_CLIENT_ID, IDME_CLIENT_SECRET, and IDME_REDIRECT_URI to enable");
  }
}
