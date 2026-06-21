import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI prescription assistance is for INFORMATIONAL AND WORKFLOW SUPPORT PURPOSES ONLY. This does NOT constitute clinical decision support, medical advice, or treatment recommendations. All prescribing decisions must be made by qualified healthcare professionals based on their clinical judgment and direct patient evaluation.";

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!openai && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openai;
}

export interface PatientMedicationProfile {
  patientId: string;
  patientName: string;
  age: number;
  weight?: number;
  conditions: string[];
  allergies: string[];
  currentMedications: {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    prescriber: string;
  }[];
  renalFunction?: "normal" | "mild_impairment" | "moderate_impairment" | "severe_impairment";
  hepaticFunction?: "normal" | "mild_impairment" | "moderate_impairment" | "severe_impairment";
  pregnancyStatus?: "not_pregnant" | "pregnant" | "breastfeeding" | "unknown";
}

export interface DrugInteractionCheck {
  drug1: string;
  drug2: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  managementRecommendation: string;
  source: string;
}

export interface MedicationSuggestion {
  id: string;
  medicationName: string;
  genericName: string;
  drugClass: string;
  suggestedDosage: string;
  frequency: string;
  rationale: string;
  considerations: string[];
  interactionWarnings: DrugInteractionCheck[];
  allergyWarnings: string[];
  contraindications: string[];
  alternatives: {
    name: string;
    reason: string;
  }[];
  requiresReview: boolean;
  confidenceScore: number;
  noCdsDisclaimer: string;
}

export interface MedicationSelectionRequest {
  patientProfile: PatientMedicationProfile;
  indication: string;
  preferredRoute?: "oral" | "injectable" | "topical" | "inhaled" | "any";
  formularyOnly?: boolean;
}

export interface MedicationSelectionResponse {
  requestId: string;
  patientId: string;
  indication: string;
  suggestions: MedicationSuggestion[];
  interactionSummary: {
    totalChecked: number;
    majorInteractions: number;
    moderateInteractions: number;
    minorInteractions: number;
  };
  allergyAlerts: string[];
  aiRationale: string;
  generatedAt: string;
  noCdsDisclaimer: string;
}

export interface RefillRequest {
  id: string;
  patientId: string;
  patientName: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  quantity: number;
  daysSupply: number;
  pharmacy: string;
  prescriberId: string;
  prescriberName: string;
  status: "draft" | "pending_review" | "approved" | "sent" | "denied";
  aiGenerated: boolean;
  aiRationale?: string;
  urgency: "routine" | "urgent" | "emergency";
  lastFillDate: string;
  refillsRemaining: number;
  createdAt: string;
  noCdsDisclaimer: string;
}

export interface AdherenceIssue {
  id: string;
  patientId: string;
  patientName: string;
  medicationId: string;
  medicationName: string;
  issueType: "missed_doses" | "late_refill" | "early_refill" | "discontinued" | "inconsistent_timing" | "dose_splitting";
  severity: "low" | "moderate" | "high";
  description: string;
  detectedAt: string;
  metrics: {
    adherenceRate?: number;
    missedDoses?: number;
    avgDelayDays?: number;
    pattern?: string;
  };
  aiSuggestedInterventions: {
    type: string;
    description: string;
    priority: "low" | "medium" | "high";
    estimatedImpact: string;
  }[];
  riskFactors: string[];
  noCdsDisclaimer: string;
}

