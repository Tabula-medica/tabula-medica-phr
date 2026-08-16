import { generatePhiSafeText } from "./services/ai-gateway";
import { logPhiAccess } from "./security/hipaa-audit";

function enforceSafeVerbs(text: string): string {
  const unsafePatterns = [
    { pattern: /\b(recommend|recommends|recommended|recommending)\b/gi, replacement: "records show" },
    { pattern: /\b(suggest|suggests|suggested|suggesting)\b/gi, replacement: "records state" },
    { pattern: /\b(advise|advises|advised|advising)\b/gi, replacement: "records refer to" },
    { pattern: /\b(indicate|indicates|indicated|indicating)\b/gi, replacement: "records show" },
    { pattern: /\b(should|must|need to|have to|ought to)\b/gi, replacement: "records show" },
    { pattern: /\b(consider|considers|considered|considering)\b/gi, replacement: "records refer to" },
    { pattern: /\b(implies|imply|implied|implying)\b/gi, replacement: "means" },
    { pattern: /\b(demonstrates|demonstrate|demonstrated|demonstrating)\b/gi, replacement: "shows" },
    { pattern: /\b(reveals|reveal|revealed|revealing)\b/gi, replacement: "shows" },
    { pattern: /\b(highlights|highlight|highlighted|highlighting)\b/gi, replacement: "shows" },
    { pattern: /\b(points to|point to|pointed to|pointing to)\b/gi, replacement: "refers to" },
    { pattern: /\b(confirms|confirm|confirmed|confirming)\b/gi, replacement: "shows" },
    { pattern: /\b(proves|prove|proved|proving)\b/gi, replacement: "shows" },
    { pattern: /\bhad\s+ongoing\b/gi, replacement: "shows ongoing" },
    { pattern: /\bwere\s+consistently\s+maintained\b/gi, replacement: "shows consistent" },
    { pattern: /\bwere\s+maintained\b/gi, replacement: "shows maintenance of" },
    { pattern: /\bwas\s+maintained\b/gi, replacement: "shows maintenance of" },
    { pattern: /\bshowed\b/gi, replacement: "shows" },
    { pattern: /\breceived\b/gi, replacement: "shows receipt of" },
    { pattern: /\bunderwent\b/gi, replacement: "shows" },
    { pattern: /\bcompleted\b/gi, replacement: "shows completion of" },
    { pattern: /\bexperienced\b/gi, replacement: "shows" },
    { pattern: /\boccurred\b/gi, replacement: "shows" },
    { pattern: /\bwere made\b/gi, replacement: "are documented" },
    { pattern: /\bwas made\b/gi, replacement: "is documented" },
    { pattern: /\bwere\s+completed\b/gi, replacement: "shows completion of" },
    { pattern: /\bwas\s+completed\b/gi, replacement: "shows completion of" },
    { pattern: /\bincluded\b/gi, replacement: "shows" },
    { pattern: /\bmanaged\b/gi, replacement: "shows management of" },
    { pattern: /\binitiated\b/gi, replacement: "shows initiation of" },
    { pattern: /\brecovered\b/gi, replacement: "shows recovery from" },
    { pattern: /\bsought\b/gi, replacement: "shows" },
    { pattern: /\badjusted\b/gi, replacement: "shows adjustment of" },
    { pattern: /\bstarted\b/gi, replacement: "shows start of" },
    { pattern: /\bstopped\b/gi, replacement: "shows cessation of" },
    { pattern: /\bdiagnosed\b/gi, replacement: "shows diagnosis of" },
    { pattern: /\btreated\b/gi, replacement: "shows treatment of" },
    { pattern: /\bwas\s+diagnosed\b/gi, replacement: "shows diagnosis of" },
    { pattern: /\bwere\s+diagnosed\b/gi, replacement: "shows diagnosis of" },
    { pattern: /\bThey shows\b/gi, replacement: "Records show" },
    { pattern: /\bthe patient shows\b/gi, replacement: "records show" },
  ];
  
  let result = text;
  for (const { pattern, replacement } of unsafePatterns) {
    result = result.replace(pattern, replacement);
  }
  
  result = result.replace(/\bshows\s+shows\b/gi, "shows");
  result = result.replace(/\brecords show records show\b/gi, "records show");
  
  return result;
}

export interface HealthEvent {
  id: string;
  date: Date;
  type: "visit" | "medication_started" | "medication_stopped" | "lab_result" | "imaging" | "hospitalization" | "procedure" | "diagnosis" | "vaccination";
  title: string;
  description: string;
  provider?: string;
  location?: string;
  details?: Record<string, any>;
}

