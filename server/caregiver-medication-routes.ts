import { Router } from "express";
import { caregiverMedicationService } from "./services/caregiver-medication-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").substring(0, 12);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverMedRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.get("/api/caregiver-medication/schedules/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const schedules = caregiverMedicationService.getPatientSchedules(req.params.patientId, caregiverId);
    logHipaaAudit("VIEW_SCHEDULES", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${schedules.length} schedules`);
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("[CaregiverMedication] Get schedules error:", error);
    res.status(500).json({ success: false, error: "Failed to get schedules" });
  }
});

router.post("/api/caregiver-medication/schedules", async (req, res) => {
  try {
    const { patientId, caregiverId, caregiverName, ...scheduleData } = req.body;

    if (!patientId || !caregiverId || !scheduleData.medicationName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const schedule = caregiverMedicationService.createSchedule(patientId, caregiverId, caregiverName || "Caregiver", scheduleData);
    logHipaaAudit("CREATE_SCHEDULE", caregiverId, `Patient:${hashIdentifier(patientId)} - Created schedule for ${scheduleData.medicationName}`);
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("[CaregiverMedication] Create schedule error:", error);
    res.status(500).json({ success: false, error: "Failed to create schedule" });
  }
});

router.patch("/api/caregiver-medication/schedules/:scheduleId", async (req, res) => {
  try {
    const { caregiverId, ...updates } = req.body;

    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId" });
    }

    const schedule = caregiverMedicationService.updateSchedule(req.params.scheduleId, caregiverId, updates);

    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    logHipaaAudit("UPDATE_SCHEDULE", caregiverId, `Schedule:${req.params.scheduleId} - Updated`);
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("[CaregiverMedication] Update schedule error:", error);
    res.status(500).json({ success: false, error: "Failed to update schedule" });
  }
});

router.delete("/api/caregiver-medication/schedules/:scheduleId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;

    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId" });
    }

    const deleted = caregiverMedicationService.deleteSchedule(req.params.scheduleId, caregiverId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    logHipaaAudit("DELETE_SCHEDULE", caregiverId, `Schedule:${req.params.scheduleId} - Deleted`);
    res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    console.error("[CaregiverMedication] Delete schedule error:", error);
    res.status(500).json({ success: false, error: "Failed to delete schedule" });
  }
});

router.get("/api/caregiver-medication/logs/:patientId", async (req, res) => {
  try {
    const { caregiverId, startDate, endDate, medicationId, limit } = req.query;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const logs = caregiverMedicationService.getMedicationLogs(req.params.patientId, caregiverId as string, {
      startDate: startDate as string,
      endDate: endDate as string,
      medicationId: medicationId as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    logHipaaAudit("VIEW_LOGS", caregiverId as string, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${logs.length} logs`);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("[CaregiverMedication] Get logs error:", error);
    res.status(500).json({ success: false, error: "Failed to get logs" });
  }
});

router.post("/api/caregiver-medication/logs", async (req, res) => {
  try {
    const { patientId, caregiverId, caregiverName, ...logData } = req.body;

    if (!patientId || !caregiverId || !logData.medicationId || !logData.status) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const log = caregiverMedicationService.logMedicationIntake(patientId, caregiverId, caregiverName || "Caregiver", logData);
    logHipaaAudit("LOG_INTAKE", caregiverId, `Patient:${hashIdentifier(patientId)} - Logged ${logData.medicationName}: ${logData.status}`);
    res.json({ success: true, data: log });
  } catch (error) {
    console.error("[CaregiverMedication] Log intake error:", error);
    res.status(500).json({ success: false, error: "Failed to log intake" });
  }
});

router.get("/api/caregiver-medication/today/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const todaysMeds = caregiverMedicationService.getTodaysMedications(req.params.patientId, caregiverId);
    logHipaaAudit("VIEW_TODAY_MEDS", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved today's medications`);
    res.json({ success: true, data: todaysMeds });
  } catch (error) {
    console.error("[CaregiverMedication] Get today's meds error:", error);
    res.status(500).json({ success: false, error: "Failed to get today's medications" });
  }
});

