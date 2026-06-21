import OpenAI from "openai";

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b\d{9}\b/g, "[SSN-REDACTED]")
    .replace(/\b[A-Z]{1,2}\d{6,10}\b/gi, "[MRN-REDACTED]")
    .replace(/\b(patient|pt)\s*#?\s*\d+/gi, "[PATIENT-ID-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE-REDACTED]");
}

const NO_CDS_THREAT_PROMPT = `You are a healthcare cybersecurity and compliance threat intelligence analyst.
Your role is to analyze security threats, regulatory changes, and attack patterns relevant to healthcare organizations.

STRICT GUIDELINES:
- NEVER provide clinical advice, diagnoses, or treatment recommendations
- NEVER interpret medical test results or patient health conditions
- Focus ONLY on cybersecurity threats, compliance risks, and regulatory updates
- Analyze attack vectors targeting healthcare data and systems
- Provide risk assessments for data security and privacy compliance
- Recommend security controls and remediation priorities

Your output should be:
- Threat intelligence analysis and risk scoring
- Regulatory compliance impact assessments
- Security recommendations for data protection
- Prioritized remediation actions for compliance gaps`;

export type ThreatCategory = 
  | "ransomware"
  | "phishing"
  | "insider_threat"
  | "data_breach"
  | "regulatory_violation"
  | "supply_chain"
  | "api_exploit"
  | "credential_compromise"
  | "social_engineering"
  | "malware";

export type RegulatoryFramework = "HIPAA" | "GDPR" | "SOC2" | "HITECH" | "CCPA" | "NIST" | "PCI_DSS" | "FDA";

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "informational";

export interface ThreatIndicator {
  id: string;
  type: "ip" | "domain" | "hash" | "email" | "pattern" | "behavior";
  value: string;
  confidence: number;
  lastSeen: Date;
  source: string;
}

export interface SecurityThreat {
  id: string;
  name: string;
  category: ThreatCategory;
  severity: SeverityLevel;
  description: string;
  indicators: ThreatIndicator[];
  affectedSystems: string[];
  ttps: string[];
  mitigations: string[];
  firstSeen: Date;
  lastUpdated: Date;
  active: boolean;
  healthcareSpecific: boolean;
  regulatoryImpact: RegulatoryFramework[];
  riskScore: number;
}

export interface RegulatoryUpdate {
  id: string;
  framework: RegulatoryFramework;
  title: string;
  summary: string;
  effectiveDate: Date;
  announcedDate: Date;
  impactLevel: SeverityLevel;
  affectedControls: string[];
  requiredActions: string[];
  complianceDeadline?: Date;
  source: string;
  url?: string;
}

export interface AttackVector {
  id: string;
  name: string;
  category: ThreatCategory;
  description: string;
  targetedAssets: string[];
  exploitedVulnerabilities: string[];
  detectionSignatures: string[];
  prevalenceScore: number;
  sophisticationLevel: "low" | "medium" | "high" | "advanced";
  mitreTechniques: string[];
}

export interface ThreatContext {
  threats: SecurityThreat[];
  regulatoryUpdates: RegulatoryUpdate[];
  attackVectors: AttackVector[];
  lastUpdated: Date;
}

export interface AuditLogRiskAssessment {
  logEntryId: string;
  originalRiskScore: number;
  adjustedRiskScore: number;
  threatMatches: Array<{
    threatId: string;
    matchConfidence: number;
    matchedIndicators: string[];
  }>;
  regulatoryRelevance: Array<{
    framework: RegulatoryFramework;
    relevance: number;
    affectedRequirements: string[];
  }>;
  adjustmentReason: string;
  recommendedActions: string[];
  priority: "immediate" | "high" | "medium" | "low";
}

