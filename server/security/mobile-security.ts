import type { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import { logPhiAccess } from "./hipaa-audit";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").substring(0, 12);
}

export const atsSecurityHeaders: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // In dev, allow Vite HMR WebSocket on localhost / replit dev hosts so the
  // hot-reload client can connect. Stripped from prod CSP.
  const isDev = process.env.NODE_ENV !== "production";
  const devConnectSrc = isDev
    ? " ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://*.replit.dev wss://*.picard.replit.dev"
    : "";
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.fastenhealth.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.fastenhealth.com https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
    "connect-src 'self' " +
    "https://api.tabulamedica.health " +
    "https://tabulamedica.health " +
    "https://healthcare.googleapis.com " +
    // Firebase / GCIP auth endpoints — REQUIRED for login; without these the
    // browser blocks the auth fetch and the SDK reports auth/internal-error.
    "https://identitytoolkit.googleapis.com " +
    "https://securetoken.googleapis.com " +
    "https://www.googleapis.com " +
    "https://united-planet-485003-n7-9f345.firebaseapp.com " +
    "https://rxnav.nlm.nih.gov " +
    "https://clinicaltables.nlm.nih.gov " +
    "wss://api.tabulamedica.health" + devConnectSrc + "; " +
    // frame-src: allow the Firebase auth-domain + Google/Apple sign-in popups.
    "frame-src 'self' https://*.fastenhealth.com https://fastenhealth.com https://united-planet-485003-n7-9f345.firebaseapp.com https://accounts.google.com https://appleid.apple.com; " +
    "frame-ancestors 'self' *.tabulamedica.health tabulamedica.health *.replit.dev *.replit.app *.picard.replit.dev; " +
    "base-uri 'self'; " +
    "form-action 'self' https://*.fastenhealth.com https://united-planet-485003-n7-9f345.firebaseapp.com https://accounts.google.com https://appleid.apple.com;"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", 
    "accelerometer=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()"
  );
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  
  next();
};

const HEALTH_CHECK_PATHS = new Set(["/", "/health", "/api/health"]);

function isInternalHealthCheck(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return (
    HEALTH_CHECK_PATHS.has(req.path) ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  );
}

export const enforceHttps: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (isInternalHealthCheck(req)) {
    return next();
  }

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  
  if (proto !== "https" && process.env.NODE_ENV === "production") {
    res.redirect(301, `https://${req.headers.host}${req.url}`);
    return;
  }
  
  next();
};

export interface SessionTimeoutPreferences {
  userId: string;
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
  autoLockEnabled: boolean;
  autoLockDelaySeconds: number;
  requireBiometricOnResume: boolean;
  extendOnActivity: boolean;
  warningBeforeTimeoutSeconds: number;
}

const DEFAULT_PREFERENCES: Omit<SessionTimeoutPreferences, "userId"> = {
  idleTimeoutMinutes: 15,
  absoluteTimeoutHours: 8,
  autoLockEnabled: true,
  autoLockDelaySeconds: 300,
  requireBiometricOnResume: false,
  extendOnActivity: true,
  warningBeforeTimeoutSeconds: 60,
};

const ALLOWED_TIMEOUT_RANGES = {
  idleTimeoutMinutes: { min: 5, max: 60 },
  absoluteTimeoutHours: { min: 1, max: 24 },
  autoLockDelaySeconds: { min: 30, max: 900 },
  warningBeforeTimeoutSeconds: { min: 30, max: 300 },
};

const userTimeoutPreferences = new Map<string, SessionTimeoutPreferences>();

class ConfigurableSessionTimeoutService {
  getPreferences(userId: string): SessionTimeoutPreferences {
    return userTimeoutPreferences.get(userId) || { userId, ...DEFAULT_PREFERENCES };
  }

