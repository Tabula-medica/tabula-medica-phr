import { storage } from "./storage";
import type { CarePathway, PathwayStep, PatientPathwayAssignment, HealthRecord, InsertPathwayNudge } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

interface GeneratedPathway {
  title: string;
  description: string;
  targetDurationDays: number;
  difficultyLevel: "beginner" | "standard" | "intensive";
  outcomes: Array<{
    metric: string;
    target: string;
    measurementMethod: string;
  }>;
  phases: Array<{
    name: string;
    durationDays: number;
    steps: Array<{
      title: string;
      description: string;
      stepType: string;
      durationDays: number;
      isMandatory: boolean;
      isMilestone: boolean;
      educationalContent?: {
        title: string;
        body: string;
        contentType: string;
        duration: number;
      };
      taskInstructions?: {
        instructions: string;
        frequency: string;
        targetMetric?: string;
      };
      assessmentQuestions?: Array<{
        question: string;
        type: string;
        options?: string[];
      }>;
      successCriteria: {
        criteriaType: string;
        value: string;
      };
      pointsReward: number;
    }>;
  }>;
  evidenceBase: Array<{
    source: string;
    citation: string;
    relevance: string;
  }>;
}

export async function generateConditionPathway(
  condition: string,
  conditionCode: string | null,
  category: string,
  patientContext?: {
    age?: number;
    severity?: string;
    comorbidities?: string[];
    medications?: string[];
    preferences?: string[];
  }
): Promise<GeneratedPathway> {
  try {
    const contextInfo = patientContext ? `
Patient Context:
- Age: ${patientContext.age || "Unknown"}
- Severity: ${patientContext.severity || "Moderate"}
- Comorbidities: ${patientContext.comorbidities?.join(", ") || "None specified"}
- Current Medications: ${patientContext.medications?.join(", ") || "None specified"}
- Patient Preferences: ${patientContext.preferences?.join(", ") || "None specified"}` : "";

    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a clinical care pathway expert. Generate evidence-based, personalized care pathways for specific medical conditions. 
          
Your pathways should be:
1. Clinically sound and based on current medical guidelines
2. Structured in phases with clear milestones
3. Include education, tasks, assessments, and lifestyle modifications
4. Adaptive to patient needs and progress
5. Include measurable outcomes and success criteria

Response format (JSON):
{
  "title": "Pathway title",
  "description": "Comprehensive description",
  "targetDurationDays": 90,
  "difficultyLevel": "beginner" | "standard" | "intensive",
  "outcomes": [
    {
      "metric": "e.g., HbA1c",
      "target": "e.g., < 7%",
      "measurementMethod": "Lab test every 3 months"
    }
  ],
  "phases": [
    {
      "name": "Phase name",
      "durationDays": 30,
      "steps": [
        {
          "title": "Step title",
          "description": "Detailed description",
          "stepType": "education" | "task" | "assessment" | "appointment" | "medication" | "monitoring" | "lifestyle" | "milestone",
          "durationDays": 7,
          "isMandatory": true,
          "isMilestone": false,
          "educationalContent": { "title": "", "body": "", "contentType": "article|video|interactive", "duration": 10 },
          "taskInstructions": { "instructions": "", "frequency": "daily|weekly|monthly", "targetMetric": "" },
          "assessmentQuestions": [{ "question": "", "type": "scale|multiple_choice|text", "options": [] }],
          "successCriteria": { "criteriaType": "completion|score|metric", "value": "" },
          "pointsReward": 10
        }
      ]
    }
  ],
  "evidenceBase": [
    {
      "source": "Guideline name",
      "citation": "Citation info",
      "relevance": "How it applies"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Generate a comprehensive care pathway for:

Condition: ${condition}
${conditionCode ? `ICD-10/SNOMED Code: ${conditionCode}` : ""}
Category: ${category}
${contextInfo}

Create a detailed, phased pathway with educational content, actionable tasks, regular assessments, and clear milestones. Include evidence-based recommendations.`
        }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-care-pathways",
      callerMethod: "carePathway"});

    const result = JSON.parse(response.content || "{}");
    return result;
  } catch (error) {
    console.error("Error generating condition pathway:", error);
    return getDefaultPathway(condition, category);
  }
}

function getDefaultPathway(condition: string, category: string): GeneratedPathway {
  return {
    title: `${condition} Management Pathway`,
    description: `A structured approach to managing ${condition} with education, monitoring, and lifestyle modifications.`,
    targetDurationDays: 90,
    difficultyLevel: "standard",
    outcomes: [
      { metric: "Symptom Management", target: "Improved symptom control", measurementMethod: "Patient-reported outcomes" }
    ],
    phases: [
      {
        name: "Initial Assessment",
        durationDays: 14,
        steps: [
          {
            title: "Understanding Your Condition",
            description: `Learn about ${condition} and how it affects your health`,
            stepType: "education",
            durationDays: 3,
            isMandatory: true,
            isMilestone: false,
            educationalContent: {
              title: `Introduction to ${condition}`,
              body: `This module covers the basics of ${condition}, including causes, symptoms, and treatment approaches.`,
              contentType: "article",
              duration: 15
            },
            successCriteria: { criteriaType: "completion", value: "100%" },
            pointsReward: 20
          },
          {
            title: "Initial Health Assessment",
            description: "Complete your baseline health assessment",
            stepType: "assessment",
            durationDays: 2,
            isMandatory: true,
            isMilestone: true,
            assessmentQuestions: [
              { question: "Rate your current symptom severity", type: "scale", options: ["1", "2", "3", "4", "5"] },
              { question: "How often do symptoms affect daily activities?", type: "multiple_choice", options: ["Never", "Sometimes", "Often", "Always"] }
            ],
            successCriteria: { criteriaType: "completion", value: "100%" },
            pointsReward: 30
          }
        ]
      },
      {
        name: "Active Management",
        durationDays: 60,
        steps: [
          {
            title: "Daily Monitoring",
            description: "Track your symptoms and vital signs daily",
            stepType: "monitoring",
            durationDays: 60,
            isMandatory: true,
            isMilestone: false,
            taskInstructions: {
              instructions: "Record your symptoms and any relevant measurements each day",
              frequency: "daily",
              targetMetric: "90% completion rate"
            },
            successCriteria: { criteriaType: "metric", value: "90%" },
            pointsReward: 5
          },
          {
            title: "Lifestyle Modifications",
            description: "Implement recommended lifestyle changes",
            stepType: "lifestyle",
            durationDays: 30,
            isMandatory: true,
            isMilestone: false,
            taskInstructions: {
              instructions: "Follow the personalized lifestyle recommendations provided by your care team",
              frequency: "daily"
            },
            successCriteria: { criteriaType: "completion", value: "80%" },
            pointsReward: 25
          }
        ]
      },
      {
        name: "Progress Review",
        durationDays: 16,
        steps: [
          {
            title: "Progress Assessment",
            description: "Evaluate your progress and adjust the care plan",
            stepType: "assessment",
            durationDays: 3,
            isMandatory: true,
            isMilestone: true,
            assessmentQuestions: [
              { question: "How have your symptoms changed?", type: "multiple_choice", options: ["Much Better", "Somewhat Better", "No Change", "Worse"] },
              { question: "Rate your adherence to the care plan", type: "scale", options: ["1", "2", "3", "4", "5"] }
            ],
            successCriteria: { criteriaType: "completion", value: "100%" },
            pointsReward: 50
          },
          {
            title: "Pathway Completion",
            description: "Congratulations on completing the pathway!",
            stepType: "milestone",
            durationDays: 1,
            isMandatory: true,
            isMilestone: true,
            successCriteria: { criteriaType: "completion", value: "100%" },
            pointsReward: 100
          }
        ]
      }
    ],
    evidenceBase: [
      {
        source: "Clinical Practice Guidelines",
        citation: "Based on current medical evidence",
        relevance: "Framework for structured care delivery"
      }
    ]
  };
}

interface AdaptiveContentResult {
  originalContent: object;
  adaptedContent: object;
  adaptationReason: string;
  difficultyAdjustment: number;
  additionalResources?: Array<{
    title: string;
    type: string;
    url?: string;
  }>;
}

export async function generateAdaptiveContent(
  step: PathwayStep,
  patientProgress: {
    adherenceScore: number;
    engagementScore: number;
    assessmentScores: number[];
    completedSteps: number;
    missedSteps: number;
    timeSpentMinutes: number;
  },
  patientConditions: string[],
  patientPreferences?: string[]
): Promise<AdaptiveContentResult> {
  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an adaptive learning specialist for healthcare. Modify educational content and tasks based on patient progress and engagement.

Guidelines:
1. Simplify content for struggling patients (low adherence/engagement)
2. Add depth for high performers
3. Adjust pacing based on time spent
4. Include condition-specific modifications
5. Consider patient preferences

Response format (JSON):
{
  "originalContent": { ... original step content ... },
  "adaptedContent": { ... modified content with adjustments ... },
  "adaptationReason": "Brief explanation of changes",
  "difficultyAdjustment": -1 to 1 (negative = easier, positive = harder),
  "additionalResources": [
    { "title": "Resource name", "type": "video|article|exercise", "url": "" }
  ]
}`
        },
        {
          role: "user",
          content: `Adapt the following pathway step for a patient:

Step Details:
${JSON.stringify(step, null, 2)}

Patient Progress:
- Adherence Score: ${patientProgress.adherenceScore}%
- Engagement Score: ${patientProgress.engagementScore}%
- Average Assessment Score: ${patientProgress.assessmentScores.length > 0 ? (patientProgress.assessmentScores.reduce((a, b) => a + b, 0) / patientProgress.assessmentScores.length).toFixed(0) : "N/A"}%
- Steps Completed: ${patientProgress.completedSteps}
- Steps Missed: ${patientProgress.missedSteps}
- Time Spent: ${patientProgress.timeSpentMinutes} minutes

Patient Conditions: ${patientConditions.join(", ")}
Patient Preferences: ${patientPreferences?.join(", ") || "None specified"}

Generate personalized, adapted content for this patient.`
        }
      ],
      temperature: 0.5,
      jsonMode: true,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-care-pathways",
      callerMethod: "carePathway"});

    const result = JSON.parse(response.content || "{}");
    return result;
  } catch (error) {
    console.error("Error generating adaptive content:", error);
    return {
      originalContent: step.educationalContent || step.taskInstructions || {},
      adaptedContent: step.educationalContent || step.taskInstructions || {},
      adaptationReason: "Unable to generate adaptation - using original content",
      difficultyAdjustment: 0
    };
  }
}

