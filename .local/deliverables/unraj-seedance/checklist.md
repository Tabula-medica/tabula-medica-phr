# unraj.org video launch checklist

Run top to bottom before the hero goes live. Every box is a yes/no.

## Content
- [ ] The only real person in any clip is Dr. Aggarwal. No patient likeness, staff, or public figures.
- [ ] No PHI was uploaded as a reference (headshot, logo, voice sample, app screenshot without real data only).
- [ ] No text baked into the video; all copy lives in HTML so it can be edited and translated.
- [ ] Captions on clip 02 (founder intro) match the spoken words exactly; `<track kind="captions">` VTT attached.
- [ ] Uninsurance-related clip (04) and its caption never use the word "insurance". Caption reads "Membership for care access. Not insurance."
- [ ] No outcome or superiority claims anywhere on the page ("best", "guaranteed", "cures").
- [ ] AI disclosure line present in the footer or directly under the hero.

## Performance
- [ ] Hero MP4 ≤ 1.5 MB, WebM ≤ 900 KB, poster ≤ 80 KB (`optimize.sh` prints sizes).
- [ ] Poster is preloaded with `fetchpriority="high"`; video is `preload="none"` (static) or `metadata` (React).
- [ ] Lighthouse mobile: Performance ≥ 90, LCP ≤ 2.5 s, CLS = 0, TBT ≤ 200 ms.
- [ ] Video does not load when `prefers-reduced-motion`, `Save-Data`, or 2G is detected (test in DevTools).
- [ ] Off-screen and hidden-tab pause verified.

## Accessibility
- [ ] Pause/play button reachable by keyboard with visible focus ring; `aria-pressed` updates.
- [ ] Text contrast over the scrim ≥ 4.5:1 for body, ≥ 3:1 for the 3.5rem title (check darkest and brightest frames).
- [ ] Nothing flashes more than 3 times per second.
- [ ] Screen reader announces the heading first; media container is `aria-hidden`.

## Brand and consistency
- [ ] Palette matches the Tabula Medica family (navy #0c1a3a, teal, sky, indigo accent, blue CTA).
- [ ] Same seed family used across clips 01, 03, 06 so lighting and grain match.
- [ ] Vertical cut (06) posted with a link back to unraj.org and UTM `?utm_source=social&utm_medium=video`.

## Legal housekeeping
- [ ] Generated on a plan that grants commercial rights (Dreamina Pro or API terms reviewed).
- [ ] Prompt, seed, and request JSON for each published clip archived in `out/` (provenance).
- [ ] Screenshot of the live page with date saved to the claims-substantiation folder.
