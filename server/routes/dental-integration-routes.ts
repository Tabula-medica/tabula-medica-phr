import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { requireFeature } from "../middleware/require-feature";

const router = Router();
// Feature gate: dental EHR integrations are a Concierge-tier feature.
// Reads (software list, existing connection list) remain open so users
// on free tier can see what's available; write/sync actions are gated.
const gateDental = requireFeature("dental_integrations");

export type DentalSoftware = "open-dental" | "dentrix" | "eaglesoft";

export interface DentalSoftwareConfig {
  id: DentalSoftware;
  name: string;
  vendor: string;
  description: string;
  apiType: "rest" | "soap" | "fhir";
  authMethod: "api-key" | "oauth2" | "basic";
  capabilities: string[];
  setupSteps: string[];
  documentationUrl: string;
  logoColor: string;
  supportedVersions: string[];
  dataCategories: string[];
}

export interface DentalConnection {
  id: string;
  patientId: string;
  software: DentalSoftware;
  softwareName: string;
  practiceName: string;
  practicePhone?: string;
  practiceAddress?: string;
  dentistName?: string;
  status: "pending" | "connected" | "syncing" | "error" | "disconnected";
  connectedAt?: string;
  lastSyncAt?: string;
  syncStatus: "idle" | "syncing" | "completed" | "failed";
  recordCount: number;
  errorMessage?: string;
  dataCategories: string[];
}

export interface DentalAppointment {
  id: string;
  connectionId: string;
  software: DentalSoftware;
  patientId: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no-show";
  providerName: string;
  practiceName: string;
  procedures: string[];
  notes?: string;
}

export interface DentalTreatmentPlan {
  id: string;
  connectionId: string;
  software: DentalSoftware;
  patientId: string;
  planName: string;
  status: "proposed" | "active" | "completed";
  createdDate: string;
  totalEstimate: number;
  insuranceEstimate: number;
  patientEstimate: number;
  procedures: {
    code: string;
    description: string;
    toothNumber?: number;
    surface?: string;
    fee: number;
    insurancePays: number;
    patientPays: number;
    status: "planned" | "scheduled" | "completed";
    priority: "urgent" | "high" | "medium" | "low";
  }[];
}

export interface DentalInsuranceClaim {
  id: string;
  connectionId: string;
  software: DentalSoftware;
  patientId: string;
  claimNumber: string;
  dateOfService: string;
  dateFiled: string;
  carrier: string;
  status: "submitted" | "pending" | "paid" | "denied" | "partial";
  totalCharged: number;
  insurancePaid: number;
  patientOwes: number;
  procedures: { code: string; description: string; fee: number }[];
}

export interface PeriodontalReading {
  tooth: number;
  buccal: number[];
  lingual: number[];
  bleedingOnProbing: boolean;
  recession?: number;
  mobility?: number;
  furcation?: number;
}

export interface PeriodontalChart {
  id: string;
  connectionId: string;
  software: DentalSoftware;
  patientId: string;
  date: string;
  providerName: string;
  readings: PeriodontalReading[];
  overallAssessment: string;
  gingivitisRisk: "low" | "moderate" | "high";
  periodontitisStage?: string;
}

