const EAGLESOFT_BASE_URL = process.env.EAGLESOFT_API_URL || "https://api.pattersondental.com/eaglesoft/v1";
const EAGLESOFT_API_KEY = process.env.EAGLESOFT_API_KEY;
const EAGLESOFT_OFFICE_ID = process.env.EAGLESOFT_OFFICE_ID;

export interface EaglesoftPatient {
  patientId: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  dateOfBirth: string;
  gender: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  homePhone: string;
  mobilePhone: string;
  email: string;
  preferredName: string;
  patientStatus: string;
  primaryProvider: string;
  chartId: string;
  lastVisitDate: string;
  nextVisitDate: string;
}

export interface EaglesoftAppointment {
  appointmentId: string;
  patientId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  operatory: string;
  providerId: string;
  providerName: string;
  procedureCodes: string[];
  description: string;
  notes: string;
  appointmentType: string;
  confirmed: boolean;
}

export interface EaglesoftProcedure {
  procedureId: string;
  patientId: string;
  serviceDate: string;
  status: string;
  adaCode: string;
  description: string;
  toothNumber: string;
  surfaces: string;
  fee: number;
  insurancePayment: number;
  patientPayment: number;
  adjustments: number;
  balance: number;
  providerId: string;
  providerName: string;
  notes: string;
  quadrant: string;
  arch: string;
}

export interface EaglesoftTreatmentPlan {
  planId: string;
  patientId: string;
  dateCreated: string;
  planName: string;
  status: string;
  totalEstimate: number;
  insuranceEstimate: number;
  patientEstimate: number;
  phases: EaglesoftTreatmentPhase[];
  notes: string;
}

export interface EaglesoftTreatmentPhase {
  phaseId: string;
  phaseName: string;
  priority: number;
  procedures: EaglesoftProcedure[];
  phaseTotal: number;
}

export interface EaglesoftPerioExam {
  examId: string;
  patientId: string;
  examDate: string;
  providerId: string;
  providerName: string;
  examType: string;
  readings: EaglesoftPerioReading[];
  summary: {
    totalSites: number;
    sitesOver4mm: number;
    sitesOver6mm: number;
    bleedingPercentage: number;
    plaquePercentage: number;
  };
}

export interface EaglesoftPerioReading {
  toothNumber: number;
  site: string;
  probingDepth: number;
  gingivalMargin: number;
  clinicalAttachment: number;
  bleeding: boolean;
  plaque: boolean;
  furcation: number;
  mobility: number;
  suppuration: boolean;
}

export interface EaglesoftClinicalNote {
  noteId: string;
  patientId: string;
  noteDate: string;
  providerId: string;
  providerName: string;
  category: string;
  subject: string;
  content: string;
  signedBy: string;
  signedDate: string;
  locked: boolean;
}

export interface EaglesoftInsurance {
  planId: string;
  patientId: string;
  subscriberId: string;
  carrierName: string;
  carrierPhone: string;
  groupNumber: string;
  groupName: string;
  planType: string;
  effectiveDate: string;
  renewalDate: string;
  annualMax: number;
  annualUsed: number;
  annualRemaining: number;
  deductible: number;
  deductibleMet: number;
  orthoMax: number;
  orthoUsed: number;
  preventiveCoverage: number;
  basicCoverage: number;
  majorCoverage: number;
  relationship: string;
}

export interface EaglesoftImage {
  imageId: string;
  patientId: string;
  captureDate: string;
  imageType: string;
  description: string;
  toothNumbers: string[];
  mountName: string;
  notes: string;
  category: string;
  fileSize: string;
}

