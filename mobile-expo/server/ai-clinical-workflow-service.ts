import { chatComplete } from "./ai-client";
import crypto from "crypto";

const DISCLAIMER = "AI-generated clinical workflow suggestions. Must be verified by a licensed healthcare provider. Not medical advice.";

export interface PatientWorkflowData {
  patientId: string;
  patientName: string;
  demographics: { age: number; gender: string };
  conditions: Array<{ name: string; status: string; onsetDate?: string; severity?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; startDate?: string }>;
  allergies: Array<{ substance: string; reaction?: string; severity?: string }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string; trend?: string }>;
  labResults: Array<{ name: string; value: number | string; unit: string; referenceRange?: string; date: string; flag?: string }>;
  recentVisits: Array<{ date: string; type: string; provider: string; summary: string }>;
  upcomingAppointments: Array<{ date: string; type: string; provider: string }>;
}

export interface FollowUpSuggestion {
  id: string;
  type: "lab_order" | "appointment" | "referral" | "medication_review" | "screening" | "monitoring";
  priority: "urgent" | "high" | "moderate" | "routine";
  title: string;
  description: string;
  rationale: string;
  suggestedTimeframe: string;
  relatedConditions: string[];
  relatedResults?: string[];
  confidence: number;
  actionItems: string[];
}

export interface ClinicalNoteDraft {
  id: string;
  noteType: "progress_note" | "referral_letter" | "discharge_summary" | "care_plan_update" | "consultation_note";
  title: string;
  sections: Array<{ heading: string; content: string; isEditable: boolean }>;
  summary: string;
  generatedAt: string;
  qualityScore: number;
  warnings: string[];
  disclaimer: string;
}

export interface SmartAlert {
  id: string;
  severity: "critical" | "high" | "moderate" | "low";
  category: "vital_change" | "lab_abnormality" | "medication_concern" | "gap_in_care" | "deterioration_risk" | "overdue_screening";
  title: string;
  description: string;
  affectedMetric?: string;
  currentValue?: string;
  previousValue?: string;
  trend?: "worsening" | "improving" | "stable" | "new";
  recommendedAction: string;
  urgency: string;
  relatedConditions: string[];
  confidence: number;
  acknowledgedAt?: string;
}

export interface WorkflowAnalysisResult {
  followUpSuggestions: FollowUpSuggestion[];
  smartAlerts: SmartAlert[];
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  nextReviewDate: string;
  disclaimer: string;
}

function buildPatientWorkflowPrompt(data: PatientWorkflowData): string {
  let prompt = `PATIENT: ${data.patientName} (ID: ${data.patientId})
DEMOGRAPHICS: Age ${data.demographics.age}, ${data.demographics.gender}

CONDITIONS:
${data.conditions.length > 0 ? data.conditions.map(c => `- ${c.name} (status: ${c.status}${c.severity ? `, severity: ${c.severity}` : ""}${c.onsetDate ? `, onset: ${c.onsetDate}` : ""})`).join("\n") : "None listed"}

MEDICATIONS:
${data.medications.length > 0 ? data.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.startDate ? ` (since ${m.startDate})` : ""}`).join("\n") : "None listed"}

ALLERGIES:
${data.allergies.length > 0 ? data.allergies.map(a => `- ${a.substance}${a.reaction ? ` (reaction: ${a.reaction})` : ""}${a.severity ? ` [${a.severity}]` : ""}`).join("\n") : "NKDA"}

VITALS:
${data.vitals.length > 0 ? data.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})${v.trend ? ` [Trend: ${v.trend}]` : ""}`).join("\n") : "Not available"}

LAB RESULTS:
${data.labResults.length > 0 ? data.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""} (${l.date})${l.flag ? ` [${l.flag}]` : ""}`).join("\n") : "Not available"}

RECENT VISITS:
${data.recentVisits.length > 0 ? data.recentVisits.map(v => `- ${v.date}: ${v.type} with ${v.provider} - ${v.summary}`).join("\n") : "None"}

