// ELI12, Timeline Story, What Changed, Smart Search, One-Page Snapshot
import { baaChatFetch, isAiConfigured } from "./lib/baa-chat";

// ============================================
// ELI12 - Explain Like I'm 12
// Safe 3-part structure:
// 1. Definition / explanation
// 2. Where this appears in your record (quote + provenance)
// 3. Questions to ask your clinician
// ============================================

export interface ELI12Explanation {
  term: string;
  definition: string;
  whereInRecord: {
    quote: string;
    source: string;
    date: string;
  } | null;
  questionsForClinician: string[];
  disclaimer: string;
}

// Quick dictionary for common medical abbreviations
// Safe phrasing using approved verbs: "refers to", "is often measured to assess", "is commonly used to describe"
const medicalAbbreviations: Record<string, string> = {
  "CBC": "CBC refers to Complete Blood Count. This is a lab value often measured to assess the different cells in your blood, including red cells, white cells, and platelets.",
  "A1C": "A1C refers to Hemoglobin A1C. This is a lab value often measured to assess average blood sugar levels over the past 2-3 months.",
  "BMI": "BMI refers to Body Mass Index. This is commonly used to describe a calculation based on height and weight.",
  "BP": "BP refers to Blood Pressure. This is a measurement often used to assess the force of blood against artery walls.",
  "BUN": "BUN refers to Blood Urea Nitrogen. This is a lab value often measured to assess kidney function.",
  "ECG": "ECG refers to Electrocardiogram. This is a test often used to assess the electrical activity of the heart.",
  "EKG": "EKG refers to Electrocardiogram. This is a test often used to assess the electrical activity of the heart.",
  "HDL": "HDL refers to High-Density Lipoprotein. This is a type of cholesterol often measured as part of a lipid panel.",
  "LDL": "LDL refers to Low-Density Lipoprotein. This is a type of cholesterol often measured as part of a lipid panel.",
  "MRI": "MRI refers to Magnetic Resonance Imaging. This is a scan that uses magnets and radio waves to create detailed pictures of organs and tissues.",
  "CT": "CT refers to Computed Tomography. This is a scan that combines X-ray images to create cross-sectional pictures.",
  "TSH": "TSH refers to Thyroid Stimulating Hormone. This is a lab value often measured to assess thyroid function.",
  "WBC": "WBC refers to White Blood Cells. These are cells often measured to assess immune system activity.",
  "RBC": "RBC refers to Red Blood Cells. These are cells often measured to assess oxygen-carrying capacity.",
  "BMP": "BMP refers to Basic Metabolic Panel. This is a group of lab tests often measured to assess kidney function and electrolytes.",
  "CMP": "CMP refers to Comprehensive Metabolic Panel. This is a group of lab tests that includes kidney and liver function assessments.",
  "PT": "PT refers to Prothrombin Time. This is a lab value often measured to assess blood clotting time.",
  "INR": "INR refers to International Normalized Ratio. This is a standardized measurement often used to assess blood clotting.",
  "PSA": "PSA refers to Prostate-Specific Antigen. This is a protein that can be measured in the blood.",
  "GFR": "GFR refers to Glomerular Filtration Rate. This is a value often used to assess kidney function.",
  "ALT": "ALT refers to Alanine Aminotransferase. This is an enzyme often measured to assess liver function.",
  "AST": "AST refers to Aspartate Aminotransferase. This is an enzyme often measured to assess liver and heart function.",
  "HGB": "HGB refers to Hemoglobin. This is a protein in red blood cells often measured to assess oxygen-carrying capacity.",
  "HCT": "HCT refers to Hematocrit. This shows the percentage of blood made up of red blood cells.",
  "PLT": "PLT refers to Platelets. These are cell fragments often measured to assess blood clotting ability.",
  "LIPID": "Lipid Panel refers to a group of blood tests that measure different types of fats in the blood.",
  "GLUCOSE": "Glucose refers to blood sugar. This is often measured to assess energy metabolism.",
  "CREATININE": "Creatinine refers to a waste product often measured to assess kidney function.",
  "POTASSIUM": "Potassium refers to a mineral often measured to assess electrolyte balance.",
  "SODIUM": "Sodium refers to a mineral often measured to assess fluid and electrolyte balance.",
};

