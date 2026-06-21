import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import {
  Conversation,
  MessageReadReceipt,
  ConversationParticipant,
  insertConversationSchema,
  insertMessageSchema,
  UserRole,
  SecureMessageStatus,
} from "@shared/schema";
import { messagingWebSocketService, generateSignedToken, verifySignedToken } from "./services/messaging-websocket-service";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  status: SecureMessageStatus;
  isEdited: boolean;
  isDeleted: boolean;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

interface MessageAttachment {
  id: string;
  messageId: string;
  conversationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
  downloadUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

const attachments = new Map<string, MessageAttachment>();

const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message>();
const messageReadReceipts = new Map<string, MessageReadReceipt>();
const conversationParticipants = new Map<string, ConversationParticipant>();

function generateId(): string {
  return randomUUID();
}

function logPhiAccess(details: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: string;
}) {
  console.log(`[PHI-AUDIT] [${new Date().toISOString()}] ${details.action}: ${details.details}`);
}

function initializeSampleData() {
  if (conversations.size > 0) return;

  const now = new Date().toISOString();
  const userId = "current-user";

  const conv1: Conversation = {
    id: "conv-001",
    type: "patient_caregiver",
    title: "Mom - About Emma's Medication",
    profileId: "profile-child-001",
    participantIds: [userId, "caregiver-001"],
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastMessagePreview: "Thanks for the update! I'll make sure she takes it.",
    isArchived: false,
    createdBy: userId,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now,
  };

  const conv2: Conversation = {
    id: "conv-002",
    type: "patient_provider",
    title: "Dr. Smith - Lab Results Question",
    profileId: "profile-self-001",
    participantIds: [userId, "provider-001"],
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    lastMessagePreview: "Your lab results look good. Schedule a follow-up in 3 months.",
    isArchived: false,
    createdBy: userId,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now,
  };

  const conv3: Conversation = {
    id: "conv-003",
    type: "caregiver_provider",
    title: "School Nurse - Allergy Information",
    profileId: "profile-child-001",
    participantIds: [userId, "provider-002"],
    lastMessageAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastMessagePreview: "I've updated Emma's allergy action plan in our system.",
    isArchived: false,
    createdBy: "provider-002",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now,
  };

  conversations.set(conv1.id, conv1);
  conversations.set(conv2.id, conv2);
  conversations.set(conv3.id, conv3);

  const msg1: Message = {
    id: "msg-001",
    conversationId: "conv-001",
    senderId: "caregiver-001",
    senderName: "Mom (Jane)",
    senderRole: "caregiver",
    content: "Hi! Just wanted to check on Emma's medication schedule. Is she still taking the antibiotic twice a day?",
    attachmentUrl: null,
    attachmentType: null,
    status: "read",
    isEdited: false,
    isDeleted: false,
    replyToId: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };

  const msg2: Message = {
    id: "msg-002",
    conversationId: "conv-001",
    senderId: userId,
    senderName: "Sarah Johnson",
    senderRole: "patient",
    content: "Yes, she's taking it with breakfast and dinner. The doctor said to continue for 5 more days.",
    attachmentUrl: null,
    attachmentType: null,
    status: "read",
    isEdited: false,
    isDeleted: false,
    replyToId: "msg-001",
    createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
  };

  const msg3: Message = {
    id: "msg-003",
    conversationId: "conv-001",
    senderId: "caregiver-001",
    senderName: "Mom (Jane)",
    senderRole: "caregiver",
    content: "Thanks for the update! I'll make sure she takes it.",
    attachmentUrl: null,
    attachmentType: null,
    status: "delivered",
    isEdited: false,
    isDeleted: false,
    replyToId: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };

  const msg4: Message = {
    id: "msg-004",
    conversationId: "conv-002",
    senderId: "provider-001",
    senderName: "Dr. Smith",
    senderRole: "provider",
    content: "Hello Sarah, I've reviewed your recent blood work. Everything looks normal. Your cholesterol levels have improved since last year.",
    attachmentUrl: null,
    attachmentType: null,
    status: "read",
    isEdited: false,
    isDeleted: false,
    replyToId: null,
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  };

  const msg5: Message = {
    id: "msg-005",
    conversationId: "conv-002",
    senderId: userId,
    senderName: "Sarah Johnson",
    senderRole: "patient",
    content: "That's great news! Should I continue with the same diet and exercise routine?",
    attachmentUrl: null,
    attachmentType: null,
    status: "read",
    isEdited: false,
    isDeleted: false,
    replyToId: "msg-004",
    createdAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
  };

  const msg6: Message = {
    id: "msg-006",
    conversationId: "conv-002",
    senderId: "provider-001",
    senderName: "Dr. Smith",
    senderRole: "provider",
    content: "Your lab results look good. Schedule a follow-up in 3 months.",
    attachmentUrl: null,
    attachmentType: null,
    status: "delivered",
    isEdited: false,
    isDeleted: false,
    replyToId: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };

  messages.set(msg1.id, msg1);
  messages.set(msg2.id, msg2);
  messages.set(msg3.id, msg3);
  messages.set(msg4.id, msg4);
  messages.set(msg5.id, msg5);
  messages.set(msg6.id, msg6);

  const participant1: ConversationParticipant = {
    id: generateId(),
    conversationId: "conv-001",
    userId: userId,
    userName: "Sarah Johnson",
    userRole: "patient",
    joinedAt: conv1.createdAt,
    lastReadAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    isMuted: false,
    isActive: true,
  };

  const participant2: ConversationParticipant = {
    id: generateId(),
    conversationId: "conv-001",
    userId: "caregiver-001",
    userName: "Mom (Jane)",
    userRole: "caregiver",
    joinedAt: conv1.createdAt,
    lastReadAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isMuted: false,
    isActive: true,
  };

  conversationParticipants.set(participant1.id, participant1);
  conversationParticipants.set(participant2.id, participant2);
}

