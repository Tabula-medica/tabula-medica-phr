#!/usr/bin/env node
// Structural regression check for the weekly gate's github-script adapter.
// Run: node scripts/test-codeowners-gate-wiring.mjs
// No GitHub token or network is needed. Parse JS rather than matching comments
// or strings that merely mention the required wiring.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'acorn';
import yaml from 'js-yaml';

const workflowUrl = new URL('../.github/workflows/codeowners-gate-check.yml', import.meta.url);
const parseScript = (source) => parse(source, {
  ecmaVersion: 'latest',
  sourceType: 'script',
  allowAwaitOutsideFunction: true,
  allowReturnOutsideFunction: true,
});

function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [
    ...(value.type ? [value] : []),
    ...Object.values(value).flatMap((child) =>
      Array.isArray(child) ? child.flatMap(nodes) : nodes(child)),
  ];
}

// Locations, quote style, and shorthand spelling don't affect the contract.
function shape(node) {
  return JSON.stringify(node, (key, value) =>
    ['start', 'end', 'raw', 'shorthand'].includes(key) ? undefined : value);
}
const statement = (source) => parseScript(source).body[0];
const expression = (source) => statement(`(${source})`).expression;
const same = (a, b) => shape(a) === shape(b);
const contains = (tree, expected) => nodes(tree).some((node) => same(node, expected));

export function checkWorkflow(workflow) {
  // Pin the adapter's identity: removing it must fail, not silently select
  // another github-script step (issue creation and closure also use that action).
  const steps = workflow?.jobs?.['verify-gate']?.steps;
  const checks = Array.isArray(steps) ? steps.filter((step) => step.id === 'check') : [];
  if (checks.length !== 1 || !/^actions\/github-script@/.test(checks[0]?.uses ?? '')) {
    return ['verify-gate/check must be one actions/github-script step'];
  }
  const script = checks[0].with?.script;
  if (typeof script !== 'string' || !script.trim()) return ['check step has no script'];
  let tree;
  try {
    tree = parseScript(script);
  } catch (error) {
    return [`check script is invalid JavaScript: ${error.message}`];
  }
  const errors = [];
  const requireNode = (expected, label) => {
    if (!contains(tree, expected)) errors.push(label);
  };
  requireNode(statement(`
    const { evaluateGate, formatSummary } = await import(
      pathToFileURL(path.resolve('.github/scripts/codeowners-gate.mjs')).href
    );
  `), 'must import evaluateGate and formatSummary from .github/scripts/codeowners-gate.mjs');
  requireNode(statement("const TARGET = '.trivyignore.yaml';"), 'TARGET must be .trivyignore.yaml');
  requireNode(statement("const BRANCH = 'main';"), 'BRANCH must be main');
  requireNode(expression("codeownersText = fs.readFileSync('.github/CODEOWNERS', 'utf8')"),
    'codeownersText must read .github/CODEOWNERS as utf8');

  const calls = nodes(tree).filter((node) =>
    node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
    node.callee.name === 'evaluateGate');
  if (calls.length !== 1 || calls[0].arguments.length !== 1 ||
      calls[0].arguments[0].type !== 'ObjectExpression') {
    errors.push('must call evaluateGate once with an input object');
    return errors;
  }
  // Ensure the real evaluation is awaited and its verdict drives the adapter.
  if (!nodes(tree).some((node) =>
    node.type === 'VariableDeclarator' && node.id.name === 'result' &&
    node.init?.type === 'AwaitExpression' && node.init.argument === calls[0])) {
    errors.push('result must await evaluateGate');
  }

  const inputs = calls[0].arguments[0].properties;
  const expectedInputs = {
    codeownersText: 'codeownersText',
    target: 'TARGET',
    branch: 'BRANCH',
    repoOwner: 'context.repo.owner',
    getBranchProtection: `async () => {
      const { data } = await github.rest.repos.getBranchProtection({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: BRANCH,
      });
      return data;
    }`,
    listTeamMembers: `async (org, slug) => {
      return await github.paginate(github.rest.teams.listMembersInOrg, {
        org,
        team_slug: slug,
        per_page: 100,
      });
    }`,
  };
  // Explicit properties only; a spread or duplicate can override correct inputs.
  if (inputs.some((property) => property.type !== 'Property' || property.computed)) {
    errors.push('evaluateGate inputs must be explicit, non-computed properties');
  }
  for (const [key, source] of Object.entries(expectedInputs)) {
    const properties = inputs.filter((property) => property.key?.name === key);
    if (properties.length !== 1 || !same(properties[0].value, expression(source))) {
      errors.push(`evaluateGate.${key} must have the expected wiring`);
    }
  }
  return errors;
}

const workflow = yaml.load(readFileSync(workflowUrl, 'utf8'));
const liveScript = workflow?.jobs?.['verify-gate']?.steps
  ?.find((step) => step.id === 'check')?.with?.script ?? '';

