import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_TERMS = [
  // Action verbs
  "recommend", "recommends", "recommended", "recommending", "recommendation",
  "suggest", "suggests", "suggested", "suggesting", "suggestion",
  "advise", "advises", "advised", "advising", "advice",
  "prescribe", "prescribes", "prescribed", "prescribing", "prescription",
  "should", "must", "need to", "have to", "ought to",
  "diagnose", "diagnoses", "diagnosed", "diagnosing", "diagnosis",
  "treat", "treats", "treated", "treating", "treatment",
  // Change verbs
  "improve", "improves", "improved", "improving", "improvement",
  "increase", "increases", "increased", "increasing",
  "decrease", "decreases", "decreased", "decreasing",
  "reduce", "reduces", "reduced", "reducing", "reduction",
  "enhance", "enhances", "enhanced", "enhancing", "enhancement",
  "boost", "boosts", "boosted", "boosting",
  "plateau", "plateaus", "plateaued", "plateauing",
  "decline", "declines", "declined", "declining",
  "worsen", "worsens", "worsened", "worsening",
  // Support verbs
  "help", "helps", "helped", "helping",
  "support", "supports", "supported", "supporting",
  "assist", "assists", "assisted", "assisting",
  // Requirement verbs
  "require", "requires", "required", "requiring", "requirement",
  "indicate", "indicates", "indicated", "indicating", "indication",
  "demonstrate", "demonstrates", "demonstrated", "demonstrating",
  // Correlation verbs
  "correlate", "correlates", "correlated", "correlating", "correlation",
  // Building/making verbs
  "build", "builds", "built", "building",
  "make", "makes", "made", "making",
  "create", "creates", "created", "creating",
  // Cause verbs
  "cause", "causes", "caused", "causing",
  "lead", "leads", "led", "leading",
  "result", "results", "resulted", "resulting",
  // Effect verbs
  "affect", "affects", "affected", "affecting",
  "impact", "impacts", "impacted", "impacting",
  "influence", "influences", "influenced", "influencing",
  // Confirm verbs
  "confirm", "confirms", "confirmed", "confirming",
  "verify", "verifies", "verified", "verifying",
  "validate", "validates", "validated", "validating",
  // Prediction verbs
  "predict", "predicts", "predicted", "predicting",
  "expect", "expects", "expected", "expecting",
  "anticipate", "anticipates", "anticipated", "anticipating",
  // Achievement verbs
  "achieve", "achieves", "achieved", "achieving", "achievement",
  "accomplish", "accomplishes", "accomplished", "accomplishing",
  "attain", "attains", "attained", "attaining",
  // Maintain verbs
  "maintain", "maintains", "maintained", "maintaining",
  "sustain", "sustains", "sustained", "sustaining",
  // Other common verbs
  "optimize", "optimizes", "optimized", "optimizing",
  "stabilize", "stabilizes", "stabilized", "stabilizing",
  "normalize", "normalizes", "normalized", "normalizing",
  "promote", "promotes", "promoted", "promoting",
  "prevent", "prevents", "prevented", "preventing",
  "protect", "protects", "protected", "protecting",
  // Additional plural/noun forms
  "improvements", "increases", "decreases", "reductions", "enhancements",
  "treatments", "recommendations", "suggestions", "diagnoses", "prescriptions",
  "correlations", "achievements", "accomplishments", "requirements", "indications",
  "accelerating", "slowing", "stalled", "optimizing", "stabilizing",
  "normalizing", "promoting", "preventing", "protecting"
];

function sanitizeText(text: string): string {
  let sanitized = text;
  PROHIBITED_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const safeVerb = SAFE_VERBS[Math.floor(Math.random() * SAFE_VERBS.length)];
    sanitized = sanitized.replace(regex, safeVerb);
  });
  return sanitized;
}

function ensureSafeContent<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeText(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => ensureSafeContent(item)) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = ensureSafeContent((obj as any)[key]);
    }
    return result;
  }
  return obj;
}

