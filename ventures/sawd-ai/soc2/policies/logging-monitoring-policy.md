# Logging & Monitoring Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Ensure SAWD collects, protects, and reviews logs sufficient to detect security events, support incident response, and demonstrate control operation — without logging Tier 1 data in the clear.

## 2. Scope
Logs and telemetry from GCP (Cloud Run, Cloud SQL, IAM/Audit Logs), GCIP authentication events, Cloudflare (traffic/WAF), Firebase Hosting, application logs, GitHub, and integration webhooks (Plaid, Stripe).

## 3. Policy Statements
1. **What is logged.** SAWD logs security-relevant events: authentication successes/failures, authorization changes, admin/privileged actions, access to Tier 1 data, configuration changes, deployments, and API errors/anomalies.
   > ⚠️ **GAP TO REMEDIATE:** Confirm audit logging (GCP Cloud Audit Logs, GCIP auth logs, access-to-Tier-1 logging) is enabled and centralized. If logs are not centralized/retained, CC7.2 evidence is thin.
2. **No sensitive data in logs.** Logs must not contain plaintext Tier 1 data (SSN/TIN, full financial-account numbers, secrets). Sensitive fields are masked/redacted before logging.
   > ⚠️ **GAP TO REMEDIATE:** Verify redaction/masking so taxpayer PII and secrets never land in logs (§7216 + C1.1 exposure otherwise).
3. **Centralization & integrity.** Logs are centralized (Cloud Logging), access-restricted, and tamper-resistant; log deletion/modification is itself restricted and logged.
4. **Retention.** Security/audit logs are retained at least **1 year** to cover the audit period and support forensics (aligned to Data Retention Policy).
5. **Monitoring & alerting.** Automated alerts fire on high-risk events: repeated auth failures / suspected account takeover, IAM privilege changes, unusual data access, deploy failures, WAF spikes, and availability degradation. Alerts route to the ISO/on-call.
   > ⚠️ **GAP TO REMEDIATE:** Define alerting rules and a monitored destination (email/Slack/pager). Without alerting, detection is manual and CC7.2/CC7.3 is weak.
6. **Review.** Security-relevant logs/alerts are reviewed regularly (at least weekly, or on alert), and the review is evidenced.
7. **Availability monitoring.** Uptime and performance of critical services are monitored with alerting to support Availability commitments (A1.1).
8. **Time sync.** Systems use synchronized time (UTC) so log timelines are reliable for investigations.
9. **Integration monitoring.** Plaid/Stripe webhooks and error rates are monitored; anomalies (e.g., payment failures, unusual linking activity) are alerted as potential fraud/security signals.

## 4. Roles / Responsibilities
- **ISO / Founder:** Owns logging scope, reviews alerts, defines retention.
- **Engineering:** Implements logging, redaction, centralization, and alerts.
- **Sprinto:** Ingests config evidence that logging/monitoring is enabled.

## 5. SOC 2 Mapping
CC7.1 (baseline/config), CC7.2 (monitoring for anomalies and security events), supporting CC7.3 (evaluation) and A1.1 (availability monitoring).

## 6. Enforcement
Disabling required logging or logging Tier 1 data in the clear is a control violation remediated immediately.

## 7. Review
Reviewed annually (next: 2027-09-03) and when systems or alerting change.
