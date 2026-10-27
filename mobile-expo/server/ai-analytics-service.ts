import { storage } from "./storage";
import type { HealthRecord, HealthReport, TrendAnalysis } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

// Helper to get records by user
async function getRecordsByUser(userId: string): Promise<HealthRecord[]> {
  return storage.getHealthRecords(userId);
}

// ============================================
// Natural Language Query Interface
// ============================================

interface ParsedIntent {
  action: string;
  entities: any[];
  filters: any;
  timeRange?: { start?: string; end?: string };
}

interface NLQueryResult {
  summary: string;
  records: HealthRecord[];
  count: number;
  queryType: string;
  parsedIntent: ParsedIntent;
}

export async function processNaturalLanguageQuery(
  userId: string,
  query: string
): Promise<NLQueryResult> {
  const startTime = Date.now();

  // Get user's health records for context
  const records = await getRecordsByUser(userId);

  const systemPrompt = `You are a HIPAA-compliant health data analyst. Analyze the user's health records and respond to their natural language queries.

Available record types: visit, lab, medication, imaging, procedure, immunization, allergy, vital

The user has ${records.length} health records. Here's a summary of their data:
${generateDataSummary(records)}

When responding:
1. Parse the user's intent (search, aggregate, trend, comparison)
2. Identify relevant entities (conditions, medications, labs, dates)
3. Filter and analyze the relevant records
4. Provide a clear, helpful summary

Respond in JSON format:
{
  "queryType": "search" | "aggregate" | "trend" | "comparison",
  "parsedIntent": {
    "action": "description of what user wants",
    "entities": ["list of medical entities mentioned"],
    "filters": { "type": [], "dateRange": null, "conditions": [] },
    "timeRange": { "start": "ISO date or null", "end": "ISO date or null" }
  },
  "matchingRecordIds": ["list of record IDs that match the query"],
  "summary": "Natural language summary of findings",
  "insights": ["Key insight 1", "Key insight 2"],
  "followUpQuestions": ["Suggested follow-up question 1"]
}`;

  const userMessage = `Query: "${query}"

Here are the health records to search through:
${JSON.stringify(records.slice(0, 100).map(r => ({
  id: r.id,
  type: r.type,
  title: r.title,
  summary: r.summary,
  date: r.date,
  provider: r.provider,
  facility: r.facility,
  details: r.details,
})), null, 2)}`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    const matchingRecords = records.filter(r =>
      (parsed.matchingRecordIds || []).includes(r.id)
    );

    const processingTime = Date.now() - startTime;

    // Store the query for history
    await storage.createNlQuery({
      userId,
      query,
      queryType: parsed.queryType || "search",
      parsedIntent: parsed.parsedIntent,
      resultSummary: parsed.summary,
      resultCount: matchingRecords.length,
      resultData: {
        insights: parsed.insights,
        followUpQuestions: parsed.followUpQuestions,
      },
      relatedRecordIds: parsed.matchingRecordIds || [],
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens || 0,
      completionTokens: response.usage?.completionTokens || 0,
      processingTimeMs: processingTime,
    });

    return {
      summary: parsed.summary || "No results found for your query.",
      records: matchingRecords,
      count: matchingRecords.length,
      queryType: parsed.queryType || "search",
      parsedIntent: parsed.parsedIntent || { action: query, entities: [], filters: {} },
    };
  } catch (error) {
    console.error("NL query error:", error);
    throw new Error("Failed to process natural language query");
  }
}

// ============================================
// Predictive Analytics
// ============================================

interface PredictionRequest {
  category: "vitals" | "labs" | "conditions" | "medications" | "general";
  timeframe: "next_week" | "next_month" | "next_quarter" | "next_year";
}

interface PredictionResult {
  predictions: Array<{
    title: string;
    summary: string;
    confidence: number;
    riskLevel: string;
    recommendations: string[];
    dataPoints: any[];
    predictedValues: any[];
  }>;
}

