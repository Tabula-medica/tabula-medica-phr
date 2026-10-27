// @ts-nocheck
import { createHash, randomBytes } from "crypto";

interface DataPermission {
  id: string;
  patientId: string;
  granteeId: string;
  granteeType: "researcher" | "pharma" | "caregiver" | "provider" | "institution" | "app" | "clinical_trial";
  granteeName: string;
  granteeOrganization?: string;
  purpose: PermissionPurpose;
  scope: PermissionScope;
  dataAccess: DataAccessRights;
  compensation?: CompensationTerms;
  status: "pending" | "active" | "paused" | "expired" | "revoked";
  consent: ConsentRecord;
  createdAt: Date;
  expiresAt?: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  auditLog: PermissionAuditEntry[];
}

interface PermissionPurpose {
  primary: "research" | "clinical_trial" | "care_coordination" | "second_opinion" | "personal_use" | "commercial";
  description: string;
  irbApproved?: boolean;
  irbNumber?: string;
  clinicalTrialId?: string;
  expectedOutcome?: string;
  dataRetentionPolicy?: string;
}

interface PermissionScope {
  dataCategories: DataCategory[];
  excludedCategories?: DataCategory[];
  specificConditions?: string[];
  dateRange?: { start: Date; end: Date };
  geographicRestrictions?: string[];
  useRestrictions: UseRestriction[];
}

type DataCategory = 
  | "demographics" | "conditions" | "medications" | "allergies" | "immunizations"
  | "labs" | "vitals" | "procedures" | "imaging" | "genomics"
  | "mental_health" | "reproductive" | "substance_use" | "social_history"
  | "claims" | "costs" | "insurance" | "wearables" | "all";

type UseRestriction = 
  | "no_commercial_use" | "no_resale" | "no_marketing" | "no_third_party_sharing"
  | "aggregate_only" | "de_identified_only" | "no_ai_training" | "publication_requires_approval";

interface DataAccessRights {
  canView: boolean;
  canDownload: boolean;
  canExport: boolean;
  canQuery: boolean;
  canAggregate: boolean;
  canReIdentify: boolean;
  apiAccess: boolean;
  realTimeUpdates: boolean;
  historicalAccess: boolean;
  futureDataIncluded: boolean;
}

interface CompensationTerms {
  type: "none" | "one_time" | "recurring" | "per_access" | "revenue_share";
  amount?: number;
  currency?: string;
  frequency?: "monthly" | "quarterly" | "annually" | "per_use";
  paymentMethod?: string;
  paymentStatus: "pending" | "paid" | "failed";
  totalEarned: number;
  lastPaymentDate?: Date;
}

interface ConsentRecord {
  consentId: string;
  version: string;
  signedAt: Date;
  method: "electronic" | "written" | "verbal_recorded";
  ipAddress?: string;
  deviceInfo?: string;
  witnessInfo?: string;
  consentDocumentUrl?: string;
  hipaaAuthorizationIncluded: boolean;
  rightToRevokeAcknowledged: boolean;
  dataUseExplained: boolean;
  compensationDisclosed: boolean;
  renewalRequired?: boolean;
  renewalDate?: Date;
}

interface PermissionAuditEntry {
  id: string;
  timestamp: Date;
  action: "created" | "accessed" | "modified" | "paused" | "resumed" | "revoked" | "expired" | "renewed";
  actor: string;
  actorType: "patient" | "grantee" | "system" | "admin";
  details: string;
  ipAddress?: string;
}

interface DataMarketplaceListing {
  id: string;
  patientId: string;
  title: string;
  description: string;
  dataCategories: DataCategory[];
  anonymizationLevel: "fully_identified" | "limited_dataset" | "de_identified" | "aggregated";
  availability: "immediate" | "on_request" | "scheduled";
  pricing: {
    type: "free" | "fixed" | "negotiable" | "auction";
    basePrice?: number;
    currency?: string;
  };
  eligibleBuyerTypes: DataPermission["granteeType"][];
  requirements: string[];
  status: "draft" | "active" | "paused" | "sold" | "expired";
  createdAt: Date;
  expiresAt?: Date;
  viewCount: number;
  inquiryCount: number;
}