const SOFTWARE_CONFIGS: DentalSoftwareConfig[] = [
  {
    id: "open-dental",
    name: "Open Dental",
    vendor: "Open Dental Software",
    description: "Open-source dental practice management with robust API. Widely used by independent and multi-location practices with full clinical, billing, and imaging integration.",
    apiType: "rest",
    authMethod: "api-key",
    capabilities: [
      "Patient Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Tooth Charts", "Periodontal Charts", "X-Ray Imaging", "Insurance Claims",
      "Billing & Ledger", "Referrals", "Prescriptions", "Lab Cases"
    ],
    setupSteps: [
      "Log in to your Open Dental software as an administrator",
      "Go to Setup → Advanced Setup → API",
      "Enable the Open Dental API and generate an API key",
      "Set the allowed IP addresses or select 'Allow All'",
      "Copy the API key and your practice's Customer Key",
      "Enter both keys below to connect"
    ],
    documentationUrl: "https://www.opendental.com/site/apioverview.html",
    logoColor: "#2563eb",
    supportedVersions: ["22.1+", "23.x", "24.x"],
    dataCategories: [
      "Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Tooth Chart", "Perio Chart", "Imaging", "Insurance", "Billing", "Prescriptions"
    ]
  },
  {
    id: "dentrix",
    name: "Dentrix",
    vendor: "Henry Schein One",
    description: "Industry-leading dental practice management by Henry Schein. Powers over 35,000 practices with comprehensive clinical, business, and patient engagement tools.",
    apiType: "rest",
    authMethod: "oauth2",
    capabilities: [
      "Patient Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Tooth Charts", "Periodontal Charts", "Digital Imaging", "Insurance Verification",
      "Claims Management", "Patient Communication", "Analytics & Reporting", "eClaims"
    ],
    setupSteps: [
      "Contact your Dentrix account representative to enable API access",
      "Register your practice on the Henry Schein One Developer Portal",
      "Obtain your OAuth2 Client ID and Client Secret",
      "Configure the redirect URI: https://app.tabulamedica.health/api/dental-integrations/dentrix/callback",
      "Click 'Connect with Dentrix' below to authorize"
    ],
    documentationUrl: "https://developer.henryschein.com/dentrix",
    logoColor: "#059669",
    supportedVersions: ["G7", "G7.5", "G8"],
    dataCategories: [
      "Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Tooth Chart", "Perio Chart", "Imaging", "Insurance", "Claims", "Communication"
    ]
  },
  {
    id: "eaglesoft",
    name: "Eaglesoft",
    vendor: "Patterson Dental",
    description: "Comprehensive dental practice management by Patterson Dental. Serves thousands of practices with integrated clinical charting, imaging, scheduling, and billing workflows.",
    apiType: "soap",
    authMethod: "basic",
    capabilities: [
      "Patient Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Smart Tooth Charts", "Periodontal Charts", "Eaglesoft Imaging", "Insurance Management",
      "Billing & Collections", "Patient Recall", "Lab Tracking", "Referral Management"
    ],
    setupSteps: [
      "Open Eaglesoft and navigate to Administration → System Settings",
      "Enable 'External API Access' under the Integration tab",
      "Create an API user account with appropriate permissions",
      "Note your Eaglesoft server address and port number",
      "Enter your credentials and server details below"
    ],
    documentationUrl: "https://www.pattersondental.com/eaglesoft",
    logoColor: "#7c3aed",
    supportedVersions: ["21.x", "22.x", "23.x"],
    dataCategories: [
      "Demographics", "Appointments", "Treatment Plans", "Clinical Notes",
      "Tooth Chart", "Perio Chart", "Imaging", "Insurance", "Billing", "Recalls"
    ]
  }
];

const connections = new Map<string, DentalConnection>();
const appointments = new Map<string, DentalAppointment[]>();
const treatmentPlans = new Map<string, DentalTreatmentPlan[]>();
const claims = new Map<string, DentalInsuranceClaim[]>();
const perioCharts = new Map<string, PeriodontalChart[]>();

