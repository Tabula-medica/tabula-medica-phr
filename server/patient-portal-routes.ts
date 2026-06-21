import { Express, Request, Response } from "express";
import { z } from "zod";
import {
  getPatientMedications,
  getPatientAllergies,
  getPatientConditions,
  getPatientSurgeries,
  getPatientFamilyHistory,
  getPatientCarePlans,
  getMessageThreads,
  getThreadMessages,
  sendMessage,
  createNewThread,
  getQuestionnaires,
  submitQuestionnaireResponse,
  submitDataUpdate,
  getDataUpdates,
  getAvailableRecipients,
  getPatientPortalPatients,
  logPatientPortalAccess,
} from "./services/patient-portal-service";
import { getLabResults, getUpcomingLabOrders } from "./services/lab-diagnostics-integration-service";

const sendMessageSchema = z.object({
  threadId: z.string().min(1),
  content: z.string().min(1).max(5000),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  subject: z.string().min(1),
  isUrgent: z.boolean().optional().default(false),
});

const createThreadSchema = z.object({
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  recipientRole: z.string().min(1),
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  isUrgent: z.boolean().optional().default(false),
});

const submitQuestionnaireSchema = z.object({
  questionnaireId: z.string().min(1),
  responses: z.array(z.object({
    questionId: z.string().min(1),
    answer: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
  })),
});

const dataUpdateSchema = z.object({
  updateType: z.enum(["contact", "pharmacy", "emergency_contact", "insurance", "preferences"]),
  oldValue: z.record(z.unknown()),
  newValue: z.record(z.unknown()),
});

const SAMPLE_INVOICES: any[] = [];

const SAMPLE_PERSONAL_INFO = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  phone: "",
  address: {
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
  },
  emergencyContact: {
    name: "",
    relationship: "",
    phone: "",
  },
  preferredLanguage: "English",
  preferredContactMethod: "email" as const,
};

const SAMPLE_INSURANCE: any[] = [];

const SAMPLE_PROVIDERS: any[] = [];

const SAMPLE_HEALTH_SUMMARY = {
  lastUpdated: new Date().toISOString(),
  conditions: [],
  medications: [],
  allergies: [],
  vitals: {},
  recentLabs: [],
  immunizations: [],
  upcomingAppointments: [],
  careTeam: [],
};

const SAMPLE_AI_INSIGHTS = {
  disclaimer: "FOR EDUCATIONAL PURPOSES ONLY. This is NOT medical advice and does NOT replace professional medical consultation. No clinical recommendations are provided.",
  generatedAt: new Date().toISOString(),
  recordSummaries: [],
  dataObservations: [],
  noCdsCompliance: {
    enforcementLevel: "STRICT",
    statement: "This system provides ONLY data summaries with citations from your medical records. NO clinical decision support, diagnoses, treatment recommendations, or health advice is provided.",
    scope: "Record summarization and health literacy education only",
    auditId: "NO-CDS-2026-01-20",
  },
};

function getRequestContext(req: Request): { userId: string; ipAddress: string; userAgent: string } {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  return {
    userId: user?.claims?.sub || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
  };
}

