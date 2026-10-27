import { storage } from "./storage";
import { chatComplete } from "./ai-client";
import type { 
  EducationalModule, 
  HealthRecord, 
  HealthGoal,
  CarePathway,
  PatientPathwayAssignment,
  PathwayStep,
  UserSentimentLog,
  InsertEducationalQuiz,
  InsertQuizQuestion,
  InsertLearningNeedsAssessment,
  InsertContentRecommendation,
  InsertPersonalizedNudge
} from "@shared/schema";

const AI_MODEL = "deep";

interface PatientEducationContext {
  userId: string;
  conditions: HealthRecord[];
  medications: HealthRecord[];
  activeGoals: HealthGoal[];
  activePathways: PatientPathwayAssignment[];
  pathwayDetails: CarePathway[];
  currentSteps: PathwayStep[];
  recentSentiments: UserSentimentLog[];
  completedModules: string[];
  quizScores: { quizId: string; score: number; topic: string }[];
}

async function getPatientEducationContext(userId: string): Promise<PatientEducationContext> {
  const [records, goals, pathways, sentiments, progress, gamification] = await Promise.all([
    storage.getHealthRecords(userId),
    storage.getActiveHealthGoals(userId),
    storage.getPatientPathwayAssignments(userId),
    storage.getRecentSentimentLogs(userId, 10),
    storage.getUserEducationalProgress(userId),
    storage.getUserGamification(userId),
  ]);

  const pathwayDetails: CarePathway[] = [];
  const currentSteps: PathwayStep[] = [];
  
  for (const assignment of pathways) {
    const pathway = await storage.getCarePathway(assignment.pathwayId);
    if (pathway) {
      pathwayDetails.push(pathway);
      if (assignment.currentStepIndex !== null && assignment.currentStepIndex !== undefined) {
        const steps = await storage.getPathwaySteps(assignment.pathwayId);
        if (steps && steps[assignment.currentStepIndex]) {
          currentSteps.push(steps[assignment.currentStepIndex]);
        }
      }
    }
  }

  const completedModules = progress
    .filter((p: any) => p.status === "completed")
    .map((p: any) => p.moduleId);

  const userAttempts = await storage.getUserQuizAttempts(userId);
  const quizScores = await Promise.all(
    userAttempts.filter((a: any) => a.completedAt).slice(0, 20).map(async (a: any) => {
      const quiz = await storage.getQuizById(a.quizId);
      return {
        quizId: a.quizId,
        score: a.percentageScore || 0,
        topic: quiz?.category || "general"
      };
    })
  );

  return {
    userId,
    conditions: records.filter(r => r.type === "condition"),
    medications: records.filter(r => r.type === "medication"),
    activeGoals: goals,
    activePathways: pathways,
    pathwayDetails,
    currentSteps,
    recentSentiments: sentiments,
    completedModules,
    quizScores,
  };
}

export interface LearningNeedsResult {
  identifiedNeeds: {
    topic: string;
    priority: "high" | "medium" | "low";
    reason: string;
    suggestedModules: string[];
  }[];
  learningStyle: "visual" | "auditory" | "reading" | "kinesthetic";
  preferredContentTypes: string[];
  knowledgeGaps: string[];
  strengthAreas: string[];
  aiRecommendations: {
    focusArea: string;
    suggestedPath: string[];
    estimatedTime: number;
  }[];
}

