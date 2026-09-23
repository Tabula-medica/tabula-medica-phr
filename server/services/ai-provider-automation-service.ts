import { generatePhiSafeText } from "./ai-gateway";
import type { PatientRecordData, PatientCondition, PatientMedication, PatientEncounter, PatientVital, PatientLabResult } from "./ai-patient-summary-service";

// PHI-bearing generation runs through the Vertex/BAA gateway (P1-1.2).
const aiEnabled = true;

export interface ClinicalDocumentationSnippet {
  id: string;
  type: "progress_note" | "soap_note" | "assessment" | "plan" | "hpi";
  title: string;
  content: string;
  sections: {
    header: string;
    text: string;
  }[];
  suggestedIcdCodes: {
    code: string;
    description: string;
    confidence: number;
  }[];
  suggestedCptCodes: {
    code: string;
    description: string;
  }[];
  generatedAt: string;
  disclaimer: string;
}

export interface ReferralNote {
  id: string;
  referralType: "specialist" | "imaging" | "procedure" | "therapy" | "consultation";
  specialtyRecommendation: string;
  urgency: "routine" | "urgent" | "emergent";
  clinicalSummary: string;
  reasonForReferral: string;
  relevantHistory: string;
  currentMedications: string;
  relevantLabFindings: string;
  specificQuestions: string[];
  suggestedSpecialists: string[];
  generatedAt: string;
  disclaimer: string;
}

export interface PreventiveCareOrder {
  id: string;
  orderType: "screening" | "vaccination" | "lab" | "counseling" | "procedure";
  name: string;
  description: string;
  guidelineSource: string;
  evidenceLevel: "A" | "B" | "C" | "D";
  priority: "high" | "medium" | "low";
  dueStatus: "overdue" | "due_soon" | "scheduled" | "up_to_date";
  lastPerformed?: string;
  nextDue?: string;
  patientAgeApplicability: string;
  contraindications: string[];
  disclaimer: string;
}

export interface ProviderAutomationResult<T> {
  success: boolean;
  data: T;
  confidence: number;
  processingTimeMs: number;
  disclaimer: string;
  auditLogId?: string;
}

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated content is for documentation assistance only. It does not constitute medical advice, diagnosis, or treatment recommendations. All content must be reviewed, verified, and approved by a licensed healthcare provider before use. Clinical decision-making remains the sole responsibility of the treating clinician.";

export class AIProviderAutomationService {
  private generateId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async generateClinicalDocumentation(
    patientData: PatientRecordData,
    documentType: ClinicalDocumentationSnippet["type"],
    encounterContext?: { reason?: string; chiefComplaint?: string; findings?: string }
  ): Promise<ProviderAutomationResult<ClinicalDocumentationSnippet>> {
    const startTime = Date.now();

    if (!aiEnabled) {
      return this.generateFallbackDocumentation(patientData, documentType, encounterContext, startTime);
    }

    try {
      const prompt = this.buildDocumentationPrompt(patientData, documentType, encounterContext);

      const responseText = await generatePhiSafeText({
        system: `You are an AI assistant helping healthcare providers with clinical documentation. Generate structured clinical documentation snippets based on patient data.

CRITICAL COMPLIANCE REQUIREMENTS:
- This is INFORMATIONAL ONLY - NOT clinical decision support
- Include all relevant disclaimers
- Suggest ICD-10 and CPT codes for coding assistance only
- All output must be reviewed and approved by a licensed provider
- Never provide treatment recommendations

Return JSON with this structure:
{
  "type": "${documentType}",
  "title": "string",
  "content": "full text content",
  "sections": [{"header": "string", "text": "string"}],
  "suggestedIcdCodes": [{"code": "string", "description": "string", "confidence": 0.0-1.0}],
  "suggestedCptCodes": [{"code": "string", "description": "string"}]
}`,
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 2000,
      });

      const parsed = JSON.parse(responseText || "{}");
      
      const snippet: ClinicalDocumentationSnippet = {
        id: this.generateId(),
        type: documentType,
        title: parsed.title || `${documentType.replace(/_/g, " ").toUpperCase()} Note`,
        content: parsed.content || "",
        sections: parsed.sections || [],
        suggestedIcdCodes: parsed.suggestedIcdCodes || [],
        suggestedCptCodes: parsed.suggestedCptCodes || [],
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      };

      return {
        success: true,
        data: snippet,
        confidence: 0.85,
        processingTimeMs: Date.now() - startTime,
        disclaimer: NO_CDS_DISCLAIMER,
      };
    } catch (error) {
      console.error("[AIProviderAutomation] Documentation generation error:", error);
      return this.generateFallbackDocumentation(patientData, documentType, encounterContext, startTime);
    }
  }

