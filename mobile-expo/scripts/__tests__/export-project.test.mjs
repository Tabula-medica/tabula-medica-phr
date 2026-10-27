import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const script = fileURLToPath(new URL('../export-project.sh', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'export-project-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(script, join(root, 'scripts/export-project.sh'));
  return root;
}

function put(root, name, content = 'synthetic fixture only') {
  const path = join(root, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function run(root, ...args) {
  return spawnSync('bash', [join(root, 'scripts/export-project.sh'), ...args], {
    cwd: tmpdir(), encoding: 'utf8',
  });
}

function entries(root) {
  return execFileSync('unzip', ['-Z1', join(root, 'tabula-medica.zip')], { encoding: 'utf8' })
    .trim().split('\n').map(name => name.replace(/^\.\//, '')).sort();
}

test('exports source but excludes credentials at all depths, history, local data and symlinks', t => {
  const root = fixture(t);
  const secrets = [
    'appstore-api-key.p8', 'other.p8', 'dist_cert.p12', 'profile.mobileprovision',
    'credentials.json', '.env', '.env.production', '.env.example', 'deploy.sh',
    'private.pem', 'private.key', 'store.jks', 'store.keystore', 'cert.crt',
    'serviceAccountKey.json', 'gcp-wif-config.json', 'firebase-admin-sdk-prod.json',
    'google-credentials-prod.json', 'google-service-account.json', 'old.zip', 'debug.log',
    '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '_netrc', '.pypirc',
    '.git-credentials', '.boto', '.pgpass', '.my.cnf',
    'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
  ];
  for (const name of secrets) {
    put(root, name);
    put(root, `nested/${name}`);
  }
  for (const dir of ['.git', '.local', ' .local', '.agents', '.config', '.cache',
    '.expo', 'node_modules', 'generated-artifacts', 'dist', 'dist-expo-web',
    'server_dist', 'static-build', 'web-build', 'build', 'coverage', 'exports', 'uploads', 'logs',
    '.ssh', '.aws', '.azure', '.gnupg', '.kube', '.docker']) {
    put(root, `${dir}/sensitive.txt`);
    put(root, `nested/${dir}/sensitive.txt`);
  }
  put(root, 'src/source with spaces.ts', 'export const example = true;\n');
  put(root, '-leading-dash.txt');
  put(root, 'attached_assets/chat.txt');
  put(root, 'nested/attached_assets/chat.txt');
  symlinkSync(join(root, 'credentials.json'), join(root, 'innocent-link.txt'));
  symlinkSync(join(root, '.local'), join(root, 'linked-directory'));
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(entries(root), [
    '-leading-dash.txt', 'attached_assets/chat.txt', 'nested/attached_assets/chat.txt',
    'scripts/export-project.sh', 'src/source with spaces.ts',
  ].sort());
  assert.equal(execFileSync('unzip', ['-p', join(root, 'tabula-medica.zip'),
    'src/source with spaces.ts'], { encoding: 'utf8' }), 'export const example = true;\n');
  assert.equal(run(root, '--safe-mode').status, 0);
  assert.deepEqual(entries(root), [
    '-leading-dash.txt', 'scripts/export-project.sh', 'src/source with spaces.ts',
  ].sort());
});

test('safe mode replaces an existing archive without stale attachments or secret entries', t => {
  const root = fixture(t);
  put(root, 'attached_assets/chat.txt');
  put(root, 'nested/attached_assets/chat.txt');
  put(root, 'source.txt');
  assert.equal(run(root).status, 0);
  assert.ok(entries(root).includes('attached_assets/chat.txt'));
  // Simulate an old export that already leaked credentials.
  put(root, 'credentials.json');
  execFileSync('zip', ['-q', 'tabula-medica.zip', 'credentials.json'], { cwd: root });
  assert.equal(run(root, '--safe-mode').status, 0);
  assert.deepEqual(entries(root), ['scripts/export-project.sh', 'source.txt']);
});

test('invalid arguments and unsupported filenames fail without replacing the previous archive', t => {
  const root = fixture(t);
  assert.equal(run(root).status, 0);
  const previous = readFileSync(join(root, 'tabula-medica.zip'));
  for (const args of [['--unknown'], ['--safe-mode', 'extra']]) {
    assert.equal(run(root, ...args).status, 2);
  }
  for (const filename of ['bad\nname.txt', 'bad\rname.txt']) {
    put(root, filename);
    const result = run(root, '--safe-mode');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /filename contains/);
    assert.deepEqual(readFileSync(join(root, 'tabula-medica.zip')), previous);
    rmSync(join(root, filename));
  }
  assert.equal(run(root, '--help').status, 0);
});
