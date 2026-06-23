// CDS-GATED — this service performs Clinical Decision Support (AI clinical-document
// analysis: abnormal-result detection, clinical significance, trends, action items).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS
// determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { assertCdsEnabled } from "./_cds-gate";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "not-set",
  ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && {
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  }),
});

export interface DocumentAnalysisRequest {
  documentId: string;
  documentType: "lab_report" | "clinical_note" | "discharge_summary" | "imaging_report" | "ccd" | "pdf";
  title: string;
  content: string;
  date: string;
  provider?: string;
  patientContext?: {
    age?: number;
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
}

export interface KeyFinding {
  id: string;
  category: "abnormal_result" | "normal_result" | "diagnosis" | "medication" | "procedure" | "follow_up" | "observation";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  value?: string;
  referenceRange?: string;
  clinicalSignificance?: string;
}

export interface TrendAnalysis {
  metric: string;
  direction: "improving" | "stable" | "worsening" | "new";
  description: string;
  previousValue?: string;
  currentValue?: string;
}

export interface ActionItem {
  id: string;
  priority: "urgent" | "high" | "normal" | "low";
  action: string;
  reason: string;
  timeframe?: string;
  relatedFinding?: string;
}

export interface DocumentInsights {
  documentId: string;
  summary: string;
  keyFindings: KeyFinding[];
  trends: TrendAnalysis[];
  actionItems: ActionItem[];
  plainLanguageExplanation: string;
  medicalTermsGlossary: Array<{
    term: string;
    definition: string;
  }>;
  generatedAt: string;
  confidenceScore: number;
}

export async function analyzeDocument(
  patientId: string,
  userId: string,
  userRole: string,
  request: DocumentAnalysisRequest
): Promise<DocumentInsights> {
  assertCdsEnabled("aiDocumentInsights.analyzeDocument");
  console.log(`[AI Document Insights] Analyzing ${request.documentType}: ${request.title}`);

  await logPhiAccess({
    userId,
    userRole,
    patientId,
    resourceType: "document_ai_analysis",
    action: "read",
    accessReason: `AI analysis of ${request.documentType} document: ${request.title}`,
    ipAddress: "system",
    userAgent: "ai-document-insights-service",
    requestPath: "/api/documents/analyze",
    requestMethod: "POST",
  });

  if (!request.content || request.content.trim().length === 0) {
    return createEmptyInsights(request.documentId, "No content available for analysis");
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.log("[AI Document Insights] OpenAI API key not configured, returning fallback insights");
    return createFallbackInsights(request);
  }

  try {
    const prompt = buildDocumentAnalysisPrompt(request);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a healthcare document analysis AI assistant. Your role is to:
1. Extract and summarize key findings from clinical documents
2. Identify abnormal results and their clinical significance
3. Detect trends by comparing with patient context
4. Generate actionable items for patient follow-up
5. Explain medical terminology in plain, patient-friendly language
6. Create a glossary of medical terms used in the document

IMPORTANT GUIDELINES:
- Never provide medical diagnoses or treatment recommendations
- Frame findings as observations to discuss with healthcare providers
- Use encouraging, supportive language
- Highlight both concerning and positive findings
- Be accurate and thorough in extracting medical values
- Prioritize patient safety in action items

Format your response as valid JSON matching the DocumentInsightsOutput schema.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content) as {
      summary: string;
      keyFindings: KeyFinding[];
      trends: TrendAnalysis[];
      actionItems: ActionItem[];
      plainLanguageExplanation: string;
      medicalTermsGlossary: Array<{ term: string; definition: string }>;
      confidenceScore: number;
    };

    return {
      documentId: request.documentId,
      summary: parsed.summary,
      keyFindings: parsed.keyFindings.map((f, i) => ({
        ...f,
        id: f.id || `finding-${i}`
      })),
      trends: parsed.trends || [],
      actionItems: parsed.actionItems.map((a, i) => ({
        ...a,
        id: a.id || `action-${i}`
      })),
      plainLanguageExplanation: parsed.plainLanguageExplanation,
      medicalTermsGlossary: parsed.medicalTermsGlossary || [],
      generatedAt: new Date().toISOString(),
      confidenceScore: parsed.confidenceScore || 0.85
    };

  } catch (error) {
    console.error("[AI Document Insights] Error analyzing document:", error);
    return createFallbackInsights(request);
  }
}

