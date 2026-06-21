import OpenAI from "openai";
import {
  NO_CDS_POLICY,
  NO_CDS_DISCLAIMER_SHORT,
  sanitizeNoCDS,
  sanitizeNoCDSObject,
} from "../security/no-cds-guardrails";
import type {
  HealthAssessmentQuestion,
  HealthAssessmentResponse,
  HealthAssessmentAnalysis,
  PatientOnboardingFormData,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AdaptiveQuestionSet {
  questions: HealthAssessmentQuestion[];
  context: string;
  round: number;
  isComplete: boolean;
  disclaimer: string;
}

export interface OnboardingHealthSummary {
  overview: string;
  identifiedConditions: { name: string; notes: string }[];
  riskFactors: { factor: string; level: "low" | "moderate" | "elevated" }[];
  lifestyleObservations: string[];
  dataCompleteness: number;
  disclaimer: string;
  generatedAt: string;
}

export interface OnboardingEducationContent {
  modules: EducationModule[];
  disclaimer: string;
  generatedAt: string;
}

export interface EducationModule {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  relevance: string;
  learnMoreTopics: string[];
}

function buildPreviousAnswersContext(
  responses: HealthAssessmentResponse[],
  questions: HealthAssessmentQuestion[]
): string {
  if (responses.length === 0) return "No previous answers yet.";

  const lines = responses.map((r) => {
    const q = questions.find((q) => q.id === r.questionId);
    const questionText = q?.question || r.questionId;
    const answerText = Array.isArray(r.answer)
      ? r.answer.join(", ")
      : String(r.answer);
    return `Q: ${questionText}\nA: ${answerText}`;
  });
  return lines.join("\n\n");
}

export async function generateInitialQuestions(): Promise<AdaptiveQuestionSet> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${NO_CDS_POLICY}

You are a health information intake assistant. Generate initial health screening questions for a new patient onboarding questionnaire.

Return valid JSON with this structure:
{
  "questions": [
    {
      "id": "q_<unique>",
      "category": "<category>",
      "question": "<question text>",
      "type": "single_choice" | "multiple_choice" | "text" | "scale" | "boolean",
      "options": ["option1", "option2"],
      "scaleMin": 1,
      "scaleMax": 10,
      "scaleLabels": { "min": "Low", "max": "High" },
      "isRequired": true,
      "order": 1
    }
  ],
  "context": "General health intake"
}

Generate 5-6 questions covering: general health status, existing conditions, lifestyle factors, current concerns, and family history patterns.
Use observational, non-prescriptive language. Questions should gather information, not provide guidance.`,
      },
      {
        role: "user",
        content:
          "Generate the initial set of health intake questions for a new patient.",
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const parsed = sanitizeNoCDSObject(
    JSON.parse(response.choices[0]?.message?.content || "{}")
  );

  return {
    questions: (parsed.questions || []).map(
      (q: HealthAssessmentQuestion, i: number) => ({
        ...q,
        id: q.id || `q_initial_${i}`,
        order: q.order || i + 1,
        isRequired: q.isRequired !== false,
      })
    ),
    context: sanitizeNoCDS(parsed.context || "Initial health intake"),
    round: 1,
    isComplete: false,
    disclaimer: NO_CDS_DISCLAIMER_SHORT,
  };
}

export async function generateAdaptiveFollowUpQuestions(
  previousQuestions: HealthAssessmentQuestion[],
  previousResponses: HealthAssessmentResponse[],
  round: number,
  formData?: PatientOnboardingFormData
): Promise<AdaptiveQuestionSet> {
  const previousContext = buildPreviousAnswersContext(
    previousResponses,
    previousQuestions
  );

  const conditionsContext = formData?.medicalHistory?.conditions?.length
    ? `Known conditions: ${formData.medicalHistory.conditions.join(", ")}`
    : "";

  const medicationsContext = formData?.medications?.length
    ? `Current medications: ${formData.medications.map((m) => m.name).join(", ")}`
    : "";

  const allergiesContext = formData?.allergies?.length
    ? `Known allergies: ${formData.allergies.map((a) => a.allergen).join(", ")}`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${NO_CDS_POLICY}

You are a health information intake assistant conducting an adaptive questionnaire. Based on the patient's previous answers, generate targeted follow-up questions that gather more relevant detail.

${conditionsContext}
${medicationsContext}
${allergiesContext}

RULES:
- Questions must be observational and information-gathering only
- Do NOT ask leading questions or imply any clinical guidance
- Adapt question topics based on what the patient has already shared
- Focus on areas where more detail would help build a complete health profile
- If answers indicate specific conditions, ask about related lifestyle factors and history
- If the patient's previous answers are comprehensive enough (round ${round} of max 3), you may indicate completion

Return valid JSON:
{
  "questions": [...],
  "context": "Follow-up context description",
  "isComplete": false
}

Generate 3-5 targeted follow-up questions. Set isComplete to true only if you have gathered sufficient information (usually after round 2-3).`,
      },
      {
        role: "user",
        content: `Round ${round}. Previous answers:\n\n${previousContext}\n\nGenerate follow-up questions based on these answers.`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const parsed = sanitizeNoCDSObject(
    JSON.parse(response.choices[0]?.message?.content || "{}")
  );

  const isComplete = parsed.isComplete === true || round >= 3;

  return {
    questions: (parsed.questions || []).map(
      (q: HealthAssessmentQuestion, i: number) => ({
        ...q,
        id: q.id || `q_round${round}_${i}`,
        order: q.order || i + 1,
        isRequired: q.isRequired !== false,
      })
    ),
    context: sanitizeNoCDS(
      parsed.context || `Follow-up round ${round}`
    ),
    round,
    isComplete,
    disclaimer: NO_CDS_DISCLAIMER_SHORT,
  };
}

