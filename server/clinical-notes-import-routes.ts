import { Router, Request, Response } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

export interface ClinicalNote {
  id: string;
  patientId: string;
  title: string;
  noteType: "progress_note" | "discharge_summary" | "consultation" | "operative_report" | "history_physical" | "nursing_note" | "radiology_report" | "pathology_report" | "lab_report" | "other";
  content: string;
  summary?: string;
  author?: string;
  authorRole?: string;
  facility?: string;
  dateOfService: string;
  importedAt: string;
  sourceFormat: "pdf" | "text" | "cda" | "fhir" | "hl7";
  sourceFileName?: string;
  fhirDocumentReference?: string;
  tags: string[];
  isVerified: boolean;
}

export interface ImportResult {
  success: boolean;
  noteId?: string;
  error?: string;
  extractedData?: {
    noteType: string;
    dateOfService: string;
    author?: string;
    facility?: string;
    summary?: string;
  };
}

const clinicalNotes = new Map<string, ClinicalNote[]>();

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const NOTE_TYPES = [
  { id: "progress_note", name: "Progress Note", description: "Regular physician updates on patient status" },
  { id: "discharge_summary", name: "Discharge Summary", description: "Summary of hospital stay and discharge plan" },
  { id: "consultation", name: "Consultation", description: "Specialist consultation notes" },
  { id: "operative_report", name: "Operative Report", description: "Surgical procedure documentation" },
  { id: "history_physical", name: "History & Physical", description: "Initial patient evaluation" },
  { id: "nursing_note", name: "Nursing Note", description: "Nursing staff documentation" },
  { id: "radiology_report", name: "Radiology Report", description: "Imaging study interpretations" },
  { id: "pathology_report", name: "Pathology Report", description: "Laboratory pathology findings" },
  { id: "lab_report", name: "Lab Report", description: "Laboratory test results" },
  { id: "other", name: "Other", description: "Other clinical documentation" },
];

router.get("/api/clinical-notes/types", (req: Request, res: Response) => {
  res.json({ success: true, data: NOTE_TYPES });
});

router.get("/api/clinical-notes/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { noteType, startDate, endDate, search } = req.query;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId is required" });
    }

    let notes = clinicalNotes.get(patientId) || [];

    if (noteType && noteType !== "all") {
      notes = notes.filter(n => n.noteType === noteType);
    }

    if (startDate) {
      notes = notes.filter(n => new Date(n.dateOfService) >= new Date(startDate as string));
    }

    if (endDate) {
      notes = notes.filter(n => new Date(n.dateOfService) <= new Date(endDate as string));
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      notes = notes.filter(n => 
        n.title.toLowerCase().includes(searchLower) ||
        n.content.toLowerCase().includes(searchLower) ||
        n.author?.toLowerCase().includes(searchLower) ||
        n.facility?.toLowerCase().includes(searchLower)
      );
    }

    notes.sort((a, b) => new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime());

    await logPhiAccess({
      action: "read",
      resourceType: "ClinicalNote",
      patientId,
      userId: patientId,
      details: `Retrieved ${notes.length} clinical notes`,
    });

    res.json({ success: true, data: notes });
  } catch (error) {
    console.error("Error fetching clinical notes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch clinical notes" });
  }
});

const importNoteSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1),
  noteType: z.enum(["progress_note", "discharge_summary", "consultation", "operative_report", "history_physical", "nursing_note", "radiology_report", "pathology_report", "lab_report", "other"]),
  content: z.string().min(1),
  author: z.string().optional(),
  authorRole: z.string().optional(),
  facility: z.string().optional(),
  dateOfService: z.string(),
  sourceFormat: z.enum(["pdf", "text", "cda", "fhir", "hl7"]).default("text"),
  sourceFileName: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

