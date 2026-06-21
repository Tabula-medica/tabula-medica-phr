import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PatientProfile {
  patientId: string;
  name: string;
  age?: number;
  healthLiteracyLevel: "basic" | "intermediate" | "advanced";
  preferredLanguage: string;
  communicationPreference: "formal" | "friendly" | "motivational";
  activeConditions: string[];
  learningStyle: "visual" | "reading" | "interactive" | "mixed";
}

export interface CarePathwayContext {
  pathwayId: string;
  pathwayName: string;
  currentPhase: string;
  phaseProgress: number;
  overallProgress: number;
  completedMilestones: string[];
  upcomingMilestones: string[];
  recentActivities: { activity: string; timestamp: string; success: boolean }[];
}

export interface BehaviorPattern {
  taskCompletionRate: number;
  averageEngagementTime: number;
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "varies";
  missedTaskPatterns: string[];
  successPatterns: string[];
  lastActiveDate: string;
  streakDays: number;
  responseToNudgeTypes: { nudgeType: string; responseRate: number }[];
}

export interface ContentRecommendation {
  contentId: string;
  title: string;
  description: string;
  type: "article" | "video" | "infographic" | "quiz" | "interactive";
  category: string;
  relevanceScore: number;
  relevanceReason: string;
  estimatedDuration: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
  prerequisites?: string[];
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  relatedContentId?: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
}

export interface QuizAssessment {
  quizId: string;
  title: string;
  description: string;
  relatedContentId: string;
  questions: QuizQuestion[];
  passingScore: number;
  totalPoints: number;
  estimatedMinutes: number;
}

export interface QuizResult {
  quizId: string;
  patientId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers: { questionId: string; selectedAnswer: string; correct: boolean }[];
  feedback: string;
  recommendedReview: string[];
  completedAt: string;
}

export interface PersonalizedNudge {
  id: string;
  type: "reminder" | "encouragement" | "tip" | "milestone" | "check_in" | "educational";
  title: string;
  message: string;
  tone: "supportive" | "motivational" | "informative" | "celebratory" | "gentle";
  priority: "low" | "medium" | "high";
  optimalDeliveryTime: string;
  deliveryReason: string;
  actionUrl?: string;
  actionLabel?: string;
  relatedGoal?: string;
  personalizationFactors: string[];
}

