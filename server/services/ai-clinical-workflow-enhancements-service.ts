import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiInstance) {
    try {
      openaiInstance = new OpenAI();
    } catch {
      console.log("[ClinicalWorkflowEnhancements] OpenAI client not configured, using rule-based fallback");
      return null;
    }
  }
  return openaiInstance;
}

export interface PatientContext {
  patientId: string;
  name: string;
  age?: number;
  gender?: string;
  conditions: Array<{ name: string; status: string; onsetDate?: string }>;
  medications: Array<{ name: string; dosage?: string; frequency?: string; status: string }>;
  allergies: Array<{ name: string; severity?: string; reaction?: string }>;
  labResults: Array<{ testName: string; value: string; unit?: string; referenceRange?: string; date: string; isCritical?: boolean }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string }>;
}

export interface FollowUpSuggestion {
  id: string;
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  category: "lab" | "appointment" | "medication" | "referral" | "screening" | "monitoring";
  suggestedDueDate?: string;
  patientId: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

export interface ClinicalDraft {
  id: string;
  patientId: string;
  type: "clinical_note" | "referral_letter";
  title: string;
  content: string;
  summary: string;
  status: "draft" | "finalized" | "discarded";
  createdAt: string;
}

export interface SmartAlert {
  id: string;
  patientId: string;
  alertType: "critical_lab" | "vital_trend" | "medication_interaction" | "overdue_screening" | "deterioration";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  triggerData: Record<string, any>;
  status: "active" | "acknowledged" | "resolved";
  createdAt: string;
}

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated content is for informational purposes only and does not constitute clinical decision support, medical advice, or a substitute for professional clinical judgment. All suggestions must be independently reviewed and verified by a qualified healthcare provider before any clinical action is taken.";

function generateId(): string {
  return `cwf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRuleBasedAlerts(ctx: PatientContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = new Date().toISOString();

  for (const lab of ctx.labResults) {
    if (lab.isCritical) {
      alerts.push({
        id: generateId(),
        patientId: ctx.patientId,
        alertType: "critical_lab",
        severity: "critical",
        title: `Critical Lab Result: ${lab.testName}`,
        message: `${lab.testName} value of ${lab.value} ${lab.unit || ""} is outside the normal reference range${lab.referenceRange ? ` (${lab.referenceRange})` : ""}. Dated ${lab.date}. Immediate clinical review recommended.`,
        triggerData: { testName: lab.testName, value: lab.value, unit: lab.unit, referenceRange: lab.referenceRange },
        status: "active",
        createdAt: now,
      });
    }
  }

  const systolicReadings = ctx.vitals
    .filter(v => v.type.toLowerCase().includes("systolic") || v.type.toLowerCase().includes("blood pressure"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  if (systolicReadings.length >= 2) {
    const highCount = systolicReadings.filter(v => v.value > 140).length;
    if (highCount >= 2) {
      alerts.push({
        id: generateId(),
        patientId: ctx.patientId,
        alertType: "vital_trend",
        severity: "warning",
        title: "Elevated Blood Pressure Trend",
        message: `${highCount} of the last ${systolicReadings.length} systolic blood pressure readings exceeded 140 mmHg. Consider blood pressure management review.`,
        triggerData: { readings: systolicReadings },
        status: "active",
        createdAt: now,
      });
    }
  }

  const glucoseReadings = ctx.labResults
    .filter(l => l.testName.toLowerCase().includes("glucose") || l.testName.toLowerCase().includes("hba1c") || l.testName.toLowerCase().includes("a1c"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (glucoseReadings.length > 0) {
    const latest = glucoseReadings[0];
    const val = parseFloat(latest.value);
    if (latest.testName.toLowerCase().includes("a1c") && val > 7.0) {
      alerts.push({
        id: generateId(),
        patientId: ctx.patientId,
        alertType: "deterioration",
        severity: "warning",
        title: "Elevated HbA1c Level",
        message: `Latest HbA1c is ${latest.value}% (target typically <7%). Consider reviewing diabetes management plan.`,
        triggerData: { testName: latest.testName, value: latest.value, date: latest.date },
        status: "active",
        createdAt: now,
      });
    }
  }

  return alerts;
}

function getRuleBasedSuggestions(ctx: PatientContext): FollowUpSuggestion[] {
  const suggestions: FollowUpSuggestion[] = [];
  const now = new Date().toISOString();
  const twoWeeksFromNow = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const oneMonthFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const criticalLabs = ctx.labResults.filter(l => l.isCritical);
  if (criticalLabs.length > 0) {
    suggestions.push({
      id: generateId(),
      title: `Schedule follow-up lab for ${ctx.name}`,
      rationale: `Patient has ${criticalLabs.length} critical lab result(s): ${criticalLabs.map(l => l.testName).join(", ")}. Follow-up testing recommended to monitor changes.`,
      priority: "high",
      category: "lab",
      suggestedDueDate: twoWeeksFromNow,
      patientId: ctx.patientId,
      status: "pending",
      createdAt: now,
    });
  }

  const hasDiabetes = ctx.conditions.some(c => c.name.toLowerCase().includes("diabetes"));
  const hasRecentA1c = ctx.labResults.some(l =>
    (l.testName.toLowerCase().includes("a1c") || l.testName.toLowerCase().includes("hba1c")) &&
    (Date.now() - new Date(l.date).getTime()) < 90 * 86400000
  );
  if (hasDiabetes && !hasRecentA1c) {
    suggestions.push({
      id: generateId(),
      title: `Order HbA1c test for ${ctx.name}`,
      rationale: "Patient has diabetes but no HbA1c result in the last 90 days. Guidelines recommend HbA1c monitoring every 3 months for active management.",
      priority: "medium",
      category: "lab",
      suggestedDueDate: twoWeeksFromNow,
      patientId: ctx.patientId,
      status: "pending",
      createdAt: now,
    });
  }

  const activeMeds = ctx.medications.filter(m => m.status === "active");
  if (activeMeds.length >= 5) {
    suggestions.push({
      id: generateId(),
      title: `Medication reconciliation for ${ctx.name}`,
      rationale: `Patient is on ${activeMeds.length} active medications. Consider medication reconciliation to check for interactions, duplicates, or unnecessary prescriptions.`,
      priority: "medium",
      category: "medication",
      suggestedDueDate: oneMonthFromNow,
      patientId: ctx.patientId,
      status: "pending",
      createdAt: now,
    });
  }

  return suggestions;
}

export async function generateFollowUpSuggestions(ctx: PatientContext): Promise<{ suggestions: FollowUpSuggestion[]; disclaimer: string }> {
  const ruleBased = getRuleBasedSuggestions(ctx);

  try {
    const client = getOpenAI();
    if (!client) return { suggestions: ruleBased, disclaimer: NO_CDS_DISCLAIMER };
    const contextSummary = buildContextSummary(ctx);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a clinical workflow assistant. Analyze patient data and suggest follow-up tasks for the care team. Return a JSON object with a "suggestions" array. Each suggestion should have: title (actionable task), rationale (clinical reasoning), priority ("high"|"medium"|"low"), category ("lab"|"appointment"|"medication"|"referral"|"screening"|"monitoring"), suggestedDueDate (ISO date string). Focus on evidence-based recommendations. Do NOT provide diagnoses or treatment decisions. This is informational only (NO-CDS compliant).`
        },
        { role: "user", content: contextSummary }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const rawSuggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
      const aiSuggestions: FollowUpSuggestion[] = rawSuggestions.slice(0, 6).map((s: any) => ({
        id: generateId(),
        title: s.title || "Follow-up task",
        rationale: s.rationale || s.reasoning || "",
        priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
        category: ["lab", "appointment", "medication", "referral", "screening", "monitoring"].includes(s.category) ? s.category : "monitoring",
        suggestedDueDate: s.suggestedDueDate || s.dueDate,
        patientId: ctx.patientId,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }));

