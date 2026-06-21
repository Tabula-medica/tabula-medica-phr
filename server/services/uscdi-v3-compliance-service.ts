import { storage } from "../storage";

export type USCDIv3DataClass =
  | "patient_demographics"
  | "allergies_intolerances"
  | "problems"
  | "medications"
  | "procedures"
  | "immunizations"
  | "laboratory"
  | "vital_signs"
  | "clinical_notes"
  | "care_team"
  | "encounters"
  | "goals"
  | "health_concerns"
  | "provenance"
  | "sdoh"
  | "health_insurance"
  | "health_status"
  | "diagnostic_imaging"
  | "assessment_plan"
  | "unique_device_identifier"
  | "clinical_tests"
  | "specimen";

export type USCDIv3ComplianceStatus = "compliant" | "partial" | "not_implemented" | "not_applicable";

export interface USCDIv3DataElement {
  name: string;
  fhirPath: string;
  required: boolean;
  newInV3: boolean;
  description: string;
}

export interface USCDIv3DataClassDefinition {
  dataClass: USCDIv3DataClass;
  label: string;
  fhirResourceType: string;
  fhirProfile: string;
  elements: USCDIv3DataElement[];
  terminology: string[];
  description: string;
  newInV3: boolean;
  complianceStatus: USCDIv3ComplianceStatus;
  implementationNotes: string;
}

export interface USCDIv3ComplianceSummary {
  version: "3.0";
  mandatoryDate: "2026-01-01";
  regulatoryBasis: "ONC HTI-1 Final Rule";
  totalDataClasses: number;
  totalElements: number;
  compliantClasses: number;
  partialClasses: number;
  notImplementedClasses: number;
  overallScore: number;
  dataClasses: USCDIv3DataClassDefinition[];
  newInV3Summary: {
    newDataClasses: string[];
    newElements: { dataClass: string; element: string }[];
  };
  lastAssessed: string;
}

export interface USCDIv3GapAnalysis {
  dataClass: USCDIv3DataClass;
  label: string;
  missingElements: string[];
  partialElements: string[];
  recommendations: string[];
  effort: "low" | "medium" | "high";
  priority: "critical" | "high" | "medium" | "low";
}

class USCDIv3ComplianceService {
  private definitions: USCDIv3DataClassDefinition[];

  constructor() {
    this.definitions = this.buildDefinitions();
  }

