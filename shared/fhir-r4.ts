/**
 * FHIR R4 Resource Type Definitions
 * Standardized healthcare data models following HL7 FHIR R4 specification
 * https://www.hl7.org/fhir/R4/
 */

import { z } from "zod";

// ============================================
// CODE SYSTEM DEFINITIONS
// ============================================

export const CodeSystemURIs = {
  SNOMED_CT: "http://snomed.info/sct",
  LOINC: "http://loinc.org",
  ICD10_CM: "http://hl7.org/fhir/sid/icd-10-cm",
  ICD10_PCS: "http://www.cms.gov/Medicare/Coding/ICD10",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  CPT: "http://www.ama-assn.org/go/cpt",
  HCPCS: "urn:oid:2.16.840.1.113883.6.285",
  NDC: "http://hl7.org/fhir/sid/ndc",
  CVX: "http://hl7.org/fhir/sid/cvx",
  UCUM: "http://unitsofmeasure.org",
  HL7_OBSERVATION_CATEGORY: "http://terminology.hl7.org/CodeSystem/observation-category",
  HL7_CONDITION_CLINICAL: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  HL7_CONDITION_VERIFICATION: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
  HL7_ALLERGY_CLINICAL: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  HL7_ALLERGY_VERIFICATION: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
  HL7_MEDICATION_REQUEST_INTENT: "http://hl7.org/fhir/CodeSystem/medicationrequest-intent",
  HL7_MEDICATION_REQUEST_STATUS: "http://hl7.org/fhir/CodeSystem/medicationrequest-status",
} as const;

export type CodeSystemURI = typeof CodeSystemURIs[keyof typeof CodeSystemURIs];

// ============================================
// FHIR R4 DATA TYPES
// ============================================

// Coding - A reference to a code defined by a terminology system
export const codingSchema = z.object({
  system: z.string().url().optional(),
  version: z.string().optional(),
  code: z.string(),
  display: z.string().optional(),
  userSelected: z.boolean().optional(),
});

export type Coding = z.infer<typeof codingSchema>;

// CodeableConcept - A concept that may be defined by a formal reference to a terminology
export const codeableConceptSchema = z.object({
  coding: z.array(codingSchema).optional(),
  text: z.string().optional(),
});

export type CodeableConcept = z.infer<typeof codeableConceptSchema>;

// Identifier - An identifier intended for computation
export const identifierUseValues = ["usual", "official", "temp", "secondary", "old"] as const;
export const identifierSchema = z.object({
  use: z.enum(identifierUseValues).optional(),
  type: codeableConceptSchema.optional(),
  system: z.string().url().optional(),
  value: z.string(),
  period: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  assigner: z.object({
    reference: z.string().optional(),
    display: z.string().optional(),
  }).optional(),
});

export type Identifier = z.infer<typeof identifierSchema>;

// Reference - A reference from one resource to another
export const referenceSchema = z.object({
  reference: z.string().optional(),
  type: z.string().optional(),
  identifier: identifierSchema.optional(),
  display: z.string().optional(),
});

export type Reference = z.infer<typeof referenceSchema>;

// Period - A time period defined by a start and end date/time
export const periodSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export type Period = z.infer<typeof periodSchema>;

// Quantity - A measured or measurable amount
export const quantitySchema = z.object({
  value: z.number().optional(),
  comparator: z.enum(["<", "<=", ">=", ">"]).optional(),
  unit: z.string().optional(),
  system: z.string().url().optional(),
  code: z.string().optional(),
});

export type Quantity = z.infer<typeof quantitySchema>;

// Range - A set of ordered Quantity values defined by a low and high limit
export const rangeSchema = z.object({
  low: quantitySchema.optional(),
  high: quantitySchema.optional(),
});

export type Range = z.infer<typeof rangeSchema>;

// HumanName - A human's name with the ability to identify parts and usage
export const humanNameSchema = z.object({
  use: z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]).optional(),
  text: z.string().optional(),
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
  period: periodSchema.optional(),
});

export type HumanName = z.infer<typeof humanNameSchema>;

// Address
export const addressSchema = z.object({
  use: z.enum(["home", "work", "temp", "old", "billing"]).optional(),
  type: z.enum(["postal", "physical", "both"]).optional(),
  text: z.string().optional(),
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  period: periodSchema.optional(),
});

