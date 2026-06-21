import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface PatientFeedback {
  id: string;
  patientId?: string;
  source: "survey" | "message" | "portal" | "phone" | "email";
  type: "general" | "visit" | "provider" | "facility" | "billing" | "wait_time" | "communication";
  content: string;
  rating?: number;
  date: string;
  providerId?: string;
  providerName?: string;
  departmentId?: string;
  departmentName?: string;
  visitId?: string;
  analyzed?: boolean;
}

export interface SentimentResult {
  score: number;
  label: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  confidence: number;
  emotionalTone: string[];
}

export interface ThemeResult {
  theme: string;
  category: string;
  frequency: number;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  examples: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface ImprovementArea {
  id: string;
  area: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  currentScore: number;
  targetScore: number;
  feedbackCount: number;
  recommendations: string[];
  estimatedImpact: string;
  relatedThemes: string[];
}

export interface FeedbackAnalysis {
  id: string;
  feedbackId: string;
  sentiment: SentimentResult;
  themes: string[];
  keyPhrases: string[];
  intent: string;
  actionRequired: boolean;
  urgency: "immediate" | "soon" | "routine" | "none";
  suggestedResponse?: string;
  analyzedAt: string;
}

export interface AnalyticsSummary {
  periodStart: string;
  periodEnd: string;
  totalFeedback: number;
  averageSentiment: number;
  sentimentDistribution: {
    veryPositive: number;
    positive: number;
    neutral: number;
    negative: number;
    veryNegative: number;
  };
  topThemes: ThemeResult[];
  improvementAreas: ImprovementArea[];
  trendingIssues: { issue: string; trend: "rising" | "stable" | "declining"; changePercent: number }[];
  satisfactionScore: number;
  responseRate: number;
}

const feedbackStore = new Map<string, PatientFeedback>();
const analysisStore = new Map<string, FeedbackAnalysis>();

function initializeSampleFeedback() {
  const sampleFeedback: PatientFeedback[] = [
    {
      id: "fb-1",
      patientId: "patient-001",
      source: "survey",
      type: "visit",
      content: "Dr. Smith was incredibly thorough and took the time to explain my diagnosis clearly. The nurse was also very kind and made me feel comfortable. However, I waited over 45 minutes past my appointment time which was frustrating.",
      rating: 4,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      providerId: "provider-001",
      providerName: "Dr. Sarah Smith",
      departmentName: "Internal Medicine"
    },
    {
      id: "fb-2",
      patientId: "patient-002",
      source: "message",
      type: "communication",
      content: "I've been trying to get my test results for a week now. Nobody returns my calls and the patient portal doesn't show anything. This is unacceptable - I'm very worried about my health and need answers!",
      rating: 1,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      departmentName: "Lab Services"
    },
    {
      id: "fb-3",
      patientId: "patient-003",
      source: "survey",
      type: "provider",
      content: "My experience with Dr. Johnson was excellent. She listened to all my concerns and developed a comprehensive treatment plan. The follow-up call from her team was a nice touch. Highly recommend!",
      rating: 5,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      providerId: "provider-002",
      providerName: "Dr. Emily Johnson",
      departmentName: "Family Medicine"
    },
    {
      id: "fb-4",
      patientId: "patient-004",
      source: "portal",
      type: "billing",
      content: "I received a bill that doesn't match what I was told at checkout. The insurance was supposed to cover most of this. Spent 2 hours on hold trying to get it resolved. Very disappointed with the billing department.",
      rating: 2,
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      departmentName: "Billing"
    },
    {
      id: "fb-5",
      patientId: "patient-005",
      source: "survey",
      type: "wait_time",
      content: "The check-in process was smooth and the waiting room was clean. However, my appointment was at 2pm and I wasn't seen until 3:15pm. The staff apologized but this seems to be a recurring issue.",
      rating: 3,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      departmentName: "Primary Care"
    },
    {
      id: "fb-6",
      patientId: "patient-006",
      source: "email",
      type: "facility",
      content: "The new building is beautiful and easy to navigate. Parking was convenient and free. The coffee in the waiting area was a pleasant surprise. Overall a very comfortable environment.",
      rating: 5,
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      departmentName: "General"
    },
    {
      id: "fb-7",
      patientId: "patient-007",
      source: "phone",
      type: "communication",
      content: "I appreciate that you offer telehealth appointments now. The video quality was good and Dr. Martinez was just as attentive as in-person visits. Would be nice if prescription refills could be done through the app though.",
      rating: 4,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      providerId: "provider-003",
      providerName: "Dr. Carlos Martinez",
      departmentName: "Telehealth"
    },
    {
      id: "fb-8",
      patientId: "patient-008",
      source: "survey",
      type: "general",
      content: "The care I received was adequate but nothing special. Staff seemed rushed and I didn't feel like my concerns were fully addressed. Would like more time with the doctor.",
      rating: 3,
      date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      departmentName: "Urgent Care"
    }
  ];

  sampleFeedback.forEach(fb => feedbackStore.set(fb.id, fb));
}

initializeSampleFeedback();

class PatientFeedbackAnalysisService {
  constructor() {
    console.log("[FeedbackAnalysis] Service initialized");
  }

