import { describe, expect, it } from "vitest";
import { DISCOVER_ITEMS, discoverItemSchema, playableItems } from "../shared/discover-feed";

describe("discover feed manifest", () => {
  it("every item satisfies the schema", () => {
    for (const item of DISCOVER_ITEMS) expect(discoverItemSchema.safeParse(item).success).toBe(true);
  });

  it("only verified, self-hosted items are playable", () => {
    const base = DISCOVER_ITEMS[0];
    const verified = { ...base, status: "verified" as const, file: "/discover/x.mp4" };
    expect(playableItems([base, verified])).toEqual([verified]);
  });

  it("rejects verified items without a file and third-party hosts", () => {
    const base = DISCOVER_ITEMS[0];
    expect(discoverItemSchema.safeParse({ ...base, status: "verified" }).success).toBe(false);
    expect(discoverItemSchema.safeParse({ ...base, file: "https://cdn.example.com/a.mp4" }).success).toBe(false);
  });
});
