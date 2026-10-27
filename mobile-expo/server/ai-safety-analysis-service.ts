import { chatComplete } from "./ai-client";

const DISCLAIMER = "AI-generated safety analysis. Must be verified by a licensed pharmacist or healthcare provider. This analysis is for clinical decision support only and does not replace professional judgment.";

export interface PatientSafetyProfile {
  patientId: string;
  demographics: {
    age: number;
    gender: string;
    weight?: number;
    height?: number;
    ethnicity?: string;
  };
  conditions: Array<{
    name: string;
    code?: string;
    status: string;
    onsetDate?: string;
    severity?: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    route?: string;
    rxnormCode?: string;
    startDate?: string;
    prescriber?: string;
  }>;
  allergies: Array<{
    substance: string;
    reaction?: string;
    severity?: string;
    code?: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
    trend?: string;
  }>;
  labResults: Array<{
    name: string;
    value: number | string;
    unit: string;
    referenceRange?: string;
    date: string;
    loincCode?: string;
    flag?: string;
  }>;
  genomicMarkers?: Array<{
    gene: string;
    variant: string;
    phenotype?: string;
    clinicalSignificance?: string;
  }>;
  renalFunction?: {
    gfr?: number;
    creatinine?: number;
    bun?: number;
  };
  hepaticFunction?: {
    alt?: number;
    ast?: number;
    bilirubin?: number;
    albumin?: number;
  };
  pregnancyStatus?: {
    isPregnant: boolean;
    gestationalWeeks?: number;
    lactating?: boolean;
  };
}

export interface DrugInteraction {
  drug1: { name: string; rxnormCode?: string };
  drug2: { name: string; rxnormCode?: string };
  severity: "critical" | "major" | "moderate" | "minor";
  type: "pharmacokinetic" | "pharmacodynamic" | "additive" | "synergistic" | "antagonistic";
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  evidenceLevel: "high" | "moderate" | "low";
  references: string[];
}

export interface Contraindication {
  medication: string;
  condition: string;
  severity: "absolute" | "relative";
  reason: string;
  alternatives: string[];
  evidenceLevel: "high" | "moderate" | "low";
}

export interface HighRiskAlert {
  alertType: "drug_interaction" | "contraindication" | "allergy_cross_reactivity" | "renal_dosing" | "hepatic_dosing" | "pregnancy_risk" | "genomic_risk" | "lab_drug_conflict" | "vital_sign_concern" | "polypharmacy" | "duplicate_therapy" | "therapeutic_range";
  severity: "critical" | "high" | "moderate" | "low";
  title: string;
  description: string;
  affectedMedications: string[];
  affectedConditions: string[];
  recommendation: string;
  requiresImmediateAction: boolean;
  evidenceBase: string;
  category: string;
}

export interface SafetyAnalysisResult {
  patientId: string;
  analyzedAt: Date;
  overallRiskLevel: "critical" | "high" | "moderate" | "low";
  drugInteractions: DrugInteraction[];
  contraindications: Contraindication[];
  highRiskAlerts: HighRiskAlert[];
  polypharmacyAssessment: {
    medicationCount: number;
    riskLevel: string;
    concerns: string[];
    recommendations: string[];
  };
  renalDosingAlerts: Array<{
    medication: string;
    currentDose: string;
    recommendedDose: string;
    reason: string;
  }>;
  hepaticDosingAlerts: Array<{
    medication: string;
    currentDose: string;
    recommendedDose: string;
    reason: string;
  }>;
  genomicAlerts: Array<{
    gene: string;
    variant: string;
    affectedMedications: string[];
    recommendation: string;
    metabolizerStatus?: string;
  }>;
  duplicateTherapies: Array<{
    medications: string[];
    therapeuticClass: string;
    recommendation: string;
  }>;
  summary: string;
  disclaimer: string;
}

