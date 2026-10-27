export const WOMENS_HEALTH_CATEGORIES = [
  {
    id: "menstrual",
    title: "Menstrual Health",
    icon: "calendar",
    description: "Track your cycle, symptoms, and patterns",
    features: ["Cycle length tracking", "Symptom logging", "Period predictions", "Flow intensity tracking"],
  },
  {
    id: "pregnancy",
    title: "Pregnancy & Prenatal",
    icon: "heart",
    description: "Comprehensive prenatal care guidelines and tracking",
    features: ["Trimester milestones", "Prenatal lab schedule", "Nutrition guidance", "Kick counter"],
  },
  {
    id: "fertility",
    title: "Fertility & Ovulation",
    icon: "trending-up",
    description: "Ovulation tracking and fertility guidance",
    features: ["Ovulation window estimation", "Basal body temperature", "Fertility indicators", "Conception guidance"],
  },
  {
    id: "postpartum",
    title: "Postpartum Care",
    icon: "sun",
    description: "Recovery and mental health after delivery",
    features: ["Recovery milestones", "Edinburgh PND screening", "Breastfeeding support", "Physical recovery tracking"],
  },
  {
    id: "menopause",
    title: "Menopause & Perimenopause",
    icon: "thermometer",
    description: "Symptom management and health monitoring",
    features: ["Symptom tracking", "Hot flash log", "Bone density reminders", "HRT information"],
  },
  {
    id: "screening",
    title: "Preventive Screening",
    icon: "shield",
    description: "Age-appropriate health screenings and schedules",
    features: ["Mammography schedule", "Pap smear/HPV testing", "Bone density screening", "Cardiovascular risk assessment"],
  },
];

export const MENSTRUAL_SYMPTOMS = [
  { id: "cramps", label: "Cramps", severity: ["mild", "moderate", "severe"] },
  { id: "headache", label: "Headache", severity: ["mild", "moderate", "severe"] },
  { id: "bloating", label: "Bloating", severity: ["mild", "moderate", "severe"] },
  { id: "fatigue", label: "Fatigue", severity: ["mild", "moderate", "severe"] },
  { id: "mood_changes", label: "Mood Changes", severity: ["mild", "moderate", "severe"] },
  { id: "back_pain", label: "Back Pain", severity: ["mild", "moderate", "severe"] },
  { id: "breast_tenderness", label: "Breast Tenderness", severity: ["mild", "moderate", "severe"] },
  { id: "nausea", label: "Nausea", severity: ["mild", "moderate", "severe"] },
  { id: "acne", label: "Acne", severity: ["mild", "moderate", "severe"] },
  { id: "insomnia", label: "Insomnia", severity: ["mild", "moderate", "severe"] },
];

export const FLOW_LEVELS = ["spotting", "light", "medium", "heavy", "very_heavy"];

export const MENSTRUAL_CARE_GUIDE = {
  cycleBasics: {
    title: "Understanding Your Cycle",
    phases: [
      {
        name: "Menstrual Phase",
        days: "Days 1-5",
        description: "Uterine lining sheds. Period bleeding occurs.",
        hormones: "Estrogen and progesterone at lowest levels",
        selfCare: ["Rest and gentle movement", "Iron-rich foods (spinach, lentils, red meat)", "Stay hydrated", "Heat therapy for cramps", "NSAIDs if needed for pain (ibuprofen preferred)"],
        symptoms: ["Cramping", "Fatigue", "Bloating", "Lower back pain"],
      },
      {
        name: "Follicular Phase",
        days: "Days 1-13",
        description: "Follicles develop in ovaries. Estrogen rises, building uterine lining.",
        hormones: "FSH rises, estrogen gradually increases",
        selfCare: ["Increase exercise intensity", "Focus on protein and complex carbs", "Plan creative or social activities", "Strength training is most effective"],
        symptoms: ["Rising energy", "Improved mood", "Increased creativity"],
      },
      {
        name: "Ovulation",
        days: "Day 14 (approx.)",
        description: "Mature egg released from ovary. Peak fertility window.",
        hormones: "LH surge triggers egg release, estrogen peaks",
        selfCare: ["Peak energy for high-intensity exercise", "Stay hydrated", "Monitor cervical mucus for fertility awareness", "Note any mittelschmerz (ovulation pain)"],
        symptoms: ["Mild pelvic pain", "Clear cervical mucus", "Slight temperature rise", "Increased libido"],
      },
      {
        name: "Luteal Phase",
        days: "Days 15-28",
        description: "Corpus luteum produces progesterone. Lining maintained for potential implantation.",
        hormones: "Progesterone rises, then falls if no pregnancy",
        selfCare: ["Magnesium-rich foods (dark chocolate, nuts, bananas)", "Reduce caffeine and salt", "Prioritize sleep", "Gentle yoga or walking", "B6 supplements may help PMS"],
        symptoms: ["PMS symptoms emerge", "Breast tenderness", "Mood changes", "Food cravings", "Bloating"],
      },
    ],
  },
  abnormalBleeding: {
    title: "When to See a Doctor",
    redFlags: [
      { symptom: "Periods lasting longer than 7 days", urgency: "Schedule appointment" },
      { symptom: "Soaking through a pad/tampon every 1-2 hours", urgency: "Seek same-day care" },
      { symptom: "Bleeding between periods", urgency: "Schedule appointment" },
      { symptom: "Periods more frequent than every 21 days", urgency: "Schedule appointment" },
      { symptom: "No period for 3+ months (not pregnant)", urgency: "Schedule appointment" },
      { symptom: "Severe pain not relieved by OTC medications", urgency: "Seek same-day care" },
      { symptom: "Passing blood clots larger than a quarter", urgency: "Seek same-day care" },
      { symptom: "Post-menopausal bleeding (any amount)", urgency: "Seek urgent care" },
    ],
  },
  conditions: [
    {
      name: "Dysmenorrhea",
      description: "Painful periods with cramping, typically in lower abdomen",
      prevalence: "Affects up to 90% of menstruating people",
      management: ["NSAIDs (ibuprofen 400-600mg every 6-8h)", "Hormonal contraceptives", "Heat therapy (40°C for 12+ hours)", "Regular exercise", "Omega-3 fatty acids"],
      source: "ACOG Practice Bulletin 2020",
    },
    {
      name: "Endometriosis",
      description: "Tissue similar to uterine lining grows outside the uterus",
      prevalence: "Affects ~10% of reproductive-age women",
      management: ["Hormonal therapy (combined OC, progestins, GnRH agonists)", "Pain management", "Laparoscopic surgery for confirmed cases", "Fertility preservation planning", "Pelvic floor physical therapy"],
      source: "ESHRE Endometriosis Guideline 2022",
    },
    {
      name: "PCOS (Polycystic Ovary Syndrome)",
      description: "Hormonal disorder causing irregular periods, excess androgens, and polycystic ovaries",
      prevalence: "Affects 6-12% of reproductive-age women",
      management: ["Lifestyle modification (diet + exercise)", "Metformin for insulin resistance", "Combined OC for cycle regulation", "Spironolactone for androgen symptoms", "Fertility treatment when needed (letrozole first-line)"],
      source: "International Evidence-based Guideline for PCOS 2023",
    },
    {
      name: "Menorrhagia (Heavy Menstrual Bleeding)",
      description: "Excessive menstrual blood loss interfering with quality of life",
      prevalence: "Affects ~30% of reproductive-age women",
      management: ["Tranexamic acid during menses", "Hormonal IUD (levonorgestrel)", "Combined hormonal contraceptives", "Iron supplementation for anemia", "Endometrial ablation or surgical options if refractory"],
      source: "NICE Heavy Menstrual Bleeding Guideline 2024",
    },
    {
      name: "PMS / PMDD",
      description: "Premenstrual syndrome or its severe form, premenstrual dysphoric disorder",
      prevalence: "PMS: 75% of women; PMDD: 3-8% of women",
      management: ["SSRIs (sertraline, fluoxetine) for PMDD", "Calcium 1200mg/day", "Cognitive behavioral therapy", "Regular aerobic exercise", "Chasteberry (Vitex) supplementation", "Drospirenone-containing OC"],
      source: "RCOG Green-top Guideline, ACOG Committee Opinion 2024",
    },
  ],
};

