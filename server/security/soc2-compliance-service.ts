import { v4 as uuidv4 } from "uuid";

export interface SOC2Control {
  id: string;
  category: "CC" | "A" | "C" | "PI" | "P";
  controlId: string;
  name: string;
  description: string;
  trustServiceCriteria: string[];
  status: "implemented" | "partial" | "planned" | "not_applicable";
  implementationDetails: string;
  evidence: string[];
  owner: string;
  reviewFrequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
  lastReviewedAt?: string;
  nextReviewAt: string;
  riskLevel: "low" | "medium" | "high";
}

export interface AccessReview {
  id: string;
  reviewedBy: string;
  reviewDate: string;
  usersReviewed: number;
  changesRequired: number;
  changesMade: number;
  findings: string[];
  nextReviewDate: string;
}

export interface ChangeManagementRecord {
  id: string;
  changeType: "code" | "infrastructure" | "configuration" | "database";
  description: string;
  requestedBy: string;
  approvedBy: string[];
  implementedBy: string;
  prNumber?: string;
  testingCompleted: boolean;
  rollbackPlan: string;
  status: "pending" | "approved" | "implemented" | "rolled_back";
  requestedAt: string;
  approvedAt?: string;
  implementedAt?: string;
}

export interface IncidentRecord {
  id: string;
  severity: "P1" | "P2" | "P3" | "P4";
  title: string;
  description: string;
  affectedSystems: string[];
  detectedAt: string;
  resolvedAt?: string;
  rootCause?: string;
  resolution?: string;
  lessonsLearned?: string[];
  preventiveMeasures?: string[];
  notifiedParties: string[];
  isBreachNotificationRequired: boolean;
}

export interface VendorRiskAssessment {
  id: string;
  vendorName: string;
  serviceDescription: string;
  dataShared: string[];
  phiHandled: boolean;
  baaStatus: "signed" | "pending" | "not_required";
  soc2Certified: boolean;
  lastAssessmentDate: string;
  nextAssessmentDate: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  mitigations: string[];
}

