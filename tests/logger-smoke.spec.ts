/**
 * F1 logger smoke test — Action Item V foundation deliverable.
 *
 * Confirms that the canonical structured logger (`server/lib/logger.ts`)
 * exports work end-to-end and that the object-form call pattern (the one
 * enforced by the `tabula/no-string-form-logger` ESLint rule) is testable.
 *
 * This is the foundation Phase 1.1 of the Care Access microservice build
 * needs: a known-working test runner + a known-working logger contract.
 *
 * Existing `tests/logger-redact.spec.ts` already proves PHI redaction
 * behavior against raw pino. This file complements it by exercising the
 * project's logger MODULE (not raw pino) and the supported call shapes.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { logger, getLogger } from "../server/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server/lib/logger — module surface (object-form contract)", () => {
  it("exports a working root logger with .info/.warn/.error methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("getLogger() returns a child logger bound to a component name", () => {
    const child = getLogger("smoke-test-component");
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
    expect(child).not.toBe(logger);
  });

  it("accepts the object-form call pattern without throwing", () => {
    expect(() => {
      logger.info({ requestId: "smoke-1", durationMs: 12 }, "smoke event");
    }).not.toThrow();
    expect(() => {
      logger.warn({ requestId: "smoke-2", attempt: 3 }, "retry exhausted");
    }).not.toThrow();
    expect(() => {
      logger.error(
        { err: new Error("smoke failure"), requestId: "smoke-3" },
        "operation failed",
      );
    }).not.toThrow();
  });

  it("child logger from getLogger() accepts object-form calls", () => {
    const child = getLogger("smoke-child");
    expect(() => {
      child.info({ phase: "1.1", step: "scaffold" }, "phase progress");
    }).not.toThrow();
  });
});
