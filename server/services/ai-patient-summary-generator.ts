import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import { comprehensiveAuditTrailService } from "./comprehensive-audit-trail-service";

export interface PatientFHIRData {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
    gender: string;
    mrn?: string;
  };
  conditions: Array<{
    id: string;
    name: string;
    code?: string;
    status: string;
    onsetDate?: string;
    severity?: string;
    category?: string;
  }>;
  medications: Array<{
    id: string;
    name: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    status: string;
    startDate?: string;
    endDate?: string;
  }>;
  allergies: Array<{
    id: string;
    substance: string;
    reaction?: string;
    severity?: string;
    status: string;
  }>;
  observations: Array<{
    id: string;
    type: string;
    value: string | number;
    unit?: string;
    date: string;
    category?: string;
    interpretation?: string;
  }>;
  encounters: Array<{
    id: string;
    type: string;
    date: string;
    provider?: string;
    reason?: string;
    status: string;
  }>;
  procedures: Array<{
    id: string;
    name: string;
    date: string;
    status: string;
    outcome?: string;
  }>;
  immunizations: Array<{
    id: string;
    vaccine: string;
    date: string;
    status: string;
    doseNumber?: number;
  }>;
  carePlans: Array<{
    id: string;
    title: string;
    status: string;
    category?: string;
    goals?: string[];
  }>;
}

export interface SummarySection {
  title: string;
  content: string;
  priority: "critical" | "high" | "medium" | "low";
  dataPoints: number;
}

export interface KeyInsight {
  type: "medical_history" | "active_conditions" | "medications" | "recent_events" | "attention_needed" | "care_gaps";
  title: string;
  description: string;
  severity?: "critical" | "warning" | "info";
  relatedResources?: string[];
}

export interface GeneratedPatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  executiveSummary: string;
  sections: SummarySection[];
  keyInsights: KeyInsight[];
  medicalHistory: {
    summary: string;
    significantEvents: string[];
  };
  activeConditions: {
    summary: string;
    conditions: Array<{ name: string; status: string; notes?: string }>;
  };
  currentMedications: {
    summary: string;
    medications: Array<{ name: string; dosage?: string; purpose?: string }>;
    interactions?: string[];
  };
  recentEvents: {
    summary: string;
    events: Array<{ date: string; type: string; description: string }>;
  };
  actionableInsights: string[];
  dataQuality: {
    completeness: number;
    lastUpdated: string;
    missingDataAreas: string[];
  };
  noCdsCompliance: string;
  disclaimer: string;
}

export interface SummaryRequest {
  patientId: string;
  userId?: string;
  focusAreas?: string[];
  timeframeDays?: number;
  includeInsights?: boolean;
}

const summaryHistory = new Map<string, GeneratedPatientSummary[]>();

class AIPatientSummaryGeneratorService {
  private readonly NO_CDS_NOTICE = "INFORMATIONAL ONLY: This AI-generated summary is for documentation review and data organization purposes only. It does NOT provide clinical decision support, diagnosis recommendations, or treatment advice. All clinical decisions must be made by qualified healthcare providers based on complete patient evaluation.";