const soc2Controls: SOC2Control[] = [
  {
    id: uuidv4(),
    category: "CC",
    controlId: "CC1.1",
    name: "Security Policy",
    description: "Organization maintains security policies and procedures",
    trustServiceCriteria: ["CC1.1", "CC1.2"],
    status: "implemented",
    implementationDetails: "Security policies documented in /docs/security-policies/. Annual review process established.",
    evidence: ["security-policy-v2.pdf", "annual-review-2024.pdf"],
    owner: "Security Team",
    reviewFrequency: "annually",
    lastReviewedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "CC",
    controlId: "CC6.1",
    name: "Logical Access Controls",
    description: "Logical access to systems is restricted and authenticated",
    trustServiceCriteria: ["CC6.1", "CC6.2", "CC6.3"],
    status: "implemented",
    implementationDetails: "RBAC implemented via rbac-service.ts. MFA required for admin access. Session timeout configured.",
    evidence: ["access-control-matrix.xlsx", "mfa-implementation.md"],
    owner: "Engineering",
    reviewFrequency: "monthly",
    lastReviewedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "CC",
    controlId: "CC6.6",
    name: "Encryption",
    description: "Data is protected during transmission and at rest",
    trustServiceCriteria: ["CC6.6", "CC6.7"],
    status: "implemented",
    implementationDetails: "TLS 1.2+ for transit. AES-256-GCM for PHI at rest. KMS-managed keys with rotation.",
    evidence: ["encryption-config.md", "key-rotation-logs.json"],
    owner: "Security Team",
    reviewFrequency: "quarterly",
    lastReviewedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "CC",
    controlId: "CC7.2",
    name: "Incident Response",
    description: "Security incidents are identified, reported, and responded to",
    trustServiceCriteria: ["CC7.2", "CC7.3", "CC7.4"],
    status: "implemented",
    implementationDetails: "Incident response plan documented. On-call rotation. Automated alerting via monitoring.",
    evidence: ["incident-response-plan.pdf", "on-call-schedule.xlsx"],
    owner: "Security Team",
    reviewFrequency: "quarterly",
    lastReviewedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "medium",
  },
  {
    id: uuidv4(),
    category: "CC",
    controlId: "CC8.1",
    name: "Change Management",
    description: "Changes to systems are authorized, tested, and documented",
    trustServiceCriteria: ["CC8.1"],
    status: "implemented",
    implementationDetails: "All changes require PR approval. CI/CD pipeline with automated tests. Rollback procedures documented.",
    evidence: ["change-management-policy.pdf", "pr-approval-logs.json"],
    owner: "Engineering",
    reviewFrequency: "weekly",
    lastReviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "A",
    controlId: "A1.1",
    name: "System Availability",
    description: "System availability is maintained per service level objectives",
    trustServiceCriteria: ["A1.1", "A1.2"],
    status: "implemented",
    implementationDetails: "99.9% uptime SLA. Auto-scaling enabled. Multi-region deployment. Health checks.",
    evidence: ["uptime-reports/", "scaling-config.yml"],
    owner: "SRE",
    reviewFrequency: "daily",
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "C",
    controlId: "C1.1",
    name: "Data Classification",
    description: "Data is classified and handled according to sensitivity",
    trustServiceCriteria: ["C1.1", "C1.2"],
    status: "implemented",
    implementationDetails: "PHI identified and encrypted. Data classification labels in schemas. Access based on classification.",
    evidence: ["data-classification-matrix.xlsx", "phi-fields-config.ts"],
    owner: "Security Team",
    reviewFrequency: "quarterly",
    lastReviewedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "medium",
  },
  {
    id: uuidv4(),
    category: "PI",
    controlId: "PI1.1",
    name: "Data Processing Integrity",
    description: "System processing is complete, accurate, and timely",
    trustServiceCriteria: ["PI1.1", "PI1.2"],
    status: "implemented",
    implementationDetails: "Input validation. Database constraints. Audit trails for data changes. Reconciliation checks.",
    evidence: ["validation-schemas/", "audit-trail-config.ts"],
    owner: "Engineering",
    reviewFrequency: "monthly",
    lastReviewedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
  {
    id: uuidv4(),
    category: "P",
    controlId: "P1.1",
    name: "Privacy Notice",
    description: "Privacy notice is provided to data subjects",
    trustServiceCriteria: ["P1.1"],
    status: "implemented",
    implementationDetails: "Privacy policy published. Consent collection at registration. HIPAA Notice of Privacy Practices.",
    evidence: ["privacy-policy.html", "consent-flows/"],
    owner: "Legal",
    reviewFrequency: "annually",
    lastReviewedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewAt: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
  },
];

const accessReviews: AccessReview[] = [];
const changeRecords: ChangeManagementRecord[] = [];
const incidents: IncidentRecord[] = [];
const vendorAssessments: VendorRiskAssessment[] = [
  {
    id: uuidv4(),
    vendorName: "Google Cloud Platform",
    serviceDescription: "Cloud infrastructure and hosting",
    dataShared: ["PHI", "PII", "Application data"],
    phiHandled: true,
    baaStatus: "signed",
    soc2Certified: true,
    lastAssessmentDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentDate: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
    mitigations: ["BAA signed", "SOC 2 Type II certified", "HIPAA compliant infrastructure"],
  },
  {
    id: uuidv4(),
    vendorName: "OpenAI",
    serviceDescription: "AI/ML processing for medical summaries",
    dataShared: ["Anonymized health data"],
    phiHandled: false,
    baaStatus: "not_required",
    soc2Certified: true,
    lastAssessmentDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentDate: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "medium",
    mitigations: ["PHI de-identified before processing", "Zero data retention policy", "API usage audit logging"],
  },
];

export function getSOC2Controls(): SOC2Control[] {
  return soc2Controls;
}

export function getSOC2ControlById(controlId: string): SOC2Control | undefined {
  return soc2Controls.find(c => c.controlId === controlId);
}

export function getControlsDueForReview(): SOC2Control[] {
  const now = new Date();
  return soc2Controls.filter(c => new Date(c.nextReviewAt) <= now);
}

export function recordAccessReview(review: Omit<AccessReview, "id">): AccessReview {
  const newReview: AccessReview = {
    id: uuidv4(),
    ...review,
  };
  accessReviews.push(newReview);
  console.log(`[SOC2] Access review recorded: ${newReview.usersReviewed} users reviewed`);
  return newReview;
}

export function getAccessReviews(): AccessReview[] {
  return accessReviews.sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
}

export function recordChange(change: Omit<ChangeManagementRecord, "id" | "status" | "requestedAt">): ChangeManagementRecord {
  const record: ChangeManagementRecord = {
    id: uuidv4(),
    ...change,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  changeRecords.push(record);
  console.log(`[SOC2] Change request recorded: ${record.description}`);
  return record;
}

export function approveChange(changeId: string, approvedBy: string): ChangeManagementRecord | null {
  const record = changeRecords.find(c => c.id === changeId);
  if (!record) return null;

  record.approvedBy.push(approvedBy);
  if (record.approvedBy.length >= 2) {
    record.status = "approved";
    record.approvedAt = new Date().toISOString();
  }
  return record;
}

export function getChangeRecords(): ChangeManagementRecord[] {
  return changeRecords.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
}

export function recordIncident(incident: Omit<IncidentRecord, "id">): IncidentRecord {
  const record: IncidentRecord = {
    id: uuidv4(),
    ...incident,
  };
  incidents.push(record);
  console.log(`[SOC2] Incident recorded: [${record.severity}] ${record.title}`);
  return record;
}

export function getIncidents(): IncidentRecord[] {
  return incidents.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}

export function getVendorAssessments(): VendorRiskAssessment[] {
  return vendorAssessments;
}

export function addVendorAssessment(assessment: Omit<VendorRiskAssessment, "id">): VendorRiskAssessment {
  const record: VendorRiskAssessment = {
    id: uuidv4(),
    ...assessment,
  };
  vendorAssessments.push(record);
  return record;
}

export function getComplianceDashboard(): {
  controlsStatus: {
    total: number;
    implemented: number;
    partial: number;
    planned: number;
    dueForReview: number;
  };
  accessReviews: {
    total: number;
    lastReviewDate: string | null;
    nextDue: string;
  };
  incidents: {
    total: number;
    open: number;
    bySeverity: Record<string, number>;
  };
  vendors: {
    total: number;
    withBAA: number;
    highRisk: number;
  };
  overallScore: number;
} {
  const dueForReview = getControlsDueForReview().length;

  const controlsStatus = {
    total: soc2Controls.length,
    implemented: soc2Controls.filter(c => c.status === "implemented").length,
    partial: soc2Controls.filter(c => c.status === "partial").length,
    planned: soc2Controls.filter(c => c.status === "planned").length,
    dueForReview,
  };

  const lastReview = accessReviews[0];
  const nextReviewDate = new Date();
  nextReviewDate.setMonth(nextReviewDate.getMonth() + 1);

  const accessReviewStatus = {
    total: accessReviews.length,
    lastReviewDate: lastReview?.reviewDate || null,
    nextDue: lastReview?.nextReviewDate || nextReviewDate.toISOString(),
  };

  const openIncidents = incidents.filter(i => !i.resolvedAt);
  const bySeverity: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  openIncidents.forEach(i => bySeverity[i.severity]++);

  const incidentStatus = {
    total: incidents.length,
    open: openIncidents.length,
    bySeverity,
  };

  const vendorStatus = {
    total: vendorAssessments.length,
    withBAA: vendorAssessments.filter(v => v.baaStatus === "signed").length,
    highRisk: vendorAssessments.filter(v => v.riskLevel === "high" || v.riskLevel === "critical").length,
  };

  const implementedPercentage = (controlsStatus.implemented / controlsStatus.total) * 100;
  const overallScore = Math.round(implementedPercentage - (dueForReview * 2) - (openIncidents.length * 5));

  return {
    controlsStatus,
    accessReviews: accessReviewStatus,
    incidents: incidentStatus,
    vendors: vendorStatus,
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };
}

export function generateComplianceReport(): {
  generatedAt: string;
  period: { start: string; end: string };
  summary: ReturnType<typeof getComplianceDashboard>;
  controls: SOC2Control[];
  recentAccessReviews: AccessReview[];
  recentChanges: ChangeManagementRecord[];
  recentIncidents: IncidentRecord[];
  vendorRisk: VendorRiskAssessment[];
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  return {
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: getComplianceDashboard(),
    controls: soc2Controls,
    recentAccessReviews: accessReviews.slice(0, 10),
    recentChanges: changeRecords.slice(0, 20),
    recentIncidents: incidents.slice(0, 10),
    vendorRisk: vendorAssessments,
  };
}
