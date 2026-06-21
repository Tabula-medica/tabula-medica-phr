import crypto from "crypto";
import { ObjectStorageService, objectStorageClient, ObjectNotFoundError } from "../replit_integrations/object_storage/objectStorage";
import { setObjectAclPolicy, ObjectAclPolicy, ObjectPermission } from "../replit_integrations/object_storage/objectAcl";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface PhotoPrivacySettings {
  showInProfile: boolean;
  showToProviders: boolean;
  showToCaregivers: boolean;
  excludeFromExternalShares: boolean;
}

export interface ProfilePhotoMetadata {
  profileId: string;
  userId: string;
  originalFileName: string;
  contentType: string;
  encryptedPath: string;
  encryptionKeyHash: string;
  privacySettings: PhotoPrivacySettings;
  uploadedAt: string;
  sizeBytes: number;
}

const photoMetadataStore = new Map<string, ProfilePhotoMetadata>();

function getEncryptionKey(): Buffer {
  const keySource = process.env.SESSION_SECRET;
  if (!keySource) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production for photo encryption");
    return crypto.createHash("sha256").update("dev-only-photo-key").digest();
  }
  return crypto.createHash("sha256").update(keySource).digest();
}

function encryptData(data: Buffer): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return { encrypted, iv, authTag };
}

