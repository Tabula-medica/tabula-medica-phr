import { chatComplete } from "./ai-client";
import { db } from "./db";
import { healthRecords, medicationSchedules, users, patientProfiles } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface CDSAlert {
  id: string;
  category: "diagnosis" | "drug_interaction" | "diagnostic_test" | "preventive" | "safety";
  severity: "critical" | "high" | "moderate" | "low" | "info";
  title: string;
  description: string;
  rationale: string;
  recommendations: string[];
  uscdiCategory?: string;
  icd10Codes?: string[];
  loincCodes?: string[];
  rxnormCodes?: string[];
  evidenceLevel?: string;
  references?: string[];
  disclaimer: string;
}

export interface CDSAnalysisRequest {
  patientId: string;
  symptoms?: string[];
  medications?: string[];
  conditions?: string[];
  labResults?: Array<{ name: string; value: string; unit: string; date: string }>;
  visitType?: string;
  chiefComplaint?: string;
  context: "record_review" | "telehealth" | "medication_review" | "general";
}

export interface CDSAnalysisResult {
  patientId: string;
  generatedAt: string;
  context: string;
  alerts: CDSAlert[];
  differentialDiagnoses: Array<{
    condition: string;
    icd10Code: string;
    probability: string;
    supportingFactors: string[];
    rulingOutFactors: string[];
  }>;
  drugInteractions: Array<{
    drug1: string;
    drug2: string;
    severity: "contraindicated" | "major" | "moderate" | "minor";
    description: string;
    clinicalEffect: string;
    management: string;
    rxnormCodes?: string[];
  }>;
  recommendedTests: Array<{
    testName: string;
    loincCode: string;
    priority: "stat" | "urgent" | "routine" | "elective";
    rationale: string;
    expectedFindings: string;
    uscdiCategory: string;
  }>;
  preventiveCareGaps: Array<{
    measure: string;
    dueDate: string;
    status: "overdue" | "due_soon" | "current";
    recommendation: string;
  }>;
  disclaimer: string;
}

const DRUG_INTERACTION_DB: Array<{
  drug1Pattern: RegExp;
  drug2Pattern: RegExp;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  description: string;
  clinicalEffect: string;
  management: string;
}> = [
  {
    drug1Pattern: /warfarin/i,
    drug2Pattern: /aspirin|ibuprofen|naproxen|nsaid/i,
    severity: "major",
    description: "Anticoagulant + NSAID combination increases bleeding risk",
    clinicalEffect: "Significantly elevated risk of GI bleeding and hemorrhagic events",
    management: "Avoid combination if possible. If necessary, use lowest NSAID dose for shortest duration with PPI co-prescription",
  },
  {
    drug1Pattern: /lisinopril|enalapril|ramipril|ace.?inhibitor/i,
    drug2Pattern: /potassium|spironolactone|triamterene/i,
    severity: "major",
    description: "ACE inhibitor + potassium-sparing agent increases hyperkalemia risk",
    clinicalEffect: "Risk of dangerous hyperkalemia, potentially fatal cardiac arrhythmias",
    management: "Monitor serum potassium closely. Consider alternative antihypertensive or diuretic",
  },
  {
    drug1Pattern: /metformin/i,
    drug2Pattern: /contrast.?dye|iodinated/i,
    severity: "major",
    description: "Metformin with iodinated contrast media increases lactic acidosis risk",
    clinicalEffect: "Potential lactic acidosis due to renal impairment from contrast",
    management: "Hold metformin 48 hours before and after contrast administration. Check renal function before restarting",
  },
  {
    drug1Pattern: /ssri|fluoxetine|sertraline|paroxetine|citalopram|escitalopram/i,
    drug2Pattern: /maoi|phenelzine|tranylcypromine|selegiline|isocarboxazid/i,
    severity: "contraindicated",
    description: "SSRI + MAOI combination risk of serotonin syndrome",
    clinicalEffect: "Life-threatening serotonin syndrome: hyperthermia, rigidity, myoclonus, autonomic instability",
    management: "Absolutely contraindicated. Minimum 14-day washout between agents (5 weeks for fluoxetine)",
  },
  {
    drug1Pattern: /statin|atorvastatin|simvastatin|rosuvastatin|lovastatin/i,
    drug2Pattern: /gemfibrozil|fibrate/i,
    severity: "major",
    description: "Statin + fibrate combination increases rhabdomyolysis risk",
    clinicalEffect: "Elevated risk of myopathy and rhabdomyolysis",
    management: "Prefer fenofibrate over gemfibrozil if combination needed. Monitor CK levels and muscle symptoms",
  },
  {
    drug1Pattern: /methotrexate/i,
    drug2Pattern: /nsaid|ibuprofen|naproxen|aspirin/i,
    severity: "major",
    description: "Methotrexate + NSAID increases methotrexate toxicity risk",
    clinicalEffect: "Decreased renal clearance of methotrexate leading to pancytopenia, mucositis, and renal failure",
    management: "Avoid NSAIDs during high-dose methotrexate. Low-dose methotrexate: use NSAIDs cautiously with close CBC monitoring",
  },
  {
    drug1Pattern: /digoxin/i,
    drug2Pattern: /amiodarone/i,
    severity: "major",
    description: "Amiodarone increases digoxin levels",
    clinicalEffect: "Digoxin toxicity: nausea, visual changes, arrhythmias",
    management: "Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels closely",
  },
  {
    drug1Pattern: /warfarin/i,
    drug2Pattern: /amiodarone/i,
    severity: "major",
    description: "Amiodarone potentiates warfarin anticoagulant effect",
    clinicalEffect: "Significantly increased INR with elevated bleeding risk",
    management: "Reduce warfarin dose by 33-50% when starting amiodarone. Monitor INR weekly for 4-6 weeks",
  },
  {
    drug1Pattern: /clopidogrel|plavix/i,
    drug2Pattern: /omeprazole|esomeprazole/i,
    severity: "moderate",
    description: "PPI may reduce clopidogrel antiplatelet effectiveness",
    clinicalEffect: "Reduced conversion of clopidogrel to active metabolite, potentially decreased antiplatelet effect",
    management: "Consider pantoprazole or famotidine as alternative acid suppression. Separate dosing times if PPI necessary",
  },
  {
    drug1Pattern: /lithium/i,
    drug2Pattern: /nsaid|ibuprofen|naproxen|diuretic|ace.?inhibitor|lisinopril/i,
    severity: "major",
    description: "Drug interaction may increase lithium levels to toxic range",
    clinicalEffect: "Lithium toxicity: tremor, confusion, ataxia, renal failure, seizures",
    management: "Monitor lithium levels closely when adding/changing interacting medication. Adjust lithium dose as needed",
  },
];