export interface AccessPatternRiskAssessment {
  patternId: string;
  userId: string;
  patternDescription: string;
  originalRiskScore: number;
  adjustedRiskScore: number;
  threatCorrelations: Array<{
    threatId: string;
    correlationType: string;
    confidence: number;
  }>;
  behavioralIndicators: string[];
  recommendedActions: string[];
  priority: "immediate" | "high" | "medium" | "low";
}

export interface RemediationPriorityAdjustment {
  remediationId: string;
  originalPriority: number;
  adjustedPriority: number;
  adjustmentFactors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  relatedThreats: string[];
  relatedRegulations: RegulatoryFramework[];
  urgencyLevel: "critical" | "urgent" | "standard" | "low";
  justification: string;
}

export interface ThreatIntelligenceSummary {
  totalActiveThreats: number;
  criticalThreats: number;
  newThreatsLast24h: number;
  regulatoryUpdatesLast30d: number;
  topAttackVectors: Array<{ name: string; prevalence: number }>;
  riskTrend: "increasing" | "stable" | "decreasing";
  affectedFrameworks: RegulatoryFramework[];
  recommendedFocus: string[];
  lastAnalyzed: Date;
}

export interface ThreatFeedConfiguration {
  enabled: boolean;
  refreshIntervalMinutes: number;
  sources: Array<{
    name: string;
    type: "cisa" | "hhs" | "mitre" | "nist" | "custom";
    enabled: boolean;
    lastSync: Date | null;
  }>;
  filters: {
    minSeverity: SeverityLevel;
    healthcareOnly: boolean;
    frameworks: RegulatoryFramework[];
  };
  autoAdjustRisk: boolean;
  autoAdjustPriority: boolean;
}

class AIThreatIntelligenceService {
  private threats: Map<string, SecurityThreat> = new Map();
  private regulatoryUpdates: Map<string, RegulatoryUpdate> = new Map();
  private attackVectors: Map<string, AttackVector> = new Map();
  private configuration: ThreatFeedConfiguration;
  private lastRefresh: Date = new Date();

  constructor() {
    this.configuration = {
      enabled: true,
      refreshIntervalMinutes: 60,
      sources: [
        { name: "CISA Healthcare Alerts", type: "cisa", enabled: true, lastSync: null },
        { name: "HHS OCR Breach Portal", type: "hhs", enabled: true, lastSync: null },
        { name: "MITRE ATT&CK Healthcare", type: "mitre", enabled: true, lastSync: null },
        { name: "NIST Cybersecurity Framework", type: "nist", enabled: true, lastSync: null }
      ],
      filters: {
        minSeverity: "low",
        healthcareOnly: true,
        frameworks: ["HIPAA", "SOC2", "HITECH"]
      },
      autoAdjustRisk: true,
      autoAdjustPriority: true
    };
    
    this.initializeThreatData();
    console.log("[AIThreatIntelligence] Service initialized");
  }

