import OpenAI from "openai";
import { generatePhiSafeText } from "./services/ai-gateway";
import { storage } from "./storage";
import type { 
  AssistantMessage, 
  SuggestedQuestion,
  Medication,
  Allergy,
  Problem,
  LabResult,
  MedicalRecord
} from "@shared/schema";
import { logAuditEntry } from "./explainability";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PatientHealthContext {
  medications: Medication[];
  allergies: Allergy[];
  conditions: Problem[];
  labResults: LabResult[];
  recentRecords: MedicalRecord[];
  patientName?: string;
  patientAge?: number;
}

export interface AssistantResponse {
  content: string;
  metadata: {
    healthContext?: {
      medicationsReferenced?: string[];
      conditionsReferenced?: string[];
      labResultsReferenced?: string[];
      allergiesReferenced?: string[];
    };
    explainability?: {
      insightType: string;
      confidence: number;
      sources: string[];
      reasoning: string[];
    };
    language?: string;
  };
}

const MEDICAL_ASSISTANT_SYSTEM_PROMPT = `You are a friendly and knowledgeable AI Medical Assistant for Tabula Medica, a patient health record application. Your role is to help patients understand their health information in plain, everyday language.

IMPORTANT GUIDELINES:
1. EDUCATIONAL ONLY: You provide educational information only, never medical advice or diagnoses
2. PATIENT-FRIENDLY: Use simple, everyday language - avoid medical jargon unless explaining it
3. SUPPORTIVE: Be warm, empathetic, and encouraging
4. TRANSPARENT: Always explain where your information comes from
5. SAFE: If asked about symptoms or treatment, encourage consulting a healthcare provider
6. PERSONALIZED: Reference the patient's specific health data when relevant

What you CAN do:
- Explain medical terms and test results in plain English
- Help patients understand their medications and what they're for
- Summarize health information from their records
- Answer general health education questions
- Help patients prepare questions for their doctor visits
- Explain what lab values mean in general terms

What you should NOT do:
- Provide medical diagnoses or treatment recommendations
- Suggest changing medications or dosages
- Interpret symptoms as specific conditions
- Make predictions about health outcomes
- Replace professional medical advice

Always end complex explanations with a gentle reminder to discuss with their healthcare provider.`;

export async function getPatientHealthContext(patientId: string): Promise<PatientHealthContext> {
  const [medications, allergies, conditions, labResults, recentRecords] = await Promise.all([
    storage.getMedicationsByPatient(patientId),
    storage.getAllergiesByPatient(patientId),
    storage.getProblemsByPatient(patientId),
    storage.getLabResultsByPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
  ]);

  return {
    medications: medications.slice(0, 20),
    allergies: allergies.slice(0, 10),
    conditions: conditions.slice(0, 15),
    labResults: labResults.slice(0, 15),
    recentRecords: recentRecords
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
  };
}

function buildHealthContextPrompt(context: PatientHealthContext): string {
  const sections: string[] = [];

  if (context.medications.length > 0) {
    const medList = context.medications
      .map(m => `- ${m.name} (${m.dosage || 'dosage not specified'}, ${m.frequency || 'frequency not specified'})`)
      .join('\n');
    sections.push(`CURRENT MEDICATIONS:\n${medList}`);
  }

  if (context.allergies.length > 0) {
    const allergyList = context.allergies
      .map(a => `- ${a.name}: ${a.reaction || 'reaction not specified'} (Severity: ${a.severity || 'unknown'})`)
      .join('\n');
    sections.push(`KNOWN ALLERGIES:\n${allergyList}`);
  }

  if (context.conditions.length > 0) {
    const conditionList = context.conditions
      .map(c => `- ${c.name} (Status: ${c.status || 'active'})${c.onsetDate ? ` - Onset: ${c.onsetDate}` : ''}`)
      .join('\n');
    sections.push(`HEALTH CONDITIONS:\n${conditionList}`);
  }

  if (context.labResults.length > 0) {
    const labList = context.labResults
      .slice(0, 10)
      .map(l => `- ${l.testName}: ${l.value} ${l.unit || ''} (${l.status || 'pending'}) - ${l.date}`)
      .join('\n');
    sections.push(`RECENT LAB RESULTS:\n${labList}`);
  }

  if (context.recentRecords.length > 0) {
    const recordList = context.recentRecords
      .slice(0, 5)
      .map(r => `- ${r.type}: ${r.title || r.description?.slice(0, 50) || 'No description'} - ${r.date}`)
      .join('\n');
    sections.push(`RECENT MEDICAL RECORDS:\n${recordList}`);
  }

  if (sections.length === 0) {
    return "No health records available for this patient.";
  }

  return `PATIENT HEALTH CONTEXT:\n\n${sections.join('\n\n')}`;
}

