import {
  UspstfRecommendation,
  CareGap,
  VaccinationRecord,
  PatientPreventiveSummary,
  CareGapStatus,
  CareGapPriority,
  RecommendationCategory,
} from "@shared/schema";

const USPSTF_RECOMMENDATIONS: UspstfRecommendation[] = [
  {
    id: "rec-breast-cancer-screening",
    code: "USPSTF-BREAST-001",
    title: "Breast Cancer Screening (Mammography)",
    description: "Biennial screening mammography for women aged 50-74 years",
    category: "cancer_screening",
    grade: "B",
    ageRangeStart: 50,
    ageRangeEnd: 74,
    gender: "female",
    frequency: "Every 2 years",
    frequencyMonths: 24,
    cptCodes: ["77067", "77066"],
    icd10Codes: ["Z12.31"],
    evidenceSummary: "There is high certainty that the net benefit of screening mammography in women aged 50 to 74 years is moderate.",
    patientEducation: "Mammograms can find breast cancer early when it's easier to treat. Talk to your doctor about when to start and how often to get screened.",
    lastUpdated: "2024-04-01",
  },
  {
    id: "rec-cervical-cancer-screening",
    code: "USPSTF-CERVICAL-001",
    title: "Cervical Cancer Screening",
    description: "Cervical cancer screening every 3 years with cervical cytology alone or every 5 years with high-risk HPV testing",
    category: "cancer_screening",
    grade: "A",
    ageRangeStart: 21,
    ageRangeEnd: 65,
    gender: "female",
    frequency: "Every 3-5 years",
    frequencyMonths: 36,
    cptCodes: ["88141", "88142", "87624"],
    icd10Codes: ["Z12.4"],
    evidenceSummary: "There is high certainty that the net benefit of screening for cervical cancer is substantial.",
    patientEducation: "Regular Pap smears and HPV tests can prevent cervical cancer by finding abnormal cells before they become cancer.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "rec-colorectal-cancer-screening",
    code: "USPSTF-COLORECTAL-001",
    title: "Colorectal Cancer Screening",
    description: "Screening for colorectal cancer starting at age 45 and continuing until age 75",
    category: "cancer_screening",
    grade: "A",
    ageRangeStart: 45,
    ageRangeEnd: 75,
    gender: "all",
    frequency: "Varies by method",
    frequencyMonths: 12,
    cptCodes: ["45378", "82270", "81528"],
    icd10Codes: ["Z12.11", "Z12.12"],
    evidenceSummary: "There is high certainty that screening for colorectal cancer has substantial net benefit.",
    patientEducation: "Colorectal cancer is highly treatable when found early. Options include colonoscopy, stool tests, and other methods.",
    lastUpdated: "2024-03-01",
  },
  {
    id: "rec-lung-cancer-screening",
    code: "USPSTF-LUNG-001",
    title: "Lung Cancer Screening",
    description: "Annual low-dose CT screening for adults aged 50-80 with significant smoking history",
    category: "cancer_screening",
    grade: "B",
    ageRangeStart: 50,
    ageRangeEnd: 80,
    gender: "all",
    frequency: "Annually",
    frequencyMonths: 12,
    riskFactors: ["20 pack-year smoking history", "Current smoker or quit within 15 years"],
    cptCodes: ["71271"],
    icd10Codes: ["Z87.891"],
    evidenceSummary: "Low-dose CT screening for lung cancer in high-risk individuals reduces lung cancer mortality.",
    patientEducation: "If you have a history of heavy smoking, a low-dose CT scan can find lung cancer early when treatment is most effective.",
    lastUpdated: "2024-02-01",
  },
  {
    id: "rec-diabetes-screening",
    code: "USPSTF-DIABETES-001",
    title: "Prediabetes and Type 2 Diabetes Screening",
    description: "Screening for prediabetes and type 2 diabetes in adults aged 35-70 who are overweight or obese",
    category: "metabolic",
    grade: "B",
    ageRangeStart: 35,
    ageRangeEnd: 70,
    gender: "all",
    frequency: "Every 3 years",
    frequencyMonths: 36,
    riskFactors: ["Overweight (BMI >= 25)", "Obese (BMI >= 30)"],
    cptCodes: ["82947", "83036"],
    icd10Codes: ["Z13.1"],
    evidenceSummary: "There is adequate evidence that screening for prediabetes and type 2 diabetes can identify people at high risk.",
    patientEducation: "Early detection of diabetes or prediabetes allows for lifestyle changes and treatments that can prevent serious health problems.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-hypertension-screening",
    code: "USPSTF-HTN-001",
    title: "High Blood Pressure Screening",
    description: "Screening for high blood pressure in adults aged 18 years or older",
    category: "cardiovascular",
    grade: "A",
    ageRangeStart: 18,
    ageRangeEnd: 100,
    gender: "all",
    frequency: "Annually",
    frequencyMonths: 12,
    cptCodes: ["99211", "99213"],
    icd10Codes: ["Z13.6"],
    evidenceSummary: "There is high certainty that screening for high blood pressure has substantial net benefit.",
    patientEducation: "High blood pressure often has no symptoms but can lead to heart disease and stroke. Regular checks help catch it early.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-cholesterol-screening",
    code: "USPSTF-LIPID-001",
    title: "Lipid Disorders Screening",
    description: "Screening for lipid disorders in adults aged 40-75 years",
    category: "cardiovascular",
    grade: "B",
    ageRangeStart: 40,
    ageRangeEnd: 75,
    gender: "all",
    frequency: "Every 5 years",
    frequencyMonths: 60,
    cptCodes: ["80061", "82465"],
    icd10Codes: ["Z13.220"],
    evidenceSummary: "Statin use reduces cardiovascular events and mortality in adults at increased risk.",
    patientEducation: "Knowing your cholesterol levels helps assess your heart disease risk and determine if you need treatment.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-depression-screening",
    code: "USPSTF-DEPRESSION-001",
    title: "Depression Screening",
    description: "Screening for depression in the general adult population",
    category: "mental_health",
    grade: "B",
    ageRangeStart: 18,
    ageRangeEnd: 100,
    gender: "all",
    frequency: "Annually",
    frequencyMonths: 12,
    cptCodes: ["96127"],
    icd10Codes: ["Z13.89"],
    evidenceSummary: "There is adequate evidence that screening improves the accurate identification of adult patients with depression.",
    patientEducation: "Depression is common and treatable. Screening helps identify it early so you can get the support you need.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-osteoporosis-screening",
    code: "USPSTF-OSTEO-001",
    title: "Osteoporosis Screening",
    description: "Screening for osteoporosis with bone measurement testing in women aged 65 years and older",
    category: "musculoskeletal",
    grade: "B",
    ageRangeStart: 65,
    ageRangeEnd: 100,
    gender: "female",
    frequency: "Every 2 years",
    frequencyMonths: 24,
    cptCodes: ["77080", "77081"],
    icd10Codes: ["Z13.820"],
    evidenceSummary: "Screening and treatment can reduce the risk of osteoporotic fractures.",
    patientEducation: "Bone density testing can find weak bones before a fracture happens, allowing for treatment to strengthen them.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-abdominal-aortic-aneurysm",
    code: "USPSTF-AAA-001",
    title: "Abdominal Aortic Aneurysm Screening",
    description: "One-time screening with ultrasonography for men aged 65-75 who have ever smoked",
    category: "cardiovascular",
    grade: "B",
    ageRangeStart: 65,
    ageRangeEnd: 75,
    gender: "male",
    frequency: "One-time",
    frequencyMonths: 0,
    riskFactors: ["Ever smoked"],
    cptCodes: ["76706"],
    icd10Codes: ["Z13.6"],
    evidenceSummary: "Screening for AAA with ultrasonography in men aged 65-75 who have ever smoked is associated with reduced AAA-related mortality.",
    patientEducation: "An abdominal aortic aneurysm is a bulge in the main blood vessel. Finding it early can prevent a life-threatening rupture.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-hep-c-screening",
    code: "USPSTF-HEPC-001",
    title: "Hepatitis C Screening",
    description: "One-time screening for hepatitis C virus infection in adults aged 18-79 years",
    category: "infectious_disease",
    grade: "B",
    ageRangeStart: 18,
    ageRangeEnd: 79,
    gender: "all",
    frequency: "One-time (or periodic with risk factors)",
    frequencyMonths: 0,
    cptCodes: ["86803", "87520"],
    icd10Codes: ["Z11.59"],
    evidenceSummary: "Screening for HCV infection in adults has high accuracy, and antiviral treatment is highly effective.",
    patientEducation: "Hepatitis C often has no symptoms for years but can damage your liver. New treatments can cure most cases.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-hiv-screening",
    code: "USPSTF-HIV-001",
    title: "HIV Screening",
    description: "Screening for HIV infection in adolescents and adults aged 15-65 years",
    category: "infectious_disease",
    grade: "A",
    ageRangeStart: 15,
    ageRangeEnd: 65,
    gender: "all",
    frequency: "At least once; annually for high-risk",
    frequencyMonths: 12,
    cptCodes: ["86701", "87389"],
    icd10Codes: ["Z11.4"],
    evidenceSummary: "Screening for HIV infection is highly accurate, and early treatment is very effective.",
    patientEducation: "HIV testing is quick and confidential. Early treatment helps people with HIV live long, healthy lives.",
    lastUpdated: "2024-01-01",
  },
  {
    id: "rec-prostate-cancer-screening",
    code: "USPSTF-PROSTATE-001",
    title: "Prostate Cancer Screening (PSA)",
    description: "Discuss prostate cancer screening with men aged 55-69 years to allow informed decision-making",
    category: "men_health",
    grade: "C",
    ageRangeStart: 55,
    ageRangeEnd: 69,
    gender: "male",
    frequency: "Discuss with provider",
    frequencyMonths: 24,
    cptCodes: ["84153"],
    icd10Codes: ["Z12.5"],
    evidenceSummary: "The decision to undergo PSA-based screening should be an individual one after discussing potential benefits and harms.",
    patientEducation: "PSA testing for prostate cancer has both benefits and risks. Talk with your doctor about what's right for you.",
    lastUpdated: "2024-01-01",
  },
];

