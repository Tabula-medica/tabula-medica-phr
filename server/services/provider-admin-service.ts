export interface PatientRecord {
  id: string;
  name: string;
  dob: string;
  mrn: string;
  lastUpdated: string;
  primaryPhysician: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  intakeStatus: "pending" | "completed" | "in_review";
  lastVisit: string;
  email: string;
  phone: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

export interface IntakeEntry {
  id: string;
  patientId: string;
  patientName: string;
  submittedAt: string;
  source: "in-person" | "telehealth" | "portal" | "transfer";
  sections: { name: string; status: "complete" | "incomplete" | "flagged" }[];
  flags: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  startTime: string;
  endTime: string;
  type: "checkup" | "follow-up" | "urgent" | "specialist" | "telehealth" | "procedure";
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "cancelled" | "no-show";
  location: string;
  notes: string;
}

export interface AIInsight {
  id: string;
  patientId: string;
  patientName: string;
  category: "risk-alert" | "medication-interaction" | "lab-trend" | "preventive-care" | "chronic-management";
  summary: string;
  severity: "info" | "warning" | "critical";
  confidence: number;
  generatedAt: string;
  evidenceRefs: string[];
  status: "new" | "acknowledged" | "resolved" | "dismissed";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

export interface AdminMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "stable";
  category: "patients" | "appointments" | "compliance" | "performance";
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details: string;
  ipAddress: string;
}

class ProviderAdminService {
  private patients: Map<string, PatientRecord> = new Map();
  private intakeEntries: Map<string, IntakeEntry> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private insights: Map<string, AIInsight> = new Map();
  private users: Map<string, UserAccount> = new Map();
  private metrics: AdminMetric[] = [];
  private auditEntries: AuditEntry[] = [];

  constructor() {
    this.initializeSampleData();
    console.log("[ProviderAdmin] Service initialized with sample data");
  }

  private initializeSampleData() {
    const now = new Date();

    const patientRecords: PatientRecord[] = [
      {
        id: "pat-001", name: "Eleanor Vance", dob: "1958-04-12", mrn: "MRN-100201",
        lastUpdated: new Date(now.getTime() - 3600000).toISOString(), primaryPhysician: "Dr. Sarah Smith",
        riskLevel: "high", intakeStatus: "completed", lastVisit: new Date(now.getTime() - 604800000).toISOString(),
        email: "eleanor.vance@email.com", phone: "(555) 201-3344",
        conditions: ["Type 2 Diabetes", "Hypertension", "Chronic Kidney Disease Stage 3"],
        medications: ["Metformin 1000mg", "Lisinopril 20mg", "Amlodipine 5mg"],
        allergies: ["Penicillin", "Sulfa Drugs"],
      },
      {
        id: "pat-002", name: "Marcus Chen", dob: "1990-11-03", mrn: "MRN-100202",
        lastUpdated: new Date(now.getTime() - 7200000).toISOString(), primaryPhysician: "Dr. Michael Torres",
        riskLevel: "low", intakeStatus: "completed", lastVisit: new Date(now.getTime() - 2592000000).toISOString(),
        email: "marcus.chen@email.com", phone: "(555) 302-4455",
        conditions: ["Seasonal Allergies"],
        medications: ["Cetirizine 10mg"],
        allergies: ["Latex"],
      },
      {
        id: "pat-003", name: "Priya Sharma", dob: "1975-08-21", mrn: "MRN-100203",
        lastUpdated: new Date(now.getTime() - 86400000).toISOString(), primaryPhysician: "Dr. Sarah Smith",
        riskLevel: "medium", intakeStatus: "in_review", lastVisit: new Date(now.getTime() - 1209600000).toISOString(),
        email: "priya.sharma@email.com", phone: "(555) 403-5566",
        conditions: ["Asthma", "GERD", "Anxiety Disorder"],
        medications: ["Albuterol Inhaler", "Omeprazole 20mg", "Sertraline 50mg"],
        allergies: ["Aspirin"],
      },
      {
        id: "pat-004", name: "James Holloway", dob: "1942-02-17", mrn: "MRN-100204",
        lastUpdated: new Date(now.getTime() - 1800000).toISOString(), primaryPhysician: "Dr. Rebecca Liu",
        riskLevel: "critical", intakeStatus: "completed", lastVisit: new Date(now.getTime() - 172800000).toISOString(),
        email: "james.holloway@email.com", phone: "(555) 504-6677",
        conditions: ["Congestive Heart Failure", "Atrial Fibrillation", "COPD", "Type 2 Diabetes"],
        medications: ["Warfarin 5mg", "Metoprolol 50mg", "Furosemide 40mg", "Tiotropium Inhaler", "Insulin Glargine"],
        allergies: ["Codeine", "Iodine Contrast"],
      },
      {
        id: "pat-005", name: "Sofia Rodriguez", dob: "1988-06-30", mrn: "MRN-100205",
        lastUpdated: new Date(now.getTime() - 43200000).toISOString(), primaryPhysician: "Dr. Michael Torres",
        riskLevel: "low", intakeStatus: "pending", lastVisit: new Date(now.getTime() - 7776000000).toISOString(),
        email: "sofia.rodriguez@email.com", phone: "(555) 605-7788",
        conditions: ["Migraine"],
        medications: ["Sumatriptan 50mg PRN"],
        allergies: [],
      },
      {
        id: "pat-006", name: "David Okonkwo", dob: "1965-12-08", mrn: "MRN-100206",
        lastUpdated: new Date(now.getTime() - 14400000).toISOString(), primaryPhysician: "Dr. Rebecca Liu",
        riskLevel: "high", intakeStatus: "in_review", lastVisit: new Date(now.getTime() - 259200000).toISOString(),
        email: "david.okonkwo@email.com", phone: "(555) 706-8899",
        conditions: ["Prostate Cancer (Stage II)", "Hypertension", "Osteoarthritis"],
        medications: ["Tamsulosin 0.4mg", "Losartan 50mg", "Naproxen 500mg PRN"],
        allergies: ["Shellfish"],
      },
      {
        id: "pat-007", name: "Hannah Kim", dob: "1995-03-25", mrn: "MRN-100207",
        lastUpdated: new Date(now.getTime() - 172800000).toISOString(), primaryPhysician: "Dr. Sarah Smith",
        riskLevel: "medium", intakeStatus: "completed", lastVisit: new Date(now.getTime() - 1814400000).toISOString(),
        email: "hannah.kim@email.com", phone: "(555) 807-9900",
        conditions: ["Hypothyroidism", "Iron Deficiency Anemia"],
        medications: ["Levothyroxine 75mcg", "Ferrous Sulfate 325mg"],
        allergies: ["Amoxicillin"],
      },
      {
        id: "pat-008", name: "Robert Fitzgerald", dob: "1970-09-14", mrn: "MRN-100208",
        lastUpdated: new Date(now.getTime() - 28800000).toISOString(), primaryPhysician: "Dr. Michael Torres",
        riskLevel: "medium", intakeStatus: "pending", lastVisit: new Date(now.getTime() - 5184000000).toISOString(),
        email: "robert.fitzgerald@email.com", phone: "(555) 908-0011",
        conditions: ["Lumbar Disc Herniation", "Sleep Apnea"],
        medications: ["Gabapentin 300mg", "CPAP Therapy"],
        allergies: ["NSAIDs"],
      },
    ];
    patientRecords.forEach(p => this.patients.set(p.id, p));

    const intakeData: IntakeEntry[] = [
      {
        id: "intake-001", patientId: "pat-001", patientName: "Eleanor Vance",
        submittedAt: new Date(now.getTime() - 604800000).toISOString(), source: "in-person",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "complete" },
          { name: "Medical History", status: "complete" },
          { name: "Medication Reconciliation", status: "flagged" },
          { name: "Consent Forms", status: "complete" },
        ],
        flags: ["Medication dosage discrepancy detected"],
        reviewedBy: "Dr. Sarah Smith", reviewedAt: new Date(now.getTime() - 518400000).toISOString(),
      },
      {
        id: "intake-002", patientId: "pat-003", patientName: "Priya Sharma",
        submittedAt: new Date(now.getTime() - 1209600000).toISOString(), source: "portal",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "incomplete" },
          { name: "Medical History", status: "complete" },
          { name: "Medication Reconciliation", status: "complete" },
          { name: "Consent Forms", status: "flagged" },
        ],
        flags: ["Insurance verification pending", "Consent form signature missing"],
        reviewedBy: null, reviewedAt: null,
      },
      {
        id: "intake-003", patientId: "pat-004", patientName: "James Holloway",
        submittedAt: new Date(now.getTime() - 172800000).toISOString(), source: "transfer",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "complete" },
          { name: "Medical History", status: "flagged" },
          { name: "Medication Reconciliation", status: "flagged" },
          { name: "Consent Forms", status: "complete" },
          { name: "Transfer Records", status: "complete" },
        ],
        flags: ["Complex medication regimen requires pharmacist review", "Prior cardiac history records incomplete"],
        reviewedBy: "Dr. Rebecca Liu", reviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      },
      {
        id: "intake-004", patientId: "pat-005", patientName: "Sofia Rodriguez",
        submittedAt: new Date(now.getTime() - 43200000).toISOString(), source: "telehealth",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "complete" },
          { name: "Medical History", status: "complete" },
          { name: "Symptom Questionnaire", status: "complete" },
        ],
        flags: [],
        reviewedBy: null, reviewedAt: null,
      },
      {
        id: "intake-005", patientId: "pat-006", patientName: "David Okonkwo",
        submittedAt: new Date(now.getTime() - 259200000).toISOString(), source: "in-person",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "complete" },
          { name: "Medical History", status: "complete" },
          { name: "Medication Reconciliation", status: "complete" },
          { name: "Consent Forms", status: "complete" },
          { name: "Oncology Intake", status: "flagged" },
        ],
        flags: ["Oncology staging records require specialist confirmation"],
        reviewedBy: null, reviewedAt: null,
      },
      {
        id: "intake-006", patientId: "pat-008", patientName: "Robert Fitzgerald",
        submittedAt: new Date(now.getTime() - 5184000000).toISOString(), source: "portal",
        sections: [
          { name: "Demographics", status: "complete" },
          { name: "Insurance Verification", status: "complete" },
          { name: "Medical History", status: "incomplete" },
          { name: "Medication Reconciliation", status: "complete" },
          { name: "Consent Forms", status: "complete" },
        ],
        flags: ["Medical history section partially completed"],
        reviewedBy: "Dr. Michael Torres", reviewedAt: new Date(now.getTime() - 5097600000).toISOString(),
      },
    ];
    intakeData.forEach(i => this.intakeEntries.set(i.id, i));

    const appointmentData: Appointment[] = [
      {
        id: "appt-001", patientId: "pat-001", patientName: "Eleanor Vance",
        providerId: "user-002", providerName: "Dr. Sarah Smith",
        startTime: new Date(now.getTime() + 86400000).toISOString(),
        endTime: new Date(now.getTime() + 86400000 + 1800000).toISOString(),
        type: "follow-up", status: "confirmed", location: "Primary Care - Room 204",
        notes: "Review HbA1c results and kidney function labs",
      },
      {
        id: "appt-002", patientId: "pat-004", patientName: "James Holloway",
        providerId: "user-002", providerName: "Dr. Sarah Smith",
        startTime: new Date(now.getTime() + 3600000).toISOString(),
        endTime: new Date(now.getTime() + 3600000 + 2700000).toISOString(),
        type: "urgent", status: "confirmed", location: "Cardiology Suite - Room 101",
        notes: "CHF exacerbation assessment, recent weight gain reported",
      },
      {
        id: "appt-003", patientId: "pat-002", patientName: "Marcus Chen",
        providerId: "user-006", providerName: "Dr. Michael Torres",
        startTime: new Date(now.getTime() + 172800000).toISOString(),
        endTime: new Date(now.getTime() + 172800000 + 1800000).toISOString(),
        type: "checkup", status: "scheduled", location: "Primary Care - Room 310",
        notes: "Annual wellness exam",
      },
      {
        id: "appt-004", patientId: "pat-006", patientName: "David Okonkwo",
        providerId: "user-006", providerName: "Dr. Michael Torres",
        startTime: new Date(now.getTime() + 259200000).toISOString(),
        endTime: new Date(now.getTime() + 259200000 + 3600000).toISOString(),
        type: "specialist", status: "scheduled", location: "Oncology Center - Suite 500",
        notes: "Follow-up on PSA levels and treatment plan review",
      },
      {
        id: "appt-005", patientId: "pat-003", patientName: "Priya Sharma",
        providerId: "user-002", providerName: "Dr. Sarah Smith",
        startTime: new Date(now.getTime() - 86400000).toISOString(),
        endTime: new Date(now.getTime() - 86400000 + 1800000).toISOString(),
        type: "follow-up", status: "completed", location: "Primary Care - Room 204",
        notes: "Anxiety medication adjustment, patient reports improvement",
      },
      {
        id: "appt-006", patientId: "pat-005", patientName: "Sofia Rodriguez",
        providerId: "user-006", providerName: "Dr. Michael Torres",
        startTime: new Date(now.getTime() + 432000000).toISOString(),
        endTime: new Date(now.getTime() + 432000000 + 1800000).toISOString(),
        type: "telehealth", status: "scheduled", location: "Virtual - Telehealth Platform",
        notes: "Migraine frequency assessment",
      },
      {
        id: "appt-007", patientId: "pat-007", patientName: "Hannah Kim",
        providerId: "user-002", providerName: "Dr. Sarah Smith",
        startTime: new Date(now.getTime() - 172800000).toISOString(),
        endTime: new Date(now.getTime() - 172800000 + 1800000).toISOString(),
        type: "checkup", status: "completed", location: "Primary Care - Room 204",
        notes: "Thyroid function recheck",
      },
      {
        id: "appt-008", patientId: "pat-008", patientName: "Robert Fitzgerald",
        providerId: "user-006", providerName: "Dr. Michael Torres",
        startTime: new Date(now.getTime() + 604800000).toISOString(),
        endTime: new Date(now.getTime() + 604800000 + 2700000).toISOString(),
        type: "procedure", status: "scheduled", location: "Imaging Center - Suite 102",
        notes: "Lumbar MRI with contrast",
      },
      {
        id: "appt-009", patientId: "pat-001", patientName: "Eleanor Vance",
        providerId: "user-004", providerName: "Lisa Patel",
        startTime: new Date(now.getTime() - 604800000).toISOString(),
        endTime: new Date(now.getTime() - 604800000 + 1200000).toISOString(),
        type: "checkup", status: "no-show", location: "Pharmacy Consultation Room",
        notes: "Medication therapy management session",
      },
      {
        id: "appt-010", patientId: "pat-004", patientName: "James Holloway",
        providerId: "user-002", providerName: "Dr. Sarah Smith",
        startTime: new Date(now.getTime() - 259200000).toISOString(),
        endTime: new Date(now.getTime() - 259200000 + 1800000).toISOString(),
        type: "follow-up", status: "cancelled", location: "Cardiology Suite - Room 101",
        notes: "Cancelled by patient due to transportation issues",
      },
    ];
    appointmentData.forEach(a => this.appointments.set(a.id, a));

    const insightData: AIInsight[] = [
      {
        id: "ins-001", patientId: "pat-004", patientName: "James Holloway",
        category: "risk-alert", summary: "Patient at elevated risk for CHF decompensation based on recent weight trend (+4 lbs in 3 days) and reduced activity levels.",
        severity: "critical", confidence: 0.92, generatedAt: new Date(now.getTime() - 7200000).toISOString(),
        evidenceRefs: ["Vital Signs - Weight Log", "Wearable Activity Data", "CHF Management Protocol"],
        status: "new", acknowledgedBy: null, acknowledgedAt: null,
      },
      {
        id: "ins-002", patientId: "pat-001", patientName: "Eleanor Vance",
        category: "medication-interaction", summary: "Potential interaction between Lisinopril and potassium-rich dietary supplements reported by patient during last visit.",
        severity: "warning", confidence: 0.87, generatedAt: new Date(now.getTime() - 86400000).toISOString(),
        evidenceRefs: ["Medication List", "Patient Self-Report", "Drug Interaction Database"],
        status: "acknowledged", acknowledgedBy: "Dr. Sarah Smith", acknowledgedAt: new Date(now.getTime() - 43200000).toISOString(),
      },
      {
        id: "ins-003", patientId: "pat-001", patientName: "Eleanor Vance",
        category: "lab-trend", summary: "HbA1c trending downward over past 6 months (7.2 -> 6.8 -> 6.4), indicating improved glycemic control with current treatment plan.",
        severity: "info", confidence: 0.95, generatedAt: new Date(now.getTime() - 172800000).toISOString(),
        evidenceRefs: ["Lab Results - HbA1c Series", "Medication Adherence Data"],
        status: "resolved", acknowledgedBy: "Dr. Sarah Smith", acknowledgedAt: new Date(now.getTime() - 129600000).toISOString(),
      },
      {
        id: "ins-004", patientId: "pat-002", patientName: "Marcus Chen",
        category: "preventive-care", summary: "Patient is due for annual flu vaccination and has not completed recommended colorectal cancer screening for age 35+.",
        severity: "info", confidence: 0.99, generatedAt: new Date(now.getTime() - 259200000).toISOString(),
        evidenceRefs: ["Immunization Records", "Preventive Care Guidelines - USPSTF"],
        status: "new", acknowledgedBy: null, acknowledgedAt: null,
      },
      {
        id: "ins-005", patientId: "pat-006", patientName: "David Okonkwo",
        category: "chronic-management", summary: "PSA levels have risen 15% over 6 months. Recommend oncology consultation and possible treatment plan adjustment.",
        severity: "warning", confidence: 0.88, generatedAt: new Date(now.getTime() - 345600000).toISOString(),
        evidenceRefs: ["Lab Results - PSA Series", "Oncology Treatment Protocol", "NCCN Guidelines"],
        status: "new", acknowledgedBy: null, acknowledgedAt: null,
      },
      {
        id: "ins-006", patientId: "pat-003", patientName: "Priya Sharma",
        category: "medication-interaction", summary: "Sertraline and Omeprazole co-administration may increase sertraline plasma levels. Monitor for increased side effects.",
        severity: "warning", confidence: 0.78, generatedAt: new Date(now.getTime() - 432000000).toISOString(),
        evidenceRefs: ["Medication List", "CYP2C19 Interaction Profile", "FDA Drug Safety Communication"],
        status: "dismissed", acknowledgedBy: "Dr. Sarah Smith", acknowledgedAt: new Date(now.getTime() - 388800000).toISOString(),
      },
      {
        id: "ins-007", patientId: "pat-007", patientName: "Hannah Kim",
        category: "lab-trend", summary: "Iron studies show improving ferritin levels (12 -> 28 -> 45 ng/mL) over 4 months with supplementation.",
        severity: "info", confidence: 0.93, generatedAt: new Date(now.getTime() - 518400000).toISOString(),
        evidenceRefs: ["Lab Results - Iron Panel", "Medication Adherence Logs"],
        status: "acknowledged", acknowledgedBy: "Dr. Sarah Smith", acknowledgedAt: new Date(now.getTime() - 475200000).toISOString(),
      },
      {
        id: "ins-008", patientId: "pat-004", patientName: "James Holloway",
        category: "risk-alert", summary: "Warfarin INR value of 3.8 detected, above therapeutic range (2.0-3.0). Immediate dose adjustment recommended.",
        severity: "critical", confidence: 0.96, generatedAt: new Date(now.getTime() - 14400000).toISOString(),
        evidenceRefs: ["Lab Results - INR", "Warfarin Dosing Protocol", "Bleeding Risk Assessment"],
        status: "new", acknowledgedBy: null, acknowledgedAt: null,
      },
    ];
    insightData.forEach(i => this.insights.set(i.id, i));

    const userData: UserAccount[] = [
      {
        id: "user-001", name: "Admin Thompson", email: "admin.thompson@clinic.example",
        role: "admin", department: "Administration", status: "active",
        lastLogin: new Date(now.getTime() - 1800000).toISOString(), createdAt: "2024-01-15T08:00:00Z",
        permissions: ["manage_users", "view_analytics", "manage_settings", "audit_logs", "manage_roles", "system_config"],
      },
      {
        id: "user-002", name: "Dr. Sarah Smith", email: "s.smith@clinic.example",
        role: "physician", department: "Primary Care", status: "active",
        lastLogin: new Date(now.getTime() - 3600000).toISOString(), createdAt: "2024-02-01T08:00:00Z",
        permissions: ["view_patients", "edit_records", "prescribe", "order_labs", "manage_appointments", "view_insights"],
      },
      {
        id: "user-003", name: "Nurse Emily Johnson", email: "e.johnson@clinic.example",
        role: "nurse", department: "Primary Care", status: "active",
        lastLogin: new Date(now.getTime() - 7200000).toISOString(), createdAt: "2024-03-10T08:00:00Z",
        permissions: ["view_patients", "update_vitals", "manage_intake", "triage", "manage_appointments"],
      },
      {
        id: "user-004", name: "Lisa Patel", email: "l.patel@clinic.example",
        role: "pharmacist", department: "Pharmacy", status: "active",
        lastLogin: new Date(now.getTime() - 14400000).toISOString(), createdAt: "2024-04-20T08:00:00Z",
        permissions: ["view_patients", "review_medications", "drug_interactions", "medication_reconciliation"],
      },
      {
        id: "user-005", name: "Carlos Rivera", email: "c.rivera@clinic.example",
        role: "receptionist", department: "Front Desk", status: "active",
        lastLogin: new Date(now.getTime() - 28800000).toISOString(), createdAt: "2024-06-01T08:00:00Z",
        permissions: ["manage_appointments", "patient_check_in", "insurance_verification", "view_schedule"],
      },
      {
        id: "user-006", name: "Dr. Michael Torres", email: "m.torres@clinic.example",
        role: "care-coordinator", department: "Care Management", status: "active",
        lastLogin: new Date(now.getTime() - 43200000).toISOString(), createdAt: "2024-07-15T08:00:00Z",
        permissions: ["view_patients", "manage_care_plans", "coordinate_referrals", "manage_appointments", "view_insights"],
      },
    ];
    userData.forEach(u => this.users.set(u.id, u));

    this.metrics = [
      { id: "metric-001", label: "Total Active Patients", value: "2,847", delta: "+12", trend: "up", category: "patients" },
      { id: "metric-002", label: "New Patients (This Month)", value: "134", delta: "+8%", trend: "up", category: "patients" },
      { id: "metric-003", label: "Appointments Today", value: "42", delta: "-3", trend: "down", category: "appointments" },
      { id: "metric-004", label: "No-Show Rate", value: "6.2%", delta: "-1.1%", trend: "down", category: "appointments" },
      { id: "metric-005", label: "HIPAA Compliance Score", value: "97.5%", delta: "+0.5%", trend: "up", category: "compliance" },
      { id: "metric-006", label: "Pending Consent Reviews", value: "18", delta: "+3", trend: "up", category: "compliance" },
      { id: "metric-007", label: "Avg. Wait Time", value: "14 min", delta: "-2 min", trend: "down", category: "performance" },
      { id: "metric-008", label: "Patient Satisfaction", value: "4.6/5", delta: "+0.1", trend: "stable", category: "performance" },
    ];

    this.auditEntries = [
      {
        id: "audit-001", actorId: "user-001", actorName: "Admin Thompson",
        action: "user.role_updated", resourceType: "user", resourceId: "user-003",
        timestamp: new Date(now.getTime() - 86400000).toISOString(),
        details: "Updated role permissions for Nurse Emily Johnson", ipAddress: "192.168.1.45",
      },
      {
        id: "audit-002", actorId: "user-002", actorName: "Dr. Sarah Smith",
        action: "patient.record_accessed", resourceType: "patient", resourceId: "pat-004",
        timestamp: new Date(now.getTime() - 43200000).toISOString(),
        details: "Accessed patient record for James Holloway - CHF management review", ipAddress: "10.0.2.100",
      },
      {
        id: "audit-003", actorId: "user-001", actorName: "Admin Thompson",
        action: "system.settings_modified", resourceType: "system", resourceId: "config-mfa",
        timestamp: new Date(now.getTime() - 172800000).toISOString(),
        details: "Enabled mandatory MFA for all provider accounts", ipAddress: "192.168.1.45",
      },
      {
        id: "audit-004", actorId: "user-004", actorName: "Lisa Patel",
        action: "medication.interaction_flagged", resourceType: "patient", resourceId: "pat-001",
        timestamp: new Date(now.getTime() - 259200000).toISOString(),
        details: "Flagged potential drug interaction for Eleanor Vance - Lisinopril/Potassium", ipAddress: "10.0.3.55",
      },
      {
        id: "audit-005", actorId: "user-003", actorName: "Nurse Emily Johnson",
        action: "intake.form_submitted", resourceType: "intake", resourceId: "intake-003",
        timestamp: new Date(now.getTime() - 345600000).toISOString(),
        details: "Processed transfer intake forms for James Holloway", ipAddress: "10.0.2.80",
      },
    ];

    console.log(`[ProviderAdmin] Loaded ${this.patients.size} patients, ${this.intakeEntries.size} intake entries, ${this.appointments.size} appointments, ${this.insights.size} insights, ${this.users.size} users, ${this.metrics.length} metrics, ${this.auditEntries.length} audit entries`);
  }

  getPatientRecords(query?: string, riskLevel?: string, page: number = 1, limit: number = 10): { records: PatientRecord[]; total: number; page: number; totalPages: number } {
    let records = Array.from(this.patients.values());

    if (query) {
      const q = query.toLowerCase();
      records = records.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.mrn.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    }

    if (riskLevel) {
      records = records.filter(r => r.riskLevel === riskLevel);
    }

    const total = records.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    records = records.slice(start, start + limit);

    return { records, total, page, totalPages };
  }

  getPatientRecord(id: string): PatientRecord | null {
    return this.patients.get(id) || null;
  }

  getPatientIntakeHistory(patientId: string): IntakeEntry[] {
    return Array.from(this.intakeEntries.values()).filter(e => e.patientId === patientId);
  }

  getAppointments(date?: string, status?: string, providerId?: string): Appointment[] {
    let results = Array.from(this.appointments.values());

    if (date) {
      results = results.filter(a => a.startTime.startsWith(date));
    }

    if (status) {
      results = results.filter(a => a.status === status);
    }

    if (providerId) {
      results = results.filter(a => a.providerId === providerId);
    }

    return results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  createAppointment(data: Partial<Appointment>): Appointment {
    const id = `appt-${Date.now()}`;
    const appointment: Appointment = {
      id,
      patientId: data.patientId || "",
      patientName: data.patientName || "",
      providerId: data.providerId || "",
      providerName: data.providerName || "",
      startTime: data.startTime || new Date().toISOString(),
      endTime: data.endTime || new Date().toISOString(),
      type: data.type || "checkup",
      status: data.status || "scheduled",
      location: data.location || "",
      notes: data.notes || "",
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  updateAppointment(id: string, data: Partial<Appointment>): Appointment | null {
    const existing = this.appointments.get(id);
    if (!existing) return null;

    const updated: Appointment = { ...existing, ...data, id: existing.id };
    this.appointments.set(id, updated);
    return updated;
  }

  getInsights(patientId?: string, category?: string, status?: string): AIInsight[] {
    let results = Array.from(this.insights.values());

    if (patientId) {
      results = results.filter(i => i.patientId === patientId);
    }

    if (category) {
      results = results.filter(i => i.category === category);
    }

    if (status) {
      results = results.filter(i => i.status === status);
    }

    return results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  acknowledgeInsight(id: string, actorId: string): AIInsight | null {
    const insight = this.insights.get(id);
    if (!insight) return null;

    const updated: AIInsight = {
      ...insight,
      status: "acknowledged",
      acknowledgedBy: actorId,
      acknowledgedAt: new Date().toISOString(),
    };
    this.insights.set(id, updated);
    return updated;
  }

  getUsers(query?: string, role?: string): UserAccount[] {
    let results = Array.from(this.users.values());

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }

    if (role) {
      results = results.filter(u => u.role === role);
    }

    return results;
  }

  createUser(data: Partial<UserAccount>): UserAccount {
    const id = `user-${Date.now()}`;
    const user: UserAccount = {
      id,
      name: data.name || "",
      email: data.email || "",
      role: data.role || "receptionist",
      department: data.department || "",
      status: data.status || "active",
      lastLogin: data.lastLogin || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      permissions: data.permissions || [],
    };
    this.users.set(id, user);
    return user;
  }

  updateUserRole(id: string, role: string, permissions: string[]): UserAccount | null {
    const user = this.users.get(id);
    if (!user) return null;

    const updated: UserAccount = { ...user, role, permissions };
    this.users.set(id, updated);
    return updated;
  }

  getAdminMetrics(): AdminMetric[] {
    return this.metrics;
  }

  getAuditLog(page: number = 1, limit: number = 20): { entries: AuditEntry[]; total: number; page: number; totalPages: number } {
    const sorted = [...this.auditEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const total = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const entries = sorted.slice(start, start + limit);

    return { entries, total, page, totalPages };
  }

  getPatientIds(): string[] {
    return Array.from(this.patients.keys());
  }

  getPatientName(patientId: string): string {
    return this.patients.get(patientId)?.name || patientId;
  }

  getPatientMedications(patientId: string): string[] {
    return this.patients.get(patientId)?.medications || [];
  }

  getPatientSummaryData(patientId: string): {
    patient: PatientRecord;
    intakeHistory: IntakeEntry[];
    flags: string[];
  } | null {
    const patient = this.patients.get(patientId);
    if (!patient) return null;

    const intakeHistory = Array.from(this.intakeEntries.values())
      .filter(e => e.patientId === patientId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const flags = intakeHistory.flatMap(e => e.flags);

    return { patient, intakeHistory, flags };
  }
}

export const providerAdminService = new ProviderAdminService();