export async function assessLearningNeeds(userId: string): Promise<LearningNeedsResult> {
  const context = await getPatientEducationContext(userId);
  const modules = await storage.getEducationalModules();
  
  const prompt = `Analyze this patient's health profile and learning history to assess their educational needs.

Patient Context:
- Conditions: ${context.conditions.map(c => c.title).join(", ") || "None recorded"}
- Medications: ${context.medications.map(m => m.title).join(", ") || "None recorded"}
- Active Health Goals: ${context.activeGoals.map(g => `${g.title} (${g.category})`).join(", ") || "None set"}
- Current Care Pathway Steps: ${context.currentSteps.map(s => s.title).join(", ") || "None"}
- Recent Emotional State: ${context.recentSentiments.slice(0, 3).map(s => s.sentiment).join(", ") || "Unknown"}
- Completed Educational Modules: ${context.completedModules.length} modules
- Recent Quiz Performance: ${context.quizScores.length > 0 
    ? context.quizScores.map(q => `${q.topic}: ${q.score}%`).join(", ")
    : "No quiz attempts"}

Available Educational Categories: medication, condition, lifestyle, prevention, nutrition, exercise, mental_health

Provide a comprehensive learning needs assessment as JSON:
{
  "identifiedNeeds": [
    {
      "topic": "category name",
      "priority": "high" | "medium" | "low",
      "reason": "why this is important for this patient",
      "suggestedModules": ["module topic 1", "module topic 2"]
    }
  ],
  "learningStyle": "visual" | "auditory" | "reading" | "kinesthetic",
  "preferredContentTypes": ["article", "video", "quiz", etc.],
  "knowledgeGaps": ["areas needing improvement based on quiz scores"],
  "strengthAreas": ["areas where patient shows mastery"],
  "aiRecommendations": [
    {
      "focusArea": "primary learning focus",
      "suggestedPath": ["step 1", "step 2", "step 3"],
      "estimatedTime": 30
    }
  ]
}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a healthcare education specialist. Analyze patient profiles to identify educational needs and create personalized learning recommendations. Be specific and actionable."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-education",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    await storage.createLearningNeedsAssessment({
      userId,
      assessmentType: "periodic",
      identifiedNeeds: result.identifiedNeeds || [],
      learningStyle: result.learningStyle || "reading",
      preferredContentTypes: result.preferredContentTypes || [],
      knowledgeGaps: result.knowledgeGaps || [],
      strengthAreas: result.strengthAreas || [],
      aiRecommendations: result.aiRecommendations || [],
      isActive: true,
    });

    return result;
  } catch (error) {
    console.error("Error assessing learning needs:", error);
    return {
      identifiedNeeds: [],
      learningStyle: "reading",
      preferredContentTypes: ["article"],
      knowledgeGaps: [],
      strengthAreas: [],
      aiRecommendations: [],
    };
  }
}

export interface ContentRecommendationResult {
  recommendations: {
    moduleId?: string;
    title: string;
    description: string;
    category: string;
    relevanceScore: number;
    personalizedReason: string;
    recommendationType: string;
    priority: number;
  }[];
}

export async function generateContentRecommendations(
  userId: string,
  count: number = 5
): Promise<ContentRecommendationResult> {
  const context = await getPatientEducationContext(userId);
  const modules = await storage.getEducationalModules();
  const learningNeeds = await storage.getLearningNeedsAssessment(userId);
  
  const availableModules = modules.filter((m: any) => !context.completedModules.includes(m.id));
  
  const prompt = `Recommend educational content for this patient based on their profile and learning needs.

Patient Context:
- Conditions: ${context.conditions.map(c => c.title).join(", ") || "None recorded"}
- Medications: ${context.medications.map(m => m.title).join(", ") || "None recorded"}
- Active Goals: ${context.activeGoals.map(g => `${g.title} (${g.category})`).join(", ") || "None"}
- Current Pathway Focus: ${context.currentSteps.map(s => s.title).join(", ") || "None"}
- Recent Mood: ${context.recentSentiments.slice(0, 3).map(s => s.sentiment).join(", ") || "Neutral"}
${learningNeeds ? `
Learning Profile:
- Identified Needs: ${JSON.stringify(learningNeeds.identifiedNeeds || [])}
- Knowledge Gaps: ${JSON.stringify(learningNeeds.knowledgeGaps || [])}
- Learning Style: ${learningNeeds.learningStyle || "reading"}
` : ""}

Available Modules:
${availableModules.slice(0, 20).map((m: any) => 
  `- ID: ${m.id}, Title: ${m.title}, Category: ${m.category}, Difficulty: ${m.difficulty}`
).join("\n")}

Provide ${count} personalized content recommendations as JSON:
{
  "recommendations": [
    {
      "moduleId": "module ID from available modules or null for new content suggestion",
      "title": "content title",
      "description": "brief description",
      "category": "medication|condition|lifestyle|prevention|nutrition|exercise|mental_health",
      "relevanceScore": 0.0-1.0,
      "personalizedReason": "specific reason this content is relevant for this patient",
      "recommendationType": "pathway_aligned|knowledge_gap|condition_specific|goal_related|trending",
      "priority": 1-10
    }
  ]
}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a healthcare content recommendation engine. Match educational content to patient needs based on their health profile, care pathway, and learning preferences."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-education",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    const recommendationsToSave: InsertContentRecommendation[] = (result.recommendations || []).map((rec: any) => ({
      userId,
      moduleId: rec.moduleId || null,
      recommendationType: rec.recommendationType || "condition_specific",
      relevanceScore: rec.relevanceScore || 0.5,
      personalizedReason: rec.personalizedReason,
      priority: rec.priority || 5,
      status: "pending",
      triggerContext: {
        conditions: context.conditions.map(c => c.title),
        pathway: context.currentSteps.map(s => s.title),
      },
    }));

    if (recommendationsToSave.length > 0) {
      await storage.createContentRecommendations(recommendationsToSave);
    }

    return result;
  } catch (error) {
    console.error("Error generating content recommendations:", error);
    return { recommendations: [] };
  }
}

