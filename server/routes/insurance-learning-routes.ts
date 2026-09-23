import { Router, Request, Response } from "express";
import { generatePhiSafeText } from "../services/ai-gateway";

const router = Router();

interface LessonModule {
  id: string;
  title: string;
  titleKey: string;
  description: string;
  icon: string;
  category: string;
  steps: LessonStep[];
  quiz: QuizQuestion[];
}

interface LessonStep {
  id: string;
  title: string;
  content: string;
  analogy: string;
  keyTakeaway: string;
  example?: { scenario: string; breakdown: string };
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const lessonModules: LessonModule[] = [
  {
    id: "copay",
    title: "Understanding Copays",
    titleKey: "insurance_copay",
    description: "Learn what copays are, how they work, and how to minimize your out-of-pocket costs at doctor visits.",
    icon: "DollarSign",
    category: "costs",
    steps: [
      {
        id: "copay-1",
        title: "What is a Copay?",
        content: "A copay (or co-payment) is a fixed amount you pay each time you receive a specific healthcare service. Think of it as an entry fee — you pay your share, and your insurance covers the rest.",
        analogy: "Imagine a movie theater where your company has a deal: you always pay $5 for a ticket, no matter if the movie costs $15 or $50 to produce. That $5 is your copay.",
        keyTakeaway: "A copay is a flat fee you pay at the time of service. It stays the same regardless of the total cost.",
      },
      {
        id: "copay-2",
        title: "Types of Copays",
        content: "Different services have different copay amounts. Typically: Primary care visits ($20-40), Specialist visits ($40-75), Urgent care ($50-100), Emergency room ($150-500), Prescription drugs ($5-100+ depending on tier).",
        analogy: "Think of copays like different lane tolls on a highway — the express lane (specialists) costs more than the regular lane (primary care), but both get you where you need to go.",
        keyTakeaway: "Your insurance card lists your copay amounts. Check it before each visit so there are no surprises.",
        example: { scenario: "You visit your primary care doctor for a sore throat.", breakdown: "Your copay is $25. The total visit costs $180. You pay $25, your insurance pays the remaining $155." },
      },
      {
        id: "copay-3",
        title: "Copay vs. Coinsurance",
        content: "While a copay is a fixed amount ($30 per visit), coinsurance is a percentage (e.g., you pay 20% of the bill). After you meet your deductible, some services switch from copay to coinsurance. Understanding the difference helps you predict your costs.",
        analogy: "A copay is like a flat-rate shipping fee ($5 no matter what). Coinsurance is like paying a percentage of your purchase — the more expensive the item, the more you pay.",
        keyTakeaway: "Check your plan: some services have copays, others have coinsurance. Know which applies to your situation.",
      },
    ],
    quiz: [
      { id: "copay-q1", question: "What is a copay?", options: ["A percentage of your medical bill", "A fixed amount you pay per visit", "Your monthly insurance premium", "The total cost of a procedure"], correctIndex: 1, explanation: "A copay is a fixed dollar amount (e.g., $25) that you pay each time you receive a specific healthcare service." },
      { id: "copay-q2", question: "Which typically has the highest copay?", options: ["Primary care visit", "Specialist visit", "Emergency room visit", "Lab work"], correctIndex: 2, explanation: "Emergency room visits typically have the highest copays ($150-$500+) because ER care is the most expensive type of care." },
    ],
  },
  {
    id: "deductible",
    title: "Deductibles Explained",
    titleKey: "insurance_deductible",
    description: "Understand how deductibles work, how they reset annually, and strategies to manage high-deductible plans.",
    icon: "Wallet",
    category: "costs",
    steps: [
      {
        id: "ded-1",
        title: "What is a Deductible?",
        content: "A deductible is the amount you must pay out of your own pocket before your insurance starts paying. Think of it as a threshold you need to cross before your coverage kicks in fully.",
        analogy: "Imagine a parking garage with a minimum charge: you pay the first $50 out of pocket each month, then the company covers all additional parking. Your deductible works the same way — you cover the initial costs.",
        keyTakeaway: "Your deductible resets every year (usually January 1). Plan ahead for medical expenses early in the year.",
      },
      {
        id: "ded-2",
        title: "How Deductibles Accumulate",
        content: "Every time you pay for a covered service, that amount counts toward your deductible. Once you've paid enough to meet it, your insurance begins covering costs (usually at a coinsurance rate like 80/20). Some services like preventive care are covered even before you meet your deductible.",
        analogy: "Think of filling a piggy bank — every medical payment adds coins. Once the bank is full (deductible met), your insurance starts sharing the cost.",
        keyTakeaway: "Keep track of how much you've paid toward your deductible. Your insurance company's app or portal shows this.",
        example: { scenario: "Your plan has a $1,500 deductible. In March, you need an MRI costing $800.", breakdown: "$800 goes toward your deductible. You've now met $800 of your $1,500 deductible, with $700 remaining. You pay the full $800." },
      },
      {
        id: "ded-3",
        title: "Individual vs. Family Deductibles",
        content: "Family plans have two deductibles: an individual deductible (per person) and a family deductible (total for all members). Once any individual meets their personal deductible, their coverage kicks in. The family deductible is met when the total across all members is reached.",
        analogy: "A relay race: each runner has their own checkpoint, but there's also a total distance the whole team needs to cover.",
        keyTakeaway: "If one family member has high medical costs, they can meet their individual deductible even if the family deductible isn't met yet.",
      },
    ],
    quiz: [
      { id: "ded-q1", question: "When does a deductible typically reset?", options: ["Every month", "Every 6 months", "Every year (usually Jan 1)", "It never resets"], correctIndex: 2, explanation: "Most deductibles reset annually, typically on January 1st. This means you start from zero each year." },
      { id: "ded-q2", question: "What happens after you meet your deductible?", options: ["You stop paying completely", "Insurance starts covering costs (usually at a coinsurance rate)", "Your premiums decrease", "You get a refund"], correctIndex: 1, explanation: "After meeting your deductible, insurance starts covering a portion of costs. You typically pay coinsurance (e.g., 20%) until you hit your out-of-pocket maximum." },
    ],
  },
  {
    id: "out-of-network",
    title: "In-Network vs. Out-of-Network",
    titleKey: "insurance_network",
    description: "Learn the difference between in-network and out-of-network providers, and how your choice affects your costs.",
    icon: "Network",
    category: "providers",
    steps: [
      {
        id: "oon-1",
        title: "What is a Provider Network?",
        content: "A provider network is a group of doctors, hospitals, and other healthcare providers that have agreed to provide services at pre-negotiated rates with your insurance company. Using these providers (in-network) saves you significantly compared to going outside the network.",
        analogy: "Think of it like a members-only warehouse club: store members (in-network providers) offer you discounted prices. You can still shop at other stores (out-of-network), but you'll pay the regular, higher price.",
        keyTakeaway: "Always check if a provider is in your network before scheduling an appointment. This single step can save you hundreds or thousands of dollars.",
      },
      {
        id: "oon-2",
        title: "Cost Differences",
        content: "In-network costs are significantly lower because your insurance has negotiated rates. Out-of-network providers can charge whatever they want, and your insurance may cover only a small percentage — or nothing at all. You may also face 'balance billing' where the provider bills you for the difference.",
        analogy: "Ordering dinner at a restaurant with a set menu (in-network) vs. a restaurant that charges market price for everything (out-of-network). Both feed you, but one has guaranteed pricing.",
        keyTakeaway: "Out-of-network costs can be 2-5x higher than in-network. Even your deductible and out-of-pocket maximum may be separate (and higher) for out-of-network care.",
        example: { scenario: "You need knee surgery. An in-network surgeon charges $10,000 (negotiated rate).", breakdown: "In-network: You pay 20% = $2,000. Out-of-network: The surgeon charges $18,000. Your insurance pays based on $10,000 (usual customary rate), leaving you responsible for the $8,000 difference PLUS your 40% coinsurance." },
      },
      {
        id: "oon-3",
        title: "Exceptions and Emergencies",
        content: "The No Surprises Act (2022) protects you from surprise out-of-network bills in emergencies and at in-network facilities where you unknowingly receive care from an out-of-network provider. In emergencies, you should always go to the nearest facility regardless of network status.",
        analogy: "Emergency care is like calling 911 — the closest help responds regardless of which company they work for, and you're protected from unfair charges.",
        keyTakeaway: "In a true emergency, go to the nearest hospital. Federal law protects you from surprise out-of-network emergency billing.",
      },
    ],
    quiz: [
      { id: "oon-q1", question: "Why are in-network providers cheaper?", options: ["They are less qualified", "They have negotiated rates with your insurance", "They use older equipment", "Insurance pays them less overall"], correctIndex: 1, explanation: "In-network providers have pre-negotiated, discounted rates with your insurance company, which is passed on to you as lower costs." },
      { id: "oon-q2", question: "What protects you from surprise out-of-network emergency bills?", options: ["HIPAA", "The No Surprises Act", "Medicare", "Your employer"], correctIndex: 1, explanation: "The No Surprises Act (2022) protects patients from unexpected out-of-network charges for emergency services and certain non-emergency services at in-network facilities." },
    ],
  },
  {
    id: "prior-auth",
    title: "Prior Authorization Process",
    titleKey: "insurance_prior_auth",
    description: "Understand when and why prior authorization is needed, and how to navigate the approval process effectively.",
    icon: "ClipboardCheck",
    category: "process",
    steps: [
      {
        id: "pa-1",
        title: "What is Prior Authorization?",
        content: "Prior authorization (also called pre-authorization or pre-approval) is a requirement by your insurance company to approve certain medications, procedures, or services BEFORE you receive them. Without it, your insurance may refuse to pay — even if the service is medically necessary.",
        analogy: "Think of it like getting a building permit before starting construction. You can't just start — you need the city's (insurance company's) approval first, or you'll bear all the costs yourself.",
        keyTakeaway: "Always ask your doctor's office: 'Does this need prior authorization?' before scheduling procedures or starting new medications.",
      },
      {
        id: "pa-2",
        title: "What Requires Prior Auth?",
        content: "Common services requiring prior authorization include: advanced imaging (MRI, CT, PET scans), specialty medications (biologics, cancer drugs), surgical procedures, inpatient hospital stays, durable medical equipment (wheelchairs, CPAP), and physical/occupational therapy beyond initial visits.",
        analogy: "Just as expensive purchases at a store might require manager approval, expensive or specialized medical services often need insurance company approval.",
        keyTakeaway: "Your doctor's office usually handles the prior auth process, but YOU should follow up to make sure it was submitted and approved before your appointment.",
        example: { scenario: "Your doctor orders an MRI for your back pain.", breakdown: "Step 1: Doctor's office submits prior auth request with clinical documentation. Step 2: Insurance reviews (typically 3-5 business days). Step 3: Approved — you can schedule the MRI. If denied, your doctor can appeal with additional information." },
      },
      {
        id: "pa-3",
        title: "What If Prior Auth Is Denied?",
        content: "If denied, you have options: 1) Your doctor can submit an appeal with additional medical justification. 2) You can request a peer-to-peer review where your doctor speaks directly with the insurance company's physician. 3) You can file a formal appeal through your insurance's grievance process. Most denials can be overturned with proper documentation.",
        analogy: "A denial is like a loan application being initially rejected — you can provide additional documentation and try again. Many denials are overturned on appeal.",
        keyTakeaway: "Don't accept a denial as final. Ask your doctor to appeal — over 50% of prior auth denials are overturned on appeal.",
      },
    ],
    quiz: [
      { id: "pa-q1", question: "When should you check if prior authorization is needed?", options: ["After the procedure", "When you get the bill", "Before scheduling the service", "Only for hospital stays"], correctIndex: 2, explanation: "Always check BEFORE receiving the service. Without prior authorization, your insurance may deny coverage entirely." },
      { id: "pa-q2", question: "What happens if a prior authorization is denied?", options: ["You must pay full price", "There is nothing you can do", "Your doctor can appeal the decision", "Your insurance is automatically cancelled"], correctIndex: 2, explanation: "Your doctor can appeal a denial by providing additional clinical documentation. Over 50% of appeals result in the authorization being approved." },
    ],
  },
  {
    id: "referrals",
    title: "The Referral Process",
    titleKey: "insurance_referrals",
    description: "Learn how referrals work, when you need one, and how to get one efficiently to see a specialist.",
    icon: "Share2",
    category: "process",
    steps: [
      {
        id: "ref-1",
        title: "What is a Referral?",
        content: "A referral is a formal recommendation from your primary care physician (PCP) to see a specialist. Some insurance plans (especially HMOs) require a referral before they'll cover a specialist visit. Without one, you may have to pay the entire cost yourself.",
        analogy: "A referral is like getting a letter of introduction: your PCP vouches that you need to see a specific expert, and your insurance recognizes this recommendation as valid.",
        keyTakeaway: "Check your insurance plan type: HMO plans usually require referrals. PPO plans typically let you see specialists without one (but may cost more).",
      },
      {
        id: "ref-2",
        title: "HMO vs. PPO: Do You Need a Referral?",
        content: "HMO (Health Maintenance Organization): Almost always requires a referral to see any specialist. Your PCP acts as a gatekeeper. PPO (Preferred Provider Organization): You can usually see specialists directly without a referral, though going through your PCP may save money. EPO/POS: Varies — check your specific plan details.",
        analogy: "An HMO is like a guided tour — you follow a planned route through your PCP. A PPO is like exploring on your own — you can go anywhere, but a guide (PCP) can sometimes get you better deals.",
        keyTakeaway: "Know your plan type (it's on your insurance card). This determines whether you need referrals and how much freedom you have in choosing providers.",
        example: { scenario: "You have knee pain and want to see an orthopedic specialist.", breakdown: "HMO Plan: Visit your PCP first → PCP examines you → PCP submits referral → You can schedule with an in-network orthopedist. PPO Plan: You can call an in-network orthopedist directly and schedule an appointment." },
      },
      {
        id: "ref-3",
        title: "Getting a Referral Efficiently",
        content: "Tips for a smooth referral process: 1) Call your PCP's office and explain your symptoms — some referrals can be done without a visit. 2) Ask for a referral to a specific specialist you've already verified is in-network. 3) Confirm the referral was submitted before scheduling with the specialist. 4) Referrals often have expiration dates (30-90 days) and visit limits.",
        analogy: "Getting a referral is like ordering food for pickup: call ahead with your request, confirm the order, and pick it up on time before it expires.",
        keyTakeaway: "Always confirm with both your PCP's office AND the specialist's office that the referral is on file before your appointment.",
      },
    ],
    quiz: [
      { id: "ref-q1", question: "Which plan type usually requires referrals to see specialists?", options: ["PPO", "HMO", "Medicare Part D", "Dental plans"], correctIndex: 1, explanation: "HMO plans typically require referrals from your primary care physician before you can see a specialist." },
      { id: "ref-q2", question: "How can you get a referral more efficiently?", options: ["Go to the ER", "Call your PCP and ask if a referral can be done by phone", "Just show up at the specialist's office", "Contact your insurance company directly"], correctIndex: 1, explanation: "Many PCPs can process referrals via phone or patient portal without requiring an in-person visit, saving you time and a copay." },
    ],
  },
];

const supportedLanguages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "ko", name: "Korean" },
  { code: "vi", name: "Vietnamese" },
  { code: "tl", name: "Tagalog" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "fa", name: "Farsi" },
  { code: "th", name: "Thai" },
  { code: "bn", name: "Bengali" },
];

