import OpenAI from "openai";
import { storage } from "./storage";
import { logAuditEntry } from "./explainability";
import { checkDataConsent, logDataAccess } from "./consent";
import type { 
  CaregiverUpdateRequest, 
  InsertCaregiverUpdateRequest,
  Caregiver,
  User
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface CareTeamMember {
  id: string;
  caregiverId: string;
  name: string;
  email: string;
  relationship: string;
  permissions: string[];
}

export interface PatientActivitySummary {
  summary: string;
  recentMedications: string[];
  recentAppointments: string[];
  recentLabResults: string[];
  healthAlerts: string[];
  generatedAt: string;
}

export async function getCareTeamMembers(patientUserId: string): Promise<CareTeamMember[]> {
  const caregivers = await storage.getCareTeam(patientUserId);
  
  return caregivers.map(c => ({
    id: c.id,
    caregiverId: c.caregiverUserId || c.id,
    name: c.caregiverName || "Caregiver",
    email: c.caregiverEmail,
    relationship: c.relationship,
    permissions: c.permissions,
  }));
}

async function findPatientForUser(userId: string): Promise<{ id: string } | null> {
  const user = await storage.getUser(userId);
  if (!user?.email) {
    const patients = await storage.getPatients();
    return patients.length > 0 ? patients[0] : null;
  }
  
  const patients = await storage.getPatients();
  const matchingPatient = patients.find(p => 
    p.email?.toLowerCase() === user.email?.toLowerCase()
  );
  
  return matchingPatient || (patients.length > 0 ? patients[0] : null);
}

export async function generatePatientActivitySummary(
  patientUserId: string,
  requesterId: string
): Promise<PatientActivitySummary> {
  const patient = await findPatientForUser(patientUserId);
  
  if (!patient) {
    return {
      summary: "No patient records found.",
      recentMedications: [],
      recentAppointments: [],
      recentLabResults: [],
      healthAlerts: [],
      generatedAt: new Date().toISOString(),
    };
  }
  
  const medsConsent = await checkDataConsent(patientUserId, requesterId, "medications");
  const apptsConsent = await checkDataConsent(patientUserId, requesterId, "appointments");
  const labsConsent = await checkDataConsent(patientUserId, requesterId, "lab_results");
  const allergiesConsent = await checkDataConsent(patientUserId, requesterId, "allergies");
  const conditionsConsent = await checkDataConsent(patientUserId, requesterId, "conditions");
  
  const medications = medsConsent.hasAccess 
    ? await storage.getMedicationsByPatient(patient.id) 
    : [];
  const appointments = apptsConsent.hasAccess 
    ? await storage.getAppointments() 
    : [];
  const labResults = labsConsent.hasAccess 
    ? await storage.getLabResultsByPatient(patient.id) 
    : [];
  const allergies = allergiesConsent.hasAccess 
    ? await storage.getAllergiesByPatient(patient.id) 
    : [];
  const problems = conditionsConsent.hasAccess 
    ? await storage.getProblemsByPatient(patient.id) 
    : [];
  
  if (medsConsent.hasAccess) {
    await logDataAccess(patientUserId, requesterId, "medications");
  }
  if (apptsConsent.hasAccess) {
    await logDataAccess(patientUserId, requesterId, "appointments");
  }
  if (labsConsent.hasAccess) {
    await logDataAccess(patientUserId, requesterId, "lab_results");
  }
  if (allergiesConsent.hasAccess) {
    await logDataAccess(patientUserId, requesterId, "allergies");
  }
  if (conditionsConsent.hasAccess) {
    await logDataAccess(patientUserId, requesterId, "conditions");
  }
  
  const activeMeds = medications.filter(m => m.status === "active");
  const upcomingAppts = appointments.filter(a => new Date(a.scheduledAt) > new Date());
  const recentLabs = labResults.slice(0, 5);
  const activeProblems = problems.filter(p => p.status === "active");
  
  const healthAlerts: string[] = [];
  
  const abnormalLabs = labResults.filter(l => l.status === "abnormal" || l.status === "critical");
  if (abnormalLabs.length > 0) {
    healthAlerts.push(`${abnormalLabs.length} lab result(s) require attention`);
  }
  
  if (allergies.length > 0) {
    healthAlerts.push(`Patient has ${allergies.length} known allergy(ies)`);
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a healthcare coordination assistant helping caregivers stay informed about a patient's health status.
Generate a brief, clear summary of the patient's recent health activity for care team communication.
Focus on actionable information that caregivers need to know.
Keep the summary concise (2-3 sentences) and professional.
Do not provide medical advice - only summarize available information.`
        },
        {
          role: "user",
          content: `Generate a patient activity summary based on:
- Active medications: ${activeMeds.map(m => m.name).join(", ") || "None recorded"}
- Active conditions: ${activeProblems.map(p => p.name).join(", ") || "None recorded"}
- Upcoming appointments: ${upcomingAppts.length} scheduled
- Recent lab tests: ${recentLabs.length} results available
- Known allergies: ${allergies.map(a => a.name).join(", ") || "None recorded"}`
        }
      ],
      max_completion_tokens: 200,
    });
    
    const summary = response.choices[0]?.message?.content || "Unable to generate summary.";
    
    logAuditEntry({
      insightId: `caregiver-summary-${Date.now()}`,
      insightType: "caregiver_activity_summary",
      patientId: patient.id,
      userId: requesterId,
      userRole: "caregiver",
      action: "insight_generated",
      details: {
        medicationCount: activeMeds.length,
        appointmentCount: upcomingAppts.length,
        labResultCount: recentLabs.length,
      },
    });
    
    return {
      summary,
      recentMedications: activeMeds.map(m => `${m.name} (${m.dosage || "dosage not specified"})`),
      recentAppointments: upcomingAppts.slice(0, 3).map(a => `${a.type} on ${new Date(a.scheduledAt).toLocaleDateString()}`),
      recentLabResults: recentLabs.map(l => `${l.testName}: ${l.value} ${l.unit || ""}`),
      healthAlerts,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating patient summary:", error);
    return {
      summary: "Summary generation temporarily unavailable. Please review patient records directly.",
      recentMedications: activeMeds.map(m => m.name),
      recentAppointments: upcomingAppts.slice(0, 3).map(a => a.type),
      recentLabResults: recentLabs.map(l => l.testName),
      healthAlerts,
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function generateAIAssistedResponse(
  request: CaregiverUpdateRequest,
  responderName: string
): Promise<string> {
  try {
    const patient = await findPatientForUser(request.patientUserId);
    
    if (!patient) {
      return "I can provide more details about the patient's status when you're ready.";
    }
    
    const medications = await storage.getMedicationsByPatient(patient.id);
    const appointments = await storage.getAppointments();
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are helping a caregiver (${responderName}) draft a response to a care team update request.
Generate a helpful, professional suggested response based on the request type and available patient information.
Keep responses brief (1-2 sentences) and factual.
Do not provide medical advice - only suggest how to communicate status updates.`
        },
        {
          role: "user",
          content: `Request type: ${request.requestType}
Request message: "${request.message}"
Available context:
- Current medications: ${medications.filter(m => m.status === "active").map(m => m.name).join(", ") || "None"}
- Upcoming appointments: ${appointments.filter(a => new Date(a.scheduledAt) > new Date()).length}

Generate a suggested response the caregiver can use or modify.`
        }
      ],
      max_completion_tokens: 150,
    });
    
    return response.choices[0]?.message?.content || "Update received - I will provide more details soon.";
  } catch (error) {
    console.error("Error generating AI-assisted response:", error);
    return "Update received - I will provide more details when available.";
  }
}

