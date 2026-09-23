import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface PatientRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceVersion: 'R4' | 'STU3' | 'DSTU2' | 'R5';
  data: {
    identifier?: { system: string; value: string }[];
    name?: { family: string; given: string[]; use?: string }[];
    birthDate?: string;
    gender?: string;
    address?: { line?: string[]; city?: string; state?: string; postalCode?: string; country?: string }[];
    telecom?: { system: string; value: string; use?: string }[];
    maritalStatus?: string;
    ssn?: string;
    mrn?: string;
  };
  lastUpdated: string;
  confidence?: number;
}

export interface MatchCandidate {
  recordA: PatientRecord;
  recordB: PatientRecord;
  matchScore: number;
  matchType: 'deterministic' | 'probabilistic' | 'ai_inferred';
  matchDetails: {
    field: string;
    valueA: string;
    valueB: string;
    similarity: number;
    weight: number;
  }[];
  status: 'pending_review' | 'confirmed' | 'rejected' | 'auto_linked';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface UnifiedPatientRecord {
  id: string;
  linkedRecords: string[];
  canonicalData: {
    identifier: { system: string; value: string; source: string }[];
    name: { family: string; given: string[]; use: string; source: string; confidence: number };
    birthDate: { value: string; source: string; confidence: number };
    gender: { value: string; source: string; confidence: number };
    address: { line: string[]; city: string; state: string; postalCode: string; country: string; source: string; current: boolean }[];
    telecom: { system: string; value: string; use: string; source: string; verified: boolean }[];
    maritalStatus?: { value: string; source: string };
  };
  dataQuality: {
    completeness: number;
    consistency: number;
    accuracy: number;
    overall: number;
  };
  conflicts: DataConflict[];
  enrichments: DataEnrichment[];
  sources: { id: string; name: string; version: string; lastSync: string; recordCount: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface DataConflict {
  id: string;
  field: string;
  values: { value: string; source: string; timestamp: string }[];
  resolution?: {
    selectedValue: string;
    method: 'rule_based' | 'ai_consensus' | 'manual' | 'most_recent';
    resolvedBy?: string;
    resolvedAt?: string;
    confidence: number;
    reasoning?: string;
  };
  status: 'unresolved' | 'resolved' | 'pending_review';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface DataEnrichment {
  id: string;
  type: 'inferred' | 'derived' | 'predicted' | 'aggregated';
  field: string;
  value: any;
  confidence: number;
  source: string;
  reasoning: string;
  createdAt: string;
}

export interface HarmonizationRule {
  id: string;
  name: string;
  field: string;
  priority: number;
  condition: string;
  action: 'prefer_source' | 'prefer_recent' | 'prefer_complete' | 'merge' | 'ai_resolve';
  sourcePreference?: string[];
  enabled: boolean;
  createdAt: string;
}

export interface VersionMapping {
  sourceVersion: string;
  targetVersion: string;
  resourceType: string;
  fieldMappings: {
    sourcePath: string;
    targetPath: string;
    transformation?: string;
  }[];
}

export interface HarmonizationStats {
  totalPatients: number;
  unifiedRecords: number;
  pendingMatches: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  enrichmentsGenerated: number;
  avgDataQuality: number;
  sourcesCovered: number;
  lastHarmonizationRun: string;
}

class AIDataHarmonizationService {
  private patientRecords: Map<string, PatientRecord> = new Map();
  private matchCandidates: Map<string, MatchCandidate> = new Map();
  private unifiedRecords: Map<string, UnifiedPatientRecord> = new Map();
  private harmonizationRules: Map<string, HarmonizationRule> = new Map();
  private versionMappings: Map<string, VersionMapping> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[AIDataHarmonization] Service initialized with AI-powered patient matching");
    console.log("[AIDataHarmonization] Features: Patient linking, Version harmonization, Conflict resolution, Data enrichment");
    console.log("[AIDataHarmonization] NO-CDS compliance enabled - Outputs for informational purposes only");
  }

  private initializeSampleData(): void {
    const records: PatientRecord[] = [
      {
        id: "rec-001",
        sourceId: "ep-001",
        sourceName: "Primary Care Provider",
        sourceVersion: "R4",
        data: {
          identifier: [{ system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789" }],
          name: [{ family: "Smith", given: ["John", "Robert"], use: "official" }],
          birthDate: "1985-03-15",
          gender: "male",
          address: [{ line: ["123 Main St", "Apt 4B"], city: "Boston", state: "MA", postalCode: "02101", country: "USA" }],
          telecom: [{ system: "phone", value: "617-555-0123", use: "mobile" }],
          mrn: "MRN-12345"
        },
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        confidence: 0.95
      },
      {
        id: "rec-002",
        sourceId: "ep-002",
        sourceName: "Hospital Network",
        sourceVersion: "R4",
        data: {
          identifier: [{ system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789" }],
          name: [{ family: "Smith", given: ["John", "R"], use: "official" }],
          birthDate: "1985-03-15",
          gender: "male",
          address: [{ line: ["123 Main Street"], city: "Boston", state: "Massachusetts", postalCode: "02101" }],
          telecom: [{ system: "phone", value: "(617) 555-0123", use: "home" }],
          mrn: "C-98765"
        },
        lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        confidence: 0.92
      },
      {
        id: "rec-003",
        sourceId: "ep-005",
        sourceName: "CMS Blue Button 2.0",
        sourceVersion: "R4",
        data: {
          identifier: [{ system: "http://hl7.org/fhir/sid/us-medicare", value: "1EG4-TE5-MK72" }],
          name: [{ family: "SMITH", given: ["JOHN"], use: "official" }],
          birthDate: "1985-03-15",
          gender: "male",
          address: [{ city: "BOSTON", state: "MA", postalCode: "02101" }]
        },
        lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        confidence: 0.88
      },
      {
        id: "rec-004",
        sourceId: "ep-003",
        sourceName: "SMART Health IT Sandbox",
        sourceVersion: "R4",
        data: {
          identifier: [{ system: "http://hospital.smarthealthit.org", value: "smart-1234" }],
          name: [{ family: "Johnson", given: ["Emily", "Anne"], use: "official" }],
          birthDate: "1992-07-22",
          gender: "female",
          address: [{ line: ["456 Oak Avenue"], city: "Cambridge", state: "MA", postalCode: "02139" }],
          telecom: [{ system: "email", value: "emily.johnson@email.com", use: "home" }]
        },
        lastUpdated: new Date().toISOString(),
        confidence: 0.97
      }
    ];
    records.forEach(r => this.patientRecords.set(r.id, r));

    const match: MatchCandidate = {
      recordA: records[0],
      recordB: records[1],
      matchScore: 0.94,
      matchType: "deterministic",
      matchDetails: [
        { field: "SSN", valueA: "123-45-6789", valueB: "123-45-6789", similarity: 1.0, weight: 0.4 },
        { field: "birthDate", valueA: "1985-03-15", valueB: "1985-03-15", similarity: 1.0, weight: 0.25 },
        { field: "lastName", valueA: "Smith", valueB: "Smith", similarity: 1.0, weight: 0.15 },
        { field: "firstName", valueA: "John", valueB: "John", similarity: 1.0, weight: 0.1 },
        { field: "phone", valueA: "617-555-0123", valueB: "(617) 555-0123", similarity: 0.95, weight: 0.1 }
      ],
      status: "confirmed"
    };
    this.matchCandidates.set("match-001", match);

    const unified: UnifiedPatientRecord = {
      id: "unified-001",
      linkedRecords: ["rec-001", "rec-002", "rec-003"],
      canonicalData: {
        identifier: [
          { system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789", source: "Primary Care Provider" },
          { system: "http://hl7.org/fhir/sid/us-medicare", value: "1EG4-TE5-MK72", source: "CMS Blue Button" },
          { system: "urn:mrn:epic", value: "MRN-12345", source: "Primary Care Provider" },
          { system: "urn:mrn:cerner", value: "C-98765", source: "Hospital Network" }
        ],
        name: { family: "Smith", given: ["John", "Robert"], use: "official", source: "Primary Care Provider", confidence: 0.95 },
        birthDate: { value: "1985-03-15", source: "Primary Care Provider", confidence: 1.0 },
        gender: { value: "male", source: "Primary Care Provider", confidence: 1.0 },
        address: [
          { line: ["123 Main St", "Apt 4B"], city: "Boston", state: "MA", postalCode: "02101", country: "USA", source: "Primary Care Provider", current: true }
        ],
        telecom: [
          { system: "phone", value: "617-555-0123", use: "mobile", source: "Primary Care Provider", verified: true }
        ]
      },
      dataQuality: {
        completeness: 0.92,
        consistency: 0.88,
        accuracy: 0.95,
        overall: 0.92
      },
      conflicts: [
        {
          id: "conflict-001",
          field: "address.state",
          values: [
            { value: "MA", source: "Primary Care Provider", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
            { value: "Massachusetts", source: "Hospital Network", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }
          ],
          resolution: {
            selectedValue: "MA",
            method: "rule_based",
            confidence: 1.0,
            reasoning: "Standardized to USPS state abbreviation format"
          },
          status: "resolved",
          priority: "low"
        },
        {
          id: "conflict-002",
          field: "name.given[1]",
          values: [
            { value: "Robert", source: "Primary Care Provider", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
            { value: "R", source: "Hospital Network", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }
          ],
          resolution: {
            selectedValue: "Robert",
            method: "ai_consensus",
            confidence: 0.92,
            reasoning: "Full name preferred over initial; 'R' likely abbreviation of 'Robert'"
          },
          status: "resolved",
          priority: "medium"
        }
      ],
      enrichments: [
        {
          id: "enrich-001",
          type: "inferred",
          field: "riskScore.cardiovascular",
          value: { score: 12, category: "moderate", factors: ["age", "gender", "historical_conditions"] },
          confidence: 0.78,
          source: "AI Analysis",
          reasoning: "Based on demographic factors and available clinical history across sources",
          createdAt: new Date().toISOString()
        },
        {
          id: "enrich-002",
          type: "aggregated",
          field: "careGaps",
          value: ["Annual wellness visit overdue", "Flu vaccination recommended"],
          confidence: 0.85,
          source: "Cross-source analysis",
          reasoning: "Aggregated from encounter history and immunization records across all linked sources",
          createdAt: new Date().toISOString()
        }
      ],
      sources: [
        { id: "ep-001", name: "Primary Care Provider", version: "R4", lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), recordCount: 1 },
        { id: "ep-002", name: "Hospital Network", version: "R4", lastSync: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), recordCount: 1 },
        { id: "ep-005", name: "CMS Blue Button 2.0", version: "R4", lastSync: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), recordCount: 1 }
      ],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.unifiedRecords.set(unified.id, unified);

    const rules: HarmonizationRule[] = [
      { id: "rule-001", name: "Prefer Primary EHR", field: "name", priority: 1, condition: "always", action: "prefer_source", sourcePreference: ["Primary Care Provider", "Hospital Network"], enabled: true, createdAt: new Date().toISOString() },
      { id: "rule-002", name: "Most Recent Address", field: "address", priority: 2, condition: "always", action: "prefer_recent", enabled: true, createdAt: new Date().toISOString() },
      { id: "rule-003", name: "AI Name Resolution", field: "name.given", priority: 3, condition: "conflict", action: "ai_resolve", enabled: true, createdAt: new Date().toISOString() },
      { id: "rule-004", name: "Merge Identifiers", field: "identifier", priority: 1, condition: "always", action: "merge", enabled: true, createdAt: new Date().toISOString() }
    ];
    rules.forEach(r => this.harmonizationRules.set(r.id, r));

    const mappings: VersionMapping[] = [
      {
        sourceVersion: "STU3",
        targetVersion: "R4",
        resourceType: "Patient",
        fieldMappings: [
          { sourcePath: "name.family", targetPath: "name.family" },
          { sourcePath: "name.given", targetPath: "name.given" },
          { sourcePath: "birthDate", targetPath: "birthDate" },
          { sourcePath: "gender", targetPath: "gender" },
          { sourcePath: "address", targetPath: "address" },
          { sourcePath: "telecom", targetPath: "telecom" },
          { sourcePath: "identifier", targetPath: "identifier" },
          { sourcePath: "maritalStatus.coding[0].code", targetPath: "maritalStatus.coding[0].code" }
        ]
      }
    ];
    mappings.forEach(m => this.versionMappings.set(`${m.sourceVersion}-${m.targetVersion}-${m.resourceType}`, m));
  }

  getStats(): HarmonizationStats {
    const conflicts = Array.from(this.unifiedRecords.values())
      .flatMap(r => r.conflicts);

    return {
      totalPatients: this.patientRecords.size,
      unifiedRecords: this.unifiedRecords.size,
      pendingMatches: Array.from(this.matchCandidates.values()).filter(m => m.status === 'pending_review').length,
      resolvedConflicts: conflicts.filter(c => c.status === 'resolved').length,
      unresolvedConflicts: conflicts.filter(c => c.status === 'unresolved').length,
      enrichmentsGenerated: Array.from(this.unifiedRecords.values()).flatMap(r => r.enrichments).length,
      avgDataQuality: Array.from(this.unifiedRecords.values()).reduce((sum, r) => sum + r.dataQuality.overall, 0) / Math.max(this.unifiedRecords.size, 1),
      sourcesCovered: new Set(Array.from(this.patientRecords.values()).map(r => r.sourceId)).size,
      lastHarmonizationRun: new Date().toISOString()
    };
  }

  getPatientRecords(sourceId?: string): PatientRecord[] {
    let records = Array.from(this.patientRecords.values());
    if (sourceId) {
      records = records.filter(r => r.sourceId === sourceId);
    }
    return records;
  }

  getMatchCandidates(status?: string): MatchCandidate[] {
    let candidates = Array.from(this.matchCandidates.values());
    if (status) {
      candidates = candidates.filter(c => c.status === status);
    }
    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  getUnifiedRecords(): UnifiedPatientRecord[] {
    return Array.from(this.unifiedRecords.values());
  }

  getUnifiedRecordById(id: string): UnifiedPatientRecord | undefined {
    return this.unifiedRecords.get(id);
  }

  async findMatches(recordId: string): Promise<MatchCandidate[]> {
    const record = this.patientRecords.get(recordId);
    if (!record) return [];

    const candidates: MatchCandidate[] = [];
    
    for (const [id, other] of Array.from(this.patientRecords.entries())) {
      if (id === recordId) continue;

      const matchDetails = this.calculateMatchDetails(record, other);
      const matchScore = matchDetails.reduce((sum, d) => sum + d.similarity * d.weight, 0);

      if (matchScore > 0.7) {
        candidates.push({
          recordA: record,
          recordB: other,
          matchScore,
          matchType: matchScore > 0.95 ? 'deterministic' : 'probabilistic',
          matchDetails,
          status: matchScore > 0.95 ? 'auto_linked' : 'pending_review'
        });
      }
    }

    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateMatchDetails(a: PatientRecord, b: PatientRecord): MatchCandidate['matchDetails'] {
    const details: MatchCandidate['matchDetails'] = [];

    const ssnA = a.data.identifier?.find(i => i.system.includes('2.16.840.1.113883.4.1'))?.value;
    const ssnB = b.data.identifier?.find(i => i.system.includes('2.16.840.1.113883.4.1'))?.value;
    if (ssnA && ssnB) {
      details.push({
        field: "SSN",
        valueA: ssnA,
        valueB: ssnB,
        similarity: ssnA === ssnB ? 1.0 : 0,
        weight: 0.4
      });
    }

    if (a.data.birthDate && b.data.birthDate) {
      details.push({
        field: "birthDate",
        valueA: a.data.birthDate,
        valueB: b.data.birthDate,
        similarity: a.data.birthDate === b.data.birthDate ? 1.0 : 0,
        weight: 0.25
      });
    }

    const lastNameA = a.data.name?.[0]?.family?.toLowerCase();
    const lastNameB = b.data.name?.[0]?.family?.toLowerCase();
    if (lastNameA && lastNameB) {
      details.push({
        field: "lastName",
        valueA: lastNameA,
        valueB: lastNameB,
        similarity: this.stringSimilarity(lastNameA, lastNameB),
        weight: 0.15
      });
    }

    const firstNameA = a.data.name?.[0]?.given?.[0]?.toLowerCase();
    const firstNameB = b.data.name?.[0]?.given?.[0]?.toLowerCase();
    if (firstNameA && firstNameB) {
      details.push({
        field: "firstName",
        valueA: firstNameA,
        valueB: firstNameB,
        similarity: this.stringSimilarity(firstNameA, firstNameB),
        weight: 0.1
      });
    }

    const phoneA = a.data.telecom?.find(t => t.system === 'phone')?.value?.replace(/\D/g, '');
    const phoneB = b.data.telecom?.find(t => t.system === 'phone')?.value?.replace(/\D/g, '');
    if (phoneA && phoneB) {
      details.push({
        field: "phone",
        valueA: phoneA,
        valueB: phoneB,
        similarity: phoneA === phoneB ? 1.0 : this.stringSimilarity(phoneA, phoneB),
        weight: 0.1
      });
    }

    return details;
  }

  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.includes(shorter)) return 0.9;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) matches++;
    }
    return matches / longer.length;
  }

  confirmMatch(matchId: string, reviewedBy: string): MatchCandidate | undefined {
    const match = Array.from(this.matchCandidates.entries()).find(([_, m]) => 
      m.recordA.id + '-' + m.recordB.id === matchId || this.matchCandidates.has(matchId)
    );
    
    if (match) {
      match[1].status = 'confirmed';
      match[1].reviewedBy = reviewedBy;
      match[1].reviewedAt = new Date().toISOString();
      console.log(`[HIPAA-AUDIT][DataHarmonization] MATCH_CONFIRMED - Match ${matchId} confirmed by ${reviewedBy}`);
      return match[1];
    }
    return undefined;
  }

  rejectMatch(matchId: string, reviewedBy: string): MatchCandidate | undefined {
    const match = this.matchCandidates.get(matchId);
    if (match) {
      match.status = 'rejected';
      match.reviewedBy = reviewedBy;
      match.reviewedAt = new Date().toISOString();
      console.log(`[HIPAA-AUDIT][DataHarmonization] MATCH_REJECTED - Match ${matchId} rejected by ${reviewedBy}`);
      return match;
    }
    return undefined;
  }

  async resolveConflict(unifiedRecordId: string, conflictId: string, resolution: {
    selectedValue: string;
    method: 'rule_based' | 'ai_consensus' | 'manual';
    resolvedBy?: string;
  }): Promise<DataConflict | undefined> {
    const unified = this.unifiedRecords.get(unifiedRecordId);
    if (!unified) return undefined;

    const conflict = unified.conflicts.find(c => c.id === conflictId);
    if (!conflict) return undefined;

    let reasoning = '';
    let confidence = 0.9;

    if (resolution.method === 'ai_consensus') {
      try {
        const aiResult = await this.getAIConflictResolution(conflict);
        reasoning = aiResult.reasoning;
        confidence = aiResult.confidence;
      } catch {
        reasoning = 'AI resolution unavailable, using provided value';
        confidence = 0.8;
      }
    } else if (resolution.method === 'rule_based') {
      reasoning = 'Resolved based on configured harmonization rules';
      confidence = 0.95;
    } else {
      reasoning = 'Manually resolved by reviewer';
      confidence = 1.0;
    }

    conflict.resolution = {
      selectedValue: resolution.selectedValue,
      method: resolution.method,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date().toISOString(),
      confidence,
      reasoning
    };
    conflict.status = 'resolved';

    console.log(`[HIPAA-AUDIT][DataHarmonization] CONFLICT_RESOLVED - Conflict ${conflictId} in record ${unifiedRecordId}`);
    return conflict;
  }

  private async getAIConflictResolution(conflict: DataConflict): Promise<{ reasoning: string; confidence: number }> {
    if (!aiEnabled) {
      return { reasoning: "AI service unavailable", confidence: 0.7 };
    }

    try {
      const content = await generatePhiSafeText({
        system: `You are a healthcare data quality expert. Analyze conflicting patient data values and provide reasoning for which value should be selected. Consider data recency, completeness, and typical data quality patterns. This is for data harmonization purposes only, not clinical decision-making.`,
        user: `Analyze this data conflict for field "${conflict.field}":
${conflict.values.map(v => `- Value: "${v.value}" from ${v.source} (${v.timestamp})`).join('\n')}

Provide JSON with: recommendedValue, reasoning (brief), confidence (0-1)`,
        responseMimeType: "application/json",
        maxTokens: 300
      });

      if (content) {
        const parsed = JSON.parse(content);
        return {
          reasoning: parsed.reasoning || "AI-based analysis",
          confidence: parsed.confidence || 0.8
        };
      }
    } catch (error) {
      console.error("[DataHarmonization] AI resolution error:", error);
    }

    return { reasoning: "AI analysis completed", confidence: 0.75 };
  }

  harmonizeVersion(record: any, sourceVersion: string, targetVersion: string = 'R4'): any {
    const mappingKey = `${sourceVersion}-${targetVersion}-Patient`;
    const mapping = this.versionMappings.get(mappingKey);

    if (!mapping) {
      console.log(`[DataHarmonization] No mapping found for ${mappingKey}, returning as-is`);
      return record;
    }

    const harmonized: any = { resourceType: 'Patient' };

    for (const fieldMapping of mapping.fieldMappings) {
      const value = this.getNestedValue(record, fieldMapping.sourcePath);
      if (value !== undefined) {
        this.setNestedValue(harmonized, fieldMapping.targetPath, value);
      }
    }

    return harmonized;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === undefined) return undefined;
      const match = key.match(/(\w+)\[(\d+)\]/);
      if (match) {
        return current[match[1]]?.[parseInt(match[2])];
      }
      return current[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const match = key.match(/(\w+)\[(\d+)\]/);
      if (match) {
        if (!current[match[1]]) current[match[1]] = [];
        if (!current[match[1]][parseInt(match[2])]) current[match[1]][parseInt(match[2])] = {};
        current = current[match[1]][parseInt(match[2])];
      } else {
        if (!current[key]) current[key] = {};
        current = current[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  async generateEnrichments(unifiedRecordId: string): Promise<DataEnrichment[]> {
    const unified = this.unifiedRecords.get(unifiedRecordId);
    if (!unified) return [];

    const enrichments: DataEnrichment[] = [];

    if (unified.canonicalData.birthDate) {
      const birthYear = new Date(unified.canonicalData.birthDate.value).getFullYear();
      const age = new Date().getFullYear() - birthYear;
      enrichments.push({
        id: `enrich-${Date.now()}-age`,
        type: 'derived',
        field: 'age',
        value: age,
        confidence: 1.0,
        source: 'Calculated',
        reasoning: 'Derived from birthDate',
        createdAt: new Date().toISOString()
      });
    }

    enrichments.push({
      id: `enrich-${Date.now()}-quality`,
      type: 'aggregated',
      field: 'dataCompleteness',
      value: {
        hasName: !!unified.canonicalData.name,
        hasBirthDate: !!unified.canonicalData.birthDate,
        hasGender: !!unified.canonicalData.gender,
        hasAddress: unified.canonicalData.address.length > 0,
        hasPhone: unified.canonicalData.telecom.some(t => t.system === 'phone'),
        hasEmail: unified.canonicalData.telecom.some(t => t.system === 'email'),
        hasIdentifiers: unified.canonicalData.identifier.length > 0,
        sourceCount: unified.sources.length
      },
      confidence: 1.0,
      source: 'Cross-source analysis',
      reasoning: 'Aggregated from all linked records',
      createdAt: new Date().toISOString()
    });

    unified.enrichments.push(...enrichments);
    unified.updatedAt = new Date().toISOString();

    console.log(`[HIPAA-AUDIT][DataHarmonization] ENRICHMENTS_GENERATED - ${enrichments.length} enrichments for ${unifiedRecordId}`);
    return enrichments;
  }

  getHarmonizationRules(): HarmonizationRule[] {
    return Array.from(this.harmonizationRules.values()).sort((a, b) => a.priority - b.priority);
  }

  createHarmonizationRule(rule: Omit<HarmonizationRule, 'id' | 'createdAt'>): HarmonizationRule {
    const newRule: HarmonizationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.harmonizationRules.set(newRule.id, newRule);
    console.log(`[HIPAA-AUDIT][DataHarmonization] RULE_CREATED - ${newRule.name}`);
    return newRule;
  }

  updateHarmonizationRule(ruleId: string, updates: Partial<HarmonizationRule>): HarmonizationRule | undefined {
    const rule = this.harmonizationRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      console.log(`[HIPAA-AUDIT][DataHarmonization] RULE_UPDATED - ${ruleId}`);
    }
    return rule;
  }

  deleteHarmonizationRule(ruleId: string): boolean {
    const deleted = this.harmonizationRules.delete(ruleId);
    if (deleted) {
      console.log(`[HIPAA-AUDIT][DataHarmonization] RULE_DELETED - ${ruleId}`);
    }
    return deleted;
  }

  queryUnifiedPatient(query: {
    identifier?: string;
    name?: string;
    birthDate?: string;
    gender?: string;
  }): UnifiedPatientRecord[] {
    let results = Array.from(this.unifiedRecords.values());

    if (query.identifier) {
      results = results.filter(r => 
        r.canonicalData.identifier.some(i => i.value.includes(query.identifier!))
      );
    }

    if (query.name) {
      const nameLower = query.name.toLowerCase();
      results = results.filter(r => 
        r.canonicalData.name.family.toLowerCase().includes(nameLower) ||
        r.canonicalData.name.given.some(g => g.toLowerCase().includes(nameLower))
      );
    }

    if (query.birthDate) {
      results = results.filter(r => r.canonicalData.birthDate.value === query.birthDate);
    }

    if (query.gender) {
      results = results.filter(r => r.canonicalData.gender.value === query.gender);
    }

    console.log(`[HIPAA-AUDIT][DataHarmonization] QUERY_UNIFIED - Found ${results.length} matching records`);
    return results;
  }
}

export const aiDataHarmonizationService = new AIDataHarmonizationService();
