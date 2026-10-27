import { storage } from "./storage";
import type { HealthRecord, CaseSummary, ResearchRecommendation, ProviderCommunication } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

interface PatientContext {
  patientId: string;
  conditions: HealthRecord[];
  medications: HealthRecord[];
  allergies: HealthRecord[];
  vitals: HealthRecord[];
  labs: HealthRecord[];
  imaging: HealthRecord[];
  procedures: HealthRecord[];
  recentVisits: HealthRecord[];
}

async function getPatientContext(userId: string): Promise<PatientContext> {
  const records = await storage.getHealthRecords(userId);
  
  return {
    patientId: userId,
    conditions: records.filter(r => r.type === "condition" || r.fhirResourceType === "Condition"),
    medications: records.filter(r => r.type === "medication"),
    allergies: records.filter(r => r.type === "allergy"),
    vitals: records.filter(r => r.type === "vital").slice(0, 10),
    labs: records.filter(r => r.type === "lab" || r.type === "labs").slice(0, 15),
    imaging: records.filter(r => r.type === "imaging").slice(0, 5),
    procedures: records.filter(r => r.type === "procedure").slice(0, 10),
    recentVisits: records.filter(r => r.type === "visit").slice(0, 5),
  };
}

function formatPatientDataForAI(context: PatientContext): string {
  const sections: string[] = [];
  
  if (context.conditions.length > 0) {
    sections.push(`ACTIVE CONDITIONS:\n${context.conditions.map(c => `- ${c.title}${c.summary ? `: ${c.summary}` : ""}`).join("\n")}`);
  }
  
  if (context.medications.length > 0) {
    sections.push(`CURRENT MEDICATIONS:\n${context.medications.map(m => `- ${m.title}${m.summary ? `: ${m.summary}` : ""}`).join("\n")}`);
  }
  
  if (context.allergies.length > 0) {
    sections.push(`ALLERGIES:\n${context.allergies.map(a => `- ${a.title}`).join("\n")}`);
  }
  
  if (context.vitals.length > 0) {
    sections.push(`RECENT VITALS:\n${context.vitals.map(v => `- ${v.title}: ${v.summary} (${new Date(v.date).toLocaleDateString()})`).join("\n")}`);
  }
  
  if (context.labs.length > 0) {
    sections.push(`RECENT LAB RESULTS:\n${context.labs.map(l => `- ${l.title}: ${l.summary} (${new Date(l.date).toLocaleDateString()})`).join("\n")}`);
  }
  
  if (context.imaging.length > 0) {
    sections.push(`IMAGING STUDIES:\n${context.imaging.map(i => `- ${i.title}: ${i.summary} (${new Date(i.date).toLocaleDateString()})`).join("\n")}`);
  }
  
  if (context.procedures.length > 0) {
    sections.push(`PROCEDURES:\n${context.procedures.map(p => `- ${p.title}: ${p.summary} (${new Date(p.date).toLocaleDateString()})`).join("\n")}`);
  }
  
  if (context.recentVisits.length > 0) {
    sections.push(`RECENT VISITS:\n${context.recentVisits.map(v => `- ${v.title} at ${v.facility || "Unknown"} (${new Date(v.date).toLocaleDateString()})`).join("\n")}`);
  }
  
  return sections.join("\n\n");
}

export interface CaseSummaryRequest {
  specialtyType: string;
  chiefComplaint: string;
  specificQuestions?: string[];
  urgencyLevel?: "routine" | "urgent" | "emergent";
  targetSpecialist?: string;
  referringProvider?: string;
}

export interface CaseSummaryResult {
  caseSummary: {
    id: string;
    aiSummary: string;
    keyFindings: string[];
    recommendations: string[];
    historyOfPresentIllness: string;
    clinicalAssessment: string;
    suggestedQuestions: string[];
  };
}

