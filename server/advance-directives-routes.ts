import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import {
  advanceDirectivesTable,
  advanceDirectiveCodeStatuses,
  documentsTable,
  folders,
  profiles,
  type TreatmentPreferences,
} from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { logPhiAccess } from "./security/hipaa-audit";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";

const ADVANCE_DIRECTIVES_FOLDER_KEY = "advance_directives";
const ADVANCE_DIRECTIVES_FOLDER_NAME = "Advance Directives";

const TREATMENT_PREFERENCE_KEYS: (keyof TreatmentPreferences)[] = [
  "antibioticsIv",
  "antibioticsOral",
  "bloodTransfusion",
  "diagnosticTest",
  "hcProxyInvoked",
  "hospitalization",
  "ivHydration",
  "labTest",
  "surgicalIntervention",
  "feedingTube",
  "intubation",
];

const treatmentPreferenceValue = z.enum(["yes", "no"]).nullable();

const treatmentPreferencesSchema = z
  .object({
    antibioticsIv: treatmentPreferenceValue,
    antibioticsOral: treatmentPreferenceValue,
    bloodTransfusion: treatmentPreferenceValue,
    diagnosticTest: treatmentPreferenceValue,
    hcProxyInvoked: treatmentPreferenceValue,
    hospitalization: treatmentPreferenceValue,
    ivHydration: treatmentPreferenceValue,
    labTest: treatmentPreferenceValue,
    surgicalIntervention: treatmentPreferenceValue,
    feedingTube: treatmentPreferenceValue,
    intubation: treatmentPreferenceValue,
  })
  .partial();

const upsertDirectiveSchema = z.object({
  familyPrimaryGoalOfCare: z.string().max(2000).optional().nullable(),
  goalsOfCare: z.string().max(8000).optional().nullable(),
  codeStatus: z.array(z.enum(advanceDirectiveCodeStatuses)).optional().nullable(),
  treatmentPreferences: treatmentPreferencesSchema.optional().nullable(),
});

const attachDocumentSchema = z.object({
  objectPath: z.string().min(1),
  title: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  source: z.string().max(500).optional().nullable(),
  dateOfService: z.string().optional().nullable(),
});

function getSessionUserId(req: Request): string | null {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    null
  );
}

/**
 * Resolve the caller's own profileId from their authenticated account. All
 * directive data is scoped to this profile, so ownership is enforced simply by
 * only ever operating on the profile that belongs to the session account.
 */
async function resolveOwnProfileId(req: Request): Promise<string | null> {
  const accountId = getSessionUserId(req);
  if (!accountId) return null;

  const rows = await phiDb
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);

  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Ensure the per-profile "Advance Directives" system folder exists, creating it
 * on first access. Returns the folderId. The `folders.key` column is globally
 * unique, so the key is namespaced per profile to avoid collisions across
 * profiles while keeping a stable, greppable prefix.
 */
async function ensureAdvanceDirectivesFolder(profileId: string): Promise<string> {
  const scopedKey = `${ADVANCE_DIRECTIVES_FOLDER_KEY}:${profileId}`;

  const existing = await phiDb
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.profileId, profileId), eq(folders.key, scopedKey)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await phiDb
    .insert(folders)
    .values({
      profileId,
      key: scopedKey,
      name: ADVANCE_DIRECTIVES_FOLDER_NAME,
      isSystem: true,
    })
    .onConflictDoNothing({ target: folders.key })
    .returning({ id: folders.id });

  if (created) return created.id;

  // Lost the race (another request created it) — read it back.
  const [row] = await phiDb
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.profileId, profileId), eq(folders.key, scopedKey)))
    .limit(1);

  return row.id;
}

