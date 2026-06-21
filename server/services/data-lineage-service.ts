/**
 * Data Lineage Management Service
 * 
 * Tracks the source, transformations, and timestamps of all imported
 * health records. Provides full provenance chains, transformation
 * history, and data freshness analysis for HIPAA compliance and
 * data governance.
 */

import crypto from 'crypto';

export type SourceType =
  | 'ehr'
  | 'lab'
  | 'pharmacy'
  | 'wearable'
  | 'patient_portal'
  | 'fhir_network'
  | 'health_exchange'
  | 'imaging'
  | 'claims'
  | 'manual_entry';

export type TransformationType =
  | 'normalization'
  | 'deduplication'
  | 'enrichment'
  | 'validation'
  | 'format_conversion'
  | 'code_mapping'
  | 'anonymization';

export type ProvenanceAction =
  | 'created'
  | 'imported'
  | 'transformed'
  | 'verified'
  | 'merged'
  | 'exported'
  | 'accessed';

export interface LineageSource {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  networkName?: string;
  connectionMethod: string;
  fhirVersion?: string;
  originalFormat: string;
}

export interface DataTransformation {
  id: string;
  type: TransformationType;
  appliedAt: string;
  details: string;
  inputHash: string;
  outputHash: string;
  engine: string;
}

export interface ProvenanceEntry {
  id: string;
  action: ProvenanceAction;
  actor: string;
  timestamp: string;
  details: string;
  signature?: string;
}

export interface DataLineageRecord {
  id: string;
  recordId: string;
  resourceType: string;
  patientId: string;
  source: LineageSource;
  importTimestamp: string;
  lastUpdated: string;
  transformations: DataTransformation[];
  validationStatus: 'valid' | 'invalid' | 'pending' | 'warnings';
  provenanceChain: ProvenanceEntry[];
  currentVersion: number;
  previousVersionId: string | null;
}

export interface LineageSummary {
  totalRecords: number;
  bySource: Record<string, number>;
  byResourceType: Record<string, number>;
  byMonth: { month: string; count: number }[];
  averageTransformations: number;
  oldestRecord: string;
  newestRecord: string;
  dataFreshness: Record<string, { lastSync: string; staleDays: number }>;
}

