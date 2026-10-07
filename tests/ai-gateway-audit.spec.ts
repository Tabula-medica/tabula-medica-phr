import { describe, it, expect, vi, beforeEach } from "vitest";

const { info, error, generateContent } = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock("../server/lib/logger", () => ({
  getLogger: () => ({ info, error }),
}));
vi.mock("@google-cloud/vertexai", () => ({
  VertexAI: class {
    getGenerativeModel() {
      return { generateContent };
    }
  },
}));

import { generatePhiSafeText } from "../server/services/ai-gateway";

describe("ai-gateway audit logging (governance step 3)", () => {
  beforeEach(() => {
    info.mockReset();
    error.mockReset();
    generateContent.mockReset();
  });

  it("logs metadata only, never prompt or output text", async () => {
    generateContent.mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: "SECRET-OUTPUT" }] } }] },
    });
    await generatePhiSafeText({ user: "SECRET-PROMPT Jane Doe", purpose: "unit-test" });
    expect(info).toHaveBeenCalledTimes(1);
    const [fields, msg] = info.mock.calls[0];
    expect(msg).toBe("ai_gateway_call");
    expect(fields).toMatchObject({ kind: "text", purpose: "unit-test", outcome: "ok", promptChars: 22 });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/SECRET|Jane/);
  });

  it("logs failures and rethrows without falling back", async () => {
    generateContent.mockRejectedValue(new Error("boom SECRET-PROMPT"));
    await expect(generatePhiSafeText({ user: "x" })).rejects.toThrow("boom");
    expect(error.mock.calls[0][0]).toMatchObject({ outcome: "error", purpose: "unspecified" });
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/SECRET/);
  });
});
