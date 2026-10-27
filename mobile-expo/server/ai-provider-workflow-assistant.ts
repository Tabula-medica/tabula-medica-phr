import { governedAICall, type DataCategory } from "./third-party-data-governance";

const DISCLAIMER = "AI-generated clinical workflow assistance. Must be reviewed and verified by a licensed healthcare provider before any clinical decisions. This is not medical advice.";

export interface ProviderPatientContext {
  patientId: string;
  patientName: string;
  demographics: { age: number; gender: string; dob?: string; mrn?: string };
  conditions: Array<{ name: string; status: string; onsetDate?: string; severity?: string; icdCode?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; startDate?: string; adherence?: string }>;
  allergies: Array<{ substance: string; reaction?: string; severity?: string }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string; trend?: string }>;
  labResults: Array<{ name: string; value: number | string; unit: string; referenceRange?: string; date: string; flag?: string }>;
  recentVisits: Array<{ date: string; type: string; provider: string; summary: string }>;
  selectedDataPoints?: string[];
}

export interface ProactiveSuggestion {
  id: string;
  type: "alert" | "recommendation" | "documentation" | "follow_up" | "coding";
  priority: "critical" | "high" | "moderate" | "routine";
  title: string;
  description: string;
  rationale: string;
  actionLabel: string;
  actionType: "generate_document" | "create_order" | "schedule_follow_up" | "review_data" | "run_analysis";
  relatedData: string[];
  confidence: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  narrativeSummary: string;
  keyFindings: Array<{ finding: string; significance: string; source: string }>;
  assessmentPlan: Array<{ problem: string; assessment: string; plan: string }>;
  codingSuggestions: Array<{ code: string; type: string; description: string; confidence: number }>;
  qualityScore: number;
  disclaimer: string;
  generatedAt: string;
}

export interface QuickDocumentOption {
  id: string;
  documentType: string;
  label: string;
  description: string;
  estimatedTime: string;
  requiredDataPoints: string[];
  icon: string;
}

export interface WorkflowAssistantResponse {
  proactiveSuggestions: ProactiveSuggestion[];
  quickDocumentOptions: QuickDocumentOption[];
  patientSnapshot: {
    riskLevel: string;
    activeIssues: number;
    pendingActions: number;
    lastVisitSummary: string;
  };
  disclaimer: string;
}

function buildPatientPrompt(ctx: ProviderPatientContext): string {
  let prompt = `PATIENT: ${ctx.patientName} (ID: ${ctx.patientId})
DEMOGRAPHICS: Age ${ctx.demographics.age}, ${ctx.demographics.gender}${ctx.demographics.mrn ? `, MRN: ${ctx.demographics.mrn}` : ""}

CONDITIONS:
${ctx.conditions.length > 0 ? ctx.conditions.map(c => `- ${c.name} (${c.status})${c.severity ? ` [${c.severity}]` : ""}${c.icdCode ? ` ${c.icdCode}` : ""}`).join("\n") : "None listed"}

MEDICATIONS:
${ctx.medications.length > 0 ? ctx.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.adherence ? ` [Adherence: ${m.adherence}]` : ""}`).join("\n") : "None listed"}

ALLERGIES:
${ctx.allergies.length > 0 ? ctx.allergies.map(a => `- ${a.substance}${a.reaction ? `: ${a.reaction}` : ""}${a.severity ? ` (${a.severity})` : ""}`).join("\n") : "NKDA"}

VITALS:
${ctx.vitals.length > 0 ? ctx.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})${v.trend ? ` [${v.trend}]` : ""}`).join("\n") : "Not available"}

LABS:
${ctx.labResults.length > 0 ? ctx.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.flag ? ` [${l.flag}]` : ""}`).join("\n") : "Not available"}

RECENT VISITS:
${ctx.recentVisits.length > 0 ? ctx.recentVisits.map(v => `- ${v.date}: ${v.type} with ${v.provider} - ${v.summary}`).join("\n") : "None"}`;

  return prompt;
}

function determineCategories(ctx: ProviderPatientContext): DataCategory[] {
  const categories: DataCategory[] = ["demographics"];
  if (ctx.conditions?.length) categories.push("conditions");
  if (ctx.medications?.length) categories.push("medications");
  if (ctx.allergies?.length) categories.push("allergies");
  if (ctx.vitals?.length) categories.push("vitals");
  if (ctx.labResults?.length) categories.push("lab_results");
  return categories;
}

export class ProviderWorkflowAssistantService {
  private stats = { analysesRun: 0, summariesGenerated: 0, documentsGenerated: 0 };

  async analyzePatientContext(ctx: ProviderPatientContext): Promise<WorkflowAssistantResponse> {
    console.log(`[ProviderWorkflow] Analyzing patient context for ${ctx.patientId}`);

    const dataCategories = determineCategories(ctx);

    const govResponse = await governedAICall({
      callerService: "provider-workflow-assistant",
      callerMethod: "analyzePatientContext",
      purpose: "clinical_decision_support",
      model: "gpt-5.2",
      systemPrompt: `You are an AI clinical workflow assistant integrated into a provider's EHR. Analyze the patient chart and proactively surface actionable insights.

