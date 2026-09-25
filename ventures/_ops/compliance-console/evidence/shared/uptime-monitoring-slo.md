# Uptime Monitoring and SLO Policy

**Control:** AV-02 — Monitoring and Uptime
**Frameworks:** SOC 2 A1.1 (availability commitments) / CC7.2 (system monitoring) | ISO 27001 A.8.6 (capacity management)
**Owner:** Security Officer (Rajiv Aggarwal, rajiv@tabulamedica.com)
**Effective Date:** 2026-01-01
**Review Cycle:** Quarterly (reviewed at each quarterly access review)

---

## 1. Purpose

This policy defines the uptime and availability commitments (SLOs) for all Tabula Medica LLC
production services, documents the monitoring controls in place to detect and alert on
availability degradation, and establishes the incident response expectations for availability
events. It satisfies SOC 2 availability criteria and ISO 27001 capacity management requirements.

---

## 2. Infrastructure Overview

All production services run on GCP Cloud Run (fully managed, serverless container platform)
behind Cloudflare DNS/WAF where applicable. Cloud Run provides:

- Automatic horizontal scaling (zero to N instances) based on request load
- Built-in health check integration
- No manual server provisioning or capacity planning required for normal operating conditions
- Regional redundancy within GCP us-east1 (primary region)

Capacity management review is performed quarterly as part of the access review cycle.
No manual capacity planning is required under normal operating conditions; unusual traffic
spikes are reviewed retrospectively after each quarter.

---

## 3. SLO Definitions by Venture

SLOs are measured on a calendar-month basis. Measurement method: GCP Cloud Monitoring
uptime check success rate (HTTP 200 responses) aggregated over the month.

### 3.1 Primary Sprinto-Scope Ventures

| Venture | URL | GCP Project | Monthly Uptime SLO | p99 Latency SLO | Rationale |
|---------|-----|------------|-------------------|----------------|-----------|
| Uninsurance | uninsurance.care | uninsurance-care-2026 | 99.5% | < 2 seconds | Low-PHI; consumer access |
| PHR (Tabula Medica PHR) | tabula-medica.health | united-planet-485003-n7-9f345 | 99.5% | < 3 seconds | High-PHI; patient portal |
| WorldEHR (omnihealth) | worldehr.com | worldehr-app | 99.5% | < 3 seconds | High-PHI; EHR platform |
| SAWD | sawd.ai | sawd-app-2026 | 99.9% | < 2 seconds | Fintech; financial data access |
| ACO | app.tabulamedicaaco.com | tabula-medica-bfd3d | 99.5% | < 3 seconds | High-PHI; ACO care coordination |

**SAWD note:** 99.9% SLO applies because SAWD handles financial PII and tax data (EFIN 102371).
Users may have time-sensitive access needs (tax filing, financial reporting). Downtime during
peak tax season (Jan–Apr) is especially impactful.

### 3.2 Portfolio Ventures (not primary Sprinto scope)

| Venture | GCP Project | Monthly Uptime SLO | p99 Latency SLO |
|---------|------------|-------------------|----------------|
| Underinsured | underinsured-app-2026 | 99.0% | < 3 seconds |
| Cognita | tabula-cognita-prod | 99.0% | < 3 seconds |
| Attentiva | tabula-attentiva-phi | 99.0% | < 3 seconds |
| LTFM Health | ltfm-health-2026 | 99.0% | < 2 seconds |

### 3.3 SLO Downtime Budget (Reference)

| SLO | Max downtime/month |
|-----|-------------------|
| 99.9% | 43 minutes 49 seconds |
| 99.5% | 3 hours 39 minutes |
| 99.0% | 7 hours 18 minutes |

---

## 4. Monitoring Implementation

### 4.1 GCP Cloud Monitoring Uptime Checks

Each Cloud Run service has an HTTP uptime check configured in GCP Cloud Monitoring:

- **Check frequency:** Every 1 minute
- **Check type:** HTTPS GET to the service health endpoint (e.g., `/health` or `/`)
- **Expected response:** HTTP 200
- **Check regions:** Multiple GCP regions (us-east1, us-central1, us-west1) to distinguish
  regional issues from full outages
- **Failure threshold:** Alert triggers after 2 consecutive failures (approximately 2 minutes
  of downtime confirmed before alerting)

### 4.2 Alert Configuration

All uptime check failures route to GCP Cloud Monitoring alerting policies with the
following notification channels:

| Channel | Destination | Severity |
|---------|------------|---------|
| Email | rajiv@tabulamedica.com | All outages |
| Email | rajivka4@gmail.com | All outages (backup) |

**Alert trigger:** Downtime exceeding 5 continuous minutes triggers an alert.
(2-minute confirmation window + up to 3 minutes of alert delivery time.)

### 4.3 Log-Based Metrics

In addition to uptime checks, Cloud Run request logs are monitored via GCP Cloud Logging:

- HTTP 5xx error rate exceeding 5% over a 5-minute window generates an alert
- Cold start latency spikes (p99 > 2x SLO threshold) generate a warning
- Log-based alerts route to the same notification channels as uptime checks

### 4.4 Cloudflare Monitoring (Uninsurance, SAWD)

For ventures behind Cloudflare:

