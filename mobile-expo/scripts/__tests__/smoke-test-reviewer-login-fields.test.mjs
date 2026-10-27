import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

// Fake curl avoids all network calls, real credentials, and production data.
// Exercise the actual shell assertions, not a rewritten version of them.
function smoke(mode) {
  const dir = mkdtempSync(join(tmpdir(), "reviewer-fields-"));
  try {
    writeFileSync(join(dir, "curl"), `#!/usr/bin/env bash
case "$*" in
  *api/auth/login*)
    case "$*" in
      *'{}'*)
        case "$MOCK_MODE" in
          missing-error) printf '{}\\n400' ;;
          wrong-error-status) printf '{"error":"Required"}\\n200' ;;
          *) printf '{"error":"Required"}\\n400' ;;
        esac ;;
      *)
        if [ "$MOCK_MODE" = "missing-refresh" ]; then
          printf '{"user":{"id":"fake-user"},"accessToken":"fake-access"}\\n200'
        else
          printf '{"user":{"id":"fake-user"},"accessToken":"fake-access","refreshToken":"fake-refresh"}\\n200'
        fi ;;
    esac ;;
  *api/auth/me*) printf '200' ;;
  *api/records*) printf '[{"id":"1"},{"id":"2"},{"id":"3"}]\\n200' ;;
  *api/data-sources*) printf '[{"id":"source"}]\\n200' ;;
  *) exit 99 ;;
esac
`, { mode: 0o755 });
    return spawnSync("bash", [resolve("scripts/smoke-test-reviewer-login.sh")], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        REVIEWER_EMAIL: "test@example.invalid",
        REVIEWER_PASSWORD: "fake-password",
        API_BASE: "https://unused.invalid",
        MOCK_MODE: mode,
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("smoke script accepts the complete login response", () => {
  const result = smoke("complete");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS.*received refreshToken/);
  assert.match(result.stdout, /PASS.*missing credentials returned 400 with error message/);
});

for (const [mode, diagnostic] of [
  ["missing-refresh", /FAIL.*no refreshToken/],
  ["missing-error", /FAIL.*missing credentials expected 400/],
  ["wrong-error-status", /FAIL.*missing credentials expected 400/],
]) {
  test(`smoke script rejects ${mode}`, () => {
    const result = smoke(mode);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, diagnostic);
  });
}
