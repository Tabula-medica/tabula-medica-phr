// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";
import crypto from "crypto";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

export type UserRole = "admin" | "data_steward" | "care_team" | "patient";

export interface FeatureGuide {
  id: string;
  name: string;
  description: string;
  category: "connection" | "data_mapping" | "quality" | "correction" | "analytics" | "security" | "patient_management";
  roles: UserRole[];
  steps: Array<{
    order: number;
    title: string;
    description: string;
    action?: string;
    route?: string;
  }>;
  relatedFeatures: string[];
  documentation: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
}

export interface ContextTip {
  id: string;
  context: string;
  tip: string;
  priority: "low" | "medium" | "high";
  roles: UserRole[];
  triggerConditions: string[];
  dismissible: boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  roles: UserRole[];
  steps: Array<{
    order: number;
    title: string;
    content: string;
    imageUrl?: string;
  }>;
  duration: string;
  tags: string[];
}

export interface OnboardingProgress {
  userId: string;
  completedFeatures: string[];
  viewedTips: string[];
  completedTutorials: string[];
  currentFeature?: string;
  onboardingStartedAt: string;
  lastActivityAt: string;
  questionsAsked: number;
  role: UserRole;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  context?: {
    feature?: string;
    route?: string;
    userActivity?: string[];
  };
}

export interface ConversationSession {
  id: string;
  userId: string;
  messages: AssistantMessage[];
  createdAt: string;
  lastUpdatedAt: string;
}

const featureGuides: Map<string, FeatureGuide> = new Map();
const tutorials: Map<string, Tutorial> = new Map();
const contextTips: Map<string, ContextTip> = new Map();
const userProgress: Map<string, OnboardingProgress> = new Map();
const conversationSessions: Map<string, ConversationSession> = new Map();

