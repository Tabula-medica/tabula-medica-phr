import OpenAI from "openai";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type MessagePriority = "critical" | "high" | "medium" | "low";
export type MessageCategory = 
  | "appointment_request" 
  | "medication_question" 
  | "lab_results_inquiry"
  | "symptom_report"
  | "prescription_refill"
  | "billing_question"
  | "general_inquiry"
  | "urgent_care_needed"
  | "follow_up"
  | "health_summary_share";

export interface TriagedMessage {
  messageId: string;
  conversationId: string;
  patientId: string;
  patientName: string;
  content: string;
  category: MessageCategory;
  priority: MessagePriority;
  urgencyScore: number;
  suggestedResponseTime: string;
  keyTopics: string[];
  sentiment: "positive" | "neutral" | "concerned" | "urgent";
  requiresProviderReview: boolean;
  aiSummary: string;
  triageTimestamp: string;
  ownerId: string;
}

export interface DraftResponse {
  id: string;
  messageId: string;
  conversationId: string;
  draftContent: string;
  tone: "professional" | "empathetic" | "informative" | "urgent";
  suggestedActions: string[];
  disclaimers: string[];
  requiresReview: boolean;
  generatedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  status: "pending_review" | "approved" | "rejected" | "edited";
  ownerId: string;
}

export interface AppointmentRequest {
  id: string;
  conversationId: string;
  patientId: string;
  patientName: string;
  ownerId: string;
  requestType: "new" | "follow_up" | "urgent" | "reschedule" | "cancel";
  preferredDates: string[];
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  reason: string;
  urgency: "routine" | "soon" | "urgent" | "emergency";
  status: "pending" | "scheduled" | "declined" | "cancelled";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedHealthData {
  id: string;
  conversationId: string;
  sharedBy: string;
  sharedWith: string[];
  dataType: "health_summary" | "lab_results" | "conflict_resolution" | "care_plan" | "medication_list";
  dataId: string;
  accessLevel: "view" | "download" | "full";
  expiresAt: string | null;
  accessCount: number;
  createdAt: string;
}

const triagedMessages = new Map<string, TriagedMessage>();
const draftResponses = new Map<string, DraftResponse>();
const appointmentRequests = new Map<string, AppointmentRequest>();
const sharedHealthData = new Map<string, SharedHealthData>();

function logAudit(action: string, userId: string, resourceType: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][ProviderPortal] ${action} - ${resourceType}/${resourceId} by ${userId}: ${details}`);
}

class ProviderCommunicationPortalService {
  async triageMessage(
    messageId: string,
    conversationId: string,
    patientId: string,
    patientName: string,
    content: string,
    ownerId: string
  ): Promise<TriagedMessage> {
    logAudit("TRIAGE_MESSAGE", ownerId, "Message", messageId, `Triaging message from ${patientName}`);

    const triagePrompt = `You are a healthcare message triage AI assistant. Analyze the following patient message and provide structured triage information.

IMPORTANT COMPLIANCE NOTES:
- You are NOT providing medical advice
- You are categorizing and prioritizing for healthcare staff review
- All responses require provider review before sending to patients

Patient Message:
"${content}"

Analyze and respond with JSON only:
{
  "category": "one of: appointment_request, medication_question, lab_results_inquiry, symptom_report, prescription_refill, billing_question, general_inquiry, urgent_care_needed, follow_up, health_summary_share",
  "priority": "one of: critical, high, medium, low",
  "urgencyScore": "number 1-10 where 10 is most urgent",
  "suggestedResponseTime": "e.g. 'within 1 hour', 'within 24 hours', 'within 48 hours'",
  "keyTopics": ["array", "of", "key", "topics"],
  "sentiment": "one of: positive, neutral, concerned, urgent",
  "requiresProviderReview": true,
  "aiSummary": "Brief 1-2 sentence summary of patient's concern"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a healthcare message triage assistant. Respond only with valid JSON." },
          { role: "user", content: triagePrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const triageResult = JSON.parse(response.choices[0]?.message?.content || "{}");
      
      const triaged: TriagedMessage = {
        messageId,
        conversationId,
        patientId,
        patientName,
        content,
        category: triageResult.category || "general_inquiry",
        priority: triageResult.priority || "medium",
        urgencyScore: triageResult.urgencyScore || 5,
        suggestedResponseTime: triageResult.suggestedResponseTime || "within 24 hours",
        keyTopics: triageResult.keyTopics || [],
        sentiment: triageResult.sentiment || "neutral",
        requiresProviderReview: true,
        aiSummary: triageResult.aiSummary || "Patient inquiry requiring review.",
        triageTimestamp: new Date().toISOString(),
        ownerId,
      };

      triagedMessages.set(messageId, triaged);
      
      logAudit("TRIAGE_COMPLETE", "ai-system", "Message", messageId, 
        `Category: ${triaged.category}, Priority: ${triaged.priority}, Score: ${triaged.urgencyScore}`);

      return triaged;
    } catch (error) {
      console.error("[ProviderPortal] Triage error:", error);
      const fallback: TriagedMessage = {
        messageId,
        conversationId,
        patientId,
        patientName,
        content,
        category: "general_inquiry",
        priority: "medium",
        urgencyScore: 5,
        suggestedResponseTime: "within 24 hours",
        keyTopics: [],
        sentiment: "neutral",
        requiresProviderReview: true,
        aiSummary: "Message requires provider review (AI triage unavailable).",
        triageTimestamp: new Date().toISOString(),
        ownerId,
      };
      triagedMessages.set(messageId, fallback);
      return fallback;
    }
  }

