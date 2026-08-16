import { generatePhiSafeText } from "./services/ai-gateway";
import type {
  MedicationReminder,
  MedicationAdherenceRecord,
  DrugInteraction,
  MedicationAIInsight,
  AdherenceCoachingSession,
  Medication
} from "@shared/schema";

export interface AdherencePrediction {
  patientId: string;
  medicationId: string;
  medicationName: string;
  currentAdherenceRate: number;
  predictedAdherenceRate: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskFactors: string[];
  predictedIssues: string[];
  suggestedInterventions: string[];
  confidence: number;
  analysisDate: string;
}

export interface PersonalizedReminder {
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  personalizedMessage: string;
  educationalTip: string;
  motivationalNote: string;
}

export interface DrugInteractionAlert {
  id: string;
  medications: { id: string; name: string; dosage: string }[];
  severity: "minor" | "moderate" | "major" | "contraindicated";
  interactionType: string;
  description: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendations: string[];
  alternativeOptions?: string[];
  monitoringRequired: string[];
  aiConfidence: number;
  detectedAt: string;
}

export interface MedicationEducation {
  medicationId: string;
  medicationName: string;
  purpose: string;
  howItWorks: string;
  commonSideEffects: string[];
  importantWarnings: string[];
  bestPractices: string[];
  foodInteractions: string[];
  lifestyleTips: string[];
}

// New interfaces for enhanced medication management
export interface RefillReminder {
  medicationId: string;
  medicationName: string;
  dosage: string;
  refillsRemaining: number;
  daysUntilRefillNeeded: number;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  reminderMessage: string;
  refillInstructions: string;
  pharmacyInfo?: string;
  canRequestRefill: boolean;
  refillRequestOptions: RefillRequestOption[];
}

export interface RefillRequestOption {
  id: string;
  method: "pharmacy_call" | "app_request" | "provider_message" | "mail_order";
  label: string;
  description: string;
  estimatedTime: string;
}

export interface AdherencePatternAnalysis {
  patientId: string;
  analysisDate: string;
  overallAdherenceRate: number;
  patterns: AdherencePattern[];
  risks: AdherenceRisk[];
  insights: string[];
  recommendations: string[];
  trendDirection: "improving" | "stable" | "declining";
  confidence: number;
}

export interface AdherencePattern {
  patternType: "time_of_day" | "day_of_week" | "missed_consecutive" | "seasonal" | "lifestyle";
  description: string;
  frequency: string;
  impact: "positive" | "neutral" | "negative";
  dataPoints: number;
}

export interface AdherenceRisk {
  riskType: "non_adherence" | "overdose" | "missed_doses" | "timing_issues" | "drug_holiday";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedMedications: string[];
  mitigationStrategies: string[];
}

export interface SideEffectTip {
  sideEffect: string;
  severity: "mild" | "moderate" | "severe";
  managementTips: string[];
  whenToSeekHelp: string;
  lifestyleAdjustments: string[];
  relatedMedications: string[];
}

export interface AdherenceTip {
  tipId: string;
  category: "timing" | "routine" | "reminder" | "motivation" | "barrier_removal" | "lifestyle";
  title: string;
  description: string;
  actionableSteps: string[];
  expectedBenefit: string;
  personalizedReason: string;
}

export interface MedicationIntakeReport {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  reportedAt: string;
  reportMethod: "voice" | "text" | "button";
  action: "taken" | "skipped" | "delayed";
  notes?: string;
  sideEffectsReported: SideEffectReport[];
  aiAcknowledgment: string;
  followUpSuggestion?: string;
}

export interface SideEffectReport {
  id: string;
  patientId: string;
  medicationId?: string;
  medicationName?: string;
  reportedAt: string;
  reportMethod: "voice" | "text";
  sideEffect: string;
  severity: "mild" | "moderate" | "severe";
  duration?: string;
  frequency?: string;
  notes?: string;
  aiAnalysis: string;
  recommendations: string[];
  requiresProviderAttention: boolean;
}

export interface VoiceCommandResult {
  success: boolean;
  command: string;
  action: "intake_logged" | "side_effect_reported" | "refill_requested" | "info_retrieved" | "unknown";
  response: string;
  data?: MedicationIntakeReport | SideEffectReport | RefillReminder;
}

// Safe verb helper - ensures all AI content uses only approved verbs
function ensureSafeContent(text: string): string {
  const unsafePatterns = [
    { pattern: /\bshould\b/gi, replacement: "may consider" },
    { pattern: /\bmust\b/gi, replacement: "states that" },
    { pattern: /\brecommend\b/gi, replacement: "shows" },
    { pattern: /\brecommends\b/gi, replacement: "shows" },
    { pattern: /\brecommendation\b/gi, replacement: "information" },
    { pattern: /\badvise\b/gi, replacement: "refers to" },
    { pattern: /\badvises\b/gi, replacement: "refers to" },
    { pattern: /\bsuggests?\b/gi, replacement: "shows" },
    { pattern: /\bneed to\b/gi, replacement: "may" },
    { pattern: /\bhave to\b/gi, replacement: "may" },
    { pattern: /\brequires?\b/gi, replacement: "means" },
  ];
  
  let safeText = text;
  for (const { pattern, replacement } of unsafePatterns) {
    safeText = safeText.replace(pattern, replacement);
  }
  return safeText;
}

