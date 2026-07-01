// Fail-safe early-access signup queue.
//
// This module deliberately handles ONLY non-clinical contact/intent data
// (name, email, phone, role, optional organization) plus the consent record.
// It must never store PHI or any medical data.
//
// Flow (see SIGNUP_NOTES.md):
//   1. Persist to localStorage `tm_signup_queue` FIRST (never lose a lead).
//   2. Attempt delivery to a network endpoint (VITE_SIGNUP_ENDPOINT).
//   3. On failure / no endpoint, the entry stays queued and is retried on the
//      next app load via flushSignupQueue().

export const SIGNUP_QUEUE_KEY = "tm_signup_queue";

export const CONSENT_TEXT =
  "I consent to Tabula Medica contacting me about this service and storing the information I provide. I understand this is an early-access sign-up, not medical advice, and that no doctor–patient relationship is created. I can withdraw at any time.";

export type SignupRole = "patient" | "provider";

export interface SignupEntry {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: SignupRole;
  organization?: string;
  consent: true;
  consentText: string;
  submittedAt: string;
  status: "queued" | "sent";
}

// Resolve the delivery endpoint. There is no generic lead/signup API in this
// codebase (the only /patient-signup route is a discount-membership stub), so
// we fall back to the configured VITE_SIGNUP_ENDPOINT when present.
function getEndpoint(): string {
  const raw = import.meta.env.VITE_SIGNUP_ENDPOINT as string | undefined;
  return typeof raw === "string" ? raw.trim() : "";
}

export function readSignupQueue(): SignupEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SIGNUP_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SignupEntry[]) : [];
  } catch {
    return [];
  }
}

function writeSignupQueue(entries: SignupEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SIGNUP_QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full / unavailable — nothing more we can safely do here.
  }
}

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SignupInput {
  fullName: string;
  email: string;
  phone: string;
  role: SignupRole;
  organization?: string;
}

// Step 1: persist locally FIRST and return the stored entry.
export function enqueueSignup(input: SignupInput): SignupEntry {
  const entry: SignupEntry = {
    id: makeId(),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    role: input.role,
    organization: input.organization?.trim() || undefined,
    consent: true,
    consentText: CONSENT_TEXT,
    submittedAt: new Date().toISOString(),
    status: "queued",
  };
  const queue = readSignupQueue();
  queue.push(entry);
  writeSignupQueue(queue);
  return entry;
}

async function sendEntry(entry: SignupEntry, endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: entry.fullName,
        email: entry.email,
        phone: entry.phone,
        role: entry.role,
        organization: entry.organization ?? null,
        consent: entry.consent,
        consentText: entry.consentText,
        submittedAt: entry.submittedAt,
        source: "early-access-signup",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function markSent(id: string): void {
  const queue = readSignupQueue().map((e) =>
    e.id === id ? { ...e, status: "sent" as const } : e,
  );
  writeSignupQueue(queue);
}

// Attempt delivery of a single (already-queued) entry. Returns true if the
// remote endpoint accepted it; false means it stays queued for later retry.
export async function trySendSignup(entry: SignupEntry): Promise<boolean> {
  const endpoint = getEndpoint();
  if (!endpoint) return false;
  const ok = await sendEntry(entry, endpoint);
  if (ok) markSent(entry.id);
  return ok;
}

// Step 3 (retry): flush any still-queued entries. Safe to call on every load.
export async function flushSignupQueue(): Promise<void> {
  const endpoint = getEndpoint();
  if (!endpoint) return;
  const pending = readSignupQueue().filter((e) => e.status === "queued");
  for (const entry of pending) {
    // Sequential to avoid hammering the endpoint; failures simply remain queued.
    // eslint-disable-next-line no-await-in-loop
    await sendEntry(entry, endpoint).then((ok) => {
      if (ok) markSent(entry.id);
    });
  }
}

// Build a prefilled mailto: fallback so a lead is never lost even with no
// endpoint. Contains only contact/intent data — never PHI.
export function buildSignupMailto(entry: SignupEntry): string {
  const to = "hello@tabulamedica.us";
  const subject = "Early-access sign-up — Tabula Medica";
  const roleLabel =
    entry.role === "provider" ? "Provider / Clinician" : "Patient / Member";
  const lines = [
    `Full name: ${entry.fullName}`,
    `Email: ${entry.email}`,
    `Phone: ${entry.phone}`,
    `Role: ${roleLabel}`,
  ];
  if (entry.organization) lines.push(`Practice / organization: ${entry.organization}`);
  lines.push("");
  lines.push(`Consent: ${entry.consentText}`);
  lines.push(`Submitted: ${entry.submittedAt}`);
  const body = lines.join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Lightweight validators (shared with the form).
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
