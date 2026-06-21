import { Express, Request, Response } from "express";
import {
  translateWithGuardrails,
  summarizeWithGuardrails,
  validateTranslationContent,
  getAllSupportedLanguages,
  getLocalizedDisclaimer,
  getVerifyWithClinicianText,
  generateTimelineStorySummary,
  generateDocumentSummary,
  explainLabResults,
  summarizeImagingReport,
  type TimelineEvent,
  type SourceSnippet,
  type DocumentSummaryInput,
  type LabResult,
  type ImagingReportInput,
} from "./services/translation-guardrail-service";
import { generateMedicationSummary } from "./services/medication-summary-service";
import { generateSnapshotPdf, type SnapshotInput } from "./services/snapshot-pdf-service";
import { logPhiAccess } from "./security/hipaa-audit";

export function registerTranslationGuardrailRoutes(app: Express) {
  app.get("/api/translation/languages", async (_req: Request, res: Response) => {
    try {
      const languages = getAllSupportedLanguages();
      res.json({
        success: true,
        data: languages,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Error fetching languages:", error);
      res.status(500).json({ success: false, error: "Failed to fetch supported languages" });
    }
  });

  app.post("/api/translation/translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage, sourceDocument } = req.body;

      if (!text || !targetLanguage) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: text and targetLanguage",
        });
      }

      const source = sourceDocument || {
        name: "Unknown Document",
        date: new Date().toISOString().split("T")[0],
        source: "User Input",
      };

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "translate",
        resourceType: "Document",
        resourceId: source.id || "unknown",
        details: `Translated document to ${targetLanguage}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = await translateWithGuardrails(text, targetLanguage, source);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Translation provided for informational purposes.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Translation error:", error);
      res.status(500).json({ success: false, error: "Translation failed" });
    }
  });

  app.post("/api/translation/summarize", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage, sourceDocument } = req.body;

      if (!text || !targetLanguage) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: text and targetLanguage",
        });
      }

      const source = sourceDocument || {
        name: "Unknown Document",
        date: new Date().toISOString().split("T")[0],
        source: "User Input",
      };

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "summarize",
        resourceType: "Document",
        resourceId: source.id || "unknown",
        details: `Summarized document in ${targetLanguage}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = await summarizeWithGuardrails(text, targetLanguage, source);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Summary provided for informational purposes.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Summary error:", error);
      res.status(500).json({ success: false, error: "Summary generation failed" });
    }
  });

  app.post("/api/translation/validate", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: text",
        });
      }

      const result = validateTranslationContent(text);

      res.json({
        success: true,
        data: result,
        disclaimer: "Content validation for safety compliance.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Validation error:", error);
      res.status(500).json({ success: false, error: "Validation failed" });
    }
  });

  app.get("/api/translation/disclaimer/:languageCode", async (req: Request, res: Response) => {
    try {
      const { languageCode } = req.params;
      const disclaimer = getLocalizedDisclaimer(languageCode);
      const verifyText = getVerifyWithClinicianText(languageCode);

      res.json({
        success: true,
        data: {
          disclaimer,
          verifyWithClinician: verifyText,
          languageCode,
        },
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Disclaimer error:", error);
      res.status(500).json({ success: false, error: "Failed to get disclaimer" });
    }
  });

  app.post("/api/translation/timeline-summary", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, startDate, endDate, events, sourceSnippets } = req.body;

      if (!targetLanguage || !startDate || !endDate || !events) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage, startDate, endDate, events",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "generate_timeline_summary",
        resourceType: "TimelineSummary",
        resourceId: `${startDate}-${endDate}`,
        details: `Generated timeline story summary in ${targetLanguage} for ${startDate} to ${endDate}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = await generateTimelineStorySummary(
        targetLanguage,
        startDate,
        endDate,
        events as TimelineEvent[],
        sourceSnippets as SourceSnippet[] | undefined
      );

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Timeline summary provided for informational purposes.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Timeline summary error:", error);
      res.status(500).json({ success: false, error: "Timeline summary generation failed" });
    }
  });

  app.post("/api/translation/document-summary", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, documentType, documentText, provenance } = req.body;

      if (!targetLanguage || !documentType || !documentText || !provenance) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage, documentType, documentText, provenance",
        });
      }

      if (!provenance.sourceSystem || !provenance.documentDate || !provenance.recordId) {
        return res.status(400).json({
          success: false,
          error: "Missing provenance fields: sourceSystem, documentDate, recordId",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "generate_document_summary",
        resourceType: "Document",
        resourceId: provenance.recordId,
        details: `Generated ${documentType} summary in ${targetLanguage} from ${provenance.sourceSystem}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const input: DocumentSummaryInput = {
        targetLanguage,
        documentType,
        documentText,
        provenance,
      };

      const result = await generateDocumentSummary(input);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Document summary provided for informational purposes.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Document summary error:", error);
      res.status(500).json({ success: false, error: "Document summary generation failed" });
    }
  });

  app.post("/api/translation/lab-explanation", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, labs, optionalRecordSnippet } = req.body;

      if (!targetLanguage || !labs || !Array.isArray(labs) || labs.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage, labs (array)",
        });
      }

      for (const lab of labs) {
        if (!lab.name || !lab.value || !lab.unit || !lab.date || !lab.source || !lab.record_id) {
          return res.status(400).json({
            success: false,
            error: "Each lab must have: name, value, unit, date, source, record_id",
          });
        }
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "explain_lab_results",
        resourceType: "LabResult",
        resourceId: labs.map((l: LabResult) => l.record_id).join(","),
        details: `Explained ${labs.length} lab result(s) in ${targetLanguage}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = await explainLabResults(targetLanguage, labs as LabResult[], optionalRecordSnippet);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Lab explanations provided for informational purposes.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Lab explanation error:", error);
      res.status(500).json({ success: false, error: "Lab explanation generation failed" });
    }
  });

  app.post("/api/translation/imaging-summary", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, modality, body_part, report_text, source_system, report_date, record_id } = req.body;

      if (!targetLanguage || !modality || !body_part || !report_text || !source_system || !report_date || !record_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage, modality, body_part, report_text, source_system, report_date, record_id",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "summarize_imaging_report",
        resourceType: "ImagingReport",
        resourceId: record_id,
        details: `Summarized ${modality} ${body_part} report in ${targetLanguage}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const input: ImagingReportInput = {
        modality,
        body_part,
        report_text,
        source_system,
        report_date,
        record_id,
      };

      const result = await summarizeImagingReport(targetLanguage, input);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. Findings quoted directly from report text.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Imaging summary error:", error);
      res.status(500).json({ success: false, error: "Imaging report summary generation failed" });
    }
  });

  app.post("/api/translation/medication-summary", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, medications } = req.body;

      if (!targetLanguage || !medications || !Array.isArray(medications)) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage and medications (array)",
        });
      }

      for (const med of medications) {
        if (!med.drug_name || !med.dose || !med.source || !med.record_id || !med.status) {
          return res.status(400).json({
            success: false,
            error: "Each medication must have: drug_name, dose, source, record_id, status",
          });
        }
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "MedicationList",
        resourceId: medications.map((m: any) => m.record_id).join(","),
        details: `Summarized ${medications.length} medication(s) in ${targetLanguage}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const result = await generateMedicationSummary(medications, targetLanguage);

      res.json({
        success: true,
        data: result,
        disclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice. This is an informational summary of your medication list.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Medication summary error:", error);
      res.status(500).json({ success: false, error: "Medication summary generation failed" });
    }
  });

  app.post("/api/translation/snapshot-pdf", async (req: Request, res: Response) => {
    try {
      const { targetLanguage, bilingual, snapshot } = req.body;

      if (!targetLanguage || bilingual === undefined || !snapshot) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetLanguage, bilingual, snapshot",
        });
      }

      if (!snapshot.last_sync_date || !snapshot.sources || !Array.isArray(snapshot.sources)) {
        return res.status(400).json({
          success: false,
          error: "Snapshot must include: last_sync_date, sources (array)",
        });
      }

      await logPhiAccess({
        userId: (req as any).user?.id || "anonymous",
        action: "read",
        resourceType: "HealthSnapshot",
        resourceId: `snapshot-${new Date().toISOString()}`,
        details: `Generated ${bilingual ? "bilingual" : targetLanguage} snapshot PDF`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const snapshotInput: SnapshotInput = {
        problems: snapshot.problems || [],
        allergies: snapshot.allergies || [],
        meds: snapshot.meds || [],
        recent_labs: snapshot.recent_labs || [],
        recent_imaging: snapshot.recent_imaging || [],
        key_documents: snapshot.key_documents || [],
        last_sync_date: snapshot.last_sync_date,
        sources: snapshot.sources,
      };

      const result = await generateSnapshotPdf(snapshotInput, targetLanguage, bilingual);

      res.json({
        success: true,
        data: result,
        disclaimer: "FOR INFORMATIONAL PURPOSES ONLY. This is a data snapshot, not medical advice.",
      });
    } catch (error) {
      console.error("[TranslationGuardrail] Snapshot PDF error:", error);
      res.status(500).json({ success: false, error: "Snapshot PDF generation failed" });
    }
  });

  console.log("[Routes] Translation Guardrail routes registered at /api/translation/*");
}