export async function createUpdateRequest(
  requestData: InsertCaregiverUpdateRequest,
  includeAIContext: boolean = true
): Promise<CaregiverUpdateRequest> {
  let aiGeneratedContext: string | undefined;
  
  if (includeAIContext) {
    try {
      const summary = await generatePatientActivitySummary(
        requestData.patientUserId,
        requestData.requesterId
      );
      aiGeneratedContext = summary.summary;
    } catch (error) {
      console.error("Error generating AI context:", error);
    }
  }
  
  const request = await storage.createCaregiverUpdateRequest({
    ...requestData,
    aiGeneratedContext,
  });
  
  logAuditEntry({
    insightId: `update-request-${request.id}`,
    insightType: "caregiver_update_request",
    patientId: requestData.patientUserId,
    userId: requestData.requesterId,
    userRole: "caregiver",
    action: "insight_generated",
    details: {
      requestType: requestData.requestType,
      recipientId: requestData.recipientId,
      priority: requestData.priority,
    },
  });
  
  return request;
}

export async function respondToUpdateRequest(
  requestId: string,
  responderId: string,
  response: string,
  useAIAssist: boolean = false
): Promise<CaregiverUpdateRequest | undefined> {
  const request = await storage.getCaregiverUpdateRequest(requestId);
  
  if (!request || request.recipientId !== responderId) {
    return undefined;
  }
  
  let aiAssistedResponse: string | undefined;
  
  if (useAIAssist) {
    const responder = await storage.getUser(responderId);
    aiAssistedResponse = await generateAIAssistedResponse(
      request,
      responder?.firstName || "Caregiver"
    );
  }
  
  const updated = await storage.updateCaregiverUpdateRequest(requestId, {
    response,
    aiAssistedResponse,
    status: "completed",
    respondedAt: new Date().toISOString(),
  });
  
  if (updated) {
    logAuditEntry({
      insightId: `update-response-${requestId}`,
      insightType: "caregiver_update_response",
      patientId: request.patientUserId,
      userId: responderId,
      userRole: "caregiver",
      action: "insight_generated",
      details: {
        requestId,
        requestType: request.requestType,
        usedAIAssist: useAIAssist,
      },
    });
  }
  
  return updated;
}
