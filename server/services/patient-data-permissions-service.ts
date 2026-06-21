import { logger } from "../lib/logger";

export interface DataPermission {
  permissionId: string;
  patientId: string;
  permissionType: PermissionType;
  granteeType: GranteeType;
  granteeId: string;
  granteeName: string;
  granteeOrganization?: string;
  scope: PermissionScope;
  status: "active" | "pending" | "suspended" | "revoked" | "expired";
  grantedAt: string;
  expiresAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
  conditions: PermissionCondition[];
  auditLog: PermissionAuditEntry[];
}

export type PermissionType = 
  | "research_access"
  | "clinical_trial"
  | "caregiver_view"
  | "caregiver_manage"
  | "second_opinion"
  | "insurance_claim"
  | "pharmacy_access"
  | "employer_wellness"
  | "app_integration";

export type GranteeType = 
  | "researcher"
  | "pharma_company"
  | "clinical_trial_sponsor"
  | "family_member"
  | "professional_caregiver"
  | "insurance_company"
  | "pharmacy"
  | "employer"
  | "health_app";

export interface PermissionScope {
  dataCategories: DataCategory[];
  dateRange?: { start: string; end: string };
  deIdentified: boolean;
  specificNodeIds?: string[];
  excludedNodeIds?: string[];
  readOnly: boolean;
  allowExport: boolean;
  allowAggregate: boolean;
}

export type DataCategory = 
  | "conditions"
  | "medications"
  | "labs"
  | "vitals"
  | "imaging"
  | "procedures"
  | "allergies"
  | "immunizations"
  | "social_history"
  | "family_history"
  | "mental_health"
  | "substance_use"
  | "sexual_health"
  | "genetic_data";

export interface PermissionCondition {
  conditionType: "time_based" | "purpose_limited" | "notification_required" | "approval_required" | "location_restricted";
  description: string;
  parameters: Record<string, any>;
}

export interface PermissionAuditEntry {
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
  ipAddress?: string;
}

export interface PermissionRequest {
  requestId: string;
  patientId: string;
  requesterType: GranteeType;
  requesterId: string;
  requesterName: string;
  requesterOrganization: string;
  requestedScope: PermissionScope;
  purpose: string;
  justification: string;
  duration: number;
  status: "pending" | "approved" | "denied" | "expired";
  createdAt: string;
  respondedAt?: string;
  responseNote?: string;
}

export interface DataBrokerOpportunity {
  opportunityId: string;
  title: string;
  description: string;
  sponsor: string;
  sponsorType: "research_institution" | "pharma" | "clinical_trial" | "nonprofit";
  compensation?: {
    type: "monetary" | "gift_card" | "donation" | "healthcare_credit";
    amount?: number;
    description: string;
  };
  requiredCategories: DataCategory[];
  deIdentificationLevel: "full" | "limited" | "none";
  duration: string;
  participantCount: number;
  expiresAt: string;
  matchScore?: number;
  matchReason?: string;
}

export interface ConsentRecord {
  consentId: string;
  patientId: string;
  consentType: "general" | "specific" | "research" | "hipaa_authorization";
  version: string;
  grantedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
  scope: PermissionScope;
  signatureMethod: "electronic" | "digital" | "paper";
  documentUrl?: string;
}

const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  conditions: "Medical Conditions",
  medications: "Medications",
  labs: "Laboratory Results",
  vitals: "Vital Signs",
  imaging: "Imaging & Radiology",
  procedures: "Procedures & Surgeries",
  allergies: "Allergies",
  immunizations: "Immunizations",
  social_history: "Social History",
  family_history: "Family History",
  mental_health: "Mental Health",
  substance_use: "Substance Use History",
  sexual_health: "Sexual Health",
  genetic_data: "Genetic Information",
};

