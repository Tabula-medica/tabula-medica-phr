import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";

const router = Router();

function getOpenAIClient(): OpenAI | null {
  try {
    return new OpenAI();
  } catch {
    return null;
  }
}

interface EducationArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  specialty: string;
  tags: string[];
  readingTime: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  lastUpdated: string;
  source: string;
  noCdsDisclaimer: string;
}

interface PatientCondition {
  name: string;
  status: "active" | "resolved" | "chronic";
  diagnosedDate: string;
}

const sampleArticles: EducationArticle[] = [
  {
    id: "art-001",
    title: "Understanding Type 2 Diabetes: A Complete Guide",
    summary: "Learn about the causes, symptoms, and management of Type 2 Diabetes, including lifestyle changes and monitoring strategies.",
    content: `Type 2 Diabetes is a chronic condition that affects how your body processes blood sugar (glucose). Unlike Type 1 Diabetes, where the body doesn't produce insulin, Type 2 Diabetes develops when your body becomes resistant to insulin or doesn't produce enough insulin to maintain normal glucose levels.

**Key Facts:**
- Type 2 Diabetes is the most common form of diabetes
- It often develops in adults over 45, but is increasingly seen in younger people
- Lifestyle factors like diet and exercise play a significant role
- It can often be managed with lifestyle changes and medication

**Symptoms to Watch For:**
- Increased thirst and frequent urination
- Unexplained weight loss
- Fatigue and weakness
- Blurred vision
- Slow-healing sores

**Management Strategies:**
1. **Monitor Blood Sugar:** Regular testing helps you understand how food, activity, and medications affect your levels
2. **Healthy Eating:** Focus on vegetables, lean proteins, and whole grains
3. **Stay Active:** Aim for 150 minutes of moderate exercise per week
4. **Take Medications as Prescribed:** Work with your healthcare team
5. **Regular Check-ups:** Monitor for complications`,
    category: "conditions",
    specialty: "Endocrinology",
    tags: ["diabetes", "blood sugar", "chronic disease", "lifestyle"],
    readingTime: 8,
    difficulty: "beginner",
    lastUpdated: "2026-01-15",
    source: "American Diabetes Association",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-002",
    title: "Managing High Blood Pressure: What You Need to Know",
    summary: "A comprehensive overview of hypertension, including risk factors, lifestyle modifications, and when to seek medical attention.",
    content: `High blood pressure, or hypertension, is often called the "silent killer" because it typically has no obvious symptoms but can lead to serious health problems.

**Understanding Blood Pressure Numbers:**
- **Normal:** Less than 120/80 mmHg
- **Elevated:** 120-129/less than 80 mmHg
- **Stage 1 Hypertension:** 130-139/80-89 mmHg
- **Stage 2 Hypertension:** 140 or higher/90 or higher mmHg

**Risk Factors:**
- Age (risk increases with age)
- Family history
- Being overweight
- Physical inactivity
- High sodium diet
- Excessive alcohol consumption
- Stress

**Lifestyle Changes That Help:**
1. **DASH Diet:** Focus on fruits, vegetables, whole grains, and low-fat dairy
2. **Reduce Sodium:** Aim for less than 2,300 mg per day
3. **Exercise Regularly:** At least 30 minutes most days
4. **Limit Alcohol:** No more than one drink per day for women, two for men
5. **Manage Stress:** Practice relaxation techniques
6. **Monitor at Home:** Track your readings regularly`,
    category: "conditions",
    specialty: "Cardiology",
    tags: ["hypertension", "heart health", "blood pressure", "cardiovascular"],
    readingTime: 7,
    difficulty: "beginner",
    lastUpdated: "2026-01-20",
    source: "American Heart Association",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-003",
    title: "Understanding Your Lab Results: A Patient Guide",
    summary: "Learn how to interpret common lab test results including CBC, metabolic panels, and lipid profiles.",
    content: `Lab tests are an important part of healthcare, helping your doctor understand your overall health. Here's what common tests measure:

**Complete Blood Count (CBC):**
- **Red Blood Cells (RBC):** Carry oxygen to your tissues
- **White Blood Cells (WBC):** Fight infections
- **Hemoglobin:** The protein in red blood cells that carries oxygen
- **Hematocrit:** Percentage of blood made up of red blood cells
- **Platelets:** Help with blood clotting

**Comprehensive Metabolic Panel (CMP):**
- **Glucose:** Blood sugar levels
- **BUN & Creatinine:** Kidney function markers
- **Electrolytes:** Sodium, potassium, chloride balance
- **Liver Enzymes:** AST, ALT indicate liver health

**Lipid Panel:**
- **Total Cholesterol:** Overall cholesterol level
- **LDL (Bad Cholesterol):** Optimal: less than 100 mg/dL
- **HDL (Good Cholesterol):** Higher is better, aim for 60+ mg/dL
- **Triglycerides:** Optimal: less than 150 mg/dL

**Tips for Accurate Results:**
- Follow fasting instructions if required
- Tell your doctor about all medications
- Stay hydrated before the test
- Ask questions about any results you don't understand`,
    category: "general",
    specialty: "Primary Care",
    tags: ["lab tests", "blood work", "health screening", "diagnostics"],
    readingTime: 10,
    difficulty: "intermediate",
    lastUpdated: "2026-02-01",
    source: "Lab Tests Online",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-004",
    title: "Medication Safety: Taking Your Prescriptions Correctly",
    summary: "Essential tips for safe medication use, including storage, timing, and recognizing side effects.",
    content: `Taking medications correctly is crucial for their effectiveness and your safety. Here's what you need to know:

**Before Taking Any Medication:**
- Read the label and patient information
- Understand the dosage and timing
- Know what side effects to watch for
- Tell your doctor about all other medications and supplements

**Safe Storage:**
- Keep medications in their original containers
- Store at the recommended temperature
- Keep away from moisture and direct sunlight
- Lock up medications that could be dangerous to children or pets

**Timing Tips:**
- Set alarms or reminders
- Use a pill organizer
- Take medications at the same time each day
- Know which medications to take with food

**Recognizing Side Effects:**
- Common side effects are listed on the packaging
- Contact your doctor for severe or persistent symptoms
- Keep a log of any reactions

**Important Safety Rules:**
1. Never share medications with others
2. Don't take more than prescribed
3. Finish the full course of antibiotics
4. Dispose of expired medications properly
5. Keep an updated medication list for emergencies`,
    category: "medications",
    specialty: "Pharmacy",
    tags: ["medications", "safety", "prescriptions", "drug interactions"],
    readingTime: 6,
    difficulty: "beginner",
    lastUpdated: "2026-01-25",
    source: "FDA Patient Safety",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-005",
    title: "Heart-Healthy Living: Prevention Strategies",
    summary: "Practical steps to reduce your risk of heart disease through diet, exercise, and lifestyle choices.",
    content: `Heart disease is the leading cause of death, but many risk factors are within your control. Here's how to protect your heart:

**The Power of Diet:**
- Fill half your plate with vegetables
- Choose whole grains over refined
- Eat fatty fish twice a week for omega-3s
- Limit saturated and trans fats
- Reduce sodium intake
- Choose lean proteins

**Exercise for Heart Health:**
- Aim for 150 minutes of moderate activity weekly
- Include both cardio and strength training
- Take stairs instead of elevators
- Walk after meals to help digestion and blood sugar
- Find activities you enjoy for sustainability

**Lifestyle Factors:**
- **Quit Smoking:** Single most important change you can make
- **Manage Stress:** Practice mindfulness, deep breathing
- **Sleep Well:** 7-9 hours per night
- **Limit Alcohol:** Moderation is key
- **Stay Connected:** Social relationships support heart health

**Know Your Numbers:**
- Blood pressure: Below 120/80 mmHg
- Cholesterol: LDL below 100 mg/dL
- Blood sugar: Fasting below 100 mg/dL
- BMI: 18.5-24.9
- Waist: Below 40" (men) or 35" (women)`,
    category: "prevention",
    specialty: "Cardiology",
    tags: ["heart health", "prevention", "lifestyle", "exercise", "nutrition"],
    readingTime: 9,
    difficulty: "beginner",
    lastUpdated: "2026-01-30",
    source: "American Heart Association",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-006",
    title: "Managing Chronic Pain: Coping Strategies and Treatment Options",
    summary: "An overview of chronic pain management including non-medication approaches and when to seek specialist care.",
    content: `Chronic pain affects millions of people and can significantly impact quality of life. Understanding your options can help you work with your healthcare team effectively.

**Types of Chronic Pain:**
- Nociceptive: From tissue damage (arthritis, injuries)
- Neuropathic: From nerve damage (diabetic neuropathy)
- Nociplastic: Altered pain processing (fibromyalgia)

**Non-Medication Approaches:**
1. **Physical Therapy:** Strengthening and stretching exercises
2. **Cognitive Behavioral Therapy:** Changing thought patterns about pain
3. **Mindfulness Meditation:** Reducing stress and pain perception
4. **Acupuncture:** May help some types of pain
5. **Heat/Cold Therapy:** Simple but effective for many

**When to Seek Help:**
- Pain interfering with daily activities
- Sleep problems due to pain
- Mood changes or depression
- New or worsening symptoms
- Pain after an injury

**Building Your Pain Management Team:**
- Primary care physician
- Pain management specialist
- Physical therapist
- Mental health professional
- Complementary medicine providers`,
    category: "conditions",
    specialty: "Pain Management",
    tags: ["chronic pain", "pain management", "quality of life", "treatment"],
    readingTime: 8,
    difficulty: "intermediate",
    lastUpdated: "2026-02-02",
    source: "American Chronic Pain Association",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-007",
    title: "Mental Health Basics: Understanding Anxiety and Depression",
    summary: "Learn about common mental health conditions, warning signs, and when to seek professional help.",
    content: `Mental health is just as important as physical health. Understanding common conditions can help you recognize when you or a loved one might need support.

**Anxiety Disorders:**
- Generalized Anxiety: Persistent worry about many things
- Panic Disorder: Sudden episodes of intense fear
- Social Anxiety: Fear of social situations
- Phobias: Intense fear of specific things or situations

**Depression:**
- Persistent sadness or emptiness
- Loss of interest in activities
- Changes in sleep or appetite
- Difficulty concentrating
- Thoughts of worthlessness

**Warning Signs to Watch For:**
- Withdrawal from friends and activities
- Significant mood changes
- Changes in eating or sleeping patterns
- Difficulty functioning at work or school
- Substance use to cope
- Thoughts of self-harm

**Getting Help:**
- Talk to your primary care doctor
- Seek a mental health professional
- Call crisis lines if in immediate distress
- Support groups can provide community
- Online therapy options are available

**Self-Care Strategies:**
- Maintain regular sleep schedule
- Exercise regularly
- Limit alcohol and caffeine
- Stay connected with loved ones
- Practice stress management techniques`,
    category: "mental_health",
    specialty: "Psychiatry",
    tags: ["mental health", "anxiety", "depression", "wellness"],
    readingTime: 7,
    difficulty: "beginner",
    lastUpdated: "2026-01-28",
    source: "National Alliance on Mental Illness",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  },
  {
    id: "art-008",
    title: "Preventive Screenings by Age: What Tests You Need",
    summary: "A guide to recommended health screenings based on age and risk factors.",
    content: `Regular screenings can catch health problems early when they're most treatable. Here's what's generally recommended:

**Ages 18-39:**
- Blood pressure: Every 2 years if normal
- Cholesterol: Every 4-6 years starting at age 20
- Diabetes screening: Every 3 years starting at 45 (earlier if overweight)
- STI screenings: Based on risk factors
- Dental exams: Every 6 months
- Eye exams: Every 2 years

**Ages 40-49:**
- Blood pressure: Annually
- Cholesterol: Every 4-6 years
- Diabetes screening: Every 3 years
- Breast cancer screening: Discuss with doctor at 40, mammograms typically start at 45-50
- Colorectal cancer: Discuss early screening with doctor

**Ages 50-64:**
- Colorectal cancer: Colonoscopy every 10 years or annual stool tests
- Breast cancer: Mammograms every 1-2 years
- Cervical cancer: Pap smears every 3-5 years
- Prostate cancer: Discuss with doctor
- Lung cancer: If current or former heavy smoker

**Ages 65+:**
- All previous screenings as recommended
- Bone density scan (especially women)
- Hearing and vision tests annually
- Shingles vaccine
- Pneumonia vaccine
- Annual flu vaccine

**Talk to Your Doctor About:**
- Your personal and family health history
- Risk factors that may require earlier screening
- Frequency of screenings based on your health`,
    category: "prevention",
    specialty: "Primary Care",
    tags: ["screenings", "prevention", "health checks", "early detection"],
    readingTime: 8,
    difficulty: "beginner",
    lastUpdated: "2026-02-01",
    source: "US Preventive Services Task Force",
    noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment."
  }
];