export type Address = z.infer<typeof addressSchema>;

// ContactPoint
export const contactPointSchema = z.object({
  system: z.enum(["phone", "fax", "email", "pager", "url", "sms", "other"]).optional(),
  value: z.string().optional(),
  use: z.enum(["home", "work", "temp", "old", "mobile"]).optional(),
  rank: z.number().int().positive().optional(),
  period: periodSchema.optional(),
});

export type ContactPoint = z.infer<typeof contactPointSchema>;

// Meta - Metadata about a resource
export const metaSchema = z.object({
  versionId: z.string().optional(),
  lastUpdated: z.string().optional(),
  source: z.string().optional(),
  profile: z.array(z.string().url()).optional(),
  security: z.array(codingSchema).optional(),
  tag: z.array(codingSchema).optional(),
});

export type Meta = z.infer<typeof metaSchema>;

// Narrative - Human-readable summary
export const narrativeSchema = z.object({
  status: z.enum(["generated", "extensions", "additional", "empty"]),
  div: z.string(),
});

export type Narrative = z.infer<typeof narrativeSchema>;

// ============================================
// FHIR R4 RESOURCE BASE
// ============================================

export const resourceBaseSchema = z.object({
  resourceType: z.string(),
  id: z.string().optional(),
  meta: metaSchema.optional(),
  implicitRules: z.string().url().optional(),
  language: z.string().optional(),
});

export type ResourceBase = z.infer<typeof resourceBaseSchema>;

// ============================================
// FHIR R4 PATIENT RESOURCE
// ============================================

export const patientResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Patient"),
  identifier: z.array(identifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(humanNameSchema).optional(),
  telecom: z.array(contactPointSchema).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().optional(),
  deceasedBoolean: z.boolean().optional(),
  deceasedDateTime: z.string().optional(),
  address: z.array(addressSchema).optional(),
  maritalStatus: codeableConceptSchema.optional(),
  multipleBirthBoolean: z.boolean().optional(),
  multipleBirthInteger: z.number().int().optional(),
  contact: z.array(z.object({
    relationship: z.array(codeableConceptSchema).optional(),
    name: humanNameSchema.optional(),
    telecom: z.array(contactPointSchema).optional(),
    address: addressSchema.optional(),
    gender: z.enum(["male", "female", "other", "unknown"]).optional(),
    organization: referenceSchema.optional(),
    period: periodSchema.optional(),
  })).optional(),
  communication: z.array(z.object({
    language: codeableConceptSchema,
    preferred: z.boolean().optional(),
  })).optional(),
  generalPractitioner: z.array(referenceSchema).optional(),
  managingOrganization: referenceSchema.optional(),
  link: z.array(z.object({
    other: referenceSchema,
    type: z.enum(["replaced-by", "replaces", "refer", "seealso"]),
  })).optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

// ============================================
// FHIR R4 CONDITION RESOURCE
// ============================================

export const conditionClinicalStatusValues = ["active", "recurrence", "relapse", "inactive", "remission", "resolved"] as const;
export const conditionVerificationStatusValues = ["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"] as const;
export const conditionCategoryValues = ["problem-list-item", "encounter-diagnosis"] as const;

export const conditionResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Condition"),
  identifier: z.array(identifierSchema).optional(),
  clinicalStatus: codeableConceptSchema.optional(),
  verificationStatus: codeableConceptSchema.optional(),
  category: z.array(codeableConceptSchema).optional(),
  severity: codeableConceptSchema.optional(),
  code: codeableConceptSchema.optional(),
  bodySite: z.array(codeableConceptSchema).optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  onsetDateTime: z.string().optional(),
  onsetAge: quantitySchema.optional(),
  onsetPeriod: periodSchema.optional(),
  onsetRange: rangeSchema.optional(),
  onsetString: z.string().optional(),
  abatementDateTime: z.string().optional(),
  abatementAge: quantitySchema.optional(),
  abatementPeriod: periodSchema.optional(),
  abatementRange: rangeSchema.optional(),
  abatementString: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: referenceSchema.optional(),
  asserter: referenceSchema.optional(),
  stage: z.array(z.object({
    summary: codeableConceptSchema.optional(),
    assessment: z.array(referenceSchema).optional(),
    type: codeableConceptSchema.optional(),
  })).optional(),
  evidence: z.array(z.object({
    code: z.array(codeableConceptSchema).optional(),
    detail: z.array(referenceSchema).optional(),
  })).optional(),
  note: z.array(z.object({
    authorReference: referenceSchema.optional(),
    authorString: z.string().optional(),
    time: z.string().optional(),
    text: z.string(),
  })).optional(),
});