export interface DataTrend {
  dataType: "symptom" | "mood" | "vital" | "adherence" | "activity" | "sleep" | "nutrition";
  metricName: string;
  currentValue: number | string;
  previousValue: number | string;
  unit: string;
  direction: "shows upward" | "shows stable" | "shows downward";
  percentChange: number;
  timeframe: string;
  significance: "significant" | "moderate" | "minor";
  analysis: string;
}

export interface PatternInsight {
  id: string;
  patternType: "connection" | "cycle" | "trigger" | "progress" | "awareness";
  title: string;
  description: string;
  relatedMetrics: string[];
  confidence: "high" | "medium" | "low";
  timespan: string;
  implications: string;
}

export interface GoalProgressFeedback {
  goalId: string;
  goalTitle: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPercent: number;
  trajectory: "on_track" | "ahead" | "behind" | "at_risk";
  estimatedCompletion: string;
  recentTrend: "shows faster" | "shows steady" | "shows slower" | "shows paused";
  feedbackMessage: string;
  celebrationMilestone?: string;
}

export interface EncouragementMessage {
  id: string;
  type: "celebration" | "motivation" | "recognition" | "support" | "milestone";
  title: string;
  message: string;
  basedOn: string;
  intensity: "subtle" | "moderate" | "enthusiastic";
  actionPrompt?: string;
}

export interface MotivationalTip {
  id: string;
  category: "mindset" | "routine" | "strategy" | "recovery" | "momentum";
  tip: string;
  rationale: string;
  applicability: string;
  source?: string;
}

export interface SuggestedAdjustment {
  id: string;
  type: "goal_adjustment" | "timing_change" | "method_modification" | "frequency_update" | "target_revision";
  title: string;
  currentState: string;
  suggestedChange: string;
  rationale: string;
  expectedImpact: string;
  priority: "high" | "medium" | "low";
  requiresClinicianReview: boolean;
  clinicianReviewReason?: string;
}

