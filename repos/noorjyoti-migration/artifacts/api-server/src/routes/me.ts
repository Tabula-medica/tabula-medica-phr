import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  bookmarksTable,
  favoritesTable,
  listeningHistoryTable,
  userPreferencesTable,
  chaptersTable,
  scripturesTable,
  traditionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getSynthQuotaSnapshot } from "../lib/synthQuota";
import { isAdminUser } from "../lib/admin";

const router: IRouter = Router();

router.use(requireAuth);

// ---------- Identity ----------

router.get("/", (req, res) => {
  res.json({ userId: req.userId! });
});

router.get("/admin", (req, res) => {
  res.json({ isAdmin: isAdminUser(req.userId) });
});

// ---------- Bookmarks ----------

router.get("/bookmarks", async (req, res) => {
  const userId = req.userId!;
  const rows = await db
    .select({
      id: bookmarksTable.id,
      chapterId: bookmarksTable.chapterId,
      chapterTitle: chaptersTable.title,
      chapterNumber: chaptersTable.number,
      scriptureId: scripturesTable.id,
      scriptureName: scripturesTable.name,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      positionSeconds: bookmarksTable.positionSeconds,
      note: bookmarksTable.note,
      createdAt: bookmarksTable.createdAt,
    })
    .from(bookmarksTable)
    .innerJoin(chaptersTable, eq(chaptersTable.id, bookmarksTable.chapterId))
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, chaptersTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(eq(bookmarksTable.userId, userId))
    .orderBy(desc(bookmarksTable.createdAt));
  res.json(
    rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  );
});

router.post("/bookmarks", async (req, res) => {
  const userId = req.userId!;
  const body = req.body as {
    chapterId?: number;
    positionSeconds?: number;
    note?: string;
  };
  const chapterId = Number(body.chapterId);
  if (!Number.isFinite(chapterId)) {
    res.status(400).json({ error: "chapterId is required" });
    return;
  }
  const chapterExists = await db
    .select({ id: chaptersTable.id })
    .from(chaptersTable)
    .where(eq(chaptersTable.id, chapterId))
    .limit(1);
  if (!chapterExists.length) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const inserted = await db
    .insert(bookmarksTable)
    .values({
      userId,
      chapterId,
      positionSeconds: Number(body.positionSeconds ?? 0),
      note: body.note ?? "",
    })
    .returning();
  const row = inserted[0]!;
  const enriched = await db
    .select({
      id: bookmarksTable.id,
      chapterId: bookmarksTable.chapterId,
      chapterTitle: chaptersTable.title,
      chapterNumber: chaptersTable.number,
      scriptureId: scripturesTable.id,
      scriptureName: scripturesTable.name,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      positionSeconds: bookmarksTable.positionSeconds,
      note: bookmarksTable.note,
      createdAt: bookmarksTable.createdAt,
    })
    .from(bookmarksTable)
    .innerJoin(chaptersTable, eq(chaptersTable.id, bookmarksTable.chapterId))
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, chaptersTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(eq(bookmarksTable.id, row.id));
  const out = enriched[0]!;
  res.status(201).json({ ...out, createdAt: out.createdAt.toISOString() });
});

router.delete("/bookmarks/:id", async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  const deleted = await db
    .delete(bookmarksTable)
    .where(and(eq(bookmarksTable.id, id), eq(bookmarksTable.userId, userId)))
    .returning();
  if (!deleted.length) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  res.status(204).end();
});

// ---------- Favorites ----------

router.get("/favorites", async (req, res) => {
  const userId = req.userId!;
  const rows = await db
    .select({
      scriptureId: favoritesTable.scriptureId,
      scriptureName: scripturesTable.name,
      scriptureSlug: scripturesTable.slug,
      originalName: scripturesTable.originalName,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      createdAt: favoritesTable.createdAt,
    })
    .from(favoritesTable)
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, favoritesTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(eq(favoritesTable.userId, userId))
    .orderBy(desc(favoritesTable.createdAt));
  res.json(
    rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  );
});

