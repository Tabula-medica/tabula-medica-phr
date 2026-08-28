/**
 * TCPA quiet hours.
 *
 * Texts and calls are confined to 08:00–21:00 in the **recipient's** local
 * time, not the practice's. A clinic in New York scheduling a 20:30 reminder
 * blast reaches California at 17:30 (fine) and reaches a patient who moved to
 * Honolulu at 14:30 (fine) — but the same clinic sending at 07:30 Eastern
 * reaches 04:30 in Los Angeles, which is a violation per message.
 *
 * The interesting case is a patient whose timezone is unknown. The tempting
 * fallback is the practice's own zone, which is wrong precisely when it
 * matters: the patients most likely to be missing a timezone are the ones who
 * moved. This module refuses instead, and the caller surfaces the gap rather
 * than sending on a guess.
 */

/** Inclusive lower bound, local time. */
export const QUIET_HOURS_START_HOUR = 8;
/** Exclusive upper bound, local time — 21:00 is the first minute that is too late. */
export const QUIET_HOURS_END_HOUR = 21;

export type QuietHoursVerdict =
  | { status: "allowed"; localHour: number }
  | { status: "deferred"; localHour: number; sendAfter: string }
  | { status: "unknown-timezone" };

/**
 * The wall-clock hour in `timeZone` at `instant`.
 *
 * Uses Intl rather than an offset table so DST is handled by the platform's
 * tz database instead of by arithmetic that goes stale twice a year.
 * Returns null when the zone identifier is not one the runtime knows.
 */
export function localHourIn(timeZone: string, instant: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(instant);
    const hourPart = parts.find((p) => p.type === "hour");
    if (!hourPart) return null;
    const hour = Number(hourPart.value);
    // Intl renders midnight as "24" in some ICU versions.
    return Number.isFinite(hour) ? hour % 24 : null;
  } catch {
    return null;
  }
}

/**
 * Next instant at or after `from` when the local hour is within the window.
 *
 * Steps hour by hour rather than computing an offset: a DST transition can
 * make "tomorrow 08:00 local" 23 or 25 hours away, and stepping finds the
 * real boundary in either case. Capped at 48 steps, which covers any
 * transition with room to spare.
 */
function nextOpenWindow(timeZone: string, from: Date): string | null {
  for (let step = 1; step <= 48; step++) {
    const candidate = new Date(from.getTime() + step * 3_600_000);
    const hour = localHourIn(timeZone, candidate);
    if (hour === null) return null;
    if (hour >= QUIET_HOURS_START_HOUR && hour < QUIET_HOURS_END_HOUR) {
      // Land on the top of the hour so batched sends cluster predictably.
      const aligned = new Date(candidate);
      aligned.setUTCMinutes(0, 0, 0);
      return aligned.toISOString();
    }
  }
  return null;
}

export function checkQuietHours(
  timeZone: string | undefined,
  instant: Date = new Date(),
): QuietHoursVerdict {
  if (!timeZone) return { status: "unknown-timezone" };

  const localHour = localHourIn(timeZone, instant);
  if (localHour === null) return { status: "unknown-timezone" };

  if (localHour >= QUIET_HOURS_START_HOUR && localHour < QUIET_HOURS_END_HOUR) {
    return { status: "allowed", localHour };
  }

  const sendAfter = nextOpenWindow(timeZone, instant);
  if (!sendAfter) return { status: "unknown-timezone" };

  return { status: "deferred", localHour, sendAfter };
}
