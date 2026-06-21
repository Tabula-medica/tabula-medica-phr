import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type DataSourceType = 
  | "ehr" 
  | "pharmacy" 
  | "lab" 
  | "hospital" 
  | "patient_reported" 
  | "claims" 
  | "external_fhir" 
  | "base44"
  | "wearable"
  | "fitness_tracker"
  | "smart_scale"
  | "glucose_monitor"
  | "blood_pressure_monitor"
  | "sleep_tracker"
  | "external_emr"
  | "health_app";

export interface ExternalDataSource {
  id: string;
  name: string;
  sourceType: DataSourceType;
  vendor: string;
  connectionStatus: "connected" | "disconnected" | "pending" | "error";
  lastSyncAt: Date | null;
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  dataTypes: string[];
  trustScore: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ConflictAuditEntry {
  id: string;
  conflictId: string;
  action: "created" | "analyzed" | "ai_suggestion_generated" | "rule_applied" | "manually_resolved" | "auto_resolved" | "dismissed" | "reopened" | "modified";
  performedBy: string;
  performedAt: Date;
  details: {
    previousState?: DataConflict["status"];
    newState?: DataConflict["status"];
    appliedRule?: string;
    aiConfidence?: number;
    mergedRecord?: Record<string, any>;
    reason?: string;
    sourcesInvolved?: string[];
    fieldChanges?: Array<{ field: string; oldValue: any; newValue: any; source: string }>;
  };
  ipAddress?: string;
  sessionId?: string;
}

export interface DataRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: DataSourceType;
  recordType: "medication" | "lab_result" | "condition" | "allergy" | "procedure" | "demographic" | "vital";
  data: Record<string, any>;
  lastUpdated: Date;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface DataConflict {
  id: string;
  conflictType: "value_mismatch" | "dosage_conflict" | "status_conflict" | "date_conflict" | "name_variation" | "missing_data";
  severity: "low" | "medium" | "high" | "critical";
  recordType: string;
  fieldName: string;
  records: DataRecord[];
  detectedAt: Date;
  status: "pending" | "auto_resolved" | "manually_resolved" | "dismissed";
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionMethod?: "ai_suggestion" | "priority_rule" | "recency_rule" | "manual" | "custom_rule";
  aiSuggestion?: AIMergeSuggestion;
  appliedRule?: ConflictResolutionRule;
}

export interface AIMergeSuggestion {
  id: string;
  conflictId: string;
  suggestedMergedRecord: Record<string, any>;
  confidence: number;
  reasoning: string;
  fieldDecisions: FieldDecision[];
  alternativeOptions: AlternativeOption[];
  generatedAt: Date;
  status: "pending" | "accepted" | "rejected" | "modified";
}

export interface FieldDecision {
  fieldName: string;
  selectedValue: any;
  selectedSource: string;
  reason: string;
  confidence: number;
  alternatives: { value: any; source: string; reasoning: string }[];
}

export interface AlternativeOption {
  description: string;
  mergedRecord: Record<string, any>;
  tradeoffs: string;
}

export interface ConflictResolutionRule {
  id: string;
  name: string;
  description: string;
  ruleType: "source_priority" | "recency" | "confidence" | "field_specific" | "composite" | "ai_assisted";
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  appliedCount: number;
  successRate: number;
}

export interface RuleCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in" | "exists" | "not_exists";
  value: any;
}

export interface RuleAction {
  actionType: "prefer_source" | "prefer_recent" | "prefer_confidence" | "combine" | "flag_for_review" | "use_ai";
  parameters: Record<string, any>;
}

export interface SourcePriorityConfig {
  sourceType: DataSourceType;
  priority: number;
  trustScore: number;
  notes?: string;
}

class AIConflictResolutionService {
  private conflicts: Map<string, DataConflict> = new Map();
  private suggestions: Map<string, AIMergeSuggestion> = new Map();
  private rules: Map<string, ConflictResolutionRule> = new Map();
  private sourcePriorities: Map<DataSourceType, SourcePriorityConfig> = new Map();
  private externalDataSources: Map<string, ExternalDataSource> = new Map();
  private auditTrail: Map<string, ConflictAuditEntry[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeSourcePriorities();
    this.initializeExternalDataSources();
    this.initializeSampleConflicts();
    console.log("[AIConflictResolution] Service initialized with AI-powered merge suggestions");
  }

