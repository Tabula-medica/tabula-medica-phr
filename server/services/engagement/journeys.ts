/**
 * Engagement journeys — when to reach out, relative to an event.
 *
 * A journey is a list of offsets from an anchor. Keeping it declarative means
 * the schedule can be read and argued about without reading the sender, and
 * a practice can see the whole cadence a patient will experience on one
 * screen rather than inferring it from six cron entries.
 *
 * The cadences below are deliberately restrained. Published no-show research
 * consistently finds most of the benefit in the first reminder, with sharply
 * diminishing returns after the second; a third and fourth mostly buy opt-outs.
 * So appointment reminders are two touches, not four.
 */

import type { EngagementPurpose } from "@shared/engagement";

export type JourneyAnchor = "appointment-start" | "visit-end" | "last-visit";

export interface JourneyStep {
  templateId: string;
  purpose: EngagementPurpose;
  /**
   * Hours relative to the anchor. Negative is before.
   * -168 = one week before; +24 = one day after.
   */
  offsetHours: number;
  /** Skipped when the patient already acted — e.g. confirmed the appointment. */
  skipIf?: "already-confirmed" | "visit-cancelled";
}

export interface Journey {
  id: string;
  name: string;
  anchor: JourneyAnchor;
  steps: readonly JourneyStep[];
  /** Plain-language note on why the cadence is what it is. */
  rationale: string;
}

export const JOURNEYS: readonly Journey[] = [
  {
    id: "appointment-reminders",
    name: "Appointment reminders",
    anchor: "appointment-start",
    rationale:
      "Two touches. The first at one week gives enough runway to reschedule rather than " +
      "no-show; the second at one day is the one that actually moves attendance. A third " +
      "reminder buys almost no additional attendance and measurably more opt-outs.",
    steps: [
      { templateId: "appointment-reminder", purpose: "appointment-reminder", offsetHours: -168, skipIf: "visit-cancelled" },
      { templateId: "appointment-reminder", purpose: "appointment-reminder", offsetHours: -24, skipIf: "already-confirmed" },
    ],
  },
  {
    id: "pre-visit-prep",
    name: "Pre-visit preparation",
    anchor: "appointment-start",
    rationale:
      "One touch, 48 hours out — late enough to be remembered, early enough to act on " +
      "if the visit requires fasting or a held medication. The instructions themselves " +
      "stay behind the portal login; the text only says there are some.",
    steps: [
      { templateId: "pre-visit-preparation", purpose: "pre-visit-preparation", offsetHours: -48, skipIf: "visit-cancelled" },
    ],
  },
  {
    id: "post-visit-followup",
    name: "Post-visit follow-up",
    anchor: "visit-end",
    rationale:
      "One touch the next day, while the visit is still fresh and before the care " +
      "instructions have been forgotten or lost.",
    steps: [
      { templateId: "post-visit-followup", purpose: "post-visit-followup", offsetHours: 24 },
    ],
  },
  {
    id: "care-plan-checkins",
    name: "Care plan check-ins",
    anchor: "visit-end",
    rationale:
      "Two check-ins over the first month after a plan change — the window where " +
      "adherence is decided and where a problem is still cheap to fix.",
    steps: [
      { templateId: "care-plan-checkin", purpose: "care-plan-checkin", offsetHours: 24 * 7 },
      { templateId: "care-plan-checkin", purpose: "care-plan-checkin", offsetHours: 24 * 30 },
    ],
  },
  {
    id: "recall-reactivation",
    name: "Recall / reactivation",
    anchor: "last-visit",
    rationale:
      "A single touch at one year. Reactivation campaigns are where patient messaging " +
      "most often tips from service into marketing, so this is one message, no clinical " +
      "content, and no follow-up if it goes unanswered.",
    steps: [
      { templateId: "recall-reactivation", purpose: "recall-reactivation", offsetHours: 24 * 365 },
    ],
  },
];

export function findJourney(id: string): Journey | null {
  return JOURNEYS.find((j) => j.id === id) ?? null;
}

export interface PlannedTouch {
  journeyId: string;
  templateId: string;
  purpose: EngagementPurpose;
  /** ISO-8601 instant this touch is due. */
  dueAt: string;
  skipIf?: JourneyStep["skipIf"];
}

/**
 * Expand a journey against one anchor instant.
 *
 * Touches whose due time has already passed are dropped rather than fired
 * late: a "reminder" for an appointment that starts in 20 minutes, delivered
 * because a job backed up, is worse than silence.
 */
export function planJourney(
  journeyId: string,
  anchorInstant: string,
  now: Date = new Date(),
): PlannedTouch[] {
  const journey = findJourney(journeyId);
  if (!journey) return [];

  const anchor = Date.parse(anchorInstant);
  if (Number.isNaN(anchor)) return [];

  return journey.steps
    .map((step) => ({
      journeyId: journey.id,
      templateId: step.templateId,
      purpose: step.purpose,
      dueAt: new Date(anchor + step.offsetHours * 3_600_000).toISOString(),
      skipIf: step.skipIf,
    }))
    .filter((touch) => Date.parse(touch.dueAt) > now.getTime())
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}