export type ConditionResource = z.infer<typeof conditionResourceSchema>;

// ============================================
// FHIR R4 OBSERVATION RESOURCE
// ============================================

export const observationStatusValues = ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"] as const;

export const observationResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Observation"),
  identifier: z.array(identifierSchema).optional(),
  basedOn: z.array(referenceSchema).optional(),
  partOf: z.array(referenceSchema).optional(),
  status: z.enum(observationStatusValues),
  category: z.array(codeableConceptSchema).optional(),
  code: codeableConceptSchema,
  subject: referenceSchema.optional(),
  focus: z.array(referenceSchema).optional(),
  encounter: referenceSchema.optional(),
  effectiveDateTime: z.string().optional(),
  effectivePeriod: periodSchema.optional(),
  effectiveTiming: z.any().optional(),
  effectiveInstant: z.string().optional(),
  issued: z.string().optional(),
  performer: z.array(referenceSchema).optional(),
  valueQuantity: quantitySchema.optional(),
  valueCodeableConcept: codeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  valueRange: rangeSchema.optional(),
  valueRatio: z.object({
    numerator: quantitySchema.optional(),
    denominator: quantitySchema.optional(),
  }).optional(),
  valueSampledData: z.any().optional(),
  valueTime: z.string().optional(),
  valueDateTime: z.string().optional(),
  valuePeriod: periodSchema.optional(),
  dataAbsentReason: codeableConceptSchema.optional(),
  interpretation: z.array(codeableConceptSchema).optional(),
  note: z.array(z.object({
    authorReference: referenceSchema.optional(),
    authorString: z.string().optional(),
    time: z.string().optional(),
    text: z.string(),
  })).optional(),
  bodySite: codeableConceptSchema.optional(),
  method: codeableConceptSchema.optional(),
  specimen: referenceSchema.optional(),
  device: referenceSchema.optional(),
  referenceRange: z.array(z.object({
    low: quantitySchema.optional(),
    high: quantitySchema.optional(),
    type: codeableConceptSchema.optional(),
    appliesTo: z.array(codeableConceptSchema).optional(),
    age: rangeSchema.optional(),
    text: z.string().optional(),
  })).optional(),
  hasMember: z.array(referenceSchema).optional(),
  derivedFrom: z.array(referenceSchema).optional(),
  component: z.array(z.object({
    code: codeableConceptSchema,
    valueQuantity: quantitySchema.optional(),
    valueCodeableConcept: codeableConceptSchema.optional(),
    valueString: z.string().optional(),
    valueBoolean: z.boolean().optional(),
    valueInteger: z.number().int().optional(),
    valueRange: rangeSchema.optional(),
    valueRatio: z.any().optional(),
    valueSampledData: z.any().optional(),
    valueTime: z.string().optional(),
    valueDateTime: z.string().optional(),
    valuePeriod: periodSchema.optional(),
    dataAbsentReason: codeableConceptSchema.optional(),
    interpretation: z.array(codeableConceptSchema).optional(),
    referenceRange: z.array(z.any()).optional(),
  })).optional(),
});

export type ObservationResource = z.infer<typeof observationResourceSchema>;

// ============================================
// FHIR R4 MEDICATION REQUEST RESOURCE
// ============================================

export const medicationRequestStatusValues = ["active", "on-hold", "cancelled", "completed", "entered-in-error", "stopped", "draft", "unknown"] as const;
export const medicationRequestIntentValues = ["proposal", "plan", "order", "original-order", "reflex-order", "filler-order", "instance-order", "option"] as const;

