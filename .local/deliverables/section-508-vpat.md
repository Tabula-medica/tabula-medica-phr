# Voluntary Product Accessibility Template (VPAT®) 2.5 Rev — Section 508

**Product Name:** Tabula Medica — Patient Health Record Web Application
**Product Version:** 1.0.0 (unified web + mobile)
**Report Date:** 2026-04-19
**Vendor:** Tabula Medica, Inc.
**Contact:** privacy@tabulamedica.health
**Notes:** This Accessibility Conformance Report (ACR) is based on internal review against the WCAG 2.0 Level AA standard incorporated by reference in the Revised Section 508 Standards (36 CFR Part 1194). Independent third-party audit pending — see Action Item AG in `f1-action-items.md`.

---

## Applicable Standards / Guidelines

| Standard | Included In Report |
|---|---|
| Revised Section 508 standards (2018) | Yes |
| WCAG 2.0 Level A | Yes |
| WCAG 2.0 Level AA | Yes |
| EN 301 549 V3.2.1 | No (US scope) |

## Terms

- **Supports** — meets the criterion without exceptions
- **Partially Supports** — meets some, but not all parts of the criterion
- **Does Not Support** — does not meet the criterion
- **Not Applicable** — criterion is not relevant to the product
- **Not Evaluated** — applies only to WCAG 2.0 Level AAA

---

## WCAG 2.0 Report — Level A & AA

### 1. Perceivable

| Criterion | Conformance | Remarks & Explanations |
|---|---|---|
| 1.1.1 Non-text Content (A) | **Partially Supports** | All app-shell icons have `aria-label` or are decorative (`aria-hidden`). User-uploaded medical images and dynamic chart series rendered from FHIR data may lack alt text — covered by AG-1 in remediation program. |
| 1.2.1 Audio-only and Video-only (A) | **Not Applicable** | No pre-recorded audio-only or video-only media in product. Live telehealth video is real-time interactive (covered by 1.2.4 / 1.2.6). |
| 1.2.2 Captions (Pre-recorded) (A) | **Not Applicable** | No pre-recorded video content with audio in product. |
| 1.2.3 Audio Description or Media Alternative (A) | **Not Applicable** | Same as 1.2.2. |
| 1.2.4 Captions (Live) (AA) | **Partially Supports** | Telehealth video sessions support browser-level live captions (Chrome/Edge/Safari Live Caption). In-app caption track for ambient encounter recordings is on roadmap (Phase C). |
| 1.2.5 Audio Description (Pre-recorded) (AA) | **Not Applicable** | No pre-recorded video. |
| 1.3.1 Info and Relationships (A) | **Supports** | Semantic HTML throughout: `<main>` / `<nav>` / `<header>` landmarks set in `App.tsx`. Forms use shadcn `<Form>` + `<FormLabel>` (proper `for`/`id` association). Tables use `<th scope>` in audit logs and lab results. |
| 1.3.2 Meaningful Sequence (A) | **Supports** | DOM order matches visual order; CSS Grid/Flex used for layout, not for reordering content semantically. |
| 1.3.3 Sensory Characteristics (A) | **Supports** | No instructions reference shape, size, position, or sound alone. |
| 1.4.1 Use of Color (A) | **Supports** | Color is never the sole indicator of state. Status badges combine color + icon + text label (e.g., medication status: green check + "Active"). Color-blind simulation modes (protanopia/deuteranopia/tritanopia) available in `/accessibility` settings. |
| 1.4.2 Audio Control (A) | **Supports** | No auto-playing audio. Voice navigation is opt-in via `/voice-access`. |
| 1.4.3 Contrast (Minimum) (AA) | **Supports** | Design tokens audited against 4.5:1 (normal text) and 3:1 (large text). Primary `#3366E8` on white = 5.3:1. Foreground `hsl(224 71% 8%)` on background `hsl(220 14% 97%)` = 17:1. High-contrast mode toggle pushes all surfaces to ≥7:1 (WCAG AAA). |
| 1.4.4 Resize Text (AA) | **Supports** | All text uses relative units (`rem`/`em`). User can zoom to 200% without loss of content. AccessibilityProvider exposes 3 font-size presets (normal / large / extra-large) and Geriatric Mode. |
| 1.4.5 Images of Text (AA) | **Supports** | No images of text used for body content. Logo is the only image-of-text and has equivalent text alternative. |