const VACCINATION_SCHEDULE: {
  vaccineName: string;
  ageStart: number;
  ageEnd: number;
  gender: "male" | "female" | "all";
  frequency: string;
  frequencyMonths: number;
  description: string;
}[] = [
  {
    vaccineName: "Influenza (Flu)",
    ageStart: 6,
    ageEnd: 100,
    gender: "all",
    frequency: "Annually",
    frequencyMonths: 12,
    description: "Annual flu vaccination is recommended for everyone 6 months and older",
  },
  {
    vaccineName: "COVID-19",
    ageStart: 6,
    ageEnd: 100,
    gender: "all",
    frequency: "Per CDC guidance",
    frequencyMonths: 12,
    description: "COVID-19 vaccination and boosters per current CDC recommendations",
  },
  {
    vaccineName: "Tdap/Td (Tetanus, Diphtheria, Pertussis)",
    ageStart: 19,
    ageEnd: 100,
    gender: "all",
    frequency: "Every 10 years",
    frequencyMonths: 120,
    description: "Tetanus booster every 10 years, with Tdap once for adults",
  },
  {
    vaccineName: "Shingles (Zoster)",
    ageStart: 50,
    ageEnd: 100,
    gender: "all",
    frequency: "Two-dose series",
    frequencyMonths: 0,
    description: "Shingrix vaccine is recommended as a two-dose series for adults 50 and older",
  },
  {
    vaccineName: "Pneumococcal (PCV20 or PPSV23)",
    ageStart: 65,
    ageEnd: 100,
    gender: "all",
    frequency: "One-time or series",
    frequencyMonths: 0,
    description: "Pneumococcal vaccination recommended for adults 65 and older",
  },
  {
    vaccineName: "HPV (Human Papillomavirus)",
    ageStart: 9,
    ageEnd: 45,
    gender: "all",
    frequency: "2-3 dose series",
    frequencyMonths: 0,
    description: "HPV vaccine series recommended up to age 26, may be given through age 45",
  },
  {
    vaccineName: "Hepatitis B",
    ageStart: 19,
    ageEnd: 59,
    gender: "all",
    frequency: "3-dose series",
    frequencyMonths: 0,
    description: "Hepatitis B vaccine series for adults 19-59 without prior vaccination",
  },
  {
    vaccineName: "MMR (Measles, Mumps, Rubella)",
    ageStart: 19,
    ageEnd: 100,
    gender: "all",
    frequency: "If not previously vaccinated",
    frequencyMonths: 0,
    description: "Adults born after 1957 without evidence of immunity should receive at least 1 dose",
  },
];

interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
  dateOfBirth: string;
  conditions: string[];
  riskFactors: string[];
  lastVisit?: string;
}

const samplePatientProfiles: PatientProfile[] = [
  {
    id: "patient-001",
    name: "Sarah Johnson",
    age: 52,
    gender: "female",
    dateOfBirth: "1973-05-15",
    conditions: ["Type 2 Diabetes", "Hypertension"],
    riskFactors: ["Overweight", "Family history of heart disease"],
    lastVisit: "2025-12-01",
  },
  {
    id: "patient-002",
    name: "Michael Chen",
    age: 67,
    gender: "male",
    dateOfBirth: "1958-08-22",
    conditions: ["Hyperlipidemia"],
    riskFactors: ["Former smoker", "Sedentary lifestyle"],
    lastVisit: "2025-11-15",
  },
];

const sampleVaccinations: VaccinationRecord[] = [
  {
    id: "vax-001",
    patientId: "patient-001",
    vaccineName: "Influenza (Flu)",
    cvxCode: "158",
    manufacturer: "Sanofi Pasteur",
    lotNumber: "FL2025A",
    administrationDate: "2025-10-15",
    site: "Left deltoid",
    route: "Intramuscular",
    administeredBy: "Dr. Emily Wilson",
    facility: "Community Health Clinic",
    status: "completed",
  },
  {
    id: "vax-002",
    patientId: "patient-001",
    vaccineName: "COVID-19",
    cvxCode: "229",
    manufacturer: "Pfizer-BioNTech",
    lotNumber: "CV2025B",
    administrationDate: "2025-09-01",
    site: "Right deltoid",
    route: "Intramuscular",
    administeredBy: "Nurse Practitioner",
    facility: "Pharmacy",
    status: "completed",
  },
  {
    id: "vax-003",
    patientId: "patient-001",
    vaccineName: "Tdap/Td",
    cvxCode: "115",
    administrationDate: "2022-03-10",
    status: "completed",
  },
];