export const dosageSchema = z.object({
  sequence: z.number().int().optional(),
  text: z.string().optional(),
  additionalInstruction: z.array(codeableConceptSchema).optional(),
  patientInstruction: z.string().optional(),
  timing: z.any().optional(),
  asNeededBoolean: z.boolean().optional(),
  asNeededCodeableConcept: codeableConceptSchema.optional(),
  site: codeableConceptSchema.optional(),
  route: codeableConceptSchema.optional(),
  method: codeableConceptSchema.optional(),
  doseAndRate: z.array(z.object({
    type: codeableConceptSchema.optional(),
    doseRange: rangeSchema.optional(),
    doseQuantity: quantitySchema.optional(),
    rateRatio: z.any().optional(),
    rateRange: rangeSchema.optional(),
    rateQuantity: quantitySchema.optional(),
  })).optional(),
  maxDosePerPeriod: z.any().optional(),
  maxDosePerAdministration: quantitySchema.optional(),
  maxDosePerLifetime: quantitySchema.optional(),
});

export type Dosage = z.infer<typeof dosageSchema>;

export const medicationRequestResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("MedicationRequest"),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum(medicationRequestStatusValues),
  statusReason: codeableConceptSchema.optional(),
  intent: z.enum(medicationRequestIntentValues),
  category: z.array(codeableConceptSchema).optional(),
  priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  doNotPerform: z.boolean().optional(),
  reportedBoolean: z.boolean().optional(),
  reportedReference: referenceSchema.optional(),
  medicationCodeableConcept: codeableConceptSchema.optional(),
  medicationReference: referenceSchema.optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  supportingInformation: z.array(referenceSchema).optional(),
  authoredOn: z.string().optional(),
  requester: referenceSchema.optional(),
  performer: referenceSchema.optional(),
  performerType: codeableConceptSchema.optional(),
  recorder: referenceSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(referenceSchema).optional(),
  groupIdentifier: identifierSchema.optional(),
  courseOfTherapyType: codeableConceptSchema.optional(),
  insurance: z.array(referenceSchema).optional(),
  note: z.array(z.any()).optional(),
  dosageInstruction: z.array(dosageSchema).optional(),
  dispenseRequest: z.object({
    initialFill: z.object({
      quantity: quantitySchema.optional(),
      duration: z.any().optional(),
    }).optional(),
    dispenseInterval: z.any().optional(),
    validityPeriod: periodSchema.optional(),
    numberOfRepeatsAllowed: z.number().int().optional(),
    quantity: quantitySchema.optional(),
    expectedSupplyDuration: z.any().optional(),
    performer: referenceSchema.optional(),
  }).optional(),
  substitution: z.object({
    allowedBoolean: z.boolean().optional(),
    allowedCodeableConcept: codeableConceptSchema.optional(),
    reason: codeableConceptSchema.optional(),
  }).optional(),
  priorPrescription: referenceSchema.optional(),
  detectedIssue: z.array(referenceSchema).optional(),
  eventHistory: z.array(referenceSchema).optional(),
});

export type MedicationRequestResource = z.infer<typeof medicationRequestResourceSchema>;

// ============================================
// FHIR R4 ALLERGY INTOLERANCE RESOURCE
// ============================================

export const allergyIntoleranceClinicalStatusValues = ["active", "inactive", "resolved"] as const;
export const allergyIntoleranceVerificationStatusValues = ["unconfirmed", "confirmed", "refuted", "entered-in-error"] as const;
export const allergyIntoleranceTypeValues = ["allergy", "intolerance"] as const;
export const allergyIntoleranceCategoryValues = ["food", "medication", "environment", "biologic"] as const;
export const allergyIntoleranceCriticalityValues = ["low", "high", "unable-to-assess"] as const;

export const allergyIntoleranceResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("AllergyIntolerance"),
  identifier: z.array(identifierSchema).optional(),
  clinicalStatus: codeableConceptSchema.optional(),
  verificationStatus: codeableConceptSchema.optional(),
  type: z.enum(allergyIntoleranceTypeValues).optional(),
  category: z.array(z.enum(allergyIntoleranceCategoryValues)).optional(),
  criticality: z.enum(allergyIntoleranceCriticalityValues).optional(),
  code: codeableConceptSchema.optional(),
  patient: referenceSchema,
  encounter: referenceSchema.optional(),
  onsetDateTime: z.string().optional(),
  onsetAge: quantitySchema.optional(),
  onsetPeriod: periodSchema.optional(),
  onsetRange: rangeSchema.optional(),
  onsetString: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: referenceSchema.optional(),
  asserter: referenceSchema.optional(),
  lastOccurrence: z.string().optional(),
  note: z.array(z.any()).optional(),
  reaction: z.array(z.object({
    substance: codeableConceptSchema.optional(),
    manifestation: z.array(codeableConceptSchema),
    description: z.string().optional(),
    onset: z.string().optional(),
    severity: z.enum(["mild", "moderate", "severe"]).optional(),
    exposureRoute: codeableConceptSchema.optional(),
    note: z.array(z.any()).optional(),
  })).optional(),
});

