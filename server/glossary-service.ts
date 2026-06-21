import { logPhiAccess } from "./security/hipaa-audit";

export interface GlossaryTerm {
  term: string;
  aliases: string[];
  definition: string;
  normalRange?: string;
  context: string;
  synonyms: string[];
  category: "lab" | "condition" | "procedure" | "medication" | "anatomy" | "abbreviation";
  pronunciation?: string;
}

const medicalGlossary: Record<string, GlossaryTerm> = {
  "hemoglobin a1c": {
    term: "Hemoglobin A1C",
    aliases: ["hba1c", "a1c", "glycated hemoglobin", "glycosylated hemoglobin"],
    definition: "A blood test that measures your average blood sugar level over the past 2-3 months. It shows how well your diabetes is being controlled.",
    normalRange: "Below 5.7% is normal, 5.7-6.4% indicates prediabetes, 6.5% or higher indicates diabetes",
    context: "Used to diagnose and monitor diabetes management",
    synonyms: ["HbA1c", "glycohemoglobin", "A1C test"],
    category: "lab",
    pronunciation: "hee-moh-gloh-bin ay-wun-see",
  },
  "egfr": {
    term: "eGFR",
    aliases: ["estimated glomerular filtration rate", "gfr", "kidney function test"],
    definition: "A measure of how well your kidneys filter waste from your blood. It estimates how many milliliters of blood your kidneys can clean per minute.",
    normalRange: "90 or above is normal, 60-89 may indicate early kidney disease, below 60 indicates kidney disease",
    context: "Used to assess kidney function and stage chronic kidney disease",
    synonyms: ["kidney filtration rate", "renal function"],
    category: "lab",
    pronunciation: "ee-jee-eff-arr",
  },
  "atelectasis": {
    term: "Atelectasis",
    aliases: ["collapsed lung", "lung collapse"],
    definition: "A condition where part or all of a lung collapses or doesn't inflate properly. It can happen after surgery or due to a blockage in the airways.",
    context: "Often seen after surgery, especially with general anesthesia, or with mucus plugs",
    synonyms: ["lung collapse", "collapsed lung segment"],
    category: "condition",
    pronunciation: "at-uh-LEK-tuh-sis",
  },
  "cholelithiasis": {
    term: "Cholelithiasis",
    aliases: ["gallstones", "gallbladder stones", "biliary calculi"],
    definition: "The presence of stones in the gallbladder. These hard deposits form from bile and can range from the size of a grain of sand to a golf ball.",
    context: "Common condition affecting about 10-15% of adults, may cause no symptoms or cause pain after eating fatty foods",
    synonyms: ["gallstones", "gallbladder stones"],
    category: "condition",
    pronunciation: "koh-leh-lih-THY-uh-sis",
  },
  "ldl cholesterol": {
    term: "LDL Cholesterol",
    aliases: ["ldl", "ldl-c", "bad cholesterol", "low-density lipoprotein"],
    definition: "Often called 'bad' cholesterol because high levels can lead to buildup in your arteries, increasing risk of heart disease and stroke.",
    normalRange: "Below 100 mg/dL is optimal, 100-129 is near optimal, 130-159 is borderline high, 160-189 is high",
    context: "Part of a lipid panel blood test, key measure for heart disease risk",
    synonyms: ["bad cholesterol", "low-density lipoprotein cholesterol"],
    category: "lab",
    pronunciation: "ell-dee-ell koh-LESS-ter-all",
  },
  "hdl cholesterol": {
    term: "HDL Cholesterol",
    aliases: ["hdl", "hdl-c", "good cholesterol", "high-density lipoprotein"],
    definition: "Often called 'good' cholesterol because it helps remove other forms of cholesterol from your bloodstream and carries it to the liver.",
    normalRange: "60 mg/dL or higher is optimal, below 40 mg/dL for men or 50 mg/dL for women is a risk factor",
    context: "Higher levels are better - HDL protects against heart disease",
    synonyms: ["good cholesterol", "high-density lipoprotein cholesterol"],
    category: "lab",
    pronunciation: "aitch-dee-ell koh-LESS-ter-all",
  },
  "cbc": {
    term: "CBC",
    aliases: ["complete blood count", "blood count", "full blood count"],
    definition: "A common blood test that evaluates your overall health by measuring red blood cells, white blood cells, hemoglobin, hematocrit, and platelets.",
    context: "Used to detect infections, anemia, blood disorders, and to monitor treatment effects",
    synonyms: ["complete blood count", "full blood count", "blood panel"],
    category: "lab",
    pronunciation: "see-bee-see",
  },
  "bmp": {
    term: "BMP",
    aliases: ["basic metabolic panel", "chem 7", "chemistry panel"],
    definition: "A blood test that measures 8 substances in your blood including glucose, calcium, and electrolytes to check kidney function and blood sugar.",
    context: "Often ordered during routine checkups or to monitor chronic conditions",
    synonyms: ["basic metabolic panel", "chemistry 7", "chem-7"],
    category: "lab",
    pronunciation: "bee-em-pee",
  },
  "cmp": {
    term: "CMP",
    aliases: ["comprehensive metabolic panel", "chem 14", "chemistry panel"],
    definition: "A blood test measuring 14 substances including glucose, electrolytes, kidney markers, and liver enzymes to assess overall metabolic health.",
    context: "More comprehensive than BMP, includes liver function tests",
    synonyms: ["comprehensive metabolic panel", "chem-14", "metabolic panel"],
    category: "lab",
    pronunciation: "see-em-pee",
  },
  "bmi": {
    term: "BMI",
    aliases: ["body mass index", "weight index"],
    definition: "A measure calculated from your height and weight that estimates body fat and helps assess if your weight is in a healthy range.",
    normalRange: "18.5-24.9 is normal, 25-29.9 is overweight, 30+ is obese",
    context: "Used as a screening tool but doesn't measure body fat directly",
    synonyms: ["body mass index"],
    category: "abbreviation",
    pronunciation: "bee-em-eye",
  },
  "hypertension": {
    term: "Hypertension",
    aliases: ["high blood pressure", "htn", "elevated blood pressure"],
    definition: "A condition where the force of blood against artery walls is consistently too high, which can damage blood vessels and organs over time.",
    normalRange: "Normal: below 120/80 mmHg, Elevated: 120-129/<80, Stage 1: 130-139/80-89, Stage 2: 140+/90+",
    context: "Often called the 'silent killer' because it usually has no symptoms",
    synonyms: ["high blood pressure", "elevated BP"],
    category: "condition",
    pronunciation: "hy-per-TEN-shun",
  },
  "hyperlipidemia": {
    term: "Hyperlipidemia",
    aliases: ["high cholesterol", "dyslipidemia", "elevated lipids"],
    definition: "A condition where you have too many fats (lipids) in your blood, including cholesterol and triglycerides, increasing heart disease risk.",
    context: "Often managed with diet, exercise, and sometimes medication like statins",
    synonyms: ["high cholesterol", "elevated lipids", "dyslipidemia"],
    category: "condition",
    pronunciation: "hy-per-lip-ih-DEE-mee-uh",
  },
  "metformin": {
    term: "Metformin",
    aliases: ["glucophage", "fortamet", "glumetza"],
    definition: "A medication used to treat type 2 diabetes by lowering blood sugar. It reduces glucose production in the liver and improves insulin sensitivity.",
    context: "Usually the first medication prescribed for type 2 diabetes, taken with meals",
    synonyms: ["Glucophage", "Fortamet", "Glumetza"],
    category: "medication",
    pronunciation: "met-FOR-min",
  },
  "lisinopril": {
    term: "Lisinopril",
    aliases: ["prinivil", "zestril", "ace inhibitor"],
    definition: "A blood pressure medication (ACE inhibitor) that relaxes blood vessels so blood can flow more easily, also protects the heart and kidneys.",
    context: "Often prescribed for high blood pressure, heart failure, or kidney protection in diabetes",
    synonyms: ["Prinivil", "Zestril"],
    category: "medication",
    pronunciation: "ly-SIN-oh-pril",
  },
  "atorvastatin": {
    term: "Atorvastatin",
    aliases: ["lipitor", "statin", "cholesterol medication"],
    definition: "A medication that lowers cholesterol by blocking an enzyme your liver needs to make cholesterol. Part of the statin drug class.",
    context: "Taken once daily, usually at night when the body produces most cholesterol",
    synonyms: ["Lipitor"],
    category: "medication",
    pronunciation: "uh-TOR-vuh-stat-in",
  },
  "creatinine": {
    term: "Creatinine",
    aliases: ["serum creatinine", "blood creatinine"],
    definition: "A waste product made by your muscles that kidneys filter out. Blood levels show how well your kidneys are working.",
    normalRange: "0.7-1.3 mg/dL for men, 0.6-1.1 mg/dL for women",
    context: "Used to calculate eGFR and monitor kidney function",
    synonyms: ["serum creatinine", "kidney marker"],
    category: "lab",
    pronunciation: "kree-AT-ih-neen",
  },
  "triglycerides": {
    term: "Triglycerides",
    aliases: ["tg", "trigs", "blood fats"],
    definition: "A type of fat in your blood. Your body converts calories it doesn't need right away into triglycerides stored in fat cells.",
    normalRange: "Below 150 mg/dL is normal, 150-199 is borderline high, 200-499 is high",
    context: "Part of lipid panel, elevated levels increase heart disease and pancreatitis risk",
    synonyms: ["blood fats", "TGs"],
    category: "lab",
    pronunciation: "try-GLISS-er-eyeds",
  },
  "echocardiogram": {
    term: "Echocardiogram",
    aliases: ["echo", "cardiac ultrasound", "heart ultrasound"],
    definition: "An ultrasound test that creates moving pictures of your heart to show how well it's pumping and if valves are working properly.",
    context: "Non-invasive test using sound waves, no radiation, takes about 30-60 minutes",
    synonyms: ["echo", "heart ultrasound", "cardiac echo"],
    category: "procedure",
    pronunciation: "ek-oh-KAR-dee-oh-gram",
  },
  "electrocardiogram": {
    term: "Electrocardiogram",
    aliases: ["ecg", "ekg", "heart rhythm test"],
    definition: "A test that records the electrical activity of your heart to check for abnormal rhythms, heart attacks, or other heart problems.",
    context: "Quick, painless test with electrodes placed on chest, arms, and legs",
    synonyms: ["EKG", "ECG", "heart tracing"],
    category: "procedure",
    pronunciation: "ee-lek-troh-KAR-dee-oh-gram",
  },
  "prediabetes": {
    term: "Prediabetes",
    aliases: ["pre-diabetes", "impaired glucose tolerance", "borderline diabetes"],
    definition: "A condition where blood sugar is higher than normal but not high enough for a diabetes diagnosis. It's a warning sign that can be reversed.",
    normalRange: "A1C of 5.7-6.4% or fasting glucose of 100-125 mg/dL",
    context: "Lifestyle changes can prevent progression to type 2 diabetes",
    synonyms: ["borderline diabetes", "impaired fasting glucose"],
    category: "condition",
    pronunciation: "pree-dy-uh-BEE-teez",
  },
  "type 2 diabetes": {
    term: "Type 2 Diabetes",
    aliases: ["t2dm", "diabetes mellitus type 2", "adult-onset diabetes", "dm2"],
    definition: "A condition where your body doesn't use insulin properly, causing blood sugar to rise. The most common form of diabetes.",
    normalRange: "Diagnosis: A1C 6.5%+ or fasting glucose 126+ mg/dL",
    context: "Often managed with diet, exercise, and medications; can lead to complications if uncontrolled",
    synonyms: ["adult-onset diabetes", "non-insulin dependent diabetes"],
    category: "condition",
    pronunciation: "type too dy-uh-BEE-teez",
  },
  "mri": {
    term: "MRI",
    aliases: ["magnetic resonance imaging", "mr scan", "mr imaging"],
    definition: "A scan that uses powerful magnets and radio waves to create detailed pictures of organs and tissues inside your body without radiation.",
    context: "Used for brain, spine, joints, and soft tissue imaging; may require contrast dye",
    synonyms: ["magnetic resonance imaging", "MR scan"],
    category: "procedure",
    pronunciation: "em-arr-eye",
  },
  "ct scan": {
    term: "CT Scan",
    aliases: ["cat scan", "computed tomography", "ct imaging"],
    definition: "A scan that combines X-rays from different angles with computer processing to create cross-sectional images of bones, blood vessels, and soft tissues.",
    context: "Quick procedure, uses radiation; often used for emergency diagnoses",
    synonyms: ["CAT scan", "computed tomography"],
    category: "procedure",
    pronunciation: "see-tee skan",
  },
  "platelets": {
    term: "Platelets",
    aliases: ["thrombocytes", "plt", "platelet count"],
    definition: "Tiny blood cells that help your body form clots to stop bleeding. They stick together to plug cuts and wounds.",
    normalRange: "150,000 to 400,000 platelets per microliter of blood",
    context: "Part of CBC test; low counts increase bleeding risk, high counts may indicate inflammation",
    synonyms: ["thrombocytes", "clotting cells"],
    category: "lab",
    pronunciation: "PLATE-lets",
  },
  "hemoglobin": {
    term: "Hemoglobin",
    aliases: ["hgb", "hb", "blood hemoglobin"],
    definition: "A protein in red blood cells that carries oxygen from your lungs to the rest of your body and returns carbon dioxide to be exhaled.",
    normalRange: "12-16 g/dL for women, 14-18 g/dL for men",
    context: "Low levels indicate anemia; part of CBC test",
    synonyms: ["Hgb", "Hb"],
    category: "lab",
    pronunciation: "HEE-moh-gloh-bin",
  },
};

