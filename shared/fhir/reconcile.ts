/**
 * Reconciliation that does not invent a clinical fact.
 *
 * Automatic grouping is limited to the same instance: a replay of one
 * source resource, or two copies that carry the same instance identifier
 * (an accession or source id, not a terminology code).
 *
 * Terminology, clock time, and model scores never merge medications,
 * allergies, problems, labs, or vitals. Those become confirmation
 * candidates. Device streams never match on a value. A calendar day
 * without a time zone is not a key. entered-in-error stays stored and
 * stays out of the current view.
 *
 * Nothing here deletes a source record.
 */

export type IngestSource =
  | "fasten"
  | "direct-smart"
  | "cms-blue-button"
  | "payer-access"
  | "device"
  | "patient-entered"
  | "upload"
  | "records-request";

export type ClinicalClass = "medication" | "allergy" | "problem" | "lab" | "vital" | "device-stream" | "other";

export interface Coding {
  system: string;
  code: string;
}

export interface IncomingFhirRecord {
  patientId: string;
  source: IngestSource;
  sourceSystem: string;
  resourceType: string;
  sourceResourceId: string;
  identifiers: readonly { system: string; value: string }[];
  codings: readonly Coding[];
  /**
   * Absolute instant, ISO-8601 with a offset or Z.
   * A bare calendar day is not accepted as a match key.
   */
  effectiveInstant?: string;
  timeZone?: string;
  valueKey?: string;
  encounterId?: string;
  status?: string;
  clinicalClass: ClinicalClass;
}

export const CANONICAL_CODE_SYSTEMS = {
  rxnorm: "http://www.nlm.nih.gov/research/umls/rxnorm",
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
} as const;

/** Classes a model score is not allowed to merge. */
export const NEVER_AUTO_MERGE: readonly ClinicalClass[] = ["medication", "allergy", "problem", "lab", "vital", "device-stream"];

/** A suggestion at or above this score may be shown. It still does not merge a clinical fact. */
export const SUGGESTION_THRESHOLD = 0.9;

const TERMINOLOGY_SYSTEMS = new Set<string>(Object.values(CANONICAL_CODE_SYSTEMS));
const MEDICATION_TYPES = new Set(["MedicationRequest", "MedicationStatement", "MedicationDispense", "ExplanationOfBenefit"]);

export interface ProvenanceMember {
  record: IncomingFhirRecord;
  match: "source" | "same-instance";
}

export interface ReconciledGroup {
  patientId: string;
  resourceType: string;
  members: ProvenanceMember[];
  algorithm: "same-instance" | "singleton";
  conflict: boolean;
  /** entered-in-error copies stay stored and out of the current view. */
  suppressed: boolean;
}

export interface ConfirmationCandidate {
  left: IncomingFhirRecord;
  right: IncomingFhirRecord;
  reason: "shared-terminology-across-records" | "semantic-suggestion";
  /** Always true for medications, allergies, and problems. */
  requiresPatientConfirmation: boolean;
}

export interface SemanticDecision {
  same: boolean;
  score: number;
  model: string;
}

function memberIdentity(record: IncomingFhirRecord): string {
  return [record.patientId, record.source, record.sourceSystem, record.resourceType, record.sourceResourceId].join("\u001f");
}

export function hasExplicitOffset(instant: string | undefined): boolean {
  if (!instant) return false;
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(instant.trim());
}

export function terminologyStatus(coding: Coding): "canonical" | "unmapped" {
  const system = coding.system.trim();
  const code = coding.code.trim();
  if (!system || !code) return "unmapped";
  return TERMINOLOGY_SYSTEMS.has(system) ? "canonical" : "unmapped";
}

function instanceKeys(record: IncomingFhirRecord): string[] {
  const keys: string[] = [];
  for (const identifier of record.identifiers) {
    const system = identifier.system.trim();
    const value = identifier.value.trim();
    if (!system || !value || TERMINOLOGY_SYSTEMS.has(system)) continue;
    keys.push(`${record.patientId}|${system}|${value}`);
  }
  return keys;
}

function canonicalKeys(record: IncomingFhirRecord, system: string): string[] {
  const keys: string[] = [];
  for (const coding of record.codings) {
    if (coding.system.trim() !== system || !coding.code.trim()) continue;
    keys.push(coding.code.trim());
  }
  return keys;
}

function sharesCode(left: IncomingFhirRecord, right: IncomingFhirRecord, system: string): boolean {
  const rightKeys = new Set(canonicalKeys(right, system));
  return canonicalKeys(left, system).some((code) => rightKeys.has(code));
}

