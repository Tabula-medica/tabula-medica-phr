/**
 * Compare a connected chart's Patient demographics to the signed-in member
 * before any import enters that member's compartment.
 * Missing name or birth date does not count as a match.
 */

export interface Demographics {
  familyName?: string;
  birthDate?: string;
}

export type DemographicMatch = "same-person" | "mismatch" | "insufficient";

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDate(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function compareDemographics(member: Demographics, source: Demographics): DemographicMatch {
  const memberName = normalizeName(member.familyName);
  const sourceName = normalizeName(source.familyName);
  const memberDob = normalizeDate(member.birthDate);
  const sourceDob = normalizeDate(source.birthDate);
  if (!memberName || !sourceName || !memberDob || !sourceDob) return "insufficient";
  if (memberName === sourceName && memberDob === sourceDob) return "same-person";
  return "mismatch";
}