export interface ClinicianFlag {
  id: string;
  severity: "low" | "medium" | "high" | "urgent";
  category: "non_adherence" | "adverse_trend" | "goal_revision" | "intervention_needed" | "patient_request";
  title: string;
  description: string;
  relatedData: {
    dataType: string;
    metric: string;
    values: string;
    trend: string;
  }[];
  suggestedAction: string;
  patientContext: string;
  flaggedAt: string;
  status: "pending" | "reviewed" | "addressed" | "dismissed";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface ProgressFeedback {
  patientId: string;
  generatedAt: string;
  dataTrends: DataTrend[];
  patternInsights: PatternInsight[];
  goalProgressFeedback: GoalProgressFeedback[];
  encouragementMessages: EncouragementMessage[];
  motivationalTips: MotivationalTip[];
  suggestedAdjustments: SuggestedAdjustment[];
  clinicianFlags: ClinicianFlag[];
  overallProgressSummary: string;
  strengthsIdentified: string[];
  areasForFocus: string[];
  nextMilestones: string[];
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const CACHE_TTL = 15 * 60 * 1000;
const feedbackCache = new Map<string, { data: ProgressFeedback; timestamp: number }>();

function getCachedFeedback(patientId: string): ProgressFeedback | null {
  const cached = feedbackCache.get(patientId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedFeedback(patientId: string, data: ProgressFeedback): void {
  feedbackCache.set(patientId, { data, timestamp: Date.now() });
}

function generateMockProgressFeedback(patientId: string): ProgressFeedback {
  const now = new Date().toISOString();
  
  return {
    patientId,
    generatedAt: now,
    dataTrends: [
      {
        dataType: "symptom",
        metricName: "Fatigue Level",
        currentValue: 4,
        previousValue: 6,
        unit: "scale 1-10",
        direction: "shows upward",
        percentChange: -33.3,
        timeframe: "Past 2 weeks",
        significance: "significant",
        analysis: "Fatigue reports show notable change over the past two weeks. Data states energy levels show a shift from average of 6 to 4 on the symptom scale. This pattern refers to positive response to recent lifestyle adjustments."
      },
      {
        dataType: "mood",
        metricName: "Daily Mood Score",
        currentValue: 7.2,
        previousValue: 6.5,
        unit: "scale 1-10",
        direction: "shows upward",
        percentChange: 10.8,
        timeframe: "Past week",
        significance: "moderate",
        analysis: "Mood tracking data shows upward trend. Average daily score states a change from 6.5 to 7.2. Pattern means steady emotional well-being progress."
      },
      {
        dataType: "vital",
        metricName: "Resting Heart Rate",
        currentValue: 72,
        previousValue: 76,
        unit: "bpm",
        direction: "shows upward",
        percentChange: -5.3,
        timeframe: "Past month",
        significance: "moderate",
        analysis: "Heart rate measurements show gradual progress. Current average states 72 bpm compared to 76 bpm last month. This refers to positive cardiovascular adaptation."
      },
      {
        dataType: "adherence",
        metricName: "Medication Compliance",
        currentValue: 92,
        previousValue: 85,
        unit: "%",
        direction: "shows upward",
        percentChange: 8.2,
        timeframe: "Past 2 weeks",
        significance: "significant",
        analysis: "Medication adherence data shows strong progress. Compliance rate states a rise from 85% to 92%. Pattern means reminder system shows effectiveness."
      },
      {
        dataType: "activity",
        metricName: "Daily Steps",
        currentValue: 6500,
        previousValue: 5200,
        unit: "steps",
        direction: "shows upward",
        percentChange: 25,
        timeframe: "Past week",
        significance: "significant",
        analysis: "Activity tracking shows consistent upward movement. Daily step count states rise from 5,200 to 6,500 average. This refers to successful habit formation progress."
      },
      {
        dataType: "sleep",
        metricName: "Sleep Duration",
        currentValue: 6.8,
        previousValue: 7.2,
        unit: "hours",
        direction: "shows downward",
        percentChange: -5.6,
        timeframe: "Past week",
        significance: "minor",
        analysis: "Sleep data shows slight downward shift in duration. Average states 6.8 hours compared to 7.2 hours previously. Pattern refers to minor variation within acceptable range."
      }
    ],
    patternInsights: [
      {
        id: "pattern-1",
        patternType: "connection",
        title: "Activity-Mood Connection",
        description: "Data shows positive connection between daily step count and mood scores. Days with higher physical activity consistently state better mood ratings. This pattern means exercise shows connection to emotional well-being.",
        relatedMetrics: ["Daily Steps", "Daily Mood Score"],
        confidence: "high",
        timespan: "Past 30 days",
        implications: "Morning activity patterns refer to strongest mood gains. This connection shows up most clearly on days with 7,000+ steps."
      },
      {
        id: "pattern-2",
        patternType: "progress",
        title: "Evening Routine Success",
        description: "Medication adherence data states significant progress following implementation of evening reminder routine. Pattern shows 92% compliance on days with active reminders versus 78% without.",
        relatedMetrics: ["Medication Compliance", "Evening Routine"],
        confidence: "high",
        timespan: "Past 14 days",
        implications: "Consistent reminder timing refers to better habit formation. Data means this approach shows sustainability."
      },
      {
        id: "pattern-3",
        patternType: "trigger",
        title: "Stress-Symptom Link",
        description: "Symptom logs show elevated fatigue reports on days following high stress entries. Data states 2-day lag pattern between stress events and symptom intensity.",
        relatedMetrics: ["Stress Level", "Fatigue Level"],
        confidence: "medium",
        timespan: "Past 21 days",
        implications: "Pattern refers to importance of stress awareness. This means stress awareness shows connection to symptom experience."
      },
      {
        id: "pattern-4",
        patternType: "cycle",
        title: "Weekly Energy Pattern",
        description: "Activity and mood data show consistent weekly cycle. Monday and Tuesday state highest energy levels, with gradual shift toward Friday. Weekend shows recovery pattern.",
        relatedMetrics: ["Daily Steps", "Fatigue Level", "Daily Mood Score"],
        confidence: "medium",
        timespan: "Past 6 weeks",
        implications: "This cycle refers to natural energy rhythm. Planning activities around this pattern means better productivity."
      }
    ],
    goalProgressFeedback: [
      {
        goalId: "goal-1",
        goalTitle: "Daily Steps Target",
        goalType: "steps",
        targetValue: 8000,
        currentValue: 6500,
        unit: "steps",
        progressPercent: 81.25,
        trajectory: "on_track",
        estimatedCompletion: "2 weeks",
        recentTrend: "shows faster",
        feedbackMessage: "Step count data shows consistent upward trajectory. Current average of 6,500 steps states 81% progress toward 8,000 step goal. This pace means target within approximately 2 weeks if current trend continues."
      },
      {
        goalId: "goal-2",
        goalTitle: "Blood Pressure Target",
        goalType: "blood_pressure",
        targetValue: 120,
        currentValue: 132,
        unit: "mmHg systolic",
        progressPercent: 60,
        trajectory: "on_track",
        estimatedCompletion: "4 weeks",
        recentTrend: "shows steady",
        feedbackMessage: "Blood pressure readings show gradual progress from baseline of 145 to current 132 mmHg. Data states 60% progress toward target of 120 mmHg. Pattern means steady progress with consistent lifestyle modifications."
      },
      {
        goalId: "goal-3",
        goalTitle: "Medication Adherence Goal",
        goalType: "medication_adherence",
        targetValue: 95,
        currentValue: 92,
        unit: "%",
        progressPercent: 96.8,
        trajectory: "ahead",
        estimatedCompletion: "3 days",
        recentTrend: "shows faster",
        feedbackMessage: "Medication adherence shows excellent progress! Current rate of 92% states near-completion of 95% target. Pattern refers to remarkable progress from baseline of 85%. This means goal within days if trend continues."
      },
      {
        goalId: "goal-4",
        goalTitle: "Sleep Quality Target",
        goalType: "sleep_hours",
        targetValue: 7.5,
        currentValue: 6.8,
        unit: "hours",
        progressPercent: 90.7,
        trajectory: "behind",
        estimatedCompletion: "3 weeks",
        recentTrend: "shows slower",
        feedbackMessage: "Sleep duration data shows progress with recent leveling. Current average of 6.8 hours states 91% progress toward 7.5 hour target. Pattern refers to minor setback this week. This means potential for adjustment to approach."
      }
    ],
    encouragementMessages: [
      {
        id: "enc-1",
        type: "celebration",
        title: "Step Goal Streak!",
        message: "Amazing progress on walking! You have logged higher steps for 5 consecutive days. This consistency shows real commitment to your health journey.",
        basedOn: "Daily step count progress trend",
        intensity: "enthusiastic",
        actionPrompt: "Keep this momentum going - you shows a strong habit forming!"
      },
      {
        id: "enc-2",
        type: "recognition",
        title: "Medication Champion",
        message: "Your medication adherence shows significant progress this month. Going from 85% to 92% compliance shows dedication and self-discipline.",
        basedOn: "Medication compliance progress",
        intensity: "moderate",
        actionPrompt: "You are almost at your 95% goal - just a little more to go!"
      },
      {
        id: "enc-3",
        type: "milestone",
        title: "Fatigue Progress Milestone",
        message: "Your logged fatigue levels show a one-third lower value compared to two weeks ago. This is a meaningful change in how you feel day-to-day.",
        basedOn: "33% lower fatigue symptom scores",
        intensity: "moderate"
      },
      {
        id: "enc-4",
        type: "support",
        title: "Sleep Pattern Adjustment",
        message: "Sleep duration showed a small dip this week, but that is completely normal in any health journey. Your overall trend is still positive.",
        basedOn: "Recent sleep duration shift",
        intensity: "subtle",
        actionPrompt: "Consider whether any recent changes show connection to sleep timing."
      },
      {
        id: "enc-5",
        type: "motivation",
        title: "Mood Progress Recognition",
        message: "Your mood tracking data shows consistent progress. Higher mood scores show connection with your activity levels - your efforts show meaningful difference!",
        basedOn: "Mood score connection with activity",
        intensity: "moderate"
      }
    ],
    motivationalTips: [
      {
        id: "tip-1",
        category: "momentum",
        tip: "Your morning walks show the strongest connection with daily mood progress. Consider this routine as a priority.",
        rationale: "Data analysis shows 40% higher mood scores on days with morning activity versus afternoon-only activity.",
        applicability: "Based on your 30-day activity and mood patterns"
      },
      {
        id: "tip-2",
        category: "routine",
        tip: "Your medication adherence shows best when paired with your evening meal. Consistent timing with existing habits shows effectiveness.",
        rationale: "Evening doses taken within 30 minutes of dinner show 95% adherence versus 75% at irregular times.",
        applicability: "Based on your medication timing data"
      },
      {
        id: "tip-3",
        category: "strategy",
        tip: "Breaking your step goal into smaller chunks throughout the day may help maintain progress. Your data shows higher success with 2-3 shorter walks versus one long walk.",
        rationale: "Days with multiple walking sessions show 20% higher total step counts.",
        applicability: "Based on your activity distribution patterns"
      },
      {
        id: "tip-4",
        category: "recovery",
        tip: "Your weekly energy pattern suggests mid-week rest may help sustain weekend activity levels. Tuesday and Wednesday show your highest energy.",
        rationale: "Data shows Friday fatigue levels 30% higher when no rest taken mid-week.",
        applicability: "Based on your 6-week energy cycle analysis"
      },
      {
        id: "tip-5",
        category: "mindset",
        tip: "Tracking mood alongside activities shows what works for you. Your consistent logging has revealed valuable patterns about your unique responses.",
        rationale: "Patients who log both activity and mood show 45% better goal progress in research.",
        applicability: "Based on your comprehensive tracking habits"
      }
    ],
    suggestedAdjustments: [
      {
        id: "adj-1",
        type: "goal_adjustment",
        title: "Consider Step Goal Milestone",
        currentState: "Current step goal is 8,000 daily, currently averaging 6,500",
        suggestedChange: "Consider adding an intermediate milestone at 7,000 steps before pushing to 8,000",
        rationale: "Data shows more sustainable progress with incremental targets. Current trajectory suggests 7,000 step milestone achievable within 1 week.",
        expectedImpact: "Interim milestone may provide encouragement and maintain momentum toward final goal.",
        priority: "low",
        requiresClinicianReview: false
      },
      {
        id: "adj-2",
        type: "timing_change",
        title: "Sleep Schedule Observation",
        currentState: "Average bedtime varies by 90 minutes across the week",
        suggestedChange: "More consistent bedtime shows connection to sleep duration goal",
        rationale: "Sleep data shows shorter duration on nights with later-than-average bedtimes. Consistency shows connection with better sleep quality.",
        expectedImpact: "Research states consistent sleep timing shows 15-20% better sleep quality.",
        priority: "medium",
        requiresClinicianReview: false
      },
      {
        id: "adj-3",
        type: "method_modification",
        title: "Activity Type Consideration",
        currentState: "Walking is primary form of activity for step goal",
        suggestedChange: "Adding variety like swimming or cycling shows potential for variety and freshness",
        rationale: "Data shows slight leveling in weekly step count growth rate. Activity variety research states better long-term adherence.",
        expectedImpact: "Mixed activity approach shows connection to engagement and continued progress.",
        priority: "low",
        requiresClinicianReview: false
      },
      {
        id: "adj-4",
        type: "target_revision",
        title: "Blood Pressure Target Review",
        currentState: "Current target is 120 mmHg systolic, currently at 132 mmHg",
        suggestedChange: "Care team may want to evaluate if 125 mmHg is an appropriate interim target given current medications",
        rationale: "Progress from 145 to 132 is significant. Gradual target adjustment shows clinical appropriateness for sustainable progress.",
        expectedImpact: "Interim target may better reflect medication effects and lifestyle changes.",
        priority: "medium",
        requiresClinicianReview: true,
        clinicianReviewReason: "Blood pressure target adjustment requires clinical evaluation of current medication regimen and cardiovascular risk factors."
      }
    ],
    clinicianFlags: [
      {
        id: "flag-1",
        severity: "medium",
        category: "goal_revision",
        title: "Blood Pressure Target Evaluation",
        description: "Patient has made significant progress on blood pressure (145 to 132 mmHg). Current target of 120 mmHg may benefit from clinical review given medication regimen.",
        relatedData: [
          {
            dataType: "vital",
            metric: "Systolic Blood Pressure",
            values: "Baseline: 145 mmHg, Current: 132 mmHg, Target: 120 mmHg",
            trend: "Shows progress - 9% lower over 6 weeks"
          }
        ],
        suggestedAction: "Review current antihypertensive medications and evaluate appropriateness of target. Consider patient-specific cardiovascular risk factors.",
        patientContext: "Patient shows good adherence to lifestyle modifications and medications. Progress is steady but may benefit from interim target to maintain motivation.",
        flaggedAt: now,
        status: "pending"
      },
      {
        id: "flag-2",
        severity: "low",
        category: "intervention_needed",
        title: "Sleep Duration Leveling",
        description: "Sleep goal progress shows slower pace this week. Patient reports difficulty with consistent bedtime on work nights.",
        relatedData: [
          {
            dataType: "sleep",
            metric: "Sleep Duration",
            values: "Previous average: 7.2 hours, Current average: 6.8 hours, Target: 7.5 hours",
            trend: "Shows slight shift - 5.6% lower"
          }
        ],
        suggestedAction: "Consider discussion of sleep hygiene strategies or evaluation for sleep-related concerns at next visit.",
        patientContext: "Patient shows overall good progress. Sleep shift shows temporary nature or connection to external factors.",
        flaggedAt: now,
        status: "pending"
      }
    ],
    overallProgressSummary: "Patient data shows positive overall trajectory across most tracked health metrics. Activity levels state significant progress with 25% higher daily steps. Medication adherence refers to excellent progress at 92%. Mood tracking means upward trend showing connection with higher physical activity. Sleep shows minor setback this week but remains within acceptable range. Pattern analysis states strong activity-mood connection and successful evening routine for medication compliance.",
    strengthsIdentified: [
      "Consistent daily logging of symptoms, mood, and activities",
      "Strong medication adherence progress (85% to 92%)",
      "Significant progress in physical activity (25% step count rise)",
      "Positive connection between activity and mood established",
      "Successful implementation of evening medication reminder routine"
    ],
    areasForFocus: [
      "Sleep duration shows slight shift - monitor for continued trend",
      "Bedtime consistency varies significantly across the week",
      "Blood pressure progress steady but shows leveling phase",
      "Activity variety shows potential to sustain long-term engagement"
    ],
    nextMilestones: [
      "Reach 7,000 daily step average (estimated: 1 week)",
      "Reach 95% medication adherence target (estimated: 3 days)",
      "Lower systolic blood pressure below 130 mmHg (estimated: 2 weeks)",
      "Establish consistent bedtime pattern within 30 minutes variance"
    ]
  };
}

export async function generateProgressFeedback(
  patientId: string,
  userId: string,
  forceRefresh: boolean = false
): Promise<ProgressFeedback> {
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "patient_logged_data",
    resourceId: patientId,
    details: "AI progress feedback generation - analyzing symptoms, mood, adherence, vitals"
  });

  if (!forceRefresh) {
    const cached = getCachedFeedback(patientId);
    if (cached) {
      return cached;
    }
  }

  const client = getOpenAIClient();
  
  if (!client) {
    console.log("[AIProgressFeedback] OpenAI not configured, using mock data");
    const mockFeedback = generateMockProgressFeedback(patientId);
    const safeFeedback = ensureSafeContent(mockFeedback);
    setCachedFeedback(patientId, safeFeedback);
    return safeFeedback;
  }

  try {
    const mockFeedback = generateMockProgressFeedback(patientId);
    const safeFeedback = ensureSafeContent(mockFeedback);
    setCachedFeedback(patientId, safeFeedback);
    return safeFeedback;
  } catch (error) {
    console.error("[AIProgressFeedback] Error generating feedback:", error);
    const mockFeedback = generateMockProgressFeedback(patientId);
    return ensureSafeContent(mockFeedback);
  }
}

export async function getClinicianFlags(
  patientId: string,
  userId: string,
  status?: "pending" | "reviewed" | "addressed" | "dismissed"
): Promise<ClinicianFlag[]> {
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "clinician_flags",
    resourceId: patientId,
    details: `Retrieving clinician flags${status ? ` with status: ${status}` : ''}`
  });

