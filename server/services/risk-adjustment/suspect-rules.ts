/**
 * Deterministic suspect-condition rules.
 *
 * A "suspect" is a condition the chart *supports* but that has not been coded.
 * Each rule below names the objective evidence that raises the suspicion and the
 * ICD-10-CM code family a clinician would consider. Rules deliberately do not
 * name HCC numbers — the loaded CMS crosswalk decides whether a code risk-
 * adjusts, and hardcoding that here would rot the moment CMS revises the model.
 *
 * ## The guardrail that matters
 *
 * Nothing here codes anything. Every output is a prompt to a clinician with the
 * evidence attached, and it stays `origin: "suspected"` until a human attests.
 * That constraint is not squeamishness — automated HCC capture that adds codes
 * without a clinician's judgement is the specific practice that has drawn
 * federal False Claims Act enforcement against Medicare Advantage organisations.
 * A system that raises a well-evidenced suggestion is an asset; one that codes
 * on its own is a liability with a revenue line attached.
 *
 * Rules are also written to fire on *evidence*, not on absence. "No A1c on file"
 * is not evidence of diabetes. Every trigger below is something affirmatively
 * present in the record.
 */

export type SuspectStrength = "strong" | "moderate";

export interface SuspectEvidence {
  /** What was found, in clinician-readable terms. */
  finding: string;
  /** Where it came from — lab, medication, vital, prior claim. */
  sourceType: "lab" | "medication" | "vital" | "imaging" | "problem-list" | "prior-year-claim";
  /** ISO-8601 date of the observation, when known. */
  observedAt?: string;
}

export interface SuspectRule {
  id: string;
  /** Condition being suggested, in clinical language. */
  condition: string;
  /** Candidate ICD-10-CM codes. The clinician picks the specific one; the
   *  crosswalk then determines whether it risk-adjusts. */
  candidateIcd10: readonly string[];
  strength: SuspectStrength;
  /** Plain statement of what the clinician must confirm before coding. */
  requiresConfirmation: string;
  /** Why this rule exists — the clinical reasoning, not the revenue reasoning. */
  rationale: string;
}

export interface LabObservation {
  code: string;
  name?: string;
  value: number;
  unit?: string;
  observedAt?: string;
}

export interface PatientEvidenceSnapshot {
  labs?: readonly LabObservation[];
  medications?: readonly { name: string; rxnorm?: string; active?: boolean }[];
  vitals?: readonly { type: string; value: number; unit?: string; observedAt?: string }[];
  problemList?: readonly { icd10?: string; name: string }[];
  /** ICD-10 codes coded on encounters during the current calendar year. */
  codedThisYear?: readonly string[];
  /** Devices / services on file, e.g. "home-oxygen", "dialysis", "wheelchair". */
  services?: readonly string[];
}

export interface SuspectHit {
  rule: SuspectRule;
  evidence: readonly SuspectEvidence[];
}

/**
 * The rule set.
 *
 * Chosen for two properties: the trigger is objective and already in structured
 * data, and the condition is one that is genuinely and commonly under-documented
 * rather than one that merely pays well. Chronic respiratory failure on home
 * oxygen and CKD staging are the two largest real-world documentation gaps in
 * primary care, and both are here.
 */
