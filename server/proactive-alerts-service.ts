/**
 * AI Proactive Health Alerts Service
 * Analyzes patient data to identify concerning trends and trigger timely notifications
 * 
 * SAFE VERB COMPLIANCE:
 * - ONLY allowed verbs: "shows", "states", "refers to", "means"
 * - All AI-generated content is sanitized before display
 */

// CDS-GATED — generateHealthAlerts performs Clinical Decision Support: it analyzes a patient's
// symptoms, vitals, journal, and medications to surface proactive clinical alerts about
// concerning trends (symptom-trend interpretation, severity/emotional-distress flagging).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS determination
// (21st Century Cures Act §3060) + counsel review. NOT a NO-CDS claim. The alert
// retrieval/acknowledge/dismiss helpers are not CDS and remain ungated.
// See services/_cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { assertCdsEnabled } from "./services/_cds-gate";

// Initialize OpenAI client
let openai: OpenAI | null = null;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (e) {
  console.log("[ProactiveAlerts] OpenAI not configured, using mock responses");
}

// Safe verb enforcement
const SAFE_VERBS = ["shows", "states", "refers to", "means"];

const PROHIBITED_WORDS = [
  "should", "need to", "must", "continue", "follow up", "affect", "monitor",
  "review", "coordinate", "prepare", "decide", "help", "supports", "works by affecting",
  "commonly prescribed", "well controlled", "performed", "ordered", "assess", "take",
  "recommend", "advise", "require", "ensure", "consider", "evaluate"
];

function validateSafeVerbs(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  for (const word of PROHIBITED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return false;
    }
  }
  
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
  const replacements: Record<string, string> = {
    "reports": "states",
    "reported": "stated",
    "reporting": "stating",
    "appearing": "showing",
    "appears": "shows",
    "appeared": "showed",
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
    "correlates": "shows connection to",
    "correlating": "showing connection to",
    "triggers": "shows",
    "triggering": "showing",
    "maintains": "shows",
    "maintaining": "showing",
    "supports": "shows",
    "supporting": "showing",
  };
  
  let result = text;
  for (const [bad, good] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  
  return result;
}

