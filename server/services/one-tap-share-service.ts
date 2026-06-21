import crypto from "crypto";
import { healthGraphService, HealthNode, Episode } from "./health-graph-service";
import { logger } from "../lib/logger";

export interface SharePackage {
  packageId: string;
  patientId: string;
  packageType: "full_record" | "episode" | "summary" | "labs_only" | "medications_only" | "custom" | "second_opinion" | "clinical_trial";
  title: string;
  description: string;
  recipientType: "specialist" | "hospital" | "international" | "clinical_trial" | "second_opinion" | "caregiver" | "research";
  recipientDetails?: RecipientDetails;
  accessToken: string;
  accessUrl: string;
  qrCodeData: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  maxAccesses: number;
  status: "active" | "expired" | "revoked" | "accessed";
  contents: ShareContents;
  accessLog: ShareAccessLog[];
  permissions: SharePermissions;
}

export interface RecipientDetails {
  name?: string;
  organization?: string;
  email?: string;
  phone?: string;
  npi?: string;
  country?: string;
  specialty?: string;
}

export interface ShareContents {
  nodeIds: string[];
  episodeIds: string[];
  includeNarrative: boolean;
  includeTimeline: boolean;
  dateRange?: { start: string; end: string };
  fhirBundle?: any;
}

export interface ShareAccessLog {
  timestamp: string;
  accessedBy: string;
  ipAddress?: string;
  action: "viewed" | "downloaded" | "printed";
  details: string;
}

export interface SharePermissions {
  canDownload: boolean;
  canPrint: boolean;
  canForward: boolean;
  requiresVerification: boolean;
  notifyOnAccess: boolean;
}

export interface ShareTemplate {
  templateId: string;
  name: string;
  description: string;
  packageType: SharePackage["packageType"];
  defaultPermissions: SharePermissions;
  defaultExpiration: number;
  nodeTypes: string[];
  icon: string;
}

const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    templateId: "specialist_referral",
    name: "Specialist Referral",
    description: "Share relevant records with a new specialist",
    packageType: "custom",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: false,
      requiresVerification: false,
      notifyOnAccess: true,
    },
    defaultExpiration: 30 * 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "lab", "imaging", "procedure"],
    icon: "Stethoscope",
  },
  {
    templateId: "second_opinion",
    name: "Second Opinion Package",
    description: "Comprehensive records for a second medical opinion",
    packageType: "second_opinion",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: true,
      requiresVerification: true,
      notifyOnAccess: true,
    },
    defaultExpiration: 14 * 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "lab", "imaging", "procedure", "specialist", "episode"],
    icon: "UserCheck",
  },
  {
    templateId: "emergency",
    name: "Emergency Access",
    description: "Critical health information for emergency situations",
    packageType: "summary",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: true,
      requiresVerification: false,
      notifyOnAccess: true,
    },
    defaultExpiration: 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "allergy"],
    icon: "AlertTriangle",
  },
  {
    templateId: "international",
    name: "International Provider",
    description: "Records for healthcare abroad",
    packageType: "full_record",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: false,
      requiresVerification: true,
      notifyOnAccess: true,
    },
    defaultExpiration: 90 * 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "lab", "imaging", "procedure", "immunization", "allergy"],
    icon: "Globe",
  },
  {
    templateId: "clinical_trial",
    name: "Clinical Trial Application",
    description: "De-identified records for clinical trial screening",
    packageType: "clinical_trial",
    defaultPermissions: {
      canDownload: true,
      canPrint: false,
      canForward: false,
      requiresVerification: true,
      notifyOnAccess: true,
    },
    defaultExpiration: 60 * 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "lab", "procedure"],
    icon: "FlaskConical",
  },
  {
    templateId: "labs_only",
    name: "Lab Results Only",
    description: "Share only laboratory test results",
    packageType: "labs_only",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: false,
      requiresVerification: false,
      notifyOnAccess: true,
    },
    defaultExpiration: 7 * 24 * 60 * 60 * 1000,
    nodeTypes: ["lab"],
    icon: "TestTube",
  },
  {
    templateId: "medications",
    name: "Medication List",
    description: "Current and past medications",
    packageType: "medications_only",
    defaultPermissions: {
      canDownload: true,
      canPrint: true,
      canForward: false,
      requiresVerification: false,
      notifyOnAccess: false,
    },
    defaultExpiration: 7 * 24 * 60 * 60 * 1000,
    nodeTypes: ["medication"],
    icon: "Pill",
  },
  {
    templateId: "caregiver",
    name: "Caregiver Access",
    description: "Ongoing access for family caregiver",
    packageType: "full_record",
    defaultPermissions: {
      canDownload: false,
      canPrint: true,
      canForward: false,
      requiresVerification: true,
      notifyOnAccess: false,
    },
    defaultExpiration: 365 * 24 * 60 * 60 * 1000,
    nodeTypes: ["condition", "medication", "lab", "vital", "imaging", "procedure", "specialist"],
    icon: "Heart",
  },
];

