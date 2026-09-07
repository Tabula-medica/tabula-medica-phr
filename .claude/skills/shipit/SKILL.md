---
name: shipit
description: Take rough code to production-ready. Adds error handling, types, tests, and docs, then runs every project check before declaring done. Use for /shipit, "make this production ready", "harden this".
argument-hint: <file, directory, or "diff">
---

# /shipit

Target: $ARGUMENTS (default: uncommitted changes).

1. Read `CLAUDE.md` for conventions, commands, and non-negotiables.
2. Harden the target: input validation, error handling with useful messages, types with no `any`, no secrets or sensitive data in logs, idempotent side effects, timeouts on network calls.
3. Add or extend tests for the happy path, edge cases, and failure modes, following the project's existing test layout.
4. Update docs or comments only where behavior changed.
5. Run every command in the `CLAUDE.md` Commands section. Fix failures. Re-run until clean.
6. Report: what changed, what the checks returned, anything intentionally left out.

Do not widen scope beyond the target. Do not skip or weaken tests to get green.
