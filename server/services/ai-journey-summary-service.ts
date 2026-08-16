import { generatePhiSafeText } from "./ai-gateway";

export interface JourneyDataInput {
  patientId: string;
  dateRange: { start: string; end: string };
  medications: Array<{
    name: string;
    dosage?: string;
    startDate: string;
    endDate?: string;
    status: string;
  }>;
  conditions: Array<{
    name: string;
    diagnosedDate: string;
    status: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
    isAbnormal?: boolean;
  }>;
  procedures: Array<{
    name: string;
    date: string;
    type?: string;
  }>;
  immunizations: Array<{
    name: string;
    date: string;
  }>;
  labResults?: Array<{
    name: string;
    value: number;
    unit: string;
    date: string;
    normalRange?: { min: number; max: number };
    trend?: "up" | "down" | "stable";
  }>;
  hedisMetrics?: Array<{
    measure: string;
    status: "met" | "not_met" | "pending";
    details?: string;
  }>;
}

export interface JourneySummary {
  id: string;
  patientId: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  summary: string;
  keyHighlights: string[];
  healthTrends: string[];
  specialistNotes: string;
  shareableVersion: string;
  model: string;
}

class AIJourneySummaryService {
  constructor() {
    console.log("[AIJourneySummary] Service initialized");
    console.log("[AIJourneySummary] Features: Natural language summaries, HEDIS integration, Specialist sharing");
    console.log("[AIJourneySummary] Compliance: NO-CDS (informational only), PHI-aware summaries");
  }

  async generateSummary(data: JourneyDataInput): Promise<JourneySummary> {
    const startTime = Date.now();
    
    const systemPrompt = `You are a healthcare data summarization assistant. Your role is to generate clear, concise natural language summaries of patient health journeys for the past 3-6 months.

IMPORTANT GUIDELINES:
- Write in plain, patient-friendly language
- Focus on key health events, trends, and changes
- Highlight any concerning patterns or improvements
- Structure the summary for easy sharing with specialists
- Include actionable takeaways where appropriate
- Never provide medical advice or diagnoses (NO-CDS compliance)
- Use phrases like "records indicate" or "data shows" rather than definitive statements
- Keep the tone professional but accessible

OUTPUT FORMAT (JSON):
{
  "summary": "A 2-3 paragraph narrative summary of the patient's health journey",
  "keyHighlights": ["Array of 3-5 key health events or changes"],
  "healthTrends": ["Array of 2-4 observed trends in the data"],
  "specialistNotes": "Brief notes relevant for specialist review"
}`;

    const userPrompt = this.buildUserPrompt(data);

    try {
      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 1500,
      });

      if (!content) {
        throw new Error("Empty response from AI");
      }

      const parsed = JSON.parse(content);
      const duration = Date.now() - startTime;
      console.log(`[AIJourneySummary] Generated summary in ${duration}ms`);