  async getPatientFHIRData(patientId: string): Promise<PatientFHIRData | null> {
    try {
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return null;
      }

      const [
        problemLists,
        medicationRecords,
        labResults,
        vaccinations,
        careGaps
      ] = await Promise.all([
        storage.getProblemsByPatient(patientId),
        storage.getMedicationsByPatient(patientId),
        storage.getLabResultsByPatient(patientId),
        storage.getPatientVaccinations(patientId),
        storage.getPatientCareGaps(patientId)
      ]);

      const patientName = `${patient.firstName} ${patient.lastName}`;

      const conditions = problemLists.map((p: any) => ({
        id: p.id,
        name: p.problem,
        code: p.code || undefined,
        status: p.status,
        onsetDate: p.onsetDate || undefined,
        severity: p.severity || undefined,
        category: p.category || undefined
      }));

      const medications = medicationRecords.map((m: any) => ({
        id: m.id,
        name: m.medication || m.name,
        dosage: m.dosage || undefined,
        frequency: m.frequency || undefined,
        route: m.route || undefined,
        status: m.status,
        startDate: m.startDate || undefined,
        endDate: m.endDate || undefined
      }));

      const observations = labResults.map((l: any) => ({
        id: l.id,
        type: l.testName || l.name,
        value: l.value,
        unit: l.unit || undefined,
        date: l.date,
        category: "laboratory",
        interpretation: l.interpretation || undefined
      }));

      const immunizations = vaccinations.map((v: any) => ({
        id: v.id,
        vaccine: v.vaccine,
        date: v.dateAdministered,
        status: v.status,
        doseNumber: v.doseNumber || undefined
      }));

      const carePlans = careGaps.map((g: any) => ({
        id: g.id,
        title: g.gapType,
        status: g.status,
        category: g.category || undefined,
        goals: g.recommendedActions || undefined
      }));

      return {
        patient: {
          id: patient.id,
          name: patientName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          mrn: patient.mrn
        },
        conditions,
        medications,
        allergies: [],
        observations,
        encounters: [],
        procedures: [],
        immunizations,
        carePlans
      };
    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error fetching patient data:", error);
      return null;
    }
  }

  async generateSummary(request: SummaryRequest): Promise<GeneratedPatientSummary> {
    const startTime = Date.now();
    const summaryId = `summary-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const patientData = await this.getPatientFHIRData(request.patientId);
      
      if (!patientData) {
        throw new Error(`Patient ${request.patientId} not found`);
      }

      const prompt = this.buildSummaryPrompt(patientData, request);

      const content = await generatePhiSafeText({
        system: `You are a medical documentation assistant that creates clear, informational patient record summaries from FHIR health data.

CRITICAL COMPLIANCE REQUIREMENTS (NO-CDS):
- You are STRICTLY PROHIBITED from providing clinical decision support, treatment recommendations, or medical advice
- All outputs are INFORMATIONAL ONLY for documentation review and data organization
- Never suggest diagnoses, treatments, or changes to care plans
- Focus on organizing and presenting existing documented information clearly
- Use plain language that patients and caregivers can understand
- Synthesize information to highlight key facts without interpreting clinical significance

Your role is to help organize and summarize documented medical information for review purposes only. Present the facts as recorded, not clinical interpretations.`,
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 4000,
      });

      if (!content) {
        return this.generateFallbackSummary(summaryId, patientData, request);
      }

      const parsed = JSON.parse(content);
      const summary = this.buildSummaryFromAIResponse(summaryId, patientData, parsed, request);

      this.storeSummary(request.patientId, summary);

      const duration = Date.now() - startTime;
      console.log(`[AIPatientSummaryGenerator] Generated summary for patient ${request.patientId} in ${duration}ms`);

      return summary;

    } catch (error) {
      console.error("[AIPatientSummaryGenerator] Error generating summary:", error);
      
      const patientData = await this.getPatientFHIRData(request.patientId);
      if (patientData) {
        return this.generateFallbackSummary(summaryId, patientData, request);
      }
      
      throw new Error(`Failed to generate summary for patient ${request.patientId}`);
    }
  }

  private buildSummaryPrompt(data: PatientFHIRData, request: SummaryRequest): string {
    const timeframe = request.timeframeDays || 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeframe);

    const recentEncounters = data.encounters.filter(e => new Date(e.date) >= cutoffDate);
    const recentObservations = data.observations.filter(o => new Date(o.date) >= cutoffDate);

    return `Generate a comprehensive, informational patient summary in JSON format. This is for DOCUMENTATION REVIEW ONLY - do NOT provide any clinical recommendations, diagnoses, or medical advice.

PATIENT FHIR DATA:
Patient: ${JSON.stringify(data.patient)}
Active Conditions (${data.conditions.length}): ${JSON.stringify(data.conditions.slice(0, 15))}
Current Medications (${data.medications.length}): ${JSON.stringify(data.medications.slice(0, 15))}
Recent Observations (${recentObservations.length}): ${JSON.stringify(recentObservations.slice(0, 10))}
Recent Encounters (${recentEncounters.length}): ${JSON.stringify(recentEncounters.slice(0, 8))}
Immunizations (${data.immunizations.length}): ${JSON.stringify(data.immunizations.slice(0, 10))}
Care Plans (${data.carePlans.length}): ${JSON.stringify(data.carePlans.slice(0, 5))}

${request.focusAreas?.length ? `Focus Areas: ${request.focusAreas.join(", ")}` : ""}

Return JSON with these fields:
{
  "executiveSummary": "2-3 sentence overview of documented patient information, stating facts only",
  "medicalHistorySummary": "Summary of documented medical history from conditions and encounters",
  "significantEvents": ["Array of significant documented medical events"],
  "activeConditionsSummary": "Summary of currently documented active conditions",
  "conditionDetails": [{"name": "condition", "status": "status", "notes": "brief notes from records"}],
  "medicationsSummary": "Summary of current medications on record",
  "medicationDetails": [{"name": "medication", "dosage": "dosage if documented", "purpose": "documented indication"}],
  "potentialInteractions": ["Any documented or noted medication considerations"],
  "recentEventsSummary": "Summary of recent healthcare encounters and observations",
  "recentEventDetails": [{"date": "date", "type": "type", "description": "what is documented"}],
  "keyInsights": [
    {
      "type": "one of: medical_history, active_conditions, medications, recent_events, attention_needed, care_gaps",
      "title": "brief title",
      "description": "factual insight from the data",
      "severity": "critical, warning, or info"
    }
  ],
  "actionableInsights": ["Factual observations about documented data gaps or patterns - NOT clinical recommendations"],
  "dataCompleteness": {
    "score": 0-100,
    "missingAreas": ["areas where data may be incomplete"]
  }
}

Important: Synthesize the data into actionable insights by highlighting patterns and key facts. Do NOT provide clinical interpretations or treatment recommendations.`;
  }

  private buildSummaryFromAIResponse(
    summaryId: string, 
    data: PatientFHIRData, 
    aiResponse: any, 
    request: SummaryRequest
  ): GeneratedPatientSummary {
    const age = this.calculateAge(data.patient.dateOfBirth);

    const sections: SummarySection[] = [
      {
        title: "Medical History",
        content: aiResponse.medicalHistorySummary || this.generateMedicalHistorySummary(data),
        priority: "high",
        dataPoints: data.conditions.length + data.encounters.length
      },
      {
        title: "Active Conditions",
        content: aiResponse.activeConditionsSummary || this.generateConditionsSummary(data),
        priority: data.conditions.filter(c => c.status === "active").length > 0 ? "high" : "medium",
        dataPoints: data.conditions.length
      },
      {
        title: "Current Medications",
        content: aiResponse.medicationsSummary || this.generateMedicationsSummary(data),
        priority: data.medications.length > 5 ? "high" : "medium",
        dataPoints: data.medications.length
      },
      {
        title: "Recent Events",
        content: aiResponse.recentEventsSummary || this.generateRecentEventsSummary(data),
        priority: "medium",
        dataPoints: data.encounters.length + data.observations.length
      },
      {
        title: "Immunizations",
        content: this.generateImmunizationsSummary(data),
        priority: "low",
        dataPoints: data.immunizations.length
      }
    ];

    const keyInsights: KeyInsight[] = (aiResponse.keyInsights || []).map((i: any) => ({
      type: i.type || "attention_needed",
      title: i.title,
      description: i.description,
      severity: i.severity || "info",
      relatedResources: i.relatedResources || []
    }));

    if (keyInsights.length === 0) {
      keyInsights.push(...this.generateDefaultInsights(data));
    }

    return {
      id: summaryId,
      patientId: data.patient.id,
      patientName: data.patient.name,
      generatedAt: new Date().toISOString(),
      executiveSummary: aiResponse.executiveSummary || this.generateExecutiveSummary(data, age),
      sections,
      keyInsights,
      medicalHistory: {
        summary: aiResponse.medicalHistorySummary || this.generateMedicalHistorySummary(data),
        significantEvents: aiResponse.significantEvents || []
      },
      activeConditions: {
        summary: aiResponse.activeConditionsSummary || this.generateConditionsSummary(data),
        conditions: (aiResponse.conditionDetails || data.conditions.slice(0, 10)).map((c: any) => ({
          name: c.name,
          status: c.status,
          notes: c.notes
        }))
      },
      currentMedications: {
        summary: aiResponse.medicationsSummary || this.generateMedicationsSummary(data),
        medications: (aiResponse.medicationDetails || data.medications.slice(0, 10)).map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          purpose: m.purpose
        })),
        interactions: aiResponse.potentialInteractions || []
      },
      recentEvents: {
        summary: aiResponse.recentEventsSummary || this.generateRecentEventsSummary(data),
        events: (aiResponse.recentEventDetails || []).map((e: any) => ({
          date: e.date,
          type: e.type,
          description: e.description
        }))
      },
      actionableInsights: aiResponse.actionableInsights || [],
      dataQuality: {
        completeness: aiResponse.dataCompleteness?.score || this.calculateDataCompleteness(data),
        lastUpdated: new Date().toISOString(),
        missingDataAreas: aiResponse.dataCompleteness?.missingAreas || this.identifyMissingData(data)
      },
      noCdsCompliance: this.NO_CDS_NOTICE,
      disclaimer: this.NO_CDS_NOTICE
    };
  }

  private generateFallbackSummary(
    summaryId: string, 
    data: PatientFHIRData, 
    request: SummaryRequest
  ): GeneratedPatientSummary {
    const age = this.calculateAge(data.patient.dateOfBirth);

    const sections: SummarySection[] = [
      {
        title: "Medical History",
        content: this.generateMedicalHistorySummary(data),
        priority: "high",
        dataPoints: data.conditions.length + data.encounters.length
      },
      {
        title: "Active Conditions",
        content: this.generateConditionsSummary(data),
        priority: data.conditions.filter(c => c.status === "active").length > 0 ? "high" : "medium",
        dataPoints: data.conditions.length
      },
      {
        title: "Current Medications",
        content: this.generateMedicationsSummary(data),
        priority: data.medications.length > 5 ? "high" : "medium",
        dataPoints: data.medications.length
      },
      {
        title: "Recent Events",
        content: this.generateRecentEventsSummary(data),
        priority: "medium",
        dataPoints: data.encounters.length + data.observations.length
      }
    ];

    return {
      id: summaryId,
      patientId: data.patient.id,
      patientName: data.patient.name,
      generatedAt: new Date().toISOString(),
      executiveSummary: this.generateExecutiveSummary(data, age),
      sections,
      keyInsights: this.generateDefaultInsights(data),
      medicalHistory: {
        summary: this.generateMedicalHistorySummary(data),
        significantEvents: []
      },
      activeConditions: {
        summary: this.generateConditionsSummary(data),
        conditions: data.conditions.slice(0, 10).map(c => ({
          name: c.name,
          status: c.status
        }))
      },
      currentMedications: {
        summary: this.generateMedicationsSummary(data),
        medications: data.medications.slice(0, 10).map(m => ({
          name: m.name,
          dosage: m.dosage
        })),
        interactions: []
      },
      recentEvents: {
        summary: this.generateRecentEventsSummary(data),
        events: data.encounters.slice(0, 5).map(e => ({
          date: e.date,
          type: e.type,
          description: e.reason || "Healthcare encounter"
        }))
      },
      actionableInsights: [],
      dataQuality: {
        completeness: this.calculateDataCompleteness(data),
        lastUpdated: new Date().toISOString(),
        missingDataAreas: this.identifyMissingData(data)
      },
      noCdsCompliance: this.NO_CDS_NOTICE,
      disclaimer: this.NO_CDS_NOTICE
    };
  }

  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  private generateExecutiveSummary(data: PatientFHIRData, age: number): string {
    const activeConditions = data.conditions.filter(c => c.status === "active").length;
    const activeMeds = data.medications.filter(m => m.status === "active").length;
    const recentEncounters = data.encounters.length;

    return `${data.patient.name} is a ${age}-year-old ${data.patient.gender} with ${activeConditions} active documented condition(s) and ${activeMeds} current medication(s) on record. ${recentEncounters} recent healthcare encounter(s) are documented. This summary presents health record information for review purposes only.`;
  }

  private generateMedicalHistorySummary(data: PatientFHIRData): string {
    if (data.conditions.length === 0 && data.encounters.length === 0) {
      return "No documented medical history available in current records.";
    }

    const conditions = data.conditions.slice(0, 5).map(c => c.name).join(", ");
    const encounterCount = data.encounters.length;

    return `Patient has ${data.conditions.length} documented condition(s) including ${conditions || "conditions on file"}. ${encounterCount} healthcare encounter(s) are recorded in the system.`;
  }

  private generateConditionsSummary(data: PatientFHIRData): string {
    const active = data.conditions.filter(c => c.status === "active");
    if (active.length === 0) return "No active conditions currently documented.";

    const conditionList = active.slice(0, 5).map(c => c.name).join(", ");
    return `${active.length} active condition(s) on record: ${conditionList}${active.length > 5 ? ` and ${active.length - 5} more` : ""}.`;
  }

  private generateMedicationsSummary(data: PatientFHIRData): string {
    const active = data.medications.filter(m => m.status === "active");
    if (active.length === 0) return "No active medications currently documented.";

    const medList = active.slice(0, 5).map(m => m.name).join(", ");
    return `${active.length} active medication(s) on record: ${medList}${active.length > 5 ? ` and ${active.length - 5} more` : ""}.`;
  }

  private generateRecentEventsSummary(data: PatientFHIRData): string {
    if (data.encounters.length === 0 && data.observations.length === 0) {
      return "No recent healthcare events documented.";
    }

    const recentEnc = data.encounters.slice(0, 3);
    const encSummary = recentEnc.map(e => `${e.type} on ${e.date}`).join("; ");

    return `Recent encounters: ${encSummary || "None documented"}. ${data.observations.length} observation(s) recorded.`;
  }

  private generateImmunizationsSummary(data: PatientFHIRData): string {
    if (data.immunizations.length === 0) {
      return "No immunization records documented.";
    }

    const vaccines = data.immunizations.slice(0, 5).map(i => i.vaccine).join(", ");
    return `${data.immunizations.length} immunization(s) on record: ${vaccines}${data.immunizations.length > 5 ? " and more" : ""}.`;
  }

  private generateDefaultInsights(data: PatientFHIRData): KeyInsight[] {
    const insights: KeyInsight[] = [];

    const activeConditions = data.conditions.filter(c => c.status === "active");
    if (activeConditions.length > 0) {
      insights.push({
        type: "active_conditions",
        title: "Active Conditions",
        description: `Patient has ${activeConditions.length} active condition(s) documented in health records.`,
        severity: activeConditions.length > 3 ? "warning" : "info"
      });
    }

    const activeMeds = data.medications.filter(m => m.status === "active");
    if (activeMeds.length >= 5) {
      insights.push({
        type: "medications",
        title: "Multiple Medications",
        description: `Patient has ${activeMeds.length} active medications documented.`,
        severity: activeMeds.length >= 10 ? "warning" : "info"
      });
    }

    if (data.carePlans.length > 0) {
      const openPlans = data.carePlans.filter(p => p.status !== "completed");
      if (openPlans.length > 0) {
        insights.push({
          type: "care_gaps",
          title: "Care Plan Items",
          description: `${openPlans.length} open care plan item(s) documented.`,
          severity: "info"
        });
      }
    }

    return insights;
  }

  private calculateDataCompleteness(data: PatientFHIRData): number {
    let score = 0;
    let maxScore = 0;

    maxScore += 20;
    if (data.patient.name && data.patient.dateOfBirth && data.patient.gender) score += 20;

    maxScore += 20;
    if (data.conditions.length > 0) score += 20;

    maxScore += 20;
    if (data.medications.length > 0) score += 20;

    maxScore += 15;
    if (data.observations.length > 0) score += 15;

    maxScore += 15;
    if (data.encounters.length > 0) score += 15;

    maxScore += 10;
    if (data.immunizations.length > 0) score += 10;

    return Math.round((score / maxScore) * 100);
  }

  private identifyMissingData(data: PatientFHIRData): string[] {
    const missing: string[] = [];

    if (data.allergies.length === 0) missing.push("Allergy information");
    if (data.immunizations.length === 0) missing.push("Immunization records");
    if (data.observations.length === 0) missing.push("Vital signs/observations");
    if (data.procedures.length === 0) missing.push("Procedure history");

    return missing;
  }

  private storeSummary(patientId: string, summary: GeneratedPatientSummary): void {
    const history = summaryHistory.get(patientId) || [];
    history.unshift(summary);
    if (history.length > 10) {
      history.pop();
    }
    summaryHistory.set(patientId, history);
  }

  async getSummaryHistory(patientId: string): Promise<GeneratedPatientSummary[]> {
    return summaryHistory.get(patientId) || [];
  }

  async getAvailablePatients(): Promise<Array<{ id: string; name: string; dateOfBirth: string; gender: string }>> {
    const patients = await storage.getPatients(50);
    return patients.map(p => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender
    }));
  }

  getMetadata(): { version: string; features: string[]; noCdsCompliance: string } {
    return {
      version: "1.0.0",
      features: [
        "FHIR R4 data aggregation",
        "AI-powered summary synthesis",
        "Key insight extraction",
        "Medical history summarization",
        "Medication overview",
        "Recent events timeline",
        "Data quality assessment"
      ],
      noCdsCompliance: this.NO_CDS_NOTICE
    };
  }
}

export const aiPatientSummaryGeneratorService = new AIPatientSummaryGeneratorService();
