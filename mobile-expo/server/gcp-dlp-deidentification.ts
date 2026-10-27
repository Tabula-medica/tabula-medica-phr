import crypto from "crypto";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCP_DLP_ENABLED = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);

export interface DLPInspectResult {
  findings: DLPFinding[];
  totalFindings: number;
  inspectedText: string;
  provider: "gcp_dlp" | "local_regex";
  latencyMs: number;
}

export interface DLPFinding {
  infoType: string;
  likelihood: "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY";
  location: { start: number; end: number };
  quote: string;
  createTime?: string;
}

export interface DLPDeidentifyResult {
  deidentifiedText: string;
  transformedCount: number;
  transformations: DLPTransformation[];
  provider: "gcp_dlp" | "local_regex";
  latencyMs: number;
  auditId: string;
}

export interface DLPTransformation {
  infoType: string;
  originalValue: string;
  transformedValue: string;
  method: string;
}

export interface DLPConfig {
  infoTypes?: string[];
  minLikelihood?: string;
  includeQuote?: boolean;
  deidentifyMethod?: "redact" | "mask" | "hash" | "replace" | "date_shift";
  maskingCharacter?: string;
  dateShiftDays?: number;
  surrogateType?: string;
}

const HIPAA_INFO_TYPES = [
  "PERSON_NAME",
  "US_SOCIAL_SECURITY_NUMBER",
  "PHONE_NUMBER",
  "EMAIL_ADDRESS",
  "STREET_ADDRESS",
  "DATE_OF_BIRTH",
  "AGE",
  "IP_ADDRESS",
  "US_DRIVERS_LICENSE_NUMBER",
  "US_PASSPORT",
  "MEDICAL_RECORD_NUMBER",
  "US_HEALTHCARE_NPI",
  "US_DEA_NUMBER",
  "LOCATION",
  "CREDIT_CARD_NUMBER",
  "US_BANK_ROUTING_MICR",
  "US_INDIVIDUAL_TAXPAYER_IDENTIFICATION_NUMBER",
  "URL",
  "VEHICLE_IDENTIFICATION_NUMBER",
  "DEVICE_ID",
];

const LOCAL_PHI_PATTERNS: Record<string, RegExp> = {
  US_SOCIAL_SECURITY_NUMBER: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  PHONE_NUMBER: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  EMAIL_ADDRESS: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  MEDICAL_RECORD_NUMBER: /\b(?:MRN|mrn)[-:\s]?\d{4,10}\b/gi,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  DATE_OF_BIRTH: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
  PERSON_NAME: /(?:^|\s)([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)(?:\s|$)/g,
  STREET_ADDRESS: /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court)\b/gi,
  CREDIT_CARD_NUMBER: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  US_DRIVERS_LICENSE_NUMBER: /\b[A-Z]\d{7,14}\b/g,
};

interface AuditEntry {
  id: string;
  timestamp: Date;
  operation: "inspect" | "deidentify" | "reidentify";
  inputLength: number;
  findingsCount: number;
  provider: "gcp_dlp" | "local_regex";
  config: DLPConfig;
  latencyMs: number;
  userId?: string;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 5000;

function logAudit(entry: AuditEntry): void {
  auditLog.unshift(entry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) auditLog.pop();
}

async function getGCPToken(): Promise<string | null> {
  try {
    const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
    const resp = await fetch(metadataUrl, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.access_token;
    }
  } catch {}

  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const key = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({
        iss: key.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })).toString("base64url");
      const signInput = `${header}.${payload}`;
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(signInput);
      const signature = sign.sign(key.private_key, "base64url");
      const jwt = `${signInput}.${signature}`;
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        return tokenData.access_token;
      }
    } catch {}
  }
  return null;
}

