import { chatComplete } from "./ai-client";

interface ChartCorrelation {
  id: string;
  type: "medication_effect" | "lab_trend" | "symptom_progression" | "treatment_response" | "risk_pattern" | "temporal_relationship";
  title: string;
  explanation: string;
  clinicalSignificance: "high" | "medium" | "low" | "informational";
  confidence: number;
  relatedRecords: string[];
  timespan: { start: Date; end: Date };
  dataPoints: Array<{ date: Date; value: any; label: string }>;
  patientFriendlyExplanation: string;
  providerContext?: string;
}

interface ChartInsight {
  id: string;
  category: "correlation" | "trend" | "risk" | "milestone" | "intervention" | "outcome";
  headline: string;
  detailedExplanation: string;
  evidenceStrength: "strong" | "moderate" | "suggestive" | "weak";
  actionable: boolean;
  suggestedActions?: string[];
  relatedCorrelations: string[];
  generatedAt: Date;
}

interface HealthNarrative {
  id: string;
  patientId: string;
  timeframe: { start: Date; end: Date };
  summary: string;
  chapters: NarrativeChapter[];
  keyFindings: string[];
  concernsIdentified: string[];
  positiveOutcomes: string[];
  generatedAt: Date;
}

interface NarrativeChapter {
  title: string;
  period: { start: Date; end: Date };
  content: string;
  keyEvents: string[];
  relatedConditions: string[];
  medications: string[];
}

interface MedicationLabCorrelation {
  medicationId: string;
  medicationName: string;
  startDate: Date;
  labTests: Array<{
    testId: string;
    testName: string;
    values: Array<{ date: Date; value: number; unit: string }>;
    trendSinceMedication: "increasing" | "decreasing" | "stable" | "fluctuating";
    percentChange: number;
    clinicallySignificant: boolean;
  }>;
  explanation: string;
  patientExplanation: string;
}

interface SymptomTimelineCorrelation {
  symptomId: string;
  symptomName: string;
  firstReported: Date;
  potentialCauses: Array<{
    type: "medication" | "condition" | "procedure" | "lifestyle";
    name: string;
    startDate: Date;
    correlationStrength: number;
    explanation: string;
  }>;
  progression: Array<{
    date: Date;
    severity: number;
    notes: string;
  }>;
}

const CORRELATION_PATTERNS = [
  {
    id: "creatinine_ace_inhibitor",
    medicationClass: "ACE Inhibitor",
    medications: ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
    labTest: "Creatinine",
    expectedDirection: "increase",
    threshold: 0.3,
    explanation: "ACE inhibitors can cause a mild increase in creatinine due to reduced glomerular pressure. A rise of up to 30% may be acceptable and doesn't necessarily require stopping the medication."
  },
  {
    id: "potassium_ace_inhibitor",
    medicationClass: "ACE Inhibitor",
    medications: ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
    labTest: "Potassium",
    expectedDirection: "increase",
    threshold: 0.5,
    explanation: "ACE inhibitors reduce aldosterone secretion, which can lead to potassium retention. Monitoring is especially important in patients with kidney disease or those taking potassium supplements."
  },
  {
    id: "glucose_steroids",
    medicationClass: "Corticosteroid",
    medications: ["prednisone", "dexamethasone", "hydrocortisone", "methylprednisolone"],
    labTest: "Glucose",
    expectedDirection: "increase",
    threshold: 20,
    explanation: "Corticosteroids increase blood glucose by promoting gluconeogenesis and reducing insulin sensitivity. Blood sugar monitoring is important during steroid therapy."
  },
  {
    id: "thyroid_amiodarone",
    medicationClass: "Antiarrhythmic",
    medications: ["amiodarone"],
    labTest: "TSH",
    expectedDirection: "variable",
    threshold: 2.0,
    explanation: "Amiodarone contains iodine and can cause both hypothyroidism and hyperthyroidism. Regular thyroid function monitoring is essential during therapy."
  },
  {
    id: "inr_warfarin",
    medicationClass: "Anticoagulant",
    medications: ["warfarin", "coumadin"],
    labTest: "INR",
    expectedDirection: "increase",
    threshold: 0.5,
    explanation: "Warfarin works by inhibiting vitamin K-dependent clotting factors, causing INR to increase. Target INR depends on the indication for anticoagulation."
  },
  {
    id: "hemoglobin_metformin",
    medicationClass: "Antidiabetic",
    medications: ["metformin"],
    labTest: "Hemoglobin A1c",
    expectedDirection: "decrease",
    threshold: 0.5,
    explanation: "Metformin improves insulin sensitivity and reduces hepatic glucose production, leading to lower blood sugar and consequently lower HbA1c over time."
  },
  {
    id: "ldl_statin",
    medicationClass: "Statin",
    medications: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lovastatin"],
    labTest: "LDL Cholesterol",
    expectedDirection: "decrease",
    threshold: 20,
    explanation: "Statins inhibit HMG-CoA reductase, the enzyme responsible for cholesterol synthesis in the liver. This leads to significant reductions in LDL cholesterol."
  },
  {
    id: "uric_acid_diuretic",
    medicationClass: "Thiazide Diuretic",
    medications: ["hydrochlorothiazide", "chlorthalidone", "indapamide"],
    labTest: "Uric Acid",
    expectedDirection: "increase",
    threshold: 1.0,
    explanation: "Thiazide diuretics can increase uric acid levels by reducing its excretion in the kidneys. This may trigger gout attacks in susceptible individuals."
  }
];

