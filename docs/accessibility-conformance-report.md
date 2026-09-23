# Accessibility Conformance Report — Tabula Medica

**Product:** Tabula Medica web application (`client/`), served by the Express
application in `server/`. The Capacitor iOS and Android shells render the same
client, so findings apply to all three.

**Standards evaluated against**

| Standard | Version | Level |
| --- | --- | --- |
| Web Content Accessibility Guidelines (WCAG) | 2.2 | A and AA |
| Revised Section 508 (36 CFR Part 1194, Appendices A–C) | 2017 ICT Refresh | Applicable provisions, which incorporate WCAG 2.0 AA by reference |
| EN 301 549 | V3.2.1 | Clauses 9, 11 (by reference to WCAG) |

**Report date:** 23 August 2026
**Evaluation method:** self-evaluation (see *Method and limits* below)
**Overall status:** **Partially Supports**

---

## Summary

Before this evaluation the client had no accessibility linting of any kind.
A first pass with `eslint-plugin-jsx-a11y` in strict mode over all 799 client
components reported **2,077 violations across 177 files**. All 2,077 have been
resolved, and the rule set now runs at error severity in CI, so a regression
fails the build.

| Rule | Before | After |
| --- | ---: | ---: |
| `label-has-associated-control` | 1,641 | 0 |
| `click-events-have-key-events` | 192 | 0 |
| `no-static-element-interactions` | 184 | 0 |
| `no-noninteractive-element-interactions` | 12 | 0 |
| `alt-text` | 14 | 0 |
| `anchor-has-content` / `anchor-is-valid` | 19 | 0 |
| `media-has-caption` | 4 | 0 (documented gaps, see below) |
| `no-autofocus` | 3 | 0 (documented decisions, see below) |
| `no-redundant-roles`, `role-supports-aria-props`, `heading-has-content` | 8 | 0 |
| **Total** | **2,077** | **0** |

Automated rules detect roughly a third of WCAG success criteria. The remaining
two thirds — meaningful alternative text, logical reading and focus order,
error recovery, colour contrast in context, and behaviour under a real screen
reader — require manual and assistive-technology testing that **has not yet
been performed**. The status above is *Partially Supports* for that reason,
not because a specific defect is known to remain.

---

## What changed

### Name, role and value for form controls (WCAG 1.3.1, 3.3.2, 4.1.2)

The largest single defect class. A visible caption sitting next to a control
with no programmatic association gives that control no accessible name: a
screen reader announced a Radix `SelectTrigger` as its current value alone,
with nothing to say which field it belonged to.

- 1,193 captions that name a control now carry `htmlFor`, and the control an
  `id`.
- 454 captions of read-only values became `<FieldCaption>`
  (`client/src/components/ui/field-caption.tsx`), a `<span>` styled identically
  to `<Label>`. A `<label>` that names no control makes assistive technology
  announce an empty form field that does not exist.
- 92 controls rendered inside `.map()` received an explicit `aria-label`. A
  static `id` there would repeat on every row, and every caption would point at
  the first row's control.

### Keyboard operability (WCAG 2.1.1, 4.1.2)

376 elements carried a click handler with no keyboard route to it. They fell
into distinct groups, and applying one blanket fix would have made several of
them worse:

- **148 sole activation paths** — the click was the only way to reach the
  action. These spread `clickable()` from `client/src/lib/a11y.ts`, which
  supplies a role, a tab stop, and Enter/Space activation, and ignores key
  events that bubbled out of a nested control.
- **42 duplicates and guards** — a row wrapping a checkbox that toggles the
  same state, an `onClick` that only calls `stopPropagation`, a modal scrim
  that dismisses the dialog. Keyboard users already reach these through the
  inner control, Escape, or the close button. They are marked
  `role="presentation"`; adding a second tab stop would have announced each row
  twice and mis-described it as a button.
- **10 structural elements** — nine `<li>` and one `<h3>` had their role
  overridden by a click handler. A `<ul>` whose children are buttons is no
  longer announced as a list, and a heading that becomes a button drops out of
  heading navigation. The control now sits *inside* the element instead.

### Dialogs

`voice-commands` and `keyboard-shortcuts-help` put `role="dialog"` and
`aria-modal` on the backdrop rather than the panel, so the announced dialog was
the scrim and the content was outside it. Both now carry dialog semantics on
the panel, with the scrim presentational. Escape and the close button were
already wired and remain the keyboard exits.

### Content on hover or focus (WCAG 1.4.13)

The clinical AI explainability tooltip and the public-health choropleth cells
revealed their content on `mouseenter` only, so keyboard and switch users never
saw the model's reasoning or a state's value. Both now reveal on focus as well,
the tooltip carries `role="tooltip"` with `aria-describedby`, and Escape
dismisses it without moving focus.