UPCOMING APPOINTMENTS:
${data.upcomingAppointments.length > 0 ? data.upcomingAppointments.map(a => `- ${a.date}: ${a.type} with ${a.provider}`).join("\n") : "None scheduled"}`;

  return prompt;
}

function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function calculateQualityScore(data: PatientWorkflowData): number {
  let score = 0;
  let total = 0;

  total += 10;
  if (data.patientName) score += 5;
  if (data.demographics.age && data.demographics.gender) score += 5;

  total += 20;
  if (data.conditions.length > 0) score += 20;

  total += 20;
  if (data.medications.length > 0) score += 20;

  total += 10;
  if (data.allergies.length > 0) score += 10;

  total += 15;
  if (data.vitals.length > 0) score += 15;

  total += 15;
  if (data.labResults.length > 0) score += 15;

  total += 10;
  if (data.recentVisits.length > 0) score += 10;

  return Math.round((score / total) * 100);
}

const NOTE_TYPE_SECTIONS: Record<string, string[]> = {
  progress_note: ["Chief Complaint", "History of Present Illness", "Review of Systems", "Physical Examination", "Assessment", "Plan"],
  referral_letter: ["Reason for Referral", "Clinical Summary", "Current Medications", "Relevant Results", "Requested Evaluation"],
  discharge_summary: ["Admission Diagnosis", "Hospital Course", "Procedures Performed", "Discharge Medications", "Discharge Instructions", "Follow-Up Plan"],
  care_plan_update: ["Current Status", "Goals of Care", "Interventions", "Progress Toward Goals", "Updated Plan", "Patient Education"],
  consultation_note: ["Reason for Consultation", "History of Present Illness", "Relevant Past History", "Examination Findings", "Assessment", "Recommendations"],
};

export class AIClinicalWorkflowService {
  private stats = {
    followUpAnalyses: 0,
    noteDraftsGenerated: 0,
    alertAnalyses: 0,
    fullWorkflowAnalyses: 0,
    totalSuggestions: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
  };

  async generateFollowUpSuggestions(patientData: PatientWorkflowData): Promise<{ suggestions: FollowUpSuggestion[]; disclaimer: string }> {
    console.log(`[ClinicalWorkflow] Generating follow-up suggestions for patient ${patientData.patientId}`);

    const systemPrompt = `You are an expert clinical workflow AI assistant. Analyze the patient data and generate actionable follow-up task suggestions. Consider:

1. Recent lab results that need follow-up or repeat testing
2. Active conditions requiring ongoing monitoring
3. Medication reviews based on duration of therapy or side effect profiles
4. Preventive care screenings due based on age, gender, and risk factors
5. Specialist referrals based on clinical findings
6. Gaps in care or overdue assessments

For each suggestion, provide:
- type: lab_order, appointment, referral, medication_review, screening, or monitoring
- priority: urgent, high, moderate, or routine
- A clear title and description
- Clinical rationale
- Suggested timeframe for completion
- Related conditions and results
- Confidence score (0-100)
- Specific action items

