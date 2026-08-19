/**
 * Clinical workflow API — provider directory, diagnosis pick list, lab panels.
 *
 * Mounted at /api/clinical-workflow. Three groups:
 *
 *   Provider directory (US only — NPPES holds no international providers):
 *     GET  /specialties                    list specialties
 *     POST /specialties/resolve            spoken phrase -> specialty
 *     GET  /providers                      search by specialty + ZIP proximity
 *     POST /providers/voice-list           build a voice-readable pick list
 *     POST /providers/voice-select         interpret a spoken selection
 *     POST /referral                       compose a referral to a chosen NPI
 *
 *   Diagnosis pick list:
 *     GET  /diagnoses/search               autocomplete
 *     GET  /diagnoses/:id                  one entry + its linked panel
 *
 *   Lab panels:
 *     GET  /lab-panels                     list panels
 *     GET  /lab-panels/:id                 resolve first-line vs reflex
 *     POST /lab-panels/merge               deduplicate across panels
 *
 * The provider endpoints are gated on TEFCA_ENABLED, which is the existing
 * US/international switch: NPPES is a US registry, so on `.world` these return
 * 404 rather than offering a directory that cannot contain the user's country.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  listSpecialties,
  resolveSpecialty,
} from "./services/provider-directory/specialty-taxonomy";
import { searchProviders } from "./services/provider-directory/nppes-client";
import {
  buildConfirmationPrompt,
  buildVoicePickList,
  interpretVoiceSelection,
} from "./services/provider-directory/voice-picklist";
import { composeReferral } from "./services/provider-directory/referral-composer";
import {
  getDiagnosis,
  listDiagnosisCategories,
  searchDiagnoses,
} from "./services/clinical-catalog/diagnosis-catalog";
import {
  listLabPanels,
  mergePanels,
  resolvePanel,
} from "./services/clinical-catalog/lab-panels";

function sessionUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

const providerSearchSchema = z.object({
  specialty: z.string().min(1),
  zip: z.string().min(5),
  rings: z.coerce.number().int().min(0).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const providerResultSchema = z.object({
  npi: z.string(),
  name: z.string(),
  kind: z.enum(["individual", "organization"]),
  credential: z.string().optional(),
  specialty: z.string(),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
  phone: z.string().optional(),
  proximityScore: z.number(),
  proximityLabel: z.string(),
});

const referralSchema = z.object({
  provider: providerResultSchema,
  patient: z.object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(130),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    conditions: z.array(z.string()).default([]),
    medications: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
  }),
  reason: z.string().min(1),
  urgency: z.enum(["routine", "urgent", "emergent"]).default("routine"),
  referringClinician: z.string().min(1),
  referringClinic: z.string().min(1),
  pertinentFindings: z.array(z.string()).optional(),
  additionalNotes: z.string().optional(),
});

export function registerClinicalWorkflowRoutes(app: Express): void {
  app.use("/api/clinical-workflow", noStorePhi);

  // NPPES is US-only. On the international build this whole surface is absent
  // rather than returning an empty directory that looks like "no providers".
  const usOnly = process.env.TEFCA_ENABLED !== "false";
  const requireUs = (_req: Request, res: Response, next: () => void) => {
    if (!usOnly) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message:
          "The provider directory uses the US NPPES registry and is not available in this region.",
      });
    }
    next();
  };

  // ── Provider directory ────────────────────────────────────────────────────

  app.get("/api/clinical-workflow/specialties", requireUs, (_req, res) => {
    res.json({ specialties: listSpecialties() });
  });

  /** Resolve a spoken phrase ("find me a heart doctor") to a specialty. */
  app.post("/api/clinical-workflow/specialties/resolve", requireUs, (req, res) => {
    const phrase = typeof req.body?.phrase === "string" ? req.body.phrase : "";
    const match = resolveSpecialty(phrase);
    if (!match) {
      return res.json({
        resolved: null,
        reprompt:
          "I did not recognise that specialty. You can say, for example, cardiology, dermatology, or primary care.",
      });
    }
    res.json({ resolved: { id: match.id, name: match.name } });
  });

  app.get(
    "/api/clinical-workflow/providers",
    isAuthenticated,
    requireUs,
    async (req: Request, res: Response) => {
      const parsed = providerSearchSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      try {
        const result = await searchProviders({
          specialtyId: parsed.data.specialty,
          zip: parsed.data.zip,
          rings: parsed.data.rings,
          limit: parsed.data.limit,
        });
        res.json(result);
      } catch (error) {
        // Unknown specialty and malformed ZIP are user errors, not faults.
        res.status(400).json({ error: (error as Error).message });
      }
    },
  );

  /** Build the numbered list an assistant reads aloud. */
  app.post(
    "/api/clinical-workflow/providers/voice-list",
    isAuthenticated,
    requireUs,
    (req: Request, res: Response) => {
      const providers = z.array(providerResultSchema).safeParse(req.body?.providers);
      if (!providers.success) {
        return res.status(400).json({ error: "providers[] is required" });
      }
      const specialtyName =
        typeof req.body?.specialtyName === "string"
          ? req.body.specialtyName
          : "specialist";
      const page = Number(req.body?.page ?? 0);
      res.json(buildVoicePickList(providers.data, specialtyName, page));
    },
  );

  /** Interpret a spoken selection against a previously built list. */
  app.post(
    "/api/clinical-workflow/providers/voice-select",
    isAuthenticated,
    requireUs,
    (req: Request, res: Response) => {
      const providers = z.array(providerResultSchema).safeParse(req.body?.providers);
      if (!providers.success) {
        return res.status(400).json({ error: "providers[] is required" });
      }
      const utterance =
        typeof req.body?.utterance === "string" ? req.body.utterance : "";
      const page = Number(req.body?.page ?? 0);

      const list = buildVoicePickList(
        providers.data,
        typeof req.body?.specialtyName === "string"
          ? req.body.specialtyName
          : "specialist",
        page,
      );
      const selection = interpretVoiceSelection(utterance, list);

      res.json({
        selection,
        // Selection sends clinical detail to a third party, so it is always
        // confirmed by voice before the referral step.
        confirmationPrompt:
          selection.status === "selected"
            ? buildConfirmationPrompt(selection.item)
            : undefined,
      });
    },
  );

  app.post(
    "/api/clinical-workflow/referral",
    isAuthenticated,
    requireUs,
    async (req: Request, res: Response) => {
      const parsed = referralSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      try {
        const draft = await composeReferral(parsed.data);

        await logPhiAccess({
          userId: sessionUserId(req),
          resourceType: "referral-draft",
          resourceId: draft.id,
          action: "write",
          details: `Referral draft composed for NPI ${draft.addressedToNpi} (${draft.specialty}), aiGenerated=${draft.aiGenerated}`,
        });

        res.json({ referral: draft });
      } catch (error) {
        console.error("[ClinicalWorkflow] Referral composition failed:", error);
        res.status(500).json({ error: "Failed to compose referral draft" });
      }
    },
  );

  // ── Diagnosis pick list ───────────────────────────────────────────────────

  app.get(
    "/api/clinical-workflow/diagnoses/search",
    isAuthenticated,
    (req: Request, res: Response) => {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50);
      const category =
        typeof req.query.category === "string" ? req.query.category : undefined;

      res.json({
        query: q,
        results: searchDiagnoses(q, { limit, category: category as never }),
        categories: listDiagnosisCategories(),
      });
    },
  );

  app.get(
    "/api/clinical-workflow/diagnoses/:id",
    isAuthenticated,
    (req: Request, res: Response) => {
      const entry = getDiagnosis(req.params.id);
      if (!entry) return res.status(404).json({ error: "Diagnosis not found" });

      // Return the linked workup alongside, so selecting a diagnosis can
      // propose its panel in one round trip.
      const panel = entry.labPanelId ? resolvePanel(entry.labPanelId) : null;
      res.json({ diagnosis: entry, suggestedPanel: panel });
    },
  );

  // ── Lab panels ────────────────────────────────────────────────────────────

  app.get("/api/clinical-workflow/lab-panels", isAuthenticated, (_req, res) => {
    res.json({ panels: listLabPanels() });
  });

  app.get(
    "/api/clinical-workflow/lab-panels/:id",
    isAuthenticated,
    (req: Request, res: Response) => {
      const includeReflex = req.query.includeReflex === "true";
      const resolved = resolvePanel(req.params.id, { includeReflex });
      if (!resolved) return res.status(404).json({ error: "Panel not found" });
      res.json(resolved);
    },
  );

  app.post(
    "/api/clinical-workflow/lab-panels/merge",
    isAuthenticated,
    (req: Request, res: Response) => {
      const ids = z.array(z.string()).max(20).safeParse(req.body?.panelIds);
      if (!ids.success) {
        return res.status(400).json({ error: "panelIds[] is required" });
      }
      const tests = mergePanels(ids.data);
      res.json({
        tests,
        firstLine: tests.filter((t) => t.tier === "first-line"),
        reflex: tests.filter((t) => t.tier === "reflex"),
      });
    },
  );

  console.log(
    "[Routes] Clinical workflow routes registered at /api/clinical-workflow/*",
  );
}
