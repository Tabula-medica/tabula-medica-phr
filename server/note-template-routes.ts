/**
 * Note template library — complaint-specific charting templates.
 *
 * A shared library any clinician can browse and publish to, plus each
 * clinician's own personal set for quick charting: import (copy) a library
 * template, or write one from scratch, then use it — fill in the
 * `{{placeholder}}` tokens and the finished text is ready to paste into a
 * note.
 *
 * Importing copies the template body into the clinician's own row rather
 * than referencing the library entry live, on purpose: a clinician's edits
 * after importing must never change the shared original, and a later edit
 * to the library entry must never silently change a template someone has
 * already imported and is charting from. `sourceLibraryTemplateId` just
 * records where it came from.
 *
 * ## Authorization
 *
 * `requireClinicStaff` — proves the caller is clinic staff, nothing more.
 * That is the right and sufficient boundary here (unlike
 * outpatient-orders-routes.ts and clinician-history-routes.ts, which act on
 * a specific patient's chart): nothing on either table references a
 * patient, so there is no other patient's record being opened. See
 * server/lib/middleware/require-clinic-staff.ts's own docblock, which draws
 * this exact distinction.
 *
 * Personal templates ("mine") are additionally scoped by
 * `clinicianUserId = <the caller's own session id>` in every query — a real,
 * fully enforced ownership check, since the owner is always the caller
 * rather than an id the client could supply.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import {
  noteTemplateLibraryTable,
  clinicianNoteTemplatesTable,
  insertNoteTemplateLibrarySchema,
  insertClinicianNoteTemplateSchema,
} from "@shared/schema";
import { db } from "./db";
import { requireClinicStaff, callerFrom } from "./lib/middleware/require-clinic-staff";
import { noStorePhi } from "./lib/middleware/no-store-phi";

function callerUserId(req: Request): string {
  const caller = callerFrom(req);
  return caller.userId || "unknown";
}

function callerName(req: Request): string | null {
  const user = req.user as any;
  return user?.claims?.name || user?.name || null;
}

const patchMineSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyTemplate: z.string().min(1).max(20000).optional(),
  chiefComplaint: z.string().min(1).max(200).optional(),
  noteType: z.enum(["soap", "hpi", "full_note", "procedure_note", "discharge"]).optional(),
  placeholderHints: z.array(z.object({ token: z.string(), label: z.string(), example: z.string().optional() })).optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  favorited: z.boolean().optional(),
  markUsed: z.boolean().optional(),
});

export function registerNoteTemplateRoutes(app: Express): void {
  app.use("/api/note-templates", noStorePhi);

  // ─── Shared library ─────────────────────────────────────────────────────
  app.get("/api/note-templates/library", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const { chiefComplaint, specialty, q } = req.query as Record<string, string | undefined>;

      const conditions = [eq(noteTemplateLibraryTable.isPublished, true)];
      if (chiefComplaint) conditions.push(ilike(noteTemplateLibraryTable.chiefComplaint, `%${chiefComplaint}%`));
      if (specialty) conditions.push(eq(noteTemplateLibraryTable.specialty, specialty));
      if (q) {
        conditions.push(
          or(
            ilike(noteTemplateLibraryTable.title, `%${q}%`),
            ilike(noteTemplateLibraryTable.chiefComplaint, `%${q}%`),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(noteTemplateLibraryTable)
        .where(and(...conditions))
        .orderBy(desc(noteTemplateLibraryTable.importCount), desc(noteTemplateLibraryTable.createdAt));

      res.json({ templates: rows });
    } catch (error) {
      console.error("[note-templates:library] list error:", error);
      res.status(500).json({ error: "Failed to load template library" });
    }
  });

  app.post("/api/note-templates/library", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const parsed = insertNoteTemplateLibrarySchema
        .omit({ createdByUserId: true, createdByName: true })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid template", details: parsed.error.flatten() });

      const [row] = await db
        .insert(noteTemplateLibraryTable)
        .values({ ...parsed.data, createdByUserId: callerUserId(req), createdByName: callerName(req) })
        .returning();

      res.status(201).json({ template: row });
    } catch (error) {
      console.error("[note-templates:library] create error:", error);
      res.status(500).json({ error: "Failed to publish template" });
    }
  });

  // Import copies the library template's text into a new personal row.
  app.post("/api/note-templates/library/:id/import", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const [source] = await db.select().from(noteTemplateLibraryTable).where(eq(noteTemplateLibraryTable.id, req.params.id)).limit(1);
      if (!source) return res.status(404).json({ error: "Template not found" });

      const [copy] = await db
        .insert(clinicianNoteTemplatesTable)
        .values({
          clinicianUserId: callerUserId(req),
          sourceLibraryTemplateId: source.id,
          chiefComplaint: source.chiefComplaint,
          title: source.title,
          noteType: source.noteType,
          bodyTemplate: source.bodyTemplate,
          placeholderHints: source.placeholderHints,
          tags: source.tags,
        })
        .returning();

      await db
        .update(noteTemplateLibraryTable)
        .set({ importCount: sql`${noteTemplateLibraryTable.importCount} + 1` })
        .where(eq(noteTemplateLibraryTable.id, source.id));

      res.status(201).json({ template: copy });
    } catch (error) {
      console.error("[note-templates:import] error:", error);
      res.status(500).json({ error: "Failed to import template" });
    }
  });

  // ─── Personal templates ("mine") ───────────────────────────────────────
  app.get("/api/note-templates/mine", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const { chiefComplaint } = req.query as Record<string, string | undefined>;
      const conditions = [eq(clinicianNoteTemplatesTable.clinicianUserId, callerUserId(req))];
      if (chiefComplaint) conditions.push(ilike(clinicianNoteTemplatesTable.chiefComplaint, `%${chiefComplaint}%`));

      const rows = await db
        .select()
        .from(clinicianNoteTemplatesTable)
        .where(and(...conditions))
        .orderBy(desc(clinicianNoteTemplatesTable.favorited), desc(clinicianNoteTemplatesTable.lastUsedAt), desc(clinicianNoteTemplatesTable.createdAt));

      res.json({ templates: rows });
    } catch (error) {
      console.error("[note-templates:mine] list error:", error);
      res.status(500).json({ error: "Failed to load your templates" });
    }
  });

  app.post("/api/note-templates/mine", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const parsed = insertClinicianNoteTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid template", details: parsed.error.flatten() });

      const [row] = await db
        .insert(clinicianNoteTemplatesTable)
        .values({ ...parsed.data, clinicianUserId: callerUserId(req) })
        .returning();

      res.status(201).json({ template: row });
    } catch (error) {
      console.error("[note-templates:mine] create error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/note-templates/mine/:id", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const ownerId = callerUserId(req);
      const [existing] = await db
        .select()
        .from(clinicianNoteTemplatesTable)
        .where(and(eq(clinicianNoteTemplatesTable.id, req.params.id), eq(clinicianNoteTemplatesTable.clinicianUserId, ownerId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Template not found" });

      const parsed = patchMineSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });

      const { markUsed, ...fields } = parsed.data;
      const patch: Record<string, unknown> = { ...fields, updatedAt: new Date() };
      if (markUsed) {
        patch.lastUsedAt = new Date();
        patch.usageCount = existing.usageCount + 1;
      }

      const [updated] = await db
        .update(clinicianNoteTemplatesTable)
        .set(patch)
        .where(eq(clinicianNoteTemplatesTable.id, req.params.id))
        .returning();

      res.json({ template: updated });
    } catch (error) {
      console.error("[note-templates:mine] update error:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/note-templates/mine/:id", requireClinicStaff("Note template library"), async (req: Request, res: Response) => {
    try {
      const ownerId = callerUserId(req);
      const deleted = await db
        .delete(clinicianNoteTemplatesTable)
        .where(and(eq(clinicianNoteTemplatesTable.id, req.params.id), eq(clinicianNoteTemplatesTable.clinicianUserId, ownerId)))
        .returning({ id: clinicianNoteTemplatesTable.id });

      if (deleted.length === 0) return res.status(404).json({ error: "Template not found" });
      res.status(204).end();
    } catch (error) {
      console.error("[note-templates:mine] delete error:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });
}
