/**
 * Loader and registry for the CMS Physician Fee Schedule tables.
 *
 * Three files, all published by CMS and all revised on their own cadence:
 *
 *   - **Relative Value File** (RVU25A, RVU25B, …) — per-code work/PE/malpractice
 *     RVUs and the status, global-period and multiple-procedure indicators.
 *     Revised *quarterly* within a year.
 *   - **GPCI file** — per-locality geographic adjustment for each component.
 *   - **Conversion factor** — one national dollar figure, set annually and
 *     occasionally amended mid-year by legislation.
 *
 * Same discipline as the HCC tables: nothing is bundled, nothing is inferred,
 * everything is stamped with a SHA-256 and a year, and mixed-year assemblies are
 * rejected. A fee schedule priced with last year's conversion factor produces a
 * number that looks entirely normal and is wrong on every line.
 *
 * ## On CPT descriptors
 *
 * The RVU values are US Government work and freely usable. The CPT code
 * *descriptors* are AMA copyright and need a license. This loader accepts an
 * optional `descriptor` per row and never requires one — a deployment without an
 * AMA license simply omits them and the engine works on codes alone.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  PAYABLE_STATUS_INDICATORS,
  type GpciRow,
  type PfsProvenance,
  type PfsStatusIndicator,
  type RvuRow,
} from "@shared/rvu";

const VALID_STATUS: ReadonlySet<string> = new Set<PfsStatusIndicator>([
  "A",
  "B",
  "C",
  "N",
  "I",
  "R",
  "X",
  "D",
]);

/**
 * Plausible GPCI band, inclusive at both ends.
 *
 * Published GPCIs sit close to 1.0 — the widest real spread is the malpractice
 * index, which runs from roughly 0.3 in Puerto Rico to well over 2 in South
 * Florida. Anything outside this band is far more likely to be a decimal-point
 * slip or a column offset in the import than a real locality, and it would
 * scale every claim priced in that locality.
 */
export const GPCI_PLAUSIBLE_MIN = 0.3;
export const GPCI_PLAUSIBLE_MAX = 3.0;

export interface LoadedRvuRow extends RvuRow {
  /** AMA-licensed text. Absent unless the deployment holds a license. */
  descriptor?: string;
}

export interface PfsTableSet {
  /** `${code}` or `${code}|${modifier}` -> row. */
  rvu: Map<string, LoadedRvuRow>;
  gpci: Map<string, GpciRow>;
  conversionFactor: number;
  provenance: { rvu: PfsProvenance; gpci: PfsProvenance; conversionFactor: PfsProvenance };
  year: number;
}

let registry: PfsTableSet | null = null;

/** Normalise a HCPCS/CPT code: upper case, trimmed, no punctuation. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeModifier(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Registry key for a code, optionally modifier-specific. */
export function rvuKey(code: string, modifier?: string): string {
  const base = normalizeCode(code);
  return modifier ? `${base}|${normalizeModifier(modifier)}` : base;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export interface RawPfsTables {
  rvu: { rows: readonly LoadedRvuRow[]; source: string; year: number; quarter?: string };
  gpci: { rows: readonly GpciRow[]; source: string; year: number };
  conversionFactor: { value: number; source: string; year: number };
}

/**
 * Validate a candidate table set. Empty result means loadable.
 *
 * Each check maps to a way a real PFS ingestion fails quietly: a truncated
 * download, a year mismatch after a January re-import, a GPCI file for the wrong
 * contractor region, a conversion factor accidentally left at a placeholder.
 */
export function validatePfsTables(raw: RawPfsTables): string[] {
  const problems: string[] = [];

  const years = new Set([raw.rvu.year, raw.gpci.year, raw.conversionFactor.year]);
  if (years.size > 1) {
    problems.push(
      `tables span multiple years (${Array.from(years).sort().join(", ")}); ` +
        "pricing with a mismatched conversion factor is wrong on every line",
    );
  }

  if (raw.rvu.rows.length === 0) problems.push("RVU table is empty");
  if (raw.gpci.rows.length === 0) problems.push("GPCI table is empty");

  if (!Number.isFinite(raw.conversionFactor.value) || raw.conversionFactor.value <= 0) {
    problems.push(
      `conversion factor must be a positive number, got ${raw.conversionFactor.value}`,
    );
  }

  const seen = new Set<string>();
  for (const row of raw.rvu.rows) {
    const code = normalizeCode(row.code);
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      problems.push(`RVU table has a malformed HCPCS/CPT code: ${row.code}`);
      continue;
    }
    const key = rvuKey(row.code, row.modifier);
    if (seen.has(key)) problems.push(`RVU table contains ${key} more than once`);
    seen.add(key);

    if (!VALID_STATUS.has(row.status)) {
      problems.push(`${code} has an unrecognised status indicator: ${row.status}`);
    }
    for (const [field, value] of [
      ["workRvu", row.workRvu],
      ["facilityPeRvu", row.facilityPeRvu],
      ["nonFacilityPeRvu", row.nonFacilityPeRvu],
      ["malpracticeRvu", row.malpracticeRvu],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        problems.push(`${code} has an invalid ${field}: ${value}`);
      }
    }
  }

  const seenLocality = new Set<string>();
  for (const row of raw.gpci.rows) {
    if (!row.localityCode?.trim()) {
      problems.push("GPCI row has no locality code");
      continue;
    }
    if (seenLocality.has(row.localityCode)) {
      problems.push(`GPCI table contains locality ${row.localityCode} more than once`);
    }
    seenLocality.add(row.localityCode);
    for (const [field, value] of [
      ["workGpci", row.workGpci],
      ["peGpci", row.peGpci],
      ["malpracticeGpci", row.malpracticeGpci],
    ] as const) {
      // GPCIs cluster tightly around 1.0. A value outside this band is almost
      // always a decimal-point or column-offset error in the import, not a real
      // locality, and it would scale every claim in that region. The band is
      // inclusive: real malpractice GPCIs do reach the low end (Puerto Rico)
      // and the high end (South Florida), and rejecting an exact boundary
      // value would refuse a legitimate CMS file.
      if (!Number.isFinite(value) || value < GPCI_PLAUSIBLE_MIN || value > GPCI_PLAUSIBLE_MAX) {
        problems.push(
          `locality ${row.localityCode} has an implausible ${field}: ${value} ` +
            `(GPCIs cluster near 1.0; accepted range is ` +
            `${GPCI_PLAUSIBLE_MIN}–${GPCI_PLAUSIBLE_MAX} inclusive — check the ` +
            "import for a column offset)",
        );
      }
    }
  }

  return problems;
}