export const PREGNANCY_CARE_GUIDE = {
  dueDateCalculation: {
    title: "Due Date Estimation",
    description: "Naegele's rule: Add 280 days (40 weeks) from the first day of the last menstrual period (LMP). Ultrasound dating in first trimester is most accurate.",
  },
  trimesters: [
    {
      name: "First Trimester",
      weeks: "Weeks 1-12",
      babyDevelopment: [
        "Week 4: Heart begins beating",
        "Week 6: Brain and spinal cord forming",
        "Week 8: All major organs developing",
        "Week 10: Fingers and toes form",
        "Week 12: Baby is ~2.5 inches, can make movements",
      ],
      motherChanges: ["Morning sickness and nausea", "Breast tenderness and swelling", "Extreme fatigue", "Frequent urination", "Food aversions and cravings"],
      keyAppointments: [
        { week: "6-8", test: "First prenatal visit, confirm pregnancy, medical history" },
        { week: "8-10", test: "Complete blood count, blood type, Rh factor, STI screening, urinalysis" },
        { week: "10-13", test: "NIPT (Non-Invasive Prenatal Testing) for chromosomal conditions" },
        { week: "11-14", test: "Nuchal translucency (NT) ultrasound + first trimester serum screening" },
      ],
      nutrition: ["Folic acid 400-800mcg daily (critical for neural tube development)", "Prenatal vitamin with iron and DHA", "Avoid raw fish, unpasteurized dairy, deli meats", "Limit caffeine to <200mg/day", "Small frequent meals for nausea management"],
      warningSignsSeekCare: ["Heavy vaginal bleeding", "Severe abdominal pain", "High fever >101°F (38.3°C)", "Severe vomiting preventing fluid intake"],
    },
    {
      name: "Second Trimester",
      weeks: "Weeks 13-27",
      babyDevelopment: [
        "Week 14: Sex may be determinable",
        "Week 16: Baby can hear sounds",
        "Week 18-20: Mother may feel first movements (quickening)",
        "Week 20: Baby is ~10 inches, halfway through pregnancy",
        "Week 24: Lungs developing surfactant, viability milestone",
      ],
      motherChanges: ["Energy often returns", "Visible baby bump", "Skin changes (linea nigra, melasma)", "Round ligament pain", "Braxton Hicks contractions may start"],
      keyAppointments: [
        { week: "15-20", test: "Quad screen (if NIPT not done) for neural tube defects" },
        { week: "18-22", test: "Anatomy ultrasound (detailed fetal survey)" },
        { week: "24-28", test: "Glucose challenge test for gestational diabetes" },
        { week: "24-28", test: "Rh antibody screen (if Rh-negative), consider RhoGAM" },
      ],
      nutrition: ["Increase calcium intake (1000mg/day)", "Iron-rich foods as blood volume increases", "Protein 75-100g/day for fetal growth", "Omega-3 fatty acids (DHA) for brain development", "Adequate hydration (8-12 cups/day)"],
      warningSignsSeekCare: ["Vaginal bleeding", "Severe headache with vision changes", "Sudden swelling of face/hands", "Decreased fetal movement", "Fluid leaking from vagina"],
    },
    {
      name: "Third Trimester",
      weeks: "Weeks 28-40",
      babyDevelopment: [
        "Week 28: Eyes can open, brain rapidly developing",
        "Week 32: Baby practicing breathing movements",
        "Week 34: Immune system maturing",
        "Week 36: Baby usually moves head-down",
        "Week 37: Early term (full term is 39-40 weeks), lungs nearing maturity",
        "Week 40: Average due date, baby ~7.5 lbs",
      ],
      motherChanges: ["Shortness of breath", "Frequent urination returns", "Difficulty sleeping", "Swollen ankles and feet", "Braxton Hicks more frequent", "Nesting instinct"],
      keyAppointments: [
        { week: "28", test: "Tdap vaccine (whooping cough protection for baby)" },
        { week: "28-32", test: "Biweekly prenatal visits begin" },
        { week: "35-37", test: "Group B Streptococcus (GBS) screening" },
        { week: "36", test: "Weekly visits, cervical checks, fetal position assessment" },
        { week: "39-41", test: "Non-stress tests and amniotic fluid checks if past due" },
      ],
      nutrition: ["Continue prenatal vitamins", "Extra 450 calories/day in third trimester", "Dates (6/day from week 36 - some studies suggest possible benefit for cervical ripening, discuss with provider)", "Red raspberry leaf tea (from week 32 - limited evidence, consult provider before use)", "Adequate fiber and fluids for constipation"],
      warningSignsSeekCare: ["Regular contractions before 37 weeks", "Sudden decrease in fetal movement", "Severe headache, vision changes, upper abdominal pain (preeclampsia)", "Vaginal bleeding", "Gush of fluid (possible membrane rupture)", "Fever >100.4°F (38°C)"],
    },
  ],
  laborSigns: {
    title: "Signs of Labor",
    earlyLabor: ["Bloody show (mucus plug with blood)", "Regular contractions increasing in frequency", "Lower back pain that doesn't go away", "Water breaking (rupture of membranes)"],
    whenToGoToHospital: [
      "Contractions 5 minutes apart, lasting 1 minute, for 1 hour (5-1-1 rule)",
      "Water breaks (regardless of contractions)",
      "Significant vaginal bleeding",
      "Decreased fetal movement",
      "Severe headache with vision changes",
    ],
  },
  postpartumRecovery: {
    title: "Postpartum Recovery",
    physicalRecovery: [
      { timeline: "First 24 hours", care: "Uterine massage, lochia (bleeding) begins, pain management, early ambulation" },
      { timeline: "Week 1", care: "Perineal care, sitz baths, stool softeners, breastfeeding establishment" },
      { timeline: "Weeks 2-4", care: "Gradual activity increase, incision care (if C-section), monitor for infection" },
      { timeline: "Week 6", care: "Postpartum checkup, pelvic floor assessment, contraception discussion" },
      { timeline: "Months 2-6", care: "Return to exercise (pelvic floor first), weight management, mental health check-in" },
    ],
    mentalHealth: {
      babyBlues: "Mild mood swings, crying, anxiety in first 2 weeks. Affects up to 80% of new mothers. Usually resolves on its own.",
      postpartumDepression: "Persistent sadness, hopelessness, difficulty bonding lasting >2 weeks. Affects 10-15% of mothers. Treatment with therapy and/or medication is effective.",
      postpartumAnxiety: "Excessive worry, racing thoughts, inability to rest. Often co-occurs with PPD. CBT and medication help.",
      postpartumPsychosis: "Rare (0.1-0.2%). Confusion, hallucinations, paranoia, risk of self-harm. Medical emergency requiring immediate hospitalization.",
    },
    breastfeeding: [
      "Colostrum available immediately; mature milk arrives days 3-5",
      "Feed on demand, typically 8-12 times per 24 hours",
      "Proper latch: wide open mouth, flanged lips, chin touching breast",
      "Signs of adequate feeding: 6+ wet diapers/day by day 4, steady weight gain",
      "Seek lactation consultant for persistent pain, poor latch, or low supply concerns",
    ],
  },
};

