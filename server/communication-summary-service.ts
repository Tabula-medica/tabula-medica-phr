import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];

interface CommunicationEntry {
  id: string;
  timestamp: string;
  type: "message" | "call" | "video" | "portal" | "note";
  direction: "inbound" | "outbound";
  sender: string;
  recipient: string;
  subject?: string;
  content: string;
  urgency?: "low" | "normal" | "high";
  status: "read" | "unread" | "responded" | "pending";
}

interface CommunicationSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  totalMessages: number;
  summaryText: string;
  keyTopics: string[];
  actionItems: string[];
  pendingResponses: number;
  urgentItems: string[];
  disclaimer: string;
}

function sanitizeText(text: string): string {
  let sanitized = text;
  
  const replacements: Record<string, string> = {
    "indicates": "shows",
    "suggests": "communications show",
    "demonstrates": "shows",
    "reveals": "shows",
    "confirms": "shows",
    "recommend": "records show",
    "should": "messages show",
    "must": "records show",
    "need to": "communications show",
    "advise": "messages state",
    "likely": "possibly",
    "probably": "communications show patterns of",
    "follow up": "pending communication",
    "follow-up": "pending communication",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  
  return sanitized;
}

function extractKeyTopics(communications: CommunicationEntry[]): string[] {
  const topicKeywords: Record<string, string[]> = {
    "Medication": ["medication", "prescription", "refill", "dose", "pill", "drug", "pharmacy"],
    "Symptoms": ["pain", "symptom", "feeling", "discomfort", "headache", "nausea", "fatigue"],
    "Appointments": ["appointment", "schedule", "visit", "reschedule", "cancel", "booking"],
    "Lab Results": ["lab", "result", "test", "blood work", "imaging", "report"],
    "Insurance": ["insurance", "coverage", "authorization", "prior auth", "billing"],
    "Referral": ["referral", "specialist", "refer"],
    "Follow-up": ["follow up", "check in", "status", "update"],
  };
  
  const foundTopics = new Set<string>();
  
  for (const comm of communications) {
    const contentLower = comm.content.toLowerCase();
    const subjectLower = (comm.subject || "").toLowerCase();
    const combined = `${contentLower} ${subjectLower}`;
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => combined.includes(kw))) {
        foundTopics.add(topic);
      }
    }
  }
  
  return Array.from(foundTopics);
}

function extractActionItems(communications: CommunicationEntry[]): string[] {
  const actions: string[] = [];
  
  const pendingMessages = communications.filter(c => c.status === "pending" || c.status === "unread");
  if (pendingMessages.length > 0) {
    actions.push(`${pendingMessages.length} message(s) shows pending response status`);
  }
  
  for (const comm of communications) {
    const contentLower = comm.content.toLowerCase();
    
    if (contentLower.includes("refill") || contentLower.includes("prescription")) {
      actions.push(`Message from ${comm.sender} states medication item`);
    }
    if (contentLower.includes("question") || contentLower.includes("?")) {
      if (comm.direction === "inbound" && comm.status !== "responded") {
        actions.push(`Patient message shows question from ${new Date(comm.timestamp).toLocaleDateString()}`);
      }
    }
    if (contentLower.includes("urgent") || contentLower.includes("asap") || comm.urgency === "high") {
      actions.push(`Message from ${comm.sender} shows urgent status on ${new Date(comm.timestamp).toLocaleDateString()}`);
    }
  }
  
  return Array.from(new Set(actions)).slice(0, 5);
}

function generateMockSummary(communications: CommunicationEntry[], patientName: string): string {
  const inbound = communications.filter(c => c.direction === "inbound").length;
  const outbound = communications.filter(c => c.direction === "outbound").length;
  const topics = extractKeyTopics(communications);
  
  let summary = `Communication records for ${patientName} show ${communications.length} total exchanges (${inbound} inbound, ${outbound} outbound).`;
  
  if (topics.length > 0) {
    summary += ` Key topics in messages refer to: ${topics.join(", ")}.`;
  }
  
  const urgent = communications.filter(c => c.urgency === "high");
  if (urgent.length > 0) {
    summary += ` Records show ${urgent.length} urgent message(s) in this period.`;
  }
  
  const pending = communications.filter(c => c.status === "pending" || c.status === "unread");
  if (pending.length > 0) {
    summary += ` Communications show ${pending.length} item(s) with pending status.`;
  }
  
  return sanitizeText(summary);
}

