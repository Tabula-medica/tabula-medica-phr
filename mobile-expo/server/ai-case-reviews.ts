import { storage } from "./storage";
import type { AiCaseReview, InsertAiCaseReview } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

export interface AnonymizedPatientData {
  demographics: {
    ageRange: string;
    gender: string;
    ethnicity?: string;
  };
  chiefComplaint: string;
  clinicalHistory: string;
  currentMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  allergies: string[];
  labResults: Array<{
    test: string;
    value: string;
    unit: string;
    referenceRange: string;
    date: string;
    abnormal: boolean;
  }>;
  imagingResults: Array<{
    type: string;
    findings: string;
    date: string;
  }>;
  vitalSigns: Array<{
    type: string;
    value: string;
    unit: string;
    date: string;
  }>;
  socialHistory?: string;
  familyHistory?: string;
  physicalExamFindings?: string;
}

export interface DiagnosisResult {
  diagnosis: string;
  icdCode?: string;
  confidence: number;
  reasoning: string;
  supportingEvidence: string[];
  differentialConsiderations: string[];
}

export interface TreatmentOption {
  treatment: string;
  type: "medication" | "procedure" | "therapy" | "lifestyle" | "monitoring" | "referral";
  rationale: string;
  evidenceLevel: "high" | "moderate" | "low" | "expert_opinion";
  considerations: string[];
  contraindications: string[];
  expectedOutcome: string;
  timeframe: string;
  priority: "first_line" | "second_line" | "adjunctive" | "optional";
}

export interface ClinicalTrialMatch {
  trialId: string;
  title: string;
  phase: string;
  condition: string;
  intervention: string;
  sponsor: string;
  location: string;
  eligibilityMatch: number;
  matchReason: string;
  keyEligibilityCriteria: string[];
  contactInfo?: string;
  estimatedEnrollmentDate?: string;
}

export interface CaseReviewAnalysis {
  summary: string;
  potentialDiagnoses: DiagnosisResult[];
  treatmentOptions: TreatmentOption[];
  differentialDiagnosis: {
    primary: string;
    alternatives: Array<{
      diagnosis: string;
      likelihood: string;
      reasoningFor: string;
      reasoningAgainst: string;
    }>;
  };
  riskAssessment: {
    immediateRisks: string[];
    longTermRisks: string[];
    riskLevel: "low" | "moderate" | "high" | "critical";
    mitigationStrategies: string[];
  };
  followUpRecommendations: {
    immediateActions: string[];
    shortTermFollowUp: string[];
    longTermMonitoring: string[];
    referrals: string[];
  };
  clinicalTrialMatches: ClinicalTrialMatch[];
  evidenceReferences: Array<{
    title: string;
    source: string;
    year: number;
    relevance: string;
    url?: string;
  }>;
  confidenceScore: number;
  limitations: string[];
  additionalTestsRecommended: string[];
}