function extractReferencedHealthData(
  response: string, 
  context: PatientHealthContext
): AssistantResponse['metadata']['healthContext'] {
  const healthContext: AssistantResponse['metadata']['healthContext'] = {};
  const responseLower = response.toLowerCase();

  const referencedMeds = context.medications
    .filter(m => responseLower.includes(m.name.toLowerCase()))
    .map(m => m.name);
  if (referencedMeds.length > 0) {
    healthContext.medicationsReferenced = referencedMeds;
  }

  const referencedConditions = context.conditions
    .filter(c => responseLower.includes(c.name.toLowerCase()))
    .map(c => c.name);
  if (referencedConditions.length > 0) {
    healthContext.conditionsReferenced = referencedConditions;
  }

  const referencedLabs = context.labResults
    .filter(l => responseLower.includes(l.testName.toLowerCase()))
    .map(l => l.testName);
  if (referencedLabs.length > 0) {
    healthContext.labResultsReferenced = referencedLabs;
  }

  const referencedAllergies = context.allergies
    .filter(a => responseLower.includes(a.name.toLowerCase()))
    .map(a => a.name);
  if (referencedAllergies.length > 0) {
    healthContext.allergiesReferenced = referencedAllergies;
  }

  return Object.keys(healthContext).length > 0 ? healthContext : undefined;
}

export async function generateAssistantResponse(
  userMessage: string,
  conversationHistory: AssistantMessage[],
  healthContext: PatientHealthContext,
  options: {
    userId?: string;
    patientId?: string;
    language?: string;
  } = {}
): Promise<AssistantResponse> {
  const startTime = Date.now();
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: MEDICAL_ASSISTANT_SYSTEM_PROMPT },
    { role: "system", content: buildHealthContextPrompt(healthContext) },
  ];

  if (options.language && options.language !== 'en') {
    messages.push({
      role: "system",
      content: `The patient prefers to communicate in ${options.language}. Please respond in that language while maintaining all safety guidelines.`
    });
  }

  for (const msg of conversationHistory.slice(-10)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages,
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
    const processingTime = Date.now() - startTime;

    const extractedContext = extractReferencedHealthData(content, healthContext);

    const sources: string[] = [];
    if (extractedContext?.medicationsReferenced?.length) sources.push('medications');
    if (extractedContext?.conditionsReferenced?.length) sources.push('conditions');
    if (extractedContext?.labResultsReferenced?.length) sources.push('lab_results');
    if (extractedContext?.allergiesReferenced?.length) sources.push('allergies');

    logAuditEntry({
      insightId: `assistant-${Date.now()}`,
      insightType: "medical_assistant_response",
      patientId: options.patientId || "unknown",
      userId: options.userId,
      userRole: "patient",
      action: "insight_generated",
      details: {
        messageLength: content.length,
        processingTimeMs: processingTime,
        sourcesUsed: sources,
        language: options.language || 'en',
      },
    });

    return {
      content,
      metadata: {
        healthContext: extractedContext,
        explainability: {
          insightType: "personalized_health_insight",
          confidence: sources.length > 0 ? 0.85 : 0.7,
          sources: sources.length > 0 ? sources : ['general_knowledge'],
          reasoning: [
            "Analyzed patient's health records for context",
            "Applied educational-only guidelines",
            "Generated personalized response based on available data",
          ],
        },
        language: options.language,
      },
    };
  } catch (error) {
    console.error("Error generating assistant response:", error);
    throw error;
  }
}

export interface StreamResult {
  fullContent: string;
  metadata: AssistantResponse['metadata'];
}

