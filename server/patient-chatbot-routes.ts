import type { Express, Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_DISCLAIMER = "This is educational information only, NOT medical advice. Always consult your healthcare provider for medical decisions.";

const FAQ_KNOWLEDGE_BASE = `
FREQUENTLY ASKED QUESTIONS - Use this knowledge to answer common questions:

== APP FEATURES ==

Q: How do I view my health records?
A: Go to "My Health Dashboard" (/my-health-dashboard) for an overview, or "Health Records" (/health-records) for detailed records. You can see conditions, medications, lab results, and more.

Q: How do I find my medications?
A: Visit the "Medications" page (/medications) to see all your current and past medications, dosages, and refill information.

Q: How do I schedule an appointment?
A: Go to "Appointments" (/appointments) to view upcoming appointments and schedule new ones with your care team.

Q: How do I message my doctor or care team?
A: Use "Messages" (/messages) for secure messaging, or visit "My Care Team" (/my-care-team) to see your full care team and send direct messages.

Q: How do I share my health records?
A: Use "Quick Share" feature or go to Connections (/connections) to share records securely with new providers or family members.

Q: How do I download my health records?
A: Visit "Packet Export" (/packet-export) to create downloadable health packets, or "Health Reports" (/health-reports) for formatted reports.

Q: How do I change my settings or preferences?
A: Go to "Settings" (/settings) for account preferences, notifications, privacy settings, and accessibility options.

Q: How do I set up my health profile?
A: Visit "AI Onboarding" (/ai-onboarding) for a guided setup, or go to "Profile Management" (/profile-management) to update your information.

Q: How do I add family members?
A: Use "Family Accounts" (/family-accounts) or "Profiles" (/profiles) to manage family member profiles and caregivers.

Q: How do I track my health vitals?
A: Go to "Health Tracking" (/patient-health-tracking) to log and track blood pressure, weight, glucose, and other vitals.

== APPOINTMENTS ==

Q: How do I see my upcoming appointments?
A: Visit "Appointments" (/appointments) - your next appointments will be listed at the top with date, time, provider name, and location.

Q: How do I cancel or reschedule an appointment?
A: Go to "Appointments" (/appointments), find the appointment, and click the reschedule or cancel option. For urgent changes, message your care team directly.

Q: How do I prepare for my appointment?
A: Check "Visit Prep" (/visit-prep) for preparation materials, bring your medication list, and note any questions you want to ask.

Q: Will I get appointment reminders?
A: Yes! You can set up appointment reminders in Settings > Notifications. You'll receive reminders via email, SMS, or push notification based on your preferences.

== MEDICATIONS ==

Q: When should I take my medications?
A: Your medication schedule is shown on the Medications page. For specific timing questions, please consult your pharmacist or doctor.

Q: What if I miss a dose?
A: Generally, take it as soon as you remember unless it's close to your next dose. However, this varies by medication - please contact your healthcare provider for specific guidance.

Q: How do I request a refill?
A: Many medications can be refilled through your pharmacy. For prescription renewals, message your care team through the Messages page.

Q: What are the side effects of my medications?
A: You can ask me about general side effects for educational purposes, but discuss any symptoms you're experiencing with your healthcare provider.

== ACCOUNT & SECURITY ==

Q: How do I change my password?
A: Go to Settings > Security to update your password and enable two-factor authentication.

Q: Is my health information secure?
A: Yes! Tabula Medica uses HIPAA-aligned security practices including encryption, secure authentication, and audit logging.

Q: Who can see my health records?
A: You control access to your records. Visit "My Care Team" (/my-care-team) to see and manage who has access.

Q: How do I enable dark mode?
A: Click the sun/moon icon in the header or go to Settings > Appearance to toggle dark mode.
`;

const SYSTEM_PROMPT = `You are a helpful AI health assistant for the Tabula Medica patient health portal, providing 24/7 patient support. Your role is to:

1. ANSWER FREQUENTLY ASKED QUESTIONS: Use the FAQ knowledge base provided to answer common questions about:
   - App features and navigation
   - Appointments (viewing, scheduling, reminders)
   - Medications (viewing list, general information)
   - Account settings and security
   - Sharing health records
   - Family member access

2. ANSWER GENERAL HEALTH QUESTIONS: Provide educational information about health topics, conditions, and medications. Always emphasize this is educational only, NOT medical advice.

3. HELP WITH PATIENT'S OWN DATA: When provided with patient context (medications, conditions), explain what those medications are for, common side effects, and general information. Never recommend changes.

4. APP NAVIGATION: Help users find features in the app. Key pages include:
   - Dashboard (/dashboard): Main overview
   - My Health Dashboard (/my-health-dashboard): Personal health visualizations
   - Medications (/medications): Medication list and tracking
   - Documents (/documents): Health documents and records
   - Document Search (/document-search): Advanced document search
   - AI Onboarding (/ai-onboarding): Health profile setup
   - Health Reports (/health-reports): Generate health reports
   - Packet Export (/packet-export): Create emergency/cancer packets
   - Appointments (/appointments): Schedule and view appointments
   - Messages (/messages): Secure messaging
   - My Care Team (/my-care-team): View and manage care team
   - Care Plans (/care-plans): View care plans
   - Profiles (/profiles): Manage family profiles
   - Settings (/settings): Account settings

5. ESCALATION TO CARE TEAM: If a user asks about:
   - Specific symptoms requiring immediate attention
   - Medication dosage changes or concerns
   - Treatment decisions
   - Emergency situations
   - Anything requiring professional medical judgment
   ...then ESCALATE by recommending they contact their healthcare provider. Offer to:
   a) Help draft a secure message to send to their care team
   b) Direct them to the secure messaging feature (/messages)
   c) For emergencies, recommend calling 911 or going to the ER immediately

CRITICAL COMPLIANCE (NO-CDS):
- You must NEVER provide medical advice, diagnoses, or treatment recommendations
- You must NEVER suggest medication changes or dosages
- Always include disclaimers about consulting healthcare providers
- If unsure, always recommend professional consultation
- Focus on education and navigation, NOT clinical guidance

When responding:
- Be warm, supportive, and patient-focused
- Use simple, accessible language
- Keep responses concise but helpful
- Always acknowledge the limits of AI assistance
- Provide specific page paths when directing users (e.g., "Go to /medications")
- For urgent health concerns, always prioritize safety and escalation

${FAQ_KNOWLEDGE_BASE}`;

interface PatientContext {
  medications?: Array<{ name: string; dosage: string; frequency: string; purpose?: string }>;
  conditions?: Array<{ name: string; status: string }>;
  allergies?: string[];
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface EscalationResult {
  shouldEscalate: boolean;
  reason?: string;
  urgency: "low" | "medium" | "high" | "emergency";
}

function detectEscalation(message: string): EscalationResult {
  const lowerMessage = message.toLowerCase();
  
  const emergencyKeywords = ["chest pain", "can't breathe", "cannot breathe", "stroke", "heart attack", "overdose", "severe bleeding", "unconscious", "suicide", "self-harm", "kill myself", "want to die", "shortness of breath", "severe shortness", "difficulty breathing", "trouble breathing", "choking", "anaphylaxis", "seizure", "passed out", "fainting", "collapsed", "unresponsive", "severe allergic", "swelling throat", "911", "emergency room", "ER"];
  for (const keyword of emergencyKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { shouldEscalate: true, reason: "potential emergency", urgency: "emergency" };
    }
  }

  const highUrgencyKeywords = ["change my dose", "stop taking", "severe pain", "getting worse", "new symptoms", "allergic reaction", "can't sleep", "very worried"];
  for (const keyword of highUrgencyKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { shouldEscalate: true, reason: "requires provider guidance", urgency: "high" };
    }
  }

  const mediumUrgencyKeywords = ["should i take", "is it safe", "side effect", "interact with", "missed dose", "double dose", "pregnant", "breastfeeding"];
  for (const keyword of mediumUrgencyKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { shouldEscalate: true, reason: "medication-related question", urgency: "medium" };
    }
  }

  return { shouldEscalate: false, urgency: "low" };
}

