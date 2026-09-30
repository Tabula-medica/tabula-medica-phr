// Jarvis command routing. Runs entirely in the browser: the user's command is
// matched against keyword lists locally and never leaves the device unless it
// falls through to the Vertex-backed health assistant chat.

export type JarvisSkillId =
  | "symptoms"
  | "interactions"
  | "drugSavings"
  | "visitSummary"
  | "scribe"
  | "evidence"
  | "priorAuth"
  | "careGaps"
  | "screening"
  | "translate"
  | "freeCare"
  | "timeline"
  | "documents";

export interface JarvisSkill {
  id: JarvisSkillId;
  route: string;
  keywords: string[];
}

// Order matters only for ties; the highest keyword score wins.
export const JARVIS_SKILLS: JarvisSkill[] = [
  { id: "symptoms", route: "/symptom-checker", keywords: ["symptom", "pain", "fever", "cough", "headache", "nausea", "dizzy", "rash", "hurts", "feel sick"] },
  { id: "interactions", route: "/drug-interactions", keywords: ["interaction", "interact", "mix", "combine", "together with", "safe to take"] },
  { id: "drugSavings", route: "/drug-savings", keywords: ["coupon", "cheaper", "cost of", "price", "savings", "afford", "goodrx"] },
  { id: "visitSummary", route: "/visit-summary", keywords: ["visit summary", "after visit", "appointment summary", "what did my doctor"] },
  { id: "scribe", route: "/medical-scribe", keywords: ["scribe", "record my visit", "transcribe", "dictate"] },
  { id: "evidence", route: "/ai-health-advisor", keywords: ["research", "evidence", "study", "studies", "guideline"] },
  { id: "priorAuth", route: "/prior-auth-letter", keywords: ["prior auth", "prior authorization", "denied", "appeal", "insurance letter"] },
  { id: "careGaps", route: "/care-gaps", keywords: ["care gap", "overdue", "missing care", "due for"] },
  { id: "screening", route: "/preventive-screening", keywords: ["screening", "mammogram", "colonoscopy", "vaccine", "checkup", "preventive"] },
  { id: "translate", route: "/document-translation", keywords: ["translate", "translation", "another language"] },
  { id: "freeCare", route: "/find-free-care", keywords: ["free clinic", "free care", "uninsured", "no insurance", "sliding scale"] },
  { id: "timeline", route: "/timeline", keywords: ["timeline", "history", "past visits"] },
  { id: "documents", route: "/documents", keywords: ["document", "upload", "pdf", "lab report", "my files"] },
];

export type JarvisIntent =
  | { kind: "navigate"; skill: JarvisSkill; score: number }
  | { kind: "ask"; question: string }
  | { kind: "empty" };

// Explicit "open X" / "go to X" phrasing lowers the bar to a single keyword hit;
// questions ("what", "why", "?") need two hits before we navigate away from chat.
const NAV_VERBS = /^(open|go to|show|take me to|launch|start|find)\b/;
const QUESTION = /\?\s*$|^(what|why|how|when|should|can|is|are|do|does)\b/;

export function normalizeCommand(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function routeCommand(text: string): JarvisIntent {
  const cmd = normalizeCommand(text);
  if (!cmd) return { kind: "empty" };

  let best: { skill: JarvisSkill; score: number } | null = null;
  for (const skill of JARVIS_SKILLS) {
    const score = skill.keywords.reduce((n, kw) => (cmd.includes(kw) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { skill, score };
  }

  if (!best) return { kind: "ask", question: text.trim() };

  const threshold = NAV_VERBS.test(cmd) ? 1 : QUESTION.test(cmd) ? 2 : 1;
  if (best.score >= threshold) return { kind: "navigate", ...best };
  return { kind: "ask", question: text.trim() };
}

export function greetingKey(hour: number): "jarvis.greeting.morning" | "jarvis.greeting.afternoon" | "jarvis.greeting.evening" {
  if (hour < 12) return "jarvis.greeting.morning";
  if (hour < 18) return "jarvis.greeting.afternoon";
  return "jarvis.greeting.evening";
}