export type AllergyIntoleranceResource = z.infer<typeof allergyIntoleranceResourceSchema>;

// ============================================
// FHIR R4 DIAGNOSTIC REPORT RESOURCE
// ============================================

export const diagnosticReportStatusValues = ["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "entered-in-error", "unknown"] as const;

export const diagnosticReportResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("DiagnosticReport"),
  identifier: z.array(identifierSchema).optional(),
  basedOn: z.array(referenceSchema).optional(),
  status: z.enum(diagnosticReportStatusValues),
  category: z.array(codeableConceptSchema).optional(),
  code: codeableConceptSchema,
  subject: referenceSchema.optional(),
  encounter: referenceSchema.optional(),
  effectiveDateTime: z.string().optional(),
  effectivePeriod: periodSchema.optional(),
  issued: z.string().optional(),
  performer: z.array(referenceSchema).optional(),
  resultsInterpreter: z.array(referenceSchema).optional(),
  specimen: z.array(referenceSchema).optional(),
  result: z.array(referenceSchema).optional(),
  imagingStudy: z.array(referenceSchema).optional(),
  media: z.array(z.object({
    comment: z.string().optional(),
    link: referenceSchema,
  })).optional(),
  conclusion: z.string().optional(),
  conclusionCode: z.array(codeableConceptSchema).optional(),
  presentedForm: z.array(z.any()).optional(),
});

export type DiagnosticReportResource = z.infer<typeof diagnosticReportResourceSchema>;

// ============================================
// FHIR R4 IMMUNIZATION RESOURCE
// ============================================

export const immunizationStatusValues = ["completed", "entered-in-error", "not-done"] as const;

export const immunizationResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Immunization"),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum(immunizationStatusValues),
  statusReason: codeableConceptSchema.optional(),
  vaccineCode: codeableConceptSchema,
  patient: referenceSchema,
  encounter: referenceSchema.optional(),
  occurrenceDateTime: z.string().optional(),
  occurrenceString: z.string().optional(),
  recorded: z.string().optional(),
  primarySource: z.boolean().optional(),
  reportOrigin: codeableConceptSchema.optional(),
  location: referenceSchema.optional(),
  manufacturer: referenceSchema.optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  site: codeableConceptSchema.optional(),
  route: codeableConceptSchema.optional(),
  doseQuantity: quantitySchema.optional(),
  performer: z.array(z.object({
    function: codeableConceptSchema.optional(),
    actor: referenceSchema,
  })).optional(),
  note: z.array(z.any()).optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  isSubpotent: z.boolean().optional(),
  subpotentReason: z.array(codeableConceptSchema).optional(),
  education: z.array(z.object({
    documentType: z.string().optional(),
    reference: z.string().optional(),
    publicationDate: z.string().optional(),
    presentationDate: z.string().optional(),
  })).optional(),
  programEligibility: z.array(codeableConceptSchema).optional(),
  fundingSource: codeableConceptSchema.optional(),
  reaction: z.array(z.object({
    date: z.string().optional(),
    detail: referenceSchema.optional(),
    reported: z.boolean().optional(),
  })).optional(),
  protocolApplied: z.array(z.object({
    series: z.string().optional(),
    authority: referenceSchema.optional(),
    targetDisease: z.array(codeableConceptSchema).optional(),
    doseNumberPositiveInt: z.number().int().positive().optional(),
    doseNumberString: z.string().optional(),
    seriesDosesPositiveInt: z.number().int().positive().optional(),
    seriesDosesString: z.string().optional(),
  })).optional(),
});

export type ImmunizationResource = z.infer<typeof immunizationResourceSchema>;

// ============================================
// FHIR R4 PROCEDURE RESOURCE
// ============================================

export const procedureStatusValues = ["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"] as const;

