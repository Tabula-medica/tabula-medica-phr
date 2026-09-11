import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateClientId(): string {
  return `smart-client-${crypto.randomBytes(16).toString("hex")}`;
}

function generateClientSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][SMART-Registration] ${action} - ${resourceType}:${resourceId} User:${userId} - ${details}`);
}

export type AppType = "PATIENT_FACING" | "PROVIDER_FACING" | "BACKEND_SERVICE" | "HYBRID";
export type AuthMethod = "CLIENT_SECRET_BASIC" | "CLIENT_SECRET_POST" | "PRIVATE_KEY_JWT" | "NONE";
export type AppStatus = "ACTIVE" | "PENDING_APPROVAL" | "DISABLED" | "REVOKED" | "EXPIRED";
export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING" | "NEVER_CONNECTED";

export interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
  publicKeyJwk?: object;
  authMethod: AuthMethod;
  secretExpiresAt?: string;
  createdAt: string;
  rotatedAt?: string;
}

export interface LaunchConfiguration {
  launchUrl: string;
  redirectUrls: string[];
  postLogoutRedirectUrls?: string[];
  corsOrigins?: string[];
  launchContext: ("patient" | "encounter" | "practitioner" | "standalone")[];
  supportedResponseTypes: ("code" | "token")[];
  pkceRequired: boolean;
  stateRequired: boolean;
}

export interface ScopeConfiguration {
  requestedScopes: string[];
  approvedScopes: string[];
  restrictedScopes?: string[];
  consentRequired: boolean;
  offlineAccess: boolean;
}

export interface RegisteredSmartApp {
  id: string;
  name: string;
  description: string;
  appType: AppType;
  vendor: {
    name: string;
    url?: string;
    contactEmail: string;
    supportUrl?: string;
  };
  credentials: ClientCredentials;
  launchConfig: LaunchConfiguration;
  scopeConfig: ScopeConfiguration;
  fhirVersions: ("R4" | "R5" | "STU3")[];
  logoUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  documentationUrl?: string;
  status: AppStatus;
  approvedBy?: string;
  approvedAt?: string;
  enabledForPatients: boolean;
  enabledForProviders: boolean;
  featured: boolean;
  installCount: number;
  lastConnectionAt?: string;
  connectionStatus: ConnectionStatus;
  connectionErrorMessage?: string;
  healthCheckUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppConnectionEvent {
  id: string;
  appId: string;
  userId?: string;
  patientId?: string;
  eventType: "LAUNCH" | "TOKEN_ISSUED" | "TOKEN_REFRESHED" | "LOGOUT" | "ERROR" | "HEALTH_CHECK";
  status: "SUCCESS" | "FAILURE";
  errorMessage?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface PatientAppAccess {
  id: string;
  appId: string;
  patientId: string;
  grantedScopes: string[];
  consentGiven: boolean;
  consentTimestamp?: string;
  lastAccessedAt?: string;
  accessCount: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  expiresAt?: string;
  createdAt: string;
}

const registeredApps = new Map<string, RegisteredSmartApp>();
const connectionEvents = new Map<string, AppConnectionEvent[]>();
const patientAppAccess = new Map<string, PatientAppAccess[]>();

function initializeSampleApps(): void {
  const now = new Date().toISOString();

  const epicMyChart: RegisteredSmartApp = {
    id: "app-epic-mychart",
    name: "Primary Care Provider",
    description: "Access your health records from provider-connected healthcare providers",
    appType: "PATIENT_FACING",
    vendor: {
      name: "Fasten Health Corporation",
      url: "https://www.epic.com",
      contactEmail: "support@epic.com",
      supportUrl: "https://www.mychart.com/support"
    },
    credentials: {
      clientId: generateClientId(),
      authMethod: "NONE",
      createdAt: now
    },
    launchConfig: {
      launchUrl: "https://mychart.epic.com/launch",
      redirectUrls: ["https://mychart.epic.com/callback"],
      launchContext: ["patient", "standalone"],
      supportedResponseTypes: ["code"],
      pkceRequired: true,
      stateRequired: true
    },
    scopeConfig: {
      requestedScopes: ["openid", "fhirUser", "launch/patient", "patient/*.read"],
      approvedScopes: ["openid", "fhirUser", "launch/patient", "patient/*.read"],
      consentRequired: true,
      offlineAccess: true
    },
    fhirVersions: ["R4"],
    logoUrl: "/images/apps/epic-mychart.png",
    privacyPolicyUrl: "https://www.epic.com/privacy",
    termsOfServiceUrl: "https://www.epic.com/terms",
    status: "ACTIVE",
    enabledForPatients: true,
    enabledForProviders: false,
    featured: true,
    installCount: 15420,
    connectionStatus: "CONNECTED",
    lastConnectionAt: now,
    tags: ["ehr", "patient-portal", "records"],
    createdAt: now,
    updatedAt: now
  };

  const fastenHealth: RegisteredSmartApp = {
    id: "app-fasten-health",
    name: "Fasten Health",
    description: "Nationwide health data exchange for comprehensive patient records",
    appType: "HYBRID",
    vendor: {
      name: "Fasten Health Inc.",
      url: "https://www.fastenhealth.com",
      contactEmail: "support@fastenhealth.com"
    },
    credentials: {
      clientId: generateClientId(),
      clientSecret: generateClientSecret(),
      authMethod: "CLIENT_SECRET_BASIC",
      createdAt: now
    },
    launchConfig: {
      launchUrl: "https://api.fastenhealth.com/fhir/launch",
      redirectUrls: ["https://api.fastenhealth.com/callback"],
      launchContext: ["patient", "practitioner", "standalone"],
      supportedResponseTypes: ["code"],
      pkceRequired: true,
      stateRequired: true
    },
    scopeConfig: {
      requestedScopes: ["openid", "fhirUser", "patient/*.read", "user/*.read"],
      approvedScopes: ["openid", "fhirUser", "patient/*.read"],
      consentRequired: true,
      offlineAccess: true
    },
    fhirVersions: ["R4"],
    logoUrl: "/images/apps/fasten-health.png",
    status: "ACTIVE",
    enabledForPatients: true,
    enabledForProviders: true,
    featured: true,
    installCount: 8750,
    connectionStatus: "CONNECTED",
    lastConnectionAt: now,
    tags: ["hie", "data-exchange", "interoperability"],
    createdAt: now,
    updatedAt: now
  };

  const appleHealth: RegisteredSmartApp = {
    id: "app-apple-health",
    name: "Apple Health Records",
    description: "Sync your health records with Apple Health app",
    appType: "PATIENT_FACING",
    vendor: {
      name: "Apple Inc.",
      url: "https://www.apple.com/health",
      contactEmail: "health-support@apple.com"
    },
    credentials: {
      clientId: generateClientId(),
      authMethod: "PRIVATE_KEY_JWT",
      createdAt: now
    },
    launchConfig: {
      launchUrl: "https://health.apple.com/fhir/launch",
      redirectUrls: ["https://health.apple.com/callback"],
      launchContext: ["patient", "standalone"],
      supportedResponseTypes: ["code"],
      pkceRequired: true,
      stateRequired: true
    },
    scopeConfig: {
      requestedScopes: ["openid", "fhirUser", "patient/AllergyIntolerance.read", "patient/Condition.read", "patient/Immunization.read", "patient/MedicationRequest.read", "patient/Observation.read", "patient/Procedure.read"],
      approvedScopes: ["openid", "fhirUser", "patient/AllergyIntolerance.read", "patient/Condition.read", "patient/Immunization.read", "patient/MedicationRequest.read", "patient/Observation.read", "patient/Procedure.read"],
      consentRequired: true,
      offlineAccess: false
    },
    fhirVersions: ["R4"],
    logoUrl: "/images/apps/apple-health.png",
    status: "ACTIVE",
    enabledForPatients: true,
    enabledForProviders: false,
    featured: true,
    installCount: 32100,
    connectionStatus: "CONNECTED",
    lastConnectionAt: now,
    tags: ["mobile", "apple", "consumer-health"],
    createdAt: now,
    updatedAt: now
  };

  const careEvolution: RegisteredSmartApp = {
    id: "app-careevolution",
    name: "CareEvolution HIE",
    description: "Health information exchange for care coordination",
    appType: "PROVIDER_FACING",
    vendor: {
      name: "CareEvolution",
      url: "https://www.careevolution.com",
      contactEmail: "support@careevolution.com"
    },
    credentials: {
      clientId: generateClientId(),
      clientSecret: generateClientSecret(),
      authMethod: "CLIENT_SECRET_POST",
      createdAt: now
    },
    launchConfig: {
      launchUrl: "https://fhir.careevolution.com/launch",
      redirectUrls: ["https://fhir.careevolution.com/callback"],
      launchContext: ["practitioner", "encounter"],
      supportedResponseTypes: ["code"],
      pkceRequired: true,
      stateRequired: true
    },
    scopeConfig: {
      requestedScopes: ["openid", "fhirUser", "user/*.read", "user/*.write"],
      approvedScopes: ["openid", "fhirUser", "user/*.read"],
      consentRequired: false,
      offlineAccess: true
    },
    fhirVersions: ["R4", "STU3"],
    status: "ACTIVE",
    enabledForPatients: false,
    enabledForProviders: true,
    featured: false,
    installCount: 2340,
    connectionStatus: "CONNECTED",
    lastConnectionAt: now,
    tags: ["hie", "care-coordination", "provider"],
    createdAt: now,
    updatedAt: now
  };

  const pendingApp: RegisteredSmartApp = {
    id: "app-pending-sample",
    name: "Sample Health App",
    description: "A sample SMART on FHIR application pending approval",
    appType: "PATIENT_FACING",
    vendor: {
      name: "Sample Vendor",
      contactEmail: "sample@example.com"
    },
    credentials: {
      clientId: generateClientId(),
      authMethod: "NONE",
      createdAt: now
    },
    launchConfig: {
      launchUrl: "https://sample.example.com/launch",
      redirectUrls: ["https://sample.example.com/callback"],
      launchContext: ["patient"],
      supportedResponseTypes: ["code"],
      pkceRequired: true,
      stateRequired: true
    },
    scopeConfig: {
      requestedScopes: ["openid", "patient/*.read"],
      approvedScopes: [],
      consentRequired: true,
      offlineAccess: false
    },
    fhirVersions: ["R4"],
    status: "PENDING_APPROVAL",
    enabledForPatients: false,
    enabledForProviders: false,
    featured: false,
    installCount: 0,
    connectionStatus: "NEVER_CONNECTED",
    tags: ["sample"],
    createdAt: now,
    updatedAt: now
  };

  [epicMyChart, fastenHealth, appleHealth, careEvolution, pendingApp].forEach(app => {
    registeredApps.set(app.id, app);
  });
}

initializeSampleApps();

class SmartAppRegistrationService {
  registerApp(params: {
    name: string;
    description: string;
    appType: AppType;
    vendor: RegisteredSmartApp["vendor"];
    launchConfig: Omit<LaunchConfiguration, "pkceRequired" | "stateRequired"> & { pkceRequired?: boolean; stateRequired?: boolean };
    scopeConfig: Omit<ScopeConfiguration, "approvedScopes"> & { approvedScopes?: string[] };
    fhirVersions: RegisteredSmartApp["fhirVersions"];
    authMethod?: AuthMethod;
    logoUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
    documentationUrl?: string;
    healthCheckUrl?: string;
    tags?: string[];
  }, userId: string): RegisteredSmartApp {
    const now = new Date().toISOString();
    const authMethod = params.authMethod || "NONE";

    const credentials: ClientCredentials = {
      clientId: generateClientId(),
      authMethod,
      createdAt: now
    };

    if (authMethod === "CLIENT_SECRET_BASIC" || authMethod === "CLIENT_SECRET_POST") {
      credentials.clientSecret = generateClientSecret();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      credentials.secretExpiresAt = expiryDate.toISOString();
    }

    const app: RegisteredSmartApp = {
      id: generateId("app"),
      name: params.name,
      description: params.description,
      appType: params.appType,
      vendor: params.vendor,
      credentials,
      launchConfig: {
        ...params.launchConfig,
        pkceRequired: params.launchConfig.pkceRequired !== false,
        stateRequired: params.launchConfig.stateRequired !== false
      },
      scopeConfig: {
        ...params.scopeConfig,
        approvedScopes: params.scopeConfig.approvedScopes || []
      },
      fhirVersions: params.fhirVersions,
      logoUrl: params.logoUrl,
      privacyPolicyUrl: params.privacyPolicyUrl,
      termsOfServiceUrl: params.termsOfServiceUrl,
      documentationUrl: params.documentationUrl,
      healthCheckUrl: params.healthCheckUrl,
      status: "PENDING_APPROVAL",
      enabledForPatients: false,
      enabledForProviders: false,
      featured: false,
      installCount: 0,
      connectionStatus: "NEVER_CONNECTED",
      tags: params.tags || [],
      createdAt: now,
      updatedAt: now
    };

    registeredApps.set(app.id, app);

    auditLog("APP_REGISTERED", "SMARTApp", app.id, userId,
      `New SMART app registered: ${app.name} (${app.appType})`);

    return app;
  }

  updateApp(appId: string, updates: Partial<Omit<RegisteredSmartApp, "id" | "credentials" | "createdAt">>, userId: string): RegisteredSmartApp | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    const updatedApp: RegisteredSmartApp = {
      ...app,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    registeredApps.set(appId, updatedApp);

    auditLog("APP_UPDATED", "SMARTApp", appId, userId,
      `SMART app updated: ${updatedApp.name}`);

    return updatedApp;
  }

  approveApp(appId: string, approvedScopes: string[], userId: string): RegisteredSmartApp | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    app.status = "ACTIVE";
    app.approvedBy = userId;
    app.approvedAt = new Date().toISOString();
    app.scopeConfig.approvedScopes = approvedScopes;
    app.updatedAt = new Date().toISOString();

    registeredApps.set(appId, app);

    auditLog("APP_APPROVED", "SMARTApp", appId, userId,
      `SMART app approved with ${approvedScopes.length} scopes`);

    return app;
  }

  enableApp(appId: string, options: { forPatients?: boolean; forProviders?: boolean }, userId: string): RegisteredSmartApp | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    if (options.forPatients !== undefined) {
      app.enabledForPatients = options.forPatients;
    }
    if (options.forProviders !== undefined) {
      app.enabledForProviders = options.forProviders;
    }
    app.updatedAt = new Date().toISOString();

    registeredApps.set(appId, app);

    auditLog("APP_ENABLED", "SMARTApp", appId, userId,
      `App enabled: patients=${app.enabledForPatients}, providers=${app.enabledForProviders}`);

    return app;
  }

  disableApp(appId: string, userId: string): RegisteredSmartApp | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    app.status = "DISABLED";
    app.enabledForPatients = false;
    app.enabledForProviders = false;
    app.updatedAt = new Date().toISOString();

    registeredApps.set(appId, app);

    auditLog("APP_DISABLED", "SMARTApp", appId, userId,
      `SMART app disabled: ${app.name}`);

    return app;
  }

  revokeApp(appId: string, reason: string, userId: string): RegisteredSmartApp | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    app.status = "REVOKED";
    app.enabledForPatients = false;
    app.enabledForProviders = false;
    app.updatedAt = new Date().toISOString();

    registeredApps.set(appId, app);

    auditLog("APP_REVOKED", "SMARTApp", appId, userId,
      `SMART app revoked: ${app.name}. Reason: ${reason}`);

    return app;
  }

  rotateClientCredentials(appId: string, userId: string): { clientId: string; clientSecret?: string } | null {
    const app = registeredApps.get(appId);
    if (!app) return null;

    const newCredentials: ClientCredentials = {
      clientId: generateClientId(),
      authMethod: app.credentials.authMethod,
      createdAt: new Date().toISOString(),
      rotatedAt: new Date().toISOString()
    };

    if (app.credentials.authMethod === "CLIENT_SECRET_BASIC" || app.credentials.authMethod === "CLIENT_SECRET_POST") {
      newCredentials.clientSecret = generateClientSecret();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      newCredentials.secretExpiresAt = expiryDate.toISOString();
    }

    app.credentials = newCredentials;
    app.updatedAt = new Date().toISOString();

    registeredApps.set(appId, app);

    auditLog("CREDENTIALS_ROTATED", "SMARTApp", appId, userId,
      `Client credentials rotated for: ${app.name}`);

    return {
      clientId: newCredentials.clientId,
      clientSecret: newCredentials.clientSecret
    };
  }

  getApp(appId: string): RegisteredSmartApp | null {
    return registeredApps.get(appId) || null;
  }

  getAppByClientId(clientId: string): RegisteredSmartApp | null {
    return Array.from(registeredApps.values()).find(app => app.credentials.clientId === clientId) || null;
  }

  listApps(params?: {
    status?: AppStatus;
    appType?: AppType;
    enabledForPatients?: boolean;
    enabledForProviders?: boolean;
    featured?: boolean;
    search?: string;
  }): RegisteredSmartApp[] {
    let apps = Array.from(registeredApps.values());

    if (params?.status) {
      apps = apps.filter(app => app.status === params.status);
    }
    if (params?.appType) {
      apps = apps.filter(app => app.appType === params.appType);
    }
    if (params?.enabledForPatients !== undefined) {
      apps = apps.filter(app => app.enabledForPatients === params.enabledForPatients);
    }
    if (params?.enabledForProviders !== undefined) {
      apps = apps.filter(app => app.enabledForProviders === params.enabledForProviders);
    }
    if (params?.featured !== undefined) {
      apps = apps.filter(app => app.featured === params.featured);
    }
    if (params?.search) {
      const search = params.search.toLowerCase();
      apps = apps.filter(app =>
        app.name.toLowerCase().includes(search) ||
        app.description.toLowerCase().includes(search) ||
        app.vendor.name.toLowerCase().includes(search) ||
        app.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return apps;
  }

  getPatientApps(): RegisteredSmartApp[] {
    return Array.from(registeredApps.values()).filter(
      app => app.status === "ACTIVE" && app.enabledForPatients
    );
  }

  recordConnectionEvent(event: Omit<AppConnectionEvent, "id" | "timestamp">): AppConnectionEvent {
    const fullEvent: AppConnectionEvent = {
      ...event,
      id: generateId("event"),
      timestamp: new Date().toISOString()
    };

    const appEvents = connectionEvents.get(event.appId) || [];
    appEvents.push(fullEvent);
    if (appEvents.length > 1000) {
      appEvents.shift();
    }
    connectionEvents.set(event.appId, appEvents);

    const app = registeredApps.get(event.appId);
    if (app) {
      if (event.status === "SUCCESS") {
        app.lastConnectionAt = fullEvent.timestamp;
        app.connectionStatus = "CONNECTED";
        app.connectionErrorMessage = undefined;
      } else if (event.status === "FAILURE") {
        app.connectionStatus = "ERROR";
        app.connectionErrorMessage = event.errorMessage;
      }
      registeredApps.set(event.appId, app);
    }

    // eslint-disable-next-line tabulaAuth/no-fallback-identity -- legitimate system actor: SMART-app connection events include backend/client-credentials connections with no user actor
    auditLog("CONNECTION_EVENT", "SMARTApp", event.appId, event.userId || "system",
      `${event.eventType} - ${event.status}`);

    return fullEvent;
  }

  getConnectionEvents(appId: string, limit?: number): AppConnectionEvent[] {
    const events = connectionEvents.get(appId) || [];
    return limit ? events.slice(-limit) : events;
  }

  grantPatientAccess(params: {
    appId: string;
    patientId: string;
    grantedScopes: string[];
    expiresInDays?: number;
  }, userId: string): PatientAppAccess {
    const now = new Date();
    const access: PatientAppAccess = {
      id: generateId("access"),
      appId: params.appId,
      patientId: params.patientId,
      grantedScopes: params.grantedScopes,
      consentGiven: true,
      consentTimestamp: now.toISOString(),
      accessCount: 0,
      status: "ACTIVE",
      createdAt: now.toISOString()
    };

    if (params.expiresInDays) {
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + params.expiresInDays);
      access.expiresAt = expiryDate.toISOString();
    }

    const patientAccesses = patientAppAccess.get(params.patientId) || [];
    patientAccesses.push(access);
    patientAppAccess.set(params.patientId, patientAccesses);

    const app = registeredApps.get(params.appId);
    if (app) {
      app.installCount++;
      registeredApps.set(params.appId, app);
    }

    auditLog("PATIENT_ACCESS_GRANTED", "PatientAppAccess", access.id, userId,
      `Patient ${params.patientId} granted access to app ${params.appId}`);

    return access;
  }

  revokePatientAccess(accessId: string, patientId: string, userId: string): boolean {
    const accesses = patientAppAccess.get(patientId);
    if (!accesses) return false;

    const access = accesses.find(a => a.id === accessId);
    if (!access) return false;

    access.status = "REVOKED";
    patientAppAccess.set(patientId, accesses);

    auditLog("PATIENT_ACCESS_REVOKED", "PatientAppAccess", accessId, userId,
      `Patient access revoked for app ${access.appId}`);

    return true;
  }

  getPatientAppAccesses(patientId: string): PatientAppAccess[] {
    return patientAppAccess.get(patientId) || [];
  }

  generateLaunchUrl(appId: string, params: {
    patientId?: string;
    encounterId?: string;
    practitionerId?: string;
    iss: string;
  }): string | null {
    const app = registeredApps.get(appId);
    if (!app || app.status !== "ACTIVE") return null;

    const launchUrl = new URL(app.launchConfig.launchUrl);
    launchUrl.searchParams.set("iss", params.iss);
    
    if (params.patientId && app.launchConfig.launchContext.includes("patient")) {
      launchUrl.searchParams.set("launch", Buffer.from(JSON.stringify({
        patient: params.patientId,
        encounter: params.encounterId
      })).toString("base64url"));
    }

    return launchUrl.toString();
  }

  getDashboardStats(): {
    totalApps: number;
    activeApps: number;
    pendingApps: number;
    disabledApps: number;
    patientFacingApps: number;
    providerFacingApps: number;
    totalConnections: number;
    recentErrors: number;
    appsByStatus: Record<AppStatus, number>;
    connectionsByType: Record<string, number>;
  } {
    const apps = Array.from(registeredApps.values());
    const allEvents = Array.from(connectionEvents.values()).flat();
    const recentEvents = allEvents.filter(e => {
      const eventTime = new Date(e.timestamp);
      const hourAgo = new Date(Date.now() - 3600000);
      return eventTime > hourAgo;
    });

    const appsByStatus: Record<AppStatus, number> = {
      ACTIVE: 0,
      PENDING_APPROVAL: 0,
      DISABLED: 0,
      REVOKED: 0,
      EXPIRED: 0
    };

    const connectionsByType: Record<string, number> = {};

    apps.forEach(app => {
      appsByStatus[app.status]++;
    });

    allEvents.forEach(event => {
      connectionsByType[event.eventType] = (connectionsByType[event.eventType] || 0) + 1;
    });

    return {
      totalApps: apps.length,
      activeApps: appsByStatus.ACTIVE,
      pendingApps: appsByStatus.PENDING_APPROVAL,
      disabledApps: appsByStatus.DISABLED,
      patientFacingApps: apps.filter(a => a.enabledForPatients).length,
      providerFacingApps: apps.filter(a => a.enabledForProviders).length,
      totalConnections: allEvents.length,
      recentErrors: recentEvents.filter(e => e.status === "FAILURE").length,
      appsByStatus,
      connectionsByType
    };
  }
}

export const smartAppRegistrationService = new SmartAppRegistrationService();

console.log("[SMART-Registration] Service initialized");
console.log("[SMART-Registration] Registered apps:", registeredApps.size);