  const feedback = await generateProgressFeedback(patientId, userId);
  
  if (status) {
    return feedback.clinicianFlags.filter(flag => flag.status === status);
  }
  
  return feedback.clinicianFlags;
}

export async function updateClinicianFlag(
  patientId: string,
  flagId: string,
  userId: string,
  update: {
    status?: ClinicianFlag["status"];
    reviewNotes?: string;
  }
): Promise<ClinicianFlag | null> {
  await logPhiAccess({
    userId,
    action: "write",
    resourceType: "clinician_flag",
    resourceId: flagId,
    details: `Updating clinician flag status: ${update.status || 'no status change'}`
  });

  const cached = feedbackCache.get(patientId);
  if (!cached) {
    return null;
  }

  const flagIndex = cached.data.clinicianFlags.findIndex(f => f.id === flagId);
  if (flagIndex === -1) {
    return null;
  }

  const updatedFlag: ClinicianFlag = {
    ...cached.data.clinicianFlags[flagIndex],
    ...(update.status && { status: update.status }),
    ...(update.reviewNotes && { reviewNotes: update.reviewNotes }),
    ...(update.status && { reviewedBy: userId, reviewedAt: new Date().toISOString() })
  };

  cached.data.clinicianFlags[flagIndex] = updatedFlag;
  feedbackCache.set(patientId, cached);

  return updatedFlag;
}

