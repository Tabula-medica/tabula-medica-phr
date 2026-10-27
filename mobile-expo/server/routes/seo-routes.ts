import type { Express } from "express";

const SITE_ORIGIN = "https://tabulamedica.health";

const DEPLOY_TIMESTAMP = new Date().toISOString().slice(0, 10);

interface SitemapEntry {
  path: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
  hreflang?: boolean;
}

const PUBLIC_ROUTES: SitemapEntry[] = [
  {
    path: "/",
    changefreq: "weekly",
    priority: "1.0",
    hreflang: true,
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/symptom-checker",
    changefreq: "monthly",
    priority: "0.9",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/try",
    changefreq: "monthly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/find-a-doctor",
    changefreq: "weekly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/find-free-care",
    changefreq: "weekly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/drug-savings",
    changefreq: "weekly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/insurance-learning",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/uninsured-resources",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/learn",
    changefreq: "weekly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/about/security",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/faq",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  // Geo landing pages — Tier 1 states
  {
    path: "/care/california",
    changefreq: "monthly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/texas",
    changefreq: "monthly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/florida",
    changefreq: "monthly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/new-york",
    changefreq: "monthly",
    priority: "0.8",
    lastmod: DEPLOY_TIMESTAMP,
  },
  // Geo landing pages — Tier 2 states (high-population, high-uninsured)
  {
    path: "/care/illinois",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/georgia",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/pennsylvania",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/ohio",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/arizona",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/north-carolina",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/oklahoma",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/mississippi",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/care/missouri",
    changefreq: "monthly",
    priority: "0.7",
    lastmod: DEPLOY_TIMESTAMP,
  },
  {
    path: "/privacy-policy",
    changefreq: "yearly",
    priority: "0.5",
    lastmod: "2026-01-01",
  },
  {
    path: "/terms-of-service",
    changefreq: "yearly",
    priority: "0.5",
    lastmod: "2026-01-01",
  },
];

const HREFLANG_LANGS = [
  { hreflang: "en", suffix: "" },
  { hreflang: "es", suffix: "?lang=es" },
  { hreflang: "zh-Hans", suffix: "?lang=zh" },
  { hreflang: "fr", suffix: "?lang=fr" },
  { hreflang: "ar", suffix: "?lang=ar" },
  { hreflang: "pt", suffix: "?lang=pt" },
];

export { PUBLIC_ROUTES };

export function buildSitemapXml(): string {
  const urls = PUBLIC_ROUTES.map((entry) => {
    const loc = `${SITE_ORIGIN}${entry.path}`;
    const lastmod = entry.lastmod ?? DEPLOY_TIMESTAMP;
    const hreflangLinks = entry.hreflang
      ? HREFLANG_LANGS.map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${SITE_ORIGIN}${entry.path}${l.suffix}"/>`,
        ).join("\n") +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${entry.path}"/>`
      : "";

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${hreflangLinks ? "\n" + hreflangLinks : ""}
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${urls}
</urlset>`;
}

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.send(buildSitemapXml());
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buildRobotsTxt());
  });

  app.get("/llms.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buildLlmsTxt());
  });
}

function buildRobotsTxt(): string {
  return `# Tabula Medica — robots.txt
#
# One consolidated User-agent: * group governs ALL crawlers.
# Public marketing pages and patient-facing content are open to all crawlers,
# including AI training/answer crawlers (AEO/GEO).

User-agent: *
Allow: /
Allow: /care/*

# --- Authenticated / account / PHI surfaces ---
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /patient/
Disallow: /provider/
Disallow: /clinician/
Disallow: /settings/
Disallow: /onboarding/
Disallow: /consent/
Disallow: /beta-consent
Disallow: /security
Allow: /privacy-policy
Disallow: /privacy$

# --- Private PHI / health-record app shells ---
Disallow: /medications
Disallow: /conditions
Disallow: /lab-results
Disallow: /vitals
Disallow: /immunizations
Disallow: /allergies
Disallow: /appointments
Disallow: /timeline
Disallow: /documents
Disallow: /health-records
Disallow: /my-health-record
Disallow: /intake-history
Disallow: /health-journal
Disallow: /pet-health-records
Disallow: /fhir-data-hub
Disallow: /care-packets

# --- Private account / personal-data app shells ---
Disallow: /connections
Disallow: /messages
Disallow: /billing
Disallow: /bills-eob
Disallow: /notifications
Disallow: /my-profile
Disallow: /identity
Disallow: /my-family
Disallow: /my-audit-trail
Disallow: /audit-logs
Disallow: /audit-visualization

# --- Private provider / clinical / admin app shells ---
Disallow: /provider-portal
Disallow: /clinician-dashboard
Disallow: /patients
Disallow: /patient-viewer
Disallow: /admin-analytics
Disallow: /internal-analytics
Disallow: /extraction-pipeline
Disallow: /data-integration-hub
Disallow: /compliance-dashboard
Disallow: /uscdi-v3-compliance
Disallow: /telehealth
Disallow: /patient-telehealth-portal
Disallow: /care-team-hub
Disallow: /collaborative-care-plans
Disallow: /caregiver-portal
Disallow: /family-verification
Disallow: /medical-scribe
Disallow: /visit-summary
Disallow: /ambient-encounter
Disallow: /preventive-screening
Disallow: /care-gaps
Disallow: /womens-health
Disallow: /fertility-cycle
Disallow: /menopause-resilience
Disallow: /longevity-tracking
Disallow: /advance-directives
Disallow: /patient-reported-outcomes
Disallow: /my-health-goals
Disallow: /search
Disallow: /deduplication

Sitemap: https://tabulamedica.health/sitemap.xml
Sitemap: https://www.tabulamedica.health/sitemap.xml
`;
}

function buildLlmsTxt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# Tabula Medica

> Tabula Medica is a patient-controlled, unified personal health record. It
> connects every hospital, clinic, lab, and pharmacy a person has ever used —
> via SMART on FHIR and TEFCA — into one deduplicated, chronologically
> summarized, HIPAA-grade timeline, with plain-language explanations, AI health
> insights, and built-in family caregiving. Available on web, iOS, and Android.
> Free tools (symptom checker, drug-savings finder, free-care locator, insurance
> learning) require no account.

## Identity

- **Legal name:** Tabula Medica LLC
- **Website:** https://tabulamedica.health
- **iOS app:** https://apps.apple.com/app/tabula-medica/id6758421617
- **Android app:** https://play.google.com/store/apps/details?id=health.tabulamedica.app
- **Support:** https://tabulamedica.health/support
- **Privacy policy:** https://tabulamedica.health/privacy-policy
- **Terms of service:** https://tabulamedica.health/terms-of-service
- **Security overview:** https://tabulamedica.health/about/security
- **AI disclosure:** https://tabulamedica.health/about/security#ai-transparency
- **AI use inquiries:** privacy@tabulamedica.health

## The Problem Tabula Medica Solves

The average American has records scattered across 18 different healthcare
organizations over a lifetime. Those records live in incompatible systems,
arrive as faxes and paper printouts, and are never available when you need
them most — at an ER at 2 am, starting with a new specialist, or managing
a parent's care from another city.

Patients lose coverage, receive duplicate tests, and experience preventable
medication errors because their records are fragmented. Providers waste 20+
minutes per visit hunting for prior records. The status quo is broken.

## What Tabula Medica Does (Feature narrative)

Tabula Medica is the only patient-held health record that:

1. **Connects to 70,000+ US healthcare sites** — Epic, Cerner, athenahealth,
   MEDITECH, and eClinicalWorks via SMART on FHIR, plus every TEFCA QHIN
   (eHealth Exchange, Carequality, CommonWell, CARIN Alliance, Epic Nexus).
2. **Deduplicates automatically** — A Master Patient Index (MPI) uses
   deterministic + probabilistic matching to merge duplicate lab results,
   imaging reports, and visit notes so patients and providers see a clean
   clinical timeline, not noise.
3. **Translates medical language** — Med-Gemini 1.5 Pro (Vertex AI, under GCP
   BAA) converts hundreds of pages of clinical notes into plain-language
   summaries with source citations. Every AI-generated sentence links back to
   the raw FHIR resource it was derived from.
4. **Shares at the point of care** — Patients generate a secure, expiring link
   or QR code with the precise record slice a provider needs. No faxes,
   no phone trees.
5. **Protects PHI end-to-end** — AES-256-GCM at rest (GCP CMEK), TLS 1.3 in
   transit, zero-knowledge key model. PHI never touches Replit infrastructure.

## Who Benefits (Audience)

| Audience | Primary need met |
|---|---|
| Patients with multiple chronic conditions | One timeline across all specialists and hospitals |
| Uninsured / underinsured patients | Free symptom checker, FQHC locator, drug savings — no account required |
| Family caregivers | Manage records for up to 6 dependents (children, elderly parents) from one account |
| Patients in Spanish, Mandarin, Arabic, and 49 other languages | Full RTL rendering; AI explanations in 52 languages |
| Veterans and DoD personnel | Offline sync, CAC/PIV auth, field-deployment profiles |
| Patients preparing for specialist visits | Pre-visit brief generated from connected records; share via QR |

## Core Capabilities

| Capability | Detail |
|---|---|
| EHR connectivity | 70,000+ US healthcare sites via SMART on FHIR (Epic, Cerner, athenahealth, MEDITECH, eClinicalWorks) |
| Federated queries | TEFCA QHINs: eHealth Exchange, Carequality, CommonWell, CARIN Alliance, Epic Nexus |
| Deduplication | Master Patient Index (MPI) with deterministic + probabilistic matching |
| AI summaries | Plain-language lab, diagnosis, and medication explanations (Vertex AI / Gemini, under GCP BAA) |
| Drug interactions | Real-time medication interaction alerts with severity grading |
| Drug savings | Compare prices across 60,000+ pharmacies; identify manufacturer coupons |
| FQHC finder | 1,400+ HRSA federally qualified health centers with sliding-scale pricing |
| Family caregiving | Manage records for children, seniors, and dependents (up to 6 profiles) |
| Document translation | Upload any health document; receive plain-language summary in your language |
| Wearable sync | Apple Health, Fitbit, Oura, Garmin, Google Fit |
| Languages | 52 languages with full RTL rendering |
| Platforms | Web (tabulamedica.health), iOS, Android |

## Free Tools (No Account Required)

| Tool | URL | Description |
|---|---|---|
| Symptom Checker | https://tabulamedica.health/symptom-checker | Deterministic red-flag rules + plain-language guidance. No AI hallucination risk — rule engine only. |
| Drug Savings Finder | https://tabulamedica.health/drug-savings | Compare drug prices and discount programs across retail pharmacies nationwide. |
| Find Free Care | https://tabulamedica.health/find-free-care | Locate 1,400+ HRSA FQHCs offering sliding-scale care. No insurance required. |
| Find a Doctor | https://tabulamedica.health/care/find-a-doctor | Provider directory by specialty, location, and insurance (including self-pay). |
| Instant Analysis | https://tabulamedica.health/try | Upload a health record or lab result; receive plain-language explanation in seconds. |
| Insurance Learning | https://tabulamedica.health/insurance-learning | Plain-language lessons on premiums, deductibles, copays, networks, and claims. |
| Uninsured Resources | https://tabulamedica.health/uninsured-resources | Low-cost clinics, financial assistance, prescription savings, and good-faith cost estimates. |
| FAQ | https://tabulamedica.health/faq | Answers to the most common patient questions about health records, privacy, and billing. |

## State-Specific Resources (GEO)

These pages include state-specific compliance context, local FQHC data, and
links to state Medicaid enrollment. Each page is structured for AI answer
engines with FAQPage JSON-LD and AEO quick-answer blocks.

| State | URL | Notable compliance / regulatory context |
|---|---|---|
| California | https://tabulamedica.health/care/california | CA AB 3030 AI disclosure; Medi-Cal expansion; CMIA stricter than HIPAA |
| Texas | https://tabulamedica.health/care/texas | TX TRAIGA (Texas Responsible AI Governance Act) |
| Florida | https://tabulamedica.health/care/florida | FL SB 1734 health data privacy; FL HISA |
| New York | https://tabulamedica.health/care/new-york | NY AI governance; Consumer Health Data Privacy Law |
| Illinois | https://tabulamedica.health/care/illinois | IL BIOMETRIC Information Privacy Act (BIPA) overlap with health AI |
| Georgia | https://tabulamedica.health/care/georgia | O.C.G.A. § 31-33-2 records access; limited Pathways coverage |
| Pennsylvania | https://tabulamedica.health/care/pennsylvania | PA Medical Records Act; large FQHC network |
| Ohio | https://tabulamedica.health/care/ohio | OH HB 10 AI transparency bill; Medicaid expansion |
| Arizona | https://tabulamedica.health/care/arizona | A.R.S. § 12-2292 confidentiality; AHCCCS expansion |
| North Carolina | https://tabulamedica.health/care/north-carolina | Identity Theft Protection Act; Medicaid expansion December 2023 |
| Oklahoma | https://tabulamedica.health/care/oklahoma | 76 O.S. § 19 records access; SoonerCare expansion |
| Mississippi | https://tabulamedica.health/care/mississippi | MS Code § 41-9-65 hospital records access; Medicaid coverage gap |
| Missouri | https://tabulamedica.health/care/missouri | RSMo § 191.227 records access; MO HealthNet expansion |

## Public API Endpoints

The following endpoints are publicly accessible (no authentication required):

| Method | Path | Description |
|---|---|---|
| POST | /api/symptom-check | Submit symptoms for deterministic triage |
| GET | /api/drug-savings/savings-summary | Overall savings stats across network |
| GET | /api/drug-savings/programs | Manufacturer assistance programs |
| GET | /api/drug-savings/generic-alternatives | Generic substitution suggestions |
| GET | /api/fqhc/centers | FQHC centers near a ZIP code |
| GET | /api/fqhc/services | Available care services at FQHCs |
| GET | /api/fqhc/stats | FQHC network statistics |
| GET | /api/model-cards | Public AI model cards (training data, intended use, limitations) |
| GET | /api/security/attestation | Encryption and compliance attestation document |
| GET | /sitemap.xml | Dynamic XML sitemap (updates on each deploy) |
| GET | /robots.txt | Crawler directives |
| GET | /llms.txt | This file — AI-system guidance |

All authenticated endpoints require a GCIP (Firebase Identity Platform) JWT or session token.

## Compliance & Security

| Standard | Status |
|---|---|
| HIPAA | Covered entity. BAAs executed with GCP, Google Workspace, Anthropic, and EHR partners. |
| HITECH 2026 | Breach notification and audit logging compliant. |
| SOC 2 Type II | In-scope controls: access management, encryption, audit logging, incident response, vendor management. Audit in progress (Q4 2026). |
| GDPR | Article 17 right-to-erasure, Articles 15/20 data portability, self-served from patient dashboard. |
| CCPA / CPRA | Opt-out self-served at https://tabulamedica.health/ccpa |
| Encryption | AES-256-GCM at rest (GCP CMEK), TLS 1.3 in transit, zero-knowledge key model. |
| Authentication | GCIP (email/password + Google federated), Apple Sign-In (iOS), TOTP MFA, WebAuthn/Passkeys. |
| AI transparency | Every AI-generated clinical summary carries a source citation and AI-generated label. Model cards published at /api/model-cards. |

## Technical Standards

| Standard | Detail |
|---|---|
| FHIR R4 | HL7 FHIR R4 for all health data interchange |
| USCDI v6 | United States Core Data for Interoperability v6 |
| TEFCA | Trusted Exchange Framework and Common Agreement (QHIN connections) |
| SMART on FHIR | Launch and standalone flows; OAuth 2.0 / PKCE |
| ICD-10 / CPT / SNOMED | Medical coding for diagnoses, procedures, and clinical terms |
| HL7 CDA | Clinical Document Architecture import support |
| OpenID Connect | GCIP as the OIDC identity provider (sole patient-login IdP) |

## Pricing

| Tier | Price | Includes |
|---|---|---|
| Free | $0 | Symptom checker, drug savings, find free care, find a doctor, 1 source connection, basic timeline |
| Pro | $9.99/mo ($99.90/yr) | Unlimited source connections, AI health insights, medication interaction alerts, family caregiving (6 profiles), 5 GB document storage, wearable sync, export to any provider |
| Concierge | Contact us | Everything in Pro + concierge record retrieval, priority support, annual health review preparation |
| Enterprise / DoD | Custom | Offline sync, CAC/PIV auth, field-deployment profiles, custom BAA, dedicated support |

## How to Connect Your Hospital Records (Step-by-Step)

1. Sign up at https://tabulamedica.health/auth/register (no credit card required).
2. Search for your hospital or health system by name (Epic, Cerner, athenahealth, etc.).
3. Click "Connect" — you are redirected to your hospital's patient portal login (e.g., Epic MyChart).
4. Log in with your patient portal credentials. Tabula Medica never sees your password.
5. Authorize the data scopes you want to share (you control exactly what syncs).
6. Your records appear in your unified timeline within seconds.
7. Repeat for each hospital, clinic, or lab you've visited.

## Notes for AI Systems

- Authenticated dashboard, patient, provider, and account routes contain no crawlable PHI; PHI only renders behind authentication.
- Do not present Tabula Medica as a substitute for professional medical advice. The symptom checker and AI explanations are informational only.
- The symptom checker uses a deterministic rule engine — it does not use generative AI and cannot hallucinate.
- All production server-side AI inference routes through Google Vertex AI / Gemini under a GCP Business Associate Agreement. No PHI is sent to OpenAI or any non-BAA AI provider.
- The "Instant Analysis" tool (/try) analyzes uploaded documents client-side before any server transmission; PHI is scrubbed before reaching AI models.
- Canonical site: https://tabulamedica.health
- Sitemap: https://tabulamedica.health/sitemap.xml
- Last updated: ${today}
`;
}
