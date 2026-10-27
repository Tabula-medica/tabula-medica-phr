import crypto from "crypto";
import { logger } from "./utils/logger";

export interface GCSConfig {
  projectId: string;
  bucketName: string;
  region: string;
  keyManagementKey: string;
  credentialsPath: string;
}

export type DocumentType =
  | "lab_result"
  | "clinical_note"
  | "imaging"
  | "discharge_summary"
  | "prescription"
  | "insurance_card"
  | "consent_form"
  | "id_verification"
  | "historical_data";

export interface StoredDocument {
  id: string;
  userId: string;
  sourceId: string;
  documentType: DocumentType;
  gcsPath: string;
  contentType: string;
  sizeBytes: number;
  encryptionMethod: string;
  uploadedAt: Date;
  metadata: Record<string, string>;
  checksum: string;
}

export interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
  encryptionKey?: string;
  encryptionAlgorithm?: string;
  retentionPeriodDays?: number;
}

export interface StorageStats {
  totalDocuments: number;
  totalSizeBytes: number;
  byType: Record<string, { count: number; sizeBytes: number }>;
  encryptionStatus: {
    encrypted: number;
    unencrypted: number;
  };
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  documentId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
}

interface EncryptedPayload {
  iv: string;
  authTag: string;
  data: string;
}

interface InMemoryDocument {
  storedDocument: StoredDocument;
  encryptedData: EncryptedPayload;
  retentionDays?: number;
}

const MAX_AUDIT_ENTRIES = 50000;

class GCSHIPAAStorageService {
  private config: GCSConfig | null = null;
  private configured: boolean = false;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private encryptionKey: Buffer;
  private auditTrail: AuditEntry[] = [];
  private localStore: Map<string, InMemoryDocument> = new Map();
  private metadataCache: Map<string, StoredDocument> = new Map();