export async function generateHealthPredictions(
  userId: string,
  request: PredictionRequest
): Promise<PredictionResult> {
  const records = await getRecordsByUser(userId);

  // Filter records by category
  const categoryRecords = records.filter(r => {
    switch (request.category) {
      case "vitals":
        return r.type === "vital";
      case "labs":
        return r.type === "lab";
      case "conditions":
        return r.type === "visit" || r.fhirResourceType === "Condition";
      case "medications":
        return r.type === "medication";
      default:
        return true;
    }
  });

  const systemPrompt = `You are a healthcare predictive analytics AI. Analyze the patient's historical health data and generate predictions for future health trends.

IMPORTANT: You are providing educational insights, not medical advice. Always recommend consulting healthcare providers.

Analyze the data and predict trends for the ${request.timeframe} timeframe.

Respond in JSON format:
{
  "predictions": [
    {
      "type": "trend" | "risk" | "recommendation",
      "title": "Brief title",
      "summary": "Detailed explanation of the prediction",
      "confidence": 0-100,
      "riskLevel": "low" | "moderate" | "high" | "critical",
      "recommendations": ["Action item 1", "Action item 2"],
      "dataPoints": [{"date": "ISO date", "value": number, "label": "description"}],
      "predictedValues": [{"date": "ISO date", "value": number, "label": "prediction"}],
      "relatedRecordIds": ["record IDs used for this prediction"]
    }
  ],
  "overallHealthTrend": "improving" | "stable" | "declining" | "mixed",
  "keyInsights": ["Insight 1", "Insight 2"]
}`;

  const userMessage = `Patient health records for analysis (${request.category} category, ${categoryRecords.length} records):

${JSON.stringify(categoryRecords.slice(0, 50).map(r => ({
  id: r.id,
  type: r.type,
  title: r.title,
  summary: r.summary,
  date: r.date,
  details: r.details,
})), null, 2)}

Generate health predictions for the ${request.timeframe} timeframe.`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    // Store predictions in database
    for (const prediction of parsed.predictions || []) {
      await storage.createHealthPrediction({
        userId,
        predictionType: prediction.type || "trend",
        category: request.category,
        title: prediction.title,
        summary: prediction.summary,
        confidence: prediction.confidence || 50,
        riskLevel: prediction.riskLevel,
        timeframe: request.timeframe,
        dataPoints: prediction.dataPoints,
        predictedValues: prediction.predictedValues,
        recommendations: prediction.recommendations,
        relatedRecordIds: prediction.relatedRecordIds,
        aiModel: AI_MODEL,
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        expiresAt: getExpirationDate(request.timeframe),
      });
    }

    return {
      predictions: parsed.predictions || [],
    };
  } catch (error) {
    console.error("Prediction error:", error);
    throw new Error("Failed to generate health predictions");
  }
}

// ============================================
// Anomaly Detection
// ============================================

interface AnomalyResult {
  anomalies: Array<{
    type: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    affectedRecordIds: string[];
    expectedValue?: string;
    actualValue?: string;
    deviation?: number;
    suggestedAction: string;
  }>;
}

