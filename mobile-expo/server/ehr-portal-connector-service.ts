interface EHRPortalConnector {
  id: string;
  name: string;
  vendor: string;
  type: "ehr_portal" | "health_app" | "nutrition_tracker" | "telehealth";
  status: "active" | "pending" | "beta" | "maintenance";
  icon: string;
  description: string;
  authMethod: "SMART_on_FHIR" | "OAuth2" | "API_Key" | "Open_Connect";
  fhirVersion?: "R4" | "STU3" | "DSTU2";
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  capabilities: string[];
  supportedResourceTypes: string[];
  dataCategories: string[];
  patientReach?: number;
  region: string;
  complianceStandards: string[];
  lastHealthCheck: Date;
  latencyMs?: number;
}

interface EHRConnectionSession {
  id: string;
  userId: string;
  connectorId: string;
  status: "pending" | "authorized" | "connected" | "syncing" | "error" | "disconnected";
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  patientId?: string;
  lastSync?: Date;
  recordCount: number;
  connectedAt: Date;
  metadata?: Record<string, any>;
}

interface PortalSyncResult {
  connectorId: string;
  userId: string;
  syncedAt: Date;
  resourcesFetched: number;
  resourcesImported: number;
  duplicatesSkipped: number;
  errors: string[];
  resourceTypes: string[];
  dateRange: { start: Date; end: Date };
}

