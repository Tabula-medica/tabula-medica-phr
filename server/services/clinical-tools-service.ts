import crypto from 'crypto';

export interface NMNValidationResult {
  isValid: boolean;
  hasMiddleName: boolean;
  middleNameValue: string | null;
  isNMN: boolean;
  requiresConfirmation: boolean;
  standardizedName: {
    firstName: string;
    middleName: string;
    lastName: string;
    suffix?: string;
  };
  validationMessage: string;
}

export interface NMNPatientRecord {
  patientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  nmnStatus: 'CONFIRMED_NMN' | 'HAS_MIDDLE_NAME' | 'UNCONFIRMED' | 'INITIAL_MISSING';
  nmnConfirmedAt?: string;
  nmnConfirmedBy?: string;
}

export interface SafetyAlertSummary {
  id: string;
  patientId: string;
  type: 'CRITICAL' | 'WARNING' | 'INFORMATIONAL';
  observationType: string;
  observedValue: number;
  unit: string;
  expectedRange: { low: number; high: number };
  deviation: string;
  message: string;
  recommendation: string;
  createdAt: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface ClinicalRange {
  code: string;
  name: string;
  unit: string;
  normalRange: { low: number; high: number };
  criticalLow?: number;
  criticalHigh?: number;
  warningLow?: number;
  warningHigh?: number;
  system: string;
}

export interface EpisodeOfCareSummary {
  id: string;
  type: string;
  title: string;
  status: 'active' | 'completed' | 'ongoing';
  startDate: string;
  endDate?: string;
  eventCount: number;
  primaryCondition: string;
  careSummary: string;
  outcomeStatus?: string;
  color: string;
}

export interface AICareSummary {
  patientId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  narrativeSummary: string;
  keyHighlights: string[];
  healthTrends: Array<{
    metric: string;
    trend: 'improving' | 'stable' | 'declining';
    detail: string;
  }>;
  activeMedications: number;
  recentEncounters: number;
  upcomingActions: string[];
  disclaimer: string;
}

export interface SmartHealthCard {
  id: string;
  patientId: string;
  type: 'vaccination' | 'medication' | 'lab_result' | 'combined';
  issuedAt: string;
  expiresAt: string;
  payload: {
    iss: string;
    nbf: number;
    vc: {
      type: string[];
      credentialSubject: {
        fhirVersion: string;
        fhirBundle: {
          resourceType: string;
          type: string;
          entry: any[];
        };
      };
    };
  };
  qrData: string;
  verificationUrl: string;
}

export interface FHIRBulkExportJob {
  jobId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
  resourceTypes: string[];
  outputFiles: Array<{
    type: string;
    url: string;
    count: number;
  }>;
  totalResources: number;
  ndjsonContent?: string;
}

export interface LabResultWithSparkline {
  id: string;
  code: string;
  name: string;
  latestValue: number;
  unit: string;
  latestDate: string;
  normalRange: { min: number; max: number };
  isAbnormal: boolean;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  history: Array<{ date: string; value: number }>;
}

class ClinicalToolsService {
  private nmnRecords: Map<string, NMNPatientRecord> = new Map();
  private bulkExportJobs: Map<string, FHIRBulkExportJob> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log('[ClinicalTools] Service initialized');
    console.log('[ClinicalTools] Features: NMN, Safety Alerts, Episodes, AI Summary, SHC, FHIR Export, Sparklines');
  }

  private initializeSampleData(): void {
    this.nmnRecords.set('patient-001', {
      patientId: 'patient-001',
      firstName: 'Sarah',
      middleName: null,
      lastName: 'Chen',
      nmnStatus: 'CONFIRMED_NMN',
      nmnConfirmedAt: '2025-08-15T10:00:00Z',
      nmnConfirmedBy: 'patient_self',
    });

    this.nmnRecords.set('patient-002', {
      patientId: 'patient-002',
      firstName: 'James',
      middleName: 'Robert',
      lastName: 'Wilson',
      nmnStatus: 'HAS_MIDDLE_NAME',
    });

    this.nmnRecords.set('patient-003', {
      patientId: 'patient-003',
      firstName: 'Maria',
      middleName: null,
      lastName: 'Garcia',
      nmnStatus: 'UNCONFIRMED',
    });
  }

