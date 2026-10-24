/**
 * Deterministic reconciliation for FHIR already stored in the Cloud
 * Healthcare API FHIR store.
 *
 * Order of use:
 * 1. Call `reconcileDeterministic` (identifiers, canonical codes, date, value).
 * 2. Normalize terminology to RxNorm, LOINC, or SNOMED before that call when
 *    a mapping is known. Unmapped codes stay unmapped.
 * 3. Send `semanticCandidates` only to Vertex (Healthcare Natural Language
 *    API or embeddings) under the Google Cloud BAA, with data logging off.
 *    Apply the decision with `applySemanticDecision`.
 *
 * Source records stay members of a group. This module has no delete.
 */

export type IngestSource =
  | "fasten"
  | "direct-smart"
  | "cms-blue-button"
  | "device"
  | "patient-entered"
  | "upload";

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
  /** Calendar day, YYYY-MM-DD. */
  effectiveDate?: string;
  /** Quantity already converted to one UCUM unit, e.g. "10|mg". */
  valueKey?: string;
}

export const CANONICAL_CODE_SYSTEMS = {
  rxnorm: "http://www.nlm.nih.gov/research/umls/rxnorm",
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
} as const;

const CANONICAL_SET = new Set<string>(Object.values(CANONICAL_CODE_SYSTEMS));

export function terminologyStatus(coding: Coding): "canonical" | "unmapped" {
  const system = coding.system.trim();
  const code = coding.code.trim();
  if (!system || !code) return "unmapped";
  return CANONICAL_SET.has(system) ? "canonical" : "unmapped";
}

export interface ProvenanceMember {
  record: IncomingFhirRecord;
  match: "source" | "deterministic" | "semantic";
}

export interface ReconciledGroup {
  patientId: string;
  resourceType: string;
  members: ProvenanceMember[];
  algorithm: "deterministic" | "semantic" | "singleton";
}

export interface SemanticCandidatePair {
  left: IncomingFhirRecord;
  right: IncomingFhirRecord;
  reason: "unresolved-terminology";
}

export interface ValueConflict {
  left: IncomingFhirRecord;
  right: IncomingFhirRecord;
  reason: "same-code-different-value";
}

export interface SemanticDecision {
  same: boolean;
  score: number;
  model: string;
}

function memberIdentity(record: IncomingFhirRecord): string {
  return [record.patientId, record.source, record.sourceSystem, record.resourceType, record.sourceResourceId].join("\u001f");
}

function canonicalCodeKeys(record: IncomingFhirRecord): string[] {
  const keys: string[] = [];
  for (const coding of record.codings) {
    if (terminologyStatus(coding) !== "canonical") continue;
    keys.push(`${coding.system.trim()}|${coding.code.trim()}`);
  }
  return keys;
}

function identifierKeys(record: IncomingFhirRecord): string[] {
  const keys: string[] = [];
  for (const identifier of record.identifiers) {
    const system = identifier.system.trim();
    const value = identifier.value.trim();
    if (!system || !value) continue;
    keys.push(`${record.patientId}|${record.resourceType}|${system}|${value}`);
  }
  return keys;
}

function factKey(record: IncomingFhirRecord): string | null {
  const codes = canonicalCodeKeys(record);
  if (codes.length === 0 || !record.effectiveDate || !record.valueKey) return null;
  const code = [...codes].sort()[0];
  return `${record.patientId}|${record.resourceType}|${code}|${record.effectiveDate}|${record.valueKey}`;
}

function sharesCanonicalCode(left: IncomingFhirRecord, right: IncomingFhirRecord): boolean {
  const rightKeys = new Set(canonicalCodeKeys(right));
  return canonicalCodeKeys(left).some((key) => rightKeys.has(key));
}