export class AIPersonalizedEngagementService {
  async recommendContent(
    patientProfile: PatientProfile,
    pathwayContext: CarePathwayContext,
    behaviorPattern: BehaviorPattern,
    existingContent: { id: string; title: string; type: string; category: string; completed: boolean }[]
  ): Promise<ContentRecommendation[]> {
    try {
      const prompt = `You are a healthcare education AI that recommends personalized learning content for patients.

PATIENT PROFILE:
- Health Literacy Level: ${patientProfile.healthLiteracyLevel}
- Learning Style: ${patientProfile.learningStyle}
- Active Conditions: ${patientProfile.activeConditions.join(", ")}
- Preferred Communication: ${patientProfile.communicationPreference}

CARE PATHWAY CONTEXT:
- Pathway: ${pathwayContext.pathwayName}
- Current Phase: ${pathwayContext.currentPhase}
- Phase Progress: ${pathwayContext.phaseProgress}%
- Completed Milestones: ${pathwayContext.completedMilestones.join(", ") || "None yet"}
- Upcoming Milestones: ${pathwayContext.upcomingMilestones.join(", ")}

BEHAVIOR PATTERNS:
- Task Completion Rate: ${behaviorPattern.taskCompletionRate}%
- Engagement Streak: ${behaviorPattern.streakDays} days
- Preferred Time: ${behaviorPattern.preferredTimeOfDay}
- Success Patterns: ${behaviorPattern.successPatterns.join(", ") || "Still learning"}

AVAILABLE CONTENT (not yet completed):
${existingContent.filter(c => !c.completed).map(c => `- ${c.id}: ${c.title} (${c.type}, ${c.category})`).join("\n")}

Based on the patient's current pathway phase, learning needs, and behavior patterns, recommend the TOP 3 most relevant educational content items. Consider:
1. Content that addresses current phase learning objectives
2. Content matching the patient's learning style
3. Content appropriate for their health literacy level
4. Content that builds on recent successes

Respond in JSON format:
{
  "recommendations": [
    {
      "contentId": "string (from available content)",
      "relevanceScore": 0.0-1.0,
      "relevanceReason": "Why this content is recommended now",
      "learningObjectives": ["What the patient will learn"],
      "difficultyLevel": "beginner|intermediate|advanced"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.recommendations.map((rec: any) => {
          const original = existingContent.find(c => c.id === rec.contentId);
          return {
            contentId: rec.contentId,
            title: original?.title || "Recommended Content",
            description: rec.relevanceReason,
            type: original?.type || "article",
            category: original?.category || "General",
            relevanceScore: rec.relevanceScore,
            relevanceReason: rec.relevanceReason,
            estimatedDuration: "10-15 min",
            difficultyLevel: rec.difficultyLevel,
            learningObjectives: rec.learningObjectives || [],
            tags: [],
          };
        });
      }
    } catch (error) {
      console.error("AI content recommendation error:", error);
    }

    return this.getFallbackRecommendations(existingContent, pathwayContext);
  }

  async generateQuiz(
    contentId: string,
    contentTitle: string,
    contentSummary: string,
    patientProfile: PatientProfile,
    questionCount: number = 5
  ): Promise<QuizAssessment> {
    try {
      const prompt = `You are a healthcare education AI creating an interactive quiz to assess patient understanding.

CONTENT BEING ASSESSED:
- Title: ${contentTitle}
- Summary: ${contentSummary}

PATIENT CONTEXT:
- Health Literacy Level: ${patientProfile.healthLiteracyLevel}
- Active Conditions: ${patientProfile.activeConditions.join(", ")}

Create ${questionCount} quiz questions that:
1. Test understanding of key concepts, not just memorization
2. Are appropriate for the patient's health literacy level
3. Include practical application questions
4. Are encouraging and not intimidating

Respond in JSON format:
{
  "title": "Quiz title",
  "description": "Brief description",
  "questions": [
    {
      "id": "q1",
      "question": "The question text",
      "type": "multiple_choice|true_false",
      "options": ["A", "B", "C", "D"] (for multiple choice),
      "correctAnswer": "The correct option",
      "explanation": "Why this answer is correct - educational explanation",
      "difficulty": "easy|medium|hard",
      "points": 10-30
    }
  ],
  "passingScore": 70
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const totalPoints = parsed.questions.reduce((sum: number, q: any) => sum + (q.points || 10), 0);
        return {
          quizId: `quiz-${contentId}-${Date.now()}`,
          title: parsed.title,
          description: parsed.description,
          relatedContentId: contentId,
          questions: parsed.questions.map((q: any, i: number) => ({
            id: q.id || `q${i + 1}`,
            question: q.question,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty || "medium",
            points: q.points || 10,
            relatedContentId: contentId,
          })),
          passingScore: parsed.passingScore || 70,
          totalPoints,
          estimatedMinutes: Math.ceil(questionCount * 1.5),
        };
      }
    } catch (error) {
      console.error("AI quiz generation error:", error);
    }

    return this.getFallbackQuiz(contentId, contentTitle);
  }

  async evaluateQuizResults(
    quiz: QuizAssessment,
    answers: { questionId: string; selectedAnswer: string }[],
    patientProfile: PatientProfile
  ): Promise<QuizResult> {
    const results = answers.map(answer => {
      const question = quiz.questions.find(q => q.id === answer.questionId);
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        correct: question?.correctAnswer === answer.selectedAnswer,
      };
    });

    const correctCount = results.filter(r => r.correct).length;
    const score = results.reduce((sum, r) => {
      const question = quiz.questions.find(q => q.id === r.questionId);
      return sum + (r.correct ? (question?.points || 10) : 0);
    }, 0);
    const percentage = Math.round((score / quiz.totalPoints) * 100);
    const passed = percentage >= quiz.passingScore;

    const incorrectQuestions = results
      .filter(r => !r.correct)
      .map(r => quiz.questions.find(q => q.id === r.questionId)?.question || "");

    let feedback = "";
    let recommendedReview: string[] = [];