  validateNMN(firstName: string, middleName: string | null | undefined, lastName: string): NMNValidationResult {
    const trimmedMiddle = middleName?.trim() || null;
    const isExplicitNMN = trimmedMiddle?.toUpperCase() === 'NMN' || trimmedMiddle?.toUpperCase() === 'NONE' || trimmedMiddle === '';
    const hasMiddle = !!trimmedMiddle && !isExplicitNMN;

    return {
      isValid: hasMiddle || isExplicitNMN || trimmedMiddle === null,
      hasMiddleName: hasMiddle,
      middleNameValue: hasMiddle ? trimmedMiddle : null,
      isNMN: !hasMiddle,
      requiresConfirmation: trimmedMiddle === null || trimmedMiddle === undefined,
      standardizedName: {
        firstName: firstName.trim(),
        middleName: hasMiddle ? trimmedMiddle! : 'NMN',
        lastName: lastName.trim(),
      },
      validationMessage: hasMiddle
        ? `Middle name "${trimmedMiddle}" recorded`
        : trimmedMiddle === null
          ? 'No middle name provided. Please confirm NMN (No Middle Name) status.'
          : 'NMN (No Middle Name) confirmed and standardized',
    };
  }

  getNMNRecords(): NMNPatientRecord[] {
    return Array.from(this.nmnRecords.values());
  }

  getNMNRecord(patientId: string): NMNPatientRecord | undefined {
    return this.nmnRecords.get(patientId);
  }

  confirmNMN(patientId: string, hasMiddleName: boolean, middleName?: string): NMNPatientRecord {
    const existing = this.nmnRecords.get(patientId) || {
      patientId,
      firstName: 'Unknown',
      middleName: null,
      lastName: 'Unknown',
      nmnStatus: 'UNCONFIRMED' as const,
    };

    const updated: NMNPatientRecord = {
      ...existing,
      middleName: hasMiddleName ? (middleName || null) : null,
      nmnStatus: hasMiddleName ? 'HAS_MIDDLE_NAME' : 'CONFIRMED_NMN',
      nmnConfirmedAt: new Date().toISOString(),
      nmnConfirmedBy: 'patient_self',
    };

    this.nmnRecords.set(patientId, updated);
    return updated;
  }

  getSafetyAlerts(patientId: string): SafetyAlertSummary[] {
    const now = new Date();
    return [
      {
        id: `alert-${patientId}-001`,
        patientId,
        type: 'CRITICAL',
        observationType: 'Blood Glucose (Fasting)',
        observedValue: 287,
        unit: 'mg/dL',
        expectedRange: { low: 70, high: 100 },
        deviation: 'ABOVE_CRITICAL',
        message: 'Fasting blood glucose is critically elevated at 287 mg/dL',
        recommendation: 'Contact your healthcare provider immediately. This value may require urgent medical attention.',
        createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
        status: 'NEW',
      },
      {
        id: `alert-${patientId}-002`,
        patientId,
        type: 'WARNING',
        observationType: 'Systolic Blood Pressure',
        observedValue: 152,
        unit: 'mmHg',
        expectedRange: { low: 90, high: 140 },
        deviation: 'ABOVE_WARNING',
        message: 'Systolic blood pressure is elevated at 152 mmHg',
        recommendation: 'Monitor blood pressure closely. Consider lifestyle modifications and discuss with your provider at next visit.',
        createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
        status: 'NEW',
      },
      {
        id: `alert-${patientId}-003`,
        patientId,
        type: 'WARNING',
        observationType: 'HbA1c',
        observedValue: 8.2,
        unit: '%',
        expectedRange: { low: 4.0, high: 5.7 },
        deviation: 'ABOVE_WARNING',
        message: 'HbA1c is elevated at 8.2%, indicating poor glycemic control',
        recommendation: 'Schedule follow-up with endocrinologist. Review current diabetes management plan.',
        createdAt: new Date(now.getTime() - 48 * 3600000).toISOString(),
        status: 'ACKNOWLEDGED',
      },
      {
        id: `alert-${patientId}-004`,
        patientId,
        type: 'INFORMATIONAL',
        observationType: 'Total Cholesterol',
        observedValue: 215,
        unit: 'mg/dL',
        expectedRange: { low: 0, high: 200 },
        deviation: 'ABOVE_NORMAL',
        message: 'Total cholesterol is slightly above optimal at 215 mg/dL',
        recommendation: 'Consider dietary modifications. Recheck at next routine visit.',
        createdAt: new Date(now.getTime() - 72 * 3600000).toISOString(),
        status: 'RESOLVED',
      },
      {
        id: `alert-${patientId}-005`,
        patientId,
        type: 'CRITICAL',
        observationType: 'Potassium',
        observedValue: 2.8,
        unit: 'mEq/L',
        expectedRange: { low: 3.5, high: 5.0 },
        deviation: 'BELOW_CRITICAL',
        message: 'Potassium level is critically low at 2.8 mEq/L',
        recommendation: 'Seek immediate medical attention. Low potassium can cause dangerous heart rhythm problems.',
        createdAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
        status: 'NEW',
      },
    ];
  }

