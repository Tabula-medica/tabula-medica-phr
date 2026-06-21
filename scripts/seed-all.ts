import { db, closeDb } from "../src/db/db";
import { sql } from "drizzle-orm";
import { folders, tags } from "../shared/schema";

type FolderSeed = {
  key: string;
  name: string;
  sortOrder: number;
  parentKey?: string;
};

type TagSeed = {
  key: string;
  label: string;
  category: string;
  sortOrder: number;
};

const DEFAULT_FOLDERS: FolderSeed[] = [
  { key: "labs", name: "Labs", sortOrder: 10 },
  { key: "imaging", name: "Imaging", sortOrder: 20 },
  { key: "visits", name: "Visits", sortOrder: 30 },
  { key: "meds", name: "Medications", sortOrder: 40 },
  { key: "vaccines", name: "Vaccines", sortOrder: 50 },
  { key: "allergies", name: "Allergies", sortOrder: 60 },
  { key: "procedures", name: "Procedures", sortOrder: 70 },
  { key: "conditions", name: "Conditions", sortOrder: 80 },
  { key: "care-team", name: "Care Team", sortOrder: 90 },
  { key: "insurance", name: "Insurance", sortOrder: 100 },
  { key: "documents", name: "Documents", sortOrder: 110 },
  { key: "imaging-reports", name: "Reports", sortOrder: 21, parentKey: "imaging" },
  { key: "imaging-images", name: "Images", sortOrder: 22, parentKey: "imaging" },
  { key: "labs-blood", name: "Bloodwork", sortOrder: 11, parentKey: "labs" },
  { key: "labs-path", name: "Pathology", sortOrder: 12, parentKey: "labs" },
];

const GLOBAL_TAGS: TagSeed[] = [
  { key: "tag-lab", label: "Lab", category: "type", sortOrder: 10 },
  { key: "tag-imaging", label: "Imaging", category: "type", sortOrder: 20 },
  { key: "tag-visit", label: "Visit", category: "type", sortOrder: 30 },
  { key: "tag-med", label: "Medication", category: "type", sortOrder: 40 },
  { key: "tag-vaccine", label: "Vaccine", category: "type", sortOrder: 50 },
  { key: "tag-procedure", label: "Procedure", category: "type", sortOrder: 60 },
  { key: "tag-document", label: "Document", category: "type", sortOrder: 70 },
  { key: "tag-pending", label: "Pending", category: "status", sortOrder: 10 },
  { key: "tag-reviewed", label: "Reviewed", category: "status", sortOrder: 20 },
  { key: "tag-follow-up", label: "Follow-up needed", category: "status", sortOrder: 30 },
  { key: "tag-critical", label: "Critical / urgent", category: "triage", sortOrder: 10 },
  { key: "tag-side-effects", label: "Side effects", category: "care", sortOrder: 20 },
  { key: "tag-adherence", label: "Adherence", category: "care", sortOrder: 30 },
  { key: "tag-referral", label: "Referral", category: "workflow", sortOrder: 10 },
  { key: "tag-prior-auth", label: "Prior auth", category: "workflow", sortOrder: 20 },
  { key: "tag-appeal", label: "Appeal", category: "workflow", sortOrder: 30 },
];

async function seedFolders(): Promise<void> {
  const existing = await db
    .select({ id: folders.id, key: folders.key })
    .from(folders);

  const keyToId = new Map(existing.map((r) => [r.key, r.id]));

  const parents = DEFAULT_FOLDERS.filter((f) => !f.parentKey);
  const children = DEFAULT_FOLDERS.filter((f) => !!f.parentKey);

  if (parents.length) {
    await db.execute(sql`
      INSERT INTO ${folders} (key, name, sort_order, is_system)
      VALUES ${sql.join(
        parents.map((f) => sql`(${f.key}, ${f.name}, ${f.sortOrder}, true)`),
        sql`,`
      )}
      ON CONFLICT (key) DO UPDATE
      SET name = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order
    `);
  }

  const afterParents = await db
    .select({ id: folders.id, key: folders.key })
    .from(folders);
  afterParents.forEach((r) => keyToId.set(r.key, r.id));

  for (const f of children) {
    const parentId = keyToId.get(f.parentKey!);
    if (!parentId) throw new Error(`Parent folder key not found: ${f.parentKey} for child ${f.key}`);

    await db.execute(sql`
      INSERT INTO ${folders} (key, name, sort_order, is_system, parent_id)
      VALUES (${f.key}, ${f.name}, ${f.sortOrder}, true, ${parentId})
      ON CONFLICT (key) DO UPDATE
      SET name = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order,
          parent_id = EXCLUDED.parent_id
    `);
  }
}

async function seedTags(): Promise<void> {
  if (!GLOBAL_TAGS.length) return;

  await db.execute(sql`
    INSERT INTO ${tags} (key, label, category, sort_order, is_system)
    VALUES ${sql.join(
      GLOBAL_TAGS.map((t) => sql`(${t.key}, ${t.label}, ${t.category}, ${t.sortOrder}, true)`),
      sql`,`
    )}
    ON CONFLICT (key) DO UPDATE
    SET label = EXCLUDED.label,
        category = EXCLUDED.category,
        sort_order = EXCLUDED.sort_order
  `);
}

async function main(): Promise<void> {
  try {
    await db.transaction(async () => {
      await seedFolders();
      await seedTags();
    });

    console.log("Seed complete: default folders + global tags");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