test('live CODEOWNERS gate adapter wiring', () => {
  assert.deepEqual(checkWorkflow(workflow), []);
});

function broken(label, mutate, expected) {
  test(`rejects ${label}`, () => {
    const copy = structuredClone(workflow);
    mutate(copy);
    assert.ok(checkWorkflow(copy).some((error) => expected.test(error)),
      `expected ${expected}, got ${JSON.stringify(checkWorkflow(copy))}`);
  });
}

function changedScript(label, from, to, expected) {
  broken(label, (copy) => {
    assert.ok(liveScript.includes(from), `mutation anchor missing: ${from}`);
    copy.jobs['verify-gate'].steps.find((step) => step.id === 'check').with.script =
      liveScript.replace(from, to);
  }, expected);
}

broken('missing adapter', (copy) => {
  copy.jobs['verify-gate'].steps = [];
}, /github-script step/);
broken('wrong action', (copy) => {
  copy.jobs['verify-gate'].steps.find((step) => step.id === 'check').uses = 'actions/checkout@v4';
}, /github-script step/);
broken('missing script', (copy) => {
  delete copy.jobs['verify-gate'].steps.find((step) => step.id === 'check').with.script;
}, /no script/);
changedScript('invalid JS', 'const fs', 'const = fs', /invalid JavaScript/);
changedScript('wrong module path', "path.resolve('.github/scripts/codeowners-gate.mjs')",
  "path.resolve('.github/scripts/typo.mjs')", /must import/);
changedScript('missing evaluation', 'await evaluateGate({', 'await otherGate({', /must call evaluateGate/);
changedScript('unawaited evaluation', 'await evaluateGate({', 'evaluateGate({', /result must await/);
changedScript('wrong target', "const TARGET = '.trivyignore.yaml'", "const TARGET = 'other.yaml'", /TARGET must/);
changedScript('wrong branch', "const BRANCH = 'main'", "const BRANCH = 'develop'", /BRANCH must/);
changedScript('wrong CODEOWNERS file', "fs.readFileSync('.github/CODEOWNERS', 'utf8')",
  "fs.readFileSync('CODEOWNERS', 'utf8')", /must read/);
changedScript('unread CODEOWNERS', "fs.readFileSync('.github/CODEOWNERS', 'utf8')",
  "'.github/CODEOWNERS'", /must read/);
for (const [key, source] of Object.entries({
  codeownersText: 'codeownersText,',
  target: 'target: TARGET,',
  branch: 'branch: BRANCH,',
  repoOwner: 'repoOwner: context.repo.owner,',
  getBranchProtection: 'getBranchProtection: async () =>',
  listTeamMembers: 'listTeamMembers: async (org, slug) =>',
})) {
  changedScript(`missing ${key} input`, source,
    key === 'codeownersText' ? 'unusedText: codeownersText,' : source.replace(key, 'unused'),
    new RegExp(`evaluateGate\\.${key}`));
}
changedScript('wrong repo owner', 'repoOwner: context.repo.owner', 'repoOwner: context.repo.repo', /evaluateGate.repoOwner/);
changedScript('wrong target input', 'target: TARGET,', "target: 'other.yaml',", /evaluateGate.target/);
changedScript('wrong branch input', 'branch: BRANCH,', "branch: 'develop',", /evaluateGate.branch/);
changedScript('wrong CODEOWNERS input', 'codeownersText,\n', "codeownersText: '',\n", /evaluateGate.codeownersText/);
changedScript('wrong protection API owner', 'owner: context.repo.owner,', 'owner: context.repo.repo,', /evaluateGate.getBranchProtection/);
changedScript('wrong protection API branch', 'branch: BRANCH,\n    });',
  "branch: 'develop',\n    });", /evaluateGate.getBranchProtection/);
changedScript('discarded protection data', 'return data;', 'return {};', /evaluateGate.getBranchProtection/);
changedScript('wrong team slug', 'team_slug: slug', 'team_slug: org', /evaluateGate.listTeamMembers/);
changedScript('missing pagination', 'github.paginate(', 'github.other(', /evaluateGate.listTeamMembers/);
changedScript('overriding spread', 'codeownersText,\n', '...override,\ncodeownersText,\n', /explicit/);
changedScript('comment-only call', 'const result = await evaluateGate({',
  '/* const result = await evaluateGate({ */\nconst result = await otherGate({', /must call evaluateGate/);

test('formatting and comments do not change valid wiring', () => {
  const copy = structuredClone(workflow);
  copy.jobs['verify-gate'].steps.find((step) => step.id === 'check').with.script =
    liveScript.replaceAll("'", '"').replace('target: TARGET', 'target: /* input */ TARGET');
  assert.deepEqual(checkWorkflow(copy), []);
});