  private initializeThreatData(): void {
    const baseThreats: SecurityThreat[] = [
      {
        id: "threat-001",
        name: "Healthcare Ransomware Campaign - LockBit 3.0",
        category: "ransomware",
        severity: "critical",
        description: "Active ransomware campaign targeting healthcare organizations using phishing emails with malicious Office documents. Exploits CVE-2023-36884 for initial access.",
        indicators: [
          { id: "ind-001", type: "domain", value: "health-records-portal[.]com", confidence: 95, lastSeen: new Date(), source: "CISA" },
          { id: "ind-002", type: "hash", value: "a1b2c3d4e5f6...", confidence: 98, lastSeen: new Date(), source: "VirusTotal" }
        ],
        affectedSystems: ["EHR Systems", "Email Servers", "File Shares"],
        ttps: ["T1566.001", "T1059.001", "T1486"],
        mitigations: ["Implement email filtering", "Enable MFA", "Regular backups", "Network segmentation"],
        firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        active: true,
        healthcareSpecific: true,
        regulatoryImpact: ["HIPAA", "HITECH"],
        riskScore: 95
      },
      {
        id: "threat-002",
        name: "EHR Credential Harvesting Campaign",
        category: "credential_compromise",
        severity: "high",
        description: "Sophisticated phishing campaign impersonating major EHR vendors to harvest healthcare worker credentials. Uses legitimate-looking login portals.",
        indicators: [
          { id: "ind-003", type: "domain", value: "epic-mycha rt[.]net", confidence: 90, lastSeen: new Date(), source: "PhishTank" },
          { id: "ind-004", type: "email", value: "support@ehr-security-update[.]com", confidence: 85, lastSeen: new Date(), source: "Internal" }
        ],
        affectedSystems: ["EHR Portals", "Identity Providers", "VPN Gateways"],
        ttps: ["T1566.002", "T1078", "T1110"],
        mitigations: ["Security awareness training", "FIDO2 authentication", "Phishing-resistant MFA"],
        firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        active: true,
        healthcareSpecific: true,
        regulatoryImpact: ["HIPAA", "SOC2"],
        riskScore: 82
      },
      {
        id: "threat-003",
        name: "Healthcare API Exploitation",
        category: "api_exploit",
        severity: "high",
        description: "Threat actors exploiting misconfigured FHIR APIs to exfiltrate patient data. Targets improper access controls and missing authentication.",
        indicators: [
          { id: "ind-005", type: "pattern", value: "Bulk FHIR export without auth", confidence: 88, lastSeen: new Date(), source: "Internal" },
          { id: "ind-006", type: "behavior", value: "Rapid sequential patient queries", confidence: 75, lastSeen: new Date(), source: "SIEM" }
        ],
        affectedSystems: ["FHIR Servers", "Patient Portals", "Mobile Apps"],
        ttps: ["T1190", "T1530", "T1213"],
        mitigations: ["API authentication audit", "Rate limiting", "Access logging", "SMART on FHIR implementation"],
        firstSeen: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        active: true,
        healthcareSpecific: true,
        regulatoryImpact: ["HIPAA", "GDPR", "SOC2"],
        riskScore: 78
      },
      {
        id: "threat-004",
        name: "Insider PHI Exfiltration Pattern",
        category: "insider_threat",
        severity: "high",
        description: "Pattern of insider threats involving healthcare workers accessing patient records without authorization, often preceding employment termination.",
        indicators: [
          { id: "ind-007", type: "behavior", value: "After-hours bulk record access", confidence: 70, lastSeen: new Date(), source: "Behavioral Analytics" },
          { id: "ind-008", type: "behavior", value: "Accessing records outside care relationship", confidence: 80, lastSeen: new Date(), source: "EHR Audit" }
        ],
        affectedSystems: ["EHR Systems", "Patient Databases", "Reporting Tools"],
        ttps: ["T1530", "T1567", "T1074"],
        mitigations: ["User behavior analytics", "Access attestation", "DLP controls", "Exit procedures"],
        firstSeen: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        active: true,
        healthcareSpecific: true,
        regulatoryImpact: ["HIPAA", "HITECH"],
        riskScore: 75
      },
      {
        id: "threat-005",
        name: "Medical Device Supply Chain Attack",
        category: "supply_chain",
        severity: "medium",
        description: "Compromised medical device firmware updates from third-party vendors. Affects connected medical devices and IoMT infrastructure.",
        indicators: [
          { id: "ind-009", type: "hash", value: "Unsigned firmware packages", confidence: 65, lastSeen: new Date(), source: "FDA" },
          { id: "ind-010", type: "domain", value: "device-update-cdn[.]com", confidence: 70, lastSeen: new Date(), source: "CISA" }
        ],
        affectedSystems: ["Medical Devices", "IoMT Gateways", "Biomedical Networks"],
        ttps: ["T1195.002", "T1542", "T1200"],
        mitigations: ["Firmware integrity validation", "Network isolation", "Vendor security assessment"],
        firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
        active: true,
        healthcareSpecific: true,
        regulatoryImpact: ["HIPAA", "FDA"],
        riskScore: 68
      }
    ];

    const baseRegulatoryUpdates: RegulatoryUpdate[] = [
      {
        id: "reg-001",
        framework: "HIPAA",
        title: "HIPAA Security Rule Update - Access Control Enhancements",
        summary: "HHS proposes strengthened access control requirements including mandatory MFA for all ePHI access and enhanced audit logging requirements.",
        effectiveDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        announcedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        impactLevel: "high",
        affectedControls: ["Access Control", "Audit Controls", "Authentication"],
        requiredActions: [
          "Implement MFA for all ePHI access points",
          "Enhance audit log retention to 6 years",
          "Deploy privileged access management",
          "Conduct access control gap assessment"
        ],
        complianceDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        source: "HHS Office for Civil Rights"
      },
      {
        id: "reg-002",
        framework: "SOC2",
        title: "SOC 2 Trust Services Criteria 2024 Updates",
        summary: "AICPA updates to Trust Services Criteria with enhanced focus on AI governance, supply chain security, and privacy controls.",
        effectiveDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        announcedDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        impactLevel: "medium",
        affectedControls: ["CC6.1", "CC6.7", "CC7.2", "P3.1"],
        requiredActions: [
          "Document AI system controls",
          "Implement vendor risk assessments",
          "Update privacy notices",
          "Enhance monitoring procedures"
        ],
        source: "AICPA"
      },
      {
        id: "reg-003",
        framework: "HITECH",
        title: "HITECH Breach Notification Rule Clarification",
        summary: "OCR issues guidance clarifying breach notification requirements for ransomware incidents and encrypted data exposure.",
        effectiveDate: new Date(),
        announcedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        impactLevel: "high",
        affectedControls: ["Breach Notification", "Encryption", "Risk Assessment"],
        requiredActions: [
          "Update incident response procedures",
          "Review encryption key management",
          "Revise breach assessment criteria",
          "Train staff on notification requirements"
        ],
        source: "HHS OCR"
      }
    ];

    const baseAttackVectors: AttackVector[] = [
      {
        id: "av-001",
        name: "Healthcare Phishing with EHR Impersonation",
        category: "phishing",
        description: "Phishing campaigns specifically targeting healthcare workers using fake EHR login pages and urgent patient care scenarios.",
        targetedAssets: ["User Credentials", "EHR Access", "Email Accounts"],
        exploitedVulnerabilities: ["Human Factor", "Lack of MFA", "Similar Domains"],
        detectionSignatures: ["Unusual login locations", "Failed MFA attempts", "Credential reuse alerts"],
        prevalenceScore: 92,
        sophisticationLevel: "medium",
        mitreTechniques: ["T1566.001", "T1566.002", "T1078"]
      },
      {
        id: "av-002",
        name: "FHIR API Abuse",
        category: "api_exploit",
        description: "Exploitation of improperly secured FHIR APIs for bulk patient data extraction through excessive queries or authentication bypass.",
        targetedAssets: ["Patient Records", "FHIR Endpoints", "OAuth Tokens"],
        exploitedVulnerabilities: ["Missing Rate Limiting", "Weak Scopes", "Token Leakage"],
        detectionSignatures: ["High volume API calls", "Bulk export requests", "Token replay attempts"],
        prevalenceScore: 78,
        sophisticationLevel: "high",
        mitreTechniques: ["T1190", "T1530", "T1552"]
      },
      {
        id: "av-003",
        name: "Business Email Compromise - Healthcare Vendor",
        category: "social_engineering",
        description: "BEC attacks impersonating healthcare vendors, suppliers, or business associates to redirect payments or obtain PHI.",
        targetedAssets: ["Financial Systems", "Vendor Relationships", "PHI"],
        exploitedVulnerabilities: ["Email Spoofing", "Lack of Payment Verification", "Trust Relationships"],
        detectionSignatures: ["Domain lookalikes", "Payment change requests", "Unusual sender behavior"],
        prevalenceScore: 85,
        sophisticationLevel: "medium",
        mitreTechniques: ["T1566.002", "T1534", "T1657"]
      }
    ];

    baseThreats.forEach(t => this.threats.set(t.id, t));
    baseRegulatoryUpdates.forEach(r => this.regulatoryUpdates.set(r.id, r));
    baseAttackVectors.forEach(a => this.attackVectors.set(a.id, a));
    
    console.log(`[AIThreatIntelligence] Initialized with ${baseThreats.length} threats, ${baseRegulatoryUpdates.length} regulatory updates, ${baseAttackVectors.length} attack vectors`);
  }

