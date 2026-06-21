import OpenAI from "openai";
import crypto from "crypto";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ContentCategory = "condition" | "medication" | "treatment" | "lifestyle" | "prevention" | "nutrition" | "mental_health" | "emergency";
export type ContentFormat = "article" | "video" | "tutorial" | "quiz" | "infographic" | "interactive";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type TutorialStep = "intro" | "content" | "quiz" | "summary" | "complete";

export interface PatientEducationProfile {
  patientId: string;
  conditions: string[];
  medications: MedicationInfo[];
  riskFactors: string[];
  allergies: string[];
  carePlanGoals: string[];
  treatmentPlans: TreatmentPlanInfo[];
  preferences: EducationPreferences;
  completedModules: string[];
  viewedContent: string[];
  interests: string[];
  lastUpdated: Date;
}

export interface MedicationInfo {
  name: string;
  dosage: string;
  frequency: string;
  purpose: string;
  instructions: string[];
  sideEffects: string[];
  interactions: string[];
}

export interface TreatmentPlanInfo {
  id: string;
  name: string;
  condition: string;
  goals: string[];
  steps: TreatmentStep[];
  duration: string;
  progress: number;
}

export interface TreatmentStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  dueDate?: string;
}

export interface EducationPreferences {
  readingLevel: DifficultyLevel;
  preferredFormats: ContentFormat[];
  preferredLanguage: string;
  sessionDuration: number;
  notificationFrequency: "daily" | "weekly" | "monthly";
}

export interface PersonalizedContent {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  category: ContentCategory;
  format: ContentFormat;
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  content: ContentSection[];
  relatedConditions: string[];
  relatedMedications: string[];
  relevanceScore: number;
  matchReasons: string[];
  createdAt: Date;
  viewedAt?: Date;
  completedAt?: Date;
  helpfulRating?: number;
  noCdsCompliance: string;
}

export interface ContentSection {
  id: string;
  title: string;
  type: "text" | "video" | "image" | "quiz" | "interactive";
  content: string;
  keyPoints: string[];
  mediaUrl?: string;
  quiz?: QuizItem[];
  completed: boolean;
}

export interface QuizItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  selectedIndex?: number;
}

export interface MedicationAdherenceTutorial {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  title: string;
  description: string;
  steps: TutorialStepContent[];
  currentStep: number;
  completedSteps: string[];
  adherenceTips: string[];
  reminderStrategies: string[];
  sideEffectManagement: string[];
  interactionWarnings: string[];
  quizScore?: number;
  completedAt?: Date;
  createdAt: Date;
  noCdsCompliance: string;
}

export interface TutorialStepContent {
  id: string;
  stepNumber: number;
  title: string;
  type: "intro" | "instruction" | "demonstration" | "practice" | "quiz" | "summary";
  content: string;
  visualAid?: string;
  interactiveElement?: InteractiveElement;
  completed: boolean;
}

export interface InteractiveElement {
  type: "drag_drop" | "match" | "fill_blank" | "select" | "sequence";
  instruction: string;
  items: Array<{ id: string; label: string; value: string }>;
  correctAnswer: string[];
  feedback: { correct: string; incorrect: string };
}

export interface TreatmentPlanTutorial {
  id: string;
  patientId: string;
  treatmentPlanId: string;
  treatmentName: string;
  condition: string;
  title: string;
  description: string;
  modules: TreatmentModule[];
  currentModule: number;
  overallProgress: number;
  goalExplanations: GoalExplanation[];
  expectedOutcomes: string[];
  timelineExplanation: string;
  completedAt?: Date;
  createdAt: Date;
  noCdsCompliance: string;
}

export interface TreatmentModule {
  id: string;
  moduleNumber: number;
  title: string;
  objective: string;
  sections: ModuleSection[];
  quiz?: QuizItem[];
  completed: boolean;
  progress: number;
}

export interface ModuleSection {
  id: string;
  title: string;
  content: string;
  visualExplanation?: string;
  practicalTips: string[];
  commonQuestions: Array<{ q: string; a: string }>;
}

export interface GoalExplanation {
  goalId: string;
  goalText: string;
  whyImportant: string;
  howToAchieve: string[];
  progressIndicators: string[];
  expectedTimeline: string;
}

export interface ContentRecommendation {
  id: string;
  patientId: string;
  contentId: string;
  title: string;
  summary: string;
  category: ContentCategory;
  format: ContentFormat;
  relevanceScore: number;
  matchReasons: string[];
  basedOn: "condition" | "medication" | "interest" | "care_plan" | "risk_factor" | "recent_activity";
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  expiresAt?: Date;
  createdAt: Date;
  status: "new" | "viewed" | "dismissed" | "completed";
  noCdsCompliance: string;
}

export interface EducationProgress {
  patientId: string;
  totalModulesCompleted: number;
  totalTimeSpent: number;
  streak: number;
  lastActivityDate: Date;
  categoryProgress: Record<ContentCategory, number>;
  medicationKnowledge: Record<string, number>;
  treatmentUnderstanding: Record<string, number>;
  achievements: Achievement[];
  weeklyGoal: number;
  weeklyProgress: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: Date;
  category: string;
}