      const combined = deduplicateSuggestions([...ruleBased, ...aiSuggestions]);
      return { suggestions: combined, disclaimer: NO_CDS_DISCLAIMER };
    }
  } catch (e) {
    console.log("[ClinicalWorkflow] AI suggestion generation unavailable, using rule-based fallback");
  }

  return { suggestions: ruleBased, disclaimer: NO_CDS_DISCLAIMER };
}

export async function generateClinicalDraft(
  ctx: PatientContext,
  draftType: "clinical_note" | "referral_letter",
  additionalInstructions?: string
): Promise<{ draft: ClinicalDraft; disclaimer: string }> {
  const contextSummary = buildContextSummary(ctx);
  const now = new Date().toISOString();

  const systemPrompt = draftType === "clinical_note"
    ? `You are a clinical documentation assistant. Generate a draft clinical note (SOAP format) from the structured patient data provided. Include: Subjective (based on conditions/symptoms), Objective (vitals, labs), Assessment (summary of findings), Plan (suggested next steps). This is a DRAFT for provider review only - NOT a final clinical document. Mark clearly as DRAFT. Do NOT provide diagnoses or treatment decisions.`
    : `You are a clinical documentation assistant. Generate a draft referral letter from the structured patient data provided. Include: Patient demographics, reason for referral, relevant medical history, current medications, recent lab/vital findings, and specific questions for the specialist. This is a DRAFT for provider review only - NOT a final clinical document. Mark clearly as DRAFT. Do NOT provide diagnoses or treatment decisions.`;

  const userPrompt = additionalInstructions
    ? `${contextSummary}\n\nAdditional instructions: ${additionalInstructions}`
    : contextSummary;

  let content = "";
  let summary = "";

  try {
    const client = getOpenAI();
    if (!client) throw new Error("OpenAI not configured");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 1500,
    });

    content = response.choices[0]?.message?.content || "";
    summary = content.substring(0, 200) + (content.length > 200 ? "..." : "");
  } catch (e) {
    console.log("[ClinicalWorkflow] AI draft generation unavailable, using template fallback");
    if (draftType === "clinical_note") {
      content = buildFallbackNote(ctx);
    } else {
      content = buildFallbackReferral(ctx);
    }
    summary = `${draftType === "clinical_note" ? "Clinical Note" : "Referral Letter"} draft for ${ctx.name} (template-based)`;
  }

  const draft: ClinicalDraft = {
    id: generateId(),
    patientId: ctx.patientId,
    type: draftType,
    title: draftType === "clinical_note"
      ? `Clinical Note - ${ctx.name} - ${new Date().toLocaleDateString()}`
      : `Referral Letter - ${ctx.name} - ${new Date().toLocaleDateString()}`,
    content,
    summary,
    status: "draft",
    createdAt: now,
  };

  return { draft, disclaimer: NO_CDS_DISCLAIMER };
}

