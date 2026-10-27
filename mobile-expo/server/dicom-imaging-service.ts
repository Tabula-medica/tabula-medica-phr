import crypto from "crypto";

export interface DICOMConfig {
  wadoUrl: string;
  dimseUrl?: string;
  apiKey?: string;
  aetitle: string;
  storageBackend: "gcs" | "s3" | "local";
  storageConfig: {
    bucket?: string;
    region?: string;
    path?: string;
  };
}

export interface DICOMStudy {
  studyInstanceUID: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  patientId: string;
  patientName: string;
  patientBirthDate?: string;
  patientSex?: string;
  referringPhysicianName?: string;
  institutionName?: string;
  modalities: string[];
  numberOfSeries: number;
  numberOfInstances: number;
  bodyPartExamined?: string;
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  bodyPartExamined?: string;
  protocolName?: string;
  numberOfInstances: number;
  seriesDate?: string;
  seriesTime?: string;
}

export interface DICOMInstance {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  sopClassUID: string;
  instanceNumber: number;
  acquisitionDateTime?: string;
  contentDateTime?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
  transferSyntaxUID?: string;
}

export interface ImagingStudyFHIR {
  resourceType: "ImagingStudy";
  id: string;
  identifier: Array<{
    system: string;
    value: string;
  }>;
  status: "available" | "cancelled" | "entered-in-error" | "unknown";
  subject: {
    reference: string;
    display?: string;
  };
  started?: string;
  basedOn?: Array<{
    reference: string;
  }>;
  referrer?: {
    reference: string;
    display?: string;
  };
  interpreter?: Array<{
    reference: string;
    display?: string;
  }>;
  endpoint?: Array<{
    reference: string;
  }>;
  numberOfSeries?: number;
  numberOfInstances?: number;
  procedureReference?: Array<{
    reference: string;
  }>;
  procedureCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  }>;
  location?: {
    reference: string;
    display?: string;
  };
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  }>;
  note?: Array<{
    text: string;
  }>;
  description?: string;
  series?: Array<{
    uid: string;
    number?: number;
    modality: {
      system: string;
      code: string;
    };
    description?: string;
    numberOfInstances?: number;
    endpoint?: Array<{
      reference: string;
    }>;
    bodySite?: {
      system: string;
      code: string;
      display?: string;
    };
    laterality?: {
      system: string;
      code: string;
      display?: string;
    };
    started?: string;
    performer?: Array<{
      function?: {
        coding: Array<{
          system: string;
          code: string;
        }>;
      };
      actor: {
        reference: string;
        display?: string;
      };
    }>;
    instance?: Array<{
      uid: string;
      sopClass: {
        system: string;
        code: string;
      };
      number?: number;
      title?: string;
    }>;
  }>;
}

export interface RadiologyReport {
  id: string;
  studyInstanceUID: string;
  accessionNumber: string;
  reportStatus: "preliminary" | "final" | "amended" | "cancelled";
  reportDateTime: string;
  radiologist: {
    id: string;
    name: string;
    npi?: string;
  };
  transcriptionist?: {
    id: string;
    name: string;
  };
  findings: string;
  impression: string;
  clinicalHistory?: string;
  technique?: string;
  comparison?: string;
  recommendations?: string[];
  criticalFindings?: {
    finding: string;
    communicatedTo?: string;
    communicatedAt?: string;
  };
  addendums?: Array<{
    text: string;
    datetime: string;
    author: string;
  }>;
}

const MODALITY_DESCRIPTIONS: Record<string, string> = {
  CT: "Computed Tomography",
  MR: "Magnetic Resonance Imaging",
  US: "Ultrasound",
  XR: "X-Ray (Radiography)",
  CR: "Computed Radiography",
  DX: "Digital Radiography",
  MG: "Mammography",
  NM: "Nuclear Medicine",
  PT: "Positron Emission Tomography",
  RF: "Radio Fluoroscopy",
  SC: "Secondary Capture",
  OT: "Other",
  IO: "Intra-Oral Radiography",
  PX: "Panoramic X-Ray",
  ES: "Endoscopy",
  XA: "X-Ray Angiography",
  ECG: "Electrocardiography",
  HD: "Hemodynamic Waveform",
  IVUS: "Intravascular Ultrasound",
  OP: "Ophthalmic Photography",
  OCT: "Optical Coherence Tomography"
};

