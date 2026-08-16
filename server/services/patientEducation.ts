import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import { NO_CDS_DISCLAIMER_SHORT, sanitizeNoCDS, sanitizeNoCDSObject } from "../security/no-cds-guardrails";
import type { Patient, MedicalRecord, Medication, Problem, Allergy } from "@shared/schema";

export interface EducationModule {
  id: string;
  patientId: string;
  title: string;
  category: "condition" | "medication" | "procedure" | "lifestyle" | "prevention";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  sections: EducationSection[];
  relatedConditions: string[];
  relatedMedications: string[];
  completedAt?: string;
  progress: number;
  createdAt: string;
}

export interface EducationSection {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  quiz?: QuizQuestion[];
  completed: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface EducationRecommendation {
  moduleId: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  category: string;
}

interface PatientEducationContext {
  patient: Patient | undefined;
  conditions: MedicalRecord[];
  problems: Problem[];
  medications: Medication[];
  allergies: Allergy[];
}

async function getPatientEducationContext(patientId: string): Promise<PatientEducationContext> {
  const [patient, records, problems, medications, allergies] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getProblemsByPatient ? storage.getProblemsByPatient(patientId) : Promise.resolve([]),
    storage.getMedicationsByPatient(patientId),
    storage.getAllergiesByPatient ? storage.getAllergiesByPatient(patientId) : Promise.resolve([]),
  ]);

  const conditions = records.filter(r => r.type === "diagnosis" && r.status === "active");
  const activeProblems = problems.filter(p => p.status === "active");
  const activeMedications = medications.filter(m => m.status === "active");

  return {
    patient,
    conditions,
    problems: activeProblems,
    medications: activeMedications,
    allergies: allergies.filter(a => a.status === "active"),
  };
}

export async function generatePersonalizedEducation(
  patientId: string,
  topic?: string
): Promise<EducationModule> {
  const context = await getPatientEducationContext(patientId);
  
  const conditionsList = [
    ...context.conditions.map(c => c.title),
    ...context.problems.map(p => p.name),
  ].join(", ");
  
  const medicationsList = context.medications.map(m => `${m.name} (${m.dosage})`).join(", ");
  const allergiesList = context.allergies.map(a => a.name).join(", ");

  const prompt = topic 
    ? `Create personalized education about "${topic}" for a patient with: Conditions: ${conditionsList || "none"}. Medications: ${medicationsList || "none"}. Allergies: ${allergiesList || "none"}.`
    : `Create personalized health education for a patient with: Conditions: ${conditionsList || "none"}. Medications: ${medicationsList || "none"}. Allergies: ${allergiesList || "none"}. Focus on the most important condition or health topic for this patient.`;

  const responseText = await generatePhiSafeText({
    system: `You are a patient education specialist creating personalized health education modules. Create engaging, easy-to-understand content appropriate for patients.

Return a JSON object with:
- title: string (clear, patient-friendly title)
- category: "condition" | "medication" | "procedure" | "lifestyle" | "prevention"
- difficulty: "beginner" | "intermediate" | "advanced" (usually beginner for patients)
- estimatedMinutes: number (5-30 minutes)
- sections: array of 3-5 sections, each with:
  - title: string
  - content: string (2-4 paragraphs of plain-English explanation)
  - keyPoints: string[] (3-5 bullet points)
  - quiz: optional array of 1-2 questions with:
    - question: string
    - options: string[] (4 options)
    - correctIndex: number (0-3)
    - explanation: string (why this is correct)
- relatedConditions: string[] (conditions this relates to)
- relatedMedications: string[] (medications this relates to)

Guidelines:
- Use simple, non-medical language
- Explain medical terms when used
- Focus on practical, actionable information
- Include when to seek medical attention
- Be encouraging and supportive
- Never give specific medical advice - note that consulting healthcare providers is an option
- All content is general health information, not clinical advice
- ${NO_CDS_DISCLAIMER_SHORT}`,
    user: prompt,
    responseMimeType: "application/json",
    maxTokens: 4000,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));

  const moduleId = `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: moduleId,
    patientId,
    title: result.title || "Health Education",
    category: result.category || "condition",
    difficulty: result.difficulty || "beginner",
    estimatedMinutes: result.estimatedMinutes || 10,
    sections: (result.sections || []).map((s: any, idx: number) => ({
      id: `sec_${idx}`,
      title: s.title,
      content: s.content,
      keyPoints: s.keyPoints || [],
      quiz: s.quiz?.map((q: any, qIdx: number) => ({
        id: `q_${qIdx}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
      completed: false,
    })),
    relatedConditions: result.relatedConditions || [],
    relatedMedications: result.relatedMedications || [],
    progress: 0,
    createdAt: new Date().toISOString(),
  };
}