class AIChartExplanationService {
  private correlationCache: Map<string, ChartCorrelation[]> = new Map();
  private insightCache: Map<string, ChartInsight[]> = new Map();
  private narrativeCache: Map<string, HealthNarrative> = new Map();

  async analyzeChart(patientId: string, healthRecords: any[]): Promise<{
    correlations: ChartCorrelation[];
    insights: ChartInsight[];
    narrative: HealthNarrative;
  }> {
    const medications = healthRecords.filter(r => r.type === "medication");
    const labs = healthRecords.filter(r => r.type === "lab");
    const conditions = healthRecords.filter(r => r.type === "condition" || r.type === "diagnosis");
    const procedures = healthRecords.filter(r => r.type === "procedure");

    const correlations: ChartCorrelation[] = [];

    const medicationLabCorrelations = this.analyzeMedicationLabCorrelations(medications, labs);
    correlations.push(...medicationLabCorrelations);

    const trendCorrelations = this.analyzeLabTrends(labs, conditions);
    correlations.push(...trendCorrelations);

    const temporalCorrelations = this.analyzeTemporalRelationships(healthRecords);
    correlations.push(...temporalCorrelations);

    const treatmentCorrelations = this.analyzeTreatmentResponses(conditions, medications, labs);
    correlations.push(...treatmentCorrelations);

    const insights = await this.generateInsights(correlations, healthRecords);

    const narrative = await this.generateHealthNarrative(patientId, healthRecords, correlations, insights);

    this.correlationCache.set(patientId, correlations);
    this.insightCache.set(patientId, insights);
    this.narrativeCache.set(patientId, narrative);

    return { correlations, insights, narrative };
  }