export async function generateCaseSummary(
  userId: string,
  request: CaseSummaryRequest
): Promise<CaseSummaryResult> {
  const context = await getPatientContext(userId);
  const patientData = formatPatientDataForAI(context);

  const systemPrompt = `You are an expert medical consultant AI assisting healthcare providers with specialist referrals. Your task is to create comprehensive, structured case summaries that facilitate effective specialist consultations.

IMPORTANT: Generate professional, HIPAA-compliant case summaries suitable for inter-provider communication.

The referring provider is seeking a ${request.specialtyType} consultation.

Create a well-organized case summary that includes:
1. A concise executive summary
2. History of present illness narrative
3. Key clinical findings relevant to the specialty
4. Assessment and differential considerations
5. Specific consultation questions
6. Recommendations for additional workup if indicated

Respond in JSON format:
{
  "executiveSummary": "2-3 sentence overview of the case",
  "historyOfPresentIllness": "Detailed narrative of the presenting problem",
  "keyFindings": ["Most relevant finding 1", "Finding 2", "Finding 3"],
  "relevantMedicalHistory": ["Relevant history item 1", "Item 2"],
  "medicationSummary": ["Current med 1 with relevance", "Med 2"],
  "allergySummary": ["Allergy 1 with reaction type"],
  "relevantLabFindings": ["Key lab finding 1", "Finding 2"],
  "relevantImagingFindings": ["Imaging finding 1"],
  "clinicalAssessment": "Overall clinical impression and reasoning",
  "differentialConsiderations": ["Differential 1", "Differential 2"],
  "specificQuestions": ["Question for specialist 1", "Question 2"],
  "suggestedWorkup": ["Recommended test 1", "Test 2"],
  "urgencyAssessment": "Assessment of urgency and rationale",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

  const userMessage = `Create a ${request.specialtyType} consultation case summary for this patient.

CHIEF COMPLAINT: ${request.chiefComplaint}
URGENCY: ${request.urgencyLevel || "routine"}
${request.specificQuestions?.length ? `SPECIFIC QUESTIONS FROM REFERRING PROVIDER:\n${request.specificQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : ""}

PATIENT DATA:
${patientData}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-provider-collaboration",
      callerMethod: "collaborate"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const caseSummary = await storage.createCaseSummary({
      userId,
      patientId: userId,
      specialtyType: request.specialtyType,
      referringProvider: request.referringProvider || null,
      targetSpecialist: request.targetSpecialist || null,
      chiefComplaint: request.chiefComplaint,
      historyOfPresentIllness: parsed.historyOfPresentIllness || null,
      relevantMedicalHistory: parsed.relevantMedicalHistory || null,
      currentMedications: parsed.medicationSummary || null,
      allergies: parsed.allergySummary || null,
      relevantLabResults: parsed.relevantLabFindings || null,
      relevantImaging: parsed.relevantImagingFindings || null,
      vitalSigns: context.vitals.slice(0, 3).map(v => ({ title: v.title, value: v.summary, date: v.date })),
      clinicalAssessment: parsed.clinicalAssessment || null,
      specificQuestions: request.specificQuestions || parsed.specificQuestions || null,
      urgencyLevel: request.urgencyLevel || "routine",
      aiSummary: parsed.executiveSummary || null,
      aiKeyFindings: parsed.keyFindings || null,
      aiRecommendations: parsed.recommendations || null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
      status: "draft",
    });

    return {
      caseSummary: {
        id: caseSummary.id,
        aiSummary: parsed.executiveSummary || "",
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || [],
        historyOfPresentIllness: parsed.historyOfPresentIllness || "",
        clinicalAssessment: parsed.clinicalAssessment || "",
        suggestedQuestions: parsed.specificQuestions || [],
      },
    };
  } catch (error) {
    console.error("Case summary generation error:", error);
    throw new Error("Failed to generate case summary");
  }
}

export interface ResearchRequest {
  queryContext: string;
  caseSummaryId?: string;
  focusAreas?: string[];
  maxResults?: number;
}

export interface ResearchResult {
  recommendations: Array<{
    title: string;
    authors: string[];
    journal: string;
    year: number;
    doi?: string;
    pmid?: string;
    abstract: string;
    relevanceScore: number;
    relevanceReason: string;
    keyFindings: string[];
    clinicalImplications: string[];
  }>;
  searchTerms: string[];
  evidenceLevel: string;
}

export async function suggestResearchPapers(
  userId: string,
  request: ResearchRequest
): Promise<ResearchResult> {
  const context = await getPatientContext(userId);
  const patientData = formatPatientDataForAI(context);

  const systemPrompt = `You are an expert medical literature researcher and clinical informaticist. Your task is to suggest relevant research papers and clinical studies that would help healthcare providers make evidence-based decisions for complex cases.

Based on the patient context and query, identify the most relevant types of research that would inform clinical decision-making.

IMPORTANT: 
- Suggest realistic research paper titles and citations based on common medical literature patterns
- Focus on high-quality evidence (systematic reviews, RCTs, clinical guidelines)
- Provide accurate representation of what types of studies exist for these conditions
- Include relevance explanations and clinical implications

Respond in JSON format:
{
  "recommendations": [
    {
      "title": "Research paper title",
      "authors": ["Author A", "Author B", "et al."],
      "journal": "Journal name",
      "year": 2024,
      "doi": "example DOI format",
      "pmid": "example PMID",
      "abstract": "Brief abstract of the paper",
      "relevanceScore": 95,
      "relevanceReason": "Why this paper is relevant to the case",
      "keyFindings": ["Key finding 1", "Key finding 2"],
      "clinicalImplications": ["How this applies to patient care"]
    }
  ],
  "searchTerms": ["MeSH term 1", "Term 2", "Term 3"],
  "evidenceLevel": "High-quality evidence from systematic reviews and RCTs",
  "summaryOfEvidence": "Overall summary of the evidence landscape",
  "evidenceGaps": ["Area where more research is needed"]
}`;

  const userMessage = `Find relevant research for this clinical case:

CLINICAL QUERY: ${request.queryContext}
${request.focusAreas?.length ? `FOCUS AREAS: ${request.focusAreas.join(", ")}` : ""}

PATIENT CONTEXT:
${patientData}

Provide ${request.maxResults || 5} most relevant research recommendations.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-provider-collaboration",
      callerMethod: "collaborate"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    await storage.createResearchRecommendation({
      userId,
      patientId: userId,
      caseSummaryId: request.caseSummaryId || null,
      queryContext: request.queryContext,
      conditions: context.conditions.map(c => c.title),
      medications: context.medications.map(m => m.title),
      procedures: context.procedures.map(p => p.title),
      recommendations: parsed.recommendations || [],
      searchTerms: parsed.searchTerms || [],
      evidenceLevel: parsed.evidenceLevel || null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
    });

    return {
      recommendations: parsed.recommendations || [],
      searchTerms: parsed.searchTerms || [],
      evidenceLevel: parsed.evidenceLevel || "Unknown",
    };
  } catch (error) {
    console.error("Research suggestion error:", error);
    throw new Error("Failed to suggest research papers");
  }
}