export const MENOPAUSE_CARE_GUIDE = {
  stages: [
    {
      name: "Perimenopause",
      ageRange: "Typically 40-51",
      duration: "4-8 years on average",
      description: "The transition period when ovarian function declines. Hormone levels fluctuate significantly.",
      keyChanges: [
        "Irregular periods (shorter/longer cycles, heavier/lighter flow)",
        "Hot flashes begin (75% of women)",
        "Sleep disruption",
        "Mood changes and irritability",
        "Vaginal dryness begins",
        "Decreased fertility (but pregnancy still possible)",
      ],
      management: [
        { area: "Hot Flashes", options: ["Low-dose hormonal contraceptives", "Lifestyle: layered clothing, cool environment, avoid triggers (alcohol, spicy food, caffeine)", "Cognitive behavioral therapy (evidence-based)", "SSRIs/SNRIs (paroxetine FDA-approved for hot flashes)"] },
        { area: "Irregular Bleeding", options: ["Hormonal IUD for regulation", "Low-dose combined OC", "Track patterns and report heavy/prolonged bleeding", "Endometrial biopsy if bleeding is very irregular after age 45"] },
        { area: "Sleep", options: ["Sleep hygiene practices", "CBT for insomnia (CBT-I)", "Melatonin (short-term)", "Address night sweats with cooling bedding"] },
        { area: "Mood", options: ["Regular exercise (proven mood benefit)", "CBT or counseling", "SSRIs if clinically depressed", "Social support and stress management"] },
      ],
    },
    {
      name: "Menopause",
      ageRange: "Average age 51 (range 45-55)",
      duration: "Defined as 12 consecutive months without a period",
      description: "Ovaries have stopped releasing eggs and producing most estrogen. This is a single point in time confirmed retrospectively.",
      keyChanges: [
        "Final menstrual period confirmed",
        "Hot flashes may intensify",
        "Vaginal atrophy progresses",
        "Accelerated bone loss begins",
        "Cardiovascular risk profile changes",
        "Skin and hair changes",
      ],
      management: [
        { area: "Hormone Replacement Therapy (HRT)", options: ["Estrogen + progesterone for women with uterus", "Estrogen-only for women without uterus (post-hysterectomy)", "Start within 10 years of menopause or before age 60 (timing hypothesis)", "Lowest effective dose for shortest needed duration", "Benefits: hot flash relief, bone protection, vaginal health, mood improvement", "Risks to discuss: breast cancer (small increase after 5+ years combined HRT), blood clots, stroke"] },
        { area: "Non-Hormonal Options", options: ["Fezolinetant (Veozah) - NK3 receptor antagonist for hot flashes", "SSRIs/SNRIs (paroxetine, venlafaxine)", "Gabapentin for hot flashes", "Ospemifene for vaginal dryness", "Vaginal moisturizers and lubricants", "Black cohosh (limited evidence, generally safe short-term)"] },
        { area: "Bone Health", options: ["Calcium 1200mg/day + Vitamin D 800-1000 IU/day", "Weight-bearing exercise 30 min most days", "DEXA scan at age 65 (or earlier with risk factors)", "Bisphosphonates if osteoporosis diagnosed", "Fall prevention assessment"] },
      ],
    },
    {
      name: "Post-Menopause",
      ageRange: "After menopause (51+)",
      duration: "Rest of life",
      description: "The years after menopause. Estrogen levels remain consistently low. Focus shifts to long-term health optimization and disease prevention.",
      keyChanges: [
        "Hot flashes gradually decrease (but may persist 7-10 years)",
        "Genitourinary syndrome of menopause (GSM) may worsen",
        "Osteoporosis risk increases significantly",
        "Cardiovascular disease becomes leading cause of death",
        "Cognitive changes may occur",
        "Weight redistribution to abdomen",
      ],
      management: [
        { area: "Cardiovascular Health", options: ["Blood pressure monitoring and treatment (<130/80 target)", "Lipid panel annually (LDL often rises post-menopause)", "Statin therapy if indicated by ASCVD risk score", "Mediterranean diet pattern", "150+ minutes moderate exercise weekly", "Smoking cessation (if applicable)", "Diabetes screening every 3 years"] },
        { area: "Genitourinary Syndrome (GSM)", options: ["Low-dose vaginal estrogen (cream, ring, or tablet) - discuss with oncologist if breast cancer history", "Vaginal DHEA (prasterone)", "Ospemifene oral SERM", "Regular sexual activity or vaginal dilators", "Vaginal moisturizers 2-3 times/week", "Pelvic floor physical therapy for incontinence"] },
        { area: "Cognitive Health", options: ["Regular aerobic exercise (strongest evidence)", "Social engagement and intellectual stimulation", "Mediterranean/MIND diet", "Treat sleep disorders and depression", "Blood pressure and diabetes control (vascular risk factors)", "HRT not recommended solely for cognitive protection"] },
        { area: "Cancer Screening", options: ["Mammography every 1-2 years through age 75 (individual decision after)", "Colorectal cancer screening through age 75", "Lung cancer screening if smoking history (20+ pack-years)", "Any post-menopausal bleeding requires evaluation (endometrial biopsy)"] },
        { area: "Musculoskeletal Health", options: ["DEXA scan every 2 years if osteopenia/osteoporosis", "Weight-bearing and resistance exercises", "Balance training for fall prevention", "Adequate protein (1.0-1.2g/kg/day)", "Vitamin K2 (limited evidence for bone health, consult provider)", "Consider bisphosphonates, denosumab, or romosozumab if high fracture risk"] },
      ],
    },
  ],
  symptomTracker: {
    symptoms: [
      { id: "hot_flashes", label: "Hot Flashes", category: "vasomotor" },
      { id: "night_sweats", label: "Night Sweats", category: "vasomotor" },
      { id: "sleep_disruption", label: "Sleep Disruption", category: "sleep" },
      { id: "mood_changes", label: "Mood Changes", category: "psychological" },
      { id: "anxiety", label: "Anxiety", category: "psychological" },
      { id: "irritability", label: "Irritability", category: "psychological" },
      { id: "brain_fog", label: "Brain Fog / Memory", category: "cognitive" },
      { id: "joint_pain", label: "Joint Pain", category: "musculoskeletal" },
      { id: "vaginal_dryness", label: "Vaginal Dryness", category: "genitourinary" },
      { id: "urinary_frequency", label: "Urinary Frequency", category: "genitourinary" },
      { id: "headaches", label: "Headaches", category: "general" },
      { id: "fatigue", label: "Fatigue", category: "general" },
      { id: "weight_gain", label: "Weight Changes", category: "metabolic" },
      { id: "hair_thinning", label: "Hair Thinning", category: "skin_hair" },
      { id: "dry_skin", label: "Dry Skin", category: "skin_hair" },
      { id: "libido_changes", label: "Libido Changes", category: "sexual_health" },
    ],
    severityLevels: ["none", "mild", "moderate", "severe"],
  },
};

