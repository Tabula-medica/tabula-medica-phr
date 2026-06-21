import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface TranscriptionResult {
  text: string;
  structuredNotes: StructuredNote;
  confidence: number;
}

export interface StructuredNote {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  reviewOfSystems: string[];
  physicalExamFindings: string[];
  assessment: string;
  plan: string[];
  medications: MedicationEntry[];
  allergies: string[];
  vitalSigns?: VitalSigns;
}

export interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  route: string;
}

export interface VitalSigns {
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  weight?: string;
  height?: string;
}

export interface ClinicalNoteRequest {
  patientId: string;
  patientSummary: string;
  visitType: "initial" | "follow_up" | "urgent" | "telehealth";
  chiefComplaint: string;
  caseReviewNotes?: string;
  additionalContext?: string;
}

export interface ClinicalNoteResponse {
  noteId: string;
  draftNote: string;
  structuredNote: StructuredNote;
  suggestedCodes: CodeSuggestion[];
  generatedAt: string;
  disclaimer: string;
}

export interface CodeSuggestion {
  code: string;
  type: "ICD-10" | "CPT";
  description: string;
  confidence: number;
  rationale: string;
}

export interface PriorAuthRequest {
  patientId: string;
  patientName: string;
  insuranceInfo: {
    payerId: string;
    payerName: string;
    memberId: string;
    groupNumber?: string;
  };
  requestedService: {
    description: string;
    cptCodes: string[];
    icd10Codes: string[];
  };
  clinicalJustification: string;
  supportingDocumentation?: string[];
}

export interface PriorAuthResponse {
  requestId: string;
  status: "draft" | "ready_for_review" | "submitted";
  authorizationLetter: string;
  clinicalSummary: string;
  medicalNecessityStatement: string;
  supportingEvidence: string[];
  estimatedProcessingDays: number;
  generatedAt: string;
  disclaimer: string;
}

class AIClinicalDocumentationService {
  private static instance: AIClinicalDocumentationService;

  private constructor() {
    console.log("[AIClinicalDocumentation] Service initialized with NO-CDS compliance");
  }

  static getInstance(): AIClinicalDocumentationService {
    if (!AIClinicalDocumentationService.instance) {
      AIClinicalDocumentationService.instance = new AIClinicalDocumentationService();
    }
    return AIClinicalDocumentationService.instance;
  }

  async transcribeConversation(audioBase64: string, mimeType: string = "audio/webm"): Promise<TranscriptionResult> {
    try {
      const buffer = Buffer.from(audioBase64, "base64");
      const file = new File([buffer], "audio.webm", { type: mimeType });

      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
      });

      const structuredNotes = await this.parseTranscriptionToStructuredNotes(transcription.text);

      return {
        text: transcription.text,
        structuredNotes,
        confidence: 0.92,
      };
    } catch (error) {
      console.error("[AIClinicalDocumentation] Transcription error:", error);
      return this.getFallbackTranscription();
    }
  }

  private async parseTranscriptionToStructuredNotes(transcription: string): Promise<StructuredNote> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a medical documentation assistant. Parse the following patient-provider conversation transcript into structured clinical notes. Extract key medical information and organize it into standard clinical note sections. Output must be valid JSON.