export interface GeneratedQuiz {
  quiz: InsertEducationalQuiz;
  questions: InsertQuizQuestion[];
}

export async function generateQuizForModule(
  moduleId: string,
  questionCount: number = 5
): Promise<GeneratedQuiz | null> {
  const module = await storage.getEducationalModule(moduleId);
  if (!module) return null;

  const prompt = `Create an educational quiz to assess understanding of this health education module.

Module Title: ${module.title}
Module Category: ${module.category}
Module Difficulty: ${module.difficulty}
Module Content Summary:
${module.content?.substring(0, 2000) || "General health education content"}

Generate a quiz with ${questionCount} questions as JSON:
{
  "title": "quiz title related to module",
  "description": "brief quiz description",
  "questions": [
    {
      "questionText": "clear, educational question",
      "questionType": "multiple_choice" | "true_false",
      "options": [
        {"id": "a", "text": "option text", "isCorrect": false},
        {"id": "b", "text": "option text", "isCorrect": true},
        {"id": "c", "text": "option text", "isCorrect": false},
        {"id": "d", "text": "option text", "isCorrect": false}
      ],
      "explanation": "explanation of the correct answer",
      "points": 10
    }
  ]
}

For true_false questions, use only 2 options with ids "true" and "false".
Ensure questions test comprehension and practical application of health knowledge.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a healthcare education quiz creator. Create clear, accurate questions that test patient understanding of health topics. Questions should be educational and help reinforce learning."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-education",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    const quiz: InsertEducationalQuiz = {
      moduleId,
      title: result.title || `Quiz: ${module.title}`,
      description: result.description || `Test your understanding of ${module.title}`,
      category: module.category,
      difficulty: module.difficulty || "beginner",
      passingScore: 70,
      isAiGenerated: true,
      aiGenerationContext: { moduleId, generatedAt: new Date().toISOString() },
    };

    const questions: InsertQuizQuestion[] = (result.questions || []).map((q: any, index: number) => ({
      quizId: "", // Will be set after quiz is created
      questionText: q.questionText,
      questionType: q.questionType || "multiple_choice",
      options: q.options || [],
      explanation: q.explanation,
      points: q.points || 10,
      order: index,
      isAiGenerated: true,
    }));

    return { quiz, questions };
  } catch (error) {
    console.error("Error generating quiz:", error);
    return null;
  }
}

export async function generateQuizForPathwayStep(
  stepId: string,
  questionCount: number = 5
): Promise<GeneratedQuiz | null> {
  const step = await storage.getPathwayStep(stepId);
  if (!step) return null;

  const prompt = `Create an educational quiz to assess understanding of this care pathway step.

Step Title: ${step.title}
Step Description: ${step.description}
Step Type: ${step.stepType}
Educational Content: ${JSON.stringify(step.educationalContent || {})}

Generate a quiz with ${questionCount} questions as JSON:
{
  "title": "quiz title related to pathway step",
  "description": "brief quiz description",
  "questions": [
    {
      "questionText": "clear, educational question",
      "questionType": "multiple_choice" | "true_false",
      "options": [
        {"id": "a", "text": "option text", "isCorrect": false},
        {"id": "b", "text": "option text", "isCorrect": true}
      ],
      "explanation": "explanation of the correct answer",
      "points": 10
    }
  ]
}`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a healthcare education quiz creator for care pathway learning assessment."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-education",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    const quiz: InsertEducationalQuiz = {
      pathwayStepId: stepId,
      title: result.title || `Quiz: ${step.title}`,
      description: result.description || `Test your understanding of ${step.title}`,
      category: "condition",
      difficulty: "beginner",
      passingScore: 70,
      isAiGenerated: true,
      aiGenerationContext: { stepId, generatedAt: new Date().toISOString() },
    };

    const questions: InsertQuizQuestion[] = (result.questions || []).map((q: any, index: number) => ({
      quizId: "",
      questionText: q.questionText,
      questionType: q.questionType || "multiple_choice",
      options: q.options || [],
      explanation: q.explanation,
      points: q.points || 10,
      order: index,
      isAiGenerated: true,
    }));

    return { quiz, questions };
  } catch (error) {
    console.error("Error generating pathway quiz:", error);
    return null;
  }
}

export interface PersonalizedNudgeResult {
  title: string;
  message: string;
  aiPersonalizedMessage: string;
  messageTone: "supportive" | "motivational" | "informative" | "celebratory" | "empathetic" | "direct";
  nudgeType: string;
  priority: string;
  optimalTiming: {
    preferredTime: string;
    reason: string;
  };
}

export async function generatePersonalizedNudge(
  userId: string,
  nudgeContext: {
    type: string;
    trigger: string;
    targetBehavior?: string;
    relatedGoalId?: string;
    relatedPathwayId?: string;
  }
): Promise<PersonalizedNudgeResult> {
  const context = await getPatientEducationContext(userId);
  const user = await storage.getUser(userId);
  
  const avgSentiment = context.recentSentiments.length > 0
    ? context.recentSentiments.reduce((sum, s) => sum + (s.sentimentScore || 0), 0) / context.recentSentiments.length
    : 0;

  const prompt = `Generate a personalized health nudge/reminder for this patient.

Patient Context:
- Name: ${user?.name?.split(" ")[0] || "Patient"}
- Conditions: ${context.conditions.map(c => c.title).join(", ") || "General wellness"}
- Active Goals: ${context.activeGoals.map(g => g.title).join(", ") || "Stay healthy"}
- Current Pathway: ${context.pathwayDetails.map(p => p.title).join(", ") || "None"}
- Recent Emotional Trend: ${avgSentiment > 20 ? "Positive" : avgSentiment < -20 ? "Struggling" : "Neutral"}
- Recent Sentiments: ${context.recentSentiments.slice(0, 3).map(s => s.sentiment).join(", ") || "Unknown"}

Nudge Request:
- Type: ${nudgeContext.type}
- Trigger: ${nudgeContext.trigger}
- Target Behavior: ${nudgeContext.targetBehavior || "General engagement"}

Generate a personalized nudge as JSON:
{
  "title": "short, attention-grabbing title (max 50 chars)",
  "message": "generic version of the nudge message",
  "aiPersonalizedMessage": "highly personalized message that references patient's specific situation, goals, or progress. Use their name if available. Be warm and supportive.",
  "messageTone": "supportive" | "motivational" | "informative" | "celebratory" | "empathetic" | "direct",
  "nudgeType": "${nudgeContext.type}",
  "priority": "low" | "normal" | "high",
  "optimalTiming": {
    "preferredTime": "morning" | "afternoon" | "evening",
    "reason": "why this timing is optimal"
  }
}

Adapt the tone based on the patient's emotional state. If struggling, be empathetic. If positive, be celebratory.`;

  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compassionate health coach creating personalized nudges. Be warm, supportive, and specific. Avoid generic messages - make each nudge feel personally crafted for the patient."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-education",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    return {
      title: result.title || "Health Reminder",
      message: result.message || "Remember to take care of yourself today!",
      aiPersonalizedMessage: result.aiPersonalizedMessage || result.message || "Keep up the great work!",
      messageTone: result.messageTone || "supportive",
      nudgeType: nudgeContext.type,
      priority: result.priority || "normal",
      optimalTiming: result.optimalTiming || { preferredTime: "morning", reason: "Start the day right" },
    };
  } catch (error) {
    console.error("Error generating personalized nudge:", error);
    return {
      title: "Health Reminder",
      message: "Remember to stay on track with your health goals!",
      aiPersonalizedMessage: "Keep making progress on your health journey!",
      messageTone: "supportive",
      nudgeType: nudgeContext.type,
      priority: "normal",
      optimalTiming: { preferredTime: "morning", reason: "Default timing" },
    };
  }
}

