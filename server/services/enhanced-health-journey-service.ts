import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_DISCLAIMER = "This information is for educational and motivational purposes only and does NOT constitute clinical decision support or medical advice. Always consult your healthcare provider for personalized medical decisions.";

export interface SentimentAnalysis {
  id: string;
  patientId: string;
  journeyId: string;
  timestamp: string;
  source: 'message' | 'feedback' | 'survey' | 'interaction';
  rawText: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'motivated' | 'confused';
  sentimentScore: number;
  emotionalIndicators: string[];
  engagementLevel: 'high' | 'medium' | 'low';
  suggestedInterventions: string[];
  aiGenerated: boolean;
}

export interface DynamicContentAdjustment {
  id: string;
  journeyId: string;
  patientId: string;
  timestamp: string;
  triggerType: 'sentiment' | 'progress' | 'engagement' | 'milestone' | 'ai_recommendation';
  originalContent: ContentAdjustmentItem[];
  adjustedContent: ContentAdjustmentItem[];
  reason: string;
  aiInsights: string;
  applied: boolean;
  disclaimer: string;
}

export interface ContentAdjustmentItem {
  type: 'module' | 'task' | 'reminder' | 'encouragement';
  id: string;
  originalPriority?: number;
  newPriority?: number;
  originalDifficulty?: string;
  newDifficulty?: string;
  action: 'add' | 'remove' | 'modify' | 'reorder';
  details: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  conditionType: string;
  memberCount: number;
  createdAt: string;
  isPrivate: boolean;
  moderatorIds: string[];
  rules: string[];
  tags: string[];
  activityLevel: 'very_active' | 'active' | 'moderate' | 'quiet';
  supportType: 'peer_support' | 'education' | 'lifestyle' | 'caregivers' | 'general';
}

export interface CommunityMember {
  id: string;
  patientId: string;
  groupId: string;
  displayName: string;
  avatarInitials: string;
  joinedAt: string;
  role: 'member' | 'moderator' | 'admin';
  totalPosts: number;
  totalReplies: number;
  helpfulVotes: number;
  badges: string[];
  isAnonymous: boolean;
}

export interface CommunityPost {
  id: string;
  groupId: string;
  authorId: string;
  authorDisplayName: string;
  authorBadges: string[];
  title: string;
  content: string;
  category: 'question' | 'experience' | 'tip' | 'encouragement' | 'milestone' | 'discussion';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  likes: number;
  replyCount: number;
  isHelpful: boolean;
  isPinned: boolean;
  isModerated: boolean;
  aiModerationFlag?: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
  likes: number;
  isHelpful: boolean;
  isModerated: boolean;
}

export interface TeamChallenge {
  id: string;
  title: string;
  description: string;
  conditionType: string;
  challengeType: 'steps' | 'hydration' | 'medication_adherence' | 'exercise' | 'nutrition' | 'mindfulness' | 'sleep' | 'custom';
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
  targetMetric: string;
  targetValue: number;
  teamSize: number;
  maxTeams: number;
  currentTeams: number;
  rewards: ChallengeReward[];
  rules: string[];
  createdBy: string;
  isGlobal: boolean;
}

export interface Team {
  id: string;
  challengeId: string;
  name: string;
  description: string;
  captainId: string;
  members: TeamMember[];
  totalProgress: number;
  rank: number;
  badges: string[];
  createdAt: string;
  isRecruiting: boolean;
}

export interface TeamMember {
  patientId: string;
  displayName: string;
  avatarInitials: string;
  role: 'captain' | 'member';
  contribution: number;
  joinedAt: string;
  streakDays: number;
}

export interface ChallengeReward {
  rank: number;
  title: string;
  description: string;
  points: number;
  badge?: string;
}

export interface TeamLeaderboard {
  challengeId: string;
  updatedAt: string;
  teams: TeamLeaderboardEntry[];
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  totalProgress: number;
  memberCount: number;
  topContributor: string;
  badges: string[];
}

export interface PatientProgress {
  patientId: string;
  journeyId: string;
  timestamp: string;
  progressType: 'module_completion' | 'task_completion' | 'quiz_score' | 'streak' | 'engagement';
  value: number;
  previousValue: number;
  trend: 'improving' | 'stable' | 'declining';
  consecutiveDecliningDays: number;
}