export function registerPatientPortalRoutes(app: Express): void {
  app.get("/api/patient-portal/patients", async (_req: Request, res: Response) => {
    try {
      const patients = getPatientPortalPatients();
      res.json({ patients });
    } catch (error) {
      console.error("[PatientPortal] Get patients error:", error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  });

  app.get("/api/patient-portal/:patientId/medications", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "medications", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const medications = getPatientMedications(patientId);
      res.json({ medications });
    } catch (error) {
      console.error("[PatientPortal] Get medications error:", error);
      res.status(500).json({ error: "Failed to get medications" });
    }
  });

  app.get("/api/patient-portal/:patientId/allergies", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "allergies", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const allergies = getPatientAllergies(patientId);
      res.json({ allergies });
    } catch (error) {
      console.error("[PatientPortal] Get allergies error:", error);
      res.status(500).json({ error: "Failed to get allergies" });
    }
  });

  app.get("/api/patient-portal/:patientId/conditions", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "conditions", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const conditions = getPatientConditions(patientId);
      res.json({ conditions });
    } catch (error) {
      console.error("[PatientPortal] Get conditions error:", error);
      res.status(500).json({ error: "Failed to get conditions" });
    }
  });

  app.get("/api/patient-portal/:patientId/surgeries", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "surgeries", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const surgeries = getPatientSurgeries(patientId);
      res.json({ surgeries });
    } catch (error) {
      console.error("[PatientPortal] Get surgeries error:", error);
      res.status(500).json({ error: "Failed to get surgeries" });
    }
  });

  app.get("/api/patient-portal/:patientId/family-history", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "family-history", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const familyHistory = getPatientFamilyHistory(patientId);
      res.json({ familyHistory });
    } catch (error) {
      console.error("[PatientPortal] Get family history error:", error);
      res.status(500).json({ error: "Failed to get family history" });
    }
  });

  app.get("/api/patient-portal/:patientId/care-plans", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "care-plans", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const carePlans = getPatientCarePlans(patientId);
      res.json({ carePlans });
    } catch (error) {
      console.error("[PatientPortal] Get care plans error:", error);
      res.status(500).json({ error: "Failed to get care plans" });
    }
  });

  app.get("/api/patient-portal/:patientId/message-threads", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "messages", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const threads = getMessageThreads(patientId);
      res.json({ threads });
    } catch (error) {
      console.error("[PatientPortal] Get message threads error:", error);
      res.status(500).json({ error: "Failed to get message threads" });
    }
  });

  app.get("/api/patient-portal/:patientId/messages/:threadId", async (req: Request, res: Response) => {
    try {
      const { patientId, threadId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "message-thread", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const messages = getThreadMessages(patientId, threadId);
      res.json({ messages });
    } catch (error) {
      console.error("[PatientPortal] Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/patient-portal/:patientId/messages", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      
      const validation = sendMessageSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { threadId, content, recipientId, recipientName, subject, isUrgent } = validation.data;
      const message = await sendMessage(
        patientId, threadId, content, recipientId, recipientName, subject, isUrgent,
        ctx.userId, ctx.ipAddress, ctx.userAgent
      );

      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error("[PatientPortal] Send message error:", error);
      const msg = error instanceof Error ? error.message : "Failed to send message";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/patient-portal/:patientId/threads", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      
      const validation = createThreadSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { recipientId, recipientName, recipientRole, subject, content, isUrgent } = validation.data;
      const result = await createNewThread(
        patientId, recipientId, recipientName, recipientRole, subject, content, isUrgent,
        ctx.userId, ctx.ipAddress, ctx.userAgent
      );

      res.status(201).json({ success: true, ...result });
    } catch (error) {
      console.error("[PatientPortal] Create thread error:", error);
      const msg = error instanceof Error ? error.message : "Failed to create thread";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/patient-portal/recipients", async (_req: Request, res: Response) => {
    try {
      const recipients = getAvailableRecipients();
      res.json({ recipients });
    } catch (error) {
      console.error("[PatientPortal] Get recipients error:", error);
      res.status(500).json({ error: "Failed to get recipients" });
    }
  });

  app.get("/api/patient-portal/:patientId/questionnaires", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "questionnaires", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const questionnaires = getQuestionnaires(patientId);
      res.json({ questionnaires });
    } catch (error) {
      console.error("[PatientPortal] Get questionnaires error:", error);
      res.status(500).json({ error: "Failed to get questionnaires" });
    }
  });

  app.post("/api/patient-portal/:patientId/questionnaires/submit", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      
      const validation = submitQuestionnaireSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { questionnaireId, responses } = validation.data;
      const response = await submitQuestionnaireResponse(
        patientId, questionnaireId, responses,
        ctx.userId, ctx.ipAddress, ctx.userAgent
      );

      res.status(201).json({ success: true, response });
    } catch (error) {
      console.error("[PatientPortal] Submit questionnaire error:", error);
      const msg = error instanceof Error ? error.message : "Failed to submit questionnaire";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/patient-portal/:patientId/data-updates", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      
      const validation = dataUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { updateType, oldValue, newValue } = validation.data;
      const update = await submitDataUpdate(
        patientId, updateType, oldValue, newValue,
        ctx.userId, ctx.ipAddress, ctx.userAgent
      );

      res.status(201).json({ success: true, update });
    } catch (error) {
      console.error("[PatientPortal] Submit data update error:", error);
      const msg = error instanceof Error ? error.message : "Failed to submit data update";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/patient-portal/:patientId/data-updates", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "data-updates", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const updates = getDataUpdates(patientId);
      res.json({ updates });
    } catch (error) {
      console.error("[PatientPortal] Get data updates error:", error);
      res.status(500).json({ error: "Failed to get data updates" });
    }
  });

  // ===== INVOICES & BILLING =====
  app.get("/api/patient-portal/:patientId/invoices", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "invoices", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const statusFilter = req.query.status as string | undefined;
      let invoices = SAMPLE_INVOICES.slice();
      
      if (statusFilter && statusFilter !== "all") {
        invoices = invoices.filter(inv => inv.status === statusFilter);
      }

      const summary = {
        totalOutstanding: SAMPLE_INVOICES
          .filter(inv => inv.status === "pending" || inv.status === "overdue")
          .reduce((sum, inv) => sum + inv.patientResponsibility, 0),
        totalPaid: SAMPLE_INVOICES
          .filter(inv => inv.status === "paid")
          .reduce((sum, inv) => sum + inv.patientResponsibility, 0),
        overdueCount: SAMPLE_INVOICES.filter(inv => inv.status === "overdue").length,
        pendingCount: SAMPLE_INVOICES.filter(inv => inv.status === "pending").length,
      };

      res.json({ success: true, invoices, summary });
    } catch (error) {
      console.error("[PatientPortal] Get invoices error:", error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  app.get("/api/patient-portal/:patientId/invoices/:invoiceId", async (req: Request, res: Response) => {
    try {
      const { patientId, invoiceId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "invoice-detail", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const invoice = SAMPLE_INVOICES.find(inv => inv.id === invoiceId);
      if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
      }

      res.json({ success: true, invoice });
    } catch (error) {
      console.error("[PatientPortal] Get invoice detail error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.post("/api/patient-portal/:patientId/invoices/:invoiceId/pay", async (req: Request, res: Response) => {
    try {
      const { patientId, invoiceId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "invoice-payment", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const invoice = SAMPLE_INVOICES.find(inv => inv.id === invoiceId);
      if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
      }

      res.json({
        success: true,
        message: "Payment processed successfully",
        payment: {
          invoiceId,
          paymentId: `PAY-${Date.now()}`,
          amount: invoice.patientResponsibility,
          status: "completed",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[PatientPortal] Process payment error:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // ===== PERSONAL INFORMATION =====
  app.get("/api/patient-portal/:patientId/personal-info", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "personal-info", ctx.userId, ctx.ipAddress, ctx.userAgent);

      res.json({ success: true, personalInfo: SAMPLE_PERSONAL_INFO });
    } catch (error) {
      console.error("[PatientPortal] Get personal info error:", error);
      res.status(500).json({ error: "Failed to get personal information" });
    }
  });

  app.put("/api/patient-portal/:patientId/personal-info", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "personal-info-update", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const updatedInfo = req.body;
      res.json({
        success: true,
        message: "Personal information updated successfully",
        personalInfo: { ...SAMPLE_PERSONAL_INFO, ...updatedInfo },
      });
    } catch (error) {
      console.error("[PatientPortal] Update personal info error:", error);
      res.status(500).json({ error: "Failed to update personal information" });
    }
  });

  // ===== INSURANCE =====
  app.get("/api/patient-portal/:patientId/insurance", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "insurance", ctx.userId, ctx.ipAddress, ctx.userAgent);

      res.json({ success: true, insurance: SAMPLE_INSURANCE });
    } catch (error) {
      console.error("[PatientPortal] Get insurance error:", error);
      res.status(500).json({ error: "Failed to get insurance information" });
    }
  });

  app.put("/api/patient-portal/:patientId/insurance/:insuranceId", async (req: Request, res: Response) => {
    try {
      const { patientId, insuranceId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "insurance-update", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const existing = SAMPLE_INSURANCE.find(ins => ins.id === insuranceId);
      if (!existing) {
        res.status(404).json({ error: "Insurance not found" });
        return;
      }

      const updatedInsurance = req.body;
      res.json({
        success: true,
        message: "Insurance information updated successfully",
        insurance: { ...existing, ...updatedInsurance, isVerified: false },
      });
    } catch (error) {
      console.error("[PatientPortal] Update insurance error:", error);
      res.status(500).json({ error: "Failed to update insurance" });
    }
  });

  app.post("/api/patient-portal/:patientId/insurance", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "insurance-add", ctx.userId, ctx.ipAddress, ctx.userAgent);

      const newInsurance = req.body;
      res.json({
        success: true,
        message: "Insurance added successfully",
        insurance: {
          id: `ins-${Date.now()}`,
          ...newInsurance,
          isVerified: false,
        },
      });
    } catch (error) {
      console.error("[PatientPortal] Add insurance error:", error);
      res.status(500).json({ error: "Failed to add insurance" });
    }
  });

  // ===== HEALTH SUMMARY =====
  app.get("/api/patient-portal/:patientId/health-summary", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "health-summary", ctx.userId, ctx.ipAddress, ctx.userAgent);

      res.json({ success: true, summary: SAMPLE_HEALTH_SUMMARY });
    } catch (error) {
      console.error("[PatientPortal] Get health summary error:", error);
      res.status(500).json({ error: "Failed to get health summary" });
    }
  });

  // ===== AI INSIGHTS =====
  app.get("/api/patient-portal/:patientId/ai-insights", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "ai-insights", ctx.userId, ctx.ipAddress, ctx.userAgent);

      res.json({ success: true, insights: SAMPLE_AI_INSIGHTS });
    } catch (error) {
      console.error("[PatientPortal] Get AI insights error:", error);
      res.status(500).json({ error: "Failed to get AI insights" });
    }
  });

  // ===== PROVIDERS =====
  app.get("/api/patient-portal/:patientId/providers", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "providers", ctx.userId, ctx.ipAddress, ctx.userAgent);

      res.json({ success: true, providers: SAMPLE_PROVIDERS });
    } catch (error) {
      console.error("[PatientPortal] Get providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  function categorizeLabTest(testName: string, loincCode: string): string {
    const name = testName.toLowerCase();
    if (name.includes("glucose") || name.includes("a1c") || name.includes("hemoglobin a1c")) return "Metabolic";
    if (name.includes("cholesterol") || name.includes("ldl") || name.includes("hdl") || name.includes("triglycer") || name.includes("lipid")) return "Cardiovascular";
    if (name.includes("creatinine") || name.includes("bun") || name.includes("egfr") || name.includes("kidney")) return "Kidney";
    if (name.includes("alt") || name.includes("ast") || name.includes("bilirubin") || name.includes("albumin") || name.includes("liver")) return "Liver";
    if (name.includes("wbc") || name.includes("white blood") || name.includes("rbc") || name.includes("red blood") || name.includes("hemoglobin") || name.includes("platelet") || name.includes("hematocrit")) return "Hematology";
    if (name.includes("tsh") || name.includes("thyroid") || name.includes("t3") || name.includes("t4")) return "Thyroid";
    if (name.includes("psa") || name.includes("cea") || name.includes("tumor")) return "Oncology";
    if (name.includes("sodium") || name.includes("potassium") || name.includes("calcium") || name.includes("chloride") || name.includes("co2") || name.includes("magnesium")) return "Electrolytes";
    return "General";
  }

  function generateLabAlertSuggestions(testName: string, value: string, unit: string, referenceRange: string, interpretation: string) {
    const name = testName.toLowerCase();
    
    if (name.includes("creatinine")) {
      return {
        description: `Your creatinine level (${value} ${unit}) is outside the normal range (${referenceRange}). Creatinine is a marker of kidney function.`,
        recommendations: [
          "Discuss with your doctor at your next visit",
          "Stay well hydrated",
          "Review medications that may affect kidney function",
        ],
        educationTopics: ["Kidney Health", "Understanding Creatinine Levels", "Hydration and Kidney Function"],
      };
    }
    if (name.includes("glucose") || name.includes("a1c")) {
      return {
        description: `Your ${testName} (${value} ${unit}) is outside the normal range (${referenceRange}). This test relates to blood sugar management.`,
        recommendations: [
          "Monitor your diet and carbohydrate intake",
          "Discuss with your provider about diabetes screening",
          "Consider regular blood sugar monitoring",
        ],
        educationTopics: ["Blood Sugar Management", "Diabetes Prevention", "Healthy Eating for Blood Sugar Control"],
      };
    }
    if (name.includes("cholesterol") || name.includes("ldl") || name.includes("triglycer")) {
      return {
        description: `Your ${testName} (${value} ${unit}) is outside the normal range (${referenceRange}). This relates to cardiovascular health.`,
        recommendations: [
          "Discuss heart-healthy lifestyle changes with your doctor",
          "Consider dietary modifications",
          "Regular exercise may help improve levels",
        ],
        educationTopics: ["Heart Health", "Cholesterol Management", "Heart-Healthy Diet"],
      };
    }
    
    return {
      description: `Your ${testName} result (${value} ${unit}) is ${interpretation} compared to the reference range (${referenceRange}).`,
      recommendations: [
        "Discuss this result with your healthcare provider",
        "Ask about follow-up testing if needed",
        "Keep track of trends in your results over time",
      ],
      educationTopics: ["Understanding Lab Results", "When to Call Your Doctor"],
    };
  }

  // ===== CONSOLIDATED LAB RESULTS =====
  app.get("/api/patient-portal/:patientId/lab-results/consolidated", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { sortBy, sortOrder, interpretation, category } = req.query;
      
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "lab-results-consolidated", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const labData = getLabResults(patientId);
      
      let results = labData.results.map(r => ({
        id: r.id,
        orderId: r.orderId,
        testName: r.testName,
        loincCode: r.loincCode,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        interpretation: r.interpretation,
        status: r.status,
        collectedAt: r.collectedAt,
        reportedAt: r.reportedAt,
        performingLab: r.performingLab,
        providerName: r.providerName,
        source: "fhir" as const,
        isAbnormal: r.interpretation === "abnormal" || r.interpretation === "critical",
        isCritical: r.interpretation === "critical",
        category: categorizeLabTest(r.testName, r.loincCode),
      }));

      if (interpretation && interpretation !== "all") {
        results = results.filter(r => r.interpretation === interpretation);
      }
      if (category && category !== "all") {
        results = results.filter(r => r.category === category);
      }

      const sortField = (sortBy as string) || "reportedAt";
      const order = (sortOrder as string) || "desc";
      results.sort((a: any, b: any) => {
        let valA = a[sortField] || "";
        let valB = b[sortField] || "";
        if (sortField === "reportedAt" || sortField === "collectedAt") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }
        return order === "desc" ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
      });

      const abnormalResults = results.filter(r => r.isAbnormal);
      const criticalResults = results.filter(r => r.isCritical);
      const categories = Array.from(new Set(results.map(r => r.category)));

      res.json({
        results,
        totalCount: results.length,
        abnormalCount: abnormalResults.length,
        criticalCount: criticalResults.length,
        categories,
        abnormalResults,
        disclaimer: "Lab results are presented for informational purposes only. All results must be interpreted by a qualified healthcare provider.",
      });
    } catch (error: any) {
      console.error("[PatientPortal] Error fetching consolidated lab results:", error);
      res.status(500).json({ error: "Failed to fetch lab results" });
    }
  });

  // ===== UPCOMING LAB ORDERS =====
  app.get("/api/patient-portal/:patientId/lab-orders/upcoming", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "upcoming-lab-orders", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const upcomingOrders = getUpcomingLabOrders(patientId);
      
      res.json({
        orders: upcomingOrders.map(o => ({
          id: o.id,
          tests: o.tests.map(t => t.testName),
          status: o.status,
          orderingPhysician: o.orderingPhysician,
          providerName: o.providerName,
          submittedAt: o.submittedAt,
          estimatedCompletionAt: o.estimatedCompletionAt,
        })),
        totalCount: upcomingOrders.length,
      });
    } catch (error: any) {
      console.error("[PatientPortal] Error fetching upcoming lab orders:", error);
      res.status(500).json({ error: "Failed to fetch upcoming lab orders" });
    }
  });

  // ===== HEALTH RECORDS SUMMARY =====
  app.get("/api/patient-portal/:patientId/health-records-summary", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "health-records-summary", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const conditions = getPatientConditions(patientId);
      const medications = getPatientMedications(patientId);
      const labData = getLabResults(patientId);
      const upcomingOrders = getUpcomingLabOrders(patientId);
      
      const abnormalLabs = labData.results.filter(r => r.interpretation === "abnormal" || r.interpretation === "critical");
      const activeConditions = conditions.filter(c => c.status === "active");
      const activeMedications = medications.filter(m => m.status === "active");
      
      res.json({
        summary: {
          activeConditions: activeConditions.length,
          activeMedications: activeMedications.length,
          totalLabResults: labData.results.length,
          abnormalLabResults: abnormalLabs.length,
          pendingOrders: upcomingOrders.length,
        },
        conditions: activeConditions,
        medications: activeMedications,
        recentAbnormalLabs: abnormalLabs.slice(0, 5).map(r => ({
          id: r.id,
          testName: r.testName,
          value: r.value,
          unit: r.unit,
          referenceRange: r.referenceRange,
          interpretation: r.interpretation,
          reportedAt: r.reportedAt,
        })),
        upcomingOrders: upcomingOrders.map(o => ({
          id: o.id,
          tests: o.tests.map(t => t.testName),
          status: o.status,
          providerName: o.providerName,
          estimatedCompletionAt: o.estimatedCompletionAt,
        })),
        disclaimer: "Health records are presented for informational purposes. Always consult your healthcare provider for medical decisions.",
      });
    } catch (error: any) {
      console.error("[PatientPortal] Error fetching health records summary:", error);
      res.status(500).json({ error: "Failed to fetch health records summary" });
    }
  });

  // ===== LAB ALERTS =====
  app.get("/api/patient-portal/:patientId/lab-alerts", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const ctx = getRequestContext(req);
      await logPatientPortalAccess(patientId, "lab-cds-alerts", ctx.userId, ctx.ipAddress, ctx.userAgent);
      
      const labData = getLabResults(patientId);
      const abnormalLabs = labData.results.filter(r => r.interpretation === "abnormal" || r.interpretation === "critical");
      
      const alerts = abnormalLabs.map(lab => {
        const alertLevel = lab.interpretation === "critical" ? "urgent" : "review";
        const suggestions = generateLabAlertSuggestions(lab.testName, lab.value, lab.unit, lab.referenceRange, lab.interpretation);
        return {
          id: `alert-${lab.id}`,
          labResultId: lab.id,
          testName: lab.testName,
          value: lab.value,
          unit: lab.unit,
          referenceRange: lab.referenceRange,
          interpretation: lab.interpretation,
          alertLevel,
          title: `${lab.interpretation === "critical" ? "Critical" : "Abnormal"}: ${lab.testName}`,
          description: suggestions.description,
          recommendations: suggestions.recommendations,
          educationTopics: suggestions.educationTopics,
          reportedAt: lab.reportedAt,
        };
      });
      
      res.json({
        alerts,
        totalAlerts: alerts.length,
        urgentCount: alerts.filter(a => a.alertLevel === "urgent").length,
        reviewCount: alerts.filter(a => a.alertLevel === "review").length,
        disclaimer: "These alerts are informational only and do NOT constitute clinical decision support. Always discuss results with your healthcare provider.",
      });
    } catch (error: any) {
      console.error("[PatientPortal] Error generating lab alerts:", error);
      res.status(500).json({ error: "Failed to generate lab alerts" });
    }
  });

  console.log("[Routes] Patient Portal routes registered at /api/patient-portal/*");
}
