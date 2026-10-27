#!/usr/bin/env node
//
// Regression test for the wiring in EVERY workflow file under
// `.github/workflows/` that uses `./.github/actions/slack-recovery-state` to
// thread the Slack failure / recovery pipeline together.
//
// WHAT THIS GUARDS
// ----------------
// Both halves of the Slack failure / recovery pipeline are individually
// unit-tested elsewhere:
//
//   - scripts/test-slack-recovery-state.sh        — cross-run state machine
//   - scripts/test-post-slack-notification.sh     — upstream `posted` contract
//
// What is NOT covered by either of those is the *wiring* in workflow files
// that threads them together — specifically that every
// `notify_posted: ${{ steps.notify-failure.outputs.posted }}` reference points
// at a real step that uses `./.github/actions/post-slack-notification`, that
// `deploy_status` references the conclusion of a real preceding step, and
// that the recovery-notify step gates on the matching state action's
// `should_notify_recovery` output.
//
// A typo there (`steps.notify-fail`, `outputs.post`, swapping the deploy and
// smoke state machines, gating the wrong recovery step on the wrong state
// id, …) would silently route the failure-notified branch to
// `failure-silent` and the spurious-recovery protection that the two unit
// tests guard would never even get the chance to run. The mistake would only
// be visible after shipping a real failure to production.
//
// The Slack failure/recovery pattern is intentionally reusable — see the
// "Call site sketch" comment in
// `.github/actions/slack-recovery-state/action.yml`. The moment a second
// workflow adopts the pattern (e.g. `post-deploy-smoke.yml` or a future
// nightly-job workflow), this script automatically picks it up. Hard-coding
// `deploy-cloudrun.yml` as the only file under test would let the next
// adopter of the pattern silently regress — exactly the failure mode this
// check exists to prevent.
//
// Invariants checked, for every `./.github/actions/slack-recovery-state`
// invocation in every discovered workflow file:
//
//   1. `with.notify_posted` matches the literal pattern
//        ${{ steps.<id>.outputs.posted }}
//      AND `<id>` is a step in the same job AND that step uses
//      `./.github/actions/post-slack-notification`.
//
//   2. `with.deploy_status` matches the literal pattern
//        ${{ steps.<id>.conclusion }}
//      AND `<id>` is a step in the same job AND that step appears BEFORE
//      the state action.
//
//   3. There is a subsequent step in the same job that uses
//      `./.github/actions/post-slack-notification` (the recovery-notify
//      step) AND its `if:` condition references
//        steps.<state-step-id>.outputs.should_notify_recovery == 'true'
//      where `<state-step-id>` is the id of the state action being checked.
//
// HOW TO RUN LOCALLY
// ------------------
//   node scripts/test-deploy-cloudrun-wiring.mjs
//
// Exit code is 0 on success, 1 on any failed assertion.
//
// This sits alongside `scripts/test-slack-recovery-state.sh` and
// `scripts/test-post-slack-notification.sh` — together the three scripts
// cover the failure / recovery pipeline end-to-end (state machine, upstream
// `posted` contract, AND the workflow wiring that connects them).
//
// SELF-TESTS
// ----------
// Beyond running the check against every live workflow that uses the state
// action, this script also runs each invariant against a synthetic
// broken-workflow fixture to assert the checker actually catches each class
// of regression. If a future refactor of `checkWorkflow()` accidentally
// weakens an assertion (e.g. starts accepting any string at all for
// `notify_posted`), the corresponding self-test fails loudly. Drift
// protection without the fragility of sha256-pinning the YAML.
//
// PER-FILE COUNT EXPECTATIONS
// ---------------------------
// Discovery (filesystem scan) catches every workflow that currently uses the
// state action, but it cannot catch a workflow that USED to have the wiring
// and was silently stripped of it — once the `uses:` line is gone, the file
// drops out of the discovered set.
//
// `EXPECTED_INVOCATIONS` below pins the known call-sites: each entry asserts
// "this workflow MUST contain at least N `slack-recovery-state` invocations".
// Stripping the wiring from any pinned workflow drops its parsed count below
// the floor and trips a loud failure here, even though the file is no longer
// regex-discoverable. New adopters of the pattern are also auto-checked
// (with a floor of 1) and SHOULD be added to this map when they land so the
// floor is enforced going forward.
//

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const WORKFLOWS_DIR = resolve(REPO_ROOT, '.github/workflows');

