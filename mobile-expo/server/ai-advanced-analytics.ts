import { storage } from "./storage";
import type { HealthRecord, TreatmentProtocol, ProtocolDeviation, KpiReport, OutcomePrediction, PopulationHealthReport, TreatmentEfficacyAnalysis } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

async function getAllRecords(userId: string): Promise<HealthRecord[]> {
  return storage.getHealthRecords(userId);
}

function categorizeRecords(records: HealthRecord[]) {
  return {
    conditions: records.filter(r => r.type === "condition" || r.fhirResourceType === "Condition"),
    medications: records.filter(r => r.type === "medication"),
    labs: records.filter(r => r.type === "lab" || r.type === "labs"),
    vitals: records.filter(r => r.type === "vital"),
    procedures: records.filter(r => r.type === "procedure"),
    visits: records.filter(r => r.type === "visit"),
    imaging: records.filter(r => r.type === "imaging"),
    immunizations: records.filter(r => r.type === "immunization"),
    allergies: records.filter(r => r.type === "allergy"),
  };
}

export interface OutcomePredictionRequest {
  predictionType: "disease_progression" | "treatment_response" | "readmission_risk" | "complication_risk" | "recovery_timeline";
  condition?: string;
  treatment?: string;
  timeframe: "30_days" | "90_days" | "6_months" | "1_year" | "5_years";
}

export interface OutcomePredictionResult {
  prediction: {
    id: string;
    predictedOutcome: string;
    confidenceScore: number;
    riskFactors: Array<{
      factor: string;
      impact: string;
      modifiable: boolean;
      currentValue?: string;
      targetValue?: string;
    }>;
    protectiveFactors: string[];
    interventionRecommendations: string[];
    probabilityDistribution: Record<string, number>;
  };
}

