import { describe, expect, it } from "vitest";
import {
  computeIdentityMatch,
  shouldMerge,
  weakerConfidence,
  type IdentityCandidate,
} from "../server/services/patient-identity-matching";

const base: IdentityCandidate = {
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1985-03-14",
  email: "jane.doe@example.com",
  phone: "571-555-0123",
};

describe("computeIdentityMatch", () => {
  it("never matches when date of birth differs, even with identical names/contact", () => {
    const other: IdentityCandidate = { ...base, dateOfBirth: "1985-03-15" };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("none");
    expect(result.matchedFields).toEqual([]);
  });

  it("never matches when either date of birth is missing", () => {
    expect(computeIdentityMatch(base, { ...base, dateOfBirth: "" }).confidence).toBe("none");
    expect(computeIdentityMatch({ ...base, dateOfBirth: "" }, base).confidence).toBe("none");
  });

  it("does not merge on date of birth agreement alone (no other fields provided)", () => {
    const other: IdentityCandidate = {
      firstName: "",
      lastName: "",
      dateOfBirth: base.dateOfBirth,
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("none");
  });

  it("blocks the match when any populated field explicitly disagrees, even with 3 other fields agreeing", () => {
    // Same DOB, first name, and last name, but two independently-provided,
    // non-empty contact fields disagree — that's stronger evidence of two
    // different people than the name agreement is evidence of one, so this
    // must NOT reach "medium"/auto-merge just because email/phone were
    // silently ignored.
    const other: IdentityCandidate = {
      firstName: base.firstName,
      lastName: base.lastName,
      dateOfBirth: base.dateOfBirth,
      email: "someoneelse@example.com",
      phone: "202-555-0000",
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("none");
    expect(shouldMerge(result.confidence)).toBe(false);
  });

  it("rates DOB + last name only as low confidence (other fields simply not provided, not conflicting)", () => {
    const other: IdentityCandidate = {
      firstName: "",
      lastName: "Doe",
      dateOfBirth: base.dateOfBirth,
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("low");
    expect(result.matchedFields).toContain("lastName");
  });

  it("rates DOB + last name + first name as medium confidence (contact fields not provided)", () => {
    const other: IdentityCandidate = {
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: base.dateOfBirth,
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("medium");
  });

  it("rates DOB + name + email as high confidence when phone isn't provided on either side", () => {
    const other: IdentityCandidate = { ...base, phone: "" };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("high");
    expect(result.matchedFields).toEqual(
      expect.arrayContaining(["dateOfBirth", "lastName", "firstName", "email"]),
    );
  });

  it("normalizes case, whitespace, and phone formatting", () => {
    const other: IdentityCandidate = {
      firstName: "  JANE ",
      lastName: "doe",
      dateOfBirth: "1985-03-14T00:00:00.000Z",
      email: "  Jane.Doe@Example.com ",
      phone: "(571) 555-0123",
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("high");
  });
});

describe("shouldMerge", () => {
  it("only trusts high and medium confidence", () => {
    expect(shouldMerge("high")).toBe(true);
    expect(shouldMerge("medium")).toBe(true);
    expect(shouldMerge("low")).toBe(false);
    expect(shouldMerge("none")).toBe(false);
  });
});

describe("weakerConfidence", () => {
  it("returns the lower-ranked confidence of the two", () => {
    expect(weakerConfidence("high", "medium")).toBe("medium");
    expect(weakerConfidence("medium", "high")).toBe("medium");
    expect(weakerConfidence("high", "high")).toBe("high");
    expect(weakerConfidence("low", "none")).toBe("none");
  });
});
