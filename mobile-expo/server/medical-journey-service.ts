/**
 * Medical Journey Service
 * Aggregates health data into a unified chronological timeline
 * with semantic normalization and AI-powered summaries
 */

import { db } from "./db";
import { healthRecords, patientProfiles, medicationLogs } from "@shared/schema";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";
import { semanticNormalizationService } from "./semantic-normalization-service";
import { chatComplete } from "./ai-client";

export interface HealthJourneySummary {
  overview: string;
  keyFindings: string[];
  activeConditions: string[];
  medicationSummary: string;
  vitalTrends: string;
  recentCareHighlights: string;
  recommendedFollowUp: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  shareableText: string;
}

export interface TimelineEvent {
  id: string;
  type: "clinical_event" | "lab" | "medication" | "vital" | "imaging" | "immunization";
  date: Date;
  title: string;
  normalizedTitle: string;
  category: string;
  details: Record<string, unknown>;
  severity?: string;
  provider?: string;
  facility?: string;
  sourceType: string;
  originalData: Record<string, unknown>;
}

export interface VitalTrend {
  name: string;
  normalizedName: string;
  category: string;
  unit: string;
  dataPoints: Array<{ date: Date; value: number }>;
  latestValue?: number;
  trend?: "improving" | "stable" | "declining";
}

export interface MedicationPeriod {
  genericName: string;
  brandNames: string[];
  drugClass: string;
  periods: Array<{
    startDate: Date;
    endDate?: Date;
    dosage?: string;
    isActive: boolean;
  }>;
}

export interface MedicalJourney {
  userId: string;
  timelineEvents: TimelineEvent[];
  vitalTrends: VitalTrend[];
  medicationHistory: MedicationPeriod[];
  statusSummary: string;
  dateRange: { start: Date; end: Date };
  statistics: {
    totalEvents: number;
    totalLabTests: number;
    totalMedications: number;
    totalVisits: number;
    majorEvents: number;
  };
}

export class MedicalJourneyService {
  private static instance: MedicalJourneyService;

  static getInstance(): MedicalJourneyService {
    if (!MedicalJourneyService.instance) {
      MedicalJourneyService.instance = new MedicalJourneyService();
    }
    return MedicalJourneyService.instance;
  }

  /**
   * Build the complete medical journey for a user
   */
  async buildMedicalJourney(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<MedicalJourney> {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear() - 5, 0, 1); // 5 years ago
    const start = startDate || defaultStart;
    const end = endDate || now;

    // Fetch all health records
    const records = await db
      .select()
      .from(healthRecords)
      .where(
        and(
          eq(healthRecords.userId, userId),
          gte(healthRecords.date, start),
          lte(healthRecords.date, end)
        )
      )
      .orderBy(asc(healthRecords.date));

    // Process records into timeline events
    const timelineEvents: TimelineEvent[] = [];
    const labResults: Array<{ name: string; value: number; date: Date; unit?: string }> = [];
    const medicationRecords: Array<{ name: string; startDate: Date; endDate?: Date; dosage?: string }> = [];

    for (const record of records) {
      const event = this.processHealthRecord(record);
      if (event) {
        timelineEvents.push(event);
      }

      // Extract lab values if present
      if (record.type === "lab" && record.details) {
        const details = record.details as Record<string, unknown>;
        for (const [key, value] of Object.entries(details)) {
          if (typeof value === "number" || (typeof value === "string" && !isNaN(parseFloat(value)))) {
            labResults.push({
              name: key,
              value: typeof value === "number" ? value : parseFloat(value),
              date: record.date,
            });
          }
        }
      }

      // Extract medication info
      if (record.type === "medication") {
        medicationRecords.push({
          name: record.title,
          startDate: record.date,
          dosage: (record.details as Record<string, unknown>)?.dosage as string,
        });
      }
    }

    const deduplicatedEvents = this.deduplicateTimelineEvents(timelineEvents);

    const vitalTrends = this.buildVitalTrends(labResults);

    const medicationHistory = this.buildMedicationHistory(medicationRecords);

    const statistics = this.calculateStatistics(deduplicatedEvents);

    // Generate AI status summary
    const statusSummary = await this.generateStatusSummary(
      userId,
      timelineEvents,
      vitalTrends,
      medicationHistory
    );

    return {
      userId,
      timelineEvents: deduplicatedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      vitalTrends,
      medicationHistory,
      statusSummary,
      dateRange: { start, end },
      statistics,
    };
  }

