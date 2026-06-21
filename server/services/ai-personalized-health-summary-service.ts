import OpenAI from "openai";
import crypto from "crypto";

let openai: OpenAI | null = null;
try {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  console.log("[PersonalizedHealthSummary] OpenAI client configured");
} catch (error) {
  console.log("[PersonalizedHealthSummary] OpenAI not configured, using fallback");
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This summary is for informational and educational purposes only. It is NOT medical advice and does NOT replace consultation with your healthcare provider. Always discuss health decisions with your doctor.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logPhiAccess(action: string, userId: string, patientId: string, details: string) {
  console.log(`[HIPAA-AUDIT][PersonalizedHealthSummary] ${action} - User:${hashIdentifier(userId)} Patient:${hashIdentifier(patientId)} - ${details}`);
}

export interface FHIRCondition {
  id: string;
  name: string;
  clinicalStatus: string;
  severity?: string;
  onsetDate?: string;
  category?: string;
}

export interface FHIRMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  status: string;
  startDate?: string;
  reason?: string;
}

export interface FHIRLabResult {
  id: string;
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  interpretation?: string;
  date: string;
}

export interface FHIREncounter {
  id: string;
  type: string;
  date: string;
  provider?: string;
  reason?: string;
}

export interface PatientHealthData {
  patientId: string;
  patientName?: string;
  conditions: FHIRCondition[];
  medications: FHIRMedication[];
  labResults: FHIRLabResult[];
  encounters: FHIREncounter[];
  lastSummaryDate?: string;
}

export interface WhatsNewItem {
  category: "condition" | "medication" | "lab" | "encounter";
  title: string;
  description: string;
  date: string;
  significance: "high" | "medium" | "low";
  icon?: string;
}

export interface KeyTrend {
  metric: string;
  direction: "improving" | "worsening" | "stable" | "new";
  description: string;
  timeframe: string;
  dataPoints?: { date: string; value: string }[];
  significance: "positive" | "attention" | "neutral";
}

export interface NextStep {
  title: string;
  description: string;
  category: "question" | "followup" | "monitoring" | "lifestyle";
  priority: "high" | "medium" | "low";
  suggestedTimeframe?: string;
}

export interface PersonalizedHealthSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overviewNarrative: string;
  progressHighlight: string;
  whatsNew: WhatsNewItem[];
  keyTrends: KeyTrend[];
  nextSteps: NextStep[];
  attentionAreas: string[];
  positiveProgress: string[];
  disclaimer: string;
  viewMode: "patient" | "provider";
}

