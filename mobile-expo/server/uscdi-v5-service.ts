/**
 * USCDI v6 (United States Core Data for Interoperability) Service
 * Implements the ONC USCDI v6 data set for standardized health data exchange
 * https://www.healthit.gov/isa/united-states-core-data-interoperability-uscdi
 */

interface USCDIv6DataClass {
  name: string;
  version: "v6";
  dataElements: USCDIDataElement[];
  fhirResources: string[];
  required: boolean;
}

interface USCDIDataElement {
  name: string;
  description: string;
  fhirPath: string;
  vocabulary?: string[];
  cardinality: "0..1" | "0..*" | "1..1" | "1..*";
  mustSupport: boolean;
}

interface USCDIv6Bundle {
  resourceType: "Bundle";
  type: "collection";
  meta: {
    profile: string[];
    lastUpdated: string;
  };
  identifier: {
    system: string;
    value: string;
  };
  entry: USCDIBundleEntry[];
  uscdiVersion: "v6";
  dataClasses: string[];
  completeness: number;
}

interface USCDIBundleEntry {
  fullUrl: string;
  resource: any;
  search?: { mode: string };
}

interface USCDIValidationResult {
  valid: boolean;
  uscdiVersion: "v6";
  dataClassCoverage: Record<string, DataClassCoverage>;
  errors: USCDIValidationError[];
  warnings: USCDIValidationWarning[];
  completenessScore: number;
}

interface DataClassCoverage {
  dataClass: string;
  required: boolean;
  elementsPresent: number;
  elementsTotal: number;
  coverage: number;
  missingElements: string[];
}

interface USCDIValidationError {
  dataClass: string;
  element: string;
  message: string;
  severity: "error";
  fhirPath?: string;
}

interface USCDIValidationWarning {
  dataClass: string;
  element: string;
  message: string;
  severity: "warning";
  suggestion?: string;
}