  async generateReferralNote(
    patientData: PatientRecordData,
    referralType: ReferralNote["referralType"],
    targetCondition: string,
    urgency: ReferralNote["urgency"] = "routine"
  ): Promise<ProviderAutomationResult<ReferralNote>> {
    const startTime = Date.now();

    if (!aiEnabled) {
      return this.generateFallbackReferral(patientData, referralType, targetCondition, urgency, startTime);
    }

    try {
      const prompt = this.buildReferralPrompt(patientData, referralType, targetCondition, urgency);

      const responseText = await generatePhiSafeText({
        system: `You are an AI assistant helping healthcare providers draft referral notes. Generate comprehensive referral documentation based on patient data and clinical context.

CRITICAL COMPLIANCE REQUIREMENTS:
- This is INFORMATIONAL ONLY - NOT clinical decision support
- Include all relevant patient history and current medications
- Suggest appropriate specialty based on condition
- Never provide treatment recommendations
- All referrals must be reviewed and signed by referring provider

Return JSON with this structure:
{
  "specialtyRecommendation": "string",
  "clinicalSummary": "string",
  "reasonForReferral": "string",
  "relevantHistory": "string",
  "currentMedications": "string",
  "relevantLabFindings": "string",
  "specificQuestions": ["string"],
  "suggestedSpecialists": ["string"]
}`,
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 1500,
      });

      const parsed = JSON.parse(responseText || "{}");
      
      const referral: ReferralNote = {
        id: this.generateId(),
        referralType,
        urgency,
        specialtyRecommendation: parsed.specialtyRecommendation || "General Specialist",
        clinicalSummary: parsed.clinicalSummary || "",
        reasonForReferral: parsed.reasonForReferral || targetCondition,
        relevantHistory: parsed.relevantHistory || "",
        currentMedications: parsed.currentMedications || "",
        relevantLabFindings: parsed.relevantLabFindings || "",
        specificQuestions: parsed.specificQuestions || [],
        suggestedSpecialists: parsed.suggestedSpecialists || [],
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      };

      return {
        success: true,
        data: referral,
        confidence: 0.82,
        processingTimeMs: Date.now() - startTime,
        disclaimer: NO_CDS_DISCLAIMER,
      };
    } catch (error) {
      console.error("[AIProviderAutomation] Referral generation error:", error);
      return this.generateFallbackReferral(patientData, referralType, targetCondition, urgency, startTime);
    }
  }

  async generatePreventiveCareOrders(
    patientData: PatientRecordData
  ): Promise<ProviderAutomationResult<PreventiveCareOrder[]>> {
    const startTime = Date.now();

    if (!aiEnabled) {
      return this.generateFallbackPreventiveOrders(patientData, startTime);
    }

    try {
      const prompt = this.buildPreventiveCarPrompt(patientData);

      const responseText = await generatePhiSafeText({
        system: `You are an AI assistant helping healthcare providers identify applicable preventive care recommendations based on patient demographics, history, and current guidelines (USPSTF, CDC, ACS).

CRITICAL COMPLIANCE REQUIREMENTS:
- This is INFORMATIONAL ONLY - NOT clinical decision support
- Base recommendations on established guidelines only
- Include evidence levels and guideline sources
- Identify contraindications from patient history
- All orders must be reviewed and approved by treating provider
- Never provide treatment recommendations

Return JSON with this structure:
{
  "orders": [
    {
      "orderType": "screening|vaccination|lab|counseling|procedure",
      "name": "string",
      "description": "string",
      "guidelineSource": "USPSTF|CDC|ACS|AHA|etc",
      "evidenceLevel": "A|B|C|D",
      "priority": "high|medium|low",
      "dueStatus": "overdue|due_soon|scheduled|up_to_date",
      "lastPerformed": "ISO date or null",
      "nextDue": "ISO date or null",
      "patientAgeApplicability": "string describing age range",
      "contraindications": ["string"]
    }
  ]
}`,
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 2500,
      });

      const parsed = JSON.parse(responseText || "{}");

      const orders: PreventiveCareOrder[] = (parsed.orders || []).map((order: any) => ({
        id: this.generateId(),
        orderType: order.orderType || "screening",
        name: order.name || "Unknown",
        description: order.description || "",
        guidelineSource: order.guidelineSource || "General Guidelines",
        evidenceLevel: order.evidenceLevel || "B",
        priority: order.priority || "medium",
        dueStatus: order.dueStatus || "due_soon",
        lastPerformed: order.lastPerformed,
        nextDue: order.nextDue,
        patientAgeApplicability: order.patientAgeApplicability || "",
        contraindications: order.contraindications || [],
        disclaimer: NO_CDS_DISCLAIMER,
      }));

      return {
        success: true,
        data: orders,
        confidence: 0.80,
        processingTimeMs: Date.now() - startTime,
        disclaimer: NO_CDS_DISCLAIMER,
      };
    } catch (error) {
      console.error("[AIProviderAutomation] Preventive care generation error:", error);
      return this.generateFallbackPreventiveOrders(patientData, startTime);
    }
  }

