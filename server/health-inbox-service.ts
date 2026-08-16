import { generatePhiSafeText } from "./services/ai-gateway";

export interface InboxItem {
  id: string;
  patientId: string;
  type: "lab_result" | "imaging" | "medication" | "visit_summary" | "message" | "document" | "immunization" | "referral";
  title: string;
  summary: string;
  source: string;
  receivedAt: string;
  isRead: boolean;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  notes: string | null;
  episodeId: string | null;
  metadata: Record<string, any>;
}

export interface Episode {
  id: string;
  patientId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  itemIds: string[];
  suggestedByAI: boolean;
  createdAt: string;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

const mockInboxItems: InboxItem[] = [
  {
    id: "inbox-1",
    patientId: "patient-default",
    type: "lab_result",
    title: "Complete Blood Count (CBC)",
    summary: "Routine CBC results - all values within normal range",
    source: "Memorial General Hospital Lab",
    receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    isPinned: false,
    isArchived: false,
    tags: ["routine", "blood work"],
    notes: null,
    episodeId: "episode-1",
    metadata: { orderedBy: "Dr. Smith", priority: "routine" },
  },
  {
    id: "inbox-2",
    patientId: "patient-default",
    type: "visit_summary",
    title: "Annual Physical Exam",
    summary: "Comprehensive annual wellness visit with Dr. Chen",
    source: "Primary Care Associates",
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    isPinned: true,
    isArchived: false,
    tags: ["annual", "wellness"],
    notes: "Remember to schedule follow-up in 6 months",
    episodeId: "episode-1",
    metadata: { provider: "Dr. Sarah Chen", visitType: "wellness" },
  },
  {
    id: "inbox-3",
    patientId: "patient-default",
    type: "imaging",
    title: "Chest X-Ray Results",
    summary: "Routine chest x-ray - no acute abnormalities",
    source: "Radiology Partners",
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isPinned: false,
    isArchived: false,
    tags: ["imaging", "chest"],
    notes: null,
    episodeId: "episode-1",
    metadata: { modality: "X-Ray", bodyPart: "Chest" },
  },
  {
    id: "inbox-4",
    patientId: "patient-default",
    type: "medication",
    title: "Prescription Filled: Lisinopril 10mg",
    summary: "Your prescription for Lisinopril has been filled and is ready for pickup",
    source: "CVS Pharmacy",
    receivedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isPinned: false,
    isArchived: false,
    tags: ["prescription", "blood pressure"],
    notes: null,
    episodeId: null,
    metadata: { medication: "Lisinopril", dose: "10mg", pharmacy: "CVS" },
  },
  {
    id: "inbox-5",
    patientId: "patient-default",
    type: "visit_summary",
    title: "Urgent Care Visit - Ankle Sprain",
    summary: "Treated for Grade 1 ankle sprain after fall",
    source: "CityMed Urgent Care",
    receivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isPinned: false,
    isArchived: false,
    tags: ["urgent care", "injury"],
    notes: "This was from my hiking trip",
    episodeId: "episode-2",
    metadata: { provider: "Dr. Martinez", visitType: "urgent" },
  },
  {
    id: "inbox-6",
    patientId: "patient-default",
    type: "imaging",
    title: "Ankle X-Ray Results",
    summary: "Right ankle x-ray - no fracture identified",
    source: "CityMed Urgent Care",
    receivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isPinned: false,
    isArchived: false,
    tags: ["imaging", "ankle", "injury"],
    notes: null,
    episodeId: "episode-2",
    metadata: { modality: "X-Ray", bodyPart: "Ankle" },
  },
  {
    id: "inbox-7",
    patientId: "patient-default",
    type: "referral",
    title: "Physical Therapy Referral",
    summary: "Referral to PT for ankle rehabilitation",
    source: "CityMed Urgent Care",
    receivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    isPinned: false,
    isArchived: false,
    tags: ["referral", "physical therapy"],
    notes: null,
    episodeId: "episode-2",
    metadata: { referralTo: "Active Recovery PT", reason: "Ankle sprain rehab" },
  },
  {
    id: "inbox-8",
    patientId: "patient-default",
    type: "immunization",
    title: "Flu Vaccine Administered",
    summary: "Seasonal influenza vaccine 2024-2025",
    source: "Walgreens Pharmacy",
    receivedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isPinned: false,
    isArchived: true,
    tags: ["vaccine", "flu"],
    notes: null,
    episodeId: null,
    metadata: { vaccine: "Influenza", manufacturer: "Sanofi" },
  },
];

const mockEpisodes: Episode[] = [
  {
    id: "episode-1",
    patientId: "patient-default",
    title: "Annual Wellness Visit",
    description: "Routine annual physical and associated lab work",
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    itemIds: ["inbox-1", "inbox-2", "inbox-3"],
    suggestedByAI: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "episode-2",
    patientId: "patient-default",
    title: "Ankle Injury",
    description: "Urgent care visit and follow-up for ankle sprain",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: null,
    itemIds: ["inbox-5", "inbox-6", "inbox-7"],
    suggestedByAI: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

let inboxItems = [...mockInboxItems];
let episodes = [...mockEpisodes];

export async function getInboxItems(
  patientId: string,
  options: { showArchived?: boolean; filter?: string } = {}
): Promise<InboxItem[]> {
  let items = inboxItems.filter(i => i.patientId === patientId);
  
  if (!options.showArchived) {
    items = items.filter(i => !i.isArchived);
  }
  
  if (options.filter === "unread") {
    items = items.filter(i => !i.isRead);
  } else if (options.filter === "pinned") {
    items = items.filter(i => i.isPinned);
  }
  
  return items.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });
}

export async function getEpisodes(patientId: string): Promise<Episode[]> {
  return episodes.filter(e => e.patientId === patientId);
}

export async function updateInboxItem(
  itemId: string,
  patientId: string,
  updates: Partial<Pick<InboxItem, "isRead" | "isPinned" | "isArchived" | "tags" | "notes" | "episodeId">>
): Promise<InboxItem | null> {
  const index = inboxItems.findIndex(i => i.id === itemId && i.patientId === patientId);
  if (index === -1) return null;
  
  inboxItems[index] = { ...inboxItems[index], ...updates };
  return inboxItems[index];
}

export async function suggestTags(
  itemId: string,
  patientId: string
): Promise<TagSuggestion[]> {
  const item = inboxItems.find(i => i.id === itemId && i.patientId === patientId);
  if (!item) return [];

  try {
    const content = await generatePhiSafeText({
      system: "You suggest helpful tags for health record items. Return 3-5 relevant, concise tags that would help organize this record. Tags should be lowercase, 1-3 words max.",
      user: `Suggest tags for this health record item:
Type: ${item.type}
Title: ${item.title}
Summary: ${item.summary}
Source: ${item.source}

Current tags: ${item.tags.join(", ") || "none"}

Return JSON array: [{"tag": "tag name", "confidence": 0.9, "reason": "why this tag"}]`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const result = JSON.parse(content || "{}");
    return result.suggestions || result.tags || [];
  } catch (error) {
    console.error("[HealthInbox] Tag suggestion error:", error);
    return [
      { tag: item.type.replace("_", " "), confidence: 0.8, reason: "Based on record type" },
    ];
  }
}

export async function suggestEpisodeGrouping(
  patientId: string
): Promise<{ episodes: Episode[]; suggestions: string[] }> {
  const items = await getInboxItems(patientId, { showArchived: false });
  const ungroupedItems = items.filter(i => !i.episodeId);

  if (ungroupedItems.length === 0) {
    return { episodes: await getEpisodes(patientId), suggestions: [] };
  }

  try {
    const content = await generatePhiSafeText({
      system: `You analyze health records to identify "episodes" - related items that belong together.
An episode might be:
- A hospital stay with all related tests and follow-ups
- An injury and its treatment/recovery
- A chronic condition management period
- A routine checkup with associated lab work

Group items that are clearly related. Be conservative - only group items with clear connections.`,
      user: `Analyze these ungrouped health record items and suggest episode groupings:

${ungroupedItems.map(i => `- ID: ${i.id}, Type: ${i.type}, Title: ${i.title}, Date: ${i.receivedAt}, Summary: ${i.summary}`).join("\n")}

Return JSON: {"episodes": [{"title": "Episode Name", "itemIds": ["id1", "id2"], "description": "why grouped"}], "suggestions": ["suggestion about records"]}`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const result = JSON.parse(content || "{}");
    
    const existingEpisodes = await getEpisodes(patientId);
    
    return {
      episodes: existingEpisodes,
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error("[HealthInbox] Episode suggestion error:", error);
    return { episodes: await getEpisodes(patientId), suggestions: [] };
  }
}

export async function getInboxStats(patientId: string): Promise<{
  total: number;
  unread: number;
  pinned: number;
  archived: number;
  episodeCount: number;
}> {
  const items = inboxItems.filter(i => i.patientId === patientId);
  const patientEpisodes = episodes.filter(e => e.patientId === patientId);
  
  return {
    total: items.filter(i => !i.isArchived).length,
    unread: items.filter(i => !i.isRead && !i.isArchived).length,
    pinned: items.filter(i => i.isPinned && !i.isArchived).length,
    archived: items.filter(i => i.isArchived).length,
    episodeCount: patientEpisodes.length,
  };
}