export const MENOPAUSAL_RESILIENCE_DATA = {
  hormoneTracking: {
    title: "Perimenopause & Menopause Hormone Panel",
    description: "Track the key hormones that shift during the menopausal transition to guide personalized HRT and lifestyle optimization.",
    hormones: [
      {
        name: "Estradiol (E2)",
        role: "The primary estrogen. Declining estradiol drives hot flashes, bone loss, vaginal atrophy, mood changes, and cardiovascular risk.",
        premenopausalRange: "30-400 pg/mL (varies by cycle phase)",
        perimenopauseRange: "Erratic fluctuations: 10-500+ pg/mL",
        postmenopauseRange: "<30 pg/mL (often <10 pg/mL)",
        hrtTarget: "40-100 pg/mL on HRT (symptom relief threshold: >50 pg/mL)",
        testingGuidance: "Test on day 2-3 of cycle (if still cycling). Post-menopause: any day. Fasting morning draw preferred.",
        clinicalCode: "LOINC: 2243-4",
        icon: "thermometer",
        color: "#EC4899",
      },
      {
        name: "Progesterone",
        role: "Protective hormone for uterine lining. Drops first during perimenopause, causing irregular/heavy periods. Essential if taking estrogen HRT.",
        premenopausalRange: "Luteal peak: 5-20 ng/mL",
        perimenopauseRange: "Often <5 ng/mL even mid-cycle (anovulatory cycles)",
        postmenopauseRange: "<0.5 ng/mL",
        hrtTarget: "Oral micronized progesterone 100-200mg/day (if on HRT with uterus)",
        testingGuidance: "Test day 21 of cycle (if cycling) to confirm ovulation. Post-menopause: baseline only.",
        clinicalCode: "LOINC: 2839-2",
        icon: "shield",
        color: "#8B5CF6",
      },
      {
        name: "Total Testosterone",
        role: "Critical for energy, libido, muscle mass, bone density, and cognitive clarity. Often overlooked in menopausal care.",
        premenopausalRange: "15-70 ng/dL",
        perimenopauseRange: "10-40 ng/dL (gradual decline)",
        postmenopauseRange: "5-25 ng/dL",
        hrtTarget: "20-50 ng/dL (supplementation if symptomatic and <20 ng/dL)",
        testingGuidance: "Fasting morning draw. Also check free testosterone and SHBG for complete picture.",
        clinicalCode: "LOINC: 2986-8",
        icon: "zap",
        color: "#F59E0B",
      },
      {
        name: "Free Testosterone",
        role: "The bioavailable fraction. SHBG rises with oral estrogen, lowering free testosterone even when total appears normal.",
        premenopausalRange: "1.0-8.5 pg/mL",
        perimenopauseRange: "0.5-5.0 pg/mL",
        postmenopauseRange: "0.3-3.0 pg/mL",
        hrtTarget: "Monitor alongside SHBG. If low despite adequate total, consider transdermal route.",
        testingGuidance: "Calculate from total testosterone + SHBG. Direct assay less reliable at low levels.",
        clinicalCode: "LOINC: 2991-8",
        icon: "zap",
        color: "#F97316",
      },
      {
        name: "TSH (Thyroid Stimulating Hormone)",
        role: "Thyroid dysfunction mimics and amplifies menopausal symptoms: fatigue, weight gain, brain fog, mood swings, hair loss.",
        premenopausalRange: "0.5-4.5 mIU/L",
        perimenopauseRange: "Same reference range, but symptoms overlap. Screen aggressively.",
        postmenopauseRange: "0.5-4.5 mIU/L (consider optimal: 1.0-2.5 mIU/L)",
        hrtTarget: "Optimal TSH: 1.0-2.5 mIU/L. HRT can increase TBG, altering thyroid hormone availability.",
        testingGuidance: "Fasting morning draw. If TSH borderline, also test Free T4, Free T3, and thyroid antibodies (anti-TPO).",
        clinicalCode: "LOINC: 3016-3",
        icon: "activity",
        color: "#3B82F6",
      },
      {
        name: "Free T4 (Thyroxine)",
        role: "Primary thyroid output hormone. Low Free T4 with normal/elevated TSH indicates hypothyroidism, common in menopause.",
        premenopausalRange: "0.8-1.8 ng/dL",
        perimenopauseRange: "Same. Monitor if fatigue or weight gain persists despite HRT.",
        postmenopauseRange: "0.8-1.8 ng/dL",
        hrtTarget: "Upper half of range (1.2-1.8 ng/dL) for optimal energy/metabolism.",
        testingGuidance: "Always test with TSH. Oral estrogen can raise TBG, lowering free hormone availability.",
        clinicalCode: "LOINC: 3024-7",
        icon: "activity",
        color: "#06B6D4",
      },
      {
        name: "Free T3 (Triiodothyronine)",
        role: "The active thyroid hormone. Low T3 despite normal TSH/T4 ('low T3 syndrome') causes persistent fatigue and brain fog.",
        premenopausalRange: "2.3-4.2 pg/mL",
        perimenopauseRange: "May decline with stress and caloric restriction.",
        postmenopauseRange: "2.3-4.2 pg/mL (optimal: 3.0-4.0 pg/mL)",
        hrtTarget: "Some patients benefit from combination T4/T3 therapy. Discuss with endocrinologist.",
        testingGuidance: "Test if fatigue persists despite normal TSH and adequate T4. Reverse T3 can also be informative.",
        clinicalCode: "LOINC: 3051-0",
        icon: "activity",
        color: "#14B8A6",
      },
    ],
  },
  resilienceScore: {
    title: "Menopausal Resilience Score",
    description: "A composite score combining key biomarkers and functional metrics to assess your overall resilience during the menopausal transition. Share with your provider for targeted interventions.",
    scoringMethod: "Each domain is scored 0-100 based on your most recent results. The overall Resilience Score is the weighted average across all domains.",
    domains: [
      {
        name: "Bone Density (DEXA)",
        weight: 25,
        icon: "shield",
        color: "#EC4899",
        description: "Bone mineral density measured by DEXA scan at lumbar spine and femoral neck.",
        scoring: [
          { range: "T-score > -1.0", label: "Normal", score: "90-100", color: "#10B981" },
          { range: "T-score -1.0 to -1.5", label: "Mild Osteopenia", score: "70-89", color: "#F59E0B" },
          { range: "T-score -1.5 to -2.5", label: "Moderate Osteopenia", score: "40-69", color: "#F97316" },
          { range: "T-score < -2.5", label: "Osteoporosis", score: "0-39", color: "#EF4444" },
        ],
        interventions: [
          "Weight-bearing exercise 30+ min most days",
          "Calcium 1200mg/day + Vitamin D 1000-2000 IU/day",
          "Consider bisphosphonates or denosumab if T-score < -2.5",
          "HRT within 10 years of menopause protects bone",
          "Resistance training 2-3x/week for mechanical loading",
        ],
        testFrequency: "Every 2 years if osteopenia; baseline at age 65 (or earlier with risk factors)",
        clinicalCode: "LOINC: 46278-8",
      },
      {
        name: "Muscle Mass & Strength",
        weight: 20,
        icon: "trending-up",
        color: "#8B5CF6",
        description: "Lean body mass and grip strength as markers of sarcopenia risk. Muscle loss accelerates post-menopause.",
        scoring: [
          { range: "ALMI > 6.0 kg/m\u00B2 + Grip > 20kg", label: "Excellent", score: "90-100", color: "#10B981" },
          { range: "ALMI 5.5-6.0 + Grip 16-20kg", label: "Good", score: "70-89", color: "#F59E0B" },
          { range: "ALMI 5.0-5.5 + Grip 12-16kg", label: "At Risk", score: "40-69", color: "#F97316" },
          { range: "ALMI < 5.0 + Grip < 12kg", label: "Sarcopenia", score: "0-39", color: "#EF4444" },
        ],
        interventions: [
          "Progressive resistance training 3x/week (compound movements)",
          "Protein intake 1.2-1.6g/kg/day (leucine-rich sources)",
          "Creatine monohydrate 3-5g/day (evidence-based for post-menopausal muscle)",
          "Testosterone supplementation if clinically low and symptomatic",
          "Vitamin D optimization (>30 ng/mL) for muscle function",
        ],
        testFrequency: "Body composition via DEXA annually; grip strength at each visit",
        clinicalCode: "LOINC: 73964-9",
      },
      {
        name: "ApoB (Cardiovascular Risk)",
        weight: 25,
        icon: "heart",
        color: "#EF4444",
        description: "Apolipoprotein B is the single best predictor of cardiovascular risk. Each atherogenic particle carries exactly one ApoB molecule.",
        scoring: [
          { range: "ApoB < 80 mg/dL", label: "Optimal", score: "90-100", color: "#10B981" },
          { range: "ApoB 80-100 mg/dL", label: "Borderline", score: "60-89", color: "#F59E0B" },
          { range: "ApoB 100-120 mg/dL", label: "Elevated", score: "30-59", color: "#F97316" },
          { range: "ApoB > 120 mg/dL", label: "High Risk", score: "0-29", color: "#EF4444" },
        ],
        interventions: [
          "Statin therapy (atorvastatin 10-40mg) if ApoB > 100 mg/dL with risk factors",
          "Mediterranean diet pattern (reduce saturated fat, increase omega-3)",
          "Exercise 150+ min/week moderate intensity",
          "Consider ezetimibe add-on if statin insufficient",
          "ApoB is superior to LDL-C for risk assessment post-menopause",
          "Estrogen HRT can improve lipid profile (transdermal preferred for neutral effect on triglycerides)",
        ],
        testFrequency: "Annually; more frequently if on lipid-lowering therapy",
        clinicalCode: "LOINC: 1884-6",
      },
      {
        name: "Sleep Efficiency",
        weight: 15,
        icon: "moon",
        color: "#3B82F6",
        description: "Sleep quality and efficiency measured by wearable data or sleep study. Sleep disruption from night sweats and hormonal changes is a major resilience factor.",
        scoring: [
          { range: "Sleep Efficiency > 85%", label: "Excellent", score: "90-100", color: "#10B981" },
          { range: "Sleep Efficiency 75-85%", label: "Fair", score: "60-89", color: "#F59E0B" },
          { range: "Sleep Efficiency 65-75%", label: "Poor", score: "30-59", color: "#F97316" },
          { range: "Sleep Efficiency < 65%", label: "Severely Disrupted", score: "0-29", color: "#EF4444" },
        ],
        interventions: [
          "CBT-I (Cognitive Behavioral Therapy for Insomnia) — first-line, evidence-based",
          "HRT for night sweats (most effective intervention for vasomotor-related insomnia)",
          "Magnesium glycinate 400mg before bed",
          "Sleep hygiene: cool room (65-68°F), blackout curtains, consistent schedule",
          "Limit caffeine after noon; limit alcohol (disrupts deep sleep)",
          "Consider wearable tracking (Oura, WHOOP, Apple Watch) for objective monitoring",
        ],
        testFrequency: "Continuous via wearable; formal sleep study if suspected apnea",
        clinicalCode: "LOINC: 93832-4",
      },
      {
        name: "Hormone Balance",
        weight: 15,
        icon: "activity",
        color: "#F59E0B",
        description: "Composite of estradiol, progesterone, testosterone, and thyroid markers. Optimal hormone balance supports all other resilience domains.",
        scoring: [
          { range: "All hormones in optimal range + symptom-free", label: "Optimized", score: "90-100", color: "#10B981" },
          { range: "Most hormones adequate + mild symptoms", label: "Adequate", score: "60-89", color: "#F59E0B" },
          { range: "Multiple hormones suboptimal + moderate symptoms", label: "Suboptimal", score: "30-59", color: "#F97316" },
          { range: "Severely deficient + significant symptoms", label: "Deficient", score: "0-29", color: "#EF4444" },
        ],
        interventions: [
          "Comprehensive hormone panel every 6-12 months during perimenopause",
          "Consider HRT initiation within the 'window of opportunity' (<10 years post-menopause, <60 years old)",
          "Transdermal estradiol + micronized progesterone (safest HRT profile)",
          "Testosterone pellets or cream if symptomatic with low levels",
          "Thyroid optimization: target TSH 1.0-2.5, adequate Free T3/T4",
          "DHEA-S monitoring (adrenal precursor declines with age)",
        ],
        testFrequency: "Every 6-12 months during transition; annually post-menopause if stable on HRT",
        clinicalCode: "Custom composite",
      },
    ],
  },
  providerReport: {
    title: "Menopausal Resilience Report for Provider",
    description: "Generate a comprehensive resilience assessment to share with your provider for personalized counseling, HRT optimization, and targeted remediation.",
    reportSections: [
      "Hormone panel trends (estradiol, progesterone, testosterone, thyroid — last 4 draws)",
      "DEXA bone density trajectory with T-score trend",
      "Body composition changes (lean mass, fat mass, ALMI)",
      "ApoB and lipid panel trends with cardiovascular risk stratification",
      "Sleep efficiency data from wearable (30-day average)",
      "Symptom severity log (hot flashes, mood, cognitive, joint pain)",
      "Current HRT regimen and dosages",
      "Supplement and medication list",
      "Resilience Score breakdown by domain with trend arrows",
      "Recommended interventions prioritized by score gap",
    ],
    providerQuestions: [
      "Is my current HRT dose optimizing my estradiol to the 40-100 pg/mL range?",
      "Should we add testosterone given my symptoms and lab values?",
      "Is my thyroid truly optimized, or should we trial T3 supplementation?",
      "My ApoB is trending up — should we discuss statin initiation?",
      "My bone density has declined — do I need more than calcium/vitamin D?",
      "My sleep efficiency is poor — could HRT adjustment help my night sweats?",
    ],
  },
};

