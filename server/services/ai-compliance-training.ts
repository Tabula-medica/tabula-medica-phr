import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b\d{9}\b/g, "[SSN-REDACTED]")
    .replace(/\b[A-Z]{1,2}\d{6,10}\b/gi, "[MRN-REDACTED]")
    .replace(/\b(patient|pt)\s*#?\s*\d+/gi, "[PATIENT-ID-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE-REDACTED]");
}

const NO_CDS_TRAINING_PROMPT = `You are a healthcare compliance training specialist.
Your role is to create educational content about data handling, privacy regulations, and security best practices.

STRICT GUIDELINES:
- NEVER provide clinical advice, diagnoses, or treatment recommendations
- NEVER interpret medical test results or patient health conditions
- Focus ONLY on compliance training, data handling, and security practices
- Create educational content about HIPAA, GDPR, SOC2, and other regulations
- Generate exercises about proper data access, privacy protection, and security protocols
- Provide feedback on compliance knowledge, NOT clinical knowledge

Your output should be:
- Clear, educational training content
- Interactive exercise questions and scenarios
- Constructive feedback on compliance understanding
- Best practices for data handling and privacy`;

export type TrainingCategory = 
  | "data_access"
  | "phi_handling"
  | "encryption"
  | "authentication"
  | "policy_compliance"
  | "incident_response"
  | "consent_management"
  | "audit_logging";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export interface UserWeakness {
  category: TrainingCategory;
  severity: "low" | "medium" | "high";
  description: string;
  violationCount: number;
  lastOccurrence: Date;
  source: "access_pattern" | "policy_violation" | "remediation" | "audit_log";
  recommendedTraining: string[];
}

export interface TrainingModule {
  id: string;
  title: string;
  category: TrainingCategory;
  difficulty: DifficultyLevel;
  description: string;
  objectives: string[];
  content: TrainingContent[];
  exercises: TrainingExercise[];
  estimatedDurationMinutes: number;
  prerequisites: string[];
  createdAt: Date;
  aiGenerated: boolean;
}

export interface TrainingContent {
  id: string;
  type: "text" | "scenario" | "example" | "best_practice" | "warning";
  title: string;
  body: string;
  keyPoints: string[];
}

export interface TrainingExercise {
  id: string;
  type: "multiple_choice" | "scenario_analysis" | "true_false" | "fill_blank" | "matching";
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: DifficultyLevel;
  category: TrainingCategory;
  points: number;
}

export interface ExerciseAttempt {
  id: string;
  moduleId: string;
  exerciseId: string;
  userId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  feedback: string;
  attemptedAt: Date;
  timeSpentSeconds: number;
}

export interface UserProgress {
  userId: string;
  moduleId: string;
  status: "not_started" | "in_progress" | "completed";
  completedContentIds: string[];
  exerciseAttempts: ExerciseAttempt[];
  score: number;
  maxScore: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastAccessedAt: Date;
}

export interface UserTrainingProfile {
  userId: string;
  weaknesses: UserWeakness[];
  recommendedModules: string[];
  completedModules: string[];
  inProgressModules: string[];
  overallScore: number;
  strengthAreas: TrainingCategory[];
  improvementAreas: TrainingCategory[];
  learningPath: LearningPathItem[];
  lastAnalyzedAt: Date;
}

export interface LearningPathItem {
  moduleId: string;
  order: number;
  priority: "required" | "recommended" | "optional";
  reason: string;
  dueDate?: Date;
}

export interface RealTimeFeedback {
  id: string;
  userId: string;
  exerciseId: string;
  feedbackType: "correct" | "incorrect" | "partial" | "hint";
  message: string;
  improvementSuggestions: string[];
  relatedContent: string[];
  encouragement: string;
  generatedAt: Date;
}

export interface TrainingAnalytics {
  userId: string;
  totalModulesCompleted: number;
  totalExercisesAttempted: number;
  overallAccuracy: number;
  averageTimePerModule: number;
  categoryPerformance: Record<TrainingCategory, { accuracy: number; completed: number }>;
  recentActivity: { date: Date; action: string; details: string }[];
  improvementTrend: "improving" | "stable" | "declining";
  nextRecommendation: string;
}

class AIComplianceTrainingService {
  private modules: Map<string, TrainingModule> = new Map();
  private userProgress: Map<string, Map<string, UserProgress>> = new Map();
  private userProfiles: Map<string, UserTrainingProfile> = new Map();
  private exerciseAttempts: ExerciseAttempt[] = [];

  constructor() {
    this.initializeDefaultModules();
    console.log("[AIComplianceTraining] Service initialized");
  }

