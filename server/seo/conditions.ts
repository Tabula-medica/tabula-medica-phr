import { ssrHtmlShell, SITE_URL } from "./ssr-shared";

interface Condition {
  slug: string;
  name: string;
  icd10: string;
  prevalence: string;
  category: string;
  description: string;
  keyMetrics: { name: string; target: string; frequency: string }[];
  recordTypes: string[];
  managementTips: string[];
  warningSignsInRecords: string[];
  relatedConditions: string[];
}

const CONDITIONS: Condition[] = [
  { slug: "type-2-diabetes", name: "Type 2 Diabetes", icd10: "E11", prevalence: "37.3 million Americans (11.3%)", category: "Metabolic", description: "A chronic condition where the body doesn't use insulin properly, leading to elevated blood sugar levels. It develops gradually and is influenced by genetics, diet, activity level, and weight.", keyMetrics: [{ name: "A1C", target: "Below 7.0%", frequency: "Every 3 months" }, { name: "Fasting Glucose", target: "80–130 mg/dL", frequency: "Daily or per doctor" }, { name: "Blood Pressure", target: "Below 130/80", frequency: "Every visit" }, { name: "Lipid Panel", target: "LDL below 100 mg/dL", frequency: "Annually" }, { name: "eGFR / Creatinine", target: "eGFR above 60", frequency: "Annually" }, { name: "Urine Albumin", target: "Below 30 mg/g", frequency: "Annually" }], recordTypes: ["Lab Results", "Medications", "Vital Signs", "Conditions", "Encounters"], managementTips: ["Track A1C trend over time — a single reading isn't the full picture", "Compare fasting glucose patterns across lab visits", "Watch for kidney function changes (eGFR declining)", "Keep a unified medication list to avoid duplicate prescriptions from different providers"], warningSignsInRecords: ["A1C trending upward despite medication", "eGFR dropping below 60 (kidney impact)", "Blood pressure consistently above 130/80", "New microalbumin in urine tests"], relatedConditions: ["hypertension", "chronic-kidney-disease"] },
  { slug: "hypertension", name: "Hypertension (High Blood Pressure)", icd10: "I10", prevalence: "116 million Americans (47%)", category: "Cardiovascular", description: "Consistently elevated blood pressure (130/80 mmHg or higher). Called 'the silent killer' because it usually has no symptoms but damages blood vessels, heart, kidneys, and brain over time.", keyMetrics: [{ name: "Blood Pressure", target: "Below 130/80 mmHg", frequency: "Every visit" }, { name: "BMP (Kidney Function)", target: "Normal creatinine and potassium", frequency: "1–2x per year" }, { name: "Lipid Panel", target: "LDL below 100 mg/dL", frequency: "Annually" }, { name: "Urine Albumin", target: "Below 30 mg/g", frequency: "Annually" }], recordTypes: ["Vital Signs", "Medications", "Lab Results", "Conditions"], managementTips: ["Compare blood pressure readings across providers — office readings are often higher than home readings (white coat hypertension)", "Track medication changes and correlate with BP trends", "Monitor potassium levels when on ACE inhibitors or ARBs", "Watch kidney function markers as hypertension damages kidneys over decades"], warningSignsInRecords: ["Blood pressure consistently above 140/90 despite medication", "Rising creatinine (kidney damage from uncontrolled BP)", "Multiple medication additions without improvement", "New proteinuria (protein in urine)"], relatedConditions: ["type-2-diabetes", "chronic-kidney-disease"] },
  { slug: "chronic-kidney-disease", name: "Chronic Kidney Disease (CKD)", icd10: "N18", prevalence: "37 million Americans (15%)", category: "Renal", description: "Progressive loss of kidney function over months or years. Kidneys filter waste from blood — when they fail, toxins build up. Staged 1–5 based on GFR, with Stage 5 requiring dialysis or transplant.", keyMetrics: [{ name: "eGFR", target: "Above 60 mL/min (Stage 1–2)", frequency: "Every 3–6 months" }, { name: "Creatinine", target: "Within normal range", frequency: "Every 3–6 months" }, { name: "Urine Albumin-to-Creatinine Ratio", target: "Below 30 mg/g", frequency: "Annually" }, { name: "Potassium", target: "3.5–5.0 mEq/L", frequency: "Every 3–6 months" }, { name: "Phosphorus", target: "2.5–4.5 mg/dL", frequency: "Per nephrologist" }, { name: "Blood Pressure", target: "Below 130/80", frequency: "Every visit" }], recordTypes: ["Lab Results", "Medications", "Vital Signs", "Conditions", "Procedures", "Encounters"], managementTips: ["GFR trend is more important than any single reading — a slow decline is expected with age, but rapid drops signal problems", "Collect labs from all providers (primary care, nephrologist, hospital) to see the complete kidney timeline", "Track potassium carefully — many kidney patients restrict potassium but multiple doctors may not coordinate", "Monitor phosphorus in later stages — elevated phosphorus accelerates bone loss"], warningSignsInRecords: ["GFR dropping more than 5 points per year", "New or worsening proteinuria", "Potassium above 5.5 (hyperkalemia risk)", "Hemoglobin dropping (kidneys produce less EPO)"], relatedConditions: ["type-2-diabetes", "hypertension"] },
  { slug: "asthma", name: "Asthma", icd10: "J45", prevalence: "25 million Americans (7.7%)", category: "Respiratory", description: "A chronic lung condition where airways become inflamed and narrowed, causing wheezing, shortness of breath, chest tightness, and coughing. Severity ranges from intermittent to severe persistent.", keyMetrics: [{ name: "Peak Flow / Spirometry", target: "Above 80% predicted", frequency: "At checkups or as symptoms change" }, { name: "FEV1", target: "Above 80% predicted", frequency: "1–2x per year" }, { name: "Eosinophil Count", target: "Context-dependent", frequency: "When evaluating severity" }, { name: "IgE Level", target: "Context-dependent", frequency: "At diagnosis or for biologics evaluation" }], recordTypes: ["Conditions", "Medications", "Procedures", "Encounters", "Diagnostic Reports"], managementTips: ["Track rescue inhaler usage frequency — using it more than 2x/week suggests uncontrolled asthma", "Compare spirometry results over time to detect lung function decline", "Keep an up-to-date medication list — controller inhalers vs. rescue inhalers matter for step therapy", "Document ER visits and hospitalizations for asthma — this history determines severity classification"], warningSignsInRecords: ["Increasing rescue inhaler prescriptions", "Multiple ER visits for respiratory distress", "Declining FEV1 on spirometry", "Oral steroid prescriptions more than 2x per year"], relatedConditions: [] },
  { slug: "major-depression", name: "Major Depressive Disorder", icd10: "F33", prevalence: "21 million Americans (8.3%)", category: "Mental Health", description: "A mood disorder causing persistent feelings of sadness, hopelessness, and loss of interest in activities. It affects sleep, appetite, energy, concentration, and daily functioning. It's distinct from normal sadness — MDD persists for weeks or months.", keyMetrics: [{ name: "PHQ-9 Score", target: "Below 5 (minimal)", frequency: "Every visit during treatment" }, { name: "GAD-7 (if comorbid anxiety)", target: "Below 5", frequency: "Every visit" }, { name: "Thyroid Panel (TSH)", target: "0.4–4.0 mIU/L", frequency: "At diagnosis to rule out thyroid cause" }, { name: "Vitamin D", target: "30–100 ng/mL", frequency: "At diagnosis" }], recordTypes: ["Conditions", "Medications", "Encounters", "Clinical Notes"], managementTips: ["PHQ-9 trend is the most important metric — look for scores decreasing over time with treatment", "Track medication changes (antidepressants often take 4–6 weeks to work; premature switches are common)", "Thyroid issues mimic depression — ensure TSH was checked at diagnosis", "Document therapy visits alongside medication for a complete picture of treatment"], warningSignsInRecords: ["PHQ-9 score above 15 (moderate-severe) without treatment escalation", "Multiple antidepressant switches in under 4 weeks each", "No thyroid panel at initial diagnosis", "Gap in care visits longer than 3 months"], relatedConditions: [] },
  { slug: "anxiety-disorders", name: "Generalized Anxiety Disorder", icd10: "F41.1", prevalence: "40 million Americans (19.1%)", category: "Mental Health", description: "Persistent, excessive worry about everyday matters that is difficult to control and interferes with daily functioning. Physical symptoms include muscle tension, restlessness, fatigue, difficulty concentrating, and sleep disturbance.", keyMetrics: [{ name: "GAD-7 Score", target: "Below 5 (minimal)", frequency: "Every visit during treatment" }, { name: "PHQ-9 (if comorbid depression)", target: "Below 5", frequency: "Every visit" }, { name: "Thyroid Panel (TSH)", target: "0.4–4.0 mIU/L", frequency: "At diagnosis" }, { name: "CBC", target: "Normal ranges", frequency: "At diagnosis" }], recordTypes: ["Conditions", "Medications", "Encounters", "Clinical Notes"], managementTips: ["Track GAD-7 scores over time to measure treatment effectiveness", "Document both therapy and medication in your records for a complete view", "Caffeine and stimulant medications can worsen anxiety — review full medication list", "Monitor for comorbid depression (PHQ-9) as they frequently co-occur"], warningSignsInRecords: ["GAD-7 score above 15 without treatment escalation", "Benzodiazepine prescriptions lasting more than 4 weeks (dependency risk)", "No CBT/therapy referral alongside medication", "Multiple ER visits for panic attacks without follow-up care plan"], relatedConditions: ["major-depression"] },
];

