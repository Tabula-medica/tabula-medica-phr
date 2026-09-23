import { generatePhiSafeText } from "./ai-gateway";
import crypto from "crypto";

const aiEnabled = true;

const NO_CDS_DISCLAIMER = "IMPORTANT: This summary is for informational and documentation purposes only. It does NOT constitute clinical decision support or medical advice. All information requires verification by qualified healthcare professionals before use in clinical decisions.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][PatientProfileSummary] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

export interface MedicalHistoryItem {
  condition: string;
  diagnosedDate?: string;
  status: "active" | "resolved" | "managed";
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
}

export interface CurrentCondition {
  name: string;
  status: "active" | "controlled" | "uncontrolled";
  lastAssessmentDate?: string;
  treatingProvider?: string;
}

export interface ActiveMedication {
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy?: string;
  startDate?: string;
  purpose?: string;
}

export interface UpcomingAppointment {
  date: string;
  time?: string;
  provider: string;
  type: string;
  location?: string;
  notes?: string;
}

export interface CareTeamNote {
  date: string;
  author: string;
  role: string;
  noteType: "progress" | "follow-up" | "consultation" | "care-plan" | "general";
  summary: string;
}

export interface HealthTimelineEvent {
  date: string;
  eventType: "diagnosis" | "procedure" | "hospitalization" | "visit" | "lab" | "imaging" | "medication_change" | "milestone";
  title: string;
  description: string;
  provider?: string;
  significance: "routine" | "notable" | "critical";
}

export interface CareGap {
  id: string;
  category: "preventive" | "chronic_management" | "screening" | "immunization" | "follow_up";
  description: string;
  guidelineReference?: string;
  lastCompleted?: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
  status: "overdue" | "due_soon" | "pending";
}

export interface LabResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  date: string;
  status: "normal" | "abnormal_high" | "abnormal_low" | "critical";
  trend?: "improving" | "worsening" | "stable";
}

export interface ImagingFinding {
  studyType: string;
  date: string;
  bodyRegion: string;
  findings: string;
  impression: string;
  radiologist?: string;
  status: "normal" | "abnormal" | "requires_follow_up";
}

export interface SocialDeterminant {
  category: "housing" | "food_security" | "transportation" | "employment" | "education" | "social_support" | "safety" | "health_literacy" | "financial_strain";
  status: "identified" | "addressed" | "monitoring" | "not_assessed";
  description: string;
  impact?: string;
  resources?: string[];
  lastAssessed?: string;
}

export interface PatientProfileData {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  age?: number;
  gender?: string;
  primaryCareProvider?: string;
  medicalHistory: MedicalHistoryItem[];
  currentConditions: CurrentCondition[];
  activeMedications: ActiveMedication[];
  allergies?: string[];
  upcomingAppointments: UpcomingAppointment[];
  recentCareTeamNotes: CareTeamNote[];
  recentVitals?: {
    bloodPressure?: string;
    heartRate?: string;
    weight?: string;
    temperature?: string;
    lastUpdated?: string;
  };
  immunizationStatus?: string;
  lastLabDate?: string;
  healthTimeline?: HealthTimelineEvent[];
  careGaps?: CareGap[];
  recentLabResults?: LabResult[];
  recentImagingFindings?: ImagingFinding[];
  socialDeterminants?: SocialDeterminant[];
}