class DataLineageService {
  private lineageRecords: Map<string, DataLineageRecord> = new Map();
  private patientIndex: Map<string, string[]> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const samplePatientId = 'patient-001';
    const records: DataLineageRecord[] = [
      {
        id: 'lin_001',
        recordId: 'rec_cond_hypertension',
        resourceType: 'Condition',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2025-03-15T10:30:00Z',
        lastUpdated: '2026-01-20T14:00:00Z',
        transformations: [
          { id: 'tx_001a', type: 'format_conversion', appliedAt: '2025-03-15T10:30:05Z', details: 'Converted from CDA R2 to FHIR R4 Condition resource', inputHash: 'a1b2c3d4', outputHash: 'e5f6g7h8', engine: 'CDA-to-FHIR Converter v3.2' },
          { id: 'tx_001b', type: 'code_mapping', appliedAt: '2025-03-15T10:30:08Z', details: 'Mapped ICD-10 code I10 to SNOMED CT 59621000', inputHash: 'e5f6g7h8', outputHash: 'i9j0k1l2', engine: 'UMLS Terminology Service' },
          { id: 'tx_001c', type: 'validation', appliedAt: '2025-03-15T10:30:10Z', details: 'Validated against US Core Condition profile', inputHash: 'i9j0k1l2', outputHash: 'i9j0k1l2', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_001a', action: 'created', actor: 'Dr. Sarah Chen, MD', timestamp: '2020-03-15T09:00:00Z', details: 'Initial diagnosis of essential hypertension', signature: 'sig_chen_2020' },
          { id: 'prov_001b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2025-03-15T10:30:00Z', details: 'Imported via Fasten Health Care Everywhere network' },
          { id: 'prov_001c', action: 'transformed', actor: 'CDA-to-FHIR Converter', timestamp: '2025-03-15T10:30:05Z', details: 'Format conversion and code mapping applied' },
          { id: 'prov_001d', action: 'verified', actor: 'FHIR Validation Engine', timestamp: '2025-03-15T10:30:10Z', details: 'Passed US Core profile validation' }
        ],
        currentVersion: 3,
        previousVersionId: 'lin_001_v2'
      },
      {
        id: 'lin_002',
        recordId: 'rec_cond_diabetes',
        resourceType: 'Condition',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2025-03-15T10:30:00Z',
        lastUpdated: '2026-01-15T11:00:00Z',
        transformations: [
          { id: 'tx_002a', type: 'validation', appliedAt: '2025-03-15T10:30:12Z', details: 'Validated against US Core Condition profile', inputHash: 'm3n4o5p6', outputHash: 'm3n4o5p6', engine: 'FHIR Validator v5.6' },
          { id: 'tx_002b', type: 'enrichment', appliedAt: '2025-03-15T10:30:15Z', details: 'Added HbA1c reference from linked lab results', inputHash: 'm3n4o5p6', outputHash: 'q7r8s9t0', engine: 'Clinical Enrichment Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_002a', action: 'created', actor: 'Dr. James Wilson, MD', timestamp: '2019-06-20T14:00:00Z', details: 'Diagnosis of Type 2 Diabetes Mellitus' },
          { id: 'prov_002b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2025-03-15T10:30:00Z', details: 'Imported via Fasten Health Care Everywhere' },
          { id: 'prov_002c', action: 'verified', actor: 'FHIR Validation Engine', timestamp: '2025-03-15T10:30:12Z', details: 'Passed validation' }
        ],
        currentVersion: 2,
        previousVersionId: 'lin_002_v1'
      },
      {
        id: 'lin_003',
        recordId: 'rec_lab_hba1c_001',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'quest_diag_001',
          sourceName: 'Quest Diagnostics',
          sourceType: 'lab',
          connectionMethod: 'Direct Secure Messaging',
          fhirVersion: 'R4',
          originalFormat: 'HL7 v2 ORU'
        },
        importTimestamp: '2026-01-15T08:00:00Z',
        lastUpdated: '2026-01-15T08:05:00Z',
        transformations: [
          { id: 'tx_003a', type: 'format_conversion', appliedAt: '2026-01-15T08:00:02Z', details: 'Converted HL7 v2 ORU to FHIR R4 Observation', inputHash: 'u1v2w3x4', outputHash: 'y5z6a7b8', engine: 'HL7v2-to-FHIR Mapper v2.1' },
          { id: 'tx_003b', type: 'code_mapping', appliedAt: '2026-01-15T08:00:04Z', details: 'Mapped local code QD-HBA1C to LOINC 4548-4', inputHash: 'y5z6a7b8', outputHash: 'c9d0e1f2', engine: 'LOINC Mapping Service' },
          { id: 'tx_003c', type: 'normalization', appliedAt: '2026-01-15T08:00:06Z', details: 'Normalized units to standard UCUM format', inputHash: 'c9d0e1f2', outputHash: 'g3h4i5j6', engine: 'UCUM Unit Normalizer' },
          { id: 'tx_003d', type: 'validation', appliedAt: '2026-01-15T08:00:08Z', details: 'Validated against US Core Laboratory Result profile', inputHash: 'g3h4i5j6', outputHash: 'g3h4i5j6', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_003a', action: 'created', actor: 'Quest Diagnostics Lab System', timestamp: '2026-01-14T16:30:00Z', details: 'Lab result generated - HbA1c 7.2%' },
          { id: 'prov_003b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2026-01-15T08:00:00Z', details: 'Received via Direct Secure Messaging' },
          { id: 'prov_003c', action: 'transformed', actor: 'Data Pipeline', timestamp: '2026-01-15T08:00:08Z', details: 'Format conversion, code mapping, and normalization applied' },
          { id: 'prov_003d', action: 'verified', actor: 'FHIR Validation Engine', timestamp: '2026-01-15T08:00:08Z', details: 'Passed US Core Lab Result profile validation' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_004',
        recordId: 'rec_lab_creatinine_001',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'quest_diag_001',
          sourceName: 'Quest Diagnostics',
          sourceType: 'lab',
          connectionMethod: 'Direct Secure Messaging',
          fhirVersion: 'R4',
          originalFormat: 'HL7 v2 ORU'
        },
        importTimestamp: '2026-01-15T08:00:00Z',
        lastUpdated: '2026-01-15T08:05:00Z',
        transformations: [
          { id: 'tx_004a', type: 'format_conversion', appliedAt: '2026-01-15T08:00:02Z', details: 'Converted HL7 v2 ORU to FHIR R4 Observation', inputHash: 'k7l8m9n0', outputHash: 'o1p2q3r4', engine: 'HL7v2-to-FHIR Mapper v2.1' },
          { id: 'tx_004b', type: 'normalization', appliedAt: '2026-01-15T08:00:05Z', details: 'Normalized creatinine value to mg/dL', inputHash: 'o1p2q3r4', outputHash: 's5t6u7v8', engine: 'UCUM Unit Normalizer' },
          { id: 'tx_004c', type: 'validation', appliedAt: '2026-01-15T08:00:07Z', details: 'Validated against US Core Laboratory Result profile', inputHash: 's5t6u7v8', outputHash: 's5t6u7v8', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_004a', action: 'created', actor: 'Quest Diagnostics Lab System', timestamp: '2026-01-14T16:30:00Z', details: 'Lab result generated - Serum Creatinine 1.3 mg/dL' },
          { id: 'prov_004b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2026-01-15T08:00:00Z', details: 'Received via Direct Secure Messaging' },
          { id: 'prov_004c', action: 'verified', actor: 'FHIR Validation Engine', timestamp: '2026-01-15T08:00:07Z', details: 'Passed validation' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_005',
        recordId: 'rec_med_lisinopril',
        resourceType: 'MedicationRequest',
        patientId: samplePatientId,
        source: {
          sourceId: 'cvs_pharmacy_001',
          sourceName: 'CVS Pharmacy',
          sourceType: 'pharmacy',
          networkName: 'Surescripts',
          connectionMethod: 'NCPDP SCRIPT',
          originalFormat: 'NCPDP SCRIPT 2017071'
        },
        importTimestamp: '2025-04-01T12:00:00Z',
        lastUpdated: '2026-02-01T09:00:00Z',
        transformations: [
          { id: 'tx_005a', type: 'format_conversion', appliedAt: '2025-04-01T12:00:03Z', details: 'Converted NCPDP SCRIPT to FHIR R4 MedicationRequest', inputHash: 'w9x0y1z2', outputHash: 'a3b4c5d6', engine: 'NCPDP-to-FHIR Converter v1.4' },
          { id: 'tx_005b', type: 'code_mapping', appliedAt: '2025-04-01T12:00:05Z', details: 'Mapped NDC 00093-7339-98 to RxNorm 197884', inputHash: 'a3b4c5d6', outputHash: 'e7f8g9h0', engine: 'RxNorm Mapping Service' },
          { id: 'tx_005c', type: 'deduplication', appliedAt: '2025-04-01T12:00:07Z', details: 'Checked against existing medication records - no duplicates', inputHash: 'e7f8g9h0', outputHash: 'e7f8g9h0', engine: 'Dedup Engine v2.0' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_005a', action: 'created', actor: 'Dr. Sarah Chen, MD', timestamp: '2020-03-20T10:00:00Z', details: 'Prescribed Lisinopril 20mg daily for hypertension' },
          { id: 'prov_005b', action: 'imported', actor: 'Surescripts Network', timestamp: '2025-04-01T12:00:00Z', details: 'Medication history imported via Surescripts' },
          { id: 'prov_005c', action: 'transformed', actor: 'Data Pipeline', timestamp: '2025-04-01T12:00:07Z', details: 'Format conversion and code mapping applied' }
        ],
        currentVersion: 4,
        previousVersionId: 'lin_005_v3'
      },
      {
        id: 'lin_006',
        recordId: 'rec_med_metformin',
        resourceType: 'MedicationRequest',
        patientId: samplePatientId,
        source: {
          sourceId: 'cvs_pharmacy_001',
          sourceName: 'CVS Pharmacy',
          sourceType: 'pharmacy',
          networkName: 'Surescripts',
          connectionMethod: 'NCPDP SCRIPT',
          originalFormat: 'NCPDP SCRIPT 2017071'
        },
        importTimestamp: '2025-04-01T12:00:00Z',
        lastUpdated: '2026-02-01T09:00:00Z',
        transformations: [
          { id: 'tx_006a', type: 'format_conversion', appliedAt: '2025-04-01T12:00:03Z', details: 'Converted NCPDP SCRIPT to FHIR R4 MedicationRequest', inputHash: 'i1j2k3l4', outputHash: 'm5n6o7p8', engine: 'NCPDP-to-FHIR Converter v1.4' },
          { id: 'tx_006b', type: 'code_mapping', appliedAt: '2025-04-01T12:00:05Z', details: 'Mapped NDC to RxNorm 861007', inputHash: 'm5n6o7p8', outputHash: 'q9r0s1t2', engine: 'RxNorm Mapping Service' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_006a', action: 'created', actor: 'Dr. James Wilson, MD', timestamp: '2019-06-25T11:00:00Z', details: 'Prescribed Metformin 1000mg twice daily' },
          { id: 'prov_006b', action: 'imported', actor: 'Surescripts Network', timestamp: '2025-04-01T12:00:00Z', details: 'Medication history imported via Surescripts' }
        ],
        currentVersion: 3,
        previousVersionId: 'lin_006_v2'
      },
      {
        id: 'lin_007',
        recordId: 'rec_vitals_hr_apple',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'apple_health_001',
          sourceName: 'Apple Health',
          sourceType: 'wearable',
          connectionMethod: 'HealthKit API',
          originalFormat: 'HealthKit JSON'
        },
        importTimestamp: '2026-02-06T07:30:00Z',
        lastUpdated: '2026-02-06T07:30:00Z',
        transformations: [
          { id: 'tx_007a', type: 'format_conversion', appliedAt: '2026-02-06T07:30:02Z', details: 'Converted HealthKit heart rate samples to FHIR Observation', inputHash: 'u3v4w5x6', outputHash: 'y7z8a9b0', engine: 'HealthKit-to-FHIR Adapter v1.2' },
          { id: 'tx_007b', type: 'normalization', appliedAt: '2026-02-06T07:30:03Z', details: 'Aggregated 5-second samples into 1-minute averages', inputHash: 'y7z8a9b0', outputHash: 'c1d2e3f4', engine: 'Vitals Aggregation Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_007a', action: 'created', actor: 'Apple Watch Series 9', timestamp: '2026-02-06T07:00:00Z', details: 'Heart rate measurement recorded' },
          { id: 'prov_007b', action: 'imported', actor: 'Wearable Data Connector', timestamp: '2026-02-06T07:30:00Z', details: 'Synced from Apple Health via HealthKit' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_008',
        recordId: 'rec_vitals_sleep_oura',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'oura_ring_001',
          sourceName: 'Oura Ring',
          sourceType: 'wearable',
          connectionMethod: 'Oura Cloud API',
          originalFormat: 'Oura JSON'
        },
        importTimestamp: '2026-02-06T06:00:00Z',
        lastUpdated: '2026-02-06T06:00:00Z',
        transformations: [
          { id: 'tx_008a', type: 'format_conversion', appliedAt: '2026-02-06T06:00:02Z', details: 'Converted Oura sleep data to FHIR Observation', inputHash: 'g5h6i7j8', outputHash: 'k9l0m1n2', engine: 'Oura-to-FHIR Adapter v1.0' },
          { id: 'tx_008b', type: 'enrichment', appliedAt: '2026-02-06T06:00:04Z', details: 'Added sleep stage classifications per AASM standards', inputHash: 'k9l0m1n2', outputHash: 'o3p4q5r6', engine: 'Sleep Classification Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_008a', action: 'created', actor: 'Oura Ring Gen 3', timestamp: '2026-02-06T06:47:00Z', details: 'Sleep session completed and scored' },
          { id: 'prov_008b', action: 'imported', actor: 'Wearable Data Connector', timestamp: '2026-02-06T06:00:00Z', details: 'Synced from Oura Cloud API' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_009',
        recordId: 'rec_allergy_penicillin',
        resourceType: 'AllergyIntolerance',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2025-03-15T10:30:00Z',
        lastUpdated: '2025-03-15T10:35:00Z',
        transformations: [
          { id: 'tx_009a', type: 'validation', appliedAt: '2025-03-15T10:30:15Z', details: 'Validated against US Core AllergyIntolerance profile', inputHash: 's7t8u9v0', outputHash: 's7t8u9v0', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_009a', action: 'created', actor: 'Dr. Maria Rodriguez, MD', timestamp: '2015-05-10T09:00:00Z', details: 'Documented penicillin allergy - rash reaction' },
          { id: 'prov_009b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2025-03-15T10:30:00Z', details: 'Imported from Fasten Health EHR' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_010',
        recordId: 'rec_imm_covid_booster',
        resourceType: 'Immunization',
        patientId: samplePatientId,
        source: {
          sourceId: 'iis_state_001',
          sourceName: 'State Immunization Information System',
          sourceType: 'health_exchange',
          networkName: 'CDC IIS',
          connectionMethod: 'HL7 VXU',
          originalFormat: 'HL7 v2.5.1 VXU'
        },
        importTimestamp: '2025-10-15T14:00:00Z',
        lastUpdated: '2025-10-15T14:05:00Z',
        transformations: [
          { id: 'tx_010a', type: 'format_conversion', appliedAt: '2025-10-15T14:00:02Z', details: 'Converted HL7 VXU to FHIR R4 Immunization', inputHash: 'w1x2y3z4', outputHash: 'a5b6c7d8', engine: 'HL7v2-to-FHIR Mapper v2.1' },
          { id: 'tx_010b', type: 'code_mapping', appliedAt: '2025-10-15T14:00:04Z', details: 'Mapped CVX code 308 to SNOMED CT 1119349007', inputHash: 'a5b6c7d8', outputHash: 'e9f0g1h2', engine: 'CVX-SNOMED Mapping Service' },
          { id: 'tx_010c', type: 'deduplication', appliedAt: '2025-10-15T14:00:06Z', details: 'Cross-referenced with existing immunization records', inputHash: 'e9f0g1h2', outputHash: 'e9f0g1h2', engine: 'Dedup Engine v2.0' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_010a', action: 'created', actor: 'CVS MinuteClinic', timestamp: '2025-10-10T11:30:00Z', details: 'COVID-19 booster administered' },
          { id: 'prov_010b', action: 'imported', actor: 'IIS Integration', timestamp: '2025-10-15T14:00:00Z', details: 'Received from State IIS via HL7 VXU' },
          { id: 'prov_010c', action: 'transformed', actor: 'Data Pipeline', timestamp: '2025-10-15T14:00:06Z', details: 'Converted, mapped, and deduplicated' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_011',
        recordId: 'rec_encounter_annual',
        resourceType: 'Encounter',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2026-01-20T16:00:00Z',
        lastUpdated: '2026-01-20T16:05:00Z',
        transformations: [
          { id: 'tx_011a', type: 'validation', appliedAt: '2026-01-20T16:00:03Z', details: 'Validated against US Core Encounter profile', inputHash: 'i3j4k5l6', outputHash: 'i3j4k5l6', engine: 'FHIR Validator v5.6' },
          { id: 'tx_011b', type: 'enrichment', appliedAt: '2026-01-20T16:00:05Z', details: 'Linked encounter to related conditions and observations', inputHash: 'i3j4k5l6', outputHash: 'm7n8o9p0', engine: 'Record Linking Engine v1.3' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_011a', action: 'created', actor: 'Regional Medical Center', timestamp: '2026-01-18T09:00:00Z', details: 'Annual physical exam encounter' },
          { id: 'prov_011b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2026-01-20T16:00:00Z', details: 'Imported from Fasten Health EHR' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_012',
        recordId: 'rec_careplan_diabetes',
        resourceType: 'CarePlan',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2025-07-01T10:00:00Z',
        lastUpdated: '2026-01-20T14:30:00Z',
        transformations: [
          { id: 'tx_012a', type: 'validation', appliedAt: '2025-07-01T10:00:05Z', details: 'Validated against US Core CarePlan profile', inputHash: 'q1r2s3t4', outputHash: 'q1r2s3t4', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_012a', action: 'created', actor: 'Dr. James Wilson, MD', timestamp: '2019-07-01T10:00:00Z', details: 'Diabetes management care plan created' },
          { id: 'prov_012b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2025-07-01T10:00:00Z', details: 'Imported from Fasten Health EHR' },
          { id: 'prov_012c', action: 'merged', actor: 'Record Reconciliation Engine', timestamp: '2026-01-20T14:30:00Z', details: 'Merged updates from latest encounter' }
        ],
        currentVersion: 5,
        previousVersionId: 'lin_012_v4'
      },
      {
        id: 'lin_013',
        recordId: 'rec_imaging_chest_xray',
        resourceType: 'DiagnosticReport',
        patientId: samplePatientId,
        source: {
          sourceId: 'radiology_assoc_001',
          sourceName: 'Advanced Radiology Associates',
          sourceType: 'imaging',
          connectionMethod: 'DICOM/WADO-RS',
          originalFormat: 'DICOM SR'
        },
        importTimestamp: '2025-12-10T15:00:00Z',
        lastUpdated: '2025-12-10T15:10:00Z',
        transformations: [
          { id: 'tx_013a', type: 'format_conversion', appliedAt: '2025-12-10T15:00:03Z', details: 'Converted DICOM SR to FHIR DiagnosticReport', inputHash: 'u5v6w7x8', outputHash: 'y9z0a1b2', engine: 'DICOM-to-FHIR Converter v2.0' },
          { id: 'tx_013b', type: 'enrichment', appliedAt: '2025-12-10T15:00:06Z', details: 'Extracted structured findings from narrative report', inputHash: 'y9z0a1b2', outputHash: 'c3d4e5f6', engine: 'Clinical NLP Engine v3.1' },
          { id: 'tx_013c', type: 'validation', appliedAt: '2025-12-10T15:00:08Z', details: 'Validated against US Core DiagnosticReport profile', inputHash: 'c3d4e5f6', outputHash: 'c3d4e5f6', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_013a', action: 'created', actor: 'Dr. Robert Kim, MD (Radiologist)', timestamp: '2025-12-09T14:00:00Z', details: 'Chest X-ray interpreted - no acute findings' },
          { id: 'prov_013b', action: 'imported', actor: 'Imaging Integration', timestamp: '2025-12-10T15:00:00Z', details: 'Received via DICOM/WADO-RS' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_014',
        recordId: 'rec_claims_eob_001',
        resourceType: 'ExplanationOfBenefit',
        patientId: samplePatientId,
        source: {
          sourceId: 'bcbs_claims_001',
          sourceName: 'Blue Cross Blue Shield',
          sourceType: 'claims',
          networkName: 'CARIN Blue Button',
          connectionMethod: 'CARIN IG for Blue Button',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON (CARIN BB)'
        },
        importTimestamp: '2026-02-01T09:00:00Z',
        lastUpdated: '2026-02-01T09:05:00Z',
        transformations: [
          { id: 'tx_014a', type: 'validation', appliedAt: '2026-02-01T09:00:03Z', details: 'Validated against CARIN Blue Button ExplanationOfBenefit profile', inputHash: 'g7h8i9j0', outputHash: 'g7h8i9j0', engine: 'FHIR Validator v5.6' },
          { id: 'tx_014b', type: 'anonymization', appliedAt: '2026-02-01T09:00:05Z', details: 'Redacted provider TIN from display fields', inputHash: 'g7h8i9j0', outputHash: 'k1l2m3n4', engine: 'PHI Redaction Engine v1.1' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_014a', action: 'created', actor: 'BCBS Claims Processing', timestamp: '2026-01-25T12:00:00Z', details: 'EOB generated for annual physical exam' },
          { id: 'prov_014b', action: 'imported', actor: 'CARIN Blue Button Connector', timestamp: '2026-02-01T09:00:00Z', details: 'Retrieved via patient-directed CARIN BB access' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_015',
        recordId: 'rec_cq_ccd_001',
        resourceType: 'DocumentReference',
        patientId: samplePatientId,
        source: {
          sourceId: 'carequality_001',
          sourceName: 'Carequality Network',
          sourceType: 'fhir_network',
          networkName: 'Carequality',
          connectionMethod: 'IHE XCA',
          fhirVersion: 'R4',
          originalFormat: 'CDA R2 CCD'
        },
        importTimestamp: '2025-11-20T13:00:00Z',
        lastUpdated: '2025-11-20T13:10:00Z',
        transformations: [
          { id: 'tx_015a', type: 'format_conversion', appliedAt: '2025-11-20T13:00:03Z', details: 'Converted CDA CCD to FHIR R4 resources', inputHash: 'o5p6q7r8', outputHash: 's9t0u1v2', engine: 'CDA-to-FHIR Converter v3.2' },
          { id: 'tx_015b', type: 'deduplication', appliedAt: '2025-11-20T13:00:06Z', details: 'Cross-referenced 12 resources - 3 duplicates identified and merged', inputHash: 's9t0u1v2', outputHash: 'w3x4y5z6', engine: 'Dedup Engine v2.0' },
          { id: 'tx_015c', type: 'validation', appliedAt: '2025-11-20T13:00:08Z', details: 'Validated converted resources against US Core profiles', inputHash: 'w3x4y5z6', outputHash: 'w3x4y5z6', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'warnings',
        provenanceChain: [
          { id: 'prov_015a', action: 'created', actor: 'Community Health Partners', timestamp: '2025-11-15T10:00:00Z', details: 'CCD generated from urgent care visit' },
          { id: 'prov_015b', action: 'imported', actor: 'Carequality IHE Gateway', timestamp: '2025-11-20T13:00:00Z', details: 'Retrieved via Carequality cross-community access' },
          { id: 'prov_015c', action: 'transformed', actor: 'Data Pipeline', timestamp: '2025-11-20T13:00:08Z', details: 'Converted, deduplicated, and validated' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_016',
        recordId: 'rec_procedure_ecg',
        resourceType: 'Procedure',
        patientId: samplePatientId,
        source: {
          sourceId: 'epic_ehr_001',
          sourceName: 'Fasten Health EHR - Regional Medical Center',
          sourceType: 'ehr',
          networkName: 'Epic Care Everywhere',
          connectionMethod: 'SMART on FHIR',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2026-01-20T16:00:00Z',
        lastUpdated: '2026-01-20T16:05:00Z',
        transformations: [
          { id: 'tx_016a', type: 'validation', appliedAt: '2026-01-20T16:00:03Z', details: 'Validated against US Core Procedure profile', inputHash: 'a7b8c9d0', outputHash: 'a7b8c9d0', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_016a', action: 'created', actor: 'Regional Medical Center', timestamp: '2026-01-18T09:30:00Z', details: 'ECG performed during annual physical' },
          { id: 'prov_016b', action: 'imported', actor: 'Tabula Medica Import Engine', timestamp: '2026-01-20T16:00:00Z', details: 'Imported from Fasten Health EHR' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_017',
        recordId: 'rec_vitals_bp_manual',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'patient_portal_001',
          sourceName: 'Patient Self-Report',
          sourceType: 'manual_entry',
          connectionMethod: 'Patient Portal',
          originalFormat: 'Tabula Medica Form'
        },
        importTimestamp: '2026-02-04T08:00:00Z',
        lastUpdated: '2026-02-04T08:00:00Z',
        transformations: [
          { id: 'tx_017a', type: 'normalization', appliedAt: '2026-02-04T08:00:02Z', details: 'Normalized blood pressure to standard FHIR Observation with component values', inputHash: 'e1f2g3h4', outputHash: 'i5j6k7l8', engine: 'Vitals Normalization Engine' },
          { id: 'tx_017b', type: 'validation', appliedAt: '2026-02-04T08:00:04Z', details: 'Validated BP values within physiologically possible ranges', inputHash: 'i5j6k7l8', outputHash: 'i5j6k7l8', engine: 'Clinical Validation Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_017a', action: 'created', actor: 'Patient (Self-Report)', timestamp: '2026-02-04T07:55:00Z', details: 'Blood pressure reading entered: 128/82 mmHg' },
          { id: 'prov_017b', action: 'imported', actor: 'Patient Portal', timestamp: '2026-02-04T08:00:00Z', details: 'Self-reported vitals submitted via patient portal' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_018',
        recordId: 'rec_lab_lipid_panel',
        resourceType: 'DiagnosticReport',
        patientId: samplePatientId,
        source: {
          sourceId: 'labcorp_001',
          sourceName: 'LabCorp',
          sourceType: 'lab',
          connectionMethod: 'HL7 FHIR R4 API',
          fhirVersion: 'R4',
          originalFormat: 'FHIR JSON'
        },
        importTimestamp: '2025-09-15T10:00:00Z',
        lastUpdated: '2025-09-15T10:05:00Z',
        transformations: [
          { id: 'tx_018a', type: 'validation', appliedAt: '2025-09-15T10:00:03Z', details: 'Validated against US Core DiagnosticReport profile', inputHash: 'm9n0o1p2', outputHash: 'm9n0o1p2', engine: 'FHIR Validator v5.6' },
          { id: 'tx_018b', type: 'enrichment', appliedAt: '2025-09-15T10:00:05Z', details: 'Added cardiovascular risk interpretation based on lipid panel values', inputHash: 'm9n0o1p2', outputHash: 'q3r4s5t6', engine: 'Clinical Enrichment Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_018a', action: 'created', actor: 'LabCorp Processing Center', timestamp: '2025-09-14T14:00:00Z', details: 'Lipid panel results finalized' },
          { id: 'prov_018b', action: 'imported', actor: 'Lab Results Connector', timestamp: '2025-09-15T10:00:00Z', details: 'Retrieved via LabCorp FHIR API' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_019',
        recordId: 'rec_wearable_fitbit_hr',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'fitbit_api_001',
          sourceName: 'Fitbit Sense 2',
          sourceType: 'wearable',
          connectionMethod: 'Fitbit Web API v1.2 (OAuth 2.0)',
          originalFormat: 'Fitbit JSON'
        },
        importTimestamp: '2026-02-06T07:15:00Z',
        lastUpdated: '2026-02-06T07:15:00Z',
        transformations: [
          { id: 'tx_019a', type: 'format_conversion', appliedAt: '2026-02-06T07:15:02Z', details: 'Converted Fitbit heart rate time series to FHIR R4 Observation', inputHash: 'fb_hr_001', outputHash: 'fb_hr_002', engine: 'Fitbit-to-FHIR Connector v1.0' },
          { id: 'tx_019b', type: 'normalization', appliedAt: '2026-02-06T07:15:04Z', details: 'Normalized heart rate zones and resting HR to standard LOINC codes', inputHash: 'fb_hr_002', outputHash: 'fb_hr_003', engine: 'Wearable Data Normalizer' },
          { id: 'tx_019c', type: 'validation', appliedAt: '2026-02-06T07:15:06Z', details: 'Validated against Observation vital signs profile', inputHash: 'fb_hr_003', outputHash: 'fb_hr_003', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_019a', action: 'created', actor: 'Fitbit Sense 2 (Device)', timestamp: '2026-02-06T07:00:00Z', details: 'Heart rate data captured via optical sensor' },
          { id: 'prov_019b', action: 'imported', actor: 'Fitbit Platform Connector', timestamp: '2026-02-06T07:15:00Z', details: 'Synced via Fitbit Web API with OAuth 2.0 authorization' },
          { id: 'prov_019c', action: 'transformed', actor: 'Wearable Data Pipeline', timestamp: '2026-02-06T07:15:06Z', details: 'Format conversion and LOINC mapping applied' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_020',
        recordId: 'rec_wearable_fitbit_sleep',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'fitbit_api_001',
          sourceName: 'Fitbit Sense 2',
          sourceType: 'wearable',
          connectionMethod: 'Fitbit Web API v1.2 (OAuth 2.0)',
          originalFormat: 'Fitbit JSON'
        },
        importTimestamp: '2026-02-06T07:15:00Z',
        lastUpdated: '2026-02-06T07:15:00Z',
        transformations: [
          { id: 'tx_020a', type: 'format_conversion', appliedAt: '2026-02-06T07:15:08Z', details: 'Converted Fitbit sleep stages to FHIR R4 Observation with component breakdown', inputHash: 'fb_sl_001', outputHash: 'fb_sl_002', engine: 'Fitbit-to-FHIR Connector v1.0' },
          { id: 'tx_020b', type: 'enrichment', appliedAt: '2026-02-06T07:15:10Z', details: 'Added sleep quality scoring and aggregated sleep metrics', inputHash: 'fb_sl_002', outputHash: 'fb_sl_003', engine: 'Sleep Analytics Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_020a', action: 'created', actor: 'Fitbit Sense 2 (Device)', timestamp: '2026-02-06T06:23:00Z', details: 'Sleep session ended with stage tracking data' },
          { id: 'prov_020b', action: 'imported', actor: 'Fitbit Platform Connector', timestamp: '2026-02-06T07:15:00Z', details: 'Sleep data retrieved via Fitbit API' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_021',
        recordId: 'rec_wearable_garmin_hr',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'garmin_api_001',
          sourceName: 'Garmin Venu 3',
          sourceType: 'wearable',
          connectionMethod: 'Garmin Health API v1 (OAuth 2.0)',
          originalFormat: 'Garmin JSON'
        },
        importTimestamp: '2026-02-06T06:45:00Z',
        lastUpdated: '2026-02-06T06:45:00Z',
        transformations: [
          { id: 'tx_021a', type: 'format_conversion', appliedAt: '2026-02-06T06:45:02Z', details: 'Converted Garmin dailies heart rate summary to FHIR R4 Observation', inputHash: 'gm_hr_001', outputHash: 'gm_hr_002', engine: 'Garmin-to-FHIR Connector v1.0' },
          { id: 'tx_021b', type: 'code_mapping', appliedAt: '2026-02-06T06:45:04Z', details: 'Mapped Garmin heart rate metrics to LOINC 8867-4', inputHash: 'gm_hr_002', outputHash: 'gm_hr_003', engine: 'LOINC Mapping Service' },
          { id: 'tx_021c', type: 'validation', appliedAt: '2026-02-06T06:45:06Z', details: 'Validated against Observation vital signs profile', inputHash: 'gm_hr_003', outputHash: 'gm_hr_003', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_021a', action: 'created', actor: 'Garmin Venu 3 (Device)', timestamp: '2026-02-06T06:30:00Z', details: 'Heart rate data captured via Elevate optical sensor' },
          { id: 'prov_021b', action: 'imported', actor: 'Garmin Platform Connector', timestamp: '2026-02-06T06:45:00Z', details: 'Synced via Garmin Health API with push notification' },
          { id: 'prov_021c', action: 'transformed', actor: 'Wearable Data Pipeline', timestamp: '2026-02-06T06:45:06Z', details: 'Format conversion and LOINC code mapping applied' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_022',
        recordId: 'rec_wearable_garmin_activity',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'garmin_api_001',
          sourceName: 'Garmin Venu 3',
          sourceType: 'wearable',
          connectionMethod: 'Garmin Health API v1 (OAuth 2.0)',
          originalFormat: 'Garmin JSON'
        },
        importTimestamp: '2026-02-06T06:45:00Z',
        lastUpdated: '2026-02-06T06:45:00Z',
        transformations: [
          { id: 'tx_022a', type: 'format_conversion', appliedAt: '2026-02-06T06:45:08Z', details: 'Converted Garmin Body Battery, steps, and calories to FHIR R4 Observation', inputHash: 'gm_ac_001', outputHash: 'gm_ac_002', engine: 'Garmin-to-FHIR Connector v1.0' },
          { id: 'tx_022b', type: 'normalization', appliedAt: '2026-02-06T06:45:10Z', details: 'Normalized activity metrics to standard units (kcal, count)', inputHash: 'gm_ac_002', outputHash: 'gm_ac_003', engine: 'Wearable Data Normalizer' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_022a', action: 'created', actor: 'Garmin Venu 3 (Device)', timestamp: '2026-02-06T06:30:00Z', details: 'Activity data aggregated including steps, calories, Body Battery' },
          { id: 'prov_022b', action: 'imported', actor: 'Garmin Platform Connector', timestamp: '2026-02-06T06:45:00Z', details: 'Activity summary synced via Garmin API' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_023',
        recordId: 'rec_wearable_samsung_hr',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'samsung_api_001',
          sourceName: 'Galaxy Watch 6 Classic',
          sourceType: 'wearable',
          connectionMethod: 'Samsung Health Data API v6.0 (OAuth 2.0)',
          originalFormat: 'Samsung Health JSON'
        },
        importTimestamp: '2026-02-06T07:00:00Z',
        lastUpdated: '2026-02-06T07:00:00Z',
        transformations: [
          { id: 'tx_023a', type: 'format_conversion', appliedAt: '2026-02-06T07:00:02Z', details: 'Converted Samsung Health heart_rate data to FHIR R4 Observation', inputHash: 'sh_hr_001', outputHash: 'sh_hr_002', engine: 'Samsung-to-FHIR Connector v1.0' },
          { id: 'tx_023b', type: 'code_mapping', appliedAt: '2026-02-06T07:00:04Z', details: 'Mapped Samsung Health data types to LOINC codes', inputHash: 'sh_hr_002', outputHash: 'sh_hr_003', engine: 'LOINC Mapping Service' },
          { id: 'tx_023c', type: 'validation', appliedAt: '2026-02-06T07:00:06Z', details: 'Validated against Observation vital signs profile', inputHash: 'sh_hr_003', outputHash: 'sh_hr_003', engine: 'FHIR Validator v5.6' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_023a', action: 'created', actor: 'Galaxy Watch 6 Classic (Device)', timestamp: '2026-02-06T06:45:00Z', details: 'Heart rate data captured via Samsung BioActive Sensor' },
          { id: 'prov_023b', action: 'imported', actor: 'Samsung Health Platform Connector', timestamp: '2026-02-06T07:00:00Z', details: 'Synced via Samsung Health Data API with OAuth 2.0' },
          { id: 'prov_023c', action: 'transformed', actor: 'Wearable Data Pipeline', timestamp: '2026-02-06T07:00:06Z', details: 'Format conversion and LOINC mapping applied' }
        ],
        currentVersion: 1,
        previousVersionId: null
      },
      {
        id: 'lin_024',
        recordId: 'rec_wearable_samsung_bp',
        resourceType: 'Observation',
        patientId: samplePatientId,
        source: {
          sourceId: 'samsung_api_001',
          sourceName: 'Galaxy Watch 6 Classic',
          sourceType: 'wearable',
          connectionMethod: 'Samsung Health Data API v6.0 (OAuth 2.0)',
          originalFormat: 'Samsung Health JSON'
        },
        importTimestamp: '2026-02-06T07:00:00Z',
        lastUpdated: '2026-02-06T07:00:00Z',
        transformations: [
          { id: 'tx_024a', type: 'format_conversion', appliedAt: '2026-02-06T07:00:08Z', details: 'Converted Samsung blood pressure reading to FHIR R4 Observation with systolic/diastolic components', inputHash: 'sh_bp_001', outputHash: 'sh_bp_002', engine: 'Samsung-to-FHIR Connector v1.0' },
          { id: 'tx_024b', type: 'validation', appliedAt: '2026-02-06T07:00:10Z', details: 'Validated against US Core Blood Pressure profile', inputHash: 'sh_bp_002', outputHash: 'sh_bp_002', engine: 'FHIR Validator v5.6' },
          { id: 'tx_024c', type: 'enrichment', appliedAt: '2026-02-06T07:00:12Z', details: 'Added BP classification (Normal/Elevated/Stage 1/Stage 2) interpretation', inputHash: 'sh_bp_002', outputHash: 'sh_bp_003', engine: 'Clinical Enrichment Engine' }
        ],
        validationStatus: 'valid',
        provenanceChain: [
          { id: 'prov_024a', action: 'created', actor: 'Galaxy Watch 6 Classic (Device)', timestamp: '2026-02-06T06:50:00Z', details: 'Blood pressure measurement: 122/78 mmHg via Samsung BioActive Sensor' },
          { id: 'prov_024b', action: 'imported', actor: 'Samsung Health Platform Connector', timestamp: '2026-02-06T07:00:00Z', details: 'BP reading synced via Samsung Health API' },
          { id: 'prov_024c', action: 'verified', actor: 'Clinical Validation Engine', timestamp: '2026-02-06T07:00:12Z', details: 'BP classification: Normal range confirmed' }
        ],
        currentVersion: 1,
        previousVersionId: null
      }
    ];

    const patientRecordIds: string[] = [];
    for (const record of records) {
      this.lineageRecords.set(record.id, record);
      patientRecordIds.push(record.id);
    }
    this.patientIndex.set(samplePatientId, patientRecordIds);
  }

  getLineageForRecord(recordId: string): DataLineageRecord | undefined {
    const record = Array.from(this.lineageRecords.values()).find(r => r.recordId === recordId || r.id === recordId);
    if (record) {
      console.log(`[HIPAA-AUDIT] Data lineage accessed - RecordId: ${recordId}, PatientId: ${record.patientId}`);
    }
    return record;
  }

  getLineageForPatient(
    patientId: string,
    filters?: { sourceType?: SourceType; resourceType?: string; dateRange?: { start: string; end: string } }
  ): DataLineageRecord[] {
    console.log(`[HIPAA-AUDIT] Patient lineage accessed - PatientId: ${patientId}, Filters: ${JSON.stringify(filters || {})}`);

    const recordIds = this.patientIndex.get(patientId) || [];
    let records = recordIds
      .map(id => this.lineageRecords.get(id))
      .filter((r): r is DataLineageRecord => r !== undefined);

    if (filters?.sourceType) {
      records = records.filter(r => r.source.sourceType === filters.sourceType);
    }

    if (filters?.resourceType) {
      records = records.filter(r => r.resourceType === filters.resourceType);
    }

    if (filters?.dateRange) {
      const start = new Date(filters.dateRange.start).getTime();
      const end = new Date(filters.dateRange.end).getTime();
      records = records.filter(r => {
        const ts = new Date(r.importTimestamp).getTime();
        return ts >= start && ts <= end;
      });
    }

    return records;
  }

  getLineageSummary(patientId: string): LineageSummary {
    console.log(`[HIPAA-AUDIT] Lineage summary accessed - PatientId: ${patientId}`);

    const records = this.getLineageForPatient(patientId);

    const bySource: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const byMonthMap: Record<string, number> = {};
    let totalTransformations = 0;
    let oldestTimestamp = '';
    let newestTimestamp = '';
    const dataFreshness: Record<string, { lastSync: string; staleDays: number }> = {};

    for (const record of records) {
      const sourceName = record.source.sourceName;
      bySource[sourceName] = (bySource[sourceName] || 0) + 1;
      byResourceType[record.resourceType] = (byResourceType[record.resourceType] || 0) + 1;
      totalTransformations += record.transformations.length;

      const month = record.importTimestamp.substring(0, 7);
      byMonthMap[month] = (byMonthMap[month] || 0) + 1;

      if (!oldestTimestamp || record.importTimestamp < oldestTimestamp) {
        oldestTimestamp = record.importTimestamp;
      }
      if (!newestTimestamp || record.importTimestamp > newestTimestamp) {
        newestTimestamp = record.importTimestamp;
      }

      const sourceKey = record.source.sourceId;
      const lastUpdated = new Date(record.lastUpdated);
      const staleDays = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

      if (!dataFreshness[sourceKey] || record.lastUpdated > dataFreshness[sourceKey].lastSync) {
        dataFreshness[sourceKey] = { lastSync: record.lastUpdated, staleDays };
      }
    }

    const byMonth = Object.entries(byMonthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalRecords: records.length,
      bySource,
      byResourceType,
      byMonth,
      averageTransformations: records.length > 0 ? Math.round((totalTransformations / records.length) * 10) / 10 : 0,
      oldestRecord: oldestTimestamp,
      newestRecord: newestTimestamp,
      dataFreshness
    };
  }

  getSourceBreakdown(patientId: string): {
    sourceId: string;
    sourceName: string;
    sourceType: SourceType;
    recordCount: number;
    lastSync: string;
    resourceTypes: string[];
  }[] {
    console.log(`[HIPAA-AUDIT] Source breakdown accessed - PatientId: ${patientId}`);

    const records = this.getLineageForPatient(patientId);
    const sourceMap: Record<string, {
      sourceId: string;
      sourceName: string;
      sourceType: SourceType;
      recordCount: number;
      lastSync: string;
      resourceTypes: Set<string>;
    }> = {};

    for (const record of records) {
      const key = record.source.sourceId;
      if (!sourceMap[key]) {
        sourceMap[key] = {
          sourceId: record.source.sourceId,
          sourceName: record.source.sourceName,
          sourceType: record.source.sourceType,
          recordCount: 0,
          lastSync: record.lastUpdated,
          resourceTypes: new Set()
        };
      }
      sourceMap[key].recordCount++;
      sourceMap[key].resourceTypes.add(record.resourceType);
      if (record.lastUpdated > sourceMap[key].lastSync) {
        sourceMap[key].lastSync = record.lastUpdated;
      }
    }

    return Object.values(sourceMap).map(s => ({
      ...s,
      resourceTypes: Array.from(s.resourceTypes)
    }));
  }

  getTransformationHistory(recordId: string): DataTransformation[] {
    console.log(`[HIPAA-AUDIT] Transformation history accessed - RecordId: ${recordId}`);
    const record = this.getLineageForRecord(recordId);
    return record?.transformations || [];
  }

  getProvenanceChain(recordId: string): ProvenanceEntry[] {
    console.log(`[HIPAA-AUDIT] Provenance chain accessed - RecordId: ${recordId}`);
    const record = this.getLineageForRecord(recordId);
    return record?.provenanceChain || [];
  }

  getDataFreshness(patientId: string): Record<string, {
    sourceName: string;
    sourceType: SourceType;
    lastSync: string;
    staleDays: number;
    status: 'fresh' | 'aging' | 'stale';
    recordCount: number;
  }> {
    console.log(`[HIPAA-AUDIT] Data freshness analysis - PatientId: ${patientId}`);

    const records = this.getLineageForPatient(patientId);
    const freshness: Record<string, {
      sourceName: string;
      sourceType: SourceType;
      lastSync: string;
      staleDays: number;
      status: 'fresh' | 'aging' | 'stale';
      recordCount: number;
    }> = {};

    for (const record of records) {
      const key = record.source.sourceId;
      const lastUpdated = new Date(record.lastUpdated);
      const staleDays = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

      if (!freshness[key] || record.lastUpdated > freshness[key].lastSync) {
        const status: 'fresh' | 'aging' | 'stale' = staleDays <= 7 ? 'fresh' : staleDays <= 30 ? 'aging' : 'stale';
        freshness[key] = {
          sourceName: record.source.sourceName,
          sourceType: record.source.sourceType,
          lastSync: record.lastUpdated,
          staleDays,
          status,
          recordCount: freshness[key]?.recordCount || 0
        };
      }
      freshness[key].recordCount++;
    }

    return freshness;
  }

  searchLineage(query: string): DataLineageRecord[] {
    console.log(`[HIPAA-AUDIT] Lineage search - Query: ${query}`);

    const lowerQuery = query.toLowerCase();
    return Array.from(this.lineageRecords.values()).filter(record => {
      return (
        record.resourceType.toLowerCase().includes(lowerQuery) ||
        record.source.sourceName.toLowerCase().includes(lowerQuery) ||
        record.source.sourceType.toLowerCase().includes(lowerQuery) ||
        record.recordId.toLowerCase().includes(lowerQuery) ||
        record.transformations.some(t => t.details.toLowerCase().includes(lowerQuery)) ||
        record.provenanceChain.some(p => p.details.toLowerCase().includes(lowerQuery) || p.actor.toLowerCase().includes(lowerQuery))
      );
    });
  }

  getTimelineView(
    patientId: string,
    dateRange?: { start: string; end: string }
  ): {
    date: string;
    events: {
      recordId: string;
      resourceType: string;
      sourceName: string;
      action: string;
      details: string;
    }[];
  }[] {
    console.log(`[HIPAA-AUDIT] Timeline view accessed - PatientId: ${patientId}`);

    const records = this.getLineageForPatient(patientId, dateRange ? { dateRange } : undefined);

    const eventsByDate: Record<string, {
      recordId: string;
      resourceType: string;
      sourceName: string;
      action: string;
      details: string;
    }[]> = {};

    for (const record of records) {
      for (const prov of record.provenanceChain) {
        const date = prov.timestamp.substring(0, 10);
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push({
          recordId: record.recordId,
          resourceType: record.resourceType,
          sourceName: record.source.sourceName,
          action: prov.action,
          details: prov.details
        });
      }
    }

    return Object.entries(eventsByDate)
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

export const dataLineageService = new DataLineageService();
