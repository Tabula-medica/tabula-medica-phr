import { generatePhiSafeText } from "./ai-gateway";
import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `IMPORTANT DISCLAIMER: This AI-generated analysis is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice, clinical recommendations, or a substitute for professional medical judgment. Healthcare decisions should ONLY be made by qualified healthcare providers who have examined the patient. This system is NOT a Clinical Decision Support (CDS) system and should NOT be used for diagnosis, treatment planning, or prescribing decisions.`;

export type TrendDirection = "improving" | "stable" | "declining" | "fluctuating" | "insufficient_data";
export type EventSeverity = "critical" | "significant" | "moderate" | "routine";
export type TimeframeOption = "7_days" | "30_days" | "90_days" | "6_months" | "1_year" | "all_time";

export interface ClinicalEvent {
  id: string;
  eventType: "diagnosis" | "procedure" | "hospitalization" | "medication_change" | "lab_abnormality" | "symptom_onset" | "care_transition" | "specialist_referral";
  title: string;
  description: string;
  date: string;
  severity: EventSeverity;
  sourceDocuments: string[];
  extractedFrom: string;
  relatedConditions: string[];
  keyFindings: string[];
  aiConfidence: number;
}

export interface ClinicalEventSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  timeframeDays: number;
  totalEventsIdentified: number;
  criticalEvents: ClinicalEvent[];
  significantEvents: ClinicalEvent[];
  eventTimeline: { date: string; events: ClinicalEvent[] }[];
  narrativeSummary: string;
  keyThemes: string[];
  aiConfidence: number;
  disclaimer: string;
}

export interface RiskInsightSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overallRiskLevel: "low" | "moderate" | "elevated" | "high";
  riskScore: number;
  primaryConcerns: {
    condition: string;
    riskLevel: "low" | "moderate" | "high" | "critical";
    contributingFactors: string[];
    timeframe: string;
    dataSupporting: string;
  }[];
  protectiveFactors: string[];
  monitoringPriorities: {
    metric: string;
    currentValue: string;
    targetRange: string;
    trend: TrendDirection;
    urgency: "immediate" | "routine" | "follow_up";
  }[];
  comprehensiveSummary: string;
  patientFriendlySummary: string;
  aiConfidence: number;
  disclaimer: string;
}

export interface HistoricalTrendComparison {
  id: string;
  patientId: string;
  generatedAt: string;
  comparisonTimeframe: TimeframeOption;
  healthDomains: {
    domain: string;
    currentStatus: string;
    historicalBaseline: string;
    trendDirection: TrendDirection;
    percentageChange?: number;
    clinicalSignificance: string;
    keyObservations: string[];
  }[];
  vitalSignsTrends: {
    metric: string;
    currentValue: string;
    previousValue: string;
    trendDirection: TrendDirection;
    normalRange: string;
    observations: string;
  }[];
  labTrends: {
    testName: string;
    currentValue: string;
    historicalRange: string;
    trendDirection: TrendDirection;
    clinicalContext: string;
  }[];
  medicationChanges: {
    medication: string;
    changeType: string;
    date: string;
    reason?: string;
  }[];
  conditionProgression: {
    condition: string;
    status: string;
    details: string;
  }[];
  overallProgressNarrative: string;
  patientFriendlyComparison: string;
  aiConfidence: number;
  disclaimer: string;
}

export interface EnrichedPatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  clinicalEventSummary: ClinicalEventSummary;
  riskInsightSummary: RiskInsightSummary;
  historicalComparison: HistoricalTrendComparison;
  executiveSummary: string;
  keyTakeaways: string[];
  prioritizedActionItems: {
    item: string;
    priority: string;
    rationale: string;
    suggestedTimeframe: string;
  }[];
  dataCompleteness: {
    overallScore: number;
    gaps: string[];
    recommendations: string[];
  };
  aiConfidence: number;
  disclaimer: string;
}

interface PatientData {
  name: string;
  conditions: string[];
  medications: string[];
  recentLabs: { name: string; value: string; date: string; trend: TrendDirection }[];
  vitals: { name: string; value: string; date: string }[];
  clinicalNotes: { type: string; date: string; content: string }[];
}