router.post("/favorites", async (req, res) => {
  const userId = req.userId!;
  const scriptureId = Number((req.body as { scriptureId?: number }).scriptureId);
  if (!Number.isFinite(scriptureId)) {
    res.status(400).json({ error: "scriptureId is required" });
    return;
  }
  const scriptureExists = await db
    .select({ id: scripturesTable.id })
    .from(scripturesTable)
    .where(eq(scripturesTable.id, scriptureId))
    .limit(1);
  if (!scriptureExists.length) {
    res.status(404).json({ error: "Scripture not found" });
    return;
  }
  await db
    .insert(favoritesTable)
    .values({ userId, scriptureId })
    .onConflictDoNothing();
  const enriched = await db
    .select({
      scriptureId: favoritesTable.scriptureId,
      scriptureName: scripturesTable.name,
      scriptureSlug: scripturesTable.slug,
      originalName: scripturesTable.originalName,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      createdAt: favoritesTable.createdAt,
    })
    .from(favoritesTable)
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, favoritesTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.scriptureId, scriptureId),
      ),
    );
  const out = enriched[0]!;
  res.status(201).json({ ...out, createdAt: out.createdAt.toISOString() });
});

router.delete("/favorites/:scriptureId", async (req, res) => {
  const userId = req.userId!;
  const scriptureId = Number(req.params.scriptureId);
  if (!Number.isFinite(scriptureId)) {
    res.status(404).json({ error: "Favorite not found" });
    return;
  }
  await db
    .delete(favoritesTable)
    .where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.scriptureId, scriptureId),
      ),
    );
  res.status(204).end();
});

// ---------- History ----------

async function selectHistoryRows(userId: string, limit: number | null) {
  const baseQuery = db
    .select({
      chapterId: listeningHistoryTable.chapterId,
      chapterTitle: chaptersTable.title,
      chapterNumber: chaptersTable.number,
      scriptureId: scripturesTable.id,
      scriptureName: scripturesTable.name,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      positionSeconds: listeningHistoryTable.positionSeconds,
      completed: listeningHistoryTable.completed,
      lastPlayedAt: listeningHistoryTable.lastPlayedAt,
    })
    .from(listeningHistoryTable)
    .innerJoin(
      chaptersTable,
      eq(chaptersTable.id, listeningHistoryTable.chapterId),
    )
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, chaptersTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(eq(listeningHistoryTable.userId, userId))
    .orderBy(desc(listeningHistoryTable.lastPlayedAt));
  if (limit !== null) {
    return baseQuery.limit(limit);
  }
  return baseQuery;
}

function shapeHistory(rows: Awaited<ReturnType<typeof selectHistoryRows>>) {
  return rows.map((r) => ({
    chapterId: r.chapterId,
    chapterTitle: r.chapterTitle,
    chapterNumber: r.chapterNumber,
    scriptureId: r.scriptureId,
    scriptureName: r.scriptureName,
    traditionId: r.traditionId,
    traditionName: r.traditionName,
    traditionSlug: r.traditionSlug,
    accentColor: r.accentColor,
    positionSeconds: r.positionSeconds,
    completed: r.completed > 0,
    lastPlayedAt: r.lastPlayedAt.toISOString(),
  }));
}

router.get("/history", async (req, res) => {
  const userId = req.userId!;
  const rows = await selectHistoryRows(userId, null);
  res.json(shapeHistory(rows));
});

router.post("/history", async (req, res) => {
  const userId = req.userId!;
  const body = req.body as {
    chapterId?: number;
    positionSeconds?: number;
    completed?: boolean;
  };
  const chapterId = Number(body.chapterId);
  if (!Number.isFinite(chapterId)) {
    res.status(400).json({ error: "chapterId is required" });
    return;
  }
  const historyChapterExists = await db
    .select({ id: chaptersTable.id })
    .from(chaptersTable)
    .where(eq(chaptersTable.id, chapterId))
    .limit(1);
  if (!historyChapterExists.length) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const positionSeconds = Number(body.positionSeconds ?? 0);
  const completed = body.completed ? 1 : 0;
  await db
    .insert(listeningHistoryTable)
    .values({
      userId,
      chapterId,
      positionSeconds,
      completed,
      lastPlayedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [listeningHistoryTable.userId, listeningHistoryTable.chapterId],
      set: {
        positionSeconds,
        completed,
        lastPlayedAt: new Date(),
      },
    });
  const enriched = await selectHistoryRows(userId, null);
  const item = enriched.find((r) => r.chapterId === chapterId);
  if (!item) {
    res.status(500).json({ error: "Failed to upsert history" });
    return;
  }
  res.json(shapeHistory([item])[0]);
});

// ---------- Preferences ----------

router.get("/preferences", async (req, res) => {
  const userId = req.userId!;
  const row = await db.query.userPreferencesTable.findFirst({
    where: eq(userPreferencesTable.userId, userId),
  });
  if (!row) {
    res.json({ defaultLanguage: "en", defaultVoice: "female_warm" });
    return;
  }
  res.json({
    defaultLanguage: row.defaultLanguage,
    defaultVoice: row.defaultVoice,
  });
});