router.get("/modules", (_req: Request, res: Response) => {
  const summaries = lessonModules.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    icon: m.icon,
    category: m.category,
    stepCount: m.steps.length,
    quizCount: m.quiz.length,
  }));
  res.json({ modules: summaries, languages: supportedLanguages });
});

router.get("/modules/:moduleId", (req: Request, res: Response) => {
  const mod = lessonModules.find(m => m.id === req.params.moduleId);
  if (!mod) {
    return res.status(404).json({ error: "Module not found" });
  }
  res.json(mod);
});

router.post("/translate", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage, context } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "text and targetLanguage are required" });
    }

    if (targetLanguage === "en") {
      return res.json({ translatedText: text, language: "en" });
    }

    const langName = supportedLanguages.find(l => l.code === targetLanguage)?.name || targetLanguage;

    const response = await generatePhiSafeText({
      system: `You are a medical insurance education translator. Translate the following insurance education content into ${langName}. Keep medical and insurance terminology accurate. Use simple, clear language appropriate for patients with varying health literacy levels. Context: ${context || "insurance education module"}. Return ONLY the translated text with no preamble.`,
      user: text,
      temperature: 0.3,
      maxTokens: 2000,
    });

    res.json({
      translatedText: response || text,
      language: targetLanguage,
    });
  } catch (error: any) {
    console.error("[InsuranceLearning] Translation error:", error.message);
    res.json({ translatedText: req.body.text, language: "en", error: "Translation unavailable" });
  }
});