Respond in JSON:
{
  "suggestions": [
    {
      "type": "lab_order|appointment|referral|medication_review|screening|monitoring",
      "priority": "urgent|high|moderate|routine",
      "title": "Clear action title",
      "description": "Detailed description of the follow-up task",
      "rationale": "Clinical reasoning for this suggestion",
      "suggestedTimeframe": "Within 1 week",
      "relatedConditions": ["condition1"],
      "relatedResults": ["result1"],
      "confidence": 85,
      "actionItems": ["Step 1", "Step 2"]
    }
  ]
}`;

    const userPrompt = `Generate follow-up suggestions for the following patient:\n\n${buildPatientWorkflowPrompt(patientData)}`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals"],
      purpose: "clinical_decision_support",
      callerService: "ai-clinical-workflow-service",
      callerMethod: "generateFollowUpSuggestions",
    });

    const content = response.content;
    if (!content) {
      throw new Error("[ClinicalWorkflow] No response from AI for follow-up suggestions");
    }

    const parsed = JSON.parse(content);
    const aiSuggestions: FollowUpSuggestion[] = (parsed.suggestions || []).map((s: any) => ({
      id: crypto.randomUUID(),
      type: s.type || "monitoring",
      priority: s.priority || "routine",
      title: s.title || "",
      description: s.description || "",
      rationale: s.rationale || "",
      suggestedTimeframe: s.suggestedTimeframe || "",
      relatedConditions: s.relatedConditions || [],
      relatedResults: s.relatedResults || [],
      confidence: s.confidence || 0,
      actionItems: s.actionItems || [],
    }));

    const ruleBasedSuggestions = this.generateRuleBasedSuggestions(patientData);

    const existingTitles = new Set(aiSuggestions.map(s => s.title.toLowerCase()));
    const uniqueRuleBased = ruleBasedSuggestions.filter(s => !existingTitles.has(s.title.toLowerCase()));

    const allSuggestions = [...aiSuggestions, ...uniqueRuleBased];

    this.stats.followUpAnalyses++;
    this.stats.totalSuggestions += allSuggestions.length;

    console.log(`[ClinicalWorkflow] Generated ${allSuggestions.length} follow-up suggestions (${aiSuggestions.length} AI + ${uniqueRuleBased.length} rule-based)`);

    return {
      suggestions: allSuggestions,
      disclaimer: DISCLAIMER,
    };
  }

  private generateRuleBasedSuggestions(patientData: PatientWorkflowData): FollowUpSuggestion[] {
    const suggestions: FollowUpSuggestion[] = [];
    const now = new Date().toISOString();

    const hasDiabetes = patientData.conditions.some(c =>
      c.name.toLowerCase().includes("diabetes") && c.status === "active"
    );
    if (hasDiabetes) {
      const lastHbA1c = patientData.labResults
        .filter(l => l.name.toLowerCase().includes("hba1c") || l.name.toLowerCase().includes("hemoglobin a1c"))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (!lastHbA1c || daysBetween(lastHbA1c.date, now) > 90) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: "lab_order",
          priority: "high",
          title: "Schedule HbA1c follow-up for diabetes monitoring",
          description: lastHbA1c
            ? `Last HbA1c was ${lastHbA1c.value} ${lastHbA1c.unit} on ${lastHbA1c.date}. Due for repeat testing per ADA guidelines (every 3 months).`
            : "No HbA1c on record. Order baseline HbA1c for diabetes management.",
          rationale: "ADA recommends HbA1c testing every 3 months for patients with diabetes to assess glycemic control.",
          suggestedTimeframe: "Within 2 weeks",
          relatedConditions: ["Diabetes"],
          relatedResults: lastHbA1c ? [lastHbA1c.name] : [],
          confidence: 95,
          actionItems: ["Order HbA1c lab test", "Schedule follow-up to review results", "Assess need for medication adjustment"],
        });
      }
    }

    const onStatins = patientData.medications.some(m => {
      const name = m.name.toLowerCase();
      return name.includes("statin") || name.includes("atorvastatin") || name.includes("simvastatin") ||
        name.includes("rosuvastatin") || name.includes("pravastatin") || name.includes("lovastatin") ||
        name.includes("fluvastatin") || name.includes("pitavastatin");
    });
    if (onStatins) {
      const lastLipid = patientData.labResults
        .filter(l => {
          const name = l.name.toLowerCase();
          return name.includes("lipid") || name.includes("cholesterol") || name.includes("ldl") || name.includes("triglyceride");
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (!lastLipid || daysBetween(lastLipid.date, now) > 180) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: "lab_order",
          priority: "moderate",
          title: "Lipid panel due for statin therapy monitoring",
          description: lastLipid
            ? `Last lipid panel on ${lastLipid.date}. Due for repeat testing to assess statin efficacy.`
            : "No lipid panel on record. Order baseline lipid panel for statin therapy monitoring.",
          rationale: "ACC/AHA guidelines recommend fasting lipid panel 4-12 weeks after initiation or dose adjustment, then every 3-12 months.",
          suggestedTimeframe: "Within 4 weeks",
          relatedConditions: ["Dyslipidemia", "Cardiovascular risk"],
          relatedResults: lastLipid ? [lastLipid.name] : [],
          confidence: 90,
          actionItems: ["Order fasting lipid panel", "Review statin dose adequacy", "Assess LDL goal attainment"],
        });
      }
    }

    const hasHypertension = patientData.conditions.some(c =>
      c.name.toLowerCase().includes("hypertension") && c.status === "active"
    );
    if (hasHypertension) {
      const lastBMP = patientData.labResults
        .filter(l => {
          const name = l.name.toLowerCase();
          return name.includes("bmp") || name.includes("creatinine") || name.includes("potassium") || name.includes("sodium");
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (!lastBMP || daysBetween(lastBMP.date, now) > 180) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: "lab_order",
          priority: "moderate",
          title: "Basic metabolic panel due for hypertension monitoring",
          description: "Electrolytes and renal function monitoring recommended for patients on antihypertensive therapy.",
          rationale: "Regular BMP monitoring is essential to detect electrolyte imbalances and renal function changes associated with antihypertensive medications.",
          suggestedTimeframe: "Within 4 weeks",
          relatedConditions: ["Hypertension"],
          relatedResults: lastBMP ? [lastBMP.name] : [],
          confidence: 85,
          actionItems: ["Order BMP", "Review renal function trend", "Assess electrolyte balance"],
        });
      }
    }

    if (patientData.demographics.age >= 50) {
      const hasColonoscopy = patientData.recentVisits.some(v =>
        v.summary.toLowerCase().includes("colonoscopy") || v.type.toLowerCase().includes("colonoscopy")
      );
      if (!hasColonoscopy) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: "screening",
          priority: "routine",
          title: "Colorectal cancer screening assessment",
          description: "Patient is age 50+ and may be due for colorectal cancer screening per USPSTF guidelines.",
          rationale: "USPSTF recommends colorectal cancer screening for adults aged 45-75. Verify screening history and schedule if overdue.",
          suggestedTimeframe: "Within 3 months",
          relatedConditions: [],
          confidence: 70,
          actionItems: ["Verify colorectal screening history", "Discuss screening options with patient", "Schedule colonoscopy or order stool-based test if appropriate"],
        });
      }
    }

    return suggestions;
  }

  async generateClinicalNoteDraft(patientData: PatientWorkflowData, noteType: string, additionalContext?: string): Promise<ClinicalNoteDraft> {
    console.log(`[ClinicalWorkflow] Generating ${noteType} draft for patient ${patientData.patientId}`);

    const sections = NOTE_TYPE_SECTIONS[noteType] || NOTE_TYPE_SECTIONS["progress_note"];
    const sectionsList = sections.join(", ");

    const systemPrompt = `You are an expert clinical documentation AI assistant. Generate a comprehensive ${noteType.replace(/_/g, " ")} for the patient.

