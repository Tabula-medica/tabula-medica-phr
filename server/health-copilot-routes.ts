import { Express, Request, Response } from "express";
import {
  generateCopilotInsights,
  generateAIEnhancedInsights,
  getEducationMaterials,
  dismissInsight,
  type PatientDataSummary,
} from "./services/health-copilot-service";
import {
  generatePredictiveAnalytics,
  assessPatientRisk,
  getAIRiskExplanation,
  getCarePathways,
  getCarePathwayById,
} from "./services/predictive-analytics-service";
import { logPhiAccess } from "./security/hipaa-audit";

export function registerHealthCopilotRoutes(app: Express) {
  app.post("/api/health-copilot/analyze", async (req: Request, res: Response) => {
    try {
      const { patients, useAI = false, targetLanguage = "en" } = req.body;

      if (!patients || !Array.isArray(patients)) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: patients (array)",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "PatientPanel",
        resourceId: patients.map((p: PatientDataSummary) => p.patient_id).join(","),
        details: `Analyzed ${patients.length} patient(s) for data quality insights`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = useAI 
        ? await generateAIEnhancedInsights(patients as PatientDataSummary[], targetLanguage)
        : await generateCopilotInsights(patients as PatientDataSummary[]);

      res.json({
        success: true,
        data: result,
        no_cds_notice: "NO-CDS COMPLIANT: This feature provides data quality and workflow insights only. It does not provide clinical recommendations, diagnoses, or treatment suggestions.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Analysis error:", error);
      res.status(500).json({ success: false, error: "Health copilot analysis failed" });
    }
  });

  app.get("/api/health-copilot/education-materials", async (_req: Request, res: Response) => {
    try {
      const materials = getEducationMaterials();
      res.json({
        success: true,
        data: materials,
        disclaimer: "General educational materials only. Not specific medical advice.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Education materials error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch education materials" });
    }
  });

  app.post("/api/health-copilot/dismiss-insight", async (req: Request, res: Response) => {
    try {
      const { insightId } = req.body;

      if (!insightId) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: insightId",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "write",
        resourceType: "CopilotInsight",
        resourceId: insightId,
        details: `Dismissed insight ${insightId}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = dismissInsight(insightId);
      res.json({ success: result });
    } catch (error) {
      console.error("[HealthCopilot] Dismiss insight error:", error);
      res.status(500).json({ success: false, error: "Failed to dismiss insight" });
    }
  });

  app.get("/api/health-copilot/sample-data", async (_req: Request, res: Response) => {
    const samplePatients: PatientDataSummary[] = [
      {
        patient_id: "P001",
        patient_name: "John Smith",
        vitals: [
          { type: "Blood Pressure", value: "120/80", unit: "mmHg", date: "2025-01-15", source: "Fasten Health" },
          { type: "Heart Rate", value: "72", unit: "bpm", date: "2025-01-15", source: "Fasten Health" },
        ],
        labs: [
          { name: "Glucose", value: "95", unit: "mg/dL", reference_range: "70-100", date: "2025-01-10", source: "Quest" },
          { name: "HbA1c", value: "5.7", unit: "%", reference_range: "4.0-5.6", date: "2025-01-10", source: "Quest" },
        ],
        documents: [
          { type: "Lab Report", title: "Comprehensive Metabolic Panel", date: "2025-01-10", source: "Quest", has_been_reviewed: false },
        ],
        messages: [
          { from: "John Smith", subject: "Question about lab results", date: "2025-01-12", is_read: false, priority: "normal" },
        ],
      },
      {
        patient_id: "P002",
        patient_name: "Mary Johnson",
        vitals: [
          { type: "Blood Pressure", value: "138/88", unit: "mmHg", date: "2024-11-20", source: "Fasten Health" },
        ],
        labs: [
          { name: "Cholesterol Total", value: "220", unit: "mg/dL", reference_range: "", date: "2025-01-05", source: "LabCorp" },
          { name: "LDL", value: "145", unit: "", reference_range: "<100", date: "2025-01-05", source: "LabCorp" },
        ],
        documents: [
          { type: "Referral Letter", title: "Cardiology Referral", date: "2025-01-08", source: "PCP Office", has_been_reviewed: false },
          { type: "Imaging Report", title: "Chest X-Ray", date: "2025-01-02", source: "RadNet", has_been_reviewed: true },
        ],
        messages: [
          { from: "Mary Johnson", subject: "Medication refill request", date: "2025-01-18", is_read: false, priority: "high" },
          { from: "Mary Johnson", subject: "Appointment reschedule", date: "2025-01-17", is_read: false, priority: "normal" },
        ],
      },
      {
        patient_id: "P003",
        patient_name: "Robert Williams",
        vitals: [],
        labs: [
          { name: "Creatinine", value: "1.2", unit: "mg/dL", reference_range: "0.7-1.3", date: "2025-01-08", source: "Quest" },
          { name: "BUN", value: "18", unit: "mg/dL", reference_range: "7-20", date: "2025-01-08", source: "Quest" },
        ],
        documents: [],
        messages: [],
      },
    ];

    const result = await generateCopilotInsights(samplePatients);
    res.json({
      success: true,
      data: result,
      sample: true,
      no_cds_notice: "NO-CDS COMPLIANT: This feature provides data quality and workflow insights only.",
    });
  });

  app.get("/api/health-copilot/predictive-analytics", async (req: Request, res: Response) => {
    try {
      const samplePatients: PatientDataSummary[] = [
        {
          patient_id: "P001",
          patient_name: "John Smith",
          vitals: [
            { type: "Blood Pressure", value: "120/80", unit: "mmHg", date: "2025-01-15", source: "Fasten Health" },
            { type: "Heart Rate", value: "72", unit: "bpm", date: "2025-01-15", source: "Fasten Health" },
          ],
          labs: [
            { name: "Glucose", value: "95", unit: "mg/dL", reference_range: "70-100", date: "2025-01-10", source: "Quest" },
            { name: "HbA1c", value: "5.7", unit: "%", reference_range: "4.0-5.6", date: "2025-01-10", source: "Quest" },
          ],
          documents: [
            { type: "Lab Report", title: "Comprehensive Metabolic Panel", date: "2025-01-10", source: "Quest", has_been_reviewed: false },
            { type: "Discharge Summary", title: "Hospital Discharge", date: "2025-01-05", source: "Fasten Health", has_been_reviewed: false },
            { type: "Visit Note", title: "Follow-up Visit", date: "2025-01-03", source: "Fasten Health", has_been_reviewed: true },
          ],
          messages: [
            { from: "John Smith", subject: "Question about lab results", date: "2025-01-12", is_read: false, priority: "high" },
            { from: "John Smith", subject: "Medication side effects", date: "2025-01-11", is_read: false, priority: "high" },
          ],
        },
        {
          patient_id: "P002",
          patient_name: "Mary Johnson",
          vitals: [
            { type: "Blood Pressure", value: "138/88", unit: "mmHg", date: "2024-11-20", source: "Fasten Health" },
          ],
          labs: [
            { name: "Cholesterol Total", value: "220", unit: "mg/dL", reference_range: "", date: "2025-01-05", source: "LabCorp" },
            { name: "LDL", value: "145", unit: "", reference_range: "<100", date: "2025-01-05", source: "LabCorp" },
          ],
          documents: [
            { type: "Referral Letter", title: "Cardiology Referral", date: "2025-01-08", source: "PCP Office", has_been_reviewed: false },
            { type: "Imaging Report", title: "Chest X-Ray", date: "2025-01-02", source: "RadNet", has_been_reviewed: true },
          ],
          messages: [
            { from: "Mary Johnson", subject: "Medication refill request", date: "2025-01-18", is_read: false, priority: "high" },
            { from: "Mary Johnson", subject: "Appointment reschedule", date: "2025-01-17", is_read: false, priority: "normal" },
          ],
        },
        {
          patient_id: "P003",
          patient_name: "Robert Williams",
          vitals: [],
          labs: [
            { name: "Creatinine", value: "1.2", unit: "mg/dL", reference_range: "0.7-1.3", date: "2025-01-08", source: "Quest" },
            { name: "BUN", value: "18", unit: "mg/dL", reference_range: "7-20", date: "2025-01-08", source: "Quest" },
          ],
          documents: [],
          messages: [],
        },
        {
          patient_id: "P004",
          patient_name: "Sarah Davis",
          vitals: [
            { type: "Blood Pressure", value: "145/92", unit: "mmHg", date: "2025-01-16", source: "Fasten Health" },
            { type: "Weight", value: "185", unit: "lbs", date: "2025-01-16", source: "Fasten Health" },
            { type: "Blood Pressure", value: "142/90", unit: "mmHg", date: "2025-01-14", source: "Fasten Health" },
            { type: "Blood Pressure", value: "148/94", unit: "mmHg", date: "2025-01-12", source: "Fasten Health" },
          ],
          labs: [
            { name: "HbA1c", value: "7.2", unit: "%", reference_range: "4.0-5.6", date: "2025-01-15", source: "Quest" },
            { name: "Glucose", value: "156", unit: "mg/dL", reference_range: "70-100", date: "2025-01-15", source: "Quest" },
          ],
          documents: [
            { type: "Discharge Summary", title: "Hospital Discharge", date: "2025-01-10", source: "Fasten Health", has_been_reviewed: false },
            { type: "Discharge Summary", title: "ER Visit", date: "2024-12-28", source: "Fasten Health", has_been_reviewed: false },
            { type: "Visit Note", title: "PCP Follow-up", date: "2024-12-20", source: "Fasten Health", has_been_reviewed: true },
          ],
          messages: [
            { from: "Sarah Davis", subject: "Urgent: Blood sugar concerns", date: "2025-01-17", is_read: false, priority: "high" },
            { from: "Care Team", subject: "Medication adjustment needed", date: "2025-01-16", is_read: false, priority: "high" },
          ],
        },
        {
          patient_id: "P005",
          patient_name: "Michael Brown",
          vitals: [],
          labs: [],
          documents: [
            { type: "External Records", title: "Records from Previous Provider", date: "2024-10-15", source: "External", has_been_reviewed: false },
          ],
          messages: [
            { from: "Michael Brown", subject: "New patient questions", date: "2024-11-01", is_read: false, priority: "normal" },
            { from: "Michael Brown", subject: "Insurance update", date: "2024-10-20", is_read: false, priority: "normal" },
            { from: "Michael Brown", subject: "Appointment request", date: "2024-10-18", is_read: false, priority: "normal" },
          ],
        },
      ];

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "PredictiveAnalytics",
        resourceId: "dashboard",
        details: `Generated predictive analytics for ${samplePatients.length} patients`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const analytics = await generatePredictiveAnalytics(samplePatients);

      res.json({
        success: true,
        data: analytics,
        sample: true,
        no_cds_notice: "NO-CDS COMPLIANT: Pattern analysis only. Not clinical advice. Clinical decisions require provider evaluation.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Predictive analytics error:", error);
      res.status(500).json({ success: false, error: "Predictive analytics generation failed" });
    }
  });

  app.post("/api/health-copilot/patient-risk", async (req: Request, res: Response) => {
    try {
      const { patient } = req.body;

      if (!patient) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: patient",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "PatientRiskAssessment",
        resourceId: patient.patient_id,
        details: `Assessed risk for patient ${patient.patient_name}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const assessment = assessPatientRisk(patient as PatientDataSummary);

      res.json({
        success: true,
        data: assessment,
        no_cds_notice: "NO-CDS COMPLIANT: Pattern analysis only. Not clinical advice.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Patient risk assessment error:", error);
      res.status(500).json({ success: false, error: "Patient risk assessment failed" });
    }
  });

  app.post("/api/health-copilot/risk-explanation", async (req: Request, res: Response) => {
    try {
      const { assessment } = req.body;

      if (!assessment) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: assessment",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "RiskExplanation",
        resourceId: assessment.patientId,
        details: `Generated AI risk explanation for patient ${assessment.patientName}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const explanation = await getAIRiskExplanation(assessment);

      res.json({
        success: true,
        explanation,
        no_cds_notice: "NO-CDS COMPLIANT: Pattern analysis only. Not clinical advice.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Risk explanation error:", error);
      res.status(500).json({ success: false, error: "Risk explanation generation failed" });
    }
  });

  app.get("/api/health-copilot/care-pathways", async (_req: Request, res: Response) => {
    try {
      const pathways = getCarePathways();
      res.json({
        success: true,
        data: pathways,
        disclaimer: "Care coordination pathways for workflow organization. Not treatment plans.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Care pathways error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch care pathways" });
    }
  });

  app.get("/api/health-copilot/care-pathways/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const pathway = getCarePathwayById(id);

      if (!pathway) {
        return res.status(404).json({
          success: false,
          error: "Care pathway not found",
        });
      }

      res.json({
        success: true,
        data: pathway,
        disclaimer: "Care coordination pathway for workflow organization. Not a treatment plan.",
      });
    } catch (error) {
      console.error("[HealthCopilot] Care pathway error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch care pathway" });
    }
  });

  console.log("[Routes] Health Copilot routes registered at /api/health-copilot/*");
  console.log("[Routes] Predictive Analytics routes registered at /api/health-copilot/predictive-analytics/*");
}
