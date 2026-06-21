import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "@shared/schema";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let lastRunDateUtc: string | null = null;

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Find every child profile whose date-of-birth + 18 years now sits in the
 * window (yesterday, today]. Mark each as transition_status = 'pending'.
 * Caregiver-permission middleware will read this flag and freeze guardian
 * write/read access until the new adult claims their own account.
 *
 * Idempotent: re-running on the same UTC date is a no-op because the WHERE
 * clause excludes profiles already flagged.
 */
export async function runMinorTransitionSweep(): Promise<{ flagged: number }> {
  const today = todayUtcDateString();
  if (lastRunDateUtc === today) return { flagged: 0 };

  try {
    const result = await db
      .update(profiles)
      .set({
        transitionStatus: "pending",
        transitionPendingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(profiles.profileType, "child"),
          isNull(profiles.transitionStatus),
          sql`${profiles.dob} + INTERVAL '18 years' <= CURRENT_DATE`,
          sql`${profiles.dob} + INTERVAL '18 years' > CURRENT_DATE - INTERVAL '7 days'`
        )
      )
      .returning({ id: profiles.id });

    lastRunDateUtc = today;
    if (result.length > 0) {
      console.log(
        `[MinorTransition] Flagged ${result.length} profile(s) as pending age-of-majority transition.`
      );
    }
    return { flagged: result.length };
  } catch (err) {
    console.error("[MinorTransition] sweep failed:", err);
    return { flagged: 0 };
  }
}

export function startMinorTransitionScheduler(): void {
  setTimeout(() => {
    void runMinorTransitionSweep();
  }, 30_000).unref();

  setInterval(() => {
    void runMinorTransitionSweep();
  }, TWENTY_FOUR_HOURS_MS).unref();

  console.log("[MinorTransition] Daily age-of-majority sweep scheduled (24h).");
}
