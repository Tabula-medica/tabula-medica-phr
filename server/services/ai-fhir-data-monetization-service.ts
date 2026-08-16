import { generatePhiSafeText } from "./ai-gateway";

export interface ResearchDataset {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  recordCount: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  demographics: {
    ageRange: string;
    genderDistribution: Record<string, number>;
    geographicRegions: string[];
  };
  conditions: string[];
  procedures: string[];
  dataQualityScore: number;
  researchValue: DatasetValuation;
  anonymizationStatus: "not_started" | "in_progress" | "completed" | "verified";
  anonymizationLevel: "none" | "de_identified" | "limited_dataset" | "safe_harbor" | "expert_determination";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: "draft" | "pending_review" | "approved" | "listed" | "archived";
}

export interface DatasetValuation {
  estimatedValue: number;
  currency: string;
  valuationFactors: ValuationFactor[];
  marketDemand: "low" | "medium" | "high" | "very_high";
  uniquenessScore: number;
  completenessScore: number;
  temporalRelevance: number;
  aiAnalysis: string;
  valuedAt: string;
}

export interface ValuationFactor {
  factor: string;
  weight: number;
  score: number;
  contribution: number;
  description: string;
}

export interface AnonymizationJob {
  id: string;
  datasetId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  method: "safe_harbor" | "expert_determination" | "k_anonymity" | "differential_privacy" | "data_masking";
  configuration: AnonymizationConfig;
  progress: number;
  phiElementsDetected: number;
  phiElementsAnonymized: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  qualityReport?: AnonymizationQualityReport;
}

export interface AnonymizationConfig {
  removeDirectIdentifiers: boolean;
  generalizeQuasiIdentifiers: boolean;
  kAnonymityLevel?: number;
  epsilonValue?: number;
  dateShiftDays?: number;
  zipCodeTruncation?: number;
  ageGeneralization?: number;
  retainClinicalUtility: boolean;
  preserveTemporalRelationships: boolean;
}

export interface AnonymizationQualityReport {
  reIdentificationRisk: number;
  dataUtilityScore: number;
  hipaaCompliant: boolean;
  gdprCompliant: boolean;
  expertCertificationRequired: boolean;
  recommendations: string[];
  aiAssessment: string;
}

export interface MarketplaceListing {
  id: string;
  datasetId: string;
  title: string;
  description: string;
  category: "clinical_research" | "population_health" | "drug_discovery" | "medical_device" | "public_health" | "academic" | "insurance" | "other";
  pricing: ListingPricing;
  accessModel: "one_time" | "subscription" | "per_query" | "revenue_share";
  restrictions: AccessRestrictions;
  complianceRequirements: string[];
  sampleDataAvailable: boolean;
  documentation: string[];
  tags: string[];
  featured: boolean;
  viewCount: number;
  requestCount: number;
  status: "draft" | "pending_approval" | "active" | "paused" | "expired" | "sold";
  listedAt?: string;
  expiresAt?: string;
  sellerId: string;
  sellerOrganization: string;
}

export interface ListingPricing {
  basePrice: number;
  currency: string;
  pricingTiers?: PricingTier[];
  negotiable: boolean;
  minimumCommitment?: string;
  revenueSharePercentage?: number;
}

export interface PricingTier {
  name: string;
  recordLimit?: number;
  accessDuration?: string;
  price: number;
  features: string[];
}

export interface AccessRestrictions {
  allowedPurposes: string[];
  prohibitedUses: string[];
  geographicRestrictions?: string[];
  organizationTypes?: string[];
  requiresIRBApproval: boolean;
  requiresDUA: boolean;
  maxUsers?: number;
  dataRetentionLimit?: string;
  reidentificationProhibited: boolean;
  derivativeWorksAllowed: boolean;
  publicationRights: "unrestricted" | "requires_review" | "prohibited";
}

export interface DataAccessRequest {
  id: string;
  listingId: string;
  datasetId: string;
  requesterId: string;
  requesterOrganization: string;
  requesterType: "academic" | "commercial" | "government" | "nonprofit" | "healthcare_provider";
  purpose: string;
  researchDescription: string;
  intendedUse: string[];
  requestedAccessLevel: "full" | "limited" | "aggregated_only";
  duration: string;
  irbApprovalNumber?: string;
  irbExpirationDate?: string;
  principalInvestigator?: string;
  fundingSource?: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "revoked" | "expired";
  aiRiskAssessment?: AccessRiskAssessment;
  reviewNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskScore: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
  autoApprovalEligible: boolean;
  requiredReviews: string[];
  aiAnalysis: string;
}

export interface RiskFactor {
  category: string;
  factor: string;
  severity: "low" | "medium" | "high";
  mitigationRequired: boolean;
  mitigation?: string;
}

export interface DataSharingAgreement {
  id: string;
  accessRequestId: string;
  listingId: string;
  datasetId: string;
  sellerId: string;
  buyerId: string;
  agreementType: "dua" | "baa" | "research_agreement" | "commercial_license" | "custom";
  terms: AgreementTerms;
  signatures: AgreementSignature[];
  status: "draft" | "pending_signatures" | "active" | "expired" | "terminated" | "breached";
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
  aiGeneratedTerms?: boolean;
  complianceCheckResult?: ComplianceCheckResult;
}

export interface AgreementTerms {
  permittedUses: string[];
  prohibitedUses: string[];
  dataRetention: string;
  securityRequirements: string[];
  auditRights: boolean;
  terminationConditions: string[];
  liabilityLimitations: string;
  indemnification: string;
  breachNotificationPeriod: string;
  governingLaw: string;
  disputeResolution: string;
  customClauses: CustomClause[];
}

export interface CustomClause {
  title: string;
  content: string;
  required: boolean;
}

export interface AgreementSignature {
  signerId: string;
  signerName: string;
  signerTitle: string;
  organization: string;
  signedAt?: string;
  ipAddress?: string;
  signatureHash?: string;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  checkType: "hipaa" | "gdpr" | "ccpa" | "hitech" | "common_rule" | "custom";
  violations: ComplianceViolation[];
  warnings: string[];
  recommendations: string[];
  checkedAt: string;
  aiAnalysis: string;
}