function seedDemoData() {
  const patientId = "patient-001";

  const conn1: DentalConnection = {
    id: "dc-opendental-001",
    patientId,
    software: "open-dental",
    softwareName: "Open Dental",
    practiceName: "Bright Smile Family Dentistry",
    practicePhone: "(555) 234-5678",
    practiceAddress: "1200 Dental Way, Suite 100, Austin, TX 78701",
    dentistName: "Dr. Sarah Mitchell, DDS",
    status: "connected",
    connectedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    lastSyncAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    syncStatus: "completed",
    recordCount: 47,
    dataCategories: ["Demographics", "Appointments", "Treatment Plans", "Tooth Chart", "Perio Chart", "Insurance"]
  };

  const conn2: DentalConnection = {
    id: "dc-dentrix-001",
    patientId,
    software: "dentrix",
    softwareName: "Dentrix",
    practiceName: "Downtown Orthodontics & Specialty",
    practicePhone: "(555) 345-6789",
    practiceAddress: "800 Market St, Suite 200, San Francisco, CA 94102",
    dentistName: "Dr. James Park, DMD",
    status: "connected",
    connectedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
    syncStatus: "completed",
    recordCount: 23,
    dataCategories: ["Demographics", "Appointments", "Treatment Plans", "Clinical Notes", "Insurance", "Claims"]
  };

  const conn3: DentalConnection = {
    id: "dc-eaglesoft-001",
    patientId,
    software: "eaglesoft",
    softwareName: "Eaglesoft",
    practiceName: "Lakeside Periodontics",
    practicePhone: "(555) 456-7890",
    practiceAddress: "450 Lakefront Dr, Chicago, IL 60611",
    dentistName: "Dr. Maria Torres, DDS, MS",
    status: "connected",
    connectedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    lastSyncAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    syncStatus: "completed",
    recordCount: 18,
    dataCategories: ["Demographics", "Appointments", "Perio Chart", "Treatment Plans", "Insurance"]
  };

  connections.set(conn1.id, conn1);
  connections.set(conn2.id, conn2);
  connections.set(conn3.id, conn3);

  appointments.set(patientId, [
    {
      id: "apt-001", connectionId: conn1.id, software: "open-dental", patientId,
      date: "2026-04-15", time: "09:00", duration: 60, type: "Comprehensive Exam & Cleaning",
      status: "scheduled", providerName: "Dr. Sarah Mitchell, DDS",
      practiceName: "Bright Smile Family Dentistry",
      procedures: ["D0150 - Comprehensive Oral Exam", "D1110 - Prophylaxis (Adult Cleaning)"]
    },
    {
      id: "apt-002", connectionId: conn1.id, software: "open-dental", patientId,
      date: "2026-02-10", time: "14:00", duration: 45, type: "Filling",
      status: "completed", providerName: "Dr. Sarah Mitchell, DDS",
      practiceName: "Bright Smile Family Dentistry",
      procedures: ["D2391 - Resin Composite (1 surface, posterior)"],
      notes: "Tooth #14 occlusal cavity restored with composite. Patient tolerated well."
    },
    {
      id: "apt-003", connectionId: conn2.id, software: "dentrix", patientId,
      date: "2026-05-01", time: "10:30", duration: 30, type: "Orthodontic Adjustment",
      status: "scheduled", providerName: "Dr. James Park, DMD",
      practiceName: "Downtown Orthodontics & Specialty",
      procedures: ["D8670 - Orthodontic Adjustment"]
    },
    {
      id: "apt-004", connectionId: conn3.id, software: "eaglesoft", patientId,
      date: "2026-01-20", time: "11:00", duration: 60, type: "Periodontal Maintenance",
      status: "completed", providerName: "Dr. Maria Torres, DDS, MS",
      practiceName: "Lakeside Periodontics",
      procedures: ["D4910 - Periodontal Maintenance", "D0274 - Bitewing X-Rays (4 films)"],
      notes: "Perio maintenance completed. Pocket depths stable. Continue 3-month recall."
    }
  ]);

  treatmentPlans.set(patientId, [
    {
      id: "tp-001", connectionId: conn1.id, software: "open-dental", patientId,
      planName: "Restorative Treatment Plan", status: "active", createdDate: "2026-01-15",
      totalEstimate: 2850, insuranceEstimate: 1710, patientEstimate: 1140,
      procedures: [
        { code: "D2740", description: "Crown - Porcelain/Ceramic", toothNumber: 19, fee: 1200, insurancePays: 720, patientPays: 480, status: "planned", priority: "high" },
        { code: "D2391", description: "Resin Composite (1 surface, posterior)", toothNumber: 14, fee: 250, insurancePays: 150, patientPays: 100, status: "completed", priority: "high" },
        { code: "D2950", description: "Core Buildup", toothNumber: 19, fee: 350, insurancePays: 210, patientPays: 140, status: "planned", priority: "high" },
        { code: "D0220", description: "Periapical X-Ray", toothNumber: 19, fee: 35, insurancePays: 28, patientPays: 7, status: "planned", priority: "medium" },
        { code: "D7210", description: "Surgical Extraction (Impacted)", toothNumber: 18, surface: "N/A", fee: 450, insurancePays: 270, patientPays: 180, status: "planned", priority: "medium" },
        { code: "D9230", description: "Nitrous Oxide Analgesia", fee: 65, insurancePays: 32, patientPays: 33, status: "planned", priority: "low" },
        { code: "D0330", description: "Panoramic X-Ray", fee: 150, insurancePays: 120, patientPays: 30, status: "completed", priority: "medium" },
        { code: "D1110", description: "Prophylaxis (Adult)", fee: 130, insurancePays: 100, patientPays: 30, status: "scheduled", priority: "medium" },
        { code: "D1206", description: "Fluoride Varnish", fee: 45, insurancePays: 30, patientPays: 15, status: "planned", priority: "low" },
        { code: "D9440", description: "Office Visit (Problem-Focused)", fee: 75, insurancePays: 50, patientPays: 25, status: "completed", priority: "medium" }
      ]
    },
    {
      id: "tp-002", connectionId: conn2.id, software: "dentrix", patientId,
      planName: "Orthodontic Phase 2", status: "active", createdDate: "2025-08-01",
      totalEstimate: 5500, insuranceEstimate: 2750, patientEstimate: 2750,
      procedures: [
        { code: "D8080", description: "Comprehensive Orthodontic - Adult", fee: 5000, insurancePays: 2500, patientPays: 2500, status: "scheduled", priority: "high" },
        { code: "D8670", description: "Orthodontic Adjustment", fee: 250, insurancePays: 125, patientPays: 125, status: "completed", priority: "medium" },
        { code: "D8680", description: "Orthodontic Retention", fee: 250, insurancePays: 125, patientPays: 125, status: "planned", priority: "medium" }
      ]
    }
  ]);

  claims.set(patientId, [
    {
      id: "clm-d-001", connectionId: conn1.id, software: "open-dental", patientId,
      claimNumber: "DC-2026-4521", dateOfService: "2026-02-10", dateFiled: "2026-02-11",
      carrier: "Delta Dental PPO", status: "paid",
      totalCharged: 250, insurancePaid: 150, patientOwes: 100,
      procedures: [{ code: "D2391", description: "Resin Composite", fee: 250 }]
    },
    {
      id: "clm-d-002", connectionId: conn1.id, software: "open-dental", patientId,
      claimNumber: "DC-2026-4522", dateOfService: "2026-01-15", dateFiled: "2026-01-16",
      carrier: "Delta Dental PPO", status: "paid",
      totalCharged: 280, insurancePaid: 224, patientOwes: 56,
      procedures: [
        { code: "D0150", description: "Comprehensive Oral Exam", fee: 95 },
        { code: "D1110", description: "Prophylaxis (Adult)", fee: 130 },
        { code: "D0274", description: "Bitewing X-Rays (4 films)", fee: 55 }
      ]
    },
    {
      id: "clm-d-003", connectionId: conn3.id, software: "eaglesoft", patientId,
      claimNumber: "DC-2026-7801", dateOfService: "2026-01-20", dateFiled: "2026-01-21",
      carrier: "MetLife Dental", status: "pending",
      totalCharged: 310, insurancePaid: 0, patientOwes: 310,
      procedures: [
        { code: "D4910", description: "Periodontal Maintenance", fee: 260 },
        { code: "D0274", description: "Bitewing X-Rays", fee: 50 }
      ]
    }
  ]);

  perioCharts.set(patientId, [
    {
      id: "perio-001", connectionId: conn3.id, software: "eaglesoft", patientId,
      date: "2026-01-20", providerName: "Dr. Maria Torres, DDS, MS",
      overallAssessment: "Stable periodontal condition. Localized areas of 4-5mm pocketing on posterior teeth. Continue 3-month maintenance.",
      gingivitisRisk: "moderate",
      periodontitisStage: "Stage II, Grade B",
      readings: [
        { tooth: 2, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 3, buccal: [3, 4, 3], lingual: [3, 3, 4], bleedingOnProbing: true, recession: 1 },
        { tooth: 4, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 5, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 12, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 13, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 14, buccal: [3, 4, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 18, buccal: [4, 5, 4], lingual: [4, 4, 5], bleedingOnProbing: true, recession: 2, mobility: 1 },
        { tooth: 19, buccal: [4, 4, 3], lingual: [3, 4, 4], bleedingOnProbing: true, recession: 1 },
        { tooth: 20, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 28, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 29, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false },
        { tooth: 30, buccal: [3, 4, 3], lingual: [3, 3, 4], bleedingOnProbing: true, recession: 1 },
        { tooth: 31, buccal: [3, 3, 3], lingual: [3, 3, 3], bleedingOnProbing: false }
      ]
    }
  ]);
}

seedDemoData();

router.get("/software", (_req: Request, res: Response) => {
  res.json({ software: SOFTWARE_CONFIGS });
});

router.get("/software/:id", (req: Request, res: Response) => {
  const config = SOFTWARE_CONFIGS.find(s => s.id === req.params.id);
  if (!config) return res.status(404).json({ error: "Software not found" });
  res.json(config);
});

router.get("/connections", (req: Request, res: Response) => {
  const patientId = req.query.patientId || "patient-001";
  const patientConnections = Array.from(connections.values())
    .filter(c => c.patientId === patientId);
  res.json({ connections: patientConnections, total: patientConnections.length });
});

router.post("/connections", gateDental, (req: Request, res: Response) => {
  const { software, practiceName, credentials } = req.body;
  const config = SOFTWARE_CONFIGS.find(s => s.id === software);
  if (!config) return res.status(400).json({ error: "Unsupported dental software" });
  if (!practiceName) return res.status(400).json({ error: "Practice name is required" });
  if (!credentials) return res.status(400).json({ error: "Credentials are required" });

  const connection: DentalConnection = {
    id: `dc-${software}-${randomUUID().slice(0, 8)}`,
    patientId: "patient-001",
    software: software as DentalSoftware,
    softwareName: config.name,
    practiceName,
    status: "connected",
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    syncStatus: "completed",
    recordCount: 0,
    dataCategories: config.dataCategories
  };

  connections.set(connection.id, connection);
  res.status(201).json({ success: true, connection });
});

router.delete("/connections/:id", (req: Request, res: Response) => {
  const connection = connections.get(req.params.id);
  if (!connection) return res.status(404).json({ error: "Connection not found" });
  connections.delete(req.params.id);
  res.json({ success: true, message: `Disconnected from ${connection.softwareName} at ${connection.practiceName}` });
});

router.post("/connections/:id/sync", gateDental, (req: Request, res: Response) => {
  const connection = connections.get(req.params.id);
  if (!connection) return res.status(404).json({ error: "Connection not found" });
  connection.lastSyncAt = new Date().toISOString();
  connection.syncStatus = "completed";
  res.json({ success: true, message: `Synced ${connection.recordCount} records from ${connection.softwareName}` });
});

router.get("/appointments", (req: Request, res: Response) => {
  const patientId = (req.query.patientId as string) || "patient-001";
  const software = req.query.software as string;
  const status = req.query.status as string;

  let results = appointments.get(patientId) || [];
  if (software) results = results.filter(a => a.software === software);
  if (status) results = results.filter(a => a.status === status);
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ appointments: results, total: results.length });
});

