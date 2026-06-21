import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  ResearchDataAggregationService, 
  type ResearchDataCategory,
  type AggregatedDataQuery 
} from "./services/research-data-aggregation";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();
const service = ResearchDataAggregationService.getInstance();

function getUser(req: Request): { id: string; role?: string } | undefined {
  const user = (req as any).user;
  if (user?.id) return { id: user.id, role: user.role || "patient" };
  if (user?.claims?.sub) return { id: user.claims.sub, role: "patient" };
  const session = (req as any).session;
  if (session?.userId) return { id: session.userId, role: session.userRole || "patient" };
  return { id: "current-user", role: "patient" };
}

function requireProvider(req: Request, res: Response, next: () => void) {
  const user = getUser(req);
  if (!user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  (req as any).authUser = user;
  next();
}

const researchCategorySchema = z.enum([
  "treatment_outcomes",
  "late_effects",
  "adherence_rates",
  "quality_of_life",
  "survival_rates",
  "demographics",
  "treatment_regimens",
  "symptom_prevalence",
]);

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = service.getAllCategories();
    const categoriesWithInfo = categories.map(cat => ({
      id: cat,
      ...service.getCategoryDescription(cat),
    }));

    res.json({
      data: categoriesWithInfo,
      meta: {
        totalCategories: categories.length,
      },
    });
  } catch (error) {
    console.error("[ResearchAggregation] Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch research categories" });
  }
});

router.get("/patient/consents", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const profileId = (req.query.profileId as string) || "profile-self-001";
    const consents = await service.getPatientResearchConsents(user.id, profileId);

    const consentsWithInfo = consents.map(consent => ({
      ...consent,
      ...service.getCategoryDescription(consent.category),
    }));

    res.json({
      data: consentsWithInfo,
      meta: {
        totalCategories: consents.length,
        optedInCount: consents.filter(c => c.isOptedIn).length,
        optedOutCount: consents.filter(c => !c.isOptedIn).length,
      },
    });
  } catch (error) {
    console.error("[ResearchAggregation] Error fetching patient consents:", error);
    res.status(500).json({ error: "Failed to fetch research consents" });
  }
});