const sampleCareGaps: CareGap[] = [
  {
    id: "gap-001",
    patientId: "patient-001",
    recommendationId: "rec-breast-cancer-screening",
    recommendation: USPSTF_RECOMMENDATIONS.find(r => r.id === "rec-breast-cancer-screening")!,
    status: "open",
    priority: "high",
    dueDate: "2026-02-15",
    lastCompletedDate: "2024-01-20",
    identifiedAt: "2026-01-01",
    aiReasoning: "Patient is 52 years old, female. Last mammogram was over 2 years ago. Recommend scheduling screening.",
  },
  {
    id: "gap-002",
    patientId: "patient-001",
    recommendationId: "rec-colorectal-cancer-screening",
    recommendation: USPSTF_RECOMMENDATIONS.find(r => r.id === "rec-colorectal-cancer-screening")!,
    status: "open",
    priority: "medium",
    dueDate: "2026-03-01",
    identifiedAt: "2026-01-01",
    aiReasoning: "Patient is 52, no record of colorectal cancer screening. Recommend discussion of screening options.",
  },
  {
    id: "gap-003",
    patientId: "patient-001",
    recommendationId: "rec-depression-screening",
    recommendation: USPSTF_RECOMMENDATIONS.find(r => r.id === "rec-depression-screening")!,
    status: "addressed",
    priority: "low",
    lastCompletedDate: "2025-12-01",
    identifiedAt: "2025-11-01",
    addressedAt: "2025-12-01",
    notes: "PHQ-9 completed during annual visit. Score: 3 (minimal symptoms)",
  },
];

const preventiveAppointmentSlots = [
  { id: "slot-1", date: "2026-01-20", time: "09:00 AM", provider: "Dr. Emily Wilson", specialty: "Primary Care", available: true },
  { id: "slot-2", date: "2026-01-20", time: "10:30 AM", provider: "Dr. Emily Wilson", specialty: "Primary Care", available: true },
  { id: "slot-3", date: "2026-01-21", time: "02:00 PM", provider: "Dr. Sarah Martinez", specialty: "Radiology", available: true },
  { id: "slot-4", date: "2026-01-22", time: "08:30 AM", provider: "Dr. James Thompson", specialty: "Gastroenterology", available: true },
  { id: "slot-5", date: "2026-01-23", time: "11:00 AM", provider: "Dr. Lisa Chen", specialty: "Women's Health", available: true },
  { id: "slot-6", date: "2026-01-24", time: "03:30 PM", provider: "Dr. Emily Wilson", specialty: "Primary Care", available: true },
];

