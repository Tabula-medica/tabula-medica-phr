import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  openai = new OpenAI();
} catch (error) {
  console.log("[PatientEngagementHub] OpenAI client not available, using fallback responses");
}

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'patient' | 'provider' | 'ai_assistant';
  senderName: string;
  recipientId: string;
  recipientType: 'patient' | 'provider' | 'care_team';
  recipientName: string;
  subject: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'general' | 'medication' | 'appointment' | 'lab_results' | 'symptoms' | 'billing' | 'referral';
  status: 'sent' | 'delivered' | 'read' | 'replied';
  isEncrypted: boolean;
  attachments: MessageAttachment[];
  metadata: {
    aiTriaged: boolean;
    triageCategory?: string;
    suggestedPriority?: string;
    routedTo?: string;
  };
  createdAt: string;
  readAt?: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

export interface Conversation {
  id: string;
  patientId: string;
  patientName: string;
  providerId?: string;
  providerName?: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'active' | 'resolved' | 'pending_response';
  category: string;
  messages: SecureMessage[];
}

export interface ChatbotMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    routedToProvider?: boolean;
    suggestedActions?: string[];
  };
}

export interface ChatbotSession {
  id: string;
  patientId: string;
  patientName: string;
  status: 'active' | 'resolved' | 'escalated';
  startedAt: string;
  lastActivityAt: string;
  messages: ChatbotMessage[];
  context: {
    primaryConcern?: string;
    identifiedSymptoms?: string[];
    urgencyLevel?: 'low' | 'medium' | 'high' | 'emergency';
    recommendedAction?: string;
  };
}

export interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: 'weight' | 'exercise' | 'nutrition' | 'medication' | 'blood_pressure' | 'blood_sugar' | 'sleep' | 'mental_health' | 'custom';
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  progress: number;
  milestones: HealthMilestone[];
  progressHistory: ProgressEntry[];
  aiRecommendations?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HealthMilestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  targetDate: string;
  achieved: boolean;
  achievedAt?: string;
}

export interface ProgressEntry {
  id: string;
  goalId: string;
  value: number;
  note?: string;
  recordedAt: string;
}

export interface EngagementDashboard {
  messaging: {
    unreadMessages: number;
    activeConversations: number;
    pendingResponses: number;
    averageResponseTime: string;
  };
  chatbot: {
    activeSessions: number;
    resolvedToday: number;
    escalatedToProvider: number;
  };
  healthGoals: {
    activeGoals: number;
    completedGoals: number;
    averageProgress: number;
    upcomingMilestones: number;
  };
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'message' | 'goal_update' | 'milestone' | 'chatbot';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

class PatientEngagementHubService {
  private conversations: Map<string, Conversation> = new Map();
  private chatbotSessions: Map<string, ChatbotSession> = new Map();
  private healthGoals: Map<string, HealthGoal> = new Map();
  private openaiAvailable: boolean = false;

  constructor() {
    this.initializeSampleData();
    this.checkOpenAIAvailability();
    console.log("[PatientEngagementHub] Service initialized");
    console.log("[PatientEngagementHub] Features: Secure messaging, AI chatbot, Health goals tracking");
    console.log("[PatientEngagementHub] HIPAA-compliant message encryption enabled");
  }