function buildProfilePrompt(profile: PatientSafetyProfile): string {
  const d = profile.demographics;
  let prompt = `PATIENT DEMOGRAPHICS:
Age: ${d.age}, Gender: ${d.gender}${d.weight ? `, Weight: ${d.weight} kg` : ""}${d.height ? `, Height: ${d.height} cm` : ""}${d.ethnicity ? `, Ethnicity: ${d.ethnicity}` : ""}
${d.age >= 65 ? "NOTE: ELDERLY PATIENT - consider age-related dosing adjustments\n" : ""}
CONDITIONS:
${profile.conditions.length > 0 ? profile.conditions.map(c => `- ${c.name} (status: ${c.status}${c.code ? `, code: ${c.code}` : ""}${c.severity ? `, severity: ${c.severity}` : ""}${c.onsetDate ? `, onset: ${c.onsetDate}` : ""})`).join("\n") : "None listed"}

MEDICATIONS:
${profile.medications.length > 0 ? profile.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.route ? ` (${m.route})` : ""}${m.rxnormCode ? ` [RxNorm: ${m.rxnormCode}]` : ""}${m.startDate ? ` since ${m.startDate}` : ""}${m.prescriber ? ` prescribed by ${m.prescriber}` : ""}`).join("\n") : "None listed"}

ALLERGIES:
${profile.allergies.length > 0 ? profile.allergies.map(a => `- ${a.substance}${a.reaction ? ` (reaction: ${a.reaction})` : ""}${a.severity ? ` [severity: ${a.severity}]` : ""}`).join("\n") : "NKDA"}

VITALS:
${profile.vitals.length > 0 ? profile.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})${v.trend ? ` [Trend: ${v.trend}]` : ""}`).join("\n") : "Not available"}

LAB RESULTS:
${profile.labResults.length > 0 ? profile.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.flag ? ` [${l.flag}]` : ""}${l.loincCode ? ` LOINC: ${l.loincCode}` : ""}`).join("\n") : "Not available"}`;

  if (profile.genomicMarkers && profile.genomicMarkers.length > 0) {
    prompt += `\n\nGENOMIC MARKERS:
${profile.genomicMarkers.map(g => `- Gene: ${g.gene}, Variant: ${g.variant}${g.phenotype ? `, Phenotype: ${g.phenotype}` : ""}${g.clinicalSignificance ? `, Significance: ${g.clinicalSignificance}` : ""}`).join("\n")}`;
  }

  if (profile.renalFunction) {
    const rf = profile.renalFunction;
    prompt += `\n\nRENAL FUNCTION:
${rf.gfr !== undefined ? `- GFR: ${rf.gfr} mL/min/1.73m²` : ""}
${rf.creatinine !== undefined ? `- Creatinine: ${rf.creatinine} mg/dL` : ""}
${rf.bun !== undefined ? `- BUN: ${rf.bun} mg/dL` : ""}`;
  }

  if (profile.hepaticFunction) {
    const hf = profile.hepaticFunction;
    prompt += `\n\nHEPATIC FUNCTION:
${hf.alt !== undefined ? `- ALT: ${hf.alt} U/L` : ""}
${hf.ast !== undefined ? `- AST: ${hf.ast} U/L` : ""}
${hf.bilirubin !== undefined ? `- Bilirubin: ${hf.bilirubin} mg/dL` : ""}
${hf.albumin !== undefined ? `- Albumin: ${hf.albumin} g/dL` : ""}`;
  }

  if (profile.pregnancyStatus) {
    const ps = profile.pregnancyStatus;
    prompt += `\n\nPREGNANCY STATUS:
- Pregnant: ${ps.isPregnant ? "Yes" : "No"}${ps.gestationalWeeks ? `, Gestational weeks: ${ps.gestationalWeeks}` : ""}${ps.lactating ? ", Currently lactating" : ""}`;
  }

  return prompt;
}

export class AISafetyAnalysisService {
  private stats = {
    analysesPerformed: 0,
    interactionsFound: 0,
    alertsGenerated: 0,
    criticalAlertsGenerated: 0,
  };

  async analyzePatientSafety(profile: PatientSafetyProfile): Promise<SafetyAnalysisResult> {
    console.log(`[SafetyAnalysis] Starting comprehensive safety analysis for patient ${profile.patientId}`);

    const systemPrompt = `You are an expert clinical pharmacist and patient safety AI. Perform a comprehensive proactive safety analysis of the patient data provided. Analyze ALL of the following:

