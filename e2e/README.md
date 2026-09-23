# End-to-end tests

Playwright tests that exercise auth boundaries and PHI-access-control
behavior against a real running instance of the app — no mocks.

## Running

You need:

- A disposable Postgres database with the schema pushed (`npm run db:push`).
- The app running (or let Playwright start it for you) with `DATABASE_URL`
  and `SESSION_SECRET` set.

Against an already-running dev server (fastest for local iteration):

```
DATABASE_URL=postgresql://... \
SESSION_SECRET=... \
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
  npx playwright test
```

Letting Playwright boot the server itself (used in CI — see `webServer` in
`playwright.config.ts`):

```
DATABASE_URL=postgresql://... \
SESSION_SECRET=... \
  npx playwright test
```

## Why there's no login flow in these tests

The app's real patient-facing login is GCIP (Google Identity Platform) via a
popup — there's no password/OTP form to drive with Playwright, and scripting
a real Google identity popup isn't practical in CI. Instead,
`e2e/fixtures/session.ts` writes a session row directly into the same
Postgres-backed store `connect-pg-simple` uses and hands the browser a
correctly-signed `connect.sid` cookie for it. This exercises the real
`isAuthenticated` session-cookie code path — the only thing bypassed is the
GCIP popup itself. `e2e/fixtures/auth-fixtures.ts` wraps this in an
`authenticatedPage` fixture; import `test`/`expect` from there (not from
`@playwright/test`) to get it.

If `verify-session-fixture.spec.ts` fails, fix that first — every other
authenticated test's failure is suspect until that one passes.

## Known gaps

- **Clinician chart pre-fill** (`longevity-preventive-panel.spec.ts`, the
  "chart pre-fill" describe block) is currently `test.skip`'d. Exercising it
  needs a clinician-role session (the chart's patient-lookup route is gated
  by a `records:read` permission our plain patient-auth session fixture
  doesn't have) plus a seeded demo patient with demographics already on it.
  Neither exists in this test environment yet.
