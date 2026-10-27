import { chatComplete } from "./ai-client";
import crypto from "crypto";

const DISCLAIMER = "AI-generated clinical analysis. Must be reviewed and verified by a licensed healthcare provider before any clinical decisions. This is not medical advice.";

export interface PatientChartData {
  patientId: string;
  patientName: string;
  demographics: { age: number; gender: string; ethnicity?: string; bmi?: number; smokingStatus?: string };
  conditions: Array<{ name: string; status: string; onsetDate?: string; severity?: string; icdCode?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; startDate?: string; adherence?: string }>;
  allergies: Array<{ substance: string; reaction?: string; severity?: string }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string; trend?: string }>;
  labResults: Array<{ name: string; value: number | string; unit: string; referenceRange?: string; date: string; flag?: string }>;
  recentVisits: Array<{ date: string; type: string; provider: string; summary: string }>;
  immunizations: Array<{ name: string; date: string; status?: string }>;
  procedures: Array<{ name: string; date: string; outcome?: string }>;
  familyHistory: Array<{ condition: string; relationship: string }>;
  socialHistory?: { smokingStatus?: string; alcoholUse?: string; exerciseFrequency?: string; occupation?: string };
  screenings: Array<{ name: string; date: string; result?: string; nextDue?: string }>;
}

export interface RiskFactor {
  id: string;
  condition: string;
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "very_high";
  contributing: string[];
  protective: string[];
  timeframe: string;
  recommendation: string;
  evidenceBasis: string;
  modifiable: boolean;
}

export interface RiskStratificationResult {
  patientId: string;
  overallRiskTier: "low" | "moderate" | "high" | "very_high";
  riskFactors: RiskFactor[];
  compositeScore: number;
  trendDirection: "improving" | "stable" | "worsening";
  keyInterventions: Array<{ intervention: string; expectedImpact: string; priority: "immediate" | "short_term" | "long_term" }>;
  generatedAt: string;
  disclaimer: string;
}

export interface HistorySummary {
  patientId: string;
  executiveSummary: string;
  timelineNarrative: string;
  activeProblems: Array<{ condition: string; status: string; management: string; lastReviewed: string }>;
  medicationSummary: { current: string[]; recentChanges: string[]; adherenceNotes: string };
  preventiveCare: { upToDate: string[]; overdue: string[]; upcoming: string[] };
  significantEvents: Array<{ date: string; event: string; impact: string }>;
  crossModuleInsights: string[];
  generatedAt: string;
  disclaimer: string;
}

export interface CareGap {
  id: string;
  category: "screening" | "immunization" | "monitoring" | "follow_up" | "medication" | "referral" | "lifestyle";
  severity: "critical" | "high" | "moderate" | "low";
  title: string;
  description: string;
  guideline: string;
  guidelineSource: string;
  lastCompleted?: string;
  dueDate?: string;
  overdueDays?: number;
  affectedConditions: string[];
  recommendedAction: string;
  estimatedImpact: string;
}

export interface CareGapAnalysisResult {
  patientId: string;
  totalGaps: number;
  criticalGaps: number;
  gapsByCategory: Record<string, number>;
  gaps: CareGap[];
  complianceScore: number;
  nextActions: Array<{ action: string; priority: string; deadline: string }>;
  generatedAt: string;
  disclaimer: string;
}

function buildChartDataPrompt(data: PatientChartData): string {
  let prompt = `PATIENT: ${data.patientName} (ID: ${data.patientId})
DEMOGRAPHICS: Age ${data.demographics.age}, ${data.demographics.gender}${data.demographics.ethnicity ? `, ${data.demographics.ethnicity}` : ""}${data.demographics.bmi ? `, BMI: ${data.demographics.bmi}` : ""}${data.demographics.smokingStatus ? `, Smoking: ${data.demographics.smokingStatus}` : ""}

CONDITIONS:
${data.conditions.length > 0 ? data.conditions.map(c => `- ${c.name} (status: ${c.status}${c.severity ? `, severity: ${c.severity}` : ""}${c.onsetDate ? `, onset: ${c.onsetDate}` : ""}${c.icdCode ? ` [${c.icdCode}]` : ""})`).join("\n") : "None listed"}

MEDICATIONS:
${data.medications.length > 0 ? data.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.startDate ? ` (since ${m.startDate})` : ""}${m.adherence ? ` [adherence: ${m.adherence}]` : ""}`).join("\n") : "None listed"}