  private buildDocumentationPrompt(
    patientData: PatientRecordData,
    documentType: ClinicalDocumentationSnippet["type"],
    context?: { reason?: string; chiefComplaint?: string; findings?: string }
  ): string {
    const { demographics, conditions, medications, vitals, labResults, encounters } = patientData;
    
    let prompt = `Generate a ${documentType.replace(/_/g, " ")} clinical documentation snippet for:\n\n`;
    prompt += `PATIENT: ${demographics.name}, ${demographics.age || "Unknown"} y/o ${demographics.gender}\n`;
    prompt += `DOB: ${demographics.dateOfBirth}\n\n`;

    if (context?.chiefComplaint) {
      prompt += `CHIEF COMPLAINT: ${context.chiefComplaint}\n`;
    }
    if (context?.reason) {
      prompt += `VISIT REASON: ${context.reason}\n`;
    }
    if (context?.findings) {
      prompt += `EXAMINATION FINDINGS: ${context.findings}\n`;
    }

    prompt += `\nACTIVE CONDITIONS:\n`;
    conditions.filter(c => c.status === "active").forEach(c => {
      prompt += `- ${c.name} (${c.severity || "unspecified severity"})\n`;
    });

    prompt += `\nCURRENT MEDICATIONS:\n`;
    medications.filter(m => m.status === "active").forEach(m => {
      prompt += `- ${m.name} ${m.dosage} ${m.frequency}\n`;
    });

    if (vitals.length > 0) {
      prompt += `\nRECENT VITALS:\n`;
      vitals.slice(-5).forEach(v => {
        prompt += `- ${v.type}: ${v.value} ${v.unit}\n`;
      });
    }

    if (labResults.length > 0) {
      prompt += `\nRECENT LABS:\n`;
      labResults.slice(-5).forEach(l => {
        prompt += `- ${l.name}: ${l.value} ${l.unit}${l.abnormal ? " (ABNORMAL)" : ""}\n`;
      });
    }

    return prompt;
  }

  private buildReferralPrompt(
    patientData: PatientRecordData,
    referralType: string,
    targetCondition: string,
    urgency: string
  ): string {
    const { demographics, conditions, medications, allergies, labResults } = patientData;
    
    let prompt = `Generate a ${urgency} ${referralType} referral note for:\n\n`;
    prompt += `PATIENT: ${demographics.name}, ${demographics.age || "Unknown"} y/o ${demographics.gender}\n`;
    prompt += `DOB: ${demographics.dateOfBirth}\n\n`;
    prompt += `REASON FOR REFERRAL: ${targetCondition}\n\n`;

    prompt += `MEDICAL HISTORY:\n`;
    conditions.forEach(c => {
      prompt += `- ${c.name} (${c.status})${c.onsetDate ? ` since ${c.onsetDate}` : ""}\n`;
    });

    prompt += `\nCURRENT MEDICATIONS:\n`;
    medications.forEach(m => {
      prompt += `- ${m.name} ${m.dosage} ${m.frequency}\n`;
    });

    prompt += `\nALLERGIES:\n`;
    if (allergies.length === 0) {
      prompt += "- NKDA\n";
    } else {
      allergies.forEach(a => {
        prompt += `- ${a.substance}${a.reaction ? `: ${a.reaction}` : ""}\n`;
      });
    }

    if (labResults.length > 0) {
      prompt += `\nRELEVANT LABS:\n`;
      labResults.slice(-10).forEach(l => {
        prompt += `- ${l.name}: ${l.value} ${l.unit} (${l.date})${l.abnormal ? " ABNORMAL" : ""}\n`;
      });
    }

    return prompt;
  }

