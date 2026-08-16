import { randomUUID } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `DISCLAIMER: This document extraction system is for DATA PROCESSING AND ADMINISTRATIVE PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.`;

const EXTRACTION_SYSTEM_PROMPT = `You are a medical document parsing expert specializing in extracting structured clinical data from unstructured healthcare documents.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Interpret clinical findings beyond simple extraction
- Make patient care decisions or suggestions

YOUR ROLE IS STRICTLY LIMITED TO:
- Extracting structured data from documents
- Identifying clinical entities (conditions, medications, procedures)
- Converting text to FHIR resource format
- Flagging ambiguous or unclear data for human review
=== END NO-CDS POLICY ===

Extract data accurately. When uncertain, indicate low confidence. Never fabricate clinical information.`;

export interface DocumentExtractionRequest {
  id: string;
  documentType: DocumentType;
  documentContent: string;
  contentType: "text" | "base64_image" | "pdf_text";
  sourceSystem?: string;
  patientId?: string;
  status: "pending" | "processing" | "completed" | "failed" | "needs_review";
  createdAt: string;
  completedAt?: string;
  result?: ExtractionResult;
}

export type DocumentType = 
  | "clinical_note"
  | "lab_report"
  | "radiology_report"
  | "pathology_report"
  | "discharge_summary"
  | "referral_letter"
  | "prescription"
  | "insurance_form"
  | "consent_form"
  | "fax"
  | "external_record"
  | "unknown";

export interface ExtractionResult {
  extractedResources: ExtractedFHIRResource[];
  documentMetadata: DocumentMetadata;
  confidence: number;
  reviewFlags: ReviewFlag[];
  rawExtraction: RawExtraction;
}

export interface ExtractedFHIRResource {
  resourceType: string;
  resource: any;
  sourceText: string;
  confidence: number;
  extractionMethod: "ai" | "rule_based" | "template";
  needsReview: boolean;
  reviewReason?: string;
}

export interface DocumentMetadata {
  documentDate?: string;
  author?: string;
  authorSpecialty?: string;
  facility?: string;
  documentTitle?: string;
  pageCount?: number;
  wordCount: number;
  language: string;
}

export interface ReviewFlag {
  id: string;
  severity: "high" | "medium" | "low";
  category: "ambiguous_text" | "low_confidence" | "missing_required" | "possible_error" | "needs_verification";
  location: string;
  description: string;
  suggestedAction: string;
}

export interface RawExtraction {
  conditions: ExtractedEntity[];
  medications: ExtractedEntity[];
  procedures: ExtractedEntity[];
  observations: ExtractedEntity[];
  allergies: ExtractedEntity[];
  immunizations: ExtractedEntity[];
  diagnosticResults: ExtractedEntity[];
}

export interface ExtractedEntity {
  text: string;
  normalizedText?: string;
  code?: { system: string; code: string; display: string };
  value?: any;
  unit?: string;
  date?: string;
  confidence: number;
  sourceSpan?: { start: number; end: number };
}

export interface ExtractionTemplate {
  id: string;
  name: string;
  documentType: DocumentType;
  patterns: ExtractionPattern[];
  fhirMappings: TemplateFHIRMapping[];
  isActive: boolean;
}

export interface ExtractionPattern {
  name: string;
  regex: string;
  captureGroups: string[];
  entityType: string;
}

export interface TemplateFHIRMapping {
  entityType: string;
  fhirResourceType: string;
  fieldMappings: Record<string, string>;
}

class AIDocumentExtractionService {
  private aiEnabled: boolean = false;
  private requests: Map<string, DocumentExtractionRequest> = new Map();
  private templates: Map<string, ExtractionTemplate> = new Map();

  constructor() {
    this.initializeAI();
    this.initializeTemplates();
    console.log("[AIDocumentExtraction] Service initialized with AI-powered extraction");
    console.log("[AIDocumentExtraction] NO-CDS compliance enabled for all outputs");
  }

  private initializeAI(): void {
    // AI text extraction runs through the PHI-safe Vertex (BAA) gateway.
    this.aiEnabled = true;
    console.log("[AIDocumentExtraction] PHI-safe AI gateway configured for intelligent extraction");
  }