export async function inspectContent(
  text: string,
  config: DLPConfig = {},
  userId?: string
): Promise<DLPInspectResult> {
  const startTime = Date.now();
  const infoTypes = config.infoTypes || HIPAA_INFO_TYPES;
  const minLikelihood = config.minLikelihood || "LIKELY";

  if (GCP_DLP_ENABLED) {
    try {
      const token = await getGCPToken();
      if (token) {
        const requestBody = {
          item: { value: text },
          inspectConfig: {
            infoTypes: infoTypes.map((t) => ({ name: t })),
            minLikelihood,
            includeQuote: config.includeQuote !== false,
            limits: { maxFindingsPerRequest: 100 },
          },
        };

        const resp = await fetch(
          `https://dlp.googleapis.com/v2/projects/${GCP_PROJECT_ID}/content:inspect`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const findings: DLPFinding[] = (data.result?.findings || []).map((f: any) => ({
            infoType: f.infoType?.name || "UNKNOWN",
            likelihood: f.likelihood || "POSSIBLE",
            location: {
              start: parseInt(f.location?.codepointRange?.start || "0"),
              end: parseInt(f.location?.codepointRange?.end || "0"),
            },
            quote: f.quote || "",
            createTime: f.createTime,
          }));

          const latencyMs = Date.now() - startTime;
          logAudit({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            operation: "inspect",
            inputLength: text.length,
            findingsCount: findings.length,
            provider: "gcp_dlp",
            config,
            latencyMs,
            userId,
          });

          return {
            findings,
            totalFindings: findings.length,
            inspectedText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
            provider: "gcp_dlp",
            latencyMs,
          };
        }
      }
    } catch {}
  }

  return inspectContentLocal(text, config, userId, startTime);
}

function inspectContentLocal(
  text: string,
  config: DLPConfig,
  userId?: string,
  startTime?: number
): DLPInspectResult {
  const start = startTime || Date.now();
  const findings: DLPFinding[] = [];

  for (const [infoType, pattern] of Object.entries(LOCAL_PHI_PATTERNS)) {
    if (config.infoTypes && !config.infoTypes.includes(infoType)) continue;
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      findings.push({
        infoType,
        likelihood: "LIKELY",
        location: { start: match.index, end: match.index + match[0].length },
        quote: match[0],
      });
    }
  }

  const latencyMs = Date.now() - start;
  logAudit({
    id: crypto.randomUUID(),
    timestamp: new Date(),
    operation: "inspect",
    inputLength: text.length,
    findingsCount: findings.length,
    provider: "local_regex",
    config,
    latencyMs,
    userId,
  });

  return {
    findings,
    totalFindings: findings.length,
    inspectedText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    provider: "local_regex",
    latencyMs,
  };
}