const BODY_PART_MAPPING: Record<string, { code: string; system: string; display: string }> = {
  HEAD: { code: "69536005", system: "http://snomed.info/sct", display: "Head" },
  CHEST: { code: "51185008", system: "http://snomed.info/sct", display: "Chest" },
  ABDOMEN: { code: "113345001", system: "http://snomed.info/sct", display: "Abdomen" },
  PELVIS: { code: "12921003", system: "http://snomed.info/sct", display: "Pelvis" },
  SPINE: { code: "421060004", system: "http://snomed.info/sct", display: "Spine" },
  EXTREMITY: { code: "66019005", system: "http://snomed.info/sct", display: "Extremity" },
  BREAST: { code: "76752008", system: "http://snomed.info/sct", display: "Breast" },
  HEART: { code: "80891009", system: "http://snomed.info/sct", display: "Heart" },
  BRAIN: { code: "12738006", system: "http://snomed.info/sct", display: "Brain" },
  KNEE: { code: "72696002", system: "http://snomed.info/sct", display: "Knee" },
  SHOULDER: { code: "16982005", system: "http://snomed.info/sct", display: "Shoulder" },
  HIP: { code: "24136001", system: "http://snomed.info/sct", display: "Hip" }
};

class DICOMImagingService {
  private config: DICOMConfig | null = null;

  initialize(config: DICOMConfig): void {
    this.config = config;
  }

  getModalityDescriptions() {
    return MODALITY_DESCRIPTIONS;
  }

  getBodyPartMapping() {
    return BODY_PART_MAPPING;
  }

  async queryStudies(patientId: string, options?: {
    modalityFilter?: string[];
    dateRange?: { start: string; end: string };
    limit?: number;
    offset?: number;
  }): Promise<DICOMStudy[]> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const params = new URLSearchParams();
    params.append("PatientID", patientId);
    
    if (options?.modalityFilter && options.modalityFilter.length > 0) {
      params.append("ModalitiesInStudy", options.modalityFilter.join(","));
    }
    
    if (options?.dateRange) {
      params.append("StudyDate", `${options.dateRange.start}-${options.dateRange.end}`);
    }
    
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    
    if (options?.offset) {
      params.append("offset", options.offset.toString());
    }