  getClinicalRanges(): ClinicalRange[] {
    return [
      { code: '8480-6', name: 'Systolic Blood Pressure', unit: 'mmHg', normalRange: { low: 90, high: 140 }, criticalLow: 70, criticalHigh: 180, warningLow: 80, warningHigh: 150, system: 'LOINC' },
      { code: '8462-4', name: 'Diastolic Blood Pressure', unit: 'mmHg', normalRange: { low: 60, high: 90 }, criticalLow: 40, criticalHigh: 120, warningLow: 50, warningHigh: 100, system: 'LOINC' },
      { code: '8867-4', name: 'Heart Rate', unit: 'bpm', normalRange: { low: 60, high: 100 }, criticalLow: 40, criticalHigh: 150, warningLow: 50, warningHigh: 120, system: 'LOINC' },
      { code: '8310-5', name: 'Body Temperature', unit: 'F', normalRange: { low: 97.0, high: 99.0 }, criticalLow: 95.0, criticalHigh: 104.0, warningLow: 96.0, warningHigh: 101.0, system: 'LOINC' },
      { code: '9279-1', name: 'Respiratory Rate', unit: 'breaths/min', normalRange: { low: 12, high: 20 }, criticalLow: 8, criticalHigh: 30, warningLow: 10, warningHigh: 24, system: 'LOINC' },
      { code: '2708-6', name: 'Oxygen Saturation', unit: '%', normalRange: { low: 95, high: 100 }, criticalLow: 88, criticalHigh: undefined, warningLow: 92, system: 'LOINC' },
      { code: '2345-7', name: 'Blood Glucose (Fasting)', unit: 'mg/dL', normalRange: { low: 70, high: 100 }, criticalLow: 40, criticalHigh: 250, warningLow: 54, warningHigh: 126, system: 'LOINC' },
      { code: '4548-4', name: 'HbA1c', unit: '%', normalRange: { low: 4.0, high: 5.7 }, warningHigh: 7.0, criticalHigh: 10.0, system: 'LOINC' },
      { code: '2093-3', name: 'Total Cholesterol', unit: 'mg/dL', normalRange: { low: 0, high: 200 }, warningHigh: 240, criticalHigh: 300, system: 'LOINC' },
      { code: '2085-9', name: 'HDL Cholesterol', unit: 'mg/dL', normalRange: { low: 40, high: 60 }, criticalLow: 25, warningLow: 35, system: 'LOINC' },
      { code: '2089-1', name: 'LDL Cholesterol', unit: 'mg/dL', normalRange: { low: 0, high: 100 }, warningHigh: 130, criticalHigh: 190, system: 'LOINC' },
      { code: '2571-8', name: 'Triglycerides', unit: 'mg/dL', normalRange: { low: 0, high: 150 }, warningHigh: 200, criticalHigh: 500, system: 'LOINC' },
      { code: '2160-0', name: 'Creatinine', unit: 'mg/dL', normalRange: { low: 0.6, high: 1.2 }, warningHigh: 1.5, criticalHigh: 4.0, system: 'LOINC' },
      { code: '6299-2', name: 'BUN', unit: 'mg/dL', normalRange: { low: 7, high: 20 }, warningHigh: 30, criticalHigh: 60, system: 'LOINC' },
      { code: '2823-3', name: 'Potassium', unit: 'mEq/L', normalRange: { low: 3.5, high: 5.0 }, criticalLow: 2.5, criticalHigh: 6.5, warningLow: 3.0, warningHigh: 5.5, system: 'LOINC' },
    ];
  }

