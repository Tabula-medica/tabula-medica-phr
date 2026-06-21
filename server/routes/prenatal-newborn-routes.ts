import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

interface PrenatalGuideline {
  id: string;
  trimester: "first" | "second" | "third" | "preconception";
  title: string;
  description: string;
  category: "screening" | "nutrition" | "lifestyle" | "monitoring" | "vaccination" | "mental-health";
  weekRange: string;
  recommendations: string[];
  warningSignsToWatch: string[];
  source: string;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

interface NewbornScreeningPanel {
  id: string;
  name: string;
  abbreviation: string;
  category: "metabolic" | "endocrine" | "hemoglobin" | "other" | "hearing" | "cardiac";
  description: string;
  conditionsTested: string[];
  sampleType: string;
  timing: string;
  prevalence: string;
  treatmentAvailable: boolean;
  source: string;
  noCdsDisclaimer: string;
}

interface PrenatalVisitSchedule {
  id: string;
  visitNumber: number;
  weekRange: string;
  trimester: "first" | "second" | "third";
  title: string;
  procedures: string[];
  labTests: string[];
  screenings: string[];
  educationTopics: string[];
}

interface NewbornMilestone {
  id: string;
  ageRange: string;
  category: "physical" | "cognitive" | "social" | "language" | "feeding";
  milestones: string[];
  redFlags: string[];
  source: string;
}

const prenatalGuidelines: PrenatalGuideline[] = [
  {
    id: "pg-001",
    trimester: "preconception",
    title: "Preconception Health Planning",
    description: "Recommendations for women planning pregnancy to optimize maternal and fetal health outcomes.",
    category: "nutrition",
    weekRange: "Before conception",
    recommendations: [
      "Begin folic acid supplementation (400-800 mcg daily) at least 1 month before conception",
      "Review current medications with provider for teratogenic risk",
      "Update vaccinations including MMR and varicella if not immune",
      "Screen for chronic conditions: diabetes, hypertension, thyroid disorders",
      "Achieve healthy BMI through balanced diet and exercise",
      "Discontinue alcohol, tobacco, and recreational substances",
      "Genetic carrier screening if family history indicates risk"
    ],
    warningSignsToWatch: [
      "Irregular menstrual cycles",
      "History of recurrent pregnancy loss",
      "Uncontrolled chronic conditions"
    ],
    source: "ACOG Committee Opinion No. 762",
    lastUpdated: "2024-01-15",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. Consult your healthcare provider for personalized medical advice."
  },
  {
    id: "pg-002",
    trimester: "first",
    title: "First Trimester Screening & Care",
    description: "Essential screenings and care recommendations for weeks 1-13 of pregnancy.",
    category: "screening",
    weekRange: "Weeks 1-13",
    recommendations: [
      "Confirm pregnancy with hCG blood test and ultrasound dating scan",
      "Complete blood count (CBC), blood type, Rh factor, and antibody screen",
      "Screen for STIs: HIV, syphilis, hepatitis B, chlamydia, gonorrhea",
      "Urinalysis and urine culture",
      "First trimester combined screening (nuchal translucency + serum markers) at 11-13 weeks",
      "Cell-free DNA screening (NIPT) available from 10 weeks",
      "Pap smear if due per screening guidelines",
      "Begin prenatal vitamins with DHA/EPA",
      "TSH screening for thyroid function"
    ],
    warningSignsToWatch: [
      "Vaginal bleeding or spotting",
      "Severe nausea and vomiting (hyperemesis gravidarum)",
      "Abdominal pain or cramping",
      "Fever over 100.4F (38C)",
      "Painful urination"
    ],
    source: "ACOG Practice Bulletin No. 226; USPSTF Screening Recommendations",
    lastUpdated: "2024-03-01",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. Consult your healthcare provider for personalized medical advice."
  },
  {
    id: "pg-003",
    trimester: "second",
    title: "Second Trimester Monitoring & Screenings",
    description: "Key screenings, anatomy assessment, and care for weeks 14-27.",
    category: "screening",
    weekRange: "Weeks 14-27",
    recommendations: [
      "Anatomy ultrasound (18-22 weeks) for structural assessment",
      "Quad screen or integrated screening if not done in first trimester",
      "Glucose challenge test (GCT) at 24-28 weeks for gestational diabetes",
      "Rh antibody re-screen at 28 weeks if Rh-negative",
      "Administer RhoGAM at 28 weeks if Rh-negative",
      "Monitor blood pressure at each visit",
      "Fundal height measurement starting at 20 weeks",
      "Begin kick count awareness education",
      "Tdap vaccination recommended at 27-36 weeks"
    ],
    warningSignsToWatch: [
      "Decreased fetal movement",
      "Persistent headaches or visual changes",
      "Swelling of face or hands",
      "Fluid leakage from vagina",
      "Regular contractions before 37 weeks"
    ],
    source: "ACOG Practice Bulletin No. 190; CDC Immunization Guidelines",
    lastUpdated: "2024-03-01",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. Consult your healthcare provider for personalized medical advice."
  },
  {
    id: "pg-004",
    trimester: "third",
    title: "Third Trimester Preparation & Monitoring",
    description: "Final trimester care, delivery preparation, and screening for weeks 28-40+.",
    category: "monitoring",
    weekRange: "Weeks 28-40+",
    recommendations: [
      "Group B Streptococcus (GBS) screening at 36-37 weeks",
      "Biweekly visits from 28-36 weeks, then weekly until delivery",
      "Non-stress test (NST) if indicated for high-risk pregnancies",
      "Fetal position assessment at 36 weeks",
      "Discuss birth plan and delivery preferences",
      "Review signs of labor and when to go to hospital",
      "Repeat STI screening if high-risk",
      "Complete blood count recheck",
      "Discuss breastfeeding education and postpartum planning",
      "Car seat safety and newborn care preparation"
    ],
    warningSignsToWatch: [
      "Decreased fetal movement",
      "Sudden severe headache or vision changes (preeclampsia signs)",
      "Epigastric pain",
      "Rupture of membranes (water breaking)",
      "Vaginal bleeding",
      "Contractions every 5 minutes for 1 hour",
      "Blood pressure above 140/90 mmHg"
    ],
    source: "ACOG Practice Bulletin No. 222; WHO Recommendations on Antenatal Care",
    lastUpdated: "2024-03-01",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. Consult your healthcare provider for personalized medical advice."
  },
  {
    id: "pg-005",
    trimester: "first",
    title: "Prenatal Nutrition Guidelines",
    description: "Evidence-based nutritional recommendations for a healthy pregnancy.",
    category: "nutrition",
    weekRange: "Throughout pregnancy",
    recommendations: [
      "Folic acid: 400-800 mcg daily (up to 4mg if prior neural tube defect)",
      "Iron: 27mg daily; screen for iron-deficiency anemia",
      "Calcium: 1,000mg daily from dietary sources and supplements",
      "Vitamin D: 600 IU daily minimum",
      "DHA/Omega-3: 200-300mg daily for fetal brain development",
      "Avoid high-mercury fish (shark, swordfish, king mackerel, tilefish)",
      "Safe fish choices: salmon, sardines, trout (2-3 servings per week)",
      "Avoid unpasteurized dairy, raw meat, deli meats unless heated",
      "Limit caffeine to less than 200mg per day",
      "Adequate hydration: 8-12 cups of water daily",
      "Weight gain targets based on pre-pregnancy BMI per IOM guidelines"
    ],
    warningSignsToWatch: [
      "Inability to keep food or liquids down",
      "Significant weight loss in pregnancy",
      "Cravings for non-food items (pica)"
    ],
    source: "ACOG Committee Opinion No. 804; IOM Weight Gain Guidelines",
    lastUpdated: "2024-02-01",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. Consult your healthcare provider for personalized medical advice."
  },
  {
    id: "pg-006",
    trimester: "first",
    title: "Mental Health During Pregnancy",
    description: "Screening and support recommendations for perinatal mental health.",
    category: "mental-health",
    weekRange: "Throughout pregnancy and postpartum",
    recommendations: [
      "Screen for depression using PHQ-9 at first prenatal visit and during third trimester",
      "Screen for anxiety using GAD-7",
      "Edinburgh Postnatal Depression Scale (EPDS) screening postpartum",
      "Discuss history of mood disorders and prior perinatal mental health issues",
      "Cognitive behavioral therapy (CBT) as first-line for mild to moderate symptoms",
      "Medication management with provider for moderate to severe cases",
      "Social support assessment and referral to community resources",
      "Sleep hygiene education",
      "Stress reduction techniques: mindfulness, relaxation exercises"
    ],
    warningSignsToWatch: [
      "Persistent sadness or hopelessness lasting more than 2 weeks",
      "Loss of interest in daily activities",
      "Thoughts of self-harm or harming the baby",
      "Severe anxiety or panic attacks",
      "Difficulty bonding with pregnancy or baby"
    ],
    source: "ACOG Committee Opinion No. 757; USPSTF Depression Screening",
    lastUpdated: "2024-01-15",
    noCdsDisclaimer: "This information is educational only and does not constitute clinical decision support. If you are experiencing a mental health crisis, contact the 988 Suicide & Crisis Lifeline."
  }
];

const newbornScreeningPanels: NewbornScreeningPanel[] = [
  {
    id: "ns-001",
    name: "Phenylketonuria",
    abbreviation: "PKU",
    category: "metabolic",
    description: "Screens for inability to break down phenylalanine, an amino acid found in many foods. Early detection prevents intellectual disability.",
    conditionsTested: ["Classic PKU", "Variant PKU", "Benign hyperphenylalaninemia"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 10,000-15,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-002",
    name: "Congenital Hypothyroidism",
    abbreviation: "CH",
    category: "endocrine",
    description: "Detects insufficient thyroid hormone production, which if untreated can cause growth failure and intellectual disability.",
    conditionsTested: ["Primary congenital hypothyroidism", "Thyroid dysgenesis", "Thyroid dyshormonogenesis"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 2,000-4,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-003",
    name: "Sickle Cell Disease",
    abbreviation: "SCD",
    category: "hemoglobin",
    description: "Screens for abnormal hemoglobin variants causing sickle-shaped red blood cells. Early detection enables prophylactic penicillin and comprehensive care.",
    conditionsTested: ["Sickle cell anemia (HbSS)", "Sickle-hemoglobin C (HbSC)", "Sickle beta-thalassemia"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 365 African American births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-004",
    name: "Cystic Fibrosis",
    abbreviation: "CF",
    category: "metabolic",
    description: "Detects elevated immunoreactive trypsinogen (IRT) indicating possible cystic fibrosis, a condition affecting lungs and digestion.",
    conditionsTested: ["Classic cystic fibrosis", "Atypical cystic fibrosis", "CFTR-related metabolic syndrome"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 2,500-3,500 Caucasian births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-005",
    name: "Congenital Adrenal Hyperplasia",
    abbreviation: "CAH",
    category: "endocrine",
    description: "Screens for enzyme deficiencies in cortisol production that can cause salt-wasting crises and ambiguous genitalia.",
    conditionsTested: ["21-hydroxylase deficiency (classic)", "11-beta-hydroxylase deficiency"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 15,000-20,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-006",
    name: "Galactosemia",
    abbreviation: "GALT",
    category: "metabolic",
    description: "Detects inability to metabolize galactose from milk and dairy. Untreated, can cause liver damage, sepsis, and intellectual disability.",
    conditionsTested: ["Classic galactosemia", "Duarte galactosemia"],
    sampleType: "Heel stick blood spot",
    timing: "24-48 hours after birth",
    prevalence: "1 in 30,000-60,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-007",
    name: "Critical Congenital Heart Disease",
    abbreviation: "CCHD",
    category: "cardiac",
    description: "Pulse oximetry screening detects critical heart defects that require intervention within the first year of life.",
    conditionsTested: [
      "Hypoplastic left heart syndrome",
      "Pulmonary atresia",
      "Tetralogy of Fallot",
      "Total anomalous pulmonary venous return",
      "Transposition of the great arteries",
      "Tricuspid atresia",
      "Truncus arteriosus"
    ],
    sampleType: "Pulse oximetry (right hand and foot)",
    timing: "24-48 hours after birth or before discharge",
    prevalence: "1 in 500 births (all CHD); ~25% are critical",
    treatmentAvailable: true,
    source: "AAP/AHA Recommendation; ACMG RUSP",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-008",
    name: "Hearing Screening",
    abbreviation: "UNHS",
    category: "hearing",
    description: "Universal Newborn Hearing Screening detects congenital hearing loss for early intervention and language development support.",
    conditionsTested: ["Congenital sensorineural hearing loss", "Conductive hearing loss", "Auditory neuropathy"],
    sampleType: "Otoacoustic emissions (OAE) or Auditory brainstem response (ABR)",
    timing: "Before hospital discharge (within 1 month of birth)",
    prevalence: "1-3 in 1,000 births",
    treatmentAvailable: true,
    source: "JCIH Position Statement; ACMG RUSP",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-009",
    name: "Severe Combined Immunodeficiency",
    abbreviation: "SCID",
    category: "other",
    description: "Screens for T-cell lymphopenia indicating possible severe combined immunodeficiency, a life-threatening immune disorder.",
    conditionsTested: ["X-linked SCID", "Adenosine deaminase deficiency", "Other SCID variants"],
    sampleType: "Heel stick blood spot (TREC assay)",
    timing: "24-48 hours after birth",
    prevalence: "1 in 58,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP)",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  },
  {
    id: "ns-010",
    name: "Spinal Muscular Atrophy",
    abbreviation: "SMA",
    category: "other",
    description: "Screens for SMN1 gene deletions causing progressive muscle weakness. Gene therapy is most effective when administered early.",
    conditionsTested: ["SMA Type 1", "SMA Type 2", "SMA Type 3"],
    sampleType: "Heel stick blood spot (DNA analysis)",
    timing: "24-48 hours after birth",
    prevalence: "1 in 6,000-10,000 births",
    treatmentAvailable: true,
    source: "ACMG Recommended Uniform Screening Panel (RUSP); Added 2018",
    noCdsDisclaimer: "This information is educational only. Consult your healthcare provider for screening results interpretation."
  }
];

const visitSchedule: PrenatalVisitSchedule[] = [
  {
    id: "vs-001",
    visitNumber: 1,
    weekRange: "6-8 weeks",
    trimester: "first",
    title: "Initial Prenatal Visit",
    procedures: ["Complete physical exam", "Pelvic exam", "Dating ultrasound", "BMI calculation"],
    labTests: ["CBC", "Blood type & Rh", "Urinalysis", "Rubella immunity", "STI panel"],
    screenings: ["Depression screening (PHQ-9)", "Substance use screening", "Domestic violence screening"],
    educationTopics: ["Prenatal vitamins", "Foods to avoid", "Exercise guidelines", "Medication safety"]
  },
  {
    id: "vs-002",
    visitNumber: 2,
    weekRange: "10-12 weeks",
    trimester: "first",
    title: "First Trimester Follow-up",
    procedures: ["Doppler fetal heart tones", "Blood pressure", "Weight check"],
    labTests: ["Cell-free DNA (NIPT) if elected"],
    screenings: ["Nuchal translucency ultrasound (11-13 weeks)", "First trimester combined screen"],
    educationTopics: ["Genetic screening options", "Managing nausea", "Work accommodations"]
  },
  {
    id: "vs-003",
    visitNumber: 3,
    weekRange: "16 weeks",
    trimester: "second",
    title: "Second Trimester Check",
    procedures: ["Fundal height", "Fetal heart rate", "Blood pressure", "Weight check"],
    labTests: ["AFP/Quad screen if not done NIPT"],
    screenings: [],
    educationTopics: ["Fetal movement awareness", "Dental care during pregnancy"]
  },
  {
    id: "vs-004",
    visitNumber: 4,
    weekRange: "20 weeks",
    trimester: "second",
    title: "Anatomy Scan Visit",
    procedures: ["Detailed anatomy ultrasound", "Cervical length assessment if indicated"],
    labTests: [],
    screenings: ["Fetal anatomy survey for structural anomalies"],
    educationTopics: ["Baby development milestones", "Childbirth education classes", "Birth plan discussion"]
  },
  {
    id: "vs-005",
    visitNumber: 5,
    weekRange: "24-28 weeks",
    trimester: "second",
    title: "Glucose Screening Visit",
    procedures: ["Fundal height", "Blood pressure", "Weight check"],
    labTests: ["1-hour glucose challenge test", "CBC recheck", "Rh antibody rescreen"],
    screenings: ["Gestational diabetes screening"],
    educationTopics: ["RhoGAM injection (if Rh-negative)", "Tdap vaccination timing", "Kick counts"]
  },
  {
    id: "vs-006",
    visitNumber: 6,
    weekRange: "32 weeks",
    trimester: "third",
    title: "Third Trimester Assessment",
    procedures: ["Fundal height", "Fetal position assessment", "Blood pressure"],
    labTests: [],
    screenings: ["Depression re-screening"],
    educationTopics: ["Preterm labor signs", "Hospital bag preparation", "Breastfeeding education"]
  },
  {
    id: "vs-007",
    visitNumber: 7,
    weekRange: "36 weeks",
    trimester: "third",
    title: "GBS Screening & Birth Planning",
    procedures: ["GBS vaginal/rectal swab", "Fetal position confirmation", "Cervical check if indicated"],
    labTests: ["Group B Strep culture"],
    screenings: ["Fetal presentation assessment"],
    educationTopics: ["Labor stages", "Pain management options", "Postpartum planning", "Newborn care basics"]
  },
  {
    id: "vs-008",
    visitNumber: 8,
    weekRange: "37-40 weeks",
    trimester: "third",
    title: "Weekly Monitoring",
    procedures: ["Blood pressure", "Fetal heart rate", "Cervical exam if indicated", "NST if indicated"],
    labTests: [],
    screenings: ["Bishop score assessment if post-dates"],
    educationTopics: ["When to go to hospital", "Induction discussion if approaching 41 weeks"]
  }
];

const newbornMilestones: NewbornMilestone[] = [
  {
    id: "nm-001",
    ageRange: "0-1 month",
    category: "physical",
    milestones: [
      "Lifts head briefly when on tummy",
      "Moves arms and legs",
      "Strong reflexes: rooting, sucking, grasping, Moro",
      "Eyes can focus 8-12 inches away"
    ],
    redFlags: [
      "Floppy or stiff muscle tone",
      "Does not respond to loud sounds",
      "Does not focus on or follow nearby objects",
      "Feeding difficulties: poor latch, excessive sleepiness during feeds"
    ],
    source: "CDC Developmental Milestones; AAP Bright Futures"
  },
  {
    id: "nm-002",
    ageRange: "0-1 month",
    category: "feeding",
    milestones: [
      "Breastfed: 8-12 feedings per 24 hours",
      "Formula-fed: 2-3 oz every 3-4 hours",
      "Produces 6+ wet diapers per day by day 5",
      "Regains birth weight by 10-14 days"
    ],
    redFlags: [
      "Fewer than 6 wet diapers per day after day 5",
      "Weight loss exceeding 10% of birth weight",
      "Jaundice persisting beyond 2 weeks",
      "Persistent vomiting (not spit-up)"
    ],
    source: "AAP Breastfeeding Guidelines; WHO Infant Feeding"
  },
  {
    id: "nm-003",
    ageRange: "1-2 months",
    category: "social",
    milestones: [
      "Begins to smile at people",
      "Briefly calms self (may bring hands to mouth)",
      "Tries to look at parent",
      "Coos, makes gurgling sounds"
    ],
    redFlags: [
      "Does not respond to parent's face",
      "Does not make any sounds",
      "No social smile by 2 months",
      "Excessive irritability that cannot be soothed"
    ],
    source: "CDC Developmental Milestones; AAP Bright Futures"
  },
  {
    id: "nm-004",
    ageRange: "2-4 months",
    category: "cognitive",
    milestones: [
      "Follows moving objects with eyes",
      "Recognizes familiar people at a distance",
      "Begins to act bored if activity doesn't change",
      "Shows interest in reaching for toys"
    ],
    redFlags: [
      "Does not follow moving objects with eyes",
      "Does not respond to sounds",
      "Does not bring hands to mouth",
      "Cannot hold head steady"
    ],
    source: "CDC Developmental Milestones; AAP Bright Futures"
  }
];

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "Prenatal Care & Newborn Screening Guidelines",
    version: "1.0.0",
    features: [
      "Evidence-based prenatal care guidelines by trimester",
      "ACMG Recommended Uniform Screening Panel (RUSP) for newborns",
      "Prenatal visit schedule with procedures and lab tests",
      "Newborn developmental milestones and red flags",
      "NO-CDS compliant educational content"
    ],
    compliance: {
      noCds: true,
      disclaimer: "All content is educational only and does not constitute clinical decision support."
    },
    sources: [
      "ACOG Practice Bulletins",
      "ACMG Recommended Uniform Screening Panel",
      "AAP Bright Futures",
      "CDC Developmental Milestones",
      "USPSTF Screening Recommendations",
      "WHO Antenatal Care Recommendations"
    ]
  });
});

router.get("/prenatal-guidelines", (req: Request, res: Response) => {
  const { trimester, category } = req.query;
  let filtered = [...prenatalGuidelines];
  if (trimester && typeof trimester === "string") {
    filtered = filtered.filter(g => g.trimester === trimester);
  }
  if (category && typeof category === "string") {
    filtered = filtered.filter(g => g.category === category);
  }
  res.json({
    guidelines: filtered,
    totalCount: filtered.length,
    trimesters: ["preconception", "first", "second", "third"],
    categories: ["screening", "nutrition", "lifestyle", "monitoring", "vaccination", "mental-health"]
  });
});

router.get("/prenatal-guidelines/:id", (req: Request, res: Response) => {
  const guideline = prenatalGuidelines.find(g => g.id === req.params.id);
  if (!guideline) {
    return res.status(404).json({ error: "Guideline not found" });
  }
  res.json(guideline);
});

router.get("/newborn-screening", (req: Request, res: Response) => {
  const { category } = req.query;
  let filtered = [...newbornScreeningPanels];
  if (category && typeof category === "string") {
    filtered = filtered.filter(p => p.category === category);
  }
  res.json({
    panels: filtered,
    totalCount: filtered.length,
    categories: ["metabolic", "endocrine", "hemoglobin", "cardiac", "hearing", "other"],
    disclaimer: "Newborn screening panels vary by state. Contact your state health department for the complete list of conditions screened in your area."
  });
});

router.get("/newborn-screening/:id", (req: Request, res: Response) => {
  const panel = newbornScreeningPanels.find(p => p.id === req.params.id);
  if (!panel) {
    return res.status(404).json({ error: "Screening panel not found" });
  }
  res.json(panel);
});

router.get("/visit-schedule", (req: Request, res: Response) => {
  const { trimester } = req.query;
  let filtered = [...visitSchedule];
  if (trimester && typeof trimester === "string") {
    filtered = filtered.filter(v => v.trimester === trimester);
  }
  res.json({
    visits: filtered,
    totalCount: filtered.length
  });
});

router.get("/newborn-milestones", (req: Request, res: Response) => {
  const { category, ageRange } = req.query;
  let filtered = [...newbornMilestones];
  if (category && typeof category === "string") {
    filtered = filtered.filter(m => m.category === category);
  }
  if (ageRange && typeof ageRange === "string") {
    filtered = filtered.filter(m => m.ageRange === ageRange);
  }
  res.json({
    milestones: filtered,
    totalCount: filtered.length,
    categories: ["physical", "cognitive", "social", "language", "feeding"],
    ageRanges: ["0-1 month", "1-2 months", "2-4 months"]
  });
});

router.get("/dashboard", (_req: Request, res: Response) => {
  res.json({
    prenatalGuidelines: {
      total: prenatalGuidelines.length,
      byTrimester: {
        preconception: prenatalGuidelines.filter(g => g.trimester === "preconception").length,
        first: prenatalGuidelines.filter(g => g.trimester === "first").length,
        second: prenatalGuidelines.filter(g => g.trimester === "second").length,
        third: prenatalGuidelines.filter(g => g.trimester === "third").length,
      }
    },
    newbornScreening: {
      total: newbornScreeningPanels.length,
      byCategory: {
        metabolic: newbornScreeningPanels.filter(p => p.category === "metabolic").length,
        endocrine: newbornScreeningPanels.filter(p => p.category === "endocrine").length,
        hemoglobin: newbornScreeningPanels.filter(p => p.category === "hemoglobin").length,
        cardiac: newbornScreeningPanels.filter(p => p.category === "cardiac").length,
        hearing: newbornScreeningPanels.filter(p => p.category === "hearing").length,
        other: newbornScreeningPanels.filter(p => p.category === "other").length,
      }
    },
    visitSchedule: {
      total: visitSchedule.length
    },
    milestones: {
      total: newbornMilestones.length
    }
  });
});

export default router;
