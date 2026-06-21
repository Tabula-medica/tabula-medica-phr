export interface DocumentAttachment {
  id: string;
  fileName: string;
  fileType: "lab_result" | "referral_note" | "prescription" | "imaging" | "care_plan" | "discharge_summary" | "insurance_eob" | "other";
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  description: string;
  isConfidential: boolean;
}

export interface AppointmentProposal {
  id: string;
  providerId: string;
  providerName: string;
  appointmentType: "in_person" | "telehealth" | "phone";
  proposedSlots: { date: string; time: string; duration: number }[];
  selectedSlot: { date: string; time: string; duration: number } | null;
  status: "proposed" | "confirmed" | "rescheduled" | "cancelled";
  location: string;
  reason: string;
  notes: string;
  createdAt: string;
}

export interface CareAdvice {
  id: string;
  category: "medication" | "lifestyle" | "follow_up" | "symptom_management" | "preventive" | "nutrition" | "exercise";
  urgency: "routine" | "important" | "time_sensitive";
  summary: string;
  details: string;
  suggestedActions: string[];
  expiresAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider" | "nurse" | "admin" | "care_coordinator";
  content: string;
  contentType: "text" | "document" | "appointment" | "advice" | "system";
  isEncrypted: boolean;
  readBy: string[];
  attachment?: DocumentAttachment;
  appointmentProposal?: AppointmentProposal;
  careAdvice?: CareAdvice;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  patientId: string;
  type: "direct" | "group" | "care_team" | "urgent";
  subject: string;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  encryptionStatus: "encrypted" | "in_transit" | "at_rest";
  priority: "normal" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  role: "patient" | "provider" | "nurse" | "admin" | "care_coordinator";
  avatar?: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface CareTeamMemberProfile {
  id: string;
  name: string;
  role: "provider" | "nurse" | "care_coordinator";
  specialty: string;
  department: string;
  phone: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
  availability: { day: string; hours: string }[];
  nextAvailable: string;
  bio: string;
  languages: string[];
  acceptingMessages: boolean;
  averageResponseTime: string;
  recentMessageCount: number;
  sharedDocuments: number;
  upcomingAppointments: number;
}

export interface MessagingDashboard {
  totalConversations: number;
  unreadMessages: number;
  activeThreads: number;
  urgentMessages: number;
  careTeamMembers: number;
  averageResponseTime: string;
  sharedDocuments: number;
  upcomingAppointments: number;
  pendingAdvice: number;
  recentActivity: { date: string; count: number }[];
}

class SecureMessagingService {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private careTeamProfiles: Map<string, CareTeamMemberProfile> = new Map();
  private appointments: Map<string, AppointmentProposal> = new Map();
  private documents: Map<string, DocumentAttachment> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const now = new Date();
    const patientId = "patient-001";

    this.careTeamProfiles.set("prov-001", {
      id: "prov-001", name: "Dr. Sarah Smith", role: "provider",
      specialty: "Internal Medicine", department: "Primary Care",
      phone: "(555) 234-5678", email: "s.smith@clinic.example",
      isOnline: true, lastSeen: now.toISOString(),
      availability: [
        { day: "Monday", hours: "8:00 AM - 4:00 PM" },
        { day: "Tuesday", hours: "8:00 AM - 4:00 PM" },
        { day: "Wednesday", hours: "10:00 AM - 6:00 PM" },
        { day: "Thursday", hours: "8:00 AM - 4:00 PM" },
        { day: "Friday", hours: "8:00 AM - 12:00 PM" },
      ],
      nextAvailable: new Date(now.getTime() + 86400000).toISOString(),
      bio: "Board-certified internist with 15 years of experience in chronic disease management and preventive care.",
      languages: ["English", "Spanish"],
      acceptingMessages: true, averageResponseTime: "1.5 hours",
      recentMessageCount: 8, sharedDocuments: 3, upcomingAppointments: 1,
    });