export function getConditionSlugs(): string[] {
  return CONDITIONS.map((c) => c.slug);
}

export function getConditionHtml(slug: string): string | null {
  const c = CONDITIONS.find((x) => x.slug === slug);
  if (!c) return null;

  const metricsRows = c.keyMetrics.map((m) => `<tr><td><strong>${m.name}</strong></td><td>${m.target}</td><td>${m.frequency}</td></tr>`).join("");

  const related = c.relatedConditions
    .map((rs) => {
      const rc = CONDITIONS.find((x) => x.slug === rs);
      return rc ? `<a href="/conditions/${rc.slug}" style="text-decoration:none;"><span class="badge">${rc.name.split(" (")[0]}</span></a>` : "";
    })
    .filter(Boolean)
    .join(" ");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `${c.name} — Record Tracking Guide`,
    description: c.description.slice(0, 160),
    url: `${SITE_URL}/conditions/${c.slug}`,
    about: { "@type": "MedicalCondition", name: c.name, code: { "@type": "MedicalCode", codeValue: c.icd10, codingSystem: "ICD-10" } },
  });

  const body = `
<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
  <span class="badge">${c.category}</span>
  <span class="badge" style="background:#FEF3C7;color:#92400E;">ICD-10: ${c.icd10}</span>
</div>
<h1>${c.name}: Track It in Your Records</h1>
<p>${c.description}</p>
<p><strong>Prevalence:</strong> ${c.prevalence}</p>

<h2>Key Metrics to Track</h2>
<p>These are the numbers that matter most for managing ${c.name.split(" (")[0]}. Tabula Medica pulls these from all your connected providers and shows trends over time.</p>
<table>
  <thead><tr><th>Metric</th><th>Target</th><th>How Often</th></tr></thead>
  <tbody>${metricsRows}</tbody>
</table>

<h2>Record Types You'll Need</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">
  ${c.recordTypes.map((r) => `<span class="badge">${r}</span>`).join("")}
</div>

<h2>Management Tips from Your Records</h2>
<ul style="margin-left:20px;color:#374151;">
  ${c.managementTips.map((t) => `<li style="margin-bottom:8px;">${t}</li>`).join("")}
</ul>

<h2>Warning Signs to Watch For</h2>
<p>Tabula Medica's AI can flag these patterns across your unified records:</p>
<div class="grid grid-2">
  ${c.warningSignsInRecords.map((w) => `<div class="card" style="padding:12px 16px;margin-bottom:0;border-left:3px solid #EF4444;">⚠ ${w}</div>`).join("")}
</div>

${related ? `<h2>Related Conditions</h2><div style="display:flex;flex-wrap:wrap;gap:8px;">${related}</div>` : ""}
`;

  return ssrHtmlShell({
    title: `${c.name} — Track Key Metrics in Your Health Records | Tabula Medica`,
    description: `Managing ${c.name.split(" (")[0]}? Track ${c.keyMetrics[0].name}, ${c.keyMetrics[1]?.name || ""} and more across all your providers. Unified, summarized, and deduplicated.`,
    canonical: `${SITE_URL}/conditions/${c.slug}`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Conditions", url: "/conditions" },
      { name: c.name.split(" (")[0], url: `/conditions/${c.slug}` },
    ],
    body,
  });
}