router.get("/treatment-plans", (req: Request, res: Response) => {
  const patientId = (req.query.patientId as string) || "patient-001";
  const plans = treatmentPlans.get(patientId) || [];
  const totalEstimate = plans.reduce((s, p) => s + p.totalEstimate, 0);
  const totalInsurance = plans.reduce((s, p) => s + p.insuranceEstimate, 0);
  const totalPatient = plans.reduce((s, p) => s + p.patientEstimate, 0);

  res.json({
    treatmentPlans: plans,
    total: plans.length,
    summary: { totalEstimate, totalInsurance, totalPatient }
  });
});

router.get("/claims", (req: Request, res: Response) => {
  const patientId = (req.query.patientId as string) || "patient-001";
  const patientClaims = claims.get(patientId) || [];
  const totalCharged = patientClaims.reduce((s, c) => s + c.totalCharged, 0);
  const totalPaid = patientClaims.reduce((s, c) => s + c.insurancePaid, 0);
  const totalOwed = patientClaims.reduce((s, c) => s + c.patientOwes, 0);

  res.json({
    claims: patientClaims,
    total: patientClaims.length,
    summary: { totalCharged, totalPaid, totalOwed }
  });
});

router.get("/perio-charts", (req: Request, res: Response) => {
  const patientId = (req.query.patientId as string) || "patient-001";
  const charts = perioCharts.get(patientId) || [];
  res.json({ perioCharts: charts, total: charts.length });
});

