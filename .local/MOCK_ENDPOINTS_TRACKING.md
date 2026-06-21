# Mock Endpoint Tracking — Replace After Phase 1 Merge Complete

Single tracking doc for all known mock/hardcoded backend endpoints discovered during the
mobile→web merge sweep. **Do NOT fix during merge** — real-data wiring is a separate pass.

## Mock Endpoints

| Endpoint | File | Status | Replace With |
|---|---|---|---|
| `GET /api/dashboard` | `server/mobile-api-routes.ts` | Hardcoded user/stats | Real Auth0 user + Medplum FHIR aggregate |
| `GET /api/health-dashboard/vitals` | `server/mobile-api-routes.ts` | 100% mock vitals | Apple Health / Medplum Observation pull |
| `GET /api/records/timeline` | `server/mobile-api-routes.ts` | Mock timeline events | Medplum FHIR `_history` aggregator |
| `GET /api/labs/results` | `server/mobile-api-routes.ts` | Mock lab panels | Medplum DiagnosticReport + Observation |
| `GET /api/medications` | `server/mobile-api-routes.ts` | Mock med list | Medplum MedicationRequest + MedicationStatement |
| `GET /api/connections` | `server/mobile-api-routes.ts` | Mock EHR list | Real Fasten/Aidbox/Epic SMART tokens |
| `GET /api/share-links` | `server/mobile-api-routes.ts` | Mock share links | Real share-link table + signed JWT |

## Other Tech Debt Discovered During Merge

- **Mobile LoginScreen ships hardcoded demo creds** (`demo@tabulamedica.com / demo123`) in rendered UI — strip before any mobile build ships.
- **Mobile direct password flow conflicts with Auth0 SSO** — intentional divergence; mobile must adopt Auth0 universal login before merge.
- **`PHI_ENCRYPTION_SALT`** cosmetic repaste pending (user action).
- **Stripe `sk_live` / `sk_test`**: confirmed CLEAN — no occurrences in current code or git history (audited via `git log --all -S` on `2026-04-18`). Earlier "leaked" warning was stale agent memory; no rotation required.
- **GitHub PAT (`ghp_*`)**: confirmed CLEAN — no occurrences in current code or git history (audited `2026-04-18`). No rotation required.
- **43 high + 29 moderate** npm vulns remain (0 critical, doesn't block deploy).

## i18n Follow-Ups

- **Urdu / Hebrew / Pashto translation strings** — language codes added to `SUPPORTED_LANGUAGES` with `direction: "rtl"`, but `UI_TRANSLATIONS` does not yet contain entries for `ur`, `he`, `ps`. The `t()` function falls back to English keys until a native speaker authors strings. Each is flagged `machineTranslated: true` in `TRANSLATION_METADATA` so the Settings page shows an amber "translation in progress" banner.
- **Existing partial-coverage languages** (ja, pa, de, ko, vi, tl, it, te, ne, ru) — UI strings exist for ~15-30 keys each; remaining keys fall back to English. Recommend a translation pass via vetted vendor (Smartling / Lokalise) rather than GPT machine translation for production.
- **ClinicalDisclaimer translation policy** — the shared component currently renders English regardless of locale. This is intentional for v1 (machine-translated FDA disclaimers create legal exposure). Do not add `t()` lookups to it without human medical review of each language.
- **Hardcoded LTR styling sweep** — Tailwind 3.4 has native `rtl:` and `ltr:` variants that activate from the `dir` attribute (which `LanguageProvider` already sets on `<html>`). New code should prefer logical properties (`ms-`, `me-`, `ps-`, `pe-`) and `text-start` / `text-end` instead of `ml-`, `mr-`, `text-left`, `text-right`. Existing pages were not retrofitted in this pass — broken layouts under RTL will be reported and fixed page-by-page as users surface them.

## Schema Follow-Ups

- **`biologicalSex` column on patient/profile tables** — schema currently has only a `gender` enum (`male|female|other`). USPSTF care-gap rules require biological sex (anatomy) for breast/cervical eligibility. The `/care-gaps` MVP works because the patient enters their own sex on the form per session, but before launch we need a persisted `biologicalSex` field so we can evaluate care gaps directly from a stored patient record without re-asking each session. Add to `accounts` or `profiles` table as a non-nullable enum `("female"|"male")` separate from `gender`.

## When to Address

After ALL Category A mobile-screen merges land. Open a single ticket per endpoint group
(dashboard, vitals, timeline, labs/meds, connections, share-links).
