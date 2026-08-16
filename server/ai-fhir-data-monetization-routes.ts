import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  aiFHIRDataMonetizationService,
  AnonymizationConfig,
  MarketplaceListing,
  DataAccessRequest,
  AgreementSignature,
  DataUsageLog
} from "./services/ai-fhir-data-monetization-service";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

const logAudit = async (
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  req: Request
) => {
  try {
    const userId = getUserId(req);
    await comprehensiveAuditTrailService.logAuditEntry(userId, {
      who: {
        userId,
        userRole: (req as any).user?.role || "system",
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown"
      },
      what: {
        category: "integration" as const,
        action: action as any,
        resourceType,
        resourceId,
        description: `Data monetization: ${action} on ${resourceType}`
      },
      why: {
        reason: "Data monetization operation",
        automatedAction: false
      },
      result: {
        success: true
      },
      context: {
        environment: "development",
        requestId: `dm-${Date.now()}`
      },
      severity: "info" as const,
      tags: ["data-monetization", action],
      metadata: details,
      phiAccessed: true
    });
  } catch (error) {
    console.error("[DataMonetization] Audit logging error:", error);
  }
};

const noCdsCompliance = {
  disclaimer: "This information is for data governance and operational purposes only. Not intended for clinical decision-making.",
  complianceLevel: "NO-CDS",
  generatedAt: new Date().toISOString()
};

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const dashboard = await aiFHIRDataMonetizationService.getDashboard();
    
    await logAudit("view_dashboard", "MonetizationDashboard", "dashboard", {}, req);
    
    res.json({
      success: true,
      data: dashboard,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Dashboard error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch dashboard",
      noCdsCompliance 
    });
  }
});

const identifyDatasetsSchema = z.object({
  minRecords: z.number().optional(),
  resourceTypes: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional()
});

router.post("/datasets/identify", async (req: Request, res: Response) => {
  try {
    const criteria = identifyDatasetsSchema.parse(req.body);
    const result = await aiFHIRDataMonetizationService.identifyValuableDatasets(criteria);
    
    await logAudit("identify_datasets", "ResearchDataset", "bulk", { criteria }, req);
    
    res.json({
      success: true,
      data: result,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Identify datasets error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to identify datasets",
      noCdsCompliance 
    });
  }
});

router.get("/datasets", async (req: Request, res: Response) => {
  try {
    const datasets = aiFHIRDataMonetizationService.getDatasets();
    
    await logAudit("list_datasets", "ResearchDataset", "bulk", {}, req);
    
    res.json({
      success: true,
      data: { items: datasets, total: datasets.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] List datasets error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to list datasets",
      noCdsCompliance 
    });
  }
});

router.get("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const dataset = aiFHIRDataMonetizationService.getDataset(id);
    
    if (!dataset) {
      return res.status(404).json({ 
        success: false, 
        error: "Dataset not found",
        noCdsCompliance 
      });
    }
    
    await logAudit("view_dataset", "ResearchDataset", id, {}, req);
    
    res.json({
      success: true,
      data: dataset,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Get dataset error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get dataset",
      noCdsCompliance 
    });
  }
});

const createDatasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  resourceTypes: z.array(z.string()),
  recordCount: z.number().min(1),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  demographics: z.object({
    ageRange: z.string(),
    genderDistribution: z.record(z.number()),
    geographicRegions: z.array(z.string())
  }),
  conditions: z.array(z.string()),
  procedures: z.array(z.string()),
  dataQualityScore: z.number().min(0).max(100),
  anonymizationStatus: z.enum(["not_started", "in_progress", "completed", "verified"]),
  anonymizationLevel: z.enum(["none", "de_identified", "limited_dataset", "safe_harbor", "expert_determination"]),
  createdBy: z.string(),
  status: z.enum(["draft", "pending_review", "approved", "listed", "archived"])
});

router.post("/datasets", async (req: Request, res: Response) => {
  try {
    const data = createDatasetSchema.parse(req.body);
    const dataset = await aiFHIRDataMonetizationService.createDataset(data);
    
    await logAudit("create_dataset", "ResearchDataset", dataset.id, { name: data.name }, req);
    
    res.status(201).json({
      success: true,
      data: dataset,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Create dataset error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create dataset",
      noCdsCompliance 
    });
  }
});