export function getConditionsIndexHtml(): string {
  const byCategory: Record<string, Condition[]> = {};
  for (const c of CONDITIONS) {
    (byCategory[c.category] = byCategory[c.category] || []).push(c);
  }

  const sections = Object.entries(byCategory)
    .map(([cat, conds]) => {
      const cards = conds
        .map((c) => `<a href="/conditions/${c.slug}" style="text-decoration:none;color:inherit;"><div class="card" style="margin-bottom:0;"><strong>${c.name}</strong><br/><span style="font-size:13px;color:#6b7280;">${c.prevalence} · ${c.keyMetrics.length} key metrics · ${c.recordTypes.length} record types</span></div></a>`)
        .join("");
      return `<h2>${cat}</h2><div class="grid grid-2">${cards}</div>`;
    })
    .join("");

  return ssrHtmlShell({
    title: `Condition Guides — Track Health Metrics in Your Records | Tabula Medica`,
    description: `Guides for managing chronic conditions through your health records. Key metrics, warning signs, and management tips for diabetes, hypertension, CKD, and more.`,
    canonical: `${SITE_URL}/conditions`,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Conditions", url: "/conditions" },
    ],
    body: `<h1>Condition Guides</h1><p>Managing a chronic condition means tracking the right numbers over time. These guides show which metrics matter, what warning signs to watch for, and how Tabula Medica's unified records help you stay on top of your health.</p>${sections}`,
  });
}
