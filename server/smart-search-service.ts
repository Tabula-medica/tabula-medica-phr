import { generatePhiSafeText } from "./services/ai-gateway";

async function logPhiAccess(data: {
  userId: string;
  patientId: string;
  resourceType: string;
  action: "read" | "write" | "delete" | "export";
  details: string;
}) {
  const { logPhiAccess: log } = await import("./security/hipaa-audit");
  log(data);
}

export type SearchResultType = "lab" | "document" | "imaging" | "note" | "medication" | "condition" | "procedure" | "allergy";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  date: string;
  matchedTerms: string[];
  relevanceScore: number;
  snippet?: string;
  source: string;
}

export interface SmartSearchResponse {
  query: string;
  expandedTerms: string[];
  results: SearchResult[];
  resultsByType: Record<SearchResultType, SearchResult[]>;
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
}

const medicalSynonyms: Record<string, string[]> = {
  "colonoscopy": ["colon cancer screening", "colorectal exam", "bowel exam", "lower gi endoscopy"],
  "thyroid": ["tsh", "t3", "t4", "thyroid panel", "thyroid function", "hypothyroid", "hyperthyroid"],
  "ldl": ["ldl cholesterol", "bad cholesterol", "ldl-c", "low-density lipoprotein"],
  "hdl": ["hdl cholesterol", "good cholesterol", "hdl-c", "high-density lipoprotein"],
  "metformin": ["glucophage", "diabetes medication", "blood sugar medicine"],
  "ct": ["ct scan", "cat scan", "computed tomography"],
  "mri": ["magnetic resonance imaging", "mr scan"],
  "a1c": ["hemoglobin a1c", "hba1c", "glycated hemoglobin", "diabetes test"],
  "blood pressure": ["bp", "hypertension", "systolic", "diastolic"],
  "cholesterol": ["lipid panel", "lipid profile", "ldl", "hdl", "triglycerides"],
  "diabetes": ["blood sugar", "glucose", "a1c", "type 2 diabetes", "t2dm"],
  "heart": ["cardiac", "cardiovascular", "ecg", "ekg", "echocardiogram"],
  "kidney": ["renal", "creatinine", "egfr", "bun"],
  "liver": ["hepatic", "alt", "ast", "bilirubin", "liver function"],
};

async function expandSearchTermsWithAI(query: string): Promise<string[]> {
  const lowerQuery = query.toLowerCase();
  const directMatches: string[] = [];
  
  for (const [term, synonyms] of Object.entries(medicalSynonyms)) {
    if (lowerQuery.includes(term)) {
      directMatches.push(...synonyms);
    }
    for (const syn of synonyms) {
      if (lowerQuery.includes(syn)) {
        directMatches.push(term);
        directMatches.push(...synonyms.filter(s => s !== syn));
      }
    }
  }

  if (directMatches.length > 0) {
    return Array.from(new Set([query, ...directMatches]));
  }

  try {
    const content = await generatePhiSafeText({
      system: "You expand medical search queries with synonyms and related terms. Return only a JSON array of search terms. Be concise.",
      user: `Expand this medical search query with synonyms and related terms (max 8 terms total): "${query}"`,
      temperature: 0.3,
      maxTokens: 200,
      responseMimeType: "application/json",
    });

    if (content) {
      const parsed = JSON.parse(content);
      return parsed.terms || [query];
    }
  } catch (error) {
    console.error("[SmartSearch] AI expansion failed, using direct query:", error);
  }

  return [query];
}

