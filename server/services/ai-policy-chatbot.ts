import OpenAI from "openai";
import { randomUUID, createHash } from "crypto";
import { getAuditLogger } from "./integrations/factory";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_POLICY_CHATBOT_PROMPT = `You are a Data Governance Policy Expert Assistant for Tabula Medica, a HIPAA-compliant healthcare data platform.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Explaining data governance policies and their requirements
- Answering questions about HIPAA, GDPR, SOC2, and other compliance frameworks
- Guiding users on how to adhere to data access and protection policies
- Explaining policy rules, enforcement levels, and data classifications
- Providing examples of compliant vs non-compliant scenarios
- Clarifying retention, encryption, consent, and audit requirements

RESPONSE GUIDELINES:
- Be clear, concise, and helpful
- Use plain language accessible to non-technical users
- Provide specific examples when explaining policies
- Reference specific policy names when relevant
- Always emphasize the importance of compliance
- If unsure, recommend consulting with the compliance officer

AVAILABLE POLICIES FOR REFERENCE:
{POLICIES_CONTEXT}

Remember: Focus ONLY on data governance, compliance, and policy adherence. Never provide clinical or medical guidance.`;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  topic?: string;
}

export interface PolicyContext {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  enforcement: string;
  dataTypes: string[];
  regulatoryMappings: string[];
  rules: { name: string; condition: string; action: string }[];
}

export interface ChatbotResponse {
  message: ChatMessage;
  suggestedQuestions?: string[];
  relatedPolicies?: { id: string; name: string }[];
}

const sessionStore = new Map<string, ChatSession>();

const samplePolicies: PolicyContext[] = [
  {
    id: "policy-hipaa-access-v2",
    name: "HIPAA PHI Access Control",
    type: "access_control",
    description: "Controls access to Protected Health Information per HIPAA requirements. Ensures minimum necessary access principle is enforced.",
    status: "active",
    enforcement: "strict",
    dataTypes: ["PHI", "demographics", "clinical_notes"],
    regulatoryMappings: ["HIPAA", "HITECH"],
    rules: [
      { name: "Minimum Necessary", condition: "access_type=read AND resource=PHI", action: "require_justification" },
      { name: "Break Glass", condition: "access_type=emergency", action: "allow_with_audit" },
      { name: "Role Restriction", condition: "user_role NOT IN (physician, nurse, admin)", action: "deny" },
    ],
  },
  {
    id: "policy-data-retention",
    name: "Data Retention Policy",
    type: "retention",
    description: "Defines retention periods for different data classifications. PHI must be retained for 7 years per HIPAA requirements.",
    status: "active",
    enforcement: "mandatory",
    dataTypes: ["PHI", "audit_log", "operational"],
    regulatoryMappings: ["HIPAA", "SOC2"],
    rules: [
      { name: "PHI Retention", condition: "data_type=PHI", action: "retain_7_years" },
      { name: "Audit Log Retention", condition: "data_type=audit_log", action: "retain_6_years" },
    ],
  },
  {
    id: "policy-encryption-current",
    name: "Data Encryption Standards",
    type: "encryption",
    description: "Mandates AES-256-GCM encryption for data at rest and TLS 1.3 for data in transit.",
    status: "active",
    enforcement: "mandatory",
    dataTypes: ["PHI", "PII", "PCI"],
    regulatoryMappings: ["HIPAA", "PCI_DSS", "SOC2"],
    rules: [
      { name: "AES-256-GCM", condition: "data_at_rest=true", action: "encrypt_aes256gcm" },
      { name: "TLS 1.3", condition: "data_in_transit=true", action: "require_tls13" },
    ],
  },
  {
    id: "policy-consent-gdpr",
    name: "GDPR Consent Management",
    type: "consent",
    description: "Consent handling for EU data subjects per GDPR requirements. Requires explicit consent for data processing.",
    status: "active",
    enforcement: "strict",
    dataTypes: ["PII", "PHI"],
    regulatoryMappings: ["GDPR"],
    rules: [
      { name: "Explicit Consent", condition: "data_subject_location=EU", action: "require_explicit_consent" },
      { name: "Right to Erasure", condition: "request_type=deletion", action: "process_within_30_days" },
    ],
  },
  {
    id: "policy-audit-logging",
    name: "Audit Logging Requirements",
    type: "audit",
    description: "Comprehensive logging of all PHI access and system events for compliance and security purposes.",
    status: "active",
    enforcement: "mandatory",
    dataTypes: ["all"],
    regulatoryMappings: ["HIPAA", "SOC2", "GDPR"],
    rules: [
      { name: "PHI Access Logging", condition: "resource_type=PHI", action: "log_all_access" },
      { name: "Admin Actions", condition: "user_role=admin", action: "log_with_details" },
    ],
  },
];

