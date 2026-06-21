import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  dob: string;
  weight: string;
  microchipNumber: string;
  spayNeuterStatus: string;
  allergies: string[];
  photoUrl: string;
  createdAt: string;
}

interface PetVaccination {
  id: string;
  petId: string;
  vaccineName: string;
  dateAdministered: string;
  expirationDate: string;
  veterinarian: string;
  lotNumber: string;
  notes: string;
  createdAt: string;
}

interface PetMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  prescribedBy: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface VetVisit {
  id: string;
  petId: string;
  visitDate: string;
  veterinarian: string;
  clinic: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
  notes: string;
  createdAt: string;
}

interface StateRecord {
  id: string;
  petId: string;
  licenseNumber: string;
  registrationDate: string;
  expirationDate: string;
  county: string;
  state: string;
  recordType: string;
  status: string;
  notes: string;
  createdAt: string;
}

const pets: Pet[] = [];
const vaccinations: PetVaccination[] = [];
const medications: PetMedication[] = [];
const vetVisits: VetVisit[] = [];
const stateRecords: StateRecord[] = [];

router.get("/pets", (_req, res) => {
  res.json({ pets });
});

router.get("/pets/:id", (req, res) => {
  const pet = pets.find((p) => p.id === req.params.id);
  if (!pet) return res.status(404).json({ error: "Pet not found" });
  res.json({ pet });
});

router.post("/pets", (req, res) => {
  const pet: Pet = {
    id: randomUUID(),
    name: req.body.name || "",
    species: req.body.species || "",
    breed: req.body.breed || "",
    dob: req.body.dob || "",
    weight: req.body.weight || "",
    microchipNumber: req.body.microchipNumber || "",
    spayNeuterStatus: req.body.spayNeuterStatus || "unknown",
    allergies: req.body.allergies || [],
    photoUrl: req.body.photoUrl || "",
    createdAt: new Date().toISOString(),
  };
  pets.push(pet);
  res.status(201).json({ pet });
});

router.put("/pets/:id", (req, res) => {
  const idx = pets.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Pet not found" });
  pets[idx] = { ...pets[idx], ...req.body, id: pets[idx].id, createdAt: pets[idx].createdAt };
  res.json({ pet: pets[idx] });
});

router.delete("/pets/:id", (req, res) => {
  const idx = pets.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Pet not found" });
  pets.splice(idx, 1);
  res.json({ success: true });
});

router.get("/pets/:petId/vaccinations", (req, res) => {
  const petVax = vaccinations.filter((v) => v.petId === req.params.petId);
  res.json({ vaccinations: petVax });
});

router.post("/pets/:petId/vaccinations", (req, res) => {
  const vax: PetVaccination = {
    id: randomUUID(),
    petId: req.params.petId,
    vaccineName: req.body.vaccineName || "",
    dateAdministered: req.body.dateAdministered || "",
    expirationDate: req.body.expirationDate || "",
    veterinarian: req.body.veterinarian || "",
    lotNumber: req.body.lotNumber || "",
    notes: req.body.notes || "",
    createdAt: new Date().toISOString(),
  };
  vaccinations.push(vax);
  res.status(201).json({ vaccination: vax });
});

router.get("/pets/:petId/medications", (req, res) => {
  const petMeds = medications.filter((m) => m.petId === req.params.petId);
  res.json({ medications: petMeds });
});

router.post("/pets/:petId/medications", (req, res) => {
  const med: PetMedication = {
    id: randomUUID(),
    petId: req.params.petId,
    name: req.body.name || "",
    dosage: req.body.dosage || "",
    frequency: req.body.frequency || "",
    startDate: req.body.startDate || "",
    endDate: req.body.endDate || "",
    prescribedBy: req.body.prescribedBy || "",
    status: req.body.status || "active",
    notes: req.body.notes || "",
    createdAt: new Date().toISOString(),
  };
  medications.push(med);
  res.status(201).json({ medication: med });
});

router.get("/pets/:petId/vet-visits", (req, res) => {
  const visits = vetVisits.filter((v) => v.petId === req.params.petId);
  res.json({ vetVisits: visits });
});

router.post("/pets/:petId/vet-visits", (req, res) => {
  const visit: VetVisit = {
    id: randomUUID(),
    petId: req.params.petId,
    visitDate: req.body.visitDate || "",
    veterinarian: req.body.veterinarian || "",
    clinic: req.body.clinic || "",
    reason: req.body.reason || "",
    diagnosis: req.body.diagnosis || "",
    treatment: req.body.treatment || "",
    followUp: req.body.followUp || "",
    notes: req.body.notes || "",
    createdAt: new Date().toISOString(),
  };
  vetVisits.push(visit);
  res.status(201).json({ vetVisit: visit });
});

router.get("/pets/:petId/state-records", (req, res) => {
  const records = stateRecords.filter((r) => r.petId === req.params.petId);
  res.json({ stateRecords: records });
});

router.post("/pets/:petId/state-records", (req, res) => {
  const record: StateRecord = {
    id: randomUUID(),
    petId: req.params.petId,
    licenseNumber: req.body.licenseNumber || "",
    registrationDate: req.body.registrationDate || "",
    expirationDate: req.body.expirationDate || "",
    county: req.body.county || "",
    state: req.body.state || "",
    recordType: req.body.recordType || "license",
    status: req.body.status || "active",
    notes: req.body.notes || "",
    createdAt: new Date().toISOString(),
  };
  stateRecords.push(record);
  res.status(201).json({ stateRecord: record });
});

export default router;
