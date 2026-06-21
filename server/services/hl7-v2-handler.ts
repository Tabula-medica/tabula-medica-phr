import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";
import { getAuditLogger } from "./integrations/factory";

export type HL7MessageType = 
  | "ADT" | "ORM" | "ORU" | "RDE" | "RDS" | "DFT" | "MDM" | "SIU" | "BAR" | "ACK";

export type HL7EventType =
  | "A01" | "A02" | "A03" | "A04" | "A08" | "A28" | "A31" | "A40"
  | "O01" | "R01" | "O11" | "O13" | "P03" | "T02" | "S12" | "P01";

export interface HL7Message {
  id: string;
  rawMessage: string;
  messageType: HL7MessageType;
  eventType: HL7EventType;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
  version: string;
  segments: HL7Segment[];
  parsedData: Record<string, unknown>;
  status: "received" | "parsed" | "validated" | "processed" | "error" | "acknowledged";
  errorMessage?: string;
  receivedAt: string;
  processedAt?: string;
}

export interface HL7Segment {
  id: string;
  name: string;
  fields: HL7Field[];
  rawValue: string;
}

export interface HL7Field {
  index: number;
  value: string;
  components: string[];
  repeats: string[];
}

export interface HL7ParseResult {
  success: boolean;
  message?: HL7Message;
  errors: string[];
  warnings: string[];
}

export interface FHIRConversionResult {
  success: boolean;
  resourceType: string;
  resource?: Record<string, unknown>;
  errors: string[];
}

const receivedMessages: Map<string, HL7Message> = new Map();
const messageTypeHandlers: Map<string, (msg: HL7Message) => Promise<FHIRConversionResult[]>> = new Map();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logHL7Activity(
  action: string,
  messageId: string,
  userId: string,
  details: Record<string, unknown>,
  ipAddress: string = "internal"
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashIdentifier(userId),
      userRole: "system",
      action: "create" as const,
      resourceType: "HL7Message",
      resourceId: messageId,
      patientId: hashIdentifier("system"),
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "hl7-handler",
      requestPath: "/api/hl7",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        hl7Action: action,
        messageIdHash: hashIdentifier(messageId),
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[HL7Handler] Audit logging failed:", e);
  }
}

export function parseHL7Message(rawMessage: string): HL7ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!rawMessage || rawMessage.trim().length === 0) {
    return { success: false, errors: ["Empty message"], warnings: [] };
  }
  
  const lines = rawMessage.split(/\r?\n/).filter((l) => l.trim().length > 0);
  
  if (lines.length === 0) {
    return { success: false, errors: ["No segments found"], warnings: [] };
  }
  
  const mshLine = lines.find((l) => l.startsWith("MSH"));
  if (!mshLine) {
    return { success: false, errors: ["Missing MSH segment"], warnings: [] };
  }
  
  const fieldSeparator = mshLine.charAt(3) || "|";
  const componentSeparator = mshLine.charAt(4) || "^";
  const repetitionSeparator = mshLine.charAt(5) || "~";
  
  const segments: HL7Segment[] = [];
  
  for (const line of lines) {
    const segmentName = line.substring(0, 3);
    const fieldsRaw = line.split(fieldSeparator);
    
    const fields: HL7Field[] = fieldsRaw.slice(1).map((value, index) => ({
      index: index + 1,
      value,
      components: value.split(componentSeparator),
      repeats: value.split(repetitionSeparator),
    }));
    
    segments.push({
      id: randomUUID(),
      name: segmentName,
      fields,
      rawValue: line,
    });
  }
  
  const mshSegment = segments.find((s) => s.name === "MSH");
  if (!mshSegment || mshSegment.fields.length < 11) {
    return { success: false, errors: ["Invalid MSH segment structure"], warnings: [] };
  }
  
  const messageTypeField = mshSegment.fields[7]?.value || "";
  const [msgType, eventType] = messageTypeField.split(componentSeparator);
  
  const message: HL7Message = {
    id: randomUUID(),
    rawMessage,
    messageType: (msgType as HL7MessageType) || "ADT",
    eventType: (eventType as HL7EventType) || "A01",
    messageControlId: mshSegment.fields[8]?.value || randomUUID(),
    sendingApplication: mshSegment.fields[1]?.value || "",
    sendingFacility: mshSegment.fields[2]?.value || "",
    receivingApplication: mshSegment.fields[3]?.value || "",
    receivingFacility: mshSegment.fields[4]?.value || "",
    dateTime: mshSegment.fields[5]?.value || new Date().toISOString(),
    version: mshSegment.fields[10]?.value || "2.5.1",
    segments,
    parsedData: extractParsedData(segments),
    status: "parsed",
    receivedAt: new Date().toISOString(),
  };
  
  receivedMessages.set(message.id, message);
  
  return { success: true, message, errors, warnings };
}

