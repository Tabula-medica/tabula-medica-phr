import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireRole, requirePermission } from "./rbac";
import {
  insertDocumentAnnotationSchema,
  insertClinicianPatientRecommendationSchema,
  type DocumentAnnotation,
  type ClinicianPatientRecommendation,
  type UserRole,
} from "@shared/schema";

const router = Router();

interface ClinicianUser {
  id: string;
  name: string;
  role: UserRole;
  specialty?: string;
}

const isDevelopment = process.env.NODE_ENV !== "production";

function getCurrentClinician(req: any): ClinicianUser | null {
  if (req.user?.claims?.sub) {
    const user = req.user;
    return {
      id: user.claims.sub,
      name: user.claims.name || user.claims.email || "Clinician",
      role: (req.userRole as UserRole) || "clinician",
      specialty: "Internal Medicine",
    };
  }
  
  if (isDevelopment) {
    return {
      id: "clinician-001",
      name: "Dr. Sarah Chen",
      role: "clinician",
      specialty: "Internal Medicine",
    };
  }
  
  return null;
}

function checkClinicianAccess(req: Request, res: Response): ClinicianUser | null {
  const clinician = getCurrentClinician(req);
  if (!clinician) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (clinician.role !== "clinician" && clinician.role !== "provider" && clinician.role !== "admin") {
    res.status(403).json({ error: "Access denied. Clinician or Provider role required." });
    return null;
  }
  return clinician;
}

const documentAnnotations: DocumentAnnotation[] = [];
const clinicianRecommendations: ClinicianPatientRecommendation[] = [];

router.get("/patients", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  try {
    const patients = await storage.getPatients(100);
    
    const patientsWithSummary = await Promise.all(
      patients.map(async (patient) => {
        const medications = await storage.getMedicationsByPatient(patient.id);
        const allergies = await storage.getAllergiesByPatient(patient.id);
        const records = await storage.getMedicalRecordsByPatient(patient.id);
        const recommendations = clinicianRecommendations.filter(
          (r) => r.patientId === patient.id && r.clinicianId === clinician.id
        );

        return {
          id: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          medicationsCount: medications.filter((m) => m.status === "active").length,
          allergiesCount: allergies.length,
          documentsCount: records.length,
          pendingRecommendations: recommendations.filter((r) => r.status === "pending").length,
        };
      })
    );

    await logPhiAccess({
      userId: clinician.id,
      resourceType: "PatientList",
      action: "read",
      details: `Clinician viewed patient list (${patientsWithSummary.length} patients)`,
    });

    res.json(patientsWithSummary);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

router.get("/patients/:patientId", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { patientId } = req.params;

  try {
    const patient = await storage.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const [medications, allergies, records, allAppointments, labResults] = await Promise.all([
      storage.getMedicationsByPatient(patientId),
      storage.getAllergiesByPatient(patientId),
      storage.getMedicalRecordsByPatient(patientId),
      storage.getUpcomingAppointments(),
      storage.getLabResultsByPatient(patientId),
    ]);
    
    const appointments = allAppointments.filter((a) => a.patientId === patientId);

    const patientRecommendations = clinicianRecommendations.filter(
      (r) => r.patientId === patientId
    );

    const patientAnnotations = documentAnnotations.filter(
      (a) => records.some((r) => r.id === a.documentId)
    );

    const mappedLabResults = labResults.map((l) => ({
      id: l.id,
      testName: l.testName,
      value: l.value,
      unit: l.unit,
      referenceRange: l.referenceRange,
      status: l.status,
      date: l.date,
      isAbnormal: l.status === "abnormal" || l.status === "critical",
    }));

    await logPhiAccess({
      userId: clinician.id,
      patientId,
      resourceType: "Patient",
      action: "read",
      details: `Clinician viewed patient detail: ${patient.firstName} ${patient.lastName}`,
    });

    res.json({
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        email: patient.email,
        phone: patient.phone,
      },
      medications: medications.map((m) => ({
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        status: m.status,
        startDate: m.startDate,
      })),
      allergies: allergies.map((a) => ({
        id: a.id,
        name: a.name,
        severity: a.severity,
        reaction: a.reaction,
      })),
      documents: records.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        date: r.date,
        provider: r.provider,
        annotationsCount: patientAnnotations.filter((a) => a.documentId === r.id).length,
      })),
      labResults: mappedLabResults,
      appointments: appointments.map((a) => ({
        id: a.id,
        title: a.title,
        scheduledAt: a.scheduledAt,
        status: a.status,
        type: a.type,
      })),
      recommendations: patientRecommendations,
      aiInsights: generateAIInsights(medications, mappedLabResults),
    });
  } catch (error) {
    console.error("Error fetching patient detail:", error);
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
});