  private buildPreventiveCarPrompt(patientData: PatientRecordData): string {
    const { demographics, conditions, medications, encounters } = patientData;
    
    const age = demographics.age || this.calculateAge(demographics.dateOfBirth);
    
    let prompt = `Identify applicable preventive care recommendations for:\n\n`;
    prompt += `PATIENT: ${demographics.name}\n`;
    prompt += `AGE: ${age} years\n`;
    prompt += `GENDER: ${demographics.gender}\n\n`;

    prompt += `MEDICAL HISTORY:\n`;
    conditions.forEach(c => {
      prompt += `- ${c.name} (${c.status})\n`;
    });

    prompt += `\nCURRENT MEDICATIONS:\n`;
    medications.forEach(m => {
      prompt += `- ${m.name}\n`;
    });

    prompt += `\nRECENT ENCOUNTERS:\n`;
    encounters.slice(-5).forEach(e => {
      prompt += `- ${e.type} on ${e.date}${e.reason ? `: ${e.reason}` : ""}\n`;
    });

    prompt += `\nBased on USPSTF, CDC, ACS, and AHA guidelines, identify:
1. Overdue screenings
2. Due vaccinations
3. Recommended lab tests
4. Applicable counseling topics
5. Any relevant preventive procedures

Consider patient age, gender, and risk factors from medical history.`;

    return prompt;
  }

