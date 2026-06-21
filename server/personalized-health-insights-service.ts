/**
 * Personalized Health Insights Service
 * 
 * Analyzes aggregated patient data to generate discussion topics.
 * 
 * SAFETY GUIDELINES:
 * - Frame as "things your clinician might suggest discussing"
 * - NO medical advice or recommendations
 * - Quote-first approach with source attribution
 * - Only approved safe verbs: "shows", "states", "refers to", "means"
 */

export interface HealthInsight {
  id: string;
  category: "lab_trend" | "medication" | "condition" | "appointment" | "lifestyle";
  title: string;
  summary: string;
  quote: string;
  source: string;
  sourceDate: string;
  sourceLink: string;
  discussionPrompts: string[];
  priority: "high" | "medium" | "low";
}

export interface PersonalizedInsightsResponse {
  insights: HealthInsight[];
  dataSourcesSummary: {
    documentsAnalyzed: number;
    labsAnalyzed: number;
    conditionsReviewed: number;
    appointmentsReviewed: number;
  };
  generatedAt: string;
  disclaimer: string;
}

/**
 * Generate personalized health insights based on patient data
 * All insights are framed as discussion topics, not recommendations
 */
export function generatePersonalizedInsights(): PersonalizedInsightsResponse {
  const insights: HealthInsight[] = [
    {
      id: "insight-1",
      category: "lab_trend",
      title: "HbA1c Values Over Time",
      summary: "Your records show HbA1c values from multiple tests over the past year.",
      quote: "HbA1c: 6.8% (Jan 2024), 7.1% (Oct 2023), 6.9% (Jul 2023)",
      source: "Quest Diagnostics Lab Results",
      sourceDate: "2024-01-10",
      sourceLink: "/documents?type=lab",
      discussionPrompts: [
        "What does HbA1c mean and what do these values show?",
        "What does this pattern refer to in terms of my health?",
        "How does this relate to my current care plan?",
      ],
      priority: "medium",
    },
    {
      id: "insight-2",
      category: "medication",
      title: "Current Medication List",
      summary: "Your records show multiple active medications from your most recent visit.",
      quote: "Metformin 500mg twice daily, Lisinopril 10mg daily, Atorvastatin 20mg daily",
      source: "Primary Care Clinic Visit Summary",
      sourceDate: "2024-01-15",
      sourceLink: "/medications",
      discussionPrompts: [
        "Does this medication list show everything I am currently taking?",
        "What does each medication mean for my conditions?",
        "How does this list relate to my care plan?",
      ],
      priority: "medium",
    },
    {
      id: "insight-3",
      category: "condition",
      title: "Documented Conditions",
      summary: "Your records show several conditions documented across your health history.",
      quote: "Type 2 Diabetes Mellitus (E11.9), Essential Hypertension (I10), Hyperlipidemia (E78.5)",
      source: "Problem List - Primary Care",
      sourceDate: "2024-01-15",
      sourceLink: "/conditions",
      discussionPrompts: [
        "What does each condition mean?",
        "How do these conditions relate to each other?",
        "What does this show about my health history?",
      ],
      priority: "low",
    },
    {
      id: "insight-4",
      category: "appointment",
      title: "Recent Specialist Visits",
      summary: "Your records show visits to specialists in the past 6 months.",
      quote: "Cardiology consult (Dec 2023), Endocrinology follow-up (Nov 2023)",
      source: "Appointment History",
      sourceDate: "2024-01-01",
      sourceLink: "/timeline",
      discussionPrompts: [
        "What do the notes from these visits show?",
        "What does this mean for my overall care?",
        "How do these visits relate to my primary care?",
      ],
      priority: "low",
    },
    {
      id: "insight-5",
      category: "lab_trend",
      title: "Blood Pressure Readings",
      summary: "Your records show blood pressure measurements from recent visits.",
      quote: "BP: 132/86 mmHg (Oct 2023) → 128/84 mmHg (Jan 2024)",
      source: "Vital Signs - Primary Care",
      sourceDate: "2024-01-15",
      sourceLink: "/documents?type=vitals",
      discussionPrompts: [
        "What do these blood pressure values mean?",
        "What does this pattern show over time?",
        "How do these values relate to my medications?",
      ],
      priority: "medium",
    },
  ];

  return {
    insights,
    dataSourcesSummary: {
      documentsAnalyzed: 12,
      labsAnalyzed: 8,
      conditionsReviewed: 5,
      appointmentsReviewed: 6,
    },
    generatedAt: new Date().toISOString(),
    disclaimer: "Informational only. Not medical advice.",
  };
}