function generateAIInsights(
  medications: Array<{ status: string; name?: string }>,
  labResults: Array<{ isAbnormal: boolean; testName?: string }>
) {
  const insights: Array<{ type: string; title: string; description: string; priority: string }> = [];

  const activeMedications = medications.filter((m) => m.status === "active");
  if (activeMedications.length > 5) {
    insights.push({
      type: "alert",
      title: "Polypharmacy Consideration",
      description: `Patient is on ${activeMedications.length} active medications. Consider medication reconciliation review. This is an educational observation only, not clinical advice.`,
      priority: "high",
    });
  }

  const abnormalLabs = labResults.filter((l) => l.isAbnormal);
  if (abnormalLabs.length > 0) {
    insights.push({
      type: "alert",
      title: "Abnormal Lab Results Detected",
      description: `${abnormalLabs.length} lab result(s) are flagged as outside normal range. Review recommended. This is a data quality observation only, not clinical advice.`,
      priority: "high",
    });
  }

  return insights;
}

router.get("/patients/:patientId/documents/:documentId/annotations", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { patientId, documentId } = req.params;

  try {
    const annotations = documentAnnotations.filter((a) => a.documentId === documentId);

    await logPhiAccess({
      userId: clinician.id,
      patientId,
      resourceType: "DocumentAnnotation",
      action: "read",
      details: `Clinician viewed annotations for document ${documentId}`,
    });

    res.json(annotations);
  } catch (error) {
    console.error("Error fetching annotations:", error);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

router.post("/patients/:patientId/documents/:documentId/annotations", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { patientId, documentId } = req.params;

  try {
    const validatedData = insertDocumentAnnotationSchema.parse({
      ...req.body,
      documentId,
    });

    const annotation: DocumentAnnotation = {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId: validatedData.documentId,
      authorId: clinician.id,
      authorName: clinician.name,
      authorRole: clinician.role,
      body: validatedData.body,
      pageNumber: validatedData.pageNumber,
      anchorText: validatedData.anchorText,
      createdAt: new Date().toISOString(),
    };

    documentAnnotations.push(annotation);

    await logPhiAccess({
      userId: clinician.id,
      patientId,
      resourceType: "DocumentAnnotation",
      action: "write",
      details: `Clinician created annotation on document ${documentId}: ${annotation.id}`,
    });

    res.status(201).json(annotation);
  } catch (error) {
    console.error("Error creating annotation:", error);
    res.status(400).json({ error: "Failed to create annotation" });
  }
});

router.put("/annotations/:annotationId", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { annotationId } = req.params;

  try {
    const annotationIndex = documentAnnotations.findIndex((a) => a.id === annotationId);
    if (annotationIndex === -1) {
      return res.status(404).json({ error: "Annotation not found" });
    }

    const annotation = documentAnnotations[annotationIndex];
    if (annotation.authorId !== clinician.id && clinician.role !== "admin") {
      return res.status(403).json({ error: "Cannot edit annotations by other clinicians" });
    }

    documentAnnotations[annotationIndex] = {
      ...annotation,
      body: req.body.body || annotation.body,
      updatedAt: new Date().toISOString(),
    };

    await logPhiAccess({
      userId: clinician.id,
      resourceType: "DocumentAnnotation",
      action: "write",
      details: `Clinician updated annotation ${annotationId}`,
    });

    res.json(documentAnnotations[annotationIndex]);
  } catch (error) {
    console.error("Error updating annotation:", error);
    res.status(400).json({ error: "Failed to update annotation" });
  }
});

