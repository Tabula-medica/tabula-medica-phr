/**
 * AI Health Journal Service
 * Provides journaling with AI analysis for emotional patterns, stress triggers,
 * and correlation with logged symptoms/health events.
 * All entries are private and only analyzed by AI for personal insights.
 */

import OpenAI from "openai";

// Safe verb enforcement - ONLY these 4 verbs allowed
const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "continue", "follow up", "affect", "monitor", "review", "coordinate",
  "prepare", "decide", "help", "supports", "works by affecting",
  "commonly prescribed", "well controlled", "performed", "ordered", "assess", "take"
];

export interface JournalEntry {
  id: string;
  patientId: string;
  date: string;
  content: string;
  mood: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmotionalPattern {
  emotion: string;
  frequency: number;
  observation: string;
  relatedEntryDates: string[];
}

export interface StressTrigger {
  trigger: string;
  frequency: number;
  observation: string;
  examples: string[];
}

export interface SymptomCorrelation {
  pattern: string;
  confidence: "low" | "medium" | "high";
  observation: string;
  supportingData: string[];
}

export interface JournalInsights {
  emotionalPatterns: EmotionalPattern[];
  stressTriggers: StressTrigger[];
  symptomCorrelations: SymptomCorrelation[];
  moodTrend: {
    direction: "improving" | "stable" | "declining";
    observation: string;
  };
  positiveObservations: string[];
  suggestedTopicsForClinician: string[];
  disclaimer: string;
}

// In-memory storage for journal entries
const journalStorage: JournalEntry[] = [];

// Initialize OpenAI client
let openai: OpenAI | null = null;
try {
  openai = new OpenAI();
} catch (e) {
  console.log("[HealthJournal] OpenAI not configured, using mock responses");
}

function validateInsight(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for prohibited words
  for (const word of PROHIBITED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return false;
    }
  }
  
  // Additional prohibited verbs not in the safe list
  const unsafeVerbs = [
    "indicates", "suggests", "implies", "correlates", "affects",
    "influences", "causes", "triggers", "leads", "results",
    "demonstrates", "reveals", "highlights", "points to"
  ];
  
  for (const verb of unsafeVerbs) {
    if (lowerText.includes(verb)) {
      return false;
    }
  }
  
  return true;
}

