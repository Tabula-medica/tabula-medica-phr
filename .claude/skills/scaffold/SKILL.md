---
name: scaffold
description: Generate the full file and folder structure for a new project or module, with stubs that compile and a test placeholder. Use for /scaffold or SCAFFOLD, "set up a new module", "bootstrap X".
argument-hint: <project or module name and purpose>
---

# /scaffold

Target: $ARGUMENTS

1. Read `CLAUDE.md` and one existing module of the same kind to copy conventions (paths, naming, exports, tests).
2. Propose the tree in one block, then create it: every file has real, compiling content (types, exports, a route or component stub, a test file with one passing test).
3. Wire registration points the project requires (route lists, index exports, schema registries) and say which ones you touched.
4. Run typecheck, lint, and tests from `CLAUDE.md`. Everything must pass before you report.
5. Report the tree and the next three implementation steps.
