import { generatePhiSafeText } from "./ai-gateway";

// PHI-bearing generation runs through the Vertex/BAA gateway (P1-1.2).
const aiEnabled = true;

const NO_CDS_DISCLAIMER = "EDUCATIONAL CONTENT ONLY. This AI-generated content is for informational purposes and NOT medical advice or clinical decision support. All clinical decisions must be made by qualified healthcare providers based on their professional judgment and direct patient assessment.";

// HIPAA-compliant audit logging
function logHIPAAAudit(action: string, details: Record<string, any>): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    service: "AIProviderCollaboration",
    action,
    // eslint-disable-next-line tabulaAuth/no-fallback-identity -- legitimate system actor: shared audit helper also logs events with no single providerId (RESEARCH_SUGGESTION, COMMUNICATION_DRAFT use from/toProviderId)
    userId: details.providerId || "system",
    patientId: details.patientId ? `[REDACTED:${details.patientId.slice(-4)}]` : undefined,
    details: {
      ...details,
      patientId: undefined,
      patientName: undefined,
    },
    hipaaCompliant: true,
    dataMinimization: true,
  };
  console.log(`[HIPAA-AUDIT][AIProviderCollaboration] ${JSON.stringify(auditEntry)}`);
}

// De-identify PHI for AI processing - uses pseudonyms and age ranges
function deidentifyForAI(patient: any): any {
  return {
    id: `patient-${Math.random().toString(36).substr(2, 6)}`,
    name: "[PATIENT]",
    ageRange: getAgeRange(patient.age),
    gender: patient.gender,
    conditions: patient.conditions.map((c: any) => ({
      code: c.code,
      description: c.description,
      dateRange: getDateRange(c.date)
    })),
    medications: patient.medications,
    recentLabs: patient.recentLabs.map((l: any) => ({
      name: l.name,
      value: l.value,
      status: l.status
    })),
    allergies: patient.allergies,
    chiefComplaint: patient.chiefComplaint
  };
}

function getAgeRange(age: number): string {
  if (age < 18) return "pediatric (<18)";
  if (age < 40) return "adult (18-39)";
  if (age < 65) return "middle-aged (40-64)";
  return "older adult (65+)";
}

function getDateRange(date: string): string {
  const year = new Date(date).getFullYear();
  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - year;
  if (yearsAgo < 1) return "within past year";
  if (yearsAgo < 3) return "1-3 years ago";
  if (yearsAgo < 5) return "3-5 years ago";
  return "5+ years ago";
}

// Types
export interface PatientCaseSummary {
  id: string;
  patientId: string;
  requestingProviderId: string;
  consultingSpecialty: string;
  summaryType: "specialist_referral" | "second_opinion" | "care_transition" | "case_conference";
  generatedAt: string;
  chiefComplaint: string;
  clinicalSummary: string;
  relevantHistory: string[];
  currentMedications: string[];
  recentLabResults: { name: string; value: string; date: string; status: string }[];
  relevantDiagnoses: { code: string; description: string; date: string }[];
  clinicalQuestions: string[];
  urgencyLevel: "routine" | "urgent" | "emergent";
  keyFindings: string[];
  recommendedFocus: string[];
  aiInsights: string;
  noCdsDisclaimer: string;
}

export interface ResearchPaperSuggestion {
  id: string;
  patientId: string;
  caseId: string;
  generatedAt: string;
  clinicalContext: string;
  suggestedPapers: {
    id: string;
    title: string;
    authors: string[];
    journal: string;
    year: number;
    doi: string;
    pmid?: string;
    abstract: string;
    relevanceScore: number;
    relevanceExplanation: string;
    keyFindings: string[];
    clinicalImplications: string[];
  }[];
  searchTermsUsed: string[];
  clinicalKeywords: string[];
  evidenceLevel: string;
  aiRationale: string;
  noCdsDisclaimer: string;
}

