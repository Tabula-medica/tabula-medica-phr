import { Router, Request, Response } from "express";
import { db } from "./db";
import { facilities, type Facility, facilityTypes, insertFacilitySchema, updateFacilitySchema } from "@shared/models/facility";
import { eq, ilike, or, sql, and, asc } from "drizzle-orm";
import { logPhiAccess } from "./security/hipaa-audit";
import { fromError } from "zod-validation-error";
import { z } from "zod";
import {
  trackFacilityEvent,
  getFacilityAnalyticsEvents,
  getFacilityOnboardingFunnel,
  getPopularFacilities,
  getOnboardingConfig,
  type FacilityAnalyticsEventType,
  type OnboardingMode,
} from "./services/facility-analytics";

const router = Router();

interface AutocompleteResult {
  id: string;
  name: string;
  facilityType: string;
  city: string | null;
  state: string | null;
  healthSystem: string | null;
  supportsFhir: boolean | null;
  patientPortalUrl: string | null;
  npi: string | null;
  matchScore: number;
}

const popularHealthSystems = new Set([
  "Kaiser Permanente",
  "HCA Healthcare", 
  "CommonSpirit Health",
  "Ascension",
  "Providence",
  "Trinity Health",
  "UPMC",
  "Advocate Aurora Health",
  "Atrium Health",
  "Intermountain Healthcare",
  "Johns Hopkins Health System",
  "Cleveland Clinic",
  "Mayo Clinic Health System",
  "Mass General Brigham",
  "NYU Langone Health",
]);

function calculateNameSimilarity(name: string, query: string): number {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (nameLower === queryLower) return 100;
  if (nameLower.startsWith(queryLower)) return 90;
  
  const words = nameLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(queryLower)) return 80;
  }
  
  if (nameLower.includes(queryLower)) return 60;
  
  let matchingChars = 0;
  let queryIdx = 0;
  for (let i = 0; i < nameLower.length && queryIdx < queryLower.length; i++) {
    if (nameLower[i] === queryLower[queryIdx]) {
      matchingChars++;
      queryIdx++;
    }
  }
  return Math.round((matchingChars / queryLower.length) * 40);
}

function calculateLocationScore(
  facilityCity: string | null,
  facilityState: string | null,
  userCity: string | null,
  userState: string | null
): number {
  if (!facilityState) return 0;
  
  if (userState && facilityState.toLowerCase() === userState.toLowerCase()) {
    if (userCity && facilityCity?.toLowerCase() === userCity.toLowerCase()) {
      return 30;
    }
    return 15;
  }
  return 0;
}

function calculateFacilityScore(
  facility: {
    name: string;
    facilityType: string;
    city: string | null;
    state: string | null;
    healthSystem: string | null;
    supportsFhir: boolean | null;
    patientPortalUrl: string | null;
  },
  query: string,
  userCity: string | null,
  userState: string | null,
  preferredType: string | null
): number {
  let score = 0;
  
  score += calculateNameSimilarity(facility.name, query);
  
  score += calculateLocationScore(facility.city, facility.state, userCity, userState);
  
  if (preferredType && facility.facilityType === preferredType) {
    score += 20;
  }
  
  if (facility.healthSystem && popularHealthSystems.has(facility.healthSystem)) {
    score += 15;
  }
  
  if (facility.supportsFhir) {
    score += 10;
  }
  if (facility.patientPortalUrl) {
    score += 5;
  }
  
  return score;
}

