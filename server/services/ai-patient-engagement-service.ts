import { logPhiAccess } from "../security/hipaa-audit";
import { generatePhiSafeText } from "./ai-gateway";

export interface PreventiveCareOutreach {
  id: string;
  patientId: string;
  patientName: string;
  type: "screening" | "immunization" | "wellness_visit" | "chronic_care" | "preventive_test";
  guidelineSource: string;
  recommendation: string;
  priority: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  lastCompleted?: string;
  ageGroup: string;
  riskFactors: string[];
  outreachStatus: "pending" | "sent" | "scheduled" | "completed" | "declined";
  aiReasoning: string;
  schedulingLink?: string;
  createdAt: string;
}

export interface PersonalizedEducationContent {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  content: string;
  category: "condition_management" | "medication" | "lifestyle" | "preventive" | "nutrition" | "mental_health" | "procedures";
  readingLevel: "simple" | "intermediate" | "detailed";
  format: "article" | "video" | "infographic" | "checklist" | "faq";
  relevanceScore: number;
  relatedConditions: string[];
  keyTakeaways: string[];
  estimatedReadTime: number;
  delivered: boolean;
  viewed: boolean;
  viewedAt?: string;
  feedbackRating?: number;
  aiPersonalizationNote: string;
  createdAt: string;
}

export interface AppointmentReminder {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  providerName: string;
  location: string;
  reminderType: "initial" | "24_hour" | "1_hour" | "follow_up";
  channel: "sms" | "email" | "push" | "portal";
  message: string;
  aiPersonalizedNote: string;
  sentAt?: string;
  status: "scheduled" | "sent" | "confirmed" | "rescheduled" | "cancelled";
  rescheduleRequested: boolean;
  alternativeSlots?: {
    date: string;
    time: string;
    available: boolean;
  }[];
  createdAt: string;
}

export interface SatisfactionSurvey {
  id: string;
  patientId: string;
  patientName: string;
  visitId: string;
  visitDate: string;
  providerName: string;
  visitType: string;
  surveyType: "post_visit" | "follow_up" | "annual" | "discharge";
  status: "pending" | "sent" | "started" | "completed" | "expired";
  sentAt?: string;
  completedAt?: string;
  questions: SurveyQuestion[];
  responses?: SurveyResponse[];
  overallRating?: number;
  npsScore?: number;
  aiSentimentAnalysis?: {
    sentiment: "positive" | "neutral" | "negative";
    keyThemes: string[];
    improvementSuggestions: string[];
    followUpNeeded: boolean;
  };
  createdAt: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: "rating" | "multiple_choice" | "text" | "yes_no" | "nps";
  required: boolean;
  options?: string[];
  category: "overall" | "provider" | "staff" | "facility" | "wait_time" | "communication" | "follow_up";
}

export interface SurveyResponse {
  questionId: string;
  value: string | number;
  timestamp: string;
}