function initializeFeatureGuides(): void {
  const guides: FeatureGuide[] = [
    {
      id: "connection-management",
      name: "Connection Management",
      description: "Learn how to set up and manage connections to external healthcare systems like EHRs, HIEs, labs, and pharmacies",
      category: "connection",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Navigate to External Integrations", description: "Go to the External Integration Hub to view all connections", route: "/external-integrations" },
        { order: 2, title: "Create New Connection", description: "Click 'Add Connection' to set up a new external system", action: "click_add_connection" },
        { order: 3, title: "Configure Authentication", description: "Select authentication method (OAuth 2.0, mTLS, SMART on FHIR, API Key)", action: "configure_auth" },
        { order: 4, title: "Set Sync Direction", description: "Choose inbound, outbound, or bidirectional data flow", action: "set_sync" },
        { order: 5, title: "Configure Rate Limits", description: "Set requests per minute/hour to prevent API throttling", action: "configure_rate_limits" },
        { order: 6, title: "Test Connection", description: "Verify the connection works correctly before enabling", action: "test_connection" },
      ],
      relatedFeatures: ["data-sync", "hl7-integration", "webhooks"],
      documentation: ["Connection Setup Guide", "Authentication Methods", "Rate Limiting Best Practices"],
      difficulty: "intermediate",
      estimatedTime: "15-20 minutes",
    },
    {
      id: "data-mapping",
      name: "Data Mapping & Transformation",
      description: "Configure how data from external systems is mapped and transformed to FHIR R4 format",
      category: "data_mapping",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Access Code Mapping", description: "Navigate to the Code System Mapper", route: "/code-mapping" },
        { order: 2, title: "View Code Systems", description: "Review supported code systems: LOINC, SNOMED, ICD-10, RxNorm", action: "view_code_systems" },
        { order: 3, title: "Create Mapping Rules", description: "Define transformation rules for incoming data", action: "create_mapping" },
        { order: 4, title: "Test Mappings", description: "Validate mappings with sample data", action: "test_mappings" },
        { order: 5, title: "Apply to Connections", description: "Assign transformation rules to specific connections", action: "apply_rules" },
      ],
      relatedFeatures: ["hl7-integration", "fhir-validation", "code-translation"],
      documentation: ["FHIR R4 Mapping Guide", "Code System Translation", "HL7 to FHIR Conversion"],
      difficulty: "advanced",
      estimatedTime: "30-45 minutes",
    },
    {
      id: "quality-analysis",
      name: "Data Quality Analysis",
      description: "Use AI-powered tools to analyze and improve the quality of health record data",
      category: "quality",
      roles: ["admin", "data_steward", "care_team"],
      steps: [
        { order: 1, title: "Open Quality Dashboard", description: "Navigate to the Data Quality Dashboard", route: "/data-quality" },
        { order: 2, title: "View Quality Metrics", description: "Review overall data quality scores and issue counts", action: "view_metrics" },
        { order: 3, title: "Filter Issues", description: "Use filters to focus on specific issue types or severity levels", action: "filter_issues" },
        { order: 4, title: "Review Issue Details", description: "Click on issues to see detailed information and AI suggestions", action: "review_issue" },
        { order: 5, title: "Run Quality Scan", description: "Trigger an on-demand scan for comprehensive analysis", action: "run_scan" },
      ],
      relatedFeatures: ["fhir-validation", "data-reconciliation", "correction-workflows"],
      documentation: ["Quality Analysis Guide", "Issue Types Explained", "AI Correction Suggestions"],
      difficulty: "intermediate",
      estimatedTime: "20-30 minutes",
    },
    {
      id: "correction-workflows",
      name: "Correction Workflows",
      description: "Learn how to review, approve, and apply corrections to data quality issues",
      category: "correction",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Access Issues List", description: "View all detected quality issues", route: "/data-quality" },
        { order: 2, title: "Review AI Suggestions", description: "Examine AI-generated correction suggestions with confidence scores", action: "review_suggestion" },
        { order: 3, title: "Approve Corrections", description: "Approve high-confidence corrections for auto-application", action: "approve_correction" },
        { order: 4, title: "Manual Correction", description: "Apply manual corrections for complex issues", action: "manual_correct" },
        { order: 5, title: "Track Resolution", description: "Monitor correction status and audit trail", action: "track_resolution" },
      ],
      relatedFeatures: ["quality-analysis", "audit-trails", "escalation-rules"],
      documentation: ["Correction Workflow Guide", "Auto-Correction Thresholds", "Escalation Rules"],
      difficulty: "intermediate",
      estimatedTime: "15-25 minutes",
    },
    {
      id: "data-reconciliation",
      name: "Data Reconciliation & Deduplication",
      description: "Detect and merge duplicate records from multiple data sources",
      category: "quality",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Navigate to Reconciliation", description: "Access the Data Reconciliation service", route: "/data-reconciliation" },
        { order: 2, title: "View Match Candidates", description: "Review potential duplicate records identified by AI", action: "view_matches" },
        { order: 3, title: "Examine Match Scores", description: "Understand scoring: identifier, name, birthDate, gender weights", action: "view_scores" },
        { order: 4, title: "Resolve Conflicts", description: "Handle field-level conflicts between records", action: "resolve_conflicts" },
        { order: 5, title: "Merge Records", description: "Combine duplicate records into canonical record", action: "merge_records" },
        { order: 6, title: "Track Provenance", description: "View merged record history and original sources", action: "view_provenance" },
      ],
      relatedFeatures: ["quality-analysis", "correction-workflows", "audit-trails"],
      documentation: ["Deduplication Guide", "Match Scoring Algorithm", "Conflict Resolution"],
      difficulty: "advanced",
      estimatedTime: "30-45 minutes",
    },
    {
      id: "audit-security",
      name: "Security & Audit Monitoring",
      description: "Monitor security events, compliance, and access patterns using AI-powered audit engine",
      category: "security",
      roles: ["admin"],
      steps: [
        { order: 1, title: "Access Audit Dashboard", description: "Navigate to the AI Audit Engine dashboard", route: "/audit-dashboard" },
        { order: 2, title: "Review Anomalies", description: "Examine detected security anomalies and risk levels", action: "view_anomalies" },
        { order: 3, title: "View Compliance Scores", description: "Check overall compliance health and trends", action: "view_compliance" },
        { order: 4, title: "Configure Alerts", description: "Set up alert thresholds and notification channels", action: "configure_alerts" },
        { order: 5, title: "Generate Reports", description: "Create compliance reports for audits", action: "generate_reports" },
      ],
      relatedFeatures: ["access-control", "hipaa-compliance", "alert-management"],
      documentation: ["Audit Engine Guide", "Anomaly Types", "Compliance Reporting"],
      difficulty: "advanced",
      estimatedTime: "25-35 minutes",
    },
    {
      id: "hl7-integration",
      name: "HL7 v2 Legacy Integration",
      description: "Connect to legacy healthcare systems using HL7 v2 messaging with automatic FHIR conversion",
      category: "connection",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Configure HL7 Endpoint", description: "Set up HL7 v2 message receiver", route: "/external-integrations" },
        { order: 2, title: "Select Message Types", description: "Choose supported types: ADT, ORM, ORU", action: "select_message_types" },
        { order: 3, title: "Map Segments", description: "Configure segment mappings: MSH, PID, PV1, OBX, OBR", action: "map_segments" },
        { order: 4, title: "Test Messages", description: "Send test HL7 messages and verify conversion", action: "test_hl7" },
        { order: 5, title: "Enable ACK/NAK", description: "Configure acknowledgment responses", action: "configure_ack" },
      ],
      relatedFeatures: ["connection-management", "data-mapping", "fhir-validation"],
      documentation: ["HL7 v2 Integration Guide", "Segment Mapping Reference", "FHIR Conversion Rules"],
      difficulty: "advanced",
      estimatedTime: "40-60 minutes",
    },
    {
      id: "webhooks",
      name: "Webhook Event Notifications",
      description: "Set up event-driven notifications to external systems when data changes occur",
      category: "connection",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Access Webhook Settings", description: "Navigate to webhook subscription management", route: "/webhooks" },
        { order: 2, title: "Create Subscription", description: "Define callback URL and event types", action: "create_subscription" },
        { order: 3, title: "Configure Retry Policy", description: "Set exponential backoff and max retries", action: "configure_retry" },
        { order: 4, title: "Set HMAC Secret", description: "Configure signature verification for security", action: "set_secret" },
        { order: 5, title: "Test Webhook", description: "Send test events to verify delivery", action: "test_webhook" },
      ],
      relatedFeatures: ["connection-management", "event-processing", "security"],
      documentation: ["Webhook Setup Guide", "Event Types Reference", "HMAC Verification"],
      difficulty: "intermediate",
      estimatedTime: "15-20 minutes",
    },
  ];

  for (const guide of guides) {
    featureGuides.set(guide.id, guide);
  }
}