    const headers: Record<string, string> = {
      "Accept": "application/dicom+json"
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.wadoUrl}/studies?${params.toString()}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to query studies: ${response.statusText}`);
    }

    const studies = await response.json();
    return this.parseStudiesFromDICOMJSON(studies);
  }

  async getStudy(studyInstanceUID: string): Promise<DICOMStudy | null> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const headers: Record<string, string> = {
      "Accept": "application/dicom+json"
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.wadoUrl}/studies/${studyInstanceUID}`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get study: ${response.statusText}`);
    }

    const study = await response.json();
    const parsed = this.parseStudiesFromDICOMJSON([study]);
    return parsed[0] || null;
  }

  async getSeries(studyInstanceUID: string): Promise<DICOMSeries[]> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const headers: Record<string, string> = {
      "Accept": "application/dicom+json"
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.wadoUrl}/studies/${studyInstanceUID}/series`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get series: ${response.statusText}`);
    }

    const series = await response.json();
    return this.parseSeriesFromDICOMJSON(series, studyInstanceUID);
  }

  async getInstances(studyInstanceUID: string, seriesInstanceUID: string): Promise<DICOMInstance[]> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const headers: Record<string, string> = {
      "Accept": "application/dicom+json"
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(
      `${this.config.wadoUrl}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get instances: ${response.statusText}`);
    }

    const instances = await response.json();
    return this.parseInstancesFromDICOMJSON(instances, seriesInstanceUID);
  }

  async getInstanceImage(studyInstanceUID: string, seriesInstanceUID: string, sopInstanceUID: string, options?: {
    format?: "jpeg" | "png" | "gif";
    quality?: number;
    viewport?: { width: number; height: number };
  }): Promise<ArrayBuffer> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const params = new URLSearchParams();
    
    if (options?.format) {
      params.append("contentType", `image/${options.format}`);
    }
    
    if (options?.quality) {
      params.append("quality", options.quality.toString());
    }
    
    if (options?.viewport) {
      params.append("viewport", `${options.viewport.width},${options.viewport.height}`);
    }

    const headers: Record<string, string> = {};
    
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(
      `${this.config.wadoUrl}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${sopInstanceUID}/rendered?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get instance image: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  async getStudyThumbnail(studyInstanceUID: string): Promise<ArrayBuffer> {
    if (!this.config) {
      throw new Error("DICOM imaging service not initialized");
    }

    const headers: Record<string, string> = {};
    
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(
      `${this.config.wadoUrl}/studies/${studyInstanceUID}/thumbnail`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get study thumbnail: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  convertToFHIRImagingStudy(study: DICOMStudy, series: DICOMSeries[], patientReference: string): ImagingStudyFHIR {
    return {
      resourceType: "ImagingStudy",
      id: crypto.randomUUID(),
      identifier: [
        {
          system: "urn:dicom:uid",
          value: `urn:oid:${study.studyInstanceUID}`
        },
        ...(study.accessionNumber ? [{
          system: "http://hospital.local/accession",
          value: study.accessionNumber
        }] : [])
      ],
      status: "available",
      subject: {
        reference: patientReference,
        display: study.patientName
      },
      started: study.studyDate ? this.formatDICOMDateTime(study.studyDate, study.studyTime) : undefined,
      referrer: study.referringPhysicianName ? {
        reference: "Practitioner/unknown",
        display: study.referringPhysicianName
      } : undefined,
      numberOfSeries: study.numberOfSeries,
      numberOfInstances: study.numberOfInstances,
      description: study.studyDescription,
      series: series.map(s => ({
        uid: s.seriesInstanceUID,
        number: s.seriesNumber,
        modality: {
          system: "http://dicom.nema.org/resources/ontology/DCM",
          code: s.modality
        },
        description: s.seriesDescription,
        numberOfInstances: s.numberOfInstances,
        bodySite: s.bodyPartExamined && BODY_PART_MAPPING[s.bodyPartExamined] ? BODY_PART_MAPPING[s.bodyPartExamined] : undefined,
        started: s.seriesDate ? this.formatDICOMDateTime(s.seriesDate, s.seriesTime) : undefined
      }))
    };
  }

  private parseStudiesFromDICOMJSON(dicomJson: unknown[]): DICOMStudy[] {
    return dicomJson.map((item) => {
      const study = item as Record<string, unknown>;
      return {
        studyInstanceUID: this.getDICOMValue(study, "0020000D") || "",
        studyDate: this.getDICOMValue(study, "00080020") || "",
        studyTime: this.getDICOMValue(study, "00080030"),
        studyDescription: this.getDICOMValue(study, "00081030"),
        accessionNumber: this.getDICOMValue(study, "00080050"),
        patientId: this.getDICOMValue(study, "00100020") || "",
        patientName: this.formatDICOMName(this.getDICOMValue(study, "00100010")),
        patientBirthDate: this.getDICOMValue(study, "00100030"),
        patientSex: this.getDICOMValue(study, "00100040"),
        referringPhysicianName: this.formatDICOMName(this.getDICOMValue(study, "00080090")),
        institutionName: this.getDICOMValue(study, "00080080"),
        modalities: this.getDICOMValues(study, "00080061") || [],
        numberOfSeries: parseInt(this.getDICOMValue(study, "00201206") || "0", 10),
        numberOfInstances: parseInt(this.getDICOMValue(study, "00201208") || "0", 10),
        bodyPartExamined: this.getDICOMValue(study, "00180015")
      };
    });
  }

  private parseSeriesFromDICOMJSON(dicomJson: unknown[], studyInstanceUID: string): DICOMSeries[] {
    return dicomJson.map((item) => {
      const series = item as Record<string, unknown>;
      return {
        seriesInstanceUID: this.getDICOMValue(series, "0020000E") || "",
        studyInstanceUID,
        seriesNumber: parseInt(this.getDICOMValue(series, "00200011") || "0", 10),
        seriesDescription: this.getDICOMValue(series, "0008103E"),
        modality: this.getDICOMValue(series, "00080060") || "",
        bodyPartExamined: this.getDICOMValue(series, "00180015"),
        protocolName: this.getDICOMValue(series, "00181030"),
        numberOfInstances: parseInt(this.getDICOMValue(series, "00201209") || "0", 10),
        seriesDate: this.getDICOMValue(series, "00080021"),
        seriesTime: this.getDICOMValue(series, "00080031")
      };
    });
  }

  private parseInstancesFromDICOMJSON(dicomJson: unknown[], seriesInstanceUID: string): DICOMInstance[] {
    return dicomJson.map((item) => {
      const instance = item as Record<string, unknown>;
      return {
        sopInstanceUID: this.getDICOMValue(instance, "00080018") || "",
        seriesInstanceUID,
        sopClassUID: this.getDICOMValue(instance, "00080016") || "",
        instanceNumber: parseInt(this.getDICOMValue(instance, "00200013") || "0", 10),
        acquisitionDateTime: this.getDICOMValue(instance, "0008002A"),
        contentDateTime: this.getDICOMValue(instance, "00080023"),
        rows: parseInt(this.getDICOMValue(instance, "00280010") || "0", 10) || undefined,
        columns: parseInt(this.getDICOMValue(instance, "00280011") || "0", 10) || undefined,
        bitsAllocated: parseInt(this.getDICOMValue(instance, "00280100") || "0", 10) || undefined,
        photometricInterpretation: this.getDICOMValue(instance, "00280004"),
        transferSyntaxUID: this.getDICOMValue(instance, "00020010")
      };
    });
  }

  private getDICOMValue(obj: Record<string, unknown>, tag: string): string | undefined {
    const element = obj[tag] as { Value?: unknown[] } | undefined;
    if (!element || !element.Value || element.Value.length === 0) {
      return undefined;
    }
    const value = element.Value[0];
    if (typeof value === "object" && value !== null && "Alphabetic" in value) {
      return (value as { Alphabetic: string }).Alphabetic;
    }
    return String(value);
  }

  private getDICOMValues(obj: Record<string, unknown>, tag: string): string[] | undefined {
    const element = obj[tag] as { Value?: unknown[] } | undefined;
    if (!element || !element.Value) {
      return undefined;
    }
    return element.Value.map(v => String(v));
  }

  private formatDICOMName(name: string | undefined): string {
    if (!name) return "";
    return name.replace(/\^/g, " ").trim();
  }

  private formatDICOMDateTime(date: string, time?: string): string {
    const year = date.substring(0, 4);
    const month = date.substring(4, 6);
    const day = date.substring(6, 8);

    let isoDate = `${year}-${month}-${day}`;

    if (time && time.length >= 6) {
      const hour = time.substring(0, 2);
      const minute = time.substring(2, 4);
      const second = time.substring(4, 6);
      isoDate += `T${hour}:${minute}:${second}`;
    }

    return isoDate;
  }
}

export const dicomImagingService = new DICOMImagingService();

export function initializeDICOMImaging(): void {
  const wadoUrl = process.env.DICOM_WADO_URL;

  if (wadoUrl) {
    dicomImagingService.initialize({
      wadoUrl,
      apiKey: process.env.DICOM_API_KEY,
      aetitle: process.env.DICOM_AETITLE || "TABULA_MEDICA",
      storageBackend: (process.env.DICOM_STORAGE_BACKEND || "gcs") as "gcs" | "s3" | "local",
      storageConfig: {
        bucket: process.env.DICOM_STORAGE_BUCKET,
        region: process.env.DICOM_STORAGE_REGION
      }
    });
    console.log("DICOM imaging service initialized");
  } else {
    console.log("DICOM WADO URL not configured - imaging service disabled");
  }
}