const patientProfiles: Map<string, PatientEducationProfile> = new Map();
const personalizedContent: Map<string, PersonalizedContent> = new Map();
const medicationTutorials: Map<string, MedicationAdherenceTutorial> = new Map();
const treatmentTutorials: Map<string, TreatmentPlanTutorial> = new Map();
const recommendations: Map<string, ContentRecommendation[]> = new Map();
const educationProgress: Map<string, EducationProgress> = new Map();

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export class AIPatientEducationHubService {
  
  async getOrCreatePatientProfile(patientId: string): Promise<PatientEducationProfile> {
    let profile = patientProfiles.get(patientId);
    if (!profile) {
      profile = this.createSampleProfile(patientId);
      patientProfiles.set(patientId, profile);
    }
    return profile;
  }

  private createSampleProfile(patientId: string): PatientEducationProfile {
    return {
      patientId,
      conditions: ["Type 2 Diabetes", "Hypertension"],
      medications: [
        {
          name: "Metformin",
          dosage: "500mg",
          frequency: "Twice daily with meals",
          purpose: "Blood sugar control",
          instructions: ["Take with food to reduce stomach upset", "Stay hydrated"],
          sideEffects: ["Nausea", "Stomach upset", "Diarrhea"],
          interactions: ["Alcohol", "Contrast dye for imaging"]
        },
        {
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "Once daily",
          purpose: "Blood pressure control",
          instructions: ["Take at the same time each day", "Monitor for dizziness"],
          sideEffects: ["Dry cough", "Dizziness", "Fatigue"],
          interactions: ["NSAIDs", "Potassium supplements"]
        }
      ],
      riskFactors: ["Family history of heart disease", "Sedentary lifestyle", "Elevated cholesterol"],
      allergies: ["Penicillin"],
      carePlanGoals: ["Maintain A1C below 7%", "Blood pressure under 130/80", "30 minutes daily exercise"],
      treatmentPlans: [
        {
          id: "tp-diabetes-001",
          name: "Diabetes Management Plan",
          condition: "Type 2 Diabetes",
          goals: ["Control blood sugar", "Prevent complications", "Improve diet"],
          steps: [
            { id: "step-1", title: "Daily glucose monitoring", description: "Check blood sugar twice daily", status: "in_progress" },
            { id: "step-2", title: "Medication adherence", description: "Take Metformin as prescribed", status: "in_progress" },
            { id: "step-3", title: "Dietary changes", description: "Reduce carbohydrate intake", status: "pending" }
          ],
          duration: "Ongoing",
          progress: 45
        }
      ],
      preferences: {
        readingLevel: "beginner",
        preferredFormats: ["article", "video", "interactive"],
        preferredLanguage: "en",
        sessionDuration: 15,
        notificationFrequency: "daily"
      },
      completedModules: [],
      viewedContent: [],
      interests: ["nutrition", "exercise", "stress management"],
      lastUpdated: new Date()
    };
  }

  async generatePersonalizedContent(
    patientId: string,
    topic?: string,
    category?: ContentCategory
  ): Promise<PersonalizedContent> {
    const profile = await this.getOrCreatePatientProfile(patientId);
    
    if (openai) {
      return this.generateAIPersonalizedContent(profile, topic, category);
    }
    return this.generateRuleBasedContent(profile, topic, category);
  }

  private async generateAIPersonalizedContent(
    profile: PatientEducationProfile,
    topic?: string,
    category?: ContentCategory
  ): Promise<PersonalizedContent> {
    const contextPrompt = `
Patient Profile:
- Conditions: ${profile.conditions.join(", ")}
- Medications: ${profile.medications.map(m => `${m.name} (${m.dosage})`).join(", ")}
- Risk Factors: ${profile.riskFactors.join(", ")}
- Care Plan Goals: ${profile.carePlanGoals.join(", ")}
- Interests: ${profile.interests.join(", ")}
- Reading Level: ${profile.preferences.readingLevel}
${topic ? `- Requested Topic: ${topic}` : ""}
${category ? `- Category: ${category}` : ""}
`;

    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a patient education specialist. Create personalized health education content based on the patient's profile.

Return JSON with:
{
  "title": "Patient-friendly title",
  "summary": "Brief 2-sentence summary",
  "category": "condition|medication|treatment|lifestyle|prevention|nutrition|mental_health|emergency",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedMinutes": number,
  "sections": [
    {
      "title": "Section title",
      "type": "text",
      "content": "2-4 paragraphs of clear explanation",
      "keyPoints": ["point1", "point2", "point3"]
    }
  ],
  "relatedConditions": ["condition1"],
  "relatedMedications": ["medication1"],
  "matchReasons": ["Why this is relevant to patient"]
}

Guidelines:
- Use simple, non-medical language appropriate for the reading level
- Be encouraging and supportive
- Focus on practical, actionable information
- NEVER provide medical advice or recommendations - only educational information
- Always include a disclaimer that this is educational only`
          },
          { role: "user", content: contextPrompt }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      
      const content: PersonalizedContent = {
        id: generateId("content"),
        patientId: profile.patientId,
        title: parsed.title || "Health Education",
        summary: parsed.summary || "Personalized health information",
        category: parsed.category || "condition",
        format: "article",
        difficulty: parsed.difficulty || "beginner",
        estimatedMinutes: parsed.estimatedMinutes || 10,
        content: (parsed.sections || []).map((s: any, idx: number) => ({
          id: `section-${idx}`,
          title: s.title,
          type: s.type || "text",
          content: s.content,
          keyPoints: s.keyPoints || [],
          completed: false
        })),
        relatedConditions: parsed.relatedConditions || [],
        relatedMedications: parsed.relatedMedications || [],
        relevanceScore: 0.9,
        matchReasons: parsed.matchReasons || ["Based on your health profile"],
        createdAt: new Date(),
        noCdsCompliance: "Educational content only. Not medical advice. Consult your healthcare provider for medical decisions."
      };

      personalizedContent.set(content.id, content);
      return content;
    } catch (error) {
      console.error("AI content generation failed:", error);
      return this.generateRuleBasedContent(profile, topic, category);
    }
  }

  private generateRuleBasedContent(
    profile: PatientEducationProfile,
    topic?: string,
    category?: ContentCategory
  ): PersonalizedContent {
    const primaryCondition = profile.conditions[0] || "General Health";
    const effectiveTopic = topic || primaryCondition;
    const effectiveCategory = category || "condition";

    const contentTemplates: Record<string, { title: string; sections: ContentSection[] }> = {
      "Type 2 Diabetes": {
        title: "Understanding Your Diabetes: A Personal Guide",
        sections: [
          {
            id: "s1",
            title: "What is Type 2 Diabetes?",
            type: "text",
            content: "Type 2 diabetes is a condition where your body doesn't use insulin effectively. Insulin is a hormone that helps sugar (glucose) enter your cells for energy. When you have type 2 diabetes, sugar builds up in your blood instead of being used for energy.\n\nThis doesn't mean you did anything wrong - many factors contribute to diabetes, including genetics and lifestyle. The good news is that with proper management, most people with type 2 diabetes can live healthy, active lives.",
            keyPoints: ["Insulin helps sugar enter cells for energy", "Type 2 diabetes means your body struggles to use insulin", "Management is key to staying healthy"],
            completed: false
          },
          {
            id: "s2",
            title: "Managing Your Blood Sugar",
            type: "text",
            content: "Keeping your blood sugar in a healthy range is the main goal of diabetes management. This involves a combination of healthy eating, regular physical activity, and taking your medications as prescribed.\n\nRegular monitoring helps you understand how different foods, activities, and medications affect your blood sugar. Your healthcare team can help you set personal blood sugar targets.",
            keyPoints: ["Diet, exercise, and medication work together", "Monitor regularly to understand patterns", "Work with your healthcare team on personal goals"],
            completed: false
          },
          {
            id: "s3",
            title: "Healthy Eating Tips",
            type: "text",
            content: "Eating well with diabetes doesn't mean giving up foods you love. It's about making balanced choices. Focus on vegetables, lean proteins, and whole grains. Pay attention to portion sizes, especially for carbohydrates which affect blood sugar the most.\n\nConsider spreading your meals throughout the day rather than eating large portions at once. This helps keep blood sugar more stable.",
            keyPoints: ["Balance is key - you don't have to give up favorite foods", "Watch portion sizes, especially carbohydrates", "Spread meals throughout the day"],
            completed: false
          }
        ]
      },
      "Hypertension": {
        title: "Managing High Blood Pressure: Your Personal Guide",
        sections: [
          {
            id: "s1",
            title: "Understanding Blood Pressure",
            type: "text",
            content: "Blood pressure measures the force of blood pushing against your artery walls. When this pressure stays high over time, it can damage your heart and blood vessels. High blood pressure often has no symptoms, which is why it's called the 'silent killer.'\n\nThe good news is that high blood pressure can be managed effectively with lifestyle changes and medications when needed.",
            keyPoints: ["Blood pressure measures force on artery walls", "Often has no symptoms", "Can be managed with lifestyle and medication"],
            completed: false
          },
          {
            id: "s2",
            title: "Lifestyle Changes That Help",
            type: "text",
            content: "Several lifestyle changes can significantly lower blood pressure. Reducing sodium (salt) intake, maintaining a healthy weight, exercising regularly, limiting alcohol, and managing stress all contribute to better blood pressure control.\n\nEven small changes add up - reducing sodium by just a little or adding a daily walk can make a real difference over time.",
            keyPoints: ["Reduce sodium intake", "Exercise regularly", "Manage stress and weight"],
            completed: false
          }
        ]
      }
    };

    const template = contentTemplates[effectiveTopic] || {
      title: `Understanding ${effectiveTopic}`,
      sections: [
        {
          id: "s1",
          title: `About ${effectiveTopic}`,
          type: "text" as const,
          content: `This educational module provides information about ${effectiveTopic} tailored to your health profile. Understanding your condition is an important step in managing your health effectively.\n\nRemember that this information is for educational purposes only. Always consult with your healthcare provider for personalized medical advice.`,
          keyPoints: ["Knowledge empowers better health management", "This is educational information only", "Consult your healthcare provider for medical advice"],
          completed: false
        }
      ]
    };

    const content: PersonalizedContent = {
      id: generateId("content"),
      patientId: profile.patientId,
      title: template.title,
      summary: `Personalized education about ${effectiveTopic} based on your health profile.`,
      category: effectiveCategory,
      format: "article",
      difficulty: profile.preferences.readingLevel,
      estimatedMinutes: template.sections.length * 5,
      content: template.sections,
      relatedConditions: profile.conditions.filter(c => c.toLowerCase().includes(effectiveTopic.toLowerCase())),
      relatedMedications: profile.medications.map(m => m.name),
      relevanceScore: 0.85,
      matchReasons: [`Based on your condition: ${primaryCondition}`, "Tailored to your reading level"],
      createdAt: new Date(),
      noCdsCompliance: "Educational content only. Not medical advice. Consult your healthcare provider for medical decisions."
    };

    personalizedContent.set(content.id, content);
    return content;
  }

  async generateMedicationAdherenceTutorial(
    patientId: string,
    medicationName: string
  ): Promise<MedicationAdherenceTutorial> {
    const profile = await this.getOrCreatePatientProfile(patientId);
    const medication = profile.medications.find(m => 
      m.name.toLowerCase() === medicationName.toLowerCase()
    ) || profile.medications[0];

    if (openai) {
      return this.generateAIMedicationTutorial(profile, medication);
    }
    return this.generateRuleBasedMedicationTutorial(profile, medication);
  }

  private async generateAIMedicationTutorial(
    profile: PatientEducationProfile,
    medication: MedicationInfo
  ): Promise<MedicationAdherenceTutorial> {
    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Create an interactive medication adherence tutorial. Return JSON with:
{
  "title": "Tutorial title",
  "description": "Brief description",
  "steps": [
    {
      "title": "Step title",
      "type": "intro|instruction|demonstration|practice|quiz|summary",
      "content": "Step content"
    }
  ],
  "adherenceTips": ["tip1", "tip2"],
  "reminderStrategies": ["strategy1", "strategy2"],
  "sideEffectManagement": ["advice1", "advice2"]
}

IMPORTANT: This is EDUCATIONAL only. Never provide medical advice. Focus on practical tips for remembering and taking medication correctly.`
          },
          {
            role: "user",
            content: `Create tutorial for: ${medication.name} (${medication.dosage}), ${medication.frequency}. Purpose: ${medication.purpose}. Patient conditions: ${profile.conditions.join(", ")}.`
          }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      
      const tutorial: MedicationAdherenceTutorial = {
        id: generateId("med-tutorial"),
        patientId: profile.patientId,
        medicationId: generateId("med"),
        medicationName: medication.name,
        title: parsed.title || `Understanding ${medication.name}`,
        description: parsed.description || "Learn how to take your medication effectively",
        steps: (parsed.steps || []).map((s: any, idx: number) => ({
          id: `step-${idx}`,
          stepNumber: idx + 1,
          title: s.title,
          type: s.type || "instruction",
          content: s.content,
          completed: false
        })),
        currentStep: 0,
        completedSteps: [],
        adherenceTips: parsed.adherenceTips || [],
        reminderStrategies: parsed.reminderStrategies || [],
        sideEffectManagement: parsed.sideEffectManagement || [],
        interactionWarnings: medication.interactions,
        createdAt: new Date(),
        noCdsCompliance: "Educational tutorial only. Not medical advice. Follow your healthcare provider's instructions."
      };

      medicationTutorials.set(tutorial.id, tutorial);
      return tutorial;
    } catch (error) {
      console.error("AI medication tutorial generation failed:", error);
      return this.generateRuleBasedMedicationTutorial(profile, medication);
    }
  }

  private generateRuleBasedMedicationTutorial(
    profile: PatientEducationProfile,
    medication: MedicationInfo
  ): MedicationAdherenceTutorial {
    const tutorial: MedicationAdherenceTutorial = {
      id: generateId("med-tutorial"),
      patientId: profile.patientId,
      medicationId: generateId("med"),
      medicationName: medication.name,
      title: `Understanding Your ${medication.name} Medication`,
      description: `Learn how ${medication.name} works and how to take it effectively for better health outcomes.`,
      steps: [
        {
          id: "step-intro",
          stepNumber: 1,
          title: "Introduction",
          type: "intro",
          content: `Welcome to your personalized tutorial for ${medication.name}. This medication is prescribed for ${medication.purpose}. Understanding how and when to take it will help you get the best results. Remember, this tutorial is for educational purposes - always follow your healthcare provider's specific instructions.`,
          completed: false
        },
        {
          id: "step-dosage",
          stepNumber: 2,
          title: "Your Dosage",
          type: "instruction",
          content: `Your prescribed dosage is ${medication.dosage}, taken ${medication.frequency}. Here are important things to remember:\n\n${medication.instructions.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`,
          completed: false
        },
        {
          id: "step-timing",
          stepNumber: 3,
          title: "Best Times to Take It",
          type: "demonstration",
          content: `Timing matters! For ${medication.name}, consistency is key. Try to take it at the same time(s) each day. This helps maintain steady levels in your body and makes it easier to remember.\n\nConsider linking it to a daily routine you already have, like breakfast or brushing your teeth.`,
          completed: false
        },
        {
          id: "step-side-effects",
          stepNumber: 4,
          title: "What to Expect",
          type: "instruction",
          content: `Some people experience side effects when taking ${medication.name}. Common ones include:\n\n${medication.sideEffects.map(se => `• ${se}`).join("\n")}\n\nMost side effects are mild and may decrease over time. If you experience severe or persistent side effects, contact your healthcare provider.`,
          completed: false
        },
        {
          id: "step-quiz",
          stepNumber: 5,
          title: "Check Your Understanding",
          type: "quiz",
          content: "Let's check what you've learned about your medication.",
          interactiveElement: {
            type: "select",
            instruction: `What is the correct dosage for ${medication.name}?`,
            items: [
              { id: "opt-1", label: medication.dosage, value: "correct" },
              { id: "opt-2", label: "As needed", value: "incorrect" },
              { id: "opt-3", label: "Once weekly", value: "incorrect" }
            ],
            correctAnswer: ["correct"],
            feedback: {
              correct: "Correct! You know your dosage well.",
              incorrect: `The correct dosage is ${medication.dosage}, ${medication.frequency}.`
            }
          },
          completed: false
        },
        {
          id: "step-summary",
          stepNumber: 6,
          title: "Summary & Next Steps",
          type: "summary",
          content: `Great job completing this tutorial! Here's what to remember:\n\n• Take ${medication.dosage} ${medication.frequency}\n• Follow the timing tips for best results\n• Know the possible side effects\n• Contact your healthcare provider with questions\n\nConsistency is the key to medication success!`,
          completed: false
        }
      ],
      currentStep: 0,
      completedSteps: [],
      adherenceTips: [
        "Set daily reminders on your phone",
        "Use a pill organizer to track doses",
        "Keep medication in a visible place (but safe from children)",
        "Link taking medication to an existing habit",
        "Don't skip doses even when feeling better"
      ],
      reminderStrategies: [
        "Morning alarm with medication reminder",
        "Pair with meals if appropriate",
        "Use a medication tracking app",
        "Ask a family member to help remind you"
      ],
      sideEffectManagement: medication.sideEffects.map(se => 
        `If you experience ${se.toLowerCase()}, this is often temporary. Stay hydrated and rest if needed.`
      ),
      interactionWarnings: medication.interactions,
      createdAt: new Date(),
      noCdsCompliance: "Educational tutorial only. Not medical advice. Follow your healthcare provider's instructions."
    };

    medicationTutorials.set(tutorial.id, tutorial);
    return tutorial;
  }

  async generateTreatmentPlanTutorial(
    patientId: string,
    treatmentPlanId?: string
  ): Promise<TreatmentPlanTutorial> {
    const profile = await this.getOrCreatePatientProfile(patientId);
    const treatmentPlan = treatmentPlanId 
      ? profile.treatmentPlans.find(tp => tp.id === treatmentPlanId)
      : profile.treatmentPlans[0];

    if (!treatmentPlan) {
      return this.generateGenericTreatmentTutorial(profile);
    }

    if (openai) {
      return this.generateAITreatmentTutorial(profile, treatmentPlan);
    }
    return this.generateRuleBasedTreatmentTutorial(profile, treatmentPlan);
  }

  private async generateAITreatmentTutorial(
    profile: PatientEducationProfile,
    treatmentPlan: TreatmentPlanInfo
  ): Promise<TreatmentPlanTutorial> {
    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Create an educational tutorial explaining a treatment plan. Return JSON with:
{
  "title": "Tutorial title",
  "description": "Brief description",
  "modules": [
    {
      "title": "Module title",
      "objective": "Learning objective",
      "sections": [
        {
          "title": "Section title",
          "content": "Educational content",
          "practicalTips": ["tip1"],
          "commonQuestions": [{"q": "question", "a": "answer"}]
        }
      ]
    }
  ],
  "goalExplanations": [
    {
      "goalText": "Goal",
      "whyImportant": "Explanation",
      "howToAchieve": ["step1"],
      "progressIndicators": ["indicator1"],
      "expectedTimeline": "Timeline"
    }
  ],
  "expectedOutcomes": ["outcome1"],
  "timelineExplanation": "Overall timeline"
}

IMPORTANT: Educational only. Never provide medical advice.`
          },
          {
            role: "user",
            content: `Treatment Plan: ${treatmentPlan.name} for ${treatmentPlan.condition}. Goals: ${treatmentPlan.goals.join(", ")}. Patient conditions: ${profile.conditions.join(", ")}.`
          }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      
      const tutorial: TreatmentPlanTutorial = {
        id: generateId("treatment-tutorial"),
        patientId: profile.patientId,
        treatmentPlanId: treatmentPlan.id,
        treatmentName: treatmentPlan.name,
        condition: treatmentPlan.condition,
        title: parsed.title || `Understanding Your ${treatmentPlan.name}`,
        description: parsed.description || "Learn about your treatment plan",
        modules: (parsed.modules || []).map((m: any, idx: number) => ({
          id: `module-${idx}`,
          moduleNumber: idx + 1,
          title: m.title,
          objective: m.objective,
          sections: (m.sections || []).map((s: any, sidx: number) => ({
            id: `section-${sidx}`,
            title: s.title,
            content: s.content,
            practicalTips: s.practicalTips || [],
            commonQuestions: s.commonQuestions || []
          })),
          completed: false,
          progress: 0
        })),
        currentModule: 0,
        overallProgress: 0,
        goalExplanations: (parsed.goalExplanations || []).map((g: any, idx: number) => ({
          goalId: `goal-${idx}`,
          goalText: g.goalText,
          whyImportant: g.whyImportant,
          howToAchieve: g.howToAchieve || [],
          progressIndicators: g.progressIndicators || [],
          expectedTimeline: g.expectedTimeline
        })),
        expectedOutcomes: parsed.expectedOutcomes || [],
        timelineExplanation: parsed.timelineExplanation || "Your treatment progresses at your own pace.",
        createdAt: new Date(),
        noCdsCompliance: "Educational content about your treatment plan. Not medical advice. Follow your healthcare team's guidance."
      };

      treatmentTutorials.set(tutorial.id, tutorial);
      return tutorial;
    } catch (error) {
      console.error("AI treatment tutorial generation failed:", error);
      return this.generateRuleBasedTreatmentTutorial(profile, treatmentPlan);
    }
  }

  private generateRuleBasedTreatmentTutorial(
    profile: PatientEducationProfile,
    treatmentPlan: TreatmentPlanInfo
  ): TreatmentPlanTutorial {
    const tutorial: TreatmentPlanTutorial = {
      id: generateId("treatment-tutorial"),
      patientId: profile.patientId,
      treatmentPlanId: treatmentPlan.id,
      treatmentName: treatmentPlan.name,
      condition: treatmentPlan.condition,
      title: `Understanding Your ${treatmentPlan.name}`,
      description: `A step-by-step guide to understanding and following your ${treatmentPlan.name} for ${treatmentPlan.condition}.`,
      modules: [
        {
          id: "module-1",
          moduleNumber: 1,
          title: "Overview of Your Treatment Plan",
          objective: "Understand what your treatment plan involves and why it's designed for you",
          sections: [
            {
              id: "sec-1-1",
              title: "What This Plan Is About",
              content: `Your ${treatmentPlan.name} is designed to help you manage ${treatmentPlan.condition} effectively. This plan was created based on your specific health needs and goals.\n\nThe main goals of your plan are:\n${treatmentPlan.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`,
              practicalTips: ["Keep a copy of your goals where you can see them daily", "Track your progress in a journal or app"],
              commonQuestions: [
                { q: "How long will this treatment take?", a: `Treatment duration is ${treatmentPlan.duration}. Your healthcare team will monitor your progress and adjust as needed.` },
                { q: "What if I can't follow every step?", a: "Do your best, and communicate with your healthcare team about any challenges. Plans can be adjusted to fit your situation." }
              ]
            }
          ],
          completed: false,
          progress: 0
        },
        {
          id: "module-2",
          moduleNumber: 2,
          title: "Your Treatment Steps",
          objective: "Learn about each step in your treatment plan",
          sections: treatmentPlan.steps.map((step, idx) => ({
            id: `sec-2-${idx}`,
            title: step.title,
            content: step.description,
            practicalTips: ["Break this step into smaller daily actions", "Celebrate small wins along the way"],
            commonQuestions: [
              { q: `What does ${step.title} involve?`, a: step.description }
            ]
          })),
          completed: false,
          progress: 0
        },
        {
          id: "module-3",
          moduleNumber: 3,
          title: "Staying on Track",
          objective: "Learn strategies for maintaining your treatment plan",
          sections: [
            {
              id: "sec-3-1",
              title: "Tips for Success",
              content: "Consistency is key to treatment success. Here are strategies that help many patients stay on track:\n\n• Set reminders for medications and appointments\n• Keep your healthcare team informed of your progress\n• Reach out when you have questions or concerns\n• Connect with support groups if helpful\n• Celebrate your progress, no matter how small",
              practicalTips: ["Use your phone's calendar for reminders", "Prepare questions before appointments", "Keep a symptom diary"],
              commonQuestions: [
                { q: "What if I miss a step?", a: "Don't worry - just get back on track as soon as you can. Contact your healthcare team if you're unsure what to do." }
              ]
            }
          ],
          completed: false,
          progress: 0
        }
      ],
      currentModule: 0,
      overallProgress: 0,
      goalExplanations: treatmentPlan.goals.map((goal, idx) => ({
        goalId: `goal-${idx}`,
        goalText: goal,
        whyImportant: `This goal helps improve your overall health and manage ${treatmentPlan.condition} effectively.`,
        howToAchieve: ["Follow your treatment steps consistently", "Track your progress regularly", "Communicate with your healthcare team"],
        progressIndicators: ["Regular check-ins with your provider", "Self-monitoring as recommended"],
        expectedTimeline: treatmentPlan.duration
      })),
      expectedOutcomes: [
        "Better understanding of your condition",
        "Improved ability to manage your health",
        "Progress toward your treatment goals",
        "Increased confidence in your health decisions"
      ],
      timelineExplanation: `Your treatment plan spans ${treatmentPlan.duration}. Progress happens at different rates for everyone, so focus on consistent effort rather than speed.`,
      createdAt: new Date(),
      noCdsCompliance: "Educational content about your treatment plan. Not medical advice. Follow your healthcare team's guidance."
    };

    treatmentTutorials.set(tutorial.id, tutorial);
    return tutorial;
  }

  private generateGenericTreatmentTutorial(profile: PatientEducationProfile): TreatmentPlanTutorial {
    const tutorial: TreatmentPlanTutorial = {
      id: generateId("treatment-tutorial"),
      patientId: profile.patientId,
      treatmentPlanId: "generic",
      treatmentName: "General Health Management",
      condition: profile.conditions[0] || "General Health",
      title: "Understanding Health Management",
      description: "Learn the basics of managing your health effectively",
      modules: [
        {
          id: "module-1",
          moduleNumber: 1,
          title: "Health Management Basics",
          objective: "Understand the fundamentals of managing your health",
          sections: [
            {
              id: "sec-1",
              title: "Taking Charge of Your Health",
              content: "Managing your health involves understanding your conditions, following your treatment recommendations, and communicating with your healthcare team. This educational guide will help you learn the basics.",
              practicalTips: ["Keep a list of questions for your doctor", "Track symptoms and changes"],
              commonQuestions: []
            }
          ],
          completed: false,
          progress: 0
        }
      ],
      currentModule: 0,
      overallProgress: 0,
      goalExplanations: [],
      expectedOutcomes: ["Better understanding of health management", "Improved communication with your care team"],
      timelineExplanation: "Health management is an ongoing journey. Take it one step at a time.",
      createdAt: new Date(),
      noCdsCompliance: "Educational content only. Not medical advice. Consult your healthcare provider."
    };

    treatmentTutorials.set(tutorial.id, tutorial);
    return tutorial;
  }

  async generateContentRecommendations(patientId: string): Promise<ContentRecommendation[]> {
    const profile = await this.getOrCreatePatientProfile(patientId);

    if (openai) {
      return this.generateAIRecommendations(profile);
    }
    return this.generateRuleBasedRecommendations(profile);
  }

  private async generateAIRecommendations(profile: PatientEducationProfile): Promise<ContentRecommendation[]> {
    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Generate personalized health education content recommendations. Return JSON array:
[{
  "title": "Content title",
  "summary": "Brief summary",
  "category": "condition|medication|treatment|lifestyle|prevention|nutrition|mental_health",
  "format": "article|video|tutorial|interactive",
  "relevanceScore": 0.0-1.0,
  "matchReasons": ["reason1"],
  "basedOn": "condition|medication|interest|care_plan|risk_factor",
  "estimatedMinutes": number,
  "priority": "high|medium|low"
}]

Generate 5-8 recommendations. Educational content only - no medical advice.`
          },
          {
            role: "user",
            content: `Patient: Conditions: ${profile.conditions.join(", ")}. Medications: ${profile.medications.map(m => m.name).join(", ")}. Interests: ${profile.interests.join(", ")}. Risk factors: ${profile.riskFactors.join(", ")}. Completed: ${profile.completedModules.length} modules.`
          }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      const items = Array.isArray(parsed) ? parsed : (parsed.recommendations || []);
      
      const recs: ContentRecommendation[] = items.map((r: any) => ({
        id: generateId("rec"),
        patientId: profile.patientId,
        contentId: generateId("content"),
        title: r.title,
        summary: r.summary,
        category: r.category || "condition",
        format: r.format || "article",
        relevanceScore: r.relevanceScore || 0.8,
        matchReasons: r.matchReasons || [],
        basedOn: r.basedOn || "condition",
        estimatedMinutes: r.estimatedMinutes || 10,
        priority: r.priority || "medium",
        createdAt: new Date(),
        status: "new",
        noCdsCompliance: "Educational recommendation. Not medical advice."
      }));

      recommendations.set(profile.patientId, recs);
      return recs;
    } catch (error) {
      console.error("AI recommendations failed:", error);
      return this.generateRuleBasedRecommendations(profile);
    }
  }

  private generateRuleBasedRecommendations(profile: PatientEducationProfile): ContentRecommendation[] {
    const recs: ContentRecommendation[] = [];

    profile.conditions.forEach((condition, idx) => {
      recs.push({
        id: generateId("rec"),
        patientId: profile.patientId,
        contentId: generateId("content"),
        title: `Understanding ${condition}`,
        summary: `Learn about ${condition}, including what it means for your health and how to manage it effectively.`,
        category: "condition",
        format: "article",
        relevanceScore: 0.95 - (idx * 0.05),
        matchReasons: [`Based on your diagnosis of ${condition}`],
        basedOn: "condition",
        estimatedMinutes: 10,
        priority: idx === 0 ? "high" : "medium",
        createdAt: new Date(),
        status: "new",
        noCdsCompliance: "Educational recommendation. Not medical advice."
      });
    });

    profile.medications.forEach((med, idx) => {
      recs.push({
        id: generateId("rec"),
        patientId: profile.patientId,
        contentId: generateId("content"),
        title: `Your Guide to ${med.name}`,
        summary: `Everything you need to know about taking ${med.name} safely and effectively.`,
        category: "medication",
        format: "tutorial",
        relevanceScore: 0.9 - (idx * 0.05),
        matchReasons: [`You are currently taking ${med.name}`],
        basedOn: "medication",
        estimatedMinutes: 8,
        priority: "high",
        createdAt: new Date(),
        status: "new",
        noCdsCompliance: "Educational recommendation. Not medical advice."
      });
    });

    profile.interests.forEach((interest, idx) => {
      recs.push({
        id: generateId("rec"),
        patientId: profile.patientId,
        contentId: generateId("content"),
        title: `${interest.charAt(0).toUpperCase() + interest.slice(1)} for Better Health`,
        summary: `Discover how ${interest} can support your health goals.`,
        category: interest.includes("nutrition") ? "nutrition" : interest.includes("stress") ? "mental_health" : "lifestyle",
        format: idx % 2 === 0 ? "video" : "article",
        relevanceScore: 0.75,
        matchReasons: [`Based on your interest in ${interest}`],
        basedOn: "interest",
        estimatedMinutes: 12,
        priority: "medium",
        createdAt: new Date(),
        status: "new",
        noCdsCompliance: "Educational recommendation. Not medical advice."
      });
    });

    profile.riskFactors.forEach((risk, idx) => {
      recs.push({
        id: generateId("rec"),
        patientId: profile.patientId,
        contentId: generateId("content"),
        title: `Managing ${risk}`,
        summary: `Learn strategies to address ${risk.toLowerCase()} and improve your health outcomes.`,
        category: "prevention",
        format: "interactive",
        relevanceScore: 0.85,
        matchReasons: [`Identified risk factor: ${risk}`],
        basedOn: "risk_factor",
        estimatedMinutes: 15,
        priority: idx === 0 ? "high" : "medium",
        createdAt: new Date(),
        status: "new",
        noCdsCompliance: "Educational recommendation. Not medical advice."
      });
    });

    recommendations.set(profile.patientId, recs);
    return recs.slice(0, 8);
  }

  async updateTutorialProgress(
    tutorialId: string,
    stepId: string,
    type: "medication" | "treatment"
  ): Promise<{ success: boolean; tutorial?: MedicationAdherenceTutorial | TreatmentPlanTutorial }> {
    if (type === "medication") {
      const tutorial = medicationTutorials.get(tutorialId);
      if (!tutorial) return { success: false };

      const step = tutorial.steps.find(s => s.id === stepId);
      if (step) {
        step.completed = true;
        tutorial.completedSteps.push(stepId);
        tutorial.currentStep = Math.min(tutorial.currentStep + 1, tutorial.steps.length - 1);
        
        if (tutorial.completedSteps.length === tutorial.steps.length) {
          tutorial.completedAt = new Date();
        }
        medicationTutorials.set(tutorialId, tutorial);
      }
      return { success: true, tutorial };
    } else {
      const tutorial = treatmentTutorials.get(tutorialId);
      if (!tutorial) return { success: false };

      tutorial.modules.forEach(module => {
        module.sections.forEach(section => {
          if (section.id === stepId) {
            module.progress = Math.min(module.progress + (100 / module.sections.length), 100);
            if (module.progress >= 100) {
              module.completed = true;
            }
          }
        });
      });

      const completedModules = tutorial.modules.filter(m => m.completed).length;
      tutorial.overallProgress = (completedModules / tutorial.modules.length) * 100;
      
      if (tutorial.overallProgress >= 100) {
        tutorial.completedAt = new Date();
      }
      
      treatmentTutorials.set(tutorialId, tutorial);
      return { success: true, tutorial };
    }
  }

  async getPatientProgress(patientId: string): Promise<EducationProgress> {
    let progress = educationProgress.get(patientId);
    if (!progress) {
      progress = {
        patientId,
        totalModulesCompleted: 3,
        totalTimeSpent: 45,
        streak: 5,
        lastActivityDate: new Date(),
        categoryProgress: {
          condition: 60,
          medication: 75,
          treatment: 40,
          lifestyle: 30,
          prevention: 20,
          nutrition: 45,
          mental_health: 15,
          emergency: 10
        },
        medicationKnowledge: {},
        treatmentUnderstanding: {},
        achievements: [
          {
            id: "ach-1",
            title: "First Steps",
            description: "Completed your first education module",
            icon: "trophy",
            earnedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            category: "milestone"
          },
          {
            id: "ach-2",
            title: "Knowledge Seeker",
            description: "Viewed 5 educational articles",
            icon: "book",
            earnedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            category: "engagement"
          }
        ],
        weeklyGoal: 30,
        weeklyProgress: 15
      };
      educationProgress.set(patientId, progress);
    }
    return progress;
  }

  getPersonalizedContent(contentId: string): PersonalizedContent | undefined {
    return personalizedContent.get(contentId);
  }

  getMedicationTutorial(tutorialId: string): MedicationAdherenceTutorial | undefined {
    return medicationTutorials.get(tutorialId);
  }

  getTreatmentTutorial(tutorialId: string): TreatmentPlanTutorial | undefined {
    return treatmentTutorials.get(tutorialId);
  }

  getPatientRecommendations(patientId: string): ContentRecommendation[] {
    return recommendations.get(patientId) || [];
  }

  async updateRecommendationStatus(
    patientId: string,
    recommendationId: string,
    status: "viewed" | "dismissed" | "completed"
  ): Promise<boolean> {
    const recs = recommendations.get(patientId);
    if (!recs) return false;

    const rec = recs.find(r => r.id === recommendationId);
    if (rec) {
      rec.status = status;
      return true;
    }
    return false;
  }
}

export const aiPatientEducationHubService = new AIPatientEducationHubService();
