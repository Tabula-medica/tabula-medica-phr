import { Router } from "express";
import {
  CarePacketType,
  CarePacketData,
  carePacketContents,
  carePacketLabels,
  carePacketDescriptions,
  CarePacketSection,
  survivorshipTreatmentTypeLabels,
  symptomTypeLabels,
  severityLabels,
  followUpCategoryLabels,
  survivorshipFollowUpFrequencyLabels,
  SurvivorshipTreatmentType,
  SurvivorshipFollowUpFrequency,
  SeverityLevel,
} from "@shared/schema";

const router = Router();

const getSamplePatientInfo = () => ({
  name: "Jane Smith",
  dateOfBirth: "1975-06-15",
  mrn: "MRN-2024-001234",
});

const getSampleDiagnosisTimeline = () => ({
  diagnosisDate: "2021-03-15",
  cancerType: "Breast Cancer",
  stage: "Stage II",
  treatmentEndDate: "2022-01-20",
  yearsSinceTreatment: 4,
});

const getSampleTreatmentHistory = () => [
  {
    type: survivorshipTreatmentTypeLabels.chemotherapy,
    name: "AC-T (Adriamycin, Cyclophosphamide, Taxol)",
    startDate: "2021-04-01",
    endDate: "2021-09-15",
    notes: "6 cycles completed",
  },
  {
    type: survivorshipTreatmentTypeLabels.surgery,
    name: "Bilateral Mastectomy with Reconstruction",
    startDate: "2021-10-10",
    endDate: "2021-10-10",
    notes: "Sentinel lymph node biopsy - 0/3 positive",
  },
  {
    type: survivorshipTreatmentTypeLabels.radiation,
    name: "External Beam Radiation",
    startDate: "2021-11-15",
    endDate: "2022-01-05",
    notes: "30 fractions to chest wall",
  },
  {
    type: survivorshipTreatmentTypeLabels.hormone_therapy,
    name: "Tamoxifen 20mg daily",
    startDate: "2022-01-20",
    notes: "Hormone therapy - ongoing per treatment schedule",
  },
];

const getSampleCurrentMedications = () => [
  {
    name: "Tamoxifen",
    dose: "20mg",
    frequency: "Once daily",
    indication: "Breast cancer hormone therapy",
    prescriber: "Dr. Sarah Johnson, Oncology",
  },
  {
    name: "Gabapentin",
    dose: "300mg",
    frequency: "Three times daily",
    indication: "Chemotherapy-induced neuropathy",
    prescriber: "Dr. Sarah Johnson, Oncology",
  },
  {
    name: "Calcium + Vitamin D",
    dose: "600mg/400IU",
    frequency: "Twice daily",
    indication: "Bone health support",
    prescriber: "Dr. Michael Chen, Primary Care",
  },
];

const getSampleAllergies = () => [
  {
    allergen: "Penicillin",
    reaction: "Hives, difficulty breathing",
    severity: "Severe",
  },
  {
    allergen: "Sulfa drugs",
    reaction: "Rash",
    severity: "Moderate",
  },
  {
    allergen: "Latex",
    reaction: "Skin irritation",
    severity: "Mild",
  },
];

const getSampleRecentLabs = () => [
  {
    testName: "CBC with Differential",
    value: "WNL",
    date: "2025-12-15",
    status: "Normal",
  },
  {
    testName: "Complete Metabolic Panel",
    value: "WNL",
    date: "2025-12-15",
    status: "Normal",
  },
  {
    testName: "TSH",
    value: "2.1 mIU/L",
    date: "2025-12-15",
    status: "Normal",
  },
  {
    testName: "Lipid Panel",
    value: "Total Cholesterol 195",
    date: "2025-12-15",
    status: "Normal",
  },
  {
    testName: "Vitamin D, 25-Hydroxy",
    value: "42 ng/mL",
    date: "2025-12-15",
    status: "Normal",
  },
];

const getSampleRecentImaging = () => [
  {
    type: "Mammogram (Diagnostic)",
    date: "2025-06-10",
    findings: "Screening completed. Results documented by radiology.",
  },
  {
    type: "DEXA Bone Density Scan",
    date: "2025-01-05",
    findings: "Bone density scan completed. Results documented.",
  },
  {
    type: "Echocardiogram",
    date: "2025-03-10",
    findings: "Echocardiogram completed. Results documented by cardiology.",
  },
];