  private deduplicateTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
    const seen = new Map<string, TimelineEvent>();

    for (const event of events) {
      const dateStr = new Date(event.date).toISOString().split("T")[0];
      const normalizedKey = `${event.type}|${dateStr}|${event.normalizedTitle.toLowerCase().trim()}`;

      const existing = seen.get(normalizedKey);
      if (!existing) {
        seen.set(normalizedKey, event);
      } else {
        const existingDetailCount = existing.details ? Object.keys(existing.details).length : 0;
        const newDetailCount = event.details ? Object.keys(event.details).length : 0;
        if (newDetailCount > existingDetailCount) {
          seen.set(normalizedKey, event);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Process a health record into a timeline event
   */
  private processHealthRecord(record: typeof healthRecords.$inferSelect): TimelineEvent | null {
    const eventType = this.mapRecordTypeToEventType(record.type);
    
    let normalizedTitle = record.title;
    let category = record.type;
    let severity = "routine";

    // Apply semantic normalization based on type
    if (record.type === "lab") {
      const normalized = semanticNormalizationService.normalizeLabTest(record.title);
      normalizedTitle = normalized.displayName;
      category = normalized.category;
    } else if (record.type === "medication") {
      const normalized = semanticNormalizationService.normalizeMedication(record.title);
      normalizedTitle = normalized.genericName;
      category = normalized.drugClass;
    } else if (record.type === "visit" || record.type === "encounter") {
      const normalized = semanticNormalizationService.normalizeClinicalEvent(record.title);
      normalizedTitle = normalized.displayName;
      category = normalized.category;
      severity = normalized.severity;
    }

    return {
      id: record.id,
      type: eventType,
      date: record.date,
      title: record.title,
      normalizedTitle,
      category,
      details: (record.details as Record<string, unknown>) || {},
      severity,
      provider: record.provider || undefined,
      facility: record.facility || undefined,
      sourceType: record.fhirResourceType || "manual",
      originalData: {
        summary: record.summary,
        rawFhirJson: record.rawFhirJson,
      },
    };
  }

  /**
   * Map record type to timeline event type
   */
  private mapRecordTypeToEventType(recordType: string): TimelineEvent["type"] {
    const mapping: Record<string, TimelineEvent["type"]> = {
      visit: "clinical_event",
      encounter: "clinical_event",
      surgery: "clinical_event",
      procedure: "clinical_event",
      lab: "lab",
      medication: "medication",
      vital: "vital",
      imaging: "imaging",
      immunization: "immunization",
      vaccine: "immunization",
    };
    return mapping[recordType.toLowerCase()] || "clinical_event";
  }

  /**
   * Build vital trends from lab results using semantic normalization
   */
  private buildVitalTrends(
    labResults: Array<{ name: string; value: number; date: Date; unit?: string }>
  ): VitalTrend[] {
    const grouped = semanticNormalizationService.groupLabResults(labResults);
    const trends: VitalTrend[] = [];

    for (const [displayName, dataPoints] of grouped) {
      if (dataPoints.length === 0) continue;

      const normalizedInfo = semanticNormalizationService.normalizeLabTest(dataPoints[0].originalName);
      const latestValue = dataPoints[dataPoints.length - 1].value;
      
      // Calculate trend
      let trend: "improving" | "stable" | "declining" = "stable";
      if (dataPoints.length >= 2) {
        const firstValue = dataPoints[0].value;
        const percentChange = ((latestValue - firstValue) / firstValue) * 100;
        
        if (Math.abs(percentChange) < 5) {
          trend = "stable";
        } else if (percentChange > 0) {
          // For most labs, increasing is not necessarily good
          // This would need clinical context for proper interpretation
          trend = "improving";
        } else {
          trend = "declining";
        }
      }

      trends.push({
        name: displayName,
        normalizedName: normalizedInfo.displayName,
        category: normalizedInfo.category,
        unit: normalizedInfo.unit,
        dataPoints: dataPoints.map(dp => ({
          date: dp.date,
          value: dp.value,
        })),
        latestValue,
        trend,
      });
    }

    return trends;
  }

  /**
   * Build medication history with continuous timeline
   */
  private buildMedicationHistory(
    medications: Array<{ name: string; startDate: Date; endDate?: Date; dosage?: string }>
  ): MedicationPeriod[] {
    const grouped = semanticNormalizationService.groupMedications(medications);
    const history: MedicationPeriod[] = [];

    for (const [genericName, periods] of grouped) {
      const normalizedInfo = semanticNormalizationService.normalizeMedication(genericName);
      const brandNames = new Set<string>();
      
      const mappedPeriods = periods.map(p => {
        brandNames.add(p.originalName);
        const isActive = !p.endDate || new Date(p.endDate) > new Date();
        return {
          startDate: p.startDate,
          endDate: p.endDate,
          dosage: p.dosage,
          isActive,
        };
      });

      history.push({
        genericName: normalizedInfo.genericName,
        brandNames: Array.from(brandNames),
        drugClass: normalizedInfo.drugClass,
        periods: mappedPeriods,
      });
    }

    return history;
  }

  /**
   * Calculate journey statistics
   */
  private calculateStatistics(events: TimelineEvent[]): MedicalJourney["statistics"] {
    return {
      totalEvents: events.length,
      totalLabTests: events.filter(e => e.type === "lab").length,
      totalMedications: events.filter(e => e.type === "medication").length,
      totalVisits: events.filter(e => e.type === "clinical_event").length,
      majorEvents: events.filter(e => e.severity === "major" || e.severity === "urgent").length,
    };
  }

  /**
   * Generate AI-powered 3-sentence status summary
   */
  async generateStatusSummary(
    userId: string,
    events: TimelineEvent[],
    vitalTrends: VitalTrend[],
    medications: MedicationPeriod[]
  ): Promise<string> {
    try {
      // Get patient profile for context
      const [profile] = await db
        .select()
        .from(patientProfiles)
        .where(eq(patientProfiles.userId, userId))
        .limit(1);

      // Prepare summary context
      const activeMedications = medications
        .filter(m => m.periods.some(p => p.isActive))
        .map(m => m.genericName);

      const recentEvents = events.slice(0, 10);
      const majorEvents = events.filter(e => e.severity === "major" || e.severity === "urgent");

      const labTrends = vitalTrends
        .filter(t => t.dataPoints.length >= 2)
        .map(t => `${t.name}: ${t.trend}`)
        .slice(0, 5);

      const lastVisit = recentEvents.find(e => e.type === "clinical_event");
      const lastVisitInfo = lastVisit
        ? `Last visit: ${new Date(lastVisit.date).toLocaleDateString()} with ${lastVisit.provider || "healthcare provider"}`
        : "No recent visits recorded";

      const prompt = `You are a medical AI assistant generating a brief health status summary for a patient's medical journey timeline.

Based on the following health data, generate a 3-sentence summary that:
1. Describes the patient's overall health status or primary conditions
2. Notes any significant improvements or changes
3. Mentions when their last healthcare interaction was

Patient Context:
- Active Medications: ${activeMedications.length > 0 ? activeMedications.join(", ") : "None recorded"}
- Recent Lab Trends: ${labTrends.length > 0 ? labTrends.join("; ") : "No trends available"}
- Major Events: ${majorEvents.length} (${majorEvents.slice(0, 3).map(e => e.normalizedTitle).join(", ") || "None"})
- Recent Events: ${recentEvents.map(e => e.normalizedTitle).join(", ") || "None recorded"}
- ${lastVisitInfo}

Generate a concise, professional 3-sentence summary. Do not include any medical advice. Use past tense for completed events and present tense for ongoing conditions.`;

      const response = await chatComplete({
        model: "fast",
        messages: [
          {
            role: "system",
            content: "You are a HIPAA-compliant medical documentation assistant. Generate brief, factual health summaries without providing medical advice.",
          },
          { role: "user", content: prompt },
        ],
        maxOutputTokens: 200,
        temperature: 0.3,
        dataCategories: ["conditions", "medications", "lab_results", "vitals"],
        purpose: "documentation",
        callerService: "medical-journey-service",
        callerMethod: "generateAISummary",
      });

      return response.content || this.generateFallbackSummary(events, medications);
    } catch (error) {
      console.error("Error generating AI summary:", error);
      return this.generateFallbackSummary(events, medications);
    }
  }

  /**
   * Generate fallback summary when AI is unavailable
   */
  private generateFallbackSummary(
    events: TimelineEvent[],
    medications: MedicationPeriod[]
  ): string {
    const activeMeds = medications.filter(m => m.periods.some(p => p.isActive));
    const lastEvent = events[0];
    const majorEvents = events.filter(e => e.severity === "major");

    let summary = "";

    if (activeMeds.length > 0) {
      summary += `Currently managing health with ${activeMeds.length} active medication${activeMeds.length > 1 ? "s" : ""} including ${activeMeds.slice(0, 2).map(m => m.genericName).join(" and ")}. `;
    } else {
      summary += "No active medications currently on record. ";
    }

    if (majorEvents.length > 0) {
      summary += `Health history includes ${majorEvents.length} significant clinical event${majorEvents.length > 1 ? "s" : ""}. `;
    } else {
      summary += "Health history shows routine care with no major events recorded. ";
    }

    if (lastEvent) {
      const lastDate = new Date(lastEvent.date);
      const monthsAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      summary += `Last recorded activity was ${monthsAgo === 0 ? "this month" : `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago`}.`;
    } else {
      summary += "No recent health activities recorded.";
    }

    return summary;
  }

  /**
   * Get timeline events for a specific date range
   */
  async getTimelineEvents(
    userId: string,
    startDate: Date,
    endDate: Date,
    eventTypes?: TimelineEvent["type"][]
  ): Promise<TimelineEvent[]> {
    const journey = await this.buildMedicalJourney(userId, startDate, endDate);
    
    if (eventTypes && eventTypes.length > 0) {
      return journey.timelineEvents.filter(e => eventTypes.includes(e.type));
    }
    
    return journey.timelineEvents;
  }

  /**
   * Get vital trends for a specific category
   */
  async getVitalTrendsByCategory(
    userId: string,
    category: string
  ): Promise<VitalTrend[]> {
    const journey = await this.buildMedicalJourney(userId);
    return journey.vitalTrends.filter(t => t.category === category);
  }

  /**
   * Generate comprehensive AI-powered health journey summary
   * Designed for 3-6 month overviews shareable with specialists
   */
  async generateHealthJourneySummary(
    userId: string,
    monthsBack: number = 6
  ): Promise<HealthJourneySummary> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    // Get full journey data
    const journey = await this.buildMedicalJourney(userId, startDate, endDate);
    
    // Get patient profile for demographic context
    const [profile] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, userId))
      .limit(1);

    // Extract key clinical data
    const activeMedications = journey.medicationHistory
      .filter(m => m.periods.some(p => p.isActive))
      .map(m => ({
        name: m.genericName,
        drugClass: m.drugClass,
        dosage: m.periods.find(p => p.isActive)?.dosage,
      }));

    const diagnoses = journey.timelineEvents
      .filter(e => e.type === "clinical_event" && e.category === "diagnosis")
      .map(e => e.normalizedTitle);

    const labResults = journey.vitalTrends
      .filter(t => t.dataPoints.length > 0)
      .map(t => ({
        name: t.normalizedName,
        latest: t.latestValue,
        unit: t.unit,
        trend: t.trend,
        category: t.category,
      }));

    const immunizations = journey.timelineEvents
      .filter(e => e.type === "immunization")
      .map(e => ({
        name: e.normalizedTitle,
        date: e.date,
      }));

    const procedures = journey.timelineEvents
      .filter(e => e.severity === "major" || e.severity === "urgent")
      .map(e => ({
        name: e.normalizedTitle,
        date: e.date,
        severity: e.severity,
      }));

    const recentVisits = journey.timelineEvents
      .filter(e => e.type === "clinical_event")
      .slice(0, 5);

    // Build HEDIS-style quality measures context
    const hedisContext = this.buildHedisContext(journey, profile);

    try {
      const prompt = `You are a clinical documentation specialist generating a comprehensive health journey summary for sharing with specialists. Generate a detailed yet concise summary covering the past ${monthsBack} months.

PATIENT DATA:
${profile ? `Demographics: ${profile.gender || "Unknown"}, DOB: ${profile.dateOfBirth || "Not recorded"}` : "Demographics: Not available"}

ACTIVE MEDICATIONS (${activeMedications.length}):
${activeMedications.length > 0 
  ? activeMedications.map(m => `- ${m.name} (${m.drugClass})${m.dosage ? ` - ${m.dosage}` : ""}`).join("\n")
  : "None recorded"}

DIAGNOSES/CONDITIONS:
${diagnoses.length > 0 ? diagnoses.slice(0, 10).join(", ") : "None recorded in this period"}

LAB RESULTS & VITAL TRENDS:
${labResults.length > 0 
  ? labResults.slice(0, 8).map(l => `- ${l.name}: ${l.latest} ${l.unit} (${l.trend})`).join("\n")
  : "No lab data available"}

IMMUNIZATIONS (past ${monthsBack} months):
${immunizations.length > 0 
  ? immunizations.map(i => `- ${i.name} (${new Date(i.date).toLocaleDateString()})`).join("\n")
  : "None recorded"}

MAJOR PROCEDURES/EVENTS:
${procedures.length > 0 
  ? procedures.map(p => `- ${p.name} (${new Date(p.date).toLocaleDateString()}) - ${p.severity}`).join("\n")
  : "None recorded"}

RECENT CARE (last 5 visits):
${recentVisits.length > 0 
  ? recentVisits.map(v => `- ${new Date(v.date).toLocaleDateString()}: ${v.normalizedTitle}${v.provider ? ` with ${v.provider}` : ""}`).join("\n")
  : "No recent visits"}

HEDIS QUALITY MEASURES:
${hedisContext}

STATISTICS:
- Total events: ${journey.statistics.totalEvents}
- Lab tests: ${journey.statistics.totalLabTests}
- Visits: ${journey.statistics.totalVisits}
- Major events: ${journey.statistics.majorEvents}

Generate a JSON response with this exact structure:
{
  "overview": "A 2-3 sentence executive summary of the patient's health status and key concerns",
  "keyFindings": ["Array of 3-5 most clinically relevant findings from this period"],
  "activeConditions": ["Array of active conditions/diagnoses being managed"],
  "medicationSummary": "Brief summary of current medication regimen and any changes",
  "vitalTrends": "Summary of lab values and vital sign trends with clinical significance",
  "recentCareHighlights": "Notable healthcare interactions and outcomes from recent visits",
  "recommendedFollowUp": "Suggested areas of focus based on the data (not medical advice)"
}

Focus on clinical relevance for specialist consultation. Use professional medical terminology. Do not provide treatment recommendations.`;

      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: "You are a HIPAA-compliant clinical documentation specialist. Generate factual, professional health summaries suitable for sharing with specialists. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        maxOutputTokens: 1500,
        jsonMode: true,
        dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals", "immunizations", "clinical_notes"],
        purpose: "documentation",
        callerService: "medical-journey-service",
        callerMethod: "generateJourneySummary",
      });

