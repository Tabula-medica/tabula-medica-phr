import { generatePhiSafeText } from "./services/ai-gateway";
import { logPhiAccess } from "./security/hipaa-audit";

export interface HealthInsight {
  id: string;
  category: "trend" | "risk_awareness" | "lifestyle" | "preventive" | "monitoring";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  dataPoints: string[];
  suggestedAction: string;
  disclaimer: string;
  relatedConditions?: string[];
  generatedAt: Date;
}

export interface HealthInsightsResponse {
  patientName: string;
  generatedAt: Date;
  insights: HealthInsight[];
  overallHealthStatus: string;
  nextSteps: string[];
}

interface PatientHealthProfile {
  conditions: Array<{
    name: string;
    status: string;
    diagnosedDate: Date;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    purpose: string;
    startDate: Date;
  }>;
  labResults: Array<{
    testName: string;
    value: number | string;
    unit?: string;
    status: string;
    date: Date;
    referenceRange?: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: Date;
  }>;
  lifestyle: {
    exerciseFrequency?: string;
    smokingStatus?: string;
    alcoholUse?: string;
    dietType?: string;
    sleepHours?: number;
  };
  demographics: {
    age?: number;
    gender?: string;
  };
}

function getSampleHealthProfile(patientId: string): PatientHealthProfile {
  const now = new Date();

  return {
    conditions: [
      { name: "Type 2 Diabetes Mellitus", status: "active", diagnosedDate: new Date(now.getFullYear() - 2, 5, 1) },
      { name: "Essential Hypertension", status: "active", diagnosedDate: new Date(now.getFullYear(), now.getMonth() - 2, 1) },
      { name: "Hyperlipidemia", status: "active", diagnosedDate: new Date(now.getFullYear(), now.getMonth() - 8, 15) },
    ],
    medications: [
      { name: "Metformin", dosage: "500mg twice daily", purpose: "Diabetes management", startDate: new Date(now.getFullYear() - 2, 5, 1) },
      { name: "Lisinopril", dosage: "10mg daily", purpose: "Blood pressure control", startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1) },
      { name: "Atorvastatin", dosage: "20mg daily", purpose: "Cholesterol management", startDate: new Date(now.getFullYear(), now.getMonth() - 8, 15) },
      { name: "Vitamin D", dosage: "2000 IU daily", purpose: "Vitamin D deficiency", startDate: new Date(now.getFullYear(), now.getMonth() - 10, 1) },
    ],
    labResults: [
      { testName: "Hemoglobin A1C", value: 6.5, unit: "%", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "< 5.7%" },
      { testName: "Hemoglobin A1C", value: 6.8, unit: "%", status: "slightly elevated", date: new Date(now.getFullYear(), now.getMonth() - 3, 8), referenceRange: "< 5.7%" },
      { testName: "Hemoglobin A1C", value: 7.2, unit: "%", status: "elevated", date: new Date(now.getFullYear(), now.getMonth() - 6, 10), referenceRange: "< 5.7%" },
      { testName: "Total Cholesterol", value: 185, unit: "mg/dL", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "< 200 mg/dL" },
      { testName: "LDL Cholesterol", value: 95, unit: "mg/dL", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "< 100 mg/dL" },
      { testName: "HDL Cholesterol", value: 52, unit: "mg/dL", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "> 40 mg/dL" },
      { testName: "Vitamin D", value: 35, unit: "ng/mL", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "30-100 ng/mL" },
      { testName: "Vitamin D", value: 22, unit: "ng/mL", status: "low", date: new Date(now.getFullYear(), now.getMonth() - 6, 10), referenceRange: "30-100 ng/mL" },
      { testName: "eGFR", value: 85, unit: "mL/min", status: "normal", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "> 60 mL/min" },
      { testName: "Blood Pressure Systolic", value: 138, unit: "mmHg", status: "slightly elevated", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), referenceRange: "< 120 mmHg" },
    ],
    vitals: [
      { type: "Blood Pressure", value: 138, unit: "mmHg (systolic)", date: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { type: "Blood Pressure", value: 142, unit: "mmHg (systolic)", date: new Date(now.getFullYear(), now.getMonth() - 3, 8) },
      { type: "Heart Rate", value: 72, unit: "bpm", date: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { type: "Weight", value: 185, unit: "lbs", date: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { type: "Weight", value: 190, unit: "lbs", date: new Date(now.getFullYear(), now.getMonth() - 6, 10) },
    ],
    lifestyle: {
      exerciseFrequency: "2-3 times per week",
      smokingStatus: "never",
      alcoholUse: "occasional",
      dietType: "mixed",
      sleepHours: 7,
    },
    demographics: {
      age: 52,
      gender: "male",
    },
  };
}

async function generateAIInsights(
  profile: PatientHealthProfile,
  patientName: string
): Promise<{ insights: HealthInsight[]; overallStatus: string; nextSteps: string[] }> {
  const systemPrompt = `You are a health insights analyst providing personalized, descriptive health observations. Your role is to identify patterns and trends in health data and present them in a helpful, non-prescriptive way.

CRITICAL RULES:
1. Be DESCRIPTIVE, never PRESCRIPTIVE - describe observations, don't give medical advice
2. Always include disclaimers encouraging discussion with healthcare providers
3. Frame insights as observations and patterns, not diagnoses or recommendations
4. Use phrases like "Your data shows...", "This pattern commonly indicates...", "Consider discussing with your doctor..."
5. Never tell patients to start/stop medications or treatments
6. Prioritize insights by clinical relevance
7. Make insights actionable through awareness, not directives

Categories to consider:
- trend: Patterns in lab values, vitals, or symptoms over time
- risk_awareness: Observations about potential health considerations based on data
- lifestyle: Observations about lifestyle factors and their common correlations
- preventive: Reminders about routine health maintenance
- monitoring: Suggestions for tracking certain values more closely

For each insight, provide:
- A clear, non-alarming title
- A descriptive explanation of what the data shows
- Specific data points supporting the insight
- A suggested next step (always involving healthcare provider consultation)
- An appropriate disclaimer`;

  const userPrompt = `Analyze this patient's health profile and generate personalized health insights:

Patient: ${patientName}
Age: ${profile.demographics.age || "Unknown"}
Gender: ${profile.demographics.gender || "Unknown"}

Active Conditions:
${profile.conditions.map((c) => `- ${c.name} (${c.status}, diagnosed ${c.diagnosedDate.toLocaleDateString()})`).join("\n")}

Current Medications:
${profile.medications.map((m) => `- ${m.name} ${m.dosage} for ${m.purpose}`).join("\n")}

Recent Lab Results:
${profile.labResults.map((l) => `- ${l.testName}: ${l.value}${l.unit ? ` ${l.unit}` : ""} (${l.status}) on ${l.date.toLocaleDateString()}`).join("\n")}

Recent Vitals:
${profile.vitals.map((v) => `- ${v.type}: ${v.value} ${v.unit} on ${v.date.toLocaleDateString()}`).join("\n")}

Lifestyle:
- Exercise: ${profile.lifestyle.exerciseFrequency || "Unknown"}
- Smoking: ${profile.lifestyle.smokingStatus || "Unknown"}
- Alcohol: ${profile.lifestyle.alcoholUse || "Unknown"}
- Sleep: ${profile.lifestyle.sleepHours ? `${profile.lifestyle.sleepHours} hours/night` : "Unknown"}

Generate 4-6 personalized health insights based on this data. Respond with JSON:
{
  "insights": [
    {
      "category": "trend|risk_awareness|lifestyle|preventive|monitoring",
      "priority": "high|medium|low",
      "title": "Clear, non-alarming title",
      "description": "Descriptive explanation of what the data shows",
      "dataPoints": ["Specific data point 1", "Data point 2"],
      "suggestedAction": "Consider discussing X with your healthcare provider",
      "disclaimer": "Appropriate disclaimer about consulting healthcare providers",
      "relatedConditions": ["condition1", "condition2"]
    }
  ],
  "overallStatus": "Brief overall health status observation (1-2 sentences)",
  "nextSteps": ["General next step 1", "Next step 2", "Next step 3"]
}`;

  try {
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxTokens: 2000,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const now = new Date();

    const insights: HealthInsight[] = (parsed.insights || []).map((insight: any, idx: number) => ({
      id: `insight-${now.getTime()}-${idx}`,
      category: insight.category || "monitoring",
      priority: insight.priority || "medium",
      title: insight.title || "Health Observation",
      description: insight.description || "",
      dataPoints: insight.dataPoints || [],
      suggestedAction: insight.suggestedAction || "Discuss with your healthcare provider.",
      disclaimer: insight.disclaimer || "This is an observation based on your data. Always consult with your healthcare provider for medical advice.",
      relatedConditions: insight.relatedConditions,
      generatedAt: now,
    }));

    return {
      insights,
      overallStatus: parsed.overallStatus || "Your health data has been analyzed. Discuss any concerns with your healthcare provider.",
      nextSteps: parsed.nextSteps || ["Schedule your next routine check-up", "Continue monitoring your health metrics"],
    };
  } catch (error) {
    console.error("[HealthInsights] Error generating AI insights:", error);
    return getFallbackInsights(profile, patientName);
  }
}

function getFallbackInsights(
  profile: PatientHealthProfile,
  patientName: string
): { insights: HealthInsight[]; overallStatus: string; nextSteps: string[] } {
  const now = new Date();
  const insights: HealthInsight[] = [];

  const a1cResults = profile.labResults.filter((l) => l.testName === "Hemoglobin A1C");
  if (a1cResults.length >= 2) {
    const latest = a1cResults[0];
    const previous = a1cResults[1];
    const latestVal = parseFloat(String(latest.value));
    const prevVal = parseFloat(String(previous.value));

    if (latestVal < prevVal) {
      insights.push({
        id: `insight-${now.getTime()}-a1c`,
        category: "trend",
        priority: "high",
        title: "Improving A1C Trend",
        description: `Your A1C levels have shown improvement over the past few months, decreasing from ${prevVal}% to ${latestVal}%. This trend is commonly associated with better blood sugar management.`,
        dataPoints: [
          `A1C: ${prevVal}% (${previous.date.toLocaleDateString()})`,
          `A1C: ${latestVal}% (${latest.date.toLocaleDateString()})`,
        ],
        suggestedAction: "Consider discussing this positive trend with your healthcare provider at your next visit.",
        disclaimer: "This observation is based on your lab data. Your healthcare provider can best interpret these results in the context of your overall health.",
        relatedConditions: ["Type 2 Diabetes Mellitus"],
        generatedAt: now,
      });
    }
  }

  const vitaminD = profile.labResults.filter((l) => l.testName === "Vitamin D");
  if (vitaminD.length >= 2) {
    const latest = vitaminD[0];
    const previous = vitaminD[1];
    const latestVal = parseFloat(String(latest.value));
    const prevVal = parseFloat(String(previous.value));

    if (latestVal > prevVal && prevVal < 30) {
      insights.push({
        id: `insight-${now.getTime()}-vitd`,
        category: "trend",
        priority: "medium",
        title: "Vitamin D Levels Normalizing",
        description: `Your Vitamin D levels have improved from ${prevVal} ng/mL to ${latestVal} ng/mL, moving into the normal range. This is commonly seen with consistent supplementation.`,
        dataPoints: [
          `Vitamin D: ${prevVal} ng/mL (${previous.date.toLocaleDateString()})`,
          `Vitamin D: ${latestVal} ng/mL (${latest.date.toLocaleDateString()})`,
        ],
        suggestedAction: "Discuss with your provider whether to continue current supplementation.",
        disclaimer: "Your healthcare provider can determine the appropriate ongoing supplementation for your needs.",
        generatedAt: now,
      });
    }
  }

  if (profile.conditions.some((c) => c.name.includes("Diabetes")) && profile.conditions.some((c) => c.name.includes("Hypertension"))) {
    insights.push({
      id: `insight-${now.getTime()}-comorbid`,
      category: "risk_awareness",
      priority: "medium",
      title: "Multiple Cardiovascular Risk Factors",
      description: "Your health profile includes both diabetes and hypertension, which are commonly seen together and are both factors that healthcare providers monitor for cardiovascular health.",
      dataPoints: ["Active: Type 2 Diabetes Mellitus", "Active: Essential Hypertension"],
      suggestedAction: "Consider asking your provider about comprehensive cardiovascular health monitoring at your next appointment.",
      disclaimer: "This is an observation about common health patterns. Your healthcare team can provide personalized guidance.",
      relatedConditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension"],
      generatedAt: now,
    });
  }

  if (profile.lifestyle.exerciseFrequency) {
    insights.push({
      id: `insight-${now.getTime()}-exercise`,
      category: "lifestyle",
      priority: "low",
      title: "Physical Activity Pattern",
      description: `Your records indicate exercise frequency of ${profile.lifestyle.exerciseFrequency}. Regular physical activity is commonly associated with better management of blood sugar and blood pressure levels.`,
      dataPoints: [`Exercise frequency: ${profile.lifestyle.exerciseFrequency}`],
      suggestedAction: "Consider tracking your activity levels and discussing exercise goals with your healthcare provider.",
      disclaimer: "Any changes to your exercise routine should be discussed with your healthcare provider, especially given your current health conditions.",
      generatedAt: now,
    });
  }

  insights.push({
    id: `insight-${now.getTime()}-preventive`,
    category: "preventive",
    priority: "low",
    title: "Routine Health Maintenance",
    description: "Based on your age and health profile, routine preventive screenings are an important part of ongoing health maintenance.",
    dataPoints: [`Age: ${profile.demographics.age || "Unknown"}`, `Conditions being managed: ${profile.conditions.length}`],
    suggestedAction: "Ask your provider about recommended preventive screenings at your next visit.",
    disclaimer: "Your healthcare provider can recommend specific screenings based on your individual health history and risk factors.",
    generatedAt: now,
  });

  return {
    insights,
    overallStatus: `Based on available data, ${patientName}'s health metrics show ongoing management of multiple conditions with recent positive trends in several key areas.`,
    nextSteps: [
      "Continue attending regular check-ups with your healthcare team",
      "Keep tracking key health metrics as recommended by your provider",
      "Discuss any questions about these observations at your next appointment",
    ],
  };
}

export async function generateHealthInsights(
  patientId: string,
  patientName: string
): Promise<HealthInsightsResponse> {
  logPhiAccess({
    action: "read",
    resourceType: "HealthInsights",
    userId: patientId,
    patientId,
    details: "Generated personalized health insights",
  });

  const profile = getSampleHealthProfile(patientId);
  const { insights, overallStatus, nextSteps } = await generateAIInsights(profile, patientName);

  return {
    patientName,
    generatedAt: new Date(),
    insights: insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    overallHealthStatus: overallStatus,
    nextSteps,
  };
}

export function getInsightCategoryInfo(category: HealthInsight["category"]): { label: string; color: string; icon: string } {
  const info: Record<HealthInsight["category"], { label: string; color: string; icon: string }> = {
    trend: { label: "Trend", color: "blue", icon: "TrendingUp" },
    risk_awareness: { label: "Awareness", color: "amber", icon: "AlertCircle" },
    lifestyle: { label: "Lifestyle", color: "green", icon: "Heart" },
    preventive: { label: "Preventive", color: "purple", icon: "Shield" },
    monitoring: { label: "Monitoring", color: "cyan", icon: "Activity" },
  };
  return info[category] || { label: "Insight", color: "gray", icon: "Lightbulb" };
}