export interface AdherenceDashboard {
  patientId: string;
  patientName: string;
  overallAdherenceRate: number;
  medicationAdherence: {
    medicationId: string;
    medicationName: string;
    adherenceRate: number;
    trend: "improving" | "stable" | "declining";
    lastTaken?: string;
    nextDue?: string;
  }[];
  activeIssues: AdherenceIssue[];
  recentInterventions: {
    id: string;
    type: string;
    description: string;
    appliedAt: string;
    outcome?: string;
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
}

const DRUG_INTERACTIONS_DB: DrugInteractionCheck[] = [
  {
    drug1: "Metformin",
    drug2: "Contrast Dye",
    severity: "major",
    description: "Risk of lactic acidosis when metformin is used with iodinated contrast",
    managementRecommendation: "Hold metformin before and 48 hours after contrast administration",
    source: "FDA Drug Labeling"
  },
  {
    drug1: "Lisinopril",
    drug2: "Potassium Supplements",
    severity: "moderate",
    description: "ACE inhibitors can increase potassium levels; concurrent use may cause hyperkalemia",
    managementRecommendation: "Monitor potassium levels closely",
    source: "Clinical Pharmacology Database"
  },
  {
    drug1: "Warfarin",
    drug2: "Aspirin",
    severity: "major",
    description: "Increased risk of bleeding when anticoagulants are used with antiplatelet agents",
    managementRecommendation: "Use combination only when benefits outweigh risks; monitor for bleeding",
    source: "FDA Drug Labeling"
  },
  {
    drug1: "Metoprolol",
    drug2: "Verapamil",
    severity: "major",
    description: "Risk of severe bradycardia, heart block, and hypotension",
    managementRecommendation: "Avoid combination or use with extreme caution and close monitoring",
    source: "Clinical Pharmacology Database"
  },
  {
    drug1: "Simvastatin",
    drug2: "Amiodarone",
    severity: "major",
    description: "Increased risk of myopathy and rhabdomyolysis",
    managementRecommendation: "Limit simvastatin dose to 20mg daily when used with amiodarone",
    source: "FDA Drug Labeling"
  }
];

const MEDICATION_DATABASE: Record<string, {
  genericName: string;
  drugClass: string;
  indications: string[];
  typicalDosages: string[];
  frequencies: string[];
  contraindications: string[];
  renalDosing: boolean;
  hepaticDosing: boolean;
  pregnancyCategory: string;
}> = {
  "Lisinopril": {
    genericName: "Lisinopril",
    drugClass: "ACE Inhibitor",
    indications: ["Hypertension", "Heart Failure", "Post-MI", "Diabetic Nephropathy"],
    typicalDosages: ["2.5mg", "5mg", "10mg", "20mg", "40mg"],
    frequencies: ["Once daily"],
    contraindications: ["Angioedema history", "Bilateral renal artery stenosis", "Pregnancy"],
    renalDosing: true,
    hepaticDosing: false,
    pregnancyCategory: "D"
  },
  "Amlodipine": {
    genericName: "Amlodipine",
    drugClass: "Calcium Channel Blocker",
    indications: ["Hypertension", "Chronic Stable Angina", "Vasospastic Angina"],
    typicalDosages: ["2.5mg", "5mg", "10mg"],
    frequencies: ["Once daily"],
    contraindications: ["Severe aortic stenosis", "Unstable angina"],
    renalDosing: false,
    hepaticDosing: true,
    pregnancyCategory: "C"
  },
  "Metformin": {
    genericName: "Metformin Hydrochloride",
    drugClass: "Biguanide",
    indications: ["Type 2 Diabetes", "Prediabetes", "PCOS"],
    typicalDosages: ["500mg", "850mg", "1000mg"],
    frequencies: ["Once daily", "Twice daily", "Three times daily"],
    contraindications: ["eGFR <30", "Acute kidney injury", "Metabolic acidosis", "Alcohol use disorder"],
    renalDosing: true,
    hepaticDosing: false,
    pregnancyCategory: "B"
  },
  "Atorvastatin": {
    genericName: "Atorvastatin Calcium",
    drugClass: "HMG-CoA Reductase Inhibitor",
    indications: ["Hyperlipidemia", "ASCVD Risk Reduction", "Familial Hypercholesterolemia"],
    typicalDosages: ["10mg", "20mg", "40mg", "80mg"],
    frequencies: ["Once daily"],
    contraindications: ["Active liver disease", "Pregnancy", "Breastfeeding"],
    renalDosing: false,
    hepaticDosing: true,
    pregnancyCategory: "X"
  },
  "Omeprazole": {
    genericName: "Omeprazole",
    drugClass: "Proton Pump Inhibitor",
    indications: ["GERD", "Peptic Ulcer", "H. pylori", "Zollinger-Ellison"],
    typicalDosages: ["20mg", "40mg"],
    frequencies: ["Once daily", "Twice daily"],
    contraindications: ["Hypersensitivity to PPIs"],
    renalDosing: false,
    hepaticDosing: true,
    pregnancyCategory: "C"
  }
};

function checkDrugInteractions(medications: string[], newDrug: string): DrugInteractionCheck[] {
  const interactions: DrugInteractionCheck[] = [];
  for (const existingMed of medications) {
    for (const interaction of DRUG_INTERACTIONS_DB) {
      if ((interaction.drug1.toLowerCase() === existingMed.toLowerCase() && 
           interaction.drug2.toLowerCase() === newDrug.toLowerCase()) ||
          (interaction.drug2.toLowerCase() === existingMed.toLowerCase() && 
           interaction.drug1.toLowerCase() === newDrug.toLowerCase())) {
        interactions.push(interaction);
      }
    }
  }
  return interactions;
}

function checkAllergies(allergies: string[], medication: string): string[] {
  const warnings: string[] = [];
  const allergyMappings: Record<string, string[]> = {
    "Penicillin": ["Amoxicillin", "Ampicillin", "Penicillin V", "Piperacillin"],
    "Sulfa": ["Sulfamethoxazole", "Sulfasalazine", "Furosemide", "Thiazides"],
    "NSAIDs": ["Ibuprofen", "Naproxen", "Aspirin", "Celecoxib", "Meloxicam"],
    "ACE Inhibitors": ["Lisinopril", "Enalapril", "Captopril", "Ramipril", "Benazepril"]
  };
  
  for (const allergy of allergies) {
    if (medication.toLowerCase().includes(allergy.toLowerCase())) {
      warnings.push(`Direct allergy match: Patient has documented allergy to ${allergy}`);
    }
    for (const [allergyClass, drugs] of Object.entries(allergyMappings)) {
      if (allergy.toLowerCase().includes(allergyClass.toLowerCase()) ||
          allergyClass.toLowerCase().includes(allergy.toLowerCase())) {
        if (drugs.some(d => d.toLowerCase() === medication.toLowerCase())) {
          warnings.push(`Cross-reactivity warning: ${medication} may cross-react with documented ${allergy} allergy`);
        }
      }
    }
  }
  return warnings;
}

async function generateAIMedicationRationale(
  request: MedicationSelectionRequest,
  suggestions: MedicationSuggestion[]
): Promise<string> {
  const client = getOpenAI();
  
  if (!client) {
    return `Based on the indication "${request.indication}" and patient profile, the suggested medications have been selected considering the patient's current medication list, documented allergies, and known drug interactions. All suggestions require clinician review before prescribing.`;
  }
  
  try {
    const prompt = `You are a clinical decision support assistant (NOT providing medical advice). 
Summarize the rationale for medication suggestions for a patient with:
- Indication: ${request.indication}
- Current conditions: ${request.patientProfile.conditions.join(", ")}
- Current medications: ${request.patientProfile.currentMedications.map(m => m.name).join(", ") || "None"}
- Allergies: ${request.patientProfile.allergies.join(", ") || "None"}

Suggested medications: ${suggestions.map(s => s.medicationName).join(", ")}

Provide a brief, professional summary of why these options were identified. Emphasize that:
1. This is informational only
2. Clinician must make final decision
3. Full patient evaluation is required

Keep response under 200 words.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });
    
    return response.choices[0]?.message?.content || "AI rationale generation unavailable.";
  } catch (error) {
    console.error("[AIPrescription] AI rationale error:", error);
    return "AI-generated rationale unavailable. Please review suggestions based on clinical guidelines.";
  }
}

export async function getMedicationSuggestions(
  userId: string,
  request: MedicationSelectionRequest
): Promise<MedicationSelectionResponse> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "MedicationSelection",
    details: `AI medication selection for patient ${request.patientProfile.patientId}, indication: ${request.indication}`
  });
  
  const suggestions: MedicationSuggestion[] = [];
  const currentMedNames = request.patientProfile.currentMedications.map(m => m.name);
  let allergyAlerts: string[] = [];
  
  for (const [medName, medInfo] of Object.entries(MEDICATION_DATABASE)) {
    if (medInfo.indications.some(ind => 
      ind.toLowerCase().includes(request.indication.toLowerCase()) ||
      request.indication.toLowerCase().includes(ind.toLowerCase())
    )) {
      const interactions = checkDrugInteractions(currentMedNames, medName);
      const allergyWarnings = checkAllergies(request.patientProfile.allergies, medName);
      allergyAlerts = [...allergyAlerts, ...allergyWarnings];
      
      const contraindications: string[] = [];
      if (medInfo.pregnancyCategory === "X" && request.patientProfile.pregnancyStatus === "pregnant") {
        contraindications.push("Contraindicated in pregnancy (Category X)");
      }
      if (medInfo.renalDosing && request.patientProfile.renalFunction === "severe_impairment") {
        contraindications.push("Requires renal dose adjustment - severe impairment");
      }
      
      const requiresReview = interactions.length > 0 || allergyWarnings.length > 0 || contraindications.length > 0;
      
      suggestions.push({
        id: `sug-${Date.now()}-${medName.toLowerCase().replace(/\s/g, "-")}`,
        medicationName: medName,
        genericName: medInfo.genericName,
        drugClass: medInfo.drugClass,
        suggestedDosage: medInfo.typicalDosages[0],
        frequency: medInfo.frequencies[0],
        rationale: `${medName} is a ${medInfo.drugClass} indicated for ${medInfo.indications.join(", ")}`,
        considerations: [
          medInfo.renalDosing ? "Requires renal function monitoring" : "",
          medInfo.hepaticDosing ? "Requires hepatic function monitoring" : "",
          `Pregnancy category: ${medInfo.pregnancyCategory}`
        ].filter(Boolean),
        interactionWarnings: interactions,
        allergyWarnings,
        contraindications,
        alternatives: Object.entries(MEDICATION_DATABASE)
          .filter(([name, info]) => 
            info.drugClass === medInfo.drugClass && 
            name !== medName
          )
          .slice(0, 2)
          .map(([name]) => ({
            name,
            reason: `Alternative ${medInfo.drugClass}`
          })),
        requiresReview,
        confidenceScore: requiresReview ? 0.6 : 0.85,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }
  }
  
  const aiRationale = await generateAIMedicationRationale(request, suggestions);
  
  const allInteractions = suggestions.flatMap(s => s.interactionWarnings);
  
  return {
    requestId: `req-${Date.now()}`,
    patientId: request.patientProfile.patientId,
    indication: request.indication,
    suggestions: suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore),
    interactionSummary: {
      totalChecked: currentMedNames.length * suggestions.length,
      majorInteractions: allInteractions.filter(i => i.severity === "major" || i.severity === "contraindicated").length,
      moderateInteractions: allInteractions.filter(i => i.severity === "moderate").length,
      minorInteractions: allInteractions.filter(i => i.severity === "minor").length
    },
    allergyAlerts: Array.from(new Set(allergyAlerts)),
    aiRationale,
    generatedAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

const refillRequests: Map<string, RefillRequest> = new Map();

export async function generateAutoRefillRequests(userId: string, patientId: string): Promise<RefillRequest[]> {
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "RefillRequest",
    details: `Generate auto-refill requests for patient ${patientId}`
  });
  
  const sampleMedications = [
    {
      id: "med-1",
      name: "Metformin",
      dosage: "500mg",
      quantity: 60,
      daysSupply: 30,
      pharmacy: "CVS Pharmacy #1234",
      prescriberId: "dr-1",
      prescriberName: "Dr. Sarah Johnson",
      lastFillDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      refillsRemaining: 3
    },
    {
      id: "med-2",
      name: "Lisinopril",
      dosage: "10mg",
      quantity: 30,
      daysSupply: 30,
      pharmacy: "CVS Pharmacy #1234",
      prescriberId: "dr-1",
      prescriberName: "Dr. Sarah Johnson",
      lastFillDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      refillsRemaining: 5
    }
  ];
  
  const generatedRequests: RefillRequest[] = [];
  
  for (const med of sampleMedications) {
    const daysSinceLastFill = Math.floor((Date.now() - new Date(med.lastFillDate).getTime()) / (24 * 60 * 60 * 1000));
    const daysUntilEmpty = med.daysSupply - daysSinceLastFill;
    
    if (daysUntilEmpty <= 7 && med.refillsRemaining > 0) {
      const request: RefillRequest = {
        id: `refill-${Date.now()}-${med.id}`,
        patientId,
        patientName: patientId === "patient-1" ? "John Smith" : "Jane Doe",
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        quantity: med.quantity,
        daysSupply: med.daysSupply,
        pharmacy: med.pharmacy,
        prescriberId: med.prescriberId,
        prescriberName: med.prescriberName,
        status: "pending_review",
        aiGenerated: true,
        aiRationale: `Auto-generated refill request: Patient has approximately ${daysUntilEmpty} days of medication remaining. ${med.refillsRemaining} refills available on current prescription.`,
        urgency: daysUntilEmpty <= 3 ? "urgent" : "routine",
        lastFillDate: med.lastFillDate,
        refillsRemaining: med.refillsRemaining,
        createdAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      };
      
      refillRequests.set(request.id, request);
      generatedRequests.push(request);
    }
  }
  
  return generatedRequests;
}

export async function getRefillRequests(userId: string, patientId?: string): Promise<RefillRequest[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "RefillRequests",
    details: `View refill requests${patientId ? ` for patient ${patientId}` : ""}`
  });
  
  let requests = Array.from(refillRequests.values());
  if (patientId) {
    requests = requests.filter(r => r.patientId === patientId);
  }
  return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateRefillRequestStatus(
  userId: string,
  requestId: string,
  status: RefillRequest["status"]
): Promise<RefillRequest | null> {
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "RefillRequest",
    details: `Update refill request ${requestId} status to ${status}`
  });
  
  const request = refillRequests.get(requestId);
  if (!request) return null;
  
  request.status = status;
  refillRequests.set(requestId, request);
  return request;
}

async function generateAIAdherenceInsights(issues: AdherenceIssue[]): Promise<string[]> {
  const client = getOpenAI();
  
  const defaultInsights = [
    "Adherence patterns suggest potential barriers to medication compliance.",
    "Consider discussing medication schedule optimization with the patient.",
    "Patient may benefit from reminder systems or simplified regimens."
  ];
  
  if (!client || issues.length === 0) {
    return defaultInsights;
  }
  
  try {
    const prompt = `As a pharmacy adherence analyst (NOT providing medical advice), generate 3-4 brief insights about medication adherence based on these issues:

${issues.map(i => `- ${i.medicationName}: ${i.issueType} (${i.severity} severity)`).join("\n")}

Focus on:
1. Observable patterns
2. Potential non-clinical barriers
3. Communication/reminder strategies

Keep insights brief and actionable. Return as JSON array of strings.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    });
    