  private initializeTemplates(): void {
    const labReportTemplate: ExtractionTemplate = {
      id: "template-lab-report",
      name: "Laboratory Report",
      documentType: "lab_report",
      patterns: [
        { name: "glucose", regex: "(?:glucose|blood sugar)[:\\s]+([\\d.]+)\\s*(mg\\/dL|mmol\\/L)?", captureGroups: ["value", "unit"], entityType: "observation" },
        { name: "hemoglobin", regex: "(?:hemoglobin|Hgb|Hb)[:\\s]+([\\d.]+)\\s*(g\\/dL)?", captureGroups: ["value", "unit"], entityType: "observation" },
        { name: "wbc", regex: "(?:WBC|white blood cells?)[:\\s]+([\\d.]+)\\s*(?:K\\/uL|x10\\^9\\/L)?", captureGroups: ["value", "unit"], entityType: "observation" },
        { name: "creatinine", regex: "(?:creatinine)[:\\s]+([\\d.]+)\\s*(mg\\/dL)?", captureGroups: ["value", "unit"], entityType: "observation" }
      ],
      fhirMappings: [
        { entityType: "observation", fhirResourceType: "Observation", fieldMappings: { "value": "valueQuantity.value", "unit": "valueQuantity.unit" } }
      ],
      isActive: true
    };

    const dischargeTemplate: ExtractionTemplate = {
      id: "template-discharge",
      name: "Discharge Summary",
      documentType: "discharge_summary",
      patterns: [
        { name: "diagnosis", regex: "(?:diagnosis|diagnoses|dx)[:\\s]+([^\\n]+)", captureGroups: ["text"], entityType: "condition" },
        { name: "medication", regex: "(?:medications?|rx)[:\\s]+([^\\n]+)", captureGroups: ["text"], entityType: "medication" },
        { name: "procedure", regex: "(?:procedures?|operations?)[:\\s]+([^\\n]+)", captureGroups: ["text"], entityType: "procedure" }
      ],
      fhirMappings: [
        { entityType: "condition", fhirResourceType: "Condition", fieldMappings: { "text": "code.text" } },
        { entityType: "medication", fhirResourceType: "MedicationRequest", fieldMappings: { "text": "medicationCodeableConcept.text" } },
        { entityType: "procedure", fhirResourceType: "Procedure", fieldMappings: { "text": "code.text" } }
      ],
      isActive: true
    };

    const prescriptionTemplate: ExtractionTemplate = {
      id: "template-prescription",
      name: "Prescription",
      documentType: "prescription",
      patterns: [
        { name: "medication_name", regex: "(?:rx|medication)[:\\s]+([A-Za-z]+(?:\\s+[A-Za-z]+)?)", captureGroups: ["name"], entityType: "medication" },
        { name: "dosage", regex: "(\\d+(?:\\.\\d+)?\\s*(?:mg|mcg|g|mL|units?))", captureGroups: ["dosage"], entityType: "medication" },
        { name: "frequency", regex: "((?:once|twice|three times)\\s+(?:daily|a day)|\\d+x\\s*daily|q\\d+h|BID|TID|QID)", captureGroups: ["frequency"], entityType: "medication" }
      ],
      fhirMappings: [
        { entityType: "medication", fhirResourceType: "MedicationRequest", fieldMappings: { "name": "medicationCodeableConcept.text", "dosage": "dosageInstruction.doseAndRate.doseQuantity.value", "frequency": "dosageInstruction.timing.code.text" } }
      ],
      isActive: true
    };

    this.templates.set(labReportTemplate.id, labReportTemplate);
    this.templates.set(dischargeTemplate.id, dischargeTemplate);
    this.templates.set(prescriptionTemplate.id, prescriptionTemplate);
  }