class EnhancedHealthJourneyService {
  private sentimentAnalyses: Map<string, SentimentAnalysis> = new Map();
  private contentAdjustments: Map<string, DynamicContentAdjustment> = new Map();
  private communityGroups: Map<string, CommunityGroup> = new Map();
  private communityMembers: Map<string, CommunityMember> = new Map();
  private communityPosts: Map<string, CommunityPost> = new Map();
  private communityReplies: Map<string, CommunityReply> = new Map();
  private teamChallenges: Map<string, TeamChallenge> = new Map();
  private teams: Map<string, Team> = new Map();
  private patientProgress: Map<string, PatientProgress[]> = new Map();
  private openaiAvailable: boolean = false;

  constructor() {
    this.initializeSampleData();
    this.checkOpenAIAvailability();
    console.log("[EnhancedHealthJourney] Service initialized with AI sentiment analysis");
    console.log("[EnhancedHealthJourney] Features: Dynamic content, Community support, Team gamification");
    console.log("[EnhancedHealthJourney] NO-CDS compliance enabled for all AI outputs");
  }

  private async checkOpenAIAvailability() {
    this.openaiAvailable = aiEnabled;
    if (aiEnabled) {
      console.log("[EnhancedHealthJourney] AI gateway active for sentiment analysis");
    } else {
      console.log("[EnhancedHealthJourney] AI not available, using fallback sentiment");
    }
  }