export interface TimelineStorySection {
  period: string;
  startDate: Date;
  endDate: Date;
  summary: string;
  events: HealthEvent[];
  highlights: string[];
}

export interface TimelineStory {
  patientName: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  overallSummary: string;
  sections: TimelineStorySection[];
  keyTakeaways: string[];
}

interface PatientHealthData {
  visits: Array<{
    id: string;
    date: Date;
    provider: string;
    type: string;
    reason: string;
    notes?: string;
  }>;
  medications: Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate?: Date;
    dosage: string;
    reason?: string;
  }>;
  labResults: Array<{
    id: string;
    date: Date;
    testName: string;
    value: string;
    unit?: string;
    status: string;
    category?: string;
  }>;
  imaging: Array<{
    id: string;
    date: Date;
    type: string;
    bodyPart: string;
    findings?: string;
  }>;
  hospitalizations: Array<{
    id: string;
    admitDate: Date;
    dischargeDate?: Date;
    reason: string;
    facility?: string;
  }>;
  procedures: Array<{
    id: string;
    date: Date;
    name: string;
    provider?: string;
    notes?: string;
  }>;
  diagnoses: Array<{
    id: string;
    date: Date;
    condition: string;
    status: string;
  }>;
  vaccinations: Array<{
    id: string;
    date: Date;
    name: string;
    site?: string;
  }>;
}