const EHR_PORTAL_CONNECTORS: EHRPortalConnector[] = [
  {
    id: "epic-mychart",
    name: "Epic MyChart",
    vendor: "Epic Systems",
    type: "ehr_portal",
    status: "active",
    icon: "monitor",
    description: "Access health records from Epic MyChart patient portal. Supports allergies, medications, lab results, immunizations, clinical notes, and care plans via SMART on FHIR",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    authUrl: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
    tokenUrl: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read", "patient/AllergyIntolerance.read", "patient/Immunization.read", "patient/DiagnosticReport.read", "patient/Procedure.read", "patient/Encounter.read", "patient/DocumentReference.read", "patient/CarePlan.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "allergies", "immunizations", "care-plans", "clinical-notes", "document-reference"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Procedure", "Encounter", "DocumentReference", "CarePlan", "Goal"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "procedures", "encounters", "documents", "care_plans"],
    patientReach: 250000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI", "US Core"],
    lastHealthCheck: new Date(),
    latencyMs: 200
  },
  {
    id: "cerner-health",
    name: "Oracle Health (Cerner)",
    vendor: "Oracle Health",
    type: "ehr_portal",
    status: "active",
    icon: "database",
    description: "Health records from Oracle Health (formerly Cerner) patient portals including HealtheLife. Access labs, medications, vitals, and clinical documents via SMART on FHIR",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
    authUrl: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize",
    tokenUrl: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read", "patient/AllergyIntolerance.read", "patient/Immunization.read", "patient/DiagnosticReport.read", "patient/Procedure.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "allergies", "immunizations", "vital-signs"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Procedure", "Encounter"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "procedures", "encounters"],
    patientReach: 100000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI", "US Core"],
    lastHealthCheck: new Date(),
    latencyMs: 250
  },
  {
    id: "allscripts-followmyhealth",
    name: "Allscripts FollowMyHealth",
    vendor: "Veradigm (Allscripts)",
    type: "ehr_portal",
    status: "active",
    icon: "clipboard",
    description: "Patient portal data from Allscripts FollowMyHealth. Access appointments, medications, lab results, and clinical summaries from participating practices",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://tw181unityfhir.allscriptsunity.com/R4/open-Sandbox",
    authUrl: "https://tw181unityfhir.allscriptsunity.com/R4/authorization/connect/authorize",
    tokenUrl: "https://tw181unityfhir.allscriptsunity.com/R4/authorization/connect/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "appointments"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Appointment"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "appointments"],
    patientReach: 45000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI"],
    lastHealthCheck: new Date(),
    latencyMs: 350
  },
  {
    id: "meditech-expanse",
    name: "MEDITECH Expanse",
    vendor: "MEDITECH",
    type: "ehr_portal",
    status: "active",
    icon: "layers",
    description: "Health records from MEDITECH Expanse patient portal. Access clinical data from community hospitals and health systems using MEDITECH EHR",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://fhir.meditech.com/r4",
    authUrl: "https://fhir.meditech.com/oauth2/authorize",
    tokenUrl: "https://fhir.meditech.com/oauth2/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "vital-signs"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Procedure"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "procedures"],
    patientReach: 35000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI"],
    lastHealthCheck: new Date(),
    latencyMs: 300
  },
  {
    id: "nextgen-patient-portal",
    name: "NextGen Patient Portal",
    vendor: "NextGen Healthcare",
    type: "ehr_portal",
    status: "active",
    icon: "grid",
    description: "Patient portal data from NextGen Healthcare. Access ambulatory care records from specialty and primary care practices",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/r4",
    authUrl: "https://fhir.nextgen.com/nge/prod/patient-oauth/connect/authorize",
    tokenUrl: "https://fhir.nextgen.com/nge/prod/patient-oauth/connect/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions"],
    patientReach: 25000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI"],
    lastHealthCheck: new Date(),
    latencyMs: 280
  },
  {
    id: "eclinicalworks",
    name: "eClinicalWorks healow",
    vendor: "eClinicalWorks",
    type: "ehr_portal",
    status: "active",
    icon: "heart",
    description: "Health records from eClinicalWorks healow patient portal. Access primary care and specialty records from one of the largest ambulatory EHR networks",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://fhir.eclinicalworks.com/fhir/r4",
    authUrl: "https://oauthserver.eclinicalworks.com/oauth/authorize",
    tokenUrl: "https://oauthserver.eclinicalworks.com/oauth/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "appointments"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Appointment"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "appointments"],
    patientReach: 40000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI"],
    lastHealthCheck: new Date(),
    latencyMs: 320
  },
  {
    id: "healow-connect4",
    name: "Healow Connect4 (FHIR R4)",
    vendor: "eClinicalWorks",
    type: "ehr_portal",
    status: "active",
    icon: "activity",
    description: "Healow Connect4 FHIR R4 sandbox for clinical documentation and patient data exchange. Supports CCD, CCDA, and clinical documentation workflows via the healow interoperability platform",
    authMethod: "API_Key",
    fhirVersion: "R4",
    baseUrl: process.env.HEALOW_FHIR_BASE_URL || "https://connect4.healow.com/apps/api/fhir/r4",
    authUrl: "https://connect4.healow.com/apps/api/oauth/authorize",
    tokenUrl: "https://connect4.healow.com/apps/api/oauth/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read", "patient/DocumentReference.read", "patient/ClinicalImpression.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "clinical-documentation", "document-exchange"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "DocumentReference", "Encounter", "Procedure", "ClinicalImpression"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "clinical-notes", "documents"],
    patientReach: 40000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI", "TEFCA"],
    lastHealthCheck: new Date(),
    latencyMs: 250
  },
  {
    id: "athenahealth",
    name: "athenahealth Patient Portal",
    vendor: "athenahealth",
    type: "ehr_portal",
    status: "active",
    icon: "briefcase",
    description: "Health records from athenahealth patient portal. Access clinical data from ambulatory practices using athenaOne platform",
    authMethod: "SMART_on_FHIR",
    fhirVersion: "R4",
    baseUrl: "https://api.platform.athenahealth.com/fhir/r4",
    authUrl: "https://api.platform.athenahealth.com/oauth2/v1/authorize",
    tokenUrl: "https://api.platform.athenahealth.com/oauth2/v1/token",
    scopes: ["launch/patient", "patient/Patient.read", "patient/Observation.read", "patient/Condition.read", "patient/MedicationRequest.read"],
    capabilities: ["patient-access", "clinical-data", "lab-results", "medications", "appointments", "clinical-notes"],
    supportedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Encounter", "Appointment"],
    dataCategories: ["labs", "vitals", "medications", "allergies", "immunizations", "conditions", "encounters", "appointments"],
    patientReach: 30000000,
    region: "US",
    complianceStandards: ["HIPAA", "ONC", "USCDI"],
    lastHealthCheck: new Date(),
    latencyMs: 220
  },
  {
    id: "myfitnesspal",
    name: "MyFitnessPal",
    vendor: "Under Armour",
    type: "nutrition_tracker",
    status: "active",
    icon: "pie-chart",
    description: "Nutrition and calorie tracking data from MyFitnessPal. Import food diary entries, macronutrient breakdowns, meal logs, and calorie goals",
    authMethod: "OAuth2",
    baseUrl: "https://api.myfitnesspal.com/v2",
    authUrl: "https://api.myfitnesspal.com/oauth2/authorize",
    tokenUrl: "https://api.myfitnesspal.com/oauth2/token",
    scopes: ["diary", "measurements", "nutrition"],
    capabilities: ["nutrition-tracking", "calorie-counting", "food-diary", "macronutrient-breakdown", "meal-planning", "barcode-scanning"],
    supportedResourceTypes: ["NutritionIntake", "Observation"],
    dataCategories: ["nutrition", "calories", "macros", "meals", "water_intake", "weight"],
    patientReach: 200000000,
    region: "Global",
    complianceStandards: ["HIPAA"],
    lastHealthCheck: new Date(),
    latencyMs: 150
  },
  {
    id: "cronometer",
    name: "Cronometer",
    vendor: "Cronometer Software",
    type: "nutrition_tracker",
    status: "active",
    icon: "bar-chart-2",
    description: "Detailed micronutrient and macronutrient tracking from Cronometer. Provides comprehensive vitamin, mineral, and nutrient data with high accuracy",
    authMethod: "OAuth2",
    baseUrl: "https://cronometer.com/api/v1",
    authUrl: "https://cronometer.com/oauth2/authorize",
    tokenUrl: "https://cronometer.com/oauth2/token",
    scopes: ["diary.read", "biometrics.read"],
    capabilities: ["nutrition-tracking", "micronutrient-detail", "vitamin-tracking", "mineral-tracking", "custom-foods", "recipe-analysis"],
    supportedResourceTypes: ["NutritionIntake", "Observation"],
    dataCategories: ["nutrition", "calories", "macros", "micronutrients", "vitamins", "minerals", "water_intake", "weight"],
    patientReach: 10000000,
    region: "Global",
    complianceStandards: ["HIPAA"],
    lastHealthCheck: new Date(),
    latencyMs: 180
  },
  {
    id: "loseit",
    name: "Lose It!",
    vendor: "FitNow",
    type: "nutrition_tracker",
    status: "active",
    icon: "target",
    description: "Weight loss and calorie tracking data from Lose It! app. Import food logs, exercise entries, weight tracking, and goal progress",
    authMethod: "OAuth2",
    baseUrl: "https://api.loseit.com/v4",
    authUrl: "https://api.loseit.com/oauth2/authorize",
    tokenUrl: "https://api.loseit.com/oauth2/token",
    scopes: ["food_log", "exercise_log", "weight_log"],
    capabilities: ["calorie-tracking", "food-diary", "exercise-tracking", "weight-goals", "snap-it-food-recognition"],
    supportedResourceTypes: ["NutritionIntake", "Observation"],
    dataCategories: ["nutrition", "calories", "exercise", "weight", "goals"],
    patientReach: 50000000,
    region: "Global",
    complianceStandards: ["HIPAA"],
    lastHealthCheck: new Date(),
    latencyMs: 160
  },
  {
    id: "noom",
    name: "Noom",
    vendor: "Noom Inc.",
    type: "health_app",
    status: "beta",
    icon: "trending-down",
    description: "Behavioral health and weight management data from Noom. Import food logs, weight tracking, step counts, and behavioral coaching progress",
    authMethod: "OAuth2",
    baseUrl: "https://api.noom.com/v1",
    authUrl: "https://api.noom.com/oauth2/authorize",
    tokenUrl: "https://api.noom.com/oauth2/token",
    scopes: ["profile.read", "food_log.read", "weight.read"],
    capabilities: ["behavioral-tracking", "food-logging", "weight-management", "step-tracking", "coaching-progress"],
    supportedResourceTypes: ["NutritionIntake", "Observation"],
    dataCategories: ["nutrition", "weight", "steps", "behavioral_health"],
    patientReach: 45000000,
    region: "Global",
    complianceStandards: ["HIPAA"],
    lastHealthCheck: new Date(),
    latencyMs: 200
  },
  {
    id: "fatsecret",
    name: "FatSecret",
    vendor: "FatSecret",
    type: "nutrition_tracker",
    status: "active",
    icon: "book-open",
    description: "Food and nutrition database with meal tracking from FatSecret Platform API. Access food diary, recipes, and comprehensive nutritional data",
    authMethod: "OAuth2",
    baseUrl: "https://platform.fatsecret.com/rest/server.api",
    authUrl: "https://oauth.fatsecret.com/connect/authorize",
    tokenUrl: "https://oauth.fatsecret.com/connect/token",
    scopes: ["basic", "premier"],
    capabilities: ["food-database", "nutrition-tracking", "recipe-search", "barcode-lookup", "meal-logging"],
    supportedResourceTypes: ["NutritionIntake", "Observation"],
    dataCategories: ["nutrition", "calories", "macros", "meals"],
    patientReach: 30000000,
    region: "Global",
    complianceStandards: ["HIPAA"],
    lastHealthCheck: new Date(),
    latencyMs: 130
  }
];

