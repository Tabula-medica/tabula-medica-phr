import { z } from "zod";

const OPEN_DENTAL_BASE_URL = process.env.OPEN_DENTAL_API_URL || "https://api.opendental.com/api/v1";
const OPEN_DENTAL_DEV_KEY = process.env.OPEN_DENTAL_DEVELOPER_KEY;
const OPEN_DENTAL_CUSTOMER_KEY = process.env.OPEN_DENTAL_CUSTOMER_KEY;

export interface DentalPatient {
  PatNum: number;
  LName: string;
  FName: string;
  MiddleI: string;
  Birthdate: string;
  Gender: number;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  HmPhone: string;
  WkPhone: string;
  WirelessPhone: string;
  Email: string;
  SSN: string;
  InsEst: number;
  PatStatus: number;
}

export interface DentalAppointment {
  AptNum: number;
  PatNum: number;
  AptDateTime: string;
  AptStatus: number;
  ProvNum: number;
  ProvBarText: string;
  ProcDescript: string;
  Note: string;
  IsHygiene: boolean;
  Pattern: string;
  ConfirmedStatus: number;
  Op: number;
  ClinicNum: number;
}

export interface DentalProcedure {
  ProcNum: number;
  PatNum: number;
  ProcDate: string;
  ProcStatus: number;
  CodeNum: number;
  ProcCode: string;
  Descript: string;
  ToothNum: string;
  ToothRange: string;
  Surf: string;
  ProcFee: number;
  ProvNum: number;
  Note: string;
  Priority: number;
}

export interface DentalTreatmentPlan {
  TreatPlanNum: number;
  PatNum: number;
  DateTP: string;
  Heading: string;
  Note: string;
  Signature: string;
  procedures: DentalProcedure[];
}

export interface DentalPerioExam {
  PerioExamNum: number;
  PatNum: number;
  ExamDate: string;
  measurements: DentalPerioMeasure[];
}

export interface DentalPerioMeasure {
  PerioMeasureNum: number;
  PerioExamNum: number;
  SequenceType: number;
  IntTooth: number;
  ToothValue: number;
  MBvalue: number;
  Bvalue: number;
  DBvalue: number;
  MLvalue: number;
  Lvalue: number;
  DLvalue: number;
}

export interface DentalImage {
  DocNum: number;
  PatNum: number;
  DateCreated: string;
  DocCategory: number;
  Description: string;
  FileName: string;
  ImgType: number;
  Note: string;
}

export interface DentalInsurance {
  PatPlanNum: number;
  PatNum: number;
  PlanNum: number;
  InsSubNum: number;
  Ordinal: number;
  Relationship: number;
  carrierName: string;
  groupNum: string;
  subscriberId: string;
  planType: string;
}

const AptStatusLabels: Record<number, string> = {
  1: "Scheduled",
  2: "Complete",
  3: "Unscheduled",
  4: "ASAP",
  5: "Broken",
  6: "Planned",
  7: "PtNote",
  8: "PtNoteCompleted",
};