const getSampleSideEffectsHighlights = () => [
  {
    symptom: "Peripheral Neuropathy",
    severity: "Mild",
    medication: "Chemotherapy (Taxol)",
    status: "Ongoing - stable",
  },
  {
    symptom: "Hot Flashes",
    severity: "Mild",
    medication: "Tamoxifen",
    status: "Ongoing",
  },
  {
    symptom: "Cognitive Changes",
    severity: "Mild",
    medication: "Chemotherapy",
    status: "Ongoing - improving",
  },
];

const getSampleFollowUpSchedule = () => [
  {
    title: "Annual Oncology Follow-up",
    category: "Oncology",
    nextDue: "2026-01-20",
    frequency: "Yearly",
  },
  {
    title: "Mammogram",
    category: "Imaging",
    nextDue: "2026-06-01",
    frequency: "Yearly",
  },
  {
    title: "Cardio-Oncology Check",
    category: "Cardiac",
    nextDue: "2026-03-15",
    frequency: "Yearly",
  },
  {
    title: "DEXA Bone Density Scan",
    category: "Bone Health",
    nextDue: "2026-06-01",
    frequency: "Every 2 years",
  },
  {
    title: "Thyroid Function Labs",
    category: "Lab Work",
    nextDue: "2026-02-01",
    frequency: "Yearly",
  },
];

const getSampleCareTeam = () => [
  {
    name: "Dr. Sarah Johnson",
    role: "Medical Oncologist",
    specialty: "Breast Cancer",
    phone: "(555) 123-4567",
  },
  {
    name: "Dr. Michael Chen",
    role: "Primary Care Physician",
    specialty: "Internal Medicine",
    phone: "(555) 234-5678",
  },
  {
    name: "Dr. Emily Rodriguez",
    role: "Radiation Oncologist",
    phone: "(555) 345-6789",
  },
  {
    name: "Dr. James Kim",
    role: "Cardio-Oncologist",
    specialty: "Cardiology",
    phone: "(555) 456-7890",
  },
];

const getSampleEmergencyContacts = () => [
  {
    name: "Robert Smith",
    relationship: "Spouse",
    phone: "(555) 111-2222",
    isPrimary: true,
  },
  {
    name: "Amy Johnson",
    relationship: "Sister",
    phone: "(555) 333-4444",
    isPrimary: false,
  },
  {
    name: "Cancer Center 24/7 Line",
    relationship: "Medical",
    phone: "(555) 999-0000",
    isPrimary: false,
    notes: "For oncology emergencies",
  },
];

const getSampleSideEffectsDetailed = () => ({
  topSymptoms: [
    {
      symptom: "Peripheral Neuropathy",
      occurrences: 45,
      avgSeverity: 3.2,
      trend: "stable" as const,
      medication: "Chemotherapy (Taxol)",
      firstReported: "2021-05-15",
      lastReported: "2026-01-10",
      notes: "Patient reports tingling in fingers and toes",
    },
    {
      symptom: "Hot Flashes",
      occurrences: 89,
      avgSeverity: 2.5,
      trend: "stable" as const,
      medication: "Tamoxifen",
      firstReported: "2022-02-01",
      lastReported: "2026-01-15",
      notes: "Patient reports occurrences most frequent at night",
    },
    {
      symptom: "Cognitive Changes",
      occurrences: 23,
      avgSeverity: 2.1,
      trend: "stable" as const,
      medication: "Chemotherapy",
      firstReported: "2021-06-01",
      lastReported: "2025-12-20",
      notes: "Patient reports word-finding difficulties and concentration issues",
    },
  ],
  severityTrends: {
    last30Days: { mild: 12, moderate: 5, severe: 0 },
    last90Days: { mild: 35, moderate: 18, severe: 2 },
    overallTrend: "improving" as const,
  },
  totalEntries: 157,
  activeMedications: 3,
  summary: "This summary reflects patient-reported journal entries only. This is NOT a clinical assessment.",
});

