import { ssrHtmlShell, SITE_URL } from "./ssr-shared";

interface Drug {
  slug: string;
  name: string;
  genericName: string;
  brandName: string;
  category: string;
  commonUses: string[];
  avgRetailPrice: string;
  avgGenericPrice: string;
  goodRxPrice: string;
  costPlusPrice: string;
  manufacturer: string;
  alternatives: string[];
  savingsTips: string[];
  patientAssistance: string;
}

const DRUGS: Drug[] = [
  { slug: "metformin", name: "Metformin", genericName: "Metformin HCl", brandName: "Glucophage", category: "Diabetes", commonUses: ["Type 2 Diabetes", "Prediabetes", "PCOS (off-label)"], avgRetailPrice: "$45/month", avgGenericPrice: "$4/month", goodRxPrice: "$4–$8/month", costPlusPrice: "$3.60/month", manufacturer: "Various (generic)", alternatives: ["glipizide", "sitagliptin"], savingsTips: ["Metformin is one of the cheapest medications available — always request generic", "Walmart, Costco, and many pharmacies offer $4/month generic pricing", "Mark Cuban's Cost Plus Drugs offers metformin for $3.60/month", "If you're prescribed brand-name Glucophage, ask your doctor about switching to generic — they're therapeutically identical"], patientAssistance: "Most manufacturers don't offer PAPs for metformin because generic pricing is already very low. However, if even $4/month is a burden, many FQHCs provide metformin free through 340B pricing." },
  { slug: "lisinopril", name: "Lisinopril", genericName: "Lisinopril", brandName: "Prinivil / Zestril", category: "Blood Pressure", commonUses: ["Hypertension", "Heart Failure", "Kidney Protection in Diabetes"], avgRetailPrice: "$35/month", avgGenericPrice: "$4/month", goodRxPrice: "$3–$7/month", costPlusPrice: "$3.60/month", manufacturer: "Various (generic)", alternatives: ["losartan", "amlodipine"], savingsTips: ["Generic lisinopril is available at $4/month at most pharmacies", "If you experience a cough (common ACE inhibitor side effect), losartan (an ARB) is equally cheap", "90-day supplies are often cheaper per pill than 30-day supplies", "Always compare prices at your pharmacy vs. mail-order — mail-order is often 30-50% cheaper"], patientAssistance: "Like metformin, generic lisinopril is already very affordable. FQHCs with 340B pharmacies often provide it free. If you take brand-name Prinivil, ask about switching to generic." },
  { slug: "atorvastatin", name: "Atorvastatin", genericName: "Atorvastatin Calcium", brandName: "Lipitor", category: "Cholesterol", commonUses: ["High Cholesterol", "Cardiovascular Risk Reduction", "Post-Heart Attack Prevention"], avgRetailPrice: "$150/month", avgGenericPrice: "$6/month", goodRxPrice: "$5–$12/month", costPlusPrice: "$4.20/month", manufacturer: "Pfizer (brand); Various (generic)", alternatives: ["rosuvastatin", "simvastatin"], savingsTips: ["Brand-name Lipitor costs $150+/month — generic atorvastatin is $5-6/month and therapeutically identical", "Atorvastatin is available at $4/month through Walmart and similar pharmacy programs", "If your doctor prescribed rosuvastatin (Crestor), note that atorvastatin is often equally effective and cheaper", "Never stop a statin without discussing with your doctor — the cardiovascular risk reduction is substantial"], patientAssistance: "Pfizer offers a patient assistance program for brand Lipitor for uninsured patients earning below 400% FPL. However, generic atorvastatin is so affordable that brand-name is rarely necessary." },
  { slug: "albuterol", name: "Albuterol Inhaler", genericName: "Albuterol Sulfate HFA", brandName: "ProAir / Ventolin / Proventil", category: "Respiratory", commonUses: ["Asthma (rescue inhaler)", "COPD", "Exercise-Induced Bronchospasm"], avgRetailPrice: "$80/inhaler", avgGenericPrice: "$25–$35/inhaler", goodRxPrice: "$15–$30/inhaler", costPlusPrice: "$14.40/inhaler", manufacturer: "Various", alternatives: ["levalbuterol"], savingsTips: ["Generic albuterol HFA inhalers are now available and significantly cheaper than brand names", "Mark Cuban's Cost Plus Drugs offers albuterol for $14.40/inhaler", "If you use more than 2 inhalers per month, you likely need a controller inhaler — talk to your doctor about stepping up therapy", "Many pharmaceutical manufacturers offer copay cards that reduce brand-name inhaler costs to $0-$25"], patientAssistance: "GSK (Ventolin) and Teva (ProAir) both offer patient assistance programs for uninsured patients. Apply through their websites or via NeedyMeds.org." },
  { slug: "levothyroxine", name: "Levothyroxine", genericName: "Levothyroxine Sodium", brandName: "Synthroid", category: "Thyroid", commonUses: ["Hypothyroidism", "Post-Thyroidectomy Hormone Replacement", "TSH Suppression (thyroid cancer)"], avgRetailPrice: "$45/month", avgGenericPrice: "$4/month", goodRxPrice: "$4–$10/month", costPlusPrice: "$3.90/month", manufacturer: "AbbVie (Synthroid); Various (generic)", alternatives: ["liothyronine"], savingsTips: ["Generic levothyroxine is available at $4/month — brand-name Synthroid is $45+", "Important: thyroid medication requires consistent dosing. If you switch from brand to generic (or between generic manufacturers), get your TSH rechecked in 6 weeks", "Take on an empty stomach, 30-60 minutes before eating, for consistent absorption", "90-day mail-order prescriptions are typically cheaper per pill"], patientAssistance: "AbbVie offers a PAP for brand Synthroid. However, generic levothyroxine is therapeutically equivalent for most patients and costs $4/month." },
  { slug: "omeprazole", name: "Omeprazole", genericName: "Omeprazole", brandName: "Prilosec", category: "Gastrointestinal", commonUses: ["GERD (Acid Reflux)", "Stomach Ulcers", "H. pylori Treatment (part of regimen)"], avgRetailPrice: "$25/month", avgGenericPrice: "$4/month", goodRxPrice: "$4–$8/month", costPlusPrice: "$3.60/month", manufacturer: "AstraZeneca (Prilosec); Various (generic)", alternatives: ["pantoprazole", "esomeprazole"], savingsTips: ["Generic omeprazole is $4/month at most pharmacies and available OTC (over-the-counter)", "OTC omeprazole (Prilosec OTC) is often cheaper than a prescription copay — ask your pharmacist", "PPIs are meant for short-term use (8-12 weeks). Long-term use should be reviewed by your doctor", "If omeprazole doesn't work, ask about pantoprazole or famotidine before jumping to expensive brand-name options"], patientAssistance: "Omeprazole is available OTC and at generic $4 pricing, making PAPs unnecessary for most patients." },
  { slug: "sertraline", name: "Sertraline", genericName: "Sertraline HCl", brandName: "Zoloft", category: "Mental Health", commonUses: ["Major Depression", "Generalized Anxiety Disorder", "PTSD", "OCD", "Panic Disorder"], avgRetailPrice: "$60/month", avgGenericPrice: "$4/month", goodRxPrice: "$4–$10/month", costPlusPrice: "$3.90/month", manufacturer: "Pfizer (Zoloft); Various (generic)", alternatives: ["escitalopram", "fluoxetine"], savingsTips: ["Generic sertraline is one of the cheapest antidepressants at $4/month", "Never abruptly stop an SSRI — work with your doctor to taper gradually", "If you experience side effects, other SSRIs (escitalopram, fluoxetine) are equally affordable", "Some pharmacies offer free mental health medication programs — ask your pharmacist"], patientAssistance: "Pfizer offers a PAP for brand Zoloft for uninsured patients. Generic sertraline is widely available at $4/month." },
  { slug: "amlodipine", name: "Amlodipine", genericName: "Amlodipine Besylate", brandName: "Norvasc", category: "Blood Pressure", commonUses: ["Hypertension", "Angina (Chest Pain)", "Coronary Artery Disease"], avgRetailPrice: "$50/month", avgGenericPrice: "$4/month", goodRxPrice: "$3–$8/month", costPlusPrice: "$3.60/month", manufacturer: "Pfizer (Norvasc); Various (generic)", alternatives: ["lisinopril", "losartan"], savingsTips: ["Generic amlodipine is $4/month at most pharmacies", "Ankle swelling is a common side effect — if bothersome, discuss switching to an ACE inhibitor or ARB", "Amlodipine can be combined with other BP meds (lisinopril + amlodipine) — combination pills may cost less than two separate prescriptions", "Check if your insurance covers 90-day supplies at lower copay rates"], patientAssistance: "Generic amlodipine is already very affordable. Pfizer offers a PAP for brand-name Norvasc." },
];