export async function generateSmartAlerts(ctx: PatientContext): Promise<{ alerts: SmartAlert[]; disclaimer: string }> {
  const ruleAlerts = getRuleBasedAlerts(ctx);

  try {
    const client = getOpenAI();
    if (!client) return { alerts: ruleAlerts, disclaimer: NO_CDS_DISCLAIMER };
    const contextSummary = buildContextSummary(ctx);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a clinical safety monitoring assistant. Analyze patient data for critical changes and concerning patterns. Return a JSON object with an "alerts" array. Each alert should have: alertType ("critical_lab"|"vital_trend"|"medication_interaction"|"overdue_screening"|"deterioration"), severity ("critical"|"warning"|"info"), title (brief description), message (detailed explanation with data points). Focus on patient safety. This is informational only (NO-CDS compliant) - all alerts must be verified by a clinician.`
        },
        { role: "user", content: contextSummary }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const rawAlerts = Array.isArray(parsed) ? parsed : (parsed.alerts || []);
      const aiAlerts: SmartAlert[] = rawAlerts.slice(0, 8).map((a: any) => ({
        id: generateId(),
        patientId: ctx.patientId,
        alertType: ["critical_lab", "vital_trend", "medication_interaction", "overdue_screening", "deterioration"].includes(a.alertType)
          ? a.alertType : "deterioration",
        severity: ["critical", "warning", "info"].includes(a.severity) ? a.severity : "warning",
        title: a.title || "Clinical Alert",
        message: a.message || "",
        triggerData: a.triggerData || {},
        status: "active" as const,
        createdAt: new Date().toISOString(),
      }));

      const combined = deduplicateAlerts([...ruleAlerts, ...aiAlerts]);
      return { alerts: combined, disclaimer: NO_CDS_DISCLAIMER };
    }
  } catch (e) {
    console.log("[ClinicalWorkflow] AI alert generation unavailable, using rule-based fallback");
  }

  return { alerts: ruleAlerts, disclaimer: NO_CDS_DISCLAIMER };
}

function buildContextSummary(ctx: PatientContext): string {
  const parts: string[] = [];
  parts.push(`Patient: ${ctx.name}${ctx.age ? `, Age: ${ctx.age}` : ""}${ctx.gender ? `, Gender: ${ctx.gender}` : ""}`);

  if (ctx.conditions.length > 0) {
    parts.push(`Active Conditions: ${ctx.conditions.map(c => `${c.name} (${c.status})`).join("; ")}`);
  }
  if (ctx.medications.length > 0) {
    parts.push(`Medications: ${ctx.medications.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""} (${m.status})`).join("; ")}`);
  }
  if (ctx.allergies.length > 0) {
    parts.push(`Allergies: ${ctx.allergies.map(a => `${a.name}${a.severity ? ` (${a.severity})` : ""}`).join("; ")}`);
  }
  if (ctx.labResults.length > 0) {
    const recentLabs = ctx.labResults.slice(0, 10);
    parts.push(`Recent Labs: ${recentLabs.map(l => `${l.testName}: ${l.value} ${l.unit || ""} (${l.date})${l.isCritical ? " [CRITICAL]" : ""}`).join("; ")}`);
  }
  if (ctx.vitals.length > 0) {
    const recentVitals = ctx.vitals.slice(0, 10);
    parts.push(`Recent Vitals: ${recentVitals.map(v => `${v.type}: ${v.value} ${v.unit} (${v.date})`).join("; ")}`);
  }

  return parts.join("\n");
}

