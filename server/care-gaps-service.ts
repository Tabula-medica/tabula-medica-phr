/**
 * USPSTF Care Gap Detection Service
 *
 * Evaluates a patient against 8 USPSTF Grade A and B screening rules.
 * Stateless: takes a snapshot of patient demographics + conditions +
 * medications + last-screening dates and returns a per-rule status.
 *
 * Status semantics:
 *   - overdue: last screening older than the recommended interval
 *               (or never done and patient is in eligible window)
 *   - due_soon: within 60 days of becoming overdue
 *   - up_to_date: within recommended interval
 *   - not_applicable: patient is excluded by age/sex/condition/medication
 *
 * Sex handling: this service uses biological sex (the `biologicalSex`
 * field on input) for screening eligibility, NOT gender identity.
 * Breast and cervical screening rules are based on anatomy.
 *
 * Exclusion handling: patients already diagnosed with the screening's
 * target condition are excluded (e.g., diabetes screening is skipped if
 * the patient has any diabetes diagnosis). Patients already on the
 * recommended therapy (e.g., a statin) are excluded from the assessment
 * for that therapy.
 *
 * NO CDS: This service does not provide clinical decision support.
 * Output is informational only and must not be used as a substitute for
 * clinical judgment. Disclaimer is returned with every response.
 */

export type BiologicalSex = "female" | "male";
export type SmokingStatus = "current" | "former" | "never";
export type CareGapStatus =
  | "overdue"
  | "due_soon"
  | "up_to_date"
  | "not_applicable";

export interface CareGapPatientInput {
  age: number;
  biologicalSex: BiologicalSex;
  /** Free text or ICD-10 codes; matched case-insensitively. */
  conditions?: string[];
  /** Free text or RxNorm names; matched case-insensitively. */
  medications?: string[];
  bmi?: number;
  smokingPackYears?: number;
  smokingStatus?: SmokingStatus;
  /** Years since the patient quit smoking (former smokers only). */
  yearsQuit?: number;
  /** Count of CVD risk factors (DM, HTN, dyslipidemia, smoking, family Hx). */
  cvdRiskFactorCount?: number;
  /**
   * Map of screening code → ISO-date of most recent completed screening.
   * Codes match the `code` field returned for each rule.
   */
  lastScreenings?: Record<string, string>;
  /** Optional surgical history relevant to exclusion logic. */
  surgicalHistory?: string[];
}

export interface CareGapResult {
  code: string;
  title: string;
  grade: "A" | "B";
  status: CareGapStatus;
  intervalMonths: number;
  lastDate?: string;
  nextDueDate?: string;
  reasoning: string;
  excluded?: boolean;
  excludedReason?: string;
}

export interface CareGapEvaluation {
  gaps: CareGapResult[];
  summary: {
    overdue: number;
    due_soon: number;
    up_to_date: number;
    not_applicable: number;
  };
  evaluatedAt: string;
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER =
  "For informational purposes only. Not for clinical decision-making. " +
  "All screening decisions must be made in consultation with a qualified " +
  "healthcare provider.";

const DUE_SOON_WINDOW_DAYS = 60;

const containsAny = (haystack: string[] | undefined, needles: string[]): boolean => {
  if (!haystack || haystack.length === 0) return false;
  const lc = haystack.map((h) => h.toLowerCase());
  return needles.some((n) => lc.some((h) => h.includes(n.toLowerCase())));
};

// P1-2: negation-aware, ICD-prefix-aware exclusion matching. Naive substring
// matching (containsAny) wrongly excludes patients whose problem list mentions a
// term in a NEGATED context — e.g. "family history of diabetes", "hypertension,
// ruled out", "suspected lung cancer" would all skip a due screening. It also
// treated ICD codes as substrings. Use this for CONDITION exclusions only.
const NEGATION_CONTEXT =
  /(family history|fh[:\s]|ruled out|rule out|r\/o|suspected|possible|no history of|negative for)/i;

const matchesExclusion = (entries: string[] | undefined, terms: string[]): boolean => {
  if (!entries || entries.length === 0) return false;
  const icdCodes = terms.filter((t) => /^[A-Z]\d/.test(t)).map((t) => t.toUpperCase());
  const textTerms = terms.filter((t) => !/^[A-Z]\d/.test(t)).map((t) => t.toLowerCase());
  return entries.some((raw) => {
    const e = raw.toLowerCase();
    if (NEGATION_CONTEXT.test(e)) return false; // negated mention — not an active diagnosis
    if (textTerms.some((t) => e.includes(t))) return true;
    // ICD-10 by code prefix (term "E11" matches entry "E11.9"), not substring.
    const upper = raw.toUpperCase();
    return icdCodes.some((c) => new RegExp(`\\b${c}`).test(upper));
  });
};

const monthsBetween = (a: Date, b: Date): number => {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
};

const evalIntervalStatus = (
  lastIso: string | undefined,
  intervalMonths: number,
): { status: CareGapStatus; nextDueDate?: string } => {
  if (!lastIso) {
    return { status: "overdue" };
  }
  const last = new Date(lastIso);
  if (isNaN(last.getTime())) return { status: "overdue" };
  const next = new Date(last);
  next.setMonth(next.getMonth() + intervalMonths);
  const now = new Date();
  const dueIso = next.toISOString().slice(0, 10);

  if (next < now) return { status: "overdue", nextDueDate: dueIso };

  const dueSoonThreshold = new Date(now);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + DUE_SOON_WINDOW_DAYS);
  if (next <= dueSoonThreshold) {
    return { status: "due_soon", nextDueDate: dueIso };
  }
  return { status: "up_to_date", nextDueDate: dueIso };
};

