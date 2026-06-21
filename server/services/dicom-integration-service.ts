import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, resourceId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][DICOM-Integration] ${timestamp} - ${action} - User:${hashIdentifier(userId)} - Resource:${resourceId} - ${details}`);
}

export type DICOMConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type DICOMModality = "CT" | "MR" | "US" | "XR" | "CR" | "DX" | "MG" | "PT" | "NM" | "RF" | "SC" | "OT";
export type RetrievalMethod = "WADO-RS" | "WADO-URI" | "DIMSE" | "DICOMweb";

export interface DICOMConnection {
  id: string;
  userId: string;
  displayName: string;
  pacsEndpoint: string;
  wadoEndpoint?: string;
  aetitle: string;
  calledAetitle: string;
  port: number;
  status: DICOMConnectionStatus;
  supportedModalities: DICOMModality[];
  retrievalMethods: RetrievalMethod[];
  tlsEnabled: boolean;
  lastConnectionAt?: string;
  studiesAvailable: number;
  seriesAvailable: number;
  instancesAvailable: number;
  metadata: DICOMConnectionMetadata;
  auditLog: DICOMAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DICOMConnectionMetadata {
  facilityName?: string;
  facilityId?: string;
  vendorName?: string;
  vendorVersion?: string;
  patientId?: string;
  customHeaders?: Record<string, string>;
}

export interface DICOMAuditEntry {
  id: string;
  action: "connect" | "disconnect" | "query" | "retrieve" | "view" | "error";
  timestamp: string;
  details: string;
  studyUid?: string;
  seriesUid?: string;
  instanceUid?: string;
  ipAddress?: string;
}

export interface ImagingStudy {
  id: string;
  studyInstanceUid: string;
  studyDate: string;
  studyTime?: string;
  studyDescription: string;
  accessionNumber?: string;
  patientId: string;
  patientName: string;
  modalitiesInStudy: DICOMModality[];
  numberOfSeries: number;
  numberOfInstances: number;
  referringPhysician?: string;
  institutionName?: string;
  bodyParts: string[];
  procedureCodes: { code: string; display: string; system: string }[];
  series: ImagingSeries[];
  status: "available" | "partial" | "unavailable";
  fhirResource?: any;
}

export interface ImagingSeries {
  id: string;
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: DICOMModality;
  bodyPartExamined?: string;
  numberOfInstances: number;
  instances: ImagingInstance[];
  thumbnailUrl?: string;
}

export interface ImagingInstance {
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
}

export interface DICOMQueryParams {
  patientId?: string;
  patientName?: string;
  studyDate?: string;
  studyDateRange?: { from: string; to: string };
  modality?: DICOMModality;
  accessionNumber?: string;
  studyInstanceUid?: string;
  bodyPart?: string;
  studyDescription?: string;
  limit?: number;
  offset?: number;
}

export interface DICOMQueryResult {
  success: boolean;
  studies: ImagingStudy[];
  total: number;
  error?: string;
}

export interface DICOMRetrieveParams {
  connectionId: string;
  userId: string;
  studyInstanceUid: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
  format?: "dicom" | "jpeg" | "png";
  quality?: number;
  windowCenter?: number;
  windowWidth?: number;
  frame?: number;
}

export interface DICOMRetrieveResult {
  success: boolean;
  contentType?: string;
  data?: Buffer | string;
  url?: string;
  metadata?: Record<string, any>;
  error?: string;
}

const dicomConnections: Map<string, DICOMConnection> = new Map();
const studiesCache: Map<string, ImagingStudy[]> = new Map();

export function getSupportedModalities(): { modality: DICOMModality; name: string; description: string }[] {
  return [
    { modality: "CT", name: "Computed Tomography", description: "Cross-sectional X-ray imaging" },
    { modality: "MR", name: "Magnetic Resonance", description: "MRI scans using magnetic fields" },
    { modality: "US", name: "Ultrasound", description: "Sonographic imaging" },
    { modality: "XR", name: "X-Ray", description: "Plain radiograph imaging" },
    { modality: "CR", name: "Computed Radiography", description: "Digital X-ray imaging" },
    { modality: "DX", name: "Digital Radiography", description: "Direct digital X-ray" },
    { modality: "MG", name: "Mammography", description: "Breast imaging" },
    { modality: "PT", name: "PET Scan", description: "Positron emission tomography" },
    { modality: "NM", name: "Nuclear Medicine", description: "Radiotracer imaging" },
    { modality: "RF", name: "Fluoroscopy", description: "Real-time X-ray imaging" },
    { modality: "SC", name: "Secondary Capture", description: "Digitized non-DICOM images" },
    { modality: "OT", name: "Other", description: "Other modality types" },
  ];
}

export async function createConnection(
  userId: string,
  config: {
    displayName: string;
    pacsEndpoint: string;
    wadoEndpoint?: string;
    aetitle: string;
    calledAetitle: string;
    port?: number;
    supportedModalities?: DICOMModality[];
    retrievalMethods?: RetrievalMethod[];
    tlsEnabled?: boolean;
    metadata?: DICOMConnectionMetadata;
  }
): Promise<DICOMConnection> {
  const id = generateId("dicom");
  const now = new Date().toISOString();

  const connection: DICOMConnection = {
    id,
    userId,
    displayName: config.displayName,
    pacsEndpoint: config.pacsEndpoint,
    wadoEndpoint: config.wadoEndpoint,
    aetitle: config.aetitle,
    calledAetitle: config.calledAetitle,
    port: config.port || 11112,
    status: "connecting",
    supportedModalities: config.supportedModalities || ["CT", "MR", "XR", "US"],
    retrievalMethods: config.retrievalMethods || ["WADO-RS", "DICOMweb"],
    tlsEnabled: config.tlsEnabled ?? true,
    studiesAvailable: 0,
    seriesAvailable: 0,
    instancesAvailable: 0,
    metadata: config.metadata || {},
    auditLog: [
      {
        id: generateId("audit"),
        action: "connect",
        timestamp: now,
        details: `Initiated connection to ${config.displayName}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  dicomConnections.set(id, connection);

  await testConnection(id);

  logHipaaAudit("CREATE_CONNECTION", userId, id, `Created DICOM connection: ${config.displayName}`);

  return connection;
}