function getSampleHealthData(patientId: string, monthsBack: number): PatientHealthData {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);

  return {
    visits: [
      {
        id: "v1",
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        provider: "Dr. Sarah Chen",
        type: "Annual Wellness Visit",
        reason: "Routine annual check-up",
        notes: "Blood pressure slightly elevated. Discussed lifestyle modifications.",
      },
      {
        id: "v2",
        date: new Date(now.getFullYear(), now.getMonth() - 3, 8),
        provider: "Dr. Michael Rodriguez",
        type: "Follow-up Visit",
        reason: "Diabetes management review",
        notes: "A1C improved from 7.2% to 6.8%. Continue current treatment plan.",
      },
      {
        id: "v3",
        date: new Date(now.getFullYear(), now.getMonth() - 6, 22),
        provider: "Dr. Sarah Chen",
        type: "Sick Visit",
        reason: "Upper respiratory infection",
        notes: "Prescribed antibiotics. Symptoms resolved after treatment.",
      },
      {
        id: "v4",
        date: new Date(now.getFullYear(), now.getMonth() - 9, 5),
        provider: "Dr. Jennifer Park",
        type: "Specialist Consultation",
        reason: "Cardiology evaluation",
        notes: "EKG normal. No cardiac concerns identified.",
      },
      {
        id: "v5",
        date: new Date(now.getFullYear(), now.getMonth() - 12, 18),
        provider: "Dr. Sarah Chen",
        type: "Annual Wellness Visit",
        reason: "Routine annual check-up",
        notes: "Overall health good. Recommended increasing physical activity.",
      },
    ],
    medications: [
      {
        id: "m1",
        name: "Metformin",
        startDate: new Date(now.getFullYear() - 2, 5, 1),
        dosage: "500mg twice daily",
        reason: "Type 2 Diabetes management",
      },
      {
        id: "m2",
        name: "Lisinopril",
        startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        dosage: "10mg daily",
        reason: "Blood pressure management",
      },
      {
        id: "m3",
        name: "Atorvastatin",
        startDate: new Date(now.getFullYear(), now.getMonth() - 8, 15),
        dosage: "20mg daily",
        reason: "Cholesterol management",
      },
      {
        id: "m4",
        name: "Vitamin D",
        startDate: new Date(now.getFullYear(), now.getMonth() - 10, 1),
        dosage: "2000 IU daily",
        reason: "Vitamin D deficiency",
      },
      {
        id: "m5",
        name: "Amoxicillin",
        startDate: new Date(now.getFullYear(), now.getMonth() - 6, 22),
        endDate: new Date(now.getFullYear(), now.getMonth() - 6, 29),
        dosage: "500mg three times daily",
        reason: "Upper respiratory infection",
      },
    ],
    labResults: [
      {
        id: "l1",
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        testName: "Hemoglobin A1C",
        value: "6.5",
        unit: "%",
        status: "normal",
        category: "Diabetes",
      },
      {
        id: "l2",
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        testName: "Total Cholesterol",
        value: "185",
        unit: "mg/dL",
        status: "normal",
        category: "Lipids",
      },
      {
        id: "l3",
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        testName: "LDL Cholesterol",
        value: "95",
        unit: "mg/dL",
        status: "normal",
        category: "Lipids",
      },
      {
        id: "l4",
        date: new Date(now.getFullYear(), now.getMonth() - 3, 8),
        testName: "Hemoglobin A1C",
        value: "6.8",
        unit: "%",
        status: "normal",
        category: "Diabetes",
      },
      {
        id: "l5",
        date: new Date(now.getFullYear(), now.getMonth() - 6, 10),
        testName: "Hemoglobin A1C",
        value: "7.2",
        unit: "%",
        status: "high",
        category: "Diabetes",
      },
      {
        id: "l6",
        date: new Date(now.getFullYear(), now.getMonth() - 6, 10),
        testName: "Vitamin D",
        value: "22",
        unit: "ng/mL",
        status: "low",
        category: "Vitamins",
      },
      {
        id: "l7",
        date: new Date(now.getFullYear(), now.getMonth() - 12, 18),
        testName: "Complete Blood Count",
        value: "Normal",
        status: "normal",
        category: "General",
      },
    ],
    imaging: [
      {
        id: "i1",
        date: new Date(now.getFullYear(), now.getMonth() - 9, 5),
        type: "Echocardiogram",
        bodyPart: "Heart",
        findings: "Normal cardiac function. Ejection fraction 60%.",
      },
      {
        id: "i2",
        date: new Date(now.getFullYear(), now.getMonth() - 11, 12),
        type: "Chest X-Ray",
        bodyPart: "Chest",
        findings: "No acute cardiopulmonary abnormalities.",
      },
    ],
    hospitalizations: [],
    procedures: [
      {
        id: "p1",
        date: new Date(now.getFullYear(), now.getMonth() - 9, 5),
        name: "Electrocardiogram (EKG)",
        provider: "Dr. Jennifer Park",
        notes: "Normal sinus rhythm. No abnormalities detected.",
      },
    ],
    diagnoses: [
      {
        id: "d1",
        date: new Date(now.getFullYear() - 2, 5, 1),
        condition: "Type 2 Diabetes Mellitus",
        status: "active",
      },
      {
        id: "d2",
        date: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        condition: "Essential Hypertension",
        status: "active",
      },
      {
        id: "d3",
        date: new Date(now.getFullYear(), now.getMonth() - 8, 15),
        condition: "Hyperlipidemia",
        status: "active",
      },
    ],
    vaccinations: [
      {
        id: "vac1",
        date: new Date(now.getFullYear(), now.getMonth() - 4, 10),
        name: "Influenza (Flu) Vaccine",
        site: "Left arm",
      },
      {
        id: "vac2",
        date: new Date(now.getFullYear(), now.getMonth() - 11, 5),
        name: "COVID-19 Booster",
        site: "Right arm",
      },
    ],
  };
}

