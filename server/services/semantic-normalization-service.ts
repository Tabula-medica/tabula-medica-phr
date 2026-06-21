/**
 * Semantic Normalization Service
 * Maps heterogeneous clinical data to standardized terminology codes
 * Supports LOINC for labs, RxNorm for medications, SNOMED CT for conditions
 */

import { logPhiAccess } from "../security/hipaa-audit";

export interface LoincMapping {
  loincCode: string;
  displayName: string;
  component: string;
  category: string;
  aliases: string[];
  unit?: string;
}

export interface RxNormMapping {
  rxcui: string;
  displayName: string;
  brandNames: string[];
  genericNames: string[];
  ingredients: string[];
  drugClass?: string;
}

export interface SnomedMapping {
  snomedCode: string;
  displayName: string;
  category: string;
  aliases: string[];
}

export interface NormalizedLabResult {
  loincCode: string;
  displayName: string;
  category: string;
  value: number;
  unit: string;
  normalizedUnit: string;
  effectiveDate: string;
  source: string;
  originalDisplay?: string;
}

export interface NormalizedMedication {
  rxcui: string;
  displayName: string;
  genericName: string;
  drugClass: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "stopped";
  source: string;
  dosage?: string;
  frequency?: string;
  originalDisplay?: string;
}

export interface NormalizedCondition {
  snomedCode: string;
  displayName: string;
  category: string;
  onsetDate?: string;
  abatementDate?: string;
  clinicalStatus: string;
  source: string;
  originalDisplay?: string;
}

