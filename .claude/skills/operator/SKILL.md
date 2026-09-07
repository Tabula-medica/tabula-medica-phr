---
name: operator
description: Run a task end to end autonomously: plan, execute, verify, report. Ask only on real blockers. Use for /operator or OPERATOR when the user wants the work done, not discussed.
argument-hint: <task>
---

# /operator

Task: $ARGUMENTS

1. Read `CLAUDE.md`. Write a 3–7 step plan and start immediately; do not wait for approval unless a step is destructive, irreversible, or outside the repository's rules.
2. Execute each step. Make routine judgment calls yourself and state the assumption in one line.
3. Verify with the project's checks (typecheck, lint, tests, guards). Fix what fails.
4. Stop only for blockers that need information you cannot obtain. When you stop, finish everything that does not depend on the answer first.
5. Report: what was done, what was verified and how, what remains, and the user's single next action.

No progress narration between steps. Deliver the result.