  async refreshThreatFeed(): Promise<ThreatContext> {
    this.lastRefresh = new Date();
    
    this.configuration.sources.forEach(source => {
      if (source.enabled) {
        source.lastSync = new Date();
      }
    });

    return {
      threats: Array.from(this.threats.values()),
      regulatoryUpdates: Array.from(this.regulatoryUpdates.values()),
      attackVectors: Array.from(this.attackVectors.values()),
      lastUpdated: this.lastRefresh
    };
  }

  async analyzeAuditLogWithThreatContext(
    logEntry: {
      id: string;
      timestamp: Date;
      action: string;
      resourceType: string;
      userId: string;
      ipAddress?: string;
      userAgent?: string;
      details: string;
      originalRiskScore: number;
    }
  ): Promise<AuditLogRiskAssessment> {
    const threatMatches: AuditLogRiskAssessment["threatMatches"] = [];
    const regulatoryRelevance: AuditLogRiskAssessment["regulatoryRelevance"] = [];
    let riskAdjustment = 0;
    const recommendedActions: string[] = [];

    for (const threat of Array.from(this.threats.values())) {
      if (!threat.active) continue;

      let matchConfidence = 0;
      const matchedIndicators: string[] = [];

      for (const indicator of threat.indicators) {
        if (indicator.type === "behavior") {
          if (logEntry.action.toLowerCase().includes("bulk") && indicator.value.toLowerCase().includes("bulk")) {
            matchConfidence = Math.max(matchConfidence, indicator.confidence * 0.8);
            matchedIndicators.push(indicator.value);
          }
          if (logEntry.details.toLowerCase().includes("after hours") && indicator.value.toLowerCase().includes("after-hours")) {
            matchConfidence = Math.max(matchConfidence, indicator.confidence * 0.9);
            matchedIndicators.push(indicator.value);
          }
        }
        if (indicator.type === "pattern") {
          if (logEntry.resourceType === "Patient" && indicator.value.toLowerCase().includes("patient")) {
            matchConfidence = Math.max(matchConfidence, indicator.confidence * 0.6);
            matchedIndicators.push(indicator.value);
          }
        }
      }

      if (threat.ttps.some((ttp: string) => logEntry.action.includes("export") || logEntry.action.includes("download"))) {
        matchConfidence = Math.max(matchConfidence, 50);
        matchedIndicators.push("Data exfiltration TTP match");
      }

      if (matchConfidence > 30) {
        threatMatches.push({
          threatId: threat.id,
          matchConfidence,
          matchedIndicators
        });
        riskAdjustment += (threat.riskScore / 100) * (matchConfidence / 100) * 20;
        recommendedActions.push(...threat.mitigations.slice(0, 2));
      }
    }

    const resourceFrameworks: Record<string, RegulatoryFramework[]> = {
      Patient: ["HIPAA", "GDPR"],
      Observation: ["HIPAA"],
      MedicationRequest: ["HIPAA", "HITECH"],
      AuditEvent: ["SOC2", "HIPAA"]
    };

    const frameworks = resourceFrameworks[logEntry.resourceType] || ["HIPAA"];
    for (const framework of frameworks) {
      const updates = Array.from(this.regulatoryUpdates.values())
        .filter(u => u.framework === framework);
      
      if (updates.length > 0) {
        regulatoryRelevance.push({
          framework,
          relevance: updates.some(u => u.impactLevel === "high") ? 85 : 60,
          affectedRequirements: updates.flatMap(u => u.affectedControls).slice(0, 3)
        });
      }
    }

    const adjustedRiskScore = Math.min(100, Math.max(0, logEntry.originalRiskScore + riskAdjustment));
    
    let priority: AuditLogRiskAssessment["priority"];
    if (adjustedRiskScore >= 80) priority = "immediate";
    else if (adjustedRiskScore >= 60) priority = "high";
    else if (adjustedRiskScore >= 40) priority = "medium";
    else priority = "low";

    return {
      logEntryId: logEntry.id,
      originalRiskScore: logEntry.originalRiskScore,
      adjustedRiskScore,
      threatMatches,
      regulatoryRelevance,
      adjustmentReason: threatMatches.length > 0 
        ? `Risk adjusted due to ${threatMatches.length} active threat correlations`
        : "No active threat correlations detected",
      recommendedActions: Array.from(new Set(recommendedActions)),
      priority
    };
  }

