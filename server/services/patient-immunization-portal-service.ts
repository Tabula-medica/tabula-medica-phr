import { v4 as uuidv4 } from "uuid";
import {
  IISConsent,
  InsertIISConsent,
  IISConnectionState,
  PatientPortalMessage,
  InsertPatientPortalMessage,
  PatientImmunizationPortalSummary,
  SecurePortalAccessToken,
  Immunization,
} from "@shared/schema";

const NO_CDS_DISCLAIMER = "DISCLAIMER: This portal provides informational access to your immunization records. It does not provide medical advice, diagnoses, or treatment recommendations. Always consult with your healthcare provider for medical decisions.";

class PatientImmunizationPortalService {
  private consents: Map<string, IISConsent> = new Map();
  private connections: Map<string, IISConnectionState> = new Map();
  private messages: Map<string, PatientPortalMessage> = new Map();
  private accessTokens: Map<string, SecurePortalAccessToken> = new Map();
  private immunizationRecords: Map<string, Immunization[]> = new Map();

  private stateIISRegistry: Record<string, { name: string; endpoint: string }> = {
    "CA": { name: "California Immunization Registry (CAIR2)", endpoint: "cair2.cdph.ca.gov" },
    "NY": { name: "New York State Immunization Information System (NYSIIS)", endpoint: "nysiis.health.ny.gov" },
    "TX": { name: "Texas Immunization Registry (ImmTrac2)", endpoint: "immtrac2.dshs.texas.gov" },
    "FL": { name: "Florida SHOTS", endpoint: "flshots.com" },
    "PA": { name: "Pennsylvania SIIS", endpoint: "pa-siis.pa.gov" },
    "IL": { name: "Illinois I-CARE", endpoint: "i-care.illinois.gov" },
    "OH": { name: "Ohio Impact SIIS", endpoint: "impact.ohio.gov" },
    "GA": { name: "Georgia Registry of Immunization Transactions (GRITS)", endpoint: "grits.gaph.gov" },
    "NC": { name: "North Carolina Immunization Registry (NCIR)", endpoint: "ncir.ncdhhs.gov" },
    "MI": { name: "Michigan Care Improvement Registry (MCIR)", endpoint: "mcir.michigan.gov" },
    "AZ": { name: "Arizona State Immunization Information System (ASIIS)", endpoint: "asiis.azdhs.gov" },
    "WA": { name: "Washington State Immunization Information System", endpoint: "waiis.doh.wa.gov" },
    "CO": { name: "Colorado Immunization Information System (CIIS)", endpoint: "ciis.colorado.gov" },
    "MA": { name: "Massachusetts Immunization Information System (MIIS)", endpoint: "miis.mass.gov" },
    "NJ": { name: "New Jersey Immunization Information System (NJIIS)", endpoint: "njiis.nj.gov" },
  };

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const samplePatientId = "patient-001";
    
    const sampleImmunizations: Immunization[] = [
      {
        id: "imm-001",
        patientId: samplePatientId,
        vaccineCode: "207",
        vaccineName: "COVID-19 mRNA Vaccine (Pfizer-BioNTech)",
        administeredDate: "2024-01-15",
        doseNumber: 4,
        lotNumber: "FN1234",
        manufacturer: "Pfizer Inc",
        site: "left_arm",
        route: "Intramuscular",
        status: "completed",
        createdAt: new Date().toISOString(),
      },
      {
        id: "imm-002",
        patientId: samplePatientId,
        vaccineCode: "140",
        vaccineName: "Influenza (Flu) Vaccine",
        administeredDate: "2024-10-01",
        doseNumber: 1,
        lotNumber: "FL5678",
        manufacturer: "Sanofi Pasteur",
        site: "right_arm",
        route: "Intramuscular",
        status: "completed",
        createdAt: new Date().toISOString(),
      },
      {
        id: "imm-003",
        patientId: samplePatientId,
        vaccineCode: "121",
        vaccineName: "Shingrix (Herpes Zoster Vaccine)",
        administeredDate: "2024-03-20",
        doseNumber: 2,
        lotNumber: "SH9012",
        manufacturer: "GlaxoSmithKline",
        site: "left_arm",
        route: "Intramuscular",
        status: "completed",
        createdAt: new Date().toISOString(),
      },
    ];
    this.immunizationRecords.set(samplePatientId, sampleImmunizations);

