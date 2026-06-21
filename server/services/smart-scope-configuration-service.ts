import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][SmartScopeConfig] ${action} - ResourceType:${resourceType} ResourceId:${resourceId} User:${userId} - ${details}`);
}

export type ScopeCategory = "patient" | "user" | "system" | "launch" | "openid" | "custom";
export type ScopePermission = "read" | "write" | "search" | "*";
export type ResourceType = 
  | "Patient" | "Observation" | "Condition" | "MedicationRequest" | "MedicationStatement"
  | "AllergyIntolerance" | "Immunization" | "Procedure" | "Encounter" | "DiagnosticReport"
  | "CarePlan" | "Goal" | "DocumentReference" | "Practitioner" | "Organization"
  | "Location" | "Device" | "Coverage" | "Claim" | "*";

export interface ScopeDefinition {
  id: string;
  scope: string;
  displayName: string;
  description: string;
  category: ScopeCategory;
  resourceType?: ResourceType;
  permissions: ScopePermission[];
  requiresContext?: ("patient" | "encounter" | "practitioner")[];
  confidentiality?: "normal" | "restricted" | "very-restricted";
  isStandard: boolean;
  isCustom: boolean;
  fhirVersion: "R4" | "STU3" | "DSTU2" | "all";
  examples?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppScopeConfiguration {
  id: string;
  appId: string;
  clientId: string;
  appName: string;
  requestedScopes: string[];
  grantedScopes: string[];
  deniedScopes: string[];
  customScopeRules: ScopeRule[];
  scopeRestrictions: ScopeRestriction[];
  authorizationParams: AuthorizationParams;
  consentPolicy: ConsentPolicy;
  status: "active" | "pending" | "suspended";
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
}

export interface ScopeRule {
  id: string;
  name: string;
  description: string;
  condition: {
    type: "resource" | "context" | "user" | "time";
    operator: "equals" | "contains" | "matches" | "in" | "not_in";
    value: string | string[];
  };
  action: "allow" | "deny" | "require_consent" | "downgrade";
  targetScopes: string[];
  priority: number;
  enabled: boolean;
}

export interface ScopeRestriction {
  id: string;
  scope: string;
  restrictions: {
    resourceIds?: string[];
    timeWindow?: {
      start?: string;
      end?: string;
    };
    maxRecords?: number;
    excludeCategories?: string[];
    requireFreshConsent?: boolean;
  };
}

export interface AuthorizationParams {
  responseType: "code" | "token" | "id_token" | "code id_token";
  codeChallengeMethod: "S256" | "plain" | "none";
  requirePkce: boolean;
  tokenLifetime: number;
  refreshTokenLifetime?: number;
  allowOfflineAccess: boolean;
  promptBehavior: "login" | "consent" | "none" | "select_account";
  maxAge?: number;
  acrValues?: string[];
  claims?: {
    userinfo?: Record<string, any>;
    id_token?: Record<string, any>;
  };
}

export interface ConsentPolicy {
  requireExplicitConsent: boolean;
  consentGranularity: "all_or_nothing" | "per_scope" | "per_resource";
  consentDuration: number;
  allowConsentRevocation: boolean;
  showScopeDetails: boolean;
  customConsentText?: string;
}

export interface ScopeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  scopes: string[];
  authorizationParams: Partial<AuthorizationParams>;
  consentPolicy: Partial<ConsentPolicy>;
  usageCount: number;
  isDefault: boolean;
}

export interface ScopeValidationResult {
  isValid: boolean;
  errors: { scope: string; error: string }[];
  warnings: { scope: string; warning: string }[];
  expandedScopes: string[];
  effectiveScopes: string[];
}

const scopeDefinitions = new Map<string, ScopeDefinition>();
const appConfigurations = new Map<string, AppScopeConfiguration>();
const scopeTemplates = new Map<string, ScopeTemplate>();

function initializeSampleData(): void {
  const now = new Date().toISOString();

  const standardScopes: ScopeDefinition[] = [
    {
      id: "scope-openid",
      scope: "openid",
      displayName: "OpenID Connect",
      description: "Required for OIDC authentication. Provides user identity.",
      category: "openid",
      permissions: ["read"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-profile",
      scope: "profile",
      displayName: "User Profile",
      description: "Access to basic user profile information.",
      category: "openid",
      permissions: ["read"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-fhiruser",
      scope: "fhirUser",
      displayName: "FHIR User",
      description: "Access to the FHIR resource representing the current user.",
      category: "openid",
      permissions: ["read"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-launch-patient",
      scope: "launch/patient",
      displayName: "Launch with Patient Context",
      description: "App receives patient context from the EHR.",
      category: "launch",
      permissions: ["read"],
      requiresContext: ["patient"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-launch-encounter",
      scope: "launch/encounter",
      displayName: "Launch with Encounter Context",
      description: "App receives encounter context from the EHR.",
      category: "launch",
      permissions: ["read"],
      requiresContext: ["encounter"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-offline-access",
      scope: "offline_access",
      displayName: "Offline Access",
      description: "Request a refresh token for long-lived access.",
      category: "openid",
      permissions: ["read"],
      confidentiality: "restricted",
      isStandard: true,
      isCustom: false,
      fhirVersion: "all",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-patient-all-read",
      scope: "patient/*.read",
      displayName: "Read All Patient Data",
      description: "Read access to all FHIR resources associated with the patient.",
      category: "patient",
      resourceType: "*",
      permissions: ["read"],
      requiresContext: ["patient"],
      confidentiality: "restricted",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      examples: ["patient/Patient.read", "patient/Observation.read"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-patient-observation-read",
      scope: "patient/Observation.read",
      displayName: "Read Patient Observations",
      description: "Read access to patient observation data (vitals, lab results, etc.)",
      category: "patient",
      resourceType: "Observation",
      permissions: ["read"],
      requiresContext: ["patient"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-patient-condition-read",
      scope: "patient/Condition.read",
      displayName: "Read Patient Conditions",
      description: "Read access to patient diagnosis and condition data.",
      category: "patient",
      resourceType: "Condition",
      permissions: ["read"],
      requiresContext: ["patient"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-patient-medication-read",
      scope: "patient/MedicationRequest.read",
      displayName: "Read Medication Requests",
      description: "Read access to patient medication orders and prescriptions.",
      category: "patient",
      resourceType: "MedicationRequest",
      permissions: ["read"],
      requiresContext: ["patient"],
      confidentiality: "normal",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-user-all-read",
      scope: "user/*.read",
      displayName: "Read All User-Accessible Data",
      description: "Read access to all FHIR resources the user has access to.",
      category: "user",
      resourceType: "*",
      permissions: ["read"],
      confidentiality: "restricted",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scope-system-all-read",
      scope: "system/*.read",
      displayName: "System-Level Read Access",
      description: "Backend service read access to all FHIR resources.",
      category: "system",
      resourceType: "*",
      permissions: ["read"],
      confidentiality: "very-restricted",
      isStandard: true,
      isCustom: false,
      fhirVersion: "R4",
      createdAt: now,
      updatedAt: now
    }
  ];

  standardScopes.forEach(scope => scopeDefinitions.set(scope.id, scope));

  const sampleAppConfig: AppScopeConfiguration = {
    id: "config-001",
    appId: "growth-chart-app",
    clientId: "growth-chart-client",
    appName: "Growth Chart Viewer",
    requestedScopes: ["openid", "profile", "launch/patient", "patient/*.read", "offline_access"],
    grantedScopes: ["openid", "profile", "launch/patient", "patient/Observation.read", "patient/Patient.read"],
    deniedScopes: ["offline_access"],
    customScopeRules: [
      {
        id: "rule-001",
        name: "Limit to vital signs only",
        description: "Restrict observation access to vital signs category",
        condition: {
          type: "resource",
          operator: "equals",
          value: "Observation"
        },
        action: "allow",
        targetScopes: ["patient/Observation.read"],
        priority: 1,
        enabled: true
      }
    ],
    scopeRestrictions: [
      {
        id: "restriction-001",
        scope: "patient/Observation.read",
        restrictions: {
          excludeCategories: ["laboratory", "social-history"],
          maxRecords: 100
        }
      }
    ],
    authorizationParams: {
      responseType: "code",
      codeChallengeMethod: "S256",
      requirePkce: true,
      tokenLifetime: 3600,
      refreshTokenLifetime: 604800,
      allowOfflineAccess: false,
      promptBehavior: "consent"
    },
    consentPolicy: {
      requireExplicitConsent: true,
      consentGranularity: "per_scope",
      consentDuration: 86400 * 30,
      allowConsentRevocation: true,
      showScopeDetails: true
    },
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: now,
    reviewedBy: "admin-001"
  };

  appConfigurations.set(sampleAppConfig.id, sampleAppConfig);

  const sampleTemplates: ScopeTemplate[] = [
    {
      id: "template-patient-viewer",
      name: "Patient Data Viewer",
      description: "Standard scopes for apps that only need to read patient data",
      category: "read-only",
      scopes: ["openid", "profile", "launch/patient", "patient/*.read"],
      authorizationParams: {
        requirePkce: true,
        tokenLifetime: 3600
      },
      consentPolicy: {
        requireExplicitConsent: true,
        consentGranularity: "all_or_nothing"
      },
      usageCount: 15,
      isDefault: true
    },
    {
      id: "template-clinical-app",
      name: "Clinical Application",
      description: "Scopes for clinical apps needing read/write access",
      category: "clinical",
      scopes: ["openid", "profile", "fhirUser", "launch/patient", "launch/encounter", "patient/*.read", "patient/*.write"],
      authorizationParams: {
        requirePkce: true,
        tokenLifetime: 1800,
        promptBehavior: "consent"
      },
      consentPolicy: {
        requireExplicitConsent: true,
        consentGranularity: "per_scope",
        showScopeDetails: true
      },
      usageCount: 8,
      isDefault: false
    },
    {
      id: "template-backend-service",
      name: "Backend Service",
      description: "System-level scopes for backend integrations",
      category: "system",
      scopes: ["system/*.read"],
      authorizationParams: {
        requirePkce: false,
        tokenLifetime: 300
      },
      consentPolicy: {
        requireExplicitConsent: false,
        consentGranularity: "all_or_nothing"
      },
      usageCount: 5,
      isDefault: false
    }
  ];

  sampleTemplates.forEach(t => scopeTemplates.set(t.id, t));
}

initializeSampleData();

class SmartScopeConfigurationService {
  async getScopeDefinitions(category?: ScopeCategory): Promise<ScopeDefinition[]> {
    const all = Array.from(scopeDefinitions.values());
    if (category) {
      return all.filter(s => s.category === category);
    }
    return all;
  }

  async getScopeDefinition(scopeId: string): Promise<ScopeDefinition | null> {
    return scopeDefinitions.get(scopeId) || null;
  }

  async createCustomScope(params: {
    scope: string;
    displayName: string;
    description: string;
    category: ScopeCategory;
    resourceType?: ResourceType;
    permissions: ScopePermission[];
    confidentiality?: ScopeDefinition["confidentiality"];
    fhirVersion?: ScopeDefinition["fhirVersion"];
    userId: string;
  }): Promise<ScopeDefinition> {
    const now = new Date().toISOString();
    const definition: ScopeDefinition = {
      id: generateId("scope"),
      scope: params.scope,
      displayName: params.displayName,
      description: params.description,
      category: params.category,
      resourceType: params.resourceType,
      permissions: params.permissions,
      confidentiality: params.confidentiality || "normal",
      isStandard: false,
      isCustom: true,
      fhirVersion: params.fhirVersion || "R4",
      createdAt: now,
      updatedAt: now
    };

    scopeDefinitions.set(definition.id, definition);

    auditLog("SCOPE_CREATED", "ScopeDefinition", definition.id, params.userId,
      `Created custom scope: ${params.scope}`);

    return definition;
  }

  async getAppConfiguration(appId: string): Promise<AppScopeConfiguration | null> {
    const allConfigs = Array.from(appConfigurations.values());
    for (const config of allConfigs) {
      if (config.appId === appId) {
        return config;
      }
    }
    return null;
  }

  async getAllAppConfigurations(): Promise<AppScopeConfiguration[]> {
    return Array.from(appConfigurations.values());
  }

  async createAppConfiguration(params: {
    appId: string;
    clientId: string;
    appName: string;
    requestedScopes: string[];
    authorizationParams?: Partial<AuthorizationParams>;
    consentPolicy?: Partial<ConsentPolicy>;
    userId: string;
  }): Promise<AppScopeConfiguration> {
    const now = new Date().toISOString();

    const defaultAuthParams: AuthorizationParams = {
      responseType: "code",
      codeChallengeMethod: "S256",
      requirePkce: true,
      tokenLifetime: 3600,
      allowOfflineAccess: false,
      promptBehavior: "consent"
    };

    const defaultConsentPolicy: ConsentPolicy = {
      requireExplicitConsent: true,
      consentGranularity: "per_scope",
      consentDuration: 86400 * 30,
      allowConsentRevocation: true,
      showScopeDetails: true
    };

    const config: AppScopeConfiguration = {
      id: generateId("config"),
      appId: params.appId,
      clientId: params.clientId,
      appName: params.appName,
      requestedScopes: params.requestedScopes,
      grantedScopes: [],
      deniedScopes: [],
      customScopeRules: [],
      scopeRestrictions: [],
      authorizationParams: { ...defaultAuthParams, ...params.authorizationParams },
      consentPolicy: { ...defaultConsentPolicy, ...params.consentPolicy },
      status: "pending",
      createdAt: now,
      updatedAt: now
    };

    appConfigurations.set(config.id, config);

    auditLog("APP_CONFIG_CREATED", "AppScopeConfiguration", config.id, params.userId,
      `Created scope configuration for app: ${params.appName}`);

    return config;
  }

  async updateAppConfiguration(
    configId: string,
    updates: Partial<AppScopeConfiguration>,
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    const updated: AppScopeConfiguration = {
      ...config,
      ...updates,
      id: config.id,
      updatedAt: new Date().toISOString()
    };

    appConfigurations.set(configId, updated);

    auditLog("APP_CONFIG_UPDATED", "AppScopeConfiguration", configId, userId,
      `Updated scope configuration for app: ${config.appName}`);

    return updated;
  }

  async grantScopes(
    configId: string,
    scopes: string[],
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    const newGranted = Array.from(new Set([...config.grantedScopes, ...scopes]));
    const newDenied = config.deniedScopes.filter(s => !scopes.includes(s));

    config.grantedScopes = newGranted;
    config.deniedScopes = newDenied;
    config.updatedAt = new Date().toISOString();
    config.lastReviewedAt = new Date().toISOString();
    config.reviewedBy = userId;

    appConfigurations.set(configId, config);

    auditLog("SCOPES_GRANTED", "AppScopeConfiguration", configId, userId,
      `Granted scopes: ${scopes.join(", ")}`);

    return config;
  }

  async denyScopes(
    configId: string,
    scopes: string[],
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    const newDenied = Array.from(new Set([...config.deniedScopes, ...scopes]));
    const newGranted = config.grantedScopes.filter(s => !scopes.includes(s));

    config.grantedScopes = newGranted;
    config.deniedScopes = newDenied;
    config.updatedAt = new Date().toISOString();
    config.lastReviewedAt = new Date().toISOString();
    config.reviewedBy = userId;

    appConfigurations.set(configId, config);

    auditLog("SCOPES_DENIED", "AppScopeConfiguration", configId, userId,
      `Denied scopes: ${scopes.join(", ")}`);

    return config;
  }

  async addScopeRule(
    configId: string,
    rule: Omit<ScopeRule, "id">,
    userId: string
  ): Promise<ScopeRule | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    const newRule: ScopeRule = {
      ...rule,
      id: generateId("rule")
    };

    config.customScopeRules.push(newRule);
    config.updatedAt = new Date().toISOString();
    appConfigurations.set(configId, config);

    auditLog("SCOPE_RULE_ADDED", "ScopeRule", newRule.id, userId,
      `Added scope rule: ${newRule.name}`);

    return newRule;
  }

  async removeScopeRule(
    configId: string,
    ruleId: string,
    userId: string
  ): Promise<boolean> {
    const config = appConfigurations.get(configId);
    if (!config) return false;

    const initialLength = config.customScopeRules.length;
    config.customScopeRules = config.customScopeRules.filter(r => r.id !== ruleId);

    if (config.customScopeRules.length < initialLength) {
      config.updatedAt = new Date().toISOString();
      appConfigurations.set(configId, config);

      auditLog("SCOPE_RULE_REMOVED", "ScopeRule", ruleId, userId,
        `Removed scope rule from config: ${configId}`);

      return true;
    }

    return false;
  }

  async addScopeRestriction(
    configId: string,
    restriction: Omit<ScopeRestriction, "id">,
    userId: string
  ): Promise<ScopeRestriction | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    const newRestriction: ScopeRestriction = {
      ...restriction,
      id: generateId("restriction")
    };

    config.scopeRestrictions.push(newRestriction);
    config.updatedAt = new Date().toISOString();
    appConfigurations.set(configId, config);

    auditLog("SCOPE_RESTRICTION_ADDED", "ScopeRestriction", newRestriction.id, userId,
      `Added restriction for scope: ${newRestriction.scope}`);

    return newRestriction;
  }

  async validateScopes(scopes: string[]): Promise<ScopeValidationResult> {
    const errors: { scope: string; error: string }[] = [];
    const warnings: { scope: string; warning: string }[] = [];
    const expandedScopes: string[] = [];
    const effectiveScopes: string[] = [];

    const allDefinitions = Array.from(scopeDefinitions.values());

    for (const scope of scopes) {
      const definition = allDefinitions.find(d => d.scope === scope);

      if (!definition) {
        if (scope.includes("/") && (scope.includes(".read") || scope.includes(".write"))) {
          warnings.push({
            scope,
            warning: "Scope not in standard definitions but appears to follow SMART format"
          });
          effectiveScopes.push(scope);
        } else {
          errors.push({
            scope,
            error: "Unknown scope"
          });
        }
        continue;
      }

      if (definition.confidentiality === "very-restricted") {
        warnings.push({
          scope,
          warning: "This scope provides elevated access and requires additional review"
        });
      }

      if (definition.scope.includes("*")) {
        const resourceType = definition.category;
        const permission = definition.permissions[0];
        expandedScopes.push(`Expands to all ${resourceType} resources with ${permission} permission`);
      }

      effectiveScopes.push(scope);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      expandedScopes,
      effectiveScopes
    };
  }

  async getTemplates(): Promise<ScopeTemplate[]> {
    return Array.from(scopeTemplates.values());
  }

  async applyTemplate(
    configId: string,
    templateId: string,
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    const template = scopeTemplates.get(templateId);
    if (!config || !template) return null;

    config.requestedScopes = template.scopes;
    config.authorizationParams = {
      ...config.authorizationParams,
      ...template.authorizationParams
    };
    config.consentPolicy = {
      ...config.consentPolicy,
      ...template.consentPolicy
    };
    config.updatedAt = new Date().toISOString();

    appConfigurations.set(configId, config);

    template.usageCount++;
    scopeTemplates.set(templateId, template);

    auditLog("TEMPLATE_APPLIED", "AppScopeConfiguration", configId, userId,
      `Applied template: ${template.name}`);

    return config;
  }

  async updateAuthorizationParams(
    configId: string,
    params: Partial<AuthorizationParams>,
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    config.authorizationParams = {
      ...config.authorizationParams,
      ...params
    };
    config.updatedAt = new Date().toISOString();

    appConfigurations.set(configId, config);

    auditLog("AUTH_PARAMS_UPDATED", "AppScopeConfiguration", configId, userId,
      `Updated authorization parameters`);

    return config;
  }

  async updateConsentPolicy(
    configId: string,
    policy: Partial<ConsentPolicy>,
    userId: string
  ): Promise<AppScopeConfiguration | null> {
    const config = appConfigurations.get(configId);
    if (!config) return null;

    config.consentPolicy = {
      ...config.consentPolicy,
      ...policy
    };
    config.updatedAt = new Date().toISOString();

    appConfigurations.set(configId, config);

    auditLog("CONSENT_POLICY_UPDATED", "AppScopeConfiguration", configId, userId,
      `Updated consent policy`);

    return config;
  }

  async getStats(): Promise<{
    totalScopes: number;
    standardScopes: number;
    customScopes: number;
    totalAppConfigs: number;
    activeConfigs: number;
    pendingConfigs: number;
    scopesByCategory: Record<string, number>;
  }> {
    const allScopes = Array.from(scopeDefinitions.values());
    const allConfigs = Array.from(appConfigurations.values());

    const scopesByCategory: Record<string, number> = {};
    for (const scope of allScopes) {
      scopesByCategory[scope.category] = (scopesByCategory[scope.category] || 0) + 1;
    }

    return {
      totalScopes: allScopes.length,
      standardScopes: allScopes.filter(s => s.isStandard).length,
      customScopes: allScopes.filter(s => s.isCustom).length,
      totalAppConfigs: allConfigs.length,
      activeConfigs: allConfigs.filter(c => c.status === "active").length,
      pendingConfigs: allConfigs.filter(c => c.status === "pending").length,
      scopesByCategory
    };
  }
}

export const smartScopeConfigurationService = new SmartScopeConfigurationService();

console.log("[SmartScopeConfiguration] Service initialized");
console.log("[SmartScopeConfiguration] Scope definitions:", scopeDefinitions.size);
console.log("[SmartScopeConfiguration] App configurations:", appConfigurations.size);
console.log("[SmartScopeConfiguration] Templates:", scopeTemplates.size);
console.log("[SmartScopeConfiguration] Features: Custom scopes, rules, restrictions, templates, validation");
