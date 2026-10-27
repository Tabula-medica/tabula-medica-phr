// @ts-nocheck
import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import {
  processDocument,
  processDocumentFromFile,
  getVerificationQueue,
  getExtraction,
  getAllExtractions,
  verifyField,
  approveExtraction,
  rejectExtraction,
  generateBenchmarkReport,
  type DocumentType,
} from "./document-extraction-service";
import { getClinicalRanges } from "./clinical-range-validation";

const scanUploadsDir = path.join(process.cwd(), "uploads", "scans");
if (!fs.existsSync(scanUploadsDir)) fs.mkdirSync(scanUploadsDir, { recursive: true });
const scanUpload = multer({ dest: scanUploadsDir, limits: { fileSize: 15 * 1024 * 1024 } });

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

export function registerDocumentExtractionRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
) {
  app.get("/api/extraction/benchmark/report", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const report = generateBenchmarkReport();
    res.json({ report });
  });

  app.get("/api/extraction/ranges/reference", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    res.json({ ranges: getClinicalRanges() });
  });

  app.post(
    "/api/scan/paper-record",
    requireAuth,
    scanUpload.single("file"),
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
      if (!allowed.includes(file.mimetype)) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: "Unsupported file type" });
      }
      // HEIC isn't directly readable by Gemini vision; reject up-front with a
      // clear message rather than fail mid-pipeline. (Client can convert to JPEG.)
      if (file.mimetype === "image/heic") {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: "HEIC not supported — please use JPEG or PNG" });
      }

      const documentType = (req.body.documentType || "unknown") as DocumentType;
      const validTypes: DocumentType[] = [
        "lab_report", "discharge_summary", "progress_note",
        "radiology_report", "pathology_report", "prescription",
        "referral_letter", "insurance_eob", "operative_report",
      ];
      const docType = validTypes.includes(documentType) ? documentType : "progress_note";
      const documentId = `scan_${path.basename(file.path)}`;

      try {
        const extraction = await processDocumentFromFile(
          documentId,
          docType,
          file.path,
          file.mimetype,
          userId,
        );
        res.json({ documentId, extraction });
      } catch (err: any) {
        console.error("[scan/paper-record] extraction failed:", err?.message || err);
        res.status(500).json({ error: "Extraction failed", detail: err?.message || String(err) });
      } finally {
        // Always delete the uploaded file after extraction (PHI hygiene).
        fs.unlink(file.path, () => {});
      }
    }
  );

  app.post("/api/extraction/process", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { documentId, documentType, dpi, fileSize, format } = req.body;
    if (!documentId || !documentType) {
      return res.status(400).json({ error: "documentId and documentType required" });
    }

    const validTypes: DocumentType[] = [
      "lab_report", "discharge_summary", "progress_note",
      "radiology_report", "pathology_report", "prescription",
      "referral_letter", "insurance_eob", "operative_report",
    ];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: "Invalid documentType" });
    }

    const record = processDocument(documentId, documentType, dpi ?? 300, fileSize ?? 2000000, format ?? "pdf", userId);
    res.json({ extraction: record });
  });

  app.get("/api/extraction/queue", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const status = req.query.status as string | undefined;
    const queue = getVerificationQueue(userId, status);
    res.json({ queue, total: queue.length });
  });

  app.get("/api/extraction/list", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const all = getAllExtractions(userId);
    res.json({
      extractions: all.map(e => ({
        id: e.id,
        documentId: e.documentId,
        documentType: e.documentType,
        status: e.status,
        overallConfidence: e.overallConfidence,
        conflictCount: e.conflicts.filter(c => !c.resolved).length,
        fieldCount: e.consensusFields.length,
        createdAt: e.createdAt,
        qualityGrade: e.quality.grade,
      })),
      total: all.length,
    });
  });

  app.get("/api/extraction/:id", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const record = getExtraction(req.params.id, userId);
    if (!record) return res.status(404).json({ error: "Extraction not found" });
    res.json({ extraction: record });
  });

  app.post("/api/extraction/:id/verify-field", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const check = getExtraction(req.params.id, userId);
    if (!check) return res.status(404).json({ error: "Extraction not found" });
    const { fieldKey, correctedValue, reason } = req.body;
    if (!fieldKey || correctedValue === undefined || !reason) {
      return res.status(400).json({ error: "fieldKey, correctedValue, and reason required" });
    }
    const record = verifyField(req.params.id, fieldKey, correctedValue, userId, reason);
    if (!record) return res.status(404).json({ error: "Extraction or field not found" });
    res.json({ extraction: record });
  });

  app.post("/api/extraction/:id/approve", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const check = getExtraction(req.params.id, userId);
    if (!check) return res.status(404).json({ error: "Extraction not found" });
    const record = approveExtraction(req.params.id, userId);
    if (!record) return res.status(404).json({ error: "Extraction not found" });
    res.json({ extraction: record });
  });

  app.post("/api/extraction/:id/reject", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const check = getExtraction(req.params.id, userId);
    if (!check) return res.status(404).json({ error: "Extraction not found" });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "reason required" });
    const record = rejectExtraction(req.params.id, userId, reason);
    if (!record) return res.status(404).json({ error: "Extraction not found" });
    res.json({ extraction: record });
  });
}
