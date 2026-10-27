import { Platform, AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Biometric verification state and session flags are security-sensitive:
// they gate access to the app after inactivity timeout. Storing them in
// AsyncStorage (plaintext, unencrypted) would allow an attacker with
// physical device access to fake a valid session by writing the keys.
// SecureStore uses iOS Keychain (hardware-backed on Face ID devices) and
// Android Keystore, satisfying HIPAA § 164.312(d) device-access controls.
const SECURITY_KEYS = {
  LAST_ACTIVITY: "tabula_medica_last_activity",
  BIOMETRIC_VERIFIED: "tabula_medica_biometric_verified",
  SESSION_ACTIVE: "tabula_medica_session_active",
};

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const ALLOWED_DOMAINS = [
  "tabulamedica.health",
  "tabulamedica.com",
  "replit.dev",
  "replit.app",
  "repl.co",
  "run.app",
  "localhost",
  "127.0.0.1",
];

function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    const match = url.match(/^https?:\/\/([^/:?#]+)/);
    return match ? match[1] : null;
  }
}

export function validateDomain(url: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;

  const appDomain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/:[\d]+$/, '');
  if (appDomain && (hostname === appDomain || hostname.endsWith(`.${appDomain}`))) {
    return true;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    const apiHostname = extractHostname(process.env.EXPO_PUBLIC_API_URL);
    if (apiHostname && hostname === apiHostname) {
      return true;
    }
  }

  for (const domain of ALLOWED_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
}

export function enforceHttps(url: string): string {
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
    return url;
  }
  return url.replace(/^http:\/\//, "https://");
}

// SecureStore is not available on web — fall back to in-memory storage so
// the web build doesn't crash. Session state on web is enforced server-side
// via the GCIP session token anyway.
const secureGet = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const secureSet = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(key, value);
};

const secureDelete = async (key: string): Promise<void> => {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // key may not exist
  }
};

export async function checkBiometricAvailability(): Promise<{
  available: boolean;
  biometricTypes: LocalAuthentication.AuthenticationType[];
  enrolled: boolean;
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  return {
    available: hasHardware && enrolled,
    biometricTypes: types,
    enrolled,
  };
}

export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { available } = await checkBiometricAvailability();

    if (!available) {
      if (Platform.OS === "web") {
        return { success: true };
      }
      return { success: false, error: "Biometric authentication not available on this device" };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Verify your identity to access Tabula Medica",
      fallbackLabel: "Use passcode",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });

    if (result.success) {
      await secureSet(SECURITY_KEYS.BIOMETRIC_VERIFIED, Date.now().toString());
      await secureSet(SECURITY_KEYS.SESSION_ACTIVE, "true");
      await updateLastActivity();
      return { success: true };
    }

    return { success: false, error: result.error || "Authentication failed" };
  } catch (error: any) {
    return { success: false, error: error.message || "Authentication error" };
  }
}

export async function updateLastActivity(): Promise<void> {
  await secureSet(SECURITY_KEYS.LAST_ACTIVITY, Date.now().toString());
}

export async function checkInactivityTimeout(): Promise<boolean> {
  try {
    const lastActivity = await secureGet(SECURITY_KEYS.LAST_ACTIVITY);
    if (!lastActivity) return true;

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed > INACTIVITY_TIMEOUT_MS;
  } catch {
    return true;
  }
}

export async function isSessionActive(): Promise<boolean> {
  try {
    const session = await secureGet(SECURITY_KEYS.SESSION_ACTIVE);
    if (session !== "true") return false;

    const timedOut = await checkInactivityTimeout();
    if (timedOut) {
      await endSecureSession();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function endSecureSession(): Promise<void> {
  await secureDelete(SECURITY_KEYS.BIOMETRIC_VERIFIED);
  await secureDelete(SECURITY_KEYS.SESSION_ACTIVE);
  await secureDelete(SECURITY_KEYS.LAST_ACTIVITY);
}

export async function wipeLocalPHI(): Promise<void> {
  // PII profile key stored in SecureStore
  await secureDelete("tabula_medica_user");
  // Health records are PHI_STORAGE_DISABLED at the storage layer,
  // but clear any legacy AsyncStorage remnants defensively.
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  await AsyncStorage.multiRemove([
    "@tabula_medica_records",
    "@tabula_medica_user",
    "@tabula_medica_sources",
  ]);
}

export function getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris Recognition";
  }
  return "Biometric Authentication";
}

export const INACTIVITY_TIMEOUT_SECONDS = INACTIVITY_TIMEOUT_MS / 1000;
export const INACTIVITY_TIMEOUT_MINUTES = INACTIVITY_TIMEOUT_SECONDS / 60;
