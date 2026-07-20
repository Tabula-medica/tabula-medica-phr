import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db, unityQuotesTable, traditionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/quotes", async (req, res) => {
  const theme = req.query["theme"] as string | undefined;
  const baseQuery = db
    .select({
      id: unityQuotesTable.id,
      quote: unityQuotesTable.quote,
      attribution: unityQuotesTable.attribution,
      theme: unityQuotesTable.theme,
      traditionId: traditionsTable.id,
      traditionSlug: traditionsTable.slug,
      traditionName: traditionsTable.name,
      accentColor: traditionsTable.accentColor,
    })
    .from(unityQuotesTable)
    .innerJoin(
      traditionsTable,
      eq(traditionsTable.id, unityQuotesTable.traditionId),
    )
    .orderBy(asc(traditionsTable.name), asc(unityQuotesTable.id));
  const rows = theme ? await baseQuery.where(eq(unityQuotesTable.theme, theme)) : await baseQuery;
  res.json(rows);
});

router.get("/themes", async (_req, res) => {
  const rows = await db
    .select({ theme: unityQuotesTable.theme })
    .from(unityQuotesTable)
    .groupBy(unityQuotesTable.theme)
    .orderBy(sql`${unityQuotesTable.theme} asc`);
  res.json(rows.map((r) => r.theme));
});

export default router;
