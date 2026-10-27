import { chatComplete } from "./ai-client";

export const TOP_50_DIAGNOSES = [
  { code: "I10", name: "Essential Hypertension", category: "Cardiovascular" },
  { code: "E11", name: "Type 2 Diabetes Mellitus", category: "Endocrine" },
  { code: "J06.9", name: "Upper Respiratory Infection", category: "Respiratory" },
  { code: "M54.5", name: "Low Back Pain", category: "Musculoskeletal" },
  { code: "E78.5", name: "Hyperlipidemia", category: "Endocrine" },
  { code: "F41.1", name: "Generalized Anxiety Disorder", category: "Mental Health" },
  { code: "F32.9", name: "Major Depressive Disorder", category: "Mental Health" },
  { code: "J45", name: "Asthma", category: "Respiratory" },
  { code: "K21.0", name: "Gastroesophageal Reflux Disease (GERD)", category: "Gastrointestinal" },
  { code: "E03.9", name: "Hypothyroidism", category: "Endocrine" },
  { code: "M17.9", name: "Osteoarthritis of Knee", category: "Musculoskeletal" },
  { code: "G43.9", name: "Migraine", category: "Neurological" },
  { code: "N39.0", name: "Urinary Tract Infection", category: "Genitourinary" },
  { code: "J20.9", name: "Acute Bronchitis", category: "Respiratory" },
  { code: "I25.10", name: "Coronary Artery Disease", category: "Cardiovascular" },
  { code: "E66.01", name: "Obesity (BMI 30+)", category: "Endocrine" },
  { code: "G47.33", name: "Obstructive Sleep Apnea", category: "Neurological" },
  { code: "M79.3", name: "Fibromyalgia", category: "Musculoskeletal" },
  { code: "L40", name: "Psoriasis", category: "Dermatological" },
  { code: "K58", name: "Irritable Bowel Syndrome", category: "Gastrointestinal" },
  { code: "N18.3", name: "Chronic Kidney Disease Stage 3", category: "Genitourinary" },
  { code: "I48", name: "Atrial Fibrillation", category: "Cardiovascular" },
  { code: "I50.9", name: "Heart Failure", category: "Cardiovascular" },
  { code: "J44.1", name: "COPD with Exacerbation", category: "Respiratory" },
  { code: "C50", name: "Breast Cancer", category: "Oncology" },
  { code: "C61", name: "Prostate Cancer", category: "Oncology" },
  { code: "M81.0", name: "Osteoporosis", category: "Musculoskeletal" },
  { code: "G20", name: "Parkinson Disease", category: "Neurological" },
  { code: "G30", name: "Alzheimer Disease", category: "Neurological" },
  { code: "E10", name: "Type 1 Diabetes Mellitus", category: "Endocrine" },
  { code: "M06.9", name: "Rheumatoid Arthritis", category: "Musculoskeletal" },
  { code: "K50", name: "Crohn Disease", category: "Gastrointestinal" },
  { code: "K51", name: "Ulcerative Colitis", category: "Gastrointestinal" },
  { code: "L20", name: "Atopic Dermatitis / Eczema", category: "Dermatological" },
  { code: "B18.2", name: "Chronic Hepatitis C", category: "Infectious" },
  { code: "D64.9", name: "Anemia", category: "Hematological" },
  { code: "E55.9", name: "Vitamin D Deficiency", category: "Endocrine" },
  { code: "I63.9", name: "Cerebrovascular Accident (Stroke)", category: "Neurological" },
  { code: "G40.9", name: "Epilepsy", category: "Neurological" },
  { code: "M10.9", name: "Gout", category: "Musculoskeletal" },
  { code: "J30.1", name: "Allergic Rhinitis", category: "Respiratory" },
  { code: "H40", name: "Glaucoma", category: "Ophthalmological" },
  { code: "H26.9", name: "Cataracts", category: "Ophthalmological" },
  { code: "N40.0", name: "Benign Prostatic Hyperplasia", category: "Genitourinary" },
  { code: "K80", name: "Cholelithiasis (Gallstones)", category: "Gastrointestinal" },
  { code: "E04.1", name: "Thyroid Nodule", category: "Endocrine" },
  { code: "I73.9", name: "Peripheral Vascular Disease", category: "Cardiovascular" },
  { code: "M47.8", name: "Cervical Spondylosis", category: "Musculoskeletal" },
  { code: "F90.0", name: "ADHD", category: "Mental Health" },
  { code: "F43.10", name: "Post-Traumatic Stress Disorder", category: "Mental Health" },
];

export const TOP_10_SURGERIES = [
  { code: "47.09", name: "Appendectomy", category: "General" },
  { code: "51.22", name: "Cholecystectomy (Gallbladder Removal)", category: "General" },
  { code: "68.4", name: "Hysterectomy", category: "Gynecological" },
  { code: "81.54", name: "Total Knee Replacement", category: "Orthopedic" },
  { code: "81.51", name: "Total Hip Replacement", category: "Orthopedic" },
  { code: "36.1", name: "Coronary Artery Bypass Graft (CABG)", category: "Cardiac" },
  { code: "74.1", name: "Cesarean Section", category: "Obstetric" },
  { code: "45.73", name: "Colectomy", category: "General" },
  { code: "80.6", name: "Arthroscopic Knee Surgery", category: "Orthopedic" },
  { code: "03.09", name: "Laminectomy / Spinal Decompression", category: "Neurological" },
];