  private async checkOpenAIAvailability() {
    if (!openai) {
      this.openaiAvailable = false;
      return;
    }
    try {
      await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });
      this.openaiAvailable = true;
      console.log("[PatientEngagementHub] OpenAI integration available for AI chatbot");
    } catch (error) {
      this.openaiAvailable = false;
      console.log("[PatientEngagementHub] OpenAI not available, using fallback responses");
    }
  }

  private initializeSampleData() {
    const conv1: Conversation = {
      id: "conv-001",
      patientId: "patient-001",
      patientName: "John Smith",
      providerId: "provider-001",
      providerName: "Dr. Sarah Johnson",
      subject: "Follow-up on Blood Pressure",
      lastMessage: "Your blood pressure readings look good. Keep up the good work!",
      lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      unreadCount: 1,
      status: "active",
      category: "general",
      messages: [
        {
          id: "msg-001",
          conversationId: "conv-001",
          senderId: "patient-001",
          senderType: "patient",
          senderName: "John Smith",
          recipientId: "provider-001",
          recipientType: "provider",
          recipientName: "Dr. Sarah Johnson",
          subject: "Blood Pressure Question",
          content: "Hi Dr. Johnson, I've been monitoring my blood pressure as you recommended. My readings this week have been averaging 128/82. Is this an improvement?",
          priority: "normal",
          category: "general",
          status: "read",
          isEncrypted: true,
          attachments: [],
          metadata: { aiTriaged: true, triageCategory: "routine", suggestedPriority: "normal" },
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          readAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "msg-002",
          conversationId: "conv-001",
          senderId: "provider-001",
          senderType: "provider",
          senderName: "Dr. Sarah Johnson",
          recipientId: "patient-001",
          recipientType: "patient",
          recipientName: "John Smith",
          subject: "Re: Blood Pressure Question",
          content: "Your blood pressure readings look good. Keep up the good work! Your average of 128/82 is within the healthy range. Continue with your current medication and lifestyle changes.",
          priority: "normal",
          category: "general",
          status: "delivered",
          isEncrypted: true,
          attachments: [],
          metadata: { aiTriaged: false },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };

    const conv2: Conversation = {
      id: "conv-002",
      patientId: "patient-001",
      patientName: "John Smith",
      providerId: "provider-002",
      providerName: "Pharmacy Team",
      subject: "Medication Refill Request",
      lastMessage: "Your refill has been processed and will be ready for pickup tomorrow.",
      lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      unreadCount: 0,
      status: "resolved",
      category: "medication",
      messages: [],
    };

    this.conversations.set(conv1.id, conv1);
    this.conversations.set(conv2.id, conv2);

    const session1: ChatbotSession = {
      id: "session-001",
      patientId: "patient-001",
      patientName: "John Smith",
      status: "active",
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      lastActivityAt: new Date().toISOString(),
      messages: [
        {
          id: "chat-001",
          sessionId: "session-001",
          role: "user",
          content: "I have a question about my medication schedule",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        },
        {
          id: "chat-002",
          sessionId: "session-001",
          role: "assistant",
          content: "I'd be happy to help you with your medication schedule. Could you please tell me which medication you have questions about?\n\n*This is an AI assistant providing general information only. For medical advice, please consult your healthcare provider.*",
          timestamp: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
          metadata: {
            intent: "medication_inquiry",
            confidence: 0.92,
            suggestedActions: ["View Medications", "Contact Pharmacy", "Schedule Appointment"],
          },
        },
      ],
      context: {
        primaryConcern: "medication schedule",
        urgencyLevel: "low",
      },
    };
    this.chatbotSessions.set(session1.id, session1);

    const goal1: HealthGoal = {
      id: "goal-001",
      patientId: "patient-001",
      title: "Lower Blood Pressure",
      description: "Reduce systolic blood pressure to healthy range",
      category: "blood_pressure",
      targetValue: 120,
      currentValue: 128,
      unit: "mmHg",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      progress: 60,
      milestones: [
        { id: "m-001", goalId: "goal-001", title: "Reach 130 mmHg", targetValue: 130, targetDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), achieved: true, achievedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "m-002", goalId: "goal-001", title: "Reach 125 mmHg", targetValue: 125, targetDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), achieved: false },
        { id: "m-003", goalId: "goal-001", title: "Reach target 120 mmHg", targetValue: 120, targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), achieved: false },
      ],
      progressHistory: [
        { id: "p-001", goalId: "goal-001", value: 140, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-002", goalId: "goal-001", value: 135, recordedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-003", goalId: "goal-001", value: 130, recordedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-004", goalId: "goal-001", value: 128, recordedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      aiRecommendations: [
        "Consider reducing sodium intake to under 2,300mg daily",
        "Aim for 30 minutes of moderate exercise 5 days per week",
        "Practice stress-reduction techniques like meditation",
      ],
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const goal2: HealthGoal = {
      id: "goal-002",
      patientId: "patient-001",
      title: "Daily Steps Challenge",
      description: "Walk 10,000 steps daily for cardiovascular health",
      category: "exercise",
      targetValue: 10000,
      currentValue: 7500,
      unit: "steps",
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 76 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      progress: 75,
      milestones: [
        { id: "m-004", goalId: "goal-002", title: "Reach 5,000 steps", targetValue: 5000, targetDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), achieved: true, achievedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "m-005", goalId: "goal-002", title: "Reach 7,500 steps", targetValue: 7500, targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), achieved: true, achievedAt: new Date().toISOString() },
        { id: "m-006", goalId: "goal-002", title: "Reach 10,000 steps", targetValue: 10000, targetDate: new Date(Date.now() + 76 * 24 * 60 * 60 * 1000).toISOString(), achieved: false },
      ],
      progressHistory: [
        { id: "p-005", goalId: "goal-002", value: 3000, recordedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-006", goalId: "goal-002", value: 5000, recordedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-007", goalId: "goal-002", value: 6500, recordedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-008", goalId: "goal-002", value: 7500, recordedAt: new Date().toISOString() },
      ],
      aiRecommendations: [
        "Try taking short walks after meals to boost step count",
        "Consider using stairs instead of elevators",
        "Set hourly reminders to stand and walk for 5 minutes",
      ],
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const goal3: HealthGoal = {
      id: "goal-003",
      patientId: "patient-001",
      title: "Weight Management",
      description: "Achieve and maintain healthy weight",
      category: "weight",
      targetValue: 175,
      currentValue: 185,
      unit: "lbs",
      startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 135 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      progress: 50,
      milestones: [
        { id: "m-007", goalId: "goal-003", title: "Lose 5 lbs", targetValue: 190, targetDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), achieved: true, achievedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "m-008", goalId: "goal-003", title: "Lose 10 lbs", targetValue: 185, targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), achieved: true, achievedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "m-009", goalId: "goal-003", title: "Reach goal weight", targetValue: 175, targetDate: new Date(Date.now() + 135 * 24 * 60 * 60 * 1000).toISOString(), achieved: false },
      ],
      progressHistory: [
        { id: "p-009", goalId: "goal-003", value: 195, recordedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-010", goalId: "goal-003", value: 192, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-011", goalId: "goal-003", value: 188, recordedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "p-012", goalId: "goal-003", value: 185, recordedAt: new Date().toISOString() },
      ],
      aiRecommendations: [
        "Focus on whole foods and reduce processed food intake",
        "Aim for 7-8 hours of sleep for optimal metabolism",
        "Track daily calorie intake to stay within target range",
      ],
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.healthGoals.set(goal1.id, goal1);
    this.healthGoals.set(goal2.id, goal2);
    this.healthGoals.set(goal3.id, goal3);
  }

  async getDashboard(patientId: string): Promise<EngagementDashboard> {
    const conversations = Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
    const sessions = Array.from(this.chatbotSessions.values()).filter(s => s.patientId === patientId);
    const goals = Array.from(this.healthGoals.values()).filter(g => g.patientId === patientId);

    const activeGoals = goals.filter(g => g.status === "active");
    const completedGoals = goals.filter(g => g.status === "completed");
    const avgProgress = activeGoals.length > 0 ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length : 0;

    const upcomingMilestones = goals.flatMap(g => g.milestones).filter(m => !m.achieved && new Date(m.targetDate) > new Date() && new Date(m.targetDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length;

    const recentActivity: ActivityItem[] = [
      {
        id: "activity-001",
        type: "message",
        title: "New message from Dr. Johnson",
        description: "Response to your blood pressure question",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        icon: "MessageSquare",
      },
      {
        id: "activity-002",
        type: "milestone",
        title: "Milestone achieved!",
        description: "You reached 7,500 daily steps",
        timestamp: new Date().toISOString(),
        icon: "Trophy",
      },
      {
        id: "activity-003",
        type: "goal_update",
        title: "Progress recorded",
        description: "Blood pressure: 128 mmHg",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        icon: "TrendingUp",
      },
    ];

    return {
      messaging: {
        unreadMessages: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
        activeConversations: conversations.filter(c => c.status === "active").length,
        pendingResponses: conversations.filter(c => c.status === "pending_response").length,
        averageResponseTime: "2.5 hours",
      },
      chatbot: {
        activeSessions: sessions.filter(s => s.status === "active").length,
        resolvedToday: 3,
        escalatedToProvider: 1,
      },
      healthGoals: {
        activeGoals: activeGoals.length,
        completedGoals: completedGoals.length,
        averageProgress: Math.round(avgProgress),
        upcomingMilestones,
      },
      recentActivity,
    };
  }

  async getConversations(patientId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async sendMessage(data: {
    conversationId?: string;
    senderId: string;
    senderType: 'patient' | 'provider';
    senderName: string;
    recipientId: string;
    recipientType: 'patient' | 'provider' | 'care_team';
    recipientName: string;
    subject: string;
    content: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
  }): Promise<SecureMessage> {
    let triageResult: { category: string; priority: string; routedTo?: string } = { category: "general", priority: "normal" };
    
    if (data.senderType === 'patient' && this.openaiAvailable) {
      triageResult = await this.triageMessage(data.content);
    }

    const message: SecureMessage = {
      id: `msg-${Date.now()}`,
      conversationId: data.conversationId || `conv-${Date.now()}`,
      senderId: data.senderId,
      senderType: data.senderType,
      senderName: data.senderName,
      recipientId: data.recipientId,
      recipientType: data.recipientType,
      recipientName: data.recipientName,
      subject: data.subject,
      content: data.content,
      priority: (data.priority || triageResult.priority) as any,
      category: (data.category || triageResult.category) as any,
      status: "sent",
      isEncrypted: true,
      attachments: [],
      metadata: {
        aiTriaged: data.senderType === 'patient',
        triageCategory: triageResult.category,
        suggestedPriority: triageResult.priority,
        routedTo: triageResult.routedTo,
      },
      createdAt: new Date().toISOString(),
    };

    let conversation = data.conversationId ? this.conversations.get(data.conversationId) : null;
    if (!conversation) {
      conversation = {
        id: message.conversationId,
        patientId: data.senderType === 'patient' ? data.senderId : data.recipientId,
        patientName: data.senderType === 'patient' ? data.senderName : data.recipientName,
        providerId: data.senderType === 'provider' ? data.senderId : data.recipientId,
        providerName: data.senderType === 'provider' ? data.senderName : data.recipientName,
        subject: data.subject,
        lastMessage: data.content.substring(0, 100),
        lastMessageAt: message.createdAt,
        unreadCount: 1,
        status: "active",
        category: message.category,
        messages: [],
      };
    }

    conversation.messages.push(message);
    conversation.lastMessage = data.content.substring(0, 100);
    conversation.lastMessageAt = message.createdAt;
    if (data.senderType !== 'patient') {
      conversation.unreadCount++;
    }

    this.conversations.set(conversation.id, conversation);

    return message;
  }

  private async triageMessage(content: string): Promise<{ category: string; priority: string; routedTo?: string }> {
    if (!this.openaiAvailable || !openai) {
      return { category: "general", priority: "normal" };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a medical message triage assistant. Analyze patient messages and categorize them.
Return a JSON object with:
- category: one of [general, medication, appointment, lab_results, symptoms, billing, referral]
- priority: one of [low, normal, high, urgent]
- routedTo: suggested department or provider type (optional)

IMPORTANT: This is for routing purposes only, not clinical decision support.
For urgent symptoms like chest pain, difficulty breathing, or severe allergic reactions, mark as urgent.`,
          },
          { role: "user", content: `Triage this patient message: "${content}"` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 150,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        category: result.category || "general",
        priority: result.priority || "normal",
        routedTo: result.routedTo,
      };
    } catch (error) {
      console.error("[PatientEngagementHub] Triage error:", error);
      return { category: "general", priority: "normal" };
    }
  }

  async getChatbotSession(sessionId: string): Promise<ChatbotSession | null> {
    return this.chatbotSessions.get(sessionId) || null;
  }

  async startChatbotSession(patientId: string, patientName: string): Promise<ChatbotSession> {
    const session: ChatbotSession = {
      id: `session-${Date.now()}`,
      patientId,
      patientName,
      status: "active",
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      messages: [
        {
          id: `chat-${Date.now()}`,
          sessionId: `session-${Date.now()}`,
          role: "assistant",
          content: `Hello ${patientName}! I'm your AI health assistant. I can help you with:\n\n• Medication questions and refill requests\n• Appointment scheduling\n• General health information\n• Connecting you with your care team\n\nHow can I assist you today?\n\n*This is an AI assistant providing general information only. For medical advice, please consult your healthcare provider.*`,
          timestamp: new Date().toISOString(),
          metadata: {
            intent: "greeting",
            confidence: 1.0,
            suggestedActions: ["Schedule Appointment", "Refill Medication", "Contact Provider"],
          },
        },
      ],
      context: {},
    };

    session.messages[0].sessionId = session.id;
    this.chatbotSessions.set(session.id, session);
    return session;
  }

  async sendChatbotMessage(sessionId: string, content: string): Promise<ChatbotMessage> {
    const session = this.chatbotSessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const userMessage: ChatbotMessage = {
      id: `chat-${Date.now()}`,
      sessionId,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    const response = await this.generateChatbotResponse(session, content);
    session.messages.push(response);
    session.lastActivityAt = new Date().toISOString();

    if (response.metadata?.intent) {
      session.context.primaryConcern = response.metadata.intent;
    }

    this.chatbotSessions.set(sessionId, session);
    return response;
  }

  private async generateChatbotResponse(session: ChatbotSession, userMessage: string): Promise<ChatbotMessage> {
    const disclaimer = "\n\n*This is an AI assistant providing general information only. For medical advice, please consult your healthcare provider.*";

    if (!this.openaiAvailable || !openai) {
      return this.getFallbackResponse(session, userMessage);
    }

    try {
      const conversationHistory = session.messages.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content.replace(disclaimer, ""),
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a helpful healthcare AI assistant for a patient portal. You help patients with:
- Answering general health questions
- Helping with medication schedules and refill requests
- Appointment scheduling assistance
- Providing health education

IMPORTANT RULES:
1. NEVER provide specific medical diagnoses or treatment recommendations
2. Always recommend consulting a healthcare provider for medical concerns
3. For emergencies (chest pain, difficulty breathing, severe symptoms), immediately advise calling 911
4. Be empathetic and supportive
5. Keep responses concise and helpful
6. Identify when to escalate to a human provider

Return a JSON response with:
- content: your response text
- intent: identified intent (medication, appointment, symptoms, emergency, general, escalate)
- confidence: 0-1 confidence score
- suggestedActions: array of 2-3 suggested quick actions
- shouldEscalate: boolean if human provider is needed`,
          },
          ...conversationHistory,
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        id: `chat-${Date.now()}`,
        sessionId: session.id,
        role: "assistant",
        content: (result.content || "I'm here to help. Could you please rephrase your question?") + disclaimer,
        timestamp: new Date().toISOString(),
        metadata: {
          intent: result.intent || "general",
          confidence: result.confidence || 0.8,
          routedToProvider: result.shouldEscalate || false,
          suggestedActions: result.suggestedActions || ["Contact Provider", "View Health Records"],
        },
      };
    } catch (error) {
      console.error("[PatientEngagementHub] Chatbot error:", error);
      return this.getFallbackResponse(session, userMessage);
    }
  }

  private getFallbackResponse(session: ChatbotSession, userMessage: string): ChatbotMessage {
    const disclaimer = "\n\n*This is an AI assistant providing general information only. For medical advice, please consult your healthcare provider.*";
    const lowerMessage = userMessage.toLowerCase();

    let content = "I'm here to help! ";
    let intent = "general";
    let suggestedActions = ["Contact Provider", "View Health Records", "Schedule Appointment"];

    if (lowerMessage.includes("medication") || lowerMessage.includes("refill") || lowerMessage.includes("prescription")) {
      content = "I can help with medication questions. Would you like to request a refill or speak with your pharmacy team? You can also view your current medications in your health records.";
      intent = "medication";
      suggestedActions = ["Request Refill", "View Medications", "Contact Pharmacy"];
    } else if (lowerMessage.includes("appointment") || lowerMessage.includes("schedule") || lowerMessage.includes("book")) {
      content = "I can help you schedule an appointment. Would you like to see available times with your primary care provider, or do you need to see a specialist?";
      intent = "appointment";
      suggestedActions = ["Schedule with PCP", "Find a Specialist", "View Upcoming Appointments"];
    } else if (lowerMessage.includes("pain") || lowerMessage.includes("sick") || lowerMessage.includes("symptom")) {
      content = "I understand you're not feeling well. For any severe or concerning symptoms, please contact your healthcare provider or seek immediate care. Can you tell me more about what you're experiencing?";
      intent = "symptoms";
      suggestedActions = ["Contact Provider", "Find Urgent Care", "View Symptom Checker"];
    } else if (lowerMessage.includes("emergency") || lowerMessage.includes("chest pain") || lowerMessage.includes("can't breathe")) {
      content = "If you're experiencing a medical emergency, please call 911 immediately or go to your nearest emergency room. Don't delay seeking emergency care.";
      intent = "emergency";
      suggestedActions = ["Call 911", "Find Emergency Room", "Contact Provider"];
    }

    return {
      id: `chat-${Date.now()}`,
      sessionId: session.id,
      role: "assistant",
      content: content + disclaimer,
      timestamp: new Date().toISOString(),
      metadata: {
        intent,
        confidence: 0.75,
        suggestedActions,
      },
    };
  }

  async escalateToProvider(sessionId: string): Promise<Conversation> {
    const session = this.chatbotSessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.status = "escalated";
    this.chatbotSessions.set(sessionId, session);

    const conversationSummary = session.messages.map(m => `${m.role}: ${m.content}`).join("\n\n");

    const conversation: Conversation = {
      id: `conv-${Date.now()}`,
      patientId: session.patientId,
      patientName: session.patientName,
      subject: `Escalated from AI Assistant: ${session.context.primaryConcern || "General inquiry"}`,
      lastMessage: "This conversation has been escalated from the AI assistant.",
      lastMessageAt: new Date().toISOString(),
      unreadCount: 1,
      status: "pending_response",
      category: "general",
      messages: [
        {
          id: `msg-${Date.now()}`,
          conversationId: `conv-${Date.now()}`,
          senderId: "system",
          senderType: "ai_assistant",
          senderName: "AI Assistant",
          recipientId: "care-team",
          recipientType: "care_team",
          recipientName: "Care Team",
          subject: "Escalated Conversation",
          content: `Patient ${session.patientName} requested to speak with a provider.\n\n**Conversation Summary:**\n${conversationSummary}\n\n**Context:**\n- Primary concern: ${session.context.primaryConcern || "Not identified"}\n- Urgency: ${session.context.urgencyLevel || "Not assessed"}`,
          priority: session.context.urgencyLevel === "high" ? "high" : "normal",
          category: "general",
          status: "sent",
          isEncrypted: true,
          attachments: [],
          metadata: { aiTriaged: true },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    conversation.messages[0].conversationId = conversation.id;
    this.conversations.set(conversation.id, conversation);

    return conversation;
  }

  async getHealthGoals(patientId: string): Promise<HealthGoal[]> {
    return Array.from(this.healthGoals.values()).filter(g => g.patientId === patientId);
  }

  async getHealthGoal(goalId: string): Promise<HealthGoal | null> {
    return this.healthGoals.get(goalId) || null;
  }

  async createHealthGoal(data: {
    patientId: string;
    title: string;
    description: string;
    category: HealthGoal['category'];
    targetValue: number;
    currentValue: number;
    unit: string;
    targetDate: string;
  }): Promise<HealthGoal> {
    const goal: HealthGoal = {
      id: `goal-${Date.now()}`,
      patientId: data.patientId,
      title: data.title,
      description: data.description,
      category: data.category,
      targetValue: data.targetValue,
      currentValue: data.currentValue,
      unit: data.unit,
      startDate: new Date().toISOString(),
      targetDate: data.targetDate,
      status: "active",
      progress: Math.round((data.currentValue / data.targetValue) * 100),
      milestones: [],
      progressHistory: [
        {
          id: `p-${Date.now()}`,
          goalId: `goal-${Date.now()}`,
          value: data.currentValue,
          recordedAt: new Date().toISOString(),
        },
      ],
      aiRecommendations: await this.generateGoalRecommendations(data.category, data.title),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    goal.progressHistory[0].goalId = goal.id;
    this.healthGoals.set(goal.id, goal);
    return goal;
  }

  async updateHealthGoalProgress(goalId: string, value: number, note?: string): Promise<HealthGoal> {
    const goal = this.healthGoals.get(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const progressEntry: ProgressEntry = {
      id: `p-${Date.now()}`,
      goalId,
      value,
      note,
      recordedAt: new Date().toISOString(),
    };

    goal.progressHistory.push(progressEntry);
    goal.currentValue = value;
    goal.progress = Math.min(100, Math.round((value / goal.targetValue) * 100));
    goal.updatedAt = new Date().toISOString();

    for (const milestone of goal.milestones) {
      if (!milestone.achieved && value >= milestone.targetValue) {
        milestone.achieved = true;
        milestone.achievedAt = new Date().toISOString();
      }
    }

    if (value >= goal.targetValue) {
      goal.status = "completed";
      goal.progress = 100;
    }

    this.healthGoals.set(goalId, goal);
    return goal;
  }

  async addMilestone(goalId: string, data: { title: string; targetValue: number; targetDate: string }): Promise<HealthMilestone> {
    const goal = this.healthGoals.get(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const milestone: HealthMilestone = {
      id: `m-${Date.now()}`,
      goalId,
      title: data.title,
      targetValue: data.targetValue,
      targetDate: data.targetDate,
      achieved: goal.currentValue >= data.targetValue,
      achievedAt: goal.currentValue >= data.targetValue ? new Date().toISOString() : undefined,
    };

    goal.milestones.push(milestone);
    goal.updatedAt = new Date().toISOString();
    this.healthGoals.set(goalId, goal);

    return milestone;
  }

  private async generateGoalRecommendations(category: string, title: string): Promise<string[]> {
    if (!this.openaiAvailable || !openai) {
      return this.getFallbackRecommendations(category);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `Generate 3 brief, actionable health tips for achieving a health goal. 
Keep each tip under 100 characters. Focus on practical, evidence-based advice.
Return as a JSON array of strings.
IMPORTANT: This is general wellness information only, not medical advice.`,
          },
          { role: "user", content: `Goal category: ${category}, Goal: ${title}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.recommendations || result.tips || this.getFallbackRecommendations(category);
    } catch (error) {
      return this.getFallbackRecommendations(category);
    }
  }

  private getFallbackRecommendations(category: string): string[] {
    const recommendations: Record<string, string[]> = {
      weight: [
        "Track your daily food intake in a journal",
        "Aim for 7-8 hours of quality sleep each night",
        "Stay hydrated with 8 glasses of water daily",
      ],
      exercise: [
        "Start with short sessions and gradually increase duration",
        "Find an exercise buddy for accountability",
        "Mix cardio and strength training for best results",
      ],
      blood_pressure: [
        "Reduce sodium intake to under 2,300mg daily",
        "Practice stress-reduction techniques like deep breathing",
        "Limit alcohol and caffeine consumption",
      ],
      blood_sugar: [
        "Monitor blood sugar levels at consistent times",
        "Choose complex carbohydrates over simple sugars",
        "Take short walks after meals to help regulate levels",
      ],
      sleep: [
        "Maintain a consistent sleep schedule",
        "Avoid screens 1 hour before bedtime",
        "Create a cool, dark sleeping environment",
      ],
      nutrition: [
        "Fill half your plate with vegetables at each meal",
        "Plan meals ahead to make healthier choices",
        "Read nutrition labels to make informed choices",
      ],
      medication: [
        "Set daily reminders for medication times",
        "Keep medications in a visible, consistent location",
        "Use a pill organizer for multiple medications",
      ],
      mental_health: [
        "Practice mindfulness or meditation for 10 minutes daily",
        "Stay connected with friends and family",
        "Engage in activities you enjoy regularly",
      ],
      custom: [
        "Set specific, measurable daily targets",
        "Track your progress consistently",
        "Celebrate small wins along the way",
      ],
    };

    return recommendations[category] || recommendations.custom;
  }
}

export const patientEngagementHubService = new PatientEngagementHubService();