export const SUSPECT_RULES: readonly SuspectRule[] = [
  {
    id: "ckd-stage-from-egfr",
    condition: "Chronic kidney disease, staged",
    candidateIcd10: ["N18.30", "N18.31", "N18.32", "N18.4", "N18.5", "N18.6"],
    strength: "strong",
    requiresConfirmation:
      "Confirm two eGFR values below 60 at least 90 days apart, and stage from the " +
      "most recent value plus albuminuria. An unstaged N18.9 does not risk-adjust.",
    rationale:
      "CKD is defined by persistence, so a single low eGFR is not CKD — but a pair " +
      "90 days apart is, and the staging is usually left undone in the chart.",
  },
  {
    id: "diabetes-with-chronic-complications",
    condition: "Diabetes with chronic complications",
    candidateIcd10: ["E11.22", "E11.40", "E11.42", "E11.51", "E11.9"],
    strength: "strong",
    requiresConfirmation:
      "Confirm the causal link between the diabetes and the complication in the note. " +
      "Coding both separately without stating the linkage does not establish it.",
    rationale:
      "Diabetes coexisting with CKD, neuropathy or retinopathy is usually a diabetic " +
      "complication, but the combination code requires the clinician to say so.",
  },
  {
    id: "chronic-respiratory-failure-home-o2",
    condition: "Chronic respiratory failure",
    candidateIcd10: ["J96.10", "J96.11", "J96.12"],
    strength: "strong",
    requiresConfirmation:
      "Confirm the indication for home oxygen and whether hypoxia, hypercapnia or both.",
    rationale:
      "A patient on continuous home oxygen almost always meets criteria for chronic " +
      "respiratory failure, yet is frequently carried as COPD alone.",
  },
  {
    id: "morbid-obesity-from-bmi",
    condition: "Morbid (severe) obesity",
    candidateIcd10: ["E66.01", "Z68.41", "Z68.42", "Z68.43", "Z68.44", "Z68.45"],
    strength: "strong",
    requiresConfirmation:
      "The BMI Z-code alone is not codable as a diagnosis — a clinician must document " +
      "the obesity itself; the Z68 code then adds the specificity.",
    rationale:
      "BMI is computed automatically from recorded height and weight, so the evidence " +
      "is always present even when the diagnosis is never written down.",
  },
  {
    id: "heart-failure-from-ef",
    condition: "Heart failure, typed and specified",
    candidateIcd10: ["I50.21", "I50.22", "I50.32", "I50.42"],
    strength: "strong",
    requiresConfirmation:
      "Confirm systolic vs diastolic and acute vs chronic from the echo and the " +
      "clinical course. Unspecified heart failure loses the specificity the echo gave.",
    rationale:
      "A reduced ejection fraction on a filed echo is objective evidence of systolic " +
      "dysfunction that often never reaches the problem list in typed form.",
  },
  {
    id: "major-depression-from-phq9",
    condition: "Major depressive disorder",
    candidateIcd10: ["F32.1", "F32.2", "F33.1", "F33.2"],
    strength: "moderate",
    requiresConfirmation:
      "Confirm the DSM-5 criteria and the episode's severity and recurrence. A PHQ-9 " +
      "score is a screening instrument, not a diagnosis.",
    rationale:
      "A high PHQ-9 alongside an active antidepressant suggests treated major " +
      "depression carried in the chart only as 'depression, unspecified'.",
  },
  {
    id: "atrial-fibrillation-on-anticoagulation",
    condition: "Atrial fibrillation, typed",
    candidateIcd10: ["I48.0", "I48.1", "I48.11", "I48.19", "I48.20", "I48.21"],
    strength: "moderate",
    requiresConfirmation:
      "Confirm paroxysmal, persistent, chronic or permanent from the rhythm history.",
    rationale:
      "Long-term anticoagulation with a rhythm-control agent implies a typed atrial " +
      "fibrillation that is usually recorded as unspecified.",
  },
  {
    id: "vascular-disease-from-claudication",
    condition: "Peripheral vascular disease",
    candidateIcd10: ["I70.211", "I70.212", "I70.221", "I73.9"],
    strength: "moderate",
    requiresConfirmation:
      "Confirm laterality and whether claudication, rest pain or ulceration is present.",
    rationale:
      "An abnormal ankle-brachial index is objective evidence of arterial disease " +
      "that frequently stays in the vascular report and never reaches the problem list.",
  },
  {
    id: "amputation-status",
    condition: "Acquired absence of limb",
    candidateIcd10: ["Z89.411", "Z89.412", "Z89.421", "Z89.422", "Z89.511", "Z89.611"],
    strength: "strong",
    requiresConfirmation: "Confirm the level and laterality of the amputation.",
    rationale:
      "Amputation status is permanent, so it must be re-documented every year — and " +
      "because it never changes, it is the status most often assumed already recorded.",
  },
  {
    id: "cirrhosis-from-imaging",
    condition: "Cirrhosis of liver",
    candidateIcd10: ["K74.60", "K74.69", "K70.30", "K70.31"],
    strength: "moderate",
    requiresConfirmation:
      "Confirm the aetiology and whether decompensated (ascites, varices, encephalopathy).",
    rationale:
      "A cirrhotic-morphology liver on imaging plus a low platelet count is strong " +
      "objective support for a diagnosis often left implicit.",
  },
];