export async function deidentifyContent(
  text: string,
  config: DLPConfig = {},
  userId?: string
): Promise<DLPDeidentifyResult> {
  const startTime = Date.now();
  const method = config.deidentifyMethod || "redact";
  const auditId = crypto.randomUUID();

  if (GCP_DLP_ENABLED) {
    try {
      const token = await getGCPToken();
      if (token) {
        const infoTypes = (config.infoTypes || HIPAA_INFO_TYPES).map((t) => ({ name: t }));
        let deidentifyConfig: any;

        switch (method) {
          case "mask":
            deidentifyConfig = {
              infoTypeTransformations: {
                transformations: [{
                  infoTypes,
                  primitiveTransformation: {
                    characterMaskConfig: {
                      maskingCharacter: config.maskingCharacter || "*",
                      numberToMask: 0,
                    },
                  },
                }],
              },
            };
            break;
          case "hash":
            deidentifyConfig = {
              infoTypeTransformations: {
                transformations: [{
                  infoTypes,
                  primitiveTransformation: {
                    cryptoHashConfig: {
                      cryptoKey: {
                        unwrapped: {
                          key: Buffer.from(process.env.PHI_ENCRYPTION_KEY || "default-phi-key-32-bytes-long!!!").toString("base64"),
                        },
                      },
                    },
                  },
                }],
              },
            };
            break;
          case "replace":
            deidentifyConfig = {
              infoTypeTransformations: {
                transformations: [{
                  infoTypes,
                  primitiveTransformation: {
                    replaceWithInfoTypeConfig: {},
                  },
                }],
              },
            };
            break;
          case "date_shift":
            deidentifyConfig = {
              infoTypeTransformations: {
                transformations: [{
                  infoTypes: [{ name: "DATE_OF_BIRTH" }, { name: "DATE" }],
                  primitiveTransformation: {
                    dateShiftConfig: {
                      upperBoundDays: config.dateShiftDays || 30,
                      lowerBoundDays: -(config.dateShiftDays || 30),
                    },
                  },
                }],
              },
            };
            break;
          default:
            deidentifyConfig = {
              infoTypeTransformations: {
                transformations: [{
                  infoTypes,
                  primitiveTransformation: {
                    replaceConfig: { newValue: { stringValue: "[REDACTED]" } },
                  },
                }],
              },
            };
        }

        const requestBody = {
          item: { value: text },
          deidentifyConfig,
          inspectConfig: {
            infoTypes,
            minLikelihood: config.minLikelihood || "LIKELY",
          },
        };

        const resp = await fetch(
          `https://dlp.googleapis.com/v2/projects/${GCP_PROJECT_ID}/content:deidentify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const transformations: DLPTransformation[] =
            (data.overview?.transformationSummaries || []).map((s: any) => ({
              infoType: s.infoType?.name || "UNKNOWN",
              originalValue: "[inspected]",
              transformedValue: `[${method.toUpperCase()}]`,
              method,
            }));

          const latencyMs = Date.now() - startTime;
          logAudit({
            id: auditId,
            timestamp: new Date(),
            operation: "deidentify",
            inputLength: text.length,
            findingsCount: transformations.length,
            provider: "gcp_dlp",
            config,
            latencyMs,
            userId,
          });

          return {
            deidentifiedText: data.item?.value || text,
            transformedCount: data.overview?.transformedBytes ? parseInt(data.overview.transformedBytes) : transformations.length,
            transformations,
            provider: "gcp_dlp",
            latencyMs,
            auditId,
          };
        }
      }
    } catch {}
  }

  return deidentifyContentLocal(text, config, userId, startTime, auditId);
}

function deidentifyContentLocal(
  text: string,
  config: DLPConfig,
  userId?: string,
  startTime?: number,
  auditId?: string
): DLPDeidentifyResult {
  const start = startTime || Date.now();
  const id = auditId || crypto.randomUUID();
  let deidentified = text;
  const transformations: DLPTransformation[] = [];
  const method = config.deidentifyMethod || "redact";

  for (const [infoType, pattern] of Object.entries(LOCAL_PHI_PATTERNS)) {
    if (config.infoTypes && !config.infoTypes.includes(infoType)) continue;
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      let replacement: string;
      switch (method) {
        case "mask":
          replacement = (config.maskingCharacter || "*").repeat(match[0].length);
          break;
        case "hash":
          replacement = `[HASH:${crypto.createHash("sha256").update(match[0]).digest("hex").substring(0, 8)}]`;
          break;
        case "replace":
          replacement = `[${infoType}]`;
          break;
        default:
          replacement = "[REDACTED]";
      }
      transformations.push({
        infoType,
        originalValue: match[0],
        transformedValue: replacement,
        method,
      });
    }
    deidentified = deidentified.replace(regex, (m) => {
      switch (method) {
        case "mask": return (config.maskingCharacter || "*").repeat(m.length);
        case "hash": return `[HASH:${crypto.createHash("sha256").update(m).digest("hex").substring(0, 8)}]`;
        case "replace": return `[${infoType}]`;
        default: return "[REDACTED]";
      }
    });
  }

  const latencyMs = Date.now() - start;
  logAudit({
    id,
    timestamp: new Date(),
    operation: "deidentify",
    inputLength: text.length,
    findingsCount: transformations.length,
    provider: "local_regex",
    config,
    latencyMs,
    userId,
  });

  return {
    deidentifiedText: deidentified,
    transformedCount: transformations.length,
    transformations,
    provider: "local_regex",
    latencyMs,
    auditId: id,
  };
}

export function getDLPServiceStatus(): {
  gcpEnabled: boolean;
  projectId: string;
  supportedInfoTypes: string[];
  supportedMethods: string[];
  auditLogSize: number;
  provider: string;
} {
  return {
    gcpEnabled: GCP_DLP_ENABLED,
    projectId: GCP_PROJECT_ID,
    supportedInfoTypes: HIPAA_INFO_TYPES,
    supportedMethods: ["redact", "mask", "hash", "replace", "date_shift"],
    auditLogSize: auditLog.length,
    provider: GCP_DLP_ENABLED ? "Google Cloud DLP" : "Local Regex (fallback)",
  };
}

export function getDLPAuditLog(limit: number = 50): AuditEntry[] {
  return auditLog.slice(0, limit);
}
