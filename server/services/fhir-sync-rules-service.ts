import { randomUUID } from "crypto";

export type TriggerEventType = 
  | "resource_created" 
  | "resource_updated" 
  | "resource_deleted" 
  | "schedule" 
  | "manual" 
  | "webhook";

export type TriggerConditionOperator = 
  | "equals" 
  | "not_equals" 
  | "contains" 
  | "starts_with" 
  | "ends_with" 
  | "greater_than" 
  | "less_than" 
  | "is_empty" 
  | "is_not_empty" 
  | "matches_regex" 
  | "in_list";

export type TransformationType = 
  | "map_field" 
  | "concatenate" 
  | "split" 
  | "format_date" 
  | "lookup" 
  | "calculate" 
  | "set_constant" 
  | "conditional" 
  | "code_translate";

export type ConflictResolutionStrategy = 
  | "source_wins" 
  | "target_wins" 
  | "latest_wins" 
  | "merge_fields" 
  | "manual_review" 
  | "custom_workflow";

export interface SyncRule {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  priority: number;
  resourceTypes: string[];
  sourceEndpointId: string;
  targetEndpointId: string;
  triggerConfig: TriggerConfiguration;
  transformations: DataTransformation[];
  conflictResolution: ConflictResolutionConfig;
  validationRules: ValidationRule[];
  notificationConfig: NotificationConfig;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastTriggeredAt?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

export interface TriggerConfiguration {
  eventType: TriggerEventType;
  conditions: TriggerCondition[];
  scheduleConfig?: ScheduleConfig;
  webhookConfig?: WebhookConfig;
  debounceMs?: number;
  batchingConfig?: BatchingConfig;
}

export interface TriggerCondition {
  id: string;
  field: string;
  operator: TriggerConditionOperator;
  value: string | string[] | number | boolean;
  logicalOperator?: "AND" | "OR";
}

export interface ScheduleConfig {
  cronExpression: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
  maxExecutions?: number;
}

export interface WebhookConfig {
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  authType: "none" | "api_key" | "bearer" | "basic";
  authCredentialKey?: string;
}

export interface BatchingConfig {
  enabled: boolean;
  maxBatchSize: number;
  maxWaitTimeMs: number;
}

export interface DataTransformation {
  id: string;
  name: string;
  type: TransformationType;
  order: number;
  sourceField: string;
  targetField: string;
  config: TransformationConfig;
  isEnabled: boolean;
}

export interface TransformationConfig {
  mapTable?: Record<string, string>;
  formatPattern?: string;
  lookupTable?: string;
  lookupKeyField?: string;
  lookupValueField?: string;
  constantValue?: string | number | boolean;
  expression?: string;
  condition?: {
    field: string;
    operator: TriggerConditionOperator;
    value: string | string[] | number | boolean;
    trueResult: string;
    falseResult: string;
  };
  codeSystemSource?: string;
  codeSystemTarget?: string;
  splitDelimiter?: string;
  concatFields?: string[];
  concatSeparator?: string;
}

export interface ConflictResolutionConfig {
  defaultStrategy: ConflictResolutionStrategy;
  resourceSpecificStrategies: ResourceConflictStrategy[];
  fieldLevelResolution: FieldConflictRule[];
  escalationConfig: EscalationConfig;
  auditAllConflicts: boolean;
}

export interface ResourceConflictStrategy {
  resourceType: string;
  strategy: ConflictResolutionStrategy;
  customWorkflowId?: string;
}

export interface FieldConflictRule {
  resourceType: string;
  field: string;
  strategy: ConflictResolutionStrategy;
  mergeLogic?: "append" | "replace" | "combine_unique";
}

export interface EscalationConfig {
  enabled: boolean;
  escalateAfterMinutes: number;
  notifyUsers: string[];
  autoResolveStrategy?: ConflictResolutionStrategy;
}

export interface ValidationRule {
  id: string;
  name: string;
  field: string;
  validationType: "required" | "format" | "range" | "reference" | "custom";
  validationConfig: Record<string, unknown>;
  errorSeverity: "error" | "warning" | "info";
  errorMessage: string;
}

export interface NotificationConfig {
  onSuccess: boolean;
  onFailure: boolean;
  onConflict: boolean;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: "email" | "webhook" | "in_app";
  recipients: string[];
  config: Record<string, unknown>;
}

export interface SyncRuleExecution {
  id: string;
  ruleId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  triggerEvent: TriggerEventType;
  triggerData?: Record<string, unknown>;
  resourcesProcessed: number;
  resourcesSucceeded: number;
  resourcesFailed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  transformationsApplied: number;
  errors: SyncRuleError[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  auditLogId: string;
}

export interface SyncRuleError {
  resourceType: string;
  resourceId: string;
  phase: "trigger" | "validation" | "transformation" | "sync" | "conflict_resolution";
  errorCode: string;
  errorMessage: string;
  timestamp: string;
  isRetryable: boolean;
}

export interface ConflictRecord {
  id: string;
  executionId: string;
  ruleId: string;
  resourceType: string;
  resourceId: string;
  sourceVersion: Record<string, unknown>;
  targetVersion: Record<string, unknown>;
  conflictFields: string[];
  strategy: ConflictResolutionStrategy;
  status: "pending" | "resolved" | "escalated" | "skipped";
  resolution?: {
    resolvedBy: string;
    resolvedAt: string;
    chosenVersion: "source" | "target" | "merged";
    mergedData?: Record<string, unknown>;
    notes?: string;
  };
  createdAt: string;
}

export interface ConflictWorkflow {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  steps: ConflictWorkflowStep[];
  defaultAssignee?: string;
  slaHours: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictWorkflowStep {
  id: string;
  order: number;
  name: string;
  type: "auto_resolve" | "manual_review" | "notification" | "escalation" | "custom_script";
  config: Record<string, unknown>;
  condition?: TriggerCondition;
}

const syncRules = new Map<string, SyncRule>();
const syncRuleExecutions = new Map<string, SyncRuleExecution>();
const conflictRecords = new Map<string, ConflictRecord>();
const conflictWorkflows = new Map<string, ConflictWorkflow>();

function generateId(): string {
  return randomUUID();
}

const sampleEndpoints = [
  { id: "endpoint-epic", name: "Primary Care Provider" },
  { id: "endpoint-cerner", name: "Hospital Network" },
  { id: "endpoint-internal", name: "Internal FHIR Server" },
  { id: "endpoint-fastenhealth", name: "Fasten Health" },
];

const sampleSyncRules: SyncRule[] = [
  {
    id: "rule-patient-sync",
    name: "Patient Record Auto-Sync",
    description: "Automatically sync patient records when updated in EHR",
    isEnabled: true,
    priority: 1,
    resourceTypes: ["Patient"],
    sourceEndpointId: "endpoint-epic",
    targetEndpointId: "endpoint-internal",
    triggerConfig: {
      eventType: "resource_updated",
      conditions: [
        {
          id: "cond-1",
          field: "meta.lastUpdated",
          operator: "is_not_empty",
          value: true,
        },
      ],
      debounceMs: 5000,
    },
    transformations: [
      {
        id: "trans-1",
        name: "Standardize Name Format",
        type: "format_date",
        order: 1,
        sourceField: "birthDate",
        targetField: "birthDate",
        config: { formatPattern: "YYYY-MM-DD" },
        isEnabled: true,
      },
    ],
    conflictResolution: {
      defaultStrategy: "latest_wins",
      resourceSpecificStrategies: [],
      fieldLevelResolution: [
        {
          resourceType: "Patient",
          field: "telecom",
          strategy: "merge_fields",
          mergeLogic: "combine_unique",
        },
      ],
      escalationConfig: {
        enabled: true,
        escalateAfterMinutes: 60,
        notifyUsers: ["admin@example.com"],
      },
      auditAllConflicts: true,
    },
    validationRules: [],
    notificationConfig: {
      onSuccess: false,
      onFailure: true,
      onConflict: true,
      channels: [
        {
          type: "in_app",
          recipients: ["admins"],
          config: {},
        },
      ],
    },
    metadata: {},
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-03-01T00:00:00Z",
    createdBy: "system",
    lastTriggeredAt: "2024-03-15T14:30:00Z",
    executionCount: 1247,
    successCount: 1235,
    failureCount: 12,
  },
  {
    id: "rule-observation-sync",
    name: "Vital Signs Observation Sync",
    description: "Sync vital signs observations with code translation",
    isEnabled: true,
    priority: 2,
    resourceTypes: ["Observation"],
    sourceEndpointId: "endpoint-cerner",
    targetEndpointId: "endpoint-internal",
    triggerConfig: {
      eventType: "resource_created",
      conditions: [
        {
          id: "cond-1",
          field: "category.coding.code",
          operator: "equals",
          value: "vital-signs",
        },
      ],
      batchingConfig: {
        enabled: true,
        maxBatchSize: 50,
        maxWaitTimeMs: 30000,
      },
    },
    transformations: [
      {
        id: "trans-1",
        name: "LOINC Code Translation",
        type: "code_translate",
        order: 1,
        sourceField: "code.coding",
        targetField: "code.coding",
        config: {
          codeSystemSource: "http://loinc.org",
          codeSystemTarget: "http://loinc.org",
        },
        isEnabled: true,
      },
      {
        id: "trans-2",
        name: "Unit Standardization",
        type: "lookup",
        order: 2,
        sourceField: "valueQuantity.unit",
        targetField: "valueQuantity.unit",
        config: {
          lookupTable: "unit_mappings",
          lookupKeyField: "source_unit",
          lookupValueField: "ucum_unit",
        },
        isEnabled: true,
      },
    ],
    conflictResolution: {
      defaultStrategy: "source_wins",
      resourceSpecificStrategies: [],
      fieldLevelResolution: [],
      escalationConfig: {
        enabled: false,
        escalateAfterMinutes: 0,
        notifyUsers: [],
      },
      auditAllConflicts: true,
    },
    validationRules: [
      {
        id: "val-1",
        name: "Require LOINC Code",
        field: "code.coding",
        validationType: "required",
        validationConfig: { system: "http://loinc.org" },
        errorSeverity: "error",
        errorMessage: "Observation must have a LOINC code",
      },
    ],
    notificationConfig: {
      onSuccess: false,
      onFailure: true,
      onConflict: false,
      channels: [],
    },
    metadata: {},
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-03-10T00:00:00Z",
    createdBy: "admin",
    lastTriggeredAt: "2024-03-15T16:45:00Z",
    executionCount: 8934,
    successCount: 8912,
    failureCount: 22,
  },
  {
    id: "rule-medication-sync",
    name: "Medication Request Bidirectional Sync",
    description: "Bidirectional sync for medication requests with custom conflict workflow",
    isEnabled: true,
    priority: 3,
    resourceTypes: ["MedicationRequest"],
    sourceEndpointId: "endpoint-internal",
    targetEndpointId: "endpoint-athena",
    triggerConfig: {
      eventType: "resource_updated",
      conditions: [
        {
          id: "cond-1",
          field: "status",
          operator: "in_list",
          value: ["active", "on-hold", "cancelled"],
        },
      ],
    },
    transformations: [
      {
        id: "trans-1",
        name: "RxNorm Code Mapping",
        type: "code_translate",
        order: 1,
        sourceField: "medicationCodeableConcept.coding",
        targetField: "medicationCodeableConcept.coding",
        config: {
          codeSystemSource: "http://www.nlm.nih.gov/research/umls/rxnorm",
          codeSystemTarget: "http://www.nlm.nih.gov/research/umls/rxnorm",
        },
        isEnabled: true,
      },
    ],
    conflictResolution: {
      defaultStrategy: "custom_workflow",
      resourceSpecificStrategies: [
        {
          resourceType: "MedicationRequest",
          strategy: "custom_workflow",
          customWorkflowId: "workflow-med-review",
        },
      ],
      fieldLevelResolution: [
        {
          resourceType: "MedicationRequest",
          field: "dosageInstruction",
          strategy: "manual_review",
        },
      ],
      escalationConfig: {
        enabled: true,
        escalateAfterMinutes: 30,
        notifyUsers: ["pharmacist@example.com", "physician@example.com"],
        autoResolveStrategy: "source_wins",
      },
      auditAllConflicts: true,
    },
    validationRules: [],
    notificationConfig: {
      onSuccess: true,
      onFailure: true,
      onConflict: true,
      channels: [
        {
          type: "email",
          recipients: ["pharmacy@example.com"],
          config: {},
        },
      ],
    },
    metadata: { requiresPharmacistReview: true },
    createdAt: "2024-02-15T00:00:00Z",
    updatedAt: "2024-03-12T00:00:00Z",
    createdBy: "pharmacy-admin",
    lastTriggeredAt: "2024-03-15T18:00:00Z",
    executionCount: 456,
    successCount: 432,
    failureCount: 24,
  },
  {
    id: "rule-scheduled-full-sync",
    name: "Daily Full Data Reconciliation",
    description: "Scheduled daily sync for all resources to ensure data consistency",
    isEnabled: true,
    priority: 10,
    resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"],
    sourceEndpointId: "endpoint-epic",
    targetEndpointId: "endpoint-internal",
    triggerConfig: {
      eventType: "schedule",
      conditions: [],
      scheduleConfig: {
        cronExpression: "0 2 * * *",
        timezone: "America/New_York",
      },
    },
    transformations: [],
    conflictResolution: {
      defaultStrategy: "latest_wins",
      resourceSpecificStrategies: [],
      fieldLevelResolution: [],
      escalationConfig: {
        enabled: false,
        escalateAfterMinutes: 0,
        notifyUsers: [],
      },
      auditAllConflicts: false,
    },
    validationRules: [],
    notificationConfig: {
      onSuccess: true,
      onFailure: true,
      onConflict: false,
      channels: [
        {
          type: "email",
          recipients: ["it-ops@example.com"],
          config: {},
        },
      ],
    },
    metadata: {},
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "system",
    lastTriggeredAt: "2024-03-15T02:00:00Z",
    executionCount: 74,
    successCount: 72,
    failureCount: 2,
  },
];

const sampleConflictWorkflows: ConflictWorkflow[] = [
  {
    id: "workflow-med-review",
    name: "Medication Conflict Review Workflow",
    description: "Custom workflow for reviewing medication conflicts with pharmacist approval",
    resourceTypes: ["MedicationRequest", "MedicationStatement"],
    steps: [
      {
        id: "step-1",
        order: 1,
        name: "Notify Pharmacist",
        type: "notification",
        config: {
          channel: "email",
          template: "medication_conflict_alert",
          recipients: ["pharmacist@example.com"],
        },
      },
      {
        id: "step-2",
        order: 2,
        name: "Manual Review",
        type: "manual_review",
        config: {
          assignee: "pharmacist_group",
          timeoutHours: 4,
        },
      },
      {
        id: "step-3",
        order: 3,
        name: "Escalate to Physician",
        type: "escalation",
        config: {
          escalateTo: "physician_group",
          reason: "Pharmacist review timeout",
        },
        condition: {
          id: "cond-timeout",
          field: "reviewStatus",
          operator: "equals",
          value: "timeout",
        },
      },
      {
        id: "step-4",
        order: 4,
        name: "Auto-Resolve Fallback",
        type: "auto_resolve",
        config: {
          strategy: "source_wins",
          addAuditNote: true,
        },
        condition: {
          id: "cond-escalation-timeout",
          field: "escalationStatus",
          operator: "equals",
          value: "timeout",
        },
      },
    ],
    defaultAssignee: "pharmacist_group",
    slaHours: 8,
    isEnabled: true,
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "workflow-patient-merge",
    name: "Patient Data Merge Workflow",
    description: "Workflow for handling patient demographic conflicts",
    resourceTypes: ["Patient"],
    steps: [
      {
        id: "step-1",
        order: 1,
        name: "Auto-Merge Non-Critical Fields",
        type: "auto_resolve",
        config: {
          strategy: "merge_fields",
          fields: ["telecom", "address", "contact"],
          mergeLogic: "combine_unique",
        },
      },
      {
        id: "step-2",
        order: 2,
        name: "Review Identity Fields",
        type: "manual_review",
        config: {
          assignee: "registration_team",
          fields: ["name", "birthDate", "identifier"],
        },
        condition: {
          id: "cond-identity-conflict",
          field: "conflictFields",
          operator: "contains",
          value: "name,birthDate,identifier",
        },
      },
    ],
    defaultAssignee: "registration_team",
    slaHours: 24,
    isEnabled: true,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-02-15T00:00:00Z",
  },
];

function initializeSampleData() {
  if (syncRules.size === 0) {
    sampleSyncRules.forEach((rule) => syncRules.set(rule.id, rule));
  }
  if (conflictWorkflows.size === 0) {
    sampleConflictWorkflows.forEach((wf) => conflictWorkflows.set(wf.id, wf));
  }
}

initializeSampleData();

export class FHIRSyncRulesService {
  async getAllRules(): Promise<SyncRule[]> {
    return Array.from(syncRules.values()).sort((a, b) => a.priority - b.priority);
  }

