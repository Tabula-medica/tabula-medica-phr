import { Router, Request, Response } from "express";

const router = Router();

interface DataRecord {
  id: string;
  name: string;
  source: "local" | "external";
  externalSource?: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive" | "resolved";
  details: Record<string, unknown>;
}

interface DataConflict {
  id: string;
  recordType: "allergy" | "immunization" | "condition";
  localRecord: DataRecord;
  externalRecord: DataRecord;
  conflictFields: string[];
  detectedAt: string;
  status: "pending" | "resolved";
}

const sampleAllergies: DataRecord[] = [
  {
    id: "allergy-1",
    name: "Penicillin",
    source: "local",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-06-20T14:30:00Z",
    status: "active",
    details: { severity: "severe", reaction: "anaphylaxis" },
  },
  {
    id: "allergy-2",
    name: "Peanuts",
    source: "external",
    externalSource: "Primary Care Provider",
    createdAt: "2023-08-10T09:00:00Z",
    updatedAt: "2024-03-15T11:00:00Z",
    status: "active",
    details: { severity: "moderate", reaction: "hives" },
  },
  {
    id: "allergy-3",
    name: "Latex",
    source: "local",
    createdAt: "2024-02-01T08:00:00Z",
    updatedAt: "2024-02-01T08:00:00Z",
    status: "active",
    details: { severity: "mild", reaction: "skin irritation" },
  },
];

const sampleImmunizations: DataRecord[] = [
  {
    id: "immun-1",
    name: "COVID-19 Vaccine (Pfizer)",
    source: "external",
    externalSource: "State Immunization Registry",
    createdAt: "2021-04-15T10:00:00Z",
    updatedAt: "2021-04-15T10:00:00Z",
    status: "active",
    details: { dose: "1st", lotNumber: "EL9269" },
  },
  {
    id: "immun-2",
    name: "Influenza Vaccine",
    source: "local",
    createdAt: "2024-10-01T09:00:00Z",
    updatedAt: "2024-10-01T09:00:00Z",
    status: "active",
    details: { season: "2024-2025" },
  },
  {
    id: "immun-3",
    name: "Tetanus/Diphtheria (Td)",
    source: "external",
    externalSource: "Primary Care EHR",
    createdAt: "2020-06-20T14:00:00Z",
    updatedAt: "2020-06-20T14:00:00Z",
    status: "active",
    details: { nextDue: "2030-06-20" },
  },
];

const sampleConditions: DataRecord[] = [
  {
    id: "cond-1",
    name: "Type 2 Diabetes Mellitus",
    source: "local",
    createdAt: "2022-03-10T10:00:00Z",
    updatedAt: "2024-08-15T16:00:00Z",
    status: "active",
    details: { icd10: "E11.9", onsetDate: "2022-01-15" },
  },
  {
    id: "cond-2",
    name: "Essential Hypertension",
    source: "external",
    externalSource: "Cardiology Clinic",
    createdAt: "2021-09-01T11:00:00Z",
    updatedAt: "2024-07-20T10:00:00Z",
    status: "active",
    details: { icd10: "I10", controlled: true },
  },
  {
    id: "cond-3",
    name: "Seasonal Allergic Rhinitis",
    source: "local",
    createdAt: "2020-05-15T09:00:00Z",
    updatedAt: "2024-04-10T08:00:00Z",
    status: "active",
    details: { icd10: "J30.2", seasonal: true },
  },
  {
    id: "cond-4",
    name: "Osteoarthritis of Knee",
    source: "external",
    externalSource: "Orthopedic Specialist",
    createdAt: "2023-11-20T14:00:00Z",
    updatedAt: "2024-02-28T12:00:00Z",
    status: "active",
    details: { icd10: "M17.11", laterality: "right" },
  },
];