export interface OnePageHealthSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  expiresAt: string;
  sections: {
    patientOverview: {
      name: string;
      age: string;
      primaryCareProvider: string;
      lastUpdated: string;
    };
    medicalHistoryHighlights: {
      summary: string;
      keyConditions: string[];
      significantEvents: string[];
    };
    currentHealthStatus: {
      summary: string;
      activeConditions: Array<{
        condition: string;
        status: string;
        keyInfo: string;
      }>;
      recentVitals: string;
    };
    medicationSummary: {
      summary: string;
      medicationCount: number;
      keyMedications: Array<{
        name: string;
        purpose: string;
        dosage: string;
      }>;
      allergies: string[];
    };
    upcomingCare: {
      summary: string;
      nextAppointment: string | null;
      appointments: Array<{
        date: string;
        type: string;
        provider: string;
      }>;
    };
    careTeamUpdates: {
      summary: string;
      recentNotes: Array<{
        date: string;
        author: string;
        highlight: string;
      }>;
      actionItems: string[];
    };
  };
  aiInsights: {
    healthTrends: string[];
    attentionAreas: string[];
    positiveProgress: string[];
  };
  healthTimeline: {
    summary: string;
    events: Array<{
      date: string;
      eventType: string;
      title: string;
      description: string;
      significance: string;
    }>;
    keyMilestones: string[];
  };
  careGapsAnalysis: {
    summary: string;
    totalGaps: number;
    highPriorityCount: number;
    gaps: Array<{
      category: string;
      description: string;
      priority: string;
      status: string;
      dueDate?: string;
    }>;
  };
  labAndImagingSummary: {
    summary: string;
    recentLabHighlights: Array<{
      testName: string;
      value: string;
      status: string;
      date: string;
      trend?: string;
    }>;
    recentImagingHighlights: Array<{
      studyType: string;
      date: string;
      impression: string;
      status: string;
    }>;
    criticalFindings: string[];
  };
  socialDeterminantsOfHealth: {
    summary: string;
    identifiedFactors: Array<{
      category: string;
      description: string;
      status: string;
      impact?: string;
    }>;
    resourcesConnected: string[];
    unaddressedNeeds: string[];
  };
  quickReferenceBox: {
    emergencyInfo: string;
    keyAllergies: string;
    criticalMedications: string;
  };
  disclaimer: string;
  metadata: {
    dataSourcesUsed: string[];
    confidenceLevel: "high" | "medium" | "low";
    lastDataUpdate: string;
    summaryVersion: string;
  };
}

export interface SummaryGenerationRequest {
  patientId: string;
  profileData: PatientProfileData;
  requesterId: string;
  requesterRole: string;
  includeAiInsights: boolean;
  summaryFormat: "standard" | "detailed" | "condensed";
}

const summaryCache: Map<string, OnePageHealthSummary> = new Map();

type EnhancedSummaryResult = Partial<OnePageHealthSummary["sections"]> & { 
  aiInsights: OnePageHealthSummary["aiInsights"];
  healthTimeline: OnePageHealthSummary["healthTimeline"];
  careGapsAnalysis: OnePageHealthSummary["careGapsAnalysis"];
  labAndImagingSummary: OnePageHealthSummary["labAndImagingSummary"];
  socialDeterminantsOfHealth: OnePageHealthSummary["socialDeterminantsOfHealth"];
};

async function generateAIHealthSummary(
  profileData: PatientProfileData,
  format: string
): Promise<EnhancedSummaryResult> {
  if (!aiEnabled) {
    return generateFallbackSummary(profileData);
  }

  try {
    const timelineData = profileData.healthTimeline || [];
    const careGapsData = profileData.careGaps || [];
    const labResultsData = profileData.recentLabResults || [];
    const imagingData = profileData.recentImagingFindings || [];
    const sdohData = profileData.socialDeterminants || [];

    const prompt = `You are a medical documentation assistant. Generate a comprehensive one-page health summary for quick clinical review.

Patient Data:
- Name: ${profileData.patientName}
- DOB: ${profileData.dateOfBirth}
- Age: ${profileData.age || "Unknown"}
- Gender: ${profileData.gender || "Not specified"}
- Primary Care Provider: ${profileData.primaryCareProvider || "Not assigned"}

Medical History (${profileData.medicalHistory.length} items):
${profileData.medicalHistory.map(h => `- ${h.condition} (${h.status}${h.severity ? `, ${h.severity}` : ""}${h.diagnosedDate ? `, diagnosed ${h.diagnosedDate}` : ""})`).join("\n")}

Current Conditions (${profileData.currentConditions.length}):
${profileData.currentConditions.map(c => `- ${c.name}: ${c.status}`).join("\n")}

Active Medications (${profileData.activeMedications.length}):
${profileData.activeMedications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.purpose ? ` - for ${m.purpose}` : ""}`).join("\n")}

Allergies: ${profileData.allergies?.join(", ") || "None documented"}

Upcoming Appointments (${profileData.upcomingAppointments.length}):
${profileData.upcomingAppointments.map(a => `- ${a.date}: ${a.type} with ${a.provider}`).join("\n")}

Recent Care Team Notes (${profileData.recentCareTeamNotes.length}):
${profileData.recentCareTeamNotes.map(n => `- ${n.date} (${n.author}, ${n.role}): ${n.summary}`).join("\n")}

Recent Vitals:
${profileData.recentVitals ? `BP: ${profileData.recentVitals.bloodPressure || "N/A"}, HR: ${profileData.recentVitals.heartRate || "N/A"}, Weight: ${profileData.recentVitals.weight || "N/A"}` : "No recent vitals"}

Health Timeline Events (${timelineData.length} events):
${timelineData.map(e => `- ${e.date}: ${e.title} (${e.eventType}, ${e.significance})`).join("\n") || "No timeline events documented"}

