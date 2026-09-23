import type { Express } from "express";
import { documentOcrService, documentSearchService, type DocumentSearchParams } from "./services/document-ocr-service";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId, aiUserRateLimiter } from "./middleware/require-user";
import { storage } from "./storage";

const ocrRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
  documentId: z.string().min(1),
  fileName: z.string().min(1),
  patientId: z.string().min(1) // P0-4: required for ownership scoping
});

const textExtractionSchema = z.object({
  text: z.string().min(1),
  documentId: z.string().min(1),
  fileName: z.string().min(1),
  patientId: z.string().min(1) // P0-4: required for ownership scoping
});

const searchSchema = z.object({
  query: z.string().optional(),
  category: z.enum(["discharge_summary", "lab", "imaging", "insurance", "referral", "other"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  provider: z.string().optional(),
  facility: z.string().optional(),
  hasMedications: z.boolean().optional(),
  hasDiagnoses: z.boolean().optional(),
  hasLabResults: z.boolean().optional(),
  patientId: z.string().optional(),
  sortBy: z.enum(["date", "relevance", "name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().optional(),
  offset: z.number().optional()
});

export function registerDocumentOcrRoutes(app: Express): void {
  app.post("/api/documents/ocr/extract-image", requireUser, aiUserRateLimiter, async (req, res) => {
    try {
      const parsed = ocrRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { imageBase64, mimeType, documentId, fileName, patientId } = parsed.data;

      // P0-4: reject oversized payloads before decoding (memory/CPU abuse guard).
      if (imageBase64.length > 10_000_000) {
        return res.status(413).json({ error: "Image too large (max ~10MB)." });
      }

      // P0-4: authenticated user + ownership of the target patient/profile.
      const userId = getUserId(req);
      const profiles = await storage.getProfiles(userId);
      if (!profiles.some((p: any) => p.id === patientId || (p as any).patientId === patientId)) {
        return res.status(404).json({ error: "Not found" });
      }

      console.log(`[OCR Route] Processing image extraction for ${fileName}`);

      const result = await documentOcrService.extractFromImage(
        imageBase64,
        mimeType,
        documentId,
        fileName
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      if (result.data) {
        documentSearchService.addDocument(userId, result.data);
      }

      await logPhiAccess({
        userId,
        patientId,
        resourceType: "DocumentOCR",
        action: "write",
        details: `OCR image extraction completed for document: ${documentId}, file: ${fileName}`
      });

      res.json({
        success: true,
        data: result.data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Data extraction for informational purposes. NOT medical advice."
      });
    } catch (error) {
      console.error("[OCR Route] Error:", error);
      res.status(500).json({ error: "OCR extraction failed" });
    }
  });

  app.post("/api/documents/ocr/extract-text", requireUser, aiUserRateLimiter, async (req, res) => {
    try {
      const parsed = textExtractionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { text, documentId, fileName, patientId } = parsed.data;

      // P0-4: authenticated user + ownership of the target patient/profile.
      const userId = getUserId(req);
      const profiles = await storage.getProfiles(userId);
      if (!profiles.some((p: any) => p.id === patientId || (p as any).patientId === patientId)) {
        return res.status(404).json({ error: "Not found" });
      }

      console.log(`[OCR Route] Processing text extraction for ${fileName}`);

      const result = await documentOcrService.extractFromPdf(text, documentId, fileName);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      if (result.data) {
        documentSearchService.addDocument(userId, result.data);
      }

      await logPhiAccess({
        userId,
        patientId,
        resourceType: "DocumentOCR",
        action: "write",
        details: `OCR text extraction completed for document: ${documentId}, file: ${fileName}`
      });

      res.json({
        success: true,
        data: result.data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Data extraction for informational purposes. NOT medical advice."
      });
    } catch (error) {
      console.error("[OCR Route] Error:", error);
      res.status(500).json({ error: "Text extraction failed" });
    }
  });

  app.post("/api/documents/search", requireUser, aiUserRateLimiter, async (req, res) => {
    try {
      const parsed = searchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const userId = getUserId(req);
      const params: DocumentSearchParams = parsed.data;
      const results = documentSearchService.search(userId, params);

      const patientId = params.patientId || "unknown";
      
      await logPhiAccess({
        userId,
        patientId,
        resourceType: "DocumentSearch",
        action: "read",
        details: `Document search performed: query="${params.query || 'all'}", results=${results.length}`
      });

      res.json({
        success: true,
        results,
        total: results.length,
        params
      });
    } catch (error) {
      console.error("[Search Route] Error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/documents/ocr/:documentId", requireUser, async (req, res) => {
    try {
      const { documentId } = req.params;
      const userId = getUserId(req);
      // P0-4: getDocument is namespaced by userId — a document owned by another
      // user is not returned (404), closing the bare-ID IDOR.
      const document = documentSearchService.getDocument(userId, documentId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const patientId = document.patientName || "unknown";
      
      await logPhiAccess({
        userId,
        patientId,
        resourceType: "DocumentOCR",
        action: "read",
        details: `OCR data accessed for document: ${documentId}, file: ${document.fileName}`
      });

      res.json({
        success: true,
        data: document,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. NOT medical advice."
      });
    } catch (error) {
      console.error("[OCR Route] Error:", error);
      res.status(500).json({ error: "Failed to retrieve document" });
    }
  });

  console.log("[Routes] Document OCR routes registered at /api/documents/ocr/*");
}
