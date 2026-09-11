import { Router, Request, Response } from "express";
import { vaccineScheduleEngine } from "./services/vaccine-schedule-engine";
import { fhirImmunizationIngestionService } from "./services/fhir-immunization-ingestion-service";
import vaccineRulesEngineV2, { 
  type ImmunocompromiseStatus, 
  type ScheduleEvaluationResult 
} from "./services/vaccine-rules-engine-v2";
import { logPhiAccess } from "./security/hipaa-audit";
import { lookupCVX, resolveCVXFromInput, getAllCVXForGroup, getAllVaccineGroups, getAllActiveCVXCodes } from "./services/cvx-registry";
import { requireUser, getUserId, assertOwnsProfile } from "./middleware/require-user";
import { storage } from "./storage";

const router = Router();

// P0-2: every route in this router requires an authenticated user. PHI routes
// carrying :patientId/:profileId additionally assert profile ownership below.
router.use(requireUser);

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and your recorded history. This is NOT medical advice. Always confirm with your clinician or pharmacist before receiving any vaccine.";

router.get("/cvx-codes", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "CVXCodes",
      resourceId: "list",
      details: "List CVX vaccine codes",
    });

    const codes = vaccineScheduleEngine.getAllCVXCodes();
    res.json({
      codes,
      count: codes.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve CVX codes",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/cvx-lookup/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const entry = lookupCVX(code);
    if (!entry) {
      return res.status(404).json({ error: `CVX code "${code}" not found` });
    }
    const groupCodes = getAllCVXForGroup(entry.vaccineGroup);
    res.json({
      entry,
      relatedCodes: groupCodes.filter(c => c.code !== entry.code),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to lookup CVX code" });
  }
});

router.get("/cvx-resolve", async (req: Request, res: Response) => {
  try {
    const input = req.query.q as string;
    if (!input) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    const entry = resolveCVXFromInput(input);
    if (!entry) {
      return res.status(404).json({ error: `No CVX match for "${input}"`, resolved: false });
    }
    res.json({
      resolved: true,
      entry,
      vaccineGroup: entry.vaccineGroup,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve CVX code" });
  }
});

router.get("/cvx-registry/full", async (req: Request, res: Response) => {
  try {
    const active = getAllActiveCVXCodes();
    const groups = getAllVaccineGroups();
    res.json({
      codes: active,
      groups,
      totalActive: active.length,
      totalGroups: groups.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve CVX registry" });
  }
});

router.get("/vaccine-groups", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineGroups",
      resourceId: "list",
      details: "List vaccine groups",
    });

    const groups = vaccineScheduleEngine.getVaccineGroups();
    res.json({
      groups,
      count: groups.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve vaccine groups",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/schedule-rules", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineScheduleRules",
      resourceId: "list",
      details: "List vaccine schedule rules",
    });

    const rules = vaccineScheduleEngine.getAllScheduleRules();
    res.json({
      rules,
      count: rules.length,
      scheduleSource: "CDC/ACIP",
      lastUpdated: "2024-08-28",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve schedule rules",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/schedule-rules/:vaccineGroup", async (req: Request, res: Response) => {
  try {
    const { vaccineGroup } = req.params;
    const rule = vaccineScheduleEngine.getScheduleRule(vaccineGroup);
    
    if (!rule) {
      return res.status(404).json({
        error: "Schedule rule not found",
        vaccineGroup,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      rule,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve schedule rule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/immunizations/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const userId = getUserId(req);

    const events = await vaccineScheduleEngine.getImmunizationEvents(patientId, profileId, userId);
    res.json({
      events,
      count: events.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve immunization events",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/immunizations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const eventData = req.body;

    if (!eventData.patientId || !eventData.profileId || !eventData.vaccineCode || !eventData.dateAdministered) {
      return res.status(400).json({
        error: "Missing required fields: patientId, profileId, vaccineCode, dateAdministered",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const event = await vaccineScheduleEngine.addImmunizationEvent(eventData, userId);
    res.json({
      success: true,
      event,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add immunization event",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/summary/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const { birthDate } = req.query;
    const userId = getUserId(req);

    if (!birthDate || typeof birthDate !== "string") {
      return res.status(400).json({
        error: "birthDate query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const summary = await vaccineScheduleEngine.getVaccineSummary(patientId, profileId, birthDate, userId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate vaccine summary",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/series-status/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const { birthDate } = req.query;
    const userId = getUserId(req);

    if (!birthDate || typeof birthDate !== "string") {
      return res.status(400).json({
        error: "birthDate query parameter is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const statuses = await vaccineScheduleEngine.evaluateAllSeries(patientId, profileId, birthDate, userId);
    res.json({
      statuses,
      count: statuses.length,
      evaluatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to evaluate series status",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/risk-flags/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const userId = getUserId(req);

    const flags = await vaccineScheduleEngine.getPatientRiskFlags(patientId, profileId, userId);
    res.json({
      riskFlags: flags,
      availableFlags: [
        { id: "pregnancy", label: "Pregnancy", description: "Currently pregnant or planning pregnancy" },
        { id: "immunocompromised", label: "Immunocompromised", description: "Weakened immune system (HIV, cancer treatment, organ transplant, etc.)" },
        { id: "chronic_heart", label: "Chronic Heart Disease", description: "Heart failure, coronary artery disease, cardiomyopathies" },
        { id: "chronic_lung", label: "Chronic Lung Disease", description: "Asthma, COPD, cystic fibrosis, pulmonary fibrosis" },
        { id: "chronic_liver", label: "Chronic Liver Disease", description: "Hepatitis, cirrhosis, fatty liver disease" },
        { id: "chronic_kidney", label: "Chronic Kidney Disease", description: "Kidney disease, dialysis" },
        { id: "diabetes", label: "Diabetes", description: "Type 1 or Type 2 diabetes" },
        { id: "asplenia", label: "Asplenia", description: "No spleen or non-functioning spleen" },
        { id: "cochlear_implant", label: "Cochlear Implant", description: "Has cochlear implant" },
        { id: "csf_leak", label: "CSF Leak", description: "Cerebrospinal fluid leak" },
        { id: "smoker", label: "Smoker", description: "Current smoker" },
        { id: "long_term_care", label: "Long-term Care", description: "Resident of long-term care facility" },
        { id: "healthcare_worker", label: "Healthcare Worker", description: "Works in healthcare setting" },
        { id: "travel", label: "International Travel", description: "Plans international travel" },
      ],
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve risk flags",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.put("/risk-flags/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const { flags } = req.body;
    const userId = getUserId(req);

    if (!Array.isArray(flags)) {
      return res.status(400).json({
        error: "flags must be an array",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const result = await vaccineScheduleEngine.updatePatientRiskFlags(patientId, profileId, flags, userId);
    res.json({
      success: true,
      riskFlags: result,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update risk flags",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/reminders/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const userId = getUserId(req);

    const reminders = await vaccineScheduleEngine.getReminders(patientId, profileId, userId);
    res.json({
      reminders,
      count: reminders.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve reminders",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/reminders", async (req: Request, res: Response) => {
  try {
    const { patientId, profileId, vaccineGroup, dueDate, reminderDate, channel } = req.body;
    const userId = getUserId(req);

    if (!patientId || !profileId || !vaccineGroup || !dueDate || !reminderDate || !channel) {
      return res.status(400).json({
        error: "Missing required fields",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const reminder = await vaccineScheduleEngine.createReminder(
      patientId,
      profileId,
      vaccineGroup,
      dueDate,
      reminderDate,
      channel,
      userId
    );

    res.json({
      success: true,
      reminder,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create reminder",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/evidence/:patientId/:profileId", assertOwnsProfile("profileId"), async (req: Request, res: Response) => {
  try {
    const { patientId, profileId } = req.params;
    const userId = getUserId(req);

    const files = await vaccineScheduleEngine.getEvidenceFiles(patientId, profileId, userId);
    res.json({
      files,
      count: files.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve evidence files",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/evidence", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const fileData = req.body;

    if (!fileData.patientId || !fileData.profileId || !fileData.fileName || !fileData.fileUrl) {
      return res.status(400).json({
        error: "Missing required fields: patientId, profileId, fileName, fileUrl",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const file = await vaccineScheduleEngine.addEvidenceFile(fileData, userId);
    res.json({
      success: true,
      file,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add evidence file",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/fhir-import", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { bundle, patientId, profileId, sourceEhrName, options } = req.body;

    if (!bundle || !patientId || !profileId || !sourceEhrName) {
      return res.status(400).json({
        error: "Missing required fields: bundle, patientId, profileId, sourceEhrName",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationFHIRImport",
      resourceId: `${patientId}/${profileId}`,
      details: `FHIR bundle import from ${sourceEhrName}`,
    });

    const result = await fhirImmunizationIngestionService.importFromBundle(
      bundle,
      patientId,
      profileId,
      sourceEhrName,
      userId,
      options || {}
    );

    res.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      duplicates: result.duplicates,
      errors: result.errors,
      events: result.events,
      conflicts: result.conflicts,
      errorDetails: result.errorDetails,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to import FHIR immunizations",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/fhir-import/ehr", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    // P0-2 SSRF/token-relay fix: never accept accessToken or fhirServerUrl from
    // the request body. Resolve the caller-owned connection server-side and use
    // ONLY its stored (transparently decrypted) token + FHIR base URL.
    const { connectionId, patientId, profileId, patientFhirId, ehrName } = req.body;

    if (!connectionId || !patientId || !profileId || !patientFhirId || !ehrName) {
      return res.status(400).json({
        error: "Missing required fields for EHR import",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const connection = (await storage.getEhrConnections(userId)).find((c) => c.id === connectionId);
    const accessToken = connection?.tokens?.accessToken;
    const fhirServerUrl = connection?.fhirConfig?.fhirBaseUrl;
    if (!connection || !accessToken || !fhirServerUrl) {
      return res.status(404).json({
        error: "EHR connection not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationEHRFetch",
      resourceId: connectionId,
      details: `Fetching immunizations from ${ehrName}`,
    });

    const result = await fhirImmunizationIngestionService.fetchAndImportFromEHR(
      connectionId,
      patientId,
      profileId,
      patientFhirId,
      accessToken,
      fhirServerUrl,
      ehrName,
      userId
    );

    res.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      duplicates: result.duplicates,
      errors: result.errors,
      events: result.events,
      conflicts: result.conflicts,
      errorDetails: result.errorDetails,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to import from EHR",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/fhir-import/resolve-conflict", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { conflict, resolution } = req.body;

    if (!conflict || !resolution) {
      return res.status(400).json({
        error: "Missing required fields: conflict, resolution",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const validResolutions = ["skip", "merge", "override"];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({
        error: `Invalid resolution. Must be one of: ${validResolutions.join(", ")}`,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationConflictResolution",
      resourceId: conflict.id,
      details: `Resolving conflict with ${resolution}`,
    });

    const result = await fhirImmunizationIngestionService.resolveConflict(conflict, resolution, userId);

    res.json({
      success: result.success,
      event: result.event,
      message: result.message,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to resolve conflict",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/fhir-import/sources", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRImportSources",
      resourceId: "list",
      details: "List available FHIR import sources",
    });

    res.json({
      sources: [
        { id: "fastenhealth", name: "Fasten Health", supported: true, fhirVersion: "R4" },
      ],
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list import sources",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/rules-engine/version", async (req: Request, res: Response) => {
  try {
    res.json({
      version: vaccineRulesEngineV2.getVersion(),
      effectiveDate: vaccineRulesEngineV2.getEffectiveDate(),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get rules engine version",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/rules-engine/export", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineRulesExport",
      resourceId: "full-export",
      details: "Exported vaccine rules for auditing",
    });

    const exportData = vaccineRulesEngineV2.exportRulesForAudit(userId);
    
    res.json({
      ...exportData,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to export vaccine rules",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/rules-engine/rules", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { vaccineGroup } = req.query;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineRules",
      resourceId: vaccineGroup as string || "all",
      details: `Retrieved vaccine rules${vaccineGroup ? ` for ${vaccineGroup}` : ""}`,
    });

    if (vaccineGroup) {
      const rule = vaccineRulesEngineV2.getRuleByVaccineGroup(vaccineGroup as string);
      if (!rule) {
        return res.status(404).json({
          error: `No rules found for vaccine group: ${vaccineGroup}`,
          disclaimer: NO_CDS_DISCLAIMER,
        });
      }
      return res.json({
        rule,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const rules = vaccineRulesEngineV2.getAllRules();
    res.json({
      rules,
      count: rules.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve vaccine rules",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/rules-engine/evaluate", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { 
      patientId,
      profileId,
      vaccineGroup, 
      birthDate, 
      dosesWithDates, 
      immunocompromiseStatus 
    } = req.body;

    if (!vaccineGroup || !birthDate) {
      return res.status(400).json({
        error: "vaccineGroup and birthDate are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineScheduleEvaluation",
      resourceId: `${patientId}/${profileId}/${vaccineGroup}`,
      details: `Evaluated vaccine schedule for ${vaccineGroup}`,
    });

    const evaluation = vaccineRulesEngineV2.evaluateScheduleWithIntervals(
      vaccineGroup,
      birthDate,
      dosesWithDates || [],
      immunocompromiseStatus as ImmunocompromiseStatus | undefined
    );

    evaluation.patientId = patientId || "";
    evaluation.profileId = profileId || "";

    res.json({
      evaluation,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to evaluate vaccine schedule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/rules-engine/catch-up", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId, profileId, vaccineGroup, ageMonths, dosesReceived, lastDoseDate } = req.body;

    if (!vaccineGroup || ageMonths === undefined) {
      return res.status(400).json({
        error: "vaccineGroup and ageMonths are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineCatchUpSchedule",
      resourceId: `${patientId}/${profileId}/${vaccineGroup}`,
      details: `Calculated catch-up schedule for ${vaccineGroup}`,
    });

    const catchUp = vaccineRulesEngineV2.calculateCatchUpSchedule(
      vaccineGroup,
      ageMonths,
      dosesReceived || 0,
      lastDoseDate
    );

    if (!catchUp) {
      return res.status(404).json({
        error: "No applicable catch-up schedule found",
        details: "Patient may be up-to-date or outside catch-up age range",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      catchUp,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to calculate catch-up schedule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/rules-engine/immunocompromise-evaluation", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientId, profileId, vaccineGroup, immunocompromiseStatus } = req.body;

    if (!vaccineGroup || !immunocompromiseStatus) {
      return res.status(400).json({
        error: "vaccineGroup and immunocompromiseStatus are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunocompromiseEvaluation",
      resourceId: `${patientId}/${profileId}/${vaccineGroup}`,
      details: `Evaluated immunocompromise status for ${vaccineGroup} vaccination`,
    });

    const evaluation = vaccineRulesEngineV2.evaluateImmunocompromiseStatus(
      vaccineGroup,
      immunocompromiseStatus as ImmunocompromiseStatus
    );

    const isLive = vaccineRulesEngineV2.isLiveVaccine(vaccineGroup);

    res.json({
      evaluation: {
        ...evaluation,
        isLiveVaccine: isLive,
        liveVaccineWarning: isLive && immunocompromiseStatus.level !== "none" 
          ? "This is a live vaccine. Special considerations apply for immunocompromised patients."
          : undefined,
      },
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to evaluate immunocompromise status",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/rules-engine/contraindications/:vaccineGroup", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { vaccineGroup } = req.params;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineContraindications",
      resourceId: vaccineGroup,
      details: `Retrieved contraindications and precautions for ${vaccineGroup}`,
    });

    const contraindications = vaccineRulesEngineV2.getContraindications(vaccineGroup);
    const precautions = vaccineRulesEngineV2.getPrecautions(vaccineGroup);

    res.json({
      vaccineGroup,
      contraindications,
      precautions,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve contraindications",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/rules-engine/special-populations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { vaccineGroup, riskFlags } = req.body;

    if (!vaccineGroup) {
      return res.status(400).json({
        error: "vaccineGroup is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineSpecialPopulations",
      resourceId: vaccineGroup,
      details: `Retrieved special population recommendations for ${vaccineGroup} with risk flags: ${(riskFlags || []).join(", ") || "none"}`,
    });

    const recommendations = vaccineRulesEngineV2.getSpecialPopulationRecommendations(
      vaccineGroup,
      riskFlags || []
    );

    res.json({
      vaccineGroup,
      riskFlags: riskFlags || [],
      recommendations,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve special population recommendations",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

console.log("[VaccineRoutes] Routes module loaded with NO-CDS compliance, FHIR import, and Rules Engine V2");

export default router;
