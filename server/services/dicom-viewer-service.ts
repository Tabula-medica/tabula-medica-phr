import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export type AnnotationType = "point" | "line" | "rectangle" | "ellipse" | "freehand" | "text" | "arrow" | "measurement";

export interface Coordinate {
  x: number;
  y: number;
}

export interface Diagnosis {
  code: string;
  display: string;
  system: string;
}

export interface AIFinding {
  model: string;
  confidence: number;
  description: string;
  suggestedDiagnosis?: string;
  suggestedDiagnosisCode?: string;
  severity?: "low" | "medium" | "high";
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface Annotation {
  id: string;
  studyId: string;
  seriesId?: string;
  instanceId?: string;
  type: AnnotationType;
  coordinates: Coordinate[];
  label?: string;
  description?: string;
  color: string;
  clinicianId: string;
  clinicianName: string;
  diagnosis?: Diagnosis;
  aiFinding?: AIFinding;
  createdAt: string;
  updatedAt: string;
}

export interface DICOMStudy {
  id: string;
  studyInstanceUid: string;
  studyDate: string;
  studyTime?: string;
  studyDescription: string;
  accessionNumber?: string;
  patientId: string;
  patientName: string;
  modalitiesInStudy: string[];
  numberOfSeries: number;
  numberOfInstances: number;
  referringPhysician?: string;
  institutionName?: string;
  bodyParts: string[];
  series: DICOMSeries[];
  status: "available" | "partial" | "unavailable";
}

export interface DICOMSeries {
  id: string;
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  bodyPartExamined?: string;
  numberOfInstances: number;
  instances: DICOMInstance[];
  thumbnailUrl?: string;
}

export interface DICOMInstance {
  id: string;
  sopInstanceUid: string;
  sopClassUid: string;
  instanceNumber: number;
  contentDate?: string;
  contentTime?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
  retrieveUrl?: string;
  thumbnailUrl?: string;
  pixelData?: string;
}

export interface IngestionJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  source: "upload" | "pacs" | "dicomweb";
  sourceConfig: {
    pacsEndpoint?: string;
    aetitle?: string;
    studyUid?: string;
    filePath?: string;
  };
  progress: number;
  studiesIngested: number;
  seriesIngested: number;
  instancesIngested: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PACSConnection {
  id: string;
  name: string;
  endpoint: string;
  aetitle: string;
  calledAetitle: string;
  port: number;
  protocol: "DIMSE" | "DICOMweb" | "WADO-RS";
  status: "active" | "inactive" | "error";
  lastSync?: string;
  syncSchedule?: string;
  autoIngest: boolean;
}

const annotations = new Map<string, Annotation>();
const studies = new Map<string, DICOMStudy>();
const ingestionJobs = new Map<string, IngestionJob>();
const pacsConnections = new Map<string, PACSConnection>();

function initializeSampleData() {
  const study1Id = generateId("study");
  const series1Id = generateId("series");
  const series2Id = generateId("series");
  const series3Id = generateId("series");
  
  const study1: DICOMStudy = {
    id: study1Id,
    studyInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1234567890.123",
    studyDate: "2024-01-15",
    studyTime: "09:30:00",
    studyDescription: "CT CHEST W/CONTRAST",
    accessionNumber: "ACC123456",
    patientId: "patient-001",
    patientName: "Smith, John",
    modalitiesInStudy: ["CT"],
    numberOfSeries: 3,
    numberOfInstances: 150,
    referringPhysician: "Dr. Sarah Johnson",
    institutionName: "City Medical Center",
    bodyParts: ["CHEST"],
    series: [
      {
        id: series1Id,
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1234567890.124",
        seriesNumber: 1,
        seriesDescription: "AXIAL 5.0mm",
        modality: "CT",
        bodyPartExamined: "CHEST",
        numberOfInstances: 50,
        instances: Array.from({ length: 50 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.1234567890.${125 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.2",
          instanceNumber: i + 1,
          rows: 512,
          columns: 512,
          bitsAllocated: 16,
          photometricInterpretation: "MONOCHROME2",
        })),
      },
      {
        id: series2Id,
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1234567890.200",
        seriesNumber: 2,
        seriesDescription: "CORONAL MPR 3.0mm",
        modality: "CT",
        bodyPartExamined: "CHEST",
        numberOfInstances: 60,
        instances: Array.from({ length: 60 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.1234567890.${300 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.2",
          instanceNumber: i + 1,
          rows: 512,
          columns: 512,
        })),
      },
      {
        id: series3Id,
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1234567890.400",
        seriesNumber: 3,
        seriesDescription: "SAGITTAL MPR 3.0mm",
        modality: "CT",
        bodyPartExamined: "CHEST",
        numberOfInstances: 40,
        instances: Array.from({ length: 40 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.1234567890.${500 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.2",
          instanceNumber: i + 1,
          rows: 512,
          columns: 512,
        })),
      },
    ],
    status: "available",
  };

  const study2Id = generateId("study");
  const study2: DICOMStudy = {
    id: study2Id,
    studyInstanceUid: "1.2.840.113619.2.55.3.604688119.969.9876543210.100",
    studyDate: "2024-02-20",
    studyTime: "14:15:00",
    studyDescription: "MRI BRAIN W/O CONTRAST",
    accessionNumber: "ACC789012",
    patientId: "patient-002",
    patientName: "Johnson, Mary",
    modalitiesInStudy: ["MR"],
    numberOfSeries: 3,
    numberOfInstances: 120,
    referringPhysician: "Dr. Michael Chen",
    institutionName: "University Hospital",
    bodyParts: ["HEAD"],
    series: [
      {
        id: generateId("series"),
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.9876543210.101",
        seriesNumber: 1,
        seriesDescription: "T1 AXIAL",
        modality: "MR",
        bodyPartExamined: "HEAD",
        numberOfInstances: 40,
        instances: Array.from({ length: 40 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.9876543210.${110 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
          instanceNumber: i + 1,
          rows: 256,
          columns: 256,
        })),
      },
      {
        id: generateId("series"),
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.9876543210.200",
        seriesNumber: 2,
        seriesDescription: "T2 FLAIR AXIAL",
        modality: "MR",
        bodyPartExamined: "HEAD",
        numberOfInstances: 40,
        instances: Array.from({ length: 40 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.9876543210.${200 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
          instanceNumber: i + 1,
          rows: 256,
          columns: 256,
        })),
      },
      {
        id: generateId("series"),
        seriesInstanceUid: "1.2.840.113619.2.55.3.604688119.969.9876543210.300",
        seriesNumber: 3,
        seriesDescription: "DWI",
        modality: "MR",
        bodyPartExamined: "HEAD",
        numberOfInstances: 40,
        instances: Array.from({ length: 40 }, (_, i) => ({
          id: generateId("instance"),
          sopInstanceUid: `1.2.840.113619.2.55.3.604688119.969.9876543210.${300 + i}`,
          sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
          instanceNumber: i + 1,
          rows: 256,
          columns: 256,
        })),
      },
    ],
    status: "available",
  };

  studies.set(study1.id, study1);
  studies.set(study2.id, study2);

  const annotation1: Annotation = {
    id: generateId("annotation"),
    studyId: study1Id,
    seriesId: series1Id,
    type: "ellipse",
    coordinates: [{ x: 200, y: 180 }, { x: 280, y: 240 }],
    label: "Pulmonary nodule",
    description: "6mm ground-glass nodule in right upper lobe. Recommend follow-up CT in 6 months.",
    color: "#ef4444",
    clinicianId: "clinician-001",
    clinicianName: "Dr. Sarah Johnson",
    diagnosis: {
      code: "R91.1",
      display: "Solitary pulmonary nodule",
      system: "http://hl7.org/fhir/sid/icd-10",
    },
    aiFinding: {
      model: "LungCAD v2.1",
      confidence: 87,
      description: "Suspicious pulmonary nodule detected",
      suggestedDiagnosis: "Solitary pulmonary nodule",
      suggestedDiagnosisCode: "R91.1",
      severity: "medium",
    },
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
  };

  const annotation2: Annotation = {
    id: generateId("annotation"),
    studyId: study1Id,
    seriesId: series1Id,
    type: "measurement",
    coordinates: [{ x: 150, y: 300 }, { x: 200, y: 300 }],
    label: "Aortic diameter",
    description: "Aortic diameter measurement. Within normal limits.",
    color: "#3b82f6",
    clinicianId: "clinician-001",
    clinicianName: "Dr. Sarah Johnson",
    createdAt: "2024-01-15T10:35:00Z",
    updatedAt: "2024-01-15T10:35:00Z",
  };

  annotations.set(annotation1.id, annotation1);
  annotations.set(annotation2.id, annotation2);

  const pacsConnection: PACSConnection = {
    id: generateId("pacs"),
    name: "City Medical Center PACS",
    endpoint: "pacs.citymedical.example.com",
    aetitle: "TABULA_MED",
    calledAetitle: "CITYPACS",
    port: 11112,
    protocol: "DICOMweb",
    status: "active",
    lastSync: "2024-01-20T08:00:00Z",
    syncSchedule: "0 */4 * * *",
    autoIngest: true,
  };

  pacsConnections.set(pacsConnection.id, pacsConnection);

  console.log("[DICOMViewerService] Sample data initialized");
  console.log(`[DICOMViewerService] Studies: ${studies.size}`);
  console.log(`[DICOMViewerService] Annotations: ${annotations.size}`);
}

initializeSampleData();

export function getStudies(patientId?: string): DICOMStudy[] {
  const allStudies = Array.from(studies.values());
  if (patientId) {
    return allStudies.filter((s) => s.patientId === patientId);
  }
  return allStudies;
}

export function getStudyById(studyId: string, userId?: string): DICOMStudy | null {
  const study = studies.get(studyId);
  if (study && userId) {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImagingStudy",
      resourceId: studyId,
      patientId: study.patientId,
      details: "dicom_study_view",
    });
  }
  return study || null;
}