export const PREVENTIVE_SCREENINGS = [
  {
    name: "Cervical Cancer Screening (Pap + HPV)",
    ageRange: "21-65",
    frequency: "Every 3 years (Pap alone 21-29); Every 5 years (Pap+HPV 30-65)",
    guidelines: "USPSTF Grade A",
    description: "Screens for cervical cancer and high-risk HPV strains. Start at age 21 regardless of sexual history.",
    international: true,
  },
  {
    name: "Breast Cancer Screening (Mammography)",
    ageRange: "40-74",
    frequency: "Every 1-2 years",
    guidelines: "USPSTF Grade B",
    description: "Low-dose X-ray screening for breast cancer. Earlier screening for high-risk patients.",
    international: true,
  },
  {
    name: "Bone Density (DEXA Scan)",
    ageRange: "65+",
    frequency: "Every 2 years (or earlier if risk factors)",
    guidelines: "USPSTF Grade B",
    description: "Screens for osteoporosis. Earlier for postmenopausal women with risk factors.",
    international: true,
  },
  {
    name: "BRCA Genetic Testing",
    ageRange: "18+ (with family history)",
    frequency: "One-time genetic counseling and testing",
    guidelines: "USPSTF Grade B (for high-risk)",
    description: "Genetic testing for BRCA1/BRCA2 mutations associated with breast and ovarian cancer.",
    international: true,
  },
  {
    name: "Chlamydia & Gonorrhea Screening",
    ageRange: "Under 25 (sexually active), all pregnant women",
    frequency: "Annually (or at each pregnancy)",
    guidelines: "USPSTF Grade B",
    description: "STI screening to prevent complications including pelvic inflammatory disease and infertility.",
    international: true,
  },
  {
    name: "HIV Screening",
    ageRange: "15-65 (all pregnant women)",
    frequency: "At least once; more often with risk factors",
    guidelines: "USPSTF Grade A",
    description: "Universal HIV screening recommended for all adolescents and adults.",
    international: true,
  },
  {
    name: "Hepatitis B Screening",
    ageRange: "All pregnant women, adults at risk",
    frequency: "First prenatal visit (each pregnancy)",
    guidelines: "USPSTF Grade A",
    description: "Tests for hepatitis B virus to prevent transmission and guide treatment.",
    international: true,
  },
  {
    name: "Intimate Partner Violence Screening",
    ageRange: "All reproductive-age women",
    frequency: "At clinical visits",
    guidelines: "USPSTF Grade B",
    description: "Universal screening with validated tools and referral to intervention services.",
    international: true,
  },
  {
    name: "Gestational Diabetes Screening",
    ageRange: "All pregnant women",
    frequency: "24-28 weeks gestation (earlier if risk factors)",
    guidelines: "USPSTF Grade B",
    description: "Oral glucose tolerance test to detect gestational diabetes mellitus.",
    international: true,
  },
  {
    name: "Preeclampsia Screening",
    ageRange: "All pregnant women",
    frequency: "Every prenatal visit",
    guidelines: "ACOG Standard",
    description: "Blood pressure and urine protein monitoring to detect preeclampsia early.",
    international: true,
  },
  {
    name: "Thyroid Function (TSH)",
    ageRange: "Pregnant women, symptomatic women",
    frequency: "First trimester (pregnancy), as needed (symptomatic)",
    guidelines: "ATA Guideline",
    description: "Thyroid screening critical during pregnancy for fetal development.",
    international: true,
  },
  {
    name: "Iron Deficiency Anemia Screening",
    ageRange: "All pregnant women, menstruating women with risk factors",
    frequency: "First prenatal visit, as needed",
    guidelines: "USPSTF Grade B (pregnant), WHO recommendation",
    description: "Complete blood count to detect anemia, especially common during pregnancy and heavy menstruation.",
    international: true,
  },
];