export interface CommunicationRequest {
  communicationType: "referral" | "consultation_response" | "care_coordination" | "discharge_summary" | "follow_up" | "curbside_consult";
  toProvider?: string;
  fromProvider?: string;
  subject?: string;
  keyPoints?: string[];
  tone?: "formal" | "professional" | "collegial";
  format?: "letter" | "note" | "email" | "structured";
  caseSummaryId?: string;
}

export interface CommunicationResult {
  communication: {
    id: string;
    draftContent: string;
    subject: string;
    keyPoints: string[];
    suggestedEdits: string[];
  };
}

export async function draftProviderCommunication(
  userId: string,
  request: CommunicationRequest
): Promise<CommunicationResult> {
  const context = await getPatientContext(userId);
  const patientData = formatPatientDataForAI(context);

  const communicationTemplates: Record<string, string> = {
    referral: "formal specialist referral letter",
    consultation_response: "specialist consultation response",
    care_coordination: "care coordination update between providers",
    discharge_summary: "discharge summary for receiving provider",
    follow_up: "follow-up care coordination note",
    curbside_consult: "informal curbside consultation response",
  };

  const systemPrompt = `You are an expert medical communication specialist helping healthcare providers draft professional inter-provider communications. Create clear, concise, and clinically appropriate ${communicationTemplates[request.communicationType] || "medical communication"}.

IMPORTANT:
- Use professional medical terminology appropriately
- Maintain HIPAA compliance (no unnecessary PHI)
- Structure the communication for easy reading
- Include all clinically relevant information
- Be concise but thorough

Respond in JSON format:
{
  "subject": "Communication subject line",
  "greeting": "Appropriate professional greeting",
  "body": "Main body of the communication with proper paragraphs",
  "clinicalSummary": "Brief clinical summary section",
  "currentPlan": "Current treatment plan if applicable",
  "recommendations": "Recommendations or questions for receiving provider",
  "closing": "Professional closing",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "suggestedEdits": ["Consider adding X", "May want to emphasize Y"],
  "formattedDraft": "Complete formatted draft combining all sections"
}`;

  const userMessage = `Draft a ${request.communicationType.replace(/_/g, " ")} communication.

COMMUNICATION DETAILS:
Type: ${request.communicationType}
${request.toProvider ? `To: ${request.toProvider}` : ""}
${request.fromProvider ? `From: ${request.fromProvider}` : ""}
${request.subject ? `Subject: ${request.subject}` : ""}
Tone: ${request.tone || "professional"}
Format: ${request.format || "standard"}
${request.keyPoints?.length ? `KEY POINTS TO INCLUDE:\n${request.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}

PATIENT CONTEXT:
${patientData}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-provider-collaboration",
      callerMethod: "collaborate"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const communication = await storage.createProviderCommunication({
      userId,
      patientId: userId,
      caseSummaryId: request.caseSummaryId || null,
      communicationType: request.communicationType,
      fromProvider: request.fromProvider || null,
      toProvider: request.toProvider || null,
      subject: parsed.subject || request.subject || null,
      draftContent: parsed.formattedDraft || parsed.body || null,
      patientContext: {
        conditions: context.conditions.map(c => c.title),
        medications: context.medications.map(m => m.title),
        allergies: context.allergies.map(a => a.title),
      },
      keyPoints: parsed.keyPoints || request.keyPoints || null,
      tone: request.tone || "professional",
      format: request.format || "standard",
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
      status: "draft",
    });

    return {
      communication: {
        id: communication.id,
        draftContent: parsed.formattedDraft || parsed.body || "",
        subject: parsed.subject || request.subject || "",
        keyPoints: parsed.keyPoints || [],
        suggestedEdits: parsed.suggestedEdits || [],
      },
    };
  } catch (error) {
    console.error("Communication drafting error:", error);
    throw new Error("Failed to draft provider communication");
  }
}