export async function getEducationRecommendations(
  patientId: string
): Promise<EducationRecommendation[]> {
  const context = await getPatientEducationContext(patientId);
  
  const conditionsList = [
    ...context.conditions.map(c => c.title),
    ...context.problems.map(p => p.name),
  ];
  
  const medicationsList = context.medications.map(m => m.name);

  const responseText = await generatePhiSafeText({
    system: `You are a patient education specialist. Based on the patient's conditions and medications, identify relevant general health information topics.

Return a JSON object with:
- recommendations: array of 3-6 education topics, each with:
  - moduleId: string (unique identifier like "edu_diabetes_basics")
  - title: string (patient-friendly title)
  - reason: string (why this topic is relevant for this patient, 1-2 sentences)
  - priority: "high" | "medium" | "low"
  - estimatedMinutes: number (5-30)
  - category: "condition" | "medication" | "procedure" | "lifestyle" | "prevention"

Focus areas:
- General information about their conditions
- Medication safety and adherence information
- Lifestyle information related to their conditions
- Preventive care information appropriate for their situation
- Information about warning signs to be aware of
- ${NO_CDS_DISCLAIMER_SHORT}`,
    user: `Recommend education for a patient with:
Conditions: ${conditionsList.join(", ") || "none listed"}
Medications: ${medicationsList.join(", ") || "none listed"}
Allergies: ${context.allergies.map(a => a.name).join(", ") || "none listed"}`,
    responseMimeType: "application/json",
    maxTokens: 2000,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));
  return result.recommendations || [];
}

export async function explainMedicalTerm(
  term: string,
  patientId?: string
): Promise<{ explanation: string; relatedTerms: string[]; sources: string[] }> {
  let contextInfo = "";
  
  if (patientId) {
    const context = await getPatientEducationContext(patientId);
    const conditions = [...context.conditions.map(c => c.title), ...context.problems.map(p => p.name)];
    if (conditions.length > 0) {
      contextInfo = ` The patient has these conditions: ${conditions.join(", ")}.`;
    }
  }

  const responseText = await generatePhiSafeText({
    system: `You are a medical educator explaining terms to patients in plain English.

Return a JSON object with:
- explanation: string (2-3 paragraphs explaining the term simply, avoiding jargon)
- relatedTerms: string[] (3-5 related medical terms the patient might encounter)
- sources: string[] (2-3 types of reliable sources where they can learn more, like "American Heart Association", "CDC", etc.)

Make the explanation:
- Easy to understand for someone without medical background
- Relevant to the patient's conditions if provided
- Practical and informational where appropriate
- Present as general health information, not clinical advice`,
    user: `Explain the medical term "${term}" in simple terms.${contextInfo}`,
    responseMimeType: "application/json",
    maxTokens: 1500,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));
  return {
    explanation: result.explanation || `${term} is a medical term. Please consult your healthcare provider for more information.`,
    relatedTerms: result.relatedTerms || [],
    sources: result.sources || [],
  };
}

export interface PatientQuestion {
  id: string;
  patientId: string;
  question: string;
  answer: string;
  category: string;
  followUpQuestions: string[];
  relatedTopics: string[];
  disclaimer: string;
  createdAt: string;
}

export interface HealthResource {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "guide" | "infographic" | "tool";
  source: string;
  url?: string;
  relevanceScore: number;
  relevanceReason: string;
  tags: string[];
  readTimeMinutes?: number;
}

export interface ResourceRecommendations {
  patientId: string;
  resources: HealthResource[];
  basedOn: {
    conditions: string[];
    medications: string[];
    recentTopics: string[];
  };
  generatedAt: string;
}

const questionHistory: Map<string, PatientQuestion[]> = new Map();

export async function answerPatientQuestion(
  patientId: string,
  question: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
): Promise<PatientQuestion> {
  const context = await getPatientEducationContext(patientId);
  
  const conditionsList = [
    ...context.conditions.map(c => c.title),
    ...context.problems.map(p => p.name),
  ].join(", ");
  
  const medicationsList = context.medications.map(m => `${m.name} (${m.dosage})`).join(", ");
  const allergiesList = context.allergies.map(a => a.name).join(", ");

  const systemPrompt = `You are a friendly, empathetic health educator helping patients understand their health. Answer questions in simple, everyday language that anyone can understand.

Patient Context:
- Conditions: ${conditionsList || "none listed"}
- Medications: ${medicationsList || "none listed"}  
- Allergies: ${allergiesList || "none listed"}

Guidelines:
1. Use plain language - avoid medical jargon, or explain it if you must use it
2. Be warm and supportive in tone
3. Provide practical, actionable information when appropriate
4. NEVER provide specific medical advice - note that consulting their healthcare provider is an option
5. If the question is about medications, note that discussing changes with their doctor or pharmacist is an option
6. For symptoms or urgent concerns, note that seeking appropriate care (emergency, urgent care, or scheduled visit) is an option to consider
7. Personalize your answer based on their known conditions and medications when relevant

Return a JSON object with:
- answer: string (2-4 paragraphs of clear, helpful information)
- category: string (one of: "medications", "conditions", "symptoms", "lifestyle", "prevention", "treatment", "general")
- followUpQuestions: string[] (2-3 related questions they might want to ask)
- relatedTopics: string[] (2-4 topics they might want to learn more about)
- disclaimer: string (brief reminder about consulting healthcare providers)`;

  const historyText =
    conversationHistory && conversationHistory.length > 0
      ? conversationHistory
          .slice(-6)
          .map((m) => `${m.role === "assistant" ? "Assistant" : "Patient"}: ${m.content}`)
          .join("\n") + "\n"
      : "";

  const userPrompt = `${historyText}Patient: ${question}`;

  const responseText = await generatePhiSafeText({
    system: systemPrompt,
    user: userPrompt,
    responseMimeType: "application/json",
    maxTokens: 2000,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));
  
  const patientQuestion: PatientQuestion = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    question,
    answer: result.answer || "I'm sorry, I couldn't generate an answer. Please try rephrasing your question or consult your healthcare provider.",
    category: result.category || "general",
    followUpQuestions: result.followUpQuestions || [],
    relatedTopics: result.relatedTopics || [],
    disclaimer: result.disclaimer || "This is general health information for educational purposes only. It is not clinical advice. Consult your healthcare provider for personalized guidance.",
    createdAt: new Date().toISOString(),
  };

  const history = questionHistory.get(patientId) || [];
  history.push(patientQuestion);
  if (history.length > 50) history.shift();
  questionHistory.set(patientId, history);

  return patientQuestion;
}