    this.careTeamProfiles.set("prov-002", {
      id: "prov-002", name: "Dr. Michael Chen", role: "provider",
      specialty: "Endocrinology", department: "Specialty Care",
      phone: "(555) 345-6789", email: "m.chen@clinic.example",
      isOnline: false, lastSeen: new Date(now.getTime() - 3600000).toISOString(),
      availability: [
        { day: "Monday", hours: "9:00 AM - 5:00 PM" },
        { day: "Wednesday", hours: "9:00 AM - 5:00 PM" },
        { day: "Friday", hours: "9:00 AM - 3:00 PM" },
      ],
      nextAvailable: new Date(now.getTime() + 172800000).toISOString(),
      bio: "Endocrinologist specializing in diabetes management, thyroid disorders, and metabolic conditions.",
      languages: ["English", "Mandarin"],
      acceptingMessages: true, averageResponseTime: "4 hours",
      recentMessageCount: 2, sharedDocuments: 1, upcomingAppointments: 1,
    });

    this.careTeamProfiles.set("nurse-001", {
      id: "nurse-001", name: "Nurse Emily Johnson", role: "nurse",
      specialty: "Patient Care Coordination", department: "Primary Care",
      phone: "(555) 456-7890", email: "e.johnson@clinic.example",
      isOnline: true, lastSeen: now.toISOString(),
      availability: [
        { day: "Monday", hours: "7:00 AM - 3:00 PM" },
        { day: "Tuesday", hours: "7:00 AM - 3:00 PM" },
        { day: "Wednesday", hours: "7:00 AM - 3:00 PM" },
        { day: "Thursday", hours: "7:00 AM - 3:00 PM" },
        { day: "Friday", hours: "7:00 AM - 3:00 PM" },
      ],
      nextAvailable: new Date(now.getTime() + 43200000).toISOString(),
      bio: "Registered nurse with expertise in patient education, care coordination, and preventive health screenings.",
      languages: ["English"],
      acceptingMessages: true, averageResponseTime: "45 minutes",
      recentMessageCount: 5, sharedDocuments: 2, upcomingAppointments: 2,
    });

    this.careTeamProfiles.set("coord-001", {
      id: "coord-001", name: "Maria Garcia", role: "care_coordinator",
      specialty: "Care Plan Management", department: "Care Coordination",
      phone: "(555) 567-8901", email: "m.garcia@clinic.example",
      isOnline: false, lastSeen: new Date(now.getTime() - 7200000).toISOString(),
      availability: [
        { day: "Monday", hours: "8:30 AM - 5:00 PM" },
        { day: "Tuesday", hours: "8:30 AM - 5:00 PM" },
        { day: "Wednesday", hours: "8:30 AM - 5:00 PM" },
        { day: "Thursday", hours: "8:30 AM - 5:00 PM" },
      ],
      nextAvailable: new Date(now.getTime() + 129600000).toISOString(),
      bio: "Certified care coordinator focused on multi-disciplinary care planning, referral management, and patient advocacy.",
      languages: ["English", "Spanish", "Portuguese"],
      acceptingMessages: true, averageResponseTime: "2 hours",
      recentMessageCount: 3, sharedDocuments: 1, upcomingAppointments: 0,
    });

    const participants: Record<string, Participant> = {
      patient: { id: patientId, name: "Alex Thompson", role: "patient", isOnline: true, lastSeen: now.toISOString() },
      drSmith: { id: "prov-001", name: "Dr. Sarah Smith", role: "provider", isOnline: true, lastSeen: now.toISOString() },
      drChen: { id: "prov-002", name: "Dr. Michael Chen", role: "provider", isOnline: false, lastSeen: new Date(now.getTime() - 3600000).toISOString() },
      nurseJohnson: { id: "nurse-001", name: "Nurse Emily Johnson", role: "nurse", isOnline: true, lastSeen: now.toISOString() },
      careCoord: { id: "coord-001", name: "Maria Garcia", role: "care_coordinator", isOnline: false, lastSeen: new Date(now.getTime() - 7200000).toISOString() },
    };

