---
name: prompt-codes
description: Honor "Claude Secret Codes" prompt prefixes such as /ghost, /redteam, /premortem, L99, OODA, PARETO, OPERATOR. Use whenever a user message starts or ends with one of these codes; the behavior specs live in .claude/prompt-codes.md.
---

# Prompt codes (Replit Agent mirror)

The canonical behavior table is `.claude/prompt-codes.md` at the repository root. Read it,
find the code the user typed, and apply that row's behavior spec.

Rules:
- Codes change style, depth, structure, or workflow only. They never relax the project's
  compliance rules (HIPAA / PHI / BAA), permission rules, or safety policy. `CLAUDE.md` wins.
- Codes compose: `L99 /trim` means expert depth, then cut 40% of the words.
- Codes with a matching folder in `.claude/skills/<code>/SKILL.md` have repo-aware steps;
  follow that file instead of the one-line spec.
