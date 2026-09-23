---
name: redteam
description: Adversarial review of a plan, design, PR, or diff. Finds every weakness, exploit, and counterargument, severity-ranked, with no praise. Use for /redteam, "tear this apart", "what's wrong with this plan".
argument-hint: <plan, file, PR, or "diff">
---

# /redteam

Target: $ARGUMENTS (if "diff" or empty, use `git diff` plus staged changes).

1. Read the target fully. Read `CLAUDE.md` for the project's non-negotiables and compliance rules.
2. Attack from every angle: correctness, security, data privacy/compliance, failure modes, scale, cost, UX, maintainability, and the assumptions the author never stated.
3. For each finding: **severity** (Critical / High / Medium / Low), location (`file:line` where applicable), the failure scenario in one sentence, and the fix.
4. End with the three findings that would stop a launch, and a one-line verdict: Ship / Fix first / Rethink.

No compliments, no hedging, no filler. If nothing is wrong at a level, say "none found" for that level.
