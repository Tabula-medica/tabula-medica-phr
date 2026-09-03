# Incident Response Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice. Breach-notification triggers and timelines below are DRAFT placeholders and MUST be confirmed by counsel before SAWD relies on them.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, plus post-incident and at least one tabletop test per year.

---

## 1. Purpose
Establish how SAWD detects, responds to, contains, and recovers from security incidents, and how it determines and executes breach-notification obligations for taxpayer, personal, and financial-account data.

## 2. Scope
All security events affecting SAWD systems or data, including unauthorized access, data exposure, malware, account compromise, vendor/subprocessor breach (Base44, Plaid, Stripe, GCP, Cloudflare, AI providers), availability incidents, and lost/stolen devices.

## 3. Policy Statements
1. **Definitions.** An **event** is any observable occurrence; an **incident** is an event that compromises (or may compromise) confidentiality, integrity, or availability. A **breach** is an incident involving unauthorized acquisition/access to protected data, as defined by applicable law and confirmed by counsel.
2. **Reporting.** Any workforce member who suspects an incident reports it to the ISO immediately (target: within 1 hour of discovery) via the designated channel. No fear of blame for good-faith reporting.
3. **Severity classification.** Incidents are triaged into severity tiers (e.g., SEV1 confirmed data breach / major outage → SEV3 minor). Severity drives response speed and escalation.
4. **Response lifecycle.** SAWD follows: **Detect → Triage → Contain → Eradicate → Recover → Post-incident review.** Each phase and decision is logged in an incident record.
5. **Containment.** For SEV1/SEV2, contain immediately (revoke credentials, isolate systems, rotate keys, block at Cloudflare) — containment precedes forensic completeness.
6. **Evidence & forensics.** Preserve logs and artifacts; do not destroy evidence. Maintain a timeline. Engage external forensics for confirmed breaches.
7. **Breach-notification triggers (DRAFT — counsel to confirm).** If an incident is determined to be a breach of protected data, SAWD evaluates notification duties, which may include:
   - **State breach-notification laws** (e.g., California and other states) — consumer notice, often "without unreasonable delay."
   - **FTC Safeguards Rule breach notice** — notification to the FTC for qualifying events affecting 500+ consumers, per the rule's timeline.
   - **IRS / tax-ecosystem** — potential obligations tied to taxpayer data compromise (e.g., IRS Stakeholder Liaison, state tax agencies) under the tax-preparer security framework.
   - **Contractual** — Plaid, Stripe, and other partners' incident-notice clauses.
   > ⚠️ **GAP TO REMEDIATE:** Exact triggers, thresholds, recipients, and deadlines are jurisdiction- and contract-specific and are **not settled**. Counsel must produce the confirmed notification matrix before SAWD attests to a breach-response capability. No notification, regulatory filing, or taxpayer/third-party communication is sent without counsel sign-off.
8. **Communications.** External communications (to customers, regulators, partners, press) are approved by the Founder and counsel only. Internal need-to-know is maintained.
9. **Vendor incidents.** If a subprocessor reports a breach, SAWD activates this process for its affected data and evaluates its own downstream obligations.
10. **Post-incident review.** Within 5 business days of closure, conduct a blameless retrospective; record root cause and corrective actions and track to closure (feeds risk register).
11. **Testing.** Conduct at least one tabletop exercise annually to validate this plan.
    > ⚠️ **GAP TO REMEDIATE:** No incident-response tabletop has been conducted yet. Run one and retain evidence before the audit period closes (CC7.4/CC7.5).

## 4. Roles / Responsibilities
- **ISO / Incident Commander (Founder):** Declares incidents, directs response, approves external comms with counsel.
- **Engineering:** Executes containment/eradication/recovery.
- **Counsel:** Determines legal breach status and notification obligations; approves external communications.
- **Workforce members:** Report promptly; support response.

## 5. SOC 2 Mapping
CC7.2, CC7.3, CC7.4, CC7.5 (detection, evaluation, response, and recovery from security incidents), supporting CC2.3 (communication of incidents).

## 6. Enforcement
Failure to report a known incident is a serious violation subject to disciplinary action. Suppressing or destroying evidence may carry legal consequences.

## 7. Review
Reviewed annually (next: 2027-09-03), after every SEV1/SEV2 incident, and after each tabletop.