  updatePreferences(userId: string, updates: Partial<Omit<SessionTimeoutPreferences, "userId">>): SessionTimeoutPreferences {
    const current = this.getPreferences(userId);
    
    const validated: SessionTimeoutPreferences = { ...current };

    if (updates.idleTimeoutMinutes !== undefined && typeof updates.idleTimeoutMinutes === "number" && !isNaN(updates.idleTimeoutMinutes)) {
      validated.idleTimeoutMinutes = Math.max(
        ALLOWED_TIMEOUT_RANGES.idleTimeoutMinutes.min,
        Math.min(ALLOWED_TIMEOUT_RANGES.idleTimeoutMinutes.max, Math.floor(updates.idleTimeoutMinutes))
      );
    }

    if (updates.absoluteTimeoutHours !== undefined && typeof updates.absoluteTimeoutHours === "number" && !isNaN(updates.absoluteTimeoutHours)) {
      validated.absoluteTimeoutHours = Math.max(
        ALLOWED_TIMEOUT_RANGES.absoluteTimeoutHours.min,
        Math.min(ALLOWED_TIMEOUT_RANGES.absoluteTimeoutHours.max, Math.floor(updates.absoluteTimeoutHours))
      );
    }

    if (updates.autoLockDelaySeconds !== undefined && typeof updates.autoLockDelaySeconds === "number" && !isNaN(updates.autoLockDelaySeconds)) {
      validated.autoLockDelaySeconds = Math.max(
        ALLOWED_TIMEOUT_RANGES.autoLockDelaySeconds.min,
        Math.min(ALLOWED_TIMEOUT_RANGES.autoLockDelaySeconds.max, Math.floor(updates.autoLockDelaySeconds))
      );
    }

    if (updates.warningBeforeTimeoutSeconds !== undefined && typeof updates.warningBeforeTimeoutSeconds === "number" && !isNaN(updates.warningBeforeTimeoutSeconds)) {
      validated.warningBeforeTimeoutSeconds = Math.max(
        ALLOWED_TIMEOUT_RANGES.warningBeforeTimeoutSeconds.min,
        Math.min(ALLOWED_TIMEOUT_RANGES.warningBeforeTimeoutSeconds.max, Math.floor(updates.warningBeforeTimeoutSeconds))
      );
    }

    if (typeof updates.autoLockEnabled === "boolean") {
      validated.autoLockEnabled = updates.autoLockEnabled;
    }

    if (typeof updates.requireBiometricOnResume === "boolean") {
      validated.requireBiometricOnResume = updates.requireBiometricOnResume;
    }

    if (typeof updates.extendOnActivity === "boolean") {
      validated.extendOnActivity = updates.extendOnActivity;
    }

    userTimeoutPreferences.set(userId, validated);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "SecuritySettings",
      resourceId: userId,
      details: `Updated session timeout preferences`,
    });

    return validated;
  }

  resetToDefaults(userId: string): SessionTimeoutPreferences {
    const defaults: SessionTimeoutPreferences = { userId, ...DEFAULT_PREFERENCES };
    userTimeoutPreferences.set(userId, defaults);
    return defaults;
  }

  getTimeoutRanges(): typeof ALLOWED_TIMEOUT_RANGES {
    return ALLOWED_TIMEOUT_RANGES;
  }

  getIdleTimeoutMs(userId: string): number {
    const prefs = this.getPreferences(userId);
    return prefs.idleTimeoutMinutes * 60 * 1000;
  }

  getAbsoluteTimeoutMs(userId: string): number {
    const prefs = this.getPreferences(userId);
    return prefs.absoluteTimeoutHours * 60 * 60 * 1000;
  }
}

export const configurableSessionTimeout = new ConfigurableSessionTimeoutService();

export interface SecureNotification {
  id: string;
  userId: string;
  type: "medication_reminder" | "appointment" | "message" | "alert" | "system";
  title: string;
  body: string;
  phiMaskedTitle: string;
  phiMaskedBody: string;
  data: Record<string, string>;
  priority: "high" | "normal" | "low";
  category: string;
  sound: boolean;
  badge: number;
  createdAt: string;
  expiresAt?: string;
  delivered: boolean;
  read: boolean;
}

class SecurePushNotificationService {
  private notifications = new Map<string, SecureNotification[]>();