const STATE_ACTION = './.github/actions/slack-recovery-state';
const POST_ACTION = './.github/actions/post-slack-notification';

// Pinned floors for known call-sites of the state action. Discovery picks up
// any workflow that currently uses the action, but a workflow stripped of
// its wiring vanishes from that set — these floors enforce that the listed
// workflows MUST keep at least N invocations or the check fails. Add new
// adopters here when they land.
//
// Keys are workflow filenames relative to `.github/workflows/`.
const EXPECTED_INVOCATIONS = {
  'deploy-cloudrun.yml': 2, // deploy job + smoke job
  'post-deploy-smoke.yml': 1, // manual production smoke job
};

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

/**
 * Validate a parsed GitHub Actions workflow object.
 *
 * Returns an array of human-readable error strings — empty array means the
 * workflow's Slack failure / recovery wiring is intact.
 */
export function checkWorkflow(workflow) {
  const errors = [];

  if (!workflow || typeof workflow !== 'object' || !workflow.jobs) {
    return ['workflow has no `jobs` map'];
  }

  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    if (!Array.isArray(job?.steps)) continue;

    const steps = job.steps;

    // Build an id -> step-with-index map so subsequent invariants can
    // reference each step by its `id:` (the same handle the workflow's
    // `${{ steps.<id>... }}` expressions use).
    const stepsById = new Map();
    steps.forEach((step, index) => {
      if (step?.id) stepsById.set(step.id, { step, index });
    });

    steps.forEach((step, stateIndex) => {
      if (step?.uses !== STATE_ACTION) return;

      const stateLabel = `${jobName}/${step.id ?? `step[${stateIndex}]`}`;
      const inputs = step.with ?? {};

      // ----- Invariant 1: notify_posted wiring -----
      const notifyPosted = inputs.notify_posted;
      const notifyMatch =
        typeof notifyPosted === 'string'
          ? notifyPosted
              .trim()
              .match(/^\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outputs\.posted\s*\}\}$/)
          : null;

      if (!notifyMatch) {
        errors.push(
          `${stateLabel}: \`notify_posted\` must match ` +
            `\`\${{ steps.<id>.outputs.posted }}\` — got: ${JSON.stringify(
              notifyPosted,
            )}`,
        );
      } else {
        const referencedId = notifyMatch[1];
        const referenced = stepsById.get(referencedId);
        if (!referenced) {
          errors.push(
            `${stateLabel}: \`notify_posted\` references \`steps.${referencedId}\` ` +
              `which is not a step in job \`${jobName}\``,
          );
        } else if (referenced.step.uses !== POST_ACTION) {
          errors.push(
            `${stateLabel}: \`notify_posted\` references step \`${referencedId}\` ` +
              `but that step uses \`${referenced.step.uses}\` instead of ` +
              `\`${POST_ACTION}\` — \`posted\` is only emitted by the ` +
              `post-slack-notification action`,
          );
        }
      }

      // ----- Invariant 2: deploy_status wiring -----
      const deployStatus = inputs.deploy_status;
      const statusMatch =
        typeof deployStatus === 'string'
          ? deployStatus
              .trim()
              .match(/^\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.conclusion\s*\}\}$/)
          : null;

      if (!statusMatch) {
        errors.push(
          `${stateLabel}: \`deploy_status\` must match ` +
            `\`\${{ steps.<id>.conclusion }}\` — got: ${JSON.stringify(
              deployStatus,
            )}`,
        );
      } else {
        const referencedId = statusMatch[1];
        const referenced = stepsById.get(referencedId);
        if (!referenced) {
          errors.push(
            `${stateLabel}: \`deploy_status\` references \`steps.${referencedId}\` ` +
              `which is not a step in job \`${jobName}\``,
          );
        } else if (referenced.index >= stateIndex) {
          // Equal would mean it's the state step itself; greater means
          // it appears after, which makes `conclusion` perpetually empty
          // at the moment the state step runs.
          errors.push(
            `${stateLabel}: \`deploy_status\` references step \`${referencedId}\` ` +
              `which does not appear before the state action in job \`${jobName}\` ` +
              `(its conclusion would not be set yet)`,
          );
        }
      }

      // ----- Invariant 3: recovery-notify gating -----
      // The recovery-notify step is the next step in the same job AFTER
      // the state action that uses post-slack-notification. There MUST
      // be one and its `if:` MUST gate on this state action's
      // `should_notify_recovery` output.
      const recoveryStep = steps
        .slice(stateIndex + 1)
        .find((s) => s?.uses === POST_ACTION);

      if (!recoveryStep) {
        errors.push(
          `${stateLabel}: no subsequent \`${POST_ACTION}\` step found in ` +
            `job \`${jobName}\` to act as the recovery-notify step`,
        );
      } else {
        const ifClause = typeof recoveryStep.if === 'string' ? recoveryStep.if : '';
        const stateStepId = step.id;
        if (!stateStepId) {
          errors.push(
            `${stateLabel}: state action has no \`id:\` so the ` +
              `recovery-notify step cannot reference its outputs`,
          );
        } else {
          // Match `steps.<stateStepId>.outputs.should_notify_recovery == 'true'`
          // tolerantly: allow either single or double quotes, and any
          // amount of whitespace around `==`.
          const idEscaped = stateStepId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const gateRe = new RegExp(
            `steps\\.${idEscaped}\\.outputs\\.should_notify_recovery\\s*==\\s*['"]true['"]`,
          );
          if (!gateRe.test(ifClause)) {
            errors.push(
              `${stateLabel}: recovery-notify step \`${recoveryStep.name ?? recoveryStep.id ?? '<unnamed>'}\` ` +
                `must gate its \`if:\` on ` +
                `\`steps.${stateStepId}.outputs.should_notify_recovery == 'true'\` — got: ` +
                JSON.stringify(ifClause),
            );
          }
        }
      }
    });
  }

  return errors;
}

