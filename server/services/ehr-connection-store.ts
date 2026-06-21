import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import type { EHRConnection } from "@shared/schema";

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || "";
const CONNECTIONS_PREFIX = "ehr-connections";

function getBucketAndPrefix() {
  if (!PRIVATE_DIR) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  const parts = PRIVATE_DIR.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucketName, prefix };
}

function connectionPath(connectionId: string): { bucketName: string; objectName: string } {
  const { bucketName, prefix } = getBucketAndPrefix();
  return {
    bucketName,
    objectName: `${prefix}/${CONNECTIONS_PREFIX}/${connectionId}.json`,
  };
}

function userIndexPath(userId: string): { bucketName: string; objectName: string } {
  const { bucketName, prefix } = getBucketAndPrefix();
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    bucketName,
    objectName: `${prefix}/${CONNECTIONS_PREFIX}/index/${safeUserId}.json`,
  };
}

export async function saveConnectionToCloud(connection: EHRConnection): Promise<void> {
  try {
    const { bucketName, objectName } = connectionPath(connection.id);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const safeConnection = { ...connection };
    delete (safeConnection as any).accessToken;
    delete (safeConnection as any).refreshToken;

    await file.save(JSON.stringify(safeConnection, null, 2), {
      contentType: "application/json",
      metadata: {
        userId: connection.userId,
        platform: connection.platform,
        createdAt: connection.createdAt,
      },
    });

    await updateUserIndex(connection.userId, connection.id, "add");

    console.log(`[EHRConnectionStore] Saved connection ${connection.id} to cloud storage`);
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to save connection ${connection.id}:`, error);
  }
}

export async function loadConnectionFromCloud(connectionId: string): Promise<EHRConnection | null> {
  try {
    const { bucketName, objectName } = connectionPath(connectionId);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) return null;

    const [content] = await file.download();
    return JSON.parse(content.toString()) as EHRConnection;
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to load connection ${connectionId}:`, error);
    return null;
  }
}

export async function loadUserConnectionsFromCloud(userId: string): Promise<string[]> {
  try {
    const { bucketName, objectName } = userIndexPath(userId);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) return [];

    const [content] = await file.download();
    const index = JSON.parse(content.toString());
    return index.connectionIds || [];
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to load user index for ${userId}:`, error);
    return [];
  }
}

export async function deleteConnectionFromCloud(connectionId: string, userId: string): Promise<void> {
  try {
    const { bucketName, objectName } = connectionPath(connectionId);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }

    await updateUserIndex(userId, connectionId, "remove");

    console.log(`[EHRConnectionStore] Deleted connection ${connectionId} from cloud storage`);
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to delete connection ${connectionId}:`, error);
  }
}

export async function saveSyncedDataToCloud(
  connectionId: string,
  resourceType: string,
  data: any
): Promise<void> {
  try {
    const { bucketName, prefix } = getBucketAndPrefix();
    const bucket = objectStorageClient.bucket(bucketName);
    const objectName = `${prefix}/${CONNECTIONS_PREFIX}/${connectionId}/fhir/${resourceType}.json`;
    const file = bucket.file(objectName);

    await file.save(JSON.stringify(data, null, 2), {
      contentType: "application/json",
      metadata: {
        connectionId,
        resourceType,
        syncedAt: new Date().toISOString(),
      },
    });

    console.log(`[EHRConnectionStore] Saved ${resourceType} data for connection ${connectionId}`);
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to save ${resourceType} for ${connectionId}:`, error);
  }
}

export async function loadSyncedDataFromCloud(
  connectionId: string,
  resourceType: string
): Promise<any | null> {
  try {
    const { bucketName, prefix } = getBucketAndPrefix();
    const bucket = objectStorageClient.bucket(bucketName);
    const objectName = `${prefix}/${CONNECTIONS_PREFIX}/${connectionId}/fhir/${resourceType}.json`;
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) return null;

    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (error) {
    console.error(`[EHRConnectionStore] Failed to load ${resourceType} for ${connectionId}:`, error);
    return null;
  }
}

async function updateUserIndex(userId: string, connectionId: string, action: "add" | "remove"): Promise<void> {
  const { bucketName, objectName } = userIndexPath(userId);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  let connectionIds: string[] = [];
  const [exists] = await file.exists();
  if (exists) {
    const [content] = await file.download();
    const index = JSON.parse(content.toString());
    connectionIds = index.connectionIds || [];
  }

  if (action === "add" && !connectionIds.includes(connectionId)) {
    connectionIds.push(connectionId);
  } else if (action === "remove") {
    connectionIds = connectionIds.filter((id) => id !== connectionId);
  }

  await file.save(JSON.stringify({ userId, connectionIds, updatedAt: new Date().toISOString() }), {
    contentType: "application/json",
  });
}
