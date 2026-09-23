import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";
import { getUserConnections, fetchFhirResource } from "./ehr-integration-service";

const ONBOARDING_SYSTEM_PROMPT = `You are a friendly, helpful onboarding assistant for Tabula Medica, a personal health records application. Your job is to guide new patients through the onboarding process step by step.

ONBOARDING STEPS YOU KNOW ABOUT:
1. Profile (basics) — First name, middle name (or NMN), last name, date of birth, gender, SSN last 4 digits, phone, email, address
2. Consent — HIPAA authorization, health data sharing preferences, terms of service
3. Connect — Connecting to existing health records via Fasten Health or identity verification via Clear/ID.me

FIELD EXPLANATIONS:
- Middle Name: Helps match your records accurately across providers. If you have no middle name, select "NMN" (No Middle Name) — this is a healthcare standard to distinguish "no middle name" from "middle name not provided."
- SSN Last 4: Used solely for patient matching and record deduplication. It is stored securely and never shared. Many healthcare systems require this for accurate identity verification.
- Date of Birth: Critical for accurate patient matching, age-appropriate care recommendations, and immunization schedules.
- Gender: Used for clinical context in health records. Select the option that best represents you.
- Phone & Email: Used for appointment reminders, secure messaging with your care team, and account recovery.
- Address: Needed for care coordination, referrals to nearby providers, and compliance with healthcare regulations.

CONSENT EXPLANATIONS:
- HIPAA Authorization: Allows the app to store and manage your Protected Health Information (PHI) securely.
- Health Data Sharing: Controls who can see your health records and at what level of detail.

CONNECTION EXPLANATIONS:
- Fasten Health: A secure service that connects to 25,000+ US healthcare providers to pull your existing medical records (medications, allergies, conditions, lab results, immunizations) into one place.
- Clear/ID.me: Identity verification services that confirm you are who you say you are, adding a layer of security to your health records.

STRICT COMPLIANCE RULES (NO-CDS):
- You MUST NOT provide diagnoses, treatment recommendations, or clinical advice
- You MUST NOT interpret health data clinically
- You CAN explain what fields mean and why they matter
- You CAN help users understand the onboarding process
- You CAN answer questions about data privacy and security

TONE:
- Warm, supportive, and patient
- Use simple language (6th grade reading level)
- Be concise but thorough when explaining field purposes
- Reassure users about data security when they ask about sensitive fields`;

interface OnboardingChatContext {
  currentStep: string;
  profileData?: Record<string, any>;
}

interface AutoFillResult {
  firstName?: string;
  middleName?: string;
  hasNoMiddleName?: boolean;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  ssnLast4?: string;
  allergies?: string[];
  medications?: string[];
}

interface InteractionWarning {
  medication: string;
  allergen: string;
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
}

export class AIOnboardingAgentService {
  private conversationHistory: Map<string, Array<{ role: "user" | "assistant"; content: string }>> = new Map();

  async chat(
    userId: string,
    message: string,
    context: OnboardingChatContext
  ): Promise<string> {
    logPhiAccess({
      userId,
      patientId: userId,
      resourceType: "AIOnboardingAgent",
      action: "read",
      details: `Onboarding chat - step: ${context.currentStep}`,
    });

    let history = this.conversationHistory.get(userId) || [];
    history.push({ role: "user", content: message });

    if (history.length > 20) {
      history = history.slice(-20);
    }

    const contextMessage = `The user is currently on the "${context.currentStep}" step of onboarding.${
      context.profileData
        ? ` Their profile data so far: ${JSON.stringify(context.profileData)}`
        : ""
    }`;

    const systemPrompt = `${ONBOARDING_SYSTEM_PROMPT}\n\n${contextMessage}`;
    const conversation = history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    try {
      const reply =
        (await generatePhiSafeText({
          system: systemPrompt,
          user: conversation,
          maxTokens: 1024,
          temperature: 0.7,
        })) ||
        "I'm sorry, I wasn't able to generate a response. Please try again.";

      history.push({ role: "assistant", content: reply });
      this.conversationHistory.set(userId, history);

      return reply;
    } catch (error) {
      console.error("[AIOnboardingAgent] Chat error:", error);
      return "I'm having trouble connecting right now. Please try again in a moment, or continue filling out the form — you're doing great!";
    }
  }