Required sections: ${sectionsList}

For each section, provide detailed, clinically appropriate content based on the patient data. Use professional medical terminology while maintaining clarity.

Respond in JSON:
{
  "title": "Document title",
  "sections": [
    { "heading": "Section heading", "content": "Detailed section content" }
  ],
  "summary": "Brief clinical summary of the note",
  "warnings": ["Any clinical warnings or concerns identified"]
}`;

    const userPrompt = `Generate a ${noteType.replace(/_/g, " ")} for the following patient:\n\n${buildPatientWorkflowPrompt(patientData)}${additionalContext ? `\n\nADDITIONAL CONTEXT:\n${additionalContext}` : ""}`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals", "clinical_notes"],
      purpose: "documentation",
      callerService: "ai-clinical-workflow-service",
      callerMethod: "generateClinicalNoteDraft",
    });

    const content = response.content;
    if (!content) {
      throw new Error("[ClinicalWorkflow] No response from AI for clinical note draft");
    }

    const parsed = JSON.parse(content);

    const qualityScore = calculateQualityScore(patientData);

    this.stats.noteDraftsGenerated++;

    console.log(`[ClinicalWorkflow] Clinical note draft generated: ${parsed.title}`);

    return {
      id: crypto.randomUUID(),
      noteType: noteType as ClinicalNoteDraft["noteType"],
      title: parsed.title || `${noteType.replace(/_/g, " ")} - ${patientData.patientName}`,
      sections: (parsed.sections || []).map((s: any) => ({
        heading: s.heading || "",
        content: s.content || "",
        isEditable: true,
      })),
      summary: parsed.summary || "",
      generatedAt: new Date().toISOString(),
      qualityScore,
      warnings: parsed.warnings || [],
      disclaimer: DISCLAIMER,
    };
  }

  async analyzePatientForSmartAlerts(patientData: PatientWorkflowData): Promise<{ alerts: SmartAlert[]; disclaimer: string }> {
    console.log(`[ClinicalWorkflow] Analyzing patient ${patientData.patientId} for smart alerts`);

    const ruleBasedAlerts = this.generateRuleBasedAlerts(patientData);

    const systemPrompt = `You are an expert clinical monitoring AI. Analyze the patient data for subtle patterns, deterioration trends, gaps in care, and overdue screenings that may not be caught by simple threshold checks.