router.get("/api/caregiver-medication/refills/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const refills = caregiverMedicationService.getRefillRequests(req.params.patientId, caregiverId);
    logHipaaAudit("VIEW_REFILLS", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${refills.length} refill requests`);
    res.json({ success: true, data: refills });
  } catch (error) {
    console.error("[CaregiverMedication] Get refills error:", error);
    res.status(500).json({ success: false, error: "Failed to get refill requests" });
  }
});

router.post("/api/caregiver-medication/refills", async (req, res) => {
  try {
    const { patientId, caregiverId, caregiverName, ...refillData } = req.body;

    if (!patientId || !caregiverId || !refillData.medicationName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const refill = caregiverMedicationService.createRefillRequest(patientId, caregiverId, caregiverName || "Caregiver", refillData);
    logHipaaAudit("CREATE_REFILL", caregiverId, `Patient:${hashIdentifier(patientId)} - Created refill request for ${refillData.medicationName}`);
    res.json({ success: true, data: refill });
  } catch (error) {
    console.error("[CaregiverMedication] Create refill error:", error);
    res.status(500).json({ success: false, error: "Failed to create refill request" });
  }
});

router.patch("/api/caregiver-medication/refills/:refillId/status", async (req, res) => {
  try {
    const { caregiverId, status, notes } = req.body;

    if (!caregiverId || !status) {
      return res.status(400).json({ success: false, error: "Missing caregiverId or status" });
    }

    const refill = caregiverMedicationService.updateRefillStatus(req.params.refillId, caregiverId, status, notes);

    if (!refill) {
      return res.status(404).json({ success: false, error: "Refill request not found" });
    }

    logHipaaAudit("UPDATE_REFILL", caregiverId, `Refill:${req.params.refillId} - Status changed to ${status}`);
    res.json({ success: true, data: refill });
  } catch (error) {
    console.error("[CaregiverMedication] Update refill error:", error);
    res.status(500).json({ success: false, error: "Failed to update refill status" });
  }
});

router.get("/api/caregiver-medication/interactions/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const analysis = await caregiverMedicationService.checkInteractions(req.params.patientId, caregiverId);
    logHipaaAudit("CHECK_INTERACTIONS", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Interaction check: ${analysis.interactions.length} found`);
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("[CaregiverMedication] Check interactions error:", error);
    res.status(500).json({ success: false, error: "Failed to check interactions" });
  }
});

router.post("/api/caregiver-medication/interactions/check", async (req, res) => {
  try {
    const { patientId, caregiverId, medicationName, dosage } = req.body;

    if (!patientId || !caregiverId || !medicationName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await caregiverMedicationService.checkNewMedicationInteraction(patientId, caregiverId, medicationName, dosage || "");
    logHipaaAudit("CHECK_NEW_MED_INTERACTION", caregiverId, `Patient:${hashIdentifier(patientId)} - Checked ${medicationName}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[CaregiverMedication] Check new med interaction error:", error);
    res.status(500).json({ success: false, error: "Failed to check medication interaction" });
  }
});

router.get("/api/caregiver-medication/warnings/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const warnings = caregiverMedicationService.getActiveWarnings(req.params.patientId, caregiverId);
    logHipaaAudit("VIEW_WARNINGS", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${warnings.length} warnings`);
    res.json({ success: true, data: warnings });
  } catch (error) {
    console.error("[CaregiverMedication] Get warnings error:", error);
    res.status(500).json({ success: false, error: "Failed to get warnings" });
  }
});

router.post("/api/caregiver-medication/warnings/:warningId/acknowledge", async (req, res) => {
  try {
    const { caregiverId } = req.body;

    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId" });
    }

    const warning = caregiverMedicationService.acknowledgeWarning(req.params.warningId, caregiverId);

    if (!warning) {
      return res.status(404).json({ success: false, error: "Warning not found" });
    }

    logHipaaAudit("ACKNOWLEDGE_WARNING", caregiverId, `Warning:${req.params.warningId} - Acknowledged`);
    res.json({ success: true, data: warning });
  } catch (error) {
    console.error("[CaregiverMedication] Acknowledge warning error:", error);
    res.status(500).json({ success: false, error: "Failed to acknowledge warning" });
  }
});

router.get("/api/caregiver-medication/stats/:patientId", async (req, res) => {
  try {
    const { caregiverId, days } = req.query;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }

    const stats = caregiverMedicationService.getAdherenceStats(
      req.params.patientId, 
      caregiverId as string, 
      days ? parseInt(days as string) : 30
    );
    
    logHipaaAudit("VIEW_STATS", caregiverId as string, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved adherence stats`);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[CaregiverMedication] Get stats error:", error);
    res.status(500).json({ success: false, error: "Failed to get adherence stats" });
  }
});

router.post("/api/caregiver-medication/initialize-sample", async (req, res) => {
  try {
    const { patientId, caregiverId } = req.body;

    if (!patientId || !caregiverId) {
      return res.status(400).json({ success: false, error: "Missing patientId or caregiverId" });
    }

    caregiverMedicationService.initializeSampleData(patientId, caregiverId);
    logHipaaAudit("INIT_SAMPLE_DATA", caregiverId, `Patient:${hashIdentifier(patientId)} - Sample data initialized`);
    res.json({ success: true, message: "Sample data initialized" });
  } catch (error) {
    console.error("[CaregiverMedication] Initialize sample error:", error);
    res.status(500).json({ success: false, error: "Failed to initialize sample data" });
  }
});

export function registerCaregiverMedicationRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Caregiver Medication routes registered at /api/caregiver-medication/*");
}
