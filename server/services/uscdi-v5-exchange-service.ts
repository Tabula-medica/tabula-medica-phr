/**
 * USCDI v5 Data Exchange Service
 * 
 * Implements the US Core Data for Interoperability (USCDI) Version 5
 * data exchange capabilities for nationwide health information sharing.
 * 
 * USCDI v5 Data Classes:
 * - Patient Demographics
 * - Allergies and Intolerances
 * - Problems (Health Conditions)
 * - Medications
 * - Procedures
 * - Immunizations
 * - Laboratory Results
 * - Vital Signs
 * - Clinical Notes
 * - Care Team Members
 * - Encounters
 * - Goals
 * - Health Concerns
 * - Provenance
 * - Social Determinants of Health (SDOH)
 * - Functional Status (NEW in v5)
 * - Mental/Cognitive Status (NEW in v5)
 * - Pregnancy Status (NEW in v5)
 * - Health Insurance Information (NEW in v5)
 * - Tribal Affiliation (NEW in v5)
 * - Sex Parameters for Clinical Use (NEW in v5)
 */

export type USCDIDataClass = 
  | 'patient_demographics'
  | 'allergies_intolerances'
  | 'problems'
  | 'medications'
  | 'procedures'
  | 'immunizations'
  | 'laboratory'
  | 'vital_signs'
  | 'clinical_notes'
  | 'care_team'
  | 'encounters'
  | 'goals'
  | 'health_concerns'
  | 'provenance'
  | 'sdoh'
  | 'functional_status'
  | 'mental_cognitive_status'
  | 'pregnancy_status'
  | 'health_insurance'
  | 'tribal_affiliation'
  | 'sex_parameters_clinical_use';

export interface USCDIv5DataElement {
  dataClass: USCDIDataClass;
  fhirResourceType: string;
  fhirProfile: string;
  requiredElements: string[];
  optionalElements: string[];
  terminology: string[];
  description: string;
}

export interface USCDIv5ExchangeRequest {
  patientId: string;
  requestedDataClasses: USCDIDataClass[];
  dateRange?: { start: string; end: string };
  purpose: 'treatment' | 'payment' | 'healthcare_operations' | 'patient_request' | 'public_health' | 'research';
  requestingOrganization: string;
  requestingProvider?: string;
}

export interface USCDIv5ExchangeResponse {
  exchangeId: string;
  patientId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  requestedAt: string;
  completedAt?: string;
  dataBundle: USCDIv5DataBundle;
  provenance: USCDIv5Provenance;
  errors?: USCDIv5ExchangeError[];
}

export interface USCDIv5DataBundle {
  bundleId: string;
  bundleType: 'collection' | 'document' | 'message' | 'transaction';
  totalResources: number;
  resources: USCDIv5Resource[];
  signature?: string;
}

export interface USCDIv5Resource {
  resourceId: string;
  resourceType: string;
  dataClass: USCDIDataClass;
  fhirVersion: 'R4' | 'R4B';
  profile: string;
  data: Record<string, unknown>;
  lastUpdated: string;
  source: string;
}

export interface USCDIv5Provenance {
  provenanceId: string;
  recorded: string;
  agent: {
    type: 'author' | 'performer' | 'verifier' | 'attester';
    who: string;
    organization: string;
  }[];
  entity: {
    role: 'derivation' | 'revision' | 'quotation' | 'source';
    what: string;
  }[];
  signature?: {
    type: string;
    when: string;
    who: string;
    data: string;
  };
}

export interface USCDIv5ExchangeError {
  dataClass: USCDIDataClass;
  errorCode: string;
  errorMessage: string;
  recoverable: boolean;
}

export interface USCDIv5ValidationResult {
  valid: boolean;
  dataClass: USCDIDataClass;
  errors: { field: string; message: string; severity: 'error' | 'warning' }[];
  completenessScore: number;
}

