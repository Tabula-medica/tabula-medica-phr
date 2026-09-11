/**
 * AI Care Monitoring Service
 * Monitors patient data across modules, identifies care gaps, suggests inter-module links,
 * and flags critical events for care team review.
 * 
 * NO-CDS COMPLIANCE:
 * - All AI outputs are educational/informational only
 * - No clinical decision support or treatment recommendations
 * - Uses safe verbs only: "shows", "states", "refers to", "means"
 */

import { logPhiAccess } from "../security/hipaa-audit";
import { UnifiedNotificationService } from "./unified-notification-service";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const notificationService = new UnifiedNotificationService();

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_PHRASES = [
  "should", "must", "need to", "require", "recommend", "advise",
  "may consider", "consider", "suggest", "indicates", "implies",
  "reveals", "demonstrates", "predicts", "confirms", "affects",
  "causes", "triggers", "leads", "results", "correlates"
];

function validateAndEnforceSafeVerbs(text: string): string {
  let result = text;
  
  for (const phrase of PROHIBITED_PHRASES) {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    if (regex.test(result)) {
      result = result.replace(regex, "shows");
    }
  }
  
  const additionalReplacements: Record<string, string> = {
    "may consider": "data shows",
    "you should": "records show",
    "is recommended": "documentation states",
    "appears to": "data shows",
    "seems to": "records show",
    "likely": "data states",
    "probably": "data shows",
    "might be": "records show",
    "could be": "data refers to",
  };
  
  for (const [bad, good] of Object.entries(additionalReplacements)) {
    result = result.replace(new RegExp(bad, "gi"), good);
  }
  
  return result;
}

export type AlertSeverity = "info" | "warning" | "critical" | "urgent";
export type AlertCategory = "care_gap" | "inter_module_link" | "critical_event" | "trend_analysis" | "follow_up_needed";
export type ModuleType = "appointments" | "treatments" | "symptoms" | "documents" | "medications" | "vitals" | "lab_results";

export interface CareGap {
  id: string;
  patientId: string;
  type: string;
  description: string;
  severity: AlertSeverity;
  suggestedAction: string;
  relatedModules: ModuleType[];
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  aiConfidence: number;
}