export function getDrugSlugs(): string[] {
  return DRUGS.map((d) => d.slug);
}

export function getDrugHtml(slug: string): string | null {
  const d = DRUGS.find((x) => x.slug === slug);
  if (!d) return null;

  const relatedLinks = d.alternatives
    .map((a) => {
      const rd = DRUGS.find((x) => x.slug === a);
      return rd ? `<a href="/drug-savings/${rd.slug}" style="text-decoration:none;"><span class="badge">${rd.name}</span></a>` : "";
    })
    .filter(Boolean)
    .join(" ");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `${d.name} Savings & Price Comparison`,
    description: `Compare ${d.name} (${d.brandName}) prices. Retail: ${d.avgRetailPrice}, Generic: ${d.avgGenericPrice}, Cost Plus: ${d.costPlusPrice}.`,
    url: `${SITE_URL}/drug-savings/${d.slug}`,
    about: { "@type": "Drug", nonProprietaryName: d.genericName, proprietaryName: d.brandName },
  });

  const body = `
<span class="badge">${d.category}</span>
<h1>${d.name} (${d.brandName}) — Price Comparison &amp; Savings</h1>
<p>${d.genericName} is used for ${d.commonUses.join(", ")}. Here's how to save money on this medication.</p>

<div class="grid grid-2" style="margin:24px 0;">
  <div class="card" style="text-align:center;margin-bottom:0;border-top:3px solid #EF4444;">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Avg Retail Price</div>
    <div style="font-size:1.75rem;font-weight:700;color:#EF4444;">${d.avgRetailPrice}</div>
  </div>
  <div class="card" style="text-align:center;margin-bottom:0;border-top:3px solid #10B981;">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Generic Price</div>
    <div style="font-size:1.75rem;font-weight:700;color:#10B981;">${d.avgGenericPrice}</div>
  </div>
</div>

<h2>Price Comparison</h2>
<table>
  <thead><tr><th>Source</th><th>Price</th></tr></thead>
  <tbody>
    <tr><td>Average Retail (Brand)</td><td>${d.avgRetailPrice}</td></tr>
    <tr><td>Generic (Pharmacy)</td><td>${d.avgGenericPrice}</td></tr>
    <tr><td>GoodRx Coupon</td><td>${d.goodRxPrice}</td></tr>
    <tr><td>Mark Cuban Cost Plus Drugs</td><td style="color:#10B981;font-weight:600;">${d.costPlusPrice}</td></tr>
  </tbody>
</table>

<h2>Common Uses</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;">
  ${d.commonUses.map((u) => `<span class="badge">${u}</span>`).join("")}
</div>

<h2>How to Save on ${d.name}</h2>
<ul style="margin-left:20px;color:#374151;">
  ${d.savingsTips.map((t) => `<li style="margin-bottom:8px;">${t}</li>`).join("")}
</ul>

<h2>Patient Assistance</h2>
<p>${d.patientAssistance}</p>

<h2>Track ${d.name} in Your Records</h2>
<p>Tabula Medica pulls your prescription history from all connected pharmacies and providers. See when ${d.name} was prescribed, by whom, at what dose, and track refill patterns — all deduplicated across CVS, Walgreens, and hospital pharmacies.</p>

${relatedLinks ? `<h2>Alternative Medications</h2><div style="display:flex;flex-wrap:wrap;gap:8px;">${relatedLinks}</div>` : ""}
`;

  return ssrHtmlShell({
    title: `${d.name} (${d.brandName}) Savings — From ${d.avgRetailPrice} to ${d.costPlusPrice} | Tabula Medica`,
    description: `Save on ${d.name} (${d.genericName}). Compare prices: Retail ${d.avgRetailPrice}, Generic ${d.avgGenericPrice}, Cost Plus ${d.costPlusPrice}. Tips, alternatives, and patient assistance.`,
    canonical: `${SITE_URL}/drug-savings/${d.slug}`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Drug Savings", url: "/drug-savings" },
      { name: d.name, url: `/drug-savings/${d.slug}` },
    ],
    body,
  });
}

