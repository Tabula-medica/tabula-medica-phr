interface AuditEntry {
  id: string;
  timestamp: string;
  patientId: string;
  patientName: string;
  aiSummary: string;
  modelVersion: string;
  status: string;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  sourceGrounding: Array<{
    sentence: string;
    sourceDocument: string;
    sourceField: string;
    highlightStart: number;
    highlightEnd: number;
  }>;
  explainabilityFactors: Array<{
    factor: string;
    weight: number;
    direction: "positive" | "negative" | "neutral";
  }>;
  clinicianVerification: "verified" | "flagged" | "pending";
  clinicianFeedback: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rlhfFeedbackSubmitted: string | null;
  requestPayload: Record<string, unknown>;
}

interface AuditDashboard {
  overview: {
    totalAudits: number;
    verifiedCount: number;
    flaggedCount: number;
    pendingCount: number;
    averageConfidence: number;
    lowConfidenceCount: number;
    rlhfFeedbackCount: number;
  };
  entries: AuditEntry[];
  modelBreakdown: Array<{ model: string; count: number; avgConfidence: number }>;
  confidenceDistribution: Array<{ range: string; count: number }>;
}

const SAMPLE_ENTRIES: AuditEntry[] = [
  {
    id: "audit-001",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    patientId: "PT-20240001",
    patientName: "Jane M.",
    aiSummary: "Patient presents with declining estradiol levels (28 pg/mL) consistent with perimenopause transition. Bone density T-score of -1.8 indicates osteopenia risk. ApoB elevated at 142 mg/dL suggesting cardiovascular monitoring needed. Sleep efficiency at 68% correlates with reported hot flashes and night sweats.",
    modelVersion: "med-gemini-1.5-pro",
    status: "completed",
    confidenceScore: 94.2,
    confidenceLevel: "high",
    sourceGrounding: [
      { sentence: "Declining estradiol levels (28 pg/mL) consistent with perimenopause transition", sourceDocument: "Epic EHR - Lab Results 2026-03-15", sourceField: "Observation.valueQuantity", highlightStart: 0, highlightEnd: 78 },
      { sentence: "Bone density T-score of -1.8 indicates osteopenia risk", sourceDocument: "DEXA Scan Report - RadNet 2026-02-20", sourceField: "DiagnosticReport.conclusion", highlightStart: 79, highlightEnd: 134 },
      { sentence: "ApoB elevated at 142 mg/dL suggesting cardiovascular monitoring", sourceDocument: "Quest Diagnostics - Lipid Panel 2026-03-10", sourceField: "Observation.interpretation", highlightStart: 135, highlightEnd: 198 },
    ],
    explainabilityFactors: [
      { factor: "Low Estradiol (28 pg/mL)", weight: 0.34, direction: "negative" },
      { factor: "Osteopenia T-score (-1.8)", weight: 0.28, direction: "negative" },
      { factor: "Elevated ApoB (142 mg/dL)", weight: 0.22, direction: "negative" },
      { factor: "Poor Sleep Efficiency (68%)", weight: 0.16, direction: "negative" },
    ],
    clinicianVerification: "verified",
    clinicianFeedback: null,
    verifiedBy: "Dr. Sarah Chen, MD — Endocrinology",
    verifiedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    rlhfFeedbackSubmitted: null,
    requestPayload: { profileId: "profile-default", analysisType: "resilience_assessment", dataWindow: "90_days" },
  },
  {
    id: "audit-002",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    patientId: "PT-20240002",
    patientName: "Maria L.",
    aiSummary: "Post-menopausal patient with stable thyroid function (TSH 2.1 mIU/L). Resilience score trending upward after 6 months on estradiol patch (0.1 mg/day). Muscle mass improved from 22.1 kg to 24.8 kg with resistance training protocol. Sleep efficiency improved to 82% with progesterone supplementation.",
    modelVersion: "med-gemini-1.5-pro",
    status: "completed",
    confidenceScore: 88.7,
    confidenceLevel: "high",
    sourceGrounding: [
      { sentence: "Stable thyroid function (TSH 2.1 mIU/L)", sourceDocument: "LabCorp Results 2026-03-01", sourceField: "Observation.valueQuantity", highlightStart: 0, highlightEnd: 41 },
      { sentence: "Estradiol patch (0.1 mg/day) for 6 months", sourceDocument: "Epic EHR - Medication List", sourceField: "MedicationRequest.dosageInstruction", highlightStart: 42, highlightEnd: 105 },
      { sentence: "Muscle mass improved from 22.1 kg to 24.8 kg", sourceDocument: "InBody Composition Report 2026-02-28", sourceField: "Observation.valueQuantity", highlightStart: 106, highlightEnd: 167 },
    ],
    explainabilityFactors: [
      { factor: "Stable TSH (2.1 mIU/L)", weight: 0.15, direction: "positive" },
      { factor: "HRT Duration (6 months)", weight: 0.30, direction: "positive" },
      { factor: "Muscle Mass Gain (+2.7 kg)", weight: 0.35, direction: "positive" },
      { factor: "Sleep Improvement (82%)", weight: 0.20, direction: "positive" },
    ],
    clinicianVerification: "pending",
    clinicianFeedback: null,
    verifiedBy: null,
    verifiedAt: null,
    rlhfFeedbackSubmitted: null,
    requestPayload: { profileId: "profile-002", analysisType: "therapy_effectiveness", dataWindow: "180_days" },
  },
  {
    id: "audit-003",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    patientId: "PT-20240003",
    patientName: "Lisa K.",
    aiSummary: "Perimenopause patient with rapidly fluctuating hormones. Estradiol measured at 185 pg/mL — unusually high for reported symptoms. Possible lab error or ectopic estrogen source. Free T3 low at 1.8 pg/mL which may explain persistent fatigue independent of menopause. Recommend thyroid panel recheck.",
    modelVersion: "med-gemini-1.5-pro",
    status: "completed",
    confidenceScore: 62.3,
    confidenceLevel: "low",
    sourceGrounding: [
      { sentence: "Estradiol measured at 185 pg/mL — unusually high", sourceDocument: "Quest Diagnostics 2026-03-18", sourceField: "Observation.valueQuantity", highlightStart: 0, highlightEnd: 52 },
      { sentence: "Free T3 low at 1.8 pg/mL", sourceDocument: "Quest Diagnostics 2026-03-18", sourceField: "Observation.valueQuantity", highlightStart: 53, highlightEnd: 100 },
    ],
    explainabilityFactors: [
      { factor: "Anomalous E2 (185 pg/mL)", weight: 0.45, direction: "negative" },
      { factor: "Low Free T3 (1.8 pg/mL)", weight: 0.30, direction: "negative" },
      { factor: "Symptom-Lab Mismatch", weight: 0.25, direction: "negative" },
    ],
    clinicianVerification: "flagged",
    clinicianFeedback: "E2 value inconsistent with clinical presentation. Recommend repeat lab draw with different collection site. Possible exogenous estrogen contamination.",
    verifiedBy: "Dr. Robert Kim, MD — Reproductive Endocrinology",
    verifiedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    rlhfFeedbackSubmitted: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    requestPayload: { profileId: "profile-003", analysisType: "anomaly_detection", dataWindow: "30_days" },
  },
  {
    id: "audit-004",
    timestamp: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    patientId: "PT-20240004",
    patientName: "Patricia W.",
    aiSummary: "Late postmenopause patient (age 62). Bone density stable at T-score -0.8 (normal range). ApoB well-controlled at 78 mg/dL on statin therapy. Sleep efficiency 91% — excellent. Overall resilience score 86/100 indicating strong adaptive capacity. Continue current regimen.",
    modelVersion: "med-gemini-1.5-pro",
    status: "completed",
    confidenceScore: 96.1,
    confidenceLevel: "high",
    sourceGrounding: [
      { sentence: "Bone density stable at T-score -0.8", sourceDocument: "DEXA Scan Report 2026-01-15", sourceField: "DiagnosticReport.conclusion", highlightStart: 0, highlightEnd: 46 },
      { sentence: "ApoB well-controlled at 78 mg/dL on statin therapy", sourceDocument: "Cardiology Follow-up 2026-02-10", sourceField: "Observation.valueQuantity", highlightStart: 47, highlightEnd: 98 },
      { sentence: "Sleep efficiency 91%", sourceDocument: "Oura Ring Data Export 2026-03-20", sourceField: "Observation.valueQuantity", highlightStart: 99, highlightEnd: 138 },
    ],
    explainabilityFactors: [
      { factor: "Normal Bone Density (-0.8)", weight: 0.25, direction: "positive" },
      { factor: "Controlled ApoB (78 mg/dL)", weight: 0.25, direction: "positive" },
      { factor: "High Sleep Efficiency (91%)", weight: 0.25, direction: "positive" },
      { factor: "Stable Regimen (18 months)", weight: 0.25, direction: "positive" },
    ],
    clinicianVerification: "verified",
    clinicianFeedback: null,
    verifiedBy: "Dr. Amanda Torres, MD — Internal Medicine",
    verifiedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    rlhfFeedbackSubmitted: null,
    requestPayload: { profileId: "profile-004", analysisType: "wellness_assessment", dataWindow: "365_days" },
  },
  {
    id: "audit-005",
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    patientId: "PT-20240005",
    patientName: "Susan R.",
    aiSummary: "Early perimenopause patient with mixed biomarker profile. Progesterone declining (3.2 ng/mL) but testosterone stable (45 ng/dL). ApoB borderline elevated at 110 mg/dL — recommend lifestyle intervention before pharmacotherapy. Sleep efficiency declining from 79% to 71% over past 60 days.",
    modelVersion: "med-gemini-1.5-pro",
    status: "completed",
    confidenceScore: 76.8,
    confidenceLevel: "medium",
    sourceGrounding: [
      { sentence: "Progesterone declining (3.2 ng/mL)", sourceDocument: "Epic EHR - Lab Trend 2026-03-12", sourceField: "Observation.valueQuantity", highlightStart: 0, highlightEnd: 42 },
      { sentence: "ApoB borderline elevated at 110 mg/dL", sourceDocument: "Annual Wellness Visit Lab Panel 2026-03-05", sourceField: "Observation.interpretation", highlightStart: 43, highlightEnd: 95 },
    ],
    explainabilityFactors: [
      { factor: "Declining Progesterone (3.2)", weight: 0.30, direction: "negative" },
      { factor: "Borderline ApoB (110)", weight: 0.25, direction: "negative" },
      { factor: "Stable Testosterone (45)", weight: 0.20, direction: "positive" },
      { factor: "Sleep Decline (79→71%)", weight: 0.25, direction: "negative" },
    ],
    clinicianVerification: "pending",
    clinicianFeedback: null,
    verifiedBy: null,
    verifiedAt: null,
    rlhfFeedbackSubmitted: null,
    requestPayload: { profileId: "profile-005", analysisType: "early_intervention", dataWindow: "60_days" },
  },
];