ALLERGIES:
${data.allergies.length > 0 ? data.allergies.map(a => `- ${a.substance}${a.reaction ? ` (reaction: ${a.reaction})` : ""}${a.severity ? ` [${a.severity}]` : ""}`).join("\n") : "NKDA"}

VITALS (recent):
${data.vitals.length > 0 ? data.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})${v.trend ? ` [${v.trend}]` : ""}`).join("\n") : "Not available"}

LAB RESULTS:
${data.labResults.length > 0 ? data.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.flag ? ` [${l.flag}]` : ""}`).join("\n") : "Not available"}

RECENT VISITS:
${data.recentVisits.length > 0 ? data.recentVisits.map(v => `- ${v.date}: ${v.type} with ${v.provider} - ${v.summary}`).join("\n") : "None"}

IMMUNIZATIONS:
${data.immunizations.length > 0 ? data.immunizations.map(i => `- ${i.name} (${i.date})${i.status ? ` [${i.status}]` : ""}`).join("\n") : "None recorded"}

PROCEDURES:
${data.procedures.length > 0 ? data.procedures.map(p => `- ${p.name} (${p.date})${p.outcome ? ` - ${p.outcome}` : ""}`).join("\n") : "None"}

FAMILY HISTORY:
${data.familyHistory.length > 0 ? data.familyHistory.map(f => `- ${f.condition} (${f.relationship})`).join("\n") : "Not available"}

SOCIAL HISTORY:
${data.socialHistory ? Object.entries(data.socialHistory).filter(([,v]) => v).map(([k,v]) => `- ${k}: ${v}`).join("\n") : "Not available"}

SCREENINGS:
${data.screenings.length > 0 ? data.screenings.map(s => `- ${s.name} (${s.date})${s.result ? ` - ${s.result}` : ""}${s.nextDue ? ` [Next due: ${s.nextDue}]` : ""}`).join("\n") : "None recorded"}`;

  return prompt;
}

export class AIPatientChartIntelligence {
  private stats = {
    riskStratifications: 0,
    historySummaries: 0,
    careGapAnalyses: 0,
    fullAnalyses: 0,
  };

  async predictiveRiskStratification(patientData: PatientChartData): Promise<RiskStratificationResult> {
    console.log(`[ChartIntel] Running predictive risk stratification for patient ${patientData.patientId}`);

    const patientPrompt = buildChartDataPrompt(patientData);

    const systemPrompt = `You are an expert clinical risk stratification AI. Analyze the patient's complete medical data to predict risk levels for chronic diseases and complications.

Apply evidence-based risk scoring methodologies:
- Framingham Risk Score principles for cardiovascular disease
- ASCVD risk calculator factors
- CKD progression risk factors (KDIGO guidelines)
- Diabetes complication risk (ADA Standards of Care)
- Cancer screening risk factors (USPSTF guidelines)
- COPD exacerbation risk (GOLD guidelines)
- Falls risk for elderly patients (AGS/BGS guidelines)
- Mental health screening factors (PHQ-9, GAD-7 indicators)

For EACH identified risk:
1. Quantify the risk score (0-100)
2. Classify the risk level (low/moderate/high/very_high)
3. Identify modifiable vs non-modifiable contributing factors
4. Identify protective factors
5. Provide specific, actionable recommendations
6. Cite the evidence basis

Calculate a composite risk score (0-100) considering all conditions.
Determine overall trend direction from longitudinal data.
Suggest key interventions ranked by expected impact.