export function getQuickDefinition(abbreviation: string): string | null {
  return medicalAbbreviations[abbreviation.toUpperCase()] || null;
}

export async function generateELI12Explanation(
  term: string,
  context?: string,
  recordContext?: { quote?: string; source?: string; date?: string }
): Promise<ELI12Explanation> {
  const disclaimer = "Informational only. Not medical advice.";

  // Check quick dictionary first
  const quickDef = getQuickDefinition(term);
  if (quickDef && !context) {
    return {
      term,
      definition: quickDef,
      whereInRecord: recordContext ? {
        quote: recordContext.quote || `In your record, ${term} appears as a documented value`,
        source: recordContext.source || "Your health record",
        date: recordContext.date || new Date().toLocaleDateString(),
      } : null,
      questionsForClinician: [
        `What does this result mean in my situation?`,
        `Is this value expected given my history?`,
        `Should this be rechecked, and if so when?`,
      ],
      disclaimer,
    };
  }

  // Use AI for complex explanations
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!isAiConfigured()) {
    return getMockELI12Explanation(term, recordContext, disclaimer);
  }

  try {
    const response = await baaChatFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You explain medical terms to patients in simple, friendly language.

SAFE VERBS TO USE: "shows", "means", "refers to", "is commonly used to describe", "is often measured to assess"

SAFE FRAMING TEMPLATES:
- Definition: "X refers to..."
- Context: "This is a lab value used to measure..."
- Neutral uncertainty: "This can have different causes depending on context."

IMPORTANT RULES:
- Never give medical advice, diagnoses, or recommendations
- Never say what the patient "should" do
- Never interpret whether results are good or bad
- Only provide educational definitions using safe verbs
- Generate questions for the patient to ASK their clinician`,
          },
          {
            role: "user",
            content: `Explain this medical term: "${term}"${context ? `\nContext from record: ${context}` : ""}

Use safe phrasing like "X refers to...", "This is often measured to assess...", "This is commonly used to describe..."

Respond in JSON:
{
  "definition": "2-3 sentence explanation using safe verbs (refers to, means, shows, is often measured to assess)",
  "questionsForClinician": ["3 safe questions like: 'What does this result mean in my situation?', 'Is this value expected given my history?', 'Should this be rechecked, and if so when?'"]
}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      return getMockELI12Explanation(term, recordContext, disclaimer);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        term,
        definition: parsed.definition || `${term} refers to a medical term that appears in health records.`,
        whereInRecord: recordContext ? {
          quote: recordContext.quote || `In your record, ${term} appears as a documented entry`,
          source: recordContext.source || "Your health record",
          date: recordContext.date || new Date().toLocaleDateString(),
        } : null,
        questionsForClinician: parsed.questionsForClinician || [
          `What does this result mean in my situation?`,
          `Is this value expected given my history?`,
          `Should this be rechecked, and if so when?`,
        ],
        disclaimer,
      };
    }

    return getMockELI12Explanation(term, recordContext, disclaimer);
  } catch (error) {
    console.error("[ELI12] AI error:", error);
    return getMockELI12Explanation(term, recordContext, disclaimer);
  }
}

function getMockELI12Explanation(
  term: string,
  recordContext?: { quote?: string; source?: string; date?: string },
  disclaimer?: string
): ELI12Explanation {
  return {
    term,
    definition: `${term} refers to a medical term that appears in health records. This is commonly used to describe a measurement or observation about your health.`,
    whereInRecord: recordContext ? {
      quote: recordContext.quote || `In your record, ${term} appears as a documented entry`,
      source: recordContext.source || "Your health record",
      date: recordContext.date || new Date().toLocaleDateString(),
    } : null,
    questionsForClinician: [
      `What does this result mean in my situation?`,
      `Is this value expected given my history?`,
      `Can you confirm my current medication list?`,
    ],
    disclaimer: disclaimer || "Informational only. Not medical advice.",
  };
}

