/**
 * Medication Management Service
 * 
 * Provides medication tracking, educational information, and reminder functionality.
 * 
 * SAFETY GUIDELINES (CRITICAL):
 * - NO medication interaction advice or warnings
 * - NO side effect interpretation or risk assessment
 * - NO dosage recommendations
 * - Only approved safe verbs: "shows", "states", "refers to", "means"
 * - Quote-first approach with source attribution
 * - Frame as "things your clinician might suggest discussing"
 * - Disclaimer: "Informational only. Not medical advice."
 */

export interface ActiveMedication {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  lastFillDate?: string;
  refillsRemaining?: number;
  pharmacy?: string;
  quote: string;
  source: string;
  sourceDate: string;
  sourceLink: string;
}

export interface MedicationEducation {
  medicationId: string;
  medicationName: string;
  whatItMeans: string;
  commonUses: string;
  howItWorks: string;
  discussionPrompts: string[];
  quote: string;
  source: string;
}

export interface MedicationReminder {
  id: string;
  type: "refill" | "adherence" | "appointment";
  medicationId: string;
  medicationName: string;
  message: string;
  dueDate?: string;
  sourceLink: string;
}

export interface MedicationManagementResponse {
  activeMedications: ActiveMedication[];
  educationalInfo: MedicationEducation[];
  reminders: MedicationReminder[];
  summary: {
    totalMedications: number;
    prescribers: string[];
    lastUpdated: string;
  };
  disclaimer: string;
}

/**
 * Get active medications from patient records
 * Returns medications with quote-first format and source attribution
 */
export function getActiveMedications(): ActiveMedication[] {
  return [
    {
      id: "med-1",
      name: "Metformin",
      genericName: "Metformin Hydrochloride",
      dosage: "500mg",
      frequency: "Twice daily",
      prescriber: "Dr. Sarah Johnson, MD",
      startDate: "2022-06-15",
      lastFillDate: "2024-01-02",
      refillsRemaining: 2,
      pharmacy: "CVS Pharmacy #1234",
      quote: "Metformin 500mg tablets, take one tablet by mouth twice daily with meals",
      source: "Prescription Record - Primary Care",
      sourceDate: "2024-01-02",
      sourceLink: "/medications",
    },
    {
      id: "med-2",
      name: "Lisinopril",
      genericName: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      prescriber: "Dr. Sarah Johnson, MD",
      startDate: "2021-03-20",
      lastFillDate: "2024-01-10",
      refillsRemaining: 5,
      pharmacy: "CVS Pharmacy #1234",
      quote: "Lisinopril 10mg tablets, take one tablet by mouth once daily",
      source: "Prescription Record - Primary Care",
      sourceDate: "2024-01-10",
      sourceLink: "/medications",
    },
    {
      id: "med-3",
      name: "Atorvastatin",
      genericName: "Atorvastatin Calcium",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      prescriber: "Dr. Sarah Johnson, MD",
      startDate: "2021-09-01",
      lastFillDate: "2023-12-15",
      refillsRemaining: 1,
      pharmacy: "CVS Pharmacy #1234",
      quote: "Atorvastatin 20mg tablets, take one tablet by mouth at bedtime",
      source: "Prescription Record - Primary Care",
      sourceDate: "2023-12-15",
      sourceLink: "/medications",
    },
    {
      id: "med-4",
      name: "Aspirin",
      genericName: "Acetylsalicylic Acid",
      dosage: "81mg",
      frequency: "Once daily",
      prescriber: "Dr. Michael Chen, MD (Cardiology)",
      startDate: "2023-06-01",
      lastFillDate: "2024-01-05",
      refillsRemaining: 11,
      pharmacy: "Walgreens #5678",
      quote: "Aspirin 81mg enteric-coated tablets, take one tablet by mouth once daily",
      source: "Prescription Record - Cardiology",
      sourceDate: "2024-01-05",
      sourceLink: "/medications",
    },
    {
      id: "med-5",
      name: "Vitamin D3",
      genericName: "Cholecalciferol",
      dosage: "2000 IU",
      frequency: "Once daily",
      prescriber: "Dr. Sarah Johnson, MD",
      startDate: "2023-01-15",
      lastFillDate: "2023-11-20",
      refillsRemaining: 3,
      pharmacy: "CVS Pharmacy #1234",
      quote: "Vitamin D3 2000 IU capsules, take one capsule by mouth once daily",
      source: "Prescription Record - Primary Care",
      sourceDate: "2023-11-20",
      sourceLink: "/medications",
    },
  ];
}

/**
 * Get educational information about medications
 * Uses only safe verbs and quote-first format
 * NO clinical interpretation or advice
 */