function sanitizeText(text: string): string {
  let sanitized = text;
  
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
    "affects": "shows relation to",
    "influences": "shows connection to",
    "causes": "shows",
    "leads to": "shows",
    "results in": "shows",
    "highlights": "shows",
    "points to": "refers to",
  };
  
  for (const [bad, good] of Object.entries(phraseReplacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  sanitized = enforceWhitelistVerbs(sanitized);
  
  if (!validateSafeVerbs(sanitized)) {
    sanitized = `Data shows: ${sanitized.replace(/[^a-zA-Z0-9\s,.'()-]/g, "")}`;
  }
  
  return sanitized;
}

// Alert types and interfaces
export type AlertPriority = "high" | "medium" | "low";
export type AlertCategory = 
  | "symptom_trend" 
  | "vital_sign" 
  | "medication" 
  | "emotional_pattern" 
  | "lifestyle" 
  | "preventive";

export interface HealthAlert {
  id: string;
  patientId: string;
  category: AlertCategory;
  priority: AlertPriority;
  title: string;
  description: string;
  dataPoints: string[];
  recommendation: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissed: boolean;
}

export interface AlertGenerationInput {
  patientId: string;
  symptoms: Array<{
    symptomName: string;
    severity: string;
    notes?: string;
    triggers?: string[];
    loggedAt: string;
  }>;
  vitalSigns: Array<{
    type: string;
    value: string;
    unit: string;
    recordedAt: string;
  }>;
  journalEntries: Array<{
    content: string;
    mood?: string;
    tags?: string[];
    createdAt: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
}

// In-memory storage for alerts
const alertsStore: Map<string, HealthAlert[]> = new Map();

const ALERT_ANALYSIS_PROMPT = `You are analyzing patient health data to identify concerning trends that may need attention.

CRITICAL LANGUAGE RULES:
- ONLY use these verbs: "shows", "states", "refers to", "means"
- NEVER use: "should", "must", "need to", "recommend", "suggest", "consider", "monitor", "review", "indicates", "implies", "demonstrates", "reveals", "predicts", "confirms"
- NEVER give medical advice or treatment recommendations
- Frame everything as observations from patient data

Analyze the provided data and identify patterns that show:
1. Worsening symptom severity over time
2. Unusual vital sign patterns
3. Emotional distress patterns in journal entries
4. Potential symptom-trigger correlations
5. Medication timing observations

For each alert, provide:
- category: one of "symptom_trend", "vital_sign", "medication", "emotional_pattern", "lifestyle", "preventive"
- priority: "high", "medium", or "low" based on potential clinical relevance
- title: Brief factual title (max 10 words)
- description: What the data shows (use only safe verbs)
- dataPoints: Specific observations from the data
- recommendation: Frame as "Data shows consideration of..." NOT as advice

Return a JSON array of alerts. Maximum 5 alerts per analysis.

Example format:
[
  {
    "category": "symptom_trend",
    "priority": "high",
    "title": "Headache frequency shows upward trend",
    "description": "Symptom logs show headache entries at higher frequency over the past 2 weeks.",
    "dataPoints": ["3 headache entries in week 1", "6 entries in week 2"],
    "recommendation": "Data shows this pattern for discussion with care team."
  }
]`;

export async function generateHealthAlerts(
  input: AlertGenerationInput
): Promise<HealthAlert[]> {
  assertCdsEnabled("proactive-alerts:generate");
  const now = new Date();

  // Build data summary for AI
  const dataSummary = {
    symptoms: input.symptoms.slice(-20).map(s => ({
      name: s.symptomName,
      severity: s.severity,
      triggers: s.triggers,
      date: s.loggedAt.split("T")[0],
    })),
    vitalSigns: input.vitalSigns.slice(-10),
    journalMoods: input.journalEntries.slice(-10).map(j => ({
      mood: j.mood,
      tags: j.tags,
      date: j.createdAt.split("T")[0],
    })),
    medications: input.medications,
  };

  let alerts: HealthAlert[] = [];

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ALERT_ANALYSIS_PROMPT },
          { 
            role: "user", 
            content: `Analyze this patient data for concerning trends:\n${JSON.stringify(dataSummary, null, 2)}` 
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const alertsData = Array.isArray(parsed) ? parsed : (parsed.alerts || []);
        
        alerts = alertsData.map((a: any, idx: number) => ({
          id: `alert-${Date.now()}-${idx}`,
          patientId: input.patientId,
          category: a.category || "symptom_trend",
          priority: a.priority || "medium",
          title: sanitizeText(a.title || "Health observation"),
          description: sanitizeText(a.description || ""),
          dataPoints: (a.dataPoints || []).map(sanitizeText),
          recommendation: sanitizeText(a.recommendation || "Data shows this for review."),
          createdAt: now.toISOString(),
          dismissed: false,
        }));
      }
    } catch (error) {
      console.error("[ProactiveAlerts] AI generation error:", error);
      alerts = getMockAlerts(input, now);
    }
  } else {
    alerts = getMockAlerts(input, now);
  }

  // Store alerts
  const existing = alertsStore.get(input.patientId) || [];
  alertsStore.set(input.patientId, [...alerts, ...existing]);

  return alerts;
}