async function testConnection(connectionId: string): Promise<boolean> {
  const connection = dicomConnections.get(connectionId);
  if (!connection) return false;

  connection.status = "connected";
  connection.lastConnectionAt = new Date().toISOString();
  connection.studiesAvailable = Math.floor(Math.random() * 50) + 10;
  connection.seriesAvailable = connection.studiesAvailable * 3;
  connection.instancesAvailable = connection.seriesAvailable * 25;
  connection.updatedAt = new Date().toISOString();

  return true;
}

export function getConnection(connectionId: string): DICOMConnection | undefined {
  return dicomConnections.get(connectionId);
}

export function getUserConnections(userId: string): DICOMConnection[] {
  return Array.from(dicomConnections.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function queryStudies(
  connectionId: string,
  userId: string,
  params: DICOMQueryParams
): Promise<DICOMQueryResult> {
  const connection = dicomConnections.get(connectionId);
  if (!connection) {
    return { success: false, studies: [], total: 0, error: "Connection not found" };
  }

  if (connection.userId !== userId) {
    return { success: false, studies: [], total: 0, error: "Unauthorized" };
  }

  if (connection.status !== "connected") {
    return { success: false, studies: [], total: 0, error: `Connection not active: ${connection.status}` };
  }

  logHipaaAudit("QUERY_STUDIES", userId, connectionId, `Querying studies with params: ${JSON.stringify(params)}`);

  const studies = generateMockStudies(userId, params);

  studiesCache.set(`${connectionId}:${userId}`, studies);

  connection.auditLog.push({
    id: generateId("audit"),
    action: "query",
    timestamp: new Date().toISOString(),
    details: `Queried ${studies.length} studies`,
  });

  return {
    success: true,
    studies: studies.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20)),
    total: studies.length,
  };
}