  private initializeDefaultModules(): void {
    const defaultModules: TrainingModule[] = [
      {
        id: "mod-phi-basics",
        title: "PHI Handling Fundamentals",
        category: "phi_handling",
        difficulty: "beginner",
        description: "Learn the basics of Protected Health Information (PHI) and how to handle it securely",
        objectives: [
          "Identify what constitutes PHI",
          "Understand minimum necessary access principles",
          "Apply proper PHI handling procedures"
        ],
        content: [
          {
            id: "content-1",
            type: "text",
            title: "What is PHI?",
            body: "Protected Health Information (PHI) includes any information that can identify a patient and relates to their health condition, healthcare provision, or payment for healthcare. This includes names, dates, contact information, medical record numbers, and more.",
            keyPoints: ["PHI has 18 identifiers defined by HIPAA", "Both electronic and paper records are covered", "PHI requires special handling and protection"]
          },
          {
            id: "content-2",
            type: "best_practice",
            title: "Minimum Necessary Access",
            body: "Only access the minimum amount of PHI necessary to perform your job duties. Ask yourself: Do I need this information to complete my task?",
            keyPoints: ["Access only what you need", "Don't browse patient records out of curiosity", "Document your access purpose"]
          }
        ],
        exercises: [
          {
            id: "ex-1",
            type: "multiple_choice",
            question: "Which of the following is NOT considered PHI under HIPAA?",
            options: ["Patient's full name", "Medical record number", "De-identified aggregate statistics", "Social Security Number"],
            correctAnswer: "De-identified aggregate statistics",
            explanation: "De-identified data that has been stripped of all 18 HIPAA identifiers is not considered PHI.",
            difficulty: "beginner",
            category: "phi_handling",
            points: 10
          },
          {
            id: "ex-2",
            type: "true_false",
            question: "It is acceptable to access a patient's record to check on a family member's health status.",
            options: ["True", "False"],
            correctAnswer: "False",
            explanation: "Accessing patient records without a legitimate work purpose, even for family members, is a HIPAA violation.",
            difficulty: "beginner",
            category: "phi_handling",
            points: 10
          }
        ],
        estimatedDurationMinutes: 30,
        prerequisites: [],
        createdAt: new Date(),
        aiGenerated: false
      },
      {
        id: "mod-access-control",
        title: "Data Access Control Best Practices",
        category: "data_access",
        difficulty: "intermediate",
        description: "Master proper data access protocols and understand role-based access control",
        objectives: [
          "Understand role-based access control (RBAC)",
          "Implement proper access request procedures",
          "Recognize and report unauthorized access attempts"
        ],
        content: [
          {
            id: "content-3",
            type: "text",
            title: "Role-Based Access Control",
            body: "RBAC ensures that users can only access data necessary for their specific role. Access rights are assigned based on job function, not individual identity.",
            keyPoints: ["Roles define access permissions", "Users inherit permissions from roles", "Regular access reviews are required"]
          },
          {
            id: "content-4",
            type: "scenario",
            title: "Access Request Scenario",
            body: "A colleague asks you to look up a patient's medication list because they forgot their login credentials. What should you do?",
            keyPoints: ["Never share credentials", "Follow proper access request procedures", "Report suspicious requests"]
          }
        ],
        exercises: [
          {
            id: "ex-3",
            type: "scenario_analysis",
            question: "You receive an urgent email from IT asking you to verify your password by clicking a link. What is the appropriate response?",
            options: [
              "Click the link immediately to avoid account lockout",
              "Report the email as a potential phishing attempt and contact IT directly",
              "Reply with your password to verify your identity",
              "Forward the email to colleagues to warn them"
            ],
            correctAnswer: "Report the email as a potential phishing attempt and contact IT directly",
            explanation: "Legitimate IT departments never ask for passwords via email. This is a classic phishing attempt that should be reported.",
            difficulty: "intermediate",
            category: "data_access",
            points: 15
          }
        ],
        estimatedDurationMinutes: 45,
        prerequisites: ["mod-phi-basics"],
        createdAt: new Date(),
        aiGenerated: false
      },
      {
        id: "mod-encryption",
        title: "Encryption and Data Protection",
        category: "encryption",
        difficulty: "intermediate",
        description: "Understand encryption requirements and data protection mechanisms",
        objectives: [
          "Understand encryption at rest and in transit",
          "Recognize secure vs insecure data transmission",
          "Apply encryption best practices"
        ],
        content: [
          {
            id: "content-5",
            type: "text",
            title: "Encryption Fundamentals",
            body: "Encryption transforms readable data into an unreadable format that can only be decoded with the proper key. HIPAA requires encryption for PHI both at rest and in transit.",
            keyPoints: ["AES-256 is the healthcare standard", "TLS 1.2+ for data in transit", "Encryption keys must be securely managed"]
          }
        ],
        exercises: [
          {
            id: "ex-4",
            type: "multiple_choice",
            question: "Which encryption standard is recommended for protecting PHI at rest?",
            options: ["DES", "MD5", "AES-256", "Base64"],
            correctAnswer: "AES-256",
            explanation: "AES-256 is the industry standard for encrypting PHI at rest, providing strong protection against unauthorized access.",
            difficulty: "intermediate",
            category: "encryption",
            points: 15
          }
        ],
        estimatedDurationMinutes: 40,
        prerequisites: [],
        createdAt: new Date(),
        aiGenerated: false
      },
      {
        id: "mod-incident-response",
        title: "Security Incident Response",
        category: "incident_response",
        difficulty: "advanced",
        description: "Learn how to identify, report, and respond to security incidents",
        objectives: [
          "Recognize potential security incidents",
          "Follow proper incident reporting procedures",
          "Understand breach notification requirements"
        ],
        content: [
          {
            id: "content-6",
            type: "text",
            title: "Identifying Security Incidents",
            body: "A security incident is any event that compromises the confidentiality, integrity, or availability of information systems or data. Early detection is critical for minimizing damage.",
            keyPoints: ["Report suspicious activity immediately", "Document everything you observe", "Don't attempt to investigate alone"]
          },
          {
            id: "content-7",
            type: "warning",
            title: "Breach Notification Requirements",
            body: "HIPAA requires notification of affected individuals within 60 days of discovering a breach affecting 500+ individuals. Breaches must also be reported to HHS and potentially the media.",
            keyPoints: ["60-day notification deadline", "Annual reporting to HHS required", "State laws may have additional requirements"]
          }
        ],
        exercises: [
          {
            id: "ex-5",
            type: "scenario_analysis",
            question: "You discover that a laptop containing unencrypted patient data was stolen from a staff member's car. What is your first action?",
            options: [
              "Wait to see if the laptop is recovered",
              "Immediately report the incident to your supervisor and security team",
              "Post about the theft on social media to help find it",
              "Email all affected patients directly"
            ],
            correctAnswer: "Immediately report the incident to your supervisor and security team",
            explanation: "Immediate reporting is essential for initiating the incident response process and meeting regulatory timelines.",
            difficulty: "advanced",
            category: "incident_response",
            points: 20
          }
        ],
        estimatedDurationMinutes: 60,
        prerequisites: ["mod-phi-basics", "mod-access-control"],
        createdAt: new Date(),
        aiGenerated: false
      }
    ];

    defaultModules.forEach(mod => this.modules.set(mod.id, mod));
    console.log(`[AIComplianceTraining] Initialized ${defaultModules.length} default training modules`);
  }

