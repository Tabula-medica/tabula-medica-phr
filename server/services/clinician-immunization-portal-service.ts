import { logPhiAccess } from "../security/hipaa-audit";
import { stateIISConnectorService } from "./state-iis-connector-service";
import vaccineRulesEngineV2 from "./vaccine-rules-engine-v2";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and recorded history. This is NOT medical advice. Clinical judgment should always be applied.";

export type ClinicianRole = "physician" | "nurse_practitioner" | "registered_nurse" | "pharmacist" | "medical_assistant" | "admin";
export type RecordVerificationStatus = "unverified" | "clinician_verified" | "iis_verified" | "patient_reported" | "discrepancy";
export type ConsentStatus = "granted" | "pending" | "denied" | "expired" | "withdrawn";
export type ReportFormat = "pdf" | "fhir_bundle" | "csv" | "hl7";
export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface ClinicianProfile {
  id: string;
  userId: string;
  name: string;
  credentials: string[];
  npiNumber?: string;
  role: ClinicianRole;
  organizationId: string;
  organizationName: string;
  licenseState: string;
  licenseNumber: string;
  specialties: string[];
  canVerifyRecords: boolean;
  canEditRecords: boolean;
  canConnectIIS: boolean;
  canGenerateReports: boolean;
  canCommunicatePatients: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface PatientAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

export interface PatientImmunizationProfile {
  patientId: string;
  profileId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mrn?: string;
  address?: PatientAddress;
  addressHistory?: PatientAddress[];
  phone?: string;
  email?: string;
  primaryCareProvider?: string;
  insuranceInfo?: {
    provider: string;
    memberId: string;
    groupNumber?: string;
  };
  immunizationHistory: ImmunizationRecord[];
  vaccineScheduleStatus: VaccineScheduleStatus[];
  iisConsentStatus: IISConsentRecord[];
  lastUpdatedAt: string;
}

export interface AutoIISDetectionResult {
  patientId: string;
  detectedStates: {
    stateCode: string;
    stateName: string;
    registryName: string;
    source: "current_address" | "address_history" | "birth_state" | "insurance_region";
    confidence: "high" | "medium" | "low";
    hasConsent: boolean;
    consentId?: string;
    consentStatus?: ConsentStatus;
    connectorStatus: "available" | "unavailable" | "connected";
    features: {
      queryByPatient: boolean;
      historyRetrieval: boolean;
      forecastSupport: boolean;
    };
    recommendation: "connect" | "request_consent" | "already_connected" | "unavailable";
    estimatedRecords?: number;
  }[];
  suggestedPrimaryState: string;
  totalStatesDetected: number;
  disclaimer: string;
}

export interface ImmunizationRecord {
  id: string;
  patientId: string;
  profileId: string;
  vaccineCode: string;
  vaccineName: string;
  vaccineGroup: string;
  lotNumber?: string;
  expirationDate?: string;
  manufacturerCode?: string;
  manufacturerName?: string;
  administeredDate: string;
  administeredBy?: string;
  administeringClinicianId?: string;
  site?: string;
  route?: string;
  doseSequence?: number;
  doseQuantity?: number;
  doseUnit?: string;
  verificationStatus: RecordVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  iisVerificationId?: string;
  source: "manual_entry" | "ehr_import" | "iis_sync" | "patient_reported" | "fhir_import";
  sourceDetails?: string;
  notes?: string;
  reaction?: {
    type: string;
    severity: "mild" | "moderate" | "severe";
    description: string;
    reportedDate: string;
  };
  contraindications?: string[];
  status: "completed" | "entered-in-error" | "not-done";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface VaccineScheduleStatus {
  vaccineGroup: string;
  vaccineName: string;
  status: "up_to_date" | "due" | "overdue" | "not_applicable" | "contraindicated";
  dosesReceived: number;
  dosesRequired: number;
  nextDoseDate?: string;
  catchUpRequired: boolean;
  catchUpDetails?: {
    dosesNeeded: number;
    minimumIntervalDays: number;
    recommendedIntervalDays: number;
    ageRangeMonths: { start: number; end: number };
  };
  lastDoseDate?: string;
  notes?: string;
}

export interface IISConsentRecord {
  id: string;
  patientId: string;
  profileId: string;
  stateCode: string;
  stateName: string;
  consentType: "query" | "submit" | "both";
  status: ConsentStatus;
  grantedBy: string;
  grantedByRole: "patient" | "parent_guardian" | "legal_representative";
  grantedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
  clinicianId: string;
  clinicianName: string;
  organizationId: string;
  notes?: string;
  documentId?: string;
}

export interface ImmunizationReportRequest {
  patientId: string;
  profileId: string;
  reportType: "full_history" | "school_form" | "daycare_form" | "travel" | "employer" | "healthcare_system" | "custom";
  format: ReportFormat;
  dateRange?: { startDate: string; endDate: string };
  vaccineGroups?: string[];
  includeScheduleStatus: boolean;
  includeRecommendations: boolean;
  includeConsentHistory: boolean;
  recipientInfo?: {
    name: string;
    organization: string;
    address?: string;
    faxNumber?: string;
    email?: string;
  };
  requestedBy: string;
  requestedAt: string;
}

export interface ImmunizationReport {
  id: string;
  request: ImmunizationReportRequest;
  patientName: string;
  dateOfBirth: string;
  generatedAt: string;
  generatedBy: string;
  status: "pending" | "generating" | "completed" | "failed" | "delivered";
  content?: {
    summary: {
      totalVaccinations: number;
      vaccineGroupsComplete: number;
      vaccineGroupsDue: number;
      lastVaccinationDate?: string;
    };
    immunizations: ImmunizationRecord[];
    scheduleStatus: VaccineScheduleStatus[];
    recommendations?: string[];
    disclaimer: string;
  };
  deliveryStatus?: "not_sent" | "sent" | "delivered" | "failed";
  deliveredAt?: string;
  downloadUrl?: string;
  expiresAt: string;
}

export interface PatientImmunizationMessage {
  id: string;
  patientId: string;
  profileId: string;
  clinicianId: string;
  clinicianName: string;
  subject: string;
  content: string;
  messageType: "reminder" | "education" | "appointment" | "alert" | "general";
  priority: MessagePriority;
  relatedVaccines?: string[];
  status: "draft" | "sent" | "delivered" | "read" | "archived";
  sentAt?: string;
  readAt?: string;
  requiresResponse: boolean;
  responseDeadline?: string;
  response?: {
    content: string;
    respondedAt: string;
    respondedBy: string;
  };
  attachments?: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
  createdAt: string;
}

export interface IISConnectionRequest {
  patientId: string;
  profileId: string;
  stateCode: string;
  connectionType: "query" | "submit" | "both";
  clinicianId: string;
  consentId: string;
  priority: "normal" | "urgent";
}

export interface IISConnectionResult {
  requestId: string;
  patientId: string;
  stateCode: string;
  status: "success" | "partial" | "failed" | "pending";
  recordsFound: number;
  recordsImported: number;
  discrepanciesFound: number;
  discrepancies: {
    field: string;
    localValue: string;
    iisValue: string;
    resolution?: string;
  }[];
  completedAt?: string;
  errorMessage?: string;
}

const clinicianProfiles = new Map<string, ClinicianProfile>();
const patientProfiles = new Map<string, PatientImmunizationProfile>();
const immunizationRecords = new Map<string, ImmunizationRecord[]>();
const iisConsents = new Map<string, IISConsentRecord[]>();
const reports = new Map<string, ImmunizationReport>();
const messages = new Map<string, PatientImmunizationMessage[]>();
const iisConnectionResults = new Map<string, IISConnectionResult>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function initializeSampleData(): void {
  const clinician1: ClinicianProfile = {
    id: "clin-001",
    userId: "user-clin-001",
    name: "Dr. Sarah Chen",
    credentials: ["MD", "FAAP"],
    npiNumber: "1234567890",
    role: "physician",
    organizationId: "org-001",
    organizationName: "Valley Pediatrics",
    licenseState: "CA",
    licenseNumber: "A123456",
    specialties: ["Pediatrics", "Preventive Medicine"],
    canVerifyRecords: true,
    canEditRecords: true,
    canConnectIIS: true,
    canGenerateReports: true,
    canCommunicatePatients: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
  clinicianProfiles.set(clinician1.id, clinician1);

  const clinician2: ClinicianProfile = {
    id: "clin-002",
    userId: "user-clin-002",
    name: "Jennifer Martinez, RN",
    credentials: ["RN", "BSN"],
    role: "registered_nurse",
    organizationId: "org-001",
    organizationName: "Valley Pediatrics",
    licenseState: "CA",
    licenseNumber: "RN789012",
    specialties: ["Immunization Coordinator"],
    canVerifyRecords: false,
    canEditRecords: true,
    canConnectIIS: true,
    canGenerateReports: true,
    canCommunicatePatients: true,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  };
  clinicianProfiles.set(clinician2.id, clinician2);

  const patient1: PatientImmunizationProfile = {
    patientId: "pat-001",
    profileId: "prof-001",
    fullName: "Emma Johnson",
    dateOfBirth: "2020-03-15",
    gender: "female",
    mrn: "MRN-12345",
    address: {
      street: "123 Oak Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      isCurrent: true,
      startDate: "2022-06-01",
    },
    addressHistory: [
      {
        street: "456 Pine Avenue",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85001",
        startDate: "2020-03-15",
        endDate: "2022-05-31",
        isCurrent: false,
      },
      {
        street: "789 Elm Drive",
        city: "Denver",
        state: "CO",
        zipCode: "80202",
        startDate: "2019-01-15",
        endDate: "2020-03-14",
        isCurrent: false,
      },
    ],
    phone: "415-555-0123",
    email: "johnson.family@example.com",
    primaryCareProvider: "Dr. Sarah Chen",
    insuranceInfo: {
      provider: "Blue Shield",
      memberId: "BSC123456789",
      groupNumber: "GRP001",
    },
    immunizationHistory: [],
    vaccineScheduleStatus: [],
    iisConsentStatus: [],
    lastUpdatedAt: new Date().toISOString(),
  };
  patientProfiles.set(patient1.patientId, patient1);

  const records1: ImmunizationRecord[] = [
    {
      id: "imm-001",
      patientId: "pat-001",
      profileId: "prof-001",
      vaccineCode: "03",
      vaccineName: "MMR",
      vaccineGroup: "MMR",
      lotNumber: "M12345A",
      manufacturerCode: "MSD",
      manufacturerName: "Merck Sharp & Dohme",
      administeredDate: "2021-03-15",
      administeredBy: "Dr. Sarah Chen",
      administeringClinicianId: "clin-001",
      site: "left_thigh",
      route: "intramuscular",
      doseSequence: 1,
      verificationStatus: "iis_verified",
      verifiedBy: "clin-001",
      verifiedAt: "2021-03-15T10:00:00Z",
      iisVerificationId: "iis-ver-001",
      source: "ehr_import",
      status: "completed",
      createdAt: "2021-03-15T10:00:00Z",
      updatedAt: "2021-03-15T10:00:00Z",
      createdBy: "clin-001",
    },
    {
      id: "imm-002",
      patientId: "pat-001",
      profileId: "prof-001",
      vaccineCode: "20",
      vaccineName: "DTaP",
      vaccineGroup: "DTaP",
      lotNumber: "D67890B",
      manufacturerCode: "SKB",
      manufacturerName: "GlaxoSmithKline",
      administeredDate: "2020-05-15",
      administeredBy: "Dr. Sarah Chen",
      administeringClinicianId: "clin-001",
      site: "right_thigh",
      route: "intramuscular",
      doseSequence: 1,
      verificationStatus: "clinician_verified",
      verifiedBy: "clin-001",
      verifiedAt: "2020-05-15T09:30:00Z",
      source: "manual_entry",
      status: "completed",
      createdAt: "2020-05-15T09:30:00Z",
      updatedAt: "2020-05-15T09:30:00Z",
      createdBy: "clin-001",
    },
    {
      id: "imm-003",
      patientId: "pat-001",
      profileId: "prof-001",
      vaccineCode: "20",
      vaccineName: "DTaP",
      vaccineGroup: "DTaP",
      lotNumber: "D67891C",
      manufacturerCode: "SKB",
      manufacturerName: "GlaxoSmithKline",
      administeredDate: "2020-07-15",
      administeredBy: "Jennifer Martinez, RN",
      administeringClinicianId: "clin-002",
      site: "left_thigh",
      route: "intramuscular",
      doseSequence: 2,
      verificationStatus: "clinician_verified",
      verifiedBy: "clin-001",
      verifiedAt: "2020-07-16T11:00:00Z",
      source: "manual_entry",
      status: "completed",
      createdAt: "2020-07-15T14:00:00Z",
      updatedAt: "2020-07-16T11:00:00Z",
      createdBy: "clin-002",
      updatedBy: "clin-001",
    },
    {
      id: "imm-004",
      patientId: "pat-001",
      profileId: "prof-001",
      vaccineCode: "08",
      vaccineName: "Hepatitis B",
      vaccineGroup: "HepB",
      lotNumber: "HB12345",
      manufacturerCode: "MSD",
      manufacturerName: "Merck Sharp & Dohme",
      administeredDate: "2020-03-15",
      administeredBy: "Hospital Staff",
      site: "right_thigh",
      route: "intramuscular",
      doseSequence: 1,
      verificationStatus: "patient_reported",
      source: "patient_reported",
      sourceDetails: "Birth dose reported by parent",
      status: "completed",
      createdAt: "2020-04-01T10:00:00Z",
      updatedAt: "2020-04-01T10:00:00Z",
      createdBy: "system",
    },
  ];
  immunizationRecords.set("pat-001", records1);

  const scheduleStatus1: VaccineScheduleStatus[] = [
    {
      vaccineGroup: "MMR",
      vaccineName: "Measles, Mumps, Rubella",
      status: "due",
      dosesReceived: 1,
      dosesRequired: 2,
      nextDoseDate: "2024-03-15",
      catchUpRequired: false,
      lastDoseDate: "2021-03-15",
      notes: "Second dose recommended at 4-6 years of age",
    },
    {
      vaccineGroup: "DTaP",
      vaccineName: "Diphtheria, Tetanus, Pertussis",
      status: "overdue",
      dosesReceived: 2,
      dosesRequired: 5,
      catchUpRequired: true,
      catchUpDetails: {
        dosesNeeded: 3,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 56,
        ageRangeMonths: { start: 12, end: 84 },
      },
      lastDoseDate: "2020-07-15",
      notes: "Catch-up schedule recommended",
    },
    {
      vaccineGroup: "HepB",
      vaccineName: "Hepatitis B",
      status: "up_to_date",
      dosesReceived: 1,
      dosesRequired: 3,
      nextDoseDate: "2020-04-15",
      catchUpRequired: false,
      lastDoseDate: "2020-03-15",
    },
    {
      vaccineGroup: "Polio",
      vaccineName: "Inactivated Poliovirus",
      status: "overdue",
      dosesReceived: 0,
      dosesRequired: 4,
      catchUpRequired: true,
      catchUpDetails: {
        dosesNeeded: 4,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 56,
        ageRangeMonths: { start: 2, end: 216 },
      },
    },
  ];
  patient1.vaccineScheduleStatus = scheduleStatus1;
  patient1.immunizationHistory = records1;

  const consent1: IISConsentRecord = {
    id: "consent-001",
    patientId: "pat-001",
    profileId: "prof-001",
    stateCode: "CA",
    stateName: "California",
    consentType: "both",
    status: "granted",
    grantedBy: "Parent/Guardian",
    grantedByRole: "parent_guardian",
    grantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
    clinicianId: "clin-001",
    clinicianName: "Dr. Sarah Chen",
    organizationId: "org-001",
  };
  iisConsents.set("pat-001", [consent1]);
  patient1.iisConsentStatus = [consent1];

  const message1: PatientImmunizationMessage = {
    id: "msg-001",
    patientId: "pat-001",
    profileId: "prof-001",
    clinicianId: "clin-001",
    clinicianName: "Dr. Sarah Chen",
    subject: "Immunization Update Needed",
    content: "Dear Johnson Family,\n\nThis is a reminder that Emma is due for several vaccinations based on the CDC recommended schedule. We noticed that the DTaP series and Polio vaccinations need to be caught up. Please schedule an appointment at your earliest convenience.\n\nBest regards,\nDr. Sarah Chen\nValley Pediatrics",
    messageType: "reminder",
    priority: "normal",
    relatedVaccines: ["DTaP", "Polio"],
    status: "sent",
    sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    requiresResponse: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  messages.set("pat-001", [message1]);

  console.log("[ClinicianImmunizationPortal] Sample data initialized");
}

initializeSampleData();

class ClinicianImmunizationPortalService {
  getClinicianProfile(clinicianId: string, userId: string): ClinicianProfile | null {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ClinicianProfile",
      resourceId: clinicianId,
      details: "Retrieved clinician profile",
    });
    return clinicianProfiles.get(clinicianId) || null;
  }

  getAllClinicians(userId: string, organizationId?: string): ClinicianProfile[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ClinicianProfiles",
      resourceId: organizationId || "all",
      details: `Listed clinicians${organizationId ? ` for organization ${organizationId}` : ""}`,
    });
    
    const clinicians = Array.from(clinicianProfiles.values());
    if (organizationId) {
      return clinicians.filter(c => c.organizationId === organizationId);
    }
    return clinicians;
  }

  getPatientImmunizationProfile(
    patientId: string, 
    clinicianId: string, 
    userId: string
  ): PatientImmunizationProfile | null {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientImmunizationProfile",
      resourceId: patientId,
      details: `Clinician ${clinicianId} accessed patient immunization profile`,
    });

    const profile = patientProfiles.get(patientId);
    if (!profile) return null;

    const records = immunizationRecords.get(patientId) || [];
    const consents = iisConsents.get(patientId) || [];
    
    return {
      ...profile,
      immunizationHistory: records,
      iisConsentStatus: consents,
    };
  }

  searchPatients(
    query: string,
    clinicianId: string,
    userId: string,
    filters?: {
      overdue?: boolean;
      needsCatchUp?: boolean;
      hasIISConsent?: boolean;
    }
  ): PatientImmunizationProfile[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientSearch",
      resourceId: "search",
      details: `Clinician ${clinicianId} searched patients with query: ${query}`,
    });

    const queryLower = query.toLowerCase();
    let results = Array.from(patientProfiles.values()).filter(p => 
      p.fullName.toLowerCase().includes(queryLower) ||
      p.mrn?.toLowerCase().includes(queryLower) ||
      p.email?.toLowerCase().includes(queryLower)
    );

    if (filters?.overdue) {
      results = results.filter(p => 
        p.vaccineScheduleStatus.some(s => s.status === "overdue")
      );
    }

    if (filters?.needsCatchUp) {
      results = results.filter(p =>
        p.vaccineScheduleStatus.some(s => s.catchUpRequired)
      );
    }

    if (filters?.hasIISConsent) {
      results = results.filter(p =>
        p.iisConsentStatus.some(c => c.status === "granted")
      );
    }

    return results.map(p => ({
      ...p,
      immunizationHistory: immunizationRecords.get(p.patientId) || [],
      iisConsentStatus: iisConsents.get(p.patientId) || [],
    }));
  }

  getPatientImmunizationHistory(
    patientId: string,
    clinicianId: string,
    userId: string,
    filters?: {
      vaccineGroup?: string;
      startDate?: string;
      endDate?: string;
      verificationStatus?: RecordVerificationStatus;
    }
  ): ImmunizationRecord[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationHistory",
      resourceId: patientId,
      details: `Clinician ${clinicianId} accessed immunization history`,
    });

    let records = immunizationRecords.get(patientId) || [];

    if (filters?.vaccineGroup) {
      records = records.filter(r => r.vaccineGroup === filters.vaccineGroup);
    }

    if (filters?.startDate) {
      records = records.filter(r => r.administeredDate >= filters.startDate!);
    }

    if (filters?.endDate) {
      records = records.filter(r => r.administeredDate <= filters.endDate!);
    }

    if (filters?.verificationStatus) {
      records = records.filter(r => r.verificationStatus === filters.verificationStatus);
    }

    return records.sort((a, b) => 
      new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime()
    );
  }

  addImmunizationRecord(
    record: Omit<ImmunizationRecord, "id" | "createdAt" | "updatedAt">,
    clinicianId: string,
    userId: string
  ): ImmunizationRecord {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canEditRecords) {
      throw new Error("Clinician does not have permission to add immunization records");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationRecord",
      resourceId: record.patientId,
      details: `Clinician ${clinicianId} added immunization record for ${record.vaccineName}`,
    });

    const newRecord: ImmunizationRecord = {
      ...record,
      id: generateId("imm"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: clinicianId,
    };

    const patientRecords = immunizationRecords.get(record.patientId) || [];
    patientRecords.push(newRecord);
    immunizationRecords.set(record.patientId, patientRecords);

    this.updatePatientScheduleStatus(record.patientId);

    return newRecord;
  }

  editImmunizationRecord(
    recordId: string,
    patientId: string,
    updates: Partial<ImmunizationRecord>,
    clinicianId: string,
    userId: string
  ): ImmunizationRecord | null {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canEditRecords) {
      throw new Error("Clinician does not have permission to edit immunization records");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationRecord",
      resourceId: `${patientId}/${recordId}`,
      details: `Clinician ${clinicianId} edited immunization record`,
    });

    const patientRecords = immunizationRecords.get(patientId);
    if (!patientRecords) return null;

    const recordIndex = patientRecords.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return null;

    const updatedRecord: ImmunizationRecord = {
      ...patientRecords[recordIndex],
      ...updates,
      id: recordId,
      patientId,
      updatedAt: new Date().toISOString(),
      updatedBy: clinicianId,
    };

    patientRecords[recordIndex] = updatedRecord;
    immunizationRecords.set(patientId, patientRecords);

    this.updatePatientScheduleStatus(patientId);

    return updatedRecord;
  }

  verifyImmunizationRecord(
    recordId: string,
    patientId: string,
    clinicianId: string,
    userId: string,
    verificationNotes?: string
  ): ImmunizationRecord | null {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canVerifyRecords) {
      throw new Error("Clinician does not have permission to verify immunization records");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationVerification",
      resourceId: `${patientId}/${recordId}`,
      details: `Clinician ${clinicianId} verified immunization record`,
    });

    const patientRecords = immunizationRecords.get(patientId);
    if (!patientRecords) return null;

    const recordIndex = patientRecords.findIndex(r => r.id === recordId);
    if (recordIndex === -1) return null;

    const verifiedRecord: ImmunizationRecord = {
      ...patientRecords[recordIndex],
      verificationStatus: "clinician_verified",
      verifiedBy: clinicianId,
      verifiedAt: new Date().toISOString(),
      notes: verificationNotes 
        ? `${patientRecords[recordIndex].notes || ""}\nVerification: ${verificationNotes}`.trim()
        : patientRecords[recordIndex].notes,
      updatedAt: new Date().toISOString(),
      updatedBy: clinicianId,
    };

    patientRecords[recordIndex] = verifiedRecord;
    immunizationRecords.set(patientId, patientRecords);

    return verifiedRecord;
  }

  recordIISConsent(
    consent: Omit<IISConsentRecord, "id" | "grantedAt">,
    clinicianId: string,
    userId: string
  ): IISConsentRecord {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canConnectIIS) {
      throw new Error("Clinician does not have permission to manage IIS consents");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IISConsent",
      resourceId: `${consent.patientId}/${consent.stateCode}`,
      details: `Clinician ${clinicianId} recorded IIS consent for state ${consent.stateCode}`,
    });

    const newConsent: IISConsentRecord = {
      ...consent,
      id: generateId("consent"),
      grantedAt: new Date().toISOString(),
    };

    const patientConsents = iisConsents.get(consent.patientId) || [];
    
    const existingIndex = patientConsents.findIndex(
      c => c.stateCode === consent.stateCode && c.status === "granted"
    );
    if (existingIndex !== -1) {
      patientConsents[existingIndex].status = "withdrawn";
      patientConsents[existingIndex].withdrawnAt = new Date().toISOString();
    }
    
    patientConsents.push(newConsent);
    iisConsents.set(consent.patientId, patientConsents);

    const patient = patientProfiles.get(consent.patientId);
    if (patient) {
      patient.iisConsentStatus = patientConsents;
    }

    return newConsent;
  }

  async connectToStateIIS(
    request: IISConnectionRequest,
    userId: string
  ): Promise<IISConnectionResult> {
    const clinician = clinicianProfiles.get(request.clinicianId);
    if (!clinician?.canConnectIIS) {
      throw new Error("Clinician does not have permission to connect to State IIS");
    }

    const patientConsents = iisConsents.get(request.patientId) || [];
    const validConsent = patientConsents.find(
      c => c.id === request.consentId && 
           c.stateCode === request.stateCode && 
           c.status === "granted" &&
           (!c.expiresAt || new Date(c.expiresAt) > new Date())
    );

    if (!validConsent) {
      throw new Error("Valid patient consent not found for this IIS connection");
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISConnection",
      resourceId: `${request.patientId}/${request.stateCode}`,
      details: `Clinician ${request.clinicianId} initiated IIS connection for state ${request.stateCode}`,
    });

    const connector = stateIISConnectorService.getConnector(request.stateCode);
    if (!connector) {
      throw new Error(`State IIS connector not available for ${request.stateCode}`);
    }

    const result: IISConnectionResult = {
      requestId: generateId("iis-conn"),
      patientId: request.patientId,
      stateCode: request.stateCode,
      status: "success",
      recordsFound: Math.floor(Math.random() * 10) + 3,
      recordsImported: 0,
      discrepanciesFound: 0,
      discrepancies: [],
      completedAt: new Date().toISOString(),
    };

    const mockIISRecords: Partial<ImmunizationRecord>[] = [
      {
        vaccineCode: "10",
        vaccineName: "IPV",
        vaccineGroup: "Polio",
        administeredDate: "2020-05-15",
        source: "iis_sync",
        verificationStatus: "iis_verified",
      },
      {
        vaccineCode: "17",
        vaccineName: "Hib",
        vaccineGroup: "Hib",
        administeredDate: "2020-05-15",
        source: "iis_sync",
        verificationStatus: "iis_verified",
      },
    ];

    const existingRecords = immunizationRecords.get(request.patientId) || [];
    
    for (const iisRecord of mockIISRecords) {
      const existing = existingRecords.find(
        r => r.vaccineCode === iisRecord.vaccineCode && 
             r.administeredDate === iisRecord.administeredDate
      );

      if (!existing) {
        const newRecord: ImmunizationRecord = {
          id: generateId("imm"),
          patientId: request.patientId,
          profileId: request.patientId.replace("pat", "prof"),
          vaccineCode: iisRecord.vaccineCode!,
          vaccineName: iisRecord.vaccineName!,
          vaccineGroup: iisRecord.vaccineGroup!,
          administeredDate: iisRecord.administeredDate!,
          source: "iis_sync",
          sourceDetails: `Imported from ${connector.registryName} (${request.stateCode})`,
          verificationStatus: "iis_verified",
          iisVerificationId: generateId("iis-ver"),
          status: "completed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: request.clinicianId,
        };
        existingRecords.push(newRecord);
        result.recordsImported++;
      }
    }

    immunizationRecords.set(request.patientId, existingRecords);
    this.updatePatientScheduleStatus(request.patientId);

    iisConnectionResults.set(result.requestId, result);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IISImport",
      resourceId: `${request.patientId}/${request.stateCode}`,
      details: `Imported ${result.recordsImported} records from ${request.stateCode} IIS`,
    });

    return result;
  }

  generateImmunizationReport(
    request: ImmunizationReportRequest,
    clinicianId: string,
    userId: string
  ): ImmunizationReport {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canGenerateReports) {
      throw new Error("Clinician does not have permission to generate reports");
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationReport",
      resourceId: request.patientId,
      details: `Clinician ${clinicianId} generated ${request.reportType} report`,
    });

    const patient = patientProfiles.get(request.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    let records = immunizationRecords.get(request.patientId) || [];

    if (request.dateRange) {
      records = records.filter(r => 
        r.administeredDate >= request.dateRange!.startDate &&
        r.administeredDate <= request.dateRange!.endDate
      );
    }

    if (request.vaccineGroups?.length) {
      records = records.filter(r => 
        request.vaccineGroups!.includes(r.vaccineGroup)
      );
    }

    records = records.sort((a, b) => 
      new Date(a.administeredDate).getTime() - new Date(b.administeredDate).getTime()
    );

    const report: ImmunizationReport = {
      id: generateId("report"),
      request,
      patientName: patient.fullName,
      dateOfBirth: patient.dateOfBirth,
      generatedAt: new Date().toISOString(),
      generatedBy: clinicianId,
      status: "completed",
      content: {
        summary: {
          totalVaccinations: records.length,
          vaccineGroupsComplete: patient.vaccineScheduleStatus.filter(s => s.status === "up_to_date").length,
          vaccineGroupsDue: patient.vaccineScheduleStatus.filter(s => s.status === "due" || s.status === "overdue").length,
          lastVaccinationDate: records.length > 0 
            ? records[records.length - 1].administeredDate 
            : undefined,
        },
        immunizations: records,
        scheduleStatus: request.includeScheduleStatus ? patient.vaccineScheduleStatus : [],
        recommendations: request.includeRecommendations 
          ? this.generateRecommendations(patient)
          : undefined,
        disclaimer: NO_CDS_DISCLAIMER,
      },
      downloadUrl: `/api/clinician-immunization-portal/reports/${generateId("report")}/download`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    reports.set(report.id, report);

    return report;
  }

  private generateRecommendations(patient: PatientImmunizationProfile): string[] {
    const recommendations: string[] = [];

    for (const status of patient.vaccineScheduleStatus) {
      if (status.status === "overdue") {
        recommendations.push(
          `${status.vaccineName}: Patient may be overdue. Consider scheduling catch-up doses.`
        );
      } else if (status.status === "due") {
        recommendations.push(
          `${status.vaccineName}: May be due${status.nextDoseDate ? ` around ${status.nextDoseDate}` : ""}.`
        );
      }

      if (status.catchUpRequired && status.catchUpDetails) {
        recommendations.push(
          `${status.vaccineName} catch-up: ${status.catchUpDetails.dosesNeeded} dose(s) may be needed ` +
          `with minimum ${status.catchUpDetails.minimumIntervalDays} day intervals.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Patient appears to be up-to-date on recommended immunizations.");
    }

    recommendations.push(NO_CDS_DISCLAIMER);

    return recommendations;
  }

  getReportById(reportId: string, userId: string): ImmunizationReport | null {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationReport",
      resourceId: reportId,
      details: "Retrieved immunization report",
    });
    return reports.get(reportId) || null;
  }

  getPatientReports(
    patientId: string,
    clinicianId: string,
    userId: string
  ): ImmunizationReport[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientReports",
      resourceId: patientId,
      details: `Clinician ${clinicianId} retrieved patient report history`,
    });

    return Array.from(reports.values())
      .filter(r => r.request.patientId === patientId)
      .sort((a, b) => 
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );
  }

  sendPatientMessage(
    message: Omit<PatientImmunizationMessage, "id" | "createdAt" | "sentAt">,
    userId: string
  ): PatientImmunizationMessage {
    const clinician = clinicianProfiles.get(message.clinicianId);
    if (!clinician?.canCommunicatePatients) {
      throw new Error("Clinician does not have permission to communicate with patients");
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PatientMessage",
      resourceId: `${message.patientId}/${message.clinicianId}`,
      details: `Clinician ${message.clinicianId} sent message to patient regarding ${message.subject}`,
    });

    const newMessage: PatientImmunizationMessage = {
      ...message,
      id: generateId("msg"),
      status: "sent",
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const patientMessages = messages.get(message.patientId) || [];
    patientMessages.push(newMessage);
    messages.set(message.patientId, patientMessages);

    return newMessage;
  }

  getPatientMessages(
    patientId: string,
    clinicianId: string,
    userId: string
  ): PatientImmunizationMessage[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientMessages",
      resourceId: patientId,
      details: `Clinician ${clinicianId} retrieved patient message history`,
    });

    return (messages.get(patientId) || [])
      .filter(m => m.clinicianId === clinicianId || true)
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  getMessageTemplates(): { id: string; name: string; subject: string; content: string; type: string }[] {
    return [
      {
        id: "tpl-reminder",
        name: "Vaccination Reminder",
        subject: "Upcoming Vaccination Reminder",
        content: "Dear [Patient/Guardian],\n\nThis is a friendly reminder that [Patient Name] may be due for vaccinations based on the CDC recommended schedule. Please contact our office to schedule an appointment.\n\nBest regards,\n[Clinician Name]",
        type: "reminder",
      },
      {
        id: "tpl-overdue",
        name: "Overdue Vaccination Notice",
        subject: "Important: Vaccination Update Needed",
        content: "Dear [Patient/Guardian],\n\nOur records indicate that [Patient Name] may be overdue for the following vaccinations: [Vaccine List]. We recommend scheduling an appointment as soon as possible to get back on track with the recommended immunization schedule.\n\nPlease contact our office at your earliest convenience.\n\nBest regards,\n[Clinician Name]",
        type: "alert",
      },
      {
        id: "tpl-education",
        name: "Vaccine Information",
        subject: "Information About Your Child's Vaccinations",
        content: "Dear [Patient/Guardian],\n\nWe wanted to provide you with educational information about the vaccines recommended for [Patient Name]. Vaccines are a safe and effective way to protect against serious diseases.\n\nIf you have any questions or concerns, please don't hesitate to contact our office.\n\nBest regards,\n[Clinician Name]",
        type: "education",
      },
    ];
  }

  private updatePatientScheduleStatus(patientId: string): void {
    const patient = patientProfiles.get(patientId);
    if (!patient) return;

    const records = immunizationRecords.get(patientId) || [];
    const birthDate = patient.dateOfBirth;

    const vaccineGroups = ["MMR", "DTaP", "HepB", "Polio", "Hib", "PCV", "Rotavirus", "HPV", "Varicella", "HepA"];
    const updatedStatus: VaccineScheduleStatus[] = [];

    for (const group of vaccineGroups) {
      const groupRecords = records.filter(r => r.vaccineGroup === group && r.status === "completed");
      const dosesReceived = groupRecords.length;
      
      const rule = vaccineRulesEngineV2.getRuleByVaccineGroup(group);
      const dosesRequired = rule?.routineSchedule?.length || 0;

      let status: VaccineScheduleStatus["status"] = "up_to_date";
      if (dosesRequired === 0) {
        status = "not_applicable";
      } else if (dosesReceived >= dosesRequired) {
        status = "up_to_date";
      } else if (dosesReceived > 0) {
        status = "due";
      } else {
        status = "overdue";
      }

      updatedStatus.push({
        vaccineGroup: group,
        vaccineName: rule?.seriesName || group,
        status,
        dosesReceived,
        dosesRequired,
        catchUpRequired: dosesReceived < dosesRequired && dosesRequired > 0,
        lastDoseDate: groupRecords.length > 0 
          ? groupRecords.sort((a, b) => 
              new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime()
            )[0].administeredDate
          : undefined,
      });
    }

    patient.vaccineScheduleStatus = updatedStatus;
    patient.lastUpdatedAt = new Date().toISOString();
  }

  getDashboardStats(clinicianId: string, userId: string): {
    totalPatients: number;
    patientsOverdue: number;
    patientsDue: number;
    patientsUpToDate: number;
    pendingVerifications: number;
    recentMessages: number;
    iisConnectionsActive: number;
  } {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ClinicianDashboard",
      resourceId: clinicianId,
      details: "Retrieved dashboard statistics",
    });

    const patients = Array.from(patientProfiles.values());
    const allRecords = Array.from(immunizationRecords.values()).flat();

    return {
      totalPatients: patients.length,
      patientsOverdue: patients.filter(p => 
        p.vaccineScheduleStatus.some(s => s.status === "overdue")
      ).length,
      patientsDue: patients.filter(p => 
        p.vaccineScheduleStatus.some(s => s.status === "due") &&
        !p.vaccineScheduleStatus.some(s => s.status === "overdue")
      ).length,
      patientsUpToDate: patients.filter(p => 
        p.vaccineScheduleStatus.every(s => 
          s.status === "up_to_date" || s.status === "not_applicable"
        )
      ).length,
      pendingVerifications: allRecords.filter(r => 
        r.verificationStatus === "unverified" || r.verificationStatus === "patient_reported"
      ).length,
      recentMessages: Array.from(messages.values())
        .flat()
        .filter(m => 
          new Date(m.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
      iisConnectionsActive: Array.from(iisConsents.values())
        .flat()
        .filter(c => c.status === "granted").length,
    };
  }

  async autoDetectIISConnections(
    patientId: string,
    clinicianId: string,
    userId: string
  ): Promise<AutoIISDetectionResult> {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canConnectIIS) {
      throw new Error("Clinician does not have permission to connect to State IIS");
    }

    const patient = patientProfiles.get(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISAutoDetection",
      resourceId: patientId,
      details: `Clinician ${clinicianId} initiated auto-detect IIS for patient ${patientId}`,
    });

    const detectedStates: AutoIISDetectionResult["detectedStates"] = [];
    const patientConsents = iisConsents.get(patientId) || [];
    const existingConnections = iisConnectionResults.get(patientId);

    if (patient.address?.state) {
      const currentStateCode = patient.address.state;
      const connector = stateIISConnectorService.getConnector(currentStateCode);
      
      if (connector) {
        const consent = patientConsents.find(
          c => c.stateCode === currentStateCode && c.status === "granted"
        );
        
        detectedStates.push({
          stateCode: currentStateCode,
          stateName: connector.stateName,
          registryName: connector.registryName,
          source: "current_address",
          confidence: "high",
          hasConsent: !!consent,
          consentId: consent?.id,
          consentStatus: consent?.status,
          connectorStatus: connector.authConfig.credentialsConfigured ? "available" : "available",
          features: {
            queryByPatient: connector.features.queryByPatient,
            historyRetrieval: connector.features.historyRetrieval,
            forecastSupport: connector.features.forecastSupport,
          },
          recommendation: consent ? "connect" : "request_consent",
          estimatedRecords: Math.floor(Math.random() * 15) + 5,
        });
      }
    }

    if (patient.addressHistory && patient.addressHistory.length > 0) {
      for (const addr of patient.addressHistory) {
        if (detectedStates.some(d => d.stateCode === addr.state)) {
          continue;
        }

        const connector = stateIISConnectorService.getConnector(addr.state);
        if (connector) {
          const consent = patientConsents.find(
            c => c.stateCode === addr.state && c.status === "granted"
          );

          const residencyDuration = addr.startDate && addr.endDate
            ? (new Date(addr.endDate).getTime() - new Date(addr.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
            : 0;
          const confidence = residencyDuration > 1 ? "high" : residencyDuration > 0.5 ? "medium" : "low";

          detectedStates.push({
            stateCode: addr.state,
            stateName: connector.stateName,
            registryName: connector.registryName,
            source: "address_history",
            confidence,
            hasConsent: !!consent,
            consentId: consent?.id,
            consentStatus: consent?.status,
            connectorStatus: connector.authConfig.credentialsConfigured ? "available" : "available",
            features: {
              queryByPatient: connector.features.queryByPatient,
              historyRetrieval: connector.features.historyRetrieval,
              forecastSupport: connector.features.forecastSupport,
            },
            recommendation: consent ? "connect" : "request_consent",
            estimatedRecords: Math.floor(Math.random() * 10) + 2,
          });
        }
      }
    }

    return {
      patientId,
      detectedStates,
      suggestedPrimaryState: patient.address?.state || detectedStates[0]?.stateCode || "",
      totalStatesDetected: detectedStates.length,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async batchConnectIIS(
    patientId: string,
    clinicianId: string,
    stateConnections: { stateCode: string; consentId: string }[],
    userId: string
  ): Promise<{
    results: IISConnectionResult[];
    totalImported: number;
    totalDiscrepancies: number;
    disclaimer: string;
  }> {
    const clinician = clinicianProfiles.get(clinicianId);
    if (!clinician?.canConnectIIS) {
      throw new Error("Clinician does not have permission to connect to State IIS");
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISBatchConnection",
      resourceId: patientId,
      details: `Clinician ${clinicianId} initiated batch IIS connection for ${stateConnections.length} states`,
    });

    const results: IISConnectionResult[] = [];
    let totalImported = 0;
    let totalDiscrepancies = 0;

    for (const conn of stateConnections) {
      try {
        const result = await this.connectToStateIIS(
          {
            patientId,
            profileId: patientId.replace("pat", "prof"),
            stateCode: conn.stateCode,
            connectionType: "query",
            clinicianId,
            consentId: conn.consentId,
            priority: "normal",
          },
          userId
        );
        results.push(result);
        totalImported += result.recordsImported;
        totalDiscrepancies += result.discrepanciesFound;
      } catch (error) {
        results.push({
          requestId: generateId("iis-conn"),
          patientId,
          stateCode: conn.stateCode,
          status: "failed",
          recordsFound: 0,
          recordsImported: 0,
          discrepanciesFound: 0,
          discrepancies: [],
          errorMessage: error instanceof Error ? error.message : "Connection failed",
        });
      }
    }

    return {
      results,
      totalImported,
      totalDiscrepancies,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async createBatchConsents(
    patientId: string,
    clinicianId: string,
    stateCodes: string[],
    userId: string
  ): Promise<IISConsentRecord[]> {
    const createdConsents: IISConsentRecord[] = [];

    for (const stateCode of stateCodes) {
      const consent = await this.createIISConsent(
        {
          patientId,
          profileId: patientId.replace("pat", "prof"),
          stateCode,
          consentType: "query_and_report",
          clinicianId,
        },
        userId
      );
      createdConsents.push(consent);
    }

    return createdConsents;
  }
}

export const clinicianImmunizationPortalService = new ClinicianImmunizationPortalService();
console.log("[ClinicianImmunizationPortal] Service initialized with patient profile, record management, IIS connection, reporting, and messaging capabilities");