export interface ComplianceViolation {
  regulation: string;
  section: string;
  description: string;
  severity: "minor" | "major" | "critical";
  remediation: string;
  autoRemediable: boolean;
}

export interface DataUsageLog {
  id: string;
  agreementId: string;
  datasetId: string;
  userId: string;
  action: "access" | "download" | "query" | "export" | "analyze";
  resourcesAccessed: number;
  queryDetails?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  complianceFlags?: string[];
}

export interface MonetizationDashboard {
  summary: {
    totalDatasets: number;
    listedDatasets: number;
    pendingRequests: number;
    activeAgreements: number;
    totalRevenue: number;
    revenueThisMonth: number;
    avgDatasetValue: number;
    anonymizationJobsRunning: number;
  };
  datasetsByCategory: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topDatasets: { id: string; name: string; requests: number; revenue: number }[];
  complianceStatus: {
    totalAgreements: number;
    compliantAgreements: number;
    violationsDetected: number;
    pendingAudits: number;
  };
  recentActivity: {
    timestamp: string;
    type: string;
    description: string;
    userId?: string;
  }[];
}

export interface PolicyEnforcementResult {
  allowed: boolean;
  policyId?: string;
  policyName?: string;
  violations: string[];
  requiredActions: string[];
  auditLogId: string;
}

class AIFHIRDataMonetizationService {
  private aiEnabled = true;
  private datasets: Map<string, ResearchDataset> = new Map();
  private anonymizationJobs: Map<string, AnonymizationJob> = new Map();
  private listings: Map<string, MarketplaceListing> = new Map();
  private accessRequests: Map<string, DataAccessRequest> = new Map();
  private agreements: Map<string, DataSharingAgreement> = new Map();
  private usageLogs: DataUsageLog[] = [];

  constructor() {
    console.log("[AIFHIRDataMonetization] AI client initialized (Vertex/BAA gateway)");
    if (process.env.NODE_ENV !== 'production') {
      this.initializeSampleData();
    }
  }