export async function generateOutcomePrediction(
  userId: string,
  request: OutcomePredictionRequest
): Promise<OutcomePredictionResult> {
  const records = await getAllRecords(userId);
  const categorized = categorizeRecords(records);

  const systemPrompt = `You are an AI clinical decision support system specializing in predictive analytics for patient outcomes. Analyze the patient's health data to generate evidence-based predictions.

IMPORTANT: 
- These predictions are for clinical decision support only, not diagnosis
- Base predictions on established clinical risk models and evidence
- Identify modifiable vs non-modifiable risk factors
- Provide actionable intervention recommendations

Prediction type: ${request.predictionType}
Timeframe: ${request.timeframe}
${request.condition ? `Focus condition: ${request.condition}` : ""}
${request.treatment ? `Treatment context: ${request.treatment}` : ""}

Respond in JSON format:
{
  "predictedOutcome": "Most likely outcome scenario",
  "outcomeDescription": "Detailed description of the predicted outcome",
  "confidenceScore": 75,
  "probabilityDistribution": {
    "favorable_outcome": 60,
    "stable": 25,
    "unfavorable_outcome": 15
  },
  "riskFactors": [
    {
      "factor": "Risk factor name",
      "impact": "high|moderate|low",
      "modifiable": true,
      "currentValue": "Current patient value",
      "targetValue": "Target value if modifiable",
      "explanation": "Why this factor matters"
    }
  ],
  "protectiveFactors": ["Protective factor 1", "Factor 2"],
  "interventionRecommendations": [
    {
      "intervention": "Recommended intervention",
      "expectedImpact": "How it affects outcome",
      "priority": "high|medium|low",
      "timeframe": "When to implement"
    }
  ],
  "comparisonToPopulation": {
    "patientRisk": "above_average|average|below_average",
    "percentile": 65,
    "explanation": "How patient compares to similar patients"
  },
  "dataQuality": {
    "score": 85,
    "missingData": ["Data points that would improve prediction"],
    "confidence": "Explanation of confidence level"
  },
  "clinicalRationale": "Explanation of the prediction reasoning"
}`;

  const userMessage = `Generate a ${request.predictionType.replace(/_/g, " ")} prediction for this patient over ${request.timeframe.replace(/_/g, " ")}.

PATIENT DATA:
Conditions (${categorized.conditions.length}):
${categorized.conditions.slice(0, 10).map(c => `- ${c.title}: ${c.summary || ""}`).join("\n")}

Current Medications (${categorized.medications.length}):
${categorized.medications.slice(0, 10).map(m => `- ${m.title}`).join("\n")}

Recent Labs (${categorized.labs.length}):
${categorized.labs.slice(0, 10).map(l => `- ${l.title}: ${l.summary || ""} (${new Date(l.date).toLocaleDateString()})`).join("\n")}

Recent Vitals:
${categorized.vitals.slice(0, 5).map(v => `- ${v.title}: ${v.summary || ""}`).join("\n")}

Recent Procedures:
${categorized.procedures.slice(0, 5).map(p => `- ${p.title} (${new Date(p.date).toLocaleDateString()})`).join("\n")}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-advanced-analytics",
      callerMethod: "advancedAnalytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const validUntil = new Date();
    const timeframeMap: Record<string, number> = {
      "30_days": 30,
      "90_days": 90,
      "6_months": 180,
      "1_year": 365,
      "5_years": 1825,
    };
    validUntil.setDate(validUntil.getDate() + (timeframeMap[request.timeframe] || 30));

    const prediction = await storage.createOutcomePrediction({
      userId,
      patientId: userId,
      predictionType: request.predictionType,
      condition: request.condition || null,
      treatment: request.treatment || null,
      timeframe: request.timeframe,
      predictedOutcome: parsed.predictedOutcome || null,
      confidenceScore: parsed.confidenceScore || 50,
      riskFactors: parsed.riskFactors || [],
      protectiveFactors: parsed.protectiveFactors || null,
      probabilityDistribution: parsed.probabilityDistribution || null,
      comparisonToPopulation: parsed.comparisonToPopulation || null,
      interventionRecommendations: parsed.interventionRecommendations || null,
      dataPointsUsed: {
        conditions: categorized.conditions.length,
        medications: categorized.medications.length,
        labs: categorized.labs.length,
        vitals: categorized.vitals.length,
      },
      modelMetrics: parsed.dataQuality || null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
      validUntil,
    });

    return {
      prediction: {
        id: prediction.id,
        predictedOutcome: parsed.predictedOutcome || "",
        confidenceScore: parsed.confidenceScore || 50,
        riskFactors: parsed.riskFactors || [],
        protectiveFactors: parsed.protectiveFactors || [],
        interventionRecommendations: (parsed.interventionRecommendations || []).map((i: any) => i.intervention || i),
        probabilityDistribution: parsed.probabilityDistribution || {},
      },
    };
  } catch (error) {
    console.error("Outcome prediction error:", error);
    throw new Error("Failed to generate outcome prediction");
  }
}

export interface ProtocolDeviationRequest {
  protocolId?: string;
  conditionType?: string;
  analysisScope?: "recent" | "comprehensive";
}

export interface ProtocolDeviationResult {
  deviations: Array<{
    id: string;
    deviationType: string;
    severity: string;
    expectedAction: string;
    actualAction: string;
    aiAnalysis: string;
    recommendations: string[];
  }>;
  summary: {
    totalDeviations: number;
    criticalCount: number;
    warningCount: number;
    complianceScore: number;
  };
}

export async function detectProtocolDeviations(
  userId: string,
  request: ProtocolDeviationRequest
): Promise<ProtocolDeviationResult> {
  const records = await getAllRecords(userId);
  const categorized = categorizeRecords(records);
  
  const protocols = await storage.getTreatmentProtocols(userId);
  const relevantProtocols = request.protocolId 
    ? protocols.filter((p: any) => p.id === request.protocolId)
    : request.conditionType
      ? protocols.filter((p: any) => p.conditionType === request.conditionType)
      : protocols;

  const systemPrompt = `You are a clinical quality assurance AI specializing in treatment protocol compliance analysis. Analyze the patient's care against established treatment protocols to identify deviations.

IMPORTANT:
- Focus on clinically significant deviations that may impact patient outcomes
- Differentiate between concerning deviations and acceptable clinical variations
- Provide actionable recommendations for each deviation
- Consider patient-specific factors that may justify deviations

Respond in JSON format:
{
  "deviations": [
    {
      "deviationType": "timing|missing_intervention|incorrect_dosage|missed_monitoring|contraindicated_treatment",
      "severity": "critical|warning|informational",
      "protocolStep": "Which protocol step was deviated from",
      "expectedAction": "What the protocol recommends",
      "actualAction": "What actually occurred or didn't occur",
      "expectedTimeframe": "When it should have happened",
      "actualTimeframe": "When it happened or 'not performed'",
      "clinicalContext": "Relevant clinical context",
      "potentialImpact": "How this might affect patient outcomes",
      "aiAnalysis": "Detailed analysis of the deviation",
      "recommendations": ["Recommendation 1", "Recommendation 2"],
      "riskAssessment": {
        "immediateRisk": "low|moderate|high",
        "longTermRisk": "low|moderate|high",
        "mitigationSteps": ["Step 1", "Step 2"]
      }
    }
  ],
  "complianceScore": 85,
  "summary": {
    "totalDeviations": 3,
    "criticalCount": 1,
    "warningCount": 2,
    "informationalCount": 0,
    "overallAssessment": "Overall compliance assessment"
  },
  "protocolRecommendations": ["General recommendation 1", "Recommendation 2"]
}`;

  const protocolSummary = relevantProtocols.length > 0
    ? relevantProtocols.map((p: any) => `Protocol: ${p.name}\nCondition: ${p.conditionType}\nSteps: ${JSON.stringify(p.steps || [])}`).join("\n\n")
    : "Use standard clinical guidelines for diabetes, hypertension, and common chronic conditions.";

  const userMessage = `Analyze treatment protocol compliance for this patient.

TREATMENT PROTOCOLS:
${protocolSummary}

PATIENT CARE DATA:
Conditions: ${categorized.conditions.map(c => c.title).join(", ")}

Medications (${categorized.medications.length}):
${categorized.medications.slice(0, 15).map(m => `- ${m.title}: ${m.summary || ""} (started: ${new Date(m.date).toLocaleDateString()})`).join("\n")}

Lab Results (${categorized.labs.length}):
${categorized.labs.slice(0, 15).map(l => `- ${l.title}: ${l.summary || ""} (${new Date(l.date).toLocaleDateString()})`).join("\n")}

Recent Visits:
${categorized.visits.slice(0, 5).map(v => `- ${v.title} at ${v.facility || "Unknown"} (${new Date(v.date).toLocaleDateString()})`).join("\n")}

Procedures:
${categorized.procedures.slice(0, 5).map(p => `- ${p.title} (${new Date(p.date).toLocaleDateString()})`).join("\n")}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-advanced-analytics",
      callerMethod: "advancedAnalytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const savedDeviations: ProtocolDeviation[] = [];
    for (const deviation of parsed.deviations || []) {
      const saved = await storage.createProtocolDeviation({
        userId,
        patientId: userId,
        protocolId: request.protocolId || null,
        deviationType: deviation.deviationType || "unknown",
        severity: deviation.severity || "warning",
        protocolStep: deviation.protocolStep ? parseInt(deviation.protocolStep) : null,
        expectedAction: deviation.expectedAction || null,
        actualAction: deviation.actualAction || null,
        expectedTimeframe: deviation.expectedTimeframe || null,
        actualTimeframe: deviation.actualTimeframe || null,
        clinicalJustification: deviation.clinicalContext || null,
        aiAnalysis: deviation.aiAnalysis || null,
        aiRecommendations: deviation.recommendations || null,
        riskAssessment: deviation.riskAssessment || null,
        status: "detected",
        aiModel: AI_MODEL,
      });
      savedDeviations.push(saved);
    }

    return {
      deviations: savedDeviations.map((d, i) => ({
        id: d.id,
        deviationType: d.deviationType,
        severity: d.severity,
        expectedAction: d.expectedAction || "",
        actualAction: d.actualAction || "",
        aiAnalysis: d.aiAnalysis || "",
        recommendations: (parsed.deviations?.[i]?.recommendations || []) as string[],
      })),
      summary: {
        totalDeviations: parsed.summary?.totalDeviations || savedDeviations.length,
        criticalCount: parsed.summary?.criticalCount || 0,
        warningCount: parsed.summary?.warningCount || 0,
        complianceScore: parsed.complianceScore || 100,
      },
    };
  } catch (error) {
    console.error("Protocol deviation detection error:", error);
    throw new Error("Failed to detect protocol deviations");
  }
}