interface NudgeGenerationResult {
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  nudgeType: string;
  suggestedActions?: string[];
}

export async function generatePersonalizedNudge(
  assignment: PatientPathwayAssignment,
  triggerType: string,
  context: {
    stepTitle?: string;
    daysInactive?: number;
    currentStreak?: number;
    recentAchievements?: string[];
    upcomingDeadline?: Date;
    adherenceChange?: number;
  }
): Promise<NudgeGenerationResult> {
  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a supportive healthcare coach generating personalized nudges for patients on care pathways. Your messages should be:

1. Encouraging and empathetic
2. Action-oriented with clear next steps
3. Personalized to the patient's progress
4. Appropriately urgent based on context
5. Brief but meaningful (under 200 characters for the message)

Nudge Types:
- reminder: Gentle prompt about upcoming or overdue tasks
- encouragement: Positive reinforcement for good progress
- warning: Alert about declining adherence or missed milestones
- milestone_celebration: Celebration of achievements
- educational: Helpful tips and information
- check_in: Caring inquiry about wellbeing

Response format (JSON):
{
  "title": "Brief attention-grabbing title",
  "message": "Personalized, actionable message",
  "priority": "low" | "normal" | "high" | "urgent",
  "nudgeType": "one of the types above",
  "suggestedActions": ["Action 1", "Action 2"]
}`
        },
        {
          role: "user",
          content: `Generate a personalized nudge for a patient on a care pathway:

Trigger Type: ${triggerType}
Current Status: ${assignment.status}
Progress: ${assignment.progressPercentage}%
Adherence Score: ${assignment.adherenceScore}%
Engagement Score: ${assignment.engagementScore}%
Steps Completed: ${assignment.stepsCompleted}
Steps Missed: ${assignment.stepsMissed}

Context:
${context.stepTitle ? `- Current Step: ${context.stepTitle}` : ""}
${context.daysInactive ? `- Days Since Last Activity: ${context.daysInactive}` : ""}
${context.currentStreak ? `- Current Streak: ${context.currentStreak} days` : ""}
${context.recentAchievements?.length ? `- Recent Achievements: ${context.recentAchievements.join(", ")}` : ""}
${context.upcomingDeadline ? `- Upcoming Deadline: ${context.upcomingDeadline.toISOString().split("T")[0]}` : ""}
${context.adherenceChange !== undefined ? `- Adherence Change: ${context.adherenceChange > 0 ? "+" : ""}${context.adherenceChange}%` : ""}

Create an appropriate, supportive nudge message.`
        }
      ],
      temperature: 0.6,
      jsonMode: true,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-care-pathways",
      callerMethod: "carePathway"});

    const result = JSON.parse(response.content || "{}");
    return {
      title: result.title || "Health Pathway Update",
      message: result.message || "Stay on track with your care pathway!",
      priority: result.priority || "normal",
      nudgeType: result.nudgeType || "reminder",
      suggestedActions: result.suggestedActions
    };
  } catch (error) {
    console.error("Error generating personalized nudge:", error);
    return getDefaultNudge(triggerType, assignment);
  }
}

function getDefaultNudge(triggerType: string, assignment: PatientPathwayAssignment): NudgeGenerationResult {
  const defaults: Record<string, NudgeGenerationResult> = {
    scheduled: {
      title: "Time for Your Next Step",
      message: "Your care pathway has a new task waiting for you. Take a moment to check it out!",
      priority: "normal",
      nudgeType: "reminder",
      suggestedActions: ["View current step", "Mark as complete"]
    },
    inactivity: {
      title: "We Miss You!",
      message: "It's been a few days since your last activity. Your health journey is waiting for you.",
      priority: "high",
      nudgeType: "check_in",
      suggestedActions: ["Resume pathway", "Take a break"]
    },
    deadline: {
      title: "Deadline Approaching",
      message: "You have a step due soon. Complete it to stay on track!",
      priority: "high",
      nudgeType: "warning",
      suggestedActions: ["Complete step now", "Request extension"]
    },
    achievement: {
      title: "Congratulations!",
      message: `You've completed ${assignment.stepsCompleted} steps! Keep up the great work.`,
      priority: "normal",
      nudgeType: "milestone_celebration",
      suggestedActions: ["View achievements", "Continue pathway"]
    },
    progress_based: {
      title: "Great Progress!",
      message: `You're ${assignment.progressPercentage}% through your pathway. Every step counts!`,
      priority: "low",
      nudgeType: "encouragement",
      suggestedActions: ["View progress", "Next step"]
    }
  };

  return defaults[triggerType] || defaults.scheduled;
}

