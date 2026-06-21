import { Router } from "express";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import {
  SupportResource,
  SupportResourceCategory,
  AIResourceSuggestion,
  insertSupportResourceSchema,
  supportResourceCategories,
} from "@shared/schema";

const router = Router();

const resourcesStore: Map<string, SupportResource> = new Map();

let sampleDataInitialized = false;

function initializeSampleData() {
  if (sampleDataInitialized) return;
  sampleDataInitialized = true;

  const now = new Date().toISOString();

  const sampleResources: Omit<SupportResource, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "American Cancer Society",
      description: "Provides information, support programs, and resources for patients and families affected by cancer. Offers 24/7 helpline, patient lodging, and transportation assistance.",
      category: "advocacy_groups",
      url: "https://www.cancer.org",
      phone: "1-800-227-2345",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "skin", "lymphoma", "leukemia"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-15",
      rating: 4.8,
      tags: ["national", "comprehensive", "support", "education"],
    },
    {
      name: "CancerCare",
      description: "Free professional support services for anyone affected by cancer, including counseling, support groups, educational workshops, and financial assistance.",
      category: "mental_health",
      url: "https://www.cancercare.org",
      phone: "1-800-813-4673",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "pancreatic", "ovarian"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-10",
      rating: 4.7,
      tags: ["counseling", "support-groups", "financial", "free"],
    },
    {
      name: "Patient Advocate Foundation",
      description: "Provides case management services and financial aid to patients with chronic, life-threatening, and debilitating conditions. Helps navigate insurance and access to care.",
      category: "financial_assistance",
      url: "https://www.patientadvocate.org",
      phone: "1-800-532-5274",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "lymphoma"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English"],
      isVerified: true,
      lastVerified: "2026-01-12",
      rating: 4.6,
      tags: ["insurance", "copay", "case-management", "navigation"],
    },
    {
      name: "National Cancer Institute",
      description: "Comprehensive cancer information from the U.S. government. Includes treatment options, clinical trials, research updates, and educational materials.",
      category: "educational_materials",
      url: "https://www.cancer.gov",
      phone: "1-800-422-6237",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "skin", "lymphoma", "leukemia", "pancreatic", "ovarian"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-18",
      rating: 4.9,
      tags: ["research", "clinical-trials", "treatment", "government"],
    },
    {
      name: "Family Caregiver Alliance",
      description: "Support and resources for family caregivers. Provides education, services, and advocacy to help caregivers manage their responsibilities.",
      category: "caregiver_support",
      url: "https://www.caregiver.org",
      phone: "1-800-445-8106",
      cancerTypes: ["breast", "lung", "colorectal", "prostate"],
      stages: ["II", "III", "IV"],
      languages: ["English", "Spanish", "Chinese"],
      isVerified: true,
      lastVerified: "2026-01-08",
      rating: 4.5,
      tags: ["caregiver", "family", "respite", "education"],
    },
    {
      name: "Cancer Support Community",
      description: "Global network offering support groups, education, and healthy lifestyle programs. Provides both in-person and online resources.",
      category: "community_forums",
      url: "https://www.cancersupportcommunity.org",
      phone: "1-888-793-9355",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "ovarian", "pancreatic"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-14",
      rating: 4.7,
      tags: ["support-groups", "online", "local", "lifestyle"],
    },
    {
      name: "ClinicalTrials.gov",
      description: "Database of clinical trials conducted around the world. Search for studies by condition, location, and trial status.",
      category: "clinical_trials",
      url: "https://clinicaltrials.gov",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "skin", "lymphoma", "leukemia", "pancreatic", "ovarian"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English"],
      isVerified: true,
      lastVerified: "2026-01-19",
      rating: 4.8,
      tags: ["research", "trials", "experimental", "government"],
    },
    {
      name: "Oncology Nutrition",
      description: "Evidence-based nutrition information for cancer patients. Provides dietary guidelines, recipes, and information about managing eating difficulties during treatment.",
      category: "nutritional_support",
      url: "https://www.oncologynutrition.org",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "pancreatic", "ovarian"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English"],
      isVerified: true,
      lastVerified: "2026-01-11",
      rating: 4.4,
      tags: ["nutrition", "diet", "recipes", "side-effects"],
    },
    {
      name: "Livestrong Foundation",
      description: "Free navigation support services for cancer survivors and caregivers. Helps with financial, emotional, and practical challenges.",
      category: "advocacy_groups",
      url: "https://www.livestrong.org",
      phone: "1-855-220-7777",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "testicular"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-13",
      rating: 4.6,
      tags: ["survivorship", "navigation", "fertility", "young-adults"],
    },
    {
      name: "Good Days Foundation",
      description: "Financial assistance for medication copays and health insurance premiums. Helps patients afford their prescribed treatments.",
      category: "financial_assistance",
      url: "https://www.mygooddays.org",
      phone: "1-877-968-7233",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "lymphoma", "leukemia"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English", "Spanish"],
      isVerified: true,
      lastVerified: "2026-01-16",
      rating: 4.5,
      tags: ["copay", "insurance", "medication", "financial-aid"],
    },
    {
      name: "Imerman Angels",
      description: "One-on-one cancer support. Connects patients and caregivers with mentor angels who have faced the same type of cancer.",
      category: "mental_health",
      url: "https://imermanangels.org",
      phone: "1-866-463-7626",
      cancerTypes: ["breast", "lung", "colorectal", "prostate", "lymphoma", "leukemia", "pancreatic"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English"],
      isVerified: true,
      lastVerified: "2026-01-09",
      rating: 4.8,
      tags: ["mentorship", "peer-support", "one-on-one", "survivors"],
    },
    {
      name: "Stupid Cancer",
      description: "Support community for young adults affected by cancer (ages 15-39). Offers online support, events, and advocacy resources.",
      category: "community_forums",
      url: "https://stupidcancer.org",
      cancerTypes: ["breast", "lymphoma", "leukemia", "testicular", "thyroid", "brain"],
      stages: ["I", "II", "III", "IV"],
      languages: ["English"],
      isVerified: true,
      lastVerified: "2026-01-17",
      rating: 4.6,
      tags: ["young-adults", "aya", "community", "events"],
    },
  ];

  sampleResources.forEach((resource) => {
    const id = randomUUID();
    resourcesStore.set(id, {
      ...resource,
      id,
      createdAt: now,
      updatedAt: now,
    });
  });

  console.log("[SupportResources] Initialized with", sampleResources.length, "sample resources");
}

