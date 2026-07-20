import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  chaptersTable,
  scripturesTable,
  traditionsTable,
} from "@workspace/db";
import { getAuth } from "firebase-admin/auth";
import { isAdminUser } from "../lib/admin";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

const requireAdmin: import("express").RequestHandler = (req, res, next) => {
  if (!isAdminUser(req.userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

router.use(requireAdmin);

// ---------- Content: scriptures ----------

router.get("/scriptures", async (_req, res) => {
  const rows = await db
    .select({
      id: scripturesTable.id,
      name: scripturesTable.name,
      originalName: scripturesTable.originalName,
      description: scripturesTable.description,
      era: scripturesTable.era,
      traditionId: scripturesTable.traditionId,
      traditionName: traditionsTable.name,
      sortOrder: scripturesTable.sortOrder,
    })
    .from(scripturesTable)
    .innerJoin(traditionsTable, eq(traditionsTable.id, scripturesTable.traditionId))
    .orderBy(asc(traditionsTable.name), asc(scripturesTable.sortOrder));
  res.json(rows);
});

router.patch("/scriptures/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid scripture id" });
    return;
  }
  const { name, originalName, description, era } = req.body as {
    name?: string;
    originalName?: string;
    description?: string;
    era?: string;
  };
  const patch: Partial<typeof scripturesTable.$inferInsert> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (originalName !== undefined) patch.originalName = String(originalName).trim();
  if (description !== undefined) patch.description = String(description).trim();
  if (era !== undefined) patch.era = String(era).trim();
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const updated = await db
    .update(scripturesTable)
    .set(patch)
    .where(eq(scripturesTable.id, id))
    .returning();
  if (!updated.length) {
    res.status(404).json({ error: "Scripture not found" });
    return;
  }
  res.json(updated[0]);
});

// ---------- Content: chapters ----------

router.get("/scriptures/:scriptureId/chapters", async (req, res) => {
  const scriptureId = Number(req.params.scriptureId);
  if (!Number.isFinite(scriptureId)) {
    res.status(400).json({ error: "Invalid scripture id" });
    return;
  }
  const rows = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.scriptureId, scriptureId))
    .orderBy(asc(chaptersTable.sortOrder));
  res.json(rows);
});

router.get("/chapters/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid chapter id" });
    return;
  }
  const chapter = await db.query.chaptersTable.findFirst({
    where: eq(chaptersTable.id, id),
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  res.json(chapter);
});

router.patch("/chapters/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid chapter id" });
    return;
  }
  const { title, summary, passageEn, estimatedReadSeconds } = req.body as {
    title?: string;
    summary?: string;
    passageEn?: string;
    estimatedReadSeconds?: number;
  };
  const patch: Partial<typeof chaptersTable.$inferInsert> = {};
  if (title !== undefined) patch.title = String(title).trim();
  if (summary !== undefined) patch.summary = String(summary).trim();
  if (passageEn !== undefined) {
    const text = String(passageEn).trim();
    if (text.length === 0) {
      res.status(400).json({ error: "passageEn cannot be empty" });
      return;
    }
    patch.passageEn = text;
    if (estimatedReadSeconds === undefined) {
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      patch.estimatedReadSeconds = Math.max(10, Math.round((wordCount / 130) * 60));
    }
  }
  if (estimatedReadSeconds !== undefined) {
    patch.estimatedReadSeconds = Math.max(1, Number(estimatedReadSeconds));
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const updated = await db
    .update(chaptersTable)
    .set(patch)
    .where(eq(chaptersTable.id, id))
    .returning();
  if (!updated.length) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  res.json(updated[0]);
});

// ---------- Users (GCIP / Firebase Auth) ----------

router.get("/users", async (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query["limit"] ?? 50)));
  const pageToken = (req.query["pageToken"] as string | undefined) || undefined;
  const adminIds = new Set(
    (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const result = await getAuth().listUsers(limit, pageToken);
  res.json({
    pageToken: result.pageToken ?? null,
    users: result.users.map((u) => ({
      id: u.uid,
      email: u.email ?? "",
      firstName: u.displayName ?? null,
      lastName: null,
      imageUrl: u.photoURL ?? "",
      createdAt: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
      lastSignInAt: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
      banned: u.disabled,
      twoFactorEnabled: (u.multiFactor?.enrolledFactors?.length ?? 0) > 0,
      isAdmin: adminIds.has(u.uid),
    })),
  });
});

router.post("/users/:userId/ban", async (req, res) => {
  const { userId } = req.params;
  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot ban yourself" });
    return;
  }
  await getAuth().updateUser(userId, { disabled: true });
  res.json({ success: true });
});

router.post("/users/:userId/unban", async (req, res) => {
  await getAuth().updateUser(req.params.userId, { disabled: false });
  res.json({ success: true });
});

export default router;