export class ClinicalDecisionSupportService {
  async analyzePatient(request: CDSAnalysisRequest): Promise<CDSAnalysisResult> {
    const patientData = await this.gatherPatientData(request.patientId);

    const allMedications = [
      ...(request.medications || []),
      ...patientData.activeMedications.map(m => m.medicationName),
    ];
    const uniqueMedications = [...new Set(allMedications)];

    const allConditions = [
      ...(request.conditions || []),
      ...patientData.conditions.map(c => c.title),
    ];
    const uniqueConditions = [...new Set(allConditions)];

    const drugInteractions = this.checkDrugInteractions(uniqueMedications);

    const aiAnalysis = await this.runAIAnalysis({
      symptoms: request.symptoms || [],
      medications: uniqueMedications,
      conditions: uniqueConditions,
      labResults: [
        ...(request.labResults || []),
        ...patientData.recentLabs.map(l => ({
          name: l.title,
          value: l.summary || "",
          unit: "",
          date: typeof l.date === "string" ? l.date : l.date.toISOString(),
        })),
      ],
      visitType: request.visitType,
      chiefComplaint: request.chiefComplaint,
      context: request.context,
      demographics: {
        age: patientData.demographics.age,
        gender: patientData.demographics.gender || undefined,
        name: patientData.demographics.name || undefined,
      },
    });

    const alerts: CDSAlert[] = [];

    for (const interaction of drugInteractions) {
      alerts.push({
        id: `di-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        category: "drug_interaction",
        severity: interaction.severity === "contraindicated" ? "critical" :
                  interaction.severity === "major" ? "high" :
                  interaction.severity === "moderate" ? "moderate" : "low",
        title: `Drug Interaction: ${interaction.drug1} + ${interaction.drug2}`,
        description: interaction.description,
        rationale: interaction.clinicalEffect,
        recommendations: [interaction.management],
        rxnormCodes: interaction.rxnormCodes,
        disclaimer: "This alert is generated by a clinical decision support system. Always verify with current drug interaction databases and apply clinical judgment.",
      });
    }

    if (aiAnalysis.safetyAlerts) {
      for (const alert of aiAnalysis.safetyAlerts) {
        alerts.push({
          id: `sa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          category: alert.category || "safety",
          severity: alert.severity || "moderate",
          title: alert.title,
          description: alert.description,
          rationale: alert.rationale || "",
          recommendations: alert.recommendations || [],
          uscdiCategory: alert.uscdiCategory,
          disclaimer: "AI-generated clinical decision support. Not a substitute for professional medical judgment.",
        });
      }
    }

