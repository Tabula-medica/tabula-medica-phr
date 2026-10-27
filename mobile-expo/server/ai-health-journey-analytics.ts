// @ts-nocheck
/**
 * AI Health Journey Analytics Service
 * Provides advanced AI-powered analysis of patient health journeys including:
 * - Long-term trend analysis (1 year+)
 * - Medication adherence and interaction detection
 * - Episodes of Care integration
 * - Proactive health risk alerts
 */

import { chatComplete } from "./ai-client";
import { db } from "./db";
import { 
  healthRecords, 
  patientProfiles, 
  episodesOfCare,
  episodeEvents,
  type HealthRecord
} from "@shared/schema";
import { eq, desc, asc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { medicalJourneyService, type MedicalJourney, type VitalTrend } from "./medical-journey-service";


export interface TrendAnalysis {
  vitalName: string;
  normalizedName: string;
  category: string;
  unit: string;
  period: string;
  dataPoints: Array<{ date: Date; value: number }>;
  trend: "improving" | "stable" | "declining" | "fluctuating" | "insufficient_data";
  trendPercentage: number;
  clinicalSignificance: "normal" | "monitor" | "concern" | "urgent";
  aiInterpretation: string;
  referenceRange?: { low: number; high: number };
  averageValue: number;
  minValue: number;
  maxValue: number;
  volatility: number;
}

export interface MedicationAdherenceAnalysis {
  medicationName: string;
  genericName: string;
  drugClass: string;
  prescribedDuration: number;
  expectedRefills: number;
  actualRefills: number;
  adherenceScore: number;
  adherenceLevel: "excellent" | "good" | "moderate" | "poor";
  gaps: Array<{ startDate: Date; endDate: Date; durationDays: number }>;
  aiInsight: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  interactionType: "major" | "moderate" | "minor";
  severity: "high" | "medium" | "low";
  description: string;
  clinicalEffect: string;
  recommendation: string;
}

export interface EpisodeSummary {
  episodeId: string;
  episodeType: string;
  title: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  eventCount: number;
  triggerEvent: string;
  keyEvents: string[];
  aiNarrative: string;
  relatedMedications: string[];
  outcomes: string[];
}

export interface HealthRiskAlert {
  id: string;
  riskType: "vital_trend" | "medication" | "care_gap" | "chronic_condition" | "preventive";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  dataPoints: Record<string, unknown>;
  recommendation: string;
  createdAt: Date;
  expiresAt?: Date;
  isAcknowledged: boolean;
}

export interface EnhancedHealthJourneySummary {
  overview: string;
  keyFindings: string[];
  activeConditions: string[];
  medicationSummary: string;
  
  trendAnalysis: {
    oneYear: TrendAnalysis[];
    significantChanges: string[];
    concerningTrends: string[];
  };
  
  medicationAnalysis: {
    adherenceScores: MedicationAdherenceAnalysis[];
    potentialInteractions: DrugInteraction[];
    overallAdherence: number;
    recommendations: string[];
  };
  
  episodesOfCare: {
    summaries: EpisodeSummary[];
    activeEpisodes: number;
    resolvedEpisodes: number;
    chronicConditions: string[];
  };
  
  riskAlerts: HealthRiskAlert[];
  
  recommendedFollowUp: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  shareableText: string;
}

const DRUG_INTERACTION_DATABASE: Record<string, { interacts: string[]; type: string; effect: string }> = {
  warfarin: {
    interacts: ["aspirin", "ibuprofen", "naproxen", "vitamin e", "fish oil", "ginkgo"],
    type: "major",
    effect: "Increased bleeding risk"
  },
  metformin: {
    interacts: ["contrast dye", "alcohol"],
    type: "major",
    effect: "Risk of lactic acidosis"
  },
  lisinopril: {
    interacts: ["potassium supplements", "spironolactone", "nsaids"],
    type: "moderate",
    effect: "Hyperkalemia risk"
  },
  simvastatin: {
    interacts: ["grapefruit", "amiodarone", "diltiazem", "verapamil", "erythromycin"],
    type: "major",
    effect: "Increased statin toxicity, rhabdomyolysis risk"
  },
  metoprolol: {
    interacts: ["verapamil", "diltiazem", "clonidine"],
    type: "moderate",
    effect: "Bradycardia, hypotension"
  },
  levothyroxine: {
    interacts: ["calcium", "iron", "antacids", "proton pump inhibitors"],
    type: "minor",
    effect: "Reduced thyroid hormone absorption"
  },
  clopidogrel: {
    interacts: ["omeprazole", "esomeprazole"],
    type: "major",
    effect: "Reduced antiplatelet effect"
  },
  ssri: {
    interacts: ["tramadol", "triptans", "maois", "st johns wort"],
    type: "major",
    effect: "Serotonin syndrome risk"
  }
};

const VITAL_REFERENCE_RANGES: Record<string, { low: number; high: number; unit: string }> = {
  "hemoglobin a1c": { low: 4.0, high: 5.6, unit: "%" },
  "blood glucose": { low: 70, high: 100, unit: "mg/dL" },
  "systolic blood pressure": { low: 90, high: 120, unit: "mmHg" },
  "diastolic blood pressure": { low: 60, high: 80, unit: "mmHg" },
  "ldl cholesterol": { low: 0, high: 100, unit: "mg/dL" },
  "hdl cholesterol": { low: 40, high: 60, unit: "mg/dL" },
  "total cholesterol": { low: 0, high: 200, unit: "mg/dL" },
  "triglycerides": { low: 0, high: 150, unit: "mg/dL" },
  "creatinine": { low: 0.7, high: 1.3, unit: "mg/dL" },
  "egfr": { low: 90, high: 120, unit: "mL/min/1.73m2" },
  "tsh": { low: 0.4, high: 4.0, unit: "mIU/L" },
  "hemoglobin": { low: 12.0, high: 17.5, unit: "g/dL" },
  "potassium": { low: 3.5, high: 5.0, unit: "mEq/L" },
  "sodium": { low: 136, high: 145, unit: "mEq/L" },
  "bmi": { low: 18.5, high: 24.9, unit: "kg/m2" }
};

export class AIHealthJourneyAnalyticsService {
  private static instance: AIHealthJourneyAnalyticsService;

  static getInstance(): AIHealthJourneyAnalyticsService {
    if (!AIHealthJourneyAnalyticsService.instance) {
      AIHealthJourneyAnalyticsService.instance = new AIHealthJourneyAnalyticsService();
    }
    return AIHealthJourneyAnalyticsService.instance;
  }

  /**
   * Generate enhanced health journey summary with advanced analytics
   */
  async generateEnhancedJourneySummary(
    userId: string,
    monthsBack: number = 12
  ): Promise<EnhancedHealthJourneySummary> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const journey = await medicalJourneyService.buildMedicalJourney(userId, startDate, endDate);
    
    const [profile] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, userId))
      .limit(1);

    const [trendAnalysis, medicationAnalysis, episodeSummaries, riskAlerts] = await Promise.all([
      this.analyzeVitalTrends(journey, monthsBack),
      this.analyzeMedicationAdherence(userId, journey),
      this.summarizeEpisodesOfCare(userId),
      this.generateHealthRiskAlerts(userId, journey),
    ]);

    try {
      const aiSummary = await this.generateAIEnhancedSummary(
        journey, profile, trendAnalysis, medicationAnalysis, episodeSummaries, riskAlerts, monthsBack
      );
      
      return {
        overview: aiSummary.overview || "",
        keyFindings: aiSummary.keyFindings || [],
        activeConditions: aiSummary.activeConditions || [],
        medicationSummary: aiSummary.medicationSummary || "",
        recommendedFollowUp: aiSummary.recommendedFollowUp || "",
        shareableText: aiSummary.shareableText || "",
        trendAnalysis: {
          oneYear: trendAnalysis,
          significantChanges: this.extractSignificantChanges(trendAnalysis),
          concerningTrends: trendAnalysis
            .filter(t => t.clinicalSignificance === "concern" || t.clinicalSignificance === "urgent")
            .map(t => t.aiInterpretation),
        },
        medicationAnalysis,
        episodesOfCare: {
          summaries: episodeSummaries,
          activeEpisodes: episodeSummaries.filter(e => e.status === "active").length,
          resolvedEpisodes: episodeSummaries.filter(e => e.status === "resolved").length,
          chronicConditions: episodeSummaries
            .filter(e => e.episodeType === "chronic_management")
            .map(e => e.title),
        },
        riskAlerts,
        generatedAt: new Date(),
        dateRange: { start: startDate, end: endDate },
      };
    } catch (error) {
      console.error("[AIHealthJourneyAnalytics] AI generation error:", error);
      return this.generateFallbackEnhancedSummary(
        journey, startDate, endDate, trendAnalysis, medicationAnalysis, episodeSummaries, riskAlerts
      );
    }
  }

  /**
   * Analyze vital and lab trends over extended periods
   */
  async analyzeVitalTrends(journey: MedicalJourney, monthsBack: number): Promise<TrendAnalysis[]> {
    const analyses: TrendAnalysis[] = [];

    for (const vital of journey.vitalTrends) {
      if (vital.dataPoints.length < 2) {
        analyses.push({
          vitalName: vital.name,
          normalizedName: vital.normalizedName,
          category: vital.category,
          unit: vital.unit,
          period: `${monthsBack} months`,
          dataPoints: vital.dataPoints,
          trend: "insufficient_data",
          trendPercentage: 0,
          clinicalSignificance: "normal",
          aiInterpretation: "Insufficient data points for trend analysis",
          averageValue: vital.dataPoints[0]?.value || 0,
          minValue: vital.dataPoints[0]?.value || 0,
          maxValue: vital.dataPoints[0]?.value || 0,
          volatility: 0,
        });
        continue;
      }

      const values = vital.dataPoints.map(d => d.value);
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) / values.length;
      const volatility = Math.sqrt(variance) / avgValue * 100;

      const firstValue = values[0];
      const lastValue = values[values.length - 1];
      const trendPercentage = ((lastValue - firstValue) / firstValue) * 100;

      let trend: TrendAnalysis["trend"];
      if (Math.abs(trendPercentage) < 5) {
        trend = volatility > 20 ? "fluctuating" : "stable";
      } else if (trendPercentage > 5) {
        trend = this.isImprovingTrend(vital.normalizedName, trendPercentage) ? "improving" : "declining";
      } else {
        trend = this.isImprovingTrend(vital.normalizedName, trendPercentage) ? "improving" : "declining";
      }

      const refRange = this.getReferenceRange(vital.normalizedName);
      const clinicalSignificance = this.assessClinicalSignificance(lastValue, refRange, trend);

      const aiInterpretation = await this.generateTrendInterpretation(vital, trend, trendPercentage, refRange);

      analyses.push({
        vitalName: vital.name,
        normalizedName: vital.normalizedName,
        category: vital.category,
        unit: vital.unit,
        period: `${monthsBack} months`,
        dataPoints: vital.dataPoints,
        trend,
        trendPercentage: Math.round(trendPercentage * 10) / 10,
        clinicalSignificance,
        aiInterpretation,
        referenceRange: refRange,
        averageValue: Math.round(avgValue * 10) / 10,
        minValue: Math.round(minValue * 10) / 10,
        maxValue: Math.round(maxValue * 10) / 10,
        volatility: Math.round(volatility * 10) / 10,
      });
    }

    return analyses;
  }

  /**
   * Analyze medication adherence and detect potential interactions
   */
  async analyzeMedicationAdherence(
    userId: string,
    journey: MedicalJourney
  ): Promise<EnhancedHealthJourneySummary["medicationAnalysis"]> {
    const adherenceScores: MedicationAdherenceAnalysis[] = [];
    const potentialInteractions: DrugInteraction[] = [];

    const activeNormalizedNames = journey.medicationHistory
      .filter(m => m.periods.some(p => p.isActive))
      .map(m => m.genericName.toLowerCase());

    for (const med of journey.medicationHistory) {
      const activePeriods = med.periods.filter(p => p.isActive);
      if (activePeriods.length === 0) continue;

      let totalDays = 0;
      let gapDays = 0;
      const gaps: MedicationAdherenceAnalysis["gaps"] = [];

      for (let i = 0; i < med.periods.length; i++) {
        const period = med.periods[i];
        const start = new Date(period.startDate);
        const end = period.endDate ? new Date(period.endDate) : new Date();
        totalDays += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (i > 0 && med.periods[i - 1].endDate) {
          const prevEnd = new Date(med.periods[i - 1].endDate!);
          const gapLength = Math.ceil((start.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24));
          if (gapLength > 7) {
            gapDays += gapLength;
            gaps.push({
              startDate: prevEnd,
              endDate: start,
              durationDays: gapLength,
            });
          }
        }
      }

      const adherenceScore = Math.max(0, Math.min(100, Math.round((1 - gapDays / Math.max(totalDays, 1)) * 100)));
      
      let adherenceLevel: MedicationAdherenceAnalysis["adherenceLevel"];
      if (adherenceScore >= 90) adherenceLevel = "excellent";
      else if (adherenceScore >= 80) adherenceLevel = "good";
      else if (adherenceScore >= 60) adherenceLevel = "moderate";
      else adherenceLevel = "poor";

      const aiInsight = this.generateAdherenceInsight(med.genericName, adherenceScore, gaps.length);

      adherenceScores.push({
        medicationName: med.brandNames[0] || med.genericName,
        genericName: med.genericName,
        drugClass: med.drugClass,
        prescribedDuration: totalDays,
        expectedRefills: Math.floor(totalDays / 30),
        actualRefills: med.periods.length,
        adherenceScore,
        adherenceLevel,
        gaps,
        aiInsight,
      });
    }

    for (const drugName of activeNormalizedNames) {
      const interactions = this.checkDrugInteractions(drugName, activeNormalizedNames);
      potentialInteractions.push(...interactions);
    }

    const uniqueInteractions = potentialInteractions.filter(
      (v, i, a) => a.findIndex(t => 
        (t.drug1 === v.drug1 && t.drug2 === v.drug2) || 
        (t.drug1 === v.drug2 && t.drug2 === v.drug1)
      ) === i
    );

    const overallAdherence = adherenceScores.length > 0
      ? Math.round(adherenceScores.reduce((sum, m) => sum + m.adherenceScore, 0) / adherenceScores.length)
      : 100;

    const recommendations = this.generateMedicationRecommendations(adherenceScores, uniqueInteractions);

    return {
      adherenceScores,
      potentialInteractions: uniqueInteractions,
      overallAdherence,
      recommendations,
    };
  }

  /**
   * Summarize Episodes of Care with AI narratives
   */
  async summarizeEpisodesOfCare(userId: string): Promise<EpisodeSummary[]> {
    const episodesRaw = await db
      .select()
      .from(episodesOfCare)
      .where(eq(episodesOfCare.userId, userId))
      .orderBy(desc(episodesOfCare.startDate))
      .limit(10);
    
    const summaries: EpisodeSummary[] = [];

    for (const episode of episodesRaw) {
      const eventsRaw = await db
        .select()
        .from(episodeEvents)
        .where(eq(episodeEvents.episodeId, episode.id))
        .orderBy(asc(episodeEvents.sequenceOrder));
      
      const events = eventsRaw as Array<{
        id: string;
        episodeId: string;
        eventRole: string;
        eventDescription: string | null;
        sequenceOrder: number;
      }>;

      const triggerEvent = events.find((e) => e.eventRole === "trigger");
      
      const keyEvents = events
        .filter((e) => ["trigger", "procedure", "outcome", "complication"].includes(e.eventRole))
        .slice(0, 5)
        .map((e) => e.eventDescription || "Clinical event");

      const relatedMeds = events
        .filter((e) => e.eventRole === "medication")
        .map((e) => e.eventDescription || "Medication")
        .slice(0, 5);

      const outcomes = events
        .filter((e) => e.eventRole === "outcome")
        .map((e) => e.eventDescription || "Outcome recorded");

      const aiNarrative = await this.generateEpisodeNarrative(episode, events);

      summaries.push({
        episodeId: episode.id,
        episodeType: episode.episodeType,
        title: episode.title,
        status: episode.status,
        startDate: new Date(episode.startDate),
        endDate: episode.endDate ? new Date(episode.endDate) : undefined,
        eventCount: events.length,
        triggerEvent: triggerEvent?.eventDescription || episode.title,
        keyEvents,
        aiNarrative,
        relatedMedications: relatedMeds,
        outcomes,
      });
    }

    return summaries;
  }

  /**
   * Generate proactive health risk alerts
   */
  async generateHealthRiskAlerts(userId: string, journey: MedicalJourney): Promise<HealthRiskAlert[]> {
    const alerts: HealthRiskAlert[] = [];
    const now = new Date();

    for (const vital of journey.vitalTrends) {
      if (vital.dataPoints.length < 2) continue;

      const lastValue = vital.dataPoints[vital.dataPoints.length - 1]?.value;
      const refRange = this.getReferenceRange(vital.normalizedName);

      if (refRange && lastValue) {
        if (lastValue > refRange.high * 1.2 || lastValue < refRange.low * 0.8) {
          alerts.push({
            id: `vital-${vital.normalizedName}-${Date.now()}`,
            riskType: "vital_trend",
            severity: lastValue > refRange.high * 1.5 ? "critical" : "high",
            title: `${vital.name} Out of Range`,
            description: `Your ${vital.name} (${lastValue} ${vital.unit}) is significantly outside the normal range (${refRange.low}-${refRange.high} ${vital.unit}).`,
            dataPoints: { lastValue, referenceRange: refRange },
            recommendation: `Discuss this result with your healthcare provider at your next visit.`,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            isAcknowledged: false,
          });
        } else if (vital.trend === "declining" && vital.dataPoints.length >= 3) {
          const values = vital.dataPoints.map(d => d.value);
          const firstThird = values.slice(0, Math.ceil(values.length / 3));
          const lastThird = values.slice(-Math.ceil(values.length / 3));
          const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
          const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
          const decline = ((firstAvg - lastAvg) / firstAvg) * 100;

          if (decline > 15) {
            alerts.push({
              id: `trend-${vital.normalizedName}-${Date.now()}`,
              riskType: "vital_trend",
              severity: "medium",
              title: `${vital.name} Declining Trend`,
              description: `Your ${vital.name} has shown a ${Math.round(decline)}% decline over the past months.`,
              dataPoints: { firstAvg, lastAvg, decline },
              recommendation: `Monitor this trend and mention it at your next check-up.`,
              createdAt: now,
              isAcknowledged: false,
            });
          }
        }
      }
    }

    const activeMeds = journey.medicationHistory.filter(m => m.periods.some(p => p.isActive));
    const medNames = activeMeds.map(m => m.genericName.toLowerCase());

    for (const med of activeMeds) {
      const interactions = this.checkDrugInteractions(med.genericName.toLowerCase(), medNames);
      const majorInteractions = interactions.filter(i => i.interactionType === "major");

      for (const interaction of majorInteractions) {
        alerts.push({
          id: `interaction-${med.genericName}-${Date.now()}`,
          riskType: "medication",
          severity: "high",
          title: `Potential Drug Interaction`,
          description: `${interaction.drug1} and ${interaction.drug2} may interact: ${interaction.clinicalEffect}`,
          dataPoints: {
            drug1: interaction.drug1,
            drug2: interaction.drug2,
            interactionType: interaction.interactionType,
            severity: interaction.severity,
            clinicalEffect: interaction.clinicalEffect,
          },
          recommendation: interaction.recommendation,
          createdAt: now,
          isAcknowledged: false,
        });
      }
    }

    const lastImmunization = journey.timelineEvents
      .filter(e => e.type === "immunization")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastImmunization || (now.getTime() - new Date(lastImmunization.date).getTime()) > 365 * 24 * 60 * 60 * 1000) {
      alerts.push({
        id: `preventive-immunization-${Date.now()}`,
        riskType: "preventive",
        severity: "low",
        title: "Annual Immunization Review",
        description: "It has been over a year since your last recorded immunization. Consider reviewing your vaccination status.",
        dataPoints: { lastImmunization: lastImmunization?.date },
        recommendation: "Schedule an annual wellness visit to review immunization needs.",
        createdAt: now,
        isAcknowledged: false,
      });
    }

    const chronicMeds = activeMeds.filter(m => 
      ["antihypertensive", "antidiabetic", "statin", "anticoagulant"].some(c => 
        m.drugClass.toLowerCase().includes(c)
      )
    );

    for (const med of chronicMeds) {
      const lastPeriod = med.periods[med.periods.length - 1];
      if (lastPeriod.endDate) {
        const daysSinceEnd = Math.floor((now.getTime() - new Date(lastPeriod.endDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceEnd > 30 && daysSinceEnd < 90) {
          alerts.push({
            id: `refill-${med.genericName}-${Date.now()}`,
            riskType: "medication",
            severity: "medium",
            title: `${med.genericName} Refill May Be Needed`,
            description: `Your ${med.genericName} prescription may have lapsed. Ensure you have an adequate supply of this chronic medication.`,
            dataPoints: { medication: med.genericName, daysSinceEnd },
            recommendation: "Contact your pharmacy or provider for a refill.",
            createdAt: now,
            isAcknowledged: false,
          });
        }
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async generateAIEnhancedSummary(
    journey: MedicalJourney,
    profile: typeof patientProfiles.$inferSelect | undefined,
    trendAnalysis: TrendAnalysis[],
    medicationAnalysis: EnhancedHealthJourneySummary["medicationAnalysis"],
    episodeSummaries: EpisodeSummary[],
    riskAlerts: HealthRiskAlert[],
    monthsBack: number
  ): Promise<Partial<EnhancedHealthJourneySummary>> {
    const activeMedications = journey.medicationHistory
      .filter(m => m.periods.some(p => p.isActive))
      .map(m => m.genericName);

    const concerningTrends = trendAnalysis.filter(t => 
      t.clinicalSignificance === "concern" || t.clinicalSignificance === "urgent"
    );

    const activeEpisodes = episodeSummaries.filter(e => e.status === "active");
    const highPriorityAlerts = riskAlerts.filter(a => a.severity === "critical" || a.severity === "high");

    const prompt = `You are a clinical AI assistant generating a comprehensive health journey analysis. Analyze the following patient data from the past ${monthsBack} months and provide an enhanced summary.

PATIENT DEMOGRAPHICS:
${profile ? `Gender: ${profile.gender || "Unknown"}, DOB: ${profile.dateOfBirth || "Not recorded"}` : "Demographics: Not available"}

ACTIVE MEDICATIONS (${activeMedications.length}):
${activeMedications.slice(0, 10).join(", ") || "None recorded"}

MEDICATION ADHERENCE:
Overall adherence score: ${medicationAnalysis.overallAdherence}%
Potential drug interactions detected: ${medicationAnalysis.potentialInteractions.length}
${medicationAnalysis.potentialInteractions.length > 0 ? medicationAnalysis.potentialInteractions.map(i => `- ${i.drug1} + ${i.drug2}: ${i.clinicalEffect}`).join("\n") : "No significant interactions detected"}

VITAL TRENDS (${monthsBack}-month analysis):
${trendAnalysis.slice(0, 8).map(t => `- ${t.normalizedName}: ${t.trend} (${t.trendPercentage > 0 ? "+" : ""}${t.trendPercentage}%), Current avg: ${t.averageValue} ${t.unit}, Clinical status: ${t.clinicalSignificance}`).join("\n")}

CONCERNING TRENDS:
${concerningTrends.length > 0 ? concerningTrends.map(t => `- ${t.normalizedName}: ${t.aiInterpretation}`).join("\n") : "No concerning trends identified"}

EPISODES OF CARE (${episodeSummaries.length} total):
Active: ${activeEpisodes.map(e => e.title).join(", ") || "None active"}
Recent: ${episodeSummaries.slice(0, 5).map(e => `${e.title} (${e.status})`).join(", ")}

HIGH PRIORITY ALERTS (${highPriorityAlerts.length}):
${highPriorityAlerts.map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join("\n") || "No high priority alerts"}

JOURNEY STATISTICS:
- Total events: ${journey.statistics.totalEvents}
- Lab tests: ${journey.statistics.totalLabTests}
- Visits: ${journey.statistics.totalVisits}
- Major events: ${journey.statistics.majorEvents}

Generate a JSON response with this structure:
{
  "overview": "A comprehensive 3-4 sentence executive summary highlighting the most important health status observations, trend patterns, and any areas requiring attention",
  "keyFindings": ["Array of 5-7 most clinically significant findings from the extended analysis period"],
  "activeConditions": ["Array of currently active conditions being managed"],
  "medicationSummary": "Detailed summary of medication regimen including adherence patterns and any interaction concerns",
  "recommendedFollowUp": "Prioritized list of recommended follow-up actions based on the comprehensive analysis",
  "shareableText": "A professional, shareable summary suitable for specialist consultations (300-400 words)"
}

Focus on longitudinal patterns, identify subtle trends that may not be apparent in shorter-term analysis, and highlight any areas where proactive intervention may be beneficial. Use professional medical terminology appropriate for sharing with specialists.`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: "You are a HIPAA-compliant clinical analytics AI specializing in longitudinal health data analysis. Generate comprehensive, actionable health summaries that identify patterns, risks, and opportunities for proactive care. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      maxOutputTokens: 2500,
      jsonMode: true,
      dataCategories: ["demographics", "conditions", "medications", "lab_results", "vitals", "clinical_notes"],
      purpose: "health_analytics",
      callerService: "ai-health-journey-analytics",
      callerMethod: "generateAIEnhancedSummary",
    });

    const content = response.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = JSON.parse(content);

    return {
      overview: parsed.overview || "",
      keyFindings: parsed.keyFindings || [],
      activeConditions: parsed.activeConditions || [],
      medicationSummary: parsed.medicationSummary || "",
      recommendedFollowUp: parsed.recommendedFollowUp || "",
      shareableText: parsed.shareableText || "",
    };
  }

  private generateFallbackEnhancedSummary(
    journey: MedicalJourney,
    startDate: Date,
    endDate: Date,
    trendAnalysis: TrendAnalysis[],
    medicationAnalysis: EnhancedHealthJourneySummary["medicationAnalysis"],
    episodeSummaries: EpisodeSummary[],
    riskAlerts: HealthRiskAlert[]
  ): EnhancedHealthJourneySummary {
    const activeMeds = journey.medicationHistory.filter(m => m.periods.some(p => p.isActive));
    const concerningTrends = trendAnalysis.filter(t => 
      t.clinicalSignificance === "concern" || t.clinicalSignificance === "urgent"
    );

    const overview = `Health journey analysis covering ${journey.statistics.totalEvents} events over the past year. ` +
      `Currently managing ${activeMeds.length} active medications with ${medicationAnalysis.overallAdherence}% overall adherence. ` +
      `${concerningTrends.length} vital signs require monitoring. ${riskAlerts.length} health alerts identified.`;

    const keyFindings: string[] = [];
    if (concerningTrends.length > 0) {
      keyFindings.push(`${concerningTrends.length} vital trend(s) showing concerning patterns`);
    }
    if (medicationAnalysis.potentialInteractions.length > 0) {
      keyFindings.push(`${medicationAnalysis.potentialInteractions.length} potential drug interaction(s) identified`);
    }
    if (medicationAnalysis.overallAdherence < 80) {
      keyFindings.push(`Medication adherence below optimal levels (${medicationAnalysis.overallAdherence}%)`);
    }
    keyFindings.push(`${journey.statistics.totalLabTests} lab tests recorded in analysis period`);
    keyFindings.push(`${episodeSummaries.filter(e => e.status === "active").length} active episodes of care`);

    return {
      overview,
      keyFindings,
      activeConditions: episodeSummaries
        .filter(e => e.episodeType === "chronic_management" && e.status === "active")
        .map(e => e.title),
      medicationSummary: `${activeMeds.length} active medications. Adherence: ${medicationAnalysis.overallAdherence}%. ${medicationAnalysis.potentialInteractions.length} interaction alerts.`,
      trendAnalysis: {
        oneYear: trendAnalysis,
        significantChanges: this.extractSignificantChanges(trendAnalysis),
        concerningTrends: concerningTrends.map(t => t.aiInterpretation),
      },
      medicationAnalysis,
      episodesOfCare: {
        summaries: episodeSummaries,
        activeEpisodes: episodeSummaries.filter(e => e.status === "active").length,
        resolvedEpisodes: episodeSummaries.filter(e => e.status === "resolved").length,
        chronicConditions: episodeSummaries
          .filter(e => e.episodeType === "chronic_management")
          .map(e => e.title),
      },
      riskAlerts,
      recommendedFollowUp: riskAlerts.length > 0 
        ? `Address ${riskAlerts.filter(a => a.severity === "high" || a.severity === "critical").length} high-priority alerts. Review medication interactions with provider.`
        : "Continue routine monitoring and scheduled follow-ups.",
      generatedAt: new Date(),
      dateRange: { start: startDate, end: endDate },
      shareableText: overview,
    };
  }

  private isImprovingTrend(vitalName: string, change: number): boolean {
    const lowerIsGood = [
      "hemoglobin a1c", "blood glucose", "ldl cholesterol", "triglycerides",
      "systolic blood pressure", "diastolic blood pressure", "bmi", "weight"
    ];
    const normalizedName = vitalName.toLowerCase();
    return lowerIsGood.some(v => normalizedName.includes(v)) ? change < 0 : change > 0;
  }

  private getReferenceRange(vitalName: string): { low: number; high: number } | undefined {
    const normalizedName = vitalName.toLowerCase();
    for (const [key, range] of Object.entries(VITAL_REFERENCE_RANGES)) {
      if (normalizedName.includes(key)) {
        return range;
      }
    }
    return undefined;
  }

  private assessClinicalSignificance(
    value: number,
    refRange: { low: number; high: number } | undefined,
    trend: TrendAnalysis["trend"]
  ): TrendAnalysis["clinicalSignificance"] {
    if (!refRange) return "normal";

    if (value > refRange.high * 1.3 || value < refRange.low * 0.7) {
      return "urgent";
    }
    if (value > refRange.high * 1.1 || value < refRange.low * 0.9) {
      return "concern";
    }
    if (value > refRange.high || value < refRange.low || trend === "declining") {
      return "monitor";
    }
    return "normal";
  }

  private async generateTrendInterpretation(
    vital: VitalTrend,
    trend: TrendAnalysis["trend"],
    trendPercentage: number,
    refRange: { low: number; high: number } | undefined
  ): Promise<string> {
    const lastValue = vital.dataPoints[vital.dataPoints.length - 1]?.value;
    let interpretation = `${vital.normalizedName} has been ${trend} `;
    
    if (trend === "stable") {
      interpretation += `over the analysis period, maintaining relatively consistent values.`;
    } else if (trend === "improving") {
      interpretation += `by ${Math.abs(trendPercentage).toFixed(1)}%, showing positive progress.`;
    } else if (trend === "declining") {
      interpretation += `by ${Math.abs(trendPercentage).toFixed(1)}%, which may warrant attention.`;
    } else if (trend === "fluctuating") {
      interpretation += `with significant variability, suggesting unstable control.`;
    } else {
      interpretation = `Insufficient data points to establish a reliable trend for ${vital.normalizedName}.`;
    }

    if (refRange && lastValue) {
      if (lastValue > refRange.high) {
        interpretation += ` Current value (${lastValue} ${vital.unit}) is above the reference range (${refRange.low}-${refRange.high}).`;
      } else if (lastValue < refRange.low) {
        interpretation += ` Current value (${lastValue} ${vital.unit}) is below the reference range (${refRange.low}-${refRange.high}).`;
      } else {
        interpretation += ` Current value (${lastValue} ${vital.unit}) is within the normal reference range.`;
      }
    }

    return interpretation;
  }

  private generateAdherenceInsight(medicationName: string, score: number, gapCount: number): string {
    if (score >= 90) {
      return `Excellent adherence to ${medicationName}. Continue current medication routine.`;
    } else if (score >= 80) {
      return `Good adherence to ${medicationName}. Minor gaps detected but overall consistent.`;
    } else if (score >= 60) {
      return `Moderate adherence to ${medicationName}. ${gapCount} gap(s) in medication coverage detected. Consider discussing barriers with provider.`;
    } else {
      return `Poor adherence to ${medicationName}. Significant gaps in medication coverage. Discuss challenges with your healthcare team.`;
    }
  }

  private checkDrugInteractions(drugName: string, allDrugs: string[]): DrugInteraction[] {
    const interactions: DrugInteraction[] = [];
    const normalizedDrug = drugName.toLowerCase();

    for (const [drug, info] of Object.entries(DRUG_INTERACTION_DATABASE)) {
      if (normalizedDrug.includes(drug)) {
        for (const interactsWith of info.interacts) {
          if (allDrugs.some(d => d.includes(interactsWith) && d !== normalizedDrug)) {
            interactions.push({
              drug1: drugName,
              drug2: interactsWith,
              interactionType: info.type as DrugInteraction["interactionType"],
              severity: info.type === "major" ? "high" : info.type === "moderate" ? "medium" : "low",
              description: `${drugName} may interact with ${interactsWith}`,
              clinicalEffect: info.effect,
              recommendation: `Monitor for ${info.effect.toLowerCase()}. Consult your healthcare provider.`,
            });
          }
        }
      }
    }

    return interactions;
  }

  private generateMedicationRecommendations(
    adherenceScores: MedicationAdherenceAnalysis[],
    interactions: DrugInteraction[]
  ): string[] {
    const recommendations: string[] = [];

    const poorAdherence = adherenceScores.filter(m => m.adherenceLevel === "poor" || m.adherenceLevel === "moderate");
    if (poorAdherence.length > 0) {
      recommendations.push(`Discuss medication adherence strategies for: ${poorAdherence.map(m => m.medicationName).join(", ")}`);
    }

    const majorInteractions = interactions.filter(i => i.interactionType === "major");
    if (majorInteractions.length > 0) {
      recommendations.push(`Review potential interactions: ${majorInteractions.map(i => `${i.drug1}/${i.drug2}`).join(", ")}`);
    }

    if (adherenceScores.some(m => m.gaps.length > 2)) {
      recommendations.push("Consider setting up medication reminders or using a pill organizer");
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue current medication regimen with regular monitoring");
    }

    return recommendations;
  }

  private async generateEpisodeNarrative(episode: any, events: any[]): Promise<string> {
    const eventTypes = events.map(e => e.eventRole);
    const uniqueTypes = [...new Set(eventTypes)];
    
    const durationDays = episode.endDate 
      ? Math.ceil((new Date(episode.endDate).getTime() - new Date(episode.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.ceil((new Date().getTime() - new Date(episode.startDate).getTime()) / (1000 * 60 * 60 * 24));

    let narrative = `${episode.title} - ${episode.episodeType.replace(/_/g, " ")} episode `;
    narrative += episode.status === "active" ? `ongoing for ${durationDays} days. ` : `resolved after ${durationDays} days. `;
    narrative += `Includes ${events.length} related events (${uniqueTypes.join(", ")}). `;
    
    if (events.some(e => e.eventRole === "outcome")) {
      narrative += "Outcomes have been recorded.";
    } else if (episode.status === "active") {
      narrative += "Awaiting final outcomes.";
    }

    return narrative;
  }

  private extractSignificantChanges(trends: TrendAnalysis[]): string[] {
    return trends
      .filter(t => Math.abs(t.trendPercentage) > 10 && t.trend !== "insufficient_data")
      .map(t => `${t.normalizedName}: ${t.trendPercentage > 0 ? "+" : ""}${t.trendPercentage}% over ${t.period}`);
  }
}

export const aiHealthJourneyAnalyticsService = AIHealthJourneyAnalyticsService.getInstance();