function convertToHealthEvents(data: PatientHealthData): HealthEvent[] {
  const events: HealthEvent[] = [];

  data.visits.forEach((v) => {
    events.push({
      id: v.id,
      date: v.date,
      type: "visit",
      title: v.type,
      description: v.reason,
      provider: v.provider,
      details: { notes: v.notes },
    });
  });

  data.medications.forEach((m) => {
    events.push({
      id: `${m.id}-start`,
      date: m.startDate,
      type: "medication_started",
      title: `Started ${m.name}`,
      description: `${m.dosage} for ${m.reason || "ongoing care"}`,
      details: { dosage: m.dosage, reason: m.reason },
    });
    if (m.endDate) {
      events.push({
        id: `${m.id}-stop`,
        date: m.endDate,
        type: "medication_stopped",
        title: `Stopped ${m.name}`,
        description: `Completed course of ${m.name}`,
        details: { dosage: m.dosage, reason: m.reason },
      });
    }
  });

  data.labResults.forEach((l) => {
    events.push({
      id: l.id,
      date: l.date,
      type: "lab_result",
      title: l.testName,
      description: `Result: ${l.value}${l.unit ? ` ${l.unit}` : ""} (${l.status})`,
      details: { value: l.value, unit: l.unit, status: l.status, category: l.category },
    });
  });

  data.imaging.forEach((i) => {
    events.push({
      id: i.id,
      date: i.date,
      type: "imaging",
      title: `${i.type} - ${i.bodyPart}`,
      description: i.findings || "Imaging study completed",
      details: { bodyPart: i.bodyPart, findings: i.findings },
    });
  });

  data.hospitalizations.forEach((h) => {
    events.push({
      id: h.id,
      date: h.admitDate,
      type: "hospitalization",
      title: "Hospital Admission",
      description: h.reason,
      location: h.facility,
      details: { dischargeDate: h.dischargeDate },
    });
  });

  data.procedures.forEach((p) => {
    events.push({
      id: p.id,
      date: p.date,
      type: "procedure",
      title: p.name,
      description: p.notes || "Procedure completed",
      provider: p.provider,
    });
  });

  data.diagnoses.forEach((d) => {
    events.push({
      id: d.id,
      date: d.date,
      type: "diagnosis",
      title: `Diagnosis: ${d.condition}`,
      description: `Status: ${d.status}`,
      details: { status: d.status },
    });
  });

  data.vaccinations.forEach((v) => {
    events.push({
      id: v.id,
      date: v.date,
      type: "vaccination",
      title: v.name,
      description: v.site ? `Administered in ${v.site}` : "Vaccination administered",
      details: { site: v.site },
    });
  });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function groupEventsByQuarter(events: HealthEvent[], periodStart: Date, periodEnd: Date): TimelineStorySection[] {
  const sections: TimelineStorySection[] = [];
  const now = new Date();

  let currentStart = new Date(periodEnd);
  currentStart.setMonth(currentStart.getMonth() - 3);

  while (currentStart >= periodStart) {
    const sectionStart = new Date(currentStart);
    const sectionEnd = new Date(currentStart);
    sectionEnd.setMonth(sectionEnd.getMonth() + 3);

    const sectionEvents = events.filter(
      (e) => e.date >= sectionStart && e.date < sectionEnd
    );

    if (sectionEvents.length > 0) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const period = `${monthNames[sectionStart.getMonth()]} - ${monthNames[sectionEnd.getMonth() - 1 < 0 ? 11 : sectionEnd.getMonth() - 1]} ${sectionStart.getFullYear()}`;

      sections.push({
        period,
        startDate: sectionStart,
        endDate: sectionEnd,
        summary: "",
        events: sectionEvents,
        highlights: [],
      });
    }

    currentStart.setMonth(currentStart.getMonth() - 3);
  }

  return sections;
}

async function generateNarrativeSummary(
  sections: TimelineStorySection[],
  patientName: string
): Promise<{ overallSummary: string; sectionSummaries: Map<string, { summary: string; highlights: string[] }>; keyTakeaways: string[] }> {
  const systemPrompt = `You are a medical records summarizer creating a clear, readable health history narrative for a patient. Your job is to describe what happened, NOT give medical advice.

CRITICAL RULES:
1. Be DESCRIPTIVE, never PRESCRIPTIVE - describe events, don't recommend actions
2. Use plain, everyday language - no medical jargon
3. Write in third person past tense ("The patient visited..." not "You should...")
4. Focus on facts: what happened, when, and the outcomes
5. Never give advice, recommendations, or suggest treatments
6. Group related events into coherent narratives
7. Highlight significant changes or patterns

For each time period, provide:
- A 2-3 sentence narrative summary of what happened
- 2-3 key highlights (brief bullet points)

For the overall summary:
- A 3-4 sentence overview of the entire period
- 3-4 key takeaways about the health journey (factual observations only)`;

  const eventsData = sections.map((s) => ({
    period: s.period,
    events: s.events.map((e) => ({
      date: e.date.toISOString().split("T")[0],
      type: e.type,
      title: e.title,
      description: e.description,
    })),
  }));

  const userPrompt = `Create a health history narrative for ${patientName} based on these events:

${JSON.stringify(eventsData, null, 2)}

Respond with JSON containing:
{
  "overallSummary": "3-4 sentence overview of the entire health journey",
  "keyTakeaways": ["factual observation 1", "factual observation 2", "factual observation 3"],
  "sections": [
    {
      "period": "period name",
      "summary": "2-3 sentence narrative for this period",
      "highlights": ["highlight 1", "highlight 2"]
    }
  ]
}

Remember: DESCRIBE what happened. Never recommend or advise.`;

  try {
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxTokens: 1500,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const sectionSummaries = new Map<string, { summary: string; highlights: string[] }>();

    for (const s of parsed.sections || []) {
      sectionSummaries.set(s.period, {
        summary: enforceSafeVerbs(s.summary || ""),
        highlights: (s.highlights || []).map((h: string) => enforceSafeVerbs(h)),
      });
    }

    return {
      overallSummary: enforceSafeVerbs(parsed.overallSummary || "Your health history for this period."),
      sectionSummaries,
      keyTakeaways: (parsed.keyTakeaways || []).map((t: string) => enforceSafeVerbs(t)),
    };
  } catch (error) {
    console.error("[TimelineStory] Error generating narrative:", error);
    return getFallbackNarrative(sections, patientName);
  }
}

