import { logPhiAccess } from "../security/hipaa-audit";

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  organization: string;
  email: string;
  npi?: string;
}

export interface SharedDocument {
  id: string;
  name: string;
  type: "summary" | "lab_result" | "imaging" | "prescription" | "referral" | "other";
  uploadedAt: string;
  size: number;
  mimeType: string;
}

export interface CommunicationMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderOrganization: string;
  content: string;
  priority: "routine" | "urgent" | "stat";
  createdAt: string;
  readAt?: string;
  attachments: SharedDocument[];
}

export interface CommunicationThread {
  id: string;
  patientId: string;
  patientName: string;
  subject: string;
  category: "consultation" | "referral" | "care_coordination" | "follow_up" | "urgent_concern";
  participants: Provider[];
  messages: CommunicationMessage[];
  status: "open" | "resolved" | "pending_response";
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface AuditEntry {
  id: string;
  threadId: string;
  action: "thread_created" | "message_sent" | "document_shared" | "document_viewed" | "message_read" | "participant_added" | "thread_resolved";
  performedBy: string;
  performedByName: string;
  targetResourceType: "thread" | "message" | "document";
  targetResourceId: string;
  patientId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface PatientSummary {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentVisits: Array<{ date: string; provider: string; reason: string }>;
  generatedAt: string;
}

class ProviderCommunicationService {
  private threads: Map<string, CommunicationThread> = new Map();
  private auditLog: AuditEntry[] = [];
  private providers: Map<string, Provider> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[ProviderCommunication] Service initialized");
  }

  private initializeSampleData(): void {
    const providers: Provider[] = [
      { id: "prov-001", name: "Dr. Sarah Chen", specialty: "Internal Medicine", organization: "City Medical Center", email: "s.chen@citymed.org", npi: "1234567890" },
      { id: "prov-002", name: "Dr. Michael Torres", specialty: "Cardiology", organization: "Heart Care Associates", email: "m.torres@heartcare.com", npi: "0987654321" },
      { id: "prov-003", name: "Dr. Emily Watson", specialty: "Endocrinology", organization: "Diabetes & Metabolism Clinic", email: "e.watson@diabetesclinic.org", npi: "1122334455" },
      { id: "prov-004", name: "Dr. James Lee", specialty: "Nephrology", organization: "Kidney Care Center", email: "j.lee@kidneycare.com", npi: "5544332211" },
      { id: "prov-current", name: "Dr. Current Provider", specialty: "Primary Care", organization: "Primary Care Associates", email: "current@primarycare.org", npi: "9988776655" }
    ];

    providers.forEach(p => this.providers.set(p.id, p));

    const thread1: CommunicationThread = {
      id: "thread-001",
      patientId: "patient-001",
      patientName: "John Smith",
      subject: "Cardiology Consultation - Elevated BP",
      category: "consultation",
      participants: [providers[0], providers[1], providers[4]],
      status: "open",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      lastMessageAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      messages: [
        {
          id: "msg-001",
          threadId: "thread-001",
          senderId: "prov-001",
          senderName: "Dr. Sarah Chen",
          senderOrganization: "City Medical Center",
          content: "I'm referring this patient for cardiology evaluation. Patient has persistently elevated blood pressure (avg 155/95) despite being on Lisinopril 20mg daily for the past 3 months. Recent labs show normal kidney function. Would appreciate your assessment.",
          priority: "routine",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          attachments: [
            { id: "doc-001", name: "BP_Log_LastMonth.pdf", type: "other", uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), size: 245000, mimeType: "application/pdf" }
          ]
        },
        {
          id: "msg-002",
          threadId: "thread-001",
          senderId: "prov-002",
          senderName: "Dr. Michael Torres",
          senderOrganization: "Heart Care Associates",
          content: "Thank you for the referral. I reviewed the BP log and agree this warrants further evaluation. I'd like to order an echocardiogram and 24-hour ambulatory BP monitoring. Can you share the most recent metabolic panel?",
          priority: "routine",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          attachments: []
        },
        {
          id: "msg-003",
          threadId: "thread-001",
          senderId: "prov-001",
          senderName: "Dr. Sarah Chen",
          senderOrganization: "City Medical Center",
          content: "Attached is the recent metabolic panel from last week. All values within normal limits except slightly elevated fasting glucose (108 mg/dL). Patient has a family history of hypertension and type 2 diabetes.",
          priority: "routine",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          attachments: [
            { id: "doc-002", name: "Metabolic_Panel_Results.pdf", type: "lab_result", uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), size: 156000, mimeType: "application/pdf" }
          ]
        }
      ]
    };

