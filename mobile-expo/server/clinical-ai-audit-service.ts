// @ts-nocheck
import type { ClinicalAiAudit } from "../shared/schema";

interface SourceReference {
  sourceSystem: string;
  documentId: string;
  excerpt: string;
  highlightRange: { start: number; end: number };
}

interface ExplainabilityFactor {
  factor: string;
  weight: number;
  direction: string;
}

interface AuditRecord {
  id: number;
  timestamp: Date;
  patientId: string;
  requestPayload: any;
  aiSummary: string;
  modelVersion: string;
  status: string;
  confidenceScore: number;
  sourceReferences: SourceReference[];
  explainabilityFactors: ExplainabilityFactor[];
  verificationStatus: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  flagReason: string | null;
  feedbackNotes: string | null;
  category: string;
}

const DEMO_AUDIT_RECORDS: AuditRecord[] = [
  {
    id: 1,
    timestamp: new Date("2026-03-22T14:30:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "menopausal_resilience", scope: "hormone_panel" },
    aiSummary: "Estradiol levels declining consistent with perimenopause transition. FSH elevated at 42 mIU/mL indicating diminished ovarian reserve. Recommend initiating low-dose transdermal estradiol with micronized progesterone.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 94.2,
    sourceReferences: [
      {
        sourceSystem: "Epic MyChart",
        documentId: "DOC-2026-03-15-LAB-0472",
        excerpt: "Estradiol: 28 pg/mL (premenopausal ref: 30-400 pg/mL). FSH: 42 mIU/mL (follicular ref: 3.5-12.5 mIU/mL).",
        highlightRange: { start: 0, end: 95 },
      },
      {
        sourceSystem: "Cerner PowerChart",
        documentId: "DOC-2025-12-01-HX-1138",
        excerpt: "Patient reports irregular menses for 14 months, night sweats 4-5x/week, and difficulty concentrating at work.",
        highlightRange: { start: 0, end: 108 },
      },
    ],
    explainabilityFactors: [
      { factor: "Elevated FSH (42 mIU/mL)", weight: 0.38, direction: "positive" },
      { factor: "Low Estradiol (28 pg/mL)", weight: 0.31, direction: "positive" },
      { factor: "Symptom Duration (14 months)", weight: 0.19, direction: "positive" },
    ],
    verificationStatus: "verified",
    verifiedBy: "Dr. Sarah Chen, MD",
    verifiedAt: new Date("2026-03-22T15:12:00Z"),
    flagReason: null,
    feedbackNotes: null,
    category: "hormone_assessment",
  },
  {
    id: 2,
    timestamp: new Date("2026-03-22T13:15:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "resilience_score", scope: "bone_density" },
    aiSummary: "DEXA T-score of -1.8 at lumbar spine suggests osteopenia. Combined with vitamin D deficiency (18 ng/mL) and low estrogen, fracture risk is moderately elevated. Weight-bearing exercise and vitamin D3 supplementation recommended.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 87.5,
    sourceReferences: [
      {
        sourceSystem: "Epic MyChart",
        documentId: "DOC-2026-02-20-IMG-0891",
        excerpt: "DEXA Scan Results: Lumbar Spine L1-L4 T-score: -1.8 (osteopenia range: -1.0 to -2.5). Femoral neck T-score: -1.2.",
        highlightRange: { start: 0, end: 102 },
      },
      {
        sourceSystem: "Quest Diagnostics",
        documentId: "LAB-2026-03-10-VIT-4521",
        excerpt: "25-Hydroxyvitamin D: 18 ng/mL (insufficiency: 20-29 ng/mL, deficiency: <20 ng/mL).",
        highlightRange: { start: 0, end: 80 },
      },
    ],
    explainabilityFactors: [
      { factor: "Low T-score (-1.8)", weight: 0.42, direction: "positive" },
      { factor: "Vitamin D Deficiency", weight: 0.28, direction: "positive" },
      { factor: "Age Factor (52)", weight: 0.18, direction: "moderate" },
    ],
    verificationStatus: "pending",
    verifiedBy: null,
    verifiedAt: null,
    flagReason: null,
    feedbackNotes: null,
    category: "bone_health",
  },
  {
    id: 3,
    timestamp: new Date("2026-03-21T10:45:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "cardiovascular_risk", scope: "lipid_panel" },
    aiSummary: "LDL cholesterol elevated at 162 mg/dL post-menopause. HDL declining to 45 mg/dL. Triglycerides normal. ApoB:ApoA1 ratio suggests increased cardiovascular risk. Estrogen decline is a contributing factor. Consider statin therapy discussion.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 72.8,
    sourceReferences: [
      {
        sourceSystem: "LabCorp",
        documentId: "LAB-2026-03-05-LIP-8812",
        excerpt: "Total Cholesterol: 228 mg/dL. LDL-C: 162 mg/dL. HDL-C: 45 mg/dL. Triglycerides: 105 mg/dL.",
        highlightRange: { start: 0, end: 85 },
      },
    ],
    explainabilityFactors: [
      { factor: "Elevated LDL (162 mg/dL)", weight: 0.45, direction: "positive" },
      { factor: "Low HDL (45 mg/dL)", weight: 0.30, direction: "positive" },
      { factor: "Post-menopausal status", weight: 0.15, direction: "moderate" },
    ],
    verificationStatus: "flagged",
    verifiedBy: "Dr. James Park, MD",
    verifiedAt: new Date("2026-03-21T16:30:00Z"),
    flagReason: "ApoB:ApoA1 ratio was not directly measured in labs; AI inferred from standard lipid panel. Recommend ordering advanced lipid panel for accurate assessment.",
    feedbackNotes: "Inference about ApoB:ApoA1 ratio needs direct measurement. Updated treatment plan to include advanced lipid testing before statin discussion.",
    category: "cardiovascular",
  },
  {
    id: 4,
    timestamp: new Date("2026-03-21T09:00:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "mental_health", scope: "cognitive_function" },
    aiSummary: "Cognitive assessment scores indicate mild decline in working memory and executive function. Pattern is consistent with hormonal-mediated cognitive changes during menopausal transition rather than early neurodegeneration. HRT may improve symptoms.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 81.3,
    sourceReferences: [
      {
        sourceSystem: "Epic MyChart",
        documentId: "DOC-2026-03-01-NEURO-0234",
        excerpt: "MoCA Score: 25/30. Deficits in delayed recall (2/5) and serial 7s (3/5). Language and orientation intact.",
        highlightRange: { start: 0, end: 91 },
      },
      {
        sourceSystem: "Epic MyChart",
        documentId: "DOC-2026-02-28-PSY-0789",
        excerpt: "PHQ-9 score: 8 (mild depression). GAD-7 score: 6 (mild anxiety). Sleep quality index: poor.",
        highlightRange: { start: 0, end: 89 },
      },
    ],
    explainabilityFactors: [
      { factor: "MoCA Score (25/30)", weight: 0.35, direction: "moderate" },
      { factor: "Low Estradiol Impact", weight: 0.32, direction: "positive" },
      { factor: "Sleep Disruption", weight: 0.21, direction: "positive" },
    ],
    verificationStatus: "verified",
    verifiedBy: "Dr. Lisa Wu, MD",
    verifiedAt: new Date("2026-03-21T14:00:00Z"),
    flagReason: null,
    feedbackNotes: "Agree with hormonal etiology. Added neuropsych follow-up in 6 months.",
    category: "cognitive",
  },
  {
    id: 5,
    timestamp: new Date("2026-03-20T16:20:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "sleep_analysis", scope: "vasomotor" },
    aiSummary: "Wearable data shows 5.2 avg hours sleep with 12 nocturnal awakenings per week correlating with vasomotor episodes. Core body temperature elevations of 1.2°F detected 15-20 min before each awakening.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 91.0,
    sourceReferences: [
      {
        sourceSystem: "Apple Health (Wearable)",
        documentId: "WEAR-2026-03-14-SLEEP-0055",
        excerpt: "7-day avg sleep: 5.2 hrs. REM: 14%. Deep: 8%. Awakenings: 12/week. Heart rate variability decreased 23% vs 6mo prior.",
        highlightRange: { start: 0, end: 105 },
      },
    ],
    explainabilityFactors: [
      { factor: "Nocturnal Awakenings (12/wk)", weight: 0.40, direction: "positive" },
      { factor: "Core Temp Elevation", weight: 0.33, direction: "positive" },
      { factor: "Reduced HRV (-23%)", weight: 0.17, direction: "positive" },
    ],
    verificationStatus: "pending",
    verifiedBy: null,
    verifiedAt: null,
    flagReason: null,
    feedbackNotes: null,
    category: "sleep_vasomotor",
  },
  {
    id: 6,
    timestamp: new Date("2026-03-20T11:00:00Z"),
    patientId: "demo-patient",
    requestPayload: { type: "medication_interaction", scope: "hrt_safety" },
    aiSummary: "No contraindications identified for transdermal estradiol + micronized progesterone. CYP3A4 interaction with current sertraline is minimal. BRCA status negative. Family history of VTE is a relative consideration but transdermal route mitigates risk.",
    modelVersion: "med-gemini-2.0-pro",
    status: "completed",
    confidenceScore: 96.1,
    sourceReferences: [
      {
        sourceSystem: "Epic MyChart",
        documentId: "DOC-2025-11-20-GEN-0345",
        excerpt: "BRCA1/BRCA2: Negative. No pathogenic variants detected. Family history: Mother with DVT at age 68.",
        highlightRange: { start: 0, end: 92 },
      },
      {
        sourceSystem: "Surescripts",
        documentId: "RX-2026-03-01-MED-1122",
        excerpt: "Current medications: Sertraline 50mg daily, Vitamin D3 2000 IU daily, Calcium citrate 600mg BID.",
        highlightRange: { start: 0, end: 97 },
      },
    ],
    explainabilityFactors: [
      { factor: "BRCA Negative", weight: 0.35, direction: "negative" },
      { factor: "Transdermal Route (low VTE)", weight: 0.30, direction: "negative" },
      { factor: "CYP3A4 Interaction (minimal)", weight: 0.22, direction: "negative" },
    ],
    verificationStatus: "verified",
    verifiedBy: "Dr. Sarah Chen, MD",
    verifiedAt: new Date("2026-03-20T14:45:00Z"),
    flagReason: null,
    feedbackNotes: null,
    category: "medication_safety",
  },
];

class ClinicalAiAuditService {
  private records: AuditRecord[] = [...DEMO_AUDIT_RECORDS];

  getAuditRecords(filters?: { category?: string; verificationStatus?: string; confidenceBelow?: number }): AuditRecord[] {
    let result = [...this.records];

    if (filters?.category) {
      result = result.filter((r) => r.category === filters.category);
    }
    if (filters?.verificationStatus) {
      result = result.filter((r) => r.verificationStatus === filters.verificationStatus);
    }
    if (filters?.confidenceBelow) {
      result = result.filter((r) => r.confidenceScore < filters.confidenceBelow);
    }

    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getAuditRecord(id: number): AuditRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  verifyRecord(id: number, verifiedBy: string, notes?: string): AuditRecord | undefined {
    const record = this.records.find((r) => r.id === id);
    if (!record) return undefined;
    record.verificationStatus = "verified";
    record.verifiedBy = verifiedBy;
    record.verifiedAt = new Date();
    if (notes) record.feedbackNotes = notes;
    return record;
  }

  flagRecord(id: number, flaggedBy: string, reason: string, notes?: string): AuditRecord | undefined {
    const record = this.records.find((r) => r.id === id);
    if (!record) return undefined;
    record.verificationStatus = "flagged";
    record.verifiedBy = flaggedBy;
    record.verifiedAt = new Date();
    record.flagReason = reason;
    if (notes) record.feedbackNotes = notes;
    return record;
  }

  resetVerification(id: number): AuditRecord | undefined {
    const record = this.records.find((r) => r.id === id);
    if (!record) return undefined;
    record.verificationStatus = "pending";
    record.verifiedBy = null;
    record.verifiedAt = null;
    record.flagReason = null;
    record.feedbackNotes = null;
    return record;
  }

  getStatistics() {
    const total = this.records.length;
    const verified = this.records.filter((r) => r.verificationStatus === "verified").length;
    const flagged = this.records.filter((r) => r.verificationStatus === "flagged").length;
    const pending = this.records.filter((r) => r.verificationStatus === "pending").length;
    const lowConfidence = this.records.filter((r) => r.confidenceScore < 80).length;
    const avgConfidence = this.records.reduce((sum, r) => sum + r.confidenceScore, 0) / total;

    return {
      total,
      verified,
      flagged,
      pending,
      lowConfidence,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
      categories: [...new Set(this.records.map((r) => r.category))],
    };
  }
}

export const clinicalAiAuditService = new ClinicalAiAuditService();