export interface PatientEngagementDashboard {
  stats: {
    pendingOutreach: number;
    educationDelivered: number;
    upcomingReminders: number;
    surveysCompleted: number;
    avgSatisfactionScore: number;
    responseRate: number;
  };
  recentOutreach: PreventiveCareOutreach[];
  recentEducation: PersonalizedEducationContent[];
  upcomingReminders: AppointmentReminder[];
  recentSurveys: SatisfactionSurvey[];
  aiInsights: {
    type: "trend" | "recommendation" | "alert";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
}

const outreachStore = new Map<string, PreventiveCareOutreach>();
const educationStore = new Map<string, PersonalizedEducationContent>();
const reminderStore = new Map<string, AppointmentReminder>();
const surveyStore = new Map<string, SatisfactionSurvey>();

function initializeSampleData() {
  const outreach: PreventiveCareOutreach[] = [
    {
      id: "out-1",
      patientId: "patient-1",
      patientName: "John Smith",
      type: "screening",
      guidelineSource: "USPSTF Grade A",
      recommendation: "Colorectal cancer screening recommended for adults 45-75",
      priority: "high",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ageGroup: "45-75",
      riskFactors: ["Age 52", "Family history of colon polyps"],
      outreachStatus: "pending",
      aiReasoning: "Based on USPSTF guidelines and patient age (52), colorectal cancer screening is recommended. Family history of colon polyps increases priority.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "out-2",
      patientId: "patient-2",
      patientName: "Sarah Johnson",
      type: "immunization",
      guidelineSource: "CDC ACIP",
      recommendation: "Annual influenza vaccination recommended",
      priority: "medium",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastCompleted: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      ageGroup: "Adult",
      riskFactors: ["Diabetes mellitus", "Age 58"],
      outreachStatus: "sent",
      aiReasoning: "Patient has diabetes which increases flu complications risk. Annual flu shot is especially important for chronic disease management.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "out-3",
      patientId: "patient-3",
      patientName: "Michael Chen",
      type: "wellness_visit",
      guidelineSource: "ACA Preventive Services",
      recommendation: "Annual wellness visit due - comprehensive health assessment",
      priority: "medium",
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      lastCompleted: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      ageGroup: "Adult",
      riskFactors: ["Hypertension", "Overweight"],
      outreachStatus: "pending",
      aiReasoning: "Over 1 year since last wellness visit. Hypertension and weight management benefit from regular monitoring.",
      createdAt: new Date().toISOString(),
    },
  ];

  const education: PersonalizedEducationContent[] = [
    {
      id: "edu-1",
      patientId: "patient-1",
      title: "Understanding Your Colonoscopy: What to Expect",
      summary: "A comprehensive guide to preparing for and understanding your colonoscopy procedure.",
      content: "A colonoscopy is a safe and effective way to screen for colorectal cancer. During the procedure, a doctor uses a thin, flexible tube with a camera to examine your colon...",
      category: "procedures",
      readingLevel: "simple",
      format: "article",
      relevanceScore: 0.95,
      relatedConditions: ["Colorectal cancer screening", "Preventive care"],
      keyTakeaways: [
        "Colonoscopy is the gold standard for colon cancer screening",
        "Preparation involves clear liquids and bowel prep",
        "The procedure typically takes 30-60 minutes",
        "Early detection significantly improves outcomes"
      ],
      estimatedReadTime: 8,
      delivered: true,
      viewed: false,
      aiPersonalizationNote: "Content selected based on upcoming screening recommendation and family history.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "edu-2",
      patientId: "patient-2",
      title: "Diabetes and Flu: Why Vaccination Matters",
      summary: "Learn why flu vaccination is especially important for people with diabetes.",
      content: "If you have diabetes, getting the flu can be more serious than for others. High blood sugar can weaken your immune system...",
      category: "preventive",
      readingLevel: "simple",
      format: "infographic",
      relevanceScore: 0.92,
      relatedConditions: ["Diabetes mellitus", "Immunization"],
      keyTakeaways: [
        "Diabetes increases risk of flu complications",
        "Annual flu shots are strongly recommended",
        "Getting vaccinated protects you and those around you",
        "Best time is early fall before flu season peaks"
      ],
      estimatedReadTime: 5,
      delivered: true,
      viewed: true,
      viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      feedbackRating: 4,
      aiPersonalizationNote: "Tailored content for diabetic patients due for flu vaccination.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "edu-3",
      patientId: "patient-3",
      title: "Managing Hypertension Through Lifestyle Changes",
      summary: "Practical tips for lowering blood pressure naturally through diet and exercise.",
      content: "High blood pressure can often be managed through lifestyle modifications. The DASH diet, regular exercise, and stress management are key components...",
      category: "lifestyle",
      readingLevel: "intermediate",
      format: "checklist",
      relevanceScore: 0.88,
      relatedConditions: ["Hypertension", "Cardiovascular health"],
      keyTakeaways: [
        "DASH diet can lower blood pressure by 8-14 mmHg",
        "30 minutes of daily exercise helps",
        "Reduce sodium intake to less than 2,300mg/day",
        "Stress management techniques are beneficial"
      ],
      estimatedReadTime: 10,
      delivered: false,
      viewed: false,
      aiPersonalizationNote: "Recommended based on hypertension diagnosis and upcoming wellness visit.",
      createdAt: new Date().toISOString(),
    },
  ];

  const reminders: AppointmentReminder[] = [
    {
      id: "rem-1",
      patientId: "patient-1",
      patientName: "John Smith",
      appointmentId: "apt-101",
      appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointmentTime: "10:30 AM",
      appointmentType: "Annual Physical",
      providerName: "Dr. Emily Wilson",
      location: "Main Street Clinic, Suite 200",
      reminderType: "initial",
      channel: "email",
      message: "Your annual physical with Dr. Wilson is coming up. Please arrive 15 minutes early to complete any paperwork.",
      aiPersonalizedNote: "Remember to bring your current medication list and any health concerns you'd like to discuss.",
      status: "scheduled",
      rescheduleRequested: false,
      alternativeSlots: [
        { date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "2:00 PM", available: true },
        { date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "9:00 AM", available: true },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "rem-2",
      patientId: "patient-2",
      patientName: "Sarah Johnson",
      appointmentId: "apt-102",
      appointmentDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointmentTime: "2:15 PM",
      appointmentType: "Diabetes Follow-up",
      providerName: "Dr. Robert Martinez",
      location: "Diabetes Care Center",
      reminderType: "24_hour",
      channel: "sms",
      message: "Reminder: Your diabetes follow-up is tomorrow at 2:15 PM with Dr. Martinez.",
      aiPersonalizedNote: "Please fast for 8 hours before your appointment for accurate lab work.",
      sentAt: new Date().toISOString(),
      status: "sent",
      rescheduleRequested: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "rem-3",
      patientId: "patient-3",
      patientName: "Michael Chen",
      appointmentId: "apt-103",
      appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointmentTime: "11:00 AM",
      appointmentType: "Cardiology Consultation",
      providerName: "Dr. Lisa Thompson",
      location: "Heart Health Center, Floor 3",
      reminderType: "initial",
      channel: "portal",
      message: "Your cardiology consultation is scheduled for next week. Dr. Thompson will review your recent test results.",
      aiPersonalizedNote: "Bring your home blood pressure log if you have one. Wear comfortable clothes for potential cardiac testing.",
      status: "scheduled",
      rescheduleRequested: true,
      alternativeSlots: [
        { date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "9:30 AM", available: true },
        { date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "3:00 PM", available: true },
        { date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "10:00 AM", available: false },
      ],
      createdAt: new Date().toISOString(),
    },
  ];

  const surveys: SatisfactionSurvey[] = [
    {
      id: "srv-1",
      patientId: "patient-4",
      patientName: "Amanda Williams",
      visitId: "visit-201",
      visitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      providerName: "Dr. Emily Wilson",
      visitType: "Primary Care Visit",
      surveyType: "post_visit",
      status: "completed",
      sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date().toISOString(),
      questions: getStandardSurveyQuestions(),
      responses: [
        { questionId: "q1", value: 5, timestamp: new Date().toISOString() },
        { questionId: "q2", value: 5, timestamp: new Date().toISOString() },
        { questionId: "q3", value: 4, timestamp: new Date().toISOString() },
        { questionId: "q4", value: "The staff was very friendly and professional", timestamp: new Date().toISOString() },
        { questionId: "q5", value: 9, timestamp: new Date().toISOString() },
      ],
      overallRating: 4.7,
      npsScore: 9,
      aiSentimentAnalysis: {
        sentiment: "positive",
        keyThemes: ["Professional staff", "Good communication", "Efficient visit"],
        improvementSuggestions: [],
        followUpNeeded: false,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "srv-2",
      patientId: "patient-5",
      patientName: "Robert Davis",
      visitId: "visit-202",
      visitDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      providerName: "Dr. Robert Martinez",
      visitType: "Specialist Consultation",
      surveyType: "post_visit",
      status: "pending",
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      questions: getStandardSurveyQuestions(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "srv-3",
      patientId: "patient-1",
      patientName: "John Smith",
      visitId: "visit-203",
      visitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      providerName: "Dr. Lisa Thompson",
      visitType: "Follow-up Visit",
      surveyType: "follow_up",
      status: "completed",
      sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      questions: getStandardSurveyQuestions(),
      responses: [
        { questionId: "q1", value: 3, timestamp: new Date().toISOString() },
        { questionId: "q2", value: 4, timestamp: new Date().toISOString() },
        { questionId: "q3", value: 2, timestamp: new Date().toISOString() },
        { questionId: "q4", value: "Wait time was longer than expected, but the doctor was thorough", timestamp: new Date().toISOString() },
        { questionId: "q5", value: 6, timestamp: new Date().toISOString() },
      ],
      overallRating: 3.0,
      npsScore: 6,
      aiSentimentAnalysis: {
        sentiment: "neutral",
        keyThemes: ["Wait time concerns", "Thorough examination", "Mixed experience"],
        improvementSuggestions: ["Reduce wait times", "Better scheduling efficiency"],
        followUpNeeded: true,
      },
      createdAt: new Date().toISOString(),
    },
  ];

  outreach.forEach(o => outreachStore.set(o.id, o));
  education.forEach(e => educationStore.set(e.id, e));
  reminders.forEach(r => reminderStore.set(r.id, r));
  surveys.forEach(s => surveyStore.set(s.id, s));
}

function getStandardSurveyQuestions(): SurveyQuestion[] {
  return [
    {
      id: "q1",
      text: "How would you rate your overall experience during this visit?",
      type: "rating",
      required: true,
      category: "overall",
    },
    {
      id: "q2",
      text: "How would you rate the quality of care provided by your healthcare provider?",
      type: "rating",
      required: true,
      category: "provider",
    },
    {
      id: "q3",
      text: "How would you rate the wait time before being seen?",
      type: "rating",
      required: true,
      category: "wait_time",
    },
    {
      id: "q4",
      text: "Please share any additional comments about your experience.",
      type: "text",
      required: false,
      category: "overall",
    },
    {
      id: "q5",
      text: "How likely are you to recommend this healthcare facility to friends or family?",
      type: "nps",
      required: true,
      category: "overall",
    },
  ];
}

initializeSampleData();

export async function getDashboard(): Promise<PatientEngagementDashboard> {
  const outreachList = Array.from(outreachStore.values());
  const educationList = Array.from(educationStore.values());
  const reminderList = Array.from(reminderStore.values());
  const surveyList = Array.from(surveyStore.values());

  const completedSurveys = surveyList.filter(s => s.status === "completed");
  const avgRating = completedSurveys.length > 0
    ? completedSurveys.reduce((sum, s) => sum + (s.overallRating || 0), 0) / completedSurveys.length
    : 0;

  const totalSurveysSent = surveyList.filter(s => s.sentAt).length;
  const responseRate = totalSurveysSent > 0
    ? (completedSurveys.length / totalSurveysSent) * 100
    : 0;

  return {
    stats: {
      pendingOutreach: outreachList.filter(o => o.outreachStatus === "pending").length,
      educationDelivered: educationList.filter(e => e.delivered).length,
      upcomingReminders: reminderList.filter(r => r.status === "scheduled" || r.status === "sent").length,
      surveysCompleted: completedSurveys.length,
      avgSatisfactionScore: Math.round(avgRating * 10) / 10,
      responseRate: Math.round(responseRate),
    },
    recentOutreach: outreachList.slice(0, 5),
    recentEducation: educationList.slice(0, 5),
    upcomingReminders: reminderList.slice(0, 5),
    recentSurveys: surveyList.slice(0, 5),
    aiInsights: [
      {
        type: "trend",
        title: "Patient Engagement Up 15%",
        description: "Education content view rate has increased significantly this month compared to last.",
        priority: "medium",
      },
      {
        type: "alert",
        title: "3 High-Priority Outreach Pending",
        description: "Colorectal screening outreach for high-risk patients needs immediate attention.",
        priority: "high",
      },
      {
        type: "recommendation",
        title: "Optimize Reminder Timing",
        description: "AI analysis suggests sending reminders 48 hours before appointments increases confirmation rates by 23%.",
        priority: "medium",
      },
    ],
  };
}

export async function getPreventiveOutreach(): Promise<PreventiveCareOutreach[]> {
  return Array.from(outreachStore.values());
}

export async function generateProactiveOutreach(patientId: string): Promise<PreventiveCareOutreach> {
  const newOutreach: PreventiveCareOutreach = {
    id: `out-${Date.now()}`,
    patientId,
    patientName: "AI Generated Patient",
    type: "preventive_test",
    guidelineSource: "USPSTF Grade B",
    recommendation: "Lipid panel screening recommended based on cardiovascular risk factors",
    priority: "medium",
    dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    ageGroup: "Adult 40+",
    riskFactors: ["Family history of heart disease", "Sedentary lifestyle"],
    outreachStatus: "pending",
    aiReasoning: "Based on patient profile and USPSTF guidelines, lipid screening is recommended for cardiovascular disease prevention.",
    createdAt: new Date().toISOString(),
  };

  try {
    const aiContent = await generatePhiSafeText({
      system: `You are a preventive care AI assistant generating outreach recommendations.
Generate a personalized preventive care recommendation based on clinical guidelines.
IMPORTANT: This is for INFORMATIONAL purposes only and does not constitute clinical decision support.`,
      user: `Generate a preventive care outreach recommendation for patient ${patientId}.`,
      maxTokens: 500,
    });

    if (aiContent) {
      newOutreach.aiReasoning = aiContent + " [Note: This is for informational purposes only and does not constitute clinical decision support.]";
    }
  } catch (error) {
    console.log("[AIPatientEngagement] AI call failed, using fallback");
  }

  outreachStore.set(newOutreach.id, newOutreach);
  return newOutreach;
}

export async function updateOutreachStatus(id: string, status: PreventiveCareOutreach["outreachStatus"]): Promise<PreventiveCareOutreach | null> {
  const outreach = outreachStore.get(id);
  if (!outreach) return null;
  
  outreach.outreachStatus = status;
  outreachStore.set(id, outreach);
  return outreach;
}

export async function getPersonalizedEducation(): Promise<PersonalizedEducationContent[]> {
  return Array.from(educationStore.values());
}

export async function deliverEducationContent(id: string): Promise<PersonalizedEducationContent | null> {
  const content = educationStore.get(id);
  if (!content) return null;
  
  content.delivered = true;
  educationStore.set(id, content);
  return content;
}

export async function markEducationViewed(id: string): Promise<PersonalizedEducationContent | null> {
  const content = educationStore.get(id);
  if (!content) return null;
  
  content.viewed = true;
  content.viewedAt = new Date().toISOString();
  educationStore.set(id, content);
  return content;
}

export async function rateEducationContent(id: string, rating: number): Promise<PersonalizedEducationContent | null> {
  const content = educationStore.get(id);
  if (!content) return null;
  
  content.feedbackRating = rating;
  educationStore.set(id, content);
  return content;
}

export async function getAppointmentReminders(): Promise<AppointmentReminder[]> {
  return Array.from(reminderStore.values());
}

export async function sendReminder(id: string): Promise<AppointmentReminder | null> {
  const reminder = reminderStore.get(id);
  if (!reminder) return null;
  
  reminder.status = "sent";
  reminder.sentAt = new Date().toISOString();
  reminderStore.set(id, reminder);
  return reminder;
}

export async function confirmAppointment(id: string): Promise<AppointmentReminder | null> {
  const reminder = reminderStore.get(id);
  if (!reminder) return null;
  
  reminder.status = "confirmed";
  reminderStore.set(id, reminder);
  return reminder;
}

export async function requestReschedule(id: string, preferredSlotIndex?: number): Promise<AppointmentReminder | null> {
  const reminder = reminderStore.get(id);
  if (!reminder) return null;
  
  reminder.rescheduleRequested = true;
  
  if (preferredSlotIndex !== undefined && reminder.alternativeSlots && reminder.alternativeSlots[preferredSlotIndex]) {
    const slot = reminder.alternativeSlots[preferredSlotIndex];
    if (slot.available) {
      reminder.appointmentDate = slot.date;
      reminder.appointmentTime = slot.time;
      reminder.status = "rescheduled";
      reminder.rescheduleRequested = false;
    }
  }
  
  reminderStore.set(id, reminder);
  return reminder;
}

export async function getSatisfactionSurveys(): Promise<SatisfactionSurvey[]> {
  return Array.from(surveyStore.values());
}

export async function sendSurvey(id: string): Promise<SatisfactionSurvey | null> {
  const survey = surveyStore.get(id);
  if (!survey) return null;
  
  survey.status = "sent";
  survey.sentAt = new Date().toISOString();
  surveyStore.set(id, survey);
  return survey;
}

export async function submitSurveyResponses(id: string, responses: SurveyResponse[]): Promise<SatisfactionSurvey | null> {
  const survey = surveyStore.get(id);
  if (!survey) return null;
  
  survey.responses = responses;
  survey.status = "completed";
  survey.completedAt = new Date().toISOString();
  
  const ratingResponses = responses.filter(r => typeof r.value === "number" && r.questionId !== "q5");
  if (ratingResponses.length > 0) {
    survey.overallRating = ratingResponses.reduce((sum, r) => sum + (r.value as number), 0) / ratingResponses.length;
  }
  
  const npsResponse = responses.find(r => r.questionId === "q5");
  if (npsResponse && typeof npsResponse.value === "number") {
    survey.npsScore = npsResponse.value;
  }
  
  const textResponse = responses.find(r => r.questionId === "q4");
  survey.aiSentimentAnalysis = await analyzeSurveyFeedback(
    survey.overallRating || 0,
    survey.npsScore || 0,
    textResponse?.value as string || ""
  );
  
  surveyStore.set(id, survey);
  return survey;
}

async function analyzeSurveyFeedback(rating: number, nps: number, comment: string): Promise<SatisfactionSurvey["aiSentimentAnalysis"]> {
  let sentiment: "positive" | "neutral" | "negative";
  if (rating >= 4 && nps >= 8) {
    sentiment = "positive";
  } else if (rating >= 3 && nps >= 6) {
    sentiment = "neutral";
  } else {
    sentiment = "negative";
  }

  const keyThemes: string[] = [];
  const improvementSuggestions: string[] = [];
  let followUpNeeded = false;

  if (comment.toLowerCase().includes("wait")) {
    keyThemes.push("Wait time concerns");
    improvementSuggestions.push("Review scheduling efficiency");
    followUpNeeded = true;
  }
  if (comment.toLowerCase().includes("staff") || comment.toLowerCase().includes("friendly")) {
    keyThemes.push("Staff interactions");
  }
  if (comment.toLowerCase().includes("thorough") || comment.toLowerCase().includes("doctor")) {
    keyThemes.push("Provider quality");
  }
  if (rating < 3) {
    followUpNeeded = true;
    improvementSuggestions.push("Consider patient follow-up call");
  }

  if (keyThemes.length === 0) {
    keyThemes.push("General feedback");
  }

  return {
    sentiment,
    keyThemes,
    improvementSuggestions,
    followUpNeeded,
  };
}

export async function createAutomatedSurvey(visitId: string, patientId: string, patientName: string, providerName: string, visitType: string): Promise<SatisfactionSurvey> {
  const survey: SatisfactionSurvey = {
    id: `srv-${Date.now()}`,
    patientId,
    patientName,
    visitId,
    visitDate: new Date().toISOString(),
    providerName,
    visitType,
    surveyType: "post_visit",
    status: "pending",
    questions: getStandardSurveyQuestions(),
    createdAt: new Date().toISOString(),
  };
  
  surveyStore.set(survey.id, survey);
  return survey;
}

console.log("[AIPatientEngagement] Service initialized with NO-CDS compliance");
console.log("[AIPatientEngagement] Features: Proactive outreach, personalized education, appointment reminders, satisfaction surveys");
