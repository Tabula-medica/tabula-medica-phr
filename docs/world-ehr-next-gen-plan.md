# World EHR — next-generation plan

**Status:** Phase 1 implemented, Phases 2–4 specified
**Branch:** `claude/world-ehr-next-gen-mjfx8x`
**Scope:** the international (`tabulamedica.world`) deployment

---

## 1. The question this document answers

> *"Plenty of EHR available already. Anything of significance or pathbreaking
> ideas you have that others have not addressed?"*

It is a fair challenge, and the honest first answer is that most of what gets
pitched as a "next-generation EHR" is a re-skin. India alone has a crowded
market — hospital information systems like ITDOSE bundle an EHR as one module
among billing, pharmacy and lab. Adding a nicer chart view to that landscape
changes nothing.

The four objectives set for this project are the right frame:

1. Predictive intelligence over reactive logging
2. Ambient and invisible data ingestion
3. Radical global interoperability
4. Sovereign patient ownership

This document does two things. First, it audits those four objectives against
what Tabula Medica **actually has in code today** — because three of the four
are partly built already, and claiming them as new would be wrong. Second, it
identifies the specific gap that is genuinely unaddressed, and reports what has
been built against it on this branch.

---

## 2. Where the codebase actually stands

Evidence-based audit, not aspiration.

| Objective | What exists today | Verdict |
|---|---|---|
| **1. Predictive intelligence** | `server/predictive-health.ts` (risk scoring), `predictive-risk-routes.ts`, `ascvd-routes.ts`, `care-gaps-service.ts`, `preventive-care-service.ts` | **Substantially built — but US-calibrated** |
| **2. Ambient ingestion** | `ambient-encounter-service.ts`, `ai-medical-scribe-routes.ts`, `wearable-routes.ts`, `iot-health-sensor-routes.ts`, `document-ocr-routes.ts`, extraction pipeline | **Substantially built** |
| **3. Global interoperability** | ~120 `fhir-*` route/service files, FHIR R4, SMART on FHIR, USCDI v3, TEFCA + Fasten | **Built for the US only** |
| **4. Sovereign ownership** | `consent/`, `gdpr-routes.ts`, `ccpa-routes.ts`, PHI encryption (F1 programme), `patient-export-routes.ts` | **Partly built — export is not portable** |

The pattern is unmistakable: this is a *deep* EHR, built **US-first**. That is
not a criticism — it is the correct sequencing for a company that launched in
the US. But it means the four objectives are not four equal-sized gaps.

### 2.1 What the audit turned up

Three findings drove everything that follows.

**Finding A — the `.world` build is the US build with the network removed.**
`deploy-world.sh` deploys the same image with `TEFCA_ENABLED=false`, and
`server/routes.ts` then hard-blocks `/api/tefca*`, `/api/fasten-connect*`, and
`/api/fhir-streaming*`. That is correct — TEFCA is US-only law — but nothing
replaces it. An international patient today has **no** network interoperability
path at all. The flag subtracts; nothing adds.

**Finding B — nothing in the repository ever produced an International Patient
Summary.** Searching for `IPS` returns matches in exactly four files, and every
one of them is a *string inside an AI prompt* ("Consider US Core, IPS…"). There
was no generator, no validator, no endpoint. The IPS is the WHO- and G7-backed
artefact for cross-border care; the product talked about it without emitting one.

**Finding C — the export path is not portable in any useful sense.**
`patient-export-routes.ts` offers exactly two formats: PDF and CSV. Neither is
machine-readable by a receiving EHR, and neither can be verified. Handed a PDF,
a hospital abroad cannot tell whether the patient edited their own allergy list
before printing it — so they re-take the history and the export is worthless.

Supporting gaps found in the same sweep:

- **Zero** references to ABDM, ABHA, or NDHM — India's national health stack.
- **Zero** references to ICD-11, the WHO standard superseding ICD-10 globally.
- **Zero** references to India's DPDP Act 2023.
- Terminology is US-bound throughout: RxNorm (US drug codes), CVX (US vaccine
  codes), ICD-10-CM (a US clinical modification), NPI (US provider IDs).

### 2.2 The reframing

Objectives 1 and 2 are largely *done*, and their remaining gap is **calibration,
not capability** — see §4. The genuinely unaddressed work sits in objectives 3
and 4, and the two turn out to be the same problem viewed from two sides:

> A record is only sovereign if the patient can take it somewhere else **and
> have it be understood and trusted when they arrive.**

Portability without interoperability is a PDF nobody reads. Interoperability
without verifiability is data nobody trusts. Solving either alone solves
neither. **That intersection is the pathbreaking bit, and it is what Phase 1
builds.**

---

## 3. Phase 1 — implemented on this branch

Three modules, 59 tests, no changes to existing behaviour.

### 3.1 Jurisdiction registry — `shared/jurisdictions.ts`

A country-agnostic table replacing hardcoded US assumptions. Per jurisdiction it
declares the national health identifier and its FHIR naming system, the
governing privacy regime, the locally authoritative problem-code system, and
whether a national exchange exists at all (instead of assuming TEFCA).