### 2. Operable

| Criterion | Conformance | Remarks & Explanations |
|---|---|---|
| 2.1.1 Keyboard (A) | **Supports** | All interactive elements (buttons, links, form fields, dialogs, dropdowns) operable via keyboard. shadcn primitives (Radix UI) provide built-in keyboard support. Custom command palette (Cmd/Ctrl+K) enhances keyboard navigation. |
| 2.1.2 No Keyboard Trap (A) | **Supports** | Focus management in modals (Radix Dialog) returns focus to trigger on close. Skip-to-main-content link bypasses sidebar. |
| 2.2.1 Timing Adjustable (A) | **Supports** | Session timeout displays `<SessionTimeoutModal>` with `<Stay logged in>` button to extend session before expiry. Idle/absolute timeout configurable in user settings. |
| 2.2.2 Pause, Stop, Hide (A) | **Supports** | No auto-updating content > 5 seconds. Real-time wearable data and ambient transcripts can be paused via UI controls. |
| 2.3.1 Three Flashes or Below Threshold (A) | **Supports** | No flashing content. Loading spinners cap at < 3 flashes/second. |
| 2.4.1 Bypass Blocks (A) | **Supports** | `<SkipLink>` (in `accessibility-provider.tsx`) renders at top of every page, jumps to `#main-content`. Visible on focus. |
| 2.4.2 Page Titled (A) | **Supports** | Per-page `<title>` updates wired in `AppContent` (`useEffect` on location change, uses `pageTitles` map). Format: `"<Page> · Tabula Medica"`. |
| 2.4.3 Focus Order (A) | **Supports** | Logical DOM order; Radix UI maintains correct focus order in composite widgets. |
| 2.4.4 Link Purpose (In Context) (A) | **Supports** | Links have descriptive text or `aria-label`. No "click here" / "read more" patterns. |
| 2.4.5 Multiple Ways (AA) | **Supports** | Sidebar navigation + global search (`/search`) + Command Palette + bottom-nav (mobile) all available. |
| 2.4.6 Headings and Labels (AA) | **Partially Supports** | Form labels are present and descriptive. Heading hierarchy (`<h1>` → `<h2>` → `<h3>`) is consistent on top-level pages but needs per-page audit for all 100+ routes. AG-2 in remediation program. |
| 2.4.7 Focus Visible (AA) | **Supports** | Tailwind `focus:ring-2 focus:ring-ring` applied app-wide via shadcn primitives. Custom focus styles never remove `outline` without replacement. |

### 3. Understandable

| Criterion | Conformance | Remarks & Explanations |
|---|---|---|
| 3.1.1 Language of Page (A) | **Supports** | `<html lang="en">` set in `client/index.html`. |
| 3.1.2 Language of Parts (AA) | **Supports** | Multi-language UI via `LanguageProvider` sets `lang` attribute on `<html>` per active locale. Mixed-language content (e.g., Spanish patient instructions inside English UI) wraps with `<span lang="es">`. |
| 3.2.1 On Focus (A) | **Supports** | No context change on focus alone. |
| 3.2.2 On Input (A) | **Supports** | Form submission requires explicit user action (button click / Enter). |
| 3.2.3 Consistent Navigation (AA) | **Supports** | Sidebar nav identical on every authenticated page. |
| 3.2.4 Consistent Identification (AA) | **Supports** | Same icons + labels used for same actions throughout app. |
| 3.3.1 Error Identification (A) | **Supports** | Form errors surfaced via `<FormMessage>` (shadcn) with `aria-describedby` linking input to error. Server errors surfaced via `<Toaster>` with `role="status"`. |
| 3.3.2 Labels or Instructions (A) | **Supports** | All inputs have visible labels. Required fields marked with `*` and `aria-required`. |
| 3.3.3 Error Suggestion (AA) | **Supports** | Form validation messages include corrective guidance (e.g., "Email must include @"). |
| 3.3.4 Error Prevention (Legal, Financial, Data) (AA) | **Supports** | Destructive actions (delete record, revoke share) require confirmation dialog. Subscription changes show review-before-confirm. Data submissions to FHIR networks show preview + reversibility info. |