router.patch("/patient/consents/:category", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const category = researchCategorySchema.parse(req.params.category);
    const { isOptedIn, profileId = "profile-self-001" } = req.body;

    if (typeof isOptedIn !== "boolean") {
      return res.status(400).json({ error: "isOptedIn must be a boolean" });
    }

    const consent = await service.updateResearchConsent(user.id, profileId, category, isOptedIn);

    await logPhiAccess({
      userId: user.id,
      action: "write",
      resourceType: "ResearchConsent",
      resourceId: consent.id,
      details: JSON.stringify({ category, isOptedIn, profileId, consentAction: isOptedIn ? "granted" : "revoked" }),
    });

    res.json({
      data: {
        ...consent,
        ...service.getCategoryDescription(consent.category),
      },
      message: isOptedIn 
        ? `You have opted in to share your ${category.replace(/_/g, " ")} data for research.`
        : `You have opted out of sharing your ${category.replace(/_/g, " ")} data for research.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid category" });
    }
    console.error("[ResearchAggregation] Error updating consent:", error);
    res.status(500).json({ error: "Failed to update research consent" });
  }
});

router.put("/patient/consents/bulk", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { updates, profileId = "profile-self-001" } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "updates must be an array" });
    }

    const validatedUpdates = updates.map(update => ({
      category: researchCategorySchema.parse(update.category),
      isOptedIn: Boolean(update.isOptedIn),
    }));

    const consents = await service.bulkUpdateResearchConsents(user.id, profileId, validatedUpdates);

    await logPhiAccess({
      userId: user.id,
      action: "write",
      resourceType: "ResearchConsent",
      details: JSON.stringify({ updates: validatedUpdates, profileId, bulkUpdate: true }),
    });

    res.json({
      data: consents.map(consent => ({
        ...consent,
        ...service.getCategoryDescription(consent.category),
      })),
      message: "Research consent preferences updated successfully.",
    });
  } catch (error) {
    console.error("[ResearchAggregation] Error bulk updating consents:", error);
    res.status(500).json({ error: "Failed to update research consents" });
  }
});

const querySchema = z.object({
  categories: z.array(researchCategorySchema).min(1),
  filters: z.object({
    cancerTypes: z.array(z.string()).optional(),
    treatmentRegimens: z.array(z.string()).optional(),
    ageRanges: z.array(z.string()).optional(),
    genders: z.array(z.string()).optional(),
    stages: z.array(z.string()).optional(),
    timeRanges: z.array(z.object({
      start: z.string(),
      end: z.string(),
    })).optional(),
  }).optional(),
  groupBy: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
});

router.post("/provider/query", requireProvider, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser;
    const query = querySchema.parse(req.body);

    await logPhiAccess({
      userId: user.id,
      action: "read",
      resourceType: "AggregatedResearchData",
      details: JSON.stringify({ query, role: user.role }),
    });

    const results = await service.queryAggregatedData(query as AggregatedDataQuery, user.id);

    res.json({
      data: results,
      meta: {
        queriedAt: new Date().toISOString(),
        categoriesQueried: query.categories.length,
        filtersApplied: Object.keys(query.filters || {}).length,
        complianceNote: "All data is anonymized and aggregated. Individual patient identification is not possible.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("[ResearchAggregation] Error querying data:", error);
    res.status(500).json({ error: "Failed to query aggregated data" });
  }
});

router.get("/provider/quick-stats", requireProvider, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser;

    const allCategories = service.getAllCategories();
    const categoryStats = await Promise.all(
      allCategories.map(async cat => ({
        category: cat,
        ...service.getCategoryDescription(cat),
        consentedPatients: await service.getConsentedPatientCount(cat),
      }))
    );

    res.json({
      data: {
        totalResearchCategories: allCategories.length,
        categorySummary: categoryStats,
        lastUpdated: new Date().toISOString(),
      },
      disclaimer: "Patient counts reflect those who have explicitly opted in to share their data for research purposes.",
    });
  } catch (error) {
    console.error("[ResearchAggregation] Error fetching quick stats:", error);
    res.status(500).json({ error: "Failed to fetch quick statistics" });
  }
});

router.get("/provider/filters", async (req: Request, res: Response) => {
  try {
    res.json({
      data: {
        cancerTypes: [
          "Breast Cancer",
          "Colorectal Cancer",
          "Lung Cancer",
          "Lymphoma",
          "Prostate Cancer",
          "Leukemia",
          "Melanoma",
          "Bladder Cancer",
          "Kidney Cancer",
          "Thyroid Cancer",
        ],
        treatmentRegimens: [
          "Chemotherapy Only",
          "Immunotherapy Only",
          "Combined Chemo + Immuno",
          "Targeted Therapy",
          "Hormone Therapy",
          "Radiation + Chemo",
          "Surgery + Adjuvant",
          "Active Surveillance",
        ],
        ageRanges: [
          "18-34",
          "35-49",
          "50-64",
          "65-74",
          "75+",
        ],
        stages: [
          "Stage I",
          "Stage II",
          "Stage III",
          "Stage IV",
        ],
        genders: [
          "Male",
          "Female",
          "Other",
        ],
        treatmentPhases: [
          "Active Treatment",
          "Maintenance",
          "Surveillance",
          "Palliative",
        ],
      },
    });
  } catch (error) {
    console.error("[ResearchAggregation] Error fetching filters:", error);
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

router.get("/provider/export/:format", requireProvider, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser;
    const format = req.params.format;
    const { categories } = req.query;

    if (!["csv", "json"].includes(format)) {
      return res.status(400).json({ error: "Format must be csv or json" });
    }

    const categoryList = categories 
      ? (categories as string).split(",").map(c => c.trim() as ResearchDataCategory)
      : service.getAllCategories();

    const query: AggregatedDataQuery = {
      categories: categoryList,
      filters: {},
    };

    const results = await service.queryAggregatedData(query, user.id);

    await logPhiAccess({
      userId: user.id,
      action: "export",
      resourceType: "AggregatedResearchData",
      details: JSON.stringify({ format, categories: categoryList }),
    });

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="research_data_${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        data: results,
        disclaimer: "This data is anonymized and aggregated for research purposes only.",
      });
    } else {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="research_data_${Date.now()}.csv"`);

      let csv = "Category,Total Patients,Consented Patients,Generated At\n";
      results.forEach(result => {
        csv += `"${result.category}",${result.totalPatients},${result.consentedPatients},"${result.generatedAt}"\n`;
      });
      csv += `\n"Disclaimer: This data is anonymized and aggregated for research purposes only."\n`;

      res.send(csv);
    }
  } catch (error) {
    console.error("[ResearchAggregation] Error exporting data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;

console.log("[Routes] Research Data Aggregation routes registered at /api/research/*");
console.log("[Routes] - Patient consents at /api/research/patient/consents");
console.log("[Routes] - Provider query at /api/research/provider/query");