    try {
      const prompt = `You are a supportive healthcare education AI providing personalized quiz feedback.

QUIZ RESULTS:
- Score: ${percentage}%
- Passed: ${passed}
- Correct Answers: ${correctCount}/${quiz.questions.length}

INCORRECT QUESTIONS:
${incorrectQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") || "All correct!"}

PATIENT PROFILE:
- Health Literacy: ${patientProfile.healthLiteracyLevel}
- Communication Preference: ${patientProfile.communicationPreference}

Provide:
1. Personalized, encouraging feedback (2-3 sentences)
2. If they missed questions, suggest specific areas to review
3. Match the tone to their communication preference

Respond in JSON:
{
  "feedback": "Personalized feedback message",
  "recommendedReview": ["Topic 1 to review", "Topic 2 to review"]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        feedback = parsed.feedback;
        recommendedReview = parsed.recommendedReview || [];
      }
    } catch (error) {
      feedback = passed
        ? "Great job! You demonstrated a solid understanding of the material."
        : "Good effort! Review the areas you missed and try again when ready.";
      recommendedReview = incorrectQuestions.slice(0, 3);
    }

    return {
      quizId: quiz.quizId,
      patientId: patientProfile.patientId,
      score,
      totalPoints: quiz.totalPoints,
      percentage,
      passed,
      answers: results,
      feedback,
      recommendedReview,
      completedAt: new Date().toISOString(),
    };
  }

  async generatePersonalizedNudges(
    patientProfile: PatientProfile,
    pathwayContext: CarePathwayContext,
    behaviorPattern: BehaviorPattern,
    pendingTasks: { id: string; title: string; category: string; dueDate: string }[],
    recentNudges: { type: string; sentAt: string; dismissed: boolean }[]
  ): Promise<PersonalizedNudge[]> {
    try {
      const prompt = `You are an AI health coach creating personalized engagement nudges for a patient.

PATIENT PROFILE:
- Name: ${patientProfile.name}
- Health Literacy: ${patientProfile.healthLiteracyLevel}
- Communication Preference: ${patientProfile.communicationPreference}
- Conditions: ${patientProfile.activeConditions.join(", ")}

PATHWAY PROGRESS:
- Pathway: ${pathwayContext.pathwayName}
- Current Phase: ${pathwayContext.currentPhase}
- Overall Progress: ${pathwayContext.overallProgress}%
- Recent Activities: ${pathwayContext.recentActivities.map(a => `${a.activity} (${a.success ? "success" : "missed"})`).join(", ") || "None"}

BEHAVIOR PATTERNS:
- Task Completion Rate: ${behaviorPattern.taskCompletionRate}%
- Current Streak: ${behaviorPattern.streakDays} days
- Preferred Time: ${behaviorPattern.preferredTimeOfDay}
- Success Patterns: ${behaviorPattern.successPatterns.join(", ") || "Still establishing"}
- Missed Task Patterns: ${behaviorPattern.missedTaskPatterns.join(", ") || "None identified"}

PENDING TASKS:
${pendingTasks.map(t => `- ${t.title} (${t.category}, due: ${t.dueDate})`).join("\n") || "None"}

RECENT NUDGES SENT:
${recentNudges.map(n => `- ${n.type} at ${n.sentAt} (${n.dismissed ? "dismissed" : "acknowledged"})`).join("\n") || "None"}

Generate 2-3 personalized nudges that:
1. Match the patient's communication preference and tone
2. Are timed based on their behavioral patterns
3. Address current needs (upcoming tasks, encouragement, education)
4. Avoid repeating recently sent nudge types
5. Are specific and actionable

Respond in JSON:
{
  "nudges": [
    {
      "type": "reminder|encouragement|tip|milestone|check_in|educational",
      "title": "Short, attention-grabbing title",
      "message": "Personalized message body (2-3 sentences)",
      "tone": "supportive|motivational|informative|celebratory|gentle",
      "priority": "low|medium|high",
      "optimalDeliveryTime": "morning|afternoon|evening or specific time like 9:00 AM",
      "deliveryReason": "Why this nudge at this time",
      "actionLabel": "Button text if action needed",
      "relatedGoal": "What goal this supports",
      "personalizationFactors": ["Factor 1", "Factor 2"]
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.nudges.map((nudge: any, i: number) => ({
          id: `nudge-${Date.now()}-${i}`,
          type: nudge.type,
          title: nudge.title,
          message: nudge.message,
          tone: nudge.tone,
          priority: nudge.priority,
          optimalDeliveryTime: nudge.optimalDeliveryTime,
          deliveryReason: nudge.deliveryReason,
          actionUrl: nudge.type === "reminder" ? "/patient-care-portal?tab=tasks" : 
                     nudge.type === "educational" ? "/patient-care-portal?tab=learn" : undefined,
          actionLabel: nudge.actionLabel,
          relatedGoal: nudge.relatedGoal,
          personalizationFactors: nudge.personalizationFactors || [],
        }));
      }
    } catch (error) {
      console.error("AI nudge generation error:", error);
    }

    return this.getFallbackNudges(behaviorPattern, pendingTasks);
  }

  async analyzeLearningProgress(
    patientId: string,
    completedContent: { id: string; title: string; completedAt: string }[],
    quizResults: QuizResult[],
    pathwayContext: CarePathwayContext
  ): Promise<{
    overallProgress: number;
    strengthAreas: string[];
    improvementAreas: string[];
    nextRecommendations: string[];
    learningVelocity: "slow" | "moderate" | "fast";
    encouragementMessage: string;
  }> {
    try {
      const avgQuizScore = quizResults.length > 0
        ? quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length
        : 0;

      const prompt = `Analyze a patient's learning progress and provide insights.

COMPLETED CONTENT:
${completedContent.map(c => `- ${c.title} (${c.completedAt})`).join("\n") || "None yet"}

QUIZ RESULTS:
${quizResults.map(r => `- ${r.quizId}: ${r.percentage}% (${r.passed ? "passed" : "needs review"})`).join("\n") || "No quizzes taken"}
Average Quiz Score: ${avgQuizScore.toFixed(0)}%

PATHWAY CONTEXT:
- Phase: ${pathwayContext.currentPhase}
- Progress: ${pathwayContext.overallProgress}%

Analyze and provide:
1. Overall learning progress (0-100)
2. Strength areas (topics they understand well)
3. Areas needing improvement
4. Next learning recommendations
5. Learning velocity assessment
6. A brief, encouraging message

Respond in JSON:
{
  "overallProgress": 0-100,
  "strengthAreas": ["Area 1", "Area 2"],
  "improvementAreas": ["Area 1", "Area 2"],
  "nextRecommendations": ["Recommendation 1", "Recommendation 2"],
  "learningVelocity": "slow|moderate|fast",
  "encouragementMessage": "Brief personalized message"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("AI learning analysis error:", error);
    }

    return {
      overallProgress: completedContent.length * 10,
      strengthAreas: ["Getting started on your learning journey"],
      improvementAreas: ["Continue completing educational content"],
      nextRecommendations: ["Complete your first quiz to assess understanding"],
      learningVelocity: "moderate",
      encouragementMessage: "Keep up the great work! Every step forward matters.",
    };
  }

  private getFallbackRecommendations(
    content: { id: string; title: string; type: string; category: string; completed: boolean }[],
    pathwayContext: CarePathwayContext
  ): ContentRecommendation[] {
    const uncompleted = content.filter(c => !c.completed).slice(0, 3);
    return uncompleted.map((c, i) => ({
      contentId: c.id,
      title: c.title,
      description: `Recommended based on your ${pathwayContext.currentPhase} phase progress`,
      type: c.type as any,
      category: c.category,
      relevanceScore: 0.9 - (i * 0.1),
      relevanceReason: "This content aligns with your current care pathway phase",
      estimatedDuration: "10-15 min",
      difficultyLevel: "intermediate" as const,
      learningObjectives: ["Understand key concepts for your health journey"],
      tags: [c.category],
    }));
  }

  private getFallbackQuiz(contentId: string, contentTitle: string): QuizAssessment {
    return {
      quizId: `quiz-${contentId}-${Date.now()}`,
      title: `Understanding Check: ${contentTitle}`,
      description: "Test your understanding of the key concepts",
      relatedContentId: contentId,
      questions: [
        {
          id: "q1",
          question: "What is the most important takeaway from this content?",
          type: "multiple_choice",
          options: [
            "Understanding my condition helps me manage it better",
            "I should ignore symptoms",
            "Medication is the only solution",
            "I don't need to track my progress",
          ],
          correctAnswer: "Understanding my condition helps me manage it better",
          explanation: "Knowledge is power! Understanding your health condition empowers you to make better decisions.",
          difficulty: "easy",
          points: 10,
        },
        {
          id: "q2",
          question: "Regular monitoring of your health metrics is important for managing chronic conditions.",
          type: "true_false",
          options: ["True", "False"],
          correctAnswer: "True",
          explanation: "Regular monitoring helps you and your care team track progress and adjust treatment as needed.",
          difficulty: "easy",
          points: 10,
        },
      ],
      passingScore: 70,
      totalPoints: 20,
      estimatedMinutes: 3,
    };
  }

  private getFallbackNudges(
    behaviorPattern: BehaviorPattern,
    pendingTasks: { id: string; title: string; category: string; dueDate: string }[]
  ): PersonalizedNudge[] {
    const nudges: PersonalizedNudge[] = [];

    if (behaviorPattern.streakDays > 0) {
      nudges.push({
        id: `nudge-streak-${Date.now()}`,
        type: "encouragement",
        title: "You're on a roll!",
        message: `Amazing! You've been consistent for ${behaviorPattern.streakDays} days. Keep up the great work!`,
        tone: "celebratory",
        priority: "medium",
        optimalDeliveryTime: "morning",
        deliveryReason: "Celebrating consistency to reinforce positive behavior",
        personalizationFactors: ["streak recognition", "positive reinforcement"],
      });
    }

    if (pendingTasks.length > 0) {
      nudges.push({
        id: `nudge-task-${Date.now()}`,
        type: "reminder",
        title: "Quick reminder",
        message: `You have ${pendingTasks.length} task${pendingTasks.length > 1 ? "s" : ""} waiting for you today. You've got this!`,
        tone: "supportive",
        priority: "medium",
        optimalDeliveryTime: behaviorPattern.preferredTimeOfDay,
        deliveryReason: "Gentle task reminder based on pending items",
        actionUrl: "/patient-care-portal?tab=tasks",
        actionLabel: "View Tasks",
        personalizationFactors: ["pending tasks", "preferred time"],
      });
    }

    return nudges;
  }
}

export const aiPersonalizedEngagementService = new AIPersonalizedEngagementService();
