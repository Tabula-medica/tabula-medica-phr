import { Express, Request, Response } from "express";
import { profilePhotoService, PhotoPrivacySettings } from "./services/profile-photo-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { checkAndIncrementUserUploadQuota, UPLOAD_QUOTA_MAX_PER_WINDOW } from "./utils/upload-rate-limit";

interface AuthUser {
  claims?: {
    sub?: string;
  };
}

function getAuthenticatedUserId(req: Request): string | null {
  const user = req.user as AuthUser | undefined;
  return user?.claims?.sub || null;
}


export function registerProfilePhotoRoutes(app: Express) {
  app.post("/api/profile-photos/request-upload", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { profileId, fileName, contentType, sizeBytes } = req.body;

      if (!profileId) {
        return res.status(400).json({ error: "Profile ID is required" });
      }

      if (profileId !== userId) {
        return res.status(403).json({ error: "You can only request uploads for your own profile" });
      }

      if (!contentType) {
        return res.status(400).json({ error: "contentType is required" });
      }

      if (sizeBytes === undefined || sizeBytes === null) {
        return res.status(400).json({ error: "sizeBytes is required" });
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ 
          error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" 
        });
      }

      const maxSize = 5 * 1024 * 1024;
      if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > maxSize) {
        return res.status(400).json({ 
          error: "File too large or invalid. Maximum size: 5MB" 
        });
      }

      if (!checkAndIncrementUserUploadQuota(userId)) {
        return res.status(429).json({
          error: `Upload quota exceeded. Maximum ${UPLOAD_QUOTA_MAX_PER_WINDOW} uploads allowed per hour.`,
        });
      }

      const { uploadUrl, objectPath } = await profilePhotoService.getUploadUrl(profileId, userId, contentType, sizeBytes);

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "profile_photo",
        resourceId: profileId,
        details: `Request upload for profile ${profileId}: ${fileName || "unknown"}`,
      });

      res.json({
        success: true,
        uploadUrl,
        objectPath,
        expiresIn: 300,
      });
    } catch (error) {
      console.error("[ProfilePhoto] Upload request failed:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/profile-photos/confirm-upload", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { 
        profileId, 
        objectPath, 
        originalFileName, 
        contentType, 
        sizeBytes,
        privacySettings 
      } = req.body;

      if (!profileId || !objectPath) {
        return res.status(400).json({ error: "Profile ID and object path are required" });
      }

      if (profileId !== userId) {
        return res.status(403).json({ error: "You can only confirm uploads for your own profile" });
      }

      const intentValid = profilePhotoService.validateUploadIntent(objectPath, userId, profileId);
      if (!intentValid) {
        return res.status(403).json({ error: "Invalid or expired upload intent for the provided object path" });
      }

      const fileCheck = await profilePhotoService.verifyUploadedFileMetadata(objectPath);
      if (!fileCheck.ok) {
        return res.status(400).json({ error: fileCheck.error || "Uploaded file failed validation" });
      }

      const settings: PhotoPrivacySettings = {
        showInProfile: privacySettings?.showInProfile ?? true,
        showToProviders: privacySettings?.showToProviders ?? true,
        showToCaregivers: privacySettings?.showToCaregivers ?? true,
        excludeFromExternalShares: privacySettings?.excludeFromExternalShares ?? true,
      };

      const metadata = await profilePhotoService.savePhotoMetadata(
        profileId,
        userId,
        objectPath,
        originalFileName || "profile-photo",
        fileCheck.actualContentType,
        fileCheck.actualSizeBytes,
        settings
      );

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "profile_photo",
        resourceId: profileId,
        details: `Confirmed photo upload for profile ${profileId}`,
      });

      res.json({
        success: true,
        metadata: {
          profileId: metadata.profileId,
          uploadedAt: metadata.uploadedAt,
          privacySettings: metadata.privacySettings,
        },
      });
    } catch (error) {
      console.error("[ProfilePhoto] Confirm upload failed:", error);
      res.status(500).json({ error: "Failed to confirm photo upload" });
    }
  });

  app.get("/api/profile-photos/:profileId", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { profileId } = req.params;

      const metadata = await profilePhotoService.getPhotoMetadata(profileId);
      if (!metadata) {
        return res.status(404).json({ error: "Photo not found" });
      }

      const isOwner = metadata.userId === userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Access denied" });
      }

      const downloadUrl = await profilePhotoService.getPhotoDownloadUrl(profileId, userId, "owner");

      logPhiAccess({
        userId,
        action: "read",
        resourceType: "profile_photo",
        resourceId: profileId,
        details: `View photo for profile ${profileId}`,
      });

      res.json({
        success: true,
        photoUrl: downloadUrl,
        metadata: {
          profileId: metadata.profileId,
          uploadedAt: metadata.uploadedAt,
          privacySettings: metadata.privacySettings,
        },
      });
    } catch (error) {
      console.error("[ProfilePhoto] Get photo failed:", error);
      res.status(500).json({ error: "Failed to retrieve photo" });
    }
  });

  app.get("/api/profile-photos/:profileId/metadata", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { profileId } = req.params;

      if (profileId !== userId) {
        return res.status(403).json({ error: "You can only access your own profile photo metadata" });
      }

      const metadata = await profilePhotoService.getPhotoMetadata(profileId);
      if (!metadata) {
        return res.json({
          success: true,
          hasPhoto: false,
        });
      }

      res.json({
        success: true,
        hasPhoto: true,
        isOwner: true,
        metadata: {
          profileId: metadata.profileId,
          uploadedAt: metadata.uploadedAt,
          privacySettings: metadata.privacySettings,
          sizeBytes: metadata.sizeBytes,
          contentType: metadata.contentType,
        },
      });
    } catch (error) {
      console.error("[ProfilePhoto] Get metadata failed:", error);
      res.status(500).json({ error: "Failed to retrieve photo metadata" });
    }
  });

  app.patch("/api/profile-photos/:profileId/privacy", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { profileId } = req.params;
      const { privacySettings } = req.body;

      if (!privacySettings) {
        return res.status(400).json({ error: "Privacy settings are required" });
      }

      if (profileId !== userId) {
        return res.status(403).json({ error: "You can only update privacy settings for your own profile" });
      }

      const metadata = await profilePhotoService.updatePrivacySettings(
        profileId,
        userId,
        privacySettings
      );

      if (!metadata) {
        return res.status(404).json({ error: "Photo not found" });
      }

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "profile_photo",
        resourceId: profileId,
        details: `Updated privacy settings for profile photo ${profileId}`,
      });

      res.json({
        success: true,
        privacySettings: metadata.privacySettings,
      });
    } catch (error: any) {
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[ProfilePhoto] Update privacy failed:", error);
      res.status(500).json({ error: "Failed to update privacy settings" });
    }
  });

  app.delete("/api/profile-photos/:profileId", async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { profileId } = req.params;

      if (profileId !== userId) {
        return res.status(403).json({ error: "You can only delete your own profile photo" });
      }

      const deleted = await profilePhotoService.deletePhoto(profileId, userId);

      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }

      logPhiAccess({
        userId,
        action: "delete",
        resourceType: "profile_photo",
        resourceId: profileId,
        details: `Deleted photo for profile ${profileId}`,
      });

      res.json({
        success: true,
        message: "Photo deleted successfully",
      });
    } catch (error: any) {
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[ProfilePhoto] Delete photo failed:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  app.get("/api/profile-photos/defaults/privacy", async (_req: Request, res: Response) => {
    res.json({
      success: true,
      defaultPrivacySettings: profilePhotoService.getDefaultPrivacySettings(),
    });
  });

  profilePhotoService.startCleanupScheduler(60 * 1000);
  console.log("[Routes] Profile Photo routes registered at /api/profile-photos/*");
  console.log("[Routes] Profile Photo upload cleanup scheduler started (60s interval)");
}
