import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";
import { logger } from "./utils/logger";

function ipToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [networkStr, prefixLenStr] = cidr.split("/");
  const prefixLen = parseInt(prefixLenStr, 10);
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
  const ipNum = ipToUint32(ip);
  const networkNum = ipToUint32(networkStr);
  if (ipNum === null || networkNum === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipNum & mask) === (networkNum & mask);
}

function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
  const normalizedIp = ip.replace(/^::ffff:/, "");
  for (const range of allowedRanges) {
    const trimmed = range.trim();
    if (!trimmed) continue;
    if (trimmed.includes("/")) {
      if (isIpInCidr(normalizedIp, trimmed)) return true;
    } else {
      if (normalizedIp === trimmed) return true;
    }
  }
  return false;
}

type PackagePasscodeRecord = { failures: number; lastFailure: number; lockedUntil: number };
const packagePasscodeLockouts = new Map<string, PackagePasscodeRecord>();
const PKG_PASSCODE_WINDOW_MS = 3_600_000;
const PKG_PASSCODE_LOCKOUT_THRESHOLDS = [
  { failures: 5,  lockoutMs: 60_000 },
  { failures: 10, lockoutMs: 300_000 },
  { failures: 15, lockoutMs: 900_000 },
  { failures: 20, lockoutMs: 3_600_000 },
];

function applyPkgPasscodeLockout(rec: PackagePasscodeRecord): void {
  for (let i = PKG_PASSCODE_LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rec.failures >= PKG_PASSCODE_LOCKOUT_THRESHOLDS[i].failures) {
      rec.lockedUntil = Date.now() + PKG_PASSCODE_LOCKOUT_THRESHOLDS[i].lockoutMs;
      break;
    }
  }
}

function prunePkgPasscodeLockouts(now: number): void {
  if (packagePasscodeLockouts.size > 50000) {
    const cutoff = now - PKG_PASSCODE_WINDOW_MS;
    for (const [k, v] of packagePasscodeLockouts) {
      if (v.lastFailure < cutoff) packagePasscodeLockouts.delete(k);
    }
  }
}

interface SharePackage {
  id: string;
  patientId: string;
  type: "specialist_referral" | "second_opinion" | "international_transfer" | "clinical_trial" | "emergency" | "research" | "caregiver";
  title: string;
  description?: string;
  recipientType: "provider" | "institution" | "researcher" | "caregiver" | "patient_self";
  recipientInfo: {
    name?: string;
    email?: string;
    organization?: string;
    npi?: string;
    country?: string;
    relationship?: string;
  };
  contents: ShareContents;
  accessControl: ShareAccessControl;
  delivery: ShareDelivery;
  status: "draft" | "pending_consent" | "generating" | "ready" | "delivered" | "viewed" | "expired" | "revoked";
  createdAt: Date;
  expiresAt: Date;
  accessLog: AccessLogEntry[];
  analytics: ShareAnalytics;
}

interface ShareContents {
  includeAll: boolean;
  selectedCategories: RecordCategory[];
  selectedRecordIds?: string[];
  dateRange?: { start: Date; end: Date };
  includeProvenance: boolean;
  includeRawFhir: boolean;
  redactedFields?: string[];
  customNotes?: string;
  aiSummaryIncluded: boolean;
  aiSummary?: string;
}

type RecordCategory = 
  | "conditions" | "medications" | "allergies" | "immunizations" 
  | "labs" | "vitals" | "procedures" | "imaging" 
  | "encounters" | "clinical_notes" | "care_plans" | "goals";

interface ShareAccessControl {
  passcode?: string;
  passcodeHash?: string;
  maxViews?: number;
  viewCount: number;
  allowDownload: boolean;
  allowPrint: boolean;
  watermark: boolean;
  requireIdentityVerification: boolean;
  allowedIPRanges?: string[];
  restrictToRecipientEmail?: boolean;
  breakGlassEnabled: boolean;
}

interface ShareDelivery {
  method: "link" | "email" | "fax" | "direct_message" | "smart_health_link" | "fhir_api";
  link?: string;
  smartHealthLink?: string;
  fhirEndpoint?: string;
  emailSent?: boolean;
  emailSentAt?: Date;
  qrCode?: string;
  deepLink?: string;
  faxNumber?: string;
  faxStatus?: "pending" | "sent" | "failed" | "confirmed";
}