function extractParsedData(segments: HL7Segment[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  
  const pid = segments.find((s) => s.name === "PID");
  if (pid) {
    data.patient = {
      id: pid.fields[2]?.components[0] || pid.fields[1]?.value,
      familyName: pid.fields[4]?.components[0],
      givenName: pid.fields[4]?.components[1],
      dateOfBirth: pid.fields[6]?.value,
      gender: pid.fields[7]?.value,
      address: {
        street: pid.fields[10]?.components[0],
        city: pid.fields[10]?.components[2],
        state: pid.fields[10]?.components[3],
        postalCode: pid.fields[10]?.components[4],
      },
      phone: pid.fields[12]?.value,
    };
  }
  
  const pv1 = segments.find((s) => s.name === "PV1");
  if (pv1) {
    data.visit = {
      class: pv1.fields[1]?.value,
      location: pv1.fields[2]?.value,
      attendingDoctor: pv1.fields[6]?.components[0],
      admitDateTime: pv1.fields[43]?.value,
      dischargeDateTime: pv1.fields[44]?.value,
    };
  }
  
  const obxSegments = segments.filter((s) => s.name === "OBX");
  if (obxSegments.length > 0) {
    data.observations = obxSegments.map((obx) => ({
      setId: obx.fields[0]?.value,
      valueType: obx.fields[1]?.value,
      identifier: {
        code: obx.fields[2]?.components[0],
        text: obx.fields[2]?.components[1],
        system: obx.fields[2]?.components[2],
      },
      value: obx.fields[4]?.value,
      units: obx.fields[5]?.value,
      referenceRange: obx.fields[6]?.value,
      abnormalFlags: obx.fields[7]?.value,
      status: obx.fields[10]?.value,
      dateTime: obx.fields[13]?.value,
    }));
  }
  
  const obrSegments = segments.filter((s) => s.name === "OBR");
  if (obrSegments.length > 0) {
    data.orders = obrSegments.map((obr) => ({
      setId: obr.fields[0]?.value,
      placerOrderNumber: obr.fields[1]?.value,
      fillerOrderNumber: obr.fields[2]?.value,
      universalServiceId: {
        code: obr.fields[3]?.components[0],
        text: obr.fields[3]?.components[1],
        system: obr.fields[3]?.components[2],
      },
      requestedDateTime: obr.fields[5]?.value,
      observationDateTime: obr.fields[6]?.value,
      orderingProvider: obr.fields[15]?.components[0],
      resultStatus: obr.fields[24]?.value,
    }));
  }
  
  return data;
}

export function convertToFHIR(message: HL7Message): FHIRConversionResult[] {
  const results: FHIRConversionResult[] = [];
  
  const patientData = message.parsedData.patient as Record<string, unknown> | undefined;
  if (patientData) {
    results.push({
      success: true,
      resourceType: "Patient",
      resource: {
        resourceType: "Patient",
        id: patientData.id || randomUUID(),
        identifier: [
          {
            system: "urn:oid:2.16.840.1.113883.4.1",
            value: patientData.id,
          },
        ],
        name: [
          {
            family: patientData.familyName,
            given: [patientData.givenName],
          },
        ],
        gender: mapHL7GenderToFHIR(patientData.gender as string),
        birthDate: formatHL7DateToFHIR(patientData.dateOfBirth as string),
        telecom: patientData.phone ? [
          {
            system: "phone",
            value: patientData.phone,
          },
        ] : undefined,
        address: patientData.address ? [
          {
            line: [(patientData.address as any).street],
            city: (patientData.address as any).city,
            state: (patientData.address as any).state,
            postalCode: (patientData.address as any).postalCode,
          },
        ] : undefined,
      },
      errors: [],
    });
  }
  
  const observations = message.parsedData.observations as Array<Record<string, unknown>> | undefined;
  if (observations) {
    for (const obs of observations) {
      const identifier = obs.identifier as Record<string, unknown> | undefined;
      results.push({
        success: true,
        resourceType: "Observation",
        resource: {
          resourceType: "Observation",
          id: randomUUID(),
          status: mapHL7StatusToFHIR(obs.status as string),
          code: {
            coding: [
              {
                system: mapCodeSystem(identifier?.system as string),
                code: identifier?.code,
                display: identifier?.text,
              },
            ],
          },
          valueQuantity: obs.units ? {
            value: parseFloat(obs.value as string) || 0,
            unit: obs.units,
          } : undefined,
          valueString: !obs.units ? obs.value : undefined,
          referenceRange: obs.referenceRange ? [
            {
              text: obs.referenceRange,
            },
          ] : undefined,
          interpretation: obs.abnormalFlags ? [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: obs.abnormalFlags,
                },
              ],
            },
          ] : undefined,
          effectiveDateTime: formatHL7DateToFHIR(obs.dateTime as string),
        },
        errors: [],
      });
    }
  }
  
  return results;
}

