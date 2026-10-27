const DENTRIX_BASE_URL = process.env.DENTRIX_API_URL || "https://api.dentrix.com/v2";
const DENTRIX_API_KEY = process.env.DENTRIX_API_KEY;
const DENTRIX_PRACTICE_ID = process.env.DENTRIX_PRACTICE_ID;

export interface DentrixPatient {
  patientId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  address: {
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
  };
  homePhone: string;
  cellPhone: string;
  email: string;
  preferredName: string;
  status: string;
  responsiblePartyId: string;
  primaryProviderId: string;
  chartNumber: string;
}

export interface DentrixAppointment {
  appointmentId: string;
  patientId: string;
  startTime: string;
  endTime: string;
  status: string;
  operatoryId: string;
  providerId: string;
  providerName: string;
  reason: string;
  procedures: string[];
  notes: string;
  isHygiene: boolean;
  confirmed: boolean;
}

export interface DentrixProcedure {
  procedureId: string;
  patientId: string;
  datePerformed: string;
  status: string;
  cdtCode: string;
  description: string;
  toothNumber: string;
  surface: string;
  fee: number;
  insurancePortion: number;
  patientPortion: number;
  providerId: string;
  providerName: string;
  notes: string;
  quadrant: string;
}

export interface DentrixTreatmentPlan {
  planId: string;
  patientId: string;
  createdDate: string;
  planName: string;
  status: string;
  totalFee: number;
  insuranceEstimate: number;
  patientEstimate: number;
  procedures: DentrixProcedure[];
  notes: string;
  priority: string;
}

export interface DentrixPerioChart {
  chartId: string;
  patientId: string;
  examDate: string;
  providerId: string;
  providerName: string;
  readings: DentrixPerioReading[];
}

export interface DentrixPerioReading {
  toothNumber: number;
  site: string;
  probingDepth: number;
  recession: number;
  bleeding: boolean;
  suppuration: boolean;
  furcation: number;
  mobility: number;
}

export interface DentrixClinicalNote {
  noteId: string;
  patientId: string;
  date: string;
  providerId: string;
  providerName: string;
  noteType: string;
  content: string;
  signedBy: string;
  signedDate: string;
}

export interface DentrixInsurance {
  insuranceId: string;
  patientId: string;
  subscriberId: string;
  carrierName: string;
  groupNumber: string;
  planName: string;
  coverageType: string;
  effectiveDate: string;
  terminationDate: string;
  annualMaximum: number;
  remainingBenefit: number;
  deductible: number;
  deductibleMet: number;
  relationship: string;
}

