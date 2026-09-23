/**
 * Per-provider wRVU productivity.
 *
 * Productivity is measured in **work RVUs only**, not total RVUs and not dollars.
 * Work RVU is the one component that reflects what the clinician did; practice
 * expense reflects what the practice spent, and malpractice reflects what it
 * insured. A "productivity" figure built on total RVU rewards a physician for
 * working somewhere with expensive overhead, and penalises one who moves a case
 * to a facility setting — neither of which is about their work.
 *
 * ## Attribution is the hard part, not the arithmetic
 *
 * Two NPIs appear on a claim line: who *performed* the service (rendering) and
 * who it was *billed under* (billing). They are usually the same. When they are
 * not, the difference is almost always **incident-to** billing — an advanced
 * practice provider's visit billed under a supervising physician's NPI to obtain
 * 100% rather than 85% of the fee schedule.
 *
 * That divergence has a consequence people discover late:
 *
 *   - Attribute by **billing NPI** and the physician is credited with work they
 *     did not do, while the APP shows near-zero productivity. If compensation
 *     is wRVU-based, the APP is underpaid for real work and the physician's
 *     numbers cannot be compared to any external benchmark.
 *   - Attribute by **rendering NPI** and the credit follows the work, which is
 *     what a productivity measure is for.
 *
 * This module attributes by rendering NPI by default, and — either way —
 * *reports every line where the two differ* rather than letting the choice
 * disappear into a total. A practice that wants billing-NPI attribution can have
 * it; what it cannot have is the choice being invisible.
 */

import type { ServiceLine } from "@shared/rvu";
import { priceSession, type PricingContext, type SessionPricing } from "./rvu-calculator";

export type AttributionBasis = "rendering" | "billing";

export interface ProviderIdentity {
  npi: string;
  name?: string;
  specialty?: string;
  /**
   * Clinical full-time equivalent for the period, 0 < fte <= 1 normally.
   * Required for any cross-provider comparison; raw totals compare a half-time
   * clinician to a full-time one and call the difference performance.
   */
  clinicalFte?: number;
}

export interface ProductivityPeriod {
  /** ISO-8601 start date, inclusive. */
  start: string;
  /** ISO-8601 end date, inclusive. */
  end: string;
}

export interface AttributionDiscrepancy {
  code: string;
  dateOfService?: string;
  renderingNpi: string;
  billingNpi: string;
  workRvu: number;
  note: string;
}

export interface ProviderProductivity {
  npi: string;
  name?: string;
  specialty?: string;
  /** Work RVUs credited under the chosen attribution basis. */
  workRvu: number;
  /** Total RVUs, reported for completeness; not the productivity measure. */
  totalRvu: number;
  allowedAmount: number;
  lineCount: number;
  /** Distinct dates of service with at least one credited line. */
  encounterDays: number;
  clinicalFte?: number;
  /** workRvu / clinicalFte. Null when FTE is unknown — the honest value. */
  workRvuPerFte: number | null;
  /** workRvu / encounterDays. Robust to period length; null when no days. */
  workRvuPerEncounterDay: number | null;
}

export interface ProductivityReport {
  basis: AttributionBasis;
  period: ProductivityPeriod;
  providers: readonly ProviderProductivity[];
  /** Lines where rendering and billing NPI differ — likely incident-to. */
  attributionDiscrepancies: readonly AttributionDiscrepancy[];
  /** Lines that could not be priced, so they credit nobody. */
  unpriced: readonly { code: string; reason: string; detail: string }[];
  /** Caveats a reader needs before comparing these numbers to anything. */
  caveats: readonly string[];
}

export interface EncounterSession {
  /** Lines billed together — the multiple-procedure rule applies within a session. */
  lines: readonly ServiceLine[];
  localityCode: string;
}

