/**
 * Shared Zod schema helpers that enforce sensible cardinality bounds on
 * collection types parsed from untrusted input.
 *
 * Background: CVE-2023-54404 — Zod accumulates one ZodIssue per failing
 * element in z.array / z.set / z.map / z.record, so an unbounded collection
 * in a request body schema can exhaust memory during validation.  Callers
 * that accept request-body arrays MUST use boundedArray (or an explicit
 * .max()) instead of bare z.array().
 */

import { z } from "zod";

/**
 * A z.array() pre-capped at `max` elements.  Validation stops before
 * accumulating thousands of per-element errors on an oversized payload.
 *
 * @param item  The element schema.
 * @param max   Maximum number of elements allowed (hard server-side cap).
 */
export function boundedArray<T extends z.ZodTypeAny>(item: T, max: number) {
  return z.array(item).max(max);
}

/**
 * Like boundedArray but also requires at least one element.
 */
export function nonEmptyBoundedArray<T extends z.ZodTypeAny>(
  item: T,
  max: number,
) {
  return z.array(item).min(1).max(max);
}
