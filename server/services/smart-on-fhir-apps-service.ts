import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function verifyPKCE(codeVerifier: string, codeChallenge: string, method: "S256" | "plain"): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const computed = hash.toString("base64url");
  return computed === codeChallenge;
}

export type SMARTAppCategory = 
  | "clinical-decision-support" 
  | "patient-engagement" 
  | "data-visualization" 
  | "care-coordination"
  | "population-health"
  | "imaging"
  | "genomics"
  | "medication-management"
  | "documentation"
  | "billing"
  | "other";

export type SMARTLaunchContext = "patient" | "encounter" | "provider" | "standalone";

export type SMARTAppStatus = "active" | "pending" | "suspended" | "deprecated";

export interface SMARTScope {
  resource: string;
  permissions: ("read" | "write" | "search" | "*")[];
  contextRequired?: boolean;
}

export interface SMARTApp {
  id: string;
  clientId: string;
  name: string;
  description: string;
  vendor: {
    name: string;
    url?: string;
    email?: string;
    phone?: string;
  };
  category: SMARTAppCategory;
  launchUrl: string;
  redirectUrls: string[];
  logoUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  launchContext: SMARTLaunchContext[];
  scopes: SMARTScope[];
  fhirVersion: "R4" | "STU3" | "DSTU2";
  capabilities: string[];
  certifications: {
    type: string;
    issuer: string;
    validUntil?: string;
    verified: boolean;
  }[];
  status: SMARTAppStatus;
  trusted: boolean;
  installCount: number;
  rating?: number;
  ratingCount?: number;
  lastUpdated: string;
  createdAt: string;
}

export interface SMARTAppInstallation {
  id: string;
  appId: string;
  userId: string;
  organizationId?: string;
  installedAt: string;
  lastLaunchedAt?: string;
  launchCount: number;
  customScopes?: SMARTScope[];
  settings?: Record<string, any>;
  status: "active" | "disabled" | "pending_approval";
}

export interface SMARTLaunchRequest {
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  clientId?: string;
  redirectUri?: string;
  codeUsed?: boolean;
  id: string;
  installationId: string;
  appId: string;
  userId: string;
  launchContext: SMARTLaunchContext;
  contextParams: {
    patient?: string;
    encounter?: string;
    practitioner?: string;
    location?: string;
  };
  state: string;
  authorizationCode?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  status: "initiated" | "authorized" | "active" | "expired" | "revoked";
  createdAt: string;
  authorizedAt?: string;
}

export interface SMARTAppGalleryFilter {
  category?: SMARTAppCategory;
  launchContext?: SMARTLaunchContext;
  fhirVersion?: string;
  trusted?: boolean;
  searchQuery?: string;
}

const apps = new Map<string, SMARTApp>();
const installations = new Map<string, SMARTAppInstallation>();
const launchRequests = new Map<string, SMARTLaunchRequest>();