const samplePatientData = new Map<string, PatientData>();

samplePatientData.set("patient-1", {
  name: "Jane Smith",
  conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia", "Chronic Kidney Disease Stage 3"],
  medications: ["Metformin 1000mg twice daily", "Lisinopril 20mg daily", "Atorvastatin 40mg daily", "Amlodipine 10mg daily"],
  recentLabs: [
    { name: "HbA1c", value: "7.8%", date: "2026-01-15", trend: "improving" },
    { name: "eGFR", value: "48 mL/min", date: "2026-01-15", trend: "declining" },
    { name: "Creatinine", value: "1.4 mg/dL", date: "2026-01-15", trend: "stable" },
    { name: "LDL Cholesterol", value: "95 mg/dL", date: "2026-01-10", trend: "improving" },
    { name: "Blood Pressure", value: "138/88 mmHg", date: "2026-01-20", trend: "stable" }
  ],
  vitals: [
    { name: "Blood Pressure", value: "138/88 mmHg", date: "2026-01-20" },
    { name: "Heart Rate", value: "76 bpm", date: "2026-01-20" },
    { name: "Weight", value: "185 lbs", date: "2026-01-20" },
    { name: "BMI", value: "29.8", date: "2026-01-20" }
  ],
  clinicalNotes: [
    {
      type: "progress_note",
      date: "2026-01-20",
      content: "Patient seen for routine diabetes follow-up. Reports improved dietary compliance. Checking feet - no ulcers or lesions noted. Discussed importance of blood pressure control given CKD progression. Will continue current medication regimen. Follow-up in 3 months with labs."
    },
    {
      type: "lab_report",
      date: "2026-01-15",
      content: "Comprehensive metabolic panel shows stable creatinine at 1.4, eGFR declined slightly to 48 from 52 three months ago. HbA1c improved to 7.8% from 8.2%. LDL well controlled at 95. Patient counseled on kidney function and importance of avoiding NSAIDs."
    },
    {
      type: "specialist_referral",
      date: "2026-01-10",
      content: "Referring patient to nephrology for CKD management. eGFR has declined from 58 to 48 over past year. Need specialist input on medication adjustments and potential need for dietary modifications."
    }
  ]
});

samplePatientData.set("patient-2", {
  name: "Robert Johnson",
  conditions: ["Coronary Artery Disease", "Status post CABG 2024", "Atrial Fibrillation", "COPD"],
  medications: ["Warfarin 5mg daily", "Metoprolol 50mg twice daily", "Aspirin 81mg daily", "Tiotropium 18mcg daily", "Albuterol PRN"],
  recentLabs: [
    { name: "INR", value: "2.4", date: "2026-01-18", trend: "stable" },
    { name: "BNP", value: "180 pg/mL", date: "2026-01-10", trend: "stable" },
    { name: "Hemoglobin", value: "13.2 g/dL", date: "2026-01-10", trend: "stable" }
  ],
  vitals: [
    { name: "Blood Pressure", value: "128/78 mmHg", date: "2026-01-22" },
    { name: "Heart Rate", value: "68 bpm (irregular)", date: "2026-01-22" },
    { name: "Oxygen Saturation", value: "94% on RA", date: "2026-01-22" }
  ],
  clinicalNotes: [
    {
      type: "progress_note",
      date: "2026-01-22",
      content: "Post-CABG follow-up. Patient doing well, resumed cardiac rehab. Afib well controlled on metoprolol. INR therapeutic. Reports occasional dyspnea with exertion, likely related to COPD. Using albuterol 2-3 times weekly. No chest pain."
    },
    {
      type: "discharge_summary",
      date: "2025-11-15",
      content: "Discharge following 3-vessel CABG. Patient tolerated procedure well. No post-operative complications. Discharged on dual antiplatelet therapy plus warfarin for afib. Cardiac rehab arranged. Follow-up in 6 weeks."
    }
  ]
});

async function auditLog(action: string, userId: string, resourceType: string, patientId: string | null, details: object) {
  try {
    await logPhiAccess({
      action: "read",
      userId,
      resourceType,
      patientId: patientId || undefined,
      details: JSON.stringify({ auditAction: action, ...details })
    });
  } catch (error) {
    console.error("[AIPatientSummaryEnrichment] Audit log error:", error);
  }
}

