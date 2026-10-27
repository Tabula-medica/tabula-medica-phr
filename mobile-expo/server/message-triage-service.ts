export type MessagePriority = "emergency" | "urgent" | "routine";

export interface TriageResult {
  priority: MessagePriority;
  suggestedCategory: string;
  summary: string;
  autoResponse: string;
  confidenceScore: number;
}

const EMERGENCY_KEYWORDS = [
  "chest pain",
  "can't breathe",
  "severe bleeding",
  "unconscious",
  "stroke",
  "heart attack",
];

const URGENT_KEYWORDS = [
  "fever",
  "vomiting",
  "infection",
  "swelling",
  "pain severe",
  "allergic reaction",
];

export async function triageMessage(message: string, category?: string): Promise<TriageResult> {
  const lower = message.toLowerCase();
  let priority: MessagePriority = "routine";
  let confidenceScore = 85;

  if (EMERGENCY_KEYWORDS.some((k) => lower.includes(k))) {
    priority = "emergency";
    confidenceScore = 95;
  } else if (URGENT_KEYWORDS.some((k) => lower.includes(k))) {
    priority = "urgent";
    confidenceScore = 90;
  }

  let suggestedCategory = category || "general";
  if (lower.includes("medication") || lower.includes("prescription") || lower.includes("refill")) {
    suggestedCategory = "medication";
  } else if (lower.includes("appointment") || lower.includes("schedule")) {
    suggestedCategory = "appointment";
  } else if (lower.includes("lab") || lower.includes("test result")) {
    suggestedCategory = "lab_results";
  } else if (lower.includes("symptom") || lower.includes("feel")) {
    suggestedCategory = "symptoms";
  }

  const autoResponse =
    priority === "emergency"
      ? "This appears to be an emergency. Please call 911 or go to the nearest emergency room immediately."
      : priority === "urgent"
        ? "Thank you for reaching out. Your message has been marked as urgent and a care team member will respond within 2 hours during business hours."
        : "Thank you for your message. A member of your care team will respond within 24-48 hours. For urgent matters, please call our office directly.";

  return {
    priority,
    suggestedCategory,
    summary: `${suggestedCategory} inquiry - ${priority} priority`,
    autoResponse,
    confidenceScore,
  };
}

export async function generateMessageSuggestions(_message: string, _context?: string): Promise<string[]> {
  return [
    "I understand your concern. Can you provide more details about when this started?",
    "Thank you for sharing. Have you experienced any other symptoms?",
    "I'd like to help you with this. What questions do you have for your care team?",
  ];
}