    const doc1: DocumentAttachment = {
      id: "doc-001", fileName: "Metabolic_Panel_Results_2026-02.pdf", fileType: "lab_result",
      fileSize: "245 KB", uploadedBy: "prov-002", uploadedAt: new Date(now.getTime() - 7200000).toISOString(),
      description: "Complete metabolic panel results from February 2026", isConfidential: false,
    };
    const doc2: DocumentAttachment = {
      id: "doc-002", fileName: "Nutrition_Counseling_Referral.pdf", fileType: "referral_note",
      fileSize: "128 KB", uploadedBy: "prov-001", uploadedAt: new Date(now.getTime() - 255600000).toISOString(),
      description: "Referral to nutrition counseling for dietary management", isConfidential: false,
    };
    const doc3: DocumentAttachment = {
      id: "doc-003", fileName: "BP_Monitoring_Protocol.pdf", fileType: "care_plan",
      fileSize: "89 KB", uploadedBy: "prov-001", uploadedAt: new Date(now.getTime() - 43200000).toISOString(),
      description: "Updated blood pressure monitoring and management protocol", isConfidential: false,
    };
    this.documents.set(doc1.id, doc1);
    this.documents.set(doc2.id, doc2);
    this.documents.set(doc3.id, doc3);

    const appt1: AppointmentProposal = {
      id: "appt-001", providerId: "prov-002", providerName: "Dr. Michael Chen",
      appointmentType: "in_person",
      proposedSlots: [
        { date: "2026-02-20", time: "10:00 AM", duration: 30 },
        { date: "2026-02-22", time: "2:00 PM", duration: 30 },
        { date: "2026-02-24", time: "11:00 AM", duration: 30 },
      ],
      selectedSlot: null, status: "proposed",
      location: "Specialty Care Center, Suite 305",
      reason: "Discuss glucose levels and treatment options",
      notes: "Please fast for 8 hours before appointment if possible.",
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
    };
    const appt2: AppointmentProposal = {
      id: "appt-002", providerId: "nurse-001", providerName: "Nurse Emily Johnson",
      appointmentType: "in_person",
      proposedSlots: [
        { date: "2026-03-15", time: "8:30 AM", duration: 15 },
        { date: "2026-03-17", time: "9:00 AM", duration: 15 },
      ],
      selectedSlot: null, status: "proposed",
      location: "Lab & Diagnostics Center, 1st Floor",
      reason: "Fasting bloodwork for annual wellness visit",
      notes: "No food or drink (except water) for 12 hours prior.",
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
    };
    this.appointments.set(appt1.id, appt1);
    this.appointments.set(appt2.id, appt2);