interface DataBrokerTransaction {
  id: string;
  listingId?: string;
  permissionId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "disputed" | "refunded";
  transactionDate: Date;
  paymentId?: string;
}

interface ResearchOpportunity {
  id: string;
  title: string;
  organization: string;
  description: string;
  purpose: string;
  dataRequirements: DataCategory[];
  eligibilityCriteria: EligibilityCriterion[];
  compensation: {
    type: string;
    amount?: number;
    description: string;
  };
  duration: string;
  irbApproved: boolean;
  irbNumber?: string;
  participantCount: number;
  targetParticipants: number;
  status: "recruiting" | "full" | "closed";
  startDate: Date;
  endDate?: Date;
}

interface EligibilityCriterion {
  type: "condition" | "age" | "medication" | "lab_value" | "gender" | "location";
  description: string;
  value?: string;
  operator?: "equals" | "contains" | "greater_than" | "less_than" | "between";
}

interface PatientDataWallet {
  patientId: string;
  totalEarnings: number;
  pendingEarnings: number;
  currency: string;
  activePermissions: number;
  pausedPermissions: number;
  revokedPermissions: number;
  dataValuation: DataValuation;
  transactions: DataBrokerTransaction[];
}

interface DataValuation {
  estimatedTotalValue: number;
  valueByCategory: Record<DataCategory, number>;
  rareConditionBonus?: number;
  longitudinalBonus?: number;
  completenessScore: number;
  lastUpdated: Date;
}

const SAMPLE_RESEARCH_OPPORTUNITIES: ResearchOpportunity[] = [
  {
    id: "research_diabetes_2024",
    title: "Diabetes Management Outcomes Study",
    organization: "National Institutes of Health",
    description: "Large-scale study examining real-world diabetes management patterns and outcomes",
    purpose: "Improve treatment guidelines for Type 2 diabetes",
    dataRequirements: ["conditions", "medications", "labs", "vitals"],
    eligibilityCriteria: [
      { type: "condition", description: "Type 2 Diabetes diagnosis", value: "E11" },
      { type: "age", description: "18 years or older", operator: "greater_than", value: "18" }
    ],
    compensation: { type: "one_time", amount: 50, description: "$50 for data contribution" },
    duration: "12 months",
    irbApproved: true,
    irbNumber: "NIH-2024-DM-001",
    participantCount: 4521,
    targetParticipants: 10000,
    status: "recruiting",
    startDate: new Date("2024-01-01")
  },
  {
    id: "research_cardio_ai",
    title: "AI Cardiac Risk Prediction Model Development",
    organization: "Stanford Medicine",
    description: "Training AI models to predict cardiovascular events using longitudinal health data",
    purpose: "Develop early warning systems for heart disease",
    dataRequirements: ["conditions", "medications", "labs", "vitals", "imaging", "procedures"],
    eligibilityCriteria: [
      { type: "condition", description: "Any cardiovascular condition", value: "I*" },
      { type: "age", description: "40 years or older", operator: "greater_than", value: "40" }
    ],
    compensation: { type: "revenue_share", description: "0.1% of any commercial licensing revenue" },
    duration: "24 months",
    irbApproved: true,
    irbNumber: "STANFORD-CV-2024-042",
    participantCount: 892,
    targetParticipants: 5000,
    status: "recruiting",
    startDate: new Date("2024-03-01")
  },
  {
    id: "trial_oncology_biomarker",
    title: "Biomarker Discovery for Cancer Treatment Response",
    organization: "Memorial Sloan Kettering Cancer Center",
    description: "Identifying biomarkers that predict treatment response in various cancers",
    purpose: "Personalized medicine for cancer treatment selection",
    dataRequirements: ["conditions", "medications", "labs", "genomics", "procedures", "imaging"],
    eligibilityCriteria: [
      { type: "condition", description: "Any cancer diagnosis", value: "C*" }
    ],
    compensation: { type: "recurring", amount: 25, description: "$25/month during active participation" },
    duration: "36 months",
    irbApproved: true,
    irbNumber: "MSK-ONC-2024-BM",
    participantCount: 2103,
    targetParticipants: 8000,
    status: "recruiting",
    startDate: new Date("2024-02-15")
  }
];