export interface KpiReportRequest {
  reportType: "quality_measures" | "utilization" | "outcomes" | "efficiency" | "comprehensive";
  reportPeriod: "monthly" | "quarterly" | "annual" | "custom";
  startDate?: Date;
  endDate?: Date;
}

export interface KpiReportResult {
  report: {
    id: string;
    title: string;
    summary: string;
    metrics: Array<{
      name: string;
      category: string;
      value: number;
      unit: string;
      target?: number;
      trend: string;
      status: string;
    }>;
    insights: string[];
    recommendations: string[];
  };
}

export async function generateKpiReport(
  userId: string,
  request: KpiReportRequest
): Promise<KpiReportResult> {
  const records = await getAllRecords(userId);
  const categorized = categorizeRecords(records);
  
  const endDate = request.endDate || new Date();
  const startDate = request.startDate || (() => {
    const d = new Date(endDate);
    switch (request.reportPeriod) {
      case "monthly": d.setMonth(d.getMonth() - 1); break;
      case "quarterly": d.setMonth(d.getMonth() - 3); break;
      case "annual": d.setFullYear(d.getFullYear() - 1); break;
      default: d.setMonth(d.getMonth() - 1);
    }
    return d;
  })();

  const periodRecords = records.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate >= startDate && recordDate <= endDate;
  });

  const systemPrompt = `You are a healthcare analytics AI specializing in Key Performance Indicator (KPI) analysis and reporting. Generate comprehensive healthcare performance metrics based on patient data.

Report Type: ${request.reportType}
Period: ${request.reportPeriod} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})

IMPORTANT:
- Calculate realistic metrics based on the provided data
- Compare against industry benchmarks where applicable
- Identify trends and patterns
- Provide actionable recommendations

Respond in JSON format:
{
  "title": "KPI Report Title",
  "executiveSummary": "High-level overview of performance",
  "metrics": [
    {
      "name": "Metric name",
      "category": "quality|utilization|outcomes|efficiency",
      "value": 85.5,
      "unit": "%|count|days|ratio",
      "target": 90,
      "previousValue": 82,
      "changePercentage": 4.3,
      "trend": "improving|stable|declining",
      "status": "exceeds_target|meets_target|below_target",
      "benchmark": 88,
      "interpretation": "What this metric means"
    }
  ],
  "categoryBreakdown": {
    "quality": { "score": 85, "trend": "improving" },
    "utilization": { "score": 78, "trend": "stable" },
    "outcomes": { "score": 92, "trend": "improving" },
    "efficiency": { "score": 70, "trend": "declining" }
  },
  "trends": [
    {
      "metric": "Metric name",
      "direction": "up|down|stable",
      "magnitude": "significant|moderate|slight",
      "period": "Last 3 months",
      "analysis": "Trend analysis"
    }
  ],
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "area": "Area of improvement",
      "recommendation": "Specific recommendation",
      "expectedImpact": "Expected outcome"
    }
  ],
  "visualizationData": {
    "timeSeriesData": [{"period": "Jan", "value": 85}],
    "categoryDistribution": [{"category": "Quality", "value": 85}]
  }
}`;

  const userMessage = `Generate a ${request.reportType} KPI report for the ${request.reportPeriod} period.

PERIOD DATA SUMMARY:
- Total Records in Period: ${periodRecords.length}
- Visits: ${categorized.visits.filter(v => new Date(v.date) >= startDate).length}
- Lab Tests: ${categorized.labs.filter(l => new Date(l.date) >= startDate).length}
- Procedures: ${categorized.procedures.filter(p => new Date(p.date) >= startDate).length}
- Medications: ${categorized.medications.length} active
- Conditions: ${categorized.conditions.length} tracked

RECENT ACTIVITY:
${periodRecords.slice(0, 20).map(r => `- ${r.type}: ${r.title} (${new Date(r.date).toLocaleDateString()})`).join("\n")}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-advanced-analytics",
      callerMethod: "advancedAnalytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const report = await storage.createKpiReport({
      userId,
      reportType: request.reportType,
      reportPeriod: request.reportPeriod,
      startDate,
      endDate,
      title: parsed.title || `${request.reportType} KPI Report`,
      summary: parsed.executiveSummary || null,
      metrics: parsed.metrics || [],
      categoryBreakdown: parsed.categoryBreakdown || null,
      trends: parsed.trends || null,
      insights: parsed.insights || null,
      recommendations: parsed.recommendations || null,
      visualizations: parsed.visualizationData || null,
      aiAnalysis: parsed.executiveSummary || null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
      expiresAt,
    });

    return {
      report: {
        id: report.id,
        title: parsed.title || "",
        summary: parsed.executiveSummary || "",
        metrics: parsed.metrics || [],
        insights: parsed.insights || [],
        recommendations: (parsed.recommendations || []).map((r: any) => r.recommendation || r),
      },
    };
  } catch (error) {
    console.error("KPI report generation error:", error);
    throw new Error("Failed to generate KPI report");
  }
}

export interface PopulationHealthRequest {
  reportType: "trends" | "risk_stratification" | "disparities" | "intervention_effectiveness" | "comprehensive";
  cohortCriteria?: {
    conditions?: string[];
    ageRange?: { min: number; max: number };
    riskLevel?: string;
  };
  reportPeriod?: "quarterly" | "annual" | "custom";
  startDate?: Date;
  endDate?: Date;
}

export interface PopulationHealthResult {
  report: {
    id: string;
    title: string;
    executiveSummary: string;
    cohortSize: number;
    keyMetrics: Record<string, any>;
    trends: any[];
    insights: string[];
    recommendations: string[];
  };
}

export async function generatePopulationHealthReport(
  userId: string,
  request: PopulationHealthRequest
): Promise<PopulationHealthResult> {
  const records = await getAllRecords(userId);
  const categorized = categorizeRecords(records);

  const systemPrompt = `You are a population health analytics AI specializing in healthcare trend analysis and population-level insights. Generate comprehensive population health reports based on aggregated patient data.

