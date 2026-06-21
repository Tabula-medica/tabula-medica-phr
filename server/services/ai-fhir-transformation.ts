import OpenAI from "openai";
import { createHash } from "crypto";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const NO_CDS_SYSTEM_PROMPT = `You are an AI assistant specializing in FHIR data transformation and mapping.
CRITICAL COMPLIANCE REQUIREMENT: You must NEVER provide clinical decision support, diagnosis, treatment recommendations, or medical advice.
Your role is strictly limited to:
- Data structure transformation and mapping between FHIR resources
- Technical data type conversions
- Schema alignment and field mapping suggestions
- Format standardization recommendations
Always include this disclaimer: "This is data transformation guidance only. Not for clinical decision-making."`;

export type TransformationType = 
  | "field_mapping"
  | "type_conversion"
  | "value_normalization"
  | "structure_flattening"
  | "structure_nesting"
  | "code_system_mapping"
  | "date_format"
  | "unit_conversion"
  | "conditional"
  | "aggregate"
  | "split"
  | "merge";

export type DataType = 
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "dateTime"
  | "time"
  | "instant"
  | "uri"
  | "code"
  | "id"
  | "markdown"
  | "base64Binary"
  | "reference"
  | "coding"
  | "codeableConcept"
  | "quantity"
  | "period"
  | "address"
  | "humanName"
  | "contactPoint"
  | "identifier";

export interface TransformationRule {
  id: string;
  name: string;
  description: string;
  sourceResourceType: string;
  targetResourceType: string;
  transformationType: TransformationType;
  sourcePath: string;
  targetPath: string;
  sourceDataType: DataType;
  targetDataType: DataType;
  transformationLogic: string;
  condition?: string;
  defaultValue?: unknown;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  validationRules?: string[];
  metadata?: Record<string, unknown>;
}

export interface TransformationMapping {
  id: string;
  name: string;
  description: string;
  sourceSchema: string;
  targetSchema: string;
  rules: string[];
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  executionCount: number;
  lastExecutedAt?: string;
  successRate: number;
  averageExecutionTimeMs: number;
  tags: string[];
}

export interface TransformationSuggestion {
  id: string;
  mappingId?: string;
  sourceField: string;
  targetField: string;
  suggestedTransformationType: TransformationType;
  suggestedLogic: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    type: TransformationType;
    logic: string;
    confidence: number;
  }>;
  dataTypeCompatibility: {
    isCompatible: boolean;
    conversionRequired: boolean;
    lossyConversion: boolean;
    notes: string;
  };
  complexityScore: number;
  estimatedPerformanceImpact: "low" | "medium" | "high";
  noCdsCompliance: string;
  generatedAt: string;
}

export interface TransformationExecution {
  id: string;
  mappingId: string;
  inputResource: Record<string, unknown>;
  outputResource: Record<string, unknown>;
  rulesApplied: string[];
  errors: Array<{
    ruleId: string;
    error: string;
    field: string;
  }>;
  warnings: Array<{
    ruleId: string;
    warning: string;
    field: string;
  }>;
  executionTimeMs: number;
  success: boolean;
  timestamp: string;
}

export interface TargetDataModel {
  id: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
  dataTypes: Record<string, DataType>;
  constraints: Record<string, string>;
  examples: Record<string, unknown>[];
}

const transformationRulesStore = new Map<string, TransformationRule>();
const transformationMappingsStore = new Map<string, TransformationMapping>();
const transformationSuggestionsStore = new Map<string, TransformationSuggestion>();
const transformationExecutionsStore = new Map<string, TransformationExecution>();
const targetDataModelsStore = new Map<string, TargetDataModel>();

function generateId(): string {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .substring(0, 16);
}

