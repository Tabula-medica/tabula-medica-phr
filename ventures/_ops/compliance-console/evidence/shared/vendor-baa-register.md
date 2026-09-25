# Vendor BAA / DPA Register

**Owner:** Rajiv Aggarwal (Security Officer)  
**Last Updated:** 2026-09-20  
**Review Cycle:** Annual + on vendor change  
**Control Reference:** HIPAA §164.308(b), §164.314 | SOC 2 CC9.2 | ISO 27001 A.5.19

---

## Business Associates (PHI Processors) — BAA Required

| # | Vendor | Role | BAA Status | BAA Date | Notes |
|---|--------|------|------------|----------|-------|
| 1 | **Google Cloud Platform (GCP)** | Cloud infrastructure hosting all PHI (Cloud SQL, Cloud Run, Cloud Storage, Secret Manager, Vertex AI) | ✅ SIGNED | GCP BAA accepted via Google Workspace / GCP Console under org `tabulamedica.com` | Covers all projects under org 780509095720; signed by Rajiv Aggarwal via GCP Cloud Data Processing Addendum (CDPA) |
| 2 | **Metriport** | Health Information Exchange (HIE); receives and forwards patient records (FHIR) from EHR | ⚠️ PENDING | — | BAA required before activating live HIE endpoints on worldehr.com or PHR; use synthetic data until executed |
| 4 | **Twilio** | SMS and fax (RingCentral/Twilio) used for patient communications; potential PHI in message content | ⚠️ PENDING | — | Twilio offers BAA on Enterprise plan; evaluate whether PHI is ever included in SMS/fax content; if yes, BAA required |
| 5 | **Cloudflare** | CDN and WAF; proxies all traffic to PHI-handling services (uninsurance.care, underinsured.app, worldehr.com) | ⚠️ PENDING | — | Cloudflare offers BAA on Business plan ($200/mo); required if PHI is exposed in URLs or request bodies passing through CF; WAF scripts ready at Desktop/compliance-readiness/waf/ |

## Sub-processors (Infrastructure/Platform) — DPA or BAA Required

| # | Vendor | Role | Agreement Status | Notes |
|---|--------|------|-----------------|-------|
| 6 | **Google Workspace** | Email, Drive, admin console; may contain PHI in documents | ✅ Covered | Covered under GCP/Google CDPA for the `tabulamedica.com` org |
| 7 | **GitHub (Microsoft)** | Source code hosting; no PHI in repos (enforced by policy) | ℹ️ N/A | PHI not permitted in source repositories per Acceptable Use Policy; GitHub standard ToS sufficient |
| 8 | **Expo / EAS** | Mobile build service; builds PHI-adjacent mobile apps | ℹ️ N/A | Build service receives compiled code only; no PHI transmitted; EAS standard ToS sufficient |
| 9 | **Apple App Store Connect** | Mobile app distribution | ℹ️ N/A | No PHI; app metadata only |
| 10 | **Google Play Console** | Mobile app distribution | ℹ️ N/A | No PHI; app metadata only |

## Financial Data Processors — DPA Required (GLBA Safeguards / PCI DSS)

| # | Vendor | Role | Agreement Status | Notes |
|---|--------|------|-----------------|-------|
| 11 | **Stripe** | Payment processing (subscriptions, PHR IAP) | ✅ DPA in ToS | Stripe's standard Data Processing Agreement is incorporated into ToS; financial data, not PHI |
| 12 | **Plaid** | Bank account linking for SAWD | ✅ DPA in ToS | Plaid End User Privacy Policy + Developer Agreement constitute DPA; financial data only |

## AI Providers — Special Restriction

| # | Vendor | PHI Permitted | Notes |
|---|--------|--------------|-------|
| 13 | **Google Vertex AI** | ✅ YES | Covered under GCP BAA; use for all PHI inference (Gemini 2.5 Flash, Chirp, Imagen) |
| 14 | **Anthropic (Claude API)** | ❌ NO | No BAA available. Portfolio-wide prohibition: never send PHI to Claude API. Claude Code (local dev tool) is acceptable; API inference must be PHI-free |
| 15 | **OpenAI** | ❌ NO | No BAA on standard plans. PHI transmission prohibited. Audio/image endpoints in PHR currently on OpenAI — P0 migration to Vertex in progress |

## Standard SaaS (No PHI / Financial Data Access)

| # | Vendor | Role | Review Status |
|---|--------|------|--------------|
| 16 | Mailgun | Transactional email | Standard ToS; no PHI in email content per policy |
| 17 | Sprinto | Compliance automation | Standard ToS + Privacy Policy reviewed; no PHI transmitted |
| 18 | Vanta | Compliance scanning (historical) | N/A — not currently active |

---

## Pending Actions

| Priority | Action | Deadline |
|----------|--------|----------|
| P0 | Execute BAA with Metriport before activating HIE on worldehr.com/PHR | Before HIE activation |
| P0 | Decide Cloudflare BAA: upgrade to Business plan or ensure PHI never in proxied URLs | Q4 2026 |
| P0 | Migrate PHR audio/image AI from OpenAI → Vertex (2 remaining endpoints) | Q4 2026 |
| P1 | Evaluate Twilio PHI exposure; execute BAA if PHI confirmed in messages | Q4 2026 |
| P1 | Engage Trevor Anderson (legal) to review BAA templates for Canvas and Metriport | Q4 2026 |

---

*Maintained by: Rajiv Aggarwal — rajiv@tabulamedica.com*