    const conv1Messages: Message[] = [
      {
        id: "msg-001", conversationId: "conv-001", senderId: patientId, senderName: "Alex Thompson",
        senderRole: "patient", content: "Hi Dr. Smith, I wanted to follow up on my recent blood pressure readings. They've been averaging around 135/88 for the past week.",
        contentType: "text", isEncrypted: true, readBy: [patientId, "prov-001"],
        createdAt: new Date(now.getTime() - 86400000).toISOString(), updatedAt: new Date(now.getTime() - 86400000).toISOString(),
      },
      {
        id: "msg-002", conversationId: "conv-001", senderId: "prov-001", senderName: "Dr. Sarah Smith",
        senderRole: "provider", content: "Thank you for sharing that, Alex. Those readings are slightly elevated. Have you been taking your Lisinopril as prescribed? Also, how has your salt intake been this past week?",
        contentType: "text", isEncrypted: true, readBy: ["prov-001", patientId],
        createdAt: new Date(now.getTime() - 82800000).toISOString(), updatedAt: new Date(now.getTime() - 82800000).toISOString(),
      },
      {
        id: "msg-003", conversationId: "conv-001", senderId: patientId, senderName: "Alex Thompson",
        senderRole: "patient", content: "Yes, I've been consistent with the Lisinopril. I did have some higher sodium meals over the weekend though. I'll work on reducing that. Should I adjust anything else?",
        contentType: "text", isEncrypted: true, readBy: [patientId],
        createdAt: new Date(now.getTime() - 79200000).toISOString(), updatedAt: new Date(now.getTime() - 79200000).toISOString(),
      },
      {
        id: "msg-004", conversationId: "conv-001", senderId: "prov-001", senderName: "Dr. Sarah Smith",
        senderRole: "provider", content: "That's likely contributing to the elevation. Let's continue monitoring for another week with a focus on sodium reduction. Aim for under 2,300mg daily. If readings don't improve, we may need to adjust your dosage.",
        contentType: "text", isEncrypted: true, readBy: ["prov-001"],
        createdAt: new Date(now.getTime() - 43200000).toISOString(), updatedAt: new Date(now.getTime() - 43200000).toISOString(),
      },
      {
        id: "msg-005", conversationId: "conv-001", senderId: "prov-001", senderName: "Dr. Sarah Smith",
        senderRole: "provider", content: "I'm sharing the updated BP monitoring protocol for your reference.",
        contentType: "document", isEncrypted: true, readBy: ["prov-001"],
        attachment: doc3,
        createdAt: new Date(now.getTime() - 43100000).toISOString(), updatedAt: new Date(now.getTime() - 43100000).toISOString(),
      },
      {
        id: "msg-006", conversationId: "conv-001", senderId: "prov-001", senderName: "Dr. Sarah Smith",
        senderRole: "provider", content: "Here's my care advice for the coming week:",
        contentType: "advice", isEncrypted: true, readBy: ["prov-001"],
        careAdvice: {
          id: "advice-001", category: "lifestyle", urgency: "important",
          summary: "Blood Pressure Management - Weekly Plan",
          details: "Based on your recent readings of 135/88, here is a focused plan for the next 7 days to help bring your blood pressure closer to our target of under 130/80.",
          suggestedActions: [
            "Limit sodium intake to under 2,300mg daily",
            "Take Lisinopril consistently at the same time each morning",
            "Walk for at least 30 minutes daily",
            "Log BP readings twice daily (morning and evening) in the app",
            "Avoid caffeine after 2 PM",
          ],
          expiresAt: new Date(now.getTime() + 604800000).toISOString(),
        },
        createdAt: new Date(now.getTime() - 43000000).toISOString(), updatedAt: new Date(now.getTime() - 43000000).toISOString(),
      },
    ];

    const conv2Messages: Message[] = [
      {
        id: "msg-007", conversationId: "conv-002", senderId: "nurse-001", senderName: "Nurse Emily Johnson",
        senderRole: "nurse", content: "Hi Alex, this is a reminder that your annual wellness visit is coming up next month. We'll need fasting bloodwork done 3 days before. Would you like to schedule both appointments now?",
        contentType: "text", isEncrypted: true, readBy: ["nurse-001", patientId],
        createdAt: new Date(now.getTime() - 172800000).toISOString(), updatedAt: new Date(now.getTime() - 172800000).toISOString(),
      },
      {
        id: "msg-008", conversationId: "conv-002", senderId: patientId, senderName: "Alex Thompson",
        senderRole: "patient", content: "Yes, that would be great. I prefer morning appointments if possible. What days are available?",
        contentType: "text", isEncrypted: true, readBy: [patientId, "nurse-001"],
        createdAt: new Date(now.getTime() - 169200000).toISOString(), updatedAt: new Date(now.getTime() - 169200000).toISOString(),
      },
      {
        id: "msg-009", conversationId: "conv-002", senderId: "nurse-001", senderName: "Nurse Emily Johnson",
        senderRole: "nurse", content: "Here are the available slots for your bloodwork appointment:",
        contentType: "appointment", isEncrypted: true, readBy: ["nurse-001"],
        appointmentProposal: appt2,
        createdAt: new Date(now.getTime() - 86400000).toISOString(), updatedAt: new Date(now.getTime() - 86400000).toISOString(),
      },
    ];

