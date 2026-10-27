import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../smoke-test-reviewer-login.sh', import.meta.url));
const records = JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]);
const sources = JSON.stringify([{ id: 'source' }]);

// Export a fake curl function so the actual script runs without network or secrets.
function run(overrides = {}) {
  return spawnSync('bash', ['-c', `
    curl() {
      case "$*" in
        */api/auth/login*)
          case "$*" in
            *'{}'*) printf '%s\\n400' '{"error":"Email and password are required"}' ;;
            *) printf '%s\\n200' '{"accessToken":"fake","refreshToken":"fake-refresh","user":{"id":"fake"}}' ;;
          esac ;;
        */api/auth/me*) printf '200' ;;
        */api/records*) printf '%s\\n%s' "$RECORDS_BODY" "$RECORDS_CODE" ;;
        */api/data-sources*) printf '%s\\n%s' "$DS_BODY" "$DS_CODE" ;;
        *) return 1 ;;
      esac
    }
    export -f curl
    bash "$1"
  `, 'reviewer-smoke-test', script], {
    encoding: 'utf8',
    timeout: 5000,
    env: {
      PATH: process.env.PATH,
      REVIEWER_EMAIL: 'fake@example.invalid',
      REVIEWER_PASSWORD: 'fake',
      API_BASE: 'https://example.invalid',
      RECORDS_BODY: records,
      RECORDS_CODE: '200',
      DS_BODY: sources,
      DS_CODE: '200',
      ...overrides,
    },
  });
}

test('reviewer smoke accepts seeded arrays with HTTP 200', () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /3 health records present/);
  assert.match(result.stdout, /1 data source\(s\) present/);
});

for (const [prefix, label] of [['RECORDS', 'records'], ['DS', 'data sources']]) {
  for (const code of ['401', '404', '500', '000']) {
    test(`${label}: HTTP ${code} fails even with enough IDs`, () => {
      const result = run({ [`${prefix}_CODE`]: code });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, new RegExp(`FAIL  ${label} returned ${code}`));
    });
  }

  for (const body of [
    '{"error":{"id":"1"},"trace":[{"id":"2"},{"id":"3"}]}',
    '<html>error</html>',
    '',
    'null',
    '[{"id":"1"}',
    '[{}, {}, {}]',
    '[{"id":null},{"id":null},{"id":null}]',
    '["id", "id", "id"]',
    `${records}\n${records}`,
  ]) {
    test(`${label}: invalid array payload fails (${JSON.stringify(body)})`, () => {
      const result = run({ [`${prefix}_BODY`]: body });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /FAIL .*not a valid JSON array/);
    });
  }

  test(`${label}: empty arrays fail the seed minimum`, () => {
    const result = run({ [`${prefix}_BODY`]: '[]' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /demo seed may have failed/);
  });
}

test('nested IDs cannot make two records satisfy the three-record minimum', () => {
  const result = run({
    RECORDS_BODY: '[{"id":"1","nested":{"id":"2"}},{"id":"3"}]',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /only 2 records/);
});