export const procedureResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Procedure"),
  identifier: z.array(identifierSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(referenceSchema).optional(),
  partOf: z.array(referenceSchema).optional(),
  status: z.enum(procedureStatusValues),
  statusReason: codeableConceptSchema.optional(),
  category: codeableConceptSchema.optional(),
  code: codeableConceptSchema.optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  performedDateTime: z.string().optional(),
  performedPeriod: periodSchema.optional(),
  performedString: z.string().optional(),
  performedAge: quantitySchema.optional(),
  performedRange: rangeSchema.optional(),
  recorder: referenceSchema.optional(),
  asserter: referenceSchema.optional(),
  performer: z.array(z.object({
    function: codeableConceptSchema.optional(),
    actor: referenceSchema,
    onBehalfOf: referenceSchema.optional(),
  })).optional(),
  location: referenceSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  bodySite: z.array(codeableConceptSchema).optional(),
  outcome: codeableConceptSchema.optional(),
  report: z.array(referenceSchema).optional(),
  complication: z.array(codeableConceptSchema).optional(),
  complicationDetail: z.array(referenceSchema).optional(),
  followUp: z.array(codeableConceptSchema).optional(),
  note: z.array(z.any()).optional(),
  focalDevice: z.array(z.object({
    action: codeableConceptSchema.optional(),
    manipulated: referenceSchema,
  })).optional(),
  usedReference: z.array(referenceSchema).optional(),
  usedCode: z.array(codeableConceptSchema).optional(),
});

export type ProcedureResource = z.infer<typeof procedureResourceSchema>;

// ============================================
// FHIR R4 CARE PLAN RESOURCE (Non-CDS)
// ============================================

export const carePlanStatusValues = ["draft", "active", "on-hold", "revoked", "completed", "entered-in-error", "unknown"] as const;
export const carePlanIntentValues = ["proposal", "plan", "order", "option"] as const;

export const carePlanResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("CarePlan"),
  identifier: z.array(identifierSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(referenceSchema).optional(),
  replaces: z.array(referenceSchema).optional(),
  partOf: z.array(referenceSchema).optional(),
  status: z.enum(carePlanStatusValues),
  intent: z.enum(carePlanIntentValues),
  category: z.array(codeableConceptSchema).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  period: periodSchema.optional(),
  created: z.string().optional(),
  author: referenceSchema.optional(),
  contributor: z.array(referenceSchema).optional(),
  careTeam: z.array(referenceSchema).optional(),
  addresses: z.array(referenceSchema).optional(),
  supportingInfo: z.array(referenceSchema).optional(),
  goal: z.array(referenceSchema).optional(),
  activity: z.array(z.object({
    outcomeCodeableConcept: z.array(codeableConceptSchema).optional(),
    outcomeReference: z.array(referenceSchema).optional(),
    progress: z.array(z.any()).optional(),
    reference: referenceSchema.optional(),
    detail: z.object({
      kind: z.string().optional(),
      instantiatesCanonical: z.array(z.string()).optional(),
      instantiatesUri: z.array(z.string()).optional(),
      code: codeableConceptSchema.optional(),
      reasonCode: z.array(codeableConceptSchema).optional(),
      reasonReference: z.array(referenceSchema).optional(),
      goal: z.array(referenceSchema).optional(),
      status: z.enum(["not-started", "scheduled", "in-progress", "on-hold", "completed", "cancelled", "stopped", "unknown", "entered-in-error"]),
      statusReason: codeableConceptSchema.optional(),
      doNotPerform: z.boolean().optional(),
      scheduledTiming: z.any().optional(),
      scheduledPeriod: periodSchema.optional(),
      scheduledString: z.string().optional(),
      location: referenceSchema.optional(),
      performer: z.array(referenceSchema).optional(),
      productCodeableConcept: codeableConceptSchema.optional(),
      productReference: referenceSchema.optional(),
      dailyAmount: quantitySchema.optional(),
      quantity: quantitySchema.optional(),
      description: z.string().optional(),
    }).optional(),
  })).optional(),
  note: z.array(z.any()).optional(),
});

export type CarePlanResource = z.infer<typeof carePlanResourceSchema>;

// ============================================
// FHIR R4 PROVENANCE RESOURCE
// ============================================