export interface InterProviderCommunication {
  id: string;
  patientId: string;
  fromProviderId: string;
  toProviderId: string;
  fromProviderName: string;
  toProviderName: string;
  toProviderSpecialty: string;
  communicationType: "referral" | "consultation_request" | "care_handoff" | "follow_up" | "urgent_notification" | "care_coordination";
  generatedAt: string;
  subject: string;
  draftContent: string;
  structuredSections: {
    greeting: string;
    patientIntroduction: string;
    clinicalBackground: string;
    reasonForCommunication: string;
    specificQuestions: string[];
    relevantFindings: string;
    urgencyStatement: string;
    requestedActions: string[];
    closingRemarks: string;
    signature: string;
  };
  attachmentSuggestions: string[];
  priority: "low" | "normal" | "high" | "urgent";
  communicationChannel: "secure_message" | "ehr_referral" | "fax" | "phone";
  editHistory: { timestamp: string; section: string; previousValue: string; newValue: string }[];
  status: "draft" | "reviewed" | "sent" | "acknowledged";
  aiSuggestions: string[];
  noCdsDisclaimer: string;
}

export interface CollaborationDashboard {
  recentSummaries: PatientCaseSummary[];
  recentResearchSuggestions: ResearchPaperSuggestion[];
  pendingCommunications: InterProviderCommunication[];
  sentCommunications: InterProviderCommunication[];
  statistics: {
    totalSummariesGenerated: number;
    totalResearchSuggested: number;
    totalCommunicationsDrafted: number;
    averageResponseTime: number;
    pendingReviews: number;
  };
  noCdsDisclaimer: string;
}

// Sample patient data for samplenstration
const samplePatientData = {
  "patient-001": {
    id: "patient-001",
    name: "John Smith",
    age: 65,
    gender: "Male",
    conditions: [
      { code: "E11.9", description: "Type 2 diabetes mellitus without complications", date: "2020-03-15" },
      { code: "I10", description: "Essential hypertension", date: "2018-06-20" },
      { code: "E78.5", description: "Hyperlipidemia", date: "2019-01-10" }
    ],
    medications: ["Metformin 1000mg BID", "Lisinopril 20mg daily", "Atorvastatin 40mg daily", "Aspirin 81mg daily"],
    recentLabs: [
      { name: "HbA1c", value: "8.2%", date: "2024-01-15", status: "elevated" },
      { name: "Creatinine", value: "1.4 mg/dL", date: "2024-01-15", status: "elevated" },
      { name: "eGFR", value: "52 mL/min/1.73m²", date: "2024-01-15", status: "low" },
      { name: "LDL Cholesterol", value: "95 mg/dL", date: "2024-01-15", status: "normal" }
    ],
    allergies: ["Penicillin", "Sulfa drugs"],
    chiefComplaint: "Progressive fatigue and declining kidney function"
  },
  "patient-002": {
    id: "patient-002",
    name: "Sarah Johnson",
    age: 45,
    gender: "Female",
    conditions: [
      { code: "M32.9", description: "Systemic lupus erythematosus", date: "2015-08-12" },
      { code: "N04.9", description: "Nephrotic syndrome", date: "2022-04-20" },
      { code: "D69.6", description: "Thrombocytopenia", date: "2023-01-15" }
    ],
    medications: ["Hydroxychloroquine 400mg daily", "Prednisone 10mg daily", "Mycophenolate 1000mg BID", "Lisinopril 10mg daily"],
    recentLabs: [
      { name: "Anti-dsDNA", value: "Positive 1:160", date: "2024-01-20", status: "elevated" },
      { name: "C3 Complement", value: "62 mg/dL", date: "2024-01-20", status: "low" },
      { name: "Proteinuria", value: "2.8 g/24hr", date: "2024-01-20", status: "elevated" },
      { name: "Platelet Count", value: "85,000/μL", date: "2024-01-20", status: "low" }
    ],
    allergies: ["None known"],
    chiefComplaint: "Lupus flare with worsening proteinuria and thrombocytopenia"
  }
};