    const conv3Messages: Message[] = [
      {
        id: "msg-010", conversationId: "conv-003", senderId: "coord-001", senderName: "Maria Garcia",
        senderRole: "care_coordinator", content: "Team update: Alex's care plan has been updated with new BP management goals. Dr. Smith has adjusted the target to <130/80. Please review the updated plan.",
        contentType: "text", isEncrypted: true, readBy: ["coord-001", "prov-001", "nurse-001"],
        createdAt: new Date(now.getTime() - 259200000).toISOString(), updatedAt: new Date(now.getTime() - 259200000).toISOString(),
      },
      {
        id: "msg-011", conversationId: "conv-003", senderId: "prov-001", senderName: "Dr. Sarah Smith",
        senderRole: "provider", content: "I've attached the nutrition counseling referral for Alex.",
        contentType: "document", isEncrypted: true, readBy: ["prov-001", "coord-001", "nurse-001"],
        attachment: doc2,
        createdAt: new Date(now.getTime() - 255600000).toISOString(), updatedAt: new Date(now.getTime() - 255600000).toISOString(),
      },
      {
        id: "msg-012", conversationId: "conv-003", senderId: "nurse-001", senderName: "Nurse Emily Johnson",
        senderRole: "nurse", content: "Will do. I'll reach out to the nutrition team and get Alex scheduled. I'll update the care plan once the appointment is confirmed.",
        contentType: "text", isEncrypted: true, readBy: ["nurse-001", "prov-001"],
        createdAt: new Date(now.getTime() - 252000000).toISOString(), updatedAt: new Date(now.getTime() - 252000000).toISOString(),
      },
    ];

    const conv4Messages: Message[] = [
      {
        id: "msg-013", conversationId: "conv-004", senderId: "prov-002", senderName: "Dr. Michael Chen",
        senderRole: "provider", content: "Alex, I've reviewed your recent lab results from the metabolic panel. Your fasting glucose is at 112 mg/dL, which is in the pre-diabetic range. I'd like to discuss lifestyle modifications and possibly starting Metformin.",
        contentType: "text", isEncrypted: true, readBy: ["prov-002"],
        createdAt: new Date(now.getTime() - 7200000).toISOString(), updatedAt: new Date(now.getTime() - 7200000).toISOString(),
      },
      {
        id: "msg-014", conversationId: "conv-004", senderId: "prov-002", senderName: "Dr. Michael Chen",
        senderRole: "provider", content: "I'm sharing your lab results for your records:",
        contentType: "document", isEncrypted: true, readBy: ["prov-002"],
        attachment: doc1,
        createdAt: new Date(now.getTime() - 7100000).toISOString(), updatedAt: new Date(now.getTime() - 7100000).toISOString(),
      },
      {
        id: "msg-015", conversationId: "conv-004", senderId: "prov-002", senderName: "Dr. Michael Chen",
        senderRole: "provider", content: "Let's schedule a follow-up to discuss your options:",
        contentType: "appointment", isEncrypted: true, readBy: ["prov-002"],
        appointmentProposal: appt1,
        createdAt: new Date(now.getTime() - 3600000).toISOString(), updatedAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        id: "msg-016", conversationId: "conv-004", senderId: "prov-002", senderName: "Dr. Michael Chen",
        senderRole: "provider", content: "In the meantime, here are some recommendations:",
        contentType: "advice", isEncrypted: true, readBy: ["prov-002"],
        careAdvice: {
          id: "advice-002", category: "nutrition", urgency: "important",
          summary: "Pre-Diabetes Lifestyle Modifications",
          details: "Your fasting glucose of 112 mg/dL indicates pre-diabetes. Research shows that lifestyle changes can reduce diabetes risk by up to 58%. Here are evidence-based recommendations while we prepare for your follow-up visit.",
          suggestedActions: [
            "Reduce refined carbohydrate and sugar intake",
            "Aim for 150 minutes of moderate exercise per week",
            "Monitor fasting glucose with home kit every 2-3 days",
            "Increase fiber intake (25-30g daily) through vegetables and whole grains",
            "Maintain regular meal schedule - avoid skipping meals",
            "Limit fruit juice and sweetened beverages",
          ],
          expiresAt: new Date(now.getTime() + 1209600000).toISOString(),
        },
        createdAt: new Date(now.getTime() - 3500000).toISOString(), updatedAt: new Date(now.getTime() - 3500000).toISOString(),
      },
    ];