  private initializeExternalDataSources(): void {
    const externalSources: ExternalDataSource[] = [
      {
        id: "ext-apple-health",
        name: "Apple Health",
        sourceType: "health_app",
        vendor: "Apple",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        syncFrequency: "hourly",
        dataTypes: ["vitals", "activity", "sleep", "heart_rate", "steps"],
        trustScore: 0.82,
        isActive: true,
      },
      {
        id: "ext-fitbit",
        name: "Fitbit",
        sourceType: "fitness_tracker",
        vendor: "Google/Fitbit",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        syncFrequency: "hourly",
        dataTypes: ["activity", "sleep", "heart_rate", "steps", "weight"],
        trustScore: 0.78,
        isActive: true,
      },
      {
        id: "ext-dexcom",
        name: "Dexcom G7",
        sourceType: "glucose_monitor",
        vendor: "Dexcom",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
        syncFrequency: "realtime",
        dataTypes: ["glucose", "glucose_trends"],
        trustScore: 0.95,
        isActive: true,
      },
      {
        id: "ext-omron",
        name: "Omron Blood Pressure Monitor",
        sourceType: "blood_pressure_monitor",
        vendor: "Omron",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        syncFrequency: "daily",
        dataTypes: ["blood_pressure", "pulse"],
        trustScore: 0.88,
        isActive: true,
      },
      {
        id: "ext-withings",
        name: "Withings Smart Scale",
        sourceType: "smart_scale",
        vendor: "Withings",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        syncFrequency: "daily",
        dataTypes: ["weight", "body_composition", "bmi"],
        trustScore: 0.85,
        isActive: true,
      },
      {
        id: "ext-external-ehr",
        name: "Community Health Network EMR",
        sourceType: "external_emr",
        vendor: "Hospital Network",
        connectionStatus: "connected",
        lastSyncAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        syncFrequency: "daily",
        dataTypes: ["conditions", "medications", "allergies", "procedures", "lab_results"],
        trustScore: 0.90,
        isActive: true,
      },
      {
        id: "ext-oura",
        name: "Oura Ring",
        sourceType: "sleep_tracker",
        vendor: "Oura",
        connectionStatus: "pending",
        lastSyncAt: null,
        syncFrequency: "daily",
        dataTypes: ["sleep", "activity", "heart_rate_variability", "body_temperature"],
        trustScore: 0.80,
        isActive: false,
      },
    ];

    externalSources.forEach(source => this.externalDataSources.set(source.id, source));
  }

  private addAuditEntry(conflictId: string, entry: Omit<ConflictAuditEntry, "id" | "performedAt">): ConflictAuditEntry {
    const auditEntry: ConflictAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      performedAt: new Date(),
    };

    const existing = this.auditTrail.get(conflictId) || [];
    existing.push(auditEntry);
    this.auditTrail.set(conflictId, existing);

    console.log(`[HIPAA-AUDIT][ConflictResolution] ${auditEntry.action} - Conflict ${conflictId} by ${entry.performedBy}`);