Nine jurisdictions ship: IN, GB, AU, CA, US, DE, BR, ZA, SG. Unknown countries
resolve to a safe default rather than throwing — an unrecognised country must
never block a patient from holding their own record.

Identifier validation is real, not regex theatre:

- **ABHA (India)** — implements the **Verhoeff** checksum, the algorithm UIDAI
  chose for Aadhaar. Verhoeff catches *transposition* errors that Luhn misses,
  which is exactly the typo a human makes reading a 14-digit number aloud. A
  test asserts this specific property.
- **NHS Number (UK)** — modulus-11 check digit, including the rule that a
  computed remainder of 10 makes the number invalid by definition.

Structural validity is not identity. Binding an identifier to a *person*
requires the national authority's API (an ABDM auth flow for India) and is
deliberately out of scope — this module stays pure and offline.

### 3.2 IPS generator and validator — `server/services/world/`

`ips-generator.ts` builds a conformant HL7 **International Patient Summary**:
a self-contained FHIR *document* Bundle a clinician in any country can open,
coded in globally available terminologies — **SNOMED CT** for problems, **WHO
ATC** for medications, with the jurisdiction's local system (ICD-11 MMS for
India) as a secondary coding. Tests assert that RxNorm and CVX never appear.

The file is split deliberately: `buildIpsBundle(input)` is **pure** — no DB, no
clock, no randomness — and `collectIpsInput(profileId)` does the I/O. Purity is
not stylistic here: the document gets signed downstream, so identical input
must produce byte-identical output or signatures stop verifying. A test pins
that property.

**The rule that makes IPS hard.** IPS defines three *required* sections —
Problems, Medications, Allergies — and "required" is stronger than it sounds. A
section may not be omitted or left empty when the patient has no such data; a
conformant producer must state the absence explicitly using the IPS
absent/unknown code system. The distinction is clinically load-bearing:

> An **empty** allergy section means *"we never asked."*
> A **`no-known-allergies`** entry means *"we asked, and the answer was none."*

Treating the first as the second is how someone gets killed by a drug they were
known to react to. The generator emits the correct absent-unknown entry for
each empty required section; the validator rejects documents that do not.

`ips-validator.ts` checks the structural rules that break exchange in practice —
missing required section, empty required section, dangling internal reference,
Composition not first, missing narrative, missing patient identifier. It is
deliberately **not** a full FHIR validator: resolving ValueSets needs a
terminology server, and a World EHR must work in a clinic with no connectivity.

Patient-controlled strings are escaped before entering the XHTML narrative.
IPS narratives are rendered by receiving systems, so an unescaped allergen name
would be stored XSS in every downstream viewer.

### 3.3 Sovereign health passport — `health-passport.ts`

The IPS document wrapped in a detached **Ed25519** signature over a canonical
serialisation. Any third party can verify **entirely offline** that the document
is byte-for-byte what was issued and has not been altered since. Verification
never calls home — a patient in a village clinic with no connectivity can still
prove integrity from their phone.

Canonicalisation sorts object keys recursively (arrays keep order — in FHIR,
order is meaningful), which removes the entire class of failure where a
semantically identical document serialises differently after a round trip.

**Two honesty properties, both enforced by tests:**

*Provenance.* Most of a PHR is patient-entered. Signing patient-entered data as
though it were provider-attested would be a lie with clinical consequences.
Every passport carries an explicit assurance level — `provider-attested`,
`mixed`, or `patient-asserted` — with a plain-language statement embedded in the
envelope. The derivation errs downward: one patient-entered element is enough to
block a `provider-attested` claim. Today every passport is honestly
`patient-asserted`, because the provider-sourced ingestion paths are US-only.

*Key pinning.* Verifying against the key embedded in the envelope proves the
document is internally consistent — not that Tabula Medica signed it, since an
attacker can re-sign modified content with their own key. `verifyPassport`
takes the public key(s) the verifier trusts, and **the result says which
situation it is in**: `keyTrust` is `pinned` or `unverified-issuer`,
`issuerVerified` is the boolean to branch on, and an unpinned success carries a
`caveat` stating that `keyId` and `assurance` are unauthenticated claims. A
docstring warning was not enough — a caller that reads `valid` and stops is
exactly how these schemes fail, so the warning travels in the response body.

The `/verify` endpoint pins automatically: it verifies against
`PASSPORT_TRUSTED_PUBLIC_KEYS` plus the deployment's own signing key, rather
than against whatever key the posted envelope happens to carry.

*What the signature covers.* The envelope, not just the document: format,
issuer, document hash, the whole provenance block, and the key metadata. The
first cut signed the document bytes alone, which left `provenance.assurance`
outside the signature — so a genuine `patient-asserted` passport could be
edited in transit to read `provider-attested` and would still verify under the
real issuer key. That is the one forgery that survives correct key pinning, and
it is now a `signature-mismatch`. Fixing it was a breaking canonicalisation
change, so the envelope is `…health-passport.v2`; v1 is refused outright rather
than accepted, since honouring it would restore the same hole as a downgrade.