function attributedNpi(line: ServiceLine, basis: AttributionBasis): string | null {
  const rendering = line.renderingNpi?.trim() || null;
  const billing = line.billingNpi?.trim() || null;
  // Fall back to the other NPI rather than dropping the line: a line credited to
  // the wrong provider is visible in a report, a silently dropped one is not.
  return basis === "rendering" ? (rendering ?? billing) : (billing ?? rendering);
}

/**
 * Days between two ISO dates, inclusive of both ends. Null when unparseable.
 */
function periodDays(period: ProductivityPeriod): number | null {
  const start = Date.parse(period.start);
  const end = Date.parse(period.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Build a per-provider wRVU report from priced sessions.
 *
 * Pricing happens per session so the multiple-procedure reduction is applied
 * across the lines that were actually billed together. Summing independently
 * priced lines would skip the reduction entirely and overstate every surgical
 * provider.
 */
export function buildProductivityReport(
  sessions: readonly EncounterSession[],
  providers: readonly ProviderIdentity[],
  period: ProductivityPeriod,
  options: { basis?: AttributionBasis } = {},
): ProductivityReport {
  const basis = options.basis ?? "rendering";

  const byNpi = new Map<
    string,
    { workRvu: number; totalRvu: number; allowed: number; lines: number; days: Set<string> }
  >();
  const discrepancies: AttributionDiscrepancy[] = [];
  const unpriced: { code: string; reason: string; detail: string }[] = [];
  let linesWithNoNpi = 0;

  for (const session of sessions) {
    const context: PricingContext = { localityCode: session.localityCode };
    const priced: SessionPricing = priceSession(session.lines, context);
    unpriced.push(...priced.unpriced);

    priced.lines.forEach((result, index) => {
      if (result.status !== "priced") return;
      const line = session.lines[index];
      const npi = attributedNpi(line, basis);

      if (!npi) {
        linesWithNoNpi += 1;
        return;
      }

      const rendering = line.renderingNpi?.trim();
      const billing = line.billingNpi?.trim();
      if (rendering && billing && rendering !== billing) {
        discrepancies.push({
          code: result.code,
          dateOfService: line.dateOfService,
          renderingNpi: rendering,
          billingNpi: billing,
          workRvu: result.breakdown.workRvu,
          note:
            "rendering and billing NPI differ — commonly incident-to billing. " +
            `Credited to the ${basis} NPI under the current basis.`,
        });
      }

      const bucket = byNpi.get(npi) ?? {
        workRvu: 0,
        totalRvu: 0,
        allowed: 0,
        lines: 0,
        days: new Set<string>(),
      };
      bucket.workRvu += result.breakdown.workRvu;
      bucket.totalRvu += result.breakdown.totalRvu;
      bucket.allowed += result.allowedAmount;
      bucket.lines += 1;
      if (line.dateOfService) bucket.days.add(line.dateOfService.slice(0, 10));
      byNpi.set(npi, bucket);
    });
  }

  const identityByNpi = new Map(providers.map((p) => [p.npi, p]));

  const rows: ProviderProductivity[] = Array.from(byNpi.entries()).map(([npi, bucket]) => {
    const identity = identityByNpi.get(npi);
    const fte = identity?.clinicalFte;
    const encounterDays = bucket.days.size;
    const workRvu = round(bucket.workRvu, 2);

    return {
      npi,
      name: identity?.name,
      specialty: identity?.specialty,
      workRvu,
      totalRvu: round(bucket.totalRvu, 2),
      allowedAmount: round(bucket.allowed, 2),
      lineCount: bucket.lines,
      encounterDays,
      clinicalFte: fte,
      // Null rather than a guess. A missing FTE is a real gap, and defaulting it
      // to 1.0 turns a half-time clinician into an apparent underperformer.
      workRvuPerFte: fte && fte > 0 ? round(workRvu / fte, 2) : null,
      workRvuPerEncounterDay: encounterDays > 0 ? round(workRvu / encounterDays, 2) : null,
    };
  });

  rows.sort((a, b) => b.workRvu - a.workRvu);

  const caveats: string[] = [
    "Productivity is work RVU only. Total RVU and allowed amount are shown for " +
      "context and are not productivity measures — they move with site of service " +
      "and local costs, not with the clinician's work.",
  ];

  if (discrepancies.length > 0) {
    const affected = round(
      discrepancies.reduce((sum, d) => sum + d.workRvu, 0),
      2,
    );
    caveats.push(
      `${discrepancies.length} line(s) totalling ${affected} wRVU have different ` +
        `rendering and billing NPIs (commonly incident-to). They are credited to the ` +
        `${basis} NPI. Switching the basis moves that work between providers.`,
    );
  }

  const providersWithoutFte = rows.filter((r) => r.workRvuPerFte === null);
  if (providersWithoutFte.length > 0) {
    caveats.push(
      `${providersWithoutFte.length} provider(s) have no clinical FTE on file, so ` +
        "their per-FTE figure is null. Do not compare raw wRVU totals across " +
        "providers whose FTE differs.",
    );
  }

  if (linesWithNoNpi > 0) {
    caveats.push(
      `${linesWithNoNpi} priced line(s) carried no rendering or billing NPI and are ` +
        "credited to nobody. The provider totals below therefore do not sum to the " +
        "practice total.",
    );
  }

  const days = periodDays(period);
  if (days !== null && days < 90) {
    caveats.push(
      `This period covers ${days} day(s). Published wRVU benchmarks are annual; ` +
        "annualising a short period amplifies vacation, call schedules and case-mix " +
        "noise into apparent performance differences.",
    );
  }

  if (unpriced.length > 0) {
    caveats.push(
      `${unpriced.length} line(s) could not be priced and credit nobody — see ` +
        "`unpriced` for the reasons (bundled, non-covered, carrier-priced, or absent " +
        "from the loaded fee schedule).",
    );
  }

  caveats.push(
    "No external benchmark is applied. MGMA and AMGA percentile data are licensed " +
      "products; comparing to a remembered or approximated percentile is worse than " +
      "not comparing at all.",
  );

  return {
    basis,
    period,
    providers: rows,
    attributionDiscrepancies: discrepancies,
    unpriced,
    caveats,
  };
}

/**
 * Compare the same sessions under both attribution bases.
 *
 * Useful precisely once: when a practice is deciding which basis to use, seeing
 * how much wRVU actually moves between named providers settles the argument
 * faster than any explanation of incident-to rules.
 */
export function compareAttributionBases(
  sessions: readonly EncounterSession[],
  providers: readonly ProviderIdentity[],
  period: ProductivityPeriod,
): {
  rendering: ProductivityReport;
  billing: ProductivityReport;
  shifts: readonly { npi: string; name?: string; renderingWorkRvu: number; billingWorkRvu: number; delta: number }[];
} {
  const rendering = buildProductivityReport(sessions, providers, period, { basis: "rendering" });
  const billing = buildProductivityReport(sessions, providers, period, { basis: "billing" });

  const renderingByNpi = new Map(rendering.providers.map((p) => [p.npi, p]));
  const billingByNpi = new Map(billing.providers.map((p) => [p.npi, p]));
  const allNpis = new Set(
    Array.from(renderingByNpi.keys()).concat(Array.from(billingByNpi.keys())),
  );

  const shifts = Array.from(allNpis)
    .map((npi) => {
      const r = renderingByNpi.get(npi)?.workRvu ?? 0;
      const b = billingByNpi.get(npi)?.workRvu ?? 0;
      return {
        npi,
        name: renderingByNpi.get(npi)?.name ?? billingByNpi.get(npi)?.name,
        renderingWorkRvu: r,
        billingWorkRvu: b,
        delta: round(b - r, 2),
      };
    })
    .filter((s) => s.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return { rendering, billing, shifts };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