- Cloudflare Health Checks are configured in addition to GCP uptime checks
- Cloudflare Analytics are reviewed monthly for anomalous traffic patterns (DDoS indicators,
  bot traffic spikes) as part of the quarterly security review

---

## 5. Incident Response — Availability Events

### 5.1 On-Call Coverage

| Role | Name | Contact |
|------|------|---------|
| Primary on-call (sole engineer) | Rajiv Aggarwal | rajiv@tabulamedica.com / rajivka4@gmail.com |
| Escalation | Rajiv Aggarwal | Same — sole engineer; no secondary on-call |

### 5.2 Response SLAs

| Severity | Definition | Response Time | Resolution Target |
|---------|-----------|--------------|------------------|
| P0 — Critical | Full service outage; all users affected; PHI systems unavailable | 1 hour | 4 hours |
| P1 — High | Partial outage; >25% of users affected; degraded functionality | 2 hours | 8 hours |
| P2 — Medium | Performance degradation; p99 latency >2x SLO; <25% users affected | 4 hours | 24 hours |
| P3 — Low | Minor degradation; SLO not breached; informational | Next business day | 72 hours |

**Critical services (P0 applies):** PHR, WorldEHR, ACO (PHI-bearing), SAWD (fintech).

### 5.3 Incident Response Steps

1. **Alert received** — GCP Cloud Monitoring or Cloudflare alert fires to email
2. **Acknowledge** — Reviewer acknowledges within response SLA window
3. **Diagnose** — Check GCP Cloud Run logs, Cloud SQL status, and GCP Status Dashboard
4. **Mitigate** — Apply fix (redeploy container, scale up instance count, roll back deployment)
5. **Verify** — Confirm uptime check returns green; latency returns to normal
6. **Document** — Record incident in the incident log at:
   `ventures/_ops/compliance-console/evidence/shared/incident-log.md`
7. **Post-mortem** — For P0/P1 incidents, complete a blameless post-mortem within 5 business days
8. **Notify** — If a PHI system was unavailable for >1 hour, assess whether HIPAA breach
   notification analysis is required per Incident Response Policy (02-incident-response-and-breach-notification.md)

### 5.4 Business Continuity Integration

Availability incidents that exceed 4 hours for any PHI-bearing service activate the
Business Continuity Plan (07-business-continuity-and-disaster-recovery.md).

---

## 6. Capacity Management

### 6.1 Cloud Run Auto-Scaling

All services use GCP Cloud Run default auto-scaling:

- **Min instances:** 0 (scale-to-zero when idle, to minimize cost)
  - Exception: SAWD and PHR are configured with min-instances = 1 during business hours
    to eliminate cold-start latency for active users
- **Max instances:** 10 (default; reviewable per service)
- **Concurrency:** 80 requests per instance (Cloud Run default)
- **Memory/CPU:** Configured per service; reviewed at deployment and quarterly

### 6.2 Quarterly Capacity Review

At each quarterly access review, the Security Officer reviews:

- Peak concurrency observed in the prior quarter (from Cloud Monitoring metrics)
- Whether max-instance limits were reached (indicating potential throttling)
- Cloud SQL connection pool saturation
- Storage growth rate (Cloud SQL disk, GCS buckets)

No manual capacity planning action is required unless a limit was reached or storage is
projected to exhaust within 6 months. Any capacity actions taken are documented in the
quarterly access review record.

### 6.3 Current Capacity Limits (as of 2026-09-19)

| Service | Max Instances | Memory | CPU |
|---------|-------------|--------|-----|
| Uninsurance | 10 | 512 MiB | 1 vCPU |
| PHR | 10 | 1 GiB | 2 vCPU |
| WorldEHR | 10 | 1 GiB | 2 vCPU |
| SAWD | 10 | 512 MiB | 1 vCPU |
| ACO | 10 | 1 GiB | 1 vCPU |
| Others | 5 | 512 MiB | 1 vCPU |

Limits are reviewed quarterly and adjusted based on observed usage.

---

## 7. Evidence and Record-Keeping

| Record | Location | Retention |
|--------|---------|-----------|
| GCP uptime check dashboards | GCP Cloud Monitoring (live) | 30 days (GCP default); export monthly for 3-year retention |
| Monthly uptime reports | `evidence/shared/uptime-reports/YYYY-MM.md` | 3 years |
| Incident log | `evidence/shared/incident-log.md` | 3 years |
| Post-mortems | `evidence/shared/post-mortems/` | 3 years |
| Quarterly capacity review notes | Embedded in quarterly access review record | 3 years |

Monthly uptime reports are generated on the first business day of each month, documenting
the prior month's uptime percentage and latency percentiles for each venture, compared against
the SLO targets defined in Section 3.

---

## 8. References

- SOC 2 A1.1 — Availability commitments and system components
- SOC 2 CC7.2 — System monitoring
- ISO 27001:2022 A.8.6 — Capacity management
- Tabula Medica Business Continuity and Disaster Recovery Policy (07-business-continuity-and-disaster-recovery.md)
- Tabula Medica Incident Response Policy (02-incident-response-and-breach-notification.md)
- GCP Cloud Monitoring: https://cloud.google.com/monitoring
- Risk Register: Desktop/compliance-readiness/RISK-REGISTER-2026-08-20.md
