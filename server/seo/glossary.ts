import { ssrHtmlShell, SITE_URL } from "./ssr-shared";

interface GlossaryTerm {
  slug: string;
  term: string;
  definition: string;
  category: string;
  relatedTerms: string[];
  whyItMatters: string;
  inYourRecords: string;
  fhirResource?: string;
}

const TERMS: GlossaryTerm[] = [
  { slug: "a1c", term: "A1C (Hemoglobin A1c)", definition: "A blood test measuring your average blood sugar over the past 2–3 months. It reflects how well glucose attaches to hemoglobin in red blood cells. Normal is below 5.7%; prediabetes is 5.7–6.4%; diabetes is 6.5% or higher.", category: "Lab Results", relatedTerms: ["fasting-glucose", "insulin", "metabolic-panel"], whyItMatters: "A1C is the gold standard for diabetes management. Unlike a single glucose reading, it shows your long-term trend — one high reading doesn't mean diabetes, but a consistently elevated A1C does.", inYourRecords: "In Tabula Medica, your A1C values from different labs are deduplicated and shown on a trend chart. The AI summary flags whether your A1C is improving or worsening across visits.", fhirResource: "Observation" },
  { slug: "bmp", term: "Basic Metabolic Panel (BMP)", definition: "A group of 8 blood tests measuring glucose, calcium, sodium, potassium, CO2, chloride, BUN, and creatinine. It provides a snapshot of your body's chemical balance and kidney function.", category: "Lab Results", relatedTerms: ["cmp", "creatinine", "electrolytes"], whyItMatters: "An abnormal BMP can indicate dehydration, kidney disease, or electrolyte imbalances. It's one of the most commonly ordered lab panels, often done during routine physicals or ER visits.", inYourRecords: "Tabula Medica groups your BMP results together even when they come from different providers. The AI explains which values are outside normal range and what they could mean.", fhirResource: "DiagnosticReport" },
  { slug: "cmp", term: "Comprehensive Metabolic Panel (CMP)", definition: "A set of 14 blood tests that includes everything in a BMP plus liver function tests (ALT, AST, ALP, bilirubin, albumin, total protein). It evaluates metabolism, liver health, and kidney function.", category: "Lab Results", relatedTerms: ["bmp", "alt-ast", "creatinine"], whyItMatters: "The CMP is often ordered annually or before surgery. Abnormal liver enzymes can indicate fatty liver disease, hepatitis, or medication side effects — catching these early changes outcomes.", inYourRecords: "Tabula Medica shows your CMP history as a unified panel view. When your ALT trends upward over three visits across different hospitals, the AI flags it even if each individual result was technically 'normal.'", fhirResource: "DiagnosticReport" },
  { slug: "creatinine", term: "Creatinine", definition: "A waste product from muscle metabolism filtered by the kidneys. Blood creatinine levels indicate how well your kidneys are filtering. Normal ranges are typically 0.7–1.3 mg/dL for men and 0.6–1.1 mg/dL for women.", category: "Lab Results", relatedTerms: ["bmp", "gfr", "bun"], whyItMatters: "Rising creatinine levels are one of the earliest signs of kidney disease. Because kidneys lose function gradually, tracking creatinine over time is more valuable than a single reading.", inYourRecords: "Tabula Medica plots your creatinine across all providers and calculates the estimated GFR trend. If your creatinine from Quest and your hospital labs tell different stories, the deduplication engine reconciles them.", fhirResource: "Observation" },
  { slug: "gfr", term: "Glomerular Filtration Rate (GFR)", definition: "An estimate of how much blood your kidneys filter per minute. It's calculated from creatinine, age, sex, and race. Normal is 90+ mL/min; below 60 for 3+ months indicates chronic kidney disease.", category: "Lab Results", relatedTerms: ["creatinine", "bmp", "bun"], whyItMatters: "GFR is the most reliable single number for kidney health. Stages of chronic kidney disease are defined entirely by GFR: Stage 1 (90+), Stage 2 (60-89), Stage 3 (30-59), Stage 4 (15-29), Stage 5 (<15, dialysis range).", inYourRecords: "Tabula Medica auto-calculates your GFR trend and labels your kidney disease stage if applicable. When different labs use different formulas, the AI normalizes them for consistent tracking.", fhirResource: "Observation" },
  { slug: "cbc", term: "Complete Blood Count (CBC)", definition: "A blood test measuring white blood cells (WBC), red blood cells (RBC), hemoglobin, hematocrit, and platelets. It's the most commonly ordered blood test and screens for infections, anemia, and blood disorders.", category: "Lab Results", relatedTerms: ["hemoglobin", "wbc", "platelets"], whyItMatters: "A CBC abnormality can indicate anything from a simple infection (high WBC) to anemia (low hemoglobin) to more serious conditions like leukemia. It's often the first test ordered when you feel unwell.", inYourRecords: "Tabula Medica shows your CBC components as individual trend lines. When you connect multiple providers, it combines all your CBC history into one unified view with clear normal-range shading.", fhirResource: "DiagnosticReport" },
  { slug: "lipid-panel", term: "Lipid Panel", definition: "A blood test measuring total cholesterol, LDL ('bad' cholesterol), HDL ('good' cholesterol), and triglycerides. It assesses cardiovascular risk. Desirable total cholesterol is below 200 mg/dL.", category: "Lab Results", relatedTerms: ["ldl", "hdl", "triglycerides"], whyItMatters: "Heart disease is the leading cause of death in the US. A lipid panel is the primary tool for assessing your risk and determining whether statin therapy is warranted. The ratio of LDL to HDL matters more than any single number.", inYourRecords: "Tabula Medica calculates your non-HDL cholesterol and LDL/HDL ratio automatically. The AI summary compares your cardiovascular risk profile across years, noting whether diet changes or medications are moving your numbers.", fhirResource: "DiagnosticReport" },
  { slug: "fhir", term: "FHIR (Fast Healthcare Interoperability Resources)", definition: "A modern standard for exchanging healthcare data electronically, developed by HL7. FHIR uses RESTful APIs and JSON/XML to represent clinical data as 'Resources' like Patient, Observation, and MedicationRequest.", category: "Technology", relatedTerms: ["smart-on-fhir", "hl7", "uscdi"], whyItMatters: "FHIR is why apps like Tabula Medica can connect to your hospital at all. Before FHIR, getting your records required phone calls, faxes, or CDs. The 21st Century Cures Act mandates that hospitals expose FHIR APIs to patients.", inYourRecords: "Every record in Tabula Medica is stored as a FHIR R4 resource. When you connect a provider, their data is translated into standardized FHIR format, making it possible to merge records from different hospitals into one view.", fhirResource: "N/A" },
  { slug: "smart-on-fhir", term: "SMART on FHIR", definition: "An open standard for authorizing third-party apps to access healthcare data. SMART stands for Substitutable Medical Applications, Reusable Technologies. It uses OAuth 2.0 + PKCE to securely grant app access to your EHR.", category: "Technology", relatedTerms: ["fhir", "oauth", "epic-mychart"], whyItMatters: "SMART on FHIR is the mechanism that lets you log into your MyChart and authorize Tabula Medica to read your records. It's the healthcare equivalent of 'Sign in with Google' — secure, revocable, and standardized.", inYourRecords: "When you tap 'Connect' for a provider in Tabula Medica, you're initiating a SMART on FHIR authorization flow. Your credentials never touch our servers — authentication happens directly with your hospital.", fhirResource: "N/A" },
  { slug: "uscdi", term: "USCDI (United States Core Data for Interoperability)", definition: "A standardized set of health data classes required for nationwide health information exchange. USCDI v3 includes Patient Demographics, Problems, Medications, Allergies, Lab Results, Clinical Notes, and more.", category: "Technology", relatedTerms: ["fhir", "smart-on-fhir", "hl7"], whyItMatters: "USCDI defines the minimum data that every healthcare provider must make available to patients electronically. This is what guarantees you can get your records from any hospital in the US.", inYourRecords: "Tabula Medica is USCDI v3 compliant, meaning it can receive and display all data classes defined by the standard. When you connect a provider, you're guaranteed to get at least these core record types.", fhirResource: "N/A" },
  { slug: "eob", term: "Explanation of Benefits (EOB)", definition: "A document from your insurance company explaining what medical services were billed, what they paid, and what you owe. It is not a bill — it's a summary of how your claim was processed.", category: "Insurance", relatedTerms: ["deductible", "copay", "out-of-pocket-max"], whyItMatters: "EOBs are the most confusing document in healthcare. Understanding your EOB helps you catch billing errors (which occur in up to 80% of medical bills) and understand your financial responsibility before a bill arrives.", inYourRecords: "Tabula Medica imports your EOBs and translates them into plain language. The AI breaks down what was billed, what insurance covered, and what you actually owe — with flags for potential errors.", fhirResource: "ExplanationOfBenefit" },
  { slug: "deductible", term: "Deductible", definition: "The amount you pay out-of-pocket for healthcare services before your insurance starts covering costs. For example, with a $2,000 deductible, you pay the first $2,000 of medical bills each year yourself.", category: "Insurance", relatedTerms: ["eob", "copay", "out-of-pocket-max"], whyItMatters: "Your deductible resets annually (usually January 1). Knowing how much of your deductible you've met helps you plan medical procedures — scheduling a surgery in December after meeting your deductible saves thousands vs. waiting until January.", inYourRecords: "Tabula Medica tracks your deductible progress across all your EOBs. The financial dashboard shows how much of your deductible is met and estimates remaining out-of-pocket costs for the year.", fhirResource: "Coverage" },
  { slug: "prior-authorization", term: "Prior Authorization", definition: "A requirement by your insurance company to approve a medical service, procedure, or prescription before it's performed. Without prior auth, the insurer may deny the claim entirely, leaving you responsible for the full cost.", category: "Insurance", relatedTerms: ["eob", "deductible", "formulary"], whyItMatters: "Prior auth denials are the #1 cause of unexpected medical bills. Knowing whether your procedure requires prior auth — and confirming approval before the appointment — prevents surprise bills of $5,000 to $50,000+.", inYourRecords: "Tabula Medica flags procedures and medications in your records that commonly require prior authorization. When your doctor orders an MRI, the AI alerts you to check with your insurer first.", fhirResource: "CoverageEligibilityRequest" },
  { slug: "blood-pressure", term: "Blood Pressure", definition: "The force of blood against artery walls, measured as systolic (top number, during heartbeat) over diastolic (bottom number, between beats). Normal is below 120/80 mmHg. Hypertension is 130/80 or higher.", category: "Vital Signs", relatedTerms: ["heart-rate", "bmi", "lipid-panel"], whyItMatters: "High blood pressure has no symptoms but causes heart attacks, strokes, and kidney damage. It's called 'the silent killer' because 1 in 3 adults with hypertension don't know they have it. Consistent tracking is the only way to catch it.", inYourRecords: "Tabula Medica plots all your blood pressure readings from every provider, urgent care, and pharmacy check on a single timeline. The AI flags any reading above 130/80 and shows whether your average trend is improving.", fhirResource: "Observation" },
  { slug: "bmi", term: "Body Mass Index (BMI)", definition: "A calculation using height and weight (kg/m²) to estimate body fat. Underweight: <18.5, Normal: 18.5–24.9, Overweight: 25–29.9, Obese: 30+. It's a screening tool, not a diagnostic one.", category: "Vital Signs", relatedTerms: ["blood-pressure", "heart-rate", "a1c"], whyItMatters: "BMI is imperfect (it doesn't account for muscle mass) but it's used universally by insurers and doctors to assess metabolic risk. Tracking your BMI trend over years is more useful than any single measurement.", inYourRecords: "Tabula Medica calculates your BMI from height and weight recorded at different providers and shows the trend over time. The AI notes when BMI category changes (e.g., overweight → normal) and correlates with other vitals.", fhirResource: "Observation" },
];