const samplePatientData: Record<string, PatientHealthData> = {
  "patient-001": {
    patientId: "patient-001",
    patientName: "Sarah Johnson",
    conditions: [
      { id: "c1", name: "Type 2 Diabetes Mellitus", clinicalStatus: "active", severity: "moderate", onsetDate: "2022-03-15", category: "Endocrine" },
      { id: "c2", name: "Essential Hypertension", clinicalStatus: "active", severity: "mild", onsetDate: "2021-08-10", category: "Cardiovascular" },
      { id: "c3", name: "Vitamin D Deficiency", clinicalStatus: "resolved", onsetDate: "2024-06-01", category: "Nutritional" },
    ],
    medications: [
      { id: "m1", name: "Metformin", dosage: "500mg", frequency: "twice daily", status: "active", startDate: "2022-04-01", reason: "Type 2 Diabetes" },
      { id: "m2", name: "Lisinopril", dosage: "10mg", frequency: "once daily", status: "active", startDate: "2021-09-01", reason: "Hypertension" },
      { id: "m3", name: "Vitamin D3", dosage: "2000 IU", frequency: "once daily", status: "active", startDate: "2024-06-15", reason: "Vitamin D Deficiency" },
      { id: "m4", name: "Atorvastatin", dosage: "20mg", frequency: "once daily at bedtime", status: "active", startDate: "2025-01-10", reason: "Cholesterol management" },
    ],
    labResults: [
      { id: "l1", testName: "HbA1c", value: 6.8, unit: "%", referenceRange: "<7.0%", interpretation: "normal", date: "2025-01-15" },
      { id: "l2", testName: "HbA1c", value: 7.2, unit: "%", referenceRange: "<7.0%", interpretation: "high", date: "2024-10-10" },
      { id: "l3", testName: "HbA1c", value: 7.5, unit: "%", referenceRange: "<7.0%", interpretation: "high", date: "2024-07-08" },
      { id: "l4", testName: "Fasting Glucose", value: 118, unit: "mg/dL", referenceRange: "70-100", interpretation: "high", date: "2025-01-15" },
      { id: "l5", testName: "LDL Cholesterol", value: 142, unit: "mg/dL", referenceRange: "<100", interpretation: "high", date: "2025-01-05" },
      { id: "l6", testName: "LDL Cholesterol", value: 155, unit: "mg/dL", referenceRange: "<100", interpretation: "high", date: "2024-10-01" },
      { id: "l7", testName: "Blood Pressure", value: "128/82", unit: "mmHg", referenceRange: "<120/80", interpretation: "normal", date: "2025-01-20" },
      { id: "l8", testName: "Vitamin D", value: 38, unit: "ng/mL", referenceRange: "30-100", interpretation: "normal", date: "2025-01-15" },
      { id: "l9", testName: "Creatinine", value: 0.9, unit: "mg/dL", referenceRange: "0.6-1.2", interpretation: "normal", date: "2025-01-15" },
    ],
    encounters: [
      { id: "e1", type: "Follow-up Visit", date: "2025-01-20", provider: "Dr. Emily Chen", reason: "Diabetes management review" },
      { id: "e2", type: "Lab Work", date: "2025-01-15", provider: "Quest Diagnostics", reason: "Quarterly labs" },
      { id: "e3", type: "Annual Physical", date: "2024-11-05", provider: "Dr. Emily Chen", reason: "Annual wellness exam" },
    ],
    lastSummaryDate: "2024-12-01",
  },
};

