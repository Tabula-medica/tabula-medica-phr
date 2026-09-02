# CMS-HCC V28 risk adjustment, and the eClinicalWorks connector

Two related pieces of work: AI-assisted HCC documentation support built on the
CMS-HCC **V28** model, and a correction to how this codebase talks to
eClinicalWorks.

---

## 1. What "AI-improved HCC coding" means here — and what it does not

The request was to auto-improve HCC codes with AI. What is built auto-improves
the *documentation*, and stops one step short of the code itself.

That line is deliberate. Automated HCC capture that adds diagnosis codes without
a clinician's judgement is the specific practice that has drawn federal False
Claims Act enforcement against Medicare Advantage organisations. A system that
surfaces a well-evidenced suggestion with the chart evidence attached is an
asset. One that codes on its own is a liability with a revenue line attached, and
the liability lands on the practice, not the vendor.

So the pipeline is:

```
structured chart data
   → deterministic rules find evidence-backed candidates
      → AI ranks them and drafts assessment/plan language
         → clinician confirms on a face-to-face encounter
            → code is captured
```

The AI sits in the middle, and it operates on a **closed candidate list**. It can
reorder and explain; it cannot introduce a condition. Any id it returns that was
not in the candidate list is discarded in code (`hcc-ai-reviewer.ts`), not merely
discouraged in the prompt. A hallucination can make the output less useful. It
cannot make the output fraudulent.

### The three findings the system produces

| Finding | Trigger | Why it matters |
|---|---|---|
| **Suspect** | Objective evidence in structured data supports an uncoded condition | Two eGFRs under 60 ninety days apart with no CKD stage on the problem list |
| **Recapture gap** | A chronic condition coded in a prior year, not yet re-documented this year | Risk adjustment resets every calendar year; this is the largest real-world source of lost accuracy |
| **MEAT gap** | The note lacks Monitor/Evaluate/Assess/Treat language | A problem-list entry is not a documented diagnosis and will not survive a RADV audit |

Suspect rules fire on **affirmative evidence**, never on absence. "No A1c on
file" is not evidence of diabetes. Rules also stay quiet when the condition is
already coded — repeating what is already captured is how these tools become
noise clinicians learn to dismiss.

Recapture is proposed only for conditions whose ICD-10 family is chronic or
permanent. An amputation does not heal; an acute MI does not persist. Suggesting
recapture of a resolved acute event is wrong clinically and is exactly the
pattern auditors look for.

---

## 2. Why there is no RAF score out of the box

The V28 model tables — the ICD-10-CM crosswalk (~7,770 codes), the 115 category
labels, the hierarchy, and the segment coefficients — are **not** bundled. They
load at runtime from the official CMS release.

A RAF score is a payment claim. A wrong crosswalk or a stale coefficient does not
produce a slightly-off number; it produces a false claim to the federal
government. The only defensible source is the published CMS file, so until one is
loaded, `POST /api/hcc/raf` returns:

```json
{ "status": "not-scored", "reason": "coefficients-not-loaded", "detail": "..." }
```

Everything else keeps working. Suspects, recapture and MEAT need no payment
model at all.

### Loading the tables

Convert the CMS release to the `RawHccTables` JSON shape (see
`server/services/risk-adjustment/hcc-tables.ts`) and point the app at it:

```bash
export HCC_V28_TABLES_PATH=/etc/tabula/cms-hcc-v28-2026.json
```

The conversion lives outside this process on purpose: it is where judgement calls
happen, and those belong in a reviewed, version-controlled artifact rather than a
server boot path.

Validation rejects, among others:

- tables spanning **multiple payment years** — a 2026 crosswalk with 2025
  coefficients yields a plausible-looking wrong score
- a crosswalk pointing at categories not in the loaded category table
- a code mapped to two HCCs
- an HCC that suppresses itself

Every table is stamped with a SHA-256 and payment year, and a score reports the
provenance that produced it. A silently swapped table is detectable after the
fact.

### Scoring behaviour worth knowing

- **The model segment is required, with no default.** The same HCC is worth
  different amounts to a community non-dual aged enrollee than to an
  institutional one. A defaulted segment produces a confidently wrong number.
- **The hierarchy is applied before summation.** Coded for both severe and mild
  diabetes, the patient is paid for the severe one only. Skipping this inflates
  every score it touches — the direction that draws a complaint.
- **A missing coefficient withholds the score rather than counting as zero.** A
  payable HCC with no coefficient in that segment is a broken table, not a
  zero-weight condition. Refusing makes the breakage visible; zeroing hides it.
- **Unattested suspects are excluded from the arithmetic** and reported
  separately under `excludedFromScore`.

---

## 3. Deployment split: Tabula (US) vs `.world`

