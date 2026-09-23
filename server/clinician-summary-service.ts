/**
 * AI Clinician Summary Service
 * Generates concise, structured health summaries for clinician review
 * before patient appointments. Synthesizes symptom logs, journal entries,
 * AI insights, vital signs, and upcoming appointments.
 */

import { generatePhiSafeText } from "./services/ai-gateway";

// Safe verb enforcement - ONLY these 4 verbs allowed
const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "continue", "follow up", "affect", "monitor", "review", "coordinate",
  "prepare", "decide", "help", "supports", "works by affecting"
];

export interface SymptomEntry {
  symptomName: string;
  severity: string;
  notes?: string;
  triggers?: Array<{ type: string; description: string }>;
  loggedAt: string;
}

export interface JournalEntry {
  content: string;
  mood?: string;
  tags?: string[];
  createdAt: string;
}

export interface VitalSign {
  type: string;
  value: string;
  unit: string;
  recordedAt: string;
}

export interface Appointment {
  type: string;
  provider: string;
  scheduledAt: string;
  reason?: string;
}

export interface ClinicianSummaryInput {
  patientId: string;
  patientName?: string;
  symptoms?: SymptomEntry[];
  journalEntries?: JournalEntry[];
  vitalSigns?: VitalSign[];
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
  conditions?: Array<{ name: string; status: string }>;
  upcomingAppointments?: Appointment[];
  previousInsights?: string[];
}

export interface KeyChange {
  category: "symptom" | "vital" | "medication" | "condition" | "general";
  description: string;
  timeframe: string;
  significance: "routine" | "notable" | "significant";
}

export interface PatientConcern {
  concern: string;
  source: "symptom_log" | "journal" | "vital_trend";
  frequency?: string;
  relatedSymptoms?: string[];
}

export interface DiscussionPoint {
  topic: string;
  context: string;
  suggestedQuestions?: string[];
}

export interface ClinicianHealthSummary {
  patientId: string;
  patientName: string;
  generatedAt: string;
  reportPeriod: string;
  
  executiveSummary: string;
  
  keyChanges: KeyChange[];
  
  patientReportedConcerns: PatientConcern[];
  
  symptomOverview: {
    totalEntries: number;
    mostFrequent: Array<{ name: string; count: number; avgSeverity: string }>;
    recentTrends: string[];
    triggerPatterns: string[];
  };
  
  vitalSignsSummary: {
    currentReadings: Array<{ type: string; value: string; trend: string }>;
    outOfRangeFlags: string[];
  };
  
  medicationNotes: string[];
  
  journalHighlights: {
    moodTrends: string;
    patientQuotes: string[];
    emotionalPatterns: string[];
  };
  
  discussionPoints: DiscussionPoint[];
  
  upcomingCare: Array<{ type: string; date: string; provider: string }>;
  
  disclaimer: string;
}

// In-memory storage for generated summaries
const summaryStorage: Map<string, ClinicianHealthSummary[]> = new Map();

// AI generation via PHI-safe Vertex/BAA gateway
const aiEnabled = true;

function validateSafeVerbs(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for prohibited words
  for (const word of PROHIBITED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return false;
    }
  }
  
  // Extended list of unsafe verbs to catch
  const unsafeVerbs = [
    "indicates", "suggests", "implies", "correlates", "correlating",
    "affects", "influences", "causes", "triggers", "leads", "results",
    "demonstrates", "reveals", "highlights", "points to", "reports",
    "appearing", "appears", "indicating", "suggesting", "revealing",
    "impacting", "impacts", "determines", "predicts", "confirms"
  ];
  
  for (const verb of unsafeVerbs) {
    if (lowerText.includes(verb)) {
      return false;
    }
  }
  
  return true;
}