const loincMappings: LoincMapping[] = [
  {
    loincCode: "2339-0",
    displayName: "Blood Glucose",
    component: "Glucose",
    category: "Chemistry",
    aliases: ["Bld Gluc", "Serum Glucose", "Glucose Blood", "Blood Sugar", "FBS", "Fasting Blood Sugar", "Random Blood Sugar", "RBS"],
    unit: "mg/dL"
  },
  {
    loincCode: "4548-4",
    displayName: "Hemoglobin A1c",
    component: "Hemoglobin A1c/Hemoglobin.total",
    category: "Chemistry",
    aliases: ["HbA1c", "A1C", "Glycated Hemoglobin", "Glycohemoglobin", "HgbA1c", "HBA1C Test"],
    unit: "%"
  },
  {
    loincCode: "8480-6",
    displayName: "Systolic Blood Pressure",
    component: "Systolic blood pressure",
    category: "Vital Signs",
    aliases: ["SBP", "Systolic BP", "Systolic", "BP Systolic"],
    unit: "mmHg"
  },
  {
    loincCode: "8462-4",
    displayName: "Diastolic Blood Pressure",
    component: "Diastolic blood pressure",
    category: "Vital Signs",
    aliases: ["DBP", "Diastolic BP", "Diastolic", "BP Diastolic"],
    unit: "mmHg"
  },
  {
    loincCode: "8867-4",
    displayName: "Heart Rate",
    component: "Heart rate",
    category: "Vital Signs",
    aliases: ["HR", "Pulse", "Pulse Rate", "Heart Beat", "Cardiac Rate"],
    unit: "beats/min"
  },
  {
    loincCode: "29463-7",
    displayName: "Body Weight",
    component: "Body weight",
    category: "Vital Signs",
    aliases: ["Weight", "Wt", "Body Wt", "Patient Weight"],
    unit: "kg"
  },
  {
    loincCode: "8302-2",
    displayName: "Body Height",
    component: "Body height",
    category: "Vital Signs",
    aliases: ["Height", "Ht", "Stature", "Patient Height"],
    unit: "cm"
  },
  {
    loincCode: "39156-5",
    displayName: "Body Mass Index",
    component: "Body mass index",
    category: "Vital Signs",
    aliases: ["BMI", "Body Mass", "Mass Index"],
    unit: "kg/m2"
  },
  {
    loincCode: "2093-3",
    displayName: "Total Cholesterol",
    component: "Cholesterol",
    category: "Chemistry",
    aliases: ["Cholesterol", "Chol", "TC", "Total Chol", "Serum Cholesterol"],
    unit: "mg/dL"
  },
  {
    loincCode: "2085-9",
    displayName: "HDL Cholesterol",
    component: "Cholesterol in HDL",
    category: "Chemistry",
    aliases: ["HDL", "HDL-C", "Good Cholesterol", "High Density Lipoprotein"],
    unit: "mg/dL"
  },
  {
    loincCode: "2089-1",
    displayName: "LDL Cholesterol",
    component: "Cholesterol in LDL",
    category: "Chemistry",
    aliases: ["LDL", "LDL-C", "Bad Cholesterol", "Low Density Lipoprotein"],
    unit: "mg/dL"
  },
  {
    loincCode: "2571-8",
    displayName: "Triglycerides",
    component: "Triglycerides",
    category: "Chemistry",
    aliases: ["TG", "Trigs", "Triglyceride", "Serum Triglycerides"],
    unit: "mg/dL"
  },
  {
    loincCode: "2160-0",
    displayName: "Creatinine",
    component: "Creatinine",
    category: "Chemistry",
    aliases: ["Creat", "Serum Creatinine", "SCr", "Blood Creatinine"],
    unit: "mg/dL"
  },
  {
    loincCode: "33914-3",
    displayName: "eGFR",
    component: "Glomerular filtration rate/1.73 sq M.predicted",
    category: "Chemistry",
    aliases: ["GFR", "Estimated GFR", "Glomerular Filtration Rate", "Kidney Function"],
    unit: "mL/min/1.73m2"
  },
  {
    loincCode: "6299-2",
    displayName: "Urea Nitrogen",
    component: "Urea nitrogen",
    category: "Chemistry",
    aliases: ["BUN", "Blood Urea Nitrogen", "Urea", "Serum BUN"],
    unit: "mg/dL"
  },
  {
    loincCode: "718-7",
    displayName: "Hemoglobin",
    component: "Hemoglobin",
    category: "Hematology",
    aliases: ["Hgb", "Hb", "Blood Hemoglobin"],
    unit: "g/dL"
  },
  {
    loincCode: "4544-3",
    displayName: "Hematocrit",
    component: "Hematocrit",
    category: "Hematology",
    aliases: ["Hct", "HCT", "Packed Cell Volume", "PCV"],
    unit: "%"
  },
  {
    loincCode: "777-3",
    displayName: "Platelet Count",
    component: "Platelets",
    category: "Hematology",
    aliases: ["Platelets", "PLT", "Thrombocyte Count", "Platelet"],
    unit: "10*3/uL"
  },
  {
    loincCode: "6690-2",
    displayName: "White Blood Cell Count",
    component: "Leukocytes",
    category: "Hematology",
    aliases: ["WBC", "White Blood Cells", "Leukocyte Count", "White Cell Count"],
    unit: "10*3/uL"
  },
  {
    loincCode: "59260-0",
    displayName: "Oxygen Saturation",
    component: "Oxygen saturation in Arterial blood by Pulse oximetry",
    category: "Vital Signs",
    aliases: ["SpO2", "O2 Sat", "Pulse Ox", "Oxygen Sat", "SaO2"],
    unit: "%"
  },
  {
    loincCode: "8310-5",
    displayName: "Body Temperature",
    component: "Body temperature",
    category: "Vital Signs",
    aliases: ["Temp", "Temperature", "Body Temp", "Patient Temperature"],
    unit: "°C"
  }
];