router.get("/api/support-resources", (req, res) => {
  initializeSampleData();

  const { category, cancerType, stage, search } = req.query;

  let resources = Array.from(resourcesStore.values());

  if (category && typeof category === "string") {
    resources = resources.filter((r) => r.category === category);
  }

  if (cancerType && typeof cancerType === "string") {
    resources = resources.filter(
      (r) => !r.cancerTypes || r.cancerTypes.includes(cancerType.toLowerCase())
    );
  }

  if (stage && typeof stage === "string") {
    resources = resources.filter(
      (r) => !r.stages || r.stages.includes(stage.toUpperCase())
    );
  }

  if (search && typeof search === "string") {
    const searchLower = search.toLowerCase();
    resources = resources.filter(
      (r) =>
        r.name.toLowerCase().includes(searchLower) ||
        r.description.toLowerCase().includes(searchLower) ||
        r.tags.some((t) => t.toLowerCase().includes(searchLower))
    );
  }

  resources.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  res.json({
    resources,
    total: resources.length,
    categories: supportResourceCategories,
  });
});

router.get("/api/support-resources/categories", (req, res) => {
  initializeSampleData();

  const categoryCounts: Record<string, number> = {};
  supportResourceCategories.forEach((cat) => {
    categoryCounts[cat] = 0;
  });

  Array.from(resourcesStore.values()).forEach((r) => {
    categoryCounts[r.category]++;
  });

  const categories = supportResourceCategories.map((cat) => ({
    id: cat,
    name: cat
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    count: categoryCounts[cat],
    icon: getCategoryIcon(cat),
  }));

  res.json({ categories });
});

function getCategoryIcon(category: SupportResourceCategory): string {
  const icons: Record<SupportResourceCategory, string> = {
    advocacy_groups: "Users",
    mental_health: "Heart",
    financial_assistance: "DollarSign",
    educational_materials: "BookOpen",
    caregiver_support: "HandHeart",
    community_forums: "MessageCircle",
    clinical_trials: "FlaskConical",
    nutritional_support: "Apple",
  };
  return icons[category] || "HelpCircle";
}

router.get("/api/support-resources/:id", (req, res) => {
  initializeSampleData();

  const resource = resourcesStore.get(req.params.id);
  if (!resource) {
    return res.status(404).json({ error: "Resource not found" });
  }

  res.json(resource);
});

