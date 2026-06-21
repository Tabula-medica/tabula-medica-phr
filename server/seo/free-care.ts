import { ssrHtmlShell, SITE_URL } from "./ssr-shared";

interface StateData {
  slug: string;
  state: string;
  abbr: string;
  fqhcCount: number;
  uninsuredRate: string;
  uninsuredPop: string;
  medicaidExpanded: boolean;
  keyPrograms: string[];
  topFqhcs: { name: string; city: string; services: string[] }[];
  slidingScaleInfo: string;
  prescriptionHelp: string[];
}

const STATES: StateData[] = [
  { slug: "california", state: "California", abbr: "CA", fqhcCount: 1370, uninsuredRate: "6.8%", uninsuredPop: "2.7M", medicaidExpanded: true, keyPrograms: ["Medi-Cal (Medicaid)", "Covered California Marketplace", "County Indigent Programs", "Emergency Medi-Cal"], topFqhcs: [{ name: "AltaMed Health Services", city: "Los Angeles", services: ["Primary Care", "Dental", "Behavioral Health", "Pharmacy"] }, { name: "Community Health Center Network", city: "Oakland", services: ["Primary Care", "Women's Health", "Pediatrics"] }, { name: "La Clinica de La Raza", city: "Oakland", services: ["Primary Care", "Dental", "Vision", "Mental Health"] }], slidingScaleInfo: "Most California FQHCs use a sliding fee scale based on federal poverty guidelines. At 100% FPL, visits typically cost $20–40. Below 100% FPL, many services are free.", prescriptionHelp: ["Medi-Cal covers most prescriptions at $0–$1 copay", "California's $30 insulin cap applies even without insurance", "Mark Cuban Cost Plus Drugs ships to all CA addresses", "Manufacturer Patient Assistance Programs (PAPs)"] },
  { slug: "texas", state: "Texas", abbr: "TX", fqhcCount: 764, uninsuredRate: "18.0%", uninsuredPop: "5.4M", medicaidExpanded: false, keyPrograms: ["Texas Medicaid (limited eligibility)", "CHIP (Children's Health Insurance)", "Harris Health Gold Card (Harris County)", "Parkland Financial Assistance (Dallas County)"], topFqhcs: [{ name: "Community Health Choice", city: "Houston", services: ["Primary Care", "Dental", "Behavioral Health"] }, { name: "Lone Star Circle of Care", city: "Georgetown", services: ["Primary Care", "Dental", "Women's Health", "Pharmacy"] }, { name: "Parkland Health", city: "Dallas", services: ["Primary Care", "Specialty Care", "Trauma", "Mental Health"] }], slidingScaleInfo: "Texas has not expanded Medicaid, so FQHCs serve a larger uninsured population. Sliding scale fees are typically based on family size and income. At or below 100% FPL, many FQHCs offer free primary care visits.", prescriptionHelp: ["340B Drug Pricing at FQHC pharmacies (40-60% discount)", "Texas Rx Card — free prescription discount card", "GoodRx and Mark Cuban Cost Plus Drugs", "NeedyMeds database for manufacturer assistance"] },
  { slug: "florida", state: "Florida", abbr: "FL", fqhcCount: 680, uninsuredRate: "12.2%", uninsuredPop: "2.7M", medicaidExpanded: false, keyPrograms: ["Florida Medicaid (limited eligibility)", "Florida KidCare (children)", "Safety Net Hospital Alliance", "County Health Departments"], topFqhcs: [{ name: "Community Health of South Florida", city: "Miami", services: ["Primary Care", "Dental", "Pharmacy", "Social Services"] }, { name: "Health Care Network", city: "Fort Lauderdale", services: ["Primary Care", "Pediatrics", "OB/GYN"] }, { name: "Suncoast Community Health Centers", city: "Tampa", services: ["Primary Care", "Dental", "Behavioral Health", "Pharmacy"] }], slidingScaleInfo: "Florida FQHCs serve over 1.5 million patients annually. Sliding fee scales reduce visit costs to $20-50 for those at or below 200% FPL. Free care is available for those below 100% FPL at many locations.", prescriptionHelp: ["340B pricing at FQHC in-house pharmacies", "Florida Discount Drug Card", "Manufacturer PAPs via NeedyMeds", "Walmart $4 generic prescription program"] },
  { slug: "new-york", state: "New York", abbr: "NY", fqhcCount: 880, uninsuredRate: "5.2%", uninsuredPop: "1.0M", medicaidExpanded: true, keyPrograms: ["NY Medicaid (expanded)", "Essential Plan ($0-$20/mo)", "NY State of Health Marketplace", "Emergency Medicaid"], topFqhcs: [{ name: "NYC Health + Hospitals", city: "New York City", services: ["Primary Care", "Specialty Care", "Mental Health", "Dental", "Pharmacy"] }, { name: "Community Healthcare Network", city: "New York City", services: ["Primary Care", "Behavioral Health", "Nutrition"] }, { name: "Hudson River HealthCare", city: "Peekskill", services: ["Primary Care", "Dental", "Behavioral Health"] }], slidingScaleInfo: "New York's expanded Medicaid and Essential Plan cover most low-income residents. FQHCs offer sliding scale for those who fall through gaps. NYC Health + Hospitals guarantees care regardless of ability to pay or immigration status.", prescriptionHelp: ["Medicaid covers most prescriptions at $0–$3 copay", "Essential Plan covers generic drugs at $0", "NYC Rx Card for uninsured residents", "340B pricing at FQHC pharmacies"] },
  { slug: "pennsylvania", state: "Pennsylvania", abbr: "PA", fqhcCount: 380, uninsuredRate: "5.6%", uninsuredPop: "730K", medicaidExpanded: true, keyPrograms: ["PA Medicaid (expanded)", "Pennie Marketplace", "CHIP (children)", "Hospital Financial Assistance Programs"], topFqhcs: [{ name: "Public Health Management Corporation", city: "Philadelphia", services: ["Primary Care", "Dental", "Behavioral Health"] }, { name: "Family Health Council", city: "Pittsburgh", services: ["Primary Care", "Women's Health", "Family Planning"] }, { name: "Hamilton Health Center", city: "Harrisburg", services: ["Primary Care", "Dental", "WIC", "Behavioral Health"] }], slidingScaleInfo: "Pennsylvania's Medicaid expansion covers adults up to 138% FPL. FQHCs provide sliding scale fees for those above Medicaid limits but unable to afford marketplace plans.", prescriptionHelp: ["Medicaid covers most prescriptions at $0–$3", "PA PACE/PACENET for seniors' prescriptions", "340B pricing at FQHC pharmacies", "Manufacturer PAPs"] },
  { slug: "illinois", state: "Illinois", abbr: "IL", fqhcCount: 460, uninsuredRate: "6.1%", uninsuredPop: "770K", medicaidExpanded: true, keyPrograms: ["IL Medicaid (expanded)", "Get Covered Illinois Marketplace", "All Kids (children)", "Cook County Health (Countycare)"], topFqhcs: [{ name: "Erie Family Health Centers", city: "Chicago", services: ["Primary Care", "Dental", "Behavioral Health", "Pharmacy"] }, { name: "Heartland Health Centers", city: "Chicago", services: ["Primary Care", "Pediatrics", "OB/GYN"] }, { name: "Southern Illinois Healthcare Foundation", city: "East St. Louis", services: ["Primary Care", "Dental", "Vision"] }], slidingScaleInfo: "Illinois expanded Medicaid in 2014, covering adults up to 138% FPL. FQHCs offer sliding scale for those between 138-200% FPL. Cook County Health's CareLink program provides free/low-cost care to county residents.", prescriptionHelp: ["Medicaid covers prescriptions at $0–$3 copay", "Illinois Rx Buying Club", "340B pricing at FQHC pharmacies", "Cook County Health pharmacy programs"] },
];

