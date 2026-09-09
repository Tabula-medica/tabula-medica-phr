// Voice RCM — intent parsing for spoken billing commands (from the existing GCP medical STT
// path) and short, speakable responses (for the existing Google TTS path). Deterministic;
// no PHI leaves the process here. Ambient-scribe → charge capture is wired via
// charge-capture.ts (parseVoiceCharge) and coding.ts (levelEm / AI suggestion).
import { parseVoiceCharge, type VoiceChargeCommand } from "./charge-capture";
import type { WorkQueue } from "./types";

export type VoiceIntent =
  | { type: "charge-capture"; commands: VoiceChargeCommand[] }
  | { type: "level-visit"; timeMinutes?: number; newPatient?: boolean }
  | { type: "check-eligibility"; patientRef?: string }
  | { type: "start-prior-auth"; cpt?: string }
  | { type: "open-queue"; queue: WorkQueue }
  | { type: "next-item" }
  | { type: "denial-note"; note: string }
  | { type: "appeal-denial"; claimRef?: string }
  | { type: "collect-copay"; amount?: number }
  | { type: "payment-plan"; months?: number; amount?: number }
  | { type: "kpi-readout"; kpi?: string }
  | { type: "run-agent"; agent: string }
  | { type: "unknown"; transcript: string };

const QUEUE_WORDS: Array<[RegExp, WorkQueue]> = [
  [/eligib/i, "eligibility"],
  [/prior[- ]?auth|authorization/i, "prior-auth"],
  [/charge review|missing charges?/i, "charge-review"],
  [/coding/i, "coding-review"],
  [/claim edits?|scrub/i, "claim-edits"],
  [/follow[- ]?up|unpaid claims?|outstanding claims?/i, "claim-followup"],
  [/denial/i, "denials"],
  [/underpay/i, "underpayments"],
  [/patient balance|statements?|collections?/i, "patient-balance"],
  [/credit balance|refund/i, "credit-balance"],
  [/approval|approve/i, "agent-approval"],
];

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, thirty: 30, forty: 40, sixty: 60 };
function num(s?: string): number | undefined { if (!s) return undefined; const n = parseFloat(s.replace(/,/g, "")); return Number.isFinite(n) ? n : NUM[s.toLowerCase()]; }

