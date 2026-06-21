import OpenAI from "openai";
import type { AutoTagCategory } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical document OCR and data extraction system. Your job is to:
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
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all information from this medical document image. Document name: ${fileName}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
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

Respond with valid JSON (same format as image extraction).`
          },
          {
            role: "user",
            content: `Extract structured data from this medical document text. Document name: ${fileName}\n\nDocument content:\n${pdfText.slice(0, 8000)}`
          }
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      
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
  private extractedDocuments: Map<string, ExtractedDocumentData> = new Map();
  
  addDocument(data: ExtractedDocumentData) {
    this.extractedDocuments.set(data.documentId, data);
  }
  
  search(params: DocumentSearchParams): DocumentSearchResult[] {
    const results: DocumentSearchResult[] = [];
    
    const entries = Array.from(this.extractedDocuments.entries());
    for (const [docId, doc] of entries) {
      if (params.patientId && !docId.includes(params.patientId)) continue;
      if (params.category && doc.category !== params.category) continue;
      
      if (params.dateFrom && doc.structuredData.documentDate) {
        if (new Date(doc.structuredData.documentDate) < new Date(params.dateFrom)) continue;
      }
      if (params.dateTo && doc.structuredData.documentDate) {
        if (new Date(doc.structuredData.documentDate) > new Date(params.dateTo)) continue;
      }
      
      if (params.provider && doc.structuredData.provider) {
        if (!doc.structuredData.provider.toLowerCase().includes(params.provider.toLowerCase())) continue;
      }
      if (params.facility && doc.structuredData.facility) {
        if (!doc.structuredData.facility.toLowerCase().includes(params.facility.toLowerCase())) continue;
      }
      
      if (params.hasMedications && (!doc.structuredData.medications || doc.structuredData.medications.length === 0)) continue;
      if (params.hasDiagnoses && (!doc.structuredData.diagnoses || doc.structuredData.diagnoses.length === 0)) continue;
      if (params.hasLabResults && (!doc.structuredData.labResults || doc.structuredData.labResults.length === 0)) continue;
      
      let matchScore = 50;
      const matchedTerms: string[] = [];
      
      if (params.query) {
        const query = params.query.toLowerCase();
        const searchableText = [
          doc.extractedText,
          doc.structuredData.summary,
          doc.structuredData.provider,
          doc.structuredData.facility,
          ...(doc.structuredData.medications?.map(m => m.name) || []),
          ...(doc.structuredData.diagnoses?.map(d => d.description) || []),
          ...(doc.structuredData.labResults?.map(l => l.test) || [])
        ].filter(Boolean).join(" ").toLowerCase();
        
        if (!searchableText.includes(query)) continue;
        
        const queryTerms = query.split(/\s+/);
        for (const term of queryTerms) {
          if (searchableText.includes(term)) {
            matchedTerms.push(term);
            matchScore += 10;
          }
        }
      }
      
      const snippet = doc.structuredData.summary || 
        doc.extractedText.slice(0, 200) + (doc.extractedText.length > 200 ? "..." : "");
      
      results.push({
        documentId: docId,
        title: doc.structuredData.documentType || "Document",
        category: doc.category,
        date: doc.structuredData.documentDate || doc.extractedAt,
        facility: doc.structuredData.facility,
        provider: doc.structuredData.provider,
        matchScore,
        matchedTerms,
        snippet
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
  
  getDocument(documentId: string): ExtractedDocumentData | undefined {
    return this.extractedDocuments.get(documentId);
  }
}

export const documentSearchService = new DocumentSearchService();