class PatientDataPermissionsService {
  private permissions: Map<string, DataPermission> = new Map();
  private listings: Map<string, DataMarketplaceListing> = new Map();
  private transactions: Map<string, DataBrokerTransaction> = new Map();
  private wallets: Map<string, PatientDataWallet> = new Map();

  async grantPermission(
    patientId: string,
    grantee: {
      id: string;
      type: DataPermission["granteeType"];
      name: string;
      organization?: string;
    },
    purpose: PermissionPurpose,
    scope: PermissionScope,
    dataAccess: Partial<DataAccessRights>,
    compensation?: Partial<CompensationTerms>,
    durationDays?: number
  ): Promise<DataPermission> {
    const id = `perm_${Date.now()}_${randomBytes(8).toString("hex")}`;
    
    const permission: DataPermission = {
      id,
      patientId,
      granteeId: grantee.id,
      granteeType: grantee.type,
      granteeName: grantee.name,
      granteeOrganization: grantee.organization,
      purpose,
      scope,
      dataAccess: {
        canView: dataAccess.canView ?? true,
        canDownload: dataAccess.canDownload ?? false,
        canExport: dataAccess.canExport ?? false,
        canQuery: dataAccess.canQuery ?? true,
        canAggregate: dataAccess.canAggregate ?? true,
        canReIdentify: dataAccess.canReIdentify ?? false,
        apiAccess: dataAccess.apiAccess ?? false,
        realTimeUpdates: dataAccess.realTimeUpdates ?? false,
        historicalAccess: dataAccess.historicalAccess ?? true,
        futureDataIncluded: dataAccess.futureDataIncluded ?? false
      },
      compensation: compensation ? {
        type: compensation.type || "none",
        amount: compensation.amount,
        currency: compensation.currency || "USD",
        frequency: compensation.frequency,
        paymentMethod: compensation.paymentMethod,
        paymentStatus: "pending",
        totalEarned: 0
      } : undefined,
      status: "active",
      consent: {
        consentId: `consent_${Date.now()}`,
        version: "1.0",
        signedAt: new Date(),
        method: "electronic",
        hipaaAuthorizationIncluded: true,
        rightToRevokeAcknowledged: true,
        dataUseExplained: true,
        compensationDisclosed: !!compensation
      },
      createdAt: new Date(),
      expiresAt: durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : undefined,
      accessCount: 0,
      auditLog: [{
        id: `audit_${Date.now()}`,
        timestamp: new Date(),
        action: "created",
        actor: patientId,
        actorType: "patient",
        details: `Permission granted to ${grantee.name} for ${purpose.primary}`
      }]
    };

    this.permissions.set(id, permission);
    this.updateWallet(patientId);

    return permission;
  }

  async revokePermission(permissionId: string, reason?: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    if (!permission) return false;

    permission.status = "revoked";
    permission.auditLog.push({
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      action: "revoked",
      actor: permission.patientId,
      actorType: "patient",
      details: reason || "Revoked by patient"
    });

    this.updateWallet(permission.patientId);
    return true;
  }

  async pausePermission(permissionId: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    if (!permission || permission.status !== "active") return false;

    permission.status = "paused";
    permission.auditLog.push({
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      action: "paused",
      actor: permission.patientId,
      actorType: "patient",
      details: "Permission paused by patient"
    });

    this.updateWallet(permission.patientId);
    return true;
  }

  async resumePermission(permissionId: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    if (!permission || permission.status !== "paused") return false;

    permission.status = "active";
    permission.auditLog.push({
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      action: "resumed",
      actor: permission.patientId,
      actorType: "patient",
      details: "Permission resumed by patient"
    });

    this.updateWallet(permission.patientId);
    return true;
  }