1. DRUG-DRUG INTERACTIONS: Check every medication pair for pharmacokinetic (CYP450 enzyme interactions, protein binding displacement, renal/hepatic clearance changes) and pharmacodynamic (additive, synergistic, antagonistic effects) interactions.

2. DRUG-CONDITION CONTRAINDICATIONS: Check each medication against each condition and allergy for absolute and relative contraindications.

3. ALLERGY CROSS-REACTIVITY: Check for cross-reactivity between documented allergies and current medications (e.g., penicillin allergy and cephalosporin use).

4. RENAL DOSING: If renal function data is available, check if any medications require dose adjustment based on GFR/creatinine clearance.

5. HEPATIC DOSING: If hepatic function data is available, check if any medications require dose adjustment based on liver function.

6. PREGNANCY RISKS: If pregnancy status is provided, assess FDA pregnancy risk categories for all medications.

7. GENOMIC PHARMACOGENOMICS: If genomic markers are available, analyze CYP450 enzyme polymorphisms (CYP2D6, CYP2C19, CYP3A4, CYP2C9, etc.) and their impact on drug metabolism. Classify metabolizer status (ultra-rapid, extensive/normal, intermediate, poor).

8. LAB-DRUG CONFLICTS: Cross-reference lab results with medication safety (e.g., hypokalemia + digoxin, elevated INR + warfarin, hyperkalemia + ACE inhibitors/ARBs/potassium-sparing diuretics).

9. VITAL SIGN CONCERNS: Correlate vital signs with medication effects (e.g., bradycardia + beta-blockers, hypotension + antihypertensives).

10. POLYPHARMACY RISKS: Assess polypharmacy burden (flag >= 5 medications, high risk >= 10). Consider anticholinergic burden, sedative load, fall risk especially for elderly patients (age >= 65).

11. DUPLICATE THERAPIES: Identify medications in the same therapeutic class that may represent unnecessary duplication.

12. THERAPEUTIC RANGE MONITORING: Identify medications with narrow therapeutic indices that require monitoring.