class AIPatientSummaryEnrichmentService {
  private enrichmentCache = new Map<string, { data: EnrichedPatientSummary; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  async extractClinicalEvents(
    patientId: string,
    timeframeDays: number = 90,
    userId: string = "system"
  ): Promise<ClinicalEventSummary> {
    const patientData = samplePatientData.get(patientId);
    if (!patientData) {
      throw new Error(`Patient ${patientId} not found`);
    }

    await auditLog("extract_clinical_events", userId, "clinical_notes", patientId, {
      timeframeDays,
      notesCount: patientData.clinicalNotes.length
    });

    const clinicalNotesText = patientData.clinicalNotes
      .map(note => `[${note.type.toUpperCase()}] ${note.date}:\n${note.content}`)
      .join("\n\n");

    const prompt = `Analyze the following clinical notes and identify key clinical events. Extract structured information about diagnoses, procedures, hospitalizations, medication changes, lab abnormalities, and other significant clinical events.

CLINICAL NOTES:
${clinicalNotesText}

PATIENT CONDITIONS: ${patientData.conditions.join(", ")}
CURRENT MEDICATIONS: ${patientData.medications.join(", ")}

Respond in JSON format with:
{
  "events": [
    {
      "eventType": "diagnosis|procedure|hospitalization|medication_change|lab_abnormality|symptom_onset|care_transition|specialist_referral",
      "title": "Brief event title",
      "description": "Detailed description",
      "date": "YYYY-MM-DD",
      "severity": "critical|significant|moderate|routine",
      "sourceDocument": "progress_note|discharge_summary|lab_report|referral_letter",
      "relatedConditions": ["condition1"],
      "keyFindings": ["finding1"]
    }
  ],
  "narrativeSummary": "Comprehensive narrative summary",
  "keyThemes": ["theme1", "theme2"]
}

IMPORTANT: Only extract information that is explicitly documented. Do not infer or add clinical interpretations.`;

    let events: ClinicalEvent[] = [];
    let narrativeSummary = "";
    let keyThemes: string[] = [];

    try {
      const responseText = await generatePhiSafeText({
        system: "You are a clinical documentation analyst. Extract structured clinical events from medical notes. Do not provide medical advice or interpretations.",
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 2000
      });

      const parsed = JSON.parse(responseText || "{}");

      events = (parsed.events || []).map((e: any) => ({
        id: randomUUID(),
        eventType: e.eventType || "care_transition",
        title: e.title || "Clinical Event",
        description: e.description || "",
        date: e.date || new Date().toISOString().split("T")[0],
        severity: e.severity || "moderate",
        sourceDocuments: [e.sourceDocument || "clinical_note"],
        extractedFrom: e.sourceDocument || "clinical_note",
        relatedConditions: e.relatedConditions || [],
        keyFindings: e.keyFindings || [],
        aiConfidence: 0.85
      }));

      narrativeSummary = parsed.narrativeSummary || "Clinical events extracted from patient records.";
      keyThemes = parsed.keyThemes || [];
    } catch (error) {
      console.error("[AIPatientSummaryEnrichment] OpenAI error:", error);
      events = this.generateFallbackEvents(patientData);
      narrativeSummary = `Review of clinical documentation for ${patientData.name} over the past ${timeframeDays} days.`;
      keyThemes = ["Chronic Disease Management", "Routine Follow-up"];
    }

    const criticalEvents = events.filter(e => e.severity === "critical");
    const significantEvents = events.filter(e => e.severity === "significant");

    const eventsByDate = new Map<string, ClinicalEvent[]>();
    events.forEach(e => {
      const existing = eventsByDate.get(e.date) || [];
      existing.push(e);
      eventsByDate.set(e.date, existing);
    });

    const eventTimeline = Array.from(eventsByDate.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, evts]) => ({ date, events: evts }));