export async function detectAnomalies(userId: string): Promise<AnomalyResult> {
  const records = await getRecordsByUser(userId);

  const systemPrompt = `You are a healthcare data quality and clinical anomaly detection AI. Analyze the patient's health records to identify:

1. DATA QUALITY ISSUES:
   - Missing critical information
   - Inconsistent data (conflicting dates, duplicate entries)
   - Invalid or out-of-range values
   - Incomplete records

2. CLINICAL ANOMALIES:
   - Unusual vital sign patterns
   - Lab values significantly outside normal ranges
   - Potential drug interactions
   - Gaps in expected care (missed follow-ups)

3. PATTERN ANOMALIES:
   - Sudden changes in health metrics
   - Unusual timing of events
   - Inconsistencies between related records

Respond in JSON format:
{
  "anomalies": [
    {
      "type": "data_quality" | "clinical" | "pattern" | "duplicate",
      "severity": "info" | "warning" | "critical",
      "category": "vitals" | "labs" | "medications" | "conditions" | "general",
      "title": "Brief title",
      "description": "Detailed description of the anomaly",
      "affectedRecordIds": ["record IDs affected"],
      "expectedValue": "what was expected (if applicable)",
      "actualValue": "what was found (if applicable)",
      "deviation": percentage deviation from normal (if applicable),
      "suggestedAction": "Recommended action to resolve"
    }
  ],
  "summary": {
    "totalAnomalies": number,
    "criticalCount": number,
    "warningCount": number,
    "infoCount": number,
    "dataQualityScore": 0-100
  }
}`;

  const userMessage = `Analyze these health records for anomalies and data quality issues:

${JSON.stringify(records.slice(0, 100).map(r => ({
  id: r.id,
  type: r.type,
  title: r.title,
  summary: r.summary,
  date: r.date,
  provider: r.provider,
  facility: r.facility,
  details: r.details,
  fhirResourceType: r.fhirResourceType,
})), null, 2)}`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    // Store anomalies in database
    for (const anomaly of parsed.anomalies || []) {
      await storage.createAnomalyDetection({
        userId,
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        category: anomaly.category,
        title: anomaly.title,
        description: anomaly.description,
        affectedRecordIds: anomaly.affectedRecordIds,
        expectedValue: anomaly.expectedValue,
        actualValue: anomaly.actualValue,
        deviation: anomaly.deviation,
        suggestedAction: anomaly.suggestedAction,
        aiModel: AI_MODEL,
      });
    }

    return {
      anomalies: parsed.anomalies || [],
    };
  } catch (error) {
    console.error("Anomaly detection error:", error);
    throw new Error("Failed to detect anomalies");
  }
}

// ============================================
// Population Analytics (At-Risk Identification)
// ============================================

interface PopulationQuery {
  criteria: string; // e.g., "patients over 65 with diabetes"
}

interface PopulationResult {
  matchDescription: string;
  matchCount: number;
  commonConditions: Array<{ condition: string; count: number; percentage: number }>;
  riskDistribution: { low: number; moderate: number; high: number };
  insights: string[];
  recommendations: string[];
}

export async function analyzePopulation(
  userId: string,
  query: PopulationQuery
): Promise<PopulationResult> {
  const records = await getRecordsByUser(userId);

  const systemPrompt = `You are a healthcare population analytics AI. Analyze health records to identify patterns and insights for specific patient populations.

Given the user's query about a patient population, analyze their health data to provide:
1. How many records/conditions match the criteria
2. Common co-occurring conditions
3. Risk stratification
4. Actionable insights

Respond in JSON format:
{
  "matchDescription": "Description of what matched the criteria",
  "matchCount": number,
  "matchingRecordIds": ["record IDs that match"],
  "commonConditions": [
    { "condition": "name", "count": number, "percentage": number }
  ],
  "riskDistribution": {
    "low": percentage,
    "moderate": percentage,
    "high": percentage
  },
  "insights": ["Key insight 1", "Key insight 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "ageDistribution": { "under50": number, "50to65": number, "over65": number },
  "trends": [
    { "metric": "name", "direction": "increasing" | "stable" | "decreasing", "significance": "high" | "medium" | "low" }
  ]
}`;

  const userMessage = `Population query: "${query.criteria}"

Health records to analyze:
${JSON.stringify(records.slice(0, 100).map(r => ({
  id: r.id,
  type: r.type,
  title: r.title,
  summary: r.summary,
  date: r.date,
  details: r.details,
})), null, 2)}`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    // Store population analytics
    await storage.createPopulationAnalytics({
      userId,
      analysisType: "cohort",
      cohortCriteria: { searchQuery: query.criteria } as any,
      metrics: {
        totalPatients: parsed.matchCount,
        riskDistribution: parsed.riskDistribution,
        commonConditions: parsed.commonConditions,
        trends: parsed.trends,
      },
      insights: parsed.insights,
      visualizationData: {
        ageDistribution: parsed.ageDistribution,
        riskDistribution: parsed.riskDistribution,
      },
      aiModel: AI_MODEL,
    });

    return {
      matchDescription: parsed.matchDescription || "Analysis complete",
      matchCount: parsed.matchCount || 0,
      commonConditions: parsed.commonConditions || [],
      riskDistribution: parsed.riskDistribution || { low: 0, moderate: 0, high: 0 },
      insights: parsed.insights || [],
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error("Population analysis error:", error);
    throw new Error("Failed to analyze population");
  }
}