  getEpisodesOfCare(patientId: string): EpisodeOfCareSummary[] {
    return [
      {
        id: `eoc-${patientId}-001`,
        type: 'chronic_management',
        title: 'Type 2 Diabetes Management',
        status: 'active',
        startDate: '2024-03-15',
        eventCount: 12,
        primaryCondition: 'Type 2 Diabetes Mellitus (E11.9)',
        careSummary: 'Ongoing diabetes management with metformin 1000mg BID. HbA1c trending from 9.1% to 8.2% over 6 months. Added glipizide 5mg in August. Referred to endocrinology.',
        outcomeStatus: 'improving',
        color: '#3b82f6',
      },
      {
        id: `eoc-${patientId}-002`,
        type: 'surgical',
        title: 'Right Knee Arthroscopy',
        status: 'completed',
        startDate: '2025-01-10',
        endDate: '2025-03-20',
        eventCount: 8,
        primaryCondition: 'Internal derangement of right knee (M23.91)',
        careSummary: 'Arthroscopic meniscectomy performed 1/10. Post-op PT x8 weeks. Full ROM restored. Cleared for normal activity 3/20.',
        outcomeStatus: 'resolved',
        color: '#ef4444',
      },
      {
        id: `eoc-${patientId}-003`,
        type: 'acute_illness',
        title: 'Community-Acquired Pneumonia',
        status: 'completed',
        startDate: '2025-06-05',
        endDate: '2025-07-01',
        eventCount: 5,
        primaryCondition: 'Community-acquired pneumonia (J18.9)',
        careSummary: 'Presented with cough, fever 101.2F, right lower lobe infiltrate on CXR. Treated with azithromycin 500mg x5 days. Follow-up CXR showed resolution.',
        outcomeStatus: 'resolved',
        color: '#f59e0b',
      },
      {
        id: `eoc-${patientId}-004`,
        type: 'preventive_care',
        title: 'Annual Wellness & Cancer Screening',
        status: 'active',
        startDate: '2025-09-01',
        eventCount: 4,
        primaryCondition: 'Annual wellness exam (Z00.00)',
        careSummary: 'Annual wellness visit completed. Labs ordered: CBC, CMP, lipid panel, TSH. Colonoscopy scheduled. Mammogram up to date.',
        outcomeStatus: 'pending',
        color: '#10b981',
      },
      {
        id: `eoc-${patientId}-005`,
        type: 'medication_management',
        title: 'Hypertension Control',
        status: 'ongoing',
        startDate: '2024-06-01',
        eventCount: 9,
        primaryCondition: 'Essential hypertension (I10)',
        careSummary: 'Started lisinopril 10mg, uptitrated to 20mg. Added amlodipine 5mg after suboptimal control. Home BP averaging 138/88. Goal < 130/80.',
        outcomeStatus: 'stable',
        color: '#8b5cf6',
      },
    ];
  }

  generateAICareSummary(patientId: string): AICareSummary {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 3600000);