router.put("/preferences", async (req, res) => {
  const userId = req.userId!;
  const body = req.body as {
    defaultLanguage?: string;
    defaultVoice?: string;
  };
  const existing = await db.query.userPreferencesTable.findFirst({
    where: eq(userPreferencesTable.userId, userId),
  });
  const next = {
    defaultLanguage: body.defaultLanguage ?? existing?.defaultLanguage ?? "en",
    defaultVoice: body.defaultVoice ?? existing?.defaultVoice ?? "female_warm",
  };
  await db
    .insert(userPreferencesTable)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: { ...next, updatedAt: new Date() },
    });
  res.json(next);
});

// ---------- Synthesis quota ----------

router.get("/quota", async (req, res) => {
  const userId = req.userId!;
  const snap = await getSynthQuotaSnapshot(userId);
  res.json({
    limitPerDay: snap.limitPerDay,
    limitPerMinute: snap.limitPerMinute,
    remainingDay: snap.remainingDay,
    remainingMinute: snap.remainingMinute,
    resetDaySeconds: snap.resetDaySeconds,
  });
});

// ---------- Dashboard ----------

router.get("/dashboard", async (req, res) => {
  const userId = req.userId!;
  const recentHistoryRows = await selectHistoryRows(userId, 5);
  const recentHistory = shapeHistory(recentHistoryRows);

  const recentBookmarks = await db
    .select({
      id: bookmarksTable.id,
      chapterId: bookmarksTable.chapterId,
      chapterTitle: chaptersTable.title,
      chapterNumber: chaptersTable.number,
      scriptureId: scripturesTable.id,
      scriptureName: scripturesTable.name,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
      positionSeconds: bookmarksTable.positionSeconds,
      note: bookmarksTable.note,
      createdAt: bookmarksTable.createdAt,
    })
    .from(bookmarksTable)
    .innerJoin(chaptersTable, eq(chaptersTable.id, bookmarksTable.chapterId))
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, chaptersTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .where(eq(bookmarksTable.userId, userId))
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(5);

  const favCountRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, userId));
  const favoriteCount = favCountRow[0]?.count ?? 0;

  const startedRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listeningHistoryTable)
    .where(eq(listeningHistoryTable.userId, userId));
  const chaptersStarted = startedRow[0]?.count ?? 0;

  const completedRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listeningHistoryTable)
    .where(
      and(
        eq(listeningHistoryTable.userId, userId),
        sql`${listeningHistoryTable.completed} > 0`,
      ),
    );
  const chaptersCompleted = completedRow[0]?.count ?? 0;

  // suggestedNext: a chapter the user has not heard yet (any tradition, alphabetical
  // by tradition then sortOrder), or fallback to the very first chapter.
  const heardRow = await db
    .select({ chapterId: listeningHistoryTable.chapterId })
    .from(listeningHistoryTable)
    .where(eq(listeningHistoryTable.userId, userId));
  const heardSet = new Set(heardRow.map((r) => r.chapterId));

  const allChapters = await db
    .select({
      id: chaptersTable.id,
      number: chaptersTable.number,
      title: chaptersTable.title,
      summary: chaptersTable.summary,
      passageEn: chaptersTable.passageEn,
      estimatedReadSeconds: chaptersTable.estimatedReadSeconds,
      scriptureId: scripturesTable.id,
      scriptureName: scripturesTable.name,
      scriptureSlug: scripturesTable.slug,
      traditionId: traditionsTable.id,
      traditionName: traditionsTable.name,
      traditionSlug: traditionsTable.slug,
      accentColor: traditionsTable.accentColor,
    })
    .from(chaptersTable)
    .innerJoin(
      scripturesTable,
      eq(scripturesTable.id, chaptersTable.scriptureId),
    )
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, scripturesTable.traditionId),
    )
    .orderBy(
      sql`${traditionsTable.name} asc`,
      sql`${scripturesTable.sortOrder} asc`,
      sql`${chaptersTable.sortOrder} asc`,
    );

  const suggestedNext =
    allChapters.find((c) => !heardSet.has(c.id)) ?? allChapters[0] ?? null;

  res.json({
    recentHistory,
    recentBookmarks: recentBookmarks.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    favoriteCount,
    chaptersStarted,
    chaptersCompleted,
    suggestedNext,
  });
});

export default router;
