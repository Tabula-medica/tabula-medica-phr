import type {
  Patient,
  MedicalRecord,
  Medication,
  VitalSign,
  TimelineEvent,
  Document,
  InsertPatient,
  InsertMedicalRecord,
  InsertMedication,
  InsertVitalSign,
  EhrConnection,
} from "@shared/schema";
import type {
  FhirPatient,
  FhirCondition,
  FhirObservation,
  FhirMedicationRequest,
  FhirImmunization,
  FhirDocumentReference,
  FhirAllergyIntolerance,
  FhirProcedure,
  FhirEncounter,
} from "./client";

export function mapFhirPatient(
  fhirPatient: FhirPatient,
  connection: EhrConnection
): InsertPatient {
  const name = fhirPatient.name?.[0];
  const firstName = name?.given?.[0] || "Unknown";
  const lastName = name?.family || "Unknown";
  
  const email = fhirPatient.telecom?.find(t => t.system === "email")?.value || "";
  const phone = fhirPatient.telecom?.find(t => t.system === "phone")?.value || "";
  
  const addr = fhirPatient.address?.[0];
  const address = addr 
    ? [addr.line?.join(" "), addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")
    : "";
  
  const mrn = fhirPatient.identifier?.find(
    i => i.type?.text?.toLowerCase().includes("mrn") || i.type?.text?.toLowerCase().includes("medical record")
  )?.value || fhirPatient.id || "";
  
  return {
    ehrConnectionId: connection.id,
    mrn,
    firstName,
    lastName,
    dateOfBirth: fhirPatient.birthDate || "",
    gender: (fhirPatient.gender as "male" | "female" | "other") || "other",
    email,
    phone,
    address,
    insuranceProvider: "",
    insuranceId: "",
    primaryPhysician: "",
  };
}

export function mapFhirCondition(
  condition: FhirCondition,
  patientId: string,
  connection: EhrConnection
): InsertMedicalRecord {
  const title = condition.code?.text || 
    condition.code?.coding?.[0]?.display || 
    "Unknown Condition";
  
  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code || "active";
  const status = clinicalStatus === "resolved" ? "resolved" : 
                 clinicalStatus === "inactive" ? "resolved" : "active";
  
  return {
    patientId,
    ehrConnectionId: connection.id,
    type: "diagnosis",
    title,
    description: `Diagnosis: ${title}`,
    date: condition.recordedDate || condition.onsetDateTime || new Date().toISOString(),
    provider: condition.recorder?.display || "Unknown Provider",
    facility: connection.facilityName,
    status: status as "active" | "resolved" | "pending",
  };
}

export function mapFhirObservationToVital(
  observation: FhirObservation,
  patientId: string,
  connection: EhrConnection
): InsertVitalSign | null {
  const code = observation.code?.coding?.[0]?.code;
  const display = observation.code?.text || observation.code?.coding?.[0]?.display;
  
  const vitalTypeMap: Record<string, InsertVitalSign["type"]> = {
    "85354-9": "blood_pressure",
    "8867-4": "heart_rate",
    "8310-5": "temperature",
    "29463-7": "weight",
    "2708-6": "oxygen_saturation",
    "9279-1": "respiratory_rate",
  };
  
  const vitalType = code ? vitalTypeMap[code] : undefined;
  if (!vitalType) return null;
  
  let value: string;
  let unit: string;
  
  if (observation.component && vitalType === "blood_pressure") {
    const systolic = observation.component.find(c => 
      c.code?.coding?.some(coding => coding.code === "8480-6")
    );
    const diastolic = observation.component.find(c => 
      c.code?.coding?.some(coding => coding.code === "8462-4")
    );
    value = `${systolic?.valueQuantity?.value || 0}/${diastolic?.valueQuantity?.value || 0}`;
    unit = "mmHg";
  } else if (observation.valueQuantity) {
    value = String(observation.valueQuantity.value);
    unit = observation.valueQuantity.unit || "";
  } else if (observation.valueString) {
    value = observation.valueString;
    unit = "";
  } else {
    return null;
  }
  
  return {
    patientId,
    ehrConnectionId: connection.id,
    type: vitalType,
    value,
    unit,
    recordedAt: observation.effectiveDateTime || observation.issued || new Date().toISOString(),
    recordedBy: observation.performer?.[0]?.display || "Unknown",
  };
}

export function mapFhirObservationToLabResult(
  observation: FhirObservation,
  patientId: string,
  connection: EhrConnection
): InsertMedicalRecord | null {
  const category = observation.category?.[0]?.coding?.[0]?.code;
  if (category !== "laboratory") return null;
  
  const title = observation.code?.text || observation.code?.coding?.[0]?.display || "Lab Result";
  
  let value = "";
  if (observation.valueQuantity) {
    value = `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ""}`.trim();
  } else if (observation.valueString) {
    value = observation.valueString;
  } else if (observation.valueCodeableConcept) {
    value = observation.valueCodeableConcept.text || 
            observation.valueCodeableConcept.coding?.[0]?.display || "";
  }
  
  return {
    patientId,
    ehrConnectionId: connection.id,
    type: "lab_result",
    title,
    description: value ? `Result: ${value}` : title,
    date: observation.effectiveDateTime || observation.issued || new Date().toISOString(),
    provider: observation.performer?.[0]?.display || "Unknown Provider",
    facility: connection.facilityName,
    status: "active",
  };
}

export function mapFhirMedicationRequest(
  medRequest: FhirMedicationRequest,
  patientId: string,
  connection: EhrConnection
): InsertMedication {
  const name = medRequest.medicationCodeableConcept?.text ||
    medRequest.medicationCodeableConcept?.coding?.[0]?.display ||
    medRequest.medicationReference?.display ||
    "Unknown Medication";
  
  const dosage = medRequest.dosageInstruction?.[0];
  const doseText = dosage?.text || "";
  const doseValue = dosage?.doseAndRate?.[0]?.doseQuantity;
  const dosageStr = doseText || (doseValue ? `${doseValue.value} ${doseValue.unit}` : "");
  
  const timing = dosage?.timing?.repeat;
  const frequency = timing 
    ? `${timing.frequency} times per ${timing.period} ${timing.periodUnit}`
    : "";
  
  const statusMap: Record<string, InsertMedication["status"]> = {
    active: "active",
    completed: "discontinued",
    stopped: "discontinued",
    "on-hold": "on_hold",
    cancelled: "discontinued",
    entered_in_error: "discontinued",
    draft: "active",
    unknown: "active",
  };
  
  return {
    patientId,
    ehrConnectionId: connection.id,
    name,
    dosage: dosageStr,
    frequency,
    prescribedBy: medRequest.requester?.display || "Unknown Provider",
    startDate: medRequest.authoredOn || new Date().toISOString(),
    status: statusMap[medRequest.status || "unknown"] || "active",
    refillsRemaining: medRequest.dispenseRequest?.numberOfRepeatsAllowed || 0,
  };
}

export function mapFhirImmunizationToTimelineEvent(
  immunization: FhirImmunization,
  patientId: string,
  connection: EhrConnection
): TimelineEvent {
  const title = immunization.vaccineCode?.text ||
    immunization.vaccineCode?.coding?.[0]?.display ||
    "Immunization";
  
  return {
    id: `${connection.id}-imm-${immunization.id}`,
    patientId,
    type: "immunization",
    title,
    description: `${title} administered`,
    date: immunization.occurrenceDateTime || new Date().toISOString(),
    provider: immunization.performer?.[0]?.actor?.display || "Unknown Provider",
    facility: immunization.location?.display || connection.facilityName,
    ehrConnectionId: connection.id,
    sourceRecordId: immunization.id || "",
    sourceRecordType: "Immunization",
    isPrimary: true,
  };
}

export function mapFhirDocumentReference(
  docRef: FhirDocumentReference,
  patientId: string,
  connection: EhrConnection
): Document {
  const content = docRef.content?.[0]?.attachment;
  const title = content?.title || docRef.description || 
    docRef.type?.text || docRef.type?.coding?.[0]?.display || "Document";
  
  const typeCode = docRef.type?.coding?.[0]?.code;
  const documentTypeMap: Record<string, Document["type"]> = {
    "34133-9": "ccd",
    "11488-4": "clinical_note",
    "18842-5": "discharge_summary",
    "11502-2": "lab_report",
    "18748-4": "imaging_report",
  };
  const documentType = typeCode ? documentTypeMap[typeCode] : "pdf";
  
  return {
    id: `${connection.id}-doc-${docRef.id}`,
    patientId,
    ehrConnectionId: connection.id,
    type: documentType || "pdf",
    title,
    description: docRef.description || title,
    date: docRef.date || new Date().toISOString(),
    provider: docRef.author?.[0]?.display || "Unknown Provider",
    facility: connection.facilityName,
    fileUrl: content?.url,
    mimeType: content?.contentType || "application/pdf",
  };
}

export function mapFhirAllergyIntolerance(
  allergy: FhirAllergyIntolerance,
  patientId: string,
  connection: EhrConnection
): InsertMedicalRecord {
  const title = allergy.code?.text ||
    allergy.code?.coding?.[0]?.display ||
    "Unknown Allergy";

  const reactions = allergy.reaction
    ?.map((r) => {
      const manifestations = r.manifestation
        ?.map((m) => m.text || m.coding?.[0]?.display)
        .filter(Boolean)
        .join(", ");
      const severity = r.severity ? ` (${r.severity})` : "";
      return manifestations ? `${manifestations}${severity}` : null;
    })
    .filter(Boolean)
    .join("; ");

  const criticality = allergy.criticality ? ` [${allergy.criticality}]` : "";
  const category = allergy.category?.join(", ") || "";
  const description = [
    `Allergy: ${title}`,
    category ? `Category: ${category}` : "",
    criticality ? `Criticality: ${allergy.criticality}` : "",
    reactions ? `Reactions: ${reactions}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const clinicalStatus = allergy.clinicalStatus?.coding?.[0]?.code || "active";

  return {
    patientId,
    ehrConnectionId: connection.id,
    type: "diagnosis",
    title: `Allergy: ${title}`,
    description,
    date: allergy.recordedDate || allergy.onsetDateTime || new Date().toISOString(),
    provider: allergy.recorder?.display || "Unknown Provider",
    facility: connection.facilityName,
    status: clinicalStatus === "resolved" || clinicalStatus === "inactive" ? "resolved" : "active",
  };
}

export function mapFhirProcedure(
  procedure: FhirProcedure,
  patientId: string,
  connection: EhrConnection
): InsertMedicalRecord {
  const title = procedure.code?.text ||
    procedure.code?.coding?.[0]?.display ||
    "Unknown Procedure";

  const reason = procedure.reasonCode
    ?.map((r) => r.text || r.coding?.[0]?.display)
    .filter(Boolean)
    .join(", ");

  const performer = procedure.performer
    ?.map((p) => p.actor?.display)
    .filter(Boolean)
    .join(", ");

  const description = [
    `Procedure: ${title}`,
    reason ? `Reason: ${reason}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const date =
    procedure.performedDateTime ||
    procedure.performedPeriod?.start ||
    new Date().toISOString();

  return {
    patientId,
    ehrConnectionId: connection.id,
    type: "procedure",
    title,
    description,
    date,
    provider: performer || "Unknown Provider",
    facility: procedure.location?.display || connection.facilityName,
    status: procedure.status === "completed" ? "resolved" : "active",
  };
}

export function mapFhirEncounterToRecord(
  encounter: FhirEncounter,
  patientId: string,
  connection: EhrConnection
): InsertMedicalRecord {
  const typeDisplay = encounter.type?.[0]?.text ||
    encounter.type?.[0]?.coding?.[0]?.display ||
    "Visit";

  const reason = encounter.reasonCode
    ?.map((r) => r.text || r.coding?.[0]?.display)
    .filter(Boolean)
    .join(", ");

  const classDisplay = encounter.class?.display || encounter.class?.code || "";
  const location = encounter.location?.[0]?.location?.display || "";
  const participant = encounter.participant
    ?.map((p) => p.individual?.display)
    .filter(Boolean)
    .join(", ");

  const description = [
    classDisplay ? `Type: ${classDisplay}` : "",
    reason ? `Reason: ${reason}` : "",
    location ? `Location: ${location}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    patientId,
    ehrConnectionId: connection.id,
    type: "note",
    title: typeDisplay,
    description: description || typeDisplay,
    date: encounter.period?.start || new Date().toISOString(),
    provider: participant || "Unknown Provider",
    facility: location || connection.facilityName,
    status: encounter.status === "finished" ? "resolved" : "active",
  };
}

export function conditionToTimelineEvent(
  record: MedicalRecord,
  connection: EhrConnection
): TimelineEvent {
  return {
    id: `${connection.id}-cond-${record.id}`,
    patientId: record.patientId,
    type: "diagnosis",
    title: record.title,
    description: record.description,
    date: record.date,
    provider: record.provider,
    facility: record.facility,
    ehrConnectionId: connection.id,
    sourceRecordId: record.id,
    sourceRecordType: "Condition",
    isPrimary: true,
  };
}

export function medicationToTimelineEvent(
  medication: Medication,
  connection: EhrConnection
): TimelineEvent {
  return {
    id: `${connection.id}-med-${medication.id}`,
    patientId: medication.patientId,
    type: "medication",
    title: medication.name,
    description: `${medication.dosage} ${medication.frequency}`.trim(),
    date: medication.startDate,
    provider: medication.prescribedBy,
    facility: connection.facilityName,
    ehrConnectionId: connection.id,
    sourceRecordId: medication.id,
    sourceRecordType: "MedicationRequest",
    isPrimary: true,
  };
}