Care Gaps (${careGapsData.length} identified):
${careGapsData.map(g => `- ${g.description} (${g.category}, ${g.priority} priority, ${g.status})`).join("\n") || "No care gaps identified"}

Recent Lab Results (${labResultsData.length} tests):
${labResultsData.map(l => `- ${l.testName}: ${l.value} ${l.unit} (${l.status}, ref: ${l.referenceRange})`).join("\n") || "No recent labs"}

Recent Imaging (${imagingData.length} studies):
${imagingData.map(i => `- ${i.date}: ${i.studyType} - ${i.impression}`).join("\n") || "No recent imaging"}

Social Determinants of Health (${sdohData.length} factors):
${sdohData.map(s => `- ${s.category}: ${s.description} (${s.status})`).join("\n") || "No SDOH factors documented"}

Generate a JSON response with the following structure for a ${format} format summary:
{
  "medicalHistoryHighlights": {
    "summary": "2-3 sentence overview of key medical history",
    "keyConditions": ["list of 3-5 most significant conditions"],
    "significantEvents": ["list of notable medical events/surgeries"]
  },
  "currentHealthStatus": {
    "summary": "2-3 sentence current health overview",
    "recentVitals": "Brief summary of recent vital signs"
  },
  "medicationSummary": {
    "summary": "1-2 sentence medication overview"
  },
  "upcomingCare": {
    "summary": "Brief overview of upcoming care needs"
  },
  "careTeamUpdates": {
    "summary": "Brief overview of recent care team activity",
    "actionItems": ["list of 2-4 key action items or follow-ups"]
  },
  "aiInsights": {
    "healthTrends": ["2-3 observed health trends"],
    "attentionAreas": ["2-3 areas that may need attention"],
    "positiveProgress": ["1-2 areas of positive progress"]
  },
  "healthTimeline": {
    "summary": "1-2 sentence overview of patient's health journey",
    "keyMilestones": ["list of 3-5 key health milestones"]
  },
  "careGapsAnalysis": {
    "summary": "1-2 sentence overview of care gap status"
  },
  "labAndImagingSummary": {
    "summary": "1-2 sentence overview of recent diagnostic findings",
    "criticalFindings": ["list of any critical or urgent findings"]
  },
  "socialDeterminantsOfHealth": {
    "summary": "1-2 sentence overview of relevant SDOH factors",
    "unaddressedNeeds": ["list of unaddressed social needs if any"]
  }
}

