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
- Reviews are research, not content: public review pages and official public feeds only, copied by hand into a CSV, verbatim and linked. No scraping libraries against sites whose terms forbid it, no invented quotes or counts, and never reuse a reviewer's words in our copy.

Tools (stdlib Python, run with `python3 -I`, adapted from replica-skill, MIT; see `THIRD_PARTY_NOTICES.md`). Keep working CSVs in the scratchpad, not the repo. Templates: `tools/*.example.csv`.
- `tools/reviews.py` ranks public competitor reviews into what users hate and ask for. It drops rows without a link and withholds rows containing personal identifiers.
- `tools/gap.py` scores the gap matrix and picks the top changes.

Steps:
1. **Scope.** Name the screen or flow. If no competitors are given, pick 3-5 direct ones by search (Firecrawl), noting why each is relevant.
2. **Collect.** Per competitor, scrape the public page (Firecrawl `markdown` plus `screenshot`) and note: layout, information hierarchy, primary CTA, onboarding steps, accessibility signals, copy tone, trust signals.
   Then mine what their users say: aim for 30+ public reviews across 2+ sources per competitor (App Store RSS, Google Play listing, Trustpilot or G2, Reddit, Hacker News). Fill `competitor,source,url,date,rating,text` and run `python3 -I .claude/skills/ui-competitors/tools/reviews.py <reviews.csv> --out <feedback.md>`. Treat "thin" themes and samples under 30 as direction only, and read the "Read these by hand" list yourself.
3. **Inspect ours.** Read the matching components under `client/src/`. Screenshot with Playwright (`npx playwright`) against the dev server using synthetic data.
4. **Gap table.** Rows = pattern, columns = us / each competitor / verdict (adopt, adapt, skip) with one-line reason. Mark anything inferred, not seen, as an estimate. Write it as `gap.csv` (columns in `tools/gap.example.csv`; use `?` for a competitor cell not seen, `evidence=estimate` for anything inferred) and run `python3 -I .claude/skills/ui-competitors/tools/gap.py <gap.csv>`. It prints the table, a parity score (how much of what most competitors offer we already cover), and flags missing evidence or skip reasons. Add rows from the top "what they hate" and "what they ask for" review themes.
5. **Pick.** Choose at most the top 3 changes by impact over effort; `gap.py` ranks adopt/adapt rows by impact x competitor coverage / effort, with seen evidence ahead of estimates on ties. Override its order only with a stated reason. Do not copy layouts, copy, or assets verbatim; adapt the pattern.
6. **Apply.** Implement the chosen changes with minimal diffs, matching existing components and the design system. Use Context7 for current library APIs.
7. **Verify.** Run `npm run lint:a11y`, `npm run test:a11y`, `npm test`, and `bash scripts/phi-ai-guard.sh`; re-screenshot to confirm. Report pre-existing failures separately from yours.
8. **Report.** Gap table and parity score, review sample size and top themes (with linked quotes only), what was applied (files), what was skipped and why, sources (URLs, date checked).