---

## Known gaps

These are open, and are the reason the overall status is *Partially Supports*.

| # | Criterion | Where | Status |
| --- | --- | --- | --- |
| 1 | **1.2.4 Captions (Live)** — AA | Telehealth video (`telehealth.tsx`, `video-room.tsx`, `clinician-video-room.tsx`) | **Does Not Support.** Live peer video carries no captions. Real-time captioning requires a transcription service on the media pipeline; it is not a client-side change. The three call sites are marked in code with this criterion. |
| 2 | **1.2.2 Captions (Prerecorded)** — A | Onboarding explainer clip (`data-source-onboarding.tsx`) | **Does Not Support.** The element currently points at a placeholder sample video. The production explainer must ship with a WebVTT caption track before launch. |
| 3 | **1.4.3 Contrast (Minimum)** — AA | Whole client | **Not evaluated.** Contrast depends on computed styles and layout, which the jsdom-based tests cannot measure. Needs a Lighthouse or axe run against the rendered application. |
| 4 | **2.4.3 Focus Order**, **1.3.2 Meaningful Sequence** | Whole client | **Not evaluated.** Requires manual keyboard traversal. |
| 5 | **1.1.1 Non-text Content** — A | Whole client | **Partially Supports.** Every image now has an `alt` attribute, but whether each one is *meaningful* is a human judgement no linter makes. |
| 6 | **4.1.3 Status Messages** — AA | Whole client | **Not evaluated.** `ScreenReaderAnnouncer` exists and is mounted; coverage of toasts, loading states and validation errors has not been audited. |
| 7 | Screen-reader behaviour | Whole client | **Not evaluated.** No testing with NVDA, JAWS, VoiceOver or TalkBack has been performed. |

### Deliberate decisions recorded in code

Three `autoFocus` attributes are kept, each on a surface whose only purpose is
the field being focused: the smart-search dialog, the provider-search picker,
and the shared-record PIN gate. Each is annotated at its call site with the
reasoning. WCAG does not prohibit `autofocus`; the lint rule is a heuristic,
and moving focus on these surfaces saves every user a step.

---

## Method and limits

**What was done**

- Static analysis: `eslint-plugin-jsx-a11y` strict rule set, at error severity,
  over `client/src/**/*.tsx`. Run by `npm run lint:a11y` and gated in CI.
- Unit tests: `axe-core` against the design-system primitives and the
  `clickable()` helper, evaluating the `wcag2a`, `wcag2aa`, `wcag21a`,
  `wcag21aa` and `wcag22aa` rule tags. Run by `npm run test:a11y`.
- Manual review of every site the linter could not decide safely — the
  duplicate-click wrappers, the dialog scrims, the drop zones, the media
  elements and the `autoFocus` attributes.

**What was not done**

- No testing with a screen reader, a switch device, voice control, or screen
  magnification.
- No colour-contrast measurement against the rendered application.
- No testing by people with disabilities.
- No third-party audit. This is a self-evaluation and is not a VPAT® signed by
  an accessibility consultancy. A VPAT for procurement should be commissioned
  once the gaps above are closed.

---

## Keeping it from regressing

- `npm run lint:a11y` — strict `jsx-a11y` over every client component, zero
  tolerance. A new violation fails the build.
- `npm run test:a11y` — axe-core assertions, including a regression test for
  the `<li role="button">` shape that strips list semantics.
- Both run on every push and pull request via `.github/workflows/ci.yml`.

Suppressions are permitted only with a comment naming the criterion and the
route by which the requirement is already met. Every suppression in the client
today is listed in *Known gaps* or *Deliberate decisions* above.

## Next steps, in priority order

1. Measure colour contrast against the rendered application (gap 3) and fix
   what fails; add a Lighthouse CI job so it stays fixed.
2. Commission screen-reader testing on the ten highest-traffic patient
   journeys: sign-up, connect a provider, timeline, a lab result, medications,
   sharing, caregiver switching, symptom checker, billing, settings.
3. Ship the production explainer video with its caption track (gap 2).
4. Scope live captioning for telehealth (gap 1) — the largest remaining item,
   and the one with a legal exposure of its own given the clinical context.
5. Audit `4.1.3 Status Messages` coverage across toasts, loading states and
   form validation (gap 6).
6. Commission a third-party audit and a signed VPAT once 1–5 are closed.

## Feedback

Accessibility problems can be reported to **accessibility@tabulamedica.health**.
The published statement at `/legal/accessibility` commits to acknowledging a
report within five business days.