const getSampleLateEffectsWatchlist = (): Array<{
  effectType: string;
  status: "watching" | "detected" | "resolved";
  riskLevel: "high" | "low" | "moderate";
  relatedTreatments: string[];
  monitoringFrequency: string;
  lastScreening?: string;
  nextScreening?: string;
  notes?: string;
}> => [
  {
    effectType: "Cardiac Toxicity",
    status: "watching",
    riskLevel: "moderate",
    relatedTreatments: ["Adriamycin (Doxorubicin)"],
    monitoringFrequency: "Yearly",
    lastScreening: "2025-03-10",
    nextScreening: "2026-03-15",
    notes: "Echocardiogram completed. Screening frequency recorded: yearly.",
  },
  {
    effectType: "Bone Loss (Osteoporosis)",
    status: "detected",
    riskLevel: "low",
    relatedTreatments: ["Tamoxifen", "Chemotherapy-induced menopause"],
    monitoringFrequency: "Every 2 years",
    lastScreening: "2025-01-05",
    nextScreening: "2027-01-01",
    notes: "DEXA scan completed. Calcium/vitamin D supplement documented in medication list.",
  },
  {
    effectType: "Secondary Malignancy",
    status: "watching",
    riskLevel: "low",
    relatedTreatments: ["Radiation therapy"],
    monitoringFrequency: "Yearly",
    lastScreening: "2025-12-15",
    nextScreening: "2026-12-01",
    notes: "Screening category based on treatment type. Recorded frequency: yearly.",
  },
  {
    effectType: "Peripheral Neuropathy",
    status: "detected",
    riskLevel: "low",
    relatedTreatments: ["Taxol (Paclitaxel)"],
    monitoringFrequency: "As needed",
    lastScreening: "2025-11-20",
    notes: "Patient reports ongoing mild symptoms. Recorded medication: gabapentin.",
  },
];

const getSampleTreatmentHistoryReference = () => ({
  summary: "Complete treatment records spanning March 2021 - January 2022",
  totalDocuments: 47,
  categories: [
    { type: "Chemotherapy Records", count: 12 },
    { type: "Surgical Reports", count: 4 },
    { type: "Radiation Therapy Notes", count: 8 },
    { type: "Pathology Reports", count: 5 },
    { type: "Imaging Reports", count: 18 },
  ],
  accessInstructions: "Full treatment history is available in the patient portal under My Documents > Cancer Treatment. Records can be shared directly with providers via the Share Documents feature.",
  portalLink: "/documents?category=cancer_treatment",
  lastUpdated: "2026-01-15",
});

function buildPacketSections(sections: CarePacketSection[]): CarePacketData["sections"] {
  const result: CarePacketData["sections"] = {};

  sections.forEach((section) => {
    switch (section) {
      case "diagnosis_timeline":
        result.diagnosis_timeline = getSampleDiagnosisTimeline();
        break;
      case "treatment_history":
        result.treatment_history = getSampleTreatmentHistory();
        break;
      case "treatment_history_reference":
        result.treatment_history_reference = getSampleTreatmentHistoryReference();
        break;
      case "current_medications":
        result.current_medications = getSampleCurrentMedications();
        break;
      case "allergies":
        result.allergies = getSampleAllergies();
        break;
      case "recent_labs":
        result.recent_labs = getSampleRecentLabs();
        break;
      case "recent_imaging":
        result.recent_imaging = getSampleRecentImaging();
        break;
      case "side_effects_highlights":
        result.side_effects_highlights = getSampleSideEffectsHighlights();
        break;
      case "side_effects_detailed":
        result.side_effects_detailed = getSampleSideEffectsDetailed();
        break;
      case "follow_up_schedule":
        result.follow_up_schedule = getSampleFollowUpSchedule();
        break;
      case "care_team":
        result.care_team = getSampleCareTeam();
        break;
      case "emergency_contacts":
        result.emergency_contacts = getSampleEmergencyContacts();
        break;
      case "late_effects_watchlist":
        result.late_effects_watchlist = getSampleLateEffectsWatchlist();
        break;
    }
  });

  return result;
}

router.get("/api/care-packets", (req, res) => {
  const packets = Object.entries(carePacketLabels).map(([type, label]) => ({
    type,
    label,
    description: carePacketDescriptions[type as CarePacketType],
    sections: carePacketContents[type as CarePacketType],
    sectionCount: carePacketContents[type as CarePacketType].length,
  }));

  res.json(packets);
});

router.get("/api/care-packets/:packetType", (req, res) => {
  const { packetType } = req.params;

  if (!Object.keys(carePacketLabels).includes(packetType)) {
    return res.status(404).json({ error: "Invalid packet type" });
  }

  const type = packetType as CarePacketType;
  const sections = carePacketContents[type];

  const packet: CarePacketData = {
    packetType: type,
    generatedAt: new Date().toISOString(),
    patientInfo: getSamplePatientInfo(),
    sections: buildPacketSections(sections),
  };

  res.json(packet);
});

router.get("/api/care-packets/:packetType/preview", (req, res) => {
  const { packetType } = req.params;

  if (!Object.keys(carePacketLabels).includes(packetType)) {
    return res.status(404).json({ error: "Invalid packet type" });
  }

  const type = packetType as CarePacketType;
  
  res.json({
    type,
    label: carePacketLabels[type],
    description: carePacketDescriptions[type],
    includedSections: carePacketContents[type],
    estimatedPages: Math.ceil(carePacketContents[type].length / 3),
  });
});

export default router;