function initializeSampleData(): void {
  const sampleRules: TransformationRule[] = [
    {
      id: "rule-patient-name",
      name: "Patient Name Flattening",
      description: "Flatten FHIR HumanName array to simple string format",
      sourceResourceType: "Patient",
      targetResourceType: "FlatPatient",
      transformationType: "structure_flattening",
      sourcePath: "name[0]",
      targetPath: "fullName",
      sourceDataType: "humanName",
      targetDataType: "string",
      transformationLogic: "concat(given.join(' '), ' ', family)",
      priority: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      tags: ["patient", "demographics", "flattening"],
    },
    {
      id: "rule-date-format",
      name: "Birth Date Format Conversion",
      description: "Convert FHIR date to ISO 8601 datetime",
      sourceResourceType: "Patient",
      targetResourceType: "AnalyticsPatient",
      transformationType: "date_format",
      sourcePath: "birthDate",
      targetPath: "dateOfBirth",
      sourceDataType: "date",
      targetDataType: "dateTime",
      transformationLogic: "parseDate(value, 'YYYY-MM-DD').toISOString()",
      priority: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      tags: ["patient", "date", "analytics"],
    },
    {
      id: "rule-code-mapping",
      name: "Gender Code Mapping",
      description: "Map FHIR administrative gender to custom code system",
      sourceResourceType: "Patient",
      targetResourceType: "CustomPatient",
      transformationType: "code_system_mapping",
      sourcePath: "gender",
      targetPath: "genderCode",
      sourceDataType: "code",
      targetDataType: "coding",
      transformationLogic: "mapCode('http://hl7.org/fhir/administrative-gender', 'http://custom.org/gender', value)",
      priority: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      tags: ["patient", "coding", "mapping"],
    },
    {
      id: "rule-obs-value",
      name: "Observation Value Extraction",
      description: "Extract numeric value from Observation valueQuantity",
      sourceResourceType: "Observation",
      targetResourceType: "LabResult",
      transformationType: "field_mapping",
      sourcePath: "valueQuantity.value",
      targetPath: "numericValue",
      sourceDataType: "decimal",
      targetDataType: "decimal",
      transformationLogic: "value",
      priority: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      tags: ["observation", "lab", "value"],
    },
    {
      id: "rule-unit-conversion",
      name: "Temperature Unit Conversion",
      description: "Convert temperature from Fahrenheit to Celsius",
      sourceResourceType: "Observation",
      targetResourceType: "VitalSign",
      transformationType: "unit_conversion",
      sourcePath: "valueQuantity",
      targetPath: "temperature",
      sourceDataType: "quantity",
      targetDataType: "quantity",
      transformationLogic: "convertUnit(value, '[degF]', 'Cel', (v) => (v - 32) * 5/9)",
      condition: "code.coding[0].code === '8310-5'",
      priority: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      tags: ["observation", "vitals", "unit-conversion"],
    },
  ];

  sampleRules.forEach((rule) => transformationRulesStore.set(rule.id, rule));

  const sampleMappings: TransformationMapping[] = [
    {
      id: "mapping-patient-flat",
      name: "Patient to Flat Analytics",
      description: "Transform FHIR Patient to flat analytics-ready format",
      sourceSchema: "Patient",
      targetSchema: "FlatPatient",
      rules: ["rule-patient-name", "rule-date-format", "rule-code-mapping"],
      version: "1.0.0",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      executionCount: 1250,
      lastExecutedAt: new Date().toISOString(),
      successRate: 98.5,
      averageExecutionTimeMs: 12,
      tags: ["patient", "analytics", "production"],
    },
    {
      id: "mapping-obs-lab",
      name: "Observation to Lab Result",
      description: "Transform FHIR Observation to standardized lab result format",
      sourceSchema: "Observation",
      targetSchema: "LabResult",
      rules: ["rule-obs-value"],
      version: "1.0.0",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
      executionCount: 5430,
      lastExecutedAt: new Date().toISOString(),
      successRate: 99.2,
      averageExecutionTimeMs: 8,
      tags: ["observation", "lab", "production"],
    },
  ];

  sampleMappings.forEach((mapping) => transformationMappingsStore.set(mapping.id, mapping));

  const sampleTargetModels: TargetDataModel[] = [
    {
      id: "model-flat-patient",
      name: "FlatPatient",
      description: "Flattened patient record for analytics",
      schema: {
        fullName: { type: "string", maxLength: 200 },
        dateOfBirth: { type: "dateTime" },
        genderCode: { type: "string", enum: ["M", "F", "O", "U"] },
        mrn: { type: "string" },
        address: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
      requiredFields: ["fullName", "dateOfBirth", "mrn"],
      optionalFields: ["genderCode", "address", "phone", "email"],
      dataTypes: {
        fullName: "string",
        dateOfBirth: "dateTime",
        genderCode: "code",
        mrn: "string",
        address: "string",
        phone: "string",
        email: "string",
      },
      constraints: {
        fullName: "non-empty",
        dateOfBirth: "valid ISO 8601 date",
        mrn: "unique identifier",
      },
      examples: [
        {
          fullName: "John Doe",
          dateOfBirth: "1985-03-15T00:00:00Z",
          genderCode: "M",
          mrn: "MRN12345",
        },
      ],
    },
    {
      id: "model-lab-result",
      name: "LabResult",
      description: "Standardized lab result for reporting",
      schema: {
        testCode: { type: "string" },
        testName: { type: "string" },
        numericValue: { type: "decimal" },
        unit: { type: "string" },
        referenceRange: { type: "string" },
        interpretation: { type: "code" },
        collectedAt: { type: "dateTime" },
        reportedAt: { type: "dateTime" },
      },
      requiredFields: ["testCode", "numericValue", "collectedAt"],
      optionalFields: ["testName", "unit", "referenceRange", "interpretation", "reportedAt"],
      dataTypes: {
        testCode: "code",
        testName: "string",
        numericValue: "decimal",
        unit: "string",
        referenceRange: "string",
        interpretation: "code",
        collectedAt: "dateTime",
        reportedAt: "dateTime",
      },
      constraints: {
        testCode: "valid LOINC code",
        numericValue: "numeric value",
      },
      examples: [
        {
          testCode: "2345-7",
          testName: "Glucose",
          numericValue: 95,
          unit: "mg/dL",
          referenceRange: "70-100",
          interpretation: "N",
          collectedAt: "2024-01-15T08:30:00Z",
        },
      ],
    },
  ];

  sampleTargetModels.forEach((model) => targetDataModelsStore.set(model.id, model));

  console.log("[AIFHIRTransformation] Initialized sample transformation rules:", sampleRules.length);
  console.log("[AIFHIRTransformation] Initialized sample mappings:", sampleMappings.length);
  console.log("[AIFHIRTransformation] Initialized target data models:", sampleTargetModels.length);
}

class AIFHIRTransformationService {
  constructor() {
    initializeSampleData();
    console.log("[AIFHIRTransformation] Service initialized");
  }

  async getAllRules(filters?: {
    resourceType?: string;
    transformationType?: TransformationType;
    isActive?: boolean;
    tag?: string;
  }): Promise<TransformationRule[]> {
    let rules = Array.from(transformationRulesStore.values());

    if (filters?.resourceType) {
      rules = rules.filter(
        (r) => r.sourceResourceType === filters.resourceType || r.targetResourceType === filters.resourceType
      );
    }
    if (filters?.transformationType) {
      rules = rules.filter((r) => r.transformationType === filters.transformationType);
    }
    if (filters?.isActive !== undefined) {
      rules = rules.filter((r) => r.isActive === filters.isActive);
    }
    if (filters?.tag) {
      rules = rules.filter((r) => r.tags.includes(filters.tag!));
    }

    return rules.sort((a, b) => a.priority - b.priority);
  }

  async getRuleById(id: string): Promise<TransformationRule | undefined> {
    return transformationRulesStore.get(id);
  }

  async createRule(rule: Omit<TransformationRule, "id" | "createdAt" | "updatedAt">): Promise<TransformationRule> {
    const newRule: TransformationRule = {
      ...rule,
      id: `rule-${generateId()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    transformationRulesStore.set(newRule.id, newRule);
    return newRule;
  }

  async updateRule(id: string, updates: Partial<TransformationRule>): Promise<TransformationRule | undefined> {
    const existing = transformationRulesStore.get(id);
    if (!existing) return undefined;

    const updated: TransformationRule = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    transformationRulesStore.set(id, updated);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    return transformationRulesStore.delete(id);
  }

  async getAllMappings(filters?: {
    sourceSchema?: string;
    targetSchema?: string;
    isActive?: boolean;
    tag?: string;
  }): Promise<TransformationMapping[]> {
    let mappings = Array.from(transformationMappingsStore.values());

    if (filters?.sourceSchema) {
      mappings = mappings.filter((m) => m.sourceSchema === filters.sourceSchema);
    }
    if (filters?.targetSchema) {
      mappings = mappings.filter((m) => m.targetSchema === filters.targetSchema);
    }
    if (filters?.isActive !== undefined) {
      mappings = mappings.filter((m) => m.isActive === filters.isActive);
    }
    if (filters?.tag) {
      mappings = mappings.filter((m) => m.tags.includes(filters.tag!));
    }

    return mappings;
  }

  async getMappingById(id: string): Promise<TransformationMapping | undefined> {
    return transformationMappingsStore.get(id);
  }

  async createMapping(mapping: Omit<TransformationMapping, "id" | "createdAt" | "updatedAt" | "executionCount" | "successRate" | "averageExecutionTimeMs">): Promise<TransformationMapping> {
    const newMapping: TransformationMapping = {
      ...mapping,
      id: `mapping-${generateId()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
      successRate: 100,
      averageExecutionTimeMs: 0,
    };
    transformationMappingsStore.set(newMapping.id, newMapping);
    return newMapping;
  }

  async updateMapping(id: string, updates: Partial<TransformationMapping>): Promise<TransformationMapping | undefined> {
    const existing = transformationMappingsStore.get(id);
    if (!existing) return undefined;

    const updated: TransformationMapping = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    transformationMappingsStore.set(id, updated);
    return updated;
  }

  async deleteMapping(id: string): Promise<boolean> {
    return transformationMappingsStore.delete(id);
  }

  async getAllTargetModels(): Promise<TargetDataModel[]> {
    return Array.from(targetDataModelsStore.values());
  }

  async getTargetModelById(id: string): Promise<TargetDataModel | undefined> {
    return targetDataModelsStore.get(id);
  }

  async createTargetModel(model: Omit<TargetDataModel, "id">): Promise<TargetDataModel> {
    const newModel: TargetDataModel = {
      ...model,
      id: `model-${generateId()}`,
    };
    targetDataModelsStore.set(newModel.id, newModel);
    return newModel;
  }

  async executeTransformation(
    mappingId: string,
    inputResource: Record<string, unknown>
  ): Promise<TransformationExecution> {
    const startTime = Date.now();
    const mapping = transformationMappingsStore.get(mappingId);

    if (!mapping) {
      throw new Error(`Mapping not found: ${mappingId}`);
    }

    const rules = mapping.rules
      .map((ruleId) => transformationRulesStore.get(ruleId))
      .filter((r): r is TransformationRule => r !== undefined)
      .sort((a, b) => a.priority - b.priority);

    const outputResource: Record<string, unknown> = {};
    const errors: TransformationExecution["errors"] = [];
    const warnings: TransformationExecution["warnings"] = [];
    const rulesApplied: string[] = [];

    for (const rule of rules) {
      try {
        if (rule.condition) {
          const conditionMet = this.evaluateCondition(rule.condition, inputResource);
          if (!conditionMet) {
            warnings.push({
              ruleId: rule.id,
              warning: "Condition not met, rule skipped",
              field: rule.sourcePath,
            });
            continue;
          }
        }

        const sourceValue = this.getValueByPath(inputResource, rule.sourcePath);
        if (sourceValue === undefined) {
          if (rule.defaultValue !== undefined) {
            this.setValueByPath(outputResource, rule.targetPath, rule.defaultValue);
            rulesApplied.push(rule.id);
          } else {
            warnings.push({
              ruleId: rule.id,
              warning: "Source value not found, no default provided",
              field: rule.sourcePath,
            });
          }
          continue;
        }

        const transformedValue = this.applyTransformation(rule, sourceValue);
        this.setValueByPath(outputResource, rule.targetPath, transformedValue);
        rulesApplied.push(rule.id);
      } catch (err) {
        errors.push({
          ruleId: rule.id,
          error: err instanceof Error ? err.message : String(err),
          field: rule.sourcePath,
        });
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const success = errors.length === 0;

    const execution: TransformationExecution = {
      id: `exec-${generateId()}`,
      mappingId,
      inputResource,
      outputResource,
      rulesApplied,
      errors,
      warnings,
      executionTimeMs,
      success,
      timestamp: new Date().toISOString(),
    };

    transformationExecutionsStore.set(execution.id, execution);

    const totalExecutions = mapping.executionCount + 1;
    const successCount = Math.round(mapping.successRate * mapping.executionCount / 100) + (success ? 1 : 0);
    const newSuccessRate = (successCount / totalExecutions) * 100;
    const newAvgTime = (mapping.averageExecutionTimeMs * mapping.executionCount + executionTimeMs) / totalExecutions;

    await this.updateMapping(mappingId, {
      executionCount: totalExecutions,
      lastExecutedAt: new Date().toISOString(),
      successRate: Math.round(newSuccessRate * 10) / 10,
      averageExecutionTimeMs: Math.round(newAvgTime),
    });

    return execution;
  }

  private evaluateCondition(condition: string, resource: Record<string, unknown>): boolean {
    try {
      const pathMatch = condition.match(/^([a-zA-Z0-9\[\]\.]+)\s*(===|!==|==|!=|>|<|>=|<=)\s*(.+)$/);
      if (pathMatch) {
        const [, path, operator, expectedStr] = pathMatch;
        const actualValue = this.getValueByPath(resource, path);
        const expectedValue = expectedStr.replace(/['"]/g, "");

        switch (operator) {
          case "===":
          case "==":
            return String(actualValue) === expectedValue;
          case "!==":
          case "!=":
            return String(actualValue) !== expectedValue;
          case ">":
            return Number(actualValue) > Number(expectedValue);
          case "<":
            return Number(actualValue) < Number(expectedValue);
          case ">=":
            return Number(actualValue) >= Number(expectedValue);
          case "<=":
            return Number(actualValue) <= Number(expectedValue);
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        const nextPart = parts[i + 1];
        current[part] = /^\d+$/.test(nextPart) ? [] : {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private applyTransformation(rule: TransformationRule, value: unknown): unknown {
    switch (rule.transformationType) {
      case "field_mapping":
        return value;

      case "type_conversion":
        return this.convertType(value, rule.sourceDataType, rule.targetDataType);

      case "value_normalization":
        return this.normalizeValue(value, rule.transformationLogic);

      case "structure_flattening":
        return this.flattenStructure(value, rule.transformationLogic);

      case "structure_nesting":
        return this.nestStructure(value, rule.transformationLogic);

      case "code_system_mapping":
        return this.mapCodeSystem(value, rule.transformationLogic);

      case "date_format":
        return this.formatDate(value, rule.transformationLogic);

      case "unit_conversion":
        return this.convertUnit(value, rule.transformationLogic);

      case "conditional":
        return this.applyConditional(value, rule.transformationLogic);

      case "aggregate":
        return this.aggregateValues(value, rule.transformationLogic);

      case "split":
        return this.splitValue(value, rule.transformationLogic);

      case "merge":
        return this.mergeValues(value, rule.transformationLogic);

      default:
        return value;
    }
  }

  private convertType(value: unknown, sourceType: DataType, targetType: DataType): unknown {
    if (sourceType === targetType) return value;

    if (targetType === "string") {
      return String(value);
    }
    if (targetType === "integer") {
      return Math.round(Number(value));
    }
    if (targetType === "decimal") {
      return Number(value);
    }
    if (targetType === "boolean") {
      return Boolean(value);
    }
    if (targetType === "dateTime" && sourceType === "date") {
      return `${value}T00:00:00Z`;
    }

    return value;
  }

  private normalizeValue(value: unknown, logic: string): unknown {
    if (typeof value !== "string") return value;
    if (logic.includes("lowercase")) return value.toLowerCase();
    if (logic.includes("uppercase")) return value.toUpperCase();
    if (logic.includes("trim")) return value.trim();
    return value;
  }

  private flattenStructure(value: unknown, logic: string): unknown {
    if (typeof value !== "object" || value === null) return value;

    const obj = value as Record<string, unknown>;

    if (logic.includes("concat") && logic.includes("given") && logic.includes("family")) {
      const given = Array.isArray(obj.given) ? obj.given.join(" ") : "";
      const family = obj.family || "";
      return `${given} ${family}`.trim();
    }

    return JSON.stringify(value);
  }

  private nestStructure(value: unknown, logic: string): unknown {
    if (logic.includes("wrapInArray")) {
      return [value];
    }
    if (logic.includes("wrapInObject")) {
      const keyMatch = logic.match(/key:\s*(\w+)/);
      const key = keyMatch ? keyMatch[1] : "value";
      return { [key]: value };
    }
    return value;
  }

  private mapCodeSystem(value: unknown, logic: string): unknown {
    const mappings: Record<string, string> = {
      male: "M",
      female: "F",
      other: "O",
      unknown: "U",
    };
    const strValue = String(value).toLowerCase();
    return mappings[strValue] || value;
  }

  private formatDate(value: unknown, logic: string): unknown {
    if (!value) return value;
    try {
      const date = new Date(String(value));
      if (logic.includes("toISOString")) {
        return date.toISOString();
      }
      return date.toISOString().split("T")[0];
    } catch {
      return value;
    }
  }

  private convertUnit(value: unknown, logic: string): unknown {
    if (typeof value !== "object" || value === null) return value;

    const quantity = value as { value?: number; unit?: string };
    if (quantity.value === undefined) return value;

    if (logic.includes("degF") && logic.includes("Cel")) {
      return {
        value: Math.round(((quantity.value - 32) * 5) / 9 * 10) / 10,
        unit: "Cel",
      };
    }

    return value;
  }

  private applyConditional(value: unknown, logic: string): unknown {
    return value;
  }

  private aggregateValues(value: unknown, logic: string): unknown {
    if (!Array.isArray(value)) return value;

    if (logic.includes("sum")) {
      return value.reduce((a, b) => Number(a) + Number(b), 0);
    }
    if (logic.includes("avg")) {
      const sum = value.reduce((a, b) => Number(a) + Number(b), 0);
      return sum / value.length;
    }
    if (logic.includes("count")) {
      return value.length;
    }
    if (logic.includes("first")) {
      return value[0];
    }
    if (logic.includes("last")) {
      return value[value.length - 1];
    }

    return value;
  }

  private splitValue(value: unknown, logic: string): unknown {
    if (typeof value !== "string") return [value];

    const delimiterMatch = logic.match(/delimiter:\s*['"](.+)['"]/);
    const delimiter = delimiterMatch ? delimiterMatch[1] : ",";

    return value.split(delimiter).map((s) => s.trim());
  }

  private mergeValues(value: unknown, logic: string): unknown {
    if (!Array.isArray(value)) return value;

    const delimiterMatch = logic.match(/delimiter:\s*['"](.+)['"]/);
    const delimiter = delimiterMatch ? delimiterMatch[1] : ", ";

    return value.join(delimiter);
  }

  async generateTransformationSuggestions(
    sourceResource: Record<string, unknown>,
    targetModelId: string
  ): Promise<TransformationSuggestion[]> {
    const targetModel = targetDataModelsStore.get(targetModelId);
    if (!targetModel) {
      throw new Error(`Target model not found: ${targetModelId}`);
    }

    const suggestions: TransformationSuggestion[] = [];

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Analyze this FHIR resource and suggest transformations to map it to the target model.

Source Resource (sample):
${JSON.stringify(sourceResource, null, 2)}

Target Model Schema:
${JSON.stringify(targetModel.schema, null, 2)}

Required Fields: ${targetModel.requiredFields.join(", ")}
Data Types: ${JSON.stringify(targetModel.dataTypes)}

Provide transformation suggestions as JSON array with format:
[{
  "sourceField": "path.to.source.field",
  "targetField": "targetFieldName",
  "transformationType": "field_mapping|type_conversion|structure_flattening|code_system_mapping|date_format|unit_conversion",
  "suggestedLogic": "transformation expression",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "dataTypeCompatibility": {
    "isCompatible": boolean,
    "conversionRequired": boolean,
    "lossyConversion": boolean,
    "notes": "string"
  },
  "complexityScore": 1-10,
  "estimatedPerformanceImpact": "low|medium|high"
}]

Focus on data structure transformation only. Do NOT provide any clinical decision support.`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const aiSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : (Array.isArray(parsed) ? parsed : []);

          for (const s of aiSuggestions) {
            const suggestion: TransformationSuggestion = {
              id: `suggestion-${generateId()}`,
              mappingId: undefined,
              sourceField: s.sourceField || "",
              targetField: s.targetField || "",
              suggestedTransformationType: s.transformationType || "field_mapping",
              suggestedLogic: s.suggestedLogic || "value",
              confidence: Math.min(1, Math.max(0, s.confidence || 0.5)),
              reasoning: s.reasoning || "",
              alternatives: [],
              dataTypeCompatibility: s.dataTypeCompatibility || {
                isCompatible: true,
                conversionRequired: false,
                lossyConversion: false,
                notes: "",
              },
              complexityScore: s.complexityScore || 1,
              estimatedPerformanceImpact: s.estimatedPerformanceImpact || "low",
              noCdsCompliance: "Data transformation guidance only. Not for clinical decision-making.",
              generatedAt: new Date().toISOString(),
            };

            suggestions.push(suggestion);
            transformationSuggestionsStore.set(suggestion.id, suggestion);
          }
        }
      } catch (err) {
        console.error("[AIFHIRTransformation] AI suggestion generation failed:", err);
        suggestions.push(...this.generateRuleBasedSuggestions(sourceResource, targetModel));
      }
    } else {
      suggestions.push(...this.generateRuleBasedSuggestions(sourceResource, targetModel));
    }

    return suggestions;
  }

  private generateRuleBasedSuggestions(
    sourceResource: Record<string, unknown>,
    targetModel: TargetDataModel
  ): TransformationSuggestion[] {
    const suggestions: TransformationSuggestion[] = [];
    const sourceFields = this.extractAllPaths(sourceResource);

    for (const targetField of [...targetModel.requiredFields, ...targetModel.optionalFields]) {
      const targetDataType = targetModel.dataTypes[targetField];
      let bestMatch: { path: string; score: number } | null = null;

      for (const sourcePath of sourceFields) {
        const score = this.calculateFieldSimilarity(sourcePath, targetField);
        if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { path: sourcePath, score };
        }
      }

      if (bestMatch) {
        const sourceValue = this.getValueByPath(sourceResource, bestMatch.path);
        const sourceType = this.inferDataType(sourceValue);

        const transformationType = this.determineTransformationType(sourceType, targetDataType, sourceValue);

        const suggestion: TransformationSuggestion = {
          id: `suggestion-${generateId()}`,
          sourceField: bestMatch.path,
          targetField,
          suggestedTransformationType: transformationType,
          suggestedLogic: this.generateDefaultLogic(transformationType, sourceType, targetDataType),
          confidence: bestMatch.score,
          reasoning: `Field name similarity: ${Math.round(bestMatch.score * 100)}%`,
          alternatives: [],
          dataTypeCompatibility: {
            isCompatible: sourceType === targetDataType,
            conversionRequired: sourceType !== targetDataType,
            lossyConversion: this.isLossyConversion(sourceType, targetDataType),
            notes: sourceType !== targetDataType ? `Convert ${sourceType} to ${targetDataType}` : "",
          },
          complexityScore: this.calculateComplexity(transformationType),
          estimatedPerformanceImpact: "low",
          noCdsCompliance: "Data transformation guidance only. Not for clinical decision-making.",
          generatedAt: new Date().toISOString(),
        };

        suggestions.push(suggestion);
        transformationSuggestionsStore.set(suggestion.id, suggestion);
      }
    }

    return suggestions;
  }

  private extractAllPaths(obj: unknown, prefix: string = ""): string[] {
    const paths: string[] = [];

    if (obj === null || obj === undefined) return paths;

    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        paths.push(...this.extractAllPaths(obj[0], `${prefix}[0]`));
      }
    } else if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = prefix ? `${prefix}.${key}` : key;
        paths.push(newPath);
        paths.push(...this.extractAllPaths(value, newPath));
      }
    }

    return paths;
  }

  private calculateFieldSimilarity(source: string, target: string): number {
    const sourceNorm = source.toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetNorm = target.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (sourceNorm === targetNorm) return 1.0;
    if (sourceNorm.includes(targetNorm) || targetNorm.includes(sourceNorm)) return 0.8;

    const synonyms: Record<string, string[]> = {
      name: ["fullname", "patientname", "humanname"],
      birthdate: ["dob", "dateofbirth", "birthday"],
      gender: ["sex", "gendercode"],
      phone: ["telephone", "mobile", "contactpoint"],
      address: ["location", "residence"],
      mrn: ["identifier", "patientid", "id"],
    };

    for (const [base, syns] of Object.entries(synonyms)) {
      if (
        (sourceNorm.includes(base) || syns.some((s) => sourceNorm.includes(s))) &&
        (targetNorm.includes(base) || syns.some((s) => targetNorm.includes(s)))
      ) {
        return 0.6;
      }
    }

    let matches = 0;
    const sourceChars = new Set(sourceNorm);
    for (const char of targetNorm) {
      if (sourceChars.has(char)) matches++;
    }

    return matches / Math.max(sourceNorm.length, targetNorm.length);
  }

  private inferDataType(value: unknown): DataType {
    if (value === null || value === undefined) return "string";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") {
      return Number.isInteger(value) ? "integer" : "decimal";
    }
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "dateTime";
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value)) return "id";
      if (/^https?:\/\//.test(value)) return "uri";
      return "string";
    }
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        const first = value[0] as Record<string, unknown>;
        if ("family" in first || "given" in first) return "humanName";
        if ("system" in first && "code" in first) return "coding";
      }
      return "string";
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if ("value" in obj && "unit" in obj) return "quantity";
      if ("start" in obj || "end" in obj) return "period";
      if ("system" in obj && "code" in obj) return "coding";
      if ("reference" in obj) return "reference";
    }
    return "string";
  }

  private determineTransformationType(
    sourceType: DataType,
    targetType: DataType,
    sourceValue: unknown
  ): TransformationType {
    if (sourceType === targetType) return "field_mapping";

    if ((sourceType === "date" && targetType === "dateTime") || 
        (sourceType === "dateTime" && targetType === "date")) {
      return "date_format";
    }

    if (sourceType === "humanName" && targetType === "string") {
      return "structure_flattening";
    }

    if (sourceType === "code" && targetType === "coding") {
      return "code_system_mapping";
    }

    if (sourceType === "quantity" && targetType === "quantity") {
      return "unit_conversion";
    }

    return "type_conversion";
  }

  private generateDefaultLogic(
    transformationType: TransformationType,
    sourceType: DataType,
    targetType: DataType
  ): string {
    switch (transformationType) {
      case "field_mapping":
        return "value";
      case "type_conversion":
        return `convert(value, '${targetType}')`;
      case "structure_flattening":
        if (sourceType === "humanName") {
          return "concat(given.join(' '), ' ', family)";
        }
        return "JSON.stringify(value)";
      case "date_format":
        return "parseDate(value).toISOString()";
      case "code_system_mapping":
        return "mapCode(value)";
      case "unit_conversion":
        return "convertUnit(value.value, value.unit, targetUnit)";
      default:
        return "value";
    }
  }

  private isLossyConversion(sourceType: DataType, targetType: DataType): boolean {
    const lossyPairs: [DataType, DataType][] = [
      ["decimal", "integer"],
      ["dateTime", "date"],
      ["humanName", "string"],
      ["codeableConcept", "code"],
      ["quantity", "decimal"],
    ];

    return lossyPairs.some(([s, t]) => sourceType === s && targetType === t);
  }

  private calculateComplexity(transformationType: TransformationType): number {
    const complexityMap: Record<TransformationType, number> = {
      field_mapping: 1,
      type_conversion: 2,
      value_normalization: 2,
      structure_flattening: 4,
      structure_nesting: 4,
      code_system_mapping: 5,
      date_format: 3,
      unit_conversion: 6,
      conditional: 5,
      aggregate: 7,
      split: 3,
      merge: 3,
    };

    return complexityMap[transformationType] || 1;
  }

  async getExecutionHistory(mappingId?: string, limit: number = 50): Promise<TransformationExecution[]> {
    let executions = Array.from(transformationExecutionsStore.values());

    if (mappingId) {
      executions = executions.filter((e) => e.mappingId === mappingId);
    }

    return executions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getTransformationStats(): Promise<{
    totalRules: number;
    activeRules: number;
    totalMappings: number;
    activeMappings: number;
    totalExecutions: number;
    successfulExecutions: number;
    averageExecutionTimeMs: number;
    rulesByType: Record<string, number>;
    topMappings: Array<{ id: string; name: string; executionCount: number; successRate: number }>;
  }> {
    const rules = Array.from(transformationRulesStore.values());
    const mappings = Array.from(transformationMappingsStore.values());
    const executions = Array.from(transformationExecutionsStore.values());

    const rulesByType: Record<string, number> = {};
    for (const rule of rules) {
      rulesByType[rule.transformationType] = (rulesByType[rule.transformationType] || 0) + 1;
    }

    const totalExecutionTime = executions.reduce((sum, e) => sum + e.executionTimeMs, 0);

    return {
      totalRules: rules.length,
      activeRules: rules.filter((r) => r.isActive).length,
      totalMappings: mappings.length,
      activeMappings: mappings.filter((m) => m.isActive).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter((e) => e.success).length,
      averageExecutionTimeMs: executions.length > 0 ? Math.round(totalExecutionTime / executions.length) : 0,
      rulesByType,
      topMappings: mappings
        .sort((a, b) => b.executionCount - a.executionCount)
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          name: m.name,
          executionCount: m.executionCount,
          successRate: m.successRate,
        })),
    };
  }
}

export const aiFhirTransformationService = new AIFHIRTransformationService();