function sanitizeInsight(text: string): string {
  // Replace prohibited patterns with safe alternatives
  let sanitized = text;
  const replacements: Record<string, string> = {
    "you should": "your entries show",
    "you need to": "your logs show",
    "recommend": "the pattern shows",
    "suggest": "the data shows",
    "consider": "entries refer to",
    "continue": "logs show",
    "follow up": "entries state",
    "monitor": "logs refer to",
    "help": "entries show",
    "indicates": "shows",
    "suggests": "shows",
    "implies": "means",
    "correlates with": "shows connection to",
    "correlates": "shows",
    "affects": "shows relation to",
    "influences": "shows connection to",
    "causes": "shows",
    "triggers": "shows",
    "leads to": "shows",
    "results in": "shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "highlights": "shows",
    "points to": "refers to",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  // Final validation after sanitization
  if (!validateInsight(sanitized)) {
    // If still invalid, prefix with safe framing
    sanitized = `Your entries show: ${sanitized.replace(/[^a-zA-Z0-9\s,.'()-]/g, "")}`;
  }
  
  return sanitized;
}

export async function createJournalEntry(
  patientId: string,
  entryData: Omit<JournalEntry, "id" | "patientId" | "createdAt" | "updatedAt">
): Promise<JournalEntry> {
  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id: `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    date: entryData.date,
    content: entryData.content,
    mood: entryData.mood,
    tags: entryData.tags || [],
    isPrivate: true, // Always private
    createdAt: now,
    updatedAt: now,
  };

  journalStorage.push(entry);
  return entry;
}

export async function getJournalEntries(
  patientId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<JournalEntry[]> {
  let entries = journalStorage.filter(e => e.patientId === patientId);
  
  // Add mock entries for sample if none exist
  if (entries.length === 0) {
    entries = getMockJournalEntries(patientId);
  }
  
  // Filter by date range if provided
  if (options?.startDate) {
    entries = entries.filter(e => e.date >= options.startDate!);
  }
  if (options?.endDate) {
    entries = entries.filter(e => e.date <= options.endDate!);
  }
  
  // Sort by date descending (most recent first)
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Apply limit
  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }
  
  return entries;
}

export async function updateJournalEntry(
  patientId: string,
  entryId: string,
  updates: Partial<Pick<JournalEntry, "content" | "mood" | "tags">>
): Promise<JournalEntry | null> {
  const index = journalStorage.findIndex(
    e => e.id === entryId && e.patientId === patientId
  );
  
  if (index === -1) return null;
  
  journalStorage[index] = {
    ...journalStorage[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  return journalStorage[index];
}

export async function deleteJournalEntry(
  patientId: string,
  entryId: string
): Promise<boolean> {
  const index = journalStorage.findIndex(
    e => e.id === entryId && e.patientId === patientId
  );
  
  if (index === -1) return false;
  
  journalStorage.splice(index, 1);
  return true;
}

const JOURNAL_ANALYSIS_PROMPT = `You are analyzing a patient's private health journal entries to identify patterns. 
Your analysis is for the patient's personal insight only.

CRITICAL RULES:
1. ONLY use these verbs: "shows", "states", "refers to", "means"
2. NEVER use: "should", "must", "need to", "recommend", "suggest", "advise", "consider", "continue", "follow up", "affect", "monitor", "review", "help"
3. Frame all observations as factual patterns, not advice
4. Do NOT provide medical recommendations or diagnoses
5. Keep observations neutral and descriptive

Analyze the journal entries and provide:
1. Emotional patterns (recurring emotions and when they appear)
2. Potential stress triggers mentioned
3. Correlations between journal mood/content and any symptom mentions
4. Overall mood trend (improving/stable/declining)
5. Positive observations from the entries
6. Topics the patient might discuss with their clinician

Example good phrasing:
- "Your entries show anxiety mentions occurring 3 times before headache logs"
- "Days with exercise mentions show higher positive mood ratings"
- "Your logs refer to work stress on 5 occasions this month"

Example bad phrasing (NEVER use):
- "You should consider reducing stress" (uses should, consider)
- "This may affect your symptoms" (uses affect)
- "Continue journaling about..." (uses continue)

Return valid JSON with this structure:
{
  "emotionalPatterns": [{"emotion": string, "frequency": number, "observation": string, "relatedEntryDates": [string]}],
  "stressTriggers": [{"trigger": string, "frequency": number, "observation": string, "examples": [string]}],
  "symptomCorrelations": [{"pattern": string, "confidence": "low"|"medium"|"high", "observation": string, "supportingData": [string]}],
  "moodTrend": {"direction": "improving"|"stable"|"declining", "observation": string},
  "positiveObservations": [string],
  "suggestedTopicsForClinician": [string]
}`;

export async function analyzeJournalEntries(
  patientId: string,
  symptomLogs?: Array<{ symptomName: string; severity: string; date: string }>
): Promise<JournalInsights> {
  const entries = await getJournalEntries(patientId, { limit: 30 });
  
  if (entries.length === 0) {
    return getEmptyInsights();
  }
  
  if (openai) {
    try {
      const entrySummaries = entries.map(e => ({
        date: e.date,
        mood: e.mood,
        tags: e.tags,
        content: e.content.substring(0, 500), // Truncate for API limits
      }));
      
      const symptomContext = symptomLogs 
        ? `\n\nRecent symptom logs:\n${JSON.stringify(symptomLogs, null, 2)}`
        : "";
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: JOURNAL_ANALYSIS_PROMPT },
          { 
            role: "user", 
            content: `Analyze these journal entries:\n${JSON.stringify(entrySummaries, null, 2)}${symptomContext}` 
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      
      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return sanitizeInsights(parsed);
      }
    } catch (error) {
      console.error("[HealthJournal] AI analysis error:", error);
    }
  }
  
  return getMockJournalInsights(entries);
}

function sanitizeInsights(insights: any): JournalInsights {
  return {
    emotionalPatterns: (insights.emotionalPatterns || []).map((p: any) => ({
      ...p,
      observation: sanitizeInsight(p.observation || ""),
    })),
    stressTriggers: (insights.stressTriggers || []).map((t: any) => ({
      ...t,
      observation: sanitizeInsight(t.observation || ""),
    })),
    symptomCorrelations: (insights.symptomCorrelations || []).map((c: any) => ({
      ...c,
      observation: sanitizeInsight(c.observation || ""),
    })),
    moodTrend: {
      direction: insights.moodTrend?.direction || "stable",
      observation: sanitizeInsight(insights.moodTrend?.observation || "Mood shows stable patterns."),
    },
    positiveObservations: (insights.positiveObservations || []).map(sanitizeInsight),
    suggestedTopicsForClinician: (insights.suggestedTopicsForClinician || []).map(sanitizeInsight),
    disclaimer: "Informational only. Not medical advice. Journal entries are private and only analyzed by AI for personal insights.",
  };
}

function getEmptyInsights(): JournalInsights {
  return {
    emotionalPatterns: [],
    stressTriggers: [],
    symptomCorrelations: [],
    moodTrend: {
      direction: "stable",
      observation: "No journal entries to analyze yet.",
    },
    positiveObservations: [],
    suggestedTopicsForClinician: [],
    disclaimer: "Informational only. Not medical advice. Journal entries are private and only analyzed by AI for personal insights.",
  };
}

function getMockJournalEntries(patientId: string): JournalEntry[] {
  const now = new Date();
  return [
    {
      id: "mock-journal-1",
      patientId,
      date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      content: "Had a good day today. Went for a morning walk and felt energized. The headache I had yesterday seems to have subsided. Feeling grateful for the nice weather.",
      mood: "positive",
      tags: ["exercise", "headache", "gratitude"],
      isPrivate: true,
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-journal-2",
      patientId,
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      content: "Work was stressful today with the deadline approaching. Noticed some tension in my shoulders and a mild headache starting in the afternoon. Skipped lunch which probably didn't help.",
      mood: "negative",
      tags: ["stress", "work", "headache", "missed-meal"],
      isPrivate: true,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-journal-3",
      patientId,
      date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      content: "Feeling anxious about the upcoming doctor's appointment. Had trouble sleeping last night. The fatigue is making it hard to concentrate at work.",
      mood: "negative",
      tags: ["anxiety", "sleep", "fatigue", "appointment"],
      isPrivate: true,
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-journal-4",
      patientId,
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      content: "Great weekend! Spent time with family and did some gardening. No symptoms today and energy levels were high. Really makes a difference when I take time to relax.",
      mood: "very_positive",
      tags: ["family", "relaxation", "energy", "gardening"],
      isPrivate: true,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-journal-5",
      patientId,
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      content: "Migraine hit hard today. Had to cancel plans and rest in a dark room. Might be related to the weather change or the extra coffee I had yesterday.",
      mood: "very_negative",
      tags: ["migraine", "rest", "weather", "caffeine"],
      isPrivate: true,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockJournalInsights(entries: JournalEntry[]): JournalInsights {
  // Analyze mood distribution
  const moodCounts = { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 };
  entries.forEach(e => moodCounts[e.mood]++);
  
  const positiveCount = moodCounts.positive + moodCounts.very_positive;
  const negativeCount = moodCounts.negative + moodCounts.very_negative;
  
  let moodDirection: "improving" | "stable" | "declining" = "stable";
  if (entries.length >= 3) {
    const recentMoods: number[] = entries.slice(0, 3).map(e => 
      e.mood === "very_positive" ? 2 : e.mood === "positive" ? 1 : e.mood === "neutral" ? 0 : e.mood === "negative" ? -1 : -2
    );
    const avgRecent = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
    moodDirection = avgRecent > 0.5 ? "improving" : avgRecent < -0.5 ? "declining" : "stable";
  }
  
  // Extract tags for pattern analysis
  const tagCounts: Record<string, number> = {};
  entries.forEach(e => e.tags.forEach(t => {
    tagCounts[t] = (tagCounts[t] || 0) + 1;
  }));
  
  // Build insights based on common tags
  const emotionalPatterns: EmotionalPattern[] = [];
  const stressTriggers: StressTrigger[] = [];
  
  if (tagCounts["stress"]) {
    stressTriggers.push({
      trigger: "Work-related stress",
      frequency: tagCounts["stress"],
      observation: `Your entries refer to stress-related mentions ${tagCounts["stress"]} times.`,
      examples: ["Work deadlines", "Shoulder tension"],
    });
  }
  
  if (tagCounts["anxiety"]) {
    emotionalPatterns.push({
      emotion: "Anxiety",
      frequency: tagCounts["anxiety"],
      observation: `Entries show anxiety mentions appearing ${tagCounts["anxiety"]} times, often before appointments.`,
      relatedEntryDates: entries.filter(e => e.tags.includes("anxiety")).map(e => e.date),
    });
  }
  
  if (tagCounts["headache"] || tagCounts["migraine"]) {
    emotionalPatterns.push({
      emotion: "Physical discomfort",
      frequency: (tagCounts["headache"] || 0) + (tagCounts["migraine"] || 0),
      observation: "Entries show headache/migraine mentions correlating with stress or missed meals.",
      relatedEntryDates: entries.filter(e => e.tags.includes("headache") || e.tags.includes("migraine")).map(e => e.date),
    });
  }
  
  const symptomCorrelations: SymptomCorrelation[] = [];
  
  // Check for stress-symptom correlation
  const stressEntries = entries.filter(e => e.tags.includes("stress") || e.tags.includes("anxiety"));
  const symptomEntries = entries.filter(e => e.tags.includes("headache") || e.tags.includes("migraine") || e.tags.includes("fatigue"));
  
  if (stressEntries.length > 0 && symptomEntries.length > 0) {
    symptomCorrelations.push({
      pattern: "Stress and symptom timing",
      confidence: "medium",
      observation: "Your entries show stress or anxiety mentions often appearing within 1-2 days of symptom entries.",
      supportingData: [
        `${stressEntries.length} stress-related entries`,
        `${symptomEntries.length} symptom-related entries`,
      ],
    });
  }
  
  // Check for positive activity correlation
  const positiveEntries = entries.filter(e => e.mood === "positive" || e.mood === "very_positive");
  if (positiveEntries.length > 0 && positiveEntries.some(e => e.tags.includes("exercise") || e.tags.includes("relaxation"))) {
    symptomCorrelations.push({
      pattern: "Activity and mood correlation",
      confidence: "high",
      observation: "Days with exercise or relaxation mentions show higher positive mood ratings in your entries.",
      supportingData: [
        `${positiveEntries.filter(e => e.tags.includes("exercise")).length} positive entries mention exercise`,
        `${positiveEntries.filter(e => e.tags.includes("relaxation")).length} positive entries mention relaxation`,
      ],
    });
  }
  
  const positiveObservations: string[] = [];
  if (tagCounts["exercise"]) {
    positiveObservations.push("Your entries show exercise as a recurring positive activity.");
  }
  if (tagCounts["family"]) {
    positiveObservations.push("Entries refer to family time as associated with positive moods.");
  }
  if (tagCounts["gratitude"]) {
    positiveObservations.push("Gratitude mentions appear in your journal entries on better days.");
  }
  
  return {
    emotionalPatterns,
    stressTriggers,
    symptomCorrelations,
    moodTrend: {
      direction: moodDirection,
      observation: moodDirection === "improving" 
        ? "Recent entries show an upward mood trend."
        : moodDirection === "declining"
        ? "Recent entries show a downward mood trend."
        : "Your entries show a stable mood pattern over this period.",
    },
    positiveObservations,
    suggestedTopicsForClinician: [
      "What does the connection between stress and my symptoms mean?",
      "Are there patterns in my journal that are relevant to my treatment?",
      "How do my activity levels relate to my overall health?",
    ],
    disclaimer: "Informational only. Not medical advice. Journal entries are private and only analyzed by AI for personal insights.",
  };
}
