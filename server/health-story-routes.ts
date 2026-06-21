import type { Express, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface HealthEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string;
  source: string;
  sourceFacility: string;
  details?: Record<string, unknown>;
}

interface Citation {
  id: string;
  eventId: string;
  text: string;
  date: string;
  source: string;
  type: string;
}

interface AISummarySection {
  title: string;
  content: string;
  citations: Citation[];
}

interface HealthStorySummary {
  generatedAt: string;
  overallNarrative: string;
  keyFindings: string[];
  sections: AISummarySection[];
  recommendations: string[];
  citations: Citation[];
  disclaimer: string;
}

interface HealthStoryData {
  patientName: string;
  dateRange: { start: string; end: string };
  eventCount: number;
  sourceCount: number;
  duplicatesResolved: number;
  timeline: HealthEvent[];
  summary: HealthStorySummary | null;
}

const sampleTimeline: HealthEvent[] = [
  {
    id: "evt-001",
    date: "2025-12-15",
    type: "visit",
    title: "Annual Physical Examination",
    description: "Routine checkup with Dr. Sarah Chen. Blood pressure and vitals within normal range.",
    source: "fastenhealth",
    sourceFacility: "Memorial Health Clinic",
    details: { provider: "Dr. Sarah Chen", department: "Primary Care" },
  },
  {
    id: "evt-002",
    date: "2025-12-15",
    type: "lab_result",
    title: "Comprehensive Metabolic Panel",
    description: "All values within normal limits. HbA1c: 5.4% (well controlled).",
    source: "fastenhealth",
    sourceFacility: "Memorial Health Clinic",
    details: { hba1c: "5.4%", glucose: "92 mg/dL" },
  },
  {
    id: "evt-003",
    date: "2025-11-20",
    type: "medication",
    title: "Lisinopril 10mg Prescribed",
    description: "Started for mild hypertension. Take once daily.",
    source: "fastenhealth",
    sourceFacility: "Downtown Cardiology",
    details: { medication: "Lisinopril", dose: "10mg", frequency: "daily" },
  },
  {
    id: "evt-004",
    date: "2025-10-05",
    type: "imaging",
    title: "Chest X-Ray",
    description: "No acute cardiopulmonary findings. Heart size normal.",
    source: "fastenhealth",
    sourceFacility: "Regional Medical Center",
    details: { procedure: "Chest X-Ray PA and Lateral" },
  },
  {
    id: "evt-005",
    date: "2025-09-18",
    type: "diagnosis",
    title: "Essential Hypertension (Stage 1)",
    description: "Blood pressure consistently elevated at 135/85. Starting lifestyle modifications.",
    source: "fastenhealth",
    sourceFacility: "Memorial Health Clinic",
    details: { icd10: "I10", systolic: 135, diastolic: 85 },
  },
  {
    id: "evt-006",
    date: "2025-08-01",
    type: "immunization",
    title: "Influenza Vaccine",
    description: "Annual flu shot administered. No adverse reactions.",
    source: "fastenhealth",
    sourceFacility: "Community Pharmacy",
    details: { vaccine: "Influenza", lot: "FL2025-001" },
  },
  {
    id: "evt-007",
    date: "2025-06-12",
    type: "lab_result",
    title: "Lipid Panel",
    description: "Total cholesterol: 198 mg/dL, LDL: 112 mg/dL, HDL: 58 mg/dL, Triglycerides: 140 mg/dL.",
    source: "fastenhealth",
    sourceFacility: "Regional Medical Center",
    details: { totalCholesterol: "198 mg/dL", ldl: "112 mg/dL", hdl: "58 mg/dL" },
  },
  {
    id: "evt-008",
    date: "2025-03-22",
    type: "visit",
    title: "Follow-up Visit - Hypertension",
    description: "Blood pressure improved with lifestyle changes. Continue monitoring.",
    source: "fastenhealth",
    sourceFacility: "Memorial Health Clinic",
    details: { provider: "Dr. Sarah Chen", bloodPressure: "128/82" },
  },
  {
    id: "evt-009",
    date: "2024-12-10",
    type: "visit",
    title: "Annual Physical Examination",
    description: "All screenings up to date. Discussed nutrition and exercise goals.",
    source: "fastenhealth",
    sourceFacility: "Memorial Health Clinic",
    details: { provider: "Dr. Sarah Chen" },
  },
  {
    id: "evt-010",
    date: "2024-09-15",
    type: "procedure",
    title: "Colonoscopy Screening",
    description: "No polyps found. Recommended repeat in 10 years.",
    source: "fastenhealth",
    sourceFacility: "Regional Medical Center",
    details: { findings: "Normal", nextScreening: "2034" },
  },
];

