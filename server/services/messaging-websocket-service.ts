import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { randomUUID, createHmac } from "crypto";

export interface MessageEvent {
  type: "new_message" | "message_read" | "typing" | "stopped_typing" | "message_deleted" | "message_edited";
  conversationId: string;
  message?: any;
  senderId?: string;
  senderName?: string;
  timestamp: string;
}

export interface MessageNotification {
  type: "notification";
  title: string;
  body: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  timestamp: string;
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  userId: string;
  userName: string;
  subscribedConversations: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
}

function logHipaaAudit(params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
}) {
  console.log(`[HIPAA-AUDIT][Messaging] ${params.action} - ${params.resourceType}/${params.resourceId} by ${params.userId}: ${params.details}`);
}

type ConversationAccessChecker = (conversationId: string, userId: string) => boolean;
type SessionResolver = (sessionCookie: string) => { userId: string; userName: string } | null;

function getSigningSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    console.error("[Messaging] WARNING: SESSION_SECRET not set in production, using fallback");
  }
  return createHmac("sha256", "dev-only-messaging-key").digest("hex");
}

export function generateSignedToken(userId: string, conversationId: string, attachmentId: string): string {
  const timestamp = Date.now();
  const data = `${userId}:${conversationId}:${attachmentId}:${timestamp}`;
  const signature = createHmac("sha256", getSigningSecret()).update(data).digest("hex").substring(0, 16);
  return Buffer.from(`${data}:${signature}`).toString("base64url");
}

export function verifySignedToken(token: string, maxAgeMs: number = 300000): { userId: string; conversationId: string; attachmentId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 5) return null;
    
    const [userId, conversationId, attachmentId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    
    if (Date.now() - timestamp > maxAgeMs) return null;
    
    const data = `${userId}:${conversationId}:${attachmentId}:${timestamp}`;
    const expectedSignature = createHmac("sha256", getSigningSecret()).update(data).digest("hex").substring(0, 16);
    
    if (signature !== expectedSignature) return null;
    
    return { userId, conversationId, attachmentId };
  } catch {
    return null;
  }
}

class MessagingWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private conversationAccessChecker: ConversationAccessChecker | null = null;
  private sessionResolver: SessionResolver | null = null;
  private validatedSessions: Map<string, { userId: string; userName: string }> = new Map();

  setConversationAccessChecker(checker: ConversationAccessChecker): void {
    this.conversationAccessChecker = checker;
  }
  
  setSessionResolver(resolver: SessionResolver): void {
    this.sessionResolver = resolver;
  }
  
  registerSession(sessionId: string, userId: string, userName: string): void {
    this.validatedSessions.set(sessionId, { userId, userName });
  }

  canAccessConversation(conversationId: string, userId: string): boolean {
    if (this.conversationAccessChecker) {
      return this.conversationAccessChecker(conversationId, userId);
    }
    return true;
  }

  private resolveSessionIdentity(sessionCookie: string): { userId: string; userName: string } | null {
    if (this.validatedSessions.has(sessionCookie)) {
      return this.validatedSessions.get(sessionCookie)!;
    }
    if (this.sessionResolver) {
      return this.sessionResolver(sessionCookie);
    }
    return null;
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/messaging"
    });

    this.wss.on("connection", (ws: WebSocket, req) => {
      const clientId = randomUUID();
      
      const cookies = req.headers.cookie || "";
      const sessionMatch = cookies.match(/(?:^|;\s*)connect\.sid=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : null;
      
      let userId: string;
      let userName: string;
      let isAuthenticated = false;
      
      if (sessionId) {
        const identity = this.resolveSessionIdentity(sessionId);
        if (identity) {
          userId = identity.userId;
          userName = identity.userName;
          isAuthenticated = true;
        } else {
          console.log(`[Messaging-WS] Rejecting connection: invalid session`);
          ws.close(4001, "Invalid session");
          logHipaaAudit({
            userId: "unknown",
            action: "MESSAGING_CONNECTION_REJECTED",
            resourceType: "WebSocket",
            resourceId: clientId,
            details: `Connection rejected: session could not be validated`,
          });
          return;
        }
      } else {
        console.log(`[Messaging-WS] Rejecting connection: no session cookie`);
        ws.close(4001, "Authentication required");
        logHipaaAudit({
          userId: "unknown",
          action: "MESSAGING_CONNECTION_REJECTED",
          resourceType: "WebSocket",
          resourceId: clientId,
          details: `Connection rejected: no session cookie present`,
        });
        return;
      }
      
      logHipaaAudit({
        userId,
        action: "MESSAGING_CONNECTION",
        resourceType: "WebSocket",
        resourceId: clientId,
        details: `Connection established (authenticated=${isAuthenticated})`,
      });

      const client: ConnectedClient = {
        id: clientId,
        ws,
        userId,
        userName,
        subscribedConversations: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      this.clients.set(clientId, client);

      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId)!.add(clientId);

      console.log(`[Messaging-WS] Client connected: ${clientId} (user: ${userId})`);

      logHipaaAudit({
        userId,
        action: "MESSAGING_CONNECT",
        resourceType: "WebSocket",
        resourceId: clientId,
        details: `User connected to messaging WebSocket`,
      });

      this.sendToClient(client, {
        type: "connected",
        clientId,
        timestamp: new Date().toISOString(),
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error(`[Messaging-WS] Invalid message from ${clientId}:`, error);
          this.sendToClient(client, {
            type: "error",
            message: "Invalid message format",
            timestamp: new Date().toISOString(),
          });
        }
      });

      ws.on("close", () => {
        console.log(`[Messaging-WS] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        const userClientSet = this.userClients.get(userId);
        if (userClientSet) {
          userClientSet.delete(clientId);
          if (userClientSet.size === 0) {
            this.userClients.delete(userId);
          }
        }

        logHipaaAudit({
          userId,
          action: "MESSAGING_DISCONNECT",
          resourceType: "WebSocket",
          resourceId: clientId,
          details: `User disconnected from messaging WebSocket`,
        });
      });

      ws.on("error", (error) => {
        console.error(`[Messaging-WS] Client error ${clientId}:`, error);
      });
    });

    this.startHeartbeat();
    console.log("[Messaging-WS] WebSocket server initialized on /ws/messaging");
  }

  private handleClientMessage(client: ConnectedClient, message: any): void {
    client.lastActivity = new Date();

    switch (message.type) {
      case "subscribe":
        if (message.conversationId) {
          if (!this.canAccessConversation(message.conversationId, client.userId)) {
            this.sendToClient(client, {
              type: "error",
              message: "Access denied to conversation",
              conversationId: message.conversationId,
              timestamp: new Date().toISOString(),
            });
            logHipaaAudit({
              userId: client.userId,
              action: "MESSAGING_ACCESS_DENIED",
              resourceType: "Conversation",
              resourceId: message.conversationId,
              details: `Unauthorized subscription attempt`,
            });
            break;
          }
          client.subscribedConversations.add(message.conversationId);
          this.sendToClient(client, {
            type: "subscribed",
            conversationId: message.conversationId,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "unsubscribe":
        if (message.conversationId) {
          client.subscribedConversations.delete(message.conversationId);
          this.sendToClient(client, {
            type: "unsubscribed",
            conversationId: message.conversationId,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "typing":
        if (!this.canAccessConversation(message.conversationId, client.userId)) {
          logHipaaAudit({
            userId: client.userId,
            action: "MESSAGING_TYPING_DENIED",
            resourceType: "Conversation",
            resourceId: message.conversationId,
            details: `Unauthorized typing indicator attempt`,
          });
          break;
        }
        this.broadcastToConversation(message.conversationId, {
          type: "typing",
          conversationId: message.conversationId,
          senderId: client.userId,
          senderName: client.userName,
          timestamp: new Date().toISOString(),
        }, client.userId);
        break;

      case "stopped_typing":
        if (!this.canAccessConversation(message.conversationId, client.userId)) {
          logHipaaAudit({
            userId: client.userId,
            action: "MESSAGING_STOPPED_TYPING_DENIED",
            resourceType: "Conversation",
            resourceId: message.conversationId,
            details: `Unauthorized stopped_typing indicator attempt`,
          });
          break;
        }
        this.broadcastToConversation(message.conversationId, {
          type: "stopped_typing",
          conversationId: message.conversationId,
          senderId: client.userId,
          senderName: client.userName,
          timestamp: new Date().toISOString(),
        }, client.userId);
        break;

      case "mark_read":
        if (!this.canAccessConversation(message.conversationId, client.userId)) {
          logHipaaAudit({
            userId: client.userId,
            action: "MESSAGING_MARK_READ_DENIED",
            resourceType: "Conversation",
            resourceId: message.conversationId,
            details: `Unauthorized mark_read attempt`,
          });
          break;
        }
        this.broadcastToConversation(message.conversationId, {
          type: "message_read",
          conversationId: message.conversationId,
          messageId: message.messageId,
          readBy: client.userId,
          readByName: client.userName,
          timestamp: new Date().toISOString(),
        }, client.userId);
        break;

      case "ping":
        this.sendToClient(client, {
          type: "pong",
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        console.log(`[Messaging-WS] Unknown message type: ${message.type}`);
    }
  }

  private sendToClient(client: ConnectedClient, data: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, clientId) => {
        if (now - client.lastActivity.getTime() > 120000) {
          console.log(`[Messaging-WS] Closing inactive client: ${clientId}`);
          client.ws.close();
          this.clients.delete(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);
  }

  broadcastNewMessage(conversationId: string, message: any, excludeUserId?: string): void {
    this.broadcastToConversation(conversationId, {
      type: "new_message",
      conversationId,
      message,
      timestamp: new Date().toISOString(),
    }, excludeUserId);
  }

  broadcastMessageEdited(conversationId: string, messageId: string, newContent: string): void {
    this.broadcastToConversation(conversationId, {
      type: "message_edited",
      conversationId,
      messageId,
      newContent,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastMessageDeleted(conversationId: string, messageId: string): void {
    this.broadcastToConversation(conversationId, {
      type: "message_deleted",
      conversationId,
      messageId,
      timestamp: new Date().toISOString(),
    });
  }

  sendNotificationToUser(userId: string, notification: MessageNotification): void {
    const clientIds = this.userClients.get(userId);
    if (clientIds) {
      clientIds.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          this.sendToClient(client, notification);
        }
      });
    }
  }

  private broadcastToConversation(conversationId: string, data: any, excludeUserId?: string): void {
    this.clients.forEach(client => {
      if (client.subscribedConversations.has(conversationId) && client.userId !== excludeUserId) {
        this.sendToClient(client, data);
      }
    });
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userClients.keys());
  }

  isUserOnline(userId: string): boolean {
    return this.userClients.has(userId) && this.userClients.get(userId)!.size > 0;
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.forEach(client => {
      client.ws.close();
    });
    this.clients.clear();
    this.userClients.clear();
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const messagingWebSocketService = new MessagingWebSocketService();