  async analyzeAccessPatternWithThreatContext(
    pattern: {
      id: string;
      userId: string;
      description: string;
      behaviors: string[];
      timeOfAccess: Date;
      resourcesAccessed: string[];
      originalRiskScore: number;
    }
  ): Promise<AccessPatternRiskAssessment> {
    const threatCorrelations: AccessPatternRiskAssessment["threatCorrelations"] = [];
    const behavioralIndicators: string[] = [];
    let riskAdjustment = 0;
    const recommendedActions: string[] = [];

    for (const threat of Array.from(this.threats.values())) {
      if (!threat.active) continue;
      
      if (threat.category === "insider_threat") {
        for (const behavior of pattern.behaviors) {
          if (behavior.toLowerCase().includes("bulk") || behavior.toLowerCase().includes("export")) {
            threatCorrelations.push({
              threatId: threat.id,
              correlationType: "Behavioral match - bulk data access",
              confidence: 75
            });
            riskAdjustment += 15;
            behavioralIndicators.push("Bulk data access pattern matches insider threat profile");
          }
        }
      }

      if (threat.category === "data_breach" || threat.category === "credential_compromise") {
        const hour = pattern.timeOfAccess.getHours();
        if (hour < 6 || hour > 22) {
          threatCorrelations.push({
            threatId: threat.id,
            correlationType: "Temporal anomaly - off-hours access",
            confidence: 60
          });
          riskAdjustment += 10;
          behavioralIndicators.push("Off-hours access correlates with credential compromise patterns");
        }
      }
    }

    for (const vector of Array.from(this.attackVectors.values())) {
      if (vector.detectionSignatures.some((sig: string) => 
        pattern.behaviors.some(b => b.toLowerCase().includes(sig.toLowerCase().split(" ")[0]))
      )) {
        behavioralIndicators.push(`Pattern matches ${vector.name} detection signature`);
        riskAdjustment += vector.prevalenceScore / 10;
        recommendedActions.push(`Review for ${vector.name} indicators`);
      }
    }

    const adjustedRiskScore = Math.min(100, Math.max(0, pattern.originalRiskScore + riskAdjustment));
    
    let priority: AccessPatternRiskAssessment["priority"];
    if (adjustedRiskScore >= 80) priority = "immediate";
    else if (adjustedRiskScore >= 60) priority = "high";
    else if (adjustedRiskScore >= 40) priority = "medium";
    else priority = "low";

    recommendedActions.push(
      "Review user access permissions",
      "Enable enhanced monitoring",
      "Verify business justification"
    );

    return {
      patternId: pattern.id,
      userId: pattern.userId,
      patternDescription: pattern.description,
      originalRiskScore: pattern.originalRiskScore,
      adjustedRiskScore,
      threatCorrelations,
      behavioralIndicators,
      recommendedActions: Array.from(new Set(recommendedActions)),
      priority
    };
  }

