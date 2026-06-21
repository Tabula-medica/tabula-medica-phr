import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import { DataPolicy, DataPolicyType, DataPolicyRule } from "@shared/schema";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_POLICY_DRAFTING_PROMPT = `You are a healthcare data governance policy expert specializing in drafting compliant policies.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Drafting data governance policies for healthcare organizations
- Suggesting policy rules based on regulatory requirements (HIPAA, GDPR, SOC2, HITECH)
- Recommending access control, retention, encryption, and audit policies
- Providing best practices for data handling and compliance
- Creating policy templates aligned with industry standards

All suggestions must focus on DATA GOVERNANCE, SECURITY, and REGULATORY COMPLIANCE - never clinical interpretation.`;

export type RegulatoryFramework = "HIPAA" | "GDPR" | "SOC2" | "HITECH" | "CCPA" | "NIST" | "PCI_DSS" | "FDA";
export type PolicyCategory = "access_control" | "retention" | "encryption" | "audit" | "consent" | "breach_response" | "data_classification" | "vendor_management";

export interface PolicyTemplate {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;
  regulatoryBasis: RegulatoryFramework[];
  sections: PolicyTemplateSection[];
  bestPractices: string[];
  requiredElements: string[];
  suggestedRules: SuggestedRule[];
  industryStandard: boolean;
}

export interface PolicyTemplateSection {
  id: string;
  title: string;
  description: string;
  suggestedContent: string;
  isRequired: boolean;
  regulatoryReferences: string[];
}

export type PolicyRuleAction = "allow" | "deny" | "require_approval" | "log" | "encrypt" | "anonymize";

export interface SuggestedRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: PolicyRuleAction;
  severity: "critical" | "high" | "medium" | "low";
  regulatoryBasis: RegulatoryFramework[];
  bestPractice: boolean;
}

export interface PolicyDraft {
  id: string;
  title: string;
  description: string;
  category: PolicyCategory;
  status: "draft" | "review" | "approved" | "active";
  version: string;
  regulatoryFrameworks: RegulatoryFramework[];
  sections: PolicyDraftSection[];
  rules: DataPolicyRule[];
  effectiveDate?: string;
  reviewDate?: string;
  owner?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  aiAssisted: boolean;
  aiSuggestions: AISuggestion[];
}

export interface PolicyDraftSection {
  id: string;
  title: string;
  content: string;
  order: number;
  aiGenerated: boolean;
}

export interface AISuggestion {
  id: string;
  type: "text" | "rule" | "section" | "best_practice";
  content: string;
  rationale: string;
  regulatoryReference?: string;
  confidence: number;
  accepted: boolean;
  rejected: boolean;
}

export interface PolicyAnalysisRequest {
  existingPolicies: DataPolicy[];
  targetCategory: PolicyCategory;
  targetFrameworks: RegulatoryFramework[];
  organizationContext?: string;
}

export interface PolicySuggestionResponse {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedSections: PolicyDraftSection[];
  suggestedRules: DataPolicyRule[];
  bestPractices: string[];
  complianceNotes: string[];
  gaps: string[];
  aiConfidence: number;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${hashIdentifier(match)}]`
    );
}

function logHipaaAudit(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else {
      sanitized[key] = value;
    }
  }
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "PolicyDraftingService",
    details: sanitized
  })}`);
}

const templateStore = new Map<string, PolicyTemplate>();
const draftStore = new Map<string, PolicyDraft>();

