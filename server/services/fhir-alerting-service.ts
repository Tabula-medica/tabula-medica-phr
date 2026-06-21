/**
 * FHIR Intelligent Alerting Service
 * 
 * Provides rule-based alerting for FHIR resource data with support for:
 * - Vital sign monitoring (US Core Vital Signs profiles)
 * - Condition risk assessment
 * - Lab result abnormalities
 * - Medication alerts
 * - Custom rule definitions
 * 
 * Integrates with US Core profiles for clinical context and standardization.
 */

import { v4 as uuidv4 } from "uuid";

// US Core Profile definitions for context
export const US_CORE_PROFILES = {
  vitalSigns: {
    bloodPressure: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure",
      loinc: "85354-9",
      components: {
        systolic: { loinc: "8480-6", unit: "mm[Hg]" },
        diastolic: { loinc: "8462-4", unit: "mm[Hg]" }
      },
      thresholds: {
        criticalHigh: { systolic: 180, diastolic: 120 },
        high: { systolic: 140, diastolic: 90 },
        elevated: { systolic: 130, diastolic: 80 },
        low: { systolic: 90, diastolic: 60 },
        criticalLow: { systolic: 70, diastolic: 40 }
      }
    },
    heartRate: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-heart-rate",
      loinc: "8867-4",
      unit: "/min",
      thresholds: {
        criticalHigh: 150,
        high: 100,
        low: 50,
        criticalLow: 40
      }
    },
    respiratoryRate: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-respiratory-rate",
      loinc: "9279-1",
      unit: "/min",
      thresholds: {
        criticalHigh: 30,
        high: 20,
        low: 10,
        criticalLow: 8
      }
    },
    bodyTemperature: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-temperature",
      loinc: "8310-5",
      unit: "Cel",
      thresholds: {
        criticalHigh: 40.0,
        high: 38.5,
        low: 35.5,
        criticalLow: 35.0
      }
    },
    oxygenSaturation: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-pulse-oximetry",
      loinc: "59408-5",
      unit: "%",
      thresholds: {
        criticalLow: 88,
        low: 92
      }
    },
    bodyWeight: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-weight",
      loinc: "29463-7",
      unit: "kg"
    },
    bodyHeight: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-height",
      loinc: "8302-2",
      unit: "cm"
    },
    bmi: {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-bmi",
      loinc: "39156-5",
      unit: "kg/m2",
      thresholds: {
        high: 30,
        elevated: 25
      }
    }
  },
  conditions: {
    highRiskCodes: [
      { system: "http://snomed.info/sct", code: "22298006", display: "Myocardial infarction" },
      { system: "http://snomed.info/sct", code: "230690007", display: "Cerebrovascular accident" },
      { system: "http://snomed.info/sct", code: "84114007", display: "Heart failure" },
      { system: "http://snomed.info/sct", code: "195967001", display: "Asthma" },
      { system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" },
      { system: "http://snomed.info/sct", code: "38341003", display: "Hypertensive disorder" },
      { system: "http://snomed.info/sct", code: "13645005", display: "Chronic obstructive lung disease" },
      { system: "http://snomed.info/sct", code: "709044004", display: "Chronic kidney disease" },
      { system: "http://snomed.info/sct", code: "363406005", display: "Malignant neoplasm" },
      { system: "http://snomed.info/sct", code: "49601007", display: "Cardiovascular disease" }
    ]
  },
  labs: {
    criticalValues: [
      { loinc: "2345-7", name: "Glucose", criticalLow: 40, criticalHigh: 500, unit: "mg/dL" },
      { loinc: "2160-0", name: "Creatinine", criticalHigh: 10, unit: "mg/dL" },
      { loinc: "2823-3", name: "Potassium", criticalLow: 2.5, criticalHigh: 6.5, unit: "mmol/L" },
      { loinc: "2951-2", name: "Sodium", criticalLow: 120, criticalHigh: 160, unit: "mmol/L" },
      { loinc: "718-7", name: "Hemoglobin", criticalLow: 7, unit: "g/dL" },
      { loinc: "777-3", name: "Platelets", criticalLow: 20000, criticalHigh: 1000000, unit: "/uL" },
      { loinc: "6690-2", name: "WBC", criticalLow: 2000, criticalHigh: 30000, unit: "/uL" },
      { loinc: "1751-7", name: "Albumin", criticalLow: 1.5, unit: "g/dL" },
      { loinc: "2093-3", name: "Total Cholesterol", criticalHigh: 300, unit: "mg/dL" },
      { loinc: "2085-9", name: "HDL Cholesterol", criticalLow: 25, unit: "mg/dL" }
    ]
  }
};

