import OpenAI from "openai";
import { storage } from "./storage";
import type { 
  Medication,
  MedicationReminder,
  DrugInteraction,
  MedicationAIInsight,
  InsertMedicationReminder,
  InsertDrugInteraction,
  InsertMedicationAIInsight,
  AdherenceStatistics,
  ReminderFrequency,
  MedicationAdherenceRecord,
  AdherenceCoachingSession,
  AdherencePatternAnalysis,
  MissedDoseReason,
  InsertAdherenceCoachingSession
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Generate personalized reminder message for a medication
export async function generateReminderMessage(
  medicationName: string,
  dosage: string,
  frequency: ReminderFrequency,
  patientName?: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a friendly health assistant helping patients remember to take their medications. 
Generate a brief, encouraging reminder message (1-2 sentences max) for a medication reminder.
Be warm but professional. Do not provide medical advice.`
        },
        {
          role: "user",
          content: `Generate a medication reminder for:
Medication: ${medicationName}
Dosage: ${dosage}
Frequency: ${frequency.replace(/_/g, " ")}
${patientName ? `Patient name: ${patientName}` : ""}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || `Time to take your ${medicationName} (${dosage}).`;
  } catch (error) {
    console.error("Error generating reminder message:", error);
    return `Time to take your ${medicationName} (${dosage}).`;
  }
}