class AIPolicyDraftingService {
  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const templates: PolicyTemplate[] = [
      {
        id: "template-access-control",
        name: "Data Access Control Policy",
        category: "access_control",
        description: "Comprehensive policy governing access to protected health information and sensitive data",
        regulatoryBasis: ["HIPAA", "SOC2", "GDPR"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define the policy's purpose and applicable systems/data",
            suggestedContent: "This policy establishes requirements for controlling access to electronic protected health information (ePHI) and other sensitive data. It applies to all workforce members, business associates, and systems that create, receive, maintain, or transmit protected data.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(a)(1)", "SOC2 CC6.1"]
          },
          {
            id: "sec-2",
            title: "Access Authorization",
            description: "Procedures for granting and managing access rights",
            suggestedContent: "Access to ePHI shall be granted based on the minimum necessary standard and role-based access control (RBAC). All access requests must be documented, approved by appropriate management, and reviewed periodically.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(a)(1)", "HIPAA §164.514(d)"]
          },
          {
            id: "sec-3",
            title: "Authentication Requirements",
            description: "Standards for user authentication and verification",
            suggestedContent: "All users must authenticate using unique identifiers and strong passwords meeting complexity requirements. Multi-factor authentication (MFA) is required for privileged access and remote connections.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(d)", "NIST 800-63"]
          },
          {
            id: "sec-4",
            title: "Access Monitoring and Review",
            description: "Requirements for monitoring and reviewing access",
            suggestedContent: "Access to ePHI shall be logged and monitored. Access reviews shall be conducted quarterly for privileged users and annually for all users. Anomalous access patterns shall trigger alerts for investigation.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(b)", "SOC2 CC6.2"]
          }
        ],
        bestPractices: [
          "Implement principle of least privilege for all access grants",
          "Require MFA for all administrative and remote access",
          "Conduct quarterly access reviews for privileged accounts",
          "Automate access provisioning and deprovisioning workflows",
          "Implement session timeouts for inactive sessions",
          "Log all access attempts including failures"
        ],
        requiredElements: [
          "Role-based access control matrix",
          "Access request and approval workflow",
          "Authentication standards",
          "Access review schedule",
          "Termination procedures"
        ],
        suggestedRules: [
          {
            id: "rule-ac-1",
            name: "Minimum Necessary Access",
            description: "Limit access to the minimum necessary for job functions",
            condition: "access_level > role_required_level",
            action: "deny" as const,
            severity: "high",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          },
          {
            id: "rule-ac-2",
            name: "MFA Required for PHI",
            description: "Require multi-factor authentication for PHI access",
            condition: "resource_type == 'PHI' && !mfa_verified",
            action: "require_approval" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA", "SOC2"] as RegulatoryFramework[],
            bestPractice: true
          },
          {
            id: "rule-ac-3",
            name: "Session Timeout",
            description: "Terminate inactive sessions after 15 minutes",
            condition: "session_idle_time > 15_minutes",
            action: "log" as const,
            severity: "medium",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      },
      {
        id: "template-retention",
        name: "Data Retention Policy",
        category: "retention",
        description: "Policy governing the retention, archival, and disposal of health records and business data",
        regulatoryBasis: ["HIPAA", "GDPR", "HITECH"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define retention policy objectives and covered data",
            suggestedContent: "This policy establishes requirements for the retention, archival, and secure disposal of protected health information and business records. It ensures compliance with regulatory requirements while supporting operational and legal needs.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.530(j)", "GDPR Article 5(1)(e)"]
          },
          {
            id: "sec-2",
            title: "Retention Periods",
            description: "Define retention periods by data type and regulation",
            suggestedContent: "Medical records shall be retained for a minimum of 6 years from date of creation or last effective date. HIPAA-related documentation shall be retained for 6 years. State laws may require longer retention periods.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.530(j)", "State medical record laws"]
          },
          {
            id: "sec-3",
            title: "Secure Disposal",
            description: "Requirements for secure data destruction",
            suggestedContent: "PHI shall be disposed of using NIST-approved methods. Electronic media shall be sanitized using cryptographic erasure, degaussing, or physical destruction. Paper records shall be cross-cut shredded.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.310(d)(2)", "NIST SP 800-88"]
          }
        ],
        bestPractices: [
          "Maintain a data retention schedule by category",
          "Implement automated retention policy enforcement",
          "Document all data disposal activities",
          "Conduct periodic retention compliance audits",
          "Consider legal holds before any disposal"
        ],
        requiredElements: [
          "Retention schedule by data type",
          "Disposal procedures",
          "Legal hold process",
          "Verification and documentation"
        ],
        suggestedRules: [
          {
            id: "rule-ret-1",
            name: "Minimum Retention Period",
            description: "Prevent deletion of records before minimum retention period",
            condition: "record_age < minimum_retention_period",
            action: "deny" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          },
          {
            id: "rule-ret-2",
            name: "Disposal Verification",
            description: "Require verification certificate for all PHI disposal",
            condition: "disposal_type == 'PHI' && !disposal_certificate",
            action: "require_approval" as const,
            severity: "high",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      },
      {
        id: "template-encryption",
        name: "Data Encryption Policy",
        category: "encryption",
        description: "Standards for encrypting protected health information at rest and in transit",
        regulatoryBasis: ["HIPAA", "SOC2", "PCI_DSS"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define encryption requirements and covered systems",
            suggestedContent: "This policy establishes encryption requirements for protecting electronic protected health information (ePHI) at rest and in transit. All systems storing or transmitting ePHI must implement approved encryption methods.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(a)(2)(iv)", "HIPAA §164.312(e)(2)(ii)"]
          },
          {
            id: "sec-2",
            title: "Encryption Standards",
            description: "Approved encryption algorithms and key lengths",
            suggestedContent: "Data at rest shall use AES-256 encryption or equivalent. Data in transit shall use TLS 1.2 or higher. Key lengths shall meet NIST recommendations for the algorithm used.",
            isRequired: true,
            regulatoryReferences: ["NIST SP 800-175B", "FIPS 140-2"]
          },
          {
            id: "sec-3",
            title: "Key Management",
            description: "Procedures for cryptographic key lifecycle management",
            suggestedContent: "Encryption keys shall be generated using approved random number generators. Keys shall be stored in hardware security modules (HSM) or equivalent protection. Key rotation shall occur annually or upon suspected compromise.",
            isRequired: true,
            regulatoryReferences: ["NIST SP 800-57"]
          }
        ],
        bestPractices: [
          "Use hardware security modules for key storage",
          "Implement automated key rotation",
          "Encrypt all backup media",
          "Use perfect forward secrecy for TLS connections",
          "Maintain key recovery procedures"
        ],
        requiredElements: [
          "Approved encryption algorithms",
          "Key management procedures",
          "Key rotation schedule",
          "Emergency key recovery process"
        ],
        suggestedRules: [
          {
            id: "rule-enc-1",
            name: "TLS Required",
            description: "Require TLS 1.2+ for all PHI transmission",
            condition: "data_type == 'PHI' && tls_version < '1.2'",
            action: "deny" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA", "PCI_DSS"] as RegulatoryFramework[],
            bestPractice: true
          },
          {
            id: "rule-enc-2",
            name: "Encryption at Rest",
            description: "Block storage of unencrypted PHI",
            condition: "storage_type == 'PHI' && !encrypted",
            action: "encrypt" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      },
      {
        id: "template-audit",
        name: "Audit Logging Policy",
        category: "audit",
        description: "Requirements for logging, monitoring, and reviewing system and data access activities",
        regulatoryBasis: ["HIPAA", "SOC2", "GDPR"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define audit logging objectives and covered systems",
            suggestedContent: "This policy establishes requirements for audit logging to support security monitoring, incident investigation, and regulatory compliance. All systems processing ePHI must maintain comprehensive audit trails.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(b)", "SOC2 CC7.2"]
          },
          {
            id: "sec-2",
            title: "Logging Requirements",
            description: "Specify what events must be logged",
            suggestedContent: "The following events shall be logged: user authentication (success/failure), PHI access (view/create/modify/delete), administrative actions, security events, and system errors. Logs shall capture user ID, timestamp, action, resource, and outcome.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(b)"]
          },
          {
            id: "sec-3",
            title: "Log Protection and Retention",
            description: "Requirements for securing and retaining audit logs",
            suggestedContent: "Audit logs shall be protected from unauthorized modification or deletion. Logs shall be retained for a minimum of 6 years. Log integrity shall be verified using cryptographic hashing.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.312(b)", "HIPAA §164.530(j)"]
          }
        ],
        bestPractices: [
          "Centralize logs in a SIEM system",
          "Implement real-time alerting for security events",
          "Conduct regular log reviews",
          "Test log completeness periodically",
          "Protect logs with write-once storage"
        ],
        requiredElements: [
          "Event types to be logged",
          "Log content requirements",
          "Retention periods",
          "Review procedures",
          "Alert thresholds"
        ],
        suggestedRules: [
          {
            id: "rule-aud-1",
            name: "PHI Access Logging",
            description: "Log all PHI access with full context",
            condition: "resource_type == 'PHI' && access_type != 'logged'",
            action: "log" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA"] as RegulatoryFramework[],
            bestPractice: true
          },
          {
            id: "rule-aud-2",
            name: "Failed Authentication Alert",
            description: "Alert on multiple failed authentication attempts",
            condition: "failed_auth_count > 5 && timeframe < 15_minutes",
            action: "log" as const,
            severity: "high",
            regulatoryBasis: ["SOC2"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      },
      {
        id: "template-consent",
        name: "Consent Management Policy",
        category: "consent",
        description: "Policy for managing patient consent for data use and disclosure",
        regulatoryBasis: ["HIPAA", "GDPR", "CCPA"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define consent requirements and applicable data processing",
            suggestedContent: "This policy establishes requirements for obtaining, documenting, and enforcing patient consent for the use and disclosure of protected health information. It ensures compliance with HIPAA authorization requirements and GDPR consent principles.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.508", "GDPR Article 7"]
          },
          {
            id: "sec-2",
            title: "Consent Requirements",
            description: "Standards for valid consent",
            suggestedContent: "Consent must be freely given, specific, informed, and unambiguous. HIPAA authorizations must include core elements: description of PHI, persons authorized to make disclosure, purpose, expiration, and right to revoke.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.508(c)", "GDPR Article 7"]
          },
          {
            id: "sec-3",
            title: "Consent Withdrawal",
            description: "Procedures for processing consent withdrawal",
            suggestedContent: "Patients may revoke consent at any time. Revocation must be processed within 30 days. Data processing based on revoked consent must cease, except where required by law or for treatment purposes already in progress.",
            isRequired: true,
            regulatoryReferences: ["GDPR Article 7(3)", "HIPAA §164.508(b)(5)"]
          }
        ],
        bestPractices: [
          "Version and timestamp all consent documents",
          "Provide clear withdrawal mechanisms",
          "Implement consent enforcement in systems",
          "Conduct regular consent audits",
          "Maintain consent preference center for patients"
        ],
        requiredElements: [
          "Consent collection procedures",
          "Valid consent criteria",
          "Withdrawal process",
          "Enforcement mechanisms",
          "Record retention"
        ],
        suggestedRules: [
          {
            id: "rule-con-1",
            name: "Consent Verification",
            description: "Verify consent before non-TPO data use",
            condition: "use_purpose != 'treatment' && !valid_consent",
            action: "deny" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA", "GDPR"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      },
      {
        id: "template-breach",
        name: "Breach Response Policy",
        category: "breach_response",
        description: "Policy for detecting, responding to, and reporting data breaches",
        regulatoryBasis: ["HIPAA", "GDPR", "HITECH"],
        sections: [
          {
            id: "sec-1",
            title: "Purpose and Scope",
            description: "Define breach response objectives and incident types",
            suggestedContent: "This policy establishes procedures for identifying, containing, investigating, and reporting breaches of protected health information. It ensures timely response and compliance with HIPAA Breach Notification Rule and GDPR breach notification requirements.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.400-414", "GDPR Article 33"]
          },
          {
            id: "sec-2",
            title: "Breach Assessment",
            description: "Criteria for determining if a breach occurred",
            suggestedContent: "A breach is presumed when unsecured PHI is accessed, acquired, used, or disclosed impermissibly. Risk assessment shall evaluate: nature of PHI, unauthorized recipient, actual access, and mitigation effectiveness.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.402"]
          },
          {
            id: "sec-3",
            title: "Notification Requirements",
            description: "Procedures for breach notification",
            suggestedContent: "Individual notification shall occur within 60 days of discovery. HHS notification shall occur within 60 days for breaches affecting 500+ individuals. GDPR requires notification within 72 hours of awareness.",
            isRequired: true,
            regulatoryReferences: ["HIPAA §164.404", "GDPR Article 33"]
          }
        ],
        bestPractices: [
          "Maintain incident response team with defined roles",
          "Conduct regular breach response drills",
          "Pre-draft notification templates",
          "Establish media communication procedures",
          "Document all response activities"
        ],
        requiredElements: [
          "Incident classification criteria",
          "Response team contacts",
          "Assessment procedures",
          "Notification timelines",
          "Documentation requirements"
        ],
        suggestedRules: [
          {
            id: "rule-br-1",
            name: "Immediate Escalation",
            description: "Escalate suspected breaches immediately",
            condition: "incident_type == 'suspected_breach'",
            action: "require_approval" as const,
            severity: "critical",
            regulatoryBasis: ["HIPAA", "GDPR"] as RegulatoryFramework[],
            bestPractice: true
          }
        ],
        industryStandard: true
      }
    ];

    templates.forEach(t => templateStore.set(t.id, t));
  }

  listTemplates(category?: PolicyCategory): PolicyTemplate[] {
    let templates = Array.from(templateStore.values());
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    return templates;
  }

  getTemplate(templateId: string): PolicyTemplate | undefined {
    return templateStore.get(templateId);
  }

  async generatePolicySuggestions(
    request: PolicyAnalysisRequest,
    userId: string
  ): Promise<PolicySuggestionResponse> {
    logHipaaAudit("GENERATE_POLICY_SUGGESTIONS", "policy_draft", userId, {
      category: request.targetCategory,
      frameworks: request.targetFrameworks
    });

    const template = Array.from(templateStore.values()).find(
      t => t.category === request.targetCategory
    );

    const existingPoliciesContext = request.existingPolicies
      .filter(p => p.policyType === request.targetCategory || 
                  request.targetFrameworks.some(f => p.regulation.includes(f)))
      .map(p => ({
        name: p.name,
        description: p.description,
        rules: p.rules.map(r => r.name)
      }));

    let aiSuggestions = {
      title: "",
      description: "",
      sections: [] as string[],
      rules: [] as string[],
      bestPractices: [] as string[],
      complianceNotes: [] as string[],
      gaps: [] as string[]
    };

    if (process.env.OPENAI_API_KEY && openai) {
      try {
        const context = sanitizePhi(JSON.stringify({
          targetCategory: request.targetCategory,
          targetFrameworks: request.targetFrameworks,
          existingPoliciesCount: existingPoliciesContext.length,
          existingPolicies: existingPoliciesContext.slice(0, 5),
          organizationContext: request.organizationContext || "Healthcare organization",
          templateAvailable: !!template
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_POLICY_DRAFTING_PROMPT },
            {
              role: "user",
              content: `Generate policy drafting suggestions for a ${request.targetCategory} policy covering ${request.targetFrameworks.join(", ")} regulations.

Context: ${context}

Provide JSON with:
- title: Suggested policy title
- description: Brief policy description
- sections: Array of 3-4 key section titles
- rules: Array of 3-5 suggested rule descriptions
- bestPractices: Array of 3-5 best practices
- complianceNotes: Array of 2-3 compliance considerations
- gaps: Array of potential gaps to address based on existing policies`
            }
          ],
          max_tokens: 800,
          temperature: 0.5
        });

        const content = response.choices[0]?.message?.content || "";
        try {
          aiSuggestions = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
        } catch {
          console.error("[PolicyDrafting] Failed to parse AI response");
        }
      } catch (error) {
        console.error("[PolicyDrafting] AI generation error:", error);
      }
    }

    const suggestedTitle = aiSuggestions.title || template?.name || `${request.targetCategory.replace("_", " ")} Policy`;
    const suggestedDescription = aiSuggestions.description || template?.description || 
      `Policy governing ${request.targetCategory.replace("_", " ")} for ${request.targetFrameworks.join(", ")} compliance`;

    const suggestedSections: PolicyDraftSection[] = template?.sections.map((s, i) => ({
      id: randomUUID().slice(0, 8),
      title: s.title,
      content: s.suggestedContent,
      order: i + 1,
      aiGenerated: false
    })) || aiSuggestions.sections?.map((title, i) => ({
      id: randomUUID().slice(0, 8),
      title,
      content: "",
      order: i + 1,
      aiGenerated: true
    })) || [];

    const suggestedRules: DataPolicyRule[] = template?.suggestedRules.map((r, i) => ({
      id: randomUUID().slice(0, 8),
      name: r.name,
      description: r.description,
      condition: r.condition,
      action: r.action,
      priority: i + 1,
      isEnabled: true,
      exceptions: []
    })) || [];

    const bestPractices = aiSuggestions.bestPractices?.length > 0 
      ? aiSuggestions.bestPractices 
      : template?.bestPractices || [
          "Follow regulatory requirements for your jurisdiction",
          "Review and update policies annually",
          "Train staff on policy requirements",
          "Monitor compliance regularly"
        ];

    const complianceNotes = aiSuggestions.complianceNotes?.length > 0
      ? aiSuggestions.complianceNotes
      : request.targetFrameworks.map(f => `Ensure alignment with ${f} requirements`);

    const gaps = aiSuggestions.gaps?.length > 0
      ? aiSuggestions.gaps
      : existingPoliciesContext.length === 0 
        ? [`No existing ${request.targetCategory} policies found - consider creating foundational policy`]
        : [];

    return {
      suggestedTitle,
      suggestedDescription,
      suggestedSections,
      suggestedRules,
      bestPractices,
      complianceNotes,
      gaps,
      aiConfidence: aiSuggestions.title ? 0.85 : 0.7
    };
  }

  async generateRuleSuggestion(
    category: PolicyCategory,
    description: string,
    userId: string
  ): Promise<{ rule: DataPolicyRule; rationale: string; aiConfidence: number }> {
    logHipaaAudit("GENERATE_RULE_SUGGESTION", "policy_rule", userId, { category, description });

    let aiRule = {
      name: "",
      condition: "",
      action: "",
      rationale: ""
    };

    if (process.env.OPENAI_API_KEY && openai) {
      try {
        const sanitizedDescription = sanitizePhi(description);
        const context = sanitizePhi(JSON.stringify({ category, description: sanitizedDescription }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_POLICY_DRAFTING_PROMPT },
            {
              role: "user",
              content: `Generate a policy rule for ${category} policy based on this requirement: "${sanitizedDescription}"

Provide JSON with:
- name: Short rule name
- condition: Condition expression (e.g., "access_type == 'PHI' && !mfa_verified")
- action: Action to take (e.g., "deny_access", "require_approval", "log_alert")
- rationale: Why this rule is recommended`
            }
          ],
          max_tokens: 300,
          temperature: 0.5
        });

        const content = response.choices[0]?.message?.content || "";
        try {
          aiRule = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
        } catch {
          console.error("[PolicyDrafting] Failed to parse AI rule response");
        }
      } catch (error) {
        console.error("[PolicyDrafting] AI rule generation error:", error);
      }
    }

    const validActions = ["allow", "deny", "require_approval", "log", "encrypt", "anonymize"] as const;
    const actionValue = validActions.includes(aiRule.action as any) ? aiRule.action as typeof validActions[number] : "log";
    
    const rule: DataPolicyRule = {
      id: randomUUID().slice(0, 8),
      name: aiRule.name || `${category} Rule`,
      description,
      condition: aiRule.condition || "condition_to_define",
      action: actionValue,
      priority: 1,
      isEnabled: true,
      exceptions: []
    };

    return {
      rule,
      rationale: aiRule.rationale || "Rule generated based on best practices",
      aiConfidence: aiRule.name ? 0.8 : 0.5
    };
  }

  async generateSectionContent(
    sectionTitle: string,
    policyCategory: PolicyCategory,
    frameworks: RegulatoryFramework[],
    userId: string
  ): Promise<{ content: string; references: string[]; aiConfidence: number }> {
    logHipaaAudit("GENERATE_SECTION_CONTENT", "policy_section", userId, {
      sectionTitle,
      policyCategory,
      frameworks
    });

    let aiContent = { content: "", references: [] as string[] };

    if (process.env.OPENAI_API_KEY && openai) {
      try {
        const sanitizedTitle = sanitizePhi(sectionTitle);
        const context = sanitizePhi(JSON.stringify({
          sectionTitle: sanitizedTitle,
          policyCategory,
          frameworks
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_POLICY_DRAFTING_PROMPT },
            {
              role: "user",
              content: `Generate policy section content for "${sanitizedTitle}" in a ${policyCategory} policy covering ${frameworks.join(", ")}.

Provide JSON with:
- content: 2-3 paragraphs of professional policy language
- references: Array of regulatory references (e.g., "HIPAA §164.312(a)(1)")`
            }
          ],
          max_tokens: 500,
          temperature: 0.5
        });

        const responseContent = response.choices[0]?.message?.content || "";
        try {
          aiContent = JSON.parse(responseContent.replace(/```json\n?|\n?```/g, ""));
        } catch {
          aiContent.content = responseContent.slice(0, 500);
        }
      } catch (error) {
        console.error("[PolicyDrafting] AI section generation error:", error);
      }
    }

    const template = Array.from(templateStore.values()).find(t => t.category === policyCategory);
    const templateSection = template?.sections.find(s => 
      s.title.toLowerCase().includes(sectionTitle.toLowerCase()) ||
      sectionTitle.toLowerCase().includes(s.title.toLowerCase())
    );

    return {
      content: aiContent.content || templateSection?.suggestedContent || 
        `This section establishes requirements for ${sectionTitle.toLowerCase()} in accordance with ${frameworks.join(", ")} regulations.`,
      references: aiContent.references?.length > 0 
        ? aiContent.references 
        : templateSection?.regulatoryReferences || [],
      aiConfidence: aiContent.content ? 0.8 : 0.6
    };
  }

  createDraft(
    templateId: string | null,
    category: PolicyCategory,
    frameworks: RegulatoryFramework[],
    userId: string
  ): PolicyDraft {
    logHipaaAudit("CREATE_POLICY_DRAFT", "policy_draft", userId, {
      templateId,
      category,
      frameworks
    });

    const template = templateId ? templateStore.get(templateId) : null;

    const draft: PolicyDraft = {
      id: `draft-${randomUUID()}`,
      title: template?.name || `New ${category.replace("_", " ")} Policy`,
      description: template?.description || "",
      category,
      status: "draft",
      version: "1.0",
      regulatoryFrameworks: frameworks,
      sections: template?.sections.map((s, i) => ({
        id: randomUUID().slice(0, 8),
        title: s.title,
        content: s.suggestedContent,
        order: i + 1,
        aiGenerated: false
      })) || [],
      rules: template?.suggestedRules.map((r, i) => ({
        id: randomUUID().slice(0, 8),
        name: r.name,
        description: r.description,
        condition: r.condition,
        action: r.action,
        priority: i + 1,
        isEnabled: true,
        exceptions: []
      })) || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      aiAssisted: false,
      aiSuggestions: []
    };

    draftStore.set(draft.id, draft);
    return draft;
  }

  getDraft(draftId: string): PolicyDraft | undefined {
    return draftStore.get(draftId);
  }

  listDrafts(filters?: { status?: string; category?: PolicyCategory }): PolicyDraft[] {
    let drafts = Array.from(draftStore.values());
    if (filters?.status) {
      drafts = drafts.filter(d => d.status === filters.status);
    }
    if (filters?.category) {
      drafts = drafts.filter(d => d.category === filters.category);
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  updateDraft(draftId: string, updates: Partial<PolicyDraft>, userId: string): PolicyDraft | null {
    const draft = draftStore.get(draftId);
    if (!draft) return null;

    logHipaaAudit("UPDATE_POLICY_DRAFT", "policy_draft", userId, {
      draftId,
      updatedFields: Object.keys(updates)
    });

    const updated: PolicyDraft = {
      ...draft,
      ...updates,
      id: draft.id,
      createdAt: draft.createdAt,
      createdBy: draft.createdBy,
      updatedAt: new Date().toISOString()
    };

    draftStore.set(draftId, updated);
    return updated;
  }

  deleteDraft(draftId: string, userId: string): boolean {
    logHipaaAudit("DELETE_POLICY_DRAFT", "policy_draft", userId, { draftId });
    return draftStore.delete(draftId);
  }

  getBestPractices(category: PolicyCategory, framework: RegulatoryFramework): string[] {
    const template = Array.from(templateStore.values()).find(
      t => t.category === category && t.regulatoryBasis.includes(framework)
    );
    return template?.bestPractices || [
      "Document all policy decisions and rationale",
      "Train staff on policy requirements",
      "Review and update policies annually",
      "Monitor compliance regularly",
      "Maintain audit trails for all changes"
    ];
  }
}

export const aiPolicyDraftingService = new AIPolicyDraftingService();