    return {
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      context: request.context,
      alerts,
      differentialDiagnoses: aiAnalysis.differentialDiagnoses || [],
      drugInteractions,
      recommendedTests: aiAnalysis.recommendedTests || [],
      preventiveCareGaps: aiAnalysis.preventiveCareGaps || [],
      disclaimer: "CLINICAL DECISION SUPPORT NOTICE: This information is generated by an AI system and is intended to support, not replace, clinical decision-making. All suggestions must be verified by a licensed healthcare provider. This system does not diagnose conditions or prescribe treatments. Always apply professional clinical judgment.",
    };
  }

  private async gatherPatientData(patientId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, patientId)).limit(1);

    const [profile] = await db.select().from(patientProfiles)
      .where(eq(patientProfiles.userId, patientId)).limit(1);

    const records = await db.select().from(healthRecords)
      .where(eq(healthRecords.userId, patientId))
      .orderBy(desc(healthRecords.date))
      .limit(100);

    const activeMeds = await db.select().from(medicationSchedules)
      .where(and(
        eq(medicationSchedules.userId, patientId),
        eq(medicationSchedules.isActive, true)
      ));

    const conditions = records.filter(r => r.type === "condition");
    const recentLabs = records.filter(r => r.type === "lab_result").slice(0, 20);
    const recentVitals = records.filter(r => r.type === "vital").slice(0, 20);
    const allergies = records.filter(r => r.type === "allergy");
    const immunizations = records.filter(r => r.type === "immunization");
    const procedures = records.filter(r => r.type === "procedure");

    let age: number | undefined;
    if (profile?.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      if (now.getMonth() < dob.getMonth() ||
          (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
        age--;
      }
    }

    return {
      user,
      demographics: {
        age,
        gender: profile?.gender,
        name: user?.name,
      },
      activeMedications: activeMeds,
      conditions,
      recentLabs,
      recentVitals,
      allergies,
      immunizations,
      procedures,
    };
  }

  checkDrugInteractions(medications: string[]): Array<{
    drug1: string;
    drug2: string;
    severity: "contraindicated" | "major" | "moderate" | "minor";
    description: string;
    clinicalEffect: string;
    management: string;
    rxnormCodes?: string[];
  }> {
    const interactions: Array<{
      drug1: string;
      drug2: string;
      severity: "contraindicated" | "major" | "moderate" | "minor";
      description: string;
      clinicalEffect: string;
      management: string;
    }> = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        for (const rule of DRUG_INTERACTION_DB) {
          const match1 = (rule.drug1Pattern.test(medications[i]) && rule.drug2Pattern.test(medications[j])) ||
                         (rule.drug1Pattern.test(medications[j]) && rule.drug2Pattern.test(medications[i]));
          if (match1) {
            interactions.push({
              drug1: medications[i],
              drug2: medications[j],
              severity: rule.severity,
              description: rule.description,
              clinicalEffect: rule.clinicalEffect,
              management: rule.management,
            });
          }
        }
      }
    }

    return interactions;
  }

  private async runAIAnalysis(data: {
    symptoms: string[];
    medications: string[];
    conditions: string[];
    labResults: Array<{ name: string; value: string; unit: string; date: string }>;
    visitType?: string;
    chiefComplaint?: string;
    context: string;
    demographics: { age?: number; gender?: string; name?: string };
  }): Promise<{
    differentialDiagnoses: CDSAnalysisResult["differentialDiagnoses"];
    recommendedTests: CDSAnalysisResult["recommendedTests"];
    preventiveCareGaps: CDSAnalysisResult["preventiveCareGaps"];
    safetyAlerts: Array<{
      category: CDSAlert["category"];
      severity: CDSAlert["severity"];
      title: string;
      description: string;
      rationale: string;
      recommendations: string[];
      uscdiCategory?: string;
    }>;
  }> {
    try {
      const prompt = `You are a clinical decision support system (CDSS) for healthcare providers. Analyze the following patient data using USCDI v6 data standards and provide evidence-based clinical decision support.

PATIENT CONTEXT:
- Age: ${data.demographics.age || "Unknown"}
- Gender: ${data.demographics.gender || "Unknown"}
- Visit type: ${data.visitType || data.context}
- Chief complaint: ${data.chiefComplaint || "None specified"}

CURRENT SYMPTOMS: ${data.symptoms.length > 0 ? data.symptoms.join(", ") : "None reported"}

ACTIVE CONDITIONS: ${data.conditions.length > 0 ? data.conditions.join(", ") : "None documented"}

CURRENT MEDICATIONS: ${data.medications.length > 0 ? data.medications.join(", ") : "None listed"}

RECENT LAB RESULTS: ${data.labResults.length > 0 ? data.labResults.map(l => `${l.name}: ${l.value} ${l.unit} (${l.date})`).join("; ") : "None available"}

Provide comprehensive clinical decision support in JSON format with these fields:
1. "differentialDiagnoses": Array of potential diagnoses based on symptoms/conditions, each with: condition, icd10Code, probability (high/moderate/low), supportingFactors (array), rulingOutFactors (array)
2. "recommendedTests": Array of diagnostic tests to consider, each with: testName, loincCode, priority (stat/urgent/routine/elective), rationale, expectedFindings, uscdiCategory
3. "preventiveCareGaps": Array of preventive care considerations, each with: measure, dueDate, status (overdue/due_soon/current), recommendation
4. "safetyAlerts": Array of safety concerns, each with: category (diagnosis/drug_interaction/diagnostic_test/preventive/safety), severity (critical/high/moderate/low/info), title, description, rationale, recommendations (array), uscdiCategory

Use real ICD-10 and LOINC codes where applicable. Base recommendations on current clinical guidelines (USPSTF, AHA, ADA, etc.). USCDI v6 categories include: Allergies and Intolerances, Assessment and Plan of Treatment, Care Team Members, Clinical Notes, Clinical Tests, Emergency Contact Information, Encounter Information, Facility Information, Federal/State Drug Schedules, Functional Status, Goals, Health Concerns, Health Insurance Information, Health Status Assessments, Immunizations, Laboratory, Medications, Mental/Behavioral Health, Nutrition, Patient Communication, Patient Demographics, Pharmacogenomics, Pregnancy Status, Problems, Procedures, Provenance, Reason for Referral, Social Determinants of Health, Specimen, Substance Use, Treatment Plan, Unique Device Identifier(s), Vital Signs.

IMPORTANT: This is decision SUPPORT for providers, not direct patient care. Focus on evidence-based suggestions.`;

      const response = await chatComplete({
        model: "deep",
        maxOutputTokens: 3000,
        messages: [
          {
            role: "system",
            content: "You are an evidence-based clinical decision support system. Return valid JSON only. Always include real ICD-10 and LOINC codes. Never recommend specific treatments or prescriptions - only suggest diagnostic considerations for provider review. Always emphasize that all outputs require clinical validation.",
          },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        dataCategories: ["demographics", "conditions", "medications", "lab_results"],
        purpose: "clinical_decision_support",
        callerService: "clinical-decision-support-service",
        callerMethod: "analyzeWithAI",
      });

      const result = JSON.parse(response.content || "{}");
      return {
        differentialDiagnoses: result.differentialDiagnoses || [],
        recommendedTests: result.recommendedTests || [],
        preventiveCareGaps: result.preventiveCareGaps || [],
        safetyAlerts: result.safetyAlerts || [],
      };
    } catch (error) {
      console.error("[CDS] AI analysis error:", error);
      return {
        differentialDiagnoses: [],
        recommendedTests: [],
        preventiveCareGaps: [],
        safetyAlerts: [],
      };
    }
  }

  async quickDrugCheck(medications: string[]): Promise<{
    interactions: CDSAnalysisResult["drugInteractions"];
    safeCount: number;
    totalChecked: number;
  }> {
    const interactions = this.checkDrugInteractions(medications);
    const totalPairs = (medications.length * (medications.length - 1)) / 2;
    return {
      interactions,
      safeCount: totalPairs - interactions.length,
      totalChecked: totalPairs,
    };
  }

  async getPreventiveCareRecommendations(patientId: string): Promise<CDSAnalysisResult["preventiveCareGaps"]> {
    const result = await this.analyzePatient({
      patientId,
      context: "general",
    });
    return result.preventiveCareGaps;
  }

  async performRiskStratification(patientId: string): Promise<RiskStratificationResult> {
    const patientData = await this.gatherPatientData(patientId);
    const riskProfiles: RiskProfile[] = [];

    const conditionNames = patientData.conditions.map(c => (c.title || "").toLowerCase());
    const medNames = patientData.activeMedications.map(m => (m.medicationName || "").toLowerCase());
    const labMap = new Map<string, { value: string; date: Date }>();
    for (const lab of patientData.recentLabs) {
      const key = (lab.title || "").toLowerCase();
      if (!labMap.has(key)) {
        labMap.set(key, { value: lab.summary || "", date: new Date(lab.date) });
      }
    }

    const age = patientData.demographics.age;
    const gender = (patientData.demographics.gender || "").toLowerCase();

    riskProfiles.push(this.assessDiabetesRisk(age, gender, conditionNames, medNames, labMap));
    riskProfiles.push(this.assessCardiovascularRisk(age, gender, conditionNames, medNames, labMap));
    riskProfiles.push(this.assessCKDRisk(age, gender, conditionNames, medNames, labMap));
    riskProfiles.push(this.assessCOPDRisk(age, gender, conditionNames, medNames, labMap));
    riskProfiles.push(this.assessDepressionRisk(age, gender, conditionNames, medNames, labMap));
    riskProfiles.push(this.assessOsteoporosisRisk(age, gender, conditionNames, medNames, labMap));

    let aiEnrichedProfiles = riskProfiles;
    try {
      aiEnrichedProfiles = await this.enrichRiskWithAI(patientData, riskProfiles);
    } catch (e) {
      console.error("[CDS] AI risk enrichment failed, using rule-based only:", e);
    }

    const overallRisk = this.calculateOverallRisk(aiEnrichedProfiles);

    return {
      patientId,
      generatedAt: new Date().toISOString(),
      overallRiskLevel: overallRisk,
      riskProfiles: aiEnrichedProfiles,
      modelVersion: "1.0.0",
      disclaimer: "RISK STRATIFICATION NOTICE: These risk scores are generated using evidence-based algorithms combined with AI analysis. They are intended to support clinical decision-making and do not constitute diagnoses. All risk assessments must be validated by a licensed healthcare provider.",
    };
  }

  private assessDiabetesRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (age && age >= 45) { score += 15; factors.push({ factor: "Age >= 45", weight: 15, present: true, category: "demographic" }); }
    if (age && age >= 65) { score += 10; factors.push({ factor: "Age >= 65", weight: 10, present: true, category: "demographic" }); }

    const prediabetes = conditions.some(c => /prediabet|impaired.*glucose|glucose.*intolerance/i.test(c));
    if (prediabetes) { score += 25; factors.push({ factor: "Prediabetes/Impaired glucose tolerance", weight: 25, present: true, category: "clinical" }); }

    const obesity = conditions.some(c => /obes|bmi.*3[0-9]|bmi.*4[0-9]/i.test(c));
    if (obesity) { score += 20; factors.push({ factor: "Obesity (BMI >= 30)", weight: 20, present: true, category: "clinical" }); }

    const hypertension = conditions.some(c => /hypertens|high.*blood.*press/i.test(c));
    if (hypertension) { score += 10; factors.push({ factor: "Hypertension", weight: 10, present: true, category: "clinical" }); }

    const dyslipidemia = conditions.some(c => /dyslipid|hyperlipid|high.*cholesterol/i.test(c));
    if (dyslipidemia) { score += 10; factors.push({ factor: "Dyslipidemia", weight: 10, present: true, category: "clinical" }); }

    const pcos = conditions.some(c => /polycystic.*ovar|pcos/i.test(c));
    if (pcos) { score += 10; factors.push({ factor: "PCOS", weight: 10, present: true, category: "clinical" }); }

    const a1cEntry = labs.get("hemoglobin a1c") || labs.get("hba1c") || labs.get("a1c");
    if (a1cEntry) {
      const val = parseFloat(a1cEntry.value);
      if (!isNaN(val) && val >= 5.7 && val < 6.5) { score += 20; factors.push({ factor: `A1C ${val}% (prediabetic range)`, weight: 20, present: true, category: "lab" }); }
      if (!isNaN(val) && val >= 6.5) { score += 30; factors.push({ factor: `A1C ${val}% (diabetic range)`, weight: 30, present: true, category: "lab" }); }
    }

    const fbg = labs.get("fasting glucose") || labs.get("glucose, fasting") || labs.get("fasting blood glucose");
    if (fbg) {
      const val = parseFloat(fbg.value);
      if (!isNaN(val) && val >= 100 && val < 126) { score += 15; factors.push({ factor: `Fasting glucose ${val} mg/dL (impaired)`, weight: 15, present: true, category: "lab" }); }
      if (!isNaN(val) && val >= 126) { score += 25; factors.push({ factor: `Fasting glucose ${val} mg/dL (diabetic range)`, weight: 25, present: true, category: "lab" }); }
    }

    const corticosteroids = meds.some(m => /prednisone|dexamethasone|prednisolone|hydrocortisone|methylprednisolone/i.test(m));
    if (corticosteroids) { score += 10; factors.push({ factor: "Corticosteroid use", weight: 10, present: true, category: "medication" }); }

    const normalizedScore = Math.min(score, 100);

    return {
      conditionName: "Type 2 Diabetes Mellitus",
      icd10Code: "E11",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 12), upper: Math.min(100, normalizedScore + 12) },
      factors: factors.filter(f => f.present),
      timeHorizon: "5-year",
      recommendations: this.getDiabetesRecommendations(normalizedScore, factors),
      lastAssessed: new Date().toISOString(),
    };
  }

  private getDiabetesRecommendations(score: number, factors: RiskFactor[]): string[] {
    const recs: string[] = [];
    if (score >= 60) {
      recs.push("Order A1C and fasting glucose if not recently done");
      recs.push("Consider referral to endocrinology");
      recs.push("Initiate diabetes prevention program (DPP) referral");
      recs.push("Schedule comprehensive metabolic panel");
    } else if (score >= 30) {
      recs.push("Annual A1C screening recommended");
      recs.push("Lifestyle modification counseling: diet and exercise");
      recs.push("Monitor weight and BMI trends");
    } else {
      recs.push("Continue routine screening per USPSTF guidelines");
      recs.push("Promote healthy lifestyle and weight management");
    }
    return recs;
  }

  private assessCardiovascularRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (age && gender === "male" && age >= 45) { score += 15; factors.push({ factor: "Male age >= 45", weight: 15, present: true, category: "demographic" }); }
    if (age && gender === "female" && age >= 55) { score += 15; factors.push({ factor: "Female age >= 55", weight: 15, present: true, category: "demographic" }); }

    const hypertension = conditions.some(c => /hypertens|high.*blood.*press/i.test(c));
    if (hypertension) { score += 20; factors.push({ factor: "Hypertension", weight: 20, present: true, category: "clinical" }); }

    const diabetes = conditions.some(c => /diabet/i.test(c));
    if (diabetes) { score += 20; factors.push({ factor: "Diabetes mellitus", weight: 20, present: true, category: "clinical" }); }

    const smoking = conditions.some(c => /smok|tobacco|nicotine/i.test(c));
    if (smoking) { score += 15; factors.push({ factor: "Tobacco use", weight: 15, present: true, category: "behavioral" }); }

    const dyslipidemia = conditions.some(c => /dyslipid|hyperlipid|high.*cholesterol|hypercholesterol/i.test(c));
    if (dyslipidemia) { score += 15; factors.push({ factor: "Dyslipidemia", weight: 15, present: true, category: "clinical" }); }

    const obesity = conditions.some(c => /obes/i.test(c));
    if (obesity) { score += 10; factors.push({ factor: "Obesity", weight: 10, present: true, category: "clinical" }); }

    const familyHx = conditions.some(c => /family.*history.*heart|family.*history.*coronary|family.*history.*cardiovascular/i.test(c));
    if (familyHx) { score += 15; factors.push({ factor: "Family history of CVD", weight: 15, present: true, category: "family_history" }); }

    const ckd = conditions.some(c => /chronic.*kidney|ckd|renal.*insufficiency/i.test(c));
    if (ckd) { score += 10; factors.push({ factor: "Chronic kidney disease", weight: 10, present: true, category: "clinical" }); }

    const ldl = labs.get("ldl cholesterol") || labs.get("ldl") || labs.get("ldl-c");
    if (ldl) {
      const val = parseFloat(ldl.value);
      if (!isNaN(val) && val >= 160) { score += 15; factors.push({ factor: `LDL ${val} mg/dL (elevated)`, weight: 15, present: true, category: "lab" }); }
      else if (!isNaN(val) && val >= 130) { score += 10; factors.push({ factor: `LDL ${val} mg/dL (borderline high)`, weight: 10, present: true, category: "lab" }); }
    }

    const hdl = labs.get("hdl cholesterol") || labs.get("hdl") || labs.get("hdl-c");
    if (hdl) {
      const val = parseFloat(hdl.value);
      if (!isNaN(val) && val < 40) { score += 10; factors.push({ factor: `HDL ${val} mg/dL (low)`, weight: 10, present: true, category: "lab" }); }
    }

    const crp = labs.get("c-reactive protein") || labs.get("crp") || labs.get("hs-crp");
    if (crp) {
      const val = parseFloat(crp.value);
      if (!isNaN(val) && val > 3) { score += 10; factors.push({ factor: `CRP ${val} mg/L (elevated)`, weight: 10, present: true, category: "lab" }); }
    }

    const normalizedScore = Math.min(score, 100);
    return {
      conditionName: "Cardiovascular Disease",
      icd10Code: "I25.10",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 10), upper: Math.min(100, normalizedScore + 10) },
      factors: factors.filter(f => f.present),
      timeHorizon: "10-year",
      recommendations: normalizedScore >= 60
        ? ["Consider statin therapy evaluation", "Order lipid panel if not recent", "Cardiology referral for ASCVD risk assessment", "Blood pressure optimization review"]
        : normalizedScore >= 30
        ? ["Annual lipid panel screening", "Lifestyle modification: Mediterranean diet, regular exercise", "Blood pressure monitoring"]
        : ["Maintain healthy lifestyle", "Routine cardiovascular screening per guidelines"],
      lastAssessed: new Date().toISOString(),
    };
  }

  private assessCKDRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (age && age >= 60) { score += 15; factors.push({ factor: "Age >= 60", weight: 15, present: true, category: "demographic" }); }

    const diabetes = conditions.some(c => /diabet/i.test(c));
    if (diabetes) { score += 25; factors.push({ factor: "Diabetes mellitus", weight: 25, present: true, category: "clinical" }); }

    const hypertension = conditions.some(c => /hypertens/i.test(c));
    if (hypertension) { score += 20; factors.push({ factor: "Hypertension", weight: 20, present: true, category: "clinical" }); }

    const familyHx = conditions.some(c => /family.*history.*kidney|family.*history.*renal/i.test(c));
    if (familyHx) { score += 10; factors.push({ factor: "Family history of kidney disease", weight: 10, present: true, category: "family_history" }); }

    const nsaids = meds.some(m => /ibuprofen|naproxen|nsaid|diclofenac|meloxicam|celecoxib/i.test(m));
    if (nsaids) { score += 10; factors.push({ factor: "Chronic NSAID use", weight: 10, present: true, category: "medication" }); }

    const gfr = labs.get("egfr") || labs.get("glomerular filtration rate") || labs.get("gfr");
    if (gfr) {
      const val = parseFloat(gfr.value);
      if (!isNaN(val) && val < 60) { score += 30; factors.push({ factor: `eGFR ${val} mL/min (reduced)`, weight: 30, present: true, category: "lab" }); }
      else if (!isNaN(val) && val < 90) { score += 10; factors.push({ factor: `eGFR ${val} mL/min (mildly reduced)`, weight: 10, present: true, category: "lab" }); }
    }

    const creatinine = labs.get("creatinine") || labs.get("serum creatinine");
    if (creatinine) {
      const val = parseFloat(creatinine.value);
      if (!isNaN(val) && val > 1.3) { score += 15; factors.push({ factor: `Creatinine ${val} mg/dL (elevated)`, weight: 15, present: true, category: "lab" }); }
    }

    const normalizedScore = Math.min(score, 100);
    return {
      conditionName: "Chronic Kidney Disease",
      icd10Code: "N18.9",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 10), upper: Math.min(100, normalizedScore + 10) },
      factors: factors.filter(f => f.present),
      timeHorizon: "5-year",
      recommendations: normalizedScore >= 60
        ? ["Nephrology referral", "Order comprehensive metabolic panel and urinalysis", "Review and minimize nephrotoxic medications", "Monitor eGFR quarterly"]
        : normalizedScore >= 30
        ? ["Annual eGFR and urine albumin-creatinine ratio", "Blood pressure optimization", "Avoid nephrotoxic agents when possible"]
        : ["Routine screening per guidelines", "Maintain adequate hydration"],
      lastAssessed: new Date().toISOString(),
    };
  }

  private assessCOPDRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (age && age >= 40) { score += 10; factors.push({ factor: "Age >= 40", weight: 10, present: true, category: "demographic" }); }

    const smoking = conditions.some(c => /smok|tobacco|nicotine/i.test(c));
    if (smoking) { score += 30; factors.push({ factor: "Tobacco use/history", weight: 30, present: true, category: "behavioral" }); }

    const asthma = conditions.some(c => /asthma/i.test(c));
    if (asthma) { score += 15; factors.push({ factor: "Asthma history", weight: 15, present: true, category: "clinical" }); }

    const occupational = conditions.some(c => /occupational.*exposure|dust.*exposure|chemical.*exposure/i.test(c));
    if (occupational) { score += 15; factors.push({ factor: "Occupational exposure", weight: 15, present: true, category: "environmental" }); }

    const frequentInfections = conditions.some(c => /recurrent.*respiratory|frequent.*bronchitis|pneumonia/i.test(c));
    if (frequentInfections) { score += 10; factors.push({ factor: "Recurrent respiratory infections", weight: 10, present: true, category: "clinical" }); }

    const normalizedScore = Math.min(score, 100);
    return {
      conditionName: "Chronic Obstructive Pulmonary Disease",
      icd10Code: "J44.9",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 15), upper: Math.min(100, normalizedScore + 15) },
      factors: factors.filter(f => f.present),
      timeHorizon: "10-year",
      recommendations: normalizedScore >= 60
        ? ["Pulmonary function testing (spirometry)", "Smoking cessation program referral", "Pulmonology consultation", "Annual flu and pneumococcal vaccination"]
        : normalizedScore >= 30
        ? ["Consider spirometry screening", "Smoking cessation counseling", "Monitor respiratory symptoms"]
        : ["Avoid smoking and secondhand smoke", "Routine health maintenance"],
      lastAssessed: new Date().toISOString(),
    };
  }

  private assessDepressionRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (gender === "female") { score += 10; factors.push({ factor: "Female sex", weight: 10, present: true, category: "demographic" }); }

    const chronicPain = conditions.some(c => /chronic.*pain|fibromyalgia|back.*pain/i.test(c));
    if (chronicPain) { score += 15; factors.push({ factor: "Chronic pain condition", weight: 15, present: true, category: "clinical" }); }

    const substanceUse = conditions.some(c => /substance.*use|alcohol.*use.*disorder|alcohol.*depend/i.test(c));
    if (substanceUse) { score += 20; factors.push({ factor: "Substance use disorder", weight: 20, present: true, category: "behavioral" }); }

    const chronicIllness = conditions.some(c => /diabet|heart.*failure|cancer|copd|chronic.*kidney|multiple.*sclerosis|parkinson/i.test(c));
    if (chronicIllness) { score += 15; factors.push({ factor: "Chronic illness", weight: 15, present: true, category: "clinical" }); }

    const anxiety = conditions.some(c => /anxiety|generalized.*anxiety|panic/i.test(c));
    if (anxiety) { score += 20; factors.push({ factor: "Anxiety disorder", weight: 20, present: true, category: "clinical" }); }

    const insomnia = conditions.some(c => /insomnia|sleep.*disorder/i.test(c));
    if (insomnia) { score += 10; factors.push({ factor: "Sleep disorder/insomnia", weight: 10, present: true, category: "clinical" }); }

    const socialIsolation = conditions.some(c => /social.*isolation|loneliness/i.test(c));
    if (socialIsolation) { score += 15; factors.push({ factor: "Social isolation", weight: 15, present: true, category: "social" }); }

    const thyroid = labs.get("tsh") || labs.get("thyroid stimulating hormone");
    if (thyroid) {
      const val = parseFloat(thyroid.value);
      if (!isNaN(val) && (val > 4.5 || val < 0.4)) { score += 10; factors.push({ factor: `TSH ${val} (abnormal)`, weight: 10, present: true, category: "lab" }); }
    }

    const normalizedScore = Math.min(score, 100);
    return {
      conditionName: "Major Depressive Disorder",
      icd10Code: "F32.9",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 12), upper: Math.min(100, normalizedScore + 12) },
      factors: factors.filter(f => f.present),
      timeHorizon: "1-year",
      recommendations: normalizedScore >= 60
        ? ["Administer PHQ-9 screening tool", "Psychiatric/psychology referral", "Evaluate for thyroid dysfunction if not recently checked", "Safety assessment for suicidal ideation"]
        : normalizedScore >= 30
        ? ["Annual PHQ-2/PHQ-9 screening", "Discuss mental health resources", "Monitor for worsening symptoms"]
        : ["Routine mental health screening per USPSTF", "Promote stress management and social engagement"],
      lastAssessed: new Date().toISOString(),
    };
  }

  private assessOsteoporosisRisk(
    age: number | undefined,
    gender: string,
    conditions: string[],
    meds: string[],
    labs: Map<string, { value: string; date: Date }>
  ): RiskProfile {
    let score = 0;
    const factors: RiskFactor[] = [];

    if (gender === "female" && age && age >= 65) { score += 25; factors.push({ factor: "Female age >= 65", weight: 25, present: true, category: "demographic" }); }
    if (gender === "female" && age && age >= 50) { score += 10; factors.push({ factor: "Postmenopausal female", weight: 10, present: true, category: "demographic" }); }
    if (gender === "male" && age && age >= 70) { score += 20; factors.push({ factor: "Male age >= 70", weight: 20, present: true, category: "demographic" }); }

    const corticosteroids = meds.some(m => /prednisone|dexamethasone|prednisolone|methylprednisolone/i.test(m));
    if (corticosteroids) { score += 20; factors.push({ factor: "Long-term corticosteroid use", weight: 20, present: true, category: "medication" }); }

    const lowBMI = conditions.some(c => /underweight|low.*bmi|bmi.*1[0-8]/i.test(c));
    if (lowBMI) { score += 15; factors.push({ factor: "Low body weight/BMI", weight: 15, present: true, category: "clinical" }); }

    const fracture = conditions.some(c => /fracture|fragility/i.test(c));
    if (fracture) { score += 20; factors.push({ factor: "Prior fragility fracture", weight: 20, present: true, category: "clinical" }); }

    const vitD = labs.get("vitamin d") || labs.get("25-hydroxy vitamin d") || labs.get("vitamin d, 25-oh");
    if (vitD) {
      const val = parseFloat(vitD.value);
      if (!isNaN(val) && val < 20) { score += 15; factors.push({ factor: `Vitamin D ${val} ng/mL (deficient)`, weight: 15, present: true, category: "lab" }); }
    }

    const normalizedScore = Math.min(score, 100);
    return {
      conditionName: "Osteoporosis",
      icd10Code: "M81.0",
      riskLevel: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "moderate" : "low",
      riskScore: normalizedScore,
      confidenceInterval: { lower: Math.max(0, normalizedScore - 12), upper: Math.min(100, normalizedScore + 12) },
      factors: factors.filter(f => f.present),
      timeHorizon: "10-year",
      recommendations: normalizedScore >= 60
        ? ["Order DEXA bone density scan", "Calcium and Vitamin D supplementation evaluation", "Fall risk assessment", "Endocrinology referral for treatment evaluation"]
        : normalizedScore >= 30
        ? ["Consider DEXA screening", "Ensure adequate calcium and Vitamin D intake", "Weight-bearing exercise recommendation"]
        : ["Maintain adequate calcium and Vitamin D", "Regular weight-bearing exercise"],
      lastAssessed: new Date().toISOString(),
    };
  }

  private async enrichRiskWithAI(
    patientData: Awaited<ReturnType<typeof this.gatherPatientData>>,
    riskProfiles: RiskProfile[]
  ): Promise<RiskProfile[]> {
    const prompt = `You are a clinical risk stratification system. Review the following patient data and rule-based risk assessments. For each condition, provide an "aiAdjustment" (integer from -15 to +15 adjusting the score based on contextual factors the rules may miss) and an "aiRationale" (brief explanation of the adjustment).

PATIENT:
- Age: ${patientData.demographics.age || "Unknown"}
- Gender: ${patientData.demographics.gender || "Unknown"}
- Conditions: ${patientData.conditions.map(c => c.title).join(", ") || "None"}
- Medications: ${patientData.activeMedications.map(m => m.medicationName).join(", ") || "None"}
- Recent Labs: ${patientData.recentLabs.slice(0, 10).map(l => `${l.title}: ${l.summary}`).join("; ") || "None"}

CURRENT RISK ASSESSMENTS:
${riskProfiles.map(r => `- ${r.conditionName}: Score ${r.riskScore}/100 (${r.riskLevel}), Factors: ${r.factors.map(f => f.factor).join(", ") || "None"}`).join("\n")}

Return JSON with "adjustments" array, one per condition: { "conditionName": string, "aiAdjustment": number (-15 to +15), "aiRationale": string, "additionalRecommendations": string[] }`;

    const response = await chatComplete({
      model: "deep",
      maxOutputTokens: 2000,
      messages: [
        { role: "system", content: "You are a clinical risk stratification system. Return valid JSON only. Be conservative with adjustments." },
        { role: "user", content: prompt },
      ],
      jsonMode: true,
      dataCategories: ["demographics", "conditions", "medications", "lab_results"],
      purpose: "clinical_decision_support",
      callerService: "clinical-decision-support-service",
      callerMethod: "enrichRiskWithAI",
    });

    const result = JSON.parse(response.content || "{}");
    const adjustments = result.adjustments || [];

    return riskProfiles.map(profile => {
      const adj = adjustments.find((a: any) => a.conditionName === profile.conditionName);
      if (adj) {
        const adjustedScore = Math.max(0, Math.min(100, profile.riskScore + (adj.aiAdjustment || 0)));
        return {
          ...profile,
          riskScore: adjustedScore,
          riskLevel: adjustedScore >= 60 ? "high" as const : adjustedScore >= 30 ? "moderate" as const : "low" as const,
          aiRationale: adj.aiRationale,
          recommendations: [...profile.recommendations, ...(adj.additionalRecommendations || [])],
        };
      }
      return profile;
    });
  }

  private calculateOverallRisk(profiles: RiskProfile[]): "high" | "moderate" | "low" {
    const highCount = profiles.filter(p => p.riskLevel === "high").length;
    const modCount = profiles.filter(p => p.riskLevel === "moderate").length;
    if (highCount >= 2) return "high";
    if (highCount >= 1 || modCount >= 3) return "moderate";
    return "low";
  }

  async getScreeningAlerts(patientId: string): Promise<ScreeningAlertsResult> {
    const patientData = await this.gatherPatientData(patientId);
    const age = patientData.demographics.age;
    const gender = (patientData.demographics.gender || "").toLowerCase();
    const conditionNames = patientData.conditions.map(c => (c.title || "").toLowerCase());
    const immunizationNames = patientData.immunizations.map(i => (i.title || "").toLowerCase());
    const immunizationDates = patientData.immunizations.map(i => ({ name: (i.title || "").toLowerCase(), date: new Date(i.date) }));
    const labDates = patientData.recentLabs.map(l => ({ name: (l.title || "").toLowerCase(), date: new Date(l.date) }));

    const screeningAlerts: ScreeningAlert[] = [];
    const vaccinationAlerts: VaccinationAlert[] = [];

    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());

    if (age && age >= 50 && age <= 75) {
      const colonoscopy = labDates.find(l => /colonoscopy/i.test(l.name));
      const fitTest = labDates.find(l => /fit|fecal.*immuno|fobt|stool.*dna|cologuard/i.test(l.name));
      const lastScreening = colonoscopy?.date || fitTest?.date;
      const isOverdue = !lastScreening || (colonoscopy && colonoscopy.date < tenYearsAgo) || (fitTest && fitTest.date < oneYearAgo);
      screeningAlerts.push({
        id: `scr-colorectal-${patientId}`,
        screeningType: "Colorectal Cancer Screening",
        guidelineSource: "USPSTF 2021",
        recommendedFrequency: "Colonoscopy every 10 years, or FIT annually",
        ageRange: "45-75",
        applicableGender: "all",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: lastScreening?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "high" : "low",
        recommendation: isOverdue ? "Colorectal cancer screening is overdue. Order colonoscopy or annual FIT test." : "Colorectal screening is current.",
        icd10Code: "Z12.11",
        loincCode: "77353-1",
      });
    }

    if (gender === "female" && age && age >= 21 && age <= 65) {
      const papSmear = labDates.find(l => /pap|cervical.*cytology|pap.*smear/i.test(l.name));
      const hpvTest = labDates.find(l => /hpv|human.*papillomavirus/i.test(l.name));
      const intervalYears = age < 30 ? 3 : 5;
      const cutoff = new Date(now.getFullYear() - intervalYears, now.getMonth(), now.getDate());
      const lastPerformed = papSmear?.date || hpvTest?.date;
      const isOverdue = !lastPerformed || lastPerformed < cutoff;
      screeningAlerts.push({
        id: `scr-cervical-${patientId}`,
        screeningType: "Cervical Cancer Screening",
        guidelineSource: "USPSTF 2018",
        recommendedFrequency: age < 30 ? "Pap smear every 3 years" : "Pap + HPV co-testing every 5 years",
        ageRange: "21-65",
        applicableGender: "female",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: lastPerformed?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "high" : "low",
        recommendation: isOverdue ? "Cervical cancer screening is overdue. Schedule Pap smear" + (age >= 30 ? " with HPV co-testing." : ".") : "Cervical screening is current.",
        icd10Code: "Z12.4",
        loincCode: "10524-7",
      });
    }

    if (gender === "female" && age && age >= 50 && age <= 74) {
      const mammogram = labDates.find(l => /mammogra|breast.*imaging|breast.*screen/i.test(l.name));
      const isOverdue = !mammogram || mammogram.date < twoYearsAgo;
      screeningAlerts.push({
        id: `scr-breast-${patientId}`,
        screeningType: "Breast Cancer Screening",
        guidelineSource: "USPSTF 2024",
        recommendedFrequency: "Mammography every 2 years",
        ageRange: "40-74",
        applicableGender: "female",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: mammogram?.date?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "high" : "low",
        recommendation: isOverdue ? "Breast cancer screening mammogram is overdue." : "Breast screening is current.",
        icd10Code: "Z12.31",
        loincCode: "24606-6",
      });
    }

    if (age && age >= 50 && age <= 80) {
      const smoking = conditionNames.some(c => /smok|tobacco|nicotine/i.test(c));
      if (smoking) {
        const ldct = labDates.find(l => /ldct|low.*dose.*ct|lung.*screen|chest.*ct/i.test(l.name));
        const isOverdue = !ldct || ldct.date < oneYearAgo;
        screeningAlerts.push({
          id: `scr-lung-${patientId}`,
          screeningType: "Lung Cancer Screening",
          guidelineSource: "USPSTF 2021",
          recommendedFrequency: "Annual low-dose CT",
          ageRange: "50-80 (with smoking history)",
          applicableGender: "all",
          status: isOverdue ? "overdue" : "current",
          lastPerformed: ldct?.date?.toISOString() || null,
          nextDue: isOverdue ? "Now" : "On schedule",
          priority: isOverdue ? "high" : "low",
          recommendation: isOverdue ? "Lung cancer screening with low-dose CT is overdue for patient with smoking history." : "Lung screening is current.",
          icd10Code: "Z12.2",
          loincCode: "87278-9",
        });
      }
    }

    if (age && age >= 35) {
      const diabetes = conditionNames.some(c => /diabet/i.test(c));
      const hypertension = conditionNames.some(c => /hypertens/i.test(c));
      const lipidCheck = labDates.find(l => /lipid|cholesterol|ldl|hdl|triglyceride/i.test(l.name));
      const interval = (diabetes || hypertension) ? oneYearAgo : fiveYearsAgo;
      const isOverdue = !lipidCheck || lipidCheck.date < interval;
      screeningAlerts.push({
        id: `scr-lipid-${patientId}`,
        screeningType: "Lipid Panel Screening",
        guidelineSource: "USPSTF / AHA 2019",
        recommendedFrequency: (diabetes || hypertension) ? "Annually" : "Every 5 years",
        ageRange: "35+",
        applicableGender: "all",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: lipidCheck?.date?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "moderate" : "low",
        recommendation: isOverdue ? "Lipid panel screening is overdue." : "Lipid screening is current.",
        icd10Code: "Z13.220",
        loincCode: "57698-3",
      });
    }

    if (age && age >= 45) {
      const diabetesExisting = conditionNames.some(c => /diabet/i.test(c));
      if (!diabetesExisting) {
        const a1c = labDates.find(l => /a1c|hba1c|hemoglobin.*a1c|glucose.*fasting/i.test(l.name));
        const isOverdue = !a1c || a1c.date < threeYearsAgo;
        screeningAlerts.push({
          id: `scr-diabetes-${patientId}`,
          screeningType: "Diabetes Screening",
          guidelineSource: "USPSTF 2021 / ADA 2024",
          recommendedFrequency: "Every 3 years (more frequently if prediabetic)",
          ageRange: "35-70 (overweight/obese) or 45+ (all)",
          applicableGender: "all",
          status: isOverdue ? "overdue" : "current",
          lastPerformed: a1c?.date?.toISOString() || null,
          nextDue: isOverdue ? "Now" : "On schedule",
          priority: isOverdue ? "moderate" : "low",
          recommendation: isOverdue ? "Diabetes screening (A1C or fasting glucose) is overdue." : "Diabetes screening is current.",
          icd10Code: "Z13.1",
          loincCode: "4548-4",
        });
      }
    }

    if (age && age >= 18) {
      const bp = labDates.find(l => /blood.*press|bp.*check|hypertens.*screen/i.test(l.name));
      const vitalBP = patientData.recentVitals.find(v => /blood.*press|bp/i.test(v.title || ""));
      const lastBP = bp?.date || (vitalBP ? new Date(vitalBP.date) : null);
      const isOverdue = !lastBP || lastBP < oneYearAgo;
      screeningAlerts.push({
        id: `scr-bp-${patientId}`,
        screeningType: "Blood Pressure Screening",
        guidelineSource: "USPSTF 2015",
        recommendedFrequency: "At least annually",
        ageRange: "18+",
        applicableGender: "all",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: lastBP?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "moderate" : "low",
        recommendation: isOverdue ? "Annual blood pressure screening is overdue." : "Blood pressure screening is current.",
        icd10Code: "Z13.6",
        loincCode: "85354-9",
      });
    }

    if (age && age >= 12) {
      const phq = labDates.find(l => /phq|depression.*screen|mental.*health.*screen/i.test(l.name));
      const isOverdue = !phq || phq.date < oneYearAgo;
      screeningAlerts.push({
        id: `scr-depression-${patientId}`,
        screeningType: "Depression Screening",
        guidelineSource: "USPSTF 2016",
        recommendedFrequency: "Annually (PHQ-2/PHQ-9)",
        ageRange: "12+",
        applicableGender: "all",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: phq?.date?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "moderate" : "low",
        recommendation: isOverdue ? "Annual depression screening (PHQ-2/PHQ-9) is overdue." : "Depression screening is current.",
        icd10Code: "Z13.31",
        loincCode: "44249-1",
      });
    }

    if (gender === "female" && age && age >= 65) {
      const dexa = labDates.find(l => /dexa|bone.*density|dual.*energy/i.test(l.name));
      const isOverdue = !dexa || dexa.date < fiveYearsAgo;
      screeningAlerts.push({
        id: `scr-osteoporosis-${patientId}`,
        screeningType: "Osteoporosis Screening (DEXA)",
        guidelineSource: "USPSTF 2018",
        recommendedFrequency: "DEXA scan (frequency based on initial results)",
        ageRange: "65+ (women), 70+ (men at risk)",
        applicableGender: "female",
        status: isOverdue ? "overdue" : "current",
        lastPerformed: dexa?.date?.toISOString() || null,
        nextDue: isOverdue ? "Now" : "On schedule",
        priority: isOverdue ? "moderate" : "low",
        recommendation: isOverdue ? "Osteoporosis screening with DEXA is overdue." : "Bone density screening is current.",
        icd10Code: "Z13.820",
        loincCode: "46278-8",
      });
    }

    const hasInfluenza = immunizationDates.some(i => /influenza|flu/i.test(i.name) && i.date >= oneYearAgo);
    if (!hasInfluenza && age && age >= 6) {
      vaccinationAlerts.push({
        id: `vax-flu-${patientId}`,
        vaccineName: "Influenza (Flu)",
        vaccineCode: "CVX-158",
        guidelineSource: "CDC/ACIP 2024-2025",
        status: "overdue",
        lastAdministered: immunizationDates.find(i => /influenza|flu/i.test(i.name))?.date?.toISOString() || null,
        nextDue: "Annual (October-March recommended)",
        ageRange: "6 months+",
        priority: "high",
        recommendation: "Annual influenza vaccination is overdue. Recommend administration before or during flu season.",
        series: { doseNumber: null, totalDoses: 1, isComplete: false },
      });
    }

    if (age && age >= 65) {
      const hasPneumococcal = immunizationNames.some(i => /pneumococcal|prevnar|pneumovax|pcv20|pcv15|ppsv23/i.test(i));
      if (!hasPneumococcal) {
        vaccinationAlerts.push({
          id: `vax-pneumo-${patientId}`,
          vaccineName: "Pneumococcal (PCV20 or PCV15+PPSV23)",
          vaccineCode: "CVX-216",
          guidelineSource: "CDC/ACIP 2024",
          status: "overdue",
          lastAdministered: null,
          nextDue: "Now",
          ageRange: "65+ or 19-64 with risk factors",
          priority: "high",
          recommendation: "Pneumococcal vaccination recommended for patients 65+. PCV20 preferred as single dose.",
          series: { doseNumber: null, totalDoses: 1, isComplete: false },
        });
      }
    }

    if (age && age >= 50) {
      const hasShingles = immunizationNames.some(i => /shingrix|zoster|herpes.*zoster/i.test(i));
      if (!hasShingles) {
        vaccinationAlerts.push({
          id: `vax-shingles-${patientId}`,
          vaccineName: "Shingrix (Recombinant Zoster)",
          vaccineCode: "CVX-187",
          guidelineSource: "CDC/ACIP 2024",
          status: "overdue",
          lastAdministered: null,
          nextDue: "Now (2-dose series)",
          ageRange: "50+",
          priority: "moderate",
          recommendation: "Shingrix vaccination recommended for adults 50+. Two-dose series, 2-6 months apart.",
          series: { doseNumber: 1, totalDoses: 2, isComplete: false },
        });
      }
    }

    const hasTdap = immunizationDates.some(i => /tdap|td.*booster|tetanus/i.test(i.name) && i.date >= tenYearsAgo);
    if (!hasTdap) {
      vaccinationAlerts.push({
        id: `vax-tdap-${patientId}`,
        vaccineName: "Td/Tdap (Tetanus, Diphtheria, Pertussis)",
        vaccineCode: "CVX-115",
        guidelineSource: "CDC/ACIP 2024",
        status: "overdue",
        lastAdministered: immunizationDates.find(i => /tdap|td|tetanus/i.test(i.name))?.date?.toISOString() || null,
        nextDue: "Every 10 years",
        ageRange: "19+",
        priority: "moderate",
        recommendation: "Td/Tdap booster is overdue. Recommend Tdap if not previously received, then Td every 10 years.",
        series: { doseNumber: null, totalDoses: 1, isComplete: false },
      });
    }

    if (age && age >= 19 && age <= 26) {
      const hasHPV = immunizationNames.some(i => /hpv|gardasil|human.*papillomavirus/i.test(i));
      if (!hasHPV) {
        vaccinationAlerts.push({
          id: `vax-hpv-${patientId}`,
          vaccineName: "HPV (Gardasil 9)",
          vaccineCode: "CVX-165",
          guidelineSource: "CDC/ACIP 2024",
          status: "overdue",
          lastAdministered: null,
          nextDue: "Now (2-3 dose series)",
          ageRange: "9-26 (catch-up to 45 with shared decision)",
          priority: "moderate",
          recommendation: "HPV vaccination recommended. Initiate or complete series.",
          series: { doseNumber: 1, totalDoses: 3, isComplete: false },
        });
      }
    }

    const hasCOVID = immunizationDates.some(i => /covid|sars.*cov|moderna|pfizer.*bivalent|novavax/i.test(i.name) && i.date >= oneYearAgo);
    if (!hasCOVID) {
      vaccinationAlerts.push({
        id: `vax-covid-${patientId}`,
        vaccineName: "COVID-19 (Updated 2024-2025)",
        vaccineCode: "CVX-230",
        guidelineSource: "CDC/ACIP 2024-2025",
        status: "due_soon",
        lastAdministered: immunizationDates.find(i => /covid|sars.*cov/i.test(i.name))?.date?.toISOString() || null,
        nextDue: "Annual updated dose recommended",
        ageRange: "6 months+",
        priority: "moderate",
        recommendation: "Updated COVID-19 vaccination recommended annually.",
        series: { doseNumber: null, totalDoses: 1, isComplete: false },
      });
    }

    const overdueScreenings = screeningAlerts.filter(s => s.status === "overdue").length;
    const overdueVaccinations = vaccinationAlerts.filter(v => v.status === "overdue").length;

    return {
      patientId,
      generatedAt: new Date().toISOString(),
      screeningAlerts,
      vaccinationAlerts,
      summary: {
        totalScreenings: screeningAlerts.length,
        overdueScreenings,
        currentScreenings: screeningAlerts.length - overdueScreenings,
        totalVaccinations: vaccinationAlerts.length,
        overdueVaccinations,
        upToDateVaccinations: vaccinationAlerts.filter(v => v.status === "current").length,
      },
      disclaimer: "SCREENING & VACCINATION NOTICE: These recommendations are based on USPSTF, CDC/ACIP, and professional society guidelines. Individual patient circumstances may require deviations from standard recommendations. All screening and vaccination decisions should be made through shared decision-making with the patient.",
    };
  }
}