interface AccessLogEntry {
  id: string;
  timestamp: Date;
  action: "created" | "viewed" | "downloaded" | "printed" | "forwarded" | "expired" | "revoked";
  accessorInfo: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    verifiedIdentity?: boolean;
  };
  details?: string;
}

interface ShareAnalytics {
  totalViews: number;
  uniqueViewers: number;
  downloadCount: number;
  printCount: number;
  averageViewDuration?: number;
  lastViewedAt?: Date;
  geographicLocations: string[];
}

interface ShareTemplate {
  id: string;
  name: string;
  type: SharePackage["type"];
  description: string;
  defaultContents: Partial<ShareContents>;
  defaultAccessControl: Partial<ShareAccessControl>;
  suggestedDuration: number;
  requiredFields: string[];
}

interface FHIRBundle {
  resourceType: "Bundle";
  type: "document" | "collection";
  timestamp: string;
  identifier: { system: string; value: string };
  entry: Array<{
    fullUrl: string;
    resource: any;
  }>;
  meta: {
    profile: string[];
    lastUpdated: string;
  };
}

interface SmartHealthLink {
  url: string;
  qrCodeData: string;
  passcode?: string;
  exp: number;
  label: string;
  flag?: "L" | "P";
}

const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    id: "specialist_referral",
    name: "Specialist Referral Package",
    type: "specialist_referral",
    description: "Complete medical summary for specialist consultation",
    defaultContents: {
      includeAll: false,
      selectedCategories: ["conditions", "medications", "allergies", "labs", "vitals", "procedures"],
      includeProvenance: true,
      includeRawFhir: false,
      aiSummaryIncluded: true
    },
    defaultAccessControl: {
      maxViews: 10,
      allowDownload: true,
      allowPrint: true,
      watermark: true,
      requireIdentityVerification: false,
      breakGlassEnabled: false
    },
    suggestedDuration: 30,
    requiredFields: ["recipientName", "recipientSpecialty"]
  },
  {
    id: "second_opinion",
    name: "Second Opinion Package",
    type: "second_opinion",
    description: "Comprehensive records for independent medical review",
    defaultContents: {
      includeAll: true,
      selectedCategories: [],
      includeProvenance: true,
      includeRawFhir: true,
      aiSummaryIncluded: true
    },
    defaultAccessControl: {
      maxViews: 5,
      allowDownload: true,
      allowPrint: true,
      watermark: true,
      requireIdentityVerification: true,
      breakGlassEnabled: false
    },
    suggestedDuration: 60,
    requiredFields: ["recipientOrganization"]
  },
  {
    id: "international_transfer",
    name: "International Medical Transfer",
    type: "international_transfer",
    description: "Translated and formatted records for international providers",
    defaultContents: {
      includeAll: true,
      selectedCategories: [],
      includeProvenance: true,
      includeRawFhir: true,
      aiSummaryIncluded: true
    },
    defaultAccessControl: {
      maxViews: 20,
      allowDownload: true,
      allowPrint: true,
      watermark: true,
      requireIdentityVerification: true,
      breakGlassEnabled: true
    },
    suggestedDuration: 90,
    requiredFields: ["recipientCountry", "recipientOrganization"]
  },
  {
    id: "clinical_trial",
    name: "Clinical Trial Enrollment",
    type: "clinical_trial",
    description: "Eligibility verification package for research studies",
    defaultContents: {
      includeAll: false,
      selectedCategories: ["conditions", "medications", "labs", "procedures"],
      includeProvenance: true,
      includeRawFhir: true,
      aiSummaryIncluded: false
    },
    defaultAccessControl: {
      maxViews: 3,
      allowDownload: true,
      allowPrint: false,
      watermark: true,
      requireIdentityVerification: true,
      breakGlassEnabled: false
    },
    suggestedDuration: 30,
    requiredFields: ["trialId", "principalInvestigator"]
  },
  {
    id: "emergency",
    name: "Emergency Access Card",
    type: "emergency",
    description: "Critical information for emergency responders",
    defaultContents: {
      includeAll: false,
      selectedCategories: ["conditions", "medications", "allergies"],
      includeProvenance: false,
      includeRawFhir: false,
      aiSummaryIncluded: true
    },
    defaultAccessControl: {
      maxViews: undefined,
      allowDownload: false,
      allowPrint: true,
      watermark: false,
      requireIdentityVerification: false,
      breakGlassEnabled: true
    },
    suggestedDuration: 365,
    requiredFields: []
  },
  {
    id: "caregiver",
    name: "Caregiver Access",
    type: "caregiver",
    description: "Ongoing access for family caregivers",
    defaultContents: {
      includeAll: false,
      selectedCategories: ["conditions", "medications", "allergies", "care_plans", "goals"],
      includeProvenance: false,
      includeRawFhir: false,
      aiSummaryIncluded: true
    },
    defaultAccessControl: {
      maxViews: undefined,
      allowDownload: true,
      allowPrint: true,
      watermark: true,
      requireIdentityVerification: true,
      breakGlassEnabled: false
    },
    suggestedDuration: 365,
    requiredFields: ["caregiverName", "caregiverRelationship"]
  }
];