export const EDINBURGH_PND_QUESTIONS = [
  "I have been able to laugh and see the funny side of things",
  "I have looked forward with enjoyment to things",
  "I have blamed myself unnecessarily when things went wrong",
  "I have been anxious or worried for no good reason",
  "I have felt scared or panicky for no very good reason",
  "Things have been getting on top of me",
  "I have been so unhappy that I have had difficulty sleeping",
  "I have felt sad or miserable",
  "I have been so unhappy that I have been crying",
  "The thought of harming myself has occurred to me",
];

export function calculateEdinburghScore(answers: number[]): {
  score: number;
  risk: "low" | "moderate" | "high";
  recommendation: string;
} {
  const score = answers.reduce((sum, a) => sum + a, 0);
  if (score >= 13) {
    return {
      score,
      risk: "high",
      recommendation: "Score indicates likely depression. Immediate clinical assessment recommended. Contact your healthcare provider.",
    };
  }
  if (score >= 10) {
    return {
      score,
      risk: "moderate",
      recommendation: "Score suggests possible depression. Schedule a follow-up with your healthcare provider for further evaluation.",
    };
  }
  return {
    score,
    risk: "low",
    recommendation: "Score within normal range. Continue monitoring and reach out if symptoms change.",
  };
}

export function estimateOvulationWindow(cycleLength: number, lastPeriodStart: Date): {
  ovulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  nextPeriodDate: Date;
} {
  const ovulationDay = cycleLength - 14;
  const ovulationDate = new Date(lastPeriodStart);
  ovulationDate.setDate(ovulationDate.getDate() + ovulationDay);

  const fertileWindowStart = new Date(ovulationDate);
  fertileWindowStart.setDate(fertileWindowStart.getDate() - 5);

  const fertileWindowEnd = new Date(ovulationDate);
  fertileWindowEnd.setDate(fertileWindowEnd.getDate() + 1);

  const nextPeriodDate = new Date(lastPeriodStart);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + cycleLength);

  return { ovulationDate, fertileWindowStart, fertileWindowEnd, nextPeriodDate };
}