    const thread2: CommunicationThread = {
      id: "thread-002",
      patientId: "patient-001",
      patientName: "John Smith",
      subject: "Urgent: Acute Kidney Injury Concern",
      category: "urgent_concern",
      participants: [providers[0], providers[3], providers[4]],
      status: "pending_response",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      messages: [
        {
          id: "msg-004",
          threadId: "thread-002",
          senderId: "prov-001",
          senderName: "Dr. Sarah Chen",
          senderOrganization: "City Medical Center",
          content: "URGENT: Patient presented today with fatigue and decreased urine output. Creatinine jumped from 1.1 to 2.4 mg/dL over the past week. Patient recently started NSAID for back pain. Need nephrology consult ASAP.",
          priority: "stat",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          attachments: [
            { id: "doc-003", name: "Lab_Comparison.pdf", type: "lab_result", uploadedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), size: 198000, mimeType: "application/pdf" }
          ]
        },
        {
          id: "msg-005",
          threadId: "thread-002",
          senderId: "prov-004",
          senderName: "Dr. James Lee",
          senderOrganization: "Kidney Care Center",
          content: "Thank you for the urgent referral. This appears to be NSAID-induced acute kidney injury. Please discontinue the NSAID immediately, ensure adequate hydration, and hold the Lisinopril temporarily. I can see the patient tomorrow morning at 8 AM. Please send the complete medication list.",
          priority: "urgent",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          attachments: []
        }
      ]
    };

    this.threads.set(thread1.id, thread1);
    this.threads.set(thread2.id, thread2);

    this.auditLog = [
      { id: "audit-001", threadId: "thread-001", action: "thread_created", performedBy: "prov-001", performedByName: "Dr. Sarah Chen", targetResourceType: "thread", targetResourceId: "thread-001", patientId: "patient-001", details: "Created consultation thread for cardiology referral", timestamp: thread1.createdAt },
      { id: "audit-002", threadId: "thread-001", action: "document_shared", performedBy: "prov-001", performedByName: "Dr. Sarah Chen", targetResourceType: "document", targetResourceId: "doc-001", patientId: "patient-001", details: "Shared document: BP_Log_LastMonth.pdf", timestamp: thread1.createdAt },
      { id: "audit-003", threadId: "thread-001", action: "message_sent", performedBy: "prov-002", performedByName: "Dr. Michael Torres", targetResourceType: "message", targetResourceId: "msg-002", patientId: "patient-001", details: "Sent response requesting additional information", timestamp: thread1.messages[1].createdAt },
      { id: "audit-004", threadId: "thread-002", action: "thread_created", performedBy: "prov-001", performedByName: "Dr. Sarah Chen", targetResourceType: "thread", targetResourceId: "thread-002", patientId: "patient-001", details: "Created urgent concern thread for acute kidney injury", timestamp: thread2.createdAt },
      { id: "audit-005", threadId: "thread-002", action: "message_sent", performedBy: "prov-004", performedByName: "Dr. James Lee", targetResourceType: "message", targetResourceId: "msg-005", patientId: "patient-001", details: "Sent urgent response with treatment recommendations", timestamp: thread2.messages[1].createdAt }
    ];
  }

  async getThreads(providerId: string, patientId?: string): Promise<CommunicationThread[]> {
    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "CommunicationThread",
      patientId: patientId || "all",
      details: `Provider ${providerId} retrieved communication threads`
    });

    const threads = Array.from(this.threads.values());
    
    if (patientId) {
      return threads.filter(t => t.patientId === patientId && t.participants.some(p => p.id === providerId));
    }
    
    return threads.filter(t => t.participants.some(p => p.id === providerId));
  }

  async getThread(threadId: string, providerId: string): Promise<CommunicationThread | null> {
    const thread = this.threads.get(threadId);
    if (!thread || !thread.participants.some(p => p.id === providerId)) {
      return null;
    }

    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "CommunicationThread",
      patientId: thread.patientId,
      details: `Provider ${providerId} viewed thread ${threadId}`
    });

    return thread;
  }

  async createThread(
    providerId: string,
    patientId: string,
    patientName: string,
    subject: string,
    category: CommunicationThread["category"],
    initialMessage: string,
    priority: CommunicationMessage["priority"],
    recipientIds: string[],
    attachments: SharedDocument[] = []
  ): Promise<CommunicationThread> {
    const sender = this.providers.get(providerId);
    if (!sender) throw new Error("Provider not found");

    const participants = [sender];
    for (const id of recipientIds) {
      const recipient = this.providers.get(id);
      if (recipient) participants.push(recipient);
    }

    const now = new Date().toISOString();
    const threadId = `thread-${Date.now()}`;
    const messageId = `msg-${Date.now()}`;

    const message: CommunicationMessage = {
      id: messageId,
      threadId,
      senderId: providerId,
      senderName: sender.name,
      senderOrganization: sender.organization,
      content: initialMessage,
      priority,
      createdAt: now,
      attachments
    };

    const thread: CommunicationThread = {
      id: threadId,
      patientId,
      patientName,
      subject,
      category,
      participants,
      messages: [message],
      status: "open",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now
    };

    this.threads.set(threadId, thread);

    this.addAuditEntry({
      threadId,
      action: "thread_created",
      performedBy: providerId,
      performedByName: sender.name,
      targetResourceType: "thread",
      targetResourceId: threadId,
      patientId,
      details: `Created ${category} thread: ${subject}`
    });

    if (attachments.length > 0) {
      for (const doc of attachments) {
        this.addAuditEntry({
          threadId,
          action: "document_shared",
          performedBy: providerId,
          performedByName: sender.name,
          targetResourceType: "document",
          targetResourceId: doc.id,
          patientId,
          details: `Shared document: ${doc.name}`
        });
      }
    }

    logPhiAccess({
      userId: providerId,
      action: "write",
      resourceType: "CommunicationThread",
      patientId,
      details: `Created new communication thread: ${subject}`
    });

    return thread;
  }

  async sendMessage(
    threadId: string,
    providerId: string,
    content: string,
    priority: CommunicationMessage["priority"],
    attachments: SharedDocument[] = []
  ): Promise<CommunicationMessage> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");

    const sender = this.providers.get(providerId);
    if (!sender) throw new Error("Provider not found");

    if (!thread.participants.some(p => p.id === providerId)) {
      throw new Error("Provider is not a participant in this thread");
    }

    const now = new Date().toISOString();
    const messageId = `msg-${Date.now()}`;

    const message: CommunicationMessage = {
      id: messageId,
      threadId,
      senderId: providerId,
      senderName: sender.name,
      senderOrganization: sender.organization,
      content,
      priority,
      createdAt: now,
      attachments
    };

    thread.messages.push(message);
    thread.updatedAt = now;
    thread.lastMessageAt = now;
    thread.status = "open";

    this.addAuditEntry({
      threadId,
      action: "message_sent",
      performedBy: providerId,
      performedByName: sender.name,
      targetResourceType: "message",
      targetResourceId: messageId,
      patientId: thread.patientId,
      details: `Sent message (${priority} priority)`
    });

    if (attachments.length > 0) {
      for (const doc of attachments) {
        this.addAuditEntry({
          threadId,
          action: "document_shared",
          performedBy: providerId,
          performedByName: sender.name,
          targetResourceType: "document",
          targetResourceId: doc.id,
          patientId: thread.patientId,
          details: `Shared document: ${doc.name}`
        });
      }
    }

    logPhiAccess({
      userId: providerId,
      action: "write",
      resourceType: "CommunicationMessage",
      patientId: thread.patientId,
      details: `Sent message in thread ${threadId}`
    });

    return message;
  }

  async resolveThread(threadId: string, providerId: string): Promise<CommunicationThread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");

    const provider = this.providers.get(providerId);
    if (!provider) throw new Error("Provider not found");

    thread.status = "resolved";
    thread.updatedAt = new Date().toISOString();

    this.addAuditEntry({
      threadId,
      action: "thread_resolved",
      performedBy: providerId,
      performedByName: provider.name,
      targetResourceType: "thread",
      targetResourceId: threadId,
      patientId: thread.patientId,
      details: "Thread marked as resolved"
    });

    logPhiAccess({
      userId: providerId,
      action: "write",
      resourceType: "CommunicationThread",
      patientId: thread.patientId,
      details: `Resolved thread ${threadId}`
    });

    return thread;
  }

  async getAuditTrail(threadId?: string, patientId?: string): Promise<AuditEntry[]> {
    let entries = [...this.auditLog];

    if (threadId) {
      entries = entries.filter(e => e.threadId === threadId);
    }

    if (patientId) {
      entries = entries.filter(e => e.patientId === patientId);
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async generatePatientSummary(patientId: string, providerId: string): Promise<PatientSummary> {
    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "PatientSummary",
      patientId,
      details: `Generated patient summary for sharing`
    });

    return {
      patientId,
      patientName: "John Smith",
      dateOfBirth: "1965-03-15",
      mrn: "MRN-123456",
      conditions: [
        "Essential Hypertension (I10)",
        "Prediabetes (R73.03)",
        "Chronic Low Back Pain (M54.5)"
      ],
      medications: [
        "Lisinopril 20mg daily",
        "Metformin 500mg twice daily",
        "Ibuprofen 400mg as needed (HOLD)"
      ],
      allergies: ["Penicillin - rash", "Sulfa drugs - hives"],
      recentVisits: [
        { date: "2025-01-15", provider: "Dr. Sarah Chen", reason: "Follow-up for hypertension" },
        { date: "2025-01-10", provider: "Dr. James Lee", reason: "Nephrology consult - AKI" },
        { date: "2024-12-20", provider: "Dr. Sarah Chen", reason: "Annual physical exam" }
      ],
      generatedAt: new Date().toISOString()
    };
  }

  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providers.values());
  }

  private addAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): void {
    this.auditLog.push({
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    });
  }
}

export const providerCommunicationService = new ProviderCommunicationService();