initializeSampleData();

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId, archived } = req.query;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Conversations",
      details: `User accessed conversation list`,
    });

    let userConversations = Array.from(conversations.values())
      .filter(c => c.participantIds.includes(userId))
      .filter(c => archived === "true" ? c.isArchived : !c.isArchived);

    if (profileId) {
      userConversations = userConversations.filter(c => c.profileId === profileId);
    }

    userConversations.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    const conversationsWithMeta = userConversations.map(conv => {
      const convMessages = Array.from(messages.values())
        .filter(m => m.conversationId === conv.id && !m.isDeleted);
      
      const participant = Array.from(conversationParticipants.values())
        .find(p => p.conversationId === conv.id && p.userId === userId);
      
      const unreadCount = convMessages.filter(m => 
        m.senderId !== userId && 
        participant?.lastReadAt && 
        new Date(m.createdAt) > new Date(participant.lastReadAt)
      ).length;

      return {
        ...conv,
        unreadCount,
        messageCount: convMessages.length,
      };
    });

    res.json(conversationsWithMeta);
  } catch (error) {
    console.error("[Messaging] Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const userName = user?.claims?.first_name 
      ? `${user.claims.first_name} ${user.claims.last_name || ""}`.trim()
      : "You";

    const validated = insertConversationSchema.parse(req.body);
    const now = new Date().toISOString();

    const conversation: Conversation = {
      id: generateId(),
      type: validated.type,
      title: validated.title || null,
      profileId: validated.profileId,
      participantIds: [userId, ...validated.participantIds],
      lastMessageAt: null,
      lastMessagePreview: null,
      isArchived: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    conversations.set(conversation.id, conversation);

    const creatorParticipant: ConversationParticipant = {
      id: generateId(),
      conversationId: conversation.id,
      userId: userId,
      userName: userName,
      userRole: "patient",
      joinedAt: now,
      lastReadAt: now,
      isMuted: false,
      isActive: true,
    };
    conversationParticipants.set(creatorParticipant.id, creatorParticipant);

    logPhiAccess({
      userId,
      action: "create",
      resourceType: "Conversation",
      resourceId: conversation.id,
      details: `Created new ${validated.type} conversation`,
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error("[Messaging] Create conversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const participants = Array.from(conversationParticipants.values())
      .filter(p => p.conversationId === conversationId);

    res.json({ ...conversation, participants });
  } catch (error) {
    console.error("[Messaging] Get conversation error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.get("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId } = req.params;
    const { limit = "50", before } = req.query;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Messages",
      resourceId: conversationId,
      details: `User accessed messages in conversation`,
    });

    let convMessages = Array.from(messages.values())
      .filter(m => m.conversationId === conversationId && !m.isDeleted)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (before) {
      convMessages = convMessages.filter(m => new Date(m.createdAt) < new Date(before as string));
    }

    const limitNum = parseInt(limit as string, 10);
    const limitedMessages = convMessages.slice(-limitNum);

    const participant = Array.from(conversationParticipants.values())
      .find(p => p.conversationId === conversationId && p.userId === userId);
    
    if (participant) {
      participant.lastReadAt = new Date().toISOString();
      conversationParticipants.set(participant.id, participant);
    }

    res.json({
      messages: limitedMessages,
      hasMore: convMessages.length > limitedMessages.length,
    });
  } catch (error) {
    console.error("[Messaging] Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

router.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const userName = user?.claims?.first_name 
      ? `${user.claims.first_name} ${user.claims.last_name || ""}`.trim()
      : "You";
    const userRole = (user?.claims?.role || "patient") as UserRole;
    const { conversationId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const validated = insertMessageSchema.parse({
      ...req.body,
      conversationId,
    });
    const now = new Date().toISOString();

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      content: validated.content,
      attachmentUrl: validated.attachmentUrl || null,
      attachmentType: validated.attachmentType || null,
      status: "sent",
      isEdited: false,
      isDeleted: false,
      replyToId: validated.replyToId || null,
      createdAt: now,
      updatedAt: now,
    };

    messages.set(message.id, message);

    conversation.lastMessageAt = now;
    conversation.lastMessagePreview = validated.content.substring(0, 100);
    conversation.updatedAt = now;
    conversations.set(conversationId, conversation);

    const participant = Array.from(conversationParticipants.values())
      .find(p => p.conversationId === conversationId && p.userId === userId);
    if (participant) {
      participant.lastReadAt = now;
      conversationParticipants.set(participant.id, participant);
    }

    logPhiAccess({
      userId,
      action: "create",
      resourceType: "Message",
      resourceId: message.id,
      details: `User sent message in conversation ${conversationId}`,
    });

    messagingWebSocketService.broadcastNewMessage(conversationId, message, userId);

    conversation.participantIds.forEach(participantId => {
      if (participantId !== userId) {
        messagingWebSocketService.sendNotificationToUser(participantId, {
          type: "notification",
          title: `New message from ${userName}`,
          body: validated.content.substring(0, 100),
          conversationId,
          messageId: message.id,
          senderId: userId,
          senderName: userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("[Messaging] Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/conversations/:conversationId/messages/:messageId", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    const message = messages.get(messageId);
    if (!message || message.conversationId !== conversationId) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (message.senderId !== userId) {
      res.status(403).json({ error: "Can only edit your own messages" });
      return;
    }

    message.content = content;
    message.isEdited = true;
    message.updatedAt = new Date().toISOString();
    messages.set(messageId, message);

    res.json(message);
  } catch (error) {
    console.error("[Messaging] Edit message error:", error);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

router.delete("/conversations/:conversationId/messages/:messageId", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId, messageId } = req.params;

    const message = messages.get(messageId);
    if (!message || message.conversationId !== conversationId) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (message.senderId !== userId) {
      res.status(403).json({ error: "Can only delete your own messages" });
      return;
    }

    message.isDeleted = true;
    message.content = "This message was deleted";
    message.updatedAt = new Date().toISOString();
    messages.set(messageId, message);

    res.json({ success: true });
  } catch (error) {
    console.error("[Messaging] Delete message error:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

router.post("/conversations/:conversationId/read", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const participant = Array.from(conversationParticipants.values())
      .find(p => p.conversationId === conversationId && p.userId === userId);
    
    if (participant) {
      participant.lastReadAt = new Date().toISOString();
      conversationParticipants.set(participant.id, participant);
    }

    res.json({ success: true, lastReadAt: participant?.lastReadAt });
  } catch (error) {
    console.error("[Messaging] Mark read error:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.post("/conversations/:conversationId/archive", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    conversation.isArchived = true;
    conversation.updatedAt = new Date().toISOString();
    conversations.set(conversationId, conversation);

    res.json(conversation);
  } catch (error) {
    console.error("[Messaging] Archive conversation error:", error);
    res.status(500).json({ error: "Failed to archive conversation" });
  }
});

router.post("/conversations/:conversationId/messages/:messageId/attachments", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId, messageId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const message = messages.get(messageId);
    if (!message || message.conversationId !== conversationId) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const attachmentId = generateId();
    const objectPath = `.private/messaging/${conversationId}/${messageId}/${attachmentId}-${file.originalname}`;
    
    const attachment: MessageAttachment = {
      id: attachmentId,
      messageId,
      conversationId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      objectPath,
      downloadUrl: `/api/messaging/attachments/${attachmentId}/download`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
    };

    attachments.set(attachmentId, attachment);

    message.attachmentUrl = attachment.downloadUrl;
    message.attachmentType = file.mimetype;
    messages.set(messageId, message);

    logPhiAccess({
      userId,
      action: "upload",
      resourceType: "MessageAttachment",
      resourceId: attachmentId,
      details: `Uploaded attachment ${file.originalname} to message ${messageId}`,
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error("[Messaging] Upload attachment error:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

router.get("/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { attachmentId } = req.params;

    const attachment = attachments.get(attachmentId);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const message = messages.get(attachment.messageId);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const conversation = conversations.get(message.conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    logPhiAccess({
      userId,
      action: "download",
      resourceType: "MessageAttachment",
      resourceId: attachmentId,
      details: `Downloaded attachment ${attachment.fileName}`,
    });

    const signedToken = generateSignedToken(userId, attachment.conversationId, attachmentId);
    const signedUrl = `/api/messaging/attachments/${attachmentId}/stream?token=${signedToken}`;
    
    res.json({
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      downloadUrl: signedUrl,
      expiresIn: 300,
    });
  } catch (error) {
    console.error("[Messaging] Download attachment error:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});

router.get("/conversations/:conversationId/messages/:messageId/attachments", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { conversationId, messageId } = req.params;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!conversation.participantIds.includes(userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const messageAttachments = Array.from(attachments.values())
      .filter(a => a.messageId === messageId);

    res.json(messageAttachments);
  } catch (error) {
    console.error("[Messaging] Get attachments error:", error);
    res.status(500).json({ error: "Failed to get attachments" });
  }
});

router.get("/attachments/:attachmentId/stream", async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const token = req.query.token as string;
    
    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }
    
    const tokenData = verifySignedToken(token, 300000);
    if (!tokenData) {
      logPhiAccess({
        userId: "unknown",
        action: "stream_denied",
        resourceType: "MessageAttachment",
        resourceId: attachmentId,
        details: "Invalid or expired token",
      });
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    
    if (tokenData.attachmentId !== attachmentId) {
      res.status(403).json({ error: "Token does not match attachment" });
      return;
    }
    
    const attachment = attachments.get(attachmentId);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    
    if (attachment.conversationId !== tokenData.conversationId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    
    const conversation = conversations.get(attachment.conversationId);
    if (!conversation || !conversation.participantIds.includes(tokenData.userId)) {
      logPhiAccess({
        userId: tokenData.userId,
        action: "stream_denied",
        resourceType: "MessageAttachment",
        resourceId: attachmentId,
        details: "User not participant in conversation",
      });
      res.status(403).json({ error: "Access denied" });
      return;
    }
    
    logPhiAccess({
      userId: tokenData.userId,
      action: "stream",
      resourceType: "MessageAttachment",
      resourceId: attachmentId,
      details: `Streamed attachment ${attachment.fileName} with cryptographically verified token`,
    });
    
    res.setHeader("Content-Type", attachment.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
    res.setHeader("Content-Length", attachment.fileSize);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    
    res.json({
      message: "Sample mode: In production, this streams from object storage with PHI encryption",
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      securityNote: "Token cryptographically verified with HMAC-SHA256",
    });
  } catch (error) {
    console.error("[Messaging] Stream attachment error:", error);
    res.status(500).json({ error: "Failed to stream attachment" });
  }
});

router.get("/online-status", async (req: Request, res: Response) => {
  try {
    const onlineUsers = messagingWebSocketService.getOnlineUsers();
    const clientCount = messagingWebSocketService.getConnectedClientCount();
    
    res.json({
      onlineUsers,
      clientCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Messaging] Get online status error:", error);
    res.status(500).json({ error: "Failed to get online status" });
  }
});

router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const userConversations = Array.from(conversations.values())
      .filter(c => c.participantIds.includes(userId) && !c.isArchived);

    let totalUnread = 0;
    for (const conv of userConversations) {
      const participant = Array.from(conversationParticipants.values())
        .find(p => p.conversationId === conv.id && p.userId === userId);
      
      const convMessages = Array.from(messages.values())
        .filter(m => m.conversationId === conv.id && !m.isDeleted);
      
      const unread = convMessages.filter(m => 
        m.senderId !== userId && 
        participant?.lastReadAt && 
        new Date(m.createdAt) > new Date(participant.lastReadAt)
      ).length;

      totalUnread += unread;
    }

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("[Messaging] Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

export function canUserAccessConversation(conversationId: string, userId: string): boolean {
  const conversation = conversations.get(conversationId);
  if (!conversation) return false;
  return conversation.participantIds.includes(userId);
}

export function registerMessagingRoutes(app: any) {
  messagingWebSocketService.setConversationAccessChecker(canUserAccessConversation);
  
  app.use("/api/messaging", router);
  console.log("[Routes] Secure Messaging routes registered at /api/messaging/*");
}

export default router;