export async function generateCommunicationSummary(
  patientId: string,
  patientName: string,
  communications: CommunicationEntry[],
  dateRange?: { start: string; end: string }
): Promise<CommunicationSummary> {
  const summaryId = `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const filteredComms = dateRange 
    ? communications.filter(c => {
        const date = new Date(c.timestamp);
        return date >= new Date(dateRange.start) && date <= new Date(dateRange.end);
      })
    : communications;
  
  const actualDateRange = {
    start: filteredComms.length > 0 
      ? filteredComms.reduce((min, c) => c.timestamp < min ? c.timestamp : min, filteredComms[0].timestamp)
      : new Date().toISOString(),
    end: filteredComms.length > 0
      ? filteredComms.reduce((max, c) => c.timestamp > max ? c.timestamp : max, filteredComms[0].timestamp)
      : new Date().toISOString(),
  };
  
  const keyTopics = extractKeyTopics(filteredComms);
  const actionItems = extractActionItems(filteredComms);
  const pendingResponses = filteredComms.filter(c => c.status === "pending" || c.status === "unread").length;
  const urgentItems = filteredComms
    .filter(c => c.urgency === "high")
    .map(c => `${c.type} from ${c.sender}: ${c.subject || c.content.substring(0, 50)}...`);
  
  let summaryText: string;
  
  try {
    if (!process.env.OPENAI_API_KEY || filteredComms.length === 0) {
      throw new Error("Using mock summary");
    }
    
    const systemPrompt = `You are a medical communication summarizer.
CRITICAL RULES:
- Use ONLY these verbs: "shows", "states", "refers to", "means"
- NEVER use: should, must, recommend, suggest, advise, likely, probably, indicates, follow up
- Be factual and descriptive
- Summarize key points from patient-clinician communications
- Keep summary concise (2-4 sentences)`;

    const commText = filteredComms.slice(0, 10).map(c => 
      `[${c.type}] ${c.sender} to ${c.recipient}: ${c.subject || ""} - ${c.content.substring(0, 100)}`
    ).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize these patient communications for ${patientName}:\n\n${commText}` }
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    summaryText = response.choices[0]?.message?.content || generateMockSummary(filteredComms, patientName);
    summaryText = sanitizeText(summaryText);
  } catch (error) {
    summaryText = generateMockSummary(filteredComms, patientName);
  }
  
  return {
    id: summaryId,
    patientId,
    generatedAt: new Date().toISOString(),
    dateRange: actualDateRange,
    totalMessages: filteredComms.length,
    summaryText,
    keyTopics,
    actionItems,
    pendingResponses,
    urgentItems,
    disclaimer: "Auto-generated summary. Review original communications for complete context.",
  };
}

// Sample communication data generator
export function generateSampleCommunications(patientId: string): CommunicationEntry[] {
  const now = new Date();
  const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: "comm-1",
      timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      type: "message",
      direction: "inbound",
      sender: "Patient",
      recipient: "Dr. Smith",
      subject: "Medication refill request",
      content: "I need a refill for my blood pressure medication. I have about 5 days left.",
      urgency: "normal",
      status: "pending",
    },
    {
      id: "comm-2",
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: "message",
      direction: "outbound",
      sender: "Dr. Smith",
      recipient: "Patient",
      subject: "Lab results available",
      content: "Your recent lab results are now available in your patient portal. Your cholesterol levels look good.",
      urgency: "low",
      status: "read",
    },
    {
      id: "comm-3",
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      type: "portal",
      direction: "inbound",
      sender: "Patient",
      recipient: "Clinic",
      subject: "Question about symptoms",
      content: "I have been experiencing some dizziness in the mornings. Is this related to my medication?",
      urgency: "normal",
      status: "responded",
    },
    {
      id: "comm-4",
      timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      type: "call",
      direction: "inbound",
      sender: "Patient",
      recipient: "Nurse Line",
      subject: "Appointment scheduling",
      content: "Called to schedule a follow-up appointment. Scheduled for next Tuesday at 2pm.",
      urgency: "low",
      status: "responded",
    },
    {
      id: "comm-5",
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      type: "message",
      direction: "inbound",
      sender: "Patient",
      recipient: "Dr. Smith",
      subject: "Urgent - chest pain",
      content: "I experienced some chest discomfort last night. It went away after 10 minutes but I wanted to let you know.",
      urgency: "high",
      status: "responded",
    },
  ];
}
