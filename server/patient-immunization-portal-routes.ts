import { Router } from "express";
import { patientImmunizationPortalService } from "./services/patient-immunization-portal-service";
import { insertIISConsentSchema, insertPatientPortalMessageSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.get("/summary", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const result = await patientImmunizationPortalService.getPortalSummary(patientId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching portal summary:", error);
    res.status(500).json({ error: "Failed to fetch portal summary" });
  }
});

router.get("/immunizations", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const result = await patientImmunizationPortalService.getPatientImmunizations(patientId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching immunizations:", error);
    res.status(500).json({ error: "Failed to fetch immunization records" });
  }
});

router.get("/iis-connections", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const result = await patientImmunizationPortalService.getIISConnections(patientId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching IIS connections:", error);
    res.status(500).json({ error: "Failed to fetch IIS connection status" });
  }
});

router.get("/consents", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const result = await patientImmunizationPortalService.getPatientConsents(patientId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching consents:", error);
    res.status(500).json({ error: "Failed to fetch consent records" });
  }
});

router.post("/consents", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);

    const validation = insertIISConsentSchema.safeParse({
      ...req.body,
      patientId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid consent data", 
        details: validation.error.errors 
      });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || 
                      req.socket?.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";

    const result = await patientImmunizationPortalService.grantConsent(
      patientId,
      validation.data,
      ipAddress,
      userAgent
    );
    res.status(201).json(result);
  } catch (error) {
    console.error("Error granting consent:", error);
    res.status(500).json({ error: "Failed to grant consent" });
  }
});

router.post("/consents/:consentId/revoke", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const { consentId } = req.params;
    const { reason } = req.body;

    const result = await patientImmunizationPortalService.revokeConsent(
      patientId,
      consentId,
      reason
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error revoking consent:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to revoke consent" });
  }
});

router.get("/messages", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const status = req.query.status as string | undefined;
    
    const result = await patientImmunizationPortalService.getPatientMessages(patientId, status);
    res.json(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/messages/:messageId/read", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const { messageId } = req.params;

    const result = await patientImmunizationPortalService.markMessageAsRead(patientId, messageId);
    res.json(result);
  } catch (error: any) {
    console.error("Error marking message as read:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

router.post("/messages/:messageId/archive", requireUser, async (req, res) => {
  try {
    const patientId = getUserId(req);
    const { messageId } = req.params;

    const result = await patientImmunizationPortalService.archiveMessage(patientId, messageId);
    res.json(result);
  } catch (error: any) {
    console.error("Error archiving message:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to archive message" });
  }
});

router.post("/messages", requireUser, async (req, res) => {
  try {
    const validation = insertPatientPortalMessageSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid message data",
        details: validation.error.errors
      });
    }

    const result = await patientImmunizationPortalService.sendMessageFromClinician(validation.data);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/messages/send", requireUser, async (req, res) => {
  try {
    const validation = insertPatientPortalMessageSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid message data", 
        details: validation.error.errors 
      });
    }

    const result = await patientImmunizationPortalService.sendMessageFromClinician(validation.data);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/access-link", requireUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const patientId = req.body.patientId || userId;
    const { purpose, maxUses, expiresInHours } = req.body;

    const result = await patientImmunizationPortalService.generateSecureAccessLink(
      patientId,
      purpose || "one_time_access",
      userId,
      maxUses || 1,
      expiresInHours || 24
    );
    res.json(result);
  } catch (error) {
    console.error("Error generating access link:", error);
    res.status(500).json({ error: "Failed to generate access link" });
  }
});

router.post("/validate-token", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const result = await patientImmunizationPortalService.validateAccessToken(token);
    
    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error validating token:", error);
    res.status(500).json({ error: "Failed to validate token" });
  }
});

export default router;