router.delete("/annotations/:annotationId", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { annotationId } = req.params;

  try {
    const annotationIndex = documentAnnotations.findIndex((a) => a.id === annotationId);
    if (annotationIndex === -1) {
      return res.status(404).json({ error: "Annotation not found" });
    }

    const annotation = documentAnnotations[annotationIndex];
    if (annotation.authorId !== clinician.id && clinician.role !== "admin") {
      return res.status(403).json({ error: "Cannot delete annotations by other clinicians" });
    }

    documentAnnotations.splice(annotationIndex, 1);

    await logPhiAccess({
      userId: clinician.id,
      resourceType: "DocumentAnnotation",
      action: "delete",
      details: `Clinician deleted annotation ${annotationId}`,
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting annotation:", error);
    res.status(400).json({ error: "Failed to delete annotation" });
  }
});

router.get("/patients/:patientId/recommendations", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { patientId } = req.params;

  try {
    const recommendations = clinicianRecommendations.filter((r) => r.patientId === patientId);

    await logPhiAccess({
      userId: clinician.id,
      patientId,
      resourceType: "ClinicianRecommendation",
      action: "read",
      details: `Clinician viewed recommendations for patient ${patientId}`,
    });

    res.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.post("/patients/:patientId/recommendations", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { patientId } = req.params;

  try {
    const validatedData = insertClinicianPatientRecommendationSchema.parse({
      ...req.body,
      patientId,
    });

    const recommendation: ClinicianPatientRecommendation = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clinicianId: clinician.id,
      clinicianName: clinician.name,
      clinicianSpecialty: clinician.specialty,
      patientId: validatedData.patientId,
      documentId: validatedData.documentId,
      title: validatedData.title,
      description: validatedData.description,
      category: validatedData.category,
      priority: validatedData.priority,
      status: "pending",
      dueDate: validatedData.dueDate,
      actionRequired: validatedData.actionRequired,
      relatedConditions: validatedData.relatedConditions,
      relatedMedications: validatedData.relatedMedications,
      isVisibleToPatient: validatedData.isVisibleToPatient,
      createdAt: new Date().toISOString(),
    };

    clinicianRecommendations.push(recommendation);

    await logPhiAccess({
      userId: clinician.id,
      patientId,
      resourceType: "ClinicianRecommendation",
      action: "write",
      details: `Clinician created recommendation: ${recommendation.title} (${recommendation.id})`,
    });

    res.status(201).json(recommendation);
  } catch (error) {
    console.error("Error creating recommendation:", error);
    res.status(400).json({ error: "Failed to create recommendation" });
  }
});

router.put("/recommendations/:recommendationId", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { recommendationId } = req.params;

  try {
    const recommendationIndex = clinicianRecommendations.findIndex((r) => r.id === recommendationId);
    if (recommendationIndex === -1) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    const recommendation = clinicianRecommendations[recommendationIndex];
    if (recommendation.clinicianId !== clinician.id && clinician.role !== "admin") {
      return res.status(403).json({ error: "Cannot edit recommendations by other clinicians" });
    }

    const {
      title,
      description,
      category,
      priority,
      status,
      dueDate,
      actionRequired,
      relatedConditions,
      relatedMedications,
      isVisibleToPatient,
      documentId,
    } = req.body;

    const allowedUpdates = Object.fromEntries(
      Object.entries({
        title,
        description,
        category,
        priority,
        status,
        dueDate,
        actionRequired,
        relatedConditions,
        relatedMedications,
        isVisibleToPatient,
        documentId,
      }).filter(([, v]) => v !== undefined),
    );

    clinicianRecommendations[recommendationIndex] = {
      ...recommendation,
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    };

    await logPhiAccess({
      userId: clinician.id,
      resourceType: "ClinicianRecommendation",
      action: "write",
      details: `Clinician updated recommendation ${recommendationId}`,
    });

    res.json(clinicianRecommendations[recommendationIndex]);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    res.status(400).json({ error: "Failed to update recommendation" });
  }
});

router.delete("/recommendations/:recommendationId", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  const { recommendationId } = req.params;

  try {
    const recommendationIndex = clinicianRecommendations.findIndex((r) => r.id === recommendationId);
    if (recommendationIndex === -1) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    const recommendation = clinicianRecommendations[recommendationIndex];
    if (recommendation.clinicianId !== clinician.id && clinician.role !== "admin") {
      return res.status(403).json({ error: "Cannot delete recommendations by other clinicians" });
    }

    clinicianRecommendations.splice(recommendationIndex, 1);

    await logPhiAccess({
      userId: clinician.id,
      resourceType: "ClinicianRecommendation",
      action: "delete",
      details: `Clinician deleted recommendation ${recommendationId}`,
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting recommendation:", error);
    res.status(400).json({ error: "Failed to delete recommendation" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  const clinician = checkClinicianAccess(req, res);
  if (!clinician) return;

  try {
    const patients = await storage.getPatients(100);
    const allRecommendations = clinicianRecommendations.filter((r) => r.clinicianId === clinician.id);
    
    const pendingRecommendations = allRecommendations.filter((r) => r.status === "pending");
    const acknowledgedRecommendations = allRecommendations.filter((r) => r.status === "acknowledged");
    const completedRecommendations = allRecommendations.filter((r) => r.status === "completed");

    const recentActivity = [
      ...allRecommendations.slice(-5).map((r) => ({
        type: "recommendation" as const,
        id: r.id,
        title: r.title,
        patientId: r.patientId,
        timestamp: r.createdAt,
      })),
      ...documentAnnotations.filter((a) => a.authorId === clinician.id).slice(-5).map((a) => ({
        type: "annotation" as const,
        id: a.id,
        title: `Annotation on document`,
        documentId: a.documentId,
        timestamp: a.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    res.json({
      clinician: {
        id: clinician.id,
        name: clinician.name,
        specialty: clinician.specialty,
      },
      stats: {
        totalPatients: patients.length,
        pendingRecommendations: pendingRecommendations.length,
        acknowledgedRecommendations: acknowledgedRecommendations.length,
        completedRecommendations: completedRecommendations.length,
        totalAnnotations: documentAnnotations.filter((a) => a.authorId === clinician.id).length,
      },
      recentActivity,
      urgentItems: allRecommendations.filter((r) => r.priority === "urgent" && r.status === "pending"),
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

export default router;