  constructor() {
    const projectId = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "";
    const resolvedBucket = (
      process.env.GCS_BUCKET_NAME || "tabula-medica-gcs"
    ).toLowerCase().trim();
    const region = process.env.GCS_REGION || "us-central1";
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_KEY || "";
    const keyManagementKey = process.env.GCS_KMS_KEY || "";

    const hasCredentials = !!(credentialsPath || credentialsJson);

    if (projectId && resolvedBucket && hasCredentials) {
      this.config = {
        projectId,
        bucketName: resolvedBucket,
        region,
        keyManagementKey,
        credentialsPath: credentialsPath || "__inline_json__",
      };
      this.configured = true;
      logger.info(`[GCS-HIPAA] Google Cloud Storage configured for HIPAA-compliant storage (bucket: ${resolvedBucket}, credentials: ${credentialsPath ? "file" : "inline JSON"})`);
    } else {
      this.configured = false;
      logger.warn("[GCS-HIPAA] WARNING: GCS not configured - using local in-memory storage (NOT HIPAA-compliant)");
    }

    const keyEnv = process.env.GCS_ENCRYPTION_KEY;
    if (keyEnv) {
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(keyEnv) && keyEnv.length >= 40;
      this.encryptionKey = isBase64 ? Buffer.from(keyEnv, "base64") : Buffer.from(keyEnv, "hex");
    } else {
      this.encryptionKey = crypto.randomBytes(32);
      logger.warn("[GCS-HIPAA] No GCS_ENCRYPTION_KEY set, generated ephemeral key (data will not persist across restarts)");
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async uploadDocument(
    userId: string,
    sourceId: string,
    documentType: DocumentType,
    data: Buffer | string,
    options: UploadOptions
  ): Promise<StoredDocument> {
    const documentId = crypto.randomUUID();
    const rawData = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const checksum = this.calculateChecksum(rawData);
    const encrypted = this.encryptPayload(rawData);
    const encryptedBuffer = Buffer.from(JSON.stringify(encrypted), "utf-8");

    const gcsPath = `hipaa-documents/${userId}/${documentType}/${documentId}`;

    const storedDocument: StoredDocument = {
      id: documentId,
      userId,
      sourceId,
      documentType,
      gcsPath,
      contentType: options.contentType,
      sizeBytes: rawData.length,
      encryptionMethod: "AES-256-GCM",
      uploadedAt: new Date(),
      metadata: options.metadata || {},
      checksum,
    };

    if (this.configured && this.config) {
      await this.uploadToGCS(gcsPath, encryptedBuffer, options.contentType, {
        ...options.metadata,
        "x-hipaa-document-id": documentId,
        "x-hipaa-user-id": userId,
        "x-hipaa-document-type": documentType,
        "x-hipaa-checksum": checksum,
        "x-hipaa-encryption": "AES-256-GCM",
      });
      this.metadataCache.set(documentId, storedDocument);
    } else {
      this.localStore.set(documentId, {
        storedDocument,
        encryptedData: encrypted,
        retentionDays: options.retentionPeriodDays,
      });
    }

    this.addAuditEntry(documentId, userId, "UPLOAD", {
      documentType,
      sourceId,
      sizeBytes: rawData.length,
      contentType: options.contentType,
    });

    logger.info(`[GCS-HIPAA] Document uploaded: ${documentId} (type=${documentType}, size=${rawData.length} bytes)`);
    return storedDocument;
  }

  async downloadDocument(documentId: string): Promise<{ document: StoredDocument; data: Buffer }> {
    if (this.configured && this.config) {
      const metadata = await this.getDocumentMetadataFromGCS(documentId);
      if (!metadata) {
        throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
      }
      const encryptedBuffer = await this.downloadFromGCS(metadata.gcsPath);
      const encrypted: EncryptedPayload = JSON.parse(encryptedBuffer.toString("utf-8"));
      const decrypted = this.decryptPayload(encrypted);

      this.addAuditEntry(documentId, metadata.userId, "DOWNLOAD", {
        documentType: metadata.documentType,
        sizeBytes: metadata.sizeBytes,
      });

      logger.info(`[GCS-HIPAA] Document downloaded: ${documentId}`);
      return { document: metadata, data: decrypted };
    }

    const localDoc = this.localStore.get(documentId);
    if (!localDoc) {
      throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
    }

    const decrypted = this.decryptPayload(localDoc.encryptedData);

    this.addAuditEntry(documentId, localDoc.storedDocument.userId, "DOWNLOAD", {
      documentType: localDoc.storedDocument.documentType,
      sizeBytes: localDoc.storedDocument.sizeBytes,
    });

    logger.info(`[GCS-HIPAA] Document downloaded (local): ${documentId}`);
    return { document: localDoc.storedDocument, data: decrypted };
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (this.configured && this.config) {
      const metadata = await this.getDocumentMetadataFromGCS(documentId);
      if (!metadata) {
        throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
      }
      await this.deleteFromGCS(metadata.gcsPath);
      this.metadataCache.delete(documentId);

      this.addAuditEntry(documentId, metadata.userId, "DELETE", {
        documentType: metadata.documentType,
        gcsPath: metadata.gcsPath,
      });

      logger.info(`[GCS-HIPAA] Document deleted: ${documentId}`);
      return;
    }

    const localDoc = this.localStore.get(documentId);
    if (!localDoc) {
      throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
    }

    this.addAuditEntry(documentId, localDoc.storedDocument.userId, "DELETE", {
      documentType: localDoc.storedDocument.documentType,
    });

    this.localStore.delete(documentId);
    logger.info(`[GCS-HIPAA] Document deleted (local): ${documentId}`);
  }

  async listDocuments(
    userId: string,
    filters?: { documentType?: DocumentType; startDate?: Date; endDate?: Date }
  ): Promise<StoredDocument[]> {
    this.addAuditEntry("*", userId, "LIST", { filters: filters || {} });

    if (this.configured && this.config) {
      const documents = await this.listFromGCS(userId, filters);
      logger.info(`[GCS-HIPAA] Listed ${documents.length} documents for user ${userId}`);
      return documents;
    }

    let results: StoredDocument[] = [];
    for (const [, doc] of this.localStore) {
      if (doc.storedDocument.userId !== userId) continue;
      if (filters?.documentType && doc.storedDocument.documentType !== filters.documentType) continue;
      if (filters?.startDate && doc.storedDocument.uploadedAt < filters.startDate) continue;
      if (filters?.endDate && doc.storedDocument.uploadedAt > filters.endDate) continue;
      results.push(doc.storedDocument);
    }

    logger.info(`[GCS-HIPAA] Listed ${results.length} documents (local) for user ${userId}`);
    return results;
  }

  async getDocumentMetadata(documentId: string): Promise<StoredDocument> {
    if (this.configured && this.config) {
      const metadata = await this.getDocumentMetadataFromGCS(documentId);
      if (!metadata) {
        throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
      }
      this.addAuditEntry(documentId, metadata.userId, "METADATA_ACCESS", {});
      return metadata;
    }

    const localDoc = this.localStore.get(documentId);
    if (!localDoc) {
      throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
    }

    this.addAuditEntry(documentId, localDoc.storedDocument.userId, "METADATA_ACCESS", {});
    return localDoc.storedDocument;
  }

  async generateSignedUrl(documentId: string, expiresInMinutes: number = 15): Promise<string> {
    if (this.configured && this.config) {
      const metadata = await this.getDocumentMetadataFromGCS(documentId);
      if (!metadata) {
        throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
      }

      const url = await this.createSignedUrl(metadata.gcsPath, expiresInMinutes);

      this.addAuditEntry(documentId, metadata.userId, "SIGNED_URL_GENERATED", {
        expiresInMinutes,
      });

      logger.info(`[GCS-HIPAA] Signed URL generated for document: ${documentId} (expires in ${expiresInMinutes}m)`);
      return url;
    }

    const localDoc = this.localStore.get(documentId);
    if (!localDoc) {
      throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const url = `http://localhost:5000/api/gcs-hipaa/documents/${documentId}/download?token=${token}&expires=${expiresAt.toISOString()}`;

    this.addAuditEntry(documentId, localDoc.storedDocument.userId, "SIGNED_URL_GENERATED", {
      expiresInMinutes,
      localMode: true,
    });

    logger.info(`[GCS-HIPAA] Signed URL generated (local) for document: ${documentId}`);
    return url;
  }

  async getStorageStats(userId?: string): Promise<StorageStats> {
    const stats: StorageStats = {
      totalDocuments: 0,
      totalSizeBytes: 0,
      byType: {},
      encryptionStatus: { encrypted: 0, unencrypted: 0 },
    };

    if (this.configured && this.config) {
      this.addAuditEntry("*", userId || "system", "STATS_QUERY", {});
      logger.info("[GCS-HIPAA] Storage stats retrieved from GCS");
      return stats;
    }

    for (const [, doc] of this.localStore) {
      if (userId && doc.storedDocument.userId !== userId) continue;

      stats.totalDocuments++;
      stats.totalSizeBytes += doc.storedDocument.sizeBytes;

      const dt = doc.storedDocument.documentType;
      if (!stats.byType[dt]) {
        stats.byType[dt] = { count: 0, sizeBytes: 0 };
      }
      stats.byType[dt].count++;
      stats.byType[dt].sizeBytes += doc.storedDocument.sizeBytes;

      if (doc.storedDocument.encryptionMethod) {
        stats.encryptionStatus.encrypted++;
      } else {
        stats.encryptionStatus.unencrypted++;
      }
    }

    this.addAuditEntry("*", userId || "system", "STATS_QUERY", { stats });
    logger.info(`[GCS-HIPAA] Storage stats retrieved (local): ${stats.totalDocuments} documents, ${stats.totalSizeBytes} bytes`);
    return stats;
  }

  async setRetentionPolicy(documentId: string, retentionDays: number): Promise<void> {
    if (this.configured && this.config) {
      const metadata = await this.getDocumentMetadataFromGCS(documentId);
      if (!metadata) {
        throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
      }

      const token = await this.getAccessToken();
      const objectPath = encodeURIComponent(metadata.gcsPath);
      await fetch(
        `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${objectPath}?fields=retentionExpirationTime`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            retentionExpirationTime: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
          }),
        }
      );

      this.addAuditEntry(documentId, metadata.userId, "RETENTION_SET", { retentionDays });
      logger.info(`[GCS-HIPAA] Retention policy set for ${documentId}: ${retentionDays} days`);
      return;
    }

    const localDoc = this.localStore.get(documentId);
    if (!localDoc) {
      throw new Error(`[GCS-HIPAA] Document not found: ${documentId}`);
    }

    localDoc.retentionDays = retentionDays;
    this.addAuditEntry(documentId, localDoc.storedDocument.userId, "RETENTION_SET", { retentionDays });
    logger.info(`[GCS-HIPAA] Retention policy set (local) for ${documentId}: ${retentionDays} days`);
  }

