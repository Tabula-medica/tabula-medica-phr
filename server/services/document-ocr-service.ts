import type { AutoTagCategory } from "@shared/schema";
import { documentOcrResultsTable } from "@shared/schema";
import { generatePhiSafeVision, generatePhiSafeChat } from "./ai-gateway";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

export interface ExtractedDocumentData {
  documentId: string;
  extractedText: string;
  structuredData: {
    patientName?: string;
    dateOfBirth?: string;
    documentDate?: string;
    facility?: string;
    provider?: string;
    documentType?: string;
    diagnoses?: Array<{ code: string; description: string }>;
    medications?: Array<{ name: string; dosage: string; frequency: string }>;
    labResults?: Array<{ test: string; value: string; unit: string; referenceRange?: string; status?: string }>;
    vitalSigns?: Array<{ type: string; value: string; unit: string }>;
    procedures?: Array<{ code?: string; description: string; date?: string }>;
    allergies?: string[];
    summary?: string;
  };
  category: AutoTagCategory;
  confidence: number;
  rawOcrText?: string;
  processingTime: number;
  extractedAt: string;
}

export interface OcrProcessingResult {
  success: boolean;
  data?: ExtractedDocumentData;
  error?: string;
}

const NO_CDS_DISCLAIMER = "EDUCATIONAL CONTENT ONLY. NOT MEDICAL ADVICE. Data extraction for informational purposes only.";

