import * as React from "react"

import { cn } from "@/lib/utils"
import { labelVariants } from "@/components/ui/label"

/**
 * Caption for a **read-only** value (detail panels, summary cards, audit rows).
 *
 * Visually identical to `<Label>` — it reuses the same `labelVariants` — but
 * renders a `<span>` instead of a `<label>`.
 *
 * A `<label>` is a promise to assistive technology that a form control it
 * names exists. When one captions static text instead, screen readers
 * announce an empty form field, and the pairing fails WCAG 2.2 AA 1.3.1
 * (Info and Relationships) and 4.1.2 (Name, Role, Value). A `<span>` carries
 * no such promise: the caption and its value are read in document order, the
 * way sighted users read them.
 *
 * Use `<Label htmlFor="...">` whenever there *is* a control to name.
 */
const FieldCaption = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn(labelVariants(), className)} {...props} />
))
FieldCaption.displayName = "FieldCaption"

export { FieldCaption }