function initializeTutorials(): void {
  const tutorialList: Tutorial[] = [
    {
      id: "getting-started",
      title: "Getting Started with Tabula Medica Admin",
      description: "A comprehensive introduction to the admin dashboard and key features",
      category: "onboarding",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Welcome", content: "Welcome to Tabula Medica! This tutorial will guide you through the essential features for managing health record data." },
        { order: 2, title: "Dashboard Overview", content: "The main dashboard shows key metrics: total patients, active connections, records, and recent sync activity." },
        { order: 3, title: "Navigation", content: "Use the sidebar to access different modules: Connections, Data Quality, Patient Management, and Security." },
        { order: 4, title: "Quick Actions", content: "The quick action bar provides shortcuts to common tasks like adding connections and running quality scans." },
      ],
      duration: "5 minutes",
      tags: ["beginner", "dashboard", "navigation"],
    },
    {
      id: "first-connection",
      title: "Setting Up Your First EHR Connection",
      description: "Step-by-step guide to connecting your first external health record system",
      category: "connections",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Prerequisites", content: "Before starting, ensure you have the API credentials from your EHR vendor and network access configured." },
        { order: 2, title: "Create Connection", content: "Navigate to External Integrations and click 'Add Connection'. Enter a descriptive name and select the system type." },
        { order: 3, title: "Authentication", content: "Choose the appropriate authentication method. SMART on FHIR is recommended for modern EHRs, OAuth 2.0 for APIs." },
        { order: 4, title: "Configure Sync", content: "Set the sync direction and schedule. Start with inbound-only to validate data flow before enabling outbound." },
        { order: 5, title: "Test & Enable", content: "Run a connection test, review the results, and enable the connection when ready." },
      ],
      duration: "15 minutes",
      tags: ["connections", "ehr", "setup"],
    },
    {
      id: "quality-management",
      title: "Managing Data Quality",
      description: "Learn how to use AI-powered tools to maintain high data quality standards",
      category: "quality",
      roles: ["admin", "data_steward", "care_team"],
      steps: [
        { order: 1, title: "Understanding Quality Issues", content: "Data quality issues include missing fields, invalid codes, duplicates, and inconsistencies across records." },
        { order: 2, title: "Quality Dashboard", content: "The dashboard shows issue counts by severity (critical, high, medium, low) and type." },
        { order: 3, title: "AI Suggestions", content: "Our AI analyzes issues and suggests corrections with confidence scores. High-confidence corrections can be auto-applied." },
        { order: 4, title: "Review Workflow", content: "Review AI suggestions, approve or modify corrections, and track resolution status." },
      ],
      duration: "10 minutes",
      tags: ["quality", "ai", "corrections"],
    },
    {
      id: "hipaa-compliance",
      title: "HIPAA Compliance Best Practices",
      description: "Essential guidelines for maintaining HIPAA compliance when managing health data",
      category: "security",
      roles: ["admin", "data_steward"],
      steps: [
        { order: 1, title: "Access Controls", content: "Ensure users have appropriate roles and permissions. Follow the principle of least privilege." },
        { order: 2, title: "Audit Logging", content: "All PHI access is automatically logged. Review audit trails regularly for unauthorized access attempts." },
        { order: 3, title: "Data Encryption", content: "Data is encrypted at rest (AES-256-GCM) and in transit (TLS 1.2+). Never export unencrypted PHI." },
        { order: 4, title: "Identifier Hashing", content: "All patient identifiers in logs and reports are SHA-256 hashed to prevent PHI exposure." },
      ],
      duration: "8 minutes",
      tags: ["hipaa", "security", "compliance"],
    },
  ];

  for (const tutorial of tutorialList) {
    tutorials.set(tutorial.id, tutorial);
  }
}

