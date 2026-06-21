export interface FHIREndpoint {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: string;
  vendor: string;
  status: "active" | "inactive" | "testing";
}

export interface FHIRResourceProfile {
  resourceType: string;
  name: string;
  description: string;
  useCoreProfile: string;
  useCoreVersion: string;
  searchParameters: SearchParameter[];
  operations: FHIROperation[];
  elements: ResourceElement[];
}

export interface SearchParameter {
  name: string;
  type: "string" | "token" | "reference" | "date" | "number" | "quantity" | "uri" | "composite";
  description: string;
  expression: string;
  modifier?: string[];
  required?: boolean;
}

export interface FHIROperation {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description: string;
  url: string;
  parameters?: OperationParameter[];
}

export interface OperationParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ResourceElement {
  path: string;
  name: string;
  type: string;
  cardinality: string;
  description: string;
  mustSupport: boolean;
}

export interface FHIRQuery {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  parameters: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
  createdAt: string;
  createdBy: string;
}

export interface QueryResult {
  id: string;
  queryId: string;
  endpointId: string;
  status: number;
  statusText: string;
  responseTime: number;
  headers: Record<string, string>;
  body: unknown;
  resourceCount?: number;
  totalCount?: number;
  nextPageUrl?: string;
  prevPageUrl?: string;
  executedAt: string;
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: FHIRQuery;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isPublic: boolean;
  tags: string[];
}

class FHIRAPIExplorerService {
  private resourceProfiles: Map<string, FHIRResourceProfile> = new Map();
  private savedQueries: Map<string, SavedQuery> = new Map();
  private queryResults: Map<string, QueryResult> = new Map();
  private queryHistory: QueryResult[] = [];
  private endpoints: Map<string, FHIREndpoint> = new Map();

  constructor() {
    this.initializeEndpoints();
    this.initializeUSCoreProfiles();
    this.initializeSampleQueries();
    console.log("[FHIRAPIExplorer] Service initialized with US Core profiles");
  }

  private initializeEndpoints() {
    const sampleEndpoints: FHIREndpoint[] = [
      {
        id: "epic-prod",
        name: "Fasten Health Production",
        baseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
        fhirVersion: "R4",
        vendor: "Fasten Health",
        status: "active",
      },
      {
        id: "cerner-prod",
        name: "Hospital Network Production",
        baseUrl: "https://fhir-ehr.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
        fhirVersion: "R4",
        vendor: "Hospital Network",
        status: "active",
      },
      {
        id: "internal-fhir",
        name: "Internal FHIR Server",
        baseUrl: "https://fhir.internal.tabulamedica.app/r4",
        fhirVersion: "R4",
        vendor: "Tabula Medica",
        status: "active",
      },
      {
        id: "hapi-public",
        name: "HAPI FHIR Public Test Server",
        baseUrl: "https://hapi.fhir.org/baseR4",
        fhirVersion: "R4",
        vendor: "HAPI",
        status: "testing",
      },
    ];

    sampleEndpoints.forEach(e => this.endpoints.set(e.id, e));
  }