  async adjustRemediationPriority(
    remediation: {
      id: string;
      category: string;
      description: string;
      originalPriority: number;
      affectedAssets: string[];
    }
  ): Promise<RemediationPriorityAdjustment> {
    const adjustmentFactors: RemediationPriorityAdjustment["adjustmentFactors"] = [];
    const relatedThreats: string[] = [];
    const relatedRegulations: RegulatoryFramework[] = [];
    let priorityAdjustment = 0;

    for (const threat of Array.from(this.threats.values())) {
      if (!threat.active) continue;

      const hasOverlap = threat.affectedSystems.some((sys: string) =>
        remediation.affectedAssets.some(asset => 
          asset.toLowerCase().includes(sys.toLowerCase()) ||
          sys.toLowerCase().includes(asset.toLowerCase())
        )
      );

      if (hasOverlap) {
        relatedThreats.push(threat.id);
        const impact = threat.severity === "critical" ? 20 : 
                       threat.severity === "high" ? 15 : 
                       threat.severity === "medium" ? 10 : 5;
        
        priorityAdjustment += impact;
        adjustmentFactors.push({
          factor: `Active threat: ${threat.name}`,
          impact,
          description: `${threat.severity} severity threat affecting related systems`
        });
        
        threat.regulatoryImpact.forEach((reg: RegulatoryFramework) => {
          if (!relatedRegulations.includes(reg)) {
            relatedRegulations.push(reg);
          }
        });
      }
    }

    for (const update of Array.from(this.regulatoryUpdates.values())) {
      if (update.impactLevel === "high" || update.impactLevel === "critical") {
        const categoryMatch = update.affectedControls.some((ctrl: string) =>
          remediation.category.toLowerCase().includes(ctrl.toLowerCase()) ||
          ctrl.toLowerCase().includes(remediation.category.toLowerCase())
        );
        
        if (categoryMatch && !relatedRegulations.includes(update.framework)) {
          relatedRegulations.push(update.framework);
          priorityAdjustment += 10;
          adjustmentFactors.push({
            factor: `Regulatory update: ${update.title}`,
            impact: 10,
            description: `Upcoming ${update.framework} requirement affecting this control`
          });
        }
      }
    }

    const adjustedPriority = Math.min(100, Math.max(0, remediation.originalPriority + priorityAdjustment));
    
    let urgencyLevel: RemediationPriorityAdjustment["urgencyLevel"];
    if (adjustedPriority >= 80) urgencyLevel = "critical";
    else if (adjustedPriority >= 60) urgencyLevel = "urgent";
    else if (adjustedPriority >= 40) urgencyLevel = "standard";
    else urgencyLevel = "low";

    const justifications: string[] = [];
    if (relatedThreats.length > 0) {
      justifications.push(`Correlates with ${relatedThreats.length} active threats`);
    }
    if (relatedRegulations.length > 0) {
      justifications.push(`Affects ${relatedRegulations.join(", ")} compliance`);
    }

    return {
      remediationId: remediation.id,
      originalPriority: remediation.originalPriority,
      adjustedPriority,
      adjustmentFactors,
      relatedThreats,
      relatedRegulations,
      urgencyLevel,
      justification: justifications.join("; ") || "No significant threat or regulatory context"
    };
  }

