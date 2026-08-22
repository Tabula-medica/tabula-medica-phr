/**
 * RVU API — Medicare Physician Fee Schedule pricing and per-provider wRVU.
 *
 * Mounted at /api/rvu. US only, gated on TEFCA_ENABLED: the Physician Fee
 * Schedule is a Medicare construct, and an "RVU" computed anywhere else would be
 * a number with no payer behind it.
 *
 *   GET  /model                  loaded PFS table status and provenance
 *   POST /price                  price one session's lines (MPPR applied across them)
 *   POST /productivity           per-provider wRVU for a period
 *   POST /productivity/compare   the same sessions under both attribution bases
 *
 * Productivity is reported in **work RVU**, and every report carries its caveats
 * inline — attribution basis, missing FTEs, unpriced lines, short periods. A
 * wRVU number quoted without those is how a compensation conversation goes
 * wrong.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import { PFS_MODEL } from "@shared/rvu";
import { getPfsTables, pfsTablesLoaded } from "./services/rvu/pfs-tables";
import { priceSession } from "./services/rvu/rvu-calculator";
import {
  buildProductivityReport,
  compareAttributionBases,
  type EncounterSession,
} from "./services/rvu/provider-productivity";

function sessionUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

const serviceLineSchema = z.object({
  code: z.string().min(1).max(10),
  modifiers: z.array(z.string().min(1).max(4)).max(4).optional(),
  units: z.number().int().min(1).max(999).optional(),
  siteOfService: z.enum(["facility", "non-facility"]),
  dateOfService: z.string().optional(),
  renderingNpi: z.string().optional(),
  billingNpi: z.string().optional(),
});

const priceSchema = z.object({
  lines: z.array(serviceLineSchema).min(1).max(100),
  localityCode: z.string().min(1).max(16),
});

const encounterSessionSchema = z.object({
  lines: z.array(serviceLineSchema).min(1).max(100),
  localityCode: z.string().min(1).max(16),
});

const productivitySchema = z.object({
  sessions: z.array(encounterSessionSchema).min(1).max(2000),
  providers: z
    .array(
      z.object({
        npi: z.string().min(1),
        name: z.string().optional(),
        specialty: z.string().optional(),
        clinicalFte: z.number().min(0.01).max(2).optional(),
      }),
    )
    .default([]),
  period: z.object({ start: z.string(), end: z.string() }),
  basis: z.enum(["rendering", "billing"]).optional(),
});

export function registerRvuRoutes(app: Express): void {
  const usOnly = process.env.TEFCA_ENABLED !== "false";
  if (!usOnly) {
    console.log(
      "[RVU] TEFCA_ENABLED=false — Physician Fee Schedule endpoints disabled. " +
        "RVUs are a US Medicare construct.",
    );
    return;
  }

  app.use("/api/rvu", noStorePhi);

  app.get("/api/rvu/model", (_req: Request, res: Response) => {
    const tables = getPfsTables();
    res.json({
      model: PFS_MODEL,
      tablesLoaded: tables !== null,
      year: tables?.year ?? null,
      conversionFactor: tables?.conversionFactor ?? null,
      codesLoaded: tables?.rvu.size ?? 0,
      localitiesLoaded: tables?.gpci.size ?? 0,
      provenance: tables?.provenance ?? null,
      ...(tables
        ? {}
        : {
            reason:
              "No CMS Physician Fee Schedule tables loaded. Set PFS_RVU_TABLES_PATH " +
              "to a converted Relative Value File + GPCI file + conversion factor. " +
              "Pricing stays unavailable until then — a stale conversion factor " +
              "misprices every line without any visible symptom.",
          }),
      cptLicensing:
        "RVU values are US Government work. CPT code descriptors are AMA copyright " +
        "and require a license; this system stores them only if a deployment supplies " +
        "them and never ships them.",
    });
  });

  app.post("/api/rvu/price", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = priceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid pricing request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "rvu-pricing",
      action: "read",
      details: `Priced ${parsed.data.lines.length} line(s) in locality ${parsed.data.localityCode}`,
    }).catch(() => {});

    const result = priceSession(parsed.data.lines, { localityCode: parsed.data.localityCode });
    res.json({ ...result, tablesLoaded: pfsTablesLoaded() });
  });

  app.post("/api/rvu/productivity", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = productivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid productivity request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "rvu-productivity",
      action: "read",
      details:
        `wRVU productivity over ${parsed.data.sessions.length} session(s), ` +
        `basis=${parsed.data.basis ?? "rendering"}`,
    }).catch(() => {});

    const report = buildProductivityReport(
      parsed.data.sessions as EncounterSession[],
      parsed.data.providers,
      parsed.data.period,
      { basis: parsed.data.basis },
    );
    res.json({ ...report, tablesLoaded: pfsTablesLoaded() });
  });

  app.post("/api/rvu/productivity/compare", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = productivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid comparison request", details: parsed.error.issues });
    }
    await logPhiAccess({
      userId: sessionUserId(req),
      resourceType: "rvu-productivity",
      action: "read",
      details: "wRVU attribution basis comparison (rendering vs billing NPI)",
    }).catch(() => {});

    const comparison = compareAttributionBases(
      parsed.data.sessions as EncounterSession[],
      parsed.data.providers,
      parsed.data.period,
    );
    res.json({
      ...comparison,
      tablesLoaded: pfsTablesLoaded(),
      interpretation:
        "`shifts` lists the wRVU that moves between providers depending on whether " +
        "credit follows who performed the service or whose NPI it was billed under. " +
        "A large shift usually means incident-to billing is in use.",
    });
  });
}
