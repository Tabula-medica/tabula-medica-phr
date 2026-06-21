/**
 * FHIR Communication Resource Service
 * Handles bidirectional messaging with EHR systems using FHIR R4 Communication resource
 * Supports sending/receiving messages to/from integrated EHR systems
 */

import { storage } from "../storage";
import type { SecureMessage, MessageThread, InsertSecureMessage, InsertMessageThread } from "@shared/schema";

// FHIR R4 Communication Resource structure
export interface FHIRCommunication {
  resourceType: "Communication";
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  instantiatesCanonical?: string[];
  basedOn?: Array<{ reference: string }>;
  partOf?: Array<{ reference: string }>;
  inResponseTo?: Array<{ reference: string }>;
  status: "preparation" | "in-progress" | "not-done" | "on-hold" | "stopped" | "completed" | "entered-in-error" | "unknown";
  statusReason?: { coding: Array<{ system: string; code: string; display: string }> };
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  priority?: "routine" | "urgent" | "asap" | "stat";
  medium?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  subject?: { reference: string; display?: string };
  topic?: { text: string };
  about?: Array<{ reference: string }>;
  encounter?: { reference: string };
  sent?: string;
  received?: string;
  recipient?: Array<{ reference: string; display?: string }>;
  sender?: { reference: string; display?: string };
  reasonCode?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  payload?: Array<{
    contentString?: string;
    contentAttachment?: {
      contentType: string;
      data?: string;
      url?: string;
      title?: string;
    };
    contentReference?: { reference: string };
  }>;
  note?: Array<{ text: string }>;
}

// FHIR Bundle for batch operations
export interface FHIRBundle {
  resourceType: "Bundle";
  type: "searchset" | "collection" | "message";
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRCommunication;
    search?: { mode: "match" | "include" };
  }>;
}

// EHR Source information
interface EHRSource {
  id: string;
  name: string;
  system: string;
  fhirEndpoint?: string;
}

class FHIRMessagingService {
  private ehrSources: Map<string, EHRSource> = new Map();

  constructor() {
    // Initialize known EHR sources
    this.ehrSources.set("fastenhealth", {
      id: "fastenhealth",
      name: "Fasten Health",
      system: "urn:oid:2.16.840.1.113883.4.6",
      fhirEndpoint: "https://api.fastenhealth.com/fhir/R4",
    });
    console.log("[FHIRMessaging] Service initialized — all connections via Fasten Health");
  }