export class AIMedicationService {
  async predictAdherenceIssues(
    patientId: string,
    medications: Medication[],
    adherenceHistory: MedicationAdherenceRecord[],
    patientConditions?: string[]
  ): Promise<AdherencePrediction[]> {
    const predictions: AdherencePrediction[] = [];

    for (const medication of medications) {
      const medHistory = adherenceHistory.filter(h => h.medicationId === medication.id);
      const takenCount = medHistory.filter(h => h.action === "taken").length;
      const totalCount = medHistory.length || 1;
      const currentRate = Math.round((takenCount / totalCount) * 100);

      const missedReasons = medHistory
        .filter(h => h.missedReason)
        .map(h => h.missedReason);

      try {
        const responseText = await generatePhiSafeText({
          system: `You are a clinical pharmacist AI assistant specializing in medication adherence prediction. Analyze patient medication patterns and predict potential adherence issues. Respond ONLY with valid JSON.`,
          user: `Analyze adherence for patient medication:
Medication: ${medication.name} (${medication.dosage})
Current adherence rate: ${currentRate}%
Recent history: ${medHistory.length} doses tracked
Missed reasons: ${missedReasons.length > 0 ? missedReasons.join(", ") : "None recorded"}
Patient conditions: ${patientConditions?.join(", ") || "Not specified"}

Provide JSON with:
{
  "predictedAdherenceRate": number (0-100),
  "riskLevel": "low" | "moderate" | "high" | "critical",
  "riskFactors": string[],
  "predictedIssues": string[],
  "suggestedInterventions": string[],
  "confidence": number (0-100)
}`,
          maxTokens: 1000,
          responseMimeType: "application/json",
        });

        const analysis = JSON.parse(responseText || "{}");
        
        predictions.push({
          patientId,
          medicationId: medication.id,
          medicationName: medication.name,
          currentAdherenceRate: currentRate,
          predictedAdherenceRate: analysis.predictedAdherenceRate ?? currentRate,
          riskLevel: analysis.riskLevel ?? "low",
          riskFactors: analysis.riskFactors ?? [],
          predictedIssues: analysis.predictedIssues ?? [],
          suggestedInterventions: analysis.suggestedInterventions ?? [],
          confidence: analysis.confidence ?? 70,
          analysisDate: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Error predicting adherence for ${medication.name}:`, error);
        predictions.push({
          patientId,
          medicationId: medication.id,
          medicationName: medication.name,
          currentAdherenceRate: currentRate,
          predictedAdherenceRate: currentRate,
          riskLevel: currentRate > 80 ? "low" : currentRate > 60 ? "moderate" : "high",
          riskFactors: ["Unable to analyze - using basic metrics"],
          predictedIssues: [],
          suggestedInterventions: ["Continue monitoring adherence patterns"],
          confidence: 50,
          analysisDate: new Date().toISOString()
        });
      }
    }

    return predictions;
  }

  async generatePersonalizedReminders(
    patientId: string,
    patientName: string,
    medications: Medication[],
    adherenceHistory: MedicationAdherenceRecord[],
    preferences?: { language?: string; reminderStyle?: string }
  ): Promise<PersonalizedReminder[]> {
    const reminders: PersonalizedReminder[] = [];

    for (const medication of medications) {
      const medHistory = adherenceHistory.filter(h => h.medicationId === medication.id);
      const recentMisses = medHistory.filter(h => h.action === "missed" || h.action === "skipped").slice(-5);

      try {
        const responseText = await generatePhiSafeText({
          system: `You are a compassionate health coach AI. Generate personalized, encouraging medication reminders. Be warm but professional. Use the patient's name naturally. Respond ONLY with valid JSON.`,
          user: `Create a personalized medication reminder:
Patient: ${patientName}
Medication: ${medication.name}
Dosage: ${medication.dosage}
Purpose: Health maintenance
Recent misses: ${recentMisses.length}
Last missed reasons: ${recentMisses.map(m => m.missedReason).filter(Boolean).join(", ") || "None"}
Preferred language: ${preferences?.language || "English"}
Reminder style: ${preferences?.reminderStyle || "Friendly and supportive"}

Provide JSON with:
{
  "personalizedMessage": "Brief, personalized reminder message (2-3 sentences)",
  "educationalTip": "One helpful tip about this medication",
  "motivationalNote": "Short encouraging message"
}`,
          maxTokens: 800,
          responseMimeType: "application/json",
        });

        const result = JSON.parse(responseText || "{}");
        
        reminders.push({
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime: new Date().toISOString(),
          personalizedMessage: result.personalizedMessage || `Time to take your ${medication.name}.`,
          educationalTip: result.educationalTip || `Taking ${medication.name} at the same time each day helps maintain consistent levels.`,
          motivationalNote: result.motivationalNote || "Every dose counts toward better health!"
        });
      } catch (error) {
        console.error(`Error generating reminder for ${medication.name}:`, error);
        reminders.push({
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime: new Date().toISOString(),
          personalizedMessage: `Hi ${patientName}, it's time to take your ${medication.name} (${medication.dosage}).`,
          educationalTip: `Consistency is key - try to take ${medication.name} at the same time each day.`,
          motivationalNote: "You're doing great! Every dose matters."
        });
      }
    }

    return reminders;
  }

