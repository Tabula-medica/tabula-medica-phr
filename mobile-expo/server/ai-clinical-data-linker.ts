import { chatComplete } from "./ai-client";
import type { DataCategory } from "./third-party-data-governance";

// analyzeLinkages includes the patientId in the prompt header, so declare
// "identifiers" alongside the clinical categories to keep the governance
// policy/audit accurate (per third-party-data-governance classification).
const LINKER_DATA_CATEGORIES: DataCategory[] = [
  "identifiers",
  "conditions",
  "lab_results",
  "vitals",
  "medications",
];

const DISCLAIMER = "AI-generated clinical linkage analysis. Must be verified by a licensed healthcare provider. This analysis is for clinical decision support only.";

export interface PatientClinicalData {
  patientId: string;
  conditions: Array<{
    id: string;
    name: string;
    code?: string;
    codeSystem?: string;
    status: string;
    onsetDate?: string;
    severity?: string;
    category?: string;
  }>;
  labResults: Array<{
    id: string;
    name: string;
    value: number | string;
    unit: string;
    referenceRange?: string;
    date: string;
    loincCode?: string;
    flag?: string;
    panel?: string;
    specimen?: string;
  }>;
  vitals: Array<{
    id: string;
    type: string;
    value: number;
    unit: string;
    date: string;
    method?: string;
    position?: string;
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
  }>;
  procedures?: Array<{
    name: string;
    date: string;
    code?: string;
  }>;
}

export interface ClinicalLink {
  sourceType: "lab" | "vital";
  sourceId: string;
  sourceName: string;
  targetConditionId: string;
  targetConditionName: string;
  relationship: "monitoring" | "diagnostic" | "prognostic" | "therapeutic_response" | "complication_indicator" | "risk_factor";
  relevance: "primary" | "secondary" | "tertiary";
  confidence: number;
  clinicalRationale: string;
  expectedDirection?: string;
  isAbnormal?: boolean;
  clinicalSignificance: "critical" | "significant" | "moderate" | "informational";
}

export interface ConditionProfile {
  conditionId: string;
  conditionName: string;
  linkedLabs: Array<{
    labId: string;
    labName: string;
    relationship: string;
    latestValue?: string;
    trend?: string;
    isAbnormal?: boolean;
    clinicalNote: string;
  }>;
  linkedVitals: Array<{
    vitalId: string;
    vitalType: string;
    relationship: string;
    latestValue?: string;
    trend?: string;
    isAbnormal?: boolean;
    clinicalNote: string;
  }>;
  overallAssessment: string;
  monitoringRecommendations: string[];
  missingTests: Array<{
    testName: string;
    reason: string;
    urgency: string;
  }>;
}

export interface LinkageAnalysisResult {
  patientId: string;
  analyzedAt: Date;
  links: ClinicalLink[];
  conditionProfiles: ConditionProfile[];
  unlinkedLabs: Array<{
    labId: string;
    labName: string;
    possibleReasons: string[];
  }>;
  unlinkedVitals: Array<{
    vitalId: string;
    vitalType: string;
    possibleReasons: string[];
  }>;
  clinicalInsights: Array<{
    insight: string;
    category: string;
    priority: string;
    relatedConditions: string[];
    relatedLabs: string[];
  }>;
  trendAnalysis: Array<{
    dataPoint: string;
    trend: "improving" | "stable" | "worsening" | "fluctuating";
    timeframe: string;
    clinicalImplication: string;
    relatedCondition?: string;
  }>;
  gapAnalysis: {
    missingMonitoringLabs: Array<{
      conditionName: string;
      recommendedTests: string[];
      rationale: string;
    }>;
    overdueTests: Array<{
      testName: string;
      lastDate: string;
      recommendedFrequency: string;
      relatedCondition: string;
    }>;
  };
  summary: string;
  disclaimer: string;
}