Respond in JSON:
{
  "overallRiskTier": "low|moderate|high|very_high",
  "compositeScore": <number 0-100>,
  "trendDirection": "improving|stable|worsening",
  "riskFactors": [
    {
      "condition": "Disease/condition name",
      "riskScore": <number 0-100>,
      "riskLevel": "low|moderate|high|very_high",
      "contributing": ["factor1", "factor2"],
      "protective": ["factor1"],
      "timeframe": "5-year|10-year|lifetime",
      "recommendation": "Specific action",
      "evidenceBasis": "Guideline or study name",
      "modifiable": true|false
    }
  ],
  "keyInterventions": [
    {
      "intervention": "Description",
      "expectedImpact": "Expected outcome",
      "priority": "immediate|short_term|long_term"
    }
  ]
}`;

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: patientPrompt },
        ],
        jsonMode: true,
        maxOutputTokens: 8192,
        dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals"],
        purpose: "clinical_decision_support",
        callerService: "ai-patient-chart-intelligence",
        callerMethod: "stratifyRisk",
      });

      const content = response.content;
      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);

      this.stats.riskStratifications++;

      return {
        patientId: patientData.patientId,
        overallRiskTier: parsed.overallRiskTier || "moderate",
        compositeScore: parsed.compositeScore || 50,
        trendDirection: parsed.trendDirection || "stable",
        riskFactors: (parsed.riskFactors || []).map((rf: any, idx: number) => ({
          id: crypto.randomUUID(),
          condition: rf.condition || "Unknown",
          riskScore: rf.riskScore || 50,
          riskLevel: rf.riskLevel || "moderate",
          contributing: rf.contributing || [],
          protective: rf.protective || [],
          timeframe: rf.timeframe || "10-year",
          recommendation: rf.recommendation || "",
          evidenceBasis: rf.evidenceBasis || "",
          modifiable: rf.modifiable !== false,
        })),
        keyInterventions: (parsed.keyInterventions || []).map((ki: any) => ({
          intervention: ki.intervention || "",
          expectedImpact: ki.expectedImpact || "",
          priority: ki.priority || "short_term",
        })),
        generatedAt: new Date().toISOString(),
        disclaimer: DISCLAIMER,
      };
    } catch (error: any) {
      console.error("[ChartIntel] Risk stratification error:", error.message);
      return this.getFallbackRiskResult(patientData);
    }
  }

  async summarizePatientHistory(patientData: PatientChartData): Promise<HistorySummary> {
    console.log(`[ChartIntel] Generating patient history summary for ${patientData.patientId}`);

    const patientPrompt = buildChartDataPrompt(patientData);

    const systemPrompt = `You are an expert clinical summarization AI. Generate a comprehensive, clinically relevant summary of the patient's entire medical history across all data modules.

Create a summary that:
1. Provides a concise executive summary (2-3 sentences) highlighting the most critical information
2. Builds a chronological narrative of the patient's health journey
3. Lists active problems with current management strategies
4. Summarizes the medication picture including recent changes
5. Assesses preventive care status (up-to-date, overdue, upcoming)
6. Highlights significant health events and their lasting impact
7. Identifies cross-module insights (e.g., how medications affect lab values, how conditions relate to each other)

Focus on clinical relevance and actionability. The summary should help a clinician quickly understand this patient's full picture during a clinical encounter.