  private initializeSampleData(): void {
    const sampleDataset: ResearchDataset = {
      id: "ds-001",
      name: "Type 2 Diabetes Longitudinal Study Cohort",
      description: "Comprehensive longitudinal dataset of 50,000 Type 2 Diabetes patients over 5 years including medications, lab results, outcomes, and lifestyle factors.",
      resourceTypes: ["Patient", "Condition", "Observation", "MedicationRequest", "Procedure"],
      recordCount: 50000,
      dateRange: {
        startDate: "2019-01-01",
        endDate: "2024-12-31"
      },
      demographics: {
        ageRange: "35-75",
        genderDistribution: { male: 0.48, female: 0.51, other: 0.01 },
        geographicRegions: ["Northeast US", "Midwest US", "Southeast US"]
      },
      conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia", "Obesity"],
      procedures: ["HbA1c Testing", "Eye Examination", "Foot Examination", "Lipid Panel"],
      dataQualityScore: 94.5,
      researchValue: {
        estimatedValue: 250000,
        currency: "USD",
        valuationFactors: [
          { factor: "Sample Size", weight: 0.25, score: 95, contribution: 23.75, description: "Large cohort with 50,000 patients" },
          { factor: "Longitudinal Depth", weight: 0.20, score: 90, contribution: 18.0, description: "5-year follow-up with consistent data collection" },
          { factor: "Data Completeness", weight: 0.20, score: 94, contribution: 18.8, description: "94% data completeness across all fields" },
          { factor: "Clinical Relevance", weight: 0.20, score: 98, contribution: 19.6, description: "High-demand therapeutic area" },
          { factor: "Uniqueness", weight: 0.15, score: 85, contribution: 12.75, description: "Includes lifestyle and social determinants" }
        ],
        marketDemand: "very_high",
        uniquenessScore: 85,
        completenessScore: 94,
        temporalRelevance: 92,
        aiAnalysis: "This dataset is highly valuable for pharmaceutical research, health outcomes studies, and machine learning model development. The combination of longitudinal depth, diverse patient population, and comprehensive clinical data makes it particularly attractive for diabetes drug development and personalized medicine research.",
        valuedAt: new Date().toISOString()
      },
      anonymizationStatus: "completed",
      anonymizationLevel: "safe_harbor",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "data-admin",
      status: "listed"
    };

    const sampleDataset2: ResearchDataset = {
      id: "ds-002",
      name: "Cardiovascular Outcomes Registry",
      description: "Real-world evidence dataset from 25,000 cardiovascular patients including imaging data references, biomarkers, and treatment outcomes.",
      resourceTypes: ["Patient", "Condition", "Observation", "DiagnosticReport", "ImagingStudy"],
      recordCount: 25000,
      dateRange: {
        startDate: "2020-01-01",
        endDate: "2024-06-30"
      },
      demographics: {
        ageRange: "45-85",
        genderDistribution: { male: 0.58, female: 0.41, other: 0.01 },
        geographicRegions: ["Western US", "Mountain West"]
      },
      conditions: ["Coronary Artery Disease", "Heart Failure", "Atrial Fibrillation", "Stroke"],
      procedures: ["Echocardiogram", "Cardiac Catheterization", "PCI", "CABG"],
      dataQualityScore: 91.2,
      researchValue: {
        estimatedValue: 180000,
        currency: "USD",
        valuationFactors: [
          { factor: "Sample Size", weight: 0.25, score: 80, contribution: 20.0, description: "Moderate cohort size" },
          { factor: "Imaging Data", weight: 0.25, score: 95, contribution: 23.75, description: "Includes imaging study references" },
          { factor: "Data Completeness", weight: 0.20, score: 91, contribution: 18.2, description: "High completeness in clinical fields" },
          { factor: "Clinical Relevance", weight: 0.20, score: 96, contribution: 19.2, description: "Critical therapeutic area" },
          { factor: "Uniqueness", weight: 0.10, score: 78, contribution: 7.8, description: "Moderate uniqueness" }
        ],
        marketDemand: "high",
        uniquenessScore: 78,
        completenessScore: 91,
        temporalRelevance: 88,
        aiAnalysis: "Valuable for cardiovascular device research and drug trials. The imaging data references add significant value for AI-based diagnostic research.",
        valuedAt: new Date().toISOString()
      },
      anonymizationStatus: "in_progress",
      anonymizationLevel: "de_identified",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "research-team",
      status: "pending_review"
    };

    this.datasets.set(sampleDataset.id, sampleDataset);
    this.datasets.set(sampleDataset2.id, sampleDataset2);

    const sampleListing: MarketplaceListing = {
      id: "listing-001",
      datasetId: "ds-001",
      title: "Type 2 Diabetes Longitudinal Research Dataset",
      description: "Comprehensive de-identified longitudinal dataset ideal for diabetes drug development, outcomes research, and machine learning applications.",
      category: "clinical_research",
      pricing: {
        basePrice: 250000,
        currency: "USD",
        pricingTiers: [
          { name: "Academic", recordLimit: 10000, accessDuration: "1 year", price: 50000, features: ["De-identified data", "Basic support", "Academic use only"] },
          { name: "Commercial Basic", recordLimit: 25000, accessDuration: "2 years", price: 125000, features: ["De-identified data", "Priority support", "Commercial use"] },
          { name: "Commercial Full", recordLimit: undefined, accessDuration: "3 years", price: 250000, features: ["Full dataset", "Dedicated support", "Unlimited use", "Updates included"] }
        ],
        negotiable: true
      },
      accessModel: "one_time",
      restrictions: {
        allowedPurposes: ["Clinical research", "Drug development", "Machine learning", "Health economics"],
        prohibitedUses: ["Marketing", "Insurance underwriting", "Re-identification attempts"],
        requiresIRBApproval: true,
        requiresDUA: true,
        reidentificationProhibited: true,
        derivativeWorksAllowed: true,
        publicationRights: "requires_review"
      },
      complianceRequirements: ["HIPAA Safe Harbor", "GDPR compliant (EU researchers)", "IRB approval required"],
      sampleDataAvailable: true,
      documentation: ["Data dictionary", "Collection methodology", "Quality report"],
      tags: ["diabetes", "longitudinal", "real-world-evidence", "large-scale", "medications"],
      featured: true,
      viewCount: 342,
      requestCount: 18,
      status: "active",
      listedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      sellerId: "org-001",
      sellerOrganization: "Regional Health System"
    };

    this.listings.set(sampleListing.id, sampleListing);

    const sampleRequest: DataAccessRequest = {
      id: "req-001",
      listingId: "listing-001",
      datasetId: "ds-001",
      requesterId: "researcher-001",
      requesterOrganization: "University Medical Center",
      requesterType: "academic",
      purpose: "Development of predictive models for diabetes complications",
      researchDescription: "We aim to develop machine learning models to predict diabetic retinopathy and nephropathy onset based on longitudinal clinical data, with the goal of enabling earlier intervention.",
      intendedUse: ["Machine learning model development", "Publication in peer-reviewed journals", "Clinical decision support research"],
      requestedAccessLevel: "full",
      duration: "2 years",
      irbApprovalNumber: "IRB-2024-1234",
      irbExpirationDate: "2026-12-31",
      principalInvestigator: "Dr. Jane Smith, MD PhD",
      fundingSource: "NIH R01 Grant",
      status: "under_review",
      aiRiskAssessment: {
        overallRisk: "low",
        riskScore: 22,
        riskFactors: [
          { category: "Organization", factor: "Established academic institution", severity: "low", mitigationRequired: false },
          { category: "Purpose", factor: "Clinical research purpose", severity: "low", mitigationRequired: false },
          { category: "Data Handling", factor: "Large dataset access requested", severity: "medium", mitigationRequired: true, mitigation: "Require secure data enclave use" }
        ],
        recommendations: [
          "Verify IRB approval documentation",
          "Confirm secure computing environment",
          "Require annual compliance attestation"
        ],
        autoApprovalEligible: false,
        requiredReviews: ["Data governance committee", "Legal review"],
        aiAnalysis: "This request presents low overall risk. The requester is from an established academic institution with appropriate IRB oversight and clear research objectives aligned with permitted uses. The NIH funding provides additional accountability."
      },
      reviewNotes: "Initial review positive, awaiting committee decision",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.accessRequests.set(sampleRequest.id, sampleRequest);

    const sampleAgreement: DataSharingAgreement = {
      id: "agree-001",
      accessRequestId: "req-000",
      listingId: "listing-001",
      datasetId: "ds-001",
      sellerId: "org-001",
      buyerId: "pharma-001",
      agreementType: "research_agreement",
      terms: {
        permittedUses: ["Drug development research", "Biomarker discovery", "Publication with approval"],
        prohibitedUses: ["Marketing", "Sale to third parties", "Re-identification"],
        dataRetention: "3 years from effective date",
        securityRequirements: ["SOC 2 Type II compliance", "Encryption at rest and in transit", "Access logging"],
        auditRights: true,
        terminationConditions: ["Breach of terms", "Expiration of agreement", "Mutual consent"],
        liabilityLimitations: "Limited to fees paid under this agreement",
        indemnification: "Standard mutual indemnification for breach of representations",
        breachNotificationPeriod: "72 hours",
        governingLaw: "State of Delaware",
        disputeResolution: "Binding arbitration",
        customClauses: [
          { title: "Publication Review", content: "All publications must be submitted for review 30 days prior to submission.", required: true }
        ]
      },
      signatures: [
        { signerId: "seller-exec", signerName: "John Doe", signerTitle: "Chief Data Officer", organization: "Regional Health System", signedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
        { signerId: "buyer-exec", signerName: "Jane Johnson", signerTitle: "VP Research", organization: "PharmaCo Inc", signedAt: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString() }
      ],
      status: "active",
      effectiveDate: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString(),
      expirationDate: new Date(Date.now() + 307 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString(),
      aiGeneratedTerms: true,
      complianceCheckResult: {
        compliant: true,
        checkType: "hipaa",
        violations: [],
        warnings: ["Consider adding specific BAA language for covered entities"],
        recommendations: ["Add data destruction certification requirement at termination"],
        checkedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        aiAnalysis: "Agreement is compliant with HIPAA requirements for de-identified data sharing. All required elements are present. Minor recommendations for enhanced compliance posture."
      }
    };

    this.agreements.set(sampleAgreement.id, sampleAgreement);

    console.log("[AIFHIRDataMonetization] Sample data initialized");
    console.log(`[AIFHIRDataMonetization] Datasets: ${this.datasets.size}`);
    console.log(`[AIFHIRDataMonetization] Listings: ${this.listings.size}`);
    console.log(`[AIFHIRDataMonetization] Access requests: ${this.accessRequests.size}`);
    console.log(`[AIFHIRDataMonetization] Agreements: ${this.agreements.size}`);
  }

  async getDashboard(): Promise<MonetizationDashboard> {
    const datasets = Array.from(this.datasets.values());
    const listings = Array.from(this.listings.values());
    const requests = Array.from(this.accessRequests.values());
    const agreements = Array.from(this.agreements.values());

    const activeAgreements = agreements.filter(a => a.status === "active");
    const totalRevenue = activeAgreements.reduce((sum, a) => {
      const listing = this.listings.get(a.listingId);
      return sum + (listing?.pricing.basePrice || 0);
    }, 0);

    const datasetsByCategory: Record<string, number> = {};
    listings.forEach(l => {
      datasetsByCategory[l.category] = (datasetsByCategory[l.category] || 0) + 1;
    });

    return {
      summary: {
        totalDatasets: datasets.length,
        listedDatasets: listings.filter(l => l.status === "active").length,
        pendingRequests: requests.filter(r => r.status === "pending" || r.status === "under_review").length,
        activeAgreements: activeAgreements.length,
        totalRevenue,
        revenueThisMonth: totalRevenue * 0.15,
        avgDatasetValue: datasets.reduce((sum, d) => sum + d.researchValue.estimatedValue, 0) / datasets.length,
        anonymizationJobsRunning: Array.from(this.anonymizationJobs.values()).filter(j => j.status === "processing").length
      },
      datasetsByCategory,
      revenueByMonth: [
        { month: "2024-07", revenue: 125000 },
        { month: "2024-08", revenue: 75000 },
        { month: "2024-09", revenue: 180000 },
        { month: "2024-10", revenue: 95000 },
        { month: "2024-11", revenue: 210000 },
        { month: "2024-12", revenue: 150000 }
      ],
      topDatasets: datasets.slice(0, 5).map(d => ({
        id: d.id,
        name: d.name,
        requests: Math.floor(Math.random() * 20) + 5,
        revenue: d.researchValue.estimatedValue * 0.6
      })),
      complianceStatus: {
        totalAgreements: agreements.length,
        compliantAgreements: agreements.filter(a => a.complianceCheckResult?.compliant).length,
        violationsDetected: agreements.reduce((sum, a) => sum + (a.complianceCheckResult?.violations.length || 0), 0),
        pendingAudits: 2
      },
      recentActivity: [
        { timestamp: new Date().toISOString(), type: "access_request", description: "New access request for Diabetes dataset from University Medical Center" },
        { timestamp: new Date(Date.now() - 3600000).toISOString(), type: "listing_view", description: "Cardiovascular dataset viewed by PharmaCorp" },
        { timestamp: new Date(Date.now() - 7200000).toISOString(), type: "agreement_signed", description: "Data sharing agreement executed with ResearchLabs Inc" },
        { timestamp: new Date(Date.now() - 86400000).toISOString(), type: "anonymization", description: "Anonymization completed for Oncology dataset" }
      ]
    };
  }

  async identifyValuableDatasets(criteria: {
    minRecords?: number;
    resourceTypes?: string[];
    conditions?: string[];
    dateRange?: { start: string; end: string };
  }): Promise<{ datasets: ResearchDataset[]; aiRecommendations: string }> {
    const allDatasets = Array.from(this.datasets.values());
    
    let filtered = allDatasets;
    if (criteria.minRecords) {
      filtered = filtered.filter(d => d.recordCount >= criteria.minRecords!);
    }
    if (criteria.resourceTypes?.length) {
      filtered = filtered.filter(d => 
        criteria.resourceTypes!.some(rt => d.resourceTypes.includes(rt))
      );
    }
    if (criteria.conditions?.length) {
      filtered = filtered.filter(d =>
        criteria.conditions!.some(c => 
          d.conditions.some(dc => dc.toLowerCase().includes(c.toLowerCase()))
        )
      );
    }

    let aiRecommendations = "Based on market analysis:\n";
    aiRecommendations += "- Datasets with longitudinal follow-up command 40% premium\n";
    aiRecommendations += "- Rare disease cohorts are in high demand despite smaller sizes\n";
    aiRecommendations += "- Including social determinants of health data increases value by 25%\n";
    aiRecommendations += "- Real-world evidence datasets are preferred for regulatory submissions";

    if (this.aiEnabled) {
      try {
        aiRecommendations = await generatePhiSafeText({
          system: "You are a healthcare data marketplace expert. Analyze datasets and provide recommendations for maximizing research value while ensuring compliance. Keep recommendations concise and actionable.",
          user: `Analyze these datasets for research value:\n${JSON.stringify(filtered.map(d => ({
            name: d.name,
            recordCount: d.recordCount,
            conditions: d.conditions,
            qualityScore: d.dataQualityScore,
            resourceTypes: d.resourceTypes
          })), null, 2)}\n\nProvide specific recommendations for maximizing their market value.`,
          maxTokens: 500
        }) || aiRecommendations;
      } catch (error) {
        console.error("[AIFHIRDataMonetization] AI error:", error);
      }
    }

    return { datasets: filtered, aiRecommendations };
  }

  async valuateDataset(datasetId: string): Promise<DatasetValuation> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const factors: ValuationFactor[] = [
      {
        factor: "Sample Size",
        weight: 0.25,
        score: Math.min(100, (dataset.recordCount / 500) + 50),
        contribution: 0,
        description: `${dataset.recordCount.toLocaleString()} patient records`
      },
      {
        factor: "Data Completeness",
        weight: 0.20,
        score: dataset.dataQualityScore,
        contribution: 0,
        description: `${dataset.dataQualityScore}% data quality score`
      },
      {
        factor: "Clinical Relevance",
        weight: 0.20,
        score: this.calculateClinicalRelevance(dataset.conditions),
        contribution: 0,
        description: `High-demand therapeutic areas: ${dataset.conditions.join(", ")}`
      },
      {
        factor: "Temporal Depth",
        weight: 0.15,
        score: this.calculateTemporalScore(dataset.dateRange),
        contribution: 0,
        description: `Data spanning ${this.calculateDateRangeYears(dataset.dateRange)} years`
      },
      {
        factor: "Resource Diversity",
        weight: 0.10,
        score: Math.min(100, dataset.resourceTypes.length * 20),
        contribution: 0,
        description: `${dataset.resourceTypes.length} FHIR resource types`
      },
      {
        factor: "Uniqueness",
        weight: 0.10,
        score: 75 + Math.random() * 20,
        contribution: 0,
        description: "Market differentiation assessment"
      }
    ];

    factors.forEach(f => {
      f.contribution = f.weight * f.score;
    });

    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
    const baseValue = 5000;
    const estimatedValue = Math.round(baseValue * dataset.recordCount * (totalScore / 100) / 1000) * 1000;

    let aiAnalysis = `Dataset valued at $${estimatedValue.toLocaleString()} based on ${factors.length} key factors. `;
    aiAnalysis += `Primary value drivers: ${factors.sort((a, b) => b.contribution - a.contribution).slice(0, 2).map(f => f.factor).join(" and ")}.`;

    if (this.aiEnabled) {
      try {
        aiAnalysis = await generatePhiSafeText({
          system: "You are a healthcare data valuation expert. Provide concise analysis of dataset value for research markets.",
          user: `Analyze this dataset's market value:\nName: ${dataset.name}\nRecords: ${dataset.recordCount}\nConditions: ${dataset.conditions.join(", ")}\nQuality: ${dataset.dataQualityScore}%\nEstimated Value: $${estimatedValue.toLocaleString()}\n\nProvide a 2-3 sentence analysis of the valuation.`,
          maxTokens: 200
        }) || aiAnalysis;
      } catch (error) {
        console.error("[AIFHIRDataMonetization] AI valuation error:", error);
      }
    }

    const valuation: DatasetValuation = {
      estimatedValue,
      currency: "USD",
      valuationFactors: factors,
      marketDemand: totalScore > 85 ? "very_high" : totalScore > 70 ? "high" : totalScore > 50 ? "medium" : "low",
      uniquenessScore: factors.find(f => f.factor === "Uniqueness")?.score || 75,
      completenessScore: dataset.dataQualityScore,
      temporalRelevance: factors.find(f => f.factor === "Temporal Depth")?.score || 80,
      aiAnalysis,
      valuedAt: new Date().toISOString()
    };

    dataset.researchValue = valuation;
    this.datasets.set(datasetId, dataset);

    return valuation;
  }

  private calculateClinicalRelevance(conditions: string[]): number {
    const highDemandConditions = ["diabetes", "cancer", "cardiovascular", "alzheimer", "obesity", "rare disease"];
    const matches = conditions.filter(c => 
      highDemandConditions.some(hd => c.toLowerCase().includes(hd))
    ).length;
    return Math.min(100, 60 + matches * 15);
  }

  private calculateTemporalScore(dateRange: { startDate: string; endDate: string }): number {
    const years = this.calculateDateRangeYears(dateRange);
    return Math.min(100, 50 + years * 10);
  }

  private calculateDateRangeYears(dateRange: { startDate: string; endDate: string }): number {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    return Math.round((end.getTime() - start.getTime()) / (365 * 24 * 60 * 60 * 1000) * 10) / 10;
  }

  async startAnonymization(datasetId: string, config: AnonymizationConfig): Promise<AnonymizationJob> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const jobId = `anon-${Date.now()}`;
    const job: AnonymizationJob = {
      id: jobId,
      datasetId,
      status: "processing",
      method: config.kAnonymityLevel ? "k_anonymity" : config.epsilonValue ? "differential_privacy" : "safe_harbor",
      configuration: config,
      progress: 0,
      phiElementsDetected: Math.floor(dataset.recordCount * 0.15),
      phiElementsAnonymized: 0,
      startedAt: new Date().toISOString()
    };

    this.anonymizationJobs.set(jobId, job);
    dataset.anonymizationStatus = "in_progress";
    this.datasets.set(datasetId, dataset);

    this.simulateAnonymizationProgress(jobId);

    return job;
  }

  private async simulateAnonymizationProgress(jobId: string): Promise<void> {
    const job = this.anonymizationJobs.get(jobId);
    if (!job) return;

    const interval = setInterval(() => {
      const currentJob = this.anonymizationJobs.get(jobId);
      if (!currentJob || currentJob.status !== "processing") {
        clearInterval(interval);
        return;
      }

      currentJob.progress = Math.min(100, currentJob.progress + 10);
      currentJob.phiElementsAnonymized = Math.floor(currentJob.phiElementsDetected * (currentJob.progress / 100));

      if (currentJob.progress >= 100) {
        currentJob.status = "completed";
        currentJob.completedAt = new Date().toISOString();
        currentJob.qualityReport = {
          reIdentificationRisk: 0.02,
          dataUtilityScore: 94.5,
          hipaaCompliant: true,
          gdprCompliant: true,
          expertCertificationRequired: false,
          recommendations: [
            "Dataset meets Safe Harbor requirements",
            "Consider additional generalization for age 85+ records",
            "Geographic data generalized to 3-digit ZIP codes"
          ],
          aiAssessment: "Anonymization successfully completed with minimal utility loss. Re-identification risk is well below acceptable thresholds."
        };

        const dataset = this.datasets.get(currentJob.datasetId);
        if (dataset) {
          dataset.anonymizationStatus = "completed";
          dataset.anonymizationLevel = "safe_harbor";
          this.datasets.set(currentJob.datasetId, dataset);
        }

        clearInterval(interval);
      }

      this.anonymizationJobs.set(jobId, currentJob);
    }, 2000);
  }

  async getAnonymizationJob(jobId: string): Promise<AnonymizationJob | undefined> {
    return this.anonymizationJobs.get(jobId);
  }

  async listAnonymizationJobs(datasetId?: string): Promise<AnonymizationJob[]> {
    const jobs = Array.from(this.anonymizationJobs.values());
    if (datasetId) {
      return jobs.filter(j => j.datasetId === datasetId);
    }
    return jobs;
  }

  async createListing(listing: Omit<MarketplaceListing, "id" | "viewCount" | "requestCount" | "status" | "listedAt">): Promise<MarketplaceListing> {
    const dataset = this.datasets.get(listing.datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${listing.datasetId} not found`);
    }
    if (dataset.anonymizationStatus !== "completed" && dataset.anonymizationStatus !== "verified") {
      throw new Error("Dataset must be anonymized before listing");
    }

    const newListing: MarketplaceListing = {
      ...listing,
      id: `listing-${Date.now()}`,
      viewCount: 0,
      requestCount: 0,
      status: "pending_approval"
    };

    this.listings.set(newListing.id, newListing);
    return newListing;
  }

  async getListings(filters?: {
    category?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
  }): Promise<MarketplaceListing[]> {
    let listings = Array.from(this.listings.values());

    if (filters?.category) {
      listings = listings.filter(l => l.category === filters.category);
    }
    if (filters?.status) {
      listings = listings.filter(l => l.status === filters.status);
    }
    if (filters?.minPrice !== undefined) {
      listings = listings.filter(l => l.pricing.basePrice >= filters.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      listings = listings.filter(l => l.pricing.basePrice <= filters.maxPrice!);
    }
    if (filters?.tags?.length) {
      listings = listings.filter(l => 
        filters.tags!.some(t => l.tags.includes(t))
      );
    }

    return listings;
  }

  async getListing(listingId: string): Promise<MarketplaceListing | undefined> {
    const listing = this.listings.get(listingId);
    if (listing) {
      listing.viewCount++;
      this.listings.set(listingId, listing);
    }
    return listing;
  }

  async submitAccessRequest(request: Omit<DataAccessRequest, "id" | "status" | "aiRiskAssessment" | "createdAt" | "updatedAt">): Promise<DataAccessRequest> {
    const listing = this.listings.get(request.listingId);
    if (!listing) {
      throw new Error(`Listing ${request.listingId} not found`);
    }

    const riskAssessment = await this.assessAccessRisk(request, listing);

    const newRequest: DataAccessRequest = {
      ...request,
      id: `req-${Date.now()}`,
      status: riskAssessment.autoApprovalEligible ? "approved" : "pending",
      aiRiskAssessment: riskAssessment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.accessRequests.set(newRequest.id, newRequest);
    listing.requestCount++;
    this.listings.set(listing.id, listing);

    return newRequest;
  }

  private async assessAccessRisk(
    request: Omit<DataAccessRequest, "id" | "status" | "aiRiskAssessment" | "createdAt" | "updatedAt">,
    listing: MarketplaceListing
  ): Promise<AccessRiskAssessment> {
    const riskFactors: RiskFactor[] = [];
    let totalRiskScore = 0;

    if (request.requesterType === "academic") {
      riskFactors.push({ category: "Organization", factor: "Academic institution", severity: "low", mitigationRequired: false });
      totalRiskScore += 10;
    } else if (request.requesterType === "commercial") {
      riskFactors.push({ category: "Organization", factor: "Commercial entity", severity: "medium", mitigationRequired: true, mitigation: "Require enhanced audit provisions" });
      totalRiskScore += 30;
    }

    if (request.irbApprovalNumber) {
      riskFactors.push({ category: "Compliance", factor: "IRB approval provided", severity: "low", mitigationRequired: false });
    } else if (listing.restrictions.requiresIRBApproval) {
      riskFactors.push({ category: "Compliance", factor: "IRB approval required but not provided", severity: "high", mitigationRequired: true, mitigation: "Obtain IRB approval before access" });
      totalRiskScore += 40;
    }

    if (request.requestedAccessLevel === "full") {
      riskFactors.push({ category: "Access Level", factor: "Full dataset access requested", severity: "medium", mitigationRequired: true, mitigation: "Consider limiting to required fields" });
      totalRiskScore += 20;
    }

    const overallRisk: AccessRiskAssessment["overallRisk"] = 
      totalRiskScore >= 70 ? "critical" :
      totalRiskScore >= 50 ? "high" :
      totalRiskScore >= 30 ? "medium" : "low";

    let aiAnalysis = `Risk assessment completed with ${riskFactors.length} factors evaluated. `;
    aiAnalysis += `Overall risk level: ${overallRisk}. `;
    if (overallRisk === "low") {
      aiAnalysis += "Request appears to be from a trusted source with appropriate oversight.";
    } else {
      aiAnalysis += "Additional review recommended before approval.";
    }

    if (this.aiEnabled) {
      try {
        aiAnalysis = await generatePhiSafeText({
          system: "You are a data access risk analyst. Provide concise risk assessments for healthcare data sharing requests.",
          user: `Assess this data access request:\nRequester: ${request.requesterOrganization} (${request.requesterType})\nPurpose: ${request.purpose}\nDataset: ${listing.title}\nAccess Level: ${request.requestedAccessLevel}\nIRB: ${request.irbApprovalNumber || "Not provided"}\n\nProvide a 2-3 sentence risk assessment.`,
          maxTokens: 200
        }) || aiAnalysis;
      } catch (error) {
        console.error("[AIFHIRDataMonetization] AI risk assessment error:", error);
      }
    }

    return {
      overallRisk,
      riskScore: totalRiskScore,
      riskFactors,
      recommendations: [
        "Verify organizational credentials",
        "Confirm data security practices",
        "Review research protocol"
      ],
      autoApprovalEligible: totalRiskScore < 25 && request.requesterType === "academic" && !!request.irbApprovalNumber,
      requiredReviews: totalRiskScore >= 50 ? ["Legal review", "Data governance committee"] : ["Data governance committee"],
      aiAnalysis
    };
  }

  async getAccessRequests(filters?: { listingId?: string; status?: string }): Promise<DataAccessRequest[]> {
    let requests = Array.from(this.accessRequests.values());
    if (filters?.listingId) {
      requests = requests.filter(r => r.listingId === filters.listingId);
    }
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    return requests;
  }

  async updateAccessRequestStatus(
    requestId: string,
    status: DataAccessRequest["status"],
    reviewNotes?: string
  ): Promise<DataAccessRequest> {
    const request = this.accessRequests.get(requestId);
    if (!request) {
      throw new Error(`Access request ${requestId} not found`);
    }

    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (reviewNotes) {
      request.reviewNotes = reviewNotes;
    }
    if (status === "approved") {
      request.approvedAt = new Date().toISOString();
    }

    this.accessRequests.set(requestId, request);
    return request;
  }

  async generateAgreement(accessRequestId: string): Promise<DataSharingAgreement> {
    const request = this.accessRequests.get(accessRequestId);
    if (!request) {
      throw new Error(`Access request ${accessRequestId} not found`);
    }

    const listing = this.listings.get(request.listingId);
    if (!listing) {
      throw new Error(`Listing ${request.listingId} not found`);
    }

    let terms: AgreementTerms = {
      permittedUses: request.intendedUse,
      prohibitedUses: listing.restrictions.prohibitedUses,
      dataRetention: listing.restrictions.dataRetentionLimit || "Duration of agreement plus 1 year",
      securityRequirements: [
        "Maintain data in encrypted storage (AES-256 minimum)",
        "Implement access controls with audit logging",
        "Complete security questionnaire annually",
        "Report any security incidents within 72 hours"
      ],
      auditRights: true,
      terminationConditions: [
        "Material breach of agreement terms",
        "Expiration of agreement term",
        "Revocation of IRB approval",
        "Mutual written consent"
      ],
      liabilityLimitations: "Liability limited to fees paid under this agreement",
      indemnification: "Each party shall indemnify the other for breaches of its representations and warranties",
      breachNotificationPeriod: "72 hours",
      governingLaw: "State of Delaware",
      disputeResolution: "Binding arbitration in accordance with AAA Commercial Rules",
      customClauses: []
    };

    if (listing.restrictions.publicationRights === "requires_review") {
      terms.customClauses.push({
        title: "Publication Review",
        content: "Data Recipient shall submit any publications or presentations using the data for review at least 30 days prior to submission or presentation.",
        required: true
      });
    }

    if (this.aiEnabled) {
      try {
        const content = await generatePhiSafeText({
          system: "You are a healthcare legal expert specializing in data sharing agreements. Suggest additional protective clauses based on the use case.",
          user: `Suggest 1-2 additional protective clauses for a data sharing agreement:\nPurpose: ${request.purpose}\nRequester Type: ${request.requesterType}\nAccess Level: ${request.requestedAccessLevel}\nDuration: ${request.duration}\n\nProvide clauses in JSON format: [{title: string, content: string, required: boolean}]`,
          maxTokens: 300,
          responseMimeType: "application/json"
        });

        try {
          const suggestedClauses = JSON.parse(content || "[]");
          if (Array.isArray(suggestedClauses)) {
            terms.customClauses.push(...suggestedClauses);
          }
        } catch {
          // Use default clauses if parsing fails
        }
      } catch (error) {
        console.error("[AIFHIRDataMonetization] AI agreement generation error:", error);
      }
    }

    const agreement: DataSharingAgreement = {
      id: `agree-${Date.now()}`,
      accessRequestId,
      listingId: request.listingId,
      datasetId: request.datasetId,
      sellerId: listing.sellerId,
      buyerId: request.requesterId,
      agreementType: request.requesterType === "academic" ? "research_agreement" : "commercial_license",
      terms,
      signatures: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiGeneratedTerms: true
    };

    this.agreements.set(agreement.id, agreement);
    return agreement;
  }

  async checkCompliance(agreementId: string, checkType: ComplianceCheckResult["checkType"]): Promise<ComplianceCheckResult> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement ${agreementId} not found`);
    }

    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (checkType === "hipaa") {
      if (!agreement.terms.securityRequirements.some(r => r.toLowerCase().includes("encrypt"))) {
        violations.push({
          regulation: "HIPAA",
          section: "164.312(a)(2)(iv)",
          description: "Encryption requirements not explicitly stated",
          severity: "major",
          remediation: "Add explicit encryption requirements for data at rest and in transit",
          autoRemediable: true
        });
      }

      if (!agreement.terms.terminationConditions.some(t => t.toLowerCase().includes("breach"))) {
        warnings.push("Consider adding explicit data breach as termination trigger");
      }

      recommendations.push("Add BAA language if either party is a covered entity");
      recommendations.push("Specify minimum necessary standard for data access");
    }

    if (checkType === "gdpr") {
      if (!agreement.terms.permittedUses.length) {
        violations.push({
          regulation: "GDPR",
          section: "Article 5(1)(b)",
          description: "Purpose limitation not clearly defined",
          severity: "major",
          remediation: "Clearly specify all permitted purposes for data processing",
          autoRemediable: false
        });
      }

      recommendations.push("Include data subject rights provisions");
      recommendations.push("Add data processing agreement (DPA) appendix");
    }

    let aiAnalysis = `Compliance check completed for ${checkType.toUpperCase()}. `;
    aiAnalysis += `Found ${violations.length} violations and ${warnings.length} warnings. `;
    aiAnalysis += violations.length === 0 ? "Agreement is compliant." : "Remediation required before execution.";

    if (this.aiEnabled) {
      try {
        aiAnalysis = await generatePhiSafeText({
          system: `You are a healthcare compliance expert specializing in ${checkType.toUpperCase()} regulations for data sharing agreements.`,
          user: `Review this agreement for ${checkType.toUpperCase()} compliance:\nTerms: ${JSON.stringify(agreement.terms, null, 2)}\n\nProvide a concise 2-3 sentence compliance assessment.`,
          maxTokens: 200
        }) || aiAnalysis;
      } catch (error) {
        console.error("[AIFHIRDataMonetization] AI compliance check error:", error);
      }
    }

    const result: ComplianceCheckResult = {
      compliant: violations.length === 0,
      checkType,
      violations,
      warnings,
      recommendations,
      checkedAt: new Date().toISOString(),
      aiAnalysis
    };

    agreement.complianceCheckResult = result;
    agreement.updatedAt = new Date().toISOString();
    this.agreements.set(agreementId, agreement);

    return result;
  }

