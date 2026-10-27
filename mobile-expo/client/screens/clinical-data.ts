export interface ConditionWithCode {
  name: string;
  icd10: string;
}

export interface SurgeryWithCode {
  name: string;
  cpt: string;
}

export interface AllergyOption {
  name: string;
  category: "drug" | "food" | "environmental";
}

export interface MedicationOption {
  name: string;
  linkedCondition: string;
  strengths: string[];
  frequencies: string[];
}

export interface SocialHistoryCode {
  category: string;
  icd10: string;
  label: string;
}

export interface CountryCode {
  code: string;
  dial: string;
  name: string;
}

export const COMMON_CONDITIONS_WITH_ICD: ConditionWithCode[] = [
  { name: "Hypertension", icd10: "I10" },
  { name: "Anxiety", icd10: "F41.1" },
  { name: "Depression", icd10: "F32.9" },
  { name: "Obesity", icd10: "E66.9" },
  { name: "Type 2 Diabetes", icd10: "E11.9" },
  { name: "Hyperlipidemia", icd10: "E78.5" },
  { name: "Osteoarthritis", icd10: "M19.90" },
  { name: "Back and Neck Pain", icd10: "M54.9" },
  { name: "Allergic Rhinitis", icd10: "J30.9" },
  { name: "Asthma", icd10: "J45.909" },
  { name: "GERD", icd10: "K21.0" },
  { name: "Coronary Artery Disease", icd10: "I25.10" },
  { name: "Stroke", icd10: "I63.9" },
  { name: "COPD", icd10: "J44.1" },
  { name: "Pneumonia", icd10: "J18.9" },
  { name: "Dementia", icd10: "F03.90" },
  { name: "Lung Cancer", icd10: "C34.90" },
  { name: "Chronic Kidney Disease", icd10: "N18.9" },
  { name: "Colorectal Cancer", icd10: "C18.9" },
  { name: "Tuberculosis", icd10: "A15.9" },
  { name: "Cirrhosis", icd10: "K74.60" },
  { name: "Fatty Liver Disease", icd10: "K76.0" },
  { name: "Hypothyroidism", icd10: "E03.9" },
  { name: "Hyperthyroidism", icd10: "E05.90" },
  { name: "HIV", icd10: "B20" },
  { name: "Hepatitis C", icd10: "B18.2" },
  { name: "Hepatitis B", icd10: "B18.1" },
];

export const COMMON_SURGERIES_WITH_CPT: SurgeryWithCode[] = [
  { name: "Cataract Surgery", cpt: "66984" },
  { name: "Cesarean Section (C-Section)", cpt: "59510" },
  { name: "Colonoscopy with Biopsy", cpt: "45380" },
  { name: "Knee Replacement", cpt: "27447" },
  { name: "Hip Replacement", cpt: "27130" },
  { name: "Shoulder Replacement", cpt: "23472" },
  { name: "Gallbladder Removal (Cholecystectomy)", cpt: "47562" },
  { name: "Hernia Repair", cpt: "49505" },
  { name: "Appendectomy", cpt: "44970" },
  { name: "Coronary Artery Bypass (CABG)", cpt: "33533" },
  { name: "Hysterectomy", cpt: "58150" },
  { name: "Heart Stent (Angioplasty)", cpt: "92928" },
  { name: "Tonsillectomy", cpt: "42826" },
  { name: "Spinal Fusion", cpt: "22612" },
  { name: "Rotator Cuff Repair", cpt: "29827" },
  { name: "Carpal Tunnel Release", cpt: "64721" },
  { name: "ACL Reconstruction", cpt: "29888" },
  { name: "Bariatric Surgery", cpt: "43775" },
  { name: "Pacemaker Implantation", cpt: "33208" },
  { name: "Mastectomy", cpt: "19303" },
  { name: "Wisdom Tooth Extraction", cpt: "D7240" },
  { name: "Hemorrhoidectomy", cpt: "46260" },
  { name: "Arthroscopy", cpt: "29881" },
];