function codesConflict(left: IncomingFhirRecord, right: IncomingFhirRecord): boolean {
  const leftKeys = canonicalCodeKeys(left);
  const rightKeys = canonicalCodeKeys(right);
  if (leftKeys.length === 0 || rightKeys.length === 0) return false;
  return !sharesCanonicalCode(left, right);
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

export function reconcileDeterministic(records: readonly IncomingFhirRecord[]): {
  groups: ReconciledGroup[];
  semanticCandidates: SemanticCandidatePair[];
  conflicts: ValueConflict[];
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
  const identifiers = new Map<string, number>();
  const facts = new Map<string, number>();

  unique.forEach((record, index) => {
    for (const key of identifierKeys(record)) {
      const previous = identifiers.get(key);
      if (previous === undefined) identifiers.set(key, index);
      else unionFind.union(previous, index);
    }
    const fact = factKey(record);
    if (!fact) return;
    const previous = facts.get(fact);
    if (previous === undefined) facts.set(fact, index);
    else unionFind.union(previous, index);
  });

  const buckets = new Map<number, number[]>();
  unique.forEach((_, index) => {
    const root = unionFind.find(index);
    const list = buckets.get(root) ?? [];
    list.push(index);
    buckets.set(root, list);
  });

  const groups: ReconciledGroup[] = [];
  const groupedWithOthers = new Set<number>();
  for (const indexes of buckets.values()) {
    if (indexes.length > 1) indexes.forEach((index) => groupedWithOthers.add(index));
    const members = indexes.map((index) => unique[index]);
    groups.push({
      patientId: members[0].patientId,
      resourceType: members[0].resourceType,
      algorithm: indexes.length > 1 ? "deterministic" : "singleton",
      members: members.map((record, memberIndex) => ({
        record,
        match: indexes.length > 1 && memberIndex > 0 ? "deterministic" : "source",
      })),
    });
  }

  const semanticCandidates: SemanticCandidatePair[] = [];
  const conflicts: ValueConflict[] = [];
  const singletons = unique
    .map((record, index) => ({ record, index }))
    .filter(({ index }) => !groupedWithOthers.has(index));

  for (let leftIndex = 0; leftIndex < singletons.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < singletons.length; rightIndex++) {
      const left = singletons[leftIndex].record;
      const right = singletons[rightIndex].record;
      if (left.patientId !== right.patientId || left.resourceType !== right.resourceType) continue;
      if ((left.effectiveDate ?? "") !== (right.effectiveDate ?? "")) continue;
      if (codesConflict(left, right)) continue;
      if (sharesCanonicalCode(left, right) && left.valueKey && right.valueKey && left.valueKey !== right.valueKey) {
        conflicts.push({ left, right, reason: "same-code-different-value" });
        continue;
      }
      const bothCanonical = canonicalCodeKeys(left).length > 0 && canonicalCodeKeys(right).length > 0;
      if (bothCanonical && left.valueKey && right.valueKey) continue;
      semanticCandidates.push({ left, right, reason: "unresolved-terminology" });
    }
  }

  return { groups, semanticCandidates, conflicts };
}

export function applySemanticDecision(
  groups: readonly ReconciledGroup[],
  pair: SemanticCandidatePair,
  decision: SemanticDecision,
): ReconciledGroup[] {
  const cloned = groups.map((group) => ({ ...group, members: [...group.members] }));
  if (!decision.same) return cloned;

  const leftKey = memberIdentity(pair.left);
  const rightKey = memberIdentity(pair.right);
  let leftGroup: ReconciledGroup | undefined;
  let rightGroup: ReconciledGroup | undefined;
  const rest: ReconciledGroup[] = [];

  for (const group of cloned) {
    const keys = new Set(group.members.map((member) => memberIdentity(member.record)));
    if (keys.has(leftKey)) leftGroup = group;
    else if (keys.has(rightKey)) rightGroup = group;
    else rest.push(group);
  }

  if (!leftGroup || !rightGroup || leftGroup.patientId !== rightGroup.patientId) return cloned;

  return [
    ...rest,
    {
      patientId: leftGroup.patientId,
      resourceType: leftGroup.resourceType,
      algorithm: "semantic",
      members: [
        ...leftGroup.members,
        ...rightGroup.members.map((member) => ({ record: member.record, match: "semantic" as const })),
      ],
    },
  ];
}

export function sourceRecordCount(groups: readonly ReconciledGroup[]): number {
  return groups.reduce((total, group) => total + group.members.length, 0);
}