// Analyze medications for potential drug-drug interactions
export async function analyzedrugInteractions(
  medications: Medication[],
  patientId: string
): Promise<DrugInteraction[]> {
  if (medications.length < 2) {
    return [];
  }

  const activeMeds = medications.filter(m => m.status === "active");
  if (activeMeds.length < 2) {
    return [];
  }

  const medicationList = activeMeds.map(m => ({
    id: m.id,
    name: m.name,
    genericName: (m as any).genericName || m.name,
    dosage: m.dosage,
    frequency: m.frequency,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a clinical pharmacology AI assistant. Analyze the provided medication list for potential drug-drug interactions.
For each interaction found, provide:
- The two medications involved
- Severity (minor, moderate, major, or contraindicated)
- A brief description of the interaction
- Clinical effects that may occur
- A recommendation for the patient

IMPORTANT: This is for educational purposes only. Always advise patients to consult their healthcare provider.
You must respond with a valid JSON object containing an "interactions" array.`
        },
        {
          role: "user",
          content: `Analyze these medications for interactions:
${JSON.stringify(medicationList, null, 2)}

Respond with a JSON object containing an "interactions" array:
{
  "interactions": [{
    "medication1": { "id": "...", "name": "..." },
    "medication2": { "id": "...", "name": "..." },
    "severity": "minor|moderate|major|contraindicated",
    "description": "...",
    "clinicalEffects": "...",
    "recommendation": "..."
  }]
}

If no significant interactions, return { "interactions": [] }.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse interaction response:", parseError);
      return [];
    }
    
    const interactions = parsed.interactions;
    if (!interactions || !Array.isArray(interactions)) {
      console.warn("No interactions array in response:", parsed);
      return [];
    }

    const results: DrugInteraction[] = [];
    for (const interaction of interactions) {
      if (!interaction.medication1 || !interaction.medication2) continue;
      
      const drugInteraction = await storage.createDrugInteraction({
        medication1Id: interaction.medication1.id || "unknown",
        medication1Name: interaction.medication1.name,
        medication2Id: interaction.medication2.id || "unknown",
        medication2Name: interaction.medication2.name,
        severity: interaction.severity || "moderate",
        description: interaction.description || "Potential interaction detected",
        clinicalEffects: interaction.clinicalEffects || "Please consult your healthcare provider",
        recommendation: interaction.recommendation || "Discuss with your doctor or pharmacist",
        source: "AI Analysis",
        aiConfidence: 75,
      });
      results.push(drugInteraction);
    }

    return results;
  } catch (error) {
    console.error("Error analyzing drug interactions:", error);
    return [];
  }
}

// Generate adherence insights based on patient's medication history
export async function generateAdherenceInsights(
  patientId: string,
  stats: AdherenceStatistics,
  medications: Medication[]
): Promise<MedicationAIInsight[]> {
  const insights: MedicationAIInsight[] = [];

  // Low adherence alert
  if (stats.adherenceRate < 70) {
    const insight = await storage.createMedicationAIInsight({
      patientId,
      insightType: "adherence_trend",
      title: "Medication Adherence Alert",
      message: `Your medication adherence has been ${stats.adherenceRate}% over the past ${stats.totalScheduled} doses. Consistent medication use is important for your health. Consider setting reminders or discussing barriers with your healthcare provider.`,
      priority: stats.adherenceRate < 50 ? "high" : "medium",
      relatedMedications: medications.map(m => m.name),
      actionable: true,
      actionText: "Set up reminders",
    });
    insights.push(insight);
  }

  // Streak celebration
  if (stats.streak >= 7) {
    const insight = await storage.createMedicationAIInsight({
      patientId,
      insightType: "adherence_trend",
      title: "Great Adherence Streak!",
      message: `Congratulations! You've taken your medications consistently for ${stats.streak} days in a row. Keep up the excellent work!`,
      priority: "low",
      relatedMedications: medications.map(m => m.name),
      actionable: false,
    });
    insights.push(insight);
  }

  return insights;
}

// Generate timing optimization suggestions
export async function generateTimingOptimization(
  medications: Medication[],
  patientId: string
): Promise<MedicationAIInsight | null> {
  const activeMeds = medications.filter(m => m.status === "active");
  if (activeMeds.length === 0) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful pharmacist assistant. Based on the medication list, provide ONE brief tip (2-3 sentences max) about optimal timing for taking these medications.
Consider factors like: food interactions, time of day preferences, combining medications safely.
Keep the advice general and always recommend consulting a healthcare provider for specific guidance.`
        },
        {
          role: "user",
          content: `Medications:
${activeMeds.map(m => `- ${m.name} (${m.dosage}, ${m.frequency})`).join("\n")}

Provide a brief timing tip.`
        }
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    const tip = response.choices[0]?.message?.content;
    if (!tip) return null;

    return await storage.createMedicationAIInsight({
      patientId,
      insightType: "timing_optimization",
      title: "Medication Timing Tip",
      message: tip,
      priority: "low",
      relatedMedications: activeMeds.map(m => m.name),
      actionable: false,
    });
  } catch (error) {
    console.error("Error generating timing optimization:", error);
    return null;
  }
}

// Get all due reminders for a patient
export async function getDueReminders(patientId: string): Promise<MedicationReminder[]> {
  const reminders = await storage.getMedicationReminders(patientId);
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  
  return reminders.filter(r => {
    if (!r.isActive) return false;
    // Check if current time is within 30 minutes of any scheduled time
    return r.scheduledTimes.some(scheduledTime => {
      const [schedH, schedM] = scheduledTime.split(":").map(Number);
      const [currH, currM] = currentTime.split(":").map(Number);
      const schedMinutes = schedH * 60 + schedM;
      const currMinutes = currH * 60 + currM;
      return Math.abs(currMinutes - schedMinutes) <= 30;
    });
  });
}

// Create a reminder with AI-generated message
export async function createMedicationReminderWithAI(
  reminder: InsertMedicationReminder,
  patientName?: string
): Promise<MedicationReminder> {
  const aiMessage = await generateReminderMessage(
    reminder.medicationName,
    reminder.dosage,
    reminder.frequency,
    patientName
  );

  return await storage.createMedicationReminder({
    ...reminder,
    aiGeneratedMessage: aiMessage,
  });
}

// Analyze all patient medications and generate comprehensive insights
export async function analyzePatientMedications(patientId: string): Promise<{
  interactions: DrugInteraction[];
  insights: MedicationAIInsight[];
  adherenceStats: AdherenceStatistics;
}> {
  // Get patient medications from storage
  const patients = await storage.getPatients();
  const patient = patients.find(p => p.email?.toLowerCase().includes(patientId.toLowerCase()) || p.id === patientId);
  
  let medications: Medication[] = [];
  if (patient) {
    medications = await storage.getMedicationsByPatient(patient.id);
  }

  // Analyze drug interactions
  const interactions = await analyzedrugInteractions(medications, patientId);

  // Get adherence stats
  const adherenceStats = await storage.getMedicationAdherenceStats(patientId);

  // Generate insights
  const insights = await generateAdherenceInsights(patientId, adherenceStats, medications);

  // Add interaction alerts as insights
  for (const interaction of interactions) {
    if (interaction.severity === "major" || interaction.severity === "contraindicated") {
      await storage.createMedicationAIInsight({
        patientId,
        insightType: "interaction_alert",
        title: `Drug Interaction Alert: ${interaction.medication1Name} + ${interaction.medication2Name}`,
        message: interaction.description,
        priority: interaction.severity === "contraindicated" ? "urgent" : "high",
        relatedMedications: [interaction.medication1Name, interaction.medication2Name],
        actionable: true,
        actionText: "View details",
      });
    }
  }

  return {
    interactions,
    insights: await storage.getMedicationAIInsights(patientId),
    adherenceStats,
  };
}

// ============================================
// AI ADHERENCE COACHING
// ============================================

const missedDoseReasonLabels: Record<MissedDoseReason, string> = {
  forgot: "Forgot to take it",
  side_effects: "Experiencing side effects",
  felt_better: "Felt better, didn't think I needed it",
  ran_out: "Ran out of medication",
  cost: "Cost/couldn't afford refill",
  away_from_home: "Away from home",
  sleeping: "Was sleeping at scheduled time",
  busy: "Too busy/distracted",
  confused_instructions: "Confused about instructions",
  intentional_skip: "Intentionally skipped",
  other: "Other reason",
};

// Analyze patterns in missed doses to identify barriers
export async function analyzeAdherencePatterns(
  patientId: string,
  adherenceRecords: MedicationAdherenceRecord[]
): Promise<AdherencePatternAnalysis> {
  const missedOrSkipped = adherenceRecords.filter(
    r => r.action === "missed" || r.action === "skipped"
  );

  // Count reasons
  const reasonCounts: Record<string, number> = {};
  for (const record of missedOrSkipped) {
    if (record.missedReason) {
      reasonCounts[record.missedReason] = (reasonCounts[record.missedReason] || 0) + 1;
    }
  }

  const totalMissed = missedOrSkipped.length;
  const topMissedReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason: reason as MissedDoseReason,
      count,
      percentage: totalMissed > 0 ? Math.round((count / totalMissed) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Analyze time patterns
  const timePatterns: Record<string, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  for (const record of missedOrSkipped) {
    const hour = parseInt(record.scheduledTime.split(":")[0]);
    if (hour >= 5 && hour < 12) timePatterns.morning++;
    else if (hour >= 12 && hour < 17) timePatterns.afternoon++;
    else if (hour >= 17 && hour < 21) timePatterns.evening++;
    else timePatterns.night++;
  }

  // Analyze day patterns
  const dayPatterns: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
    Thursday: 0, Friday: 0, Saturday: 0,
  };

  for (const record of missedOrSkipped) {
    const date = new Date(record.scheduledTime);
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    if (dayPatterns[dayName] !== undefined) {
      dayPatterns[dayName]++;
    }
  }

  return {
    patientId,
    analysisDate: new Date().toISOString(),
    topMissedReasons,
    timePatterns: Object.entries(timePatterns).map(([timeOfDay, missedCount]) => ({
      timeOfDay,
      missedCount,
    })),
    dayPatterns: Object.entries(dayPatterns).map(([dayOfWeek, missedCount]) => ({
      dayOfWeek,
      missedCount,
    })),
    streakHistory: [], // Could be computed from records
    riskFactors: topMissedReasons.slice(0, 3).map(r => missedDoseReasonLabels[r.reason]),
    suggestedInterventions: [],
  };
}

// Generate personalized coaching based on missed dose reasons
export async function generateAdherenceCoaching(
  patientId: string,
  missedReason: MissedDoseReason,
  patientInput: string | undefined,
  medicationName?: string,
  medicationId?: string,
  adherenceStats?: AdherenceStatistics
): Promise<AdherenceCoachingSession> {
  const reasonLabel = missedDoseReasonLabels[missedReason];
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an empathetic medication adherence coach. Your role is to:
1. Acknowledge the patient's situation without judgment
2. Understand barriers to medication adherence
3. Provide practical, personalized strategies to improve adherence
4. Offer motivation and encouragement
5. Never provide medical advice - always recommend consulting healthcare providers for medical concerns

Respond with a JSON object containing:
{
  "analysis": "Brief analysis of the situation and why this barrier makes adherence difficult",
  "recommendations": ["3-4 specific, actionable recommendations tailored to this barrier"],
  "actionPlan": ["2-3 immediate steps the patient can take today"],
  "motivationalMessage": "A warm, encouraging message (2-3 sentences)"
}

Keep responses concise, warm, and practical.`
        },
        {
          role: "user",
          content: `A patient missed their ${medicationName || "medication"} dose.

Reason: ${reasonLabel}
${patientInput ? `Patient's additional context: "${patientInput}"` : ""}
${adherenceStats ? `Current adherence rate: ${adherenceStats.adherenceRate}%` : ""}
${adherenceStats?.streak ? `Current streak: ${adherenceStats.streak} days` : ""}

Please provide personalized coaching to help them stay on track.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    let parsed: any = {
      analysis: "We understand that staying consistent with medications can be challenging. Let's work together to find solutions.",
      recommendations: [
        "Set daily reminders on your phone at the same time each day",
        "Keep your medication in a visible place you see every morning",
        "Use a pill organizer to track what you've taken"
      ],
      actionPlan: [
        "Take your medication as soon as you remember",
        "Set a reminder for tomorrow's dose"
      ],
      motivationalMessage: "Every step counts! Don't be discouraged by missed doses - what matters is getting back on track."
    };

    if (content) {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse coaching response:", e);
      }
    }

    const sessionData: InsertAdherenceCoachingSession = {
      patientId,
      medicationId,
      medicationName,
      sessionType: "barrier_analysis",
      triggerReason: reasonLabel,
      patientInput,
      aiAnalysis: parsed.analysis,
      recommendations: parsed.recommendations || [],
      actionPlan: parsed.actionPlan || [],
      motivationalMessage: parsed.motivationalMessage || "You're doing great by staying engaged with your health!",
    };

    return await storage.createAdherenceCoachingSession(sessionData);
  } catch (error) {
    console.error("Error generating adherence coaching:", error);
    
    // Fallback coaching
    const fallbackData: InsertAdherenceCoachingSession = {
      patientId,
      medicationId,
      medicationName,
      sessionType: "barrier_analysis",
      triggerReason: reasonLabel,
      patientInput,
      aiAnalysis: "Taking medications consistently can be challenging, and it's okay to have setbacks.",
      recommendations: [
        "Set a daily alarm on your phone for medication time",
        "Keep your medication somewhere visible, like next to your toothbrush",
        "Consider using a pill organizer to track your doses"
      ],
      actionPlan: [
        "If you just missed a dose, check if it's safe to take it now",
        "Set a reminder for your next scheduled dose"
      ],
      motivationalMessage: "Every day is a new opportunity. Don't be too hard on yourself - what matters is that you're trying!",
    };

    return await storage.createAdherenceCoachingSession(fallbackData);
  }
}