// ============================================
// Helper Functions
// ============================================

function generateDataSummary(records: HealthRecord[]): string {
  const typeCounts: Record<string, number> = {};
  const recentRecords: string[] = [];

  for (const record of records) {
    typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
  }

  // Get 5 most recent records
  const sorted = [...records].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  for (const record of sorted.slice(0, 5)) {
    recentRecords.push(`- ${record.type}: ${record.title} (${new Date(record.date).toLocaleDateString()})`);
  }

  return `
Record types: ${Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}

Most recent records:
${recentRecords.join("\n")}
`;
}

function getExpirationDate(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case "next_week":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "next_month":
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "next_quarter":
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case "next_year":
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

// ============================================
// Comprehensive Trend Analysis
// ============================================

interface TrendAnalysisRequest {
  category?: "vitals" | "labs" | "conditions" | "medications" | "overall";
  metric?: string;
  periodMonths?: number;
}

interface TrendAnalysisResult {
  trends: Array<{
    metric: string;
    category: string;
    direction: string;
    significance: string;
    changePercentage: number;
    dataPoints: Array<{ date: string; value: number }>;
    projectedValues: Array<{ date: string; value: number; confidence: number }>;
    analysis: string;
    recommendations: string[];
  }>;
  correlations: Array<{
    metric1: string;
    metric2: string;
    correlation: number;
    relationship: string;
  }>;
  overallTrend: string;
  keyInsights: string[];
}

export async function analyzeTrends(
  userId: string,
  request: TrendAnalysisRequest = {}
): Promise<TrendAnalysisResult> {
  const startTime = Date.now();
  const records = await getRecordsByUser(userId);
  
  const periodMonths = request.periodMonths || 12;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  
  const recentRecords = records.filter(r => new Date(r.date) >= cutoffDate);
  
  let categoryRecords = recentRecords;
  if (request.category && request.category !== "overall") {
    categoryRecords = recentRecords.filter(r => {
      switch (request.category) {
        case "vitals": return r.type === "vital";
        case "labs": return r.type === "lab" || r.type === "labs";
        case "conditions": return r.type === "condition" || r.fhirResourceType === "Condition";
        case "medications": return r.type === "medication";
        default: return true;
      }
    });
  }

  const systemPrompt = `You are an AI health analytics expert specializing in identifying trends and patterns in patient health data. Analyze the provided health records to identify meaningful trends, correlations, and actionable insights.

IMPORTANT: Provide educational health insights, not medical diagnosis. Always recommend consulting healthcare providers for medical decisions.

For each identified trend, provide:
1. Clear direction (improving, stable, declining, fluctuating)
2. Statistical significance (high, medium, low)
3. Percentage change over the period
4. Data points for visualization
5. Projected future values with confidence levels
6. Clinical interpretation
7. Actionable recommendations

Also identify correlations between different health metrics.

Respond in JSON format:
{
  "trends": [
    {
      "metric": "metric name (e.g., blood_pressure_systolic, glucose, weight)",
      "category": "vitals|labs|conditions|medications",
      "direction": "improving|stable|declining|fluctuating",
      "significance": "high|medium|low",
      "changePercentage": number,
      "dataPoints": [{"date": "YYYY-MM-DD", "value": number}],
      "projectedValues": [{"date": "YYYY-MM-DD", "value": number, "confidence": 0-100}],
      "analysis": "Clinical interpretation of the trend",
      "recommendations": ["actionable recommendation 1", "recommendation 2"]
    }
  ],
  "correlations": [
    {
      "metric1": "first metric",
      "metric2": "second metric", 
      "correlation": -1 to 1,
      "relationship": "description of the relationship"
    }
  ],
  "overallTrend": "improving|stable|declining|mixed",
  "keyInsights": ["insight 1", "insight 2", "insight 3"]
}`;

  const userMessage = `Analyze health trends for the past ${periodMonths} months.
${request.category ? `Focus on category: ${request.category}` : "Analyze all categories"}
${request.metric ? `Specifically look at: ${request.metric}` : ""}

Health records to analyze (${categoryRecords.length} records):
${JSON.stringify(categoryRecords.slice(0, 75).map(r => ({
  id: r.id,
  type: r.type,
  title: r.title,
  summary: r.summary,
  date: r.date,
  details: r.details,
  fhirResourceType: r.fhirResourceType,
})), null, 2)}`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);
    const generationTime = Date.now() - startTime;

    for (const trend of parsed.trends || []) {
      await storage.createTrendAnalysis({
        userId,
        category: trend.category || request.category || "overall",
        metric: trend.metric,
        analysisType: "time_series",
        title: `${trend.metric} Trend Analysis`,
        summary: trend.analysis,
        trendDirection: trend.direction,
        significance: trend.significance,
        changePercentage: trend.changePercentage,
        dataPoints: trend.dataPoints,
        projectedValues: trend.projectedValues,
        correlations: parsed.correlations?.filter((c: any) => 
          c.metric1 === trend.metric || c.metric2 === trend.metric
        ),
        clinicalInsights: [trend.analysis],
        recommendations: trend.recommendations,
        periodStart: cutoffDate,
        periodEnd: new Date(),
        relatedRecordIds: categoryRecords.slice(0, 50).map(r => r.id),
        aiModel: AI_MODEL,
      });
    }

    return {
      trends: parsed.trends || [],
      correlations: parsed.correlations || [],
      overallTrend: parsed.overallTrend || "stable",
      keyInsights: parsed.keyInsights || [],
    };
  } catch (error) {
    console.error("Trend analysis error:", error);
    throw new Error("Failed to analyze health trends");
  }
}

