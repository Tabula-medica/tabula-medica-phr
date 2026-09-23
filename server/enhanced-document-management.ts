import { generatePhiSafeText } from "./services/ai-gateway";
import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";

export interface ExtractedMedication {
  name: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  endDate: string | null;
  prescriber: string | null;
  purpose: string | null;
}

export interface ExtractedLabValue {
  testName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  isAbnormal: boolean;
  date: string | null;
  category: string;
}

export interface ExtractedImagingFinding {
  modality: string;
  bodyPart: string;
  finding: string;
  impression: string | null;
  severity: "normal" | "mild" | "moderate" | "severe" | "unknown";
  date: string | null;
  radiologist: string | null;
}

export interface ExtractedDiagnosis {
  name: string;
  icdCode: string | null;
  date: string | null;
  status: "active" | "resolved" | "chronic" | "unknown";
  provider: string | null;
}

export interface ExtractedVitalSign {
  type: string;
  value: string;
  unit: string;
  date: string | null;
  isAbnormal: boolean;
}

export interface ExtractedProcedure {
  name: string;
  date: string | null;
  provider: string | null;
  facility: string | null;
  outcome: string | null;
}

export interface DocumentExtraction {
  medications: ExtractedMedication[];
  labValues: ExtractedLabValue[];
  imagingFindings: ExtractedImagingFinding[];
  diagnoses: ExtractedDiagnosis[];
  vitalSigns: ExtractedVitalSign[];
  procedures: ExtractedProcedure[];
  keyDates: Array<{ date: string; description: string }>;
  providers: Array<{ name: string; role: string; facility: string | null }>;
  summary: string;
  extractionConfidence: number;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  contentHash: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  changeNote: string | null;
  extraction: DocumentExtraction | null;
  searchableText: string;
}

export interface Document {
  id: string;
  profileId: string;
  title: string;
  category: string;
  subcategory: string | null;
  currentVersion: number;
  versions: DocumentVersion[];
  tags: string[];
  folderPath: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  metadata: Record<string, any>;
}

export interface SearchResult {
  documentId: string;
  versionId: string;
  title: string;
  category: string;
  relevanceScore: number;
  matchedContent: string;
  highlightedSnippet: string;
  extraction: DocumentExtraction | null;
}

const documentStore = new Map<string, Document>();
const searchIndex = new Map<string, { documentId: string; versionId: string; embedding?: number[] }>();

function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const EXTRACTION_PROMPT = `You are a medical document information extractor. Your role is to extract structured clinical data from medical documents.

IMPORTANT COMPLIANCE NOTES:
- You are extracting data for patient record organization only
- You are NOT providing medical advice or clinical decision support
- All extraction is for informational purposes only

Extract the following information from the document:

1. MEDICATIONS: Name, dosage, frequency, route, start/end dates, prescriber, purpose
2. LAB VALUES: Test name, value, unit, reference range, abnormal flag, date, category (hematology, chemistry, urinalysis, tumor_markers, etc.)
3. IMAGING FINDINGS: Modality (CT, MRI, X-ray, etc.), body part, findings, impression, severity, date, radiologist
4. DIAGNOSES: Name, ICD code if present, date, status (active/resolved/chronic), provider
5. VITAL SIGNS: Type (BP, HR, temp, weight, etc.), value, unit, date, abnormal flag
6. PROCEDURES: Name, date, provider, facility, outcome
7. KEY DATES: Important dates mentioned with descriptions
8. PROVIDERS: Names, roles, facilities

Also provide:
- A concise summary of the document (2-3 sentences)
- Confidence score (0.0-1.0) for the extraction quality

Respond ONLY with valid JSON matching this structure:
{
  "medications": [{"name": "", "dosage": "", "frequency": "", "route": "", "startDate": "", "endDate": "", "prescriber": "", "purpose": ""}],
  "labValues": [{"testName": "", "value": "", "unit": "", "referenceRange": "", "isAbnormal": false, "date": "", "category": ""}],
  "imagingFindings": [{"modality": "", "bodyPart": "", "finding": "", "impression": "", "severity": "normal|mild|moderate|severe|unknown", "date": "", "radiologist": ""}],
  "diagnoses": [{"name": "", "icdCode": "", "date": "", "status": "active|resolved|chronic|unknown", "provider": ""}],
  "vitalSigns": [{"type": "", "value": "", "unit": "", "date": "", "isAbnormal": false}],
  "procedures": [{"name": "", "date": "", "provider": "", "facility": "", "outcome": ""}],
  "keyDates": [{"date": "", "description": ""}],
  "providers": [{"name": "", "role": "", "facility": ""}],
  "summary": "",
  "extractionConfidence": 0.0
}`;