export async function evaluatePathwayProgress(
  assignment: PatientPathwayAssignment,
  steps: PathwayStep[],
  completedStepIds: string[]
): Promise<{
  overallAssessment: string;
  strengthAreas: string[];
  improvementAreas: string[];
  recommendedActions: string[];
  projectedCompletionDate: Date | null;
  riskLevel: "low" | "medium" | "high";
}> {
  try {
    const completionRate = steps.length > 0 ? (completedStepIds.length / steps.length) * 100 : 0;
    
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare analytics specialist evaluating patient progress on care pathways. Provide insightful, actionable assessments.

Response format (JSON):
{
  "overallAssessment": "Comprehensive assessment of progress",
  "strengthAreas": ["Area 1", "Area 2"],
  "improvementAreas": ["Area 1", "Area 2"],
  "recommendedActions": ["Action 1", "Action 2"],
  "projectedCompletionDays": number or null,
  "riskLevel": "low" | "medium" | "high"
}`
        },
        {
          role: "user",
          content: `Evaluate the following patient pathway progress:

Progress: ${assignment.progressPercentage}%
Adherence Score: ${assignment.adherenceScore}%
Engagement Score: ${assignment.engagementScore}%
Steps Completed: ${completedStepIds.length} of ${steps.length}
Steps Missed: ${assignment.stepsMissed}
Current Phase: ${assignment.currentPhase}
Days Since Start: ${assignment.startDate ? Math.floor((Date.now() - new Date(assignment.startDate).getTime()) / (1000 * 60 * 60 * 24)) : "Not started"}
Total Points Earned: ${assignment.totalPointsEarned}
Completion Rate: ${completionRate.toFixed(1)}%

Step Types Completed: ${steps.filter(s => completedStepIds.includes(s.id)).map(s => s.stepType).join(", ")}

Provide a comprehensive evaluation with actionable recommendations.`
        }
      ],
      temperature: 0.4,
      jsonMode: true,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-care-pathways",
      callerMethod: "carePathway"});

    const result = JSON.parse(response.content || "{}");
    
    return {
      overallAssessment: result.overallAssessment || "Progress evaluation unavailable",
      strengthAreas: result.strengthAreas || [],
      improvementAreas: result.improvementAreas || [],
      recommendedActions: result.recommendedActions || [],
      projectedCompletionDate: result.projectedCompletionDays 
        ? new Date(Date.now() + result.projectedCompletionDays * 24 * 60 * 60 * 1000)
        : null,
      riskLevel: result.riskLevel || "medium"
    };
  } catch (error) {
    console.error("Error evaluating pathway progress:", error);
    return {
      overallAssessment: "Unable to generate detailed assessment",
      strengthAreas: [],
      improvementAreas: [],
      recommendedActions: ["Continue with current pathway activities"],
      projectedCompletionDate: null,
      riskLevel: "medium"
    };
  }
}

export async function processScheduledNudges(): Promise<number> {
  let nudgesSent = 0;
  
  try {
    const activeAssignments = await storage.getActivePathwayAssignments();
    
    for (const assignment of activeAssignments) {
      const lastActivity = assignment.lastActivityAt;
      const now = new Date();
      
      if (lastActivity) {
        const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceActivity >= 3 && daysSinceActivity < 7) {
          const nudge = await generatePersonalizedNudge(assignment, "inactivity", {
            daysInactive: daysSinceActivity
          });
          
          await storage.createPathwayNudge({
            assignmentId: assignment.id,
            nudgeType: nudge.nudgeType,
            triggerType: "inactivity",
            title: nudge.title,
            message: nudge.message,
            aiGeneratedMessage: nudge.message,
            priority: nudge.priority,
            deliveryChannel: "in_app",
            isAiGenerated: true,
            aiContext: { daysInactive: daysSinceActivity }
          });
          nudgesSent++;
        }
      }
      
      if ((assignment.adherenceScore ?? 0) < 50 && !assignment.pausedAt) {
        const nudge = await generatePersonalizedNudge(assignment, "progress_based", {
          adherenceChange: -10
        });
        
        await storage.createPathwayNudge({
          assignmentId: assignment.id,
          nudgeType: "warning",
          triggerType: "progress_based",
          title: nudge.title,
          message: nudge.message,
          aiGeneratedMessage: nudge.message,
          priority: "high",
          deliveryChannel: "in_app",
          isAiGenerated: true,
          aiContext: { adherenceScore: assignment.adherenceScore }
        });
        nudgesSent++;
      }
    }
  } catch (error) {
    console.error("Error processing scheduled nudges:", error);
  }
  
  return nudgesSent;
}