const sampleSummary: HealthStorySummary = {
  generatedAt: new Date().toISOString(),
  overallNarrative: `Your health records from the past two years show an overall positive health trajectory with proactive management of cardiovascular risk factors. In September 2025, you were diagnosed with Stage 1 Essential Hypertension [1], which was initially managed through lifestyle modifications. Following consistent elevated readings, you were prescribed Lisinopril 10mg daily in November 2025 [3]. Your most recent visit in December 2025 showed good progress with blood pressure trending toward normal ranges [1][2]. Your metabolic health remains excellent, with HbA1c at 5.4% and cholesterol levels within acceptable ranges [2][7]. You're current on all preventive screenings including colonoscopy and annual vaccinations [6][10].`,
  keyFindings: [
    "Stage 1 Hypertension diagnosed and being actively managed",
    "Blood pressure improving with medication and lifestyle changes",
    "Metabolic markers (HbA1c, lipids) within healthy ranges",
    "All age-appropriate preventive screenings completed",
    "3 duplicate records were consolidated from multiple sources",
  ],
  sections: [
    {
      title: "Cardiovascular Health",
      content: "Your cardiovascular health has been a focus over the past year. Initial elevated blood pressure readings led to a diagnosis of Stage 1 Essential Hypertension. You've responded well to a combination of lifestyle modifications and Lisinopril medication, with blood pressure showing improvement at your most recent visits.",
      citations: [
        { id: "1", eventId: "evt-005", text: "Hypertension Diagnosis", date: "2025-09-18", source: "Memorial Health Clinic", type: "diagnosis" },
        { id: "3", eventId: "evt-003", text: "Lisinopril Prescription", date: "2025-11-20", source: "Downtown Cardiology", type: "medication" },
      ],
    },
    {
      title: "Preventive Care",
      content: "You're maintaining excellent preventive care compliance. Your colonoscopy screening was normal with no polyps found, and you're up to date on vaccinations including your annual flu shot. Continue with scheduled preventive visits.",
      citations: [
        { id: "6", eventId: "evt-006", text: "Influenza Vaccine", date: "2025-08-01", source: "Community Pharmacy", type: "immunization" },
        { id: "10", eventId: "evt-010", text: "Colonoscopy Screening", date: "2024-09-15", source: "Regional Medical Center", type: "procedure" },
      ],
    },
    {
      title: "Laboratory Results",
      content: "Your lab work shows well-controlled metabolic health. Your HbA1c of 5.4% indicates excellent blood sugar control, and your lipid panel shows cholesterol levels in acceptable ranges. These results support continued cardiovascular health management.",
      citations: [
        { id: "2", eventId: "evt-002", text: "Metabolic Panel", date: "2025-12-15", source: "Memorial Health Clinic", type: "lab_result" },
        { id: "7", eventId: "evt-007", text: "Lipid Panel", date: "2025-06-12", source: "Regional Medical Center", type: "lab_result" },
      ],
    },
  ],
  recommendations: [],
  citations: [
    { id: "1", eventId: "evt-005", text: "Hypertension Diagnosis", date: "2025-09-18", source: "Memorial Health Clinic", type: "diagnosis" },
    { id: "2", eventId: "evt-002", text: "Metabolic Panel", date: "2025-12-15", source: "Memorial Health Clinic", type: "lab_result" },
    { id: "3", eventId: "evt-003", text: "Lisinopril Prescription", date: "2025-11-20", source: "Downtown Cardiology", type: "medication" },
    { id: "6", eventId: "evt-006", text: "Influenza Vaccine", date: "2025-08-01", source: "Community Pharmacy", type: "immunization" },
    { id: "7", eventId: "evt-007", text: "Lipid Panel", date: "2025-06-12", source: "Regional Medical Center", type: "lab_result" },
    { id: "10", eventId: "evt-010", text: "Colonoscopy Screening", date: "2024-09-15", source: "Regional Medical Center", type: "procedure" },
  ],
  disclaimer: "This summary is generated by AI for informational and educational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations. Always consult with your healthcare provider for medical decisions.",
};

