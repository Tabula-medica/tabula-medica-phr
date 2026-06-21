import type { Express, Request, Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getObjectAclPolicy, setObjectAclPolicy } from "./objectAcl";
import { isAuthenticated } from "../auth";
import { checkAndIncrementUserUploadQuota, UPLOAD_QUOTA_MAX_PER_WINDOW } from "../../utils/upload-rate-limit";

interface AuthUser {
  claims?: {
    sub?: string;
  };
}

function getAuthenticatedUserId(req: Request): string | null {
  const user = req.user as AuthUser | undefined;
  return user?.claims?.sub || null;
}

interface PendingUploadIntent {
  userId: string;
  objectPath: string;
  declaredContentType: string;
  declaredSize: number;
  maxAllowedSize: number;
  allowedContentTypes: string[];
  expiresAt: number;
}

const pendingUploadIntents = new Map<string, PendingUploadIntent>();
const INTENT_TTL_MS = 5 * 60 * 1000;

async function cleanupExpiredUploadIntents(objectStorageService: ObjectStorageService): Promise<void> {
  const now = Date.now();
  for (const [objectPath, intent] of pendingUploadIntents.entries()) {
    if (now > intent.expiresAt) {
      pendingUploadIntents.delete(objectPath);
      try {
        const file = await objectStorageService.getObjectEntityFile(objectPath);
        await file.delete();
        console.log(`[UploadCleanup] Deleted expired unfinalized object: ${objectPath}`);
      } catch (_) {
      }
    }
  }
}

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/json",
];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  setInterval(() => {
    cleanupExpiredUploadIntents(objectStorageService).catch((err) => {
      console.error("[UploadCleanup] Error during cleanup:", err);
    });
  }, 60 * 1000);

  /**
   * Request a presigned URL for file upload.
   * Requires authentication to prevent anonymous abuse of private storage.
   * Validates declared size and content type before issuing the URL.
   * The upload must be finalized via POST /api/uploads/finalize to be accepted.
   */
  app.post("/api/uploads/request-url", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      if (!contentType) {
        return res.status(400).json({
          error: "Missing required field: contentType",
        });
      }

      if (size === undefined || size === null) {
        return res.status(400).json({
          error: "Missing required field: size",
        });
      }

      if (typeof size !== "number" || size <= 0 || size > MAX_UPLOAD_SIZE) {
        return res.status(400).json({
          error: `Invalid file size. Must be between 1 byte and ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
        });
      }

      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        return res.status(400).json({
          error: `Invalid content type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
        });
      }

      if (!checkAndIncrementUserUploadQuota(userId)) {
        return res.status(429).json({
          error: `Upload quota exceeded. Maximum ${UPLOAD_QUOTA_MAX_PER_WINDOW} uploads allowed per hour per user.`,
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      pendingUploadIntents.set(objectPath, {
        userId,
        objectPath,
        declaredContentType: contentType,
        declaredSize: size,
        maxAllowedSize: MAX_UPLOAD_SIZE,
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        expiresAt: Date.now() + INTENT_TTL_MS,
      });

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Finalize an upload by verifying the actual object metadata in storage
   * matches the approved constraints from the request-url step.
   * If the object violates size or content-type constraints, it is deleted.
   */
  app.post("/api/uploads/finalize", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { objectPath } = req.body;
      if (!objectPath) {
        return res.status(400).json({ error: "Missing required field: objectPath" });
      }

      const intent = pendingUploadIntents.get(objectPath);
      if (!intent) {
        return res.status(403).json({ error: "No pending upload intent found for this object path" });
      }

      if (Date.now() > intent.expiresAt) {
        pendingUploadIntents.delete(objectPath);
        return res.status(403).json({ error: "Upload intent has expired" });
      }

      if (intent.userId !== userId) {
        return res.status(403).json({ error: "Upload intent belongs to a different user" });
      }

      pendingUploadIntents.delete(objectPath);

      let objectFile: Awaited<ReturnType<typeof objectStorageService.getObjectEntityFile>>;
      try {
        objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      } catch (err) {
        if (err instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Uploaded object not found in storage" });
        }
        throw err;
      }

      const [actualMetadata] = await objectFile.getMetadata();
      const actualSize = parseInt(String(actualMetadata.size ?? "0"), 10);
      const actualContentType = String(actualMetadata.contentType ?? "");

      const TOLERANCE_BYTES = 512;
      if (actualSize > intent.declaredSize + TOLERANCE_BYTES) {
        try { await objectFile.delete(); } catch (_) {}
        return res.status(400).json({
          error: `Uploaded file size (${actualSize} bytes) exceeds declared size (${intent.declaredSize} bytes). Object deleted.`,
        });
      }

      if (actualSize > intent.maxAllowedSize) {
        try { await objectFile.delete(); } catch (_) {}
        return res.status(400).json({
          error: `Uploaded file size (${actualSize} bytes) exceeds allowed maximum (${intent.maxAllowedSize} bytes). Object deleted.`,
        });
      }

      if (actualContentType !== intent.declaredContentType) {
        try { await objectFile.delete(); } catch (_) {}
        return res.status(400).json({
          error: `Uploaded file content type "${actualContentType}" does not match declared type "${intent.declaredContentType}". Object deleted.`,
        });
      }

      if (!intent.allowedContentTypes.includes(actualContentType)) {
        try { await objectFile.delete(); } catch (_) {}
        return res.status(400).json({
          error: `Uploaded file content type "${actualContentType}" is not allowed. Object deleted.`,
        });
      }

      await setObjectAclPolicy(objectFile, {
        owner: userId,
        visibility: "private",
      });

      res.json({
        success: true,
        objectPath,
        verifiedSize: actualSize,
        verifiedContentType: actualContentType,
      });
    } catch (error) {
      console.error("Error finalizing upload:", error);
      res.status(500).json({ error: "Failed to finalize upload" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * Public objects are served without authentication.
   * Private objects require an authenticated user who owns the file.
   */
  app.get("/objects/:objectPath(*)", async (req: Request, res: Response) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      const aclPolicy = await getObjectAclPolicy(objectFile);
      const isPublic = aclPolicy?.visibility === "public";

      if (!isPublic) {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
        });
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
