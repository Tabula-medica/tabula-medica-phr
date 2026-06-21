# Audit Methodology Notes

**Source:** Pattern extracted from Session 6 accessibility audit
(`accessibility-audit-session-6.md`), filed at user direction as a
reusable principle for future audits.

**Scope:** Applies to ANY audit-class deliverable — security audits,
performance audits, compliance audits (HIPAA/SOC2/GDPR), UX audits,
dependency audits, accessibility audits, threat models, code reviews
of unfamiliar subsystems.

**NOT scope:** Routine bug investigation, single-feature
verification, or any work where the deliverable is a code change
rather than an assessment document.

---

## The four-point pattern

### 1. Acknowledge tooling gaps explicitly — do not work around them silently

When a planned methodology component is blocked (tooling unavailable,
auth gate, environment limitation, missing credentials, network
restriction), **surface the blocker as a first-class section of the
deliverable**, not as a footnote. Name the specific blocker. Name the
specific resolver (e.g. "Auth0 reviewer-test account from user" — not
"more tooling"). Estimate what the runtime-confirmation pass would add.

**Anti-pattern to avoid:** installing tooling that doesn't actually
unblock the audit just so the deliverable can claim "axe-core was
run." Installing axe-core doesn't get you past an auth gate. Running
axe-core on a login screen and reporting login-screen findings as
"site-wide audit results" is false thoroughness.

**Concrete from Session 6:** the deliverable opened with a methodology
table listing planned-vs-actual tooling and explaining each gap (Auth0
gate, no device emulator, no DevTools). The audit was clearly labeled
"static analysis with sandbox-runtime confirmation where possible" —
not "automated accessibility scan."

### 2. Choose leverage over coverage when they conflict

When you cannot deeply audit every target in scope, pick the audit
strategy that surfaces the highest-impact findings rather than the one
that achieves uniform shallow coverage.

**Heuristic:** read 2 routes deeply > shallow-grep 5 routes. App-wide
findings (e.g. a base component used everywhere) are higher-leverage
than route-specific findings.

**Anti-pattern to avoid:** padding a deliverable with one-line
boilerplate observations per file/route to look comprehensive. Empty
coverage breeds false confidence.

**Concrete from Session 6:** dashboard.tsx and appointments.tsx were
deep-read; the other 3 routes were sized and grep-checked for
specific high-signal patterns. The audit explicitly stated which
routes were deep-read vs abbreviated. The single highest-impact
finding (Button base component fails iOS HIG) came from one file
that affects all 5 routes equally — uniform coverage would have
duplicated this finding 5 times without adding signal.

### 3. Document confidence levels per finding

Each finding (or each cluster of findings) should carry an explicit
confidence indicator. Common levels:

- **High confidence** — derived deterministically from source code or
  declared configuration. No runtime confirmation needed before action.
- **Partial confidence** — pattern surfaced statically but severity
  cannot be measured without runtime tooling. Action requires
  runtime-confirmation step before scope estimate is reliable.
- **Not audited** — out of scope for this pass; explicitly carried to
  follow-up audit work.

**Anti-pattern to avoid:** writing every finding in the same
declarative tone, leaving the user to guess which findings are rock-
solid and which are speculative.

**Concrete from Session 6:** the deliverable closed with a "Confidence
statement" section that bucketed every finding into one of the three
levels above. Action Item U could then prioritize critical-path work
on high-confidence findings without waiting for runtime tooling.

### 4. Surface unexpected findings transparently — even when out of formal scope

If you discover something material that isn't in the audit's stated
scope, include it. Label it as out-of-scope so the reader can
decide whether to act. Hiding unexpected findings to keep the
deliverable "clean" is a disservice — the user has no other channel
to discover them.

**Anti-pattern to avoid:** keeping audits scope-pure by silently
dropping a discovered functional bug because "it's not an
accessibility issue." The user is paying for the eyes-on-the-code
session, not for taxonomic purity.

**Concrete from Session 6:** the broken `/health-dashboard` link on
dashboard.tsx:218 was a functional dead-link bug, not strictly an
accessibility violation. Including it (with explicit "(functional bug,
not a11y)" label) let the user catch a TestFlight Guideline 2.1 risk
that would otherwise have shipped. The user's reaction confirmed the
finding belonged in the audit's Top 5 — not split out into a separate
tracking system.

---

## When to apply this pattern

Use this checklist when planning ANY audit-class deliverable:

- [ ] **Pre-audit:** Are any planned tooling components blocked by
  environment limitations? If yes, name the blocker AND the resolver
  before starting. Decide whether the audit is still worth running
  with degraded methodology.
- [ ] **During audit:** Am I being pulled toward shallow uniform
  coverage when deeper scoped reads would produce better findings?
  If yes, switch strategy and document the choice in the deliverable.
- [ ] **During audit:** Am I noticing things that aren't in formal
  scope? Capture them in a scratch list. Filter at deliverable-write
  time, but default to inclusion-with-label rather than exclusion.
- [ ] **Deliverable structure:** Does each finding (or finding cluster)
  carry a confidence indicator? Is there a closing summary that
  buckets findings by confidence?
- [ ] **Deliverable structure:** Is there an explicit "what this audit
  IS / what this audit is NOT" framing near the top?
- [ ] **Action items:** Do the action items filed from this audit
  separate critical-path work (acts on high-confidence findings) from
  long-tail work (gated on runtime confirmation or follow-up audit
  passes)?

---

## Why this pattern matters

Audits are a class of deliverable particularly prone to **false
thoroughness** — documents that look comprehensive but surface none
of the real issues. Three failure modes:

1. **Tooling theater** — installing/running tools that produce output
   without actually exercising the system being audited (axe-core on
   an auth-gated app's login page; SAST scanner on a single helper
   file; perf profiler on a non-representative workload).
2. **Coverage padding** — listing N pages × M criteria = high finding
   count without prioritization, leaving the user to do the
   prioritization the audit was supposed to deliver.
3. **Scope rigidity** — refusing to surface material findings because
   they don't fit the audit's stated taxonomy (the dead-link case
   above).

The four-point pattern attacks all three: tooling theater (point 1),
coverage padding (point 2), and scope rigidity (point 4). Point 3
makes the resulting deliverable actionable rather than aspirational.

---

## Cross-reference

- **`accessibility-audit-session-6.md`** — exemplar deliverable that
  demonstrates this pattern end-to-end.
- **`f1-action-items.md` Action Item U** — exemplar action-item
  filing that operationalizes "critical-path vs long-tail" separation
  per the pattern.
- **`object-form-conversion-template.md`** — sibling reusable-pattern
  document (scoped to F1 logger conversion mechanics; this document is
  scoped to audit methodology — the two do not overlap).