export async function analyzeCaseReview(
  caseData: AnonymizedPatientData
): Promise<CaseReviewAnalysis> {
  const systemPrompt = `You are an expert clinical decision support AI assistant. Analyze the provided anonymized patient data and provide comprehensive clinical insights.

IMPORTANT DISCLAIMERS:
- This is a decision SUPPORT tool, not a replacement for clinical judgment
- All analyses should be verified by qualified healthcare providers
- Patient privacy must be maintained - only work with anonymized data

Provide a thorough analysis including:
1. Potential diagnoses with ICD codes, confidence levels, and supporting evidence
2. Treatment options ranked by priority and evidence level
3. Differential diagnosis reasoning
4. Risk assessment with mitigation strategies
5. Follow-up recommendations
6. Relevant clinical trial matches (generate plausible trial suggestions)
7. Evidence-based references

Respond in JSON format:
{
  "summary": "Executive summary of the case",
  "potentialDiagnoses": [
    {
      "diagnosis": "Diagnosis name",
      "icdCode": "ICD-10 code",
      "confidence": 85,
      "reasoning": "Clinical reasoning",
      "supportingEvidence": ["Evidence 1", "Evidence 2"],
      "differentialConsiderations": ["Consider ruling out X"]
    }
  ],
  "treatmentOptions": [
    {
      "treatment": "Treatment name",
      "type": "medication|procedure|therapy|lifestyle|monitoring|referral",
      "rationale": "Why this treatment",
      "evidenceLevel": "high|moderate|low|expert_opinion",
      "considerations": ["Special considerations"],
      "contraindications": ["Contraindications"],
      "expectedOutcome": "Expected results",
      "timeframe": "Duration or timeline",
      "priority": "first_line|second_line|adjunctive|optional"
    }
  ],
  "differentialDiagnosis": {
    "primary": "Most likely diagnosis",
    "alternatives": [
      {
        "diagnosis": "Alternative diagnosis",
        "likelihood": "Percentage or description",
        "reasoningFor": "Supporting evidence",
        "reasoningAgainst": "Evidence against"
      }
    ]
  },
  "riskAssessment": {
    "immediateRisks": ["Immediate risk 1"],
    "longTermRisks": ["Long term risk 1"],
    "riskLevel": "low|moderate|high|critical",
    "mitigationStrategies": ["Strategy 1"]
  },
  "followUpRecommendations": {
    "immediateActions": ["Action 1"],
    "shortTermFollowUp": ["Follow-up 1"],
    "longTermMonitoring": ["Monitoring 1"],
    "referrals": ["Referral 1"]
  },
  "clinicalTrialMatches": [
    {
      "trialId": "NCT-XXXXXXXX",
      "title": "Trial title",
      "phase": "Phase 2",
      "condition": "Condition being studied",
      "intervention": "Intervention type",
      "sponsor": "Sponsor name",
      "location": "Location",
      "eligibilityMatch": 75,
      "matchReason": "Why patient may qualify",
      "keyEligibilityCriteria": ["Criterion 1"]
    }
  ],
  "evidenceReferences": [
    {
      "title": "Reference title",
      "source": "Journal or source",
      "year": 2024,
      "relevance": "How it applies to this case"
    }
  ],
  "confidenceScore": 80,
  "limitations": ["Limitation 1"],
  "additionalTestsRecommended": ["Test 1"]
}`;

  const userMessage = `Analyze this anonymized patient case:

DEMOGRAPHICS:
- Age Range: ${caseData.demographics.ageRange}
- Gender: ${caseData.demographics.gender}
${caseData.demographics.ethnicity ? `- Ethnicity: ${caseData.demographics.ethnicity}` : ""}

CHIEF COMPLAINT:
${caseData.chiefComplaint}

CLINICAL HISTORY:
${caseData.clinicalHistory}

CURRENT MEDICATIONS:
${caseData.currentMedications.length > 0 
  ? caseData.currentMedications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n")
  : "None reported"}

ALLERGIES:
${caseData.allergies.length > 0 ? caseData.allergies.join(", ") : "No known allergies"}

LAB RESULTS:
${caseData.labResults.length > 0
  ? caseData.labResults.map(l => `- ${l.test}: ${l.value} ${l.unit} (Ref: ${l.referenceRange})${l.abnormal ? " [ABNORMAL]" : ""} - ${l.date}`).join("\n")
  : "No recent labs"}

IMAGING RESULTS:
${caseData.imagingResults.length > 0
  ? caseData.imagingResults.map(i => `- ${i.type} (${i.date}): ${i.findings}`).join("\n")
  : "No recent imaging"}

VITAL SIGNS:
${caseData.vitalSigns.length > 0
  ? caseData.vitalSigns.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})`).join("\n")
  : "No vitals recorded"}

${caseData.socialHistory ? `SOCIAL HISTORY:\n${caseData.socialHistory}\n` : ""}
${caseData.familyHistory ? `FAMILY HISTORY:\n${caseData.familyHistory}\n` : ""}
${caseData.physicalExamFindings ? `PHYSICAL EXAM FINDINGS:\n${caseData.physicalExamFindings}\n` : ""}

Provide a comprehensive clinical analysis with potential diagnoses, treatment options, and relevant clinical trial matches.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      temperature: 0.3,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "ai-case-reviews",
      callerMethod: "caseReview"});

    const content = response.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as CaseReviewAnalysis;
  } catch (error) {
    console.error("Case review analysis error:", error);
    throw error;
  }
}

export interface MessageThreadSummary {
  summary: string;
  keyPoints: string[];
  actionItems: Array<{
    item: string;
    assignee?: string;
    priority: "high" | "medium" | "low";
    dueDate?: string;
  }>;
  decisions: string[];
  openQuestions: string[];
  participantContributions: Array<{
    participant: string;
    mainPoints: string[];
  }>;
  nextSteps: string[];
  sentiment: "collaborative" | "contentious" | "urgent" | "routine";
}

