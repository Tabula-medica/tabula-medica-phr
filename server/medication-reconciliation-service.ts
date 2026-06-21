import type {
  MedicationReconciliation,
  MedicationConflict,
  MergedMedicationGroup,
  MedicationListResponse,
  MedicationConflictType,
} from "@shared/schema";

function normalizeGenericName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectConflicts(medications: MedicationReconciliation[]): MedicationConflict[] {
  const conflicts: MedicationConflict[] = [];
  
  if (medications.length < 2) return conflicts;
  
  const dosages = new Map<string, { facility: string; value: string; lastUpdated: string }>();
  const frequencies = new Map<string, { facility: string; value: string; lastUpdated: string }>();
  const statuses = new Map<string, { facility: string; value: string; lastUpdated: string }>();
  const prescribers = new Map<string, { facility: string; value: string; lastUpdated: string }>();
  
  for (const med of medications) {
    const prescriberValue = med.prescribedBy || "Unknown";
    
    dosages.set(med.facility, { facility: med.facility, value: med.dosage, lastUpdated: med.startDate });
    frequencies.set(med.facility, { facility: med.facility, value: med.frequency, lastUpdated: med.startDate });
    statuses.set(med.facility, { facility: med.facility, value: med.status, lastUpdated: med.startDate });
    prescribers.set(med.facility, { facility: med.facility, value: prescriberValue, lastUpdated: med.startDate });
  }
  
  const medicationName = medications[0].name;
  
  const dosageValues = Array.from(dosages.values());
  const uniqueDosages = new Set(dosageValues.map(d => d.value.toLowerCase().trim()));
  if (uniqueDosages.size > 1) {
    conflicts.push({
      id: `conflict-dose-${medicationName.replace(/\s+/g, '-').toLowerCase()}`,
      medicationName,
      conflictType: "dose_mismatch",
      sources: dosageValues,
      severity: "high",
    });
  }
  
  const frequencyValues = Array.from(frequencies.values());
  const uniqueFrequencies = new Set(frequencyValues.map(f => f.value.toLowerCase().trim()));
  if (uniqueFrequencies.size > 1) {
    conflicts.push({
      id: `conflict-freq-${medicationName.replace(/\s+/g, '-').toLowerCase()}`,
      medicationName,
      conflictType: "frequency_mismatch",
      sources: frequencyValues,
      severity: "medium",
    });
  }
  
  const statusValues = Array.from(statuses.values());
  const uniqueStatuses = new Set(statusValues.map(s => s.value));
  if (uniqueStatuses.size > 1) {
    conflicts.push({
      id: `conflict-status-${medicationName.replace(/\s+/g, '-').toLowerCase()}`,
      medicationName,
      conflictType: "status_mismatch",
      sources: statusValues,
      severity: "medium",
    });
  }
  
  const prescriberValues = Array.from(prescribers.values());
  const uniquePrescribers = new Set(prescriberValues.map(p => p.value.toLowerCase().trim()));
  if (uniquePrescribers.size > 1) {
    conflicts.push({
      id: `conflict-prescriber-${medicationName.replace(/\s+/g, '-').toLowerCase()}`,
      medicationName,
      conflictType: "prescriber_mismatch",
      sources: prescriberValues,
      severity: "low",
    });
  }
  
  return conflicts;
}

