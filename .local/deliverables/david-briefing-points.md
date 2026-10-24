# Briefing Points for David — 2026-10-15

Status: DRAFT for discussion. Assumes David is the strategy/ops counterpart. Figures to be validated before external use.

## 1. Extend ACO model from MSSP to Commercial

| Item | Detail |
|---|---|
| Goal | Replicate MSSP-style shared-savings economics (benchmark, quality gate, shared savings/risk) in commercial contracts |
| Note | MSSP is a Medicare-only program. Commercial needs payer-by-payer shared-savings or total-cost-of-care contracts that mirror its structure |
| Prerequisite | Attributed commercial lives, claims feed, quality-measure reporting, risk adjustment |
| First moves | (1) Inventory current MSSP performance and infrastructure. (2) Shortlist 2-3 commercial payers and employer groups. (3) Draft a term sheet with upside-only year 1, two-sided risk from year 2. |
| Owner / Decision | David: which payers to approach first; target covered-lives threshold |

## 2. Launch a National Medical Group

- Structure: national management services organization (MSO) with state-level professional entities, to handle corporate-practice-of-medicine rules.
- Scope: multi-state, hybrid care delivery (in-person plus virtual), anchored to the ACO contracts in item 1.
- Gating items: state licensure and credentialing map, malpractice program, payer enrollment, NPI and taxonomy setup.
- Decision for David: build vs. acquire/affiliate existing practices; launch states (suggest 2-3 pilot states).

## 3. Launch Uniform EHR (Outpatient)

- One standard outpatient EHR configuration across all group practices: common templates, order sets, quality-measure capture, FHIR-based interoperability.
- Why: required for consistent quality reporting (items 1-2) and a single data layer.
- Integration: Tabula Medica PHR as the patient-facing record layer; FHIR exchange with the EHR.
- Compliance: HIPAA BAA with every vendor in the chain. Say "aligned with" SOC 2/HITRUST at most; no certification claims.
- Decision for David: EHR vendor selection (buy vs. build on current stack) and rollout sequence.

## 4. Launch Tabula Medica to Promote Uninsurance Plan and Underinsured.health Plan

- Positioning: Tabula Medica is the front door; Uninsurance (uninsured) and Underinsured.health (underinsured) are the two audience tracks.
- Channels: in-app entry points, free-care finder and drug-price tools already in the public data service, partner clinics, community orgs.
- Copy rules: region-gated US vs. International copy; no SOC 2/HITRUST claims; new strings through the language layer (19 languages).
- Engineering note: new public landing pages must be added to the public route lists in `client/src/App.tsx`.
- Decision for David: launch date, lead audience, success metrics (enrollments, referrals, activations).

## Sequencing (suggested)

1. Weeks 0-4: payer shortlist, state pilot selection, EHR vendor shortlist, Tabula Medica launch copy.
2. Weeks 4-12: term sheets out, MSO formation, EHR pilot, Tabula Medica soft launch.
3. Weeks 12+: first commercial ACO contract live, medical group pilot states open, full public launch.

## Risks

- Commercial ACO needs enough attributed lives to be actuarially credible.
- State CPOM and licensure rules vary; legal review required before the group launches.
- A uniform EHR rollout without clinician buy-in stalls adoption.
- Marketing to uninsured/underinsured populations needs careful eligibility and advertising compliance review.

## Questions for David

1. Which commercial payers do we already have a relationship with?
2. Pilot states for the medical group?
3. Preferred EHR path (buy, build, or hybrid)?
4. Launch date for the Tabula Medica promotion?