export async function summarizeMessageThread(
  messages: Array<{
    senderName: string;
    senderRole?: string;
    content: string;
    timestamp: string;
  }>,
  threadSubject: string
): Promise<MessageThreadSummary> {
  const systemPrompt = `You are an AI assistant that summarizes healthcare provider discussions. Create concise, actionable summaries that help busy clinicians quickly understand the key points of a conversation.

Focus on:
1. Main discussion points and conclusions
2. Clinical decisions made
3. Action items with assignments
4. Open questions that need resolution
5. Next steps

Respond in JSON format:
{
  "summary": "Brief 2-3 sentence summary of the discussion",
  "keyPoints": ["Key point 1", "Key point 2"],
  "actionItems": [
    {
      "item": "Action to take",
      "assignee": "Person responsible (if mentioned)",
      "priority": "high|medium|low",
      "dueDate": "Due date if mentioned"
    }
  ],
  "decisions": ["Decision made 1"],
  "openQuestions": ["Unresolved question 1"],
  "participantContributions": [
    {
      "participant": "Provider name",
      "mainPoints": ["Their main contributions"]
    }
  ],
  "nextSteps": ["Next step 1"],
  "sentiment": "collaborative|contentious|urgent|routine"
}`;

  const formattedMessages = messages.map(m => 
    `[${m.timestamp}] ${m.senderName}${m.senderRole ? ` (${m.senderRole})` : ""}:\n${m.content}`
  ).join("\n\n---\n\n");

  const userMessage = `Summarize this provider discussion thread.

SUBJECT: ${threadSubject}

MESSAGES:
${formattedMessages}

Provide a comprehensive summary with action items and key decisions.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      temperature: 0.3,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "ai-case-reviews",
      callerMethod: "caseReview"});

    const content = response.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as MessageThreadSummary;
  } catch (error) {
    console.error("Message thread summarization error:", error);
    throw error;
  }
}

export async function generateClinicalTrialMatches(
  conditions: string[],
  medications: string[],
  demographics: { ageRange: string; gender: string }
): Promise<ClinicalTrialMatch[]> {
  const systemPrompt = `You are a clinical trials matching expert. Based on the patient's conditions and current treatments, suggest relevant clinical trials they may be eligible for.

Generate realistic, plausible clinical trial suggestions that would be relevant for this patient profile. Include a mix of phases and intervention types.

Respond in JSON format:
{
  "matches": [
    {
      "trialId": "NCT-XXXXXXXX",
      "title": "Trial title",
      "phase": "Phase 1/2/3/4",
      "condition": "Primary condition",
      "intervention": "Type of intervention",
      "sponsor": "Sponsoring organization",
      "location": "Geographic location",
      "eligibilityMatch": 75,
      "matchReason": "Why this patient may qualify",
      "keyEligibilityCriteria": ["Age 18-65", "Criterion 2"],
      "estimatedEnrollmentDate": "2024-12"
    }
  ]
}`;

  const userMessage = `Find relevant clinical trials for a patient with:

CONDITIONS: ${conditions.join(", ")}
CURRENT MEDICATIONS: ${medications.join(", ")}
DEMOGRAPHICS: ${demographics.ageRange}, ${demographics.gender}

Suggest 3-5 relevant clinical trials this patient might be eligible for.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      temperature: 0.5,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "ai-case-reviews",
      callerMethod: "caseReview"});

    const content = response.content;
    if (!content) {
      return [];
    }

    const result = JSON.parse(content);
    return result.matches || [];
  } catch (error) {
    console.error("Clinical trial matching error:", error);
    return [];
  }
}

export async function generateSecondOpinion(
  originalAnalysis: CaseReviewAnalysis,
  caseData: AnonymizedPatientData
): Promise<{
  agreement: string[];
  disagreement: string[];
  additionalConsiderations: string[];
  alternativeDiagnoses: DiagnosisResult[];
  alternativeTreatments: TreatmentOption[];
  overallAssessment: string;
}> {
  const systemPrompt = `You are a second opinion clinical AI reviewer. Your role is to:
1. Critically evaluate the original analysis
2. Identify areas of agreement and potential disagreement
3. Suggest alternative diagnoses or treatments that may have been overlooked
4. Provide additional considerations

Be constructive but thorough in your review.

Respond in JSON format:
{
  "agreement": ["Points of agreement with original analysis"],
  "disagreement": ["Points where you disagree or have concerns"],
  "additionalConsiderations": ["Things not covered in original analysis"],
  "alternativeDiagnoses": [
    {
      "diagnosis": "Alternative diagnosis",
      "icdCode": "ICD code",
      "confidence": 60,
      "reasoning": "Why this should be considered",
      "supportingEvidence": ["Evidence"],
      "differentialConsiderations": ["Considerations"]
    }
  ],
  "alternativeTreatments": [
    {
      "treatment": "Alternative treatment",
      "type": "medication",
      "rationale": "Why consider this",
      "evidenceLevel": "moderate",
      "considerations": ["Special considerations"],
      "contraindications": ["Contraindications"],
      "expectedOutcome": "Expected outcome",
      "timeframe": "Timeline",
      "priority": "second_line"
    }
  ],
  "overallAssessment": "Overall assessment of the original analysis quality and recommendations"
}`;

  const userMessage = `Review this clinical analysis and provide a second opinion.

ORIGINAL ANALYSIS SUMMARY:
${originalAnalysis.summary}

PRIMARY DIAGNOSIS: ${originalAnalysis.potentialDiagnoses[0]?.diagnosis || "Not specified"}
CONFIDENCE: ${originalAnalysis.confidenceScore}%

PATIENT DATA:
- Chief Complaint: ${caseData.chiefComplaint}
- Clinical History: ${caseData.clinicalHistory}
- Key Labs: ${caseData.labResults.slice(0, 5).map(l => `${l.test}: ${l.value}`).join(", ")}

Provide a critical second opinion with alternative considerations.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      temperature: 0.4,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "ai-case-reviews",
      callerMethod: "caseReview"});

    const content = response.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Second opinion generation error:", error);
    throw error;
  }
}
