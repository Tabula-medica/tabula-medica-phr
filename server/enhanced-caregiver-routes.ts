import { Router } from "express";
import * as caregiverService from "./services/enhanced-caregiver-access-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.get("/api/caregiver-access/roles", async (req, res) => {
  try {
    const roles = caregiverService.getSupportedRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error("[CaregiverAccess] Get roles error:", error);
    res.status(500).json({ success: false, error: "Failed to get roles" });
  }
});

router.get("/api/caregiver-access/access-levels", async (req, res) => {
  try {
    const levels = caregiverService.getSupportedAccessLevels();
    res.json({ success: true, data: levels });
  } catch (error) {
    console.error("[CaregiverAccess] Get access levels error:", error);
    res.status(500).json({ success: false, error: "Failed to get access levels" });
  }
});

router.post("/api/caregiver-access/grant", async (req, res) => {
  try {
    const { patientId, patientName, caregiver, role, accessLevel, customPermissions, expiresAt } = req.body;

    if (!patientId || !caregiver || !role || !accessLevel) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: patientId, caregiver, role, accessLevel",
      });
    }

    logHipaaAudit("GRANT_ACCESS", caregiver.caregiverId, `Granting ${accessLevel} access to patient ${hashIdentifier(patientId)}`);

    const access = await caregiverService.grantCaregiverAccess(
      patientId,
      patientName || "Patient",
      caregiver,
      role,
      accessLevel,
      customPermissions,
      expiresAt
    );

    res.json({ success: true, data: access });
  } catch (error) {
    console.error("[CaregiverAccess] Grant access error:", error);
    res.status(500).json({ success: false, error: "Failed to grant access" });
  }
});

router.get("/api/caregiver-access/:accessId", async (req, res) => {
  try {
    const access = caregiverService.getCaregiverAccess(req.params.accessId);
    if (!access) {
      return res.status(404).json({ success: false, error: "Access record not found" });
    }
    res.json({ success: true, data: access });
  } catch (error) {
    console.error("[CaregiverAccess] Get access error:", error);
    res.status(500).json({ success: false, error: "Failed to get access record" });
  }
});

router.get("/api/caregiver-access/patient/:patientId/caregivers", async (req, res) => {
  try {
    const caregivers = caregiverService.getPatientCaregivers(req.params.patientId);
    logHipaaAudit("VIEW_CAREGIVERS", req.params.patientId, `Retrieved ${caregivers.length} caregivers`);
    res.json({ success: true, data: caregivers });
  } catch (error) {
    console.error("[CaregiverAccess] Get patient caregivers error:", error);
    res.status(500).json({ success: false, error: "Failed to get caregivers" });
  }
});

router.get("/api/caregiver-access/caregiver/:caregiverId/patients", async (req, res) => {
  try {
    const patients = caregiverService.getCaregiverPatients(req.params.caregiverId);
    logHipaaAudit("VIEW_PATIENTS", req.params.caregiverId, `Retrieved ${patients.length} patients`);
    res.json({ success: true, data: patients });
  } catch (error) {
    console.error("[CaregiverAccess] Get caregiver patients error:", error);
    res.status(500).json({ success: false, error: "Failed to get patients" });
  }
});

router.patch("/api/caregiver-access/:accessId/permissions", async (req, res) => {
  try {
    const { caregiverId, permissions } = req.body;

    if (!caregiverId || !permissions) {
      return res.status(400).json({ success: false, error: "Missing caregiverId or permissions" });
    }

    const access = caregiverService.updateCaregiverPermissions(
      req.params.accessId,
      caregiverId,
      permissions
    );

    if (!access) {
      return res.status(404).json({ success: false, error: "Access record not found" });
    }

    logHipaaAudit("UPDATE_PERMISSIONS", caregiverId, `Updated permissions for access ${req.params.accessId}`);
    res.json({ success: true, data: access });
  } catch (error) {
    console.error("[CaregiverAccess] Update permissions error:", error);
    res.status(500).json({ success: false, error: "Failed to update permissions" });
  }
});

router.post("/api/caregiver-access/:accessId/revoke", async (req, res) => {
  try {
    const { revokedBy, reason } = req.body;

    if (!revokedBy) {
      return res.status(400).json({ success: false, error: "Missing revokedBy" });
    }

    const success = caregiverService.revokeCaregiverAccess(req.params.accessId, revokedBy, reason);

    if (!success) {
      return res.status(404).json({ success: false, error: "Access record not found" });
    }

    logHipaaAudit("REVOKE_ACCESS", revokedBy, `Revoked access ${req.params.accessId}: ${reason || "No reason"}`);
    res.json({ success: true, message: "Access revoked" });
  } catch (error) {
    console.error("[CaregiverAccess] Revoke access error:", error);
    res.status(500).json({ success: false, error: "Failed to revoke access" });
  }
});