  private buildDefinitions(): USCDIv3DataClassDefinition[] {
    return [
      {
        dataClass: "patient_demographics",
        label: "Patient Demographics / Information",
        fhirResourceType: "Patient",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        elements: [
          { name: "First Name", fhirPath: "Patient.name.given", required: true, newInV3: false, description: "Patient's given name" },
          { name: "Last Name", fhirPath: "Patient.name.family", required: true, newInV3: false, description: "Patient's family name" },
          { name: "Previous Name", fhirPath: "Patient.name (use=old)", required: false, newInV3: false, description: "Previous/maiden name" },
          { name: "Suffix", fhirPath: "Patient.name.suffix", required: false, newInV3: false, description: "Name suffix (Jr., III)" },
          { name: "Date of Birth", fhirPath: "Patient.birthDate", required: true, newInV3: false, description: "Birth date" },
          { name: "Date of Death", fhirPath: "Patient.deceasedDateTime", required: false, newInV3: true, description: "NEW v3: Date of death if applicable" },
          { name: "Sex", fhirPath: "Patient.gender", required: true, newInV3: false, description: "Administrative gender" },
          { name: "Sexual Orientation", fhirPath: "Patient.extension:us-core-sexual-orientation", required: false, newInV3: false, description: "Sexual orientation identity" },
          { name: "Gender Identity", fhirPath: "Patient.extension:us-core-genderIdentity", required: false, newInV3: false, description: "Gender identity" },
          { name: "Race", fhirPath: "Patient.extension:us-core-race", required: true, newInV3: false, description: "OMB race categories" },
          { name: "Ethnicity", fhirPath: "Patient.extension:us-core-ethnicity", required: true, newInV3: false, description: "OMB ethnicity categories" },
          { name: "Tribal Affiliation", fhirPath: "Patient.extension:us-core-tribal-affiliation", required: false, newInV3: true, description: "NEW v3: Federally recognized tribal affiliation" },
          { name: "Preferred Language", fhirPath: "Patient.communication.language", required: true, newInV3: false, description: "Preferred communication language" },
          { name: "Address", fhirPath: "Patient.address", required: true, newInV3: false, description: "Home/mailing address" },
          { name: "Phone Number", fhirPath: "Patient.telecom (system=phone)", required: true, newInV3: false, description: "Contact phone number" },
          { name: "Email Address", fhirPath: "Patient.telecom (system=email)", required: false, newInV3: false, description: "Contact email" },
          { name: "Related Person's Name", fhirPath: "RelatedPerson.name", required: false, newInV3: true, description: "NEW v3: Emergency contact or related person name" },
          { name: "Related Person's Relationship", fhirPath: "RelatedPerson.relationship", required: false, newInV3: true, description: "NEW v3: Relationship type to patient" },
        ],
        terminology: [
          "OMB Race Categories (CDC Race & Ethnicity)",
          "OMB Ethnicity Categories",
          "Tribal Entity US (HL7)",
          "BCP 47 (Language Tags)",
        ],
        description: "Core patient identity and demographic information, expanded in v3 with Date of Death, Tribal Affiliation, and Related Person data.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Core demographics captured. v3 additions (Date of Death, Tribal Affiliation, Related Person) are implemented.",
      },
      {
        dataClass: "allergies_intolerances",
        label: "Allergies and Intolerances",
        fhirResourceType: "AllergyIntolerance",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
        elements: [
          { name: "Substance (Medication)", fhirPath: "AllergyIntolerance.code", required: true, newInV3: false, description: "Allergy substance coded (RxNorm for meds)" },
          { name: "Substance (Drug Class)", fhirPath: "AllergyIntolerance.code", required: true, newInV3: false, description: "Drug class allergen (NDF-RT)" },
          { name: "Reaction", fhirPath: "AllergyIntolerance.reaction.manifestation", required: false, newInV3: false, description: "Manifestation of reaction" },
          { name: "Criticality", fhirPath: "AllergyIntolerance.criticality", required: false, newInV3: false, description: "High, low, unable-to-assess" },
          { name: "Status", fhirPath: "AllergyIntolerance.clinicalStatus", required: true, newInV3: false, description: "Active, inactive, resolved" },
        ],
        terminology: ["RxNorm", "SNOMED CT", "NDF-RT"],
        description: "Allergy and intolerance information including substance, reaction, and criticality.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Fully implemented with SNOMED CT and RxNorm coding.",
      },
      {
        dataClass: "medications",
        label: "Medications",
        fhirResourceType: "MedicationRequest",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
        elements: [
          { name: "Medication Name", fhirPath: "MedicationRequest.medicationCodeableConcept", required: true, newInV3: false, description: "Medication coded with RxNorm" },
          { name: "Dose", fhirPath: "MedicationRequest.dosageInstruction.doseAndRate", required: false, newInV3: false, description: "Dose quantity and unit" },
          { name: "Frequency", fhirPath: "MedicationRequest.dosageInstruction.timing", required: false, newInV3: false, description: "Administration frequency" },
          { name: "Route", fhirPath: "MedicationRequest.dosageInstruction.route", required: false, newInV3: false, description: "Administration route" },
          { name: "Status", fhirPath: "MedicationRequest.status", required: true, newInV3: false, description: "Active, completed, stopped" },
          { name: "Fill Status", fhirPath: "MedicationRequest.dispenseRequest", required: false, newInV3: false, description: "Prescription fill status" },
        ],
        terminology: ["RxNorm", "SNOMED CT"],
        description: "Medication orders, prescriptions, and administration records.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Medication management fully implemented with RxNorm coding and deduplication.",
      },
      {
        dataClass: "problems",
        label: "Problems (Conditions)",
        fhirResourceType: "Condition",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
        elements: [
          { name: "Condition Code", fhirPath: "Condition.code", required: true, newInV3: false, description: "Problem coded (SNOMED CT / ICD-10-CM)" },
          { name: "Date of Diagnosis", fhirPath: "Condition.onsetDateTime", required: false, newInV3: false, description: "When condition was diagnosed" },
          { name: "Date of Resolution", fhirPath: "Condition.abatementDateTime", required: false, newInV3: false, description: "When condition resolved" },
          { name: "Clinical Status", fhirPath: "Condition.clinicalStatus", required: true, newInV3: false, description: "Active, recurrence, resolved" },
        ],
        terminology: ["SNOMED CT", "ICD-10-CM"],
        description: "Patient health conditions, diagnoses, and problem list.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Fully implemented with SNOMED CT and ICD-10-CM coding.",
      },
      {
        dataClass: "procedures",
        label: "Procedures",
        fhirResourceType: "Procedure",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
        elements: [
          { name: "Procedure Code", fhirPath: "Procedure.code", required: true, newInV3: false, description: "Procedure coded (SNOMED CT / CPT / HCPCS)" },
          { name: "Date Performed", fhirPath: "Procedure.performedDateTime", required: true, newInV3: false, description: "When procedure was performed" },
          { name: "Status", fhirPath: "Procedure.status", required: true, newInV3: false, description: "Completed, in-progress, not-done" },
          { name: "Reason for Referral", fhirPath: "ServiceRequest.reasonCode", required: false, newInV3: true, description: "NEW v3: Clinical reason the procedure/referral was initiated" },
          { name: "Performer", fhirPath: "Procedure.performer", required: false, newInV3: false, description: "Who performed the procedure" },
        ],
        terminology: ["SNOMED CT", "CPT", "HCPCS", "ICD-10-PCS"],
        description: "Surgical and medical procedures. v3 adds Reason for Referral to support care coordination context.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Procedures implemented. v3 Reason for Referral added via ServiceRequest linkage.",
      },
      {
        dataClass: "immunizations",
        label: "Immunizations",
        fhirResourceType: "Immunization",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
        elements: [
          { name: "Vaccine Code", fhirPath: "Immunization.vaccineCode", required: true, newInV3: false, description: "Vaccine type (CVX code)" },
          { name: "Date Administered", fhirPath: "Immunization.occurrenceDateTime", required: true, newInV3: false, description: "Administration date" },
          { name: "Status", fhirPath: "Immunization.status", required: true, newInV3: false, description: "Completed, entered-in-error, not-done" },
          { name: "Lot Number", fhirPath: "Immunization.lotNumber", required: false, newInV3: false, description: "Vaccine lot number" },
        ],
        terminology: ["CVX", "NDC"],
        description: "Vaccination and immunization records.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Immunizations fully implemented with CVX coding.",
      },
      {
        dataClass: "laboratory",
        label: "Laboratory",
        fhirResourceType: "Observation",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
        elements: [
          { name: "Test Name", fhirPath: "Observation.code", required: true, newInV3: false, description: "Lab test coded (LOINC)" },
          { name: "Result Value", fhirPath: "Observation.value[x]", required: true, newInV3: false, description: "Lab result value" },
          { name: "Result Unit", fhirPath: "Observation.valueQuantity.unit", required: false, newInV3: false, description: "Unit of measure (UCUM)" },
          { name: "Result Date", fhirPath: "Observation.effectiveDateTime", required: true, newInV3: false, description: "Specimen collection / result date" },
          { name: "Result Status", fhirPath: "Observation.status", required: true, newInV3: false, description: "Final, preliminary, corrected" },
          { name: "Reference Range", fhirPath: "Observation.referenceRange", required: false, newInV3: false, description: "Normal range for this test" },
          { name: "Result Interpretation", fhirPath: "Observation.interpretation", required: false, newInV3: false, description: "High, low, normal, critical" },
          { name: "Specimen Type", fhirPath: "Specimen.type", required: false, newInV3: false, description: "Type of specimen collected" },
        ],
        terminology: ["LOINC", "SNOMED CT", "UCUM"],
        description: "Laboratory test results including values, units, and reference ranges.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Lab results fully implemented with LOINC coding and abnormal flagging.",
      },
      {
        dataClass: "vital_signs",
        label: "Vital Signs",
        fhirResourceType: "Observation",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs",
        elements: [
          { name: "Vital Sign Type", fhirPath: "Observation.code", required: true, newInV3: false, description: "Type of vital sign (LOINC)" },
          { name: "Value", fhirPath: "Observation.value[x]", required: true, newInV3: false, description: "Measured value" },
          { name: "Unit", fhirPath: "Observation.valueQuantity.unit", required: true, newInV3: false, description: "UCUM unit of measure" },
          { name: "Date/Time", fhirPath: "Observation.effectiveDateTime", required: true, newInV3: false, description: "When measurement was taken" },
        ],
        terminology: ["LOINC", "UCUM"],
        description: "Vital signs: blood pressure, heart rate, respiratory rate, temperature, oxygen saturation, height, weight, BMI.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "8 vital types implemented with trend tracking and normal range bands.",
      },
      {
        dataClass: "clinical_notes",
        label: "Clinical Notes",
        fhirResourceType: "DocumentReference",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
        elements: [
          { name: "Note Type", fhirPath: "DocumentReference.type", required: true, newInV3: false, description: "Type of clinical note (LOINC)" },
          { name: "Note Content", fhirPath: "DocumentReference.content.attachment", required: true, newInV3: false, description: "Note text content" },
          { name: "Author", fhirPath: "DocumentReference.author", required: false, newInV3: false, description: "Who wrote the note" },
          { name: "Date", fhirPath: "DocumentReference.date", required: true, newInV3: false, description: "Note creation date" },
        ],
        terminology: ["LOINC"],
        description: "Clinical notes per ONC 21st Century Cures: Consultation, Discharge Summary, History & Physical, Progress, Imaging Narrative, Lab Report Narrative, Pathology, Procedure, Referral.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Document management implemented with OCR, AI summarization, and categorization.",
      },
      {
        dataClass: "care_team",
        label: "Care Team Member(s)",
        fhirResourceType: "CareTeam",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam",
        elements: [
          { name: "Name", fhirPath: "CareTeam.participant.member", required: true, newInV3: false, description: "Team member name" },
          { name: "Role", fhirPath: "CareTeam.participant.role", required: true, newInV3: false, description: "Care team role" },
          { name: "Location", fhirPath: "CareTeam.participant.member.resolve().address", required: false, newInV3: false, description: "Practice location" },
          { name: "Telecom", fhirPath: "CareTeam.participant.member.resolve().telecom", required: false, newInV3: false, description: "Contact information" },
        ],
        terminology: ["SNOMED CT", "NUCC Health Care Provider Taxonomy"],
        description: "Care team members, roles, and contact information.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Care team hub with invitations, shared health view, and secure messaging.",
      },
      {
        dataClass: "encounters",
        label: "Encounter Information",
        fhirResourceType: "Encounter",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
        elements: [
          { name: "Encounter Type", fhirPath: "Encounter.type", required: true, newInV3: false, description: "Type of encounter (CPT/SNOMED)" },
          { name: "Encounter Period", fhirPath: "Encounter.period", required: true, newInV3: false, description: "Start and end date/time" },
          { name: "Encounter Diagnosis", fhirPath: "Encounter.diagnosis", required: false, newInV3: false, description: "Diagnoses associated with encounter" },
          { name: "Encounter Disposition", fhirPath: "Encounter.hospitalization.dischargeDisposition", required: false, newInV3: false, description: "Discharge disposition" },
          { name: "Encounter Location", fhirPath: "Encounter.location", required: false, newInV3: false, description: "Where encounter occurred" },
        ],
        terminology: ["CPT", "SNOMED CT"],
        description: "Healthcare encounters and visits with diagnosis and disposition.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Encounters tracked through appointment and telehealth systems.",
      },
      {
        dataClass: "goals",
        label: "Goals",
        fhirResourceType: "Goal",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
        elements: [
          { name: "Goal Description", fhirPath: "Goal.description", required: true, newInV3: false, description: "Text description of goal" },
          { name: "Goal Status", fhirPath: "Goal.lifecycleStatus", required: true, newInV3: false, description: "Proposed, active, completed, cancelled" },
          { name: "Target Date", fhirPath: "Goal.target.dueDate", required: false, newInV3: false, description: "Target completion date" },
        ],
        terminology: ["SNOMED CT", "LOINC"],
        description: "Patient health goals and treatment objectives.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Health goals with AI-assisted tracking and progress monitoring.",
      },
      {
        dataClass: "health_concerns",
        label: "Health Concerns",
        fhirResourceType: "Condition",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
        elements: [
          { name: "Health Concern", fhirPath: "Condition.code", required: true, newInV3: false, description: "Health concern coded (SNOMED CT)" },
          { name: "Status", fhirPath: "Condition.clinicalStatus", required: true, newInV3: false, description: "Active, resolved" },
        ],
        terminology: ["SNOMED CT", "ICD-10-CM"],
        description: "Patient-reported and provider-identified health concerns.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Health concerns tracked through condition and health insights systems.",
      },
      {
        dataClass: "provenance",
        label: "Provenance",
        fhirResourceType: "Provenance",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance",
        elements: [
          { name: "Author", fhirPath: "Provenance.agent", required: true, newInV3: false, description: "Who authored/transmitted the data" },
          { name: "Author Organization", fhirPath: "Provenance.agent.onBehalfOf", required: true, newInV3: false, description: "Organization of the author" },
          { name: "Author Time Stamp", fhirPath: "Provenance.recorded", required: true, newInV3: false, description: "When the data was authored" },
          { name: "Author Role", fhirPath: "Provenance.agent.type", required: true, newInV3: false, description: "Author, transmitter, assembler" },
        ],
        terminology: ["HL7 v3 ParticipationType"],
        description: "Data provenance tracking origin, authorship, and transmission.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "WORM audit log and data lineage management track all provenance.",
      },
      {
        dataClass: "sdoh",
        label: "Social Determinants of Health (SDOH)",
        fhirResourceType: "Observation",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-screening-assessment",
        elements: [
          { name: "SDOH Assessment", fhirPath: "Observation.code", required: true, newInV3: false, description: "SDOH screening instrument (LOINC)" },
          { name: "SDOH Category", fhirPath: "Observation.category", required: true, newInV3: false, description: "Food, housing, transportation, etc." },
          { name: "Assessment Value", fhirPath: "Observation.value[x]", required: true, newInV3: false, description: "Screening result" },
          { name: "Date of Assessment", fhirPath: "Observation.effectiveDateTime", required: true, newInV3: false, description: "When assessment was performed" },
          { name: "SDOH Goals", fhirPath: "Goal (category=sdoh)", required: false, newInV3: false, description: "Goals related to SDOH concerns" },
          { name: "SDOH Interventions", fhirPath: "ServiceRequest (category=sdoh)", required: false, newInV3: false, description: "Referrals/services for SDOH needs" },
        ],
        terminology: ["LOINC", "SNOMED CT", "ICD-10-CM"],
        description: "Social determinants including food insecurity, housing instability, transportation needs, interpersonal violence, education level.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "SDOH assessments implemented with screening tools and referral tracking.",
      },
      {
        dataClass: "health_insurance",
        label: "Health Insurance Information",
        fhirResourceType: "Coverage",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage",
        elements: [
          { name: "Coverage Status", fhirPath: "Coverage.status", required: true, newInV3: true, description: "NEW v3: Active, cancelled, entered-in-error" },
          { name: "Coverage Type", fhirPath: "Coverage.type", required: true, newInV3: true, description: "NEW v3: Type of insurance coverage" },
          { name: "Relationship to Subscriber", fhirPath: "Coverage.relationship", required: true, newInV3: true, description: "NEW v3: Self, spouse, child, other" },
          { name: "Member Identifier", fhirPath: "Coverage.identifier", required: true, newInV3: true, description: "NEW v3: Insurance member ID" },
          { name: "Subscriber Identifier", fhirPath: "Coverage.subscriberId", required: false, newInV3: true, description: "NEW v3: Subscriber ID" },
          { name: "Group Identifier", fhirPath: "Coverage.class (type=group)", required: false, newInV3: true, description: "NEW v3: Insurance group number" },
          { name: "Payer Identifier", fhirPath: "Coverage.payor", required: true, newInV3: true, description: "NEW v3: Insurance company/payer" },
          { name: "Plan Identifier", fhirPath: "Coverage.class (type=plan)", required: false, newInV3: true, description: "NEW v3: Insurance plan ID" },
          { name: "Coverage Period", fhirPath: "Coverage.period", required: false, newInV3: true, description: "NEW v3: Coverage start and end dates" },
        ],
        terminology: ["HL7 v3 ActCode", "X12 Insurance Type"],
        description: "NEW v3 DATA CLASS: Health insurance coverage information to streamline billing and insurance verification across systems.",
        newInV3: true,
        complianceStatus: "compliant",
        implementationNotes: "Insurance coverage implemented through billing system with Stripe integration for payment processing.",
      },
      {
        dataClass: "health_status",
        label: "Health Status Assessments",
        fhirResourceType: "Observation",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-screening-assessment",
        elements: [
          { name: "Disability Status", fhirPath: "Observation.code (LOINC:69861-3)", required: false, newInV3: true, description: "NEW v3: Patient disability status assessment" },
          { name: "Functional Status", fhirPath: "Observation.code (LOINC:88483-3)", required: false, newInV3: true, description: "NEW v3: ADL independence, mobility, self-care capabilities" },
          { name: "Mental/Cognitive Status", fhirPath: "Observation.code (LOINC:72107-6)", required: false, newInV3: true, description: "NEW v3: Cognitive function, depression screening (PHQ-9), anxiety (GAD-7)" },
          { name: "Pregnancy Status", fhirPath: "Observation.code (LOINC:82810-3)", required: false, newInV3: true, description: "NEW v3: Current pregnancy status and related observations" },
        ],
        terminology: ["LOINC", "SNOMED CT"],
        description: "NEW v3 DATA CLASS: Comprehensive health status capturing disability, functional, cognitive, and pregnancy status for a complete picture of patient well-being.",
        newInV3: true,
        complianceStatus: "compliant",
        implementationNotes: "Health status assessments implemented through patient intake and periodic screening workflows.",
      },
      {
        dataClass: "diagnostic_imaging",
        label: "Diagnostic Imaging",
        fhirResourceType: "DiagnosticReport",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-note",
        elements: [
          { name: "Imaging Study", fhirPath: "DiagnosticReport.code", required: true, newInV3: false, description: "Type of imaging study (LOINC)" },
          { name: "Imaging Report", fhirPath: "DiagnosticReport.presentedForm", required: false, newInV3: false, description: "Radiology report narrative" },
          { name: "Date of Study", fhirPath: "DiagnosticReport.effectiveDateTime", required: true, newInV3: false, description: "When imaging was performed" },
          { name: "Status", fhirPath: "DiagnosticReport.status", required: true, newInV3: false, description: "Final, preliminary, amended" },
        ],
        terminology: ["LOINC", "SNOMED CT"],
        description: "Diagnostic imaging reports and results.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "DICOM viewer with AI findings, PACS integration, and workflow automation.",
      },
      {
        dataClass: "assessment_plan",
        label: "Assessment and Plan of Treatment",
        fhirResourceType: "CarePlan",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
        elements: [
          { name: "Assessment", fhirPath: "CarePlan.activity", required: true, newInV3: false, description: "Clinical assessment details" },
          { name: "Plan of Treatment", fhirPath: "CarePlan.activity.detail", required: true, newInV3: false, description: "Planned treatment activities" },
          { name: "Status", fhirPath: "CarePlan.status", required: true, newInV3: false, description: "Draft, active, completed" },
        ],
        terminology: ["SNOMED CT", "LOINC"],
        description: "Clinical assessment and care plan activities.",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Care plans with AI-assisted generation, collaborative editing, and progress tracking.",
      },
      {
        dataClass: "unique_device_identifier",
        label: "Unique Device Identifier(s) for Patient's Implantable Device(s)",
        fhirResourceType: "Device",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-implantable-device",
        elements: [
          { name: "UDI", fhirPath: "Device.udiCarrier", required: true, newInV3: false, description: "FDA Unique Device Identifier" },
          { name: "Device Type", fhirPath: "Device.type", required: true, newInV3: false, description: "Type of implantable device" },
          { name: "Distinct Identification Code", fhirPath: "Device.distinctIdentifier", required: false, newInV3: false, description: "Distinct ID for the device" },
        ],
        terminology: ["SNOMED CT", "GUDID (FDA)"],
        description: "Implantable device identifiers per FDA UDI requirements.",
        newInV3: false,
        complianceStatus: "partial",
        implementationNotes: "Device tracking is partial; UDI capture available but GUDID lookup not yet integrated.",
      },
      {
        dataClass: "clinical_tests",
        label: "Clinical Tests",
        fhirResourceType: "Observation",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-clinical-result",
        elements: [
          { name: "Test Name", fhirPath: "Observation.code", required: true, newInV3: false, description: "Clinical test type (LOINC)" },
          { name: "Test Result", fhirPath: "Observation.value[x]", required: true, newInV3: false, description: "Test result value" },
          { name: "Date", fhirPath: "Observation.effectiveDateTime", required: true, newInV3: false, description: "When test was performed" },
          { name: "Status", fhirPath: "Observation.status", required: true, newInV3: false, description: "Final, preliminary" },
        ],
        terminology: ["LOINC", "SNOMED CT"],
        description: "Non-laboratory clinical test results (cardiology, pulmonology, etc).",
        newInV3: false,
        complianceStatus: "compliant",
        implementationNotes: "Clinical observations tracked through vitals and health metrics systems.",
      },
      {
        dataClass: "specimen",
        label: "Specimen",
        fhirResourceType: "Specimen",
        fhirProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-specimen",
        elements: [
          { name: "Specimen Type", fhirPath: "Specimen.type", required: true, newInV3: false, description: "Type of specimen (SNOMED CT)" },
          { name: "Specimen Source", fhirPath: "Specimen.collection.bodySite", required: false, newInV3: false, description: "Body site of collection" },
          { name: "Collection Date", fhirPath: "Specimen.collection.collectedDateTime", required: false, newInV3: false, description: "When specimen was collected" },
        ],
        terminology: ["SNOMED CT"],
        description: "Specimen information linked to laboratory results.",
        newInV3: false,
        complianceStatus: "partial",
        implementationNotes: "Basic specimen type captured with lab results. Detailed specimen tracking is partial.",
      },
    ];
  }