      const content = response.content;
      if (!content) {
        return this.generateFallbackJourneySummary(journey, startDate, endDate);
      }

      const parsed = JSON.parse(content);

      // Build shareable text version
      const shareableText = this.buildShareableText(parsed, startDate, endDate, profile);

      return {
        overview: parsed.overview || "",
        keyFindings: parsed.keyFindings || [],
        activeConditions: parsed.activeConditions || [],
        medicationSummary: parsed.medicationSummary || "",
        vitalTrends: parsed.vitalTrends || "",
        recentCareHighlights: parsed.recentCareHighlights || "",
        recommendedFollowUp: parsed.recommendedFollowUp || "",
        generatedAt: new Date(),
        dateRange: { start: startDate, end: endDate },
        shareableText,
      };
    } catch (error) {
      console.error("[MedicalJourneyService] Error generating AI summary:", error);
      return this.generateFallbackJourneySummary(journey, startDate, endDate);
    }
  }

  /**
   * Build HEDIS quality measures context
   */
  private buildHedisContext(journey: MedicalJourney, profile: typeof patientProfiles.$inferSelect | undefined): string {
    const measures: string[] = [];

    // Check for common HEDIS measures based on available data
    const hasA1c = journey.vitalTrends.some(t => 
      t.normalizedName.toLowerCase().includes("hemoglobin a1c") || 
      t.normalizedName.toLowerCase().includes("hba1c")
    );
    
    const hasBloodPressure = journey.vitalTrends.some(t => 
      t.normalizedName.toLowerCase().includes("blood pressure") ||
      t.normalizedName.toLowerCase().includes("systolic") ||
      t.normalizedName.toLowerCase().includes("diastolic")
    );

    const hasCholesterol = journey.vitalTrends.some(t => 
      t.normalizedName.toLowerCase().includes("ldl") ||
      t.normalizedName.toLowerCase().includes("cholesterol") ||
      t.normalizedName.toLowerCase().includes("lipid")
    );

    const hasFluShot = journey.timelineEvents.some(e => 
      e.type === "immunization" && 
      e.normalizedTitle.toLowerCase().includes("influenza")
    );

    if (hasA1c) measures.push("Diabetes monitoring (HbA1c): Active");
    if (hasBloodPressure) measures.push("Blood pressure monitoring: Active");
    if (hasCholesterol) measures.push("Cardiovascular risk monitoring: Active");
    if (hasFluShot) measures.push("Influenza immunization: Completed");

    // Medication adherence indicators
    const hasStatins = journey.medicationHistory.some(m => 
      m.drugClass.toLowerCase().includes("statin") ||
      m.genericName.toLowerCase().includes("statin") ||
      m.genericName.toLowerCase().includes("atorvastatin") ||
      m.genericName.toLowerCase().includes("simvastatin")
    );

    if (hasStatins) measures.push("Statin therapy: Active");

    return measures.length > 0 ? measures.join("\n") : "No HEDIS measures recorded in this period";
  }

  /**
   * Build shareable text format of the summary
   */
  private buildShareableText(
    parsed: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
    profile: typeof patientProfiles.$inferSelect | undefined
  ): string {
    const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    
    let text = `PATIENT HEALTH JOURNEY SUMMARY\n`;
    text += `Period: ${dateRange}\n`;
    if (profile) {
      text += `Patient: ${profile.gender || "Unknown"}\n`;
    }
    text += `Generated: ${new Date().toLocaleDateString()}\n`;
    text += `\n---\n\n`;
    
    text += `OVERVIEW\n${parsed.overview || "No overview available"}\n\n`;
    
    const keyFindings = parsed.keyFindings as string[];
    if (keyFindings?.length > 0) {
      text += `KEY FINDINGS\n`;
      keyFindings.forEach((finding, i) => {
        text += `${i + 1}. ${finding}\n`;
      });
      text += `\n`;
    }

    const activeConditions = parsed.activeConditions as string[];
    if (activeConditions?.length > 0) {
      text += `ACTIVE CONDITIONS\n`;
      activeConditions.forEach(condition => {
        text += `• ${condition}\n`;
      });
      text += `\n`;
    }

    if (parsed.medicationSummary) {
      text += `MEDICATIONS\n${parsed.medicationSummary}\n\n`;
    }

    if (parsed.vitalTrends) {
      text += `VITAL TRENDS\n${parsed.vitalTrends}\n\n`;
    }

    if (parsed.recentCareHighlights) {
      text += `RECENT CARE\n${parsed.recentCareHighlights}\n\n`;
    }

    if (parsed.recommendedFollowUp) {
      text += `FOLLOW-UP CONSIDERATIONS\n${parsed.recommendedFollowUp}\n\n`;
    }

    text += `---\nThis summary is for informational purposes only and does not constitute medical advice.\n`;
    text += `Generated by Tabula Medica Health Records\n`;

    return text;
  }

  /**
   * Generate fallback journey summary when AI is unavailable
   */
  private generateFallbackJourneySummary(
    journey: MedicalJourney,
    startDate: Date,
    endDate: Date
  ): HealthJourneySummary {
    const activeMeds = journey.medicationHistory.filter(m => m.periods.some(p => p.isActive));
    const majorEvents = journey.timelineEvents.filter(e => e.severity === "major" || e.severity === "urgent");
    
    const overview = `Health record covering ${journey.statistics.totalEvents} events over the reviewed period. ${activeMeds.length} active medications and ${majorEvents.length} significant clinical events recorded.`;
    
    const keyFindings: string[] = [];
    if (activeMeds.length > 0) {
      keyFindings.push(`Managing ${activeMeds.length} active medication(s)`);
    }
    if (majorEvents.length > 0) {
      keyFindings.push(`${majorEvents.length} major clinical event(s) in period`);
    }
    if (journey.statistics.totalLabTests > 0) {
      keyFindings.push(`${journey.statistics.totalLabTests} lab tests performed`);
    }
    if (journey.statistics.totalVisits > 0) {
      keyFindings.push(`${journey.statistics.totalVisits} healthcare visits`);
    }

    const activeConditions = journey.timelineEvents
      .filter(e => e.category === "diagnosis")
      .map(e => e.normalizedTitle)
      .slice(0, 5);

    const medicationSummary = activeMeds.length > 0
      ? `Currently on ${activeMeds.map(m => m.genericName).join(", ")}`
      : "No active medications recorded";

    const vitalTrends = journey.vitalTrends
      .filter(t => t.latestValue !== undefined)
      .slice(0, 3)
      .map(t => `${t.normalizedName}: ${t.latestValue} ${t.unit} (${t.trend})`)
      .join("; ") || "No vital trend data available";

    const lastVisit = journey.timelineEvents.find(e => e.type === "clinical_event");
    const recentCareHighlights = lastVisit
      ? `Most recent visit: ${new Date(lastVisit.date).toLocaleDateString()} - ${lastVisit.normalizedTitle}`
      : "No recent care visits recorded";

    const shareableText = `HEALTH SUMMARY (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})\n\n${overview}\n\nKey Findings:\n${keyFindings.map(f => `• ${f}`).join("\n")}\n\nMedications: ${medicationSummary}\n\nRecent Care: ${recentCareHighlights}\n\n---\nGenerated by Tabula Medica`;

    return {
      overview,
      keyFindings,
      activeConditions,
      medicationSummary,
      vitalTrends,
      recentCareHighlights,
      recommendedFollowUp: "Please consult with your healthcare provider for personalized guidance.",
      generatedAt: new Date(),
      dateRange: { start: startDate, end: endDate },
      shareableText,
    };
  }
}

export const medicalJourneyService = MedicalJourneyService.getInstance();