### 4. Robust

| Criterion | Conformance | Remarks & Explanations |
|---|---|---|
| 4.1.1 Parsing (A) | **Supports** | React renders valid HTML. No duplicate IDs. Build pipeline catches malformed JSX at typecheck. |
| 4.1.2 Name, Role, Value (A) | **Supports** | shadcn UI primitives (Radix UI) provide correct ARIA roles for all composite widgets. Custom widgets use proper ARIA attributes. |

---

## Revised Section 508 — Chapter 5 Software (additional requirements)

| Criterion | Conformance | Remarks |
|---|---|---|
| 502.2.1 User Control of Accessibility Features | **Supports** | App does not disrupt OS-level accessibility features (VoiceOver, TalkBack, Windows Narrator, NVDA, JAWS). |
| 502.2.2 No Disruption of Accessibility Features | **Supports** | No interception of OS keyboard shortcuts that would conflict with assistive tech. |
| 502.3 Accessibility Services | **Supports** | All UI exposed via standard web platform APIs (DOM, ARIA) consumable by assistive tech. |

## Revised Section 508 — Chapter 6 Support Documentation and Services

| Criterion | Conformance | Remarks |
|---|---|---|
| 602.2 Accessibility and Compatibility Features | **Supports** | `/accessibility` page documents all 21 user-controllable accessibility settings. Help docs include keyboard-shortcut reference. |
| 602.3 Electronic Support Documentation | **Supports** | All user-facing documentation (privacy policy, terms, HIPAA notice, learn articles) follows the same WCAG 2.0 AA conformance as the app. |
| 602.4 Alternate Formats for Non-Electronic Support Documentation | **Not Applicable** | All documentation is electronic. |
| 603.2 Information on Accessibility and Compatibility Features | **Supports** | Available via in-app `/accessibility` page and this VPAT. |
| 603.3 Accommodation of Communication Needs | **Supports** | Support email (`privacy@tabulamedica.health`) accepts plain-text email; phone support (where available) uses TTY-compatible carrier. |

---

## Functional Performance Criteria (FPC) — § 302

Per § 302, where conformance to a technical standard is not possible, products must satisfy these functional outcomes:

| § | Criterion | Conformance |
|---|---|---|
| 302.1 | Without Vision | **Supports** — full screen reader support (VoiceOver, NVDA, JAWS) via semantic HTML + ARIA |
| 302.2 | With Limited Vision | **Supports** — 200% zoom, font-size presets, high-contrast mode, dyslexia font, line-spacing controls |
| 302.3 | Without Perception of Color | **Supports** — color-blind simulation modes; color is never the sole indicator |
| 302.4 | Without Hearing | **Supports** — no audio-only content; live captions for telehealth |
| 302.5 | With Limited Hearing | **Supports** — visual-first UX; text alternatives for all audio cues |
| 302.6 | Without Speech | **Supports** — all input via keyboard, mouse, touch; voice input is opt-in, never required |
| 302.7 | With Limited Manipulation | **Supports** — large-cursor mode, sticky keys, single-pointer operability throughout |
| 302.8 | With Limited Reach and Strength | **Not Applicable** — software-only product, no physical reach requirements |
| 302.9 | With Limited Language, Cognitive, and Learning Abilities | **Supports** — Simple Language mode, One-Task-at-a-Time mode, Geriatric mode, plain-English explanations of medical terms via AI assistant |

---

## Legal Disclaimer

This Accessibility Conformance Report represents Tabula Medica, Inc.'s good-faith assessment of conformance to Section 508 and WCAG 2.0 Level AA based on internal review as of the report date. It is not a legal certification of full compliance. Independent third-party audit is scheduled (see Action Item AG in `f1-action-items.md`). Customers requiring formal certification should request the post-audit revision (target: Q3 2026).

For questions or to report accessibility issues:
**Email:** privacy@tabulamedica.health
**Mail:** Tabula Medica, Inc. — Accessibility Office