export function getPatientQuestionHistory(patientId: string): PatientQuestion[] {
  return questionHistory.get(patientId) || [];
}

export async function getResourceRecommendations(
  patientId: string
): Promise<ResourceRecommendations> {
  const context = await getPatientEducationContext(patientId);
  const recentQuestions = (questionHistory.get(patientId) || []).slice(-5);
  
  const conditionsList = [
    ...context.conditions.map(c => c.title),
    ...context.problems.map(p => p.name),
  ];
  
  const medicationsList = context.medications.map(m => m.name);
  const recentTopics = recentQuestions.map(q => q.category);

  const responseText = await generatePhiSafeText({
    system: `You are a health resource curator. Based on the patient's health profile, recommend relevant educational resources.

Return a JSON object with:
- resources: array of 6-8 recommended resources, each with:
  - id: string (unique identifier like "res_diabetes_basics")
  - title: string (clear, patient-friendly title)
  - description: string (1-2 sentences about what they'll learn)
  - type: "article" | "video" | "guide" | "infographic" | "tool"
  - source: string (reputable source name like "American Diabetes Association", "CDC", "Mayo Clinic", "NIH", etc.)
  - url: string (realistic example URL from the source - use actual organization domains)
  - relevanceScore: number (0-100, how relevant to this patient)
  - relevanceReason: string (1 sentence explaining why this is recommended)
  - tags: string[] (2-4 topic tags)
  - readTimeMinutes: number (5-30 for articles/guides)

Prioritize resources that:
1. Directly relate to their conditions and medications
2. Cover medication safety and side effects
3. Explain lifestyle modifications for their conditions
4. Are from highly reputable medical sources
5. Are appropriate for patient education (not clinical materials)`,
    user: `Recommend resources for a patient with:
Conditions: ${conditionsList.join(", ") || "none listed"}
Medications: ${medicationsList.join(", ") || "none listed"}
Recent interests: ${recentTopics.join(", ") || "general health"}`,
    responseMimeType: "application/json",
    maxTokens: 3000,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));
  
  return {
    patientId,
    resources: (result.resources || []).map((r: any) => ({
      id: r.id || `res_${Date.now()}`,
      title: r.title,
      description: r.description,
      type: r.type || "article",
      source: r.source,
      url: r.url,
      relevanceScore: r.relevanceScore || 50,
      relevanceReason: r.relevanceReason,
      tags: r.tags || [],
      readTimeMinutes: r.readTimeMinutes,
    })),
    basedOn: {
      conditions: conditionsList,
      medications: medicationsList,
      recentTopics: [...new Set(recentTopics)],
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function generateFAQsForPatient(
  patientId: string
): Promise<{ question: string; answer: string; category: string }[]> {
  const context = await getPatientEducationContext(patientId);
  
  const conditionsList = [
    ...context.conditions.map(c => c.title),
    ...context.problems.map(p => p.name),
  ];
  
  const medicationsList = context.medications.map(m => m.name);

  const responseText = await generatePhiSafeText({
    system: `You are a patient education specialist. Generate personalized FAQs that patients with these specific conditions and medications commonly ask.

Return a JSON object with:
- faqs: array of 8-10 questions and answers, each with:
  - question: string (natural question a patient would ask)
  - answer: string (2-3 sentences of clear, helpful information)
  - category: "medications" | "conditions" | "lifestyle" | "symptoms" | "treatment" | "prevention"

Focus on:
1. How their specific medications work and what to watch for
2. Managing their specific conditions day-to-day
3. Lifestyle changes that help their conditions
4. Warning signs that need medical attention
5. Common concerns patients have about their treatment

Use simple, non-medical language. Be warm and reassuring.`,
    user: `Generate personalized FAQs for a patient with:
Conditions: ${conditionsList.join(", ") || "no specific conditions listed"}
Medications: ${medicationsList.join(", ") || "no medications listed"}`,
    responseMimeType: "application/json",
    maxTokens: 3000,
  });

  const result = sanitizeNoCDSObject(JSON.parse(responseText || "{}"));
  return result.faqs || [];
}