export interface EaglesoftLedgerEntry {
  entryId: string;
  patientId: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  balance: number;
  provider: string;
  insuranceClaim: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (EAGLESOFT_API_KEY) headers["Authorization"] = `Bearer ${EAGLESOFT_API_KEY}`;
  if (EAGLESOFT_OFFICE_ID) headers["X-Office-Id"] = EAGLESOFT_OFFICE_ID;
  return headers;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${EAGLESOFT_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Eaglesoft API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${EAGLESOFT_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Eaglesoft API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const eaglesoftService = {
  isConfigured(): boolean {
    return !!(EAGLESOFT_API_KEY && EAGLESOFT_OFFICE_ID);
  },

  async getPatient(patientId: string): Promise<EaglesoftPatient> {
    return apiGet<EaglesoftPatient>(`/patients/${patientId}`);
  },

  async searchPatients(query: {
    lastName?: string;
    firstName?: string;
    dateOfBirth?: string;
    chartId?: string;
    phone?: string;
  }): Promise<EaglesoftPatient[]> {
    const params = new URLSearchParams();
    if (query.lastName) params.set("lastName", query.lastName);
    if (query.firstName) params.set("firstName", query.firstName);
    if (query.dateOfBirth) params.set("dob", query.dateOfBirth);
    if (query.chartId) params.set("chartId", query.chartId);
    if (query.phone) params.set("phone", query.phone);
    return apiGet<EaglesoftPatient[]>(`/patients?${params.toString()}`);
  },

  async getAppointments(patientId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<EaglesoftAppointment[]> {
    const params = new URLSearchParams({ patientId });
    if (options?.startDate) params.set("startDate", options.startDate);
    if (options?.endDate) params.set("endDate", options.endDate);
    return apiGet<EaglesoftAppointment[]>(`/appointments?${params.toString()}`);
  },

  async getProcedures(patientId: string): Promise<EaglesoftProcedure[]> {
    return apiGet<EaglesoftProcedure[]>(`/procedures?patientId=${patientId}`);
  },

  async getTreatmentPlans(patientId: string): Promise<EaglesoftTreatmentPlan[]> {
    return apiGet<EaglesoftTreatmentPlan[]>(`/treatmentplans?patientId=${patientId}`);
  },

  async getPerioExams(patientId: string): Promise<EaglesoftPerioExam[]> {
    return apiGet<EaglesoftPerioExam[]>(`/perioexams?patientId=${patientId}`);
  },

  async getClinicalNotes(patientId: string): Promise<EaglesoftClinicalNote[]> {
    return apiGet<EaglesoftClinicalNote[]>(`/clinicalnotes?patientId=${patientId}`);
  },

  async getInsurance(patientId: string): Promise<EaglesoftInsurance[]> {
    return apiGet<EaglesoftInsurance[]>(`/insurance?patientId=${patientId}`);
  },

  async getImages(patientId: string): Promise<EaglesoftImage[]> {
    return apiGet<EaglesoftImage[]>(`/images?patientId=${patientId}`);
  },

  async getLedger(patientId: string): Promise<EaglesoftLedgerEntry[]> {
    return apiGet<EaglesoftLedgerEntry[]>(`/ledger?patientId=${patientId}`);
  },

  async getCompleteRecord(patientId: string): Promise<{
    patient: EaglesoftPatient;
    appointments: EaglesoftAppointment[];
    procedures: EaglesoftProcedure[];
    treatmentPlans: EaglesoftTreatmentPlan[];
    perioExams: EaglesoftPerioExam[];
    clinicalNotes: EaglesoftClinicalNote[];
    insurance: EaglesoftInsurance[];
    images: EaglesoftImage[];
    ledger: EaglesoftLedgerEntry[];
  }> {
    const [patient, appointments, procedures, treatmentPlans, perioExams, clinicalNotes, insurance, images, ledger] =
      await Promise.all([
        this.getPatient(patientId),
        this.getAppointments(patientId),
        this.getProcedures(patientId),
        this.getTreatmentPlans(patientId),
        this.getPerioExams(patientId),
        this.getClinicalNotes(patientId),
        this.getInsurance(patientId),
        this.getImages(patientId),
        this.getLedger(patientId),
      ]);
    return { patient, appointments, procedures, treatmentPlans, perioExams, clinicalNotes, insurance, images, ledger };
  },

  mapToFhirEncounter(apt: EaglesoftAppointment): Record<string, unknown> {
    return {
      resourceType: "Encounter",
      id: `eaglesoft-apt-${apt.appointmentId}`,
      status: apt.status === "Completed" ? "finished" : apt.status === "Scheduled" ? "planned" : "cancelled",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
      type: [{ coding: [{ system: "http://snomed.info/sct", code: "34043003", display: "Dental visit" }], text: apt.description || "Dental appointment" }],
      period: { start: `${apt.date}T${apt.startTime}`, end: `${apt.date}T${apt.endTime}` },
      participant: [{ individual: { display: apt.providerName } }],
      meta: { source: "Eaglesoft", lastUpdated: new Date().toISOString() },
    };
  },

  mapToFhirProcedure(proc: EaglesoftProcedure): Record<string, unknown> {
    return {
      resourceType: "Procedure",
      id: `eaglesoft-proc-${proc.procedureId}`,
      status: proc.status === "Completed" ? "completed" : proc.status === "Planned" ? "preparation" : "unknown",
      code: { coding: [{ system: "http://www.ada.org/cdt", code: proc.adaCode, display: proc.description }], text: proc.description },
      performedDateTime: proc.serviceDate,
      performer: [{ actor: { display: proc.providerName } }],
      bodySite: proc.toothNumber ? [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/FDI-surface", code: proc.toothNumber, display: `Tooth ${proc.toothNumber}` }], text: proc.surfaces ? `Tooth ${proc.toothNumber}, Surfaces: ${proc.surfaces}` : `Tooth ${proc.toothNumber}` }] : undefined,
      note: proc.notes ? [{ text: proc.notes }] : undefined,
      meta: { source: "Eaglesoft", lastUpdated: new Date().toISOString() },
    };
  },

  getDemoData() {
    const today = new Date();
    const pastDate = (daysAgo: number) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return d.toISOString().split("T")[0]; };
    const futureDate = (daysAhead: number) => { const d = new Date(today); d.setDate(d.getDate() + daysAhead); return d.toISOString().split("T")[0]; };

    return {
      patient: {
        patientId: "ES-3001", lastName: "Demo", firstName: "Patient", middleInitial: "R",
        dateOfBirth: "1988-11-08", gender: "Male",
        address1: "789 Medical Pkwy", address2: "", city: "Denver", state: "CO", zipCode: "80202",
        homePhone: "303-555-0300", mobilePhone: "303-555-0301", email: "demo@tabulamedica.app",
        preferredName: "Demo", patientStatus: "Active", primaryProvider: "Dr. Lisa Patel, DDS",
        chartId: "ES-7291", lastVisitDate: pastDate(45), nextVisitDate: futureDate(10),
      },
      appointments: [
        {
          appointmentId: "EA-4001", patientId: "ES-3001", date: futureDate(10), startTime: "08:30", endTime: "09:30",
          duration: 60, status: "Scheduled", operatory: "Op 2", providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS",
          procedureCodes: ["D1110", "D0120", "D0274"], description: "Prophylaxis, Exam, and Bitewings",
          notes: "6-month recall. Due for BWX.", appointmentType: "Hygiene", confirmed: true,
        },
        {
          appointmentId: "EA-4002", patientId: "ES-3001", date: pastDate(180), startTime: "10:00", endTime: "11:00",
          duration: 60, status: "Completed", operatory: "Op 1", providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS",
          procedureCodes: ["D1110", "D0120"], description: "Prophylaxis and Periodic Exam",
          notes: "Routine cleaning. Good oral hygiene. Minor calculus.", appointmentType: "Hygiene", confirmed: true,
        },
        {
          appointmentId: "EA-4003", patientId: "ES-3001", date: pastDate(120), startTime: "14:00", endTime: "15:30",
          duration: 90, status: "Completed", operatory: "Op 3", providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD",
          procedureCodes: ["D2391", "D2392"], description: "Composite Restorations #4-MOD, #5-DO",
          notes: "Two posterior composites placed. Shade A2. Patient tolerated well.", appointmentType: "Restorative", confirmed: true,
        },
        {
          appointmentId: "EA-4004", patientId: "ES-3001", date: pastDate(45), startTime: "09:00", endTime: "10:30",
          duration: 90, status: "Completed", operatory: "Op 3", providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD",
          procedureCodes: ["D6010", "D6058", "D6059"], description: "Implant Placement and Provisional - Site #30",
          notes: "Nobel Active implant 4.3x11.5mm placed in site #30. Primary stability achieved. ISQ 72. Healing abutment placed. Post-op instructions given.",
          appointmentType: "Surgical", confirmed: true,
        },
      ],
      procedures: [
        { procedureId: "EP-5001", patientId: "ES-3001", serviceDate: pastDate(180), status: "Completed", adaCode: "D1110", description: "Prophylaxis - Adult", toothNumber: "", surfaces: "", fee: 140.0, insurancePayment: 112.0, patientPayment: 28.0, adjustments: 0, balance: 0, providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS", notes: "Light calculus. Good home care.", quadrant: "", arch: "" },
        { procedureId: "EP-5002", patientId: "ES-3001", serviceDate: pastDate(180), status: "Completed", adaCode: "D0120", description: "Periodic Oral Evaluation", toothNumber: "", surfaces: "", fee: 62.0, insurancePayment: 49.6, patientPayment: 12.4, adjustments: 0, balance: 0, providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS", notes: "All tissues normal. Decay noted on #4 mesial and #5 distal.", quadrant: "", arch: "" },
        { procedureId: "EP-5003", patientId: "ES-3001", serviceDate: pastDate(120), status: "Completed", adaCode: "D2391", description: "Resin Composite - 1 Surface, Posterior", toothNumber: "4", surfaces: "MOD", fee: 245.0, insurancePayment: 196.0, patientPayment: 49.0, adjustments: 0, balance: 0, providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD", notes: "Caries excavated. Selective etch. Composite placed and polished. Shade A2.", quadrant: "UR", arch: "Upper" },
        { procedureId: "EP-5004", patientId: "ES-3001", serviceDate: pastDate(120), status: "Completed", adaCode: "D2392", description: "Resin Composite - 2 Surfaces, Posterior", toothNumber: "5", surfaces: "DO", fee: 310.0, insurancePayment: 248.0, patientPayment: 62.0, adjustments: 0, balance: 0, providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD", notes: "Deep distal caries. Liner placed. Composite restoration. Good contour.", quadrant: "UR", arch: "Upper" },
        { procedureId: "EP-5005", patientId: "ES-3001", serviceDate: pastDate(45), status: "Completed", adaCode: "D6010", description: "Surgical Placement - Endosteal Implant", toothNumber: "30", surfaces: "", fee: 2200.0, insurancePayment: 1100.0, patientPayment: 1100.0, adjustments: 0, balance: 0, providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD", notes: "Nobel Active 4.3x11.5mm. Torque 35Ncm. ISQ 72. Primary stability excellent.", quadrant: "LR", arch: "Lower" },
        { procedureId: "EP-5006", patientId: "ES-3001", serviceDate: pastDate(0), status: "Planned", adaCode: "D1110", description: "Prophylaxis - Adult", toothNumber: "", surfaces: "", fee: 140.0, insurancePayment: 112.0, patientPayment: 28.0, adjustments: 0, balance: 0, providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS", notes: "", quadrant: "", arch: "" },
        { procedureId: "EP-5007", patientId: "ES-3001", serviceDate: pastDate(0), status: "Planned", adaCode: "D0274", description: "Bitewings - Four Films", toothNumber: "", surfaces: "", fee: 75.0, insurancePayment: 60.0, patientPayment: 15.0, adjustments: 0, balance: 0, providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS", notes: "", quadrant: "", arch: "" },
        { procedureId: "EP-5008", patientId: "ES-3001", serviceDate: pastDate(0), status: "Planned", adaCode: "D6058", description: "Abutment Supported Porcelain/Ceramic Crown", toothNumber: "30", surfaces: "", fee: 1450.0, insurancePayment: 725.0, patientPayment: 725.0, adjustments: 0, balance: 0, providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD", notes: "Implant crown after healing period (4 months).", quadrant: "LR", arch: "Lower" },
      ],
      treatmentPlans: [
        {
          planId: "TP-6001", patientId: "ES-3001", dateCreated: pastDate(180), planName: "Comprehensive Restorative & Implant Plan",
          status: "Active", totalEstimate: 4622.0, insuranceEstimate: 2602.6, patientEstimate: 2019.4,
          phases: [
            { phaseId: "PH-1", phaseName: "Phase 1: Restorative", priority: 1, procedures: [], phaseTotal: 555.0 },
            { phaseId: "PH-2", phaseName: "Phase 2: Implant Surgery", priority: 2, procedures: [], phaseTotal: 2200.0 },
            { phaseId: "PH-3", phaseName: "Phase 3: Implant Crown", priority: 3, procedures: [], phaseTotal: 1450.0 },
            { phaseId: "PH-4", phaseName: "Phase 4: Preventive Maintenance", priority: 4, procedures: [], phaseTotal: 417.0 },
          ],
          notes: "Phase 1 complete. Phase 2 complete. Phase 3 pending implant healing (4 months from surgery). Phase 4 ongoing.",
        },
      ],
      perioExams: [
        {
          examId: "PE-7001", patientId: "ES-3001", examDate: pastDate(180), providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS",
          examType: "Comprehensive",
          readings: [
            { toothNumber: 3, site: "MB", probingDepth: 3, gingivalMargin: 0, clinicalAttachment: 3, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 3, site: "B", probingDepth: 2, gingivalMargin: 0, clinicalAttachment: 2, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 3, site: "DB", probingDepth: 3, gingivalMargin: 0, clinicalAttachment: 3, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 4, site: "MB", probingDepth: 2, gingivalMargin: 0, clinicalAttachment: 2, bleeding: false, plaque: true, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 4, site: "B", probingDepth: 2, gingivalMargin: 0, clinicalAttachment: 2, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 14, site: "MB", probingDepth: 3, gingivalMargin: 0, clinicalAttachment: 3, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 14, site: "DB", probingDepth: 3, gingivalMargin: 0, clinicalAttachment: 3, bleeding: true, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 19, site: "MB", probingDepth: 3, gingivalMargin: 0, clinicalAttachment: 3, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
            { toothNumber: 19, site: "B", probingDepth: 2, gingivalMargin: 0, clinicalAttachment: 2, bleeding: false, plaque: false, furcation: 0, mobility: 0, suppuration: false },
          ],
          summary: { totalSites: 168, sitesOver4mm: 2, sitesOver6mm: 0, bleedingPercentage: 8, plaquePercentage: 12 },
        },
      ],
      clinicalNotes: [
        {
          noteId: "CN-8001", patientId: "ES-3001", noteDate: pastDate(180), providerId: "PR-201", providerName: "Dr. Lisa Patel, DDS",
          category: "Progress Note", subject: "Periodic Exam & Prophylaxis",
          content: "Patient presents for 6-month recall. Chief complaint: none. Medical history reviewed - no changes. Extra/intraoral exam: WNL. Periodontal exam: generally healthy, localized bleeding LR. Prophylaxis completed. Caries noted #4M, #5D on BWX. Treatment plan discussed. Patient accepts restorative tx.",
          signedBy: "Dr. Lisa Patel, DDS", signedDate: pastDate(180), locked: true,
        },
        {
          noteId: "CN-8002", patientId: "ES-3001", noteDate: pastDate(120), providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD",
          category: "Operative Note", subject: "Composite Restorations #4, #5",
          content: "Anesthesia: 1.7mL 4% articaine w/ 1:100k epi, PSA block + infiltration. Isolation: Isolite. #4 MOD: Caries removed, no pulpal exposure, selective etch technique, OptiBond Solo Plus, Filtek Supreme Ultra A2B shade, cured in 2mm increments, adjusted occlusion, polished. #5 DO: Same protocol. Deep distal box - TheraCal liner over near-exposure. Both restorations show excellent marginal adaptation.",
          signedBy: "Dr. Mark Rivera, DMD", signedDate: pastDate(120), locked: true,
        },
        {
          noteId: "CN-8003", patientId: "ES-3001", noteDate: pastDate(45), providerId: "PR-202", providerName: "Dr. Mark Rivera, DMD",
          category: "Surgical Note", subject: "Implant Placement #30",
          content: "Consent reviewed. Anesthesia: IAN block + long buccal w/ 2% lido 1:100k. Full-thickness flap reflected. Osteotomy per Nobel protocol: 2.0mm pilot, 3.2mm, 3.6mm, 4.3mm final. Nobel Active RP 4.3x11.5mm seated at 35Ncm. ISQ 72 (Osstell). Cover screw placed. Site grafted with Bio-Oss particulate + collagen membrane. Primary closure achieved with 4-0 Chromic gut. Post-op: Amoxicillin 500mg TID x7d, Ibuprofen 600mg Q6H PRN, CHX rinse BID x2wk. Follow-up 1 week.",
          signedBy: "Dr. Mark Rivera, DMD", signedDate: pastDate(45), locked: true,
        },
      ],
      insurance: [
        {
          planId: "INS-9001", patientId: "ES-3001", subscriberId: "MC-442789156", carrierName: "MetLife Dental",
          carrierPhone: "1-800-942-0854", groupNumber: "ML-8800", groupName: "TechCorp Employee Plan",
          planType: "PPO", effectiveDate: "2025-01-01", renewalDate: "2026-01-01",
          annualMax: 2500.0, annualUsed: 1705.6, annualRemaining: 794.4,
          deductible: 75.0, deductibleMet: 75.0, orthoMax: 0, orthoUsed: 0,
          preventiveCoverage: 100, basicCoverage: 80, majorCoverage: 50,
          relationship: "Self",
        },
      ],
      images: [
        { imageId: "IM-10001", patientId: "ES-3001", captureDate: pastDate(180), imageType: "Radiograph", description: "Bitewing Radiographs - Right", toothNumbers: ["2", "3", "4", "5"], mountName: "BWX Mount", notes: "Mesial caries #4 visible. Distal caries #5 with proximity to pulp.", category: "Diagnostic", fileSize: "2.4 MB" },
        { imageId: "IM-10002", patientId: "ES-3001", captureDate: pastDate(180), imageType: "Radiograph", description: "Bitewing Radiographs - Left", toothNumbers: ["12", "13", "14", "15"], mountName: "BWX Mount", notes: "No interproximal caries. Existing restorations intact.", category: "Diagnostic", fileSize: "2.3 MB" },
        { imageId: "IM-10003", patientId: "ES-3001", captureDate: pastDate(180), imageType: "Radiograph", description: "Panoramic Radiograph", toothNumbers: [], mountName: "Pano", notes: "Missing #30. Adequate bone height for implant. No pathology noted.", category: "Diagnostic", fileSize: "5.1 MB" },
        { imageId: "IM-10004", patientId: "ES-3001", captureDate: pastDate(45), imageType: "Radiograph", description: "Periapical - Implant Site #30", toothNumbers: ["30"], mountName: "PA Mount", notes: "Post-op PA showing Nobel Active implant in good position. Adequate bone around fixture.", category: "Surgical", fileSize: "1.8 MB" },
        { imageId: "IM-10005", patientId: "ES-3001", captureDate: pastDate(45), imageType: "CBCT Slice", description: "CBCT Cross-Section - Site #30 Pre-Op", toothNumbers: ["30"], mountName: "3D Imaging", notes: "Pre-operative CBCT showing adequate buccolingual width (9mm) and height (14mm) at site #30.", category: "Surgical", fileSize: "12.4 MB" },
        { imageId: "IM-10006", patientId: "ES-3001", captureDate: pastDate(120), imageType: "Intraoral Photo", description: "Pre-Op Photos #4, #5", toothNumbers: ["4", "5"], mountName: "Clinical Photos", notes: "Pre-operative clinical photos showing carious lesions on teeth #4 and #5.", category: "Clinical", fileSize: "3.2 MB" },
      ],
      ledger: [
        { entryId: "LE-1", patientId: "ES-3001", date: pastDate(180), type: "Charge", description: "D1110 Prophylaxis", amount: 140.0, balance: 140.0, provider: "Dr. Lisa Patel, DDS", insuranceClaim: "CLM-001" },
        { entryId: "LE-2", patientId: "ES-3001", date: pastDate(180), type: "Charge", description: "D0120 Periodic Exam", amount: 62.0, balance: 202.0, provider: "Dr. Lisa Patel, DDS", insuranceClaim: "CLM-001" },
        { entryId: "LE-3", patientId: "ES-3001", date: pastDate(170), type: "Insurance Payment", description: "MetLife - CLM-001", amount: -161.6, balance: 40.4, provider: "", insuranceClaim: "CLM-001" },
        { entryId: "LE-4", patientId: "ES-3001", date: pastDate(165), type: "Patient Payment", description: "Credit Card Payment", amount: -40.4, balance: 0, provider: "", insuranceClaim: "" },
        { entryId: "LE-5", patientId: "ES-3001", date: pastDate(120), type: "Charge", description: "D2391 Composite #4-MOD", amount: 245.0, balance: 245.0, provider: "Dr. Mark Rivera, DMD", insuranceClaim: "CLM-002" },
        { entryId: "LE-6", patientId: "ES-3001", date: pastDate(120), type: "Charge", description: "D2392 Composite #5-DO", amount: 310.0, balance: 555.0, provider: "Dr. Mark Rivera, DMD", insuranceClaim: "CLM-002" },
        { entryId: "LE-7", patientId: "ES-3001", date: pastDate(110), type: "Insurance Payment", description: "MetLife - CLM-002", amount: -444.0, balance: 111.0, provider: "", insuranceClaim: "CLM-002" },
        { entryId: "LE-8", patientId: "ES-3001", date: pastDate(105), type: "Patient Payment", description: "Check Payment", amount: -111.0, balance: 0, provider: "", insuranceClaim: "" },
        { entryId: "LE-9", patientId: "ES-3001", date: pastDate(45), type: "Charge", description: "D6010 Implant Placement #30", amount: 2200.0, balance: 2200.0, provider: "Dr. Mark Rivera, DMD", insuranceClaim: "CLM-003" },
        { entryId: "LE-10", patientId: "ES-3001", date: pastDate(35), type: "Insurance Payment", description: "MetLife - CLM-003", amount: -1100.0, balance: 1100.0, provider: "", insuranceClaim: "CLM-003" },
        { entryId: "LE-11", patientId: "ES-3001", date: pastDate(30), type: "Patient Payment", description: "Payment Plan - Installment 1", amount: -366.67, balance: 733.33, provider: "", insuranceClaim: "" },
      ],
    };
  },
};