    const conversations: Conversation[] = [
      {
        id: "conv-001", patientId, type: "direct", subject: "Blood Pressure Follow-up",
        participants: [participants.patient, participants.drSmith],
        lastMessage: conv1Messages[conv1Messages.length - 1], unreadCount: 2, isPinned: true, isArchived: false,
        encryptionStatus: "encrypted", priority: "normal",
        createdAt: new Date(now.getTime() - 604800000).toISOString(), updatedAt: new Date(now.getTime() - 43000000).toISOString(),
      },
      {
        id: "conv-002", patientId, type: "direct", subject: "Annual Wellness Visit Scheduling",
        participants: [participants.patient, participants.nurseJohnson],
        lastMessage: conv2Messages[conv2Messages.length - 1], unreadCount: 1, isPinned: false, isArchived: false,
        encryptionStatus: "encrypted", priority: "normal",
        createdAt: new Date(now.getTime() - 604800000).toISOString(), updatedAt: new Date(now.getTime() - 86400000).toISOString(),
      },
      {
        id: "conv-003", patientId, type: "care_team", subject: "Care Plan Update - BP Management",
        participants: [participants.patient, participants.drSmith, participants.nurseJohnson, participants.careCoord],
        lastMessage: conv3Messages[conv3Messages.length - 1], unreadCount: 0, isPinned: false, isArchived: false,
        encryptionStatus: "encrypted", priority: "normal",
        createdAt: new Date(now.getTime() - 604800000).toISOString(), updatedAt: new Date(now.getTime() - 252000000).toISOString(),
      },
      {
        id: "conv-004", patientId, type: "urgent", subject: "Lab Results Discussion - Glucose Levels",
        participants: [participants.patient, participants.drChen],
        lastMessage: conv4Messages[conv4Messages.length - 1], unreadCount: 3, isPinned: false, isArchived: false,
        encryptionStatus: "encrypted", priority: "urgent",
        createdAt: new Date(now.getTime() - 7200000).toISOString(), updatedAt: new Date(now.getTime() - 3500000).toISOString(),
      },
    ];

    conversations.forEach(c => this.conversations.set(c.id, c));
    this.messages.set("conv-001", conv1Messages);
    this.messages.set("conv-002", conv2Messages);
    this.messages.set("conv-003", conv3Messages);
    this.messages.set("conv-004", conv4Messages);
  }

  getDashboard(patientId: string): MessagingDashboard {
    const convs = Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
    const allParticipants = new Set<string>();
    convs.forEach(c => c.participants.forEach(p => { if (p.role !== "patient") allParticipants.add(p.id); }));

    const allMsgs = convs.flatMap(c => this.messages.get(c.id) || []);
    const docCount = allMsgs.filter(m => m.contentType === "document").length;
    const apptCount = Array.from(this.appointments.values()).filter(a => a.status === "proposed" || a.status === "confirmed").length;
    const adviceCount = allMsgs.filter(m => m.contentType === "advice" && !m.readBy.includes(patientId)).length;

    return {
      totalConversations: convs.length,
      unreadMessages: convs.reduce((sum, c) => sum + c.unreadCount, 0),
      activeThreads: convs.filter(c => !c.isArchived).length,
      urgentMessages: convs.filter(c => c.priority === "urgent" && c.unreadCount > 0).length,
      careTeamMembers: allParticipants.size,
      averageResponseTime: "2.3 hours",
      sharedDocuments: docCount,
      upcomingAppointments: apptCount,
      pendingAdvice: adviceCount,
      recentActivity: [
        { date: "Mon", count: 3 }, { date: "Tue", count: 5 }, { date: "Wed", count: 2 },
        { date: "Thu", count: 7 }, { date: "Fri", count: 4 }, { date: "Sat", count: 1 }, { date: "Sun", count: 0 },
      ],
    };
  }