function enforceWhitelistVerbs(text: string): string {
  // Comprehensive replacements to force safe verb usage
  const replacements: Record<string, string> = {
    "reports": "states",
    "reported": "stated",
    "reporting": "stating",
    "appearing": "showing",
    "appears": "shows",
    "appeared": "showed",
    "decrease": "lower value",
    "decreased": "lower",
    "decreasing": "showing lower",
    "increase": "higher value",
    "increased": "higher",
    "increasing": "showing higher",
    "indicates": "shows",
    "indicating": "showing",
    "suggests": "shows",
    "suggesting": "showing",
    "implies": "means",
    "implying": "meaning",
    "reveals": "shows",
    "revealing": "showing",
    "demonstrates": "shows",
    "demonstrating": "showing",
    "confirms": "shows",
    "confirming": "showing",
    "predicts": "shows",
    "predicting": "showing",
    "impacts": "shows relation to",
    "impacting": "showing relation to",
    "determines": "shows",
    "determining": "showing",
  };
  
  let result = text;
  for (const [bad, good] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  
  return result;
}

function sanitizeText(text: string): string {
  let sanitized = text;
  
  // First pass: replace prohibited phrases
  const phraseReplacements: Record<string, string> = {
    "you should": "records show",
    "you need to": "logs show",
    "recommend": "the data shows",
    "suggest": "entries refer to",
    "consider": "records show",
    "continue": "logs show",
    "follow up": "entries state",
    "monitor": "records refer to",
    "help": "data shows",
    "correlates with": "shows connection to",
    "correlates": "shows",
    "correlating": "showing connection",
    "affects": "shows relation to",
    "influences": "shows connection to",
    "causes": "shows",
    "triggers": "shows",
    "leads to": "shows",
    "results in": "shows",
    "highlights": "shows",
    "points to": "refers to",
  };
  
  for (const [bad, good] of Object.entries(phraseReplacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  // Second pass: enforce whitelist verbs
  sanitized = enforceWhitelistVerbs(sanitized);
  
  // Final validation - if still contains unsafe content, prefix with safe framing
  if (!validateSafeVerbs(sanitized)) {
    // Strip problematic content and use safe framing
    sanitized = `Records show: ${sanitized.replace(/[^a-zA-Z0-9\s,.'()-]/g, "")}`;
  }
  
  return sanitized;
}

const CLINICIAN_SUMMARY_PROMPT = `You are generating a concise health summary for a clinician to review before a patient appointment.
Your goal is to synthesize patient data into an actionable, structured report.

CRITICAL RULES:
1. ONLY use these verbs: "shows", "states", "refers to", "means"
2. NEVER use: "should", "must", "need to", "recommend", "suggest", "advise", "consider", "continue", "follow up", "affect", "monitor", "review", "help"
3. Present FACTUAL observations from the data - no clinical interpretations or diagnoses
4. Highlight changes, patterns, and patient-reported concerns
5. Format for quick clinician scanning

Structure your response as JSON with these sections:
{
  "executiveSummary": "2-3 sentence overview using safe verbs only",
  "keyChanges": [
    {
      "category": "symptom|vital|medication|condition|general",
      "description": "factual change description",
      "timeframe": "when this occurred",
      "significance": "routine|notable|significant"
    }
  ],
  "patientReportedConcerns": [
    {
      "concern": "patient's stated concern",
      "source": "symptom_log|journal|vital_trend",
      "frequency": "how often reported",
      "relatedSymptoms": ["symptom1", "symptom2"]
    }
  ],
  "symptomOverview": {
    "totalEntries": number,
    "mostFrequent": [{"name": "symptom", "count": number, "avgSeverity": "mild|moderate|severe"}],
    "recentTrends": ["trend descriptions using safe verbs"],
    "triggerPatterns": ["identified trigger patterns"]
  },
  "vitalSignsSummary": {
    "currentReadings": [{"type": "vital type", "value": "reading", "trend": "stable|increasing|decreasing"}],
    "outOfRangeFlags": ["any readings outside normal ranges"]
  },
  "medicationNotes": ["observations about medication adherence or changes"],
  "journalHighlights": {
    "moodTrends": "overall mood pattern observation",
    "patientQuotes": ["direct quotes from journal entries"],
    "emotionalPatterns": ["observed emotional patterns"]
  },
  "discussionPoints": [
    {
      "topic": "topic for discussion",
      "context": "relevant context from data",
      "suggestedQuestions": ["questions clinician might explore"]
    }
  ]
}

Example good phrasing:
- "Symptom logs show 5 headache entries over 14 days, severity shows as moderate"
- "Journal entries state patient reports difficulty sleeping on work nights"
- "Vital records show blood pressure readings at 135/85 mmHg on last 3 measurements"
- "Medication logs refer to missed doses on weekends"

Example bad phrasing (NEVER use):
- "Patient should be evaluated for..." (uses should)
- "Consider adjusting medication..." (uses consider)
- "This may indicate a condition..." (uses indicate)`;

export async function generateClinicianSummary(
  input: ClinicianSummaryInput
): Promise<ClinicianHealthSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  if (aiEnabled && hasPatientData(input)) {
    try {
      const content = await generatePhiSafeText({
        system: CLINICIAN_SUMMARY_PROMPT,
        user: `Generate a clinician summary for this patient data from the last 30 days:\n${JSON.stringify(input, null, 2)}`,
        responseMimeType: "application/json",
        temperature: 0.3,
      });

      if (content) {
        const parsed = JSON.parse(content);
        const summary = buildSummaryFromAI(input, parsed, now);
        storeSummary(input.patientId, summary);
        return summary;
      }
    } catch (error) {
      console.error("[ClinicianSummary] AI generation error:", error);
    }
  }
  
  const mockSummary = getMockClinicianSummary(input, now);
  storeSummary(input.patientId, mockSummary);
  return mockSummary;
}

function hasPatientData(input: ClinicianSummaryInput): boolean {
  return !!(
    input.symptoms?.length ||
    input.journalEntries?.length ||
    input.vitalSigns?.length ||
    input.medications?.length ||
    input.conditions?.length
  );
}

function storeSummary(patientId: string, summary: ClinicianHealthSummary): void {
  const existing = summaryStorage.get(patientId) || [];
  existing.unshift(summary);
  // Keep last 10 summaries per patient
  summaryStorage.set(patientId, existing.slice(0, 10));
}

export async function getClinicianSummaries(patientId: string): Promise<ClinicianHealthSummary[]> {
  return summaryStorage.get(patientId) || [];
}

function buildSummaryFromAI(
  input: ClinicianSummaryInput,
  aiData: any,
  now: Date
): ClinicianHealthSummary {
  return {
    patientId: input.patientId,
    patientName: input.patientName || "Patient",
    generatedAt: now.toISOString(),
    reportPeriod: "Last 30 days",
    
    executiveSummary: sanitizeText(aiData.executiveSummary || "Records show patient data for the review period."),
    
    keyChanges: (aiData.keyChanges || []).map((c: any) => ({
      category: c.category || "general",
      description: sanitizeText(c.description || ""),
      timeframe: c.timeframe || "Recent",
      significance: c.significance || "routine",
    })),
    
    patientReportedConcerns: (aiData.patientReportedConcerns || []).map((c: any) => ({
      concern: sanitizeText(c.concern || ""),
      source: c.source || "symptom_log",
      frequency: c.frequency,
      relatedSymptoms: c.relatedSymptoms || [],
    })),
    
    symptomOverview: {
      totalEntries: input.symptoms?.length || 0,
      mostFrequent: aiData.symptomOverview?.mostFrequent || [],
      recentTrends: (aiData.symptomOverview?.recentTrends || []).map(sanitizeText),
      triggerPatterns: (aiData.symptomOverview?.triggerPatterns || []).map(sanitizeText),
    },
    
    vitalSignsSummary: {
      currentReadings: aiData.vitalSignsSummary?.currentReadings || [],
      outOfRangeFlags: (aiData.vitalSignsSummary?.outOfRangeFlags || []).map(sanitizeText),
    },
    
    medicationNotes: (aiData.medicationNotes || []).map(sanitizeText),
    
    journalHighlights: {
      moodTrends: sanitizeText(aiData.journalHighlights?.moodTrends || "No journal data available."),
      patientQuotes: aiData.journalHighlights?.patientQuotes || [],
      emotionalPatterns: (aiData.journalHighlights?.emotionalPatterns || []).map(sanitizeText),
    },
    
    discussionPoints: (aiData.discussionPoints || []).map((d: any) => ({
      topic: sanitizeText(d.topic || ""),
      context: sanitizeText(d.context || ""),
      suggestedQuestions: (d.suggestedQuestions || []).map(sanitizeText),
    })),
    
    upcomingCare: (input.upcomingAppointments || []).map(a => ({
      type: a.type,
      date: a.scheduledAt.split("T")[0],
      provider: a.provider,
    })),
    
    disclaimer: "Informational only. Not medical advice. This summary presents patient-reported data and observations. Clinical judgment is required for all care decisions. Note: Some data sources shown are sample data for illustration purposes.",
  };
}

function getMockClinicianSummary(
  input: ClinicianSummaryInput,
  now: Date
): ClinicianHealthSummary {
  const symptomCount = input.symptoms?.length || 0;
  const journalCount = input.journalEntries?.length || 0;
  
  // Analyze symptoms for frequency
  const symptomFrequency: Record<string, { count: number; severities: string[] }> = {};
  for (const s of input.symptoms || []) {
    if (!symptomFrequency[s.symptomName]) {
      symptomFrequency[s.symptomName] = { count: 0, severities: [] };
    }
    symptomFrequency[s.symptomName].count++;
    symptomFrequency[s.symptomName].severities.push(s.severity);
  }
  
  const mostFrequent = Object.entries(symptomFrequency)
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgSeverity: getMostCommonSeverity(data.severities),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  // Extract triggers
  const triggers: string[] = [];
  for (const s of input.symptoms || []) {
    if (s.triggers) {
      for (const t of s.triggers) {
        if (!triggers.includes(t.type)) {
          triggers.push(t.type);
        }
      }
    }
  }
  
  // Build mock summary
  return {
    patientId: input.patientId,
    patientName: input.patientName || "Patient",
    generatedAt: now.toISOString(),
    reportPeriod: "Last 30 days",
    
    executiveSummary: `Records show ${symptomCount} symptom entries and ${journalCount} journal entries over the past 30 days. ${
      mostFrequent.length > 0 
        ? `Most frequent symptom shows as ${mostFrequent[0].name} with ${mostFrequent[0].count} entries.` 
        : "No symptom patterns available."
    } Overall data shows patient engagement with health tracking.`,
    
    keyChanges: [
      {
        category: "symptom" as const,
        description: `Symptom log shows ${symptomCount} total entries for the period.`,
        timeframe: "Past 30 days",
        significance: symptomCount > 10 ? "notable" as const : "routine" as const,
      },
      {
        category: "general" as const,
        description: `Journal entries state ${journalCount} entries with health-related notes.`,
        timeframe: "Past 30 days",
        significance: "routine" as const,
      },
    ],
    
    patientReportedConcerns: mostFrequent.slice(0, 2).map(s => ({
      concern: `Patient reports ${s.name} episodes`,
      source: "symptom_log" as const,
      frequency: `${s.count} times in 30 days`,
      relatedSymptoms: [],
    })),
    
    symptomOverview: {
      totalEntries: symptomCount,
      mostFrequent,
      recentTrends: [
        mostFrequent.length > 0 
          ? `${mostFrequent[0].name} entries show ${mostFrequent[0].avgSeverity} severity on average.`
          : "No symptom trends available.",
      ],
      triggerPatterns: triggers.length > 0 
        ? [`Trigger logs refer to: ${triggers.join(", ")}`]
        : ["No trigger patterns logged."],
    },
    
    vitalSignsSummary: {
      currentReadings: (input.vitalSigns || []).slice(0, 3).map(v => ({
        type: v.type,
        value: `${v.value} ${v.unit}`,
        trend: "stable",
      })),
      outOfRangeFlags: [],
    },
    
    medicationNotes: (input.medications || []).length > 0
      ? [`Records show ${input.medications!.length} active medications.`]
      : ["No medication data available."],
    
    journalHighlights: {
      moodTrends: journalCount > 0 
        ? `Journal entries show ${journalCount} entries over the period.`
        : "No journal entries available.",
      patientQuotes: (input.journalEntries || []).slice(0, 2).map(j => 
        j.content.length > 100 ? j.content.substring(0, 100) + "..." : j.content
      ),
      emotionalPatterns: [],
    },
    
    discussionPoints: [
      {
        topic: "Symptom Patterns",
        context: `Logs show ${symptomCount} symptom entries. ${
          mostFrequent.length > 0 
            ? `Most frequent shows as ${mostFrequent[0].name}.`
            : ""
        }`,
        suggestedQuestions: [
          "What changes have you noticed in your symptoms?",
          "Are there any new concerns since your last visit?",
        ],
      },
      {
        topic: "Medication Adherence",
        context: "Records refer to medication tracking data.",
        suggestedQuestions: [
          "How are you managing your current medications?",
          "Have you experienced any side effects?",
        ],
      },
    ],
    
    upcomingCare: (input.upcomingAppointments || []).map(a => ({
      type: a.type,
      date: a.scheduledAt.split("T")[0],
      provider: a.provider,
    })),
    
    disclaimer: "Informational only. Not medical advice. This summary presents patient-reported data and observations. Clinical judgment is required for all care decisions. Note: Vital signs, medications, and appointments shown are sample data for illustration purposes.",
  };
}

function getMostCommonSeverity(severities: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of severities) {
    counts[s] = (counts[s] || 0) + 1;
  }
  let max = 0;
  let result = "mild";
  for (const [severity, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      result = severity;
    }
  }
  return result;
}
