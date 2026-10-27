import { chatComplete } from "./ai-client";

export const CONDITIONS: string[] = [
  "Type 2 Diabetes Mellitus",
  "Type 1 Diabetes Mellitus",
  "Essential Hypertension",
  "Asthma",
  "Chronic Obstructive Pulmonary Disease (COPD)",
  "Major Depressive Disorder",
  "Generalized Anxiety Disorder",
  "Hypothyroidism",
  "Hyperthyroidism",
  "Hyperlipidemia",
  "Gastroesophageal Reflux Disease (GERD)",
  "Osteoarthritis",
  "Rheumatoid Arthritis",
  "Chronic Kidney Disease",
  "Coronary Artery Disease",
  "Congestive Heart Failure",
  "Atrial Fibrillation",
  "Deep Vein Thrombosis",
  "Pulmonary Embolism",
  "Chronic Pain Syndrome",
  "Fibromyalgia",
  "Migraine",
  "Epilepsy",
  "Multiple Sclerosis",
  "Parkinson's Disease",
  "Alzheimer's Disease",
  "Bipolar Disorder",
  "Schizophrenia",
  "Post-Traumatic Stress Disorder (PTSD)",
  "Obsessive-Compulsive Disorder (OCD)",
  "Attention Deficit Hyperactivity Disorder (ADHD)",
  "Autism Spectrum Disorder",
  "Irritable Bowel Syndrome (IBS)",
  "Crohn's Disease",
  "Ulcerative Colitis",
  "Celiac Disease",
  "Chronic Liver Disease",
  "Cirrhosis",
  "Hepatitis B",
  "Hepatitis C",
  "HIV/AIDS",
  "Systemic Lupus Erythematosus",
  "Psoriasis",
  "Eczema (Atopic Dermatitis)",
  "Chronic Urticaria",
  "Anemia (Iron Deficiency)",
  "Sickle Cell Disease",
  "Hemophilia",
  "Polycystic Ovary Syndrome (PCOS)",
  "Endometriosis",
  "Benign Prostatic Hyperplasia (BPH)",
  "Erectile Dysfunction",
  "Urinary Tract Infection (Recurrent)",
  "Chronic Sinusitis",
  "Sleep Apnea",
  "Insomnia Disorder",
  "Restless Leg Syndrome",
  "Gout",
  "Osteoporosis",
  "Vitamin D Deficiency",
  "Iron Deficiency",
  "Thyroid Nodules",
  "Peripheral Neuropathy",
  "Carpal Tunnel Syndrome",
  "Herniated Disc",
  "Spinal Stenosis",
  "Scoliosis",
  "Glaucoma",
  "Macular Degeneration",
  "Cataracts",
  "Tinnitus",
  "Hearing Loss",
  "Chronic Bronchitis",
  "Pneumonia (Recurrent)",
  "Tuberculosis",
  "Obesity",
  "Metabolic Syndrome",
  "Prediabetes",
  "Gestational Diabetes",
  "Preeclampsia",
  "Aortic Stenosis",
  "Mitral Valve Prolapse",
  "Peripheral Arterial Disease",
];

export const ALLERGIES: string[] = [
  "Penicillin",
  "Amoxicillin",
  "Ampicillin",
  "Sulfa Drugs (Sulfonamides)",
  "Sulfamethoxazole/Trimethoprim",
  "Aspirin",
  "Ibuprofen",
  "Naproxen",
  "Codeine",
  "Morphine",
  "Hydrocodone",
  "Oxycodone",
  "Tramadol",
  "Cephalosporins",
  "Ciprofloxacin",
  "Levofloxacin",
  "Erythromycin",
  "Azithromycin",
  "Tetracycline",
  "Doxycycline",
  "Metronidazole",
  "Vancomycin",
  "Nitrofurantoin",
  "Phenytoin",
  "Carbamazepine",
  "Lamotrigine",
  "ACE Inhibitors",
  "Lisinopril",
  "Statins",
  "Metformin",
  "Insulin",
  "Contrast Dye (Iodine)",
  "Latex",
  "Adhesive/Tape",
  "Peanuts",
  "Tree Nuts",
  "Shellfish",
  "Fish",
  "Eggs",
  "Dairy/Lactose",
  "Soy",
  "Wheat/Gluten",
  "Sesame",
  "Corn",
  "Strawberries",
  "Bananas",
  "Avocado",
  "Kiwi",
  "Mango",
  "Pollen",
  "Dust Mites",
  "Mold",
  "Cat Dander",
  "Dog Dander",
  "Bee Stings",
  "Wasp Stings",
  "Fire Ant Stings",
  "Cockroach",
  "Nickel",
  "Chromium",
];