function decryptData(encrypted: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

interface PendingUploadIntent {
  userId: string;
  profileId: string;
  declaredContentType: string;
  declaredSizeBytes: number;
  expiresAt: number;
}

const pendingUploadIntents = new Map<string, PendingUploadIntent>();
const UPLOAD_INTENT_TTL_MS = 5 * 60 * 1000;

export class ProfilePhotoService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  async getUploadUrl(
    profileId: string,
    userId: string,
    declaredContentType: string,
    declaredSizeBytes: number,
  ): Promise<{ uploadUrl: string; objectPath: string }> {
    const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();
    const objectPath = this.objectStorage.normalizeObjectEntityPath(uploadUrl);

    pendingUploadIntents.set(objectPath, {
      userId,
      profileId,
      declaredContentType,
      declaredSizeBytes,
      expiresAt: Date.now() + UPLOAD_INTENT_TTL_MS,
    });

    return { uploadUrl, objectPath };
  }

  validateUploadIntent(objectPath: string, userId: string, profileId: string): boolean {
    const intent = pendingUploadIntents.get(objectPath);
    if (!intent) return false;
    if (Date.now() > intent.expiresAt) {
      pendingUploadIntents.delete(objectPath);
      return false;
    }
    const valid = intent.userId === userId && intent.profileId === profileId;
    if (valid) {
      pendingUploadIntents.delete(objectPath);
    }
    return valid;
  }

  async verifyUploadedFileMetadata(
    objectPath: string,
  ): Promise<{ ok: boolean; actualContentType: string; actualSizeBytes: number; error?: string }> {
    try {
      const file = await this.objectStorage.getObjectEntityFile(objectPath);
      const [meta] = await file.getMetadata();
      const actualContentType = String(meta.contentType ?? "");
      const actualSizeBytes = parseInt(String(meta.size ?? "0"), 10);

      if (!ALLOWED_PHOTO_TYPES.includes(actualContentType)) {
        try { await file.delete(); } catch (_) {}
        return {
          ok: false,
          actualContentType,
          actualSizeBytes,
          error: `Actual content type "${actualContentType}" is not an allowed image type. Object deleted.`,
        };
      }

      if (actualSizeBytes > MAX_PHOTO_SIZE) {
        try { await file.delete(); } catch (_) {}
        return {
          ok: false,
          actualContentType,
          actualSizeBytes,
          error: `Actual file size (${actualSizeBytes} bytes) exceeds the 5 MB limit. Object deleted.`,
        };
      }

      return { ok: true, actualContentType, actualSizeBytes };
    } catch (err: any) {
      return { ok: false, actualContentType: "", actualSizeBytes: 0, error: err.message };
    }
  }

  async savePhotoMetadata(
    profileId: string,
    userId: string,
    objectPath: string,
    originalFileName: string,
    contentType: string,
    sizeBytes: number,
    privacySettings: PhotoPrivacySettings
  ): Promise<ProfilePhotoMetadata> {
    const keyHash = crypto.createHash("sha256")
      .update(getEncryptionKey())
      .digest("hex")
      .substring(0, 16);

    const metadata: ProfilePhotoMetadata = {
      profileId,
      userId,
      originalFileName,
      contentType,
      encryptedPath: objectPath,
      encryptionKeyHash: keyHash,
      privacySettings,
      uploadedAt: new Date().toISOString(),
      sizeBytes,
    };

    photoMetadataStore.set(profileId, metadata);

    try {
      const file = await this.objectStorage.getObjectEntityFile(objectPath);
      const aclPolicy: ObjectAclPolicy = {
        owner: userId,
        visibility: "private",
      };
      await setObjectAclPolicy(file, aclPolicy);
    } catch (error) {
      console.error("[ProfilePhoto] Failed to set ACL policy:", error);
    }

    return metadata;
  }

  async getPhotoMetadata(profileId: string): Promise<ProfilePhotoMetadata | null> {
    return photoMetadataStore.get(profileId) || null;
  }

  async updatePrivacySettings(
    profileId: string,
    userId: string,
    settings: Partial<PhotoPrivacySettings>
  ): Promise<ProfilePhotoMetadata | null> {
    const metadata = photoMetadataStore.get(profileId);
    if (!metadata) {
      return null;
    }

    if (metadata.userId !== userId) {
      throw new Error("Unauthorized: Only the photo owner can update privacy settings");
    }

    const updatedMetadata: ProfilePhotoMetadata = {
      ...metadata,
      privacySettings: {
        ...metadata.privacySettings,
        ...settings,
      },
    };

    photoMetadataStore.set(profileId, updatedMetadata);
    return updatedMetadata;
  }

  async deletePhoto(profileId: string, userId: string): Promise<boolean> {
    const metadata = photoMetadataStore.get(profileId);
    if (!metadata) {
      return false;
    }

    if (metadata.userId !== userId) {
      throw new Error("Unauthorized: Only the photo owner can delete it");
    }

    try {
      const file = await this.objectStorage.getObjectEntityFile(metadata.encryptedPath);
      await file.delete();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        console.log("[ProfilePhoto] File already deleted from storage");
      } else {
        console.error("[ProfilePhoto] Failed to delete file from storage:", error);
      }
    }

    photoMetadataStore.delete(profileId);
    return true;
  }

  async canViewPhoto(
    profileId: string,
    requesterId: string,
    requesterRole: "owner" | "provider" | "caregiver" | "external"
  ): Promise<boolean> {
    const metadata = photoMetadataStore.get(profileId);
    if (!metadata) {
      return false;
    }

    if (metadata.userId === requesterId) {
      return true;
    }

    const { privacySettings } = metadata;

    if (requesterRole === "external" && privacySettings.excludeFromExternalShares) {
      return false;
    }

    if (requesterRole === "provider" && !privacySettings.showToProviders) {
      return false;
    }

    if (requesterRole === "caregiver" && !privacySettings.showToCaregivers) {
      return false;
    }

    return privacySettings.showInProfile;
  }

  async getPhotoDownloadUrl(
    profileId: string, 
    requesterId: string,
    requesterRole: "owner" | "provider" | "caregiver" | "external" = "owner"
  ): Promise<string | null> {
    const metadata = photoMetadataStore.get(profileId);
    if (!metadata) {
      return null;
    }

    if (metadata.userId !== requesterId) {
      const canView = await this.canViewPhoto(profileId, requesterId, requesterRole);
      if (!canView) {
        return null;
      }
    }

    try {
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const entityId = metadata.encryptedPath.replace("/objects/", "");
      const fullPath = `${privateDir}/${entityId}`;
      
      const parts = fullPath.slice(1).split("/");
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
      });
      
      return signedUrl;
    } catch (error) {
      console.error("[ProfilePhoto] Failed to get download URL:", error);
      return null;
    }
  }

  getDefaultPrivacySettings(): PhotoPrivacySettings {
    return {
      showInProfile: true,
      showToProviders: true,
      showToCaregivers: true,
      excludeFromExternalShares: true,
    };
  }

  async cleanupExpiredUploadIntents(): Promise<void> {
    const now = Date.now();
    for (const [objectPath, intent] of pendingUploadIntents.entries()) {
      if (now > intent.expiresAt) {
        pendingUploadIntents.delete(objectPath);
        try {
          const file = await this.objectStorage.getObjectEntityFile(objectPath);
          await file.delete();
          console.log(`[ProfilePhoto][UploadCleanup] Deleted expired unconfirmed photo: ${objectPath}`);
        } catch (_) {
        }
      }
    }
  }

  startCleanupScheduler(intervalMs: number = 60 * 1000): void {
    setInterval(() => {
      this.cleanupExpiredUploadIntents().catch((err) => {
        console.error("[ProfilePhoto][UploadCleanup] Cleanup error:", err);
      });
    }, intervalMs);
  }
}

export const profilePhotoService = new ProfilePhotoService();

console.log("[ProfilePhoto] Service initialized with encryption support");
console.log("[ProfilePhoto] NOTE: Photos stored in private object storage with server-side encryption");
console.log("[ProfilePhoto] NOTE: No biometric/identity verification processing is performed on photos");