function mapHL7GenderToFHIR(hl7Gender: string): string {
  const map: Record<string, string> = {
    "M": "male",
    "F": "female",
    "O": "other",
    "U": "unknown",
  };
  return map[hl7Gender?.toUpperCase()] || "unknown";
}

function mapHL7StatusToFHIR(hl7Status: string): string {
  const map: Record<string, string> = {
    "F": "final",
    "P": "preliminary",
    "C": "corrected",
    "X": "cancelled",
    "I": "registered",
  };
  return map[hl7Status?.toUpperCase()] || "unknown";
}

function mapCodeSystem(hl7System: string): string {
  const map: Record<string, string> = {
    "LN": "http://loinc.org",
    "LOINC": "http://loinc.org",
    "SCT": "http://snomed.info/sct",
    "SNOMED": "http://snomed.info/sct",
    "I10": "http://hl7.org/fhir/sid/icd-10",
    "ICD10": "http://hl7.org/fhir/sid/icd-10",
    "RXN": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "RXNORM": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "CPT": "http://www.ama-assn.org/go/cpt",
  };
  return map[hl7System?.toUpperCase()] || `urn:oid:${hl7System || "unknown"}`;
}

function formatHL7DateToFHIR(hl7Date: string): string | undefined {
  if (!hl7Date || hl7Date.length < 8) return undefined;
  
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  
  if (hl7Date.length >= 12) {
    const hour = hl7Date.substring(8, 10);
    const minute = hl7Date.substring(10, 12);
    const second = hl7Date.length >= 14 ? hl7Date.substring(12, 14) : "00";
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  
  return `${year}-${month}-${day}`;
}

export function generateACK(originalMessage: HL7Message, success: boolean, errorMessage?: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
  const messageControlId = randomUUID().substring(0, 20);
  
  const ackCode = success ? "AA" : "AE";
  const textMessage = success ? "Message accepted" : (errorMessage || "Message rejected");
  
  const ack = [
    `MSH|^~\\&|TABULA_MEDICA|TABULA|${originalMessage.sendingApplication}|${originalMessage.sendingFacility}|${timestamp}||ACK^${originalMessage.eventType}|${messageControlId}|P|2.5.1`,
    `MSA|${ackCode}|${originalMessage.messageControlId}|${textMessage}`,
  ];
  
  if (!success && errorMessage) {
    ack.push(`ERR|||207|E|${errorMessage}`);
  }
  
  return ack.join("\r");
}

export async function processHL7Message(
  rawMessage: string,
  userId: string,
  ipAddress: string
): Promise<{
  success: boolean;
  message?: HL7Message;
  fhirResources: FHIRConversionResult[];
  ack: string;
  errors: string[];
}> {
  const parseResult = parseHL7Message(rawMessage);
  
  if (!parseResult.success || !parseResult.message) {
    return {
      success: false,
      fhirResources: [],
      ack: "",
      errors: parseResult.errors,
    };
  }
  
  const message = parseResult.message;
  
  await logHL7Activity("receive_message", message.id, userId, {
    messageType: message.messageType,
    eventType: message.eventType,
    sendingFacility: message.sendingFacility,
  }, ipAddress);
  
  const fhirResources = convertToFHIR(message);
  
  const allSuccess = fhirResources.every((r) => r.success);
  message.status = allSuccess ? "processed" : "error";
  message.processedAt = new Date().toISOString();
  receivedMessages.set(message.id, message);
  
  const ack = generateACK(message, allSuccess, allSuccess ? undefined : "Conversion errors occurred");
  
  await logHL7Activity("process_message", message.id, userId, {
    messageType: message.messageType,
    fhirResourcesCreated: fhirResources.filter((r) => r.success).length,
    success: allSuccess,
  }, ipAddress);
  
  return {
    success: allSuccess,
    message,
    fhirResources,
    ack,
    errors: fhirResources.flatMap((r) => r.errors),
  };
}

export function getReceivedMessages(limit: number = 100): HL7Message[] {
  return Array.from(receivedMessages.values())
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, limit);
}

export function getMessage(id: string): HL7Message | undefined {
  return receivedMessages.get(id);
}

export function getHL7Stats(): {
  totalReceived: number;
  processed: number;
  errors: number;
  byMessageType: Record<string, number>;
} {
  const messages = Array.from(receivedMessages.values());
  const byMessageType: Record<string, number> = {};
  
  for (const msg of messages) {
    byMessageType[msg.messageType] = (byMessageType[msg.messageType] || 0) + 1;
  }
  
  return {
    totalReceived: messages.length,
    processed: messages.filter((m) => m.status === "processed").length,
    errors: messages.filter((m) => m.status === "error").length,
    byMessageType,
  };
}

console.log("[HL7Handler] Service initialized");