function initializeContextTips(): void {
  const tips: ContextTip[] = [
    {
      id: "tip-connection-test",
      context: "connection_creation",
      tip: "Always test new connections before enabling them. Use the 'Test Connection' button to verify credentials and network access.",
      priority: "high",
      roles: ["admin", "data_steward"],
      triggerConditions: ["creating_connection", "editing_connection"],
      dismissible: true,
    },
    {
      id: "tip-quality-scan",
      context: "quality_dashboard",
      tip: "Schedule regular quality scans to proactively identify issues. Weekly scans are recommended for active data sources.",
      priority: "medium",
      roles: ["admin", "data_steward"],
      triggerConditions: ["viewing_quality_dashboard", "first_quality_visit"],
      dismissible: true,
    },
    {
      id: "tip-auto-correction",
      context: "correction_review",
      tip: "Auto-corrections are only applied when AI confidence exceeds 95%. Review lower-confidence suggestions manually.",
      priority: "high",
      roles: ["admin", "data_steward"],
      triggerConditions: ["reviewing_corrections", "approving_corrections"],
      dismissible: true,
    },
    {
      id: "tip-dedup-review",
      context: "deduplication",
      tip: "Always review probable matches (80-95% score) before merging. Check identifier, name, and birthDate fields carefully.",
      priority: "high",
      roles: ["admin", "data_steward"],
      triggerConditions: ["viewing_duplicates", "merging_records"],
      dismissible: true,
    },
    {
      id: "tip-audit-alerts",
      context: "audit_monitoring",
      tip: "Configure alert notifications to be notified immediately when critical security anomalies are detected.",
      priority: "medium",
      roles: ["admin"],
      triggerConditions: ["viewing_audit_dashboard", "first_audit_visit"],
      dismissible: true,
    },
    {
      id: "tip-rate-limits",
      context: "connection_configuration",
      tip: "Set appropriate rate limits to prevent API throttling. Start conservative (10 req/min) and increase as needed.",
      priority: "medium",
      roles: ["admin", "data_steward"],
      triggerConditions: ["configuring_connection", "rate_limit_exceeded"],
      dismissible: true,
    },
    {
      id: "tip-hl7-testing",
      context: "hl7_integration",
      tip: "Test HL7 message processing with sample messages before connecting to production systems.",
      priority: "high",
      roles: ["admin", "data_steward"],
      triggerConditions: ["configuring_hl7", "first_hl7_setup"],
      dismissible: true,
    },
  ];

  for (const tip of tips) {
    contextTips.set(tip.id, tip);
  }
}

initializeFeatureGuides();
initializeTutorials();
initializeContextTips();

