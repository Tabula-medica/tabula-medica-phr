import { generatePhiSafeText } from "./ai-gateway";

export interface PatientDemographics {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  age?: number;
}

export interface PatientMedication {
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
  status: string;
}

export interface PatientCondition {
  name: string;
  code?: string;
  onsetDate?: string;
  status: string;
  severity?: string;
}

export interface PatientEncounter {
  type: string;
  date: string;
  provider?: string;
  reason?: string;
  outcome?: string;
}

export interface PatientAllergy {
  substance: string;
  reaction?: string;
  severity?: string;
}

export interface PatientVital {
  type: string;
  value: number;
  unit: string;
  date: string;
}

export interface PatientLabResult {
  name: string;
  value: number;
  unit: string;
  referenceRange?: string;
  date: string;
  abnormal?: boolean;
}

export interface PatientRecordData {
  demographics: PatientDemographics;
  medications: PatientMedication[];
  conditions: PatientCondition[];
  encounters: PatientEncounter[];
  allergies: PatientAllergy[];
  vitals: PatientVital[];
  labResults: PatientLabResult[];
}

export interface PatientSummary {
  executiveSummary: string;
  demographicsSummary: string;
  activeMedicationsSummary: string;
  activeConditionsSummary: string;
  recentEncountersSummary: string;
  allergiesSummary: string;
  vitalsTrendSummary: string;
  labResultsSummary: string;
  keyFindings: string[];
  generatedAt: string;
  disclaimer: string;
}

