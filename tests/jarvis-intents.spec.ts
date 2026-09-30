import { describe, it, expect } from "vitest";
import { routeCommand, greetingKey, JARVIS_SKILLS } from "@/lib/jarvis-intents";

describe("jarvis routeCommand", () => {
  it("returns empty for blank input", () => {
    expect(routeCommand("   ")).toEqual({ kind: "empty" });
  });

  it("navigates on an explicit open command with one keyword", () => {
    const r = routeCommand("Open drug interactions");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.skill.route).toBe("/drug-interactions");
  });

  it("navigates on a plain statement with a keyword", () => {
    const r = routeCommand("find a free clinic near me");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.skill.id).toBe("freeCare");
  });

  it("keeps single-keyword questions in chat", () => {
    expect(routeCommand("What does a high fever mean?").kind).toBe("ask");
  });

  it("navigates questions with strong keyword signal", () => {
    const r = routeCommand("Is it safe to take ibuprofen together with lisinopril?");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.skill.id).toBe("interactions");
  });

  it("falls through to ask when nothing matches, preserving original text", () => {
    expect(routeCommand("  Explain my cholesterol  ")).toEqual({ kind: "ask", question: "Explain my cholesterol" });
  });

  it("every skill has a unique id and absolute route", () => {
    const ids = new Set(JARVIS_SKILLS.map((s) => s.id));
    expect(ids.size).toBe(JARVIS_SKILLS.length);
    for (const s of JARVIS_SKILLS) expect(s.route.startsWith("/")).toBe(true);
  });
});

describe("jarvis greetingKey", () => {
  it("maps hours to greeting buckets", () => {
    expect(greetingKey(7)).toBe("jarvis.greeting.morning");
    expect(greetingKey(13)).toBe("jarvis.greeting.afternoon");
    expect(greetingKey(21)).toBe("jarvis.greeting.evening");
  });
});
