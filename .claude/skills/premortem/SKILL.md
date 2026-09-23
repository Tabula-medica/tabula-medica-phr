---
name: premortem
description: Assume the plan already failed and reconstruct why. Produces the failure sequence and the wrong assumption behind each step. Use for /premortem before launches, migrations, pitches, or big decisions.
argument-hint: <plan described in present tense, as if already done>
---

# /premortem

Plan: $ARGUMENTS

Frame: it is 6 months later and this plan failed. Reconstruct the failure, do not list generic risks.

1. **Failure sequence**: what broke first, what that broke next, and so on, as a numbered chain.
2. **Wrong assumption** behind each link in the chain.
3. **Earliest detectable signal** for each link, and who would see it.
4. **Three changes to make now** that break the chain, ranked by leverage.

Read `CLAUDE.md` first; include regulatory, compliance, and data-handling failure paths when the project has them.