export const SURGERIES: string[] = [
  "Appendectomy",
  "Cholecystectomy (Gallbladder Removal)",
  "Cesarean Section (C-Section)",
  "Coronary Artery Bypass Graft (CABG)",
  "Total Knee Replacement",
  "Total Hip Replacement",
  "Partial Knee Replacement",
  "Tonsillectomy",
  "Adenoidectomy",
  "Hernia Repair (Inguinal)",
  "Hernia Repair (Umbilical)",
  "Hernia Repair (Hiatal)",
  "Cataract Surgery",
  "LASIK Eye Surgery",
  "Hysterectomy",
  "Mastectomy",
  "Lumpectomy",
  "Prostatectomy",
  "Thyroidectomy",
  "Parathyroidectomy",
  "Spinal Fusion",
  "Laminectomy",
  "Discectomy",
  "Rotator Cuff Repair",
  "ACL Reconstruction",
  "Meniscus Repair",
  "Carpal Tunnel Release",
  "Trigger Finger Release",
  "Coronary Angioplasty/Stent Placement",
  "Pacemaker Implantation",
  "Defibrillator (ICD) Implantation",
  "Heart Valve Replacement",
  "Carotid Endarterectomy",
  "Aortic Aneurysm Repair",
  "Gastric Bypass Surgery",
  "Gastric Sleeve Surgery",
  "Colectomy",
  "Colonoscopy with Polypectomy",
  "Endoscopy (Upper GI)",
  "Laparoscopic Nissen Fundoplication",
  "Kidney Transplant",
  "Liver Transplant",
  "Lung Transplant",
  "Nephrectomy",
  "Cystoscopy",
  "Vasectomy",
  "Tubal Ligation",
  "Dilation and Curettage (D&C)",
  "Skin Lesion Excision",
  "Septoplasty",
];

export const SYMPTOMS: string[] = [
  "Headache",
  "Chest Pain",
  "Shortness of Breath",
  "Fatigue",
  "Nausea",
  "Vomiting",
  "Dizziness",
  "Back Pain",
  "Joint Pain",
  "Abdominal Pain",
  "Insomnia",
  "Fever",
  "Chills",
  "Cough",
  "Sore Throat",
  "Runny Nose",
  "Nasal Congestion",
  "Sneezing",
  "Wheezing",
  "Palpitations",
  "Swelling (Edema)",
  "Numbness",
  "Tingling",
  "Weakness",
  "Muscle Pain",
  "Muscle Cramps",
  "Stiffness",
  "Weight Loss (Unintentional)",
  "Weight Gain",
  "Loss of Appetite",
  "Increased Appetite",
  "Excessive Thirst",
  "Frequent Urination",
  "Painful Urination",
  "Blood in Urine",
  "Constipation",
  "Diarrhea",
  "Bloating",
  "Heartburn",
  "Difficulty Swallowing",
  "Blurred Vision",
  "Double Vision",
  "Eye Pain",
  "Ear Pain",
  "Hearing Loss",
  "Ringing in Ears (Tinnitus)",
  "Skin Rash",
  "Itching",
  "Bruising",
  "Night Sweats",
  "Hot Flashes",
  "Cold Intolerance",
  "Heat Intolerance",
  "Hair Loss",
  "Dry Mouth",
  "Excessive Sweating",
  "Anxiety",
  "Depression",
  "Memory Loss",
  "Confusion",
  "Seizures",
  "Tremor",
];

export const REACTIONS: string[] = [
  "Hives (Urticaria)",
  "Swelling (Angioedema)",
  "Anaphylaxis",
  "Rash",
  "Itching (Pruritus)",
  "Difficulty Breathing",
  "Wheezing",
  "Throat Tightness",
  "Tongue Swelling",
  "Nausea/Vomiting",
  "Diarrhea",
  "Abdominal Cramps",
  "Dizziness/Lightheadedness",
  "Drop in Blood Pressure",
  "Rapid Heartbeat",
  "Skin Flushing",
  "Eczema Flare",
  "Contact Dermatitis",
  "Blistering",
  "Peeling Skin",
  "Stevens-Johnson Syndrome",
  "Serum Sickness",
  "Drug Fever",
  "Photosensitivity",
  "Joint Pain/Swelling",
  "Headache",
  "Runny Nose",
  "Watery Eyes",
  "Sneezing",
  "Coughing",
];

