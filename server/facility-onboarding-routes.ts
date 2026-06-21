import { Router, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import { insertPatientCareFacilitySchema } from "@shared/schema";
import type {
  CareFacility,
  PatientCareFacility,
  FacilityOnboardingSession,
  FacilityType,
  FacilitySearchResult,
} from "@shared/schema";

const router = Router();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

const sampleFacilities: CareFacility[] = [
  {
    id: "fac-001",
    name: "Johns Hopkins Hospital",
    aliases: ["JHH", "Hopkins"],
    facilityType: "hospital",
    city: "Baltimore",
    state: "MD",
    country: "USA",
    zipCode: "21287",
    address: "1800 Orleans St",
    phone: "(410) 955-5000",
    website: "https://www.hopkinsmedicine.org",
    npi: "1234567890",
    healthSystemId: "hs-jhu",
    healthSystemName: "Johns Hopkins Medicine",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    fhirBaseUrl: "https://epicproxy.johnshopkins.edu/FHIR/api/FHIR/R4/",
    patientPortalUrl: "https://mychart.johnshopkins.org",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-002",
    name: "Mayo Clinic",
    aliases: ["Mayo", "Mayo Rochester"],
    facilityType: "hospital",
    city: "Rochester",
    state: "MN",
    country: "USA",
    zipCode: "55905",
    address: "200 First St SW",
    phone: "(507) 284-2511",
    website: "https://www.mayoclinic.org",
    npi: "1234567891",
    healthSystemId: "hs-mayo",
    healthSystemName: "Mayo Clinic Health System",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    patientPortalUrl: "https://onlineservices.mayoclinic.org",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-003",
    name: "Labcorp",
    aliases: ["Laboratory Corporation of America"],
    facilityType: "lab",
    city: "Burlington",
    state: "NC",
    country: "USA",
    phone: "(800) 845-6167",
    website: "https://www.labcorp.com",
    healthSystemName: "Labcorp",
    ehrVendor: "other",
    supportsFhir: true,
    patientPortalUrl: "https://patient.labcorp.com",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-004",
    name: "Quest Diagnostics",
    aliases: ["Quest"],
    facilityType: "lab",
    city: "Secaucus",
    state: "NJ",
    country: "USA",
    phone: "(800) 222-0446",
    website: "https://www.questdiagnostics.com",
    healthSystemName: "Quest Diagnostics",
    ehrVendor: "other",
    supportsFhir: true,
    patientPortalUrl: "https://www.questdiagnostics.com/patient",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-005",
    name: "Kaiser Permanente",
    aliases: ["Kaiser", "KP"],
    facilityType: "hospital",
    city: "Oakland",
    state: "CA",
    country: "USA",
    phone: "(800) 464-4000",
    website: "https://www.kaiserpermanente.org",
    healthSystemId: "hs-kaiser",
    healthSystemName: "Kaiser Permanente",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    patientPortalUrl: "https://healthy.kaiserpermanente.org",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-006",
    name: "Cleveland Clinic",
    aliases: ["CCF", "Cleveland Clinic Foundation"],
    facilityType: "hospital",
    city: "Cleveland",
    state: "OH",
    country: "USA",
    zipCode: "44195",
    address: "9500 Euclid Ave",
    phone: "(216) 444-2200",
    website: "https://www.clevelandclinic.org",
    healthSystemId: "hs-ccf",
    healthSystemName: "Cleveland Clinic Health System",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    patientPortalUrl: "https://my.clevelandclinic.org",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-007",
    name: "Inova Fairfax Hospital",
    aliases: ["Inova", "Inova Fairfax"],
    facilityType: "hospital",
    city: "Falls Church",
    state: "VA",
    country: "USA",
    zipCode: "22042",
    address: "3300 Gallows Rd",
    phone: "(703) 776-4001",
    website: "https://www.inova.org",
    healthSystemId: "hs-inova",
    healthSystemName: "Inova Health System",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    patientPortalUrl: "https://mychart.inova.org",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-008",
    name: "CVS Pharmacy",
    aliases: ["CVS"],
    facilityType: "pharmacy",
    city: "Woonsocket",
    state: "RI",
    country: "USA",
    phone: "(888) 607-4287",
    website: "https://www.cvs.com",
    healthSystemName: "CVS Health",
    ehrVendor: "other",
    supportsFhir: false,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-009",
    name: "Walgreens Pharmacy",
    aliases: ["Walgreens"],
    facilityType: "pharmacy",
    city: "Deerfield",
    state: "IL",
    country: "USA",
    phone: "(800) 925-4733",
    website: "https://www.walgreens.com",
    healthSystemName: "Walgreens Boots Alliance",
    ehrVendor: "other",
    supportsFhir: false,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-010",
    name: "RadNet Imaging Center",
    aliases: ["RadNet"],
    facilityType: "imaging",
    city: "Los Angeles",
    state: "CA",
    country: "USA",
    phone: "(310) 478-7808",
    website: "https://www.radnet.com",
    healthSystemName: "RadNet Inc",
    ehrVendor: "other",
    supportsFhir: null,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-011",
    name: "Teladoc Health",
    aliases: ["Teladoc"],
    facilityType: "telehealth",
    city: "Purchase",
    state: "NY",
    country: "USA",
    phone: "(800) 835-2362",
    website: "https://www.teladoc.com",
    healthSystemName: "Teladoc Health",
    ehrVendor: "other",
    supportsFhir: false,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fac-012",
    name: "MinuteClinic",
    aliases: ["CVS MinuteClinic"],
    facilityType: "urgent_care",
    city: "Woonsocket",
    state: "RI",
    country: "USA",
    phone: "(866) 389-2727",
    website: "https://www.cvs.com/minuteclinic",
    healthSystemName: "CVS Health",
    ehrVendor: "fastenhealth",
    supportsFhir: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const patientFacilities: PatientCareFacility[] = [];
const onboardingSessions: FacilityOnboardingSession[] = [];

function requirePatient(req: Request, res: Response): string | null {
  const user = req.user as { id?: string } | undefined;
  if (user?.id) return user.id;
  
  if (process.env.NODE_ENV === "development") {
    return "patient-001";
  }
  
  res.status(401).json({ error: "Authentication required" });
  return null;
}

function calculateMatchScore(facility: CareFacility, query: string, facilityTypeFilter?: FacilityType): number {
  const q = query.toLowerCase();
  let score = 0;
  
  if (facility.name.toLowerCase().includes(q)) score += 50;
  if (facility.name.toLowerCase().startsWith(q)) score += 30;
  if (facility.aliases.some(a => a.toLowerCase().includes(q))) score += 20;
  if (facility.healthSystemName?.toLowerCase().includes(q)) score += 15;
  if (facility.city.toLowerCase().includes(q)) score += 10;
  if (facility.state.toLowerCase() === q) score += 10;
  
  if (facilityTypeFilter && facility.facilityType === facilityTypeFilter) score += 25;
  
  if (facility.supportsFhir) score += 10;
  if (facility.patientPortalUrl) score += 5;
  if (facility.isVerified) score += 5;
  
  return score;
}

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const facilityType = req.query.type as FacilityType | undefined;
    const limit = parseInt(req.query.limit as string) || 5;

    if (query.length < 2) {
      return res.json([]);
    }

    const results: FacilitySearchResult[] = sampleFacilities
      .map(f => ({
        id: f.id,
        name: f.name,
        aliases: f.aliases,
        facilityType: f.facilityType,
        city: f.city,
        state: f.state,
        country: f.country,
        phone: f.phone,
        website: f.website,
        npi: f.npi,
        healthSystemId: f.healthSystemId,
        healthSystemName: f.healthSystemName,
        ehrVendor: f.ehrVendor,
        supportsFhir: f.supportsFhir,
        fhirBaseUrl: f.fhirBaseUrl,
        patientPortalUrl: f.patientPortalUrl,
        notes: f.notes,
        matchScore: calculateMatchScore(f, query, facilityType),
      }))
      .filter(f => f.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    res.json(results);
  } catch (error) {
    console.error("[FacilityOnboarding] Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/facility/:id", async (req: Request, res: Response) => {
  try {
    const facility = sampleFacilities.find(f => f.id === req.params.id);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    res.json(facility);
  } catch (error) {
    console.error("[FacilityOnboarding] Get facility error:", error);
    res.status(500).json({ error: "Failed to get facility" });
  }
});

router.get("/quick-picks/:type", async (req: Request, res: Response) => {
  try {
    const type = req.params.type as "lab" | "imaging";
    
    const quickPicks: { id: string; name: string; popular: boolean }[] = [];
    
    if (type === "lab") {
      quickPicks.push(
        { id: "fac-003", name: "Labcorp", popular: true },
        { id: "fac-004", name: "Quest Diagnostics", popular: true },
        { id: "hospital-lab", name: "Hospital lab", popular: false },
        { id: "other-lab", name: "Other / not sure", popular: false },
      );
    } else if (type === "imaging") {
      quickPicks.push(
        { id: "hospital-imaging", name: "Hospital imaging department", popular: true },
        { id: "outpatient-imaging", name: "Outpatient imaging center", popular: false },
        { id: "radiology-group", name: "Radiology group clinic", popular: false },
        { id: "other-imaging", name: "Other / not sure", popular: false },
      );
    }
    
    res.json(quickPicks);
  } catch (error) {
    console.error("[FacilityOnboarding] Quick picks error:", error);
    res.status(500).json({ error: "Failed to get quick picks" });
  }
});

router.get("/session", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    let session = onboardingSessions.find(s => s.patientId === patientId && !s.isComplete);
    
    if (!session) {
      session = {
        id: generateId("fos"),
        patientId,
        currentStep: 0,
        selectedFacilityTypes: [],
        facilities: [],
        quickPickLabs: [],
        quickPickImaging: [],
        isComplete: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onboardingSessions.push(session);
    }

    res.json(session);
  } catch (error) {
    console.error("[FacilityOnboarding] Get session error:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.patch("/session", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const sessionIndex = onboardingSessions.findIndex(s => s.patientId === patientId && !s.isComplete);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { currentStep, selectedFacilityTypes, quickPickLabs, quickPickImaging } = req.body;
    const session = onboardingSessions[sessionIndex];
    
    if (currentStep !== undefined) session.currentStep = currentStep;
    if (selectedFacilityTypes) session.selectedFacilityTypes = selectedFacilityTypes;
    if (quickPickLabs) session.quickPickLabs = quickPickLabs;
    if (quickPickImaging) session.quickPickImaging = quickPickImaging;
    session.updatedAt = new Date().toISOString();

    res.json(session);
  } catch (error) {
    console.error("[FacilityOnboarding] Update session error:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.post("/session/skip", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const sessionIndex = onboardingSessions.findIndex(s => s.patientId === patientId && !s.isComplete);
    if (sessionIndex !== -1) {
      onboardingSessions[sessionIndex].skippedAt = new Date().toISOString();
      onboardingSessions[sessionIndex].isComplete = true;
    }

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "FacilityOnboardingSession",
      patientId,
      details: "Facility onboarding skipped",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[FacilityOnboarding] Skip session error:", error);
    res.status(500).json({ error: "Failed to skip session" });
  }
});

router.post("/session/complete", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const sessionIndex = onboardingSessions.findIndex(s => s.patientId === patientId && !s.isComplete);
    if (sessionIndex !== -1) {
      onboardingSessions[sessionIndex].isComplete = true;
      onboardingSessions[sessionIndex].completedAt = new Date().toISOString();
    }

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "FacilityOnboardingSession",
      patientId,
      details: `Facility onboarding completed with ${patientFacilities.filter(f => f.patientId === patientId).length} facilities`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[FacilityOnboarding] Complete session error:", error);
    res.status(500).json({ error: "Failed to complete session" });
  }
});

router.get("/facilities", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const facilities = patientFacilities.filter(f => f.patientId === patientId);
    res.json(facilities);
  } catch (error) {
    console.error("[FacilityOnboarding] Get facilities error:", error);
    res.status(500).json({ error: "Failed to get facilities" });
  }
});

router.post("/facilities", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const validated = insertPatientCareFacilitySchema.parse({ ...req.body, patientId });
    
    const facility: PatientCareFacility = {
      id: generateId("pcf"),
      ...validated,
      visitDateUnsure: validated.visitDateUnsure ?? false,
      servicesReceived: validated.servicesReceived ?? [],
      hasPortalAccount: validated.hasPortalAccount ?? "not_sure",
      knowsPortalLogin: validated.knowsPortalLogin ?? null,
      isManualEntry: validated.isManualEntry ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    patientFacilities.push(facility);

    const sessionIndex = onboardingSessions.findIndex(s => s.patientId === patientId && !s.isComplete);
    if (sessionIndex !== -1) {
      onboardingSessions[sessionIndex].facilities.push(facility);
    }

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "PatientCareFacility",
      resourceId: facility.id,
      patientId,
      details: `Added facility: ${facility.facilityName}, manual: ${facility.isManualEntry}`,
    });

    res.status(201).json(facility);
  } catch (error) {
    console.error("[FacilityOnboarding] Add facility error:", error);
    res.status(400).json({ error: "Invalid facility data" });
  }
});

router.patch("/facilities/:id", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const facilityIndex = patientFacilities.findIndex(
      f => f.id === req.params.id && f.patientId === patientId
    );
    
    if (facilityIndex === -1) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const updates = req.body;
    const facility = patientFacilities[facilityIndex];
    
    Object.assign(facility, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "PatientCareFacility",
      resourceId: facility.id,
      patientId,
      details: `Updated facility: ${facility.facilityName}`,
    });

    res.json(facility);
  } catch (error) {
    console.error("[FacilityOnboarding] Update facility error:", error);
    res.status(500).json({ error: "Failed to update facility" });
  }
});

router.delete("/facilities/:id", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const facilityIndex = patientFacilities.findIndex(
      f => f.id === req.params.id && f.patientId === patientId
    );
    
    if (facilityIndex === -1) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const [removed] = patientFacilities.splice(facilityIndex, 1);

    logPhiAccess({
      userId: patientId,
      action: "delete",
      resourceType: "PatientCareFacility",
      resourceId: removed.id,
      patientId,
      details: `Removed facility: ${removed.facilityName}`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[FacilityOnboarding] Delete facility error:", error);
    res.status(500).json({ error: "Failed to delete facility" });
  }
});

export default router;