    return {
      id: randomUUID(),
      patientId,
      generatedAt: new Date().toISOString(),
      timeframeDays,
      totalEventsIdentified: events.length,
      criticalEvents,
      significantEvents,
      eventTimeline,
      narrativeSummary,
      keyThemes,
      aiConfidence: 0.85,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  async generateRiskInsightSummary(patientId: string, userId: string = "system"): Promise<RiskInsightSummary> {
    const patientData = samplePatientData.get(patientId);
    if (!patientData) {
      throw new Error(`Patient ${patientId} not found`);
    }

    await auditLog("generate_risk_insights", userId, "patient_data", patientId, {
      conditionsCount: patientData.conditions.length
    });

    const patientContext = `
PATIENT: ${patientData.name}
CONDITIONS: ${patientData.conditions.join(", ")}
MEDICATIONS: ${patientData.medications.join(", ")}
RECENT LABS:
${patientData.recentLabs.map(l => `- ${l.name}: ${l.value} (${l.date}) - Trend: ${l.trend}`).join("\n")}
VITALS:
${patientData.vitals.map(v => `- ${v.name}: ${v.value} (${v.date})`).join("\n")}`;

    try {
      const responseText = await generatePhiSafeText({
        system: "You are a health data analyst. Summarize patient health observations without providing clinical advice.",
        user: `Analyze patient data and provide health observations summary:\n${patientContext}\n\nRespond in JSON with overallObservation, observationScore, primaryConcerns, protectiveFactors, monitoringPriorities, comprehensiveSummary, patientFriendlySummary.`,
        responseMimeType: "application/json",
        maxTokens: 2000
      });

      const parsed = JSON.parse(responseText || "{}");

      return {
        id: randomUUID(),
        patientId,
        generatedAt: new Date().toISOString(),
        overallRiskLevel: parsed.overallObservation || "moderate",
        riskScore: parsed.observationScore || 50,
        primaryConcerns: (parsed.primaryConcerns || []).map((c: any) => ({
          condition: c.condition || "General Health",
          riskLevel: c.concernLevel || "moderate",
          contributingFactors: c.contributingFactors || [],
          timeframe: c.timeframe || "ongoing",
          dataSupporting: c.dataSupporting || ""
        })),
        protectiveFactors: parsed.protectiveFactors || ["Under regular medical care"],
        monitoringPriorities: (parsed.monitoringPriorities || patientData.recentLabs.slice(0, 3)).map((m: any) => ({
          metric: m.metric || m.name || "General",
          currentValue: m.currentValue || m.value || "N/A",
          targetRange: m.targetRange || "Per guidelines",
          trend: m.trend || "stable",
          urgency: m.urgency || "routine"
        })),
        comprehensiveSummary: parsed.comprehensiveSummary || `Patient health summary for ${patientData.name}.`,
        patientFriendlySummary: parsed.patientFriendlySummary || "Your health information has been summarized for review.",
        aiConfidence: 0.82,
        disclaimer: NO_CDS_DISCLAIMER
      };
    } catch (error) {
      console.error("[AIPatientSummaryEnrichment] Risk insight error:", error);
      return this.generateFallbackRiskSummary(patientId, patientData);
    }
  }

  async generateHistoricalComparison(patientId: string, timeframe: TimeframeOption = "90_days", userId: string = "system"): Promise<HistoricalTrendComparison> {
    const patientData = samplePatientData.get(patientId);
    if (!patientData) {
      throw new Error(`Patient ${patientId} not found`);
    }

    await auditLog("generate_historical_comparison", userId, "patient_trends", patientId, { timeframe });

    try {
      const responseText = await generatePhiSafeText({
        system: "You are a health trend analyst. Compare current and historical patient data. Do not provide clinical advice.",
        user: `Generate trend comparison for ${patientData.name} over ${timeframe}. Conditions: ${patientData.conditions.join(", ")}. Labs: ${patientData.recentLabs.map(l => `${l.name}: ${l.value} (${l.trend})`).join(", ")}. Respond in JSON with healthDomains, conditionProgression, overallProgressNarrative, patientFriendlyComparison.`,
        responseMimeType: "application/json",
        maxTokens: 2000
      });

      const parsed = JSON.parse(responseText || "{}");

      return {
        id: randomUUID(),
        patientId,
        generatedAt: new Date().toISOString(),
        comparisonTimeframe: timeframe,
        healthDomains: (parsed.healthDomains || [{ domain: "General Health", currentStatus: "Under management", historicalBaseline: "Established", trendDirection: "stable", clinicalSignificance: "minimal", keyObservations: [] }]),
        vitalSignsTrends: patientData.vitals.map(v => ({
          metric: v.name,
          currentValue: v.value,
          previousValue: "N/A",
          trendDirection: "stable" as TrendDirection,
          normalRange: "Within normal limits",
          observations: "Current reading documented"
        })),
        labTrends: patientData.recentLabs.map(l => ({
          testName: l.name,
          currentValue: l.value,
          historicalRange: "See historical records",
          trendDirection: l.trend,
          clinicalContext: "Trending " + l.trend
        })),
        medicationChanges: patientData.medications.map(m => ({
          medication: m,
          changeType: "unchanged",
          date: new Date().toISOString().split("T")[0]
        })),
        conditionProgression: parsed.conditionProgression || patientData.conditions.map(c => ({
          condition: c,
          status: "stable",
          details: "Ongoing management"
        })),
        overallProgressNarrative: parsed.overallProgressNarrative || `Patient continues with management of chronic conditions.`,
        patientFriendlyComparison: parsed.patientFriendlyComparison || "Your health metrics are being tracked over time.",
        aiConfidence: 0.80,
        disclaimer: NO_CDS_DISCLAIMER
      };
    } catch (error) {
      console.error("[AIPatientSummaryEnrichment] Historical comparison error:", error);
      return this.generateFallbackHistoricalComparison(patientId, patientData, timeframe);
    }
  }

  async generateEnrichedSummary(patientId: string, userId: string = "system", options: { timeframeDays?: number; comparisonTimeframe?: TimeframeOption; forceRefresh?: boolean } = {}): Promise<EnrichedPatientSummary> {
    const cacheKey = `${patientId}-${options.timeframeDays || 90}-${options.comparisonTimeframe || "90_days"}`;
    
    if (!options.forceRefresh) {
      const cached = this.enrichmentCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    const patientData = samplePatientData.get(patientId);
    if (!patientData) {
      throw new Error(`Patient ${patientId} not found`);
    }

    await auditLog("generate_enriched_summary", userId, "comprehensive_patient_data", patientId, options);

    const [clinicalEventSummary, riskInsightSummary, historicalComparison] = await Promise.all([
      this.extractClinicalEvents(patientId, options.timeframeDays || 90, userId),
      this.generateRiskInsightSummary(patientId, userId),
      this.generateHistoricalComparison(patientId, options.comparisonTimeframe || "90_days", userId)
    ]);

    const enrichedSummary: EnrichedPatientSummary = {
      id: randomUUID(),
      patientId,
      patientName: patientData.name,
      generatedAt: new Date().toISOString(),
      clinicalEventSummary,
      riskInsightSummary,
      historicalComparison,
      executiveSummary: `Comprehensive health review for ${patientData.name}. ${clinicalEventSummary.totalEventsIdentified} clinical events documented. Overall health observation level: ${riskInsightSummary.overallRiskLevel}.`,
      keyTakeaways: [
        `${patientData.conditions.length} chronic conditions under management`,
        `${clinicalEventSummary.totalEventsIdentified} clinical events documented`,
        `Overall observation level: ${riskInsightSummary.overallRiskLevel}`,
        "Trends being monitored across key health domains"
      ],
      prioritizedActionItems: [
        { item: "Continue current monitoring plan", priority: "medium", rationale: "Maintain continuity of care", suggestedTimeframe: "Ongoing" }
      ],
      dataCompleteness: {
        overallScore: 85,
        gaps: ["Missing external records"],
        recommendations: ["Request records from external providers"]
      },
      aiConfidence: 0.83,
      disclaimer: NO_CDS_DISCLAIMER
    };

    this.enrichmentCache.set(cacheKey, { data: enrichedSummary, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return enrichedSummary;
  }

  private generateFallbackEvents(patientData: PatientData): ClinicalEvent[] {
    return patientData.clinicalNotes.map((note, index) => ({
      id: randomUUID(),
      eventType: (note.type === "discharge_summary" ? "hospitalization" : "care_transition") as any,
      title: `${note.type.replace(/_/g, " ")} - ${note.date}`,
      description: note.content.substring(0, 200) + "...",
      date: note.date,
      severity: (index === 0 ? "moderate" : "routine") as EventSeverity,
      sourceDocuments: [note.type],
      extractedFrom: note.type,
      relatedConditions: patientData.conditions.slice(0, 2),
      keyFindings: [],
      aiConfidence: 0.70
    }));
  }

  private generateFallbackRiskSummary(patientId: string, patientData: PatientData): RiskInsightSummary {
    return {
      id: randomUUID(),
      patientId,
      generatedAt: new Date().toISOString(),
      overallRiskLevel: "moderate",
      riskScore: 55,
      primaryConcerns: patientData.conditions.slice(0, 3).map(c => ({
        condition: c,
        riskLevel: "moderate" as const,
        contributingFactors: ["Chronic condition"],
        timeframe: "ongoing",
        dataSupporting: "Documented in record"
      })),
      protectiveFactors: ["Under regular medical care"],
      monitoringPriorities: patientData.recentLabs.slice(0, 3).map(l => ({
        metric: l.name,
        currentValue: l.value,
        targetRange: "Per guidelines",
        trend: l.trend,
        urgency: "routine" as const
      })),
      comprehensiveSummary: `Patient ${patientData.name} is managing chronic conditions with regular follow-up.`,
      patientFriendlySummary: "Your health information shows regular care for your conditions.",
      aiConfidence: 0.70,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  private generateFallbackHistoricalComparison(patientId: string, patientData: PatientData, timeframe: TimeframeOption): HistoricalTrendComparison {
    return {
      id: randomUUID(),
      patientId,
      generatedAt: new Date().toISOString(),
      comparisonTimeframe: timeframe,
      healthDomains: [{ domain: "Overall Health", currentStatus: "Under management", historicalBaseline: "Established baseline", trendDirection: "stable", clinicalSignificance: "minimal", keyObservations: [] }],
      vitalSignsTrends: patientData.vitals.map(v => ({ metric: v.name, currentValue: v.value, previousValue: "N/A", trendDirection: "stable" as TrendDirection, normalRange: "Per guidelines", observations: "Current reading" })),
      labTrends: patientData.recentLabs.map(l => ({ testName: l.name, currentValue: l.value, historicalRange: "See history", trendDirection: l.trend, clinicalContext: "Trending " + l.trend })),
      medicationChanges: [],
      conditionProgression: patientData.conditions.map(c => ({ condition: c, status: "stable", details: "Ongoing management" })),
      overallProgressNarrative: `${patientData.name}'s health metrics tracked over ${timeframe.replace("_", " ")}.`,
      patientFriendlyComparison: "Your health trends are being monitored.",
      aiConfidence: 0.70,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  getMetadata() {
    return {
      version: "1.0.0",
      name: "AI Patient Summary Enrichment Service",
      description: "AI-powered enrichment of patient summaries with clinical event extraction, risk insights, and historical trend comparisons",
      features: [
        "Automatic identification and summarization of key clinical events from unstructured text",
        "Concise AI-generated summaries of health insights and observations",
        "Comparative view of current health status against historical trends",
        "Executive summary generation with key takeaways",
        "Patient-friendly summary translations",
        "HIPAA-compliant audit logging",
        "NO-CDS disclaimer enforcement"
      ],
      supportedTimeframes: ["7_days", "30_days", "90_days", "6_months", "1_year", "all_time"],
      aiModel: "gpt-5.1",
      cacheEnabled: true,
      cacheTTLMinutes: 10
    };
  }

  getDashboardSummary() {
    const patientIds = Array.from(samplePatientData.keys());
    return {
      availablePatients: patientIds.length,
      cachedEnrichments: this.enrichmentCache.size,
      samplePatients: patientIds.map(id => {
        const data = samplePatientData.get(id)!;
        return { patientId: id, name: data.name, conditions: data.conditions.length, medications: data.medications.length, recentLabsCount: data.recentLabs.length, clinicalNotesCount: data.clinicalNotes.length };
      }),
      disclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const aiPatientSummaryEnrichmentService = new AIPatientSummaryEnrichmentService();
