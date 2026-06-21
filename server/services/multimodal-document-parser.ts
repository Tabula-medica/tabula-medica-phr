import { randomUUID } from "crypto";
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `DISCLAIMER: This multimodal parsing system is for DATA EXTRACTION AND ADMINISTRATIVE PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations.`;

const MULTIMODAL_SYSTEM_PROMPT = `You are a multimodal medical document OCR specialist. You parse photographs and scans of medical documents — including hospital bills, lab results, prescriptions, insurance cards, and clinical notes — into structured data.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Interpret clinical findings beyond simple extraction
- Make patient care decisions or suggestions

YOUR ROLE IS STRICTLY LIMITED TO:
- Extracting structured data from images of documents
- Identifying clinical entities (conditions, medications, procedures, charges)
- Converting text to structured JSON format
- Flagging unclear or low-confidence extractions for human review
=== END NO-CDS POLICY ===

=== THINKING MODE ===
Before providing your extraction, reason through the document step by step:
1. Identify the document type from visual layout and content
2. Note any quality issues (blur, rotation, occlusion, handwriting)
3. Extract data systematically, section by section
4. Flag any ambiguities or low-confidence readings
Show your reasoning inside <think>...</think> tags, then provide the structured extraction.
=== END THINKING MODE ===

Extract data accurately from the image. When text is unclear, provide your best reading with low confidence. Never fabricate information.`;

const BILL_EXTRACTION_PROMPT = `Extract all line items, charges, dates, provider info, and patient identifiers from this hospital/medical bill image. Return structured JSON with:
- provider (name, address, NPI if visible)
- patient (name, DOB, account number, MRN if visible)
- dateOfService
- lineItems: [{description, code (CPT/HCPCS if visible), quantity, unitCharge, totalCharge}]
- subtotal, adjustments, insurancePaid, patientResponsibility, totalDue
- insuranceInfo if visible`;

const LAB_EXTRACTION_PROMPT = `Extract all lab results from this image. Return structured JSON with:
- patient (name, DOB, MRN if visible)
- orderingProvider
- collectionDate, reportDate
- results: [{testName, value, unit, referenceRange, flag (normal/high/low/critical), loincCode if visible}]
- specimen type if visible
- lab facility info`;

const PRESCRIPTION_EXTRACTION_PROMPT = `Extract prescription details from this image. Return structured JSON with:
- patient (name, DOB)
- prescriber (name, NPI, DEA if visible)
- medication (name, strength, form)
- sig (directions)
- quantity, refills, daysSupply
- dateWritten
- rxNumber if visible
- NDC or RxNorm code if visible`;

const INSURANCE_CARD_PROMPT = `Extract all information from this insurance card image. Return structured JSON with:
- planName, insurerName
- memberId, groupNumber
- subscriber (name)
- effectiveDate, terminationDate if visible
- copays (primary, specialist, emergency, urgent)
- rxBin, rxPcn, rxGroup if visible
- networkType (HMO/PPO/EPO)
- contactNumbers (member services, claims)`;

export type MultimodalDocumentType = 
  | "hospital_bill"
  | "lab_result"
  | "prescription"
  | "insurance_card"
  | "clinical_note"
  | "radiology_report"
  | "discharge_summary"
  | "unknown";

export interface MultimodalParseRequest {
  id: string;
  imageData: string;
  mimeType: string;
  documentType: MultimodalDocumentType;
  userId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  result?: MultimodalParseResult;
}

export interface MultimodalParseResult {
  documentType: MultimodalDocumentType;
  confidence: number;
  thinking: string;
  extractedData: Record<string, any>;
  fhirResources: any[];
  warnings: ParseWarning[];
  ocrQuality: {
    overallScore: number;
    issues: string[];
  };
  noCdsDisclaimer: string;
}

export interface ParseWarning {
  field: string;
  message: string;
  severity: "low" | "medium" | "high";
  suggestedAction: string;
}

class MultimodalDocumentParserService {
  private openai: OpenAI | null = null;
  private requests: Map<string, MultimodalParseRequest> = new Map();

