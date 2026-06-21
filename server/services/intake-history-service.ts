interface DiagnosisRef {
  code: string;
  display: string;
  category: string;
}

interface SurgeryRef {
  code: string;
  display: string;
  category: string;
}

interface MedicationRef {
  rxcui: string;
  display: string;
  category: string;
}

interface AllergyEntry {
  id: string;
  name: string;
  type: "medication" | "food" | "environmental";
  severity: "mild" | "moderate" | "severe" | "life-threatening";
  reaction: string;
  onsetDate?: string;
  status: "active" | "inactive" | "resolved";
}

interface SocialHistoryData {
  tobacco: { status: string; type?: string; amount?: string; yearsUsed?: number; quitDate?: string };
  alcohol: { status: string; frequency?: string; type?: string; amount?: string };
  drugs: { status: string; substances?: string[] };
  exercise: { frequency: string; type?: string; duration?: string };
  diet: { type: string; restrictions?: string[] };
  occupation: { current: string; exposures?: string[] };
  maritalStatus: string;
  livingSituation: string;
  education: string;
  sexualHistory: { active: boolean; partners?: string; contraception?: string };
}

interface PEGScore {
  pain: number;
  enjoyment: number;
  generalActivity: number;
  totalScore: number;
  interpretation: string;
  assessedAt: string;
}

interface PHQ9Response {
  questionIndex: number;
  score: number;
}

interface PHQ9Result {
  responses: PHQ9Response[];
  totalScore: number;
  severity: string;
  recommendation: string;
  assessedAt: string;
}

interface SDOHDomain {
  domain: string;
  questions: { id: string; question: string; answer: string; riskFlag: boolean }[];
  riskLevel: "low" | "moderate" | "high";
}

interface SDOHResult {
  domains: SDOHDomain[];
  overallRisk: string;
  referrals: string[];
  assessedAt: string;
}

interface PreventiveItem {
  id: string;
  name: string;
  category: string;
  lastDate?: string;
  nextDue?: string;
  status: "current" | "overdue" | "due_soon" | "not_applicable";
  frequency: string;
  aiRecommended: boolean;
  notes?: string;
}

interface VaccineRecord {
  id: string;
  name: string;
  date: string;
  source: string;
  lot?: string;
  site?: string;
  manufacturer?: string;
  doseNumber?: number;
  series?: string;
}

interface VaccineRegistryStatus {
  connected: boolean;
  registryName: string;
  lastSync: string;
  patientMatch: boolean;
  records: VaccineRecord[];
  dueVaccines: { name: string; dueDate: string; priority: string }[];
}

interface PatientIntakeRecord {
  patientId: string;
  diagnoses: { code: string; display: string; year?: number; status: string }[];
  surgeries: { code: string; display: string; year?: number; notes?: string }[];
  medications: { rxcui: string; display: string; dosage?: string; frequency?: string; status: string }[];
  allergies: AllergyEntry[];
  socialHistory: SocialHistoryData;
  pegScore: PEGScore | null;
  phq9: PHQ9Result | null;
  sdoh: SDOHResult | null;
  preventiveHistory: PreventiveItem[];
  vaccines: VaccineRegistryStatus;
  updatedAt: string;
}