class OneTapShareService {
  private packages: Map<string, SharePackage> = new Map();

  getShareTemplates(): ShareTemplate[] {
    return SHARE_TEMPLATES;
  }

  async createSharePackage(
    patientId: string,
    templateId: string,
    options: {
      recipientDetails?: RecipientDetails;
      customNodeIds?: string[];
      customEpisodeIds?: string[];
      dateRange?: { start: string; end: string };
      expirationHours?: number;
      customPermissions?: Partial<SharePermissions>;
      title?: string;
    } = {}
  ): Promise<SharePackage> {
    const template = SHARE_TEMPLATES.find(t => t.templateId === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) {
      throw new Error("Patient health graph not found");
    }

    // Determine which nodes to include
    let nodeIds: string[] = [];
    if (options.customNodeIds?.length) {
      nodeIds = options.customNodeIds;
    } else {
      nodeIds = graph.nodes
        .filter(n => template.nodeTypes.includes(n.nodeType))
        .map(n => n.id);
    }

    // Filter by date range if specified
    if (options.dateRange) {
      const nodes = graph.nodes.filter(n => 
        nodeIds.includes(n.id) &&
        (!n.startDate || (n.startDate >= options.dateRange!.start && n.startDate <= options.dateRange!.end))
      );
      nodeIds = nodes.map(n => n.id);
    }

    // Determine episodes
    let episodeIds: string[] = [];
    if (options.customEpisodeIds?.length) {
      episodeIds = options.customEpisodeIds;
    } else if (template.nodeTypes.includes("episode")) {
      episodeIds = graph.episodes.map(e => e.id);
    }

    // Generate secure access token
    const accessToken = this.generateSecureToken();
    const packageId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    // Calculate expiration
    const expirationMs = options.expirationHours 
      ? options.expirationHours * 60 * 60 * 1000 
      : template.defaultExpiration;
    const expiresAt = new Date(Date.now() + expirationMs).toISOString();

    // Generate FHIR Bundle
    const fhirBundle = await this.generateFHIRBundle(patientId, nodeIds, graph.nodes);

    // Create QR code data (URL-safe)
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.replit.app`
      : "https://tabula-medica.replit.app";
    const accessUrl = `${baseUrl}/share/${packageId}?token=${accessToken}`;
    const qrCodeData = accessUrl;

    const sharePackage: SharePackage = {
      packageId,
      patientId,
      packageType: template.packageType,
      title: options.title || template.name,
      description: template.description,
      recipientType: this.inferRecipientType(template.templateId),
      recipientDetails: options.recipientDetails,
      accessToken,
      accessUrl,
      qrCodeData,
      createdAt: new Date().toISOString(),
      expiresAt,
      accessCount: 0,
      maxAccesses: template.templateId === "emergency" ? 10 : 5,
      status: "active",
      contents: {
        nodeIds,
        episodeIds,
        includeNarrative: template.nodeTypes.includes("episode"),
        includeTimeline: true,
        dateRange: options.dateRange,
        fhirBundle,
      },
      accessLog: [],
      permissions: {
        ...template.defaultPermissions,
        ...options.customPermissions,
      },
    };

    this.packages.set(packageId, sharePackage);

    logger.info({ component: "OneTapShare", op: "create_package", packageId, templateId, nodeCount: nodeIds.length }, "package created");
    logger.info({ component: "OneTapShare", audit: "HIPAA", action: "create_share_package", patientId, packageId, packageType: template.packageType }, "share package created");

    return sharePackage;
  }

  private generateSecureToken(): string {
    // Use cryptographically secure random bytes
    return crypto.randomBytes(32).toString("base64url");
  }

  private inferRecipientType(templateId: string): SharePackage["recipientType"] {
    const mapping: Record<string, SharePackage["recipientType"]> = {
      specialist_referral: "specialist",
      second_opinion: "second_opinion",
      emergency: "hospital",
      international: "international",
      clinical_trial: "clinical_trial",
      labs_only: "specialist",
      medications: "specialist",
      caregiver: "caregiver",
    };
    return mapping[templateId] || "specialist";
  }

  private async generateFHIRBundle(patientId: string, nodeIds: string[], allNodes: HealthNode[]): Promise<any> {
    const selectedNodes = allNodes.filter(n => nodeIds.includes(n.id));

    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [],
    };

    // Add Patient resource
    bundle.entry.push({
      fullUrl: `urn:uuid:patient-${patientId}`,
      resource: {
        resourceType: "Patient",
        id: patientId,
        meta: { lastUpdated: new Date().toISOString() },
      },
    });

    // Convert nodes to FHIR resources
    for (const node of selectedNodes) {
      const fhirResource = this.nodeToFHIRResource(node, patientId);
      if (fhirResource) {
        bundle.entry.push({
          fullUrl: `urn:uuid:${node.id}`,
          resource: fhirResource,
        });
      }
    }

    return bundle;
  }

  private nodeToFHIRResource(node: HealthNode, patientId: string): any | null {
    const base = {
      id: node.id,
      meta: { lastUpdated: new Date().toISOString(), source: node.source },
      subject: { reference: `Patient/${patientId}` },
    };

    switch (node.nodeType) {
      case "condition":
        return {
          resourceType: "Condition",
          ...base,
          clinicalStatus: { coding: [{ code: node.status }] },
          code: {
            coding: [{
              system: node.codeSystem === "ICD-10" ? "http://hl7.org/fhir/sid/icd-10" : "http://snomed.info/sct",
              code: node.code,
              display: node.label,
            }],
          },
          onsetDateTime: node.startDate,
        };

      case "medication":
        return {
          resourceType: "MedicationRequest",
          ...base,
          status: node.status === "active" ? "active" : "stopped",
          medicationCodeableConcept: {
            coding: [{
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: node.code,
              display: node.label,
            }],
          },
          authoredOn: node.startDate,
          dosageInstruction: node.metadata?.dosage ? [{
            text: `${node.metadata.dosage} ${node.metadata.frequency || ''}`,
          }] : undefined,
        };

      case "lab":
        return {
          resourceType: "Observation",
          ...base,
          status: "final",
          category: [{ coding: [{ code: "laboratory" }] }],
          code: {
            coding: [{
              system: "http://loinc.org",
              code: node.code,
              display: node.label,
            }],
          },
          effectiveDateTime: node.startDate,
          valueQuantity: node.metadata?.value ? {
            value: node.metadata.value,
            unit: node.metadata.unit,
          } : undefined,
        };

      case "imaging":
        return {
          resourceType: "DiagnosticReport",
          ...base,
          status: "final",
          category: [{ coding: [{ code: "imaging" }] }],
          code: {
            coding: [{
              system: "http://www.ama-assn.org/go/cpt",
              code: node.code,
              display: node.label,
            }],
          },
          effectiveDateTime: node.startDate,
          conclusion: node.metadata?.findings,
        };

      case "procedure":
        return {
          resourceType: "Procedure",
          ...base,
          status: "completed",
          code: {
            coding: [{
              system: "http://www.ama-assn.org/go/cpt",
              code: node.code,
              display: node.label,
            }],
          },
          performedDateTime: node.startDate,
        };

      default:
        return null;
    }
  }

  async accessSharePackage(
    packageId: string,
    accessToken: string,
    accessorInfo: { name: string; ipAddress?: string }
  ): Promise<{ package: SharePackage; nodes: HealthNode[] } | null> {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      logger.info({ component: "OneTapShare", op: "access_package", packageId }, "package not found");
      return null;
    }

    // Verify token
    if (pkg.accessToken !== accessToken) {
      logger.info({ component: "OneTapShare", op: "access_package", packageId }, "invalid token for package");
      logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_access_denied", packageId, reason: "invalid_token" }, "share access denied");
      return null;
    }

    // Check expiration
    if (new Date(pkg.expiresAt) < new Date()) {
      pkg.status = "expired";
      logger.info({ component: "OneTapShare", op: "access_package", packageId }, "package expired");
      logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_access_denied", packageId, reason: "expired" }, "share access denied");
      return null;
    }

    // Check access count
    if (pkg.accessCount >= pkg.maxAccesses) {
      logger.info({ component: "OneTapShare", op: "access_package", packageId }, "max accesses reached");
      logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_access_denied", packageId, reason: "max_accesses_reached" }, "share access denied");
      return null;
    }

    // Check if revoked
    if (pkg.status === "revoked") {
      logger.info({ component: "OneTapShare", op: "access_package", packageId }, "package revoked");
      logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_access_denied", packageId, reason: "revoked" }, "share access denied");
      return null;
    }

    // Log access
    pkg.accessLog.push({
      timestamp: new Date().toISOString(),
      accessedBy: accessorInfo.name,
      ipAddress: accessorInfo.ipAddress,
      action: "viewed",
      details: "Share package accessed",
    });
    pkg.accessCount++;
    pkg.status = "accessed";

    // Get the actual nodes
    const graph = await healthGraphService.getGraph(pkg.patientId);
    const nodes = graph?.nodes.filter(n => pkg.contents.nodeIds.includes(n.id)) || [];

    logger.info({ component: "OneTapShare", op: "access_package", packageId, accessorName: accessorInfo.name }, "package accessed");
    logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_accessed", packageId, accessorName: accessorInfo.name, ipAddress: accessorInfo.ipAddress }, "share accessed");

    return { package: pkg, nodes };
  }

  async revokeSharePackage(patientId: string, packageId: string): Promise<boolean> {
    const pkg = this.packages.get(packageId);
    
    if (!pkg || pkg.patientId !== patientId) {
      return false;
    }

    pkg.status = "revoked";
    
    logger.info({ component: "OneTapShare", op: "revoke_package", packageId }, "package revoked");
    logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_revoked", patientId, packageId }, "share revoked");

    return true;
  }

  async getPatientPackages(patientId: string): Promise<SharePackage[]> {
    const packages = Array.from(this.packages.values())
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logger.info({ component: "OneTapShare", audit: "HIPAA", action: "list_share_packages", patientId, count: packages.length }, "share packages listed");
    return packages;
  }

  async downloadPackage(
    packageId: string,
    accessToken: string,
    accessorInfo: { name: string; ipAddress?: string },
    format: "fhir" | "pdf" | "ccd"
  ): Promise<{ data: any; contentType: string; filename: string } | null> {
    const pkg = this.packages.get(packageId);
    
    if (!pkg || pkg.accessToken !== accessToken) {
      return null;
    }

    if (!pkg.permissions.canDownload) {
      logger.info({ component: "OneTapShare", audit: "HIPAA", action: "download_denied", packageId, reason: "downloads_not_permitted" }, "download denied");
      return null;
    }

    // Log download
    pkg.accessLog.push({
      timestamp: new Date().toISOString(),
      accessedBy: accessorInfo.name,
      ipAddress: accessorInfo.ipAddress,
      action: "downloaded",
      details: `Downloaded in ${format} format`,
    });

    logger.info({ component: "OneTapShare", audit: "HIPAA", action: "share_downloaded", packageId, format, accessorName: accessorInfo.name }, "share downloaded");

    switch (format) {
      case "fhir":
        return {
          data: pkg.contents.fhirBundle,
          contentType: "application/fhir+json",
          filename: `health-records-${packageId}.json`,
        };
      case "ccd":
        return {
          data: this.generateCCDA(pkg),
          contentType: "application/xml",
          filename: `health-records-${packageId}.xml`,
        };
      default:
        return {
          data: pkg.contents.fhirBundle,
          contentType: "application/fhir+json",
          filename: `health-records-${packageId}.json`,
        };
    }
  }

  private generateCCDA(pkg: SharePackage): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <typeId extension="POCD_HD000040" root="2.16.840.1.113883.1.3"/>
  <id root="${pkg.packageId}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Summarization of episode note"/>
  <title>${pkg.title}</title>
  <effectiveTime value="${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
  <recordTarget>
    <patientRole>
      <id root="${pkg.patientId}"/>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section>
          <title>Health Records Export</title>
          <text>This document contains ${pkg.contents.nodeIds.length} health records.</text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
  }

  getPackageById(packageId: string): SharePackage | undefined {
    return this.packages.get(packageId);
  }
}

export const oneTapShareService = new OneTapShareService();