export async function extractDocumentInformation(
  content: string,
  filename?: string
): Promise<DocumentExtraction> {
  try {
    const responseText = await generatePhiSafeText({
      system: EXTRACTION_PROMPT,
      user: `Extract clinical information from this medical document:

Filename: ${filename || "Unknown"}

Document content:
${content.slice(0, 20000)}

Provide extraction as JSON.`,
      responseMimeType: "application/json",
      maxTokens: 4000,
    });

    const result = JSON.parse(responseText || "{}");
    
    return {
      medications: result.medications || [],
      labValues: result.labValues || [],
      imagingFindings: result.imagingFindings || [],
      diagnoses: result.diagnoses || [],
      vitalSigns: result.vitalSigns || [],
      procedures: result.procedures || [],
      keyDates: result.keyDates || [],
      providers: result.providers || [],
      summary: result.summary || "No summary available",
      extractionConfidence: result.extractionConfidence || 0.5,
    };
  } catch (error) {
    console.error("[DocumentExtraction] Error:", error);
    return {
      medications: [],
      labValues: [],
      imagingFindings: [],
      diagnoses: [],
      vitalSigns: [],
      procedures: [],
      keyDates: [],
      providers: [],
      summary: "Extraction failed",
      extractionConfidence: 0,
    };
  }
}

const SEARCH_PROMPT = `You are a medical document search assistant. Your role is to understand natural language queries and find relevant documents.

Given the user's search query and a list of document summaries with extracted information, determine which documents are most relevant.

For each relevant document, provide:
1. Relevance score (0.0-1.0)
2. Reason for relevance
3. Highlighted snippet that matches the query

Respond with JSON:
{
  "results": [
    {
      "documentId": "",
      "relevanceScore": 0.0,
      "matchReason": "",
      "highlightedSnippet": ""
    }
  ]
}`;