Important: This is for documentation purposes only, not clinical decision support. Focus on summarizing existing data clearly. Do not make clinical recommendations.`;

    const content = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!content) {
      return generateFallbackSummary(profileData);
    }

    const parsed = JSON.parse(content);
    
    const timelineEvents = (profileData.healthTimeline || []).map(e => ({
      date: e.date,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      significance: e.significance,
    }));
    
    const careGaps = (profileData.careGaps || []).map(g => ({
      category: g.category,
      description: g.description,
      priority: g.priority,
      status: g.status,
      dueDate: g.dueDate,
    }));
    
    const labHighlights = (profileData.recentLabResults || []).slice(0, 5).map(l => ({
      testName: l.testName,
      value: `${l.value} ${l.unit}`,
      status: l.status,
      date: l.date,
      trend: l.trend,
    }));
    
    const imagingHighlights = (profileData.recentImagingFindings || []).slice(0, 3).map(i => ({
      studyType: i.studyType,
      date: i.date,
      impression: i.impression,
      status: i.status,
    }));
    
    const sdohFactors = (profileData.socialDeterminants || []).map(s => ({
      category: s.category,
      description: s.description,
      status: s.status,
      impact: s.impact,
    }));
    
    return {
      medicalHistoryHighlights: {
        summary: parsed.medicalHistoryHighlights?.summary || "Medical history review pending.",
        keyConditions: parsed.medicalHistoryHighlights?.keyConditions || [],
        significantEvents: parsed.medicalHistoryHighlights?.significantEvents || [],
      },
      currentHealthStatus: {
        summary: parsed.currentHealthStatus?.summary || "Current status assessment pending.",
        activeConditions: profileData.currentConditions.map(c => ({
          condition: c.name,
          status: c.status,
          keyInfo: c.treatingProvider ? `Managed by ${c.treatingProvider}` : "Under management",
        })),
        recentVitals: parsed.currentHealthStatus?.recentVitals || "Vitals review pending.",
      },
      medicationSummary: {
        summary: parsed.medicationSummary?.summary || `${profileData.activeMedications.length} active medications.`,
        medicationCount: profileData.activeMedications.length,
        keyMedications: profileData.activeMedications.slice(0, 5).map(m => ({
          name: m.name,
          purpose: m.purpose || "Prescribed medication",
          dosage: `${m.dosage} ${m.frequency}`,
        })),
        allergies: profileData.allergies || [],
      },
      upcomingCare: {
        summary: parsed.upcomingCare?.summary || `${profileData.upcomingAppointments.length} upcoming appointments scheduled.`,
        nextAppointment: profileData.upcomingAppointments.length > 0
          ? `${profileData.upcomingAppointments[0].date} - ${profileData.upcomingAppointments[0].type}`
          : null,
        appointments: profileData.upcomingAppointments.slice(0, 3).map(a => ({
          date: a.date,
          type: a.type,
          provider: a.provider,
        })),
      },
      careTeamUpdates: {
        summary: parsed.careTeamUpdates?.summary || "Care team notes available for review.",
        recentNotes: profileData.recentCareTeamNotes.slice(0, 3).map(n => ({
          date: n.date,
          author: n.author,
          highlight: n.summary,
        })),
        actionItems: parsed.careTeamUpdates?.actionItems || [],
      },
      aiInsights: {
        healthTrends: parsed.aiInsights?.healthTrends || [],
        attentionAreas: parsed.aiInsights?.attentionAreas || [],
        positiveProgress: parsed.aiInsights?.positiveProgress || [],
      },
      healthTimeline: {
        summary: parsed.healthTimeline?.summary || `Patient has ${timelineEvents.length} documented health events.`,
        events: timelineEvents,
        keyMilestones: parsed.healthTimeline?.keyMilestones || [],
      },
      careGapsAnalysis: {
        summary: parsed.careGapsAnalysis?.summary || `${careGaps.length} care gaps identified for review.`,
        totalGaps: careGaps.length,
        highPriorityCount: careGaps.filter(g => g.priority === "high").length,
        gaps: careGaps,
      },
      labAndImagingSummary: {
        summary: parsed.labAndImagingSummary?.summary || `${labHighlights.length} recent lab results and ${imagingHighlights.length} imaging studies.`,
        recentLabHighlights: labHighlights,
        recentImagingHighlights: imagingHighlights,
        criticalFindings: parsed.labAndImagingSummary?.criticalFindings || [],
      },
      socialDeterminantsOfHealth: {
        summary: parsed.socialDeterminantsOfHealth?.summary || `${sdohFactors.length} social factors documented.`,
        identifiedFactors: sdohFactors,
        resourcesConnected: (profileData.socialDeterminants || [])
          .filter(s => s.resources && s.resources.length > 0)
          .flatMap(s => s.resources || []),
        unaddressedNeeds: parsed.socialDeterminantsOfHealth?.unaddressedNeeds || [],
      },
    };
  } catch (error) {
    console.error("[AIPatientProfileSummary] Error generating AI summary:", error);
    return generateFallbackSummary(profileData);
  }
}

function generateFallbackSummary(
  profileData: PatientProfileData
): EnhancedSummaryResult {
  const activeConditions = profileData.currentConditions.filter(c => c.status === "active");
  const controlledConditions = profileData.currentConditions.filter(c => c.status === "controlled");
  
  const timelineEvents = (profileData.healthTimeline || []).map(e => ({
    date: e.date,
    eventType: e.eventType,
    title: e.title,
    description: e.description,
    significance: e.significance,
  }));
  
  const careGaps = (profileData.careGaps || []).map(g => ({
    category: g.category,
    description: g.description,
    priority: g.priority,
    status: g.status,
    dueDate: g.dueDate,
  }));
  
  const labHighlights = (profileData.recentLabResults || []).slice(0, 5).map(l => ({
    testName: l.testName,
    value: `${l.value} ${l.unit}`,
    status: l.status,
    date: l.date,
    trend: l.trend,
  }));
  
  const imagingHighlights = (profileData.recentImagingFindings || []).slice(0, 3).map(i => ({
    studyType: i.studyType,
    date: i.date,
    impression: i.impression,
    status: i.status,
  }));
  
  const sdohFactors = (profileData.socialDeterminants || []).map(s => ({
    category: s.category,
    description: s.description,
    status: s.status,
    impact: s.impact,
  }));

  return {
    medicalHistoryHighlights: {
      summary: `Patient has ${profileData.medicalHistory.length} documented medical history items with ${activeConditions.length} currently active conditions.`,
      keyConditions: profileData.medicalHistory.filter(h => h.status === "active").slice(0, 5).map(h => h.condition),
      significantEvents: profileData.medicalHistory.filter(h => h.severity === "severe").slice(0, 3).map(h => h.condition),
    },
    currentHealthStatus: {
      summary: `Currently managing ${profileData.currentConditions.length} conditions: ${activeConditions.length} active, ${controlledConditions.length} controlled.`,
      activeConditions: profileData.currentConditions.map(c => ({
        condition: c.name,
        status: c.status,
        keyInfo: c.treatingProvider ? `Managed by ${c.treatingProvider}` : "Under management",
      })),
      recentVitals: profileData.recentVitals
        ? `BP: ${profileData.recentVitals.bloodPressure || "N/A"}, HR: ${profileData.recentVitals.heartRate || "N/A"}`
        : "No recent vitals documented.",
    },
    medicationSummary: {
      summary: `Currently taking ${profileData.activeMedications.length} medications.`,
      medicationCount: profileData.activeMedications.length,
      keyMedications: profileData.activeMedications.slice(0, 5).map(m => ({
        name: m.name,
        purpose: m.purpose || "Prescribed medication",
        dosage: `${m.dosage} ${m.frequency}`,
      })),
      allergies: profileData.allergies || [],
    },
    upcomingCare: {
      summary: profileData.upcomingAppointments.length > 0
        ? `${profileData.upcomingAppointments.length} appointments scheduled.`
        : "No upcoming appointments scheduled.",
      nextAppointment: profileData.upcomingAppointments.length > 0
        ? `${profileData.upcomingAppointments[0].date} - ${profileData.upcomingAppointments[0].type}`
        : null,
      appointments: profileData.upcomingAppointments.slice(0, 3).map(a => ({
        date: a.date,
        type: a.type,
        provider: a.provider,
      })),
    },
    careTeamUpdates: {
      summary: `${profileData.recentCareTeamNotes.length} recent care team notes available.`,
      recentNotes: profileData.recentCareTeamNotes.slice(0, 3).map(n => ({
        date: n.date,
        author: n.author,
        highlight: n.summary,
      })),
      actionItems: ["Review recent care notes", "Confirm upcoming appointments"],
    },
    aiInsights: {
      healthTrends: ["Health data patterns available for review"],
      attentionAreas: activeConditions.length > 0 ? [`${activeConditions.length} active conditions to monitor`] : [],
      positiveProgress: controlledConditions.length > 0 ? [`${controlledConditions.length} conditions well-controlled`] : [],
    },
    healthTimeline: {
      summary: `Patient has ${timelineEvents.length} documented health events.`,
      events: timelineEvents,
      keyMilestones: timelineEvents.filter(e => e.significance === "critical" || e.significance === "notable").map(e => e.title),
    },
    careGapsAnalysis: {
      summary: `${careGaps.length} care gaps identified for review.`,
      totalGaps: careGaps.length,
      highPriorityCount: careGaps.filter(g => g.priority === "high").length,
      gaps: careGaps,
    },
    labAndImagingSummary: {
      summary: `${labHighlights.length} recent lab results and ${imagingHighlights.length} imaging studies available.`,
      recentLabHighlights: labHighlights,
      recentImagingHighlights: imagingHighlights,
      criticalFindings: labHighlights.filter(l => l.status === "critical").map(l => `${l.testName}: ${l.value}`),
    },
    socialDeterminantsOfHealth: {
      summary: `${sdohFactors.length} social factors documented.`,
      identifiedFactors: sdohFactors,
      resourcesConnected: (profileData.socialDeterminants || [])
        .filter(s => s.resources && s.resources.length > 0)
        .flatMap(s => s.resources || []),
      unaddressedNeeds: sdohFactors.filter(f => f.status === "identified").map(f => f.description),
    },
  };
}

export async function generateOnePageSummary(
  request: SummaryGenerationRequest
): Promise<{ summary: OnePageHealthSummary; disclaimer: string }> {
  logHipaaAudit("SUMMARY_GENERATION_REQUEST", request.requesterId, 
    `Generating one-page summary for patient - Role: ${request.requesterRole}`);

  const cacheKey = `${request.patientId}-${request.summaryFormat}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    logHipaaAudit("SUMMARY_CACHE_HIT", request.requesterId, "Returning cached summary");
    return { summary: cached, disclaimer: NO_CDS_DISCLAIMER };
  }

  const profileData = request.profileData;
  const aiGenerated = request.includeAiInsights
    ? await generateAIHealthSummary(profileData, request.summaryFormat)
    : generateFallbackSummary(profileData);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const summary: OnePageHealthSummary = {
    id: `summary-${crypto.randomUUID()}`,
    patientId: request.patientId,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sections: {
      patientOverview: {
        name: profileData.patientName,
        age: profileData.age ? `${profileData.age} years` : "Age not specified",
        primaryCareProvider: profileData.primaryCareProvider || "Not assigned",
        lastUpdated: now.toISOString(),
      },
      medicalHistoryHighlights: aiGenerated.medicalHistoryHighlights!,
      currentHealthStatus: aiGenerated.currentHealthStatus!,
      medicationSummary: aiGenerated.medicationSummary!,
      upcomingCare: aiGenerated.upcomingCare!,
      careTeamUpdates: aiGenerated.careTeamUpdates!,
    },
    aiInsights: aiGenerated.aiInsights,
    healthTimeline: aiGenerated.healthTimeline,
    careGapsAnalysis: aiGenerated.careGapsAnalysis,
    labAndImagingSummary: aiGenerated.labAndImagingSummary,
    socialDeterminantsOfHealth: aiGenerated.socialDeterminantsOfHealth,
    quickReferenceBox: {
      emergencyInfo: profileData.primaryCareProvider 
        ? `Primary Care: ${profileData.primaryCareProvider}`
        : "Contact care team for emergencies",
      keyAllergies: profileData.allergies && profileData.allergies.length > 0
        ? profileData.allergies.join(", ")
        : "No known allergies",
      criticalMedications: profileData.activeMedications
        .slice(0, 3)
        .map(m => m.name)
        .join(", ") || "None highlighted",
    },
    disclaimer: NO_CDS_DISCLAIMER,
    metadata: {
      dataSourcesUsed: ["EHR Records", "Care Team Notes", "Appointment System", "Lab Results", "Imaging Reports", "SDOH Assessments"],
      confidenceLevel: request.includeAiInsights ? "high" : "medium",
      lastDataUpdate: profileData.recentVitals?.lastUpdated || now.toISOString(),
      summaryVersion: "2.0",
    },
  };

  summaryCache.set(cacheKey, summary);
  logHipaaAudit("SUMMARY_GENERATED", request.requesterId, `Summary ID: ${hashIdentifier(summary.id)}`);

  return { summary, disclaimer: NO_CDS_DISCLAIMER };
}