export async function generateHealthSummary(
  allQuestions: HealthAssessmentQuestion[],
  allResponses: HealthAssessmentResponse[],
  formData?: PatientOnboardingFormData
): Promise<OnboardingHealthSummary> {
  const answersContext = buildPreviousAnswersContext(
    allResponses,
    allQuestions
  );

  const profileContext = formData
    ? [
        formData.personalInfo
          ? `Name: ${formData.personalInfo.firstName} ${formData.personalInfo.lastName}, DOB: ${formData.personalInfo.dateOfBirth}, Gender: ${formData.personalInfo.gender}`
          : "",
        formData.medicalHistory?.conditions?.length
          ? `Reported conditions: ${formData.medicalHistory.conditions.join(", ")}`
          : "",
        formData.medications?.length
          ? `Medications: ${formData.medications.map((m) => `${m.name} ${m.dosage}`).join(", ")}`
          : "",
        formData.allergies?.length
          ? `Allergies: ${formData.allergies.map((a) => `${a.allergen} (${a.severity})`).join(", ")}`
          : "",
        formData.lifestyle
          ? `Lifestyle: Smoking: ${formData.lifestyle.smokingStatus || "not reported"}, Exercise: ${formData.lifestyle.exerciseFrequency || "not reported"}, Sleep: ${formData.lifestyle.sleepQuality || "not reported"}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${NO_CDS_POLICY}

You are a health data summarization assistant. Create an initial health profile summary based on the patient's questionnaire responses. This is strictly an informational summary of reported data - NOT clinical assessment.

CRITICAL RULES:
- Summarize ONLY what the patient reported
- Use language like "patient reports", "data indicates", "records show"
- NEVER use "recommend", "should", "advise", "diagnose", or prescriptive language
- Do NOT make clinical assessments or prognoses
- Risk factors are statistical observations only, not clinical evaluations

Return valid JSON:
{
  "overview": "Brief summary of reported health profile",
  "identifiedConditions": [{ "name": "condition", "notes": "what patient reported" }],
  "riskFactors": [{ "factor": "factor name", "level": "low|moderate|elevated" }],
  "lifestyleObservations": ["observation1", "observation2"],
  "dataCompleteness": 0.85
}`,
      },
      {
        role: "user",
        content: `Generate a health profile summary from the following patient data:\n\nProfile:\n${profileContext}\n\nQuestionnaire Responses:\n${answersContext}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const parsed = sanitizeNoCDSObject(
    JSON.parse(response.choices[0]?.message?.content || "{}")
  );

  return {
    overview: sanitizeNoCDS(parsed.overview || "Health profile summary based on reported data."),
    identifiedConditions: (parsed.identifiedConditions || []).map(
      (c: { name: string; notes: string }) => ({
        name: sanitizeNoCDS(c.name),
        notes: sanitizeNoCDS(c.notes),
      })
    ),
    riskFactors: (parsed.riskFactors || []).map(
      (r: { factor: string; level: string }) => ({
        factor: sanitizeNoCDS(r.factor),
        level: ["low", "moderate", "elevated"].includes(r.level)
          ? (r.level as "low" | "moderate" | "elevated")
          : "low",
      })
    ),
    lifestyleObservations: (parsed.lifestyleObservations || []).map(
      (o: string) => sanitizeNoCDS(o)
    ),
    dataCompleteness:
      typeof parsed.dataCompleteness === "number"
        ? Math.min(1, Math.max(0, parsed.dataCompleteness))
        : 0.7,
    disclaimer: NO_CDS_DISCLAIMER_SHORT,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateEducationContent(
  healthSummary: OnboardingHealthSummary,
  formData?: PatientOnboardingFormData
): Promise<OnboardingEducationContent> {
  const conditions = healthSummary.identifiedConditions
    .map((c) => c.name)
    .join(", ");

  const riskFactors = healthSummary.riskFactors
    .map((r) => `${r.factor} (${r.level})`)
    .join(", ");

  const lifestyle = healthSummary.lifestyleObservations.join("; ");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `${NO_CDS_POLICY}

You are a health education content generator. Create personalized educational modules for a new patient based on their health profile. Content must be strictly informational and educational.

CRITICAL RULES:
- Content is for EDUCATIONAL purposes only
- NEVER use prescriptive language
- Use "may", "consider learning about", "information suggests" rather than "should", "must", "recommend"
- Each module covers a health topic relevant to the patient's reported profile
- Focus on general health literacy, not clinical guidance

Return valid JSON:
{
  "modules": [
    {
      "id": "edu_<unique>",
      "title": "Module title",
      "category": "condition|lifestyle|prevention|medication|general",
      "summary": "Brief description of what this module covers",
      "keyPoints": ["point1", "point2", "point3"],
      "relevance": "Why this topic may be relevant based on reported data",
      "learnMoreTopics": ["related topic 1", "related topic 2"]
    }
  ]
}

Generate 3-5 modules personalized to the patient's profile.`,
      },
      {
        role: "user",
        content: `Generate personalized education content for a patient with:\nConditions: ${conditions || "none reported"}\nRisk factors: ${riskFactors || "none identified"}\nLifestyle observations: ${lifestyle || "limited data"}\nOverview: ${healthSummary.overview}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 3000,
  });

  const parsed = sanitizeNoCDSObject(
    JSON.parse(response.choices[0]?.message?.content || "{}")
  );

  return {
    modules: (parsed.modules || []).map(
      (m: EducationModule, i: number) => ({
        id: m.id || `edu_${Date.now()}_${i}`,
        title: sanitizeNoCDS(m.title),
        category: m.category || "general",
        summary: sanitizeNoCDS(m.summary),
        keyPoints: (m.keyPoints || []).map((p: string) => sanitizeNoCDS(p)),
        relevance: sanitizeNoCDS(m.relevance),
        learnMoreTopics: (m.learnMoreTopics || []).map((t: string) =>
          sanitizeNoCDS(t)
        ),
      })
    ),
    disclaimer: NO_CDS_DISCLAIMER_SHORT,
    generatedAt: new Date().toISOString(),
  };
}