const SUMMARY_CACHE = new Map<string, { summary: PatientSummary; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class AIPatientSummaryService {
  async generatePatientSummary(patientData: PatientRecordData): Promise<PatientSummary> {
    const cacheKey = `summary-${patientData.demographics.id}`;
    const cached = SUMMARY_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.summary;
    }

    try {
      const prompt = this.buildSummaryPrompt(patientData);

      const content = await generatePhiSafeText({
        system: `You are a medical documentation assistant that creates clear, informational patient record summaries.

CRITICAL COMPLIANCE REQUIREMENTS:
- You are STRICTLY PROHIBITED from providing clinical decision support, treatment recommendations, or medical advice
- All outputs are INFORMATIONAL ONLY and must be clearly labeled as such
- Never suggest diagnoses, treatments, or changes to care plans
- Focus on organizing and presenting existing documented information
- Use plain language that patients and caregivers can understand
- Always include appropriate disclaimers

Your role is to help organize and summarize documented medical information for review purposes only.`,
        user: prompt,
        responseMimeType: "application/json",
        temperature: 0.3,
        maxTokens: 2000
      });

      if (!content) {
        return this.generateFallbackSummary(patientData);
      }

      const parsed = JSON.parse(content);
      const summary: PatientSummary = {
        executiveSummary: parsed.executiveSummary || this.generateExecutiveSummary(patientData),
        demographicsSummary: parsed.demographicsSummary || this.summarizeDemographics(patientData.demographics),
        activeMedicationsSummary: parsed.activeMedicationsSummary || this.summarizeMedications(patientData.medications),
        activeConditionsSummary: parsed.activeConditionsSummary || this.summarizeConditions(patientData.conditions),
        recentEncountersSummary: parsed.recentEncountersSummary || this.summarizeEncounters(patientData.encounters),
        allergiesSummary: parsed.allergiesSummary || this.summarizeAllergies(patientData.allergies),
        vitalsTrendSummary: parsed.vitalsTrendSummary || this.summarizeVitals(patientData.vitals),
        labResultsSummary: parsed.labResultsSummary || this.summarizeLabs(patientData.labResults),
        keyFindings: parsed.keyFindings || [],
        generatedAt: new Date().toISOString(),
        disclaimer: "INFORMATIONAL ONLY: This summary is generated for documentation review purposes and does not constitute medical advice. All clinical decisions must be made by qualified healthcare providers based on complete patient evaluation."
      };

      SUMMARY_CACHE.set(cacheKey, { summary, timestamp: Date.now() });
      return summary;

    } catch (error) {
      console.error("AI patient summary generation failed:", error);
      return this.generateFallbackSummary(patientData);
    }
  }

  private buildSummaryPrompt(data: PatientRecordData): string {
    return `Generate an informational patient record summary in JSON format. This is for DOCUMENTATION REVIEW ONLY - do NOT provide any clinical recommendations or medical advice.

Patient Data:
- Demographics: ${JSON.stringify(data.demographics)}
- Active Medications (${data.medications.length}): ${JSON.stringify(data.medications.slice(0, 10))}
- Conditions (${data.conditions.length}): ${JSON.stringify(data.conditions.slice(0, 10))}
- Recent Encounters (${data.encounters.length}): ${JSON.stringify(data.encounters.slice(0, 5))}
- Allergies (${data.allergies.length}): ${JSON.stringify(data.allergies)}
- Recent Vitals: ${JSON.stringify(data.vitals.slice(0, 10))}
- Recent Lab Results: ${JSON.stringify(data.labResults.slice(0, 10))}

Return JSON with these fields:
{
  "executiveSummary": "Brief 2-3 sentence overview of documented patient information",
  "demographicsSummary": "Summary of patient demographics",
  "activeMedicationsSummary": "Summary of current medications on record",
  "activeConditionsSummary": "Summary of documented conditions",
  "recentEncountersSummary": "Summary of recent healthcare encounters",
  "allergiesSummary": "Summary of documented allergies",
  "vitalsTrendSummary": "Summary of vital sign trends from records",
  "labResultsSummary": "Summary of recent lab results",
  "keyFindings": ["Array of key documented findings for review"]
}

Use plain language. Focus on summarizing what is documented, not interpreting it.`;
  }

  private generateFallbackSummary(data: PatientRecordData): PatientSummary {
    return {
      executiveSummary: this.generateExecutiveSummary(data),
      demographicsSummary: this.summarizeDemographics(data.demographics),
      activeMedicationsSummary: this.summarizeMedications(data.medications),
      activeConditionsSummary: this.summarizeConditions(data.conditions),
      recentEncountersSummary: this.summarizeEncounters(data.encounters),
      allergiesSummary: this.summarizeAllergies(data.allergies),
      vitalsTrendSummary: this.summarizeVitals(data.vitals),
      labResultsSummary: this.summarizeLabs(data.labResults),
      keyFindings: this.extractKeyFindings(data),
      generatedAt: new Date().toISOString(),
      disclaimer: "INFORMATIONAL ONLY: This summary is generated for documentation review purposes and does not constitute medical advice. All clinical decisions must be made by qualified healthcare providers based on complete patient evaluation."
    };
  }

  private generateExecutiveSummary(data: PatientRecordData): string {
    const { demographics, medications, conditions } = data;
    const age = demographics.age || this.calculateAge(demographics.dateOfBirth);
    const activeConditions = conditions.filter(c => c.status === 'active').length;
    const activeMeds = medications.filter(m => m.status === 'active').length;
    
    return `${demographics.name} is a ${age}-year-old ${demographics.gender} with ${activeConditions} active condition(s) documented and ${activeMeds} current medication(s) on record. This summary presents documented health information for review purposes only.`;
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

  private summarizeDemographics(demographics: PatientDemographics): string {
    const age = demographics.age || this.calculateAge(demographics.dateOfBirth);
    return `Patient: ${demographics.name}, ${age} years old, ${demographics.gender}. Date of Birth: ${demographics.dateOfBirth}.`;
  }

  private summarizeMedications(meds: PatientMedication[]): string {
    const active = meds.filter(m => m.status === 'active');
    if (active.length === 0) return "No active medications documented.";
    
    const summary = active.slice(0, 5).map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("; ");
    const remaining = active.length > 5 ? ` and ${active.length - 5} more` : "";
    return `${active.length} active medication(s): ${summary}${remaining}.`;
  }

  private summarizeConditions(conditions: PatientCondition[]): string {
    const active = conditions.filter(c => c.status === 'active');
    if (active.length === 0) return "No active conditions documented.";
    
    const summary = active.slice(0, 5).map(c => c.name).join(", ");
    const remaining = active.length > 5 ? ` and ${active.length - 5} more` : "";
    return `${active.length} active condition(s) documented: ${summary}${remaining}.`;
  }

  private summarizeEncounters(encounters: PatientEncounter[]): string {
    if (encounters.length === 0) return "No recent encounters documented.";
    
    const recent = encounters.slice(0, 3);
    const summary = recent.map(e => `${e.type} on ${e.date}${e.reason ? ` for ${e.reason}` : ""}`).join("; ");
    return `${encounters.length} encounter(s) on record. Recent: ${summary}.`;
  }

  private summarizeAllergies(allergies: PatientAllergy[]): string {
    if (allergies.length === 0) return "No known allergies documented.";
    
    const summary = allergies.map(a => `${a.substance}${a.severity ? ` (${a.severity})` : ""}`).join(", ");
    return `${allergies.length} documented allergy(ies): ${summary}.`;
  }

  private summarizeVitals(vitals: PatientVital[]): string {
    if (vitals.length === 0) return "No recent vitals documented.";
    
    const vitalTypes = Array.from(new Set(vitals.map(v => v.type)));
    const latest = vitalTypes.map(type => {
      const latest = vitals.filter(v => v.type === type).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      return `${type}: ${latest.value} ${latest.unit}`;
    }).join(", ");
    
    return `Recent vitals on record: ${latest}.`;
  }

  private summarizeLabs(labs: PatientLabResult[]): string {
    if (labs.length === 0) return "No recent lab results documented.";
    
    const abnormal = labs.filter(l => l.abnormal);
    const summary = labs.slice(0, 3).map(l => 
      `${l.name}: ${l.value} ${l.unit}${l.abnormal ? " (outside reference range)" : ""}`
    ).join("; ");
    
    return `${labs.length} lab result(s) on record${abnormal.length > 0 ? `, ${abnormal.length} outside reference range` : ""}. Recent: ${summary}.`;
  }

  private extractKeyFindings(data: PatientRecordData): string[] {
    const findings: string[] = [];
    
    const activeConditions = data.conditions.filter(c => c.status === 'active');
    if (activeConditions.length > 0) {
      findings.push(`${activeConditions.length} active condition(s) documented`);
    }
    
    const activeMeds = data.medications.filter(m => m.status === 'active');
    if (activeMeds.length >= 5) {
      findings.push(`${activeMeds.length} medications currently prescribed (polypharmacy consideration)`);
    }
    
    if (data.allergies.length > 0) {
      findings.push(`${data.allergies.length} documented allergy(ies) on record`);
    }
    
    const abnormalLabs = data.labResults.filter(l => l.abnormal);
    if (abnormalLabs.length > 0) {
      findings.push(`${abnormalLabs.length} lab result(s) outside reference range`);
    }
    
    return findings;
  }
}

export const aiPatientSummaryService = new AIPatientSummaryService();
