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

  it("does not merge on date of birth agreement alone", () => {
    const other: IdentityCandidate = {
      firstName: "John",
      lastName: "Smith",
      dateOfBirth: base.dateOfBirth,
      email: "john.smith@example.com",
      phone: "202-555-9999",
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("none");
  });

  it("rates DOB + last name only as low confidence", () => {
    const other: IdentityCandidate = {
      firstName: "Janet",
      lastName: "Doe",
      dateOfBirth: base.dateOfBirth,
      email: "different@example.com",
      phone: "202-555-0000",
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("low");
    expect(result.matchedFields).toContain("lastName");
  });

  it("rates DOB + last name + first name as medium confidence", () => {
    const other: IdentityCandidate = {
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: base.dateOfBirth,
      email: "unrelated@example.com",
      phone: "202-555-0000",
    };
    const result = computeIdentityMatch(base, other);
    expect(result.confidence).toBe("medium");
  });

  it("rates DOB + name + email or phone as high confidence", () => {
    const other: IdentityCandidate = { ...base, phone: "202-555-0000" }; // email still matches
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
