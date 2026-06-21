import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface SearchSuggestion {
  text: string;
  type: "specialty" | "condition" | "symptom" | "provider_type";
  relevance: number;
  description?: string;
}

export interface SemanticSearchResult {
  interpretedQuery: string;
  suggestedSpecialties: string[];
  suggestedConditions: string[];
  searchTerms: string[];
  patientNeedsSummary: string;
}

const SPECIALTY_MAPPINGS: Record<string, string[]> = {
  family_medicine: ["general health", "primary care", "family doctor", "annual checkup", "wellness"],
  internal_medicine: ["adult medicine", "internist", "chronic conditions"],
  cardiology: ["heart", "cardiac", "chest pain", "blood pressure", "cholesterol", "heart attack", "arrhythmia"],
  dermatology: ["skin", "acne", "rash", "moles", "eczema", "psoriasis"],
  endocrinology: ["diabetes", "thyroid", "hormones", "metabolism"],
  gastroenterology: ["stomach", "digestive", "colon", "liver", "acid reflux", "ibs"],
  neurology: ["brain", "headache", "migraine", "seizure", "memory", "nerve", "stroke"],
  orthopedics: ["bones", "joints", "knee", "hip", "back pain", "sports injury", "fracture"],
  psychiatry: ["mental health", "depression", "anxiety", "adhd", "bipolar"],
  pediatrics: ["children", "kids", "infant", "teenager", "child health"],
  obstetrics_gynecology: ["pregnancy", "women's health", "gynecologist", "obgyn", "prenatal"],
  oncology: ["cancer", "tumor", "chemotherapy"],
  ophthalmology: ["eyes", "vision", "cataracts", "glaucoma"],
  pulmonology: ["lungs", "breathing", "asthma", "copd", "sleep apnea"],
  rheumatology: ["arthritis", "lupus", "joint pain", "autoimmune"],
  urology: ["urinary", "bladder", "kidney", "prostate"],
  allergy_immunology: ["allergies", "hay fever", "food allergy", "immunology"],
  emergency_medicine: ["emergency", "urgent", "trauma"],
  surgery_general: ["surgery", "surgical", "operation"],
  physical_therapy: ["rehab", "rehabilitation", "physical therapy", "pt", "recovery"],
};

const CONDITION_SPECIALTIES: Record<string, string[]> = {
  "high blood pressure": ["cardiology", "internal_medicine", "family_medicine"],
  "heart disease": ["cardiology"],
  diabetes: ["endocrinology", "internal_medicine", "family_medicine"],
  "back pain": ["orthopedics", "physical_therapy", "neurology"],
  headaches: ["neurology", "family_medicine"],
  depression: ["psychiatry", "family_medicine"],
  anxiety: ["psychiatry", "family_medicine"],
  "skin rash": ["dermatology"],
  "stomach issues": ["gastroenterology"],
  pregnancy: ["obstetrics_gynecology"],
  "joint pain": ["rheumatology", "orthopedics"],
  allergies: ["allergy_immunology"],
  "breathing problems": ["pulmonology"],
  "eye problems": ["ophthalmology"],
};

class AIProviderSearchService {
  async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    for (const [specialty, keywords] of Object.entries(SPECIALTY_MAPPINGS)) {
      const specialtyLabel = this.formatSpecialtyLabel(specialty);
      if (specialtyLabel.toLowerCase().includes(queryLower)) {
        suggestions.push({
          text: specialtyLabel,
          type: "specialty",
          relevance: 1.0,
          description: `Find ${specialtyLabel} specialists`,
        });
      }

      for (const keyword of keywords) {
        if (keyword.includes(queryLower) && !suggestions.find(s => s.text === specialtyLabel)) {
          suggestions.push({
            text: specialtyLabel,
            type: "specialty",
            relevance: 0.8,
            description: `Specialists for ${keyword}`,
          });
          break;
        }
      }
    }

    for (const condition of Object.keys(CONDITION_SPECIALTIES)) {
      if (condition.includes(queryLower)) {
        suggestions.push({
          text: condition.charAt(0).toUpperCase() + condition.slice(1),
          type: "condition",
          relevance: 0.9,
          description: `Find providers who treat ${condition}`,
        });
      }
    }

    const symptomSuggestions = this.getSymptomSuggestions(queryLower);
    suggestions.push(...symptomSuggestions);

