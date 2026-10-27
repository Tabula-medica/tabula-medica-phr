#!/usr/bin/env node
/**
 * Bash-level guard expansion tests for check-ios-google-client-id.sh and
 * check-android-google-client-id.sh.
 *
 * These scripts gate EAS production builds and share the same bash expansion
 * risks as smoke-test-reviewer-login.sh (covered by bash-guard-expansion.test.mjs).
 * Specifically:
 *
 *   BYPASS="${SKIP_IOS_GOOGLE_CLIENT_ID_CHECK:-}"
 *   CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-}"
 *
 * If `:-` is changed to `:?` or removed (leaving a bare `${VAR}` with set -u),
 * the script will crash instead of treating the variable as empty, silently
 * breaking CI in confusing ways.
 *
 * Regressions caught here that a JS-only test CANNOT catch:
 *   - `${SKIP_*_CHECK:-}` changed to `:?` → bash exits when var is unset,
 *     making the bypass flag unusable in environments that don't set it.
 *   - `${EXPO_PUBLIC_GOOGLE_*_CLIENT_ID:-}` changed to `:?` → build crashes
 *     before the is_placeholder check can produce a helpful error message.
 *   - CLIENT_ID assignment moved above the BYPASS assignment → doesn't affect
 *     logic here, but BYPASS is semantically the outer control variable and
 *     should remain first for readability and future guard ordering.
 *
 * Each subprocess test runs the actual script with a controlled minimal
 * environment via execFileAsync so there are no network calls, no EAS side effects,
 * and no leaked secrets.
 * Dedicated is_placeholder tests extract and execute each script's actual
 * function body in isolation, without running the build gate or its bypass.
 *
 * Run with: node scripts/__tests__/bash-guard-google-client-id.test.mjs
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const IOS_SCRIPT = join(ROOT, 'scripts', 'check-ios-google-client-id.sh');
const ANDROID_SCRIPT = join(ROOT, 'scripts', 'check-android-google-client-id.sh');

const IOS_LINES = readFileSync(IOS_SCRIPT, 'utf8').split('\n');
const ANDROID_LINES = readFileSync(ANDROID_SCRIPT, 'utf8').split('\n');

// ── Helpers ───────────────────────────────────────────────────────────────────

function findLine(lines, predicate, description, scriptPath) {
  const idx = lines.findIndex(predicate);
  if (idx === -1) {
    throw new Error(
      `bash-guard-google-client-id test setup: cannot locate ${description} in ${scriptPath}. ` +
      'Either the script was reorganised or this test file is out of sync — ' +
      'update the search predicate in scripts/__tests__/bash-guard-google-client-id.test.mjs.',
    );
  }
  return idx;
}

/**
 * Run a script file with a controlled minimal environment.
 *
 * @param {string}                scriptPath - absolute path to the bash script
 * @param {Record<string,string>} env        - environment vars (PATH added automatically)
 * @returns {Promise<{ status: number|null, stdout: string, stderr: string }>}
 */