export async function getSummaryHistory(
  patientId: string,
  requesterId: string
): Promise<{ summaries: Array<{ id: string; generatedAt: string; format: string }>; disclaimer: string }> {
  logHipaaAudit("SUMMARY_HISTORY_ACCESS", requesterId, `Accessing summary history for patient`);

  const history: Array<{ id: string; generatedAt: string; format: string }> = [];
  summaryCache.forEach((summary, key) => {
    if (summary.patientId === patientId) {
      history.push({
        id: summary.id,
        generatedAt: summary.generatedAt,
        format: key.split("-").pop() || "standard",
      });
    }
  });

  return { summaries: history, disclaimer: NO_CDS_DISCLAIMER };
}

export async function getSummaryById(
  summaryId: string,
  requesterId: string
): Promise<{ summary: OnePageHealthSummary | null; disclaimer: string }> {
  logHipaaAudit("SUMMARY_ACCESS", requesterId, `Accessing summary: ${hashIdentifier(summaryId)}`);

  let foundSummary: OnePageHealthSummary | null = null;
  summaryCache.forEach((summary) => {
    if (summary.id === summaryId) {
      foundSummary = summary;
    }
  });

  return { summary: foundSummary, disclaimer: NO_CDS_DISCLAIMER };
}

export async function refreshSummary(
  request: SummaryGenerationRequest
): Promise<{ summary: OnePageHealthSummary; disclaimer: string }> {
  logHipaaAudit("SUMMARY_REFRESH", request.requesterId, "Refreshing patient summary");

  const cacheKey = `${request.patientId}-${request.summaryFormat}`;
  summaryCache.delete(cacheKey);

  return generateOnePageSummary(request);
}

