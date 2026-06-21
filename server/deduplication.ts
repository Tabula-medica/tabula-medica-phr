import type { Medication, Allergy, Problem, MedicalRecord } from "@shared/schema";

export interface DeduplicationResult<T> {
  item: T;
  duplicateGroupId?: string;
  isPrimary: boolean;
  matchConfidence: "exact" | "high" | "medium" | "low";
  conflictDetails?: ConflictDetail[];
  sourceFacility: string;
  sourcePlatform: string;
}

export interface ConflictDetail {
  field: string;
  values: { value: string; facility: string }[];
}

export interface DeduplicationGroup<T> {
  groupId: string;
  primaryItem: T;
  duplicates: T[];
  matchConfidence: "exact" | "high" | "medium" | "low";
  conflicts: ConflictDetail[];
  totalCount: number;
}

export interface DeduplicationStats {
  totalRecords: number;
  uniqueRecords: number;
  duplicateGroups: number;
  exactMatches: number;
  fuzzyMatches: number;
  conflictsDetected: number;
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

const medicationAliases: Record<string, string[]> = {
  "lisinopril": ["zestril", "prinivil"],
  "metformin": ["glucophage", "glucophage xr", "fortamet", "riomet"],
  "amlodipine": ["norvasc"],
  "atorvastatin": ["lipitor"],
  "omeprazole": ["prilosec"],
  "metoprolol": ["lopressor", "toprol xl", "toprol-xl"],
  "losartan": ["cozaar"],
  "gabapentin": ["neurontin", "gralise"],
  "sertraline": ["zoloft"],
  "alprazolam": ["xanax"],
  "hydrochlorothiazide": ["microzide", "hctz"],
  "levothyroxine": ["synthroid", "levoxyl"],
  "pantoprazole": ["protonix"],
  "rosuvastatin": ["crestor"],
  "simvastatin": ["zocor"],
  "pravastatin": ["pravachol"],
  "ibuprofen": ["advil", "motrin"],
  "acetaminophen": ["tylenol"],
  "aspirin": ["bayer", "ecotrin"],
};

function normalizeMedicationName(name: string): string {
  const normalized = normalizeString(name);
  for (const [generic, brands] of Object.entries(medicationAliases)) {
    if (normalized === generic || brands.some(b => normalized.includes(b))) {
      return generic;
    }
    if (brands.some(b => normalized.includes(b))) {
      return generic;
    }
  }
  return normalized.split(/\s+/)[0];
}

export function deduplicateMedications(
  medications: (Medication & { sourceFacility: string; sourcePlatform: string })[]
): {
  results: DeduplicationResult<Medication>[];
  groups: DeduplicationGroup<Medication>[];
  stats: DeduplicationStats;
} {
  const groups: Map<string, (Medication & { sourceFacility: string; sourcePlatform: string })[]> = new Map();
  
  for (const med of medications) {
    const normalizedName = normalizeMedicationName(med.name);
    let foundGroup = false;
    
    const groupEntries = Array.from(groups.entries());
    for (const [groupKey, groupMeds] of groupEntries) {
      const groupName = normalizeMedicationName(groupMeds[0].name);
      const similarity = stringSimilarity(normalizedName, groupName);
      
      if (similarity >= 0.85) {
        groupMeds.push(med);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      groups.set(`med-group-${normalizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, [med]);
    }
  }

  const results: DeduplicationResult<Medication>[] = [];
  const dedupGroups: DeduplicationGroup<Medication>[] = [];
  let exactMatches = 0;
  let fuzzyMatches = 0;
  let conflictsDetected = 0;

  type MedWithSource = Medication & { sourceFacility: string; sourcePlatform: string };
  const groupEntries = Array.from(groups.entries());
  
  for (const [groupId, meds] of groupEntries) {
    const isExactMatch = meds.every((m: MedWithSource) => 
      normalizeString(m.name) === normalizeString(meds[0].name)
    );
    
    if (isExactMatch) exactMatches += meds.length - 1;
    else fuzzyMatches += meds.length - 1;

    const sortedMeds = [...meds].sort((a: MedWithSource, b: MedWithSource) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    const conflicts: ConflictDetail[] = [];
    
    const dosages = new Set(meds.map((m: MedWithSource) => normalizeString(m.dosage)));
    if (dosages.size > 1) {
      conflicts.push({
        field: 'dosage',
        values: meds.map((m: MedWithSource) => ({ value: m.dosage, facility: m.sourceFacility }))
      });
      conflictsDetected++;
    }

    const frequencies = new Set(meds.map((m: MedWithSource) => normalizeString(m.frequency)));
    if (frequencies.size > 1) {
      conflicts.push({
        field: 'frequency',
        values: meds.map((m: MedWithSource) => ({ value: m.frequency, facility: m.sourceFacility }))
      });
      conflictsDetected++;
    }

    const statuses = new Set(meds.map((m: MedWithSource) => m.status));
    if (statuses.size > 1) {
      conflicts.push({
        field: 'status',
        values: meds.map((m: MedWithSource) => ({ value: m.status, facility: m.sourceFacility }))
      });
      conflictsDetected++;
    }

    if (meds.length > 1) {
      dedupGroups.push({
        groupId,
        primaryItem: sortedMeds[0],
        duplicates: sortedMeds.slice(1),
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflicts,
        totalCount: meds.length
      });
    }

    sortedMeds.forEach((med: MedWithSource, index: number) => {
      results.push({
        item: med,
        duplicateGroupId: meds.length > 1 ? groupId : undefined,
        isPrimary: index === 0,
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflictDetails: conflicts.length > 0 ? conflicts : undefined,
        sourceFacility: med.sourceFacility,
        sourcePlatform: med.sourcePlatform
      });
    });
  }

  return {
    results,
    groups: dedupGroups,
    stats: {
      totalRecords: medications.length,
      uniqueRecords: groups.size,
      duplicateGroups: dedupGroups.length,
      exactMatches,
      fuzzyMatches,
      conflictsDetected
    }
  };
}

const allergyAliases: Record<string, string[]> = {
  "penicillin": ["amoxicillin", "ampicillin", "penicillin v", "penicillin g"],
  "sulfa": ["sulfamethoxazole", "sulfasalazine", "sulfonamide"],
  "nsaid": ["ibuprofen", "naproxen", "aspirin", "meloxicam", "celecoxib"],
  "shellfish": ["shrimp", "crab", "lobster", "crawfish"],
  "tree nuts": ["almonds", "walnuts", "pecans", "cashews", "pistachios"],
  "peanuts": ["peanut", "groundnut"],
};

function normalizeAllergyName(name: string): string {
  const normalized = normalizeString(name);
  for (const [category, aliases] of Object.entries(allergyAliases)) {
    if (aliases.some(a => normalized.includes(a)) || normalized.includes(category)) {
      return category;
    }
  }
  return normalized;
}

export function deduplicateAllergies(
  allergies: (Allergy & { sourceFacility: string; sourcePlatform: string })[]
): {
  results: DeduplicationResult<Allergy>[];
  groups: DeduplicationGroup<Allergy>[];
  stats: DeduplicationStats;
} {
  const groups: Map<string, (Allergy & { sourceFacility: string; sourcePlatform: string })[]> = new Map();
  
  for (const allergy of allergies) {
    const normalizedName = normalizeAllergyName(allergy.name);
    let foundGroup = false;
    
    const allergyGroupEntries = Array.from(groups.entries());
    for (const [groupKey, groupAllergies] of allergyGroupEntries) {
      const groupName = normalizeAllergyName(groupAllergies[0].name);
      const similarity = stringSimilarity(normalizedName, groupName);
      
      if (similarity >= 0.80 || normalizedName === groupName) {
        groupAllergies.push(allergy);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      groups.set(`allergy-group-${normalizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, [allergy]);
    }
  }

  const results: DeduplicationResult<Allergy>[] = [];
  const dedupGroups: DeduplicationGroup<Allergy>[] = [];
  let exactMatches = 0;
  let fuzzyMatches = 0;
  let conflictsDetected = 0;

  const severityRank: Record<string, number> = {
    'life_threatening': 4,
    'severe': 3,
    'moderate': 2,
    'mild': 1
  };

  type AllergyWithSource = Allergy & { sourceFacility: string; sourcePlatform: string };
  const allergyGroupEntries2 = Array.from(groups.entries());
  
  for (const [groupId, allergyGroup] of allergyGroupEntries2) {
    const isExactMatch = allergyGroup.every((a: AllergyWithSource) => 
      normalizeString(a.name) === normalizeString(allergyGroup[0].name)
    );
    
    if (isExactMatch) exactMatches += allergyGroup.length - 1;
    else fuzzyMatches += allergyGroup.length - 1;

    const sortedAllergies = [...allergyGroup].sort((a: AllergyWithSource, b: AllergyWithSource) => {
      const severityDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return 0;
    });

    const conflicts: ConflictDetail[] = [];
    
    const severities = new Set(allergyGroup.map((a: AllergyWithSource) => a.severity));
    if (severities.size > 1) {
      conflicts.push({
        field: 'severity',
        values: allergyGroup.map((a: AllergyWithSource) => ({ value: a.severity, facility: a.sourceFacility }))
      });
      conflictsDetected++;
    }

    const reactions = new Set(allergyGroup.map((a: AllergyWithSource) => normalizeString(a.reaction)));
    if (reactions.size > 1) {
      conflicts.push({
        field: 'reaction',
        values: allergyGroup.map((a: AllergyWithSource) => ({ value: a.reaction, facility: a.sourceFacility }))
      });
    }

    const types = new Set(allergyGroup.map((a: AllergyWithSource) => a.type));
    if (types.size > 1) {
      conflicts.push({
        field: 'type',
        values: allergyGroup.map((a: AllergyWithSource) => ({ value: a.type, facility: a.sourceFacility }))
      });
      conflictsDetected++;
    }

    if (allergyGroup.length > 1) {
      dedupGroups.push({
        groupId,
        primaryItem: sortedAllergies[0],
        duplicates: sortedAllergies.slice(1),
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflicts,
        totalCount: allergyGroup.length
      });
    }

    sortedAllergies.forEach((allergy: AllergyWithSource, index: number) => {
      results.push({
        item: allergy,
        duplicateGroupId: allergyGroup.length > 1 ? groupId : undefined,
        isPrimary: index === 0,
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflictDetails: conflicts.length > 0 ? conflicts : undefined,
        sourceFacility: allergy.sourceFacility,
        sourcePlatform: allergy.sourcePlatform
      });
    });
  }

  return {
    results,
    groups: dedupGroups,
    stats: {
      totalRecords: allergies.length,
      uniqueRecords: groups.size,
      duplicateGroups: dedupGroups.length,
      exactMatches,
      fuzzyMatches,
      conflictsDetected
    }
  };
}

function normalizeIcdCode(code?: string): string | undefined {
  if (!code) return undefined;
  return code.replace(/[.\s-]/g, '').toUpperCase();
}

export function deduplicateProblems(
  problems: (Problem & { sourceFacility: string; sourcePlatform: string })[]
): {
  results: DeduplicationResult<Problem>[];
  groups: DeduplicationGroup<Problem>[];
  stats: DeduplicationStats;
} {
  const groups: Map<string, (Problem & { sourceFacility: string; sourcePlatform: string })[]> = new Map();
  
  for (const problem of problems) {
    const normalizedName = normalizeString(problem.name);
    const normalizedIcd = normalizeIcdCode(problem.icdCode);
    let foundGroup = false;
    
    const problemGroupEntries = Array.from(groups.entries());
    for (const [groupKey, groupProblems] of problemGroupEntries) {
      const firstProblem = groupProblems[0];
      const groupName = normalizeString(firstProblem.name);
      const groupIcd = normalizeIcdCode(firstProblem.icdCode);
      
      if (normalizedIcd && groupIcd && normalizedIcd === groupIcd) {
        groupProblems.push(problem);
        foundGroup = true;
        break;
      }
      
      const similarity = stringSimilarity(normalizedName, groupName);
      if (similarity >= 0.85) {
        groupProblems.push(problem);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      const key = normalizedIcd || `problem-${normalizedName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      groups.set(key, [problem]);
    }
  }

  const results: DeduplicationResult<Problem>[] = [];
  const dedupGroups: DeduplicationGroup<Problem>[] = [];
  let exactMatches = 0;
  let fuzzyMatches = 0;
  let conflictsDetected = 0;

  type ProblemWithSource = Problem & { sourceFacility: string; sourcePlatform: string };
  const problemGroupEntries2 = Array.from(groups.entries());
  
  for (const [groupId, problemGroup] of problemGroupEntries2) {
    const hasIcdMatch = problemGroup.every((p: ProblemWithSource) => {
      const icd = normalizeIcdCode(p.icdCode);
      const firstIcd = normalizeIcdCode(problemGroup[0].icdCode);
      return icd && firstIcd && icd === firstIcd;
    });
    
    const hasNameMatch = problemGroup.every((p: ProblemWithSource) => 
      normalizeString(p.name) === normalizeString(problemGroup[0].name)
    );
    
    const matchConfidence: "exact" | "high" | "medium" = hasIcdMatch ? 'exact' : (hasNameMatch ? 'high' : 'medium');
    
    if (hasIcdMatch || hasNameMatch) exactMatches += problemGroup.length - 1;
    else fuzzyMatches += problemGroup.length - 1;

    const sortedProblems = [...problemGroup].sort((a: ProblemWithSource, b: ProblemWithSource) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      const aDate = a.onsetDate ? new Date(a.onsetDate).getTime() : 0;
      const bDate = b.onsetDate ? new Date(b.onsetDate).getTime() : 0;
      return bDate - aDate;
    });

    const conflicts: ConflictDetail[] = [];
    
    const severities = problemGroup.filter((p: ProblemWithSource) => p.severity).map((p: ProblemWithSource) => p.severity!);
    if (new Set(severities).size > 1) {
      conflicts.push({
        field: 'severity',
        values: problemGroup.filter((p: ProblemWithSource) => p.severity).map((p: ProblemWithSource) => ({ 
          value: p.severity!, 
          facility: p.sourceFacility 
        }))
      });
      conflictsDetected++;
    }

    const statuses = new Set(problemGroup.map((p: ProblemWithSource) => p.status));
    if (statuses.size > 1) {
      conflicts.push({
        field: 'status',
        values: problemGroup.map((p: ProblemWithSource) => ({ value: p.status, facility: p.sourceFacility }))
      });
      conflictsDetected++;
    }

    const categories = new Set(problemGroup.map((p: ProblemWithSource) => p.category));
    if (categories.size > 1) {
      conflicts.push({
        field: 'category',
        values: problemGroup.map((p: ProblemWithSource) => ({ value: p.category, facility: p.sourceFacility }))
      });
    }

    if (problemGroup.length > 1) {
      dedupGroups.push({
        groupId,
        primaryItem: sortedProblems[0],
        duplicates: sortedProblems.slice(1),
        matchConfidence,
        conflicts,
        totalCount: problemGroup.length
      });
    }

    sortedProblems.forEach((problem: ProblemWithSource, index: number) => {
      results.push({
        item: problem,
        duplicateGroupId: problemGroup.length > 1 ? groupId : undefined,
        isPrimary: index === 0,
        matchConfidence,
        conflictDetails: conflicts.length > 0 ? conflicts : undefined,
        sourceFacility: problem.sourceFacility,
        sourcePlatform: problem.sourcePlatform
      });
    });
  }

  return {
    results,
    groups: dedupGroups,
    stats: {
      totalRecords: problems.length,
      uniqueRecords: groups.size,
      duplicateGroups: dedupGroups.length,
      exactMatches,
      fuzzyMatches,
      conflictsDetected
    }
  };
}

export function deduplicateMedicalRecords(
  records: (MedicalRecord & { sourceFacility: string; sourcePlatform: string })[]
): {
  results: DeduplicationResult<MedicalRecord>[];
  groups: DeduplicationGroup<MedicalRecord>[];
  stats: DeduplicationStats;
} {
  const groups: Map<string, (MedicalRecord & { sourceFacility: string; sourcePlatform: string })[]> = new Map();
  
  for (const record of records) {
    const normalizedTitle = normalizeString(record.title);
    const recordDate = record.date.split('T')[0];
    const recordType = record.type;
    
    let foundGroup = false;
    
    const recordGroupEntries = Array.from(groups.entries());
    for (const [groupKey, groupRecords] of recordGroupEntries) {
      const firstRecord = groupRecords[0];
      const groupTitle = normalizeString(firstRecord.title);
      const groupDate = firstRecord.date.split('T')[0];
      
      if (recordType === firstRecord.type && recordDate === groupDate) {
        const titleSimilarity = stringSimilarity(normalizedTitle, groupTitle);
        if (titleSimilarity >= 0.80) {
          groupRecords.push(record);
          foundGroup = true;
          break;
        }
      }
    }
    
    if (!foundGroup) {
      const key = `record-${recordType}-${recordDate}-${normalizedTitle.substr(0, 20)}-${Math.random().toString(36).substr(2, 9)}`;
      groups.set(key, [record]);
    }
  }

  const results: DeduplicationResult<MedicalRecord>[] = [];
  const dedupGroups: DeduplicationGroup<MedicalRecord>[] = [];
  let exactMatches = 0;
  let fuzzyMatches = 0;
  let conflictsDetected = 0;

  type RecordWithSource = MedicalRecord & { sourceFacility: string; sourcePlatform: string };
  const recordGroupEntries2 = Array.from(groups.entries());
  
  for (const [groupId, recordGroup] of recordGroupEntries2) {
    const isExactMatch = recordGroup.every((r: RecordWithSource) => 
      normalizeString(r.title) === normalizeString(recordGroup[0].title) &&
      r.date === recordGroup[0].date
    );
    
    if (isExactMatch) exactMatches += recordGroup.length - 1;
    else fuzzyMatches += recordGroup.length - 1;

    const sortedRecords = [...recordGroup].sort((a: RecordWithSource, b: RecordWithSource) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const conflicts: ConflictDetail[] = [];
    
    const descriptions = new Set(recordGroup.map((r: RecordWithSource) => normalizeString(r.description)));
    if (descriptions.size > 1) {
      conflicts.push({
        field: 'description',
        values: recordGroup.map((r: RecordWithSource) => ({ 
          value: r.description.length > 50 ? r.description.substr(0, 50) + '...' : r.description, 
          facility: r.sourceFacility 
        }))
      });
    }

    const providers = new Set(recordGroup.map((r: RecordWithSource) => r.provider));
    if (providers.size > 1) {
      conflicts.push({
        field: 'provider',
        values: recordGroup.map((r: RecordWithSource) => ({ value: r.provider, facility: r.sourceFacility }))
      });
    }

    if (recordGroup.length > 1) {
      dedupGroups.push({
        groupId,
        primaryItem: sortedRecords[0],
        duplicates: sortedRecords.slice(1),
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflicts,
        totalCount: recordGroup.length
      });
    }

    sortedRecords.forEach((record: RecordWithSource, index: number) => {
      results.push({
        item: record,
        duplicateGroupId: recordGroup.length > 1 ? groupId : undefined,
        isPrimary: index === 0,
        matchConfidence: isExactMatch ? 'exact' : 'high',
        conflictDetails: conflicts.length > 0 ? conflicts : undefined,
        sourceFacility: record.sourceFacility,
        sourcePlatform: record.sourcePlatform
      });
    });
  }

  return {
    results,
    groups: dedupGroups,
    stats: {
      totalRecords: records.length,
      uniqueRecords: groups.size,
      duplicateGroups: dedupGroups.length,
      exactMatches,
      fuzzyMatches,
      conflictsDetected
    }
  };
}

export function generateDeduplicationSummary(
  medicationStats: DeduplicationStats,
  allergyStats: DeduplicationStats,
  problemStats: DeduplicationStats,
  recordStats: DeduplicationStats
): {
  totalRecords: number;
  uniqueRecords: number;
  duplicatesFound: number;
  conflictsDetected: number;
  deduplicationRate: number;
  byCategory: {
    medications: DeduplicationStats;
    allergies: DeduplicationStats;
    problems: DeduplicationStats;
    records: DeduplicationStats;
  };
} {
  const totalRecords = medicationStats.totalRecords + allergyStats.totalRecords + 
                       problemStats.totalRecords + recordStats.totalRecords;
  const uniqueRecords = medicationStats.uniqueRecords + allergyStats.uniqueRecords + 
                        problemStats.uniqueRecords + recordStats.uniqueRecords;
  const duplicatesFound = totalRecords - uniqueRecords;
  const conflictsDetected = medicationStats.conflictsDetected + allergyStats.conflictsDetected +
                           problemStats.conflictsDetected + recordStats.conflictsDetected;

  return {
    totalRecords,
    uniqueRecords,
    duplicatesFound,
    conflictsDetected,
    deduplicationRate: totalRecords > 0 ? ((duplicatesFound / totalRecords) * 100) : 0,
    byCategory: {
      medications: medicationStats,
      allergies: allergyStats,
      problems: problemStats,
      records: recordStats
    }
  };
}
