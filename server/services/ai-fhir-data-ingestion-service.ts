import { generatePhiSafeText } from "./ai-gateway";

const NO_CDS_COMPLIANCE = "INFORMATIONAL ONLY - AI-generated content for data governance and operational purposes. Not intended for clinical decision-making.";

export interface ClinicalNote {
  id: string;
  patientId: string;
  noteType: 'doctor_note' | 'lab_report' | 'discharge_summary' | 'radiology_report' | 'pathology_report' | 'consultation_note';
  rawText: string;
  sourceSystem?: string;
  documentDate: string;
  createdAt: string;
}

export interface ExtractedEntity {
  type: 'condition' | 'medication' | 'procedure' | 'observation' | 'allergy' | 'vital_sign' | 'lab_result' | 'diagnosis';
  value: string;
  code?: string;
  codeSystem?: string;
  confidence: number;
  context?: string;
  sourceSpan?: { start: number; end: number };
}

export interface ParsedClinicalData {
  id: string;
  noteId: string;
  patientId: string;
  entities: ExtractedEntity[];
  summary: string;
  parseTimestamp: string;
  aiModel: string;
  confidence: number;
  processingTimeMs: number;
}

export interface FHIRMappingResult {
  id: string;
  parsedDataId: string;
  patientId: string;
  resourceType: string;
  fhirResource: Record<string, any>;
  terminology: {
    system: string;
    code: string;
    display: string;
  };
  mappingConfidence: number;
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessages: string[];
  createdAt: string;
}

export interface IngestionJob {
  id: string;
  status: 'pending' | 'parsing' | 'mapping' | 'validating' | 'completed' | 'failed';
  noteId: string;
  patientId: string;
  noteType: string;
  startTime: string;
  endTime?: string;
  progress: number;
  parsedDataId?: string;
  mappingResults?: string[];
  errors: string[];
  warnings: string[];
}

export interface QualityMetrics {
  totalIngested: number;
  successRate: number;
  avgConfidence: number;
  avgProcessingTime: number;
  issuesByCategory: Record<string, number>;
  recentTrends: {
    date: string;
    ingested: number;
    success: number;
    failed: number;
  }[];
}

export interface QualityIssue {
  id: string;
  jobId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'parsing_error' | 'mapping_failure' | 'validation_error' | 'terminology_mismatch' | 'missing_data' | 'duplicate_detection';
  description: string;
  affectedResource?: string;
  suggestedAction: string;
  status: 'open' | 'reviewing' | 'resolved' | 'ignored';
  createdAt: string;
  resolvedAt?: string;
}