  async extractFromDocument(
    documentContent: string,
    documentType: DocumentType,
    contentType: "text" | "base64_image" | "pdf_text",
    patientId: string | undefined,
    userId: string
  ): Promise<DocumentExtractionRequest> {
    const requestId = `extract-${Date.now()}-${randomUUID().substring(0, 8)}`;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DocumentExtraction",
      resourceId: requestId,
      details: `Starting extraction from ${documentType} document (${contentType})`
    });

    const request: DocumentExtractionRequest = {
      id: requestId,
      documentType,
      documentContent: documentContent.substring(0, 100) + "...", // Store truncated for logging
      contentType,
      patientId,
      status: "processing",
      createdAt: new Date().toISOString()
    };

    this.requests.set(requestId, request);

    try {
      const result = await this.performExtraction(documentContent, documentType, contentType, patientId, userId);
      request.result = result;
      request.status = result.reviewFlags.some(f => f.severity === "high") ? "needs_review" : "completed";
      request.completedAt = new Date().toISOString();

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "DocumentExtraction",
        resourceId: requestId,
        details: `Completed extraction: ${result.extractedResources.length} resources, confidence: ${result.confidence}%`
      });
    } catch (error) {
      request.status = "failed";
      console.error("[AIDocumentExtraction] Extraction failed:", error);
    }

    return request;
  }

  private async performExtraction(
    content: string,
    documentType: DocumentType,
    contentType: string,
    patientId: string | undefined,
    userId: string
  ): Promise<ExtractionResult> {
    const wordCount = content.split(/\s+/).length;
    
    const metadata: DocumentMetadata = {
      wordCount,
      language: "en",
      documentDate: this.extractDate(content),
      author: this.extractAuthor(content),
      facility: this.extractFacility(content)
    };

    let rawExtraction = this.ruleBasedExtraction(content, documentType);

    if (this.aiEnabled) {
      const aiExtraction = await this.aiExtraction(content, documentType, userId);
      rawExtraction = this.mergeExtractions(rawExtraction, aiExtraction);
    }

    const extractedResources = this.convertToFHIRResources(rawExtraction, patientId, userId);

    const reviewFlags = this.generateReviewFlags(rawExtraction, extractedResources);

    const confidence = this.calculateConfidence(rawExtraction, extractedResources, reviewFlags);

    return {
      extractedResources,
      documentMetadata: metadata,
      confidence,
      reviewFlags,
      rawExtraction
    };
  }

  private ruleBasedExtraction(content: string, documentType: DocumentType): RawExtraction {
    const extraction: RawExtraction = {
      conditions: [],
      medications: [],
      procedures: [],
      observations: [],
      allergies: [],
      immunizations: [],
      diagnosticResults: []
    };

    const template = Array.from(this.templates.values()).find(t => t.documentType === documentType);

    if (template) {
      for (const pattern of template.patterns) {
        const regex = new RegExp(pattern.regex, "gi");
        let match;
        while ((match = regex.exec(content)) !== null) {
          const entity: ExtractedEntity = {
            text: match[0],
            normalizedText: match[1]?.trim(),
            value: pattern.captureGroups.includes("value") ? parseFloat(match[1]) : undefined,
            unit: pattern.captureGroups.includes("unit") ? match[2] : undefined,
            confidence: 0.75,
            sourceSpan: { start: match.index, end: match.index + match[0].length }
          };

          if (pattern.entityType === "observation") extraction.observations.push(entity);
          else if (pattern.entityType === "condition") extraction.conditions.push(entity);
          else if (pattern.entityType === "medication") extraction.medications.push(entity);
          else if (pattern.entityType === "procedure") extraction.procedures.push(entity);
        }
      }
    }

    const conditionPatterns = [
      /(?:diagnosis|diagnosed with|condition|dx)[:\s]+([^,\n.]+)/gi,
      /(?:assessment|impression)[:\s]+([^,\n.]+)/gi
    ];

    for (const pattern of conditionPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        if (!extraction.conditions.find(c => c.text === match[0])) {
          extraction.conditions.push({
            text: match[0],
            normalizedText: match[1].trim(),
            confidence: 0.65,
            sourceSpan: { start: match.index, end: match.index + match[0].length }
          });
        }
      }
    }

    const allergyPatterns = [
      /(?:allergies?|allergic to)[:\s]+([^,\n.]+)/gi,
      /(?:nkda|no known drug allergies)/gi
    ];

    for (const pattern of allergyPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        extraction.allergies.push({
          text: match[0],
          normalizedText: match[1]?.trim() || "NKDA",
          confidence: 0.8,
          sourceSpan: { start: match.index, end: match.index + match[0].length }
        });
      }
    }

    return extraction;
  }

  private async aiExtraction(content: string, documentType: DocumentType, userId: string): Promise<RawExtraction> {
    if (!this.aiEnabled) {
      return { conditions: [], medications: [], procedures: [], observations: [], allergies: [], immunizations: [], diagnosticResults: [] };
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DocumentContent",
      details: `AI extraction from ${documentType} document`
    });

    const truncatedContent = content.length > 8000 ? content.substring(0, 8000) + "..." : content;

    try {
      const content_response = await generatePhiSafeText({
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Extract clinical entities from this ${documentType} document. Return a JSON object with these arrays:
- conditions: diagnosed conditions (text, code if identifiable)
- medications: medications mentioned (name, dosage, frequency)
- procedures: procedures performed or recommended
- observations: lab values, vital signs (value, unit, date)
- allergies: allergies and adverse reactions
- immunizations: vaccines administered

For each entity include: text (original), normalizedText, confidence (0-1).
Do NOT interpret findings or provide clinical advice.

Document content:
${truncatedContent}`,
        maxTokens: 2000,
        temperature: 0.2,
        responseMimeType: "application/json",
      });

      if (content_response) {
        const parsed = JSON.parse(content_response);
        return {
          conditions: (parsed.conditions || []).map((c: any) => ({ ...c, confidence: c.confidence || 0.85 })),
          medications: (parsed.medications || []).map((m: any) => ({ ...m, confidence: m.confidence || 0.85 })),
          procedures: (parsed.procedures || []).map((p: any) => ({ ...p, confidence: p.confidence || 0.85 })),
          observations: (parsed.observations || []).map((o: any) => ({ ...o, confidence: o.confidence || 0.85 })),
          allergies: (parsed.allergies || []).map((a: any) => ({ ...a, confidence: a.confidence || 0.85 })),
          immunizations: (parsed.immunizations || []).map((i: any) => ({ ...i, confidence: i.confidence || 0.85 })),
          diagnosticResults: parsed.diagnosticResults || []
        };
      }
    } catch (error) {
      console.error("[AIDocumentExtraction] AI extraction failed:", error);
    }

    return { conditions: [], medications: [], procedures: [], observations: [], allergies: [], immunizations: [], diagnosticResults: [] };
  }

  private mergeExtractions(ruleBased: RawExtraction, aiBased: RawExtraction): RawExtraction {
    const merged: RawExtraction = {
      conditions: [...ruleBased.conditions],
      medications: [...ruleBased.medications],
      procedures: [...ruleBased.procedures],
      observations: [...ruleBased.observations],
      allergies: [...ruleBased.allergies],
      immunizations: [...ruleBased.immunizations],
      diagnosticResults: [...ruleBased.diagnosticResults]
    };

    for (const aiCondition of aiBased.conditions) {
      if (!merged.conditions.find(c => this.similarText(c.normalizedText || c.text, aiCondition.normalizedText || aiCondition.text))) {
        merged.conditions.push(aiCondition);
      }
    }

    for (const aiMed of aiBased.medications) {
      if (!merged.medications.find(m => this.similarText(m.normalizedText || m.text, aiMed.normalizedText || aiMed.text))) {
        merged.medications.push(aiMed);
      }
    }

    for (const aiObs of aiBased.observations) {
      const existing = merged.observations.find(o => this.similarText(o.normalizedText || o.text, aiObs.normalizedText || aiObs.text));
      if (!existing) {
        merged.observations.push(aiObs);
      } else if (aiObs.confidence > existing.confidence) {
        Object.assign(existing, aiObs);
      }
    }

    for (const aiProc of aiBased.procedures) {
      if (!merged.procedures.find(p => this.similarText(p.normalizedText || p.text, aiProc.normalizedText || aiProc.text))) {
        merged.procedures.push(aiProc);
      }
    }

    for (const aiAllergy of aiBased.allergies) {
      if (!merged.allergies.find(a => this.similarText(a.normalizedText || a.text, aiAllergy.normalizedText || aiAllergy.text))) {
        merged.allergies.push(aiAllergy);
      }
    }

    for (const aiImm of aiBased.immunizations) {
      if (!merged.immunizations.find(i => this.similarText(i.normalizedText || i.text, aiImm.normalizedText || aiImm.text))) {
        merged.immunizations.push(aiImm);
      }
    }

    return merged;
  }

  private similarText(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const na = normalize(a);
    const nb = normalize(b);
    return na.includes(nb) || nb.includes(na) || na === nb;
  }

  private convertToFHIRResources(extraction: RawExtraction, patientId: string | undefined, userId: string): ExtractedFHIRResource[] {
    const resources: ExtractedFHIRResource[] = [];
    const patientRef = patientId ? { reference: `Patient/${patientId}` } : undefined;

    for (const condition of extraction.conditions) {
      resources.push({
        resourceType: "Condition",
        resource: {
          resourceType: "Condition",
          id: randomUUID(),
          subject: patientRef,
          code: {
            text: condition.normalizedText || condition.text,
            coding: condition.code ? [condition.code] : undefined
          },
          clinicalStatus: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }]
          },
          recordedDate: condition.date || new Date().toISOString(),
          meta: { source: "tabula-medica:document-extraction" }
        },
        sourceText: condition.text,
        confidence: condition.confidence,
        extractionMethod: condition.code ? "ai" : "rule_based",
        needsReview: condition.confidence < 0.7
      });
    }

    for (const med of extraction.medications) {
      resources.push({
        resourceType: "MedicationRequest",
        resource: {
          resourceType: "MedicationRequest",
          id: randomUUID(),
          status: "active",
          intent: "order",
          subject: patientRef,
          medicationCodeableConcept: {
            text: med.normalizedText || med.text,
            coding: med.code ? [med.code] : undefined
          },
          dosageInstruction: med.value ? [{
            doseAndRate: [{
              doseQuantity: { value: med.value, unit: med.unit }
            }]
          }] : undefined,
          meta: { source: "tabula-medica:document-extraction" }
        },
        sourceText: med.text,
        confidence: med.confidence,
        extractionMethod: "ai",
        needsReview: med.confidence < 0.7
      });
    }

    for (const obs of extraction.observations) {
      resources.push({
        resourceType: "Observation",
        resource: {
          resourceType: "Observation",
          id: randomUUID(),
          status: "final",
          subject: patientRef,
          code: {
            text: obs.normalizedText || obs.text,
            coding: obs.code ? [obs.code] : undefined
          },
          valueQuantity: obs.value !== undefined ? {
            value: obs.value,
            unit: obs.unit,
            system: "http://unitsofmeasure.org"
          } : undefined,
          effectiveDateTime: obs.date || new Date().toISOString(),
          meta: { source: "tabula-medica:document-extraction" }
        },
        sourceText: obs.text,
        confidence: obs.confidence,
        extractionMethod: obs.code ? "ai" : "rule_based",
        needsReview: obs.confidence < 0.7
      });
    }

    for (const allergy of extraction.allergies) {
      resources.push({
        resourceType: "AllergyIntolerance",
        resource: {
          resourceType: "AllergyIntolerance",
          id: randomUUID(),
          patient: patientRef,
          code: {
            text: allergy.normalizedText || allergy.text,
            coding: allergy.code ? [allergy.code] : undefined
          },
          clinicalStatus: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }]
          },
          meta: { source: "tabula-medica:document-extraction" }
        },
        sourceText: allergy.text,
        confidence: allergy.confidence,
        extractionMethod: "ai",
        needsReview: allergy.confidence < 0.7
      });
    }

    for (const proc of extraction.procedures) {
      resources.push({
        resourceType: "Procedure",
        resource: {
          resourceType: "Procedure",
          id: randomUUID(),
          status: "completed",
          subject: patientRef,
          code: {
            text: proc.normalizedText || proc.text,
            coding: proc.code ? [proc.code] : undefined
          },
          performedDateTime: proc.date,
          meta: { source: "tabula-medica:document-extraction" }
        },
        sourceText: proc.text,
        confidence: proc.confidence,
        extractionMethod: "ai",
        needsReview: proc.confidence < 0.7
      });
    }

    return resources;
  }

  private generateReviewFlags(extraction: RawExtraction, resources: ExtractedFHIRResource[]): ReviewFlag[] {
    const flags: ReviewFlag[] = [];

    for (const resource of resources) {
      if (resource.confidence < 0.5) {
        flags.push({
          id: randomUUID(),
          severity: "high",
          category: "low_confidence",
          location: resource.resourceType,
          description: `Low confidence (${Math.round(resource.confidence * 100)}%) extraction for ${resource.resourceType}`,
          suggestedAction: "Manually verify the extracted data against the source document"
        });
      } else if (resource.confidence < 0.7) {
        flags.push({
          id: randomUUID(),
          severity: "medium",
          category: "low_confidence",
          location: resource.resourceType,
          description: `Moderate confidence (${Math.round(resource.confidence * 100)}%) extraction`,
          suggestedAction: "Review for accuracy"
        });
      }
    }

    const allEntities = [
      ...extraction.conditions,
      ...extraction.medications,
      ...extraction.observations,
      ...extraction.allergies
    ];

    for (const entity of allEntities) {
      if (!entity.code && entity.normalizedText && entity.normalizedText.length > 50) {
        flags.push({
          id: randomUUID(),
          severity: "low",
          category: "ambiguous_text",
          location: entity.text.substring(0, 50),
          description: "Long text without standardized code mapping",
          suggestedAction: "Map to appropriate terminology (SNOMED, LOINC, RxNorm)"
        });
      }
    }

    return flags;
  }

  private calculateConfidence(extraction: RawExtraction, resources: ExtractedFHIRResource[], flags: ReviewFlag[]): number {
    if (resources.length === 0) return 0;

    const avgResourceConfidence = resources.reduce((sum, r) => sum + r.confidence, 0) / resources.length;

    const highFlags = flags.filter(f => f.severity === "high").length;
    const mediumFlags = flags.filter(f => f.severity === "medium").length;

    let confidence = avgResourceConfidence * 100;
    confidence -= highFlags * 10;
    confidence -= mediumFlags * 3;

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  private extractDate(content: string): string | undefined {
    const datePatterns = [
      /(?:date|dated)[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(?:date|dated)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        } catch (e) {}
      }
    }
    return undefined;
  }

  private extractAuthor(content: string): string | undefined {
    const authorPatterns = [
      /(?:provider|physician|doctor|dr\.?)[:\s]+([A-Za-z\s,\.]+)/i,
      /(?:signed by|authored by)[:\s]+([A-Za-z\s,\.]+)/i
    ];

    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 100);
      }
    }
    return undefined;
  }

  private extractFacility(content: string): string | undefined {
    const facilityPatterns = [
      /(?:hospital|clinic|medical center|healthcare)[:\s]+([A-Za-z\s]+(?:Hospital|Clinic|Center|Healthcare)?)/i,
      /^([A-Za-z\s]+(?:Hospital|Clinic|Medical Center|Healthcare))/im
    ];

    for (const pattern of facilityPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 200);
      }
    }
    return undefined;
  }

  getRequest(id: string): DocumentExtractionRequest | undefined {
    return this.requests.get(id);
  }

  getTemplates(): ExtractionTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ExtractionTemplate | undefined {
    return this.templates.get(id);
  }

  getStats(): { totalExtractions: number; completedExtractions: number; needsReview: number; avgConfidence: number } {
    const requests = Array.from(this.requests.values());
    const completed = requests.filter(r => r.status === "completed" || r.status === "needs_review");
    const needsReview = requests.filter(r => r.status === "needs_review");
    const avgConfidence = completed.length > 0
      ? completed.reduce((sum, r) => sum + (r.result?.confidence || 0), 0) / completed.length
      : 0;

    return {
      totalExtractions: requests.length,
      completedExtractions: completed.length,
      needsReview: needsReview.length,
      avgConfidence: Math.round(avgConfidence)
    };
  }
}

export const aiDocumentExtractionService = new AIDocumentExtractionService();
export { NO_CDS_DISCLAIMER as EXTRACTION_NO_CDS_DISCLAIMER };