export interface RiskFactor {
  factor: string;
  weight: number;
  present: boolean;
  category: "demographic" | "clinical" | "behavioral" | "lab" | "medication" | "family_history" | "social" | "environmental";
}

export interface RiskProfile {
  conditionName: string;
  icd10Code: string;
  riskLevel: "high" | "moderate" | "low";
  riskScore: number;
  confidenceInterval: { lower: number; upper: number };
  factors: RiskFactor[];
  timeHorizon: string;
  recommendations: string[];
  aiRationale?: string;
  lastAssessed: string;
}

export interface RiskStratificationResult {
  patientId: string;
  generatedAt: string;
  overallRiskLevel: "high" | "moderate" | "low";
  riskProfiles: RiskProfile[];
  modelVersion: string;
  disclaimer: string;
}

export interface ScreeningAlert {
  id: string;
  screeningType: string;
  guidelineSource: string;
  recommendedFrequency: string;
  ageRange: string;
  applicableGender: string;
  status: "overdue" | "due_soon" | "current";
  lastPerformed: string | null;
  nextDue: string;
  priority: "high" | "moderate" | "low";
  recommendation: string;
  icd10Code: string;
  loincCode: string;
}

export interface VaccinationAlert {
  id: string;
  vaccineName: string;
  vaccineCode: string;
  guidelineSource: string;
  status: "overdue" | "due_soon" | "current";
  lastAdministered: string | null;
  nextDue: string;
  ageRange: string;
  priority: "high" | "moderate" | "low";
  recommendation: string;
  series: {
    doseNumber: number | null;
    totalDoses: number;
    isComplete: boolean;
  };
}

export interface ScreeningAlertsResult {
  patientId: string;
  generatedAt: string;
  screeningAlerts: ScreeningAlert[];
  vaccinationAlerts: VaccinationAlert[];
  summary: {
    totalScreenings: number;
    overdueScreenings: number;
    currentScreenings: number;
    totalVaccinations: number;
    overdueVaccinations: number;
    upToDateVaccinations: number;
  };
  disclaimer: string;
}

export const clinicalDecisionSupportService = new ClinicalDecisionSupportService();