  async analyzeFeedback(feedbackId: string): Promise<FeedbackAnalysis> {
    const feedback = feedbackStore.get(feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientFeedback",
      details: `Analyzing feedback ${feedbackId}`
    });

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI analyzing patient feedback for a healthcare organization. Analyze the feedback and return JSON with:
- sentiment: { score: -1 to 1, label: very_negative/negative/neutral/positive/very_positive, confidence: 0-1, emotionalTone: array of emotions }
- themes: array of identified themes (e.g., "wait time", "communication", "staff kindness")
- keyPhrases: important phrases from the feedback
- intent: the patient's primary intent (complaint, praise, suggestion, question)
- actionRequired: boolean if follow-up is needed
- urgency: immediate/soon/routine/none
- suggestedResponse: brief suggested response if action required`
          },
          {
            role: "user",
            content: `Analyze this patient feedback:\nSource: ${feedback.source}\nType: ${feedback.type}\nRating: ${feedback.rating || "N/A"}/5\nContent: "${feedback.content}"`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const analysis: FeedbackAnalysis = {
        id: `analysis-${Date.now()}`,
        feedbackId,
        sentiment: parsed.sentiment || {
          score: 0,
          label: "neutral",
          confidence: 0.5,
          emotionalTone: []
        },
        themes: parsed.themes || [],
        keyPhrases: parsed.keyPhrases || [],
        intent: parsed.intent || "unknown",
        actionRequired: parsed.actionRequired || false,
        urgency: parsed.urgency || "none",
        suggestedResponse: parsed.suggestedResponse,
        analyzedAt: new Date().toISOString()
      };

      analysisStore.set(analysis.id, analysis);
      feedback.analyzed = true;
      feedbackStore.set(feedbackId, feedback);

      return analysis;
    } catch (error) {
      console.error("[FeedbackAnalysis] OpenAI error:", error);
      const fallbackAnalysis: FeedbackAnalysis = {
        id: `analysis-${Date.now()}`,
        feedbackId,
        sentiment: this.basicSentimentAnalysis(feedback.content, feedback.rating),
        themes: this.extractBasicThemes(feedback.content, feedback.type),
        keyPhrases: feedback.content.split(/[.!?]/).filter(s => s.trim().length > 10).slice(0, 3),
        intent: this.determineIntent(feedback.content, feedback.rating),
        actionRequired: (feedback.rating || 5) <= 2,
        urgency: (feedback.rating || 5) <= 2 ? "soon" : "routine",
        suggestedResponse: (feedback.rating || 5) <= 2 ? "Thank you for your feedback. We apologize for your experience and will follow up shortly." : undefined,
        analyzedAt: new Date().toISOString()
      };
      
      analysisStore.set(fallbackAnalysis.id, fallbackAnalysis);
      return fallbackAnalysis;
    }
  }

  private basicSentimentAnalysis(content: string, rating?: number): SentimentResult {
    const lower = content.toLowerCase();
    const positiveWords = ["excellent", "great", "wonderful", "amazing", "helpful", "kind", "thorough", "recommend", "appreciate", "comfortable"];
    const negativeWords = ["frustrated", "disappointed", "unacceptable", "worried", "problem", "issue", "waited", "terrible", "awful", "rude"];
    
    let positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    let negativeCount = negativeWords.filter(w => lower.includes(w)).length;
    
    let score = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
    if (rating) {
      score = (score + (rating - 3) / 2) / 2;
    }
    
    let label: SentimentResult["label"] = "neutral";
    if (score > 0.5) label = "very_positive";
    else if (score > 0.2) label = "positive";
    else if (score < -0.5) label = "very_negative";
    else if (score < -0.2) label = "negative";

    return {
      score,
      label,
      confidence: 0.7,
      emotionalTone: negativeCount > positiveCount ? ["frustrated", "concerned"] : positiveCount > negativeCount ? ["satisfied", "grateful"] : ["neutral"]
    };
  }

  private extractBasicThemes(content: string, type: string): string[] {
    const themes: string[] = [];
    const lower = content.toLowerCase();
    
    if (lower.includes("wait") || lower.includes("delay")) themes.push("wait time");
    if (lower.includes("staff") || lower.includes("nurse")) themes.push("staff interaction");
    if (lower.includes("doctor") || lower.includes("dr.") || lower.includes("provider")) themes.push("provider care");
    if (lower.includes("bill") || lower.includes("cost") || lower.includes("insurance")) themes.push("billing");
    if (lower.includes("call") || lower.includes("phone") || lower.includes("response")) themes.push("communication");
    if (lower.includes("clean") || lower.includes("facility") || lower.includes("building")) themes.push("facility");
    if (lower.includes("appointment") || lower.includes("schedule")) themes.push("scheduling");
    if (lower.includes("portal") || lower.includes("app") || lower.includes("online")) themes.push("digital access");
    
    if (themes.length === 0) themes.push(type);
    return themes;
  }

  private determineIntent(content: string, rating?: number): string {
    const lower = content.toLowerCase();
    if (rating && rating >= 4) return "praise";
    if (rating && rating <= 2) return "complaint";
    if (lower.includes("would be nice") || lower.includes("suggest") || lower.includes("could")) return "suggestion";
    if (lower.includes("?")) return "question";
    return "feedback";
  }

  async getThemeAnalysis(): Promise<ThemeResult[]> {
    const allFeedback = Array.from(feedbackStore.values());
    const themeCount = new Map<string, { count: number; sentiments: number[]; examples: string[] }>();

    for (const fb of allFeedback) {
      const themes = this.extractBasicThemes(fb.content, fb.type);
      const sentiment = this.basicSentimentAnalysis(fb.content, fb.rating);
      
      themes.forEach(theme => {
        const existing = themeCount.get(theme) || { count: 0, sentiments: [], examples: [] };
        existing.count++;
        existing.sentiments.push(sentiment.score);
        if (existing.examples.length < 3) {
          existing.examples.push(fb.content.substring(0, 100) + (fb.content.length > 100 ? "..." : ""));
        }
        themeCount.set(theme, existing);
      });
    }

    const themeResults: ThemeResult[] = Array.from(themeCount.entries()).map(([theme, data]) => {
      const avgSentiment = data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length;
      let sentimentLabel: ThemeResult["sentiment"] = "neutral";
      if (avgSentiment > 0.2) sentimentLabel = "positive";
      else if (avgSentiment < -0.2) sentimentLabel = "negative";
      else if (data.sentiments.some(s => s > 0.3) && data.sentiments.some(s => s < -0.3)) sentimentLabel = "mixed";

      let priority: ThemeResult["priority"] = "low";
      if (data.count >= 3 && avgSentiment < -0.3) priority = "critical";
      else if (data.count >= 2 && avgSentiment < 0) priority = "high";
      else if (avgSentiment < 0) priority = "medium";

      return {
        theme,
        category: this.categorizeTheme(theme),
        frequency: data.count,
        sentiment: sentimentLabel,
        examples: data.examples,
        priority
      };
    });

    return themeResults.sort((a, b) => b.frequency - a.frequency);
  }

  private categorizeTheme(theme: string): string {
    const categories: Record<string, string[]> = {
      "Operations": ["wait time", "scheduling", "check-in"],
      "Clinical Care": ["provider care", "treatment", "diagnosis"],
      "Customer Service": ["staff interaction", "communication", "responsiveness"],
      "Facilities": ["facility", "parking", "cleanliness"],
      "Financial": ["billing", "insurance", "costs"],
      "Technology": ["digital access", "portal", "telehealth"]
    };

    for (const [category, themes] of Object.entries(categories)) {
      if (themes.some(t => theme.toLowerCase().includes(t))) {
        return category;
      }
    }
    return "General";
  }

  async getImprovementAreas(): Promise<ImprovementArea[]> {
    const themes = await this.getThemeAnalysis();
    const negativeThemes = themes.filter(t => t.sentiment === "negative" || t.sentiment === "mixed");

    return negativeThemes.slice(0, 5).map((theme, index) => ({
      id: `imp-${index + 1}`,
      area: theme.theme,
      category: theme.category,
      priority: theme.priority,
      currentScore: Math.round((1 - Math.abs(theme.frequency / 10)) * 5 * 10) / 10,
      targetScore: 4.5,
      feedbackCount: theme.frequency,
      recommendations: this.generateRecommendations(theme.theme),
      estimatedImpact: theme.priority === "critical" ? "High - addresses major patient concern" : theme.priority === "high" ? "Medium-High - improves satisfaction significantly" : "Medium - incremental improvement",
      relatedThemes: themes.filter(t => t.category === theme.category && t.theme !== theme.theme).map(t => t.theme).slice(0, 2)
    }));
  }

  private generateRecommendations(theme: string): string[] {
    const recommendations: Record<string, string[]> = {
      "wait time": [
        "Implement buffer time between appointments",
        "Use AI scheduling optimization to reduce gaps",
        "Send real-time wait time updates to patients",
        "Consider overbooking analysis for no-show prone slots"
      ],
      "communication": [
        "Set up automated callback system for missed calls",
        "Implement patient portal messaging with 24-hour response SLA",
        "Create escalation protocols for urgent inquiries",
        "Train staff on empathetic communication"
      ],
      "billing": [
        "Provide upfront cost estimates before visits",
        "Implement real-time eligibility verification",
        "Offer payment plans and financial counseling",
        "Reduce hold times for billing inquiries"
      ],
      "staff interaction": [
        "Conduct customer service training sessions",
        "Implement patient satisfaction surveys post-visit",
        "Recognize and reward excellent service",
        "Review staffing levels during peak hours"
      ],
      "digital access": [
        "Improve patient portal user experience",
        "Add mobile app prescription refill feature",
        "Ensure test results are posted within 24 hours",
        "Provide tech support for portal users"
      ]
    };

    return recommendations[theme] || [
      "Conduct root cause analysis with stakeholders",
      "Develop action plan with measurable goals",
      "Monitor feedback trends after implementing changes",
      "Gather additional patient input on specific issues"
    ];
  }

  async getAnalyticsSummary(startDate?: string, endDate?: string): Promise<AnalyticsSummary> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientFeedback",
      details: "Generating analytics summary"
    });

    const allFeedback = Array.from(feedbackStore.values());
    const themes = await this.getThemeAnalysis();
    const improvements = await this.getImprovementAreas();

    const sentiments = allFeedback.map(fb => this.basicSentimentAnalysis(fb.content, fb.rating));
    const avgSentiment = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

    const distribution = {
      veryPositive: sentiments.filter(s => s.label === "very_positive").length,
      positive: sentiments.filter(s => s.label === "positive").length,
      neutral: sentiments.filter(s => s.label === "neutral").length,
      negative: sentiments.filter(s => s.label === "negative").length,
      veryNegative: sentiments.filter(s => s.label === "very_negative").length
    };

    const ratings = allFeedback.filter(fb => fb.rating).map(fb => fb.rating!);
    const satisfactionScore = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      periodStart: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: endDate || new Date().toISOString(),
      totalFeedback: allFeedback.length,
      averageSentiment: avgSentiment,
      sentimentDistribution: distribution,
      topThemes: themes.slice(0, 5),
      improvementAreas: improvements,
      trendingIssues: [
        { issue: "Wait times", trend: "stable", changePercent: 5 },
        { issue: "Communication delays", trend: "rising", changePercent: 15 },
        { issue: "Billing clarity", trend: "declining", changePercent: -10 }
      ],
      satisfactionScore,
      responseRate: 0.72
    };
  }

  async submitFeedback(feedback: Omit<PatientFeedback, "id" | "date" | "analyzed">): Promise<PatientFeedback> {
    const newFeedback: PatientFeedback = {
      ...feedback,
      id: `fb-${Date.now()}`,
      date: new Date().toISOString(),
      analyzed: false
    };
    
    feedbackStore.set(newFeedback.id, newFeedback);
    return newFeedback;
  }

  getAllFeedback(): PatientFeedback[] {
    return Array.from(feedbackStore.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  getFeedbackById(id: string): PatientFeedback | undefined {
    return feedbackStore.get(id);
  }

  getAnalysisById(id: string): FeedbackAnalysis | undefined {
    return analysisStore.get(id);
  }

  getAllAnalyses(): FeedbackAnalysis[] {
    return Array.from(analysisStore.values());
  }
}

export const patientFeedbackAnalysisService = new PatientFeedbackAnalysisService();