class AIFHIRDataIngestionService {
  private clinicalNotes: Map<string, ClinicalNote> = new Map();
  private parsedData: Map<string, ParsedClinicalData> = new Map();
  private mappingResults: Map<string, FHIRMappingResult> = new Map();
  private ingestionJobs: Map<string, IngestionJob> = new Map();
  private qualityIssues: Map<string, QualityIssue> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log('[AIFHIRDataIngestion] Service initialized with AI-powered clinical note parsing');
    console.log('[AIFHIRDataIngestion] Features: Entity extraction, FHIR mapping, Quality monitoring');
    console.log('[AIFHIRDataIngestion] NO-CDS compliance enabled for all outputs');
  }

  private initializeSampleData() {
    const sampleNote: ClinicalNote = {
      id: 'note-1',
      patientId: 'patient-001',
      noteType: 'doctor_note',
      rawText: `Patient presents with persistent cough for 2 weeks. Temperature 101.2F. 
Blood pressure 130/85 mmHg. Heart rate 88 bpm. Respiratory rate 18/min.
Assessment: Acute bronchitis, likely viral etiology.
Plan: 
- Rest and fluids
- Acetaminophen 500mg PRN for fever
- Follow up in 1 week if symptoms persist
- Consider chest X-ray if worsening`,
      sourceSystem: 'Fasten Health',
      documentDate: '2026-01-25',
      createdAt: new Date().toISOString()
    };
    this.clinicalNotes.set(sampleNote.id, sampleNote);

    const sampleJob: IngestionJob = {
      id: 'job-1',
      status: 'completed',
      noteId: 'note-1',
      patientId: 'patient-001',
      noteType: 'doctor_note',
      startTime: new Date(Date.now() - 60000).toISOString(),
      endTime: new Date().toISOString(),
      progress: 100,
      parsedDataId: 'parsed-1',
      mappingResults: ['mapping-1', 'mapping-2', 'mapping-3'],
      errors: [],
      warnings: ['Low confidence on medication dosage extraction']
    };
    this.ingestionJobs.set(sampleJob.id, sampleJob);

    const sampleParsedData: ParsedClinicalData = {
      id: 'parsed-1',
      noteId: 'note-1',
      patientId: 'patient-001',
      entities: [
        { type: 'condition', value: 'Acute bronchitis', code: 'J20.9', codeSystem: 'ICD-10', confidence: 0.92, context: 'Assessment: Acute bronchitis' },
        { type: 'vital_sign', value: 'Temperature 101.2F', confidence: 0.98, context: 'Temperature 101.2F' },
        { type: 'vital_sign', value: 'Blood pressure 130/85 mmHg', confidence: 0.97, context: 'Blood pressure 130/85 mmHg' },
        { type: 'medication', value: 'Acetaminophen 500mg', code: '161', codeSystem: 'RxNorm', confidence: 0.85, context: 'Acetaminophen 500mg PRN for fever' }
      ],
      summary: 'Patient with 2-week cough, elevated temperature, diagnosed with acute bronchitis. Prescribed symptomatic treatment with follow-up.',
      parseTimestamp: new Date().toISOString(),
      aiModel: 'gpt-4o',
      confidence: 0.91,
      processingTimeMs: 2340
    };
    this.parsedData.set(sampleParsedData.id, sampleParsedData);

    const sampleIssue: QualityIssue = {
      id: 'issue-1',
      jobId: 'job-1',
      severity: 'medium',
      category: 'terminology_mismatch',
      description: 'Medication code confidence below threshold (0.85 < 0.90)',
      affectedResource: 'MedicationRequest',
      suggestedAction: 'Review medication mapping and verify RxNorm code',
      status: 'open',
      createdAt: new Date().toISOString()
    };
    this.qualityIssues.set(sampleIssue.id, sampleIssue);
  }

  async submitClinicalNote(note: Omit<ClinicalNote, 'id' | 'createdAt'>): Promise<{ note: ClinicalNote; job: IngestionJob }> {
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const clinicalNote: ClinicalNote = {
      ...note,
      id: noteId,
      createdAt: new Date().toISOString()
    };
    this.clinicalNotes.set(noteId, clinicalNote);

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const job: IngestionJob = {
      id: jobId,
      status: 'pending',
      noteId,
      patientId: note.patientId,
      noteType: note.noteType,
      startTime: new Date().toISOString(),
      progress: 0,
      errors: [],
      warnings: []
    };
    this.ingestionJobs.set(jobId, job);

    this.processIngestionJob(jobId);

    return { note: clinicalNote, job };
  }

  private async processIngestionJob(jobId: string): Promise<void> {
    const job = this.ingestionJobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'parsing';
      job.progress = 10;
      this.ingestionJobs.set(jobId, { ...job });

      const note = this.clinicalNotes.get(job.noteId);
      if (!note) {
        throw new Error('Clinical note not found');
      }

      const parsedData = await this.parseClinicaNote(note);
      job.parsedDataId = parsedData.id;
      job.progress = 40;
      job.status = 'mapping';
      this.ingestionJobs.set(jobId, { ...job });

      const mappings = await this.mapToFHIRResources(parsedData);
      job.mappingResults = mappings.map(m => m.id);
      job.progress = 70;
      job.status = 'validating';
      this.ingestionJobs.set(jobId, { ...job });

      await this.validateMappings(mappings, jobId);
      
      job.progress = 100;
      job.status = 'completed';
      job.endTime = new Date().toISOString();
      
      for (const mapping of mappings) {
        if (mapping.validationStatus === 'warning') {
          job.warnings.push(`${mapping.resourceType}: ${mapping.validationMessages.join(', ')}`);
        }
      }
      
      this.ingestionJobs.set(jobId, { ...job });

    } catch (error) {
      job.status = 'failed';
      job.errors.push(String(error));
      job.endTime = new Date().toISOString();
      this.ingestionJobs.set(jobId, { ...job });

      this.createQualityIssue({
        jobId,
        severity: 'high',
        category: 'parsing_error',
        description: `Ingestion failed: ${String(error)}`,
        suggestedAction: 'Review clinical note format and retry ingestion'
      });
    }
  }

  private async parseClinicaNote(note: ClinicalNote): Promise<ParsedClinicalData> {
    const startTime = Date.now();
    
    let entities: ExtractedEntity[] = [];
    let summary = '';
    let confidence = 0.85;

    try {
      const content = await generatePhiSafeText({
        system: `You are a clinical NLP system that extracts structured medical entities from clinical notes.
Extract the following entity types: conditions, medications, procedures, observations, allergies, vital signs, lab results, diagnoses.
For each entity, provide:
- type: one of condition, medication, procedure, observation, allergy, vital_sign, lab_result, diagnosis
- value: the extracted text
- code: medical code if identifiable (ICD-10, RxNorm, LOINC, CPT)
- codeSystem: the coding system used
- confidence: 0.0-1.0 score
- context: surrounding text for reference

Return a JSON object with:
{
  "entities": [...],
  "summary": "brief clinical summary",
  "overallConfidence": 0.0-1.0
}`,
        user: `Parse this ${note.noteType}:\n\n${note.rawText}`,
        responseMimeType: "application/json",
        temperature: 0.1,
      });

      if (content) {
        const parsed = JSON.parse(content);
        entities = parsed.entities || [];
        summary = parsed.summary || '';
        confidence = parsed.overallConfidence || 0.85;
      }
    } catch (error) {
      console.log('[AIFHIRDataIngestion] OpenAI parsing failed, using fallback extraction');
      entities = this.fallbackExtraction(note.rawText);
      summary = this.generateFallbackSummary(note.rawText);
      confidence = 0.7;
    }

    const processingTime = Date.now() - startTime;

    const parsedData: ParsedClinicalData = {
      id: `parsed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      noteId: note.id,
      patientId: note.patientId,
      entities,
      summary,
      parseTimestamp: new Date().toISOString(),
      aiModel: 'gpt-4o',
      confidence,
      processingTimeMs: processingTime
    };

    this.parsedData.set(parsedData.id, parsedData);
    return parsedData;
  }

  private fallbackExtraction(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    const tempMatch = text.match(/temperature\s+(\d+\.?\d*)\s*[°]?f/i);
    if (tempMatch) {
      entities.push({
        type: 'vital_sign',
        value: `Temperature ${tempMatch[1]}F`,
        code: '8310-5',
        codeSystem: 'LOINC',
        confidence: 0.95
      });
    }

    const bpMatch = text.match(/blood pressure\s+(\d+\/\d+)\s*mmhg/i);
    if (bpMatch) {
      entities.push({
        type: 'vital_sign',
        value: `Blood pressure ${bpMatch[1]} mmHg`,
        code: '85354-9',
        codeSystem: 'LOINC',
        confidence: 0.95
      });
    }

    const hrMatch = text.match(/heart rate\s+(\d+)\s*bpm/i);
    if (hrMatch) {
      entities.push({
        type: 'vital_sign',
        value: `Heart rate ${hrMatch[1]} bpm`,
        code: '8867-4',
        codeSystem: 'LOINC',
        confidence: 0.95
      });
    }

    const commonConditions = [
      { pattern: /acute bronchitis/i, code: 'J20.9', system: 'ICD-10' },
      { pattern: /hypertension/i, code: 'I10', system: 'ICD-10' },
      { pattern: /diabetes/i, code: 'E11.9', system: 'ICD-10' },
      { pattern: /pneumonia/i, code: 'J18.9', system: 'ICD-10' }
    ];

    for (const condition of commonConditions) {
      if (condition.pattern.test(text)) {
        const match = text.match(condition.pattern);
        entities.push({
          type: 'condition',
          value: match ? match[0] : '',
          code: condition.code,
          codeSystem: condition.system,
          confidence: 0.85
        });
      }
    }

    const medicationPattern = /(\w+(?:mycin|cillin|phen|pril|sartan|statin|olol|azole|profen|amine|amol))\s*(\d+\s*mg)?/gi;
    let medMatch;
    while ((medMatch = medicationPattern.exec(text)) !== null) {
      entities.push({
        type: 'medication',
        value: medMatch[0],
        codeSystem: 'RxNorm',
        confidence: 0.75
      });
    }

    return entities;
  }

  private generateFallbackSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length <= 2) {
      return text.substring(0, 200);
    }
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }

  private async mapToFHIRResources(parsedData: ParsedClinicalData): Promise<FHIRMappingResult[]> {
    const mappings: FHIRMappingResult[] = [];

    for (const entity of parsedData.entities) {
      const resourceType = this.getResourceTypeForEntity(entity.type);
      const fhirResource = this.createFHIRResource(entity, parsedData.patientId, resourceType);
      const terminology = this.mapToTerminology(entity);

      const mapping: FHIRMappingResult = {
        id: `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        parsedDataId: parsedData.id,
        patientId: parsedData.patientId,
        resourceType,
        fhirResource,
        terminology,
        mappingConfidence: entity.confidence,
        validationStatus: entity.confidence >= 0.9 ? 'valid' : entity.confidence >= 0.7 ? 'warning' : 'error',
        validationMessages: [],
        createdAt: new Date().toISOString()
      };

      if (mapping.validationStatus === 'warning') {
        mapping.validationMessages.push(`Confidence ${(entity.confidence * 100).toFixed(0)}% below optimal threshold`);
      }
      if (mapping.validationStatus === 'error') {
        mapping.validationMessages.push('Low confidence extraction - manual review required');
      }

      this.mappingResults.set(mapping.id, mapping);
      mappings.push(mapping);
    }

    return mappings;
  }

  private getResourceTypeForEntity(entityType: string): string {
    const mapping: Record<string, string> = {
      'condition': 'Condition',
      'diagnosis': 'Condition',
      'medication': 'MedicationRequest',
      'procedure': 'Procedure',
      'observation': 'Observation',
      'allergy': 'AllergyIntolerance',
      'vital_sign': 'Observation',
      'lab_result': 'Observation'
    };
    return mapping[entityType] || 'Observation';
  }

  private createFHIRResource(entity: ExtractedEntity, patientId: string, resourceType: string): Record<string, any> {
    const baseResource = {
      resourceType,
      id: `temp-${Date.now()}`,
      meta: {
        profile: [`http://hl7.org/fhir/StructureDefinition/${resourceType}`],
        lastUpdated: new Date().toISOString()
      },
      subject: {
        reference: `Patient/${patientId}`
      }
    };

    switch (resourceType) {
      case 'Condition':
        return {
          ...baseResource,
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
          },
          code: {
            coding: entity.code ? [{
              system: entity.codeSystem === 'ICD-10' ? 'http://hl7.org/fhir/sid/icd-10-cm' : 'http://snomed.info/sct',
              code: entity.code,
              display: entity.value
            }] : [],
            text: entity.value
          },
          recordedDate: new Date().toISOString()
        };

      case 'MedicationRequest':
        return {
          ...baseResource,
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: entity.code ? [{
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: entity.code,
              display: entity.value
            }] : [],
            text: entity.value
          },
          authoredOn: new Date().toISOString()
        };

      case 'Observation':
        return {
          ...baseResource,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: entity.type === 'vital_sign' ? 'vital-signs' : 'laboratory'
            }]
          }],
          code: {
            coding: entity.code ? [{
              system: entity.codeSystem === 'LOINC' ? 'http://loinc.org' : 'http://snomed.info/sct',
              code: entity.code,
              display: entity.value
            }] : [],
            text: entity.value
          },
          effectiveDateTime: new Date().toISOString()
        };

      default:
        return baseResource;
    }
  }

  private mapToTerminology(entity: ExtractedEntity): { system: string; code: string; display: string } {
    const systemMap: Record<string, string> = {
      'ICD-10': 'http://hl7.org/fhir/sid/icd-10-cm',
      'SNOMED': 'http://snomed.info/sct',
      'RxNorm': 'http://www.nlm.nih.gov/research/umls/rxnorm',
      'LOINC': 'http://loinc.org',
      'CPT': 'http://www.ama-assn.org/go/cpt'
    };

    return {
      system: entity.codeSystem ? (systemMap[entity.codeSystem] || entity.codeSystem) : 'http://snomed.info/sct',
      code: entity.code || 'unknown',
      display: entity.value
    };
  }

  private async validateMappings(mappings: FHIRMappingResult[], jobId: string): Promise<void> {
    for (const mapping of mappings) {
      if (mapping.validationStatus === 'error') {
        this.createQualityIssue({
          jobId,
          severity: 'high',
          category: 'validation_error',
          description: `${mapping.resourceType} validation failed: ${mapping.validationMessages.join(', ')}`,
          affectedResource: mapping.resourceType,
          suggestedAction: 'Review extracted entity and verify FHIR mapping'
        });
      } else if (mapping.validationStatus === 'warning' && mapping.mappingConfidence < 0.8) {
        this.createQualityIssue({
          jobId,
          severity: 'medium',
          category: 'terminology_mismatch',
          description: `Low confidence mapping for ${mapping.resourceType} (${(mapping.mappingConfidence * 100).toFixed(0)}%)`,
          affectedResource: mapping.resourceType,
          suggestedAction: 'Verify terminology code and mapping accuracy'
        });
      }
    }
  }

  private createQualityIssue(params: Omit<QualityIssue, 'id' | 'status' | 'createdAt'>): QualityIssue {
    const issue: QualityIssue = {
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ...params,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    this.qualityIssues.set(issue.id, issue);
    return issue;
  }

  getAllJobs(): IngestionJob[] {
    return Array.from(this.ingestionJobs.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  getJob(jobId: string): IngestionJob | undefined {
    return this.ingestionJobs.get(jobId);
  }

  getJobDetails(jobId: string): { job: IngestionJob; parsedData?: ParsedClinicalData; mappings: FHIRMappingResult[] } | undefined {
    const job = this.ingestionJobs.get(jobId);
    if (!job) return undefined;

    const parsedData = job.parsedDataId ? this.parsedData.get(job.parsedDataId) : undefined;
    const mappings = (job.mappingResults || [])
      .map(id => this.mappingResults.get(id))
      .filter((m): m is FHIRMappingResult => m !== undefined);

    return { job, parsedData, mappings };
  }

  getAllParsedData(): ParsedClinicalData[] {
    return Array.from(this.parsedData.values());
  }

  getAllMappings(): FHIRMappingResult[] {
    return Array.from(this.mappingResults.values());
  }

  getQualityIssues(status?: string): QualityIssue[] {
    let issues = Array.from(this.qualityIssues.values());
    if (status) {
      issues = issues.filter(i => i.status === status);
    }
    return issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  updateIssueStatus(issueId: string, status: QualityIssue['status']): QualityIssue | undefined {
    const issue = this.qualityIssues.get(issueId);
    if (!issue) return undefined;

    issue.status = status;
    if (status === 'resolved') {
      issue.resolvedAt = new Date().toISOString();
    }
    this.qualityIssues.set(issueId, issue);
    return issue;
  }

  getQualityMetrics(): QualityMetrics {
    const jobs = Array.from(this.ingestionJobs.values());
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed');
    const mappings = Array.from(this.mappingResults.values());
    const issues = Array.from(this.qualityIssues.values());

    const avgConfidence = mappings.length > 0
      ? mappings.reduce((sum, m) => sum + m.mappingConfidence, 0) / mappings.length
      : 0;

    const processingTimes = Array.from(this.parsedData.values()).map(p => p.processingTimeMs);
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    const issuesByCategory: Record<string, number> = {};
    for (const issue of issues) {
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
    }

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const recentTrends = last7Days.map(date => {
      const dayJobs = jobs.filter(j => j.startTime.startsWith(date));
      return {
        date,
        ingested: dayJobs.length,
        success: dayJobs.filter(j => j.status === 'completed').length,
        failed: dayJobs.filter(j => j.status === 'failed').length
      };
    });

    return {
      totalIngested: jobs.length,
      successRate: jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0,
      avgConfidence: avgConfidence * 100,
      avgProcessingTime,
      issuesByCategory,
      recentTrends
    };
  }

  async reprocessJob(jobId: string): Promise<IngestionJob | undefined> {
    const job = this.ingestionJobs.get(jobId);
    if (!job || job.status !== 'failed') return undefined;

    job.status = 'pending';
    job.progress = 0;
    job.errors = [];
    job.warnings = [];
    job.startTime = new Date().toISOString();
    job.endTime = undefined;
    this.ingestionJobs.set(jobId, job);

    this.processIngestionJob(jobId);
    return job;
  }

  getNoCdsCompliance(): string {
    return NO_CDS_COMPLIANCE;
  }
}

export const aiFHIRDataIngestionService = new AIFHIRDataIngestionService();
