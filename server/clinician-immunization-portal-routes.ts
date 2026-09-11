import { Router, Request, Response } from "express";
import { 
  clinicianImmunizationPortalService,
  type ImmunizationReportRequest,
  type IISConnectionRequest,
} from "./services/clinician-immunization-portal-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and recorded history. This is NOT medical advice. Clinical judgment should always be applied.";

router.get("/clinicians", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { organizationId } = req.query;

    const clinicians = clinicianImmunizationPortalService.getAllClinicians(
      userId,
      organizationId as string | undefined
    );

    res.json({
      clinicians,
      count: clinicians.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve clinicians",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/clinicians/:clinicianId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { clinicianId } = req.params;

    const clinician = clinicianImmunizationPortalService.getClinicianProfile(clinicianId, userId);

    if (!clinician) {
      return res.status(404).json({
        error: "Clinician not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      clinician,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve clinician profile",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/dashboard/:clinicianId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { clinicianId } = req.params;

    const stats = clinicianImmunizationPortalService.getDashboardStats(clinicianId, userId);

    res.json({
      stats,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve dashboard stats",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/search", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { q, clinicianId, overdue, needsCatchUp, hasIISConsent } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const patients = clinicianImmunizationPortalService.searchPatients(
      (q as string) || "",
      clinicianId as string,
      userId,
      {
        overdue: overdue === "true",
        needsCatchUp: needsCatchUp === "true",
        hasIISConsent: hasIISConsent === "true",
      }
    );

    res.json({
      patients,
      count: patients.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to search patients",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const profile = clinicianImmunizationPortalService.getPatientImmunizationProfile(
      patientId,
      clinicianId as string,
      userId
    );

    if (!profile) {
      return res.status(404).json({
        error: "Patient not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      patient: profile,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve patient profile",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/:patientId/immunizations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, vaccineGroup, startDate, endDate, verificationStatus } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const records = clinicianImmunizationPortalService.getPatientImmunizationHistory(
      patientId,
      clinicianId as string,
      userId,
      {
        vaccineGroup: vaccineGroup as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        verificationStatus: verificationStatus as any,
      }
    );

    res.json({
      immunizations: records,
      count: records.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve immunization history",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/immunizations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, ...recordData } = req.body;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const record = clinicianImmunizationPortalService.addImmunizationRecord(
      {
        ...recordData,
        patientId,
        profileId: recordData.profileId || patientId.replace("pat", "prof"),
        source: "manual_entry",
        verificationStatus: "unverified",
        createdBy: clinicianId,
      },
      clinicianId,
      userId
    );

    res.status(201).json({
      record,
      message: "Immunization record added successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add immunization record",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.put("/patients/:patientId/immunizations/:recordId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId, recordId } = req.params;
    const { clinicianId, ...updates } = req.body;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const record = clinicianImmunizationPortalService.editImmunizationRecord(
      recordId,
      patientId,
      updates,
      clinicianId,
      userId
    );

    if (!record) {
      return res.status(404).json({
        error: "Immunization record not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      record,
      message: "Immunization record updated successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update immunization record",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/immunizations/:recordId/verify", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId, recordId } = req.params;
    const { clinicianId, verificationNotes } = req.body;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const record = clinicianImmunizationPortalService.verifyImmunizationRecord(
      recordId,
      patientId,
      clinicianId,
      userId,
      verificationNotes
    );

    if (!record) {
      return res.status(404).json({
        error: "Immunization record not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      record,
      message: "Immunization record verified successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to verify immunization record",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/iis-consent", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, ...consentData } = req.body;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const consent = clinicianImmunizationPortalService.recordIISConsent(
      {
        ...consentData,
        patientId,
        profileId: consentData.profileId || patientId.replace("pat", "prof"),
        clinicianId,
      },
      clinicianId,
      userId
    );

    res.status(201).json({
      consent,
      message: "IIS consent recorded successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to record IIS consent",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/iis-connect", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, stateCode, consentId, connectionType, priority } = req.body;

    if (!clinicianId || !stateCode || !consentId) {
      return res.status(400).json({
        error: "clinicianId, stateCode, and consentId are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const request: IISConnectionRequest = {
      patientId,
      profileId: patientId.replace("pat", "prof"),
      stateCode,
      connectionType: connectionType || "query",
      clinicianId,
      consentId,
      priority: priority || "normal",
    };

    const result = await clinicianImmunizationPortalService.connectToStateIIS(request, userId);

    res.json({
      result,
      message: `Successfully connected to ${stateCode} IIS`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to connect to State IIS",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/:patientId/iis-auto-detect", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISAutoDetection",
      resourceId: patientId,
      details: `Auto-detecting IIS connections for patient ${patientId}`,
    });

    const result = await clinicianImmunizationPortalService.autoDetectIISConnections(
      patientId,
      clinicianId as string,
      userId
    );

    res.json({
      detection: result,
      message: `Detected ${result.totalStatesDetected} potential state IIS connections`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to auto-detect IIS connections",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/iis-batch-connect", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, stateConnections } = req.body;

    if (!clinicianId || !stateConnections || !Array.isArray(stateConnections)) {
      return res.status(400).json({
        error: "clinicianId and stateConnections array are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISBatchConnection",
      resourceId: patientId,
      details: `Batch connecting to ${stateConnections.length} state IIS registries`,
    });

    const result = await clinicianImmunizationPortalService.batchConnectIIS(
      patientId,
      clinicianId,
      stateConnections,
      userId
    );

    res.json({
      ...result,
      message: `Batch connection completed: ${result.totalImported} records imported from ${stateConnections.length} states`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to batch connect to State IIS",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/iis-batch-consent", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, stateCodes } = req.body;

    if (!clinicianId || !stateCodes || !Array.isArray(stateCodes)) {
      return res.status(400).json({
        error: "clinicianId and stateCodes array are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IISBatchConsent",
      resourceId: patientId,
      details: `Creating batch consents for ${stateCodes.length} states`,
    });

    const consents = await clinicianImmunizationPortalService.createBatchConsents(
      patientId,
      clinicianId,
      stateCodes,
      userId
    );

    res.status(201).json({
      consents,
      message: `Created ${consents.length} consent records`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create batch consents",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/reports", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, ...reportOptions } = req.body;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const request: ImmunizationReportRequest = {
      patientId,
      profileId: reportOptions.profileId || patientId.replace("pat", "prof"),
      reportType: reportOptions.reportType || "full_history",
      format: reportOptions.format || "pdf",
      dateRange: reportOptions.dateRange,
      vaccineGroups: reportOptions.vaccineGroups,
      includeScheduleStatus: reportOptions.includeScheduleStatus !== false,
      includeRecommendations: reportOptions.includeRecommendations !== false,
      includeConsentHistory: reportOptions.includeConsentHistory || false,
      recipientInfo: reportOptions.recipientInfo,
      requestedBy: clinicianId,
      requestedAt: new Date().toISOString(),
    };

    const report = clinicianImmunizationPortalService.generateImmunizationReport(
      request,
      clinicianId,
      userId
    );

    res.status(201).json({
      report,
      message: "Report generated successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate report",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/:patientId/reports", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const reports = clinicianImmunizationPortalService.getPatientReports(
      patientId,
      clinicianId as string,
      userId
    );

    res.json({
      reports,
      count: reports.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve reports",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { reportId } = req.params;

    const report = clinicianImmunizationPortalService.getReportById(reportId, userId);

    if (!report) {
      return res.status(404).json({
        error: "Report not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      report,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve report",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/patients/:patientId/messages", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId, clinicianName, subject, content, messageType, priority, relatedVaccines, requiresResponse, responseDeadline } = req.body;

    if (!clinicianId || !subject || !content) {
      return res.status(400).json({
        error: "clinicianId, subject, and content are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const message = clinicianImmunizationPortalService.sendPatientMessage(
      {
        patientId,
        profileId: patientId.replace("pat", "prof"),
        clinicianId,
        clinicianName: clinicianName || "Clinician",
        subject,
        content,
        messageType: messageType || "general",
        priority: priority || "normal",
        relatedVaccines,
        status: "draft",
        requiresResponse: requiresResponse || false,
        responseDeadline,
      },
      userId
    );

    res.status(201).json({
      message: message,
      notification: "Message sent successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send message",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patients/:patientId/messages", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId } = req.params;
    const { clinicianId } = req.query;

    if (!clinicianId) {
      return res.status(400).json({
        error: "clinicianId query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const patientMessages = clinicianImmunizationPortalService.getPatientMessages(
      patientId,
      clinicianId as string,
      userId
    );

    res.json({
      messages: patientMessages,
      count: patientMessages.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve messages",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/message-templates", async (req: Request, res: Response) => {
  try {
    const templates = clinicianImmunizationPortalService.getMessageTemplates();

    res.json({
      templates,
      count: templates.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve message templates",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

console.log("[ClinicianImmunizationPortal] Routes module loaded with patient management, IIS connection, reporting, and messaging capabilities");

export default router;