Report Type: ${request.reportType}
${request.cohortCriteria ? `Cohort Criteria: ${JSON.stringify(request.cohortCriteria)}` : ""}

IMPORTANT:
- Analyze population-level trends and patterns
- Identify health disparities and gaps in care
- Provide evidence-based recommendations
- Consider social determinants of health

Respond in JSON format:
{
  "title": "Population Health Report Title",
  "executiveSummary": "High-level summary of population health status",
  "cohortSize": 1,
  "demographics": {
    "ageDistribution": [{"range": "18-34", "percentage": 25}],
    "conditionPrevalence": [{"condition": "Diabetes", "percentage": 15}]
  },
  "prevalenceRates": [
    {"condition": "Condition name", "rate": 15.5, "trend": "increasing", "benchmark": 12}
  ],
  "riskStratification": {
    "highRisk": {"count": 1, "percentage": 10, "primaryFactors": ["Factor 1"]},
    "moderateRisk": {"count": 3, "percentage": 30},
    "lowRisk": {"count": 6, "percentage": 60}
  },
  "outcomeMetrics": [
    {"metric": "Metric name", "value": 85, "target": 90, "trend": "improving"}
  ],
  "qualityIndicators": [
    {"indicator": "Indicator name", "score": 88, "benchmark": 85, "status": "above_benchmark"}
  ],
  "disparitiesAnalysis": {
    "identified": true,
    "areas": [{"area": "Area of disparity", "description": "Description", "severity": "moderate"}]
  },
  "trends": [
    {"metric": "Metric", "direction": "improving", "magnitude": "5%", "period": "12 months"}
  ],
  "interventionEffectiveness": [
    {"intervention": "Intervention name", "effectiveness": 75, "nnt": 8, "recommendation": "Continue"}
  ],
  "aiInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "aiRecommendations": [
    {"priority": "high", "recommendation": "Recommendation", "rationale": "Why", "expectedImpact": "Impact"}
  ]
}`;

  const userMessage = `Generate a ${request.reportType} population health report.

