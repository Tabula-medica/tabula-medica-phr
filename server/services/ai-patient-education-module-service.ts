import { generatePhiSafeText } from "./ai-gateway";

const NO_CDS_DISCLAIMER = "This educational content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult your healthcare provider for personalized medical guidance.";

function generateId(): string {
  return `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT][PatientEducation] ${new Date().toISOString()} | ${action} | ${JSON.stringify(details)}`);
}

export interface EducationTopic {
  id: string;
  type: "condition" | "medication" | "procedure";
  name: string;
  code?: string;
  codeSystem?: string;
}

export interface TopicExplanation {
  id: string;
  topic: EducationTopic;
  overview: string;
  whatItIs: string;
  causes?: string[];
  symptoms?: string[];
  howItWorks?: string;
  sideEffects?: SideEffect[];
  interactions?: string[];
  careInstructions: CareInstruction[];
  warningSignsToWatch: string[];
  questionsToAskProvider: string[];
  relatedTopics: string[];
  sources: string[];
  readingLevel: "simple" | "moderate" | "detailed";
  generatedAt: string;
  disclaimer: string;
}

export interface SideEffect {
  name: string;
  severity: "common" | "less_common" | "rare" | "serious";
  description: string;
  whatToDo: string;
}

export interface CareInstruction {
  category: string;
  instruction: string;
  importance: "essential" | "recommended" | "helpful";
  tips?: string[];
}

export interface PatientQuestion {
  id: string;
  question: string;
  patientId: string;
  context?: PatientContext;
  answer?: QuestionAnswer;
  askedAt: string;
}

export interface PatientContext {
  conditions?: string[];
  medications?: string[];
  recentProcedures?: string[];
  allergies?: string[];
  age?: number;
  healthGoals?: string[];
}

export interface QuestionAnswer {
  id: string;
  response: string;
  keyPoints: string[];
  recommendations: string[];
  relatedTopics: EducationTopic[];
  sources: string[];
  confidence: "high" | "medium" | "low";
  answeredAt: string;
  disclaimer: string;
}

export interface TopicSearchResult {
  id: string;
  type: "condition" | "medication" | "procedure";
  name: string;
  description: string;
  relevanceScore: number;
  fhirCode?: string;
  fhirSystem?: string;
}

const sampleConditions: TopicSearchResult[] = [
  { id: "cond-1", type: "condition", name: "Type 2 Diabetes", description: "A chronic condition affecting how your body processes blood sugar", relevanceScore: 0.95, fhirCode: "44054006", fhirSystem: "SNOMED-CT" },
  { id: "cond-2", type: "condition", name: "Hypertension (High Blood Pressure)", description: "A condition where blood pressure against artery walls is too high", relevanceScore: 0.92, fhirCode: "38341003", fhirSystem: "SNOMED-CT" },
  { id: "cond-3", type: "condition", name: "Asthma", description: "A condition that affects breathing and causes wheezing", relevanceScore: 0.88, fhirCode: "195967001", fhirSystem: "SNOMED-CT" },
  { id: "cond-4", type: "condition", name: "Chronic Kidney Disease", description: "Gradual loss of kidney function over time", relevanceScore: 0.85, fhirCode: "709044004", fhirSystem: "SNOMED-CT" },
  { id: "cond-5", type: "condition", name: "Heart Failure", description: "A condition where the heart doesn't pump blood as well as it should", relevanceScore: 0.82, fhirCode: "84114007", fhirSystem: "SNOMED-CT" },
];