function buildClinicalDataPrompt(data: PatientClinicalData): string {
  let prompt = `PATIENT ID: ${data.patientId}

CONDITIONS:
${data.conditions.length > 0 ? data.conditions.map(c => `- ${c.name} (ID: ${c.id}, status: ${c.status}${c.code ? `, code: ${c.code}` : ""}${c.codeSystem ? ` [${c.codeSystem}]` : ""}${c.severity ? `, severity: ${c.severity}` : ""}${c.onsetDate ? `, onset: ${c.onsetDate}` : ""}${c.category ? `, category: ${c.category}` : ""})`).join("\n") : "None listed"}

LAB RESULTS:
${data.labResults.length > 0 ? data.labResults.map(l => `- ${l.name} (ID: ${l.id}): ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.loincCode ? ` LOINC: ${l.loincCode}` : ""}${l.flag ? ` [${l.flag}]` : ""}${l.panel ? ` Panel: ${l.panel}` : ""}${l.specimen ? ` Specimen: ${l.specimen}` : ""}`).join("\n") : "None available"}

VITAL SIGNS:
${data.vitals.length > 0 ? data.vitals.map(v => `- ${v.type} (ID: ${v.id}): ${v.value} ${v.unit} (${v.date})${v.method ? ` Method: ${v.method}` : ""}${v.position ? ` Position: ${v.position}` : ""}`).join("\n") : "None available"}`;

  if (data.medications && data.medications.length > 0) {
    prompt += `\n\nMEDICATIONS:\n${data.medications.map(m => `- ${m.name} ${m.dosage}`).join("\n")}`;
  }

  if (data.procedures && data.procedures.length > 0) {
    prompt += `\n\nPROCEDURES:\n${data.procedures.map(p => `- ${p.name} (${p.date})${p.code ? ` Code: ${p.code}` : ""}`).join("\n")}`;
  }

  return prompt;
}

export class AIClinicalDataLinkerService {
  private stats = {
    linkagesPerformed: 0,
    linksCreated: 0,
    insightsGenerated: 0,
    conditionProfilesCreated: 0,
  };