  private analyzeMedicationLabCorrelations(medications: any[], labs: any[]): ChartCorrelation[] {
    const correlations: ChartCorrelation[] = [];

    for (const medication of medications) {
      const medName = medication.title?.toLowerCase() || "";
      const medStartDate = new Date(medication.date);

      for (const pattern of CORRELATION_PATTERNS) {
        if (pattern.medications.some(m => medName.includes(m))) {
          const relatedLabs = labs.filter(lab => {
            const labName = lab.title?.toLowerCase() || "";
            return labName.includes(pattern.labTest.toLowerCase());
          }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (relatedLabs.length >= 2) {
            const beforeMedLabs = relatedLabs.filter(l => new Date(l.date) < medStartDate);
            const afterMedLabs = relatedLabs.filter(l => new Date(l.date) >= medStartDate);

            if (beforeMedLabs.length > 0 && afterMedLabs.length > 0) {
              const beforeAvg = this.averageLabValue(beforeMedLabs);
              const afterAvg = this.averageLabValue(afterMedLabs);
              const change = afterAvg - beforeAvg;
              const percentChange = beforeAvg !== 0 ? (change / beforeAvg) * 100 : 0;

              const isExpected = 
                (pattern.expectedDirection === "increase" && change > 0) ||
                (pattern.expectedDirection === "decrease" && change < 0) ||
                pattern.expectedDirection === "variable";

              const dataPoints = relatedLabs.map(l => ({
                date: new Date(l.date),
                value: this.extractLabValue(l),
                label: l.title
              }));

              const patientExplanation = this.generatePatientFriendlyExplanation(
                medication.title,
                pattern.labTest,
                change,
                percentChange,
                pattern.explanation,
                medStartDate
              );

              correlations.push({
                id: `corr_${medication.id}_${pattern.labTest}`,
                type: "medication_effect",
                title: `${medication.title} effect on ${pattern.labTest}`,
                explanation: pattern.explanation,
                clinicalSignificance: Math.abs(percentChange) > 30 ? "high" : Math.abs(percentChange) > 15 ? "medium" : "low",
                confidence: isExpected ? 0.85 : 0.6,
                relatedRecords: [medication.id, ...relatedLabs.map(l => l.id)],
                timespan: { start: medStartDate, end: new Date(afterMedLabs[afterMedLabs.length - 1].date) },
                dataPoints,
                patientFriendlyExplanation: patientExplanation,
                providerContext: `${pattern.medicationClass} therapy initiated ${medStartDate.toLocaleDateString()}. ${pattern.labTest} ${change > 0 ? "increased" : "decreased"} by ${Math.abs(percentChange).toFixed(1)}% post-initiation.`
              });
            }
          }
        }
      }
    }

    return correlations;
  }

  private analyzeLabTrends(labs: any[], conditions: any[]): ChartCorrelation[] {
    const correlations: ChartCorrelation[] = [];

    const labsByType = new Map<string, any[]>();
    for (const lab of labs) {
      const key = lab.title || "Unknown";
      if (!labsByType.has(key)) labsByType.set(key, []);
      labsByType.get(key)!.push(lab);
    }

    for (const [labType, labResults] of labsByType) {
      if (labResults.length >= 3) {
        const sorted = labResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const values = sorted.map(l => this.extractLabValue(l)).filter(v => v !== null);
        
        if (values.length >= 3) {
          const trend = this.calculateTrend(values);
          const percentChange = values[0] !== 0 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;

          if (Math.abs(percentChange) > 10) {
            const dataPoints = sorted.map(l => ({
              date: new Date(l.date),
              value: this.extractLabValue(l),
              label: l.title
            }));

            const startDate = new Date(sorted[0].date);
            const endDate = new Date(sorted[sorted.length - 1].date);
            const monthsSpan = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

            correlations.push({
              id: `trend_${labType.replace(/\s+/g, "_")}_${Date.now()}`,
              type: "lab_trend",
              title: `${labType} ${trend > 0 ? "Rising" : "Declining"} Trend`,
              explanation: `Your ${labType} has ${trend > 0 ? "increased" : "decreased"} by ${Math.abs(percentChange).toFixed(1)}% over the past ${Math.round(monthsSpan)} months.`,
              clinicalSignificance: Math.abs(percentChange) > 25 ? "high" : "medium",
              confidence: 0.9,
              relatedRecords: sorted.map(l => l.id),
              timespan: { start: startDate, end: endDate },
              dataPoints,
              patientFriendlyExplanation: this.generateTrendExplanation(labType, trend, percentChange, monthsSpan),
              providerContext: `${labType} demonstrates ${trend > 0 ? "upward" : "downward"} trajectory. Rate of change: ${(percentChange / monthsSpan).toFixed(2)}%/month.`
            });
          }
        }
      }
    }

    return correlations;
  }

  private analyzeTemporalRelationships(records: any[]): ChartCorrelation[] {
    const correlations: ChartCorrelation[] = [];

    const sorted = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentDate = new Date(current.date);

      for (let j = i + 1; j < sorted.length; j++) {
        const future = sorted[j];
        const futureDate = new Date(future.date);
        const daysDiff = (futureDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 90) break;

        if (current.type === "condition" && future.type === "medication") {
          correlations.push({
            id: `temp_${current.id}_${future.id}`,
            type: "temporal_relationship",
            title: `${future.title} started after ${current.title}`,
            explanation: `${future.title} was prescribed ${Math.round(daysDiff)} days after the ${current.title} diagnosis.`,
            clinicalSignificance: "informational",
            confidence: 0.95,
            relatedRecords: [current.id, future.id],
            timespan: { start: currentDate, end: futureDate },
            dataPoints: [
              { date: currentDate, value: null, label: current.title },
              { date: futureDate, value: null, label: future.title }
            ],
            patientFriendlyExplanation: `Your doctor prescribed ${future.title} about ${Math.round(daysDiff)} days after diagnosing ${current.title}. This medication is likely being used to treat or manage that condition.`
          });
        }

        if (current.type === "procedure" && future.type === "lab") {
          correlations.push({
            id: `temp_${current.id}_${future.id}`,
            type: "temporal_relationship",
            title: `${future.title} monitored after ${current.title}`,
            explanation: `${future.title} was checked ${Math.round(daysDiff)} days after the ${current.title} procedure.`,
            clinicalSignificance: "informational",
            confidence: 0.9,
            relatedRecords: [current.id, future.id],
            timespan: { start: currentDate, end: futureDate },
            dataPoints: [
              { date: currentDate, value: null, label: current.title },
              { date: futureDate, value: null, label: future.title }
            ],
            patientFriendlyExplanation: `After your ${current.title} procedure, your doctor ordered ${future.title} testing to monitor your recovery and ensure everything is healing properly.`
          });
        }
      }
    }

    return correlations;
  }

