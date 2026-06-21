import { ssrHtmlShell, SITE_URL } from "./ssr-shared";

interface Provider {
  slug: string;
  name: string;
  type: "hospital" | "lab" | "imaging" | "pharmacy" | "clinic" | "health-system";
  city: string;
  state: string;
  ehrVendor: string;
  supportsFhir: boolean;
  patientPortalUrl?: string;
  website?: string;
  phone?: string;
  healthSystem?: string;
  dataTypes: string[];
  connectMethod: string;
  avgRecordCategories: number;
}

const PROVIDERS: Provider[] = [
  { slug: "johns-hopkins-hospital", name: "Johns Hopkins Hospital", type: "hospital", city: "Baltimore", state: "Maryland", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.hopkinsmedicine.org", website: "https://www.hopkinsmedicine.org", phone: "(410) 955-5000", healthSystem: "Johns Hopkins Health System", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Encounters", "Diagnostic Reports", "Clinical Notes"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 10 },
  { slug: "mayo-clinic", name: "Mayo Clinic", type: "hospital", city: "Rochester", state: "Minnesota", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.mayoclinic.org", website: "https://www.mayoclinic.org", phone: "(507) 284-2511", healthSystem: "Mayo Clinic Health System", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Encounters", "Radiology Reports", "Pathology Reports"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 10 },
  { slug: "cleveland-clinic", name: "Cleveland Clinic", type: "hospital", city: "Cleveland", state: "Ohio", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.clevelandclinic.org", website: "https://my.clevelandclinic.org", phone: "(216) 444-2200", healthSystem: "Cleveland Clinic Health System", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Clinical Notes"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
  { slug: "quest-diagnostics", name: "Quest Diagnostics", type: "lab", city: "Secaucus", state: "New Jersey", ehrVendor: "Quest Portal", supportsFhir: true, patientPortalUrl: "https://myquest.questdiagnostics.com", website: "https://www.questdiagnostics.com", phone: "(800) 222-0446", healthSystem: "Quest Diagnostics", dataTypes: ["Lab Results", "Diagnostic Reports", "Blood Work Panels", "Urinalysis", "Pathology"], connectMethod: "Direct FHIR API + MyQuest Portal", avgRecordCategories: 5 },
  { slug: "labcorp", name: "LabCorp", type: "lab", city: "Burlington", state: "North Carolina", ehrVendor: "Labcorp Patient Portal", supportsFhir: true, patientPortalUrl: "https://patient.labcorp.com", website: "https://www.labcorp.com", phone: "(800) 845-6167", healthSystem: "Labcorp Holdings", dataTypes: ["Lab Results", "Diagnostic Reports", "Blood Work Panels", "Drug Screening", "Genetic Testing"], connectMethod: "Direct FHIR API + Patient Portal", avgRecordCategories: 5 },
  { slug: "cvs-pharmacy", name: "CVS Pharmacy", type: "pharmacy", city: "Woonsocket", state: "Rhode Island", ehrVendor: "CVS Health", supportsFhir: true, patientPortalUrl: "https://www.cvs.com/account", website: "https://www.cvs.com", phone: "(800) 746-7287", healthSystem: "CVS Health", dataTypes: ["Prescription History", "Medications", "Immunization Records", "MinuteClinic Visits"], connectMethod: "FHIR API via CVS Health", avgRecordCategories: 4 },
  { slug: "walgreens-pharmacy", name: "Walgreens Pharmacy", type: "pharmacy", city: "Deerfield", state: "Illinois", ehrVendor: "Walgreens", supportsFhir: true, patientPortalUrl: "https://www.walgreens.com/pharmacy", website: "https://www.walgreens.com", phone: "(800) 925-4733", healthSystem: "Walgreens Boots Alliance", dataTypes: ["Prescription History", "Medications", "Immunization Records", "Healthcare Clinic Visits"], connectMethod: "FHIR API via Walgreens Health", avgRecordCategories: 4 },
  { slug: "kaiser-permanente", name: "Kaiser Permanente", type: "health-system", city: "Oakland", state: "California", ehrVendor: "Epic MyChart (KP.org)", supportsFhir: true, patientPortalUrl: "https://healthy.kaiserpermanente.org", website: "https://www.kaiserpermanente.org", phone: "(800) 464-4000", healthSystem: "Kaiser Foundation Health Plan", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Encounters", "Referrals", "Imaging", "Clinical Notes", "Care Plans"], connectMethod: "SMART on FHIR via KP.org", avgRecordCategories: 12 },
  { slug: "mount-sinai", name: "Mount Sinai Health System", type: "hospital", city: "New York", state: "New York", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.mountsinai.org", website: "https://www.mountsinai.org", phone: "(212) 241-6500", healthSystem: "Icahn School of Medicine", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Radiology"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
  { slug: "stanford-health-care", name: "Stanford Health Care", type: "hospital", city: "Stanford", state: "California", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.stanfordhealthcare.org", website: "https://stanfordhealthcare.org", phone: "(650) 723-4000", healthSystem: "Stanford Medicine", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Genomics", "Research Data"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 9 },
  { slug: "ucla-health", name: "UCLA Health", type: "hospital", city: "Los Angeles", state: "California", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.uclahealth.org", website: "https://www.uclahealth.org", phone: "(310) 825-9111", healthSystem: "UC Los Angeles Health", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Clinical Notes"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
  { slug: "nyu-langone", name: "NYU Langone Health", type: "hospital", city: "New York", state: "New York", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.nyulangone.org", website: "https://nyulangone.org", phone: "(212) 263-7300", healthSystem: "NYU Langone Health", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Encounters"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
  { slug: "mass-general-brigham", name: "Mass General Brigham", type: "health-system", city: "Boston", state: "Massachusetts", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.massgeneralbrigham.org", website: "https://www.massgeneralbrigham.org", phone: "(866) 644-8910", healthSystem: "Mass General Brigham", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Clinical Notes", "Radiology", "Pathology"], connectMethod: "SMART on FHIR via Patient Gateway/MyChart", avgRecordCategories: 10 },
  { slug: "cedars-sinai", name: "Cedars-Sinai Medical Center", type: "hospital", city: "Los Angeles", state: "California", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.cedars-sinai.org", website: "https://www.cedars-sinai.org", phone: "(310) 423-3277", healthSystem: "Cedars-Sinai Health System", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Clinical Notes"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
  { slug: "uc-san-francisco-health", name: "UCSF Health", type: "hospital", city: "San Francisco", state: "California", ehrVendor: "Epic MyChart", supportsFhir: true, patientPortalUrl: "https://mychart.ucsfhealth.org", website: "https://www.ucsfhealth.org", phone: "(415) 476-1000", healthSystem: "UC San Francisco", dataTypes: ["Lab Results", "Medications", "Conditions", "Immunizations", "Procedures", "Vital Signs", "Allergies", "Research Protocols"], connectMethod: "SMART on FHIR via Epic MyChart", avgRecordCategories: 8 },
];

const TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  lab: "Laboratory",
  imaging: "Imaging Center",
  pharmacy: "Pharmacy",
  clinic: "Clinic",
  "health-system": "Health System",
};

export function getProviderSlugs(): string[] {
  return PROVIDERS.map((p) => p.slug);
}

export function getProviderHtml(slug: string): string | null {
  const p = PROVIDERS.find((x) => x.slug === slug);
  if (!p) return null;

  const typeLabel = TYPE_LABELS[p.type] || p.type;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `Connect ${p.name} Records | ${p.city}, ${p.state}`,
    description: `Access and unify your ${p.name} health records in Tabula Medica. Pull ${p.dataTypes.slice(0, 4).join(", ")} and more via ${p.connectMethod}.`,
    url: `${SITE_URL}/providers/${p.slug}`,
    about: {
      "@type": "MedicalOrganization",
      name: p.name,
      address: { "@type": "PostalAddress", addressLocality: p.city, addressRegion: p.state },
      telephone: p.phone,
      url: p.website,
    },
  });

  const body = `
<h1>Connect Your ${p.name} Records to Tabula Medica</h1>
<p>${p.name} is a ${typeLabel.toLowerCase()} in <strong>${p.city}, ${p.state}</strong>${p.healthSystem ? `, part of the ${p.healthSystem}` : ""}. Tabula Medica connects to ${p.name} via <strong>${p.connectMethod}</strong> to pull your health records into one unified, deduplicated view.</p>

<div class="card">
  <h3 style="margin-top:0;">Connection Details</h3>
  <table>
    <tr><th>Provider</th><td>${p.name}</td></tr>
    <tr><th>Type</th><td>${typeLabel}</td></tr>
    <tr><th>Location</th><td>${p.city}, ${p.state}</td></tr>
    <tr><th>EHR System</th><td>${p.ehrVendor}</td></tr>
    <tr><th>FHIR Enabled</th><td>${p.supportsFhir ? "✓ Yes — direct FHIR R4 connection" : "✗ Not yet — manual upload supported"}</td></tr>
    <tr><th>Connection Method</th><td>${p.connectMethod}</td></tr>
    <tr><th>Record Categories</th><td>${p.avgRecordCategories} categories available</td></tr>
    ${p.phone ? `<tr><th>Phone</th><td>${p.phone}</td></tr>` : ""}
    ${p.patientPortalUrl ? `<tr><th>Patient Portal</th><td><a href="${p.patientPortalUrl}" rel="noopener noreferrer" target="_blank">${p.patientPortalUrl.replace("https://", "")}</a></td></tr>` : ""}
  </table>
</div>

<h2>What Data Can You Pull from ${p.name}?</h2>
<p>When you connect ${p.name} to Tabula Medica, these ${p.dataTypes.length} record categories become available in your unified health timeline:</p>
<div class="grid grid-2">
  ${p.dataTypes.map((d) => `<div class="card" style="padding:12px 16px;margin-bottom:0;"><strong>${d}</strong></div>`).join("")}
</div>

<h2>How Tabula Medica Improves Your ${p.name} Records</h2>
<div class="grid grid-2">
  <div class="card"><h3 style="margin-top:0;">Unified View</h3><p style="margin-bottom:0;">Your ${p.name} records are combined with data from all your other providers into a single timeline — no more logging into separate portals.</p></div>
  <div class="card"><h3 style="margin-top:0;">AI Summary</h3><p style="margin-bottom:0;">Complex lab values and clinical notes from ${p.name} are summarized in plain language you can actually understand.</p></div>
  <div class="card"><h3 style="margin-top:0;">Deduplication</h3><p style="margin-bottom:0;">When ${p.name} and another provider have the same record (e.g., a shared lab result), Tabula Medica merges them instead of showing duplicates.</p></div>
  <div class="card"><h3 style="margin-top:0;">Shareable</h3><p style="margin-bottom:0;">Share specific ${p.name} records with a new doctor via a secure, time-limited link — no faxing or phone calls.</p></div>
</div>

<h2>How to Connect ${p.name}</h2>
<ol style="margin-left:20px;color:#374151;">
  <li style="margin-bottom:8px;">Sign up or log in to Tabula Medica</li>
  <li style="margin-bottom:8px;">Go to <strong>Connections</strong> and search for "${p.name}"</li>
  <li style="margin-bottom:8px;">Authenticate with your ${p.ehrVendor} credentials</li>
  <li style="margin-bottom:8px;">Your records sync automatically — typically in under 60 seconds</li>
</ol>
`;

  return ssrHtmlShell({
    title: `Connect ${p.name} Health Records | Tabula Medica`,
    description: `Access your ${p.name} health records in one place. Pull ${p.dataTypes.slice(0, 3).join(", ")} and ${p.dataTypes.length - 3} more via ${p.connectMethod}. Unified, summarized, deduplicated.`,
    canonical: `${SITE_URL}/providers/${p.slug}`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Providers", url: "/providers" },
      { name: p.name, url: `/providers/${p.slug}` },
    ],
    body,
  });
}

export function getProviderIndexHtml(): string {
  const byType: Record<string, Provider[]> = {};
  for (const p of PROVIDERS) {
    (byType[p.type] = byType[p.type] || []).push(p);
  }

  const sections = Object.entries(byType)
    .map(([type, providers]) => {
      const label = TYPE_LABELS[type] || type;
      const cards = providers
        .map(
          (p) => `<a href="/providers/${p.slug}" style="text-decoration:none;color:inherit;">
        <div class="card" style="margin-bottom:0;">
          <strong>${p.name}</strong><br/>
          <span style="font-size:13px;color:#6b7280;">${p.city}, ${p.state} · ${p.dataTypes.length} record types · ${p.connectMethod}</span>
        </div></a>`
        )
        .join("");
      return `<h2>${label}s</h2><div class="grid grid-2">${cards}</div>`;
    })
    .join("");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Health Provider Directory | Tabula Medica",
    description: `Connect your health records from ${PROVIDERS.length}+ providers. Hospitals, labs, pharmacies, and health systems — all unified in one place.`,
    url: `${SITE_URL}/providers`,
    numberOfItems: PROVIDERS.length,
  });

  return ssrHtmlShell({
    title: `Health Provider Directory — Connect ${PROVIDERS.length}+ Providers | Tabula Medica`,
    description: `Browse ${PROVIDERS.length}+ healthcare providers you can connect to Tabula Medica. Hospitals, labs, pharmacies — pull all your records into one unified view.`,
    canonical: `${SITE_URL}/providers`,
    schemaJson: schema,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Providers", url: "/providers" },
    ],
    body: `<h1>Health Provider Directory</h1>
<p>Connect your records from ${PROVIDERS.length}+ healthcare providers. Each connection pulls your data via secure FHIR APIs — unified, summarized, and deduplicated in your Tabula Medica account.</p>
${sections}`,
  });
}
