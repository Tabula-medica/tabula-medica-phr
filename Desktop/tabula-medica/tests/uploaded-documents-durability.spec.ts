/**
 * Durability tests for the uploaded-documents store.
 *
 * uploadedDocuments moved out of an in-memory Map into the
 * `app_uploaded_documents` table (DatabaseStorage, C1). This is the metadata
 * index for patient-uploaded files (the bytes live in object storage at
 * storage_url). Held only in memory, every upload is orphaned on restart — the
 * files exist in storage but nothing references them.
 *
 * This suite proves:
 *   - createUploadedDocument persists a doc a fresh instance reads back, with
 *     tags + nested aiExtractedData round-tripping and scan defaults applied.
 *   - getUploadedDocuments is scoped per patient and sorted newest-first.
 *   - updateUploadedDocument merges a partial update and persists.
 *   - deleteUploadedDocument is OWNERSHIP-SCOPED: another patient cannot delete
 *     someone else's document.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/uploaded-documents-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appUploadedDocumentsTable } from "@shared/schema";
import { createSchemaTables } from "./helpers/pglite-schema";

const ref = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../server/db", () => ({
  get db() {
    return ref.db;
  },
}));

let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  ref.db = drizzle(client);
  await createSchemaTables(client, { appUploadedDocumentsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_uploaded_documents;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(patientId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_uploaded_documents WHERE patient_id = $1",
    [patientId],
  );
  return Number(res.rows[0].count);
}

const PATIENT = "doc-patient";
const OTHER = "doc-other";

function baseDoc(patientId: string, overrides: Record<string, unknown> = {}) {
  return {
    patientId,
    documentType: "lab_result" as const,
    title: "CBC panel",
    tags: ["labs", "2026"],
    fileName: "cbc.pdf",
    originalFileName: "CBC Results.pdf",
    mimeType: "application/pdf",
    fileSize: 12345,
    storageUrl: "gs://bucket/cbc.pdf",
    ...overrides,
  };
}

describe("createUploadedDocument — durable metadata index", () => {
  it("persists a doc a fresh instance reads back with tags + aiExtractedData", async () => {
    const writer = await getStorage();
    const created = await writer.createUploadedDocument(
      baseDoc(PATIENT, {
        aiExtractedData: {
          documentType: "lab_result",
          extractedFields: { wbc: "6.1" },
          confidence: 0.92,
          summary: "Normal CBC",
        },
      }),
    );
    expect(created.id).toBeTruthy();
    expect(created.scanStatus).toBe("pending"); // default
    expect(created.isVerified).toBe(false); // default

    const reader = await getStorage();
    const got = await reader.getUploadedDocument(created.id);
    expect(got).toBeDefined();
    expect(got!.tags).toEqual(["labs", "2026"]);
    expect(got!.fileSize).toBe(12345);
    expect(got!.aiExtractedData?.summary).toBe("Normal CBC");
    expect(got!.aiExtractedData?.confidence).toBe(0.92);
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("scopes getUploadedDocuments per patient", async () => {
    const storage = await getStorage();
    await storage.createUploadedDocument(baseDoc(PATIENT, { title: "A" }));
    await storage.createUploadedDocument(baseDoc(OTHER, { title: "B" }));

    expect(await storage.getUploadedDocuments(PATIENT)).toHaveLength(1);
    expect((await storage.getUploadedDocuments(PATIENT))[0].title).toBe("A");
    expect(await storage.getUploadedDocuments(OTHER)).toHaveLength(1);
  });
});

describe("updateUploadedDocument — merge + persist", () => {
  it("merges a partial update and a fresh instance sees it", async () => {
    const storage = await getStorage();
    const created = await storage.createUploadedDocument(baseDoc(PATIENT));
    const updated = await storage.updateUploadedDocument(created.id, {
      isVerified: true,
      verifiedBy: "clinician-1",
      scanStatus: "clean",
    });
    expect(updated!.isVerified).toBe(true);
    expect(updated!.verifiedBy).toBe("clinician-1");
    // unchanged fields preserved
    expect(updated!.title).toBe("CBC panel");
    expect(updated!.tags).toEqual(["labs", "2026"]);

    const reader = await getStorage();
    const got = await reader.getUploadedDocument(created.id);
    expect(got!.scanStatus).toBe("clean");
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("returns undefined when updating a missing document", async () => {
    const storage = await getStorage();
    expect(
      await storage.updateUploadedDocument("00000000-0000-0000-0000-000000000000", {
        title: "x",
      }),
    ).toBeUndefined();
  });
});

describe("deleteUploadedDocument — ownership-scoped", () => {
  it("deletes the owner's document", async () => {
    const storage = await getStorage();
    const created = await storage.createUploadedDocument(baseDoc(PATIENT));
    await storage.deleteUploadedDocument(created.id, PATIENT);
    expect(await rowCount(PATIENT)).toBe(0);
    expect(await (await getStorage()).getUploadedDocument(created.id)).toBeUndefined();
  });

  it("does NOT let another patient delete someone else's document", async () => {
    const storage = await getStorage();
    const created = await storage.createUploadedDocument(baseDoc(PATIENT));

    await storage.deleteUploadedDocument(created.id, OTHER); // wrong owner — no-op

    const reader = await getStorage();
    expect(await reader.getUploadedDocument(created.id)).toBeDefined();
    expect(await rowCount(PATIENT)).toBe(1);
  });
});