Respond in JSON:
{
  "executiveSummary": "2-3 sentence overview of the patient",
  "timelineNarrative": "Chronological narrative of key health events",
  "activeProblems": [
    { "condition": "name", "status": "active/controlled/uncontrolled", "management": "current approach", "lastReviewed": "date" }
  ],
  "medicationSummary": {
    "current": ["med1 dose freq", "med2 dose freq"],
    "recentChanges": ["description of recent changes"],
    "adherenceNotes": "overall adherence assessment"
  },
  "preventiveCare": {
    "upToDate": ["screening1", "immunization1"],
    "overdue": ["screening2"],
    "upcoming": ["screening3 due date"]
  },
  "significantEvents": [
    { "date": "YYYY-MM-DD", "event": "description", "impact": "lasting effect" }
  ],
  "crossModuleInsights": ["insight1", "insight2"]
}`;

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: patientPrompt },
        ],
        jsonMode: true,
        maxOutputTokens: 8192,
        dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals", "immunizations", "clinical_notes"],
        purpose: "documentation",
        callerService: "ai-patient-chart-intelligence",
        callerMethod: "summarizePatientHistory",
      });

      const content = response.content;
      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);

      this.stats.historySummaries++;

      return {
        patientId: patientData.patientId,
        executiveSummary: parsed.executiveSummary || "Patient summary unavailable.",
        timelineNarrative: parsed.timelineNarrative || "",
        activeProblems: (parsed.activeProblems || []).map((p: any) => ({
          condition: p.condition || "",
          status: p.status || "active",
          management: p.management || "",
          lastReviewed: p.lastReviewed || "",
        })),
        medicationSummary: {
          current: parsed.medicationSummary?.current || [],
          recentChanges: parsed.medicationSummary?.recentChanges || [],
          adherenceNotes: parsed.medicationSummary?.adherenceNotes || "",
        },
        preventiveCare: {
          upToDate: parsed.preventiveCare?.upToDate || [],
          overdue: parsed.preventiveCare?.overdue || [],
          upcoming: parsed.preventiveCare?.upcoming || [],
        },
        significantEvents: (parsed.significantEvents || []).map((e: any) => ({
          date: e.date || "",
          event: e.event || "",
          impact: e.impact || "",
        })),
        crossModuleInsights: parsed.crossModuleInsights || [],
        generatedAt: new Date().toISOString(),
        disclaimer: DISCLAIMER,
      };
    } catch (error: any) {
      console.error("[ChartIntel] History summarization error:", error.message);
      return this.getFallbackHistorySummary(patientData);
    }
  }

  async analyzeCareGaps(patientData: PatientChartData): Promise<CareGapAnalysisResult> {
    console.log(`[ChartIntel] Analyzing care gaps for patient ${patientData.patientId}`);

    const ruleBasedGaps = this.detectRuleBasedCareGaps(patientData);

    const patientPrompt = buildChartDataPrompt(patientData);

    const systemPrompt = `You are an expert clinical quality AI. Identify gaps in care based on current evidence-based clinical guidelines and the patient's specific data.

Reference these key guidelines:
- USPSTF (US Preventive Services Task Force) screening recommendations
- ADA (American Diabetes Association) Standards of Care
- ACC/AHA Cardiovascular guidelines
- ACIP (Advisory Committee on Immunization Practices) vaccine schedules
- KDIGO (Kidney Disease) guidelines
- GOLD (COPD) guidelines
- ACS/NCCN Cancer screening guidelines
- HEDIS quality measures

For each gap identified:
1. Categorize it (screening, immunization, monitoring, follow_up, medication, referral, lifestyle)
2. Rate severity (critical, high, moderate, low)
3. Cite the specific guideline
4. Calculate how overdue (if applicable)
5. Provide the recommended action
6. Estimate the clinical impact of closing the gap

Do NOT include gaps that are already covered by the patient's documented screenings and care.

Also calculate an overall care compliance score (0-100) and list prioritized next actions.

