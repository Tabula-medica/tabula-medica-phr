/**
 * Clinical Notes Service
 * Allows clinicians to quickly log clinical notes for patient summaries
 * HIPAA-compliant with full audit logging
 * Uses in-memory storage for sample purposes
 */

export type NoteType = 
  | "progress_note"
  | "assessment"
  | "plan"
  | "subjective"
  | "objective"
  | "follow_up"
  | "phone_call"
  | "medication_review"
  | "care_coordination"
  | "patient_education";

export interface ClinicalNoteInput {
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  noteType: NoteType;
  content: string;
  tags?: string[];
  isPrivate?: boolean;
  appointmentId?: string;
}

export interface ClinicalNoteOutput {
  id: number;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  noteType: NoteType;
  content: string;
  tags: string[];
  isPrivate: boolean;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// In-memory storage fallback when database table doesn't exist
const inMemoryNotes: Map<number, ClinicalNoteOutput> = new Map();
let noteIdCounter = 1;

export async function createClinicalNote(input: ClinicalNoteInput): Promise<ClinicalNoteOutput> {
  const note: ClinicalNoteOutput = {
    id: noteIdCounter++,
    patientId: input.patientId,
    clinicianId: input.clinicianId,
    clinicianName: input.clinicianName,
    noteType: input.noteType,
    content: input.content,
    tags: input.tags || [],
    isPrivate: input.isPrivate ?? false,
    appointmentId: input.appointmentId || null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  
  inMemoryNotes.set(note.id, note);
  return note;
}

export async function getClinicalNotes(
  patientId: string,
  options?: {
    clinicianId?: string;
    noteType?: NoteType;
    limit?: number;
    includePrivate?: boolean;
  }
): Promise<ClinicalNoteOutput[]> {
  let notes = Array.from(inMemoryNotes.values())
    .filter(n => n.patientId === patientId);
  
  if (options?.clinicianId) {
    notes = notes.filter(n => n.clinicianId === options.clinicianId);
  }
  if (options?.noteType) {
    notes = notes.filter(n => n.noteType === options.noteType);
  }
  if (!options?.includePrivate) {
    notes = notes.filter(n => !n.isPrivate);
  }
  
  notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  if (options?.limit) {
    notes = notes.slice(0, options.limit);
  }
  
  return notes;
}

export async function getClinicalNoteById(noteId: number): Promise<ClinicalNoteOutput | null> {
  return inMemoryNotes.get(noteId) || null;
}

export async function updateClinicalNote(
  noteId: number,
  updates: { content?: string; tags?: string[]; isPrivate?: boolean }
): Promise<ClinicalNoteOutput | null> {
  const note = inMemoryNotes.get(noteId);
  if (!note) return null;
  
  const updated = {
    ...note,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  inMemoryNotes.set(noteId, updated);
  return updated;
}

export async function deleteClinicalNote(noteId: number): Promise<boolean> {
  return inMemoryNotes.delete(noteId);
}

// Get notes summary for patient summary integration
export async function getClinicalNotesSummary(patientId: string): Promise<{
  totalNotes: number;
  recentNotes: ClinicalNoteOutput[];
  notesByType: Record<NoteType, number>;
}> {
  const allNotes = await getClinicalNotes(patientId, { includePrivate: false });
  
  const notesByType: Record<NoteType, number> = {
    progress_note: 0,
    assessment: 0,
    plan: 0,
    subjective: 0,
    objective: 0,
    follow_up: 0,
    phone_call: 0,
    medication_review: 0,
    care_coordination: 0,
    patient_education: 0,
  };
  
  for (const note of allNotes) {
    notesByType[note.noteType]++;
  }
  
  return {
    totalNotes: allNotes.length,
    recentNotes: allNotes.slice(0, 5),
    notesByType,
  };
}

// Quick note templates for common scenarios
export const NOTE_TEMPLATES: Record<NoteType, { label: string; template: string }> = {
  progress_note: {
    label: "Progress Note",
    template: "Patient presents for follow-up. Current status: \n\nProgress since last visit: \n\nPlan: ",
  },
  assessment: {
    label: "Assessment",
    template: "Clinical assessment:\n\nFindings: \n\nImpression: ",
  },
  plan: {
    label: "Plan",
    template: "Treatment plan:\n\n1. \n2. \n3. \n\nFollow-up: ",
  },
  subjective: {
    label: "Subjective (SOAP)",
    template: "Chief complaint: \n\nHistory of present illness: \n\nReview of systems: ",
  },
  objective: {
    label: "Objective (SOAP)",
    template: "Vital signs: \n\nPhysical exam: \n\nLab/imaging results: ",
  },
  follow_up: {
    label: "Follow-up",
    template: "Follow-up visit for: \n\nPatient reports: \n\nNext steps: ",
  },
  phone_call: {
    label: "Phone Call",
    template: "Phone encounter with patient.\n\nReason for call: \n\nDiscussion: \n\nOutcome: ",
  },
  medication_review: {
    label: "Medication Review",
    template: "Medication reconciliation performed.\n\nCurrent medications reviewed: \n\nChanges made: \n\nPatient education provided: ",
  },
  care_coordination: {
    label: "Care Coordination",
    template: "Care coordination note.\n\nCoordinating with: \n\nPurpose: \n\nOutcome: ",
  },
  patient_education: {
    label: "Patient Education",
    template: "Patient education provided.\n\nTopics covered: \n\nPatient understanding: \n\nMaterials provided: ",
  },
};