router.get("/unified-summary", (req: Request, res: Response) => {
  const patientId = (req.query.patientId as string) || "patient-001";

  const patientConnections = Array.from(connections.values()).filter(c => c.patientId === patientId);
  const patientAppointments = appointments.get(patientId) || [];
  const patientPlans = treatmentPlans.get(patientId) || [];
  const patientClaims = claims.get(patientId) || [];
  const patientPerio = perioCharts.get(patientId) || [];

  const upcoming = patientAppointments
    .filter(a => a.status === "scheduled" || a.status === "confirmed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const activePlans = patientPlans.filter(p => p.status === "active");
  const totalPlanCost = activePlans.reduce((s, p) => s + p.patientEstimate, 0);
  const pendingClaims = patientClaims.filter(c => c.status === "pending" || c.status === "submitted");
  const totalRecords = patientConnections.reduce((s, c) => s + c.recordCount, 0);

  const completedProcedures = activePlans
    .flatMap(p => p.procedures)
    .filter(p => p.status === "completed").length;
  const totalProcedures = activePlans.flatMap(p => p.procedures).length;

  const latestPerio = patientPerio.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  res.json({
    connectedPractices: patientConnections.length,
    softwareConnected: [...new Set(patientConnections.map(c => c.software))],
    totalRecordsSynced: totalRecords,
    lastSyncTime: patientConnections
      .filter(c => c.lastSyncAt)
      .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0]?.lastSyncAt,
    upcomingAppointments: upcoming.length,
    nextAppointment: upcoming[0] || null,
    activeTreatmentPlans: activePlans.length,
    outOfPocketEstimate: totalPlanCost,
    treatmentProgress: totalProcedures > 0
      ? Math.round((completedProcedures / totalProcedures) * 100)
      : 0,
    pendingClaims: pendingClaims.length,
    periodontalStatus: latestPerio ? {
      risk: latestPerio.gingivitisRisk,
      stage: latestPerio.periodontitisStage,
      lastExamDate: latestPerio.date
    } : null,
    practices: patientConnections.map(c => ({
      name: c.practiceName,
      software: c.softwareName,
      dentist: c.dentistName,
      phone: c.practicePhone,
      records: c.recordCount
    }))
  });
});