const flagFeedback: Map<string, { verification: string; feedback: string; verifiedBy: string; verifiedAt: string }> = new Map();

export function getClinicalAiAuditDashboard(): AuditDashboard {
  const entries = SAMPLE_ENTRIES.map(e => {
    const fb = flagFeedback.get(e.id);
    if (fb) {
      return { ...e, clinicianVerification: fb.verification as any, clinicianFeedback: fb.feedback, verifiedBy: fb.verifiedBy, verifiedAt: fb.verifiedAt, rlhfFeedbackSubmitted: fb.verification === "flagged" ? fb.verifiedAt : null };
    }
    return e;
  });

  const verified = entries.filter(e => e.clinicianVerification === "verified").length;
  const flagged = entries.filter(e => e.clinicianVerification === "flagged").length;
  const pending = entries.filter(e => e.clinicianVerification === "pending").length;
  const avgConf = entries.reduce((s, e) => s + e.confidenceScore, 0) / entries.length;
  const lowConf = entries.filter(e => e.confidenceScore < 80).length;
  const rlhf = entries.filter(e => e.rlhfFeedbackSubmitted).length;

  return {
    overview: {
      totalAudits: entries.length,
      verifiedCount: verified,
      flaggedCount: flagged,
      pendingCount: pending,
      averageConfidence: Math.round(avgConf * 10) / 10,
      lowConfidenceCount: lowConf,
      rlhfFeedbackCount: rlhf,
    },
    entries,
    modelBreakdown: [
      { model: "med-gemini-1.5-pro", count: entries.length, avgConfidence: Math.round(avgConf * 10) / 10 },
    ],
    confidenceDistribution: [
      { range: "90-100%", count: entries.filter(e => e.confidenceScore >= 90).length },
      { range: "80-89%", count: entries.filter(e => e.confidenceScore >= 80 && e.confidenceScore < 90).length },
      { range: "70-79%", count: entries.filter(e => e.confidenceScore >= 70 && e.confidenceScore < 80).length },
      { range: "<70%", count: entries.filter(e => e.confidenceScore < 70).length },
    ],
  };
}