/**
 * Count how many top-level steps across all jobs use the state action.
 * Used to enforce per-file floors and to surface "stripped of its wiring"
 * regressions.
 */
export function countStateInvocations(workflow) {
  let n = 0;
  for (const job of Object.values(workflow?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (step?.uses === STATE_ACTION) n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Self-tests: synthetic broken-workflow fixtures
// ---------------------------------------------------------------------------

// Minimal valid workflow shape — same wiring as deploy-cloudrun.yml, with
// just the bits the checker inspects. Other test fixtures are produced by
// mutating this base via small helpers.
const BASE_WORKFLOW = {
  jobs: {
    deploy: {
      steps: [
        { id: 'deploy', uses: 'google-github-actions/deploy-cloudrun@v2' },
        {
          id: 'notify-failure',
          if: "failure() && steps.deploy.conclusion == 'failure'",
          uses: POST_ACTION,
        },
        {
          id: 'recovery-state',
          if: 'always()',
          uses: STATE_ACTION,
          with: {
            state_key: 'deploy-state',
            notify_posted: '${{ steps.notify-failure.outputs.posted }}',
            deploy_status: '${{ steps.deploy.conclusion }}',
          },
        },
        {
          name: 'Notify Slack on deploy recovery',
          if:
            "success() && steps.deploy.conclusion == 'success' && " +
            "steps.recovery-state.outputs.should_notify_recovery == 'true'",
          uses: POST_ACTION,
        },
      ],
    },
  },
};

// Deep clone via JSON round-trip — fixtures are POJOs, no functions or
// special objects to preserve.
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const FIXTURES = [
  {
    label: 'baseline: valid wiring',
    workflow: clone(BASE_WORKFLOW),
    expectErrors: [],
  },
  {
    label: 'invariant 1: notify_posted typo `outputs.post`',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[2].with.notify_posted =
        '${{ steps.notify-failure.outputs.post }}';
      return w;
    })(),
    expectErrors: [/notify_posted.*must match/],
  },
  {
    label: 'invariant 1: notify_posted points at non-existent step id',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[2].with.notify_posted =
        '${{ steps.notify-fail.outputs.posted }}';
      return w;
    })(),
    expectErrors: [/notify_posted.*references `steps\.notify-fail`.*not a step/],
  },
  {
    label: 'invariant 1: notify_posted points at a non-post-slack step',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      // Add a non-post-slack step with a posted-named output and point at it.
      w.jobs.deploy.steps.splice(1, 0, {
        id: 'fake-post',
        uses: 'actions/checkout@v4',
      });
      w.jobs.deploy.steps[3].with.notify_posted =
        '${{ steps.fake-post.outputs.posted }}';
      return w;
    })(),
    expectErrors: [/notify_posted.*references step `fake-post`.*post-slack-notification/],
  },
  {
    label: 'invariant 2: deploy_status typo `outputs.conclusion`',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[2].with.deploy_status =
        '${{ steps.deploy.outputs.conclusion }}';
      return w;
    })(),
    expectErrors: [/deploy_status.*must match/],
  },
  {
    label: 'invariant 2: deploy_status points at non-existent step',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[2].with.deploy_status =
        '${{ steps.deploi.conclusion }}';
      return w;
    })(),
    expectErrors: [/deploy_status.*references `steps\.deploi`.*not a step/],
  },
  {
    label: 'invariant 2: deploy_status points at a step that runs after',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      // Add a step AFTER the state action and point deploy_status at it.
      w.jobs.deploy.steps.push({
        id: 'after-state',
        uses: 'actions/checkout@v4',
      });
      w.jobs.deploy.steps[2].with.deploy_status =
        '${{ steps.after-state.conclusion }}';
      return w;
    })(),
    expectErrors: [/deploy_status.*does not appear before the state action/],
  },
  {
    label: 'invariant 3: recovery-notify step missing entirely',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      // Drop the trailing recovery-notify step.
      w.jobs.deploy.steps.pop();
      return w;
    })(),
    expectErrors: [/no subsequent .*post-slack-notification.* step found/],
  },
  {
    label: 'invariant 3: recovery-notify gates on wrong state step id',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      // Swap the state action's id so the recovery-notify `if:` no longer
      // matches — this is the "swapped the two state machines" failure mode.
      w.jobs.deploy.steps[2].id = 'smoke-recovery-state';
      return w;
    })(),
    expectErrors: [/recovery-notify step.*must gate.*should_notify_recovery/],
  },
  {
    label: 'invariant 3: recovery-notify gates on wrong output name',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[3].if =
        "success() && steps.deploy.conclusion == 'success' && " +
        "steps.recovery-state.outputs.should_notify == 'true'";
      return w;
    })(),
    expectErrors: [/recovery-notify step.*must gate.*should_notify_recovery/],
  },
  {
    label: 'invariant 3: recovery-notify gates on `false` instead of `true`',
    workflow: (() => {
      const w = clone(BASE_WORKFLOW);
      w.jobs.deploy.steps[3].if =
        "success() && steps.deploy.conclusion == 'success' && " +
        "steps.recovery-state.outputs.should_notify_recovery == 'false'";
      return w;
    })(),
    expectErrors: [/recovery-notify step.*must gate.*should_notify_recovery/],
  },
  {
    label: 'cross-job: state action in `smoke` job wired to a `deploy`-job step',
    workflow: (() => {
      // This is the "swapped the two state machines" mistake the task
      // description calls out. The state action lives in `smoke` but
      // `notify_posted` references a step in `deploy` — invalid because
      // GitHub's `steps.*` namespace is per-job.
      const w = clone(BASE_WORKFLOW);
      w.jobs.smoke = {
        steps: [
          { id: 'smoke', uses: 'actions/checkout@v4' },
          {
            id: 'smoke-recovery-state',
            if: 'always()',
            uses: STATE_ACTION,
            with: {
              state_key: 'smoke-state',
              // BUG: references the deploy job's notify-failure id instead
              // of a smoke-job-local step.
              notify_posted: '${{ steps.notify-failure.outputs.posted }}',
              deploy_status: '${{ steps.smoke.conclusion }}',
            },
          },
          {
            name: 'Notify Slack on smoke recovery',
            if:
              "success() && steps.smoke.conclusion == 'success' && " +
              "steps.smoke-recovery-state.outputs.should_notify_recovery == 'true'",
            uses: POST_ACTION,
          },
        ],
      };
      return w;
    })(),
    expectErrors: [/smoke\/smoke-recovery-state.*not a step in job `smoke`/],
  },
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let totalAssertions = 0;
let failedAssertions = 0;