// Generate proactive coaching check-in based on adherence patterns
export async function generateProactiveCoaching(
  patientId: string,
  patterns: AdherencePatternAnalysis,
  medications: Medication[]
): Promise<AdherenceCoachingSession | null> {
  if (patterns.topMissedReasons.length === 0) {
    return null; // No patterns to address
  }

  const topReason = patterns.topMissedReasons[0];
  const reasonLabel = missedDoseReasonLabels[topReason.reason];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a proactive medication adherence coach conducting a check-in. Based on patterns in the patient's medication history, provide personalized coaching.

Respond with a JSON object:
{
  "analysis": "Summary of the pattern you noticed and why it might be happening",
  "recommendations": ["3-4 tailored recommendations based on the specific pattern"],
  "actionPlan": ["2-3 concrete steps to address this pattern"],
  "motivationalMessage": "Encouraging message acknowledging their efforts"
}`
        },
        {
          role: "user",
          content: `Patient adherence analysis:
- Most common reason for missed doses: ${reasonLabel} (${topReason.percentage}% of misses)
- Time most likely to miss: ${patterns.timePatterns.sort((a, b) => b.missedCount - a.missedCount)[0]?.timeOfDay || "varies"}
- Day most likely to miss: ${patterns.dayPatterns.sort((a, b) => b.missedCount - a.missedCount)[0]?.dayOfWeek || "varies"}
- Medications: ${medications.map(m => m.name).join(", ")}

Generate a proactive check-in coaching session.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    const sessionData: InsertAdherenceCoachingSession = {
      patientId,
      sessionType: "check_in",
      triggerReason: `Pattern detected: ${reasonLabel} is your most common barrier`,
      aiAnalysis: parsed.analysis,
      recommendations: parsed.recommendations || [],
      actionPlan: parsed.actionPlan || [],
      motivationalMessage: parsed.motivationalMessage || "You're making progress every day!",
    };

    return await storage.createAdherenceCoachingSession(sessionData);
  } catch (error) {
    console.error("Error generating proactive coaching:", error);
    return null;
  }
}

