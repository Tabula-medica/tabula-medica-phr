import crypto from "crypto";

export interface EnhancedAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  mfaEnabled: boolean;
  deviceRecognitionEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  tokenRotationEnabled: boolean;
  maxDevicesPerUser: number;
  sessionTimeout: number;
}

export interface DeviceFingerprint {
  id: string;
  userId: string;
  fingerprint: string;
  deviceName: string;
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  os: string;
  browser?: string;
  ipAddress: string;
  location?: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  firstSeen: Date;
  lastSeen: Date;
  isTrusted: boolean;
  trustLevel: number;
}

export interface MFAMethod {
  id: string;
  userId: string;
  type: "totp" | "sms" | "email" | "push" | "security_key" | "backup_codes";
  isEnabled: boolean;
  isPrimary: boolean;
  createdAt: Date;
  lastUsed?: Date;
  metadata: Record<string, unknown>;
}

export interface AuthSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
  mfaVerified: boolean;
}

export interface AnomalyAlert {
  id: string;
  userId: string;
  type: "new_device" | "new_location" | "unusual_time" | "rapid_location_change" | "failed_attempts" | "suspicious_activity";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details: Record<string, unknown>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface TokenRotationResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  rotatedAt: Date;
}

export interface OAuthMFAConfig {
  provider: "google" | "okta" | "auth0";
  clientId: string;
  clientSecret: string;
  issuer: string;
  scopes: string[];
  mfaPolicies: {
    requireMFAForSensitiveOps: boolean;
    mfaGracePeriodMinutes: number;
    stepUpAuthenticationEnabled: boolean;
  };
}

const ANOMALY_THRESHOLDS = {
  failedLoginAttempts: 5,
  locationChangeKmThreshold: 500,
  locationChangeTimeThreshold: 2 * 60 * 60 * 1000,
  unusualHourStart: 2,
  unusualHourEnd: 5,
  suspiciousActivityScore: 75
};

class EnhancedAuthService {
  private config: EnhancedAuthConfig | null = null;
  private sessions: Map<string, AuthSession> = new Map();
  private devices: Map<string, DeviceFingerprint[]> = new Map();
  private mfaMethods: Map<string, MFAMethod[]> = new Map();
  private anomalyAlerts: AnomalyAlert[] = [];
  private failedAttempts: Map<string, number> = new Map();

  initialize(config: EnhancedAuthConfig): void {
    this.config = config;
  }

