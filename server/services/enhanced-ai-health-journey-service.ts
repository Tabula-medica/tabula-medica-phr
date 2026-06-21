import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI();
  }
} catch (error) {
  console.log("[EnhancedAIHealthJourney] OpenAI client not available");
}

export interface VitalTrendAnalysis {
  vitalName: string;
  currentValue: number;
  unit: string;
  normalRange: { min: number; max: number };
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  percentChange: number;
  dataPoints: Array<{ date: string; value: number }>;
  timeframeDays: number;
  clinicalSignificance: "normal" | "borderline" | "concerning" | "critical";
  aiInsight: string;
}

export interface LabTrendAnalysis {
  testName: string;
  testCode: string;
  currentValue: number;
  unit: string;
  normalRange: { min: number; max: number };
  historicalData: Array<{ date: string; value: number }>;
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  percentChange: number;
  timeframeDays: number;
  clinicalSignificance: "normal" | "borderline" | "concerning" | "critical";
  aiInsight: string;
  correlatedConditions: string[];
}

export interface MedicationAnalysis {
  medicationName: string;
  dosage: string;
  frequency: string;
  purpose: string;
  adherenceRate: number;
  adherenceStatus: "excellent" | "good" | "needs_improvement" | "poor";
  missedDosePattern?: string;
  potentialInteractions: Array<{
    interactingWith: string;
    severity: "minor" | "moderate" | "major";
    description: string;
    recommendation: string;
  }>;
  sideEffectRisk: "low" | "moderate" | "high";
  aiRecommendation: string;
}

export interface EpisodeOfCareSummary {
  id: string;
  episodeType: "chronic" | "acute" | "preventive" | "maternity" | "mental_health" | "surgical" | "rehabilitation";
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  status: "active" | "resolved" | "ongoing" | "monitoring";
  primaryCondition: string;
  relatedDataPoints: Array<{
    type: "condition" | "medication" | "lab" | "vital" | "procedure" | "encounter";
    id: string;
    name: string;
    date: string;
    relevance: string;
  }>;
  carePlanGoals: string[];
  progressSummary: string;
  nextSteps: string[];
  aiAnalysis: string;
}

export interface ProactiveHealthAlert {
  id: string;
  alertType: "risk_prediction" | "trend_warning" | "preventive_care" | "medication_alert" | "lifestyle_recommendation";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  evidenceBasis: string[];
  recommendedActions: string[];
  timeframe: string;
  confidenceLevel: number;
  relatedMetrics: Array<{ name: string; value: string; trend: string }>;
  createdAt: string;
}

export interface EnhancedHealthJourneySummary {
  patientId: string;
  generatedAt: string;
  overallHealthScore: number;
  executiveSummary: string;
  vitalTrends: VitalTrendAnalysis[];
  labTrends: LabTrendAnalysis[];
  medicationAnalysis: MedicationAnalysis[];
  episodesOfCare: EpisodeOfCareSummary[];
  proactiveAlerts: ProactiveHealthAlert[];
  aiNarrative: string;
  specialistNotes: string;
  disclaimer: string;
}

