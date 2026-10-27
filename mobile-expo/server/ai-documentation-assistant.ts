import { governedAICall, type DataCategory } from "./third-party-data-governance";

const DISCLAIMER = "AI-generated documentation draft. Must be reviewed, verified, and signed by a licensed healthcare provider before use in clinical care. This is not medical advice.";

function determineDataCategories(patientData: PatientDataBundle): DataCategory[] {
  const categories: DataCategory[] = ["demographics"];
  if (patientData.conditions?.length) categories.push("conditions");
  if (patientData.medications?.length) categories.push("medications");
  if (patientData.allergies?.length) categories.push("allergies");
  if (patientData.vitals?.length) categories.push("vitals");
  if (patientData.labResults?.length) categories.push("lab_results");
  if (patientData.treatmentHistory?.length) categories.push("clinical_notes");
  return categories;
}

export interface PatientDataBundle {
  demographics: {
    name: string;
    age: number;
    gender: string;
    dob: string;
    mrn: string;
  };
  conditions: string[];
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
  }>;
  allergies: string[];
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
    trend?: string;
  }>;
  labResults: Array<{
    name: string;
    value: number;
    unit: string;
    referenceRange: string;
    date: string;
    flag?: string;
  }>;
  treatmentHistory: Array<{
    treatment: string;
    condition: string;
    startDate: string;
    efficacy?: string;
    status: string;
  }>;
  recentVisits: Array<{
    date: string;
    type: string;
    provider: string;
    summary: string;
  }>;
  benchmarkComparisons?: Array<{
    metric: string;
    patientValue: number;
    populationMean: number;
    percentile: number;
    trend: string;
  }>;
}

export interface CodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  clinicalEvidence: string;
  codeType: string;
}

export interface NextStepRecommendation {
  action: string;
  priority: "urgent" | "high" | "moderate" | "routine";
  rationale: string;
  timeframe: string;
  category: "diagnostic" | "therapeutic" | "preventive" | "follow_up" | "referral";
}

export interface ClinicalDocumentDraft {
  documentType: string;
  title: string;
  sections: Array<{
    heading: string;
    content: string;
    aiConfidence: number;
    sources: string[];
  }>;
  summary: string;
  nextSteps: Array<{
    action: string;
    priority: string;
    rationale: string;
    timeframe: string;
  }>;
  codingSuggestions: {
    icd10: CodeSuggestion[];
    cpt: CodeSuggestion[];
    hcpcs: CodeSuggestion[];
  };
  qualityMetrics: {
    completenessScore: number;
    clinicalAccuracy: number;
    codingConfidence: number;
  };
  warnings: string[];
  disclaimer: string;
  generatedAt: Date;
}

export interface DocumentationAssistantConfig {
  enableCodingSuggestions: boolean;
  enableNextSteps: boolean;
  enableBenchmarkComparisons: boolean;
  includePatientEducation: boolean;
  noteStyle: "concise" | "detailed" | "narrative";
  specialtyContext?: string;
}

function buildPatientDataPrompt(patientData: PatientDataBundle): string {
  const d = patientData.demographics;
  let prompt = `PATIENT DEMOGRAPHICS:
Name: ${d.name}, Age: ${d.age}, Gender: ${d.gender}, DOB: ${d.dob}, MRN: ${d.mrn}

ACTIVE CONDITIONS:
${patientData.conditions.length > 0 ? patientData.conditions.map(c => `- ${c}`).join("\n") : "None listed"}

CURRENT MEDICATIONS:
${patientData.medications.length > 0 ? patientData.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency} (since ${m.startDate})`).join("\n") : "None listed"}

ALLERGIES:
${patientData.allergies.length > 0 ? patientData.allergies.join(", ") : "NKDA"}

VITALS:
${patientData.vitals.length > 0 ? patientData.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})${v.trend ? ` [Trend: ${v.trend}]` : ""}`).join("\n") : "Not available"}

LAB RESULTS:
${patientData.labResults.length > 0 ? patientData.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit} (Ref: ${l.referenceRange}, ${l.date})${l.flag ? ` [${l.flag}]` : ""}`).join("\n") : "Not available"}