  async getRuleById(id: string): Promise<SyncRule | null> {
    return syncRules.get(id) || null;
  }

  async createRule(data: Omit<SyncRule, "id" | "createdAt" | "updatedAt" | "executionCount" | "successCount" | "failureCount">): Promise<SyncRule> {
    const now = new Date().toISOString();
    const rule: SyncRule = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    };
    syncRules.set(rule.id, rule);
    return rule;
  }

  async updateRule(id: string, data: Partial<SyncRule>): Promise<SyncRule | null> {
    const existing = syncRules.get(id);
    if (!existing) return null;

    const updated: SyncRule = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    syncRules.set(id, updated);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    return syncRules.delete(id);
  }

  async toggleRule(id: string): Promise<SyncRule | null> {
    const rule = syncRules.get(id);
    if (!rule) return null;

    rule.isEnabled = !rule.isEnabled;
    rule.updatedAt = new Date().toISOString();
    return rule;
  }

  evaluateTriggerConditions(conditions: TriggerCondition[], resource: Record<string, unknown>): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let logicalOp: "AND" | "OR" = "AND";

    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(resource, condition.field);
      const conditionResult = this.evaluateCondition(condition, fieldValue);

      if (logicalOp === "AND") {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      logicalOp = condition.logicalOperator || "AND";
    }