function buildDocumentAnalysisPrompt(request: DocumentAnalysisRequest): string {
  let prompt = `Analyze the following ${getDocumentTypeLabel(request.documentType)} and extract insights:\n\n`;
  
  prompt += `DOCUMENT TITLE: ${request.title}\n`;
  prompt += `DATE: ${request.date}\n`;
  if (request.provider) {
    prompt += `PROVIDER: ${request.provider}\n`;
  }
  prompt += `\n--- DOCUMENT CONTENT ---\n${request.content}\n--- END CONTENT ---\n\n`;

  if (request.patientContext) {
    prompt += `PATIENT CONTEXT:\n`;
    if (request.patientContext.age) {
      prompt += `- Age: ${request.patientContext.age}\n`;
    }
    if (request.patientContext.conditions?.length) {
      prompt += `- Known conditions: ${request.patientContext.conditions.join(", ")}\n`;
    }
    if (request.patientContext.medications?.length) {
      prompt += `- Current medications: ${request.patientContext.medications.join(", ")}\n`;
    }
    if (request.patientContext.allergies?.length) {
      prompt += `- Allergies: ${request.patientContext.allergies.join(", ")}\n`;
    }
    prompt += `\n`;
  }

  prompt += `Please provide your analysis in the following JSON format:
{
  "summary": "A 2-3 sentence executive summary of the document's main points",
  "keyFindings": [
    {
      "id": "unique-id",
      "category": "abnormal_result|normal_result|diagnosis|medication|procedure|follow_up|observation",
      "severity": "critical|warning|info|success",
      "title": "Brief title",
      "description": "Detailed description",
      "value": "The measured value if applicable",
      "referenceRange": "Normal range if applicable",
      "clinicalSignificance": "Why this finding matters"
    }
  ],
  "trends": [
    {
      "metric": "Name of the metric",
      "direction": "improving|stable|worsening|new",
      "description": "Description of the trend",
      "previousValue": "Previous value if known",
      "currentValue": "Current value"
    }
  ],
  "actionItems": [
    {
      "id": "unique-id",
      "priority": "urgent|high|normal|low",
      "action": "What the patient should do",
      "reason": "Why this action is important",
      "timeframe": "When to do it",
      "relatedFinding": "ID of related finding if applicable"
    }
  ],
  "plainLanguageExplanation": "A comprehensive explanation of this document in simple, everyday language that anyone can understand. Avoid medical jargon.",
  "medicalTermsGlossary": [
    {
      "term": "Medical term from the document",
      "definition": "Simple definition anyone can understand"
    }
  ],
  "confidenceScore": 0.0 to 1.0
}`;

  return prompt;
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    lab_report: "Laboratory Report",
    clinical_note: "Clinical Note",
    discharge_summary: "Discharge Summary",
    imaging_report: "Imaging Report",
    ccd: "Continuity of Care Document",
    pdf: "Medical Document"
  };
  return labels[type] || "Medical Document";
}

function createEmptyInsights(documentId: string, reason: string): DocumentInsights {
  return {
    documentId,
    summary: reason,
    keyFindings: [],
    trends: [],
    actionItems: [],
    plainLanguageExplanation: "No content is available to analyze for this document.",
    medicalTermsGlossary: [],
    generatedAt: new Date().toISOString(),
    confidenceScore: 0
  };
}

function createFallbackInsights(request: DocumentAnalysisRequest): DocumentInsights {
  const keyFindings: KeyFinding[] = [];
  const actionItems: ActionItem[] = [];
  
  if (request.documentType === "lab_report") {
    keyFindings.push({
      id: "fallback-1",
      category: "observation",
      severity: "info",
      title: "Lab Results Available",
      description: "This lab report contains test results. Review with your healthcare provider for detailed interpretation.",
      clinicalSignificance: "Lab results should be discussed with your doctor to understand their meaning in context."
    });
    actionItems.push({
      id: "action-1",
      priority: "normal",
      action: "Schedule a follow-up appointment to discuss these results",
      reason: "Your healthcare provider can explain what these results mean for your health",
      timeframe: "Within 1-2 weeks"
    });
  } else if (request.documentType === "clinical_note") {
    keyFindings.push({
      id: "fallback-1",
      category: "observation",
      severity: "info",
      title: "Clinical Visit Summary",
      description: "This note summarizes a healthcare visit. It may contain important information about your care plan.",
      clinicalSignificance: "Clinical notes document your healthcare journey and treatment decisions."
    });
  } else if (request.documentType === "discharge_summary") {
    keyFindings.push({
      id: "fallback-1",
      category: "follow_up",
      severity: "warning",
      title: "Discharge Instructions",
      description: "This document contains important discharge instructions. Follow all recommendations carefully.",
      clinicalSignificance: "Discharge instructions are crucial for your recovery and ongoing care."
    });
    actionItems.push({
      id: "action-1",
      priority: "high",
      action: "Review and follow all discharge instructions",
      reason: "Following discharge instructions helps ensure a safe recovery",
      timeframe: "Immediately"
    });
    actionItems.push({
      id: "action-2",
      priority: "high",
      action: "Schedule recommended follow-up appointments",
      reason: "Follow-up care is essential to monitor your recovery",
      timeframe: "As specified in discharge instructions"
    });
  }

  return {
    documentId: request.documentId,
    summary: `This ${getDocumentTypeLabel(request.documentType)} from ${request.date} contains important health information. Review the document content for details.`,
    keyFindings,
    trends: [],
    actionItems,
    plainLanguageExplanation: `This is a ${getDocumentTypeLabel(request.documentType).toLowerCase()} from your health records. For the most accurate understanding of its contents, please review it with your healthcare provider who can explain what it means for your specific situation.`,
    medicalTermsGlossary: [],
    generatedAt: new Date().toISOString(),
    confidenceScore: 0.5
  };
}

export class AIDocumentInsightsService {
  async analyze(
    patientId: string,
    userId: string,
    userRole: string,
    request: DocumentAnalysisRequest
  ): Promise<DocumentInsights> {
    return analyzeDocument(patientId, userId, userRole, request);
  }
}

export const aiDocumentInsightsService = new AIDocumentInsightsService();