  async analyzeDrugInteractions(
    patientId: string,
    medications: Medication[],
    patientAllergies?: string[],
    patientConditions?: string[]
  ): Promise<DrugInteractionAlert[]> {
    if (medications.length < 2) {
      return [];
    }

    const alerts: DrugInteractionAlert[] = [];
    const medicationPairs: [Medication, Medication][] = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        medicationPairs.push([medications[i], medications[j]]);
      }
    }

    for (const [med1, med2] of medicationPairs) {
      try {
        const responseText = await generatePhiSafeText({
          system: `You are a clinical pharmacology AI expert. Analyze potential drug-drug interactions with high accuracy. Be conservative - flag potential issues even if uncertain. Always prioritize patient safety. Respond ONLY with valid JSON.`,
          user: `Analyze drug interaction between:
Medication 1: ${med1.name} (${med1.dosage})
Medication 2: ${med2.name} (${med2.dosage})
Patient allergies: ${patientAllergies?.join(", ") || "None known"}
Patient conditions: ${patientConditions?.join(", ") || "Not specified"}

Provide JSON with:
{
  "hasInteraction": boolean,
  "severity": "none" | "minor" | "moderate" | "major" | "contraindicated",
  "interactionType": string,
  "description": string,
  "clinicalEffects": string[],
  "riskFactors": string[],
  "recommendations": string[],
  "alternativeOptions": string[],
  "monitoringRequired": string[],
  "confidence": number (0-100)
}`,
          maxTokens: 1200,
          responseMimeType: "application/json",
        });

        const analysis = JSON.parse(responseText || "{}");
        
        if (analysis.hasInteraction && analysis.severity !== "none") {
          alerts.push({
            id: `interaction-${med1.id}-${med2.id}-${Date.now()}`,
            medications: [
              { id: med1.id, name: med1.name, dosage: med1.dosage },
              { id: med2.id, name: med2.name, dosage: med2.dosage }
            ],
            severity: analysis.severity,
            interactionType: analysis.interactionType || "Drug-drug interaction",
            description: analysis.description || "Potential interaction detected",
            clinicalEffects: analysis.clinicalEffects || [],
            riskFactors: analysis.riskFactors || [],
            recommendations: analysis.recommendations || ["Consult with your healthcare provider"],
            alternativeOptions: analysis.alternativeOptions,
            monitoringRequired: analysis.monitoringRequired || [],
            aiConfidence: analysis.confidence || 70,
            detectedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Error analyzing interaction between ${med1.name} and ${med2.name}:`, error);
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });
  }

  async generateMedicationEducation(
    medication: Medication,
    patientReadingLevel?: "basic" | "intermediate" | "advanced"
  ): Promise<MedicationEducation> {
    try {
      const responseText = await generatePhiSafeText({
        system: `You are a patient education specialist. Provide clear, accurate medication information at an appropriate reading level. Use plain language and avoid medical jargon unless necessary. Always encourage patients to discuss concerns with their healthcare provider. Respond ONLY with valid JSON.`,
        user: `Create patient education content for:
Medication: ${medication.name}
Dosage: ${medication.dosage}
Prescribed for: As directed by healthcare provider
Reading level: ${patientReadingLevel || "intermediate"}

Provide JSON with:
{
  "purpose": "Brief explanation of what this medication treats",
  "howItWorks": "Simple explanation of how the medication works in the body",
  "commonSideEffects": ["List of common, usually mild side effects"],
  "importantWarnings": ["Key warnings patients should know"],
  "bestPractices": ["Tips for taking this medication correctly"],
  "foodInteractions": ["Foods to avoid or considerations"],
  "lifestyleTips": ["Lifestyle adjustments that may help"]
}`,
        maxTokens: 1500,
        responseMimeType: "application/json",
      });

      const education = JSON.parse(responseText || "{}");

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        purpose: education.purpose || `${medication.name} is prescribed to help manage your health condition.`,
        howItWorks: education.howItWorks || "This medication works to improve your health as directed by your provider.",
        commonSideEffects: education.commonSideEffects || ["Effects vary by individual"],
        importantWarnings: education.importantWarnings || ["Always take as prescribed"],
        bestPractices: education.bestPractices || ["Take at the same time each day"],
        foodInteractions: education.foodInteractions || ["Ask your pharmacist about food interactions"],
        lifestyleTips: education.lifestyleTips || ["Maintain a healthy lifestyle"]
      };
    } catch (error) {
      console.error(`Error generating education for ${medication.name}:`, error);
      return {
        medicationId: medication.id,
        medicationName: medication.name,
        purpose: `${medication.name} has been prescribed by your healthcare provider.`,
        howItWorks: "Please consult your pharmacist for detailed information.",
        commonSideEffects: ["Consult your healthcare provider for information about side effects"],
        importantWarnings: ["Take only as directed", "Contact your provider if you experience unusual symptoms"],
        bestPractices: ["Take at the same time each day", "Keep a regular schedule"],
        foodInteractions: ["Ask your pharmacist about any food interactions"],
        lifestyleTips: ["Follow your healthcare provider's recommendations"]
      };
    }
  }

  async generateAdherenceCoaching(
    patientId: string,
    patientName: string,
    medication: Medication,
    recentMisses: MedicationAdherenceRecord[],
    sessionType: "barrier_analysis" | "motivation" | "habit_building" | "problem_solving" | "check_in"
  ): Promise<Omit<AdherenceCoachingSession, "id" | "createdAt" | "isCompleted" | "completedAt">> {
    const missedReasons = recentMisses.map(m => m.missedReason).filter(Boolean);
    const commonReason = missedReasons.length > 0 
      ? missedReasons.reduce((a, b) => 
          missedReasons.filter(v => v === a).length >= missedReasons.filter(v => v === b).length ? a : b
        )
      : null;

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a supportive medication adherence coach. Provide empathetic, practical guidance to help patients stay on track with their medications. Focus on understanding barriers and offering realistic solutions. Respond ONLY with valid JSON.`,
        user: `Create a ${sessionType} coaching session:
Patient: ${patientName}
Medication: ${medication.name} (${medication.dosage})
Recent misses: ${recentMisses.length} in the past week
Main barrier: ${commonReason || "Unknown"}
Session purpose: ${sessionType}

Provide JSON with:
{
  "aiAnalysis": "Brief, empathetic analysis of the patient's situation",
  "recommendations": ["3-4 specific, actionable recommendations"],
  "actionPlan": ["2-3 concrete steps the patient can take today"],
  "motivationalMessage": "Encouraging message that acknowledges challenges while inspiring hope"
}`,
        maxTokens: 1200,
        responseMimeType: "application/json",
      });

      const coaching = JSON.parse(responseText || "{}");

      return {
        patientId,
        medicationId: medication.id,
        medicationName: medication.name,
        sessionType,
        triggerReason: `${recentMisses.length} missed doses detected`,
        aiAnalysis: coaching.aiAnalysis || "We noticed some challenges with your medication routine.",
        recommendations: coaching.recommendations || ["Consider setting daily reminders"],
        actionPlan: coaching.actionPlan || ["Start with one small change today"],
        motivationalMessage: coaching.motivationalMessage || "Small steps lead to big improvements. You've got this!",
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error("Error generating coaching session:", error);
      return {
        patientId,
        medicationId: medication.id,
        medicationName: medication.name,
        sessionType,
        triggerReason: `${recentMisses.length} missed doses detected`,
        aiAnalysis: "We noticed you've had some challenges staying on track with your medication recently.",
        recommendations: [
          "Set a daily alarm as a reminder",
          "Keep your medication visible and accessible",
          "Consider using a pill organizer"
        ],
        actionPlan: [
          "Choose one time each day for your medication",
          "Place your medication where you'll see it"
        ],
        motivationalMessage: "Every day is a fresh start. You're taking an important step by engaging with your health!"
      };
    }
  }

  // Generate AI-powered refill reminders with request options
  async generateRefillReminders(
    patientId: string,
    medications: Medication[],
    adherenceRecords: MedicationAdherenceRecord[]
  ): Promise<RefillReminder[]> {
    const reminders: RefillReminder[] = [];

    for (const medication of medications) {
      // Calculate days until refill needed based on dosage frequency and start date
      // Default to 30 days supply if not specified
      const daysSupply = 30;
      const startDate = medication.startDate ? new Date(medication.startDate) : new Date();
      const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      // Estimate days remaining based on cycles of refills
      const refillCycles = Math.floor(daysSinceStart / daysSupply);
      const daysIntoCurrentCycle = daysSinceStart % daysSupply;
      const daysRemaining = Math.max(0, daysSupply - daysIntoCurrentCycle);
      const refillsRemaining = medication.refillsRemaining ?? 3;

      // Determine urgency level
      let urgencyLevel: "low" | "medium" | "high" | "critical" = "low";
      if (daysRemaining <= 3 || refillsRemaining === 0) {
        urgencyLevel = "critical";
      } else if (daysRemaining <= 7) {
        urgencyLevel = "high";
      } else if (daysRemaining <= 14) {
        urgencyLevel = "medium";
      }

      try {
        const responseText = await generatePhiSafeText({
          system: `You are a helpful pharmacy assistant AI. Generate refill reminder messages.
CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER use prescriptive language like "should", "must", "recommend", "advise"
3. Be informative and helpful without giving medical advice
Respond ONLY with valid JSON.`,
          user: `Generate a refill reminder:
Medication: ${medication.name} (${medication.dosage})
Days remaining: ${daysRemaining}
Refills remaining: ${refillsRemaining}
Urgency: ${urgencyLevel}
Prescribed by: ${medication.prescribedBy || "Not specified"}

Provide JSON with:
{
  "reminderMessage": "Brief, helpful reminder message about the upcoming refill need",
  "refillInstructions": "Clear steps for obtaining a refill"
}`,
          maxTokens: 800,
          responseMimeType: "application/json",
        });

        const result = JSON.parse(responseText || "{}");

        reminders.push({
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          refillsRemaining,
          daysUntilRefillNeeded: daysRemaining,
          urgencyLevel,
          reminderMessage: ensureSafeContent(result.reminderMessage || `Your ${medication.name} supply shows ${daysRemaining} days remaining.`),
          refillInstructions: ensureSafeContent(result.refillInstructions || "Contact your pharmacy to request a refill."),
          pharmacyInfo: undefined,
          canRequestRefill: refillsRemaining > 0,
          refillRequestOptions: this.getRefillRequestOptions(medication.id, refillsRemaining > 0)
        });
      } catch (error) {
        console.error(`Error generating refill reminder for ${medication.name}:`, error);
        reminders.push({
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          refillsRemaining,
          daysUntilRefillNeeded: daysRemaining,
          urgencyLevel,
          reminderMessage: `Your ${medication.name} supply shows ${daysRemaining} days remaining.`,
          refillInstructions: "Contact your pharmacy or healthcare provider for refill information.",
          pharmacyInfo: undefined,
          canRequestRefill: refillsRemaining > 0,
          refillRequestOptions: this.getRefillRequestOptions(medication.id, refillsRemaining > 0)
        });
      }
    }

    // Sort by urgency
    return reminders.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });
  }

  private getRefillRequestOptions(medicationId: string, hasRefills: boolean): RefillRequestOption[] {
    const options: RefillRequestOption[] = [];

    if (hasRefills) {
      options.push({
        id: `pharmacy-${medicationId}`,
        method: "pharmacy_call",
        label: "Call Pharmacy",
        description: "Contact your pharmacy directly",
        estimatedTime: "1-2 hours"
      });

      options.push({
        id: `app-${medicationId}`,
        method: "app_request",
        label: "Request via App",
        description: "Submit refill request through this app",
        estimatedTime: "24-48 hours"
      });

      options.push({
        id: `mail-${medicationId}`,
        method: "mail_order",
        label: "Mail Order",
        description: "Request 90-day supply via mail order pharmacy",
        estimatedTime: "5-7 days"
      });
    }

    options.push({
      id: `provider-${medicationId}`,
      method: "provider_message",
      label: "Message Provider",
      description: "Send a message to your healthcare provider for a new prescription",
      estimatedTime: "1-3 business days"
    });

    return options;
  }

  // Analyze adherence patterns and identify risks
  async analyzeAdherencePatterns(
    patientId: string,
    medications: Medication[],
    adherenceRecords: MedicationAdherenceRecord[]
  ): Promise<AdherencePatternAnalysis> {
    // Calculate overall adherence
    const totalDoses = adherenceRecords.length || 1;
    const takenDoses = adherenceRecords.filter(r => r.action === "taken").length;
    const overallRate = Math.round((takenDoses / totalDoses) * 100);

    // Analyze patterns from records
    const missedRecords = adherenceRecords.filter(r => r.action === "missed" || r.action === "skipped");
    const missedReasons = missedRecords.map(r => r.missedReason).filter(Boolean);

    // Calculate trend
    const recentRecords = adherenceRecords.slice(-14);
    const olderRecords = adherenceRecords.slice(-28, -14);
    const recentRate = recentRecords.length > 0 
      ? Math.round((recentRecords.filter(r => r.action === "taken").length / recentRecords.length) * 100)
      : overallRate;
    const olderRate = olderRecords.length > 0
      ? Math.round((olderRecords.filter(r => r.action === "taken").length / olderRecords.length) * 100)
      : overallRate;

    let trendDirection: "improving" | "stable" | "declining" = "stable";
    if (recentRate > olderRate + 5) trendDirection = "improving";
    else if (recentRate < olderRate - 5) trendDirection = "declining";

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a clinical analytics AI specializing in medication adherence pattern analysis.
CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER use prescriptive language like "should", "must", "recommend", "advise"
3. Be descriptive and informative without giving medical advice
4. Focus on patterns and observations, not instructions
Respond ONLY with valid JSON.`,
        user: `Analyze medication adherence patterns:
Medications: ${medications.map(m => m.name).join(", ")}
Overall adherence rate: ${overallRate}%
Total doses tracked: ${totalDoses}
Missed doses: ${missedRecords.length}
Common missed reasons: ${missedReasons.slice(0, 5).join(", ") || "None recorded"}
Recent trend: ${trendDirection}
Recent 2-week rate: ${recentRate}%

Provide JSON with:
{
  "patterns": [
    {
      "patternType": "time_of_day" | "day_of_week" | "missed_consecutive" | "seasonal" | "lifestyle",
      "description": "Description of the pattern observed",
      "frequency": "How often this pattern occurs",
      "impact": "positive" | "neutral" | "negative",
      "dataPoints": number
    }
  ],
  "risks": [
    {
      "riskType": "non_adherence" | "overdose" | "missed_doses" | "timing_issues" | "drug_holiday",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Description of the risk",
      "affectedMedications": ["medication names"],
      "mitigationStrategies": ["strategies that may help"]
    }
  ],
  "insights": ["Key observations about adherence patterns"],
  "recommendations": ["Personalized tips based on patterns"]
}`,
        maxTokens: 1500,
        responseMimeType: "application/json",
      });

      const analysis = JSON.parse(responseText || "{}");

      return {
        patientId,
        analysisDate: new Date().toISOString(),
        overallAdherenceRate: overallRate,
        patterns: (analysis.patterns || []).map((p: any) => ({
          ...p,
          description: ensureSafeContent(p.description || "")
        })),
        risks: (analysis.risks || []).map((r: any) => ({
          ...r,
          description: ensureSafeContent(r.description || ""),
          mitigationStrategies: (r.mitigationStrategies || []).map(ensureSafeContent)
        })),
        insights: (analysis.insights || []).map(ensureSafeContent),
        recommendations: (analysis.recommendations || []).map(ensureSafeContent),
        trendDirection,
        confidence: 85
      };
    } catch (error) {
      console.error("Error analyzing adherence patterns:", error);
      return {
        patientId,
        analysisDate: new Date().toISOString(),
        overallAdherenceRate: overallRate,
        patterns: [],
        risks: overallRate < 70 ? [{
          riskType: "non_adherence",
          severity: overallRate < 50 ? "high" : "medium",
          description: "Adherence data shows room for improvement",
          affectedMedications: medications.map(m => m.name),
          mitigationStrategies: ["Setting daily reminders may help", "Keeping medications visible shows positive results"]
        }] : [],
        insights: [`Current adherence rate shows ${overallRate}%`, `Trend direction shows ${trendDirection}`],
        recommendations: ["Regular tracking shows improved outcomes"],
        trendDirection,
        confidence: 60
      };
    }
  }

  // Generate personalized tips for side effects and adherence
  async generatePersonalizedTips(
    patientId: string,
    medications: Medication[],
    adherenceRecords: MedicationAdherenceRecord[],
    reportedSideEffects?: string[]
  ): Promise<{ sideEffectTips: SideEffectTip[]; adherenceTips: AdherenceTip[] }> {
    const sideEffectTips: SideEffectTip[] = [];
    const adherenceTips: AdherenceTip[] = [];

    // Analyze adherence patterns
    const missedRecords = adherenceRecords.filter(r => r.action === "missed" || r.action === "skipped");
    const missedReasons = missedRecords.map(r => r.missedReason).filter(Boolean);

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a patient support AI providing personalized health tips.
CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER use prescriptive language like "should", "must", "recommend", "advise", "need to"
3. All tips must be educational and informational, not medical advice
4. Always refer patients to healthcare providers for medical decisions
Respond ONLY with valid JSON.`,
        user: `Generate personalized tips:
Medications: ${medications.map(m => `${m.name} (${m.dosage})`).join("; ")}
Reported side effects: ${reportedSideEffects?.join(", ") || "None reported"}
Common missed reasons: ${missedReasons.slice(0, 5).join(", ") || "None recorded"}
Missed dose count: ${missedRecords.length}

Provide JSON with:
{
  "sideEffectTips": [
    {
      "sideEffect": "Side effect name",
      "severity": "mild" | "moderate" | "severe",
      "managementTips": ["Tips for managing this side effect"],
      "whenToSeekHelp": "When to contact healthcare provider",
      "lifestyleAdjustments": ["Lifestyle changes that may help"],
      "relatedMedications": ["Medications commonly associated with this side effect"]
    }
  ],
  "adherenceTips": [
    {
      "tipId": "unique-id",
      "category": "timing" | "routine" | "reminder" | "motivation" | "barrier_removal" | "lifestyle",
      "title": "Brief tip title",
      "description": "Detailed tip description",
      "actionableSteps": ["Concrete steps to implement"],
      "expectedBenefit": "What improvement this may bring",
      "personalizedReason": "Why this tip is relevant to this patient"
    }
  ]
}`,
        maxTokens: 2000,
        responseMimeType: "application/json",
      });

      const result = JSON.parse(responseText || "{}");

      // Apply safe content to all text fields
      for (const tip of result.sideEffectTips || []) {
        sideEffectTips.push({
          sideEffect: tip.sideEffect,
          severity: tip.severity || "mild",
          managementTips: (tip.managementTips || []).map(ensureSafeContent),
          whenToSeekHelp: ensureSafeContent(tip.whenToSeekHelp || "Contact your healthcare provider if symptoms persist"),
          lifestyleAdjustments: (tip.lifestyleAdjustments || []).map(ensureSafeContent),
          relatedMedications: tip.relatedMedications || []
        });
      }

      for (const tip of result.adherenceTips || []) {
        adherenceTips.push({
          tipId: tip.tipId || `tip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: tip.category || "routine",
          title: ensureSafeContent(tip.title || "Adherence Tip"),
          description: ensureSafeContent(tip.description || ""),
          actionableSteps: (tip.actionableSteps || []).map(ensureSafeContent),
          expectedBenefit: ensureSafeContent(tip.expectedBenefit || ""),
          personalizedReason: ensureSafeContent(tip.personalizedReason || "")
        });
      }
    } catch (error) {
      console.error("Error generating personalized tips:", error);

      // Provide default tips
      adherenceTips.push({
        tipId: `default-timing-${Date.now()}`,
        category: "timing",
        title: "Consistent Timing",
        description: "Research shows taking medications at the same time each day helps maintain consistent levels.",
        actionableSteps: ["Choose a time that fits your daily routine", "Link medication time to an existing habit"],
        expectedBenefit: "Better medication effectiveness and easier habit formation",
        personalizedReason: "Consistency shows improved outcomes for most patients"
      });

      adherenceTips.push({
        tipId: `default-reminder-${Date.now()}`,
        category: "reminder",
        title: "Visual Reminders",
        description: "Studies show that keeping medications visible helps with remembering to take them.",
        actionableSteps: ["Place medications where you will see them", "Use a pill organizer"],
        expectedBenefit: "Fewer missed doses",
        personalizedReason: "Visual cues show significant improvement in adherence"
      });
    }

    return { sideEffectTips, adherenceTips };
  }

  // Process voice/text commands for medication intake reporting
  async processIntakeCommand(
    patientId: string,
    command: string,
    medications: Medication[],
    reportMethod: "voice" | "text"
  ): Promise<VoiceCommandResult> {
    try {
      const responseText = await generatePhiSafeText({
        system: `You are a medication tracking assistant. Parse voice/text commands about medication intake.
Understand commands like:
- "I took my Metformin"
- "Took morning meds"
- "Skipped my blood pressure pill because I forgot"
- "I'm experiencing nausea from my medication"
- "Need a refill for lisinopril"

CRITICAL RULES:
1. Use ONLY these safe verbs in responses: "shows", "states", "refers to", "means"
2. Be supportive and non-judgmental
3. Never give medical advice

Respond ONLY with valid JSON.`,
        user: `Parse this medication command:
Command: "${command}"
Available medications: ${medications.map(m => m.name).join(", ")}

Provide JSON with:
{
  "action": "intake_logged" | "side_effect_reported" | "refill_requested" | "info_retrieved" | "unknown",
  "medicationName": "name of medication mentioned (or null)",
  "intakeAction": "taken" | "skipped" | "delayed" | null,
  "sideEffect": "side effect if reported (or null)",
  "sideEffectSeverity": "mild" | "moderate" | "severe" | null,
  "notes": "any additional notes from the command",
  "response": "Friendly acknowledgment message for the patient"
}`,
        maxTokens: 1000,
        responseMimeType: "application/json",
      });

      const parsed = JSON.parse(responseText || "{}");

      // Find matching medication
      const matchedMedication = medications.find(m => 
        m.name.toLowerCase().includes((parsed.medicationName || "").toLowerCase()) ||
        (parsed.medicationName || "").toLowerCase().includes(m.name.toLowerCase())
      );

      if (parsed.action === "intake_logged" && matchedMedication) {
        const intakeReport: MedicationIntakeReport = {
          id: `intake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patientId,
          medicationId: matchedMedication.id,
          medicationName: matchedMedication.name,
          reportedAt: new Date().toISOString(),
          reportMethod,
          action: parsed.intakeAction || "taken",
          notes: parsed.notes,
          sideEffectsReported: [],
          aiAcknowledgment: ensureSafeContent(parsed.response || `Your ${matchedMedication.name} intake shows as recorded.`),
          followUpSuggestion: undefined
        };

        return {
          success: true,
          command,
          action: "intake_logged",
          response: ensureSafeContent(parsed.response || `Your ${matchedMedication.name} intake shows as recorded.`),
          data: intakeReport
        };
      }

      if (parsed.action === "side_effect_reported") {
        const sideEffectReport: SideEffectReport = {
          id: `side-effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patientId,
          medicationId: matchedMedication?.id,
          medicationName: matchedMedication?.name,
          reportedAt: new Date().toISOString(),
          reportMethod,
          sideEffect: parsed.sideEffect || "Unspecified",
          severity: parsed.sideEffectSeverity || "mild",
          notes: parsed.notes,
          aiAnalysis: ensureSafeContent("Your reported side effect has been recorded. This information shows in your health record."),
          recommendations: [
            ensureSafeContent("Tracking side effects shows valuable information for your healthcare provider"),
            ensureSafeContent("Discussing persistent side effects with your provider shows a proactive approach")
          ],
          requiresProviderAttention: parsed.sideEffectSeverity === "severe"
        };

        return {
          success: true,
          command,
          action: "side_effect_reported",
          response: ensureSafeContent(parsed.response || "Your side effect report shows as recorded. Thank you for sharing this information."),
          data: sideEffectReport
        };
      }

      if (parsed.action === "refill_requested" && matchedMedication) {
        return {
          success: true,
          command,
          action: "refill_requested",
          response: ensureSafeContent(parsed.response || `Your refill request for ${matchedMedication.name} shows as noted. Use the refill options below to complete your request.`),
          data: undefined
        };
      }

      return {
        success: parsed.action !== "unknown",
        command,
        action: parsed.action || "unknown",
        response: ensureSafeContent(parsed.response || "Your command has been processed. Please try rephrasing if this was not what you intended.")
      };
    } catch (error) {
      console.error("Error processing intake command:", error);
      return {
        success: false,
        command,
        action: "unknown",
        response: "Unable to process your command at this time. Please try using the buttons to log your medication."
      };
    }
  }

  // Report side effect via voice or text
  async reportSideEffect(
    patientId: string,
    description: string,
    medications: Medication[],
    reportMethod: "voice" | "text"
  ): Promise<SideEffectReport> {
    try {
      const responseText = await generatePhiSafeText({
        system: `You are a clinical assistant analyzing patient-reported side effects.
CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER diagnose or provide medical advice
3. Flag severe symptoms for provider attention
4. Be supportive and acknowledge patient concerns
Respond ONLY with valid JSON.`,
        user: `Analyze this side effect report:
Patient report: "${description}"
Current medications: ${medications.map(m => m.name).join(", ")}

Provide JSON with:
{
  "sideEffect": "Identified side effect name",
  "severity": "mild" | "moderate" | "severe",
  "likelyMedication": "Medication name most likely associated (or null)",
  "duration": "Duration if mentioned (or null)",
  "frequency": "Frequency if mentioned (or null)",
  "aiAnalysis": "Brief, supportive analysis of the report",
  "recommendations": ["Informational tips, not medical advice"],
  "requiresProviderAttention": boolean
}`,
        maxTokens: 1000,
        responseMimeType: "application/json",
      });

      const analysis = JSON.parse(responseText || "{}");

      const matchedMedication = medications.find(m => 
        m.name.toLowerCase() === (analysis.likelyMedication || "").toLowerCase()
      );

      return {
        id: `side-effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId,
        medicationId: matchedMedication?.id,
        medicationName: matchedMedication?.name,
        reportedAt: new Date().toISOString(),
        reportMethod,
        sideEffect: analysis.sideEffect || "Reported symptom",
        severity: analysis.severity || "mild",
        duration: analysis.duration,
        frequency: analysis.frequency,
        notes: description,
        aiAnalysis: ensureSafeContent(analysis.aiAnalysis || "Your side effect report has been recorded."),
        recommendations: (analysis.recommendations || []).map(ensureSafeContent),
        requiresProviderAttention: analysis.requiresProviderAttention || analysis.severity === "severe"
      };
    } catch (error) {
      console.error("Error analyzing side effect report:", error);
      return {
        id: `side-effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId,
        medicationId: undefined,
        medicationName: undefined,
        reportedAt: new Date().toISOString(),
        reportMethod,
        sideEffect: "Reported symptom",
        severity: "mild",
        notes: description,
        aiAnalysis: "Your side effect report shows as recorded. This information will be available for your healthcare provider to review.",
        recommendations: [
          "Tracking side effects shows valuable information for your care team",
          "Contact your healthcare provider if symptoms persist or worsen"
        ],
        requiresProviderAttention: false
      };
    }
  }
}

export const aiMedicationService = new AIMedicationService();