router.post("/datasets/:id/valuate", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const valuation = await aiFHIRDataMonetizationService.valuateDataset(id);
    
    await logAudit("valuate_dataset", "ResearchDataset", id, { estimatedValue: valuation.estimatedValue }, req);
    
    res.json({
      success: true,
      data: valuation,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Valuate dataset error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to valuate dataset",
      noCdsCompliance 
    });
  }
});

const anonymizationConfigSchema = z.object({
  removeDirectIdentifiers: z.boolean(),
  generalizeQuasiIdentifiers: z.boolean(),
  kAnonymityLevel: z.number().optional(),
  epsilonValue: z.number().optional(),
  dateShiftDays: z.number().optional(),
  zipCodeTruncation: z.number().optional(),
  ageGeneralization: z.number().optional(),
  retainClinicalUtility: z.boolean(),
  preserveTemporalRelationships: z.boolean()
});

router.post("/datasets/:id/anonymize", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const config = anonymizationConfigSchema.parse(req.body);
    const job = await aiFHIRDataMonetizationService.startAnonymization(id, config);
    
    await logAudit("start_anonymization", "AnonymizationJob", job.id, { datasetId: id, method: job.method }, req);
    
    res.status(201).json({
      success: true,
      data: job,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Start anonymization error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to start anonymization",
      noCdsCompliance 
    });
  }
});

router.get("/anonymization-jobs", async (req: Request, res: Response) => {
  try {
    const datasetId = req.query.datasetId as string | undefined;
    const jobs = await aiFHIRDataMonetizationService.listAnonymizationJobs(datasetId);
    
    res.json({
      success: true,
      data: { items: jobs, total: jobs.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] List anonymization jobs error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to list anonymization jobs",
      noCdsCompliance 
    });
  }
});

router.get("/anonymization-jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const job = await aiFHIRDataMonetizationService.getAnonymizationJob(id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: "Anonymization job not found",
        noCdsCompliance 
      });
    }
    
    res.json({
      success: true,
      data: job,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Get anonymization job error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get anonymization job",
      noCdsCompliance 
    });
  }
});

const listingFiltersSchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  tags: z.string().optional()
});

router.get("/marketplace/listings", async (req: Request, res: Response) => {
  try {
    const filters = listingFiltersSchema.parse(req.query);
    const parsedFilters = {
      ...filters,
      tags: filters.tags ? filters.tags.split(",") : undefined
    };
    const listings = await aiFHIRDataMonetizationService.getListings(parsedFilters);
    
    await logAudit("list_marketplace_listings", "MarketplaceListing", "bulk", { filters: parsedFilters }, req);
    
    res.json({
      success: true,
      data: { items: listings, total: listings.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] List listings error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to list marketplace listings",
      noCdsCompliance 
    });
  }
});

router.get("/marketplace/listings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const listing = await aiFHIRDataMonetizationService.getListing(id);
    
    if (!listing) {
      return res.status(404).json({ 
        success: false, 
        error: "Listing not found",
        noCdsCompliance 
      });
    }
    
    await logAudit("view_listing", "MarketplaceListing", id, {}, req);
    
    res.json({
      success: true,
      data: listing,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Get listing error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get listing",
      noCdsCompliance 
    });
  }
});

const createListingSchema = z.object({
  datasetId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["clinical_research", "population_health", "drug_discovery", "medical_device", "public_health", "academic", "insurance", "other"]),
  pricing: z.object({
    basePrice: z.number().min(0),
    currency: z.string(),
    pricingTiers: z.array(z.object({
      name: z.string(),
      recordLimit: z.number().optional(),
      accessDuration: z.string().optional(),
      price: z.number(),
      features: z.array(z.string())
    })).optional(),
    negotiable: z.boolean(),
    minimumCommitment: z.string().optional(),
    revenueSharePercentage: z.number().optional()
  }),
  accessModel: z.enum(["one_time", "subscription", "per_query", "revenue_share"]),
  restrictions: z.object({
    allowedPurposes: z.array(z.string()),
    prohibitedUses: z.array(z.string()),
    geographicRestrictions: z.array(z.string()).optional(),
    organizationTypes: z.array(z.string()).optional(),
    requiresIRBApproval: z.boolean(),
    requiresDUA: z.boolean(),
    maxUsers: z.number().optional(),
    dataRetentionLimit: z.string().optional(),
    reidentificationProhibited: z.boolean(),
    derivativeWorksAllowed: z.boolean(),
    publicationRights: z.enum(["unrestricted", "requires_review", "prohibited"])
  }),
  complianceRequirements: z.array(z.string()),
  sampleDataAvailable: z.boolean(),
  documentation: z.array(z.string()),
  tags: z.array(z.string()),
  featured: z.boolean(),
  expiresAt: z.string().optional(),
  sellerId: z.string(),
  sellerOrganization: z.string()
});