  async getAgreements(filters?: { status?: string; sellerId?: string; buyerId?: string }): Promise<DataSharingAgreement[]> {
    let agreements = Array.from(this.agreements.values());
    if (filters?.status) {
      agreements = agreements.filter(a => a.status === filters.status);
    }
    if (filters?.sellerId) {
      agreements = agreements.filter(a => a.sellerId === filters.sellerId);
    }
    if (filters?.buyerId) {
      agreements = agreements.filter(a => a.buyerId === filters.buyerId);
    }
    return agreements;
  }

  async getAgreement(agreementId: string): Promise<DataSharingAgreement | undefined> {
    return this.agreements.get(agreementId);
  }

  async signAgreement(agreementId: string, signature: AgreementSignature): Promise<DataSharingAgreement> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement ${agreementId} not found`);
    }

    signature.signedAt = new Date().toISOString();
    signature.signatureHash = `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    agreement.signatures.push(signature);
    agreement.updatedAt = new Date().toISOString();

    if (agreement.signatures.length >= 2) {
      agreement.status = "active";
      agreement.effectiveDate = new Date().toISOString();
      
      const durationMatch = this.accessRequests.get(agreement.accessRequestId)?.duration.match(/(\d+)/);
      const years = durationMatch ? parseInt(durationMatch[1]) : 1;
      agreement.expirationDate = new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      agreement.status = "pending_signatures";
    }