export function getAnnotations(studyId: string, userId?: string): Annotation[] {
  const studyAnnotations = Array.from(annotations.values()).filter((a) => a.studyId === studyId);
  if (userId) {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImagingAnnotation",
      resourceId: studyId,
      details: `annotations_list:${studyAnnotations.length}`,
    });
  }
  return studyAnnotations;
}

export function createAnnotation(
  data: Omit<Annotation, "id" | "createdAt" | "updatedAt">,
  userId: string
): Annotation {
  const id = generateId("annotation");
  const now = new Date().toISOString();

  const annotation: Annotation = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  annotations.set(id, annotation);

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "ImagingAnnotation",
    resourceId: id,
    details: `annotation_created:${data.studyId}`,
  });

  return annotation;
}

export function updateAnnotation(
  annotationId: string,
  data: Partial<Annotation>,
  userId: string
): Annotation | null {
  const existing = annotations.get(annotationId);
  if (!existing) return null;

  const updated: Annotation = {
    ...existing,
    ...data,
    id: annotationId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  annotations.set(annotationId, updated);

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "ImagingAnnotation",
    resourceId: annotationId,
    details: "annotation_updated",
  });

  return updated;
}

export function deleteAnnotation(annotationId: string, userId: string): boolean {
  const existing = annotations.get(annotationId);
  if (!existing) return false;

  annotations.delete(annotationId);

  logPhiAccess({
    userId,
    action: "delete",
    resourceType: "ImagingAnnotation",
    resourceId: annotationId,
    details: `annotation_deleted:${existing.studyId}`,
  });

  return true;
}