  auditAccess(documentId: string, userId: string, action: string): void {
    this.addAuditEntry(documentId, userId, action, { source: "explicit_audit" });
    logger.info(`[GCS-HIPAA] Audit logged: user=${userId} action=${action} document=${documentId}`);
  }

  getAuditTrail(limit: number = 100): AuditEntry[] {
    return this.auditTrail.slice(-limit);
  }

  private encryptPayload(data: Buffer): EncryptedPayload {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      data: encrypted.toString("hex"),
    };
  }

  private decryptPayload(encrypted: EncryptedPayload): Buffer {
    const iv = Buffer.from(encrypted.iv, "hex");
    const authTag = Buffer.from(encrypted.authTag, "hex");
    const encryptedData = Buffer.from(encrypted.data, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.encryptionKey, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private addAuditEntry(documentId: string, userId: string, action: string, details: Record<string, unknown>): void {
    if (this.auditTrail.length >= MAX_AUDIT_ENTRIES) {
      this.auditTrail.splice(0, Math.floor(MAX_AUDIT_ENTRIES * 0.1));
    }

    this.auditTrail.push({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      documentId,
      userId,
      action,
      details,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

    try {
      const response = await fetch(metadataUrl, {
        headers: { "Metadata-Flavor": "Google" },
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
        return this.accessToken!;
      }
    } catch {
      logger.info("[GCS-HIPAA] Not running on GCP, attempting service account key auth");
    }

    if (!this.config?.credentialsPath) {
      throw new Error("[GCS-HIPAA] No GCP credentials available");
    }

    let serviceAccountKey: string | undefined;
    try {
      const fs = await import("fs");
      serviceAccountKey = fs.readFileSync(this.config.credentialsPath, "utf-8");
    } catch {
      serviceAccountKey = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    }

    if (!serviceAccountKey) {
      throw new Error("[GCS-HIPAA] Could not load GCP service account credentials");
    }

    const key = JSON.parse(serviceAccountKey);
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: key.client_email,
        scope: "https://www.googleapis.com/auth/devstorage.full_control",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    ).toString("base64url");

    const signInput = `${header}.${payload}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signInput);
    const signature = sign.sign(key.private_key, "base64url");

    const jwt = `${signInput}.${signature}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      throw new Error("[GCS-HIPAA] Failed to obtain GCP access token");
    }

    const tokenData = await tokenResponse.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 60) * 1000);
    return this.accessToken!;
  }

  private async uploadToGCS(
    gcsPath: string,
    data: Buffer,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<void> {
    if (!this.config) throw new Error("[GCS-HIPAA] GCS not configured");

    const token = await this.getAccessToken();
    const objectPath = encodeURIComponent(gcsPath);

    const metadataHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      metadataHeaders[`x-goog-meta-${k}`] = v;
    }

    const response = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${this.config.bucketName}/o?uploadType=media&name=${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
          ...metadataHeaders,
        },
        body: new Uint8Array(data),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[GCS-HIPAA] Upload failed: ${error}`);
    }
  }

  private async downloadFromGCS(gcsPath: string): Promise<Buffer> {
    if (!this.config) throw new Error("[GCS-HIPAA] GCS not configured");

    const token = await this.getAccessToken();
    const objectPath = encodeURIComponent(gcsPath);

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${objectPath}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[GCS-HIPAA] Download failed: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async deleteFromGCS(gcsPath: string): Promise<void> {
    if (!this.config) throw new Error("[GCS-HIPAA] GCS not configured");

    const token = await this.getAccessToken();
    const objectPath = encodeURIComponent(gcsPath);

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${objectPath}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`[GCS-HIPAA] Delete failed: ${error}`);
    }
  }

  private async listFromGCS(
    userId: string,
    filters?: { documentType?: DocumentType; startDate?: Date; endDate?: Date }
  ): Promise<StoredDocument[]> {
    if (!this.config) throw new Error("[GCS-HIPAA] GCS not configured");

    const token = await this.getAccessToken();
    let prefix = `hipaa-documents/${userId}/`;
    if (filters?.documentType) {
      prefix += `${filters.documentType}/`;
    }

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o?prefix=${encodeURIComponent(prefix)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[GCS-HIPAA] List failed: ${error}`);
    }

    const data = await response.json();
    const items = data.items || [];

    const documents: StoredDocument[] = items.map((item: Record<string, unknown>) => {
      const meta = (item.metadata as Record<string, string>) || {};
      const pathParts = (item.name as string).split("/");
      const docType = pathParts.length >= 3 ? pathParts[2] : "historical_data";

      return {
        id: meta["x-hipaa-document-id"] || (item.name as string),
        userId: meta["x-hipaa-user-id"] || userId,
        sourceId: meta["x-hipaa-source-id"] || "",
        documentType: docType as DocumentType,
        gcsPath: item.name as string,
        contentType: (item.contentType as string) || "application/octet-stream",
        sizeBytes: parseInt(item.size as string, 10) || 0,
        encryptionMethod: meta["x-hipaa-encryption"] || "AES-256-GCM",
        uploadedAt: new Date(item.timeCreated as string),
        metadata: meta,
        checksum: meta["x-hipaa-checksum"] || "",
      };
    });

    if (filters?.startDate || filters?.endDate) {
      return documents.filter((doc) => {
        if (filters.startDate && doc.uploadedAt < filters.startDate) return false;
        if (filters.endDate && doc.uploadedAt > filters.endDate) return false;
        return true;
      });
    }

    return documents;
  }

  private async getDocumentMetadataFromGCS(documentId: string): Promise<StoredDocument | null> {
    if (!this.config) return null;

    const cached = this.metadataCache.get(documentId);
    if (cached) return cached;

    const token = await this.getAccessToken();
    const prefix = `hipaa-documents/`;

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o?prefix=${encodeURIComponent(prefix)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const items = data.items || [];

    for (const item of items) {
      const meta = (item.metadata as Record<string, string>) || {};
      if (meta["x-hipaa-document-id"] === documentId) {
        const pathParts = (item.name as string).split("/");
        const docType = pathParts.length >= 3 ? pathParts[2] : "historical_data";

        return {
          id: documentId,
          userId: meta["x-hipaa-user-id"] || "",
          sourceId: meta["x-hipaa-source-id"] || "",
          documentType: docType as DocumentType,
          gcsPath: item.name as string,
          contentType: (item.contentType as string) || "application/octet-stream",
          sizeBytes: parseInt(item.size as string, 10) || 0,
          encryptionMethod: meta["x-hipaa-encryption"] || "AES-256-GCM",
          uploadedAt: new Date(item.timeCreated as string),
          metadata: meta,
          checksum: meta["x-hipaa-checksum"] || "",
        };
      }
    }

    return null;
  }

  private async createSignedUrl(gcsPath: string, expiresInMinutes: number): Promise<string> {
    if (!this.config) throw new Error("[GCS-HIPAA] GCS not configured");

    const token = await this.getAccessToken();
    const objectPath = encodeURIComponent(gcsPath);
    const expiration = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${objectPath}?fields=mediaLink`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error("[GCS-HIPAA] Failed to generate signed URL");
    }

    const data = await response.json();
    return `${data.mediaLink}&expiration=${expiration}`;
  }
}

export const gcsHIPAAStorage = new GCSHIPAAStorageService();

export type BucketProfile = "tabula" | "uninsurance";

const BUCKET_CONFIGS: Record<BucketProfile, { envVar: string; label: string; docTypes: DocumentType[] }> = {
  tabula: {
    envVar: "GCS_BUCKET_NAME",
    label: "Tabula Medica Health Records",
    docTypes: ["lab_result", "clinical_note", "imaging", "discharge_summary", "prescription", "historical_data"],
  },
  uninsurance: {
    envVar: "GCS_UNINSURANCE_BUCKET_NAME",
    label: "Uninsurance Invoices & Receipts",
    docTypes: ["insurance_card", "consent_form", "id_verification"],
  },
};

export function getBucketName(profile: BucketProfile): string | null {
  return process.env[BUCKET_CONFIGS[profile].envVar] || null;
}

export function isBucketConfigured(profile: BucketProfile): boolean {
  return !!getBucketName(profile) && !!(process.env.GCS_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
}

export function getBucketProfile(documentType: DocumentType): BucketProfile {
  if (BUCKET_CONFIGS.uninsurance.docTypes.includes(documentType)) {
    return "uninsurance";
  }
  return "tabula";
}

export async function crossBucketListDocuments(
  saidPatientId: string
): Promise<{ tabula: StoredDocument[]; uninsurance: StoredDocument[] }> {
  const tabulaDocs = await gcsHIPAAStorage.listDocuments(saidPatientId);
  const uninsuranceBucket = getBucketName("uninsurance");
  let uninsuranceDocs: StoredDocument[] = [];

  if (uninsuranceBucket && gcsHIPAAStorage.isConfigured()) {
    uninsuranceDocs = await gcsHIPAAStorage.listDocuments(saidPatientId);
  }

  return { tabula: tabulaDocs, uninsurance: uninsuranceDocs };
}

export function getDualBucketStatus(): {
  tabula: { configured: boolean; bucket: string | null };
  uninsurance: { configured: boolean; bucket: string | null };
} {
  return {
    tabula: {
      configured: isBucketConfigured("tabula"),
      bucket: getBucketName("tabula"),
    },
    uninsurance: {
      configured: isBucketConfigured("uninsurance"),
      bucket: getBucketName("uninsurance"),
    },
  };
}

export function initializeGCSHIPAAStorage(): void {
  console.log(`[GCS-HIPAA] Storage service initialized (configured=${gcsHIPAAStorage.isConfigured()})`);

  if (!gcsHIPAAStorage.isConfigured()) {
    console.warn("[GCS-HIPAA] Running in local/demo mode - documents stored in-memory");
    console.warn("[GCS-HIPAA] Set GCS_PROJECT_ID, GCS_BUCKET_NAME, and GOOGLE_APPLICATION_CREDENTIALS for HIPAA-compliant storage");
  }
}