const USCDI_V6_DATA_CLASSES: USCDIv6DataClass[] = [
  {
    name: "Patient Demographics",
    version: "v6",
    required: true,
    fhirResources: ["Patient"],
    dataElements: [
      { name: "First Name", description: "Patient's given name", fhirPath: "Patient.name.given", cardinality: "1..*", mustSupport: true },
      { name: "Last Name", description: "Patient's family name", fhirPath: "Patient.name.family", cardinality: "1..1", mustSupport: true },
      { name: "Middle Name", description: "Patient's middle name", fhirPath: "Patient.name.given[1]", cardinality: "0..1", mustSupport: false },
      { name: "Suffix", description: "Name suffix (Jr, Sr, III)", fhirPath: "Patient.name.suffix", cardinality: "0..1", mustSupport: false },
      { name: "Previous Name", description: "Former names", fhirPath: "Patient.name.use='old'", cardinality: "0..*", mustSupport: true },
      { name: "Date of Birth", description: "Patient's birth date", fhirPath: "Patient.birthDate", cardinality: "1..1", mustSupport: true },
      { name: "Date of Death", description: "Patient's death date if applicable", fhirPath: "Patient.deceasedDateTime", cardinality: "0..1", mustSupport: true },
      { name: "Sex", description: "Administrative sex", fhirPath: "Patient.gender", vocabulary: ["male", "female", "other", "unknown"], cardinality: "1..1", mustSupport: true },
      { name: "Sexual Orientation", description: "Patient's sexual orientation", fhirPath: "Patient.extension:sexualOrientation", cardinality: "0..1", mustSupport: true },
      { name: "Gender Identity", description: "Patient's gender identity", fhirPath: "Patient.extension:genderIdentity", cardinality: "0..1", mustSupport: true },
      { name: "Race", description: "Patient's race(s)", fhirPath: "Patient.extension:race", vocabulary: ["OMB Race Categories"], cardinality: "0..*", mustSupport: true },
      { name: "Ethnicity", description: "Patient's ethnicity", fhirPath: "Patient.extension:ethnicity", vocabulary: ["OMB Ethnicity Categories"], cardinality: "0..1", mustSupport: true },
      { name: "Tribal Affiliation", description: "Tribal membership if applicable", fhirPath: "Patient.extension:tribalAffiliation", cardinality: "0..*", mustSupport: true },
      { name: "Preferred Language", description: "Patient's preferred language", fhirPath: "Patient.communication.language", vocabulary: ["BCP-47"], cardinality: "0..1", mustSupport: true },
      { name: "Address", description: "Patient's address(es)", fhirPath: "Patient.address", cardinality: "0..*", mustSupport: true },
      { name: "Phone Number", description: "Contact phone numbers", fhirPath: "Patient.telecom.system='phone'", cardinality: "0..*", mustSupport: true },
      { name: "Email Address", description: "Email contact", fhirPath: "Patient.telecom.system='email'", cardinality: "0..*", mustSupport: true },
      { name: "Related Person's Name", description: "Emergency contact/caregiver", fhirPath: "RelatedPerson.name", cardinality: "0..*", mustSupport: true },
      { name: "Related Person's Relationship", description: "Relationship to patient", fhirPath: "RelatedPerson.relationship", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Allergies and Intolerances",
    version: "v6",
    required: true,
    fhirResources: ["AllergyIntolerance"],
    dataElements: [
      { name: "Substance (Medication)", description: "Medication causing allergy", fhirPath: "AllergyIntolerance.code", vocabulary: ["RxNorm"], cardinality: "1..1", mustSupport: true },
      { name: "Substance (Drug Class)", description: "Drug class causing allergy", fhirPath: "AllergyIntolerance.code", vocabulary: ["NDF-RT"], cardinality: "0..1", mustSupport: true },
      { name: "Substance (Non-Medication)", description: "Non-medication allergen", fhirPath: "AllergyIntolerance.code", vocabulary: ["SNOMED CT"], cardinality: "0..1", mustSupport: true },
      { name: "Reaction", description: "Allergic reaction manifestation", fhirPath: "AllergyIntolerance.reaction.manifestation", vocabulary: ["SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Severity", description: "Reaction severity", fhirPath: "AllergyIntolerance.reaction.severity", vocabulary: ["mild", "moderate", "severe"], cardinality: "0..1", mustSupport: true },
      { name: "Status", description: "Allergy status", fhirPath: "AllergyIntolerance.clinicalStatus", cardinality: "1..1", mustSupport: true }
    ]
  },
  {
    name: "Medications",
    version: "v6",
    required: true,
    fhirResources: ["MedicationRequest", "MedicationStatement", "MedicationAdministration"],
    dataElements: [
      { name: "Medication", description: "Medication name/code", fhirPath: "MedicationRequest.medicationCodeableConcept", vocabulary: ["RxNorm"], cardinality: "1..1", mustSupport: true },
      { name: "Dose", description: "Medication dose", fhirPath: "MedicationRequest.dosageInstruction.doseAndRate.doseQuantity", cardinality: "0..1", mustSupport: true },
      { name: "Dose Unit of Measure", description: "Unit for dose", fhirPath: "MedicationRequest.dosageInstruction.doseAndRate.doseQuantity.unit", vocabulary: ["UCUM"], cardinality: "0..1", mustSupport: true },
      { name: "Indication", description: "Reason for medication", fhirPath: "MedicationRequest.reasonCode", vocabulary: ["SNOMED CT", "ICD-10-CM"], cardinality: "0..*", mustSupport: true },
      { name: "Fill Status", description: "Prescription fill status", fhirPath: "MedicationRequest.status", cardinality: "1..1", mustSupport: true },
      { name: "Medication Instructions", description: "Sig/directions", fhirPath: "MedicationRequest.dosageInstruction.text", cardinality: "0..1", mustSupport: true },
      { name: "Medication Adherence", description: "Patient adherence to medication", fhirPath: "MedicationStatement.adherence", cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Problems",
    version: "v6",
    required: true,
    fhirResources: ["Condition"],
    dataElements: [
      { name: "SDOH Problems/Health Concerns", description: "Social determinants of health", fhirPath: "Condition.code", vocabulary: ["SNOMED CT", "ICD-10-CM"], cardinality: "0..*", mustSupport: true },
      { name: "Problems", description: "Medical problems/diagnoses", fhirPath: "Condition.code", vocabulary: ["SNOMED CT", "ICD-10-CM"], cardinality: "0..*", mustSupport: true },
      { name: "Date of Diagnosis", description: "When problem was diagnosed", fhirPath: "Condition.onsetDateTime", cardinality: "0..1", mustSupport: true },
      { name: "Date of Resolution", description: "When problem resolved", fhirPath: "Condition.abatementDateTime", cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Laboratory",
    version: "v6",
    required: true,
    fhirResources: ["Observation", "DiagnosticReport"],
    dataElements: [
      { name: "Tests", description: "Laboratory test performed", fhirPath: "Observation.code", vocabulary: ["LOINC"], cardinality: "1..1", mustSupport: true },
      { name: "Values/Results", description: "Test result value", fhirPath: "Observation.value[x]", cardinality: "0..1", mustSupport: true },
      { name: "Interpretation", description: "Result interpretation", fhirPath: "Observation.interpretation", vocabulary: ["ObservationInterpretation"], cardinality: "0..1", mustSupport: true },
      { name: "Reference Range", description: "Normal range for test", fhirPath: "Observation.referenceRange", cardinality: "0..*", mustSupport: true },
      { name: "Result Status", description: "Status of result", fhirPath: "Observation.status", cardinality: "1..1", mustSupport: true },
      { name: "Result Unit of Measure", description: "Unit for result", fhirPath: "Observation.valueQuantity.unit", vocabulary: ["UCUM"], cardinality: "0..1", mustSupport: true },
      { name: "Specimen Type", description: "Type of specimen collected", fhirPath: "Specimen.type", vocabulary: ["SNOMED CT"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Vital Signs",
    version: "v6",
    required: true,
    fhirResources: ["Observation"],
    dataElements: [
      { name: "Diastolic Blood Pressure", description: "Diastolic BP measurement", fhirPath: "Observation.component.code='8462-4'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Systolic Blood Pressure", description: "Systolic BP measurement", fhirPath: "Observation.component.code='8480-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Heart Rate", description: "Heart rate/pulse", fhirPath: "Observation.code='8867-4'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Respiratory Rate", description: "Breathing rate", fhirPath: "Observation.code='9279-1'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Body Temperature", description: "Body temperature", fhirPath: "Observation.code='8310-5'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Body Weight", description: "Patient weight", fhirPath: "Observation.code='29463-7'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Body Height", description: "Patient height", fhirPath: "Observation.code='8302-2'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "BMI", description: "Body mass index", fhirPath: "Observation.code='39156-5'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Pulse Oximetry", description: "Oxygen saturation", fhirPath: "Observation.code='2708-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Inhaled Oxygen Concentration", description: "FiO2", fhirPath: "Observation.code='3150-0'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Head Circumference", description: "Pediatric head circumference", fhirPath: "Observation.code='9843-4'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Average Blood Pressure", description: "Average BP over time", fhirPath: "Observation.code='96607-7'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Procedures",
    version: "v6",
    required: true,
    fhirResources: ["Procedure", "ServiceRequest"],
    dataElements: [
      { name: "Procedures", description: "Procedure performed", fhirPath: "Procedure.code", vocabulary: ["CPT", "SNOMED CT", "HCPCS", "ICD-10-PCS", "CDT"], cardinality: "1..1", mustSupport: true },
      { name: "SDOH Interventions", description: "Social services interventions", fhirPath: "Procedure.code", vocabulary: ["SNOMED CT", "HCPCS"], cardinality: "0..*", mustSupport: true },
      { name: "Reason for Referral", description: "Why procedure/referral was ordered", fhirPath: "ServiceRequest.reasonCode", vocabulary: ["SNOMED CT", "ICD-10-CM"], cardinality: "0..*", mustSupport: true },
      { name: "Performance Time", description: "When procedure was performed", fhirPath: "Procedure.performedDateTime", cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Care Team Members",
    version: "v6",
    required: true,
    fhirResources: ["CareTeam", "PractitionerRole", "Practitioner", "Organization"],
    dataElements: [
      { name: "Care Team Member Name", description: "Name of care team member", fhirPath: "Practitioner.name", cardinality: "1..1", mustSupport: true },
      { name: "Care Team Member Identifier", description: "NPI or other identifier", fhirPath: "Practitioner.identifier", vocabulary: ["NPI"], cardinality: "0..*", mustSupport: true },
      { name: "Care Team Member Location", description: "Practice location", fhirPath: "PractitionerRole.location", cardinality: "0..*", mustSupport: true },
      { name: "Care Team Member Telecom", description: "Contact information", fhirPath: "Practitioner.telecom", cardinality: "0..*", mustSupport: true },
      { name: "Care Team Member Role", description: "Role on care team", fhirPath: "CareTeam.participant.role", vocabulary: ["SNOMED CT", "Provider Taxonomy"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Immunizations",
    version: "v6",
    required: true,
    fhirResources: ["Immunization"],
    dataElements: [
      { name: "Immunizations", description: "Vaccine administered", fhirPath: "Immunization.vaccineCode", vocabulary: ["CVX", "NDC"], cardinality: "1..1", mustSupport: true },
      { name: "Immunization Status Reason", description: "Reason for status", fhirPath: "Immunization.statusReason", vocabulary: ["NIP004"], cardinality: "0..1", mustSupport: true },
      { name: "Immunization Lot Number", description: "Vaccine lot number", fhirPath: "Immunization.lotNumber", cardinality: "0..1", mustSupport: true },
      { name: "Administration Date", description: "Date vaccine given", fhirPath: "Immunization.occurrenceDateTime", cardinality: "1..1", mustSupport: true }
    ]
  },
  {
    name: "Clinical Notes",
    version: "v6",
    required: true,
    fhirResources: ["DocumentReference", "DiagnosticReport"],
    dataElements: [
      { name: "Consultation Note", description: "Specialist consultation note", fhirPath: "DocumentReference.type.coding.code='11488-4'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Discharge Summary", description: "Hospital discharge summary", fhirPath: "DocumentReference.type.coding.code='18842-5'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "History & Physical", description: "H&P note", fhirPath: "DocumentReference.type.coding.code='34117-2'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Imaging Narrative", description: "Radiology report", fhirPath: "DiagnosticReport.category.coding.code='LP29684-5'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Laboratory Report Narrative", description: "Lab report narrative", fhirPath: "DiagnosticReport.category.coding.code='LP29693-6'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Pathology Report Narrative", description: "Pathology report", fhirPath: "DiagnosticReport.category.coding.code='LP7839-6'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Procedure Note", description: "Procedure documentation", fhirPath: "DocumentReference.type.coding.code='28570-0'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Progress Note", description: "Clinical progress note", fhirPath: "DocumentReference.type.coding.code='11506-3'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Operative Note", description: "Surgical note", fhirPath: "DocumentReference.type.coding.code='11504-8'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Health Status Assessments",
    version: "v6",
    required: false,
    fhirResources: ["Observation", "QuestionnaireResponse"],
    dataElements: [
      { name: "Functional Status", description: "ADL/IADL assessment", fhirPath: "Observation.category.coding.code='functional-status'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Disability Status", description: "Disability assessment", fhirPath: "Observation.code", vocabulary: ["SNOMED CT", "LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Mental/Cognitive Status", description: "Mental status assessment", fhirPath: "Observation.category.coding.code='cognitive-status'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "SDOH Assessment", description: "Social determinants screening", fhirPath: "Observation.category.coding.code='sdoh'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Pregnancy Status", description: "Current pregnancy status", fhirPath: "Observation.code='82810-3'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Smoking Status", description: "Tobacco use status", fhirPath: "Observation.code='72166-2'", vocabulary: ["LOINC", "SNOMED CT"], cardinality: "0..1", mustSupport: true },
      { name: "Alcohol Use", description: "Alcohol consumption", fhirPath: "Observation.code='74013-4'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Substance Use", description: "Drug/substance use", fhirPath: "Observation.code='95530-2'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Physical Activity", description: "Exercise/activity level", fhirPath: "Observation.code='89555-7'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Goals",
    version: "v6",
    required: false,
    fhirResources: ["Goal"],
    dataElements: [
      { name: "Patient Goals", description: "Treatment/health goals", fhirPath: "Goal.description", vocabulary: ["SNOMED CT", "LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "SDOH Goals", description: "Social determinants goals", fhirPath: "Goal.category.coding.code='sdoh'", vocabulary: ["SNOMED CT"], cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Health Insurance Information",
    version: "v6",
    required: false,
    fhirResources: ["Coverage", "Organization"],
    dataElements: [
      { name: "Coverage Status", description: "Insurance coverage status", fhirPath: "Coverage.status", cardinality: "1..1", mustSupport: true },
      { name: "Coverage Type", description: "Type of coverage", fhirPath: "Coverage.type", vocabulary: ["HL7 CoverageType"], cardinality: "0..1", mustSupport: true },
      { name: "Group ID", description: "Insurance group number", fhirPath: "Coverage.class.type='group'", cardinality: "0..1", mustSupport: true },
      { name: "Member ID", description: "Insurance member number", fhirPath: "Coverage.subscriberId", cardinality: "0..1", mustSupport: true },
      { name: "Payer ID", description: "Insurance company identifier", fhirPath: "Coverage.payor", cardinality: "0..*", mustSupport: true },
      { name: "Subscriber ID", description: "Primary subscriber ID", fhirPath: "Coverage.subscriberId", cardinality: "0..1", mustSupport: true },
      { name: "Relationship to Subscriber", description: "Patient's relationship to subscriber", fhirPath: "Coverage.relationship", vocabulary: ["SubscriberRelationship"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Encounter Information",
    version: "v6",
    required: false,
    fhirResources: ["Encounter", "Location"],
    dataElements: [
      { name: "Encounter Diagnosis", description: "Diagnoses from encounter", fhirPath: "Encounter.diagnosis.condition", vocabulary: ["ICD-10-CM", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Encounter Disposition", description: "Discharge disposition", fhirPath: "Encounter.hospitalization.dischargeDisposition", vocabulary: ["NUBC"], cardinality: "0..1", mustSupport: true },
      { name: "Encounter Location", description: "Location of encounter", fhirPath: "Encounter.location", cardinality: "0..*", mustSupport: true },
      { name: "Encounter Time", description: "Date/time of encounter", fhirPath: "Encounter.period", cardinality: "0..1", mustSupport: true },
      { name: "Encounter Type", description: "Type of encounter", fhirPath: "Encounter.type", vocabulary: ["CPT", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Facility Type", description: "Type of facility", fhirPath: "Location.type", vocabulary: ["HL7 ServiceDeliveryLocationRoleType"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Clinical Tests",
    version: "v6",
    required: false,
    fhirResources: ["Observation", "DiagnosticReport"],
    dataElements: [
      { name: "Clinical Test", description: "Non-lab clinical tests", fhirPath: "Observation.code", vocabulary: ["LOINC", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Clinical Test Result/Report", description: "Test results/findings", fhirPath: "DiagnosticReport.result", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Diagnostic Imaging",
    version: "v6",
    required: false,
    fhirResources: ["DiagnosticReport", "ImagingStudy"],
    dataElements: [
      { name: "Diagnostic Imaging Test", description: "Imaging study performed", fhirPath: "ImagingStudy.procedureCode", vocabulary: ["LOINC", "CPT", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Diagnostic Imaging Report", description: "Radiology report", fhirPath: "DiagnosticReport.presentedForm", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Medical Devices",
    version: "v6",
    required: false,
    fhirResources: ["Device", "Procedure"],
    dataElements: [
      { name: "Unique Device Identifier (UDI)", description: "FDA device identifier", fhirPath: "Device.udiCarrier.deviceIdentifier", cardinality: "0..1", mustSupport: true },
      { name: "Implant Status", description: "Status of implanted device", fhirPath: "Procedure.status", cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Provenance",
    version: "v6",
    required: false,
    fhirResources: ["Provenance"],
    dataElements: [
      { name: "Author Time Stamp", description: "When data was authored", fhirPath: "Provenance.recorded", cardinality: "1..1", mustSupport: true },
      { name: "Author Organization", description: "Organization that authored data", fhirPath: "Provenance.agent.who", cardinality: "1..*", mustSupport: true }
    ]
  },
  {
    name: "Emergency Contact Information",
    version: "v6",
    required: false,
    fhirResources: ["RelatedPerson", "Patient"],
    dataElements: [
      { name: "Name", description: "Emergency contact name", fhirPath: "RelatedPerson.name", cardinality: "1..1", mustSupport: true },
      { name: "Relationship", description: "Relationship to patient", fhirPath: "RelatedPerson.relationship", vocabulary: ["SNOMED CT"], cardinality: "1..1", mustSupport: true },
      { name: "Phone", description: "Emergency contact phone number", fhirPath: "RelatedPerson.telecom.system='phone'", cardinality: "0..*", mustSupport: true },
      { name: "Email", description: "Emergency contact email address", fhirPath: "RelatedPerson.telecom.system='email'", cardinality: "0..*", mustSupport: true },
      { name: "Address", description: "Emergency contact address", fhirPath: "RelatedPerson.address", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Facility Information",
    version: "v6",
    required: false,
    fhirResources: ["Location", "Organization"],
    dataElements: [
      { name: "Facility Name", description: "Name of the facility", fhirPath: "Location.name", cardinality: "1..1", mustSupport: true },
      { name: "Facility Type", description: "Type of facility", fhirPath: "Location.type", vocabulary: ["HL7 ServiceDeliveryLocationRoleType"], cardinality: "0..1", mustSupport: true },
      { name: "Facility Identifier", description: "Unique facility identifier", fhirPath: "Location.identifier", cardinality: "0..*", mustSupport: true },
      { name: "Address", description: "Facility address", fhirPath: "Location.address", cardinality: "0..1", mustSupport: true },
      { name: "Phone", description: "Facility phone number", fhirPath: "Location.telecom.system='phone'", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Federal/State Drug Schedules",
    version: "v6",
    required: false,
    fhirResources: ["MedicationKnowledge", "MedicationRequest"],
    dataElements: [
      { name: "DEA Schedule", description: "DEA controlled substance schedule", fhirPath: "MedicationKnowledge.regulatory.schedule", vocabulary: ["DEA Schedule"], cardinality: "0..1", mustSupport: true },
      { name: "State Schedule", description: "State-level controlled substance schedule", fhirPath: "MedicationKnowledge.regulatory.schedule", cardinality: "0..1", mustSupport: true },
      { name: "Controlled Substance Indicator", description: "Whether the medication is a controlled substance", fhirPath: "MedicationKnowledge.regulatory.isControlled", cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Functional Status",
    version: "v6",
    required: false,
    fhirResources: ["Observation", "ClinicalImpression"],
    dataElements: [
      { name: "Functional Status", description: "Patient functional status assessment", fhirPath: "Observation.category.coding.code='functional-status'", vocabulary: ["LOINC", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Disability Status", description: "Patient disability status", fhirPath: "Observation.code", vocabulary: ["SNOMED CT", "LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Cognitive Status", description: "Patient cognitive function assessment", fhirPath: "Observation.category.coding.code='cognitive-status'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Mental/Behavioral Health",
    version: "v6",
    required: false,
    fhirResources: ["Condition", "Observation", "QuestionnaireResponse"],
    dataElements: [
      { name: "Mental Health Screening Results", description: "Results from mental health screenings", fhirPath: "Observation.category.coding.code='mental-health'", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "Behavioral Health Diagnoses", description: "Behavioral health condition diagnoses", fhirPath: "Condition.code", vocabulary: ["ICD-10-CM", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Treatment Plans", description: "Behavioral health treatment plans", fhirPath: "QuestionnaireResponse.item", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true },
      { name: "PHQ-9 Scores", description: "Patient Health Questionnaire-9 depression scores", fhirPath: "Observation.code='44249-1'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "GAD-7 Scores", description: "Generalized Anxiety Disorder-7 scores", fhirPath: "Observation.code='70274-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Nutrition",
    version: "v6",
    required: false,
    fhirResources: ["NutritionOrder", "Observation"],
    dataElements: [
      { name: "Diet Orders", description: "Prescribed diet orders", fhirPath: "NutritionOrder.oralDiet", cardinality: "0..*", mustSupport: true },
      { name: "Nutritional Status", description: "Patient nutritional status assessment", fhirPath: "Observation.code", vocabulary: ["LOINC", "SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "BMI Percentile (pediatric)", description: "BMI percentile for pediatric patients", fhirPath: "Observation.code='59576-9'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Feeding/Diet Preferences", description: "Patient feeding and dietary preferences", fhirPath: "NutritionOrder.foodPreferenceModifier", cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Pharmacogenomics",
    version: "v6",
    required: false,
    fhirResources: ["Observation", "DiagnosticReport", "MolecularSequence"],
    dataElements: [
      { name: "Gene-Drug Interactions", description: "Known gene-drug interaction results", fhirPath: "Observation.code", vocabulary: ["LOINC", "HGNC"], cardinality: "0..*", mustSupport: true },
      { name: "Genetic Variants", description: "Relevant genetic variant information", fhirPath: "MolecularSequence.variant", cardinality: "0..*", mustSupport: true },
      { name: "Metabolizer Status", description: "Drug metabolizer phenotype status", fhirPath: "Observation.valueCodeableConcept", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Pharmacogenomic Test Results", description: "Results from pharmacogenomic testing", fhirPath: "DiagnosticReport.result", vocabulary: ["LOINC"], cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Pregnancy Status",
    version: "v6",
    required: false,
    fhirResources: ["Condition", "Observation"],
    dataElements: [
      { name: "Pregnancy Status", description: "Current pregnancy status", fhirPath: "Observation.code='82810-3'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Estimated Due Date", description: "Estimated date of delivery", fhirPath: "Observation.code='11778-8'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Gestational Age", description: "Current gestational age", fhirPath: "Observation.code='49051-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Pregnancy Outcome", description: "Outcome of the pregnancy", fhirPath: "Condition.code", vocabulary: ["SNOMED CT", "LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Gravidity and Parity", description: "Number of pregnancies and deliveries", fhirPath: "Observation.code='11996-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Specimen",
    version: "v6",
    required: false,
    fhirResources: ["Specimen"],
    dataElements: [
      { name: "Specimen Type", description: "Type of specimen collected", fhirPath: "Specimen.type", vocabulary: ["SNOMED CT"], cardinality: "1..1", mustSupport: true },
      { name: "Collection Date/Time", description: "Date and time specimen was collected", fhirPath: "Specimen.collection.collectedDateTime", cardinality: "0..1", mustSupport: true },
      { name: "Specimen Source Site", description: "Anatomical site of specimen collection", fhirPath: "Specimen.collection.bodySite", vocabulary: ["SNOMED CT"], cardinality: "0..1", mustSupport: true },
      { name: "Specimen Condition", description: "Condition/quality of the specimen", fhirPath: "Specimen.condition", vocabulary: ["HL7 SpecimenCondition"], cardinality: "0..*", mustSupport: true }
    ]
  },
  {
    name: "Substance Use (non-SUD)",
    version: "v6",
    required: false,
    fhirResources: ["Observation", "Condition"],
    dataElements: [
      { name: "Tobacco Use Status", description: "Current tobacco use status", fhirPath: "Observation.code='72166-2'", vocabulary: ["LOINC", "SNOMED CT"], cardinality: "0..1", mustSupport: true },
      { name: "Alcohol Use", description: "Current alcohol use status", fhirPath: "Observation.code='74013-4'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Cannabis Use", description: "Current cannabis use status", fhirPath: "Observation.code='11331-6'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true },
      { name: "Other Substance Use", description: "Other substance use status", fhirPath: "Observation.code='95530-2'", vocabulary: ["LOINC"], cardinality: "0..1", mustSupport: true }
    ]
  },
  {
    name: "Treatment Plan",
    version: "v6",
    required: false,
    fhirResources: ["CarePlan", "RequestGroup"],
    dataElements: [
      { name: "Treatment Goals", description: "Goals of the treatment plan", fhirPath: "CarePlan.goal", vocabulary: ["SNOMED CT"], cardinality: "0..*", mustSupport: true },
      { name: "Planned Interventions", description: "Planned treatment interventions", fhirPath: "CarePlan.activity.detail", cardinality: "0..*", mustSupport: true },
      { name: "Treatment Timeline", description: "Timeline for treatment activities", fhirPath: "CarePlan.period", cardinality: "0..1", mustSupport: true },
      { name: "Care Coordination Notes", description: "Notes for coordinating care across providers", fhirPath: "CarePlan.note", cardinality: "0..*", mustSupport: true }
    ]
  }
];

class USCDIv6Service {
  private dataClasses: USCDIv6DataClass[] = USCDI_V6_DATA_CLASSES;

  getDataClasses(): USCDIv6DataClass[] {
    return this.dataClasses;
  }

  getDataClass(name: string): USCDIv6DataClass | undefined {
    return this.dataClasses.find(dc => dc.name.toLowerCase() === name.toLowerCase());
  }

  generateBundle(patientId: string, resources: any[]): USCDIv6Bundle {
    const entries: USCDIBundleEntry[] = resources.map((resource, index) => ({
      fullUrl: `urn:uuid:${this.generateUUID()}`,
      resource,
      search: { mode: "match" }
    }));

    const coveredClasses = this.identifyCoveredDataClasses(resources);
    const completeness = this.calculateCompleteness(resources);

    return {
      resourceType: "Bundle",
      type: "collection",
      meta: {
        profile: [
          "http://hl7.org/fhir/us/core/StructureDefinition/us-core-bundle",
          "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"
        ],
        lastUpdated: new Date().toISOString()
      },
      identifier: {
        system: "urn:ietf:rfc:3986",
        value: `urn:uuid:${this.generateUUID()}`
      },
      entry: entries,
      uscdiVersion: "v6",
      dataClasses: coveredClasses,
      completeness
    };
  }

  validateBundle(bundle: any): USCDIValidationResult {
    const errors: USCDIValidationError[] = [];
    const warnings: USCDIValidationWarning[] = [];
    const dataClassCoverage: Record<string, DataClassCoverage> = {};

    for (const dataClass of this.dataClasses) {
      const coverage = this.validateDataClass(bundle, dataClass, errors, warnings);
      dataClassCoverage[dataClass.name] = coverage;
    }

    const completenessScore = this.calculateCompletenessScore(dataClassCoverage);

    return {
      valid: errors.length === 0,
      uscdiVersion: "v6",
      dataClassCoverage,
      errors,
      warnings,
      completenessScore
    };
  }

  private validateDataClass(
    bundle: any,
    dataClass: USCDIv6DataClass,
    errors: USCDIValidationError[],
    warnings: USCDIValidationWarning[]
  ): DataClassCoverage {
    const entries = bundle.entry || [];
    const relevantResources = entries
      .map((e: any) => e.resource)
      .filter((r: any) => dataClass.fhirResources.includes(r?.resourceType));

    const missingElements: string[] = [];
    let elementsPresent = 0;

    for (const element of dataClass.dataElements) {
      const found = this.elementPresent(relevantResources, element);
      if (found) {
        elementsPresent++;
      } else {
        missingElements.push(element.name);
        if (element.mustSupport && dataClass.required) {
          errors.push({
            dataClass: dataClass.name,
            element: element.name,
            message: `Required USCDI v6 element '${element.name}' is missing`,
            severity: "error",
            fhirPath: element.fhirPath
          });
        } else if (element.mustSupport) {
          warnings.push({
            dataClass: dataClass.name,
            element: element.name,
            message: `Recommended USCDI v6 element '${element.name}' is missing`,
            severity: "warning",
            suggestion: `Consider adding ${element.name} to improve data completeness`
          });
        }
      }
    }

    return {
      dataClass: dataClass.name,
      required: dataClass.required,
      elementsPresent,
      elementsTotal: dataClass.dataElements.length,
      coverage: dataClass.dataElements.length > 0 
        ? (elementsPresent / dataClass.dataElements.length) * 100 
        : 0,
      missingElements
    };
  }

  private elementPresent(resources: any[], element: USCDIDataElement): boolean {
    for (const resource of resources) {
      const pathParts = element.fhirPath.split(".");
      if (pathParts[0] !== resource.resourceType) continue;
      
      let current: any = resource;
      for (let i = 1; i < pathParts.length && current; i++) {
        const part = pathParts[i];
        if (part.includes("=")) {
          const [key, value] = part.split("=");
          if (Array.isArray(current[key])) {
            current = current[key].find((item: any) => 
              typeof item === "string" ? item === value.replace(/'/g, "") : true
            );
          } else {
            current = current[key] === value.replace(/'/g, "") ? current : null;
          }
        } else if (part.includes("[")) {
          const [key, index] = part.split("[");
          const idx = parseInt(index.replace("]", ""));
          current = current[key]?.[idx];
        } else {
          current = current[part];
        }
      }
      
      if (current !== undefined && current !== null) {
        return true;
      }
    }
    return false;
  }

  private identifyCoveredDataClasses(resources: any[]): string[] {
    const covered: string[] = [];
    
    for (const dataClass of this.dataClasses) {
      const hasResources = resources.some(r => 
        dataClass.fhirResources.includes(r.resourceType)
      );
      if (hasResources) {
        covered.push(dataClass.name);
      }
    }
    
    return covered;
  }

  private calculateCompleteness(resources: any[]): number {
    const requiredClasses = this.dataClasses.filter(dc => dc.required);
    let covered = 0;
    
    for (const dataClass of requiredClasses) {
      const hasResources = resources.some(r => 
        dataClass.fhirResources.includes(r.resourceType)
      );
      if (hasResources) covered++;
    }
    
    return requiredClasses.length > 0 
      ? (covered / requiredClasses.length) * 100 
      : 100;
  }

  private calculateCompletenessScore(coverage: Record<string, DataClassCoverage>): number {
    const requiredClasses = Object.values(coverage).filter(c => c.required);
    if (requiredClasses.length === 0) return 100;
    
    const totalCoverage = requiredClasses.reduce((sum, c) => sum + c.coverage, 0);
    return totalCoverage / requiredClasses.length;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  mapToUSCDI(healthRecord: any): any {
    const resourceType = this.inferResourceType(healthRecord);
    
    switch (resourceType) {
      case "Observation":
        return this.mapToObservation(healthRecord);
      case "Condition":
        return this.mapToCondition(healthRecord);
      case "MedicationRequest":
        return this.mapToMedicationRequest(healthRecord);
      case "Procedure":
        return this.mapToProcedure(healthRecord);
      case "AllergyIntolerance":
        return this.mapToAllergyIntolerance(healthRecord);
      case "Immunization":
        return this.mapToImmunization(healthRecord);
      default:
        return this.mapToDocumentReference(healthRecord);
    }
  }

  private inferResourceType(record: any): string {
    const type = record.type?.toLowerCase();
    if (type === "lab" || type === "vital") return "Observation";
    if (type === "diagnosis" || type === "problem") return "Condition";
    if (type === "medication") return "MedicationRequest";
    if (type === "procedure") return "Procedure";
    if (type === "allergy") return "AllergyIntolerance";
    if (type === "immunization") return "Immunization";
    return "DocumentReference";
  }

  private mapToObservation(record: any): any {
    return {
      resourceType: "Observation",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"]
      },
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: record.type === "vital" ? "vital-signs" : "laboratory"
        }]
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: record.details?.loincCode || "unknown",
          display: record.title
        }]
      },
      subject: { reference: `Patient/${record.userId}` },
      effectiveDateTime: record.date,
      valueQuantity: record.details?.value ? {
        value: record.details.value,
        unit: record.details.unit,
        system: "http://unitsofmeasure.org"
      } : undefined
    };
  }

  private mapToCondition(record: any): any {
    return {
      resourceType: "Condition",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"]
      },
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: record.details?.resolved ? "resolved" : "active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed"
        }]
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "problem-list-item",
          display: "Problem List Item"
        }]
      }],
      code: {
        coding: [{
          system: "http://snomed.info/sct",
          code: record.details?.snomedCode || "unknown",
          display: record.title
        }]
      },
      subject: { reference: `Patient/${record.userId}` },
      onsetDateTime: record.date
    };
  }

  private mapToMedicationRequest(record: any): any {
    return {
      resourceType: "MedicationRequest",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"]
      },
      status: record.details?.active ? "active" : "completed",
      intent: "order",
      medicationCodeableConcept: {
        coding: [{
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: record.details?.rxnormCode || "unknown",
          display: record.title
        }]
      },
      subject: { reference: `Patient/${record.userId}` },
      authoredOn: record.date,
      dosageInstruction: record.details?.dosage ? [{
        text: record.details.dosage,
        doseAndRate: [{
          doseQuantity: {
            value: record.details.doseValue,
            unit: record.details.doseUnit,
            system: "http://unitsofmeasure.org"
          }
        }]
      }] : undefined
    };
  }

  private mapToProcedure(record: any): any {
    return {
      resourceType: "Procedure",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"]
      },
      status: "completed",
      code: {
        coding: [{
          system: "http://snomed.info/sct",
          code: record.details?.snomedCode || "unknown",
          display: record.title
        }]
      },
      subject: { reference: `Patient/${record.userId}` },
      performedDateTime: record.date
    };
  }

  private mapToAllergyIntolerance(record: any): any {
    return {
      resourceType: "AllergyIntolerance",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"]
      },
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "confirmed"
        }]
      },
      code: {
        coding: [{
          system: record.details?.drugAllergy ? "http://www.nlm.nih.gov/research/umls/rxnorm" : "http://snomed.info/sct",
          display: record.title
        }]
      },
      patient: { reference: `Patient/${record.userId}` },
      recordedDate: record.date,
      reaction: record.details?.reaction ? [{
        manifestation: [{
          coding: [{
            system: "http://snomed.info/sct",
            display: record.details.reaction
          }]
        }],
        severity: record.details?.severity
      }] : undefined
    };
  }

  private mapToImmunization(record: any): any {
    return {
      resourceType: "Immunization",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"]
      },
      status: "completed",
      vaccineCode: {
        coding: [{
          system: "http://hl7.org/fhir/sid/cvx",
          code: record.details?.cvxCode || "unknown",
          display: record.title
        }]
      },
      patient: { reference: `Patient/${record.userId}` },
      occurrenceDateTime: record.date,
      lotNumber: record.details?.lotNumber
    };
  }

  private mapToDocumentReference(record: any): any {
    return {
      resourceType: "DocumentReference",
      id: record.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"]
      },
      status: "current",
      type: {
        coding: [{
          system: "http://loinc.org",
          code: "34117-2",
          display: "History and physical note"
        }]
      },
      subject: { reference: `Patient/${record.userId}` },
      date: record.date,
      content: [{
        attachment: {
          contentType: "text/plain",
          data: Buffer.from(record.summary || "").toString("base64")
        }
      }]
    };
  }
}

export const uscdiV6Service = new USCDIv6Service();

export function initializeUSCDIv6() {
  console.log("USCDI v6 service initialized with", USCDI_V6_DATA_CLASSES.length, "data classes");
}