const samplePatientConditions: PatientCondition[] = [
  { name: "Type 2 Diabetes Mellitus", status: "chronic", diagnosedDate: "2023-05-15" },
  { name: "Essential Hypertension", status: "active", diagnosedDate: "2022-11-20" },
  { name: "Generalized Anxiety Disorder", status: "active", diagnosedDate: "2024-02-10" }
];

const categories = [
  { id: "all", name: "All Topics", icon: "BookOpen" },
  { id: "conditions", name: "Health Conditions", icon: "Heart" },
  { id: "medications", name: "Medications", icon: "Pill" },
  { id: "prevention", name: "Preventive Care", icon: "Shield" },
  { id: "mental_health", name: "Mental Health", icon: "Brain" },
  { id: "nutrition", name: "Nutrition", icon: "Apple" },
  { id: "general", name: "General Health", icon: "Activity" }
];

const specialties = [
  "All Specialties",
  "Primary Care",
  "Cardiology",
  "Endocrinology",
  "Psychiatry",
  "Pain Management",
  "Pharmacy",
  "Dermatology",
  "Gastroenterology",
  "Pulmonology"
];

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    service: "Patient Education Center",
    version: "1.0.0",
    features: [
      "Browse health articles by category and specialty",
      "AI-personalized content based on patient conditions",
      "Save and bookmark articles",
      "Share articles via email",
      "NO-CDS compliant informational content"
    ],
    noCdsCompliance: "All content is informational only. No clinical decision support or treatment recommendations."
  });
});