let cachedSummary: HealthStorySummary | null = sampleSummary;

export function registerHealthStoryRoutes(app: Express): void {
  app.get("/api/health-story", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "HealthStory",
        action: "read",
        details: "VIEW_HEALTH_STORY",
      });

      const uniqueSources = new Set(sampleTimeline.map((e) => e.source));
      const datesSorted = sampleTimeline.map((e) => new Date(e.date).getTime()).sort((a, b) => a - b);

      const storyData: HealthStoryData = {
        patientName: "John Smith",
        dateRange: {
          start: new Date(datesSorted[0]).toISOString(),
          end: new Date(datesSorted[datesSorted.length - 1]).toISOString(),
        },
        eventCount: sampleTimeline.length,
        sourceCount: uniqueSources.size,
        duplicatesResolved: 3,
        timeline: sampleTimeline,
        summary: cachedSummary,
      };

      res.json({ success: true, data: storyData });
    } catch (error) {
      console.error("[HealthStory] Error fetching story");
      res.status(500).json({ error: "Failed to fetch health story" });
    }
  });

  app.post("/api/health-story/generate-summary", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "HealthStory",
        action: "write",
        details: "GENERATE_AI_SUMMARY",
      });

      const prompt = `You are a medical documentation assistant. Analyze the following health timeline events and create a comprehensive patient health summary.

IMPORTANT INSTRUCTIONS:
- This is for EDUCATIONAL and DOCUMENTATION purposes only
- Do NOT provide medical advice or clinical recommendations
- Do NOT suggest treatments or medications
- Use clear, patient-friendly language
- Reference specific events by their IDs in square brackets like [1], [2], etc.

Timeline Events:
${JSON.stringify(sampleTimeline, null, 2)}

Create a JSON response with:
{
  "overallNarrative": "A 2-3 paragraph summary of the patient's health journey, referencing events with [ID] citations",
  "keyFindings": ["Array of 4-5 key observations from the records"],
  "sections": [
    {
      "title": "Section topic (e.g., Cardiovascular Health)",
      "content": "Detailed summary for this topic with [ID] citations"
    }
  ]
}

The response should be educational and help the patient understand their health history. Include at least 3 sections covering different aspects of their health.`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          
          cachedSummary = {
            generatedAt: new Date().toISOString(),
            overallNarrative: parsed.overallNarrative || sampleSummary.overallNarrative,
            keyFindings: parsed.keyFindings || sampleSummary.keyFindings,
            sections: (parsed.sections || sampleSummary.sections).map((s: any, i: number) => ({
              ...s,
              citations: sampleSummary.sections[i]?.citations || [],
            })),
            recommendations: sampleSummary.recommendations,
            citations: sampleSummary.citations,
            disclaimer: sampleSummary.disclaimer,
          };
        }
      } catch (aiError) {
        console.error("[HealthStory] AI generation error, using cached summary");
      }

      res.json({
        success: true,
        data: {
          summary: cachedSummary,
          disclaimer: "This AI-generated summary is for educational and informational purposes only. It does not constitute medical advice or clinical decision support. Always consult your healthcare provider for medical decisions.",
        },
      });
    } catch (error) {
      console.error("[HealthStory] Error generating summary");
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  console.log("[Routes] Health Story routes registered at /api/health-story/*");
}
