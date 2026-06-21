import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  insertDentalRecordSchema,
  updateDentalRecordSchema,
  type DentalRecord,
} from "@shared/schema";

const router = Router();

const dentalRecords = new Map<string, DentalRecord>();

function seedDentalRecords() {
  const now = new Date();
  const records: DentalRecord[] = [
    {
      id: randomUUID(),
      patientId: "patient-001",
      type: "exam",
      status: "completed",
      dentistName: "Dr. Sarah Mitchell",
      clinicName: "Bright Smile Dental",
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toothNumbers: [],
      toothConditions: [
        { tooth: 14, condition: "cavity", notes: "Small cavity detected on occlusal surface" },
        { tooth: 18, condition: "impacted", notes: "Partially erupted wisdom tooth" },
        { tooth: 3, condition: "filled" },
        { tooth: 19, condition: "crowned" },
      ],
      diagnosis: "Routine dental examination. Overall good oral health with minor cavity on tooth #14.",
      treatment: "Full examination and cleaning performed. Recommended filling for tooth #14.",
      notes: "Patient reports no pain or sensitivity. Gums healthy, no signs of periodontal disease.",
      nextAppointment: new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000).toISOString(),
      xrayImageIds: ["xray-001", "xray-002"],
      insuranceClaim: {
        claimId: "CLM-2025-1234",
        amount: 250,
        status: "approved",
        coveredAmount: 200,
      },
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      patientId: "patient-001",
      type: "cleaning",
      status: "completed",
      dentistName: "Dr. Sarah Mitchell",
      clinicName: "Bright Smile Dental",
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toothNumbers: [],
      toothConditions: [],
      diagnosis: "Prophylactic cleaning. Light tartar buildup on lower anterior teeth.",
      treatment: "Full prophylactic cleaning with ultrasonic scaling and polishing.",
      notes: "Recommended using interdental brushes for lower anterior region.",
      xrayImageIds: [],
      insuranceClaim: {
        claimId: "CLM-2025-1235",
        amount: 150,
        status: "approved",
        coveredAmount: 150,
      },
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      patientId: "patient-001",
      type: "filling",
      status: "scheduled",
      dentistName: "Dr. Sarah Mitchell",
      clinicName: "Bright Smile Dental",
      date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      toothNumbers: [14],
      toothConditions: [
        { tooth: 14, condition: "cavity", notes: "Composite filling scheduled" },
      ],
      diagnosis: "Cavity on occlusal surface of tooth #14 requiring composite restoration.",
      treatment: "Composite filling planned.",
      notes: "Patient advised to avoid hard foods on the treated tooth for 24 hours after procedure.",
      xrayImageIds: ["xray-001"],
      insuranceClaim: {
        claimId: "CLM-2025-1240",
        amount: 320,
        status: "pending",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      patientId: "patient-001",
      type: "xray",
      status: "completed",
      dentistName: "Dr. Sarah Mitchell",
      clinicName: "Bright Smile Dental",
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toothNumbers: [],
      toothConditions: [],
      diagnosis: "Panoramic and bitewing X-rays taken. No significant abnormalities detected.",
      treatment: "Radiographic imaging for diagnostic purposes.",
      notes: "Full mouth series. Next X-rays recommended in 12 months.",
      xrayImageIds: ["xray-001", "xray-002", "xray-003"],
      insuranceClaim: {
        claimId: "CLM-2025-1236",
        amount: 180,
        status: "approved",
        coveredAmount: 180,
      },
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      patientId: "patient-001",
      type: "crown",
      status: "completed",
      dentistName: "Dr. James Park",
      clinicName: "Downtown Prosthodontics",
      date: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      toothNumbers: [19],
      toothConditions: [
        { tooth: 19, condition: "crowned", notes: "Porcelain-fused-to-metal crown placed" },
      ],
      diagnosis: "Tooth #19 weakened by large existing filling, crown recommended for structural support.",
      treatment: "Porcelain-fused-to-metal crown placement. Two-visit procedure completed.",
      notes: "Crown fits well, bite is even. No adjustment needed at delivery appointment.",
      xrayImageIds: ["xray-004"],
      insuranceClaim: {
        claimId: "CLM-2024-0891",
        amount: 1200,
        status: "approved",
        coveredAmount: 600,
      },
      createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  records.forEach((r) => dentalRecords.set(r.id, r));
}

seedDentalRecords();

router.get("/", (req: Request, res: Response) => {
  try {
    const { patientId, type, status } = req.query;

    let records = Array.from(dentalRecords.values());

    if (patientId && typeof patientId === "string") {
      records = records.filter((r) => r.patientId === patientId);
    }
    if (type && typeof type === "string") {
      records = records.filter((r) => r.type === type);
    }
    if (status && typeof status === "string") {
      records = records.filter((r) => r.status === status);
    }

    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json({ records });
  } catch (error) {
    console.error("[DentalRecords] Error listing records:", error);
    return res.status(500).json({ error: "Failed to list dental records" });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const record = dentalRecords.get(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Dental record not found" });
    }
    return res.json(record);
  } catch (error) {
    console.error("[DentalRecords] Error getting record:", error);
    return res.status(500).json({ error: "Failed to get dental record" });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const parsed = insertDentalRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid dental record data", details: parsed.error.format() });
    }

    const now = new Date().toISOString();
    const record: DentalRecord = {
      id: randomUUID(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };

    dentalRecords.set(record.id, record);
    return res.status(201).json(record);
  } catch (error) {
    console.error("[DentalRecords] Error creating record:", error);
    return res.status(500).json({ error: "Failed to create dental record" });
  }
});

router.patch("/:id", (req: Request, res: Response) => {
  try {
    const existing = dentalRecords.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Dental record not found" });
    }

    const parsed = updateDentalRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid update data", details: parsed.error.format() });
    }

    const updated: DentalRecord = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    dentalRecords.set(updated.id, updated);
    return res.json(updated);
  } catch (error) {
    console.error("[DentalRecords] Error updating record:", error);
    return res.status(500).json({ error: "Failed to update dental record" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    if (!dentalRecords.has(req.params.id)) {
      return res.status(404).json({ error: "Dental record not found" });
    }
    dentalRecords.delete(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error("[DentalRecords] Error deleting record:", error);
    return res.status(500).json({ error: "Failed to delete dental record" });
  }
});

router.get("/patient/:patientId/tooth-chart", (req: Request, res: Response) => {
  try {
    const records = Array.from(dentalRecords.values()).filter(
      (r) => r.patientId === req.params.patientId
    );

    const toothMap = new Map<number, { condition: string; notes?: string; lastUpdated: string }>();

    records
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((r) => {
        r.toothConditions.forEach((tc) => {
          toothMap.set(tc.tooth, {
            condition: tc.condition,
            notes: tc.notes,
            lastUpdated: r.date,
          });
        });
      });

    const chart = Array.from({ length: 32 }, (_, i) => {
      const toothNum = i + 1;
      const data = toothMap.get(toothNum);
      return {
        tooth: toothNum,
        condition: data?.condition || "healthy",
        notes: data?.notes,
        lastUpdated: data?.lastUpdated,
      };
    });

    return res.json({ chart });
  } catch (error) {
    console.error("[DentalRecords] Error generating tooth chart:", error);
    return res.status(500).json({ error: "Failed to generate tooth chart" });
  }
});

router.get("/patient/:patientId/insurance-summary", (req: Request, res: Response) => {
  try {
    const records = Array.from(dentalRecords.values()).filter(
      (r) => r.patientId === req.params.patientId && r.insuranceClaim
    );

    const claims = records.map((r) => ({
      recordId: r.id,
      type: r.type,
      date: r.date,
      ...r.insuranceClaim!,
    }));

    const totalBilled = claims.reduce((s, c) => s + c.amount, 0);
    const totalCovered = claims.reduce((s, c) => s + (c.coveredAmount || 0), 0);
    const pendingClaims = claims.filter((c) => c.status === "pending");
    const approvedClaims = claims.filter((c) => c.status === "approved");

    return res.json({
      totalBilled,
      totalCovered,
      outOfPocket: totalBilled - totalCovered,
      claimCount: claims.length,
      pendingCount: pendingClaims.length,
      approvedCount: approvedClaims.length,
      claims,
    });
  } catch (error) {
    console.error("[DentalRecords] Error generating insurance summary:", error);
    return res.status(500).json({ error: "Failed to generate insurance summary" });
  }
});

export default router;