  getConversations(patientId: string, filter?: string): Conversation[] {
    let convs = Array.from(this.conversations.values())
      .filter(c => c.patientId === patientId && !c.isArchived);
    if (filter && filter !== "all") {
      convs = convs.filter(c => c.type === filter);
    }
    return convs.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (b.priority === "urgent" && a.priority !== "urgent") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  getMessages(conversationId: string): Message[] {
    return this.messages.get(conversationId) || [];
  }

  sendMessage(conversationId: string, senderId: string, senderName: string, content: string, senderRole?: string): Message {
    const msg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId,
      senderName,
      senderRole: (senderRole as Message["senderRole"]) || "patient",
      content,
      contentType: "text",
      isEncrypted: true,
      readBy: [senderId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = this.messages.get(conversationId) || [];
    existing.push(msg);
    this.messages.set(conversationId, existing);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.lastMessage = msg;
      conv.updatedAt = msg.createdAt;
    }

    return msg;
  }

  shareDocument(conversationId: string, senderId: string, senderName: string, doc: Omit<DocumentAttachment, "id" | "uploadedAt" | "uploadedBy">): Message {
    const attachment: DocumentAttachment = {
      ...doc,
      id: `doc-${Date.now()}`,
      uploadedBy: senderId,
      uploadedAt: new Date().toISOString(),
    };
    this.documents.set(attachment.id, attachment);

    const msg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId,
      senderName,
      senderRole: "provider",
      content: `Shared document: ${attachment.fileName}`,
      contentType: "document",
      isEncrypted: true,
      readBy: [senderId],
      attachment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = this.messages.get(conversationId) || [];
    existing.push(msg);
    this.messages.set(conversationId, existing);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.lastMessage = msg;
      conv.updatedAt = msg.createdAt;
    }

    return msg;
  }

  proposeAppointment(conversationId: string, senderId: string, senderName: string, proposal: Omit<AppointmentProposal, "id" | "createdAt" | "selectedSlot" | "status">): Message {
    const appt: AppointmentProposal = {
      ...proposal,
      id: `appt-${Date.now()}`,
      selectedSlot: null,
      status: "proposed",
      createdAt: new Date().toISOString(),
    };
    this.appointments.set(appt.id, appt);

    const msg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId,
      senderName,
      senderRole: "provider",
      content: `Appointment proposal: ${proposal.reason}`,
      contentType: "appointment",
      isEncrypted: true,
      readBy: [senderId],
      appointmentProposal: appt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = this.messages.get(conversationId) || [];
    existing.push(msg);
    this.messages.set(conversationId, existing);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.lastMessage = msg;
      conv.updatedAt = msg.createdAt;
    }

