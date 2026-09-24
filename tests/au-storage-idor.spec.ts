/**
 * AU region storage — IDOR regression test.
 *
 * Asserts that upsertCoverage enforces profileId ownership when resolving
 * an ON CONFLICT on the coverage UUID. Without the `where` clause, any
 * authenticated AU user who knows another user's coverage UUID can overwrite
 * that row via PUT /api/au/coverage/:id.
 *
 * This is a structural/static check: if the source ever drops the ownership
 * guard it will surface here before it reaches main.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("au-storage upsertCoverage — IDOR ownership guard", () => {
  const src = readFileSync(
    resolve(import.meta.dirname, "../server/storage/au-storage.ts"),
    "utf-8",
  );

  it("onConflictDoUpdate for auHealthCoverage uses a profileId where-guard", () => {
    // The upsertCoverage function must scope the conflict update to the
    // caller's profileId, otherwise any authenticated user can overwrite
    // another user's coverage row by supplying a known UUID in the URL path.
    const coverageBlock = src.slice(
      src.indexOf("async function upsertCoverage"),
      src.indexOf("// ─── Medication codes"),
    );
    expect(coverageBlock).toContain("onConflictDoUpdate");
    expect(coverageBlock).toContain("auHealthCoverage.profileId");
    expect(coverageBlock).toMatch(/where\s*:\s*eq\s*\(\s*auHealthCoverage\.profileId/);
  });
});