export function getStateSlugs(): string[] {
  return STATES.map((s) => s.slug);
}

export function getFreeCareHtml(slug: string): string | null {
  const s = STATES.find((x) => x.slug === slug);
  if (!s) return null;

  const fqhcCards = s.topFqhcs
    .map(
      (f) => `<div class="card" style="margin-bottom:0;">
    <h3 style="margin-top:0;">${f.name}</h3>
    <p style="color:#6b7280;margin-bottom:8px;">${f.city}, ${s.abbr}</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">${f.services.map((sv) => `<span class="badge">${sv}</span>`).join("")}</div>
  </div>`
    )
    .join("");

  const programList = s.keyPrograms.map((p) => `<li style="margin-bottom:6px;">${p}</li>`).join("");
  const rxList = s.prescriptionHelp.map((r) => `<li style="margin-bottom:6px;">${r}</li>`).join("");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `Free & Low-Cost Healthcare in ${s.state}`,
    description: `Find ${s.fqhcCount}+ community health centers in ${s.state}. ${s.uninsuredPop} ${s.state} residents are uninsured — these resources provide free or sliding-scale care.`,
    url: `${SITE_URL}/free-care/${s.slug}`,
    about: { "@type": "MedicalCondition", name: "Uninsured Healthcare Access" },
  });

  const body = `
<h1>Free &amp; Low-Cost Healthcare in ${s.state}</h1>
<p><strong>${s.uninsuredPop}</strong> people in ${s.state} are uninsured (${s.uninsuredRate} uninsured rate). ${s.medicaidExpanded ? `${s.state} has expanded Medicaid, covering adults up to 138% of the federal poverty level.` : `${s.state} has not expanded Medicaid, which means many low-income adults fall into a coverage gap.`}</p>

<div class="grid grid-3">
  <div class="card" style="text-align:center;margin-bottom:0;"><div style="font-size:2rem;font-weight:700;color:#3366E8;">${s.fqhcCount}+</div><div style="font-size:13px;color:#6b7280;">Community Health Centers</div></div>
  <div class="card" style="text-align:center;margin-bottom:0;"><div style="font-size:2rem;font-weight:700;color:#3366E8;">${s.uninsuredRate}</div><div style="font-size:13px;color:#6b7280;">Uninsured Rate</div></div>
  <div class="card" style="text-align:center;margin-bottom:0;"><div style="font-size:2rem;font-weight:700;color:${s.medicaidExpanded ? "#10B981" : "#EF4444"};">${s.medicaidExpanded ? "Yes" : "No"}</div><div style="font-size:13px;color:#6b7280;">Medicaid Expanded</div></div>
</div>

<h2>Coverage Programs in ${s.state}</h2>
<ul style="margin-left:20px;color:#374151;">${programList}</ul>

<h2>Top Community Health Centers</h2>
<div class="grid grid-2">${fqhcCards}</div>

<h2>Sliding Scale Fees</h2>
<p>${s.slidingScaleInfo}</p>

<h2>Prescription Savings in ${s.state}</h2>
<ul style="margin-left:20px;color:#374151;">${rxList}</ul>

<h2>Track Your Care with Tabula Medica</h2>
<p>Even without insurance, your health records matter. Tabula Medica's Starter plan lets you connect one provider for free — pull your FQHC records, lab results, and prescriptions into one unified view. No insurance required.</p>
`;

  return ssrHtmlShell({
    title: `Free Healthcare in ${s.state} — ${s.fqhcCount}+ Health Centers | Tabula Medica`,
    description: `Find free and low-cost healthcare in ${s.state}. ${s.fqhcCount}+ community health centers, sliding-scale fees, and prescription assistance for ${s.uninsuredPop} uninsured residents.`,
    canonical: `${SITE_URL}/free-care/${s.slug}`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Free Care", url: "/free-care" },
      { name: s.state, url: `/free-care/${s.slug}` },
    ],
    body,
  });
}

export function getFreeCareIndexHtml(): string {
  const cards = STATES.map(
    (s) => `<a href="/free-care/${s.slug}" style="text-decoration:none;color:inherit;">
    <div class="card" style="margin-bottom:0;">
      <strong>${s.state}</strong>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">${s.fqhcCount}+ health centers · ${s.uninsuredRate} uninsured · Medicaid ${s.medicaidExpanded ? "expanded" : "not expanded"}</div>
    </div></a>`
  ).join("");

  return ssrHtmlShell({
    title: `Free & Low-Cost Healthcare by State | Tabula Medica`,
    description: `Find free community health centers, sliding-scale clinics, and prescription assistance programs in every US state. Resources for uninsured patients.`,
    canonical: `${SITE_URL}/free-care`,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Free Care", url: "/free-care" },
    ],
    body: `<h1>Free &amp; Low-Cost Healthcare by State</h1><p>Find community health centers (FQHCs), Medicaid programs, and prescription assistance in your state. These federally funded health centers are required to serve everyone regardless of insurance status or ability to pay.</p><div class="grid grid-2">${cards}</div>`,
  });
}
