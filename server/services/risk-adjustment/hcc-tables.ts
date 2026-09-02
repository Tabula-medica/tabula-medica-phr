/**
 * Loader and registry for the official CMS-HCC V28 model tables.
 *
 * CMS publishes the model as a set of files with each Rate Announcement: the
 * ICD-10-CM -> HCC crosswalk, the category labels, the hierarchy ("trumping")
 * table, and the segment coefficients. This module ingests those, validates
 * them, and holds them in memory.
 *
 * Everything here is deliberately strict:
 *
 *   - Nothing is inferred. A code absent from the crosswalk maps to no HCC; it
 *     is never guessed at from a neighbouring code or a code range.
 *   - Every table records a SHA-256 and a payment year, so a score can always
 *     be traced to the exact file that produced it, and a silently swapped
 *     table is detectable.
 *   - Mixing payment years across tables is rejected. A 2026 crosswalk with
 *     2025 coefficients yields a number that looks plausible and is wrong.
 *   - The registry starts EMPTY. Until a deployment loads real CMS files, the
 *     calculator refuses to produce a RAF (see raf-calculator.ts). There is no
 *     bundled fallback table, because a fallback would be a guess wearing the
 *     costume of an authority.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  HCC_MODEL_SEGMENTS,
  type HccCategory,
  type HccCoefficient,
  type HccCrosswalkRow,
  type HccHierarchyRule,
  type HccModelSegment,
  type HccTableProvenance,
} from "@shared/hcc-v28";

export interface HccTableSet {
  crosswalk: Map<string, number>;
  categories: Map<number, HccCategory>;
  /** hcc -> the set of HCCs it suppresses. */
  hierarchy: Map<number, ReadonlySet<number>>;
  /** `${segment}::${factor}` -> coefficient. */
  coefficients: Map<string, number>;
  provenance: {
    crosswalk: HccTableProvenance;
    categories: HccTableProvenance;
    hierarchy: HccTableProvenance;
    coefficients: HccTableProvenance;
  };
  paymentYear: number;
}

let registry: HccTableSet | null = null;

