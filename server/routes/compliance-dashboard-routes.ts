import { Router, Request, Response } from "express";
import {
  runComplianceValidation,
  generateEvidenceReport,
  getSecurityEvents,
  resolveSecurityEvent,
  recordFailedLogin,
  recordBulkExport,
} from "../security/compliance-validator";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const report = runComplianceValidation();
    res.json(report);
  } catch (error: any) {
    console.error("[ComplianceDashboard] Validation error:", error?.message);
    res.status(500).json({ error: "Failed to run compliance validation" });
  }
});

router.get("/evidence", async (_req: Request, res: Response) => {
  try {
    const evidence = generateEvidenceReport();
    res.json(evidence);
  } catch (error: any) {
    console.error("[ComplianceDashboard] Evidence report error:", error?.message);
    res.status(500).json({ error: "Failed to generate evidence report" });
  }
});

router.get("/security-events", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = getSecurityEvents(limit);
    const unresolvedCount = events.filter((e) => !e.resolved).length;
    res.json({
      events,
      total: events.length,
      unresolved: unresolvedCount,
    });
  } catch (error: any) {
    console.error("[ComplianceDashboard] Security events error:", error?.message);
    res.status(500).json({ error: "Failed to fetch security events" });
  }
});

router.post("/security-events/:id/resolve", async (req: Request, res: Response) => {
  try {
    const success = resolveSecurityEvent(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Security event not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ComplianceDashboard] Resolve event error:", error?.message);
    res.status(500).json({ error: "Failed to resolve security event" });
  }
});

router.get("/hipaa-checklist", async (_req: Request, res: Response) => {
  const checklist = {
    administrativeSafeguards: [
      { id: "admin-1", requirement: "Security Management Process", section: "§164.308(a)(1)", status: "implemented", evidence: "Risk analysis via soc2-compliance-service.ts; security event monitoring via compliance-validator.ts" },
      { id: "admin-2", requirement: "Assigned Security Responsibility", section: "§164.308(a)(2)", status: "implemented", evidence: "Admin role defined with security responsibility; role-based access in RBAC system" },
      { id: "admin-3", requirement: "Workforce Security", section: "§164.308(a)(3)", status: "implemented", evidence: "Role-based access control; authorization procedures for PHI access; termination procedures via session management" },
      { id: "admin-4", requirement: "Information Access Management", section: "§164.308(a)(4)", status: "implemented", evidence: "Minimum necessary via RBAC; access authorization policies; clearance procedures" },
      { id: "admin-5", requirement: "Security Awareness Training", section: "§164.308(a)(5)", status: "implemented", evidence: "AI onboarding flows; security infrastructure page; compliance testing module" },
      { id: "admin-6", requirement: "Security Incident Procedures", section: "§164.308(a)(6)", status: "implemented", evidence: "Incident records with P1-P4 severity; breach notification tracking; root cause analysis" },
      { id: "admin-7", requirement: "Contingency Plan", section: "§164.308(a)(7)", status: "implemented", evidence: "Data backup via object storage; disaster recovery procedures; emergency mode operation via Break-the-Glass" },
      { id: "admin-8", requirement: "Evaluation", section: "§164.308(a)(8)", status: "implemented", evidence: "Automated compliance validation; periodic review schedules in SOC2 controls" },
      { id: "admin-9", requirement: "BAA Contracts", section: "§164.308(b)(1)", status: "implemented", evidence: "Vendor risk assessment with BAA tracking; vendor compliance monitoring" },
    ],
    physicalSafeguards: [
      { id: "phys-1", requirement: "Facility Access Controls", section: "§164.310(a)(1)", status: "cloud_provider", evidence: "Managed by cloud infrastructure provider (GCP/Google Cloud Run); BAA covers physical security" },
      { id: "phys-2", requirement: "Workstation Use", section: "§164.310(b)", status: "implemented", evidence: "Session timeouts (15min idle, 8hr absolute); device session management; MFA enforcement" },
      { id: "phys-3", requirement: "Device & Media Controls", section: "§164.310(d)(1)", status: "implemented", evidence: "Data retention policies with automated cleanup; encryption at rest; secure disposal via retention scheduler" },
    ],
    technicalSafeguards: [
      { id: "tech-1", requirement: "Access Control", section: "§164.312(a)(1)", status: "implemented", evidence: "Unique user IDs; emergency access (Break-the-Glass); automatic logoff (15min); AES-256-GCM encryption" },
      { id: "tech-2", requirement: "Audit Controls", section: "§164.312(b)", status: "implemented", evidence: "WORM audit trail with hash-chain verification; PHI access logging; 7-year retention" },
      { id: "tech-3", requirement: "Integrity Controls", section: "§164.312(c)(1)", status: "implemented", evidence: "SHA-256 hash chain audit integrity; FHIR resource validation; data quality monitoring" },
      { id: "tech-4", requirement: "Person/Entity Authentication", section: "§164.312(d)", status: "implemented", evidence: "Google Cloud Identity Platform authentication; provider-side MFA available; rate-limited login attempts" },
      { id: "tech-5", requirement: "Transmission Security", section: "§164.312(e)(1)", status: "implemented", evidence: "TLS 1.3 enforced; HSTS with 2-year max-age; PHI route cache prevention" },
    ],
  };

  const total = [
    ...checklist.administrativeSafeguards,
    ...checklist.physicalSafeguards,
    ...checklist.technicalSafeguards,
  ];
  const implemented = total.filter((c) => c.status === "implemented" || c.status === "cloud_provider").length;

  res.json({
    ...checklist,
    summary: {
      total: total.length,
      implemented,
      compliancePercentage: Math.round((implemented / total.length) * 100),
    },
  });
});

