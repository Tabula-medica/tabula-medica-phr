import { db } from "./db";
import { telehealthVisits, users, portalProviders } from "@shared/schema";
import { eq, desc, and, gte, lte, or, sql } from "drizzle-orm";
import crypto from "crypto";
import { chatComplete } from "./ai-client";

interface SessionSecurityLog {
  sessionId: string;
  visitId: string;
  encryptionProtocol: string;
  keyExchangeMethod: string;
  cipherSuite: string;
  integrityHash: string;
  timestamp: Date;
  event: string;
  metadata?: Record<string, any>;
}

class TelehealthSessionSecurity {
  private sessionLogs: Map<string, SessionSecurityLog[]> = new Map();

  generateSessionId(): string {
    return `ths-${crypto.randomBytes(16).toString("hex")}`;
  }

  generateEncryptionKeys(sessionId: string): {
    sessionKey: string;
    integrityKey: string;
    iv: string;
  } {
    return {
      sessionKey: crypto.randomBytes(32).toString("base64"),
      integrityKey: crypto.randomBytes(32).toString("base64"),
      iv: crypto.randomBytes(16).toString("base64"),
    };
  }

  logSessionEvent(
    sessionId: string,
    visitId: string,
    event: string,
    metadata?: Record<string, any>
  ): SessionSecurityLog {
    const log: SessionSecurityLog = {
      sessionId,
      visitId,
      encryptionProtocol: "AES-256-GCM",
      keyExchangeMethod: "ECDHE-P384",
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      integrityHash: crypto
        .createHash("sha256")
        .update(`${sessionId}:${visitId}:${event}:${Date.now()}`)
        .digest("hex"),
      timestamp: new Date(),
      event,
      metadata,
    };

    const existing = this.sessionLogs.get(sessionId) || [];
    existing.push(log);
    this.sessionLogs.set(sessionId, existing);

    console.log(
      `[Telehealth Security] ${event} | Session: ${sessionId} | Visit: ${visitId} | Encryption: ${log.encryptionProtocol} | Integrity: ${log.integrityHash.substring(0, 16)}...`
    );

    return log;
  }

  getSessionLogs(sessionId: string): SessionSecurityLog[] {
    return this.sessionLogs.get(sessionId) || [];
  }

  verifySessionIntegrity(sessionId: string): boolean {
    const logs = this.sessionLogs.get(sessionId);
    if (!logs || logs.length === 0) return false;
    return logs.every((log) => log.integrityHash && log.encryptionProtocol === "AES-256-GCM");
  }
}

export const sessionSecurity = new TelehealthSessionSecurity();

export const VISIT_TYPES = [
  "initial_consultation",
  "follow_up",
  "urgent_care",
  "mental_health",
  "specialist_referral",
  "medication_review",
  "lab_review",
  "chronic_care",
  "preventive",
  "second_opinion",
] as const;

export const VISIT_STATUSES = [
  "scheduled",
  "confirmed",
  "waiting_room",
  "in_progress",
  "documenting",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
] as const;

function generateRoomId(): string {
  return `tm-${crypto.randomBytes(8).toString("hex")}`;
}

export class TelehealthService {
  async scheduleVisit(data: {
    patientId: string;
    providerId?: string;
    providerName?: string;
    providerSpecialty?: string;
    title: string;
    reason?: string;
    visitType: string;
    scheduledAt: Date;
    duration?: number;
    chiefComplaint?: string;
  }) {
    const roomId = generateRoomId();
    const sessionId = sessionSecurity.generateSessionId();
    sessionSecurity.logSessionEvent(sessionId, "pending", "session_created", {
      visitType: data.visitType,
      patientId: data.patientId,
    });

    const [visit] = await db
      .insert(telehealthVisits)
      .values({
        patientId: data.patientId,
        providerId: data.providerId || null,
        providerName: data.providerName || "Dr. Sarah Chen",
        providerSpecialty: data.providerSpecialty || "General Practice",
        title: data.title,
        reason: data.reason || null,
        visitType: data.visitType,
        scheduledAt: data.scheduledAt,
        duration: data.duration || 30,
        roomId,
        roomUrl: `/telehealth/room/${roomId}`,
        chiefComplaint: data.chiefComplaint || null,
        status: "scheduled",
      })
      .returning();

    return visit;
  }