Respond in JSON:
{
  "gaps": [
    {
      "category": "screening|immunization|monitoring|follow_up|medication|referral|lifestyle",
      "severity": "critical|high|moderate|low",
      "title": "Short title",
      "description": "Detailed description",
      "guideline": "Specific guideline recommendation",
      "guidelineSource": "Organization/publication",
      "lastCompleted": "date or null",
      "dueDate": "when it should have been done or null",
      "overdueDays": <number or null>,
      "affectedConditions": ["condition1"],
      "recommendedAction": "What to do",
      "estimatedImpact": "Expected benefit"
    }
  ],
  "complianceScore": <number 0-100>,
  "nextActions": [
    { "action": "description", "priority": "immediate|this_week|this_month|this_quarter", "deadline": "date" }
  ]
}`;

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: patientPrompt },
        ],
        jsonMode: true,
        maxOutputTokens: 8192,
        dataCategories: ["demographics", "conditions", "medications", "lab_results", "immunizations"],
        purpose: "clinical_decision_support",
        callerService: "ai-patient-chart-intelligence",
        callerMethod: "analyzeCareGaps",
      });

      const content = response.content;
      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);

      const aiGaps: CareGap[] = (parsed.gaps || []).map((g: any) => ({
        id: crypto.randomUUID(),
        category: g.category || "monitoring",
        severity: g.severity || "moderate",
        title: g.title || "",
        description: g.description || "",
        guideline: g.guideline || "",
        guidelineSource: g.guidelineSource || "",
        lastCompleted: g.lastCompleted || undefined,
        dueDate: g.dueDate || undefined,
        overdueDays: g.overdueDays || undefined,
        affectedConditions: g.affectedConditions || [],
        recommendedAction: g.recommendedAction || "",
        estimatedImpact: g.estimatedImpact || "",
      }));

      const allGaps = this.deduplicateGaps([...ruleBasedGaps, ...aiGaps]);
      const criticalGaps = allGaps.filter(g => g.severity === "critical").length;

      const gapsByCategory: Record<string, number> = {};
      allGaps.forEach(g => {
        gapsByCategory[g.category] = (gapsByCategory[g.category] || 0) + 1;
      });

      this.stats.careGapAnalyses++;

      return {
        patientId: patientData.patientId,
        totalGaps: allGaps.length,
        criticalGaps,
        gapsByCategory,
        gaps: allGaps.sort((a, b) => {
          const sevOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
          return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
        }),
        complianceScore: parsed.complianceScore || this.calculateComplianceScore(patientData, allGaps),
        nextActions: (parsed.nextActions || []).map((a: any) => ({
          action: a.action || "",
          priority: a.priority || "this_month",
          deadline: a.deadline || "",
        })),
        generatedAt: new Date().toISOString(),
        disclaimer: DISCLAIMER,
      };
    } catch (error: any) {
      console.error("[ChartIntel] Care gap analysis error:", error.message);
      return this.getFallbackCareGapResult(patientData, ruleBasedGaps);
    }
  }

  async runFullChartIntelligence(patientData: PatientChartData): Promise<{
    riskStratification: RiskStratificationResult;
    historySummary: HistorySummary;
    careGaps: CareGapAnalysisResult;
    generatedAt: string;
    disclaimer: string;
  }> {
    console.log(`[ChartIntel] Running full chart intelligence analysis for patient ${patientData.patientId}`);

    const [riskStratification, historySummary, careGaps] = await Promise.all([
      this.predictiveRiskStratification(patientData),
      this.summarizePatientHistory(patientData),
      this.analyzeCareGaps(patientData),
    ]);

    this.stats.fullAnalyses++;

    return {
      riskStratification,
      historySummary,
      careGaps,
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  }

  getStats() {
    return { ...this.stats };
  }

  private detectRuleBasedCareGaps(data: PatientChartData): CareGap[] {
    const gaps: CareGap[] = [];
    const age = data.demographics.age;
    const gender = data.demographics.gender.toLowerCase();
    const today = new Date();

    const hasCondition = (name: string) => data.conditions.some(c => c.name.toLowerCase().includes(name.toLowerCase()) && c.status !== "resolved");
    const hasScreening = (name: string) => data.screenings.some(s => s.name.toLowerCase().includes(name.toLowerCase()));
    const hasImmunization = (name: string) => data.immunizations.some(i => i.name.toLowerCase().includes(name.toLowerCase()));
    const hasRecentLab = (name: string, withinMonths: number) => {
      return data.labResults.some(l => {
        if (!l.name.toLowerCase().includes(name.toLowerCase())) return false;
        const labDate = new Date(l.date);
        const monthsAgo = (today.getTime() - labDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo <= withinMonths;
      });
    };

    if (hasCondition("diabetes") && !hasRecentLab("a1c", 6)) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "monitoring",
        severity: "high",
        title: "HbA1c Monitoring Overdue",
        description: "No HbA1c result found within the last 6 months for a diabetic patient.",
        guideline: "ADA recommends HbA1c testing at least every 6 months for patients meeting treatment goals, every 3 months if not at goal.",
        guidelineSource: "ADA Standards of Care 2026",
        affectedConditions: ["Diabetes"],
        recommendedAction: "Order HbA1c test",
        estimatedImpact: "Better glycemic monitoring reduces microvascular complication risk by up to 25%",
      });
    }

    if (hasCondition("diabetes") && !hasScreening("retinal") && !hasScreening("eye")) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "screening",
        severity: "high",
        title: "Diabetic Retinal Exam Overdue",
        description: "No retinal/eye exam documented for a diabetic patient.",
        guideline: "Annual dilated eye exam recommended for all diabetic patients.",
        guidelineSource: "ADA/AAO Guidelines",
        affectedConditions: ["Diabetes"],
        recommendedAction: "Refer for dilated eye exam",
        estimatedImpact: "Early detection of diabetic retinopathy prevents vision loss",
      });
    }

    if (hasCondition("kidney") && !hasRecentLab("creatinine", 6)) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "monitoring",
        severity: "high",
        title: "Renal Function Monitoring Overdue",
        description: "No serum creatinine/eGFR found within the last 6 months for a CKD patient.",
        guideline: "KDIGO recommends monitoring eGFR at least every 6 months for CKD stage 3+.",
        guidelineSource: "KDIGO CKD Guidelines",
        affectedConditions: ["Chronic Kidney Disease"],
        recommendedAction: "Order BMP with eGFR",
        estimatedImpact: "Timely monitoring enables early intervention for CKD progression",
      });
    }

    if (age >= 50 && age <= 75 && !hasScreening("colonoscopy") && !hasScreening("colon")) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "screening",
        severity: "moderate",
        title: "Colorectal Cancer Screening",
        description: "No colorectal cancer screening documented for a patient in the recommended age range.",
        guideline: "USPSTF recommends screening for colorectal cancer from age 45 to 75.",
        guidelineSource: "USPSTF 2021",
        affectedConditions: [],
        recommendedAction: "Discuss colorectal cancer screening options (colonoscopy, FIT, etc.)",
        estimatedImpact: "Screening reduces colorectal cancer mortality by up to 68%",
      });
    }

    if (gender === "female" && age >= 50 && !hasScreening("mammogram") && !hasScreening("breast")) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "screening",
        severity: "moderate",
        title: "Breast Cancer Screening",
        description: "No mammogram documented for a female patient age 50+.",
        guideline: "USPSTF recommends biennial mammography for women aged 50-74.",
        guidelineSource: "USPSTF 2024",
        affectedConditions: [],
        recommendedAction: "Schedule screening mammogram",
        estimatedImpact: "Regular screening reduces breast cancer mortality by approximately 20%",
      });
    }

    if (age >= 65 && !hasImmunization("pneumococcal") && !hasImmunization("PCV")) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "immunization",
        severity: "moderate",
        title: "Pneumococcal Vaccine",
        description: "No pneumococcal vaccination documented for patient age 65+.",
        guideline: "ACIP recommends PCV20 or PCV15 followed by PPSV23 for adults 65+.",
        guidelineSource: "ACIP 2024",
        affectedConditions: [],
        recommendedAction: "Administer PCV20 vaccine",
        estimatedImpact: "Reduces risk of invasive pneumococcal disease by 75%",
      });
    }

    if (age >= 50 && !hasImmunization("shingles") && !hasImmunization("zoster") && !hasImmunization("Shingrix")) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "immunization",
        severity: "low",
        title: "Shingles Vaccine",
        description: "No shingles vaccination documented for patient age 50+.",
        guideline: "ACIP recommends Shingrix for adults 50+ regardless of prior shingles episode.",
        guidelineSource: "ACIP 2024",
        affectedConditions: [],
        recommendedAction: "Offer Shingrix vaccine (2-dose series)",
        estimatedImpact: "Over 90% effective at preventing shingles and post-herpetic neuralgia",
      });
    }

    if (hasCondition("hypertension") && !hasRecentLab("lipid", 12) && !hasRecentLab("cholesterol", 12)) {
      gaps.push({
        id: crypto.randomUUID(),
        category: "monitoring",
        severity: "moderate",
        title: "Lipid Panel Overdue",
        description: "No lipid panel found in the last 12 months for a hypertensive patient.",
        guideline: "ACC/AHA recommends annual lipid monitoring for patients with cardiovascular risk factors.",
        guidelineSource: "ACC/AHA Cholesterol Guidelines 2024",
        affectedConditions: ["Hypertension"],
        recommendedAction: "Order fasting lipid panel",
        estimatedImpact: "Lipid monitoring supports cardiovascular risk reduction strategies",
      });
    }

    return gaps;
  }

  private deduplicateGaps(gaps: CareGap[]): CareGap[] {
    const seen = new Map<string, CareGap>();
    for (const gap of gaps) {
      const key = gap.title.toLowerCase().replace(/\s+/g, "_");
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, gap);
      } else {
        const sevOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
        if ((sevOrder[gap.severity] || 3) < (sevOrder[existing.severity] || 3)) {
          seen.set(key, gap);
        }
      }
    }
    return Array.from(seen.values());
  }

  private calculateComplianceScore(data: PatientChartData, gaps: CareGap[]): number {
    const totalChecks = gaps.length + data.screenings.length + data.immunizations.length;
    if (totalChecks === 0) return 80;
    const met = data.screenings.length + data.immunizations.length;
    return Math.round((met / totalChecks) * 100);
  }

  private getFallbackRiskResult(data: PatientChartData): RiskStratificationResult {
    const riskFactors: RiskFactor[] = [];
    const age = data.demographics.age;

    for (const condition of data.conditions) {
      const name = condition.name.toLowerCase();
      let riskScore = 40;
      let riskLevel: RiskFactor["riskLevel"] = "moderate";

      if (name.includes("diabetes")) { riskScore = 65; riskLevel = "high"; }
      else if (name.includes("hypertension")) { riskScore = 55; riskLevel = "moderate"; }
      else if (name.includes("kidney")) { riskScore = 60; riskLevel = "high"; }
      else if (name.includes("heart") || name.includes("cardiac")) { riskScore = 70; riskLevel = "high"; }

      if (age >= 65) riskScore = Math.min(100, riskScore + 10);

      riskFactors.push({
        id: crypto.randomUUID(),
        condition: condition.name,
        riskScore,
        riskLevel,
        contributing: [`Active ${condition.name}`, `Age ${age}`],
        protective: data.medications.length > 0 ? ["Active medication management"] : [],
        timeframe: "10-year",
        recommendation: `Continue monitoring and management of ${condition.name}`,
        evidenceBasis: "General clinical guidelines",
        modifiable: true,
      });
    }

    const compositeScore = riskFactors.length > 0
      ? Math.round(riskFactors.reduce((sum, rf) => sum + rf.riskScore, 0) / riskFactors.length)
      : 30;

    return {
      patientId: data.patientId,
      overallRiskTier: compositeScore >= 70 ? "high" : compositeScore >= 50 ? "moderate" : "low",
      compositeScore,
      trendDirection: "stable",
      riskFactors,
      keyInterventions: [{
        intervention: "Continue current treatment plan and monitoring",
        expectedImpact: "Maintain disease stability",
        priority: "short_term",
      }],
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  }

  private getFallbackHistorySummary(data: PatientChartData): HistorySummary {
    return {
      patientId: data.patientId,
      executiveSummary: `${data.patientName} is a ${data.demographics.age}-year-old ${data.demographics.gender} with ${data.conditions.length} active condition(s) on ${data.medications.length} medication(s).`,
      timelineNarrative: "Detailed timeline generation is temporarily unavailable. Please review individual records for chronological information.",
      activeProblems: data.conditions.map(c => ({
        condition: c.name,
        status: c.status,
        management: "See medication list",
        lastReviewed: c.onsetDate || "",
      })),
      medicationSummary: {
        current: data.medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`),
        recentChanges: [],
        adherenceNotes: "Adherence data not available",
      },
      preventiveCare: {
        upToDate: data.screenings.map(s => s.name),
        overdue: [],
        upcoming: [],
      },
      significantEvents: [],
      crossModuleInsights: [],
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  }

  private getFallbackCareGapResult(data: PatientChartData, ruleBasedGaps: CareGap[]): CareGapAnalysisResult {
    const gapsByCategory: Record<string, number> = {};
    ruleBasedGaps.forEach(g => {
      gapsByCategory[g.category] = (gapsByCategory[g.category] || 0) + 1;
    });

    return {
      patientId: data.patientId,
      totalGaps: ruleBasedGaps.length,
      criticalGaps: ruleBasedGaps.filter(g => g.severity === "critical").length,
      gapsByCategory,
      gaps: ruleBasedGaps,
      complianceScore: this.calculateComplianceScore(data, ruleBasedGaps),
      nextActions: ruleBasedGaps.slice(0, 3).map(g => ({
        action: g.recommendedAction,
        priority: g.severity === "critical" ? "immediate" : "this_month",
        deadline: "",
      })),
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  }
}

export const aiPatientChartIntelligence = new AIPatientChartIntelligence();