  async generateThreatIntelligenceSummary(): Promise<ThreatIntelligenceSummary> {
    const activeThreats = Array.from(this.threats.values()).filter(t => t.active);
    const criticalThreats = activeThreats.filter(t => t.severity === "critical").length;
    
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newThreats = activeThreats.filter(t => t.firstSeen > last24h).length;
    
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUpdates = Array.from(this.regulatoryUpdates.values())
      .filter(u => u.announcedDate > last30d).length;

    const vectorPrevalence = Array.from(this.attackVectors.values())
      .sort((a, b) => b.prevalenceScore - a.prevalenceScore)
      .slice(0, 5)
      .map(v => ({ name: v.name, prevalence: v.prevalenceScore }));

    const affectedFrameworks = new Set<RegulatoryFramework>();
    activeThreats.forEach(t => t.regulatoryImpact.forEach((f: RegulatoryFramework) => affectedFrameworks.add(f)));

    let aiSummary: string[] = [];
    
    if (process.env.OPENAI_API_KEY && openai) {
      try {
        const context = sanitizePhi(JSON.stringify({
          activeThreatsCount: activeThreats.length,
          criticalCount: criticalThreats,
          topThreats: activeThreats.slice(0, 3).map(t => ({ name: t.name, severity: t.severity })),
          recentRegUpdates: recentUpdates
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_THREAT_PROMPT },
            {
              role: "user",
              content: `Based on this threat intelligence summary, provide 3-4 key focus areas for a healthcare organization's security team: ${context}`
            }
          ],
          max_tokens: 300,
          temperature: 0.5
        });

        const content = response.choices[0]?.message?.content || "";
        aiSummary = content.split(/\d+\.\s+/).filter(s => s.trim().length > 10).slice(0, 4);
      } catch (error) {
        console.error("[AIThreatIntelligence] AI summary generation error:", error);
      }
    }