/** Load a validated table set into the registry. Throws on validation failure. */
export function loadPfsTables(raw: RawPfsTables): PfsTableSet {
  const problems = validatePfsTables(raw);
  if (problems.length > 0) {
    throw new Error(`CMS PFS tables failed validation:\n  - ${problems.join("\n  - ")}`);
  }

  const loadedAt = new Date().toISOString();
  const stamp = (
    part: { source: string; year: number; quarter?: string },
    payload: unknown,
  ): PfsProvenance => ({
    source: part.source,
    year: part.year,
    quarter: part.quarter,
    sha256: sha256(JSON.stringify(payload)),
    loadedAt,
  });

  const rvu = new Map<string, LoadedRvuRow>();
  for (const row of raw.rvu.rows) {
    rvu.set(rvuKey(row.code, row.modifier), { ...row, code: normalizeCode(row.code) });
  }

  const gpci = new Map<string, GpciRow>();
  for (const row of raw.gpci.rows) gpci.set(row.localityCode, row);

  registry = {
    rvu,
    gpci,
    conversionFactor: raw.conversionFactor.value,
    provenance: {
      rvu: stamp(raw.rvu, raw.rvu.rows),
      gpci: stamp(raw.gpci, raw.gpci.rows),
      conversionFactor: stamp(raw.conversionFactor, raw.conversionFactor.value),
    },
    year: raw.rvu.year,
  };

  return registry;
}

export function getPfsTables(): PfsTableSet | null {
  return registry;
}

export function pfsTablesLoaded(): boolean {
  return registry !== null;
}

/** Test/reset hook. */
export function clearPfsTables(): void {
  registry = null;
}

/**
 * Look up a code, preferring a modifier-specific row when one exists.
 *
 * The `26`/`TC` split is real data in the file: the professional and technical
 * components of an imaging study carry genuinely different RVUs, and collapsing
 * them onto the global row overpays one and underpays the other.
 */
export function findRvuRow(code: string, modifiers: readonly string[] = []): LoadedRvuRow | null {
  if (!registry) return null;
  for (const modifier of modifiers) {
    const specific = registry.rvu.get(rvuKey(code, modifier));
    if (specific) return specific;
  }
  return registry.rvu.get(rvuKey(code)) ?? null;
}

export function findGpci(localityCode: string): GpciRow | null {
  return registry?.gpci.get(localityCode) ?? null;
}

export function isSeparatelyPayable(row: RvuRow): boolean {
  return PAYABLE_STATUS_INDICATORS.includes(row.status);
}

/** Load tables from a JSON file matching `RawPfsTables`. */
export async function loadPfsTablesFromFile(path: string): Promise<PfsTableSet> {
  const text = await readFile(path, "utf8");
  let parsed: RawPfsTables;
  try {
    parsed = JSON.parse(text) as RawPfsTables;
  } catch (err) {
    throw new Error(`PFS table file at ${path} is not valid JSON: ${(err as Error).message}`);
  }
  return loadPfsTables(parsed);
}

/** Boot hook. Absence of the file is a supported state — no pricing, no crash. */
export async function initPfsTablesFromEnv(): Promise<
  { loaded: true; year: number } | { loaded: false; reason: string }
> {
  const path = process.env.PFS_RVU_TABLES_PATH;
  if (!path) {
    return {
      loaded: false,
      reason:
        "PFS_RVU_TABLES_PATH not set — wRVU productivity reporting is available " +
        "only once the CMS Relative Value File is loaded.",
    };
  }
  try {
    const tables = await loadPfsTablesFromFile(path);
    return { loaded: true, year: tables.year };
  } catch (err) {
    return { loaded: false, reason: (err as Error).message };
  }
}