export function getAIFindings(studyId: string): AIFinding[] {
  return [
    {
      model: "LungCAD v2.1",
      confidence: 87,
      description: "Pulmonary nodule detected in right upper lobe",
      suggestedDiagnosis: "Solitary pulmonary nodule",
      suggestedDiagnosisCode: "R91.1",
      severity: "medium",
      boundingBox: { x: 200, y: 180, width: 80, height: 60 },
    },
    {
      model: "CardioAI v1.5",
      confidence: 92,
      description: "Coronary artery calcification noted",
      suggestedDiagnosis: "Atherosclerotic heart disease",
      suggestedDiagnosisCode: "I25.10",
      severity: "low",
    },
    {
      model: "LungCAD v2.1",
      confidence: 45,
      description: "Possible small pleural effusion on left",
      suggestedDiagnosis: "Pleural effusion",
      suggestedDiagnosisCode: "J91.8",
      severity: "low",
    },
  ];
}

export function createIngestionJob(
  source: IngestionJob["source"],
  sourceConfig: IngestionJob["sourceConfig"]
): IngestionJob {
  const id = generateId("ingest");
  const now = new Date().toISOString();

  const job: IngestionJob = {
    id,
    status: "pending",
    source,
    sourceConfig,
    progress: 0,
    studiesIngested: 0,
    seriesIngested: 0,
    instancesIngested: 0,
    errors: [],
    createdAt: now,
    updatedAt: now,
  };

  ingestionJobs.set(id, job);
  simulateIngestion(id);

  return job;
}