const SAMPLE_OPPORTUNITIES: DataBrokerOpportunity[] = [
  {
    opportunityId: "opp_diabetes_study_001",
    title: "National Diabetes Prevention Study",
    description: "Help researchers understand diabetes progression patterns to develop better prevention strategies.",
    sponsor: "National Institutes of Health",
    sponsorType: "research_institution",
    compensation: {
      type: "gift_card",
      amount: 50,
      description: "$50 Amazon gift card for participation",
    },
    requiredCategories: ["conditions", "medications", "labs"],
    deIdentificationLevel: "full",
    duration: "One-time data share",
    participantCount: 15000,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    opportunityId: "opp_kidney_trial_001",
    title: "New Kidney Disease Treatment Trial",
    description: "Screening for eligibility in a clinical trial for a novel CKD treatment.",
    sponsor: "Novartis Pharmaceuticals",
    sponsorType: "pharma",
    compensation: {
      type: "healthcare_credit",
      amount: 200,
      description: "$200 credit toward healthcare expenses if enrolled",
    },
    requiredCategories: ["conditions", "labs", "medications"],
    deIdentificationLevel: "limited",
    duration: "Study duration (12 months)",
    participantCount: 500,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    opportunityId: "opp_heart_research_001",
    title: "Heart Health Registry",
    description: "Contribute to a registry tracking cardiovascular health outcomes nationwide.",
    sponsor: "American Heart Association",
    sponsorType: "nonprofit",
    compensation: {
      type: "donation",
      description: "$25 donated to AHA in your name",
    },
    requiredCategories: ["conditions", "vitals", "labs", "imaging"],
    deIdentificationLevel: "full",
    duration: "Ongoing (annual updates)",
    participantCount: 50000,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

class PatientDataPermissionsService {
  private permissions: Map<string, DataPermission> = new Map();
  private requests: Map<string, PermissionRequest> = new Map();
  private consents: Map<string, ConsentRecord> = new Map();

  async grantPermission(
    patientId: string,
    options: {
      permissionType: PermissionType;
      granteeType: GranteeType;
      granteeId: string;
      granteeName: string;
      granteeOrganization?: string;
      scope: PermissionScope;
      expirationDays?: number;
      conditions?: PermissionCondition[];
    }
  ): Promise<DataPermission> {
    const permissionId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const expiresAt = options.expirationDays 
      ? new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const permission: DataPermission = {
      permissionId,
      patientId,
      permissionType: options.permissionType,
      granteeType: options.granteeType,
      granteeId: options.granteeId,
      granteeName: options.granteeName,
      granteeOrganization: options.granteeOrganization,
      scope: options.scope,
      status: "active",
      grantedAt: new Date().toISOString(),
      expiresAt,
      accessCount: 0,
      conditions: options.conditions || [],
      auditLog: [{
        timestamp: new Date().toISOString(),
        action: "PERMISSION_GRANTED",
        performedBy: patientId,
        details: `Permission granted to ${options.granteeName} for ${options.permissionType}`,
      }],
    };

    this.permissions.set(permissionId, permission);

    logger.info({ component: "DataPermissions", op: "grant", permissionId, permissionType: options.permissionType }, "permission granted");
    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "permission_granted", patientId, granteeName: options.granteeName, permissionType: options.permissionType }, "data permission granted");

    return permission;
  }

  async revokePermission(patientId: string, permissionId: string, reason?: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    
    if (!permission || permission.patientId !== patientId) {
      return false;
    }

    permission.status = "revoked";
    permission.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "PERMISSION_REVOKED",
      performedBy: patientId,
      details: reason || "Permission revoked by patient",
    });

    logger.info({ component: "DataPermissions", op: "revoke", permissionId }, "permission revoked");
    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "permission_revoked", patientId, permissionId }, "data permission revoked");

    return true;
  }

  async suspendPermission(patientId: string, permissionId: string, reason?: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    
    if (!permission || permission.patientId !== patientId) {
      return false;
    }

    permission.status = "suspended";
    permission.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "PERMISSION_SUSPENDED",
      performedBy: patientId,
      details: reason || "Permission suspended by patient",
    });

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "permission_suspended", patientId, permissionId }, "data permission suspended");

    return true;
  }

  async reactivatePermission(patientId: string, permissionId: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    
    if (!permission || permission.patientId !== patientId || permission.status !== "suspended") {
      return false;
    }

    permission.status = "active";
    permission.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "PERMISSION_REACTIVATED",
      performedBy: patientId,
      details: "Permission reactivated by patient",
    });

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "permission_reactivated", patientId, permissionId }, "data permission reactivated");

    return true;
  }

  async getPatientPermissions(patientId: string): Promise<DataPermission[]> {
    const permissions = Array.from(this.permissions.values())
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());

    // Update expired permissions
    const now = new Date();
    permissions.forEach(p => {
      if (p.status === "active" && p.expiresAt && new Date(p.expiresAt) < now) {
        p.status = "expired";
      }
    });

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "list_permissions", patientId, count: permissions.length }, "permissions listed");
    return permissions;
  }

  async getPermissionsByType(patientId: string, permissionType: PermissionType): Promise<DataPermission[]> {
    return (await this.getPatientPermissions(patientId))
      .filter(p => p.permissionType === permissionType);
  }

  async checkAccess(
    granteeId: string,
    patientId: string,
    requestedCategory: DataCategory
  ): Promise<{ allowed: boolean; permission?: DataPermission; reason?: string }> {
    const permissions = await this.getPatientPermissions(patientId);
    
    const matchingPermission = permissions.find(p => 
      p.granteeId === granteeId &&
      p.status === "active" &&
      p.scope.dataCategories.includes(requestedCategory)
    );

    if (!matchingPermission) {
      logger.info({ component: "DataPermissions", audit: "HIPAA", action: "access_denied", granteeId, patientId, requestedCategory }, "access denied");
      return { 
        allowed: false, 
        reason: "No active permission found for this data category" 
      };
    }

    // Check date range
    if (matchingPermission.scope.dateRange) {
      const now = new Date().toISOString().split('T')[0];
      if (now < matchingPermission.scope.dateRange.start || now > matchingPermission.scope.dateRange.end) {
        return { 
          allowed: false, 
          permission: matchingPermission,
          reason: "Access outside permitted date range" 
        };
      }
    }

    // Log access
    matchingPermission.accessCount++;
    matchingPermission.lastAccessedAt = new Date().toISOString();
    matchingPermission.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "DATA_ACCESSED",
      performedBy: granteeId,
      details: `Accessed ${requestedCategory} data`,
    });

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "access_granted", granteeId, patientId, requestedCategory }, "access granted");

    return { allowed: true, permission: matchingPermission };
  }

  async createPermissionRequest(
    request: Omit<PermissionRequest, "requestId" | "status" | "createdAt">
  ): Promise<PermissionRequest> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const permissionRequest: PermissionRequest = {
      ...request,
      requestId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.requests.set(requestId, permissionRequest);

    logger.info({ component: "DataPermissions", op: "create_request", requestId, requesterName: request.requesterName }, "request created");
    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "permission_request_created", patientId: request.patientId, requesterName: request.requesterName }, "permission request created");

    return permissionRequest;
  }

  async respondToRequest(
    patientId: string,
    requestId: string,
    approved: boolean,
    note?: string
  ): Promise<DataPermission | null> {
    const request = this.requests.get(requestId);
    
    if (!request || request.patientId !== patientId || request.status !== "pending") {
      return null;
    }

    request.status = approved ? "approved" : "denied";
    request.respondedAt = new Date().toISOString();
    request.responseNote = note;

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: approved ? "permission_request_approved" : "permission_request_denied", patientId, requestId, approved }, "permission request decision");

    if (approved) {
      return this.grantPermission(patientId, {
        permissionType: this.inferPermissionType(request.requesterType),
        granteeType: request.requesterType,
        granteeId: request.requesterId,
        granteeName: request.requesterName,
        granteeOrganization: request.requesterOrganization,
        scope: request.requestedScope,
        expirationDays: request.duration,
      });
    }

    return null;
  }

  private inferPermissionType(granteeType: GranteeType): PermissionType {
    const mapping: Record<GranteeType, PermissionType> = {
      researcher: "research_access",
      pharma_company: "clinical_trial",
      clinical_trial_sponsor: "clinical_trial",
      family_member: "caregiver_view",
      professional_caregiver: "caregiver_manage",
      insurance_company: "insurance_claim",
      pharmacy: "pharmacy_access",
      employer: "employer_wellness",
      health_app: "app_integration",
    };
    return mapping[granteeType] || "research_access";
  }

  async getPatientRequests(patientId: string): Promise<PermissionRequest[]> {
    return Array.from(this.requests.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDataBrokerOpportunities(patientId: string, patientConditions?: string[]): Promise<DataBrokerOpportunity[]> {
    const opportunities = [...SAMPLE_OPPORTUNITIES];

    // Add match scoring based on patient conditions
    if (patientConditions?.length) {
      opportunities.forEach(opp => {
        let matchScore = 0;
        const matchReasons: string[] = [];

        if (opp.opportunityId.includes("diabetes") && patientConditions.some(c => c.toLowerCase().includes("diabetes"))) {
          matchScore = 0.95;
          matchReasons.push("Your diabetes diagnosis makes you eligible");
        }
        if (opp.opportunityId.includes("kidney") && patientConditions.some(c => c.toLowerCase().includes("kidney") || c.toLowerCase().includes("ckd"))) {
          matchScore = 0.90;
          matchReasons.push("Your kidney condition matches study criteria");
        }
        if (opp.opportunityId.includes("heart") && patientConditions.some(c => c.toLowerCase().includes("hypertension") || c.toLowerCase().includes("heart"))) {
          matchScore = 0.85;
          matchReasons.push("Your cardiovascular history is relevant");
        }

        opp.matchScore = matchScore;
        opp.matchReason = matchReasons.join("; ");
      });
    }

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "list_data_broker_opportunities", patientId }, "data broker opportunities listed");

    return opportunities
      .filter(o => new Date(o.expiresAt) > new Date())
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  async participateInOpportunity(
    patientId: string,
    opportunityId: string,
    consent: {
      agreedToTerms: boolean;
      electronicSignature: string;
    }
  ): Promise<{ permission: DataPermission; consent: ConsentRecord }> {
    const opportunity = SAMPLE_OPPORTUNITIES.find(o => o.opportunityId === opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    if (!consent.agreedToTerms || !consent.electronicSignature) {
      throw new Error("Consent required to participate");
    }

    // Create consent record
    const consentId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const consentRecord: ConsentRecord = {
      consentId,
      patientId,
      consentType: "research",
      version: "1.0",
      grantedAt: new Date().toISOString(),
      scope: {
        dataCategories: opportunity.requiredCategories,
        deIdentified: opportunity.deIdentificationLevel !== "none",
        readOnly: true,
        allowExport: true,
        allowAggregate: true,
      },
      signatureMethod: "electronic",
    };

    this.consents.set(consentId, consentRecord);

    // Create permission
    const permission = await this.grantPermission(patientId, {
      permissionType: "research_access",
      granteeType: opportunity.sponsorType === "pharma" ? "pharma_company" : "researcher",
      granteeId: opportunityId,
      granteeName: opportunity.sponsor,
      scope: {
        dataCategories: opportunity.requiredCategories,
        deIdentified: opportunity.deIdentificationLevel !== "none",
        readOnly: true,
        allowExport: true,
        allowAggregate: true,
      },
      expirationDays: 365,
      conditions: [{
        conditionType: "purpose_limited",
        description: `Data use limited to: ${opportunity.title}`,
        parameters: { studyId: opportunityId },
      }],
    });

    logger.info({ component: "DataPermissions", op: "opportunity_participation", opportunityId, patientId }, "opportunity participation");
    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "research_consent_granted", patientId, studyTitle: opportunity.title }, "research consent granted");

    return { permission, consent: consentRecord };
  }

  getDataCategoryLabels(): Record<DataCategory, string> {
    return DATA_CATEGORY_LABELS;
  }

  async getPatientConsents(patientId: string): Promise<ConsentRecord[]> {
    return Array.from(this.consents.values())
      .filter(c => c.patientId === patientId)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  }

  async withdrawConsent(patientId: string, consentId: string): Promise<boolean> {
    const consent = this.consents.get(consentId);
    
    if (!consent || consent.patientId !== patientId) {
      return false;
    }

    consent.withdrawnAt = new Date().toISOString();

    // Find and revoke associated permissions
    const permissions = await this.getPatientPermissions(patientId);
    for (const perm of permissions) {
      if (perm.auditLog.some(log => log.details.includes(consentId))) {
        await this.revokePermission(patientId, perm.permissionId, "Consent withdrawn");
      }
    }

    logger.info({ component: "DataPermissions", audit: "HIPAA", action: "consent_withdrawn", patientId, consentId }, "consent withdrawn");

    return true;
  }

  async getPermissionSummary(patientId: string): Promise<{
    activePermissions: number;
    pendingRequests: number;
    recentAccesses: number;
    byType: Record<PermissionType, number>;
    byGrantee: Array<{ name: string; type: GranteeType; count: number }>;
  }> {
    const permissions = await this.getPatientPermissions(patientId);
    const requests = await this.getPatientRequests(patientId);

    const activePermissions = permissions.filter(p => p.status === "active").length;
    const pendingRequests = requests.filter(r => r.status === "pending").length;

    // Count accesses in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAccesses = permissions.reduce((sum, p) => {
      const recentLogs = p.auditLog.filter(log => 
        log.action === "DATA_ACCESSED" && 
        new Date(log.timestamp) > thirtyDaysAgo
      );
      return sum + recentLogs.length;
    }, 0);

    const byType: Record<PermissionType, number> = {} as any;
    permissions.filter(p => p.status === "active").forEach(p => {
      byType[p.permissionType] = (byType[p.permissionType] || 0) + 1;
    });

    const granteeMap = new Map<string, { name: string; type: GranteeType; count: number }>();
    permissions.filter(p => p.status === "active").forEach(p => {
      const existing = granteeMap.get(p.granteeId);
      if (existing) {
        existing.count++;
      } else {
        granteeMap.set(p.granteeId, { name: p.granteeName, type: p.granteeType, count: 1 });
      }
    });

    return {
      activePermissions,
      pendingRequests,
      recentAccesses,
      byType,
      byGrantee: Array.from(granteeMap.values()),
    };
  }
}

export const patientDataPermissionsService = new PatientDataPermissionsService();