      return {
        id: `summary-${Date.now()}`,
        patientId: data.patientId,
        generatedAt: new Date().toISOString(),
        dateRange: data.dateRange,
        summary: parsed.summary || "Unable to generate summary",
        keyHighlights: parsed.keyHighlights || [],
        healthTrends: parsed.healthTrends || [],
        specialistNotes: parsed.specialistNotes || "",
        shareableVersion: this.formatShareableVersion(parsed, data.dateRange),
        model: "gpt-5.2"
      };
    } catch (error) {
      console.error("[AIJourneySummary] Generation error:", error);
      return this.generateFallbackSummary(data);
    }
  }

  private buildUserPrompt(data: JourneyDataInput): string {
    const parts: string[] = [];

    parts.push(`Generate a health journey summary for the period: ${data.dateRange.start} to ${data.dateRange.end}\n`);

    if (data.conditions.length > 0) {
      parts.push("ACTIVE CONDITIONS:");
      data.conditions.forEach(c => {
        parts.push(`- ${c.name} (diagnosed: ${c.diagnosedDate}, status: ${c.status})`);
      });
      parts.push("");
    }

    if (data.medications.length > 0) {
      parts.push("CURRENT MEDICATIONS:");
      data.medications.forEach(m => {
        const dosage = m.dosage ? ` - ${m.dosage}` : "";
        parts.push(`- ${m.name}${dosage} (started: ${m.startDate}, status: ${m.status})`);
      });
      parts.push("");
    }

    if (data.vitals.length > 0) {
      parts.push("RECENT VITALS:");
      data.vitals.forEach(v => {
        const abnormal = v.isAbnormal ? " [ABNORMAL]" : "";
        parts.push(`- ${v.type}: ${v.value} ${v.unit} (${v.date})${abnormal}`);
      });
      parts.push("");
    }

    if (data.procedures.length > 0) {
      parts.push("PROCEDURES:");
      data.procedures.forEach(p => {
        parts.push(`- ${p.name} (${p.date})`);
      });
      parts.push("");
    }

    if (data.immunizations.length > 0) {
      parts.push("IMMUNIZATIONS:");
      data.immunizations.forEach(i => {
        parts.push(`- ${i.name} (${i.date})`);
      });
      parts.push("");
    }

    if (data.labResults && data.labResults.length > 0) {
      parts.push("LAB RESULTS:");
      data.labResults.forEach(l => {
        const trend = l.trend ? ` (trend: ${l.trend})` : "";
        const range = l.normalRange ? ` [normal: ${l.normalRange.min}-${l.normalRange.max}]` : "";
        parts.push(`- ${l.name}: ${l.value} ${l.unit}${range}${trend}`);
      });
      parts.push("");
    }

    if (data.hedisMetrics && data.hedisMetrics.length > 0) {
      parts.push("HEDIS QUALITY MEASURES:");
      data.hedisMetrics.forEach(h => {
        parts.push(`- ${h.measure}: ${h.status}${h.details ? ` (${h.details})` : ""}`);
      });
      parts.push("");
    }

    return parts.join("\n");
  }

  private formatShareableVersion(parsed: any, dateRange: { start: string; end: string }): string {
    const startDate = new Date(dateRange.start).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const endDate = new Date(dateRange.end).toLocaleDateString("en-US", { month: "short", year: "numeric" });

    let shareable = `PATIENT HEALTH SUMMARY (${startDate} - ${endDate})\n`;
    shareable += "=" .repeat(50) + "\n\n";
    shareable += parsed.summary + "\n\n";
    
    if (parsed.keyHighlights?.length > 0) {
      shareable += "KEY HIGHLIGHTS:\n";
      parsed.keyHighlights.forEach((h: string) => {
        shareable += `• ${h}\n`;
      });
      shareable += "\n";
    }

    if (parsed.healthTrends?.length > 0) {
      shareable += "HEALTH TRENDS:\n";
      parsed.healthTrends.forEach((t: string) => {
        shareable += `• ${t}\n`;
      });
      shareable += "\n";
    }

    if (parsed.specialistNotes) {
      shareable += "NOTES FOR SPECIALIST REVIEW:\n";
      shareable += parsed.specialistNotes + "\n";
    }

    shareable += "\n---\n";
    shareable += "Generated by Tabula Medica | For informational purposes only";

    return shareable;
  }

  private generateFallbackSummary(data: JourneyDataInput): JourneySummary {
    const conditionList = data.conditions.map(c => c.name).join(", ") || "none documented";
    const medCount = data.medications.length;
    const procedureCount = data.procedures.length;

    const summary = `Over the review period from ${data.dateRange.start} to ${data.dateRange.end}, ` +
      `the patient's records show ${data.conditions.length} active condition(s) (${conditionList}). ` +
      `The patient is currently taking ${medCount} medication(s) and has undergone ${procedureCount} procedure(s). ` +
      `Please review the detailed timeline for complete information.`;

    return {
      id: `summary-fallback-${Date.now()}`,
      patientId: data.patientId,
      generatedAt: new Date().toISOString(),
      dateRange: data.dateRange,
      summary,
      keyHighlights: [
        `${data.conditions.length} active conditions`,
        `${medCount} current medications`,
        `${procedureCount} procedures during this period`
      ],
      healthTrends: ["Review timeline for trend data"],
      specialistNotes: "AI summary unavailable. Please review raw data.",
      shareableVersion: summary,
      model: "fallback"
    };
  }

  getSampleData(): JourneyDataInput {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    return {
      patientId: "patient-001",
      dateRange: {
        start: sixMonthsAgo.toISOString().split("T")[0],
        end: now.toISOString().split("T")[0]
      },
      conditions: [
        { name: "Type 2 Diabetes Mellitus", diagnosedDate: "2023-03-15", status: "active" },
        { name: "Essential Hypertension", diagnosedDate: "2022-08-20", status: "controlled" }
      ],
      medications: [
        { name: "Metformin", dosage: "1000mg twice daily", startDate: "2023-03-20", status: "active" },
        { name: "Lisinopril", dosage: "10mg once daily", startDate: "2022-08-25", status: "active" },
        { name: "Atorvastatin", dosage: "20mg at bedtime", startDate: "2023-06-10", status: "active" }
      ],
      vitals: [
        { type: "Blood Pressure", value: 128, unit: "mmHg systolic", date: "2025-12-15", isAbnormal: false },
        { type: "Blood Pressure", value: 82, unit: "mmHg diastolic", date: "2025-12-15", isAbnormal: false },
        { type: "Heart Rate", value: 72, unit: "bpm", date: "2025-12-15", isAbnormal: false },
        { type: "Weight", value: 185, unit: "lbs", date: "2025-12-15", isAbnormal: false }
      ],
      procedures: [
        { name: "Annual Physical Examination", date: "2025-12-01", type: "routine" },
        { name: "Diabetic Eye Exam", date: "2025-10-15", type: "preventive" }
      ],
      immunizations: [
        { name: "Influenza Vaccine", date: "2025-10-01" },
        { name: "COVID-19 Booster", date: "2025-09-15" }
      ],
      labResults: [
        { name: "HbA1c", value: 6.8, unit: "%", date: "2025-12-01", normalRange: { min: 4.0, max: 5.6 }, trend: "down" },
        { name: "Fasting Glucose", value: 118, unit: "mg/dL", date: "2025-12-01", normalRange: { min: 70, max: 100 }, trend: "stable" },
        { name: "Total Cholesterol", value: 185, unit: "mg/dL", date: "2025-12-01", normalRange: { min: 0, max: 200 }, trend: "down" },
        { name: "LDL Cholesterol", value: 98, unit: "mg/dL", date: "2025-12-01", normalRange: { min: 0, max: 100 }, trend: "down" },
        { name: "eGFR", value: 82, unit: "mL/min", date: "2025-12-01", normalRange: { min: 90, max: 120 }, trend: "stable" }
      ],
      hedisMetrics: [
        { measure: "Diabetes Care - HbA1c Control", status: "met", details: "HbA1c < 8%" },
        { measure: "Controlling High Blood Pressure", status: "met", details: "BP < 140/90" },
        { measure: "Statin Therapy for Diabetes", status: "met", details: "On statin therapy" },
        { measure: "Annual Eye Exam", status: "met", details: "Completed Oct 2025" }
      ]
    };
  }
}

export const aiJourneySummaryService = new AIJourneySummaryService();