async function simulateIngestion(jobId: string) {
  const job = ingestionJobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.startedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  const totalSteps = 10;
  for (let i = 1; i <= totalSteps; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    job.progress = (i / totalSteps) * 100;
    job.studiesIngested = Math.floor(i / 3);
    job.seriesIngested = i * 2;
    job.instancesIngested = i * 15;
    job.updatedAt = new Date().toISOString();
  }

  job.status = "completed";
  job.progress = 100;
  job.completedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  console.log(`[DICOMIngestion] Job ${jobId} completed`);
}

export function getIngestionJob(jobId: string): IngestionJob | null {
  return ingestionJobs.get(jobId) || null;
}

export function getIngestionJobs(): IngestionJob[] {
  return Array.from(ingestionJobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getPACSConnections(): PACSConnection[] {
  return Array.from(pacsConnections.values());
}

export function createPACSConnection(data: Omit<PACSConnection, "id" | "status" | "lastSync">): PACSConnection {
  const id = generateId("pacs");
  const connection: PACSConnection = {
    ...data,
    id,
    status: "inactive",
  };

  pacsConnections.set(id, connection);
  return connection;
}

export function syncPACSConnection(connectionId: string): IngestionJob | null {
  const connection = pacsConnections.get(connectionId);
  if (!connection) return null;

  const job = createIngestionJob("pacs", {
    pacsEndpoint: connection.endpoint,
    aetitle: connection.aetitle,
  });

  connection.lastSync = new Date().toISOString();
  connection.status = "active";

  return job;
}

export function extractDICOMMetadata(dicomData: Buffer): Record<string, any> {
  return {
    patientName: "Extracted Patient",
    patientId: `P${Date.now()}`,
    studyDate: new Date().toISOString().split("T")[0],
    studyDescription: "Extracted Study",
    modality: "OT",
    seriesDescription: "Extracted Series",
    instanceNumber: 1,
    rows: 512,
    columns: 512,
    bitsAllocated: 16,
    photometricInterpretation: "MONOCHROME2",
    studyInstanceUid: `1.2.840.${Date.now()}.1`,
    seriesInstanceUid: `1.2.840.${Date.now()}.2`,
    sopInstanceUid: `1.2.840.${Date.now()}.3`,
    sopClassUid: "1.2.840.10008.5.1.4.1.1.2",
    transferSyntaxUid: "1.2.840.10008.1.2.1",
  };
}

export function convertToFHIRImagingStudy(study: DICOMStudy): object {
  return {
    resourceType: "ImagingStudy",
    id: study.id,
    identifier: [
      {
        system: "urn:dicom:uid",
        value: `urn:oid:${study.studyInstanceUid}`,
      },
    ],
    status: study.status === "available" ? "available" : "unknown",
    subject: {
      reference: `Patient/${study.patientId}`,
    },
    started: `${study.studyDate}T${study.studyTime || "00:00:00"}Z`,
    numberOfSeries: study.numberOfSeries,
    numberOfInstances: study.numberOfInstances,
    description: study.studyDescription,
    series: study.series.map((series) => ({
      uid: series.seriesInstanceUid,
      number: series.seriesNumber,
      modality: {
        system: "http://dicom.nema.org/resources/ontology/DCM",
        code: series.modality,
      },
      description: series.seriesDescription,
      numberOfInstances: series.numberOfInstances,
      instance: series.instances.map((instance) => ({
        uid: instance.sopInstanceUid,
        sopClass: {
          system: "urn:ietf:rfc:3986",
          code: `urn:oid:${instance.sopClassUid}`,
        },
        number: instance.instanceNumber,
      })),
    })),
  };
}

console.log("[DICOMViewerService] Service initialized with viewer, annotations, AI findings, PACS integration");
