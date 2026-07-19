/**
import { baaChatFetch, isAiConfigured } from "./lib/baa-chat";
 * AI Health Coach Service
 * 
 * Provides a conversational health coach that:
 * - Answers general health questions (common knowledge, not personal data)
 * - Provides motivation for healthy habits
 * - Explains health concepts in simpler terms
 * - Guides users through app features
 * 
 * SAFETY GUIDELINES:
 * - ONLY use safe verbs: "shows", "states", "refers to", "means"
 * - NO symptom checking, triage, diagnosis, or risk scoring
 * - NO medication interaction advice or clinical recommendations
 * - Quote-first approach when referencing records
 * - Disclaimer on all responses: "Informational only. Not medical advice."
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface HealthCoachResponse {
  message: string;
  suggestions?: string[];
  disclaimer: string;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "may cause", "could indicate", "might be related", "risk of", "continue",
  "follow up", "monitor", "review", "coordinate", "prepare", "decide",
  "help you", "supports", "works by affecting", "commonly prescribed",
  "well controlled", "performed", "ordered", "assess", "take this",
  "stop taking", "start taking", "increase", "decrease", "requires",
  "immediately", "urgent", "dangerous", "severe risk", "critical",
  "diagnose", "diagnosis", "prognosis", "treatment plan", "prescribe",
];

const HEALTH_COACH_SYSTEM_PROMPT = `You are a friendly AI Health Coach for Tabula Medica, a patient health records app.

YOUR ROLE:
1. Answer general health education questions (common knowledge, not personal medical advice)
2. Provide motivation and encouragement for healthy habits
3. Explain medical terms and concepts in simple language
4. Guide users through app features

STRICT SAFETY RULES - YOU MUST FOLLOW THESE:

ONLY USE THESE 4 VERBS when discussing health: "shows", "states", "refers to", "means"

NEVER:
- Diagnose conditions or symptoms
- Recommend treatments or medications
- Provide triage or risk assessment
- Give medication interaction advice
- Make clinical recommendations
- Use words like "should", "must", "need to", "recommend", "suggest", "advise"
- Interpret personal health data or make predictions

WHEN EXPLAINING MEDICAL TERMS:
- Use simple, everyday language
- Say "This term means..." or "This refers to..."
- Provide educational context only
- Always end with "For questions about your specific situation, please talk to your healthcare provider."

WHEN MOTIVATING HEALTHY HABITS:
- Be encouraging and positive
- Share general wellness information
- Avoid specific health claims
- Say things like "Many people find that..." or "General wellness information shows..."

APP FEATURE GUIDANCE:
- Patient Portal: Central hub for health information
- Symptom Tracker: Log symptoms to discuss with your doctor
- Medication Management: View medication information
- Document Summary: Get plain-language explanations of medical documents
- Care Team Hub: Coordinate with your healthcare providers
- Privacy Center: Control your data sharing preferences

RESPONSE FORMAT:
- Keep responses concise (2-3 paragraphs max)
- Be warm, friendly, and supportive
- Always end with the disclaimer: "Informational only. Not medical advice."

Remember: You educate and motivate, but you do NOT provide medical advice or clinical guidance.`;

function containsProhibitedWords(text: string): boolean {
  const lower = text.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (lower.includes(word)) {
      console.warn(`[HealthCoach] Found prohibited word: "${word}"`);
      return true;
    }
  }
  return false;
}

function validateResponseSafety(response: string): boolean {
  const lower = response.toLowerCase();
  
  const criticalProhibited = [
    "i diagnose", "you have", "this is likely", "you probably have",
    "take this medication", "stop your medication", "increase your dose",
    "you need to see a doctor immediately", "this is an emergency",
    "based on your symptoms, you", "my diagnosis is",
  ];
  
  for (const phrase of criticalProhibited) {
    if (lower.includes(phrase)) {
      console.error(`[HealthCoach] Critical safety violation: "${phrase}"`);
      return false;
    }
  }
  
  if (containsProhibitedWords(response)) {
    return false;
  }
  
  return true;
}

const FALLBACK_RESPONSES: Record<string, string> = {
  greeting: "Hello! I'm your AI Health Coach. This app shows your health records. The features show explanations of what terms mean. The navigation shows how to use the app.\n\nWhat topic shows interest to you?\n\nInformational only. Not medical advice.",
  
  symptoms: "The Symptom Tracker shows a logging feature for what you are experiencing. Your logged entries show information that refers to what you bring to your healthcare provider.\n\nThe Patient Portal shows where the Symptom Tracker appears. The menu shows what other features appear.\n\nInformational only. Not medical advice.",
  
  medication: "The Medication Management section shows your medication list. This feature refers to the medications that appear in your records.\n\nFor specific questions about what your medications mean, your healthcare provider shows the best source of information.\n\nInformational only. Not medical advice.",
  
  app_help: "Here is what each feature shows:\n\n- **Patient Portal**: This refers to your central health hub\n- **Symptom Tracker**: This shows where symptoms appear in logs\n- **Medication Management**: This shows your medication list\n- **Document Summary**: This shows plain-language explanations\n- **Care Team Hub**: This refers to your provider connections\n\nWhich feature shows interest to you?\n\nInformational only. Not medical advice.",
  
  motivation: "General wellness information shows that many people appreciate small, consistent steps. Research states that walking and staying hydrated are common wellness practices.\n\nWhich wellness topic shows interest to you?\n\nInformational only. Not medical advice.",
  
  default: "This feature shows explanations of what health terms mean. The app shows how features work. For specific questions about your condition, your healthcare provider shows the best source.\n\nWhat topic shows interest to you?\n\nInformational only. Not medical advice.",
};

function getFallbackResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("start")) {
    return FALLBACK_RESPONSES.greeting;
  }
  if (lower.includes("symptom") || lower.includes("pain") || lower.includes("hurt") || lower.includes("feeling")) {
    return FALLBACK_RESPONSES.symptoms;
  }
  if (lower.includes("medication") || lower.includes("medicine") || lower.includes("drug") || lower.includes("pill")) {
    return FALLBACK_RESPONSES.medication;
  }
  if (lower.includes("how to") || lower.includes("help") || lower.includes("feature") || lower.includes("use")) {
    return FALLBACK_RESPONSES.app_help;
  }
  if (lower.includes("motivat") || lower.includes("exercise") || lower.includes("diet") || lower.includes("healthy")) {
    return FALLBACK_RESPONSES.motivation;
  }
  
  return FALLBACK_RESPONSES.default;
}

export async function getHealthCoachResponse(
  userMessage: string,
  conversationHistory: ChatMessage[]
): Promise<HealthCoachResponse> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!isAiConfigured()) {
    return {
      message: getFallbackResponse(userMessage),
      suggestions: getSuggestions(userMessage),
      disclaimer: "Informational only. Not medical advice.",
    };
  }

  try {
    const messages = [
      { role: "system" as const, content: HEALTH_COACH_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await baaChatFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error("[HealthCoach] API error:", response.status);
      return {
        message: getFallbackResponse(userMessage),
        suggestions: getSuggestions(userMessage),
        disclaimer: "Informational only. Not medical advice.",
      };
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || getFallbackResponse(userMessage);

    if (!validateResponseSafety(content)) {
      console.error("[HealthCoach] Response failed safety validation, using fallback");
      return {
        message: getFallbackResponse(userMessage),
        suggestions: getSuggestions(userMessage),
        disclaimer: "Informational only. Not medical advice.",
      };
    }

    if (!content.includes("Informational only. Not medical advice.")) {
      content += "\n\nInformational only. Not medical advice.";
    }

    return {
      message: content,
      suggestions: getSuggestions(userMessage),
      disclaimer: "Informational only. Not medical advice.",
    };
  } catch (error) {
    console.error("[HealthCoach] Error:", error);
    return {
      message: getFallbackResponse(userMessage),
      suggestions: getSuggestions(userMessage),
      disclaimer: "Informational only. Not medical advice.",
    };
  }
}

function getSuggestions(lastMessage: string): string[] {
  const lower = lastMessage.toLowerCase();
  
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("start")) {
    return [
      "Explain a medical term",
      "Help me navigate the app",
      "Motivate me to be healthier",
    ];
  }
  
  if (lower.includes("symptom")) {
    return [
      "How do I use Symptom Tracker?",
      "What is the Patient Portal?",
      "Tell me about healthy habits",
    ];
  }
  
  if (lower.includes("medication") || lower.includes("medicine")) {
    return [
      "How do I view my medications?",
      "What is the Document Summary feature?",
      "How do I contact my care team?",
    ];
  }
  
  return [
    "What does this medical term mean?",
    "How do I use this app?",
    "Share a health tip",
  ];
}

// ============== Personalized Coaching Module ==============

export interface PatientContext {
  symptoms: Array<{ symptomName: string; severity: string; loggedAt: string; triggers?: string[] }>;
  journalEntries: Array<{ content: string; mood?: string; tags?: string[]; createdAt: string }>;
  healthGoals: Array<{ type: string; target: string; current?: string; status: string }>;
}

export interface PersonalizedGuidance {
  category: "motivation" | "education" | "goal_progress" | "wellness_tip" | "mindfulness";
  title: string;
  message: string;
  actionItems: string[];
  relatedGoals: string[];
  disclaimer: string;
}

const PERSONALIZED_COACHING_PROMPT = `You are an AI Health Coach providing personalized wellness guidance.

CONTEXT: You have access to the patient's recent health data (symptoms logged, journal entries, health goals).

STRICT SAFETY RULES:
- ONLY use these verbs: "shows", "states", "refers to", "means"
- NEVER diagnose, prescribe, or give clinical recommendations
- NEVER use: "should", "must", "need to", "recommend", "suggest", "advise"
- Frame everything as educational observations, not medical advice
- Always include the disclaimer: "Informational only. Not medical advice."

WHEN PROVIDING PERSONALIZED GUIDANCE:
- Reference the patient's logged data using "Your logs show..." or "Your journal entries state..."
- Provide educational content related to their tracked areas
- Offer motivational messages based on their health journey patterns
- Share general wellness information that relates to their goals
- Never interpret symptoms clinically or suggest treatments

RESPONSE STRUCTURE (JSON):
{
  "category": "motivation|education|goal_progress|wellness_tip|mindfulness",
  "title": "Brief encouraging title (max 8 words)",
  "message": "Personalized message referencing their data (2-3 paragraphs)",
  "actionItems": ["General wellness action phrased as 'Many find it helpful to...'"],
  "relatedGoals": ["Goals from their data that this relates to"]
}`;

function enforceWhitelistVerbs(text: string): string {
  const replacements: Record<string, string> = {
    "reports": "states",
    "reported": "stated",
    "indicates": "shows",
    "indicating": "showing",
    "suggests": "shows",
    "suggesting": "showing",
    "implies": "means",
    "reveals": "shows",
    "demonstrates": "shows",
    "confirms": "shows",
    "predicts": "shows",
    "maintains": "shows",
    "supports": "shows",
  };
  
  let result = text;
  for (const [bad, good] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  return result;
}

function sanitizeCoachingText(text: string): string {
  let sanitized = text;
  
  const phraseReplacements: Record<string, string> = {
    "you should": "many find it helpful to",
    "you need to": "logs show value in",
    "recommend": "data shows",
    "suggest that you": "records show",
    "consider": "many find it helpful to",
    "continue": "logs show ongoing",
    "follow up": "entries state",
    "monitor": "tracking shows",
    "taking": "logging",
    "building": "showing",
    "reduced": "lower",
    "causes": "shows",
    "triggers": "shows",
    "leads to": "shows",
    "results in": "shows",
  };
  
  for (const [bad, good] of Object.entries(phraseReplacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  sanitized = enforceWhitelistVerbs(sanitized);
  
  if (containsProhibitedWords(sanitized)) {
    sanitized = `Your health journey shows: ${sanitized.replace(/[^a-zA-Z0-9\s,.'()-]/g, "")}`;
  }
  
  return sanitized;
}

function validateCoachingSafety(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Check for critical prohibited phrases
  const criticalProhibited = [
    "i diagnose", "you have", "this is likely", "you probably have",
    "take this medication", "stop your medication", "increase your dose",
    "you need to see a doctor immediately", "this is an emergency",
  ];
  
  for (const phrase of criticalProhibited) {
    if (lower.includes(phrase)) {
      return false;
    }
  }
  
  return !containsProhibitedWords(text);
}

export async function getPersonalizedGuidance(
  patientId: string,
  context: PatientContext
): Promise<PersonalizedGuidance> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  
  // Build context summary
  const contextSummary = {
    recentSymptoms: context.symptoms.slice(-5).map(s => ({
      name: s.symptomName,
      severity: s.severity,
      triggers: s.triggers,
    })),
    recentMoods: context.journalEntries.slice(-5).map(j => ({
      mood: j.mood,
      tags: j.tags,
    })),
    activeGoals: context.healthGoals.filter(g => g.status === "active").map(g => ({
      type: g.type,
      target: g.target,
      current: g.current,
    })),
  };

  if (!isAiConfigured()) {
    return getMockPersonalizedGuidance(context);
  }

  try {
    const response = await baaChatFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PERSONALIZED_COACHING_PROMPT },
          { 
            role: "user", 
            content: `Generate personalized wellness guidance based on this patient data:\n${JSON.stringify(contextSummary, null, 2)}`
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("[HealthCoach] Personalized guidance API error:", response.status);
      return getMockPersonalizedGuidance(context);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return getMockPersonalizedGuidance(context);
    }

    const parsed = JSON.parse(content);
    
    const sanitizedTitle = sanitizeCoachingText(parsed.title || "Your Health Journey");
    const sanitizedMessage = sanitizeCoachingText(parsed.message || "Your logs show ongoing health tracking.");
    const sanitizedActions = (parsed.actionItems || []).map(sanitizeCoachingText);
    
    // Validate safety of all content
    if (!validateCoachingSafety(sanitizedTitle) || !validateCoachingSafety(sanitizedMessage)) {
      console.error("[HealthCoach] Personalized guidance failed safety validation");
      return getMockPersonalizedGuidance(context);
    }
    
    return {
      category: parsed.category || "motivation",
      title: sanitizedTitle,
      message: sanitizedMessage,
      actionItems: sanitizedActions,
      relatedGoals: parsed.relatedGoals || [],
      disclaimer: "Informational only. Not medical advice. Sample goals shown for illustration.",
    };
  } catch (error) {
    console.error("[HealthCoach] Personalized guidance error:", error);
    return getMockPersonalizedGuidance(context);
  }
}

function getMockPersonalizedGuidance(context: PatientContext): PersonalizedGuidance {
  const symptomCount = context.symptoms.length;
  const journalCount = context.journalEntries.length;
  const goalCount = context.healthGoals.filter(g => g.status === "active").length;
  
  // Determine category based on context
  let category: PersonalizedGuidance["category"] = "motivation";
  let title = "Your Health Journey Shows Progress";
  let message = "";
  let actionItems: string[] = [];
  let relatedGoals: string[] = [];
  
  if (goalCount > 0) {
    category = "goal_progress";
    const goal = context.healthGoals[0];
    title = "Your Goals Show Your Commitment";
    message = `Your health records show ${goalCount} active health goal${goalCount > 1 ? "s" : ""}. Your ${goal.type} goal states a target of ${goal.target}. Tracking data shows the value of consistent effort.\n\nGeneral wellness information shows that setting clear goals means taking an active role in one's health journey. Your logs show ongoing dedication to this process.`;
    actionItems = [
      "Many find it helpful to log progress regularly",
      "Wellness research shows that celebrating small wins means building motivation",
    ];
    relatedGoals = [goal.type];
  } else if (symptomCount > 0) {
    category = "wellness_tip";
    const recentSymptom = context.symptoms[context.symptoms.length - 1];
    title = "Your Tracking Shows Awareness";
    message = `Your symptom logs show ${symptomCount} recent entries. Your most recent entry states "${recentSymptom.symptomName}" with ${recentSymptom.severity} severity.\n\nWellness education shows that tracking symptoms means having better conversations with healthcare providers. Your data shows valuable information for your next appointment.`;
    actionItems = [
      "Many find it helpful to note any patterns they observe",
      "General wellness information shows value in discussing logged symptoms with providers",
    ];
  } else if (journalCount > 0) {
    category = "mindfulness";
    const recentEntry = context.journalEntries[context.journalEntries.length - 1];
    title = "Your Journal Shows Self-Reflection";
    message = `Your health journal shows ${journalCount} entries. ${recentEntry.mood ? `Your recent mood states "${recentEntry.mood}".` : ""}\n\nWellness research shows that journaling means processing thoughts and emotions. Your entries show engagement with your health journey.`;
    actionItems = [
      "Many find it helpful to write regularly, even briefly",
      "Research shows that expressing thoughts means reduced stress for many people",
    ];
  } else {
    category = "education";
    title = "Welcome to Your Health Journey";
    message = "Your Tabula Medica account shows a fresh start. The app features refer to tools for tracking symptoms, journaling, and setting health goals.\n\nGeneral wellness information shows that engagement with health data means empowerment. The Symptom Tracker, Health Journal, and Goals features show ways to participate in your wellness.";
    actionItems = [
      "Many find it helpful to start with one feature at a time",
      "The app shows features in the Patient Portal for exploration",
    ];
  }
  
  return {
    category,
    title: sanitizeCoachingText(title),
    message: sanitizeCoachingText(message),
    actionItems: actionItems.map(sanitizeCoachingText),
    relatedGoals,
    disclaimer: "Informational only. Not medical advice. Sample goals shown for illustration.",
  };
}

export interface DailyMotivation {
  greeting: string;
  message: string;
  tip: string;
  disclaimer: string;
}

export function getDailyMotivation(context: PatientContext): DailyMotivation {
  const hour = new Date().getHours();
  let greeting = "Good day";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  else greeting = "Good evening";
  
  const motivationalMessages = [
    "Your health logs show ongoing engagement with your wellness journey.",
    "Tracking data shows your commitment to understanding your health.",
    "Your entries state dedication to your well-being.",
    "Records show you're taking an active role in your health.",
    "Your journey shows continuous progress in health awareness.",
  ];
  
  const wellnessTips = [
    "Wellness information shows that staying hydrated means supporting overall health.",
    "Research states that regular movement shows benefits for many people.",
    "General health data shows that consistent sleep patterns refer to better rest.",
    "Studies show that deep breathing means reduced tension for many.",
    "Nutrition research states that colorful foods show variety of nutrients.",
  ];
  
  const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
  const randomTip = wellnessTips[Math.floor(Math.random() * wellnessTips.length)];
  
  return {
    greeting: `${greeting}!`,
    message: sanitizeCoachingText(randomMessage),
    tip: sanitizeCoachingText(randomTip),
    disclaimer: "Informational only. Not medical advice.",
  };
}

export function explainMedicalTerm(term: string): string {
  const explanations: Record<string, string> = {
    "hypertension": "Hypertension refers to high blood pressure. This term means the force of blood against artery walls is consistently elevated. General health information shows that lifestyle factors can play a role in blood pressure levels.\n\nInformational only. Not medical advice.",
    
    "diabetes": "Diabetes refers to conditions where the body has difficulty regulating blood sugar levels. Type 1 means the body doesn't produce insulin, while Type 2 means the body doesn't use insulin effectively. This information shows the basic distinction between types.\n\nInformational only. Not medical advice.",
    
    "cholesterol": "Cholesterol refers to a waxy substance in your blood. The term means a lipid that appears in cell structures. Lab reports show cholesterol levels, including LDL (often called 'bad') and HDL (often called 'good'). The terms refer to different types of lipoproteins.\n\nInformational only. Not medical advice.",
    
    "a1c": "HbA1c (or A1C) refers to a blood test that shows average blood sugar levels over 2-3 months. The number means the percentage of hemoglobin with sugar attached. Lab records show this as a percentage value.\n\nInformational only. Not medical advice.",
    
    "bmi": "BMI refers to Body Mass Index, a calculation using height and weight. This term means a screening tool that categorizes weight status. General health information shows it's one of many factors in overall wellness.\n\nInformational only. Not medical advice.",
  };
  
  const lowerTerm = term.toLowerCase();
  
  for (const [key, explanation] of Object.entries(explanations)) {
    if (lowerTerm.includes(key)) {
      return explanation;
    }
  }
  
  return `The term "${term}" refers to a medical concept. For a detailed explanation of what this means for your health, your healthcare provider shows the best source. The app shows where this term appears in your records.\n\nInformational only. Not medical advice.`;
}