  /**
   * Convert internal message to FHIR Communication resource
   */
  messageToFHIR(message: SecureMessage, thread: MessageThread): FHIRCommunication {
    const fhirComm: FHIRCommunication = {
      resourceType: "Communication",
      id: message.id,
      meta: {
        lastUpdated: message.createdAt,
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-communication"],
      },
      identifier: [
        {
          system: "urn:tabula-medica:communication",
          value: message.id,
        },
      ],
      status: message.isRead ? "completed" : "in-progress",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/communication-category",
              code: this.mapThreadTypeToFHIRCategory(thread.threadType),
              display: this.getThreadTypeDisplay(thread.threadType),
            },
          ],
        },
      ],
      priority: this.mapPriorityToFHIR(thread.priority),
      medium: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
              code: "ELECTRONIC",
              display: "Electronic data",
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${thread.participants.find(p => p.role === "patient")?.id || "unknown"}`,
      },
      topic: {
        text: thread.subject,
      },
      sent: message.createdAt,
      sender: {
        reference: `${this.mapRoleToFHIRReference(message.senderRole)}/${message.senderId}`,
        display: message.senderName,
      },
      recipient: thread.participants
        .filter(p => p.id !== message.senderId)
        .map(p => ({
          reference: `${this.mapRoleToFHIRReference(p.role)}/${p.id}`,
          display: p.name,
        })),
      payload: [
        {
          contentString: message.content,
        },
      ],
    };

    // Add attachments as additional payloads
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        fhirComm.payload!.push({
          contentAttachment: {
            contentType: attachment.fileType,
            url: attachment.objectPath,
            title: attachment.fileName,
          },
        });
      }
    }

    return fhirComm;
  }

  /**
   * Convert FHIR Communication resource to internal message format
   */
  fhirToMessage(fhirComm: FHIRCommunication, threadId: string): InsertSecureMessage {
    const content = fhirComm.payload?.find(p => p.contentString)?.contentString || "";
    const senderRef = fhirComm.sender?.reference || "";
    const [senderType, senderId] = senderRef.split("/");

    return {
      threadId,
      senderId: senderId || "external",
      senderName: fhirComm.sender?.display || "External Provider",
      senderRole: this.mapFHIRReferenceToRole(senderType),
      content,
    };
  }

  /**
   * Search for Communications from external EHR system
   */
  async searchExternalCommunications(
    patientId: string,
    ehrConnectionId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      category?: string;
    }
  ): Promise<FHIRBundle> {
    // In production, this would make a FHIR API call to the EHR endpoint
    // For now, return mock data representing external messages
    const mockCommunications: FHIRCommunication[] = [
      {
        resourceType: "Communication",
        id: `ehr-msg-${Date.now()}-1`,
        status: "completed",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/communication-category",
                code: "notification",
                display: "Notification",
              },
            ],
          },
        ],
        priority: "routine",
        subject: { reference: `Patient/${patientId}` },
        topic: { text: "Lab Results Available" },
        sent: new Date(Date.now() - 3600000).toISOString(),
        sender: {
          reference: "Practitioner/ext-dr-smith",
          display: "Dr. Elizabeth Smith",
        },
        payload: [
          {
            contentString: "Your recent blood work results are now available. Please review them in your patient portal.",
          },
        ],
      },
      {
        resourceType: "Communication",
        id: `ehr-msg-${Date.now()}-2`,
        status: "completed",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/communication-category",
                code: "reminder",
                display: "Reminder",
              },
            ],
          },
        ],
        priority: "routine",
        subject: { reference: `Patient/${patientId}` },
        topic: { text: "Appointment Reminder" },
        sent: new Date(Date.now() - 86400000).toISOString(),
        sender: {
          reference: "Organization/hospital-scheduling",
          display: "Metro General Hospital",
        },
        payload: [
          {
            contentString: "This is a reminder about your upcoming appointment scheduled for next week.",
          },
        ],
      },
    ];

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: mockCommunications.length,
      entry: mockCommunications.map(comm => ({
        fullUrl: `Communication/${comm.id}`,
        resource: comm,
        search: { mode: "match" },
      })),
    };
  }

  /**
   * Send a message to an external EHR system
   */
  async sendToEHR(
    message: SecureMessage,
    thread: MessageThread,
    ehrConnectionId: string
  ): Promise<{ success: boolean; ehrMessageId?: string; error?: string }> {
    try {
      const fhirComm = this.messageToFHIR(message, thread);

      // In production, this would POST to the EHR's FHIR endpoint
      // POST /Communication to the EHR's FHIR server
      console.log(`[FHIRMessaging] Would send to EHR ${ehrConnectionId}:`, fhirComm.topic?.text);

      // Simulate successful send
      return {
        success: true,
        ehrMessageId: `ehr-${ehrConnectionId}-${Date.now()}`,
      };
    } catch (error) {
      console.error("[FHIRMessaging] Error sending to EHR:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Import messages from external EHR into internal thread
   */
  async importFromEHR(
    patientId: string,
    ehrConnectionId: string,
    targetThreadId?: string
  ): Promise<{
    imported: number;
    threadId: string;
    messages: SecureMessage[];
  }> {
    const bundle = await this.searchExternalCommunications(patientId, ehrConnectionId);
    const importedMessages: SecureMessage[] = [];

    // Create or get thread
    let threadId = targetThreadId;
    if (!threadId) {
      const newThread: InsertMessageThread = {
        patientId,
        subject: "Messages from External EHR",
        threadType: "general",
        priority: "normal",
        createdBy: patientId,
        participants: [
          { id: patientId, name: "Patient", role: "patient" },
          { id: "external-provider", name: "External Care Team", role: "provider" },
        ],
      };
      const created = await storage.createMessageThread(newThread);
      threadId = created.id;
    }

    // Import each message
    if (bundle.entry) {
      for (const entry of bundle.entry) {
        const fhirComm = entry.resource;
        const messageData = this.fhirToMessage(fhirComm, threadId);

        // Check if message already imported (by ehrMessageId)
        // In production, would check storage for existing ehrMessageId
        const created = await storage.createSecureMessage(messageData);
        importedMessages.push(created);
      }
    }

    return {
      imported: importedMessages.length,
      threadId,
      messages: importedMessages,
    };
  }

  /**
   * Get sync status with EHR systems
   */
  async getSyncStatus(patientId: string): Promise<Array<{
    ehrId: string;
    ehrName: string;
    lastSync: string | null;
    pendingInbound: number;
    pendingOutbound: number;
    status: "connected" | "syncing" | "error" | "disconnected";
  }>> {
    // In production, would check actual connection status
    return [
      {
        ehrId: "fastenhealth",
        ehrName: "Fasten Health",
        lastSync: new Date(Date.now() - 3600000).toISOString(),
        pendingInbound: 2,
        pendingOutbound: 0,
        status: "connected",
      },
    ];
  }

  // Helper methods for FHIR mapping
  private mapThreadTypeToFHIRCategory(threadType: string): string {
    const mapping: Record<string, string> = {
      general: "notification",
      prescription_request: "prescription",
      appointment_follow_up: "reminder",
      test_results: "notification",
      urgent: "alert",
      billing: "instruction",
    };
    return mapping[threadType] || "notification";
  }

  private getThreadTypeDisplay(threadType: string): string {
    const displays: Record<string, string> = {
      general: "General Communication",
      prescription_request: "Prescription Request",
      appointment_follow_up: "Appointment Follow-up",
      test_results: "Test Results",
      urgent: "Urgent Communication",
      billing: "Billing",
    };
    return displays[threadType] || "General";
  }

  private mapPriorityToFHIR(priority: string): "routine" | "urgent" | "asap" | "stat" {
    const mapping: Record<string, "routine" | "urgent" | "asap" | "stat"> = {
      normal: "routine",
      high: "urgent",
      urgent: "asap",
    };
    return mapping[priority] || "routine";
  }

  private mapRoleToFHIRReference(role: string): string {
    const mapping: Record<string, string> = {
      patient: "Patient",
      provider: "Practitioner",
      nurse: "Practitioner",
      specialist: "Practitioner",
      care_coordinator: "Practitioner",
      caregiver: "RelatedPerson",
    };
    return mapping[role] || "Practitioner";
  }

  private mapFHIRReferenceToRole(fhirType: string): "patient" | "provider" | "nurse" | "care_coordinator" | "caregiver" | "specialist" {
    const mapping: Record<string, "patient" | "provider" | "nurse" | "care_coordinator" | "caregiver" | "specialist"> = {
      Patient: "patient",
      Practitioner: "provider",
      RelatedPerson: "caregiver",
      Organization: "provider",
    };
    return mapping[fhirType] || "provider";
  }
}

export const fhirMessaging = new FHIRMessagingService();