function initializeSampleApps() {
  const sampleApps: SMARTApp[] = [
    {
      id: generateId("app"),
      clientId: "growth-chart-app",
      name: "Growth Chart Viewer",
      description: "Interactive growth charts for pediatric patients with WHO and CDC percentiles, featuring trend analysis and milestone tracking.",
      vendor: {
        name: "SMART Health IT",
        url: "https://smarthealthit.org",
        email: "support@smarthealthit.org",
      },
      category: "data-visualization",
      launchUrl: "https://apps.smarthealthit.org/growth-chart/launch",
      redirectUrls: ["https://apps.smarthealthit.org/growth-chart/callback"],
      logoUrl: "https://apps.smarthealthit.org/growth-chart/logo.png",
      privacyUrl: "https://smarthealthit.org/privacy",
      termsUrl: "https://smarthealthit.org/terms",
      launchContext: ["patient"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "Observation", permissions: ["read", "search"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-public", "context-ehr-patient"],
      certifications: [
        { type: "ONC Health IT", issuer: "ONC", validUntil: "2026-12-31", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 1250,
      rating: 4.7,
      ratingCount: 89,
      lastUpdated: "2024-01-15T00:00:00Z",
      createdAt: "2022-06-01T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "medication-adherence-tracker",
      name: "Medication Adherence Tracker",
      description: "Comprehensive medication adherence monitoring with patient reminders, refill tracking, and provider dashboards.",
      vendor: {
        name: "CareSync Solutions",
        url: "https://caresyncsolutions.com",
        email: "help@caresyncsolutions.com",
      },
      category: "medication-management",
      launchUrl: "https://app.caresyncsolutions.com/adherence/launch",
      redirectUrls: ["https://app.caresyncsolutions.com/adherence/oauth-callback"],
      logoUrl: "https://app.caresyncsolutions.com/logo.svg",
      privacyUrl: "https://caresyncsolutions.com/privacy",
      launchContext: ["patient", "provider"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "MedicationRequest", permissions: ["read", "search"] },
        { resource: "MedicationStatement", permissions: ["read", "write"] },
        { resource: "MedicationAdministration", permissions: ["read", "write"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-confidential-symmetric", "context-ehr-patient", "permission-patient"],
      certifications: [
        { type: "HIPAA Compliant", issuer: "HITRUST", validUntil: "2025-09-30", verified: true },
        { type: "SOC 2 Type II", issuer: "Deloitte", validUntil: "2025-06-30", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 890,
      rating: 4.5,
      ratingCount: 62,
      lastUpdated: "2024-02-01T00:00:00Z",
      createdAt: "2023-01-15T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "clinical-summary-generator",
      name: "AI Clinical Summary Generator",
      description: "AI-powered clinical summary generation for patient encounters. Creates structured notes from FHIR data. INFORMATIONAL ONLY - not clinical decision support.",
      vendor: {
        name: "HealthAI Labs",
        url: "https://healthailabs.com",
      },
      category: "documentation",
      launchUrl: "https://portal.healthailabs.com/summary/launch",
      redirectUrls: ["https://portal.healthailabs.com/summary/callback"],
      logoUrl: "https://portal.healthailabs.com/assets/logo.png",
      privacyUrl: "https://healthailabs.com/privacy-policy",
      termsUrl: "https://healthailabs.com/terms",
      launchContext: ["patient", "encounter"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "Encounter", permissions: ["read", "search"] },
        { resource: "Condition", permissions: ["read", "search"] },
        { resource: "Observation", permissions: ["read", "search"] },
        { resource: "MedicationRequest", permissions: ["read", "search"] },
        { resource: "Procedure", permissions: ["read", "search"] },
        { resource: "DiagnosticReport", permissions: ["read", "search"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-confidential-symmetric", "context-ehr-patient", "context-ehr-encounter"],
      certifications: [
        { type: "HIPAA Compliant", issuer: "Internal Audit", validUntil: "2025-12-31", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 445,
      rating: 4.3,
      ratingCount: 28,
      lastUpdated: "2024-01-20T00:00:00Z",
      createdAt: "2023-09-01T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "dicom-viewer-pro",
      name: "DICOM Viewer Pro",
      description: "Advanced medical imaging viewer with support for CT, MRI, X-ray, and ultrasound. Features MPR, 3D rendering, and measurement tools.",
      vendor: {
        name: "RadVision Medical",
        url: "https://radvisionmedical.com",
        email: "support@radvisionmedical.com",
        phone: "+1-800-555-0199",
      },
      category: "imaging",
      launchUrl: "https://viewer.radvisionmedical.com/smart/launch",
      redirectUrls: ["https://viewer.radvisionmedical.com/smart/redirect"],
      logoUrl: "https://radvisionmedical.com/logo.png",
      privacyUrl: "https://radvisionmedical.com/privacy",
      launchContext: ["patient", "provider"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "ImagingStudy", permissions: ["read", "search"] },
        { resource: "DiagnosticReport", permissions: ["read", "search"] },
        { resource: "Endpoint", permissions: ["read"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-confidential-symmetric", "context-ehr-patient", "sso-openid-connect"],
      certifications: [
        { type: "FDA 510(k)", issuer: "FDA", validUntil: "2027-03-31", verified: true },
        { type: "CE Mark", issuer: "EU", validUntil: "2026-06-30", verified: true },
        { type: "HIPAA Compliant", issuer: "HITRUST", validUntil: "2025-09-30", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 2100,
      rating: 4.8,
      ratingCount: 156,
      lastUpdated: "2024-01-10T00:00:00Z",
      createdAt: "2021-03-15T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "population-health-dashboard",
      name: "Population Health Analytics",
      description: "Comprehensive population health management dashboard with risk stratification, care gap analysis, and quality measure tracking.",
      vendor: {
        name: "ValueCare Analytics",
        url: "https://valuecare-analytics.com",
      },
      category: "population-health",
      launchUrl: "https://app.valuecare-analytics.com/pop-health/launch",
      redirectUrls: ["https://app.valuecare-analytics.com/pop-health/oauth2/callback"],
      launchContext: ["provider", "standalone"],
      scopes: [
        { resource: "Patient", permissions: ["read", "search"] },
        { resource: "Condition", permissions: ["read", "search"] },
        { resource: "Observation", permissions: ["read", "search"] },
        { resource: "Procedure", permissions: ["read", "search"] },
        { resource: "MedicationRequest", permissions: ["read", "search"] },
        { resource: "Group", permissions: ["read", "search"] },
        { resource: "MeasureReport", permissions: ["read", "write"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "launch-standalone", "client-confidential-symmetric", "permission-user"],
      certifications: [
        { type: "NCQA Certified", issuer: "NCQA", validUntil: "2025-12-31", verified: true },
        { type: "SOC 2 Type II", issuer: "Ernst & Young", validUntil: "2025-08-31", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 320,
      rating: 4.4,
      ratingCount: 19,
      lastUpdated: "2024-02-05T00:00:00Z",
      createdAt: "2023-04-01T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "care-team-messenger",
      name: "Care Team Messenger",
      description: "Secure messaging and care coordination platform for healthcare teams with task management and patient context integration.",
      vendor: {
        name: "TeamCare Connect",
        url: "https://teamcareconnect.health",
      },
      category: "care-coordination",
      launchUrl: "https://app.teamcareconnect.health/messenger/launch",
      redirectUrls: ["https://app.teamcareconnect.health/messenger/auth/callback"],
      logoUrl: "https://teamcareconnect.health/brand/logo.svg",
      launchContext: ["patient", "encounter", "provider"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "Practitioner", permissions: ["read", "search"] },
        { resource: "PractitionerRole", permissions: ["read", "search"] },
        { resource: "CareTeam", permissions: ["read", "write"] },
        { resource: "Task", permissions: ["read", "write", "search"] },
        { resource: "Communication", permissions: ["read", "write"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-confidential-symmetric", "context-ehr-patient", "permission-user"],
      certifications: [
        { type: "HIPAA Compliant", issuer: "Third-party audit", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 580,
      rating: 4.6,
      ratingCount: 42,
      lastUpdated: "2024-01-25T00:00:00Z",
      createdAt: "2023-02-01T00:00:00Z",
    },
    {
      id: generateId("app"),
      clientId: "genomics-viewer",
      name: "Genomics Results Viewer",
      description: "Specialized viewer for genomic and pharmacogenomic test results with variant interpretation and clinical recommendations.",
      vendor: {
        name: "GenomeInsight",
        url: "https://genomeinsight.bio",
      },
      category: "genomics",
      launchUrl: "https://portal.genomeinsight.bio/viewer/launch",
      redirectUrls: ["https://portal.genomeinsight.bio/viewer/oauth/callback"],
      launchContext: ["patient"],
      scopes: [
        { resource: "Patient", permissions: ["read"] },
        { resource: "DiagnosticReport", permissions: ["read", "search"] },
        { resource: "Observation", permissions: ["read", "search"] },
        { resource: "MolecularSequence", permissions: ["read", "search"] },
      ],
      fhirVersion: "R4",
      capabilities: ["launch-ehr", "client-confidential-symmetric", "context-ehr-patient"],
      certifications: [
        { type: "CLIA Certified", issuer: "CMS", verified: true },
        { type: "CAP Accredited", issuer: "College of American Pathologists", verified: true },
      ],
      status: "active",
      trusted: true,
      installCount: 175,
      rating: 4.2,
      ratingCount: 11,
      lastUpdated: "2023-12-15T00:00:00Z",
      createdAt: "2023-06-01T00:00:00Z",
    },
  ];

  sampleApps.forEach(app => apps.set(app.id, app));
  console.log(`[SMARTAppsService] Initialized ${apps.size} sample SMART on FHIR apps`);
}

initializeSampleApps();

export function getAppGallery(filters?: SMARTAppGalleryFilter): SMARTApp[] {
  let result = Array.from(apps.values()).filter(app => app.status === "active");

  if (filters?.category) {
    result = result.filter(app => app.category === filters.category);
  }

  if (filters?.launchContext) {
    result = result.filter(app => app.launchContext.includes(filters.launchContext!));
  }

  if (filters?.fhirVersion) {
    result = result.filter(app => app.fhirVersion === filters.fhirVersion);
  }

  if (filters?.trusted !== undefined) {
    result = result.filter(app => app.trusted === filters.trusted);
  }

  if (filters?.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(app => 
      app.name.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      app.vendor.name.toLowerCase().includes(query)
    );
  }

  return result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

export function getAppById(appId: string): SMARTApp | undefined {
  return apps.get(appId);
}

export function getAppByClientId(clientId: string): SMARTApp | undefined {
  return Array.from(apps.values()).find(app => app.clientId === clientId);
}

export function installApp(
  appId: string,
  userId: string,
  organizationId?: string,
  customScopes?: SMARTScope[]
): SMARTAppInstallation | null {
  const app = apps.get(appId);
  if (!app) return null;

  const existingInstallation = Array.from(installations.values()).find(
    i => i.appId === appId && i.userId === userId
  );

  if (existingInstallation) {
    existingInstallation.status = "active";
    existingInstallation.customScopes = customScopes;
    return existingInstallation;
  }

  const installation: SMARTAppInstallation = {
    id: generateId("install"),
    appId,
    userId,
    organizationId,
    installedAt: new Date().toISOString(),
    launchCount: 0,
    customScopes,
    status: app.trusted ? "active" : "pending_approval",
  };

  installations.set(installation.id, installation);

  app.installCount++;

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "SMARTApp",
    resourceId: appId,
    details: `Installed SMART on FHIR app: ${app.name}`,
  });

  return installation;
}

export function getUserInstallations(userId: string): (SMARTAppInstallation & { app: SMARTApp })[] {
  return Array.from(installations.values())
    .filter(i => i.userId === userId)
    .map(installation => {
      const app = apps.get(installation.appId);
      return app ? { ...installation, app } : null;
    })
    .filter((i): i is SMARTAppInstallation & { app: SMARTApp } => i !== null);
}

export function uninstallApp(installationId: string, userId: string): boolean {
  const installation = installations.get(installationId);
  if (!installation || installation.userId !== userId) return false;

  const app = apps.get(installation.appId);
  if (app) {
    app.installCount = Math.max(0, app.installCount - 1);
  }

  logPhiAccess({
    userId,
    action: "delete",
    resourceType: "SMARTApp",
    resourceId: installation.appId,
    details: `Uninstalled SMART on FHIR app: ${app?.name || installation.appId}`,
  });

  return installations.delete(installationId);
}

export function initiateLaunch(
  installationId: string,
  userId: string,
  launchContext: SMARTLaunchContext,
  contextParams: SMARTLaunchRequest["contextParams"]
): SMARTLaunchRequest | null {
  const installation = installations.get(installationId);
  if (!installation || installation.userId !== userId || installation.status !== "active") {
    return null;
  }

  const app = apps.get(installation.appId);
  if (!app || !app.launchContext.includes(launchContext)) {
    return null;
  }

  const launchRequest: SMARTLaunchRequest = {
    id: generateId("launch"),
    installationId,
    appId: installation.appId,
    userId,
    launchContext,
    contextParams,
    state: generateSecureToken(),
    status: "initiated",
    createdAt: new Date().toISOString(),
  };

  launchRequests.set(launchRequest.id, launchRequest);

  logPhiAccess({
    userId,
    action: "read",
    resourceType: "SMARTApp",
    resourceId: installation.appId,
    patientId: contextParams.patient,
    details: `Initiated SMART launch for app: ${app.name}, context: ${launchContext}`,
  });

  return launchRequest;
}

export function authorizeLaunch(
  launchId: string,
  params?: {
    codeChallenge?: string;
    codeChallengeMethod?: "S256" | "plain";
    clientId?: string;
    redirectUri?: string;
    scope?: string;
  }
): SMARTLaunchRequest | null {
  const launch = launchRequests.get(launchId);
  if (!launch || launch.status !== "initiated") return null;

  launch.status = "authorized";
  
  if (params?.codeChallenge) {
    launch.codeChallenge = params.codeChallenge;
    launch.codeChallengeMethod = params.codeChallengeMethod || "S256";
  }
  if (params?.clientId) launch.clientId = params.clientId;
  if (params?.redirectUri) launch.redirectUri = params.redirectUri;
  launch.codeUsed = false;
  launch.authorizedAt = new Date().toISOString();
  launch.authorizationCode = generateSecureToken();
  
  return launch;
}

export function exchangeCodeForToken(
  authorizationCode: string,
  params?: {
    codeVerifier?: string;
    clientId?: string;
    redirectUri?: string;
  }
): { accessToken: string; refreshToken: string; expiresIn: number; patientId?: string } | null {
  const launch = Array.from(launchRequests.values()).find(
    l => l.authorizationCode === authorizationCode && l.status === "authorized" && !l.codeUsed
  );

  if (!launch) return null;

  // Verify PKCE if code_challenge was set during authorization
  if (launch.codeChallenge) {
    if (!params?.codeVerifier) {
      console.error("[SMARTAppsService] PKCE code_verifier required but not provided");
      return null;
    }
    if (!verifyPKCE(params.codeVerifier, launch.codeChallenge, launch.codeChallengeMethod || "S256")) {
      console.error("[SMARTAppsService] PKCE verification failed");
      return null;
    }
  }

  // Verify client_id matches if provided
  if (launch.clientId && params?.clientId && launch.clientId !== params.clientId) {
    console.error("[SMARTAppsService] Client ID mismatch");
    return null;
  }

  // Verify redirect_uri matches if provided
  if (launch.redirectUri && params?.redirectUri && launch.redirectUri !== params.redirectUri) {
    console.error("[SMARTAppsService] Redirect URI mismatch");
    return null;
  }
  
  // Mark code as used (one-time use)
  launch.codeUsed = true;

  launch.accessToken = generateSecureToken();
  launch.refreshToken = generateSecureToken();
  launch.expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  launch.status = "active";

  const installation = installations.get(launch.installationId);
  if (installation) {
    installation.lastLaunchedAt = new Date().toISOString();
    installation.launchCount++;
  }

  // Log HIPAA-compliant access
  logPhiAccess({
    userId: launch.userId,
    action: "read",
    resourceType: "SMARTApp",
    resourceId: launch.appId,
    patientId: launch.contextParams.patient,
    details: { type: "smart_token_issued", installationId: launch.installationId },
  });

  return {
    accessToken: launch.accessToken,
    refreshToken: launch.refreshToken,
    expiresIn: 3600,
    patientId: launch.contextParams.patient,
  };
}

export function revokeLaunch(launchId: string, userId: string): boolean {
  const launchToRevoke = launchRequests.get(launchId);
  if (!launchToRevoke || launchToRevoke.userId !== userId) return false;

  launchToRevoke.status = "revoked";
  launchToRevoke.accessToken = undefined;
  launchToRevoke.refreshToken = undefined;

  return true;
}

export function buildLaunchUrl(launchRequest: SMARTLaunchRequest): string {
  const app = apps.get(launchRequest.appId);
  if (!app) throw new Error("App not found");

  const params = new URLSearchParams({
    iss: "https://tabula-medica.example.com/fhir",
    launch: launchRequest.id,
  });

  return `${app.launchUrl}?${params.toString()}`;
}

export function getWellKnownSmartConfig(): object {
  return {
    authorization_endpoint: "/api/smart-apps/authorize",
    token_endpoint: "/api/smart-apps/token",
    introspection_endpoint: "/api/smart-apps/introspect",
    revocation_endpoint: "/api/smart-apps/revoke",
    registration_endpoint: "/api/smart-apps/register",
    capabilities: [
      "launch-ehr",
      "launch-standalone",
      "client-public",
      "client-confidential-symmetric",
      "context-ehr-patient",
      "context-ehr-encounter",
      "context-standalone-patient",
      "permission-offline",
      "permission-patient",
      "permission-user",
      "sso-openid-connect",
    ],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: [
      "openid",
      "fhirUser",
      "launch",
      "launch/patient",
      "launch/encounter",
      "patient/*.read",
      "patient/*.write",
      "user/*.read",
      "user/*.write",
      "system/*.read",
    ],
  };
}

export function getAppCategories(): { category: SMARTAppCategory; name: string; description: string; count: number }[] {
  const categoryCounts = new Map<SMARTAppCategory, number>();
  
  Array.from(apps.values())
    .filter(app => app.status === "active")
    .forEach(app => {
      categoryCounts.set(app.category, (categoryCounts.get(app.category) || 0) + 1);
    });

  const categories: { category: SMARTAppCategory; name: string; description: string }[] = [
    { category: "clinical-decision-support", name: "Clinical Decision Support", description: "Tools to assist clinical decision-making" },
    { category: "patient-engagement", name: "Patient Engagement", description: "Patient-facing apps and portals" },
    { category: "data-visualization", name: "Data Visualization", description: "Charts, graphs, and data displays" },
    { category: "care-coordination", name: "Care Coordination", description: "Team collaboration and care management" },
    { category: "population-health", name: "Population Health", description: "Population analytics and management" },
    { category: "imaging", name: "Medical Imaging", description: "DICOM viewers and imaging tools" },
    { category: "genomics", name: "Genomics", description: "Genetic and genomic data tools" },
    { category: "medication-management", name: "Medication Management", description: "Medication tracking and safety" },
    { category: "documentation", name: "Documentation", description: "Clinical documentation tools" },
    { category: "billing", name: "Billing & Coding", description: "Revenue cycle and billing tools" },
    { category: "other", name: "Other", description: "Other clinical applications" },
  ];

  return categories.map(c => ({
    ...c,
    count: categoryCounts.get(c.category) || 0,
  }));
}

export function getAppStatistics(): {
  totalApps: number;
  trustedApps: number;
  totalInstallations: number;
  totalLaunches: number;
  topApps: { app: SMARTApp; launchCount: number }[];
} {
  const activeApps = Array.from(apps.values()).filter(a => a.status === "active");
  const allInstallations = Array.from(installations.values());
  
  const appLaunchCounts = new Map<string, number>();
  allInstallations.forEach(i => {
    appLaunchCounts.set(i.appId, (appLaunchCounts.get(i.appId) || 0) + i.launchCount);
  });

  const topApps = Array.from(appLaunchCounts.entries())
    .map(([appId, launchCount]) => ({ app: apps.get(appId)!, launchCount }))
    .filter(item => item.app)
    .sort((a, b) => b.launchCount - a.launchCount)
    .slice(0, 5);

  return {
    totalApps: activeApps.length,
    trustedApps: activeApps.filter(a => a.trusted).length,
    totalInstallations: allInstallations.length,
    totalLaunches: allInstallations.reduce((sum, i) => sum + i.launchCount, 0),
    topApps,
  };
}

console.log("[SMARTAppsService] Service initialized with SMART on FHIR R4 support");
console.log("[SMARTAppsService] OAuth 2.0 + PKCE authorization flow available");
console.log("[SMARTAppsService] Scopes: patient/*.read, user/*.read, launch/patient, launch/encounter");