function localFuzzyMatch(text: string, searchTerms: string[]): { matches: boolean; score: number; matchedTerms: string[] } {
  const lowerText = text.toLowerCase();
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();
    
    if (lowerText.includes(lowerTerm)) {
      matchedTerms.push(term);
      score += lowerTerm.length * 2;
      
      if (lowerText.startsWith(lowerTerm) || lowerText.includes(` ${lowerTerm}`)) {
        score += 10;
      }
    } else {
      const words = lowerTerm.split(/\s+/);
      const partialMatches = words.filter(w => lowerText.includes(w) && w.length > 2);
      if (partialMatches.length > 0) {
        matchedTerms.push(...partialMatches);
        score += partialMatches.length * 3;
      }
    }
  }

  return {
    matches: matchedTerms.length > 0,
    score,
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

async function aiFuzzyRank(
  query: string,
  candidates: Array<{ id: string; title: string; content: string; type: string }>
): Promise<Array<{ id: string; score: number; matchedTerms: string[] }>> {
  if (candidates.length === 0) return [];
  
  try {
    const candidateSummaries = candidates.slice(0, 15).map((c, i) => 
      `${i}: [${c.type}] ${c.title} - ${c.content.slice(0, 100)}`
    ).join("\n");

    const content = await generatePhiSafeText({
      system: `You are a medical search relevance scorer. Given a patient's search query and candidate health records, score each candidate 0-100 based on relevance. Return JSON with format: { "scores": [{ "index": 0, "score": 85, "matchedTerms": ["term1"] }] }. Consider semantic similarity, medical synonyms, abbreviations, and context.`,
      user: `Query: "${query}"\n\nCandidates:\n${candidateSummaries}`,
      temperature: 0.2,
      maxTokens: 500,
      responseMimeType: "application/json",
    });

    if (content) {
      const parsed = JSON.parse(content);
      const scores = parsed.scores || [];
      return scores.map((s: { index: number; score: number; matchedTerms?: string[] }) => ({
        id: candidates[s.index]?.id,
        score: s.score,
        matchedTerms: s.matchedTerms || [],
      })).filter((s: { id: string | undefined }) => s.id);
    }
  } catch (error) {
    console.error("[SmartSearch] AI ranking failed:", error);
  }
  
  return [];
}

const mockHealthRecords = {
  labs: [
    { id: "lab-1", title: "Complete Blood Count (CBC)", date: "2025-01-15", value: "Normal", source: "Quest Diagnostics", content: "White blood cells, red blood cells, hemoglobin, hematocrit, platelets" },
    { id: "lab-2", title: "Comprehensive Metabolic Panel", date: "2025-01-15", value: "Glucose 95 mg/dL", source: "Quest Diagnostics", content: "glucose, kidney function, liver function, electrolytes, creatinine, BUN, sodium, potassium" },
    { id: "lab-3", title: "Lipid Panel", date: "2025-01-10", value: "LDL 128 mg/dL", source: "LabCorp", content: "LDL cholesterol, HDL cholesterol, triglycerides, total cholesterol" },
    { id: "lab-4", title: "Hemoglobin A1C", date: "2025-01-08", value: "6.2%", source: "Quest Diagnostics", content: "A1C, HbA1c, glycated hemoglobin, diabetes monitoring" },
    { id: "lab-5", title: "Thyroid Panel (TSH, T3, T4)", date: "2024-12-20", value: "TSH 2.1 mIU/L", source: "LabCorp", content: "thyroid function, TSH, T3, T4, thyroid stimulating hormone" },
    { id: "lab-6", title: "Kidney Function Panel", date: "2024-12-15", value: "eGFR 85", source: "Quest Diagnostics", content: "creatinine, eGFR, BUN, kidney function, renal panel" },
  ],
  documents: [
    { id: "doc-1", title: "Annual Physical Exam Summary", date: "2025-01-05", source: "Dr. Smith - Primary Care", content: "blood pressure normal, cholesterol discussed, diabetes prevention, exercise recommendations" },
    { id: "doc-2", title: "Cardiology Consultation", date: "2024-11-20", source: "Dr. Johnson - Cardiology", content: "heart rhythm normal, ECG findings, blood pressure management, cardiovascular risk assessment" },
    { id: "doc-3", title: "Endocrinology Follow-up", date: "2024-10-15", source: "Dr. Williams - Endocrinology", content: "thyroid function stable, metformin dosage, A1C improving, diabetes management plan" },
    { id: "doc-4", title: "Colonoscopy Procedure Report", date: "2024-09-10", source: "GI Associates", content: "colonoscopy screening, polyp removed, colon cancer screening, bowel preparation, follow-up in 5 years" },
  ],
  imaging: [
    { id: "img-1", title: "CT Abdomen and Pelvis", date: "2024-11-05", source: "Radiology Associates", content: "CT scan, abdominal imaging, liver normal, kidney normal, no masses" },
    { id: "img-2", title: "Chest X-Ray", date: "2024-10-20", source: "Hospital Radiology", content: "chest radiograph, lungs clear, heart size normal, no infiltrates" },
    { id: "img-3", title: "MRI Brain", date: "2024-08-15", source: "Advanced Imaging Center", content: "MRI brain, no lesions, normal ventricles, headache workup" },
    { id: "img-4", title: "Echocardiogram", date: "2024-07-10", source: "Cardiology Associates", content: "echocardiogram, heart ultrasound, ejection fraction 60%, valve function normal" },
  ],
  notes: [
    { id: "note-1", title: "Phone Call - Medication Question", date: "2025-01-12", source: "Nurse Mary", content: "patient asked about metformin side effects, discussed taking with food" },
    { id: "note-2", title: "Lab Results Discussion", date: "2025-01-10", source: "Dr. Smith", content: "discussed LDL cholesterol results, lifestyle modifications, consider statin if no improvement" },
    { id: "note-3", title: "Prescription Renewal", date: "2024-12-28", source: "Dr. Smith", content: "renewed lisinopril for blood pressure, metformin for diabetes" },
  ],
  medications: [
    { id: "med-1", title: "Metformin 500mg", date: "2025-01-10", source: "Current Medications", content: "metformin, glucophage, diabetes, blood sugar control, twice daily" },
    { id: "med-2", title: "Lisinopril 10mg", date: "2025-01-10", source: "Current Medications", content: "lisinopril, blood pressure, ACE inhibitor, hypertension" },
    { id: "med-3", title: "Atorvastatin 40mg", date: "2025-01-10", source: "Current Medications", content: "atorvastatin, lipitor, cholesterol, LDL reduction, statin" },
  ],
  conditions: [
    { id: "cond-1", title: "Type 2 Diabetes Mellitus", date: "2023-05-15", source: "Problem List", content: "diabetes, T2DM, blood sugar, A1C, glucose control" },
    { id: "cond-2", title: "Essential Hypertension", date: "2022-08-20", source: "Problem List", content: "hypertension, high blood pressure, cardiovascular" },
    { id: "cond-3", title: "Hyperlipidemia", date: "2022-08-20", source: "Problem List", content: "high cholesterol, hyperlipidemia, LDL, lipid disorder" },
  ],
  procedures: [
    { id: "proc-1", title: "Colonoscopy", date: "2024-09-10", source: "Procedure History", content: "colonoscopy, colon cancer screening, polyp removal" },
    { id: "proc-2", title: "Flu Vaccination", date: "2024-10-01", source: "Immunizations", content: "influenza vaccine, flu shot" },
  ],
  allergies: [
    { id: "allergy-1", title: "Penicillin", date: "2020-01-15", source: "Allergy List", content: "penicillin allergy, antibiotic allergy, rash reaction" },
  ],
};

export async function smartSearch(
  query: string,
  patientId: string
): Promise<SmartSearchResponse> {
  const startTime = Date.now();

  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "SmartSearch",
    action: "read",
    details: `Performed smart search: "${query}"`,
  });

  const expandedTerms = await expandSearchTermsWithAI(query);
  const results: SearchResult[] = [];
  const candidatesForAI: Array<{ id: string; title: string; content: string; type: string }> = [];

  const searchInCategory = (
    items: Array<{ id: string; title: string; date: string; source: string; content: string; value?: string }>,
    type: SearchResultType
  ) => {
    for (const item of items) {
      const searchText = `${item.title} ${item.content || ""} ${item.value || ""}`;
      const match = localFuzzyMatch(searchText, expandedTerms);

      if (match.matches) {
        results.push({
          id: item.id,
          type,
          title: item.title,
          subtitle: item.value || item.source,
          date: item.date,
          matchedTerms: match.matchedTerms,
          relevanceScore: match.score,
          snippet: item.content?.slice(0, 150),
          source: item.source,
        });
        candidatesForAI.push({ id: item.id, title: item.title, content: item.content, type });
      }
    }
  };

  searchInCategory(mockHealthRecords.labs, "lab");
  searchInCategory(mockHealthRecords.documents, "document");
  searchInCategory(mockHealthRecords.imaging, "imaging");
  searchInCategory(mockHealthRecords.notes, "note");
  searchInCategory(mockHealthRecords.medications, "medication");
  searchInCategory(mockHealthRecords.conditions, "condition");
  searchInCategory(mockHealthRecords.procedures, "procedure");
  searchInCategory(mockHealthRecords.allergies, "allergy");

  const aiScores = await aiFuzzyRank(query, candidatesForAI);
  const aiScoreMap = new Map(aiScores.map(s => [s.id, s]));

  for (const result of results) {
    const aiScore = aiScoreMap.get(result.id);
    if (aiScore) {
      result.relevanceScore = result.relevanceScore + aiScore.score;
      if (aiScore.matchedTerms.length > 0) {
        result.matchedTerms = Array.from(new Set([...result.matchedTerms, ...aiScore.matchedTerms]));
      }
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const resultsByType: Record<SearchResultType, SearchResult[]> = {
    lab: [],
    document: [],
    imaging: [],
    note: [],
    medication: [],
    condition: [],
    procedure: [],
    allergy: [],
  };

  for (const result of results) {
    resultsByType[result.type].push(result);
  }

  const searchTime = Date.now() - startTime;

  return {
    query,
    expandedTerms,
    results: results.slice(0, 50),
    resultsByType,
    totalCount: results.length,
    searchTime,
    suggestions: results.length === 0 ? ["Try a different spelling", "Use medical abbreviations", "Search for related terms"] : undefined,
  };
}

export async function getSearchSuggestions(
  partialQuery: string,
  patientId: string
): Promise<string[]> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "SmartSearch",
    action: "read",
    details: `Retrieved search suggestions for: "${partialQuery}"`,
  });

  const commonSearches = [
    "colonoscopy",
    "thyroid",
    "LDL cholesterol",
    "metformin",
    "CT abdomen",
    "blood pressure",
    "A1C",
    "kidney function",
    "diabetes",
    "heart",
  ];

  const lower = partialQuery.toLowerCase();
  return commonSearches.filter(s => s.toLowerCase().includes(lower)).slice(0, 5);
}