/** Normalise an ICD-10-CM code the way CMS ships them: upper case, no dot. */
export function normalizeIcd10(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export interface RawHccTables {
  crosswalk: { rows: readonly HccCrosswalkRow[]; source: string; paymentYear: number };
  categories: { rows: readonly HccCategory[]; source: string; paymentYear: number };
  hierarchy: { rows: readonly HccHierarchyRule[]; source: string; paymentYear: number };
  coefficients: { rows: readonly HccCoefficient[]; source: string; paymentYear: number };
}

/**
 * Validate a candidate table set. Returns problems; empty means loadable.
 *
 * These checks exist because each corresponds to a way a real CMS ingestion
 * goes wrong quietly — a truncated download, a mixed-year assembly, a crosswalk
 * pointing at categories that were removed in the version being loaded.
 */
export function validateHccTables(raw: RawHccTables): string[] {
  const problems: string[] = [];

  const years = new Set([
    raw.crosswalk.paymentYear,
    raw.categories.paymentYear,
    raw.hierarchy.paymentYear,
    raw.coefficients.paymentYear,
  ]);
  if (years.size > 1) {
    problems.push(
      `tables span multiple payment years (${Array.from(years).sort().join(", ")}); ` +
        "a mixed-year model produces a plausible-looking wrong score",
    );
  }

  if (raw.categories.rows.length === 0) problems.push("categories table is empty");
  if (raw.crosswalk.rows.length === 0) problems.push("crosswalk table is empty");
  if (raw.coefficients.rows.length === 0) problems.push("coefficients table is empty");

  const categoryNumbers = new Set(raw.categories.rows.map((c) => c.hcc));

  for (const cat of raw.categories.rows) {
    if (!Number.isInteger(cat.hcc) || cat.hcc <= 0) {
      problems.push(`category has a non-positive HCC number: ${JSON.stringify(cat)}`);
    }
    if (!cat.label || !cat.label.trim()) {
      problems.push(`HCC ${cat.hcc} has no label`);
    }
  }

  const seenIcd = new Set<string>();
  for (const row of raw.crosswalk.rows) {
    const code = normalizeIcd10(row.icd10);
    if (!/^[A-Z][A-Z0-9]{2,7}$/.test(code)) {
      problems.push(`crosswalk has a malformed ICD-10-CM code: ${row.icd10}`);
      continue;
    }
    if (seenIcd.has(code)) {
      // CMS crosswalks are one-HCC-per-code within a model version.
      problems.push(`crosswalk maps ${code} more than once`);
    }
    seenIcd.add(code);
    if (!categoryNumbers.has(row.hcc)) {
      problems.push(`crosswalk maps ${code} to HCC ${row.hcc}, which is not in the categories table`);
    }
  }

  for (const rule of raw.hierarchy.rows) {
    if (!categoryNumbers.has(rule.hcc)) {
      problems.push(`hierarchy references unknown HCC ${rule.hcc}`);
    }
    for (const suppressed of rule.suppresses) {
      if (!categoryNumbers.has(suppressed)) {
        problems.push(`HCC ${rule.hcc} suppresses unknown HCC ${suppressed}`);
      }
      if (suppressed === rule.hcc) {
        problems.push(`HCC ${rule.hcc} suppresses itself`);
      }
    }
  }

  const segments = new Set<string>(HCC_MODEL_SEGMENTS);
  for (const coef of raw.coefficients.rows) {
    if (!segments.has(coef.segment)) {
      problems.push(`coefficient references unknown model segment: ${coef.segment}`);
    }
    if (!Number.isFinite(coef.value)) {
      problems.push(`coefficient ${coef.segment}/${coef.factor} is not a finite number`);
    }
  }

  return problems;
}

/** Load a validated table set into the registry. Throws on validation failure. */
export function loadHccTables(raw: RawHccTables): HccTableSet {
  const problems = validateHccTables(raw);
  if (problems.length > 0) {
    throw new Error(`CMS-HCC V28 tables failed validation:\n  - ${problems.join("\n  - ")}`);
  }

  const loadedAt = new Date().toISOString();
  const stamp = (
    part: { source: string; paymentYear: number },
    rows: unknown,
  ): HccTableProvenance => ({
    source: part.source,
    paymentYear: part.paymentYear,
    sha256: sha256(JSON.stringify(rows)),
    loadedAt,
  });

  const crosswalk = new Map<string, number>();
  for (const row of raw.crosswalk.rows) {
    crosswalk.set(normalizeIcd10(row.icd10), row.hcc);
  }

  const categories = new Map<number, HccCategory>();
  for (const cat of raw.categories.rows) categories.set(cat.hcc, cat);

  const hierarchy = new Map<number, ReadonlySet<number>>();
  for (const rule of raw.hierarchy.rows) {
    hierarchy.set(rule.hcc, new Set(rule.suppresses));
  }

  const coefficients = new Map<string, number>();
  for (const coef of raw.coefficients.rows) {
    coefficients.set(`${coef.segment}::${coef.factor}`, coef.value);
  }

  registry = {
    crosswalk,
    categories,
    hierarchy,
    coefficients,
    provenance: {
      crosswalk: stamp(raw.crosswalk, raw.crosswalk.rows),
      categories: stamp(raw.categories, raw.categories.rows),
      hierarchy: stamp(raw.hierarchy, raw.hierarchy.rows),
      coefficients: stamp(raw.coefficients, raw.coefficients.rows),
    },
    paymentYear: raw.crosswalk.paymentYear,
  };

  return registry;
}

/** The loaded tables, or null when a deployment has not supplied them. */
export function getHccTables(): HccTableSet | null {
  return registry;
}

export function hccTablesLoaded(): boolean {
  return registry !== null;
}

/** Test/reset hook — clears the registry. */
export function clearHccTables(): void {
  registry = null;
}

/**
 * Map an ICD-10-CM code to its V28 payment HCC.
 *
 * Returns null both when no tables are loaded and when the code maps to no HCC.
 * Callers that need to tell those apart should check `hccTablesLoaded()` first —
 * "not risk-adjusting" and "we cannot tell" are different clinical statements.
 */
export function hccForIcd10(icd10: string): number | null {
  if (!registry) return null;
  return registry.crosswalk.get(normalizeIcd10(icd10)) ?? null;
}

export function hccLabel(hcc: number): string | null {
  return registry?.categories.get(hcc)?.label ?? null;
}

export function lookupCoefficient(
  segment: HccModelSegment,
  factor: string,
): number | null {
  if (!registry) return null;
  return registry.coefficients.get(`${segment}::${factor}`) ?? null;
}

/**
 * Load tables from a JSON file matching `RawHccTables`.
 *
 * Deployments point `HCC_V28_TABLES_PATH` at a file produced by converting the
 * CMS release. Keeping the conversion outside this process is intentional: the
 * conversion is where judgement calls live, and they belong in a reviewed,
 * version-controlled artifact rather than in a server boot path.
 */
export async function loadHccTablesFromFile(path: string): Promise<HccTableSet> {
  const text = await readFile(path, "utf8");
  let parsed: RawHccTables;
  try {
    parsed = JSON.parse(text) as RawHccTables;
  } catch (err) {
    throw new Error(
      `CMS-HCC table file at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
  return loadHccTables(parsed);
}

/** Boot hook: load tables if configured. Never throws on absence — a
 *  deployment without the CMS files is a supported state (no RAF scoring). */
export async function initHccTablesFromEnv(): Promise<
  { loaded: true; paymentYear: number } | { loaded: false; reason: string }
> {
  const path = process.env.HCC_V28_TABLES_PATH;
  if (!path) {
    return {
      loaded: false,
      reason:
        "HCC_V28_TABLES_PATH not set — HCC eligibility and documentation gaps are " +
        "available, RAF scoring is not.",
    };
  }
  try {
    const tables = await loadHccTablesFromFile(path);
    return { loaded: true, paymentYear: tables.paymentYear };
  } catch (err) {
    return { loaded: false, reason: (err as Error).message };
  }
}