export async function* streamAssistantResponse(
  userMessage: string,
  conversationHistory: AssistantMessage[],
  healthContext: PatientHealthContext,
  options: {
    userId?: string;
    patientId?: string;
    language?: string;
  } = {}
): AsyncGenerator<{ type: 'content' | 'done' | 'metadata'; data: string | StreamResult }> {
  const startTime = Date.now();
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: MEDICAL_ASSISTANT_SYSTEM_PROMPT },
    { role: "system", content: buildHealthContextPrompt(healthContext) },
  ];

  if (options.language && options.language !== 'en') {
    messages.push({
      role: "system",
      content: `The patient prefers to communicate in ${options.language}. Please respond in that language while maintaining all safety guidelines.`
    });
  }

  for (const msg of conversationHistory.slice(-10)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  messages.push({ role: "user", content: userMessage });

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages,
    max_completion_tokens: 1024,
    stream: true,
  });

  let fullContent = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullContent += delta;
      yield { type: 'content', data: delta };
    }
  }

  const processingTime = Date.now() - startTime;
  const extractedContext = extractReferencedHealthData(fullContent, healthContext);
  
  const sources: string[] = [];
  if (extractedContext?.medicationsReferenced?.length) sources.push('medications');
  if (extractedContext?.conditionsReferenced?.length) sources.push('conditions');
  if (extractedContext?.labResultsReferenced?.length) sources.push('lab_results');
  if (extractedContext?.allergiesReferenced?.length) sources.push('allergies');

  logAuditEntry({
    insightId: `assistant-stream-${Date.now()}`,
    insightType: "medical_assistant_response",
    patientId: options.patientId || "unknown",
    userId: options.userId,
    userRole: "patient",
    action: "insight_generated",
    details: {
      messageLength: fullContent.length,
      processingTimeMs: processingTime,
      sourcesUsed: sources,
      language: options.language || 'en',
    },
  });

  const metadata: AssistantResponse['metadata'] = {
    healthContext: extractedContext,
    explainability: {
      insightType: "personalized_health_insight",
      confidence: sources.length > 0 ? 0.85 : 0.7,
      sources: sources.length > 0 ? sources : ['general_knowledge'],
      reasoning: [
        "Analyzed patient's health records for context",
        "Applied educational-only guidelines",
        "Generated personalized response based on available data",
      ],
    },
    language: options.language,
  };

  yield { type: 'done', data: { fullContent, metadata } };
}

export async function generateSuggestedQuestions(
  healthContext: PatientHealthContext
): Promise<SuggestedQuestion[]> {
  const suggestions: SuggestedQuestion[] = [];
  let idCounter = 1;

  if (healthContext.medications.length > 0) {
    const med = healthContext.medications[0];
    suggestions.push({
      id: `suggested-${idCounter++}`,
      category: "medications",
      question: `What does ${med.name} do and are there any common side effects I should know about?`,
      context: `Based on your medication: ${med.name}`,
      priority: 1,
    });
  }

  if (healthContext.labResults.length > 0) {
    const abnormalLabs = healthContext.labResults.filter(l => 
      l.status === 'abnormal' || l.status === 'critical'
    );
    if (abnormalLabs.length > 0) {
      const lab = abnormalLabs[0];
      suggestions.push({
        id: `suggested-${idCounter++}`,
        category: "labs",
        question: `Can you explain what my ${lab.testName} result means and why it might be ${lab.status}?`,
        context: `Your ${lab.testName} was marked as ${lab.status}`,
        priority: 1,
      });
    } else {
      const lab = healthContext.labResults[0];
      suggestions.push({
        id: `suggested-${idCounter++}`,
        category: "labs",
        question: `What does my ${lab.testName} test measure and what do the results mean?`,
        context: `Recent lab test: ${lab.testName}`,
        priority: 2,
      });
    }
  }

  if (healthContext.conditions.length > 0) {
    const condition = healthContext.conditions[0];
    suggestions.push({
      id: `suggested-${idCounter++}`,
      category: "conditions",
      question: `Can you explain ${condition.name} in simple terms and what lifestyle changes might help?`,
      context: `Based on your condition: ${condition.name}`,
      priority: 1,
    });
  }

  if (healthContext.allergies.length > 0) {
    suggestions.push({
      id: `suggested-${idCounter++}`,
      category: "general",
      question: "Are any of my medications known to interact with my allergies?",
      context: "Based on your allergy and medication records",
      priority: 2,
    });
  }

  suggestions.push({
    id: `suggested-${idCounter++}`,
    category: "education",
    question: "What questions should I ask my doctor at my next appointment?",
    context: "General health management",
    priority: 3,
  });

  suggestions.push({
    id: `suggested-${idCounter++}`,
    category: "general",
    question: "Can you give me a summary of my overall health based on my records?",
    context: "Health overview",
    priority: 2,
  });

  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

export async function generateConversationTitle(
  firstMessage: string
): Promise<string> {
  try {
    const content = await generatePhiSafeText({
      system: "Generate a brief, descriptive title (3-6 words) for a health-related conversation based on the user's first message. Just return the title, nothing else.",
      user: firstMessage,
      maxTokens: 50,
    });

    return content?.trim() || "Health Conversation";
  } catch {
    return "Health Conversation";
  }
}