  createSecureNotification(params: {
    userId: string;
    type: SecureNotification["type"];
    title: string;
    body: string;
    data?: Record<string, string>;
    priority?: SecureNotification["priority"];
    expiresInMinutes?: number;
  }): SecureNotification {
    const notification: SecureNotification = {
      id: crypto.randomUUID(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      phiMaskedTitle: this.maskPhiInText(params.title, params.type),
      phiMaskedBody: this.maskPhiInText(params.body, params.type),
      data: this.sanitizeNotificationData(params.data || {}),
      priority: params.priority || "normal",
      category: this.getCategoryForType(params.type),
      sound: params.priority === "high",
      badge: 1,
      createdAt: new Date().toISOString(),
      expiresAt: params.expiresInMinutes 
        ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000).toISOString()
        : undefined,
      delivered: false,
      read: false,
    };

    const userNotifications = this.notifications.get(params.userId) || [];
    userNotifications.push(notification);
    this.notifications.set(params.userId, userNotifications);

    logPhiAccess({
      userId: params.userId,
      action: "write",
      resourceType: "Notification",
      resourceId: notification.id,
      details: `Created ${params.type} notification (PHI masked for push)`,
    });

    return notification;
  }

  private maskPhiInText(text: string, type: SecureNotification["type"]): string {
    const genericMessages: Record<SecureNotification["type"], { title: string; body: string }> = {
      medication_reminder: {
        title: "Medication Reminder",
        body: "You have a medication scheduled. Open app for details.",
      },
      appointment: {
        title: "Appointment Reminder",
        body: "You have an upcoming appointment. Open app for details.",
      },
      message: {
        title: "New Message",
        body: "You have a new message. Open app to read.",
      },
      alert: {
        title: "Health Alert",
        body: "Important health update. Open app for details.",
      },
      system: {
        title: "System Notification",
        body: text,
      },
    };

    return genericMessages[type]?.body || "Open app for details.";
  }

  private sanitizeNotificationData(data: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedKeys = ["notificationId", "type", "action", "targetRoute", "priority"];
    
    for (const key of allowedKeys) {
      if (data[key]) {
        sanitized[key] = data[key];
      }
    }
    
    return sanitized;
  }

  private getCategoryForType(type: SecureNotification["type"]): string {
    const categories: Record<SecureNotification["type"], string> = {
      medication_reminder: "MEDICATION",
      appointment: "APPOINTMENT",
      message: "MESSAGE",
      alert: "ALERT",
      system: "SYSTEM",
    };
    return categories[type] || "GENERAL";
  }

  getPushPayload(notification: SecureNotification): {
    title: string;
    body: string;
    data: Record<string, string>;
    apns?: object;
    fcm?: object;
  } {
    return {
      title: notification.phiMaskedTitle,
      body: notification.phiMaskedBody,
      data: {
        ...notification.data,
        notificationId: notification.id,
        type: notification.type,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.phiMaskedTitle,
              body: notification.phiMaskedBody,
            },
            sound: notification.sound ? "default" : undefined,
            badge: notification.badge,
            category: notification.category,
            "content-available": 1,
            "mutable-content": 1,
          },
        },
        headers: {
          "apns-priority": notification.priority === "high" ? "10" : "5",
          "apns-push-type": "alert",
        },
      },
      fcm: {
        notification: {
          title: notification.phiMaskedTitle,
          body: notification.phiMaskedBody,
          sound: notification.sound ? "default" : undefined,
          badge: notification.badge.toString(),
          click_action: notification.category,
        },
        android: {
          priority: notification.priority === "high" ? "high" : "normal",
          notification: {
            channel_id: notification.category.toLowerCase(),
          },
        },
      },
    };
  }

  getFullNotificationContent(userId: string, notificationId: string): SecureNotification | null {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "Notification",
        resourceId: notificationId,
        details: "Viewed full notification content in app",
      });
    }
    
    return notification || null;
  }

  getUserNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }): SecureNotification[] {
    let notifications = this.notifications.get(userId) || [];
    
    const now = new Date().toISOString();
    notifications = notifications.filter(n => !n.expiresAt || n.expiresAt > now);
    
    if (options?.unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (options?.limit) {
      notifications = notifications.slice(0, options.limit);
    }
    
    return notifications;
  }

  markAsDelivered(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.delivered = true;
      return true;
    }
    
    return false;
  }

  getUnreadCount(userId: string): number {
    const notifications = this.notifications.get(userId) || [];
    return notifications.filter(n => !n.read).length;
  }

  clearNotifications(userId: string): void {
    this.notifications.delete(userId);
  }
}

export const securePushNotifications = new SecurePushNotificationService();