export const TOP_75_MEDICATIONS = [
  { name: "Lisinopril", rxNorm: "29046", class: "ACE Inhibitor", category: "Cardiovascular" },
  { name: "Atorvastatin (Lipitor)", rxNorm: "83367", class: "Statin", category: "Cardiovascular" },
  { name: "Metformin (Glucophage)", rxNorm: "6809", class: "Biguanide", category: "Diabetes" },
  { name: "Amlodipine (Norvasc)", rxNorm: "17767", class: "Calcium Channel Blocker", category: "Cardiovascular" },
  { name: "Metoprolol (Lopressor)", rxNorm: "6918", class: "Beta-Blocker", category: "Cardiovascular" },
  { name: "Omeprazole (Prilosec)", rxNorm: "7646", class: "PPI", category: "Gastrointestinal" },
  { name: "Losartan (Cozaar)", rxNorm: "52175", class: "ARB", category: "Cardiovascular" },
  { name: "Albuterol (ProAir)", rxNorm: "435", class: "Bronchodilator", category: "Respiratory" },
  { name: "Gabapentin (Neurontin)", rxNorm: "25480", class: "Anticonvulsant", category: "Neurological" },
  { name: "Hydrochlorothiazide", rxNorm: "5487", class: "Diuretic", category: "Cardiovascular" },
  { name: "Sertraline (Zoloft)", rxNorm: "36567", class: "SSRI", category: "Mental Health" },
  { name: "Levothyroxine (Synthroid)", rxNorm: "10582", class: "Thyroid Hormone", category: "Endocrine" },
  { name: "Montelukast (Singulair)", rxNorm: "88249", class: "Leukotriene Inhibitor", category: "Respiratory" },
  { name: "Escitalopram (Lexapro)", rxNorm: "321988", class: "SSRI", category: "Mental Health" },
  { name: "Pantoprazole (Protonix)", rxNorm: "40790", class: "PPI", category: "Gastrointestinal" },
  { name: "Acetaminophen (Tylenol)", rxNorm: "161", class: "Analgesic", category: "Pain" },
  { name: "Ibuprofen (Advil)", rxNorm: "5640", class: "NSAID", category: "Pain" },
  { name: "Prednisone", rxNorm: "8640", class: "Corticosteroid", category: "Anti-inflammatory" },
  { name: "Fluticasone (Flonase)", rxNorm: "41126", class: "Nasal Corticosteroid", category: "Respiratory" },
  { name: "Tamsulosin (Flomax)", rxNorm: "77492", class: "Alpha Blocker", category: "Genitourinary" },
  { name: "Duloxetine (Cymbalta)", rxNorm: "72625", class: "SNRI", category: "Mental Health" },
  { name: "Rosuvastatin (Crestor)", rxNorm: "301542", class: "Statin", category: "Cardiovascular" },
  { name: "Furosemide (Lasix)", rxNorm: "4603", class: "Loop Diuretic", category: "Cardiovascular" },
  { name: "Amoxicillin", rxNorm: "723", class: "Antibiotic", category: "Infectious" },
  { name: "Azithromycin (Z-Pack)", rxNorm: "18631", class: "Antibiotic", category: "Infectious" },
  { name: "Cephalexin (Keflex)", rxNorm: "2231", class: "Antibiotic", category: "Infectious" },
  { name: "Ciprofloxacin (Cipro)", rxNorm: "2551", class: "Antibiotic", category: "Infectious" },
  { name: "Doxycycline", rxNorm: "3640", class: "Antibiotic", category: "Infectious" },
  { name: "Trazodone (Desyrel)", rxNorm: "10737", class: "Antidepressant", category: "Mental Health" },
  { name: "Alprazolam (Xanax)", rxNorm: "596", class: "Benzodiazepine", category: "Mental Health" },
  { name: "Zolpidem (Ambien)", rxNorm: "39993", class: "Sedative", category: "Sleep" },
  { name: "Cyclobenzaprine (Flexeril)", rxNorm: "3112", class: "Muscle Relaxant", category: "Musculoskeletal" },
  { name: "Meloxicam (Mobic)", rxNorm: "41493", class: "NSAID", category: "Pain" },
  { name: "Tramadol (Ultram)", rxNorm: "10689", class: "Opioid Analgesic", category: "Pain" },
  { name: "Clopidogrel (Plavix)", rxNorm: "32968", class: "Antiplatelet", category: "Cardiovascular" },
  { name: "Warfarin (Coumadin)", rxNorm: "11289", class: "Anticoagulant", category: "Cardiovascular" },
  { name: "Apixaban (Eliquis)", rxNorm: "1364430", class: "Anticoagulant", category: "Cardiovascular" },
  { name: "Insulin Glargine (Lantus)", rxNorm: "274783", class: "Insulin", category: "Diabetes" },
  { name: "Sitagliptin (Januvia)", rxNorm: "593411", class: "DPP-4 Inhibitor", category: "Diabetes" },
  { name: "Empagliflozin (Jardiance)", rxNorm: "1545653", class: "SGLT2 Inhibitor", category: "Diabetes" },
  { name: "Liraglutide (Victoza)", rxNorm: "475968", class: "GLP-1 Agonist", category: "Diabetes" },
  { name: "Semaglutide (Ozempic)", rxNorm: "1991302", class: "GLP-1 Agonist", category: "Diabetes" },
  { name: "Bupropion (Wellbutrin)", rxNorm: "42347", class: "Antidepressant", category: "Mental Health" },
  { name: "Venlafaxine (Effexor)", rxNorm: "39786", class: "SNRI", category: "Mental Health" },
  { name: "Quetiapine (Seroquel)", rxNorm: "51272", class: "Antipsychotic", category: "Mental Health" },
  { name: "Aripiprazole (Abilify)", rxNorm: "89013", class: "Antipsychotic", category: "Mental Health" },
  { name: "Methylphenidate (Ritalin)", rxNorm: "6901", class: "Stimulant", category: "Mental Health" },
  { name: "Amphetamine/Dextroamphetamine (Adderall)", rxNorm: "884520", class: "Stimulant", category: "Mental Health" },
  { name: "Sumatriptan (Imitrex)", rxNorm: "37418", class: "Triptan", category: "Neurological" },
  { name: "Topiramate (Topamax)", rxNorm: "38404", class: "Anticonvulsant", category: "Neurological" },
  { name: "Pregabalin (Lyrica)", rxNorm: "187832", class: "Anticonvulsant", category: "Neurological" },
  { name: "Cetirizine (Zyrtec)", rxNorm: "20610", class: "Antihistamine", category: "Allergy" },
  { name: "Loratadine (Claritin)", rxNorm: "26225", class: "Antihistamine", category: "Allergy" },
  { name: "Fexofenadine (Allegra)", rxNorm: "26314", class: "Antihistamine", category: "Allergy" },
  { name: "Spironolactone (Aldactone)", rxNorm: "9997", class: "Diuretic", category: "Cardiovascular" },
  { name: "Carvedilol (Coreg)", rxNorm: "20352", class: "Beta-Blocker", category: "Cardiovascular" },
  { name: "Diltiazem (Cardizem)", rxNorm: "3443", class: "Calcium Channel Blocker", category: "Cardiovascular" },
  { name: "Nitroglycerin", rxNorm: "7417", class: "Vasodilator", category: "Cardiovascular" },
  { name: "Allopurinol (Zyloprim)", rxNorm: "519", class: "Xanthine Oxidase Inhibitor", category: "Musculoskeletal" },
  { name: "Colchicine (Colcrys)", rxNorm: "2683", class: "Anti-gout", category: "Musculoskeletal" },
  { name: "Methotrexate", rxNorm: "6851", class: "DMARD", category: "Rheumatological" },
  { name: "Finasteride (Proscar)", rxNorm: "72236", class: "5-Alpha Reductase Inhibitor", category: "Genitourinary" },
  { name: "Sildenafil (Viagra)", rxNorm: "136411", class: "PDE5 Inhibitor", category: "Genitourinary" },
  { name: "Ondansetron (Zofran)", rxNorm: "26225", class: "Antiemetic", category: "Gastrointestinal" },
  { name: "Loperamide (Imodium)", rxNorm: "6468", class: "Antidiarrheal", category: "Gastrointestinal" },
  { name: "Polyethylene Glycol (Miralax)", rxNorm: "8426", class: "Laxative", category: "Gastrointestinal" },
  { name: "Docusate Sodium (Colace)", rxNorm: "3592", class: "Stool Softener", category: "Gastrointestinal" },
  { name: "Latanoprost (Xalatan)", rxNorm: "76711", class: "Prostaglandin Analog", category: "Ophthalmological" },
  { name: "Timolol Eye Drops", rxNorm: "10600", class: "Beta-Blocker", category: "Ophthalmological" },
  { name: "Oxycodone (OxyContin)", rxNorm: "7804", class: "Opioid", category: "Pain" },
  { name: "Morphine", rxNorm: "7052", class: "Opioid", category: "Pain" },
  { name: "Diclofenac (Voltaren)", rxNorm: "3355", class: "NSAID", category: "Pain" },
  { name: "Naproxen (Aleve)", rxNorm: "7258", class: "NSAID", category: "Pain" },
  { name: "Aspirin (Low-Dose)", rxNorm: "1191", class: "Antiplatelet", category: "Cardiovascular" },
  { name: "Multivitamin", rxNorm: "89905", class: "Supplement", category: "Supplement" },
];

