/**
 * One clinic-staff guard, defined once.
 *
 * This exists because the same defect was found three times on the same pull
 * request. Engagement `/send` and `/consent` were gated on `isAuthenticated`
 * — which admits any signed-in patient account — and fixed. Then the HCC,
 * RVU, NPPES and referral routes turned out to have exactly the same guard,
 * because the fix was applied to the routes that were reported rather than to
 * the class of route they belonged to.
 *
 * `isAuthenticated` answers "is somebody signed in". Almost every route in
 * this repo is a patient acting on their own record, and for those it is the
 * right question. A clinician tool is a different shape: it acts *on* a
 * patient rather than *for* the caller, and it must ask a different question.
 * Sharing the wrapper is what stops the next one from being written with the
 * wrong one.
 *
 * The predicate itself is `isClinicStaff` in `services/engagement/inbound-auth.ts`,
 * kept separate so it is unit-testable without an express request.
 *
 * ## What this is NOT
 *
 * A role check is not a treatment-relationship check. It says the caller is
 * clinic staff; it says nothing about whether *this* member of staff has any
 * business with *that* patient. For a route that takes caller-supplied
 * clinical content in the body, the role is the right boundary — there is no
 * other patient's record being opened. For a route that loads a patient by id,
 * it is not sufficient, and this middleware must not be mistaken for enough.
 * See the clinic-initiated mint path in `health-summary-share-routes.ts`,
 * which refuses outright for exactly that reason.
 */

import type { NextFunction, Request, Response } from "express";
import { isClinicStaff } from "../../services/engagement/inbound-auth";

export interface CallerIdentity {
  userId?: string;
  role?: string;
  isProvider?: boolean;
}

/** Pull the caller out of whichever auth shape populated the request. */
export function callerFrom(req: Request): CallerIdentity {
  const session = req.session as any;
  return {
    userId: session?.userId || (req.user as any)?.id || (req.user as any)?.claims?.sub,
    role: session?.role,
    isProvider: session?.isProvider,
  };
}

/**
 * Reject anyone who is not clinic staff.
 *
 * `detail` is written for the person reading the 403 in a console, so it says
 * why the route is restricted rather than restating the status code.
 */
export function requireClinicStaff(tool: string) {
  return function guard(req: Request, res: Response, next: NextFunction) {
    const caller = callerFrom(req);

    if (!caller.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!isClinicStaff(caller)) {
      return res.status(403).json({
        error: "Clinic staff role required",
        detail:
          `${tool} is a clinician tool: it acts on a patient rather than for the caller, ` +
          "so a signed-in patient account is not the right authority for it.",
      });
    }

    next();
  };
}