router.post("/api/clinical-notes/import", async (req: Request, res: Response) => {
  try {
    const validation = importNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues });
    }

    const data = validation.data;
    const now = new Date().toISOString();

    const summary = extractSummary(data.content);

    const note: ClinicalNote = {
      id: generateId(),
      patientId: data.patientId,
      title: data.title,
      noteType: data.noteType,
      content: data.content,
      summary,
      author: data.author,
      authorRole: data.authorRole,
      facility: data.facility,
      dateOfService: data.dateOfService,
      importedAt: now,
      sourceFormat: data.sourceFormat,
      sourceFileName: data.sourceFileName,
      tags: data.tags,
      isVerified: false,
    };

    const existing = clinicalNotes.get(data.patientId) || [];
    existing.push(note);
    clinicalNotes.set(data.patientId, existing);

    await logPhiAccess({
      action: "write",
      resourceType: "ClinicalNote",
      patientId: data.patientId,
      userId: data.patientId,
      resourceId: note.id,
      details: `Imported clinical note: ${data.title} (${data.noteType})`,
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error("Error importing clinical note:", error);
    res.status(500).json({ success: false, error: "Failed to import clinical note" });
  }
});

const parseDocumentSchema = z.object({
  patientId: z.string().min(1),
  fileContent: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
});

router.post("/api/clinical-notes/parse", async (req: Request, res: Response) => {
  try {
    const validation = parseDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues });
    }

    const { patientId, fileContent, fileName, mimeType } = validation.data;

    const parsed = parseDocumentContent(fileContent, fileName);

    await logPhiAccess({
      action: "read",
      resourceType: "DocumentParse",
      patientId,
      userId: patientId,
      details: `Parsed document: ${fileName}`,
    });

    res.json({
      success: true,
      data: {
        suggestedTitle: parsed.title,
        suggestedNoteType: parsed.noteType,
        suggestedDateOfService: parsed.dateOfService,
        suggestedAuthor: parsed.author,
        suggestedFacility: parsed.facility,
        extractedContent: parsed.content,
        confidence: parsed.confidence,
      },
    });
  } catch (error) {
    console.error("Error parsing document:", error);
    res.status(500).json({ success: false, error: "Failed to parse document" });
  }
});

router.post("/api/clinical-notes/bulk-import", async (req: Request, res: Response) => {
  try {
    const { patientId, notes } = req.body;

    if (!patientId || !Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: "patientId and notes array required" });
    }

    const results: ImportResult[] = [];
    const now = new Date().toISOString();

    for (const noteData of notes) {
      try {
        const validation = importNoteSchema.safeParse({ ...noteData, patientId });
        if (!validation.success) {
          results.push({ success: false, error: validation.error.message });
          continue;
        }

        const data = validation.data;
        const note: ClinicalNote = {
          id: generateId(),
          patientId: data.patientId,
          title: data.title,
          noteType: data.noteType,
          content: data.content,
          summary: extractSummary(data.content),
          author: data.author,
          authorRole: data.authorRole,
          facility: data.facility,
          dateOfService: data.dateOfService,
          importedAt: now,
          sourceFormat: data.sourceFormat,
          sourceFileName: data.sourceFileName,
          tags: data.tags,
          isVerified: false,
        };

        const existing = clinicalNotes.get(patientId) || [];
        existing.push(note);
        clinicalNotes.set(patientId, existing);

        results.push({ success: true, noteId: note.id });
      } catch (err) {
        results.push({ success: false, error: "Failed to import note" });
      }
    }

    await logPhiAccess({
      action: "write",
      resourceType: "ClinicalNote",
      patientId,
      userId: patientId,
      details: `Bulk imported ${results.filter(r => r.success).length} clinical notes`,
    });

    res.json({
      success: true,
      data: {
        total: notes.length,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
    res.status(500).json({ success: false, error: "Failed to bulk import notes" });
  }
});

router.get("/api/clinical-notes/:patientId/:noteId", async (req: Request, res: Response) => {
  try {
    const { patientId, noteId } = req.params;

    const notes = clinicalNotes.get(patientId) || [];
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    await logPhiAccess({
      action: "read",
      resourceType: "ClinicalNote",
      patientId,
      userId: patientId,
      resourceId: noteId,
      details: `Viewed clinical note: ${note.title}`,
    });

    res.json({ success: true, data: note });
  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({ success: false, error: "Failed to fetch note" });
  }
});

router.patch("/api/clinical-notes/:patientId/:noteId/verify", async (req: Request, res: Response) => {
  try {
    const { patientId, noteId } = req.params;

    const notes = clinicalNotes.get(patientId) || [];
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    notes[noteIndex].isVerified = true;
    clinicalNotes.set(patientId, notes);

    await logPhiAccess({
      action: "write",
      resourceType: "ClinicalNote",
      patientId,
      userId: patientId,
      resourceId: noteId,
      details: `Verified clinical note: ${notes[noteIndex].title}`,
    });

    res.json({ success: true, data: notes[noteIndex] });
  } catch (error) {
    console.error("Error verifying note:", error);
    res.status(500).json({ success: false, error: "Failed to verify note" });
  }
});

router.delete("/api/clinical-notes/:patientId/:noteId", async (req: Request, res: Response) => {
  try {
    const { patientId, noteId } = req.params;

    const notes = clinicalNotes.get(patientId) || [];
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    const deletedNote = notes.splice(noteIndex, 1)[0];
    clinicalNotes.set(patientId, notes);

    await logPhiAccess({
      action: "delete",
      resourceType: "ClinicalNote",
      patientId,
      userId: patientId,
      resourceId: noteId,
      details: `Deleted clinical note: ${deletedNote.title}`,
    });

    res.json({ success: true, message: "Note deleted" });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ success: false, error: "Failed to delete note" });
  }
});