export const TOP_50_ALLERGIES = {
  medication: [
    { name: "Penicillin", type: "medication", severity: "moderate" },
    { name: "Amoxicillin", type: "medication", severity: "moderate" },
    { name: "Sulfa Drugs (Sulfonamides)", type: "medication", severity: "moderate" },
    { name: "Aspirin", type: "medication", severity: "moderate" },
    { name: "Ibuprofen (NSAIDs)", type: "medication", severity: "moderate" },
    { name: "Codeine", type: "medication", severity: "severe" },
    { name: "Morphine", type: "medication", severity: "severe" },
    { name: "Cephalosporins", type: "medication", severity: "moderate" },
    { name: "Fluoroquinolones (Cipro)", type: "medication", severity: "moderate" },
    { name: "Tetracycline", type: "medication", severity: "mild" },
    { name: "Erythromycin", type: "medication", severity: "mild" },
    { name: "Vancomycin", type: "medication", severity: "severe" },
    { name: "Metronidazole (Flagyl)", type: "medication", severity: "mild" },
    { name: "ACE Inhibitors", type: "medication", severity: "moderate" },
    { name: "Statins", type: "medication", severity: "mild" },
    { name: "Contrast Dye (Iodine)", type: "medication", severity: "severe" },
    { name: "Latex", type: "medication", severity: "severe" },
    { name: "Local Anesthetics (Lidocaine)", type: "medication", severity: "moderate" },
    { name: "Insulin", type: "medication", severity: "moderate" },
    { name: "Heparin", type: "medication", severity: "severe" },
  ],
  food: [
    { name: "Peanuts", type: "food", severity: "severe" },
    { name: "Tree Nuts (Almonds, Walnuts, Cashews)", type: "food", severity: "severe" },
    { name: "Shellfish (Shrimp, Crab, Lobster)", type: "food", severity: "severe" },
    { name: "Fish", type: "food", severity: "moderate" },
    { name: "Milk / Dairy", type: "food", severity: "moderate" },
    { name: "Eggs", type: "food", severity: "moderate" },
    { name: "Wheat / Gluten", type: "food", severity: "moderate" },
    { name: "Soy", type: "food", severity: "mild" },
    { name: "Sesame", type: "food", severity: "moderate" },
    { name: "Corn", type: "food", severity: "mild" },
    { name: "Strawberries", type: "food", severity: "mild" },
    { name: "Citrus Fruits", type: "food", severity: "mild" },
    { name: "Tomatoes", type: "food", severity: "mild" },
    { name: "Chocolate", type: "food", severity: "mild" },
    { name: "Sulfites (Wine, Dried Fruits)", type: "food", severity: "moderate" },
  ],
  environmental: [
    { name: "Dust Mites", type: "environmental", severity: "moderate" },
    { name: "Pollen (Grass)", type: "environmental", severity: "moderate" },
    { name: "Pollen (Tree)", type: "environmental", severity: "moderate" },
    { name: "Pollen (Ragweed)", type: "environmental", severity: "moderate" },
    { name: "Mold / Mildew", type: "environmental", severity: "moderate" },
    { name: "Pet Dander (Cat)", type: "environmental", severity: "moderate" },
    { name: "Pet Dander (Dog)", type: "environmental", severity: "mild" },
    { name: "Cockroach", type: "environmental", severity: "moderate" },
    { name: "Bee / Wasp Stings", type: "environmental", severity: "severe" },
    { name: "Fire Ant Stings", type: "environmental", severity: "severe" },
    { name: "Poison Ivy / Oak / Sumac", type: "environmental", severity: "moderate" },
    { name: "Nickel (Jewelry)", type: "environmental", severity: "mild" },
    { name: "Fragrances / Perfumes", type: "environmental", severity: "mild" },
    { name: "Cleaning Chemicals", type: "environmental", severity: "mild" },
    { name: "Cigarette Smoke", type: "environmental", severity: "moderate" },
  ],
};