function pass(label) {
  totalAssertions += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label, detail) {
  totalAssertions += 1;
  failedAssertions += 1;
  console.log(`  FAIL  ${label}`);
  if (detail) {
    for (const line of String(detail).split('\n')) {
      console.log(`        ${line}`);
    }
  }
}

/**
 * Discover every workflow file under `.github/workflows/` whose raw text
 * contains a `uses: ./.github/actions/slack-recovery-state` invocation.
 *
 * We grep the raw bytes (not the parsed YAML) so that a syntactically broken
 * workflow that still references the action is still surfaced as a discovery
 * hit — the per-file YAML parse below will then report it as a hard failure
 * rather than silently dropping it.
 *
 * Returns an array of absolute paths, sorted for deterministic output.
 */
function discoverWorkflowsWithStateAction() {
  if (!existsSync(WORKFLOWS_DIR)) return [];

  // GitHub Actions accepts both `.yml` and `.yaml` — match both.
  const candidates = readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => resolve(WORKFLOWS_DIR, name))
    .sort();

  // Anchor on the start of the value so we don't match the action's own
  // `action.yml` documentation comments or this script's own self-references
  // if either ends up colocated. The captured form is exactly the YAML the
  // checker inspects: `uses: ./.github/actions/slack-recovery-state`.
  const usesRe = /^\s*-?\s*uses:\s*\.\/\.github\/actions\/slack-recovery-state\s*$/m;

  return candidates.filter((path) => {
    const text = readFileSync(path, 'utf8');
    return usesRe.test(text);
  });
}