    return suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8);
  }

  private getSymptomSuggestions(query: string): SearchSuggestion[] {
    const symptoms: Record<string, string> = {
      "chest pain": "Cardiology, Emergency Medicine",
      "shortness of breath": "Pulmonology, Cardiology",
      "numbness": "Neurology",
      "fatigue": "Internal Medicine, Endocrinology",
      "weight loss": "Internal Medicine, Endocrinology",
      "fever": "Family Medicine, Internal Medicine",
      "cough": "Pulmonology, Family Medicine",
      "dizziness": "Neurology, Cardiology",
    };

    const suggestions: SearchSuggestion[] = [];
    for (const [symptom, specialties] of Object.entries(symptoms)) {
      if (symptom.includes(query)) {
        suggestions.push({
          text: symptom.charAt(0).toUpperCase() + symptom.slice(1),
          type: "symptom",
          relevance: 0.85,
          description: `Recommended: ${specialties}`,
        });
      }
    }
    return suggestions;
  }

  async performSemanticSearch(query: string): Promise<SemanticSearchResult> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare search assistant. Analyze patient search queries and extract relevant medical specialties, conditions, and search terms.

Available specialties: ${Object.keys(SPECIALTY_MAPPINGS).join(", ")}

Respond with JSON only:
{
  "interpretedQuery": "plain language interpretation of what the patient is looking for",
  "suggestedSpecialties": ["specialty_id1", "specialty_id2"],
  "suggestedConditions": ["condition1", "condition2"],
  "searchTerms": ["term1", "term2"],
  "patientNeedsSummary": "brief summary of patient's likely healthcare needs"
}`,
          },
          {
            role: "user",
            content: `Patient search query: "${query}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.fallbackSemanticSearch(query);
      }

      return JSON.parse(content);
    } catch (error) {
      console.error("[AI Provider Search] Semantic search error:", error);
      return this.fallbackSemanticSearch(query);
    }
  }

  private fallbackSemanticSearch(query: string): SemanticSearchResult {
    const queryLower = query.toLowerCase();
    const suggestedSpecialties: string[] = [];

    for (const [specialty, keywords] of Object.entries(SPECIALTY_MAPPINGS)) {
      if (keywords.some(k => queryLower.includes(k)) || specialty.replace(/_/g, " ").includes(queryLower)) {
        suggestedSpecialties.push(specialty);
      }
    }

    for (const [condition, specialties] of Object.entries(CONDITION_SPECIALTIES)) {
      if (queryLower.includes(condition)) {
        suggestedSpecialties.push(...specialties);
      }
    }

    return {
      interpretedQuery: query,
      suggestedSpecialties: Array.from(new Set(suggestedSpecialties)).slice(0, 3),
      suggestedConditions: [],
      searchTerms: query.split(/\s+/).filter(t => t.length > 2),
      patientNeedsSummary: `Searching for providers related to: ${query}`,
    };
  }

  async getAutocompletions(partialQuery: string): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    const completions: string[] = [];
    const queryLower = partialQuery.toLowerCase();

    for (const specialty of Object.keys(SPECIALTY_MAPPINGS)) {
      const label = this.formatSpecialtyLabel(specialty);
      if (label.toLowerCase().startsWith(queryLower)) {
        completions.push(label);
      }
    }

    const commonSearches = [
      "Primary care doctor",
      "Family doctor near me",
      "Cardiologist",
      "Dermatologist",
      "Therapist for anxiety",
      "Orthopedic surgeon",
      "Pediatrician",
      "OB/GYN",
      "Neurologist",
      "Physical therapist",
    ];

    for (const search of commonSearches) {
      if (search.toLowerCase().includes(queryLower) && !completions.includes(search)) {
        completions.push(search);
      }
    }

    return completions.slice(0, 6);
  }

  private formatSpecialtyLabel(specialty: string): string {
    const labels: Record<string, string> = {
      family_medicine: "Family Medicine",
      internal_medicine: "Internal Medicine",
      cardiology: "Cardiology",
      dermatology: "Dermatology",
      endocrinology: "Endocrinology",
      gastroenterology: "Gastroenterology",
      neurology: "Neurology",
      orthopedics: "Orthopedics",
      psychiatry: "Psychiatry",
      pediatrics: "Pediatrics",
      obstetrics_gynecology: "OB/GYN",
      oncology: "Oncology",
      ophthalmology: "Ophthalmology",
      pulmonology: "Pulmonology",
      rheumatology: "Rheumatology",
      urology: "Urology",
      allergy_immunology: "Allergy & Immunology",
      emergency_medicine: "Emergency Medicine",
      surgery_general: "General Surgery",
      physical_therapy: "Physical Therapy",
    };
    return labels[specialty] || specialty.replace(/_/g, " ");
  }
}

export const aiProviderSearchService = new AIProviderSearchService();