export function getTermSlugs(): string[] {
  return TERMS.map((t) => t.slug);
}

export function getTermHtml(slug: string): string | null {
  const t = TERMS.find((x) => x.slug === slug);
  if (!t) return null;

  const related = t.relatedTerms
    .map((rs) => {
      const rt = TERMS.find((x) => x.slug === rs);
      return rt ? `<a href="/learn/${rt.slug}" style="text-decoration:none;"><span class="badge">${rt.term.split(" (")[0]}</span></a>` : "";
    })
    .filter(Boolean)
    .join(" ");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Tabula Medica Medical Glossary", url: `${SITE_URL}/learn` },
    url: `${SITE_URL}/learn/${t.slug}`,
  });

  const body = `
<span class="badge">${t.category}</span>
<h1 style="margin-top:12px;">${t.term}</h1>

<div class="card">
  <h3 style="margin-top:0;">Definition</h3>
  <p style="margin-bottom:0;font-size:16px;line-height:1.7;">${t.definition}</p>
</div>

<h2>Why It Matters</h2>
<p>${t.whyItMatters}</p>

<h2>In Your Records</h2>
<p>${t.inYourRecords}</p>

${t.fhirResource && t.fhirResource !== "N/A" ? `<div class="card"><h3 style="margin-top:0;">FHIR Resource Type</h3><p style="margin-bottom:0;">This data appears in your records as a <strong>FHIR ${t.fhirResource}</strong> resource. Tabula Medica standardizes this across all connected providers so your ${t.term.split(" (")[0]} data is always comparable.</p></div>` : ""}

${related ? `<h2>Related Terms</h2><div style="display:flex;flex-wrap:wrap;gap:8px;">${related}</div>` : ""}
`;

  return ssrHtmlShell({
    title: `What is ${t.term.split(" (")[0]}? — Medical Glossary | Tabula Medica`,
    description: `${t.definition.slice(0, 155)}...`,
    canonical: `${SITE_URL}/learn/${t.slug}`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Medical Glossary", url: "/learn" },
      { name: t.term.split(" (")[0], url: `/learn/${t.slug}` },
    ],
    body,
  });
}