class USCDIv5ExchangeService {
  private dataClassDefinitions: Map<USCDIDataClass, USCDIv5DataElement> = new Map();
  private activeExchanges: Map<string, USCDIv5ExchangeResponse> = new Map();
  private exchangeHistory: USCDIv5ExchangeResponse[] = [];

  constructor() {
    this.initializeDataClassDefinitions();
  }

  private initializeDataClassDefinitions(): void {
    const definitions: USCDIv5DataElement[] = [
      {
        dataClass: 'patient_demographics',
        fhirResourceType: 'Patient',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
        requiredElements: ['name', 'birthDate', 'gender', 'identifier'],
        optionalElements: ['address', 'telecom', 'communication', 'race', 'ethnicity', 'birthSex'],
        terminology: ['http://hl7.org/fhir/us/core/ValueSet/omb-race-category', 'http://hl7.org/fhir/us/core/ValueSet/omb-ethnicity-category'],
        description: 'Patient demographic information including identity, contact, and demographic data'
      },
      {
        dataClass: 'allergies_intolerances',
        fhirResourceType: 'AllergyIntolerance',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance',
        requiredElements: ['code', 'patient', 'clinicalStatus'],
        optionalElements: ['reaction', 'onset', 'criticality', 'recorder', 'note'],
        terminology: ['http://snomed.info/sct', 'http://www.nlm.nih.gov/research/umls/rxnorm'],
        description: 'Allergies, adverse reactions, and intolerances'
      },
      {
        dataClass: 'problems',
        fhirResourceType: 'Condition',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns',
        requiredElements: ['code', 'subject', 'clinicalStatus', 'category'],
        optionalElements: ['onset', 'abatement', 'severity', 'verificationStatus', 'bodySite'],
        terminology: ['http://snomed.info/sct', 'http://hl7.org/fhir/sid/icd-10-cm'],
        description: 'Health conditions and problems'
      },
      {
        dataClass: 'medications',
        fhirResourceType: 'MedicationRequest',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest',
        requiredElements: ['status', 'intent', 'medicationCodeableConcept', 'subject'],
        optionalElements: ['dosageInstruction', 'dispenseRequest', 'authoredOn', 'requester'],
        terminology: ['http://www.nlm.nih.gov/research/umls/rxnorm'],
        description: 'Medication orders, prescriptions, and administration'
      },
      {
        dataClass: 'procedures',
        fhirResourceType: 'Procedure',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure',
        requiredElements: ['status', 'code', 'subject', 'performedDateTime'],
        optionalElements: ['performer', 'location', 'bodySite', 'outcome', 'complication'],
        terminology: ['http://snomed.info/sct', 'http://www.ama-assn.org/go/cpt', 'http://www.cms.gov/Medicare/Coding/ICD10'],
        description: 'Surgical and medical procedures'
      },
      {
        dataClass: 'immunizations',
        fhirResourceType: 'Immunization',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization',
        requiredElements: ['status', 'vaccineCode', 'patient', 'occurrenceDateTime'],
        optionalElements: ['lotNumber', 'site', 'route', 'doseQuantity', 'performer'],
        terminology: ['http://hl7.org/fhir/sid/cvx', 'http://hl7.org/fhir/sid/ndc'],
        description: 'Vaccination and immunization records'
      },
      {
        dataClass: 'laboratory',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
        requiredElements: ['status', 'category', 'code', 'subject', 'effectiveDateTime', 'value'],
        optionalElements: ['interpretation', 'referenceRange', 'specimen', 'performer'],
        terminology: ['http://loinc.org', 'http://snomed.info/sct'],
        description: 'Laboratory test results and values'
      },
      {
        dataClass: 'vital_signs',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs',
        requiredElements: ['status', 'category', 'code', 'subject', 'effectiveDateTime', 'value'],
        optionalElements: ['interpretation', 'bodySite', 'method', 'device'],
        terminology: ['http://loinc.org'],
        description: 'Vital signs measurements including blood pressure, heart rate, temperature, etc.'
      },
      {
        dataClass: 'clinical_notes',
        fhirResourceType: 'DocumentReference',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference',
        requiredElements: ['status', 'type', 'category', 'subject', 'date', 'content'],
        optionalElements: ['author', 'custodian', 'context', 'description'],
        terminology: ['http://loinc.org', 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor'],
        description: 'Clinical documentation including discharge summaries, progress notes, etc.'
      },
      {
        dataClass: 'care_team',
        fhirResourceType: 'CareTeam',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam',
        requiredElements: ['status', 'subject', 'participant'],
        optionalElements: ['category', 'name', 'period', 'managingOrganization'],
        terminology: ['http://snomed.info/sct', 'http://nucc.org/provider-taxonomy'],
        description: 'Care team members and their roles'
      },
      {
        dataClass: 'encounters',
        fhirResourceType: 'Encounter',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter',
        requiredElements: ['status', 'class', 'type', 'subject', 'period'],
        optionalElements: ['participant', 'diagnosis', 'hospitalization', 'location'],
        terminology: ['http://snomed.info/sct', 'http://www.ama-assn.org/go/cpt'],
        description: 'Healthcare encounters and visits'
      },
      {
        dataClass: 'goals',
        fhirResourceType: 'Goal',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal',
        requiredElements: ['lifecycleStatus', 'description', 'subject'],
        optionalElements: ['target', 'startDate', 'statusDate', 'expressedBy'],
        terminology: ['http://snomed.info/sct', 'http://loinc.org'],
        description: 'Patient health goals'
      },
      {
        dataClass: 'health_concerns',
        fhirResourceType: 'Condition',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns',
        requiredElements: ['code', 'subject', 'category'],
        optionalElements: ['clinicalStatus', 'verificationStatus', 'onset', 'recordedDate'],
        terminology: ['http://snomed.info/sct', 'http://hl7.org/fhir/sid/icd-10-cm'],
        description: 'Health concerns identified by patient or provider'
      },
      {
        dataClass: 'provenance',
        fhirResourceType: 'Provenance',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance',
        requiredElements: ['target', 'recorded', 'agent'],
        optionalElements: ['reason', 'activity', 'entity', 'signature'],
        terminology: ['http://terminology.hl7.org/CodeSystem/v3-ParticipationType'],
        description: 'Provenance information tracking data origin'
      },
      {
        dataClass: 'sdoh',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-sdoh-assessment',
        requiredElements: ['status', 'category', 'code', 'subject', 'effectiveDateTime'],
        optionalElements: ['value', 'interpretation', 'derivedFrom', 'hasMember'],
        terminology: ['http://loinc.org', 'http://snomed.info/sct'],
        description: 'Social Determinants of Health assessments including food, housing, transportation'
      },
      {
        dataClass: 'functional_status',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-adi-documentation',
        requiredElements: ['status', 'category', 'code', 'subject', 'effectiveDateTime', 'value'],
        optionalElements: ['interpretation', 'performer', 'derivedFrom'],
        terminology: ['http://loinc.org', 'http://snomed.info/sct'],
        description: 'NEW v5: Functional status assessments including ADL, mobility, cognition'
      },
      {
        dataClass: 'mental_cognitive_status',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-screening-assessment',
        requiredElements: ['status', 'category', 'code', 'subject', 'effectiveDateTime'],
        optionalElements: ['value', 'interpretation', 'performer', 'derivedFrom'],
        terminology: ['http://loinc.org', 'http://snomed.info/sct'],
        description: 'NEW v5: Mental and cognitive status assessments'
      },
      {
        dataClass: 'pregnancy_status',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-pregnancy-status',
        requiredElements: ['status', 'code', 'subject', 'effectiveDateTime', 'value'],
        optionalElements: ['hasMember', 'derivedFrom', 'component'],
        terminology: ['http://loinc.org', 'http://snomed.info/sct'],
        description: 'NEW v5: Pregnancy status and related observations'
      },
      {
        dataClass: 'health_insurance',
        fhirResourceType: 'Coverage',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage',
        requiredElements: ['status', 'type', 'subscriber', 'beneficiary', 'payor'],
        optionalElements: ['period', 'class', 'network', 'costToBeneficiary'],
        terminology: ['http://terminology.hl7.org/CodeSystem/v3-ActCode'],
        description: 'NEW v5: Health insurance coverage information'
      },
      {
        dataClass: 'tribal_affiliation',
        fhirResourceType: 'Patient',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-tribal-affiliation',
        requiredElements: ['extension'],
        optionalElements: ['isEnrolled'],
        terminology: ['http://terminology.hl7.org/CodeSystem/v3-TribalEntityUS'],
        description: 'NEW v5: Tribal affiliation for federally recognized tribes'
      },
      {
        dataClass: 'sex_parameters_clinical_use',
        fhirResourceType: 'Observation',
        fhirProfile: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-sex-parameter-for-clinical-use',
        requiredElements: ['status', 'code', 'subject', 'value'],
        optionalElements: ['effectivePeriod', 'note', 'derivedFrom'],
        terminology: ['http://loinc.org', 'http://terminology.hl7.org/CodeSystem/sex-parameter-for-clinical-use'],
        description: 'NEW v5: Sex parameter observations for clinical decision-making'
      }
    ];

    definitions.forEach(def => this.dataClassDefinitions.set(def.dataClass, def));
  }

  getDataClassDefinitions(): USCDIv5DataElement[] {
    return Array.from(this.dataClassDefinitions.values());
  }

  getDataClassDefinition(dataClass: USCDIDataClass): USCDIv5DataElement | undefined {
    return this.dataClassDefinitions.get(dataClass);
  }

  async initiateExchange(request: USCDIv5ExchangeRequest): Promise<USCDIv5ExchangeResponse> {
    const exchangeId = `uscdi_v5_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const response: USCDIv5ExchangeResponse = {
      exchangeId,
      patientId: request.patientId,
      status: 'in_progress',
      requestedAt: new Date().toISOString(),
      dataBundle: {
        bundleId: `bundle_${exchangeId}`,
        bundleType: 'collection',
        totalResources: 0,
        resources: []
      },
      provenance: {
        provenanceId: `prov_${exchangeId}`,
        recorded: new Date().toISOString(),
        agent: [
          {
            type: 'performer',
            who: request.requestingProvider || 'System',
            organization: request.requestingOrganization
          }
        ],
        entity: []
      },
      errors: []
    };

    this.activeExchanges.set(exchangeId, response);

    // Process each requested data class
    for (const dataClass of request.requestedDataClasses) {
      try {
        const resources = await this.fetchDataClass(
          request.patientId,
          dataClass,
          request.dateRange
        );
        response.dataBundle.resources.push(...resources);
      } catch (error) {
        response.errors?.push({
          dataClass,
          errorCode: 'FETCH_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true
        });
      }
    }

    response.dataBundle.totalResources = response.dataBundle.resources.length;
    response.status = response.errors?.length ? 
      (response.dataBundle.resources.length > 0 ? 'partial' : 'failed') : 
      'completed';
    response.completedAt = new Date().toISOString();

    this.exchangeHistory.push(response);
    this.activeExchanges.delete(exchangeId);

    return response;
  }

  private async fetchDataClass(
    patientId: string,
    dataClass: USCDIDataClass,
    dateRange?: { start: string; end: string }
  ): Promise<USCDIv5Resource[]> {
    const definition = this.dataClassDefinitions.get(dataClass);
    if (!definition) {
      throw new Error(`Unknown data class: ${dataClass}`);
    }

    // Simulate fetching USCDI v5 compliant resources
    const mockResources = this.generateMockResources(patientId, dataClass, definition, dateRange);
    return mockResources;
  }

  private generateMockResources(
    patientId: string,
    dataClass: USCDIDataClass,
    definition: USCDIv5DataElement,
    dateRange?: { start: string; end: string }
  ): USCDIv5Resource[] {
    const resources: USCDIv5Resource[] = [];
    const now = new Date();
    
    // Generate sample resources based on data class
    const resourceData = this.getMockDataForClass(dataClass, patientId);
    
    resourceData.forEach((data, index) => {
      resources.push({
        resourceId: `${dataClass}_${patientId}_${index}`,
        resourceType: definition.fhirResourceType,
        dataClass,
        fhirVersion: 'R4',
        profile: definition.fhirProfile,
        data,
        lastUpdated: new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'Local EHR System'
      });
    });

    return resources;
  }

  private getMockDataForClass(dataClass: USCDIDataClass, patientId: string): Record<string, unknown>[] {
    const mockData: Record<USCDIDataClass, Record<string, unknown>[]> = {
      patient_demographics: [{
        resourceType: 'Patient',
        id: patientId,
        name: [{ family: 'Sample', given: ['Patient'] }],
        birthDate: '1980-05-15',
        gender: 'female',
        identifier: [{ system: 'http://hospital.org/mrn', value: patientId }]
      }],
      allergies_intolerances: [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '91936005', display: 'Penicillin allergy' }] }, clinicalStatus: { coding: [{ code: 'active' }] } },
        { code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7984', display: 'Ibuprofen' }] }, clinicalStatus: { coding: [{ code: 'active' }] } }
      ],
      problems: [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' }] }, clinicalStatus: { coding: [{ code: 'active' }] } },
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertensive disorder' }] }, clinicalStatus: { coding: [{ code: 'active' }] } }
      ],
      medications: [
        { medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin 500 MG' }] }, status: 'active', intent: 'order' },
        { medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '197361', display: 'Lisinopril 10 MG' }] }, status: 'active', intent: 'order' }
      ],
      procedures: [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '80146002', display: 'Appendectomy' }] }, status: 'completed', performedDateTime: '2023-06-15' }
      ],
      immunizations: [
        { vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '208', display: 'COVID-19 Pfizer' }] }, status: 'completed', occurrenceDateTime: '2024-01-10' },
        { vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '140', display: 'Influenza' }] }, status: 'completed', occurrenceDateTime: '2024-09-01' }
      ],
      laboratory: [
        { code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] }, valueQuantity: { value: 6.8, unit: '%' }, status: 'final' },
        { code: { coding: [{ system: 'http://loinc.org', code: '2345-7', display: 'Glucose' }] }, valueQuantity: { value: 126, unit: 'mg/dL' }, status: 'final' }
      ],
      vital_signs: [
        { code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] }, component: [{ code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: 128, unit: 'mmHg' } }, { code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: 82, unit: 'mmHg' } }] },
        { code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] }, valueQuantity: { value: 72, unit: '/min' } }
      ],
      clinical_notes: [
        { type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summarization of episode note' }] }, status: 'current', content: [{ attachment: { contentType: 'text/plain' } }] }
      ],
      care_team: [
        { status: 'active', participant: [{ role: [{ coding: [{ display: 'Primary Care Physician' }] }], member: { display: 'Dr. Smith' } }] }
      ],
      encounters: [
        { status: 'finished', class: { code: 'AMB', display: 'ambulatory' }, type: [{ coding: [{ display: 'Office Visit' }] }], period: { start: '2024-11-15', end: '2024-11-15' } }
      ],
      goals: [
        { lifecycleStatus: 'active', description: { text: 'Maintain HbA1c below 7%' }, target: [{ measure: { coding: [{ code: '4548-4' }] }, detailQuantity: { value: 7, unit: '%' } }] }
      ],
      health_concerns: [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '106063007', display: 'Cardiovascular risk' }] }, category: [{ coding: [{ code: 'health-concern' }] }] }
      ],
      provenance: [
        { target: [{ reference: 'Patient/' + patientId }], recorded: new Date().toISOString(), agent: [{ type: { coding: [{ code: 'author' }] }, who: { display: 'EHR System' } }] }
      ],
      sdoh: [
        { code: { coding: [{ system: 'http://loinc.org', code: '88122-7', display: 'Food insecurity screening' }] }, valueCodeableConcept: { coding: [{ code: 'LA33-6', display: 'Yes' }] }, status: 'final' }
      ],
      functional_status: [
        { code: { coding: [{ system: 'http://loinc.org', code: '88483-3', display: 'Functional status' }] }, valueCodeableConcept: { coding: [{ display: 'Independent with all ADLs' }] }, status: 'final' }
      ],
      mental_cognitive_status: [
        { code: { coding: [{ system: 'http://loinc.org', code: '72107-6', display: 'PHQ-9 depression screening' }] }, valueInteger: 4, interpretation: [{ coding: [{ display: 'Minimal depression' }] }], status: 'final' }
      ],
      pregnancy_status: [
        { code: { coding: [{ system: 'http://loinc.org', code: '82810-3', display: 'Pregnancy status' }] }, valueCodeableConcept: { coding: [{ code: 'LA26683-5', display: 'Not pregnant' }] }, status: 'final' }
      ],
      health_insurance: [
        { status: 'active', type: { coding: [{ code: 'EHCPOL', display: 'Extended healthcare' }] }, beneficiary: { reference: 'Patient/' + patientId }, payor: [{ display: 'Blue Cross Blue Shield' }] }
      ],
      tribal_affiliation: [],
      sex_parameters_clinical_use: [
        { code: { coding: [{ system: 'http://loinc.org', code: '99501-9', display: 'Sex parameter for clinical use' }] }, valueCodeableConcept: { coding: [{ code: 'female-typical', display: 'Apply female-typical setting' }] }, status: 'final' }
      ]
    };

    return mockData[dataClass] || [];
  }

  validateResource(resource: USCDIv5Resource): USCDIv5ValidationResult {
    const definition = this.dataClassDefinitions.get(resource.dataClass);
    if (!definition) {
      return {
        valid: false,
        dataClass: resource.dataClass,
        errors: [{ field: 'dataClass', message: 'Unknown data class', severity: 'error' }],
        completenessScore: 0
      };
    }

    const errors: { field: string; message: string; severity: 'error' | 'warning' }[] = [];
    let requiredFieldsPresent = 0;

    // Check required elements
    for (const element of definition.requiredElements) {
      if (!(element in (resource.data as Record<string, unknown>))) {
        errors.push({
          field: element,
          message: `Required element '${element}' is missing`,
          severity: 'error'
        });
      } else {
        requiredFieldsPresent++;
      }
    }

    // Check FHIR profile compliance
    if (resource.profile !== definition.fhirProfile) {
      errors.push({
        field: 'profile',
        message: `Profile mismatch: expected ${definition.fhirProfile}`,
        severity: 'warning'
      });
    }

    const completenessScore = definition.requiredElements.length > 0 
      ? (requiredFieldsPresent / definition.requiredElements.length) * 100 
      : 100;

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      dataClass: resource.dataClass,
      errors,
      completenessScore
    };
  }

  getExchangeStatus(exchangeId: string): USCDIv5ExchangeResponse | undefined {
    return this.activeExchanges.get(exchangeId) || 
           this.exchangeHistory.find(e => e.exchangeId === exchangeId);
  }

  getExchangeHistory(patientId?: string): USCDIv5ExchangeResponse[] {
    if (patientId) {
      return this.exchangeHistory.filter(e => e.patientId === patientId);
    }
    return this.exchangeHistory;
  }

  getSupportedDataClasses(): { dataClass: USCDIDataClass; description: string; isNewInV5: boolean }[] {
    const v5NewClasses: USCDIDataClass[] = [
      'functional_status',
      'mental_cognitive_status',
      'pregnancy_status',
      'health_insurance',
      'tribal_affiliation',
      'sex_parameters_clinical_use'
    ];

    return Array.from(this.dataClassDefinitions.entries()).map(([dataClass, def]) => ({
      dataClass,
      description: def.description,
      isNewInV5: v5NewClasses.includes(dataClass)
    }));
  }
}

export const uscdiV5ExchangeService = new USCDIv5ExchangeService();