function generateMockStudies(userId: string, params: DICOMQueryParams): ImagingStudy[] {
  const mockStudies: ImagingStudy[] = [
    {
      id: generateId("study"),
      studyInstanceUid: `1.2.840.10008.${Date.now()}.1`,
      studyDate: "2024-01-15",
      studyTime: "10:30:00",
      studyDescription: "CT Chest with Contrast",
      accessionNumber: "ACC-2024-001",
      patientId: `patient-${hashIdentifier(userId).slice(0, 8)}`,
      patientName: "Smith, John",
      modalitiesInStudy: ["CT"],
      numberOfSeries: 3,
      numberOfInstances: 256,
      referringPhysician: "Dr. Sarah Johnson",
      institutionName: "City Medical Center",
      bodyParts: ["CHEST"],
      procedureCodes: [{ code: "71260", display: "CT Thorax with Contrast", system: "CPT" }],
      series: [
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.1.1`,
          seriesNumber: 1,
          seriesDescription: "Axial Images",
          modality: "CT",
          bodyPartExamined: "CHEST",
          numberOfInstances: 128,
          instances: [],
        },
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.1.2`,
          seriesNumber: 2,
          seriesDescription: "Coronal Reconstruction",
          modality: "CT",
          bodyPartExamined: "CHEST",
          numberOfInstances: 64,
          instances: [],
        },
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.1.3`,
          seriesNumber: 3,
          seriesDescription: "Sagittal Reconstruction",
          modality: "CT",
          bodyPartExamined: "CHEST",
          numberOfInstances: 64,
          instances: [],
        },
      ],
      status: "available",
    },
    {
      id: generateId("study"),
      studyInstanceUid: `1.2.840.10008.${Date.now()}.2`,
      studyDate: "2024-01-10",
      studyTime: "14:15:00",
      studyDescription: "MRI Brain with and without Contrast",
      accessionNumber: "ACC-2024-002",
      patientId: `patient-${hashIdentifier(userId).slice(0, 8)}`,
      patientName: "Smith, John",
      modalitiesInStudy: ["MR"],
      numberOfSeries: 5,
      numberOfInstances: 180,
      referringPhysician: "Dr. Michael Chen",
      institutionName: "City Medical Center",
      bodyParts: ["HEAD", "BRAIN"],
      procedureCodes: [{ code: "70553", display: "MRI Brain w/wo Contrast", system: "CPT" }],
      series: [
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.2.1`,
          seriesNumber: 1,
          seriesDescription: "T1 Axial",
          modality: "MR",
          bodyPartExamined: "BRAIN",
          numberOfInstances: 36,
          instances: [],
        },
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.2.2`,
          seriesNumber: 2,
          seriesDescription: "T2 FLAIR",
          modality: "MR",
          bodyPartExamined: "BRAIN",
          numberOfInstances: 36,
          instances: [],
        },
      ],
      status: "available",
    },
    {
      id: generateId("study"),
      studyInstanceUid: `1.2.840.10008.${Date.now()}.3`,
      studyDate: "2023-12-20",
      studyTime: "09:00:00",
      studyDescription: "X-Ray Chest PA and Lateral",
      accessionNumber: "ACC-2023-045",
      patientId: `patient-${hashIdentifier(userId).slice(0, 8)}`,
      patientName: "Smith, John",
      modalitiesInStudy: ["DX"],
      numberOfSeries: 1,
      numberOfInstances: 2,
      referringPhysician: "Dr. Emily Watson",
      institutionName: "City Medical Center",
      bodyParts: ["CHEST"],
      procedureCodes: [{ code: "71046", display: "X-Ray Chest 2 Views", system: "CPT" }],
      series: [
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.3.1`,
          seriesNumber: 1,
          seriesDescription: "PA and Lateral Views",
          modality: "DX",
          bodyPartExamined: "CHEST",
          numberOfInstances: 2,
          instances: [],
        },
      ],
      status: "available",
    },
    {
      id: generateId("study"),
      studyInstanceUid: `1.2.840.10008.${Date.now()}.4`,
      studyDate: "2023-11-15",
      studyTime: "11:30:00",
      studyDescription: "Ultrasound Abdomen Complete",
      accessionNumber: "ACC-2023-032",
      patientId: `patient-${hashIdentifier(userId).slice(0, 8)}`,
      patientName: "Smith, John",
      modalitiesInStudy: ["US"],
      numberOfSeries: 1,
      numberOfInstances: 45,
      referringPhysician: "Dr. Sarah Johnson",
      institutionName: "City Medical Center",
      bodyParts: ["ABDOMEN"],
      procedureCodes: [{ code: "76700", display: "US Abdomen Complete", system: "CPT" }],
      series: [
        {
          id: generateId("series"),
          seriesInstanceUid: `1.2.840.10008.${Date.now()}.4.1`,
          seriesNumber: 1,
          seriesDescription: "Complete Abdominal Survey",
          modality: "US",
          bodyPartExamined: "ABDOMEN",
          numberOfInstances: 45,
          instances: [],
        },
      ],
      status: "available",
    },
  ];

  let filtered = mockStudies;

  if (params.modality) {
    filtered = filtered.filter((s) => s.modalitiesInStudy.includes(params.modality!));
  }

  if (params.studyDate) {
    filtered = filtered.filter((s) => s.studyDate === params.studyDate);
  }

  if (params.bodyPart) {
    filtered = filtered.filter((s) => s.bodyParts.some((bp) => bp.toLowerCase().includes(params.bodyPart!.toLowerCase())));
  }

  if (params.studyDescription) {
    filtered = filtered.filter((s) => s.studyDescription.toLowerCase().includes(params.studyDescription!.toLowerCase()));
  }

  return filtered;
}