export async function createAndSavePersonalizedNudge(
  userId: string,
  nudgeContext: {
    type: string;
    trigger: string;
    targetBehavior?: string;
    relatedGoalId?: string;
    relatedPathwayId?: string;
  }
): Promise<any> {
  const generated = await generatePersonalizedNudge(userId, nudgeContext);
  const context = await getPatientEducationContext(userId);
  
  const nudgeData: InsertPersonalizedNudge = {
    userId,
    nudgeType: generated.nudgeType,
    triggerType: nudgeContext.trigger,
    title: generated.title,
    message: generated.message,
    aiPersonalizedMessage: generated.aiPersonalizedMessage,
    messageTone: generated.messageTone,
    targetedBehavior: nudgeContext.targetBehavior || null,
    relatedGoalId: nudgeContext.relatedGoalId || null,
    relatedPathwayId: nudgeContext.relatedPathwayId || null,
    sentimentContext: context.recentSentiments.slice(0, 3),
    optimalTiming: generated.optimalTiming,
    priority: generated.priority,
    deliveryChannel: "in_app",
    sentAt: new Date(),
  };

  return storage.createPersonalizedNudge(nudgeData);
}

export async function evaluateQuizAttempt(
  attemptId: string,
  responses: { questionId: string; selectedOption?: string; textResponse?: string }[]
): Promise<{
  score: number;
  maxScore: number;
  percentageScore: number;
  passed: boolean;
  questionResults: {
    questionId: string;
    isCorrect: boolean;
    pointsEarned: number;
    correctAnswer: string;
    explanation: string;
  }[];
}> {
  const attempt = await storage.getQuizAttemptById(attemptId);
  if (!attempt) throw new Error("Quiz attempt not found");
  
  const quiz = await storage.getQuizById(attempt.quizId);
  if (!quiz) throw new Error("Quiz not found");
  
  const questions = await storage.getQuizQuestions(attempt.quizId);
  
  let score = 0;
  let maxScore = 0;
  const questionResults: any[] = [];
  const responsesToSave: any[] = [];

  for (const response of responses) {
    const question = questions.find((q: any) => q.id === response.questionId);
    if (!question) continue;
    
    maxScore += question.points || 10;
    let isCorrect = false;
    let pointsEarned = 0;
    let correctAnswer = "";
    
    const options = question.options as { id: string; text: string; isCorrect: boolean }[];
    const correctOption = options.find(o => o.isCorrect);
    correctAnswer = correctOption?.text || "";
    
    if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
      const selectedOpt = options.find(o => o.id === response.selectedOption);
      isCorrect = selectedOpt?.isCorrect || false;
    } else if (question.questionType === "fill_in_blank") {
      isCorrect = response.textResponse?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
      correctAnswer = question.correctAnswer || "";
    }
    
    if (isCorrect) {
      pointsEarned = question.points || 10;
      score += pointsEarned;
    }
    
    questionResults.push({
      questionId: question.id,
      isCorrect,
      pointsEarned,
      correctAnswer,
      explanation: question.explanation || "",
    });
    
    responsesToSave.push({
      attemptId,
      questionId: question.id,
      selectedOption: response.selectedOption,
      textResponse: response.textResponse,
      isCorrect,
      pointsEarned,
    });
  }

  await storage.createQuizResponses(responsesToSave);
  
  const percentageScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percentageScore >= (quiz.passingScore || 70);
  
  await storage.updateQuizAttempt(attemptId, {
    score,
    maxScore,
    percentageScore,
    passed,
    completedAt: new Date(),
    timeSpent: Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000),
  });

  return { score, maxScore, percentageScore, passed, questionResults };
}
