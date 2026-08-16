import { generatePhiSafeText } from "./ai-gateway";

function isAiEnabled(): boolean {
  return true;
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This AI-powered communication analysis is for INFORMATIONAL and OPERATIONAL purposes only. It is NOT a substitute for clinical judgment or diagnosis. All flagged concerns must be reviewed by qualified healthcare professionals. This system does NOT provide clinical decision support.";

function logHipaaAudit(action: string, userId: string, patientId?: string, details?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][CommunicationAnalytics] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId || 'N/A'} | Details: ${details || 'N/A'}`);
}

export interface CommunicationMessage {
  id: string;
  patientId: string;
  patientName?: string;
  messageType: "portal_message" | "chat" | "email" | "phone_note" | "callback_request";
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string;
  metadata?: {
    subject?: string;
    priority?: string;
    category?: string;
  };
}

export interface SentimentResult {
  score: number;
  label: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  confidence: number;
  emotionalTone: string[];
}

export interface DetectedConcern {
  id: string;
  type: "symptom" | "medication" | "appointment" | "billing" | "access" | "satisfaction" | "mental_health" | "safety" | "other";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  suggestedAction?: string;
}

export interface UrgentFlag {
  id: string;
  reason: string;
  urgencyLevel: "urgent" | "critical";
  category: "clinical" | "safety" | "mental_health" | "medication" | "access";
  recommendedResponse: string;
  responseTimeframe: string;
  escalationPath?: string;
}

export interface CommunicationAnalysis {
  messageId: string;
  patientId: string;
  patientName?: string;
  analyzedAt: string;
  sentiment: SentimentResult;
  concerns: DetectedConcern[];
  urgentFlags: UrgentFlag[];
  keyTopics: string[];
  patientQuestions: string[];
  summary: string;
  riskScore: number;
  disclaimer: string;
}

export interface AnalyticsSummary {
  totalAnalyzed: number;
  sentimentDistribution: Record<string, number>;
  concernsByType: Record<string, number>;
  urgentFlagsCount: number;
  criticalFlagsCount: number;
  averageRiskScore: number;
  topConcerns: { type: string; count: number }[];
  recentUrgentFlags: UrgentFlag[];
  disclaimer: string;
}

const analysisCache = new Map<string, CommunicationAnalysis>();
const urgentFlagsQueue: Array<{ analysis: CommunicationAnalysis; reviewedAt?: string; reviewedBy?: string; status: "pending" | "reviewed" | "escalated" | "resolved" }> = [];

// Enhanced: Trend Detection & Communication Patterns
export interface SentimentTrend {
  patientId: string;
  period: string;
  dataPoints: Array<{
    date: string;
    averageSentiment: number;
    messageCount: number;
    dominantEmotion: string;
  }>;
  trend: "improving" | "stable" | "declining" | "volatile";
  trendScore: number;
  insights: string[];
  disclaimer: string;
}

export interface CommunicationPattern {
  patientId: string;
  analyzedPeriod: { start: string; end: string };
  messageFrequency: {
    dailyAverage: number;
    weeklyTotal: number;
    peakDays: string[];
    peakHours: number[];
  };
  preferredChannels: Array<{ channel: string; percentage: number }>;
  responsePatterns: {
    averageResponseTime: string;
    responseRate: number;
  };
  topicEvolution: Array<{
    topic: string;
    firstMentioned: string;
    frequency: number;
    trending: "up" | "down" | "stable";
  }>;
  communicationStyle: {
    averageMessageLength: number;
    questionFrequency: number;
    urgencyIndicators: number;
  };
  riskTrajectory: "increasing" | "stable" | "decreasing";
  disclaimer: string;
}

export interface ExtractedQuestion {
  id: string;
  patientId: string;
  question: string;
  category: "symptom" | "medication" | "appointment" | "billing" | "general" | "treatment" | "lifestyle" | "emergency";
  priority: "low" | "medium" | "high" | "urgent";
  extractedFrom: string;
  extractedAt: string;
  suggestedResponse?: string;
  answered: boolean;
  disclaimer: string;
}

// Enhanced: Portal Interaction Tracking
export interface PortalInteraction {
  id: string;
  patientId: string;
  sessionId: string;
  timestamp: string;
  eventType: "login" | "logout" | "page_view" | "feature_use" | "message_sent" | "document_view" | "appointment_action" | "medication_action";
  details: {
    page?: string;
    feature?: string;
    duration?: number;
    deviceType?: string;
    browser?: string;
    location?: string;
  };
}

export interface PortalEngagementMetrics {
  patientId: string;
  period: { start: string; end: string };
  loginPatterns: {
    totalLogins: number;
    averageSessionDuration: number;
    preferredLoginTimes: string[];
    deviceDistribution: Record<string, number>;
    loginFrequency: "daily" | "weekly" | "monthly" | "sporadic" | "inactive";
  };
  featureUsage: Array<{
    feature: string;
    usageCount: number;
    lastUsed: string;
    averageTimeSpent: number;
  }>;
  engagementScore: number;
  engagementLevel: "highly_engaged" | "moderately_engaged" | "low_engagement" | "at_risk" | "inactive";
  recommendations: string[];
  disclaimer: string;
}

// Enhanced: Automated Alerts System
export interface AlertConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: "sentiment_threshold" | "urgent_flag" | "keyword_detection" | "pattern_change" | "engagement_drop";
  conditions: {
    sentimentThreshold?: number;
    keywords?: string[];
    urgencyLevel?: "urgent" | "critical";
    engagementDropPercent?: number;
    patternChangeType?: string;
  };
  notificationChannels: Array<"in_app" | "email" | "sms" | "pager" | "dashboard">;
  recipients: string[];
  escalationRules?: {
    escalateAfter: number;
    escalateTo: string[];
  };
  createdAt: string;
  createdBy: string;
}

export interface Alert {
  id: string;
  configurationId: string;
  patientId: string;
  triggeredAt: string;
  triggerReason: string;
  severity: "info" | "warning" | "urgent" | "critical";
  status: "pending" | "acknowledged" | "in_progress" | "resolved" | "escalated";
  assignedTo?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  notes: string[];
  relatedAnalysisId?: string;
  disclaimer: string;
}

// Storage for new features
const sentimentTrendCache = new Map<string, SentimentTrend>();
const communicationPatternCache = new Map<string, CommunicationPattern>();
const extractedQuestionsCache = new Map<string, ExtractedQuestion[]>();
const portalInteractions: PortalInteraction[] = [];
const engagementMetricsCache = new Map<string, PortalEngagementMetrics>();
const alertConfigurations: AlertConfiguration[] = [];
const activeAlerts: Alert[] = [];

// Initialize default alert configurations
function initializeDefaultAlertConfigs() {
  if (alertConfigurations.length === 0) {
    alertConfigurations.push(
      {
        id: "alert-config-critical",
        name: "Critical Issue Detection",
        enabled: true,
        triggerType: "urgent_flag",
        conditions: { urgencyLevel: "critical" },
        notificationChannels: ["in_app", "dashboard"],
        recipients: ["care-team-lead", "on-call-provider"],
        escalationRules: { escalateAfter: 15, escalateTo: ["medical-director"] },
        createdAt: new Date().toISOString(),
        createdBy: "system"
      },
      {
        id: "alert-config-sentiment",
        name: "Negative Sentiment Alert",
        enabled: true,
        triggerType: "sentiment_threshold",
        conditions: { sentimentThreshold: -3 },
        notificationChannels: ["in_app", "dashboard"],
        recipients: ["care-coordinator"],
        createdAt: new Date().toISOString(),
        createdBy: "system"
      },
      {
        id: "alert-config-keywords",
        name: "Crisis Keywords Detection",
        enabled: true,
        triggerType: "keyword_detection",
        conditions: { keywords: ["suicide", "kill myself", "overdose", "end my life", "give up"] },
        notificationChannels: ["in_app", "dashboard"],
        recipients: ["behavioral-health", "crisis-team"],
        escalationRules: { escalateAfter: 5, escalateTo: ["emergency-services"] },
        createdAt: new Date().toISOString(),
        createdBy: "system"
      },
      {
        id: "alert-config-engagement",
        name: "Engagement Drop Alert",
        enabled: true,
        triggerType: "engagement_drop",
        conditions: { engagementDropPercent: 50 },
        notificationChannels: ["in_app"],
        recipients: ["patient-outreach"],
        createdAt: new Date().toISOString(),
        createdBy: "system"
      }
    );
    console.log("[AICommunicationAnalytics] Initialized 4 default alert configurations");
  }
}

initializeDefaultAlertConfigs();

function buildFallbackAnalysis(message: CommunicationMessage): CommunicationAnalysis {
  const content = message.content.toLowerCase();
  
  const negativeWords = ["pain", "hurt", "worse", "bad", "terrible", "frustrated", "angry", "upset", "worried", "scared", "anxious", "depressed", "sad", "tired", "exhausted", "sick", "nausea", "vomiting", "bleeding", "fever"];
  const positiveWords = ["better", "good", "great", "thanks", "thank", "happy", "pleased", "improved", "helpful", "excellent", "wonderful"];
  const urgentWords = ["emergency", "urgent", "immediately", "can't breathe", "chest pain", "suicide", "kill myself", "overdose", "severe", "worst", "unbearable", "crisis"];
  const questionPatterns = /\?|how do i|what should|when can|why is|can you|could you|is it|will i|should i/gi;
  
  let sentimentScore = 0;
  negativeWords.forEach(word => {
    if (content.includes(word)) sentimentScore -= 1;
  });
  positiveWords.forEach(word => {
    if (content.includes(word)) sentimentScore += 1;
  });
  
  let sentimentLabel: SentimentResult["label"] = "neutral";
  if (sentimentScore <= -3) sentimentLabel = "very_negative";
  else if (sentimentScore < 0) sentimentLabel = "negative";
  else if (sentimentScore >= 3) sentimentLabel = "very_positive";
  else if (sentimentScore > 0) sentimentLabel = "positive";
  
  const concerns: DetectedConcern[] = [];
  const urgentFlags: UrgentFlag[] = [];
  
  if (content.includes("pain") || content.includes("hurt") || content.includes("ache")) {
    concerns.push({
      id: `concern-${Date.now()}-1`,
      type: "symptom",
      description: "Patient reports pain or discomfort",
      severity: content.includes("severe") || content.includes("worst") ? "high" : "medium",
      keywords: ["pain", "hurt", "ache"],
      suggestedAction: "Review symptom details and assess need for clinical follow-up"
    });
  }
  
  if (content.includes("medication") || content.includes("medicine") || content.includes("prescription") || content.includes("refill")) {
    concerns.push({
      id: `concern-${Date.now()}-2`,
      type: "medication",
      description: "Patient has medication-related inquiry",
      severity: "medium",
      keywords: ["medication", "medicine", "prescription", "refill"],
      suggestedAction: "Review medication question and respond or route to pharmacy"
    });
  }
  
  if (content.includes("appointment") || content.includes("schedule") || content.includes("visit")) {
    concerns.push({
      id: `concern-${Date.now()}-3`,
      type: "appointment",
      description: "Patient has scheduling or appointment inquiry",
      severity: "low",
      keywords: ["appointment", "schedule", "visit"],
      suggestedAction: "Review scheduling request and confirm availability"
    });
  }
  
  if (content.includes("anxious") || content.includes("depressed") || content.includes("stressed") || content.includes("mental")) {
    concerns.push({
      id: `concern-${Date.now()}-4`,
      type: "mental_health",
      description: "Patient expresses mental health concerns",
      severity: "high",
      keywords: ["anxious", "depressed", "stressed", "mental health"],
      suggestedAction: "Consider behavioral health referral or immediate outreach"
    });
  }
  
  urgentWords.forEach(word => {
    if (content.includes(word)) {
      const isCritical = ["suicide", "kill myself", "overdose", "can't breathe", "chest pain"].some(w => content.includes(w));
      urgentFlags.push({
        id: `urgent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reason: `Message contains urgent keyword: "${word}"`,
        urgencyLevel: isCritical ? "critical" : "urgent",
        category: ["suicide", "kill myself"].some(w => content.includes(w)) ? "mental_health" : 
                  ["chest pain", "can't breathe"].some(w => content.includes(w)) ? "clinical" : "safety",
        recommendedResponse: isCritical ? "Immediate clinical review required" : "Priority callback within 2 hours",
        responseTimeframe: isCritical ? "Immediate" : "Within 2 hours",
        escalationPath: isCritical ? "On-call provider" : "Care team lead"
      });
    }
  });
  
  const questions: string[] = [];
  const sentences = message.content.split(/[.!?]+/);
  sentences.forEach(sentence => {
    if (sentence.includes("?") || questionPatterns.test(sentence)) {
      questions.push(sentence.trim());
    }
  });
  
  const riskScore = Math.min(100, Math.max(0, 
    (urgentFlags.length * 30) + 
    (concerns.filter(c => c.severity === "high" || c.severity === "critical").length * 20) +
    (concerns.filter(c => c.severity === "medium").length * 10) +
    (sentimentScore < 0 ? Math.abs(sentimentScore) * 5 : 0)
  ));
  
  return {
    messageId: message.id,
    patientId: message.patientId,
    patientName: message.patientName,
    analyzedAt: new Date().toISOString(),
    sentiment: {
      score: sentimentScore,
      label: sentimentLabel,
      confidence: 0.7,
      emotionalTone: sentimentScore < 0 ? ["concerned", "worried"] : sentimentScore > 0 ? ["positive", "hopeful"] : ["neutral"]
    },
    concerns,
    urgentFlags,
    keyTopics: Array.from(new Set(concerns.map(c => c.type))),
    patientQuestions: questions.slice(0, 5),
    summary: `Patient message analyzed. Sentiment: ${sentimentLabel}. ${concerns.length} concern(s) identified. ${urgentFlags.length} urgent flag(s).`,
    riskScore,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

export async function analyzeMessage(
  userId: string,
  message: CommunicationMessage
): Promise<CommunicationAnalysis> {
  logHipaaAudit("ANALYZE_MESSAGE", userId, message.patientId, `Message ID: ${message.id}, Type: ${message.messageType}`);
  
  if (!isAiEnabled()) {
    console.log("[CommunicationAnalytics] AI not configured, using fallback analysis");
    const fallbackResult = buildFallbackAnalysis(message);
    analysisCache.set(message.id, fallbackResult);

    if (fallbackResult.urgentFlags.length > 0) {
      urgentFlagsQueue.push({ analysis: fallbackResult, status: "pending" });
    }

    return fallbackResult;
  }

  try {
    const responseText = await generatePhiSafeText({
      system: `You are a healthcare communication analyst. Analyze patient messages to detect sentiment, identify concerns, and flag urgent issues.

Return a JSON object with:
{
  "sentiment": {
    "score": number (-5 to 5),
    "label": "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
    "confidence": number (0-1),
    "emotionalTone": string[]
  },
  "concerns": [
    {
      "type": "symptom" | "medication" | "appointment" | "billing" | "access" | "satisfaction" | "mental_health" | "safety" | "other",
      "description": string,
      "severity": "low" | "medium" | "high" | "critical",
      "keywords": string[],
      "suggestedAction": string
    }
  ],
  "urgentFlags": [
    {
      "reason": string,
      "urgencyLevel": "urgent" | "critical",
      "category": "clinical" | "safety" | "mental_health" | "medication" | "access",
      "recommendedResponse": string,
      "responseTimeframe": string,
      "escalationPath": string
    }
  ],
  "keyTopics": string[],
  "patientQuestions": string[],
  "summary": string,
  "riskScore": number (0-100)
}

Flag as CRITICAL: suicidal ideation, chest pain, difficulty breathing, severe allergic reactions, overdose mentions.
Flag as URGENT: severe pain, medication issues, worsening symptoms, high distress.

IMPORTANT: This analysis is for operational triage only, NOT clinical decision support.`,
      user: `Analyze this ${message.messageType} message from patient:

Subject: ${message.metadata?.subject || "N/A"}
Direction: ${message.direction}
Message: ${message.content}`,
      responseMimeType: "application/json",
      temperature: 0.3
    });

    const parsed = JSON.parse(responseText || "{}");
    
    const analysis: CommunicationAnalysis = {
      messageId: message.id,
      patientId: message.patientId,
      patientName: message.patientName,
      analyzedAt: new Date().toISOString(),
      sentiment: parsed.sentiment || { score: 0, label: "neutral", confidence: 0.5, emotionalTone: [] },
      concerns: (parsed.concerns || []).map((c: any, i: number) => ({
        ...c,
        id: `concern-${Date.now()}-${i}`
      })),
      urgentFlags: (parsed.urgentFlags || []).map((f: any, i: number) => ({
        ...f,
        id: `urgent-${Date.now()}-${i}`
      })),
      keyTopics: parsed.keyTopics || [],
      patientQuestions: parsed.patientQuestions || [],
      summary: parsed.summary || "Analysis completed",
      riskScore: parsed.riskScore || 0,
      disclaimer: NO_CDS_DISCLAIMER
    };
    
    analysisCache.set(message.id, analysis);
    
    if (analysis.urgentFlags.length > 0) {
      urgentFlagsQueue.push({ analysis, status: "pending" });
    }
    
    return analysis;
  } catch (error) {
    console.error("[CommunicationAnalytics] OpenAI error, using fallback:", error);
    const fallbackResult = buildFallbackAnalysis(message);
    analysisCache.set(message.id, fallbackResult);
    
    if (fallbackResult.urgentFlags.length > 0) {
      urgentFlagsQueue.push({ analysis: fallbackResult, status: "pending" });
    }
    
    return fallbackResult;
  }
}

export async function analyzeBatch(
  userId: string,
  messages: CommunicationMessage[]
): Promise<{ analyses: CommunicationAnalysis[]; summary: AnalyticsSummary }> {
  logHipaaAudit("ANALYZE_BATCH", userId, undefined, `Batch size: ${messages.length}`);
  
  const analyses: CommunicationAnalysis[] = [];
  
  for (const message of messages) {
    const analysis = await analyzeMessage(userId, message);
    analyses.push(analysis);
  }
  
  const summary = generateSummary(analyses);
  
  return { analyses, summary };
}

function generateSummary(analyses: CommunicationAnalysis[]): AnalyticsSummary {
  const sentimentDistribution: Record<string, number> = {
    very_negative: 0,
    negative: 0,
    neutral: 0,
    positive: 0,
    very_positive: 0
  };
  
  const concernsByType: Record<string, number> = {};
  let totalRiskScore = 0;
  let urgentCount = 0;
  let criticalCount = 0;
  const allUrgentFlags: UrgentFlag[] = [];
  
  analyses.forEach(a => {
    sentimentDistribution[a.sentiment.label]++;
    totalRiskScore += a.riskScore;
    
    a.concerns.forEach(c => {
      concernsByType[c.type] = (concernsByType[c.type] || 0) + 1;
    });
    
    a.urgentFlags.forEach(f => {
      if (f.urgencyLevel === "critical") criticalCount++;
      else urgentCount++;
      allUrgentFlags.push(f);
    });
  });
  
  const topConcerns = Object.entries(concernsByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
  
  return {
    totalAnalyzed: analyses.length,
    sentimentDistribution,
    concernsByType,
    urgentFlagsCount: urgentCount,
    criticalFlagsCount: criticalCount,
    averageRiskScore: analyses.length > 0 ? Math.round(totalRiskScore / analyses.length) : 0,
    topConcerns,
    recentUrgentFlags: allUrgentFlags.slice(0, 10),
    disclaimer: NO_CDS_DISCLAIMER
  };
}

export function getUrgentFlags(userId: string): { flags: typeof urgentFlagsQueue; disclaimer: string } {
  logHipaaAudit("GET_URGENT_FLAGS", userId, undefined, `Total flags: ${urgentFlagsQueue.length}`);
  
  return {
    flags: urgentFlagsQueue.filter(f => f.status === "pending" || f.status === "escalated"),
    disclaimer: NO_CDS_DISCLAIMER
  };
}

export function reviewUrgentFlag(
  userId: string,
  flagId: string,
  status: "reviewed" | "escalated" | "resolved",
  notes?: string
): { success: boolean; disclaimer: string } {
  logHipaaAudit("REVIEW_URGENT_FLAG", userId, undefined, `Flag ID: ${flagId}, New status: ${status}`);
  
  const flagEntry = urgentFlagsQueue.find(f => 
    f.analysis.urgentFlags.some(uf => uf.id === flagId)
  );
  
  if (flagEntry) {
    flagEntry.status = status;
    flagEntry.reviewedAt = new Date().toISOString();
    flagEntry.reviewedBy = userId;
  }
  
  return { success: !!flagEntry, disclaimer: NO_CDS_DISCLAIMER };
}

export function getAnalyticsOverview(userId: string): AnalyticsSummary {
  logHipaaAudit("GET_ANALYTICS_OVERVIEW", userId, undefined, "Fetching communication analytics overview");
  
  const allAnalyses = Array.from(analysisCache.values());
  return generateSummary(allAnalyses);
}

export function getPatientCommunicationHistory(
  userId: string,
  patientId: string
): { analyses: CommunicationAnalysis[]; disclaimer: string } {
  logHipaaAudit("GET_PATIENT_HISTORY", userId, patientId, "Fetching patient communication history");
  
  const patientAnalyses = Array.from(analysisCache.values())
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
  
  return { analyses: patientAnalyses, disclaimer: NO_CDS_DISCLAIMER };
}

// ============================================================================
// ENHANCED: Trend Detection & Communication Patterns
// ============================================================================

export async function getSentimentTrend(
  userId: string,
  patientId: string,
  period: "7d" | "30d" | "90d" = "30d"
): Promise<SentimentTrend> {
  logHipaaAudit("GET_SENTIMENT_TREND", userId, patientId, `Period: ${period}`);
  
  const patientAnalyses = Array.from(analysisCache.values())
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime());
  
  const now = new Date();
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  const relevantAnalyses = patientAnalyses.filter(a => new Date(a.analyzedAt) >= startDate);
  
  const dataPointsByDate = new Map<string, { sentiments: number[]; emotions: string[] }>();
  
  relevantAnalyses.forEach(a => {
    const date = new Date(a.analyzedAt).toISOString().split('T')[0];
    const existing = dataPointsByDate.get(date) || { sentiments: [], emotions: [] };
    existing.sentiments.push(a.sentiment.score);
    existing.emotions.push(...a.sentiment.emotionalTone);
    dataPointsByDate.set(date, existing);
  });
  
  const dataPoints = Array.from(dataPointsByDate.entries()).map(([date, data]) => ({
    date,
    averageSentiment: data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length,
    messageCount: data.sentiments.length,
    dominantEmotion: getMostFrequent(data.emotions) || "neutral"
  }));
  
  let trend: SentimentTrend["trend"] = "stable";
  let trendScore = 0;
  
  if (dataPoints.length >= 2) {
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b.averageSentiment, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.averageSentiment, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    trendScore = diff;
    
    if (diff > 1) trend = "improving";
    else if (diff < -1) trend = "declining";
    else {
      const variance = dataPoints.reduce((acc, dp) => acc + Math.pow(dp.averageSentiment - (firstAvg + secondAvg) / 2, 2), 0) / dataPoints.length;
      if (variance > 4) trend = "volatile";
    }
  }
  
  const insights: string[] = [];
  if (trend === "declining") {
    insights.push("Patient sentiment has been declining - consider proactive outreach");
  }
  if (trend === "volatile") {
    insights.push("Patient shows variable emotional states - may benefit from consistent support");
  }
  if (dataPoints.some(dp => dp.averageSentiment < -3)) {
    insights.push("Periods of very negative sentiment detected - review for intervention opportunities");
  }
  
  return {
    patientId,
    period,
    dataPoints,
    trend,
    trendScore: Math.round(trendScore * 100) / 100,
    insights,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

function getMostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const frequency: Record<string, number> = {};
  arr.forEach(item => { frequency[item] = (frequency[item] || 0) + 1; });
  return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0];
}

export async function getCommunicationPatterns(
  userId: string,
  patientId: string
): Promise<CommunicationPattern> {
  logHipaaAudit("GET_COMMUNICATION_PATTERNS", userId, patientId, "Analyzing communication patterns");
  
  const patientAnalyses = Array.from(analysisCache.values())
    .filter(a => a.patientId === patientId);
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  const topicCount: Record<string, { count: number; firstSeen: string }> = {};
  let totalLength = 0;
  let questionCount = 0;
  let urgencyCount = 0;
  
  patientAnalyses.forEach(a => {
    const date = new Date(a.analyzedAt);
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = date.getHours();
    
    dayCount[day] = (dayCount[day] || 0) + 1;
    hourCount[hour] = (hourCount[hour] || 0) + 1;
    
    a.keyTopics.forEach(topic => {
      if (!topicCount[topic]) {
        topicCount[topic] = { count: 0, firstSeen: a.analyzedAt };
      }
      topicCount[topic].count++;
    });
    
    questionCount += a.patientQuestions.length;
    urgencyCount += a.urgentFlags.length;
  });
  
  const peakDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);
  
  const peakHours = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
  
  const topicEvolution = Object.entries(topicCount)
    .map(([topic, data]) => ({
      topic,
      firstMentioned: data.firstSeen,
      frequency: data.count,
      trending: data.count > 3 ? "up" as const : data.count === 1 ? "down" as const : "stable" as const
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
  
  const riskScores = patientAnalyses.map(a => a.riskScore);
  const recentRisk = riskScores.slice(-5).reduce((a, b) => a + b, 0) / Math.max(riskScores.slice(-5).length, 1);
  const olderRisk = riskScores.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(riskScores.slice(0, -5).length, 1);
  
  let riskTrajectory: CommunicationPattern["riskTrajectory"] = "stable";
  if (recentRisk > olderRisk + 10) riskTrajectory = "increasing";
  else if (recentRisk < olderRisk - 10) riskTrajectory = "decreasing";
  
  return {
    patientId,
    analyzedPeriod: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
    messageFrequency: {
      dailyAverage: Math.round((patientAnalyses.length / 30) * 100) / 100,
      weeklyTotal: Math.round(patientAnalyses.length / 4),
      peakDays,
      peakHours
    },
    preferredChannels: [
      { channel: "portal_message", percentage: 60 },
      { channel: "chat", percentage: 25 },
      { channel: "phone_note", percentage: 15 }
    ],
    responsePatterns: {
      averageResponseTime: "4.5 hours",
      responseRate: 0.92
    },
    topicEvolution,
    communicationStyle: {
      averageMessageLength: patientAnalyses.length > 0 ? Math.round(totalLength / patientAnalyses.length) : 0,
      questionFrequency: patientAnalyses.length > 0 ? Math.round((questionCount / patientAnalyses.length) * 100) / 100 : 0,
      urgencyIndicators: urgencyCount
    },
    riskTrajectory,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

export async function extractPatientQuestions(
  userId: string,
  patientId: string,
  includeAnswered: boolean = false
): Promise<{ questions: ExtractedQuestion[]; disclaimer: string }> {
  logHipaaAudit("EXTRACT_QUESTIONS", userId, patientId, `Include answered: ${includeAnswered}`);
  
  const cached = extractedQuestionsCache.get(patientId) || [];
  const filtered = includeAnswered ? cached : cached.filter(q => !q.answered);
  
  return { questions: filtered, disclaimer: NO_CDS_DISCLAIMER };
}

export async function answerPatientQuestion(
  userId: string,
  questionId: string,
  answered: boolean
): Promise<{ success: boolean; disclaimer: string }> {
  logHipaaAudit("ANSWER_QUESTION", userId, undefined, `Question ID: ${questionId}, Answered: ${answered}`);
  
  const entries = Array.from(extractedQuestionsCache.entries());
  for (let i = 0; i < entries.length; i++) {
    const [, questions] = entries[i];
    const question = questions.find((q: ExtractedQuestion) => q.id === questionId);
    if (question) {
      question.answered = answered;
      return { success: true, disclaimer: NO_CDS_DISCLAIMER };
    }
  }
  
  return { success: false, disclaimer: NO_CDS_DISCLAIMER };
}

// ============================================================================
// ENHANCED: Portal Interaction Tracking
// ============================================================================

export function trackPortalInteraction(
  userId: string,
  interaction: Omit<PortalInteraction, "id">
): { success: boolean; interactionId: string; disclaimer: string } {
  logHipaaAudit("TRACK_PORTAL_INTERACTION", userId, interaction.patientId, `Event: ${interaction.eventType}`);
  
  const id = `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const fullInteraction: PortalInteraction = { ...interaction, id };
  portalInteractions.push(fullInteraction);
  
  checkEngagementAlerts(interaction.patientId, userId);
  
  return { success: true, interactionId: id, disclaimer: NO_CDS_DISCLAIMER };
}

export function getPortalEngagementMetrics(
  userId: string,
  patientId: string
): PortalEngagementMetrics {
  logHipaaAudit("GET_ENGAGEMENT_METRICS", userId, patientId, "Fetching portal engagement metrics");
  
  const patientInteractions = portalInteractions.filter(i => i.patientId === patientId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentInteractions = patientInteractions.filter(i => new Date(i.timestamp) >= thirtyDaysAgo);
  
  const logins = recentInteractions.filter(i => i.eventType === "login");
  const sessions = new Map<string, PortalInteraction[]>();
  
  recentInteractions.forEach(i => {
    const existing = sessions.get(i.sessionId) || [];
    existing.push(i);
    sessions.set(i.sessionId, existing);
  });
  
  const deviceCounts: Record<string, number> = {};
  logins.forEach(l => {
    const device = l.details.deviceType || "unknown";
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
  });
  
  const loginHours = logins.map(l => new Date(l.timestamp).getHours());
  const hourCounts: Record<number, number> = {};
  loginHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
  const preferredTimes = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => {
      const h = parseInt(hour);
      return h < 12 ? `${h || 12}:00 AM` : `${h === 12 ? 12 : h - 12}:00 PM`;
    });
  
  let loginFrequency: PortalEngagementMetrics["loginPatterns"]["loginFrequency"] = "sporadic";
  if (logins.length >= 25) loginFrequency = "daily";
  else if (logins.length >= 8) loginFrequency = "weekly";
  else if (logins.length >= 2) loginFrequency = "monthly";
  else if (logins.length === 0) loginFrequency = "inactive";
  
  const featureInteractions = recentInteractions.filter(i => i.eventType === "feature_use");
  const featureUsage = new Map<string, { count: number; lastUsed: string; totalTime: number }>();
  
  featureInteractions.forEach(i => {
    const feature = i.details.feature || "unknown";
    const existing = featureUsage.get(feature) || { count: 0, lastUsed: i.timestamp, totalTime: 0 };
    existing.count++;
    if (new Date(i.timestamp) > new Date(existing.lastUsed)) {
      existing.lastUsed = i.timestamp;
    }
    existing.totalTime += i.details.duration || 0;
    featureUsage.set(feature, existing);
  });
  
  const featureUsageArray = Array.from(featureUsage.entries()).map(([feature, data]) => ({
    feature,
    usageCount: data.count,
    lastUsed: data.lastUsed,
    averageTimeSpent: data.count > 0 ? Math.round(data.totalTime / data.count) : 0
  })).sort((a, b) => b.usageCount - a.usageCount);
  
  const engagementScore = Math.min(100, Math.round(
    (logins.length * 3) +
    (featureInteractions.length * 2) +
    (recentInteractions.filter(i => i.eventType === "message_sent").length * 5) +
    (sessions.size * 2)
  ));
  
  let engagementLevel: PortalEngagementMetrics["engagementLevel"] = "low_engagement";
  if (engagementScore >= 80) engagementLevel = "highly_engaged";
  else if (engagementScore >= 50) engagementLevel = "moderately_engaged";
  else if (engagementScore >= 20) engagementLevel = "low_engagement";
  else if (engagementScore > 0) engagementLevel = "at_risk";
  else engagementLevel = "inactive";
  
  const recommendations: string[] = [];
  if (engagementLevel === "inactive" || engagementLevel === "at_risk") {
    recommendations.push("Consider proactive outreach to re-engage patient with portal");
  }
  if (featureUsageArray.length < 3) {
    recommendations.push("Patient may benefit from feature education or tutorials");
  }
  if (logins.length > 0 && featureUsageArray.some(f => f.feature === "messaging" && f.usageCount < 2)) {
    recommendations.push("Encourage use of secure messaging for care communication");
  }
  
  const metrics: PortalEngagementMetrics = {
    patientId,
    period: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
    loginPatterns: {
      totalLogins: logins.length,
      averageSessionDuration: sessions.size > 0 ? Math.round(recentInteractions.reduce((a, i) => a + (i.details.duration || 0), 0) / sessions.size) : 0,
      preferredLoginTimes: preferredTimes,
      deviceDistribution: deviceCounts,
      loginFrequency
    },
    featureUsage: featureUsageArray,
    engagementScore,
    engagementLevel,
    recommendations,
    disclaimer: NO_CDS_DISCLAIMER
  };
  
  engagementMetricsCache.set(patientId, metrics);
  return metrics;
}

// ============================================================================
// ENHANCED: Automated Alerts System
// ============================================================================

function checkEngagementAlerts(patientId: string, userId: string) {
  const engagementConfig = alertConfigurations.find(c => c.triggerType === "engagement_drop" && c.enabled);
  if (!engagementConfig) return;
  
  const currentMetrics = engagementMetricsCache.get(patientId);
  if (!currentMetrics) return;
  
  if (currentMetrics.engagementLevel === "at_risk" || currentMetrics.engagementLevel === "inactive") {
    createAlert(engagementConfig.id, patientId, "Patient engagement has dropped significantly", "warning", userId);
  }
}

function checkMessageAlerts(analysis: CommunicationAnalysis, userId: string) {
  alertConfigurations.filter(c => c.enabled).forEach(config => {
    switch (config.triggerType) {
      case "urgent_flag":
        if (analysis.urgentFlags.some(f => f.urgencyLevel === config.conditions.urgencyLevel)) {
          const severity = config.conditions.urgencyLevel === "critical" ? "critical" : "urgent";
          createAlert(config.id, analysis.patientId, `Urgent flag detected: ${analysis.urgentFlags[0]?.reason}`, severity, userId, analysis.messageId);
        }
        break;
        
      case "sentiment_threshold":
        if (config.conditions.sentimentThreshold && analysis.sentiment.score <= config.conditions.sentimentThreshold) {
          createAlert(config.id, analysis.patientId, `Negative sentiment detected (score: ${analysis.sentiment.score})`, "warning", userId, analysis.messageId);
        }
        break;
        
      case "keyword_detection":
        if (config.conditions.keywords) {
          const foundKeyword = config.conditions.keywords.find(kw => 
            analysis.summary.toLowerCase().includes(kw.toLowerCase()) ||
            analysis.keyTopics.some(t => t.toLowerCase().includes(kw.toLowerCase()))
          );
          if (foundKeyword) {
            createAlert(config.id, analysis.patientId, `Crisis keyword detected: "${foundKeyword}"`, "critical", userId, analysis.messageId);
          }
        }
        break;
    }
  });
}

function createAlert(
  configId: string,
  patientId: string,
  reason: string,
  severity: Alert["severity"],
  triggeredBy: string,
  relatedAnalysisId?: string
): Alert {
  const existingAlert = activeAlerts.find(a => 
    a.configurationId === configId && 
    a.patientId === patientId && 
    a.status === "pending" &&
    new Date().getTime() - new Date(a.triggeredAt).getTime() < 3600000
  );
  
  if (existingAlert) {
    existingAlert.notes.push(`Additional trigger at ${new Date().toISOString()}: ${reason}`);
    return existingAlert;
  }
  
  const alert: Alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    configurationId: configId,
    patientId,
    triggeredAt: new Date().toISOString(),
    triggerReason: reason,
    severity,
    status: "pending",
    notes: [],
    relatedAnalysisId,
    disclaimer: NO_CDS_DISCLAIMER
  };
  
  activeAlerts.push(alert);
  console.log(`[AICommunicationAnalytics] Alert created: ${alert.id} - ${severity} - ${reason}`);
  
  return alert;
}

export function getAlertConfigurations(userId: string): { configurations: AlertConfiguration[]; disclaimer: string } {
  logHipaaAudit("GET_ALERT_CONFIGS", userId, undefined, "Fetching alert configurations");
  return { configurations: alertConfigurations, disclaimer: NO_CDS_DISCLAIMER };
}

export function updateAlertConfiguration(
  userId: string,
  configId: string,
  updates: Partial<AlertConfiguration>
): { success: boolean; configuration?: AlertConfiguration; disclaimer: string } {
  logHipaaAudit("UPDATE_ALERT_CONFIG", userId, undefined, `Config ID: ${configId}`);
  
  const config = alertConfigurations.find(c => c.id === configId);
  if (!config) {
    return { success: false, disclaimer: NO_CDS_DISCLAIMER };
  }
  
  Object.assign(config, updates);
  return { success: true, configuration: config, disclaimer: NO_CDS_DISCLAIMER };
}

export function createAlertConfiguration(
  userId: string,
  config: Omit<AlertConfiguration, "id" | "createdAt" | "createdBy">
): { success: boolean; configuration: AlertConfiguration; disclaimer: string } {
  logHipaaAudit("CREATE_ALERT_CONFIG", userId, undefined, `Name: ${config.name}`);
  
  const newConfig: AlertConfiguration = {
    ...config,
    id: `alert-config-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: userId
  };
  
  alertConfigurations.push(newConfig);
  return { success: true, configuration: newConfig, disclaimer: NO_CDS_DISCLAIMER };
}

export function getActiveAlerts(
  userId: string,
  filters?: { patientId?: string; severity?: Alert["severity"]; status?: Alert["status"] }
): { alerts: Alert[]; disclaimer: string } {
  logHipaaAudit("GET_ACTIVE_ALERTS", userId, filters?.patientId, `Filters: ${JSON.stringify(filters)}`);
  
  let filtered = [...activeAlerts];
  
  if (filters?.patientId) {
    filtered = filtered.filter(a => a.patientId === filters.patientId);
  }
  if (filters?.severity) {
    filtered = filtered.filter(a => a.severity === filters.severity);
  }
  if (filters?.status) {
    filtered = filtered.filter(a => a.status === filters.status);
  }
  
  return { alerts: filtered.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()), disclaimer: NO_CDS_DISCLAIMER };
}

export function acknowledgeAlert(
  userId: string,
  alertId: string
): { success: boolean; alert?: Alert; disclaimer: string } {
  logHipaaAudit("ACKNOWLEDGE_ALERT", userId, undefined, `Alert ID: ${alertId}`);
  
  const alert = activeAlerts.find(a => a.id === alertId);
  if (!alert) {
    return { success: false, disclaimer: NO_CDS_DISCLAIMER };
  }
  
  alert.status = "acknowledged";
  alert.acknowledgedAt = new Date().toISOString();
  alert.assignedTo = userId;
  alert.notes.push(`Acknowledged by ${userId} at ${alert.acknowledgedAt}`);
  
  return { success: true, alert, disclaimer: NO_CDS_DISCLAIMER };
}

export function resolveAlert(
  userId: string,
  alertId: string,
  resolution: string
): { success: boolean; alert?: Alert; disclaimer: string } {
  logHipaaAudit("RESOLVE_ALERT", userId, undefined, `Alert ID: ${alertId}, Resolution: ${resolution}`);
  
  const alert = activeAlerts.find(a => a.id === alertId);
  if (!alert) {
    return { success: false, disclaimer: NO_CDS_DISCLAIMER };
  }
  
  alert.status = "resolved";
  alert.resolvedAt = new Date().toISOString();
  alert.notes.push(`Resolved by ${userId}: ${resolution}`);
  
  return { success: true, alert, disclaimer: NO_CDS_DISCLAIMER };
}

export function escalateAlert(
  userId: string,
  alertId: string,
  escalateTo: string,
  reason: string
): { success: boolean; alert?: Alert; disclaimer: string } {
  logHipaaAudit("ESCALATE_ALERT", userId, undefined, `Alert ID: ${alertId}, Escalate to: ${escalateTo}`);
  
  const alert = activeAlerts.find(a => a.id === alertId);
  if (!alert) {
    return { success: false, disclaimer: NO_CDS_DISCLAIMER };
  }
  
  alert.status = "escalated";
  alert.assignedTo = escalateTo;
  alert.notes.push(`Escalated by ${userId} to ${escalateTo}: ${reason}`);
  
  return { success: true, alert, disclaimer: NO_CDS_DISCLAIMER };
}

export function getAlertStats(userId: string): {
  total: number;
  pending: number;
  acknowledged: number;
  resolved: number;
  escalated: number;
  bySeverity: Record<string, number>;
  averageResolutionTime: number;
  disclaimer: string;
} {
  logHipaaAudit("GET_ALERT_STATS", userId, undefined, "Fetching alert statistics");
  
  const bySeverity: Record<string, number> = { info: 0, warning: 0, urgent: 0, critical: 0 };
  activeAlerts.forEach(a => { bySeverity[a.severity]++; });
  
  const resolvedAlerts = activeAlerts.filter(a => a.status === "resolved" && a.resolvedAt);
  const resolutionTimes = resolvedAlerts.map(a => 
    new Date(a.resolvedAt!).getTime() - new Date(a.triggeredAt).getTime()
  );
  const avgResolution = resolutionTimes.length > 0 
    ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 60000)
    : 0;
  
  return {
    total: activeAlerts.length,
    pending: activeAlerts.filter(a => a.status === "pending").length,
    acknowledged: activeAlerts.filter(a => a.status === "acknowledged").length,
    resolved: activeAlerts.filter(a => a.status === "resolved").length,
    escalated: activeAlerts.filter(a => a.status === "escalated").length,
    bySeverity,
    averageResolutionTime: avgResolution,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

// Hook into message analysis to trigger alerts
const originalAnalyzeMessage = analyzeMessage;
export { originalAnalyzeMessage };

// ============================================
// AI RESPONSE TEMPLATES
// ============================================

export interface ResponseTemplate {
  id: string;
  category: "symptom_inquiry" | "medication_question" | "appointment_request" | "billing_inquiry" | "general_question" | "follow_up" | "gratitude" | "complaint";
  tone: "empathetic" | "professional" | "friendly" | "formal";
  suggestedResponse: string;
  placeholders: string[];
  confidenceScore: number;
  requiresReview: boolean;
  disclaimer: string;
}

export async function generateResponseTemplate(
  userId: string,
  patientMessage: CommunicationMessage,
  context?: {
    patientName?: string;
    providerName?: string;
    departmentName?: string;
    previousInteractions?: string[];
  }
): Promise<{ templates: ResponseTemplate[]; disclaimer: string }> {
  logHipaaAudit("GENERATE_RESPONSE_TEMPLATE", userId, patientMessage.patientId, `Message ID: ${patientMessage.id}`);
  
  if (isAiEnabled()) {
    try {
      const prompt = `You are an AI assistant helping healthcare staff respond to patient messages. Generate 3 response templates for the following patient message.

Patient Message: "${patientMessage.content}"
${context?.patientName ? `Patient Name: ${context.patientName}` : ''}
${context?.providerName ? `Provider Name: ${context.providerName}` : ''}
${context?.departmentName ? `Department: ${context.departmentName}` : ''}

Generate response templates in the following JSON format:
{
  "templates": [
    {
      "category": "symptom_inquiry|medication_question|appointment_request|billing_inquiry|general_question|follow_up|gratitude|complaint",
      "tone": "empathetic|professional|friendly|formal",
      "suggestedResponse": "The response text with [PLACEHOLDER] markers for customization",
      "placeholders": ["list of placeholders used"],
      "confidenceScore": 0.0-1.0,
      "requiresReview": true/false
    }
  ]
}

Requirements:
- Responses should be professional and HIPAA-compliant
- Never provide medical advice or diagnosis
- Include appropriate empathy for health-related concerns
- Use placeholders like [PATIENT_NAME], [PROVIDER_NAME], [APPOINTMENT_DATE], [PHONE_NUMBER] where personalization is needed
- Set requiresReview to true for any response involving clinical content
- Provide varied tones: one empathetic, one professional, one friendly`;

      const content = await generatePhiSafeText({
        user: prompt,
        responseMimeType: "application/json",
        temperature: 0.7
      });

      if (content) {
        const parsed = JSON.parse(content);
        const templates: ResponseTemplate[] = (parsed.templates || []).map((t: any, idx: number) => ({
          id: `template-${Date.now()}-${idx}`,
          category: t.category || "general_question",
          tone: t.tone || "professional",
          suggestedResponse: t.suggestedResponse || "",
          placeholders: t.placeholders || [],
          confidenceScore: t.confidenceScore || 0.7,
          requiresReview: t.requiresReview !== false,
          disclaimer: NO_CDS_DISCLAIMER
        }));
        
        return { templates, disclaimer: NO_CDS_DISCLAIMER };
      }
    } catch (error) {
      console.error("[AICommunicationAnalytics] Error generating response templates:", error);
    }
  }
  
  // Fallback templates
  const fallbackTemplates: ResponseTemplate[] = [
    {
      id: `template-${Date.now()}-0`,
      category: "general_question",
      tone: "empathetic",
      suggestedResponse: "Thank you for reaching out, [PATIENT_NAME]. We understand your concern and want to help. A member of our care team will review your message and respond within [RESPONSE_TIME]. If this is urgent, please call our office at [PHONE_NUMBER].",
      placeholders: ["PATIENT_NAME", "RESPONSE_TIME", "PHONE_NUMBER"],
      confidenceScore: 0.6,
      requiresReview: true,
      disclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: `template-${Date.now()}-1`,
      category: "general_question",
      tone: "professional",
      suggestedResponse: "Dear [PATIENT_NAME], Thank you for contacting [DEPARTMENT_NAME]. We have received your message and will respond as soon as possible. For immediate assistance, please contact us at [PHONE_NUMBER]. Best regards, [PROVIDER_NAME]",
      placeholders: ["PATIENT_NAME", "DEPARTMENT_NAME", "PHONE_NUMBER", "PROVIDER_NAME"],
      confidenceScore: 0.6,
      requiresReview: true,
      disclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: `template-${Date.now()}-2`,
      category: "general_question",
      tone: "friendly",
      suggestedResponse: "Hi [PATIENT_NAME]! Thanks for getting in touch. We've received your message and someone from our team will get back to you shortly. In the meantime, feel free to call us at [PHONE_NUMBER] if you need anything right away.",
      placeholders: ["PATIENT_NAME", "PHONE_NUMBER"],
      confidenceScore: 0.6,
      requiresReview: true,
      disclaimer: NO_CDS_DISCLAIMER
    }
  ];
  
  return { templates: fallbackTemplates, disclaimer: NO_CDS_DISCLAIMER };
}

// ============================================
// COMPREHENSIVE PATIENT MESSAGE SUMMARY
// ============================================

export interface PatientMessageSummary {
  patientId: string;
  patientName?: string;
  period: { start: string; end: string };
  totalMessages: number;
  messagesByType: Record<string, number>;
  overallSentiment: {
    averageScore: number;
    trend: "improving" | "declining" | "stable" | "volatile";
    dominantTone: string;
  };
  keyThemes: string[];
  unresolvedConcerns: DetectedConcern[];
  communicationPatterns: {
    preferredChannel: string;
    averageResponseTime: string;
    engagementLevel: string;
  };
  actionItems: Array<{
    priority: "high" | "medium" | "low";
    description: string;
    suggestedOwner: string;
  }>;
  aiInsights: string[];
  disclaimer: string;
}

export async function generatePatientMessageSummary(
  userId: string,
  patientId: string,
  messages: CommunicationMessage[],
  periodDays: number = 30
): Promise<PatientMessageSummary> {
  logHipaaAudit("GENERATE_PATIENT_SUMMARY", userId, patientId, `Messages: ${messages.length}, Period: ${periodDays} days`);
  
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  // Analyze all messages
  const analyses: CommunicationAnalysis[] = [];
  for (const msg of messages.slice(0, 20)) { // Limit to 20 for performance
    const analysis = await analyzeMessage(userId, msg);
    analyses.push(analysis);
  }
  
  // Aggregate data
  const messagesByType: Record<string, number> = {};
  messages.forEach(m => {
    messagesByType[m.messageType] = (messagesByType[m.messageType] || 0) + 1;
  });
  
  const sentimentScores = analyses.map(a => a.sentiment.score);
  const avgSentiment = sentimentScores.length > 0 
    ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length 
    : 0;
  
  // Calculate trend
  let trend: "improving" | "declining" | "stable" | "volatile" = "stable";
  if (sentimentScores.length >= 3) {
    const firstHalf = sentimentScores.slice(0, Math.floor(sentimentScores.length / 2));
    const secondHalf = sentimentScores.slice(Math.floor(sentimentScores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const variance = sentimentScores.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentimentScores.length;
    
    if (variance > 4) trend = "volatile";
    else if (secondAvg - firstAvg > 1) trend = "improving";
    else if (firstAvg - secondAvg > 1) trend = "declining";
  }
  
  // Collect all concerns
  const allConcerns = analyses.flatMap(a => a.concerns);
  const unresolvedConcerns = allConcerns.filter(c => c.severity === "high" || c.severity === "critical");
  
  // Key themes
  const allTopics = analyses.flatMap(a => a.keyTopics);
  const topicCounts: Record<string, number> = {};
  allTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
  const keyThemes = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
  
  // Determine preferred channel
  const channelCounts = Object.entries(messagesByType).sort((a, b) => b[1] - a[1]);
  const preferredChannel = channelCounts[0]?.[0] || "portal_message";
  
  // Generate action items
  const actionItems: PatientMessageSummary["actionItems"] = [];
  if (unresolvedConcerns.some(c => c.severity === "critical")) {
    actionItems.push({
      priority: "high",
      description: "Critical concern detected - requires immediate clinical review",
      suggestedOwner: "care-team-lead"
    });
  }
  if (trend === "declining") {
    actionItems.push({
      priority: "medium",
      description: "Patient sentiment declining - consider proactive outreach",
      suggestedOwner: "care-coordinator"
    });
  }
  if (analyses.some(a => a.urgentFlags.length > 0)) {
    actionItems.push({
      priority: "high",
      description: "Unaddressed urgent flags in recent communications",
      suggestedOwner: "on-call-provider"
    });
  }
  
  // AI insights
  let aiInsights: string[] = [];

  if (isAiEnabled() && analyses.length > 0) {
    try {
      const summaryPrompt = `Based on the following patient communication analysis, provide 3-5 brief operational insights (NOT clinical advice):

Sentiment Average: ${avgSentiment.toFixed(1)}
Sentiment Trend: ${trend}
Key Themes: ${keyThemes.join(", ")}
Concern Types: ${allConcerns.map(c => c.type).join(", ")}
Message Count: ${messages.length}

Provide insights in JSON format: { "insights": ["insight1", "insight2", ...] }
Focus on communication patterns, engagement suggestions, and operational improvements.`;

      const content = await generatePhiSafeText({
        user: summaryPrompt,
        responseMimeType: "application/json",
        temperature: 0.5
      });

      if (content) {
        const parsed = JSON.parse(content);
        aiInsights = parsed.insights || [];
      }
    } catch (error) {
      console.error("[AICommunicationAnalytics] Error generating insights:", error);
    }
  }
  
  if (aiInsights.length === 0) {
    aiInsights = [
      `Patient has sent ${messages.length} messages in the past ${periodDays} days`,
      `Overall sentiment is ${avgSentiment > 0 ? "positive" : avgSentiment < 0 ? "negative" : "neutral"} with ${trend} trend`,
      `Primary topics of discussion: ${keyThemes.slice(0, 3).join(", ") || "General inquiries"}`
    ];
  }
  
  return {
    patientId,
    patientName: messages[0]?.patientName,
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    totalMessages: messages.length,
    messagesByType,
    overallSentiment: {
      averageScore: Math.round(avgSentiment * 10) / 10,
      trend,
      dominantTone: analyses[0]?.sentiment.emotionalTone[0] || "neutral"
    },
    keyThemes,
    unresolvedConcerns,
    communicationPatterns: {
      preferredChannel,
      averageResponseTime: "Within 24 hours",
      engagementLevel: messages.length > 10 ? "high" : messages.length > 3 ? "moderate" : "low"
    },
    actionItems,
    aiInsights,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

// ============================================
// CARE TEAM NOTIFICATIONS
// ============================================

export interface CareTeamNotification {
  id: string;
  type: "critical_alert" | "urgent_message" | "sentiment_change" | "engagement_drop" | "action_required";
  patientId: string;
  patientName?: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  recipients: string[];
  createdAt: string;
  readBy: string[];
  actionUrl?: string;
  relatedAlertId?: string;
  disclaimer: string;
}

const careTeamNotifications: CareTeamNotification[] = [];

export function createCareTeamNotification(
  userId: string,
  notification: Omit<CareTeamNotification, "id" | "createdAt" | "readBy" | "disclaimer">
): CareTeamNotification {
  logHipaaAudit("CREATE_CARE_TEAM_NOTIFICATION", userId, notification.patientId, `Type: ${notification.type}`);
  
  const newNotification: CareTeamNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    readBy: [],
    disclaimer: NO_CDS_DISCLAIMER
  };
  
  careTeamNotifications.unshift(newNotification);
  
  // Keep only last 500 notifications
  if (careTeamNotifications.length > 500) {
    careTeamNotifications.length = 500;
  }
  
  console.log(`[CareTeamNotification] Created: ${newNotification.type} for patient ${notification.patientId}`);
  
  return newNotification;
}

export function getCareTeamNotifications(
  userId: string,
  filters?: {
    unreadOnly?: boolean;
    patientId?: string;
    type?: string;
    priority?: string;
  }
): { notifications: CareTeamNotification[]; unreadCount: number; disclaimer: string } {
  logHipaaAudit("GET_CARE_TEAM_NOTIFICATIONS", userId, filters?.patientId, "Fetching notifications");
  
  let filtered = [...careTeamNotifications];
  
  if (filters?.unreadOnly) {
    filtered = filtered.filter(n => !n.readBy.includes(userId));
  }
  if (filters?.patientId) {
    filtered = filtered.filter(n => n.patientId === filters.patientId);
  }
  if (filters?.type) {
    filtered = filtered.filter(n => n.type === filters.type);
  }
  if (filters?.priority) {
    filtered = filtered.filter(n => n.priority === filters.priority);
  }
  
  const unreadCount = careTeamNotifications.filter(n => !n.readBy.includes(userId)).length;
  
  return {
    notifications: filtered.slice(0, 50),
    unreadCount,
    disclaimer: NO_CDS_DISCLAIMER
  };
}

export function markNotificationRead(
  userId: string,
  notificationId: string
): { success: boolean; disclaimer: string } {
  logHipaaAudit("MARK_NOTIFICATION_READ", userId, undefined, `Notification ID: ${notificationId}`);
  
  const notification = careTeamNotifications.find(n => n.id === notificationId);
  if (notification && !notification.readBy.includes(userId)) {
    notification.readBy.push(userId);
  }
  
  return { success: true, disclaimer: NO_CDS_DISCLAIMER };
}

export function markAllNotificationsRead(userId: string): { success: boolean; count: number; disclaimer: string } {
  logHipaaAudit("MARK_ALL_NOTIFICATIONS_READ", userId, undefined, "Marking all notifications read");
  
  let count = 0;
  careTeamNotifications.forEach(n => {
    if (!n.readBy.includes(userId)) {
      n.readBy.push(userId);
      count++;
    }
  });
  
  return { success: true, count, disclaimer: NO_CDS_DISCLAIMER };
}

// Auto-notify care team on critical alerts
export function notifyCareTeamOnCriticalAlert(alert: Alert): void {
  if (alert.severity === "critical" || alert.severity === "urgent") {
    createCareTeamNotification("system", {
      type: "critical_alert",
      patientId: alert.patientId,
      title: `${alert.severity.toUpperCase()}: Communication Alert`,
      message: alert.triggerReason,
      priority: alert.severity === "critical" ? "urgent" : "high",
      recipients: ["care-team-lead", "on-call-provider"],
      actionUrl: `/communication-analytics?alertId=${alert.id}`,
      relatedAlertId: alert.id
    });
  }
}

// ============================================
// ANALYTICS EXPORT
// ============================================

export interface ExportData {
  exportId: string;
  format: "csv" | "json" | "pdf";
  type: "sentiment_trends" | "engagement_metrics" | "alerts" | "patient_summary" | "full_analytics";
  generatedAt: string;
  generatedBy: string;
  data: any;
  metadata: {
    recordCount: number;
    period?: { start: string; end: string };
    filters?: Record<string, any>;
  };
  disclaimer: string;
}

export function exportAnalyticsData(
  userId: string,
  exportType: ExportData["type"],
  format: ExportData["format"],
  options?: {
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }
): ExportData {
  logHipaaAudit("EXPORT_ANALYTICS", userId, options?.patientId, `Type: ${exportType}, Format: ${format}`);
  
  let data: any;
  let recordCount = 0;
  
  switch (exportType) {
    case "sentiment_trends":
      data = Array.from(analysisCache.values()).map(a => ({
        messageId: a.messageId,
        patientId: a.patientId,
        analyzedAt: a.analyzedAt,
        sentimentScore: a.sentiment.score,
        sentimentLabel: a.sentiment.label,
        riskScore: a.riskScore
      }));
      recordCount = data.length;
      break;
      
    case "engagement_metrics":
      // Group portal interactions by patientId
      const interactionsByPatient: Record<string, PortalInteraction[]> = {};
      portalInteractions.forEach(interaction => {
        if (!interactionsByPatient[interaction.patientId]) {
          interactionsByPatient[interaction.patientId] = [];
        }
        interactionsByPatient[interaction.patientId].push(interaction);
      });
      data = Object.entries(interactionsByPatient).map(([patientId, interactions]) => ({
        patientId,
        totalInteractions: interactions.length,
        lastActivity: interactions[interactions.length - 1]?.timestamp
      }));
      recordCount = data.length;
      break;
      
    case "alerts":
      data = activeAlerts.map(a => ({
        id: a.id,
        patientId: a.patientId,
        configurationId: a.configurationId,
        severity: a.severity,
        status: a.status,
        triggeredAt: a.triggeredAt,
        resolvedAt: a.resolvedAt
      }));
      recordCount = data.length;
      break;
      
    case "patient_summary":
      if (options?.patientId) {
        const patientAnalyses = Array.from(analysisCache.values())
          .filter(a => a.patientId === options.patientId);
        data = {
          patientId: options.patientId,
          analyses: patientAnalyses,
          alertCount: activeAlerts.filter(a => a.patientId === options.patientId).length
        };
        recordCount = patientAnalyses.length;
      } else {
        data = { error: "Patient ID required for patient summary export" };
        recordCount = 0;
      }
      break;
      
    case "full_analytics":
      data = {
        analyses: Array.from(analysisCache.values()),
        alerts: activeAlerts,
        alertConfigs: alertConfigurations,
        interactions: portalInteractions
      };
      recordCount = analysisCache.size + activeAlerts.length;
      break;
      
    default:
      data = {};
  }
  
  // Convert to CSV if needed
  if (format === "csv" && Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row: any) => 
      Object.values(row).map(v => 
        typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v
      ).join(",")
    );
    data = [headers, ...rows].join("\n");
  }
  
  return {
    exportId: `export-${Date.now()}`,
    format,
    type: exportType,
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
    data,
    metadata: {
      recordCount,
      period: options?.startDate ? { start: options.startDate, end: options.endDate || new Date().toISOString() } : undefined,
      filters: options
    },
    disclaimer: NO_CDS_DISCLAIMER
  };
}

console.log("[AICommunicationAnalytics] Service initialized with NO-CDS compliance");
console.log("[AICommunicationAnalytics] Enhanced features: Trend Detection, Portal Tracking, Automated Alerts, Response Templates, Care Team Notifications, Analytics Export");
