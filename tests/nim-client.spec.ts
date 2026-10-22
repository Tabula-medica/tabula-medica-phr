import { describe, it, expect, afterEach, vi } from "vitest";
import { assertNonPhiText, nimChat, isNimConfigured, NonPhiInputError } from "../server/lib/nim-client";

describe("nim-client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NVIDIA_API_KEY;
  });

  it("rejects text that looks like an identifier", () => {
    for (const bad of ["call 555-123-4567", "ssn 123-45-6789", "a@b.com", "dob 01/02/1980", "MRN 12345678", ""]) {
      expect(() => assertNonPhiText(bad)).toThrow(NonPhiInputError);
    }
  });

  it("accepts public text", () => {
    expect(assertNonPhiText("  Explain generic metformin pricing  ")).toBe("Explain generic metformin pricing");
  });

  it("fails closed without an API key", async () => {
    expect(isNimConfigured()).toBe(false);
    await expect(nimChat("m", [{ role: "user", content: "hello" }])).rejects.toThrow("NVIDIA_API_KEY");
  });

  it("screens before any network call", async () => {
    process.env.NVIDIA_API_KEY = "test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(nimChat("m", [{ role: "user", content: "ssn 123-45-6789" }])).rejects.toThrow(NonPhiInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the completion text", async () => {
    process.env.NVIDIA_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "hi" } }] }) }));
    expect(await nimChat("m", [{ role: "user", content: "hello" }])).toBe("hi");
  });
});
