import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  db,
  traditionsTable,
  scripturesTable,
  chaptersTable,
  chapterTranslationsTable,
} from "@workspace/db";
import { LANGUAGES, VOICES } from "../lib/voices";

const router: IRouter = Router();

router.get("/traditions", async (_req, res) => {
  const rows = await db
    .select({
      id: traditionsTable.id,
      slug: traditionsTable.slug,
      name: traditionsTable.name,
      shortDescription: traditionsTable.shortDescription,
      region: traditionsTable.region,
      founded: traditionsTable.founded,
      accentColor: traditionsTable.accentColor,
      symbolName: traditionsTable.symbolName,
      scriptureCount: sql<number>`coalesce(count(${scripturesTable.id}), 0)::int`,
    })
    .from(traditionsTable)
    .leftJoin(scripturesTable, eq(scripturesTable.traditionId, traditionsTable.id))
    .groupBy(traditionsTable.id)
    .orderBy(asc(traditionsTable.name));
  res.json(rows);
});

router.get("/traditions/:slug", async (req, res) => {
  const tradition = await db.query.traditionsTable.findFirst({
    where: eq(traditionsTable.slug, req.params.slug),
  });
  if (!tradition) {
    res.status(404).json({ error: "Tradition not found" });
    return;
  }
  const scriptures = await db
    .select({
      id: scripturesTable.id,
      slug: scripturesTable.slug,
      name: scripturesTable.name,
      originalName: scripturesTable.originalName,
      description: scripturesTable.description,
      era: scripturesTable.era,
      traditionId: scripturesTable.traditionId,
      chapterCount: sql<number>`coalesce(count(${chaptersTable.id}), 0)::int`,
    })
    .from(scripturesTable)
    .leftJoin(chaptersTable, eq(chaptersTable.scriptureId, scripturesTable.id))
    .where(eq(scripturesTable.traditionId, tradition.id))
    .groupBy(scripturesTable.id)
    .orderBy(asc(scripturesTable.name));

  res.json({
    ...tradition,
    scriptures: scriptures.map((s) => ({
      ...s,
      traditionSlug: tradition.slug,
      traditionName: tradition.name,
      accentColor: tradition.accentColor,
    })),
  });
});

router.get("/scriptures", async (req, res) => {
  const traditionSlug = req.query["traditionSlug"] as string | undefined;
  const baseQuery = db
    .select({
      id: scripturesTable.id,
      slug: scripturesTable.slug,
      name: scripturesTable.name,
      originalName: scripturesTable.originalName,
      description: scripturesTable.description,
      era: scripturesTable.era,
      traditionId: traditionsTable.id,
      traditionSlug: traditionsTable.slug,
      traditionName: traditionsTable.name,
      accentColor: traditionsTable.accentColor,
      chapterCount: sql<number>`coalesce(count(${chaptersTable.id}), 0)::int`,
    })
    .from(scripturesTable)
    .innerJoin(traditionsTable, eq(traditionsTable.id, scripturesTable.traditionId))
    .leftJoin(chaptersTable, eq(chaptersTable.scriptureId, scripturesTable.id))
    .groupBy(scripturesTable.id, traditionsTable.id)
    .orderBy(asc(scripturesTable.name));

  const rows = traditionSlug
    ? await baseQuery.where(eq(traditionsTable.slug, traditionSlug))
    : await baseQuery;
  res.json(rows);
});

router.get("/scriptures/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Scripture not found" });
    return;
  }
  const scripture = await db.query.scripturesTable.findFirst({
    where: eq(scripturesTable.id, id),
  });
  if (!scripture) {
    res.status(404).json({ error: "Scripture not found" });
    return;
  }
  const tradition = await db.query.traditionsTable.findFirst({
    where: eq(traditionsTable.id, scripture.traditionId),
  });
  if (!tradition) {
    res.status(404).json({ error: "Tradition not found" });
    return;
  }
  const chapters = await db
    .select({
      id: chaptersTable.id,
      number: chaptersTable.number,
      title: chaptersTable.title,
      summary: chaptersTable.summary,
      estimatedReadSeconds: chaptersTable.estimatedReadSeconds,
    })
    .from(chaptersTable)
    .where(eq(chaptersTable.scriptureId, scripture.id))
    .orderBy(asc(chaptersTable.sortOrder));
  res.json({
    ...scripture,
    traditionSlug: tradition.slug,
    traditionName: tradition.name,
    accentColor: tradition.accentColor,
    chapters,
  });
});