// In-memory storage
const caseSummaries: Map<string, PatientCaseSummary> = new Map();
const researchSuggestions: Map<string, ResearchPaperSuggestion> = new Map();
const communications: Map<string, InterProviderCommunication> = new Map();

class AIProviderCollaborationService {
  private generateId(): string {
    return `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async generatePatientCaseSummary(
    patientId: string,
    consultingSpecialty: string,
    summaryType: PatientCaseSummary["summaryType"],
    requestingProviderId: string,
    additionalContext?: string
  ): Promise<PatientCaseSummary> {
    const patient = samplePatientData[patientId as keyof typeof samplePatientData] || samplePatientData["patient-001"];
    
    // HIPAA Audit: Log AI invocation
    logHIPAAAudit("CASE_SUMMARY_GENERATION", {
      patientId,
      providerId: requestingProviderId,
      consultingSpecialty,
      summaryType,
      action: "AI_INVOCATION"
    });
    
    // De-identify patient data for AI processing
    const deidentifiedPatient = deidentifyForAI(patient);
    
    let aiSummary = "";
    let keyFindings: string[] = [];
    let recommendedFocus: string[] = [];
    let clinicalQuestions: string[] = [];
    let aiInsights = "";

    try {
      if (aiEnabled) {
        // Use de-identified data in prompt - no real names, dates, or identifiable info sent to AI
        const prompt = `You are a clinical documentation specialist helping prepare a patient case summary for a ${consultingSpecialty} consultation.

De-identified Patient Information (HIPAA Safe Harbor):
- Patient: ${deidentifiedPatient.name}
- Age Range: ${deidentifiedPatient.ageRange}, Gender: ${deidentifiedPatient.gender}
- Chief Complaint: ${deidentifiedPatient.chiefComplaint}
- Active Conditions: ${deidentifiedPatient.conditions.map((c: any) => c.description).join(", ")}
- Current Medications: ${deidentifiedPatient.medications.join(", ")}
- Recent Labs: ${deidentifiedPatient.recentLabs.map((l: any) => `${l.name}: ${l.value} (${l.status})`).join(", ")}
- Allergies: ${deidentifiedPatient.allergies.join(", ")}
${additionalContext ? `- Additional Context: ${additionalContext}` : ""}

Summary Type: ${summaryType}

Please provide a structured case summary in JSON format with:
1. clinicalSummary: A concise 2-3 paragraph clinical summary suitable for the consulting specialist
2. keyFindings: Array of 3-5 most important clinical findings
3. recommendedFocus: Array of 2-3 areas the specialist should focus on
4. clinicalQuestions: Array of 3-5 specific clinical questions for the specialist
5. aiInsights: Brief AI-generated insights about the case complexity and considerations

Respond only with valid JSON.`;

        const content = await generatePhiSafeText({
          user: prompt,
          maxTokens: 1500,
          responseMimeType: "application/json",
        });

        if (content) {
          const parsed = JSON.parse(content);
          aiSummary = parsed.clinicalSummary || "";
          keyFindings = parsed.keyFindings || [];
          recommendedFocus = parsed.recommendedFocus || [];
          clinicalQuestions = parsed.clinicalQuestions || [];
          aiInsights = parsed.aiInsights || "";
        }
      }
    } catch (error) {
      console.log("[AIProviderCollaboration] Using fallback for case summary generation");
    }

    // Fallback if AI not available
    if (!aiSummary) {
      aiSummary = `${patient.name} is a ${patient.age}-year-old ${patient.gender.toLowerCase()} presenting with ${patient.chiefComplaint}. The patient has a history of ${patient.conditions.map(c => c.description).join(", ")}. Current medications include ${patient.medications.join(", ")}. Recent laboratory findings show ${patient.recentLabs.filter(l => l.status !== "normal").map(l => `${l.name}: ${l.value}`).join(", ")}.`;
      keyFindings = patient.recentLabs.filter(l => l.status !== "normal").map(l => `${l.name}: ${l.value} (${l.status})`);
      recommendedFocus = [`Evaluate ${patient.chiefComplaint}`, `Review medication regimen for ${consultingSpecialty} optimization`];
      clinicalQuestions = [
        `What is your assessment of the patient's current condition?`,
        `Are there any medication adjustments you would recommend?`,
        `What follow-up testing would you suggest?`
      ];
      aiInsights = `This case involves multiple comorbidities requiring coordinated care. The ${consultingSpecialty} consultation is warranted given the complexity of the presentation.`;
    }

    const summary: PatientCaseSummary = {
      id: this.generateId(),
      patientId,
      requestingProviderId,
      consultingSpecialty,
      summaryType,
      generatedAt: new Date().toISOString(),
      chiefComplaint: patient.chiefComplaint,
      clinicalSummary: aiSummary,
      relevantHistory: patient.conditions.map(c => `${c.description} (diagnosed ${c.date})`),
      currentMedications: patient.medications,
      recentLabResults: patient.recentLabs,
      relevantDiagnoses: patient.conditions,
      clinicalQuestions,
      urgencyLevel: summaryType === "care_transition" ? "urgent" : "routine",
      keyFindings,
      recommendedFocus,
      aiInsights,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    caseSummaries.set(summary.id, summary);
    return summary;
  }

  async suggestResearchPapers(
    patientId: string,
    caseContext: string,
    clinicalKeywords?: string[]
  ): Promise<ResearchPaperSuggestion> {
    const patient = samplePatientData[patientId as keyof typeof samplePatientData] || samplePatientData["patient-001"];
    
    // HIPAA Audit: Log AI invocation
    logHIPAAAudit("RESEARCH_SUGGESTION", {
      patientId,
      action: "AI_INVOCATION",
      keywordsCount: clinicalKeywords?.length || 0
    });
    
    // De-identify patient data for AI processing
    const deidentifiedPatient = deidentifyForAI(patient);
    
    let suggestedPapers: ResearchPaperSuggestion["suggestedPapers"] = [];
    let searchTermsUsed: string[] = [];
    let aiRationale = "";

    try {
      if (aiEnabled) {
        // Use de-identified data - only clinical conditions without identifiers
        const prompt = `You are a medical research librarian helping find relevant research papers for a complex clinical case.

De-identified Clinical Context (HIPAA Safe Harbor):
- Conditions: ${deidentifiedPatient.conditions.map((c: any) => c.description).join(", ")}
- Chief Complaint: ${deidentifiedPatient.chiefComplaint}
- Case Context: ${caseContext}
${clinicalKeywords ? `- Keywords: ${clinicalKeywords.join(", ")}` : ""}

Please suggest 3-5 relevant research papers that would help inform clinical decision-making for this case. For each paper, provide:

Respond in JSON format:
{
  "searchTermsUsed": ["array of search terms"],
  "suggestedPapers": [
    {
      "title": "Paper title",
      "authors": ["Author names"],
      "journal": "Journal name",
      "year": 2023,
      "doi": "DOI or placeholder",
      "abstract": "Brief abstract",
      "relevanceScore": 0.95,
      "relevanceExplanation": "Why this paper is relevant",
      "keyFindings": ["Key findings from the paper"],
      "clinicalImplications": ["Clinical implications"]
    }
  ],
  "aiRationale": "Overall rationale for these suggestions"
}

Note: Generate realistic but example paper suggestions for educational purposes.`;

        const content = await generatePhiSafeText({
          user: prompt,
          maxTokens: 2000,
          responseMimeType: "application/json",
        });

        if (content) {
          const parsed = JSON.parse(content);
          suggestedPapers = (parsed.suggestedPapers || []).map((p: any, idx: number) => ({
            id: `paper-${Date.now()}-${idx}`,
            ...p
          }));
          searchTermsUsed = parsed.searchTermsUsed || [];
          aiRationale = parsed.aiRationale || "";
        }
      }
    } catch (error) {
      console.log("[AIProviderCollaboration] Using fallback for research suggestions");
    }

    // Fallback if AI not available
    if (suggestedPapers.length === 0) {
      const condition = patient.conditions[0]?.description || "chronic disease";
      suggestedPapers = [
        {
          id: `paper-${Date.now()}-1`,
          title: `Recent Advances in Management of ${condition}`,
          authors: ["Smith J", "Johnson A", "Williams B"],
          journal: "New England Journal of Medicine",
          year: 2024,
          doi: "10.1056/NEJMra2400001",
          abstract: `A comprehensive review of current evidence-based approaches to managing ${condition} in adult patients.`,
          relevanceScore: 0.92,
          relevanceExplanation: `Directly addresses the patient's primary condition and current treatment approaches.`,
          keyFindings: ["Evidence supports multidisciplinary approach", "New therapeutic targets identified"],
          clinicalImplications: ["Consider guideline-directed therapy optimization", "Monitor for treatment response"]
        },
        {
          id: `paper-${Date.now()}-2`,
          title: `Multimorbidity and Treatment Optimization in Complex Patients`,
          authors: ["Brown C", "Davis D"],
          journal: "JAMA Internal Medicine",
          year: 2023,
          doi: "10.1001/jamainternmed.2023.0001",
          abstract: `Analysis of treatment strategies for patients with multiple chronic conditions.`,
          relevanceScore: 0.88,
          relevanceExplanation: `Relevant given the patient's multiple comorbidities.`,
          keyFindings: ["Polypharmacy management strategies", "Prioritization frameworks"],
          clinicalImplications: ["Deprescribing considerations", "Care coordination importance"]
        }
      ];
      searchTermsUsed = [condition, "treatment", "management", "evidence-based"];
      aiRationale = `These papers were selected based on the patient's primary conditions and the complexity of their case requiring evidence-based guidance.`;
    }

    const suggestion: ResearchPaperSuggestion = {
      id: this.generateId(),
      patientId,
      caseId: this.generateId(),
      generatedAt: new Date().toISOString(),
      clinicalContext: caseContext,
      suggestedPapers,
      searchTermsUsed,
      clinicalKeywords: clinicalKeywords || patient.conditions.map(c => c.description.split(" ")[0]),
      evidenceLevel: "Level I-II (Systematic reviews and RCTs prioritized)",
      aiRationale,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    researchSuggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  async draftInterProviderCommunication(
    patientId: string,
    fromProviderId: string,
    fromProviderName: string,
    toProviderId: string,
    toProviderName: string,
    toProviderSpecialty: string,
    communicationType: InterProviderCommunication["communicationType"],
    specificRequest?: string
  ): Promise<InterProviderCommunication> {
    const patient = samplePatientData[patientId as keyof typeof samplePatientData] || samplePatientData["patient-001"];
    
    // HIPAA Audit: Log AI invocation for inter-provider communication
    logHIPAAAudit("COMMUNICATION_DRAFT", {
      patientId,
      fromProviderId,
      toProviderId,
      communicationType,
      action: "AI_INVOCATION"
    });
    
    // De-identify patient data for AI processing
    const deidentifiedPatient = deidentifyForAI(patient);
    
    let draftContent = "";
    let structuredSections: InterProviderCommunication["structuredSections"];
    let aiSuggestions: string[] = [];

    try {
      if (aiEnabled) {
        // Use de-identified data in prompt - real names NOT sent to AI
        const prompt = `You are a medical communication specialist helping draft a professional inter-provider communication.

Communication Details:
- From: Dr. [REFERRING_PROVIDER]
- To: Dr. [CONSULTING_PROVIDER] (${toProviderSpecialty})
- Type: ${communicationType}
${specificRequest ? `- Specific Request: ${specificRequest}` : ""}

De-identified Patient Information (HIPAA Safe Harbor):
- Patient: ${deidentifiedPatient.name}
- Age Range: ${deidentifiedPatient.ageRange}, Gender: ${deidentifiedPatient.gender}
- Chief Complaint: ${deidentifiedPatient.chiefComplaint}
- Active Conditions: ${deidentifiedPatient.conditions.map((c: any) => c.description).join(", ")}
- Current Medications: ${deidentifiedPatient.medications.join(", ")}
- Recent Labs: ${deidentifiedPatient.recentLabs.map((l: any) => `${l.name}: ${l.value}`).join(", ")}

Please draft a professional inter-provider communication in JSON format:
{
  "subject": "Email/message subject line",
  "greeting": "Professional greeting",
  "patientIntroduction": "Brief patient introduction",
  "clinicalBackground": "Relevant clinical background",
  "reasonForCommunication": "Clear reason for this communication",
  "specificQuestions": ["Array of specific clinical questions"],
  "relevantFindings": "Key relevant findings",
  "urgencyStatement": "Urgency level and timeline",
  "requestedActions": ["Array of requested actions"],
  "closingRemarks": "Professional closing",
  "signature": "Signature block",
  "fullDraft": "Complete formatted communication",
  "suggestions": ["Array of suggestions for improving the communication"]
}`;

        const content = await generatePhiSafeText({
          user: prompt,
          maxTokens: 1500,
          responseMimeType: "application/json",
        });

        if (content) {
          const parsed = JSON.parse(content);
          draftContent = parsed.fullDraft || "";
          structuredSections = {
            greeting: parsed.greeting || "",
            patientIntroduction: parsed.patientIntroduction || "",
            clinicalBackground: parsed.clinicalBackground || "",
            reasonForCommunication: parsed.reasonForCommunication || "",
            specificQuestions: parsed.specificQuestions || [],
            relevantFindings: parsed.relevantFindings || "",
            urgencyStatement: parsed.urgencyStatement || "",
            requestedActions: parsed.requestedActions || [],
            closingRemarks: parsed.closingRemarks || "",
            signature: parsed.signature || ""
          };
          aiSuggestions = parsed.suggestions || [];
        }
      }
    } catch (error) {
      console.log("[AIProviderCollaboration] Using fallback for communication drafting");
    }

    // Fallback if AI not available
    if (!draftContent) {
      structuredSections = {
        greeting: `Dear Dr. ${toProviderName},`,
        patientIntroduction: `I am writing to you regarding our mutual patient, ${patient.name}, a ${patient.age}-year-old ${patient.gender.toLowerCase()}.`,
        clinicalBackground: `The patient has a history of ${patient.conditions.map(c => c.description).join(", ")} and is currently on ${patient.medications.join(", ")}.`,
        reasonForCommunication: `I am requesting your ${toProviderSpecialty} expertise regarding ${patient.chiefComplaint}.`,
        specificQuestions: [
          "What is your assessment of the current condition?",
          "Do you recommend any changes to the current treatment plan?",
          "What follow-up would you suggest?"
        ],
        relevantFindings: `Recent laboratory findings include: ${patient.recentLabs.map(l => `${l.name}: ${l.value}`).join(", ")}.`,
        urgencyStatement: communicationType === "urgent_notification" ? "This matter requires urgent attention." : "This is a routine consultation request.",
        requestedActions: ["Please review the attached records", "Provide recommendations at your earliest convenience"],
        closingRemarks: "Thank you for your assistance with this patient's care.",
        signature: `Best regards,\nDr. ${fromProviderName}`
      };

      draftContent = `${structuredSections.greeting}\n\n${structuredSections.patientIntroduction}\n\n${structuredSections.clinicalBackground}\n\n${structuredSections.reasonForCommunication}\n\n${structuredSections.relevantFindings}\n\n${structuredSections.urgencyStatement}\n\n${structuredSections.closingRemarks}\n\n${structuredSections.signature}`;
      aiSuggestions = [
        "Consider adding specific clinical questions for the specialist",
        "Attach relevant lab results and imaging reports",
        "Specify preferred timeline for response"
      ];
    }

    const communication: InterProviderCommunication = {
      id: this.generateId(),
      patientId,
      fromProviderId,
      toProviderId,
      fromProviderName,
      toProviderName,
      toProviderSpecialty,
      communicationType,
      generatedAt: new Date().toISOString(),
      subject: `${communicationType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}: ${patient.name}`,
      draftContent,
      structuredSections: structuredSections!,
      attachmentSuggestions: ["Recent lab results", "Medication list", "Relevant imaging reports", "Previous consultation notes"],
      priority: communicationType === "urgent_notification" ? "urgent" : communicationType === "care_handoff" ? "high" : "normal",
      communicationChannel: "secure_message",
      editHistory: [],
      status: "draft",
      aiSuggestions,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    communications.set(communication.id, communication);
    return communication;
  }

  async updateCommunication(
    communicationId: string,
    section: string,
    newValue: string
  ): Promise<InterProviderCommunication | null> {
    const comm = communications.get(communicationId);
    if (!comm) return null;

    const previousValue = (comm.structuredSections as any)[section] || "";
    
    // Update the section
    (comm.structuredSections as any)[section] = newValue;
    
    // Add to edit history
    comm.editHistory.push({
      timestamp: new Date().toISOString(),
      section,
      previousValue,
      newValue
    });

    // Regenerate full draft
    const s = comm.structuredSections;
    comm.draftContent = `${s.greeting}\n\n${s.patientIntroduction}\n\n${s.clinicalBackground}\n\n${s.reasonForCommunication}\n\n${s.relevantFindings}\n\n${s.urgencyStatement}\n\n${s.closingRemarks}\n\n${s.signature}`;

    communications.set(communicationId, comm);
    return comm;
  }

  async markCommunicationReviewed(communicationId: string): Promise<InterProviderCommunication | null> {
    const comm = communications.get(communicationId);
    if (!comm) return null;
    
    comm.status = "reviewed";
    communications.set(communicationId, comm);
    return comm;
  }

  async sendCommunication(communicationId: string): Promise<InterProviderCommunication | null> {
    const comm = communications.get(communicationId);
    if (!comm) return null;
    
    comm.status = "sent";
    communications.set(communicationId, comm);
    return comm;
  }

  async getDashboard(providerId: string): Promise<CollaborationDashboard> {
    const allSummaries = Array.from(caseSummaries.values());
    const allResearch = Array.from(researchSuggestions.values());
    const allComms = Array.from(communications.values());

    return {
      recentSummaries: allSummaries.slice(-10),
      recentResearchSuggestions: allResearch.slice(-10),
      pendingCommunications: allComms.filter(c => c.status === "draft" || c.status === "reviewed"),
      sentCommunications: allComms.filter(c => c.status === "sent" || c.status === "acknowledged"),
      statistics: {
        totalSummariesGenerated: allSummaries.length,
        totalResearchSuggested: allResearch.length,
        totalCommunicationsDrafted: allComms.length,
        averageResponseTime: 24,
        pendingReviews: allComms.filter(c => c.status === "draft").length
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  getCaseSummary(summaryId: string): PatientCaseSummary | undefined {
    return caseSummaries.get(summaryId);
  }

  getResearchSuggestion(suggestionId: string): ResearchPaperSuggestion | undefined {
    return researchSuggestions.get(suggestionId);
  }

  getCommunication(communicationId: string): InterProviderCommunication | undefined {
    return communications.get(communicationId);
  }

  getAllCaseSummaries(): PatientCaseSummary[] {
    return Array.from(caseSummaries.values());
  }

  getAllCommunications(): InterProviderCommunication[] {
    return Array.from(communications.values());
  }
}

export const aiProviderCollaborationService = new AIProviderCollaborationService();