console.log("[AIOnboardingAssistant] Service initialized");

const SYSTEM_PROMPT = `You are the Tabula Medica Onboarding Assistant, an AI helper for administrators and data stewards using the Tabula Medica health record management platform.

Your role is to:
1. Guide users through the app's key features and workflows
2. Answer questions about app functionality in clear, non-technical language
3. Provide context-aware tips and best practices
4. Suggest relevant tutorials and documentation based on user activity

IMPORTANT GUIDELINES:
- You are NOT a medical assistant. You do NOT provide clinical advice, diagnoses, or treatment recommendations.
- Focus ONLY on helping users understand and use the Tabula Medica platform features.
- Keep responses concise and actionable.
- When explaining technical concepts, use simple language appropriate for non-technical users.
- Always suggest relevant tutorials or documentation when applicable.
- If a user asks about medical or clinical topics, politely redirect them to appropriate resources.

Key platform features you can help with:
- Connection Management: Setting up and managing connections to EHRs, HIEs, labs, pharmacies
- Data Mapping: Configuring code system translations (LOINC, SNOMED, ICD-10, RxNorm)
- Data Quality Analysis: Using AI-powered quality scanning and issue detection
- Correction Workflows: Reviewing and applying AI-suggested corrections
- Data Reconciliation: Detecting and merging duplicate records
- Security & Audit: Monitoring access patterns and compliance
- HL7 v2 Integration: Legacy system connectivity
- Webhooks: Event-driven notifications

HIPAA Compliance Notes:
- All patient identifiers are SHA-256 hashed in logs and reports
- Access control uses role-based permissions (admin, data_steward, care_team, patient)
- Audit trails track all PHI access and modifications`;

export async function chat(
  userId: string,
  message: string,
  context?: {
    currentRoute?: string;
    currentFeature?: string;
    recentActivity?: string[];
    userRole?: UserRole;
  },
  ipAddress: string = "unknown"
): Promise<{
  response: string;
  suggestedFeatures?: FeatureGuide[];
  suggestedTutorials?: Tutorial[];
  contextTips?: ContextTip[];
}> {
  const hashedUserId = hashIdentifier(userId);
  
  let session = Array.from(conversationSessions.values()).find(
    (s) => s.userId === hashedUserId
  );

  if (!session) {
    session = {
      id: `session-${Date.now()}`,
      userId: hashedUserId,
      messages: [],
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    conversationSessions.set(session.id, session);
  }

  const userMessage: AssistantMessage = {
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
    context: {
      feature: context?.currentFeature,
      route: context?.currentRoute,
      userActivity: context?.recentActivity,
    },
  };
  session.messages.push(userMessage);

  let progress = userProgress.get(hashedUserId);
  if (!progress) {
    progress = {
      userId: hashedUserId,
      completedFeatures: [],
      viewedTips: [],
      completedTutorials: [],
      onboardingStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      questionsAsked: 0,
      role: context?.userRole || "admin",
    };
    userProgress.set(hashedUserId, progress);
  }

  progress.questionsAsked++;
  progress.lastActivityAt = new Date().toISOString();

  const contextualInfo = buildContextualInfo(context, progress);

  let response: string;

  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextualInfo },
      ];

      const recentMessages = session.messages.slice(-10);
      for (const msg of recentMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages,
        max_completion_tokens: 1024,
      });

      response = completion.choices[0]?.message?.content || generateFallbackResponse(message, context);
    } catch (error) {
      console.error("[AIOnboardingAssistant] OpenAI error, using fallback:", error);
      response = generateFallbackResponse(message, context);
    }
  } else {
    response = generateFallbackResponse(message, context);
  }

  const assistantMessage: AssistantMessage = {
    role: "assistant",
    content: response,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(assistantMessage);
  session.lastUpdatedAt = new Date().toISOString();

  const suggestedFeatures = getSuggestedFeatures(message, context?.userRole || "admin", progress);
  const suggestedTutorials = getSuggestedTutorials(message, context?.userRole || "admin", progress);
  const tips = getContextTips(context?.currentRoute, context?.userRole || "admin", progress);

  await storage.createSecurityAuditLog({
    userId: hashedUserId,
    eventType: "admin_action",
    description: "Onboarding assistant interaction",
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-onboarding-assistant",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      sessionId: session.id,
      questionsAsked: String(progress.questionsAsked),
    },
  });

  return {
    response,
    suggestedFeatures: suggestedFeatures.length > 0 ? suggestedFeatures : undefined,
    suggestedTutorials: suggestedTutorials.length > 0 ? suggestedTutorials : undefined,
    contextTips: tips.length > 0 ? tips : undefined,
  };
}