class DocumentOcrService {
  async extractFromImage(
    imageBase64: string,
    mimeType: string,
    documentId: string,
    fileName: string
  ): Promise<OcrProcessingResult> {
    const startTime = Date.now();
    
    console.log(`[OCR] Starting extraction for document ${documentId}: ${fileName}`);
    
    try {
      const content = await generatePhiSafeVision({
        base64Image: imageBase64,
        imageMimeType: mimeType,
        prompt: `Extract all information from this medical document image. Document name: ${fileName}`,
        system: `You are a medical document OCR and data extraction system. Your job is to:
1. Extract ALL text from the document image
2. Identify and structure medical information (lab results, medications, diagnoses, etc.)
3. Categorize the document type

CRITICAL RULES:
- Extract data ONLY - do NOT interpret or provide medical advice
- Preserve exact values, units, and reference ranges
- Do NOT add clinical recommendations
- This is for data organization ONLY

${NO_CDS_DISCLAIMER}

Respond with valid JSON in this format:
{
  "extractedText": "full OCR text from document",
  "documentType": "lab_report|discharge_summary|imaging|prescription|clinical_note|insurance|referral|other",
  "confidence": 85,
  "patientName": "if visible",
  "dateOfBirth": "if visible",
  "documentDate": "document date if visible",
  "facility": "facility name if visible",
  "provider": "provider name if visible",
  "diagnoses": [{"code": "ICD-10 code if visible", "description": "diagnosis text"}],
  "medications": [{"name": "drug name", "dosage": "dose", "frequency": "schedule"}],
  "labResults": [{"test": "test name", "value": "result", "unit": "unit", "referenceRange": "range", "status": "normal|high|low|critical"}],
  "vitalSigns": [{"type": "BP|HR|Temp|SpO2", "value": "value", "unit": "unit"}],
  "procedures": [{"code": "CPT if visible", "description": "procedure", "date": "if visible"}],
  "allergies": ["allergy1", "allergy2"],
  "summary": "brief factual summary of document content - NO interpretation"
}`,
        responseMimeType: "application/json",
        maxTokens: 4000,
      });
      const parsed = JSON.parse(content || "{}");
      
      const processingTime = Date.now() - startTime;
      
      const categoryMap: Record<string, AutoTagCategory> = {
        lab_report: "lab",
        discharge_summary: "discharge_summary",
        imaging: "imaging",
        prescription: "other",
        clinical_note: "other",
        insurance: "insurance",
        referral: "referral",
        other: "other"
      };

      const result: ExtractedDocumentData = {
        documentId,
        extractedText: parsed.extractedText || "",
        structuredData: {
          patientName: parsed.patientName,
          dateOfBirth: parsed.dateOfBirth,
          documentDate: parsed.documentDate,
          facility: parsed.facility,
          provider: parsed.provider,
          documentType: parsed.documentType,
          diagnoses: parsed.diagnoses || [],
          medications: parsed.medications || [],
          labResults: parsed.labResults || [],
          vitalSigns: parsed.vitalSigns || [],
          procedures: parsed.procedures || [],
          allergies: parsed.allergies || [],
          summary: parsed.summary
        },
        category: categoryMap[parsed.documentType] || "other",
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        rawOcrText: parsed.extractedText,
        processingTime,
        extractedAt: new Date().toISOString()
      };

      console.log(`[OCR] Extraction complete for ${documentId} in ${processingTime}ms. Category: ${result.category}, Confidence: ${result.confidence}%`);
      
      return { success: true, data: result };
    } catch (error) {
      console.error(`[OCR] Extraction failed for ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OCR extraction failed"
      };
    }
  }

  async extractFromPdf(
    pdfText: string,
    documentId: string,
    fileName: string
  ): Promise<OcrProcessingResult> {
    const startTime = Date.now();
    
    console.log(`[OCR] Starting text extraction for PDF ${documentId}: ${fileName}`);
    
    try {
      const content = await generatePhiSafeChat({
        messages: [
          {
            role: "system",
            content: `You are a medical document analyzer. Extract and structure medical information from the provided document text.

CRITICAL RULES:
- Extract data ONLY - do NOT interpret or provide medical advice
- Preserve exact values, units, and reference ranges
- Do NOT add clinical recommendations
- This is for data organization ONLY

${NO_CDS_DISCLAIMER}

Respond with valid JSON (same format as image extraction).`,
          },
          {
            role: "user",
            content: `Extract structured data from this medical document text. Document name: ${fileName}\n\nDocument content:\n${pdfText.slice(0, 8000)}`,
          },
        ],
        responseMimeType: "application/json",
        maxTokens: 4000,
      });
      const parsed = JSON.parse(content || "{}");
      
      const processingTime = Date.now() - startTime;
      
      const categoryMap: Record<string, AutoTagCategory> = {
        lab_report: "lab",
        discharge_summary: "discharge_summary",
        imaging: "imaging",
        prescription: "other",
        clinical_note: "other",
        insurance: "insurance",
        referral: "referral",
        other: "other"
      };

      const result: ExtractedDocumentData = {
        documentId,
        extractedText: pdfText,
        structuredData: {
          patientName: parsed.patientName,
          dateOfBirth: parsed.dateOfBirth,
          documentDate: parsed.documentDate,
          facility: parsed.facility,
          provider: parsed.provider,
          documentType: parsed.documentType,
          diagnoses: parsed.diagnoses || [],
          medications: parsed.medications || [],
          labResults: parsed.labResults || [],
          vitalSigns: parsed.vitalSigns || [],
          procedures: parsed.procedures || [],
          allergies: parsed.allergies || [],
          summary: parsed.summary
        },
        category: categoryMap[parsed.documentType] || "other",
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        rawOcrText: pdfText,
        processingTime,
        extractedAt: new Date().toISOString()
      };

      console.log(`[OCR] Text extraction complete for ${documentId} in ${processingTime}ms`);
      
      return { success: true, data: result };
    } catch (error) {
      console.error(`[OCR] Text extraction failed for ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Text extraction failed"
      };
    }
  }
}

export const documentOcrService = new DocumentOcrService();

export interface DocumentSearchParams {
  query?: string;
  category?: AutoTagCategory;
  dateFrom?: string;
  dateTo?: string;
  provider?: string;
  facility?: string;
  hasMedications?: boolean;
  hasDiagnoses?: boolean;
  hasLabResults?: boolean;
  patientId?: string;
  sortBy?: "date" | "relevance" | "name";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface DocumentSearchResult {
  documentId: string;
  title: string;
  category: AutoTagCategory;
  date: string;
  facility?: string;
  provider?: string;
  matchScore: number;
  matchedTerms: string[];
  snippet: string;
}

class DocumentSearchService {
  async addDocument(userId: string, profileId: string | null, data: ExtractedDocumentData): Promise<void> {
    await db
      .insert(documentOcrResultsTable)
      .values({
        userId,
        profileId: profileId || null,
        documentId: data.documentId,
        extractedText: data.extractedText,
        structuredData: data.structuredData as Record<string, unknown>,
        category: data.category,
        confidence: data.confidence,
        rawOcrText: data.rawOcrText || null,
        processingTime: data.processingTime,
        extractedAt: data.extractedAt,
      })
      .onConflictDoUpdate({
        target: [documentOcrResultsTable.userId, documentOcrResultsTable.documentId],
        set: {
          profileId: profileId || null,
          extractedText: data.extractedText,
          structuredData: data.structuredData as Record<string, unknown>,
          category: data.category,
          confidence: data.confidence,
          rawOcrText: data.rawOcrText || null,
          processingTime: data.processingTime,
          extractedAt: data.extractedAt,
        },
      });
  }