export function getGlossaryIndexHtml(): string {
  const byCategory: Record<string, GlossaryTerm[]> = {};
  for (const t of TERMS) {
    (byCategory[t.category] = byCategory[t.category] || []).push(t);
  }

  const sections = Object.entries(byCategory)
    .map(([cat, terms]) => {
      const links = terms
        .map((t) => `<a href="/learn/${t.slug}" style="text-decoration:none;color:inherit;"><div class="card" style="padding:16px;margin-bottom:0;"><strong>${t.term}</strong><br/><span style="font-size:13px;color:#6b7280;">${t.definition.slice(0, 100)}...</span></div></a>`)
        .join("");
      return `<h2>${cat}</h2><div class="grid grid-2">${links}</div>`;
    })
    .join("");

  return ssrHtmlShell({
    title: `Medical Glossary — ${TERMS.length} Health Terms Explained | Tabula Medica`,
    description: `Plain-language explanations of ${TERMS.length} medical terms you'll find in your health records. Lab results, vital signs, insurance terms, and healthcare technology.`,
    canonical: `${SITE_URL}/learn`,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Medical Glossary", url: "/learn" },
    ],
    body: `<h1>Medical Glossary</h1><p>Understanding your health records starts with understanding the terminology. ${TERMS.length} medical terms explained in plain language, with context on how they appear in your unified Tabula Medica records.</p>${sections}`,
  });
}