router.get("/chapters/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const chapter = await db.query.chaptersTable.findFirst({
    where: eq(chaptersTable.id, id),
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const scripture = await db.query.scripturesTable.findFirst({
    where: eq(scripturesTable.id, chapter.scriptureId),
  });
  if (!scripture) {
    res.status(404).json({ error: "Scripture not found" });
    return;
  }
  const tradition = await db.query.traditionsTable.findFirst({
    where: eq(traditionsTable.id, scripture.traditionId),
  });
  if (!tradition) {
    res.status(404).json({ error: "Tradition not found" });
    return;
  }

  res.json({
    id: chapter.id,
    number: chapter.number,
    title: chapter.title,
    summary: chapter.summary,
    passageEn: chapter.passageEn,
    estimatedReadSeconds: chapter.estimatedReadSeconds,
    scriptureId: scripture.id,
    scriptureName: scripture.name,
    scriptureSlug: scripture.slug,
    traditionId: tradition.id,
    traditionName: tradition.name,
    traditionSlug: tradition.slug,
    accentColor: tradition.accentColor,
  });
});

// Return a stored translation of a chapter passage, when one exists. Lets
// clients display the passage in the selected language without re-running the
// (paid) translation model — populated lazily by the synthesize route.
router.get("/chapters/:id/translation/:lang", async (req, res) => {
  const id = Number(req.params.id);
  const lang = req.params.lang.trim();
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const translation = await db.query.chapterTranslationsTable.findFirst({
    where: and(
      eq(chapterTranslationsTable.chapterId, id),
      eq(chapterTranslationsTable.languageCode, lang),
    ),
  });
  if (!translation) {
    res.status(404).json({ error: "No translation available" });
    return;
  }
  res.json({
    chapterId: translation.chapterId,
    languageCode: translation.languageCode,
    translatedPassage: translation.translatedPassage,
  });
});

router.get("/languages", (_req, res) => {
  res.json(LANGUAGES);
});

router.get("/voices", (_req, res) => {
  res.json(
    VOICES.map((v) => ({
      id: v.id,
      label: v.label,
      gender: v.gender,
      character: v.character,
    })),
  );
});

router.get("/featured", async (_req, res) => {
  // One featured chapter per tradition: the first chapter of the first scripture.
  const traditions = await db
    .select()
    .from(traditionsTable)
    .orderBy(asc(traditionsTable.name));
  const items: Array<{
    chapterId: number;
    chapterTitle: string;
    chapterNumber: number;
    scriptureId: number;
    scriptureName: string;
    traditionId: number;
    traditionSlug: string;
    traditionName: string;
    accentColor: string;
    tagline: string;
  }> = [];
  for (const tradition of traditions) {
    const scripture = await db.query.scripturesTable.findFirst({
      where: eq(scripturesTable.traditionId, tradition.id),
      orderBy: [asc(scripturesTable.sortOrder)],
    });
    if (!scripture) continue;
    const chapter = await db.query.chaptersTable.findFirst({
      where: eq(chaptersTable.scriptureId, scripture.id),
      orderBy: [asc(chaptersTable.sortOrder)],
    });
    if (!chapter) continue;
    items.push({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      scriptureId: scripture.id,
      scriptureName: scripture.name,
      traditionId: tradition.id,
      traditionSlug: tradition.slug,
      traditionName: tradition.name,
      accentColor: tradition.accentColor,
      tagline: chapter.summary,
    });
  }
  res.json(items);
});

export default router;