function extractSummary(content: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.slice(0, 3).join(". ").trim() + (sentences.length > 3 ? "..." : "");
}

function parseDocumentContent(content: string, fileName: string): {
  title: string;
  noteType: ClinicalNote["noteType"];
  dateOfService: string;
  author?: string;
  facility?: string;
  content: string;
  confidence: number;
} {
  const lowerContent = content.toLowerCase();
  const lowerFileName = fileName.toLowerCase();
  
  let noteType: ClinicalNote["noteType"] = "other";
  let confidence = 0.5;

  if (lowerContent.includes("discharge summary") || lowerFileName.includes("discharge")) {
    noteType = "discharge_summary";
    confidence = 0.9;
  } else if (lowerContent.includes("operative report") || lowerContent.includes("surgery")) {
    noteType = "operative_report";
    confidence = 0.85;
  } else if (lowerContent.includes("consultation") || lowerContent.includes("consult note")) {
    noteType = "consultation";
    confidence = 0.85;
  } else if (lowerContent.includes("history and physical") || lowerContent.includes("h&p")) {
    noteType = "history_physical";
    confidence = 0.85;
  } else if (lowerContent.includes("radiology") || lowerContent.includes("imaging")) {
    noteType = "radiology_report";
    confidence = 0.85;
  } else if (lowerContent.includes("pathology")) {
    noteType = "pathology_report";
    confidence = 0.85;
  } else if (lowerContent.includes("lab result") || lowerContent.includes("laboratory")) {
    noteType = "lab_report";
    confidence = 0.8;
  } else if (lowerContent.includes("progress note") || lowerContent.includes("follow-up")) {
    noteType = "progress_note";
    confidence = 0.8;
  } else if (lowerContent.includes("nursing")) {
    noteType = "nursing_note";
    confidence = 0.75;
  }

  const dateMatch = content.match(/(?:date[:\s]+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  const dateOfService = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];

  const authorMatch = content.match(/(?:physician|doctor|provider|author)[:\s]+([A-Za-z\s,\.]+(?:MD|DO|NP|PA|RN)?)/i);
  const author = authorMatch ? authorMatch[1].trim() : undefined;

  const facilityMatch = content.match(/(?:hospital|clinic|facility|center)[:\s]+([A-Za-z\s]+(?:Hospital|Clinic|Center|Medical))/i);
  const facility = facilityMatch ? facilityMatch[1].trim() : undefined;

  const title = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

  return {
    title,
    noteType,
    dateOfService,
    author,
    facility,
    content,
    confidence,
  };
}

export default router;