function buildContextualInfo(
  context?: { currentRoute?: string; currentFeature?: string; recentActivity?: string[]; userRole?: UserRole },
  progress?: OnboardingProgress
): string {
  let info = "CURRENT CONTEXT:\n";

  if (context?.currentRoute) {
    info += `- Current page: ${context.currentRoute}\n`;
  }
  if (context?.currentFeature) {
    info += `- Working on feature: ${context.currentFeature}\n`;
  }
  if (context?.userRole) {
    info += `- User role: ${context.userRole}\n`;
  }
  if (context?.recentActivity && context.recentActivity.length > 0) {
    info += `- Recent activity: ${context.recentActivity.slice(0, 5).join(", ")}\n`;
  }

  if (progress) {
    if (progress.completedFeatures.length > 0) {
      info += `- Completed features: ${progress.completedFeatures.join(", ")}\n`;
    }
    if (progress.completedTutorials.length > 0) {
      info += `- Completed tutorials: ${progress.completedTutorials.join(", ")}\n`;
    }
    info += `- Questions asked in this session: ${progress.questionsAsked}\n`;
  }

  const availableFeatures = Array.from(featureGuides.values()).map((f) => f.name).join(", ");
  info += `\nAVAILABLE FEATURES TO GUIDE: ${availableFeatures}\n`;

  const availableTutorials = Array.from(tutorials.values()).map((t) => t.title).join(", ");
  info += `AVAILABLE TUTORIALS: ${availableTutorials}\n`;

  return info;
}

function generateFallbackResponse(message: string, context?: { currentRoute?: string; currentFeature?: string }): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("connection") || lowerMessage.includes("ehr") || lowerMessage.includes("integrate")) {
    return "To set up a new connection to an external healthcare system:\n\n1. Go to the External Integration Hub\n2. Click 'Add Connection' and enter the system details\n3. Select the authentication method (OAuth 2.0, mTLS, or SMART on FHIR)\n4. Configure sync direction and rate limits\n5. Test the connection before enabling\n\nWould you like me to walk you through any specific step?";
  }

  if (lowerMessage.includes("quality") || lowerMessage.includes("issue") || lowerMessage.includes("problem")) {
    return "The Data Quality Dashboard helps you identify and fix issues in your health records. Here's how to use it:\n\n1. Navigate to the Quality Dashboard to see overall metrics\n2. Use filters to focus on specific issue types or severity levels\n3. Review AI-generated correction suggestions\n4. Approve high-confidence corrections or apply manual fixes\n\nThe system detects 10 types of issues including missing fields, invalid codes, duplicates, and inconsistencies.";
  }

  if (lowerMessage.includes("duplicate") || lowerMessage.includes("dedup") || lowerMessage.includes("merge")) {
    return "The Data Reconciliation service helps you identify and merge duplicate records:\n\n1. View match candidates identified by our AI matching algorithm\n2. Review match scores based on identifier, name, birthDate, and gender\n3. Resolve any field-level conflicts between records\n4. Merge duplicates into a single canonical record\n5. Track provenance to see original data sources\n\nMatch scores above 95% are considered exact matches, while 80-95% are probable matches requiring review.";
  }

  if (lowerMessage.includes("audit") || lowerMessage.includes("security") || lowerMessage.includes("compliance")) {
    return "The AI Audit Engine monitors security and compliance across your system:\n\n1. It detects 9 types of anomalies including unusual access patterns and compliance deviations\n2. View compliance scores and trends on the dashboard\n3. Configure alert thresholds and notification channels\n4. Generate compliance reports for audits\n\nAll identifiers are SHA-256 hashed for HIPAA compliance.";
  }

  if (lowerMessage.includes("hl7") || lowerMessage.includes("legacy")) {
    return "To connect legacy systems using HL7 v2:\n\n1. Configure an HL7 endpoint in External Integrations\n2. Select message types to support (ADT, ORM, ORU)\n3. Map HL7 segments to FHIR fields\n4. Test with sample messages\n5. Enable ACK/NAK acknowledgments\n\nOur system automatically converts HL7 v2 messages to FHIR R4 format.";
  }

  if (lowerMessage.includes("help") || lowerMessage.includes("start") || lowerMessage.includes("begin") || lowerMessage.includes("new")) {
    return "Welcome! I'm here to help you get started with Tabula Medica. Here are the main areas I can assist with:\n\n1. **Connection Management** - Set up connections to EHRs and external systems\n2. **Data Mapping** - Configure code translations and transformations\n3. **Data Quality** - Analyze and fix data quality issues\n4. **Data Reconciliation** - Identify and merge duplicate records\n5. **Security & Audit** - Monitor compliance and security\n\nWhat would you like to learn about first?";
  }

  if (lowerMessage.includes("tutorial") || lowerMessage.includes("learn") || lowerMessage.includes("guide")) {
    const tutorialList = Array.from(tutorials.values()).map((t) => `- ${t.title} (${t.duration})`).join("\n");
    return `Here are the available tutorials:\n\n${tutorialList}\n\nWhich tutorial would you like to start?`;
  }

  return "I'm here to help you navigate Tabula Medica! You can ask me about:\n\n- Setting up connections to EHRs and external systems\n- Managing data quality and corrections\n- Deduplication and record reconciliation\n- Security monitoring and compliance\n- HL7 v2 legacy integration\n- Webhook event notifications\n\nWhat would you like to know more about?";
}