  private calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private generateFallbackDocumentation(
    patientData: PatientRecordData,
    documentType: ClinicalDocumentationSnippet["type"],
    context?: { reason?: string; chiefComplaint?: string; findings?: string },
    startTime?: number
  ): ProviderAutomationResult<ClinicalDocumentationSnippet> {
    const { demographics, conditions, medications, vitals } = patientData;
    
    const activeConditions = conditions.filter(c => c.status === "active").map(c => c.name).join(", ");
    const activeMeds = medications.filter(m => m.status === "active").map(m => `${m.name} ${m.dosage}`).join(", ");
    
    const snippet: ClinicalDocumentationSnippet = {
      id: this.generateId(),
      type: documentType,
      title: `${documentType.replace(/_/g, " ").toUpperCase()} - ${demographics.name}`,
      content: `Patient ${demographics.name}, ${demographics.age || "Unknown"} y/o ${demographics.gender}, presents for ${context?.reason || "follow-up visit"}. ${context?.chiefComplaint ? `Chief complaint: ${context.chiefComplaint}. ` : ""}Active conditions include ${activeConditions || "none documented"}. Current medications: ${activeMeds || "none documented"}.`,
      sections: [
        { header: "Demographics", text: `${demographics.name}, ${demographics.age} y/o ${demographics.gender}` },
        { header: "Active Problems", text: activeConditions || "None documented" },
        { header: "Medications", text: activeMeds || "None documented" },
      ],
      suggestedIcdCodes: conditions.filter(c => c.code).slice(0, 3).map(c => ({
        code: c.code || "",
        description: c.name,
        confidence: 0.7,
      })),
      suggestedCptCodes: [{ code: "99213", description: "Office visit, established patient, low complexity" }],
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };

    return {
      success: true,
      data: snippet,
      confidence: 0.6,
      processingTimeMs: startTime ? Date.now() - startTime : 0,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private generateFallbackReferral(
    patientData: PatientRecordData,
    referralType: ReferralNote["referralType"],
    targetCondition: string,
    urgency: ReferralNote["urgency"],
    startTime: number
  ): ProviderAutomationResult<ReferralNote> {
    const { demographics, conditions, medications, allergies } = patientData;

    const referral: ReferralNote = {
      id: this.generateId(),
      referralType,
      urgency,
      specialtyRecommendation: this.getSpecialtyForCondition(targetCondition),
      clinicalSummary: `${demographics.name}, ${demographics.age} y/o ${demographics.gender} with ${targetCondition}`,
      reasonForReferral: targetCondition,
      relevantHistory: conditions.map(c => c.name).join(", ") || "See attached records",
      currentMedications: medications.map(m => `${m.name} ${m.dosage}`).join(", ") || "None",
      relevantLabFindings: "See attached lab results",
      specificQuestions: ["Please evaluate and advise on management", "Please provide recommendations"],
      suggestedSpecialists: [],
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };

    return {
      success: true,
      data: referral,
      confidence: 0.5,
      processingTimeMs: Date.now() - startTime,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private generateFallbackPreventiveOrders(
    patientData: PatientRecordData,
    startTime: number
  ): ProviderAutomationResult<PreventiveCareOrder[]> {
    const age = patientData.demographics.age || this.calculateAge(patientData.demographics.dateOfBirth);
    const gender = patientData.demographics.gender.toLowerCase();
    
    const orders: PreventiveCareOrder[] = [];

    if (age >= 50) {
      orders.push({
        id: this.generateId(),
        orderType: "screening",
        name: "Colorectal Cancer Screening",
        description: "Colonoscopy or approved alternative screening method",
        guidelineSource: "USPSTF",
        evidenceLevel: "A",
        priority: "high",
        dueStatus: "due_soon",
        patientAgeApplicability: "Adults 45-75 years",
        contraindications: [],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    if (gender === "female" && age >= 21 && age <= 65) {
      orders.push({
        id: this.generateId(),
        orderType: "screening",
        name: "Cervical Cancer Screening",
        description: "Pap smear with or without HPV co-testing",
        guidelineSource: "USPSTF",
        evidenceLevel: "A",
        priority: "medium",
        dueStatus: "due_soon",
        patientAgeApplicability: "Women 21-65 years",
        contraindications: [],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    if (gender === "female" && age >= 50) {
      orders.push({
        id: this.generateId(),
        orderType: "screening",
        name: "Breast Cancer Screening",
        description: "Mammography",
        guidelineSource: "USPSTF",
        evidenceLevel: "B",
        priority: "high",
        dueStatus: "due_soon",
        patientAgeApplicability: "Women 50-74 years",
        contraindications: [],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    if (age >= 65) {
      orders.push({
        id: this.generateId(),
        orderType: "vaccination",
        name: "Pneumococcal Vaccination",
        description: "PCV20 or PCV15 + PPSV23",
        guidelineSource: "CDC",
        evidenceLevel: "A",
        priority: "medium",
        dueStatus: "due_soon",
        patientAgeApplicability: "Adults 65+ years",
        contraindications: [],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    orders.push({
      id: this.generateId(),
      orderType: "vaccination",
      name: "Influenza Vaccination",
      description: "Annual influenza vaccine",
      guidelineSource: "CDC",
      evidenceLevel: "A",
      priority: "medium",
      dueStatus: "due_soon",
      patientAgeApplicability: "All adults annually",
      contraindications: [],
      disclaimer: NO_CDS_DISCLAIMER,
    });

    if (age >= 40) {
      orders.push({
        id: this.generateId(),
        orderType: "lab",
        name: "Lipid Panel",
        description: "Fasting lipid profile for cardiovascular risk assessment",
        guidelineSource: "USPSTF",
        evidenceLevel: "B",
        priority: "medium",
        dueStatus: "due_soon",
        patientAgeApplicability: "Adults 40-75 years",
        contraindications: [],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    return {
      success: true,
      data: orders,
      confidence: 0.6,
      processingTimeMs: Date.now() - startTime,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private getSpecialtyForCondition(condition: string): string {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes("heart") || conditionLower.includes("cardiac")) return "Cardiology";
    if (conditionLower.includes("diabetes") || conditionLower.includes("thyroid")) return "Endocrinology";
    if (conditionLower.includes("cancer") || conditionLower.includes("tumor")) return "Oncology";
    if (conditionLower.includes("lung") || conditionLower.includes("respiratory")) return "Pulmonology";
    if (conditionLower.includes("kidney") || conditionLower.includes("renal")) return "Nephrology";
    if (conditionLower.includes("joint") || conditionLower.includes("arthritis")) return "Rheumatology";
    if (conditionLower.includes("skin") || conditionLower.includes("rash")) return "Dermatology";
    if (conditionLower.includes("stomach") || conditionLower.includes("bowel")) return "Gastroenterology";
    if (conditionLower.includes("brain") || conditionLower.includes("neuro")) return "Neurology";
    return "Internal Medicine";
  }
}

export const aiProviderAutomationService = new AIProviderAutomationService();
