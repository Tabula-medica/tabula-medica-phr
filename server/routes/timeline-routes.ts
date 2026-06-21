import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

interface TimelineEvent {
  id: string;
  eventType: string;
  title: string;
  date: string;
  endDate?: string;
  provider?: string;
  facility?: string;
  source: "manual" | "fhir";
  sourceOrg?: string;
  sourceDate?: string;
  details?: Record<string, unknown>;
  loincCode?: string;
  value?: string;
  unit?: string;
  status?: string;
  episodeId?: string;
}

interface Episode {
  id: string;
  name: string;
  type: "cancer" | "pregnancy" | "surgery" | "chronic" | "acute";
  startDate: string;
  endDate?: string;
  events: TimelineEvent[];
  isActive: boolean;
}

// Generate mock timeline events for sample
function generateMockEvents(zoom: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  
  const eventTypes = ["encounter", "lab_result", "medication", "imaging", "procedure", "immunization", "condition"];
  const facilities = ["Metro Health Center", "City General Hospital", "Community Clinic", "University Medical"];
  const providers = ["Dr. Smith", "Dr. Johnson", "Dr. Williams", "Dr. Brown"];
  
  const count = zoom === "day" ? 5 : zoom === "month" ? 20 : zoom === "year" ? 50 : 100;
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() - daysAgo);
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const facility = facilities[Math.floor(Math.random() * facilities.length)];
    const provider = providers[Math.floor(Math.random() * providers.length)];
    
    let title = "";
    let value: string | undefined;
    let unit: string | undefined;
    let loincCode: string | undefined;
    
    switch (eventType) {
      case "encounter":
        title = ["Annual Wellness Visit", "Follow-up Appointment", "Urgent Care Visit", "Telehealth Consult"][Math.floor(Math.random() * 4)];
        break;
      case "lab_result":
        const labs = [
          { name: "Complete Blood Count", code: "58410-2", val: "Normal" },
          { name: "HbA1c", code: "4548-4", val: `${(5 + Math.random() * 3).toFixed(1)}%` },
          { name: "Lipid Panel", code: "57698-3", val: "Normal" },
          { name: "TSH", code: "3016-3", val: `${(1 + Math.random() * 3).toFixed(2)} mIU/L` },
        ];
        const lab = labs[Math.floor(Math.random() * labs.length)];
        title = lab.name;
        loincCode = lab.code;
        value = lab.val;
        break;
      case "medication":
        title = ["Metformin 500mg", "Lisinopril 10mg", "Atorvastatin 20mg", "Omeprazole 20mg"][Math.floor(Math.random() * 4)];
        break;
      case "imaging":
        title = ["Chest X-Ray", "CT Scan Abdomen", "MRI Brain", "Ultrasound"][Math.floor(Math.random() * 4)];
        break;
      case "procedure":
        title = ["Blood Pressure Check", "Flu Shot", "ECG", "Colonoscopy"][Math.floor(Math.random() * 4)];
        break;
      case "immunization":
        title = ["COVID-19 Booster", "Influenza Vaccine", "Tetanus (Tdap)", "Pneumococcal"][Math.floor(Math.random() * 4)];
        break;
      case "condition":
        title = ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia", "GERD"][Math.floor(Math.random() * 4)];
        break;
    }
    
    events.push({
      id: uuidv4(),
      eventType,
      title,
      date: eventDate.toISOString().split("T")[0],
      provider,
      facility,
      source: Math.random() > 0.3 ? "fhir" : "manual",
      sourceOrg: facility,
      sourceDate: new Date(eventDate.getTime() + 86400000).toISOString(),
      loincCode,
      value,
      unit,
      status: eventType === "condition" ? "active" : undefined,
    });
  }
  
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function generateMockEpisodes(): Episode[] {
  const episodes: Episode[] = [
    {
      id: uuidv4(),
      name: "Type 2 Diabetes Management",
      type: "chronic",
      startDate: "2020-03-15",
      isActive: true,
      events: [
        {
          id: uuidv4(),
          eventType: "condition",
          title: "Type 2 Diabetes Diagnosed",
          date: "2020-03-15",
          facility: "Metro Health Center",
          provider: "Dr. Smith",
          source: "fhir",
          sourceOrg: "Metro Health Center",
          status: "active",
        },
        {
          id: uuidv4(),
          eventType: "medication",
          title: "Metformin 500mg Started",
          date: "2020-03-15",
          facility: "Metro Health Center",
          provider: "Dr. Smith",
          source: "fhir",
          sourceOrg: "Metro Health Center",
        },
        {
          id: uuidv4(),
          eventType: "lab_result",
          title: "HbA1c",
          date: "2024-01-15",
          facility: "Metro Health Center",
          source: "fhir",
          sourceOrg: "Metro Health Center",
          loincCode: "4548-4",
          value: "6.8%",
        },
      ],
    },
    {
      id: uuidv4(),
      name: "Knee Replacement Surgery",
      type: "surgery",
      startDate: "2023-06-01",
      endDate: "2023-09-15",
      isActive: false,
      events: [
        {
          id: uuidv4(),
          eventType: "encounter",
          title: "Pre-operative Consultation",
          date: "2023-06-01",
          facility: "City Orthopedic Center",
          provider: "Dr. Williams",
          source: "fhir",
          sourceOrg: "City Orthopedic",
        },
        {
          id: uuidv4(),
          eventType: "procedure",
          title: "Total Knee Arthroplasty",
          date: "2023-06-15",
          facility: "City Orthopedic Center",
          provider: "Dr. Williams",
          source: "fhir",
          sourceOrg: "City Orthopedic",
        },
        {
          id: uuidv4(),
          eventType: "encounter",
          title: "Physical Therapy Session",
          date: "2023-07-01",
          facility: "Rehab Center",
          source: "fhir",
          sourceOrg: "Rehab Center",
        },
      ],
    },
  ];
  
  return episodes;
}

router.get("/events", (req: Request, res: Response) => {
  try {
    const { zoom = "month" } = req.query;
    const events = generateMockEvents(zoom as string);
    
    res.json(events);
  } catch (error: any) {
    console.error("[Timeline] Error fetching events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch timeline events" });
  }
});

router.get("/episodes", (req: Request, res: Response) => {
  try {
    const episodes = generateMockEpisodes();
    res.json(episodes);
  } catch (error: any) {
    console.error("[Timeline] Error fetching episodes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch episodes" });
  }
});

export default router;