function runRealWorkflowChecks() {
  console.log('\n## Real workflows: scanning .github/workflows/');

  const discovered = discoverWorkflowsWithStateAction();

  // Union of pinned + discovered — pinned floors must be enforced even if a
  // workflow has been stripped of all its `uses:` lines and therefore
  // doesn't show up in `discovered`. That's the regression class the
  // EXPECTED_INVOCATIONS map exists to catch.
  const pinnedPaths = Object.keys(EXPECTED_INVOCATIONS).map((name) =>
    resolve(WORKFLOWS_DIR, name),
  );
  const allPaths = Array.from(new Set([...pinnedPaths, ...discovered])).sort();

  if (allPaths.length === 0) {
    fail(
      'at least one workflow uses `slack-recovery-state`',
      'no workflow files under .github/workflows/ reference ' +
        '`./.github/actions/slack-recovery-state` — either the recovery ' +
        'pipeline has been removed entirely or the discovery scan is broken',
    );
    return;
  }

  // Surface the discovered set so a CI reader can see which files were
  // checked at a glance — and so a workflow accidentally dropping out of
  // discovery is visible as a diff in the log.
  console.log(`\n  Discovered ${discovered.length} workflow file(s) using the state action:`);
  for (const path of discovered) {
    console.log(`    - .github/workflows/${basename(path)}`);
  }
  if (pinnedPaths.length > 0) {
    console.log(`  Pinned floors (EXPECTED_INVOCATIONS):`);
    for (const [name, floor] of Object.entries(EXPECTED_INVOCATIONS)) {
      console.log(`    - .github/workflows/${name}: >= ${floor}`);
    }
  }

  for (const path of allPaths) {
    const name = basename(path);
    const label = `.github/workflows/${name}`;
    console.log(`\n  ## ${label}`);

    if (!existsSync(path)) {
      fail(`${label}: file is readable`, `not found at ${path}`);
      continue;
    }

    let workflow;
    try {
      workflow = yaml.load(readFileSync(path, 'utf8'));
    } catch (e) {
      fail(`${label}: parses as YAML`, e.message);
      continue;
    }

    // Per-file count assertion. Replaces the old global `>= 2 invocations`
    // sanity check: if a workflow listed in EXPECTED_INVOCATIONS gets
    // stripped of one or more of its state-action invocations, its parsed
    // count drops below the pinned floor and this trips. Discovery-only
    // workflows (not pinned) get a floor of 1 — they shouldn't have been
    // discovered if they don't have at least one invocation.
    const floor = EXPECTED_INVOCATIONS[name] ?? 1;
    const invocations = countStateInvocations(workflow);
    if (invocations >= floor) {
      pass(
        `${label}: found ${invocations} slack-recovery-state invocation(s) ` +
          `(expected >= ${floor})`,
      );
    } else {
      fail(
        `${label}: found ${invocations} slack-recovery-state invocation(s) ` +
          `(expected >= ${floor})`,
        EXPECTED_INVOCATIONS[name] !== undefined
          ? `${name} is pinned in EXPECTED_INVOCATIONS — at least ${floor} ` +
              `invocation(s) must remain or this guarded wiring has been ` +
              `silently stripped`
          : `discovery flagged ${name} but the YAML parser found no ` +
              `invocations — the file may be malformed or the regex and ` +
              `parser disagree`,
      );
      // Don't bother running the per-step invariants if the count check
      // already says the wiring is gone.
      continue;
    }

    const errors = checkWorkflow(workflow);
    if (errors.length === 0) {
      pass(`${label}: all wiring invariants hold`);
    } else {
      fail(`${label}: wiring invariants`, errors.join('\n'));
    }
  }
}

