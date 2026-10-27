import { governedAICall } from "./third-party-data-governance";
import { storage } from "./storage";
import { phiAuditService } from "./phi-audit-service";

const DISCLAIMER = "This is not medical advice. Always consult your healthcare provider for medical decisions.";

const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "SSN" },
  { pattern: /\b\d{9}\b/g, label: "SSN-no-dashes" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: "email" },
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "phone" },
  { pattern: /\b\d{1,5}\s+[A-Za-z0-9\s.,']+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)\b/gi, label: "address" },
  { pattern: /\bMRN[-:\s]?\d{4,}\b/gi, label: "MRN" },
  { pattern: /\b(?:DOB|Date of Birth)[-:\s]?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi, label: "DOB" },
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, label: "SSN-variant" },
];

function scrubPII(text: string): string {
  let scrubbed = text;
  for (const { pattern } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, "[REDACTED]");
  }
  return scrubbed;
}

function scrubObjectPII(obj: any): any {
  if (typeof obj === "string") return scrubPII(obj);
  if (Array.isArray(obj)) return obj.map(scrubObjectPII);
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = scrubObjectPII(value);
    }
    return result;
  }
  return obj;
}

type ReadingLevel = "simple" | "detailed";

const summaryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const summaryHistory = new Map<string, Array<{ summary: any; generatedAt: string }>>();
const MAX_HISTORY = 10;

function saveSummaryToHistory(userId: string, summary: any) {
  if (!summaryHistory.has(userId)) {
    summaryHistory.set(userId, []);
  }
  const history = summaryHistory.get(userId)!;
  history.unshift({ summary, generatedAt: new Date().toISOString() });
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
}

export function getSummaryHistory(userId: string) {
  return summaryHistory.get(userId) || [];
}

function getReadingLevelPrompt(level: ReadingLevel): string {
  if (level === "simple") {
    return `READING LEVEL: 4th-grade (Flesch-Kincaid Grade 4 or lower).
- Maximum sentence length: 12 words.
- Use only common, everyday words. Replace every medical term with a plain-language equivalent.
  EXAMPLES: "hypertension" -> "high blood pressure"; "prescribed" -> "your doctor wants you to take"; "hemoglobin A1c" -> "a blood test that shows your average blood sugar over 3 months"; "bilateral" -> "on both sides"; "etiology" -> "the cause"; "prognosis" -> "what we expect to happen".
- Never assume the reader knows what a body part does. Briefly explain in context: "Your kidneys (the organs that clean your blood)..."
- Use second person ("you", "your") to keep it personal and direct.`;
  }
  return `READING LEVEL: 8th-grade (Flesch-Kincaid Grade 8 or lower).
- Maximum sentence length: 20 words.
- Use plain language as the primary voice, but include the proper medical term in parentheses on first use so the patient can reference it with their provider.
  EXAMPLES: "high blood pressure (hypertension)"; "blood sugar test (HbA1c)"; "chest X-ray (radiograph)".
- After the first parenthetical mention, use only the plain-language version for the rest of the summary.
- You may use common medical terms like "diagnosis", "prescription", and "symptoms" without explanation.
- Use second person ("you", "your") to keep it personal and direct.`;
}