TREATMENT HISTORY:
${patientData.treatmentHistory.length > 0 ? patientData.treatmentHistory.map(t => `- ${t.treatment} for ${t.condition} (started ${t.startDate}, status: ${t.status})${t.efficacy ? ` [Efficacy: ${t.efficacy}]` : ""}`).join("\n") : "None"}

RECENT VISITS:
${patientData.recentVisits.length > 0 ? patientData.recentVisits.map(v => `- ${v.date}: ${v.type} with ${v.provider} - ${v.summary}`).join("\n") : "None"}`;

  if (patientData.benchmarkComparisons && patientData.benchmarkComparisons.length > 0) {
    prompt += `\n\nPOPULATION BENCHMARK COMPARISONS:
${patientData.benchmarkComparisons.map(b => `- ${b.metric}: Patient value ${b.patientValue} vs population mean ${b.populationMean} (${b.percentile}th percentile, trend: ${b.trend})`).join("\n")}`;
  }

  return prompt;
}

export class AIDocumentationAssistantService {
  private stats = {
    documentsGenerated: 0,
    summariesGenerated: 0,
    codingSuggestionsGenerated: 0,
    nextStepsGenerated: 0,
    totalConfidence: 0,
    confidenceCount: 0,
  };
  private initialized = false;

  async generateDocumentDraft(
    patientData: PatientDataBundle,
    documentType: string,
    additionalContext?: string,
    config?: DocumentationAssistantConfig
  ): Promise<ClinicalDocumentDraft> {
    const noteStyle = config?.noteStyle || "detailed";
    const specialtyContext = config?.specialtyContext ? `\nSpecialty context: ${config.specialtyContext}` : "";

    const template = this.getDocumentTemplates().find(t => t.type === documentType);
    const sectionsList = template ? template.sections.join(", ") : "standard clinical sections";

    const systemPrompt = `You are an expert clinical documentation AI assistant. Generate a comprehensive ${documentType.replace(/_/g, " ")} clinical document.${specialtyContext}

Note style: ${noteStyle}
Required sections: ${sectionsList}

Include all clinically relevant information from the patient data provided. For each section, assess your confidence level (0-100) in the accuracy of the generated content.

${config?.enableBenchmarkComparisons !== false ? "Include population benchmark comparisons where relevant." : ""}
${config?.enableCodingSuggestions !== false ? "Suggest appropriate ICD-10, CPT, and HCPCS codes with confidence levels." : ""}
${config?.enableNextSteps !== false ? "Recommend next clinical steps with priority levels." : ""}
${config?.includePatientEducation ? "Include patient education points." : ""}

Respond in JSON format:
{
  "title": "Document title",
  "sections": [
    { "heading": "Section name", "content": "Section content", "aiConfidence": 85, "sources": ["patient vitals", "lab results"] }
  ],
  "summary": "Brief clinical summary",
  "nextSteps": [
    { "action": "Recommended action", "priority": "urgent|high|moderate|routine", "rationale": "Why this is recommended", "timeframe": "When to do it" }
  ],
  "codingSuggestions": {
    "icd10": [{ "code": "I10", "description": "Essential hypertension", "confidence": 90, "reasoning": "Documented elevated BP", "clinicalEvidence": "BP 150/95", "codeType": "icd10" }],
    "cpt": [{ "code": "99214", "description": "Office visit, moderate", "confidence": 85, "reasoning": "Moderate complexity visit", "clinicalEvidence": "Multiple conditions addressed", "codeType": "cpt" }],
    "hcpcs": []
  },
  "qualityMetrics": { "completenessScore": 90, "clinicalAccuracy": 85, "codingConfidence": 80 },
  "warnings": ["Any clinical warnings or concerns"]
}`;

    const userPrompt = `Generate a ${documentType.replace(/_/g, " ")} for the following patient:

${buildPatientDataPrompt(patientData)}

