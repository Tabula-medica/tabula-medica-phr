import { generatePhiSafeText } from "./services/ai-gateway";
import { sanitizeNoCDS, sanitizeNoCDSObject, NO_CDS_DISCLAIMER, NO_CDS_DISCLAIMER_SHORT, NO_CDS_POLICY } from "./security/no-cds-guardrails";
import { generateDifferentialDiagnosis, type PatientDataForDiagnosis, type DifferentialDiagnosisResult } from "./differential-diagnosis-service";
import { aiMedicationService, type DrugInteractionAlert } from "./ai-medication-service";

export interface CDSSymptomInput {
  name: string;
  severity: number;
  duration?: string;
  onset?: string;
}

export interface CDSVitalInput {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}

export interface CDSLabInput {
  testName: string;
  value: string;
  unit: string;
  referenceRange?: string;
  status?: "normal" | "abnormal" | "critical";
}

export interface CDSMedicationInput {
  id: string;
  name: string;
  dosage: string;
}

export interface CDSDiagnosisRequest {
  patientId: string;
  symptoms: CDSSymptomInput[];
  vitals?: CDSVitalInput;
  labs?: CDSLabInput[];
  conditions?: { name: string; status: string }[];
  medications?: CDSMedicationInput[];
  demographics?: { age?: number; sex?: string };
}

export interface CDSDiagnosisResponse {
  patientId: string;
  generatedAt: string;
  differentials: {
    condition: string;
    probability: "high" | "medium" | "low";
    supportingEvidence: string[];
    contradictingFactors: string[];
    suggestedWorkup: string[];
  }[];
  clinicalContext: string;
  dataQualityNotes: string[];
  uscdiDataClasses: string[];
  disclaimer: string;
}

export interface CDSDrugInteractionRequest {
  patientId: string;
  medications: CDSMedicationInput[];
  allergies?: string[];
  conditions?: string[];
}

export interface CDSDrugInteractionResponse {
  patientId: string;
  generatedAt: string;
  interactions: DrugInteractionAlert[];
  totalMedicationsAnalyzed: number;
  totalPairsChecked: number;
  severitySummary: {
    contraindicated: number;
    major: number;
    moderate: number;
    minor: number;
  };
  disclaimer: string;
}

export interface CDSDiagnosticTestRequest {
  patientId: string;
  symptoms: CDSSymptomInput[];
  suspectedConditions?: string[];
  existingLabs?: CDSLabInput[];
  vitals?: CDSVitalInput;
  demographics?: { age?: number; sex?: string };
}

export interface DiagnosticTestRecommendation {
  testName: string;
  testCode?: string;
  codeSystem?: string;
  category: "laboratory" | "imaging" | "procedure" | "screening";
  priority: "routine" | "urgent" | "stat";
  rationale: string;
  relatedSymptoms: string[];
  expectedFindings: string;
  estimatedTurnaround: string;
}

export interface CDSDiagnosticTestResponse {
  patientId: string;
  generatedAt: string;
  recommendations: DiagnosticTestRecommendation[];
  clinicalContext: string;
  uscdiDataClasses: string[];
  disclaimer: string;
}