export const FAMILY_CONDITIONS: string[] = [
  "Heart Disease",
  "Diabetes (Type 2)",
  "Diabetes (Type 1)",
  "Cancer (Breast)",
  "Cancer (Colon)",
  "Cancer (Lung)",
  "Cancer (Prostate)",
  "Cancer (Ovarian)",
  "Cancer (Pancreatic)",
  "Cancer (Skin/Melanoma)",
  "High Blood Pressure (Hypertension)",
  "Stroke",
  "Alzheimer's Disease",
  "Dementia",
  "Parkinson's Disease",
  "Multiple Sclerosis",
  "Epilepsy",
  "Asthma",
  "COPD",
  "Cystic Fibrosis",
  "Sickle Cell Disease",
  "Hemophilia",
  "Thalassemia",
  "High Cholesterol",
  "Obesity",
  "Thyroid Disease",
  "Autoimmune Disorders",
  "Lupus",
  "Rheumatoid Arthritis",
  "Celiac Disease",
  "Crohn's Disease",
  "Ulcerative Colitis",
  "Kidney Disease",
  "Polycystic Kidney Disease",
  "Osteoporosis",
  "Depression",
  "Bipolar Disorder",
  "Schizophrenia",
  "Alcoholism/Substance Abuse",
  "Glaucoma",
  "Macular Degeneration",
];

const CATEGORY_MAP: Record<string, string[]> = {
  conditions: CONDITIONS,
  allergies: ALLERGIES,
  surgeries: SURGERIES,
  symptoms: SYMPTOMS,
  reactions: REACTIONS,
  family_conditions: FAMILY_CONDITIONS,
};

export function searchMedicalTerms(category: string, query: string, limit: number = 8): string[] {
  const terms = CATEGORY_MAP[category];
  if (!terms) return [];

  const q = query.toLowerCase().trim();
  if (!q) return terms.slice(0, limit);

  const startsWithMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const term of terms) {
    const lower = term.toLowerCase();
    if (lower.startsWith(q)) {
      startsWithMatches.push(term);
    } else if (lower.includes(q)) {
      containsMatches.push(term);
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, limit);
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  overallStatus: 'valid' | 'warnings' | 'errors';
  disclaimer: string;
}

const VALIDATION_DISCLAIMER = "This AI validation is for informational purposes only and does not constitute medical advice. Please consult your healthcare provider.";

export async function validateIntakeData(data: {
  medicalHistory?: any;
  allergies?: any;
  medications?: any;
  demographics?: any;
}): Promise<ValidationResult> {
  console.log("[MedicalAutocomplete] Validating intake data with AI");

  const systemPrompt = `You are a clinical data validation AI assistant. Analyze the provided patient intake data and identify potential issues.

Check for:
1. Potential drug interactions between listed medications
2. Inconsistencies (e.g., allergy to a drug that's also listed as a current medication)
3. Missing information that would be clinically important
4. Unusual combinations or potential data entry errors
5. Medications that may be contraindicated given listed conditions

For each issue found, classify it as:
- "error": Critical issues that need immediate attention (e.g., taking a medication they're allergic to)
- "warning": Important concerns that should be reviewed (e.g., potential drug interactions)
- "info": Suggestions or informational notes (e.g., missing optional but useful information)

Respond in JSON format:
{
  "issues": [
    {
      "type": "error" | "warning" | "info",
      "field": "specific field reference (e.g., medications[0].name, allergies[1].allergen)",
      "message": "clear description of the issue",
      "suggestion": "optional suggestion for resolution"
    }
  ],
  "overallStatus": "valid" | "warnings" | "errors"
}

Set overallStatus to:
- "errors" if any issues have type "error"
- "warnings" if no errors but there are warnings
- "valid" if no errors or warnings (info items are acceptable)`;

  const userPrompt = `Please validate the following patient intake data:

${JSON.stringify(data, null, 2)}`;

  const response = await chatComplete({
    model: "balanced",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    jsonMode: true,
    maxOutputTokens: 4096,
    dataCategories: ["demographics", "conditions", "medications", "allergies", "contact_info"],
    purpose: "documentation",
    callerService: "medical-autocomplete-service",
    callerMethod: "validateIntakeData",
  });

  const content = response.content;
  if (!content) {
    throw new Error("[MedicalAutocomplete] No response from AI for intake validation");
  }

  const parsed = JSON.parse(content);

  console.log(`[MedicalAutocomplete] Validation complete: ${parsed.issues?.length || 0} issues found, status: ${parsed.overallStatus}`);

  return {
    issues: parsed.issues || [],
    overallStatus: parsed.overallStatus || "valid",
    disclaimer: VALIDATION_DISCLAIMER,
  };
}