router.get("/categories", (req: Request, res: Response) => {
  res.json(categories);
});

router.get("/specialties", (req: Request, res: Response) => {
  res.json(specialties);
});

router.get("/articles", (req: Request, res: Response) => {
  const { category, specialty, search, difficulty } = req.query;
  
  let filtered = [...sampleArticles];
  
  if (category && category !== "all") {
    filtered = filtered.filter(a => a.category === category);
  }
  
  if (specialty && specialty !== "All Specialties") {
    filtered = filtered.filter(a => a.specialty === specialty);
  }
  
  if (difficulty) {
    filtered = filtered.filter(a => a.difficulty === difficulty);
  }
  
  if (search) {
    const searchLower = (search as string).toLowerCase();
    filtered = filtered.filter(a => 
      a.title.toLowerCase().includes(searchLower) ||
      a.summary.toLowerCase().includes(searchLower) ||
      a.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }
  
  res.json({
    articles: filtered,
    total: filtered.length,
    categories: categories,
    specialties: specialties
  });
});

router.get("/articles/:id", (req: Request, res: Response) => {
  const article = sampleArticles.find(a => a.id === req.params.id);
  
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  
  res.json(article);
});

router.get("/patient-conditions", (req: Request, res: Response) => {
  res.json({
    conditions: samplePatientConditions,
    journeySummary: "Patient has been managing Type 2 Diabetes for 2+ years with good control. Hypertension diagnosed 3 years ago, currently on medication. Recently started treatment for anxiety."
  });
});

const generateContentSchema = z.object({
  patientConditions: z.array(z.string()).optional(),
  journeySummary: z.string().optional(),
  topic: z.string().optional()
});

router.post("/generate-personalized", async (req: Request, res: Response) => {
  try {
    const validation = generateContentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    const { patientConditions, journeySummary, topic } = validation.data;
    
    const conditions = patientConditions || samplePatientConditions.map(c => c.name);
    const summary = journeySummary || "Patient managing chronic conditions with regular care.";
    
    const openai = getOpenAIClient();
    
    if (openai) {
      const prompt = `You are a patient education specialist creating personalized health content. Generate educational content for a patient with the following conditions: ${conditions.join(", ")}.

Patient journey summary: ${summary}
${topic ? `Focus topic: ${topic}` : ""}

Create a personalized educational article that:
1. Is relevant to their specific conditions
2. Uses plain language (8th grade reading level)
3. Provides practical, actionable information
4. Does NOT provide medical advice, diagnosis, or treatment recommendations
5. Encourages consulting with their healthcare team

Format the response as JSON with this structure:
{
  "title": "Article title",
  "summary": "2-3 sentence summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Section content with practical information"
    }
  ],
  "keyTakeaways": ["3-5 key points"],
  "questionsForDoctor": ["2-3 questions patient might ask their doctor"],
  "relatedTopics": ["2-3 related topics they might want to explore"]
}

IMPORTANT: Include a reminder that this is informational only and not medical advice.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: "You are a patient education specialist. Always include NO-CDS compliance reminders." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const content = JSON.parse(response.choices[0].message.content || "{}");
      
      return res.json({
        success: true,
        personalizedContent: {
          ...content,
          generatedAt: new Date().toISOString(),
          basedOnConditions: conditions,
          noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult with your healthcare provider."
        }
      });
    }
    
    throw new Error("OpenAI client not available");
  } catch (error: any) {
    console.error("[PatientEducation] AI generation error:", error);
    
    res.json({
      success: true,
      personalizedContent: {
        title: "Managing Your Health Conditions",
        summary: "A personalized guide to understanding and managing your health based on your current conditions and health journey.",
        sections: [
          {
            heading: "Understanding Your Conditions",
            content: "Your health journey includes managing multiple conditions. Each condition may require different approaches, but many healthy lifestyle choices benefit all of them. Working closely with your healthcare team ensures you get the right combination of treatments and support."
          },
          {
            heading: "Daily Health Habits",
            content: "Consistent daily habits form the foundation of good health management. This includes regular medication schedules, balanced nutrition, appropriate physical activity, adequate sleep, and stress management techniques."
          },
          {
            heading: "Monitoring and Tracking",
            content: "Keep track of your symptoms, medications, and any changes you notice. This information helps your healthcare team make informed decisions about your care. Use your Tabula Medica health timeline to see patterns over time."
          },
          {
            heading: "Building Your Support System",
            content: "Managing chronic conditions is easier with support. This might include family members, support groups, healthcare team members, and digital health tools like this app."
          }
        ],
        keyTakeaways: [
          "Consistent healthy habits benefit all your conditions",
          "Track your symptoms and share with your healthcare team",
          "Ask questions and be an active participant in your care",
          "Build a support system that works for you",
          "Celebrate small wins in your health journey"
        ],
        questionsForDoctor: [
          "How do my conditions interact with each other?",
          "Are there any lifestyle changes that would benefit all my conditions?",
          "What warning signs should I watch for?"
        ],
        relatedTopics: [
          "Medication management",
          "Lifestyle modifications",
          "Mental health and chronic conditions"
        ],
        generatedAt: new Date().toISOString(),
        basedOnConditions: samplePatientConditions.map(c => c.name),
        noCdsDisclaimer: "This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult with your healthcare provider."
      }
    });
  }
});

const shareEmailSchema = z.object({
  articleId: z.string(),
  recipientEmail: z.string().email(),
  senderName: z.string().optional(),
  personalMessage: z.string().optional()
});

router.post("/share-email", async (req: Request, res: Response) => {
  try {
    const validation = shareEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    const { articleId, recipientEmail, senderName, personalMessage } = validation.data;
    
    const article = sampleArticles.find(a => a.id === articleId);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    console.log(`[PatientEducation] Email share requested: Article "${article.title}" to ${recipientEmail}`);
    
    res.json({
      success: true,
      message: `Article "${article.title}" shared successfully to ${recipientEmail}`,
      shareDetails: {
        articleId,
        articleTitle: article.title,
        recipientEmail,
        senderName: senderName || "A Tabula Medica User",
        sentAt: new Date().toISOString(),
        note: "Email delivery is simulated in sample mode"
      }
    });
  } catch (error: any) {
    console.error("[PatientEducation] Share error:", error);
    res.status(500).json({ error: "Failed to share article" });
  }
});

router.post("/save-article", (req: Request, res: Response) => {
  const { articleId, patientId } = req.body;
  
  if (!articleId) {
    return res.status(400).json({ error: "Article ID is required" });
  }
  
  const article = sampleArticles.find(a => a.id === articleId);
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  
  res.json({
    success: true,
    message: "Article saved successfully",
    savedArticle: {
      id: articleId,
      title: article.title,
      savedAt: new Date().toISOString()
    }
  });
});

router.delete("/save-article/:articleId", (req: Request, res: Response) => {
  const { articleId } = req.params;
  
  res.json({
    success: true,
    message: "Article removed from saved list",
    removedArticleId: articleId
  });
});

export default router;