let sampleConflicts: DataConflict[] = [
  {
    id: "conflict-1",
    recordType: "allergy",
    localRecord: {
      id: "allergy-local-1",
      name: "Sulfa Drugs",
      source: "local",
      createdAt: "2024-01-10T10:00:00Z",
      updatedAt: "2024-06-15T14:00:00Z",
      status: "active",
      details: { severity: "moderate", reaction: "rash" },
    },
    externalRecord: {
      id: "allergy-ext-1",
      name: "Sulfonamide Antibiotics",
      source: "external",
      externalSource: "Primary Care Provider",
      createdAt: "2023-08-20T09:00:00Z",
      updatedAt: "2024-07-01T11:00:00Z",
      status: "active",
      details: { severity: "severe", reaction: "Stevens-Johnson syndrome" },
    },
    conflictFields: ["name", "severity", "reaction"],
    detectedAt: "2024-07-02T08:00:00Z",
    status: "pending",
  },
  {
    id: "conflict-2",
    recordType: "condition",
    localRecord: {
      id: "cond-local-1",
      name: "Hyperlipidemia",
      source: "local",
      createdAt: "2023-05-10T10:00:00Z",
      updatedAt: "2024-04-20T14:00:00Z",
      status: "active",
      details: { icd10: "E78.5", ldlLevel: 145 },
    },
    externalRecord: {
      id: "cond-ext-1",
      name: "Mixed Hyperlipidemia",
      source: "external",
      externalSource: "Cardiology Clinic",
      createdAt: "2023-06-15T11:00:00Z",
      updatedAt: "2024-05-10T16:00:00Z",
      status: "active",
      details: { icd10: "E78.2", ldlLevel: 160, triglyceridesLevel: 220 },
    },
    conflictFields: ["name", "icd10", "ldlLevel"],
    detectedAt: "2024-05-11T09:00:00Z",
    status: "pending",
  },
];

router.get("/data-stats", (_req: Request, res: Response) => {
  const stats = {
    allergies: {
      total: sampleAllergies.length,
      synced: sampleAllergies.filter((a) => a.source === "external").length,
      conflicts: sampleConflicts.filter((c) => c.recordType === "allergy" && c.status === "pending").length,
    },
    immunizations: {
      total: sampleImmunizations.length,
      synced: sampleImmunizations.filter((i) => i.source === "external").length,
      conflicts: sampleConflicts.filter((c) => c.recordType === "immunization" && c.status === "pending").length,
    },
    conditions: {
      total: sampleConditions.length,
      synced: sampleConditions.filter((c) => c.source === "external").length,
      conflicts: sampleConflicts.filter((c) => c.recordType === "condition" && c.status === "pending").length,
    },
  };

  res.json(stats);
});

router.get("/allergies", (_req: Request, res: Response) => {
  res.json(sampleAllergies);
});

router.get("/immunizations", (_req: Request, res: Response) => {
  res.json(sampleImmunizations);
});

router.get("/conditions", (_req: Request, res: Response) => {
  res.json(sampleConditions);
});

router.get("/conflicts", (_req: Request, res: Response) => {
  res.json(sampleConflicts);
});

router.post("/conflicts/:conflictId/resolve", (req: Request, res: Response) => {
  const { conflictId } = req.params;
  const { resolution } = req.body as { resolution: "local" | "external" | "merge" };

  const conflictIndex = sampleConflicts.findIndex((c) => c.id === conflictId);
  
  if (conflictIndex === -1) {
    return res.status(404).json({ error: "Conflict not found" });
  }

  const conflict = sampleConflicts[conflictIndex];
  
  let resolvedRecord: DataRecord;
  
  switch (resolution) {
    case "local":
      resolvedRecord = { ...conflict.localRecord, status: "active" };
      break;
    case "external":
      resolvedRecord = { 
        ...conflict.externalRecord, 
        source: "local" as const,
        status: "active" 
      };
      break;
    case "merge":
      resolvedRecord = {
        ...conflict.localRecord,
        details: { ...conflict.localRecord.details, ...conflict.externalRecord.details },
        updatedAt: new Date().toISOString(),
        status: "active",
      };
      break;
    default:
      return res.status(400).json({ error: "Invalid resolution strategy" });
  }

  sampleConflicts[conflictIndex] = {
    ...conflict,
    status: "resolved",
  };

  console.log(`[AdminData] Conflict ${conflictId} resolved with strategy: ${resolution}`);

  res.json({
    success: true,
    conflictId,
    resolution,
    resolvedRecord,
  });
});

export default router;