class PreventiveCareService {
  getRecommendations(): UspstfRecommendation[] {
    return USPSTF_RECOMMENDATIONS;
  }

  getPersonalizedRecommendations(
    patientId: string,
    age: number,
    gender: "male" | "female",
    conditions: string[] = [],
    riskFactors: string[] = []
  ): UspstfRecommendation[] {
    return USPSTF_RECOMMENDATIONS.filter((rec) => {
      if (age < rec.ageRangeStart || age > rec.ageRangeEnd) return false;
      if (rec.gender !== "all" && rec.gender !== gender) return false;

      if (rec.riskFactors && rec.riskFactors.length > 0) {
        const hasMatchingRiskFactor = rec.riskFactors.some((rf) =>
          riskFactors.some((prf) => prf.toLowerCase().includes(rf.toLowerCase().split(" ")[0]))
        );
        if (!hasMatchingRiskFactor && rec.grade !== "A") {
          return false;
        }
      }

      return true;
    });
  }

  getVaccinationRecommendations(age: number, gender: "male" | "female") {
    return VACCINATION_SCHEDULE.filter((vax) => {
      if (age < vax.ageStart || age > vax.ageEnd) return false;
      if (vax.gender !== "all" && vax.gender !== gender) return false;
      return true;
    });
  }

  getCareGaps(patientId: string): CareGap[] {
    return sampleCareGaps.filter((gap) => gap.patientId === patientId);
  }

  getVaccinationHistory(patientId: string): VaccinationRecord[] {
    return sampleVaccinations.filter((vax) => vax.patientId === patientId);
  }

  getPreventiveSummary(patientId: string): PatientPreventiveSummary | null {
    const patient = samplePatientProfiles.find((p) => p.id === patientId);
    if (!patient) {
      const defaultPatient: PatientProfile = {
        id: patientId,
        name: "Sample Patient",
        age: 52,
        gender: "female",
        dateOfBirth: "1973-05-15",
        conditions: ["Type 2 Diabetes", "Hypertension"],
        riskFactors: ["Overweight"],
      };
      return this.buildSummary(defaultPatient);
    }
    return this.buildSummary(patient);
  }

  private buildSummary(patient: PatientProfile): PatientPreventiveSummary {
    const recommendations = this.getPersonalizedRecommendations(
      patient.id,
      patient.age,
      patient.gender,
      patient.conditions,
      patient.riskFactors
    );

    const careGaps = this.getCareGaps(patient.id);
    const vaccinationHistory = this.getVaccinationHistory(patient.id);

    const openGaps = careGaps.filter((g) => g.status === "open");
    const addressedGaps = careGaps.filter((g) => g.status === "addressed");
    const complianceScore = careGaps.length > 0 
      ? Math.round((addressedGaps.length / careGaps.length) * 100) 
      : 100;

    const nextActions = openGaps.map((gap) => ({
      action: gap.recommendation.title,
      priority: gap.priority,
      dueDate: gap.dueDate,
      reasoning: gap.aiReasoning,
    }));

    return {
      patientId: patient.id,
      patientName: patient.name,
      age: patient.age,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      recommendations,
      careGaps,
      vaccinationHistory,
      lastScreenings: [
        { screeningType: "Blood Pressure", date: "2025-12-01", result: "128/82 mmHg", provider: "Dr. Emily Wilson" },
        { screeningType: "HbA1c", date: "2025-11-15", result: "6.8%", provider: "Dr. Emily Wilson" },
        { screeningType: "Lipid Panel", date: "2025-10-20", result: "Total cholesterol: 195 mg/dL", provider: "Dr. Emily Wilson" },
      ],
      riskFactors: patient.riskFactors,
      aiSummary: `Based on your age (${patient.age}), gender, and health conditions, we've identified ${openGaps.length} preventive care opportunities. ${openGaps.length > 0 ? `Top priority: ${openGaps[0]?.recommendation.title}` : "You're up to date on your preventive care!"}`,
      aiGeneratedAt: new Date().toISOString(),
      overallComplianceScore: complianceScore,
      nextActions,
    };
  }

