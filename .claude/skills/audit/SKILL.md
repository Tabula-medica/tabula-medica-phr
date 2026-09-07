---
name: audit
description: Review work and flag every issue with severity, location, and fix. For code, runs the project's lint, typecheck, tests, and compliance guards first. Use for /audit, "review this", "check my work".
argument-hint: <path, "diff", or description of the work>
---

# /audit

Target: $ARGUMENTS (default: uncommitted changes via `git status` and `git diff`).

1. Read `CLAUDE.md` and run every check listed in its Commands section (typecheck, lint, tests, guards). Report exact failures.
2. Read the target end to end. Flag every issue: **severity**, `file:line`, what is wrong, the fix.
3. Categories to cover: correctness, error handling, security and privacy, compliance rules from `CLAUDE.md`, tests missing, docs out of date, naming and dead code.
4. Output a table sorted by severity, then a short "Fix in this order" list.

Do not fix anything unless asked; this is a report.
