# HIPAA-Compliant Deployment Guide for Tabula Medica

## Overview

This guide outlines the requirements and steps to deploy Tabula Medica to a HIPAA-eligible cloud environment with a signed Business Associate Agreement (BAA).

## Current Compliance Status

### ✅ Application-Level Controls (Implemented)

| Control | Description | Status |
|---------|-------------|--------|
| Audit Logging | Who/What/When logging for all PHI access | ✅ Implemented |
| Encryption at Rest | AES-256-GCM for sensitive data (MFA secrets, PHI) | ✅ Implemented |
| Encryption in Transit | TLS 1.3 enforced | ✅ Enforced |
| Multi-Factor Authentication | TOTP with backup codes, account lockout | ✅ Implemented |
| Session Management | 30-minute timeout, device fingerprinting | ✅ Implemented |
| Access Control | Role-based access with granular permissions | ✅ Implemented |
| Integrity Verification | SHA-256 hash chain for audit logs | ✅ Implemented |

### ⏳ Infrastructure-Level Requirements (Require Cloud Migration)

| Requirement | Description | Provider Options |
|-------------|-------------|------------------|
| Business Associate Agreement | Legal agreement with hosting provider | AWS, Azure, GCP |
| HIPAA-Eligible Infrastructure | Dedicated/isolated compute and storage | See below |
| Physical Security | SOC 2 Type II certified data centers | All major clouds |
| Backup & Disaster Recovery | Encrypted backups with geographic redundancy | Cloud-native solutions |

---

## Cloud Provider Options

### 1. Amazon Web Services (AWS)

**HIPAA-Eligible Services:**
- Amazon RDS (PostgreSQL)
- Amazon ECS/EKS (Container hosting)
- AWS Secrets Manager
- Amazon CloudWatch (Logging)
- AWS WAF (Web Application Firewall)

**BAA Process:**
1. Create an AWS Organization
2. Accept the AWS BAA via AWS Artifact
3. Configure only HIPAA-eligible services
4. Enable AWS CloudTrail for audit logging

**Deployment Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                        AWS VPC                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   AWS WAF   │───▶│     ALB     │───▶│   ECS Fargate   │  │
│  │  (Shield)   │    │   (HTTPS)   │    │   (Containers)  │  │
│  └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                                                  │           │
│  ┌─────────────┐    ┌─────────────┐    ┌────────▼────────┐  │
│  │   Secrets   │───▶│  RDS Postgres│◀───│   CloudWatch    │  │
│  │   Manager   │    │  (Encrypted) │    │    (Logging)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2. Microsoft Azure

**HIPAA-Eligible Services:**
- Azure Database for PostgreSQL
- Azure Kubernetes Service (AKS)
- Azure Key Vault
- Azure Monitor
- Azure Front Door (WAF)

**BAA Process:**
1. Sign Microsoft's Business Associate Amendment
2. Configure Azure Policy for HIPAA compliance
3. Use Azure Security Center for monitoring

### 3. Google Cloud Platform (GCP)

**HIPAA-Eligible Services:**
- Cloud SQL (PostgreSQL)
- Google Kubernetes Engine (GKE)
- Secret Manager
- Cloud Logging
- Cloud Armor (WAF)

**BAA Process:**
1. Accept Google Cloud's BAA via Cloud Console
2. Configure organization policies for HIPAA
3. Enable Cloud Audit Logs

---

## HITRUST CSF Mapping

HITRUST Common Security Framework (CSF) provides a certifiable framework that maps to HIPAA:

### Key Control Categories

| HITRUST Domain | Control | Tabula Medica Implementation |
|----------------|---------|------------------------------|
| 01 - Access Control | 01.a Policy | Role-based access control |
| 01 - Access Control | 01.d Authentication | TOTP MFA with backup codes |
| 01 - Access Control | 01.q Multi-Factor | Enforced for PHI access |
| 06 - Audit Logging | 06.a Audit Controls | Who/What/When logging |
| 09 - Transmission | 09.m Encryption | TLS 1.3, AES-256-GCM |
| 10 - System Development | 10.a Security Testing | Input validation, CSRF protection |

---

## Identity Provider Integration

### Auth0 (Recommended for HIPAA)

Auth0 offers a Business Associate Agreement and HIPAA-compliant identity services:

**Required Environment Variables:**
```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=https://your-api-identifier
```

**HIPAA Features:**
- Enterprise MFA (TOTP, Push, SMS, WebAuthn)
- Anomaly detection and brute-force protection
- Comprehensive audit logging
- Session management policies
- BAA available on Enterprise plan

### Okta

Okta also provides HIPAA-compliant identity management:

**Required Environment Variables:**
```env
OKTA_DOMAIN=your-org.okta.com
OKTA_CLIENT_ID=your-client-id
OKTA_CLIENT_SECRET=your-client-secret
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Select HIPAA-eligible cloud provider
- [ ] Sign Business Associate Agreement
- [ ] Configure VPC with private subnets
- [ ] Set up encrypted database (AES-256)
- [ ] Configure secrets management
- [ ] Set up logging and monitoring

### Application Configuration

- [ ] Enable all HIPAA compliance features
- [ ] Configure Auth0/Okta for identity management
- [ ] Verify MFA enforcement
- [ ] Test audit logging
- [ ] Configure session timeout policies

### Post-Deployment

- [ ] Conduct security assessment
- [ ] Run penetration testing
- [ ] Document incident response procedures
- [ ] Train staff on HIPAA policies
- [ ] Schedule regular compliance audits

---

## Security Monitoring

### Required Metrics to Monitor

1. **Failed Login Attempts** - Alert on >5 failures per hour
2. **PHI Access Patterns** - Detect unusual access volumes
3. **MFA Bypass Attempts** - Immediate alert
4. **Session Anomalies** - Geographic or device changes
5. **Audit Log Integrity** - Hash chain verification

### Recommended Tools

- **AWS**: GuardDuty, Security Hub, CloudWatch
- **Azure**: Sentinel, Security Center, Monitor
- **GCP**: Security Command Center, Cloud Logging

---

## Compliance Contacts

For HIPAA BAA inquiries:

- **AWS**: https://aws.amazon.com/compliance/hipaa-compliance/
- **Azure**: https://azure.microsoft.com/en-us/resources/microsoft-azure-compliance-and-hipaa-baa/
- **GCP**: https://cloud.google.com/security/compliance/hipaa
- **Auth0**: https://auth0.com/docs/secure/hipaa
- **Okta**: https://www.okta.com/hipaa/

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-03 | Initial deployment guide |
