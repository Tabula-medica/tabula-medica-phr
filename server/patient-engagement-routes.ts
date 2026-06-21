import { Router, Request, Response } from "express";
import { appointmentManagementService } from "./services/appointment-management";
import { remotePatientMonitoringService } from "./services/remote-patient-monitoring";
import { 
  insertPatientAppointmentSchema,
  rescheduleAppointmentSchema,
  insertRemoteVitalSubmissionSchema,
  insertHealthStatusUpdateSchema
} from "@shared/schema";
import { logger } from "./lib/logger";

export const patientEngagementRouter = Router();

// ============================================
// APPOINTMENT MANAGEMENT ENDPOINTS
// ============================================

patientEngagementRouter.get("/appointments/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status, upcoming, past } = req.query;

    const statusFilter = status ? (status as string).split(",") : undefined;
    
    const appointments = appointmentManagementService.getPatientAppointments(patientId, {
      status: statusFilter,
      upcoming: upcoming === "true",
      past: past === "true"
    });

    logger.info({ component: "PatientEngagement", audit: "HIPAA", action: "list_appointments", patientId }, "appointments accessed");
    res.json({ appointments, total: appointments.length });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_appointments" }, "error fetching appointments");
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

patientEngagementRouter.get("/appointments/:patientId/:appointmentId", (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const appointment = appointmentManagementService.getAppointmentById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ appointment });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_appointment" }, "error fetching appointment");
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

patientEngagementRouter.post("/appointments", (req: Request, res: Response) => {
  try {
    const parsed = insertPatientAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid appointment data", details: parsed.error.errors });
    }

    const appointment = appointmentManagementService.createAppointment(parsed.data);
    res.status(201).json({ appointment, message: "Appointment scheduled successfully" });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "create_appointment" }, "error creating appointment");
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

patientEngagementRouter.post("/appointments/:appointmentId/reschedule", (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { newScheduledAt, reason } = req.body;

    const parsed = rescheduleAppointmentSchema.safeParse({ appointmentId, newScheduledAt, reason });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid reschedule data", details: parsed.error.errors });
    }

    const appointment = appointmentManagementService.rescheduleAppointment(parsed.data);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ appointment, message: "Appointment rescheduled successfully" });
  } catch (error: any) {
    logger.error({ component: "PatientEngagement", err: error, op: "reschedule_appointment" }, "error rescheduling appointment");
    res.status(400).json({ error: error.message || "Failed to reschedule appointment" });
  }
});

patientEngagementRouter.post("/appointments/:appointmentId/cancel", (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appointment = appointmentManagementService.cancelAppointment(appointmentId, reason);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ appointment, message: "Appointment cancelled successfully" });
  } catch (error: any) {
    logger.error({ component: "PatientEngagement", err: error, op: "cancel_appointment" }, "error cancelling appointment");
    res.status(400).json({ error: error.message || "Failed to cancel appointment" });
  }
});

patientEngagementRouter.post("/appointments/:appointmentId/confirm", (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const appointment = appointmentManagementService.confirmAppointment(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found or already confirmed" });
    }

    res.json({ appointment, message: "Appointment confirmed successfully" });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "confirm_appointment" }, "error confirming appointment");
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
});

patientEngagementRouter.post("/appointments/:appointmentId/check-in", (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const appointment = appointmentManagementService.checkInAppointment(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ appointment, message: "Checked in successfully" });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "check_in" }, "error checking in");
    res.status(500).json({ error: "Failed to check in" });
  }
});

patientEngagementRouter.get("/appointments/:patientId/reminders", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const reminders = appointmentManagementService.getUpcomingReminders(patientId);
    res.json({ reminders });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_reminders" }, "error fetching reminders");
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

patientEngagementRouter.get("/appointments/available-slots/:providerId", (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const slots = appointmentManagementService.getAvailableSlots(providerId, date as string);
    res.json({ slots, date, providerId });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_available_slots" }, "error fetching available slots");
    res.status(500).json({ error: "Failed to fetch available slots" });
  }
});

patientEngagementRouter.get("/appointment-types", (_req: Request, res: Response) => {
  res.json({ types: appointmentManagementService.getAppointmentTypes() });
});

patientEngagementRouter.get("/appointment-statuses", (_req: Request, res: Response) => {
  res.json({ statuses: appointmentManagementService.getAppointmentStatuses() });
});

// ============================================
// REMOTE PATIENT MONITORING ENDPOINTS
// ============================================

patientEngagementRouter.get("/monitoring/vitals/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { vitalType, startDate, endDate, unreviewed, limit } = req.query;

    const vitals = remotePatientMonitoringService.getPatientVitals(patientId, {
      vitalType: vitalType as any,
      startDate: startDate as string,
      endDate: endDate as string,
      unreviewed: unreviewed === "true",
      limit: limit ? parseInt(limit as string) : undefined
    });

    logger.info({ component: "PatientEngagement", audit: "HIPAA", action: "list_remote_vitals", patientId }, "remote vitals accessed");
    res.json({ vitals, total: vitals.length });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_vitals" }, "error fetching vitals");
    res.status(500).json({ error: "Failed to fetch vitals" });
  }
});

