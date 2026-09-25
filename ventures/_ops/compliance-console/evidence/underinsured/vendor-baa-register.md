# Vendor & Sub-processor Register — Underinsured
_Entity: Underinsured · Generated 2026-09-07 · Review cadence: annual + on onboarding a new sub-processor_

This entity handles PHI. Every PHI-touching sub-processor below must have a **signed BAA** on file before PHI flows.

Data-type key: PHI = protected health info · fPII = financial PII · PII = personal info.
Agreement key: BAA = Business Associate Agreement (PHI) · DPA = Data Processing Agreement (PII/fPII).

| Sub-processor | Purpose | Data handled | Agreement | Status |
|---|---|---|---|---|
| Google Cloud (GCP) | Infra: Cloud Run, Cloud SQL, GCS, Secret Manager, IAM | PHI/fPII/PII | BAA | Signed — Google Cloud BAA, org tabulamedica.com (780509095720) |
| GitHub (Microsoft) | Source control, CI, Dependabot, secret scanning | source, metadata | DPA | GitHub DPA (standard terms) |
| Google Workspace | Email, identity, docs (2SV enforced) | PII, business comms | DPA/BAA (via GCP) | Covered by Google terms |
| Sprinto | SOC 2 / HIPAA automation + continuous monitoring | system metadata | DPA | Sign DPA at engagement |
| Penetration-test vendor (TBD) | Annual security testing | scoped system access | NDA/MSA | Select a Sprinto-partner pentester before the Type II window |
| Anthropic (Claude) | Dev tooling only — never PHI | none (PHI) | No BAA | Policy-enforced: PHI never routed to Anthropic (no BAA) |
| Google Identity Platform (GCIP) | Authentication / MFA | PII, credentials | BAA (via GCP) | Covered by Google Cloud BAA |
| Google Vertex AI | AI inference (de-identified / guarded) | PHI (de-id), PII | BAA (via GCP) | Covered by Google Cloud BAA — PHI-AI routed Vertex-only, fail-closed |
| Stripe | Payments | fPII, payment data | DPA | Stripe DPA + PCI SAQ-A (CDE outsourced) |
| Mailgun (Sinch) | Transactional email | PII (email/ZIP) | DPA | Confirm DPA — never transmit PHI via email |
| Cloudflare | DNS, Pages, WAF | PII / none | DPA | Confirm DPA — keep PHI off CF-served surfaces |
| Expo / EAS | Mobile build + OTA | source, build config | DPA | Confirm DPA — no secrets/PHI in OTA bundles |
| Apple App Store | iOS distribution + IAP | store-account PII | Standard terms | App Privacy labels filed per app |
| Google Play | Android distribution | store-account PII | Standard terms | Data-safety form filed per app |

## Public sub-processor disclosure (Trust Center)
List on the Trust Center: Google Cloud (GCP), GitHub (Microsoft), Google Workspace, Google Identity Platform (GCIP), Google Vertex AI, Stripe, Mailgun (Sinch), Cloudflare, Expo / EAS, Apple App Store, Google Play.

## Review procedure (SOC 2 CC9.2 / HIPAA §164.308(b))
1. Maintain this register as the source of truth; re-review at least annually and whenever a sub-processor is added or a data flow changes.
2. Before enabling any PHI data flow, confirm a signed BAA is on file (route through counsel).
3. Confirm click-accept DPAs in each vendor dashboard; archive the confirmation.
4. Track open items: entries marked "CONFIRM" above are outstanding and gate the corresponding data flow.

> Source of truth: ~/Desktop/compliance-readiness/VENDOR-BAA-DPA-INVENTORY-2026-08.md (portfolio master). This per-entity slice is the Sprinto vendor-module import.
