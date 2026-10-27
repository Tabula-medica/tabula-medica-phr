/**
 * SecureStore-backed Firebase Auth persistence (Task: C-1).
 *
 * Why: `getReactNativePersistence(AsyncStorage)` stores the Firebase ID +
 * refresh tokens in plaintext on Android and in the unprotected
 * Library/Application Support directory on iOS. The App Store reviewer
 * notes for this app claim "Firebase session tokens are held in iOS
 * Keychain via expo-secure-store" — so the AsyncStorage default was both
 * a security gap AND inconsistent with what we tell Apple.
 *
 * What: this module exposes an object with the AsyncStorage-shaped surface
 * (`getItem` / `setItem` / `removeItem`) that Firebase's
 * `getReactNativePersistence(...)` adapter expects, but backed by
 * `expo-secure-store` (iOS Keychain / Android Keystore) with
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY access.
 *
 * Constraints handled:
 *  - SecureStore values are capped at ~2 KB per key on iOS. Firebase
 *    auth state can exceed that when custom claims are present, so we
 *    chunk on write and reassemble on read. Chunk index keys live under
 *    the same logical name.
 *  - Web (SSR / dev browser) has no SecureStore, so callers should fall
 *    back to Firebase's default browser persistence on `Platform.OS === "web"`.
 *  - SecureStore key names are restricted to `[A-Za-z0-9._-]`. Firebase
 *    uses keys like `firebase:authUser:<apiKey>:[DEFAULT]`. We hash-encode
 *    them so they survive the SecureStore validator without losing
 *    uniqueness.
 */
import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = "__n";
const KEY_PREFIX = "fbauth_";

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function encodeKey(rawKey: string): string {
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash * 31 + rawKey.charCodeAt(i)) | 0;
  }
  const safe = rawKey.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);
  return `${KEY_PREFIX}${safe}_${(hash >>> 0).toString(36)}`;
}

async function clearChunks(baseKey: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(`${baseKey}${CHUNK_COUNT_SUFFIX}`);
  const n = meta ? parseInt(meta, 10) : 0;
  await SecureStore.deleteItemAsync(`${baseKey}${CHUNK_COUNT_SUFFIX}`);
  for (let i = 0; i < n; i++) {
    await SecureStore.deleteItemAsync(`${baseKey}_${i}`);
  }
}

export const secureFirebaseStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const baseKey = encodeKey(rawKey);
    try {
      const meta = await SecureStore.getItemAsync(`${baseKey}${CHUNK_COUNT_SUFFIX}`);
      if (!meta) return null;
      const n = parseInt(meta, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await SecureStore.getItemAsync(`${baseKey}_${i}`);
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join("");
    } catch {
      return null;
    }
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const baseKey = encodeKey(rawKey);
    await clearChunks(baseKey);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${baseKey}_${i}`, chunks[i], SECURE_OPTS);
    }
    await SecureStore.setItemAsync(
      `${baseKey}${CHUNK_COUNT_SUFFIX}`,
      String(chunks.length),
      SECURE_OPTS,
    );
  },

  async removeItem(rawKey: string): Promise<void> {
    await clearChunks(encodeKey(rawKey));
  },
};
