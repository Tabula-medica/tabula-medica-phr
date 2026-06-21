import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { randomUUID } from "crypto";
import { 
  FhirEvent, 
  FhirStreamMessage, 
  FhirEventType, 
  FhirEventSource,
  FhirEventSeverity 
} from "../../shared/fhir-event-types";
function logHipaaAudit(params: {
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  details?: Record<string, unknown>;
}) {
  console.log(`[HIPAA-AUDIT] ${params.action} - ${params.resourceType}/${params.resourceId} - ${params.outcome}`, params.details || {});
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  subscribedChannels: Set<FhirEventType>;
  subscribedSources: Set<FhirEventSource>;
  subscribedPatients: Set<string>;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

class FhirEventStreamingService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private eventHistory: FhirEvent[] = [];
  private readonly MAX_HISTORY = 100;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/fhir-events"
    });

    this.wss.on("connection", (ws: WebSocket, req) => {
      const clientId = randomUUID();
      const client: ConnectedClient = {
        id: clientId,
        ws,
        subscribedChannels: new Set(),
        subscribedSources: new Set(),
        subscribedPatients: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      this.clients.set(clientId, client);
      console.log(`[FHIR-WS] Client connected: ${clientId}`);

      logHipaaAudit({
        action: "FHIR_STREAM_CONNECT",
        resourceType: "WebSocket",
        resourceId: clientId,
        outcome: "success",
        details: { 
          clientId,
          path: req.url,
          timestamp: new Date().toISOString()
        },
      });

      this.sendToClient(client, {
        type: "subscribed",
        payload: { channels: [] },
        timestamp: new Date().toISOString(),
      });

      if (this.eventHistory.length > 0) {
        const recentEvents = this.eventHistory.slice(-10);
        this.sendToClient(client, {
          type: "event",
          payload: recentEvents,
          timestamp: new Date().toISOString(),
        });
      }

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as FhirStreamMessage;
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error(`[FHIR-WS] Invalid message from ${clientId}:`, error);
          this.sendToClient(client, {
            type: "error",
            payload: { message: "Invalid message format" },
            timestamp: new Date().toISOString(),
          });
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[FHIR-WS] Client disconnected: ${clientId}`);
        
        logHipaaAudit({
          action: "FHIR_STREAM_DISCONNECT",
          resourceType: "WebSocket",
          resourceId: clientId,
          outcome: "success",
          details: { clientId },
        });
      });

      ws.on("error", (error) => {
        console.error(`[FHIR-WS] Error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000);

    console.log("[FHIR-WS] WebSocket server initialized on /ws/fhir-events");
  }

  private handleClientMessage(client: ConnectedClient, message: FhirStreamMessage): void {
    client.lastActivity = new Date();

    switch (message.type) {
      case "subscribe":
        if (message.payload && typeof message.payload === "object" && "channels" in message.payload) {
          const channels = (message.payload as { channels: string[] }).channels;
          channels.forEach((channel) => {
            client.subscribedChannels.add(channel as FhirEventType);
          });
          
          this.sendToClient(client, {
            type: "subscribed",
            payload: { channels: Array.from(client.subscribedChannels) },
            timestamp: new Date().toISOString(),
          });
          
          console.log(`[FHIR-WS] Client ${client.id} subscribed to:`, channels);
        }
        break;

      case "unsubscribe":
        if (message.payload && typeof message.payload === "object" && "channels" in message.payload) {
          const channels = (message.payload as { channels: string[] }).channels;
          channels.forEach((channel) => {
            client.subscribedChannels.delete(channel as FhirEventType);
          });
          
          this.sendToClient(client, {
            type: "subscribed",
            payload: { channels: Array.from(client.subscribedChannels) },
            timestamp: new Date().toISOString(),
          });
        }
        break;

      default:
        console.log(`[FHIR-WS] Unknown message type from ${client.id}:`, message.type);
    }
  }

  private sendToClient(client: ConnectedClient, message: FhirStreamMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastHeartbeat(): void {
    const message: FhirStreamMessage = {
      type: "heartbeat",
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((client) => {
      this.sendToClient(client, message);
    });
  }

  broadcast(event: FhirEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    const message: FhirStreamMessage = {
      type: "event",
      payload: event,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((client) => {
      if (client.subscribedChannels.size === 0) {
        this.sendToClient(client, message);
      } else if (client.subscribedChannels.has(event.type)) {
        this.sendToClient(client, message);
      }
    });

    logHipaaAudit({
      action: "FHIR_EVENT_BROADCAST",
      resourceType: event.resourceType,
      resourceId: event.resourceId || event.id,
      outcome: "success",
      details: {
        eventType: event.type,
        source: event.source,
        clientCount: this.clients.size,
      },
    });
  }

  emitEvent(params: {
    type: FhirEventType;
    severity?: FhirEventSeverity;
    source: FhirEventSource;
    resourceType: string;
    resourceId?: string;
    patientId?: string;
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): FhirEvent {
    const event: FhirEvent = {
      id: randomUUID(),
      type: params.type,
      severity: params.severity || "info",
      source: params.source,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      title: params.title,
      description: params.description,
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    this.broadcast(event);
    return event;
  }

  getRecentEvents(limit: number = 50): FhirEvent[] {
    return this.eventHistory.slice(-limit);
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      eventHistorySize: this.eventHistory.length,
      clients: Array.from(this.clients.values()).map((c) => ({
        id: c.id,
        subscribedChannels: Array.from(c.subscribedChannels),
        connectedAt: c.connectedAt,
        lastActivity: c.lastActivity,
      })),
    };
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach((client) => {
      client.ws.close();
    });
    
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const fhirEventStreaming = new FhirEventStreamingService();