const sampleMedications: TopicSearchResult[] = [
  { id: "med-1", type: "medication", name: "Metformin", description: "Medication for managing blood sugar in Type 2 Diabetes", relevanceScore: 0.95, fhirCode: "860975", fhirSystem: "RxNorm" },
  { id: "med-2", type: "medication", name: "Lisinopril", description: "ACE inhibitor for blood pressure and heart conditions", relevanceScore: 0.92, fhirCode: "29046", fhirSystem: "RxNorm" },
  { id: "med-3", type: "medication", name: "Atorvastatin", description: "Statin medication for lowering cholesterol", relevanceScore: 0.88, fhirCode: "83367", fhirSystem: "RxNorm" },
  { id: "med-4", type: "medication", name: "Omeprazole", description: "Proton pump inhibitor for acid reflux and stomach issues", relevanceScore: 0.85, fhirCode: "7646", fhirSystem: "RxNorm" },
  { id: "med-5", type: "medication", name: "Albuterol Inhaler", description: "Bronchodilator for asthma and breathing problems", relevanceScore: 0.82, fhirCode: "435", fhirSystem: "RxNorm" },
];

const sampleProcedures: TopicSearchResult[] = [
  { id: "proc-1", type: "procedure", name: "Colonoscopy", description: "Examination of the colon using a flexible camera", relevanceScore: 0.95, fhirCode: "73761001", fhirSystem: "SNOMED-CT" },
  { id: "proc-2", type: "procedure", name: "MRI Scan", description: "Magnetic resonance imaging for detailed body imaging", relevanceScore: 0.92, fhirCode: "113091000", fhirSystem: "SNOMED-CT" },
  { id: "proc-3", type: "procedure", name: "Blood Test (CBC)", description: "Complete blood count to check overall health", relevanceScore: 0.88, fhirCode: "43789009", fhirSystem: "SNOMED-CT" },
  { id: "proc-4", type: "procedure", name: "Echocardiogram", description: "Ultrasound of the heart to assess function", relevanceScore: 0.85, fhirCode: "40701008", fhirSystem: "SNOMED-CT" },
  { id: "proc-5", type: "procedure", name: "Knee Replacement Surgery", description: "Surgical procedure to replace a damaged knee joint", relevanceScore: 0.82, fhirCode: "179344006", fhirSystem: "SNOMED-CT" },
];

const questionsHistory: Map<string, PatientQuestion[]> = new Map();
const explanationsCache: Map<string, TopicExplanation> = new Map();

class AIPatientEducationModuleService {
  async searchTopics(query: string, type?: "condition" | "medication" | "procedure"): Promise<TopicSearchResult[]> {
    logHipaaAudit("SEARCH_TOPICS", { query, type });
    
    const queryLower = query.toLowerCase();
    let results: TopicSearchResult[] = [];

    if (!type || type === "condition") {
      results = results.concat(
        sampleConditions.filter(c => 
          c.name.toLowerCase().includes(queryLower) || 
          c.description.toLowerCase().includes(queryLower)
        )
      );
    }

    if (!type || type === "medication") {
      results = results.concat(
        sampleMedications.filter(m => 
          m.name.toLowerCase().includes(queryLower) || 
          m.description.toLowerCase().includes(queryLower)
        )
      );
    }

    if (!type || type === "procedure") {
      results = results.concat(
        sampleProcedures.filter(p => 
          p.name.toLowerCase().includes(queryLower) || 
          p.description.toLowerCase().includes(queryLower)
        )
      );
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, 10);
  }