const rxnormMappings: RxNormMapping[] = [
  {
    rxcui: "6809",
    displayName: "Metformin",
    brandNames: ["Glucophage", "Fortamet", "Glumetza", "Riomet"],
    genericNames: ["Metformin", "Metformin HCl", "Metformin Hydrochloride"],
    ingredients: ["Metformin"],
    drugClass: "Antidiabetic"
  },
  {
    rxcui: "161",
    displayName: "Acetaminophen",
    brandNames: ["Tylenol", "Panadol", "Excedrin", "Mapap"],
    genericNames: ["Acetaminophen", "Paracetamol", "APAP"],
    ingredients: ["Acetaminophen"],
    drugClass: "Analgesic"
  },
  {
    rxcui: "5640",
    displayName: "Ibuprofen",
    brandNames: ["Advil", "Motrin", "Nuprin", "Caldolor"],
    genericNames: ["Ibuprofen"],
    ingredients: ["Ibuprofen"],
    drugClass: "NSAID"
  },
  {
    rxcui: "29046",
    displayName: "Lisinopril",
    brandNames: ["Zestril", "Prinivil", "Qbrelis"],
    genericNames: ["Lisinopril"],
    ingredients: ["Lisinopril"],
    drugClass: "ACE Inhibitor"
  },
  {
    rxcui: "2403",
    displayName: "Atorvastatin",
    brandNames: ["Lipitor"],
    genericNames: ["Atorvastatin", "Atorvastatin Calcium"],
    ingredients: ["Atorvastatin"],
    drugClass: "Statin"
  },
  {
    rxcui: "83367",
    displayName: "Amlodipine",
    brandNames: ["Norvasc", "Katerzia"],
    genericNames: ["Amlodipine", "Amlodipine Besylate"],
    ingredients: ["Amlodipine"],
    drugClass: "Calcium Channel Blocker"
  },
  {
    rxcui: "10582",
    displayName: "Omeprazole",
    brandNames: ["Prilosec", "Zegerid"],
    genericNames: ["Omeprazole"],
    ingredients: ["Omeprazole"],
    drugClass: "Proton Pump Inhibitor"
  },
  {
    rxcui: "7052",
    displayName: "Losartan",
    brandNames: ["Cozaar"],
    genericNames: ["Losartan", "Losartan Potassium"],
    ingredients: ["Losartan"],
    drugClass: "ARB"
  },
  {
    rxcui: "4815",
    displayName: "Gabapentin",
    brandNames: ["Neurontin", "Gralise", "Horizant"],
    genericNames: ["Gabapentin"],
    ingredients: ["Gabapentin"],
    drugClass: "Anticonvulsant"
  },
  {
    rxcui: "36567",
    displayName: "Simvastatin",
    brandNames: ["Zocor", "FloLipid"],
    genericNames: ["Simvastatin"],
    ingredients: ["Simvastatin"],
    drugClass: "Statin"
  },
  {
    rxcui: "8787",
    displayName: "Prednisone",
    brandNames: ["Deltasone", "Rayos", "Sterapred"],
    genericNames: ["Prednisone"],
    ingredients: ["Prednisone"],
    drugClass: "Corticosteroid"
  },
  {
    rxcui: "42316",
    displayName: "Hydrochlorothiazide",
    brandNames: ["Microzide", "Oretic"],
    genericNames: ["Hydrochlorothiazide", "HCTZ"],
    ingredients: ["Hydrochlorothiazide"],
    drugClass: "Diuretic"
  },
  {
    rxcui: "4337",
    displayName: "Fluoxetine",
    brandNames: ["Prozac", "Sarafem", "Selfemra"],
    genericNames: ["Fluoxetine", "Fluoxetine HCl"],
    ingredients: ["Fluoxetine"],
    drugClass: "SSRI"
  },
  {
    rxcui: "32968",
    displayName: "Sertraline",
    brandNames: ["Zoloft"],
    genericNames: ["Sertraline", "Sertraline HCl"],
    ingredients: ["Sertraline"],
    drugClass: "SSRI"
  },
  {
    rxcui: "8183",
    displayName: "Pantoprazole",
    brandNames: ["Protonix"],
    genericNames: ["Pantoprazole", "Pantoprazole Sodium"],
    ingredients: ["Pantoprazole"],
    drugClass: "Proton Pump Inhibitor"
  },
  {
    rxcui: "5032",
    displayName: "Insulin Glargine",
    brandNames: ["Lantus", "Basaglar", "Toujeo"],
    genericNames: ["Insulin Glargine"],
    ingredients: ["Insulin Glargine"],
    drugClass: "Insulin"
  },
  {
    rxcui: "86009",
    displayName: "Insulin Lispro",
    brandNames: ["Humalog", "Admelog", "Lyumjev"],
    genericNames: ["Insulin Lispro"],
    ingredients: ["Insulin Lispro"],
    drugClass: "Insulin"
  }
];

