import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";
import { 
  insertConsentDocumentSchema, 
  insertUserConsentRecordSchema,
  insertConsentAnalyticsRecordSchema,
  consentDocumentTypes,
  type ConsentDocumentType,
} from "@shared/schema";

const router = Router();

function getUser(req: Request): { id: string; role?: string } | undefined {
  const user = (req as any).user;
  if (user?.id) {
    return { id: user.id, role: user.role || "patient" };
  }
  const session = (req as any).session;
  if (session?.userId) {
    return { id: session.userId, role: session.userRole || "patient" };
  }
  return undefined;
}

function requireAuth(req: Request, res: Response, next: () => void) {
  const user = getUser(req);
  if (!user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  (req as any).authUser = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getUser(req);
  if (!user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  (req as any).authUser = user;
  next();
}

async function seedDefaultConsentDocuments() {
  const existingDocs = await storage.getConsentDocuments({ isActive: true });
  if (existingDocs.length > 0) {
    console.log("[ConsentRoutes] Default consent documents already exist");
    return;
  }

  const now = new Date().toISOString();
  const defaultDocs = [
    {
      type: "privacy_policy" as const,
      version: "1.0.0",
      title: "Privacy Policy",
      summary: "This policy explains how Tabula Medica collects, uses, and protects your personal and health information in compliance with HIPAA and applicable privacy laws.",
      content: `# Privacy Policy v1.0.0

## Introduction
Tabula Medica ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our patient health record application.

## Information We Collect
- **Personal Information**: Name, email, date of birth, contact information
- **Health Information**: Medical records, lab results, medications, allergies, and other Protected Health Information (PHI)
- **Usage Data**: How you interact with the application

## How We Use Your Information
- To provide and maintain our services
- To process your health records from connected providers
- To provide AI-powered health insights and explanations
- To communicate with you about your health data

## Data Protection
- All data is encrypted at rest and in transit using AES-256-GCM
- We maintain strict access controls and audit logging
- We comply with HIPAA and applicable privacy regulations

## Your Rights
- Access your personal data
- Request correction of inaccurate data
- Request deletion of your data
- Withdraw consent at any time

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: true,
      isActive: true,
    },
    {
      type: "terms_of_service" as const,
      version: "1.0.0",
      title: "Terms of Service",
      summary: "By using Tabula Medica, you agree to these terms which govern your use of our platform and services.",
      content: `# Terms of Service v1.0.0

## Acceptance of Terms
By accessing or using Tabula Medica, you agree to be bound by these Terms of Service.

## Description of Service
Tabula Medica provides a platform to centralize and access your health records from various healthcare providers.

## User Responsibilities
- Provide accurate information
- Maintain the security of your account
- Use the service for lawful purposes only

## Medical Disclaimer
Tabula Medica is not a healthcare provider. The information provided is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.

## Limitation of Liability
We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.

## Changes to Terms
We may modify these terms at any time. Continued use after changes constitutes acceptance.

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: true,
      isActive: true,
    },
    {
      type: "hipaa_notice" as const,
      version: "1.0.0",
      title: "HIPAA Notice of Privacy Practices",
      summary: "This notice describes how your health information may be used and disclosed, and how you can access this information.",
      content: `# HIPAA Notice of Privacy Practices v1.0.0

## Your Rights Under HIPAA

As a user of Tabula Medica, you have certain rights regarding your Protected Health Information (PHI):

### Right to Access
You have the right to inspect and obtain a copy of your PHI maintained by us.

### Right to Amend
You may request amendments to your PHI if you believe it is incorrect or incomplete.

### Right to an Accounting of Disclosures
You may request a list of instances where we have disclosed your PHI.

### Right to Request Restrictions
You may request restrictions on certain uses and disclosures of your PHI.

### Right to Confidential Communications
You may request that we communicate with you through alternative means or locations.

## How We May Use Your PHI
- For treatment purposes
- For payment operations
- For healthcare operations
- With your authorization

## Our Responsibilities
- Maintain the privacy and security of your PHI
- Notify you if a breach occurs
- Follow the terms of this notice

## Contact Information
For questions about this notice, please contact our Privacy Officer.

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: true,
      isActive: true,
    },
    {
      type: "data_processing_agreement" as const,
      version: "1.0.0",
      title: "Data Processing Agreement",
      summary: "This agreement explains how your health data is processed, stored, and protected within our platform.",
      content: `# Data Processing Agreement v1.0.0

## Purpose
This agreement outlines how Tabula Medica processes your health data.

## Data Processing Activities
- Collection of health records from connected EHR systems
- Storage in encrypted databases
- AI analysis for insights and recommendations
- Display in the patient portal

## Data Security Measures
- TLS 1.2+ for data in transit
- AES-256-GCM encryption at rest
- Role-based access controls
- Comprehensive audit logging

## Data Retention
Your data is retained as long as your account is active. You may request deletion at any time.

## Your Consent
By accepting this agreement, you consent to the processing activities described herein.

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: true,
      isActive: true,
    },
    {
      type: "research_consent" as const,
      version: "1.0.0",
      title: "Research Participation Consent",
      summary: "Optional consent to contribute de-identified health data to medical research studies.",
      content: `# Research Participation Consent v1.0.0

## Overview
You may optionally contribute your de-identified health data to medical research.

## De-identification Process
All personal identifiers are removed before data is used for research:
- Names and contact information
- Social Security numbers
- Medical record numbers
- Dates (except year)
- Geographic information smaller than state

## How Your Data May Be Used
- Academic research studies
- Public health initiatives
- Healthcare quality improvement

## Your Rights
- This consent is completely optional
- You may withdraw at any time
- Withdrawal does not affect your access to Tabula Medica

## Benefits
Your contribution may help advance medical knowledge and improve healthcare for future patients.

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: false,
      isActive: true,
    },
    {
      type: "marketing_consent" as const,
      version: "1.0.0",
      title: "Marketing Communications",
      summary: "Optional consent to receive promotional communications about Tabula Medica features and health tips.",
      content: `# Marketing Communications Consent v1.0.0

## Purpose
We would like to send you occasional communications about:
- New features and updates
- Health and wellness tips
- Special offers and promotions

## Communication Methods
- Email newsletters
- In-app notifications
- Push notifications (if enabled)

## Your Control
- This consent is optional
- You can unsubscribe at any time
- You can manage your preferences in settings

## Frequency
We limit marketing communications to no more than once per week.

Last updated: ${now}`,
      effectiveDate: now,
      isRequired: false,
      isActive: true,
    },
  ];

  for (const doc of defaultDocs) {
    await storage.createConsentDocument(doc);
  }
  console.log("[ConsentRoutes] Default consent documents seeded");
}

seedDefaultConsentDocuments().catch(console.error);

router.get("/documents", async (req: Request, res: Response) => {
  try {
    const { type, isActive } = req.query;
    
    const filters: { type?: ConsentDocumentType; isActive?: boolean } = {};
    if (type && consentDocumentTypes.includes(type as ConsentDocumentType)) {
      filters.type = type as ConsentDocumentType;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }
    
    const documents = await storage.getConsentDocuments(filters);
    res.json(documents);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch consent documents" });
  }
});

router.get("/documents/active", async (req: Request, res: Response) => {
  try {
    const documents = await storage.getConsentDocuments({ isActive: true });
    
    const session = getSession(req);
    if (session?.userId) {
      for (const doc of documents) {
        await storage.createConsentAnalyticsRecord({
          userId: authUser.id,
          documentId: doc.id,
          documentType: doc.type,
          documentVersion: doc.version,
          event: "consent_viewed",
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }
    }
    
    res.json(documents);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching active documents:", error);
    res.status(500).json({ error: "Failed to fetch active consent documents" });
  }
});

router.get("/documents/:id", async (req: Request, res: Response) => {
  try {
    const document = await storage.getConsentDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    const session = getSession(req);
    if (session?.userId) {
      await storage.createConsentAnalyticsRecord({
        userId: authUser.id,
        documentId: document.id,
        documentType: document.type,
        documentVersion: document.version,
        event: "consent_viewed",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }
    
    res.json(document);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching document:", error);
    res.status(500).json({ error: "Failed to fetch consent document" });
  }
});

router.get("/documents/:type/versions", async (req: Request, res: Response) => {
  try {
    const type = req.params.type as ConsentDocumentType;
    if (!consentDocumentTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid document type" });
    }
    
    const versions = await storage.getConsentDocumentVersions(type);
    res.json(versions);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching versions:", error);
    res.status(500).json({ error: "Failed to fetch document versions" });
  }
});

router.post("/documents", requireAdmin, async (req: Request, res: Response) => {
  try {
    const validationResult = insertConsentDocumentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const authUser = (req as any).authUser as { id: string; role?: string };
    const document = await storage.createConsentDocument(validationResult.data);
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "ConsentDocument",
      action: "write",
      details: `Created consent document: ${document.type} v${document.version}`,
    });
    
    res.status(201).json(document);
  } catch (error) {
    console.error("[ConsentRoutes] Error creating document:", error);
    res.status(500).json({ error: "Failed to create consent document" });
  }
});

router.put("/documents/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const document = await storage.getConsentDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    const authUser = (req as any).authUser as { id: string; role?: string };
    const updated = await storage.updateConsentDocument(req.params.id, req.body);
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "ConsentDocument",
      action: "write",
      details: `Updated consent document: ${document.type} v${document.version}`,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("[ConsentRoutes] Error updating document:", error);
    res.status(500).json({ error: "Failed to update consent document" });
  }
});

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as { id: string; role?: string };
    const status = await storage.getUserConsentStatus(authUser.id);
    res.json(status);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching consent status:", error);
    res.status(500).json({ error: "Failed to fetch consent status" });
  }
});

router.get("/check-required", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as { id: string; role?: string };
    const result = await storage.checkRequiredConsents(authUser.id);
    res.json(result);
  } catch (error) {
    console.error("[ConsentRoutes] Error checking required consents:", error);
    res.status(500).json({ error: "Failed to check required consents" });
  }
});

router.get("/records", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as { id: string; role?: string };
    const records = await storage.getUserConsentRecords(authUser.id);
    res.json(records);
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching consent records:", error);
    res.status(500).json({ error: "Failed to fetch consent records" });
  }
});

const acceptConsentSchema = z.object({
  documentId: z.string().min(1),
  method: z.enum(["click", "signature", "verbal", "written"]).default("click"),
  expiresAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/accept", requireAuth, async (req: Request, res: Response) => {
  try {
    const validationResult = acceptConsentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { documentId, method, expiresAt, metadata } = validationResult.data;
    const authUser = (req as any).authUser as { id: string; role?: string };
    
    const document = await storage.getConsentDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Consent document not found" });
    }
    
    if (!document.isActive) {
      return res.status(400).json({ error: "This consent document version is no longer active" });
    }
    
    const now = new Date().toISOString();
    const record = await storage.createUserConsentRecord({
      userId: authUser.id,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      status: "accepted",
      acceptedAt: now,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      method,
      metadata,
    });
    
    await storage.createConsentAnalyticsRecord({
      userId: authUser.id,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      event: "consent_accepted",
      metadata: { method },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "UserConsentRecord",
      action: "write",
      details: `Accepted consent: ${document.type} v${document.version}`,
    });
    
    res.status(201).json(record);
  } catch (error) {
    console.error("[ConsentRoutes] Error accepting consent:", error);
    res.status(500).json({ error: "Failed to accept consent" });
  }
});

const acceptBatchSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
  method: z.enum(["click", "signature", "verbal", "written"]).default("click"),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/accept-batch", requireAuth, async (req: Request, res: Response) => {
  try {
    const validationResult = acceptBatchSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { documentIds, method, metadata } = validationResult.data;
    const authUser = (req as any).authUser as { id: string; role?: string };
    const now = new Date().toISOString();
    const records = [];
    
    for (const documentId of documentIds) {
      const document = await storage.getConsentDocument(documentId);
      if (!document || !document.isActive) continue;
      
      const record = await storage.createUserConsentRecord({
        userId: authUser.id,
        documentId: document.id,
        documentType: document.type,
        documentVersion: document.version,
        status: "accepted",
        acceptedAt: now,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        method,
        metadata,
      });
      records.push(record);
      
      await storage.createConsentAnalyticsRecord({
        userId: authUser.id,
        documentId: document.id,
        documentType: document.type,
        documentVersion: document.version,
        event: "consent_accepted",
        metadata: { method, batch: true },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "UserConsentRecord",
      action: "write",
      details: `Batch accepted ${records.length} consents`,
    });
    
    const status = await storage.getUserConsentStatus(authUser.id);
    res.status(201).json({ records, status });
  } catch (error) {
    console.error("[ConsentRoutes] Error batch accepting consents:", error);
    res.status(500).json({ error: "Failed to accept consents" });
  }
});

const declineConsentSchema = z.object({
  documentId: z.string().min(1),
  reason: z.string().optional(),
});

router.post("/decline", requireAuth, async (req: Request, res: Response) => {
  try {
    const validationResult = declineConsentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { documentId, reason } = validationResult.data;
    const authUser = (req as any).authUser as { id: string; role?: string };
    
    const document = await storage.getConsentDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Consent document not found" });
    }
    
    if (document.isRequired) {
      return res.status(400).json({ 
        error: "Cannot decline required consent",
        message: "This consent is required to use the application. You may choose not to proceed instead."
      });
    }
    
    const now = new Date().toISOString();
    const record = await storage.createUserConsentRecord({
      userId: authUser.id,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      status: "declined",
      declinedAt: now,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      method: "click",
      metadata: reason ? { reason } : undefined,
    });
    
    await storage.createConsentAnalyticsRecord({
      userId: authUser.id,
      documentId: document.id,
      documentType: document.type,
      documentVersion: document.version,
      event: "consent_declined",
      metadata: { reason },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "UserConsentRecord",
      action: "write",
      details: `Declined consent: ${document.type} v${document.version}`,
    });
    
    res.status(201).json(record);
  } catch (error) {
    console.error("[ConsentRoutes] Error declining consent:", error);
    res.status(500).json({ error: "Failed to decline consent" });
  }
});

router.post("/withdraw/:recordId", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as { id: string; role?: string };
    
    const record = await storage.getUserConsentRecord(req.params.recordId);
    if (!record) {
      return res.status(404).json({ error: "Consent record not found" });
    }
    
    if (record.userId !== authUser.id) {
      return res.status(403).json({ error: "Not authorized to withdraw this consent" });
    }
    
    if (record.status !== "accepted") {
      return res.status(400).json({ error: "Only accepted consents can be withdrawn" });
    }
    
    const document = await storage.getConsentDocument(record.documentId);
    if (document?.isRequired) {
      return res.status(400).json({ 
        error: "Cannot withdraw required consent",
        message: "Withdrawing this consent will disable your access to the application."
      });
    }
    
    const updated = await storage.withdrawUserConsent(req.params.recordId);
    
    await storage.createConsentAnalyticsRecord({
      userId: authUser.id,
      documentId: record.documentId,
      documentType: record.documentType,
      documentVersion: record.documentVersion,
      event: "consent_withdrawn",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    
    await logPhiAccess({
      userId: authUser.id,
      resourceType: "UserConsentRecord",
      action: "write",
      details: `Withdrew consent: ${record.documentType} v${record.documentVersion}`,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("[ConsentRoutes] Error withdrawing consent:", error);
    res.status(500).json({ error: "Failed to withdraw consent" });
  }
});

router.get("/analytics", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { documentType, event, startDate, endDate } = req.query;
    
    const filters: {
      documentType?: ConsentDocumentType;
      event?: any;
      startDate?: string;
      endDate?: string;
    } = {};
    
    if (documentType && consentDocumentTypes.includes(documentType as ConsentDocumentType)) {
      filters.documentType = documentType as ConsentDocumentType;
    }
    if (event) filters.event = event as any;
    if (startDate && typeof startDate === "string") filters.startDate = startDate;
    if (endDate && typeof endDate === "string") filters.endDate = endDate;
    
    const analytics = await storage.getConsentAnalytics(filters);
    
    const summary = {
      total: analytics.length,
      byEvent: {} as Record<string, number>,
      byDocumentType: {} as Record<string, number>,
    };
    
    for (const record of analytics) {
      summary.byEvent[record.event] = (summary.byEvent[record.event] || 0) + 1;
      summary.byDocumentType[record.documentType] = (summary.byDocumentType[record.documentType] || 0) + 1;
    }
    
    res.json({ analytics, summary });
  } catch (error) {
    console.error("[ConsentRoutes] Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch consent analytics" });
  }
});

export function registerConsentRoutes(app: Router) {
  app.use("/api/consent", router);
  console.log("[Routes] Consent management routes registered at /api/consent/*");
}

export default router;