  updateCareGapStatus(
    gapId: string,
    status: CareGapStatus,
    notes?: string,
    declinedReason?: string
  ): CareGap | null {
    const gapIndex = sampleCareGaps.findIndex((g) => g.id === gapId);
    if (gapIndex === -1) return null;

    const gap = sampleCareGaps[gapIndex];
    gap.status = status;
    if (notes) gap.notes = notes;
    if (declinedReason) gap.declinedReason = declinedReason;
    if (status === "addressed") {
      gap.addressedAt = new Date().toISOString();
      gap.lastCompletedDate = new Date().toISOString().split("T")[0];
    }

    return gap;
  }

  getAvailableAppointmentSlots(screeningType?: string) {
    return preventiveAppointmentSlots.filter((slot) => slot.available);
  }

  schedulePreventiveAppointment(
    patientId: string,
    slotId: string,
    careGapId?: string,
    notes?: string
  ): { success: boolean; appointment?: any; error?: string } {
    const slotIndex = preventiveAppointmentSlots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) {
      return { success: false, error: "Appointment slot not found" };
    }

    const slot = preventiveAppointmentSlots[slotIndex];
    if (!slot.available) {
      return { success: false, error: "Appointment slot is no longer available" };
    }

    slot.available = false;

    if (careGapId) {
      const gap = sampleCareGaps.find((g) => g.id === careGapId);
      if (gap) {
        gap.status = "in_progress";
        gap.notes = `Appointment scheduled for ${slot.date} at ${slot.time}`;
      }
    }

    return {
      success: true,
      appointment: {
        id: `appt-${Date.now()}`,
        patientId,
        slotId,
        careGapId,
        date: slot.date,
        time: slot.time,
        provider: slot.provider,
        specialty: slot.specialty,
        status: "confirmed",
        notes,
        createdAt: new Date().toISOString(),
      },
    };
  }

  getVaccinationGaps(patientId: string, age: number, gender: "male" | "female") {
    const recommendedVaccines = this.getVaccinationRecommendations(age, gender);
    const history = this.getVaccinationHistory(patientId);

    return recommendedVaccines.map((vax) => {
      const lastDose = history
        .filter((h) => h.vaccineName === vax.vaccineName && h.status === "completed")
        .sort((a, b) => new Date(b.administrationDate).getTime() - new Date(a.administrationDate).getTime())[0];

      let status: "overdue" | "due_soon" | "up_to_date" = "up_to_date";
      let nextDueDate: string | undefined;

      if (!lastDose) {
        status = vax.frequencyMonths > 0 ? "overdue" : "due_soon";
      } else if (vax.frequencyMonths > 0) {
        const lastDate = new Date(lastDose.administrationDate);
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + vax.frequencyMonths);
        nextDueDate = nextDate.toISOString().split("T")[0];

        const now = new Date();
        if (nextDate < now) {
          status = "overdue";
        } else {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          if (nextDate <= thirtyDaysFromNow) {
            status = "due_soon";
          }
        }
      }

      return {
        vaccineName: vax.vaccineName,
        status,
        lastDose: lastDose?.administrationDate,
        nextDueDate,
        recommendation: vax.description,
      };
    });
  }

  getPreventiveCareProgress(patientId: string): {
    screeningsCompleted: number;
    screeningsTotal: number;
    vaccinationsUpToDate: number;
    vaccinationsTotal: number;
    overallProgress: number;
    streak: number;
  } {
    const summary = this.getPreventiveSummary(patientId);
    if (!summary) {
      return {
        screeningsCompleted: 0,
        screeningsTotal: 0,
        vaccinationsUpToDate: 0,
        vaccinationsTotal: 0,
        overallProgress: 0,
        streak: 0,
      };
    }

    const addressedGaps = summary.careGaps.filter((g) => g.status === "addressed").length;
    const totalGaps = summary.careGaps.length;

    const vaccineGaps = this.getVaccinationGaps(patientId, summary.age, summary.gender as "male" | "female");
    const upToDateVaccines = vaccineGaps.filter((v) => v.status === "up_to_date").length;

    const overallProgress = totalGaps + vaccineGaps.length > 0
      ? Math.round(((addressedGaps + upToDateVaccines) / (totalGaps + vaccineGaps.length)) * 100)
      : 100;

    return {
      screeningsCompleted: addressedGaps,
      screeningsTotal: totalGaps,
      vaccinationsUpToDate: upToDateVaccines,
      vaccinationsTotal: vaccineGaps.length,
      overallProgress,
      streak: 3,
    };
  }
}

export const preventiveCareService = new PreventiveCareService();