const snomedMappings: SnomedMapping[] = [
  {
    snomedCode: "44054006",
    displayName: "Type 2 Diabetes Mellitus",
    category: "Endocrine",
    aliases: ["Type 2 Diabetes", "T2DM", "Diabetes Type 2", "Adult-Onset Diabetes", "Non-Insulin Dependent Diabetes"]
  },
  {
    snomedCode: "38341003",
    displayName: "Essential Hypertension",
    category: "Cardiovascular",
    aliases: ["Hypertension", "High Blood Pressure", "HTN", "Primary Hypertension"]
  },
  {
    snomedCode: "55822004",
    displayName: "Hyperlipidemia",
    category: "Metabolic",
    aliases: ["High Cholesterol", "Dyslipidemia", "Elevated Lipids", "Cholesterol Disorder"]
  },
  {
    snomedCode: "195967001",
    displayName: "Asthma",
    category: "Respiratory",
    aliases: ["Bronchial Asthma", "Reactive Airway Disease"]
  },
  {
    snomedCode: "13645005",
    displayName: "Chronic Obstructive Pulmonary Disease",
    category: "Respiratory",
    aliases: ["COPD", "Chronic Obstructive Lung Disease", "Emphysema", "Chronic Bronchitis"]
  },
  {
    snomedCode: "84114007",
    displayName: "Heart Failure",
    category: "Cardiovascular",
    aliases: ["CHF", "Congestive Heart Failure", "Cardiac Failure", "HF"]
  },
  {
    snomedCode: "22298006",
    displayName: "Myocardial Infarction",
    category: "Cardiovascular",
    aliases: ["Heart Attack", "MI", "Acute MI", "AMI"]
  },
  {
    snomedCode: "230690007",
    displayName: "Cerebrovascular Accident",
    category: "Neurological",
    aliases: ["Stroke", "CVA", "Brain Attack"]
  },
  {
    snomedCode: "90708001",
    displayName: "Chronic Kidney Disease",
    category: "Renal",
    aliases: ["CKD", "Chronic Renal Disease", "Kidney Failure", "Renal Insufficiency"]
  },
  {
    snomedCode: "35489007",
    displayName: "Major Depressive Disorder",
    category: "Psychiatric",
    aliases: ["Depression", "MDD", "Clinical Depression", "Major Depression"]
  },
  {
    snomedCode: "197480006",
    displayName: "Anxiety Disorder",
    category: "Psychiatric",
    aliases: ["Anxiety", "GAD", "Generalized Anxiety", "Panic Disorder"]
  },
  {
    snomedCode: "396275006",
    displayName: "Osteoarthritis",
    category: "Musculoskeletal",
    aliases: ["OA", "Degenerative Joint Disease", "DJD", "Wear and Tear Arthritis"]
  },
  {
    snomedCode: "69896004",
    displayName: "Rheumatoid Arthritis",
    category: "Musculoskeletal",
    aliases: ["RA", "Rheumatoid", "Inflammatory Arthritis"]
  },
  {
    snomedCode: "64859006",
    displayName: "Osteoporosis",
    category: "Musculoskeletal",
    aliases: ["Bone Loss", "Brittle Bones", "Low Bone Density"]
  },
  {
    snomedCode: "40930008",
    displayName: "Hypothyroidism",
    category: "Endocrine",
    aliases: ["Underactive Thyroid", "Low Thyroid", "Hashimoto's"]
  }
];

export function normalizeLoincCode(inputText: string): LoincMapping | null {
  const normalizedInput = inputText.toLowerCase().trim();
  
  for (const mapping of loincMappings) {
    if (mapping.loincCode === inputText) return mapping;
    if (mapping.displayName.toLowerCase() === normalizedInput) return mapping;
    if (mapping.component.toLowerCase() === normalizedInput) return mapping;
    
    for (const alias of mapping.aliases) {
      if (alias.toLowerCase() === normalizedInput) return mapping;
      if (normalizedInput.includes(alias.toLowerCase())) return mapping;
    }
  }
  
  return null;
}

export function normalizeRxNormCode(inputText: string): RxNormMapping | null {
  const normalizedInput = inputText.toLowerCase().trim();
  
  for (const mapping of rxnormMappings) {
    if (mapping.rxcui === inputText) return mapping;
    if (mapping.displayName.toLowerCase() === normalizedInput) return mapping;
    
    for (const brandName of mapping.brandNames) {
      if (brandName.toLowerCase() === normalizedInput) return mapping;
      if (normalizedInput.includes(brandName.toLowerCase())) return mapping;
    }
    
    for (const genericName of mapping.genericNames) {
      if (genericName.toLowerCase() === normalizedInput) return mapping;
      if (normalizedInput.includes(genericName.toLowerCase())) return mapping;
    }
  }
  
  return null;
}