    const content = response.choices[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return defaultInsights;
  } catch (error) {
    console.error("[AIPrescription] AI adherence insights error:", error);
    return defaultInsights;
  }
}

export async function identifyAdherenceIssues(userId: string, patientId: string): Promise<AdherenceIssue[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "AdherenceAnalysis",
    details: `Identify adherence issues for patient ${patientId}`
  });
  
  const issues: AdherenceIssue[] = [
    {
      id: `adh-${Date.now()}-1`,
      patientId,
      patientName: patientId === "patient-1" ? "John Smith" : "Jane Doe",
      medicationId: "med-1",
      medicationName: "Metformin",
      issueType: "missed_doses",
      severity: "moderate",
      description: "Analysis indicates approximately 15% of scheduled doses may be missed based on refill patterns",
      detectedAt: new Date().toISOString(),
      metrics: {
        adherenceRate: 85,
        missedDoses: 9,
        pattern: "Weekend doses more frequently missed"
      },
      aiSuggestedInterventions: [
        {
          type: "reminder_system",
          description: "Implement daily medication reminders via preferred communication channel",
          priority: "high",
          estimatedImpact: "Studies show reminders can improve adherence by 10-20%"
        },
        {
          type: "simplify_regimen",
          description: "Consider discussing extended-release formulation with prescriber for once-daily dosing",
          priority: "medium",
          estimatedImpact: "Simplified regimens show improved long-term adherence"
        }
      ],
      riskFactors: ["Complex medication schedule", "Multiple daily doses"],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: `adh-${Date.now()}-2`,
      patientId,
      patientName: patientId === "patient-1" ? "John Smith" : "Jane Doe",
      medicationId: "med-2",
      medicationName: "Lisinopril",
      issueType: "late_refill",
      severity: "low",
      description: "Refills are typically requested 2-3 days after supply should be exhausted",
      detectedAt: new Date().toISOString(),
      metrics: {
        adherenceRate: 92,
        avgDelayDays: 2.5,
        pattern: "Consistent late refills over 6 months"
      },
      aiSuggestedInterventions: [
        {
          type: "auto_refill",
          description: "Enroll patient in automatic refill program at pharmacy",
          priority: "medium",
          estimatedImpact: "Eliminates refill delay and medication gaps"
        },
        {
          type: "proactive_outreach",
          description: "Send refill reminder 5 days before supply runs out",
          priority: "low",
          estimatedImpact: "Reduces average delay by 50%"
        }
      ],
      riskFactors: ["No automatic refill enrollment"],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    }
  ];
  
  return issues;
}

export async function getAdherenceDashboard(userId: string, patientId: string): Promise<AdherenceDashboard> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "AdherenceDashboard",
    details: `View adherence dashboard for patient ${patientId}`
  });
  
  const issues = await identifyAdherenceIssues(userId, patientId);
  const aiInsights = await generateAIAdherenceInsights(issues);
  
  return {
    patientId,
    patientName: patientId === "patient-1" ? "John Smith" : "Jane Doe",
    overallAdherenceRate: 88.5,
    medicationAdherence: [
      {
        medicationId: "med-1",
        medicationName: "Metformin 500mg",
        adherenceRate: 85,
        trend: "stable",
        lastTaken: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        nextDue: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      },
      {
        medicationId: "med-2",
        medicationName: "Lisinopril 10mg",
        adherenceRate: 92,
        trend: "improving",
        lastTaken: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        nextDue: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      }
    ],
    activeIssues: issues,
    recentInterventions: [
      {
        id: "int-1",
        type: "reminder_setup",
        description: "Enabled morning medication reminders",
        appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        outcome: "Improved morning dose adherence by 12%"
      }
    ],
    aiInsights,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}