  getComplianceSummary(): USCDIv3ComplianceSummary {
    const totalElements = this.definitions.reduce((sum, dc) => sum + dc.elements.length, 0);
    const compliantClasses = this.definitions.filter((d) => d.complianceStatus === "compliant").length;
    const partialClasses = this.definitions.filter((d) => d.complianceStatus === "partial").length;
    const notImplementedClasses = this.definitions.filter((d) => d.complianceStatus === "not_implemented").length;
    const overallScore = Math.round(
      ((compliantClasses + partialClasses * 0.5) / this.definitions.length) * 100
    );

    const newInV3Classes = this.definitions.filter((d) => d.newInV3).map((d) => d.label);
    const newInV3Elements: { dataClass: string; element: string }[] = [];
    this.definitions.forEach((dc) => {
      dc.elements
        .filter((e) => e.newInV3)
        .forEach((e) => {
          newInV3Elements.push({ dataClass: dc.label, element: e.name });
        });
    });

    return {
      version: "3.0",
      mandatoryDate: "2026-01-01",
      regulatoryBasis: "ONC HTI-1 Final Rule",
      totalDataClasses: this.definitions.length,
      totalElements: totalElements,
      compliantClasses,
      partialClasses,
      notImplementedClasses,
      overallScore,
      dataClasses: this.definitions,
      newInV3Summary: {
        newDataClasses: newInV3Classes,
        newElements: newInV3Elements,
      },
      lastAssessed: new Date().toISOString(),
    };
  }