export const PREVENTIVE_CARE_ITEMS = [
  { name: "Annual Physical Exam", category: "General", frequency: "Yearly", ageGroup: "18+" },
  { name: "Blood Pressure Screening", category: "Cardiovascular", frequency: "Yearly", ageGroup: "18+" },
  { name: "Cholesterol / Lipid Panel", category: "Cardiovascular", frequency: "Every 5 years", ageGroup: "20+" },
  { name: "Blood Glucose / A1C Test", category: "Diabetes", frequency: "Every 3 years", ageGroup: "45+" },
  { name: "Colonoscopy", category: "Cancer Screening", frequency: "Every 10 years", ageGroup: "45-75" },
  { name: "Mammogram", category: "Cancer Screening", frequency: "Every 1-2 years", ageGroup: "40+ (F)" },
  { name: "Pap Smear / Cervical Cancer Screening", category: "Cancer Screening", frequency: "Every 3 years", ageGroup: "21-65 (F)" },
  { name: "Prostate Cancer Screening (PSA)", category: "Cancer Screening", frequency: "Discuss with MD", ageGroup: "50+ (M)" },
  { name: "Lung Cancer Screening (Low-Dose CT)", category: "Cancer Screening", frequency: "Yearly", ageGroup: "50-80 (smokers)" },
  { name: "Skin Cancer Screening", category: "Cancer Screening", frequency: "Yearly", ageGroup: "18+" },
  { name: "Bone Density (DEXA Scan)", category: "Musculoskeletal", frequency: "Every 2 years", ageGroup: "65+ (F), 70+ (M)" },
  { name: "Eye Exam", category: "Vision", frequency: "Every 1-2 years", ageGroup: "40+" },
  { name: "Hearing Test", category: "Hearing", frequency: "Every 3-5 years", ageGroup: "50+" },
  { name: "Dental Exam & Cleaning", category: "Dental", frequency: "Every 6 months", ageGroup: "All" },
  { name: "Colon Cancer Stool Test (FIT/gFOBT)", category: "Cancer Screening", frequency: "Yearly", ageGroup: "45-75" },
  { name: "Depression Screening", category: "Mental Health", frequency: "Yearly", ageGroup: "18+" },
  { name: "Alcohol Use Screening", category: "Behavioral", frequency: "Yearly", ageGroup: "18+" },
  { name: "HIV Screening", category: "Infectious Disease", frequency: "At least once", ageGroup: "15-65" },
  { name: "Hepatitis C Screening", category: "Infectious Disease", frequency: "Once", ageGroup: "18-79" },
  { name: "STI Screening", category: "Infectious Disease", frequency: "As needed", ageGroup: "Sexually active" },
  { name: "Abdominal Aortic Aneurysm Screening", category: "Cardiovascular", frequency: "Once", ageGroup: "65-75 (M, ever smoked)" },
  { name: "Thyroid Function Test", category: "Endocrine", frequency: "Every 5 years", ageGroup: "35+" },
  { name: "Vitamin D Level", category: "General", frequency: "As needed", ageGroup: "50+" },
  { name: "Fall Risk Assessment", category: "Geriatric", frequency: "Yearly", ageGroup: "65+" },
  { name: "Cognitive Screening", category: "Geriatric", frequency: "Yearly", ageGroup: "65+" },
];