patientEngagementRouter.post("/monitoring/vitals", (req: Request, res: Response) => {
  try {
    const parsed = insertRemoteVitalSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid vital data", details: parsed.error.errors });
    }

    const submission = remotePatientMonitoringService.submitVitals(parsed.data);
    res.status(201).json({ 
      submission, 
      message: "Vital signs submitted successfully",
      warning: submission.isAbnormal ? submission.abnormalReason : null
    });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "submit_vitals" }, "error submitting vitals");
    res.status(500).json({ error: "Failed to submit vitals" });
  }
});

patientEngagementRouter.get("/monitoring/status-updates/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, unreviewed, flagged, limit } = req.query;

    const updates = remotePatientMonitoringService.getPatientStatusUpdates(patientId, {
      type: type as string,
      unreviewed: unreviewed === "true",
      flagged: flagged === "true",
      limit: limit ? parseInt(limit as string) : undefined
    });

    logger.info({ component: "PatientEngagement", audit: "HIPAA", action: "list_status_updates", patientId }, "health status updates accessed");
    res.json({ updates, total: updates.length });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_status_updates" }, "error fetching status updates");
    res.status(500).json({ error: "Failed to fetch status updates" });
  }
});

patientEngagementRouter.post("/monitoring/status-update", (req: Request, res: Response) => {
  try {
    const parsed = insertHealthStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status update data", details: parsed.error.errors });
    }

    const update = remotePatientMonitoringService.submitHealthStatus(parsed.data);
    res.status(201).json({ 
      update, 
      message: "Health status update submitted successfully",
      flagged: update.flaggedForAttention
    });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "submit_status_update" }, "error submitting status update");
    res.status(500).json({ error: "Failed to submit status update" });
  }
});

patientEngagementRouter.get("/monitoring/trends/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { days } = req.query;

    const trends = remotePatientMonitoringService.calculateVitalTrends(
      patientId, 
      days ? parseInt(days as string) : 30
    );

    res.json({ trends, patientId });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "calculate_trends" }, "error calculating trends");
    res.status(500).json({ error: "Failed to calculate trends" });
  }
});

patientEngagementRouter.get("/monitoring/dashboard/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { patientName } = req.query;

    const dashboard = remotePatientMonitoringService.getPatientMonitoringDashboard(
      patientId,
      (patientName as string) || `Patient ${patientId}`
    );

    logger.info({ component: "PatientEngagement", audit: "HIPAA", action: "view_monitoring_dashboard", patientId }, "patient monitoring dashboard accessed");
    res.json({ dashboard });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_monitoring_dashboard" }, "error fetching monitoring dashboard");
    res.status(500).json({ error: "Failed to fetch monitoring dashboard" });
  }
});

// Clinician endpoints
patientEngagementRouter.get("/monitoring/clinician/review-queue", (_req: Request, res: Response) => {
  try {
    const queue = remotePatientMonitoringService.getClinicianReviewQueue();
    logger.info({ component: "PatientEngagement", audit: "HIPAA", action: "view_clinician_review_queue" }, "clinician review queue accessed");
    res.json({ queue });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "fetch_review_queue" }, "error fetching review queue");
    res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

patientEngagementRouter.post("/monitoring/vitals/:vitalId/review", (req: Request, res: Response) => {
  try {
    const { vitalId } = req.params;
    const { reviewedBy, notes } = req.body;

    if (!reviewedBy) {
      return res.status(400).json({ error: "reviewedBy is required" });
    }

    const vital = remotePatientMonitoringService.reviewVitalSubmission(vitalId, reviewedBy, notes);
    if (!vital) {
      return res.status(404).json({ error: "Vital submission not found" });
    }

    res.json({ vital, message: "Vital reviewed successfully" });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "review_vital" }, "error reviewing vital");
    res.status(500).json({ error: "Failed to review vital" });
  }
});

patientEngagementRouter.post("/monitoring/status-updates/:statusId/review", (req: Request, res: Response) => {
  try {
    const { statusId } = req.params;
    const { reviewedBy, notes, followUpDate } = req.body;

    if (!reviewedBy) {
      return res.status(400).json({ error: "reviewedBy is required" });
    }

    const status = remotePatientMonitoringService.reviewHealthStatus(statusId, reviewedBy, notes, followUpDate);
    if (!status) {
      return res.status(404).json({ error: "Status update not found" });
    }

    res.json({ status, message: "Status update reviewed successfully" });
  } catch (error) {
    logger.error({ component: "PatientEngagement", err: error, op: "review_status_update" }, "error reviewing status update");
    res.status(500).json({ error: "Failed to review status update" });
  }
});

patientEngagementRouter.get("/monitoring/vital-types", (_req: Request, res: Response) => {
  res.json({ 
    types: remotePatientMonitoringService.getVitalTypes(),
    ranges: remotePatientMonitoringService.getVitalRanges()
  });
});

export default patientEngagementRouter;
