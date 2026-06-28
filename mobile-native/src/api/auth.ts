/**
 * High-level auth operations — wraps the GCIP/Firebase sign-in primitives
 * (api/gcip.ts) and the backend session handoff. Mirrors
 * tabula-medica-mobile/src/services/auth.ts but trimmed to what the native
 * rebuild's screens consume.
 */
import * as LocalAuthentication from "expo-local-authentication";
import { api } from "./client";
import {
  getGcipAuth,
  getGcipIdToken,
  signInGcipWithEmail,
  signUpGcipWithEmail,
  sendGcipEmailVerification,
  sendGcipPasswordResetEmail,
  signOutGcip,
  type FirebaseUser,
} from "./gcip";
import type { GcipSessionResponse, MeResponse, User } from "./types";

export function firebaseUserToUser(fb: FirebaseUser): User {
  return {
    id: fb.uid,
    email: fb.email ?? "",
    name: fb.displayName || fb.email?.split("@")[0] || "Patient",
    role: "patient",
    emailVerified: fb.emailVerified,
  };
}

/**
 * Records the login server-side (security audit) and learns onboarding status.
 * Bearer auth keeps working regardless via the client interceptor, so callers
 * may treat sign-in as successful even if this returns null.
 */
export async function exchangeGcipSession(): Promise<{
  user: User;
  needsOnboarding: boolean | null;
} | null> {
  const token = await getGcipIdToken(true);
  if (!token) return null;
  try {
    const data = await api.post<GcipSessionResponse>("/api/mobile/auth/gcip/session");
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        emailVerified: getGcipAuth().currentUser?.emailVerified ?? false,
      },
      needsOnboarding: data.needsOnboarding ?? null,
    };
  } catch {
    return null;
  }
}

export interface SignInResult {
  user: User;
  needsOnboarding: boolean | null;
  emailVerified: boolean;
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const fb = await signInGcipWithEmail(email.trim(), password);
  const handoff = fb.emailVerified ? await exchangeGcipSession() : null;
  return {
    user: handoff?.user ?? firebaseUserToUser(fb),
    needsOnboarding: handoff?.needsOnboarding ?? null,
    emailVerified: fb.emailVerified,
  };
}

export async function registerWithEmail(email: string, password: string): Promise<SignInResult> {
  const fb = await signUpGcipWithEmail(email.trim(), password);
  // Backend only links a Firebase identity to a real patient account once
  // email_verified === true, so kick off verification immediately.
  try {
    await sendGcipEmailVerification(fb);
  } catch {
    // surfaced via the resend action; don't block sign-up
  }
  return { user: firebaseUserToUser(fb), needsOnboarding: null, emailVerified: false };
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendGcipPasswordResetEmail(email.trim());
}

export async function resendVerificationEmail(): Promise<boolean> {
  return sendGcipEmailVerification();
}

export async function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>("/api/me");
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/mobile/auth/logout");
  } catch {
    // best-effort server audit; we sign out locally regardless
  }
  await signOutGcip();
}

// ─── Biometric (device-local) gate ──────────────────────────────────────────

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, types };
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Tabula Medica",
    fallbackLabel: "Use device passcode",
    disableDeviceFallback: false,
  });
  return result.success;
}