  private initializeSampleData() {
    const groups: CommunityGroup[] = [
      {
        id: "group-diabetes-support",
        name: "Type 2 Diabetes Warriors",
        description: "A supportive community for people managing Type 2 diabetes. Share experiences, tips, and encouragement.",
        conditionType: "diabetes",
        memberCount: 247,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        isPrivate: false,
        moderatorIds: ["mod-1", "mod-2"],
        rules: [
          "Be respectful and supportive to all members",
          "No medical advice - share experiences only",
          "Keep discussions on-topic",
          "Protect everyone's privacy"
        ],
        tags: ["diabetes", "type2", "lifestyle", "nutrition", "exercise"],
        activityLevel: "very_active",
        supportType: "peer_support"
      },
      {
        id: "group-heart-health",
        name: "Heart Health Heroes",
        description: "Connect with others on their heart health journey. Share stories, celebrate wins, and support each other.",
        conditionType: "heart_disease",
        memberCount: 156,
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        isPrivate: false,
        moderatorIds: ["mod-3"],
        rules: [
          "Support each other with kindness",
          "Share your journey, not medical advice",
          "Respect privacy and confidentiality"
        ],
        tags: ["heart", "cardio", "exercise", "diet", "stress"],
        activityLevel: "active",
        supportType: "peer_support"
      },
      {
        id: "group-mental-wellness",
        name: "Mind & Body Balance",
        description: "A safe space for discussing mental wellness alongside chronic condition management.",
        conditionType: "mental_health",
        memberCount: 189,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        isPrivate: true,
        moderatorIds: ["mod-4", "mod-5"],
        rules: [
          "This is a judgment-free zone",
          "Be kind and compassionate",
          "No triggering content without warnings",
          "Seek professional help for crises"
        ],
        tags: ["mental_health", "stress", "anxiety", "coping", "mindfulness"],
        activityLevel: "active",
        supportType: "peer_support"
      }
    ];
    groups.forEach(g => this.communityGroups.set(g.id, g));

    const members: CommunityMember[] = [
      {
        id: "member-1",
        patientId: "patient-1",
        groupId: "group-diabetes-support",
        displayName: "HealthySteps",
        avatarInitials: "HS",
        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        role: "member",
        totalPosts: 12,
        totalReplies: 45,
        helpfulVotes: 28,
        badges: ["Helpful Member", "30 Day Streak"],
        isAnonymous: false
      },
      {
        id: "member-2",
        patientId: "patient-2",
        groupId: "group-diabetes-support",
        displayName: "DiabetesChampion",
        avatarInitials: "DC",
        joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        role: "moderator",
        totalPosts: 56,
        totalReplies: 234,
        helpfulVotes: 189,
        badges: ["Top Contributor", "Community Leader", "90 Day Streak"],
        isAnonymous: false
      }
    ];
    members.forEach(m => this.communityMembers.set(m.id, m));

    const posts: CommunityPost[] = [
      {
        id: "post-1",
        groupId: "group-diabetes-support",
        authorId: "member-2",
        authorDisplayName: "DiabetesChampion",
        authorBadges: ["Top Contributor", "Community Leader"],
        title: "My A1C dropped from 9.2 to 6.8 in 6 months!",
        content: "I wanted to share my journey with everyone. When I was first diagnosed, I felt overwhelmed. But with consistent effort, tracking my meals, and regular exercise, I've made huge progress. The key for me was starting small - just a 15 minute walk after dinner. Now I do 45 minutes every day!",
        category: "milestone",
        tags: ["success_story", "a1c", "exercise"],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        likes: 87,
        replyCount: 23,
        isHelpful: true,
        isPinned: true,
        isModerated: true
      },
      {
        id: "post-2",
        groupId: "group-diabetes-support",
        authorId: "member-1",
        authorDisplayName: "HealthySteps",
        authorBadges: ["Helpful Member"],
        title: "Tips for handling holiday meals?",
        content: "The holidays are coming up and I'm a bit anxious about managing my blood sugar at family gatherings. Does anyone have tips for navigating buffets and family dinners without feeling deprived?",
        category: "question",
        tags: ["holidays", "nutrition", "tips"],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        likes: 34,
        replyCount: 15,
        isHelpful: false,
        isPinned: false,
        isModerated: true
      }
    ];
    posts.forEach(p => this.communityPosts.set(p.id, p));

    const replies: CommunityReply[] = [
      {
        id: "reply-1",
        postId: "post-2",
        authorId: "member-2",
        authorDisplayName: "DiabetesChampion",
        content: "Great question! My go-to strategies: 1) Eat a small healthy snack before the event so you're not starving, 2) Fill half your plate with veggies first, 3) Give yourself permission to enjoy a small portion of your favorite dish - it's about balance, not perfection!",
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        likes: 18,
        isHelpful: true,
        isModerated: true
      }
    ];
    replies.forEach(r => this.communityReplies.set(r.id, r));

    const challenges: TeamChallenge[] = [
      {
        id: "challenge-steps-jan",
        title: "New Year Steps Challenge",
        description: "Start the year strong! Work together with your team to hit 1 million combined steps.",
        conditionType: "general",
        challengeType: "steps",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        targetMetric: "steps",
        targetValue: 1000000,
        teamSize: 5,
        maxTeams: 20,
        currentTeams: 12,
        rewards: [
          { rank: 1, title: "Champion Team", description: "First place team reward", points: 5000, badge: "Champion" },
          { rank: 2, title: "Runner Up", description: "Second place team reward", points: 3000, badge: "Silver" },
          { rank: 3, title: "Bronze Stars", description: "Third place team reward", points: 2000, badge: "Bronze" }
        ],
        rules: [
          "Teams must have 3-5 members",
          "Log steps daily for them to count",
          "Encourage teammates respectfully"
        ],
        createdBy: "system",
        isGlobal: true
      },
      {
        id: "challenge-hydration",
        title: "Hydration Heroes",
        description: "Stay hydrated together! Track your water intake and help your team reach the goal.",
        conditionType: "diabetes",
        challengeType: "hydration",
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        targetMetric: "glasses_of_water",
        targetValue: 5000,
        teamSize: 4,
        maxTeams: 15,
        currentTeams: 8,
        rewards: [
          { rank: 1, title: "Hydration Champions", description: "Best hydration team", points: 3000, badge: "HydrationMaster" }
        ],
        rules: [
          "Log at least 6 glasses per day",
          "Support your teammates"
        ],
        createdBy: "system",
        isGlobal: false
      },
      {
        id: "challenge-medication",
        title: "Medication Adherence Masters",
        description: "Build healthy habits together by maintaining perfect medication adherence.",
        conditionType: "diabetes",
        challengeType: "medication_adherence",
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        status: "upcoming",
        targetMetric: "adherence_percentage",
        targetValue: 95,
        teamSize: 4,
        maxTeams: 25,
        currentTeams: 0,
        rewards: [
          { rank: 1, title: "Perfect Adherence", description: "Best adherence team", points: 4000, badge: "AdherenceChamp" }
        ],
        rules: [
          "Mark medications as taken on time",
          "Encourage each other daily"
        ],
        createdBy: "system",
        isGlobal: false
      }
    ];
    challenges.forEach(c => this.teamChallenges.set(c.id, c));

    const sampleTeams: Team[] = [
      {
        id: "team-1",
        challengeId: "challenge-steps-jan",
        name: "Step Masters",
        description: "We're here to crush our step goals together!",
        captainId: "patient-1",
        members: [
          { patientId: "patient-1", displayName: "HealthySteps", avatarInitials: "HS", role: "captain", contribution: 45000, joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 5 },
          { patientId: "patient-2", displayName: "WalkingWonder", avatarInitials: "WW", role: "member", contribution: 38000, joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 4 },
          { patientId: "patient-3", displayName: "StepStar", avatarInitials: "SS", role: "member", contribution: 52000, joinedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 4 }
        ],
        totalProgress: 135000,
        rank: 3,
        badges: ["Early Bird", "Team Spirit"],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        isRecruiting: true
      },
      {
        id: "team-2",
        challengeId: "challenge-steps-jan",
        name: "Walking Warriors",
        description: "Every step counts!",
        captainId: "patient-4",
        members: [
          { patientId: "patient-4", displayName: "FitFighter", avatarInitials: "FF", role: "captain", contribution: 62000, joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 5 },
          { patientId: "patient-5", displayName: "DailySteps", avatarInitials: "DS", role: "member", contribution: 48000, joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 5 },
          { patientId: "patient-6", displayName: "MoveMore", avatarInitials: "MM", role: "member", contribution: 55000, joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 5 },
          { patientId: "patient-7", displayName: "ActiveAndy", avatarInitials: "AA", role: "member", contribution: 41000, joinedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), streakDays: 4 }
        ],
        totalProgress: 206000,
        rank: 1,
        badges: ["Top Team", "Perfect Streak", "Full House"],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        isRecruiting: false
      }
    ];
    sampleTeams.forEach(t => this.teams.set(t.id, t));