export const FERTILITY_CYCLE_DATA = {
  miraHormones: {
    title: "MIRA At-Home Hormone Tracking",
    description: "MIRA Fertility monitors measure actual hormone concentrations in urine, providing quantitative data rather than simple positive/negative results.",
    hormones: [
      {
        name: "LH (Luteinizing Hormone)",
        role: "Triggers ovulation. LH surge occurs 24-36 hours before egg release.",
        normalRange: "Baseline: 2-15 mIU/mL, Surge: 25-100+ mIU/mL",
        trackingTip: "Test daily in the morning starting 3 days before expected surge. The MIRA analyzer detects your personal baseline and surge pattern.",
        clinicalCode: "LOINC: 10501-5",
      },
      {
        name: "E3G (Estrogen Metabolite)",
        role: "Rises during the follicular phase as follicles mature. Estrogen rise signals the body to prepare for ovulation.",
        normalRange: "Follicular: 10-30 ng/mL, Pre-ovulatory peak: 40-100+ ng/mL",
        trackingTip: "Rising E3G indicates your fertile window is opening. Combined with LH, this gives 6-day advance notice of peak fertility.",
        clinicalCode: "LOINC: 34290-6",
      },
      {
        name: "PdG (Progesterone Metabolite)",
        role: "Rises after ovulation to confirm egg release and support potential implantation. Essential for confirming ovulation actually occurred.",
        normalRange: "Pre-ovulation: <0.5 mcg/mL, Post-ovulation: 5-25+ mcg/mL",
        trackingTip: "Test 7-10 days after suspected ovulation (DPO 7-10). Sustained elevation confirms successful ovulation.",
        clinicalCode: "LOINC: 2840-0",
      },
      {
        name: "FSH (Follicle Stimulating Hormone)",
        role: "Stimulates follicle growth in the ovaries. Elevated baseline FSH may indicate diminished ovarian reserve.",
        normalRange: "Day 3: 3-10 mIU/mL, Elevated: >10 mIU/mL",
        trackingTip: "Test on cycle day 3. Consistent elevation above 10 mIU/mL warrants discussion with your fertility specialist.",
        clinicalCode: "LOINC: 15067-2",
      },
    ],
  },
  cyclePhases: [
    {
      phase: "Early Follicular",
      days: "Days 1-5",
      fertility: "Low",
      color: "#EF4444",
      hormoneProfile: "Estrogen and progesterone at baseline. FSH beginning to rise.",
      bodyTemp: "Lower (97.0-97.5°F / 36.1-36.4°C)",
      cervicalMucus: "Dry or minimal",
      miraInsight: "Begin daily E3G testing to establish your personal baseline.",
      optimization: ["Rest and recovery", "Iron-rich foods to replenish", "Gentle movement"],
    },
    {
      phase: "Late Follicular",
      days: "Days 6-10",
      fertility: "Rising",
      color: "#F59E0B",
      hormoneProfile: "E3G rising steadily. Dominant follicle maturing.",
      bodyTemp: "Still in lower range",
      cervicalMucus: "Becoming creamy/sticky",
      miraInsight: "Watch for E3G upward trend. Begin LH testing when E3G starts rising.",
      optimization: ["Increase hydration", "CoQ10 and folate supplementation", "Moderate exercise"],
    },
    {
      phase: "Fertile Window",
      days: "Days 11-16 (varies)",
      fertility: "Peak",
      color: "#10B981",
      hormoneProfile: "E3G peaks, LH surges 24-36 hours before ovulation.",
      bodyTemp: "Slight dip just before ovulation, then rises",
      cervicalMucus: "Egg-white consistency (EWCM) — clear, stretchy, slippery",
      miraInsight: "LH surge detected! Peak fertility day is surge day + 1. Optimal timing: every 24-48 hours during this window.",
      optimization: ["Timed intercourse every 24-48 hours", "Avoid lubricants that impair sperm motility", "Reduce intense exercise", "Pre-Seed or fertility-friendly lubricant if needed"],
    },
    {
      phase: "Post-Ovulation (Luteal)",
      days: "Days 17-28",
      fertility: "Low (Two-Week Wait)",
      color: "#8B5CF6",
      hormoneProfile: "PdG rises to confirm ovulation. Progesterone sustains uterine lining.",
      bodyTemp: "Elevated (97.6-98.6°F / 36.4-37°C) — sustained rise confirms ovulation",
      cervicalMucus: "Thick, sticky, or dry",
      miraInsight: "Test PdG on DPO 7-10 to confirm ovulation. Sustained PdG elevation is a positive sign.",
      optimization: ["Progesterone-supporting foods (sweet potato, spinach, beans)", "Reduce caffeine and alcohol", "Manage stress with meditation", "Avoid NSAIDs which may affect implantation"],
    },
  ],
  fertilityMetrics: {
    title: "Key Fertility Indicators to Track",
    metrics: [
      {
        name: "Cycle Length Regularity",
        description: "Consistent cycle lengths (24-35 days) indicate healthy ovulatory patterns.",
        idealRange: "Variation < 7 days between cycles",
        redFlag: "Cycles consistently < 21 or > 35 days",
        icon: "calendar",
      },
      {
        name: "Luteal Phase Length",
        description: "The time between ovulation and next period. Short luteal phase may indicate insufficient progesterone.",
        idealRange: "12-14 days",
        redFlag: "Consistently < 10 days (luteal phase deficiency)",
        icon: "clock",
      },
      {
        name: "Ovulation Confirmation",
        description: "Confirming ovulation occurred via PdG rise or BBT shift.",
        idealRange: "PdG > 5 mcg/mL on DPO 7-10",
        redFlag: "No PdG rise or BBT shift — anovulatory cycle",
        icon: "check-circle",
      },
      {
        name: "Cycle Day of Ovulation",
        description: "Earlier ovulation (day 12-16) is associated with better egg quality.",
        idealRange: "Cycle day 12-16",
        redFlag: "Consistently after day 21",
        icon: "target",
      },
      {
        name: "Basal Body Temperature (BBT)",
        description: "Temperature shift of 0.5-1°F after ovulation confirms progesterone production.",
        idealRange: "Clear biphasic pattern with 0.5°F+ shift",
        redFlag: "Flat or monophasic chart across the cycle",
        icon: "thermometer",
      },
    ],
  },
  providerShareTemplate: {
    title: "Fertility Report for Provider",
    description: "Share your MIRA cycle data with your fertility specialist for personalized coaching.",
    sections: [
      "Cycle length history (last 6 cycles)",
      "Ovulation day consistency",
      "LH surge pattern and amplitude",
      "E3G rise-to-peak duration",
      "PdG confirmation levels",
      "Luteal phase length trends",
      "BBT chart overlay",
      "Symptom log summary",
    ],
    sharingMethods: [
      { method: "PDF Export", description: "Generate a formatted PDF with charts and data tables" },
      { method: "FHIR Bundle", description: "Export as FHIR Observation resources for EHR integration" },
      { method: "Provider Portal", description: "Share directly via secure link to your provider's patient portal" },
    ],
  },
  confidenceFactors: {
    title: "Building Confidence in Your Fertility Journey",
    factors: [
      {
        category: "Knowledge is Power",
        insight: "Understanding your unique hormone patterns removes guesswork. MIRA gives you quantitative data — not just smiley faces.",
        statistic: "Studies show fertility awareness methods combined with at-home hormone monitoring can reduce time to pregnancy by up to 30%.",
      },
      {
        category: "Timing Optimization",
        insight: "The fertile window is only ~6 days per cycle. Accurate tracking ensures you don't miss it.",
        statistic: "Probability of conception per cycle: 25-30% with optimal timing vs 10% with random timing.",
      },
      {
        category: "Early Issue Detection",
        insight: "Tracking over multiple cycles can reveal patterns that indicate treatable conditions (short luteal phase, anovulation, low progesterone).",
        statistic: "Up to 40% of fertility issues can be identified through cycle tracking before requiring invasive testing.",
      },
      {
        category: "Reduced Time to Pregnancy",
        insight: "Couples using quantitative hormone monitoring typically conceive faster than those using calendar-only methods.",
        statistic: "Average time to pregnancy: 3-4 cycles with hormone tracking vs 6-8 cycles without.",
      },
    ],
  },
  whenToSeeSpecialist: {
    title: "When to Consult a Fertility Specialist",
    criteria: [
      { condition: "Under 35 and trying for 12+ months without success", urgency: "Schedule consultation" },
      { condition: "Over 35 and trying for 6+ months without success", urgency: "Schedule consultation" },
      { condition: "Over 40 — consider evaluation before trying", urgency: "Proactive consultation recommended" },
      { condition: "Irregular or absent periods", urgency: "Schedule soon" },
      { condition: "Known endometriosis, PCOS, or fibroids", urgency: "Schedule before trying" },
      { condition: "History of recurrent miscarriage (2+)", urgency: "Seek evaluation" },
      { condition: "Male partner with known fertility concerns", urgency: "Both partners should be evaluated" },
      { condition: "Anovulatory cycles detected by MIRA (no PdG rise)", urgency: "Schedule within 1-2 cycles" },
    ],
  },
};

export function calculateDueDate(lastPeriodStart: Date): {
  dueDate: Date;
  currentWeek: number;
  currentDay: number;
  trimester: 1 | 2 | 3;
  daysRemaining: number;
} {
  const dueDate = new Date(lastPeriodStart);
  dueDate.setDate(dueDate.getDate() + 280);

  const today = new Date();
  const diffMs = today.getTime() - lastPeriodStart.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(totalDays / 7);
  const currentDay = totalDays % 7;

  let trimester: 1 | 2 | 3 = 1;
  if (currentWeek >= 28) trimester = 3;
  else if (currentWeek >= 13) trimester = 2;

  const daysRemaining = Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return { dueDate, currentWeek, currentDay, trimester, daysRemaining };
}