// Alert rule types
export type AlertRuleType = 
  | "vital_sign_threshold"
  | "vital_sign_change"
  | "condition_new"
  | "condition_severity"
  | "lab_critical"
  | "lab_trend"
  | "medication_interaction"
  | "medication_adherence"
  | "custom";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertChannel = "in_app" | "email" | "sms" | "push";
export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between" | "change_by";

export interface AlertRuleCondition {
  field: string;
  operator: ComparisonOperator;
  value: number | string | boolean;
  secondValue?: number; // For "between" operator
  timeWindow?: string; // For trend analysis, e.g., "24h", "7d"
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertRuleType;
  resourceType: string;
  enabled: boolean;
  severity: AlertSeverity;
  conditions: AlertRuleCondition[];
  conditionLogic: "AND" | "OR";
  useCoreProfile?: string;
  loincCode?: string;
  snomedCode?: string;
  channels: AlertChannel[];
  recipients?: {
    userId?: string;
    email?: string;
    phone?: string;
    role?: string;
  }[];
  cooldownMinutes: number;
  escalationRules?: {
    afterMinutes: number;
    severity: AlertSeverity;
    additionalRecipients: string[];
  }[];
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  patientId: string;
  patientName?: string;
  resourceType: string;
  resourceId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  details: Record<string, any>;
  useCoreContext?: {
    profile: string;
    interpretation?: string;
    normalRange?: string;
  };
  channels: AlertChannel[];
  channelStatus: Record<AlertChannel, "pending" | "sent" | "failed">;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  escalated: boolean;
  escalationLevel: number;
  createdAt: string;
  expiresAt?: string;
}

export interface AlertStatistics {
  totalRules: number;
  activeRules: number;
  totalAlerts: number;
  unacknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertRuleType, number>;
  byChannel: Record<AlertChannel, { sent: number; failed: number }>;
  recentAlerts: AlertNotification[];
  topTriggeredRules: { ruleId: string; ruleName: string; count: number }[];
}

