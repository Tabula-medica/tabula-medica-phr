---
name: ui-competitors
description: Check competitor UIs, compare them with ours, and apply the worthwhile improvements. Use for /ui-competitors, "what do competitors do for X screen", UI/UX gap analysis, or redesign inspiration for any app screen.
argument-hint: <screen or flow> [competitor URLs]
---

# /ui-competitors

Input: $ARGUMENTS

Rules (project rules win):
- Only public, logged-out competitor pages. Never log in, create accounts, or scrape behind auth.
- Never use real PHI in any screenshot, prompt, or query. Our screens are inspected with synthetic or empty data only.
- No claims of SOC 2 or HITRUST in copy, even if a competitor makes them; "aligned with" at most.
- New user-facing strings go through `client/src/components/language-provider.tsx`, never hardcoded.
- New public pages must be added to the public route lists in `client/src/App.tsx`.

Steps:
1. **Scope.** Name the screen or flow. If no competitors are given, pick 3-5 direct ones by search (Firecrawl), noting why each is relevant.
2. **Collect.** Per competitor, scrape the public page (Firecrawl `markdown` plus `screenshot`) and note: layout, information hierarchy, primary CTA, onboarding steps, accessibility signals, copy tone, trust signals.
3. **Inspect ours.** Read the matching components under `client/src/`. Screenshot with Playwright (`npx playwright`) against the dev server using synthetic data.
4. **Gap table.** Rows = pattern, columns = us / each competitor / verdict (adopt, adapt, skip) with one-line reason. Mark anything inferred, not seen, as an estimate.
5. **Pick.** Choose at most the top 3 changes by impact over effort. Do not copy layouts, copy, or assets verbatim; adapt the pattern.
6. **Apply.** Implement the chosen changes with minimal diffs, matching existing components and the design system. Use Context7 for current library APIs.
7. **Verify.** Run `npm run lint:a11y`, `npm run test:a11y`, `npm test`, and `bash scripts/phi-ai-guard.sh`; re-screenshot to confirm. Report pre-existing failures separately from yours.
8. **Report.** Gap table, what was applied (files), what was skipped and why, sources (URLs, date checked).