// ============================================
// Comprehensive Health Report Generation
// ============================================

interface HealthReportRequest {
  reportType: "comprehensive" | "condition_specific" | "periodic" | "risk_assessment";
  conditionFocus?: string;
  periodMonths?: number;
}

interface HealthReportResult {
  report: {
    id: string;
    title: string;
    executiveSummary: string;
    overallHealthScore: number;
    healthStatus: string;
    sections: Array<{
      title: string;
      category: string;
      content: string;
      keyFindings: string[];
      recommendations: string[];
      riskLevel?: string;
      trendDirection?: string;
    }>;
    trends: Array<{
      metric: string;
      category: string;
      direction: string;
      significance: string;
      dataPoints: Array<{ date: string; value: number }>;
      analysis: string;
    }>;
    riskFactors: Array<{
      name: string;
      level: string;
      description: string;
      mitigation: string[];
    }>;
    actionItems: Array<{
      priority: string;
      category: string;
      action: string;
      dueDate?: string;
      rationale: string;
    }>;
    recordsAnalyzed: number;
    generatedAt: string;
  };
}

export async function generateHealthReport(
  userId: string,
  request: HealthReportRequest
): Promise<HealthReportResult> {
  const startTime = Date.now();
  const records = await getRecordsByUser(userId);
  const user = await storage.getUser(userId);
  
  const periodMonths = request.periodMonths || 12;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  
  const recentRecords = records.filter(r => new Date(r.date) >= cutoffDate);
  
  const conditions = records.filter(r => r.type === "condition" || r.fhirResourceType === "Condition");
  const medications = records.filter(r => r.type === "medication");
  const vitals = recentRecords.filter(r => r.type === "vital");
  const labs = recentRecords.filter(r => r.type === "lab" || r.type === "labs");
  const allergies = records.filter(r => r.type === "allergy");
  const immunizations = records.filter(r => r.type === "immunization");

  const reportTypeDescriptions: Record<string, string> = {
    comprehensive: "Generate a comprehensive health report covering all aspects of the patient's health",
    condition_specific: `Generate a focused report on ${request.conditionFocus || "the patient's primary condition"}`,
    periodic: `Generate a ${periodMonths}-month periodic health review`,
    risk_assessment: "Generate a health risk assessment report identifying potential future health risks",
  };

  const systemPrompt = `You are an AI health report generator. ${reportTypeDescriptions[request.reportType]}

Create a professional, detailed health report that:
1. Provides an executive summary with overall health score (0-100) and status
2. Analyzes each health category with key findings and recommendations
3. Identifies trends in vital signs and lab results
4. Highlights risk factors with mitigation strategies
5. Creates prioritized action items

IMPORTANT: This is for patient education only, not medical diagnosis. Always recommend consulting healthcare providers.

Respond in JSON format:
{
  "title": "Report title",
  "executiveSummary": "2-3 paragraph executive summary",
  "overallHealthScore": 0-100,
  "healthStatus": "excellent|good|fair|needs_attention|critical",
  "sections": [
    {
      "title": "Section title",
      "category": "conditions|medications|vitals|labs|immunizations|allergies|lifestyle",
      "content": "Detailed section content",
      "keyFindings": ["finding 1", "finding 2"],
      "recommendations": ["recommendation 1", "recommendation 2"],
      "riskLevel": "low|moderate|high",
      "trendDirection": "improving|stable|declining"
    }
  ],
  "trends": [
    {
      "metric": "metric name",
      "category": "vitals|labs",
      "direction": "improving|stable|declining|fluctuating",
      "significance": "high|medium|low",
      "dataPoints": [{"date": "YYYY-MM-DD", "value": number}],
      "analysis": "Trend interpretation"
    }
  ],
  "riskFactors": [
    {
      "name": "Risk factor name",
      "level": "low|moderate|high|critical",
      "description": "Description of the risk",
      "mitigation": ["mitigation strategy 1", "strategy 2"]
    }
  ],
  "actionItems": [
    {
      "priority": "high|medium|low",
      "category": "medical|lifestyle|preventive|monitoring",
      "action": "Specific action to take",
      "dueDate": "timeframe or specific date",
      "rationale": "Why this action is important"
    }
  ]
}`;

  const userMessage = `Generate a ${request.reportType} health report for ${user?.name || "the patient"}.

Analysis period: Past ${periodMonths} months
Total records: ${records.length}
Recent records in period: ${recentRecords.length}

HEALTH DATA SUMMARY:

CONDITIONS (${conditions.length}):
${JSON.stringify(conditions.slice(0, 20).map(r => ({ title: r.title, summary: r.summary, date: r.date, details: r.details })), null, 2)}

MEDICATIONS (${medications.length}):
${JSON.stringify(medications.slice(0, 20).map(r => ({ title: r.title, summary: r.summary, date: r.date, details: r.details })), null, 2)}

VITALS (${vitals.length} recent):
${JSON.stringify(vitals.slice(0, 30).map(r => ({ title: r.title, summary: r.summary, date: r.date, details: r.details })), null, 2)}

LABS (${labs.length} recent):
${JSON.stringify(labs.slice(0, 30).map(r => ({ title: r.title, summary: r.summary, date: r.date, details: r.details })), null, 2)}

ALLERGIES (${allergies.length}):
${JSON.stringify(allergies.map(r => ({ title: r.title, summary: r.summary })), null, 2)}

IMMUNIZATIONS (${immunizations.length}):
${JSON.stringify(immunizations.slice(0, 15).map(r => ({ title: r.title, date: r.date })), null, 2)}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);
    const generationTime = Date.now() - startTime;

    const savedReport = await storage.createHealthReport({
      userId,
      reportType: request.reportType,
      title: parsed.title || `${request.reportType.replace("_", " ")} Health Report`,
      executiveSummary: parsed.executiveSummary || "Health report generated.",
      overallHealthScore: parsed.overallHealthScore,
      healthStatus: parsed.healthStatus,
      sections: parsed.sections,
      trends: parsed.trends,
      riskFactors: parsed.riskFactors,
      actionItems: parsed.actionItems,
      periodStart: cutoffDate,
      periodEnd: new Date(),
      recordsAnalyzed: recentRecords.length,
      relatedRecordIds: recentRecords.slice(0, 100).map(r => r.id),
      aiModel: AI_MODEL,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      generationTimeMs: generationTime,
    });

    return {
      report: {
        id: savedReport.id,
        title: parsed.title,
        executiveSummary: parsed.executiveSummary,
        overallHealthScore: parsed.overallHealthScore || 0,
        healthStatus: parsed.healthStatus || "fair",
        sections: parsed.sections || [],
        trends: parsed.trends || [],
        riskFactors: parsed.riskFactors || [],
        actionItems: parsed.actionItems || [],
        recordsAnalyzed: recentRecords.length,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Health report generation error:", error);
    throw new Error("Failed to generate health report");
  }
}

// ============================================
// Risk Prediction with Historical Analysis
// ============================================

interface RiskPredictionResult {
  overallRiskLevel: string;
  riskScore: number;
  predictions: Array<{
    condition: string;
    probability: number;
    timeframe: string;
    riskLevel: string;
    contributingFactors: string[];
    preventiveActions: string[];
    monitoringRecommendations: string[];
  }>;
  modifiableRiskFactors: Array<{
    factor: string;
    currentStatus: string;
    targetStatus: string;
    impactReduction: number;
    actionPlan: string[];
  }>;
  screeningRecommendations: Array<{
    screening: string;
    priority: string;
    rationale: string;
    frequency: string;
  }>;
}

export async function predictHealthRisks(userId: string): Promise<RiskPredictionResult> {
  const records = await getRecordsByUser(userId);
  const user = await storage.getUser(userId);
  
  const conditions = records.filter(r => r.type === "condition" || r.fhirResourceType === "Condition");
  const medications = records.filter(r => r.type === "medication");
  const vitals = records.filter(r => r.type === "vital").slice(0, 30);
  const labs = records.filter(r => r.type === "lab" || r.type === "labs").slice(0, 30);
  const allergies = records.filter(r => r.type === "allergy");

  const systemPrompt = `You are an AI health risk prediction specialist. Analyze the patient's health history to predict potential future health risks and provide preventive recommendations.

Based on:
- Current conditions and their trajectories
- Medication history and potential long-term effects
- Vital sign trends
- Lab value patterns
- Known risk factors

Provide:
1. Overall risk assessment with score (0-100)
2. Specific condition risk predictions with probabilities
3. Modifiable risk factors with action plans
4. Recommended health screenings

IMPORTANT: These are educational predictions for awareness, not medical diagnoses. Always recommend consulting healthcare providers.

Respond in JSON format:
{
  "overallRiskLevel": "low|moderate|elevated|high",
  "riskScore": 0-100,
  "predictions": [
    {
      "condition": "Potential health condition",
      "probability": 0-100,
      "timeframe": "1-5 years|5-10 years|10+ years",
      "riskLevel": "low|moderate|high|very_high",
      "contributingFactors": ["factor 1", "factor 2"],
      "preventiveActions": ["action 1", "action 2"],
      "monitoringRecommendations": ["what to monitor", "how often"]
    }
  ],
  "modifiableRiskFactors": [
    {
      "factor": "Risk factor name",
      "currentStatus": "Current state",
      "targetStatus": "Optimal target",
      "impactReduction": percentage reduction if addressed,
      "actionPlan": ["step 1", "step 2"]
    }
  ],
  "screeningRecommendations": [
    {
      "screening": "Screening test name",
      "priority": "routine|recommended|urgent",
      "rationale": "Why this screening is recommended",
      "frequency": "How often"
    }
  ]
}`;

  const userMessage = `Predict health risks for ${user?.name || "the patient"}.

CURRENT CONDITIONS (${conditions.length}):
${JSON.stringify(conditions.slice(0, 15).map(r => ({ title: r.title, summary: r.summary, date: r.date, details: r.details })), null, 2)}

MEDICATIONS (${medications.length}):
${JSON.stringify(medications.slice(0, 15).map(r => ({ title: r.title, summary: r.summary, details: r.details })), null, 2)}

RECENT VITALS (${vitals.length}):
${JSON.stringify(vitals.map(r => ({ title: r.title, date: r.date, details: r.details })), null, 2)}

RECENT LABS (${labs.length}):
${JSON.stringify(labs.map(r => ({ title: r.title, date: r.date, details: r.details })), null, 2)}

ALLERGIES (${allergies.length}):
${JSON.stringify(allergies.map(r => ({ title: r.title, summary: r.summary })), null, 2)}`;

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
      callerService: "ai-analytics-service",
      callerMethod: "analytics"});

    const content = response.content || "{}";
    const parsed = JSON.parse(content);

    for (const prediction of parsed.predictions || []) {
      await storage.createHealthPrediction({
        userId,
        predictionType: "risk",
        category: "conditions",
        title: `Risk: ${prediction.condition}`,
        summary: `${prediction.probability}% probability within ${prediction.timeframe}. Contributing factors: ${prediction.contributingFactors?.join(", ")}`,
        confidence: prediction.probability,
        riskLevel: prediction.riskLevel,
        timeframe: prediction.timeframe,
        dataPoints: [],
        predictedValues: [],
        recommendations: prediction.preventiveActions,
        relatedRecordIds: [],
        aiModel: AI_MODEL,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    }

    return {
      overallRiskLevel: parsed.overallRiskLevel || "moderate",
      riskScore: parsed.riskScore || 50,
      predictions: parsed.predictions || [],
      modifiableRiskFactors: parsed.modifiableRiskFactors || [],
      screeningRecommendations: parsed.screeningRecommendations || [],
    };
  } catch (error) {
    console.error("Risk prediction error:", error);
    throw new Error("Failed to predict health risks");
  }
}

// ============================================
// Analytics Dashboard Summary
// ============================================

interface AnalyticsDashboardResult {
  healthScore: number;
  healthStatus: string;
  recentTrends: Array<{
    metric: string;
    direction: string;
    change: string;
  }>;
  activeRisks: Array<{
    name: string;
    level: string;
  }>;
  anomaliesCount: {
    critical: number;
    warning: number;
    info: number;
  };
  recentPredictions: Array<{
    title: string;
    riskLevel: string;
    confidence: number;
  }>;
  lastReportDate: string | null;
  recordsAnalyzed: number;
  dataQualityScore: number;
}

export async function getAnalyticsDashboard(userId: string): Promise<AnalyticsDashboardResult> {
  const [records, predictions, anomalyStats, latestReport, trendAnalyses] = await Promise.all([
    storage.getHealthRecords(userId),
    storage.getHealthPredictions(userId, 5),
    storage.getAnomalyStats(userId),
    storage.getLatestHealthReport(userId),
    storage.getTrendAnalyses(userId, 5),
  ]);

  const recentTrends = trendAnalyses.map((t: any) => ({
    metric: t.metric,
    direction: t.trendDirection || "stable",
    change: t.changePercentage ? `${t.changePercentage > 0 ? "+" : ""}${t.changePercentage}%` : "N/A",
  }));

  const activeRisks = predictions
    .filter((p: any) => p.riskLevel === "high" || p.riskLevel === "critical")
    .map((p: any) => ({
      name: p.title,
      level: p.riskLevel || "moderate",
    }));

  const recentPredictions = predictions.slice(0, 5).map((p: any) => ({
    title: p.title,
    riskLevel: p.riskLevel || "low",
    confidence: p.confidence || 0,
  }));

  return {
    healthScore: latestReport?.overallHealthScore || 75,
    healthStatus: latestReport?.healthStatus || "good",
    recentTrends,
    activeRisks,
    anomaliesCount: anomalyStats,
    recentPredictions,
    lastReportDate: latestReport?.createdAt?.toISOString() || null,
    recordsAnalyzed: records.length,
    dataQualityScore: Math.max(0, 100 - anomalyStats.critical * 20 - anomalyStats.warning * 5),
  };
}

// Export service functions
export const aiAnalyticsService = {
  processNaturalLanguageQuery,
  generateHealthPredictions,
  detectAnomalies,
  analyzePopulation,
  analyzeTrends,
  generateHealthReport,
  predictHealthRisks,
  getAnalyticsDashboard,
};
