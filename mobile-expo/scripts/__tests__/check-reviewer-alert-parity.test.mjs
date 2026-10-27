#!/usr/bin/env node
/**
 * Unit tests for extractFallbackText and extractChannelName in
 * check-reviewer-alert-parity.mjs.
 *
 * Exercises double-quoted, single-quoted, and unquoted YAML scalar styles, as
 * well as the step-not-found and value-not-found error paths.
 *
 * Run with: node scripts/__tests__/check-reviewer-alert-parity.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFallbackText, extractChannelName } from '../check-reviewer-alert-parity.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal YAML snippet that looks like a real workflow step block,
 * just enough for extractFallbackText and extractChannelName to parse correctly.
 */
function makeYaml(fallbackLine, channelLine = "channel: '#ops-releases'") {
  return `
      - name: My Step
        uses: someaction@v1
        with:
          ${channelLine}
          ${fallbackLine}
      - name: Next Step
        run: echo done
`;
}

/**
 * Build a minimal YAML snippet that places a channel line at a given position,
 * without a fallback_text, for exercising extractChannelName in isolation.
 */
function makeYamlChannel(channelLine) {
  return `
      - name: My Step
        uses: someaction@v1
        with:
          ${channelLine}
          fallback_text: "Some alert"
      - name: Next Step
        run: echo done
`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('double-quoted fallback_text value is extracted correctly', () => {
  const yaml = makeYaml('fallback_text: "Reviewer credentials check FAILED"');
  const result = extractFallbackText(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'Reviewer credentials check FAILED');
});

test('single-quoted fallback_text value is extracted correctly', () => {
  const yaml = makeYaml("fallback_text: 'Reviewer credentials check FAILED'");
  const result = extractFallbackText(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'Reviewer credentials check FAILED');
});

test('unquoted fallback_text value is extracted correctly', () => {
  const yaml = makeYaml('fallback_text: Reviewer credentials check FAILED');
  const result = extractFallbackText(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'Reviewer credentials check FAILED');
});

test('unquoted fallback_text with trailing inline comment strips the comment', () => {
  const yaml = makeYaml('fallback_text: Alert fired # keep short');
  const result = extractFallbackText(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'Alert fired');
});

test('all three quoting styles return the same value for identical text', () => {
  const text = 'Smoke-test login FAILED';
  const dq = extractFallbackText(makeYaml(`fallback_text: "${text}"`), 'My Step', 'f.yml');
  const sq = extractFallbackText(makeYaml(`fallback_text: '${text}'`), 'My Step', 'f.yml');
  const uq = extractFallbackText(makeYaml(`fallback_text: ${text}`), 'My Step', 'f.yml');
  assert.equal(dq, text);
  assert.equal(sq, text);
  assert.equal(uq, text);
});

test('throws when the named step is not present', () => {
  const yaml = makeYaml('fallback_text: "some value"');
  assert.throws(
    () => extractFallbackText(yaml, 'Nonexistent Step', 'test.yml'),
    /Step not found: "Nonexistent Step"/,
  );
});

test('throws when fallback_text key is missing from the step scope', () => {
  const yaml = `
      - name: My Step
        uses: someaction@v1
        with:
          channel: '#ops'
      - name: Next Step
        run: echo done
`;
  assert.throws(
    () => extractFallbackText(yaml, 'My Step', 'test.yml'),
    /No fallback_text found for step "My Step"/,
  );
});

test('does not bleed into a sibling step to find fallback_text', () => {
  const yaml = `
      - name: First Step
        uses: someaction@v1
        with:
          channel: '#ops-releases'
      - name: Second Step
        uses: someaction@v1
        with:
          fallback_text: "Only in second step"
`;
  assert.throws(
    () => extractFallbackText(yaml, 'First Step', 'test.yml'),
    /No fallback_text found for step "First Step"/,
  );
});

// ── extractChannelName tests ──────────────────────────────────────────────────

test('double-quoted channel value is extracted correctly', () => {
  const yaml = makeYamlChannel('channel: "#ops-releases"');
  const result = extractChannelName(yaml, 'My Step', 'test.yml');
  assert.equal(result, '#ops-releases');
});

test('single-quoted channel value is extracted correctly', () => {
  const yaml = makeYamlChannel("channel: '#ops-releases'");
  const result = extractChannelName(yaml, 'My Step', 'test.yml');
  assert.equal(result, '#ops-releases');
});

test('unquoted channel value is extracted correctly', () => {
  const yaml = makeYamlChannel('channel: ops-releases');
  const result = extractChannelName(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'ops-releases');
});

test('unquoted channel value with trailing inline comment strips the comment', () => {
  const yaml = makeYamlChannel('channel: ops-releases # destination');
  const result = extractChannelName(yaml, 'My Step', 'test.yml');
  assert.equal(result, 'ops-releases');
});

test('all three quoting styles return the same value for the same channel name', () => {
  const channel = '#ops-releases';
  const dq = extractChannelName(makeYamlChannel(`channel: "${channel}"`), 'My Step', 'f.yml');
  const sq = extractChannelName(makeYamlChannel(`channel: '${channel}'`), 'My Step', 'f.yml');
  assert.equal(dq, channel);
  assert.equal(sq, channel);
});

test('extractChannelName throws when the named step is not present', () => {
  const yaml = makeYamlChannel("channel: '#ops-releases'");
  assert.throws(
    () => extractChannelName(yaml, 'Nonexistent Step', 'test.yml'),
    /Step not found: "Nonexistent Step"/,
  );
});

test('extractChannelName throws when channel key is missing from the step scope', () => {
  const yaml = `
      - name: My Step
        uses: someaction@v1
        with:
          fallback_text: "Some alert"
      - name: Next Step
        run: echo done
`;
  assert.throws(
    () => extractChannelName(yaml, 'My Step', 'test.yml'),
    /No channel found for step "My Step"/,
  );
});

test('extractChannelName does not bleed into a sibling step to find channel', () => {
  const yaml = `
      - name: First Step
        uses: someaction@v1
        with:
          fallback_text: "Some alert"
      - name: Second Step
        uses: someaction@v1
        with:
          channel: '#ops-releases'
`;
  assert.throws(
    () => extractChannelName(yaml, 'First Step', 'test.yml'),
    /No channel found for step "First Step"/,
  );
});
