# unraj.org video launch checklist

Run top to bottom before the hero goes live. Every box is a yes/no.

## Content
- [ ] No frame resembles a living public figure (royals, politicians, celebrities). Historical figures are evoked, never captioned as portraits.
- [ ] No forged documents, fake institutional signage, or "official" letters appear in any clip.
- [ ] No text baked into the video; every date, carat weight, and claim lives in HTML with a source.
- [ ] Captions for clip 02 exist as `<track kind="captions">` VTT files for each `?lng=` the site serves.
- [ ] Tone is dignified: no violence, no weapons, no mocking imagery.
- [ ] AI disclosure line present directly under the hero.

## Performance
- [ ] Hero MP4 ≤ 1.5 MB, WebM ≤ 900 KB, poster ≤ 80 KB (`optimize.sh` prints sizes).
- [ ] Poster preloaded with `fetchpriority="high"`; video `preload="none"` (static) or `metadata` (React).
- [ ] Lighthouse mobile: Performance ≥ 90, LCP ≤ 2.5 s, CLS = 0, TBT ≤ 200 ms.
- [ ] Video does not load under `prefers-reduced-motion`, `Save-Data`, or 2G.
- [ ] Off-screen and hidden-tab pause verified.

## Accessibility
- [ ] Pause/play button keyboard-reachable with visible focus ring; `aria-pressed` updates.
- [ ] Text contrast over the scrim ≥ 4.5:1 body, ≥ 3:1 title, checked on the brightest frame.
- [ ] Nothing flashes more than 3 times per second.
- [ ] Heading announced first; media container is `aria-hidden`.

## Brand and consistency
- [ ] Same diamond reference used in clips 01, 02, 05, 06 so the stone looks identical.
- [ ] Indigo and gold palette matches the site's existing hero.
- [ ] Vertical cut (06) posted with `?utm_source=social&utm_medium=video` back to the declaration form.

## Legal housekeeping
- [ ] Generated on a plan that grants commercial rights (Higgsfield paid plan, Dreamina Pro, or API terms reviewed).
- [ ] Prompt, seed, and request JSON for each published clip archived in `out/`.
- [ ] Dated screenshot of the live page saved for the record.