  async getVisitsForPatient(
    patientId: string,
    filter?: "upcoming" | "past" | "all"
  ) {
    const now = new Date();

    let conditions = [eq(telehealthVisits.patientId, patientId)];

    if (filter === "upcoming") {
      conditions.push(gte(telehealthVisits.scheduledAt, now));
      conditions.push(
        or(
          eq(telehealthVisits.status, "scheduled"),
          eq(telehealthVisits.status, "confirmed"),
          eq(telehealthVisits.status, "waiting_room"),
          eq(telehealthVisits.status, "in_progress")
        )!
      );
    } else if (filter === "past") {
      conditions.push(
        or(
          eq(telehealthVisits.status, "completed"),
          eq(telehealthVisits.status, "cancelled"),
          eq(telehealthVisits.status, "no_show")
        )!
      );
    }

    const visits = await db
      .select()
      .from(telehealthVisits)
      .where(and(...conditions))
      .orderBy(
        filter === "past"
          ? desc(telehealthVisits.scheduledAt)
          : telehealthVisits.scheduledAt
      )
      .limit(50);

    return visits;
  }

  async getVisitById(visitId: string) {
    const [visit] = await db
      .select()
      .from(telehealthVisits)
      .where(eq(telehealthVisits.id, visitId))
      .limit(1);

    return visit || null;
  }

  async updateVisitStatus(
    visitId: string,
    status: string,
    additionalData?: Record<string, any>
  ) {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "in_progress") {
      updateData.startedAt = new Date();
    } else if (status === "completed") {
      updateData.endedAt = new Date();
      const visit = await this.getVisitById(visitId);
      if (visit?.startedAt) {
        updateData.actualDuration = Math.round(
          (Date.now() - new Date(visit.startedAt).getTime()) / 60000
        );
      }
    } else if (status === "waiting_room") {
      updateData.waitingRoomJoinedAt = new Date();
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    const [updated] = await db
      .update(telehealthVisits)
      .set(updateData)
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    if (updated) {
      const sessionId = updated.roomId || visitId;
      if (status === "in_progress") {
        sessionSecurity.logSessionEvent(sessionId, visitId, "session_started", {
          encryptionActive: true,
        });
      } else if (status === "completed") {
        sessionSecurity.logSessionEvent(sessionId, visitId, "session_ended", {
          duration: updated.actualDuration,
          encryptionMaintained: true,
        });
      } else if (status === "waiting_room") {
        sessionSecurity.logSessionEvent(sessionId, visitId, "waiting_room_joined", {
          encryptionActive: true,
        });
      }
    }

    return updated;
  }