function isError(record: IncomingFhirRecord): boolean {
  return (record.status ?? "").toLowerCase() === "entered-in-error";
}

function medicationFamily(record: IncomingFhirRecord): boolean {
  return record.clinicalClass === "medication" || MEDICATION_TYPES.has(record.resourceType);
}

class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }
  find(index: number): number {
    let current = index;
    while (this.parent[current] !== current) {
      this.parent[current] = this.parent[this.parent[current]];
      current = this.parent[current];
    }
    return current;
  }
  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent[rightRoot] = leftRoot;
  }
}

export function reconcileRecords(records: readonly IncomingFhirRecord[]): {
  groups: ReconciledGroup[];
  confirmationCandidates: ConfirmationCandidate[];
} {
  const unique: IncomingFhirRecord[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const key = memberIdentity(record);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }

  const unionFind = new UnionFind(unique.length);
  const instances = new Map<string, number>();
  unique.forEach((record, index) => {
    if (isError(record) || record.clinicalClass === "device-stream") return;
    for (const key of instanceKeys(record)) {
      const previous = instances.get(key);
      if (previous === undefined) instances.set(key, index);
      else if (!isError(unique[previous])) unionFind.union(previous, index);
    }
  });

  const buckets = new Map<number, number[]>();
  unique.forEach((_, index) => {
    const root = unionFind.find(index);
    const list = buckets.get(root) ?? [];
    list.push(index);
    buckets.set(root, list);
  });

  const groups: ReconciledGroup[] = [];
  for (const indexes of buckets.values()) {
    const members = indexes.map((index) => unique[index]);
    const values = new Set(members.map((record) => record.valueKey).filter((value) => value));
    const suppressed = members.every(isError);
    groups.push({
      patientId: members[0].patientId,
      resourceType: members[0].resourceType,
      algorithm: indexes.length > 1 ? "same-instance" : "singleton",
      conflict: indexes.length > 1 && values.size > 1,
      suppressed,
      members: members.map((record, memberIndex) => ({
        record,
        match: indexes.length > 1 && memberIndex > 0 ? "same-instance" : "source",
      })),
    });
  }

  const confirmationCandidates: ConfirmationCandidate[] = [];
  for (let leftIndex = 0; leftIndex < unique.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex++) {
      const left = unique[leftIndex];
      const right = unique[rightIndex];
      if (left.patientId !== right.patientId || isError(left) || isError(right)) continue;
      if (unionFind.find(leftIndex) === unionFind.find(rightIndex) && instanceKeys(left).length > 0) continue;
      const medication = medicationFamily(left) && medicationFamily(right) && sharesCode(left, right, CANONICAL_CODE_SYSTEMS.rxnorm);
      const allergy = left.clinicalClass === "allergy" && right.clinicalClass === "allergy" && (sharesCode(left, right, CANONICAL_CODE_SYSTEMS.snomed) || sharesCode(left, right, CANONICAL_CODE_SYSTEMS.rxnorm));
      const problem = left.clinicalClass === "problem" && right.clinicalClass === "problem" && sharesCode(left, right, CANONICAL_CODE_SYSTEMS.snomed);
      if (!medication && !allergy && !problem) continue;
      confirmationCandidates.push({
        left,
        right,
        reason: "shared-terminology-across-records",
        requiresPatientConfirmation: true,
      });
    }
  }

  return { groups, confirmationCandidates };
}

/**
 * A model decision never merges a clinical fact. At or above the suggestion
 * threshold it can add a confirmation candidate. Below the threshold it
 * changes nothing.
 */
export function applySemanticDecision(
  groups: readonly ReconciledGroup[],
  left: IncomingFhirRecord,
  right: IncomingFhirRecord,
  decision: SemanticDecision,
): { groups: ReconciledGroup[]; confirmationCandidates: ConfirmationCandidate[] } {
  const cloned = groups.map((group) => ({ ...group, members: group.members.map((member) => ({ ...member })) }));
  const clinical = NEVER_AUTO_MERGE.includes(left.clinicalClass) || NEVER_AUTO_MERGE.includes(right.clinicalClass);
  if (!decision.same || decision.score < SUGGESTION_THRESHOLD || left.patientId !== right.patientId) {
    return { groups: cloned, confirmationCandidates: [] };
  }
  if (clinical) {
    return {
      groups: cloned,
      confirmationCandidates: [{
        left,
        right,
        reason: "semantic-suggestion",
        requiresPatientConfirmation: true,
      }],
    };
  }
  return { groups: cloned, confirmationCandidates: [] };
}

export function sourceRecordCount(groups: readonly ReconciledGroup[]): number {
  return groups.reduce((total, group) => total + group.members.length, 0);
}
