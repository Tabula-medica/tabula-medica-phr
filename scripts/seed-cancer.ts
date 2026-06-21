import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";

import { folders, tags } from "../drizzle/schema";

type TagSeed = { namespace: string; value: string; displayName: string };

const CANCER_TAGS: TagSeed[] = [
  { namespace: "track", value: "cancer", displayName: "Cancer Track" },

  { namespace: "doc", value: "pathology", displayName: "Pathology" },
  { namespace: "doc", value: "imaging", displayName: "Imaging" },
  { namespace: "doc", value: "oncology_note", displayName: "Oncology Note" },
  { namespace: "doc", value: "lab", displayName: "Lab" },
  { namespace: "doc", value: "chemo_order", displayName: "Chemo Order" },
  { namespace: "doc", value: "infusion_summary", displayName: "Infusion Summary" },
  { namespace: "doc", value: "radiation_summary", displayName: "Radiation Summary" },
  { namespace: "doc", value: "surgery_op_note", displayName: "Surgery Op Note" },
  { namespace: "doc", value: "survivorship_plan", displayName: "Survivorship Plan" },

  { namespace: "phase", value: "diagnosis", displayName: "Diagnosis" },
  { namespace: "phase", value: "treatment", displayName: "Treatment" },
  { namespace: "phase", value: "post_treatment", displayName: "Post-Treatment" },
  { namespace: "phase", value: "survivorship", displayName: "Survivorship" },

  { namespace: "tx", value: "surgery", displayName: "Surgery" },
  { namespace: "tx", value: "chemo", displayName: "Chemotherapy" },
  { namespace: "tx", value: "radiation", displayName: "Radiation Therapy" },
  { namespace: "tx", value: "immunotherapy", displayName: "Immunotherapy" },
  { namespace: "tx", value: "targeted", displayName: "Targeted Therapy" },
  { namespace: "tx", value: "hormonal", displayName: "Hormonal Therapy" },
  { namespace: "tx", value: "trial", displayName: "Clinical Trial" },

  { namespace: "sx", value: "fatigue", displayName: "Fatigue" },
  { namespace: "sx", value: "nausea", displayName: "Nausea" },
  { namespace: "sx", value: "neuropathy", displayName: "Neuropathy" },
  { namespace: "sx", value: "diarrhea", displayName: "Diarrhea" },
  { namespace: "sx", value: "rash", displayName: "Rash" },
  { namespace: "sx", value: "pain", displayName: "Pain" },
  { namespace: "sx", value: "insomnia", displayName: "Insomnia" },
  { namespace: "sx", value: "brain_fog", displayName: "Brain Fog" },

  { namespace: "fu", value: "oncology_visit", displayName: "Oncology Visit" },
  { namespace: "fu", value: "imaging", displayName: "Surveillance Imaging" },
  { namespace: "fu", value: "lab", displayName: "Surveillance Labs" },
  { namespace: "fu", value: "screening", displayName: "Screening" },
  { namespace: "fu", value: "cardiac", displayName: "Cardiac Monitoring" },
  { namespace: "fu", value: "bone_health", displayName: "Bone Health Monitoring" },
];

type FolderSpec = {
  name: string;
  systemKey: string;
  children?: FolderSpec[];
};

const CANCER_FOLDER_TREE: FolderSpec = {
  name: "Cancer Track",
  systemKey: "cancer/root",
  children: [
    { name: "Diagnosis & Pathology", systemKey: "cancer/diagnosis-pathology" },
    { name: "Imaging", systemKey: "cancer/imaging" },
    {
      name: "Treatment",
      systemKey: "cancer/treatment",
      children: [
        { name: "Chemotherapy", systemKey: "cancer/treatment/chemo" },
        { name: "Radiation", systemKey: "cancer/treatment/radiation" },
        { name: "Surgery", systemKey: "cancer/treatment/surgery" },
        { name: "Immunotherapy / Targeted", systemKey: "cancer/treatment/immuno-targeted" },
      ],
    },
    { name: "Labs", systemKey: "cancer/labs" },
    { name: "Side Effects", systemKey: "cancer/side-effects" },
    { name: "Follow-ups", systemKey: "cancer/followups" },
    { name: "Survivorship", systemKey: "cancer/survivorship" },
    { name: "Insurance & Authorizations", systemKey: "cancer/insurance-auth" },
  ],
};

async function upsertTags(db: ReturnType<typeof drizzle>) {
  for (const t of CANCER_TAGS) {
    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.namespace, t.namespace), eq(tags.value, t.value)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(tags).values({
        namespace: t.namespace,
        value: t.value,
        displayName: t.displayName,
      });
    }
  }
}

async function findFolderBySystemKey(db: ReturnType<typeof drizzle>, profileId: string, systemKey: string) {
  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.profileId, profileId as any), eq(folders.systemKey, systemKey)))
    .limit(1);

  return existing[0]?.id ?? null;
}

async function createFolder(
  db: ReturnType<typeof drizzle>,
  profileId: string,
  name: string,
  systemKey: string,
  parentFolderId: string | null
) {
  const existingId = await findFolderBySystemKey(db, profileId, systemKey);
  if (existingId) return existingId;

  const inserted = await db
    .insert(folders)
    .values({
      profileId: profileId as any,
      parentFolderId: parentFolderId as any,
      name,
      systemKey,
    })
    .returning({ id: folders.id });

  return inserted[0].id;
}

async function createFolderTree(
  db: ReturnType<typeof drizzle>,
  profileId: string,
  spec: FolderSpec,
  parentFolderId: string | null
): Promise<string> {
  const thisId = await createFolder(db, profileId, spec.name, spec.systemKey, parentFolderId);

  if (spec.children?.length) {
    for (const child of spec.children) {
      await createFolderTree(db, profileId, child, thisId);
    }
  }
  return thisId;
}

async function setCancerTrackMetadata(db: ReturnType<typeof drizzle>, profileId: string) {
  await db.execute(sql`
    UPDATE profiles
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{cancerTrack}',
      COALESCE(metadata->'cancerTrack','{}'::jsonb) || '{"enabled": true}'::jsonb,
      true
    )
    WHERE id = ${profileId}::uuid
  `);
}

async function main() {
  const profileId = process.argv[2];
  if (!profileId) {
    throw new Error("Usage: ts-node scripts/seed-cancer.ts <profileId-uuid>");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  await upsertTags(db);
  await createFolderTree(db, profileId, CANCER_FOLDER_TREE, null);
  await setCancerTrackMetadata(db, profileId);

  await pool.end();
  console.log("Seed complete: cancer tags + folder tree created.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