  private analyzeTreatmentResponses(conditions: any[], medications: any[], labs: any[]): ChartCorrelation[] {
    const correlations: ChartCorrelation[] = [];

    const diabetesConditions = conditions.filter(c => 
      c.title?.toLowerCase().includes("diabetes") || 
      c.title?.toLowerCase().includes("a1c") ||
      c.title?.toLowerCase().includes("glucose")
    );

    if (diabetesConditions.length > 0) {
      const diabetesMeds = medications.filter(m =>
        m.title?.toLowerCase().includes("metformin") ||
        m.title?.toLowerCase().includes("insulin") ||
        m.title?.toLowerCase().includes("glipizide") ||
        m.title?.toLowerCase().includes("januvia") ||
        m.title?.toLowerCase().includes("ozempic")
      );

      const a1cLabs = labs.filter(l => 
        l.title?.toLowerCase().includes("a1c") ||
        l.title?.toLowerCase().includes("hemoglobin")
      );

      if (diabetesMeds.length > 0 && a1cLabs.length >= 2) {
        const sortedLabs = a1cLabs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstA1c = this.extractLabValue(sortedLabs[0]);
        const lastA1c = this.extractLabValue(sortedLabs[sortedLabs.length - 1]);

        if (firstA1c && lastA1c) {
          const change = lastA1c - firstA1c;
          const isImproving = change < 0;

          correlations.push({
            id: `treatment_diabetes_${Date.now()}`,
            type: "treatment_response",
            title: `Diabetes Management ${isImproving ? "Improving" : "Needs Attention"}`,
            explanation: `Your HbA1c has ${isImproving ? "decreased" : "increased"} from ${firstA1c.toFixed(1)}% to ${lastA1c.toFixed(1)}% while on ${diabetesMeds.map(m => m.title).join(", ")}.`,
            clinicalSignificance: Math.abs(change) > 0.5 ? "high" : "medium",
            confidence: 0.85,
            relatedRecords: [...diabetesMeds.map(m => m.id), ...sortedLabs.map(l => l.id)],
            timespan: { start: new Date(sortedLabs[0].date), end: new Date(sortedLabs[sortedLabs.length - 1].date) },
            dataPoints: sortedLabs.map(l => ({
              date: new Date(l.date),
              value: this.extractLabValue(l),
              label: l.title
            })),
            patientFriendlyExplanation: isImproving 
              ? `Great news! Your diabetes control has been improving. Your HbA1c dropped from ${firstA1c.toFixed(1)}% to ${lastA1c.toFixed(1)}%, showing that your treatment plan is working.`
              : `Your HbA1c has risen from ${firstA1c.toFixed(1)}% to ${lastA1c.toFixed(1)}%. This might indicate that adjustments to your diabetes management plan could be helpful. Consider discussing this with your doctor.`,
            providerContext: `HbA1c trajectory: ${firstA1c.toFixed(1)}% → ${lastA1c.toFixed(1)}% (${change > 0 ? "+" : ""}${change.toFixed(1)}%). Current regimen: ${diabetesMeds.map(m => m.title).join(", ")}.`
          });
        }
      }
    }

    return correlations;
  }