    return result;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let value: unknown = obj;
    for (const key of keys) {
      if (value && typeof value === "object" && key in (value as object)) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private evaluateCondition(condition: TriggerCondition, value: unknown): boolean {
    switch (condition.operator) {
      case "equals":
        return value === condition.value;
      case "not_equals":
        return value !== condition.value;
      case "contains":
        return typeof value === "string" && value.includes(String(condition.value));
      case "starts_with":
        return typeof value === "string" && value.startsWith(String(condition.value));
      case "ends_with":
        return typeof value === "string" && value.endsWith(String(condition.value));
      case "greater_than":
        return typeof value === "number" && value > Number(condition.value);
      case "less_than":
        return typeof value === "number" && value < Number(condition.value);
      case "is_empty":
        return value === null || value === undefined || value === "";
      case "is_not_empty":
        return value !== null && value !== undefined && value !== "";
      case "matches_regex":
        return typeof value === "string" && new RegExp(String(condition.value)).test(value);
      case "in_list":
        return Array.isArray(condition.value) && condition.value.includes(value as string);
      default:
        return false;
    }
  }

  async applyTransformations(transformations: DataTransformation[], data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = { ...data };
    const sortedTransforms = [...transformations].filter((t) => t.isEnabled).sort((a, b) => a.order - b.order);

    for (const transform of sortedTransforms) {
      try {
        const sourceValue = this.getNestedValue(result, transform.sourceField);
        const transformedValue = await this.executeTransformation(transform, sourceValue, result);
        this.setNestedValue(result, transform.targetField, transformedValue);
      } catch (error) {
        console.error(`Transformation ${transform.id} failed:`, error);
      }
    }

    return result;
  }

  private async executeTransformation(transform: DataTransformation, value: unknown, fullData: Record<string, unknown>): Promise<unknown> {
    const config = transform.config;

    switch (transform.type) {
      case "set_constant":
        return config.constantValue;

      case "format_date":
        if (typeof value === "string" && config.formatPattern) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        }
        return value;

      case "map_field":
        if (config.mapTable && typeof value === "string") {
          return config.mapTable[value] || value;
        }
        return value;

      case "concatenate":
        if (config.concatFields && config.concatSeparator !== undefined) {
          const values = config.concatFields.map((f) => String(this.getNestedValue(fullData, f) || ""));
          return values.join(config.concatSeparator);
        }
        return value;

      case "split":
        if (typeof value === "string" && config.splitDelimiter) {
          return value.split(config.splitDelimiter);
        }
        return value;

      case "conditional":
        if (config.condition) {
          const conditionValue = this.getNestedValue(fullData, config.condition.field);
          const conditionMet = this.evaluateCondition(
            {
              id: "temp",
              field: config.condition.field,
              operator: config.condition.operator,
              value: config.condition.value,
            },
            conditionValue
          );
          return conditionMet ? config.condition.trueResult : config.condition.falseResult;
        }
        return value;

      case "code_translate":
        return value;

      case "lookup":
        return value;

      case "calculate":
        return value;

      default:
        return value;
    }
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(".");
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  async executeRule(ruleId: string, triggerEvent: TriggerEventType, triggerData?: Record<string, unknown>): Promise<SyncRuleExecution> {
    const rule = syncRules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const execution: SyncRuleExecution = {
      id: generateId(),
      ruleId,
      status: "running",
      triggerEvent,
      triggerData,
      resourcesProcessed: 0,
      resourcesSucceeded: 0,
      resourcesFailed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      transformationsApplied: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      auditLogId: generateId(),
    };

    syncRuleExecutions.set(execution.id, execution);

    try {
      const mockResourceCount = Math.floor(Math.random() * 50) + 10;
      execution.resourcesProcessed = mockResourceCount;
      execution.resourcesSucceeded = Math.floor(mockResourceCount * 0.95);
      execution.resourcesFailed = mockResourceCount - execution.resourcesSucceeded;
      execution.transformationsApplied = rule.transformations.filter((t) => t.isEnabled).length * mockResourceCount;
      execution.conflictsDetected = Math.floor(Math.random() * 5);
      execution.conflictsResolved = execution.conflictsDetected;

      execution.status = execution.resourcesFailed === 0 ? "completed" : "completed";
      execution.completedAt = new Date().toISOString();
      execution.duration = Math.floor(Math.random() * 30000) + 5000;

      rule.lastTriggeredAt = execution.startedAt;
      rule.executionCount++;
      rule.successCount += execution.resourcesSucceeded;
      rule.failureCount += execution.resourcesFailed;
    } catch (error) {
      execution.status = "failed";
      execution.completedAt = new Date().toISOString();
      execution.errors.push({
        resourceType: "unknown",
        resourceId: "unknown",
        phase: "sync",
        errorCode: "EXECUTION_FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        isRetryable: true,
      });
    }

    return execution;
  }

  async getExecutions(ruleId?: string): Promise<SyncRuleExecution[]> {
    const executions = Array.from(syncRuleExecutions.values());
    if (ruleId) {
      return executions.filter((e) => e.ruleId === ruleId);
    }
    return executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getAllConflictWorkflows(): Promise<ConflictWorkflow[]> {
    return Array.from(conflictWorkflows.values());
  }

  async getConflictWorkflow(id: string): Promise<ConflictWorkflow | null> {
    return conflictWorkflows.get(id) || null;
  }

  async createConflictWorkflow(data: Omit<ConflictWorkflow, "id" | "createdAt" | "updatedAt">): Promise<ConflictWorkflow> {
    const now = new Date().toISOString();
    const workflow: ConflictWorkflow = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    conflictWorkflows.set(workflow.id, workflow);
    return workflow;
  }

  async updateConflictWorkflow(id: string, data: Partial<ConflictWorkflow>): Promise<ConflictWorkflow | null> {
    const existing = conflictWorkflows.get(id);
    if (!existing) return null;

    const updated: ConflictWorkflow = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    conflictWorkflows.set(id, updated);
    return updated;
  }

  async deleteConflictWorkflow(id: string): Promise<boolean> {
    return conflictWorkflows.delete(id);
  }

  async getConflictRecords(executionId?: string, status?: string): Promise<ConflictRecord[]> {
    let records = Array.from(conflictRecords.values());
    if (executionId) {
      records = records.filter((r) => r.executionId === executionId);
    }
    if (status) {
      records = records.filter((r) => r.status === status);
    }
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async resolveConflict(conflictId: string, resolution: { chosenVersion: "source" | "target" | "merged"; mergedData?: Record<string, unknown>; notes?: string }, resolvedBy: string): Promise<ConflictRecord | null> {
    const conflict = conflictRecords.get(conflictId);
    if (!conflict) return null;

    conflict.status = "resolved";
    conflict.resolution = {
      resolvedBy,
      resolvedAt: new Date().toISOString(),
      chosenVersion: resolution.chosenVersion,
      mergedData: resolution.mergedData,
      notes: resolution.notes,
    };

    return conflict;
  }

  async getSyncRuleStatistics(): Promise<{
    totalRules: number;
    enabledRules: number;
    totalExecutions: number;
    successRate: number;
    conflictsPending: number;
    rulesByResourceType: Record<string, number>;
  }> {
    const rules = Array.from(syncRules.values());
    const executions = Array.from(syncRuleExecutions.values());
    const conflicts = Array.from(conflictRecords.values());

    const totalExecuted = executions.reduce((sum, e) => sum + e.resourcesProcessed, 0);
    const totalSucceeded = executions.reduce((sum, e) => sum + e.resourcesSucceeded, 0);

    const rulesByResourceType: Record<string, number> = {};
    rules.forEach((rule) => {
      rule.resourceTypes.forEach((rt) => {
        rulesByResourceType[rt] = (rulesByResourceType[rt] || 0) + 1;
      });
    });

    return {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.isEnabled).length,
      totalExecutions: executions.length,
      successRate: totalExecuted > 0 ? (totalSucceeded / totalExecuted) * 100 : 100,
      conflictsPending: conflicts.filter((c) => c.status === "pending").length,
      rulesByResourceType,
    };
  }

  getAvailableEndpoints(): { id: string; name: string }[] {
    return sampleEndpoints;
  }
}

export const fhirSyncRulesService = new FHIRSyncRulesService();