| Endpoint | Tabula US | `.world` |
|---|---|---|
| `POST /api/hcc/suspects` | ✓ | ✓ |
| `POST /api/hcc/recapture` | ✓ | ✓ |
| `POST /api/hcc/meat` | ✓ | ✓ |
| `POST /api/hcc/review` | ✓ | ✓ |
| `GET /api/hcc/rules` | ✓ | ✓ |
| `GET /api/hcc/model` | ✓ | 404 |
| `POST /api/hcc/raf` | ✓ | 404 |

Gated on the existing `TEFCA_ENABLED` switch. RAF is a Medicare Advantage
*payment* construct; publishing one on a non-US deployment would attach a number
with no local meaning to a patient record and invite it to be read as a clinical
severity score, which it is not.

The documentation layer travels fine. "Two eGFRs under 60 ninety days apart and
no CKD stage recorded" is a chart-quality finding in any health system.

---

## 4. eClinicalWorks — what was wrong and what changed

### The bug

`server/fhir/config.ts` carried this as **both** the sandbox and the production
eCW endpoint:

```
https://fhir4.eclinicalworks.com/fhir/r4/IJCEAI
```

`IJCEAI` is eCW's published **sandbox practice code**. eCW does not have "a" FHIR
base URL — every practice gets its own, of the form
`{host}/fhir/r4/{practiceCode}`, with the practice code in the *path*.
Multi-tenant routing is by URL, not by header.

Pointed at a real practice, that configuration does not fail loudly. It
authenticates against the sandbox tenant and returns demo patients — which is
worse than an error, because it looks like it worked.

### The fix

- **Per-practice base URL.** `ECW_PRACTICE_CODE` is resolved at read time. In
  live mode a missing code is an error; there is **no fallback to the sandbox
  code**.
- **Discovery over hardcoding.** `discoverEcwSmartConfiguration()` reads
  `.well-known/smart-configuration` from the practice's base URL to get the
  authorization and token endpoints, PKCE support and capabilities. Reading them
  beats guessing, and it survives the vendor moving a path. (The preset's OAuth
  paths were also corrected to `/oauth/oauth2/authorize` and
  `/oauth/oauth2/token`, but discovery is the supported route.)
- **Backend services.** Helpers for the SMART client-credentials flow with a
  private-key JWT client assertion — including audiencing the assertion to the
  token endpoint, the most common cause of an opaque `invalid_client`, and
  capping the assertion lifetime at the spec's five minutes. Signing is left to
  the caller so the private key stays in existing key management.
- **Listing stays resilient.** `getActiveConfig` is called in a loop by
  `/api/fhir/presets`; an unresolvable eCW target yields an empty base URL there
  rather than throwing and taking down the listing for Epic and athena too. The
  empty URL is caught at connection time, where it can be reported precisely.

### Configuration

```bash
ECW_CLIENT_ID=...          # from the eCW developer portal
ECW_CLIENT_SECRET=...      # SMART app launch (confidential client)
ECW_PRACTICE_CODE=...      # REQUIRED in live mode — the practice's own code
ECW_FHIR_HOST=...          # optional, for practices on a non-default cluster
```

Look a practice's code up in eCW's Clinical FHIR Endpoints directory at
`connect4.healow.com/apps/jsp/dev/r4/fhirEndpoints.jsp`.

Registration is split across two portals: the **eCW FHIR Developer Portal** for
provider-facing SMART and backend/bulk apps, and the **healow FHIR Developer
Portal** for patient-facing apps.

**Rate limit:** 250 calls/minute, counted **per practice code**. Each connected
practice has its own counter, so five practices give 1,250 req/min in aggregate —
but no single practice can be driven harder than 250.

---

## 5. Limitations, stated rather than buried

- **No CMS tables are bundled.** RAF scoring is unavailable until a deployment
  supplies the official release. This is a deliberate refusal, not an omission.
- **Ten suspect rules, not a full engine.** They cover the highest-yield,
  most-objective gaps (CKD staging, chronic respiratory failure on home oxygen,
  diabetes complications, morbid obesity, typed heart failure). A production
  suspecting engine would carry hundreds, and each additional rule needs the same
  "fires on affirmative evidence, stays quiet when already coded" discipline.
- **MEAT matching is lexical.** It reads the note as a whole rather than a window
  around the condition mention, because clinicians routinely document the
  assessment in a separate section from the problem mention and a proximity rule
  would reject well-written SOAP notes. It therefore reports *absence of
  evidence*, not *evidence of absence* — and can be satisfied by MEAT language
  about a different condition. The guidance text says so.
- **The eCW backend-services helpers are not exercised against a live tenant.**
  They are spec-conformant and unit-tested; a real connection needs a registered
  app, a JWKS, and a practice that has authorised it.