Respond in JSON format:
{
  "drugInteractions": [
    {
      "drug1": { "name": "string", "rxnormCode": "string or null" },
      "drug2": { "name": "string", "rxnormCode": "string or null" },
      "severity": "critical|major|moderate|minor",
      "type": "pharmacokinetic|pharmacodynamic|additive|synergistic|antagonistic",
      "mechanism": "detailed mechanism",
      "clinicalEffect": "clinical effect description",
      "recommendation": "clinical recommendation",
      "evidenceLevel": "high|moderate|low",
      "references": ["reference1", "reference2"]
    }
  ],
  "contraindications": [
    {
      "medication": "medication name",
      "condition": "condition name",
      "severity": "absolute|relative",
      "reason": "reason for contraindication",
      "alternatives": ["alternative1", "alternative2"],
      "evidenceLevel": "high|moderate|low"
    }
  ],
  "highRiskAlerts": [
    {
      "alertType": "drug_interaction|contraindication|allergy_cross_reactivity|renal_dosing|hepatic_dosing|pregnancy_risk|genomic_risk|lab_drug_conflict|vital_sign_concern|polypharmacy|duplicate_therapy|therapeutic_range",
      "severity": "critical|high|moderate|low",
      "title": "alert title",
      "description": "detailed description",
      "affectedMedications": ["med1"],
      "affectedConditions": ["condition1"],
      "recommendation": "recommendation",
      "requiresImmediateAction": true/false,
      "evidenceBase": "evidence description",
      "category": "category name"
    }
  ],
  "polypharmacyAssessment": {
    "medicationCount": 0,
    "riskLevel": "low|moderate|high|critical",
    "concerns": ["concern1"],
    "recommendations": ["recommendation1"]
  },
  "renalDosingAlerts": [
    { "medication": "name", "currentDose": "current", "recommendedDose": "recommended", "reason": "reason" }
  ],
  "hepaticDosingAlerts": [
    { "medication": "name", "currentDose": "current", "recommendedDose": "recommended", "reason": "reason" }
  ],
  "genomicAlerts": [
    { "gene": "CYP2D6", "variant": "variant", "affectedMedications": ["med1"], "recommendation": "rec", "metabolizerStatus": "poor|intermediate|normal|ultra-rapid" }
  ],
  "duplicateTherapies": [
    { "medications": ["med1", "med2"], "therapeuticClass": "class", "recommendation": "rec" }
  ],
  "summary": "comprehensive safety summary paragraph"
}`;

    const userPrompt = `Perform a comprehensive proactive safety analysis for the following patient:\n\n${buildProfilePrompt(profile)}`;

    const result = await chatComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["demographics", "conditions", "medications", "allergies", "vitals", "lab_results", "genomics"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "analyzePatientSafety",
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI");
    }

    const parsed = JSON.parse(content);

    const drugInteractions: DrugInteraction[] = parsed.drugInteractions || [];
    const contraindications: Contraindication[] = parsed.contraindications || [];
    const highRiskAlerts: HighRiskAlert[] = parsed.highRiskAlerts || [];
    const renalDosingAlerts = parsed.renalDosingAlerts || [];
    const hepaticDosingAlerts = parsed.hepaticDosingAlerts || [];
    const genomicAlerts = parsed.genomicAlerts || [];
    const duplicateTherapies = parsed.duplicateTherapies || [];

    const polypharmacyAssessment = parsed.polypharmacyAssessment || {
      medicationCount: profile.medications.length,
      riskLevel: profile.medications.length >= 10 ? "high" : profile.medications.length >= 5 ? "moderate" : "low",
      concerns: [],
      recommendations: [],
    };

    let overallRiskLevel: "critical" | "high" | "moderate" | "low" = "low";
    const hasCritical = drugInteractions.some((d: DrugInteraction) => d.severity === "critical") ||
      highRiskAlerts.some((a: HighRiskAlert) => a.severity === "critical");
    const hasHigh = drugInteractions.some((d: DrugInteraction) => d.severity === "major") ||
      highRiskAlerts.some((a: HighRiskAlert) => a.severity === "high") ||
      contraindications.some((c: Contraindication) => c.severity === "absolute");
    const hasModerate = drugInteractions.some((d: DrugInteraction) => d.severity === "moderate") ||
      highRiskAlerts.some((a: HighRiskAlert) => a.severity === "moderate") ||
      contraindications.some((c: Contraindication) => c.severity === "relative");

    if (hasCritical) overallRiskLevel = "critical";
    else if (hasHigh) overallRiskLevel = "high";
    else if (hasModerate) overallRiskLevel = "moderate";

    this.stats.analysesPerformed++;
    this.stats.interactionsFound += drugInteractions.length;
    this.stats.alertsGenerated += highRiskAlerts.length;
    this.stats.criticalAlertsGenerated += highRiskAlerts.filter((a: HighRiskAlert) => a.severity === "critical").length;

    console.log(`[SafetyAnalysis] Analysis complete: ${drugInteractions.length} interactions, ${contraindications.length} contraindications, ${highRiskAlerts.length} alerts, overall risk: ${overallRiskLevel}`);

    return {
      patientId: profile.patientId,
      analyzedAt: new Date(),
      overallRiskLevel,
      drugInteractions,
      contraindications,
      highRiskAlerts,
      polypharmacyAssessment,
      renalDosingAlerts,
      hepaticDosingAlerts,
      genomicAlerts,
      duplicateTherapies,
      summary: parsed.summary || "",
      disclaimer: DISCLAIMER,
    };
  }

  async checkDrugInteractions(medications: PatientSafetyProfile["medications"]): Promise<DrugInteraction[]> {
    console.log(`[SafetyAnalysis] Checking drug interactions for ${medications.length} medications`);

    if (medications.length < 2) {
      console.log("[SafetyAnalysis] Fewer than 2 medications, no interactions to check");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.rxnormCode ? ` [RxNorm: ${m.rxnormCode}]` : ""}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkDrugInteractions",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist. Analyze all possible drug-drug interactions between the medications listed. Consider pharmacokinetic interactions (CYP450 enzyme inhibition/induction, protein binding, renal clearance) and pharmacodynamic interactions (additive, synergistic, antagonistic effects).

Respond in JSON:
{
  "interactions": [
    {
      "drug1": { "name": "string", "rxnormCode": "string or null" },
      "drug2": { "name": "string", "rxnormCode": "string or null" },
      "severity": "critical|major|moderate|minor",
      "type": "pharmacokinetic|pharmacodynamic|additive|synergistic|antagonistic",
      "mechanism": "detailed mechanism of interaction",
      "clinicalEffect": "expected clinical effect",
      "recommendation": "clinical recommendation",
      "evidenceLevel": "high|moderate|low",
      "references": ["reference sources"]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check all drug-drug interactions for these medications:\n\n${medicationList}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for drug interaction check");
    }

    const parsed = JSON.parse(content);
    const interactions: DrugInteraction[] = parsed.interactions || [];

    this.stats.interactionsFound += interactions.length;
    console.log(`[SafetyAnalysis] Found ${interactions.length} drug interactions`);

    return interactions;
  }

  async checkContraindications(
    medications: PatientSafetyProfile["medications"],
    conditions: PatientSafetyProfile["conditions"],
    allergies: PatientSafetyProfile["allergies"]
  ): Promise<Contraindication[]> {
    console.log(`[SafetyAnalysis] Checking contraindications for ${medications.length} medications against ${conditions.length} conditions and ${allergies.length} allergies`);

    if (medications.length === 0) {
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");
    const conditionList = conditions.map(c => `- ${c.name} (status: ${c.status}${c.severity ? `, severity: ${c.severity}` : ""})`).join("\n");
    const allergyList = allergies.map(a => `- ${a.substance}${a.reaction ? ` (reaction: ${a.reaction})` : ""}${a.severity ? ` [${a.severity}]` : ""}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "conditions", "allergies"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkContraindications",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist. Check each medication against all conditions and allergies for contraindications. Include both absolute (must not use) and relative (use with caution) contraindications. Also check for allergy cross-reactivity.