export function getDrugSavingsIndexHtml(): string {
  const byCategory: Record<string, Drug[]> = {};
  for (const d of DRUGS) {
    (byCategory[d.category] = byCategory[d.category] || []).push(d);
  }

  const sections = Object.entries(byCategory)
    .map(([cat, drugs]) => {
      const cards = drugs
        .map((d) => `<a href="/drug-savings/${d.slug}" style="text-decoration:none;color:inherit;"><div class="card" style="margin-bottom:0;"><strong>${d.name}</strong> <span style="font-size:13px;color:#6b7280;">(${d.brandName})</span><br/><span style="font-size:13px;"><span style="color:#EF4444;text-decoration:line-through;">${d.avgRetailPrice}</span> → <span style="color:#10B981;font-weight:600;">${d.costPlusPrice}</span></span></div></a>`)
        .join("");
      return `<h2>${cat}</h2><div class="grid grid-2">${cards}</div>`;
    })
    .join("");

  return ssrHtmlShell({
    title: `Drug Savings — Compare Medication Prices | Tabula Medica`,
    description: `Compare prices for common medications. Find generic alternatives, GoodRx coupons, Cost Plus Drug prices, and patient assistance programs.`,
    canonical: `${SITE_URL}/drug-savings`,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Drug Savings", url: "/drug-savings" },
    ],
    body: `<h1>Drug Savings Guide</h1><p>Most medications have affordable generic alternatives. Compare brand vs. generic pricing, find the cheapest source, and learn about patient assistance programs.</p>${sections}`,
  });
}