router.post("/ai-explain", async (req: Request, res: Response) => {
  try {
    const { topic, question, language } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "topic is required" });
    }

    const langInstruction = language && language !== "en"
      ? `Respond in ${supportedLanguages.find(l => l.code === language)?.name || language}.`
      : "Respond in English.";

    const response = await generatePhiSafeText({
      system: `You are a friendly insurance education assistant for Tabula Medica. Explain insurance concepts in simple, patient-friendly language using everyday analogies. ${langInstruction} Keep responses concise (2-3 paragraphs max). Important: This is educational information only — not legal or financial advice. Always recommend consulting with the patient's insurance company or a benefits counselor for specific coverage questions.`,
      user: question || `Explain the concept of "${topic}" in health insurance in a simple, easy-to-understand way. Use a real-world analogy.`,
      temperature: 0.7,
      maxTokens: 500,
    });

    res.json({
      explanation: response || "Unable to generate explanation.",
      disclaimer: "This is educational information only. It does not constitute insurance, legal, or financial advice. Please consult your insurance company or a benefits counselor for specific coverage questions.",
    });
  } catch (error: any) {
    console.error("[InsuranceLearning] AI explain error:", error.message);
    res.json({
      explanation: "AI explanation is temporarily unavailable. Please review the lesson materials above for information about this topic.",
      disclaimer: "This is educational information only.",
    });
  }
});