export interface BiometricCredential {
  id: string;
  credentialId: string;
  userId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
  deviceType: "fingerprint" | "face" | "pin" | "pattern" | "unknown";
  createdAt: string;
  lastUsedAt: string;
  enabled: boolean;
}

export interface WebAuthnChallenge {
  challenge: string;
  userId: string;
  type: "registration" | "authentication";
  createdAt: string;
  expiresAt: string;
}

const biometricCredentials = new Map<string, BiometricCredential[]>();
const pendingChallenges = new Map<string, WebAuthnChallenge>();

class BiometricAuthService {
  private readonly RP_NAME = "Tabula Medica";
  private readonly RP_ID = process.env.REPLIT_DEV_DOMAIN || "localhost";
  private readonly CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000;

  /* 
   * PRODUCTION NOTE: This implementation provides the WebAuthn ceremony flow
   * and challenge/counter validation. For production deployment, integrate
   * a vetted WebAuthn library (e.g., @simplewebauthn/server) for:
   * - Full CBOR attestation parsing and signature verification
   * - Origin/RP ID binding validation
   * - Authenticator data parsing with flags verification
   * Current implementation validates: challenge binding, counter increment,
   * credential lookup, expiration, and user association.
   */

  generateRegistrationOptions(userId: string, username: string): {
    challenge: string;
    rp: { name: string; id: string };
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: { type: "public-key"; alg: number }[];
    timeout: number;
    attestation: string;
    authenticatorSelection: {
      authenticatorAttachment?: string;
      requireResidentKey: boolean;
      userVerification: string;
    };
    excludeCredentials: { id: string; type: "public-key" }[];
  } {
    const challenge = crypto.randomBytes(32).toString("base64url");
    const userIdBuffer = Buffer.from(userId).toString("base64url");

    const existingCredentials = biometricCredentials.get(userId) || [];

    const webAuthnChallenge: WebAuthnChallenge = {
      challenge,
      userId,
      type: "registration",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CHALLENGE_TIMEOUT_MS).toISOString(),
    };
    pendingChallenges.set(challenge, webAuthnChallenge);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "BiometricCredential",
      resourceId: challenge,
      details: "Biometric registration started",
    });

    return {
      challenge,
      rp: {
        name: this.RP_NAME,
        id: this.RP_ID,
      },
      user: {
        id: userIdBuffer,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: this.CHALLENGE_TIMEOUT_MS,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "required",
      },
      excludeCredentials: existingCredentials.map(c => ({
        id: c.credentialId,
        type: "public-key" as const,
      })),
    };
  }

  async verifyRegistration(
    userId: string,
    challenge: string,
    credentialId: string,
    publicKey: string,
    deviceName: string,
    deviceType: BiometricCredential["deviceType"]
  ): Promise<{ success: boolean; credentialId?: string; error?: string }> {
    const pendingChallenge = pendingChallenges.get(challenge);
    
    if (!pendingChallenge) {
      return { success: false, error: "Challenge not found or expired" };
    }

    if (new Date(pendingChallenge.expiresAt) < new Date()) {
      pendingChallenges.delete(challenge);
      return { success: false, error: "Challenge expired" };
    }

    if (pendingChallenge.userId !== userId || pendingChallenge.type !== "registration") {
      return { success: false, error: "Invalid challenge" };
    }

    pendingChallenges.delete(challenge);

    const credential: BiometricCredential = {
      id: crypto.randomUUID(),
      credentialId,
      userId,
      publicKey,
      counter: 0,
      deviceName,
      deviceType,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      enabled: true,
    };

    const userCredentials = biometricCredentials.get(userId) || [];
    userCredentials.push(credential);
    biometricCredentials.set(userId, userCredentials);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "BiometricCredential",
      resourceId: credential.id,
      details: `Biometric registration complete: ${deviceType} ${deviceName}`,
    });

    return { success: true, credentialId: credential.id };
  }

  generateAuthenticationOptions(userId: string): {
    challenge: string;
    timeout: number;
    rpId: string;
    userVerification: string;
    allowCredentials: { id: string; type: "public-key"; transports?: string[] }[];
  } | null {
    const userCredentials = biometricCredentials.get(userId) || [];
    const enabledCredentials = userCredentials.filter(c => c.enabled);

    if (enabledCredentials.length === 0) {
      return null;
    }

    const challenge = crypto.randomBytes(32).toString("base64url");

    const webAuthnChallenge: WebAuthnChallenge = {
      challenge,
      userId,
      type: "authentication",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CHALLENGE_TIMEOUT_MS).toISOString(),
    };
    pendingChallenges.set(challenge, webAuthnChallenge);

    return {
      challenge,
      timeout: this.CHALLENGE_TIMEOUT_MS,
      rpId: this.RP_ID,
      userVerification: "required",
      allowCredentials: enabledCredentials.map(c => ({
        id: c.credentialId,
        type: "public-key" as const,
        transports: ["internal"],
      })),
    };
  }

  async verifyAuthentication(
    userId: string,
    challenge: string,
    credentialId: string,
    signature: string,
    counter: number
  ): Promise<{ success: boolean; error?: string }> {
    const pendingChallenge = pendingChallenges.get(challenge);
    
    if (!pendingChallenge) {
      return { success: false, error: "Challenge not found or expired" };
    }

    if (new Date(pendingChallenge.expiresAt) < new Date()) {
      pendingChallenges.delete(challenge);
      return { success: false, error: "Challenge expired" };
    }

    if (pendingChallenge.userId !== userId || pendingChallenge.type !== "authentication") {
      return { success: false, error: "Invalid challenge" };
    }

    pendingChallenges.delete(challenge);

    const userCredentials = biometricCredentials.get(userId) || [];
    const credential = userCredentials.find(c => c.credentialId === credentialId);

    if (!credential) {
      return { success: false, error: "Credential not found" };
    }

    if (!credential.enabled) {
      return { success: false, error: "Credential disabled" };
    }

    if (counter <= credential.counter) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "BiometricCredential",
        resourceId: credential.id,
        details: "SECURITY_ALERT: Potential credential cloning detected - counter not incremented",
      });
      return { success: false, error: "Invalid credential counter" };
    }

    credential.counter = counter;
    credential.lastUsedAt = new Date().toISOString();

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "BiometricCredential",
      resourceId: credential.id,
      details: `Authenticated using ${credential.deviceType}: ${credential.deviceName}`,
    });

    return { success: true };
  }

  getUserCredentials(userId: string): Omit<BiometricCredential, "publicKey">[] {
    const credentials = biometricCredentials.get(userId) || [];
    return credentials.map(c => ({
      id: c.id,
      credentialId: c.credentialId,
      userId: c.userId,
      counter: c.counter,
      deviceName: c.deviceName,
      deviceType: c.deviceType,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      enabled: c.enabled,
    }));
  }

  toggleCredential(userId: string, credentialId: string, enabled: boolean): boolean {
    const userCredentials = biometricCredentials.get(userId) || [];
    const credential = userCredentials.find(c => c.id === credentialId);

    if (!credential) {
      return false;
    }

    credential.enabled = enabled;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "BiometricCredential",
      resourceId: credentialId,
      details: `${enabled ? "Enabled" : "Disabled"} credential: ${credential.deviceName}`,
    });

    return true;
  }

  removeCredential(userId: string, credentialId: string): boolean {
    const userCredentials = biometricCredentials.get(userId) || [];
    const index = userCredentials.findIndex(c => c.id === credentialId);

    if (index === -1) {
      return false;
    }

    const removed = userCredentials.splice(index, 1)[0];
    biometricCredentials.set(userId, userCredentials);

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "BiometricCredential",
      resourceId: credentialId,
      details: `Removed credential: ${removed.deviceName}`,
    });

    return true;
  }

  hasBiometricEnabled(userId: string): boolean {
    const credentials = biometricCredentials.get(userId) || [];
    return credentials.some(c => c.enabled);
  }

  getBiometricStatus(userId: string): {
    enabled: boolean;
    credentialCount: number;
    deviceTypes: BiometricCredential["deviceType"][];
  } {
    const credentials = biometricCredentials.get(userId) || [];
    const enabledCredentials = credentials.filter(c => c.enabled);

    return {
      enabled: enabledCredentials.length > 0,
      credentialCount: enabledCredentials.length,
      deviceTypes: [...new Set(enabledCredentials.map(c => c.deviceType))],
    };
  }
}

export const biometricAuth = new BiometricAuthService();

console.log("[MobileSecurity] ATS headers, secure notifications, configurable timeouts, and biometric auth initialized");
