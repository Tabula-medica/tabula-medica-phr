import { Router } from "express";
import {
  insertMedicationEntrySchema,
  insertSymptomEntrySchema,
  MedicationEntry,
  SymptomEntry,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { verifyCaregiverConsent } from "./caregiver-permissions-routes";

const router = Router();

const medicationsStore: Map<string, MedicationEntry> = new Map();
const symptomsStore: Map<string, SymptomEntry> = new Map();

function initializeSampleData() {
  const sampleProfileId = "profile-default";

  if (medicationsStore.size === 0) {
    const medications: MedicationEntry[] = [
      {
        id: "med-1",
        profileId: sampleProfileId,
        medicationName: "Tamoxifen",
        genericName: "Tamoxifen Citrate",
        dose: "20mg",
        frequency: "Once daily",
        indication: "Breast cancer hormone therapy",
        prescriber: "Dr. Sarah Johnson",
        pharmacy: "City Pharmacy",
        startDate: "2024-11-20",
        isActive: true,
        notes: "Medication prescribed on scheduled timeline.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "med-2",
        profileId: sampleProfileId,
        medicationName: "Ondansetron",
        genericName: "Ondansetron HCl",
        dose: "8mg",
        frequency: "Every 8 hours as needed",
        indication: "Nausea from chemotherapy",
        prescriber: "Dr. Sarah Johnson",
        pharmacy: "City Pharmacy",
        startDate: "2024-05-01",
        stopDate: "2024-09-30",
        isActive: false,
        notes: "Prescribed during chemotherapy treatment period.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "med-3",
        profileId: sampleProfileId,
        medicationName: "Gabapentin",
        genericName: "Gabapentin",
        dose: "300mg",
        frequency: "Three times daily",
        indication: "Chemotherapy-induced neuropathy",
        prescriber: "Dr. Sarah Johnson",
        pharmacy: "City Pharmacy",
        startDate: "2024-07-15",
        isActive: true,
        notes: "Prescribed during treatment period.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    medications.forEach((med) => medicationsStore.set(med.id, med));

    const symptoms: SymptomEntry[] = [
      {
        id: "sym-1",
        profileId: sampleProfileId,
        medicationId: "med-1",
        symptomType: "mood_changes",
        severity: "mild",
        startDate: "2024-12-01",
        isOngoing: true,
        improvesAfterDose: "unknown",
        notes: "Occasional irritability reported",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sym-2",
        profileId: sampleProfileId,
        medicationId: "med-1",
        symptomType: "other",
        customSymptomName: "Hot flashes",
        severity: "mild",
        startDate: "2024-12-01",
        isOngoing: true,
        improvesAfterDose: "no",
        notes: "2-3 episodes per day, mostly at night",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sym-3",
        profileId: sampleProfileId,
        medicationId: "med-3",
        symptomType: "dizziness",
        severity: "mild",
        startDate: "2024-07-20",
        endDate: "2024-08-15",
        isOngoing: false,
        improvesAfterDose: "yes",
        notes: "Dizziness reported at medication start.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sym-4",
        profileId: sampleProfileId,
        medicationId: "med-2",
        symptomType: "constipation",
        severity: "moderate",
        startDate: "2024-05-05",
        endDate: "2024-10-05",
        isOngoing: false,
        improvesAfterDose: "no",
        notes: "Symptom logged during medication period",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    symptoms.forEach((sym) => symptomsStore.set(sym.id, sym));
  }
}

initializeSampleData();

router.get("/api/side-effects/medications", (req, res) => {
  const { profileId, active } = req.query;
  let medications = Array.from(medicationsStore.values());

  if (profileId) {
    medications = medications.filter((m) => m.profileId === profileId);
  }

  if (active === "true") {
    medications = medications.filter((m) => m.isActive);
  } else if (active === "false") {
    medications = medications.filter((m) => !m.isActive);
  }

  medications.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  res.json(medications);
});

router.get("/api/side-effects/medications/:medicationId", (req, res) => {
  const { medicationId } = req.params;
  const medication = medicationsStore.get(medicationId);
  if (!medication) {
    return res.status(404).json({ error: "Medication not found" });
  }
  res.json(medication);
});

router.post("/api/side-effects/medications", (req, res) => {
  const parseResult = insertMedicationEntrySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const medication: MedicationEntry = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  medicationsStore.set(id, medication);
  res.status(201).json(medication);
});

router.patch("/api/side-effects/medications/:medicationId", (req, res) => {
  const { medicationId } = req.params;
  const existing = medicationsStore.get(medicationId);
  if (!existing) {
    return res.status(404).json({ error: "Medication not found" });
  }

  const updated: MedicationEntry = {
    ...existing,
    ...req.body,
    id: medicationId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  medicationsStore.set(medicationId, updated);
  res.json(updated);
});

router.delete("/api/side-effects/medications/:medicationId", (req, res) => {
  const { medicationId } = req.params;
  if (!medicationsStore.has(medicationId)) {
    return res.status(404).json({ error: "Medication not found" });
  }
  medicationsStore.delete(medicationId);
  Array.from(symptomsStore.entries())
    .filter(([_, s]) => s.medicationId === medicationId)
    .forEach(([id]) => symptomsStore.delete(id));
  res.status(204).send();
});

router.get("/api/side-effects/medications/:medicationId/symptoms", (req, res) => {
  const { medicationId } = req.params;
  const symptoms = Array.from(symptomsStore.values())
    .filter((s) => s.medicationId === medicationId)
    .sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  res.json(symptoms);
});

router.get("/api/side-effects/symptoms", (req, res) => {
  const { profileId, ongoing } = req.query;
  let symptoms = Array.from(symptomsStore.values());

  if (profileId) {
    symptoms = symptoms.filter((s) => s.profileId === profileId);
  }

  if (ongoing === "true") {
    symptoms = symptoms.filter((s) => s.isOngoing);
  } else if (ongoing === "false") {
    symptoms = symptoms.filter((s) => !s.isOngoing);
  }

  symptoms.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  res.json(symptoms);
});

router.post("/api/side-effects/symptoms", (req, res) => {
  const parseResult = insertSymptomEntrySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const symptom: SymptomEntry = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  symptomsStore.set(id, symptom);
  res.status(201).json(symptom);
});

router.patch("/api/side-effects/symptoms/:symptomId", (req, res) => {
  const { symptomId } = req.params;
  const existing = symptomsStore.get(symptomId);
  if (!existing) {
    return res.status(404).json({ error: "Symptom entry not found" });
  }

  const updated: SymptomEntry = {
    ...existing,
    ...req.body,
    id: symptomId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  symptomsStore.set(symptomId, updated);
  res.json(updated);
});

router.delete("/api/side-effects/symptoms/:symptomId", (req, res) => {
  const { symptomId } = req.params;
  if (!symptomsStore.has(symptomId)) {
    return res.status(404).json({ error: "Symptom entry not found" });
  }
  symptomsStore.delete(symptomId);
  res.status(204).send();
});

router.get("/api/side-effects/summary", (req, res) => {
  const { profileId } = req.query;
  let medications = Array.from(medicationsStore.values());
  let symptoms = Array.from(symptomsStore.values());

  if (profileId) {
    medications = medications.filter((m) => m.profileId === profileId);
    symptoms = symptoms.filter((s) => s.profileId === profileId);
  }

  const activeMedications = medications.filter((m) => m.isActive);
  const ongoingSymptoms = symptoms.filter((s) => s.isOngoing);

  const medicationsWithSymptoms = activeMedications.map((med) => {
    const medSymptoms = symptoms.filter((s) => s.medicationId === med.id);
    const ongoingMedSymptoms = medSymptoms.filter((s) => s.isOngoing);
    return {
      medication: med,
      totalSymptoms: medSymptoms.length,
      ongoingSymptoms: ongoingMedSymptoms.length,
      symptoms: ongoingMedSymptoms,
    };
  });

  res.json({
    totalActiveMedications: activeMedications.length,
    totalOngoingSymptoms: ongoingSymptoms.length,
    medicationsWithSymptoms,
  });
});

router.post("/api/side-effects/symptoms/caregiver", (req, res) => {
  const { caregiverId, caregiverName, ...symptomData } = req.body;
  
  if (!caregiverId || !caregiverName) {
    return res.status(400).json({ error: "Caregiver ID and name are required" });
  }

  if (!symptomData.profileId) {
    return res.status(400).json({ error: "Profile ID is required" });
  }

  const consentCheck = verifyCaregiverConsent(caregiverId, symptomData.profileId, "side_effects_journal", "add_entries");
  if (!consentCheck.hasPermission) {
    return res.status(403).json({ error: "Permission denied", message: consentCheck.message });
  }

  const parseResult = insertSymptomEntrySchema.safeParse(symptomData);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const symptom: SymptomEntry = {
    ...parseResult.data,
    id,
    notes: `[Added by caregiver: ${caregiverName}] ${parseResult.data.notes || ""}`,
    createdAt: now,
    updatedAt: now,
  };

  symptomsStore.set(id, symptom);
  
  res.status(201).json({
    ...symptom,
    addedByCaregiver: true,
    caregiverName,
  });
});

router.post("/api/side-effects/medications/caregiver", (req, res) => {
  const { caregiverId, caregiverName, ...medicationData } = req.body;
  
  if (!caregiverId || !caregiverName) {
    return res.status(400).json({ error: "Caregiver ID and name are required" });
  }

  if (!medicationData.profileId) {
    return res.status(400).json({ error: "Profile ID is required" });
  }

  const consentCheck = verifyCaregiverConsent(caregiverId, medicationData.profileId, "side_effects_journal", "add_entries");
  if (!consentCheck.hasPermission) {
    return res.status(403).json({ error: "Permission denied", message: consentCheck.message });
  }

  const parseResult = insertMedicationEntrySchema.safeParse(medicationData);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const medication: MedicationEntry = {
    ...parseResult.data,
    id,
    notes: `[Added by caregiver: ${caregiverName}] ${parseResult.data.notes || ""}`,
    createdAt: now,
    updatedAt: now,
  };

  medicationsStore.set(id, medication);
  
  res.status(201).json({
    ...medication,
    addedByCaregiver: true,
    caregiverName,
  });
});

router.get("/api/side-effects/caregiver-summary", (req, res) => {
  const { profileId } = req.query;
  
  let medications = Array.from(medicationsStore.values());
  let symptoms = Array.from(symptomsStore.values());

  if (profileId) {
    medications = medications.filter((m) => m.profileId === profileId);
    symptoms = symptoms.filter((s) => s.profileId === profileId);
  }

  const activeMedications = medications.filter((m) => m.isActive);
  const ongoingSymptoms = symptoms.filter((s) => s.isOngoing);
  
  const severityDistribution = {
    mild: ongoingSymptoms.filter(s => s.severity === "mild").length,
    moderate: ongoingSymptoms.filter(s => s.severity === "moderate").length,
    severe: ongoingSymptoms.filter(s => s.severity === "severe").length,
  };

  const recentSymptoms = symptoms
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  const medicationList = activeMedications.map(med => ({
    id: med.id,
    name: med.medicationName,
    dose: med.dose,
    frequency: med.frequency,
    startDate: med.startDate,
    symptomCount: symptoms.filter(s => s.medicationId === med.id && s.isOngoing).length,
  }));

  res.json({
    totalActiveMedications: activeMedications.length,
    totalOngoingSymptoms: ongoingSymptoms.length,
    severityDistribution,
    recentSymptoms: recentSymptoms.map(s => ({
      id: s.id,
      symptomType: s.symptomType,
      customSymptomName: s.customSymptomName,
      severity: s.severity,
      startDate: s.startDate,
      isOngoing: s.isOngoing,
      medicationId: s.medicationId,
    })),
    medications: medicationList,
    lastUpdated: symptoms[0]?.updatedAt || medications[0]?.updatedAt || new Date().toISOString(),
  });
});

export default router;