router.post("/marketplace/listings", async (req: Request, res: Response) => {
  try {
    const data = createListingSchema.parse(req.body);
    const listing = await aiFHIRDataMonetizationService.createListing(data);
    
    await logAudit("create_listing", "MarketplaceListing", listing.id, { title: data.title, datasetId: data.datasetId }, req);
    
    res.status(201).json({
      success: true,
      data: listing,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Create listing error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create listing",
      noCdsCompliance 
    });
  }
});

const accessRequestSchema = z.object({
  listingId: z.string(),
  datasetId: z.string(),
  requesterId: z.string(),
  requesterOrganization: z.string(),
  requesterType: z.enum(["academic", "commercial", "government", "nonprofit", "healthcare_provider"]),
  purpose: z.string().min(1),
  researchDescription: z.string().min(1),
  intendedUse: z.array(z.string()),
  requestedAccessLevel: z.enum(["full", "limited", "aggregated_only"]),
  duration: z.string(),
  irbApprovalNumber: z.string().optional(),
  irbExpirationDate: z.string().optional(),
  principalInvestigator: z.string().optional(),
  fundingSource: z.string().optional()
});

router.post("/access-requests", async (req: Request, res: Response) => {
  try {
    const data = accessRequestSchema.parse(req.body);
    const request = await aiFHIRDataMonetizationService.submitAccessRequest(data);
    
    await logAudit("submit_access_request", "DataAccessRequest", request.id, { 
      listingId: data.listingId, 
      requesterOrganization: data.requesterOrganization,
      riskLevel: request.aiRiskAssessment?.overallRisk
    }, req);
    
    res.status(201).json({
      success: true,
      data: request,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Submit access request error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to submit access request",
      noCdsCompliance 
    });
  }
});

router.get("/access-requests", async (req: Request, res: Response) => {
  try {
    const filters = {
      listingId: req.query.listingId as string | undefined,
      status: req.query.status as string | undefined
    };
    const requests = await aiFHIRDataMonetizationService.getAccessRequests(filters);
    
    await logAudit("list_access_requests", "DataAccessRequest", "bulk", { filters }, req);
    
    res.json({
      success: true,
      data: { items: requests, total: requests.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] List access requests error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to list access requests",
      noCdsCompliance 
    });
  }
});

const updateRequestStatusSchema = z.object({
  status: z.enum(["pending", "under_review", "approved", "rejected", "revoked", "expired"]),
  reviewNotes: z.string().optional()
});

router.patch("/access-requests/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { status, reviewNotes } = updateRequestStatusSchema.parse(req.body);
    const request = await aiFHIRDataMonetizationService.updateAccessRequestStatus(id, status, reviewNotes);
    
    await logAudit("update_access_request_status", "DataAccessRequest", id, { newStatus: status }, req);
    
    res.json({
      success: true,
      data: request,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Update access request status error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update access request status",
      noCdsCompliance 
    });
  }
});

router.post("/access-requests/:id/generate-agreement", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const agreement = await aiFHIRDataMonetizationService.generateAgreement(id);
    
    await logAudit("generate_agreement", "DataSharingAgreement", agreement.id, { accessRequestId: id, aiGenerated: true }, req);
    
    res.status(201).json({
      success: true,
      data: agreement,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Generate agreement error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to generate agreement",
      noCdsCompliance 
    });
  }
});

router.get("/agreements", async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      sellerId: req.query.sellerId as string | undefined,
      buyerId: req.query.buyerId as string | undefined
    };
    const agreements = await aiFHIRDataMonetizationService.getAgreements(filters);
    
    await logAudit("list_agreements", "DataSharingAgreement", "bulk", { filters }, req);
    
    res.json({
      success: true,
      data: { items: agreements, total: agreements.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] List agreements error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to list agreements",
      noCdsCompliance 
    });
  }
});