const ProcStatusLabels: Record<number, string> = {
  1: "Treatment Planned",
  2: "Complete",
  3: "Existing/Current",
  4: "Existing/Other",
  5: "Referred Out",
  6: "Deleted",
  7: "Condition",
};

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (OPEN_DENTAL_DEV_KEY) headers["Authorization"] = OPEN_DENTAL_DEV_KEY;
  if (OPEN_DENTAL_CUSTOMER_KEY) headers["CustomerKey"] = OPEN_DENTAL_CUSTOMER_KEY;
  return headers;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${OPEN_DENTAL_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open Dental API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPEN_DENTAL_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Open Dental API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPEN_DENTAL_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Open Dental API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const openDentalService = {
  isConfigured(): boolean {
    return !!(OPEN_DENTAL_DEV_KEY && OPEN_DENTAL_CUSTOMER_KEY);
  },

  async getPatient(patNum: number): Promise<DentalPatient> {
    return apiGet<DentalPatient>(`/patients/${patNum}`);
  },

  async searchPatients(query: {
    LName?: string;
    FName?: string;
    Birthdate?: string;
    Phone?: string;
  }): Promise<DentalPatient[]> {
    const params = new URLSearchParams();
    if (query.LName) params.set("LName", query.LName);
    if (query.FName) params.set("FName", query.FName);
    if (query.Birthdate) params.set("Birthdate", query.Birthdate);
    if (query.Phone) params.set("Phone", query.Phone);
    return apiGet<DentalPatient[]>(`/patients?${params.toString()}`);
  },

  async getAppointments(patNum: number, options?: {
    dateStart?: string;
    dateEnd?: string;
  }): Promise<DentalAppointment[]> {
    const params = new URLSearchParams({ PatNum: String(patNum) });
    if (options?.dateStart) params.set("AptDateTimeStart", options.dateStart);
    if (options?.dateEnd) params.set("AptDateTimeEnd", options.dateEnd);
    return apiGet<DentalAppointment[]>(`/appointments?${params.toString()}`);
  },

  async getAppointment(aptNum: number): Promise<DentalAppointment> {
    return apiGet<DentalAppointment>(`/appointments/${aptNum}`);
  },

  async createAppointment(data: {
    PatNum: number;
    AptDateTime: string;
    Op?: number;
    ProvNum?: number;
    IsHygiene?: boolean;
    Note?: string;
  }): Promise<DentalAppointment> {
    return apiPost<DentalAppointment>("/appointments", data);
  },

  async updateAppointment(aptNum: number, data: Partial<DentalAppointment>): Promise<DentalAppointment> {
    return apiPut<DentalAppointment>(`/appointments/${aptNum}`, data);
  },

  async getProcedures(patNum: number): Promise<DentalProcedure[]> {
    return apiGet<DentalProcedure[]>(`/procedurelogs?PatNum=${patNum}`);
  },

  async getTreatmentPlans(patNum: number): Promise<DentalTreatmentPlan[]> {
    return apiGet<DentalTreatmentPlan[]>(`/treatplans?PatNum=${patNum}`);
  },

  async getPerioExams(patNum: number): Promise<DentalPerioExam[]> {
    return apiGet<DentalPerioExam[]>(`/perioexams?PatNum=${patNum}`);
  },

  async getImages(patNum: number): Promise<DentalImage[]> {
    return apiGet<DentalImage[]>(`/documents?PatNum=${patNum}`);
  },

  async getInsurance(patNum: number): Promise<DentalInsurance[]> {
    return apiGet<DentalInsurance[]>(`/patplans?PatNum=${patNum}`);
  },

  async getCompleteDentalRecord(patNum: number): Promise<{
    patient: DentalPatient;
    appointments: DentalAppointment[];
    procedures: DentalProcedure[];
    treatmentPlans: DentalTreatmentPlan[];
    perioExams: DentalPerioExam[];
    images: DentalImage[];
    insurance: DentalInsurance[];
  }> {
    const [patient, appointments, procedures, treatmentPlans, perioExams, images, insurance] =
      await Promise.all([
        this.getPatient(patNum),
        this.getAppointments(patNum),
        this.getProcedures(patNum),
        this.getTreatmentPlans(patNum),
        this.getPerioExams(patNum),
        this.getImages(patNum),
        this.getInsurance(patNum),
      ]);
    return { patient, appointments, procedures, treatmentPlans, perioExams, images, insurance };
  },

  mapToFhirEncounter(apt: DentalAppointment): Record<string, unknown> {
    return {
      resourceType: "Encounter",
      id: `opendental-apt-${apt.AptNum}`,
      status: apt.AptStatus === 2 ? "finished" : apt.AptStatus === 1 ? "planned" : "cancelled",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory",
      },
      type: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "34043003",
          display: "Dental visit",
        }],
        text: apt.ProcDescript || "Dental appointment",
      }],
      period: {
        start: apt.AptDateTime,
      },
      reasonCode: apt.ProcDescript ? [{
        text: apt.ProcDescript,
      }] : undefined,
      meta: {
        source: "Open Dental",
        lastUpdated: new Date().toISOString(),
      },
    };
  },

  mapToFhirProcedure(proc: DentalProcedure): Record<string, unknown> {
    return {
      resourceType: "Procedure",
      id: `opendental-proc-${proc.ProcNum}`,
      status: proc.ProcStatus === 2 ? "completed" : proc.ProcStatus === 1 ? "preparation" : "unknown",
      code: {
        coding: [{
          system: "http://www.ada.org/cdt",
          code: proc.ProcCode,
          display: proc.Descript,
        }],
        text: proc.Descript,
      },
      performedDateTime: proc.ProcDate,
      bodySite: proc.ToothNum ? [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/FDI-surface",
          code: proc.ToothNum,
          display: `Tooth ${proc.ToothNum}`,
        }],
        text: proc.Surf ? `Tooth ${proc.ToothNum}, Surface: ${proc.Surf}` : `Tooth ${proc.ToothNum}`,
      }] : undefined,
      note: proc.Note ? [{ text: proc.Note }] : undefined,
      meta: {
        source: "Open Dental",
        lastUpdated: new Date().toISOString(),
      },
    };
  },

  getAptStatusLabel(status: number): string {
    return AptStatusLabels[status] || "Unknown";
  },

  getProcStatusLabel(status: number): string {
    return ProcStatusLabels[status] || "Unknown";
  },

  getDemoData() {
    const today = new Date();
    const pastDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split("T")[0];
    };
    const futureDate = (daysAhead: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysAhead);
      return d.toISOString().split("T")[0] + "T10:00:00";
    };

    return {
      patient: {
        PatNum: 1001,
        LName: "Demo",
        FName: "Patient",
        MiddleI: "M",
        Birthdate: "1990-06-15",
        Gender: 0,
        Address: "123 Health St",
        City: "San Francisco",
        State: "CA",
        Zip: "94102",
        HmPhone: "415-555-0100",
        WkPhone: "",
        WirelessPhone: "415-555-0101",
        Email: "demo@tabulamedica.app",
        SSN: "",
        InsEst: 2500,
        PatStatus: 0,
      },
      appointments: [
        {
          AptNum: 5001,
          PatNum: 1001,
          AptDateTime: futureDate(14),
          AptStatus: 1,
          ProvNum: 1,
          ProvBarText: "Dr. Sarah Chen, DDS",
          ProcDescript: "Prophylaxis (Cleaning), Periodic Oral Exam",
          Note: "6-month routine cleaning and checkup",
          IsHygiene: true,
          Pattern: "//XXXX//",
          ConfirmedStatus: 1,
          Op: 1,
          ClinicNum: 1,
        },
        {
          AptNum: 5002,
          PatNum: 1001,
          AptDateTime: pastDate(180) + "T09:30:00",
          AptStatus: 2,
          ProvNum: 1,
          ProvBarText: "Dr. Sarah Chen, DDS",
          ProcDescript: "Prophylaxis (Cleaning), BWX (4 films), Periodic Oral Exam",
          Note: "Routine 6-month cleaning. No issues found.",
          IsHygiene: true,
          Pattern: "//XXXXXX//",
          ConfirmedStatus: 4,
          Op: 1,
          ClinicNum: 1,
        },
        {
          AptNum: 5003,
          PatNum: 1001,
          AptDateTime: pastDate(90) + "T14:00:00",
          AptStatus: 2,
          ProvNum: 2,
          ProvBarText: "Dr. James Park, DMD",
          ProcDescript: "Crown - Porcelain/Ceramic Substrate",
          Note: "Crown placed on tooth #14. Patient tolerated well.",
          IsHygiene: false,
          Pattern: "//XXXXXXXX//",
          ConfirmedStatus: 4,
          Op: 2,
          ClinicNum: 1,
        },
      ],
      procedures: [
        {
          ProcNum: 8001,
          PatNum: 1001,
          ProcDate: pastDate(180),
          ProcStatus: 2,
          CodeNum: 110,
          ProcCode: "D1110",
          Descript: "Prophylaxis - Adult",
          ToothNum: "",
          ToothRange: "",
          Surf: "",
          ProcFee: 125.0,
          ProvNum: 1,
          Note: "Routine cleaning completed. Light calculus removal.",
          Priority: 0,
        },
        {
          ProcNum: 8002,
          PatNum: 1001,
          ProcDate: pastDate(180),
          ProcStatus: 2,
          CodeNum: 274,
          ProcCode: "D0274",
          Descript: "Bitewings - Four Films",
          ToothNum: "",
          ToothRange: "",
          Surf: "",
          ProcFee: 65.0,
          ProvNum: 1,
          Note: "No caries detected on radiographs.",
          Priority: 0,
        },
        {
          ProcNum: 8003,
          PatNum: 1001,
          ProcDate: pastDate(180),
          ProcStatus: 2,
          CodeNum: 120,
          ProcCode: "D0120",
          Descript: "Periodic Oral Evaluation",
          ToothNum: "",
          ToothRange: "",
          Surf: "",
          ProcFee: 55.0,
          ProvNum: 1,
          Note: "All tissues healthy. Recommend continue current hygiene regimen.",
          Priority: 0,
        },
        {
          ProcNum: 8004,
          PatNum: 1001,
          ProcDate: pastDate(90),
          ProcStatus: 2,
          CodeNum: 2740,
          ProcCode: "D2740",
          Descript: "Crown - Porcelain/Ceramic Substrate",
          ToothNum: "14",
          ToothRange: "",
          Surf: "",
          ProcFee: 1250.0,
          ProvNum: 2,
          Note: "E.max crown cemented with RelyX. Shade A2. Occlusion checked.",
          Priority: 0,
        },
        {
          ProcNum: 8005,
          PatNum: 1001,
          ProcDate: pastDate(0),
          ProcStatus: 1,
          CodeNum: 1110,
          ProcCode: "D1110",
          Descript: "Prophylaxis - Adult",
          ToothNum: "",
          ToothRange: "",
          Surf: "",
          ProcFee: 125.0,
          ProvNum: 1,
          Note: "",
          Priority: 0,
        },
        {
          ProcNum: 8006,
          PatNum: 1001,
          ProcDate: pastDate(0),
          ProcStatus: 1,
          CodeNum: 120,
          ProcCode: "D0120",
          Descript: "Periodic Oral Evaluation",
          ToothNum: "",
          ToothRange: "",
          Surf: "",
          ProcFee: 55.0,
          ProvNum: 1,
          Note: "",
          Priority: 0,
        },
      ],
      treatmentPlans: [
        {
          TreatPlanNum: 3001,
          PatNum: 1001,
          DateTP: pastDate(180),
          Heading: "Comprehensive Treatment Plan",
          Note: "Recommended treatment following periodic exam. Crown on #14 due to large failing amalgam with cracked margins.",
          Signature: "",
          procedures: [],
        },
      ],
      perioExams: [
        {
          PerioExamNum: 4001,
          PatNum: 1001,
          ExamDate: pastDate(180),
          measurements: [
            { PerioMeasureNum: 1, PerioExamNum: 4001, SequenceType: 1, IntTooth: 3, ToothValue: 0, MBvalue: 3, Bvalue: 2, DBvalue: 3, MLvalue: 3, Lvalue: 2, DLvalue: 3 },
            { PerioMeasureNum: 2, PerioExamNum: 4001, SequenceType: 1, IntTooth: 14, ToothValue: 0, MBvalue: 3, Bvalue: 3, DBvalue: 4, MLvalue: 3, Lvalue: 3, DLvalue: 3 },
            { PerioMeasureNum: 3, PerioExamNum: 4001, SequenceType: 1, IntTooth: 19, ToothValue: 0, MBvalue: 2, Bvalue: 2, DBvalue: 3, MLvalue: 3, Lvalue: 2, DLvalue: 2 },
            { PerioMeasureNum: 4, PerioExamNum: 4001, SequenceType: 1, IntTooth: 30, ToothValue: 0, MBvalue: 3, Bvalue: 2, DBvalue: 2, MLvalue: 3, Lvalue: 2, DLvalue: 3 },
          ],
        },
      ],
      images: [
        {
          DocNum: 6001,
          PatNum: 1001,
          DateCreated: pastDate(180),
          DocCategory: 1,
          Description: "Bitewing Radiographs - Right",
          FileName: "BWX_R_001.jpg",
          ImgType: 1,
          Note: "Right posterior bitewings. No caries detected.",
        },
        {
          DocNum: 6002,
          PatNum: 1001,
          DateCreated: pastDate(180),
          DocCategory: 1,
          Description: "Bitewing Radiographs - Left",
          FileName: "BWX_L_001.jpg",
          ImgType: 1,
          Note: "Left posterior bitewings. Large amalgam #14 with marginal gap noted.",
        },
        {
          DocNum: 6003,
          PatNum: 1001,
          DateCreated: pastDate(90),
          DocCategory: 2,
          Description: "Periapical - Tooth #14 Post-Crown",
          FileName: "PA_14_post.jpg",
          ImgType: 1,
          Note: "Post-operative PA showing crown #14. Good marginal adaptation.",
        },
      ],
      insurance: [
        {
          PatPlanNum: 7001,
          PatNum: 1001,
          PlanNum: 100,
          InsSubNum: 200,
          Ordinal: 1,
          Relationship: 0,
          carrierName: "Delta Dental PPO",
          groupNum: "DDG-9042",
          subscriberId: "DD-881234567",
          planType: "PPO",
        },
      ],
    };
  },
};