### 3.4 API — `server/world-ips-routes.ts`

```
GET  /api/world/ips           → the IPS document Bundle + conformance report
GET  /api/world/ips/passport  → the same document, signed
POST /api/world/ips/verify    → verify a passport
```

`/verify` is **unauthenticated by design**: its entire purpose is that a
clinician who has never heard of Tabula Medica can check a document a patient
handed them. It verifies in memory and stores nothing.

The passport endpoint returns **503 rather than an unsigned body** when no
signing key is configured — a caller that asked for a passport must not silently
receive something unverifiable that looks like one.

These routes carry no US assumptions and are the exchange path for `.world`,
where `TEFCA_ENABLED=false` otherwise leaves no route out of the app.

### 3.5 Deployment note

Passport signing needs `PASSPORT_SIGNING_KEY` (a PEM Ed25519 private key, raw or
base64). Until it is set, `/api/world/ips` works and `/api/world/ips/passport`
returns 503. Generate with `generatePassportKeyPair()`. The key must be stable
and backed up: rotating it invalidates every passport issued under the old key,
so publish the fingerprint (`keyFingerprint()`) for verifiers to pin.

`PASSPORT_TRUSTED_PUBLIC_KEYS` holds the SPKI PEM public keys this deployment
trusts as issuers — comma-separated, each raw or base64-wrapped. The
deployment's own signing key is trusted implicitly. Leaving it unset is a
legitimate state: `/verify` still checks the envelope and reports
`issuerVerified: false`, which is the honest answer for a host that recognises
nobody.

---

## 4. Phases 2–4 — specified, not built

### Phase 2 — recalibrate prediction for non-US populations

The risk engines are US-calibrated, and for South Asian patients that is not a
cosmetic problem — it is **clinically wrong in a known direction**.

- The ASCVD Pooled Cohort Equations were derived from US cohorts and are not
  validated for South Asian populations, who carry elevated cardiovascular risk
  at lower BMI and younger ages.
- BMI thresholds differ: WHO and Indian guidance use lower cut-offs for Asian
  populations than the US 25/30 defaults.
- Diabetes onset in India skews roughly a decade younger than in US cohorts.

Work: add a jurisdiction-aware risk-model selector alongside the existing
engine (WHO/ISH region-specific charts, Indian Diabetes Risk Score), driven by
the registry in §3.1. **Never silently swap models** — surface which model ran
and why, so a clinician can disagree with it.

### Phase 3 — ambient ingestion for the actual environment

The ambient plumbing exists. What is missing is fit to where it must run:
intermittent connectivity, shared devices, and paper. Work: offline-first
capture that reconciles on reconnect; multilingual scribe for consultations
conducted in Hindi, Marathi, Tamil (the `.world` build already carries 19 UI
languages and 50+ voice languages — the ingestion path should use them);
handwritten-prescription OCR, since paper is the dominant record format.

### Phase 4 — national network adapters

With the registry and IPS in place, national exchanges become adapters rather
than rewrites. India (**ABDM**) is the reference implementation: ABHA-based
linking, consent-manager flows, and the HIP/HIU roles. The registry already
declares which jurisdictions have an exchange, so the app can offer network
features only where they exist instead of assuming TEFCA.

**Regulatory note:** the DPDP Act 2023 is not GDPR with different words. It has
its own consent-manager construct, data-fiduciary duties, and rules on
cross-border transfer. `gdpr-routes.ts` cannot be aliased for it, and the
registry records `DPDP-2023` as a distinct regime for exactly this reason.

---

## 5. Why this is defensible

Not "AI-powered" — every vendor says that, and this repo already has ~200 AI
route files. The defensible claim is narrower and harder to copy:

**A patient-held clinical record that a stranger in another country can both
read and verify, offline.**

Incumbent HIS vendors cannot ship this easily, and the reason is structural
rather than technical: their record is an institutional asset. A patient-held,
cryptographically portable summary reduces switching costs for the *hospital's*
patients — it works against the business model that funds the product. That
asymmetry, not the cryptography, is the moat.

Two honest caveats. IPS adoption is real but uneven, so the passport's value
grows with the network. And the signature attests integrity, not clinical truth
— which is precisely why assurance level is a first-class field rather than
something buried in documentation.

---

## 6. What is in this branch

| Path | Purpose |
|---|---|
| `shared/jurisdictions.ts` | Country registry, national health ID validation |
| `shared/ips.ts` | IPS vocabulary, section specs, structural types |
| `server/services/world/ips-generator.ts` | IPS document builder (pure) + PHR reader |
| `server/services/world/ips-validator.ts` | Offline conformance validator |
| `server/services/world/health-passport.ts` | Ed25519 signing, canonicalisation, verification |
| `server/world-ips-routes.ts` | The three endpoints |
| `tests/world-jurisdictions.spec.ts` | 15 tests |
| `tests/world-ips.spec.ts` | 22 tests |
| `tests/world-health-passport.spec.ts` | 22 tests |

All new surface. No existing route, schema, or behaviour was modified; the only
edit to an existing file is the route registration in `server/routes.ts`.