router.get("/autocomplete", async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string) || "";
    const preferredType = req.query.type as string | null;
    const userCity = req.query.city as string | null;
    const userState = req.query.state as string | null;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);

    if (query.length < 2) {
      return res.json({ results: [], total: 0, showManualEntry: true });
    }

    const searchPattern = `%${query}%`;

    const conditions = [
      or(
        ilike(facilities.name, searchPattern),
        sql`EXISTS (SELECT 1 FROM unnest(${facilities.aliases}) AS alias WHERE alias ILIKE ${searchPattern})`,
        ilike(facilities.city, searchPattern),
        ilike(facilities.healthSystem, searchPattern),
        ilike(facilities.npi, searchPattern)
      ),
      eq(facilities.isActive, true),
    ];

    if (preferredType && facilityTypes.includes(preferredType as any)) {
      conditions.push(eq(facilities.facilityType, preferredType));
    }

    const rawResults = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        facilityType: facilities.facilityType,
        city: facilities.city,
        state: facilities.state,
        healthSystem: facilities.healthSystem,
        supportsFhir: facilities.supportsFhir,
        patientPortalUrl: facilities.patientPortalUrl,
        npi: facilities.npi,
      })
      .from(facilities)
      .where(and(...conditions))
      .limit(50);

    const scoredResults: AutocompleteResult[] = rawResults.map((facility) => ({
      ...facility,
      matchScore: calculateFacilityScore(
        facility,
        query,
        userCity,
        userState,
        preferredType
      ),
    }));

    scoredResults.sort((a, b) => b.matchScore - a.matchScore);
    
    const topResults = scoredResults.slice(0, limit);

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Facility",
      details: `Autocomplete search: query="${query}", type="${preferredType || 'all'}", city="${userCity || 'none'}", state="${userState || 'none'}", resultCount=${topResults.length}`,
    });

    res.json({
      results: topResults,
      total: scoredResults.length,
      showManualEntry: true,
    });
  } catch (error) {
    console.error("[FacilityRoutes] Autocomplete error:", error);
    res.status(500).json({ error: "Failed to search facilities" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, id));

    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Facility",
      resourceId: id,
      details: `Viewed facility: ${facility.name}`,
    });

    res.json(facility);
  } catch (error) {
    console.error("[FacilityRoutes] Get facility error:", error);
    res.status(500).json({ error: "Failed to get facility" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    const state = req.query.state as string;
    const healthSystem = req.query.healthSystem as string;
    const supportsFhir = req.query.supportsFhir as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions = [eq(facilities.isActive, true)];

    if (type && facilityTypes.includes(type as any)) {
      conditions.push(eq(facilities.facilityType, type));
    }
    if (state) {
      conditions.push(ilike(facilities.state, state));
    }
    if (healthSystem) {
      conditions.push(ilike(facilities.healthSystem, `%${healthSystem}%`));
    }
    if (supportsFhir === "true") {
      conditions.push(eq(facilities.supportsFhir, true));
    } else if (supportsFhir === "false") {
      conditions.push(eq(facilities.supportsFhir, false));
    }

    const results = await db
      .select()
      .from(facilities)
      .where(and(...conditions))
      .orderBy(asc(facilities.name))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilities)
      .where(and(...conditions));

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Facility",
      details: `Listed facilities: type=${type || 'all'}, state=${state || 'all'}, count=${results.length}`,
    });

    res.json({
      facilities: results,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[FacilityRoutes] List facilities error:", error);
    res.status(500).json({ error: "Failed to list facilities" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = insertFacilitySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const [newFacility] = await db
      .insert(facilities)
      .values(parseResult.data)
      .returning();

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "Facility",
      resourceId: newFacility.id,
      details: `Created facility: ${newFacility.name} (${newFacility.facilityType})`,
    });

    res.status(201).json(newFacility);
  } catch (error) {
    console.error("[FacilityRoutes] Create facility error:", error);
    res.status(500).json({ error: "Failed to create facility" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const parseResult = updateFacilitySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const [updatedFacility] = await db
      .update(facilities)
      .set({ ...parseResult.data, updatedAt: new Date() })
      .where(eq(facilities.id, id))
      .returning();

    if (!updatedFacility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "Facility",
      resourceId: id,
      details: `Updated facility: ${updatedFacility.name}, fields: ${Object.keys(parseResult.data).join(", ")}`,
    });

    res.json(updatedFacility);
  } catch (error) {
    console.error("[FacilityRoutes] Update facility error:", error);
    res.status(500).json({ error: "Failed to update facility" });
  }
});

router.get("/types/list", async (_req: Request, res: Response) => {
  res.json({ types: facilityTypes });
});