export const PRENATAL_CARE_GUIDELINES = [
  { name: "Initial OB Visit & Comprehensive History", category: "Initial Visit", trimester: "first", timing: "6-8 weeks", description: "Complete medical, surgical, family, and obstetric history. Establish estimated due date, risk assessment, and care plan.", importance: "required" },
  { name: "Blood Type & Rh Factor", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Determine ABO blood type and Rh(D) status to identify risk for Rh incompatibility.", importance: "required" },
  { name: "Complete Blood Count (CBC)", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Screen for anemia, thrombocytopenia, and infection. Repeat in third trimester.", importance: "required" },
  { name: "Urinalysis & Urine Culture", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Screen for asymptomatic bacteriuria, proteinuria, and glucosuria.", importance: "required" },
  { name: "STI Panel (HIV, Syphilis, Chlamydia, Gonorrhea)", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Screen for sexually transmitted infections that can affect pregnancy and neonatal outcomes.", importance: "required" },
  { name: "Rubella Immunity", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Check rubella IgG antibody status. Vaccinate postpartum if non-immune.", importance: "required" },
  { name: "Hepatitis B Surface Antigen (HBsAg)", category: "Routine Labs", trimester: "first", timing: "First prenatal visit", description: "Screen for hepatitis B infection to plan neonatal prophylaxis if positive.", importance: "required" },
  { name: "First Trimester Screening (NT Scan + Bloodwork)", category: "Genetic Screening", trimester: "first", timing: "11-14 weeks", description: "Nuchal translucency ultrasound combined with serum PAPP-A and free beta-hCG to assess risk for trisomy 21, 18, and 13.", importance: "recommended" },
  { name: "Cell-Free DNA Screening (NIPT)", category: "Genetic Screening", trimester: "first", timing: "10+ weeks", description: "Non-invasive prenatal testing analyzing cell-free fetal DNA in maternal blood for chromosomal abnormalities.", importance: "recommended" },
  { name: "Chorionic Villus Sampling (CVS)", category: "Genetic Screening", trimester: "first", timing: "10-13 weeks", description: "Invasive diagnostic procedure sampling placental tissue for definitive chromosomal and genetic analysis. Offered for high-risk pregnancies.", importance: "optional" },
  { name: "Dating Ultrasound", category: "Imaging", trimester: "first", timing: "8-12 weeks", description: "Confirm gestational age, viability, number of fetuses, and establish estimated due date.", importance: "recommended" },
  { name: "Anatomy Scan", category: "Imaging", trimester: "second", timing: "18-22 weeks", description: "Detailed ultrasound evaluating fetal anatomy, organ development, placental location, and amniotic fluid volume.", importance: "required" },
  { name: "Quad Screen (Second Trimester Screening)", category: "Genetic Screening", trimester: "second", timing: "15-20 weeks", description: "Serum screening measuring AFP, hCG, estriol, and inhibin A to assess risk for neural tube defects and chromosomal abnormalities.", importance: "recommended" },
  { name: "Amniocentesis", category: "Genetic Screening", trimester: "second", timing: "15-20 weeks", description: "Invasive diagnostic procedure sampling amniotic fluid for definitive chromosomal, genetic, and neural tube defect analysis.", importance: "optional" },
  { name: "Glucose Tolerance Test (GDM Screening)", category: "Routine Labs", trimester: "second", timing: "24-28 weeks", description: "One-hour glucose challenge test to screen for gestational diabetes mellitus. Three-hour GTT if initial screen is positive.", importance: "required" },
  { name: "RhoGAM Injection (Rh-Negative Patients)", category: "Routine Labs", trimester: "second", timing: "28 weeks", description: "Anti-D immunoglobulin administration for Rh-negative mothers to prevent Rh sensitization.", importance: "required" },
  { name: "Tdap Vaccine", category: "Vaccinations", trimester: "third", timing: "27-36 weeks", description: "Tetanus, diphtheria, and acellular pertussis vaccine to provide passive immunity to the newborn against whooping cough.", importance: "required" },
  { name: "RSV Vaccine (Abrysvo)", category: "Vaccinations", trimester: "third", timing: "32-36 weeks", description: "Respiratory syncytial virus vaccine administered during pregnancy to provide passive immunity to the newborn.", importance: "recommended" },
  { name: "Influenza (Flu) Vaccine", category: "Vaccinations", trimester: "any", timing: "During flu season", description: "Inactivated influenza vaccine recommended during any trimester to protect mother and newborn.", importance: "recommended" },
  { name: "COVID-19 Vaccine", category: "Vaccinations", trimester: "any", timing: "Any trimester", description: "Updated COVID-19 vaccine recommended during pregnancy to reduce risk of severe illness and provide passive neonatal immunity.", importance: "recommended" },
  { name: "Group B Streptococcus (GBS) Test", category: "Routine Labs", trimester: "third", timing: "35-37 weeks", description: "Vaginal-rectal swab culture to screen for GBS colonization. Positive results require intrapartum antibiotic prophylaxis.", importance: "required" },
  { name: "Non-Stress Test (NST)", category: "Monitoring", trimester: "third", timing: "32+ weeks, as indicated", description: "Electronic fetal heart rate monitoring to assess fetal well-being by evaluating heart rate accelerations with movement.", importance: "recommended" },
  { name: "Biophysical Profile (BPP)", category: "Monitoring", trimester: "third", timing: "32+ weeks, as indicated", description: "Ultrasound assessment of fetal breathing, movement, tone, and amniotic fluid combined with NST for comprehensive fetal evaluation.", importance: "recommended" },
  { name: "Folic Acid Supplementation", category: "Nutrition", trimester: "all", timing: "Preconception through pregnancy", description: "400-800 mcg daily folic acid to prevent neural tube defects. Higher doses for high-risk patients.", importance: "required" },
  { name: "Iron Supplementation", category: "Nutrition", trimester: "all", timing: "Throughout pregnancy", description: "27 mg elemental iron daily to support increased blood volume and prevent iron-deficiency anemia.", importance: "recommended" },
  { name: "Prenatal Vitamins", category: "Nutrition", trimester: "all", timing: "Preconception through postpartum", description: "Daily prenatal multivitamin containing folic acid, iron, calcium, DHA, and other essential nutrients.", importance: "required" },
  { name: "Depression & Anxiety Screening", category: "Mental Health", trimester: "all", timing: "Each trimester and postpartum", description: "Edinburgh Postnatal Depression Scale (EPDS) or PHQ-9 screening for perinatal mood and anxiety disorders.", importance: "required" },
  { name: "Substance Use Screening", category: "Mental Health", trimester: "first", timing: "First prenatal visit", description: "Screen for alcohol, tobacco, cannabis, opioids, and other substance use. Provide resources and referrals as needed.", importance: "required" },
  { name: "Childbirth Education", category: "Education", trimester: "third", timing: "28-36 weeks", description: "Education on labor stages, pain management options, delivery methods, and what to expect during birth.", importance: "recommended" },
  { name: "Breastfeeding Education", category: "Education", trimester: "third", timing: "30-36 weeks", description: "Prenatal breastfeeding education including benefits, techniques, latch, and available lactation support resources.", importance: "recommended" },
  { name: "Birth Plan Discussion", category: "Education", trimester: "third", timing: "32-36 weeks", description: "Review patient preferences for labor, delivery, pain management, skin-to-skin contact, and postpartum care.", importance: "recommended" },
  { name: "Fetal Kick Counts", category: "Monitoring", trimester: "third", timing: "28+ weeks daily", description: "Daily monitoring of fetal movement patterns. Report decreased movement (fewer than 10 kicks in 2 hours) immediately.", importance: "required" },
  { name: "Blood Pressure Monitoring", category: "Monitoring", trimester: "all", timing: "Every prenatal visit", description: "Monitor for hypertensive disorders including gestational hypertension and preeclampsia. Elevated readings require further evaluation.", importance: "required" },
  { name: "Weight Tracking", category: "Monitoring", trimester: "all", timing: "Every prenatal visit", description: "Monitor maternal weight gain against recommended ranges based on pre-pregnancy BMI to optimize outcomes.", importance: "required" },
  { name: "Urine Protein Checks", category: "Monitoring", trimester: "all", timing: "Every prenatal visit", description: "Dipstick urinalysis for proteinuria as screening for preeclampsia and kidney dysfunction.", importance: "required" },
];

export const NEWBORN_SCREENING_GUIDELINES = [
  { name: "Phenylketonuria (PKU)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for inability to metabolize phenylalanine. Early dietary intervention prevents intellectual disability.", importance: "required" },
  { name: "Congenital Hypothyroidism", category: "Endocrine", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for thyroid hormone deficiency. Early thyroid replacement therapy prevents developmental delays.", importance: "required" },
  { name: "Galactosemia", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for inability to metabolize galactose. Requires immediate dietary galactose restriction.", importance: "required" },
  { name: "Sickle Cell Disease", category: "Hemoglobin", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for hemoglobin S and other hemoglobin variants. Early identification enables prophylactic penicillin and comprehensive care.", importance: "required" },
  { name: "Congenital Adrenal Hyperplasia (CAH)", category: "Endocrine", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for 21-hydroxylase deficiency affecting cortisol and aldosterone production. Can cause life-threatening salt-wasting crisis.", importance: "required" },
  { name: "Biotinidase Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for inability to recycle biotin. Biotin supplementation prevents seizures, hearing loss, and developmental delay.", importance: "required" },
  { name: "Medium-Chain Acyl-CoA Dehydrogenase (MCAD) Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for fatty acid oxidation disorder. Avoiding fasting and dietary management prevent hypoketotic hypoglycemia.", importance: "required" },
  { name: "Cystic Fibrosis", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for CFTR gene mutations causing thick mucus in lungs and digestive system. Early treatment improves outcomes.", importance: "required" },
  { name: "Severe Combined Immunodeficiency (SCID)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for T-cell lymphocyte deficiency via TREC assay. Early bone marrow transplant can be lifesaving.", importance: "required" },
  { name: "Spinal Muscular Atrophy (SMA)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for SMN1 gene deletion causing progressive motor neuron loss. Early gene therapy dramatically improves outcomes.", importance: "required" },
  { name: "Hearing Screening", category: "Hearing", timing: "Before hospital discharge", method: "OAE/ABR", description: "Otoacoustic emissions (OAE) or auditory brainstem response (ABR) testing to detect congenital hearing loss for early intervention.", importance: "required" },
  { name: "Critical Congenital Heart Disease (CCHD)", category: "Heart", timing: "24-48 hours after birth", method: "Pulse oximetry", description: "Pulse oximetry screening in right hand and foot to detect critical congenital heart defects requiring early intervention.", importance: "required" },
  { name: "Maple Syrup Urine Disease (MSUD)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for branched-chain amino acid metabolism disorder. Strict dietary management prevents neurological damage.", importance: "required" },
  { name: "Homocystinuria", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for cystathionine beta-synthase deficiency. Dietary management and B6 supplementation prevent complications.", importance: "required" },
  { name: "Tyrosinemia Type I", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for fumarylacetoacetate hydrolase deficiency. Treatment with nitisinone and dietary management prevents liver failure.", importance: "required" },
  { name: "Citrullinemia Type I", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for argininosuccinate synthetase deficiency in the urea cycle. Dietary protein restriction and supplements prevent hyperammonemia.", importance: "required" },
  { name: "Argininosuccinic Aciduria", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for argininosuccinate lyase deficiency in the urea cycle. Management includes protein restriction and arginine supplementation.", importance: "required" },
  { name: "Very Long-Chain Acyl-CoA Dehydrogenase (VLCAD) Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for long-chain fatty acid oxidation disorder. Dietary management and avoidance of fasting prevent cardiac and metabolic crises.", importance: "required" },
  { name: "Long-Chain 3-Hydroxyacyl-CoA Dehydrogenase (LCHAD) Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for fatty acid oxidation disorder. Dietary fat modification and MCT oil supplementation prevent cardiomyopathy.", importance: "required" },
  { name: "Trifunctional Protein Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for mitochondrial trifunctional protein deficiency affecting fatty acid oxidation. Requires dietary fat restriction.", importance: "required" },
  { name: "Propionic Acidemia", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for propionyl-CoA carboxylase deficiency. Protein-restricted diet and carnitine supplementation prevent metabolic crises.", importance: "required" },
  { name: "Methylmalonic Acidemia", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for methylmalonyl-CoA mutase deficiency. Management includes protein restriction, B12 supplementation, and carnitine.", importance: "required" },
  { name: "Isovaleric Acidemia", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for isovaleryl-CoA dehydrogenase deficiency. Leucine-restricted diet and glycine/carnitine supplementation prevent crises.", importance: "required" },
  { name: "Glutaric Acidemia Type I", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for glutaryl-CoA dehydrogenase deficiency. Lysine-restricted diet and carnitine supplementation prevent movement disorders.", importance: "required" },
  { name: "3-Methylcrotonyl-CoA Carboxylase Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for leucine catabolism disorder. Most cases are benign; some require dietary leucine restriction.", importance: "required" },
  { name: "Beta-Ketothiolase Deficiency", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for mitochondrial acetoacetyl-CoA thiolase deficiency. Protein restriction and sick-day management prevent ketoacidotic episodes.", importance: "required" },
  { name: "Carnitine Uptake Defect (CUD)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for primary carnitine deficiency due to OCTN2 transporter defect. Lifelong carnitine supplementation prevents cardiomyopathy.", importance: "required" },
  { name: "Pompe Disease", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for acid alpha-glucosidase deficiency causing glycogen storage. Early enzyme replacement therapy improves survival.", importance: "required" },
  { name: "Mucopolysaccharidosis Type I (MPS I)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for alpha-L-iduronidase deficiency. Early enzyme replacement therapy or stem cell transplant improves outcomes.", importance: "required" },
  { name: "X-Linked Adrenoleukodystrophy (X-ALD)", category: "Metabolic", timing: "24-48 hours after birth", method: "Heel prick blood spot", description: "Screens for peroxisomal fatty acid beta-oxidation disorder. Early monitoring enables timely stem cell transplant for cerebral form.", importance: "required" },
  { name: "Hepatitis B Screening", category: "Infectious Disease", timing: "At birth", method: "Blood test", description: "Screen newborns of HBsAg-positive mothers. Administer hepatitis B vaccine and HBIG within 12 hours of birth.", importance: "required" },
  { name: "Bilirubin Screening (Jaundice)", category: "Other", timing: "24-48 hours after birth", method: "Blood test / Transcutaneous bilirubinometer", description: "Screen for hyperbilirubinemia to prevent kernicterus. Phototherapy or exchange transfusion if levels exceed thresholds.", importance: "required" },
  { name: "Vitamin K Injection", category: "Other", timing: "At birth", method: "Intramuscular injection", description: "Intramuscular vitamin K (phytonadione) 0.5-1 mg to prevent vitamin K deficiency bleeding (hemorrhagic disease of the newborn).", importance: "required" },
  { name: "Erythromycin Eye Ointment", category: "Other", timing: "At birth", method: "Topical application", description: "Ophthalmic erythromycin ointment applied to both eyes to prevent ophthalmia neonatorum from gonococcal and chlamydial infection.", importance: "required" },
  { name: "Developmental Hip Dysplasia Check", category: "Developmental", timing: "At birth and well-child visits", method: "Physical examination", description: "Barlow and Ortolani maneuvers to screen for developmental dysplasia of the hip. Ultrasound if risk factors or abnormal exam.", importance: "required" },
  { name: "Newborn Metabolic Screen Repeat", category: "Metabolic", timing: "1-2 weeks after birth", method: "Heel prick blood spot", description: "Repeat newborn screening to catch conditions that may not be detectable in the first 24-48 hours, especially in premature infants.", importance: "required" },
  { name: "Pulse Oximetry Repeat (if borderline)", category: "Heart", timing: "1 hour after initial screen", method: "Pulse oximetry", description: "Repeat pulse oximetry screening if initial results are borderline. Echocardiography if screening remains abnormal.", importance: "recommended" },
];

export const VACCINE_REGISTRY = [
  { name: "Influenza (Flu)", schedule: "Yearly", ageGroup: "6 months+", doses: 1 },
  { name: "COVID-19 (Updated Booster)", schedule: "Yearly", ageGroup: "6 months+", doses: 1 },
  { name: "Tdap (Tetanus, Diphtheria, Pertussis)", schedule: "Every 10 years", ageGroup: "11+", doses: 1 },
  { name: "Td (Tetanus, Diphtheria) Booster", schedule: "Every 10 years", ageGroup: "19+", doses: 1 },
  { name: "Shingles (Shingrix)", schedule: "2-dose series", ageGroup: "50+", doses: 2 },
  { name: "Pneumococcal (PCV20 or PCV15+PPSV23)", schedule: "1-2 doses", ageGroup: "65+", doses: 2 },
  { name: "Hepatitis A", schedule: "2-dose series", ageGroup: "All", doses: 2 },
  { name: "Hepatitis B", schedule: "3-dose series", ageGroup: "All", doses: 3 },
  { name: "HPV (Gardasil 9)", schedule: "2-3 dose series", ageGroup: "9-45", doses: 3 },
  { name: "MMR (Measles, Mumps, Rubella)", schedule: "2 doses (childhood)", ageGroup: "All", doses: 2 },
  { name: "Varicella (Chickenpox)", schedule: "2 doses", ageGroup: "All", doses: 2 },
  { name: "Polio (IPV)", schedule: "4 doses (childhood)", ageGroup: "All", doses: 4 },
  { name: "Meningococcal ACWY", schedule: "1-2 doses", ageGroup: "11-12, 16", doses: 2 },
  { name: "Meningococcal B", schedule: "2-3 doses", ageGroup: "16-23", doses: 3 },
  { name: "RSV (Respiratory Syncytial Virus)", schedule: "1 dose", ageGroup: "60+, pregnant", doses: 1 },
  { name: "Rotavirus", schedule: "2-3 doses (infant)", ageGroup: "Infant", doses: 3 },
  { name: "DTaP (Childhood Diphtheria, Tetanus, Pertussis)", schedule: "5 doses", ageGroup: "2m-6y", doses: 5 },
  { name: "Hib (Haemophilus Influenzae type b)", schedule: "3-4 doses", ageGroup: "Infant", doses: 4 },
];

export const PHQ9_QUESTIONS = [
  { id: 1, text: "Little interest or pleasure in doing things" },
  { id: 2, text: "Feeling down, depressed, or hopeless" },
  { id: 3, text: "Trouble falling or staying asleep, or sleeping too much" },
  { id: 4, text: "Feeling tired or having little energy" },
  { id: 5, text: "Poor appetite or overeating" },
  { id: 6, text: "Feeling bad about yourself - or that you are a failure or have let yourself or your family down" },
  { id: 7, text: "Trouble concentrating on things, such as reading the newspaper or watching television" },
  { id: 8, text: "Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual" },
  { id: 9, text: "Thoughts that you would be better off dead, or of hurting yourself in some way" },
];

export const PHQ9_SCORING = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export function getPHQ9Interpretation(score: number): { severity: string; action: string } {
  if (score <= 4) return { severity: "Minimal depression", action: "Patient may not need treatment" };
  if (score <= 9) return { severity: "Mild depression", action: "Watchful waiting; repeat PHQ-9 at follow-up" };
  if (score <= 14) return { severity: "Moderate depression", action: "Treatment plan, consider counseling or pharmacotherapy" };
  if (score <= 19) return { severity: "Moderately severe depression", action: "Active treatment with pharmacotherapy and/or psychotherapy" };
  return { severity: "Severe depression", action: "Immediate initiation of pharmacotherapy and referral to mental health specialist" };
}

export const PEG_SCALE_QUESTIONS = [
  { id: "pain", text: "What number best describes your pain on average in the past week?", anchor_low: "No pain", anchor_high: "Pain as bad as you can imagine" },
  { id: "enjoyment", text: "What number best describes how, during the past week, pain has interfered with your enjoyment of life?", anchor_low: "Does not interfere", anchor_high: "Completely interferes" },
  { id: "activity", text: "What number best describes how, during the past week, pain has interfered with your general activity?", anchor_low: "Does not interfere", anchor_high: "Completely interferes" },
];

export function getPEGInterpretation(avgScore: number): { level: string; recommendation: string } {
  if (avgScore <= 3) return { level: "Mild", recommendation: "Continue monitoring. Non-pharmacological interventions recommended." };
  if (avgScore <= 6) return { level: "Moderate", recommendation: "Consider multimodal treatment. Evaluate for physical therapy and/or medication adjustment." };
  return { level: "Severe", recommendation: "Comprehensive pain management evaluation recommended. Consider specialist referral." };
}

export const SDOH_QUESTIONS = [
  { id: "housing", category: "Living Situation", text: "What is your current living situation?", type: "select",
    options: ["I have a steady place to live", "I have a place to live today but I am worried about losing it", "I do not have a steady place to live (staying with others, in a shelter, living outside on the street, etc.)"] },
  { id: "housing_concerns", category: "Living Situation", text: "Are you worried about losing your housing?", type: "boolean" },
  { id: "food_insecurity", category: "Food", text: "Within the past 12 months, did you worry that your food would run out before you got money to buy more?", type: "boolean" },
  { id: "food_ran_out", category: "Food", text: "Within the past 12 months, did the food you bought just not last and you didn't have money to get more?", type: "boolean" },
  { id: "transportation", category: "Transportation", text: "In the past 12 months, has lack of reliable transportation kept you from medical appointments, meetings, work, or from getting things needed for daily living?", type: "boolean" },
  { id: "utilities", category: "Utilities", text: "In the past 12 months, has the electric, gas, oil, or water company threatened to shut off services in your home?", type: "boolean" },
  { id: "safety", category: "Personal Safety", text: "Do you feel physically and emotionally safe where you currently live?", type: "select",
    options: ["Yes", "No", "Unsure"] },
  { id: "partner_safety", category: "Personal Safety", text: "Within the past year, have you been hit, slapped, kicked, or otherwise physically hurt by someone?", type: "boolean" },
  { id: "education", category: "Education", text: "What is the highest level of school that you have finished?", type: "select",
    options: ["Less than high school", "High school diploma or GED", "Some college or vocational training", "College degree or higher"] },
  { id: "employment", category: "Employment", text: "What is your current work situation?", type: "select",
    options: ["Full-time employed", "Part-time employed", "Unemployed and looking", "Unemployed and not looking", "Retired", "Disabled / Unable to work", "Student"] },
  { id: "financial_strain", category: "Financial", text: "How hard is it for you to pay for the very basics like food, housing, medical care, and heating?", type: "select",
    options: ["Not hard at all", "Somewhat hard", "Very hard"] },
  { id: "social_isolation", category: "Social & Emotional", text: "How often do you see or talk to people that you care about and feel close to?", type: "select",
    options: ["Less than once a week", "1-2 times a week", "3-5 times a week", "5 or more times a week"] },
  { id: "stress", category: "Social & Emotional", text: "Stress is when someone feels tense, nervous, anxious, or can't sleep at night because their mind is troubled. How stressed are you?", type: "select",
    options: ["Not at all", "A little bit", "Somewhat", "Quite a bit", "Very much"] },
];

export const SOCIAL_HISTORY_FIELDS = [
  { id: "tobacco_use", label: "Tobacco / Nicotine Use", type: "select", options: ["Never", "Former (quit)", "Current - daily", "Current - occasional"] },
  { id: "tobacco_type", label: "Tobacco Type (if applicable)", type: "multiselect", options: ["Cigarettes", "Cigars", "E-cigarettes / Vaping", "Chewing tobacco", "Pipe"] },
  { id: "tobacco_pack_years", label: "Pack-Years (if smoker)", type: "number", placeholder: "e.g., 10" },
  { id: "alcohol_use", label: "Alcohol Use", type: "select", options: ["Never", "Rarely (few times/year)", "Social (1-2 drinks/week)", "Moderate (3-7/week)", "Heavy (8+/week)", "Former (quit)"] },
  { id: "substance_use", label: "Recreational Drug Use", type: "select", options: ["Never", "Former", "Current"] },
  { id: "substance_types", label: "Substances Used (if applicable)", type: "multiselect", options: ["Marijuana/Cannabis", "Cocaine", "Opioids (non-prescribed)", "Methamphetamine", "Other"] },
  { id: "exercise", label: "Exercise Frequency", type: "select", options: ["None", "1-2 days/week", "3-4 days/week", "5-6 days/week", "Daily"] },
  { id: "exercise_type", label: "Exercise Types", type: "multiselect", options: ["Walking", "Running/Jogging", "Swimming", "Cycling", "Weight training", "Yoga/Pilates", "Sports", "Other"] },
  { id: "diet", label: "Dietary Habits", type: "select", options: ["Standard/No restrictions", "Vegetarian", "Vegan", "Gluten-free", "Low-sodium", "Diabetic diet", "Mediterranean", "Keto/Low-carb", "Other"] },
  { id: "sleep_hours", label: "Average Sleep (hours/night)", type: "number", placeholder: "e.g., 7" },
  { id: "occupation", label: "Occupation", type: "text", placeholder: "Current or most recent job" },
  { id: "marital_status", label: "Marital Status", type: "select", options: ["Single", "Married", "Domestic partner", "Divorced", "Separated", "Widowed"] },
  { id: "children", label: "Number of Children", type: "number", placeholder: "0" },
  { id: "living_with", label: "Who Do You Live With?", type: "multiselect", options: ["Alone", "Spouse/Partner", "Children", "Parents", "Other family", "Roommates", "Group home/Facility"] },
  { id: "sexual_orientation", label: "Sexual Orientation (optional)", type: "select", options: ["Prefer not to answer", "Heterosexual/Straight", "Gay/Lesbian", "Bisexual", "Other"] },
  { id: "gender_identity", label: "Gender Identity (optional)", type: "select", options: ["Prefer not to answer", "Male", "Female", "Transgender male", "Transgender female", "Non-binary", "Other"] },
  { id: "military_service", label: "Military Service", type: "select", options: ["None", "Active duty", "Veteran", "Reserves/National Guard"] },
  { id: "advance_directive", label: "Do you have an Advance Directive / Living Will?", type: "select", options: ["Yes", "No", "Unsure"] },
  { id: "power_of_attorney", label: "Do you have a Healthcare Power of Attorney?", type: "select", options: ["Yes", "No", "Unsure"] },
];

export interface IntakeFormData {
  diagnoses: Array<{ code: string; name: string; yearDiagnosed?: string; status: string }>;
  surgeries: Array<{ code: string; name: string; year?: string; hospital?: string }>;
  medications: Array<{ name: string; rxNorm?: string; dosage?: string; frequency?: string; prescriber?: string; startDate?: string }>;
  allergies: Array<{ name: string; type: string; reaction?: string; severity: string }>;
  preventiveCare: Array<{ name: string; lastDate?: string; result?: string; nextDue?: string }>;
  vaccines: Array<{ name: string; date?: string; doses?: number; lotNumber?: string; administeredBy?: string; source?: string }>;
  socialHistory: Record<string, any>;
  pegScale: { pain: number; enjoyment: number; activity: number };
  phq9: Record<number, number>;
  sdoh: Record<string, any>;
}

export async function aiAssistIntakeForm(
  currentData: Partial<IntakeFormData>,
  section: string,
  userInput: string
): Promise<{ suggestions: any[]; narrative?: string }> {
  try {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return getFallbackSuggestions(section, userInput);
    }

    const response = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: `You are an AI medical intake assistant helping a patient complete their health history form. You suggest relevant items based on what they've already entered and their current input. 

IMPORTANT: You are NOT diagnosing. You are only suggesting common related conditions, medications, or procedures that the patient might want to add to their self-reported history.

Current section: ${section}
Already entered data: ${JSON.stringify(currentData)}

Respond with JSON: { "suggestions": [...items relevant to the section], "narrative": "brief helpful message to the patient" }

For diagnoses: suggest related conditions they may also have
For medications: suggest common medications for their conditions
For allergies: suggest checking for cross-reactive allergies
For preventive care: suggest screenings they may be due for based on age/conditions
For vaccines: suggest vaccines based on age and risk factors`,
        },
        {
          role: "user",
          content: userInput || "Please suggest items I should consider adding based on my current health history.",
        },
      ],
      jsonMode: true,
      temperature: 0.5,
      maxOutputTokens: 1500,
      dataCategories: ["demographics","conditions","medications","behavioral"],
      purpose: "documentation",
      callerService: "intake-history-service",
      callerMethod: "generateIntakeSummary"});

    const content = response.content;
    if (!content) return { suggestions: [] };

    return JSON.parse(content);
  } catch (error) {
    console.error("[IntakeAI] Error:", error);
    return getFallbackSuggestions(section, userInput);
  }
}

function getFallbackSuggestions(section: string, userInput: string): { suggestions: any[]; narrative?: string } {
  const searchTerm = userInput.toLowerCase();

  switch (section) {
    case "diagnoses":
      return {
        suggestions: TOP_50_DIAGNOSES.filter(d => 
          d.name.toLowerCase().includes(searchTerm) || d.code.toLowerCase().includes(searchTerm) || d.category.toLowerCase().includes(searchTerm)
        ).slice(0, 5),
        narrative: "Here are matching diagnoses from our clinical database.",
      };
    case "surgeries":
      return {
        suggestions: TOP_10_SURGERIES.filter(s =>
          s.name.toLowerCase().includes(searchTerm) || s.category.toLowerCase().includes(searchTerm)
        ).slice(0, 5),
        narrative: "Here are matching surgical procedures.",
      };
    case "medications":
      return {
        suggestions: TOP_75_MEDICATIONS.filter(m =>
          m.name.toLowerCase().includes(searchTerm) || m.class.toLowerCase().includes(searchTerm) || m.category.toLowerCase().includes(searchTerm)
        ).slice(0, 5),
        narrative: "Here are matching medications from our formulary.",
      };
    case "allergies":
      const allAllergies = [...TOP_50_ALLERGIES.medication, ...TOP_50_ALLERGIES.food, ...TOP_50_ALLERGIES.environmental];
      return {
        suggestions: allAllergies.filter(a =>
          a.name.toLowerCase().includes(searchTerm) || a.type.toLowerCase().includes(searchTerm)
        ).slice(0, 5),
        narrative: "Here are matching allergies.",
      };
    default:
      return { suggestions: [], narrative: "Start typing to search." };
  }
}

export function calculatePHQ9Score(answers: Record<number, number>): { total: number; interpretation: ReturnType<typeof getPHQ9Interpretation> } {
  const total = Object.values(answers).reduce((sum, v) => sum + (v || 0), 0);
  return { total, interpretation: getPHQ9Interpretation(total) };
}

export function calculatePEGScore(scores: { pain: number; enjoyment: number; activity: number }): { average: number; interpretation: ReturnType<typeof getPEGInterpretation> } {
  const average = Math.round(((scores.pain + scores.enjoyment + scores.activity) / 3) * 10) / 10;
  return { average, interpretation: getPEGInterpretation(average) };
}