function runFixtureSelfTests() {
  console.log('\n## Self-tests: synthetic fixtures exercise each invariant');

  for (const { label, workflow, expectErrors } of FIXTURES) {
    const errors = checkWorkflow(workflow);

    if (expectErrors.length === 0) {
      if (errors.length === 0) {
        pass(label);
      } else {
        fail(label, `expected no errors, got:\n${errors.join('\n')}`);
      }
      continue;
    }

    // For broken fixtures: every expected pattern must be matched by at
    // least one emitted error. We don't insist on the exact set of errors
    // (one bug can legitimately cascade into multiple invariant failures);
    // we just insist that the SPECIFIC error class we're asserting on is
    // present.
    const unmatched = expectErrors.filter(
      (re) => !errors.some((e) => re.test(e)),
    );
    if (unmatched.length === 0) {
      pass(label);
    } else {
      fail(
        label,
        `expected error(s) matching ${unmatched.map(String).join(', ')}\n` +
          `actual errors:\n${errors.length > 0 ? errors.join('\n') : '(none)'}`,
      );
    }
  }
}

// Self-test for `countStateInvocations` and the per-file count assertion's
// floor logic. Cheap and means a future refactor that swaps how we count
// invocations (e.g. per-job vs workflow-wide) can't silently weaken the
// floor enforcement.
function runCountSelfTests() {
  console.log('\n## Self-tests: per-file count assertion');

  const baseline = clone(BASE_WORKFLOW);
  const baselineCount = countStateInvocations(baseline);
  if (baselineCount === 1) {
    pass('countStateInvocations: baseline fixture has 1 invocation');
  } else {
    fail(
      'countStateInvocations: baseline fixture has 1 invocation',
      `got ${baselineCount}`,
    );
  }

  const stripped = clone(BASE_WORKFLOW);
  // Drop the state-action step, leaving the post-slack steps in place — this
  // is the "stripped of its wiring" failure mode the floor enforces against.
  stripped.jobs.deploy.steps = stripped.jobs.deploy.steps.filter(
    (s) => s.uses !== STATE_ACTION,
  );
  const strippedCount = countStateInvocations(stripped);
  if (strippedCount === 0) {
    pass('countStateInvocations: stripped fixture has 0 invocations');
  } else {
    fail(
      'countStateInvocations: stripped fixture has 0 invocations',
      `got ${strippedCount}`,
    );
  }

  // Empty / malformed inputs should be safe (return 0, not throw).
  if (countStateInvocations({}) === 0 && countStateInvocations(null) === 0) {
    pass('countStateInvocations: handles empty/null without throwing');
  } else {
    fail('countStateInvocations: handles empty/null without throwing');
  }
}

// Allow `node scripts/test-deploy-cloudrun-wiring.mjs` to be the only
// entrypoint — no flags, no subcommands. The self-tests run first so a bug
// in the checker itself surfaces before the (presumed-correct) live
// workflow check.
runFixtureSelfTests();
runCountSelfTests();
runRealWorkflowChecks();

console.log('');
if (failedAssertions > 0) {
  console.log(
    `FAILED: ${failedAssertions}/${totalAssertions} assertions failed`,
  );
  process.exit(1);
}
console.log(`OK: all ${totalAssertions} assertions passed`);