router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilities)
      .where(eq(facilities.isActive, true));

    const typeCounts = await db
      .select({
        facilityType: facilities.facilityType,
        count: sql<number>`count(*)`,
      })
      .from(facilities)
      .where(eq(facilities.isActive, true))
      .groupBy(facilities.facilityType);

    const [fhirCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilities)
      .where(and(eq(facilities.isActive, true), eq(facilities.supportsFhir, true)));

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Facility",
      details: `Retrieved facility stats: total=${Number(totalCount?.count || 0)}, fhirEnabled=${Number(fhirCount?.count || 0)}`,
    });

    res.json({
      total: Number(totalCount?.count || 0),
      byType: typeCounts.reduce((acc, item) => {
        acc[item.facilityType] = Number(item.count);
        return acc;
      }, {} as Record<string, number>),
      fhirEnabled: Number(fhirCount?.count || 0),
    });
  } catch (error) {
    console.error("[FacilityRoutes] Stats error:", error);
    res.status(500).json({ error: "Failed to get facility stats" });
  }
});

const analyticsEventSchema = z.object({
  eventType: z.enum([
    "facility_onboarding_started",
    "facility_search_used",
    "facility_selected",
    "facility_manual_added",
    "facility_onboarding_completed",
    "facility_portal_known_yes",
    "facility_portal_known_no",
    "facility_skipped",
  ] as const),
  sessionId: z.string().optional(),
  metadata: z.object({
    facilityId: z.string().optional(),
    facilityType: z.string().optional(),
    facilityName: z.string().optional(),
    searchQuery: z.string().optional(),
    searchResultCount: z.number().optional(),
    matchScore: z.number().optional(),
    userCity: z.string().optional(),
    userState: z.string().optional(),
    portalKnown: z.boolean().optional(),
    fhirSupported: z.boolean().optional(),
    completionStep: z.string().optional(),
    skipReason: z.string().optional(),
  }).optional(),
});

router.post("/analytics/track", async (req: Request, res: Response) => {
  try {
    const parseResult = analyticsEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const userId = (req as any).user?.id || "anonymous";
    const { eventType, sessionId, metadata } = parseResult.data;

    const event = trackFacilityEvent(
      eventType as FacilityAnalyticsEventType,
      userId,
      metadata || {},
      sessionId
    );

    res.status(201).json({ success: true, eventId: event.id });
  } catch (error) {
    console.error("[FacilityRoutes] Analytics track error:", error);
    res.status(500).json({ error: "Failed to track analytics event" });
  }
});

router.get("/analytics/events", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const eventType = req.query.eventType as FacilityAnalyticsEventType | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const events = getFacilityAnalyticsEvents({
      userId,
      eventType,
      limit,
    });

    const requestUserId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId: requestUserId,
      action: "read",
      resourceType: "FacilityAnalytics",
      details: `Retrieved analytics events: count=${events.length}, filters: userId=${userId || 'all'}, eventType=${eventType || 'all'}`,
    });

    res.json({ events, total: events.length });
  } catch (error) {
    console.error("[FacilityRoutes] Analytics events error:", error);
    res.status(500).json({ error: "Failed to get analytics events" });
  }
});

router.get("/analytics/funnel", async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const funnel = getFacilityOnboardingFunnel(startDate, endDate);

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FacilityAnalytics",
      details: `Retrieved onboarding funnel: startDate=${startDate || 'all'}, endDate=${endDate || 'all'}`,
    });

    res.json(funnel);
  } catch (error) {
    console.error("[FacilityRoutes] Analytics funnel error:", error);
    res.status(500).json({ error: "Failed to get onboarding funnel" });
  }
});

router.get("/analytics/popular", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const popularFacilities = getPopularFacilities(limit);

    const userId = (req as any).user?.id || "anonymous";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FacilityAnalytics",
      details: `Retrieved popular facilities: limit=${limit}`,
    });

    res.json({ facilities: popularFacilities });
  } catch (error) {
    console.error("[FacilityRoutes] Analytics popular error:", error);
    res.status(500).json({ error: "Failed to get popular facilities" });
  }
});

router.get("/onboarding/config", async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as OnboardingMode) || "fast";
    const config = getOnboardingConfig(mode);

    res.json({
      ...config,
      safetyGuidelines: {
        neverCollects: [
          "Portal passwords",
          "Full MRN/Account numbers (optional later)",
          "Social Security Number",
          "Insurance ID (optional later)",
        ],
        rationale: "HIPAA/SOC2 compliance and user trust",
      },
    });
  } catch (error) {
    console.error("[FacilityRoutes] Onboarding config error:", error);
    res.status(500).json({ error: "Failed to get onboarding config" });
  }
});

export default router;
