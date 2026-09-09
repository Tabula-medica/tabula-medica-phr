// Stage 5: charge capture — turns a signed encounter (note + orders + procedures) into service
// lines, detects missing/late charges, and parses voice charge commands. Fees come from the
// practice fee schedule (charge master) with the reference table as fallback.
import type { Diagnosis, ServiceLine } from "./types";
import { feeRow, FEE_SCHEDULE } from "./reference-data";
import { isValidCpt, isValidIcd10, newId, round2, daysBetween } from "./util";

export interface EncounterFacts {
  encounterId: string;
  patientId: string;
  dateOfService: string;
  placeOfService: string;
  renderingNpi: string;
  newPatient: boolean;
  telehealth?: boolean;
  signedAt?: string;
  emLevel?: 1 | 2 | 3 | 4 | 5; // from coding.ts leveling
  proceduresDocumented: string[]; // CPT codes documented in the note
  ordersCompleted: string[]; // CPT codes for in-office orders performed (labs, ECG, injections)
  vaccinesGiven: number;
  diagnoses: Diagnosis[];
  timeMinutes?: number;
  visitComplexityAddOn?: boolean; // G2211
  existingCharges?: ServiceLine[];
}

export interface ChargeMaster { charges: Record<string, number>; multiplierOverReference?: number }
export const DEFAULT_CHARGE_MASTER: ChargeMaster = { charges: {}, multiplierOverReference: 2.5 };

export function chargeFor(cpt: string, cm: ChargeMaster = DEFAULT_CHARGE_MASTER): number {
  const explicit = cm.charges[cpt.toUpperCase()];
  if (explicit !== undefined) return explicit;
  const ref = feeRow(cpt)?.medicareAllowed;
  return ref !== undefined ? round2(ref * (cm.multiplierOverReference ?? 2.5)) : 0;
}

export function emCodeFor(level: 1 | 2 | 3 | 4 | 5, newPatient: boolean): string {
  return newPatient ? `9920${Math.max(2, level)}` : `9921${level}`;
}

function line(cpt: string, facts: EncounterFacts, cm: ChargeMaster, dxPointers: number[], modifiers: string[] = [], units = 1): ServiceLine {
  return {
    id: newId("ln"),
    cpt: cpt.toUpperCase(),
    description: feeRow(cpt)?.description,
    modifiers,
    units,
    charge: round2(chargeFor(cpt, cm) * units),
    dxPointers,
    dateOfService: facts.dateOfService,
    placeOfService: facts.telehealth ? "10" : facts.placeOfService,
    renderingNpi: facts.renderingNpi,
  };
}

// Deterministic charge derivation. Modifier logic: -25 on E/M when a same-day procedure is
// billed; -95 for telehealth; vaccine admin 90471 + 90472×(n-1).
export function deriveCharges(facts: EncounterFacts, cm: ChargeMaster = DEFAULT_CHARGE_MASTER): ServiceLine[] {
  const allDx = facts.diagnoses.map((_, i) => i + 1).slice(0, 4);
  const primaryDx = allDx.length ? [1] : [];
  const out: ServiceLine[] = [];
  const procedures = Array.from(new Set([...facts.proceduresDocumented, ...facts.ordersCompleted].map((c) => c.toUpperCase()))).filter(isValidCpt);
  const hasProcedure = procedures.some((c) => !/^(36415|8\d{4}|9[3-4]\d{3}|G2211)$/.test(c));

  if (facts.emLevel) {
    const mods: string[] = [];
    if (hasProcedure) mods.push("25");
    if (facts.telehealth) mods.push("95");
    out.push(line(emCodeFor(facts.emLevel, facts.newPatient), facts, cm, allDx.length ? allDx : primaryDx, mods));
    if (facts.visitComplexityAddOn && !facts.newPatient) out.push(line("G2211", facts, cm, primaryDx));
  }
  for (const p of procedures) out.push(line(p, facts, cm, primaryDx));
  if (facts.vaccinesGiven > 0) {
    out.push(line("90471", facts, cm, primaryDx));
    if (facts.vaccinesGiven > 1) out.push(line("90472", facts, cm, primaryDx, [], facts.vaccinesGiven - 1));
  }
  return out;
}

export interface ChargeGap { kind: "missing-charge" | "orphan-charge" | "charge-lag" | "no-em"; detail: string; cpt?: string; severity: "error" | "warning" }