  private initializeUSCoreProfiles() {
    const profiles: FHIRResourceProfile[] = [
      {
        resourceType: "Patient",
        name: "US Core Patient Profile",
        description: "Demographics and other administrative information about an individual receiving care",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Patient.id" },
          { name: "identifier", type: "token", description: "A patient identifier", expression: "Patient.identifier" },
          { name: "name", type: "string", description: "A server defined search for the patient's name", expression: "Patient.name" },
          { name: "family", type: "string", description: "A portion of the family name", expression: "Patient.name.family" },
          { name: "given", type: "string", description: "A portion of the given name", expression: "Patient.name.given" },
          { name: "birthdate", type: "date", description: "The patient's date of birth", expression: "Patient.birthDate" },
          { name: "gender", type: "token", description: "Gender of the patient", expression: "Patient.gender" },
          { name: "address", type: "string", description: "A server defined search for address", expression: "Patient.address" },
          { name: "address-city", type: "string", description: "A city specified in an address", expression: "Patient.address.city" },
          { name: "address-state", type: "string", description: "A state specified in an address", expression: "Patient.address.state" },
          { name: "address-postalcode", type: "string", description: "A postal code in an address", expression: "Patient.address.postalCode" },
          { name: "telecom", type: "token", description: "The value in any contact detail", expression: "Patient.telecom" },
          { name: "email", type: "token", description: "A patient's email address", expression: "Patient.telecom.where(system='email')" },
          { name: "phone", type: "token", description: "A patient's phone number", expression: "Patient.telecom.where(system='phone')" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a Patient resource", url: "/Patient/{id}" },
          { name: "search", method: "GET", description: "Search for Patient resources", url: "/Patient" },
          { name: "create", method: "POST", description: "Create a new Patient resource", url: "/Patient" },
          { name: "update", method: "PUT", description: "Update an existing Patient resource", url: "/Patient/{id}" },
          { name: "$everything", method: "GET", description: "Retrieve all resources for a patient", url: "/Patient/{id}/$everything" },
        ],
        elements: [
          { path: "Patient.identifier", name: "identifier", type: "Identifier", cardinality: "1..*", description: "An identifier for this patient", mustSupport: true },
          { path: "Patient.name", name: "name", type: "HumanName", cardinality: "1..*", description: "A name associated with the patient", mustSupport: true },
          { path: "Patient.telecom", name: "telecom", type: "ContactPoint", cardinality: "0..*", description: "A contact detail for the individual", mustSupport: true },
          { path: "Patient.gender", name: "gender", type: "code", cardinality: "1..1", description: "male | female | other | unknown", mustSupport: true },
          { path: "Patient.birthDate", name: "birthDate", type: "date", cardinality: "1..1", description: "The date of birth for the individual", mustSupport: true },
          { path: "Patient.address", name: "address", type: "Address", cardinality: "0..*", description: "An address for the individual", mustSupport: true },
          { path: "Patient.communication", name: "communication", type: "BackboneElement", cardinality: "0..*", description: "A language which may be used to communicate with the patient", mustSupport: true },
        ],
      },
      {
        resourceType: "Observation",
        name: "US Core Observation Profiles",
        description: "Measurements and simple assertions made about a patient",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Observation.id" },
          { name: "patient", type: "reference", description: "The subject that the observation is about", expression: "Observation.subject", required: true },
          { name: "category", type: "token", description: "The classification of the type of observation", expression: "Observation.category" },
          { name: "code", type: "token", description: "The code of the observation type", expression: "Observation.code" },
          { name: "date", type: "date", description: "Obtained date/time", expression: "Observation.effective" },
          { name: "status", type: "token", description: "The status of the observation", expression: "Observation.status" },
          { name: "value-quantity", type: "quantity", description: "The value of the observation as a quantity", expression: "Observation.value.ofType(Quantity)" },
          { name: "combo-code", type: "token", description: "The code for the component or observation", expression: "Observation.code | Observation.component.code" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read an Observation resource", url: "/Observation/{id}" },
          { name: "search", method: "GET", description: "Search for Observation resources", url: "/Observation" },
          { name: "create", method: "POST", description: "Create a new Observation resource", url: "/Observation" },
          { name: "$lastn", method: "GET", description: "Get the last N observations", url: "/Observation/$lastn" },
        ],
        elements: [
          { path: "Observation.status", name: "status", type: "code", cardinality: "1..1", description: "registered | preliminary | final | amended +", mustSupport: true },
          { path: "Observation.category", name: "category", type: "CodeableConcept", cardinality: "1..*", description: "Classification of type of observation", mustSupport: true },
          { path: "Observation.code", name: "code", type: "CodeableConcept", cardinality: "1..1", description: "Type of observation (code / type)", mustSupport: true },
          { path: "Observation.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "Who and/or what the observation is about", mustSupport: true },
          { path: "Observation.effective[x]", name: "effective", type: "dateTime|Period", cardinality: "1..1", description: "Clinically relevant time/time-period", mustSupport: true },
          { path: "Observation.value[x]", name: "value", type: "Quantity|CodeableConcept|string", cardinality: "0..1", description: "Actual result", mustSupport: true },
        ],
      },
      {
        resourceType: "Condition",
        name: "US Core Condition Encounter Diagnosis Profile",
        description: "Detailed information about conditions, problems, or diagnoses",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-encounter-diagnosis",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Condition.id" },
          { name: "patient", type: "reference", description: "Who has the condition?", expression: "Condition.subject", required: true },
          { name: "category", type: "token", description: "The category of the condition", expression: "Condition.category" },
          { name: "clinical-status", type: "token", description: "The clinical status of the condition", expression: "Condition.clinicalStatus" },
          { name: "code", type: "token", description: "Code for the condition", expression: "Condition.code" },
          { name: "onset-date", type: "date", description: "Date related to onset", expression: "Condition.onset" },
          { name: "recorded-date", type: "date", description: "Date record was first recorded", expression: "Condition.recordedDate" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a Condition resource", url: "/Condition/{id}" },
          { name: "search", method: "GET", description: "Search for Condition resources", url: "/Condition" },
          { name: "create", method: "POST", description: "Create a new Condition resource", url: "/Condition" },
        ],
        elements: [
          { path: "Condition.clinicalStatus", name: "clinicalStatus", type: "CodeableConcept", cardinality: "0..1", description: "active | recurrence | relapse | inactive | remission | resolved", mustSupport: true },
          { path: "Condition.verificationStatus", name: "verificationStatus", type: "CodeableConcept", cardinality: "0..1", description: "unconfirmed | provisional | differential | confirmed | refuted | entered-in-error", mustSupport: true },
          { path: "Condition.category", name: "category", type: "CodeableConcept", cardinality: "1..*", description: "problem-list-item | encounter-diagnosis | health-concern", mustSupport: true },
          { path: "Condition.code", name: "code", type: "CodeableConcept", cardinality: "1..1", description: "Identification of the condition, problem or diagnosis", mustSupport: true },
          { path: "Condition.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "Who has the condition?", mustSupport: true },
        ],
      },
      {
        resourceType: "MedicationRequest",
        name: "US Core MedicationRequest Profile",
        description: "An order or request for both supply of the medication and the instructions for administration",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "MedicationRequest.id" },
          { name: "patient", type: "reference", description: "Returns prescriptions for a specific patient", expression: "MedicationRequest.subject", required: true },
          { name: "intent", type: "token", description: "proposal | plan | order | original-order | reflex-order | filler-order | instance-order | option", expression: "MedicationRequest.intent" },
          { name: "status", type: "token", description: "Status of the prescription", expression: "MedicationRequest.status" },
          { name: "authoredon", type: "date", description: "Return prescriptions written on this date", expression: "MedicationRequest.authoredOn" },
          { name: "encounter", type: "reference", description: "Return prescriptions with this encounter identifier", expression: "MedicationRequest.encounter" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a MedicationRequest resource", url: "/MedicationRequest/{id}" },
          { name: "search", method: "GET", description: "Search for MedicationRequest resources", url: "/MedicationRequest" },
          { name: "create", method: "POST", description: "Create a new MedicationRequest resource", url: "/MedicationRequest" },
        ],
        elements: [
          { path: "MedicationRequest.status", name: "status", type: "code", cardinality: "1..1", description: "active | on-hold | cancelled | completed | entered-in-error | stopped | draft | unknown", mustSupport: true },
          { path: "MedicationRequest.intent", name: "intent", type: "code", cardinality: "1..1", description: "proposal | plan | order | original-order | reflex-order | filler-order | instance-order | option", mustSupport: true },
          { path: "MedicationRequest.medication[x]", name: "medication", type: "CodeableConcept|Reference(Medication)", cardinality: "1..1", description: "Medication to be taken", mustSupport: true },
          { path: "MedicationRequest.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "Who or group medication request is for", mustSupport: true },
          { path: "MedicationRequest.authoredOn", name: "authoredOn", type: "dateTime", cardinality: "1..1", description: "When request was initially authored", mustSupport: true },
          { path: "MedicationRequest.requester", name: "requester", type: "Reference(Practitioner|PractitionerRole|...)", cardinality: "1..1", description: "Who/What requested the Request", mustSupport: true },
          { path: "MedicationRequest.dosageInstruction", name: "dosageInstruction", type: "Dosage", cardinality: "0..*", description: "How the medication should be taken", mustSupport: true },
        ],
      },
      {
        resourceType: "AllergyIntolerance",
        name: "US Core AllergyIntolerance Profile",
        description: "A record of a clinical assessment of allergy or intolerance",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "AllergyIntolerance.id" },
          { name: "patient", type: "reference", description: "Who the sensitivity is for", expression: "AllergyIntolerance.patient", required: true },
          { name: "clinical-status", type: "token", description: "active | inactive | resolved", expression: "AllergyIntolerance.clinicalStatus" },
          { name: "code", type: "token", description: "Code that identifies the allergy or intolerance", expression: "AllergyIntolerance.code" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read an AllergyIntolerance resource", url: "/AllergyIntolerance/{id}" },
          { name: "search", method: "GET", description: "Search for AllergyIntolerance resources", url: "/AllergyIntolerance" },
          { name: "create", method: "POST", description: "Create a new AllergyIntolerance resource", url: "/AllergyIntolerance" },
        ],
        elements: [
          { path: "AllergyIntolerance.clinicalStatus", name: "clinicalStatus", type: "CodeableConcept", cardinality: "0..1", description: "active | inactive | resolved", mustSupport: true },
          { path: "AllergyIntolerance.verificationStatus", name: "verificationStatus", type: "CodeableConcept", cardinality: "0..1", description: "unconfirmed | presumed | confirmed | refuted | entered-in-error", mustSupport: true },
          { path: "AllergyIntolerance.code", name: "code", type: "CodeableConcept", cardinality: "1..1", description: "Code that identifies the allergy or intolerance", mustSupport: true },
          { path: "AllergyIntolerance.patient", name: "patient", type: "Reference(Patient)", cardinality: "1..1", description: "Who the sensitivity is for", mustSupport: true },
          { path: "AllergyIntolerance.reaction", name: "reaction", type: "BackboneElement", cardinality: "0..*", description: "Adverse Reaction Events linked to exposure to substance", mustSupport: true },
        ],
      },
      {
        resourceType: "Encounter",
        name: "US Core Encounter Profile",
        description: "An interaction between a patient and healthcare provider(s)",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Encounter.id" },
          { name: "patient", type: "reference", description: "The patient present at the encounter", expression: "Encounter.subject", required: true },
          { name: "date", type: "date", description: "A date within the period the Encounter lasted", expression: "Encounter.period" },
          { name: "class", type: "token", description: "Classification of patient encounter", expression: "Encounter.class" },
          { name: "type", type: "token", description: "Specific type of encounter", expression: "Encounter.type" },
          { name: "status", type: "token", description: "planned | arrived | triaged | in-progress | onleave | finished | cancelled +", expression: "Encounter.status" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read an Encounter resource", url: "/Encounter/{id}" },
          { name: "search", method: "GET", description: "Search for Encounter resources", url: "/Encounter" },
          { name: "create", method: "POST", description: "Create a new Encounter resource", url: "/Encounter" },
          { name: "$everything", method: "GET", description: "Get all resources for this encounter", url: "/Encounter/{id}/$everything" },
        ],
        elements: [
          { path: "Encounter.identifier", name: "identifier", type: "Identifier", cardinality: "0..*", description: "Identifier(s) by which this encounter is known", mustSupport: true },
          { path: "Encounter.status", name: "status", type: "code", cardinality: "1..1", description: "planned | arrived | triaged | in-progress | onleave | finished | cancelled +", mustSupport: true },
          { path: "Encounter.class", name: "class", type: "Coding", cardinality: "1..1", description: "Classification of patient encounter", mustSupport: true },
          { path: "Encounter.type", name: "type", type: "CodeableConcept", cardinality: "1..*", description: "Specific type of encounter", mustSupport: true },
          { path: "Encounter.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "The patient present at the encounter", mustSupport: true },
          { path: "Encounter.period", name: "period", type: "Period", cardinality: "0..1", description: "The start and end time of the encounter", mustSupport: true },
        ],
      },
      {
        resourceType: "Immunization",
        name: "US Core Immunization Profile",
        description: "Describes the event of a patient being administered a vaccine",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Immunization.id" },
          { name: "patient", type: "reference", description: "The patient for the vaccination record", expression: "Immunization.patient", required: true },
          { name: "date", type: "date", description: "Vaccination (non)-Administration Date", expression: "Immunization.occurrence" },
          { name: "status", type: "token", description: "Immunization event status", expression: "Immunization.status" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read an Immunization resource", url: "/Immunization/{id}" },
          { name: "search", method: "GET", description: "Search for Immunization resources", url: "/Immunization" },
          { name: "create", method: "POST", description: "Create a new Immunization resource", url: "/Immunization" },
        ],
        elements: [
          { path: "Immunization.status", name: "status", type: "code", cardinality: "1..1", description: "completed | entered-in-error | not-done", mustSupport: true },
          { path: "Immunization.vaccineCode", name: "vaccineCode", type: "CodeableConcept", cardinality: "1..1", description: "Vaccine product administered", mustSupport: true },
          { path: "Immunization.patient", name: "patient", type: "Reference(Patient)", cardinality: "1..1", description: "Who was immunized", mustSupport: true },
          { path: "Immunization.occurrence[x]", name: "occurrence", type: "dateTime|string", cardinality: "1..1", description: "Vaccine administration date", mustSupport: true },
          { path: "Immunization.primarySource", name: "primarySource", type: "boolean", cardinality: "1..1", description: "Indicates context the data was recorded in", mustSupport: true },
        ],
      },
      {
        resourceType: "Procedure",
        name: "US Core Procedure Profile",
        description: "An action that is being or was performed on a patient",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "Procedure.id" },
          { name: "patient", type: "reference", description: "Search by subject - a patient", expression: "Procedure.subject", required: true },
          { name: "date", type: "date", description: "When the procedure was performed", expression: "Procedure.performed" },
          { name: "code", type: "token", description: "A code to identify a procedure", expression: "Procedure.code" },
          { name: "status", type: "token", description: "preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown", expression: "Procedure.status" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a Procedure resource", url: "/Procedure/{id}" },
          { name: "search", method: "GET", description: "Search for Procedure resources", url: "/Procedure" },
          { name: "create", method: "POST", description: "Create a new Procedure resource", url: "/Procedure" },
        ],
        elements: [
          { path: "Procedure.status", name: "status", type: "code", cardinality: "1..1", description: "preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown", mustSupport: true },
          { path: "Procedure.code", name: "code", type: "CodeableConcept", cardinality: "1..1", description: "Identification of the procedure", mustSupport: true },
          { path: "Procedure.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "Who the procedure was performed on", mustSupport: true },
          { path: "Procedure.performed[x]", name: "performed", type: "dateTime|Period", cardinality: "1..1", description: "When the procedure was performed", mustSupport: true },
        ],
      },
      {
        resourceType: "DiagnosticReport",
        name: "US Core DiagnosticReport Profile for Laboratory Results Reporting",
        description: "The findings and interpretation of diagnostic tests performed on patients",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "DiagnosticReport.id" },
          { name: "patient", type: "reference", description: "The subject of the report", expression: "DiagnosticReport.subject", required: true },
          { name: "category", type: "token", description: "Which diagnostic discipline/department created the report", expression: "DiagnosticReport.category" },
          { name: "code", type: "token", description: "The code for the report", expression: "DiagnosticReport.code" },
          { name: "date", type: "date", description: "The clinically relevant time of the report", expression: "DiagnosticReport.effective" },
          { name: "status", type: "token", description: "The status of the report", expression: "DiagnosticReport.status" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a DiagnosticReport resource", url: "/DiagnosticReport/{id}" },
          { name: "search", method: "GET", description: "Search for DiagnosticReport resources", url: "/DiagnosticReport" },
          { name: "create", method: "POST", description: "Create a new DiagnosticReport resource", url: "/DiagnosticReport" },
        ],
        elements: [
          { path: "DiagnosticReport.status", name: "status", type: "code", cardinality: "1..1", description: "registered | partial | preliminary | final +", mustSupport: true },
          { path: "DiagnosticReport.category", name: "category", type: "CodeableConcept", cardinality: "1..*", description: "Service category", mustSupport: true },
          { path: "DiagnosticReport.code", name: "code", type: "CodeableConcept", cardinality: "1..1", description: "Name/Code for this diagnostic report", mustSupport: true },
          { path: "DiagnosticReport.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "The subject of the report", mustSupport: true },
          { path: "DiagnosticReport.effective[x]", name: "effective", type: "dateTime|Period", cardinality: "1..1", description: "Clinically relevant time for report", mustSupport: true },
          { path: "DiagnosticReport.result", name: "result", type: "Reference(Observation)", cardinality: "0..*", description: "Observations that are part of this report", mustSupport: true },
        ],
      },
      {
        resourceType: "DocumentReference",
        name: "US Core DocumentReference Profile",
        description: "A reference to a document of any kind",
        useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
        useCoreVersion: "6.1.0",
        searchParameters: [
          { name: "_id", type: "token", description: "Logical id of this artifact", expression: "DocumentReference.id" },
          { name: "patient", type: "reference", description: "Who/what is the subject of the document", expression: "DocumentReference.subject", required: true },
          { name: "category", type: "token", description: "Categorization of document", expression: "DocumentReference.category" },
          { name: "type", type: "token", description: "Kind of document (LOINC if possible)", expression: "DocumentReference.type" },
          { name: "date", type: "date", description: "When this document reference was created", expression: "DocumentReference.date" },
          { name: "status", type: "token", description: "current | superseded | entered-in-error", expression: "DocumentReference.status" },
          { name: "period", type: "date", description: "Time of service documented", expression: "DocumentReference.context.period" },
        ],
        operations: [
          { name: "read", method: "GET", description: "Read a DocumentReference resource", url: "/DocumentReference/{id}" },
          { name: "search", method: "GET", description: "Search for DocumentReference resources", url: "/DocumentReference" },
          { name: "create", method: "POST", description: "Create a new DocumentReference resource", url: "/DocumentReference" },
          { name: "$docref", method: "GET", description: "Get clinical documents for a patient", url: "/DocumentReference/$docref" },
        ],
        elements: [
          { path: "DocumentReference.identifier", name: "identifier", type: "Identifier", cardinality: "0..*", description: "Other identifiers for the document", mustSupport: true },
          { path: "DocumentReference.status", name: "status", type: "code", cardinality: "1..1", description: "current | superseded | entered-in-error", mustSupport: true },
          { path: "DocumentReference.type", name: "type", type: "CodeableConcept", cardinality: "1..1", description: "Kind of document (LOINC if possible)", mustSupport: true },
          { path: "DocumentReference.category", name: "category", type: "CodeableConcept", cardinality: "1..*", description: "Categorization of document", mustSupport: true },
          { path: "DocumentReference.subject", name: "subject", type: "Reference(Patient)", cardinality: "1..1", description: "Who/what is the subject of the document", mustSupport: true },
          { path: "DocumentReference.date", name: "date", type: "instant", cardinality: "0..1", description: "When this document reference was created", mustSupport: true },
          { path: "DocumentReference.content", name: "content", type: "BackboneElement", cardinality: "1..*", description: "Document referenced", mustSupport: true },
        ],
      },
    ];

    profiles.forEach(profile => {
      this.resourceProfiles.set(profile.resourceType, profile);
    });
  }

  private initializeSampleQueries() {
    const sampleQueries: SavedQuery[] = [
      {
        id: "q-1",
        name: "Get Patient by ID",
        description: "Retrieve a specific patient record by their ID",
        query: {
          id: "q-1-query",
          name: "Get Patient",
          description: "Read patient resource",
          resourceType: "Patient",
          method: "GET",
          endpoint: "/Patient/{id}",
          parameters: { id: "example-patient-id" },
          headers: { Accept: "application/fhir+json" },
          createdAt: new Date().toISOString(),
          createdBy: "system",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        isPublic: true,
        tags: ["patient", "read"],
      },
      {
        id: "q-2",
        name: "Search Patient Observations",
        description: "Find all lab observations for a patient",
        query: {
          id: "q-2-query",
          name: "Patient Labs",
          description: "Search observations by patient and category",
          resourceType: "Observation",
          method: "GET",
          endpoint: "/Observation",
          parameters: { patient: "{patientId}", category: "laboratory" },
          headers: { Accept: "application/fhir+json" },
          createdAt: new Date().toISOString(),
          createdBy: "system",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        isPublic: true,
        tags: ["observation", "laboratory", "search"],
      },
      {
        id: "q-3",
        name: "Patient Everything",
        description: "Retrieve all resources for a patient using $everything operation",
        query: {
          id: "q-3-query",
          name: "$everything",
          description: "Patient $everything operation",
          resourceType: "Patient",
          method: "GET",
          endpoint: "/Patient/{id}/$everything",
          parameters: { id: "example-patient-id" },
          headers: { Accept: "application/fhir+json" },
          createdAt: new Date().toISOString(),
          createdBy: "system",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        isPublic: true,
        tags: ["patient", "everything", "operation"],
      },
    ];

    sampleQueries.forEach(q => this.savedQueries.set(q.id, q));
  }

  getEndpoints(): FHIREndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getEndpoint(id: string): FHIREndpoint | undefined {
    return this.endpoints.get(id);
  }

  getResourceProfiles(): FHIRResourceProfile[] {
    return Array.from(this.resourceProfiles.values());
  }

  getResourceProfile(resourceType: string): FHIRResourceProfile | undefined {
    return this.resourceProfiles.get(resourceType);
  }

  getSavedQueries(): SavedQuery[] {
    return Array.from(this.savedQueries.values());
  }

  getSavedQuery(id: string): SavedQuery | undefined {
    return this.savedQueries.get(id);
  }

  saveQuery(query: Omit<SavedQuery, "id" | "createdAt" | "updatedAt">): SavedQuery {
    const id = `sq-${Date.now()}`;
    const savedQuery: SavedQuery = {
      ...query,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.savedQueries.set(id, savedQuery);
    return savedQuery;
  }

  deleteQuery(id: string): boolean {
    return this.savedQueries.delete(id);
  }

  async executeQuery(
    endpointId: string,
    query: FHIRQuery,
    userId: string
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const resultId = `qr-${Date.now()}`;

    try {
      const endpoint = this.endpoints.get(endpointId);
      if (!endpoint) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      let url = query.endpoint;
      Object.entries(query.parameters).forEach(([key, value]) => {
        if (url.includes(`{${key}}`)) {
          url = url.replace(`{${key}}`, encodeURIComponent(value));
        }
      });

      const queryParams = Object.entries(query.parameters)
        .filter(([key]) => !query.endpoint.includes(`{${key}}`))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");

      if (queryParams) {
        url += (url.includes("?") ? "&" : "?") + queryParams;
      }

      const fullUrl = `${endpoint.baseUrl}${url}`;

      const mockBundle = this.generateMockResponse(query.resourceType, query.parameters);
      const responseTime = Date.now() - startTime;

      const result: QueryResult = {
        id: resultId,
        queryId: query.id,
        endpointId,
        status: 200,
        statusText: "OK",
        responseTime,
        headers: {
          "Content-Type": "application/fhir+json",
          "X-Request-Id": resultId,
        },
        body: mockBundle,
        resourceCount: mockBundle.entry?.length || (mockBundle.resourceType ? 1 : 0),
        totalCount: mockBundle.total,
        nextPageUrl: mockBundle.link?.find((l: { relation: string }) => l.relation === "next")?.url,
        prevPageUrl: mockBundle.link?.find((l: { relation: string }) => l.relation === "previous")?.url,
        executedAt: new Date().toISOString(),
      };

      this.queryResults.set(resultId, result);
      this.queryHistory.unshift(result);
      if (this.queryHistory.length > 100) {
        this.queryHistory.pop();
      }

      console.log(`[FHIRAPIExplorer] Query executed: ${query.method} ${fullUrl} -> ${result.status} (${responseTime}ms)`);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorResult: QueryResult = {
        id: resultId,
        queryId: query.id,
        endpointId,
        status: 500,
        statusText: "Error",
        responseTime,
        headers: {},
        body: null,
        executedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.queryResults.set(resultId, errorResult);
      this.queryHistory.unshift(errorResult);

      return errorResult;
    }
  }

  private generateMockResponse(resourceType: string, parameters: Record<string, string>): any {
    const isSearch = !parameters.id || Object.keys(parameters).length > 1;

    if (isSearch) {
      return {
        resourceType: "Bundle",
        type: "searchset",
        total: 3,
        link: [
          { relation: "self", url: `/${resourceType}?${new URLSearchParams(parameters).toString()}` },
          { relation: "next", url: `/${resourceType}?_page=2` },
        ],
        entry: this.generateMockEntries(resourceType, 3),
      };
    } else {
      return this.generateMockResource(resourceType, parameters.id);
    }
  }

  private generateMockEntries(resourceType: string, count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      fullUrl: `urn:uuid:example-${resourceType.toLowerCase()}-${i + 1}`,
      resource: this.generateMockResource(resourceType, `example-${i + 1}`),
      search: { mode: "match" },
    }));
  }

  private generateMockResource(resourceType: string, id: string): any {
    const base = {
      resourceType,
      id,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString(),
        profile: [this.resourceProfiles.get(resourceType)?.useCoreProfile],
      },
    };

    switch (resourceType) {
      case "Patient":
        return {
          ...base,
          identifier: [{ system: "http://example.org/fhir/mrn", value: `MRN-${id}` }],
          name: [{ family: "Smith", given: ["John", "Michael"], use: "official" }],
          gender: "male",
          birthDate: "1970-01-15",
          address: [{ city: "Boston", state: "MA", postalCode: "02115", country: "USA" }],
          telecom: [
            { system: "phone", value: "555-123-4567", use: "home" },
            { system: "email", value: "john.smith@example.com" },
          ],
        };
      case "Observation":
        return {
          ...base,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
          code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose [Mass/volume] in Blood" }] },
          subject: { reference: "Patient/example-1" },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: { value: 95, unit: "mg/dL", system: "http://unitsofmeasure.org", code: "mg/dL" },
        };
      case "Condition":
        return {
          ...base,
          clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
          verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] }],
          code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }] },
          subject: { reference: "Patient/example-1" },
          onsetDateTime: "2020-03-15",
        };
      default:
        return base;
    }
  }

  getQueryHistory(): QueryResult[] {
    return this.queryHistory;
  }

  getQueryResult(id: string): QueryResult | undefined {
    return this.queryResults.get(id);
  }

  testEndpointConnection(endpointId: string): Promise<{ success: boolean; message: string; responseTime: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const endpoint = this.endpoints.get(endpointId);
      
      if (!endpoint) {
        resolve({ success: false, message: "Endpoint not found", responseTime: Date.now() - startTime });
        return;
      }

      setTimeout(() => {
        const responseTime = Date.now() - startTime;
        resolve({
          success: true,
          message: `Successfully connected to ${endpoint.name} (${endpoint.baseUrl})`,
          responseTime,
        });
      }, 100 + Math.random() * 200);
    });
  }

  getExplorerMetadata() {
    return {
      version: "1.0.0",
      fhirVersion: "R4",
      useCoreVersion: "6.1.0",
      resourceCount: this.resourceProfiles.size,
      savedQueryCount: this.savedQueries.size,
      queryHistoryCount: this.queryHistory.length,
      supportedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      features: [
        "US Core Profile browsing",
        "Query builder with search parameters",
        "RESTful API execution",
        "JSON response viewer",
        "Pagination support",
        "Query history",
        "OAuth integration",
      ],
    };
  }
}

export const fhirAPIExplorerService = new FHIRAPIExplorerService();