export async function searchDocumentsNaturalLanguage(
  query: string,
  documents: Document[]
): Promise<SearchResult[]> {
  if (documents.length === 0) return [];

  const documentSummaries = documents.map(doc => {
    const latestVersion = doc.versions[doc.versions.length - 1];
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      summary: latestVersion?.extraction?.summary || "No summary",
      medications: latestVersion?.extraction?.medications?.map(m => m.name).join(", ") || "",
      labValues: latestVersion?.extraction?.labValues?.map(l => `${l.testName}: ${l.value}`).join(", ") || "",
      diagnoses: latestVersion?.extraction?.diagnoses?.map(d => d.name).join(", ") || "",
      content: latestVersion?.searchableText?.slice(0, 500) || "",
    };
  });

  try {
    const responseText = await generatePhiSafeText({
      system: SEARCH_PROMPT,
      user: `Search query: "${query}"

Available documents:
${JSON.stringify(documentSummaries, null, 2)}

Find the most relevant documents for this query.`,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    const result = JSON.parse(responseText || '{"results":[]}');
    
    return (result.results || [])
      .filter((r: any) => r.relevanceScore > 0.3)
      .map((r: any) => {
        const doc = documents.find(d => d.id === r.documentId);
        const latestVersion = doc?.versions[doc.versions.length - 1];
        return {
          documentId: r.documentId,
          versionId: latestVersion?.id || "",
          title: doc?.title || "Unknown",
          category: doc?.category || "Unknown",
          relevanceScore: r.relevanceScore,
          matchedContent: r.matchReason || "",
          highlightedSnippet: r.highlightedSnippet || "",
          extraction: latestVersion?.extraction || null,
        };
      })
      .sort((a: SearchResult, b: SearchResult) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error("[DocumentSearch] Error:", error);
    return [];
  }
}

export async function createDocument(
  profileId: string,
  title: string,
  category: string,
  content: string,
  filename: string,
  mimeType: string,
  uploadedBy: string,
  folderPath: string = "/",
  tags: string[] = []
): Promise<Document> {
  const documentId = uuidv4();
  const versionId = uuidv4();
  const now = new Date().toISOString();

  const extraction = await extractDocumentInformation(content, filename);

  const version: DocumentVersion = {
    id: versionId,
    documentId,
    version: 1,
    content,
    contentHash: generateContentHash(content),
    filename,
    mimeType,
    fileSize: content.length,
    uploadedAt: now,
    uploadedBy,
    changeNote: "Initial upload",
    extraction,
    searchableText: content,
  };

  const document: Document = {
    id: documentId,
    profileId,
    title,
    category,
    subcategory: null,
    currentVersion: 1,
    versions: [version],
    tags,
    folderPath,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    metadata: {},
  };

  documentStore.set(documentId, document);
  searchIndex.set(versionId, { documentId, versionId });

  return document;
}

export async function addDocumentVersion(
  documentId: string,
  content: string,
  filename: string,
  mimeType: string,
  uploadedBy: string,
  changeNote?: string
): Promise<DocumentVersion | null> {
  const document = documentStore.get(documentId);
  if (!document) return null;

  const newVersionNumber = document.currentVersion + 1;
  const versionId = uuidv4();
  const now = new Date().toISOString();
  const contentHash = generateContentHash(content);

  const lastVersion = document.versions[document.versions.length - 1];
  if (lastVersion && lastVersion.contentHash === contentHash) {
    console.log("[DocumentVersionControl] Content unchanged, skipping version creation");
    return lastVersion;
  }

  const extraction = await extractDocumentInformation(content, filename);

  const version: DocumentVersion = {
    id: versionId,
    documentId,
    version: newVersionNumber,
    content,
    contentHash,
    filename,
    mimeType,
    fileSize: content.length,
    uploadedAt: now,
    uploadedBy,
    changeNote: changeNote || `Version ${newVersionNumber}`,
    extraction,
    searchableText: content,
  };

  document.versions.push(version);
  document.currentVersion = newVersionNumber;
  document.updatedAt = now;

  documentStore.set(documentId, document);
  searchIndex.set(versionId, { documentId, versionId });

  return version;
}

export function getDocumentVersions(documentId: string): DocumentVersion[] {
  const document = documentStore.get(documentId);
  return document?.versions || [];
}

export function getDocumentVersion(documentId: string, version: number): DocumentVersion | null {
  const document = documentStore.get(documentId);
  if (!document) return null;
  return document.versions.find(v => v.version === version) || null;
}

export function compareVersions(
  documentId: string,
  version1: number,
  version2: number
): { added: string[]; removed: string[]; summary: string } | null {
  const v1 = getDocumentVersion(documentId, version1);
  const v2 = getDocumentVersion(documentId, version2);
  
  if (!v1 || !v2) return null;

  const lines1 = v1.content.split('\n');
  const lines2 = v2.content.split('\n');
  
  const added = lines2.filter(line => !lines1.includes(line));
  const removed = lines1.filter(line => !lines2.includes(line));

  return {
    added,
    removed,
    summary: `${added.length} lines added, ${removed.length} lines removed`,
  };
}

function initializeSampleData() {
  const sampleProfileId = "profile-1";
  
  const sampleDocs = [
    {
      title: "Complete Blood Count Results",
      category: "labs",
      content: `LABORATORY REPORT
Patient: John Doe
Date: 2026-01-15
Provider: Dr. Sarah Johnson, Oncology

TEST RESULTS:
- WBC: 4.5 x10^9/L (Reference: 4.0-11.0) - Normal
- RBC: 4.2 x10^12/L (Reference: 4.5-5.5) - Low
- Hemoglobin: 12.8 g/dL (Reference: 13.5-17.5) - Low
- Hematocrit: 38% (Reference: 40-52%) - Low
- Platelets: 185 x10^9/L (Reference: 150-400) - Normal
- Neutrophils: 55% (Reference: 40-70%) - Normal

INTERPRETATION:
Mild anemia noted. Recommend iron studies and B12/folate levels.

Electronically signed by: Dr. Sarah Johnson, MD
`,
      filename: "cbc_results_20260115.pdf",
    },
    {
      title: "CT Scan Chest Report",
      category: "imaging",
      content: `RADIOLOGY REPORT
CT CHEST WITH CONTRAST

Patient: John Doe
Date of Exam: 2026-01-10
Ordering Physician: Dr. Michael Chen, Oncology

CLINICAL INDICATION: Follow-up lung nodule surveillance

TECHNIQUE: CT of the chest with IV contrast, 1.25mm sections

FINDINGS:
- 6mm nodule in right lower lobe, stable compared to prior study (2025-07-10)
- No new pulmonary nodules identified
- No significant lymphadenopathy
- Heart size normal
- No pleural effusion
- No pericardial effusion

IMPRESSION:
1. Stable 6mm right lower lobe nodule, recommend continued surveillance in 6 months
2. No evidence of disease progression

Dictated by: Dr. Robert Kim, MD
Radiologist
`,
      filename: "ct_chest_20260110.pdf",
    },
    {
      title: "Oncology Visit Note",
      category: "follow_ups",
      content: `PROGRESS NOTE
Department of Medical Oncology

Patient: John Doe
Date: 2026-01-18
Provider: Dr. Michael Chen, MD

CHIEF COMPLAINT: Follow-up for stage IIA lung cancer, post-treatment surveillance

CURRENT MEDICATIONS:
- Osimertinib (Tagrisso) 80mg PO daily
- Ondansetron 8mg PO as needed for nausea
- Vitamin D 2000 IU daily
- Multivitamin daily

VITAL SIGNS:
- Blood Pressure: 128/78 mmHg
- Heart Rate: 72 bpm
- Temperature: 98.4°F
- Weight: 168 lbs (stable)

ASSESSMENT & PLAN:
1. Stage IIA NSCLC (EGFR+) - on maintenance osimertinib
   - CT chest stable, continue current therapy
   - Labs show mild anemia, will check iron studies
   - Next imaging in 3 months

2. Treatment-related fatigue - Grade 1
   - Recommend exercise program
   - Sleep hygiene counseling provided

3. Mild anemia
   - Likely treatment-related
   - Check iron, B12, folate
   - Consider EPO if worsens

Follow-up in 6 weeks.

Electronically signed: Michael Chen, MD
`,
      filename: "oncology_visit_20260118.pdf",
    },
  ];

  sampleDocs.forEach(doc => {
    createDocument(
      sampleProfileId,
      doc.title,
      doc.category,
      doc.content,
      doc.filename,
      "application/pdf",
      "system",
      "/",
      []
    );
  });
}

const router = Router();

router.get("/api/documents/enhanced", (req: Request, res: Response) => {
  const { profileId } = req.query;
  const documents = Array.from(documentStore.values())
    .filter(doc => !profileId || doc.profileId === profileId)
    .map(doc => ({
      ...doc,
      latestVersion: doc.versions[doc.versions.length - 1],
    }));
  res.json({ documents });
});

router.get("/api/documents/enhanced/:id", (req: Request, res: Response) => {
  const document = documentStore.get(req.params.id);
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json({ 
    document,
    latestVersion: document.versions[document.versions.length - 1],
  });
});

router.post("/api/documents/enhanced", async (req: Request, res: Response) => {
  const { profileId, title, category, content, filename, mimeType, folderPath, tags } = req.body;

  if (!profileId || !title || !content) {
    return res.status(400).json({ error: "profileId, title, and content are required" });
  }

  try {
    const document = await createDocument(
      profileId,
      title,
      category || "general_medical",
      content,
      filename || "document.txt",
      mimeType || "text/plain",
      "user",
      folderPath || "/",
      tags || []
    );
    res.json({ document, extraction: document.versions[0].extraction });
  } catch (error) {
    console.error("[DocumentManagement] Create error:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.post("/api/documents/enhanced/:id/versions", async (req: Request, res: Response) => {
  const { content, filename, mimeType, changeNote } = req.body;
  const documentId = req.params.id;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  try {
    const version = await addDocumentVersion(
      documentId,
      content,
      filename || "document.txt",
      mimeType || "text/plain",
      "user",
      changeNote
    );

    if (!version) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ version });
  } catch (error) {
    console.error("[DocumentManagement] Add version error:", error);
    res.status(500).json({ error: "Failed to add document version" });
  }
});

router.get("/api/documents/enhanced/:id/versions", (req: Request, res: Response) => {
  const versions = getDocumentVersions(req.params.id);
  res.json({ versions });
});

router.get("/api/documents/enhanced/:id/versions/:version", (req: Request, res: Response) => {
  const version = getDocumentVersion(req.params.id, parseInt(req.params.version));
  if (!version) {
    return res.status(404).json({ error: "Version not found" });
  }
  res.json({ version });
});

router.get("/api/documents/enhanced/:id/compare", (req: Request, res: Response) => {
  const { v1, v2 } = req.query;
  const version1 = parseInt(v1 as string);
  const version2 = parseInt(v2 as string);

  if (isNaN(version1) || isNaN(version2)) {
    return res.status(400).json({ error: "v1 and v2 query parameters required" });
  }

  const comparison = compareVersions(req.params.id, version1, version2);
  if (!comparison) {
    return res.status(404).json({ error: "Document or versions not found" });
  }

  res.json({ comparison });
});

router.post("/api/documents/enhanced/extract", async (req: Request, res: Response) => {
  const { content, filename } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  try {
    const extraction = await extractDocumentInformation(content, filename);
    res.json({ extraction });
  } catch (error) {
    console.error("[DocumentExtraction] API error:", error);
    res.status(500).json({ error: "Failed to extract document information" });
  }
});

router.post("/api/documents/enhanced/search", async (req: Request, res: Response) => {
  const { query, profileId } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    const documents = Array.from(documentStore.values())
      .filter(doc => !profileId || doc.profileId === profileId);

    const results = await searchDocumentsNaturalLanguage(query, documents);
    res.json({ results, query });
  } catch (error) {
    console.error("[DocumentSearch] API error:", error);
    res.status(500).json({ error: "Failed to search documents" });
  }
});

router.get("/api/documents/enhanced/stats", (_req: Request, res: Response) => {
  const documents = Array.from(documentStore.values());
  const totalVersions = documents.reduce((sum, doc) => sum + doc.versions.length, 0);
  
  const categoryCounts: Record<string, number> = {};
  documents.forEach(doc => {
    categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
  });

  let totalMedications = 0;
  let totalLabValues = 0;
  let totalDiagnoses = 0;
  
  documents.forEach(doc => {
    const latest = doc.versions[doc.versions.length - 1];
    if (latest?.extraction) {
      totalMedications += latest.extraction.medications.length;
      totalLabValues += latest.extraction.labValues.length;
      totalDiagnoses += latest.extraction.diagnoses.length;
    }
  });

  res.json({
    totalDocuments: documents.length,
    totalVersions,
    categoryCounts,
    extractedData: {
      medications: totalMedications,
      labValues: totalLabValues,
      diagnoses: totalDiagnoses,
    },
  });
});

interface CrossReferenceResult {
  documents: Array<{ id: string; title: string; category: string }>;
  connections: Array<{
    type: "medication_interaction" | "lab_correlation" | "diagnosis_progression" | "imaging_comparison" | "temporal_relationship";
    description: string;
    documentIds: string[];
    confidence: number;
    clinicalRelevance: "high" | "medium" | "low";
  }>;
  discrepancies: Array<{
    type: "conflicting_values" | "missing_followup" | "inconsistent_dates" | "contradictory_findings" | "medication_conflict";
    description: string;
    documentIds: string[];
    severity: "critical" | "warning" | "info";
    recommendation: string;
  }>;
  timeline: Array<{
    date: string;
    event: string;
    documentId: string;
    documentTitle: string;
    category: string;
  }>;
  summary: string;
}

interface MultiDocumentQAResult {
  answer: string;
  sourcedFrom: Array<{
    documentId: string;
    documentTitle: string;
    relevantExcerpt: string;
    confidence: number;
  }>;
  relatedQuestions: string[];
  disclaimer: string;
}

const CROSS_REFERENCE_PROMPT = `You are a medical document analyst specializing in cross-referencing patient health records.

IMPORTANT COMPLIANCE NOTES:
- You are analyzing data for patient record organization ONLY
- You are NOT providing medical advice or clinical decision support
- All analysis is for informational purposes to help patients understand their records
- Always include disclaimers about consulting healthcare providers

Given multiple medical documents with their extracted data, analyze and identify:

1. CONNECTIONS: Find relationships between documents:
   - Medications mentioned across documents
   - Lab values that correlate with diagnoses
   - Imaging findings that support or relate to diagnoses
   - Temporal progressions of conditions
   - Treatment responses over time

2. DISCREPANCIES: Identify potential inconsistencies:
   - Conflicting lab values or measurements
   - Medications that may interact
   - Missing follow-up items mentioned but not completed
   - Inconsistent dates or timelines
   - Contradictory findings between reports

3. TIMELINE: Create a chronological view of key events

4. SUMMARY: Provide a concise overview of findings

Return your analysis in the following JSON format:
{
  "connections": [
    { "type": "lab_correlation|medication_interaction|diagnosis_progression|imaging_comparison|temporal_relationship", "description": "...", "documentIds": ["id1", "id2"], "confidence": 0.0-1.0, "clinicalRelevance": "high|medium|low" }
  ],
  "discrepancies": [
    { "type": "conflicting_values|missing_followup|inconsistent_dates|contradictory_findings|medication_conflict", "description": "...", "documentIds": ["id1"], "severity": "critical|warning|info", "recommendation": "..." }
  ],
  "timeline": [
    { "date": "YYYY-MM-DD", "event": "...", "documentId": "...", "documentTitle": "...", "category": "..." }
  ],
  "summary": "..."
}`;

const MULTI_DOC_QA_PROMPT = `You are a medical document assistant helping patients understand their health records.

IMPORTANT COMPLIANCE NOTES:
- You are NOT providing medical advice
- You are only organizing and explaining information already in the patient's documents
- Always recommend consulting healthcare providers for medical decisions
- Be accurate and cite which documents contain the information

Given the patient's medical documents, answer their question by:
1. Finding relevant information across all documents
2. Citing specific documents for each piece of information
3. Explaining medical terms in plain language
4. Identifying any gaps or limitations in the available information

Return your response in JSON format:
{
  "answer": "Clear, patient-friendly answer with citations to document titles",
  "sourcedFrom": [
    { "documentId": "...", "documentTitle": "...", "relevantExcerpt": "...", "confidence": 0.0-1.0 }
  ],
  "relatedQuestions": ["Other questions the patient might want to ask"],
  "disclaimer": "Standard disclaimer about consulting healthcare providers"
}`;

async function crossReferenceDocuments(documents: Document[]): Promise<CrossReferenceResult> {
  const documentsData = documents.map(doc => {
    const latestVersion = doc.versions[doc.versions.length - 1];
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      date: doc.updatedAt,
      extraction: latestVersion?.extraction || null,
      content: latestVersion?.searchableText?.substring(0, 2000) || "",
    };
  });

  try {
    const content = await generatePhiSafeText({
      system: CROSS_REFERENCE_PROMPT,
      user: `Analyze these medical documents:\n\n${JSON.stringify(documentsData, null, 2)}`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    if (!content) throw new Error("No response from AI");

    const analysis = JSON.parse(content);
    
    return {
      documents: documents.map(d => ({ id: d.id, title: d.title, category: d.category })),
      connections: analysis.connections || [],
      discrepancies: analysis.discrepancies || [],
      timeline: analysis.timeline || [],
      summary: analysis.summary || "Analysis complete.",
    };
  } catch (error) {
    console.error("[CrossReference] AI error:", error);
    return {
      documents: documents.map(d => ({ id: d.id, title: d.title, category: d.category })),
      connections: [],
      discrepancies: [],
      timeline: documents.map(d => ({
        date: d.updatedAt.split('T')[0],
        event: d.title,
        documentId: d.id,
        documentTitle: d.title,
        category: d.category,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      summary: "Unable to perform AI analysis. Basic timeline generated from document dates.",
    };
  }
}

async function answerMultiDocumentQuestion(question: string, documents: Document[]): Promise<MultiDocumentQAResult> {
  const documentsData = documents.map(doc => {
    const latestVersion = doc.versions[doc.versions.length - 1];
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      extraction: latestVersion?.extraction || null,
      content: latestVersion?.searchableText?.substring(0, 3000) || "",
    };
  });

  try {
    const content = await generatePhiSafeText({
      system: MULTI_DOC_QA_PROMPT,
      user: `Question: ${question}\n\nDocuments:\n${JSON.stringify(documentsData, null, 2)}`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    if (!content) throw new Error("No response from AI");

    const result = JSON.parse(content);
    
    return {
      answer: result.answer || "Unable to find relevant information in the documents.",
      sourcedFrom: result.sourcedFrom || [],
      relatedQuestions: result.relatedQuestions || [],
      disclaimer: result.disclaimer || "This information is for reference only. Please consult your healthcare provider for medical advice.",
    };
  } catch (error) {
    console.error("[MultiDocQA] AI error:", error);
    return {
      answer: "Unable to analyze documents at this time. Please try again later.",
      sourcedFrom: [],
      relatedQuestions: [],
      disclaimer: "This information is for reference only. Please consult your healthcare provider for medical advice.",
    };
  }
}

async function compareDocuments(doc1: Document, doc2: Document): Promise<{
  comparison: {
    similarities: string[];
    differences: string[];
    progressions: string[];
    concerns: string[];
  };
  summary: string;
}> {
  const docs = [doc1, doc2].map(doc => {
    const latestVersion = doc.versions[doc.versions.length - 1];
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      date: doc.updatedAt,
      extraction: latestVersion?.extraction || null,
    };
  });

  try {
    const content = await generatePhiSafeText({
      system: `You are a medical document comparison assistant. Compare two medical documents and identify:
1. Similarities in findings, medications, or diagnoses
2. Differences in values, measurements, or conclusions
3. Progressions showing changes over time (improvements or concerns)
4. Any concerns that might warrant attention

COMPLIANCE: This is for patient information only, not clinical decision support.
Return JSON: { "comparison": { "similarities": [...], "differences": [...], "progressions": [...], "concerns": [...] }, "summary": "..." }`,
      user: `Compare these documents:\n\nDocument 1:\n${JSON.stringify(docs[0], null, 2)}\n\nDocument 2:\n${JSON.stringify(docs[1], null, 2)}`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    if (!content) throw new Error("No response from AI");

    return JSON.parse(content);
  } catch (error) {
    console.error("[CompareDocuments] AI error:", error);
    return {
      comparison: {
        similarities: [],
        differences: [],
        progressions: [],
        concerns: [],
      },
      summary: "Unable to perform comparison analysis.",
    };
  }
}

router.post("/api/documents/enhanced/cross-reference", async (req: Request, res: Response) => {
  const { documentIds, profileId } = req.body;

  if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
    return res.status(400).json({ error: "At least 2 document IDs required for cross-referencing" });
  }

  try {
    const documents: Document[] = [];
    for (const id of documentIds) {
      const doc = documentStore.get(id);
      if (doc && (!profileId || doc.profileId === profileId)) {
        documents.push(doc);
      }
    }

    if (documents.length < 2) {
      return res.status(404).json({ error: "Not enough valid documents found" });
    }

    const result = await crossReferenceDocuments(documents);
    res.json({ 
      result,
      disclaimer: "This analysis is for informational purposes only. It does not constitute medical advice. Please consult your healthcare provider for any medical decisions.",
    });
  } catch (error) {
    console.error("[CrossReference] API error:", error);
    res.status(500).json({ error: "Failed to cross-reference documents" });
  }
});

router.post("/api/documents/enhanced/ask", async (req: Request, res: Response) => {
  const { question, documentIds, profileId } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    let documents: Document[];
    
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      documents = documentIds
        .map((id: string) => documentStore.get(id))
        .filter((doc): doc is Document => !!doc && (!profileId || doc.profileId === profileId));
    } else {
      documents = Array.from(documentStore.values())
        .filter(doc => !profileId || doc.profileId === profileId);
    }

    if (documents.length === 0) {
      return res.status(404).json({ error: "No documents found to analyze" });
    }

    const result = await answerMultiDocumentQuestion(question, documents);
    res.json({ 
      result,
      documentsAnalyzed: documents.length,
    });
  } catch (error) {
    console.error("[MultiDocQA] API error:", error);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

router.post("/api/documents/enhanced/compare", async (req: Request, res: Response) => {
  const { documentId1, documentId2, profileId } = req.body;

  if (!documentId1 || !documentId2) {
    return res.status(400).json({ error: "Two document IDs required for comparison" });
  }

  try {
    const doc1 = documentStore.get(documentId1);
    const doc2 = documentStore.get(documentId2);

    if (!doc1 || !doc2) {
      return res.status(404).json({ error: "One or both documents not found" });
    }

    if (profileId && (doc1.profileId !== profileId || doc2.profileId !== profileId)) {
      return res.status(403).json({ error: "Access denied to one or both documents" });
    }

    const result = await compareDocuments(doc1, doc2);
    res.json({
      document1: { id: doc1.id, title: doc1.title, category: doc1.category },
      document2: { id: doc2.id, title: doc2.title, category: doc2.category },
      ...result,
      disclaimer: "This comparison is for informational purposes only. Please consult your healthcare provider for medical decisions.",
    });
  } catch (error) {
    console.error("[CompareDocuments] API error:", error);
    res.status(500).json({ error: "Failed to compare documents" });
  }
});

router.get("/api/documents/enhanced/discrepancies", async (req: Request, res: Response) => {
  const profileId = req.query.profileId as string;

  try {
    const documents = Array.from(documentStore.values())
      .filter(doc => !profileId || doc.profileId === profileId);

    if (documents.length < 2) {
      return res.json({ 
        discrepancies: [],
        message: "At least 2 documents needed for discrepancy detection",
      });
    }

    const result = await crossReferenceDocuments(documents);
    res.json({
      discrepancies: result.discrepancies,
      documentsAnalyzed: documents.length,
      disclaimer: "This analysis is for informational purposes only. Please consult your healthcare provider for any concerns.",
    });
  } catch (error) {
    console.error("[Discrepancies] API error:", error);
    res.status(500).json({ error: "Failed to detect discrepancies" });
  }
});

initializeSampleData();
console.log("[EnhancedDocumentManagement] Service initialized with AI extraction, natural language search, version control, and cross-referencing");

export { router as enhancedDocumentRouter };