export async function generatePatientFriendlySummary(userId: string, options?: { readingLevel?: ReadingLevel; forceRefresh?: boolean }) {
  const readingLevel = options?.readingLevel || "simple";
  const forceRefresh = options?.forceRefresh || false;

  const cacheKey = `${userId}:${readingLevel}`;
  if (!forceRefresh) {
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, fromCache: true };
    }
  }

  let records: Awaited<ReturnType<typeof storage.getHealthRecords>> = [];
  let medications: Awaited<ReturnType<typeof storage.getActiveMedicationReminders>> = [];
  let appointments: Awaited<ReturnType<typeof storage.getUpcomingAppointments>> = [];
  let insights: Awaited<ReturnType<typeof storage.getAiInsights>> = [];
  let profile: Awaited<ReturnType<typeof storage.getPatientProfile>> = undefined;
  let goals: Awaited<ReturnType<typeof storage.getActiveHealthGoals>> = [];

  try {
    [records, medications, appointments, insights, profile, goals] = await Promise.all([
      storage.getHealthRecords(userId),
      storage.getActiveMedicationReminders(userId),
      storage.getUpcomingAppointments(userId),
      storage.getAiInsights(userId),
      storage.getPatientProfile(userId),
      storage.getActiveHealthGoals(userId),
    ]);
  } catch (storageErr: any) {
    console.error("[PatientFriendlySummary] Storage fetch failed:", storageErr.message);
  }

  const groupedRecords: Record<string, any[]> = {};
  for (const record of records) {
    const type = record.type || "other";
    if (!groupedRecords[type]) {
      groupedRecords[type] = [];
    }
    groupedRecords[type].push({
      title: record.title,
      type: record.type,
      date: record.date,
      summary: record.summary,
      provider: record.provider,
      details: record.details,
    });
  }

  const totalDataPoints = records.length + medications.length + appointments.length + goals.length;
  if (totalDataPoints === 0) {
    const emptyResult = {
      overallStatus: "Welcome to Tabula Medica. We do not have any health records for you yet. Connect your health systems or add records to see a personalized health summary here.",
      statusSeverity: "fair" as const,
      conditions: [],
      medications: [],
      upcomingAppointments: [],
      recentResults: [],
      aiInsights: [],
      wellnessTips: [
        "Connect your health records from the home screen to get started.",
        "You can also add records manually from any doctor visit.",
        "Check back after connecting your records for a full health summary.",
      ],
      careGaps: [],
      lastUpdated: new Date().toISOString(),
      readingLevel,
      auditId: null,
      disclaimer: DISCLAIMER,
      snapshot: {
        totalRecords: 0,
        conditionCount: 0,
        activeMedications: 0,
        upcomingAppointmentCount: 0,
        recentLabCount: 0,
        activeGoals: 0,
      },
      fromCache: false,
      isEmpty: true,
    };
    summaryCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
    return emptyResult;
  }

  const readingLevelInstructions = getReadingLevelPrompt(readingLevel);

  const systemPrompt = `You are a board-certified health-literacy specialist embedded in a HIPAA-compliant patient health records platform called Tabula Medica. Your sole job is to translate a patient's clinical data into a warm, accurate, and actionable health summary the patient can understand and act on.

=== ROLE & TONE ===
- Voice: A knowledgeable, caring nurse who has 10 minutes to sit with the patient and explain everything.
- Tone: Calm, encouraging, and honest. Never alarming, never dismissive.
- When results are concerning, use empowering language: "This is something to talk with your doctor about soon" rather than "This is a serious problem."
- When results are normal, celebrate briefly: "Great news -- your blood sugar is right where it should be."
- Always end on an empowering note. The patient should close this summary feeling informed and in control of their health.

=== ${readingLevelInstructions} ===

=== MEDICAL ACCURACY GUARDRAILS ===
- NEVER diagnose, contradict a provider's assessment, or recommend starting/stopping medications.
- NEVER state that a lab value IS normal or abnormal based solely on a reference range you infer. Instead reflect what the data says: "Your doctor noted this as [status]" or "This result was flagged as [high/low]."
- If the data does not explicitly include a status or flag for a result, say "Ask your doctor what this means for you" rather than guessing.
- When describing medication purpose, use phrasing like "This is often used to help with..." rather than "This treats your condition" -- you do not know the prescriber's specific rationale.
- For conditions with a "worsening" or "new" status, always include an actionItem suggesting the patient discuss this at their next visit (or sooner if urgent).

=== PRIVACY & PII SCRUBBING (HIPAA) ===
- CRITICAL: NEVER output any of the following, even if present in the input data: patient full names, dates of birth, Social Security numbers, street addresses, phone numbers, email addresses, medical record numbers (MRN), insurance IDs, or any other direct identifiers.
- For providers: Use role-based references only. Say "Your cardiologist" or "Your primary care doctor." If only a name is available and no role, use "Dr. [first initial]." (e.g., "Dr. S.").
- For facilities: Generic reference only ("the hospital", "the lab") unless the facility name is medically relevant context (e.g., a specialty center the patient needs to return to).

=== STRUCTURAL RULES ===
- Return valid JSON only. No markdown, no surrounding text, no code fences.
- Every string value in the JSON must be a complete, patient-friendly sentence or phrase -- never a raw clinical code, abbreviation, or shorthand.
- Include this disclaimer verbatim in the output: "${DISCLAIMER}"

=== OUTPUT SCHEMA ===
Return a JSON object with exactly these fields:
{
  "overallStatus": "1-2 sentences capturing the big picture. Lead with the most important thing (e.g., an upcoming appointment, a new result, or overall stability). End with one forward-looking sentence.",
  "statusSeverity": "good | fair | needs-attention",
  "conditions": [{"name": "Plain-language condition name", "simplifiedExplanation": "What this condition means for the patient in everyday words, including how it may affect daily life", "status": "stable | monitoring | improving | worsening | new", "urgency": "routine | soon | urgent"}],
  "medications": [{"name": "Medication brand or generic name", "purpose": "Why the patient likely takes this, in plain terms", "schedule": "When and how often to take it, in conversational phrasing", "importantNotes": "Key warnings, food interactions, or tips (e.g., 'Take with food to avoid stomach upset')"}],
  "upcomingAppointments": [{"type": "Visit type in plain terms (e.g., 'Heart checkup')", "provider": "Role-based reference (e.g., 'Your cardiologist')", "date": "Friendly date format (e.g., 'Tuesday, March 12')", "whatToExpect": "1-2 sentences about what will likely happen", "prepInstructions": "Any preparation steps (fasting, bringing records, etc.)"}],
  "recentResults": [{"testName": "Plain-language test name", "result": "The value and unit in understandable terms", "whatItMeans": "Patient-friendly interpretation tied to THEIR health context", "status": "normal | borderline | abnormal | critical", "trend": "improving | stable | worsening | new"}],
  "aiInsights": [{"title": "Short headline (max 8 words)", "summary": "2-3 sentences connecting multiple data points into one insight the patient can understand", "actionItem": "One specific, achievable thing the patient can do", "priority": "low | medium | high"}],
  "wellnessTips": ["Tip 1 personalized to this patient's conditions/medications", "Tip 2", "Tip 3"],
  "careGaps": [{"gap": "What may be missing or overdue", "recommendation": "What the patient should ask their doctor about", "timeframe": "When to address this (e.g., 'At your next visit', 'Within 2 weeks')"}],
  "lastUpdated": "ISO 8601 timestamp",
  "readingLevel": "${readingLevel}"
}

=== FIELD GUIDANCE ===
- overallStatus: Answer the question "How am I doing overall?" If data is sparse, acknowledge that honestly: "We only have a few records so far, but here is what we know."
- statusSeverity: "good" = no urgent concerns and trends are stable/improving. "fair" = minor concerns or incomplete data. "needs-attention" = at least one urgent or worsening item.
- conditions: List every condition found in the data. For each, the simplifiedExplanation should be 2-3 sentences explaining what it is and why it matters to this patient.
- medications: Include ALL active medications. The purpose field should never be empty -- if the data does not indicate a purpose, write "Ask your doctor or pharmacist about why you take this."
- recentResults: Only include results from the data. The whatItMeans field must always connect the result to the patient's health context, not just restate a reference range.
- aiInsights: Maximum 3. These should synthesize across data sources (e.g., connecting a lab trend to a medication change). Each must have a concrete, non-generic actionItem.
- wellnessTips: Exactly 3. These must be personalized to the patient's actual data -- never generic filler like "drink water." Tie each tip to a condition, medication, or result in their record.
- careGaps: Maximum 3. These are preventive care items, overdue screenings, or missing follow-ups inferred from the data. If no gaps are apparent, return an empty array.`;

  const userPrompt = `Create a patient-friendly health summary based on this data:

Health Records by Type:
${JSON.stringify(groupedRecords, null, 2)}

Active Medication Reminders:
${JSON.stringify(medications.map((m: any) => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency, instructions: m.instructions, scheduledTimes: m.scheduledTimes })), null, 2)}

Upcoming Appointments:
${JSON.stringify(appointments.map((a: any) => ({ type: a.appointmentType, provider: a.providerName, date: a.scheduledAt, facility: a.facilityName, notes: a.notes })), null, 2)}

AI Insights:
${JSON.stringify((insights || []).slice(0, 5).map((i: any) => ({ title: i.title, content: i.content, category: i.category, confidence: i.confidence })), null, 2)}

Health Goals:
${JSON.stringify(goals.map((g: any) => ({ title: g.title, category: g.category, targetValue: g.targetValue, targetUnit: g.targetUnit, status: g.status })), null, 2)}

Patient Profile Summary:
${profile ? JSON.stringify({ preferredLanguage: profile.preferredLanguage, gender: profile.gender }) : "No profile available"}`;

  try {
    const result = await governedAICall({
      systemPrompt,
      userPrompt,
      purpose: "health_analytics",
      dataCategories: ["conditions", "medications", "lab_results", "vitals", "appointments"],
      callerService: "PatientFriendlySummary",
      callerMethod: "generateSummary",
      userId,
      model: "gpt-5.2",
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(result.content);
    const scrubbed = scrubObjectPII(parsed);

    const snapshot = {
      totalRecords: records.length,
      conditionCount: (groupedRecords["condition"] || []).length,
      activeMedications: medications.length,
      upcomingAppointmentCount: appointments.length,
      recentLabCount: (groupedRecords["lab"] || []).length,
      activeGoals: goals.length,
    };

    const summaryResult = {
      ...scrubbed,
      lastUpdated: scrubbed.lastUpdated || new Date().toISOString(),
      readingLevel,
      auditId: result.auditId,
      disclaimer: DISCLAIMER,
      snapshot,
      fromCache: false,
    };

    summaryCache.set(cacheKey, { data: summaryResult, timestamp: Date.now() });
    saveSummaryToHistory(userId, summaryResult);

    try {
      await phiAuditService.logAccess({
        userId,
        action: "view",
        resourceType: "health_record",
        resourceId: `summary-${userId}`,
        dataClassification: "phi",
        accessReason: "patient_self_access",
        outcome: "success",
      });
    } catch (auditErr) {
      console.error("[PatientFriendlySummary] Audit log failed:", auditErr);
    }

    return summaryResult;
  } catch (error: any) {
    console.error("[PatientFriendlySummary] AI call failed:", error.message);

    const conditions = groupedRecords["condition"] || [];
    const labs = groupedRecords["lab"] || [];
    const vitals = groupedRecords["vital"] || [];

    const fallback = {
      overallStatus: "We were unable to generate an AI-powered summary at this time. Here is a basic overview of your health data.",
      statusSeverity: "fair" as const,
      conditions: conditions.map((c: any) => ({
        name: c.title || "Unknown",
        simplifiedExplanation: "Please ask your doctor for more details.",
        status: "active",
        urgency: "routine",
      })),
      medications: medications.map((m: any) => ({
        name: m.medicationName || "Unknown",
        purpose: "See your prescription details.",
        schedule: m.frequency || "As prescribed",
        importantNotes: m.instructions || "",
      })),
      upcomingAppointments: appointments.map((a: any) => ({
        type: a.appointmentType || "Appointment",
        provider: a.providerName || "Your provider",
        date: a.scheduledAt ? new Date(a.scheduledAt).toLocaleDateString() : "TBD",
        whatToExpect: "Contact your provider for details.",
        prepInstructions: "",
      })),
      recentResults: [...labs, ...vitals].slice(0, 5).map((r: any) => ({
        testName: r.title || "Test",
        result: r.summary || "See details",
        whatItMeans: "Please discuss with your healthcare provider.",
        status: "reviewed",
        trend: "stable",
      })),
      aiInsights: [],
      wellnessTips: [
        "Stay hydrated by drinking plenty of water throughout the day.",
        "Try to get at least 30 minutes of physical activity most days.",
        "Make sure to take your medications as prescribed by your doctor.",
      ],
      careGaps: [],
      lastUpdated: new Date().toISOString(),
      readingLevel,
      auditId: null,
      disclaimer: DISCLAIMER,
      snapshot: {
        totalRecords: records.length,
        conditionCount: conditions.length,
        activeMedications: medications.length,
        upcomingAppointmentCount: appointments.length,
        recentLabCount: labs.length,
        activeGoals: goals.length,
      },
      fromCache: false,
    };

    saveSummaryToHistory(userId, fallback);
    return fallback;
  }
}

export async function createPatientFriendlyVersion(
  professionalNote: string,
  patientContext: { userId: string; documentType?: string; diagnosisCodes?: string[] }
) {
  const scrubbedNote = scrubPII(professionalNote);

  const systemPrompt = `You are a medical interpreter embedded in a HIPAA-compliant patient health records platform called Tabula Medica.

TASK:
1. Strip ALL PII (patient names, ID numbers, provider full names, addresses, phone numbers, SSNs, MRNs, DOBs, email addresses, insurance IDs).
2. Rewrite the clinical findings into "Patient-Friendly" English (6th-grade reading level, Flesch-Kincaid Grade 6 or lower).
3. Map any "Reason for Medication Change" into a clear explanation a patient can understand.
4. Never diagnose, contradict a provider, or recommend starting/stopping medications.
5. Use empowering, calm language. When describing concerns, say "something to discuss with your doctor" rather than alarming language.

OUTPUT FORMAT (strict JSON, no markdown, no code fences):
{
  "headline": "A short, encouraging 1-sentence summary of the key takeaway",
  "what_happened": "A simple 2-4 sentence explanation of the clinical encounter or hospital stay in plain language",
  "medication_updates": ["Med Name: Why it was changed/added/stopped in plain language"],
  "next_steps": ["Specific actionable items: appointment dates, things to watch for, lifestyle changes"],
  "key_findings": ["Plain-language summaries of important test results or observations"],
  "warning_signs": ["Clear descriptions of symptoms that should prompt calling the doctor or going to the ER"],
  "questions_for_provider": ["Suggested questions the patient might want to ask at their next visit"]
}

RULES:
- Every field must contain complete, patient-friendly sentences.
- medication_updates: If no medication changes, return ["No medication changes were made."]
- warning_signs: Always include at least one general warning sign relevant to the context.
- questions_for_provider: Generate 2-3 relevant questions based on the clinical content.
- Include this disclaimer context: This summary is for informational purposes only and is not medical advice.`;

  const userPrompt = `Transform the following signed clinical note into a patient-friendly summary:

---
${scrubbedNote}
---

Document type: ${patientContext.documentType || "clinical note"}
${patientContext.diagnosisCodes?.length ? `Relevant diagnosis codes: ${patientContext.diagnosisCodes.join(", ")}` : ""}`;

  try {
    const result = await governedAICall({
      systemPrompt,
      userPrompt,
      purpose: "health_analytics",
      dataCategories: ["conditions", "medications", "lab_results"],
      callerService: "PatientFriendlyDeidentification",
      callerMethod: "createPatientFriendlyVersion",
      userId: patientContext.userId,
      model: "gpt-5.2",
      maxTokens: 2048,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(result.content);
    const scrubbed = scrubObjectPII(parsed);

    const patientVersion = {
      ...scrubbed,
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
      auditId: result.auditId,
      documentType: patientContext.documentType || "clinical_note",
    };

    try {
      await phiAuditService.logAccess({
        userId: patientContext.userId,
        action: "view",
        resourceType: "health_record",
        resourceId: `patient-friendly-${Date.now()}`,
        dataClassification: "phi",
        accessReason: "patient_self_access",
        outcome: "success",
      });
    } catch (auditErr) {
      console.error("[PatientFriendly] Audit log failed:", auditErr);
    }

    return patientVersion;
  } catch (error: any) {
    console.error("[PatientFriendly] AI de-identification failed:", error.message);
    return {
      headline: "Your clinical note summary is being prepared.",
      what_happened: "We were unable to automatically simplify this clinical note at this time. Please ask your care team for a plain-language explanation.",
      medication_updates: ["Please check with your pharmacist or doctor about any medication changes."],
      next_steps: ["Follow up with your healthcare provider for details about your visit."],
      key_findings: [],
      warning_signs: ["If you experience any severe symptoms, call 911 or visit your nearest emergency room."],
      questions_for_provider: ["Can you explain my recent visit results in simple terms?"],
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
      auditId: null,
      documentType: patientContext.documentType || "clinical_note",
      error: true,
    };
  }
}

const syncTimestamps = new Map<string, number>();
const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000;
const pendingWebhooks = new Map<string, boolean>();

export async function getPatientSnapshot(userId: string, options?: { forceSync?: boolean }) {
  const lastSync = syncTimestamps.get(userId) || 0;
  const now = Date.now();
  const isFresh = (now - lastSync) < FRESHNESS_THRESHOLD_MS && !options?.forceSync;
  const hasPendingWebhook = pendingWebhooks.get(userId) || false;

  if (isFresh && !hasPendingWebhook) {
    const cacheKey = `${userId}:simple`;
    const cached = summaryCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return {
        status: "fresh",
        lastSyncAt: new Date(lastSync).toISOString(),
        nextSyncAt: new Date(lastSync + FRESHNESS_THRESHOLD_MS).toISOString(),
        data: cached.data,
        syncTriggered: false,
      };
    }
  }

  const snapshot = await getQuickHealthSnapshot(userId);

  syncTimestamps.set(userId, now);
  pendingWebhooks.delete(userId);

  let patientSummary = null;
  const cacheKey = `${userId}:simple`;
  const cached = summaryCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    patientSummary = cached.data;
  }

  return {
    status: hasPendingWebhook ? "updated" : (isFresh ? "fresh" : "refreshed"),
    lastSyncAt: new Date(now).toISOString(),
    nextSyncAt: new Date(now + FRESHNESS_THRESHOLD_MS).toISOString(),
    data: {
      snapshot,
      summary: patientSummary,
    },
    syncTriggered: !isFresh || hasPendingWebhook,
  };
}

export function markWebhookPending(userId: string) {
  pendingWebhooks.set(userId, true);
}

export async function getQuickHealthSnapshot(userId: string) {
  const [records, medications, appointments, goals] = await Promise.all([
    storage.getHealthRecords(userId),
    storage.getActiveMedicationReminders(userId),
    storage.getUpcomingAppointments(userId),
    storage.getActiveHealthGoals(userId),
  ]);

  const recordsByType: Record<string, number> = {};
  for (const record of records) {
    const type = record.type || "other";
    recordsByType[type] = (recordsByType[type] || 0) + 1;
  }

  const recentRecords = records.slice(0, 5).map(r => ({
    title: r.title,
    type: r.type,
    date: r.date,
    summary: r.summary,
  }));

  const nextAppointment = appointments.length > 0 ? {
    type: appointments[0].appointmentType,
    provider: appointments[0].providerName,
    date: appointments[0].scheduledAt,
  } : null;

  return {
    totalRecords: records.length,
    recordsByType,
    activeMedications: medications.length,
    upcomingAppointments: appointments.length,
    activeGoals: goals.length,
    recentRecords,
    nextAppointment,
    lastUpdated: new Date().toISOString(),
  };
}
