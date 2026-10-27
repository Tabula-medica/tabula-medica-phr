#!/usr/bin/env node
/**
 * check-reviewer-alert-parity.mjs
 *
 * Asserts that the Slack alert fields shared between
 * .github/workflows/reviewer-login-scheduled.yml and the reviewer-login-gate
 * job in .github/workflows/ci-cd.yml are identical.
 *
 * Fields checked (trimmed, *Run:* and header lines excluded):
 *   1.  credentials-failure  Fix: line
 *   2.  credentials-recovery body
 *   3.  smoke-test-failure   Fix: line
 *   4.  smoke-test-recovery  body
 *   5.  credentials-failure  fallback_text
 *   6.  credentials-recovery fallback_text
 *   7.  smoke-test-failure   fallback_text
 *   8.  smoke-test-recovery  fallback_text
 *   9.  credentials-failure  channel
 *   10. credentials-recovery channel
 *   11. smoke-test-failure   channel
 *   12. smoke-test-recovery  channel
 *
 * A divergence fails CI before the PR can merge, preventing ops from receiving
 * differently-worded alerts (or alerts in different channels) from the two
 * workflows and being unable to tell which one fired.
 *
 * Usage:
 *   node scripts/check-reviewer-alert-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Given a YAML file's text and a step name, find the `markdown: |` literal
 * block that belongs to that step and return its trimmed, non-empty lines.
 *
 * Termination: a YAML literal block ends at the first non-empty line whose
 * indentation is less than the content indentation (determined from the first
 * non-empty content line). This correctly stops at YAML comments, sibling
 * steps, or new top-level keys that follow the block in the file.
 */
function extractMarkdownLines(yaml, stepName, filePath) {
  // Locate the step by name (first occurrence)
  const stepIdx = yaml.indexOf(`name: ${stepName}`);
  if (stepIdx === -1) {
    throw new Error(`[${filePath}] Step not found: "${stepName}"`);
  }

  // Find 'markdown: |' after the step name
  const mdIdx = yaml.indexOf('markdown: |', stepIdx);
  if (mdIdx === -1) {
    throw new Error(`[${filePath}] No "markdown: |" block found after step "${stepName}"`);
  }

  // The literal block starts on the line after 'markdown: |'
  const blockStart = yaml.indexOf('\n', mdIdx) + 1;
  const rawLines = yaml.slice(blockStart).split('\n');

  // Determine content indentation from the first non-empty line
  let contentIndent = -1;
  for (const line of rawLines) {
    if (line.trim() === '') continue;
    const spaces = line.match(/^( *)/)[1].length;
    contentIndent = spaces;
    break;
  }
  if (contentIndent === -1) {
    throw new Error(`[${filePath}] Empty markdown block for step "${stepName}"`);
  }

  // Collect lines that belong to the literal block:
  // - empty/blank lines inside the block are included
  // - stop at the first non-empty line with fewer leading spaces than contentIndent
  const blockLines = [];
  for (const line of rawLines) {
    if (line.trim() !== '') {
      const spaces = line.match(/^( *)/)[1].length;
      if (spaces < contentIndent) break;
    }
    blockLines.push(line.trim());
  }

  return blockLines.filter(l => l !== '');
}

/** Return the first line that starts with `*Fix:*`. */
function extractFixLine(lines, stepName, filePath) {
  const line = lines.find(l => l.startsWith('*Fix:*'));
  if (!line) {
    throw new Error(`[${filePath}] No "*Fix:*" line in markdown for step "${stepName}"`);
  }
  return line;
}

/**
 * Given a YAML file's text and a step name, find the `fallback_text:` value
 * that belongs to that step's `with:` block and return the unquoted string.
 *
 * The search scope is bounded to the step's own `with:` block: we locate the
 * step by name, then scan forward for `fallback_text:` and stop before the
 * next top-level step (`- name:` or `- uses:`).
 *
 * Handles double-quoted (`"value"`), single-quoted (`'value'`), and unquoted
 * (`value`) YAML scalar styles. Inline YAML comments (`# …`) are stripped
 * from unquoted values.
 */
