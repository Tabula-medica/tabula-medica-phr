import { Router, Request, Response } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const EVIDENCE_SYSTEM_PROMPT = `You are a global health education assistant for Tabula Medica, a patient health records platform. You provide evidence-based, WHO-guideline-aligned health information to patients worldwide.

CRITICAL RULES:
- You are NOT a doctor. You provide INFORMATIONAL content only.
- NEVER diagnose conditions or prescribe treatments.
- NEVER recommend specific medications or dosages.
- Always recommend consulting a qualified healthcare provider for medical decisions.
- Base your responses on widely accepted medical evidence and WHO/international health guidelines.
- When citing evidence, reference the source type (e.g., "According to WHO guidelines..." or "Research published in peer-reviewed journals suggests...").
- Use clear, simple language accessible to a general audience.
- Be culturally sensitive and consider that users may be from any country.
- Include a brief disclaimer at the end of every response.

You can help with:
1. General wellness and preventive health guidance
2. Understanding common health conditions (educational only)
3. Nutrition and dietary information based on international guidelines
4. Exercise and physical activity recommendations
5. Mental health awareness and self-care strategies
6. Understanding lab results and vital signs (general ranges only)
7. Preventive screening recommendations by age group
8. Travel health and vaccination information
9. Chronic disease self-management education
10. Health literacy — explaining medical terms in simple language`;

const DISCLAIMER = "\n\n---\n*This information is for educational purposes only and is not medical advice. Always consult a qualified healthcare provider for diagnosis, treatment, or medical decisions specific to your situation.*";

interface AdvisorTopic {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompts: string[];
}