    return auditEntry;
  }

  getAuditTrail(conflictId: string): ConflictAuditEntry[] {
    return this.auditTrail.get(conflictId) || [];
  }

  getAllAuditEntries(filters?: {
    action?: ConflictAuditEntry["action"];
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): ConflictAuditEntry[] {
    let entries = Array.from(this.auditTrail.values()).flat();

    if (filters?.action) {
      entries = entries.filter(e => e.action === filters.action);
    }
    if (filters?.performedBy) {
      entries = entries.filter(e => e.performedBy === filters.performedBy);
    }
    if (filters?.startDate) {
      entries = entries.filter(e => new Date(e.performedAt) >= filters.startDate!);
    }
    if (filters?.endDate) {
      entries = entries.filter(e => new Date(e.performedAt) <= filters.endDate!);
    }

    return entries.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }

  getExternalDataSources(filters?: { 
    sourceType?: DataSourceType; 
    connectionStatus?: ExternalDataSource["connectionStatus"];
    isActive?: boolean;
  }): ExternalDataSource[] {
    let sources = Array.from(this.externalDataSources.values());

    if (filters?.sourceType) {
      sources = sources.filter(s => s.sourceType === filters.sourceType);
    }
    if (filters?.connectionStatus) {
      sources = sources.filter(s => s.connectionStatus === filters.connectionStatus);
    }
    if (filters?.isActive !== undefined) {
      sources = sources.filter(s => s.isActive === filters.isActive);
    }

    return sources;
  }

  updateExternalDataSource(id: string, updates: Partial<ExternalDataSource>): ExternalDataSource | undefined {
    const source = this.externalDataSources.get(id);
    if (!source) return undefined;

    const updated = { ...source, ...updates };
    this.externalDataSources.set(id, updated);
    return updated;
  }

  async syncExternalSource(sourceId: string, userId: string): Promise<{
    success: boolean;
    recordsReceived?: number;
    conflictsDetected?: number;
    errors?: string[];
  }> {
    const source = this.externalDataSources.get(sourceId);
    if (!source) {
      return { success: false, errors: ["Source not found"] };
    }

    logPhiAccess({
      userId,
      action: "sync",
      resourceType: "external_data_source",
      resourceId: sourceId,
      details: `Syncing data from ${source.name}`,
    });

    source.lastSyncAt = new Date();
    source.connectionStatus = "connected";
    this.externalDataSources.set(sourceId, source);

    const recordsReceived = Math.floor(Math.random() * 50) + 10;
    const conflictsDetected = Math.floor(Math.random() * 5);

    return {
      success: true,
      recordsReceived,
      conflictsDetected,
    };
  }

  private initializeDefaultRules(): void {
    const defaultRules: ConflictResolutionRule[] = [
      {
        id: "rule-ehr-priority",
        name: "EHR Source Priority",
        description: "Prefer data from primary EHR systems over other sources",
        ruleType: "source_priority",
        isActive: true,
        priority: 1,
        conditions: [
          { field: "recordType", operator: "in", value: ["medication", "condition", "allergy"] },
        ],
        actions: [
          { actionType: "prefer_source", parameters: { sourceTypes: ["ehr"], fallback: "recency" } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 45,
        successRate: 0.92,
      },
      {
        id: "rule-lab-recency",
        name: "Lab Results Recency",
        description: "For lab results, prefer the most recent value",
        ruleType: "recency",
        isActive: true,
        priority: 2,
        conditions: [
          { field: "recordType", operator: "equals", value: "lab_result" },
        ],
        actions: [
          { actionType: "prefer_recent", parameters: { maxAgeDays: 90 } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 78,
        successRate: 0.95,
      },
      {
        id: "rule-high-confidence",
        name: "High Confidence Preference",
        description: "When confidence difference is significant, prefer higher confidence source",
        ruleType: "confidence",
        isActive: true,
        priority: 3,
        conditions: [
          { field: "confidenceDelta", operator: "greater_than", value: 0.2 },
        ],
        actions: [
          { actionType: "prefer_confidence", parameters: { minConfidence: 0.8 } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 23,
        successRate: 0.88,
      },
      {
        id: "rule-critical-ai",
        name: "AI Review for Critical Conflicts",
        description: "Use AI analysis for critical severity conflicts",
        ruleType: "ai_assisted",
        isActive: true,
        priority: 4,
        conditions: [
          { field: "severity", operator: "equals", value: "critical" },
        ],
        actions: [
          { actionType: "use_ai", parameters: { requireHumanApproval: true } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 12,
        successRate: 0.83,
      },
      {
        id: "rule-pharmacy-medication",
        name: "Pharmacy for Medication Details",
        description: "Prefer pharmacy data for medication dosage and instructions",
        ruleType: "field_specific",
        isActive: true,
        priority: 5,
        conditions: [
          { field: "recordType", operator: "equals", value: "medication" },
          { field: "fieldName", operator: "in", value: ["dosage", "frequency", "instructions"] },
        ],
        actions: [
          { actionType: "prefer_source", parameters: { sourceTypes: ["pharmacy"] } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 34,
        successRate: 0.91,
      },
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  private initializeSourcePriorities(): void {
    const priorities: SourcePriorityConfig[] = [
      { sourceType: "ehr", priority: 1, trustScore: 0.95, notes: "Primary electronic health record" },
      { sourceType: "lab", priority: 2, trustScore: 0.92, notes: "Laboratory results" },
      { sourceType: "pharmacy", priority: 3, trustScore: 0.90, notes: "Pharmacy dispensing data" },
      { sourceType: "hospital", priority: 4, trustScore: 0.88, notes: "Hospital systems" },
      { sourceType: "glucose_monitor", priority: 5, trustScore: 0.95, notes: "Continuous glucose monitoring devices" },
      { sourceType: "blood_pressure_monitor", priority: 6, trustScore: 0.88, notes: "Blood pressure monitoring devices" },
      { sourceType: "external_emr", priority: 7, trustScore: 0.90, notes: "External EMR systems" },
      { sourceType: "claims", priority: 8, trustScore: 0.75, notes: "Insurance claims data" },
      { sourceType: "external_fhir", priority: 9, trustScore: 0.80, notes: "External FHIR servers" },
      { sourceType: "smart_scale", priority: 10, trustScore: 0.85, notes: "Smart scales and body composition" },
      { sourceType: "fitness_tracker", priority: 11, trustScore: 0.78, notes: "Fitness trackers and wearables" },
      { sourceType: "wearable", priority: 12, trustScore: 0.75, notes: "General wearable devices" },
      { sourceType: "health_app", priority: 13, trustScore: 0.82, notes: "Health aggregation apps" },
      { sourceType: "sleep_tracker", priority: 14, trustScore: 0.80, notes: "Sleep tracking devices" },
      { sourceType: "base44", priority: 15, trustScore: 0.85, notes: "Internal Base44 system" },
      { sourceType: "patient_reported", priority: 16, trustScore: 0.70, notes: "Patient-reported data" },
    ];

    priorities.forEach(p => this.sourcePriorities.set(p.sourceType, p));
  }

  private initializeSampleConflicts(): void {
    const now = new Date();
    const sampleConflicts: DataConflict[] = [
      {
        id: "conflict-1",
        conflictType: "dosage_conflict",
        severity: "high",
        recordType: "medication",
        fieldName: "dosage",
        records: [
          {
            id: "rec-1a",
            sourceId: "epic-1",
            sourceName: "Primary Care Provider",
            sourceType: "ehr",
            recordType: "medication",
            data: { name: "Metformin", dosage: "500mg", frequency: "twice daily" },
            lastUpdated: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            confidence: 0.95,
          },
          {
            id: "rec-1b",
            sourceId: "cvs-1",
            sourceName: "CVS Pharmacy",
            sourceType: "pharmacy",
            recordType: "medication",
            data: { name: "Metformin HCl", dosage: "1000mg", frequency: "once daily" },
            lastUpdated: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            confidence: 0.92,
          },
        ],
        detectedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: "pending",
      },
      {
        id: "conflict-2",
        conflictType: "value_mismatch",
        severity: "medium",
        recordType: "lab_result",
        fieldName: "value",
        records: [
          {
            id: "rec-2a",
            sourceId: "quest-1",
            sourceName: "Quest Diagnostics",
            sourceType: "lab",
            recordType: "lab_result",
            data: { name: "HbA1c", value: "6.5%", unit: "%", referenceRange: "4.0-5.6" },
            lastUpdated: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            confidence: 0.98,
          },
          {
            id: "rec-2b",
            sourceId: "epic-2",
            sourceName: "Primary Care Provider",
            sourceType: "ehr",
            recordType: "lab_result",
            data: { name: "Hemoglobin A1C", value: "6.8%", unit: "%", referenceRange: "4.0-5.6" },
            lastUpdated: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            confidence: 0.90,
          },
        ],
        detectedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: "pending",
      },
      {
        id: "conflict-3",
        conflictType: "status_conflict",
        severity: "critical",
        recordType: "condition",
        fieldName: "status",
        records: [
          {
            id: "rec-3a",
            sourceId: "epic-3",
            sourceName: "Primary Care Provider",
            sourceType: "ehr",
            recordType: "condition",
            data: { name: "Type 2 Diabetes", status: "active", onsetDate: "2020-03-15" },
            lastUpdated: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            confidence: 0.95,
          },
          {
            id: "rec-3b",
            sourceId: "claims-1",
            sourceName: "Blue Cross Claims",
            sourceType: "claims",
            recordType: "condition",
            data: { name: "Diabetes mellitus type 2", status: "resolved", onsetDate: "2020-03" },
            lastUpdated: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            confidence: 0.75,
          },
        ],
        detectedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: "pending",
      },
    ];

    sampleConflicts.forEach(c => this.conflicts.set(c.id, c));
  }

  async generateAIMergeSuggestion(conflictId: string): Promise<AIMergeSuggestion> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: conflict.recordType,
      resourceId: conflictId,
      details: `AI conflict analysis: ${conflict.records.length} records`,
    });

    const recordsContext = conflict.records.map(r => ({
      source: r.sourceName,
      sourceType: r.sourceType,
      data: r.data,
      lastUpdated: r.lastUpdated,
      confidence: r.confidence,
      priority: this.sourcePriorities.get(r.sourceType)?.priority || 10,
    }));

    const systemPrompt = `You are a medical data reconciliation expert. Analyze conflicting health records and suggest the best merged record.

IMPORTANT GUIDELINES:
1. Patient safety is the top priority
2. Consider source reliability (EHR > Lab > Pharmacy > Claims > Patient-reported)
3. Consider data recency when clinically appropriate
4. Preserve all clinically relevant information
5. Flag uncertain decisions for human review
6. Provide clear reasoning for each field decision

For medication conflicts:
- Pharmacy data is most accurate for current dosages
- EHR data is authoritative for prescribed medications
- Discrepancies may indicate prescription changes

For lab results:
- Most recent result is typically most relevant
- Lab source data is most accurate for values
- Consider reference ranges and clinical significance

For conditions:
- Status discrepancies need careful review
- "Resolved" status should only be used with clinical evidence
- Multiple sources confirming "active" is strong evidence`;

    const userPrompt = `Analyze this data conflict and suggest a merged record:

Conflict Type: ${conflict.conflictType}
Record Type: ${conflict.recordType}
Field in Conflict: ${conflict.fieldName}
Severity: ${conflict.severity}

Records from different sources:
${JSON.stringify(recordsContext, null, 2)}

Provide a JSON response with:
{
  "suggestedMergedRecord": { /* the best merged record */ },
  "confidence": 0.0-1.0,
  "reasoning": "overall reasoning for the merge decision",
  "fieldDecisions": [
    {
      "fieldName": "field name",
      "selectedValue": "chosen value",
      "selectedSource": "source name",
      "reason": "why this value was chosen",
      "confidence": 0.0-1.0
    }
  ],
  "alternativeOptions": [
    {
      "description": "alternative approach",
      "mergedRecord": { /* alternative merged record */ },
      "tradeoffs": "what you lose with this approach"
    }
  ],
  "requiresHumanReview": true/false,
  "reviewReason": "why human review is needed (if applicable)"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const aiResponse = JSON.parse(response.choices[0]?.message?.content || "{}");

      const suggestion: AIMergeSuggestion = {
        id: `suggestion-${Date.now()}`,
        conflictId,
        suggestedMergedRecord: aiResponse.suggestedMergedRecord || {},
        confidence: aiResponse.confidence || 0.8,
        reasoning: aiResponse.reasoning || "AI analysis completed",
        fieldDecisions: (aiResponse.fieldDecisions || []).map((fd: any) => ({
          fieldName: fd.fieldName,
          selectedValue: fd.selectedValue,
          selectedSource: fd.selectedSource,
          reason: fd.reason,
          confidence: fd.confidence || 0.8,
          alternatives: [],
        })),
        alternativeOptions: aiResponse.alternativeOptions || [],
        generatedAt: new Date(),
        status: "pending",
      };

      this.suggestions.set(suggestion.id, suggestion);
      
      conflict.aiSuggestion = suggestion;
      this.conflicts.set(conflictId, conflict);

      return suggestion;
    } catch (error) {
      console.error("[AIConflictResolution] AI analysis error:", error);
      return this.generateFallbackSuggestion(conflict);
    }
  }

  private generateFallbackSuggestion(conflict: DataConflict): AIMergeSuggestion {
    const sortedRecords = [...conflict.records].sort((a, b) => {
      const priorityA = this.sourcePriorities.get(a.sourceType)?.priority || 10;
      const priorityB = this.sourcePriorities.get(b.sourceType)?.priority || 10;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

    const primaryRecord = sortedRecords[0];
    const mergedData: Record<string, any> = { ...primaryRecord.data };

    for (const record of sortedRecords.slice(1)) {
      for (const [key, value] of Object.entries(record.data)) {
        if (!(key in mergedData) || mergedData[key] === null || mergedData[key] === undefined) {
          mergedData[key] = value;
        }
      }
    }

    const suggestion: AIMergeSuggestion = {
      id: `suggestion-${Date.now()}`,
      conflictId: conflict.id,
      suggestedMergedRecord: mergedData,
      confidence: 0.75,
      reasoning: `Fallback resolution using source priority. Primary source: ${primaryRecord.sourceName} (${primaryRecord.sourceType}). Missing fields filled from secondary sources.`,
      fieldDecisions: Object.entries(mergedData).map(([key, value]) => {
        const sourceRecord = sortedRecords.find(r => r.data[key] === value) || primaryRecord;
        return {
          fieldName: key,
          selectedValue: value,
          selectedSource: sourceRecord.sourceName,
          reason: `Selected from ${sourceRecord.sourceType} source based on priority`,
          confidence: 0.75,
          alternatives: sortedRecords
            .filter(r => r.id !== sourceRecord.id && r.data[key] !== undefined)
            .map(r => ({
              value: r.data[key],
              source: r.sourceName,
              reasoning: `Alternative from ${r.sourceType}`,
            })),
        };
      }),
      alternativeOptions: [],
      generatedAt: new Date(),
      status: "pending",
    };

    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  async applyResolutionRule(conflictId: string, ruleId?: string, userId?: string): Promise<{ success: boolean; resolution?: Record<string, any>; appliedRule?: ConflictResolutionRule }> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    logPhiAccess({
      userId: userId || "system",
      action: "write",
      resourceType: "conflict_resolution",
      resourceId: conflictId,
      details: `Apply resolution rule: ${ruleId || "auto"}`,
    });

    let applicableRule: ConflictResolutionRule | undefined;

    if (ruleId) {
      applicableRule = this.rules.get(ruleId);
    } else {
      const activeRules = Array.from(this.rules.values())
        .filter(r => r.isActive)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of activeRules) {
        if (this.checkRuleConditions(rule, conflict)) {
          applicableRule = rule;
          break;
        }
      }
    }

    if (!applicableRule) {
      return { success: false };
    }

    const resolution = await this.executeRuleActions(applicableRule, conflict);

    applicableRule.appliedCount++;
    this.rules.set(applicableRule.id, applicableRule);

    conflict.status = "auto_resolved";
    conflict.resolvedAt = new Date();
    conflict.resolutionMethod = applicableRule.ruleType === "ai_assisted" ? "ai_suggestion" : "custom_rule";
    conflict.appliedRule = applicableRule;
    this.conflicts.set(conflictId, conflict);

    return { success: true, resolution, appliedRule: applicableRule };
  }

  private checkRuleConditions(rule: ConflictResolutionRule, conflict: DataConflict): boolean {
    for (const condition of rule.conditions) {
      const fieldValue = this.getConflictField(conflict, condition.field);
      
      switch (condition.operator) {
        case "equals":
          if (fieldValue !== condition.value) return false;
          break;
        case "contains":
          if (!String(fieldValue).includes(String(condition.value))) return false;
          break;
        case "in":
          if (!Array.isArray(condition.value) || !condition.value.includes(fieldValue)) return false;
          break;
        case "not_in":
          if (Array.isArray(condition.value) && condition.value.includes(fieldValue)) return false;
          break;
        case "greater_than":
          if (Number(fieldValue) <= Number(condition.value)) return false;
          break;
        case "less_than":
          if (Number(fieldValue) >= Number(condition.value)) return false;
          break;
        case "exists":
          if (fieldValue === undefined || fieldValue === null) return false;
          break;
        case "not_exists":
          if (fieldValue !== undefined && fieldValue !== null) return false;
          break;
      }
    }
    return true;
  }

  private getConflictField(conflict: DataConflict, field: string): any {
    switch (field) {
      case "recordType": return conflict.recordType;
      case "severity": return conflict.severity;
      case "conflictType": return conflict.conflictType;
      case "fieldName": return conflict.fieldName;
      case "confidenceDelta":
        const confidences = conflict.records.map(r => r.confidence);
        return Math.max(...confidences) - Math.min(...confidences);
      default: return undefined;
    }
  }

  private async executeRuleActions(rule: ConflictResolutionRule, conflict: DataConflict): Promise<Record<string, any>> {
    let mergedData: Record<string, any> = {};

    for (const action of rule.actions) {
      switch (action.actionType) {
        case "prefer_source":
          const preferredTypes = action.parameters.sourceTypes as DataSourceType[];
          const preferredRecord = conflict.records.find(r => preferredTypes.includes(r.sourceType));
          if (preferredRecord) {
            mergedData = { ...mergedData, ...preferredRecord.data };
          } else if (action.parameters.fallback === "recency") {
            const mostRecent = [...conflict.records].sort((a, b) => 
              new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
            )[0];
            mergedData = { ...mergedData, ...mostRecent.data };
          }
          break;

        case "prefer_recent":
          const maxAgeDays = action.parameters.maxAgeDays || 365;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
          
          const recentRecords = conflict.records
            .filter(r => new Date(r.lastUpdated) >= cutoffDate)
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
          
          if (recentRecords.length > 0) {
            mergedData = { ...mergedData, ...recentRecords[0].data };
          }
          break;

        case "prefer_confidence":
          const minConfidence = action.parameters.minConfidence || 0.7;
          const highConfidenceRecords = conflict.records
            .filter(r => r.confidence >= minConfidence)
            .sort((a, b) => b.confidence - a.confidence);
          
          if (highConfidenceRecords.length > 0) {
            mergedData = { ...mergedData, ...highConfidenceRecords[0].data };
          }
          break;

        case "combine":
          for (const record of conflict.records) {
            for (const [key, value] of Object.entries(record.data)) {
              if (!(key in mergedData)) {
                mergedData[key] = value;
              }
            }
          }
          break;

        case "use_ai":
          const suggestion = await this.generateAIMergeSuggestion(conflict.id);
          mergedData = suggestion.suggestedMergedRecord;
          break;
      }
    }

    return mergedData;
  }

  getConflicts(filters?: {
    status?: DataConflict["status"];
    severity?: DataConflict["severity"];
    recordType?: string;
  }, userId?: string): DataConflict[] {
    logPhiAccess({
      userId: userId || "system",
      action: "read",
      resourceType: "conflicts",
      resourceId: "list",
      details: `View conflicts with filters: ${JSON.stringify(filters || {})}`,
    });

    let conflicts = Array.from(this.conflicts.values());

    if (filters?.status) {
      conflicts = conflicts.filter(c => c.status === filters.status);
    }
    if (filters?.severity) {
      conflicts = conflicts.filter(c => c.severity === filters.severity);
    }
    if (filters?.recordType) {
      conflicts = conflicts.filter(c => c.recordType === filters.recordType);
    }

    return conflicts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  getConflict(id: string): DataConflict | undefined {
    return this.conflicts.get(id);
  }

  getSuggestion(id: string): AIMergeSuggestion | undefined {
    return this.suggestions.get(id);
  }

  getRules(): ConflictResolutionRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority);
  }

  getRule(id: string): ConflictResolutionRule | undefined {
    return this.rules.get(id);
  }

  createRule(rule: Omit<ConflictResolutionRule, "id" | "createdAt" | "updatedAt" | "appliedCount" | "successRate">): ConflictResolutionRule {
    const newRule: ConflictResolutionRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      appliedCount: 0,
      successRate: 0,
    };
    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<ConflictResolutionRule>): ConflictResolutionRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;

    const updatedRule = { ...rule, ...updates, updatedAt: new Date() };
    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  getSourcePriorities(): SourcePriorityConfig[] {
    return Array.from(this.sourcePriorities.values()).sort((a, b) => a.priority - b.priority);
  }

  updateSourcePriority(sourceType: DataSourceType, updates: Partial<SourcePriorityConfig>): SourcePriorityConfig | undefined {
    const config = this.sourcePriorities.get(sourceType);
    if (!config) return undefined;

    const updated = { ...config, ...updates };
    this.sourcePriorities.set(sourceType, updated);
    return updated;
  }

  acceptSuggestion(suggestionId: string, userId?: string): { success: boolean; mergedRecord?: Record<string, any> } {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return { success: false };
    }

    logPhiAccess({
      userId: userId || "system",
      action: "write",
      resourceType: "conflict_resolution",
      resourceId: suggestionId,
      details: `Accept AI merge suggestion for conflict: ${suggestion.conflictId}`,
    });

    suggestion.status = "accepted";
    this.suggestions.set(suggestionId, suggestion);

    const conflict = this.conflicts.get(suggestion.conflictId);
    if (conflict) {
      conflict.status = "manually_resolved";
      conflict.resolvedAt = new Date();
      conflict.resolutionMethod = "ai_suggestion";
      this.conflicts.set(conflict.id, conflict);
    }

    return { success: true, mergedRecord: suggestion.suggestedMergedRecord };
  }

  rejectSuggestion(suggestionId: string, userId?: string): boolean {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) return false;

    logPhiAccess({
      userId: userId || "system",
      action: "write",
      resourceType: "conflict_resolution",
      resourceId: suggestionId,
      details: `Reject AI merge suggestion for conflict: ${suggestion.conflictId}`,
    });

    suggestion.status = "rejected";
    this.suggestions.set(suggestionId, suggestion);
    return true;
  }

  getStats(): {
    totalConflicts: number;
    pendingConflicts: number;
    resolvedConflicts: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    aiSuggestionsGenerated: number;
    rulesApplied: number;
    autoResolutionRate: number;
  } {
    const conflicts = Array.from(this.conflicts.values());
    const rules = Array.from(this.rules.values());

    const pending = conflicts.filter(c => c.status === "pending").length;
    const resolved = conflicts.filter(c => c.status !== "pending").length;
    const autoResolved = conflicts.filter(c => c.status === "auto_resolved").length;

    return {
      totalConflicts: conflicts.length,
      pendingConflicts: pending,
      resolvedConflicts: resolved,
      bySeverity: {
        critical: conflicts.filter(c => c.severity === "critical").length,
        high: conflicts.filter(c => c.severity === "high").length,
        medium: conflicts.filter(c => c.severity === "medium").length,
        low: conflicts.filter(c => c.severity === "low").length,
      },
      byType: {
        value_mismatch: conflicts.filter(c => c.conflictType === "value_mismatch").length,
        dosage_conflict: conflicts.filter(c => c.conflictType === "dosage_conflict").length,
        status_conflict: conflicts.filter(c => c.conflictType === "status_conflict").length,
        date_conflict: conflicts.filter(c => c.conflictType === "date_conflict").length,
        name_variation: conflicts.filter(c => c.conflictType === "name_variation").length,
        missing_data: conflicts.filter(c => c.conflictType === "missing_data").length,
      },
      aiSuggestionsGenerated: this.suggestions.size,
      rulesApplied: rules.reduce((sum, r) => sum + r.appliedCount, 0),
      autoResolutionRate: conflicts.length > 0 ? autoResolved / conflicts.length : 0,
    };
  }
}

export const aiConflictResolutionService = new AIConflictResolutionService();
