import { describe, it, expect } from "vitest";
import {
  assertPublicUrl,
  assertNonIdentifyingQuery,
  NonPhiInputError,
} from "../server/lib/firecrawl-client";

describe("firecrawl non-PHI boundary: assertPublicUrl", () => {
  it("accepts a public https URL and strips the fragment", () => {
    expect(assertPublicUrl("https://www.cdc.gov/flu/index.html#top").toString()).toBe(
      "https://www.cdc.gov/flu/index.html",
    );
  });

  it.each([
    ["http://www.cdc.gov/", "https"],
    ["https://user:pw@example.com/", "credentials"],
    ["https://example.com/page?patientId=123", "query"],
    ["https://10.0.0.5/", "IP-literal"],
    ["https://[::1]/", "IP-literal"],
    ["https://localhost/", "not allowed"],
    ["https://app.tabulamedica.com/records", "not allowed"],
    ["https://db.internal/", "not allowed"],
    ["not a url", "Invalid"],
  ])("rejects %s", (url, msg) => {
    expect(() => assertPublicUrl(url)).toThrow(NonPhiInputError);
    expect(() => assertPublicUrl(url)).toThrow(new RegExp(msg, "i"));
  });
});

describe("firecrawl non-PHI boundary: assertNonIdentifyingQuery", () => {
  it("accepts generic research queries", () => {
    expect(assertNonIdentifyingQuery("  metformin patient education 2026 ")).toBe(
      "metformin patient education 2026",
    );
  });

  it.each([
    "jane.doe@example.com lab results",
    "123-45-6789",
    "call (415) 555-0123",
    "born 03/14/1985 diabetes",
    "MRN 00123456",
    "",
    "x".repeat(201),
  ])("rejects %j", (q) => {
    expect(() => assertNonIdentifyingQuery(q)).toThrow(NonPhiInputError);
  });
});