router.post("/ai-dental-insights", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  const patientId = "patient-001";
  const patientPlans = treatmentPlans.get(patientId) || [];
  const patientPerio = perioCharts.get(patientId) || [];
  const patientAppts = appointments.get(patientId) || [];

  const context = JSON.stringify({
    treatmentPlans: patientPlans.map(p => ({ name: p.planName, status: p.status, procedures: p.procedures.map(pr => `${pr.code} ${pr.description} (${pr.status})`), patientCost: p.patientEstimate })),
    periodontal: patientPerio[0] ? { assessment: patientPerio[0].overallAssessment, risk: patientPerio[0].gingivitisRisk, stage: patientPerio[0].periodontitisStage } : null,
    appointments: patientAppts.map(a => ({ date: a.date, type: a.type, status: a.status, provider: a.providerName }))
  });

  try {
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a dental health assistant integrated with patient dental records from Open Dental, Dentrix, and Eaglesoft. Help patients understand their dental data, treatment plans, insurance coverage, and next steps. Be clear, empathetic, and accurate. Always include this disclaimer at the end: "\n\n⚠️ This is AI-generated educational information only. It is not a clinical diagnosis or substitute for professional dental advice. Always consult your dentist for treatment decisions."`
        },
        {
          role: "user",
          content: `Patient dental data context:\n${context}\n\nPatient question: ${question}`
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    res.json({
      answer: completion.choices[0]?.message?.content || "Unable to generate a response.",
      sources: [...new Set(patientPlans.map(p => p.software))]
    });
  } catch (error: any) {
    res.json({
      answer: `Based on your dental records, here's what I can share about "${question}":\n\nYou currently have ${patientPlans.length} active treatment plan(s) across ${new Set(patientPlans.map(p => p.software)).size} dental practice(s). Your periodontal health is being monitored with ${patientPerio[0]?.gingivitisRisk || "ongoing"} risk assessment.\n\nFor specific clinical questions, please consult your dental provider directly.\n\n⚠️ This is AI-generated educational information only. It is not a clinical diagnosis or substitute for professional dental advice. Always consult your dentist for treatment decisions.`,
      sources: ["fallback"]
    });
  }
});

export default router;