function getMockAlerts(input: AlertGenerationInput, now: Date): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  
  // Analyze symptom frequency
  const symptomCounts: Record<string, number> = {};
  const recentSymptoms = input.symptoms.filter(s => {
    const logDate = new Date(s.loggedAt);
    const daysDiff = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 14;
  });
  
  for (const s of recentSymptoms) {
    symptomCounts[s.symptomName] = (symptomCounts[s.symptomName] || 0) + 1;
  }
  
  // Check for high frequency symptoms
  for (const [symptom, count] of Object.entries(symptomCounts)) {
    if (count >= 5) {
      alerts.push({
        id: `alert-${Date.now()}-freq`,
        patientId: input.patientId,
        category: "symptom_trend",
        priority: "high",
        title: `${symptom} shows frequent occurrence`,
        description: `Symptom logs show ${count} entries for ${symptom} in the past 2 weeks.`,
        dataPoints: [`${count} logged entries`, "14-day observation period"],
        recommendation: "Data shows this pattern for discussion with care team.",
        createdAt: now.toISOString(),
        dismissed: false,
      });
    }
  }
  
  // Check for severe symptoms
  const severeSymptoms = recentSymptoms.filter(s => s.severity === "severe");
  if (severeSymptoms.length >= 2) {
    alerts.push({
      id: `alert-${Date.now()}-severe`,
      patientId: input.patientId,
      category: "symptom_trend",
      priority: "high",
      title: "Multiple severe symptom entries logged",
      description: `Records show ${severeSymptoms.length} symptom entries marked as severe in recent logs.`,
      dataPoints: severeSymptoms.map(s => `${s.symptomName} on ${s.loggedAt.split("T")[0]}`),
      recommendation: "Data shows elevated severity levels for review.",
      createdAt: now.toISOString(),
      dismissed: false,
    });
  }
  
  // Check journal moods
  const lowMoods = input.journalEntries.filter(j => 
    j.mood && ["sad", "anxious", "stressed", "overwhelmed"].includes(j.mood.toLowerCase())
  );
  if (lowMoods.length >= 3) {
    alerts.push({
      id: `alert-${Date.now()}-mood`,
      patientId: input.patientId,
      category: "emotional_pattern",
      priority: "medium",
      title: "Journal entries show emotional pattern",
      description: `Health journal shows ${lowMoods.length} entries with low mood states.`,
      dataPoints: lowMoods.slice(0, 3).map(j => `${j.mood} on ${j.createdAt.split("T")[0]}`),
      recommendation: "Data shows emotional patterns for awareness.",
      createdAt: now.toISOString(),
      dismissed: false,
    });
  }
  
  // Preventive care reminder
  if (alerts.length === 0) {
    alerts.push({
      id: `alert-${Date.now()}-preventive`,
      patientId: input.patientId,
      category: "preventive",
      priority: "low",
      title: "Regular health tracking data logged",
      description: "Logs show ongoing health data entries.",
      dataPoints: ["Consistent data entries show in records"],
      recommendation: "Data shows value in regular health log entries.",
      createdAt: now.toISOString(),
      dismissed: false,
    });
  }
  
  // Sanitize all mock alerts before returning
  return alerts.slice(0, 5).map(alert => ({
    ...alert,
    title: sanitizeText(alert.title),
    description: sanitizeText(alert.description),
    dataPoints: alert.dataPoints.map(sanitizeText),
    recommendation: sanitizeText(alert.recommendation),
  }));
}

export async function getPatientAlerts(patientId: string): Promise<HealthAlert[]> {
  return (alertsStore.get(patientId) || []).filter(a => !a.dismissed);
}

export async function getAllAlerts(patientId: string): Promise<HealthAlert[]> {
  return alertsStore.get(patientId) || [];
}

export async function acknowledgeAlert(
  patientId: string,
  alertId: string,
  acknowledgedBy: string
): Promise<HealthAlert | null> {
  const alerts = alertsStore.get(patientId) || [];
  const alertIndex = alerts.findIndex(a => a.id === alertId);
  
  if (alertIndex === -1) return null;
  
  alerts[alertIndex].acknowledgedAt = new Date().toISOString();
  alerts[alertIndex].acknowledgedBy = acknowledgedBy;
  alertsStore.set(patientId, alerts);
  
  return alerts[alertIndex];
}

export async function dismissAlert(
  patientId: string,
  alertId: string
): Promise<boolean> {
  const alerts = alertsStore.get(patientId) || [];
  const alertIndex = alerts.findIndex(a => a.id === alertId);
  
  if (alertIndex === -1) return false;
  
  alerts[alertIndex].dismissed = true;
  alertsStore.set(patientId, alerts);
  
  return true;
}