class OneTapShareService {
  private packages: Map<string, SharePackage> = new Map();
  private encryptionKey: Buffer;

  constructor() {
    const secret = process.env.SHARE_ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.DATABASE_URL || "dev-only-share-key";
    this.encryptionKey = createHash("sha256").update(secret).digest();
  }

  getTemplates(): ShareTemplate[] {
    return SHARE_TEMPLATES;
  }

  getTemplate(templateId: string): ShareTemplate | null {
    return SHARE_TEMPLATES.find(t => t.id === templateId) || null;
  }

  async createSharePackage(
    patientId: string,
    templateId: string,
    recipientInfo: SharePackage["recipientInfo"],
    customOptions?: Partial<ShareContents & ShareAccessControl>,
    durationDays?: number
  ): Promise<SharePackage> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const id = `share_${Date.now()}_${randomBytes(8).toString("hex")}`;
    const duration = durationDays || template.suggestedDuration;
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

    let passcodeHash: string | undefined;
    let passcode: string | undefined;
    
    if (customOptions?.passcode) {
      passcode = customOptions.passcode;
      passcodeHash = this.hashPasscode(passcode);
    }

    const sharePackage: SharePackage = {
      id,
      patientId,
      type: template.type,
      title: template.name,
      description: template.description,
      recipientType: this.inferRecipientType(template.type, recipientInfo),
      recipientInfo,
      contents: {
        includeAll: customOptions?.includeAll ?? template.defaultContents.includeAll ?? false,
        selectedCategories: customOptions?.selectedCategories ?? template.defaultContents.selectedCategories ?? [],
        selectedRecordIds: customOptions?.selectedRecordIds,
        dateRange: customOptions?.dateRange,
        includeProvenance: customOptions?.includeProvenance ?? template.defaultContents.includeProvenance ?? true,
        includeRawFhir: customOptions?.includeRawFhir ?? template.defaultContents.includeRawFhir ?? false,
        redactedFields: customOptions?.redactedFields,
        customNotes: customOptions?.customNotes,
        aiSummaryIncluded: customOptions?.aiSummaryIncluded ?? template.defaultContents.aiSummaryIncluded ?? true
      },
      accessControl: {
        passcodeHash,
        maxViews: customOptions?.maxViews ?? template.defaultAccessControl.maxViews,
        viewCount: 0,
        allowDownload: customOptions?.allowDownload ?? template.defaultAccessControl.allowDownload ?? true,
        allowPrint: customOptions?.allowPrint ?? template.defaultAccessControl.allowPrint ?? true,
        watermark: customOptions?.watermark ?? template.defaultAccessControl.watermark ?? true,
        requireIdentityVerification: customOptions?.requireIdentityVerification ?? template.defaultAccessControl.requireIdentityVerification ?? false,
        allowedIPRanges: customOptions?.allowedIPRanges,
        restrictToRecipientEmail: customOptions?.restrictToRecipientEmail,
        breakGlassEnabled: customOptions?.breakGlassEnabled ?? template.defaultAccessControl.breakGlassEnabled ?? false
      },
      delivery: {
        method: "link"
      },
      status: "generating",
      createdAt: new Date(),
      expiresAt,
      accessLog: [{
        id: `log_${Date.now()}`,
        timestamp: new Date(),
        action: "created",
        accessorInfo: {},
        details: `Share package created for ${recipientInfo.name || recipientInfo.organization || "recipient"}`
      }],
      analytics: {
        totalViews: 0,
        uniqueViewers: 0,
        downloadCount: 0,
        printCount: 0,
        geographicLocations: []
      }
    };