const COLORECTAL_EXCLUDE = ["colorectal cancer", "colon cancer", "rectal cancer", "C18", "C19", "C20"];
const BREAST_EXCLUDE = ["breast cancer", "mastectomy", "C50"];
const CERVICAL_EXCLUDE = ["cervical cancer", "hysterectomy", "C53"];
const LUNG_EXCLUDE = ["lung cancer", "C34", "palliative"];
const DIABETES_EXCLUDE = ["diabetes", "prediabetes", "E10", "E11", "E13"];
const HYPERTENSION_EXCLUDE = ["hypertension", "high blood pressure", "I10", "I11", "I12", "I13"];

const STATIN_NAMES = [
  "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin",
  "lovastatin", "fluvastatin", "pitavastatin", "lipitor", "crestor", "zocor",
];

export class CareGapsService {
  evaluate(patient: CareGapPatientInput): CareGapEvaluation {
    const gaps: CareGapResult[] = [];
    const last = patient.lastScreenings || {};

    gaps.push(this.evalColorectal(patient, last));
    gaps.push(this.evalBreast(patient, last));
    gaps.push(this.evalCervical(patient, last));
    gaps.push(this.evalLung(patient, last));
    gaps.push(this.evalDiabetes(patient, last));
    gaps.push(this.evalHypertension(patient, last));
    gaps.push(this.evalDepression(patient, last));
    gaps.push(this.evalStatinAssessment(patient, last));

    const summary = {
      overdue: gaps.filter((g) => g.status === "overdue").length,
      due_soon: gaps.filter((g) => g.status === "due_soon").length,
      up_to_date: gaps.filter((g) => g.status === "up_to_date").length,
      not_applicable: gaps.filter((g) => g.status === "not_applicable").length,
    };

    return {
      gaps,
      summary,
      evaluatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  // 1. Colorectal cancer screening — ages 45–75, every 12mo (stool) / 120mo (colonoscopy)
  private evalColorectal(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-COLORECTAL-001";
    const title = "Colorectal Cancer Screening";
    const grade = "A" as const;
    const intervalMonths = 12;

    if (p.age < 45 || p.age > 75) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 45–75 screening window.`);
    }
    if (matchesExclusion(p.conditions, COLORECTAL_EXCLUDE) || containsAny(p.surgicalHistory, ["colectomy"])) {
      return this.excluded(code, title, grade, intervalMonths, "Patient has an existing colorectal cancer diagnosis or relevant surgical history.");
    }
    const lastIso = last[code];
    const { status, nextDueDate } = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status, nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last screening on ${lastIso}. USPSTF Grade A: ages 45–75. Stool-based testing recommended every 12 months; colonoscopy every 10 years.`
        : `No prior screening recorded. USPSTF Grade A: colorectal cancer screening is recommended starting at age 45.`,
    };
  }

  // 2. Breast cancer screening — biological female, 40–74, every 24 months
  private evalBreast(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-BREAST-001";
    const title = "Breast Cancer Screening (Mammography)";
    const grade = "B" as const;
    const intervalMonths = 24;

    if (p.biologicalSex !== "female") {
      return this.notApplicable(code, title, grade, intervalMonths, "Recommendation applies to biological females.");
    }
    if (p.age < 40 || p.age > 74) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 40–74 screening window.`);
    }
    if (matchesExclusion(p.conditions, BREAST_EXCLUDE)) {
      return this.excluded(code, title, grade, intervalMonths, "Patient has an existing breast cancer diagnosis or bilateral mastectomy history.");
    }
    const lastIso = last[code];
    const { status, nextDueDate } = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status, nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last mammogram on ${lastIso}. USPSTF Grade B: biennial mammography for women aged 40–74.`
        : `No prior mammogram recorded. USPSTF Grade B: biennial mammography is recommended starting at age 40.`,
    };
  }

