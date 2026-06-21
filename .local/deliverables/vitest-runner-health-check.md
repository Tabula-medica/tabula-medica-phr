# Vitest runner health check — Action Item V

**Filed:** 2026-04-20 (Session 7).
**Status:** ✅ COMPLETE — vitest runs cleanly out of the box.
**Time spent:** ~25 minutes (well under 2-hour timebox).
**Outcome:** Better than expected. No package upgrades, no config tweaks, no rabbit hole.

---

## TL;DR

Vitest 4.1.4 + Vite 7.3.0 are installed and **work end-to-end with no
intervention**. The project already has 3 spec files and 68 passing
tests. Added a 4th spec file (`tests/logger-smoke.spec.ts`, 4 tests)
exercising the canonical `server/lib/logger.ts` module's object-form
contract — runs in 759ms standalone, full suite passes 72/72 in 5.74s.

This unblocks:

1. **Action Item T (`tabula/no-string-form-logger` ESLint rule)** —
   warn → error flip is now safe; the enforced object-form pattern is
   demonstrably testable.
2. **Phase 1.1 of Care Access microservice build** — Vitest test
   scaffolding is the prerequisite called out in
   `unified-architecture-plan.md` §7 Phase 1.1. Foundation is laid.

---

## Investigation steps

### 1. Recon — what's installed, what's configured

| Component | Version / state | Notes |
|---|---|---|
| `vitest` | `^4.1.4` (in `package.json`) | Latest 4.x stable. |
| `vite` | `^7.3.0` (in `package.json`) | Latest 7.x. No upgrade needed. |
| `node_modules/.bin/vitest` | Present (symlink to `../vitest/vitest.mjs`) | Binary resolves. |
| `vitest.config.ts` | Present at repo root | `include: ["tests/**/*.{spec,test}.ts"]`, `environment: "node"`, `globals: false`, `@shared` alias. |
| `tests/` directory | Exists with 3 spec files | `audit-action-validator.spec.ts`, `logger-redact.spec.ts`, `phi-storage.spec.ts`. |
| `"test"` script in `package.json` | ❌ **ABSENT** | See "Known gap" below. |

### 2. Direct run — `npx vitest run --reporter=verbose`

Result: **68/68 tests passed in 6.56s** across the 3 existing spec
files. Zero warnings, zero deprecations, zero module-resolution
errors. Vite-module-runner concerns from prior planning notes did
not manifest.

### 3. Smoke test — `tests/logger-smoke.spec.ts`

Per the directive's success-path instructions, wrote a single new
spec file with 4 tests that:

1. Verify `server/lib/logger.ts` exports a working root logger with
   `.info` / `.warn` / `.error` / `.debug` methods.
2. Verify `getLogger("component-name")` returns a child logger
   distinct from the root.
3. Verify the **object-form call pattern** (the one enforced by the
   `tabula/no-string-form-logger` ESLint rule) executes without
   throwing for `info`, `warn`, and `error` shapes — including the
   `{ err }` convention for errors.
4. Verify the child logger from `getLogger()` accepts the same
   object-form pattern.

Result: **4/4 tests pass in 759ms standalone.** Full suite re-run
after addition: **72/72 pass in 5.74s.** No regressions.

---

## Findings

### Finding 1 — Vitest is fully operational

No work needed. The harness is ready for any new spec file. Both the
`@shared` path alias and `node:` builtin imports resolve correctly.
Top-level `await import` inside spec files works (verified by the
existing `phi-storage.spec.ts` which exercises the encryption
service).

### Finding 2 — No `"test"` script in `package.json`

The fullstack-js skill rule prohibits direct edits to `package.json`.
Current invocation requires `npx vitest run` rather than `npm test`.
This is functionally equivalent for local + CI use but creates a
small friction:

- **Local:** any contributor must know to run `npx vitest run` (or
  `npx vitest` for watch mode) instead of the conventional `npm test`.
- **CI:** the `.github/workflows/ci.yml` pipeline will need a step
  that calls `npx vitest run` directly rather than `npm test`.
  (Recommend filing as Action Item to update CI workflow once the
  user adds the script.)