router.get("/soc2-controls", async (_req: Request, res: Response) => {
  const controls = {
    security: [
      { id: "CC1.1", name: "COSO Principle 1 – Commitment to Integrity", status: "implemented", evidence: "Code of conduct via AI guardrails; NO-CDS compliance enforcement" },
      { id: "CC2.1", name: "Internal Communication", status: "implemented", evidence: "Audit trail notifications; compliance dashboard; incident alerting" },
      { id: "CC3.1", name: "Risk Assessment", status: "implemented", evidence: "Automated risk scoring in SOC2 service; vendor risk assessments; security event detection" },
      { id: "CC4.1", name: "Monitoring Controls", status: "implemented", evidence: "Real-time security event detection; compliance validation; WORM audit verification" },
      { id: "CC5.1", name: "Control Activities", status: "implemented", evidence: "RBAC enforcement; input validation; rate limiting; CSRF protection" },
      { id: "CC6.1", name: "Logical Access Controls", status: "implemented", evidence: "Role-based access; MFA; session management; tenant isolation" },
      { id: "CC6.2", name: "User Authentication", status: "implemented", evidence: "Google Cloud Identity Platform; provider-side MFA; rate-limited authentication" },
      { id: "CC6.3", name: "Access Authorization", status: "implemented", evidence: "RBAC middleware; FHIR scope evaluation; Break-the-Glass emergency access" },
      { id: "CC6.5", name: "Data Disposal", status: "implemented", evidence: "Automated retention cleanup; category-specific policies; daily scheduler" },
      { id: "CC6.6", name: "Transmission Security", status: "implemented", evidence: "TLS 1.3; HSTS; encrypted data exchange" },
      { id: "CC6.7", name: "Restricting Information Transmission", status: "implemented", evidence: "PHI route protection; cache prevention; CORS restrictions" },
      { id: "CC7.1", name: "Detection Procedures", status: "implemented", evidence: "Security event monitoring; brute force detection; PHI access anomaly detection" },
      { id: "CC7.2", name: "Monitoring Activities", status: "implemented", evidence: "WORM audit logs; request correlation; enhanced audit service with risk levels" },
      { id: "CC7.3", name: "Security Incident Response", status: "implemented", evidence: "Incident management with P1-P4 severity; breach notification; root cause analysis" },
      { id: "CC8.1", name: "Change Management", status: "implemented", evidence: "Change records with PR tracking; approval chains; rollback plans; automated change logging" },
      { id: "CC9.2", name: "Vendor Risk Management", status: "implemented", evidence: "Vendor assessments with BAA/SOC2 tracking; risk levels; mitigation plans" },
    ],
    availability: [
      { id: "A1.1", name: "Availability Commitment", status: "implemented", evidence: "Health endpoint monitoring; GCP Healthcare API integration" },
      { id: "A1.2", name: "Recovery Objectives", status: "implemented", evidence: "Data backup procedures; contingency planning; emergency access protocols" },
    ],
    confidentiality: [
      { id: "C1.1", name: "Confidential Information Identification", status: "implemented", evidence: "PHI route classification; data governance with AI classification" },
      { id: "C1.2", name: "Disposal of Confidential Information", status: "implemented", evidence: "Automated retention policies; secure data disposal scheduler" },
    ],
    processingIntegrity: [
      { id: "PI1.1", name: "Processing Integrity", status: "implemented", evidence: "FHIR validation; data quality monitoring; hash-chain integrity verification" },
    ],
    privacy: [
      { id: "P1.1", name: "Privacy Notice", status: "implemented", evidence: "Privacy policy page; consent management; data processing transparency" },
      { id: "P6.1", name: "Consent for Data Use", status: "implemented", evidence: "Patient consent management; FHIR consent resources; granular consent controls" },
    ],
  };

  const allControls = [
    ...controls.security,
    ...controls.availability,
    ...controls.confidentiality,
    ...controls.processingIntegrity,
    ...controls.privacy,
  ];

  res.json({
    ...controls,
    summary: {
      total: allControls.length,
      implemented: allControls.filter((c) => c.status === "implemented").length,
      categories: {
        security: controls.security.length,
        availability: controls.availability.length,
        confidentiality: controls.confidentiality.length,
        processingIntegrity: controls.processingIntegrity.length,
        privacy: controls.privacy.length,
      },
    },
  });
});

export default router;
