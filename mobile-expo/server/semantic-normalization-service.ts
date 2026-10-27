/**
 * Semantic Normalization Service
 * Maps clinical terms from different sources to unified standardized terminology
 * Uses LOINC for labs and RxNorm for medications
 */

// LOINC Lab Mappings - Common lab tests mapped to unified display names
export const LOINC_LAB_MAPPINGS: Record<string, { displayName: string; category: string; unit: string; loincCode: string }> = {
  // Blood Sugar / Glucose
  "blood glucose": { displayName: "Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "2345-7" },
  "bld gluc": { displayName: "Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "2345-7" },
  "serum glucose": { displayName: "Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "2345-7" },
  "fasting glucose": { displayName: "Fasting Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "1558-6" },
  "glucose, fasting": { displayName: "Fasting Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "1558-6" },
  "blood sugar": { displayName: "Blood Sugar", category: "metabolic", unit: "mg/dL", loincCode: "2345-7" },
  
  // Hemoglobin A1C
  "hemoglobin a1c": { displayName: "A1C", category: "metabolic", unit: "%", loincCode: "4548-4" },
  "hba1c": { displayName: "A1C", category: "metabolic", unit: "%", loincCode: "4548-4" },
  "a1c": { displayName: "A1C", category: "metabolic", unit: "%", loincCode: "4548-4" },
  "glycated hemoglobin": { displayName: "A1C", category: "metabolic", unit: "%", loincCode: "4548-4" },
  
  // Cholesterol
  "total cholesterol": { displayName: "Total Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2093-3" },
  "cholesterol": { displayName: "Total Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2093-3" },
  "ldl cholesterol": { displayName: "LDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2089-1" },
  "ldl": { displayName: "LDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2089-1" },
  "ldl-c": { displayName: "LDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2089-1" },
  "hdl cholesterol": { displayName: "HDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2085-9" },
  "hdl": { displayName: "HDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2085-9" },
  "hdl-c": { displayName: "HDL Cholesterol", category: "lipids", unit: "mg/dL", loincCode: "2085-9" },
  "triglycerides": { displayName: "Triglycerides", category: "lipids", unit: "mg/dL", loincCode: "2571-8" },
  "trigs": { displayName: "Triglycerides", category: "lipids", unit: "mg/dL", loincCode: "2571-8" },
  
  // Blood Pressure (typically vital, but sometimes in labs)
  "systolic blood pressure": { displayName: "Systolic BP", category: "vitals", unit: "mmHg", loincCode: "8480-6" },
  "systolic bp": { displayName: "Systolic BP", category: "vitals", unit: "mmHg", loincCode: "8480-6" },
  "diastolic blood pressure": { displayName: "Diastolic BP", category: "vitals", unit: "mmHg", loincCode: "8462-4" },
  "diastolic bp": { displayName: "Diastolic BP", category: "vitals", unit: "mmHg", loincCode: "8462-4" },
  
  // Complete Blood Count
  "white blood cell count": { displayName: "WBC", category: "hematology", unit: "K/uL", loincCode: "6690-2" },
  "wbc": { displayName: "WBC", category: "hematology", unit: "K/uL", loincCode: "6690-2" },
  "leukocytes": { displayName: "WBC", category: "hematology", unit: "K/uL", loincCode: "6690-2" },
  "red blood cell count": { displayName: "RBC", category: "hematology", unit: "M/uL", loincCode: "789-8" },
  "rbc": { displayName: "RBC", category: "hematology", unit: "M/uL", loincCode: "789-8" },
  "erythrocytes": { displayName: "RBC", category: "hematology", unit: "M/uL", loincCode: "789-8" },
  "hemoglobin": { displayName: "Hemoglobin", category: "hematology", unit: "g/dL", loincCode: "718-7" },
  "hgb": { displayName: "Hemoglobin", category: "hematology", unit: "g/dL", loincCode: "718-7" },
  "hematocrit": { displayName: "Hematocrit", category: "hematology", unit: "%", loincCode: "4544-3" },
  "hct": { displayName: "Hematocrit", category: "hematology", unit: "%", loincCode: "4544-3" },
  "platelets": { displayName: "Platelets", category: "hematology", unit: "K/uL", loincCode: "777-3" },
  "platelet count": { displayName: "Platelets", category: "hematology", unit: "K/uL", loincCode: "777-3" },
  
  // Kidney Function
  "creatinine": { displayName: "Creatinine", category: "renal", unit: "mg/dL", loincCode: "2160-0" },
  "serum creatinine": { displayName: "Creatinine", category: "renal", unit: "mg/dL", loincCode: "2160-0" },
  "bun": { displayName: "BUN", category: "renal", unit: "mg/dL", loincCode: "3094-0" },
  "blood urea nitrogen": { displayName: "BUN", category: "renal", unit: "mg/dL", loincCode: "3094-0" },
  "egfr": { displayName: "eGFR", category: "renal", unit: "mL/min/1.73m2", loincCode: "33914-3" },
  "estimated gfr": { displayName: "eGFR", category: "renal", unit: "mL/min/1.73m2", loincCode: "33914-3" },
  
  // Liver Function
  "alt": { displayName: "ALT", category: "hepatic", unit: "U/L", loincCode: "1742-6" },
  "alanine aminotransferase": { displayName: "ALT", category: "hepatic", unit: "U/L", loincCode: "1742-6" },
  "sgpt": { displayName: "ALT", category: "hepatic", unit: "U/L", loincCode: "1742-6" },
  "ast": { displayName: "AST", category: "hepatic", unit: "U/L", loincCode: "1920-8" },
  "aspartate aminotransferase": { displayName: "AST", category: "hepatic", unit: "U/L", loincCode: "1920-8" },
  "sgot": { displayName: "AST", category: "hepatic", unit: "U/L", loincCode: "1920-8" },
  "bilirubin": { displayName: "Bilirubin", category: "hepatic", unit: "mg/dL", loincCode: "1975-2" },
  "total bilirubin": { displayName: "Bilirubin", category: "hepatic", unit: "mg/dL", loincCode: "1975-2" },
  
  // Thyroid
  "tsh": { displayName: "TSH", category: "thyroid", unit: "mIU/L", loincCode: "3016-3" },
  "thyroid stimulating hormone": { displayName: "TSH", category: "thyroid", unit: "mIU/L", loincCode: "3016-3" },
  "t4": { displayName: "T4", category: "thyroid", unit: "ug/dL", loincCode: "3026-2" },
  "thyroxine": { displayName: "T4", category: "thyroid", unit: "ug/dL", loincCode: "3026-2" },
  "free t4": { displayName: "Free T4", category: "thyroid", unit: "ng/dL", loincCode: "3024-7" },
  
  // Electrolytes
  "sodium": { displayName: "Sodium", category: "electrolytes", unit: "mEq/L", loincCode: "2951-2" },
  "na": { displayName: "Sodium", category: "electrolytes", unit: "mEq/L", loincCode: "2951-2" },
  "potassium": { displayName: "Potassium", category: "electrolytes", unit: "mEq/L", loincCode: "2823-3" },
  "k": { displayName: "Potassium", category: "electrolytes", unit: "mEq/L", loincCode: "2823-3" },
  "chloride": { displayName: "Chloride", category: "electrolytes", unit: "mEq/L", loincCode: "2075-0" },
  "cl": { displayName: "Chloride", category: "electrolytes", unit: "mEq/L", loincCode: "2075-0" },
  "co2": { displayName: "CO2", category: "electrolytes", unit: "mEq/L", loincCode: "2028-9" },
  "bicarbonate": { displayName: "CO2", category: "electrolytes", unit: "mEq/L", loincCode: "2028-9" },
};

// RxNorm Medication Mappings - Brand names to generic names
export const RXNORM_MEDICATION_MAPPINGS: Record<string, { genericName: string; drugClass: string; rxcui: string }> = {
  // Pain/Fever
  "tylenol": { genericName: "Acetaminophen", drugClass: "analgesic", rxcui: "161" },
  "acetaminophen": { genericName: "Acetaminophen", drugClass: "analgesic", rxcui: "161" },
  "paracetamol": { genericName: "Acetaminophen", drugClass: "analgesic", rxcui: "161" },
  "advil": { genericName: "Ibuprofen", drugClass: "nsaid", rxcui: "5640" },
  "motrin": { genericName: "Ibuprofen", drugClass: "nsaid", rxcui: "5640" },
  "ibuprofen": { genericName: "Ibuprofen", drugClass: "nsaid", rxcui: "5640" },
  "aleve": { genericName: "Naproxen", drugClass: "nsaid", rxcui: "7258" },
  "naproxen": { genericName: "Naproxen", drugClass: "nsaid", rxcui: "7258" },
  "aspirin": { genericName: "Aspirin", drugClass: "nsaid", rxcui: "1191" },
  "bayer": { genericName: "Aspirin", drugClass: "nsaid", rxcui: "1191" },
  
  // Diabetes
  "metformin": { genericName: "Metformin", drugClass: "antidiabetic", rxcui: "6809" },
  "glucophage": { genericName: "Metformin", drugClass: "antidiabetic", rxcui: "6809" },
  "januvia": { genericName: "Sitagliptin", drugClass: "antidiabetic", rxcui: "593411" },
  "sitagliptin": { genericName: "Sitagliptin", drugClass: "antidiabetic", rxcui: "593411" },
  "jardiance": { genericName: "Empagliflozin", drugClass: "antidiabetic", rxcui: "1545653" },
  "empagliflozin": { genericName: "Empagliflozin", drugClass: "antidiabetic", rxcui: "1545653" },
  "ozempic": { genericName: "Semaglutide", drugClass: "antidiabetic", rxcui: "1991302" },
  "semaglutide": { genericName: "Semaglutide", drugClass: "antidiabetic", rxcui: "1991302" },
  "trulicity": { genericName: "Dulaglutide", drugClass: "antidiabetic", rxcui: "1551291" },
  "dulaglutide": { genericName: "Dulaglutide", drugClass: "antidiabetic", rxcui: "1551291" },
  
  // Blood Pressure
  "lisinopril": { genericName: "Lisinopril", drugClass: "ace_inhibitor", rxcui: "29046" },
  "zestril": { genericName: "Lisinopril", drugClass: "ace_inhibitor", rxcui: "29046" },
  "prinivil": { genericName: "Lisinopril", drugClass: "ace_inhibitor", rxcui: "29046" },
  "losartan": { genericName: "Losartan", drugClass: "arb", rxcui: "52175" },
  "cozaar": { genericName: "Losartan", drugClass: "arb", rxcui: "52175" },
  "amlodipine": { genericName: "Amlodipine", drugClass: "calcium_channel_blocker", rxcui: "17767" },
  "norvasc": { genericName: "Amlodipine", drugClass: "calcium_channel_blocker", rxcui: "17767" },
  "metoprolol": { genericName: "Metoprolol", drugClass: "beta_blocker", rxcui: "6918" },
  "lopressor": { genericName: "Metoprolol", drugClass: "beta_blocker", rxcui: "6918" },
  "toprol": { genericName: "Metoprolol", drugClass: "beta_blocker", rxcui: "6918" },
  "atenolol": { genericName: "Atenolol", drugClass: "beta_blocker", rxcui: "1202" },
  "tenormin": { genericName: "Atenolol", drugClass: "beta_blocker", rxcui: "1202" },
  "hydrochlorothiazide": { genericName: "Hydrochlorothiazide", drugClass: "diuretic", rxcui: "5487" },
  "hctz": { genericName: "Hydrochlorothiazide", drugClass: "diuretic", rxcui: "5487" },
  
  // Cholesterol
  "atorvastatin": { genericName: "Atorvastatin", drugClass: "statin", rxcui: "83367" },
  "lipitor": { genericName: "Atorvastatin", drugClass: "statin", rxcui: "83367" },
  "simvastatin": { genericName: "Simvastatin", drugClass: "statin", rxcui: "36567" },
  "zocor": { genericName: "Simvastatin", drugClass: "statin", rxcui: "36567" },
  "rosuvastatin": { genericName: "Rosuvastatin", drugClass: "statin", rxcui: "301542" },
  "crestor": { genericName: "Rosuvastatin", drugClass: "statin", rxcui: "301542" },
  "pravastatin": { genericName: "Pravastatin", drugClass: "statin", rxcui: "42463" },
  "pravachol": { genericName: "Pravastatin", drugClass: "statin", rxcui: "42463" },
  
  // Antidepressants
  "sertraline": { genericName: "Sertraline", drugClass: "ssri", rxcui: "36437" },
  "zoloft": { genericName: "Sertraline", drugClass: "ssri", rxcui: "36437" },
  "escitalopram": { genericName: "Escitalopram", drugClass: "ssri", rxcui: "321988" },
  "lexapro": { genericName: "Escitalopram", drugClass: "ssri", rxcui: "321988" },
  "fluoxetine": { genericName: "Fluoxetine", drugClass: "ssri", rxcui: "4493" },
  "prozac": { genericName: "Fluoxetine", drugClass: "ssri", rxcui: "4493" },
  "citalopram": { genericName: "Citalopram", drugClass: "ssri", rxcui: "2556" },
  "celexa": { genericName: "Citalopram", drugClass: "ssri", rxcui: "2556" },
  
  // Antibiotics
  "amoxicillin": { genericName: "Amoxicillin", drugClass: "antibiotic", rxcui: "723" },
  "amoxil": { genericName: "Amoxicillin", drugClass: "antibiotic", rxcui: "723" },
  "azithromycin": { genericName: "Azithromycin", drugClass: "antibiotic", rxcui: "18631" },
  "zithromax": { genericName: "Azithromycin", drugClass: "antibiotic", rxcui: "18631" },
  "z-pack": { genericName: "Azithromycin", drugClass: "antibiotic", rxcui: "18631" },
  "ciprofloxacin": { genericName: "Ciprofloxacin", drugClass: "antibiotic", rxcui: "2551" },
  "cipro": { genericName: "Ciprofloxacin", drugClass: "antibiotic", rxcui: "2551" },
  
  // Acid Reflux
  "omeprazole": { genericName: "Omeprazole", drugClass: "ppi", rxcui: "7646" },
  "prilosec": { genericName: "Omeprazole", drugClass: "ppi", rxcui: "7646" },
  "pantoprazole": { genericName: "Pantoprazole", drugClass: "ppi", rxcui: "40790" },
  "protonix": { genericName: "Pantoprazole", drugClass: "ppi", rxcui: "40790" },
  "esomeprazole": { genericName: "Esomeprazole", drugClass: "ppi", rxcui: "283742" },
  "nexium": { genericName: "Esomeprazole", drugClass: "ppi", rxcui: "283742" },
  
  // Allergy
  "loratadine": { genericName: "Loratadine", drugClass: "antihistamine", rxcui: "28889" },
  "claritin": { genericName: "Loratadine", drugClass: "antihistamine", rxcui: "28889" },
  "cetirizine": { genericName: "Cetirizine", drugClass: "antihistamine", rxcui: "20610" },
  "zyrtec": { genericName: "Cetirizine", drugClass: "antihistamine", rxcui: "20610" },
  "fexofenadine": { genericName: "Fexofenadine", drugClass: "antihistamine", rxcui: "26225" },
  "allegra": { genericName: "Fexofenadine", drugClass: "antihistamine", rxcui: "26225" },
  
  // Asthma
  "albuterol": { genericName: "Albuterol", drugClass: "bronchodilator", rxcui: "435" },
  "ventolin": { genericName: "Albuterol", drugClass: "bronchodilator", rxcui: "435" },
  "proair": { genericName: "Albuterol", drugClass: "bronchodilator", rxcui: "435" },
  "montelukast": { genericName: "Montelukast", drugClass: "leukotriene_inhibitor", rxcui: "88249" },
  "singulair": { genericName: "Montelukast", drugClass: "leukotriene_inhibitor", rxcui: "88249" },
};

// Clinical Event Type Mappings
export const CLINICAL_EVENT_TYPES: Record<string, { displayName: string; category: string; severity: string }> = {
  "surgery": { displayName: "Surgery", category: "procedure", severity: "major" },
  "operation": { displayName: "Surgery", category: "procedure", severity: "major" },
  "surgical procedure": { displayName: "Surgery", category: "procedure", severity: "major" },
  "er visit": { displayName: "ER Visit", category: "encounter", severity: "urgent" },
  "emergency room": { displayName: "ER Visit", category: "encounter", severity: "urgent" },
  "emergency department": { displayName: "ER Visit", category: "encounter", severity: "urgent" },
  "ed visit": { displayName: "ER Visit", category: "encounter", severity: "urgent" },
  "hospitalization": { displayName: "Hospital Admission", category: "encounter", severity: "major" },
  "hospital admission": { displayName: "Hospital Admission", category: "encounter", severity: "major" },
  "inpatient": { displayName: "Hospital Admission", category: "encounter", severity: "major" },
  "office visit": { displayName: "Office Visit", category: "encounter", severity: "routine" },
  "checkup": { displayName: "Checkup", category: "encounter", severity: "routine" },
  "annual physical": { displayName: "Annual Physical", category: "encounter", severity: "routine" },
  "physical exam": { displayName: "Physical Exam", category: "encounter", severity: "routine" },
  "wellness visit": { displayName: "Wellness Visit", category: "encounter", severity: "routine" },
  "vaccination": { displayName: "Vaccination", category: "immunization", severity: "routine" },
  "immunization": { displayName: "Vaccination", category: "immunization", severity: "routine" },
  "imaging": { displayName: "Imaging Study", category: "diagnostic", severity: "routine" },
  "x-ray": { displayName: "X-Ray", category: "diagnostic", severity: "routine" },
  "ct scan": { displayName: "CT Scan", category: "diagnostic", severity: "routine" },
  "mri": { displayName: "MRI", category: "diagnostic", severity: "routine" },
  "ultrasound": { displayName: "Ultrasound", category: "diagnostic", severity: "routine" },
};

export class SemanticNormalizationService {
  private static instance: SemanticNormalizationService;

  static getInstance(): SemanticNormalizationService {
    if (!SemanticNormalizationService.instance) {
      SemanticNormalizationService.instance = new SemanticNormalizationService();
    }
    return SemanticNormalizationService.instance;
  }

  /**
   * Normalize a lab test name to a unified display name
   */
  normalizeLabTest(rawName: string): { 
    displayName: string; 
    category: string; 
    unit: string; 
    loincCode: string;
    originalName: string;
    normalized: boolean;
  } {
    const normalized = rawName.toLowerCase().trim();
    const mapping = LOINC_LAB_MAPPINGS[normalized];
    
    if (mapping) {
      return {
        ...mapping,
        originalName: rawName,
        normalized: true,
      };
    }
    
    // Return original if no mapping found
    return {
      displayName: rawName,
      category: "other",
      unit: "",
      loincCode: "",
      originalName: rawName,
      normalized: false,
    };
  }

  /**
   * Normalize a medication name to its generic equivalent
   */
  normalizeMedication(rawName: string): {
    genericName: string;
    drugClass: string;
    rxcui: string;
    originalName: string;
    normalized: boolean;
  } {
    // Extract base medication name (remove dosage info)
    const baseName = rawName.toLowerCase().trim().replace(/\s*\d+\s*mg.*$/i, "").trim();
    const mapping = RXNORM_MEDICATION_MAPPINGS[baseName];
    
    if (mapping) {
      return {
        ...mapping,
        originalName: rawName,
        normalized: true,
      };
    }
    
    return {
      genericName: rawName,
      drugClass: "other",
      rxcui: "",
      originalName: rawName,
      normalized: false,
    };
  }

  /**
   * Normalize a clinical event type
   */
  normalizeClinicalEvent(rawType: string): {
    displayName: string;
    category: string;
    severity: string;
    originalType: string;
    normalized: boolean;
  } {
    const normalized = rawType.toLowerCase().trim();
    const mapping = CLINICAL_EVENT_TYPES[normalized];
    
    if (mapping) {
      return {
        ...mapping,
        originalType: rawType,
        normalized: true,
      };
    }
    
    return {
      displayName: rawType,
      category: "other",
      severity: "routine",
      originalType: rawType,
      normalized: false,
    };
  }

  /**
   * Group lab results by normalized name for trend analysis
   */
  groupLabResults(results: Array<{ name: string; value: number; date: Date; unit?: string }>): Map<string, Array<{ value: number; date: Date; unit: string; originalName: string }>> {
    const grouped = new Map<string, Array<{ value: number; date: Date; unit: string; originalName: string }>>();
    
    for (const result of results) {
      const normalized = this.normalizeLabTest(result.name);
      const key = normalized.displayName;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      grouped.get(key)!.push({
        value: result.value,
        date: result.date,
        unit: result.unit || normalized.unit,
        originalName: result.name,
      });
    }
    
    // Sort each group by date
    for (const [key, values] of grouped) {
      values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    return grouped;
  }

  /**
   * Group medications by generic name for continuous history
   */
  groupMedications(medications: Array<{ name: string; startDate: Date; endDate?: Date; dosage?: string }>): Map<string, Array<{ startDate: Date; endDate?: Date; dosage?: string; originalName: string }>> {
    const grouped = new Map<string, Array<{ startDate: Date; endDate?: Date; dosage?: string; originalName: string }>>();
    
    for (const med of medications) {
      const normalized = this.normalizeMedication(med.name);
      const key = normalized.genericName;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      grouped.get(key)!.push({
        startDate: med.startDate,
        endDate: med.endDate,
        dosage: med.dosage,
        originalName: med.name,
      });
    }
    
    // Sort each group by start date
    for (const [key, values] of grouped) {
      values.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
    
    return grouped;
  }

  /**
   * Get all available lab categories
   */
  getLabCategories(): string[] {
    const categories = new Set<string>();
    for (const mapping of Object.values(LOINC_LAB_MAPPINGS)) {
      categories.add(mapping.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all available drug classes
   */
  getDrugClasses(): string[] {
    const classes = new Set<string>();
    for (const mapping of Object.values(RXNORM_MEDICATION_MAPPINGS)) {
      classes.add(mapping.drugClass);
    }
    return Array.from(classes).sort();
  }
}

export const semanticNormalizationService = SemanticNormalizationService.getInstance();