POPULATION DATA (based on this patient's data as a sample):
Conditions (${categorized.conditions.length}):
${categorized.conditions.map(c => `- ${c.title}`).join("\n")}

Medications (${categorized.medications.length}):
${categorized.medications.slice(0, 10).map(m => `- ${m.title}`).join("\n")}

Recent Labs (${categorized.labs.length}):
${categorized.labs.slice(0, 10).map(l => `- ${l.title}: ${l.summary || ""}`).join("\n")}

Vitals Trends:
${categorized.vitals.slice(0, 5).map(v => `- ${v.title}: ${v.summary || ""}`).join("\n")}

Healthcare Utilization:
- Total Visits: ${categorized.visits.length}
- Procedures: ${categorized.procedures.length}
- Imaging Studies: ${categorized.imaging.length}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-advanced-analytics",
      callerMethod: "advancedAnalytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const report = await storage.createPopulationHealthReport({
      userId,
      reportType: request.reportType,
      cohortCriteria: request.cohortCriteria || null,
      cohortSize: parsed.cohortSize || 1,
      reportPeriod: request.reportPeriod || null,
      startDate: request.startDate || null,
      endDate: request.endDate || null,
      title: parsed.title || `Population Health ${request.reportType} Report`,
      executiveSummary: parsed.executiveSummary || null,
      demographics: parsed.demographics || null,
      prevalenceRates: parsed.prevalenceRates || null,
      incidenceRates: null,
      riskStratification: parsed.riskStratification || null,
      outcomeMetrics: parsed.outcomeMetrics || null,
      qualityIndicators: parsed.qualityIndicators || null,
      disparitiesAnalysis: parsed.disparitiesAnalysis || null,
      trends: parsed.trends || null,
      benchmarkComparisons: null,
      interventionEffectiveness: parsed.interventionEffectiveness || null,
      costAnalysis: null,
      aiInsights: parsed.aiInsights || null,
      aiRecommendations: parsed.aiRecommendations || null,
      visualizationData: null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
    });

    return {
      report: {
        id: report.id,
        title: parsed.title || "",
        executiveSummary: parsed.executiveSummary || "",
        cohortSize: parsed.cohortSize || 1,
        keyMetrics: {
          riskStratification: parsed.riskStratification,
          qualityIndicators: parsed.qualityIndicators,
          outcomeMetrics: parsed.outcomeMetrics,
        },
        trends: parsed.trends || [],
        insights: parsed.aiInsights || [],
        recommendations: (parsed.aiRecommendations || []).map((r: any) => r.recommendation || r),
      },
    };
  } catch (error) {
    console.error("Population health report error:", error);
    throw new Error("Failed to generate population health report");
  }
}

