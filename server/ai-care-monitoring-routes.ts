/**
 * AI Care Monitoring API Routes
 * Provides endpoints for care gap detection, inter-module linking, and critical event management.
 */

import { Express, Request, Response } from "express";
import { aiCareMonitoringService, PatientDataSnapshot } from "./services/ai-care-monitoring-service";
import { logPhiAccess } from "./security/hipaa-audit";

export function registerAICareMonitoringRoutes(app: Express) {
  app.post("/api/care-monitoring/analyze", async (req: Request, res: Response) => {
    try {
      const { patientId, data } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      logPhiAccess({
        userId: "system",
        action: "read",
        resourceType: "PatientData",
        resourceId: patientId,
        details: "care_monitoring_analysis_request",
      });

      const patientData: PatientDataSnapshot = data || {
        patientId,
        appointments: [],
        treatments: [],
        symptoms: [],
        documents: [],
        medications: [],
        vitals: [],
        labResults: [],
      };

      const results = await aiCareMonitoringService.analyzePatientData(patientData);

      res.json({
        success: true,
        patientId,
        analysis: results,
        disclaimer: "This analysis is for informational purposes only. It is NOT medical advice. Always consult healthcare providers for clinical decisions.",
      });
    } catch (error) {
      console.error("[CareMonitoring] Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze patient data" });
    }
  });

  app.get("/api/care-monitoring/gaps/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      logPhiAccess({
        userId: "system",
        action: "read",
        resourceType: "CareGap",
        resourceId: patientId,
        details: "get_care_gaps_api",
      });

      const gaps = aiCareMonitoringService.getCareGaps(patientId);

      res.json({
        success: true,
        patientId,
        gaps,
        disclaimer: "Care gaps are AI-identified documentation patterns. They are NOT clinical recommendations.",
      });
    } catch (error) {
      console.error("[CareMonitoring] Get gaps error:", error);
      res.status(500).json({ error: "Failed to retrieve care gaps" });
    }
  });

  app.get("/api/care-monitoring/links/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      logPhiAccess({
        userId: "system",
        action: "read",
        resourceType: "InterModuleLink",
        resourceId: patientId,
        details: "get_inter_module_links_api",
      });

      const links = aiCareMonitoringService.getInterModuleLinks(patientId);

      res.json({
        success: true,
        patientId,
        links,
        disclaimer: "Suggested links are AI-generated organizational suggestions, not clinical associations.",
      });
    } catch (error) {
      console.error("[CareMonitoring] Get links error:", error);
      res.status(500).json({ error: "Failed to retrieve inter-module links" });
    }
  });

  app.get("/api/care-monitoring/events/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      logPhiAccess({
        userId: "system",
        action: "read",
        resourceType: "CriticalEvent",
        resourceId: patientId,
        details: "get_critical_events_api",
      });

      const events = aiCareMonitoringService.getCriticalEvents(patientId);

      res.json({
        success: true,
        patientId,
        events,
        disclaimer: "Critical events are flagged for review. Clinical judgment is required for all health decisions.",
      });
    } catch (error) {
      console.error("[CareMonitoring] Get events error:", error);
      res.status(500).json({ error: "Failed to retrieve critical events" });
    }
  });

  app.get("/api/care-monitoring/summary/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const summary = aiCareMonitoringService.getMonitoringSummary(patientId);

      res.json({
        success: true,
        patientId,
        summary,
      });
    } catch (error) {
      console.error("[CareMonitoring] Get summary error:", error);
      res.status(500).json({ error: "Failed to retrieve monitoring summary" });
    }
  });

  app.post("/api/care-monitoring/gaps/:patientId/:gapId/acknowledge", async (req: Request, res: Response) => {
    try {
      const { patientId, gapId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const gap = aiCareMonitoringService.acknowledgeGap(patientId, gapId, userId);

      if (!gap) {
        return res.status(404).json({ error: "Care gap not found" });
      }

      res.json({
        success: true,
        gap,
      });
    } catch (error) {
      console.error("[CareMonitoring] Acknowledge gap error:", error);
      res.status(500).json({ error: "Failed to acknowledge care gap" });
    }
  });

  app.post("/api/care-monitoring/links/:patientId/:linkId/accept", async (req: Request, res: Response) => {
    try {
      const { patientId, linkId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const link = aiCareMonitoringService.acceptLink(patientId, linkId, userId);

      if (!link) {
        return res.status(404).json({ error: "Inter-module link not found" });
      }

      res.json({
        success: true,
        link,
      });
    } catch (error) {
      console.error("[CareMonitoring] Accept link error:", error);
      res.status(500).json({ error: "Failed to accept inter-module link" });
    }
  });

  app.post("/api/care-monitoring/events/:patientId/:eventId/review", async (req: Request, res: Response) => {
    try {
      const { patientId, eventId } = req.params;
      const { userId, notes } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const event = aiCareMonitoringService.reviewEvent(patientId, eventId, userId, notes || "");

      if (!event) {
        return res.status(404).json({ error: "Critical event not found" });
      }

      res.json({
        success: true,
        event,
      });
    } catch (error) {
      console.error("[CareMonitoring] Review event error:", error);
      res.status(500).json({ error: "Failed to review critical event" });
    }
  });

  app.post("/api/care-monitoring/run-analysis", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      const mockData: PatientDataSnapshot = {
        patientId,
        appointments: [
          { id: "apt-1", type: "Follow-up", provider: "Dr. Smith", scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), status: "scheduled", reason: "Routine check" },
          { id: "apt-2", type: "Annual Physical", provider: "Dr. Johnson", scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: "confirmed" },
        ],
        treatments: [
          { id: "treat-1", name: "Physical Therapy", type: "rehabilitation", startDate: "2025-01-01", status: "active" },
          { id: "treat-2", name: "Diabetes Management", type: "chronic care", startDate: "2024-06-15", status: "active" },
        ],
        symptoms: [
          { id: "symp-1", name: "Fatigue", severity: 6, reportedDate: new Date().toISOString() },
          { id: "symp-2", name: "Joint Pain", severity: 8, reportedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        documents: [
          { id: "doc-1", type: "Lab Report", title: "Blood Work Results", uploadedDate: "2025-01-10", category: "Lab Results" },
          { id: "doc-2", type: "Imaging", title: "X-Ray Report", uploadedDate: "2025-01-05", category: "Imaging" },
        ],
        medications: [
          { id: "med-1", name: "Metformin", dosage: "500mg", frequency: "twice daily", startDate: "2024-06-15", status: "active" },
          { id: "med-2", name: "Lisinopril", dosage: "10mg", frequency: "once daily", startDate: "2024-03-01", status: "active" },
        ],
        vitals: [
          { id: "vital-1", type: "Blood Pressure", value: 142, unit: "mmHg", recordedDate: new Date().toISOString(), source: "clinic" },
          { id: "vital-2", type: "Heart Rate", value: 78, unit: "bpm", recordedDate: new Date().toISOString(), source: "wearable" },
        ],
        labResults: [
          { id: "lab-1", testName: "HbA1c", value: "7.2%", referenceRange: "< 5.7%", status: "abnormal", resultDate: "2025-01-10" },
          { id: "lab-2", testName: "Potassium", value: "3.2 mEq/L", referenceRange: "3.5-5.0 mEq/L", status: "critical", resultDate: "2025-01-15" },
        ],
      };

      const results = await aiCareMonitoringService.analyzePatientData(mockData);

      res.json({
        success: true,
        patientId,
        analysis: results,
        disclaimer: "This analysis is for informational purposes only. It is NOT medical advice.",
      });
    } catch (error) {
      console.error("[CareMonitoring] Run analysis error:", error);
      res.status(500).json({ error: "Failed to run care monitoring analysis" });
    }
  });

  console.log("[AICareMonitoring] Routes registered");
}