  private async generateInsights(correlations: ChartCorrelation[], records: any[]): Promise<ChartInsight[]> {
    const insights: ChartInsight[] = [];

    const highSignificanceCorrelations = correlations.filter(c => c.clinicalSignificance === "high");
    for (const correlation of highSignificanceCorrelations) {
      insights.push({
        id: `insight_${correlation.id}`,
        category: correlation.type === "treatment_response" ? "outcome" : "correlation",
        headline: correlation.title,
        detailedExplanation: correlation.patientFriendlyExplanation,
        evidenceStrength: correlation.confidence > 0.8 ? "strong" : "moderate",
        actionable: true,
        suggestedActions: this.suggestActions(correlation),
        relatedCorrelations: [correlation.id],
        generatedAt: new Date()
      });
    }

    const trends = correlations.filter(c => c.type === "lab_trend");
    for (const trend of trends) {
      const concerningTrend = trend.dataPoints.length > 0 && 
        Math.abs((trend.dataPoints[trend.dataPoints.length - 1].value - trend.dataPoints[0].value) / trend.dataPoints[0].value) > 0.2;

      if (concerningTrend) {
        insights.push({
          id: `insight_trend_${trend.id}`,
          category: "trend",
          headline: `Monitor: ${trend.title}`,
          detailedExplanation: trend.patientFriendlyExplanation,
          evidenceStrength: "strong",
          actionable: true,
          suggestedActions: ["Discuss this trend with your healthcare provider", "Ask if any lifestyle changes could help"],
          relatedCorrelations: [trend.id],
          generatedAt: new Date()
        });
      }
    }

    return insights;
  }

  private async generateHealthNarrative(
    patientId: string, 
    records: any[], 
    correlations: ChartCorrelation[],
    insights: ChartInsight[]
  ): Promise<HealthNarrative> {
    const sorted = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startDate = sorted.length > 0 ? new Date(sorted[0].date) : new Date();
    const endDate = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date) : new Date();

    const chapters = this.generateChapters(sorted, correlations);

    const keyFindings = correlations
      .filter(c => c.clinicalSignificance === "high" || c.clinicalSignificance === "medium")
      .map(c => c.patientFriendlyExplanation);

    const concernsIdentified = insights
      .filter(i => i.actionable && i.category !== "outcome")
      .map(i => i.headline);

    const positiveOutcomes = correlations
      .filter(c => c.type === "treatment_response" && c.title.toLowerCase().includes("improving"))
      .map(c => c.patientFriendlyExplanation);

    const summary = this.generateSummary(records, correlations, insights);

