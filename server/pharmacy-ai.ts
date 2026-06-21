import OpenAI from "openai";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import type { 
  DrugInteractionCheckResult, 
  DrugInteractionDetail,
  InsertRefillStatusNotification,
  RefillRequest,
  PrescriptionTransferRequest
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function checkDrugInteractions(
  patientId: string,
  proposedMedication: string,
  proposedDosage: string,
  prescriptionId?: string
): Promise<DrugInteractionCheckResult> {
  const medications = await storage.getMedicationsByPatient(patientId);
  const activeMedications = medications.filter((m) => m.status === "active");
  const existingMedNames = activeMedications.map((m) => `${m.name} (${m.dosage})`);
  
  const allergies = await storage.getAllergiesByPatient(patientId);
  const drugAllergies = allergies.filter((a) => a.type === "drug" && a.status === "active");
  
  let interactions: DrugInteractionDetail[] = [];
  let overallRiskLevel: DrugInteractionCheckResult["overallRiskLevel"] = "safe";
  let aiRecommendation = "No significant drug interactions detected. Safe to prescribe.";
  
  if (existingMedNames.length > 0 || drugAllergies.length > 0) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a clinical pharmacology expert. Analyze proposed medication against patient's current medications and drug allergies for potential interactions.
            
Provide analysis in JSON format:
{
  "interactions": [
    {
      "medication1": "proposed drug",
      "medication2": "interacting drug or allergy",
      "severity": "minor|moderate|major|contraindicated",
      "description": "brief description of interaction",
      "clinicalEffects": "what could happen",
      "recommendation": "specific guidance",
      "evidenceLevel": "high|moderate|low"
    }
  ],
  "overallRiskLevel": "safe|minor|moderate|major|contraindicated",
  "recommendation": "overall prescribing recommendation for the provider"
}

Always check for:
1. Drug-drug interactions between proposed and existing medications
2. Drug-allergy conflicts (check if proposed medication or its class matches patient allergies)
3. Therapeutic duplications
4. Dosage concerns when combined

If no significant interactions, return empty interactions array with "safe" risk level.`
          },
          {
            role: "user",
            content: `Analyze this prescription for potential drug interactions:

PROPOSED MEDICATION: ${proposedMedication} ${proposedDosage}

CURRENT MEDICATIONS:
${existingMedNames.length > 0 ? existingMedNames.join("\n") : "None"}

DRUG ALLERGIES:
${drugAllergies.length > 0 ? drugAllergies.map(a => `${a.name} - Reaction: ${a.reaction} (Severity: ${a.severity})`).join("\n") : "None"}

Provide comprehensive drug interaction analysis.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        
        if (parsed.interactions && Array.isArray(parsed.interactions)) {
          interactions = parsed.interactions.map((i: any) => ({
            medication1: i.medication1 || proposedMedication,
            medication2: i.medication2 || "Unknown",
            severity: i.severity || "minor",
            description: i.description || "Potential interaction detected",
            clinicalEffects: i.clinicalEffects || "Monitor patient closely",
            recommendation: i.recommendation || "Use with caution",
            evidenceLevel: i.evidenceLevel,
          }));
        }
        
        overallRiskLevel = parsed.overallRiskLevel || "safe";
        aiRecommendation = parsed.recommendation || aiRecommendation;
      }
    } catch (error) {
      console.error("Error checking drug interactions:", error);
      aiRecommendation = "Unable to complete automated drug interaction check. Manual review recommended.";
    }
  }
  
  const checkResult: DrugInteractionCheckResult = {
    id: randomUUID(),
    patientId,
    prescriptionId,
    checkedAt: new Date().toISOString(),
    proposedMedication,
    proposedDosage,
    existingMedications: existingMedNames,
    interactions,
    overallRiskLevel,
    aiRecommendation,
    providerAcknowledged: false,
  };
  
  await storage.createDrugInteractionCheck(checkResult);
  
  return checkResult;
}