export function mergeMedications(medications: MedicationReconciliation[]): MergedMedicationGroup[] {
  const groups = new Map<string, MedicationReconciliation[]>();
  
  for (const med of medications) {
    const normalizedName = normalizeGenericName(med.genericName || med.name);
    const existing = groups.get(normalizedName) || [];
    existing.push(med);
    groups.set(normalizedName, existing);
  }
  
  const mergedGroups: MergedMedicationGroup[] = [];
  
  groups.forEach((meds, key) => {
    meds.sort((a: MedicationReconciliation, b: MedicationReconciliation) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    
    const primary = meds[0];
    const duplicates = meds.slice(1);
    const conflicts = detectConflicts(meds);
    
    mergedGroups.push({
      id: `group-${key}`,
      name: primary.name,
      genericName: primary.genericName,
      primaryMedication: primary,
      duplicates,
      conflicts,
      hasConflicts: conflicts.length > 0,
      sourceCount: meds.length,
      status: primary.status,
    });
  });
  
  mergedGroups.sort((a, b) => a.name.localeCompare(b.name));
  
  return mergedGroups;
}

export function getMedicationListResponse(medications: MedicationReconciliation[]): MedicationListResponse {
  const currentMeds = medications.filter(m => m.status === "active");
  const allMeds = medications;
  
  const currentMerged = mergeMedications(currentMeds);
  const allMerged = mergeMedications(allMeds);
  
  const conflictCount = currentMerged.reduce((sum, g) => sum + g.conflicts.length, 0);
  const duplicateCount = currentMerged.reduce((sum, g) => sum + g.duplicates.length, 0);
  
  return {
    currentMedications: currentMerged,
    allMedications: allMerged,
    totalCurrent: currentMerged.length,
    totalAll: allMerged.length,
    conflictCount,
    duplicateCount,
  };
}

export function generateMockMedications(patientId: string): MedicationReconciliation[] {
  return [
    {
      id: "med-1",
      patientId,
      ehrConnectionId: "conn-1",
      name: "Lisinopril",
      genericName: "lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      route: "oral",
      prescribedBy: "Dr. Smith",
      startDate: "2024-01-15",
      status: "active",
      patientReported: "taking",
      isPrimary: true,
      refillsRemaining: 3,
      facility: "City General Hospital",
    },
    {
      id: "med-2",
      patientId,
      ehrConnectionId: "conn-2",
      name: "Lisinopril",
      genericName: "lisinopril",
      dosage: "20mg",
      frequency: "Once daily",
      route: "oral",
      prescribedBy: "Dr. Johnson",
      startDate: "2024-03-10",
      status: "active",
      patientReported: "taking",
      isPrimary: false,
      refillsRemaining: 2,
      facility: "Community Clinic",
    },
    {
      id: "med-3",
      patientId,
      ehrConnectionId: "conn-1",
      name: "Metformin",
      genericName: "metformin",
      dosage: "500mg",
      frequency: "Twice daily",
      route: "oral",
      prescribedBy: "Dr. Smith",
      startDate: "2023-06-20",
      status: "active",
      patientReported: "taking",
      isPrimary: true,
      refillsRemaining: 5,
      facility: "City General Hospital",
    },
    {
      id: "med-4",
      patientId,
      ehrConnectionId: "conn-1",
      name: "Atorvastatin",
      genericName: "atorvastatin",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      route: "oral",
      prescribedBy: "Dr. Smith",
      startDate: "2023-09-15",
      status: "active",
      patientReported: "taking",
      isPrimary: true,
      refillsRemaining: 4,
      facility: "City General Hospital",
    },
    {
      id: "med-5",
      patientId,
      ehrConnectionId: "conn-3",
      name: "Atorvastatin",
      genericName: "atorvastatin",
      dosage: "40mg",
      frequency: "Once daily",
      route: "oral",
      prescribedBy: "Dr. Chen",
      startDate: "2024-02-01",
      status: "active",
      patientReported: "unknown",
      isPrimary: false,
      refillsRemaining: 6,
      facility: "Heart Care Center",
    },
    {
      id: "med-6",
      patientId,
      ehrConnectionId: "conn-1",
      name: "Omeprazole",
      genericName: "omeprazole",
      dosage: "20mg",
      frequency: "Once daily before breakfast",
      route: "oral",
      prescribedBy: "Dr. Smith",
      startDate: "2024-01-01",
      status: "discontinued",
      endDate: "2024-04-01",
      patientReported: "not_taking",
      isPrimary: true,
      refillsRemaining: 0,
      facility: "City General Hospital",
    },
    {
      id: "med-7",
      patientId,
      ehrConnectionId: "conn-1",
      name: "Amlodipine",
      genericName: "amlodipine",
      dosage: "5mg",
      frequency: "Once daily",
      route: "oral",
      prescribedBy: "Dr. Smith",
      startDate: "2024-02-15",
      status: "active",
      patientReported: "taking",
      isPrimary: true,
      refillsRemaining: 3,
      facility: "City General Hospital",
    },
    {
      id: "med-8",
      patientId,
      ehrConnectionId: "conn-2",
      name: "Metformin ER",
      genericName: "metformin",
      dosage: "750mg",
      frequency: "Once daily with dinner",
      route: "oral",
      prescribedBy: "Dr. Patel",
      startDate: "2024-01-20",
      status: "active",
      patientReported: "taking",
      isPrimary: false,
      refillsRemaining: 4,
      facility: "Diabetes Care Center",
    },
  ];
}