  getDataClassDetail(dataClass: USCDIv3DataClass): USCDIv3DataClassDefinition | undefined {
    return this.definitions.find((d) => d.dataClass === dataClass);
  }

  getGapAnalysis(): USCDIv3GapAnalysis[] {
    return this.definitions
      .filter((d) => d.complianceStatus !== "compliant")
      .map((d) => {
        const missingElements = d.elements
          .filter((e) => e.required)
          .map((e) => e.name);
        const partialElements = d.elements
          .filter((e) => !e.required)
          .map((e) => e.name);

        let recommendations: string[] = [];
        let effort: "low" | "medium" | "high" = "medium";
        let priority: "critical" | "high" | "medium" | "low" = "high";

        if (d.dataClass === "unique_device_identifier") {
          recommendations = [
            "Integrate FDA GUDID (Global Unique Device Identification Database) lookup API",
            "Add UDI barcode scanning capability to device registration workflow",
            "Map existing device records to GUDID identifiers",
          ];
          effort = "medium";
          priority = "medium";
        } else if (d.dataClass === "specimen") {
          recommendations = [
            "Extend lab result forms to capture detailed specimen metadata",
            "Add SNOMED CT coded specimen type selection to lab order workflow",
            "Link specimen records to corresponding Observation resources",
          ];
          effort = "low";
          priority = "medium";
        }

        return {
          dataClass: d.dataClass,
          label: d.label,
          missingElements,
          partialElements,
          recommendations,
          effort,
          priority,
        };
      });
  }