async function runScript(scriptPath, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('bash', [scriptPath], {
      env: { PATH: '/usr/bin:/bin:/usr/local/bin', ...env },
      encoding: 'utf8',
      timeout: 5000,
    });
    return { status: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    return { status: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

/**
 * Extract the production function, not a JS reimplementation of its glob rules.
 * Fail explicitly if its definition is removed, duplicated, or reorganised.
 */
function extractIsPlaceholder(lines, scriptPath) {
  const definitions = [...lines.join('\n').matchAll(
    /^is_placeholder\(\)\s*\{[ \t]*\n[\s\S]*?^\}/gm,
  )];
  assert.equal(
    definitions.length,
    1,
    `Expected exactly one extractable is_placeholder() definition in ${scriptPath}; ` +
    'update the test extractor if the function layout changed.',
  );
  return definitions[0][0];
}

async function runIsPlaceholder(definition, value) {
  // Pass values as positional arguments: never expand/interpolate test data as
  // shell code. Print the function's status so exit 1 cannot hide a Bash crash.
  const { stdout, stderr } = await execFileAsync('bash', [
    '--noprofile', '--norc', '-euc',
    `${definition}\nif is_placeholder "$1"; then printf '0'; else printf '%s' "$?"; fi`,
    'is-placeholder-test', value,
  ], {
    env: { PATH: '/usr/bin:/bin:/usr/local/bin' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(stderr, '', 'is_placeholder() must not emit shell errors');
  return stdout;
}

// This is a prefix filter, NOT full OAuth client-ID validation. In particular,
// case, leading characters, and the underscore in EXPO_PUBLIC_ are significant.
// Invalid-but-non-placeholder strings below document that boundary; they are
// not examples of usable Google client IDs.
const PLACEHOLDER_VALUES = [
  '',
  '$EXPO_PUBLIC_',
  '${EXPO_PUBLIC_',
  '${EXPO_PUBLIC_}',
  '$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID}',
  '$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  '${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}',
  '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', // missing closing brace
  '${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  '$EXPO_PUBLIC_google_Ios_Client_Id', // suffix case does not matter
  '${EXPO_PUBLIC_google_Android_Client_Id}',
  '$EXPO_PUBLIC_OTHER_KEY', // not limited to known Google variable names
  '${EXPO_PUBLIC_OTHER_KEY}',
  '$EXPO_PUBLIC_123456789-abcdef.apps.googleusercontent.com',
  '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID}.apps.googleusercontent.com',
  '${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-123456789-abc.apps.googleusercontent.com}',
  '$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID trailing text',
  '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID}\nremaining text',
];

const NON_PLACEHOLDER_VALUES = [
  '123456789-abcdefg.apps.googleusercontent.com',
  '123456789-EXPO.apps.googleusercontent.com',
  '123456789-expo-public.apps.googleusercontent.com',
  '123456789-ExPoPuBlIc.apps.googleusercontent.com',
  'EXPO_PUBLIC_123456789-abcdef.apps.googleusercontent.com', // no dollar sign
  '$expo_public_GOOGLE_IOS_CLIENT_ID',
  '${expo_public_GOOGLE_ANDROID_CLIENT_ID}',
  '$Expo_Public_GOOGLE_IOS_CLIENT_ID',
  '${Expo_Public_GOOGLE_ANDROID_CLIENT_ID}',
  '$EXPO_public_GOOGLE_IOS_CLIENT_ID',
  '${EXPO_public_GOOGLE_ANDROID_CLIENT_ID}',
  '$EXPO_',
  '${EXPO_', // must not broaden the prefix to every EXPO variable
  '$EXPO_PRIVATE_GOOGLE_IOS_CLIENT_ID',
  '${EXPO_PRIVATE_GOOGLE_ANDROID_CLIENT_ID}',
  '$EXPO_PUBLIC', // missing required underscore
  '${EXPO_PUBLIC}',
  '$EXPO_PUBLICITY_GOOGLE_IOS_CLIENT_ID',
  '${EXPO_PUBLICITY_GOOGLE_ANDROID_CLIENT_ID}',
  'prefix-$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', // not anchored at start
  '123456789-${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}.apps.googleusercontent.com',
  ' $EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', // no implicit trimming
  '\t${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}',
  '\n$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  '$$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  '\\${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}',
  '$',
  '${',
  ' ',
];

for (const [platform, lines, scriptPath] of [
  ['iOS', IOS_LINES, IOS_SCRIPT],
  ['Android', ANDROID_LINES, ANDROID_SCRIPT],
]) {
  const definition = extractIsPlaceholder(lines, scriptPath);
  for (const [values, expectedStatus, description] of [
    [PLACEHOLDER_VALUES, '0', 'detects placeholder'],
    [NON_PLACEHOLDER_VALUES, '1', 'does not flag non-placeholder'],
  ]) {
    for (const value of values) {
      test(`[${platform}] is_placeholder() ${description}: ${JSON.stringify(value)}`, async () => {
        assert.equal(
          await runIsPlaceholder(definition, value),
          expectedStatus,
          `${scriptPath}: unexpected is_placeholder() status for ${JSON.stringify(value)}`,
        );
      });
    }
  }
}

// ── Locate key lines in each script once at module load ───────────────────────

const IOS_BYPASS_LINE_IDX = findLine(
  IOS_LINES,
  l => /BYPASS="\$\{SKIP_IOS_GOOGLE_CLIENT_ID_CHECK/.test(l),
  'BYPASS="${SKIP_IOS_GOOGLE_CLIENT_ID_CHECK:-}" assignment',
  IOS_SCRIPT,
);

const IOS_CLIENT_ID_LINE_IDX = findLine(
  IOS_LINES,
  l => /CLIENT_ID="\$\{EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/.test(l),
  'CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-}" assignment',
  IOS_SCRIPT,
);

const ANDROID_BYPASS_LINE_IDX = findLine(
  ANDROID_LINES,
  l => /BYPASS="\$\{SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK/.test(l),
  'BYPASS="${SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK:-}" assignment',
  ANDROID_SCRIPT,
);

const ANDROID_CLIENT_ID_LINE_IDX = findLine(
  ANDROID_LINES,
  l => /CLIENT_ID="\$\{EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID/.test(l),
  'CLIENT_ID="${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-}" assignment',
  ANDROID_SCRIPT,
);

// ── Static text assertions: iOS script ───────────────────────────────────────

test('[iOS] SKIP_IOS_GOOGLE_CLIENT_ID_CHECK bypass line uses ${VAR:-} (graceful default), not ${VAR:?} or bare ${VAR}', () => {
  const line = IOS_LINES[IOS_BYPASS_LINE_IDX];

  assert.ok(
    line.includes('SKIP_IOS_GOOGLE_CLIENT_ID_CHECK:-'),
    `Expected bypass line to use :- (graceful default) but got:\n  ${line}\n` +
    'Changing :-  to :? or removing :- causes bash to fail with set -u when the var is unset.',
  );

  const expr = line.match(/\$\{SKIP_IOS_GOOGLE_CLIENT_ID_CHECK[^}]*\}/)?.[0] ?? '';
  assert.ok(
    !expr.includes(':?'),
    `Bypass expression "${expr}" uses :? (fail-on-unset) instead of :- (default-to-empty). ` +
    'When SKIP_IOS_GOOGLE_CLIENT_ID_CHECK is absent, bash will exit non-zero instead of ' +
    'treating the variable as empty and proceeding with the bypass-inactive path.',
  );
});

test('[iOS] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID line uses ${VAR:-} (graceful default), not ${VAR:?} or bare ${VAR}', () => {
  const line = IOS_LINES[IOS_CLIENT_ID_LINE_IDX];

  assert.ok(
    line.includes('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-'),
    `Expected client ID line to use :- (graceful default) but got:\n  ${line}\n` +
    'Changing :- to :? causes bash to crash before is_placeholder() can produce a helpful error.',
  );

  const expr = line.match(/\$\{EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID[^}]*\}/)?.[0] ?? '';
  assert.ok(
    !expr.includes(':?'),
    `Client ID expression "${expr}" uses :? instead of :-. ` +
    'With set -u and :?, bash exits immediately when the var is unset, bypassing the ' +
    'is_placeholder() check and the helpful error message.',
  );
});

test('[iOS] BYPASS assignment appears before CLIENT_ID assignment in the script', () => {
  assert.ok(
    IOS_BYPASS_LINE_IDX < IOS_CLIENT_ID_LINE_IDX,
    `BYPASS line (${IOS_BYPASS_LINE_IDX + 1}) should come before CLIENT_ID line ` +
    `(${IOS_CLIENT_ID_LINE_IDX + 1}). ` +
    'BYPASS is the outer control variable and should be established before CLIENT_ID is read.',
  );
});

// ── Static text assertions: Android script ────────────────────────────────────

test('[Android] SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK bypass line uses ${VAR:-} (graceful default), not ${VAR:?} or bare ${VAR}', () => {
  const line = ANDROID_LINES[ANDROID_BYPASS_LINE_IDX];

  assert.ok(
    line.includes('SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK:-'),
    `Expected bypass line to use :- (graceful default) but got:\n  ${line}\n` +
    'Changing :- to :? or removing :- causes bash to fail with set -u when the var is unset.',
  );

  const expr = line.match(/\$\{SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK[^}]*\}/)?.[0] ?? '';
  assert.ok(
    !expr.includes(':?'),
    `Bypass expression "${expr}" uses :? (fail-on-unset) instead of :- (default-to-empty). ` +
    'When SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK is absent, bash will exit non-zero instead of ' +
    'treating the variable as empty and proceeding with the bypass-inactive path.',
  );
});

test('[Android] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID line uses ${VAR:-} (graceful default), not ${VAR:?} or bare ${VAR}', () => {
  const line = ANDROID_LINES[ANDROID_CLIENT_ID_LINE_IDX];

  assert.ok(
    line.includes('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-'),
    `Expected client ID line to use :- (graceful default) but got:\n  ${line}\n` +
    'Changing :- to :? causes bash to crash before is_placeholder() can produce a helpful error.',
  );

  const expr = line.match(/\$\{EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID[^}]*\}/)?.[0] ?? '';
  assert.ok(
    !expr.includes(':?'),
    `Client ID expression "${expr}" uses :? instead of :-. ` +
    'With set -u and :?, bash exits immediately when the var is unset, bypassing the ' +
    'is_placeholder() check and the helpful error message.',
  );
});

test('[Android] BYPASS assignment appears before CLIENT_ID assignment in the script', () => {
  assert.ok(
    ANDROID_BYPASS_LINE_IDX < ANDROID_CLIENT_ID_LINE_IDX,
    `BYPASS line (${ANDROID_BYPASS_LINE_IDX + 1}) should come before CLIENT_ID line ` +
    `(${ANDROID_CLIENT_ID_LINE_IDX + 1}). ` +
    'BYPASS is the outer control variable and should be established before CLIENT_ID is read.',
  );
});

// ── Subprocess tests: iOS script ─────────────────────────────────────────────

// Exercise the entire gate, not just is_placeholder(): an intentional bypass
// must warn that Google Sign-In is disabled rather than look like a normal pass.
for (const [platform, scriptPath, clientKey, bypassKey] of [
  ['iOS', IOS_SCRIPT, 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'SKIP_IOS_GOOGLE_CLIENT_ID_CHECK'],
  ['Android', ANDROID_SCRIPT, 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK'],
]) {
  for (const [label, env] of [
    ['unset', {}],
    ['empty', { [clientKey]: '' }],
    ['bare placeholder', { [clientKey]: `$${clientKey}` }],
    ['braced placeholder', { [clientKey]: `\${${clientKey}}` }],
  ]) {
    test(`[${platform}] bypass warns that Google Sign-In is disabled for ${label} client ID`, async () => {
      const { status, stdout, stderr } = await runScript(scriptPath, {
        ...env,
        [bypassKey]: '1',
      });
      const output = stdout + stderr;
      assert.equal(status, 0, `Intentional bypass must succeed:\n${output}`);
      assert.match(output, new RegExp(`\\bBYPASS\\s+${bypassKey}=1`));
      assert.match(output, /Google Sign-In DISABLED/);
      assert.doesNotMatch(output, /\bPASS\s+EXPO_PUBLIC_/);
    });
  }
}

test('[iOS] exits 1 when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is unset and bypass is unset', async () => {
  // Missing client ID with no bypass → script must fail the build.
  const { status, stderr } = await runScript(IOS_SCRIPT, {});

  assert.equal(
    status,
    1,
    `Expected exit 1 (check fails loudly) when client ID is unset and bypass is absent, ` +
    `but got exit ${status}.\n` +
    `If exit code is 0 the script is silently passing a missing-client-ID build.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 1 when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is empty string and bypass is unset', async () => {
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID="" and bypass is unset, but got exit ${status}.\n` +
    `An empty string must be treated as a missing client ID.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 1 when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is a $EXPO_PUBLIC_* placeholder and bypass is unset', async () => {
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID is an unsubstituted $EXPO_PUBLIC_* placeholder, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 1 when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is a ${EXPO_PUBLIC_* placeholder and bypass is unset', async () => {
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID}',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID is a \${EXPO_PUBLIC_* placeholder, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 0 when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is a real value and bypass is unset', async () => {
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 (check passes) when client ID is a real value, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 0 when client ID is unset but SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1 (bypass active)', async () => {
  // The bypass flag must exit 0 even when the client ID is missing.
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    SKIP_IOS_GOOGLE_CLIENT_ID_CHECK: '1',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 when bypass=1 and client ID is unset, but got exit ${status}.\n` +
    `If the bypass is ignored, SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1 can no longer be used to ` +
    `intentionally ship without Google Sign-In.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 0 when client ID is a placeholder but SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1', async () => {
  const { status, stderr } = await runScript(IOS_SCRIPT, {
    SKIP_IOS_GOOGLE_CLIENT_ID_CHECK: '1',
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 when bypass=1 even with a placeholder client ID, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[iOS] exits 1 (not crash) when SKIP_IOS_GOOGLE_CLIENT_ID_CHECK is unset — bash set -u must not fire', async () => {
  // This verifies the script does not crash (exit ≠ 1 due to set -u on BYPASS),
  // but rather produces the expected hard-fail exit 1 for a missing client ID.
  // If BYPASS used :? instead of :-, bash would exit non-zero for a different
  // reason (unbound variable) making this hard to diagnose.
  const { status, stdout } = await runScript(IOS_SCRIPT, {});

  assert.equal(
    status,
    1,
    `Expected graceful exit 1 (check failure) but got exit ${status}.`,
  );

  // The ERROR output must be present — confirms we reached the is_placeholder branch,
  // not an unbound-variable crash before any output was produced.
  assert.ok(
    stdout.includes('ERROR'),
    `Expected the script to print "ERROR" before exiting 1, but stdout was:\n${stdout}\n` +
    'If no ERROR output appears, the script may have crashed before reaching the check (e.g. due to :? on BYPASS).',
  );
});

// ── Subprocess tests: Android script ─────────────────────────────────────────

test('[Android] exits 1 when EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is unset and bypass is unset', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {});

  assert.equal(
    status,
    1,
    `Expected exit 1 (check fails loudly) when client ID is unset and bypass is absent, ` +
    `but got exit ${status}.\n` +
    `If exit code is 0 the script is silently passing a missing-client-ID build.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 1 when EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is empty string and bypass is unset', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID="" and bypass is unset, but got exit ${status}.\n` +
    `An empty string must be treated as a missing client ID.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 1 when EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is a $EXPO_PUBLIC_* placeholder and bypass is unset', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID is an unsubstituted $EXPO_PUBLIC_* placeholder, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 1 when EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is a ${EXPO_PUBLIC_* placeholder and bypass is unset', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}',
  });

  assert.equal(
    status,
    1,
    `Expected exit 1 when client ID is a \${EXPO_PUBLIC_* placeholder, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 0 when EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is a real value and bypass is unset', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 (check passes) when client ID is a real value, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 0 when client ID is unset but SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1 (bypass active)', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK: '1',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 when bypass=1 and client ID is unset, but got exit ${status}.\n` +
    `If the bypass is ignored, SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1 can no longer be used ` +
    `to intentionally ship without Google Sign-In.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 0 when client ID is a placeholder but SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1', async () => {
  const { status, stderr } = await runScript(ANDROID_SCRIPT, {
    SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK: '1',
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  });

  assert.equal(
    status,
    0,
    `Expected exit 0 when bypass=1 even with a placeholder client ID, ` +
    `but got exit ${status}.\nstderr: ${stderr}`,
  );
});

test('[Android] exits 1 (not crash) when SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK is unset — bash set -u must not fire', async () => {
  const { status, stdout } = await runScript(ANDROID_SCRIPT, {});

  assert.equal(
    status,
    1,
    `Expected graceful exit 1 (check failure) but got exit ${status}.`,
  );

  assert.ok(
    stdout.includes('ERROR'),
    `Expected the script to print "ERROR" before exiting 1, but stdout was:\n${stdout}\n` +
    'If no ERROR output appears, the script may have crashed before reaching the check (e.g. due to :? on BYPASS).',
  );
});