export function parseVoiceIntent(transcript: string): VoiceIntent {
  const t = transcript.trim();
  const l = t.toLowerCase();
  if (/^(add|bill|charge|capture)\b/.test(l) || /\b(add|bill|charge)\s+(cpt\s+)?\d{5}\b/.test(l) || /\bmodifier\b/.test(l) && /\d{5}/.test(l)) {
    const commands = parseVoiceCharge(t);
    if (commands.length) return { type: "charge-capture", commands };
  }
  if (/level (this |the )?visit|what level|e ?and ?m level|em level/.test(l)) {
    const time = l.match(/(\d+|[a-z]+)\s+minutes?/);
    return { type: "level-visit", timeMinutes: num(time?.[1]), newPatient: /new patient/.test(l) ? true : /established/.test(l) ? false : undefined };
  }
  if (/eligib|verify (the )?insurance|check (the )?(insurance|coverage|benefits)/.test(l)) return { type: "check-eligibility", patientRef: l.match(/for ([a-z .'-]+)$/)?.[1]?.trim() };
  if (/(start|submit|request|begin) (a |the )?(prior[- ]?auth|authorization)/.test(l)) return { type: "start-prior-auth", cpt: t.match(/\b(\d{5}|[A-Z]\d{4})\b/)?.[1]?.toUpperCase() };
  if (/^(next|next item|skip|what'?s next)/.test(l)) return { type: "next-item" };
  if (/(open|show|go to|pull up) (the |my )?/.test(l) || /queue|work ?list/.test(l)) {
    for (const [re, q] of QUEUE_WORDS) if (re.test(l)) return { type: "open-queue", queue: q };
  }
  if (/^(note|add note|denial note|document)[:,]?\s+/.test(l)) return { type: "denial-note", note: t.replace(/^(note|add note|denial note|document)[:,]?\s+/i, "") };
  if (/appeal/.test(l)) return { type: "appeal-denial", claimRef: t.match(/claim\s+([A-Za-z0-9_-]+)/i)?.[1] };
  if (/collect|copay|co-pay|take payment/.test(l)) { const m = l.match(/\$?\s?(\d+(?:\.\d{1,2})?)\s*(dollars)?/); return { type: "collect-copay", amount: m ? parseFloat(m[1]) : undefined }; }
  if (/payment plan|installments?/.test(l)) { const months = num(l.match(/(\d+|[a-z]+)\s+months?/)?.[1]); const amt = l.match(/\$\s?(\d+(?:\.\d{1,2})?)/); return { type: "payment-plan", months, amount: amt ? parseFloat(amt[1]) : undefined }; }
  if (/days in a ?r|denial rate|clean claim|collection rate|kpi|how (is|are) (our|the) (revenue|a ?r|billing)|dashboard/.test(l)) { const kpi = /days in a ?r/.test(l) ? "days_in_ar" : /denial rate/.test(l) ? "denial_rate" : /clean claim/.test(l) ? "clean_claim_rate" : /collection rate/.test(l) ? "net_collection_rate" : undefined; return { type: "kpi-readout", kpi }; }
  if (/run (the )?([a-z -]+) agent/.test(l)) return { type: "run-agent", agent: l.match(/run (the )?([a-z -]+) agent/)![2].trim().replace(/\s+/g, "-") };
  return { type: "unknown", transcript: t };
}

// Speakable confirmations (≤ 2 sentences; TTS-friendly; never reads back full PHI).
export function speakIntent(intent: VoiceIntent): string {
  switch (intent.type) {
    case "charge-capture": return `Captured ${intent.commands.length} charge${intent.commands.length === 1 ? "" : "s"}: ${intent.commands.map((c) => `${c.cpt}${c.modifiers.length ? " with modifier " + c.modifiers.join(" and ") : ""}${c.units > 1 ? ` times ${c.units}` : ""}`).join(", ")}. Say "confirm" to add them to the claim.`;
    case "level-visit": return intent.timeMinutes ? `Leveling by total time of ${intent.timeMinutes} minutes.` : "Leveling by medical decision making from the note.";
    case "check-eligibility": return "Running a real-time eligibility check now.";
    case "start-prior-auth": return intent.cpt ? `Starting a prior authorization request for ${intent.cpt}.` : "Which procedure code needs authorization?";
    case "open-queue": return `Opening the ${intent.queue.replace(/-/g, " ")} queue.`;
    case "next-item": return "Moving to the next item.";
    case "denial-note": return "Note added to the denial.";
    case "appeal-denial": return "Drafting the appeal letter from the claim and denial facts for your review.";
    case "collect-copay": return intent.amount ? `Collecting ${intent.amount.toFixed(2)} dollars.` : "How much should I collect?";
    case "payment-plan": return intent.months ? `Setting up a ${intent.months} month payment plan.` : "How many months for the payment plan?";
    case "kpi-readout": return "Reading the revenue cycle numbers.";
    case "run-agent": return `Running the ${intent.agent.replace(/-/g, " ")} agent. Actions that move money will wait for your approval.`;
    default: return "I did not catch that. You can say things like: add 99214 with modifier 25, open the denials queue, or check eligibility.";
  }
}

export function speakKpis(kpis: Array<{ key: string; name: string; value: number; unit: string; status: string }>, only?: string): string {
  const rows = only ? kpis.filter((k) => k.key === only) : kpis.filter((k) => ["days_in_ar", "denial_rate", "clean_claim_rate", "net_collection_rate"].includes(k.key));
  if (!rows.length) return "No metrics available yet.";
  return rows.map((k) => `${k.name} is ${k.unit === "pct" ? `${k.value} percent` : k.unit === "usd" ? `${k.value} dollars` : `${k.value} ${k.unit}`}${k.status === "good" ? "" : `, ${k.status}`}`).join(". ") + ".";
}