  async getPatientDataCompleteness(patientId: string): Promise<{
    patientId: string;
    dataClasses: { dataClass: string; label: string; hasData: boolean; recordCount: number }[];
    overallCompleteness: number;
  }> {
    const results: { dataClass: string; label: string; hasData: boolean; recordCount: number }[] = [];

    for (const def of this.definitions) {
      let recordCount = 0;

      try {
        switch (def.dataClass) {
          case "medications": {
            const meds = await storage.getMedicationsByPatient(patientId);
            recordCount = meds.length;
            break;
          }
          case "vital_signs": {
            const vitals = await storage.getVitalsByPatient(patientId);
            recordCount = vitals.length;
            break;
          }
          case "laboratory": {
            const labs = await storage.getLabResultsByPatient(patientId);
            recordCount = labs.length;
            break;
          }
          case "immunizations": {
            const imms = await storage.getImmunizations(patientId);
            recordCount = imms.length;
            break;
          }
          case "allergies_intolerances": {
            const allergies = await storage.getAllergiesByPatient(patientId);
            recordCount = allergies.length;
            break;
          }
          case "problems": {
            const problems = await storage.getProblemsByPatient(patientId);
            recordCount = problems.length;
            break;
          }
          default:
            recordCount = 0;
        }
      } catch {
        recordCount = 0;
      }

      results.push({
        dataClass: def.dataClass,
        label: def.label,
        hasData: recordCount > 0,
        recordCount,
      });
    }

    const classesWithData = results.filter((r) => r.hasData).length;
    const overallCompleteness = Math.round((classesWithData / results.length) * 100);

    return { patientId, dataClasses: results, overallCompleteness };
  }
}

export const uscdiV3ComplianceService = new USCDIv3ComplianceService();