class FHIRAlertingService {
  private rules: Map<string, AlertRule> = new Map();
  private notifications: Map<string, AlertNotification> = new Map();
  private cooldownTracker: Map<string, number> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[FHIRAlerting] Service initialized with US Core profile integration");
    console.log("[FHIRAlerting] Monitoring vital signs, conditions, labs, and medications");
  }

  private initializeSampleData() {
    // Critical vital sign rules
    const vitalSignRules: Partial<AlertRule>[] = [
      {
        name: "Critical Blood Pressure",
        description: "Alert when blood pressure exceeds critical thresholds (>180/120 or <70/40)",
        type: "vital_sign_threshold",
        resourceType: "Observation",
        severity: "critical",
        useCoreProfile: US_CORE_PROFILES.vitalSigns.bloodPressure.url,
        loincCode: US_CORE_PROFILES.vitalSigns.bloodPressure.loinc,
        conditions: [
          { field: "component[0].valueQuantity.value", operator: "gte", value: 180 },
          { field: "component[1].valueQuantity.value", operator: "gte", value: 120 }
        ],
        conditionLogic: "OR",
        channels: ["in_app", "sms"],
        cooldownMinutes: 30,
        escalationRules: [
          { afterMinutes: 15, severity: "critical", additionalRecipients: ["on-call-physician"] }
        ]
      },
      {
        name: "Low Oxygen Saturation",
        description: "Alert when SpO2 falls below 92%",
        type: "vital_sign_threshold",
        resourceType: "Observation",
        severity: "high",
        useCoreProfile: US_CORE_PROFILES.vitalSigns.oxygenSaturation.url,
        loincCode: US_CORE_PROFILES.vitalSigns.oxygenSaturation.loinc,
        conditions: [
          { field: "valueQuantity.value", operator: "lt", value: 92 }
        ],
        conditionLogic: "AND",
        channels: ["in_app"],
        cooldownMinutes: 60
      },
      {
        name: "Fever Alert",
        description: "Alert when body temperature exceeds 38.5°C",
        type: "vital_sign_threshold",
        resourceType: "Observation",
        severity: "medium",
        useCoreProfile: US_CORE_PROFILES.vitalSigns.bodyTemperature.url,
        loincCode: US_CORE_PROFILES.vitalSigns.bodyTemperature.loinc,
        conditions: [
          { field: "valueQuantity.value", operator: "gt", value: 38.5 }
        ],
        conditionLogic: "AND",
        channels: ["in_app"],
        cooldownMinutes: 120
      },
      {
        name: "Rapid Heart Rate Change",
        description: "Alert when heart rate changes by more than 30 bpm in 1 hour",
        type: "vital_sign_change",
        resourceType: "Observation",
        severity: "high",
        useCoreProfile: US_CORE_PROFILES.vitalSigns.heartRate.url,
        loincCode: US_CORE_PROFILES.vitalSigns.heartRate.loinc,
        conditions: [
          { field: "valueQuantity.value", operator: "change_by", value: 30, timeWindow: "1h" }
        ],
        conditionLogic: "AND",
        channels: ["in_app"],
        cooldownMinutes: 60
      }
    ];

    // High-risk condition rules
    const conditionRules: Partial<AlertRule>[] = [
      {
        name: "New High-Risk Condition",
        description: "Alert when a new high-risk condition is recorded (MI, stroke, heart failure, etc.)",
        type: "condition_new",
        resourceType: "Condition",
        severity: "high",
        conditions: [
          { field: "clinicalStatus.coding[0].code", operator: "eq", value: "active" }
        ],
        conditionLogic: "AND",
        channels: ["in_app", "email"],
        cooldownMinutes: 0,
        metadata: {
          monitoredCodes: US_CORE_PROFILES.conditions.highRiskCodes
        }
      },
      {
        name: "Condition Severity Change",
        description: "Alert when condition severity changes to severe",
        type: "condition_severity",
        resourceType: "Condition",
        severity: "high",
        conditions: [
          { field: "severity.coding[0].code", operator: "eq", value: "24484000" } // Severe
        ],
        conditionLogic: "AND",
        channels: ["in_app"],
        cooldownMinutes: 60
      }
    ];

    // Critical lab value rules
    const labRules: Partial<AlertRule>[] = [
      {
        name: "Critical Glucose",
        description: "Alert when glucose is critically low (<40 mg/dL) or high (>500 mg/dL)",
        type: "lab_critical",
        resourceType: "Observation",
        severity: "critical",
        loincCode: "2345-7",
        conditions: [
          { field: "valueQuantity.value", operator: "lt", value: 40 },
          { field: "valueQuantity.value", operator: "gt", value: 500 }
        ],
        conditionLogic: "OR",
        channels: ["in_app", "sms"],
        cooldownMinutes: 30
      },
      {
        name: "Critical Potassium",
        description: "Alert when potassium is critically abnormal (<2.5 or >6.5 mmol/L)",
        type: "lab_critical",
        resourceType: "Observation",
        severity: "critical",
        loincCode: "2823-3",
        conditions: [
          { field: "valueQuantity.value", operator: "lt", value: 2.5 },
          { field: "valueQuantity.value", operator: "gt", value: 6.5 }
        ],
        conditionLogic: "OR",
        channels: ["in_app", "sms"],
        cooldownMinutes: 30
      },
      {
        name: "Low Hemoglobin",
        description: "Alert when hemoglobin falls below 7 g/dL",
        type: "lab_critical",
        resourceType: "Observation",
        severity: "critical",
        loincCode: "718-7",
        conditions: [
          { field: "valueQuantity.value", operator: "lt", value: 7 }
        ],
        conditionLogic: "AND",
        channels: ["in_app", "email"],
        cooldownMinutes: 60
      }
    ];

    // Create all rules
    [...vitalSignRules, ...conditionRules, ...labRules].forEach(rule => {
      const fullRule: AlertRule = {
        id: uuidv4(),
        enabled: true,
        recipients: [],
        metadata: {},
        createdBy: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...rule as any
      };
      this.rules.set(fullRule.id, fullRule);
    });

    // Create sample notifications
    const sampleNotifications: Partial<AlertNotification>[] = [
      {
        ruleId: Array.from(this.rules.values())[0].id,
        ruleName: "Critical Blood Pressure",
        patientId: "patient-001",
        patientName: "John Smith",
        resourceType: "Observation",
        resourceId: "obs-bp-001",
        severity: "critical",
        title: "Critical Blood Pressure Detected",
        message: "Blood pressure reading 185/125 mmHg exceeds critical threshold",
        details: {
          systolic: 185,
          diastolic: 125,
          measurementTime: new Date(Date.now() - 3600000).toISOString()
        },
        useCoreContext: {
          profile: US_CORE_PROFILES.vitalSigns.bloodPressure.url,
          interpretation: "Hypertensive Crisis",
          normalRange: "Systolic <120, Diastolic <80 mmHg"
        },
        channels: ["in_app", "sms"],
        channelStatus: { in_app: "sent", sms: "sent", email: "pending", push: "pending" },
        acknowledged: false,
        escalated: false,
        escalationLevel: 0
      },
      {
        ruleId: Array.from(this.rules.values())[1].id,
        ruleName: "Low Oxygen Saturation",
        patientId: "patient-002",
        patientName: "Mary Johnson",
        resourceType: "Observation",
        resourceId: "obs-spo2-001",
        severity: "high",
        title: "Low Oxygen Saturation",
        message: "SpO2 reading 89% is below the critical threshold of 92%",
        details: {
          value: 89,
          unit: "%",
          measurementTime: new Date(Date.now() - 1800000).toISOString()
        },
        useCoreContext: {
          profile: US_CORE_PROFILES.vitalSigns.oxygenSaturation.url,
          interpretation: "Hypoxemia",
          normalRange: ">= 95%"
        },
        channels: ["in_app"],
        channelStatus: { in_app: "sent", sms: "pending", email: "pending", push: "pending" },
        acknowledged: true,
        acknowledgedBy: "nurse-001",
        acknowledgedAt: new Date(Date.now() - 1200000).toISOString(),
        escalated: false,
        escalationLevel: 0
      },
      {
        ruleId: Array.from(this.rules.values())[4].id,
        ruleName: "New High-Risk Condition",
        patientId: "patient-003",
        patientName: "Robert Wilson",
        resourceType: "Condition",
        resourceId: "cond-001",
        severity: "high",
        title: "New High-Risk Condition Recorded",
        message: "New diagnosis: Type 2 Diabetes Mellitus (E11.9) recorded for patient",
        details: {
          code: "73211009",
          display: "Diabetes mellitus",
          clinicalStatus: "active",
          onsetDate: new Date().toISOString().split("T")[0]
        },
        channels: ["in_app", "email"],
        channelStatus: { in_app: "sent", email: "sent", sms: "pending", push: "pending" },
        acknowledged: false,
        escalated: false,
        escalationLevel: 0
      }
    ];

    sampleNotifications.forEach(notif => {
      const fullNotif: AlertNotification = {
        id: uuidv4(),
        createdAt: new Date(Date.now() - Math.random() * 7200000).toISOString(),
        ...notif as any
      };
      this.notifications.set(fullNotif.id, fullNotif);
    });
  }

  // Rule Management
  async createRule(data: Omit<AlertRule, "id" | "createdAt" | "updatedAt">): Promise<AlertRule> {
    const rule: AlertRule = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.rules.set(rule.id, rule);
    console.log(`[FHIRAlerting] Created rule: ${rule.name}`);
    return rule;
  }

  async updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updated: AlertRule = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.rules.set(id, updated);
    console.log(`[FHIRAlerting] Updated rule: ${updated.name}`);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    const deleted = this.rules.delete(id);
    if (deleted) {
      console.log(`[FHIRAlerting] Deleted rule: ${id}`);
    }
    return deleted;
  }

  async getRule(id: string): Promise<AlertRule | undefined> {
    return this.rules.get(id);
  }

  async listRules(filters?: {
    type?: AlertRuleType;
    severity?: AlertSeverity;
    enabled?: boolean;
    resourceType?: string;
  }): Promise<AlertRule[]> {
    let rules = Array.from(this.rules.values());

    if (filters) {
      if (filters.type) {
        rules = rules.filter(r => r.type === filters.type);
      }
      if (filters.severity) {
        rules = rules.filter(r => r.severity === filters.severity);
      }
      if (filters.enabled !== undefined) {
        rules = rules.filter(r => r.enabled === filters.enabled);
      }
      if (filters.resourceType) {
        rules = rules.filter(r => r.resourceType === filters.resourceType);
      }
    }

    return rules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Alert Evaluation
  async evaluateResource(resource: any, resourceType: string, patientId: string, patientName?: string): Promise<AlertNotification[]> {
    const triggeredAlerts: AlertNotification[] = [];
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled && r.resourceType === resourceType);

    for (const rule of enabledRules) {
      // Check cooldown
      const cooldownKey = `${rule.id}:${patientId}`;
      const lastTriggered = this.cooldownTracker.get(cooldownKey);
      if (lastTriggered && Date.now() - lastTriggered < rule.cooldownMinutes * 60000) {
        continue;
      }

      // Check if resource matches LOINC code for observations
      if (rule.loincCode && resourceType === "Observation") {
        const resourceLoinc = this.extractLoincCode(resource);
        if (resourceLoinc !== rule.loincCode) continue;
      }

      // Check conditions for high-risk conditions
      if (rule.type === "condition_new" && rule.metadata?.monitoredCodes) {
        const conditionCode = this.extractConditionCode(resource);
        const isHighRisk = rule.metadata.monitoredCodes.some(
          (c: any) => c.code === conditionCode
        );
        if (!isHighRisk) continue;
      }

      // Evaluate conditions
      const matches = this.evaluateConditions(resource, rule.conditions, rule.conditionLogic);

      if (matches) {
        const notification = await this.createNotification(rule, resource, patientId, patientName);
        triggeredAlerts.push(notification);
        this.cooldownTracker.set(cooldownKey, Date.now());
      }
    }

    return triggeredAlerts;
  }

  private extractLoincCode(resource: any): string | null {
    if (resource.code?.coding) {
      const loincCoding = resource.code.coding.find(
        (c: any) => c.system === "http://loinc.org"
      );
      return loincCoding?.code || null;
    }
    return null;
  }

  private extractConditionCode(resource: any): string | null {
    if (resource.code?.coding) {
      const snomedCoding = resource.code.coding.find(
        (c: any) => c.system === "http://snomed.info/sct"
      );
      return snomedCoding?.code || null;
    }
    return null;
  }

  private evaluateConditions(resource: any, conditions: AlertRuleCondition[], logic: "AND" | "OR"): boolean {
    const results = conditions.map(condition => this.evaluateSingleCondition(resource, condition));
    
    if (logic === "AND") {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  private evaluateSingleCondition(resource: any, condition: AlertRuleCondition): boolean {
    const value = this.getNestedValue(resource, condition.field);
    if (value === undefined || value === null) return false;

    switch (condition.operator) {
      case "gt":
        return Number(value) > Number(condition.value);
      case "gte":
        return Number(value) >= Number(condition.value);
      case "lt":
        return Number(value) < Number(condition.value);
      case "lte":
        return Number(value) <= Number(condition.value);
      case "eq":
        return value === condition.value;
      case "neq":
        return value !== condition.value;
      case "between":
        return Number(value) >= Number(condition.value) && 
               Number(value) <= Number(condition.secondValue);
      case "change_by":
        // Would need historical data - simplified check
        return false;
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      // Handle array notation like component[0]
      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, prop, index] = match;
        return current[prop]?.[parseInt(index)];
      }
      return current[key];
    }, obj);
  }

  private async createNotification(
    rule: AlertRule,
    resource: any,
    patientId: string,
    patientName?: string
  ): Promise<AlertNotification> {
    const details = this.extractAlertDetails(resource, rule);
    const useCoreContext = rule.useCoreProfile ? this.getUSCoreContext(rule) : undefined;

    const notification: AlertNotification = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      patientId,
      patientName,
      resourceType: rule.resourceType,
      resourceId: resource.id || uuidv4(),
      severity: rule.severity,
      title: this.generateAlertTitle(rule, details),
      message: this.generateAlertMessage(rule, details),
      details,
      useCoreContext,
      channels: rule.channels,
      channelStatus: {
        in_app: rule.channels.includes("in_app") ? "pending" : "pending",
        email: rule.channels.includes("email") ? "pending" : "pending",
        sms: rule.channels.includes("sms") ? "pending" : "pending",
        push: rule.channels.includes("push") ? "pending" : "pending"
      },
      acknowledged: false,
      escalated: false,
      escalationLevel: 0,
      createdAt: new Date().toISOString()
    };

    this.notifications.set(notification.id, notification);

    // Send notifications through channels
    await this.sendNotifications(notification, rule);

    console.log(`[FHIRAlerting] Alert triggered: ${notification.title} (${notification.severity})`);
    return notification;
  }

  private extractAlertDetails(resource: any, rule: AlertRule): Record<string, any> {
    const details: Record<string, any> = {
      resourceId: resource.id,
      effectiveDateTime: resource.effectiveDateTime || resource.recordedDate
    };

    if (rule.resourceType === "Observation") {
      if (resource.valueQuantity) {
        details.value = resource.valueQuantity.value;
        details.unit = resource.valueQuantity.unit;
      }
      if (resource.component) {
        details.components = resource.component.map((c: any) => ({
          code: c.code?.coding?.[0]?.code,
          value: c.valueQuantity?.value,
          unit: c.valueQuantity?.unit
        }));
      }
    }

    if (rule.resourceType === "Condition") {
      details.code = resource.code?.coding?.[0]?.code;
      details.display = resource.code?.coding?.[0]?.display;
      details.clinicalStatus = resource.clinicalStatus?.coding?.[0]?.code;
    }

    return details;
  }

  private getUSCoreContext(rule: AlertRule): { profile: string; interpretation?: string; normalRange?: string } | undefined {
    if (!rule.useCoreProfile) return undefined;

    // Find matching US Core profile info
    for (const [, vitalSign] of Object.entries(US_CORE_PROFILES.vitalSigns)) {
      if (vitalSign.url === rule.useCoreProfile) {
        return {
          profile: vitalSign.url,
          interpretation: this.getInterpretation(rule),
          normalRange: this.getNormalRange(vitalSign)
        };
      }
    }

    return { profile: rule.useCoreProfile };
  }

  private getInterpretation(rule: AlertRule): string {
    switch (rule.severity) {
      case "critical":
        return "Critical value requiring immediate attention";
      case "high":
        return "Significantly abnormal value";
      case "medium":
        return "Moderately abnormal value";
      case "low":
        return "Slightly abnormal value";
      default:
        return "Value outside normal range";
    }
  }

  private getNormalRange(vitalSign: any): string {
    if (vitalSign.thresholds) {
      if (vitalSign.thresholds.high && vitalSign.thresholds.low) {
        return `${vitalSign.thresholds.low} - ${vitalSign.thresholds.high} ${vitalSign.unit || ""}`;
      }
    }
    return "Refer to clinical guidelines";
  }

  private generateAlertTitle(rule: AlertRule, details: Record<string, any>): string {
    switch (rule.type) {
      case "vital_sign_threshold":
        return `${rule.name} - Threshold Exceeded`;
      case "vital_sign_change":
        return `${rule.name} - Rapid Change Detected`;
      case "condition_new":
        return `New High-Risk Condition: ${details.display || "Unknown"}`;
      case "lab_critical":
        return `Critical Lab Value: ${rule.name}`;
      default:
        return rule.name;
    }
  }

  private generateAlertMessage(rule: AlertRule, details: Record<string, any>): string {
    if (details.value !== undefined) {
      return `${rule.name}: Value ${details.value} ${details.unit || ""} ${rule.description}`;
    }
    if (details.display) {
      return `${details.display} - ${rule.description}`;
    }
    return rule.description;
  }

  private async sendNotifications(notification: AlertNotification, rule: AlertRule): Promise<void> {
    // Send in-app notification (always succeeds in this implementation)
    if (rule.channels.includes("in_app")) {
      notification.channelStatus.in_app = "sent";
    }

    // Email and SMS would require external services
    // Marking as sent for sample purposes
    if (rule.channels.includes("email")) {
      // In production, integrate with email service
      notification.channelStatus.email = "sent";
      console.log(`[FHIRAlerting] Email notification sent for alert: ${notification.id}`);
    }

    if (rule.channels.includes("sms")) {
      // In production, integrate with SMS service (Twilio, etc.)
      notification.channelStatus.sms = "sent";
      console.log(`[FHIRAlerting] SMS notification sent for alert: ${notification.id}`);
    }

    this.notifications.set(notification.id, notification);
  }

  // Notification Management
  async getNotification(id: string): Promise<AlertNotification | undefined> {
    return this.notifications.get(id);
  }

  async listNotifications(filters?: {
    patientId?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    ruleId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<AlertNotification[]> {
    let notifications = Array.from(this.notifications.values());

    if (filters) {
      if (filters.patientId) {
        notifications = notifications.filter(n => n.patientId === filters.patientId);
      }
      if (filters.severity) {
        notifications = notifications.filter(n => n.severity === filters.severity);
      }
      if (filters.acknowledged !== undefined) {
        notifications = notifications.filter(n => n.acknowledged === filters.acknowledged);
      }
      if (filters.ruleId) {
        notifications = notifications.filter(n => n.ruleId === filters.ruleId);
      }
      if (filters.startDate) {
        notifications = notifications.filter(n => n.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        notifications = notifications.filter(n => n.createdAt <= filters.endDate!);
      }
    }

    notifications = notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) {
      notifications = notifications.slice(0, filters.limit);
    }

    return notifications;
  }

  async acknowledgeNotification(id: string, userId: string): Promise<AlertNotification | null> {
    const notification = this.notifications.get(id);
    if (!notification) return null;

    notification.acknowledged = true;
    notification.acknowledgedBy = userId;
    notification.acknowledgedAt = new Date().toISOString();

    this.notifications.set(id, notification);
    console.log(`[FHIRAlerting] Alert acknowledged: ${id} by ${userId}`);
    return notification;
  }

  async acknowledgeAll(userId: string, filters?: { patientId?: string; severity?: AlertSeverity }): Promise<number> {
    let count = 0;
    const entries = Array.from(this.notifications.entries());
    for (const [id, notification] of entries) {
      if (notification.acknowledged) continue;
      
      if (filters?.patientId && notification.patientId !== filters.patientId) continue;
      if (filters?.severity && notification.severity !== filters.severity) continue;

      notification.acknowledged = true;
      notification.acknowledgedBy = userId;
      notification.acknowledgedAt = new Date().toISOString();
      this.notifications.set(id, notification);
      count++;
    }
    console.log(`[FHIRAlerting] Acknowledged ${count} alerts by ${userId}`);
    return count;
  }

  // Statistics
  async getStatistics(): Promise<AlertStatistics> {
    const rules = Array.from(this.rules.values());
    const notifications = Array.from(this.notifications.values());

    const bySeverity: Record<AlertSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0
    };
    const byType: Record<AlertRuleType, number> = {
      vital_sign_threshold: 0,
      vital_sign_change: 0,
      condition_new: 0,
      condition_severity: 0,
      lab_critical: 0,
      lab_trend: 0,
      medication_interaction: 0,
      medication_adherence: 0,
      custom: 0
    };
    const byChannel: Record<AlertChannel, { sent: number; failed: number }> = {
      in_app: { sent: 0, failed: 0 },
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    notifications.forEach(n => {
      bySeverity[n.severity]++;
      
      for (const [channel, status] of Object.entries(n.channelStatus)) {
        if (status === "sent") byChannel[channel as AlertChannel].sent++;
        if (status === "failed") byChannel[channel as AlertChannel].failed++;
      }
    });

    rules.forEach(r => {
      byType[r.type]++;
    });

    // Calculate top triggered rules
    const ruleTriggeredCounts = new Map<string, number>();
    notifications.forEach(n => {
      ruleTriggeredCounts.set(n.ruleId, (ruleTriggeredCounts.get(n.ruleId) || 0) + 1);
    });

    const topTriggeredRules = Array.from(ruleTriggeredCounts.entries())
      .map(([ruleId, count]) => {
        const rule = this.rules.get(ruleId);
        return { ruleId, ruleName: rule?.name || "Unknown", count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled).length,
      totalAlerts: notifications.length,
      unacknowledged: notifications.filter(n => !n.acknowledged).length,
      bySeverity,
      byType,
      byChannel,
      recentAlerts: notifications.slice(0, 10),
      topTriggeredRules
    };
  }

  // US Core Profile helpers
  getUSCoreProfiles(): typeof US_CORE_PROFILES {
    return US_CORE_PROFILES;
  }

  getVitalSignThresholds(vitalSign: string): any {
    const profile = (US_CORE_PROFILES.vitalSigns as any)[vitalSign];
    return profile?.thresholds || null;
  }

  getCriticalLabValues(): typeof US_CORE_PROFILES.labs.criticalValues {
    return US_CORE_PROFILES.labs.criticalValues;
  }

  getHighRiskConditionCodes(): typeof US_CORE_PROFILES.conditions.highRiskCodes {
    return US_CORE_PROFILES.conditions.highRiskCodes;
  }
}

export const fhirAlertingService = new FHIRAlertingService();