function buildFallbackNote(ctx: PatientContext): string {
  return `**DRAFT CLINICAL NOTE**\n\n**Patient:** ${ctx.name}\n**Date:** ${new Date().toLocaleDateString()}\n\n**S (Subjective):**\nActive conditions: ${ctx.conditions.map(c => c.name).join(", ") || "None documented"}\nAllergies: ${ctx.allergies.map(a => a.name).join(", ") || "NKDA"}\n\n**O (Objective):**\nVitals: ${ctx.vitals.slice(0, 5).map(v => `${v.type}: ${v.value} ${v.unit}`).join(", ") || "Not available"}\nRecent Labs: ${ctx.labResults.slice(0, 5).map(l => `${l.testName}: ${l.value} ${l.unit || ""}`).join(", ") || "Not available"}\n\n**A (Assessment):**\n[Provider assessment required]\n\n**P (Plan):**\nCurrent medications: ${ctx.medications.filter(m => m.status === "active").map(m => m.name).join(", ") || "None"}\n[Provider plan required]\n\n---\n*DRAFT - Requires provider review and finalization*`;
}

function buildFallbackReferral(ctx: PatientContext): string {
  return `**DRAFT REFERRAL LETTER**\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**Re: ${ctx.name}**${ctx.age ? `, Age ${ctx.age}` : ""}${ctx.gender ? `, ${ctx.gender}` : ""}\n\n**Dear Colleague,**\n\nI am writing to refer the above patient for specialist evaluation.\n\n**Reason for Referral:**\n[Please specify]\n\n**Medical History:**\n${ctx.conditions.map(c => `- ${c.name} (${c.status})`).join("\n") || "- No significant history documented"}\n\n**Current Medications:**\n${ctx.medications.filter(m => m.status === "active").map(m => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join("\n") || "- None"}\n\n**Allergies:**\n${ctx.allergies.map(a => `- ${a.name}${a.severity ? ` (${a.severity})` : ""}`).join("\n") || "- NKDA"}\n\n**Recent Investigations:**\n${ctx.labResults.slice(0, 5).map(l => `- ${l.testName}: ${l.value} ${l.unit || ""} (${l.date})`).join("\n") || "- None available"}\n\n**Questions for Specialist:**\n1. [Please specify]\n\nThank you for seeing this patient.\n\n**Referring Provider:**\n[Name and credentials]\n\n---\n*DRAFT - Requires provider review and finalization*`;
}

function deduplicateSuggestions(suggestions: FollowUpSuggestion[]): FollowUpSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = s.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateAlerts(alerts: SmartAlert[]): SmartAlert[] {
  const seen = new Set<string>();
  return alerts.filter(a => {
    const key = `${a.alertType}-${a.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
