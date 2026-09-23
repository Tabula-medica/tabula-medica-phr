import type { Express, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import { generatePhiSafeText } from "./services/ai-gateway";

interface ClinicalNote {
  id: string;
  date: string;
  provider: string;
  chiefComplaint: string;
  diagnosis: string;
  procedures: string[];
  notes: string;
}

interface CodingSuggestion {
  code: string;
  type: "ICD-10" | "CPT" | "HCPCS";
  description: string;
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
}

interface SchedulingSuggestion {
  appointmentType: string;
  suggestedTimeframe: string;
  priority: "Urgent" | "Routine" | "Follow-up";
  duration: number;
  reasoning: string;
  preferredSpecialty?: string;
}

interface ReferralDraft {
  recipientSpecialty: string;
  urgency: "Routine" | "Urgent" | "Emergent";
  reasonForReferral: string;
  clinicalSummary: string;
  relevantHistory: string[];
  requestedServices: string[];
  disclaimer: string;
}

const sampleClinicalNotes: ClinicalNote[] = [
  {
    id: "note-001",
    date: "2026-01-15",
    provider: "Dr. Sarah Chen",
    chiefComplaint: "Persistent cough for 3 weeks",
    diagnosis: "Acute bronchitis",
    procedures: ["Chest auscultation", "Vital signs"],
    notes: "Patient presents with productive cough, no fever. Lungs clear, mild wheezing. Recommend supportive care and follow-up if symptoms persist beyond 2 weeks.",
  },
  {
    id: "note-002",
    date: "2026-01-10",
    provider: "Dr. Michael Torres",
    chiefComplaint: "Right knee pain after fall",
    diagnosis: "Right knee contusion, rule out ligament injury",
    procedures: ["Physical examination", "X-ray right knee"],
    notes: "Patient fell while walking. Mild swelling, no instability. X-ray negative for fracture. May need MRI if symptoms persist.",
  },
  {
    id: "note-003",
    date: "2026-01-05",
    provider: "Dr. Sarah Chen",
    chiefComplaint: "Annual wellness visit",
    diagnosis: "Essential hypertension, controlled. Type 2 diabetes mellitus, well controlled.",
    procedures: ["Comprehensive metabolic panel", "HbA1c", "Lipid panel", "Blood pressure check"],
    notes: "BP 128/82, HbA1c 6.2%. Continue current medications. Discussed diet and exercise. Schedule follow-up in 3 months.",
  },
];

const sampleProviders = [
  { name: "Dr. Sarah Chen", specialty: "Internal Medicine", availability: ["Mon 9-12", "Wed 2-5", "Fri 9-12"] },
  { name: "Dr. Michael Torres", specialty: "Orthopedics", availability: ["Tue 10-4", "Thu 10-4"] },
  { name: "Dr. Lisa Wong", specialty: "Cardiology", availability: ["Mon 1-5", "Wed 9-12"] },
  { name: "Dr. James Miller", specialty: "Pulmonology", availability: ["Tue 9-12", "Fri 1-5"] },
  { name: "Dr. Emily Rodriguez", specialty: "Endocrinology", availability: ["Mon 9-1", "Thu 2-5"] },
];

export function registerAdminWorkflowRoutes(app: Express) {
  app.get("/api/admin-workflow/clinical-notes", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "ClinicalNote",
        action: "read",
        details: "VIEW_CLINICAL_NOTES_FOR_CODING",
      });

      res.json({
        success: true,
        data: {
          notes: sampleClinicalNotes,
          providers: sampleProviders,
        },
      });
    } catch (error) {
      console.error("[AdminWorkflow] Error fetching clinical notes");
      res.status(500).json({ error: "Failed to fetch clinical notes" });
    }
  });

  app.post("/api/admin-workflow/suggest-codes", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { noteId } = req.body;

      if (!noteId) {
        return res.status(400).json({ error: "Note ID is required" });
      }

      const note = sampleClinicalNotes.find(n => n.id === noteId);
      if (!note) {
        return res.status(404).json({ error: "Clinical note not found" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "CodingSuggestion",
        action: "read",
        details: `AI_CODING_SUGGESTION: ${noteId}`,
      });

      const prompt = `You are a medical coding assistant helping with administrative billing tasks. This is NOT clinical decision support - you are only suggesting billing codes based on documented diagnoses and procedures.

Analyze this clinical note and suggest appropriate medical billing codes:

Chief Complaint: ${note.chiefComplaint}
Diagnosis: ${note.diagnosis}
Procedures: ${note.procedures.join(", ")}
Clinical Notes: ${note.notes}

Provide coding suggestions in the following JSON format:
{
  "suggestions": [
    {
      "code": "ICD-10 or CPT code",
      "type": "ICD-10 or CPT or HCPCS",
      "description": "Code description",
      "confidence": "High or Medium or Low",
      "reasoning": "Brief explanation of why this code applies"
    }
  ]
}

IMPORTANT: These are administrative suggestions only. A certified medical coder must review and validate all codes before submission. Include both diagnosis codes (ICD-10) and procedure codes (CPT) where applicable.`;

      const responseText = (await generatePhiSafeText({
        user: prompt,
        responseMimeType: "application/json",
      })) || "{}";
      let suggestions: CodingSuggestion[] = [];

      try {
        const parsed = JSON.parse(responseText);
        suggestions = parsed.suggestions || [];
      } catch {
        suggestions = [
          {
            code: "J20.9",
            type: "ICD-10",
            description: "Acute bronchitis, unspecified",
            confidence: "High",
            reasoning: "Based on documented diagnosis of acute bronchitis",
          },
        ];
      }

      res.json({
        success: true,
        data: {
          noteId,
          suggestions,
          generatedAt: new Date().toISOString(),
          disclaimer: "ADMINISTRATIVE USE ONLY: These are AI-generated coding suggestions for billing purposes. A certified medical coder must review and validate all codes before claim submission. This tool does not provide clinical guidance.",
        },
      });
    } catch (error) {
      console.error("[AdminWorkflow] Error generating coding suggestions");
      res.status(500).json({ error: "Failed to generate coding suggestions" });
    }
  });

  app.post("/api/admin-workflow/suggest-scheduling", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { noteId } = req.body;

      if (!noteId) {
        return res.status(400).json({ error: "Note ID is required" });
      }

      const note = sampleClinicalNotes.find(n => n.id === noteId);
      if (!note) {
        return res.status(404).json({ error: "Clinical note not found" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "SchedulingSuggestion",
        action: "read",
        details: `AI_SCHEDULING_SUGGESTION: ${noteId}`,
      });

      const prompt = `You are a medical scheduling assistant helping with administrative appointment scheduling. This is NOT clinical decision support - you are only suggesting scheduling based on documented treatment plans.

Analyze this clinical note and suggest follow-up appointment scheduling:

Chief Complaint: ${note.chiefComplaint}
Diagnosis: ${note.diagnosis}
Clinical Notes: ${note.notes}
Provider: ${note.provider}

Available Providers:
${sampleProviders.map(p => `- ${p.name} (${p.specialty}): ${p.availability.join(", ")}`).join("\n")}

Provide scheduling suggestions in the following JSON format:
{
  "suggestions": [
    {
      "appointmentType": "Type of appointment",
      "suggestedTimeframe": "When to schedule (e.g., '2 weeks', '3 months')",
      "priority": "Urgent or Routine or Follow-up",
      "duration": 30,
      "reasoning": "Why this scheduling is appropriate",
      "preferredSpecialty": "Specialty if referral needed"
    }
  ]
}

IMPORTANT: These are administrative scheduling suggestions only. Clinical staff must confirm all appointments based on clinical judgment.`;

      const responseText = (await generatePhiSafeText({
        user: prompt,
        responseMimeType: "application/json",
      })) || "{}";
      let suggestions: SchedulingSuggestion[] = [];

      try {
        const parsed = JSON.parse(responseText);
        suggestions = parsed.suggestions || [];
      } catch {
        suggestions = [
          {
            appointmentType: "Follow-up Visit",
            suggestedTimeframe: "2 weeks",
            priority: "Follow-up",
            duration: 15,
            reasoning: "Standard follow-up as noted in clinical documentation",
          },
        ];
      }

      res.json({
        success: true,
        data: {
          noteId,
          suggestions,
          availableProviders: sampleProviders,
          generatedAt: new Date().toISOString(),
          disclaimer: "ADMINISTRATIVE USE ONLY: These are AI-generated scheduling suggestions. Clinical staff must confirm all appointments based on clinical judgment and patient needs.",
        },
      });
    } catch (error) {
      console.error("[AdminWorkflow] Error generating scheduling suggestions");
      res.status(500).json({ error: "Failed to generate scheduling suggestions" });
    }
  });

  app.post("/api/admin-workflow/draft-referral", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { noteId, targetSpecialty, urgency } = req.body;

      if (!noteId || !targetSpecialty) {
        return res.status(400).json({ error: "Note ID and target specialty are required" });
      }

      const note = sampleClinicalNotes.find(n => n.id === noteId);
      if (!note) {
        return res.status(404).json({ error: "Clinical note not found" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "ReferralLetter",
        action: "write",
        details: `AI_REFERRAL_DRAFT: ${noteId} to ${targetSpecialty}`,
      });

      const prompt = `You are a medical administrative assistant helping draft referral letters. This is NOT clinical decision support - you are only helping with documentation based on existing clinical notes.

Draft a referral letter based on this clinical note:

Chief Complaint: ${note.chiefComplaint}
Diagnosis: ${note.diagnosis}
Procedures Performed: ${note.procedures.join(", ")}
Clinical Notes: ${note.notes}
Referring Provider: ${note.provider}
Target Specialty: ${targetSpecialty}
Urgency: ${urgency || "Routine"}

Provide the referral draft in the following JSON format:
{
  "recipientSpecialty": "${targetSpecialty}",
  "urgency": "${urgency || "Routine"}",
  "reasonForReferral": "Clear reason for the referral",
  "clinicalSummary": "Brief summary of relevant clinical information",
  "relevantHistory": ["Key history point 1", "Key history point 2"],
  "requestedServices": ["Requested service 1", "Requested service 2"]
}

IMPORTANT: This is a DRAFT only. The referring physician must review, modify as needed, and sign the referral before sending.`;

      const responseText = (await generatePhiSafeText({
        user: prompt,
        responseMimeType: "application/json",
      })) || "{}";
      let referralDraft: Partial<ReferralDraft>;

      try {
        referralDraft = JSON.parse(responseText);
      } catch {
        referralDraft = {
          recipientSpecialty: targetSpecialty,
          urgency: urgency || "Routine",
          reasonForReferral: `Referral for evaluation related to: ${note.diagnosis}`,
          clinicalSummary: note.notes,
          relevantHistory: [note.chiefComplaint],
          requestedServices: ["Consultation and evaluation"],
        };
      }

      res.json({
        success: true,
        data: {
          noteId,
          draft: {
            ...referralDraft,
            disclaimer: "DRAFT DOCUMENT: This AI-generated referral letter is a draft only. The referring physician must review, modify as clinically appropriate, and sign before sending. This tool assists with documentation and does not provide clinical guidance.",
          },
          referringProvider: note.provider,
          patientName: "John Smith",
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[AdminWorkflow] Error drafting referral letter");
      res.status(500).json({ error: "Failed to draft referral letter" });
    }
  });

  console.log("[Routes] Admin Workflow routes registered at /api/admin-workflow/*");
}
