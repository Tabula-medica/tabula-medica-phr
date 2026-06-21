import { useState, useCallback, useRef } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

interface FinalizeResponse {
  success: boolean;
  objectPath: string;
  verifiedSize: number;
  verifiedContentType: string;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * This hook implements a three-step presigned URL upload flow:
 * 1. Request a presigned URL from your backend (sends JSON metadata, NOT the file)
 * 2. Upload the file directly to the presigned URL
 * 3. Finalize the upload: server verifies actual object metadata (type/size) and
 *    deletes the object if constraints are violated (fail-closed)
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, isUploading, error } = useUpload({
 *     onSuccess: (response) => {
 *       console.log("Uploaded to:", response.objectPath);
 *     },
 *   });
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await uploadFile(file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isUploading} />
 *       {isUploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const fileIdToObjectPath = useRef<Map<string, string>>(new Map());

  /**
   * Request a presigned URL from the backend.
   * IMPORTANT: Send JSON metadata, NOT the file itself.
   */
  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    []
  );

  /**
   * Upload a file directly to the presigned URL.
   */
  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  /**
   * Finalize an upload by verifying actual object metadata server-side.
   * The server reads actual GCS metadata and deletes the object if it violates
   * size or content-type constraints (fail-closed).
   */
  const finalizeUpload = useCallback(
    async (objectPath: string): Promise<FinalizeResponse> => {
      const response = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ objectPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload finalization failed");
      }

      return response.json();
    },
    []
  );

  /**
   * Finalize an upload by Uppy file ID (used for Uppy-based uploads).
   * Looks up the objectPath registered during getUploadParameters.
   * Fails closed: throws if no mapping is found for the given fileId.
   */
  const finalizeByFileId = useCallback(
    async (fileId: string): Promise<void> => {
      const objectPath = fileIdToObjectPath.current.get(fileId);
      if (!objectPath) {
        throw new Error(`[useUpload] No objectPath registered for file ID "${fileId}". Upload cannot be accepted.`);
      }
      fileIdToObjectPath.current.delete(fileId);
      await finalizeUpload(objectPath);
    },
    [finalizeUpload]
  );

  /**
   * Upload a file using the three-step presigned URL flow.
   * Step 3 (finalize) verifies actual uploaded content and fails closed.
   *
   * @param file - The file to upload
   * @returns The upload response containing the object path, or null on failure
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Step 1: Request presigned URL (send metadata as JSON)
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        // Step 2: Upload file directly to presigned URL
        setProgress(40);
        await uploadToPresignedUrl(file, uploadResponse.uploadURL);

        // Step 3: Finalize — server verifies actual metadata and deletes if invalid
        setProgress(80);
        await finalizeUpload(uploadResponse.objectPath);

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, finalizeUpload, options]
  );

  /**
   * Get upload parameters for Uppy's AWS S3 plugin.
   * Registers the objectPath keyed by Uppy file.id so it can be finalized
   * via finalizeByFileId after the Uppy upload completes.
   *
   * IMPORTANT: This function receives the UppyFile object from Uppy.
   * Use file.name, file.size, file.type to request per-file presigned URLs.
   *
   * Use this with the ObjectUploader component and pass finalizeByFileId
   * as the onFinalize prop:
   * ```tsx
   * const { getUploadParameters, finalizeByFileId } = useUpload({...});
   * <ObjectUploader
   *   onGetUploadParameters={getUploadParameters}
   *   onFinalize={finalizeByFileId}
   * >
   *   Upload
   * </ObjectUploader>
   * ```
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data = await response.json();

      fileIdToObjectPath.current.set(file.id, data.objectPath);

      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    []
  );

  return {
    uploadFile,
    getUploadParameters,
    finalizeByFileId,
    isUploading,
    error,
    progress,
  };
}