export interface DentrixImage {
  imageId: string;
  patientId: string;
  captureDate: string;
  imageType: string;
  description: string;
  toothNumbers: string[];
  notes: string;
  category: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DENTRIX_API_KEY) headers["X-API-Key"] = DENTRIX_API_KEY;
  if (DENTRIX_PRACTICE_ID) headers["X-Practice-Id"] = DENTRIX_PRACTICE_ID;
  return headers;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${DENTRIX_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dentrix API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${DENTRIX_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dentrix API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${DENTRIX_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dentrix API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const dentrixService = {
  isConfigured(): boolean {
    return !!(DENTRIX_API_KEY && DENTRIX_PRACTICE_ID);
  },

  async getPatient(patientId: string): Promise<DentrixPatient> {
    return apiGet<DentrixPatient>(`/patients/${patientId}`);
  },

  async searchPatients(query: {
    lastName?: string;
    firstName?: string;
    dateOfBirth?: string;
    chartNumber?: string;
  }): Promise<DentrixPatient[]> {
    const params = new URLSearchParams();
    if (query.lastName) params.set("lastName", query.lastName);
    if (query.firstName) params.set("firstName", query.firstName);
    if (query.dateOfBirth) params.set("dateOfBirth", query.dateOfBirth);
    if (query.chartNumber) params.set("chartNumber", query.chartNumber);
    return apiGet<DentrixPatient[]>(`/patients?${params.toString()}`);
  },

  async getAppointments(patientId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<DentrixAppointment[]> {
    const params = new URLSearchParams({ patientId });
    if (options?.startDate) params.set("startDate", options.startDate);
    if (options?.endDate) params.set("endDate", options.endDate);
    return apiGet<DentrixAppointment[]>(`/appointments?${params.toString()}`);
  },

  async getProcedures(patientId: string): Promise<DentrixProcedure[]> {
    return apiGet<DentrixProcedure[]>(`/procedures?patientId=${patientId}`);
  },

  async getTreatmentPlans(patientId: string): Promise<DentrixTreatmentPlan[]> {
    return apiGet<DentrixTreatmentPlan[]>(`/treatmentplans?patientId=${patientId}`);
  },

  async getPerioCharts(patientId: string): Promise<DentrixPerioChart[]> {
    return apiGet<DentrixPerioChart[]>(`/periocharts?patientId=${patientId}`);
  },

  async getClinicalNotes(patientId: string): Promise<DentrixClinicalNote[]> {
    return apiGet<DentrixClinicalNote[]>(`/clinicalnotes?patientId=${patientId}`);
  },

  async getInsurance(patientId: string): Promise<DentrixInsurance[]> {
    return apiGet<DentrixInsurance[]>(`/insurance?patientId=${patientId}`);
  },

  async getImages(patientId: string): Promise<DentrixImage[]> {
    return apiGet<DentrixImage[]>(`/images?patientId=${patientId}`);
  },

  async getCompleteDentrixRecord(patientId: string): Promise<{
    patient: DentrixPatient;
    appointments: DentrixAppointment[];
    procedures: DentrixProcedure[];
    treatmentPlans: DentrixTreatmentPlan[];
    perioCharts: DentrixPerioChart[];
    clinicalNotes: DentrixClinicalNote[];
    insurance: DentrixInsurance[];
    images: DentrixImage[];
  }> {
    const [patient, appointments, procedures, treatmentPlans, perioCharts, clinicalNotes, insurance, images] =
      await Promise.all([
        this.getPatient(patientId),
        this.getAppointments(patientId),
        this.getProcedures(patientId),
        this.getTreatmentPlans(patientId),
        this.getPerioCharts(patientId),
        this.getClinicalNotes(patientId),
        this.getInsurance(patientId),
        this.getImages(patientId),
      ]);
    return { patient, appointments, procedures, treatmentPlans, perioCharts, clinicalNotes, insurance, images };
  },

  mapToFhirEncounter(apt: DentrixAppointment): Record<string, unknown> {
    return {
      resourceType: "Encounter",
      id: `dentrix-apt-${apt.appointmentId}`,
      status: apt.status === "Complete" ? "finished" : apt.status === "Scheduled" ? "planned" : "cancelled",
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
        text: apt.reason || "Dental appointment",
      }],
      period: {
        start: apt.startTime,
        end: apt.endTime,
      },
      participant: [{
        individual: {
          display: apt.providerName,
        },
      }],
      meta: {
        source: "Dentrix",
        lastUpdated: new Date().toISOString(),
      },
    };
  },

  mapToFhirProcedure(proc: DentrixProcedure): Record<string, unknown> {
    return {
      resourceType: "Procedure",
      id: `dentrix-proc-${proc.procedureId}`,
      status: proc.status === "Complete" ? "completed" : proc.status === "Planned" ? "preparation" : "unknown",
      code: {
        coding: [{
          system: "http://www.ada.org/cdt",
          code: proc.cdtCode,
          display: proc.description,
        }],
        text: proc.description,
      },
      performedDateTime: proc.datePerformed,
      performer: [{
        actor: {
          display: proc.providerName,
        },
      }],
      bodySite: proc.toothNumber ? [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/FDI-surface",
          code: proc.toothNumber,
          display: `Tooth ${proc.toothNumber}`,
        }],
        text: proc.surface ? `Tooth ${proc.toothNumber}, Surface: ${proc.surface}` : `Tooth ${proc.toothNumber}`,
      }] : undefined,
      note: proc.notes ? [{ text: proc.notes }] : undefined,
      meta: {
        source: "Dentrix",
        lastUpdated: new Date().toISOString(),
      },
    };
  },

  mapToFhirObservation(reading: DentrixPerioReading, examDate: string): Record<string, unknown> {
    return {
      resourceType: "Observation",
      id: `dentrix-perio-${reading.toothNumber}-${reading.site}`,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "exam",
          display: "Exam",
        }],
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "LP96285-4",
          display: "Periodontal probing depth",
        }],
        text: `Periodontal probing depth - Tooth ${reading.toothNumber} ${reading.site}`,
      },
      effectiveDateTime: examDate,
      valueQuantity: {
        value: reading.probingDepth,
        unit: "mm",
        system: "http://unitsofmeasure.org",
        code: "mm",
      },
      bodySite: {
        text: `Tooth ${reading.toothNumber}, ${reading.site}`,
      },
      meta: {
        source: "Dentrix",
        lastUpdated: new Date().toISOString(),
      },
    };
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
      return d.toISOString().split("T")[0];
    };

    return {
      patient: {
        patientId: "DTX-2001",
        lastName: "Demo",
        firstName: "Patient",
        middleName: "J",
        dateOfBirth: "1985-03-22",
        gender: "Female",
        address: {
          street1: "456 Wellness Ave",
          street2: "Suite 200",
          city: "Austin",
          state: "TX",
          zip: "78701",
        },
        homePhone: "512-555-0200",
        cellPhone: "512-555-0201",
        email: "demo@tabulamedica.app",
        preferredName: "Pat",
        status: "Active",
        responsiblePartyId: "DTX-2001",
        primaryProviderId: "PROV-101",
        chartNumber: "CH-7842",
      },
      appointments: [
        {
          appointmentId: "APT-3001",
          patientId: "DTX-2001",
          startTime: futureDate(21) + "T09:00:00",
          endTime: futureDate(21) + "T10:00:00",
          status: "Scheduled",
          operatoryId: "OP-3",
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          reason: "Prophylaxis and Periodic Exam",
          procedures: ["D1110", "D0120"],
          notes: "6-month routine cleaning and checkup",
          isHygiene: true,
          confirmed: true,
        },
        {
          appointmentId: "APT-3002",
          patientId: "DTX-2001",
          startTime: pastDate(150) + "T14:00:00",
          endTime: pastDate(150) + "T15:00:00",
          status: "Complete",
          operatoryId: "OP-1",
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          reason: "Prophylaxis, BWX, Periodic Exam",
          procedures: ["D1110", "D0274", "D0120"],
          notes: "Routine cleaning and x-rays. All clear.",
          isHygiene: true,
          confirmed: true,
        },
        {
          appointmentId: "APT-3003",
          patientId: "DTX-2001",
          startTime: pastDate(60) + "T10:30:00",
          endTime: pastDate(60) + "T12:00:00",
          status: "Complete",
          operatoryId: "OP-2",
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          reason: "Root Canal Treatment - Tooth #19",
          procedures: ["D3330"],
          notes: "Endodontic therapy completed on tooth #19. 3 canals. Patient tolerated well. Post-op instructions given.",
          isHygiene: false,
          confirmed: true,
        },
        {
          appointmentId: "APT-3004",
          patientId: "DTX-2001",
          startTime: pastDate(30) + "T10:00:00",
          endTime: pastDate(30) + "T11:30:00",
          status: "Complete",
          operatoryId: "OP-2",
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          reason: "Crown Delivery - Tooth #19",
          procedures: ["D2750"],
          notes: "PFM crown cemented on tooth #19. Shade A3. Occlusion adjusted. Margins sealed.",
          isHygiene: false,
          confirmed: true,
        },
      ],
      procedures: [
        {
          procedureId: "PROC-4001",
          patientId: "DTX-2001",
          datePerformed: pastDate(150),
          status: "Complete",
          cdtCode: "D1110",
          description: "Prophylaxis - Adult",
          toothNumber: "",
          surface: "",
          fee: 135.0,
          insurancePortion: 108.0,
          patientPortion: 27.0,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "Light calculus removal. Good home care.",
          quadrant: "",
        },
        {
          procedureId: "PROC-4002",
          patientId: "DTX-2001",
          datePerformed: pastDate(150),
          status: "Complete",
          cdtCode: "D0274",
          description: "Bitewings - Four Films",
          toothNumber: "",
          surface: "",
          fee: 72.0,
          insurancePortion: 57.6,
          patientPortion: 14.4,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "No interproximal caries detected.",
          quadrant: "",
        },
        {
          procedureId: "PROC-4003",
          patientId: "DTX-2001",
          datePerformed: pastDate(150),
          status: "Complete",
          cdtCode: "D0120",
          description: "Periodic Oral Evaluation",
          toothNumber: "",
          surface: "",
          fee: 58.0,
          insurancePortion: 46.4,
          patientPortion: 11.6,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "Soft tissues normal. Occlusion stable. Tooth #19 noted with large MOD amalgam and fracture line.",
          quadrant: "",
        },
        {
          procedureId: "PROC-4004",
          patientId: "DTX-2001",
          datePerformed: pastDate(60),
          status: "Complete",
          cdtCode: "D3330",
          description: "Endodontic Therapy - Molar",
          toothNumber: "19",
          surface: "",
          fee: 1100.0,
          insurancePortion: 550.0,
          patientPortion: 550.0,
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          notes: "3 canals located and obturated. Working lengths confirmed with apex locator. Post-op PA shows adequate fill.",
          quadrant: "LL",
        },
        {
          procedureId: "PROC-4005",
          patientId: "DTX-2001",
          datePerformed: pastDate(30),
          status: "Complete",
          cdtCode: "D2750",
          description: "Crown - Porcelain Fused to High Noble Metal",
          toothNumber: "19",
          surface: "",
          fee: 1350.0,
          insurancePortion: 675.0,
          patientPortion: 675.0,
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          notes: "PFM crown delivered. Marginal adaptation excellent. Patient satisfied with aesthetics.",
          quadrant: "LL",
        },
        {
          procedureId: "PROC-4006",
          patientId: "DTX-2001",
          datePerformed: pastDate(0),
          status: "Planned",
          cdtCode: "D1110",
          description: "Prophylaxis - Adult",
          toothNumber: "",
          surface: "",
          fee: 135.0,
          insurancePortion: 108.0,
          patientPortion: 27.0,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "",
          quadrant: "",
        },
        {
          procedureId: "PROC-4007",
          patientId: "DTX-2001",
          datePerformed: pastDate(0),
          status: "Planned",
          cdtCode: "D0120",
          description: "Periodic Oral Evaluation",
          toothNumber: "",
          surface: "",
          fee: 58.0,
          insurancePortion: 46.4,
          patientPortion: 11.6,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "",
          quadrant: "",
        },
        {
          procedureId: "PROC-4008",
          patientId: "DTX-2001",
          datePerformed: pastDate(0),
          status: "Planned",
          cdtCode: "D4341",
          description: "Periodontal Scaling and Root Planing - Per Quadrant",
          toothNumber: "",
          surface: "",
          fee: 285.0,
          insurancePortion: 228.0,
          patientPortion: 57.0,
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          notes: "Lower right quadrant. Recommended based on perio charting.",
          quadrant: "LR",
        },
      ],
      treatmentPlans: [
        {
          planId: "TP-5001",
          patientId: "DTX-2001",
          createdDate: pastDate(150),
          planName: "Comprehensive Restorative Plan",
          status: "Active",
          totalFee: 2928.0,
          insuranceEstimate: 1589.4,
          patientEstimate: 1338.6,
          procedures: [],
          notes: "Phase 1: RCT #19 and crown. Phase 2: SRP lower right quadrant. Phase 3: Routine preventive maintenance.",
          priority: "High",
        },
      ],
      perioCharts: [
        {
          chartId: "PC-6001",
          patientId: "DTX-2001",
          examDate: pastDate(150),
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          readings: [
            { toothNumber: 3, site: "MB", probingDepth: 3, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 3, site: "B", probingDepth: 2, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 3, site: "DB", probingDepth: 3, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 14, site: "MB", probingDepth: 3, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 14, site: "B", probingDepth: 2, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 14, site: "DB", probingDepth: 3, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 19, site: "MB", probingDepth: 4, recession: 1, bleeding: true, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 19, site: "B", probingDepth: 3, recession: 0, bleeding: true, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 19, site: "DB", probingDepth: 5, recession: 1, bleeding: true, suppuration: false, furcation: 1, mobility: 0 },
            { toothNumber: 30, site: "MB", probingDepth: 4, recession: 0, bleeding: true, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 30, site: "B", probingDepth: 3, recession: 0, bleeding: false, suppuration: false, furcation: 0, mobility: 0 },
            { toothNumber: 30, site: "DB", probingDepth: 4, recession: 1, bleeding: true, suppuration: false, furcation: 0, mobility: 0 },
          ],
        },
      ],
      clinicalNotes: [
        {
          noteId: "CN-7001",
          patientId: "DTX-2001",
          date: pastDate(150),
          providerId: "PROV-101",
          providerName: "Dr. Michelle Torres, DDS",
          noteType: "Progress Note",
          content: "Patient presents for routine 6-month prophylaxis. Mild gingivitis noted in lower right quadrant. Recommended SRP for quadrant 4. Home care instruction reinforced. Next visit: RCT evaluation for #19.",
          signedBy: "Dr. Michelle Torres, DDS",
          signedDate: pastDate(150),
        },
        {
          noteId: "CN-7002",
          patientId: "DTX-2001",
          date: pastDate(60),
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          noteType: "Operative Note",
          content: "RCT #19: Administered 1.7mL 2% lidocaine w/ 1:100k epi via IAN block. Isolation with rubber dam. Access through existing amalgam. 3 canals identified (ML, DL, D). Working lengths confirmed with apex locator and radiograph. Canals cleaned and shaped with rotary files. Irrigated with NaOCl 5.25%. Obturated with gutta percha and AH Plus sealer. Post-op PA satisfactory. Temp restoration placed. Crown impression scheduled.",
          signedBy: "Dr. Robert Kim, DMD",
          signedDate: pastDate(60),
        },
        {
          noteId: "CN-7003",
          patientId: "DTX-2001",
          date: pastDate(30),
          providerId: "PROV-102",
          providerName: "Dr. Robert Kim, DMD",
          noteType: "Operative Note",
          content: "Crown delivery #19: Removed temp. Tried in PFM crown - marginal fit excellent, contacts verified with floss, shade A3 matches adjacent teeth. Cemented with RelyX Unicem. Excess cement removed. Occlusion checked and adjusted. Patient happy with result. Post-op instructions reviewed.",
          signedBy: "Dr. Robert Kim, DMD",
          signedDate: pastDate(30),
        },
      ],
      insurance: [
        {
          insuranceId: "INS-8001",
          patientId: "DTX-2001",
          subscriberId: "GD-773891245",
          carrierName: "Guardian Dental",
          groupNumber: "GDN-5500",
          planName: "Guardian DentalGuard Preferred",
          coverageType: "PPO",
          effectiveDate: "2025-01-01",
          terminationDate: "2026-12-31",
          annualMaximum: 2000.0,
          remainingBenefit: 535.6,
          deductible: 50.0,
          deductibleMet: 50.0,
          relationship: "Self",
        },
      ],
      images: [
        {
          imageId: "IMG-9001",
          patientId: "DTX-2001",
          captureDate: pastDate(150),
          imageType: "Radiograph",
          description: "Bitewing Radiographs - Right Side",
          toothNumbers: ["2", "3", "4", "5"],
          notes: "No interproximal caries. Bone levels within normal limits.",
          category: "Diagnostic",
        },
        {
          imageId: "IMG-9002",
          patientId: "DTX-2001",
          captureDate: pastDate(150),
          imageType: "Radiograph",
          description: "Bitewing Radiographs - Left Side",
          toothNumbers: ["12", "13", "14", "15"],
          notes: "Large MOD amalgam #14 with marginal discrepancy and recurrent decay noted mesially. Fracture line visible on distal cusp.",
          category: "Diagnostic",
        },
        {
          imageId: "IMG-9003",
          patientId: "DTX-2001",
          captureDate: pastDate(60),
          imageType: "Radiograph",
          description: "Periapical - Tooth #19 Pre-RCT",
          toothNumbers: ["19"],
          notes: "Periapical radiolucency at apex of #19. Large MOD amalgam with cracked lingual cusp.",
          category: "Diagnostic",
        },
        {
          imageId: "IMG-9004",
          patientId: "DTX-2001",
          captureDate: pastDate(60),
          imageType: "Radiograph",
          description: "Periapical - Tooth #19 Post-RCT Working Length",
          toothNumbers: ["19"],
          notes: "Working length determination. Files in place, 3 canals visualized.",
          category: "Endodontic",
        },
        {
          imageId: "IMG-9005",
          patientId: "DTX-2001",
          captureDate: pastDate(30),
          imageType: "Radiograph",
          description: "Periapical - Tooth #19 Post-Crown",
          toothNumbers: ["19"],
          notes: "Final crown in place. Good marginal adaptation. Obturation adequate. No periapical changes.",
          category: "Restorative",
        },
        {
          imageId: "IMG-9006",
          patientId: "DTX-2001",
          captureDate: pastDate(150),
          imageType: "Intraoral Photo",
          description: "Full Mouth Series - Anterior View",
          toothNumbers: [],
          notes: "Facial photo for records. Good anterior alignment.",
          category: "Clinical Photo",
        },
      ],
    };
  },
};