    return {
      id: `narrative_${patientId}_${Date.now()}`,
      patientId,
      timeframe: { start: startDate, end: endDate },
      summary,
      chapters,
      keyFindings,
      concernsIdentified,
      positiveOutcomes,
      generatedAt: new Date()
    };
  }

  private generateChapters(records: any[], correlations: ChartCorrelation[]): NarrativeChapter[] {
    const chapters: NarrativeChapter[] = [];
    
    const yearGroups = new Map<number, any[]>();
    for (const record of records) {
      const year = new Date(record.date).getFullYear();
      if (!yearGroups.has(year)) yearGroups.set(year, []);
      yearGroups.get(year)!.push(record);
    }

    for (const [year, yearRecords] of Array.from(yearGroups.entries()).sort((a, b) => b[0] - a[0])) {
      const conditions = yearRecords.filter(r => r.type === "condition" || r.type === "diagnosis");
      const medications = yearRecords.filter(r => r.type === "medication");
      const keyEvents = yearRecords
        .filter(r => r.type === "procedure" || r.type === "imaging")
        .map(r => `${r.title} (${new Date(r.date).toLocaleDateString()})`);

      const content = this.generateYearContent(yearRecords, correlations);

      chapters.push({
        title: `${year} Health Summary`,
        period: { start: new Date(`${year}-01-01`), end: new Date(`${year}-12-31`) },
        content,
        keyEvents,
        relatedConditions: conditions.map(c => c.title),
        medications: medications.map(m => m.title)
      });
    }

    return chapters;
  }

  private generateYearContent(records: any[], correlations: ChartCorrelation[]): string {
    const conditions = records.filter(r => r.type === "condition" || r.type === "diagnosis");
    const medications = records.filter(r => r.type === "medication");
    const labs = records.filter(r => r.type === "lab");
    const procedures = records.filter(r => r.type === "procedure");

    let content = "";

    if (conditions.length > 0) {
      content += `Diagnoses: ${conditions.map(c => c.title).join(", ")}. `;
    }

    if (medications.length > 0) {
      content += `Medications prescribed: ${medications.map(m => m.title).slice(0, 5).join(", ")}${medications.length > 5 ? ` and ${medications.length - 5} others` : ""}. `;
    }

    if (procedures.length > 0) {
      content += `Procedures performed: ${procedures.map(p => p.title).join(", ")}. `;
    }

    if (labs.length > 0) {
      content += `${labs.length} lab tests conducted for monitoring. `;
    }

    const yearCorrelations = correlations.filter(c => 
      records.some(r => c.relatedRecords.includes(r.id))
    );

    if (yearCorrelations.length > 0) {
      const notable = yearCorrelations.find(c => c.clinicalSignificance === "high");
      if (notable) {
        content += notable.patientFriendlyExplanation;
      }
    }

    return content || "No significant health events recorded during this period.";
  }

  private generateSummary(records: any[], correlations: ChartCorrelation[], insights: ChartInsight[]): string {
    const conditions = [...new Set(records.filter(r => r.type === "condition" || r.type === "diagnosis").map(r => r.title))];
    const activeInsights = insights.filter(i => i.actionable).length;
    const positiveOutcomes = correlations.filter(c => c.type === "treatment_response" && c.title.toLowerCase().includes("improving")).length;

    let summary = `Your health record spans ${records.length} documented events. `;
    
    if (conditions.length > 0) {
      summary += `Key conditions include ${conditions.slice(0, 3).join(", ")}${conditions.length > 3 ? ` and ${conditions.length - 3} others` : ""}. `;
    }

    if (positiveOutcomes > 0) {
      summary += `${positiveOutcomes} treatment response${positiveOutcomes > 1 ? "s are" : " is"} showing positive progress. `;
    }

    if (activeInsights > 0) {
      summary += `There are ${activeInsights} item${activeInsights > 1 ? "s" : ""} worth discussing with your healthcare provider.`;
    }

    return summary;
  }

  private suggestActions(correlation: ChartCorrelation): string[] {
    const actions: string[] = [];

    if (correlation.type === "medication_effect") {
      actions.push("Continue taking your medication as prescribed");
      actions.push("Mention this trend at your next doctor's visit");
      if (correlation.clinicalSignificance === "high") {
        actions.push("Consider scheduling a follow-up appointment sooner");
      }
    }

    if (correlation.type === "lab_trend") {
      actions.push("Track any symptoms you notice");
      actions.push("Discuss lifestyle factors that might influence this");
    }

    if (correlation.type === "treatment_response") {
      if (correlation.title.toLowerCase().includes("improving")) {
        actions.push("Keep up with your current treatment plan");
        actions.push("Continue healthy lifestyle habits");
      } else {
        actions.push("Schedule a follow-up with your provider");
        actions.push("Discuss treatment adjustments");
      }
    }

    return actions;
  }

  private generatePatientFriendlyExplanation(
    medicationName: string,
    labTest: string,
    change: number,
    percentChange: number,
    technicalExplanation: string,
    startDate: Date
  ): string {
    const direction = change > 0 ? "risen" : "dropped";
    const magnitude = Math.abs(percentChange) > 25 ? "significantly" : Math.abs(percentChange) > 10 ? "noticeably" : "slightly";
    
    return `Since starting ${medicationName} in ${startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}, your ${labTest} level has ${direction} ${magnitude} (about ${Math.abs(percentChange).toFixed(0)}%). This is a known effect of this medication and is being monitored by your healthcare team.`;
  }

  private generateTrendExplanation(labType: string, trend: number, percentChange: number, monthsSpan: number): string {
    const direction = trend > 0 ? "been increasing" : "been decreasing";
    const timeFrame = monthsSpan >= 12 ? `${Math.round(monthsSpan / 12)} year${monthsSpan >= 24 ? "s" : ""}` : `${Math.round(monthsSpan)} months`;
    
    return `Over the past ${timeFrame}, your ${labType} has ${direction}. The overall change is about ${Math.abs(percentChange).toFixed(0)}%. This pattern is something to monitor and discuss with your healthcare provider at your next visit.`;
  }

  private averageLabValue(labs: any[]): number {
    const values = labs.map(l => this.extractLabValue(l)).filter(v => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private extractLabValue(lab: any): number | null {
    if (lab.details?.value !== undefined) return Number(lab.details.value);
    if (lab.value !== undefined) return Number(lab.value);
    
    const summaryMatch = lab.summary?.match(/[\d.]+/);
    if (summaryMatch) return Number(summaryMatch[0]);
    
    return null;
  }

  private calculateTrend(values: (number | null)[]): number {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length < 2) return 0;
    
    const n = validValues.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = validValues.reduce((a, b) => a + b, 0);
    const sumXY = validValues.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  async explainWithAI(patientId: string, question: string): Promise<string> {
    const correlations = this.correlationCache.get(patientId) || [];
    const insights = this.insightCache.get(patientId) || [];
    const narrative = this.narrativeCache.get(patientId);

    const context = `
Patient Health Context:
${narrative?.summary || "No narrative available."}

Key Correlations Found:
${correlations.slice(0, 5).map(c => `- ${c.title}: ${c.patientFriendlyExplanation}`).join("\n")}

Key Insights:
${insights.slice(0, 5).map(i => `- ${i.headline}: ${i.detailedExplanation}`).join("\n")}
`;

    try {
      const result = await chatComplete({
        messages: [
          {
            role: "system",
            content: `You are a health education assistant helping patients understand their health records. 
You explain medical information in plain, friendly language. You do NOT diagnose or recommend treatments.
You help patients understand patterns, correlations, and what questions to ask their doctor.
Be warm, clear, and empowering. Use analogies when helpful.`,
          },
          {
            role: "user",
            content: `Based on this patient's health context:\n\n${context}\n\nPatient's question: ${question}`,
          },
        ],
        model: "balanced",
        maxOutputTokens: 500,
        temperature: 0.7,
        dataCategories: ["conditions", "medications", "lab_results", "vitals", "clinical_notes"],
        purpose: "patient_education",
        userId: patientId,
        callerService: "ai-chart-explanation-service",
        callerMethod: "explainWithAI",
      });

      return result.content || "I wasn't able to generate an explanation. Please try asking differently.";
    } catch (error) {
      console.error("AI explanation error:", error);
      return "I'm having trouble generating an explanation right now. Please try again later.";
    }
  }

  getCorrelations(patientId: string): ChartCorrelation[] {
    return this.correlationCache.get(patientId) || [];
  }

  getInsights(patientId: string): ChartInsight[] {
    return this.insightCache.get(patientId) || [];
  }

  getNarrative(patientId: string): HealthNarrative | null {
    return this.narrativeCache.get(patientId) || null;
  }
}

export const aiChartExplanationService = new AIChartExplanationService();

export function initializeAIChartExplanation() {
  console.log("AI chart explanation service initialized");
}