function normalizeSearchTerm(term: string): string {
  return term.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

export function lookupTerm(searchTerm: string): GlossaryTerm | null {
  const normalized = normalizeSearchTerm(searchTerm);
  
  if (medicalGlossary[normalized]) {
    return medicalGlossary[normalized];
  }

  for (const [key, term] of Object.entries(medicalGlossary)) {
    if (term.aliases.some(alias => normalizeSearchTerm(alias) === normalized)) {
      return term;
    }
  }

  for (const [key, term] of Object.entries(medicalGlossary)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return term;
    }
    if (term.aliases.some(alias => {
      const normalizedAlias = normalizeSearchTerm(alias);
      return normalizedAlias.includes(normalized) || normalized.includes(normalizedAlias);
    })) {
      return term;
    }
  }

  return null;
}

export function getAllTerms(): string[] {
  const terms: string[] = [];
  for (const term of Object.values(medicalGlossary)) {
    terms.push(term.term);
    terms.push(...term.aliases);
  }
  return Array.from(new Set(terms));
}

export function getTermsByCategory(category: GlossaryTerm["category"]): GlossaryTerm[] {
  return Object.values(medicalGlossary).filter(term => term.category === category);
}

export async function defineTermWithLogging(term: string, patientId: string): Promise<GlossaryTerm | null> {
  logPhiAccess({
    action: "read",
    resourceType: "GlossaryTerm",
    userId: patientId,
    patientId,
    details: `Looked up medical term: ${term}`,
  });

  return lookupTerm(term);
}

export { medicalGlossary };