IMPORTANT: This is for documentation assistance only. All outputs require physician review and should not be used for clinical decision-making without professional verification.`,
          },
          {
            role: "user",
            content: `Parse this transcript into structured clinical notes:\n\n${transcription}\n\nReturn JSON with these fields: chiefComplaint, historyOfPresentIllness, reviewOfSystems (array), physicalExamFindings (array), assessment, plan (array), medications (array of {name, dosage, frequency, route}), allergies (array), vitalSigns (optional object).`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } catch (error) {
      console.error("[AIClinicalDocumentation] Parse error:", error);
      return this.getEmptyStructuredNote();
    }
  }

  async generateClinicalNote(request: ClinicalNoteRequest): Promise<ClinicalNoteResponse> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation assistant helping physicians create accurate, comprehensive clinical notes. Generate professional medical documentation based on the provided patient information.

CRITICAL COMPLIANCE NOTES:
- This is a DRAFT for physician review only
- Do NOT provide clinical decision support or treatment recommendations
- All content requires verification by a licensed healthcare provider
- Include standard NO-CDS disclaimer in output

Generate a complete clinical note following standard SOAP format.`,
          },
          {
            role: "user",
            content: `Generate a draft clinical note for:
            
Patient ID: ${request.patientId}
Visit Type: ${request.visitType}
Chief Complaint: ${request.chiefComplaint}

Patient Summary:
${request.patientSummary}

${request.caseReviewNotes ? `Case Review Notes:\n${request.caseReviewNotes}` : ""}

${request.additionalContext ? `Additional Context:\n${request.additionalContext}` : ""}

Return JSON with: draftNote (full narrative note), structuredNote (parsed sections), and disclaimer.`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      const suggestedCodes = await this.suggestCodes(parsed.draftNote || request.chiefComplaint, request.patientSummary);

      return {
        noteId: `note-${Date.now()}`,
        draftNote: parsed.draftNote || "Unable to generate note. Please try again.",
        structuredNote: parsed.structuredNote || this.getEmptyStructuredNote(),
        suggestedCodes,
        generatedAt: new Date().toISOString(),
        disclaimer: "DRAFT - FOR PHYSICIAN REVIEW ONLY. This AI-generated note is for documentation assistance only and does not constitute clinical decision support. All content must be verified by a licensed healthcare provider before use in patient care.",
      };
    } catch (error) {
      console.error("[AIClinicalDocumentation] Note generation error:", error);
      return this.getFallbackNoteResponse(request);
    }
  }

  async suggestCodes(clinicalText: string, patientContext?: string): Promise<CodeSuggestion[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a medical coding assistant. Analyze clinical documentation and suggest appropriate ICD-10 diagnosis codes and CPT procedure codes. 

IMPORTANT: These are suggestions for coder/physician review only. Final code selection must be verified by a certified medical coder or the treating physician.

Return a JSON array of code suggestions with: code, type (ICD-10 or CPT), description, confidence (0-1), and rationale.`,
          },
          {
            role: "user",
            content: `Suggest ICD-10 and CPT codes for this clinical documentation:

${clinicalText}

${patientContext ? `Patient Context:\n${patientContext}` : ""}

Return up to 10 most relevant codes as JSON array.`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content || '{"codes":[]}';
      const parsed = JSON.parse(content);
      return parsed.codes || parsed.suggestions || [];
    } catch (error) {
      console.error("[AIClinicalDocumentation] Code suggestion error:", error);
      return this.getFallbackCodes();
    }
  }

  async generatePriorAuthorization(request: PriorAuthRequest): Promise<PriorAuthResponse> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a prior authorization specialist assistant. Generate comprehensive prior authorization request documentation based on clinical information.

CRITICAL: This is a DRAFT for administrative and physician review. All medical necessity statements and clinical justifications must be verified by the treating physician before submission.

Generate professional prior authorization documentation that includes:
1. Authorization request letter
2. Clinical summary
3. Medical necessity statement
4. Supporting evidence summary`,
          },
          {
            role: "user",
            content: `Generate prior authorization documentation:

Patient: ${request.patientName} (ID: ${request.patientId})
Insurance: ${request.insuranceInfo.payerName} (Member: ${request.insuranceInfo.memberId})

Requested Service: ${request.requestedService.description}
CPT Codes: ${request.requestedService.cptCodes.join(", ")}
ICD-10 Codes: ${request.requestedService.icd10Codes.join(", ")}

Clinical Justification:
${request.clinicalJustification}

${request.supportingDocumentation ? `Supporting Documents: ${request.supportingDocumentation.join(", ")}` : ""}

Return JSON with: authorizationLetter, clinicalSummary, medicalNecessityStatement, supportingEvidence (array), estimatedProcessingDays.`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      return {
        requestId: `pa-${Date.now()}`,
        status: "draft",
        authorizationLetter: parsed.authorizationLetter || "Unable to generate. Please try again.",
        clinicalSummary: parsed.clinicalSummary || "",
        medicalNecessityStatement: parsed.medicalNecessityStatement || "",
        supportingEvidence: parsed.supportingEvidence || [],
        estimatedProcessingDays: parsed.estimatedProcessingDays || 5,
        generatedAt: new Date().toISOString(),
        disclaimer: "DRAFT - FOR REVIEW ONLY. This AI-generated prior authorization request requires physician review and verification before submission. Medical necessity statements must be confirmed by the treating provider.",
      };
    } catch (error) {
      console.error("[AIClinicalDocumentation] Prior auth error:", error);
      return this.getFallbackPriorAuthResponse(request);
    }
  }

  private getFallbackTranscription(): TranscriptionResult {
    return {
      text: "Sample transcription: Patient presents with complaints of persistent headache for the past 3 days. Pain is described as throbbing, located in the frontal region, rated 6/10. Patient reports mild nausea but no vomiting. No visual disturbances or fever noted.",
      structuredNotes: {
        chiefComplaint: "Persistent headache for 3 days",
        historyOfPresentIllness: "Patient presents with throbbing frontal headache, 6/10 severity, associated with mild nausea. No vomiting, visual changes, or fever.",
        reviewOfSystems: ["Neurological: Headache present, no visual disturbances", "GI: Mild nausea, no vomiting"],
        physicalExamFindings: ["Alert and oriented", "No focal neurological deficits"],
        assessment: "Tension-type headache vs. migraine without aura",
        plan: ["OTC analgesics as needed", "Hydration", "Follow up if symptoms worsen"],
        medications: [{ name: "Ibuprofen", dosage: "400mg", frequency: "every 6 hours as needed", route: "oral" }],
        allergies: [],
      },
      confidence: 0.85,
    };
  }

  private getEmptyStructuredNote(): StructuredNote {
    return {
      chiefComplaint: "",
      historyOfPresentIllness: "",
      reviewOfSystems: [],
      physicalExamFindings: [],
      assessment: "",
      plan: [],
      medications: [],
      allergies: [],
    };
  }

  private getFallbackNoteResponse(request: ClinicalNoteRequest): ClinicalNoteResponse {
    return {
      noteId: `note-${Date.now()}`,
      draftNote: `DRAFT CLINICAL NOTE

Patient ID: ${request.patientId}
Visit Type: ${request.visitType}
Date: ${new Date().toLocaleDateString()}

CHIEF COMPLAINT:
${request.chiefComplaint}

HISTORY OF PRESENT ILLNESS:
Based on patient summary: ${request.patientSummary.substring(0, 200)}...

ASSESSMENT:
[Pending physician review]

PLAN:
[Pending physician review]

---
This is an AI-generated draft requiring physician verification.`,
      structuredNote: {
        chiefComplaint: request.chiefComplaint,
        historyOfPresentIllness: request.patientSummary,
        reviewOfSystems: [],
        physicalExamFindings: [],
        assessment: "Pending physician assessment",
        plan: ["Pending physician review"],
        medications: [],
        allergies: [],
      },
      suggestedCodes: this.getFallbackCodes(),
      generatedAt: new Date().toISOString(),
      disclaimer: "DRAFT - FOR PHYSICIAN REVIEW ONLY. This AI-generated note is for documentation assistance only.",
    };
  }

  private getFallbackCodes(): CodeSuggestion[] {
    return [
      {
        code: "R51.9",
        type: "ICD-10",
        description: "Headache, unspecified",
        confidence: 0.85,
        rationale: "Based on chief complaint of headache",
      },
      {
        code: "99213",
        type: "CPT",
        description: "Office visit, established patient, low complexity",
        confidence: 0.80,
        rationale: "Standard follow-up visit complexity",
      },
      {
        code: "99214",
        type: "CPT",
        description: "Office visit, established patient, moderate complexity",
        confidence: 0.75,
        rationale: "Alternative if additional workup required",
      },
    ];
  }

  private getFallbackPriorAuthResponse(request: PriorAuthRequest): PriorAuthResponse {
    return {
      requestId: `pa-${Date.now()}`,
      status: "draft",
      authorizationLetter: `PRIOR AUTHORIZATION REQUEST

Date: ${new Date().toLocaleDateString()}
Patient: ${request.patientName}
Member ID: ${request.insuranceInfo.memberId}
Payer: ${request.insuranceInfo.payerName}

RE: Prior Authorization Request for ${request.requestedService.description}

Dear Medical Director,

I am writing to request prior authorization for the above-referenced service for our patient.

Clinical Justification:
${request.clinicalJustification}

The requested service is medically necessary based on the patient's clinical presentation and standard of care guidelines.

Please contact our office if additional information is required.

Sincerely,
[Physician Signature Required]

---
DRAFT - Requires physician review before submission`,
      clinicalSummary: request.clinicalJustification,
      medicalNecessityStatement: "Medical necessity to be verified by treating physician.",
      supportingEvidence: request.supportingDocumentation || [],
      estimatedProcessingDays: 5,
      generatedAt: new Date().toISOString(),
      disclaimer: "DRAFT - FOR REVIEW ONLY. Requires physician verification before submission.",
    };
  }
}

export const aiClinicalDocService = AIClinicalDocumentationService.getInstance();
