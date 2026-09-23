---
name: refactor
description: Clean up code structure and readability without changing behavior. Tests stay green, no feature changes. Use for /refactor or REFACTOR, "clean this up", "simplify this module".
argument-hint: <file or directory>
---

# /refactor

Target: $ARGUMENTS

1. Run the project's tests first (`CLAUDE.md` Commands) and record the baseline.
2. Identify: duplication, long functions, unclear names, dead code, tangled dependencies, missing types.
3. Refactor in small, behavior-preserving steps. Prefer the project's existing patterns over new abstractions. Three similar lines beat a premature helper.
4. Re-run tests, typecheck, and lint after each step. Stop and revert if behavior changes.
5. Report each change and why, plus anything you chose not to touch.
