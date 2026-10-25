# Briefing Points for the CMS Director — 2026-10-15

Status: DRAFT policy points. Dollar and multiple claims ("10x") are unverified and must be validated with claims data before any external use. Authority notes are directional; confirm with counsel.

## 1. Site-of-service payment gap (core issue)

| Item | Detail |
|---|---|
| Problem | The same service (e.g., cardiology imaging, stress tests, cath-lab outpatient procedures, drug administration) is paid far more when billed by a hospital outpatient department (HOPD) than by an independent office. Hospital-acquired practices re-bill under the hospital's facility payment. |
| Claim to validate | Reported gap of up to ~10x for some cardiology procedures. Pull Part B and OPPS claims for the top 20 cardiology HCPCS/CPT codes to measure the real ratio. |
| Proposal | Site-neutral payment: pay HOPD at the physician-fee-schedule non-facility rate for services that are safely delivered in an office. Expand from clinic visits to cardiology and other high-volume codes. |
| Lever | Annual OPPS and PFS rulemaking. Broad site-neutral expansion may need Congress; phase-in via rule where authority exists. |

## 2. Separate outpatient tax ID / billing identity

- Require hospital-owned outpatient practices to enroll and bill under a distinct outpatient TIN/NPI, with a provider-based attestation and a distinct physical location.
- Purpose: make the "same doctor, same room, higher price" pattern visible in claims, so duplicate or inflated facility fees can be flagged and audited.
- Enforcement: tie provider-based status to the attestation; revoke it on audit failure.

## 2a. Reduce incentives for hospitals to acquire practices

- Drivers are the facility-fee differential and 340B-style margins. Site-neutral payment (item 1) removes most of the billing incentive.
- Add a claims-level flag for any practice whose billing changes from office to HOPD after a change of ownership.

## 3. Duplication-detection algorithm in claims software

- Build or extend claims edits to detect duplicate and overlapping billing: same patient, same service, same day, professional plus facility.
- Apply a payment rule at 50% for the second and later billing of overlapping services, modeled on the existing multiple-procedure payment reduction.
- Start in shadow mode: run on historical claims, report would-be savings and false-positive rate, then enforce.
- Build on existing NCCI edits and MUE limits instead of replacing them.

## 4. Malpractice insurance awards

- The ask: limit or reduce malpractice awards nationwide.
- CMS has limited direct authority here; tort law is mainly state-level. Federal options are Congress-led (caps, certificate-of-merit rules) or indirect (PFS malpractice RVU updates).
- Open item: the "Itala" reference in the request is unclear (possibly a federal statute or act). Needs clarification before drafting a position on "revoke or limit".

## Savings model (to build)

| Input | Source |
|---|---|
| HOPD vs office price per code | OPPS and PFS rate files |
| Volume shifted to HOPD since acquisition | Part B claims, ownership-change data |
| Duplicate-billing rate | Claims edit shadow run |

## Risks

- Hospitals argue HOPDs carry higher costs (standby capacity, emergency readiness, regulatory burden). Expect litigation and lobbying.
- Access risk in rural areas; consider exceptions.
- Algorithm false positives would delay legitimate payments; keep an appeal path.

## Questions for you

1. What is "Itala"? (statute, program, or term to be clarified)
2. Which cardiology codes first?
3. Position for CMS rulemaking vs asking Congress?