export function registerAdvanceDirectivesRoutes(app: Express): void {
  // Every response carries no-store PHI headers, including auth failures.
  app.use("/api/advance-directives", noStorePhi);

  const requireProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const profileId = await resolveOwnProfileId(req);
      if (!profileId) {
        return res.status(403).json({ error: "No profile found for this account" });
      }
      (req as any).resolvedProfileId = profileId;
      next();
    } catch (error) {
      console.error("[AdvanceDirectives] Profile resolution failed:", error);
      res.status(500).json({ error: "Failed to resolve profile" });
    }
  };

  /**
   * GET the current directive for the authenticated profile.
   * Returns { directive: null } when none has been saved yet.
   */
  app.get(
    "/api/advance-directives",
    isAuthenticated,
    requireProfile,
    async (req: Request, res: Response) => {
      try {
        const profileId = (req as any).resolvedProfileId as string;

        const rows = await phiDb
          .select()
          .from(advanceDirectivesTable)
          .where(eq(advanceDirectivesTable.profileId, profileId))
          .limit(1);

        await logPhiAccess({
          userId: getSessionUserId(req)!,
          patientId: profileId,
          action: "read",
          resourceType: "advance_directive",
          resourceId: profileId,
          details: `Read advance directive for profile ${profileId}`,
        });

        if (rows.length === 0) {
          return res.json({ directive: null });
        }

        const directive = decryptPhiRow("advanceDirectivesTable", rows[0]);
        res.json({ directive });
      } catch (error) {
        console.error("[AdvanceDirectives] Get failed:", error);
        res.status(500).json({ error: "Failed to load advance directive" });
      }
    },
  );

  /**
   * Upsert the directive for the authenticated profile. One row per profile
   * (enforced by a unique index on profile_id). PHI fields are encrypted at
   * rest via encryptPhiRow before persisting.
   */
  const upsertHandler = async (req: Request, res: Response) => {
    try {
      const profileId = (req as any).resolvedProfileId as string;

      const parsed = upsertDirectiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid directive", details: parsed.error.flatten() });
      }
      const input = parsed.data;

      // Normalise treatment preferences so every key is present (yes/no/null).
      let treatmentPreferences: TreatmentPreferences | null = null;
      if (input.treatmentPreferences) {
        const normalized = {} as TreatmentPreferences;
        for (const key of TREATMENT_PREFERENCE_KEYS) {
          normalized[key] = input.treatmentPreferences[key] ?? null;
        }
        treatmentPreferences = normalized;
      }

      const values = {
        profileId,
        familyPrimaryGoalOfCare: input.familyPrimaryGoalOfCare ?? null,
        goalsOfCare: input.goalsOfCare ?? null,
        codeStatus: input.codeStatus ?? null,
        treatmentPreferences,
        updatedAt: new Date(),
      };

      const encrypted = encryptPhiRow("advanceDirectivesTable", values);

      const [row] = await phiDb
        .insert(advanceDirectivesTable)
        .values(encrypted)
        .onConflictDoUpdate({
          target: advanceDirectivesTable.profileId,
          set: {
            familyPrimaryGoalOfCare: encrypted.familyPrimaryGoalOfCare,
            goalsOfCare: encrypted.goalsOfCare,
            codeStatus: encrypted.codeStatus,
            treatmentPreferences: encrypted.treatmentPreferences,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      await logPhiAccess({
        userId: getSessionUserId(req)!,
        patientId: profileId,
        action: "write",
        resourceType: "advance_directive",
        resourceId: profileId,
        details: `Upserted advance directive for profile ${profileId}`,
      });

      const directive = decryptPhiRow("advanceDirectivesTable", row);
      res.json({ directive });
    } catch (error) {
      console.error("[AdvanceDirectives] Upsert failed:", error);
      res.status(500).json({ error: "Failed to save advance directive" });
    }
  };

  app.post("/api/advance-directives", isAuthenticated, requireProfile, upsertHandler);
  app.put("/api/advance-directives", isAuthenticated, requireProfile, upsertHandler);

  /**
   * List documents in the profile's "Advance Directives" folder.
   * Creates the folder on first access if it does not yet exist.
   */
  app.get(
    "/api/advance-directives/documents",
    isAuthenticated,
    requireProfile,
    async (req: Request, res: Response) => {
      try {
        const profileId = (req as any).resolvedProfileId as string;
        const folderId = await ensureAdvanceDirectivesFolder(profileId);

        const rows = await phiDb
          .select()
          .from(documentsTable)
          .where(
            and(
              eq(documentsTable.profileId, profileId),
              eq(documentsTable.folderId, folderId),
            ),
          )
          .orderBy(desc(documentsTable.createdAt));

        await logPhiAccess({
          userId: getSessionUserId(req)!,
          patientId: profileId,
          action: "read",
          resourceType: "advance_directive_document",
          resourceId: folderId,
          details: `Listed advance directive documents for profile ${profileId}`,
        });

        const documents = decryptPhiRows("documentsTable", rows).map((d) => ({
          id: d.id,
          title: d.title,
          mimeType: d.mimeType,
          objectKey: d.objectKey,
          source: d.source,
          dateOfService: d.dateOfService,
          createdAt: d.createdAt,
        }));

        res.json({ folderId, documents });
      } catch (error) {
        console.error("[AdvanceDirectives] List documents failed:", error);
        res.status(500).json({ error: "Failed to list advance directive documents" });
      }
    },
  );

  /**
   * Attach an already-uploaded object (from POST /api/uploads/request-url +
   * /api/uploads/finalize) to the profile's Advance Directives folder by
   * creating a documents row that links objectKey → folderId.
   */
  app.post(
    "/api/advance-directives/documents",
    isAuthenticated,
    requireProfile,
    async (req: Request, res: Response) => {
      try {
        const profileId = (req as any).resolvedProfileId as string;

        const parsed = attachDocumentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid document", details: parsed.error.flatten() });
        }
        const input = parsed.data;

        const folderId = await ensureAdvanceDirectivesFolder(profileId);

        const encrypted = encryptPhiRow("documentsTable", {
          profileId,
          folderId,
          title: input.title,
          source: input.source ?? "upload",
          dateOfService: input.dateOfService ?? null,
          mimeType: input.mimeType,
          objectKey: input.objectPath,
        });

        const [row] = await phiDb.insert(documentsTable).values(encrypted).returning();

        await logPhiAccess({
          userId: getSessionUserId(req)!,
          patientId: profileId,
          action: "write",
          resourceType: "advance_directive_document",
          resourceId: row.id,
          details: `Attached advance directive document ${row.id} to profile ${profileId}`,
        });

        const doc = decryptPhiRow("documentsTable", row);
        res.json({
          document: {
            id: doc.id,
            title: doc.title,
            mimeType: doc.mimeType,
            objectKey: doc.objectKey,
            source: doc.source,
            dateOfService: doc.dateOfService,
            createdAt: doc.createdAt,
          },
        });
      } catch (error) {
        console.error("[AdvanceDirectives] Attach document failed:", error);
        res.status(500).json({ error: "Failed to attach advance directive document" });
      }
    },
  );

  console.log("[Routes] Advance Directives routes registered at /api/advance-directives/*");
}
