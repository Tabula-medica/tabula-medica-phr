/**
 * Shareability & Safety Compliance Routes
 * Smart Health Links, Break-Glass Protocol, FHIR Bundle Export
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createSmartHealthLink,
  validateAndAccessLink,
  revokeLink,
  getPatientLinks,
  getLinkById,
  getExpirationOptions,
  getShareableSections,
  generateShareableUrl
} from "../services/smart-health-link-service";
import {
  initiateBreakGlass,
  validateBreakGlassAccess,
  logBreakGlassResourceAccess,
  revokeBreakGlassAccess,
  getPatientBreakGlassHistory,
  getActiveBreakGlassForProvider,
  getEmergencyTypes,
  updatePatientNotificationPreferences
} from "../services/break-glass-service";
import {
  generateFHIRBundle,
  getExportHistory,
  getAvailableResourceTypes,
  validateFHIRCompliance
} from "../services/fhir-bundle-export-service";
import { getPatientJourneyTimeline } from "../services/medical-journey-service";

const router = Router();

const createLinkSchema = z.object({
  patientId: z.string().min(1),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  purpose: z.string().min(1),
  expirationHours: z.number().min(1).max(168),
  maxAccesses: z.number().min(1).max(10),
  includedSections: z.array(z.string()).min(1)
});

const breakGlassSchema = z.object({
  patientId: z.string().min(1),
  providerName: z.string().min(1),
  providerNPI: z.string().optional(),
  providerOrganization: z.string().min(1),
  emergencyReason: z.string().min(10),
  emergencyType: z.enum([
    "life_threatening",
    "urgent_care",
    "critical_medication",
    "surgical_emergency",
    "psychiatric_crisis",
    "other"
  ])
});

const exportBundleSchema = z.object({
  patientId: z.string().min(1),
  includeResources: z.array(z.string()).min(1),
  format: z.enum(["json", "ndjson"]).default("json"),
  purpose: z.string().min(1)
});

router.get("/smart-links/options", async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        expirationOptions: getExpirationOptions(),
        shareableSections: getShareableSections()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/smart-links", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    const validation = createLinkSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request",
        details: validation.error.errors 
      });
    }
    
    const link = createSmartHealthLink({
      ...validation.data,
      createdBy: userId
    });
    
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const shareableUrl = generateShareableUrl(link, baseUrl);
    
    res.json({
      success: true,
      data: {
        id: link.id,
        shareableUrl,
        expiresAt: link.expiresAt,
        maxAccesses: link.maxAccesses,
        includedSections: link.includedSections
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/smart-links/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const links = getPatientLinks(patientId);
    res.json({ success: true, data: links });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/smart-links/:linkId", async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const link = getLinkById(linkId);
    
    if (!link) {
      return res.status(404).json({ success: false, error: "Link not found" });
    }
    
    res.json({ success: true, data: link });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/smart-links/:linkId/access", async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { token } = req.body;
    const accessorIp = req.ip || req.socket.remoteAddress || "unknown";
    const accessorUserAgent = req.get("User-Agent") || "unknown";
    
    const result = validateAndAccessLink(linkId, token, accessorIp, accessorUserAgent);
    
    if (!result.valid) {
      return res.status(403).json({ 
        success: false, 
        error: result.reason 
      });
    }
    
    const timeline = await getPatientJourneyTimeline(
      result.link!.patientId,
      "shared_access",
      undefined
    );
    
    const filteredData: any = { patientId: result.link!.patientId };
    const sections = result.link!.includedSections;
    
    if (sections.includes("summary")) {
      filteredData.summary = timeline.summary;
    }
    if (sections.includes("vitals")) {
      filteredData.vitals = timeline.vitalsTracking;
    }
    if (sections.includes("medications")) {
      filteredData.medications = timeline.medicationAdherence;
    }
    if (sections.includes("conditions")) {
      filteredData.conditions = timeline.conditions;
    }
    if (sections.includes("timeline")) {
      filteredData.events = timeline.events;
    }
    if (sections.includes("landmarks")) {
      filteredData.landmarks = timeline.landmarks;
    }
    
    res.json({
      success: true,
      data: {
        ...filteredData,
        accessInfo: {
          expiresAt: result.link!.expiresAt,
          accessNumber: result.link!.accessCount,
          maxAccesses: result.link!.maxAccesses
        },
        disclaimer: "This information is for reference only and does not constitute clinical decision support (NO-CDS). Always consult with healthcare providers for medical decisions."
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/smart-links/:linkId", async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    
    const success = revokeLink(linkId, userId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: "Link not found" });
    }
    
    res.json({ success: true, message: "Link revoked successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/break-glass/emergency-types", async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: getEmergencyTypes()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/break-glass/initiate", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    const validation = breakGlassSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.errors
      });
    }
    
    const request = initiateBreakGlass(
      validation.data.patientId,
      {
        requestedBy: userId,
        providerName: validation.data.providerName,
        providerNPI: validation.data.providerNPI,
        providerOrganization: validation.data.providerOrganization
      },
      validation.data.emergencyReason,
      validation.data.emergencyType
    );
    
    res.json({
      success: true,
      data: {
        breakGlassId: request.id,
        auditTrailId: request.auditTrailId,
        expiresAt: request.expiresAt,
        status: request.status,
        notificationsSent: request.patientNotifications.length,
        warning: "This access is being recorded and the patient has been notified. Misuse may result in legal consequences."
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/break-glass/:breakGlassId/validate", async (req: Request, res: Response) => {
  try {
    const { breakGlassId } = req.params;
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    
    const result = validateBreakGlassAccess(breakGlassId, userId);
    
    if (!result.authorized) {
      return res.status(403).json({
        success: false,
        error: result.reason
      });
    }
    
    res.json({
      success: true,
      data: {
        authorized: true,
        breakGlassId: result.breakGlassId,
        expiresAt: result.expiresAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/break-glass/:breakGlassId/access-record", async (req: Request, res: Response) => {
  try {
    const { breakGlassId } = req.params;
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    
    const validationResult = validateBreakGlassAccess(breakGlassId, userId);
    
    if (!validationResult.authorized) {
      return res.status(403).json({
        success: false,
        error: validationResult.reason
      });
    }
    
    const patientId = req.body.patientId;
    const timeline = await getPatientJourneyTimeline(patientId, userId, undefined);
    
    logBreakGlassResourceAccess(breakGlassId, "PatientJourney", patientId, "read");
    
    res.json({
      success: true,
      data: {
        ...timeline,
        breakGlassInfo: {
          breakGlassId,
          expiresAt: validationResult.expiresAt,
          accessLogged: true
        },
        disclaimer: "BREAK-GLASS ACCESS: This emergency access is being audited. Patient has been notified. This information is for reference only (NO-CDS)."
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/break-glass/:breakGlassId", async (req: Request, res: Response) => {
  try {
    const { breakGlassId } = req.params;
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    
    const success = revokeBreakGlassAccess(breakGlassId, userId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: "Break-glass request not found" });
    }
    
    res.json({ success: true, message: "Break-glass access revoked by patient" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/break-glass/patient/:patientId/history", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const history = getPatientBreakGlassHistory(patientId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/break-glass/provider/active", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || (req as any).user?.id || "anonymous";
    const active = getActiveBreakGlassForProvider(userId);
    res.json({ success: true, data: active });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/break-glass/patient/:patientId/notification-preferences", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { phone, email, allowSms, allowEmail } = req.body;
    
    updatePatientNotificationPreferences(patientId, {
      phone,
      email,
      allowSms: allowSms ?? true,
      allowEmail: allowEmail ?? true
    });
    
    res.json({ success: true, message: "Notification preferences updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/fhir-export/resource-types", async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: getAvailableResourceTypes()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/fhir-export/generate", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || (req as any).user?.id || "anonymous";
    const validation = exportBundleSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.errors
      });
    }
    
    const result = generateFHIRBundle({
      ...validation.data,
      requestedBy: userId
    });
    
    const complianceCheck = validateFHIRCompliance(result.bundle);
    
    res.json({
      success: true,
      data: {
        bundle: result.bundle,
        exportId: result.exportId,
        resourceCounts: result.resourceCounts,
        exportedAt: result.exportedAt,
        sizeBytes: result.sizeBytes,
        compliance: complianceCheck,
        portabilityNote: "This FHIR R4 bundle is compliant with US Core profiles and can be imported by any FHIR-enabled healthcare system."
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/fhir-export/patient/:patientId/history", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const history = getExportHistory(patientId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/fhir-export/validate", async (req: Request, res: Response) => {
  try {
    const { bundle } = req.body;
    
    if (!bundle) {
      return res.status(400).json({ success: false, error: "Bundle is required" });
    }
    
    const result = validateFHIRCompliance(bundle);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

export function registerShareabilitySafetyRoutes(app: any): void {
  app.use("/api/shareability", router);
  console.log("[Routes] Shareability & Safety routes registered at /api/shareability/*");
  console.log("[Routes] - Smart Health Links at /api/shareability/smart-links/*");
  console.log("[Routes] - Break-Glass Protocol at /api/shareability/break-glass/*");
  console.log("[Routes] - FHIR Export at /api/shareability/fhir-export/*");
}