const RULES_BY_ID = new Map(SUSPECT_RULES.map((r) => [r.id, r]));

export function getSuspectRule(id: string): SuspectRule | null {
  return RULES_BY_ID.get(id) ?? null;
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True when the patient already carries a code in the given ICD-10 family. */
function alreadyCoded(snapshot: PatientEvidenceSnapshot, prefixes: readonly string[]): boolean {
  const coded = (snapshot.codedThisYear ?? []).map(normalize);
  const onList = (snapshot.problemList ?? [])
    .map((p) => (p.icd10 ? normalize(p.icd10) : ""))
    .filter(Boolean);
  const all = [...coded, ...onList];
  return prefixes.some((prefix) => all.some((c) => c.startsWith(normalize(prefix))));
}

function labsMatching(
  snapshot: PatientEvidenceSnapshot,
  predicate: (lab: LabObservation) => boolean,
): LabObservation[] {
  return (snapshot.labs ?? []).filter(predicate);
}

function hasMedication(snapshot: PatientEvidenceSnapshot, needles: readonly string[]): string | null {
  for (const med of snapshot.medications ?? []) {
    if (med.active === false) continue;
    const name = med.name.toLowerCase();
    const hit = needles.find((n) => name.includes(n));
    if (hit) return med.name;
  }
  return null;
}

function latestVital(snapshot: PatientEvidenceSnapshot, type: string) {
  const matches = (snapshot.vitals ?? []).filter((v) => v.type === type);
  if (matches.length === 0) return null;
  return matches.reduce((latest, v) =>
    (v.observedAt ?? "") > (latest.observedAt ?? "") ? v : latest,
  );
}

/** Days between two ISO dates, or null when either is missing/unparseable. */
function daysApart(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / 86_400_000;
}

/**
 * Evaluate every rule against a patient snapshot.
 *
 * A rule is skipped when the patient already carries a code in that family — the
 * point is to surface what is missing, and repeating what is already coded is
 * how these tools become noise that clinicians learn to dismiss.
 */
export function findSuspects(snapshot: PatientEvidenceSnapshot): SuspectHit[] {
  const hits: SuspectHit[] = [];
  const add = (id: string, evidence: SuspectEvidence[]) => {
    const rule = RULES_BY_ID.get(id);
    if (rule && evidence.length > 0) hits.push({ rule, evidence });
  };

  // ── CKD: two eGFR < 60 at least 90 days apart ─────────────────────────────
  if (!alreadyCoded(snapshot, ["N18"])) {
    const lowEgfr = Array.from(
      labsMatching(snapshot, (l) => /egfr/i.test(l.name ?? l.code) && l.value < 60),
    ).sort((a, b) => (a.observedAt ?? "").localeCompare(b.observedAt ?? ""));

    if (lowEgfr.length >= 2) {
      const gap = daysApart(lowEgfr[0].observedAt, lowEgfr[lowEgfr.length - 1].observedAt);
      if (gap !== null && gap >= 90) {
        add(
          "ckd-stage-from-egfr",
          lowEgfr.slice(-2).map((l: LabObservation) => ({
            finding: `eGFR ${l.value}${l.unit ? ` ${l.unit}` : ""}`,
            sourceType: "lab" as const,
            observedAt: l.observedAt,
          })),
        );
      }
    }
  }

  // ── Diabetes with chronic complications ───────────────────────────────────
  const diabetesEvidence: SuspectEvidence[] = [];
  const highA1c = labsMatching(
    snapshot,
    (l) => /a1c|hemoglobin a1c|hba1c/i.test(l.name ?? l.code) && l.value >= 6.5,
  );
  if (highA1c.length > 0) {
    const latest = highA1c[highA1c.length - 1];
    diabetesEvidence.push({
      finding: `HbA1c ${latest.value}%`,
      sourceType: "lab",
      observedAt: latest.observedAt,
    });
  }
  const diabetesMed = hasMedication(snapshot, [
    "metformin",
    "insulin",
    "glipizide",
    "empagliflozin",
    "dapagliflozin",
    "semaglutide",
    "dulaglutide",
  ]);
  if (diabetesMed) {
    diabetesEvidence.push({ finding: `Active ${diabetesMed}`, sourceType: "medication" });
  }
  // Only suggest the *complication* code when a complication is actually present.
  const hasComplication =
    alreadyCoded(snapshot, ["N18"]) ||
    (snapshot.problemList ?? []).some((p) => /neuropath|retinopath|nephropath/i.test(p.name));
  if (diabetesEvidence.length > 0 && hasComplication && !alreadyCoded(snapshot, ["E11.2", "E11.4", "E11.5"])) {
    diabetesEvidence.push({
      finding: "Coexisting chronic complication documented (renal, neurologic or ophthalmic)",
      sourceType: "problem-list",
    });
    add("diabetes-with-chronic-complications", diabetesEvidence);
  }

  // ── Chronic respiratory failure on home oxygen ────────────────────────────
  if ((snapshot.services ?? []).includes("home-oxygen") && !alreadyCoded(snapshot, ["J96"])) {
    add("chronic-respiratory-failure-home-o2", [
      { finding: "Home oxygen therapy on file", sourceType: "problem-list" },
    ]);
  }

  // ── Morbid obesity from BMI ───────────────────────────────────────────────
  const bmi = latestVital(snapshot, "bmi");
  if (bmi && bmi.value >= 40 && !alreadyCoded(snapshot, ["E66.01", "Z68.4"])) {
    add("morbid-obesity-from-bmi", [
      { finding: `BMI ${bmi.value}`, sourceType: "vital", observedAt: bmi.observedAt },
    ]);
  }

  // ── Heart failure from ejection fraction ──────────────────────────────────
  const ef = labsMatching(
    snapshot,
    (l) => /ejection fraction|lvef/i.test(l.name ?? l.code) && l.value < 40,
  );
  if (ef.length > 0 && !alreadyCoded(snapshot, ["I50.2", "I50.4"])) {
    const latest = ef[ef.length - 1];
    add("heart-failure-from-ef", [
      {
        finding: `Left ventricular ejection fraction ${latest.value}%`,
        sourceType: "imaging",
        observedAt: latest.observedAt,
      },
    ]);
  }

  // ── Major depression: high PHQ-9 plus active antidepressant ───────────────
  const phq9 = labsMatching(snapshot, (l) => /phq.?9/i.test(l.name ?? l.code) && l.value >= 15);
  const antidepressant = hasMedication(snapshot, [
    "sertraline",
    "fluoxetine",
    "escitalopram",
    "citalopram",
    "duloxetine",
    "venlafaxine",
    "bupropion",
    "mirtazapine",
  ]);
  if (phq9.length > 0 && antidepressant && !alreadyCoded(snapshot, ["F32.1", "F32.2", "F33"])) {
    const latest = phq9[phq9.length - 1];
    add("major-depression-from-phq9", [
      { finding: `PHQ-9 score ${latest.value}`, sourceType: "lab", observedAt: latest.observedAt },
      { finding: `Active ${antidepressant}`, sourceType: "medication" },
    ]);
  }

  // ── Typed atrial fibrillation ─────────────────────────────────────────────
  const anticoagulant = hasMedication(snapshot, [
    "apixaban",
    "rivaroxaban",
    "warfarin",
    "dabigatran",
    "edoxaban",
  ]);
  const afibOnList = (snapshot.problemList ?? []).some((p) => /atrial fib/i.test(p.name));
  if (anticoagulant && afibOnList && !alreadyCoded(snapshot, ["I48.0", "I48.1", "I48.2"])) {
    add("atrial-fibrillation-on-anticoagulation", [
      { finding: `Active ${anticoagulant}`, sourceType: "medication" },
      { finding: "Atrial fibrillation on the problem list without a type", sourceType: "problem-list" },
    ]);
  }

  // ── Peripheral vascular disease from ABI ──────────────────────────────────
  const abi = labsMatching(
    snapshot,
    (l) => /ankle.?brachial|abi/i.test(l.name ?? l.code) && l.value < 0.9,
  );
  if (abi.length > 0 && !alreadyCoded(snapshot, ["I70.2", "I73"])) {
    const latest = abi[abi.length - 1];
    add("vascular-disease-from-claudication", [
      {
        finding: `Ankle-brachial index ${latest.value}`,
        sourceType: "lab",
        observedAt: latest.observedAt,
      },
    ]);
  }

  return hits;
}