export interface TreatmentEfficacyRequest {
  analysisType: "single_treatment" | "comparative" | "longitudinal" | "subgroup";
  treatmentType: "medication" | "procedure" | "therapy" | "intervention";
  condition?: string;
  medicationClass?: string;
  procedureType?: string;
  studyPeriod?: "6_months" | "1_year" | "2_years" | "5_years";
}

export interface TreatmentEfficacyResult {
  analysis: {
    id: string;
    treatmentType: string;
    condition: string;
    efficacyMetrics: Array<{
      metric: string;
      value: number;
      unit: string;
      significance: string;
    }>;
    conclusions: string;
    recommendations: string[];
  };
}

export async function analyzeTreatmentEfficacy(
  userId: string,
  request: TreatmentEfficacyRequest
): Promise<TreatmentEfficacyResult> {
  const records = await getAllRecords(userId);
  const categorized = categorizeRecords(records);

  const systemPrompt = `You are a clinical outcomes research AI specializing in treatment efficacy analysis. Analyze patient data to evaluate the effectiveness of treatments.

Analysis Type: ${request.analysisType}
Treatment Type: ${request.treatmentType}
${request.condition ? `Target Condition: ${request.condition}` : ""}
${request.medicationClass ? `Medication Class: ${request.medicationClass}` : ""}
${request.procedureType ? `Procedure Type: ${request.procedureType}` : ""}

IMPORTANT:
- Base analysis on objective outcome measures
- Consider confounding factors
- Provide evidence-based conclusions
- Note limitations of the analysis

Respond in JSON format:
{
  "treatmentAnalysis": {
    "treatmentName": "Specific treatment analyzed",
    "condition": "Target condition",
    "studyPeriod": "Period analyzed",
    "cohortSize": 1
  },
  "primaryOutcome": {
    "measure": "Primary outcome measure",
    "baseline": "Baseline value",
    "followUp": "Follow-up value",
    "change": "Change amount",
    "percentChange": 15
  },
  "efficacyMetrics": [
    {
      "metric": "Metric name",
      "value": 75,
      "unit": "%|score|days",
      "confidenceInterval": {"lower": 65, "upper": 85},
      "pValue": 0.001,
      "significance": "statistically_significant|not_significant"
    }
  ],
  "safetyMetrics": [
    {"event": "Adverse event", "frequency": "rare|occasional|common", "severity": "mild|moderate|severe"}
  ],
  "adherenceRate": 85,
  "subgroupAnalyses": [
    {"subgroup": "Subgroup name", "efficacy": 80, "notes": "Analysis notes"}
  ],
  "comparatorAnalyses": [
    {"comparator": "Alternative treatment", "relativeEfficacy": "similar|superior|inferior"}
  ],
  "numberNeededToTreat": 8,
  "absoluteRiskReduction": 12.5,
  "relativeRiskReduction": 35,
  "limitations": ["Limitation 1", "Limitation 2"],
  "conclusions": "Overall conclusion about treatment efficacy",
  "recommendations": [
    {"recommendation": "Clinical recommendation", "strength": "strong|moderate|weak", "rationale": "Supporting evidence"}
  ]
}`;

  const userMessage = `Analyze treatment efficacy for this patient's data.

TREATMENT DATA:
Medications (${categorized.medications.length}):
${categorized.medications.map(m => `- ${m.title}: ${m.summary || ""} (${new Date(m.date).toLocaleDateString()})`).join("\n")}

Procedures (${categorized.procedures.length}):
${categorized.procedures.map(p => `- ${p.title}: ${p.summary || ""} (${new Date(p.date).toLocaleDateString()})`).join("\n")}

OUTCOME DATA:
Conditions:
${categorized.conditions.map(c => `- ${c.title}: ${c.summary || ""}`).join("\n")}

Lab Results (${categorized.labs.length}):
${categorized.labs.slice(0, 15).map(l => `- ${l.title}: ${l.summary || ""} (${new Date(l.date).toLocaleDateString()})`).join("\n")}

Vitals (${categorized.vitals.length}):
${categorized.vitals.slice(0, 10).map(v => `- ${v.title}: ${v.summary || ""} (${new Date(v.date).toLocaleDateString()})`).join("\n")}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 4096,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-advanced-analytics",
      callerMethod: "advancedAnalytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const analysis = await storage.createTreatmentEfficacyAnalysis({
      userId,
      analysisType: request.analysisType,
      treatmentType: request.treatmentType,
      condition: request.condition || parsed.treatmentAnalysis?.condition || null,
      medicationClass: request.medicationClass || null,
      procedureType: request.procedureType || null,
      cohortSize: parsed.treatmentAnalysis?.cohortSize || 1,
      studyPeriod: request.studyPeriod || null,
      startDate: null,
      endDate: null,
      primaryOutcome: parsed.primaryOutcome?.measure || null,
      secondaryOutcomes: null,
      efficacyMetrics: parsed.efficacyMetrics || [],
      safetyMetrics: parsed.safetyMetrics || null,
      adherenceRates: parsed.adherenceRate ? { overall: parsed.adherenceRate } : null,
      subgroupAnalyses: parsed.subgroupAnalyses || null,
      comparatorAnalyses: parsed.comparatorAnalyses || null,
      numberNeededToTreat: parsed.numberNeededToTreat || null,
      absoluteRiskReduction: parsed.absoluteRiskReduction || null,
      relativeRiskReduction: parsed.relativeRiskReduction || null,
      costEffectiveness: null,
      limitations: parsed.limitations || null,
      conclusions: parsed.conclusions || null,
      recommendations: parsed.recommendations || null,
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
    });

    return {
      analysis: {
        id: analysis.id,
        treatmentType: request.treatmentType,
        condition: request.condition || parsed.treatmentAnalysis?.condition || "",
        efficacyMetrics: parsed.efficacyMetrics || [],
        conclusions: parsed.conclusions || "",
        recommendations: (parsed.recommendations || []).map((r: any) => r.recommendation || r),
      },
    };
  } catch (error) {
    console.error("Treatment efficacy analysis error:", error);
    throw new Error("Failed to analyze treatment efficacy");
  }
}

export async function getTreatmentProtocols(userId: string): Promise<TreatmentProtocol[]> {
  return storage.getTreatmentProtocols(userId);
}

export async function getProtocolDeviations(userId: string): Promise<ProtocolDeviation[]> {
  return storage.getProtocolDeviations(userId);
}

export async function getKpiReports(userId: string): Promise<KpiReport[]> {
  return storage.getKpiReports(userId);
}

export async function getOutcomePredictions(userId: string): Promise<OutcomePrediction[]> {
  return storage.getOutcomePredictions(userId);
}

export async function getPopulationHealthReports(userId: string): Promise<PopulationHealthReport[]> {
  return storage.getPopulationHealthReports(userId);
}

export async function getTreatmentEfficacyAnalyses(userId: string): Promise<TreatmentEfficacyAnalysis[]> {
  return storage.getTreatmentEfficacyAnalyses(userId);
}

export const aiAdvancedAnalytics = {
  generateOutcomePrediction,
  detectProtocolDeviations,
  generateKpiReport,
  generatePopulationHealthReport,
  analyzeTreatmentEfficacy,
  getTreatmentProtocols,
  getProtocolDeviations,
  getKpiReports,
  getOutcomePredictions,
  getPopulationHealthReports,
  getTreatmentEfficacyAnalyses,
};
