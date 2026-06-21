import { Router } from "express";

const router = Router();

function logPhiAccess(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "TreatmentJourney",
    action,
    details,
  }));
}

interface TreatmentPhase {
  id: string;
  name: string;
  description: string;
  status: "completed" | "in_progress" | "upcoming" | "skipped";
  startDate: string;
  endDate?: string;
  progress: number;
  provider?: string;
  facility?: string;
  notes?: string;
  milestones: {
    id: string;
    title: string;
    date: string;
    status: "completed" | "in_progress" | "upcoming";
    type: "appointment" | "procedure" | "lab" | "imaging" | "medication" | "followup";
    notes?: string;
  }[];
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "discontinued";
  purpose: string;
  prescribedBy: string;
}

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  facility: string;
  phone?: string;
  isPrimary: boolean;
}

interface TreatmentJourneyData {
  patientId: string;
  patientName: string;
  condition: string;
  conditionSubtype?: string;
  diagnosisDate: string;
  currentPhase: string;
  overallProgress: number;
  phases: TreatmentPhase[];
  medications: Medication[];
  careTeam: CareTeamMember[];
  upcomingAppointments: {
    id: string;
    title: string;
    date: string;
    time: string;
    provider: string;
    facility: string;
    type: string;
  }[];
  recentActivity: {
    id: string;
    type: string;
    title: string;
    date: string;
    description: string;
  }[];
  aiSummary: {
    currentStatus: string;
    nextSteps: string[];
    encouragement: string;
  };
}