function getSuggestedFeatures(message: string, role: UserRole, progress: OnboardingProgress): FeatureGuide[] {
  const lowerMessage = message.toLowerCase();
  const suggestions: FeatureGuide[] = [];

  for (const guide of Array.from(featureGuides.values())) {
    if (!guide.roles.includes(role)) continue;
    if (progress.completedFeatures.includes(guide.id)) continue;

    const keywords = [guide.name.toLowerCase(), guide.category, ...guide.relatedFeatures];
    const matches = keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()));

    if (matches) {
      suggestions.push(guide);
    }
  }

  return suggestions.slice(0, 3);
}

function getSuggestedTutorials(message: string, role: UserRole, progress: OnboardingProgress): Tutorial[] {
  const lowerMessage = message.toLowerCase();
  const suggestions: Tutorial[] = [];

  for (const tutorial of Array.from(tutorials.values())) {
    if (!tutorial.roles.includes(role)) continue;
    if (progress.completedTutorials.includes(tutorial.id)) continue;

    const keywords = [tutorial.title.toLowerCase(), tutorial.category, ...tutorial.tags];
    const matches = keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()));

    if (matches) {
      suggestions.push(tutorial);
    }
  }

  if (suggestions.length === 0 && progress.completedTutorials.length === 0) {
    const gettingStarted = tutorials.get("getting-started");
    if (gettingStarted && gettingStarted.roles.includes(role)) {
      suggestions.push(gettingStarted);
    }
  }

  return suggestions.slice(0, 2);
}

function getContextTips(currentRoute?: string, role: UserRole = "admin", progress: OnboardingProgress = {} as OnboardingProgress): ContextTip[] {
  const tips: ContextTip[] = [];

  for (const tip of Array.from(contextTips.values())) {
    if (!tip.roles.includes(role)) continue;
    if (progress.viewedTips?.includes(tip.id)) continue;

    if (currentRoute) {
      const routeMatches =
        (currentRoute.includes("connection") && tip.context.includes("connection")) ||
        (currentRoute.includes("quality") && tip.context.includes("quality")) ||
        (currentRoute.includes("audit") && tip.context.includes("audit")) ||
        (currentRoute.includes("reconciliation") && tip.context.includes("dedup")) ||
        (currentRoute.includes("hl7") && tip.context.includes("hl7"));

      if (routeMatches) {
        tips.push(tip);
      }
    }
  }

  return tips.slice(0, 2);
}

export function getFeatureGuides(role?: UserRole): FeatureGuide[] {
  let guides = Array.from(featureGuides.values());
  if (role) {
    guides = guides.filter((g) => g.roles.includes(role));
  }
  return guides;
}

export function getFeatureGuide(id: string): FeatureGuide | undefined {
  return featureGuides.get(id);
}