${additionalContext ? `\nADDITIONAL CONTEXT:\n${additionalContext}` : ""}`;

    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generateDocumentDraft",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt,
      userPrompt,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);

    this.stats.documentsGenerated++;
    if (parsed.qualityMetrics?.clinicalAccuracy) {
      this.stats.totalConfidence += parsed.qualityMetrics.clinicalAccuracy;
      this.stats.confidenceCount++;
    }

    console.log(`[DocAssistant] Document draft generated: ${parsed.title}`);

    return {
      documentType,
      title: parsed.title || `${documentType} - ${patientData.demographics.name}`,
      sections: parsed.sections || [],
      summary: parsed.summary || "",
      nextSteps: parsed.nextSteps || [],
      codingSuggestions: {
        icd10: parsed.codingSuggestions?.icd10 || [],
        cpt: parsed.codingSuggestions?.cpt || [],
        hcpcs: parsed.codingSuggestions?.hcpcs || [],
      },
      qualityMetrics: {
        completenessScore: parsed.qualityMetrics?.completenessScore || 0,
        clinicalAccuracy: parsed.qualityMetrics?.clinicalAccuracy || 0,
        codingConfidence: parsed.qualityMetrics?.codingConfidence || 0,
      },
      warnings: parsed.warnings || [],
      disclaimer: DISCLAIMER,
      generatedAt: new Date(),
    };
  }

  async generatePatientSummary(
    patientData: PatientDataBundle
  ): Promise<{
    summary: string;
    keyFindings: string[];
    activeProblems: string[];
    medicationSummary: string;
    riskFactors: string[];
    preventiveCareGaps: string[];
    disclaimer: string;
  }> {
    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generatePatientSummary",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical documentation AI. Create a concise patient summary suitable for handoffs or quick clinical review.

Respond in JSON:
{
  "summary": "Concise overall patient summary paragraph",
  "keyFindings": ["Key clinical finding 1", "Key clinical finding 2"],
  "activeProblems": ["Active problem 1", "Active problem 2"],
  "medicationSummary": "Brief medication overview",
  "riskFactors": ["Risk factor 1", "Risk factor 2"],
  "preventiveCareGaps": ["Preventive care gap 1"]
}`,
      userPrompt: `Generate a patient summary:\n\n${buildPatientDataPrompt(patientData)}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.summariesGenerated++;

    console.log(`[DocAssistant] Patient summary generated`);

    return {
      summary: parsed.summary || "",
      keyFindings: parsed.keyFindings || [],
      activeProblems: parsed.activeProblems || [],
      medicationSummary: parsed.medicationSummary || "",
      riskFactors: parsed.riskFactors || [],
      preventiveCareGaps: parsed.preventiveCareGaps || [],
      disclaimer: DISCLAIMER,
    };
  }

  async suggestNextSteps(
    patientData: PatientDataBundle,
    currentVisitContext?: string
  ): Promise<NextStepRecommendation[]> {
    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "suggestNextSteps",
      purpose: "clinical_decision_support",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical decision support AI. Analyze the patient data and suggest next clinical steps.

Categories to consider:
- diagnostic: Tests, imaging, or lab work needed
- therapeutic: Medication changes, treatment adjustments
- preventive: Screening, vaccinations, lifestyle interventions
- follow_up: Follow-up visit scheduling
- referral: Specialist referrals needed

Respond in JSON:
{
  "nextSteps": [
    {
      "action": "Specific clinical action",
      "priority": "urgent|high|moderate|routine",
      "rationale": "Clinical reasoning",
      "timeframe": "When to perform",
      "category": "diagnostic|therapeutic|preventive|follow_up|referral"
    }
  ]
}`,
      userPrompt: `Suggest next clinical steps:\n\n${buildPatientDataPrompt(patientData)}${currentVisitContext ? `\n\nCURRENT VISIT CONTEXT:\n${currentVisitContext}` : ""}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.nextStepsGenerated++;

    console.log(`[DocAssistant] Generated ${parsed.nextSteps?.length || 0} next step recommendations`);

    return (parsed.nextSteps || []) as NextStepRecommendation[];
  }

  async generateCodingAssistance(
    clinicalNote: string,
    patientData?: PatientDataBundle
  ): Promise<{
    icd10: CodeSuggestion[];
    cpt: CodeSuggestion[];
    hcpcs: CodeSuggestion[];
    mdm: {
      level: string;
      elements: string[];
      supporting: string[];
    };
    estimatedReimbursement?: string;
  }> {
    console.log(`[DocAssistant] Generating coding assistance`);

    const patientContext = patientData ? `\n\nPatient Context:\n${buildPatientDataPrompt(patientData)}` : "";

    const dataCategories: DataCategory[] = ["conditions", "clinical_notes"];
    if (patientData) {
      if (patientData.medications?.length) dataCategories.push("medications");
      if (patientData.vitals?.length) dataCategories.push("vitals");
    }

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generateCodingAssistance",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a certified medical coder and billing specialist AI. Analyze clinical documentation and provide comprehensive coding assistance following CMS 2021 E/M guidelines.

For Medical Decision Making (MDM), evaluate:
- Number and complexity of problems addressed
- Amount and/or complexity of data to be reviewed and analyzed
- Risk of complications and/or morbidity or mortality of patient management

MDM Levels (per CMS 2021 guidelines):
- Straightforward: Minimal problems, minimal data, minimal risk
- Low: 2+ self-limited problems OR 1 stable chronic illness, limited data, low risk
- Moderate: 1+ chronic illness with mild exacerbation OR 2+ stable chronic illnesses, moderate data, moderate risk
- High: 1+ chronic illness with severe exacerbation OR acute illness posing threat to life/function, extensive data, high risk

Respond in JSON:
{
  "icd10": [{ "code": "code", "description": "desc", "confidence": 90, "reasoning": "why", "clinicalEvidence": "evidence from note", "codeType": "icd10" }],
  "cpt": [{ "code": "code", "description": "desc", "confidence": 85, "reasoning": "why", "clinicalEvidence": "evidence", "codeType": "cpt" }],
  "hcpcs": [{ "code": "code", "description": "desc", "confidence": 80, "reasoning": "why", "clinicalEvidence": "evidence", "codeType": "hcpcs" }],
  "mdm": {
    "level": "Straightforward|Low|Moderate|High",
    "elements": ["Element 1: description", "Element 2: description"],
    "supporting": ["Supporting documentation point 1"]
  },
  "estimatedReimbursement": "Estimated range based on codes"
}`,
      userPrompt: `Analyze this clinical note and provide coding assistance:\n\n${clinicalNote}${patientContext}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.codingSuggestionsGenerated++;

    console.log(`[DocAssistant] Coding assistance generated: ${parsed.icd10?.length || 0} ICD-10, ${parsed.cpt?.length || 0} CPT, ${parsed.hcpcs?.length || 0} HCPCS codes`);

    return {
      icd10: parsed.icd10 || [],
      cpt: parsed.cpt || [],
      hcpcs: parsed.hcpcs || [],
      mdm: {
        level: parsed.mdm?.level || "Straightforward",
        elements: parsed.mdm?.elements || [],
        supporting: parsed.mdm?.supporting || [],
      },
      estimatedReimbursement: parsed.estimatedReimbursement,
    };
  }

  async generateDischargeInstructions(
    patientData: PatientDataBundle,
    admissionSummary: string
  ): Promise<{
    patientInstructions: string;
    medicationChanges: string;
    followUpAppointments: string;
    warningSignsToWatch: string;
    activityRestrictions: string;
    dietaryGuidelines: string;
    disclaimer: string;
  }> {
    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generateDischargeInstructions",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical documentation AI. Generate patient-friendly discharge instructions that are clear, easy to understand, and actionable. Use plain language suitable for patients with varying health literacy levels.

Respond in JSON:
{
  "patientInstructions": "Clear, numbered general discharge instructions",
  "medicationChanges": "List of medication changes with clear instructions",
  "followUpAppointments": "Specific follow-up appointments and timeframes",
  "warningSignsToWatch": "Warning signs that require immediate medical attention",
  "activityRestrictions": "Activity limitations and gradual return to activities",
  "dietaryGuidelines": "Dietary recommendations and restrictions"
}`,
      userPrompt: `Generate discharge instructions:\n\n${buildPatientDataPrompt(patientData)}\n\nADMISSION SUMMARY:\n${admissionSummary}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.documentsGenerated++;

    console.log(`[DocAssistant] Discharge instructions generated`);

    return {
      patientInstructions: parsed.patientInstructions || "",
      medicationChanges: parsed.medicationChanges || "",
      followUpAppointments: parsed.followUpAppointments || "",
      warningSignsToWatch: parsed.warningSignsToWatch || "",
      activityRestrictions: parsed.activityRestrictions || "",
      dietaryGuidelines: parsed.dietaryGuidelines || "",
      disclaimer: DISCLAIMER,
    };
  }

  async generateReferralLetter(
    patientData: PatientDataBundle,
    referralContext: {
      toSpecialty: string;
      reason: string;
      urgency: string;
      specificQuestions: string[];
    }
  ): Promise<{
    letter: string;
    attachmentSuggestions: string[];
    urgencyJustification: string;
  }> {
    console.log(`[DocAssistant] Generating referral letter to ${referralContext.toSpecialty}`);

    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generateReferralLetter",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical documentation AI. Generate a professional referral letter with appropriate clinical context. The letter should be formatted as a formal medical referral.

Respond in JSON:
{
  "letter": "Complete formatted referral letter text",
  "attachmentSuggestions": ["Suggested attachment 1", "Suggested attachment 2"],
  "urgencyJustification": "Clinical justification for the urgency level"
}`,
      userPrompt: `Generate a referral letter:

${buildPatientDataPrompt(patientData)}

REFERRAL DETAILS:
To Specialty: ${referralContext.toSpecialty}
Reason: ${referralContext.reason}
Urgency: ${referralContext.urgency}
Specific Questions: ${referralContext.specificQuestions.join("; ")}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.documentsGenerated++;

    console.log(`[DocAssistant] Referral letter generated`);

    return {
      letter: parsed.letter || "",
      attachmentSuggestions: parsed.attachmentSuggestions || [],
      urgencyJustification: parsed.urgencyJustification || "",
    };
  }

  async generateProgressNote(
    patientData: PatientDataBundle,
    visitContext: {
      chiefComplaint: string;
      interval: string;
      newFindings: string;
      assessmentUpdates: string;
    }
  ): Promise<ClinicalDocumentDraft> {
    const additionalContext = `VISIT CONTEXT:
Chief Complaint: ${visitContext.chiefComplaint}
Interval History: ${visitContext.interval}
New Findings: ${visitContext.newFindings}
Assessment Updates: ${visitContext.assessmentUpdates}`;

    return this.generateDocumentDraft(patientData, "progress_note", additionalContext);
  }

  async analyzeTreatmentPlan(
    patientData: PatientDataBundle
  ): Promise<{
    currentPlan: string;
    efficacyAssessment: string;
    suggestedModifications: string[];
    evidenceBase: string[];
    disclaimer: string;
  }> {
    const dataCategories = determineDataCategories(patientData);

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "analyzeTreatmentPlan",
      purpose: "clinical_decision_support",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical decision support AI. Review the patient's current treatment plan and suggest data-driven modifications based on treatment efficacy, lab trends, and benchmark comparisons.

Respond in JSON:
{
  "currentPlan": "Summary of current treatment plan",
  "efficacyAssessment": "Assessment of how well current treatments are working based on available data",
  "suggestedModifications": ["Modification 1 with rationale", "Modification 2 with rationale"],
  "evidenceBase": ["Evidence supporting suggestion 1", "Evidence supporting suggestion 2"]
}`,
      userPrompt: `Analyze the treatment plan:\n\n${buildPatientDataPrompt(patientData)}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);

    console.log(`[DocAssistant] Treatment plan analysis complete`);

    return {
      currentPlan: parsed.currentPlan || "",
      efficacyAssessment: parsed.efficacyAssessment || "",
      suggestedModifications: parsed.suggestedModifications || [],
      evidenceBase: parsed.evidenceBase || [],
      disclaimer: DISCLAIMER,
    };
  }

  async generateBillingNarrative(
    clinicalNote: string,
    codes: CodeSuggestion[]
  ): Promise<{
    narrative: string;
    supportingDocumentation: string[];
    complianceNotes: string[];
  }> {
    console.log(`[DocAssistant] Generating billing narrative for ${codes.length} codes`);

    const codesContext = codes
      .map(c => `- ${c.codeType.toUpperCase()} ${c.code}: ${c.description} (Confidence: ${c.confidence}%)`)
      .join("\n");

    const govResponse = await governedAICall({
      callerService: "ai-documentation-assistant",
      callerMethod: "generateBillingNarrative",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a medical billing and compliance specialist AI. Create a billing-friendly narrative that supports the assigned medical codes. Ensure the narrative clearly documents medical necessity and aligns with payer requirements.

Respond in JSON:
{
  "narrative": "Billing narrative that supports all assigned codes",
  "supportingDocumentation": ["Supporting documentation point 1", "Point 2"],
  "complianceNotes": ["Compliance consideration 1", "Consideration 2"]
}`,
      userPrompt: `Generate a billing narrative:\n\nCLINICAL NOTE:\n${clinicalNote}\n\nASSIGNED CODES:\n${codesContext}`,
      dataCategories: ["conditions", "clinical_notes"],
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);

    console.log(`[DocAssistant] Billing narrative generated`);

    return {
      narrative: parsed.narrative || "",
      supportingDocumentation: parsed.supportingDocumentation || [],
      complianceNotes: parsed.complianceNotes || [],
    };
  }

  getDocumentTemplates(): Array<{
    type: string;
    name: string;
    description: string;
    requiredFields: string[];
    sections: string[];
  }> {
    return [
      {
        type: "soap",
        name: "SOAP Note",
        description: "Subjective, Objective, Assessment, Plan format for clinical encounters",
        requiredFields: ["demographics", "conditions", "vitals"],
        sections: ["Subjective", "Objective", "Assessment", "Plan"],
      },
      {
        type: "progress_note",
        name: "Progress Note",
        description: "Interval history with updated assessment and modified treatment plan",
        requiredFields: ["demographics", "conditions", "medications"],
        sections: ["Interval History", "Current Status", "Updated Assessment", "Modified Plan", "Follow-Up"],
      },
      {
        type: "h_and_p",
        name: "History and Physical (H&P)",
        description: "Complete history and physical examination documentation",
        requiredFields: ["demographics", "conditions", "medications", "allergies", "vitals"],
        sections: ["Chief Complaint", "History of Present Illness", "Past Medical History", "Family History", "Social History", "Review of Systems", "Physical Examination", "Assessment", "Plan"],
      },
      {
        type: "discharge_summary",
        name: "Discharge Summary",
        description: "Hospital course summary with discharge instructions and follow-up plan",
        requiredFields: ["demographics", "conditions", "medications"],
        sections: ["Admission Diagnosis", "Hospital Course", "Procedures Performed", "Discharge Diagnosis", "Discharge Medications", "Discharge Instructions", "Follow-Up Plan"],
      },
      {
        type: "referral_letter",
        name: "Referral Letter",
        description: "Professional referral with clinical context and specific questions",
        requiredFields: ["demographics", "conditions"],
        sections: ["Patient Introduction", "Reason for Referral", "Clinical History", "Current Medications", "Relevant Studies", "Specific Questions"],
      },
      {
        type: "procedure_note",
        name: "Procedure Note",
        description: "Pre-procedure, intra-procedure, and post-procedure documentation",
        requiredFields: ["demographics", "conditions", "allergies"],
        sections: ["Pre-Procedure Assessment", "Indications", "Procedure Description", "Findings", "Specimens", "Complications", "Post-Procedure Plan"],
      },
      {
        type: "consultation",
        name: "Consultation Note",
        description: "Consulting specialty assessment and recommendations",
        requiredFields: ["demographics", "conditions", "medications", "vitals"],
        sections: ["Reason for Consultation", "History of Present Illness", "Relevant History", "Physical Examination", "Diagnostic Review", "Assessment", "Recommendations"],
      },
    ];
  }

  getStats(): {
    documentsGenerated: number;
    summariesGenerated: number;
    codingSuggestionsGenerated: number;
    nextStepsGenerated: number;
    averageConfidence: number;
    initialized: boolean;
  } {
    return {
      documentsGenerated: this.stats.documentsGenerated,
      summariesGenerated: this.stats.summariesGenerated,
      codingSuggestionsGenerated: this.stats.codingSuggestionsGenerated,
      nextStepsGenerated: this.stats.nextStepsGenerated,
      averageConfidence:
        this.stats.confidenceCount > 0
          ? Math.round((this.stats.totalConfidence / this.stats.confidenceCount) * 10) / 10
          : 0,
      initialized: this.initialized,
    };
  }
}

export const aiDocumentationAssistant = new AIDocumentationAssistantService();

export function initializeDocumentationAssistant(): void {
  console.log("[DocAssistant] Initializing AI Documentation Assistant Service...");
  (aiDocumentationAssistant as any).initialized = true;
  console.log("[DocAssistant] AI Documentation Assistant Service initialized");
  console.log(`[DocAssistant] Available document templates: ${aiDocumentationAssistant.getDocumentTemplates().map(t => t.name).join(", ")}`);
}