    const sampleProgress: PatientProgress[] = [
      {
        patientId: "patient-1",
        journeyId: "journey-1",
        timestamp: new Date().toISOString(),
        progressType: "module_completion",
        value: 75,
        previousValue: 60,
        trend: "improving",
        consecutiveDecliningDays: 0
      }
    ];
    this.patientProgress.set("patient-1", sampleProgress);

    console.log("[EnhancedHealthJourney] Sample data initialized");
    console.log(`[EnhancedHealthJourney] Groups: ${this.communityGroups.size}, Challenges: ${this.teamChallenges.size}, Teams: ${this.teams.size}`);
  }

  async analyzeSentiment(patientId: string, journeyId: string, text: string, source: SentimentAnalysis['source']): Promise<SentimentAnalysis> {
    console.log(`[HIPAA-AUDIT] Sentiment analysis for patient ${patientId} - source: ${source}`);
    
    const deidentifiedText = this.deidentifyText(text);
    
    let sentiment: SentimentAnalysis['sentiment'] = 'neutral';
    let sentimentScore = 0.5;
    let emotionalIndicators: string[] = [];
    let suggestedInterventions: string[] = [];
    let aiGenerated = false;

    if (this.openaiAvailable) {
      try {
        const response = await generatePhiSafeText({
          system: `You are a healthcare sentiment analyzer. Analyze patient messages to understand their emotional state and engagement level. Return JSON with:
- sentiment: one of 'positive', 'neutral', 'negative', 'frustrated', 'motivated', 'confused'
- score: 0-1 (0=very negative, 1=very positive)
- indicators: array of emotional indicators detected
- interventions: array of suggested supportive interventions

Focus on wellness and engagement, NOT clinical diagnosis.`,
          user: `Analyze this patient message: "${deidentifiedText}"`,
          responseMimeType: "application/json",
          maxTokens: 500,
        });

        const result = JSON.parse(response || "{}");
        sentiment = result.sentiment || 'neutral';
        sentimentScore = result.score || 0.5;
        emotionalIndicators = result.indicators || [];
        suggestedInterventions = result.interventions || [];
        aiGenerated = true;
      } catch (error) {
        console.error("[EnhancedHealthJourney] AI sentiment analysis failed, using fallback:", error);
      }
    }

    if (!aiGenerated) {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('frustrated') || lowerText.includes('upset') || lowerText.includes('angry') || lowerText.includes('hate')) {
        sentiment = 'frustrated';
        sentimentScore = 0.2;
        emotionalIndicators = ['frustration_detected'];
        suggestedInterventions = ['Provide encouragement', 'Simplify current tasks', 'Offer support resources'];
      } else if (lowerText.includes('confused') || lowerText.includes('don\'t understand') || lowerText.includes('help')) {
        sentiment = 'confused';
        sentimentScore = 0.4;
        emotionalIndicators = ['confusion_detected'];
        suggestedInterventions = ['Provide clearer explanations', 'Offer educational content'];
      } else if (lowerText.includes('happy') || lowerText.includes('great') || lowerText.includes('excited') || lowerText.includes('achieved')) {
        sentiment = 'motivated';
        sentimentScore = 0.9;
        emotionalIndicators = ['motivation_detected', 'positive_engagement'];
        suggestedInterventions = ['Celebrate achievement', 'Offer next challenge'];
      } else if (lowerText.includes('sad') || lowerText.includes('depressed') || lowerText.includes('hopeless')) {
        sentiment = 'negative';
        sentimentScore = 0.2;
        emotionalIndicators = ['low_mood_detected'];
        suggestedInterventions = ['Provide emotional support', 'Reduce task burden', 'Suggest professional resources'];
      }
    }

    const analysis: SentimentAnalysis = {
      id: `sentiment-${Date.now()}`,
      patientId,
      journeyId,
      timestamp: new Date().toISOString(),
      source,
      rawText: text,
      sentiment,
      sentimentScore,
      emotionalIndicators,
      engagementLevel: sentimentScore > 0.7 ? 'high' : sentimentScore > 0.4 ? 'medium' : 'low',
      suggestedInterventions,
      aiGenerated
    };

    this.sentimentAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  private deidentifyText(text: string): string {
    return text
      .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, '[SSN]')
      .replace(/\b(Dr\.|Doctor)\s+[A-Z][a-z]+/g, '[PROVIDER]')
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/g, '[DATE]');
  }

  async generateDynamicContentAdjustment(patientId: string, journeyId: string): Promise<DynamicContentAdjustment> {
    console.log(`[HIPAA-AUDIT] Generating content adjustment for patient ${patientId}`);

    const recentSentiments = Array.from(this.sentimentAnalyses.values())
      .filter(s => s.patientId === patientId && s.journeyId === journeyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    const avgSentiment = recentSentiments.length > 0
      ? recentSentiments.reduce((sum, s) => sum + s.sentimentScore, 0) / recentSentiments.length
      : 0.5;

    const progress = this.patientProgress.get(patientId) || [];
    const recentProgress = progress.filter(p => p.journeyId === journeyId).slice(-5);
    const trend = recentProgress.length > 0 ? recentProgress[recentProgress.length - 1].trend : 'stable';

    let adjustments: ContentAdjustmentItem[] = [];
    let reason = "";
    let aiInsights = "";
    let triggerType: DynamicContentAdjustment['triggerType'] = 'progress';

    if (avgSentiment < 0.3) {
      triggerType = 'sentiment';
      reason = "Low sentiment detected - adjusting content to be more supportive";
      adjustments = [
        { type: 'task', id: 'task-complex-1', action: 'modify', originalDifficulty: 'advanced', newDifficulty: 'beginner', details: 'Simplified task difficulty' },
        { type: 'encouragement', id: 'encourage-1', action: 'add', details: 'Added motivational message' },
        { type: 'module', id: 'module-stress', action: 'add', details: 'Added stress management module' }
      ];
      aiInsights = "Patient appears to be struggling. Recommend reducing task complexity and adding more supportive content.";
    } else if (avgSentiment > 0.7 && trend === 'improving') {
      triggerType = 'engagement';
      reason = "High engagement and positive sentiment - introducing advanced content";
      adjustments = [
        { type: 'module', id: 'module-advanced-1', action: 'add', details: 'Unlocked advanced module' },
        { type: 'task', id: 'task-challenge', action: 'add', newPriority: 1, details: 'Added bonus challenge task' }
      ];
      aiInsights = "Patient is highly engaged and progressing well. Recommend introducing more challenging content to maintain momentum.";
    } else if (trend === 'declining') {
      triggerType = 'progress';
      reason = "Progress declining - adjusting to re-engage patient";
      adjustments = [
        { type: 'reminder', id: 'reminder-gentle', action: 'add', details: 'Added gentle reminder' },
        { type: 'task', id: 'task-simple', action: 'modify', originalPriority: 3, newPriority: 1, details: 'Prioritized easier task' }
      ];
      aiInsights = "Patient engagement is declining. Recommend simplifying next steps and adding encouraging reminders.";
    } else {
      reason = "Routine adjustment based on current progress";
      adjustments = [
        { type: 'module', id: 'module-next', action: 'reorder', originalPriority: 3, newPriority: 1, details: 'Reordered module based on interest patterns' }
      ];
      aiInsights = "Patient is on track. Minor adjustments to optimize learning path.";
    }

    const adjustment: DynamicContentAdjustment = {
      id: `adjustment-${Date.now()}`,
      journeyId,
      patientId,
      timestamp: new Date().toISOString(),
      triggerType,
      originalContent: [],
      adjustedContent: adjustments,
      reason,
      aiInsights,
      applied: false,
      disclaimer: NO_CDS_DISCLAIMER
    };

    this.contentAdjustments.set(adjustment.id, adjustment);
    return adjustment;
  }

  async applyContentAdjustment(adjustmentId: string): Promise<DynamicContentAdjustment | null> {
    const adjustment = this.contentAdjustments.get(adjustmentId);
    if (!adjustment) return null;

    adjustment.applied = true;
    this.contentAdjustments.set(adjustmentId, adjustment);
    console.log(`[HIPAA-AUDIT] Content adjustment ${adjustmentId} applied for patient ${adjustment.patientId}`);
    return adjustment;
  }

  async getCommunityGroups(conditionType?: string): Promise<CommunityGroup[]> {
    let groups = Array.from(this.communityGroups.values());
    if (conditionType) {
      groups = groups.filter(g => g.conditionType === conditionType || g.conditionType === 'general');
    }
    return groups;
  }

  async getGroupById(groupId: string): Promise<CommunityGroup | null> {
    return this.communityGroups.get(groupId) || null;
  }

  async joinCommunityGroup(patientId: string, groupId: string, displayName: string, isAnonymous: boolean = false): Promise<CommunityMember> {
    const group = this.communityGroups.get(groupId);
    if (!group) throw new Error("Group not found");

    const member: CommunityMember = {
      id: `member-${Date.now()}`,
      patientId,
      groupId,
      displayName: isAnonymous ? `Anonymous${Math.floor(Math.random() * 1000)}` : displayName,
      avatarInitials: displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      joinedAt: new Date().toISOString(),
      role: 'member',
      totalPosts: 0,
      totalReplies: 0,
      helpfulVotes: 0,
      badges: [],
      isAnonymous
    };

    this.communityMembers.set(member.id, member);
    group.memberCount++;
    this.communityGroups.set(groupId, group);

    console.log(`[HIPAA-AUDIT] Patient ${patientId} joined community group ${groupId}`);
    return member;
  }

  async getCommunityPosts(groupId: string, category?: string, limit: number = 20): Promise<CommunityPost[]> {
    let posts = Array.from(this.communityPosts.values())
      .filter(p => p.groupId === groupId && p.isModerated);
    
    if (category) {
      posts = posts.filter(p => p.category === category);
    }

    return posts
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);
  }

  async createCommunityPost(memberId: string, groupId: string, title: string, content: string, category: CommunityPost['category'], tags: string[]): Promise<CommunityPost> {
    const member = this.communityMembers.get(memberId);
    if (!member) throw new Error("Member not found");

    const moderationFlag = await this.moderateContent(content);

    const post: CommunityPost = {
      id: `post-${Date.now()}`,
      groupId,
      authorId: memberId,
      authorDisplayName: member.displayName,
      authorBadges: member.badges,
      title,
      content,
      category,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: 0,
      replyCount: 0,
      isHelpful: false,
      isPinned: false,
      isModerated: !moderationFlag,
      aiModerationFlag: moderationFlag
    };

    this.communityPosts.set(post.id, post);
    member.totalPosts++;
    this.communityMembers.set(memberId, member);

    console.log(`[HIPAA-AUDIT] New community post ${post.id} created by member ${memberId}`);
    return post;
  }

  private async moderateContent(content: string): Promise<string | undefined> {
    const lowerContent = content.toLowerCase();
    const flaggedTerms = ['medical advice', 'you should take', 'diagnos', 'prescription', 'cure'];
    
    for (const term of flaggedTerms) {
      if (lowerContent.includes(term)) {
        return `Content may contain medical advice: "${term}" detected`;
      }
    }
    return undefined;
  }

  async getPostReplies(postId: string): Promise<CommunityReply[]> {
    return Array.from(this.communityReplies.values())
      .filter(r => r.postId === postId && r.isModerated)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createReply(memberId: string, postId: string, content: string): Promise<CommunityReply> {
    const member = this.communityMembers.get(memberId);
    if (!member) throw new Error("Member not found");

    const post = this.communityPosts.get(postId);
    if (!post) throw new Error("Post not found");

    const moderationFlag = await this.moderateContent(content);

    const reply: CommunityReply = {
      id: `reply-${Date.now()}`,
      postId,
      authorId: memberId,
      authorDisplayName: member.displayName,
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
      isHelpful: false,
      isModerated: !moderationFlag
    };

    this.communityReplies.set(reply.id, reply);
    post.replyCount++;
    this.communityPosts.set(postId, post);
    member.totalReplies++;
    this.communityMembers.set(memberId, member);

    return reply;
  }

  async likePost(postId: string): Promise<CommunityPost | null> {
    const post = this.communityPosts.get(postId);
    if (!post) return null;
    post.likes++;
    this.communityPosts.set(postId, post);
    return post;
  }

  async markPostHelpful(postId: string): Promise<CommunityPost | null> {
    const post = this.communityPosts.get(postId);
    if (!post) return null;
    post.isHelpful = true;
    this.communityPosts.set(postId, post);
    
    const author = Array.from(this.communityMembers.values()).find(m => m.id === post.authorId);
    if (author) {
      author.helpfulVotes++;
      this.communityMembers.set(author.id, author);
    }
    return post;
  }

  async getTeamChallenges(conditionType?: string, status?: TeamChallenge['status']): Promise<TeamChallenge[]> {
    let challenges = Array.from(this.teamChallenges.values());
    
    if (conditionType) {
      challenges = challenges.filter(c => c.conditionType === conditionType || c.conditionType === 'general');
    }
    if (status) {
      challenges = challenges.filter(c => c.status === status);
    }

    return challenges.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  async getChallengeById(challengeId: string): Promise<TeamChallenge | null> {
    return this.teamChallenges.get(challengeId) || null;
  }

  async getTeamsForChallenge(challengeId: string): Promise<Team[]> {
    return Array.from(this.teams.values())
      .filter(t => t.challengeId === challengeId)
      .sort((a, b) => a.rank - b.rank);
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    return this.teams.get(teamId) || null;
  }

  async createTeam(challengeId: string, patientId: string, teamName: string, description: string): Promise<Team> {
    const challenge = this.teamChallenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.currentTeams >= challenge.maxTeams) throw new Error("Challenge is full");

    const team: Team = {
      id: `team-${Date.now()}`,
      challengeId,
      name: teamName,
      description,
      captainId: patientId,
      members: [
        {
          patientId,
          displayName: "Team Captain",
          avatarInitials: "TC",
          role: "captain",
          contribution: 0,
          joinedAt: new Date().toISOString(),
          streakDays: 0
        }
      ],
      totalProgress: 0,
      rank: challenge.currentTeams + 1,
      badges: [],
      createdAt: new Date().toISOString(),
      isRecruiting: true
    };

    this.teams.set(team.id, team);
    challenge.currentTeams++;
    this.teamChallenges.set(challengeId, challenge);

    console.log(`[HIPAA-AUDIT] Team ${team.id} created for challenge ${challengeId} by ${patientId}`);
    return team;
  }

  async joinTeam(teamId: string, patientId: string, displayName: string): Promise<Team> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error("Team not found");

    const challenge = this.teamChallenges.get(team.challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (team.members.length >= challenge.teamSize) throw new Error("Team is full");
    if (!team.isRecruiting) throw new Error("Team is not recruiting");

    const existingMember = team.members.find(m => m.patientId === patientId);
    if (existingMember) throw new Error("Already a team member");

    team.members.push({
      patientId,
      displayName,
      avatarInitials: displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      role: 'member',
      contribution: 0,
      joinedAt: new Date().toISOString(),
      streakDays: 0
    });

    if (team.members.length >= challenge.teamSize) {
      team.isRecruiting = false;
    }

    this.teams.set(teamId, team);
    console.log(`[HIPAA-AUDIT] Patient ${patientId} joined team ${teamId}`);
    return team;
  }

  async logTeamProgress(teamId: string, patientId: string, value: number): Promise<Team> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error("Team not found");

    const member = team.members.find(m => m.patientId === patientId);
    if (!member) throw new Error("Not a team member");

    member.contribution += value;
    member.streakDays++;
    team.totalProgress = team.members.reduce((sum, m) => sum + m.contribution, 0);

    this.teams.set(teamId, team);
    this.recalculateRankings(team.challengeId);

    return team;
  }

  private recalculateRankings(challengeId: string) {
    const teams = Array.from(this.teams.values())
      .filter(t => t.challengeId === challengeId)
      .sort((a, b) => b.totalProgress - a.totalProgress);

    teams.forEach((team, index) => {
      team.rank = index + 1;
      this.teams.set(team.id, team);
    });
  }

  async getTeamLeaderboard(challengeId: string): Promise<TeamLeaderboard> {
    const teams = await this.getTeamsForChallenge(challengeId);

    const entries: TeamLeaderboardEntry[] = teams.map(team => {
      const topContributor = team.members.reduce((max, m) => 
        m.contribution > max.contribution ? m : max, team.members[0]);
      
      return {
        rank: team.rank,
        teamId: team.id,
        teamName: team.name,
        totalProgress: team.totalProgress,
        memberCount: team.members.length,
        topContributor: topContributor.displayName,
        badges: team.badges
      };
    });

    return {
      challengeId,
      updatedAt: new Date().toISOString(),
      teams: entries
    };
  }

  async getPatientTeams(patientId: string): Promise<Team[]> {
    return Array.from(this.teams.values())
      .filter(t => t.members.some(m => m.patientId === patientId));
  }

  async getDashboardSummary(patientId: string, journeyId: string): Promise<{
    sentimentTrend: { sentiment: string; score: number; trend: string };
    recentAdjustments: DynamicContentAdjustment[];
    communityActivity: { groups: number; posts: number; replies: number };
    teamChallenges: { active: number; totalProgress: number; rank: number | null };
    disclaimer: string;
  }> {
    const sentiments = Array.from(this.sentimentAnalyses.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const avgScore = sentiments.length > 0 
      ? sentiments.reduce((sum, s) => sum + s.sentimentScore, 0) / sentiments.length 
      : 0.5;

    const prevAvg = sentiments.length > 5
      ? sentiments.slice(5).reduce((sum, s) => sum + s.sentimentScore, 0) / 5
      : avgScore;

    const adjustments = Array.from(this.contentAdjustments.values())
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    const memberRecords = Array.from(this.communityMembers.values())
      .filter(m => m.patientId === patientId);

    const teams = await this.getPatientTeams(patientId);
    const activeTeams = teams.filter(t => {
      const challenge = this.teamChallenges.get(t.challengeId);
      return challenge?.status === 'active';
    });

    return {
      sentimentTrend: {
        sentiment: sentiments[0]?.sentiment || 'neutral',
        score: avgScore,
        trend: avgScore > prevAvg ? 'improving' : avgScore < prevAvg ? 'declining' : 'stable'
      },
      recentAdjustments: adjustments,
      communityActivity: {
        groups: memberRecords.length,
        posts: memberRecords.reduce((sum, m) => sum + m.totalPosts, 0),
        replies: memberRecords.reduce((sum, m) => sum + m.totalReplies, 0)
      },
      teamChallenges: {
        active: activeTeams.length,
        totalProgress: activeTeams.reduce((sum, t) => sum + t.totalProgress, 0),
        rank: activeTeams.length > 0 ? activeTeams[0].rank : null
      },
      disclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const enhancedHealthJourneyService = new EnhancedHealthJourneyService();