const commonScenarios = [
  {
    scenario: "Accessing patient records for treatment",
    guidance: "You must have a legitimate treatment purpose. Document the reason in the access justification field. Only access the minimum necessary information for your role.",
  },
  {
    scenario: "Sharing data with external partners",
    guidance: "Ensure a Business Associate Agreement (BAA) is in place. Data must be encrypted in transit using TLS 1.3. Log the data sharing event for audit purposes.",
  },
  {
    scenario: "Responding to a patient data deletion request",
    guidance: "For GDPR subjects, process within 30 days. Document the request in the consent management system. Some data may need retention for legal/compliance reasons.",
  },
  {
    scenario: "Emergency access to restricted records",
    guidance: "Use the Break Glass feature for emergency situations. You must provide a justification that will be logged and reviewed. Regular audits check for appropriate use.",
  },
];

function buildPoliciesContext(): string {
  return samplePolicies.map(p => 
    `- ${p.name} (${p.type}, ${p.status}): ${p.description} [Regulations: ${p.regulatoryMappings.join(", ")}]`
  ).join("\n");
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

class AIPolicyChatbotService {

  async createSession(userId: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: randomUUID(),
      userId,
      messages: [{
        id: randomUUID(),
        role: "assistant",
        content: "Hello! I'm your Data Governance Policy Assistant. I can help you understand our data policies, answer compliance questions, and guide you on how to follow proper procedures.\n\nHere are some topics I can help with:\n- HIPAA PHI access requirements\n- Data retention policies\n- Encryption standards\n- GDPR consent management\n- Audit logging requirements\n\nWhat would you like to know about?",
        timestamp: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionStore.set(session.id, session);
    return session;
  }

  async sendMessage(sessionId: string, userId: string, userMessage: string): Promise<ChatbotResponse> {
    let session = sessionStore.get(sessionId);
    
    if (!session) {
      session = await this.createSession(userId);
    }

    const userMsg: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);
    const response = await this.generateResponse(session, userMessage);

    const assistantMsg: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date().toISOString();

    if (!session.topic && session.messages.length > 2) {
      session.topic = this.extractTopic(userMessage);
    }

    sessionStore.set(sessionId, session);

    return {
      message: assistantMsg,
      suggestedQuestions: response.suggestedQuestions,
      relatedPolicies: response.relatedPolicies,
    };
  }

  private checkNoCdsViolation(message: string): { isViolation: boolean; response?: string } {
    const clinicalTerms = [
      "diagnose", "diagnosis", "prescribe", "prescription", "treatment plan",
      "should i take", "what medication", "medical advice", "clinical recommendation",
      "is it safe to", "can i stop taking", "dosage", "symptoms mean", "do i have",
      "prognosis", "cure", "remedy", "therapeutic", "clinical decision"
    ];
    
    const lowerMessage = message.toLowerCase();
    const foundTerms = clinicalTerms.filter(term => lowerMessage.includes(term));
    
    if (foundTerms.length > 0) {
      return {
        isViolation: true,
        response: `I'm a Data Governance Policy Assistant, and I can only help with questions about data policies, compliance, HIPAA, GDPR, data retention, encryption, and similar governance topics. For clinical or medical questions, please consult your healthcare provider. How can I help you with data governance policies today?`
      };
    }
    
    return { isViolation: false };
  }

  private async generateResponse(session: ChatSession, userMessage: string): Promise<{
    content: string;
    suggestedQuestions: string[];
    relatedPolicies: { id: string; name: string }[];
  }> {
    const lowerMessage = userMessage.toLowerCase();
    
    const noCdsCheck = this.checkNoCdsViolation(userMessage);
    if (noCdsCheck.isViolation) {
      return {
        content: noCdsCheck.response!,
        suggestedQuestions: [
          "What are our HIPAA compliance requirements?",
          "Explain our data retention policy",
          "How do we handle patient consent?"
        ],
        relatedPolicies: []
      };
    }
    
    const relatedPolicies = this.findRelatedPolicies(lowerMessage);

    if (!openai) {
      return this.generateFallbackResponse(lowerMessage, relatedPolicies);
    }

    try {
      const systemPrompt = NO_CDS_POLICY_CHATBOT_PROMPT.replace("{POLICIES_CONTEXT}", buildPoliciesContext());
      
      const conversationHistory = session.messages.slice(-10).map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";

      return {
        content,
        suggestedQuestions: this.generateSuggestedQuestions(lowerMessage, relatedPolicies),
        relatedPolicies,
      };
    } catch (error) {
      console.error("[AIPolicyChatbot] OpenAI error:", error);
      return this.generateFallbackResponse(lowerMessage, relatedPolicies);
    }
  }

  private findRelatedPolicies(message: string): { id: string; name: string }[] {
    const related: { id: string; name: string }[] = [];

    for (const policy of samplePolicies) {
      const nameMatch = message.includes(policy.name.toLowerCase());
      const typeMatch = message.includes(policy.type);
      const regulationMatch = policy.regulatoryMappings.some(r => message.includes(r.toLowerCase()));
      const dataTypeMatch = policy.dataTypes.some(d => message.includes(d.toLowerCase()));

      if (nameMatch || typeMatch || regulationMatch || dataTypeMatch) {
        related.push({ id: policy.id, name: policy.name });
      }
    }

    if (related.length === 0) {
      if (message.includes("hipaa") || message.includes("phi") || message.includes("health") || message.includes("patient")) {
        related.push({ id: "policy-hipaa-access-v2", name: "HIPAA PHI Access Control" });
      }
      if (message.includes("gdpr") || message.includes("consent") || message.includes("eu") || message.includes("europe")) {
        related.push({ id: "policy-consent-gdpr", name: "GDPR Consent Management" });
      }
      if (message.includes("encrypt") || message.includes("secure") || message.includes("protect")) {
        related.push({ id: "policy-encryption-current", name: "Data Encryption Standards" });
      }
      if (message.includes("retention") || message.includes("keep") || message.includes("delete") || message.includes("store")) {
        related.push({ id: "policy-data-retention", name: "Data Retention Policy" });
      }
      if (message.includes("audit") || message.includes("log") || message.includes("track")) {
        related.push({ id: "policy-audit-logging", name: "Audit Logging Requirements" });
      }
    }

    return related.slice(0, 3);
  }

  private generateFallbackResponse(message: string, relatedPolicies: { id: string; name: string }[]): {
    content: string;
    suggestedQuestions: string[];
    relatedPolicies: { id: string; name: string }[];
  } {
    let content = "";

    if (message.includes("hipaa") || message.includes("phi")) {
      const policy = samplePolicies.find(p => p.id === "policy-hipaa-access-v2");
      content = `**HIPAA PHI Access Control Policy**\n\n${policy?.description}\n\n**Key Requirements:**\n- Only access the minimum necessary information for your role\n- Document justification for accessing patient records\n- Emergency "Break Glass" access is available but audited\n- Access is restricted based on your role\n\n**Enforcement Level:** ${policy?.enforcement}\n\nWould you like more details about specific HIPAA requirements?`;
    } else if (message.includes("gdpr") || message.includes("consent")) {
      const policy = samplePolicies.find(p => p.id === "policy-consent-gdpr");
      content = `**GDPR Consent Management Policy**\n\n${policy?.description}\n\n**Key Requirements:**\n- EU data subjects must provide explicit consent\n- Right to erasure requests must be processed within 30 days\n- Consent records must be maintained with full audit trail\n\n**Enforcement Level:** ${policy?.enforcement}\n\nDo you have specific questions about consent management?`;
    } else if (message.includes("encrypt")) {
      const policy = samplePolicies.find(p => p.id === "policy-encryption-current");
      content = `**Data Encryption Standards**\n\n${policy?.description}\n\n**Key Requirements:**\n- All data at rest must use AES-256-GCM encryption\n- All data in transit must use TLS 1.3\n- Applies to PHI, PII, and PCI data\n\n**Enforcement Level:** ${policy?.enforcement}\n\nWould you like to know more about encryption requirements?`;
    } else if (message.includes("retention") || message.includes("delete") || message.includes("keep")) {
      const policy = samplePolicies.find(p => p.id === "policy-data-retention");
      content = `**Data Retention Policy**\n\n${policy?.description}\n\n**Key Requirements:**\n- PHI must be retained for 7 years\n- Audit logs must be retained for 6 years\n- Retention periods are based on regulatory requirements\n\n**Enforcement Level:** ${policy?.enforcement}\n\nDo you have questions about specific retention requirements?`;
    } else if (message.includes("audit") || message.includes("log")) {
      const policy = samplePolicies.find(p => p.id === "policy-audit-logging");
      content = `**Audit Logging Requirements**\n\n${policy?.description}\n\n**Key Requirements:**\n- All PHI access is logged automatically\n- Admin actions are logged with full details\n- Logs are retained per compliance requirements\n\n**Enforcement Level:** ${policy?.enforcement}\n\nWould you like more information about what is logged?`;
    } else if (message.includes("scenario") || message.includes("example") || message.includes("how do i")) {
      content = `**Common Compliance Scenarios**\n\nHere are some common situations and how to handle them:\n\n${commonScenarios.map(s => `**${s.scenario}:**\n${s.guidance}`).join("\n\n")}\n\nDo you have a specific scenario you'd like guidance on?`;
    } else if (message.includes("policy") || message.includes("policies") || message.includes("list")) {
      content = `**Available Data Governance Policies**\n\nHere are the active policies I can help you understand:\n\n${samplePolicies.map(p => `- **${p.name}** (${p.status}): ${p.description.substring(0, 100)}...`).join("\n")}\n\nWhich policy would you like to know more about?`;
    } else {
      content = `I'd be happy to help you understand our data governance policies. Here are some topics I can assist with:\n\n- **HIPAA Compliance**: PHI access rules, minimum necessary principle\n- **GDPR Requirements**: Consent management, data subject rights\n- **Encryption Standards**: Data protection at rest and in transit\n- **Data Retention**: How long different data types are kept\n- **Audit Logging**: What activities are tracked\n- **Common Scenarios**: Practical guidance for compliance situations\n\nWhat would you like to know more about?`;
    }

    return {
      content,
      suggestedQuestions: this.generateSuggestedQuestions(message, relatedPolicies),
      relatedPolicies,
    };
  }

  private generateSuggestedQuestions(message: string, relatedPolicies: { id: string; name: string }[]): string[] {
    const suggestions: string[] = [];

    if (message.includes("hipaa")) {
      suggestions.push("What is the minimum necessary principle?");
      suggestions.push("How does Break Glass access work?");
    } else if (message.includes("gdpr")) {
      suggestions.push("What are data subject rights under GDPR?");
      suggestions.push("How do I process a deletion request?");
    } else if (message.includes("encrypt")) {
      suggestions.push("What encryption is used for data at rest?");
      suggestions.push("What about data in transit?");
    } else {
      suggestions.push("What are the HIPAA requirements for PHI access?");
      suggestions.push("How long must we retain patient data?");
      suggestions.push("What happens if I need emergency access?");
    }

    return suggestions.slice(0, 3);
  }

  private extractTopic(message: string): string {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("hipaa")) return "HIPAA Compliance";
    if (lowerMessage.includes("gdpr")) return "GDPR Requirements";
    if (lowerMessage.includes("encrypt")) return "Encryption Standards";
    if (lowerMessage.includes("retention")) return "Data Retention";
    if (lowerMessage.includes("audit")) return "Audit Logging";
    return "Data Governance";
  }

  getSession(sessionId: string): ChatSession | undefined {
    return sessionStore.get(sessionId);
  }

  listSessions(userId: string): ChatSession[] {
    return Array.from(sessionStore.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return false;

    sessionStore.delete(sessionId);
    return true;
  }

  getPolicies(): PolicyContext[] {
    return samplePolicies;
  }

  getPolicy(policyId: string): PolicyContext | undefined {
    return samplePolicies.find(p => p.id === policyId);
  }

  getCommonScenarios(): typeof commonScenarios {
    return commonScenarios;
  }
}

export const aiPolicyChatbotService = new AIPolicyChatbotService();