**Recommendation:** ask user to add `"test": "vitest run"` to
`package.json` scripts at next opportunity. Listed as standing
follow-up, NOT blocking — V is complete without it.

### Finding 3 — PHI redaction is aggressive on `Error.message`

Surfaced incidentally during smoke test execution. When logging an
`Error` instance via the object-form `{ err }` convention:

```ts
logger.error({ err: new Error("smoke failure"), requestId: "smoke-3" }, "operation failed");
```

…the rendered output redacts `err.message` to `"[PHI_REDACTED]"`,
even though `"smoke failure"` is not PHI. The redact paths in
`server/lib/logger.ts` apparently match `*.message` or
`err.message` somewhere in the tree, treating ANY `.message` as
potentially PHI-bearing.

**Assessment:** defensible as a defense-in-depth default — error
messages CAN carry PHI when they include user input, SQL parameters,
or external API responses. The tradeoff is reduced debuggability of
genuinely non-PHI errors. The `err.stack` and `err.type` are
preserved, so root-cause analysis still works.

**Recommendation:** **leave the current behavior in place.** Do NOT
weaken redaction to enable cleaner non-PHI error messages — the cost
of a single PHI leak in production logs vastly outweighs the
debugging convenience. File as a documented behavior, not a defect.

### Finding 4 — Existing `tests/logger-redact.spec.ts` is high-quality reference material

The 16-test redact spec proves both the positive case (object-form
redacts) and the negative case (string-form leaks). It serves as the
canonical illustration of WHY the `tabula/no-string-form-logger`
ESLint rule exists. Future agents working on logger changes should
read this spec first.

---

## Test inventory (post-V)

| Spec file | Tests | Duration | Purpose |
|---|---|---|---|
| `tests/audit-action-validator.spec.ts` | 32 | ~5ms | Validates audit-action-code allowlist + PHI pattern rejection (email, SSN, DOB, phone, MRN, ZIP+4, name shapes). |
| `tests/logger-redact.spec.ts` | 16 | ~5ms | Proves pino redact engages on object-form, leaks on string-form. F1 Session 1 verification. |
| `tests/logger-smoke.spec.ts` | 4 | ~17ms | **NEW** — smoke tests for `server/lib/logger.ts` module exports + object-form contract. |
| `tests/phi-storage.spec.ts` | 20 | ~3.6s | End-to-end PHI encryption round-trips across 12 PHI tables, including jsonb envelopes, deterministic email hash, and backward-compat with plaintext rows. |
| **Total** | **72** | **5.74s** | |

---

## Phase 1.1 implications

The Care Access microservice scaffolding sub-phase
(`unified-architecture-plan.md` §7 Phase 1.1) called out a "Vitest
test scaffolding" deliverable gated on Action Item V. With V resolved:

- New spec files for Care Access endpoints can land in
  `tests/care-access/*.spec.ts` and will pick up automatically.
- The HMAC-SHA256 signature signing/verification logic for
  `CARE_BRIDGE_SECRET` should ship with paired spec coverage from
  day one, following the pattern of `tests/phi-storage.spec.ts`.
- The PHI-redaction middleware called out in Phase 1.1 should have a
  spec verifying that even forced-PHI test inputs come out
  redacted in the response stream.

---

## Follow-ups filed elsewhere

- **CI integration:** the project's `.github/workflows/ci.yml` should
  add a vitest step. Pending until user adds `"test"` script.
- **Action Item T promotion:** with vitest proven runnable, the
  `tabula/no-string-form-logger` ESLint rule is safe to flip from
  `warn` to `error` (its prerequisite is the ability to write logger
  spec tests, which is now demonstrated).

---

## Time budget

| Activity | Time |
|---|---|
| Recon (config, scripts, existing tests) | ~5 min |
| First vitest run (full suite) | ~2 min |
| Logger module recon | ~3 min |
| Smoke spec authoring | ~8 min |
| Smoke spec run + regression run | ~2 min |
| Findings documentation (this file) | ~5 min |
| **Total** | **~25 min** |

Well under the 2-hour timebox. No package modifications, no
PAUSE-and-report milestones triggered, no unexpected blockers.
