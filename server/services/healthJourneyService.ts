import type {
  HealthJourneyTemplate,
  HealthJourneyStepTemplate,
  HealthJourneyInstance,
  HealthJourneyStepInstance,
  JourneyReminder,
  JourneyTriggerType,
  JourneyStatus,
  StepStatus,
} from "@shared/schema";

const journeyTemplates: HealthJourneyTemplate[] = [
  {
    id: "journey-hypertension-management",
    name: "Blood Pressure Management Journey",
    description: "A personalized program to help you understand and manage your blood pressure through education, monitoring, and lifestyle tracking.",
    category: "cardiovascular",
    triggerType: "risk_indicator",
    triggerConditions: {
      riskIndicatorTypes: ["blood_pressure_elevated", "blood_pressure_high"],
      vitalTypes: ["blood_pressure"],
      severityThreshold: "moderate",
    },
    estimatedDurationDays: 30,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: "step-bp-intro",
        order: 1,
        type: "education",
        title: "Understanding Your Blood Pressure",
        description: "Learn what blood pressure numbers mean and why monitoring matters.",
        content: {
          educationText: "Blood pressure is measured in two numbers: systolic (top) and diastolic (bottom). The systolic number shows the pressure when your heart beats, while diastolic shows pressure when your heart rests between beats. Normal blood pressure is typically below 120/80 mmHg.",
          educationLinks: [
            { title: "American Heart Association - Understanding Blood Pressure", url: "https://www.heart.org/en/health-topics/high-blood-pressure" },
          ],
        },
        timing: { delayFromPreviousDays: 0, dueWithinDays: 2 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-bp-baseline",
        order: 2,
        type: "data_collection",
        title: "Record Your Baseline",
        description: "Track your blood pressure readings to establish a baseline.",
        dataCollection: {
          fields: [
            { name: "systolic", label: "Systolic (top number)", type: "number", required: true, unit: "mmHg" },
            { name: "diastolic", label: "Diastolic (bottom number)", type: "number", required: true, unit: "mmHg" },
            { name: "pulse", label: "Pulse (if available)", type: "number", required: false, unit: "bpm" },
            { name: "timeOfDay", label: "Time of day", type: "select", options: ["Morning", "Afternoon", "Evening"], required: true },
            { name: "notes", label: "Any notes", type: "text", required: false },
          ],
        },
        timing: { delayFromPreviousDays: 1, reminderIntervalHours: 24, dueWithinDays: 3 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-bp-lifestyle",
        order: 3,
        type: "education",
        title: "Lifestyle Factors",
        description: "Learn about lifestyle factors that affect blood pressure.",
        content: {
          educationText: "Several lifestyle factors can influence your blood pressure: diet (especially sodium intake), physical activity, stress levels, sleep quality, and alcohol consumption. Making small changes in these areas may support healthy blood pressure levels.",
        },
        timing: { delayFromPreviousDays: 3, dueWithinDays: 5 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-bp-checkin-1",
        order: 4,
        type: "check_in",
        title: "Week 1 Check-In",
        description: "How are you feeling about your blood pressure journey so far?",
        dataCollection: {
          fields: [
            { name: "understanding", label: "I feel I understand my blood pressure better", type: "scale", options: ["1", "2", "3", "4", "5"], required: true },
            { name: "challenges", label: "What challenges have you faced?", type: "text", required: false },
            { name: "questions", label: "Any questions for your healthcare provider?", type: "text", required: false },
          ],
        },
        timing: { delayFromPreviousDays: 7, dueWithinDays: 3 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-bp-tracking-2",
        order: 5,
        type: "data_collection",
        title: "Second Reading",
        description: "Continue tracking your blood pressure.",
        dataCollection: {
          fields: [
            { name: "systolic", label: "Systolic (top number)", type: "number", required: true, unit: "mmHg" },
            { name: "diastolic", label: "Diastolic (bottom number)", type: "number", required: true, unit: "mmHg" },
            { name: "pulse", label: "Pulse (if available)", type: "number", required: false, unit: "bpm" },
            { name: "timeOfDay", label: "Time of day", type: "select", options: ["Morning", "Afternoon", "Evening"], required: true },
          ],
        },
        timing: { delayFromPreviousDays: 7, reminderIntervalHours: 24, dueWithinDays: 3 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-bp-milestone",
        order: 6,
        type: "milestone",
        title: "Journey Complete",
        description: "You have completed the Blood Pressure Management Journey!",
        content: {
          milestoneDescription: "You have taken important steps in understanding and monitoring your blood pressure. Continue to track your readings and share them with your healthcare provider at your next visit.",
        },
        timing: { delayFromPreviousDays: 0, dueWithinDays: 7 },
        conditions: { requiresPreviousCompletion: true },
      },
    ],
  },
  {
    id: "journey-diabetes-awareness",
    name: "Blood Sugar Awareness Journey",
    description: "Learn about blood sugar management and track your glucose levels over time.",
    category: "metabolic",
    triggerType: "lab_result",
    triggerConditions: {
      labCodes: ["A1C", "glucose", "fasting_glucose"],
      riskIndicatorTypes: ["glucose_elevated", "a1c_elevated"],
      severityThreshold: "moderate",
    },
    estimatedDurationDays: 21,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: "step-glucose-intro",
        order: 1,
        type: "education",
        title: "Understanding Blood Sugar",
        description: "Learn what blood sugar levels mean for your health.",
        content: {
          educationText: "Blood sugar (glucose) is your body's main source of energy. Your A1C test shows your average blood sugar over the past 2-3 months. Understanding these numbers helps you and your healthcare team make informed decisions.",
        },
        timing: { delayFromPreviousDays: 0, dueWithinDays: 3 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-glucose-tracking",
        order: 2,
        type: "data_collection",
        title: "Track Your Glucose",
        description: "Record a blood sugar reading if you have access to a glucose meter.",
        dataCollection: {
          fields: [
            { name: "glucose", label: "Blood sugar reading", type: "number", required: true, unit: "mg/dL" },
            { name: "mealTiming", label: "When was this reading taken?", type: "select", options: ["Fasting (morning)", "Before meal", "2 hours after meal", "Bedtime"], required: true },
            { name: "date", label: "Date", type: "text", required: true },
          ],
        },
        timing: { delayFromPreviousDays: 2, reminderIntervalHours: 48, dueWithinDays: 5 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-glucose-diet",
        order: 3,
        type: "education",
        title: "Nutrition and Blood Sugar",
        description: "Learn how different foods affect blood sugar levels.",
        content: {
          educationText: "Foods affect blood sugar differently. Carbohydrates have the biggest impact. Understanding which foods contain carbohydrates and how to balance your meals can help you maintain more stable blood sugar levels.",
        },
        timing: { delayFromPreviousDays: 5, dueWithinDays: 4 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-glucose-checkin",
        order: 4,
        type: "check_in",
        title: "Progress Check-In",
        description: "Reflect on what you have learned so far.",
        dataCollection: {
          fields: [
            { name: "confidence", label: "I feel more confident about understanding my blood sugar", type: "scale", options: ["1", "2", "3", "4", "5"], required: true },
            { name: "nextSteps", label: "What would you like to discuss with your healthcare provider?", type: "text", required: false },
          ],
        },
        timing: { delayFromPreviousDays: 7, dueWithinDays: 4 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-glucose-milestone",
        order: 5,
        type: "milestone",
        title: "Journey Complete",
        description: "You have completed the Blood Sugar Awareness Journey!",
        content: {
          milestoneDescription: "You have gained valuable knowledge about blood sugar management. Continue to work with your healthcare team to maintain your progress.",
        },
        timing: { delayFromPreviousDays: 0, dueWithinDays: 7 },
        conditions: { requiresPreviousCompletion: true },
      },
    ],
  },
  {
    id: "journey-medication-adherence",
    name: "New Medication Journey",
    description: "Get started with a new medication safely and learn how to track your experience.",
    category: "medication",
    triggerType: "medication_start",
    triggerConditions: {
      medicationClasses: ["antihypertensive", "statin", "diabetes", "anticoagulant"],
    },
    estimatedDurationDays: 14,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: "step-med-intro",
        order: 1,
        type: "education",
        title: "Getting Started with Your New Medication",
        description: "Important information about starting a new medication.",
        content: {
          educationText: "Starting a new medication is an important step in your health journey. It is normal to have questions. Keep track of how you feel and note any changes to discuss with your healthcare provider.",
        },
        timing: { delayFromPreviousDays: 0, dueWithinDays: 1 },
        conditions: { requiresPreviousCompletion: false },
      },
      {
        id: "step-med-day3",
        order: 2,
        type: "data_collection",
        title: "Day 3 Check-In",
        description: "How are you feeling after a few days?",
        dataCollection: {
          fields: [
            { name: "takingAsDirected", label: "Have you been taking the medication as directed?", type: "boolean", required: true },
            { name: "sideEffects", label: "Have you noticed any side effects?", type: "select", options: ["None", "Mild", "Moderate", "Severe"], required: true },
            { name: "sideEffectDetails", label: "If you had side effects, please describe", type: "text", required: false },
            { name: "questions", label: "Questions for your healthcare provider", type: "text", required: false },
          ],
        },
        timing: { delayFromPreviousDays: 3, reminderIntervalHours: 24, dueWithinDays: 2 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-med-week1",
        order: 3,
        type: "check_in",
        title: "Week 1 Review",
        description: "Reflect on your first week with the new medication.",
        dataCollection: {
          fields: [
            { name: "adherence", label: "How consistently have you taken your medication?", type: "scale", options: ["1", "2", "3", "4", "5"], required: true },
            { name: "overallFeeling", label: "How are you feeling overall?", type: "select", options: ["Much better", "Somewhat better", "About the same", "Somewhat worse", "Much worse"], required: true },
            { name: "barriers", label: "Any barriers to taking your medication?", type: "text", required: false },
          ],
        },
        timing: { delayFromPreviousDays: 4, dueWithinDays: 3 },
        conditions: { requiresPreviousCompletion: true },
      },
      {
        id: "step-med-milestone",
        order: 4,
        type: "milestone",
        title: "First Two Weeks Complete",
        description: "You have completed the initial medication journey!",
        content: {
          milestoneDescription: "You have successfully navigated the first two weeks with your new medication. Continue to take it as directed and discuss any concerns with your healthcare provider at your next visit.",
        },
        timing: { delayFromPreviousDays: 7, dueWithinDays: 7 },
        conditions: { requiresPreviousCompletion: true },
      },
    ],
  },
];

const activeJourneys = new Map<string, HealthJourneyInstance[]>();
const journeyReminders = new Map<string, JourneyReminder[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function getJourneyTemplates(): HealthJourneyTemplate[] {
  return journeyTemplates.filter(t => t.isActive);
}

export function getJourneyTemplateById(templateId: string): HealthJourneyTemplate | undefined {
  return journeyTemplates.find(t => t.id === templateId);
}

export function getMatchingTemplatesForRiskIndicator(
  riskType: string,
  severity: string
): HealthJourneyTemplate[] {
  return journeyTemplates.filter(template => {
    if (!template.isActive) return false;
    if (template.triggerType !== "risk_indicator") return false;
    
    const conditions = template.triggerConditions;
    const matchesType = conditions.riskIndicatorTypes?.includes(riskType);
    const matchesSeverity = !conditions.severityThreshold || 
      compareSeverity(severity, conditions.severityThreshold) >= 0;
    
    return matchesType && matchesSeverity;
  });
}

function compareSeverity(a: string, b: string): number {
  const levels = ["low", "moderate", "elevated", "high", "critical"];
  return levels.indexOf(a) - levels.indexOf(b);
}

export function startJourney(
  userId: string,
  templateId: string,
  triggeredBy: JourneyTriggerType,
  triggerDetails: Record<string, string>
): HealthJourneyInstance {
  const template = getJourneyTemplateById(templateId);
  if (!template) {
    throw new Error(`Journey template ${templateId} not found`);
  }

  const userJourneys = activeJourneys.get(userId) || [];
  const existingJourney = userJourneys.find(
    j => j.templateId === templateId && j.status === "active"
  );
  if (existingJourney) {
    return existingJourney;
  }

  const now = new Date();
  const expectedCompletion = new Date(now);
  expectedCompletion.setDate(expectedCompletion.getDate() + template.estimatedDurationDays);

  const steps: HealthJourneyStepInstance[] = template.steps.map((stepTemplate, index) => {
    const availableAt = new Date(now);
    availableAt.setDate(availableAt.getDate() + stepTemplate.timing.delayFromPreviousDays);
    
    const dueAt = stepTemplate.timing.dueWithinDays
      ? new Date(availableAt.getTime() + stepTemplate.timing.dueWithinDays * 24 * 60 * 60 * 1000)
      : undefined;

    return {
      id: generateId(),
      templateStepId: stepTemplate.id,
      order: stepTemplate.order,
      type: stepTemplate.type,
      title: stepTemplate.title,
      status: index === 0 ? "available" : "pending",
      availableAt: availableAt.toISOString(),
      dueAt: dueAt?.toISOString(),
      remindersSent: 0,
    };
  });

  const journey: HealthJourneyInstance = {
    id: generateId(),
    userId,
    templateId,
    templateName: template.name,
    status: "active",
    triggeredBy,
    triggerDetails,
    startedAt: now.toISOString(),
    expectedCompletionAt: expectedCompletion.toISOString(),
    currentStepIndex: 0,
    progressPercent: 0,
    steps,
  };

  userJourneys.push(journey);
  activeJourneys.set(userId, userJourneys);

  scheduleRemindersForStep(userId, journey.id, steps[0]);

  return journey;
}

export function getActiveJourneys(userId: string): HealthJourneyInstance[] {
  return (activeJourneys.get(userId) || []).filter(j => j.status === "active");
}

export function getAllJourneys(userId: string): HealthJourneyInstance[] {
  return activeJourneys.get(userId) || [];
}

export function getJourneyById(userId: string, journeyId: string): HealthJourneyInstance | undefined {
  const userJourneys = activeJourneys.get(userId) || [];
  return userJourneys.find(j => j.id === journeyId);
}

export function getJourneyWithDetails(
  userId: string,
  journeyId: string
): { journey: HealthJourneyInstance; template: HealthJourneyTemplate } | undefined {
  const journey = getJourneyById(userId, journeyId);
  if (!journey) return undefined;
  
  const template = getJourneyTemplateById(journey.templateId);
  if (!template) return undefined;
  
  return { journey, template };
}

export function completeStep(
  userId: string,
  journeyId: string,
  stepId: string,
  collectedData?: Record<string, string | number | boolean>
): HealthJourneyInstance {
  const userJourneys = activeJourneys.get(userId) || [];
  const journeyIndex = userJourneys.findIndex(j => j.id === journeyId);
  
  if (journeyIndex === -1) {
    throw new Error("Journey not found");
  }

  const journey = userJourneys[journeyIndex];
  const stepIndex = journey.steps.findIndex(s => s.id === stepId);
  
  if (stepIndex === -1) {
    throw new Error("Step not found");
  }

  const step = journey.steps[stepIndex];
  step.status = "completed";
  step.completedAt = new Date().toISOString();
  if (collectedData) {
    step.collectedData = collectedData;
  }

  const completedSteps = journey.steps.filter(s => s.status === "completed").length;
  journey.progressPercent = Math.round((completedSteps / journey.steps.length) * 100);
  journey.currentStepIndex = Math.min(stepIndex + 1, journey.steps.length - 1);

  if (stepIndex + 1 < journey.steps.length) {
    const nextStep = journey.steps[stepIndex + 1];
    const now = new Date();
    const availableAt = new Date(nextStep.availableAt);
    
    if (now >= availableAt) {
      nextStep.status = "available";
      scheduleRemindersForStep(userId, journeyId, nextStep);
    }
  }

  if (completedSteps === journey.steps.length) {
    journey.status = "completed";
    journey.completedAt = new Date().toISOString();
  }

  userJourneys[journeyIndex] = journey;
  activeJourneys.set(userId, userJourneys);

  return journey;
}

export function skipStep(
  userId: string,
  journeyId: string,
  stepId: string
): HealthJourneyInstance {
  const userJourneys = activeJourneys.get(userId) || [];
  const journeyIndex = userJourneys.findIndex(j => j.id === journeyId);
  
  if (journeyIndex === -1) {
    throw new Error("Journey not found");
  }

  const journey = userJourneys[journeyIndex];
  const stepIndex = journey.steps.findIndex(s => s.id === stepId);
  
  if (stepIndex === -1) {
    throw new Error("Step not found");
  }

  const step = journey.steps[stepIndex];
  step.status = "skipped";
  step.skippedAt = new Date().toISOString();

  if (stepIndex + 1 < journey.steps.length) {
    journey.steps[stepIndex + 1].status = "available";
  }

  journey.currentStepIndex = Math.min(stepIndex + 1, journey.steps.length - 1);

  userJourneys[journeyIndex] = journey;
  activeJourneys.set(userId, userJourneys);

  return journey;
}

export function pauseJourney(userId: string, journeyId: string): HealthJourneyInstance {
  const userJourneys = activeJourneys.get(userId) || [];
  const journeyIndex = userJourneys.findIndex(j => j.id === journeyId);
  
  if (journeyIndex === -1) {
    throw new Error("Journey not found");
  }

  const journey = userJourneys[journeyIndex];
  journey.status = "paused";
  journey.pausedAt = new Date().toISOString();

  userJourneys[journeyIndex] = journey;
  activeJourneys.set(userId, userJourneys);

  return journey;
}

export function resumeJourney(userId: string, journeyId: string): HealthJourneyInstance {
  const userJourneys = activeJourneys.get(userId) || [];
  const journeyIndex = userJourneys.findIndex(j => j.id === journeyId);
  
  if (journeyIndex === -1) {
    throw new Error("Journey not found");
  }

  const journey = userJourneys[journeyIndex];
  journey.status = "active";
  journey.pausedAt = undefined;

  userJourneys[journeyIndex] = journey;
  activeJourneys.set(userId, userJourneys);

  return journey;
}

function scheduleRemindersForStep(
  userId: string,
  journeyId: string,
  step: HealthJourneyStepInstance
): void {
  const userReminders = journeyReminders.get(userId) || [];
  
  const reminder: JourneyReminder = {
    id: generateId(),
    userId,
    journeyId,
    stepId: step.id,
    scheduledAt: step.availableAt,
    type: "step_available",
    message: `Your next step is ready: ${step.title}`,
    channel: "in_app",
    status: "scheduled",
  };
  
  userReminders.push(reminder);
  
  if (step.dueAt) {
    const dueReminder: JourneyReminder = {
      id: generateId(),
      userId,
      journeyId,
      stepId: step.id,
      scheduledAt: step.dueAt,
      type: "step_due",
      message: `Reminder: ${step.title} is due soon`,
      channel: "in_app",
      status: "scheduled",
    };
    userReminders.push(dueReminder);
  }
  
  journeyReminders.set(userId, userReminders);
}

export function getUpcomingReminders(userId: string): JourneyReminder[] {
  return (journeyReminders.get(userId) || [])
    .filter(r => r.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export function dismissReminder(userId: string, reminderId: string): void {
  const userReminders = journeyReminders.get(userId) || [];
  const reminderIndex = userReminders.findIndex(r => r.id === reminderId);
  
  if (reminderIndex !== -1) {
    userReminders[reminderIndex].status = "dismissed";
    journeyReminders.set(userId, userReminders);
  }
}

export function checkAndTriggerJourneys(
  userId: string,
  riskIndicators: { type: string; severity: string; category: string }[]
): HealthJourneyInstance[] {
  const triggeredJourneys: HealthJourneyInstance[] = [];
  
  for (const indicator of riskIndicators) {
    const matchingTemplates = getMatchingTemplatesForRiskIndicator(
      indicator.type,
      indicator.severity
    );
    
    for (const template of matchingTemplates) {
      try {
        const journey = startJourney(userId, template.id, "risk_indicator", {
          riskType: indicator.type,
          severity: indicator.severity,
          category: indicator.category,
          triggeredAt: new Date().toISOString(),
        });
        triggeredJourneys.push(journey);
      } catch {
      }
    }
  }
  
  return triggeredJourneys;
}

export function getAllJourneysForAnalytics(): HealthJourneyInstance[] {
  const allJourneys: HealthJourneyInstance[] = [];
  for (const userJourneys of activeJourneys.values()) {
    allJourneys.push(...userJourneys);
  }
  return allJourneys;
}

export function getAllTemplates(): HealthJourneyTemplate[] {
  return journeyTemplates;
}