  async recordAccess(permissionId: string, accessorInfo: { ipAddress?: string }): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    if (!permission || permission.status !== "active") return false;

    if (permission.expiresAt && new Date() > permission.expiresAt) {
      permission.status = "expired";
      return false;
    }

    permission.accessCount++;
    permission.lastAccessedAt = new Date();
    permission.auditLog.push({
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      action: "accessed",
      actor: permission.granteeId,
      actorType: "grantee",
      details: `Data accessed by ${permission.granteeName}`,
      ipAddress: accessorInfo.ipAddress
    });

    if (permission.compensation?.type === "per_access" && permission.compensation.amount) {
      permission.compensation.totalEarned += permission.compensation.amount;
      this.updateWallet(permission.patientId);
    }

    return true;
  }

  getPatientPermissions(patientId: string, status?: DataPermission["status"][]): DataPermission[] {
    return Array.from(this.permissions.values())
      .filter(p => p.patientId === patientId)
      .filter(p => !status || status.includes(p.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPermission(permissionId: string): DataPermission | null {
    return this.permissions.get(permissionId) || null;
  }

  getResearchOpportunities(patientId: string, healthRecords: any[]): ResearchOpportunity[] {
    return SAMPLE_RESEARCH_OPPORTUNITIES.filter(opp => {
      if (opp.status !== "recruiting") return false;

      for (const criterion of opp.eligibilityCriteria) {
        if (criterion.type === "condition") {
          const hasCondition = healthRecords.some(r => 
            r.type === "condition" && 
            r.details?.code?.startsWith(criterion.value?.replace("*", "") || "")
          );
          if (!hasCondition) return false;
        }
      }

      return true;
    });
  }

  async enrollInResearch(
    patientId: string,
    opportunityId: string,
    healthRecords: any[]
  ): Promise<DataPermission | null> {
    const opportunity = SAMPLE_RESEARCH_OPPORTUNITIES.find(o => o.id === opportunityId);
    if (!opportunity || opportunity.status !== "recruiting") return null;

    const permission = await this.grantPermission(
      patientId,
      {
        id: opportunityId,
        type: "researcher",
        name: opportunity.organization,
        organization: opportunity.organization
      },
      {
        primary: opportunity.id.startsWith("trial_") ? "clinical_trial" : "research",
        description: opportunity.description,
        irbApproved: opportunity.irbApproved,
        irbNumber: opportunity.irbNumber,
        expectedOutcome: opportunity.purpose
      },
      {
        dataCategories: opportunity.dataRequirements,
        useRestrictions: ["no_commercial_use", "no_third_party_sharing", "publication_requires_approval"]
      },
      {
        canView: true,
        canDownload: true,
        canAggregate: true,
        apiAccess: true,
        futureDataIncluded: true
      },
      opportunity.compensation.type !== "none" ? {
        type: opportunity.compensation.type as any,
        amount: opportunity.compensation.amount,
        currency: "USD"
      } : undefined,
      opportunity.duration.includes("month") ? parseInt(opportunity.duration) * 30 : 365
    );

    return permission;
  }

  async createMarketplaceListing(
    patientId: string,
    listing: Omit<DataMarketplaceListing, "id" | "patientId" | "createdAt" | "viewCount" | "inquiryCount" | "status">
  ): Promise<DataMarketplaceListing> {
    const id = `listing_${Date.now()}_${randomBytes(8).toString("hex")}`;
    
    const newListing: DataMarketplaceListing = {
      id,
      patientId,
      ...listing,
      status: "active",
      createdAt: new Date(),
      viewCount: 0,
      inquiryCount: 0
    };

    this.listings.set(id, newListing);
    return newListing;
  }

  getMarketplaceListings(
    filters?: {
      categories?: DataCategory[];
      buyerType?: DataPermission["granteeType"];
      maxPrice?: number;
    }
  ): DataMarketplaceListing[] {
    let listings = Array.from(this.listings.values()).filter(l => l.status === "active");

    if (filters?.categories?.length) {
      listings = listings.filter(l => 
        filters.categories!.some(cat => l.dataCategories.includes(cat))
      );
    }

    if (filters?.buyerType) {
      listings = listings.filter(l => 
        l.eligibleBuyerTypes.includes(filters.buyerType!)
      );
    }

    if (filters?.maxPrice !== undefined) {
      listings = listings.filter(l => 
        l.pricing.type === "free" || 
        (l.pricing.basePrice && l.pricing.basePrice <= filters.maxPrice!)
      );
    }

    return listings;
  }

  getPatientWallet(patientId: string): PatientDataWallet {
    let wallet = this.wallets.get(patientId);
    
    if (!wallet) {
      wallet = {
        patientId,
        totalEarnings: 0,
        pendingEarnings: 0,
        currency: "USD",
        activePermissions: 0,
        pausedPermissions: 0,
        revokedPermissions: 0,
        dataValuation: this.calculateDataValuation(patientId, []),
        transactions: []
      };
      this.wallets.set(patientId, wallet);
    }

    return wallet;
  }

  private updateWallet(patientId: string): void {
    const permissions = this.getPatientPermissions(patientId);
    const wallet = this.getPatientWallet(patientId);

    wallet.activePermissions = permissions.filter(p => p.status === "active").length;
    wallet.pausedPermissions = permissions.filter(p => p.status === "paused").length;
    wallet.revokedPermissions = permissions.filter(p => p.status === "revoked").length;

    wallet.totalEarnings = permissions
      .filter(p => p.compensation)
      .reduce((sum, p) => sum + (p.compensation?.totalEarned || 0), 0);

    this.wallets.set(patientId, wallet);
  }

  calculateDataValuation(patientId: string, healthRecords: any[]): DataValuation {
    const baseValues: Record<DataCategory, number> = {
      demographics: 5,
      conditions: 25,
      medications: 20,
      allergies: 10,
      immunizations: 15,
      labs: 30,
      vitals: 15,
      procedures: 35,
      imaging: 50,
      genomics: 200,
      mental_health: 40,
      reproductive: 30,
      substance_use: 35,
      social_history: 20,
      claims: 45,
      costs: 40,
      insurance: 25,
      wearables: 20,
      all: 0
    };

    const valueByCategory: Record<DataCategory, number> = {} as any;
    let estimatedTotalValue = 0;

    const recordTypes = new Set(healthRecords.map(r => r.type));
    
    for (const [category, baseValue] of Object.entries(baseValues)) {
      if (category === "all") continue;
      
      const hasData = this.categoryHasData(category as DataCategory, recordTypes, healthRecords);
      const value = hasData ? baseValue : 0;
      valueByCategory[category as DataCategory] = value;
      estimatedTotalValue += value;
    }

    let rareConditionBonus = 0;
    const rareConditions = healthRecords.filter(r => 
      r.type === "condition" && 
      (r.details?.rare || r.details?.prevalence === "rare")
    );
    if (rareConditions.length > 0) {
      rareConditionBonus = rareConditions.length * 100;
      estimatedTotalValue += rareConditionBonus;
    }

    let longitudinalBonus = 0;
    if (healthRecords.length > 0) {
      const dates = healthRecords.map(r => new Date(r.date).getTime()).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const years = (Math.max(...dates) - Math.min(...dates)) / (365 * 24 * 60 * 60 * 1000);
        if (years > 5) {
          longitudinalBonus = years * 10;
          estimatedTotalValue += longitudinalBonus;
        }
      }
    }

    const totalCategories = Object.keys(baseValues).length - 1;
    const filledCategories = Object.values(valueByCategory).filter(v => v > 0).length;
    const completenessScore = (filledCategories / totalCategories) * 100;

    return {
      estimatedTotalValue: Math.round(estimatedTotalValue),
      valueByCategory,
      rareConditionBonus: rareConditionBonus > 0 ? rareConditionBonus : undefined,
      longitudinalBonus: longitudinalBonus > 0 ? longitudinalBonus : undefined,
      completenessScore: Math.round(completenessScore),
      lastUpdated: new Date()
    };
  }

  private categoryHasData(category: DataCategory, recordTypes: Set<string>, records: any[]): boolean {
    const categoryMapping: Record<DataCategory, string[]> = {
      demographics: ["demographics"],
      conditions: ["condition", "diagnosis"],
      medications: ["medication"],
      allergies: ["allergy"],
      immunizations: ["immunization"],
      labs: ["lab"],
      vitals: ["vital"],
      procedures: ["procedure"],
      imaging: ["imaging"],
      genomics: ["genomic", "genetic"],
      mental_health: ["mental_health"],
      reproductive: ["reproductive"],
      substance_use: ["substance_use"],
      social_history: ["social"],
      claims: ["claim"],
      costs: ["cost"],
      insurance: ["insurance", "coverage"],
      wearables: ["wearable", "device"],
      all: []
    };

    const types = categoryMapping[category] || [];
    return types.some(t => recordTypes.has(t));
  }

  getCaregiverPermissions(caregiverId: string): DataPermission[] {
    return Array.from(this.permissions.values())
      .filter(p => p.granteeId === caregiverId && p.granteeType === "caregiver")
      .filter(p => p.status === "active");
  }

  async grantCaregiverAccess(
    patientId: string,
    caregiver: {
      id: string;
      name: string;
      email: string;
      relationship: string;
    },
    accessLevel: "full" | "limited" | "emergency_only",
    durationDays?: number
  ): Promise<DataPermission> {
    const accessLevelConfig: Record<string, { categories: DataCategory[]; rights: Partial<DataAccessRights> }> = {
      full: {
        categories: ["all"],
        rights: { canView: true, canDownload: true, canExport: true, realTimeUpdates: true, futureDataIncluded: true }
      },
      limited: {
        categories: ["conditions", "medications", "allergies", "care_plans"],
        rights: { canView: true, canDownload: false, realTimeUpdates: true, futureDataIncluded: true }
      },
      emergency_only: {
        categories: ["conditions", "medications", "allergies"],
        rights: { canView: true, canDownload: false }
      }
    };

    const config = accessLevelConfig[accessLevel];

    return this.grantPermission(
      patientId,
      {
        id: caregiver.id,
        type: "caregiver",
        name: caregiver.name
      },
      {
        primary: "care_coordination",
        description: `Caregiver access for ${caregiver.relationship}`
      },
      {
        dataCategories: config.categories,
        useRestrictions: ["no_commercial_use", "no_third_party_sharing"]
      },
      config.rights,
      undefined,
      durationDays || 365
    );
  }

  getPermissionSummary(patientId: string): {
    total: number;
    byType: Record<DataPermission["granteeType"], number>;
    byStatus: Record<DataPermission["status"], number>;
    totalAccesses: number;
    recentActivity: PermissionAuditEntry[];
  } {
    const permissions = this.getPatientPermissions(patientId);
    
    const byType: Record<DataPermission["granteeType"], number> = {
      researcher: 0,
      pharma: 0,
      caregiver: 0,
      provider: 0,
      institution: 0,
      app: 0,
      clinical_trial: 0
    };

    const byStatus: Record<DataPermission["status"], number> = {
      pending: 0,
      active: 0,
      paused: 0,
      expired: 0,
      revoked: 0
    };

    let totalAccesses = 0;
    const allAuditEntries: PermissionAuditEntry[] = [];

    for (const perm of permissions) {
      byType[perm.granteeType]++;
      byStatus[perm.status]++;
      totalAccesses += perm.accessCount;
      allAuditEntries.push(...perm.auditLog);
    }

    const recentActivity = allAuditEntries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      total: permissions.length,
      byType,
      byStatus,
      totalAccesses,
      recentActivity
    };
  }
}

export const patientDataPermissionsService = new PatientDataPermissionsService();

export function initializePatientDataPermissions() {
  console.log("Patient data permissions service initialized");
}