export function getSamplePatientData(): PatientProfileData {
  return {
    patientId: "sample-patient-001",
    patientName: "John Doe",
    dateOfBirth: "1965-03-15",
    age: 60,
    gender: "Male",
    primaryCareProvider: "Dr. Sarah Johnson",
    medicalHistory: [
      { condition: "Type 2 Diabetes", diagnosedDate: "2015-06-20", status: "managed", severity: "moderate" },
      { condition: "Hypertension", diagnosedDate: "2012-03-10", status: "managed", severity: "moderate" },
      { condition: "Appendectomy", diagnosedDate: "1998-08-15", status: "resolved" },
      { condition: "Stage IIA NSCLC", diagnosedDate: "2024-11-01", status: "active", severity: "severe" },
    ],
    currentConditions: [
      { name: "Stage IIA Non-Small Cell Lung Cancer (EGFR+)", status: "active", treatingProvider: "Dr. Michael Chen" },
      { name: "Type 2 Diabetes Mellitus", status: "controlled", treatingProvider: "Dr. Sarah Johnson" },
      { name: "Essential Hypertension", status: "controlled", treatingProvider: "Dr. Sarah Johnson" },
    ],
    activeMedications: [
      { name: "Osimertinib", dosage: "80mg", frequency: "once daily", purpose: "EGFR-targeted therapy", prescribedBy: "Dr. Michael Chen" },
      { name: "Metformin", dosage: "1000mg", frequency: "twice daily", purpose: "Blood sugar control", prescribedBy: "Dr. Sarah Johnson" },
      { name: "Lisinopril", dosage: "20mg", frequency: "once daily", purpose: "Blood pressure control", prescribedBy: "Dr. Sarah Johnson" },
      { name: "Ondansetron", dosage: "8mg", frequency: "as needed", purpose: "Nausea prevention", prescribedBy: "Dr. Michael Chen" },
    ],
    allergies: ["Penicillin", "Sulfa drugs"],
    upcomingAppointments: [
      { date: "2026-01-25", time: "10:00 AM", provider: "Dr. Michael Chen", type: "Oncology Follow-up", location: "Cancer Center" },
      { date: "2026-02-01", time: "2:30 PM", provider: "Dr. Sarah Johnson", type: "Primary Care Check-up", location: "Main Clinic" },
      { date: "2026-02-15", time: "9:00 AM", provider: "Radiology", type: "CT Scan", location: "Imaging Center" },
    ],
    recentCareTeamNotes: [
      {
        date: "2026-01-20",
        author: "Dr. Michael Chen",
        role: "Medical Oncologist",
        noteType: "progress",
        summary: "Patient tolerating Osimertinib well. Tumor markers stable. Continue current regimen.",
      },
      {
        date: "2026-01-18",
        author: "Sarah Miller, RN",
        role: "Oncology Nurse",
        noteType: "follow-up",
        summary: "Phone follow-up completed. Patient reports mild fatigue, no other significant side effects.",
      },
      {
        date: "2026-01-15",
        author: "Dr. Sarah Johnson",
        role: "Primary Care",
        noteType: "care-plan",
        summary: "Diabetes and hypertension remain well-controlled. Coordinating with oncology team.",
      },
    ],
    recentVitals: {
      bloodPressure: "128/78 mmHg",
      heartRate: "72 bpm",
      weight: "168 lbs",
      temperature: "98.4°F",
      lastUpdated: "2026-01-18T10:30:00Z",
    },
    immunizationStatus: "Up to date",
    lastLabDate: "2026-01-15",
    healthTimeline: [
      {
        date: "2024-11-01",
        eventType: "diagnosis",
        title: "Stage IIA NSCLC Diagnosis",
        description: "Non-small cell lung cancer diagnosed via biopsy following abnormal CT findings",
        provider: "Dr. Michael Chen",
        significance: "critical",
      },
      {
        date: "2024-11-15",
        eventType: "procedure",
        title: "PET-CT Staging",
        description: "Full body PET-CT for cancer staging - confirmed Stage IIA with no distant metastases",
        provider: "Radiology",
        significance: "notable",
      },
      {
        date: "2024-12-01",
        eventType: "medication_change",
        title: "Started Osimertinib",
        description: "Initiated EGFR-targeted therapy following positive EGFR mutation testing",
        provider: "Dr. Michael Chen",
        significance: "critical",
      },
      {
        date: "2025-06-20",
        eventType: "visit",
        title: "6-Month Oncology Review",
        description: "Good treatment response, tumor size reduced by 40%",
        provider: "Dr. Michael Chen",
        significance: "notable",
      },
      {
        date: "2015-06-20",
        eventType: "diagnosis",
        title: "Type 2 Diabetes Diagnosis",
        description: "Initial diagnosis of Type 2 Diabetes Mellitus, started on Metformin",
        provider: "Dr. Sarah Johnson",
        significance: "notable",
      },
      {
        date: "2012-03-10",
        eventType: "diagnosis",
        title: "Hypertension Diagnosis",
        description: "Essential hypertension diagnosed, initiated on Lisinopril",
        provider: "Dr. Sarah Johnson",
        significance: "notable",
      },
    ],
    careGaps: [
      {
        id: "gap-001",
        category: "screening",
        description: "Colorectal cancer screening overdue - last colonoscopy 2018",
        guidelineReference: "USPSTF recommends screening every 10 years",
        lastCompleted: "2018-05-15",
        dueDate: "2028-05-15",
        priority: "medium",
        status: "due_soon",
      },
      {
        id: "gap-002",
        category: "preventive",
        description: "Annual flu vaccination not yet received for current season",
        guidelineReference: "CDC annual influenza vaccination recommendation",
        lastCompleted: "2025-10-01",
        dueDate: "2026-01-31",
        priority: "high",
        status: "overdue",
      },
      {
        id: "gap-003",
        category: "chronic_management",
        description: "HbA1c monitoring due - diabetic patients need quarterly testing",
        guidelineReference: "ADA Standards of Medical Care in Diabetes",
        lastCompleted: "2025-10-15",
        dueDate: "2026-01-15",
        priority: "medium",
        status: "overdue",
      },
      {
        id: "gap-004",
        category: "immunization",
        description: "Pneumococcal vaccine (PCV20) recommended for adults 65+",
        guidelineReference: "CDC ACIP recommendations",
        priority: "medium",
        status: "pending",
      },
    ],
    recentLabResults: [
      {
        testName: "HbA1c",
        value: "6.8",
        unit: "%",
        referenceRange: "4.0-5.6%",
        date: "2025-10-15",
        status: "abnormal_high",
        trend: "stable",
      },
      {
        testName: "CEA (Tumor Marker)",
        value: "3.2",
        unit: "ng/mL",
        referenceRange: "0-3.0 ng/mL",
        date: "2026-01-15",
        status: "normal",
        trend: "improving",
      },
      {
        testName: "Creatinine",
        value: "1.1",
        unit: "mg/dL",
        referenceRange: "0.7-1.3 mg/dL",
        date: "2026-01-15",
        status: "normal",
        trend: "stable",
      },
      {
        testName: "ALT",
        value: "28",
        unit: "U/L",
        referenceRange: "7-56 U/L",
        date: "2026-01-15",
        status: "normal",
        trend: "stable",
      },
      {
        testName: "Fasting Glucose",
        value: "118",
        unit: "mg/dL",
        referenceRange: "70-100 mg/dL",
        date: "2026-01-15",
        status: "abnormal_high",
        trend: "stable",
      },
    ],
    recentImagingFindings: [
      {
        studyType: "CT Chest with Contrast",
        date: "2025-12-20",
        bodyRegion: "Chest",
        findings: "Right upper lobe mass measuring 2.1 cm (previously 3.5 cm). No new pulmonary nodules. Mediastinal lymph nodes stable.",
        impression: "Partial treatment response with 40% reduction in primary tumor size. Continue current therapy.",
        radiologist: "Dr. Emily Rodriguez",
        status: "requires_follow_up",
      },
      {
        studyType: "PET-CT",
        date: "2025-09-15",
        bodyRegion: "Whole Body",
        findings: "Reduced FDG uptake in right upper lobe lesion (SUVmax 4.2, previously 8.1). No new hypermetabolic lesions.",
        impression: "Metabolic treatment response. No evidence of metastatic disease.",
        radiologist: "Dr. James Park",
        status: "normal",
      },
    ],
    socialDeterminants: [
      {
        category: "transportation",
        status: "addressed",
        description: "Patient relies on family for transportation to appointments",
        impact: "Occasionally misses appointments when family unavailable",
        resources: ["Hospital volunteer driver program", "Medical transport assistance enrolled"],
        lastAssessed: "2025-11-01",
      },
      {
        category: "social_support",
        status: "monitoring",
        description: "Lives alone, spouse passed away 2023. Adult children visit weekly.",
        impact: "May need additional support during intensive treatment phases",
        resources: ["Cancer support group referral provided"],
        lastAssessed: "2024-11-15",
      },
      {
        category: "financial_strain",
        status: "addressed",
        description: "Fixed income, concerns about medication costs",
        impact: "Osimertinib is expensive even with insurance coverage",
        resources: ["Enrolled in manufacturer patient assistance program", "Social worker consultation completed"],
        lastAssessed: "2024-12-01",
      },
      {
        category: "health_literacy",
        status: "monitoring",
        description: "Some difficulty understanding complex medical information",
        impact: "Benefits from written instructions and visual aids",
        lastAssessed: "2025-01-10",
      },
    ],
  };
}

console.log("[AIPatientProfileSummary] Service initialized with one-page health summary generation");
