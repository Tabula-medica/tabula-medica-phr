# Sprinto Product-Details URL Map — all entities
_Date: 2026-10-17 · Updated with all contact pages live. Paste into Sprinto's "Add details" form per entity._

Sprinto's onboarding form asks each product for: **Website**, **Product/Application URL**,
**Privacy policy**, **Contact us**, **Login**. `✅` = live & verified · `🟡` = confirm/adjust.

| Entity | Website | Product URL | Privacy | Contact us | Login |
|---|---|---|---|---|---|
| **SAWD** | https://sawd.ai ✅ | https://sawd.ai ✅ | https://sawd.ai/privacy ✅ | https://sawd.ai/contact ✅ | https://sawd.ai/login ✅ |
| **Uninsurance** | https://uninsurance.care ✅ | https://uninsurance.care ✅ | https://uninsurance.care/privacy ✅ | https://uninsurance.care/contact.html ✅ | https://uninsurance.care/ 🟡 (auth at root) |
| **Underinsured** | https://underinsured.app ✅ | https://underinsured.app ✅ | https://underinsured.app/privacy ✅ | https://underinsured.app/contact.html ✅ | https://underinsured.app/login ✅ |
| **Tabula Medica PHR** | https://tabula-medica.health ✅ | https://tabula-medica.health ✅ | https://tabula-medica.health/privacy.html ✅ | https://tabula-medica.health/contact.html ✅ (PR#96) | https://tabula-medica.health/login ✅ |
| **World EHR** | https://worldehr.com ✅ | https://worldehr.com ✅ | https://worldehr.com/privacy 🟡 | https://worldehr.com/contact.html ✅ (PR#449) | https://worldehr.com/ 🟡 (GCIP gate) |
| **LTFM Health** | https://ltfm.health ✅ | https://ltfm.health ✅ | https://ltfm.health/privacy.html 🟡 | https://ltfm.health/contact.html ✅ (PR#32) | https://ltfm.health/ ✅ |
| **Tabula Attentiva** | https://tabulaattentiva.com ✅ | https://tabulaattentiva.com ✅ | https://tabulaattentiva.com/privacy.html 🟡 | https://tabulaattentiva.com/site/contact.html ✅ (PR#46) | https://tabulaattentiva.com/ 🟡 (GCIP gate) |
| **Tabula Cognita** | https://app.tabulacognita.com ✅ | https://app.tabulacognita.com ✅ | https://app.tabulacognita.com/privacy 🟡 | https://app.tabulacognita.com/contact.html ✅ (PR#85) | https://app.tabulacognita.com/ ✅ |
| **AccountableHub** | https://accountablehub.com ✅ | https://accountablehub.com ✅ | https://accountablehub.com/privacy 🟡 | https://accountablehub.com/contact/ ✅ (PR#38) | https://accountablehub.com/ ✅ |

## Sprinto entity onboarding order
SAWD (SOC2 only, no PHI, fastest) → Uninsurance → PHI fleet (after owner gates #1+#2)

## Contact pages — deployment status
All 9 entities now have a contact page deployed or in their web root:

| Venture | Contact file | CI pipeline | Status |
|---|---|---|---|
| SAWD | `/contact` React route | sawd-web branch | ✅ |
| Uninsurance | `public/contact.html` | Cloud Run deploy | ✅ |
| Underinsured | `public/contact.html` | Cloud Run deploy | ✅ |
| PHR | `client/public/contact.html` | Cloud Run deploy | ✅ PR#96 merged |
| WorldEHR | `marketing/contact.html` | GH Actions deploy | ✅ PR#449 merged |
| LTFM | `contact.html` (static root) | GCS deploy (CI) | ✅ PR#32 merged |
| Attentiva | `site/contact.html` | GH Pages deploy (CI) | ✅ PR#46 merged |
| Cognita | `artifacts/tabula-cognita/public/contact.html` | CF Pages (CI) | ✅ PR#85 merged |
| AccountableHub | `public/contact/index.html` | CF Pages (CI) | ✅ PR#38 merged |

## Still to confirm
- **Privacy URLs** — WorldEHR, LTFM, Attentiva, Cognita, AccountableHub (`🟡` above) — confirm these resolve or add a static privacy.html before Sprinto entity entry.
- **Login URLs** — Uninsurance & WorldEHR gate auth at root (no dedicated `/login`). Root URL is acceptable for Sprinto.

> Full context: `OWNER-GATES-TRACKER.md` · `SPRINTO-ACCOUNT-SETUP-GUIDE.md`.