  async generateDraftResponse(
    messageId: string,
    conversationId: string,
    originalMessage: string,
    patientName: string,
    providerName: string,
    ownerId: string,
    context?: {
      patientHistory?: string;
      relevantData?: string;
    }
  ): Promise<DraftResponse> {
    logAudit("GENERATE_DRAFT", ownerId, "DraftResponse", messageId, 
      `Generating draft for provider ${providerName}`);

    const draftPrompt = `You are a healthcare communication assistant helping ${providerName} draft a response to a patient message.

CRITICAL COMPLIANCE REQUIREMENTS:
- DO NOT provide medical diagnoses
- DO NOT provide specific treatment recommendations
- DO NOT prescribe or adjust medications
- Include appropriate disclaimers
- Response MUST be reviewed and approved by a licensed provider before sending

Patient: ${patientName}
Original Message: "${originalMessage}"
${context?.patientHistory ? `\nRelevant Patient History: ${context.patientHistory}` : ""}
${context?.relevantData ? `\nRelevant Health Data: ${context.relevantData}` : ""}

Generate a professional, empathetic draft response. Respond with JSON only:
{
  "draftContent": "The draft response text",
  "tone": "one of: professional, empathetic, informative, urgent",
  "suggestedActions": ["array of suggested follow-up actions for the provider"],
  "disclaimers": ["any disclaimers to include"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a healthcare communication assistant. Draft professional responses that require provider review. Respond only with valid JSON." },
          { role: "user", content: draftPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const draftResult = JSON.parse(response.choices[0]?.message?.content || "{}");
      
      const draft: DraftResponse = {
        id: randomUUID(),
        messageId,
        conversationId,
        draftContent: draftResult.draftContent || "",
        tone: draftResult.tone || "professional",
        suggestedActions: draftResult.suggestedActions || [],
        disclaimers: [
          "This response was drafted by AI and reviewed by your healthcare provider.",
          "For emergencies, please call 911 or go to your nearest emergency room.",
          ...(draftResult.disclaimers || [])
        ],
        requiresReview: true,
        generatedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        status: "pending_review",
        ownerId,
      };

      draftResponses.set(draft.id, draft);
      
      logAudit("DRAFT_GENERATED", "ai-system", "DraftResponse", draft.id, 
        `Draft created for message ${messageId}, tone: ${draft.tone}`);

      return draft;
    } catch (error) {
      console.error("[ProviderPortal] Draft generation error:", error);
      const fallback: DraftResponse = {
        id: randomUUID(),
        messageId,
        conversationId,
        draftContent: `Thank you for your message, ${patientName}. We have received your inquiry and a member of our care team will review and respond shortly.`,
        tone: "professional",
        suggestedActions: ["Review patient message", "Check patient records if needed"],
        disclaimers: [
          "This is a template response. Please customize before sending.",
          "For emergencies, please call 911 or go to your nearest emergency room."
        ],
        requiresReview: true,
        generatedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        status: "pending_review",
        ownerId,
      };
      draftResponses.set(fallback.id, fallback);
      return fallback;
    }
  }

  async createAppointmentRequest(
    conversationId: string,
    patientId: string,
    patientName: string,
    assignedProviderId: string,
    requestType: AppointmentRequest["requestType"],
    reason: string,
    urgency: AppointmentRequest["urgency"],
    preferredDates?: string[],
    preferredTimeOfDay?: AppointmentRequest["preferredTimeOfDay"],
    ownerId?: string
  ): Promise<AppointmentRequest> {
    const request: AppointmentRequest = {
      id: randomUUID(),
      conversationId,
      patientId,
      patientName,
      ownerId: ownerId || patientId,
      requestType,
      preferredDates: preferredDates || [],
      preferredTimeOfDay: preferredTimeOfDay || "any",
      reason,
      urgency,
      status: "pending",
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    appointmentRequests.set(request.id, request);
    
    logAudit("APPOINTMENT_REQUEST", patientId, "AppointmentRequest", request.id, 
      `${requestType} appointment request: ${reason}`);

    return request;
  }

  async shareHealthData(
    conversationId: string,
    sharedBy: string,
    sharedWith: string[],
    dataType: SharedHealthData["dataType"],
    dataId: string,
    accessLevel: SharedHealthData["accessLevel"] = "view",
    expiresInHours?: number
  ): Promise<SharedHealthData> {
    const shared: SharedHealthData = {
      id: randomUUID(),
      conversationId,
      sharedBy,
      sharedWith,
      dataType,
      dataId,
      accessLevel,
      expiresAt: expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null,
      accessCount: 0,
      createdAt: new Date().toISOString(),
    };

    sharedHealthData.set(shared.id, shared);
    
    logAudit("SHARE_HEALTH_DATA", sharedBy, dataType, dataId, 
      `Shared ${dataType} with ${sharedWith.length} recipients, access: ${accessLevel}`);

    return shared;
  }

  getTriagedMessages(providerId: string): TriagedMessage[] {
    return Array.from(triagedMessages.values())
      .filter(m => m.ownerId === providerId)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }

  getDraftResponses(providerId: string): DraftResponse[] {
    return Array.from(draftResponses.values())
      .filter(d => d.ownerId === providerId && d.status === "pending_review");
  }

  async approveDraft(draftId: string, providerId: string, editedContent?: string): Promise<DraftResponse | null> {
    const draft = draftResponses.get(draftId);
    if (!draft || draft.ownerId !== providerId) return null;

    draft.status = "approved";
    draft.reviewedBy = providerId;
    draft.reviewedAt = new Date().toISOString();
    if (editedContent) {
      draft.draftContent = editedContent;
    }

    draftResponses.set(draftId, draft);
    
    logAudit("APPROVE_DRAFT", providerId, "DraftResponse", draftId, 
      `Draft approved${editedContent ? " with edits" : ""}`);

    return draft;
  }

  async rejectDraft(draftId: string, providerId: string, reason: string): Promise<DraftResponse | null> {
    const draft = draftResponses.get(draftId);
    if (!draft || draft.ownerId !== providerId) return null;

    draft.status = "rejected";
    draft.reviewedBy = providerId;
    draft.reviewedAt = new Date().toISOString();

    draftResponses.set(draftId, draft);
    
    logAudit("REJECT_DRAFT", providerId, "DraftResponse", draftId, `Rejected: ${reason}`);

    return draft;
  }

  getAppointmentRequests(providerId: string | null, status?: AppointmentRequest["status"]): AppointmentRequest[] {
    return Array.from(appointmentRequests.values())
      .filter(r => providerId === null || r.ownerId === providerId)
      .filter(r => !status || r.status === status)
      .sort((a, b) => {
        const urgencyOrder = { emergency: 0, urgent: 1, soon: 2, routine: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });
  }

  async updateAppointmentRequest(
    requestId: string,
    providerId: string | null,
    updates: Partial<Pick<AppointmentRequest, "status" | "notes">>
  ): Promise<AppointmentRequest | null> {
    const request = appointmentRequests.get(requestId);
    if (!request) return null;

    if (providerId !== null && request.ownerId !== providerId) return null;

    Object.assign(request, updates, { updatedAt: new Date().toISOString() });
    appointmentRequests.set(requestId, request);
    
    logAudit("UPDATE_APPOINTMENT", providerId ?? "admin", "AppointmentRequest", requestId, 
      `Updated: ${JSON.stringify(updates)}`);

    return request;
  }

  getSharedHealthData(userId: string): SharedHealthData[] {
    return Array.from(sharedHealthData.values())
      .filter(s => s.sharedBy === userId || s.sharedWith.includes(userId))
      .filter(s => !s.expiresAt || new Date(s.expiresAt) > new Date());
  }

  recordHealthDataAccess(shareId: string, accessedBy: string): void {
    const share = sharedHealthData.get(shareId);
    if (share && (share.sharedBy === accessedBy || share.sharedWith.includes(accessedBy))) {
      share.accessCount++;
      sharedHealthData.set(shareId, share);
      
      logAudit("ACCESS_SHARED_DATA", accessedBy, share.dataType, share.dataId, 
        `Accessed shared ${share.dataType}, count: ${share.accessCount}`);
    }
  }

  getTriageStatistics(): {
    totalMessages: number;
    byPriority: Record<MessagePriority, number>;
    byCategory: Record<string, number>;
    averageUrgencyScore: number;
  } {
    const messages = Array.from(triagedMessages.values());
    const byPriority: Record<MessagePriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};
    let totalScore = 0;

    for (const msg of messages) {
      byPriority[msg.priority]++;
      byCategory[msg.category] = (byCategory[msg.category] || 0) + 1;
      totalScore += msg.urgencyScore;
    }

    return {
      totalMessages: messages.length,
      byPriority,
      byCategory,
      averageUrgencyScore: messages.length > 0 ? totalScore / messages.length : 0,
    };
  }
}

export const providerCommunicationPortalService = new ProviderCommunicationPortalService();
console.log("[ProviderCommunicationPortal] Service initialized with AI triage and draft response capabilities");