// Missing-charge detection: documented/ordered services with no charge; charges with no
// documentation; charge lag beyond the target (days between DOS and charge entry).
export function detectChargeGaps(facts: EncounterFacts, charges: ServiceLine[], opts: { chargeLagTargetDays?: number; enteredAt?: string } = {}): ChargeGap[] {
  const gaps: ChargeGap[] = [];
  const charged = new Set(charges.map((c) => c.cpt));
  for (const c of [...facts.proceduresDocumented, ...facts.ordersCompleted]) {
    if (!charged.has(c.toUpperCase())) gaps.push({ kind: "missing-charge", cpt: c, detail: `${c} documented/performed but not charged`, severity: "error" });
  }
  const documented = new Set([...facts.proceduresDocumented, ...facts.ordersCompleted].map((c) => c.toUpperCase()));
  for (const ch of charges) {
    if (/^992\d\d$/.test(ch.cpt) || /^9047[12]$/.test(ch.cpt) || ch.cpt === "G2211") continue;
    if (!documented.has(ch.cpt)) gaps.push({ kind: "orphan-charge", cpt: ch.cpt, detail: `${ch.cpt} charged but not found in documentation`, severity: "error" });
  }
  if (facts.emLevel && !charges.some((c) => /^992\d\d$/.test(c.cpt))) gaps.push({ kind: "no-em", detail: "Visit leveled but no E/M charge present", severity: "error" });
  const target = opts.chargeLagTargetDays ?? 2;
  if (opts.enteredAt) {
    const lag = daysBetween(facts.dateOfService, opts.enteredAt);
    if (lag > target) gaps.push({ kind: "charge-lag", detail: `Charge lag ${lag} days exceeds target ${target}`, severity: lag > 7 ? "error" : "warning" });
  }
  return gaps;
}

// Voice charge capture: "add 99214 with modifier 25, diagnosis E11.9 and I10, two units of 90472".
export interface VoiceChargeCommand { cpt: string; modifiers: string[]; units: number; diagnoses: string[]; raw: string }

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function parseVoiceCharge(transcript: string): VoiceChargeCommand[] {
  const text = transcript.replace(/\s+/g, " ").trim();
  const upper = text.toUpperCase();
  const cptMatches = Array.from(upper.matchAll(/\b(\d{5}|[A-Z]\d{4})\b/g)).map((m) => ({ code: m[1], idx: m.index ?? 0 })).filter((m) => isValidCpt(m.code) && !isValidIcd10(m.code));
  // ICD-10 codes may be spoken "E11 point 9" → normalize.
  const normalizedForIcd = upper.replace(/\b([A-TV-Z]\d{2})\s*(?:POINT|DOT|\.)\s*(\d[0-9A-Z]{0,3})\b/g, "$1.$2");
  const icdMatches = Array.from(normalizedForIcd.matchAll(/\b([A-TV-Z]\d{2}(?:\.\d[0-9A-Z]{0,3})?)\b/g)).map((m) => m[1]).filter((c) => isValidIcd10(c) && !/^\d/.test(c));
  const diagnoses = Array.from(new Set(icdMatches));
  const out: VoiceChargeCommand[] = [];
  cptMatches.forEach((m, i) => {
    const segment = upper.slice(m.idx, cptMatches[i + 1]?.idx ?? upper.length);
    const before = upper.slice(cptMatches[i - 1]?.idx ?? 0, m.idx);
    const modifiers = Array.from(segment.matchAll(/MODIFIERS?\s+((?:[A-Z0-9]{2}(?:\s*(?:,|AND)\s*)?)+)/g)).flatMap((mm) => mm[1].split(/\s*(?:,|AND)\s*/).map((s: string) => s.trim()).filter((s: string) => /^[A-Z0-9]{2}$/.test(s)));
    let units = 1;
    // "two units of 90472" belongs to the NEXT code, so strip a trailing "N units of" phrase
    // from this code's segment before looking for an in-segment unit count.
    const segmentOwn = segment.replace(/\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s+UNITS?\s+OF\s*$/, "");
    const unitsMatch = before.match(/\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s+UNITS?\s+OF\s*$/) ?? segmentOwn.match(/\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s+UNITS?\b/);
    if (unitsMatch) units = NUMBER_WORDS[unitsMatch[1].toLowerCase()] ?? parseInt(unitsMatch[1], 10) ?? 1;
    out.push({ cpt: m.code, modifiers: Array.from(new Set(modifiers)), units: Math.max(1, units), diagnoses, raw: text });
  });
  return out;
}

export function voiceCommandsToLines(cmds: VoiceChargeCommand[], facts: Pick<EncounterFacts, "dateOfService" | "placeOfService" | "renderingNpi" | "diagnoses" | "telehealth">, cm: ChargeMaster = DEFAULT_CHARGE_MASTER): { lines: ServiceLine[]; diagnoses: Diagnosis[] } {
  const dx: Diagnosis[] = [...facts.diagnoses];
  for (const c of cmds) for (const code of c.diagnoses) if (!dx.some((d) => d.code === code)) dx.push({ code });
  const lines = cmds.map((c) => {
    const pointers = c.diagnoses.length ? c.diagnoses.map((code) => dx.findIndex((d) => d.code === code) + 1).filter((p) => p > 0) : dx.length ? [1] : [];
    return {
      id: newId("ln"),
      cpt: c.cpt,
      description: feeRow(c.cpt)?.description,
      modifiers: c.modifiers,
      units: c.units,
      charge: round2(chargeFor(c.cpt, cm) * c.units),
      dxPointers: pointers.slice(0, 4),
      dateOfService: facts.dateOfService,
      placeOfService: facts.telehealth ? "10" : facts.placeOfService,
      renderingNpi: facts.renderingNpi,
    } satisfies ServiceLine;
  });
  return { lines, diagnoses: dx };
}

export function chargeMasterCatalog(): Array<{ cpt: string; description: string; category: string }> {
  return FEE_SCHEDULE.map((r) => ({ cpt: r.cpt, description: r.description, category: r.category }));
}