function getRecentChanges(data: PatientHealthData, daysSinceLast: number = 30): WhatsNewItem[] {
  const items: WhatsNewItem[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceLast);

  data.medications.filter(m => m.startDate && new Date(m.startDate) >= cutoffDate).forEach(med => {
    items.push({
      category: "medication",
      title: `New Medication: ${med.name}`,
      description: `Started ${med.dosage} ${med.frequency} for ${med.reason || "as prescribed"}`,
      date: med.startDate!,
      significance: "medium",
    });
  });

  data.labResults.filter(l => new Date(l.date) >= cutoffDate).slice(0, 5).forEach(lab => {
    const isAbnormal = lab.interpretation === "high" || lab.interpretation === "low" || lab.interpretation === "abnormal";
    items.push({
      category: "lab",
      title: `${lab.testName} Result`,
      description: `${lab.value} ${lab.unit || ""} (${lab.interpretation || "see range"})`,
      date: lab.date,
      significance: isAbnormal ? "high" : "low",
    });
  });

  data.encounters.filter(e => new Date(e.date) >= cutoffDate).forEach(enc => {
    items.push({
      category: "encounter",
      title: enc.type,
      description: enc.reason || `Visit with ${enc.provider}`,
      date: enc.date,
      significance: "low",
    });
  });

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function analyzeLabTrends(labResults: FHIRLabResult[]): KeyTrend[] {
  const trends: KeyTrend[] = [];
  const labsByTest: Record<string, FHIRLabResult[]> = {};
  
  labResults.forEach(lab => {
    if (!labsByTest[lab.testName]) labsByTest[lab.testName] = [];
    labsByTest[lab.testName].push(lab);
  });

  Object.entries(labsByTest).forEach(([testName, results]) => {
    if (results.length < 2) return;
    const sorted = results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    
    const latestVal = typeof latest.value === "number" ? latest.value : parseFloat(String(latest.value));
    const prevVal = typeof previous.value === "number" ? previous.value : parseFloat(String(previous.value));
    
    if (isNaN(latestVal) || isNaN(prevVal)) return;
    
    const percentChange = ((latestVal - prevVal) / prevVal) * 100;
    let direction: KeyTrend["direction"] = "stable";
    let significance: KeyTrend["significance"] = "neutral";
    
    if (Math.abs(percentChange) > 5) {
      if (testName.toLowerCase().includes("a1c") || testName.toLowerCase().includes("glucose") || testName.toLowerCase().includes("ldl")) {
        direction = percentChange < 0 ? "improving" : "worsening";
        significance = percentChange < 0 ? "positive" : "attention";
      } else {
        direction = percentChange > 0 ? "improving" : "worsening";
      }
    }

    trends.push({
      metric: testName,
      direction,
      description: direction === "improving" 
        ? `Your ${testName} has improved by ${Math.abs(percentChange).toFixed(1)}%`
        : direction === "worsening"
        ? `Your ${testName} has increased by ${Math.abs(percentChange).toFixed(1)}%`
        : `Your ${testName} has remained stable`,
      timeframe: `${formatDate(previous.date)} to ${formatDate(latest.date)}`,
      dataPoints: sorted.slice(-4).map(r => ({ date: formatDate(r.date), value: `${r.value} ${r.unit || ""}` })),
      significance,
    });
  });

  return trends.filter(t => t.direction !== "stable").slice(0, 5);
}

function generateNextSteps(data: PatientHealthData, trends: KeyTrend[]): NextStep[] {
  const steps: NextStep[] = [];
  
  const activeConditions = data.conditions.filter(c => c.clinicalStatus === "active");
  activeConditions.forEach(cond => {
    steps.push({
      title: `Discuss ${cond.name} management`,
      description: `Review your current treatment plan and any concerns about ${cond.name.toLowerCase()}`,
      category: "question",
      priority: cond.severity === "moderate" || cond.severity === "severe" ? "high" : "medium",
    });
  });

  trends.filter(t => t.significance === "attention").forEach(trend => {
    steps.push({
      title: `Ask about ${trend.metric} changes`,
      description: trend.description,
      category: "followup",
      priority: "high",
    });
  });

  if (data.medications.length > 3) {
    steps.push({
      title: "Review medication list",
      description: `You're taking ${data.medications.filter(m => m.status === "active").length} active medications. Make sure your provider has an up-to-date list.`,
      category: "monitoring",
      priority: "medium",
    });
  }

  const abnormalLabs = data.labResults.filter(l => l.interpretation === "high" || l.interpretation === "abnormal");
  if (abnormalLabs.length > 0) {
    steps.push({
      title: "Discuss lab results",
      description: `Some recent lab values were outside normal range. Ask your provider to explain what they mean for you.`,
      category: "question",
      priority: "high",
    });
  }

  steps.push({
    title: "Lifestyle check-in",
    description: "Discuss diet, exercise, sleep, and stress management with your provider",
    category: "lifestyle",
    priority: "low",
    suggestedTimeframe: "At next visit",
  });

  return steps.slice(0, 6);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function generateAINarrative(data: PatientHealthData, trends: KeyTrend[], whatsNew: WhatsNewItem[]): Promise<{ overview: string; progress: string; attentionAreas: string[]; positiveProgress: string[] }> {
  const patientName = data.patientName || "the patient";
  const activeConditions = data.conditions.filter(c => c.clinicalStatus === "active").map(c => c.name);
  const activeMeds = data.medications.filter(m => m.status === "active").length;
  const improvingTrends = trends.filter(t => t.direction === "improving");
  const worseningTrends = trends.filter(t => t.direction === "worsening");

  if (!openai) {
    const overview = `${patientName} is currently managing ${activeConditions.length} active health condition${activeConditions.length !== 1 ? "s" : ""}: ${activeConditions.join(", ") || "none listed"}. There are ${activeMeds} active medication${activeMeds !== 1 ? "s" : ""} in the current treatment plan.`;
    
    const progress = improvingTrends.length > 0 
      ? `Good news! ${improvingTrends.map(t => t.metric).join(" and ")} ${improvingTrends.length === 1 ? "is" : "are"} showing improvement.`
      : "Your health metrics have been stable recently.";

    const attentionAreas = worseningTrends.map(t => `${t.metric}: ${t.description}`);
    const positiveProgress = improvingTrends.map(t => `${t.metric}: ${t.description}`);

    return { overview, progress, attentionAreas, positiveProgress };
  }

  try {
    const prompt = `Generate a brief, friendly health summary narrative for a patient. Use simple language a non-medical person can understand.

Patient Data:
- Name: ${patientName}
- Active Conditions: ${activeConditions.join(", ") || "None"}
- Active Medications: ${activeMeds}
- Recent Changes: ${whatsNew.slice(0, 3).map(w => w.title).join(", ") || "None"}
- Improving Trends: ${improvingTrends.map(t => `${t.metric} (${t.description})`).join("; ") || "None"}
- Areas Needing Attention: ${worseningTrends.map(t => `${t.metric} (${t.description})`).join("; ") || "None"}

Provide JSON with:
1. overview: 2-3 sentence summary of overall health status (friendly, encouraging tone)
2. progress: 1-2 sentence highlight of positive progress or stability
3. attentionAreas: Array of 1-2 brief bullet points about areas to discuss with provider (if any)
4. positiveProgress: Array of 1-2 brief bullet points about improvements (if any)

IMPORTANT: This is educational information only, not medical advice. Keep language simple and encouraging.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a patient health communicator. Generate friendly, easy-to-understand health summaries. Never provide medical advice." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      overview: result.overview || `${patientName} is managing ${activeConditions.length} health conditions with ${activeMeds} medications.`,
      progress: result.progress || "Your health metrics have been monitored consistently.",
      attentionAreas: result.attentionAreas || [],
      positiveProgress: result.positiveProgress || [],
    };
  } catch (error) {
    console.error("[PersonalizedHealthSummary] AI narrative generation error:", error);
    return {
      overview: `${patientName} is currently managing ${activeConditions.length} active health condition${activeConditions.length !== 1 ? "s" : ""}.`,
      progress: "Your healthcare team continues to monitor your progress.",
      attentionAreas: worseningTrends.map(t => t.description),
      positiveProgress: improvingTrends.map(t => t.description),
    };
  }
}

export async function generatePersonalizedHealthSummary(
  patientId: string,
  userId: string,
  viewMode: "patient" | "provider" = "patient"
): Promise<PersonalizedHealthSummary> {
  logPhiAccess("GENERATE_SUMMARY", userId, patientId, `viewMode=${viewMode}`);

  const data = samplePatientData[patientId] || samplePatientData["patient-001"];
  
  const whatsNew = getRecentChanges(data, 60);
  const keyTrends = analyzeLabTrends(data.labResults);
  const nextSteps = generateNextSteps(data, keyTrends);
  const narrative = await generateAINarrative(data, keyTrends, whatsNew);

  return {
    id: `phs-${Date.now()}`,
    patientId,
    generatedAt: new Date().toISOString(),
    overviewNarrative: narrative.overview,
    progressHighlight: narrative.progress,
    whatsNew,
    keyTrends,
    nextSteps,
    attentionAreas: narrative.attentionAreas,
    positiveProgress: narrative.positiveProgress,
    disclaimer: NO_CDS_DISCLAIMER,
    viewMode,
  };
}

export async function getPatientData(patientId: string): Promise<PatientHealthData | null> {
  return samplePatientData[patientId] || null;
}

console.log("[PersonalizedHealthSummary] Service initialized with NO-CDS compliance");