    const sampleConsent: IISConsent = {
      id: "consent-001",
      patientId: samplePatientId,
      consentType: "full_access",
      status: "active",
      stateCode: "CA",
      iisSystemName: "California Immunization Registry (CAIR2)",
      grantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      version: 1,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.consents.set(sampleConsent.id, sampleConsent);

    const sampleConnection: IISConnectionState = {
      id: "conn-001",
      patientId: samplePatientId,
      stateCode: "CA",
      iisSystemName: "California Immunization Registry (CAIR2)",
      status: "connected",
      lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastSyncStatus: "success",
      recordsCount: 3,
      consentId: sampleConsent.id,
      verifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.connections.set(sampleConnection.id, sampleConnection);

    const sampleMessages: PatientPortalMessage[] = [
      {
        id: "msg-001",
        patientId: samplePatientId,
        senderId: "clinician-001",
        senderName: "Dr. Sarah Johnson",
        senderRole: "Primary Care Physician",
        subject: "Flu Vaccine Reminder",
        body: "Hello! This is a friendly reminder that your annual flu vaccination is due. Please schedule an appointment at your earliest convenience. The flu vaccine is recommended annually for all patients.",
        category: "immunization_reminder",
        priority: "normal",
        status: "unread",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-002",
        patientId: samplePatientId,
        senderId: "system",
        senderName: "Tabula Medica System",
        senderRole: "Automated Notification",
        subject: "IIS Connection Verified",
        body: "Your connection to the California Immunization Registry (CAIR2) has been successfully verified. Your immunization records have been synced.",
        category: "iis_notification",
        priority: "low",
        status: "read",
        readAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
    ];
    sampleMessages.forEach(msg => this.messages.set(msg.id, msg));
  }

  async getPatientImmunizations(patientId: string): Promise<{ 
    data: Immunization[]; 
    disclaimer: string;
  }> {
    await this.logAudit(patientId, "read", "Viewed immunization records");
    const records = this.immunizationRecords.get(patientId) || [];
    return {
      data: records.sort((a, b) => 
        new Date(b.administeredDate || "").getTime() - new Date(a.administeredDate || "").getTime()
      ),
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getIISConnections(patientId: string): Promise<{
    data: {
      connections: IISConnectionState[];
      availableStates: { code: string; name: string; requiresConsent: boolean }[];
    };
    disclaimer: string;
  }> {
    await this.logAudit(patientId, "read", "Viewed IIS connection status");
    
    const patientConnections = Array.from(this.connections.values())
      .filter(c => c.patientId === patientId);
    
    const connectedStateCodes = new Set(patientConnections.map(c => c.stateCode));
    const availableStates = Object.entries(this.stateIISRegistry).map(([code, info]) => ({
      code,
      name: info.name,
      requiresConsent: !connectedStateCodes.has(code),
    }));

    return {
      data: {
        connections: patientConnections,
        availableStates,
      },
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getPatientConsents(patientId: string): Promise<{
    data: IISConsent[];
    disclaimer: string;
  }> {
    await this.logAudit(patientId, "read", "Viewed IIS consent records");
    
    const patientConsents = Array.from(this.consents.values())
      .filter(c => c.patientId === patientId);
    
    return {
      data: patientConsents,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async grantConsent(
    patientId: string, 
    data: InsertIISConsent, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<{ data: IISConsent; disclaimer: string }> {
    const stateInfo = this.stateIISRegistry[data.stateCode];
    if (!stateInfo) {
      throw new Error(`State IIS not found for code: ${data.stateCode}`);
    }

    const consent: IISConsent = {
      id: uuidv4(),
      patientId,
      consentType: data.consentType,
      status: "active",
      stateCode: data.stateCode,
      iisSystemName: stateInfo.name,
      grantedAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
      consentDocument: data.consentDocument,
      ipAddress,
      userAgent,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.consents.set(consent.id, consent);

    const connection: IISConnectionState = {
      id: uuidv4(),
      patientId,
      stateCode: data.stateCode,
      iisSystemName: stateInfo.name,
      status: "pending_verification",
      consentId: consent.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.connections.set(connection.id, connection);

    await this.logAudit(patientId, "write", `Granted IIS consent for ${stateInfo.name}`, {
      consentId: consent.id,
      stateCode: data.stateCode,
      consentType: data.consentType,
    });

    return {
      data: consent,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async revokeConsent(
    patientId: string, 
    consentId: string, 
    reason?: string
  ): Promise<{ success: boolean; disclaimer: string }> {
    const consent = this.consents.get(consentId);
    if (!consent || consent.patientId !== patientId) {
      throw new Error("Consent not found or access denied");
    }

    consent.status = "revoked";
    consent.revokedAt = new Date().toISOString();
    consent.revokeReason = reason;
    consent.updatedAt = new Date().toISOString();
    this.consents.set(consentId, consent);

    const relatedConnections = Array.from(this.connections.values())
      .filter(c => c.consentId === consentId);
    
    for (const conn of relatedConnections) {
      conn.status = "disconnected";
      conn.updatedAt = new Date().toISOString();
      this.connections.set(conn.id, conn);
    }

    await this.logAudit(patientId, "write", `Revoked IIS consent for ${consent.iisSystemName}`, {
      consentId,
      reason,
    });

    return {
      success: true,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getPatientMessages(patientId: string, status?: string): Promise<{
    data: PatientPortalMessage[];
    unreadCount: number;
    disclaimer: string;
  }> {
    await this.logAudit(patientId, "read", "Viewed secure messages");
    
    let messages = Array.from(this.messages.values())
      .filter(m => m.patientId === patientId);
    
    if (status && status !== "all") {
      messages = messages.filter(m => m.status === status);
    }

    const unreadCount = Array.from(this.messages.values())
      .filter(m => m.patientId === patientId && m.status === "unread").length;

    return {
      data: messages.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      unreadCount,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async markMessageAsRead(patientId: string, messageId: string): Promise<{
    success: boolean;
    disclaimer: string;
  }> {
    const message = this.messages.get(messageId);
    if (!message || message.patientId !== patientId) {
      throw new Error("Message not found or access denied");
    }

    message.status = "read";
    message.readAt = new Date().toISOString();
    message.updatedAt = new Date().toISOString();
    this.messages.set(messageId, message);

    await this.logAudit(patientId, "write", "Marked message as read", { messageId });

    return {
      success: true,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async sendMessageFromClinician(data: InsertPatientPortalMessage): Promise<{
    data: PatientPortalMessage;
    disclaimer: string;
  }> {
    const message: PatientPortalMessage = {
      id: uuidv4(),
      ...data,
      status: "unread",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.messages.set(message.id, message);

    await this.logAudit(data.patientId, "write", "Received secure message from clinician", {
      messageId: message.id,
      senderId: data.senderId,
      category: data.category,
    });

    return {
      data: message,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getPortalSummary(patientId: string): Promise<{
    data: PatientImmunizationPortalSummary;
    disclaimer: string;
  }> {
    await this.logAudit(patientId, "read", "Viewed portal summary dashboard");

    const immunizations = this.immunizationRecords.get(patientId) || [];
    const connections = Array.from(this.connections.values())
      .filter(c => c.patientId === patientId);
    const consents = Array.from(this.consents.values())
      .filter(c => c.patientId === patientId && c.status === "active");
    const messages = Array.from(this.messages.values())
      .filter(m => m.patientId === patientId);

    const now = new Date();
    const upToDate = immunizations.filter(i => i.status === "completed").length;

    const summary: PatientImmunizationPortalSummary = {
      patient: {
        id: patientId,
        name: "Patient",
        lastLogin: new Date().toISOString(),
      },
      immunizations: {
        total: immunizations.length,
        upToDate,
        overdue: 0,
        upcoming: 0,
        records: immunizations.slice(0, 5),
      },
      iisConnections: {
        activeConsents: consents.length,
        connectedStates: connections.filter(c => c.status === "connected").map(c => c.stateCode),
        connections,
      },
      messages: {
        unread: messages.filter(m => m.status === "unread").length,
        total: messages.length,
        recentMessages: messages.slice(0, 5),
      },
      lastUpdated: now.toISOString(),
    };

    return {
      data: summary,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async generateSecureAccessLink(
    patientId: string, 
    purpose: SecurePortalAccessToken["purpose"],
    createdBy: string,
    maxUses: number = 1,
    expiresInHours: number = 24
  ): Promise<{ token: string; expiresAt: string; disclaimer: string }> {
    const token: SecurePortalAccessToken = {
      id: uuidv4(),
      patientId,
      token: this.generateSecureToken(),
      purpose,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
      maxUses,
      useCount: 0,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    this.accessTokens.set(token.token, token);

    await this.logAudit(patientId, "write", "Generated secure portal access link", {
      tokenId: token.id,
      purpose,
      expiresAt: token.expiresAt,
    });

    return {
      token: token.token,
      expiresAt: token.expiresAt,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async validateAccessToken(token: string): Promise<{
    valid: boolean;
    patientId?: string;
    purpose?: string;
    error?: string;
  }> {
    const accessToken = this.accessTokens.get(token);
    
    if (!accessToken) {
      return { valid: false, error: "Invalid or expired access token" };
    }

    if (new Date(accessToken.expiresAt) < new Date()) {
      return { valid: false, error: "Access token has expired" };
    }

    if (accessToken.useCount >= accessToken.maxUses) {
      return { valid: false, error: "Access token has reached maximum uses" };
    }

    accessToken.useCount++;
    accessToken.usedAt = new Date().toISOString();
    this.accessTokens.set(token, accessToken);

    return {
      valid: true,
      patientId: accessToken.patientId,
      purpose: accessToken.purpose,
    };
  }

  private generateSecureToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private async logAudit(
    patientId: string, 
    action: "read" | "write" | "delete" | "export",
    description: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        resourceType: "PatientImmunizationPortal",
        userId: patientId,
        action,
        description,
        details: details || {},
        source: "patient-immunization-portal",
      };
      console.log(`[HIPAA Audit Log] ${JSON.stringify(auditEntry)}`);
    } catch (error) {
      console.error("Failed to create audit log:", error);
    }
  }

  async archiveMessage(patientId: string, messageId: string): Promise<{
    success: boolean;
    disclaimer: string;
  }> {
    const message = this.messages.get(messageId);
    if (!message || message.patientId !== patientId) {
      throw new Error("Message not found or access denied");
    }

    message.status = "archived";
    message.updatedAt = new Date().toISOString();
    this.messages.set(messageId, message);

    await this.logAudit(patientId, "write", "Archived message", { messageId });

    return {
      success: true,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export const patientImmunizationPortalService = new PatientImmunizationPortalService();
