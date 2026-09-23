// Small pure helpers shared by the RCM modules.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Adds `days` business days (Mon-Fri; no federal-holiday calendar) to `iso`. Used for No
// Surprises Act deadlines, which are expressed in business days, not calendar days.
export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

// Counts business days strictly after `fromIso` up to and including `toIso`. Used to measure
// NSA lead time (e.g. "is the visit 10+ business days out") in the same units as the deadline
// itself — a calendar-day count can put an appointment in the wrong lead-time bracket.
// Closed-form rather than a day-by-day loop: a caller-supplied `toIso` far in the future (a
// malformed date, or a deliberately huge one) would otherwise force millions of synchronous
// iterations and block the event loop.
export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return 0;
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;
  // The remaining < 7 days, walked starting the day after `from` — periodic every 7 days, so
  // whichever end the leftover falls on gives the same total as the day-by-day count did.
  let dow = (from.getUTCDay() + 1) % 7;
  for (let i = 0; i < totalDays % 7; i++) {
    if (dow !== 0 && dow !== 6) count++;
    dow = (dow + 1) % 7;
  }
  return count;
}

export function ageOn(dob: string, onIso: string): number {
  const d = new Date(dob);
  const t = new Date(onIso);
  let age = t.getUTCFullYear() - d.getUTCFullYear();
  const m = t.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && t.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

// NPI check digit — Luhn over the 10 digits with the "80840" prefix.
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ("80840" + npi).split("").map(Number);
  let sum = 0;
  for (let i = digits.length - 1, alt = false; i >= 0; i--, alt = !alt) {
    let d = digits[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function isValidIcd10(code: string): boolean {
  // The leading-letter range must include U — CDC-added provisional codes (U07.1 COVID-19,
  // U09.9 post-COVID condition) are valid, billable ICD-10-CM codes.
  return /^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(code.toUpperCase());
}

export function isValidCpt(code: string): boolean {
  return /^(\d{5}|[A-Z]\d{4}|\d{4}[A-Z])$/.test(code.toUpperCase());
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sum(nums: number[]): number {
  return round2(nums.reduce((a, b) => a + b, 0));
}
