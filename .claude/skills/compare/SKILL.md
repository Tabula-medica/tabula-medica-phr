---
name: compare
description: Put two or more options side by side on the criteria that matter and name a clear winner for the stated use case. Use for /compare or COMPARE on libraries, vendors, architectures, plans.
argument-hint: <option A vs option B [vs C] for <use case>>
---

# /compare

Input: $ARGUMENTS

1. State the use case and the 5–7 criteria that decide it (cost, fit, risk, effort, compliance, maintenance, lock-in as relevant). Read `CLAUDE.md` for constraints that must be criteria.
2. Table: options as columns, criteria as rows, one short cell each, with a score.
3. **Winner** for this use case, in one sentence, and the single condition under which the runner-up would win instead.
4. Mark any cell that is an estimate rather than a verified fact.