const TOP_50_DIAGNOSES: DiagnosisRef[] = [
  { code: "E11.9", display: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { code: "I10", display: "Essential (primary) hypertension", category: "Cardiovascular" },
  { code: "E78.5", display: "Hyperlipidemia, unspecified", category: "Endocrine" },
  { code: "J06.9", display: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { code: "M54.5", display: "Low back pain", category: "Musculoskeletal" },
  { code: "F41.1", display: "Generalized anxiety disorder", category: "Mental Health" },
  { code: "F32.9", display: "Major depressive disorder, single episode, unspecified", category: "Mental Health" },
  { code: "J45.909", display: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  { code: "K21.0", display: "Gastroesophageal reflux disease with esophagitis", category: "Gastrointestinal" },
  { code: "E66.01", display: "Morbid (severe) obesity due to excess calories", category: "Endocrine" },
  { code: "G47.33", display: "Obstructive sleep apnea (adult)", category: "Neurological" },
  { code: "M17.11", display: "Primary osteoarthritis, right knee", category: "Musculoskeletal" },
  { code: "I25.10", display: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "N39.0", display: "Urinary tract infection, site not specified", category: "Genitourinary" },
  { code: "J20.9", display: "Acute bronchitis, unspecified", category: "Respiratory" },
  { code: "E03.9", display: "Hypothyroidism, unspecified", category: "Endocrine" },
  { code: "G43.909", display: "Migraine, unspecified, not intractable", category: "Neurological" },
  { code: "I48.91", display: "Unspecified atrial fibrillation", category: "Cardiovascular" },
  { code: "I50.9", display: "Heart failure, unspecified", category: "Cardiovascular" },
  { code: "J44.1", display: "Chronic obstructive pulmonary disease with acute exacerbation", category: "Respiratory" },
  { code: "E11.65", display: "Type 2 diabetes mellitus with hyperglycemia", category: "Endocrine" },
  { code: "M79.3", display: "Panniculitis, unspecified", category: "Musculoskeletal" },
  { code: "L70.0", display: "Acne vulgaris", category: "Dermatological" },
  { code: "R10.9", display: "Unspecified abdominal pain", category: "Gastrointestinal" },
  { code: "M25.561", display: "Pain in right knee", category: "Musculoskeletal" },
  { code: "R51.9", display: "Headache, unspecified", category: "Neurological" },
  { code: "B34.9", display: "Viral infection, unspecified", category: "Infectious" },
  { code: "J02.9", display: "Acute pharyngitis, unspecified", category: "Respiratory" },
  { code: "H66.90", display: "Otitis media, unspecified, unspecified ear", category: "ENT" },
  { code: "K58.9", display: "Irritable bowel syndrome without diarrhea", category: "Gastrointestinal" },
  { code: "N40.0", display: "Benign prostatic hyperplasia without lower urinary tract symptoms", category: "Genitourinary" },
  { code: "M81.0", display: "Age-related osteoporosis without current pathological fracture", category: "Musculoskeletal" },
  { code: "G40.909", display: "Epilepsy, unspecified, not intractable", category: "Neurological" },
  { code: "C50.919", display: "Malignant neoplasm of unspecified site of unspecified female breast", category: "Oncology" },
  { code: "D64.9", display: "Anemia, unspecified", category: "Hematological" },
  { code: "I63.9", display: "Cerebral infarction, unspecified", category: "Neurological" },
  { code: "N18.3", display: "Chronic kidney disease, stage 3 (moderate)", category: "Genitourinary" },
  { code: "K80.20", display: "Calculus of gallbladder without cholecystitis without obstruction", category: "Gastrointestinal" },
  { code: "M16.11", display: "Primary osteoarthritis, right hip", category: "Musculoskeletal" },
  { code: "L40.0", display: "Psoriasis vulgaris", category: "Dermatological" },
  { code: "H52.13", display: "Myopia, bilateral", category: "Ophthalmology" },
  { code: "E55.9", display: "Vitamin D deficiency, unspecified", category: "Endocrine" },
  { code: "R73.03", display: "Prediabetes", category: "Endocrine" },
  { code: "F17.210", display: "Nicotine dependence, cigarettes, uncomplicated", category: "Mental Health" },
  { code: "G89.29", display: "Other chronic pain", category: "Neurological" },
  { code: "M47.812", display: "Spondylosis without myelopathy or radiculopathy, cervical region", category: "Musculoskeletal" },
  { code: "F10.20", display: "Alcohol dependence, uncomplicated", category: "Mental Health" },
  { code: "B00.9", display: "Herpesviral infection, unspecified", category: "Infectious" },
  { code: "H40.10", display: "Open-angle glaucoma, unspecified", category: "Ophthalmology" },
  { code: "R42", display: "Dizziness and giddiness", category: "Neurological" },
];

const TOP_10_SURGERIES: SurgeryRef[] = [
  { code: "47562", display: "Laparoscopic appendectomy", category: "General" },
  { code: "47563", display: "Laparoscopic cholecystectomy", category: "General" },
  { code: "27447", display: "Total knee arthroplasty (replacement)", category: "Orthopedic" },
  { code: "27130", display: "Total hip arthroplasty (replacement)", category: "Orthopedic" },
  { code: "33533", display: "Coronary artery bypass graft (CABG)", category: "Cardiac" },
  { code: "44970", display: "Laparoscopic appendectomy with abscess drainage", category: "General" },
  { code: "58661", display: "Laparoscopic hysterectomy", category: "Gynecologic" },
  { code: "66984", display: "Cataract surgery with IOL implant", category: "Ophthalmologic" },
  { code: "49505", display: "Inguinal hernia repair", category: "General" },
  { code: "63030", display: "Lumbar discectomy / laminectomy", category: "Neurological" },
];

const TOP_75_MEDICATIONS: MedicationRef[] = [
  { rxcui: "311995", display: "Lisinopril 10mg", category: "ACE Inhibitor" },
  { rxcui: "197361", display: "Amlodipine 5mg", category: "Calcium Channel Blocker" },
  { rxcui: "860975", display: "Metformin 500mg", category: "Antidiabetic" },
  { rxcui: "314076", display: "Atorvastatin 20mg", category: "Statin" },
  { rxcui: "197379", display: "Levothyroxine 50mcg", category: "Thyroid" },
  { rxcui: "259543", display: "Omeprazole 20mg", category: "Proton Pump Inhibitor" },
  { rxcui: "312961", display: "Metoprolol Succinate 25mg", category: "Beta Blocker" },
  { rxcui: "310798", display: "Losartan 50mg", category: "ARB" },
  { rxcui: "197381", display: "Sertraline 50mg", category: "SSRI" },
  { rxcui: "197380", display: "Escitalopram 10mg", category: "SSRI" },
  { rxcui: "314077", display: "Rosuvastatin 10mg", category: "Statin" },
  { rxcui: "198144", display: "Gabapentin 300mg", category: "Anticonvulsant" },
  { rxcui: "311367", display: "Hydrochlorothiazide 25mg", category: "Diuretic" },
  { rxcui: "197382", display: "Fluoxetine 20mg", category: "SSRI" },
  { rxcui: "312615", display: "Pantoprazole 40mg", category: "Proton Pump Inhibitor" },
  { rxcui: "310429", display: "Prednisone 10mg", category: "Corticosteroid" },
  { rxcui: "197383", display: "Amoxicillin 500mg", category: "Antibiotic" },
  { rxcui: "310430", display: "Azithromycin 250mg", category: "Antibiotic" },
  { rxcui: "197384", display: "Cephalexin 500mg", category: "Antibiotic" },
  { rxcui: "197385", display: "Ciprofloxacin 500mg", category: "Antibiotic" },
  { rxcui: "314079", display: "Meloxicam 15mg", category: "NSAID" },
  { rxcui: "197386", display: "Ibuprofen 600mg", category: "NSAID" },
  { rxcui: "197387", display: "Naproxen 500mg", category: "NSAID" },
  { rxcui: "312617", display: "Acetaminophen 500mg", category: "Analgesic" },
  { rxcui: "314080", display: "Tramadol 50mg", category: "Analgesic" },
  { rxcui: "860976", display: "Metformin 1000mg", category: "Antidiabetic" },
  { rxcui: "197388", display: "Glipizide 5mg", category: "Antidiabetic" },
  { rxcui: "197389", display: "Sitagliptin 100mg", category: "Antidiabetic" },
  { rxcui: "1373463", display: "Empagliflozin 10mg", category: "SGLT2 Inhibitor" },
  { rxcui: "1992427", display: "Semaglutide 0.5mg injection", category: "GLP-1 Agonist" },
  { rxcui: "314081", display: "Insulin Glargine 100u/mL", category: "Insulin" },
  { rxcui: "310431", display: "Warfarin 5mg", category: "Anticoagulant" },
  { rxcui: "1364430", display: "Apixaban 5mg", category: "Anticoagulant" },
  { rxcui: "1232585", display: "Rivaroxaban 20mg", category: "Anticoagulant" },
  { rxcui: "197390", display: "Clopidogrel 75mg", category: "Antiplatelet" },
  { rxcui: "197391", display: "Aspirin 81mg", category: "Antiplatelet" },
  { rxcui: "197392", display: "Albuterol 90mcg inhaler", category: "Bronchodilator" },
  { rxcui: "197393", display: "Fluticasone/Salmeterol 250/50 inhaler", category: "Inhaled Corticosteroid" },
  { rxcui: "197394", display: "Montelukast 10mg", category: "Leukotriene Modifier" },
  { rxcui: "197395", display: "Cetirizine 10mg", category: "Antihistamine" },
  { rxcui: "197396", display: "Loratadine 10mg", category: "Antihistamine" },
  { rxcui: "197397", display: "Diphenhydramine 25mg", category: "Antihistamine" },
  { rxcui: "197398", display: "Alprazolam 0.5mg", category: "Benzodiazepine" },
  { rxcui: "197399", display: "Lorazepam 1mg", category: "Benzodiazepine" },
  { rxcui: "197400", display: "Zolpidem 10mg", category: "Sleep Aid" },
  { rxcui: "197401", display: "Trazodone 50mg", category: "Antidepressant" },
  { rxcui: "197402", display: "Bupropion 150mg XL", category: "Antidepressant" },
  { rxcui: "197403", display: "Venlafaxine 75mg XR", category: "SNRI" },
  { rxcui: "197404", display: "Duloxetine 60mg", category: "SNRI" },
  { rxcui: "197405", display: "Quetiapine 25mg", category: "Antipsychotic" },
  { rxcui: "197406", display: "Aripiprazole 5mg", category: "Antipsychotic" },
  { rxcui: "197407", display: "Cyclobenzaprine 10mg", category: "Muscle Relaxant" },
  { rxcui: "197408", display: "Methocarbamol 750mg", category: "Muscle Relaxant" },
  { rxcui: "197409", display: "Tamsulosin 0.4mg", category: "Alpha Blocker" },
  { rxcui: "197410", display: "Finasteride 5mg", category: "5-Alpha Reductase Inhibitor" },
  { rxcui: "197411", display: "Sildenafil 50mg", category: "PDE5 Inhibitor" },
  { rxcui: "197412", display: "Estradiol 1mg", category: "Hormone" },
  { rxcui: "197413", display: "Progesterone 100mg", category: "Hormone" },
  { rxcui: "197414", display: "Methotrexate 2.5mg", category: "DMARD" },
  { rxcui: "197415", display: "Hydroxychloroquine 200mg", category: "DMARD" },
  { rxcui: "197416", display: "Pregabalin 75mg", category: "Anticonvulsant" },
  { rxcui: "197417", display: "Topiramate 25mg", category: "Anticonvulsant" },
  { rxcui: "197418", display: "Spironolactone 25mg", category: "Diuretic" },
  { rxcui: "197419", display: "Furosemide 40mg", category: "Diuretic" },
  { rxcui: "197420", display: "Potassium Chloride 20mEq", category: "Electrolyte" },
  { rxcui: "197421", display: "Calcium Carbonate 600mg + Vitamin D", category: "Supplement" },
  { rxcui: "197422", display: "Vitamin D3 2000 IU", category: "Supplement" },
  { rxcui: "197423", display: "Iron Sulfate 325mg", category: "Supplement" },
  { rxcui: "197424", display: "Folic Acid 1mg", category: "Supplement" },
  { rxcui: "197425", display: "Ondansetron 4mg", category: "Antiemetic" },
  { rxcui: "197426", display: "Promethazine 25mg", category: "Antiemetic" },
  { rxcui: "197427", display: "Sucralfate 1g", category: "GI Protectant" },
  { rxcui: "197428", display: "Famotidine 20mg", category: "H2 Blocker" },
  { rxcui: "197429", display: "Docusate Sodium 100mg", category: "Laxative" },
  { rxcui: "197430", display: "Polyethylene Glycol 3350 17g", category: "Laxative" },
];

const COMMON_ALLERGIES = {
  medication: [
    "Penicillin", "Amoxicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine",
    "Morphine", "Cephalosporins", "Fluoroquinolones", "ACE Inhibitors", "Statins",
    "Latex", "Contrast dye", "Tetracycline", "Erythromycin", "Metformin", "Lisinopril",
    "NSAIDs", "Opioids", "Anesthetics",
  ],
  food: [
    "Peanuts", "Tree nuts", "Milk/Dairy", "Eggs", "Wheat/Gluten", "Soy",
    "Fish", "Shellfish", "Sesame", "Corn", "Strawberries", "Citrus fruits",
    "Tomatoes", "Chocolate", "Artificial sweeteners",
  ],
  environmental: [
    "Pollen (grass)", "Pollen (tree)", "Pollen (ragweed)", "Dust mites", "Mold spores",
    "Pet dander (cat)", "Pet dander (dog)", "Cockroach", "Bee/wasp venom",
    "Latex", "Nickel", "Poison ivy/oak", "Perfume/fragrances", "Cigarette smoke", "Formaldehyde",
  ],
};

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

const PEG_QUESTIONS = [
  { id: "pain", label: "What number best describes your pain on average in the past week?", anchor0: "No pain", anchor10: "Pain as bad as you can imagine" },
  { id: "enjoyment", label: "What number best describes how, during the past week, pain has interfered with your enjoyment of life?", anchor0: "Does not interfere", anchor10: "Completely interferes" },
  { id: "generalActivity", label: "What number best describes how, during the past week, pain has interfered with your general activity?", anchor0: "Does not interfere", anchor10: "Completely interferes" },
];

const SDOH_DOMAINS = [
  {
    domain: "Economic Stability",
    questions: [
      { id: "es1", question: "In the past 12 months, was there a time when you were not able to pay your mortgage, rent, or utility bills?", options: ["Yes", "No", "Prefer not to answer"] },
      { id: "es2", question: "Are you worried about losing your housing?", options: ["Yes", "No", "Prefer not to answer"] },
      { id: "es3", question: "In the past 12 months, has lack of transportation kept you from medical appointments or getting medications?", options: ["Yes", "No", "Prefer not to answer"] },
      { id: "es4", question: "Within the past 12 months, did you or others in your household ever eat less than you felt you should because there wasn't enough money for food?", options: ["Yes", "No", "Prefer not to answer"] },
    ],
  },
  {
    domain: "Education Access & Quality",
    questions: [
      { id: "ea1", question: "What is the highest level of school you have completed or the highest degree you have received?", options: ["Less than high school", "High school diploma/GED", "Some college", "Bachelor's degree", "Graduate degree"] },
      { id: "ea2", question: "Do you have difficulty reading or understanding written health information?", options: ["Yes", "Sometimes", "No"] },
    ],
  },
  {
    domain: "Healthcare Access & Quality",
    questions: [
      { id: "ha1", question: "Do you have a primary care provider?", options: ["Yes", "No"] },
      { id: "ha2", question: "In the past 12 months, was there a time you needed to see a doctor but could not because of cost?", options: ["Yes", "No"] },
      { id: "ha3", question: "What is your current health insurance status?", options: ["Private insurance", "Medicare", "Medicaid", "Uninsured", "Other"] },
    ],
  },
  {
    domain: "Neighborhood & Built Environment",
    questions: [
      { id: "ne1", question: "Do you feel physically and emotionally safe where you currently live?", options: ["Yes", "No", "Unsure"] },
      { id: "ne2", question: "In the past 12 months, have you been hit, slapped, kicked, or otherwise physically hurt by someone?", options: ["Yes", "No", "Prefer not to answer"] },
      { id: "ne3", question: "Do you have access to healthy food options near where you live?", options: ["Yes", "No", "Limited"] },
    ],
  },
  {
    domain: "Social & Community Context",
    questions: [
      { id: "sc1", question: "How often do you feel lonely or isolated from those around you?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "sc2", question: "Do you have someone you can count on for emotional support?", options: ["Yes", "No"] },
      { id: "sc3", question: "How often do you feel stressed?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "sc4", question: "Have you experienced discrimination in healthcare settings?", options: ["Yes", "No", "Prefer not to answer"] },
    ],
  },
];

const PREVENTIVE_SCREENINGS = [
  { name: "Annual Physical Exam", category: "General", frequency: "Annually" },
  { name: "Blood Pressure Screening", category: "Cardiovascular", frequency: "Every visit" },
  { name: "Lipid Panel / Cholesterol", category: "Cardiovascular", frequency: "Every 5 years (or annually if at risk)" },
  { name: "Blood Glucose / A1C", category: "Diabetes", frequency: "Every 3 years (or annually if at risk)" },
  { name: "Colonoscopy", category: "Cancer", frequency: "Every 10 years starting at 45" },
  { name: "Mammogram", category: "Cancer", frequency: "Every 1-2 years starting at 40" },
  { name: "Cervical Cancer Screening (Pap/HPV)", category: "Cancer", frequency: "Every 3-5 years" },
  { name: "Prostate Cancer Screening (PSA)", category: "Cancer", frequency: "Discuss with provider at 50+" },
  { name: "Lung Cancer Screening (Low-dose CT)", category: "Cancer", frequency: "Annually for high-risk smokers 50-80" },
  { name: "Skin Cancer Screening", category: "Cancer", frequency: "Annually" },
  { name: "Bone Density (DEXA) Scan", category: "Musculoskeletal", frequency: "Every 2 years for women 65+" },
  { name: "Eye Exam", category: "Vision", frequency: "Every 1-2 years" },
  { name: "Hearing Test", category: "ENT", frequency: "Every 10 years until 50, then every 3 years" },
  { name: "Dental Exam & Cleaning", category: "Dental", frequency: "Every 6 months" },
  { name: "Depression Screening (PHQ-9)", category: "Mental Health", frequency: "Annually" },
  { name: "Alcohol Use Screening (AUDIT-C)", category: "Mental Health", frequency: "Annually" },
  { name: "HIV Screening", category: "Infectious Disease", frequency: "At least once, or as recommended" },
  { name: "Hepatitis C Screening", category: "Infectious Disease", frequency: "Once for adults born 1945-1965" },
  { name: "STI Screening", category: "Infectious Disease", frequency: "As recommended" },
  { name: "Abdominal Aortic Aneurysm Screening", category: "Cardiovascular", frequency: "Once for men 65-75 who have ever smoked" },
];

interface ComprehensiveIntakeRecord {
  id: string;
  patientId: string;
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    sex: string;
    gender?: string;
    race?: string;
    ethnicity?: string;
    preferredLanguage: string;
    phone?: string;
    email?: string;
    address?: { street?: string; city?: string; state?: string; zip?: string };
    emergencyContact?: { name?: string; relationship?: string; phone?: string };
  };
  medicalHistory: {
    conditions: { code: string; display: string; year?: number; status: string }[];
    surgeries: { code: string; display: string; year?: number; notes?: string }[];
    familyHistory: { condition: string; relationship: string; ageOfOnset?: number }[];
  };
  allergies: {
    allergies: { name: string; type: string; severity: string; reaction: string; status: string }[];
  };
  medications: {
    medications: { name: string; dosage?: string; frequency?: string; prescribedFor?: string; status: string }[];
  };
  socialHistory: {
    tobacco: { status: string; type?: string; amount?: string; yearsUsed?: number; quitDate?: string };
    alcohol: { status: string; frequency?: string };
    exercise: { frequency: string; type?: string; duration?: string };
    occupation?: string;
    maritalStatus?: string;
    livingSituation?: string;
  };
  insurance: {
    hasInsurance: boolean;
    primary?: { provider?: string; planName?: string; memberId?: string; groupNumber?: string; subscriberName?: string; relationship?: string };
    secondary?: { provider?: string; planName?: string; memberId?: string; groupNumber?: string };
    pharmacy?: { name?: string; phone?: string; address?: string };
  };
  status: "draft" | "submitted" | "reviewed";
  submittedAt?: string;
  cdsResults?: any;
}

class IntakeHistoryService {
  private patientRecords: Map<string, PatientIntakeRecord> = new Map();
  private comprehensiveIntakes: Map<string, ComprehensiveIntakeRecord> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleRecord: PatientIntakeRecord = {
      patientId: "patient-001",
      diagnoses: [
        { code: "I10", display: "Essential (primary) hypertension", year: 2019, status: "active" },
        { code: "E78.5", display: "Hyperlipidemia, unspecified", year: 2020, status: "active" },
        { code: "E11.9", display: "Type 2 diabetes mellitus without complications", year: 2021, status: "active" },
        { code: "M54.5", display: "Low back pain", year: 2022, status: "active" },
        { code: "E03.9", display: "Hypothyroidism, unspecified", year: 2018, status: "active" },
        { code: "G47.33", display: "Obstructive sleep apnea (adult)", year: 2020, status: "active" },
        { code: "E55.9", display: "Vitamin D deficiency, unspecified", year: 2023, status: "active" },
      ],
      surgeries: [
        { code: "47563", display: "Laparoscopic cholecystectomy", year: 2017, notes: "Uncomplicated" },
        { code: "66984", display: "Cataract surgery with IOL implant", year: 2023, notes: "Right eye" },
      ],
      medications: [
        { rxcui: "311995", display: "Lisinopril 10mg", dosage: "10mg", frequency: "Once daily", status: "active" },
        { rxcui: "314076", display: "Atorvastatin 20mg", dosage: "20mg", frequency: "Once daily at bedtime", status: "active" },
        { rxcui: "860975", display: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", status: "active" },
        { rxcui: "197379", display: "Levothyroxine 50mcg", dosage: "50mcg", frequency: "Once daily AM", status: "active" },
        { rxcui: "259543", display: "Omeprazole 20mg", dosage: "20mg", frequency: "Once daily", status: "active" },
        { rxcui: "197422", display: "Vitamin D3 2000 IU", dosage: "2000 IU", frequency: "Once daily", status: "active" },
        { rxcui: "197391", display: "Aspirin 81mg", dosage: "81mg", frequency: "Once daily", status: "active" },
      ],
      allergies: [
        { id: "allg-1", name: "Penicillin", type: "medication", severity: "moderate", reaction: "Rash, hives", status: "active" },
        { id: "allg-2", name: "Sulfa drugs", type: "medication", severity: "severe", reaction: "Anaphylaxis", onsetDate: "2015-03-10", status: "active" },
        { id: "allg-3", name: "Shellfish", type: "food", severity: "moderate", reaction: "Swelling, itching", status: "active" },
        { id: "allg-4", name: "Peanuts", type: "food", severity: "severe", reaction: "Throat swelling, difficulty breathing", status: "active" },
        { id: "allg-5", name: "Dust mites", type: "environmental", severity: "mild", reaction: "Sneezing, watery eyes", status: "active" },
        { id: "allg-6", name: "Pollen (ragweed)", type: "environmental", severity: "moderate", reaction: "Congestion, sneezing, itchy eyes", status: "active" },
        { id: "allg-7", name: "Contrast dye", type: "medication", severity: "moderate", reaction: "Hives, nausea", onsetDate: "2020-07-15", status: "active" },
      ],
      socialHistory: {
        tobacco: { status: "former", type: "Cigarettes", amount: "1 pack/day", yearsUsed: 15, quitDate: "2019-06-01" },
        alcohol: { status: "social", frequency: "1-2 drinks/week", type: "Wine", amount: "1-2 glasses" },
        drugs: { status: "never", substances: [] },
        exercise: { frequency: "3 days/week", type: "Walking, light weights", duration: "30 minutes" },
        diet: { type: "Low sodium, diabetic-friendly", restrictions: ["Low sodium", "Low sugar"] },
        occupation: { current: "Retired accountant", exposures: ["Office/sedentary work"] },
        maritalStatus: "Married",
        livingSituation: "Lives with spouse",
        education: "Bachelor's degree",
        sexualHistory: { active: false },
      },
      pegScore: {
        pain: 4,
        enjoyment: 3,
        generalActivity: 3,
        totalScore: 3.3,
        interpretation: "Moderate pain impact",
        assessedAt: "2025-01-15T10:00:00Z",
      },
      phq9: {
        responses: [
          { questionIndex: 0, score: 1 },
          { questionIndex: 1, score: 1 },
          { questionIndex: 2, score: 2 },
          { questionIndex: 3, score: 2 },
          { questionIndex: 4, score: 1 },
          { questionIndex: 5, score: 0 },
          { questionIndex: 6, score: 1 },
          { questionIndex: 7, score: 0 },
          { questionIndex: 8, score: 0 },
        ],
        totalScore: 8,
        severity: "Mild depression",
        recommendation: "Monitor and consider follow-up. Lifestyle modifications, therapy referral if symptoms persist.",
        assessedAt: "2025-01-15T10:30:00Z",
      },
      sdoh: {
        domains: [
          { domain: "Economic Stability", questions: [
            { id: "es1", question: "Unable to pay bills?", answer: "No", riskFlag: false },
            { id: "es2", question: "Worried about housing?", answer: "No", riskFlag: false },
            { id: "es3", question: "Lack of transportation?", answer: "No", riskFlag: false },
            { id: "es4", question: "Not enough food?", answer: "No", riskFlag: false },
          ], riskLevel: "low" },
          { domain: "Education Access & Quality", questions: [
            { id: "ea1", question: "Education level?", answer: "Bachelor's degree", riskFlag: false },
            { id: "ea2", question: "Difficulty reading health info?", answer: "No", riskFlag: false },
          ], riskLevel: "low" },
          { domain: "Healthcare Access & Quality", questions: [
            { id: "ha1", question: "Have primary care provider?", answer: "Yes", riskFlag: false },
            { id: "ha2", question: "Couldn't see doctor due to cost?", answer: "No", riskFlag: false },
            { id: "ha3", question: "Insurance status?", answer: "Private insurance", riskFlag: false },
          ], riskLevel: "low" },
          { domain: "Neighborhood & Built Environment", questions: [
            { id: "ne1", question: "Feel safe where you live?", answer: "Yes", riskFlag: false },
            { id: "ne2", question: "Physically hurt by someone?", answer: "No", riskFlag: false },
            { id: "ne3", question: "Access to healthy food?", answer: "Yes", riskFlag: false },
          ], riskLevel: "low" },
          { domain: "Social & Community Context", questions: [
            { id: "sc1", question: "Feel lonely?", answer: "Rarely", riskFlag: false },
            { id: "sc2", question: "Emotional support?", answer: "Yes", riskFlag: false },
            { id: "sc3", question: "Feel stressed?", answer: "Sometimes", riskFlag: false },
            { id: "sc4", question: "Experienced discrimination?", answer: "No", riskFlag: false },
          ], riskLevel: "low" },
        ],
        overallRisk: "Low",
        referrals: [],
        assessedAt: "2025-01-15T11:00:00Z",
      },
      preventiveHistory: [
        { id: "prev-1", name: "Annual Physical Exam", category: "General", lastDate: "2025-01-10", nextDue: "2026-01-10", status: "current", frequency: "Annually", aiRecommended: false },
        { id: "prev-2", name: "Blood Pressure Screening", category: "Cardiovascular", lastDate: "2025-01-10", nextDue: "2025-04-10", status: "current", frequency: "Every visit", aiRecommended: false },
        { id: "prev-3", name: "Lipid Panel / Cholesterol", category: "Cardiovascular", lastDate: "2024-11-15", nextDue: "2025-11-15", status: "current", frequency: "Annually (at risk)", aiRecommended: false },
        { id: "prev-4", name: "Blood Glucose / A1C", category: "Diabetes", lastDate: "2024-12-20", nextDue: "2025-03-20", status: "due_soon", frequency: "Every 3 months (diabetic)", aiRecommended: true, notes: "AI: Due for A1C check based on last result of 7.2%" },
        { id: "prev-5", name: "Colonoscopy", category: "Cancer", lastDate: "2020-05-15", nextDue: "2030-05-15", status: "current", frequency: "Every 10 years", aiRecommended: false },
        { id: "prev-6", name: "Eye Exam", category: "Vision", lastDate: "2024-06-10", nextDue: "2025-06-10", status: "current", frequency: "Annually (diabetic)", aiRecommended: true, notes: "AI: Annual diabetic retinopathy screening recommended" },
        { id: "prev-7", name: "Lung Cancer Screening (Low-dose CT)", category: "Cancer", status: "overdue", frequency: "Annually (former heavy smoker)", lastDate: "2023-08-20", nextDue: "2024-08-20", aiRecommended: true, notes: "AI: Overdue - 15 pack-year smoking history qualifies for screening" },
        { id: "prev-8", name: "Dental Exam & Cleaning", category: "Dental", lastDate: "2024-09-15", nextDue: "2025-03-15", status: "due_soon", frequency: "Every 6 months", aiRecommended: false },
        { id: "prev-9", name: "Depression Screening (PHQ-9)", category: "Mental Health", lastDate: "2025-01-15", nextDue: "2026-01-15", status: "current", frequency: "Annually", aiRecommended: false },
        { id: "prev-10", name: "Bone Density (DEXA) Scan", category: "Musculoskeletal", status: "not_applicable", frequency: "For women 65+", aiRecommended: false },
      ],
      vaccines: {
        connected: true,
        registryName: "State Immunization Information System (IIS)",
        lastSync: "2025-01-20T08:00:00Z",
        patientMatch: true,
        records: [
          { id: "vax-1", name: "Influenza (Flu)", date: "2024-10-15", source: "State Registry", manufacturer: "Sanofi Pasteur", lot: "FL2024-001", site: "Left deltoid", doseNumber: 1, series: "Annual" },
          { id: "vax-2", name: "COVID-19 (Updated 2024-2025)", date: "2024-09-20", source: "State Registry", manufacturer: "Pfizer-BioNTech", lot: "CV2024-501", site: "Right deltoid", doseNumber: 6, series: "Updated" },
          { id: "vax-3", name: "Pneumococcal (PCV20)", date: "2024-03-10", source: "State Registry", manufacturer: "Pfizer", lot: "PN2024-101", site: "Left deltoid", doseNumber: 1 },
          { id: "vax-4", name: "Tdap (Tetanus, Diphtheria, Pertussis)", date: "2022-06-15", source: "State Registry", manufacturer: "GlaxoSmithKline", lot: "TD2022-301", site: "Right deltoid", doseNumber: 1, series: "Every 10 years" },
          { id: "vax-5", name: "Shingles (Shingrix) - Dose 1", date: "2023-01-20", source: "State Registry", manufacturer: "GlaxoSmithKline", lot: "SH2023-101", site: "Left deltoid", doseNumber: 1, series: "2-dose series" },
          { id: "vax-6", name: "Shingles (Shingrix) - Dose 2", date: "2023-03-25", source: "State Registry", manufacturer: "GlaxoSmithKline", lot: "SH2023-201", site: "Left deltoid", doseNumber: 2, series: "2-dose series" },
          { id: "vax-7", name: "Hepatitis B - Dose 1", date: "1990-02-10", source: "Historical", doseNumber: 1, series: "3-dose series" },
          { id: "vax-8", name: "Hepatitis B - Dose 2", date: "1990-03-10", source: "Historical", doseNumber: 2, series: "3-dose series" },
          { id: "vax-9", name: "Hepatitis B - Dose 3", date: "1990-08-10", source: "Historical", doseNumber: 3, series: "3-dose series" },
          { id: "vax-10", name: "MMR (Measles, Mumps, Rubella)", date: "1989-04-15", source: "Historical", doseNumber: 2, series: "2-dose series" },
        ],
        dueVaccines: [
          { name: "Influenza (Flu) 2025-2026", dueDate: "2025-10-01", priority: "recommended" },
          { name: "COVID-19 Updated 2025", dueDate: "2025-09-01", priority: "recommended" },
          { name: "RSV Vaccine", dueDate: "2025-09-01", priority: "discuss_with_provider" },
        ],
      },
      updatedAt: new Date().toISOString(),
    };
    this.patientRecords.set("patient-001", sampleRecord);
  }

  getReferenceData() {
    return {
      diagnoses: TOP_50_DIAGNOSES,
      surgeries: TOP_10_SURGERIES,
      medications: TOP_75_MEDICATIONS,
      allergens: COMMON_ALLERGIES,
      phq9Questions: PHQ9_QUESTIONS,
      pegQuestions: PEG_QUESTIONS,
      sdohDomains: SDOH_DOMAINS,
      preventiveScreenings: PREVENTIVE_SCREENINGS,
    };
  }

  getPatientIntake(patientId: string): PatientIntakeRecord | null {
    return this.patientRecords.get(patientId) || null;
  }

  savePatientIntake(patientId: string, data: Partial<PatientIntakeRecord>): PatientIntakeRecord {
    const existing = this.patientRecords.get(patientId) || {
      patientId,
      diagnoses: [],
      surgeries: [],
      medications: [],
      allergies: [],
      socialHistory: {
        tobacco: { status: "never" },
        alcohol: { status: "never" },
        drugs: { status: "never" },
        exercise: { frequency: "none" },
        diet: { type: "Regular" },
        occupation: { current: "" },
        maritalStatus: "",
        livingSituation: "",
        education: "",
        sexualHistory: { active: false },
      },
      pegScore: null,
      phq9: null,
      sdoh: null,
      preventiveHistory: [],
      vaccines: { connected: false, registryName: "", lastSync: "", patientMatch: false, records: [], dueVaccines: [] },
      updatedAt: new Date().toISOString(),
    };

    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.patientRecords.set(patientId, updated);
    return updated;
  }

  scorePHQ9(responses: PHQ9Response[]): { totalScore: number; severity: string; recommendation: string } {
    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    let severity: string;
    let recommendation: string;

    if (totalScore <= 4) {
      severity = "Minimal depression";
      recommendation = "No treatment indicated. Monitor periodically.";
    } else if (totalScore <= 9) {
      severity = "Mild depression";
      recommendation = "Watchful waiting. Repeat PHQ-9 at follow-up. Consider counseling.";
    } else if (totalScore <= 14) {
      severity = "Moderate depression";
      recommendation = "Consider treatment plan: counseling, therapy, or medication. Follow up in 2-4 weeks.";
    } else if (totalScore <= 19) {
      severity = "Moderately severe depression";
      recommendation = "Active treatment with pharmacotherapy and/or psychotherapy. Close follow-up.";
    } else {
      severity = "Severe depression";
      recommendation = "Immediate treatment. Consider referral to mental health specialist. Assess safety risk.";
    }

    return { totalScore, severity, recommendation };
  }

  scorePEG(pain: number, enjoyment: number, generalActivity: number): PEGScore {
    const totalScore = Math.round(((pain + enjoyment + generalActivity) / 3) * 10) / 10;
    let interpretation: string;

    if (totalScore <= 3) interpretation = "Low pain impact";
    else if (totalScore <= 5) interpretation = "Moderate pain impact";
    else if (totalScore <= 7) interpretation = "High pain impact";
    else interpretation = "Severe pain impact - consider pain management referral";

    return { pain, enjoyment, generalActivity, totalScore, interpretation, assessedAt: new Date().toISOString() };
  }

  scoreSDOH(domains: SDOHDomain[]): SDOHResult {
    const riskDomains = domains.filter(d => d.riskLevel === "high" || d.riskLevel === "moderate");
    let overallRisk: string;
    const referrals: string[] = [];

    if (riskDomains.length === 0) overallRisk = "Low";
    else if (riskDomains.some(d => d.riskLevel === "high")) {
      overallRisk = "High";
      riskDomains.forEach(d => {
        if (d.domain === "Economic Stability") referrals.push("Financial counseling", "Community resources");
        if (d.domain === "Healthcare Access & Quality") referrals.push("Insurance enrollment assistance", "Community health center");
        if (d.domain === "Neighborhood & Built Environment") referrals.push("Safety resources", "Social worker");
        if (d.domain === "Social & Community Context") referrals.push("Mental health support", "Community groups");
      });
    } else overallRisk = "Moderate";

    const uniqueReferrals = Array.from(new Set(referrals));
    return { domains, overallRisk, referrals: uniqueReferrals, assessedAt: new Date().toISOString() };
  }

  getPreventiveRecommendations(patientId: string): PreventiveItem[] {
    const record = this.patientRecords.get(patientId);
    if (!record) return [];

    const recommendations: PreventiveItem[] = [];
    const hasDiabetes = record.diagnoses.some(d => d.code.startsWith("E11"));
    const hasHypertension = record.diagnoses.some(d => d.code === "I10");
    const formerSmoker = record.socialHistory.tobacco.status === "former" || record.socialHistory.tobacco.status === "current";

    if (hasDiabetes) {
      recommendations.push({
        id: "ai-rec-1", name: "Diabetic Foot Exam", category: "Diabetes", status: "due_soon",
        frequency: "Annually", aiRecommended: true, notes: "AI: Recommended based on Type 2 diabetes diagnosis. Early detection of neuropathy.",
      });
      recommendations.push({
        id: "ai-rec-2", name: "Kidney Function Test (eGFR)", category: "Diabetes", status: "due_soon",
        frequency: "Annually", aiRecommended: true, notes: "AI: Diabetic nephropathy screening recommended annually.",
      });
    }

    if (hasHypertension) {
      recommendations.push({
        id: "ai-rec-3", name: "Echocardiogram", category: "Cardiovascular", status: "due_soon",
        frequency: "As recommended", aiRecommended: true, notes: "AI: Consider baseline echocardiogram for long-standing hypertension.",
      });
    }

    if (formerSmoker && (record.socialHistory.tobacco.yearsUsed || 0) >= 10) {
      recommendations.push({
        id: "ai-rec-4", name: "Lung Cancer Screening (Low-dose CT)", category: "Cancer", status: "overdue",
        frequency: "Annually", aiRecommended: true, notes: "AI: Significant smoking history qualifies for annual low-dose CT screening.",
      });
    }

    return recommendations;
  }

  getVaccineRegistry(patientId: string): VaccineRegistryStatus {
    const record = this.patientRecords.get(patientId);
    return record?.vaccines || { connected: false, registryName: "Not connected", lastSync: "", patientMatch: false, records: [], dueVaccines: [] };
  }

  saveComprehensiveIntake(patientId: string, data: Omit<ComprehensiveIntakeRecord, "id" | "status" | "submittedAt" | "cdsResults">): ComprehensiveIntakeRecord {
    const id = `intake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: ComprehensiveIntakeRecord = {
      ...data,
      id,
      patientId,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
    this.comprehensiveIntakes.set(id, record);

    this.syncToPatientRecord(patientId, record);
    return record;
  }

  getComprehensiveIntake(intakeId: string): ComprehensiveIntakeRecord | null {
    return this.comprehensiveIntakes.get(intakeId) || null;
  }

  getComprehensiveIntakesByPatient(patientId: string): ComprehensiveIntakeRecord[] {
    return Array.from(this.comprehensiveIntakes.values()).filter(r => r.patientId === patientId);
  }

  updateIntakeCdsResults(intakeId: string, cdsResults: any): ComprehensiveIntakeRecord | null {
    const record = this.comprehensiveIntakes.get(intakeId);
    if (!record) return null;
    record.cdsResults = cdsResults;
    record.status = "reviewed";
    this.comprehensiveIntakes.set(intakeId, record);
    return record;
  }

  private syncToPatientRecord(patientId: string, intake: ComprehensiveIntakeRecord): void {
    const existing = this.patientRecords.get(patientId);
    const updated: PatientIntakeRecord = {
      patientId,
      diagnoses: intake.medicalHistory.conditions.map(c => ({
        code: c.code,
        display: c.display,
        year: c.year,
        status: c.status || "active",
      })),
      surgeries: intake.medicalHistory.surgeries.map(s => ({
        code: s.code,
        display: s.display,
        year: s.year,
        notes: s.notes,
      })),
      medications: intake.medications.medications.map(m => ({
        rxcui: "",
        display: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        status: m.status || "active",
      })),
      allergies: intake.allergies.allergies.map((a, i) => ({
        id: `allg-intake-${i}`,
        name: a.name,
        type: a.type as "medication" | "food" | "environmental",
        severity: a.severity as "mild" | "moderate" | "severe" | "life-threatening",
        reaction: a.reaction,
        status: a.status as "active" | "inactive" | "resolved",
      })),
      socialHistory: {
        tobacco: { status: intake.socialHistory.tobacco.status, type: intake.socialHistory.tobacco.type, amount: intake.socialHistory.tobacco.amount, yearsUsed: intake.socialHistory.tobacco.yearsUsed, quitDate: intake.socialHistory.tobacco.quitDate },
        alcohol: { status: intake.socialHistory.alcohol.status, frequency: intake.socialHistory.alcohol.frequency },
        drugs: existing?.socialHistory?.drugs || { status: "never" },
        exercise: { frequency: intake.socialHistory.exercise.frequency, type: intake.socialHistory.exercise.type, duration: intake.socialHistory.exercise.duration },
        diet: existing?.socialHistory?.diet || { type: "Regular" },
        occupation: { current: intake.socialHistory.occupation || "" },
        maritalStatus: intake.socialHistory.maritalStatus || "",
        livingSituation: intake.socialHistory.livingSituation || "",
        education: existing?.socialHistory?.education || "",
        sexualHistory: existing?.socialHistory?.sexualHistory || { active: false },
      },
      pegScore: existing?.pegScore || null,
      phq9: existing?.phq9 || null,
      sdoh: existing?.sdoh || null,
      preventiveHistory: existing?.preventiveHistory || [],
      vaccines: existing?.vaccines || { connected: false, registryName: "", lastSync: "", patientMatch: false, records: [], dueVaccines: [] },
      updatedAt: new Date().toISOString(),
    };
    this.patientRecords.set(patientId, updated);
  }

  buildCdsRequestFromIntake(intake: ComprehensiveIntakeRecord) {
    const dob = new Date(intake.demographics.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    return {
      patientId: intake.patientId,
      demographics: { age, sex: intake.demographics.sex },
      conditions: intake.medicalHistory.conditions.map(c => ({ name: c.display, status: c.status })),
      medications: intake.medications.medications.map((m, i) => ({
        id: `med-${i}`,
        name: m.name,
        dosage: m.dosage || "",
      })),
      allergies: intake.allergies.allergies.map(a => a.name),
      symptoms: [],
    };
  }
}

export const intakeHistoryService = new IntakeHistoryService();