export function extractFallbackText(yaml, stepName, filePath) {
  const stepIdx = yaml.indexOf(`name: ${stepName}`);
  if (stepIdx === -1) {
    throw new Error(`[${filePath}] Step not found: "${stepName}"`);
  }

  // Find the next step boundary so we don't stray into a sibling step.
  const nextStepIdx = yaml.indexOf('\n      - name:', stepIdx + 1);
  const scopeEnd = nextStepIdx === -1 ? yaml.length : nextStepIdx;

  const scope = yaml.slice(stepIdx, scopeEnd);

  // Match double-quoted (group 1), single-quoted (group 2), or unquoted (group 3).
  // For unquoted values, stop at an inline comment or end of line and trim.
  const match = scope.match(/fallback_text:\s*(?:"([^"]+)"|'([^']+)'|([^#\n'"][^\n]*))/);
  if (!match) {
    throw new Error(`[${filePath}] No fallback_text found for step "${stepName}"`);
  }
  // Groups 1 (double-quoted) and 2 (single-quoted) are already clean.
  // Group 3 (unquoted) may have a trailing inline YAML comment (` # …`).
  const raw = (match[1] ?? match[2] ?? match[3]).trim();
  return match[3] !== undefined ? raw.replace(/\s+#.*$/, '') : raw;
}

/**
 * Given a YAML file's text and a step name, find the `channel:` value
 * that belongs to that step's `with:` block and return the unquoted string.
 *
 * The search scope is bounded to the step's own `with:` block: we locate the
 * step by name, then scan forward for `channel:` and stop before the next
 * top-level step (`- name:` or `- uses:`).
 *
 * Handles double-quoted (`"value"`), single-quoted (`'value'`), and unquoted
 * (`value`) YAML scalar styles. Inline YAML comments (`# …`) are stripped
 * from unquoted values.
 */
export function extractChannelName(yaml, stepName, filePath) {
  const stepIdx = yaml.indexOf(`name: ${stepName}`);
  if (stepIdx === -1) {
    throw new Error(`[${filePath}] Step not found: "${stepName}"`);
  }

  // Find the next step boundary so we don't stray into a sibling step.
  const nextStepIdx = yaml.indexOf('\n      - name:', stepIdx + 1);
  const scopeEnd = nextStepIdx === -1 ? yaml.length : nextStepIdx;

  const scope = yaml.slice(stepIdx, scopeEnd);

  // Match double-quoted (group 1), single-quoted (group 2), or unquoted (group 3).
  // For unquoted values, stop at an inline comment or end of line and trim.
  const match = scope.match(/channel:\s*(?:"([^"]+)"|'([^']+)'|([^#\n'"][^\n]*))/);
  if (!match) {
    throw new Error(`[${filePath}] No channel found for step "${stepName}"`);
  }
  // Groups 1 (double-quoted) and 2 (single-quoted) are already clean.
  // Group 3 (unquoted) may have a trailing inline YAML comment (` # …`).
  const raw = (match[1] ?? match[2] ?? match[3]).trim();
  return match[3] !== undefined ? raw.replace(/\s+#.*$/, '') : raw;
}

/**
 * Return the body lines — everything except the icon+title header line
 * (:white_check_mark: ...) and the `*Run:*` line — joined with '\n'.
 */
function extractRecoveryBody(lines) {
  return lines
    .filter(l => !l.startsWith(':white_check_mark:') && !l.startsWith('*Run:*'))
    .join('\n');
}

