---
name: testit
description: Write tests for code so it is proven to work. Unit first, then integration; covers happy path, edge cases, and failure modes, then runs them. Use for /testit, "add tests", "cover this".
argument-hint: <file, function, or module>
---

# /testit

Target: $ARGUMENTS

1. Read the target and its callers. Read `CLAUDE.md` for the test runner and layout; mirror an existing test file's style and location.
2. Enumerate behaviors: happy path, boundaries, invalid input, error paths, concurrency or ordering where relevant.
3. Write unit tests first, then integration tests where the unit does I/O. Use real fixtures over mocks when cheap.
4. Run the test command from `CLAUDE.md`. Fix test bugs, not production code, unless a real defect is found; report defects separately.
5. Report coverage of the enumerated behaviors and anything untestable and why.