  async analyzeUserWeaknesses(userId: string): Promise<UserWeakness[]> {
    const weaknesses: UserWeakness[] = [];
    
    const accessPatterns = this.simulateAccessPatternAnalysis(userId);
    const policyViolations = this.simulatePolicyViolationAnalysis(userId);
    
    accessPatterns.forEach(pattern => {
      if (pattern.anomalyScore > 0.5) {
        weaknesses.push({
          category: pattern.category as TrainingCategory,
          severity: pattern.anomalyScore > 0.8 ? "high" : pattern.anomalyScore > 0.6 ? "medium" : "low",
          description: pattern.description,
          violationCount: pattern.count,
          lastOccurrence: pattern.lastOccurred,
          source: "access_pattern",
          recommendedTraining: this.getRecommendedModules(pattern.category as TrainingCategory)
        });
      }
    });

    policyViolations.forEach(violation => {
      weaknesses.push({
        category: violation.category as TrainingCategory,
        severity: violation.severity,
        description: violation.description,
        violationCount: violation.count,
        lastOccurrence: violation.lastOccurred,
        source: "policy_violation",
        recommendedTraining: this.getRecommendedModules(violation.category as TrainingCategory)
      });
    });

    return weaknesses.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private simulateAccessPatternAnalysis(userId: string): Array<{
    category: string;
    anomalyScore: number;
    description: string;
    count: number;
    lastOccurred: Date;
  }> {
    return [
      {
        category: "data_access",
        anomalyScore: 0.65,
        description: "Accessed patient records outside normal working hours",
        count: 3,
        lastOccurred: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        category: "phi_handling",
        anomalyScore: 0.72,
        description: "Bulk export of patient data detected",
        count: 1,
        lastOccurred: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  private simulatePolicyViolationAnalysis(userId: string): Array<{
    category: string;
    severity: "low" | "medium" | "high";
    description: string;
    count: number;
    lastOccurred: Date;
  }> {
    return [
      {
        category: "authentication",
        severity: "medium",
        description: "Multiple failed login attempts followed by successful login",
        count: 5,
        lastOccurred: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        category: "encryption",
        severity: "low",
        description: "Attempted to send PHI via unencrypted channel (blocked)",
        count: 1,
        lastOccurred: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  private getRecommendedModules(category: TrainingCategory): string[] {
    const modulesByCategory: Record<TrainingCategory, string[]> = {
      data_access: ["mod-access-control", "mod-phi-basics"],
      phi_handling: ["mod-phi-basics", "mod-encryption"],
      encryption: ["mod-encryption"],
      authentication: ["mod-access-control"],
      policy_compliance: ["mod-phi-basics", "mod-access-control"],
      incident_response: ["mod-incident-response"],
      consent_management: ["mod-phi-basics"],
      audit_logging: ["mod-access-control"]
    };
    return modulesByCategory[category] || [];
  }

  async generatePersonalizedModule(
    userId: string,
    weakness: UserWeakness
  ): Promise<TrainingModule> {
    const moduleId = `mod-personalized-${userId}-${Date.now()}`;
    
    const content = await this.generateAIContent(weakness);
    const exercises = await this.generateAIExercises(weakness);

    const module: TrainingModule = {
      id: moduleId,
      title: `${weakness.category.replace(/_/g, " ")} Training - Personalized`,
      category: weakness.category,
      difficulty: weakness.severity === "high" ? "advanced" : weakness.severity === "medium" ? "intermediate" : "beginner",
      description: `Personalized training module addressing ${weakness.description}`,
      objectives: [
        `Understand proper procedures for ${weakness.category.replace(/_/g, " ")}`,
        "Recognize and avoid common compliance mistakes",
        "Apply best practices in real-world scenarios"
      ],
      content,
      exercises,
      estimatedDurationMinutes: 20,
      prerequisites: [],
      createdAt: new Date(),
      aiGenerated: true
    };

    this.modules.set(moduleId, module);
    return module;
  }

  private async generateAIContent(weakness: UserWeakness): Promise<TrainingContent[]> {
    if (!aiEnabled) {
      return this.generateFallbackContent(weakness);
    }

    try {
      const contentText = (await generatePhiSafeText({
        system: NO_CDS_TRAINING_PROMPT,
        user: `Generate educational training content for a healthcare compliance module.

Topic: ${sanitizePhi(weakness.category.replace(/_/g, " "))}
Issue: ${sanitizePhi(weakness.description)}
Severity: ${weakness.severity}

Create 2-3 training content sections with:
1. Title for each section
2. Educational body text (2-3 paragraphs)
3. 3 key takeaway points

Format as JSON array with objects containing: type, title, body, keyPoints
Types can be: text, scenario, example, best_practice, warning`,
        maxTokens: 1000,
        temperature: 0.7
      })) || "";
      try {
        const jsonMatch = contentText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.map((item: any, index: number) => ({
            id: `content-ai-${index}`,
            type: item.type || "text",
            title: item.title,
            body: item.body,
            keyPoints: item.keyPoints || []
          }));
        }
      } catch (e) {
        console.error("[AIComplianceTraining] Failed to parse AI content:", e);
      }
      return this.generateFallbackContent(weakness);
    } catch (error) {
      console.error("[AIComplianceTraining] AI content generation error:", error);
      return this.generateFallbackContent(weakness);
    }
  }

  private generateFallbackContent(weakness: UserWeakness): TrainingContent[] {
    const categoryContent: Record<TrainingCategory, TrainingContent[]> = {
      data_access: [
        {
          id: "fallback-1",
          type: "text",
          title: "Proper Data Access Procedures",
          body: "Accessing patient data requires proper authorization and a legitimate business purpose. Always ensure you have the appropriate permissions before accessing any patient information.",
          keyPoints: ["Verify your access permissions", "Document your access purpose", "Access only what you need"]
        }
      ],
      phi_handling: [
        {
          id: "fallback-2",
          type: "best_practice",
          title: "Safe PHI Handling",
          body: "Protected Health Information must be handled with care at all times. Never share PHI through unsecured channels and always use approved methods for data transmission.",
          keyPoints: ["Use encrypted channels only", "Verify recipient identity", "Log all PHI transfers"]
        }
      ],
      encryption: [
        {
          id: "fallback-3",
          type: "text",
          title: "Encryption Requirements",
          body: "All PHI must be encrypted both at rest and in transit. Use approved encryption tools and never disable encryption features.",
          keyPoints: ["AES-256 for data at rest", "TLS 1.2+ for data in transit", "Never bypass encryption"]
        }
      ],
      authentication: [
        {
          id: "fallback-4",
          type: "warning",
          title: "Authentication Security",
          body: "Strong authentication practices protect patient data from unauthorized access. Use complex passwords, enable MFA, and never share your credentials.",
          keyPoints: ["Use strong unique passwords", "Enable multi-factor authentication", "Report suspicious login activity"]
        }
      ],
      policy_compliance: [
        {
          id: "fallback-5",
          type: "text",
          title: "Policy Compliance Overview",
          body: "Compliance with organizational policies is mandatory. Familiarize yourself with all applicable policies and procedures.",
          keyPoints: ["Review policies regularly", "Ask questions if unclear", "Report policy violations"]
        }
      ],
      incident_response: [
        {
          id: "fallback-6",
          type: "scenario",
          title: "Incident Response Steps",
          body: "When a security incident occurs, immediate and proper response is critical. Follow the incident response plan and report incidents promptly.",
          keyPoints: ["Report immediately", "Document everything", "Follow the response plan"]
        }
      ],
      consent_management: [
        {
          id: "fallback-7",
          type: "text",
          title: "Patient Consent Requirements",
          body: "Patient consent must be obtained before sharing their health information. Understand consent requirements and verify consent status before disclosures.",
          keyPoints: ["Verify consent before sharing", "Document consent properly", "Respect patient preferences"]
        }
      ],
      audit_logging: [
        {
          id: "fallback-8",
          type: "text",
          title: "Audit Log Requirements",
          body: "All access to patient data is logged for compliance and security purposes. Be aware that your activities are monitored and audited.",
          keyPoints: ["All access is logged", "Logs are retained per regulations", "Anomalies trigger reviews"]
        }
      ]
    };

    return categoryContent[weakness.category] || categoryContent.data_access;
  }

  private async generateAIExercises(weakness: UserWeakness): Promise<TrainingExercise[]> {
    if (!aiEnabled) {
      return this.generateFallbackExercises(weakness);
    }

    try {
      const exerciseText = (await generatePhiSafeText({
        system: NO_CDS_TRAINING_PROMPT,
        user: `Generate 3 training exercises for healthcare compliance.

Topic: ${sanitizePhi(weakness.category.replace(/_/g, " "))}
Focus Area: ${sanitizePhi(weakness.description)}
Difficulty: ${weakness.severity === "high" ? "advanced" : weakness.severity === "medium" ? "intermediate" : "beginner"}

Create exercises with:
1. A clear question about compliance best practices
2. 4 answer options for multiple choice
3. The correct answer
4. An explanation of why the answer is correct

Format as JSON array with: type (multiple_choice), question, options (array), correctAnswer, explanation`,
        maxTokens: 800,
        temperature: 0.7
      })) || "";
      try {
        const jsonMatch = exerciseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.map((item: any, index: number) => ({
            id: `ex-ai-${index}`,
            type: item.type || "multiple_choice",
            question: item.question,
            options: item.options,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            difficulty: weakness.severity === "high" ? "advanced" : weakness.severity === "medium" ? "intermediate" : "beginner",
            category: weakness.category,
            points: weakness.severity === "high" ? 20 : weakness.severity === "medium" ? 15 : 10
          }));
        }
      } catch (e) {
        console.error("[AIComplianceTraining] Failed to parse AI exercises:", e);
      }
      return this.generateFallbackExercises(weakness);
    } catch (error) {
      console.error("[AIComplianceTraining] AI exercise generation error:", error);
      return this.generateFallbackExercises(weakness);
    }
  }

  private generateFallbackExercises(weakness: UserWeakness): TrainingExercise[] {
    return [
      {
        id: `ex-fallback-${weakness.category}-1`,
        type: "multiple_choice",
        question: `What is the most important principle when handling ${weakness.category.replace(/_/g, " ")}?`,
        options: [
          "Speed and efficiency",
          "Minimum necessary access and security",
          "Convenience for users",
          "Cost reduction"
        ],
        correctAnswer: "Minimum necessary access and security",
        explanation: "Security and minimum necessary access are fundamental principles in healthcare compliance.",
        difficulty: weakness.severity === "high" ? "advanced" : "intermediate",
        category: weakness.category,
        points: 15
      },
      {
        id: `ex-fallback-${weakness.category}-2`,
        type: "true_false",
        question: `It is acceptable to bypass security protocols in emergency situations without documentation.`,
        options: ["True", "False"],
        correctAnswer: "False",
        explanation: "Even in emergencies, proper documentation and protocols must be followed to maintain compliance.",
        difficulty: "beginner",
        category: weakness.category,
        points: 10
      }
    ];
  }

  async submitExerciseAnswer(
    userId: string,
    moduleId: string,
    exerciseId: string,
    userAnswer: string | string[],
    timeSpentSeconds: number
  ): Promise<RealTimeFeedback> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    const exercise = module.exercises.find(e => e.id === exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    const isCorrect = this.checkAnswer(exercise, userAnswer);
    const feedback = await this.generateFeedback(userId, exercise, userAnswer, isCorrect);

    const attempt: ExerciseAttempt = {
      id: `attempt-${Date.now()}`,
      moduleId,
      exerciseId,
      userId,
      userAnswer,
      isCorrect,
      feedback: feedback.message,
      attemptedAt: new Date(),
      timeSpentSeconds
    };

    this.exerciseAttempts.push(attempt);
    this.updateUserProgress(userId, moduleId, exerciseId, isCorrect, exercise.points);

    return feedback;
  }

  private checkAnswer(exercise: TrainingExercise, userAnswer: string | string[]): boolean {
    if (Array.isArray(exercise.correctAnswer)) {
      if (Array.isArray(userAnswer)) {
        return exercise.correctAnswer.every(a => userAnswer.includes(a)) &&
               userAnswer.every(a => exercise.correctAnswer.includes(a));
      }
      return false;
    }
    return String(userAnswer).toLowerCase().trim() === String(exercise.correctAnswer).toLowerCase().trim();
  }

  private async generateFeedback(
    userId: string,
    exercise: TrainingExercise,
    userAnswer: string | string[],
    isCorrect: boolean
  ): Promise<RealTimeFeedback> {
    let message: string;
    let improvementSuggestions: string[] = [];
    let encouragement: string;

    if (isCorrect) {
      message = `Correct! ${exercise.explanation}`;
      encouragement = "Great job! Keep up the excellent work.";
    } else {
      message = `Not quite. The correct answer is: ${exercise.correctAnswer}. ${exercise.explanation}`;
      improvementSuggestions = [
        `Review the ${exercise.category.replace(/_/g, " ")} training content`,
        "Pay attention to key compliance principles",
        "Consider retaking this exercise after review"
      ];
      encouragement = "Don't worry - learning from mistakes helps reinforce understanding.";
    }

    return {
      id: `feedback-${Date.now()}`,
      userId,
      exerciseId: exercise.id,
      feedbackType: isCorrect ? "correct" : "incorrect",
      message,
      improvementSuggestions,
      relatedContent: this.getRecommendedModules(exercise.category),
      encouragement,
      generatedAt: new Date()
    };
  }

  private updateUserProgress(
    userId: string,
    moduleId: string,
    exerciseId: string,
    isCorrect: boolean,
    points: number
  ): void {
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, new Map());
    }

    const userModules = this.userProgress.get(userId)!;
    let progress = userModules.get(moduleId);

    if (!progress) {
      const module = this.modules.get(moduleId);
      const maxScore = module?.exercises.reduce((sum, e) => sum + e.points, 0) || 0;
      
      progress = {
        userId,
        moduleId,
        status: "in_progress",
        completedContentIds: [],
        exerciseAttempts: [],
        score: 0,
        maxScore,
        startedAt: new Date(),
        completedAt: null,
        lastAccessedAt: new Date()
      };
      userModules.set(moduleId, progress);
    }

    if (isCorrect) {
      progress.score += points;
    }
    progress.lastAccessedAt = new Date();

    const module = this.modules.get(moduleId);
    if (module) {
      const attemptedExercises = new Set(
        this.exerciseAttempts
          .filter(a => a.moduleId === moduleId && a.userId === userId)
          .map(a => a.exerciseId)
      );
      attemptedExercises.add(exerciseId);
      
      if (attemptedExercises.size >= module.exercises.length) {
        progress.status = "completed";
        progress.completedAt = new Date();
      }
    }
  }

  async getUserTrainingProfile(userId: string): Promise<UserTrainingProfile> {
    let profile = this.userProfiles.get(userId);
    
    if (!profile || Date.now() - profile.lastAnalyzedAt.getTime() > 24 * 60 * 60 * 1000) {
      const weaknesses = await this.analyzeUserWeaknesses(userId);
      const recommendedModules = this.getRecommendedModulesForUser(weaknesses);
      const completedModules = this.getCompletedModules(userId);
      const inProgressModules = this.getInProgressModules(userId);
      const analytics = this.getUserAnalytics(userId);

      const strengthAreas = this.identifyStrengths(analytics);
      const improvementAreas = this.identifyImprovementAreas(weaknesses, analytics);
      const learningPath = this.generateLearningPath(weaknesses, completedModules);

      profile = {
        userId,
        weaknesses,
        recommendedModules,
        completedModules,
        inProgressModules,
        overallScore: analytics.overallAccuracy,
        strengthAreas,
        improvementAreas,
        learningPath,
        lastAnalyzedAt: new Date()
      };

      this.userProfiles.set(userId, profile);
    }

    return profile;
  }

  private getRecommendedModulesForUser(weaknesses: UserWeakness[]): string[] {
    const recommended = new Set<string>();
    weaknesses.forEach(w => {
      w.recommendedTraining.forEach(m => recommended.add(m));
    });
    return Array.from(recommended);
  }

  private getCompletedModules(userId: string): string[] {
    const userModules = this.userProgress.get(userId);
    if (!userModules) return [];
    
    return Array.from(userModules.entries())
      .filter(([_, progress]) => progress.status === "completed")
      .map(([moduleId]) => moduleId);
  }

  private getInProgressModules(userId: string): string[] {
    const userModules = this.userProgress.get(userId);
    if (!userModules) return [];
    
    return Array.from(userModules.entries())
      .filter(([_, progress]) => progress.status === "in_progress")
      .map(([moduleId]) => moduleId);
  }

  private identifyStrengths(analytics: TrainingAnalytics): TrainingCategory[] {
    return Object.entries(analytics.categoryPerformance)
      .filter(([_, perf]) => perf.accuracy >= 80 && perf.completed >= 1)
      .map(([category]) => category as TrainingCategory);
  }

  private identifyImprovementAreas(weaknesses: UserWeakness[], analytics: TrainingAnalytics): TrainingCategory[] {
    const weakCategories = new Set(weaknesses.filter(w => w.severity !== "low").map(w => w.category));
    const lowPerformance = Object.entries(analytics.categoryPerformance)
      .filter(([_, perf]) => perf.accuracy < 60 && perf.completed >= 1)
      .map(([category]) => category as TrainingCategory);
    
    const combined = new Set([...Array.from(weakCategories), ...lowPerformance]);
    return Array.from(combined);
  }

  private generateLearningPath(weaknesses: UserWeakness[], completedModules: string[]): LearningPathItem[] {
    const path: LearningPathItem[] = [];
    let order = 1;

    const highPriorityModules = new Set<string>();
    weaknesses
      .filter(w => w.severity === "high")
      .forEach(w => w.recommendedTraining.forEach(m => highPriorityModules.add(m)));

    highPriorityModules.forEach(moduleId => {
      if (!completedModules.includes(moduleId)) {
        path.push({
          moduleId,
          order: order++,
          priority: "required",
          reason: "Addresses high-priority compliance weakness"
        });
      }
    });

    const mediumPriorityModules = new Set<string>();
    weaknesses
      .filter(w => w.severity === "medium")
      .forEach(w => w.recommendedTraining.forEach(m => {
        if (!highPriorityModules.has(m)) mediumPriorityModules.add(m);
      }));

    mediumPriorityModules.forEach(moduleId => {
      if (!completedModules.includes(moduleId)) {
        path.push({
          moduleId,
          order: order++,
          priority: "recommended",
          reason: "Addresses identified compliance gaps"
        });
      }
    });

    return path;
  }

  getUserAnalytics(userId: string): TrainingAnalytics {
    const userAttempts = this.exerciseAttempts.filter(a => a.userId === userId);
    const userModules = this.userProgress.get(userId);
    
    const totalModulesCompleted = userModules 
      ? Array.from(userModules.values()).filter(p => p.status === "completed").length 
      : 0;

    const totalExercisesAttempted = userAttempts.length;
    const correctAttempts = userAttempts.filter(a => a.isCorrect).length;
    const overallAccuracy = totalExercisesAttempted > 0 
      ? Math.round((correctAttempts / totalExercisesAttempted) * 100) 
      : 0;

    const categoryPerformance: Record<TrainingCategory, { accuracy: number; completed: number }> = {
      data_access: { accuracy: 0, completed: 0 },
      phi_handling: { accuracy: 0, completed: 0 },
      encryption: { accuracy: 0, completed: 0 },
      authentication: { accuracy: 0, completed: 0 },
      policy_compliance: { accuracy: 0, completed: 0 },
      incident_response: { accuracy: 0, completed: 0 },
      consent_management: { accuracy: 0, completed: 0 },
      audit_logging: { accuracy: 0, completed: 0 }
    };

    this.modules.forEach(module => {
      const moduleAttempts = userAttempts.filter(a => a.moduleId === module.id);
      if (moduleAttempts.length > 0) {
        const correct = moduleAttempts.filter(a => a.isCorrect).length;
        const perf = categoryPerformance[module.category];
        perf.accuracy = Math.round((correct / moduleAttempts.length) * 100);
        perf.completed++;
      }
    });

    return {
      userId,
      totalModulesCompleted,
      totalExercisesAttempted,
      overallAccuracy,
      averageTimePerModule: 25,
      categoryPerformance,
      recentActivity: userAttempts.slice(-5).map(a => ({
        date: a.attemptedAt,
        action: a.isCorrect ? "Answered correctly" : "Answered incorrectly",
        details: `Exercise in module ${a.moduleId}`
      })),
      improvementTrend: this.calculateImprovementTrend(userAttempts),
      nextRecommendation: this.getNextRecommendation(userId)
    };
  }

  private calculateImprovementTrend(attempts: ExerciseAttempt[]): "improving" | "stable" | "declining" {
    if (attempts.length < 5) return "stable";
    
    const recentHalf = attempts.slice(-Math.floor(attempts.length / 2));
    const olderHalf = attempts.slice(0, Math.floor(attempts.length / 2));
    
    const recentAccuracy = recentHalf.filter(a => a.isCorrect).length / recentHalf.length;
    const olderAccuracy = olderHalf.filter(a => a.isCorrect).length / olderHalf.length;
    
    if (recentAccuracy > olderAccuracy + 0.1) return "improving";
    if (recentAccuracy < olderAccuracy - 0.1) return "declining";
    return "stable";
  }

  private getNextRecommendation(userId: string): string {
    const profile = this.userProfiles.get(userId);
    if (profile && profile.learningPath.length > 0) {
      const nextModule = this.modules.get(profile.learningPath[0].moduleId);
      return nextModule ? `Continue with: ${nextModule.title}` : "Complete your assigned training modules";
    }
    return "Great job! You're up to date on all required training.";
  }

  listModules(filters?: { category?: TrainingCategory; difficulty?: DifficultyLevel }): TrainingModule[] {
    let modules = Array.from(this.modules.values());
    
    if (filters?.category) {
      modules = modules.filter(m => m.category === filters.category);
    }
    if (filters?.difficulty) {
      modules = modules.filter(m => m.difficulty === filters.difficulty);
    }
    
    return modules;
  }

  getModule(moduleId: string): TrainingModule | null {
    return this.modules.get(moduleId) || null;
  }

  getModuleProgress(userId: string, moduleId: string): UserProgress | null {
    const userModules = this.userProgress.get(userId);
    return userModules?.get(moduleId) || null;
  }

  markContentComplete(userId: string, moduleId: string, contentId: string): void {
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, new Map());
    }

    const userModules = this.userProgress.get(userId)!;
    let progress = userModules.get(moduleId);

    if (!progress) {
      const module = this.modules.get(moduleId);
      progress = {
        userId,
        moduleId,
        status: "in_progress",
        completedContentIds: [],
        exerciseAttempts: [],
        score: 0,
        maxScore: module?.exercises.reduce((sum, e) => sum + e.points, 0) || 0,
        startedAt: new Date(),
        completedAt: null,
        lastAccessedAt: new Date()
      };
      userModules.set(moduleId, progress);
    }

    if (!progress.completedContentIds.includes(contentId)) {
      progress.completedContentIds.push(contentId);
    }
    progress.lastAccessedAt = new Date();
  }

  getDashboardData(userId: string): {
    profile: UserTrainingProfile | null;
    analytics: TrainingAnalytics;
    recommendedModules: TrainingModule[];
    inProgressModules: Array<{ module: TrainingModule; progress: UserProgress }>;
  } {
    const profile = this.userProfiles.get(userId) || null;
    const analytics = this.getUserAnalytics(userId);
    
    const recommendedModuleIds = profile?.recommendedModules || [];
    const recommendedModules = recommendedModuleIds
      .map(id => this.modules.get(id))
      .filter((m): m is TrainingModule => m !== undefined)
      .slice(0, 5);

    const inProgressModuleIds = profile?.inProgressModules || [];
    const inProgressModules = inProgressModuleIds
      .map(id => {
        const module = this.modules.get(id);
        const progress = this.userProgress.get(userId)?.get(id);
        if (module && progress) {
          return { module, progress };
        }
        return null;
      })
      .filter((m): m is { module: TrainingModule; progress: UserProgress } => m !== null);

    return {
      profile,
      analytics,
      recommendedModules,
      inProgressModules
    };
  }
}

export const aiComplianceTrainingService = new AIComplianceTrainingService();