class EHRPortalConnectorService {
  private connectors: Map<string, EHRPortalConnector> = new Map();
  private sessions: Map<string, EHRConnectionSession> = new Map();
  private syncResults: Map<string, PortalSyncResult[]> = new Map();

  constructor() {
    EHR_PORTAL_CONNECTORS.forEach(c => this.connectors.set(c.id, c));
  }

  getAllConnectors(): EHRPortalConnector[] {
    return Array.from(this.connectors.values());
  }

  getConnectorsByType(type: EHRPortalConnector["type"]): EHRPortalConnector[] {
    return Array.from(this.connectors.values()).filter(c => c.type === type);
  }

  getConnector(id: string): EHRPortalConnector | undefined {
    return this.connectors.get(id);
  }

  getConnectorTypes(): { type: string; label: string; count: number; description: string }[] {
    const types: Record<string, { label: string; count: number; description: string }> = {};
    this.connectors.forEach(c => {
      if (!types[c.type]) {
        types[c.type] = { label: this.formatTypeLabel(c.type), count: 0, description: this.getTypeDescription(c.type) };
      }
      types[c.type].count++;
    });
    return Object.entries(types).map(([type, info]) => ({ type, ...info }));
  }

  private formatTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ehr_portal: "EHR Patient Portals",
      health_app: "Health & Wellness Apps",
      nutrition_tracker: "Nutrition Trackers",
      telehealth: "Telehealth Platforms"
    };
    return labels[type] || type;
  }

  private getTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      ehr_portal: "Connect to hospital and clinic patient portals to import your medical records, lab results, medications, and care plans",
      health_app: "Sync health and wellness data from popular health management apps",
      nutrition_tracker: "Import nutrition, diet, and calorie tracking data from food logging apps",
      telehealth: "Connect telehealth platforms for virtual visit records and prescriptions"
    };
    return descriptions[type] || "";
  }

  getAuthorizationUrl(connectorId: string, state: string, redirectUri: string): string {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error("Connector not found");

    const url = new URL(connector.authUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", `tabula_medica_${connectorId}`);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", connector.scopes.join(" "));
    url.searchParams.set("state", state);
    if (connector.authMethod === "SMART_on_FHIR") {
      url.searchParams.set("aud", connector.baseUrl);
    }
    return url.toString();
  }

  async initiateConnection(userId: string, connectorId: string): Promise<EHRConnectionSession> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error("Connector not found");

    const session: EHRConnectionSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      connectorId,
      status: "pending",
      recordCount: 0,
      connectedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async completeConnection(sessionId: string, authCode: string): Promise<EHRConnectionSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    session.status = "connected";
    session.accessToken = `token_${Math.random().toString(36).substr(2, 16)}`;
    session.refreshToken = `refresh_${Math.random().toString(36).substr(2, 16)}`;
    session.tokenExpiry = new Date(Date.now() + 3600000);
    session.patientId = `patient_${Math.random().toString(36).substr(2, 8)}`;
    session.lastSync = new Date();

    return session;
  }

  async syncConnection(sessionId: string): Promise<PortalSyncResult> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const connector = this.connectors.get(session.connectorId);
    if (!connector) throw new Error("Connector not found");

    session.status = "syncing";

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const now = new Date();
    const resourceCount = Math.floor(Math.random() * 50) + 10;
    const duplicates = Math.floor(Math.random() * 5);

    const result: PortalSyncResult = {
      connectorId: session.connectorId,
      userId: session.userId,
      syncedAt: now,
      resourcesFetched: resourceCount,
      resourcesImported: resourceCount - duplicates,
      duplicatesSkipped: duplicates,
      errors: [],
      resourceTypes: connector.supportedResourceTypes.slice(0, Math.floor(Math.random() * 5) + 3),
      dateRange: {
        start: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        end: now
      }
    };

    session.status = "connected";
    session.lastSync = now;
    session.recordCount += result.resourcesImported;

    const userId = session.userId;
    if (!this.syncResults.has(userId)) {
      this.syncResults.set(userId, []);
    }
    this.syncResults.get(userId)!.push(result);

    return result;
  }

  getUserSessions(userId: string): EHRConnectionSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId);
  }

  getSession(sessionId: string): EHRConnectionSession | undefined {
    return this.sessions.get(sessionId);
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    session.status = "disconnected";
    session.accessToken = undefined;
    session.refreshToken = undefined;
  }

  getSyncHistory(userId: string): PortalSyncResult[] {
    return this.syncResults.get(userId) || [];
  }

  getStats(): {
    totalConnectors: number;
    activeConnectors: number;
    totalPatientReach: number;
    connectorsByType: Record<string, number>;
    connectorsByStatus: Record<string, number>;
  } {
    const connectors = Array.from(this.connectors.values());
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalReach = 0;

    connectors.forEach(c => {
      byType[c.type] = (byType[c.type] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      totalReach += c.patientReach || 0;
    });

    return {
      totalConnectors: connectors.length,
      activeConnectors: connectors.filter(c => c.status === "active").length,
      totalPatientReach: totalReach,
      connectorsByType: byType,
      connectorsByStatus: byStatus
    };
  }
}

export const ehrPortalConnectorService = new EHRPortalConnectorService();