export async function retrieveImage(params: DICOMRetrieveParams): Promise<DICOMRetrieveResult> {
  const connection = dicomConnections.get(params.connectionId);
  if (!connection) {
    return { success: false, error: "Connection not found" };
  }

  if (connection.userId !== params.userId) {
    return { success: false, error: "Unauthorized" };
  }

  logHipaaAudit(
    "RETRIEVE_IMAGE",
    params.userId,
    params.connectionId,
    `Retrieving image: Study=${params.studyInstanceUid}, Series=${params.seriesInstanceUid || "all"}`
  );

  connection.auditLog.push({
    id: generateId("audit"),
    action: "retrieve",
    timestamp: new Date().toISOString(),
    details: `Retrieved image from study ${params.studyInstanceUid}`,
    studyUid: params.studyInstanceUid,
    seriesUid: params.seriesInstanceUid,
    instanceUid: params.sopInstanceUid,
  });

  const wadoUrl = connection.wadoEndpoint || `${connection.pacsEndpoint}/wado`;
  const format = params.format || "jpeg";

  const retrieveUrl = `${wadoUrl}?requestType=WADO&studyUID=${params.studyInstanceUid}` +
    (params.seriesInstanceUid ? `&seriesUID=${params.seriesInstanceUid}` : "") +
    (params.sopInstanceUid ? `&objectUID=${params.sopInstanceUid}` : "") +
    `&contentType=image/${format}` +
    (params.windowCenter ? `&windowCenter=${params.windowCenter}` : "") +
    (params.windowWidth ? `&windowWidth=${params.windowWidth}` : "") +
    (params.frame ? `&frameNumber=${params.frame}` : "");

  return {
    success: true,
    contentType: `image/${format}`,
    url: retrieveUrl,
    metadata: {
      studyInstanceUid: params.studyInstanceUid,
      seriesInstanceUid: params.seriesInstanceUid,
      sopInstanceUid: params.sopInstanceUid,
      format,
    },
  };
}

export async function getStudyMetadata(
  connectionId: string,
  userId: string,
  studyInstanceUid: string
): Promise<ImagingStudy | null> {
  const cacheKey = `${connectionId}:${userId}`;
  const cachedStudies = studiesCache.get(cacheKey);

  if (cachedStudies) {
    const study = cachedStudies.find((s) => s.studyInstanceUid === studyInstanceUid);
    if (study) {
      logHipaaAudit("VIEW_STUDY", userId, connectionId, `Viewing study metadata: ${studyInstanceUid}`);
      return study;
    }
  }

  const result = await queryStudies(connectionId, userId, { studyInstanceUid });
  return result.studies[0] || null;
}

export function convertToFhirImagingStudy(study: ImagingStudy, patientReference: string): any {
  return {
    resourceType: "ImagingStudy",
    id: study.id,
    status: study.status === "available" ? "available" : "unknown",
    subject: { reference: patientReference },
    started: `${study.studyDate}T${study.studyTime || "00:00:00"}Z`,
    numberOfSeries: study.numberOfSeries,
    numberOfInstances: study.numberOfInstances,
    description: study.studyDescription,
    identifier: [
      {
        system: "urn:dicom:uid",
        value: `urn:oid:${study.studyInstanceUid}`,
      },
      ...(study.accessionNumber
        ? [
            {
              type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "ACSN" }] },
              value: study.accessionNumber,
            },
          ]
        : []),
    ],
    modality: study.modalitiesInStudy.map((mod) => ({
      system: "http://dicom.nema.org/resources/ontology/DCM",
      code: mod,
    })),
    referrer: study.referringPhysician
      ? { display: study.referringPhysician }
      : undefined,
    location: study.institutionName
      ? { display: study.institutionName }
      : undefined,
    procedureCode: study.procedureCodes.map((pc) => ({
      coding: [{ system: `http://www.ama-assn.org/go/${pc.system.toLowerCase()}`, code: pc.code, display: pc.display }],
    })),
    series: study.series.map((series) => ({
      uid: series.seriesInstanceUid,
      number: series.seriesNumber,
      modality: {
        system: "http://dicom.nema.org/resources/ontology/DCM",
        code: series.modality,
      },
      description: series.seriesDescription,
      numberOfInstances: series.numberOfInstances,
      bodysite: series.bodyPartExamined
        ? { coding: [{ system: "http://snomed.info/sct", display: series.bodyPartExamined }] }
        : undefined,
    })),
  };
}

export async function disconnectConnection(connectionId: string, userId: string): Promise<boolean> {
  const connection = dicomConnections.get(connectionId);
  if (!connection || connection.userId !== userId) {
    return false;
  }

  logHipaaAudit("DISCONNECT", userId, connectionId, `Disconnecting from ${connection.displayName}`);

  connection.status = "disconnected";
  connection.updatedAt = new Date().toISOString();

  connection.auditLog.push({
    id: generateId("audit"),
    action: "disconnect",
    timestamp: new Date().toISOString(),
    details: `Disconnected from ${connection.displayName}`,
  });

  studiesCache.delete(`${connectionId}:${userId}`);

  return true;
}

export function getConnectionAuditLog(connectionId: string, userId: string): DICOMAuditEntry[] | null {
  const connection = dicomConnections.get(connectionId);
  if (!connection || connection.userId !== userId) {
    return null;
  }
  return connection.auditLog;
}
