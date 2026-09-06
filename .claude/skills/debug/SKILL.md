---
name: debug
description: Find the root cause of a bug, explain what went wrong and why, fix it minimally, and add a regression test. Use for /debug, "why is this failing", "fix this error".
argument-hint: <error message, failing test, or symptom>
---

# /debug

Symptom: $ARGUMENTS

1. **Reproduce**: run the failing command or test from `CLAUDE.md`. Capture the exact output.
2. **Isolate**: trace from the symptom to the cause. Read the code path; do not guess. Add temporary logging only if needed and remove it after.
3. **Explain**: one paragraph on what went wrong and why it was possible.
4. **Fix** minimally in the code the bug lives in. No drive-by refactors.
5. **Regression test** that fails before the fix and passes after.
6. Re-run the full check suite from `CLAUDE.md`. Report the before and after output.