export function getTutorials(role?: UserRole): Tutorial[] {
  let tutorialList = Array.from(tutorials.values());
  if (role) {
    tutorialList = tutorialList.filter((t) => t.roles.includes(role));
  }
  return tutorialList;
}

export function getTutorial(id: string): Tutorial | undefined {
  return tutorials.get(id);
}

export function getContextualTips(route: string, role: UserRole): ContextTip[] {
  return getContextTips(route, role);
}

export function getUserProgress(userId: string): OnboardingProgress | undefined {
  return userProgress.get(hashIdentifier(userId));
}

export async function markFeatureComplete(userId: string, featureId: string, ipAddress: string): Promise<boolean> {
  const hashedId = hashIdentifier(userId);
  let progress = userProgress.get(hashedId);

  if (!progress) {
    progress = {
      userId: hashedId,
      completedFeatures: [],
      viewedTips: [],
      completedTutorials: [],
      onboardingStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      questionsAsked: 0,
      role: "admin",
    };
    userProgress.set(hashedId, progress);
  }

  if (!progress.completedFeatures.includes(featureId)) {
    progress.completedFeatures.push(featureId);
    progress.lastActivityAt = new Date().toISOString();

    await storage.createSecurityAuditLog({
      userId: hashedId,
      eventType: "admin_action",
      description: `Onboarding feature completed: ${featureId}`,
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "ai-onboarding-assistant",
      platform: "web",
      appVersion: "1.0.0",
      metadata: { featureId },
    });
  }

  return true;
}

export async function markTutorialComplete(userId: string, tutorialId: string, ipAddress: string): Promise<boolean> {
  const hashedId = hashIdentifier(userId);
  let progress = userProgress.get(hashedId);

  if (!progress) {
    progress = {
      userId: hashedId,
      completedFeatures: [],
      viewedTips: [],
      completedTutorials: [],
      onboardingStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      questionsAsked: 0,
      role: "admin",
    };
    userProgress.set(hashedId, progress);
  }

  if (!progress.completedTutorials.includes(tutorialId)) {
    progress.completedTutorials.push(tutorialId);
    progress.lastActivityAt = new Date().toISOString();

    await storage.createSecurityAuditLog({
      userId: hashedId,
      eventType: "admin_action",
      description: `Onboarding tutorial completed: ${tutorialId}`,
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "ai-onboarding-assistant",
      platform: "web",
      appVersion: "1.0.0",
      metadata: { tutorialId },
    });
  }

  return true;
}

export async function dismissTip(userId: string, tipId: string, ipAddress: string): Promise<boolean> {
  const hashedId = hashIdentifier(userId);
  let progress = userProgress.get(hashedId);

  if (!progress) {
    progress = {
      userId: hashedId,
      completedFeatures: [],
      viewedTips: [],
      completedTutorials: [],
      onboardingStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      questionsAsked: 0,
      role: "admin",
    };
    userProgress.set(hashedId, progress);
  }

  if (!progress.viewedTips.includes(tipId)) {
    progress.viewedTips.push(tipId);
    progress.lastActivityAt = new Date().toISOString();
  }

  return true;
}

export function getOnboardingStats(): {
  totalUsers: number;
  averageFeaturesCompleted: number;
  averageTutorialsCompleted: number;
  totalQuestions: number;
  mostPopularFeatures: Array<{ featureId: string; count: number }>;
} {
  const progressList = Array.from(userProgress.values());
  const featureCounts: Map<string, number> = new Map();

  let totalFeatures = 0;
  let totalTutorials = 0;
  let totalQuestions = 0;

  for (const p of progressList) {
    totalFeatures += p.completedFeatures.length;
    totalTutorials += p.completedTutorials.length;
    totalQuestions += p.questionsAsked;

    for (const f of p.completedFeatures) {
      featureCounts.set(f, (featureCounts.get(f) || 0) + 1);
    }
  }

  const mostPopular = Array.from(featureCounts.entries())
    .map(([featureId, count]) => ({ featureId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalUsers: progressList.length,
    averageFeaturesCompleted: progressList.length > 0 ? totalFeatures / progressList.length : 0,
    averageTutorialsCompleted: progressList.length > 0 ? totalTutorials / progressList.length : 0,
    totalQuestions,
    mostPopularFeatures: mostPopular,
  };
}