export async function generateDiagnosisSuggestions(
  request: CDSDiagnosisRequest
): Promise<CDSDiagnosisResponse> {
  const patientData: PatientDataForDiagnosis = {
    vitals: request.vitals ? [request.vitals] : [],
    labs: request.labs || [],
    symptoms: request.symptoms.map(s => ({
      symptomName: s.name,
      severity: s.severity,
      duration: s.duration,
      loggedAt: new Date().toISOString(),
    })),
    conditions: request.conditions,
    medications: request.medications?.map(m => ({ name: m.name, dosage: m.dosage })),
    demographics: request.demographics,
  };

  const result: DifferentialDiagnosisResult = await generateDifferentialDiagnosis(
    request.patientId,
    patientData
  );

  const uscdiDataClasses: string[] = [];
  if (request.symptoms.length > 0) uscdiDataClasses.push("Problems/Conditions");
  if (request.vitals) uscdiDataClasses.push("Vital Signs");
  if (request.labs && request.labs.length > 0) uscdiDataClasses.push("Laboratory Results");
  if (request.medications && request.medications.length > 0) uscdiDataClasses.push("Medications");
  if (request.demographics) uscdiDataClasses.push("Patient Demographics");
  if (request.conditions && request.conditions.length > 0) uscdiDataClasses.push("Health Concerns");

  const sanitizedResult = sanitizeNoCDSObject(result);

  return {
    patientId: request.patientId,
    generatedAt: sanitizedResult.generatedAt,
    differentials: sanitizedResult.differentials,
    clinicalContext: sanitizedResult.clinicalContext,
    dataQualityNotes: sanitizedResult.dataQualityNotes,
    uscdiDataClasses,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function checkDrugInteractions(
  request: CDSDrugInteractionRequest
): Promise<CDSDrugInteractionResponse> {
  const medications = request.medications.map(m => ({
    id: m.id,
    name: m.name,
    dosage: m.dosage,
    frequency: "",
    startDate: "",
    prescribedBy: "",
    status: "active" as const,
    refillsRemaining: 0,
    patientId: request.patientId,
    ehrConnectionId: "",
  }));

  const interactions = await aiMedicationService.analyzeDrugInteractions(
    request.patientId,
    medications,
    request.allergies,
    request.conditions
  );

  const severitySummary = {
    contraindicated: interactions.filter(i => i.severity === "contraindicated").length,
    major: interactions.filter(i => i.severity === "major").length,
    moderate: interactions.filter(i => i.severity === "moderate").length,
    minor: interactions.filter(i => i.severity === "minor").length,
  };

  const sanitizedInteractions = interactions.map(interaction => ({
    ...interaction,
    description: sanitizeNoCDS(interaction.description),
    recommendations: interaction.recommendations.map(r => sanitizeNoCDS(r)),
    monitoringRequired: interaction.monitoringRequired.map(m => sanitizeNoCDS(m)),
    clinicalEffects: interaction.clinicalEffects.map(e => sanitizeNoCDS(e)),
    alternativeOptions: interaction.alternativeOptions?.map(a => sanitizeNoCDS(a)),
  }));

  const totalPairs = (request.medications.length * (request.medications.length - 1)) / 2;

  return {
    patientId: request.patientId,
    generatedAt: new Date().toISOString(),
    interactions: sanitizedInteractions,
    totalMedicationsAnalyzed: request.medications.length,
    totalPairsChecked: totalPairs,
    severitySummary,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function generateDiagnosticTestRecommendations(
  request: CDSDiagnosticTestRequest
): Promise<CDSDiagnosticTestResponse> {
  const symptomsText = request.symptoms
    .map(s => `${s.name} (severity: ${s.severity}/10${s.duration ? `, duration: ${s.duration}` : ""})`)
    .join("; ");

  const existingLabsText = request.existingLabs
    ?.map(l => `${l.testName}: ${l.value} ${l.unit} (${l.status || "unknown"})`)
    .join("; ") || "None available";

  const vitalsText = request.vitals
    ? [
        request.vitals.bloodPressure && `BP: ${request.vitals.bloodPressure}`,
        request.vitals.heartRate && `HR: ${request.vitals.heartRate}`,
        request.vitals.temperature && `Temp: ${request.vitals.temperature}`,
        request.vitals.respiratoryRate && `RR: ${request.vitals.respiratoryRate}`,
        request.vitals.oxygenSaturation && `SpO2: ${request.vitals.oxygenSaturation}%`,
      ].filter(Boolean).join(", ")
    : "Not available";

  const demographicsText = request.demographics
    ? `Age: ${request.demographics.age || "unknown"}, Sex: ${request.demographics.sex || "unknown"}`
    : "Not specified";

  try {
    const content = (await generatePhiSafeText({
      system: `You are a medical informatics system that identifies relevant diagnostic tests based on documented patient data. You provide INFORMATIONAL context only — never clinical advice.

STRICT RULES:
- Use observational language: "data shows", "records indicate", "patterns noted"
- Never use: "should", "must", "recommend", "prescribe", "diagnose"
- All output is for qualified healthcare provider review only
- Include LOINC codes where applicable
- Categorize tests as: laboratory, imaging, procedure, or screening
- Prioritize as: routine, urgent, or stat based on data patterns

Respond ONLY with valid JSON array.`,
      user: `Based on the following documented patient data, identify relevant diagnostic tests for provider review:

Patient Demographics: ${demographicsText}
Documented Symptoms: ${symptomsText}
Suspected Conditions: ${request.suspectedConditions?.join(", ") || "None specified"}
Existing Lab Results: ${existingLabsText}
Current Vitals: ${vitalsText}

Provide a JSON array of test objects:
[{
  "testName": string,
  "testCode": string (LOINC code if applicable),
  "codeSystem": "LOINC" | "CPT" | "SNOMED",
  "category": "laboratory" | "imaging" | "procedure" | "screening",
  "priority": "routine" | "urgent" | "stat",
  "rationale": string (observational language only),
  "relatedSymptoms": string[],
  "expectedFindings": string,
  "estimatedTurnaround": string
}]

Return 3-8 relevant tests.`,
      maxTokens: 2000,
      responseMimeType: "application/json",
    })) || "{}";
    const parsed = JSON.parse(content);
    const tests: DiagnosticTestRecommendation[] = Array.isArray(parsed) ? parsed : (parsed.tests || parsed.recommendations || []);

    const validTests = tests.length > 0 ? tests : getDefaultTestRecommendations(request);

    const sanitizedTests = validTests.map(t => ({
      testName: sanitizeNoCDS(t.testName || ""),
      testCode: t.testCode,
      codeSystem: t.codeSystem,
      category: t.category || "laboratory",
      priority: t.priority || "routine",
      rationale: sanitizeNoCDS(t.rationale || ""),
      relatedSymptoms: (t.relatedSymptoms || []).map((s: string) => sanitizeNoCDS(s)),
      expectedFindings: sanitizeNoCDS(t.expectedFindings || ""),
      estimatedTurnaround: t.estimatedTurnaround || "Varies",
    })) as DiagnosticTestRecommendation[];

    const uscdiDataClasses: string[] = ["Diagnostic Imaging", "Laboratory Results"];
    if (request.symptoms.length > 0) uscdiDataClasses.push("Problems/Conditions");
    if (request.vitals) uscdiDataClasses.push("Vital Signs");
    if (request.demographics) uscdiDataClasses.push("Patient Demographics");

    return {
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      recommendations: sanitizedTests,
      clinicalContext: sanitizeNoCDS(
        `Analysis based on ${request.symptoms.length} documented symptom(s), ` +
        `${request.existingLabs?.length || 0} existing lab result(s), ` +
        `and ${request.suspectedConditions?.length || 0} noted condition(s). ` +
        `Data patterns reviewed for provider consideration.`
      ),
      uscdiDataClasses,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[CDS] Error generating diagnostic test analysis:", error);

    return {
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      recommendations: getDefaultTestRecommendations(request),
      clinicalContext: "AI analysis unavailable. Showing standard test patterns based on documented symptoms.",
      uscdiDataClasses: ["Laboratory Results", "Diagnostic Imaging"],
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

function getDefaultTestRecommendations(request: CDSDiagnosticTestRequest): DiagnosticTestRecommendation[] {
  const tests: DiagnosticTestRecommendation[] = [];

  tests.push({
    testName: "Complete Blood Count (CBC) with Differential",
    testCode: "57021-8",
    codeSystem: "LOINC",
    category: "laboratory",
    priority: "routine",
    rationale: "Baseline hematologic assessment — standard panel for symptom evaluation.",
    relatedSymptoms: request.symptoms.map(s => s.name),
    expectedFindings: "WBC, RBC, hemoglobin, hematocrit, platelet count, differential",
    estimatedTurnaround: "Same day",
  });

  tests.push({
    testName: "Comprehensive Metabolic Panel (CMP)",
    testCode: "24323-8",
    codeSystem: "LOINC",
    category: "laboratory",
    priority: "routine",
    rationale: "Metabolic and organ function baseline — data shows value in comprehensive evaluation.",
    relatedSymptoms: request.symptoms.map(s => s.name),
    expectedFindings: "Glucose, electrolytes, kidney function, liver function",
    estimatedTurnaround: "Same day",
  });

  if (request.symptoms.some(s => s.name.toLowerCase().includes("chest") || s.name.toLowerCase().includes("heart"))) {
    tests.push({
      testName: "12-Lead Electrocardiogram (ECG)",
      testCode: "11524-6",
      codeSystem: "LOINC",
      category: "procedure",
      priority: "urgent",
      rationale: "Cardiac symptom pattern noted in records — ECG data relevant for provider review.",
      relatedSymptoms: request.symptoms.filter(s => s.name.toLowerCase().includes("chest") || s.name.toLowerCase().includes("heart")).map(s => s.name),
      expectedFindings: "Cardiac rhythm, intervals, ST-segment, and wave morphology",
      estimatedTurnaround: "Immediate",
    });
  }

  if (request.symptoms.some(s => s.name.toLowerCase().includes("fatigue") || s.name.toLowerCase().includes("tired"))) {
    tests.push({
      testName: "Thyroid Stimulating Hormone (TSH)",
      testCode: "3016-3",
      codeSystem: "LOINC",
      category: "laboratory",
      priority: "routine",
      rationale: "Fatigue pattern documented — thyroid function data relevant for evaluation.",
      relatedSymptoms: ["Fatigue"],
      expectedFindings: "TSH level indicating thyroid function status",
      estimatedTurnaround: "1-2 days",
    });
  }

  return tests;
}

export interface CDSRiskStratificationRequest {
  patientId: string;
  demographics?: { age?: number; sex?: string };
  vitals?: CDSVitalInput;
  labs?: CDSLabInput[];
  conditions?: string[];
  medications?: CDSMedicationInput[];
  familyHistory?: string[];
  socialFactors?: string[];
}

export interface RiskFactor {
  factor: string;
  impact: "high" | "moderate" | "low";
  source: string;
}

export interface ConditionRisk {
  condition: string;
  riskLevel: "high" | "moderate" | "low";
  riskScore: number;
  drivers: RiskFactor[];
  dataGaps: string[];
  observationalNotes: string;
}

export interface CDSRiskStratificationResponse {
  patientId: string;
  generatedAt: string;
  overallRiskTier: "high" | "moderate" | "low";
  conditionRisks: ConditionRisk[];
  dataCompleteness: number;
  uscdiDataClasses: string[];
  disclaimer: string;
}

export async function generateRiskStratification(
  request: CDSRiskStratificationRequest
): Promise<CDSRiskStratificationResponse> {
  const demographicsText = request.demographics
    ? `Age: ${request.demographics.age || "unknown"}, Sex: ${request.demographics.sex || "unknown"}`
    : "Not specified";

  const vitalsText = request.vitals
    ? [
        request.vitals.bloodPressure && `BP: ${request.vitals.bloodPressure}`,
        request.vitals.heartRate && `HR: ${request.vitals.heartRate}`,
        request.vitals.temperature && `Temp: ${request.vitals.temperature}`,
        request.vitals.respiratoryRate && `RR: ${request.vitals.respiratoryRate}`,
        request.vitals.oxygenSaturation && `SpO2: ${request.vitals.oxygenSaturation}%`,
      ].filter(Boolean).join(", ")
    : "Not available";

  const labsText = request.labs?.map(l => `${l.testName}: ${l.value} ${l.unit} (${l.status || "unknown"})`).join("; ") || "None";
  const conditionsText = request.conditions?.join(", ") || "None documented";
  const medsText = request.medications?.map(m => `${m.name} ${m.dosage}`).join(", ") || "None";
  const familyText = request.familyHistory?.join(", ") || "None documented";
  const socialText = request.socialFactors?.join(", ") || "None documented";

  try {
    const content = (await generatePhiSafeText({
      system: `You are a medical informatics system that analyzes documented patient data to identify statistical risk patterns. You provide INFORMATIONAL analysis only — never clinical advice.

${NO_CDS_POLICY}

Respond ONLY with valid JSON.`,
      user: `Analyze the following documented patient data for statistical risk patterns across common conditions. This is for provider informational review only.

Patient Demographics: ${demographicsText}
Current Vitals: ${vitalsText}
Lab Results: ${labsText}
Documented Conditions: ${conditionsText}
Current Medications: ${medsText}
Family History: ${familyText}
Social Factors: ${socialText}

Provide a JSON object:
{
  "conditionRisks": [{
    "condition": string (e.g., "Type 2 Diabetes", "Cardiovascular Disease"),
    "riskLevel": "high" | "moderate" | "low",
    "riskScore": number (0-100),
    "drivers": [{ "factor": string, "impact": "high" | "moderate" | "low", "source": string }],
    "dataGaps": string[],
    "observationalNotes": string (observational language only)
  }],
  "dataCompleteness": number (0-100, based on available data fields)
}

Identify 3-6 relevant conditions. Use only observational language.`,
      maxTokens: 2500,
      responseMimeType: "application/json",
    })) || "{}";
    const parsed = JSON.parse(content);
    const conditionRisks: ConditionRisk[] = parsed.conditionRisks || [];

    const validRisks = conditionRisks.length > 0 ? conditionRisks : getDefaultRiskStratification(request);

    const sanitizedRisks = validRisks.map(r => ({
      condition: sanitizeNoCDS(r.condition || ""),
      riskLevel: r.riskLevel || "low",
      riskScore: Math.min(100, Math.max(0, r.riskScore || 0)),
      drivers: (r.drivers || []).map((d: RiskFactor) => ({
        factor: sanitizeNoCDS(d.factor || ""),
        impact: d.impact || "low",
        source: sanitizeNoCDS(d.source || "documented data"),
      })),
      dataGaps: (r.dataGaps || []).map((g: string) => sanitizeNoCDS(g)),
      observationalNotes: sanitizeNoCDS(r.observationalNotes || ""),
    })) as ConditionRisk[];

    const highRiskCount = sanitizedRisks.filter(r => r.riskLevel === "high").length;
    const overallRiskTier = highRiskCount >= 2 ? "high" : highRiskCount === 1 ? "moderate" : "low";

    const uscdiDataClasses: string[] = ["Patient Demographics"];
    if (request.vitals) uscdiDataClasses.push("Vital Signs");
    if (request.labs && request.labs.length > 0) uscdiDataClasses.push("Laboratory Results");
    if (request.conditions && request.conditions.length > 0) uscdiDataClasses.push("Problems/Conditions");
    if (request.medications && request.medications.length > 0) uscdiDataClasses.push("Medications");
    if (request.familyHistory && request.familyHistory.length > 0) uscdiDataClasses.push("Family Health History");

    return {
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      overallRiskTier,
      conditionRisks: sanitizedRisks,
      dataCompleteness: parsed.dataCompleteness || 45,
      uscdiDataClasses,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[CDS] Error generating risk stratification:", error);
    return {
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      overallRiskTier: "low",
      conditionRisks: getDefaultRiskStratification(request),
      dataCompleteness: 40,
      uscdiDataClasses: ["Patient Demographics"],
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

function getDefaultRiskStratification(request: CDSRiskStratificationRequest): ConditionRisk[] {
  const risks: ConditionRisk[] = [];
  const age = request.demographics?.age || 50;
  const sex = request.demographics?.sex?.toLowerCase() || "unknown";

  risks.push({
    condition: "Cardiovascular Disease",
    riskLevel: age >= 55 ? "moderate" : "low",
    riskScore: age >= 65 ? 62 : age >= 55 ? 45 : 22,
    drivers: [
      { factor: `Age ${age} — statistical baseline factor`, impact: age >= 55 ? "moderate" : "low", source: "Demographics" },
      ...(request.vitals?.bloodPressure ? [{ factor: `Blood pressure documented: ${request.vitals.bloodPressure}`, impact: "moderate" as const, source: "Vital Signs" }] : []),
    ],
    dataGaps: ["Lipid panel history", "Family cardiac history"],
    observationalNotes: "Cardiovascular risk patterns evaluated based on available documented data.",
  });

  if (age >= 45) {
    risks.push({
      condition: "Type 2 Diabetes",
      riskLevel: age >= 60 ? "moderate" : "low",
      riskScore: age >= 60 ? 48 : 28,
      drivers: [
        { factor: `Age ${age} — statistically associated demographic factor`, impact: age >= 60 ? "moderate" : "low", source: "Demographics" },
      ],
      dataGaps: ["HbA1c history", "Fasting glucose trends", "BMI data"],
      observationalNotes: "Diabetes risk markers evaluated based on documented demographic and lab data.",
    });
  }

  if (sex === "female" && age >= 40) {
    risks.push({
      condition: "Breast Cancer",
      riskLevel: age >= 50 ? "moderate" : "low",
      riskScore: age >= 50 ? 35 : 18,
      drivers: [
        { factor: `Female, age ${age} — demographic risk baseline`, impact: "moderate", source: "Demographics" },
      ],
      dataGaps: ["Mammography history", "Family history of breast cancer", "Genetic testing"],
      observationalNotes: "Breast cancer risk patterns noted based on demographic factors. Screening history data not available.",
    });
  }

  if (age >= 45) {
    risks.push({
      condition: "Chronic Kidney Disease",
      riskLevel: "low",
      riskScore: age >= 65 ? 32 : 15,
      drivers: [
        { factor: `Age ${age} — baseline demographic consideration`, impact: "low", source: "Demographics" },
      ],
      dataGaps: ["eGFR trends", "Creatinine history", "Urine albumin data"],
      observationalNotes: "Kidney function risk baseline established. Additional lab data may improve pattern analysis.",
    });
  }

  risks.push({
    condition: "Respiratory Disease (COPD/Asthma)",
    riskLevel: "low",
    riskScore: 12,
    drivers: [
      { factor: "Baseline respiratory risk assessment", impact: "low", source: "Standard screening" },
    ],
    dataGaps: ["Smoking history", "Pulmonary function tests", "Environmental exposure data"],
    observationalNotes: "Respiratory risk evaluated at baseline. Smoking status and environmental data may refine analysis.",
  });

  return risks;
}

export interface CDSPreventiveAlertsRequest {
  patientId: string;
  demographics?: { age?: number; sex?: string };
  immunizationHistory?: { vaccineName: string; dateGiven: string; doseNumber?: number }[];
  screeningHistory?: { screeningName: string; datePerformed: string; result?: string }[];
  conditions?: string[];
}

export interface ScreeningAlert {
  screeningName: string;
  category: "cancer" | "cardiovascular" | "metabolic" | "infectious" | "other";
  status: "overdue" | "due_soon" | "up_to_date";
  guidelineSource: string;
  lastPerformed: string | null;
  dueDate: string;
  intervalMonths: number;
  rationale: string;
  ageRange: string;
  applicableSex: string;
}

export interface VaccinationAlert {
  vaccineName: string;
  status: "overdue" | "due_soon" | "up_to_date" | "not_applicable";
  lastDoseDate: string | null;
  dosesCompleted: number;
  dosesRequired: number;
  dueDate: string;
  guidelineSource: string;
  rationale: string;
}

export interface CDSPreventiveAlertsResponse {
  patientId: string;
  generatedAt: string;
  screeningAlerts: ScreeningAlert[];
  vaccinationAlerts: VaccinationAlert[];
  overdueCount: number;
  dueSoonCount: number;
  upToDateCount: number;
  uscdiDataClasses: string[];
  disclaimer: string;
}

export async function generatePreventiveAlerts(
  request: CDSPreventiveAlertsRequest
): Promise<CDSPreventiveAlertsResponse> {
  const screeningAlerts = generateScreeningAlerts(request);
  const vaccinationAlerts = generateVaccinationAlerts(request);

  const allStatuses = [
    ...screeningAlerts.map(a => a.status),
    ...vaccinationAlerts.map(a => a.status),
  ];
  const overdueCount = allStatuses.filter(s => s === "overdue").length;
  const dueSoonCount = allStatuses.filter(s => s === "due_soon").length;
  const upToDateCount = allStatuses.filter(s => s === "up_to_date").length;

  const uscdiDataClasses = ["Patient Demographics", "Immunizations", "Procedures"];
  if (request.conditions && request.conditions.length > 0) uscdiDataClasses.push("Problems/Conditions");

  return {
    patientId: request.patientId,
    generatedAt: new Date().toISOString(),
    screeningAlerts,
    vaccinationAlerts,
    overdueCount,
    dueSoonCount,
    upToDateCount,
    uscdiDataClasses,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function generateScreeningAlerts(request: CDSPreventiveAlertsRequest): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = [];
  const age = request.demographics?.age || 50;
  const sex = request.demographics?.sex?.toLowerCase() || "unknown";
  const screeningMap = new Map(
    (request.screeningHistory || []).map(s => [s.screeningName.toLowerCase(), s])
  );
  const now = new Date();

  function addScreeningAlert(
    name: string, category: ScreeningAlert["category"], guideline: string,
    intervalMonths: number, ageMin: number, ageMax: number, applySex: string, rationale: string
  ) {
    if (age < ageMin || age > ageMax) return;
    if (applySex !== "all" && sex !== "unknown" && sex !== applySex) return;

    const history = screeningMap.get(name.toLowerCase());
    const lastDate = history?.datePerformed || null;
    let status: ScreeningAlert["status"] = "overdue";
    let dueDate = now.toISOString().split("T")[0];

    if (lastDate) {
      const lastPerformed = new Date(lastDate);
      const nextDue = new Date(lastPerformed);
      nextDue.setMonth(nextDue.getMonth() + intervalMonths);
      dueDate = nextDue.toISOString().split("T")[0];

      if (nextDue > now) {
        const monthsUntil = (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
        status = monthsUntil <= 3 ? "due_soon" : "up_to_date";
      }
    }

    alerts.push({
      screeningName: name,
      category,
      status,
      guidelineSource: guideline,
      lastPerformed: lastDate,
      dueDate,
      intervalMonths,
      rationale: sanitizeNoCDS(rationale),
      ageRange: `${ageMin}-${ageMax}`,
      applicableSex: applySex,
    });
  }

  addScreeningAlert(
    "Mammogram", "cancer", "USPSTF Grade B (2024)",
    24, 40, 74, "female",
    "Breast cancer screening data indicates biennial mammography pattern for females ages 40-74."
  );

  addScreeningAlert(
    "Colonoscopy", "cancer", "USPSTF Grade A (2021)",
    120, 45, 75, "all",
    "Colorectal cancer screening records indicate 10-year colonoscopy interval for ages 45-75."
  );

  addScreeningAlert(
    "Cervical Cancer Screening (Pap/HPV)", "cancer", "USPSTF Grade A (2018)",
    36, 21, 65, "female",
    "Cervical cancer screening guidelines note triennial Pap test pattern for females ages 21-65."
  );

  addScreeningAlert(
    "Lipid Panel", "cardiovascular", "USPSTF Grade B (2023)",
    60, 40, 75, "all",
    "Cardiovascular risk screening data indicates lipid panel assessment for adults 40-75."
  );

  addScreeningAlert(
    "Blood Pressure Screening", "cardiovascular", "USPSTF Grade A (2021)",
    12, 18, 100, "all",
    "Hypertension screening records indicate annual blood pressure assessment for adults 18+."
  );

  addScreeningAlert(
    "HbA1c / Diabetes Screening", "metabolic", "USPSTF Grade B (2021)",
    36, 35, 70, "all",
    "Prediabetes and diabetes screening data indicates triennial testing for adults 35-70."
  );

  addScreeningAlert(
    "Lung Cancer Screening (LDCT)", "cancer", "USPSTF Grade B (2021)",
    12, 50, 80, "all",
    "Lung cancer screening data relevant for adults 50-80 with significant smoking history."
  );

  addScreeningAlert(
    "Bone Density (DEXA Scan)", "other", "USPSTF Grade B (2018)",
    24, 65, 100, "female",
    "Osteoporosis screening data indicates bone density assessment for females 65+."
  );

  addScreeningAlert(
    "Prostate Cancer Discussion (PSA)", "cancer", "USPSTF Grade C (2018)",
    12, 55, 69, "male",
    "Prostate cancer screening data indicates PSA discussion pattern for males 55-69."
  );

  addScreeningAlert(
    "Abdominal Aortic Aneurysm Screening", "cardiovascular", "USPSTF Grade B (2019)",
    0, 65, 75, "male",
    "One-time AAA ultrasound screening data relevant for males 65-75 with smoking history."
  );

  return alerts;
}

function generateVaccinationAlerts(request: CDSPreventiveAlertsRequest): VaccinationAlert[] {
  const alerts: VaccinationAlert[] = [];
  const age = request.demographics?.age || 50;
  const immunizationMap = new Map<string, { dateGiven: string; doseNumber?: number }>();
  (request.immunizationHistory || []).forEach(i => {
    const existing = immunizationMap.get(i.vaccineName.toLowerCase());
    if (!existing || new Date(i.dateGiven) > new Date(existing.dateGiven)) {
      immunizationMap.set(i.vaccineName.toLowerCase(), i);
    }
  });
  const now = new Date();

  function addVaccineAlert(
    name: string, guideline: string, dosesRequired: number,
    intervalMonths: number, ageMin: number, ageMax: number, rationale: string
  ) {
    if (age < ageMin || age > ageMax) return;

    const history = immunizationMap.get(name.toLowerCase());
    const lastDate = history?.dateGiven || null;
    const dosesCompleted = history?.doseNumber || (lastDate ? 1 : 0);
    let status: VaccinationAlert["status"] = "overdue";
    let dueDate = now.toISOString().split("T")[0];

    if (lastDate && dosesCompleted >= dosesRequired && intervalMonths === 0) {
      status = "up_to_date";
      dueDate = "Complete";
    } else if (lastDate) {
      const lastGiven = new Date(lastDate);
      const nextDue = new Date(lastGiven);
      nextDue.setMonth(nextDue.getMonth() + intervalMonths);
      dueDate = nextDue.toISOString().split("T")[0];

      if (nextDue > now) {
        const monthsUntil = (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
        status = monthsUntil <= 2 ? "due_soon" : "up_to_date";
      }
    }

    alerts.push({
      vaccineName: name,
      status,
      lastDoseDate: lastDate,
      dosesCompleted,
      dosesRequired,
      dueDate,
      guidelineSource: sanitizeNoCDS(guideline),
      rationale: sanitizeNoCDS(rationale),
    });
  }

  addVaccineAlert(
    "Influenza (Flu)", "CDC/ACIP Annual Recommendation", 1, 12, 6, 100,
    "Annual influenza vaccination records indicate seasonal pattern for all adults."
  );

  addVaccineAlert(
    "COVID-19 (Updated 2025-2026)", "CDC/ACIP (2025)", 1, 12, 6, 100,
    "Updated COVID-19 vaccination data indicates annual booster pattern for adults."
  );

  addVaccineAlert(
    "Tdap/Td (Tetanus, Diphtheria, Pertussis)", "CDC/ACIP", 1, 120, 19, 100,
    "Tetanus/diphtheria/pertussis booster records indicate 10-year interval for adults."
  );

  addVaccineAlert(
    "Shingles (Recombinant Zoster - Shingrix)", "CDC/ACIP", 2, 0, 50, 100,
    "Shingles vaccination data indicates 2-dose series pattern for adults 50+."
  );

  addVaccineAlert(
    "Pneumococcal (PCV20 or PCV15+PPSV23)", "CDC/ACIP (2024)", 1, 0, 65, 100,
    "Pneumococcal vaccination records indicate series completion for adults 65+."
  );

  if (age >= 19 && age <= 26) {
    addVaccineAlert(
      "HPV (Human Papillomavirus)", "CDC/ACIP", 3, 0, 19, 26,
      "HPV vaccination data indicates 3-dose series for adults 19-26 if not previously completed."
    );
  }

  addVaccineAlert(
    "Hepatitis B", "CDC/ACIP (2022)", 3, 0, 19, 59,
    "Hepatitis B vaccination records indicate 3-dose series for adults 19-59."
  );

  return alerts;
}

export interface CDSOverviewRequest {
  patientId: string;
  demographics?: { age?: number; sex?: string };
  conditions?: string[];
  familyHistory?: string[];
}

export interface CDSOverviewResponse {
  patientId: string;
  generatedAt: string;
  riskSummary: {
    overallRiskTier: "high" | "moderate" | "low";
    dataCompleteness: number;
    topRisks: {
      condition: string;
      riskLevel: "high" | "moderate" | "low";
      riskScore: number;
      topDriver: string;
    }[];
  };
  overdueSummary: {
    overdueCount: number;
    dueSoonCount: number;
    upToDateCount: number;
    overdueScreenings: { name: string; category: string; guidelineSource: string; dueDate: string }[];
    overdueVaccinations: { name: string; guidelineSource: string; dosesCompleted: number; dosesRequired: number; dueDate: string }[];
    dueSoonScreenings: { name: string; category: string; dueDate: string }[];
    dueSoonVaccinations: { name: string; dueDate: string }[];
  };
  categorySummary: {
    category: string;
    icon: string;
    status: "action_needed" | "review" | "clear";
    count: number;
    description: string;
  }[];
  disclaimer: string;
}

export async function generateCDSOverview(request: CDSOverviewRequest): Promise<CDSOverviewResponse> {
  const riskRequest: CDSRiskStratificationRequest = {
    patientId: request.patientId,
    demographics: request.demographics,
    conditions: request.conditions,
    familyHistory: request.familyHistory,
  };

  const preventiveRequest: CDSPreventiveAlertsRequest = {
    patientId: request.patientId,
    demographics: request.demographics,
    conditions: request.conditions,
  };

  const [riskResult, preventiveResult] = await Promise.all([
    generateRiskStratification(riskRequest),
    generatePreventiveAlerts(preventiveRequest),
  ]);

  const topRisks = riskResult.conditionRisks
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)
    .map(r => ({
      condition: r.condition,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      topDriver: r.drivers[0]?.factor || "Demographics baseline",
    }));

  const overdueScreenings = preventiveResult.screeningAlerts
    .filter(a => a.status === "overdue")
    .map(a => ({ name: a.screeningName, category: a.category, guidelineSource: a.guidelineSource, dueDate: a.dueDate }));

  const overdueVaccinations = preventiveResult.vaccinationAlerts
    .filter(a => a.status === "overdue")
    .map(a => ({ name: a.vaccineName, guidelineSource: a.guidelineSource, dosesCompleted: a.dosesCompleted, dosesRequired: a.dosesRequired, dueDate: a.dueDate }));

  const dueSoonScreenings = preventiveResult.screeningAlerts
    .filter(a => a.status === "due_soon")
    .map(a => ({ name: a.screeningName, category: a.category, dueDate: a.dueDate }));

  const dueSoonVaccinations = preventiveResult.vaccinationAlerts
    .filter(a => a.status === "due_soon")
    .map(a => ({ name: a.vaccineName, dueDate: a.dueDate }));

  const highRiskCount = topRisks.filter(r => r.riskLevel === "high").length;
  const totalOverdue = preventiveResult.overdueCount;

  const categorySummary = [
    {
      category: "Risk Stratification",
      icon: "bar-chart",
      status: (highRiskCount > 0 ? "action_needed" : riskResult.overallRiskTier === "moderate" ? "review" : "clear") as CDSOverviewResponse["categorySummary"][0]["status"],
      count: topRisks.length,
      description: `${highRiskCount} high-risk condition${highRiskCount !== 1 ? "s" : ""} identified`,
    },
    {
      category: "Overdue Screenings",
      icon: "file-text",
      status: (overdueScreenings.length > 0 ? "action_needed" : dueSoonScreenings.length > 0 ? "review" : "clear") as CDSOverviewResponse["categorySummary"][0]["status"],
      count: overdueScreenings.length,
      description: `${overdueScreenings.length} screening${overdueScreenings.length !== 1 ? "s" : ""} overdue`,
    },
    {
      category: "Overdue Vaccinations",
      icon: "syringe",
      status: (overdueVaccinations.length > 0 ? "action_needed" : dueSoonVaccinations.length > 0 ? "review" : "clear") as CDSOverviewResponse["categorySummary"][0]["status"],
      count: overdueVaccinations.length,
      description: `${overdueVaccinations.length} vaccination${overdueVaccinations.length !== 1 ? "s" : ""} overdue`,
    },
    {
      category: "Preventive Care",
      icon: "shield",
      status: (totalOverdue > 0 ? "action_needed" : preventiveResult.dueSoonCount > 0 ? "review" : "clear") as CDSOverviewResponse["categorySummary"][0]["status"],
      count: preventiveResult.upToDateCount,
      description: `${preventiveResult.upToDateCount} item${preventiveResult.upToDateCount !== 1 ? "s" : ""} up to date`,
    },
  ];

  return {
    patientId: request.patientId,
    generatedAt: new Date().toISOString(),
    riskSummary: {
      overallRiskTier: riskResult.overallRiskTier as "high" | "moderate" | "low",
      dataCompleteness: riskResult.dataCompleteness,
      topRisks,
    },
    overdueSummary: {
      overdueCount: preventiveResult.overdueCount,
      dueSoonCount: preventiveResult.dueSoonCount,
      upToDateCount: preventiveResult.upToDateCount,
      overdueScreenings,
      overdueVaccinations,
      dueSoonScreenings,
      dueSoonVaccinations,
    },
    categorySummary,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

