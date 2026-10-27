import crypto from "crypto";

export interface GoogleCloudSecurityConfig {
  projectId: string;
  keyRingId: string;
  keyId: string;
  region: string;
  vpcServiceControlsPerimeterName?: string;
  cloudArmorPolicyName?: string;
  iapClientId?: string;
}

export interface CMEKEncryptionResult {
  encryptedData: string;
  keyVersion: string;
  algorithm: string;
  encryptedAt: Date;
}

export interface CMEKDecryptionResult {
  decryptedData: string;
  keyVersion: string;
  decryptedAt: Date;
}

export interface VPCServiceControlsConfig {
  perimeterName: string;
  restrictedServices: string[];
  accessLevels: string[];
  ingressPolicies: Array<{
    source: string;
    allowedOperations: string[];
  }>;
  egressPolicies: Array<{
    destination: string;
    allowedOperations: string[];
  }>;
}

export interface CloudArmorRule {
  id: string;
  priority: number;
  description: string;
  action: "allow" | "deny" | "rate_limit" | "redirect";
  expression: string;
  preview: boolean;
  rateLimitOptions?: {
    conformAction: string;
    exceedAction: string;
    rateLimitThreshold: {
      count: number;
      intervalSec: number;
    };
  };
}

export interface CloudArmorPolicy {
  name: string;
  description: string;
  rules: CloudArmorRule[];
  adaptiveProtection: boolean;
  ddosProtection: boolean;
}

export interface IAPConfig {
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
  allowedGroups: string[];
  sessionLength: number;
  reauthenticationSettings: {
    method: "login" | "password" | "security_key";
    maxAge: number;
  };
}

export interface PrivateServiceConnectConfig {
  endpointName: string;
  targetService: string;
  network: string;
  subnetwork: string;
  ipAddress: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  eventType: string;
  principal: string;
  resource: string;
  action: string;
  status: "success" | "failure";
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  details: Record<string, unknown>;
}

const HEALTHCARE_SECURITY_RULES: CloudArmorRule[] = [
  {
    id: "block-known-bad-ips",
    priority: 1000,
    description: "Block known malicious IP ranges",
    action: "deny",
    expression: "evaluatePreconfiguredWaf('sqli-v33-stable')",
    preview: false
  },
  {
    id: "rate-limit-login",
    priority: 2000,
    description: "Rate limit authentication endpoints",
    action: "rate_limit",
    expression: "request.path.matches('/api/auth/.*')",
    preview: false,
    rateLimitOptions: {
      conformAction: "allow",
      exceedAction: "deny(429)",
      rateLimitThreshold: {
        count: 10,
        intervalSec: 60
      }
    }
  },
  {
    id: "block-xss",
    priority: 3000,
    description: "Block XSS attacks",
    action: "deny",
    expression: "evaluatePreconfiguredWaf('xss-v33-stable')",
    preview: false
  },
  {
    id: "block-rce",
    priority: 4000,
    description: "Block Remote Code Execution attempts",
    action: "deny",
    expression: "evaluatePreconfiguredWaf('rce-v33-stable')",
    preview: false
  },
  {
    id: "block-lfi",
    priority: 5000,
    description: "Block Local File Inclusion",
    action: "deny",
    expression: "evaluatePreconfiguredWaf('lfi-v33-stable')",
    preview: false
  },
  {
    id: "rate-limit-api",
    priority: 6000,
    description: "General API rate limiting",
    action: "rate_limit",
    expression: "request.path.matches('/api/.*')",
    preview: false,
    rateLimitOptions: {
      conformAction: "allow",
      exceedAction: "deny(429)",
      rateLimitThreshold: {
        count: 100,
        intervalSec: 60
      }
    }
  },
  {
    id: "allow-health-checks",
    priority: 7000,
    description: "Allow Google Cloud health checks",
    action: "allow",
    expression: "request.path == '/health' && inIpRange(origin.ip, '35.191.0.0/16')",
    preview: false
  }
];