  async getTopicExplanation(topic: EducationTopic, readingLevel: "simple" | "moderate" | "detailed" = "moderate"): Promise<TopicExplanation> {
    const cacheKey = `${topic.type}-${topic.name}-${readingLevel}`;
    
    if (explanationsCache.has(cacheKey)) {
      logHipaaAudit("GET_TOPIC_EXPLANATION_CACHED", { topic: topic.name, type: topic.type });
      return explanationsCache.get(cacheKey)!;
    }

    logHipaaAudit("GET_TOPIC_EXPLANATION", { topic: topic.name, type: topic.type, readingLevel });

    try {
      const systemPrompt = `You are a patient education specialist. Provide clear, accurate, and easy-to-understand health information.
Reading level: ${readingLevel === "simple" ? "Use very simple language, short sentences, and avoid medical jargon" : readingLevel === "moderate" ? "Use clear language with some medical terms explained" : "Provide detailed medical information with proper terminology"}.
Always be compassionate and empowering. Never provide diagnoses or treatment recommendations.
Format your response as valid JSON.`;

      const userPrompt = `Provide comprehensive patient education about: ${topic.name} (${topic.type})

Return a JSON object with this structure:
{
  "overview": "A 2-3 sentence overview",
  "whatItIs": "Detailed explanation of what this is",
  ${topic.type === "condition" ? '"causes": ["list of potential causes"],' : ''}
  ${topic.type === "condition" ? '"symptoms": ["list of common symptoms"],' : ''}
  ${topic.type === "medication" ? '"howItWorks": "Explanation of how the medication works",' : ''}
  ${topic.type === "medication" || topic.type === "procedure" ? '"sideEffects": [{"name": "effect", "severity": "common|less_common|rare|serious", "description": "what it is", "whatToDo": "action to take"}],' : ''}
  ${topic.type === "medication" ? '"interactions": ["list of potential drug/food interactions"],' : ''}
  "careInstructions": [{"category": "category", "instruction": "what to do", "importance": "essential|recommended|helpful", "tips": ["helpful tips"]}],
  "warningSignsToWatch": ["signs that need medical attention"],
  "questionsToAskProvider": ["suggested questions for doctor"],
  "relatedTopics": ["related conditions, medications, or procedures"],
  "sources": ["credible medical sources"]
}`;

      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 2000,
      });

      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);

      const explanation: TopicExplanation = {
        id: generateId(),
        topic,
        overview: parsed.overview || "",
        whatItIs: parsed.whatItIs || "",
        causes: parsed.causes,
        symptoms: parsed.symptoms,
        howItWorks: parsed.howItWorks,
        sideEffects: parsed.sideEffects || [],
        interactions: parsed.interactions,
        careInstructions: parsed.careInstructions || [],
        warningSignsToWatch: parsed.warningSignsToWatch || [],
        questionsToAskProvider: parsed.questionsToAskProvider || [],
        relatedTopics: parsed.relatedTopics || [],
        sources: parsed.sources || ["Medical literature", "Clinical guidelines"],
        readingLevel,
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      };

      explanationsCache.set(cacheKey, explanation);
      return explanation;
    } catch (error) {
      console.error("[AIPatientEducation] Error generating explanation:", error);
      return this.getFallbackExplanation(topic, readingLevel);
    }
  }

  private getFallbackExplanation(topic: EducationTopic, readingLevel: "simple" | "moderate" | "detailed"): TopicExplanation {
    const fallbackData: Record<string, Partial<TopicExplanation>> = {
      "Type 2 Diabetes": {
        overview: "Type 2 Diabetes is a condition where your body doesn't use insulin properly, causing high blood sugar levels.",
        whatItIs: "In Type 2 Diabetes, your body either doesn't make enough insulin or doesn't use it well. Insulin is a hormone that helps sugar enter your cells for energy. When this process doesn't work right, sugar builds up in your blood.",
        causes: ["Family history", "Being overweight", "Physical inactivity", "Age (45 or older)", "High blood pressure"],
        symptoms: ["Increased thirst", "Frequent urination", "Fatigue", "Blurred vision", "Slow-healing wounds"],
        careInstructions: [
          { category: "Diet", instruction: "Monitor carbohydrate intake and eat balanced meals", importance: "essential", tips: ["Use the plate method: half vegetables, quarter protein, quarter grains"] },
          { category: "Exercise", instruction: "Get at least 150 minutes of moderate activity weekly", importance: "essential", tips: ["Walking, swimming, or cycling are great options"] },
          { category: "Monitoring", instruction: "Check blood sugar regularly as advised by your doctor", importance: "essential", tips: ["Keep a log of your readings"] },
        ],
        warningSignsToWatch: ["Very high blood sugar", "Signs of low blood sugar (shakiness, confusion)", "Foot sores that don't heal", "Vision changes"],
        questionsToAskProvider: ["What is my target blood sugar range?", "How often should I check my blood sugar?", "What changes can I make to my diet?"],
      },
      "Metformin": {
        overview: "Metformin is a medication that helps control blood sugar levels in people with Type 2 Diabetes.",
        whatItIs: "Metformin works by reducing the amount of sugar your liver releases and helping your body respond better to insulin. It's usually the first medication prescribed for Type 2 Diabetes.",
        howItWorks: "Metformin decreases how much sugar your liver makes and helps your muscles use sugar better. It doesn't cause low blood sugar when used alone.",
        sideEffects: [
          { name: "Upset stomach", severity: "common", description: "Nausea or diarrhea, especially when starting", whatToDo: "Take with food, symptoms usually improve over time" },
          { name: "Vitamin B12 deficiency", severity: "less_common", description: "Long-term use may lower B12 levels", whatToDo: "Your doctor may check B12 levels periodically" },
          { name: "Lactic acidosis", severity: "rare", description: "A serious buildup of lactic acid", whatToDo: "Seek immediate medical attention if you have muscle pain, weakness, or difficulty breathing" },
        ],
        interactions: ["Alcohol (increases risk of lactic acidosis)", "Contrast dye for imaging tests", "Certain heart and kidney medications"],
        careInstructions: [
          { category: "Taking medication", instruction: "Take with meals to reduce stomach upset", importance: "essential", tips: ["Take at the same time each day"] },
          { category: "Monitoring", instruction: "Have regular kidney function tests", importance: "essential" },
        ],
        warningSignsToWatch: ["Unusual muscle pain", "Extreme tiredness", "Difficulty breathing", "Stomach pain"],
        questionsToAskProvider: ["What dose should I take?", "Should I continue taking during illness?", "When should I stop before medical procedures?"],
      },
      "Colonoscopy": {
        overview: "A colonoscopy is a procedure that lets your doctor examine the inside of your colon (large intestine) for abnormalities.",
        whatItIs: "During a colonoscopy, a long, flexible tube with a tiny camera is inserted through the rectum to view the entire colon. It's used to screen for colon cancer and investigate digestive symptoms.",
        sideEffects: [
          { name: "Bloating and gas", severity: "common", description: "From air used during the procedure", whatToDo: "Walking and passing gas helps relieve this" },
          { name: "Cramping", severity: "common", description: "Mild cramping after the procedure", whatToDo: "Usually resolves within an hour" },
          { name: "Bleeding", severity: "rare", description: "If polyps are removed", whatToDo: "Contact your doctor if bleeding is heavy or persists" },
        ],
        careInstructions: [
          { category: "Preparation", instruction: "Follow the bowel prep instructions exactly", importance: "essential", tips: ["Stay near a bathroom", "Drink clear liquids"] },
          { category: "After procedure", instruction: "Have someone drive you home", importance: "essential", tips: ["Sedation effects can last several hours"] },
          { category: "Recovery", instruction: "Start with light foods and gradually return to normal diet", importance: "recommended" },
        ],
        warningSignsToWatch: ["Heavy bleeding", "Severe abdominal pain", "Fever", "Signs of infection"],
        questionsToAskProvider: ["How long before I can eat normally?", "When will I get the results?", "How often do I need this procedure?"],
      },
    };

    const fallback = fallbackData[topic.name];
    
    return {
      id: generateId(),
      topic,
      overview: fallback?.overview || `${topic.name} is a ${topic.type} that patients may encounter in their healthcare journey.`,
      whatItIs: fallback?.whatItIs || `Information about ${topic.name} helps patients understand their health better.`,
      causes: fallback?.causes,
      symptoms: fallback?.symptoms,
      howItWorks: fallback?.howItWorks,
      sideEffects: fallback?.sideEffects || [],
      interactions: fallback?.interactions,
      careInstructions: fallback?.careInstructions || [
        { category: "General", instruction: "Follow your healthcare provider's guidance", importance: "essential" }
      ],
      warningSignsToWatch: fallback?.warningSignsToWatch || ["Any unusual symptoms", "Worsening condition", "New concerns"],
      questionsToAskProvider: fallback?.questionsToAskProvider || ["What should I know about this?", "What are my next steps?"],
      relatedTopics: [],
      sources: ["General medical knowledge"],
      readingLevel,
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async answerPatientQuestion(patientId: string, question: string, context?: PatientContext): Promise<QuestionAnswer> {
    logHipaaAudit("ANSWER_PATIENT_QUESTION", { patientId: patientId.slice(0, 8) + "***", questionLength: question.length });

    const patientQuestion: PatientQuestion = {
      id: generateId(),
      question,
      patientId,
      context,
      askedAt: new Date().toISOString(),
    };

    try {
      const contextInfo = context ? `
Patient context (for personalization only, not for diagnosis):
- Conditions: ${context.conditions?.join(", ") || "Not specified"}
- Medications: ${context.medications?.join(", ") || "Not specified"}
- Allergies: ${context.allergies?.join(", ") || "Not specified"}
- Health goals: ${context.healthGoals?.join(", ") || "Not specified"}` : "";

      const systemPrompt = `You are a helpful patient education assistant. Answer health questions clearly and accurately.
IMPORTANT RULES:
1. Never diagnose conditions or recommend specific treatments
2. Always encourage consulting healthcare providers for medical decisions
3. Provide educational information only
4. Be compassionate and supportive
5. Use plain language that's easy to understand
6. If asked about specific symptoms or treatments, explain general information but defer to the patient's doctor for personalized advice

Format your response as valid JSON.`;

      const userPrompt = `Patient question: "${question}"
${contextInfo}

Provide an educational answer. Return JSON with:
{
  "response": "Clear, helpful answer (2-4 paragraphs)",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "recommendations": ["general wellness recommendations, not medical advice"],
  "relatedTopics": [{"type": "condition|medication|procedure", "name": "topic name"}],
  "sources": ["credible sources"],
  "confidence": "high|medium|low"
}`;

      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 1500,
      });

      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);

      const answer: QuestionAnswer = {
        id: generateId(),
        response: parsed.response || "",
        keyPoints: parsed.keyPoints || [],
        recommendations: parsed.recommendations || [],
        relatedTopics: (parsed.relatedTopics || []).map((t: any) => ({
          id: generateId(),
          type: t.type || "condition",
          name: t.name || ""
        })),
        sources: parsed.sources || [],
        confidence: parsed.confidence || "medium",
        answeredAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      };

      patientQuestion.answer = answer;
      
      const history = questionsHistory.get(patientId) || [];
      history.push(patientQuestion);
      questionsHistory.set(patientId, history.slice(-50));

      return answer;
    } catch (error) {
      console.error("[AIPatientEducation] Error answering question:", error);
      return this.getFallbackAnswer(question);
    }
  }

  private getFallbackAnswer(question: string): QuestionAnswer {
    return {
      id: generateId(),
      response: `Thank you for your question about "${question.slice(0, 50)}...". While I can provide general health information, I recommend discussing specific concerns with your healthcare provider who knows your medical history and can give personalized guidance.

For general health information, consider reliable sources like the CDC, NIH, or your doctor's patient portal. If you're experiencing symptoms that concern you, don't hesitate to contact your healthcare team.`,
      keyPoints: [
        "Consult your healthcare provider for personalized advice",
        "Reliable sources include CDC.gov and NIH.gov",
        "Keep track of your symptoms to discuss with your doctor"
      ],
      recommendations: [
        "Write down your questions before medical appointments",
        "Keep a health journal to track symptoms and concerns",
        "Don't hesitate to seek a second opinion if needed"
      ],
      relatedTopics: [],
      sources: ["General health education principles"],
      confidence: "low",
      answeredAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  getQuestionHistory(patientId: string): PatientQuestion[] {
    logHipaaAudit("GET_QUESTION_HISTORY", { patientId: patientId.slice(0, 8) + "***" });
    return questionsHistory.get(patientId) || [];
  }

  getPopularTopics(): TopicSearchResult[] {
    return [
      ...sampleConditions.slice(0, 3),
      ...sampleMedications.slice(0, 3),
      ...sampleProcedures.slice(0, 2),
    ];
  }

  getTopicsByType(type: "condition" | "medication" | "procedure"): TopicSearchResult[] {
    switch (type) {
      case "condition": return sampleConditions;
      case "medication": return sampleMedications;
      case "procedure": return sampleProcedures;
      default: return [];
    }
  }

  async curateEducationPlan(patientId: string, patientData: {
    conditions: { name: string; severity: string; status: string }[];
    medications: { name: string; dosage: string; frequency: string; prescribedFor?: string }[];
    allergies: { allergen: string; severity: string; reaction: string }[];
    labResults: { testName: string; value: number; unit: string; status: string; referenceRange: { low: number; high: number } }[];
    vitalSigns: { type: string; value: number; unit: string }[];
  }): Promise<CuratedEducationPlan> {
    logHipaaAudit("CURATE_EDUCATION_PLAN", { patientId: patientId.slice(0, 8) + "***", conditionCount: patientData.conditions.length, medCount: patientData.medications.length });

    const cacheKey = `curated-${patientId}`;
    const cached = curatedPlansCache.get(cacheKey);
    if (cached && Date.now() - cached.generatedAtTimestamp < 30 * 60 * 1000) {
      return cached.plan;
    }

    try {
      const abnormalLabs = patientData.labResults.filter(l => l.status !== "normal");
      const activeConditions = patientData.conditions.filter(c => c.status === "active");

      const systemPrompt = `You are a patient education specialist creating a personalized learning plan.
Based on this patient's health profile, curate educational content that is:
- Written in clear, simple language (6th-8th grade reading level)
- Organized by category: conditions, medications, lifestyle, recent_changes
- Actionable with specific tips patients can follow
- Engaging with relatable analogies and encouragement
- Compliant with NO-CDS: never diagnose or prescribe, use "may", "consider", "talk to your provider"

Format response as valid JSON with this structure:
{
  "articles": [
    {
      "id": "unique-id",
      "category": "conditions" | "medications" | "lifestyle" | "recent_changes",
      "title": "engaging article title",
      "summary": "2-3 sentence summary",
      "content": "full educational content (3-5 paragraphs, use clear headings)",
      "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
      "actionItems": ["specific action 1", "specific action 2"],
      "relatedTo": ["condition or medication name this relates to"],
      "difficulty": "beginner" | "intermediate",
      "estimatedMinutes": 3-8,
      "relevanceScore": 0.0-1.0
    }
  ],
  "welcomeMessage": "personalized greeting mentioning their health journey",
  "focusAreas": ["area 1", "area 2", "area 3"]
}

Generate 8-12 articles covering all categories. Prioritize content related to the patient's active conditions and current medications.`;

      const userPrompt = `Patient Health Profile:

Active Conditions: ${activeConditions.map(c => `${c.name} (${c.severity})`).join(", ") || "None recorded"}

Current Medications: ${patientData.medications.map(m => `${m.name} ${m.dosage} - ${m.frequency}${m.prescribedFor ? ` (for ${m.prescribedFor})` : ""}`).join("; ") || "None recorded"}

Known Allergies: ${patientData.allergies.map(a => `${a.allergen} (${a.severity}) - ${a.reaction}`).join("; ") || "None recorded"}

Recent Lab Concerns: ${abnormalLabs.length > 0 ? abnormalLabs.map(l => `${l.testName}: ${l.value} ${l.unit} (ref: ${l.referenceRange.low}-${l.referenceRange.high}, status: ${l.status})`).join("; ") : "All labs within normal range"}

Recent Vitals: ${patientData.vitalSigns.slice(0, 5).map(v => `${v.type}: ${v.value} ${v.unit}`).join(", ") || "No recent vitals"}

Generate a personalized education plan with articles relevant to this patient's specific health situation.`;

      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.7,
        maxTokens: 4000,
        responseMimeType: "application/json",
      });

      if (!content) throw new Error("No response from AI");

      const parsed = JSON.parse(content);
      const plan: CuratedEducationPlan = {
        patientId,
        welcomeMessage: parsed.welcomeMessage || "Welcome to your personalized health learning plan!",
        focusAreas: parsed.focusAreas || [],
        articles: (parsed.articles || []).map((a: any, idx: number) => ({
          id: `curated-${generateId()}-${idx}`,
          category: a.category || "lifestyle",
          title: a.title || "Health Education",
          summary: a.summary || "",
          content: a.content || "",
          keyTakeaways: a.keyTakeaways || [],
          actionItems: a.actionItems || [],
          relatedTo: a.relatedTo || [],
          difficulty: a.difficulty || "beginner",
          estimatedMinutes: a.estimatedMinutes || 5,
          relevanceScore: a.relevanceScore || 0.5,
          isRead: false,
        })),
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER,
      };

      curatedPlansCache.set(cacheKey, { plan, generatedAtTimestamp: Date.now() });
      return plan;

    } catch (error) {
      console.error("[PatientEducation] Curate plan error:", error);
      return this.getFallbackCuratedPlan(patientId, patientData);
    }
  }

  private getFallbackCuratedPlan(patientId: string, patientData: any): CuratedEducationPlan {
    const articles: CuratedArticle[] = [];

    for (const condition of (patientData.conditions || []).filter((c: any) => c.status === "active")) {
      articles.push({
        id: `fallback-cond-${generateId()}`,
        category: "conditions",
        title: `Understanding ${condition.name}`,
        summary: `Learn what ${condition.name} means for your daily life and how to manage it effectively.`,
        content: `${condition.name} is a health condition that your care team is helping you manage. Understanding your condition is one of the most important steps toward better health.\n\nWhile every person's experience is different, staying informed and working closely with your healthcare provider can help you feel more in control. Regular check-ups, following your care plan, and asking questions are all great ways to stay on top of your health.\n\nRemember: you are not alone in this journey. Your healthcare team is here to support you.`,
        keyTakeaways: [
          `${condition.name} is manageable with proper care and attention`,
          "Regular follow-ups with your provider are important",
          "Don't hesitate to ask your care team questions",
        ],
        actionItems: [
          "Keep a journal of any symptoms or changes you notice",
          "Prepare questions before your next provider visit",
          "Learn about lifestyle changes that may help",
        ],
        relatedTo: [condition.name],
        difficulty: "beginner",
        estimatedMinutes: 4,
        relevanceScore: 0.9,
        isRead: false,
      });
    }

    for (const med of (patientData.medications || []).slice(0, 4)) {
      articles.push({
        id: `fallback-med-${generateId()}`,
        category: "medications",
        title: `Your Guide to ${med.name}`,
        summary: `Important information about ${med.name} (${med.dosage}), including when and how to take it.`,
        content: `${med.name} is a medication prescribed by your healthcare provider${med.prescribedFor ? ` to help manage ${med.prescribedFor}` : ""}. Taking your medication as directed is an important part of your health plan.\n\nYour prescribed dosage is ${med.dosage}, taken ${med.frequency}. Try to take it at the same time each day to build a routine. If you miss a dose, check with your pharmacist or provider about what to do.\n\nAlways let your healthcare provider know about any side effects or concerns you may have.`,
        keyTakeaways: [
          `Take ${med.name} ${med.dosage} as prescribed (${med.frequency})`,
          "Consistency in timing helps your medication work best",
          "Report any unusual side effects to your provider",
        ],
        actionItems: [
          "Set a daily reminder for your medication",
          "Keep a list of all your medications to share with providers",
          "Ask your pharmacist about any food or drug interactions",
        ],
        relatedTo: [med.name],
        difficulty: "beginner",
        estimatedMinutes: 3,
        relevanceScore: 0.85,
        isRead: false,
      });
    }

    articles.push({
      id: `fallback-lifestyle-${generateId()}`,
      category: "lifestyle",
      title: "Building Healthy Habits That Stick",
      summary: "Small, consistent changes can make a big difference in your overall well-being.",
      content: "Improving your health doesn't require dramatic changes all at once. Research shows that small, consistent habits are more effective than big, unsustainable ones.\n\nStart with one change at a time. Whether it's adding a 10-minute walk after lunch, drinking an extra glass of water, or getting to bed 15 minutes earlier, each step matters.\n\nTrack your progress and celebrate small wins. Your healthcare journey is a marathon, not a sprint.",
      keyTakeaways: [
        "Start with one small change at a time",
        "Consistency matters more than perfection",
        "Track your progress to stay motivated",
      ],
      actionItems: [
        "Choose one healthy habit to start this week",
        "Set a specific time and place for your new habit",
        "Share your health goals with someone supportive",
      ],
      relatedTo: ["General Wellness"],
      difficulty: "beginner",
      estimatedMinutes: 3,
      relevanceScore: 0.7,
      isRead: false,
    });

    articles.push({
      id: `fallback-lifestyle-nutrition-${generateId()}`,
      category: "lifestyle",
      title: "Nutrition Basics for Better Health",
      summary: "Simple nutrition tips that can support your health conditions and overall well-being.",
      content: "Good nutrition is one of the foundations of good health. While every person's dietary needs are different, some general principles can benefit most people.\n\nFocus on whole foods: fruits, vegetables, whole grains, and lean proteins. Try to limit processed foods, excess sugar, and sodium. Staying hydrated is also important for your body to function at its best.\n\nIf you have specific conditions like diabetes or high blood pressure, your provider may have additional dietary recommendations. Don't hesitate to ask for a referral to a registered dietitian.",
      keyTakeaways: [
        "Whole foods provide the best nutrition",
        "Hydration is essential for all body functions",
        "Your provider can offer personalized dietary advice",
      ],
      actionItems: [
        "Add one extra serving of vegetables to your daily meals",
        "Keep a water bottle with you to stay hydrated",
        "Ask your provider about any dietary restrictions for your conditions",
      ],
      relatedTo: ["General Wellness"],
      difficulty: "beginner",
      estimatedMinutes: 4,
      relevanceScore: 0.65,
      isRead: false,
    });

    return {
      patientId,
      welcomeMessage: "Welcome to your personalized health learning plan! We've prepared educational content based on your health profile to help you understand your conditions and medications better.",
      focusAreas: [
        ...patientData.conditions.filter((c: any) => c.status === "active").map((c: any) => c.name).slice(0, 2),
        "Healthy Living",
      ],
      articles,
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export interface CuratedArticle {
  id: string;
  category: "conditions" | "medications" | "lifestyle" | "recent_changes";
  title: string;
  summary: string;
  content: string;
  keyTakeaways: string[];
  actionItems: string[];
  relatedTo: string[];
  difficulty: "beginner" | "intermediate";
  estimatedMinutes: number;
  relevanceScore: number;
  isRead: boolean;
}

export interface CuratedEducationPlan {
  patientId: string;
  welcomeMessage: string;
  focusAreas: string[];
  articles: CuratedArticle[];
  generatedAt: string;
  disclaimer: string;
}

const curatedPlansCache = new Map<string, { plan: CuratedEducationPlan; generatedAtTimestamp: number }>();

export const aiPatientEducationModuleService = new AIPatientEducationModuleService();