router.post("/api/support-resources/ai-suggestions", async (req, res) => {
  initializeSampleData();

  const { cancerType, stage, symptoms, lateEffects, profileId } = req.body;

  const resources = Array.from(resourcesStore.values());

  let openai: OpenAI | null = null;
  try {
    openai = new OpenAI();
  } catch {
    openai = null;
  }

  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const relevantResources = resources.filter((r) => {
        if (cancerType && r.cancerTypes && !r.cancerTypes.includes(cancerType.toLowerCase())) {
          return false;
        }
        if (stage && r.stages && !r.stages.includes(stage.toUpperCase())) {
          return false;
        }
        return true;
      });

      const prompt = `You are a healthcare information categorization assistant. Match resources to categories based on topic area only.

Filter Criteria:
- Cancer Type: ${cancerType || "Not specified"}
- Stage: ${stage || "Not specified"}
- Topic Areas: ${symptoms?.join(", ") || "None specified"}, ${lateEffects?.join(", ") || "None specified"}

Available Resources:
${relevantResources.map((r) => `- ${r.name} (${r.category}): ${r.description}`).join("\n")}

CRITICAL RULES - STRICTLY NO CLINICAL DECISION SUPPORT:
- Do NOT evaluate patient health status
- Do NOT suggest what resources are "best" or "most appropriate" for the patient
- Do NOT provide any clinical recommendations or guidance
- Only describe what category each resource belongs to and what topics it covers
- Use purely descriptive, factual language

For each resource, provide:
1. The resource name (must match exactly)
2. A brief factual description of what the resource covers (1-2 sentences, NO recommendations)
3. A category match score from 0.0 to 1.0 based on topic overlap only

Respond in JSON format:
{
  "suggestions": [
    {"resourceName": "...", "reason": "This resource covers [topic area] and provides information about [subject].", "score": 0.9}
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const suggestions: AIResourceSuggestion[] = [];

        for (const suggestion of parsed.suggestions || []) {
          const resource = relevantResources.find(
            (r) => r.name.toLowerCase() === suggestion.resourceName.toLowerCase()
          );
          if (resource) {
            suggestions.push({
              id: randomUUID(),
              resourceId: resource.id,
              resource,
              reason: suggestion.reason,
              relevanceScore: suggestion.score,
              basedOn: { cancerType, stage, symptoms, lateEffects },
              suggestedAt: new Date().toISOString(),
            });
          }
        }

        suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return res.json({
          suggestions: suggestions.slice(0, 5),
          aiGenerated: true,
          disclaimer: "NOT medical advice. These resources are displayed for informational purposes only. This tool does not evaluate your health or provide clinical recommendations. Consult your healthcare provider for medical guidance.",
        });
      }
    } catch (error) {
      console.error("[SupportResources] AI suggestion error:", error);
    }
  }

  const fallbackSuggestions: AIResourceSuggestion[] = [];
  
  if (symptoms && symptoms.length > 0) {
    const mentalHealthResources = resources.filter((r) => r.category === "mental_health");
    mentalHealthResources.slice(0, 2).forEach((r) => {
      fallbackSuggestions.push({
        id: randomUUID(),
        resourceId: r.id,
        resource: r,
        reason: "This resource is categorized under mental health support services.",
        relevanceScore: 0.8,
        basedOn: { cancerType, stage, symptoms, lateEffects },
        suggestedAt: new Date().toISOString(),
      });
    });
  }

  if (cancerType) {
    const educationalResources = resources.filter(
      (r) =>
        r.category === "educational_materials" &&
        (!r.cancerTypes || r.cancerTypes.includes(cancerType.toLowerCase()))
    );
    educationalResources.slice(0, 2).forEach((r) => {
      fallbackSuggestions.push({
        id: randomUUID(),
        resourceId: r.id,
        resource: r,
        reason: `This resource provides educational information about ${cancerType} cancer.`,
        relevanceScore: 0.75,
        basedOn: { cancerType, stage, symptoms, lateEffects },
        suggestedAt: new Date().toISOString(),
      });
    });
  }

  const advocacyResources = resources.filter((r) => r.category === "advocacy_groups");
  advocacyResources.slice(0, 1).forEach((r) => {
    fallbackSuggestions.push({
      id: randomUUID(),
      resourceId: r.id,
      resource: r,
      reason: "This organization provides patient advocacy and support programs.",
      relevanceScore: 0.7,
      basedOn: { cancerType, stage, symptoms, lateEffects },
      suggestedAt: new Date().toISOString(),
    });
  });

  res.json({
    suggestions: fallbackSuggestions.slice(0, 5),
    aiGenerated: false,
    disclaimer: "NOT medical advice. These resources are displayed for informational purposes only. This tool does not evaluate your health or provide clinical recommendations. Consult your healthcare provider for medical guidance.",
  });
});

router.post("/api/support-resources", (req, res) => {
  initializeSampleData();

  const parseResult = insertSupportResourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const resource: SupportResource = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  resourcesStore.set(id, resource);
  res.status(201).json(resource);
});

export { router as supportResourcesRoutes };