export const COMMON_ALLERGIES: AllergyOption[] = [
  { name: "Penicillin", category: "drug" },
  { name: "Amoxicillin", category: "drug" },
  { name: "Sulfa Drugs", category: "drug" },
  { name: "Aspirin / NSAIDs", category: "drug" },
  { name: "Codeine", category: "drug" },
  { name: "Morphine", category: "drug" },
  { name: "Latex", category: "environmental" },
  { name: "Iodine / Contrast Dye", category: "drug" },
  { name: "Pollen", category: "environmental" },
  { name: "Dust Mites", category: "environmental" },
  { name: "Mold", category: "environmental" },
  { name: "Pet Dander (Cat/Dog)", category: "environmental" },
  { name: "Bee Sting Venom", category: "environmental" },
  { name: "Peanuts", category: "food" },
  { name: "Tree Nuts", category: "food" },
  { name: "Shellfish", category: "food" },
  { name: "Eggs", category: "food" },
  { name: "Milk / Dairy", category: "food" },
  { name: "Soy", category: "food" },
  { name: "Wheat / Gluten", category: "food" },
];

export const COMMON_MEDICATIONS: MedicationOption[] = [
  { name: "Lisinopril", linkedCondition: "Hypertension", strengths: ["2.5mg", "5mg", "10mg", "20mg", "40mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Amlodipine", linkedCondition: "Hypertension", strengths: ["2.5mg", "5mg", "10mg"], frequencies: ["Once daily"] },
  { name: "Losartan", linkedCondition: "Hypertension", strengths: ["25mg", "50mg", "100mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Metoprolol", linkedCondition: "Hypertension", strengths: ["25mg", "50mg", "100mg", "200mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Hydrochlorothiazide", linkedCondition: "Hypertension", strengths: ["12.5mg", "25mg", "50mg"], frequencies: ["Once daily"] },
  { name: "Valsartan", linkedCondition: "Hypertension", strengths: ["40mg", "80mg", "160mg", "320mg"], frequencies: ["Once daily"] },
  { name: "Atenolol", linkedCondition: "Hypertension", strengths: ["25mg", "50mg", "100mg"], frequencies: ["Once daily"] },
  { name: "Metformin", linkedCondition: "Type 2 Diabetes", strengths: ["500mg", "850mg", "1000mg"], frequencies: ["Once daily", "Twice daily", "Three times daily"] },
  { name: "Glipizide", linkedCondition: "Type 2 Diabetes", strengths: ["2.5mg", "5mg", "10mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Insulin Glargine (Lantus)", linkedCondition: "Type 2 Diabetes", strengths: ["100 units/mL"], frequencies: ["Once daily at bedtime"] },
  { name: "Sitagliptin (Januvia)", linkedCondition: "Type 2 Diabetes", strengths: ["25mg", "50mg", "100mg"], frequencies: ["Once daily"] },
  { name: "Empagliflozin (Jardiance)", linkedCondition: "Type 2 Diabetes", strengths: ["10mg", "25mg"], frequencies: ["Once daily"] },
  { name: "Semaglutide (Ozempic)", linkedCondition: "Type 2 Diabetes", strengths: ["0.25mg", "0.5mg", "1mg", "2mg"], frequencies: ["Once weekly"] },
  { name: "Atorvastatin", linkedCondition: "Hyperlipidemia", strengths: ["10mg", "20mg", "40mg", "80mg"], frequencies: ["Once daily"] },
  { name: "Rosuvastatin", linkedCondition: "Hyperlipidemia", strengths: ["5mg", "10mg", "20mg", "40mg"], frequencies: ["Once daily"] },
  { name: "Simvastatin", linkedCondition: "Hyperlipidemia", strengths: ["5mg", "10mg", "20mg", "40mg", "80mg"], frequencies: ["Once daily at bedtime"] },
  { name: "Pravastatin", linkedCondition: "Hyperlipidemia", strengths: ["10mg", "20mg", "40mg", "80mg"], frequencies: ["Once daily"] },
  { name: "Ezetimibe", linkedCondition: "Hyperlipidemia", strengths: ["10mg"], frequencies: ["Once daily"] },
  { name: "Sertraline (Zoloft)", linkedCondition: "Depression", strengths: ["25mg", "50mg", "100mg", "150mg", "200mg"], frequencies: ["Once daily"] },
  { name: "Escitalopram (Lexapro)", linkedCondition: "Depression", strengths: ["5mg", "10mg", "20mg"], frequencies: ["Once daily"] },
  { name: "Fluoxetine (Prozac)", linkedCondition: "Depression", strengths: ["10mg", "20mg", "40mg", "60mg"], frequencies: ["Once daily"] },
  { name: "Bupropion (Wellbutrin)", linkedCondition: "Depression", strengths: ["75mg", "100mg", "150mg", "300mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Venlafaxine (Effexor)", linkedCondition: "Depression", strengths: ["37.5mg", "75mg", "150mg", "225mg"], frequencies: ["Once daily"] },
  { name: "Duloxetine (Cymbalta)", linkedCondition: "Depression", strengths: ["20mg", "30mg", "60mg"], frequencies: ["Once daily"] },
  { name: "Alprazolam (Xanax)", linkedCondition: "Anxiety", strengths: ["0.25mg", "0.5mg", "1mg", "2mg"], frequencies: ["As needed", "Twice daily", "Three times daily"] },
  { name: "Lorazepam (Ativan)", linkedCondition: "Anxiety", strengths: ["0.5mg", "1mg", "2mg"], frequencies: ["As needed", "Twice daily", "Three times daily"] },
  { name: "Buspirone", linkedCondition: "Anxiety", strengths: ["5mg", "7.5mg", "10mg", "15mg", "30mg"], frequencies: ["Twice daily", "Three times daily"] },
  { name: "Hydroxyzine", linkedCondition: "Anxiety", strengths: ["10mg", "25mg", "50mg"], frequencies: ["As needed", "Three times daily", "Four times daily"] },
  { name: "Omeprazole (Prilosec)", linkedCondition: "GERD", strengths: ["10mg", "20mg", "40mg"], frequencies: ["Once daily before breakfast"] },
  { name: "Pantoprazole (Protonix)", linkedCondition: "GERD", strengths: ["20mg", "40mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Famotidine (Pepcid)", linkedCondition: "GERD", strengths: ["10mg", "20mg", "40mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Albuterol Inhaler", linkedCondition: "Asthma", strengths: ["90mcg/actuation"], frequencies: ["As needed", "Every 4-6 hours as needed"] },
  { name: "Fluticasone Inhaler (Flovent)", linkedCondition: "Asthma", strengths: ["44mcg", "110mcg", "220mcg"], frequencies: ["Twice daily"] },
  { name: "Montelukast (Singulair)", linkedCondition: "Asthma", strengths: ["4mg", "5mg", "10mg"], frequencies: ["Once daily at bedtime"] },
  { name: "Budesonide/Formoterol (Symbicort)", linkedCondition: "Asthma", strengths: ["80/4.5mcg", "160/4.5mcg"], frequencies: ["Twice daily"] },
  { name: "Levothyroxine (Synthroid)", linkedCondition: "Hypothyroidism", strengths: ["25mcg", "50mcg", "75mcg", "88mcg", "100mcg", "112mcg", "125mcg", "137mcg", "150mcg", "175mcg", "200mcg"], frequencies: ["Once daily on empty stomach"] },
  { name: "Methimazole", linkedCondition: "Hyperthyroidism", strengths: ["5mg", "10mg", "20mg"], frequencies: ["Once daily", "Twice daily", "Three times daily"] },
  { name: "Propylthiouracil (PTU)", linkedCondition: "Hyperthyroidism", strengths: ["50mg"], frequencies: ["Three times daily"] },
  { name: "Acetaminophen (Tylenol)", linkedCondition: "Back and Neck Pain", strengths: ["325mg", "500mg", "650mg ER"], frequencies: ["Every 4-6 hours as needed", "Every 8 hours"] },
  { name: "Ibuprofen (Advil)", linkedCondition: "Back and Neck Pain", strengths: ["200mg", "400mg", "600mg", "800mg"], frequencies: ["Every 4-6 hours as needed", "Three times daily"] },
  { name: "Naproxen (Aleve)", linkedCondition: "Osteoarthritis", strengths: ["220mg", "250mg", "375mg", "500mg"], frequencies: ["Twice daily", "Every 8-12 hours"] },
  { name: "Meloxicam (Mobic)", linkedCondition: "Osteoarthritis", strengths: ["7.5mg", "15mg"], frequencies: ["Once daily"] },
  { name: "Gabapentin (Neurontin)", linkedCondition: "Back and Neck Pain", strengths: ["100mg", "300mg", "400mg", "600mg", "800mg"], frequencies: ["Three times daily"] },
  { name: "Pregabalin (Lyrica)", linkedCondition: "Back and Neck Pain", strengths: ["25mg", "50mg", "75mg", "100mg", "150mg", "200mg", "300mg"], frequencies: ["Twice daily", "Three times daily"] },
  { name: "Cetirizine (Zyrtec)", linkedCondition: "Allergic Rhinitis", strengths: ["5mg", "10mg"], frequencies: ["Once daily"] },
  { name: "Loratadine (Claritin)", linkedCondition: "Allergic Rhinitis", strengths: ["10mg"], frequencies: ["Once daily"] },
  { name: "Fexofenadine (Allegra)", linkedCondition: "Allergic Rhinitis", strengths: ["60mg", "180mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Fluticasone Nasal Spray (Flonase)", linkedCondition: "Allergic Rhinitis", strengths: ["50mcg/spray"], frequencies: ["1-2 sprays each nostril daily"] },
  { name: "Aspirin (Low-Dose)", linkedCondition: "Coronary Artery Disease", strengths: ["81mg", "325mg"], frequencies: ["Once daily"] },
  { name: "Clopidogrel (Plavix)", linkedCondition: "Coronary Artery Disease", strengths: ["75mg"], frequencies: ["Once daily"] },
  { name: "Warfarin (Coumadin)", linkedCondition: "Stroke", strengths: ["1mg", "2mg", "2.5mg", "3mg", "4mg", "5mg", "6mg", "7.5mg", "10mg"], frequencies: ["Once daily"] },
  { name: "Apixaban (Eliquis)", linkedCondition: "Stroke", strengths: ["2.5mg", "5mg"], frequencies: ["Twice daily"] },
  { name: "Rivaroxaban (Xarelto)", linkedCondition: "Stroke", strengths: ["10mg", "15mg", "20mg"], frequencies: ["Once daily with food"] },
  { name: "Tiotropium (Spiriva)", linkedCondition: "COPD", strengths: ["1.25mcg", "2.5mcg"], frequencies: ["Once daily"] },
  { name: "Furosemide (Lasix)", linkedCondition: "Chronic Kidney Disease", strengths: ["20mg", "40mg", "80mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Spironolactone", linkedCondition: "Chronic Kidney Disease", strengths: ["25mg", "50mg", "100mg"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Donepezil (Aricept)", linkedCondition: "Dementia", strengths: ["5mg", "10mg", "23mg"], frequencies: ["Once daily at bedtime"] },
  { name: "Memantine (Namenda)", linkedCondition: "Dementia", strengths: ["5mg", "10mg", "28mg ER"], frequencies: ["Once daily", "Twice daily"] },
  { name: "Tenofovir/Emtricitabine (Truvada)", linkedCondition: "HIV", strengths: ["200/300mg"], frequencies: ["Once daily"] },
  { name: "Dolutegravir (Tivicay)", linkedCondition: "HIV", strengths: ["50mg"], frequencies: ["Once daily"] },
  { name: "Biktarvy", linkedCondition: "HIV", strengths: ["50/200/25mg"], frequencies: ["Once daily with food"] },
  { name: "Sofosbuvir/Velpatasvir (Epclusa)", linkedCondition: "Hepatitis C", strengths: ["400/100mg"], frequencies: ["Once daily for 12 weeks"] },
  { name: "Entecavir (Baraclude)", linkedCondition: "Hepatitis B", strengths: ["0.5mg", "1mg"], frequencies: ["Once daily on empty stomach"] },
  { name: "Tenofovir (Viread)", linkedCondition: "Hepatitis B", strengths: ["300mg"], frequencies: ["Once daily"] },
  { name: "Prednisone", linkedCondition: "Asthma", strengths: ["1mg", "2.5mg", "5mg", "10mg", "20mg", "50mg"], frequencies: ["Once daily", "As directed (taper)"] },
];

export const SOCIAL_HISTORY_ICD_CODES: SocialHistoryCode[] = [
  { category: "smoking", icd10: "F17.210", label: "Tobacco use, cigarettes" },
  { category: "smoking", icd10: "Z87.891", label: "History of tobacco use" },
  { category: "smoking", icd10: "Z72.0", label: "Tobacco use" },
  { category: "alcohol", icd10: "F10.10", label: "Alcohol use, uncomplicated" },
  { category: "alcohol", icd10: "Z72.1", label: "Problems related to alcohol use" },
  { category: "alcohol", icd10: "Z71.41", label: "Alcohol abuse counseling" },
  { category: "exercise", icd10: "Z72.3", label: "Lack of physical exercise" },
  { category: "diet", icd10: "Z72.4", label: "Inappropriate diet and eating habits" },
  { category: "stress", icd10: "Z73.3", label: "Stress, not elsewhere classified" },
  { category: "occupation", icd10: "Z57.9", label: "Occupational exposure, unspecified" },
  { category: "occupation", icd10: "Z56.9", label: "Problem related to employment" },
];

export const COUNTRY_CODES: CountryCode[] = [
  { code: "US", dial: "+1", name: "United States" },
  { code: "IN", dial: "+91", name: "India" },
  { code: "GB", dial: "+44", name: "United Kingdom" },
  { code: "CA", dial: "+1", name: "Canada" },
  { code: "AU", dial: "+61", name: "Australia" },
  { code: "DE", dial: "+49", name: "Germany" },
  { code: "FR", dial: "+33", name: "France" },
  { code: "MX", dial: "+52", name: "Mexico" },
  { code: "BR", dial: "+55", name: "Brazil" },
  { code: "NG", dial: "+234", name: "Nigeria" },
  { code: "GH", dial: "+233", name: "Ghana" },
  { code: "KE", dial: "+254", name: "Kenya" },
  { code: "ZA", dial: "+27", name: "South Africa" },
  { code: "ET", dial: "+251", name: "Ethiopia" },
  { code: "PK", dial: "+92", name: "Pakistan" },
  { code: "BD", dial: "+880", name: "Bangladesh" },
  { code: "PH", dial: "+63", name: "Philippines" },
  { code: "VN", dial: "+84", name: "Vietnam" },
  { code: "CN", dial: "+86", name: "China" },
  { code: "JP", dial: "+81", name: "Japan" },
  { code: "KR", dial: "+82", name: "South Korea" },
  { code: "EG", dial: "+20", name: "Egypt" },
  { code: "SA", dial: "+966", name: "Saudi Arabia" },
  { code: "AE", dial: "+971", name: "UAE" },
  { code: "TR", dial: "+90", name: "Turkey" },
  { code: "RU", dial: "+7", name: "Russia" },
  { code: "ID", dial: "+62", name: "Indonesia" },
  { code: "MY", dial: "+60", name: "Malaysia" },
  { code: "TH", dial: "+66", name: "Thailand" },
  { code: "MM", dial: "+95", name: "Myanmar" },
  { code: "KH", dial: "+855", name: "Cambodia" },
  { code: "NP", dial: "+977", name: "Nepal" },
  { code: "LK", dial: "+94", name: "Sri Lanka" },
  { code: "AF", dial: "+93", name: "Afghanistan" },
  { code: "IQ", dial: "+964", name: "Iraq" },
  { code: "SO", dial: "+252", name: "Somalia" },
  { code: "SD", dial: "+249", name: "Sudan" },
  { code: "HT", dial: "+509", name: "Haiti" },
  { code: "JM", dial: "+1", name: "Jamaica" },
  { code: "CU", dial: "+53", name: "Cuba" },
  { code: "DO", dial: "+1", name: "Dominican Republic" },
  { code: "CO", dial: "+57", name: "Colombia" },
  { code: "PE", dial: "+51", name: "Peru" },
  { code: "VE", dial: "+58", name: "Venezuela" },
  { code: "GT", dial: "+502", name: "Guatemala" },
  { code: "SV", dial: "+503", name: "El Salvador" },
  { code: "HN", dial: "+504", name: "Honduras" },
  { code: "IL", dial: "+972", name: "Israel" },
  { code: "IT", dial: "+39", name: "Italy" },
  { code: "PL", dial: "+48", name: "Poland" },
];