export async function getCaseSummaries(userId: string): Promise<CaseSummary[]> {
  return storage.getCaseSummaries(userId);
}

export async function getResearchRecommendations(userId: string): Promise<ResearchRecommendation[]> {
  return storage.getResearchRecommendations(userId);
}

export async function getProviderCommunications(userId: string): Promise<ProviderCommunication[]> {
  return storage.getProviderCommunications(userId);
}

export async function updateCaseSummaryStatus(
  id: string,
  status: "draft" | "sent" | "responded"
): Promise<CaseSummary | undefined> {
  const updates: Partial<{ status: string; sentAt: Date; responseReceivedAt: Date }> = { status };
  
  if (status === "sent") {
    updates.sentAt = new Date();
  } else if (status === "responded") {
    updates.responseReceivedAt = new Date();
  }
  
  return storage.updateCaseSummary(id, updates);
}

export async function updateCommunicationStatus(
  id: string,
  status: "draft" | "sent" | "finalized",
  finalContent?: string
): Promise<ProviderCommunication | undefined> {
  const updates: Partial<{ status: string; sentAt: Date; finalContent: string }> = { status };
  
  if (status === "sent") {
    updates.sentAt = new Date();
  }
  
  if (finalContent) {
    updates.finalContent = finalContent;
  }
  
  return storage.updateProviderCommunication(id, updates);
}

export const aiProviderCollaboration = {
  generateCaseSummary,
  suggestResearchPapers,
  draftProviderCommunication,
  getCaseSummaries,
  getResearchRecommendations,
  getProviderCommunications,
  updateCaseSummaryStatus,
  updateCommunicationStatus,
};