    return msg;
  }

  confirmAppointment(appointmentId: string, selectedSlot: { date: string; time: string; duration: number }): AppointmentProposal | null {
    const appt = this.appointments.get(appointmentId);
    if (!appt) return null;
    appt.selectedSlot = selectedSlot;
    appt.status = "confirmed";

    this.messages.forEach(msgs => {
      msgs.forEach(m => {
        if (m.appointmentProposal?.id === appointmentId) {
          m.appointmentProposal = appt;
        }
      });
    });

    return appt;
  }

  sendCareAdvice(conversationId: string, senderId: string, senderName: string, advice: Omit<CareAdvice, "id">): Message {
    const careAdvice: CareAdvice = {
      ...advice,
      id: `advice-${Date.now()}`,
    };

    const msg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId,
      senderName,
      senderRole: "provider",
      content: `Care advice: ${advice.summary}`,
      contentType: "advice",
      isEncrypted: true,
      readBy: [senderId],
      careAdvice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = this.messages.get(conversationId) || [];
    existing.push(msg);
    this.messages.set(conversationId, existing);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.lastMessage = msg;
      conv.updatedAt = msg.createdAt;
    }

    return msg;
  }

  createConversation(patientId: string, subject: string, participantIds: string[], type: "direct" | "group" | "care_team" = "direct"): Conversation {
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      patientId,
      type,
      subject,
      participants: [
        { id: patientId, name: "Alex Thompson", role: "patient", isOnline: true, lastSeen: new Date().toISOString() },
        ...participantIds.map(id => {
          const profile = this.careTeamProfiles.get(id);
          return {
            id,
            name: profile?.name || this.getProviderName(id),
            role: (profile?.role || "provider") as Participant["role"],
            isOnline: profile?.isOnline || false,
            lastSeen: profile?.lastSeen || new Date().toISOString(),
          };
        }),
      ],
      lastMessage: null,
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
      encryptionStatus: "encrypted",
      priority: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.conversations.set(conv.id, conv);
    this.messages.set(conv.id, []);
    return conv;
  }

  markAsRead(conversationId: string, userId: string): void {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.unreadCount = 0;
      const msgs = this.messages.get(conversationId) || [];
      msgs.forEach(m => {
        if (!m.readBy.includes(userId)) m.readBy.push(userId);
      });
    }
  }

  getCareTeam(patientId: string): Participant[] {
    const team = new Map<string, Participant>();
    this.conversations.forEach(c => {
      if (c.patientId === patientId) {
        c.participants.forEach(p => {
          if (p.role !== "patient") team.set(p.id, p);
        });
      }
    });
    return Array.from(team.values());
  }

  getCareTeamProfiles(patientId: string): CareTeamMemberProfile[] {
    const teamIds = new Set<string>();
    this.conversations.forEach(c => {
      if (c.patientId === patientId) {
        c.participants.forEach(p => {
          if (p.role !== "patient") teamIds.add(p.id);
        });
      }
    });
    return Array.from(teamIds).map(id => this.careTeamProfiles.get(id)).filter(Boolean) as CareTeamMemberProfile[];
  }

  getCareTeamMemberProfile(memberId: string): CareTeamMemberProfile | undefined {
    return this.careTeamProfiles.get(memberId);
  }

  getSharedDocuments(patientId: string): DocumentAttachment[] {
    const convs = Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
    const docs: DocumentAttachment[] = [];
    convs.forEach(c => {
      const msgs = this.messages.get(c.id) || [];
      msgs.forEach(m => {
        if (m.attachment) docs.push(m.attachment);
      });
    });
    return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  getAppointments(patientId: string): AppointmentProposal[] {
    const convs = Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
    const appts: AppointmentProposal[] = [];
    convs.forEach(c => {
      const msgs = this.messages.get(c.id) || [];
      msgs.forEach(m => {
        if (m.appointmentProposal) appts.push(m.appointmentProposal);
      });
    });
    return appts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecentCommunications(patientId: string, limit: number = 10): Message[] {
    const convs = Array.from(this.conversations.values()).filter(c => c.patientId === patientId);
    const allMsgs: Message[] = [];
    convs.forEach(c => {
      const msgs = this.messages.get(c.id) || [];
      allMsgs.push(...msgs);
    });
    return allMsgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }

  private getProviderName(id: string): string {
    const names: Record<string, string> = {
      "prov-001": "Dr. Sarah Smith",
      "prov-002": "Dr. Michael Chen",
      "nurse-001": "Nurse Emily Johnson",
      "coord-001": "Maria Garcia",
    };
    return names[id] || `Provider ${id}`;
  }
}

export const secureMessagingService = new SecureMessagingService();
