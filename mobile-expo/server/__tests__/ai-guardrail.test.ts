/**
 * AI Content Guardrail Pipeline — Unit Tests (Task #297)
 *
 * Tests verify:
 *   1. PHI scrubber removes sample identifiers
 *   2. Clinical-advice classifier correctly flags / passes phrases
 *   3. runGuardrails blocks hard-block patterns (safe: false)
 *   4. runGuardrails marks reviewRequired for clinical advice
 *   5. Clean informational content passes without modification
 *
 * Run via: npm run test:server  (tsx CJS runner)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scrubPHI,
  classifyClinicalAdvice,
  runGuardrails,
} from "../ai-guardrail-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// PHI Scrubber
// ─────────────────────────────────────────────────────────────────────────────

describe("scrubPHI", () => {
  it("redacts SSNs", () => {
    const { scrubbed } = scrubPHI("Patient SSN is 123-45-6789 on record.");
    assert.ok(!scrubbed.includes("123-45-6789"), "SSN should be redacted");
    assert.ok(scrubbed.includes("[REDACTED]"), "REDACTED token present");
  });

  it("redacts US phone numbers", () => {
    const { scrubbed } = scrubPHI("Call me at (555) 867-5309 for results.");
    assert.ok(!scrubbed.includes("867-5309"), "Phone should be redacted");
  });

  it("redacts MRN patterns", () => {
    const { scrubbed } = scrubPHI("MRN: ABC12345 was checked today.");
    assert.ok(!scrubbed.includes("ABC12345"), "MRN should be redacted");
  });

  it("redacts email addresses", () => {
    const { scrubbed } = scrubPHI("Email john.doe@hospital.org for follow-up.");
    assert.ok(!scrubbed.includes("john.doe@hospital.org"), "Email should be redacted");
  });

  it("redacts name-in-context patterns", () => {
    const { scrubbed } = scrubPHI("Patient: John Smith was seen today.");
    assert.ok(!scrubbed.includes("John Smith"), "Name-in-context should be redacted");
  });

  it("leaves clean text unchanged", () => {
    const input = "Your cholesterol levels are within a healthy range.";
    const { scrubbed, tokensReplaced } = scrubPHI(input);
    assert.equal(scrubbed, input, "Clean text unchanged");
    assert.equal(tokensReplaced, 0, "No tokens replaced");
  });

  it("reports tokensReplaced > 0 when PHI found", () => {
    const { tokensReplaced } = scrubPHI("SSN 999-88-7777 and phone 555-123-4567.");
    assert.ok(tokensReplaced > 0, "tokensReplaced should be positive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Advice Classifier
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyClinicalAdvice", () => {
  it("flags 'you should take'", () => {
    const r = classifyClinicalAdvice("You should take ibuprofen twice a day.");
    assert.ok(r.reviewRequired, "Should be flagged");
    assert.ok(r.blockedPhrases.length > 0, "Blocked phrases present");
  });

  it("flags 'I recommend'", () => {
    const r = classifyClinicalAdvice("Based on your labs, I recommend increasing your dose.");
    assert.ok(r.reviewRequired, "Should be flagged");
  });

  it("flags 'stop your medication'", () => {
    const r = classifyClinicalAdvice("You can stop taking your medication after 5 days.");
    assert.ok(r.reviewRequired, "Should be flagged");
  });

  it("flags 'your diagnosis is'", () => {
    const r = classifyClinicalAdvice("Your diagnosis is type 2 diabetes.");
    assert.ok(r.reviewRequired, "Should be flagged");
  });

  it("flags 'go to the ER'", () => {
    const r = classifyClinicalAdvice("You should go to the emergency room right now.");
    assert.ok(r.reviewRequired, "Should be flagged");
  });

  it("does NOT flag informational content", () => {
    const r = classifyClinicalAdvice(
      "Cholesterol is a fatty substance found in your blood. High levels can increase heart disease risk. Ask your care team about your numbers."
    );
    assert.ok(!r.reviewRequired, "Informational content should pass");
    assert.equal(r.blockedPhrases.length, 0, "No blocked phrases");
  });

  it("does NOT flag 'your care team recommends' (indirect)", () => {
    const r = classifyClinicalAdvice(
      "Your care team may discuss treatment options with you at your next visit."
    );
    assert.ok(!r.reviewRequired, "Indirect phrasing should pass");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runGuardrails — integration
// ─────────────────────────────────────────────────────────────────────────────

describe("runGuardrails", () => {
  it("returns safe=false for hard-block content", async () => {
    const result = await runGuardrails("Here's how to overdose on acetaminophen safely.", {
      skipQueuePersistence: true,
    });
    assert.equal(result.safe, false, "Hard-block content should return safe=false");
  });

  it("returns reviewRequired=true for clinical advice", async () => {
    const result = await runGuardrails(
      "Based on your labs, I recommend you stop your medication immediately.",
      { skipQueuePersistence: true }
    );
    assert.ok(result.safe, "Should be safe (not hard-blocked)");
    assert.ok(result.reviewRequired, "Should require review");
    assert.ok(result.blockedPhrases.length > 0, "Blocked phrases present");
  });

  it("replaces reviewed output with hold message", async () => {
    const result = await runGuardrails(
      "I recommend taking aspirin daily.",
      { skipQueuePersistence: true }
    );
    assert.ok(result.reviewRequired, "Should be flagged");
    assert.ok(
      result.output.includes("care team") || result.output.includes("clinician"),
      "Output should contain care team hold message"
    );
    assert.ok(!result.output.includes("aspirin"), "Original content should be suppressed");
  });

  it("passes clean informational content without review", async () => {
    const input = "Cholesterol is measured in your blood. There are two types: HDL and LDL. Ask your care team about your results.";
    const result = await runGuardrails(input, { skipQueuePersistence: true });
    assert.ok(result.safe, "Should be safe");
    assert.ok(!result.reviewRequired, "Should not require review");
    assert.ok(result.output.includes("Cholesterol"), "Output preserves content");
  });

  it("scrubs PHI from output", async () => {
    const result = await runGuardrails(
      "Patient: John Smith (SSN 123-45-6789) has normal cholesterol. Ask your care team.",
      { skipQueuePersistence: true }
    );
    assert.ok(!result.output.includes("John Smith"), "Name should be redacted");
    assert.ok(!result.output.includes("123-45-6789"), "SSN should be redacted");
    assert.ok(result.phiTokensReplaced > 0, "PHI tokens replaced count > 0");
  });
});