router.post("/api/caregiver-access/invitation", async (req, res) => {
  try {
    const { patientId, patientName, inviteeEmail, inviteeName, role, accessLevel } = req.body;

    if (!patientId || !inviteeEmail || !inviteeName || !role || !accessLevel) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const invitation = await caregiverService.createInvitation(
      patientId,
      patientName || "Patient",
      inviteeEmail,
      inviteeName,
      role,
      accessLevel
    );

    logHipaaAudit("CREATE_INVITATION", patientId, `Invitation created for ${inviteeEmail}`);
    res.json({ success: true, data: invitation });
  } catch (error) {
    console.error("[CaregiverAccess] Create invitation error:", error);
    res.status(500).json({ success: false, error: "Failed to create invitation" });
  }
});

router.get("/api/caregiver-access/invitation/:invitationId", async (req, res) => {
  try {
    const invitation = caregiverService.getInvitation(req.params.invitationId);
    if (!invitation) {
      return res.status(404).json({ success: false, error: "Invitation not found" });
    }
    res.json({ success: true, data: invitation });
  } catch (error) {
    console.error("[CaregiverAccess] Get invitation error:", error);
    res.status(500).json({ success: false, error: "Failed to get invitation" });
  }
});

router.post("/api/caregiver-access/invitation/accept", async (req, res) => {
  try {
    const { invitationCode, caregiverId } = req.body;

    if (!invitationCode || !caregiverId) {
      return res.status(400).json({ success: false, error: "Missing invitationCode or caregiverId" });
    }

    const access = await caregiverService.acceptInvitation(invitationCode, caregiverId);

    if (!access) {
      return res.status(400).json({ success: false, error: "Invalid or expired invitation" });
    }

    logHipaaAudit("ACCEPT_INVITATION", caregiverId, `Accepted invitation for patient ${hashIdentifier(access.patientId)}`);
    res.json({ success: true, data: access });
  } catch (error) {
    console.error("[CaregiverAccess] Accept invitation error:", error);
    res.status(500).json({ success: false, error: "Failed to accept invitation" });
  }
});

router.post("/api/caregiver-access/care-note", async (req, res) => {
  try {
    const { caregiverId, patientId, noteType, content, severity, sharedWithCareTeam } = req.body;

    if (!caregiverId || !patientId || !noteType || !content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: caregiverId, patientId, noteType, content",
      });
    }

    const note = await caregiverService.addCareNote(
      caregiverId,
      patientId,
      noteType,
      content,
      severity,
      sharedWithCareTeam
    );

    logHipaaAudit("ADD_CARE_NOTE", caregiverId, `Added ${noteType} note for patient ${hashIdentifier(patientId)}`);
    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[CaregiverAccess] Add care note error:", error);
    res.status(500).json({ success: false, error: "Failed to add care note" });
  }
});

router.get("/api/caregiver-access/care-notes/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string | undefined;
    const notes = caregiverService.getPatientCareNotes(req.params.patientId, caregiverId);

    logHipaaAudit("VIEW_CARE_NOTES", req.params.patientId, `Retrieved ${notes.length} care notes`);
    res.json({ success: true, data: notes });
  } catch (error) {
    console.error("[CaregiverAccess] Get care notes error:", error);
    res.status(500).json({ success: false, error: "Failed to get care notes" });
  }
});

router.post("/api/caregiver-access/:accessId/log-action", async (req, res) => {
  try {
    const { action, details, resourceType, resourceId } = req.body;

    if (!action || !details) {
      return res.status(400).json({ success: false, error: "Missing action or details" });
    }

    caregiverService.logCaregiverAction(req.params.accessId, action, details, resourceType, resourceId);
    res.json({ success: true, message: "Action logged" });
  } catch (error) {
    console.error("[CaregiverAccess] Log action error:", error);
    res.status(500).json({ success: false, error: "Failed to log action" });
  }
});

router.get("/api/caregiver-access/:accessId/audit-log", async (req, res) => {
  try {
    const auditLog = caregiverService.getCaregiverAuditLog(req.params.accessId);
    res.json({ success: true, data: auditLog });
  } catch (error) {
    console.error("[CaregiverAccess] Get audit log error:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

router.post("/api/caregiver-access/:accessId/check-permission", async (req, res) => {
  try {
    const { category, action } = req.body;

    if (!category || !action) {
      return res.status(400).json({ success: false, error: "Missing category or action" });
    }

    const hasPermission = caregiverService.checkPermission(req.params.accessId, category, action);
    res.json({ success: true, data: { hasPermission, category, action } });
  } catch (error) {
    console.error("[CaregiverAccess] Check permission error:", error);
    res.status(500).json({ success: false, error: "Failed to check permission" });
  }
});

export function registerEnhancedCaregiverRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Enhanced Caregiver Access routes registered at /api/caregiver-access/*");
}

export default router;