Respond in JSON:
{
  "contraindications": [
    {
      "medication": "medication name",
      "condition": "condition or allergy name",
      "severity": "absolute|relative",
      "reason": "detailed reason for contraindication",
      "alternatives": ["alternative medication 1", "alternative medication 2"],
      "evidenceLevel": "high|moderate|low"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check contraindications:\n\nMEDICATIONS:\n${medicationList}\n\nCONDITIONS:\n${conditionList || "None listed"}\n\nALLERGIES:\n${allergyList || "NKDA"}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for contraindication check");
    }

    const parsed = JSON.parse(content);
    const contraindications: Contraindication[] = parsed.contraindications || [];

    console.log(`[SafetyAnalysis] Found ${contraindications.length} contraindications`);

    return contraindications;
  }

  async checkRenalDosing(
    medications: PatientSafetyProfile["medications"],
    renalFunction: PatientSafetyProfile["renalFunction"]
  ): Promise<SafetyAnalysisResult["renalDosingAlerts"]> {
    console.log("[SafetyAnalysis] Checking renal dosing adjustments");

    if (!renalFunction || medications.length === 0) {
      console.log("[SafetyAnalysis] No renal function data or medications provided");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "lab_results"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkRenalDosing",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist specializing in renal dosing adjustments. Analyze each medication and determine if dose adjustment is needed based on kidney function (GFR, creatinine, BUN). Use standard renal dosing guidelines.

Respond in JSON:
{
  "renalDosingAlerts": [
    {
      "medication": "medication name",
      "currentDose": "current dosage and frequency",
      "recommendedDose": "recommended adjusted dosage",
      "reason": "clinical reason for adjustment based on renal function"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check renal dosing for these medications:\n\nMEDICATIONS:\n${medicationList}\n\nRENAL FUNCTION:\n- GFR: ${renalFunction.gfr !== undefined ? `${renalFunction.gfr} mL/min/1.73m²` : "Not available"}\n- Creatinine: ${renalFunction.creatinine !== undefined ? `${renalFunction.creatinine} mg/dL` : "Not available"}\n- BUN: ${renalFunction.bun !== undefined ? `${renalFunction.bun} mg/dL` : "Not available"}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for renal dosing check");
    }

    const parsed = JSON.parse(content);
    const alerts = parsed.renalDosingAlerts || [];

    console.log(`[SafetyAnalysis] Found ${alerts.length} renal dosing alerts`);

    return alerts;
  }

  async checkHepaticDosing(
    medications: PatientSafetyProfile["medications"],
    hepaticFunction: PatientSafetyProfile["hepaticFunction"]
  ): Promise<SafetyAnalysisResult["hepaticDosingAlerts"]> {
    console.log("[SafetyAnalysis] Checking hepatic dosing adjustments");

    if (!hepaticFunction || medications.length === 0) {
      console.log("[SafetyAnalysis] No hepatic function data or medications provided");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "lab_results"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkHepaticDosing",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist specializing in hepatic dosing adjustments. Analyze each medication and determine if dose adjustment is needed based on liver function tests (ALT, AST, bilirubin, albumin). Consider Child-Pugh classification when applicable.

Respond in JSON:
{
  "hepaticDosingAlerts": [
    {
      "medication": "medication name",
      "currentDose": "current dosage and frequency",
      "recommendedDose": "recommended adjusted dosage",
      "reason": "clinical reason for adjustment based on hepatic function"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check hepatic dosing for these medications:\n\nMEDICATIONS:\n${medicationList}\n\nHEPATIC FUNCTION:\n- ALT: ${hepaticFunction.alt !== undefined ? `${hepaticFunction.alt} U/L` : "Not available"}\n- AST: ${hepaticFunction.ast !== undefined ? `${hepaticFunction.ast} U/L` : "Not available"}\n- Bilirubin: ${hepaticFunction.bilirubin !== undefined ? `${hepaticFunction.bilirubin} mg/dL` : "Not available"}\n- Albumin: ${hepaticFunction.albumin !== undefined ? `${hepaticFunction.albumin} g/dL` : "Not available"}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for hepatic dosing check");
    }

    const parsed = JSON.parse(content);
    const alerts = parsed.hepaticDosingAlerts || [];

    console.log(`[SafetyAnalysis] Found ${alerts.length} hepatic dosing alerts`);

    return alerts;
  }

  async analyzeGenomicRisks(
    medications: PatientSafetyProfile["medications"],
    genomicMarkers: PatientSafetyProfile["genomicMarkers"]
  ): Promise<SafetyAnalysisResult["genomicAlerts"]> {
    console.log("[SafetyAnalysis] Analyzing pharmacogenomic risks");

    if (!genomicMarkers || genomicMarkers.length === 0 || medications.length === 0) {
      console.log("[SafetyAnalysis] No genomic markers or medications provided");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");
    const markerList = genomicMarkers.map(g => `- Gene: ${g.gene}, Variant: ${g.variant}${g.phenotype ? `, Phenotype: ${g.phenotype}` : ""}${g.clinicalSignificance ? `, Significance: ${g.clinicalSignificance}` : ""}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "genomics"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "analyzeGenomicRisks",
      messages: [
        {
          role: "system",
          content: `You are an expert pharmacogenomics specialist. Analyze the patient's genomic markers against their medications to identify pharmacogenomic risks. Focus on CYP450 enzymes (CYP2D6, CYP2C19, CYP3A4, CYP2C9, CYP1A2, CYP2B6), UGT enzymes, DPYD, TPMT, HLA markers, and other clinically relevant pharmacogenes. Classify metabolizer status as ultra-rapid, normal/extensive, intermediate, or poor metabolizer.

Respond in JSON:
{
  "genomicAlerts": [
    {
      "gene": "gene name (e.g., CYP2D6)",
      "variant": "variant description",
      "affectedMedications": ["medication names affected"],
      "recommendation": "clinical recommendation",
      "metabolizerStatus": "poor|intermediate|normal|ultra-rapid"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Analyze pharmacogenomic risks:\n\nMEDICATIONS:\n${medicationList}\n\nGENOMIC MARKERS:\n${markerList}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for genomic risk analysis");
    }

    const parsed = JSON.parse(content);
    const alerts = parsed.genomicAlerts || [];

    console.log(`[SafetyAnalysis] Found ${alerts.length} genomic alerts`);

    return alerts;
  }

  async checkPregnancySafety(
    medications: PatientSafetyProfile["medications"],
    pregnancyStatus: PatientSafetyProfile["pregnancyStatus"]
  ): Promise<HighRiskAlert[]> {
    console.log("[SafetyAnalysis] Checking pregnancy safety");

    if (!pregnancyStatus || (!pregnancyStatus.isPregnant && !pregnancyStatus.lactating) || medications.length === 0) {
      console.log("[SafetyAnalysis] Patient not pregnant/lactating or no medications provided");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "demographics"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkPregnancySafety",
      messages: [
        {
          role: "system",
          content: `You are an expert in maternal-fetal medicine and medication safety during pregnancy and lactation. Assess each medication for pregnancy and lactation safety. Reference FDA pregnancy risk categories and current evidence-based guidelines.

Respond in JSON:
{
  "pregnancyAlerts": [
    {
      "alertType": "pregnancy_risk",
      "severity": "critical|high|moderate|low",
      "title": "alert title",
      "description": "detailed description of risk including FDA category if applicable",
      "affectedMedications": ["medication name"],
      "affectedConditions": [],
      "recommendation": "clinical recommendation including safer alternatives if available",
      "requiresImmediateAction": true/false,
      "evidenceBase": "evidence and references",
      "category": "Pregnancy Safety"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check pregnancy/lactation safety:\n\nMEDICATIONS:\n${medicationList}\n\nPREGNANCY STATUS:\n- Pregnant: ${pregnancyStatus.isPregnant ? "Yes" : "No"}${pregnancyStatus.gestationalWeeks ? `\n- Gestational weeks: ${pregnancyStatus.gestationalWeeks}` : ""}${pregnancyStatus.lactating ? "\n- Currently lactating" : ""}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for pregnancy safety check");
    }

    const parsed = JSON.parse(content);
    const alerts: HighRiskAlert[] = parsed.pregnancyAlerts || [];

    this.stats.alertsGenerated += alerts.length;
    this.stats.criticalAlertsGenerated += alerts.filter(a => a.severity === "critical").length;

    console.log(`[SafetyAnalysis] Found ${alerts.length} pregnancy safety alerts`);

    return alerts;
  }

  async assessPolypharmacy(
    medications: PatientSafetyProfile["medications"],
    demographics: PatientSafetyProfile["demographics"]
  ): Promise<SafetyAnalysisResult["polypharmacyAssessment"]> {
    console.log(`[SafetyAnalysis] Assessing polypharmacy for ${medications.length} medications`);

    const medicationCount = medications.length;
    const isElderly = demographics.age >= 65;

    if (medicationCount < 5) {
      console.log("[SafetyAnalysis] Fewer than 5 medications, low polypharmacy risk");
      return {
        medicationCount,
        riskLevel: "low",
        concerns: [],
        recommendations: [],
      };
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "demographics"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "assessPolypharmacy",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist specializing in polypharmacy assessment. Analyze the medication list for polypharmacy risks. Consider:
- Total medication burden (>= 5 is polypharmacy, >= 10 is high-risk polypharmacy)
- Anticholinergic burden score
- Sedative load
- Fall risk (especially for elderly patients age >= 65)
- Drug-drug interaction potential with many medications
- Prescribing cascade (medications prescribed to treat side effects of other medications)
- Beers Criteria medications (if patient is elderly)
- Medication adherence challenges

Respond in JSON:
{
  "polypharmacyAssessment": {
    "medicationCount": ${medicationCount},
    "riskLevel": "low|moderate|high|critical",
    "concerns": ["concern 1", "concern 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  }
}`,
        },
        {
          role: "user",
          content: `Assess polypharmacy risk:\n\nPATIENT: Age ${demographics.age}, Gender: ${demographics.gender}${isElderly ? " (ELDERLY - apply Beers Criteria)" : ""}\n\nMEDICATIONS (${medicationCount} total):\n${medicationList}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for polypharmacy assessment");
    }

    const parsed = JSON.parse(content);
    const assessment = parsed.polypharmacyAssessment || {
      medicationCount,
      riskLevel: medicationCount >= 10 ? "high" : "moderate",
      concerns: [],
      recommendations: [],
    };

    console.log(`[SafetyAnalysis] Polypharmacy assessment: ${assessment.riskLevel} risk with ${medicationCount} medications`);

    return assessment;
  }

  async checkLabDrugConflicts(
    medications: PatientSafetyProfile["medications"],
    labResults: PatientSafetyProfile["labResults"]
  ): Promise<HighRiskAlert[]> {
    console.log("[SafetyAnalysis] Checking lab-drug conflicts");

    if (medications.length === 0 || labResults.length === 0) {
      console.log("[SafetyAnalysis] No medications or lab results provided");
      return [];
    }

    const medicationList = medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n");
    const labList = labResults.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""}${l.flag ? ` [${l.flag}]` : ""} (${l.date})`).join("\n");

    const result = await chatComplete({
      model: "deep",
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["medications", "lab_results"],
      purpose: "safety_analysis",
      callerService: "ai-safety-analysis-service",
      callerMethod: "checkLabDrugConflicts",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist. Cross-reference lab results with medication safety. Identify conflicts such as:
- Hypokalemia (low potassium) + digoxin = increased toxicity risk
- Hyperkalemia (high potassium) + ACE inhibitors/ARBs/potassium-sparing diuretics
- Elevated INR + warfarin = bleeding risk
- Low platelet count + anticoagulants/antiplatelets
- Elevated creatinine + nephrotoxic drugs
- Elevated liver enzymes + hepatotoxic drugs
- Hyponatremia + SSRIs/thiazides
- Hypothyroidism (elevated TSH) + levothyroxine dosing
- Abnormal thyroid function + amiodarone
- Low magnesium + QT-prolonging drugs

Respond in JSON:
{
  "labDrugConflicts": [
    {
      "alertType": "lab_drug_conflict",
      "severity": "critical|high|moderate|low",
      "title": "alert title",
      "description": "detailed description of the conflict",
      "affectedMedications": ["medication names"],
      "affectedConditions": [],
      "recommendation": "clinical recommendation",
      "requiresImmediateAction": true/false,
      "evidenceBase": "evidence description",
      "category": "Lab-Drug Safety"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Check lab-drug conflicts:\n\nMEDICATIONS:\n${medicationList}\n\nLAB RESULTS:\n${labList}`,
        },
      ],
    });

    const content = result.content;
    if (!content) {
      throw new Error("[SafetyAnalysis] No response from AI for lab-drug conflict check");
    }

    const parsed = JSON.parse(content);
    const alerts: HighRiskAlert[] = parsed.labDrugConflicts || [];

    this.stats.alertsGenerated += alerts.length;
    this.stats.criticalAlertsGenerated += alerts.filter(a => a.severity === "critical").length;

    console.log(`[SafetyAnalysis] Found ${alerts.length} lab-drug conflicts`);

    return alerts;
  }

  getStats(): object {
    return {
      ...this.stats,
      disclaimer: DISCLAIMER,
    };
  }
}

export const aiSafetyAnalysisService = new AISafetyAnalysisService();

export function initializeSafetyAnalysis() {
  console.log("[SafetyAnalysis] AI safety analysis service initialized");
}