// Generate motivational boost when adherence improves
export async function generateMotivationalCoaching(
  patientId: string,
  currentStreak: number,
  adherenceRate: number,
  previousRate?: number
): Promise<AdherenceCoachingSession | null> {
  // Only generate if there's notable improvement
  if (currentStreak < 3 && adherenceRate < 80) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an encouraging medication adherence coach celebrating a patient's progress. Be warm, specific about their achievement, and reinforce positive behaviors.

Respond with a JSON object:
{
  "analysis": "Recognition of what they've achieved",
  "recommendations": ["2-3 tips to maintain this momentum"],
  "actionPlan": ["1-2 ways to reward themselves or stay motivated"],
  "motivationalMessage": "Celebratory message highlighting their success"
}`
        },
        {
          role: "user",
          content: `Patient achievements:
- Current streak: ${currentStreak} consecutive days of taking all medications
- Current adherence rate: ${adherenceRate}%
${previousRate ? `- Improved from: ${previousRate}%` : ""}

Generate an encouraging coaching message.`
        }
      ],
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    const sessionData: InsertAdherenceCoachingSession = {
      patientId,
      sessionType: "motivation",
      triggerReason: currentStreak >= 7 
        ? `Amazing! ${currentStreak}-day streak achieved!`
        : `Great progress! ${adherenceRate}% adherence rate`,
      aiAnalysis: parsed.analysis,
      recommendations: parsed.recommendations || [],
      actionPlan: parsed.actionPlan || [],
      motivationalMessage: parsed.motivationalMessage || "Keep up the fantastic work!",
    };

    return await storage.createAdherenceCoachingSession(sessionData);
  } catch (error) {
    console.error("Error generating motivational coaching:", error);
    return null;
  }
}