// ── Main (only when run directly, not when imported for testing) ─────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const SCHEDULED_PATH = '.github/workflows/reviewer-login-scheduled.yml';
  const CICD_PATH = '.github/workflows/ci-cd.yml';

  const scheduledYaml = readFileSync(resolve(ROOT, SCHEDULED_PATH), 'utf8');
  const cicdYaml = readFileSync(resolve(ROOT, CICD_PATH), 'utf8');

  const CRED_FAILURE   = 'Notify Slack on reviewer credentials failure';
  const CRED_RECOVERY  = 'Notify Slack on reviewer credentials recovery';
  const SMOKE_FAILURE  = 'Notify Slack on reviewer login smoke-test failure';
  const SMOKE_RECOVERY = 'Notify Slack on reviewer login smoke-test recovery';

  const fields = [
    {
      label: 'credentials-failure Fix:',
      scheduled: extractFixLine(
        extractMarkdownLines(scheduledYaml, CRED_FAILURE, SCHEDULED_PATH),
        CRED_FAILURE, SCHEDULED_PATH,
      ),
      cicd: extractFixLine(
        extractMarkdownLines(cicdYaml, CRED_FAILURE, CICD_PATH),
        CRED_FAILURE, CICD_PATH,
      ),
    },
    {
      label: 'credentials-recovery body',
      scheduled: extractRecoveryBody(
        extractMarkdownLines(scheduledYaml, CRED_RECOVERY, SCHEDULED_PATH),
      ),
      cicd: extractRecoveryBody(
        extractMarkdownLines(cicdYaml, CRED_RECOVERY, CICD_PATH),
      ),
    },
    {
      label: 'smoke-test-failure Fix:',
      scheduled: extractFixLine(
        extractMarkdownLines(scheduledYaml, SMOKE_FAILURE, SCHEDULED_PATH),
        SMOKE_FAILURE, SCHEDULED_PATH,
      ),
      cicd: extractFixLine(
        extractMarkdownLines(cicdYaml, SMOKE_FAILURE, CICD_PATH),
        SMOKE_FAILURE, CICD_PATH,
      ),
    },
    {
      label: 'smoke-test-recovery body',
      scheduled: extractRecoveryBody(
        extractMarkdownLines(scheduledYaml, SMOKE_RECOVERY, SCHEDULED_PATH),
      ),
      cicd: extractRecoveryBody(
        extractMarkdownLines(cicdYaml, SMOKE_RECOVERY, CICD_PATH),
      ),
    },
    {
      label: 'credentials-failure fallback_text',
      scheduled: extractFallbackText(scheduledYaml, CRED_FAILURE, SCHEDULED_PATH),
      cicd: extractFallbackText(cicdYaml, CRED_FAILURE, CICD_PATH),
    },
    {
      label: 'credentials-recovery fallback_text',
      scheduled: extractFallbackText(scheduledYaml, CRED_RECOVERY, SCHEDULED_PATH),
      cicd: extractFallbackText(cicdYaml, CRED_RECOVERY, CICD_PATH),
    },
    {
      label: 'smoke-test-failure fallback_text',
      scheduled: extractFallbackText(scheduledYaml, SMOKE_FAILURE, SCHEDULED_PATH),
      cicd: extractFallbackText(cicdYaml, SMOKE_FAILURE, CICD_PATH),
    },
    {
      label: 'smoke-test-recovery fallback_text',
      scheduled: extractFallbackText(scheduledYaml, SMOKE_RECOVERY, SCHEDULED_PATH),
      cicd: extractFallbackText(cicdYaml, SMOKE_RECOVERY, CICD_PATH),
    },
    {
      label: 'credentials-failure channel',
      scheduled: extractChannelName(scheduledYaml, CRED_FAILURE, SCHEDULED_PATH),
      cicd: extractChannelName(cicdYaml, CRED_FAILURE, CICD_PATH),
    },
    {
      label: 'credentials-recovery channel',
      scheduled: extractChannelName(scheduledYaml, CRED_RECOVERY, SCHEDULED_PATH),
      cicd: extractChannelName(cicdYaml, CRED_RECOVERY, CICD_PATH),
    },
    {
      label: 'smoke-test-failure channel',
      scheduled: extractChannelName(scheduledYaml, SMOKE_FAILURE, SCHEDULED_PATH),
      cicd: extractChannelName(cicdYaml, SMOKE_FAILURE, CICD_PATH),
    },
    {
      label: 'smoke-test-recovery channel',
      scheduled: extractChannelName(scheduledYaml, SMOKE_RECOVERY, SCHEDULED_PATH),
      cicd: extractChannelName(cicdYaml, SMOKE_RECOVERY, CICD_PATH),
    },
  ];

  // ── Compare ────────────────────────────────────────────────────────────────

  let allPassed = true;

  for (const { label, scheduled, cicd } of fields) {
    if (scheduled === cicd) {
      console.log(`  PASS  ${label}`);
    } else {
      console.error(`  FAIL  ${label}`);
      console.error(`    ${SCHEDULED_PATH}:`);
      console.error(`      ${JSON.stringify(scheduled)}`);
      console.error(`    ${CICD_PATH}:`);
      console.error(`      ${JSON.stringify(cicd)}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error(
      '\nReviewer alert parity check FAILED.\n' +
      'Update the mismatched file so both workflows send identical Slack messages.\n' +
      `Files: ${SCHEDULED_PATH}  <->  ${CICD_PATH}`,
    );
    process.exit(1);
  }

  console.log('\nAll reviewer alert message fields match between the two workflow files.');
}