function getFallbackNarrative(
  sections: TimelineStorySection[],
  patientName: string
): { overallSummary: string; sectionSummaries: Map<string, { summary: string; highlights: string[] }>; keyTakeaways: string[] } {
  const totalEvents = sections.reduce((sum, s) => sum + s.events.length, 0);
  const sectionSummaries = new Map<string, { summary: string; highlights: string[] }>();

  for (const section of sections) {
    const visitCount = section.events.filter((e) => e.type === "visit").length;
    const labCount = section.events.filter((e) => e.type === "lab_result").length;
    const medChanges = section.events.filter((e) => e.type === "medication_started" || e.type === "medication_stopped").length;

    let summary = `Records from ${section.period} show `;
    const parts: string[] = [];
    if (visitCount > 0) parts.push(`${visitCount} healthcare visit${visitCount > 1 ? "s" : ""}`);
    if (labCount > 0) parts.push(`${labCount} lab test${labCount > 1 ? "s" : ""}`);
    if (medChanges > 0) parts.push(`${medChanges} medication change${medChanges > 1 ? "s" : ""}`);

    summary += parts.length > 0 ? parts.join(", ") + "." : "routine health monitoring.";

    const highlights = section.events.slice(0, 2).map((e) => e.title);

    sectionSummaries.set(section.period, { summary, highlights });
  }

  return {
    overallSummary: `Health records show ${totalEvents} documented events for ${patientName} across ${sections.length} time periods. Records show visits, lab work, and ongoing care documentation.`,
    sectionSummaries,
    keyTakeaways: [
      "Records show regular healthcare visits throughout the period.",
      "Lab records show monitoring at documented intervals.",
      "Medication records show documented tracking.",
    ],
  };
}

export async function generateTimelineStory(
  patientId: string,
  patientName: string,
  monthsBack: number = 12
): Promise<TimelineStory> {
  logPhiAccess({
    action: "read",
    resourceType: "TimelineStory",
    userId: patientId,
    patientId,
    details: `Generated timeline story for ${monthsBack} months`,
  });

  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - monthsBack);

  const healthData = getSampleHealthData(patientId, monthsBack);
  const events = convertToHealthEvents(healthData);
  const filteredEvents = events.filter((e) => e.date >= periodStart && e.date <= periodEnd);
  let sections = groupEventsByQuarter(filteredEvents, periodStart, periodEnd);

  const { overallSummary, sectionSummaries, keyTakeaways } = await generateNarrativeSummary(
    sections,
    patientName
  );

  sections = sections.map((s) => {
    const summaryData = sectionSummaries.get(s.period);
    return {
      ...s,
      summary: summaryData?.summary || s.summary,
      highlights: summaryData?.highlights || s.highlights,
    };
  });

  return {
    patientName,
    generatedAt: now,
    periodStart,
    periodEnd,
    overallSummary,
    sections,
    keyTakeaways,
  };
}

export function getEventTypeIcon(type: HealthEvent["type"]): string {
  const icons: Record<HealthEvent["type"], string> = {
    visit: "Stethoscope",
    medication_started: "PillIcon",
    medication_stopped: "PillOff",
    lab_result: "FlaskConical",
    imaging: "Scan",
    hospitalization: "Building2",
    procedure: "Scissors",
    diagnosis: "ClipboardList",
    vaccination: "Syringe",
  };
  return icons[type] || "FileText";
}

export function getEventTypeColor(type: HealthEvent["type"]): string {
  const colors: Record<HealthEvent["type"], string> = {
    visit: "blue",
    medication_started: "green",
    medication_stopped: "orange",
    lab_result: "purple",
    imaging: "cyan",
    hospitalization: "red",
    procedure: "indigo",
    diagnosis: "amber",
    vaccination: "teal",
  };
  return colors[type] || "gray";
}