export function normalizeSnomedCode(inputText: string): SnomedMapping | null {
  const normalizedInput = inputText.toLowerCase().trim();
  
  for (const mapping of snomedMappings) {
    if (mapping.snomedCode === inputText) return mapping;
    if (mapping.displayName.toLowerCase() === normalizedInput) return mapping;
    
    for (const alias of mapping.aliases) {
      if (alias.toLowerCase() === normalizedInput) return mapping;
      if (normalizedInput.includes(alias.toLowerCase())) return mapping;
    }
  }
  
  return null;
}

export function getLoincMapping(loincCode: string): LoincMapping | null {
  return loincMappings.find(m => m.loincCode === loincCode) || null;
}

export function getRxNormMapping(rxcui: string): RxNormMapping | null {
  return rxnormMappings.find(m => m.rxcui === rxcui) || null;
}

export function getSnomedMapping(snomedCode: string): SnomedMapping | null {
  return snomedMappings.find(m => m.snomedCode === snomedCode) || null;
}

export function getAllLoincMappings(): LoincMapping[] {
  return [...loincMappings];
}

export function getAllRxNormMappings(): RxNormMapping[] {
  return [...rxnormMappings];
}

export function getAllSnomedMappings(): SnomedMapping[] {
  return [...snomedMappings];
}

export function normalizeLabResult(
  inputDisplay: string,
  value: number,
  unit: string,
  effectiveDate: string,
  source: string
): NormalizedLabResult | null {
  const mapping = normalizeLoincCode(inputDisplay);
  if (!mapping) return null;
  
  return {
    loincCode: mapping.loincCode,
    displayName: mapping.displayName,
    category: mapping.category,
    value,
    unit,
    normalizedUnit: mapping.unit || unit,
    effectiveDate,
    source,
    originalDisplay: inputDisplay
  };
}

export function normalizeMedication(
  inputDisplay: string,
  startDate: string,
  endDate: string | undefined,
  status: "active" | "completed" | "stopped",
  source: string,
  dosage?: string,
  frequency?: string
): NormalizedMedication | null {
  const mapping = normalizeRxNormCode(inputDisplay);
  if (!mapping) return null;
  
  return {
    rxcui: mapping.rxcui,
    displayName: mapping.displayName,
    genericName: mapping.genericNames[0] || mapping.displayName,
    drugClass: mapping.drugClass || "Unknown",
    startDate,
    endDate,
    status,
    source,
    dosage,
    frequency,
    originalDisplay: inputDisplay
  };
}

export function normalizeCondition(
  inputDisplay: string,
  onsetDate: string | undefined,
  abatementDate: string | undefined,
  clinicalStatus: string,
  source: string
): NormalizedCondition | null {
  const mapping = normalizeSnomedCode(inputDisplay);
  if (!mapping) return null;
  
  return {
    snomedCode: mapping.snomedCode,
    displayName: mapping.displayName,
    category: mapping.category,
    onsetDate,
    abatementDate,
    clinicalStatus,
    source,
    originalDisplay: inputDisplay
  };
}

export function groupLabResultsByCode(results: NormalizedLabResult[]): Map<string, NormalizedLabResult[]> {
  const grouped = new Map<string, NormalizedLabResult[]>();
  
  for (const result of results) {
    const existing = grouped.get(result.loincCode) || [];
    existing.push(result);
    grouped.set(result.loincCode, existing);
  }
  
  grouped.forEach((labResults: NormalizedLabResult[]) => {
    labResults.sort((a: NormalizedLabResult, b: NormalizedLabResult) => 
      new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    );
  });
  
  return grouped;
}

export function groupMedicationsByGeneric(medications: NormalizedMedication[]): Map<string, NormalizedMedication[]> {
  const grouped = new Map<string, NormalizedMedication[]>();
  
  for (const med of medications) {
    const existing = grouped.get(med.rxcui) || [];
    existing.push(med);
    grouped.set(med.rxcui, existing);
  }
  
  grouped.forEach((meds: NormalizedMedication[]) => {
    meds.sort((a: NormalizedMedication, b: NormalizedMedication) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  });
  
  return grouped;
}

export function logNormalizationAccess(
  patientId: string,
  userId: string,
  dataTypes: string[]
): void {
  logPhiAccess({
    userId,
    patientId,
    action: "read",
    resourceType: "NormalizedData",
    details: `Accessed normalized ${dataTypes.join(", ")} data`
  });
}
