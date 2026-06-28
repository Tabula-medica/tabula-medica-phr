/**
 * Thin wrapper over expo-secure-store (Keychain on iOS, Keystore-backed
 * EncryptedSharedPreferences on Android). Used for the cached user profile
 * and the biometric-lock preference. The Firebase ID token itself is managed
 * + persisted by the Firebase SDK (AsyncStorage) and refreshed automatically,
 * so we deliberately do NOT copy it into a second store.
 *
 * HIPAA note: no PHI is stored here — only the minimal account identity
 * (id/email/display name) and local UX flags.
 */
import * as SecureStore from "expo-secure-store";
import type { User } from "./types";

const KEYS = {
  user: "tm.user",
  biometricEnabled: "tm.biometricEnabled",
} as const;

export async function saveUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.user);
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEYS.biometricEnabled, enabled ? "1" : "0");
}

export async function getBiometricEnabled(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEYS.biometricEnabled);
  // Default ON for a health app — biometric gate is opt-out, not opt-in.
  return raw === null ? true : raw === "1";
}