  async analyzeLinkages(data: PatientClinicalData): Promise<LinkageAnalysisResult> {
    console.log(`[DataLinker] Starting comprehensive linkage analysis for patient ${data.patientId}`);

    const systemPrompt = `You are an expert clinical data analyst AI. Analyze the patient's clinical data and create comprehensive linkages between lab results, vital signs, and conditions.

WELL-KNOWN CLINICAL MAPPINGS TO CONSIDER:
- HbA1c/Glucose/Fructosamine → Diabetes Mellitus (LOINC: 4548-4, 2345-7)
- TSH/Free T3/Free T4 → Thyroid Disorders (LOINC: 3016-3, 3053-6, 3024-7)
- Lipid Panel (Total Cholesterol/LDL/HDL/Triglycerides) → Cardiovascular Disease, Dyslipidemia
- CBC (WBC/RBC/Hemoglobin/Hematocrit/Platelets) → Anemia, Infection, Bleeding Disorders
- BMP (Sodium/Potassium/Chloride/CO2/BUN/Creatinine/Glucose) → Kidney Disease, Electrolyte Disorders
- LFTs (ALT/AST/ALP/Bilirubin/Albumin) → Liver Disease, Hepatitis
- BNP/NT-proBNP/Troponin → Heart Failure, Myocardial Infarction
- ESR/CRP → Inflammatory Conditions, Autoimmune Diseases
- PSA → Prostate Cancer/BPH
- INR/PT/PTT → Anticoagulation Therapy, Coagulation Disorders
- Uric Acid → Gout
- Iron/Ferritin/TIBC → Iron Deficiency Anemia
- Vitamin D/Calcium/Phosphorus → Osteoporosis, Metabolic Bone Disease

VITAL SIGN MAPPINGS:
- Blood Pressure → Hypertension, Heart Failure, Kidney Disease
- Heart Rate → Arrhythmia, Heart Failure, Thyroid Disorders, Anxiety
- SpO2 → COPD, Asthma, Pneumonia, Heart Failure
- Temperature → Infection, Inflammation, Thyroid Disorders
- BMI → Obesity, Metabolic Syndrome, Diabetes Risk
- Respiratory Rate → Respiratory Conditions, Heart Failure, Metabolic Acidosis

For each linkage, provide:
- The relationship type (monitoring, diagnostic, prognostic, therapeutic_response, complication_indicator, risk_factor)
- Relevance level (primary, secondary, tertiary)
- Confidence score (0-100)
- Clinical rationale
- Expected direction of the value
- Whether the current value is abnormal
- Clinical significance (critical, significant, moderate, informational)

Also identify:
- Labs/vitals that don't link to any condition (with possible reasons)
- Clinical insights from cross-referencing data
- Trends in the data
- Monitoring gaps (missing tests for conditions)

Respond in JSON format:
{
  "links": [
    {
      "sourceType": "lab|vital",
      "sourceId": "id from input data",
      "sourceName": "name of lab/vital",
      "targetConditionId": "condition id from input data",
      "targetConditionName": "condition name",
      "relationship": "monitoring|diagnostic|prognostic|therapeutic_response|complication_indicator|risk_factor",
      "relevance": "primary|secondary|tertiary",
      "confidence": 85,
      "clinicalRationale": "why this link exists",
      "expectedDirection": "elevated in active disease",
      "isAbnormal": true,
      "clinicalSignificance": "critical|significant|moderate|informational"
    }
  ],
  "unlinkedLabs": [
    { "labId": "id", "labName": "name", "possibleReasons": ["reason1"] }
  ],
  "unlinkedVitals": [
    { "vitalId": "id", "vitalType": "type", "possibleReasons": ["reason1"] }
  ],
  "clinicalInsights": [
    { "insight": "description", "category": "category", "priority": "high|moderate|low", "relatedConditions": ["cond1"], "relatedLabs": ["lab1"] }
  ],
  "trendAnalysis": [
    { "dataPoint": "name", "trend": "improving|stable|worsening|fluctuating", "timeframe": "over past 3 months", "clinicalImplication": "implication", "relatedCondition": "condition name" }
  ],
  "gapAnalysis": {
    "missingMonitoringLabs": [
      { "conditionName": "condition", "recommendedTests": ["test1"], "rationale": "why needed" }
    ],
    "overdueTests": [
      { "testName": "test", "lastDate": "date", "recommendedFrequency": "every 3 months", "relatedCondition": "condition" }
    ]
  },
  "summary": "comprehensive summary paragraph"
}`;

    const userPrompt = `Perform a comprehensive clinical data linkage analysis for the following patient:\n\n${buildClinicalDataPrompt(data)}`;

    const response = await chatComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: LINKER_DATA_CATEGORIES,
      purpose: "clinical_decision_support",
      userId: data.patientId,
      callerService: "ai-clinical-data-linker",
      callerMethod: "analyzeLinkages",
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI");
    }

    const parsed = JSON.parse(content);

    const links: ClinicalLink[] = parsed.links || [];
    const unlinkedLabs = parsed.unlinkedLabs || [];
    const unlinkedVitals = parsed.unlinkedVitals || [];
    const clinicalInsights = parsed.clinicalInsights || [];
    const trendAnalysis = parsed.trendAnalysis || [];
    const gapAnalysis = parsed.gapAnalysis || { missingMonitoringLabs: [], overdueTests: [] };

    const conditionProfiles: ConditionProfile[] = data.conditions.map(condition =>
      this.generateConditionProfile(condition.id, condition.name, links, data.labResults, data.vitals)
    );

    this.stats.linkagesPerformed++;
    this.stats.linksCreated += links.length;
    this.stats.insightsGenerated += clinicalInsights.length;
    this.stats.conditionProfilesCreated += conditionProfiles.length;

    console.log(`[DataLinker] Analysis complete: ${links.length} links, ${conditionProfiles.length} condition profiles, ${clinicalInsights.length} insights`);