  generateDeviceFingerprint(request: {
    userAgent: string;
    ipAddress: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  }): string {
    const data = [
      request.userAgent,
      request.screenResolution || "",
      request.timezone || "",
      request.language || "",
      request.platform || ""
    ].join("|");

    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async registerDevice(userId: string, deviceInfo: {
    fingerprint: string;
    deviceName: string;
    deviceType: DeviceFingerprint["deviceType"];
    os: string;
    browser?: string;
    ipAddress: string;
    location?: DeviceFingerprint["location"];
  }): Promise<DeviceFingerprint> {
    const userDevices = this.devices.get(userId) || [];

    const existingDevice = userDevices.find(d => d.fingerprint === deviceInfo.fingerprint);
    if (existingDevice) {
      existingDevice.lastSeen = new Date();
      existingDevice.ipAddress = deviceInfo.ipAddress;
      if (deviceInfo.location) {
        existingDevice.location = deviceInfo.location;
      }
      return existingDevice;
    }

    if (this.config?.maxDevicesPerUser && userDevices.length >= this.config.maxDevicesPerUser) {
      const oldestDevice = userDevices.sort((a, b) => 
        a.lastSeen.getTime() - b.lastSeen.getTime()
      )[0];
      
      const index = userDevices.indexOf(oldestDevice);
      userDevices.splice(index, 1);
    }

    const newDevice: DeviceFingerprint = {
      id: crypto.randomUUID(),
      userId,
      fingerprint: deviceInfo.fingerprint,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      ipAddress: deviceInfo.ipAddress,
      location: deviceInfo.location,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isTrusted: false,
      trustLevel: 0
    };

    userDevices.push(newDevice);
    this.devices.set(userId, userDevices);

    if (this.config?.anomalyDetectionEnabled) {
      await this.createAnomalyAlert(userId, {
        type: "new_device",
        severity: "medium",
        description: `New device detected: ${deviceInfo.deviceName}`,
        details: deviceInfo
      });
    }

    return newDevice;
  }

  async trustDevice(userId: string, deviceId: string): Promise<boolean> {
    const userDevices = this.devices.get(userId);
    if (!userDevices) return false;

    const device = userDevices.find(d => d.id === deviceId);
    if (!device) return false;

    device.isTrusted = true;
    device.trustLevel = 100;
    return true;
  }

  async setupTOTP(userId: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const secret = crypto.randomBytes(20).toString("base64url");
    
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    const userMethods = this.mfaMethods.get(userId) || [];
    
    userMethods.push({
      id: crypto.randomUUID(),
      userId,
      type: "totp",
      isEnabled: true,
      isPrimary: userMethods.length === 0,
      createdAt: new Date(),
      metadata: {
        secret,
        backupCodes: backupCodes.map(code => ({
          code: crypto.createHash("sha256").update(code).digest("hex"),
          used: false
        }))
      }
    });

    this.mfaMethods.set(userId, userMethods);

    const issuer = "TabulaMedica";
    const qrCodeUrl = `otpauth://totp/${issuer}:user@example.com?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    return { secret, qrCodeUrl, backupCodes };
  }

  verifyTOTP(userId: string, token: string): boolean {
    const userMethods = this.mfaMethods.get(userId);
    if (!userMethods) return false;

    const totpMethod = userMethods.find(m => m.type === "totp" && m.isEnabled);
    if (!totpMethod) return false;

    const secret = totpMethod.metadata.secret as string;
    const counter = Math.floor(Date.now() / 30000);

    for (let i = -1; i <= 1; i++) {
      const expectedToken = this.generateTOTPToken(secret, counter + i);
      if (expectedToken === token) {
        totpMethod.lastUsed = new Date();
        return true;
      }
    }

    return false;
  }

  private generateTOTPToken(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac("sha1", Buffer.from(secret, "base64url"));
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, "0");
  }

  verifyBackupCode(userId: string, code: string): boolean {
    const userMethods = this.mfaMethods.get(userId);
    if (!userMethods) return false;

    const totpMethod = userMethods.find(m => m.type === "totp" && m.isEnabled);
    if (!totpMethod) return false;

    const backupCodes = totpMethod.metadata.backupCodes as Array<{ code: string; used: boolean }>;
    const codeHash = crypto.createHash("sha256").update(code.toUpperCase()).digest("hex");

    const backupCode = backupCodes.find(bc => bc.code === codeHash && !bc.used);
    if (!backupCode) return false;

    backupCode.used = true;
    return true;
  }

  async createSession(userId: string, deviceId: string, ipAddress: string, userAgent: string): Promise<AuthSession> {
    if (!this.config) {
      throw new Error("Enhanced auth service not initialized");
    }

    const accessToken = crypto.randomBytes(32).toString("hex");
    const refreshToken = crypto.randomBytes(48).toString("hex");

    const session: AuthSession = {
      id: crypto.randomUUID(),
      userId,
      accessToken: crypto.createHash("sha256").update(accessToken).digest("hex"),
      refreshToken: crypto.createHash("sha256").update(refreshToken).digest("hex"),
      deviceId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.accessTokenExpiry * 1000),
      lastActivity: new Date(),
      isActive: true,
      mfaVerified: false
    };

    this.sessions.set(session.id, session);

    return {
      ...session,
      accessToken,
      refreshToken
    };
  }

  async rotateTokens(refreshToken: string): Promise<TokenRotationResult | null> {
    if (!this.config?.tokenRotationEnabled) {
      throw new Error("Token rotation is not enabled");
    }

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    
    let foundSession: AuthSession | undefined;
    for (const session of this.sessions.values()) {
      if (session.refreshToken === refreshTokenHash && session.isActive) {
        foundSession = session;
        break;
      }
    }

    if (!foundSession) {
      return null;
    }

    const newAccessToken = crypto.randomBytes(32).toString("hex");
    const newRefreshToken = crypto.randomBytes(48).toString("hex");

    foundSession.accessToken = crypto.createHash("sha256").update(newAccessToken).digest("hex");
    foundSession.refreshToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    foundSession.expiresAt = new Date(Date.now() + this.config.accessTokenExpiry * 1000);
    foundSession.lastActivity = new Date();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiry: foundSession.expiresAt,
      refreshTokenExpiry: new Date(Date.now() + this.config.refreshTokenExpiry * 1000),
      rotatedAt: new Date()
    };
  }

  async validateSession(accessToken: string): Promise<AuthSession | null> {
    const accessTokenHash = crypto.createHash("sha256").update(accessToken).digest("hex");

    for (const session of this.sessions.values()) {
      if (session.accessToken === accessTokenHash && session.isActive) {
        if (session.expiresAt < new Date()) {
          session.isActive = false;
          return null;
        }

        session.lastActivity = new Date();
        return session;
      }
    }

    return null;
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    return true;
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    let count = 0;

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isActive && session.id !== exceptSessionId) {
        session.isActive = false;
        count++;
      }
    }

    return count;
  }

  async detectAnomalies(userId: string, currentActivity: {
    ipAddress: string;
    location?: DeviceFingerprint["location"];
    timestamp: Date;
  }): Promise<AnomalyAlert[]> {
    if (!this.config?.anomalyDetectionEnabled) {
      return [];
    }

    const alerts: AnomalyAlert[] = [];
    const userDevices = this.devices.get(userId) || [];

    const hour = currentActivity.timestamp.getHours();
    if (hour >= ANOMALY_THRESHOLDS.unusualHourStart && hour <= ANOMALY_THRESHOLDS.unusualHourEnd) {
      alerts.push({
        id: crypto.randomUUID(),
        userId,
        type: "unusual_time",
        severity: "low",
        description: `Login at unusual hour: ${hour}:00`,
        details: { hour, timestamp: currentActivity.timestamp },
        detectedAt: new Date()
      });
    }

    if (currentActivity.location && userDevices.length > 0) {
      const lastDevice = userDevices.sort((a, b) => 
        b.lastSeen.getTime() - a.lastSeen.getTime()
      )[0];

      if (lastDevice.location) {
        const distance = this.calculateDistance(
          lastDevice.location.latitude,
          lastDevice.location.longitude,
          currentActivity.location.latitude,
          currentActivity.location.longitude
        );

        const timeDiff = currentActivity.timestamp.getTime() - lastDevice.lastSeen.getTime();

        if (distance > ANOMALY_THRESHOLDS.locationChangeKmThreshold && 
            timeDiff < ANOMALY_THRESHOLDS.locationChangeTimeThreshold) {
          alerts.push({
            id: crypto.randomUUID(),
            userId,
            type: "rapid_location_change",
            severity: "high",
            description: `Impossible travel detected: ${Math.round(distance)}km in ${Math.round(timeDiff / 60000)} minutes`,
            details: {
              previousLocation: lastDevice.location,
              currentLocation: currentActivity.location,
              distance,
              timeDiff
            },
            detectedAt: new Date()
          });
        }
      }
    }

    const failedCount = this.failedAttempts.get(userId) || 0;
    if (failedCount >= ANOMALY_THRESHOLDS.failedLoginAttempts) {
      alerts.push({
        id: crypto.randomUUID(),
        userId,
        type: "failed_attempts",
        severity: "high",
        description: `Multiple failed login attempts: ${failedCount}`,
        details: { failedCount },
        detectedAt: new Date()
      });
    }

    this.anomalyAlerts.push(...alerts);
    return alerts;
  }

  recordFailedAttempt(userId: string): void {
    const current = this.failedAttempts.get(userId) || 0;
    this.failedAttempts.set(userId, current + 1);
  }

  clearFailedAttempts(userId: string): void {
    this.failedAttempts.delete(userId);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async createAnomalyAlert(userId: string, alert: Omit<AnomalyAlert, "id" | "userId" | "detectedAt">): Promise<void> {
    this.anomalyAlerts.push({
      id: crypto.randomUUID(),
      userId,
      ...alert,
      detectedAt: new Date()
    });
  }

  getAnomalyAlerts(userId: string, options?: {
    severity?: AnomalyAlert["severity"][];
    type?: AnomalyAlert["type"][];
    unresolved?: boolean;
    limit?: number;
  }): AnomalyAlert[] {
    let alerts = this.anomalyAlerts.filter(a => a.userId === userId);

    if (options?.severity) {
      alerts = alerts.filter(a => options.severity!.includes(a.severity));
    }

    if (options?.type) {
      alerts = alerts.filter(a => options.type!.includes(a.type));
    }

    if (options?.unresolved) {
      alerts = alerts.filter(a => !a.resolvedAt);
    }

    alerts.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  resolveAnomalyAlert(alertId: string, resolution: string): boolean {
    const alert = this.anomalyAlerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    alert.resolution = resolution;
    return true;
  }

  getUserDevices(userId: string): DeviceFingerprint[] {
    return this.devices.get(userId) || [];
  }

  getUserMFAMethods(userId: string): MFAMethod[] {
    return this.mfaMethods.get(userId) || [];
  }

  getUserSessions(userId: string): AuthSession[] {
    const sessions: AuthSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isActive) {
        sessions.push({
          ...session,
          accessToken: "[REDACTED]",
          refreshToken: "[REDACTED]"
        });
      }
    }
    return sessions;
  }
}

export const enhancedAuthService = new EnhancedAuthService();

export function initializeEnhancedAuth(): void {
  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;

  // Audit finding H-2 (2026-05-18): in production we must NOT silently degrade
  // to "enhanced auth disabled" if neither JWT_SECRET nor SESSION_SECRET is set.
  // Fail loudly so the deploy is caught at boot, not after auth requests start
  // returning unexpected 401s or hitting the legacy code path.
  if (!jwtSecret && process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] JWT_SECRET (or SESSION_SECRET) must be set in production. Refusing to start enhanced auth service in a degraded state.");
  }

  if (jwtSecret) {
    enhancedAuthService.initialize({
      jwtSecret,
      accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || "900", 10),
      refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || "604800", 10),
      mfaEnabled: process.env.MFA_ENABLED === "true",
      deviceRecognitionEnabled: process.env.DEVICE_RECOGNITION_ENABLED !== "false",
      anomalyDetectionEnabled: process.env.ANOMALY_DETECTION_ENABLED !== "false",
      tokenRotationEnabled: process.env.TOKEN_ROTATION_ENABLED !== "false",
      maxDevicesPerUser: parseInt(process.env.MAX_DEVICES_PER_USER || "5", 10),
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || "1800", 10)
    });
    console.log("Enhanced authentication service initialized");
  } else {
    console.log("JWT secret not configured - enhanced auth service disabled (dev only)");
  }
}
