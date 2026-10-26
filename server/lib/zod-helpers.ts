/**
 * Shared Zod schema helpers that enforce sensible cardinality bounds on
 * collection types parsed from untrusted input.
 *
 * Background: CVE-2023-54404 — Zod accumulates one ZodIssue per failing
 * element in z.array / z.set / z.map / z.record, so an unbounded collection
 * in a request body schema can exhaust memory during validation.  Callers
 * that accept request-body arrays MUST use boundedArray instead of bare
 * z.array() — a naked .max() does NOT stop Zod 3 from walking every element.
 */

import { z } from "zod";

/**
 * A z.array() pre-capped at `max` elements. Validation stops before
 * accumulating one ZodIssue per failing element on an oversized payload.
 *
 * Zod 3 walks every element even after .max() fails (CVE-2023-54404). The
 * superRefine length-check runs first; if the array is over cap it adds a
 * single too_big issue and ZodPipeline short-circuits without running the
 * element-level schema.
 *
 * @param item  The element schema.
 * @param max   Maximum number of elements allowed (hard server-side cap).
 */
export function boundedArray<T extends z.ZodTypeAny>(item: T, max: number) {
  const withinCap = z.any().superRefine((val, ctx) => {
    if (Array.isArray(val) && val.length > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: max,
        type: "array",
        inclusive: true,
      });
    }
  });
  return withinCap.pipe(z.array(item));
}

/**
 * Like boundedArray but also requires at least one element.
 */
export function nonEmptyBoundedArray<T extends z.ZodTypeAny>(
  item: T,
  max: number,
) {
  return boundedArray(item, max).refine(
    (arr) => (arr as unknown[]).length >= 1,
    { message: "Array must contain at least 1 element(s)" },
  );
}