const ADVISOR_TOPICS: AdvisorTopic[] = [
  {
    id: "wellness",
    title: "Wellness & Prevention",
    description: "Evidence-based wellness tips and preventive health strategies",
    icon: "heart",
    prompts: [
      "What are WHO-recommended daily exercise guidelines for adults?",
      "What preventive health screenings should I consider at my age?",
      "How can I improve my sleep quality based on current evidence?",
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition & Diet",
    description: "International dietary guidelines and nutritional advice",
    icon: "apple",
    prompts: [
      "What does a balanced diet look like according to WHO guidelines?",
      "How can I manage my blood sugar through diet?",
      "What are evidence-based approaches to reducing sodium intake?",
    ],
  },
  {
    id: "mental-health",
    title: "Mental Health & Wellbeing",
    description: "Mental health awareness, stress management, and coping strategies",
    icon: "brain",
    prompts: [
      "What are evidence-based stress reduction techniques?",
      "How can I recognize signs of anxiety or depression?",
      "What are WHO recommendations for mental health self-care?",
    ],
  },
  {
    id: "chronic-conditions",
    title: "Understanding Conditions",
    description: "Educational information about common health conditions",
    icon: "stethoscope",
    prompts: [
      "Explain type 2 diabetes in simple terms — causes, risk factors, and management",
      "What should I know about high blood pressure?",
      "How does asthma work and what triggers should I be aware of?",
    ],
  },
  {
    id: "lab-results",
    title: "Understanding Lab Results",
    description: "General guidance on interpreting common lab values",
    icon: "test-tube",
    prompts: [
      "What do common blood test results mean (CBC, metabolic panel)?",
      "What is HbA1c and what do the numbers mean?",
      "What are normal ranges for cholesterol levels?",
    ],
  },
  {
    id: "travel-health",
    title: "Travel & Global Health",
    description: "Travel health guidance, vaccines, and global health information",
    icon: "globe",
    prompts: [
      "What vaccines might I need for international travel?",
      "How can I prevent common travel-related illnesses?",
      "What health precautions should I take in tropical regions?",
    ],
  },
  {
    id: "family-health",
    title: "Family & Child Health",
    description: "Pediatric health, family wellness, and maternal care information",
    icon: "users",
    prompts: [
      "What is the WHO-recommended vaccination schedule for children?",
      "What are developmental milestones for toddlers?",
      "What nutrition guidelines exist for pregnant women?",
    ],
  },
  {
    id: "first-aid",
    title: "First Aid & Emergency Info",
    description: "Basic first aid knowledge and when to seek emergency care",
    icon: "shield",
    prompts: [
      "What are the basic first aid steps for common injuries?",
      "When should I go to the emergency room vs urgent care?",
      "What are the warning signs of a heart attack or stroke?",
    ],
  },
];

router.get("/topics", async (_req: Request, res: Response) => {
  res.json(ADVISOR_TOPICS);
});

router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { question, topicId, language } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (question.length > 1000) {
      return res.status(400).json({ error: "Question must be under 1000 characters" });
    }

    const languageInstruction = language && language !== "en"
      ? `\nIMPORTANT: Respond in the user's preferred language: ${language}. Keep medical terms in English with a translated explanation.`
      : "";

    const topicContext = topicId
      ? `\nThe user is asking about the topic: "${ADVISOR_TOPICS.find(t => t.id === topicId)?.title || topicId}".`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: EVIDENCE_SYSTEM_PROMPT + languageInstruction + topicContext,
        },
        {
          role: "user",
          content: question,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const answer = (completion.choices[0]?.message?.content || "I was unable to generate a response. Please try again.") + DISCLAIMER;

    res.json({
      answer,
      topic: topicId || "general",
      sources: "WHO guidelines, peer-reviewed medical literature, and international health standards",
      disclaimer: "This information is for educational purposes only and is not medical advice.",
    });
  } catch (error: any) {
    console.error("[AIEvidenceAdvisor] Error:", error?.message || error);

    if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
      return res.status(429).json({ error: "AI service is temporarily busy. Please try again in a moment." });
    }

    const fallbackResponses: Record<string, string> = {
      wellness: "**General Wellness Tips (WHO Guidelines)**\n\nThe World Health Organization recommends:\n\n• **Physical Activity**: Adults should do at least 150-300 minutes of moderate-intensity aerobic activity per week\n• **Diet**: Eat at least 5 portions (400g) of fruits and vegetables daily\n• **Sleep**: Adults need 7-9 hours of quality sleep per night\n• **Hydration**: Drink adequate water throughout the day (typically 2-3 liters)\n• **Mental Health**: Practice stress management techniques and maintain social connections\n• **Preventive Care**: Stay up to date with recommended health screenings for your age group\n\nThese are general guidelines — your specific needs may vary based on your health conditions, age, and other factors.",
      nutrition: "**Balanced Nutrition (WHO Dietary Guidelines)**\n\n• **Fruits & Vegetables**: At least 400g (5 portions) daily\n• **Whole Grains**: Choose whole grain over refined options\n• **Protein**: Include lean meats, fish, legumes, nuts\n• **Fats**: Less than 30% of total energy from fats; prefer unsaturated\n• **Sugar**: Less than 10% of total energy from free sugars (ideally under 5%)\n• **Salt**: Less than 5g per day to help prevent hypertension\n• **Fiber**: At least 25g per day from whole foods\n\nAdapt these guidelines to locally available foods and cultural dietary practices.",
      "mental-health": "**Mental Health Self-Care (WHO Recommendations)**\n\n• **Stay Connected**: Maintain relationships with family and friends\n• **Stay Active**: Regular physical activity improves mood and reduces anxiety\n• **Be Present**: Mindfulness and breathing exercises can reduce stress\n• **Sleep Well**: Maintain a consistent sleep schedule\n• **Limit Substances**: Reduce alcohol and avoid recreational drugs\n• **Seek Help**: Talk to a healthcare provider if feelings of sadness, anxiety, or stress persist for more than 2 weeks\n• **Take Breaks**: Regular breaks from work and screens support mental wellbeing\n\nMental health is just as important as physical health. There is no shame in seeking professional support.",
      general: "**Evidence-Based Health Information**\n\nFor reliable health information, consider these trusted sources:\n\n• **WHO** (World Health Organization): Global health guidelines and disease information\n• **CDC** (Centers for Disease Control): Disease prevention and health promotion\n• **NHS** (UK National Health Service): Patient-friendly health information\n• **MedlinePlus**: US National Library of Medicine consumer health resource\n\nAlways verify health information from multiple reliable sources and consult a healthcare professional for personalized medical advice.",
    };

    const fallback = fallbackResponses[req.body.topicId] || fallbackResponses.general;
    res.json({
      answer: fallback + DISCLAIMER,
      topic: req.body.topicId || "general",
      sources: "WHO guidelines, international health standards",
      disclaimer: "This information is for educational purposes only and is not medical advice.",
      fallback: true,
    });
  }
});

router.post("/explain-term", async (req: Request, res: Response) => {
  try {
    const { term, language } = req.body;

    if (!term || typeof term !== "string") {
      return res.status(400).json({ error: "Medical term is required" });
    }

    const langNote = language && language !== "en"
      ? `Respond in ${language}. Keep the medical term in English but explain in ${language}.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical terminology educator. Explain medical terms in simple, everyday language that anyone can understand. Include: 1) A simple definition, 2) Why it matters for health, 3) When someone might encounter this term. Keep it brief (3-4 sentences). ${langNote}`,
        },
        {
          role: "user",
          content: `Explain the medical term: "${term}"`,
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    res.json({
      term,
      explanation: completion.choices[0]?.message?.content || "Unable to explain this term at the moment.",
      disclaimer: "This is for educational purposes only.",
    });
  } catch (error: any) {
    console.error("[AIEvidenceAdvisor] Term explanation error:", error?.message);
    res.json({
      term: req.body.term,
      explanation: `"${req.body.term}" is a medical term. For an accurate explanation specific to your health situation, please consult your healthcare provider or visit WHO.int for general health information.`,
      disclaimer: "This is for educational purposes only.",
      fallback: true,
    });
  }
});

export default router;