export const provenanceResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Provenance"),
  target: z.array(referenceSchema),
  occurredPeriod: periodSchema.optional(),
  occurredDateTime: z.string().optional(),
  recorded: z.string(),
  policy: z.array(z.string()).optional(),
  location: referenceSchema.optional(),
  reason: z.array(codeableConceptSchema).optional(),
  activity: codeableConceptSchema.optional(),
  agent: z.array(z.object({
    type: codeableConceptSchema.optional(),
    role: z.array(codeableConceptSchema).optional(),
    who: referenceSchema,
    onBehalfOf: referenceSchema.optional(),
  })),
  entity: z.array(z.object({
    role: z.enum(["derivation", "revision", "quotation", "source", "removal"]),
    what: referenceSchema,
    agent: z.array(z.any()).optional(),
  })).optional(),
  signature: z.array(z.any()).optional(),
});

export type ProvenanceResource = z.infer<typeof provenanceResourceSchema>;

// ============================================
// FHIR R4 BUNDLE RESOURCE
// ============================================

export const bundleTypeValues = ["document", "message", "transaction", "transaction-response", "batch", "batch-response", "history", "searchset", "collection"] as const;

export const bundleResourceSchema = resourceBaseSchema.extend({
  resourceType: z.literal("Bundle"),
  identifier: identifierSchema.optional(),
  type: z.enum(bundleTypeValues),
  timestamp: z.string().optional(),
  total: z.number().int().optional(),
  link: z.array(z.object({
    relation: z.string(),
    url: z.string(),
  })).optional(),
  entry: z.array(z.object({
    link: z.array(z.any()).optional(),
    fullUrl: z.string().optional(),
    resource: z.any().optional(),
    search: z.object({
      mode: z.enum(["match", "include", "outcome"]).optional(),
      score: z.number().optional(),
    }).optional(),
    request: z.object({
      method: z.enum(["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"]),
      url: z.string(),
      ifNoneMatch: z.string().optional(),
      ifModifiedSince: z.string().optional(),
      ifMatch: z.string().optional(),
      ifNoneExist: z.string().optional(),
    }).optional(),
    response: z.object({
      status: z.string(),
      location: z.string().optional(),
      etag: z.string().optional(),
      lastModified: z.string().optional(),
      outcome: z.any().optional(),
    }).optional(),
  })).optional(),
  signature: z.any().optional(),
});

export type BundleResource = z.infer<typeof bundleResourceSchema>;

// ============================================
// HELPER FUNCTIONS FOR CODE SYSTEM HANDLING
// ============================================

export function createCoding(system: CodeSystemURI, code: string, display?: string): Coding {
  return { system, code, display };
}

export function createCodeableConcept(codings: Coding[], text?: string): CodeableConcept {
  return { coding: codings, text };
}

export function createSNOMEDCoding(code: string, display?: string): Coding {
  return createCoding(CodeSystemURIs.SNOMED_CT, code, display);
}

export function createLOINCCoding(code: string, display?: string): Coding {
  return createCoding(CodeSystemURIs.LOINC, code, display);
}

export function createICD10Coding(code: string, display?: string): Coding {
  return createCoding(CodeSystemURIs.ICD10_CM, code, display);
}

export function createRxNormCoding(code: string, display?: string): Coding {
  return createCoding(CodeSystemURIs.RXNORM, code, display);
}

export function createIdentifier(system: string, value: string, use: typeof identifierUseValues[number] = "usual"): Identifier {
  return { use, system, value };
}

export function createReference(resourceType: string, id: string, display?: string): Reference {
  return {
    reference: `${resourceType}/${id}`,
    type: resourceType,
    display,
  };
}

// ============================================
// FHIR R4 RESOURCE UNION TYPE
// ============================================

export type FHIRResource =
  | PatientResource
  | ConditionResource
  | ObservationResource
  | MedicationRequestResource
  | AllergyIntoleranceResource
  | DiagnosticReportResource
  | ImmunizationResource
  | ProcedureResource
  | CarePlanResource
  | ProvenanceResource
  | BundleResource;

export const fhirResourceTypes = [
  "Patient",
  "Condition",
  "Observation",
  "MedicationRequest",
  "AllergyIntolerance",
  "DiagnosticReport",
  "Immunization",
  "Procedure",
  "CarePlan",
  "Provenance",
  "Bundle",
] as const;

export type FHIRResourceType = typeof fhirResourceTypes[number];