    this.packages.set(id, sharePackage);

    await this.generateDeliveryMethods(sharePackage);

    sharePackage.status = "ready";

    return sharePackage;
  }

  private inferRecipientType(type: SharePackage["type"], recipientInfo: SharePackage["recipientInfo"]): SharePackage["recipientType"] {
    if (type === "caregiver") return "caregiver";
    if (type === "research" || type === "clinical_trial") return "researcher";
    if (recipientInfo.npi) return "provider";
    if (recipientInfo.organization) return "institution";
    return "provider";
  }

  private hashPasscode(passcode: string): string {
    return createHash("sha256").update(passcode).digest("hex");
  }

  private async generateDeliveryMethods(pkg: SharePackage): Promise<void> {
    const baseUrl = process.env.APP_URL || "https://tabula-medica.app";
    
    pkg.delivery.link = `${baseUrl}/share/${pkg.id}`;
    pkg.delivery.deepLink = `tabulamedica://share/${pkg.id}`;

    const shlData = await this.generateSmartHealthLink(pkg);
    pkg.delivery.smartHealthLink = shlData.url;
    pkg.delivery.qrCode = shlData.qrCodeData;
  }

  private async generateSmartHealthLink(pkg: SharePackage): Promise<SmartHealthLink> {
    const shlPayload = {
      url: pkg.delivery.link || "",
      exp: Math.floor(pkg.expiresAt.getTime() / 1000),
      flag: pkg.accessControl.passcodeHash ? "P" : undefined,
      label: pkg.title
    };

    const encodedPayload = Buffer.from(JSON.stringify(shlPayload)).toString("base64url");
    const shlUrl = `shlink:/eyJjdHkiOiJzbWFydC1oZWFsdGgtY2FyZCIsImp3cyI6IiR7encodedPayload}"}`;

    return {
      url: shlUrl,
      qrCodeData: `data:image/svg+xml,${encodeURIComponent(this.generateQRCodeSVG(shlUrl))}`,
      passcode: pkg.accessControl.passcodeHash ? "Protected" : undefined,
      exp: shlPayload.exp,
      label: pkg.title,
      flag: shlPayload.flag as "P" | undefined
    };
  }

  private generateQRCodeSVG(data: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="white"/>
      <text x="100" y="100" text-anchor="middle" font-size="12">QR: ${data.substring(0, 20)}...</text>
    </svg>`;
  }

  async generateFHIRBundle(packageId: string, healthRecords: any[]): Promise<FHIRBundle> {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error("Package not found");
    }

    let filteredRecords = healthRecords;

    if (!pkg.contents.includeAll && pkg.contents.selectedCategories.length > 0) {
      const categoryMapping: Record<RecordCategory, string[]> = {
        conditions: ["condition", "diagnosis"],
        medications: ["medication"],
        allergies: ["allergy"],
        immunizations: ["immunization"],
        labs: ["lab"],
        vitals: ["vital"],
        procedures: ["procedure"],
        imaging: ["imaging"],
        encounters: ["visit", "encounter"],
        clinical_notes: ["note"],
        care_plans: ["care_plan"],
        goals: ["goal"]
      };

      const allowedTypes = pkg.contents.selectedCategories
        .flatMap(cat => categoryMapping[cat] || []);
      
      filteredRecords = filteredRecords.filter(r => allowedTypes.includes(r.type));
    }

    if (pkg.contents.dateRange) {
      filteredRecords = filteredRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= pkg.contents.dateRange!.start && recordDate <= pkg.contents.dateRange!.end;
      });
    }

    if (pkg.contents.selectedRecordIds?.length) {
      filteredRecords = filteredRecords.filter(r => pkg.contents.selectedRecordIds!.includes(r.id));
    }

    const bundle: FHIRBundle = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      identifier: {
        system: "urn:tabula-medica:share",
        value: packageId
      },
      entry: filteredRecords.map(record => ({
        fullUrl: `urn:uuid:${record.id}`,
        resource: this.recordToFHIR(record, pkg.contents.includeProvenance)
      })),
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"],
        lastUpdated: new Date().toISOString()
      }
    };

    return bundle;
  }

  private recordToFHIR(record: any, includeProvenance: boolean): any {
    const fhirResource: any = {
      resourceType: this.mapToFHIRResourceType(record.type),
      id: record.id,
      meta: {
        lastUpdated: new Date(record.date).toISOString()
      }
    };

    if (includeProvenance) {
      fhirResource.meta.source = record.sourceName || "Unknown";
      fhirResource.meta.extension = [{
        url: "http://tabula-medica.app/fhir/StructureDefinition/provenance",
        valueReference: {
          reference: `Organization/${record.sourceId || "unknown"}`,
          display: record.sourceName || "Unknown"
        }
      }];
    }

    fhirResource.text = {
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml">${record.title}: ${record.summary || ""}</div>`
    };

    return fhirResource;
  }

  private mapToFHIRResourceType(type: string): string {
    const mapping: Record<string, string> = {
      condition: "Condition",
      diagnosis: "Condition",
      medication: "MedicationStatement",
      allergy: "AllergyIntolerance",
      immunization: "Immunization",
      lab: "Observation",
      vital: "Observation",
      procedure: "Procedure",
      imaging: "ImagingStudy",
      visit: "Encounter",
      encounter: "Encounter",
      note: "DocumentReference",
      care_plan: "CarePlan",
      goal: "Goal"
    };
    return mapping[type] || "Basic";
  }

  async accessPackage(
    packageId: string,
    passcode?: string,
    accessorInfo?: AccessLogEntry["accessorInfo"]
  ): Promise<{ authorized: boolean; package?: SharePackage; error?: string }> {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      return { authorized: false, error: "Package not found" };
    }

    if (pkg.status === "revoked") {
      return { authorized: false, error: "This share link has been revoked" };
    }

    if (pkg.status === "expired" || new Date() > pkg.expiresAt) {
      pkg.status = "expired";
      return { authorized: false, error: "This share link has expired" };
    }

    if (pkg.accessControl.maxViews && pkg.accessControl.viewCount >= pkg.accessControl.maxViews) {
      return { authorized: false, error: "Maximum views exceeded" };
    }

    if (pkg.accessControl.passcodeHash) {
      const requesterIp = accessorInfo?.ipAddress || "unknown";
      const lockoutKey = `${requesterIp}:${packageId}`;
      const now = Date.now();
      const lockoutRec = packagePasscodeLockouts.get(lockoutKey);

      if (lockoutRec) {
        if (now - lockoutRec.lastFailure > PKG_PASSCODE_WINDOW_MS) {
          packagePasscodeLockouts.delete(lockoutKey);
        } else if (lockoutRec.lockedUntil > now) {
          const retryAfter = Math.ceil((lockoutRec.lockedUntil - now) / 1000);
          logger.warn("Share package passcode locked out", { packageId, requesterIp });
          return { authorized: false, error: "Too many incorrect passcode attempts. Please try again later.", retryAfter } as any;
        }
      }

      if (passcode) {
        const providedHash = this.hashPasscode(passcode);
        if (providedHash !== pkg.accessControl.passcodeHash) {
          const rec = packagePasscodeLockouts.get(lockoutKey) || { failures: 0, lastFailure: 0, lockedUntil: 0 };
          rec.failures++;
          rec.lastFailure = now;
          applyPkgPasscodeLockout(rec);
          packagePasscodeLockouts.set(lockoutKey, rec);
          prunePkgPasscodeLockouts(now);
          logger.warn("Share package passcode failure", { packageId, requesterIp, failures: rec.failures });
          return { authorized: false, error: "Invalid passcode" };
        }
        packagePasscodeLockouts.delete(lockoutKey);
      } else {
        return { authorized: false, error: "Passcode required" };
      }
    }

    if (
      pkg.accessControl.allowedIPRanges &&
      pkg.accessControl.allowedIPRanges.length > 0
    ) {
      const requesterIp = accessorInfo?.ipAddress || "";
      if (!requesterIp || !isIpAllowed(requesterIp, pkg.accessControl.allowedIPRanges)) {
        logger.warn("Share package access denied: IP not in allowed ranges", { packageId, requesterIp });
        return { authorized: false, error: "Access is not permitted from your network location" };
      }
    }

    if (pkg.accessControl.restrictToRecipientEmail) {
      return {
        authorized: false,
        error: "This package is restricted to a verified recipient. Please use the secure link sent directly to the intended recipient's email address.",
      };
    }

    if (pkg.accessControl.requireIdentityVerification) {
      return {
        authorized: false,
        error: "This package requires identity verification. Please use the authenticated access link provided in your invitation.",
      };
    }

    pkg.accessControl.viewCount++;
    pkg.analytics.totalViews++;
    pkg.analytics.lastViewedAt = new Date();

    if (accessorInfo?.ipAddress) {
      const existingViewer = pkg.accessLog.find(
        log => log.accessorInfo.ipAddress === accessorInfo.ipAddress && log.action === "viewed"
      );
      if (!existingViewer) {
        pkg.analytics.uniqueViewers++;
      }
    }

    if (accessorInfo?.location && !pkg.analytics.geographicLocations.includes(accessorInfo.location)) {
      pkg.analytics.geographicLocations.push(accessorInfo.location);
    }

    pkg.accessLog.push({
      id: `log_${Date.now()}`,
      timestamp: new Date(),
      action: "viewed",
      accessorInfo: accessorInfo || {},
      details: "Package accessed"
    });

    if (pkg.status === "ready") {
      pkg.status = "viewed";
    }

    return { authorized: true, package: pkg };
  }

  async revokePackage(packageId: string, reason?: string): Promise<boolean> {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    pkg.status = "revoked";
    pkg.accessLog.push({
      id: `log_${Date.now()}`,
      timestamp: new Date(),
      action: "revoked",
      accessorInfo: {},
      details: reason || "Revoked by patient"
    });

    return true;
  }

  async extendExpiration(packageId: string, additionalDays: number): Promise<boolean> {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    pkg.expiresAt = new Date(pkg.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    return true;
  }

  async sendViaEmail(packageId: string, email: string): Promise<boolean> {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    pkg.delivery.method = "email";
    pkg.delivery.emailSent = true;
    pkg.delivery.emailSentAt = new Date();

    logger.info("Share package email delivery initiated", {
      category: "system",
      metadata: { packageId, method: "email" },
    });

    return true;
  }

  async sendViaFax(packageId: string, faxNumber: string): Promise<boolean> {
    const pkg = this.packages.get(packageId);
    if (!pkg) return false;

    pkg.delivery.method = "fax";
    pkg.delivery.faxNumber = faxNumber;
    pkg.delivery.faxStatus = "pending";

    logger.info("Share package fax delivery initiated", {
      category: "system",
      metadata: { packageId, method: "fax" },
    });

    pkg.delivery.faxStatus = "sent";

    return true;
  }

  getPackage(packageId: string): SharePackage | null {
    return this.packages.get(packageId) || null;
  }

  getPatientPackages(patientId: string): SharePackage[] {
    return Array.from(this.packages.values())
      .filter(pkg => pkg.patientId === patientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPackageAnalytics(packageId: string): ShareAnalytics | null {
    return this.packages.get(packageId)?.analytics || null;
  }

  getAccessLog(packageId: string): AccessLogEntry[] {
    return this.packages.get(packageId)?.accessLog || [];
  }

  async createQuickShare(
    patientId: string,
    type: "emergency" | "pharmacy" | "specialist",
    healthRecords: any[]
  ): Promise<{ link: string; qrCode: string; expiresIn: string }> {
    const templates: Record<string, { templateId: string; duration: number }> = {
      emergency: { templateId: "emergency", duration: 365 },
      pharmacy: { templateId: "specialist_referral", duration: 7 },
      specialist: { templateId: "specialist_referral", duration: 30 }
    };

    const config = templates[type];
    const pkg = await this.createSharePackage(
      patientId,
      config.templateId,
      { name: type === "emergency" ? "Emergency Responders" : "Healthcare Provider" },
      {},
      config.duration
    );

    return {
      link: pkg.delivery.link || "",
      qrCode: pkg.delivery.qrCode || "",
      expiresIn: `${config.duration} days`
    };
  }
}

export const oneTapShareService = new OneTapShareService();

export function initializeOneTapShare() {
  logger.info("One-tap share service initialized", { category: "system" });
}