    return {
      patientId: data.patientId,
      analyzedAt: new Date(),
      links,
      conditionProfiles,
      unlinkedLabs,
      unlinkedVitals,
      clinicalInsights,
      trendAnalysis,
      gapAnalysis,
      summary: parsed.summary || "",
      disclaimer: DISCLAIMER,
    };
  }

  async linkLabsToConditions(
    labs: PatientClinicalData["labResults"],
    conditions: PatientClinicalData["conditions"]
  ): Promise<ClinicalLink[]> {
    console.log(`[DataLinker] Linking ${labs.length} labs to ${conditions.length} conditions`);

    if (labs.length === 0 || conditions.length === 0) {
      console.log("[DataLinker] No labs or conditions to link");
      return [];
    }

    const labList = labs.map(l => `- ${l.name} (ID: ${l.id}): ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.loincCode ? ` LOINC: ${l.loincCode}` : ""}${l.flag ? ` [${l.flag}]` : ""}${l.panel ? ` Panel: ${l.panel}` : ""}`).join("\n");
    const conditionList = conditions.map(c => `- ${c.name} (ID: ${c.id}, status: ${c.status}${c.code ? `, code: ${c.code}` : ""}${c.severity ? `, severity: ${c.severity}` : ""})`).join("\n");

    const response = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["conditions", "lab_results"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-data-linker",
      callerMethod: "linkLabsToConditions",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical data analyst. Link each lab result to relevant patient conditions.

WELL-KNOWN LAB-CONDITION MAPPINGS:
- HbA1c/Glucose/Fructosamine → Diabetes Mellitus
- TSH/Free T3/Free T4 → Thyroid Disorders (Hypothyroidism, Hyperthyroidism)
- Lipid Panel (Total Cholesterol/LDL/HDL/Triglycerides) → Cardiovascular Disease, Dyslipidemia
- CBC (WBC/RBC/Hemoglobin/Hematocrit/Platelets) → Anemia, Infection, Bleeding Disorders
- BMP (Sodium/Potassium/Chloride/CO2/BUN/Creatinine/Glucose) → Kidney Disease, Electrolyte Disorders
- LFTs (ALT/AST/ALP/Bilirubin/Albumin) → Liver Disease, Hepatitis
- BNP/NT-proBNP → Heart Failure
- Troponin → Myocardial Infarction, Acute Coronary Syndrome
- ESR/CRP → Inflammatory Conditions, Autoimmune Diseases, Infection
- PSA → Prostate Cancer, Benign Prostatic Hyperplasia
- INR/PT/PTT → Anticoagulation Therapy, Coagulation Disorders
- Uric Acid → Gout
- Iron/Ferritin/TIBC → Iron Deficiency Anemia
- Vitamin D/Calcium/Phosphorus → Osteoporosis, Metabolic Bone Disease

Respond in JSON:
{
  "links": [
    {
      "sourceType": "lab",
      "sourceId": "lab id",
      "sourceName": "lab name",
      "targetConditionId": "condition id",
      "targetConditionName": "condition name",
      "relationship": "monitoring|diagnostic|prognostic|therapeutic_response|complication_indicator|risk_factor",
      "relevance": "primary|secondary|tertiary",
      "confidence": 85,
      "clinicalRationale": "rationale",
      "expectedDirection": "direction description",
      "isAbnormal": true,
      "clinicalSignificance": "critical|significant|moderate|informational"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Link these lab results to conditions:\n\nLAB RESULTS:\n${labList}\n\nCONDITIONS:\n${conditionList}`,
        },
      ],
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI for lab-condition linking");
    }

    const parsed = JSON.parse(content);
    const links: ClinicalLink[] = parsed.links || [];

    this.stats.linksCreated += links.length;
    console.log(`[DataLinker] Created ${links.length} lab-condition links`);

    return links;
  }

  async linkVitalsToConditions(
    vitals: PatientClinicalData["vitals"],
    conditions: PatientClinicalData["conditions"]
  ): Promise<ClinicalLink[]> {
    console.log(`[DataLinker] Linking ${vitals.length} vitals to ${conditions.length} conditions`);

    if (vitals.length === 0 || conditions.length === 0) {
      console.log("[DataLinker] No vitals or conditions to link");
      return [];
    }

    const vitalList = vitals.map(v => `- ${v.type} (ID: ${v.id}): ${v.value} ${v.unit} (${v.date})${v.method ? ` Method: ${v.method}` : ""}${v.position ? ` Position: ${v.position}` : ""}`).join("\n");
    const conditionList = conditions.map(c => `- ${c.name} (ID: ${c.id}, status: ${c.status}${c.code ? `, code: ${c.code}` : ""}${c.severity ? `, severity: ${c.severity}` : ""})`).join("\n");

    const response = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["conditions", "vitals"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-data-linker",
      callerMethod: "linkVitalsToConditions",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical data analyst. Link each vital sign measurement to relevant patient conditions.

WELL-KNOWN VITAL-CONDITION MAPPINGS:
- Blood Pressure (Systolic/Diastolic) → Hypertension, Heart Failure, Kidney Disease, Preeclampsia
- Heart Rate → Arrhythmia (Atrial Fibrillation, Tachycardia, Bradycardia), Heart Failure, Thyroid Disorders, Anxiety
- SpO2 (Oxygen Saturation) → COPD, Asthma, Pneumonia, Heart Failure, Sleep Apnea
- Temperature → Infection, Inflammation, Thyroid Disorders
- BMI → Obesity, Metabolic Syndrome, Diabetes Risk
- Respiratory Rate → Respiratory Conditions, Heart Failure, Metabolic Acidosis, Anxiety
- Weight → Heart Failure (fluid retention), Obesity, Malnutrition, Thyroid Disorders

Respond in JSON:
{
  "links": [
    {
      "sourceType": "vital",
      "sourceId": "vital id",
      "sourceName": "vital type",
      "targetConditionId": "condition id",
      "targetConditionName": "condition name",
      "relationship": "monitoring|diagnostic|prognostic|therapeutic_response|complication_indicator|risk_factor",
      "relevance": "primary|secondary|tertiary",
      "confidence": 85,
      "clinicalRationale": "rationale",
      "expectedDirection": "direction description",
      "isAbnormal": true,
      "clinicalSignificance": "critical|significant|moderate|informational"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Link these vital signs to conditions:\n\nVITAL SIGNS:\n${vitalList}\n\nCONDITIONS:\n${conditionList}`,
        },
      ],
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI for vital-condition linking");
    }

    const parsed = JSON.parse(content);
    const links: ClinicalLink[] = parsed.links || [];

    this.stats.linksCreated += links.length;
    console.log(`[DataLinker] Created ${links.length} vital-condition links`);

    return links;
  }

  generateConditionProfile(
    conditionId: string,
    conditionName: string,
    allLinks: ClinicalLink[],
    labs: PatientClinicalData["labResults"],
    vitals: PatientClinicalData["vitals"]
  ): ConditionProfile {
    const conditionLinks = allLinks.filter(l => l.targetConditionId === conditionId);

    const labLinks = conditionLinks.filter(l => l.sourceType === "lab");
    const vitalLinks = conditionLinks.filter(l => l.sourceType === "vital");

    const linkedLabs = labLinks.map(link => {
      const lab = labs.find(l => l.id === link.sourceId);
      return {
        labId: link.sourceId,
        labName: link.sourceName,
        relationship: link.relationship,
        latestValue: lab ? `${lab.value} ${lab.unit}` : undefined,
        trend: undefined,
        isAbnormal: link.isAbnormal,
        clinicalNote: link.clinicalRationale,
      };
    });

    const linkedVitals = vitalLinks.map(link => {
      const vital = vitals.find(v => v.id === link.sourceId);
      return {
        vitalId: link.sourceId,
        vitalType: link.sourceName,
        relationship: link.relationship,
        latestValue: vital ? `${vital.value} ${vital.unit}` : undefined,
        trend: undefined,
        isAbnormal: link.isAbnormal,
        clinicalNote: link.clinicalRationale,
      };
    });

    const hasCritical = conditionLinks.some(l => l.clinicalSignificance === "critical");
    const hasAbnormal = conditionLinks.some(l => l.isAbnormal);
    let overallAssessment = `${conditionName}: `;
    if (hasCritical) {
      overallAssessment += "Critical findings detected requiring immediate attention. ";
    } else if (hasAbnormal) {
      overallAssessment += "Abnormal values detected requiring clinical review. ";
    } else {
      overallAssessment += "Values within expected ranges for current condition status. ";
    }
    overallAssessment += `${linkedLabs.length} lab(s) and ${linkedVitals.length} vital(s) linked.`;

    const monitoringRecommendations: string[] = [];
    if (linkedLabs.length > 0) {
      monitoringRecommendations.push(`Continue monitoring ${linkedLabs.map(l => l.labName).join(", ")} for ${conditionName}`);
    }
    if (hasAbnormal) {
      monitoringRecommendations.push("Follow up on abnormal values with treating physician");
    }

    this.stats.conditionProfilesCreated++;

    return {
      conditionId,
      conditionName,
      linkedLabs,
      linkedVitals,
      overallAssessment,
      monitoringRecommendations,
      missingTests: [],
    };
  }

  async identifyMonitoringGaps(
    conditions: PatientClinicalData["conditions"],
    labs: PatientClinicalData["labResults"]
  ): Promise<LinkageAnalysisResult["gapAnalysis"]> {
    console.log(`[DataLinker] Identifying monitoring gaps for ${conditions.length} conditions`);

    if (conditions.length === 0) {
      return { missingMonitoringLabs: [], overdueTests: [] };
    }

    const conditionList = conditions.map(c => `- ${c.name} (status: ${c.status}${c.severity ? `, severity: ${c.severity}` : ""}${c.onsetDate ? `, onset: ${c.onsetDate}` : ""})`).join("\n");
    const labList = labs.length > 0 ? labs.map(l => `- ${l.name}: ${l.value} ${l.unit} (${l.date})${l.loincCode ? ` LOINC: ${l.loincCode}` : ""}`).join("\n") : "No labs available";

    const response = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["conditions", "lab_results"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-data-linker",
      callerMethod: "identifyMonitoringGaps",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical data analyst. Identify monitoring gaps: tests that should be performed for the patient's conditions but are missing or overdue.

Consider standard monitoring guidelines:
- Diabetes: HbA1c every 3 months, fasting glucose, lipid panel annually, kidney function (eGFR, urine albumin), eye exam annually
- Hypertension: BMP (electrolytes, renal function), lipid panel, urinalysis
- Heart Failure: BNP/NT-proBNP, BMP, CBC, LFTs, iron studies
- Thyroid Disorders: TSH every 6-12 months, Free T4
- COPD/Asthma: Pulmonary function tests, CBC, ABG if severe
- Chronic Kidney Disease: eGFR, urine albumin, BMP, CBC, phosphorus, PTH, vitamin D
- Liver Disease: LFTs, CBC, coagulation studies, albumin
- Cardiovascular Disease: Lipid panel, glucose/HbA1c, CRP
- Autoimmune/Inflammatory: ESR, CRP, CBC, organ-specific markers

Respond in JSON:
{
  "missingMonitoringLabs": [
    { "conditionName": "condition", "recommendedTests": ["test1", "test2"], "rationale": "why these tests are needed" }
  ],
  "overdueTests": [
    { "testName": "test", "lastDate": "date of last test", "recommendedFrequency": "every 3 months", "relatedCondition": "condition" }
  ]
}`,
        },
        {
          role: "user",
          content: `Identify monitoring gaps:\n\nCONDITIONS:\n${conditionList}\n\nEXISTING LAB RESULTS:\n${labList}`,
        },
      ],
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI for monitoring gaps");
    }

    const parsed = JSON.parse(content);

    console.log(`[DataLinker] Found ${parsed.missingMonitoringLabs?.length || 0} missing lab categories, ${parsed.overdueTests?.length || 0} overdue tests`);

    return {
      missingMonitoringLabs: parsed.missingMonitoringLabs || [],
      overdueTests: parsed.overdueTests || [],
    };
  }

  async generateTrendAnalysis(
    labs: PatientClinicalData["labResults"],
    vitals: PatientClinicalData["vitals"],
    conditions: PatientClinicalData["conditions"]
  ): Promise<LinkageAnalysisResult["trendAnalysis"]> {
    console.log(`[DataLinker] Generating trend analysis for ${labs.length} labs and ${vitals.length} vitals`);

    if (labs.length === 0 && vitals.length === 0) {
      return [];
    }

    const labList = labs.map(l => `- ${l.name}: ${l.value} ${l.unit} (${l.date})${l.referenceRange ? ` Ref: ${l.referenceRange}` : ""}${l.flag ? ` [${l.flag}]` : ""}`).join("\n");
    const vitalList = vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})`).join("\n");
    const conditionList = conditions.map(c => `- ${c.name} (${c.status})`).join("\n");

    const response = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["lab_results", "vitals", "conditions"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-data-linker",
      callerMethod: "generateTrendAnalysis",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical data analyst. Analyze trends in the patient's lab results and vital signs. Identify improving, stable, worsening, or fluctuating patterns and their clinical implications.

Respond in JSON:
{
  "trendAnalysis": [
    {
      "dataPoint": "name of lab or vital",
      "trend": "improving|stable|worsening|fluctuating",
      "timeframe": "over the past X months/weeks",
      "clinicalImplication": "what this trend means clinically",
      "relatedCondition": "related condition name if applicable"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Analyze trends in this clinical data:\n\nLAB RESULTS:\n${labList || "None"}\n\nVITAL SIGNS:\n${vitalList || "None"}\n\nCONDITIONS:\n${conditionList || "None"}`,
        },
      ],
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI for trend analysis");
    }

    const parsed = JSON.parse(content);
    const trends = parsed.trendAnalysis || [];

    console.log(`[DataLinker] Generated ${trends.length} trend analyses`);

    return trends;
  }

  async suggestAdditionalTests(
    conditions: PatientClinicalData["conditions"],
    existingLabs: PatientClinicalData["labResults"]
  ): Promise<Array<{ testName: string; loincCode?: string; reason: string; priority: string; relatedCondition: string }>> {
    console.log(`[DataLinker] Suggesting additional tests for ${conditions.length} conditions`);

    if (conditions.length === 0) {
      return [];
    }

    const conditionList = conditions.map(c => `- ${c.name} (status: ${c.status}${c.severity ? `, severity: ${c.severity}` : ""})`).join("\n");
    const existingLabList = existingLabs.length > 0 ? existingLabs.map(l => `- ${l.name}${l.loincCode ? ` (LOINC: ${l.loincCode})` : ""} (${l.date})`).join("\n") : "No existing labs";

    const response = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["conditions", "lab_results"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-data-linker",
      callerMethod: "suggestAdditionalTests",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical data analyst. Based on the patient's conditions and existing lab work, recommend additional tests that should be performed for comprehensive monitoring and management.

Respond in JSON:
{
  "suggestions": [
    {
      "testName": "test name",
      "loincCode": "LOINC code if known",
      "reason": "clinical reason for recommending this test",
      "priority": "urgent|high|moderate|routine",
      "relatedCondition": "which condition this test relates to"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Suggest additional tests:\n\nCONDITIONS:\n${conditionList}\n\nEXISTING LABS:\n${existingLabList}`,
        },
      ],
    });

    const content = response.content;
    if (!content) {
      throw new Error("[DataLinker] No response from AI for test suggestions");
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || [];

    console.log(`[DataLinker] Suggested ${suggestions.length} additional tests`);

    return suggestions;
  }

  getStats(): object {
    return { ...this.stats };
  }
}

export const aiClinicalDataLinker = new AIClinicalDataLinkerService();

export function initializeClinicalDataLinker() {
  console.log("[DataLinker] AI clinical data linker service initialized");
}