// ============================================
// Timeline Story Mode
// ============================================

export interface TimelineEvent {
  id: string;
  date: string;
  type: "visit" | "medication" | "lab" | "imaging" | "procedure" | "diagnosis" | "vaccination";
  title: string;
  description: string;
  provider?: string;
  location?: string;
}

export interface TimelineStory {
  period: string;
  startDate: string;
  endDate: string;
  summary: string;
  keyEvents: TimelineEvent[];
  overallTakeaway: string;
}

export async function generateTimelineStory(
  userId: string,
  months: number = 12
): Promise<TimelineStory> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Mock events - in production would fetch from patient records
  const events: TimelineEvent[] = [
    {
      id: "evt-1",
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      type: "visit",
      title: "Annual Physical Exam",
      description: "Routine checkup with Dr. Martinez. Vitals recorded.",
      provider: "Dr. Sarah Martinez",
      location: "Primary Care Clinic",
    },
    {
      id: "evt-2",
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      type: "lab",
      title: "Lipid Panel",
      description: "Cholesterol and triglycerides measured.",
    },
    {
      id: "evt-3",
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      type: "medication",
      title: "Lisinopril 10mg Started",
      description: "Blood pressure medication prescribed.",
      provider: "Dr. Sarah Martinez",
    },
    {
      id: "evt-4",
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      type: "diagnosis",
      title: "Hypertension Documented",
      description: "Elevated blood pressure noted in records.",
      provider: "Dr. Sarah Martinez",
    },
    {
      id: "evt-5",
      date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      type: "vaccination",
      title: "Flu Shot",
      description: "Annual influenza vaccination administered.",
      location: "CVS Pharmacy",
    },
    {
      id: "evt-6",
      date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      type: "imaging",
      title: "Chest X-Ray",
      description: "Imaging study completed.",
      location: "Radiology Center",
    },
  ];

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  let summary = "";
  let takeaway = "";

  if (apiKey) {
    try {
      const response = await baaChatFetch({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You create readable health history narratives for patients.

IMPORTANT RULES:
- Be purely DESCRIPTIVE - describe what happened, not what it means
- Never give advice, recommendations, or interpretations
- Never say results are "good" or "bad" or "concerning"
- Never suggest actions the patient should take
- Just narrate the sequence of events in plain language`,
            },
            {
              role: "user",
              content: `Create a brief narrative summary of this health timeline:
${JSON.stringify(events, null, 2)}

Respond in JSON:
{
  "summary": "2-3 paragraph narrative of what happened (descriptive only, no interpretations)",
  "takeaway": "One sentence summary of the time period (no advice)"
}`,
            },
          ],
          temperature: 0.4,
          max_tokens: 600,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary || "";
          takeaway = parsed.takeaway || "";
        }
      }
    } catch (error) {
      console.error("[TimelineStory] AI error:", error);
    }
  }

  if (!summary) {
    summary = `Over the past ${months} months, your health records show ${events.length} documented events. These include visits with healthcare providers, laboratory tests, and preventive care such as vaccinations.`;
    takeaway = `This timeline covers ${months} months of documented health events.`;
  }

  return {
    period: `Last ${months} months`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    summary,
    keyEvents: events,
    overallTakeaway: takeaway,
  };
}

// ============================================
// What Changed Since Last Time
// ============================================

export interface HealthChange {
  id: string;
  category: "medication" | "lab" | "diagnosis" | "vital" | "provider" | "document";
  type: "new" | "updated" | "resolved" | "discontinued";
  title: string;
  description: string;
  date: string;
  previousValue?: string;
  newValue?: string;
}

export interface ChangesSummary {
  lastVisitDate: string;
  daysSinceLastVisit: number;
  totalChanges: number;
  changes: HealthChange[];
  summary: string;
}

export async function getChangesSinceLastVisit(userId: string): Promise<ChangesSummary> {
  const lastVisitDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const daysSince = Math.floor((Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));

  const changes: HealthChange[] = [
    {
      id: "chg-1",
      category: "medication",
      type: "new",
      title: "New Medication: Lisinopril 10mg",
      description: "Blood pressure medication added to your records",
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "chg-2",
      category: "lab",
      type: "updated",
      title: "A1C Result",
      description: "New lab result recorded",
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      previousValue: "6.8%",
      newValue: "6.2%",
    },
    {
      id: "chg-3",
      category: "vital",
      type: "updated",
      title: "Blood Pressure Reading",
      description: "New vital signs recorded",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      previousValue: "145/92 mmHg",
      newValue: "128/84 mmHg",
    },
    {
      id: "chg-4",
      category: "document",
      type: "new",
      title: "New Lab Results Available",
      description: "Lipid panel results from Quest Diagnostics",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "chg-5",
      category: "provider",
      type: "new",
      title: "New Provider Added",
      description: "Dr. Chen (Cardiology) added to your care team",
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return {
    lastVisitDate: lastVisitDate.toISOString(),
    daysSinceLastVisit: daysSince,
    totalChanges: changes.length,
    changes,
    summary: `${changes.length} updates in your records since ${daysSince} days ago.`,
  };
}

// ============================================
// Smart Search
// ============================================

export interface SearchResult {
  id: string;
  type: "medication" | "lab" | "condition" | "document" | "provider" | "appointment" | "note";
  title: string;
  snippet: string;
  date: string;
  relevanceScore: number;
  highlights: string[];
}

export interface SmartSearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  suggestions: string[];
}

const searchableRecords = [
  { id: "rec-1", type: "medication", title: "Lisinopril 10mg", content: "Blood pressure medication ACE inhibitor daily tablet hypertension", date: "2024-01-15" },
  { id: "rec-2", type: "medication", title: "Metformin 500mg", content: "Diabetes medication blood sugar glucose twice daily tablet", date: "2023-06-10" },
  { id: "rec-3", type: "lab", title: "Complete Blood Count (CBC)", content: "White blood cells red blood cells hemoglobin hematocrit platelets", date: "2024-01-10" },
  { id: "rec-4", type: "lab", title: "Lipid Panel", content: "Cholesterol HDL LDL triglycerides cardiovascular heart", date: "2024-01-08" },
  { id: "rec-5", type: "lab", title: "Hemoglobin A1C", content: "Diabetes blood sugar glucose average three months", date: "2024-01-05" },
  { id: "rec-6", type: "condition", title: "Type 2 Diabetes Mellitus", content: "Diabetes blood sugar insulin metabolic", date: "2023-03-15" },
  { id: "rec-7", type: "condition", title: "Essential Hypertension", content: "High blood pressure cardiovascular", date: "2023-08-20" },
  { id: "rec-8", type: "document", title: "Annual Physical Exam Notes", content: "Routine checkup general health vital signs physical examination", date: "2024-01-12" },
  { id: "rec-9", type: "provider", title: "Dr. Sarah Martinez", content: "Primary care physician internal medicine family medicine", date: "2023-01-01" },
  { id: "rec-10", type: "appointment", title: "Follow-up Visit", content: "Blood pressure check medication review", date: "2024-02-15" },
  { id: "rec-11", type: "lab", title: "Basic Metabolic Panel", content: "Kidney function electrolytes sodium potassium glucose BUN creatinine", date: "2024-01-10" },
  { id: "rec-12", type: "note", title: "Cardiology Consultation", content: "Heart evaluation EKG echocardiogram Dr. Chen", date: "2024-01-18" },
];

export async function smartSearch(
  userId: string,
  query: string
): Promise<SmartSearchResponse> {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  // Score each record
  const scored = searchableRecords.map((record) => {
    const contentLower = `${record.title} ${record.content}`.toLowerCase();
    let score = 0;
    const highlights: string[] = [];

    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        score += 10;
        const words = `${record.title} ${record.content}`.split(/\s+/);
        for (const word of words) {
          if (word.toLowerCase().includes(term) && !highlights.includes(word)) {
            highlights.push(word);
          }
        }
      }
    }

    if (record.title.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    return {
      ...record,
      score,
      highlights,
    };
  });

  const results = scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      type: r.type as SearchResult["type"],
      title: r.title,
      snippet: r.content.slice(0, 100) + (r.content.length > 100 ? "..." : ""),
      date: r.date,
      relevanceScore: r.score,
      highlights: r.highlights.slice(0, 5),
    }));

  const suggestions: string[] = [];
  if (queryLower.includes("blood")) {
    suggestions.push("blood pressure", "blood sugar", "blood test");
  }
  if (queryLower.includes("med")) {
    suggestions.push("medication list", "medication history");
  }

  return {
    query,
    totalResults: results.length,
    results,
    suggestions: suggestions.slice(0, 3),
  };
}

// ============================================
// One-Page Snapshot Export
// ============================================

export interface SnapshotSection {
  title: string;
  items: Array<{
    label: string;
    value: string;
    date?: string;
  }>;
}

export interface OnePageSnapshot {
  generatedAt: string;
  patientName: string;
  dateOfBirth: string;
  sections: SnapshotSection[];
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  notes: string;
}

export async function generateOnePageSnapshot(userId: string): Promise<OnePageSnapshot> {
  return {
    generatedAt: new Date().toISOString(),
    patientName: "Sample Patient",
    dateOfBirth: "1965-03-15",
    sections: [
      {
        title: "Allergies",
        items: [
          { label: "Penicillin", value: "Severe - Anaphylaxis" },
          { label: "Sulfa Drugs", value: "Moderate - Rash" },
        ],
      },
      {
        title: "Current Medications",
        items: [
          { label: "Lisinopril", value: "10mg daily", date: "Started Jan 2024" },
          { label: "Metformin", value: "500mg twice daily", date: "Started Jun 2023" },
          { label: "Atorvastatin", value: "20mg daily", date: "Started Mar 2023" },
          { label: "Aspirin", value: "81mg daily", date: "Started Jan 2023" },
        ],
      },
      {
        title: "Active Conditions",
        items: [
          { label: "Type 2 Diabetes", value: "Documented", date: "2023" },
          { label: "Hypertension", value: "Documented", date: "2023" },
          { label: "Hyperlipidemia", value: "Documented", date: "2023" },
        ],
      },
      {
        title: "Recent Vitals",
        items: [
          { label: "Blood Pressure", value: "128/84 mmHg", date: "Jan 15, 2024" },
          { label: "Heart Rate", value: "72 bpm", date: "Jan 15, 2024" },
          { label: "Weight", value: "185 lbs", date: "Jan 15, 2024" },
          { label: "A1C", value: "6.2%", date: "Jan 10, 2024" },
        ],
      },
      {
        title: "Recent Labs",
        items: [
          { label: "Total Cholesterol", value: "195 mg/dL", date: "Jan 8, 2024" },
          { label: "LDL Cholesterol", value: "110 mg/dL", date: "Jan 8, 2024" },
          { label: "HDL Cholesterol", value: "52 mg/dL", date: "Jan 8, 2024" },
          { label: "Fasting Glucose", value: "108 mg/dL", date: "Jan 10, 2024" },
        ],
      },
      {
        title: "Care Team",
        items: [
          { label: "Primary Care", value: "Dr. Sarah Martinez" },
          { label: "Cardiology", value: "Dr. James Chen" },
          { label: "Pharmacy", value: "CVS Pharmacy - Main St" },
        ],
      },
    ],
    emergencyContacts: [
      { name: "Jane Doe", relationship: "Spouse", phone: "(555) 123-4567" },
      { name: "John Doe Jr.", relationship: "Son", phone: "(555) 987-6543" },
    ],
    notes: "Bring this summary to your appointments.",
  };
}