export async function generateRefillStatusNotification(
  refillRequest: RefillRequest,
  newStatus: RefillRequest["status"],
  additionalInfo?: string
): Promise<void> {
  const prescription = await storage.getPrescription(refillRequest.prescriptionId);
  if (!prescription) return;
  
  const preferences = await storage.getNotificationPreferences(refillRequest.patientId);
  if (!preferences || !preferences.statusUpdates) return;
  
  let title = "";
  let message = "";
  let type: InsertRefillStatusNotification["type"] = "status_update";
  
  switch (newStatus) {
    case "approved":
      title = "Refill Request Approved";
      message = `Your refill request for ${prescription.medicationName} has been approved and sent to the pharmacy.`;
      break;
    case "processing":
      title = "Prescription Being Prepared";
      message = `Your ${prescription.medicationName} prescription is being prepared at the pharmacy.`;
      break;
    case "ready":
      title = "Prescription Ready for Pickup";
      message = `Your ${prescription.medicationName} is ready for pickup at your pharmacy.`;
      type = "ready_pickup";
      break;
    case "completed":
      title = "Refill Complete";
      message = `Your ${prescription.medicationName} refill has been completed.`;
      break;
    case "denied":
      title = "Refill Request Denied";
      message = `Your refill request for ${prescription.medicationName} was not approved. ${additionalInfo || "Please contact your healthcare provider."}`;
      break;
    default:
      return;
  }
  
  const channels: ("email" | "sms" | "push" | "in_app")[] = ["in_app"];
  if (preferences.emailEnabled) channels.push("email");
  if (preferences.pushEnabled) channels.push("push");
  
  for (const channel of channels) {
    await storage.createNotification({
      patientId: refillRequest.patientId,
      prescriptionId: prescription.id,
      refillRequestId: refillRequest.id,
      type,
      channel,
      title,
      message,
      actionUrl: `/patients/${refillRequest.patientId}?tab=prescriptions`,
    });
  }
}

export async function generateTransferStatusNotification(
  transferRequest: PrescriptionTransferRequest,
  newStatus: PrescriptionTransferRequest["status"]
): Promise<void> {
  const prescription = await storage.getPrescription(transferRequest.prescriptionId);
  if (!prescription) return;
  
  const preferences = await storage.getNotificationPreferences(transferRequest.patientId);
  if (!preferences || !preferences.transferUpdates) return;
  
  const fromPharmacy = await storage.getPharmacy(transferRequest.fromPharmacyId);
  const toPharmacy = await storage.getPharmacy(transferRequest.toPharmacyId);
  
  let title = "";
  let message = "";
  
  switch (newStatus) {
    case "submitted":
      title = "Transfer Request Submitted";
      message = `Your request to transfer ${prescription.medicationName} from ${fromPharmacy?.name || "current pharmacy"} to ${toPharmacy?.name || "new pharmacy"} has been submitted.`;
      break;
    case "in_progress":
      title = "Transfer In Progress";
      message = `The transfer of ${prescription.medicationName} to ${toPharmacy?.name || "new pharmacy"} is being processed.`;
      break;
    case "completed":
      title = "Transfer Complete";
      message = `${prescription.medicationName} has been successfully transferred to ${toPharmacy?.name || "new pharmacy"}. You can now fill your prescription there.`;
      break;
    case "rejected":
      title = "Transfer Request Rejected";
      message = `Unable to transfer ${prescription.medicationName}. ${transferRequest.rejectionReason || "Please contact your pharmacy for details."}`;
      break;
    default:
      return;
  }
  
  const channels: ("email" | "sms" | "push" | "in_app")[] = ["in_app"];
  if (preferences.emailEnabled) channels.push("email");
  if (preferences.pushEnabled) channels.push("push");
  
  for (const channel of channels) {
    await storage.createNotification({
      patientId: transferRequest.patientId,
      prescriptionId: prescription.id,
      transferRequestId: transferRequest.id,
      type: "transfer_update",
      channel,
      title,
      message,
      actionUrl: `/patients/${transferRequest.patientId}?tab=prescriptions`,
    });
  }
}

export async function checkRefillReminders(): Promise<void> {
  const patients = await storage.getPatients();
  
  for (const patient of patients) {
    const preferences = await storage.getNotificationPreferences(patient.id);
    if (!preferences || !preferences.refillReminders) continue;
    
    const prescriptions = await storage.getActivePrescriptions(patient.id);
    
    for (const prescription of prescriptions) {
      if (!prescription.lastFilledDate) continue;
      
      const lastFilledDate = new Date(prescription.lastFilledDate);
      const today = new Date();
      const daysSinceLastFill = Math.ceil((today.getTime() - lastFilledDate.getTime()) / (1000 * 60 * 60 * 24));
      const typicalRefillDays = 30;
      const daysUntilRefill = typicalRefillDays - daysSinceLastFill;
      
      if (daysUntilRefill > 0 && daysUntilRefill <= preferences.reminderDaysBefore) {
        const existingNotifications = await storage.getPatientNotifications(patient.id);
        const alreadySent = existingNotifications.some((n) => 
          n.type === "refill_reminder" && 
          n.prescriptionId === prescription.id &&
          new Date(n.sentAt).toDateString() === today.toDateString()
        );
        
        if (!alreadySent) {
          await storage.createNotification({
            patientId: patient.id,
            prescriptionId: prescription.id,
            type: "refill_reminder",
            channel: "in_app",
            title: "Refill Reminder",
            message: `Your ${prescription.medicationName} prescription may need a refill soon. ${prescription.refillsRemaining > 0 ? `You have ${prescription.refillsRemaining} refill(s) remaining.` : "No refills remaining - contact your provider."}`,
            actionUrl: `/patients/${patient.id}?tab=prescriptions`,
          });
        }
      }
    }
  }
}