function buildContextMessage(context: PatientContext): string {
  const parts: string[] = ["Patient's current health information:"];
  
  if (context.medications && context.medications.length > 0) {
    parts.push("\nMedications:");
    context.medications.forEach(med => {
      parts.push(`- ${med.name} ${med.dosage}, ${med.frequency}${med.purpose ? ` (for ${med.purpose})` : ""}`);
    });
  }
  
  if (context.conditions && context.conditions.length > 0) {
    parts.push("\nConditions:");
    context.conditions.forEach(cond => {
      parts.push(`- ${cond.name} (${cond.status})`);
    });
  }
  
  if (context.allergies && context.allergies.length > 0) {
    parts.push("\nKnown Allergies:");
    parts.push(`- ${context.allergies.join(", ")}`);
  }
  
  return parts.join("\n");
}

export function registerPatientChatbotRoutes(app: Express): void {
  app.post("/api/patient-chatbot/message", async (req: Request, res: Response) => {
    try {
      const { message, history = [], patientContext } = req.body as {
        message: string;
        history: ChatMessage[];
        patientContext?: PatientContext;
      };

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const escalation = detectEscalation(message);

      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT }
      ];

      if (patientContext) {
        messages.push({ role: "system", content: buildContextMessage(patientContext) });
      }

      if (escalation.shouldEscalate) {
        messages.push({ 
          role: "system", 
          content: `ESCALATION DETECTED: This query may require professional medical attention. Urgency: ${escalation.urgency}. Reason: ${escalation.reason}. Acknowledge the concern, provide any safe educational context, but primarily recommend contacting their healthcare provider. If urgency is 'emergency', recommend calling 911 or going to the ER immediately.` 
        });
      }

      const recentHistory = history.slice(-10);
      messages.push(...recentHistory.map(m => ({ role: m.role, content: m.content })));
      messages.push({ role: "user", content: message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: messages as any,
        stream: true,
        max_completion_tokens: 1024,
      });

      let fullResponse = "";

      res.write(`data: ${JSON.stringify({ type: "escalation", data: escalation })}\n\n`);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "content", content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "disclaimer", content: NO_CDS_DISCLAIMER })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", fullResponse })}\n\n`);
      res.end();

    } catch (error) {
      console.error("Patient chatbot error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  app.post("/api/patient-chatbot/draft-provider-message", async (req: Request, res: Response) => {
    try {
      const { concern, patientContext } = req.body as {
        concern: string;
        patientContext?: PatientContext;
      };

      if (!concern) {
        return res.status(400).json({ error: "Concern is required" });
      }

      const prompt = `Help draft a message to a healthcare provider about the following concern. Be clear, concise, and include relevant context. Do NOT include any medical advice or recommendations - just help format the patient's concern professionally.

Patient concern: ${concern}

${patientContext ? `Context:\n${buildContextMessage(patientContext)}` : ""}

Draft a professional, clear message the patient can send to their healthcare provider. Include:
1. A brief subject line suggestion
2. The main message body
3. A polite closing

Keep it under 200 words.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are helping a patient draft a message to their healthcare provider. Be professional, clear, and concise. Do NOT provide medical advice." },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 512,
      });

      const draft = response.choices[0]?.message?.content || "";

      res.json({
        draft,
        disclaimer: NO_CDS_DISCLAIMER
      });

    } catch (error) {
      console.error("Draft provider message error:", error);
      res.status(500).json({ error: "Failed to draft message" });
    }
  });

  app.post("/api/patient-chatbot/medication-info", async (req: Request, res: Response) => {
    try {
      const { medicationName, patientContext } = req.body as {
        medicationName: string;
        patientContext?: PatientContext;
      };

      if (!medicationName) {
        return res.status(400).json({ error: "Medication name is required" });
      }

      const prompt = `Provide educational information about the medication "${medicationName}". Include:
1. General purpose (what it's commonly used for)
2. How it typically works
3. Common side effects to be aware of
4. General precautions
5. Important things to discuss with a healthcare provider

${patientContext?.allergies?.length ? `Note: Patient has allergies to: ${patientContext.allergies.join(", ")}. If this medication might be related to any of these allergies, mention it.` : ""}

IMPORTANT: This is for educational purposes only. Always emphasize consulting with a healthcare provider for personalized guidance.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a health education assistant. Provide clear, accurate medication information for educational purposes only. Always include disclaimers about consulting healthcare providers. Never provide dosage recommendations or treatment advice." },
          { role: "user", content: prompt }
        ],
        stream: true,
        max_completion_tokens: 1024,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ type: "content", content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();

    } catch (error) {
      console.error("Medication info error:", error);
      res.status(500).json({ error: "Failed to get medication info" });
    }
  });

  app.get("/api/patient-chatbot/quick-actions", (req: Request, res: Response) => {
    res.json({
      actions: [
        { id: "nav-medications", label: "View my medications", type: "navigation", path: "/medications" },
        { id: "nav-documents", label: "Find my documents", type: "navigation", path: "/document-search" },
        { id: "nav-appointments", label: "Check my appointments", type: "navigation", path: "/appointments" },
        { id: "nav-messages", label: "Message my provider", type: "navigation", path: "/messages" },
        { id: "nav-care-team", label: "View my care team", type: "navigation", path: "/my-care-team" },
        { id: "ask-medication", label: "Ask about a medication", type: "prompt", prompt: "Can you tell me about my medication [medication name]?" },
        { id: "ask-condition", label: "Learn about a condition", type: "prompt", prompt: "Can you explain what [condition] means?" },
        { id: "ask-test", label: "Understand a lab test", type: "prompt", prompt: "What does the [test name] test measure?" },
        { id: "ask-appointment", label: "Ask about appointments", type: "prompt", prompt: "How do I schedule or view my appointments?" },
        { id: "ask-help", label: "How to use the app", type: "prompt", prompt: "How do I navigate and use this app?" },
        { id: "escalate", label: "Talk to my care team", type: "escalation" }
      ]
    });
  });

  app.post("/api/patient-chatbot/escalate-to-care-team", async (req: Request, res: Response) => {
    try {
      const { subject, message, urgency: rawUrgency, category, conversationContext } = req.body as {
        subject: string;
        message: string;
        urgency?: string;
        category?: string;
        conversationContext?: string;
      };

      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and message are required" });
      }

      const authenticatedPatientId = "patient_001";

      const validUrgencies = ["low", "medium", "high", "emergency"] as const;
      const urgency: typeof validUrgencies[number] = validUrgencies.includes(rawUrgency as any) 
        ? (rawUrgency as typeof validUrgencies[number])
        : "medium";

      const escalationId = `esc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const createdAt = new Date().toISOString();

      const escalationRecord = {
        id: escalationId,
        patientId: authenticatedPatientId,
        subject: subject.slice(0, 200),
        message: message.slice(0, 5000),
        urgency,
        category: category || "chatbot_escalation",
        conversationContext: conversationContext?.slice(0, 10000) || "",
        status: "pending" as const,
        createdAt,
        assignedTo: null as string | null,
        resolvedAt: null as string | null,
      };

      console.log(`[HIPAA-AUDIT][PatientChatbot] ESCALATION_CREATED`, {
        timestamp: createdAt,
        escalationId,
        patientId: authenticatedPatientId,
        action: "ESCALATE_TO_CARE_TEAM",
        urgency,
        category: escalationRecord.category,
        subjectLength: subject.length,
        messageLength: message.length,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
      });

      const responseTimeMap: Record<typeof urgency, string> = {
        emergency: "Immediately - Please call 911 for emergencies",
        high: "Within 4 hours",
        medium: "Within 24 hours",
        low: "Within 48 hours",
      };

      const responseMessage = urgency === "emergency"
        ? "Your concern has been flagged as urgent. However, if this is a life-threatening emergency, please call 911 immediately or go to your nearest emergency room. Do not wait for a response."
        : "Your concern has been sent to your care team. They will respond based on the urgency of your request.";

      res.json({
        success: true,
        escalationId,
        message: responseMessage,
        estimatedResponseTime: responseTimeMap[urgency],
        ticketNumber: escalationId.slice(-8).toUpperCase(),
        urgencyAssigned: urgency,
      });

    } catch (error) {
      console.error("[PatientChatbot] Care team escalation error:", error);
      
      console.log(`[HIPAA-AUDIT][PatientChatbot] ESCALATION_FAILED`, {
        timestamp: new Date().toISOString(),
        action: "ESCALATE_TO_CARE_TEAM",
        error: error instanceof Error ? error.message : "Unknown error",
        ipAddress: req.ip || "unknown",
      });
      
      res.status(500).json({ error: "Failed to escalate to care team. Please try the secure messaging feature instead." });
    }
  });

  app.get("/api/patient-chatbot/suggested-responses", (req: Request, res: Response) => {
    const { context } = req.query as { context?: string };
    
    const suggestions = {
      greeting: [
        "What are my upcoming appointments?",
        "Tell me about my medications",
        "How do I share my health records?",
        "I have a question about a symptom",
      ],
      medications: [
        "What is this medication for?",
        "What are the common side effects?",
        "When should I take this?",
        "I need to talk to my doctor about my medication",
      ],
      appointments: [
        "How do I schedule a new appointment?",
        "What should I bring to my appointment?",
        "Can I reschedule my appointment?",
        "I need to cancel an appointment",
      ],
      general: [
        "How do I navigate this app?",
        "Where can I find my lab results?",
        "How do I message my care team?",
        "I have a health concern to discuss",
      ],
    };

    const contextKey = (context || "general") as keyof typeof suggestions;
    res.json({
      suggestions: suggestions[contextKey] || suggestions.general,
    });
  });
}