  async autoFillFromFhir(userId: string): Promise<AutoFillResult> {
    logPhiAccess({
      userId,
      patientId: userId,
      resourceType: "AIOnboardingAgent",
      action: "read",
      details: "Auto-fill from FHIR requested",
    });

    const connections = getUserConnections(userId);
    const activeConnection = connections.find((c) => c.status === "connected");

    if (!activeConnection) {
      return {};
    }

    const result: AutoFillResult = {};

    try {
      const patientResponse = await fetchFhirResource({
        connectionId: activeConnection.id,
        userId,
        resourceType: "Patient",
      });

      if (patientResponse.success && patientResponse.bundle?.entry?.[0]) {
        const patient = patientResponse.bundle.entry[0].resource;
        const name = patient.name?.[0];
        if (name) {
          result.firstName = name.given?.[0];
          result.lastName = name.family;
          if (name.given?.length > 1) {
            result.middleName = name.given.slice(1).join(" ");
          } else {
            result.hasNoMiddleName = true;
            result.middleName = "NMN";
          }
        }

        result.dateOfBirth = patient.birthDate;
        result.gender = patient.gender;

        const phone = patient.telecom?.find(
          (t: any) => t.system === "phone"
        );
        if (phone) result.phone = phone.value;

        const email = patient.telecom?.find(
          (t: any) => t.system === "email"
        );
        if (email) result.email = email.value;

        const address = patient.address?.[0];
        if (address) {
          result.addressLine1 = address.line?.[0];
          result.addressLine2 = address.line?.[1];
          result.city = address.city;
          result.state = address.state;
          result.zipCode = address.postalCode;
        }

        const identifier = patient.identifier;
        if (identifier && Array.isArray(identifier)) {
          const ssnId = identifier.find(
            (id: any) =>
              id.system === "http://hl7.org/fhir/sid/us-ssn" ||
              id.type?.coding?.some((c: any) => c.code === "SS")
          );
          if (ssnId?.value) {
            const digits = ssnId.value.replace(/\D/g, "");
            if (digits.length >= 4) {
              result.ssnLast4 = digits.slice(-4);
            }
          }
        }
      }

      const allergyResponse = await fetchFhirResource({
        connectionId: activeConnection.id,
        userId,
        resourceType: "AllergyIntolerance",
      });

      if (allergyResponse.success && allergyResponse.bundle?.entry) {
        result.allergies = allergyResponse.bundle.entry
          .map((e: any) => e.resource?.code?.text || e.resource?.code?.coding?.[0]?.display)
          .filter(Boolean);
      }

      const medResponse = await fetchFhirResource({
        connectionId: activeConnection.id,
        userId,
        resourceType: "MedicationRequest",
      });

      if (medResponse.success && medResponse.bundle?.entry) {
        result.medications = medResponse.bundle.entry
          .filter((e: any) => e.resource?.status === "active")
          .map(
            (e: any) =>
              e.resource?.medicationCodeableConcept?.text ||
              e.resource?.medicationCodeableConcept?.coding?.[0]?.display
          )
          .filter(Boolean);
      }
    } catch (error) {
      console.error("[AIOnboardingAgent] FHIR auto-fill error:", error);
    }

    return result;
  }

  async checkMedicationAllergyInteractions(
    medications: string[],
    allergies: string[]
  ): Promise<InteractionWarning[]> {
    if (!medications.length || !allergies.length) {
      return [];
    }

    const prompt = `Analyze the following medications and allergies for potential interactions or allergy conflicts.

MEDICATIONS:
${medications.map((m) => `- ${m}`).join("\n")}

ALLERGIES:
${allergies.map((a) => `- ${a}`).join("\n")}

Return a JSON array of interaction warnings. Each warning should have:
- "medication": the medication name
- "allergen": the allergy that conflicts
- "severity": "low", "moderate", "high", or "critical"
- "description": a brief factual description using verbs like "shows", "refers to", "is associated with"

If no interactions are found, return an empty array: []

IMPORTANT: Use only descriptive, factual language. Do NOT provide medical advice. Use verbs like "shows", "states", "refers to", "is associated with".

Return valid JSON only.`;

    try {
      const content = await generatePhiSafeText({
        system:
          "You are a pharmacology reference system. Analyze medications and allergies for potential interactions. Respond with valid JSON only. Do not provide medical advice.",
        user: prompt,
        temperature: 0.3,
        maxTokens: 1000,
        responseMimeType: "application/json",
      });
      if (!content) return [];

      const parsed = JSON.parse(content);
      const warnings: InteractionWarning[] = (
        parsed.warnings || parsed.interactions || parsed || []
      ).map((w: any) => ({
        medication: w.medication || "Unknown",
        allergen: w.allergen || "Unknown",
        severity: w.severity || "moderate",
        description: w.description || "Potential interaction identified.",
      }));

      return Array.isArray(warnings) ? warnings : [];
    } catch (error) {
      console.error(
        "[AIOnboardingAgent] Interaction check error:",
        error
      );
      return [];
    }
  }

  clearConversation(userId: string): void {
    this.conversationHistory.delete(userId);
  }
}

export const aiOnboardingAgentService = new AIOnboardingAgentService();