router.get("/glossary", (_req: Request, res: Response) => {
  const glossary = [
    { term: "Copay", definition: "A fixed amount you pay for a covered healthcare service." },
    { term: "Coinsurance", definition: "Your share of costs as a percentage (e.g., 20%) after meeting your deductible." },
    { term: "Deductible", definition: "The amount you pay before insurance starts covering costs." },
    { term: "Premium", definition: "Your monthly payment to maintain insurance coverage." },
    { term: "Out-of-Pocket Maximum", definition: "The most you pay in a year; after this, insurance covers 100%." },
    { term: "In-Network", definition: "Providers with negotiated rates with your insurance." },
    { term: "Out-of-Network", definition: "Providers without negotiated rates, resulting in higher costs." },
    { term: "Prior Authorization", definition: "Insurance approval required before certain services." },
    { term: "Referral", definition: "A recommendation from your PCP to see a specialist." },
    { term: "HMO", definition: "Health Maintenance Organization — requires PCP referrals, lower cost." },
    { term: "PPO", definition: "Preferred Provider Organization — more flexibility, higher cost." },
    { term: "EPO", definition: "Exclusive Provider Organization — in-network only, no referrals needed." },
    { term: "EOB", definition: "Explanation of Benefits — a summary from your insurer after a claim." },
    { term: "Formulary", definition: "A list of prescription drugs covered by your insurance plan." },
    { term: "Balance Billing", definition: "When an out-of-network provider bills you for the difference between their charge and what insurance pays." },
    { term: "No Surprises Act", definition: "Federal law protecting patients from unexpected out-of-network bills in emergencies." },
    { term: "Open Enrollment", definition: "The annual period when you can sign up for or change your health insurance plan." },
    { term: "COBRA", definition: "Allows you to keep employer insurance for a limited time after leaving a job (at full cost)." },
    { term: "FSA", definition: "Flexible Spending Account — pre-tax money for medical expenses (use it or lose it)." },
    { term: "HSA", definition: "Health Savings Account — pre-tax savings for medical expenses (rolls over year to year)." },
  ];
  res.json({ glossary });
});

export default router;