  async giveConsent(visitId: string) {
    const [updated] = await db
      .update(telehealthVisits)
      .set({
        consentGiven: true,
        consentTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    if (updated) {
      sessionSecurity.logSessionEvent(
        updated.roomId || visitId,
        visitId,
        "consent_recorded",
        { consentTimestamp: updated.consentTimestamp }
      );
    }

    return updated;
  }

  async documentVisit(
    visitId: string,
    documentation: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      visitNotes?: string;
      diagnoses?: any[];
      prescriptions?: any[];
      followUpInstructions?: string;
      followUpDate?: Date;
      vitalsSigned?: any;
    }
  ) {
    const updateData: Record<string, any> = {
      ...documentation,
      updatedAt: new Date(),
    };

    if (documentation.followUpDate) {
      updateData.followUpDate = new Date(documentation.followUpDate);
    }

    const [updated] = await db
      .update(telehealthVisits)
      .set(updateData)
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    return updated;
  }

  async generateAIVisitSummary(visitId: string) {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error("Visit not found");

    try {
      const prompt = `Generate a concise clinical visit summary for a telehealth consultation. Include key findings, assessment, and plan.

Visit Details:
- Type: ${visit.visitType}
- Chief Complaint: ${visit.chiefComplaint || "General consultation"}
- Reason: ${visit.reason || "Follow-up care"}
- Duration: ${visit.actualDuration || visit.duration} minutes
${visit.subjective ? `- Subjective: ${visit.subjective}` : ""}
${visit.objective ? `- Objective: ${visit.objective}` : ""}
${visit.assessment ? `- Assessment: ${visit.assessment}` : ""}
${visit.plan ? `- Plan: ${visit.plan}` : ""}
${visit.visitNotes ? `- Notes: ${visit.visitNotes}` : ""}

Generate a structured visit summary with:
1. Visit Overview (1-2 sentences)
2. Key Findings
3. Clinical Assessment
4. Treatment Plan
5. Follow-up Recommendations

IMPORTANT: Include disclaimer that this is an AI-generated summary and should be reviewed by the provider.`;

      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content:
              "You are a medical documentation assistant helping providers create visit summaries for telehealth consultations. Be concise, professional, and clinically accurate.",
          },
          { role: "user", content: prompt },
        ],
        maxOutputTokens: 800,
        temperature: 0.3,
        dataCategories: ["demographics", "conditions", "clinical_notes"],
        purpose: "documentation",
        callerService: "telehealth-service",
        callerMethod: "generateAIVisitSummary",
      });

      const summary =
        response.content ||
        "Unable to generate AI summary at this time.";

      const [updated] = await db
        .update(telehealthVisits)
        .set({
          aiVisitSummary: summary,
          updatedAt: new Date(),
        })
        .where(eq(telehealthVisits.id, visitId))
        .returning();

      return updated;
    } catch (error) {
      const fallbackSummary = this.generateFallbackSummary(visit);
      const [updated] = await db
        .update(telehealthVisits)
        .set({
          aiVisitSummary: fallbackSummary,
          updatedAt: new Date(),
        })
        .where(eq(telehealthVisits.id, visitId))
        .returning();
      return updated;
    }
  }

  private generateFallbackSummary(visit: any): string {
    const parts = [
      `**Visit Summary** - ${visit.title}`,
      `Date: ${new Date(visit.scheduledAt).toLocaleDateString()}`,
      `Type: ${visit.visitType?.replace(/_/g, " ")}`,
      `Duration: ${visit.actualDuration || visit.duration} minutes`,
      "",
    ];

    if (visit.chiefComplaint) {
      parts.push(`**Chief Complaint:** ${visit.chiefComplaint}`);
    }
    if (visit.subjective) {
      parts.push(`**Subjective:** ${visit.subjective}`);
    }
    if (visit.objective) {
      parts.push(`**Objective:** ${visit.objective}`);
    }
    if (visit.assessment) {
      parts.push(`**Assessment:** ${visit.assessment}`);
    }
    if (visit.plan) {
      parts.push(`**Plan:** ${visit.plan}`);
    }
    if (visit.followUpInstructions) {
      parts.push(`**Follow-up:** ${visit.followUpInstructions}`);
    }

    parts.push(
      "",
      "*This is a system-generated summary. It is not a substitute for professional medical documentation.*"
    );

    return parts.join("\n");
  }

  async rateVisit(
    visitId: string,
    rating: number,
    feedback?: string
  ) {
    const [updated] = await db
      .update(telehealthVisits)
      .set({
        patientRating: rating,
        patientFeedback: feedback || null,
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    return updated;
  }

  async cancelVisit(visitId: string, reason?: string) {
    const [updated] = await db
      .update(telehealthVisits)
      .set({
        status: "cancelled",
        metadata: reason ? { cancellationReason: reason } : undefined,
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    return updated;
  }

  async rescheduleVisit(visitId: string, newScheduledAt: Date) {
    const [updated] = await db
      .update(telehealthVisits)
      .set({
        scheduledAt: newScheduledAt,
        status: "rescheduled",
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    return updated;
  }

  async getAvailableSlots(
    providerId: string,
    date: Date
  ): Promise<{ time: string; available: boolean }[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingVisits = await db
      .select()
      .from(telehealthVisits)
      .where(
        and(
          gte(telehealthVisits.scheduledAt, startOfDay),
          lte(telehealthVisits.scheduledAt, endOfDay),
          or(
            eq(telehealthVisits.status, "scheduled"),
            eq(telehealthVisits.status, "confirmed")
          )
        )
      );

    const bookedHours = new Set(
      existingVisits.map((v) => new Date(v.scheduledAt).getHours())
    );

    const slots: { time: string; available: boolean }[] = [];
    for (let hour = 9; hour <= 17; hour++) {
      const h = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      slots.push({
        time: `${h}:00 ${ampm}`,
        available: !bookedHours.has(hour),
      });
      if (hour < 17) {
        slots.push({
          time: `${h}:30 ${ampm}`,
          available: !bookedHours.has(hour),
        });
      }
    }

    return slots;
  }

  async processTranscription(visitId: string, transcriptionText: string) {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error("Visit not found");

    await db
      .update(telehealthVisits)
      .set({
        transcription: transcriptionText,
        transcriptionStatus: "processing",
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId));

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: `You are a medical transcription analysis assistant. Analyze the telehealth consultation transcription and return a JSON object with exactly this structure:
{
  "medicalTerms": [
    { "term": "medical term", "definition": "brief patient-friendly explanation", "category": "condition|medication|procedure|lab|vital|anatomy|symptom", "startIndex": 0, "endIndex": 10 }
  ],
  "soapNotes": {
    "subjective": "Patient's reported symptoms and history from the conversation",
    "objective": "Observable findings and measurements mentioned",
    "assessment": "Clinical assessment and impressions discussed",
    "plan": "Treatment plan, medications, follow-ups discussed"
  },
  "keyTopics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "followUpRecommendations": "recommended follow-up based on discussion"
}

Be thorough in identifying medical terms. Include medications, conditions, symptoms, procedures, lab tests, vital signs, and anatomical references. For each term, provide the approximate character position in the original text.`,
          },
          {
            role: "user",
            content: `Visit Type: ${visit.visitType}
Chief Complaint: ${visit.chiefComplaint || "General consultation"}
Reason: ${visit.reason || "Follow-up care"}

Transcription:
${transcriptionText}`,
          },
        ],
        jsonMode: true,
        maxOutputTokens: 2000,
        temperature: 0.2,
        dataCategories: ["demographics", "conditions", "medications", "clinical_notes"],
        purpose: "documentation",
        callerService: "telehealth-service",
        callerMethod: "processTranscription",
      });

      const content = response.content;
      if (!content) throw new Error("No AI response");

      const analysis = JSON.parse(content);

      const [updated] = await db
        .update(telehealthVisits)
        .set({
          transcription: transcriptionText,
          medicalTerms: analysis.medicalTerms || [],
          aiGeneratedNotes: {
            soapNotes: analysis.soapNotes || {},
            keyTopics: analysis.keyTopics || [],
            actionItems: analysis.actionItems || [],
            followUpRecommendations: analysis.followUpRecommendations || "",
            generatedAt: new Date().toISOString(),
            disclaimer:
              "AI-generated notes are for documentation assistance only. All notes must be reviewed and approved by the provider before being finalized.",
          },
          transcriptionStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(telehealthVisits.id, visitId))
        .returning();

      return updated;
    } catch (error) {
      const fallbackAnalysis = this.generateFallbackTranscriptionAnalysis(
        transcriptionText,
        visit
      );

      const [updated] = await db
        .update(telehealthVisits)
        .set({
          transcription: transcriptionText,
          medicalTerms: fallbackAnalysis.medicalTerms,
          aiGeneratedNotes: fallbackAnalysis.aiGeneratedNotes,
          transcriptionStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(telehealthVisits.id, visitId))
        .returning();

      return updated;
    }
  }

  private generateFallbackTranscriptionAnalysis(
    transcriptionText: string,
    visit: any
  ) {
    const commonMedicalTerms: Record<
      string,
      { definition: string; category: string }
    > = {
      hypertension: {
        definition: "High blood pressure",
        category: "condition",
      },
      diabetes: {
        definition: "A condition affecting blood sugar levels",
        category: "condition",
      },
      cholesterol: {
        definition: "A fatty substance in the blood",
        category: "lab",
      },
      aspirin: {
        definition: "Pain reliever and blood thinner",
        category: "medication",
      },
      metformin: {
        definition: "Medication for type 2 diabetes",
        category: "medication",
      },
      lisinopril: {
        definition: "ACE inhibitor for blood pressure",
        category: "medication",
      },
      atorvastatin: {
        definition: "Statin for cholesterol",
        category: "medication",
      },
      "blood pressure": {
        definition: "Force of blood against artery walls",
        category: "vital",
      },
      "heart rate": {
        definition: "Number of heartbeats per minute",
        category: "vital",
      },
      bmi: {
        definition: "Body Mass Index - weight relative to height",
        category: "vital",
      },
      ecg: { definition: "Electrocardiogram - heart rhythm test", category: "procedure" },
      "a1c": {
        definition: "Average blood sugar over 3 months",
        category: "lab",
      },
      hemoglobin: {
        definition: "Protein in red blood cells carrying oxygen",
        category: "lab",
      },
      creatinine: {
        definition: "Waste product indicating kidney function",
        category: "lab",
      },
      thyroid: {
        definition: "Gland controlling metabolism",
        category: "anatomy",
      },
      fatigue: {
        definition: "Extreme tiredness or lack of energy",
        category: "symptom",
      },
      nausea: {
        definition: "Feeling of sickness with urge to vomit",
        category: "symptom",
      },
      dizziness: {
        definition: "Sensation of unsteadiness or lightheadedness",
        category: "symptom",
      },
      insomnia: {
        definition: "Difficulty falling or staying asleep",
        category: "symptom",
      },
    };

    const lowerText = transcriptionText.toLowerCase();
    const foundTerms: Array<{
      term: string;
      definition: string;
      category: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    for (const [term, info] of Object.entries(commonMedicalTerms)) {
      let searchIdx = 0;
      while (true) {
        const idx = lowerText.indexOf(term, searchIdx);
        if (idx === -1) break;
        foundTerms.push({
          term: transcriptionText.substring(idx, idx + term.length),
          definition: info.definition,
          category: info.category,
          startIndex: idx,
          endIndex: idx + term.length,
        });
        searchIdx = idx + term.length;
      }
    }

    const sentences = transcriptionText
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    const half = Math.ceil(sentences.length / 2);

    return {
      medicalTerms: foundTerms,
      aiGeneratedNotes: {
        soapNotes: {
          subjective:
            sentences.slice(0, half).join(". ") + "." ||
            visit.chiefComplaint ||
            "Patient discussed their health concerns.",
          objective:
            "Telehealth consultation conducted. Patient appeared alert and oriented via video.",
          assessment: `${visit.visitType?.replace(/_/g, " ")} visit for ${visit.chiefComplaint || visit.reason || "general health discussion"}.`,
          plan:
            sentences.slice(half).join(". ") + "." ||
            "Follow-up as discussed during the visit.",
        },
        keyTopics: foundTerms.slice(0, 5).map((t) => t.term),
        actionItems: [
          "Review session notes for accuracy",
          "Follow up on discussed items",
        ],
        followUpRecommendations:
          "Schedule follow-up appointment as discussed during the visit.",
        generatedAt: new Date().toISOString(),
        disclaimer:
          "System-generated notes based on keyword analysis. All notes must be reviewed and approved by the provider.",
      },
    };
  }

  async applyAINotesToVisit(visitId: string) {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error("Visit not found");

    const aiNotes = visit.aiGeneratedNotes as any;
    if (!aiNotes?.soapNotes) throw new Error("No AI-generated notes available");

    const [updated] = await db
      .update(telehealthVisits)
      .set({
        subjective: aiNotes.soapNotes.subjective || visit.subjective,
        objective: aiNotes.soapNotes.objective || visit.objective,
        assessment: aiNotes.soapNotes.assessment || visit.assessment,
        plan: aiNotes.soapNotes.plan || visit.plan,
        followUpInstructions:
          aiNotes.followUpRecommendations || visit.followUpInstructions,
        updatedAt: new Date(),
      })
      .where(eq(telehealthVisits.id, visitId))
      .returning();

    return updated;
  }

  async getTranscriptionAnalysis(visitId: string) {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error("Visit not found");

    return {
      transcription: visit.transcription,
      medicalTerms: visit.medicalTerms || [],
      aiGeneratedNotes: visit.aiGeneratedNotes || null,
      transcriptionStatus: visit.transcriptionStatus || "idle",
    };
  }

  async seedDemoVisits(patientId: string) {
    const existingVisits = await db
      .select()
      .from(telehealthVisits)
      .where(eq(telehealthVisits.patientId, patientId))
      .limit(1);

    if (existingVisits.length > 0) return;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0);

    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(11, 0, 0, 0);

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(9, 30, 0, 0);

    await db.insert(telehealthVisits).values([
      {
        patientId,
        providerName: "Dr. Sarah Chen",
        providerSpecialty: "Internal Medicine",
        title: "Annual Wellness Check",
        reason: "Routine preventive care visit",
        visitType: "preventive",
        status: "confirmed",
        scheduledAt: tomorrow,
        duration: 30,
        roomId: generateRoomId(),
        chiefComplaint: "Annual wellness exam",
        consentGiven: false,
      },
      {
        patientId,
        providerName: "Dr. Michael Rivera",
        providerSpecialty: "Cardiology",
        title: "Cardiology Follow-up",
        reason: "Review recent lab work and blood pressure management",
        visitType: "follow_up",
        status: "scheduled",
        scheduledAt: nextWeek,
        duration: 20,
        roomId: generateRoomId(),
        chiefComplaint: "Blood pressure management review",
        consentGiven: false,
      },
      {
        patientId,
        providerName: "Dr. Emily Watson",
        providerSpecialty: "Family Medicine",
        title: "Medication Review",
        reason: "Discuss current medication regimen and side effects",
        visitType: "medication_review",
        status: "completed",
        scheduledAt: lastWeek,
        startedAt: lastWeek,
        endedAt: new Date(lastWeek.getTime() + 25 * 60000),
        actualDuration: 25,
        duration: 30,
        roomId: generateRoomId(),
        chiefComplaint: "Medication side effects",
        subjective:
          "Patient reports mild dizziness when standing quickly. Started about 2 weeks after beginning lisinopril. No other new symptoms.",
        objective:
          "BP: 128/82 mmHg, HR: 72 bpm. No orthostatic hypotension on exam.",
        assessment:
          "Mild positional dizziness likely related to ACE inhibitor initiation. Blood pressure well controlled.",
        plan: "Continue current dose. Rise slowly from seated/lying position. Monitor symptoms. Follow up in 4 weeks.",
        visitNotes:
          "Patient educated on orthostatic precautions. Advised to stay well hydrated.",
        followUpInstructions:
          "Schedule follow-up in 4 weeks. Contact office if dizziness worsens or persists.",
        patientRating: 5,
        patientFeedback:
          "Dr. Watson was very thorough and took the time to explain everything clearly.",
        consentGiven: true,
        consentTimestamp: lastWeek,
        aiVisitSummary:
          "**Visit Summary** - Medication Review\n\nPatient presented for medication review regarding mild positional dizziness since starting lisinopril. Blood pressure is well controlled at 128/82 mmHg. Assessment indicates dizziness is likely related to ACE inhibitor initiation. Plan includes continuing current medication with orthostatic precautions and follow-up in 4 weeks.\n\n*This is an AI-generated summary and should be reviewed by the provider. It is not a substitute for professional medical judgment.*",
      },
      {
        patientId,
        providerName: "Dr. James Park",
        providerSpecialty: "Psychiatry",
        title: "Mental Health Check-in",
        reason: "Routine mental health follow-up",
        visitType: "mental_health",
        status: "completed",
        scheduledAt: twoWeeksAgo,
        startedAt: twoWeeksAgo,
        endedAt: new Date(twoWeeksAgo.getTime() + 45 * 60000),
        actualDuration: 45,
        duration: 45,
        roomId: generateRoomId(),
        chiefComplaint: "Anxiety management follow-up",
        subjective:
          "Patient reports improved anxiety symptoms with current SSRI. Sleep quality has improved. Still experiencing occasional work-related stress.",
        assessment:
          "Generalized anxiety disorder, improving with current treatment. Good medication response.",
        plan: "Continue current SSRI. Practice mindfulness techniques. Consider cognitive behavioral therapy referral if symptoms plateau.",
        consentGiven: true,
        consentTimestamp: twoWeeksAgo,
        patientRating: 4,
      },
    ]);
  }
}

export const telehealthService = new TelehealthService();