class GoogleCloudSecurityService {
  private config: GoogleCloudSecurityConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  initialize(config: GoogleCloudSecurityConfig): void {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
    
    try {
      const response = await fetch(metadataUrl, {
        headers: {
          "Metadata-Flavor": "Google"
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
        return this.accessToken!;
      }
    } catch {
      console.log("Not running on GCP, using service account key");
    }

    const serviceAccountKey = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountKey) {
      throw new Error("No GCP credentials available");
    }

    const key = JSON.parse(serviceAccountKey);
    const now = Math.floor(Date.now() / 1000);
    
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })).toString("base64url");

    const signInput = `${header}.${payload}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signInput);
    const signature = sign.sign(key.private_key, "base64url");

    const jwt = `${signInput}.${signature}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to obtain GCP access token");
    }

    const tokenData = await tokenResponse.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 60) * 1000);
    return this.accessToken!;
  }

  async encryptWithCMEK(plaintext: string): Promise<CMEKEncryptionResult> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();
    const keyName = `projects/${this.config.projectId}/locations/${this.config.region}/keyRings/${this.config.keyRingId}/cryptoKeys/${this.config.keyId}`;

    const response = await fetch(
      `https://cloudkms.googleapis.com/v1/${keyName}:encrypt`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plaintext: Buffer.from(plaintext).toString("base64")
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CMEK encryption failed: ${error}`);
    }

    const data = await response.json();
    return {
      encryptedData: data.ciphertext,
      keyVersion: data.name,
      algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION",
      encryptedAt: new Date()
    };
  }

  async decryptWithCMEK(ciphertext: string): Promise<CMEKDecryptionResult> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();
    const keyName = `projects/${this.config.projectId}/locations/${this.config.region}/keyRings/${this.config.keyRingId}/cryptoKeys/${this.config.keyId}`;

    const response = await fetch(
      `https://cloudkms.googleapis.com/v1/${keyName}:decrypt`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ciphertext
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CMEK decryption failed: ${error}`);
    }

    const data = await response.json();
    return {
      decryptedData: Buffer.from(data.plaintext, "base64").toString("utf-8"),
      keyVersion: data.name,
      decryptedAt: new Date()
    };
  }

  async rotateKey(): Promise<{ newKeyVersion: string }> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();
    const keyName = `projects/${this.config.projectId}/locations/${this.config.region}/keyRings/${this.config.keyRingId}/cryptoKeys/${this.config.keyId}`;

    const response = await fetch(
      `https://cloudkms.googleapis.com/v1/${keyName}/cryptoKeyVersions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Key rotation failed: ${error}`);
    }

    const data = await response.json();

    await fetch(
      `https://cloudkms.googleapis.com/v1/${keyName}:updatePrimaryVersion`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cryptoKeyVersionId: data.name.split("/").pop()
        })
      }
    );

    return { newKeyVersion: data.name };
  }

  getHealthcareSecurityRules(): CloudArmorRule[] {
    return HEALTHCARE_SECURITY_RULES;
  }

  async createCloudArmorPolicy(policy: CloudArmorPolicy): Promise<{ policyId: string }> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/global/securityPolicies`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: policy.name,
          description: policy.description,
          rules: policy.rules.map(rule => ({
            priority: rule.priority,
            description: rule.description,
            action: rule.action === "rate_limit" ? "throttle" : rule.action,
            match: {
              expr: {
                expression: rule.expression
              }
            },
            preview: rule.preview,
            ...(rule.rateLimitOptions && {
              rateLimitOptions: rule.rateLimitOptions
            })
          })),
          adaptiveProtectionConfig: {
            layer7DdosDefenseConfig: {
              enable: policy.adaptiveProtection
            }
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Cloud Armor policy: ${error}`);
    }

    return { policyId: policy.name };
  }

  async configureVPCServiceControls(config: VPCServiceControlsConfig): Promise<{ perimeterId: string }> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `https://accesscontextmanager.googleapis.com/v1/accessPolicies/${this.config.projectId}/servicePerimeters`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: config.perimeterName,
          title: config.perimeterName,
          status: {
            restrictedServices: config.restrictedServices,
            accessLevels: config.accessLevels,
            ingressPolicies: config.ingressPolicies.map(policy => ({
              ingressFrom: {
                sources: [{ accessLevel: policy.source }]
              },
              ingressTo: {
                operations: policy.allowedOperations.map(op => ({
                  serviceName: op
                }))
              }
            })),
            egressPolicies: config.egressPolicies.map(policy => ({
              egressFrom: {},
              egressTo: {
                resources: [policy.destination],
                operations: policy.allowedOperations.map(op => ({
                  serviceName: op
                }))
              }
            }))
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to configure VPC Service Controls: ${error}`);
    }

    return { perimeterId: config.perimeterName };
  }

  async configurePrivateServiceConnect(config: PrivateServiceConnectConfig): Promise<{ endpointId: string }> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/regions/${this.config.region}/forwardingRules`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: config.endpointName,
          network: config.network,
          subnetwork: config.subnetwork,
          IPAddress: config.ipAddress,
          target: config.targetService,
          loadBalancingScheme: ""
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to configure Private Service Connect: ${error}`);
    }

    return { endpointId: config.endpointName };
  }

  async configureIdentityAwareProxy(config: IAPConfig): Promise<{ iapId: string }> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `https://iap.googleapis.com/v1/projects/${this.config.projectId}/iap_web/compute/v1/serviceAttachments`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessSettings: {
            oauthSettings: {
              clientId: config.clientId
            },
            allowedDomains: config.allowedDomains,
            reauthSettings: {
              method: config.reauthenticationSettings.method.toUpperCase(),
              maxAge: `${config.reauthenticationSettings.maxAge}s`
            }
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to configure Identity-Aware Proxy: ${error}`);
    }

    return { iapId: `iap-${this.config.projectId}` };
  }

  async queryAuditLogs(options: {
    startTime: Date;
    endTime: Date;
    resourceType?: string;
    principal?: string;
    action?: string;
    limit?: number;
  }): Promise<SecurityAuditLog[]> {
    if (!this.config) {
      throw new Error("Google Cloud security service not initialized");
    }

    const token = await this.getAccessToken();

    let filter = `timestamp >= "${options.startTime.toISOString()}" AND timestamp <= "${options.endTime.toISOString()}"`;
    
    if (options.resourceType) {
      filter += ` AND resource.type = "${options.resourceType}"`;
    }
    
    if (options.principal) {
      filter += ` AND protoPayload.authenticationInfo.principalEmail = "${options.principal}"`;
    }
    
    if (options.action) {
      filter += ` AND protoPayload.methodName =~ "${options.action}"`;
    }

    const response = await fetch(
      `https://logging.googleapis.com/v2/entries:list`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resourceNames: [`projects/${this.config.projectId}`],
          filter,
          orderBy: "timestamp desc",
          pageSize: options.limit || 100
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to query audit logs: ${error}`);
    }

    const data = await response.json();
    
    return (data.entries || []).map((entry: Record<string, unknown>) => {
      const protoPayload = entry.protoPayload as Record<string, unknown> || {};
      const authInfo = protoPayload.authenticationInfo as Record<string, unknown> || {};
      const requestMetadata = protoPayload.requestMetadata as Record<string, unknown> || {};
      
      return {
        id: entry.insertId as string,
        timestamp: new Date(entry.timestamp as string),
        eventType: protoPayload.serviceName as string || "unknown",
        principal: authInfo.principalEmail as string || "unknown",
        resource: (entry.resource as Record<string, unknown>)?.type as string || "unknown",
        action: protoPayload.methodName as string || "unknown",
        status: protoPayload.status ? "failure" : "success",
        ipAddress: requestMetadata.callerIp as string,
        userAgent: requestMetadata.callerSuppliedUserAgent as string,
        details: protoPayload
      };
    });
  }

  generateSecurityReport(): {
    cmekEnabled: boolean;
    vpcServiceControlsEnabled: boolean;
    cloudArmorEnabled: boolean;
    iapEnabled: boolean;
    privateServiceConnectEnabled: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (!this.config?.keyRingId) {
      recommendations.push("Enable CMEK encryption for PHI data at rest");
    }

    if (!this.config?.vpcServiceControlsPerimeterName) {
      recommendations.push("Configure VPC Service Controls to prevent data exfiltration");
    }

    if (!this.config?.cloudArmorPolicyName) {
      recommendations.push("Enable Cloud Armor for DDoS protection and WAF");
    }

    if (!this.config?.iapClientId) {
      recommendations.push("Enable Identity-Aware Proxy for zero-trust access");
    }

    return {
      cmekEnabled: !!this.config?.keyRingId,
      vpcServiceControlsEnabled: !!this.config?.vpcServiceControlsPerimeterName,
      cloudArmorEnabled: !!this.config?.cloudArmorPolicyName,
      iapEnabled: !!this.config?.iapClientId,
      privateServiceConnectEnabled: false,
      recommendations
    };
  }
}

export const googleCloudSecurityService = new GoogleCloudSecurityService();

export function initializeGoogleCloudSecurity(): void {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const keyRingId = process.env.GOOGLE_CLOUD_KMS_KEY_RING_ID;
  const keyId = process.env.GOOGLE_CLOUD_KMS_KEY_ID;
  const region = process.env.GOOGLE_CLOUD_REGION;

  if (projectId && region) {
    googleCloudSecurityService.initialize({
      projectId,
      keyRingId: keyRingId || "",
      keyId: keyId || "",
      region,
      vpcServiceControlsPerimeterName: process.env.GOOGLE_CLOUD_VPC_PERIMETER,
      cloudArmorPolicyName: process.env.GOOGLE_CLOUD_ARMOR_POLICY,
      iapClientId: process.env.GOOGLE_CLOUD_IAP_CLIENT_ID
    });
    console.log("Google Cloud security service initialized");
  } else {
    console.log("Google Cloud credentials not configured - security service disabled");
  }
}