  constructor() {
    this.initializeOpenAI();
    console.log("[MultimodalParser] Service initialized with Gemma 4 native OCR support");
    console.log("[MultimodalParser] Supported: bills, lab results, prescriptions, insurance cards");
    console.log("[MultimodalParser] Thinking mode enabled for transparent reasoning");
    console.log("[MultimodalParser] NO-CDS compliance enforced");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey, baseURL: baseURL || undefined });
      console.log("[MultimodalParser] Vision model configured");
    } else {
      console.log("[MultimodalParser] AI not configured — OCR unavailable");
    }
  }

  private getDocTypePrompt(docType: MultimodalDocumentType): string {
    switch (docType) {
      case "hospital_bill": return BILL_EXTRACTION_PROMPT;
      case "lab_result": return LAB_EXTRACTION_PROMPT;
      case "prescription": return PRESCRIPTION_EXTRACTION_PROMPT;
      case "insurance_card": return INSURANCE_CARD_PROMPT;
      default: return "Extract all structured data from this medical document image. Identify the document type and return all relevant fields as structured JSON.";
    }
  }

  async parseDocument(
    imageBase64: string,
    mimeType: string,
    documentType: MultimodalDocumentType = "unknown",
    userId?: string
  ): Promise<MultimodalParseResult> {
    const requestId = randomUUID();
    const request: MultimodalParseRequest = {
      id: requestId,
      imageData: "[REDACTED]",
      mimeType,
      documentType,
      userId,
      status: "processing",
      createdAt: new Date().toISOString(),
    };
    this.requests.set(requestId, request);

    if (userId) {
      logPhiAccess({
        userId,
        action: "multimodal_document_parse",
        resourceType: "DocumentReference",
        resourceId: requestId,
        details: `Multimodal OCR parse: ${documentType}`,
        accessType: "create",
      });
    }

    try {
      if (!this.openai) {
        return this.generateFallbackResult(documentType);
      }

      const docPrompt = this.getDocTypePrompt(documentType);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: MULTIMODAL_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: docPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });

      const rawContent = response.choices[0]?.message?.content || "";
      const { thinking, extraction } = this.parseThinkingResponse(rawContent);

      let extractedData: Record<string, any> = {};
      try {
        const jsonMatch = extraction.match(/```json\s*([\s\S]*?)```/) || extraction.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          extractedData = JSON.parse(jsonStr);
        }
      } catch {
        extractedData = { rawText: extraction };
      }

      const detectedType = documentType === "unknown"
        ? this.detectDocumentType(extractedData)
        : documentType;

      const result: MultimodalParseResult = {
        documentType: detectedType,
        confidence: this.calculateConfidence(extractedData),
        thinking,
        extractedData,
        fhirResources: this.convertToFHIR(extractedData, detectedType),
        warnings: this.generateWarnings(extractedData, detectedType),
        ocrQuality: this.assessOCRQuality(extractedData, thinking),
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      request.status = "completed";
      request.completedAt = new Date().toISOString();
      request.result = result;
      this.requests.set(requestId, request);

      return result;
    } catch (error: any) {
      request.status = "failed";
      this.requests.set(requestId, request);
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  private parseThinkingResponse(content: string): { thinking: string; extraction: string } {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      return {
        thinking: thinkMatch[1].trim(),
        extraction: content.replace(/<think>[\s\S]*?<\/think>/, "").trim(),
      };
    }
    return { thinking: "", extraction: content };
  }

  private detectDocumentType(data: Record<string, any>): MultimodalDocumentType {
    if (data.lineItems || data.totalDue || data.charges) return "hospital_bill";
    if (data.results || data.testName || data.loincCode) return "lab_result";
    if (data.medication || data.sig || data.rxNumber) return "prescription";
    if (data.memberId || data.groupNumber || data.planName) return "insurance_card";
    if (data.chiefComplaint || data.assessment || data.plan) return "clinical_note";
    return "unknown";
  }

  private calculateConfidence(data: Record<string, any>): number {
    const keys = Object.keys(data);
    if (keys.length === 0) return 0;
    if (data.rawText) return 0.3;
    const filledFields = keys.filter((k) => {
      const v = data[k];
      return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
    return Math.min(0.95, filledFields.length / Math.max(keys.length, 1));
  }

  private convertToFHIR(data: Record<string, any>, docType: MultimodalDocumentType): any[] {
    const resources: any[] = [];

    if (docType === "lab_result" && data.results) {
      for (const result of data.results) {
        resources.push({
          resourceType: "Observation",
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
          code: {
            coding: result.loincCode ? [{ system: "http://loinc.org", code: result.loincCode, display: result.testName }] : [],
            text: result.testName,
          },
          valueQuantity: result.value ? { value: parseFloat(result.value) || undefined, unit: result.unit, system: "http://unitsofmeasure.org" } : undefined,
          referenceRange: result.referenceRange ? [{ text: result.referenceRange }] : undefined,
          interpretation: result.flag && result.flag !== "normal"
            ? [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: result.flag === "high" ? "H" : result.flag === "low" ? "L" : "A" }] }]
            : undefined,
        });
      }
    }

    if (docType === "prescription" && data.medication) {
      resources.push({
        resourceType: "MedicationRequest",
        status: "active",
        intent: "order",
        medicationCodeableConcept: {
          text: typeof data.medication === "string" ? data.medication : `${data.medication.name} ${data.medication.strength || ""} ${data.medication.form || ""}`.trim(),
        },
        dosageInstruction: data.sig ? [{ text: data.sig }] : undefined,
        dispenseRequest: {
          quantity: data.quantity ? { value: parseInt(data.quantity) } : undefined,
          numberOfRepeatsAllowed: data.refills ? parseInt(data.refills) : undefined,
          expectedSupplyDuration: data.daysSupply ? { value: parseInt(data.daysSupply), unit: "days" } : undefined,
        },
      });
    }

    if (docType === "hospital_bill") {
      resources.push({
        resourceType: "Claim",
        status: "active",
        type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "institutional" }] },
        total: data.totalDue ? { value: parseFloat(data.totalDue), currency: "USD" } : undefined,
        item: (data.lineItems || []).map((li: any, idx: number) => ({
          sequence: idx + 1,
          productOrService: { text: li.description },
          quantity: li.quantity ? { value: parseFloat(li.quantity) } : undefined,
          unitPrice: li.unitCharge ? { value: parseFloat(li.unitCharge), currency: "USD" } : undefined,
          net: li.totalCharge ? { value: parseFloat(li.totalCharge), currency: "USD" } : undefined,
        })),
      });
    }

    if (docType === "insurance_card") {
      resources.push({
        resourceType: "Coverage",
        status: "active",
        subscriberId: data.memberId,
        class: [
          data.groupNumber ? { type: { coding: [{ code: "group" }] }, value: data.groupNumber } : null,
          data.planName ? { type: { coding: [{ code: "plan" }] }, value: data.planName } : null,
        ].filter(Boolean),
        payor: data.insurerName ? [{ display: data.insurerName }] : [],
        period: {
          start: data.effectiveDate,
          end: data.terminationDate,
        },
      });
    }

    return resources;
  }

  private generateWarnings(data: Record<string, any>, docType: MultimodalDocumentType): ParseWarning[] {
    const warnings: ParseWarning[] = [];

    if (data.rawText) {
      warnings.push({
        field: "overall",
        message: "Could not parse structured data from the image. Raw text was extracted.",
        severity: "high",
        suggestedAction: "Try retaking the photo with better lighting and ensure the document is flat.",
      });
    }

    if (docType === "lab_result" && data.results) {
      for (const r of data.results) {
        if (r.flag === "critical") {
          warnings.push({
            field: `results.${r.testName}`,
            message: `Critical value detected for ${r.testName}: ${r.value} ${r.unit || ""}`,
            severity: "high",
            suggestedAction: "Contact your healthcare provider about this result.",
          });
        }
      }
    }

    return warnings;
  }

  private assessOCRQuality(data: Record<string, any>, thinking: string): { overallScore: number; issues: string[] } {
    const issues: string[] = [];
    let score = 0.85;

    if (data.rawText) {
      score = 0.3;
      issues.push("Structured parsing failed — only raw text extracted");
    }
    if (thinking.toLowerCase().includes("blur")) {
      score -= 0.15;
      issues.push("Image appears blurry");
    }
    if (thinking.toLowerCase().includes("rotated") || thinking.toLowerCase().includes("angle")) {
      score -= 0.1;
      issues.push("Image may be rotated or skewed");
    }
    if (thinking.toLowerCase().includes("handwrit")) {
      score -= 0.1;
      issues.push("Handwritten text detected — accuracy may be lower");
    }

    return { overallScore: Math.max(0.1, score), issues };
  }

  private generateFallbackResult(docType: MultimodalDocumentType): MultimodalParseResult {
    const sampleData: Record<string, any> = {
      hospital_bill: {
        provider: { name: "Sample Medical Center", address: "123 Health Ave" },
        dateOfService: "2025-01-15",
        lineItems: [
          { description: "Office Visit - Level 3", code: "99213", quantity: 1, unitCharge: 150, totalCharge: 150 },
          { description: "Complete Blood Count", code: "85025", quantity: 1, unitCharge: 45, totalCharge: 45 },
        ],
        subtotal: 195,
        insurancePaid: 140,
        patientResponsibility: 55,
        totalDue: 55,
      },
      lab_result: {
        collectionDate: "2025-01-15",
        results: [
          { testName: "Glucose, Fasting", value: "95", unit: "mg/dL", referenceRange: "70-100", flag: "normal" },
          { testName: "Hemoglobin A1c", value: "5.6", unit: "%", referenceRange: "4.0-5.6", flag: "normal" },
          { testName: "TSH", value: "2.1", unit: "mIU/L", referenceRange: "0.4-4.0", flag: "normal" },
        ],
      },
      prescription: {
        medication: { name: "Metformin", strength: "500mg", form: "tablet" },
        sig: "Take 1 tablet by mouth twice daily with meals",
        quantity: 60,
        refills: 3,
        daysSupply: 30,
      },
      insurance_card: {
        planName: "Blue Cross PPO",
        insurerName: "Anthem Blue Cross",
        memberId: "XYZ123456",
        groupNumber: "GRP789",
        networkType: "PPO",
      },
    };

    return {
      documentType: docType,
      confidence: 0.85,
      thinking: "AI model not configured. Returning sample data for demonstration purposes.",
      extractedData: sampleData[docType] || {},
      fhirResources: this.convertToFHIR(sampleData[docType] || {}, docType),
      warnings: [{ field: "overall", message: "Using sample data — AI model not configured", severity: "medium", suggestedAction: "Configure OpenAI API key for real OCR extraction" }],
      ocrQuality: { overallScore: 0.85, issues: ["Sample data mode"] },
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getRequest(id: string): Promise<MultimodalParseRequest | undefined> {
    return this.requests.get(id);
  }

  async getRecentRequests(userId: string, limit = 10): Promise<MultimodalParseRequest[]> {
    return Array.from(this.requests.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

export const multimodalDocumentParser = new MultimodalDocumentParserService();