  async search(userId: string, params: DocumentSearchParams): Promise<DocumentSearchResult[]> {
    const rows = await db
      .select()
      .from(documentOcrResultsTable)
      .where(eq(documentOcrResultsTable.userId, userId));

    const results: DocumentSearchResult[] = [];
    for (const row of rows) {
      const doc = row.structuredData as ExtractedDocumentData["structuredData"];
      const docId = row.documentId;

      if (params.patientId && !docId.includes(params.patientId)) continue;
      if (params.category && row.category !== params.category) continue;

      if (params.dateFrom && doc.documentDate) {
        if (new Date(doc.documentDate) < new Date(params.dateFrom)) continue;
      }
      if (params.dateTo && doc.documentDate) {
        if (new Date(doc.documentDate) > new Date(params.dateTo)) continue;
      }

      if (params.provider && doc.provider) {
        if (!doc.provider.toLowerCase().includes(params.provider.toLowerCase())) continue;
      }
      if (params.facility && doc.facility) {
        if (!doc.facility.toLowerCase().includes(params.facility.toLowerCase())) continue;
      }

      if (params.hasMedications && (!doc.medications || doc.medications.length === 0)) continue;
      if (params.hasDiagnoses && (!doc.diagnoses || doc.diagnoses.length === 0)) continue;
      if (params.hasLabResults && (!doc.labResults || doc.labResults.length === 0)) continue;

      let matchScore = 50;
      const matchedTerms: string[] = [];

      if (params.query) {
        const query = params.query.toLowerCase();
        const searchableText = [
          row.extractedText,
          doc.summary,
          doc.provider,
          doc.facility,
          ...(doc.medications?.map(m => m.name) || []),
          ...(doc.diagnoses?.map(d => d.description) || []),
          ...(doc.labResults?.map(l => l.test) || []),
        ].filter(Boolean).join(" ").toLowerCase();

        if (!searchableText.includes(query)) continue;

        for (const term of query.split(/\s+/)) {
          if (searchableText.includes(term)) {
            matchedTerms.push(term);
            matchScore += 10;
          }
        }
      }

      const snippet =
        doc.summary || row.extractedText.slice(0, 200) + (row.extractedText.length > 200 ? "..." : "");

      results.push({
        documentId: docId,
        title: doc.documentType || "Document",
        category: row.category as any,
        date: doc.documentDate || row.extractedAt,
        facility: doc.facility,
        provider: doc.provider,
        matchScore,
        matchedTerms,
        snippet,
      });
    }

    if (params.sortBy === "date") {
      results.sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return params.sortOrder === "asc" ? -diff : diff;
      });
    } else if (params.sortBy === "relevance") {
      results.sort((a, b) => b.matchScore - a.matchScore);
    } else if (params.sortBy === "name") {
      results.sort((a, b) => {
        const diff = a.title.localeCompare(b.title);
        return params.sortOrder === "asc" ? diff : -diff;
      });
    }

    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async getDocument(userId: string, documentId: string): Promise<ExtractedDocumentData | undefined> {
    const rows = await db
      .select()
      .from(documentOcrResultsTable)
      .where(and(
        eq(documentOcrResultsTable.userId, userId),
        eq(documentOcrResultsTable.documentId, documentId),
      ))
      .limit(1);

    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      documentId: row.documentId,
      extractedText: row.extractedText,
      structuredData: row.structuredData as ExtractedDocumentData["structuredData"],
      category: row.category as AutoTagCategory,
      confidence: row.confidence,
      rawOcrText: row.rawOcrText || undefined,
      processingTime: row.processingTime,
      extractedAt: row.extractedAt,
    };
  }
}

export const documentSearchService = new DocumentSearchService();