  // 3. Cervical cancer screening — biological female, 21–65, every 36 months (Pap) / 60 months (HPV)
  private evalCervical(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-CERVICAL-001";
    const title = "Cervical Cancer Screening";
    const grade = "A" as const;
    const intervalMonths = 36;

    if (p.biologicalSex !== "female") {
      return this.notApplicable(code, title, grade, intervalMonths, "Recommendation applies to biological females with a cervix.");
    }
    if (p.age < 21 || p.age > 65) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 21–65 screening window.`);
    }
    if (matchesExclusion(p.conditions, CERVICAL_EXCLUDE) || containsAny(p.surgicalHistory, ["hysterectomy"])) {
      return this.excluded(code, title, grade, intervalMonths, "Patient has an existing cervical cancer diagnosis or hysterectomy history.");
    }
    const lastIso = last[code];
    const { status, nextDueDate } = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status, nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last screening on ${lastIso}. USPSTF Grade A: Pap every 3 years or HPV co-test every 5 years for ages 21–65.`
        : `No prior screening recorded. USPSTF Grade A: cervical cancer screening is recommended starting at age 21.`,
    };
  }

  // 4. Lung cancer screening — 50–80, ≥20 pack-years, current or quit ≤15 years, annual
  private evalLung(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-LUNG-001";
    const title = "Lung Cancer Screening (Low-Dose CT)";
    const grade = "B" as const;
    const intervalMonths = 12;

    if (p.age < 50 || p.age > 80) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 50–80 screening window.`);
    }
    if (matchesExclusion(p.conditions, LUNG_EXCLUDE)) {
      return this.excluded(code, title, grade, intervalMonths, "Patient has an existing lung cancer diagnosis or is in palliative care.");
    }
    const packYears = p.smokingPackYears ?? 0;
    const status = p.smokingStatus ?? "never";
    const yearsQuit = p.yearsQuit ?? 0;
    const meetsSmokingCriteria =
      packYears >= 20 && (status === "current" || (status === "former" && yearsQuit <= 15));
    if (!meetsSmokingCriteria) {
      return this.notApplicable(code, title, grade, intervalMonths,
        `Smoking criteria not met (USPSTF requires ≥20 pack-years AND current smoker OR quit ≤15 years).`);
    }
    const lastIso = last[code];
    const evalRes = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status: evalRes.status, nextDueDate: evalRes.nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last LDCT on ${lastIso}. USPSTF Grade B: annual low-dose CT for high-risk smokers aged 50–80.`
        : `No prior LDCT recorded. USPSTF Grade B: annual low-dose CT recommended for ≥20 pack-year smokers aged 50–80.`,
    };
  }

  // 5. Diabetes screening — 35–70 with BMI ≥25, every 36 months
  private evalDiabetes(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-DIABETES-001";
    const title = "Type 2 Diabetes Screening";
    const grade = "B" as const;
    const intervalMonths = 36;

    if (p.age < 35 || p.age > 70) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 35–70 screening window.`);
    }
    if (matchesExclusion(p.conditions, DIABETES_EXCLUDE)) {
      return this.excluded(code, title, grade, intervalMonths, "Patient already has a diabetes or prediabetes diagnosis.");
    }
    if (p.bmi == null || p.bmi < 25) {
      return this.notApplicable(code, title, grade, intervalMonths,
        p.bmi == null
          ? "BMI not recorded; USPSTF criteria require BMI ≥25 (overweight or above)."
          : `BMI ${p.bmi.toFixed(1)} is below the ≥25 (overweight) threshold.`);
    }
    const lastIso = last[code];
    const evalRes = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status: evalRes.status, nextDueDate: evalRes.nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last screening on ${lastIso}. USPSTF Grade B: every 3 years for adults 35–70 with BMI ≥25.`
        : `No prior screening recorded. USPSTF Grade B: diabetes screening is recommended every 3 years for adults 35–70 with BMI ≥25.`,
    };
  }

  // 6. Hypertension screening — 18+; annual for 40+; every 36mo for 18–39 with normal BP
  private evalHypertension(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-HTN-001";
    const title = "Hypertension Screening";
    const grade = "A" as const;
    const intervalMonths = p.age >= 40 ? 12 : 36;

    if (p.age < 18) {
      return this.notApplicable(code, title, grade, intervalMonths, "Recommendation applies to adults 18 and older.");
    }
    if (matchesExclusion(p.conditions, HYPERTENSION_EXCLUDE)) {
      return this.excluded(code, title, grade, intervalMonths, "Patient already has a hypertension diagnosis.");
    }
    const lastIso = last[code];
    const evalRes = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status: evalRes.status, nextDueDate: evalRes.nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last BP screening on ${lastIso}. USPSTF Grade A: ${p.age >= 40 ? "annual for adults 40+" : "every 3–5 years for adults 18–39 with normal BP"}.`
        : `No prior BP screening recorded. USPSTF Grade A: ${p.age >= 40 ? "annual screening for adults 40+" : "every 3–5 years for adults 18–39"}.`,
    };
  }

  // 7. Depression screening — 18+, annual
  private evalDepression(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-DEPRESSION-001";
    const title = "Depression Screening (PHQ-9)";
    const grade = "B" as const;
    const intervalMonths = 12;

    if (p.age < 18) {
      return this.notApplicable(code, title, grade, intervalMonths, "Recommendation applies to adults 18 and older.");
    }
    const lastIso = last[code];
    const evalRes = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status: evalRes.status, nextDueDate: evalRes.nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last screening on ${lastIso}. USPSTF Grade B: annual depression screening for all adults.`
        : `No prior screening recorded. USPSTF Grade B: annual depression screening (e.g., PHQ-9) is recommended for all adults.`,
    };
  }

  // 8. Statin use assessment — 40–75 with ≥1 CVD risk factor, every 60 months
  private evalStatinAssessment(p: CareGapPatientInput, last: Record<string, string>): CareGapResult {
    const code = "USPSTF-STATIN-001";
    const title = "Statin Use Assessment for Primary Prevention of CVD";
    const grade = "B" as const;
    const intervalMonths = 60;

    if (p.age < 40 || p.age > 75) {
      return this.notApplicable(code, title, grade, intervalMonths, `Patient age ${p.age} is outside the 40–75 assessment window.`);
    }
    if (containsAny(p.medications, STATIN_NAMES)) {
      return this.excluded(code, title, grade, intervalMonths, "Patient is already on statin therapy.");
    }
    const cvdFactors = p.cvdRiskFactorCount ?? 0;
    if (cvdFactors < 1) {
      return this.notApplicable(code, title, grade, intervalMonths,
        "USPSTF criteria require at least one CVD risk factor (e.g., dyslipidemia, diabetes, hypertension, smoking).");
    }
    const lastIso = last[code];
    const evalRes = evalIntervalStatus(lastIso, intervalMonths);
    return {
      code, title, grade, intervalMonths, status: evalRes.status, nextDueDate: evalRes.nextDueDate, lastDate: lastIso,
      reasoning: lastIso
        ? `Last assessment on ${lastIso}. USPSTF Grade B: every 5 years for adults 40–75 with ≥1 CVD risk factor.`
        : `No prior assessment recorded. USPSTF Grade B: statin assessment recommended every 5 years for adults 40–75 with ≥1 CVD risk factor.`,
    };
  }

  private notApplicable(code: string, title: string, grade: "A" | "B", intervalMonths: number, reason: string): CareGapResult {
    return { code, title, grade, intervalMonths, status: "not_applicable", reasoning: reason };
  }

  private excluded(code: string, title: string, grade: "A" | "B", intervalMonths: number, reason: string): CareGapResult {
    return { code, title, grade, intervalMonths, status: "not_applicable", excluded: true, excludedReason: reason, reasoning: reason };
  }
}

export const careGapsService = new CareGapsService();