    return {
      patientId,
      generatedAt: now.toISOString(),
      periodStart: sixMonthsAgo.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      narrativeSummary: `Over the past 6 months, this patient has been actively managing several chronic conditions with measurable progress. Type 2 Diabetes management has shown improvement with HbA1c decreasing from 9.1% to 8.2%, though remaining above the target of 7.0%. The treatment regimen was augmented with glipizide 5mg in addition to metformin 1000mg BID, and an endocrinology referral was placed.

Hypertension control remains a work in progress. After uptitration of lisinopril to 20mg and addition of amlodipine 5mg, home blood pressure readings average 138/88 mmHg against a target of 130/80. The most recent in-office reading of 152/92 triggered a warning alert.

A notable acute episode occurred in June with community-acquired pneumonia, which was successfully treated with a 5-day course of azithromycin. Follow-up chest X-ray confirmed complete resolution.

The patient completed a right knee arthroscopy in January with excellent outcomes, achieving full range of motion by March. Physical therapy was completed over 8 weeks.

Recent laboratory work revealed a critically elevated fasting glucose of 287 mg/dL and critically low potassium of 2.8 mEq/L, both requiring urgent attention. Total cholesterol is mildly elevated at 215 mg/dL.

Preventive care is generally up to date. Annual wellness visit was completed in September. Colonoscopy has been scheduled. Mammography is current.`,
      keyHighlights: [
        'HbA1c improved from 9.1% to 8.2% (target: <7.0%)',
        'Blood pressure remains above goal at 138/88 (target: <130/80)',
        'Pneumonia episode in June fully resolved',
        'Right knee arthroscopy: full recovery achieved',
        'Critical lab alerts: glucose 287 mg/dL, potassium 2.8 mEq/L',
        'Preventive screenings up to date, colonoscopy pending',
      ],
      healthTrends: [
        { metric: 'HbA1c', trend: 'improving', detail: '9.1% -> 8.2% over 6 months' },
        { metric: 'Blood Pressure', trend: 'stable', detail: 'Averaging 138/88, medication adjustments ongoing' },
        { metric: 'BMI', trend: 'stable', detail: 'Stable at 28.4 kg/m2' },
        { metric: 'Kidney Function (eGFR)', trend: 'stable', detail: 'eGFR 78 mL/min, CKD Stage 2' },
        { metric: 'Lipid Panel', trend: 'improving', detail: 'LDL decreased from 142 to 128 mg/dL' },
      ],
      activeMedications: 7,
      recentEncounters: 14,
      upcomingActions: [
        'Endocrinology consultation for diabetes optimization',
        'Colonoscopy (screening)',
        'Potassium recheck in 48 hours',
        'Follow-up fasting glucose in 1 week',
        'Blood pressure reassessment in 2 weeks',
      ],
      disclaimer: 'INFORMATIONAL ONLY: This AI-generated summary is for informational purposes only and does not constitute clinical decision support, medical advice, or a substitute for professional medical judgment. Always consult with your healthcare provider for medical decisions. NO-CDS compliant.',
    };
  }

  generateSmartHealthCard(patientId: string, type: 'vaccination' | 'medication' | 'lab_result' | 'combined'): SmartHealthCard {
    const now = new Date();
    const expires = new Date(now.getTime() + 365 * 24 * 3600000);
    const cardId = `shc-${patientId}-${crypto.randomUUID().slice(0, 8)}`;

    const entries: any[] = [];

    entries.push({
      fullUrl: `resource:0`,
      resource: {
        resourceType: 'Patient',
        name: [{ family: 'Chen', given: ['Sarah'] }],
        birthDate: '1985-03-22',
      },
    });

    if (type === 'vaccination' || type === 'combined') {
      entries.push(
        {
          fullUrl: 'resource:1',
          resource: {
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '208', display: 'SARS-CoV-2 (COVID-19) mRNA' }] },
            occurrenceDateTime: '2024-10-15',
            lotNumber: 'EW0182',
            performer: [{ actor: { display: 'Metro Health Pharmacy' } }],
          },
        },
        {
          fullUrl: 'resource:2',
          resource: {
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '141', display: 'Influenza, seasonal' }] },
            occurrenceDateTime: '2025-10-01',
            lotNumber: 'UJ789K',
            performer: [{ actor: { display: 'Primary Care Associates' } }],
          },
        },
        {
          fullUrl: 'resource:3',
          resource: {
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '113', display: 'Td (adult)' }] },
            occurrenceDateTime: '2023-05-10',
            lotNumber: 'TD4488',
            performer: [{ actor: { display: 'Urgent Care Plus' } }],
          },
        }
      );
    }

    if (type === 'medication' || type === 'combined') {
      entries.push(
        {
          fullUrl: 'resource:4',
          resource: {
            resourceType: 'MedicationStatement',
            status: 'active',
            medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin 1000mg' }] },
            dosage: [{ text: '1000mg twice daily' }],
          },
        },
        {
          fullUrl: 'resource:5',
          resource: {
            resourceType: 'MedicationStatement',
            status: 'active',
            medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Lisinopril 20mg' }] },
            dosage: [{ text: '20mg once daily' }],
          },
        }
      );
    }

    if (type === 'lab_result' || type === 'combined') {
      entries.push({
        fullUrl: 'resource:6',
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'HbA1c' }] },
          valueQuantity: { value: 8.2, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
          effectiveDateTime: '2025-12-15',
        },
      });
    }

    const payload = {
      iss: 'https://tabulamedica.health/issuer',
      nbf: Math.floor(now.getTime() / 1000),
      vc: {
        type: ['https://smarthealth.cards#health-card', `https://smarthealth.cards#${type}`],
        credentialSubject: {
          fhirVersion: '4.0.1',
          fhirBundle: {
            resourceType: 'Bundle',
            type: 'collection',
            entry: entries,
          },
        },
      },
    };

    const qrPayload = JSON.stringify({ shc: cardId, t: type, p: patientId, iss: payload.iss, nbf: payload.nbf });
    const qrData = `shc:/${Buffer.from(qrPayload).toString('base64url')}`;

    return {
      id: cardId,
      patientId,
      type,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      payload,
      qrData,
      verificationUrl: `https://tabulamedica.health/verify/${cardId}`,
    };
  }

  startBulkExport(patientId: string, resourceTypes?: string[]): FHIRBulkExportJob {
    const jobId = `export-${crypto.randomUUID().slice(0, 8)}`;
    const types = resourceTypes || ['Patient', 'Condition', 'Observation', 'MedicationStatement', 'Immunization', 'AllergyIntolerance', 'Encounter', 'DiagnosticReport'];

    const ndjsonLines: string[] = [];

    ndjsonLines.push(JSON.stringify({
      resourceType: 'Patient',
      id: patientId,
      name: [{ family: 'Chen', given: ['Sarah'], use: 'official' }],
      gender: 'female',
      birthDate: '1985-03-22',
      address: [{ city: 'San Francisco', state: 'CA', postalCode: '94102' }],
    }));

    const conditions = [
      { code: 'E11.9', display: 'Type 2 Diabetes Mellitus' },
      { code: 'I10', display: 'Essential Hypertension' },
      { code: 'E78.5', display: 'Hyperlipidemia' },
      { code: 'J45.20', display: 'Mild Intermittent Asthma' },
    ];
    conditions.forEach((c, i) => {
      ndjsonLines.push(JSON.stringify({
        resourceType: 'Condition',
        id: `cond-${i + 1}`,
        subject: { reference: `Patient/${patientId}` },
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: c.code, display: c.display }] },
        clinicalStatus: { coding: [{ code: 'active' }] },
      }));
    });

    const observations = [
      { code: '8480-6', display: 'Systolic BP', value: 152, unit: 'mmHg', date: '2026-01-15' },
      { code: '8462-4', display: 'Diastolic BP', value: 92, unit: 'mmHg', date: '2026-01-15' },
      { code: '4548-4', display: 'HbA1c', value: 8.2, unit: '%', date: '2025-12-15' },
      { code: '2345-7', display: 'Glucose (Fasting)', value: 287, unit: 'mg/dL', date: '2026-01-20' },
      { code: '2823-3', display: 'Potassium', value: 2.8, unit: 'mEq/L', date: '2026-01-28' },
      { code: '2093-3', display: 'Total Cholesterol', value: 215, unit: 'mg/dL', date: '2025-11-10' },
      { code: '2085-9', display: 'HDL', value: 48, unit: 'mg/dL', date: '2025-11-10' },
      { code: '2089-1', display: 'LDL', value: 128, unit: 'mg/dL', date: '2025-11-10' },
    ];
    observations.forEach((o, i) => {
      ndjsonLines.push(JSON.stringify({
        resourceType: 'Observation',
        id: `obs-${i + 1}`,
        status: 'final',
        subject: { reference: `Patient/${patientId}` },
        code: { coding: [{ system: 'http://loinc.org', code: o.code, display: o.display }] },
        valueQuantity: { value: o.value, unit: o.unit },
        effectiveDateTime: o.date,
      }));
    });

    const medications = [
      { code: '860975', display: 'Metformin 1000mg', dosage: 'BID' },
      { code: '314076', display: 'Lisinopril 20mg', dosage: 'QD' },
      { code: '329526', display: 'Amlodipine 5mg', dosage: 'QD' },
      { code: '310539', display: 'Atorvastatin 40mg', dosage: 'QHS' },
    ];
    medications.forEach((m, i) => {
      ndjsonLines.push(JSON.stringify({
        resourceType: 'MedicationStatement',
        id: `med-${i + 1}`,
        status: 'active',
        subject: { reference: `Patient/${patientId}` },
        medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: m.code, display: m.display }] },
        dosage: [{ text: m.dosage }],
      }));
    });

    const immunizations = [
      { code: '208', display: 'COVID-19 mRNA', date: '2024-10-15' },
      { code: '141', display: 'Influenza', date: '2025-10-01' },
      { code: '113', display: 'Td (adult)', date: '2023-05-10' },
    ];
    immunizations.forEach((im, i) => {
      ndjsonLines.push(JSON.stringify({
        resourceType: 'Immunization',
        id: `imm-${i + 1}`,
        status: 'completed',
        patient: { reference: `Patient/${patientId}` },
        vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: im.code, display: im.display }] },
        occurrenceDateTime: im.date,
      }));
    });

    const resourceCounts: Record<string, number> = {};
    ndjsonLines.forEach(line => {
      const r = JSON.parse(line);
      resourceCounts[r.resourceType] = (resourceCounts[r.resourceType] || 0) + 1;
    });

    const job: FHIRBulkExportJob = {
      jobId,
      status: 'completed',
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      resourceTypes: types,
      outputFiles: Object.entries(resourceCounts).map(([type, count]) => ({
        type,
        url: `/api/infrastructure/clinical-tools/fhir/export/${jobId}/${type}.ndjson`,
        count,
      })),
      totalResources: ndjsonLines.length,
      ndjsonContent: ndjsonLines.join('\n'),
    };

    this.bulkExportJobs.set(jobId, job);
    return job;
  }

  getExportJob(jobId: string): FHIRBulkExportJob | undefined {
    return this.bulkExportJobs.get(jobId);
  }

  getLabResultsWithSparklines(patientId: string): LabResultWithSparkline[] {
    const generateHistory = (baseValue: number, variance: number, count: number, trendDir: 'up' | 'down' | 'stable'): Array<{ date: string; value: number }> => {
      const history: Array<{ date: string; value: number }> = [];
      const now = new Date();
      for (let i = count - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 30 * 24 * 3600000);
        let trendOffset = 0;
        if (trendDir === 'up') trendOffset = (count - 1 - i) * (variance * 0.3);
        if (trendDir === 'down') trendOffset = -(count - 1 - i) * (variance * 0.3);
        const value = Math.round((baseValue + trendOffset + (Math.random() - 0.5) * variance) * 10) / 10;
        history.push({ date: date.toISOString().split('T')[0], value });
      }
      return history;
    };

    return [
      {
        id: 'lab-001', code: '4548-4', name: 'HbA1c', latestValue: 8.2, unit: '%', latestDate: '2025-12-15',
        normalRange: { min: 4.0, max: 5.7 }, isAbnormal: true, trend: 'down', trendPercentage: 9.9,
        history: generateHistory(9.1, 0.5, 6, 'down'),
      },
      {
        id: 'lab-002', code: '2345-7', name: 'Glucose (Fasting)', latestValue: 287, unit: 'mg/dL', latestDate: '2026-01-20',
        normalRange: { min: 70, max: 100 }, isAbnormal: true, trend: 'up', trendPercentage: 45,
        history: generateHistory(180, 40, 6, 'up'),
      },
      {
        id: 'lab-003', code: '2823-3', name: 'Potassium', latestValue: 2.8, unit: 'mEq/L', latestDate: '2026-01-28',
        normalRange: { min: 3.5, max: 5.0 }, isAbnormal: true, trend: 'down', trendPercentage: 22,
        history: generateHistory(3.8, 0.4, 6, 'down'),
      },
      {
        id: 'lab-004', code: '2093-3', name: 'Total Cholesterol', latestValue: 215, unit: 'mg/dL', latestDate: '2025-11-10',
        normalRange: { min: 0, max: 200 }, isAbnormal: true, trend: 'down', trendPercentage: 5,
        history: generateHistory(228, 15, 6, 'down'),
      },
      {
        id: 'lab-005', code: '2089-1', name: 'LDL Cholesterol', latestValue: 128, unit: 'mg/dL', latestDate: '2025-11-10',
        normalRange: { min: 0, max: 100 }, isAbnormal: true, trend: 'down', trendPercentage: 10,
        history: generateHistory(142, 10, 6, 'down'),
      },
      {
        id: 'lab-006', code: '2085-9', name: 'HDL Cholesterol', latestValue: 48, unit: 'mg/dL', latestDate: '2025-11-10',
        normalRange: { min: 40, max: 60 }, isAbnormal: false, trend: 'stable', trendPercentage: 2,
        history: generateHistory(47, 3, 6, 'stable'),
      },
      {
        id: 'lab-007', code: '2571-8', name: 'Triglycerides', latestValue: 168, unit: 'mg/dL', latestDate: '2025-11-10',
        normalRange: { min: 0, max: 150 }, isAbnormal: true, trend: 'stable', trendPercentage: 3,
        history: generateHistory(170, 20, 6, 'stable'),
      },
      {
        id: 'lab-008', code: '2160-0', name: 'Creatinine', latestValue: 1.1, unit: 'mg/dL', latestDate: '2025-12-01',
        normalRange: { min: 0.6, max: 1.2 }, isAbnormal: false, trend: 'stable', trendPercentage: 1,
        history: generateHistory(1.05, 0.1, 6, 'stable'),
      },
      {
        id: 'lab-009', code: '6299-2', name: 'BUN', latestValue: 18, unit: 'mg/dL', latestDate: '2025-12-01',
        normalRange: { min: 7, max: 20 }, isAbnormal: false, trend: 'stable', trendPercentage: 2,
        history: generateHistory(17, 2, 6, 'stable'),
      },
      {
        id: 'lab-010', code: '718-7', name: 'Hemoglobin', latestValue: 13.8, unit: 'g/dL', latestDate: '2025-12-01',
        normalRange: { min: 12.0, max: 16.0 }, isAbnormal: false, trend: 'stable', trendPercentage: 1,
        history: generateHistory(13.5, 0.5, 6, 'stable'),
      },
      {
        id: 'lab-011', code: '787-2', name: 'MCV', latestValue: 88, unit: 'fL', latestDate: '2025-12-01',
        normalRange: { min: 80, max: 100 }, isAbnormal: false, trend: 'stable', trendPercentage: 0,
        history: generateHistory(88, 2, 6, 'stable'),
      },
      {
        id: 'lab-012', code: '6690-2', name: 'WBC', latestValue: 7.2, unit: 'K/uL', latestDate: '2025-12-01',
        normalRange: { min: 4.5, max: 11.0 }, isAbnormal: false, trend: 'stable', trendPercentage: 3,
        history: generateHistory(7.0, 1, 6, 'stable'),
      },
    ];
  }
}

export const clinicalToolsService = new ClinicalToolsService();