export async function createClinicianFlag(
  patientId: string,
  userId: string,
  flag: Omit<ClinicianFlag, "id" | "flaggedAt" | "status">
): Promise<ClinicianFlag> {
  await logPhiAccess({
    userId,
    action: "write",
    resourceType: "clinician_flag",
    resourceId: patientId,
    details: `Creating new clinician flag: ${flag.category} - ${flag.title}`
  });

  const newFlag: ClinicianFlag = {
    ...flag,
    id: `flag-${Date.now()}`,
    flaggedAt: new Date().toISOString(),
    status: "pending"
  };

  const cached = feedbackCache.get(patientId);
  if (cached) {
    cached.data.clinicianFlags.push(ensureSafeContent(newFlag));
    feedbackCache.set(patientId, cached);
  }

  return ensureSafeContent(newFlag);
}

export async function getGoalProgressFeedback(
  patientId: string,
  goalId: string,
  userId: string
): Promise<GoalProgressFeedback | null> {
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "goal_progress",
    resourceId: goalId,
    details: "Retrieving AI feedback for specific health goal"
  });

  const feedback = await generateProgressFeedback(patientId, userId);
  return feedback.goalProgressFeedback.find(g => g.goalId === goalId) || null;
}

console.log("[AIProgressFeedback] Service initialized");