    this.agreements.set(agreementId, agreement);
    return agreement;
  }

  async logDataUsage(log: Omit<DataUsageLog, "id" | "timestamp">): Promise<DataUsageLog> {
    const agreement = this.agreements.get(log.agreementId);
    if (!agreement || agreement.status !== "active") {
      throw new Error("Invalid or inactive agreement");
    }

    const usageLog: DataUsageLog = {
      ...log,
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const violations = await this.checkUsageCompliance(usageLog, agreement);
    if (violations.length > 0) {
      usageLog.complianceFlags = violations;
    }

    this.usageLogs.push(usageLog);
    return usageLog;
  }

  private async checkUsageCompliance(log: DataUsageLog, agreement: DataSharingAgreement): Promise<string[]> {
    const flags: string[] = [];

    if (agreement.expirationDate && new Date(agreement.expirationDate) < new Date()) {
      flags.push("Agreement expired");
    }

    if (log.action === "export" && !agreement.terms.permittedUses.some(u => u.toLowerCase().includes("export"))) {
      flags.push("Export may not be permitted under agreement");
    }

    return flags;
  }

  async getUsageLogs(agreementId: string): Promise<DataUsageLog[]> {
    return this.usageLogs.filter(l => l.agreementId === agreementId);
  }

  async enforcePolicy(userId: string, agreementId: string, action: string): Promise<PolicyEnforcementResult> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      return {
        allowed: false,
        violations: ["Agreement not found"],
        requiredActions: ["Obtain valid data sharing agreement"],
        auditLogId: `audit-${Date.now()}`
      };
    }

    const violations: string[] = [];
    const requiredActions: string[] = [];
    let allowed = true;

    if (agreement.status !== "active") {
      allowed = false;
      violations.push(`Agreement status is ${agreement.status}`);
      requiredActions.push("Ensure agreement is active before access");
    }

    if (agreement.expirationDate && new Date(agreement.expirationDate) < new Date()) {
      allowed = false;
      violations.push("Agreement has expired");
      requiredActions.push("Renew data sharing agreement");
    }

    if (agreement.terms.prohibitedUses.some(p => action.toLowerCase().includes(p.toLowerCase()))) {
      allowed = false;
      violations.push(`Action "${action}" is prohibited under agreement terms`);
      requiredActions.push("Review permitted uses in agreement");
    }

    return {
      allowed,
      policyId: agreement.id,
      policyName: `DSA-${agreement.id}`,
      violations,
      requiredActions,
      auditLogId: `audit-${Date.now()}`
    };
  }

  getDatasets(): ResearchDataset[] {
    return Array.from(this.datasets.values());
  }

  getDataset(id: string): ResearchDataset | undefined {
    return this.datasets.get(id);
  }

  async createDataset(dataset: Omit<ResearchDataset, "id" | "createdAt" | "updatedAt" | "researchValue">): Promise<ResearchDataset> {
    const newDataset: ResearchDataset = {
      ...dataset,
      id: `ds-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      researchValue: {
        estimatedValue: 0,
        currency: "USD",
        valuationFactors: [],
        marketDemand: "medium",
        uniquenessScore: 0,
        completenessScore: dataset.dataQualityScore,
        temporalRelevance: 0,
        aiAnalysis: "Valuation pending",
        valuedAt: new Date().toISOString()
      }
    };

    this.datasets.set(newDataset.id, newDataset);
    return newDataset;
  }
}

export const aiFHIRDataMonetizationService = new AIFHIRDataMonetizationService();