export function getClinicalAiAuditEntry(entryId: string): AuditEntry | null {
  const entry = SAMPLE_ENTRIES.find(e => e.id === entryId);
  if (!entry) return null;
  const fb = flagFeedback.get(entryId);
  if (fb) {
    return { ...entry, clinicianVerification: fb.verification as any, clinicianFeedback: fb.feedback, verifiedBy: fb.verifiedBy, verifiedAt: fb.verifiedAt, rlhfFeedbackSubmitted: fb.verification === "flagged" ? fb.verifiedAt : null };
  }
  return entry;
}

export function verifyClinicalAiAudit(entryId: string, data: { verification: "verified" | "flagged"; feedback?: string; clinicianName: string }) {
  const entry = SAMPLE_ENTRIES.find(e => e.id === entryId);
  if (!entry) throw new Error("Audit entry not found");

  const now = new Date().toISOString();
  flagFeedback.set(entryId, {
    verification: data.verification,
    feedback: data.feedback || "",
    verifiedBy: data.clinicianName,
    verifiedAt: now,
  });

  console.log(`[HIPAA-AUDIT][ClinicalAI] ${data.verification.toUpperCase()} - Entry ${entryId} by ${data.clinicianName}${data.verification === "flagged" ? ` — RLHF feedback queued` : ""}`);

  return {
    success: true,
    entryId,
    verification: data.verification,
    verifiedBy: data.clinicianName,
    verifiedAt: now,
    rlhfQueued: data.verification === "flagged",
  };
}
