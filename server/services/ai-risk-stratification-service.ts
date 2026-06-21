import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface RiskFactorData {
  demographics: {
    age: number;
    gender: string;
  };
  conditions: Array<{
    name: string;
    code?: string;
    status: string;
  }>;
  medications: Array<{
    name: string;
    status: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
  }>;
  labResults: Array<{
    name: string;
    value: number;
    unit: string;
    abnormal?: boolean;
  }>;
  socialHistory?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseLevel?: string;
  };
  encounters: Array<{
    type: string;
    date: string;
  }>;
}

export interface RiskCategory {
  category: string;
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'very-high';
  factors: string[];
  description: string;
}

export interface RiskStratificationResult {
  patientId: string;
  overallRiskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  overallScore: number;
  categories: RiskCategory[];
  documentedRiskFactors: string[];
  protectiveFactors: string[];
  dataQualityNotes: string[];
  generatedAt: string;
  disclaimer: string;
}

const RISK_CACHE = new Map<string, { result: RiskStratificationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class AIRiskStratificationService {
  async stratifyPatientRisk(patientId: string, data: RiskFactorData): Promise<RiskStratificationResult> {
    const cacheKey = `risk-${patientId}`;
    const cached = RISK_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return this.generateRuleBasedRisk(patientId, data);
      }
      
      const prompt = this.buildRiskPrompt(data);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation analyst that identifies documented risk factors in patient records. 

CRITICAL COMPLIANCE REQUIREMENTS:
- You are STRICTLY PROHIBITED from providing clinical decision support, treatment recommendations, or medical advice
- All outputs are INFORMATIONAL ONLY for documentation review
- You identify and organize DOCUMENTED risk factors - you do NOT diagnose or predict outcomes
- Never suggest specific interventions or care plan changes
- Focus on presenting what is documented in the medical record
- Risk scores are based solely on presence of documented factors, not clinical judgment

Your role is to help organize documented health information by categorizing known risk factors for review purposes only. This is NOT predictive analytics - it is documentation organization.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.generateRuleBasedRisk(patientId, data);
      }

      const parsed = JSON.parse(content);
      const result = this.parseAIResponse(patientId, parsed, data);
      
      RISK_CACHE.set(cacheKey, { result, timestamp: Date.now() });
      return result;

    } catch (error) {
      console.error("AI risk stratification failed:", error);
      return this.generateRuleBasedRisk(patientId, data);
    }
  }

  private buildRiskPrompt(data: RiskFactorData): string {
    return `Analyze the following documented patient information and identify documented risk factors. This is for DOCUMENTATION ORGANIZATION ONLY - do NOT provide predictions, recommendations, or medical advice.

Patient Information:
- Age: ${data.demographics.age}, Gender: ${data.demographics.gender}
- Documented Conditions: ${JSON.stringify(data.conditions)}
- Current Medications: ${JSON.stringify(data.medications)}
- Recent Vitals: ${JSON.stringify(data.vitals.slice(0, 10))}
- Recent Labs: ${JSON.stringify(data.labResults.slice(0, 10))}
- Social History: ${JSON.stringify(data.socialHistory || {})}
- Recent Encounters: ${data.encounters.length} in record

Return JSON with documented risk factor organization:
{
  "categories": [
    {
      "category": "Cardiovascular",
      "score": 0-100 based on number of documented factors,
      "level": "low|moderate|high|very-high",
      "factors": ["List of DOCUMENTED factors only"],
      "description": "Summary of documented cardiovascular-related information"
    }
  ],
  "documentedRiskFactors": ["All documented risk factors found in records"],
  "protectiveFactors": ["Any documented protective factors"],
  "dataQualityNotes": ["Notes about missing or incomplete documentation"]
}

Categories to assess: Cardiovascular, Metabolic, Respiratory, Fall Risk, Medication-Related, Hospital Readmission.
Base scores ONLY on presence of documented factors. Do not infer or predict.`;
  }

  private parseAIResponse(patientId: string, parsed: any, data: RiskFactorData): RiskStratificationResult {
    const categories: RiskCategory[] = (parsed.categories || []).map((cat: any) => ({
      category: cat.category || 'Unknown',
      score: Math.min(100, Math.max(0, cat.score || 0)),
      level: this.scoreToLevel(cat.score || 0),
      factors: cat.factors || [],
      description: cat.description || ''
    }));

    const avgScore = categories.length > 0 
      ? categories.reduce((sum, c) => sum + c.score, 0) / categories.length 
      : 0;

    return {
      patientId,
      overallRiskLevel: this.scoreToLevel(avgScore),
      overallScore: Math.round(avgScore),
      categories,
      documentedRiskFactors: parsed.documentedRiskFactors || [],
      protectiveFactors: parsed.protectiveFactors || [],
      dataQualityNotes: parsed.dataQualityNotes || [],
      generatedAt: new Date().toISOString(),
      disclaimer: "INFORMATIONAL ONLY: This risk organization is based solely on documented information and does not constitute clinical risk prediction or medical advice. Risk scores reflect the presence of documented factors only. All clinical decisions must be made by qualified healthcare providers based on complete patient evaluation."
    };
  }

  private scoreToLevel(score: number): 'low' | 'moderate' | 'high' | 'very-high' {
    if (score < 25) return 'low';
    if (score < 50) return 'moderate';
    if (score < 75) return 'high';
    return 'very-high';
  }

  private generateRuleBasedRisk(patientId: string, data: RiskFactorData): RiskStratificationResult {
    const categories: RiskCategory[] = [];

    // Cardiovascular risk based on documented factors
    const cvFactors: string[] = [];
    if (data.demographics.age >= 65) cvFactors.push("Age 65 or older");
    if (data.conditions.some(c => c.name.toLowerCase().includes('hypertension'))) 
      cvFactors.push("Documented hypertension");
    if (data.conditions.some(c => c.name.toLowerCase().includes('diabetes'))) 
      cvFactors.push("Documented diabetes");
    if (data.socialHistory?.smokingStatus === 'current') 
      cvFactors.push("Current smoker documented");
    
    const cvScore = Math.min(100, cvFactors.length * 20);
    categories.push({
      category: "Cardiovascular",
      score: cvScore,
      level: this.scoreToLevel(cvScore),
      factors: cvFactors,
      description: `${cvFactors.length} cardiovascular-related factor(s) documented in patient record.`
    });

    // Metabolic risk
    const metFactors: string[] = [];
    if (data.conditions.some(c => c.name.toLowerCase().includes('diabetes'))) 
      metFactors.push("Documented diabetes");
    if (data.conditions.some(c => c.name.toLowerCase().includes('obesity'))) 
      metFactors.push("Documented obesity");
    if (data.labResults.some(l => l.name.toLowerCase().includes('glucose') && l.abnormal)) 
      metFactors.push("Abnormal glucose documented");
    if (data.labResults.some(l => l.name.toLowerCase().includes('a1c') && l.abnormal)) 
      metFactors.push("Abnormal HbA1c documented");

    const metScore = Math.min(100, metFactors.length * 25);
    categories.push({
      category: "Metabolic",
      score: metScore,
      level: this.scoreToLevel(metScore),
      factors: metFactors,
      description: `${metFactors.length} metabolic-related factor(s) documented in patient record.`
    });

    // Fall risk (especially for elderly)
    const fallFactors: string[] = [];
    if (data.demographics.age >= 65) fallFactors.push("Age 65 or older");
    if (data.medications.filter(m => m.status === 'active').length >= 5) 
      fallFactors.push("Polypharmacy (5+ medications)");
    if (data.conditions.some(c => c.name.toLowerCase().includes('osteoporosis'))) 
      fallFactors.push("Documented osteoporosis");

    const fallScore = Math.min(100, fallFactors.length * 25);
    categories.push({
      category: "Fall Risk",
      score: fallScore,
      level: this.scoreToLevel(fallScore),
      factors: fallFactors,
      description: `${fallFactors.length} fall-related factor(s) documented in patient record.`
    });

    // Medication-related risk
    const medFactors: string[] = [];
    const activeMeds = data.medications.filter(m => m.status === 'active');
    if (activeMeds.length >= 10) medFactors.push("High medication count (10+)");
    else if (activeMeds.length >= 5) medFactors.push("Polypharmacy (5+ medications)");
    if (data.demographics.age >= 65 && activeMeds.length >= 5) 
      medFactors.push("Elderly with polypharmacy");

    const medScore = Math.min(100, medFactors.length * 30);
    categories.push({
      category: "Medication-Related",
      score: medScore,
      level: this.scoreToLevel(medScore),
      factors: medFactors,
      description: `${medFactors.length} medication-related factor(s) identified from documentation.`
    });

    // Hospital readmission risk
    const readmitFactors: string[] = [];
    const recentEncounters = data.encounters.filter(e => {
      const days = (Date.now() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 90;
    });
    if (recentEncounters.length >= 3) 
      readmitFactors.push("Multiple recent encounters (3+ in 90 days)");
    if (data.conditions.filter(c => c.status === 'active').length >= 3) 
      readmitFactors.push("Multiple active conditions (3+)");

    const readmitScore = Math.min(100, readmitFactors.length * 35);
    categories.push({
      category: "Hospital Readmission",
      score: readmitScore,
      level: this.scoreToLevel(readmitScore),
      factors: readmitFactors,
      description: `${readmitFactors.length} readmission-related factor(s) identified from documentation.`
    });

    const allFactors = categories.flatMap(c => c.factors);
    const avgScore = categories.reduce((sum, c) => sum + c.score, 0) / categories.length;

    const protectiveFactors: string[] = [];
    if (data.socialHistory?.exerciseLevel === 'active') 
      protectiveFactors.push("Active exercise documented");
    if (data.socialHistory?.smokingStatus === 'never') 
      protectiveFactors.push("Non-smoker documented");
    if (data.socialHistory?.alcoholUse === 'none') 
      protectiveFactors.push("No alcohol use documented");

    const dataQualityNotes: string[] = [];
    if (!data.socialHistory) dataQualityNotes.push("Social history not documented");
    if (data.vitals.length === 0) dataQualityNotes.push("No recent vitals documented");
    if (data.labResults.length === 0) dataQualityNotes.push("No recent lab results documented");

    return {
      patientId,
      overallRiskLevel: this.scoreToLevel(avgScore),
      overallScore: Math.round(avgScore),
      categories,
      documentedRiskFactors: Array.from(new Set(allFactors)),
      protectiveFactors,
      dataQualityNotes,
      generatedAt: new Date().toISOString(),
      disclaimer: "INFORMATIONAL ONLY: This risk organization is based solely on documented information and does not constitute clinical risk prediction or medical advice. Risk scores reflect the presence of documented factors only. All clinical decisions must be made by qualified healthcare providers based on complete patient evaluation."
    };
  }
}

export const aiRiskStratificationService = new AIRiskStratificationService();