For each suggestion, assess priority based on clinical urgency and potential impact. Focus on:
1. Critical safety alerts (drug interactions, abnormal labs, worsening trends)
2. Documentation opportunities (notes that should be generated, coding gaps)
3. Follow-up recommendations (overdue screenings, needed referrals)
4. Workflow optimizations (orders to place, care gaps to close)

Respond in JSON:
{
  "proactiveSuggestions": [
    {
      "id": "suggestion_1",
      "type": "alert|recommendation|documentation|follow_up|coding",
      "priority": "critical|high|moderate|routine",
      "title": "Short title",
      "description": "What the provider should know",
      "rationale": "Clinical reasoning",
      "actionLabel": "Button text for action",
      "actionType": "generate_document|create_order|schedule_follow_up|review_data|run_analysis",
      "relatedData": ["vitals", "labs"],
      "confidence": 85
    }
  ],
  "patientSnapshot": {
    "riskLevel": "low|moderate|high|critical",
    "activeIssues": 3,
    "pendingActions": 2,
    "lastVisitSummary": "Brief summary of last visit"
  }
}`,
      userPrompt: `Analyze this patient's chart and provide proactive clinical workflow suggestions:\n\n${buildPatientPrompt(ctx)}`,
      dataCategories,
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.analysesRun++;

    const quickDocOptions: QuickDocumentOption[] = [
      { id: "soap", documentType: "soap_note", label: "SOAP Note", description: "Subjective, Objective, Assessment, Plan", estimatedTime: "~15s", requiredDataPoints: ["conditions", "vitals", "medications"], icon: "file-text" },
      { id: "progress", documentType: "progress_note", label: "Progress Note", description: "Visit progress documentation", estimatedTime: "~15s", requiredDataPoints: ["conditions", "vitals", "labs"], icon: "edit-3" },
      { id: "hp", documentType: "history_and_physical", label: "H&P", description: "History and Physical examination", estimatedTime: "~20s", requiredDataPoints: ["conditions", "vitals", "medications", "allergies"], icon: "clipboard" },
      { id: "discharge", documentType: "discharge_summary", label: "Discharge Summary", description: "Comprehensive discharge documentation", estimatedTime: "~20s", requiredDataPoints: ["conditions", "medications", "vitals"], icon: "log-out" },
      { id: "referral", documentType: "referral_letter", label: "Referral Letter", description: "Specialist referral with clinical context", estimatedTime: "~15s", requiredDataPoints: ["conditions", "labs", "medications"], icon: "send" },
      { id: "consult", documentType: "consultation_note", label: "Consultation Note", description: "Specialist consultation documentation", estimatedTime: "~18s", requiredDataPoints: ["conditions", "vitals", "labs"], icon: "message-square" },
    ];

    return {
      proactiveSuggestions: parsed.proactiveSuggestions || [],
      quickDocumentOptions: quickDocOptions,
      patientSnapshot: parsed.patientSnapshot || {
        riskLevel: "moderate",
        activeIssues: ctx.conditions.filter(c => c.status === "active").length,
        pendingActions: 0,
        lastVisitSummary: ctx.recentVisits[0]?.summary || "No recent visits",
      },
      disclaimer: DISCLAIMER,
    };
  }

  async generateNoteSummary(
    ctx: ProviderPatientContext,
    selectedDataPoints?: string[],
    visitContext?: string
  ): Promise<NoteSummary> {
    console.log(`[ProviderWorkflow] Generating note summary for ${ctx.patientId}`);

    const dataCategories = determineCategories(ctx);
    const selectedFilter = selectedDataPoints?.length
      ? `\n\nFOCUS ON THESE DATA POINTS: ${selectedDataPoints.join(", ")}`
      : "";
    const visitCtx = visitContext ? `\n\nVISIT CONTEXT: ${visitContext}` : "";

    const govResponse = await governedAICall({
      callerService: "provider-workflow-assistant",
      callerMethod: "generateNoteSummary",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical documentation AI assistant. Generate a comprehensive clinical note summary based on the patient data and any selected data points.

Create a structured clinical note with:
1. A narrative summary suitable for the medical record
2. Key clinical findings with significance and data sources
3. Assessment and plan organized by problem
4. Appropriate medical coding suggestions (ICD-10, CPT)
5. A quality score (0-100) based on completeness

Respond in JSON:
{
  "title": "Note title",
  "narrativeSummary": "Clinical narrative paragraph",
  "keyFindings": [
    { "finding": "Clinical finding", "significance": "Why it matters", "source": "Data source" }
  ],
  "assessmentPlan": [
    { "problem": "Problem name", "assessment": "Clinical assessment", "plan": "Treatment plan" }
  ],
  "codingSuggestions": [
    { "code": "E11.9", "type": "ICD-10", "description": "Type 2 DM", "confidence": 90 }
  ],
  "qualityScore": 85
}`,
      userPrompt: `Generate a clinical note summary:\n\n${buildPatientPrompt(ctx)}${selectedFilter}${visitCtx}`,
      dataCategories,
      maxTokens: 6144,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.summariesGenerated++;

    return {
      id: `summary_${Date.now()}`,
      title: parsed.title || `Clinical Summary - ${ctx.patientName}`,
      narrativeSummary: parsed.narrativeSummary || "",
      keyFindings: parsed.keyFindings || [],
      assessmentPlan: parsed.assessmentPlan || [],
      codingSuggestions: parsed.codingSuggestions || [],
      qualityScore: parsed.qualityScore || 0,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateQuickDocument(
    ctx: ProviderPatientContext,
    documentType: string,
    additionalContext?: string
  ): Promise<{
    id: string;
    documentType: string;
    title: string;
    sections: Array<{ heading: string; content: string; confidence: number }>;
    summary: string;
    codingSuggestions: Array<{ code: string; type: string; description: string; confidence: number }>;
    nextSteps: Array<{ action: string; priority: string; timeframe: string }>;
    qualityScore: number;
    disclaimer: string;
    generatedAt: string;
  }> {
    console.log(`[ProviderWorkflow] Generating quick ${documentType} for ${ctx.patientId}`);

    const dataCategories = determineCategories(ctx);

    const govResponse = await governedAICall({
      callerService: "provider-workflow-assistant",
      callerMethod: "generateQuickDocument",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are an expert clinical documentation AI. Generate a comprehensive ${documentType.replace(/_/g, " ")} clinical document.

Include all clinically relevant information. For each section, assess confidence (0-100).
Suggest appropriate ICD-10 and CPT codes.
Recommend next clinical steps with priorities.

Respond in JSON:
{
  "title": "Document title",
  "sections": [
    { "heading": "Section name", "content": "Section content text", "confidence": 85 }
  ],
  "summary": "Brief clinical summary",
  "codingSuggestions": [
    { "code": "E11.9", "type": "ICD-10", "description": "Type 2 DM", "confidence": 90 }
  ],
  "nextSteps": [
    { "action": "Recommended action", "priority": "urgent|high|moderate|routine", "timeframe": "When" }
  ],
  "qualityScore": 85
}`,
      userPrompt: `Generate a ${documentType.replace(/_/g, " ")}:\n\n${buildPatientPrompt(ctx)}${additionalContext ? `\n\nADDITIONAL CONTEXT:\n${additionalContext}` : ""}`,
      dataCategories,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    this.stats.documentsGenerated++;

    return {
      id: `doc_${Date.now()}`,
      documentType,
      title: parsed.title || `${documentType} - ${ctx.patientName}`,
      sections: parsed.sections || [],
      summary: parsed.summary || "",
      codingSuggestions: parsed.codingSuggestions || [],
      nextSteps: parsed.nextSteps || [],
      qualityScore: parsed.qualityScore || 0,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  async askAssistant(
    ctx: ProviderPatientContext,
    question: string
  ): Promise<{
    answer: string;
    references: Array<{ source: string; detail: string }>;
    suggestedActions: Array<{ action: string; type: string }>;
    disclaimer: string;
  }> {
    console.log(`[ProviderWorkflow] Assistant query for ${ctx.patientId}: ${question.substring(0, 50)}...`);

    const dataCategories = determineCategories(ctx);

    const govResponse = await governedAICall({
      callerService: "provider-workflow-assistant",
      callerMethod: "askAssistant",
      purpose: "clinical_decision_support",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical AI assistant embedded in a provider's workflow. Answer questions about the patient's chart data with evidence-based reasoning. Always cite which data points informed your answer.

Respond in JSON:
{
  "answer": "Detailed clinical answer",
  "references": [
    { "source": "Data category", "detail": "Specific data point referenced" }
  ],
  "suggestedActions": [
    { "action": "Follow-up action", "type": "order|referral|document|review" }
  ]
}`,
      userPrompt: `Provider question: "${question}"\n\nPatient context:\n${buildPatientPrompt(ctx)}`,
      dataCategories,
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);

    return {
      answer: parsed.answer || "",
      references: parsed.references || [],
      suggestedActions: parsed.suggestedActions || [],
      disclaimer: DISCLAIMER,
    };
  }

  getStats() {
    return { ...this.stats, initialized: true };
  }
}

export const providerWorkflowAssistantService = new ProviderWorkflowAssistantService();