const sampleJourneyData: TreatmentJourneyData = {
  patientId: "patient-default",
  patientName: "Sample Patient",
  condition: "Breast Cancer",
  conditionSubtype: "Invasive Ductal Carcinoma, Stage IIA",
  diagnosisDate: "2024-03-15",
  currentPhase: "hormone_therapy",
  overallProgress: 78,
  phases: [
    {
      id: "diagnosis",
      name: "Diagnosis & Staging",
      description: "Initial cancer diagnosis, biopsy, imaging, and staging workup",
      status: "completed",
      startDate: "2024-03-10",
      endDate: "2024-03-28",
      progress: 100,
      provider: "Dr. Sarah Johnson",
      facility: "City Cancer Center",
      milestones: [
        { id: "m1", title: "Mammogram & Ultrasound", date: "2024-03-10", status: "completed", type: "imaging" },
        { id: "m2", title: "Core Needle Biopsy", date: "2024-03-15", status: "completed", type: "procedure" },
        { id: "m3", title: "Pathology Results", date: "2024-03-18", status: "completed", type: "lab" },
        { id: "m4", title: "PET/CT Staging Scan", date: "2024-03-22", status: "completed", type: "imaging" },
        { id: "m5", title: "Genetic Testing (BRCA)", date: "2024-03-25", status: "completed", type: "lab" },
        { id: "m6", title: "Tumor Board Review", date: "2024-03-28", status: "completed", type: "appointment" },
      ],
    },
    {
      id: "surgery",
      name: "Surgical Treatment",
      description: "Lumpectomy with sentinel lymph node biopsy",
      status: "completed",
      startDate: "2024-04-01",
      endDate: "2024-04-15",
      progress: 100,
      provider: "Dr. Emily Roberts",
      facility: "City Cancer Center",
      milestones: [
        { id: "m7", title: "Pre-operative Consultation", date: "2024-03-29", status: "completed", type: "appointment" },
        { id: "m8", title: "Pre-op Labs & ECG", date: "2024-03-30", status: "completed", type: "lab" },
        { id: "m9", title: "Lumpectomy Surgery", date: "2024-04-01", status: "completed", type: "procedure" },
        { id: "m10", title: "Surgical Pathology Final", date: "2024-04-05", status: "completed", type: "lab" },
        { id: "m11", title: "Post-op Follow-up", date: "2024-04-15", status: "completed", type: "followup" },
      ],
    },
    {
      id: "chemotherapy",
      name: "Chemotherapy",
      description: "AC-T regimen: 4 cycles AC followed by 4 cycles Taxol",
      status: "completed",
      startDate: "2024-05-01",
      endDate: "2024-09-15",
      progress: 100,
      provider: "Dr. Sarah Johnson",
      facility: "City Cancer Center Infusion",
      milestones: [
        { id: "m12", title: "Chemo Education Session", date: "2024-04-28", status: "completed", type: "appointment" },
        { id: "m13", title: "Port Placement", date: "2024-04-30", status: "completed", type: "procedure" },
        { id: "m14", title: "AC Cycle 1", date: "2024-05-01", status: "completed", type: "medication" },
        { id: "m15", title: "AC Cycle 2", date: "2024-05-22", status: "completed", type: "medication" },
        { id: "m16", title: "AC Cycle 3", date: "2024-06-12", status: "completed", type: "medication" },
        { id: "m17", title: "AC Cycle 4", date: "2024-07-03", status: "completed", type: "medication" },
        { id: "m18", title: "Taxol Cycle 1", date: "2024-07-24", status: "completed", type: "medication" },
        { id: "m19", title: "Taxol Cycle 2", date: "2024-08-07", status: "completed", type: "medication" },
        { id: "m20", title: "Taxol Cycle 3", date: "2024-08-21", status: "completed", type: "medication" },
        { id: "m21", title: "Taxol Cycle 4", date: "2024-09-04", status: "completed", type: "medication" },
        { id: "m22", title: "End of Chemo Assessment", date: "2024-09-15", status: "completed", type: "appointment" },
      ],
    },
    {
      id: "radiation",
      name: "Radiation Therapy",
      description: "Whole breast radiation with boost to lumpectomy cavity",
      status: "completed",
      startDate: "2024-10-01",
      endDate: "2024-11-15",
      progress: 100,
      provider: "Dr. Michael Chen",
      facility: "City Cancer Center Radiation",
      milestones: [
        { id: "m23", title: "Radiation Simulation/Planning", date: "2024-09-25", status: "completed", type: "imaging" },
        { id: "m24", title: "Radiation Treatments (25 sessions)", date: "2024-10-01", status: "completed", type: "procedure" },
        { id: "m25", title: "Boost Treatments (5 sessions)", date: "2024-11-05", status: "completed", type: "procedure" },
        { id: "m26", title: "Radiation Completion Visit", date: "2024-11-15", status: "completed", type: "followup" },
      ],
    },
    {
      id: "hormone_therapy",
      name: "Hormone Therapy",
      description: "Tamoxifen 20mg daily for 5 years",
      status: "in_progress",
      startDate: "2024-11-20",
      progress: 15,
      provider: "Dr. Sarah Johnson",
      facility: "City Cancer Center",
      milestones: [
        { id: "m27", title: "Start Tamoxifen", date: "2024-11-20", status: "completed", type: "medication" },
        { id: "m28", title: "3-Month Follow-up", date: "2025-02-20", status: "upcoming", type: "followup" },
        { id: "m29", title: "6-Month Follow-up", date: "2025-05-20", status: "upcoming", type: "followup" },
        { id: "m30", title: "Annual Mammogram", date: "2025-03-15", status: "upcoming", type: "imaging" },
      ],
    },
    {
      id: "surveillance",
      name: "Long-term Surveillance",
      description: "Regular monitoring and follow-up care",
      status: "upcoming",
      startDate: "2029-11-20",
      progress: 0,
      provider: "Dr. Sarah Johnson",
      facility: "City Cancer Center",
      milestones: [
        { id: "m31", title: "Complete Hormone Therapy", date: "2029-11-20", status: "upcoming", type: "medication" },
        { id: "m32", title: "Transition to Annual Surveillance", date: "2029-12-01", status: "upcoming", type: "followup" },
      ],
    },
  ],
  medications: [
    {
      id: "med1",
      name: "Tamoxifen",
      dosage: "20mg",
      frequency: "Once daily",
      startDate: "2024-11-20",
      status: "active",
      purpose: "Hormone therapy to reduce recurrence risk",
      prescribedBy: "Dr. Sarah Johnson",
    },
    {
      id: "med2",
      name: "Vitamin D3",
      dosage: "2000 IU",
      frequency: "Once daily",
      startDate: "2024-11-20",
      status: "active",
      purpose: "Bone health support during hormone therapy",
      prescribedBy: "Dr. Sarah Johnson",
    },
    {
      id: "med3",
      name: "Doxorubicin (Adriamycin)",
      dosage: "60mg/m²",
      frequency: "Every 3 weeks x 4 cycles",
      startDate: "2024-05-01",
      endDate: "2024-07-03",
      status: "completed",
      purpose: "Chemotherapy - AC regimen component",
      prescribedBy: "Dr. Sarah Johnson",
    },
    {
      id: "med4",
      name: "Cyclophosphamide",
      dosage: "600mg/m²",
      frequency: "Every 3 weeks x 4 cycles",
      startDate: "2024-05-01",
      endDate: "2024-07-03",
      status: "completed",
      purpose: "Chemotherapy - AC regimen component",
      prescribedBy: "Dr. Sarah Johnson",
    },
    {
      id: "med5",
      name: "Paclitaxel (Taxol)",
      dosage: "175mg/m²",
      frequency: "Every 2 weeks x 4 cycles",
      startDate: "2024-07-24",
      endDate: "2024-09-04",
      status: "completed",
      purpose: "Chemotherapy - Taxane component",
      prescribedBy: "Dr. Sarah Johnson",
    },
    {
      id: "med6",
      name: "Ondansetron (Zofran)",
      dosage: "8mg",
      frequency: "As needed for nausea",
      startDate: "2024-05-01",
      endDate: "2024-09-30",
      status: "completed",
      purpose: "Anti-nausea during chemotherapy",
      prescribedBy: "Dr. Sarah Johnson",
    },
  ],
  careTeam: [
    {
      id: "team1",
      name: "Dr. Sarah Johnson",
      role: "Medical Oncologist",
      specialty: "Breast Cancer",
      facility: "City Cancer Center",
      phone: "(555) 123-4568",
      isPrimary: true,
    },
    {
      id: "team2",
      name: "Dr. Emily Roberts",
      role: "Surgical Oncologist",
      specialty: "Breast Surgery",
      facility: "City Cancer Center",
      phone: "(555) 123-4570",
      isPrimary: false,
    },
    {
      id: "team3",
      name: "Dr. Michael Chen",
      role: "Radiation Oncologist",
      specialty: "Breast Radiation Therapy",
      facility: "City Cancer Center",
      phone: "(555) 123-4569",
      isPrimary: false,
    },
    {
      id: "team4",
      name: "Dr. Amanda Williams",
      role: "Genetic Counselor",
      specialty: "Hereditary Cancer Syndromes",
      facility: "University Medical Center",
      phone: "(555) 987-6544",
      isPrimary: false,
    },
    {
      id: "team5",
      name: "Jessica Martinez, RN",
      role: "Oncology Nurse Navigator",
      specialty: "Patient Care Coordination",
      facility: "City Cancer Center",
      phone: "(555) 123-4575",
      isPrimary: false,
    },
    {
      id: "team6",
      name: "Dr. Robert Kim",
      role: "Pathologist",
      specialty: "Breast Pathology",
      facility: "City Cancer Center Pathology",
      phone: "(555) 123-4571",
      isPrimary: false,
    },
  ],
  upcomingAppointments: [
    {
      id: "appt1",
      title: "Medical Oncology Follow-up",
      date: "2025-02-20",
      time: "10:00 AM",
      provider: "Dr. Sarah Johnson",
      facility: "City Cancer Center",
      type: "Follow-up",
    },
    {
      id: "appt2",
      title: "Annual Mammogram",
      date: "2025-03-15",
      time: "9:30 AM",
      provider: "Imaging Department",
      facility: "City Cancer Center Imaging",
      type: "Imaging",
    },
    {
      id: "appt3",
      title: "Bone Density Scan (DEXA)",
      date: "2025-04-01",
      time: "11:00 AM",
      provider: "Imaging Department",
      facility: "City Cancer Center Imaging",
      type: "Imaging",
    },
  ],
  recentActivity: [
    {
      id: "act1",
      type: "appointment",
      title: "Medical Oncology Visit",
      date: "2025-01-15",
      description: "Routine 2-month follow-up. Tolerating Tamoxifen well. No concerning symptoms.",
    },
    {
      id: "act2",
      type: "lab",
      title: "Routine Labs",
      date: "2025-01-10",
      description: "CBC and CMP within normal limits. Lipid panel stable.",
    },
    {
      id: "act3",
      type: "medication",
      title: "Prescription Refill",
      date: "2025-01-05",
      description: "Tamoxifen 20mg - 90 day supply refilled",
    },
  ],
  aiSummary: {
    currentStatus: "You are currently in the Hormone Therapy phase of your treatment journey. You have successfully completed diagnosis, surgery, chemotherapy, and radiation therapy. You are now on Tamoxifen to help reduce the risk of cancer recurrence.",
    nextSteps: [
      "Continue taking Tamoxifen 20mg daily as prescribed",
      "Attend your upcoming 3-month follow-up appointment on February 20, 2025",
      "Schedule your annual mammogram for March 2025",
      "Report any new symptoms or side effects to your care team",
    ],
    encouragement: "You have made incredible progress through a challenging treatment journey. Completing surgery, chemotherapy, and radiation is a major accomplishment. Keep up the great work with your daily medication and follow-up appointments!",
  },
};

router.get("/", (req, res) => {
  logPhiAccess("VIEW_TREATMENT_JOURNEY", { patientId: "patient-default" });
  res.json(sampleJourneyData);
});

router.get("/:patientId", (req, res) => {
  const { patientId } = req.params;
  logPhiAccess("VIEW_TREATMENT_JOURNEY", { patientId });
  res.json({ ...sampleJourneyData, patientId });
});

export default router;