class EnhancedAIHealthJourneyService {
  private generateLongTermHealthData() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const daysAgo = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return formatDate(d);
    };

    const generateHistoricalData = (
      baseValue: number,
      variance: number,
      trend: "up" | "down" | "stable",
      days: number,
      interval: number = 30
    ) => {
      const data: Array<{ date: string; value: number }> = [];
      let currentValue = baseValue;
      const trendFactor = trend === "up" ? 0.02 : trend === "down" ? -0.02 : 0;
      
      for (let i = days; i >= 0; i -= interval) {
        const randomVariance = (Math.random() - 0.5) * variance;
        currentValue = currentValue * (1 + trendFactor) + randomVariance;
        data.push({
          date: daysAgo(i),
          value: Math.round(currentValue * 10) / 10
        });
      }
      return data;
    };

    return {
      vitals: [
        {
          name: "Blood Pressure (Systolic)",
          currentValue: 138,
          unit: "mmHg",
          normalRange: { min: 90, max: 120 },
          historicalData: generateHistoricalData(145, 10, "down", 365, 14),
        },
        {
          name: "Blood Pressure (Diastolic)",
          currentValue: 88,
          unit: "mmHg",
          normalRange: { min: 60, max: 80 },
          historicalData: generateHistoricalData(92, 8, "down", 365, 14),
        },
        {
          name: "Heart Rate",
          currentValue: 72,
          unit: "bpm",
          normalRange: { min: 60, max: 100 },
          historicalData: generateHistoricalData(78, 10, "down", 365, 14),
        },
        {
          name: "Weight",
          currentValue: 185,
          unit: "lbs",
          normalRange: { min: 150, max: 180 },
          historicalData: generateHistoricalData(195, 5, "down", 365, 30),
        },
        {
          name: "BMI",
          currentValue: 27.3,
          unit: "kg/m²",
          normalRange: { min: 18.5, max: 24.9 },
          historicalData: generateHistoricalData(28.8, 0.5, "down", 365, 30),
        },
      ],
      labResults: [
        {
          name: "HbA1c",
          code: "4548-4",
          currentValue: 7.2,
          unit: "%",
          normalRange: { min: 4.0, max: 5.7 },
          historicalData: generateHistoricalData(8.1, 0.3, "down", 365, 90),
          correlatedConditions: ["Type 2 Diabetes Mellitus"],
        },
        {
          name: "Fasting Glucose",
          code: "1558-6",
          currentValue: 142,
          unit: "mg/dL",
          normalRange: { min: 70, max: 100 },
          historicalData: generateHistoricalData(165, 20, "down", 365, 30),
          correlatedConditions: ["Type 2 Diabetes Mellitus"],
        },
        {
          name: "LDL Cholesterol",
          code: "13457-7",
          currentValue: 118,
          unit: "mg/dL",
          normalRange: { min: 0, max: 100 },
          historicalData: generateHistoricalData(145, 15, "down", 365, 90),
          correlatedConditions: ["Hyperlipidemia"],
        },
        {
          name: "HDL Cholesterol",
          code: "2085-9",
          currentValue: 48,
          unit: "mg/dL",
          normalRange: { min: 40, max: 60 },
          historicalData: generateHistoricalData(42, 5, "up", 365, 90),
          correlatedConditions: ["Hyperlipidemia"],
        },
        {
          name: "Total Cholesterol",
          code: "2093-3",
          currentValue: 195,
          unit: "mg/dL",
          normalRange: { min: 0, max: 200 },
          historicalData: generateHistoricalData(235, 20, "down", 365, 90),
          correlatedConditions: ["Hyperlipidemia"],
        },
        {
          name: "Triglycerides",
          code: "2571-8",
          currentValue: 165,
          unit: "mg/dL",
          normalRange: { min: 0, max: 150 },
          historicalData: generateHistoricalData(210, 30, "down", 365, 90),
          correlatedConditions: ["Hyperlipidemia"],
        },
        {
          name: "eGFR",
          code: "33914-3",
          currentValue: 78,
          unit: "mL/min/1.73m²",
          normalRange: { min: 90, max: 120 },
          historicalData: generateHistoricalData(82, 5, "stable", 365, 90),
          correlatedConditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension"],
        },
        {
          name: "Creatinine",
          code: "2160-0",
          currentValue: 1.1,
          unit: "mg/dL",
          normalRange: { min: 0.7, max: 1.3 },
          historicalData: generateHistoricalData(1.0, 0.1, "stable", 365, 90),
          correlatedConditions: [],
        },
      ],
      medications: [
        {
          name: "Metformin",
          dosage: "1000mg",
          frequency: "Twice daily",
          purpose: "Blood sugar control",
          startDate: daysAgo(700),
          adherenceRate: 92,
          refillHistory: [
            { date: daysAgo(30), onTime: true },
            { date: daysAgo(60), onTime: true },
            { date: daysAgo(95), onTime: false, delayDays: 5 },
            { date: daysAgo(120), onTime: true },
          ],
          potentialInteractions: [],
        },
        {
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "Once daily",
          purpose: "Blood pressure control",
          startDate: daysAgo(1000),
          adherenceRate: 88,
          refillHistory: [
            { date: daysAgo(30), onTime: true },
            { date: daysAgo(65), onTime: false, delayDays: 5 },
            { date: daysAgo(90), onTime: true },
            { date: daysAgo(125), onTime: false, delayDays: 3 },
          ],
          potentialInteractions: [
            {
              interactingWith: "Potassium supplements",
              severity: "moderate" as const,
              description: "May increase potassium levels",
              recommendation: "Monitor potassium levels regularly",
            },
          ],
        },
        {
          name: "Atorvastatin",
          dosage: "20mg",
          frequency: "Once daily at bedtime",
          purpose: "Cholesterol management",
          startDate: daysAgo(350),
          adherenceRate: 95,
          refillHistory: [
            { date: daysAgo(30), onTime: true },
            { date: daysAgo(60), onTime: true },
            { date: daysAgo(90), onTime: true },
            { date: daysAgo(120), onTime: true },
          ],
          potentialInteractions: [
            {
              interactingWith: "Grapefruit juice",
              severity: "moderate" as const,
              description: "May increase statin levels and side effect risk",
              recommendation: "Avoid consuming grapefruit products",
            },
          ],
        },
        {
          name: "Aspirin",
          dosage: "81mg",
          frequency: "Once daily",
          purpose: "Cardiovascular protection",
          startDate: daysAgo(365),
          adherenceRate: 90,
          refillHistory: [
            { date: daysAgo(30), onTime: true },
            { date: daysAgo(60), onTime: true },
            { date: daysAgo(90), onTime: true },
          ],
          potentialInteractions: [
            {
              interactingWith: "Ibuprofen",
              severity: "moderate" as const,
              description: "May reduce aspirin's cardioprotective effect",
              recommendation: "Take aspirin at least 30 minutes before ibuprofen if needed",
            },
          ],
        },
      ],
      conditions: [
        { name: "Type 2 Diabetes Mellitus", code: "E11.9", status: "active", onsetDate: daysAgo(730), severity: "moderate" },
        { name: "Essential Hypertension", code: "I10", status: "active", onsetDate: daysAgo(1095), severity: "mild" },
        { name: "Hyperlipidemia", code: "E78.5", status: "active", onsetDate: daysAgo(365), severity: "mild" },
        { name: "Seasonal Allergies", code: "J30.1", status: "resolved", onsetDate: daysAgo(180), severity: "mild" },
      ],
      encounters: [
        { type: "Primary Care Visit", date: daysAgo(14), provider: "Dr. Michael Roberts", reason: "Routine follow-up" },
        { type: "Endocrinology", date: daysAgo(45), provider: "Dr. Sarah Chen", reason: "Diabetes management review" },
        { type: "Lab Work", date: daysAgo(7), provider: "Quest Diagnostics", reason: "Quarterly labs" },
        { type: "Eye Exam", date: daysAgo(90), provider: "Dr. Lisa Wong", reason: "Diabetic retinopathy screening" },
        { type: "Cardiology Consult", date: daysAgo(180), provider: "Dr. James Park", reason: "Cardiovascular risk assessment" },
      ],
      procedures: [
        { name: "Retinal Exam", date: daysAgo(90), result: "Normal, no diabetic retinopathy" },
        { name: "Foot Examination", date: daysAgo(45), result: "Normal sensation, no ulcers" },
        { name: "EKG", date: daysAgo(180), result: "Normal sinus rhythm" },
        { name: "Stress Test", date: daysAgo(180), result: "Negative for ischemia" },
      ],
    };
  }

  private analyzeTrend(data: Array<{ date: string; value: number }>): { trend: "improving" | "worsening" | "stable" | "fluctuating"; percentChange: number } {
    if (data.length < 2) return { trend: "stable", percentChange: 0 };
    
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;
    
    const variance = data.reduce((sum, d, i, arr) => {
      if (i === 0) return 0;
      return sum + Math.abs(d.value - arr[i - 1].value);
    }, 0) / data.length;
    
    const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const variancePercent = (variance / avgValue) * 100;
    
    if (variancePercent > 15) return { trend: "fluctuating", percentChange };
    if (Math.abs(percentChange) < 5) return { trend: "stable", percentChange };
    return { trend: percentChange > 0 ? "worsening" : "improving", percentChange };
  }

  private determineClinicalSignificance(
    value: number,
    normalRange: { min: number; max: number }
  ): "normal" | "borderline" | "concerning" | "critical" {
    const { min, max } = normalRange;
    const range = max - min;
    
    if (value >= min && value <= max) return "normal";
    
    const deviation = value < min ? (min - value) / range : (value - max) / range;
    
    if (deviation < 0.2) return "borderline";
    if (deviation < 0.5) return "concerning";
    return "critical";
  }

  private getAdherenceStatus(rate: number): "excellent" | "good" | "needs_improvement" | "poor" {
    if (rate >= 95) return "excellent";
    if (rate >= 85) return "good";
    if (rate >= 70) return "needs_improvement";
    return "poor";
  }

  async generateEnhancedSummary(patientId: string, timeframeDays: number = 365): Promise<EnhancedHealthJourneySummary> {
    const healthData = this.generateLongTermHealthData();
    
    const vitalTrends = this.analyzeVitalTrends(healthData.vitals, timeframeDays);
    const labTrends = this.analyzeLabTrends(healthData.labResults, timeframeDays);
    const medicationAnalysis = this.analyzeMedications(healthData.medications);
    const episodesOfCare = this.identifyEpisodesOfCare(healthData, timeframeDays);
    const proactiveAlerts = this.generateProactiveAlerts(healthData, vitalTrends, labTrends, medicationAnalysis);
    const healthScore = this.calculateEnhancedHealthScore(vitalTrends, labTrends, medicationAnalysis);

    let aiNarrative = "";
    let executiveSummary = "";
    let specialistNotes = "";

    try {
      if (!openai) throw new Error("OpenAI not configured");

      const prompt = `Analyze this patient's health data over the past ${timeframeDays} days and generate a comprehensive health journey summary.

PATIENT DATA:
- Conditions: ${JSON.stringify(healthData.conditions)}
- Vital Trends: ${JSON.stringify(vitalTrends.map(v => ({ name: v.vitalName, trend: v.trend, change: v.percentChange, significance: v.clinicalSignificance })))}
- Lab Trends: ${JSON.stringify(labTrends.map(l => ({ name: l.testName, trend: l.trend, change: l.percentChange, significance: l.clinicalSignificance })))}
- Medication Adherence: ${JSON.stringify(medicationAnalysis.map(m => ({ name: m.medicationName, adherence: m.adherenceRate, interactions: m.potentialInteractions.length })))}
- Episodes of Care: ${JSON.stringify(episodesOfCare.map(e => ({ type: e.episodeType, title: e.title, status: e.status })))}
- Health Score: ${healthScore}/100

Generate a JSON response with:
1. "executiveSummary": 2-3 sentence overview of overall health status and trajectory
2. "aiNarrative": 4-6 sentence detailed narrative covering key trends, concerns, and positive developments
3. "specialistNotes": 2-3 bullet points (as a single string with newlines) highlighting clinical observations for healthcare providers

IMPORTANT: This is informational only, not medical advice. Use supportive, patient-friendly language for the narrative but clinical accuracy for specialist notes.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      executiveSummary = result.executiveSummary || "";
      aiNarrative = result.aiNarrative || "";
      specialistNotes = result.specialistNotes || "";
    } catch (error) {
      console.log("[EnhancedAIHealthJourney] OpenAI unavailable, using fallback narrative");
      executiveSummary = `Your health journey over the past year shows meaningful progress in managing your chronic conditions. Your HbA1c and cholesterol levels have improved, though blood pressure remains slightly elevated and warrants continued attention.`;
      aiNarrative = `Over the past 12 months, you've made notable strides in your diabetes management. Your HbA1c has decreased from approximately 8.1% to 7.2%, reflecting better blood sugar control. Your cholesterol profile has also improved significantly, with LDL dropping and HDL increasing. Blood pressure readings, while trending downward, remain above the optimal range. Your medication adherence is generally good, averaging around 91% across all prescriptions. The weight loss of about 10 pounds has likely contributed to your metabolic improvements. Continue working with your care team to maintain these positive trends while focusing on blood pressure optimization.`;
      specialistNotes = `• HbA1c improved 0.9% over 12 months - consider maintaining current regimen
• BP trending down but still above target (138/88) - may need medication adjustment
• Good medication adherence (91% avg) - reinforce importance of Lisinopril timing
• eGFR stable at 78 - continue monitoring for diabetic nephropathy`;
    }

    return {
      patientId,
      generatedAt: new Date().toISOString(),
      overallHealthScore: healthScore,
      executiveSummary,
      vitalTrends,
      labTrends,
      medicationAnalysis,
      episodesOfCare,
      proactiveAlerts,
      aiNarrative,
      specialistNotes,
      disclaimer: "NO-CDS DISCLAIMER: This summary is for informational and educational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations. Always consult your healthcare provider before making any health decisions.",
    };
  }

  private analyzeVitalTrends(vitals: any[], timeframeDays: number): VitalTrendAnalysis[] {
    return vitals.map(vital => {
      const { trend, percentChange } = this.analyzeTrend(vital.historicalData);
      const significance = this.determineClinicalSignificance(vital.currentValue, vital.normalRange);
      
      let aiInsight = "";
      if (trend === "improving" && significance !== "normal") {
        aiInsight = `Your ${vital.name} is trending in the right direction but still needs attention.`;
      } else if (trend === "worsening") {
        aiInsight = `Your ${vital.name} has been increasing. Discuss this with your care team.`;
      } else if (significance === "normal") {
        aiInsight = `Your ${vital.name} is within the healthy range. Keep up the good work!`;
      } else {
        aiInsight = `Your ${vital.name} is outside the normal range but stable. Continue monitoring.`;
      }

      return {
        vitalName: vital.name,
        currentValue: vital.currentValue,
        unit: vital.unit,
        normalRange: vital.normalRange,
        trend,
        percentChange: Math.round(percentChange * 10) / 10,
        dataPoints: vital.historicalData,
        timeframeDays,
        clinicalSignificance: significance,
        aiInsight,
      };
    });
  }

  private analyzeLabTrends(labs: any[], timeframeDays: number): LabTrendAnalysis[] {
    return labs.map(lab => {
      const { trend, percentChange } = this.analyzeTrend(lab.historicalData);
      const significance = this.determineClinicalSignificance(lab.currentValue, lab.normalRange);
      
      let aiInsight = "";
      const isImproving = (trend === "improving" || (trend === "worsening" && lab.name.includes("HDL")));
      
      if (isImproving && significance !== "normal") {
        aiInsight = `Your ${lab.name} is improving over time. Continue your current management approach.`;
      } else if (trend === "worsening" && !lab.name.includes("HDL")) {
        aiInsight = `Your ${lab.name} has been trending higher. Your care team may want to discuss this.`;
      } else if (significance === "normal") {
        aiInsight = `Your ${lab.name} is within the healthy range.`;
      } else {
        aiInsight = `Your ${lab.name} remains outside the target range. Stay consistent with your treatment plan.`;
      }

      return {
        testName: lab.name,
        testCode: lab.code,
        currentValue: lab.currentValue,
        unit: lab.unit,
        normalRange: lab.normalRange,
        historicalData: lab.historicalData,
        trend: lab.name.includes("HDL") && trend === "worsening" ? "improving" : trend,
        percentChange: Math.round(percentChange * 10) / 10,
        timeframeDays,
        clinicalSignificance: significance,
        aiInsight,
        correlatedConditions: lab.correlatedConditions || [],
      };
    });
  }

  private analyzeMedications(medications: any[]): MedicationAnalysis[] {
    return medications.map(med => {
      const adherenceStatus = this.getAdherenceStatus(med.adherenceRate);
      
      let missedDosePattern = undefined;
      const lateRefills = med.refillHistory.filter((r: any) => !r.onTime);
      if (lateRefills.length > 0) {
        missedDosePattern = `${lateRefills.length} late refills in the past 4 months`;
      }

      let aiRecommendation = "";
      if (adherenceStatus === "excellent") {
        aiRecommendation = `Excellent adherence to ${med.name}. Keep up this consistency.`;
      } else if (adherenceStatus === "good") {
        aiRecommendation = `Good adherence to ${med.name}. Setting daily reminders can help maintain consistency.`;
      } else if (adherenceStatus === "needs_improvement") {
        aiRecommendation = `Consider setting reminders for ${med.name}. Consistent timing improves effectiveness.`;
      } else {
        aiRecommendation = `Discuss barriers to taking ${med.name} with your care team. They can help find solutions.`;
      }

      const sideEffectRisk = med.potentialInteractions.some((i: any) => i.severity === "major") ? "high" :
                            med.potentialInteractions.some((i: any) => i.severity === "moderate") ? "moderate" : "low";

      return {
        medicationName: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        purpose: med.purpose,
        adherenceRate: med.adherenceRate,
        adherenceStatus,
        missedDosePattern,
        potentialInteractions: med.potentialInteractions,
        sideEffectRisk,
        aiRecommendation,
      };
    });
  }

  private identifyEpisodesOfCare(healthData: any, timeframeDays: number): EpisodeOfCareSummary[] {
    const episodes: EpisodeOfCareSummary[] = [];
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const daysAgo = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return formatDate(d);
    };

    const diabetesCondition = healthData.conditions.find((c: any) => c.name.includes("Diabetes"));
    if (diabetesCondition) {
      const diabetesRelatedMeds = healthData.medications.filter((m: any) => 
        m.purpose.toLowerCase().includes("blood sugar") || m.name.toLowerCase() === "metformin"
      );
      const diabetesRelatedLabs = healthData.labResults.filter((l: any) => 
        l.correlatedConditions.some((c: string) => c.includes("Diabetes"))
      );

      episodes.push({
        id: "episode-diabetes-1",
        episodeType: "chronic",
        title: "Type 2 Diabetes Management",
        description: "Ongoing management of Type 2 Diabetes Mellitus with medication, lifestyle modifications, and regular monitoring",
        startDate: diabetesCondition.onsetDate,
        status: "ongoing",
        primaryCondition: "Type 2 Diabetes Mellitus (E11.9)",
        relatedDataPoints: [
          ...diabetesRelatedMeds.map((m: any) => ({
            type: "medication" as const,
            id: `med-${m.name.toLowerCase().replace(/\s/g, "-")}`,
            name: `${m.name} ${m.dosage}`,
            date: m.startDate,
            relevance: m.purpose,
          })),
          ...diabetesRelatedLabs.map((l: any) => ({
            type: "lab" as const,
            id: `lab-${l.code}`,
            name: l.name,
            date: l.historicalData[l.historicalData.length - 1]?.date || "",
            relevance: `Current: ${l.currentValue} ${l.unit}`,
          })),
        ],
        carePlanGoals: [
          "Maintain HbA1c below 7.0%",
          "Monitor fasting glucose daily",
          "Annual retinal and foot examinations",
          "Quarterly lab work for kidney function",
        ],
        progressSummary: "HbA1c has improved from 8.1% to 7.2% over the past year, indicating better glycemic control. Fasting glucose remains slightly elevated but trending downward.",
        nextSteps: [
          "Continue current medication regimen",
          "Schedule next quarterly labs",
          "Discuss diet optimization at next endocrinology visit",
        ],
        aiAnalysis: "Your diabetes management shows positive momentum. The 0.9% reduction in HbA1c represents meaningful progress. Continued focus on medication adherence and lifestyle factors will help reach the target of 7.0%.",
      });
    }

    const hypertensionCondition = healthData.conditions.find((c: any) => c.name.includes("Hypertension"));
    if (hypertensionCondition) {
      const bpMeds = healthData.medications.filter((m: any) => 
        m.purpose.toLowerCase().includes("blood pressure") || m.name.toLowerCase() === "lisinopril"
      );
      const bpVitals = healthData.vitals.filter((v: any) => v.name.includes("Blood Pressure"));

      episodes.push({
        id: "episode-hypertension-1",
        episodeType: "chronic",
        title: "Hypertension Management",
        description: "Management of essential hypertension with medication and lifestyle modifications",
        startDate: hypertensionCondition.onsetDate,
        status: "ongoing",
        primaryCondition: "Essential Hypertension (I10)",
        relatedDataPoints: [
          ...bpMeds.map((m: any) => ({
            type: "medication" as const,
            id: `med-${m.name.toLowerCase().replace(/\s/g, "-")}`,
            name: `${m.name} ${m.dosage}`,
            date: m.startDate,
            relevance: m.purpose,
          })),
          ...bpVitals.map((v: any) => ({
            type: "vital" as const,
            id: `vital-${v.name.toLowerCase().replace(/\s/g, "-")}`,
            name: v.name,
            date: v.historicalData[v.historicalData.length - 1]?.date || "",
            relevance: `Current: ${v.currentValue} ${v.unit}`,
          })),
        ],
        carePlanGoals: [
          "Achieve blood pressure below 130/80 mmHg",
          "Reduce sodium intake to less than 2,300mg daily",
          "Regular cardiovascular exercise 150 minutes weekly",
          "Maintain medication adherence above 90%",
        ],
        progressSummary: "Blood pressure has improved from approximately 145/92 to 138/88 mmHg. While trending in the right direction, readings remain above the target of 130/80.",
        nextSteps: [
          "Discuss potential medication adjustment if BP remains elevated",
          "Review dietary sodium intake",
          "Consider home BP monitoring log",
        ],
        aiAnalysis: "Blood pressure control is progressing but not yet at goal. The downward trend is encouraging, but the 88% medication adherence rate for Lisinopril suggests room for improvement that could help achieve target levels.",
      });
    }

    const lipidCondition = healthData.conditions.find((c: any) => c.name.includes("Hyperlipidemia"));
    if (lipidCondition) {
      episodes.push({
        id: "episode-lipids-1",
        episodeType: "chronic",
        title: "Cholesterol Management",
        description: "Management of hyperlipidemia with statin therapy and dietary modifications",
        startDate: lipidCondition.onsetDate,
        status: "ongoing",
        primaryCondition: "Hyperlipidemia (E78.5)",
        relatedDataPoints: [
          {
            type: "medication",
            id: "med-atorvastatin",
            name: "Atorvastatin 20mg",
            date: daysAgo(350),
            relevance: "Cholesterol management",
          },
          {
            type: "lab",
            id: "lab-ldl",
            name: "LDL Cholesterol",
            date: daysAgo(7),
            relevance: "Current: 118 mg/dL",
          },
          {
            type: "lab",
            id: "lab-hdl",
            name: "HDL Cholesterol",
            date: daysAgo(7),
            relevance: "Current: 48 mg/dL",
          },
        ],
        carePlanGoals: [
          "Reduce LDL cholesterol below 100 mg/dL",
          "Increase HDL cholesterol above 50 mg/dL",
          "Maintain triglycerides below 150 mg/dL",
        ],
        progressSummary: "Significant improvement in lipid panel since starting statin therapy. LDL decreased from 145 to 118 mg/dL. HDL improving from 42 to 48 mg/dL.",
        nextSteps: [
          "Continue current statin regimen",
          "Repeat lipid panel in 3 months",
          "Consider dietary omega-3 supplementation",
        ],
        aiAnalysis: "Cholesterol management is responding well to treatment. The statin therapy combined with lifestyle changes has produced measurable improvements. Continuing the current approach should help reach LDL targets.",
      });
    }

    episodes.push({
      id: "episode-preventive-1",
      episodeType: "preventive",
      title: "Preventive Care & Screening",
      description: "Annual preventive care including age-appropriate screenings and immunizations",
      startDate: daysAgo(365),
      status: "active",
      primaryCondition: "Routine health maintenance",
      relatedDataPoints: healthData.procedures.map((p: any, idx: number) => ({
        type: "procedure" as const,
        id: `proc-${idx}`,
        name: p.name,
        date: p.date,
        relevance: p.result,
      })),
      carePlanGoals: [
        "Annual comprehensive physical examination",
        "Age-appropriate cancer screenings",
        "Immunization updates",
        "Diabetic-specific preventive screenings",
      ],
      progressSummary: "All preventive screenings are up to date. Retinal exam showed no diabetic retinopathy. Cardiovascular screening was reassuring.",
      nextSteps: [
        "Schedule next annual physical",
        "Plan for colonoscopy if age-appropriate",
        "Annual flu vaccination",
      ],
      aiAnalysis: "Preventive care is current and showing good results. The normal retinal exam is particularly important given the diabetes diagnosis. Continue with the annual screening schedule.",
    });

    return episodes;
  }

  private generateProactiveAlerts(
    healthData: any,
    vitalTrends: VitalTrendAnalysis[],
    labTrends: LabTrendAnalysis[],
    medicationAnalysis: MedicationAnalysis[]
  ): ProactiveHealthAlert[] {
    const alerts: ProactiveHealthAlert[] = [];
    const today = new Date();

    const bpSystolic = vitalTrends.find(v => v.vitalName.includes("Systolic"));
    if (bpSystolic && bpSystolic.clinicalSignificance !== "normal") {
      alerts.push({
        id: "alert-bp-1",
        alertType: "trend_warning",
        severity: bpSystolic.clinicalSignificance === "concerning" ? "medium" : "low",
        title: "Blood Pressure Above Target",
        description: "Your blood pressure readings remain above the recommended target of 130/80 mmHg. While improving, continued attention is needed.",
        evidenceBasis: [
          `Current reading: ${bpSystolic.currentValue} ${bpSystolic.unit}`,
          `Trend: ${bpSystolic.trend} (${bpSystolic.percentChange > 0 ? "+" : ""}${bpSystolic.percentChange}%)`,
          "Target: Below 130/80 mmHg",
        ],
        recommendedActions: [
          "Continue taking Lisinopril as prescribed",
          "Reduce dietary sodium intake",
          "Monitor blood pressure at home regularly",
          "Discuss with your doctor at next visit",
        ],
        timeframe: "Ongoing monitoring recommended",
        confidenceLevel: 0.85,
        relatedMetrics: [
          { name: "Systolic BP", value: `${bpSystolic.currentValue} mmHg`, trend: bpSystolic.trend },
        ],
        createdAt: today.toISOString(),
      });
    }

    const hba1c = labTrends.find(l => l.testName === "HbA1c");
    if (hba1c && hba1c.clinicalSignificance !== "normal") {
      alerts.push({
        id: "alert-hba1c-1",
        alertType: "risk_prediction",
        severity: hba1c.currentValue > 8.0 ? "high" : hba1c.currentValue > 7.5 ? "medium" : "low",
        title: "HbA1c Trending - Continue Progress",
        description: `Your HbA1c of ${hba1c.currentValue}% shows improvement but remains above the target of 7.0% or lower. Consistent management is helping.`,
        evidenceBasis: [
          `Current HbA1c: ${hba1c.currentValue}%`,
          `Improvement: ${Math.abs(hba1c.percentChange).toFixed(1)}% reduction over the past year`,
          "Target: Below 7.0%",
        ],
        recommendedActions: [
          "Maintain current medication schedule",
          "Continue monitoring fasting glucose",
          "Follow dietary recommendations",
          "Stay active with regular exercise",
        ],
        timeframe: "Next HbA1c check recommended in 3 months",
        confidenceLevel: 0.90,
        relatedMetrics: [
          { name: "HbA1c", value: `${hba1c.currentValue}%`, trend: hba1c.trend },
          { name: "Fasting Glucose", value: "142 mg/dL", trend: "improving" },
        ],
        createdAt: today.toISOString(),
      });
    }

    const lowAdherenceMeds = medicationAnalysis.filter(m => m.adherenceStatus === "needs_improvement" || m.adherenceStatus === "poor");
    if (lowAdherenceMeds.length > 0) {
      alerts.push({
        id: "alert-adherence-1",
        alertType: "medication_alert",
        severity: "medium",
        title: "Medication Adherence Opportunity",
        description: `Some medications have adherence rates that could be improved. Consistent timing can enhance their effectiveness.`,
        evidenceBasis: lowAdherenceMeds.map(m => `${m.medicationName}: ${m.adherenceRate}% adherence`),
        recommendedActions: [
          "Set daily medication reminders on your phone",
          "Use a pill organizer for weekly preparation",
          "Discuss any side effects or concerns with your provider",
          "Consider linking medication time to daily routines",
        ],
        timeframe: "Immediate action recommended",
        confidenceLevel: 0.95,
        relatedMetrics: lowAdherenceMeds.map(m => ({
          name: m.medicationName,
          value: `${m.adherenceRate}%`,
          trend: m.adherenceStatus,
        })),
        createdAt: today.toISOString(),
      });
    }

    const medsWithInteractions = medicationAnalysis.filter(m => m.potentialInteractions.length > 0);
    if (medsWithInteractions.length > 0) {
      alerts.push({
        id: "alert-interactions-1",
        alertType: "medication_alert",
        severity: "info",
        title: "Medication Interaction Awareness",
        description: "Some of your medications have potential interactions with certain foods or other medications. Being aware helps you stay safe.",
        evidenceBasis: medsWithInteractions.flatMap(m => 
          m.potentialInteractions.map(i => `${m.medicationName} + ${i.interactingWith}: ${i.description}`)
        ),
        recommendedActions: medsWithInteractions.flatMap(m =>
          m.potentialInteractions.map(i => i.recommendation)
        ),
        timeframe: "Ongoing awareness",
        confidenceLevel: 0.88,
        relatedMetrics: [],
        createdAt: today.toISOString(),
      });
    }

    const egfr = labTrends.find(l => l.testName === "eGFR");
    if (egfr && egfr.currentValue < 90) {
      alerts.push({
        id: "alert-kidney-1",
        alertType: "preventive_care",
        severity: egfr.currentValue < 60 ? "high" : egfr.currentValue < 75 ? "medium" : "low",
        title: "Kidney Function Monitoring",
        description: "Your kidney function (eGFR) is being monitored as part of your diabetes care. Current levels warrant continued observation.",
        evidenceBasis: [
          `Current eGFR: ${egfr.currentValue} mL/min/1.73m²`,
          "Normal range: Above 90 mL/min/1.73m²",
          "Trend: Stable",
        ],
        recommendedActions: [
          "Continue quarterly kidney function tests",
          "Stay hydrated with adequate water intake",
          "Maintain blood pressure control",
          "Limit use of NSAIDs (ibuprofen, naproxen)",
        ],
        timeframe: "Quarterly monitoring recommended",
        confidenceLevel: 0.82,
        relatedMetrics: [
          { name: "eGFR", value: `${egfr.currentValue} mL/min/1.73m²`, trend: egfr.trend },
          { name: "Creatinine", value: "1.1 mg/dL", trend: "stable" },
        ],
        createdAt: today.toISOString(),
      });
    }

    alerts.push({
      id: "alert-lifestyle-1",
      alertType: "lifestyle_recommendation",
      severity: "info",
      title: "Heart-Healthy Lifestyle Tips",
      description: "Based on your conditions, maintaining a heart-healthy lifestyle can significantly improve your outcomes.",
      evidenceBasis: [
        "Type 2 Diabetes - cardiovascular risk factor",
        "Hypertension - cardiovascular risk factor",
        "Hyperlipidemia - cardiovascular risk factor",
      ],
      recommendedActions: [
        "Aim for 150 minutes of moderate exercise weekly",
        "Follow a Mediterranean or DASH diet pattern",
        "Limit alcohol to moderate amounts if consumed",
        "If you smoke, seek support for cessation",
        "Manage stress through relaxation techniques",
      ],
      timeframe: "Ongoing lifestyle integration",
      confidenceLevel: 0.92,
      relatedMetrics: [],
      createdAt: today.toISOString(),
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private calculateEnhancedHealthScore(
    vitalTrends: VitalTrendAnalysis[],
    labTrends: LabTrendAnalysis[],
    medicationAnalysis: MedicationAnalysis[]
  ): number {
    let score = 100;

    vitalTrends.forEach(v => {
      if (v.clinicalSignificance === "critical") score -= 10;
      else if (v.clinicalSignificance === "concerning") score -= 6;
      else if (v.clinicalSignificance === "borderline") score -= 3;
      
      if (v.trend === "improving") score += 2;
      else if (v.trend === "worsening") score -= 3;
    });

    labTrends.forEach(l => {
      if (l.clinicalSignificance === "critical") score -= 8;
      else if (l.clinicalSignificance === "concerning") score -= 5;
      else if (l.clinicalSignificance === "borderline") score -= 2;
      
      if (l.trend === "improving") score += 2;
      else if (l.trend === "worsening") score -= 2;
    });

    const avgAdherence = medicationAnalysis.reduce((sum, m) => sum + m.adherenceRate, 0) / medicationAnalysis.length;
    if (avgAdherence >= 95) score += 5;
    else if (avgAdherence >= 85) score += 2;
    else if (avgAdherence < 70) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export const enhancedAIHealthJourneyService = new EnhancedAIHealthJourneyService();