    if (aiSummary.length === 0) {
      aiSummary = [
        "Monitor for ransomware targeting healthcare organizations",
        "Review and strengthen EHR access controls",
        "Ensure FHIR API security and rate limiting",
        "Prepare for upcoming HIPAA Security Rule changes"
      ];
    }

    return {
      totalActiveThreats: activeThreats.length,
      criticalThreats,
      newThreatsLast24h: newThreats,
      regulatoryUpdatesLast30d: recentUpdates,
      topAttackVectors: vectorPrevalence,
      riskTrend: criticalThreats > 2 ? "increasing" : criticalThreats > 0 ? "stable" : "decreasing",
      affectedFrameworks: Array.from(affectedFrameworks),
      recommendedFocus: aiSummary,
      lastAnalyzed: new Date()
    };
  }

  listThreats(filters?: { 
    category?: ThreatCategory; 
    severity?: SeverityLevel; 
    activeOnly?: boolean 
  }): SecurityThreat[] {
    let threats = Array.from(this.threats.values());
    
    if (filters?.category) {
      threats = threats.filter(t => t.category === filters.category);
    }
    if (filters?.severity) {
      threats = threats.filter(t => t.severity === filters.severity);
    }
    if (filters?.activeOnly !== false) {
      threats = threats.filter(t => t.active);
    }
    
    return threats.sort((a, b) => b.riskScore - a.riskScore);
  }

  listRegulatoryUpdates(framework?: RegulatoryFramework): RegulatoryUpdate[] {
    let updates = Array.from(this.regulatoryUpdates.values());
    
    if (framework) {
      updates = updates.filter(u => u.framework === framework);
    }
    
    return updates.sort((a, b) => b.announcedDate.getTime() - a.announcedDate.getTime());
  }

  listAttackVectors(): AttackVector[] {
    return Array.from(this.attackVectors.values())
      .sort((a, b) => b.prevalenceScore - a.prevalenceScore);
  }

  getThreat(threatId: string): SecurityThreat | null {
    return this.threats.get(threatId) || null;
  }

  getConfiguration(): ThreatFeedConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(updates: Partial<ThreatFeedConfiguration>): ThreatFeedConfiguration {
    this.configuration = { ...this.configuration, ...updates };
    return this.configuration;
  }
}

export const aiThreatIntelligenceService = new AIThreatIntelligenceService();