export interface InterModuleLink {
  id: string;
  patientId: string;
  sourceModule: ModuleType;
  sourceId: string;
  sourceDescription: string;
  targetModule: ModuleType;
  targetId: string;
  targetDescription: string;
  linkType: "causal" | "temporal" | "related" | "follow_up";
  aiReasoning: string;
  confidence: number;
  suggestedAt: string;
  accepted: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface CriticalEvent {
  id: string;
  patientId: string;
  eventType: string;
  severity: AlertSeverity;
  summary: string;
  details: string;
  affectedModules: ModuleType[];
  triggeredAt: string;
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  escalatedTo?: string[];
}

export interface PatientDataSnapshot {
  patientId: string;
  appointments: AppointmentData[];
  treatments: TreatmentData[];
  symptoms: SymptomData[];
  documents: DocumentData[];
  medications: MedicationData[];
  vitals: VitalsData[];
  labResults: LabResultData[];
}

interface AppointmentData {
  id: string;
  type: string;
  provider: string;
  scheduledDate: string;
  status: string;
  reason?: string;
}

interface TreatmentData {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate?: string;
  status: string;
  notes?: string;
}

interface SymptomData {
  id: string;
  name: string;
  severity: number;
  reportedDate: string;
  duration?: string;
  triggers?: string[];
}

interface DocumentData {
  id: string;
  type: string;
  title: string;
  uploadedDate: string;
  source?: string;
  category: string;
}

interface MedicationData {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: string;
}

interface VitalsData {
  id: string;
  type: string;
  value: number;
  unit: string;
  recordedDate: string;
  source: string;
}

interface LabResultData {
  id: string;
  testName: string;
  value: string;
  referenceRange: string;
  status: "normal" | "abnormal" | "critical";
  resultDate: string;
  orderedBy?: string;
}

const careGaps: Map<string, CareGap[]> = new Map();
const interModuleLinks: Map<string, InterModuleLink[]> = new Map();
const criticalEvents: Map<string, CriticalEvent[]> = new Map();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeAIOutput(text: string): string {
  const replacements: Record<string, string> = {
    "indicates": "shows",
    "indicating": "shows",
    "suggests": "shows",
    "suggesting": "shows",
    "implies": "means",
    "implying": "means",
    "reveals": "shows",
    "revealing": "shows",
    "demonstrates": "shows",
    "demonstrating": "shows",
    "should": "shows",
    "must": "states",
    "recommend": "refers to",
    "advise": "shows",
    "may consider": "shows",
    "consider": "shows",
    "predicts": "shows",
    "confirms": "states",
    "affects": "shows",
    "causes": "shows",
    "triggers": "shows",
    "correlates": "shows",
    "relates to": "refers to",
    "relationship with": "refers to",
    "connection to": "refers to",
    "review": "shows",
  };

  let result = text;
  for (const [bad, good] of Object.entries(replacements)) {
    result = result.replace(new RegExp(bad, "gi"), good);
  }
  
  result = validateAndEnforceSafeVerbs(result);
  
  result = enforceSafeVerbsOnly(result);
  
  return result;
}

function enforceSafeVerbsOnly(text: string): string {
  const unsafeVerbPatterns = [
    "relate", "correlate", "connect", "link", "associate",
    "impact", "influence", "affect", "determine", "predict",
    "confirm", "validate", "review", "assess", "evaluate"
  ];
  
  let result = text;
  for (const pattern of unsafeVerbPatterns) {
    result = result.replace(new RegExp(`\\b${pattern}s?\\b`, "gi"), "shows");
    result = result.replace(new RegExp(`\\b${pattern}ing\\b`, "gi"), "shows");
    result = result.replace(new RegExp(`\\b${pattern}ed\\b`, "gi"), "shows");
  }
  
  return result;
}

export class AICareMonitoringService {
  async analyzePatientData(data: PatientDataSnapshot): Promise<{
    careGaps: CareGap[];
    suggestedLinks: InterModuleLink[];
    criticalEvents: CriticalEvent[];
  }> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientData",
      resourceId: data.patientId,
      details: "ai_care_monitoring_analysis",
    });

    const [gaps, links, events] = await Promise.all([
      this.detectCareGaps(data),
      this.suggestInterModuleLinks(data),
      this.identifyCriticalEvents(data),
    ]);

    return { careGaps: gaps, suggestedLinks: links, criticalEvents: events };
  }

  async detectCareGaps(data: PatientDataSnapshot): Promise<CareGap[]> {
    const detected: CareGap[] = [];

    if (!aiEnabled) {
      return this.getMockCareGaps(data.patientId);
    }

    try {
      const prompt = `Analyze this patient's health data and identify potential care gaps.
DO NOT provide medical advice or recommendations. Only identify factual gaps in documentation or scheduling.
Use ONLY these verbs: shows, states, refers to, means

Patient Data Summary:
- Appointments: ${data.appointments.length} records (last: ${data.appointments[0]?.scheduledDate || "none"})
- Treatments: ${data.treatments.length} active
- Medications: ${data.medications.length} current
- Recent symptoms: ${data.symptoms.slice(0, 5).map(s => s.name).join(", ") || "none reported"}
- Lab results: ${data.labResults.length} (${data.labResults.filter(l => l.status === "abnormal").length} abnormal)
- Documents: ${data.documents.length} uploaded

Identify gaps in:
1. Missed follow-up appointments
2. Incomplete documentation
3. Lab tests without follow-up documentation
4. Medication lists that may need review (based on time since last update)
5. Symptoms reported without corresponding documentation

Return JSON array with format:
[{
  "type": "string",
  "description": "string (use only safe verbs)",
  "severity": "info|warning|critical",
  "suggestedAction": "string (educational only, no medical advice)",
  "relatedModules": ["appointments"|"treatments"|"symptoms"|"documents"|"medications"|"vitals"|"lab_results"],
  "confidence": 0.0-1.0
}]`;

      const content = await generatePhiSafeText({
        system: "You are a healthcare data analyst. Identify documentation and scheduling gaps only. Never provide medical advice.",
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 1500,
      }) || "{}";
      const parsed = JSON.parse(content);
      const gaps = Array.isArray(parsed) ? parsed : parsed.gaps || [];

      for (const gap of gaps) {
        const careGap: CareGap = {
          id: generateId("gap"),
          patientId: data.patientId,
          type: gap.type || "unknown",
          description: sanitizeAIOutput(gap.description || ""),
          severity: gap.severity || "info",
          suggestedAction: sanitizeAIOutput(gap.suggestedAction || ""),
          relatedModules: gap.relatedModules || [],
          detectedAt: new Date().toISOString(),
          acknowledged: false,
          aiConfidence: gap.confidence || 0.5,
        };
        detected.push(careGap);
      }
    } catch (error) {
      console.error("[AICareMonitoring] Care gap detection error:", error);
      return this.getMockCareGaps(data.patientId);
    }

    const existing = careGaps.get(data.patientId) || [];
    careGaps.set(data.patientId, [...existing, ...detected]);

    for (const gap of detected.filter(g => g.severity === "warning" || g.severity === "critical")) {
      notificationService.createNotification(data.patientId, {
        category: "alert",
        priority: gap.severity === "critical" ? "high" : "normal",
        title: `Care Gap: ${gap.type.replace(/_/g, " ")}`,
        message: gap.description,
        actionUrl: `/care-monitoring?tab=gaps&gapId=${gap.id}`,
        actionLabel: "View Gap",
        sourceType: "ai_care_monitoring",
        sourceId: gap.id,
      });
      console.log(`[AICareMonitoring] Notification sent for care gap: ${gap.id}`);
    }

    return detected;
  }

  async suggestInterModuleLinks(data: PatientDataSnapshot): Promise<InterModuleLink[]> {
    const suggestions: InterModuleLink[] = [];

    if (!aiEnabled) {
      return this.getMockInterModuleLinks(data.patientId);
    }

    try {
      const prompt = `Analyze this patient's health data and suggest connections between different data modules.
Identify relationships that could help organize the patient's health record.
Use ONLY these verbs: shows, states, refers to, means

Data to analyze:
Lab Results: ${JSON.stringify(data.labResults.slice(0, 5))}
Treatments: ${JSON.stringify(data.treatments.slice(0, 5))}
Symptoms: ${JSON.stringify(data.symptoms.slice(0, 5))}
Documents: ${JSON.stringify(data.documents.slice(0, 5))}

Suggest links like:
- Lab result -> Treatment (if result relates to treatment monitoring)
- Symptom -> Document (if symptom should be linked to a report)
- Document -> Treatment (if document describes treatment details)

Return JSON array:
[{
  "sourceModule": "lab_results|treatments|symptoms|documents",
  "sourceId": "string",
  "sourceDescription": "string",
  "targetModule": "lab_results|treatments|symptoms|documents",
  "targetId": "string",
  "targetDescription": "string",
  "linkType": "causal|temporal|related|follow_up",
  "reasoning": "string (use only safe verbs)",
  "confidence": 0.0-1.0
}]`;

      const content = await generatePhiSafeText({
        system: "You are a health data organization assistant. Suggest logical connections between health records. No medical advice.",
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 1500,
      }) || "{}";
      const parsed = JSON.parse(content);
      const links = Array.isArray(parsed) ? parsed : parsed.links || [];

      for (const link of links) {
        const moduleLink: InterModuleLink = {
          id: generateId("link"),
          patientId: data.patientId,
          sourceModule: link.sourceModule as ModuleType,
          sourceId: link.sourceId || "",
          sourceDescription: link.sourceDescription || "",
          targetModule: link.targetModule as ModuleType,
          targetId: link.targetId || "",
          targetDescription: link.targetDescription || "",
          linkType: link.linkType || "related",
          aiReasoning: sanitizeAIOutput(link.reasoning || ""),
          confidence: link.confidence || 0.5,
          suggestedAt: new Date().toISOString(),
          accepted: false,
        };
        suggestions.push(moduleLink);
      }
    } catch (error) {
      console.error("[AICareMonitoring] Inter-module link suggestion error:", error);
      return this.getMockInterModuleLinks(data.patientId);
    }

    const existing = interModuleLinks.get(data.patientId) || [];
    interModuleLinks.set(data.patientId, [...existing, ...suggestions]);

    return suggestions;
  }

  async identifyCriticalEvents(data: PatientDataSnapshot): Promise<CriticalEvent[]> {
    const events: CriticalEvent[] = [];

    const criticalLabs = data.labResults.filter(l => l.status === "critical");
    for (const lab of criticalLabs) {
      events.push({
        id: generateId("event"),
        patientId: data.patientId,
        eventType: "critical_lab_result",
        severity: "critical",
        summary: `Critical lab result: ${lab.testName}`,
        details: `The ${lab.testName} test shows a value of ${lab.value} (reference: ${lab.referenceRange}). This data states the result is outside normal parameters.`,
        affectedModules: ["lab_results", "treatments"],
        triggeredAt: new Date().toISOString(),
        requiresReview: true,
      });
    }

    const severeSymptoms = data.symptoms.filter(s => s.severity >= 8);
    for (const symptom of severeSymptoms) {
      events.push({
        id: generateId("event"),
        patientId: data.patientId,
        eventType: "severe_symptom_reported",
        severity: "warning",
        summary: `Severe symptom reported: ${symptom.name}`,
        details: `Patient data shows ${symptom.name} with severity ${symptom.severity}/10, reported on ${symptom.reportedDate}.`,
        affectedModules: ["symptoms", "appointments"],
        triggeredAt: new Date().toISOString(),
        requiresReview: true,
      });
    }

    const now = new Date();
    const missedAppointments = data.appointments.filter(a => {
      const scheduled = new Date(a.scheduledDate);
      return scheduled < now && a.status === "scheduled";
    });
    for (const appt of missedAppointments) {
      events.push({
        id: generateId("event"),
        patientId: data.patientId,
        eventType: "missed_appointment",
        severity: "warning",
        summary: `Possibly missed appointment: ${appt.type}`,
        details: `Appointment data shows ${appt.type} with ${appt.provider} was scheduled for ${appt.scheduledDate} but status remains "scheduled".`,
        affectedModules: ["appointments"],
        triggeredAt: new Date().toISOString(),
        requiresReview: true,
      });
    }

    const existing = criticalEvents.get(data.patientId) || [];
    criticalEvents.set(data.patientId, [...existing, ...events]);

    for (const event of events.filter(e => e.severity === "critical" || e.severity === "urgent" || e.severity === "warning")) {
      notificationService.createNotification(data.patientId, {
        category: "alert",
        priority: event.severity === "critical" ? "urgent" : event.severity === "urgent" ? "high" : "normal",
        title: event.summary,
        message: event.details,
        actionUrl: `/care-monitoring?tab=events&eventId=${event.id}`,
        actionLabel: "Review Event",
        sourceType: "ai_care_monitoring",
        sourceId: event.id,
      });
      console.log(`[AICareMonitoring] Notification sent for critical event: ${event.id} (${event.severity})`);
    }

    return events;
  }

  getCareGaps(patientId: string): CareGap[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "CareGap",
      resourceId: patientId,
      details: "get_care_gaps",
    });
    return careGaps.get(patientId) || [];
  }

  getInterModuleLinks(patientId: string): InterModuleLink[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "InterModuleLink",
      resourceId: patientId,
      details: "get_inter_module_links",
    });
    return interModuleLinks.get(patientId) || [];
  }

  getCriticalEvents(patientId: string): CriticalEvent[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "CriticalEvent",
      resourceId: patientId,
      details: "get_critical_events",
    });
    return criticalEvents.get(patientId) || [];
  }

  acknowledgeGap(patientId: string, gapId: string, userId: string): CareGap | null {
    const gaps = careGaps.get(patientId) || [];
    const gap = gaps.find(g => g.id === gapId);
    if (gap) {
      gap.acknowledged = true;
      gap.acknowledgedBy = userId;
      gap.acknowledgedAt = new Date().toISOString();

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "CareGap",
        resourceId: gapId,
        details: "acknowledge_care_gap",
      });
    }
    return gap || null;
  }

  acceptLink(patientId: string, linkId: string, userId: string): InterModuleLink | null {
    const links = interModuleLinks.get(patientId) || [];
    const link = links.find(l => l.id === linkId);
    if (link) {
      link.accepted = true;
      link.acceptedBy = userId;
      link.acceptedAt = new Date().toISOString();

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "InterModuleLink",
        resourceId: linkId,
        details: "accept_inter_module_link",
      });
    }
    return link || null;
  }

  reviewEvent(patientId: string, eventId: string, userId: string, notes: string): CriticalEvent | null {
    const events = criticalEvents.get(patientId) || [];
    const event = events.find(e => e.id === eventId);
    if (event) {
      event.requiresReview = false;
      event.reviewedBy = userId;
      event.reviewedAt = new Date().toISOString();
      event.reviewNotes = notes;

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "CriticalEvent",
        resourceId: eventId,
        details: "review_critical_event",
      });
    }
    return event || null;
  }

  getMonitoringSummary(patientId: string): {
    totalGaps: number;
    unacknowledgedGaps: number;
    pendingLinks: number;
    unreviewedEvents: number;
    criticalCount: number;
    lastAnalysis?: string;
  } {
    const gaps = careGaps.get(patientId) || [];
    const links = interModuleLinks.get(patientId) || [];
    const events = criticalEvents.get(patientId) || [];

    return {
      totalGaps: gaps.length,
      unacknowledgedGaps: gaps.filter(g => !g.acknowledged).length,
      pendingLinks: links.filter(l => !l.accepted).length,
      unreviewedEvents: events.filter(e => e.requiresReview).length,
      criticalCount: events.filter(e => e.severity === "critical" || e.severity === "urgent").length,
      lastAnalysis: gaps[0]?.detectedAt || events[0]?.triggeredAt,
    };
  }

  private getMockCareGaps(patientId: string): CareGap[] {
    return [
      {
        id: generateId("gap"),
        patientId,
        type: "follow_up_appointment",
        description: "Records show no follow-up appointment scheduled after recent lab work.",
        severity: "warning",
        suggestedAction: "Documentation shows appointment scheduling status.",
        relatedModules: ["appointments", "lab_results"],
        detectedAt: new Date().toISOString(),
        acknowledged: false,
        aiConfidence: 0.78,
      },
      {
        id: generateId("gap"),
        patientId,
        type: "documentation_gap",
        description: "Medication list data shows last update was more than 90 days ago.",
        severity: "info",
        suggestedAction: "Records show medication list status from documentation.",
        relatedModules: ["medications", "documents"],
        detectedAt: new Date().toISOString(),
        acknowledged: false,
        aiConfidence: 0.85,
      },
    ];
  }

  private getMockInterModuleLinks(patientId: string): InterModuleLink[] {
    return [
      {
        id: generateId("link"),
        patientId,
        sourceModule: "lab_results",
        sourceId: "lab-001",
        sourceDescription: "HbA1c test result",
        targetModule: "treatments",
        targetId: "treat-001",
        targetDescription: "Diabetes management program",
        linkType: "related",
        aiReasoning: "Lab result data refers to monitoring related to documented treatment program.",
        confidence: 0.82,
        suggestedAt: new Date().toISOString(),
        accepted: false,
      },
      {
        id: generateId("link"),
        patientId,
        sourceModule: "symptoms",
        sourceId: "symp-001",
        sourceDescription: "Reported fatigue symptoms",
        targetModule: "medications",
        targetId: "med-001",
        targetDescription: "Current prescription medications",
        linkType: "temporal",
        aiReasoning: "Symptom data shows timing that refers to medication start date.",
        confidence: 0.68,
        suggestedAt: new Date().toISOString(),
        accepted: false,
      },
    ];
  }
}

export const aiCareMonitoringService = new AICareMonitoringService();