export function getMedicationEducation(medications: ActiveMedication[]): MedicationEducation[] {
  const educationData: Record<string, Omit<MedicationEducation, "medicationId" | "medicationName">> = {
    "Metformin": {
      whatItMeans: "The FDA label states Metformin refers to a biguanide medication.",
      commonUses: "The package label states this medication is indicated for blood sugar management.",
      howItWorks: "The FDA label states this medication refers to glucose metabolism.",
      discussionPrompts: [
        "What does this medication mean for my care?",
        "What does the label show about this medication?",
        "What does this refer to in my treatment plan?",
      ],
      quote: "Metformin hydrochloride is a biguanide antihyperglycemic agent",
      source: "FDA Drug Label Information",
    },
    "Lisinopril": {
      whatItMeans: "The FDA label states Lisinopril refers to an ACE inhibitor.",
      commonUses: "The package label states this medication is indicated for blood pressure.",
      howItWorks: "The FDA label states this medication refers to enzyme inhibition.",
      discussionPrompts: [
        "What does this medication mean for my care?",
        "What does the label show about this medication?",
        "What does this refer to in my treatment plan?",
      ],
      quote: "Lisinopril is an angiotensin-converting enzyme inhibitor",
      source: "FDA Drug Label Information",
    },
    "Atorvastatin": {
      whatItMeans: "The FDA label states Atorvastatin refers to a statin medication.",
      commonUses: "The package label states this medication is indicated for cholesterol.",
      howItWorks: "The FDA label states this medication refers to lipid lowering.",
      discussionPrompts: [
        "What does this medication mean for my care?",
        "What does the label show about this medication?",
        "What does this refer to in my treatment plan?",
      ],
      quote: "Atorvastatin calcium is a synthetic lipid-lowering agent",
      source: "FDA Drug Label Information",
    },
    "Aspirin": {
      whatItMeans: "The FDA label states Aspirin refers to a salicylate medication.",
      commonUses: "The package label states low-dose aspirin is indicated for cardiovascular use.",
      howItWorks: "The FDA label states this medication refers to platelet function.",
      discussionPrompts: [
        "What does low-dose aspirin mean for my care?",
        "What does the label show about this medication?",
        "What does enteric-coated mean?",
      ],
      quote: "Aspirin (acetylsalicylic acid) is a non-steroidal anti-inflammatory drug",
      source: "FDA Drug Label Information",
    },
    "Vitamin D3": {
      whatItMeans: "The supplement label states Vitamin D3 refers to cholecalciferol.",
      commonUses: "The package label states this supplement is indicated for vitamin D supplementation.",
      howItWorks: "The supplement label states this refers to calcium absorption.",
      discussionPrompts: [
        "What does vitamin D mean for my health?",
        "What does the label show about this supplement?",
        "What does the dosage refer to?",
      ],
      quote: "Cholecalciferol (Vitamin D3) is a fat-soluble vitamin",
      source: "Supplement Facts Label",
    },
  };

  return medications.map(med => {
    const education = educationData[med.name] || {
      whatItMeans: `Your records show ${med.name} refers to a prescribed medication.`,
      commonUses: "Your prescription record states this medication was prescribed by your provider.",
      howItWorks: "The medication label shows what this medication refers to.",
      discussionPrompts: [
        `What does ${med.name} mean for my health?`,
        "What does this medication refer to in my care?",
        "What does my prescription show about this?",
      ],
      quote: med.quote,
      source: med.source,
    };

    return {
      medicationId: med.id,
      medicationName: med.name,
      ...education,
    };
  });
}

/**
 * Generate gentle reminders for medications
 * Non-clinical, informational only
 */
export function getMedicationReminders(medications: ActiveMedication[]): MedicationReminder[] {
  const reminders: MedicationReminder[] = [];
  const today = new Date();

  medications.forEach(med => {
    // Check for low refills
    if (med.refillsRemaining !== undefined && med.refillsRemaining <= 2) {
      reminders.push({
        id: `reminder-refill-${med.id}`,
        type: "refill",
        medicationId: med.id,
        medicationName: med.name,
        message: `Your records show ${med.refillsRemaining} refill(s) remaining for ${med.name}.`,
        sourceLink: "/medications",
      });
    }

    // Check for medications not filled recently (90+ days)
    if (med.lastFillDate) {
      const lastFill = new Date(med.lastFillDate);
      const daysSinceLastFill = Math.floor((today.getTime() - lastFill.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastFill >= 75) {
        reminders.push({
          id: `reminder-adherence-${med.id}`,
          type: "adherence",
          medicationId: med.id,
          medicationName: med.name,
          message: `Your records show ${med.name} was last filled on ${med.lastFillDate}.`,
          sourceLink: "/medications",
        });
      }
    }
  });

  // Add general record note
  reminders.push({
    id: "reminder-appointment-general",
    type: "appointment",
    medicationId: "",
    medicationName: "",
    message: "Your records show multiple active medications from different prescribers.",
    sourceLink: "/telehealth",
  });

  return reminders;
}

/**
 * Get complete medication management data
 */
export function getMedicationManagementData(): MedicationManagementResponse {
  const activeMedications = getActiveMedications();
  const educationalInfo = getMedicationEducation(activeMedications);
  const reminders = getMedicationReminders(activeMedications);

  const prescribers = Array.from(new Set(activeMedications.map(med => med.prescriber)));

  return {
    activeMedications,
    educationalInfo,
    reminders,
    summary: {
      totalMedications: activeMedications.length,
      prescribers,
      lastUpdated: new Date().toISOString(),
    },
    disclaimer: "Informational only. Not medical advice.",
  };
}