router.get("/agreements/:id", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const agreement = await aiFHIRDataMonetizationService.getAgreement(id);
    
    if (!agreement) {
      return res.status(404).json({ 
        success: false, 
        error: "Agreement not found",
        noCdsCompliance 
      });
    }
    
    await logAudit("view_agreement", "DataSharingAgreement", id, {}, req);
    
    res.json({
      success: true,
      data: agreement,
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Get agreement error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get agreement",
      noCdsCompliance 
    });
  }
});

const complianceCheckSchema = z.object({
  checkType: z.enum(["hipaa", "gdpr", "ccpa", "hitech", "common_rule", "custom"])
});

router.post("/agreements/:id/check-compliance", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { checkType } = complianceCheckSchema.parse(req.body);
    const result = await aiFHIRDataMonetizationService.checkCompliance(id, checkType);
    
    await logAudit("check_compliance", "DataSharingAgreement", id, { checkType, compliant: result.compliant }, req);
    
    res.json({
      success: true,
      data: result,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Check compliance error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to check compliance",
      noCdsCompliance 
    });
  }
});

const signatureSchema = z.object({
  signerId: z.string(),
  signerName: z.string(),
  signerTitle: z.string(),
  organization: z.string(),
  ipAddress: z.string().optional()
});

router.post("/agreements/:id/sign", async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const signature = signatureSchema.parse(req.body);
    const agreement = await aiFHIRDataMonetizationService.signAgreement(id, signature as AgreementSignature);
    
    await logAudit("sign_agreement", "DataSharingAgreement", id, { 
      signerId: signature.signerId, 
      signerOrganization: signature.organization,
      agreementStatus: agreement.status
    }, req);
    
    res.json({
      success: true,
      data: agreement,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Sign agreement error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to sign agreement",
      noCdsCompliance 
    });
  }
});

const usageLogSchema = z.object({
  agreementId: z.string(),
  datasetId: z.string(),
  userId: z.string(),
  action: z.enum(["access", "download", "query", "export", "analyze"]),
  resourcesAccessed: z.number(),
  queryDetails: z.string().optional(),
  ipAddress: z.string(),
  userAgent: z.string()
});

router.post("/usage-logs", async (req: Request, res: Response) => {
  try {
    const data = usageLogSchema.parse(req.body);
    const log = await aiFHIRDataMonetizationService.logDataUsage(data);
    
    await logAudit("log_data_usage", "DataUsageLog", log.id, { 
      agreementId: data.agreementId, 
      action: data.action,
      complianceFlags: log.complianceFlags
    }, req);
    
    res.status(201).json({
      success: true,
      data: log,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Log usage error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to log usage",
      noCdsCompliance 
    });
  }
});

router.get("/usage-logs/:agreementId", async (req: Request, res: Response) => {
  try {
    const { agreementId } = z.object({ agreementId: z.string() }).parse(req.params);
    const logs = await aiFHIRDataMonetizationService.getUsageLogs(agreementId);
    
    await logAudit("view_usage_logs", "DataUsageLog", agreementId, {}, req);
    
    res.json({
      success: true,
      data: { items: logs, total: logs.length },
      noCdsCompliance
    });
  } catch (error) {
    console.error("[DataMonetization] Get usage logs error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get usage logs",
      noCdsCompliance 
    });
  }
});

const policyEnforcementSchema = z.object({
  userId: z.string(),
  agreementId: z.string(),
  action: z.string()
});

router.post("/enforce-policy", async (req: Request, res: Response) => {
  try {
    const { userId, agreementId, action } = policyEnforcementSchema.parse(req.body);
    const result = await aiFHIRDataMonetizationService.enforcePolicy(userId, agreementId, action);
    
    await logAudit("enforce_policy", "PolicyEnforcement", agreementId, { 
      userId, 
      action,
      allowed: result.allowed,
      violations: result.violations
    }, req);
    
    res.json({
      success: true,
      data: result,
      noCdsCompliance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors, noCdsCompliance });
    }
    console.error("[DataMonetization] Enforce policy error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to enforce policy",
      noCdsCompliance 
    });
  }
});

export default router;