Focus on:
1. Deterioration trends across multiple data points
2. Gaps in preventive care or monitoring
3. Overdue screenings based on age, gender, and conditions
4. Subtle medication concerns (long-term use effects, dose optimization)
5. Complex multi-condition interactions

Do NOT flag basic vital sign threshold violations (BP, HR, SpO2, temp, glucose) as those are handled separately.

Respond in JSON:
{
  "alerts": [
    {
      "severity": "critical|high|moderate|low",
      "category": "vital_change|lab_abnormality|medication_concern|gap_in_care|deterioration_risk|overdue_screening",
      "title": "Alert title",
      "description": "Detailed description",
      "affectedMetric": "metric name if applicable",
      "currentValue": "current value if applicable",
      "previousValue": "previous value if applicable",
      "trend": "worsening|improving|stable|new",
      "recommendedAction": "Specific recommended action",
      "urgency": "Timeframe for action",
      "relatedConditions": ["condition1"],
      "confidence": 85
    }
  ]
}`;

    const userPrompt = `Analyze the following patient data for clinical alerts:\n\n${buildPatientWorkflowPrompt(patientData)}`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxOutputTokens: 8192,
      dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals"],
      purpose: "safety_analysis",
      callerService: "ai-clinical-workflow-service",
      callerMethod: "analyzePatientForSmartAlerts",
    });

    const content = response.content;
    if (!content) {
      throw new Error("[ClinicalWorkflow] No response from AI for smart alerts");
    }

    const parsed = JSON.parse(content);
    const aiAlerts: SmartAlert[] = (parsed.alerts || []).map((a: any) => ({
      id: crypto.randomUUID(),
      severity: a.severity || "low",
      category: a.category || "gap_in_care",
      title: a.title || "",
      description: a.description || "",
      affectedMetric: a.affectedMetric,
      currentValue: a.currentValue,
      previousValue: a.previousValue,
      trend: a.trend,
      recommendedAction: a.recommendedAction || "",
      urgency: a.urgency || "",
      relatedConditions: a.relatedConditions || [],
      confidence: a.confidence || 0,
    }));

    const allAlerts = [...ruleBasedAlerts, ...aiAlerts];

    const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
    allAlerts.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    this.stats.alertAnalyses++;
    this.stats.totalAlerts += allAlerts.length;
    this.stats.criticalAlerts += allAlerts.filter(a => a.severity === "critical").length;

    console.log(`[ClinicalWorkflow] Generated ${allAlerts.length} smart alerts (${ruleBasedAlerts.length} rule-based + ${aiAlerts.length} AI)`);

    return {
      alerts: allAlerts,
      disclaimer: DISCLAIMER,
    };
  }

  private generateRuleBasedAlerts(patientData: PatientWorkflowData): SmartAlert[] {
    const alerts: SmartAlert[] = [];

    for (const vital of patientData.vitals) {
      const type = vital.type.toLowerCase();
      const value = vital.value;

      if (type.includes("systolic") || type === "blood pressure systolic") {
        if (value > 180) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Hypertensive crisis - Systolic BP > 180 mmHg",
            description: `Systolic blood pressure is ${value} ${vital.unit}, exceeding the hypertensive crisis threshold of 180 mmHg. Immediate evaluation required.`,
            affectedMetric: "Systolic Blood Pressure",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Immediate blood pressure re-check, assess for target organ damage, consider emergency antihypertensive therapy.",
            urgency: "Immediate",
            relatedConditions: ["Hypertension"],
            confidence: 98,
          });
        }
      }

      if (type.includes("diastolic") || type === "blood pressure diastolic") {
        if (value > 120) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Hypertensive crisis - Diastolic BP > 120 mmHg",
            description: `Diastolic blood pressure is ${value} ${vital.unit}, exceeding the hypertensive crisis threshold of 120 mmHg.`,
            affectedMetric: "Diastolic Blood Pressure",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Immediate blood pressure re-check, assess for target organ damage, consider emergency antihypertensive therapy.",
            urgency: "Immediate",
            relatedConditions: ["Hypertension"],
            confidence: 98,
          });
        }
      }

      if (type.includes("heart rate") || type === "hr" || type === "pulse") {
        if (value < 40) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Severe bradycardia - Heart rate < 40 bpm",
            description: `Heart rate is ${value} ${vital.unit}. Severe bradycardia detected requiring immediate evaluation.`,
            affectedMetric: "Heart Rate",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Assess hemodynamic stability, review medications (beta-blockers, calcium channel blockers, digoxin), consider cardiac monitoring.",
            urgency: "Immediate",
            relatedConditions: ["Bradycardia"],
            confidence: 98,
          });
        } else if (value > 150) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Severe tachycardia - Heart rate > 150 bpm",
            description: `Heart rate is ${value} ${vital.unit}. Severe tachycardia detected requiring immediate evaluation.`,
            affectedMetric: "Heart Rate",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Assess hemodynamic stability, obtain ECG, evaluate for underlying cause (sepsis, PE, arrhythmia), consider rate control.",
            urgency: "Immediate",
            relatedConditions: ["Tachycardia"],
            confidence: 98,
          });
        }
      }

      if (type.includes("spo2") || type.includes("oxygen saturation") || type.includes("o2 sat")) {
        if (value < 90) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Hypoxemia - SpO2 < 90%",
            description: `Oxygen saturation is ${value}%, below the critical threshold of 90%. Immediate intervention required.`,
            affectedMetric: "SpO2",
            currentValue: `${value}%`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Administer supplemental oxygen, assess respiratory status, obtain ABG, consider chest X-ray, evaluate for acute respiratory distress.",
            urgency: "Immediate",
            relatedConditions: ["Hypoxemia"],
            confidence: 98,
          });
        }
      }

      if (type.includes("temperature") || type === "temp") {
        if (value > 103) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "High fever - Temperature > 103\u00B0F",
            description: `Temperature is ${value} ${vital.unit}, exceeding 103\u00B0F. Evaluate for serious infection or other cause.`,
            affectedMetric: "Temperature",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Obtain blood cultures, CBC, urinalysis. Administer antipyretics. Assess for infection source. Consider empiric antibiotics if indicated.",
            urgency: "Immediate",
            relatedConditions: ["Fever"],
            confidence: 95,
          });
        }
      }

      if (type.includes("glucose") || type.includes("blood sugar")) {
        if (value > 400) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Severe hyperglycemia - Glucose > 400 mg/dL",
            description: `Blood glucose is ${value} ${vital.unit}. Evaluate for diabetic ketoacidosis (DKA) or hyperosmolar hyperglycemic state (HHS).`,
            affectedMetric: "Blood Glucose",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Check BMP, ketones, ABG. Initiate IV fluids and insulin protocol. Monitor closely.",
            urgency: "Immediate",
            relatedConditions: ["Diabetes", "Hyperglycemia"],
            confidence: 98,
          });
        } else if (value < 50) {
          alerts.push({
            id: crypto.randomUUID(),
            severity: "critical",
            category: "vital_change",
            title: "Severe hypoglycemia - Glucose < 50 mg/dL",
            description: `Blood glucose is ${value} ${vital.unit}. Severe hypoglycemia requiring immediate treatment.`,
            affectedMetric: "Blood Glucose",
            currentValue: `${value} ${vital.unit}`,
            trend: vital.trend as SmartAlert["trend"],
            recommendedAction: "Administer glucose (oral if conscious, IV dextrose if altered consciousness). Recheck glucose in 15 minutes. Identify and address cause.",
            urgency: "Immediate",
            relatedConditions: ["Diabetes", "Hypoglycemia"],
            confidence: 98,
          });
        }
      }
    }

    for (const lab of patientData.labResults) {
      const flag = (lab.flag || "").toLowerCase();
      if (flag === "critical" || flag === "high") {
        alerts.push({
          id: crypto.randomUUID(),
          severity: flag === "critical" ? "critical" : "high",
          category: "lab_abnormality",
          title: `${flag === "critical" ? "Critical" : "Abnormal"} lab result: ${lab.name}`,
          description: `${lab.name} is ${lab.value} ${lab.unit}${lab.referenceRange ? ` (reference: ${lab.referenceRange})` : ""}. Flagged as ${flag}.`,
          affectedMetric: lab.name,
          currentValue: `${lab.value} ${lab.unit}`,
          trend: "new",
          recommendedAction: `Review ${lab.name} result. Correlate with clinical presentation and consider appropriate intervention.`,
          urgency: flag === "critical" ? "Immediate" : "Within 24 hours",
          relatedConditions: [],
          confidence: 95,
        });
      }
    }

    const onAnticoagulant = patientData.medications.some(m => {
      const name = m.name.toLowerCase();
      return name.includes("warfarin") || name.includes("heparin") || name.includes("enoxaparin") ||
        name.includes("apixaban") || name.includes("rivaroxaban") || name.includes("dabigatran");
    });
    const hasBleedingRisk = patientData.conditions.some(c => {
      const name = c.name.toLowerCase();
      return name.includes("ulcer") || name.includes("gi bleed") || name.includes("hemorrhage") || name.includes("thrombocytopenia");
    });
    if (onAnticoagulant && hasBleedingRisk) {
      alerts.push({
        id: crypto.randomUUID(),
        severity: "high",
        category: "medication_concern",
        title: "Anticoagulant use with bleeding risk condition",
        description: "Patient is on anticoagulation therapy with a condition that increases bleeding risk. Careful monitoring required.",
        recommendedAction: "Review anticoagulation necessity and dosing. Monitor for signs of bleeding. Consider GI prophylaxis if appropriate.",
        urgency: "Within 24 hours",
        relatedConditions: patientData.conditions.filter(c => {
          const name = c.name.toLowerCase();
          return name.includes("ulcer") || name.includes("bleed") || name.includes("hemorrhage") || name.includes("thrombocytopenia");
        }).map(c => c.name),
        confidence: 90,
      });
    }

    return alerts;
  }

  async runFullWorkflowAnalysis(patientData: PatientWorkflowData): Promise<WorkflowAnalysisResult> {
    console.log(`[ClinicalWorkflow] Running full workflow analysis for patient ${patientData.patientId}`);

    const [followUpResult, alertResult] = await Promise.all([
      this.generateFollowUpSuggestions(patientData),
      this.analyzePatientForSmartAlerts(patientData),
    ]);

    const hasCritical = alertResult.alerts.some(a => a.severity === "critical");
    const hasHigh = alertResult.alerts.some(a => a.severity === "high");
    const hasModerate = alertResult.alerts.some(a => a.severity === "moderate");

    let overallRiskLevel: WorkflowAnalysisResult["overallRiskLevel"] = "low";
    if (hasCritical) overallRiskLevel = "critical";
    else if (hasHigh) overallRiskLevel = "high";
    else if (hasModerate) overallRiskLevel = "moderate";

    const now = new Date();
    let nextReviewDate: string;
    switch (overallRiskLevel) {
      case "critical":
        nextReviewDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "high":
        nextReviewDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      case "moderate":
        nextReviewDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
      default:
        nextReviewDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        break;
    }

    this.stats.fullWorkflowAnalyses++;

    console.log(`[ClinicalWorkflow] Full analysis complete: risk=${overallRiskLevel}, suggestions=${followUpResult.suggestions.length}, alerts=${alertResult.alerts.length}, nextReview=${nextReviewDate}`);

    return {
      followUpSuggestions: followUpResult.suggestions,
      smartAlerts: alertResult.alerts,
      overallRiskLevel,
      nextReviewDate,
      disclaimer: DISCLAIMER,
    };
  }

  getStats(): object {
    return {
      ...this.stats,
      averageAlertsPerAnalysis: this.stats.alertAnalyses > 0
        ? Math.round(this.stats.totalAlerts / this.stats.alertAnalyses * 100) / 100
        : 0,
      averageSuggestionsPerAnalysis: this.stats.followUpAnalyses > 0
        ? Math.round(this.stats.totalSuggestions / this.stats.followUpAnalyses * 100) / 100
        : 0,
    };
  }
}

export const aiClinicalWorkflowService = new AIClinicalWorkflowService();
