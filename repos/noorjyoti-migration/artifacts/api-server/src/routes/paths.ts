import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, thematicPathsTable, thematicPathItemsTable } from "@workspace/db";

const router: IRouter = Router();

// List all thematic paths with a verse count and the distinct traditions
// represented, so the client can render summary cards ("Choose Your Path").
router.get("/", async (_req, res) => {
  const paths = await db
    .select()
    .from(thematicPathsTable)
    .orderBy(asc(thematicPathsTable.sortOrder));

  const items = await db
    .select({
      pathId: thematicPathItemsTable.pathId,
      traditionLabel: thematicPathItemsTable.traditionLabel,
    })
    .from(thematicPathItemsTable)
    .orderBy(asc(thematicPathItemsTable.sortOrder));

  const byPath = new Map<number, { verseCount: number; traditions: string[] }>();
  for (const it of items) {
    const entry = byPath.get(it.pathId) ?? { verseCount: 0, traditions: [] };
    entry.verseCount += 1;
    if (!entry.traditions.includes(it.traditionLabel)) {
      entry.traditions.push(it.traditionLabel);
    }
    byPath.set(it.pathId, entry);
  }

  res.json(
    paths.map((p) => {
      const agg = byPath.get(p.id) ?? { verseCount: 0, traditions: [] };
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        accentColor: p.accentColor,
        verseCount: agg.verseCount,
        traditions: agg.traditions,
      };
    }),
  );
});

// A single thematic path with its ordered verses.
router.get("/:slug", async (req, res) => {
  const path = await db.query.thematicPathsTable.findFirst({
    where: eq(thematicPathsTable.slug, req.params.slug),
  });
  if (!path) {
    res.status(404).json({ error: "Path not found" });
    return;
  }
  const items = await db
    .select({
      id: thematicPathItemsTable.id,
      verseText: thematicPathItemsTable.verseText,
      reference: thematicPathItemsTable.reference,
      traditionLabel: thematicPathItemsTable.traditionLabel,
    })
    .from(thematicPathItemsTable)
    .where(eq(thematicPathItemsTable.pathId, path.id))
    .orderBy(asc(thematicPathItemsTable.sortOrder));

  res.json({
    id: path.id,
    slug: path.slug,
    title: path.title,
    subtitle: path.subtitle,
    accentColor: path.accentColor,
    verses: items,
  });
});

export default router;
