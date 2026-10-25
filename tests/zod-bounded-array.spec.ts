import { describe, it, expect } from "vitest";
import { z } from "zod";
import { boundedArray, nonEmptyBoundedArray } from "../server/lib/zod-helpers";

describe("boundedArray", () => {
  const item = z.object({ name: z.string() });
  const schema = boundedArray(item, 3);

  it("accepts an array within the cap", () => {
    const result = schema.safeParse([{ name: "a" }, { name: "b" }]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([{ name: "a" }, { name: "b" }]);
    }
  });

  it("rejects a non-array without treating it as elements", () => {
    const result = schema.safeParse("nope");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe("invalid_type");
    }
  });

  it("still reports element errors when the array is within the cap", () => {
    const result = schema.safeParse([{}]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 0)).toBe(true);
    }
  });

  it("does not walk elements once the array exceeds the cap (CVE-2023-54404)", () => {
    // Zod 3's z.array().max() still emits one issue per failing element.
    // An over-cap payload must stop at the single too_big issue.
    const payload = Array.from({ length: 5000 }, () => ({}));
    const result = schema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe("too_big");
    }
  });

  it("chains .optional() correctly", () => {
    const opt = boundedArray(z.string(), 5).optional();
    expect(opt.safeParse(undefined).success).toBe(true);
    expect(opt.safeParse(["a"]).success).toBe(true);
    expect(opt.safeParse(Array(10).fill("x")).success).toBe(false);
  });
});

describe("nonEmptyBoundedArray", () => {
  const schema = nonEmptyBoundedArray(z.string(), 3);

  it("rejects an empty array", () => {
    expect(schema.safeParse([]).success).toBe(false);
  });

  it("accepts a non-empty array within the cap", () => {
    expect(schema.safeParse(["a"]).success).toBe(true);
  });

  it("stops at one issue when the array exceeds the cap", () => {
    const result = schema.safeParse(Array.from({ length: 4000 }, () => "x"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe("too_big");
    }
  });
});

describe("createWorkflowSchema arrays are bounded", () => {
  it("caps every unbounded array on the create schema", () => {
    const { readFileSync } = require("node:fs");
    const { fileURLToPath } = require("node:url");
    const source = readFileSync(
      new URL("../server/ai-fhir-workflow-orchestrator-routes.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("boundedArray(workflowTriggerSchema, 50)");
    expect(source).toContain("boundedArray(workflowStepSchema, 100)");
    expect(source).not.toMatch(/triggers:\s*z\.array\(workflowTriggerSchema\)/);
    expect(source).not.toMatch(/steps:\s*z\.array\(workflowStepSchema\)/);
    expect(source).not.toMatch(/tags:\s*z\.array\(z\.string\(\)\)\.default\(\[\]\)/);
  });
});
