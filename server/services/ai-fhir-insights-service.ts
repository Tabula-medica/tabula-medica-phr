/**
 * AI FHIR Insights Service - AI-Driven Trend Analysis and Insight Generation
 * 
 * Provides AI-powered analysis of FHIR data for:
 * - Patient-friendly summaries
 * - Longitudinal trend identification
 * - Clinical insights for providers
 * 
 * STRICT COMPLIANCE: All outputs are INFORMATIONAL ONLY.
 * This service does NOT provide treatment recommendations or medical advice.
 * All generated content includes mandatory disclaimers.
 */

import { generatePhiSafeText } from "./ai-gateway";

// CRITICAL: Informational disclaimer for all AI outputs
const INFORMATIONAL_DISCLAIMER = `
⚠️ INFORMATIONAL ONLY - NOT MEDICAL ADVICE
This AI-generated summary is for educational and informational purposes only.
It does NOT constitute medical advice, diagnosis, or treatment recommendations.
Clinical judgment by qualified healthcare providers is required for all patient care decisions.
Always consult with your healthcare provider about any health concerns.
`;

const PROVIDER_DISCLAIMER = `
📋 CLINICAL REFERENCE ONLY
These AI-generated insights are provided as informational reference material only.
They do NOT replace clinical judgment or constitute treatment recommendations.
All clinical decisions must be made by qualified healthcare providers based on
complete patient assessment and current clinical guidelines.
`;

// Types for FHIR data insights
export interface MedicationInsight {
  id: string;
  patientFriendlySummary: string;
  longitudinalTrends: TrendItem[];
  clinicalInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

export interface ConditionInsight {
  id: string;
  patientFriendlySummary: string;
  longitudinalTrends: TrendItem[];
  clinicalInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

export interface LabInsight {
  id: string;
  patientFriendlySummary: string;
  longitudinalTrends: TrendItem[];
  clinicalInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

export interface EncounterInsight {
  id: string;
  patientFriendlySummary: string;
  longitudinalTrends: TrendItem[];
  clinicalInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

export interface TrendItem {
  id: string;
  type: 'improving' | 'stable' | 'declining' | 'fluctuating' | 'new';
  description: string;
  timeframe: string;
  significance: 'low' | 'medium' | 'high';
  dataPoints?: number;
}

export interface ClinicalInsight {
  id: string;
  category: 'pattern' | 'correlation' | 'frequency' | 'timing' | 'adherence';
  title: string;
  description: string;
  relevance: 'patient' | 'provider' | 'both';
  confidence: 'low' | 'medium' | 'high';
}

export interface ComprehensiveInsight {
  patientId: string;
  medications: MedicationInsight;
  conditions: ConditionInsight;
  labs: LabInsight;
  encounters: EncounterInsight;
  crossDomainInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

// Input types for generating insights
interface MedicationData {
  id: string;
  name: string;
  status: string;
  dosage?: string;
  startDate?: string;
  endDate?: string;
  prescriber?: string;
}

interface ConditionData {
  id: string;
  name: string;
  status: string;
  onsetDate?: string;
  resolvedDate?: string;
  severity?: string;
  icdCode?: string;
}

interface LabData {
  id: string;
  name: string;
  value: number;
  unit: string;
  date: string;
  referenceRange?: { low?: number; high?: number };
  abnormal?: boolean;
}

interface EncounterData {
  id: string;
  type: string;
  date: string;
  provider?: string;
  facility?: string;
  reason?: string;
  status: string;
}

class AIFHIRInsightsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('[AIFHIRInsights] Service initialized with NO-CDS compliance');
    console.log('[AIFHIRInsights] All outputs are strictly informational only');
  }

  /**
   * Generate comprehensive insights for all FHIR data types
   */
  async generateComprehensiveInsights(
    patientId: string,
    medications: MedicationData[],
    conditions: ConditionData[],
    labs: LabData[],
    encounters: EncounterData[]
  ): Promise<ComprehensiveInsight> {
    const cacheKey = `comprehensive-${patientId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const [medicationInsight, conditionInsight, labInsight, encounterInsight] = await Promise.all([
      this.generateMedicationInsights(patientId, medications),
      this.generateConditionInsights(patientId, conditions),
      this.generateLabInsights(patientId, labs),
      this.generateEncounterInsights(patientId, encounters),
    ]);

    const crossDomainInsights = await this.generateCrossDomainInsights(
      medications, conditions, labs, encounters
    );

    const result: ComprehensiveInsight = {
      patientId,
      medications: medicationInsight,
      conditions: conditionInsight,
      labs: labInsight,
      encounters: encounterInsight,
      crossDomainInsights,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Generate medication-specific insights
   */
  async generateMedicationInsights(
    patientId: string,
    medications: MedicationData[]
  ): Promise<MedicationInsight> {
    const cacheKey = `medications-${patientId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let patientFriendlySummary: string;
    let longitudinalTrends: TrendItem[];
    let clinicalInsights: ClinicalInsight[];

    try {
      const aiResponse = await this.callOpenAI('medication', medications);
      patientFriendlySummary = aiResponse.patientSummary;
      longitudinalTrends = aiResponse.trends;
      clinicalInsights = aiResponse.insights;
    } catch (error) {
      // Fallback to rule-based analysis
      patientFriendlySummary = this.generateFallbackMedicationSummary(medications);
      longitudinalTrends = this.analyzeMedicationTrends(medications);
      clinicalInsights = this.extractMedicationInsights(medications);
    }

    const result: MedicationInsight = {
      id: `med-insight-${Date.now()}`,
      patientFriendlySummary,
      longitudinalTrends,
      clinicalInsights,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Generate condition-specific insights
   */
  async generateConditionInsights(
    patientId: string,
    conditions: ConditionData[]
  ): Promise<ConditionInsight> {
    const cacheKey = `conditions-${patientId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let patientFriendlySummary: string;
    let longitudinalTrends: TrendItem[];
    let clinicalInsights: ClinicalInsight[];

    try {
      const aiResponse = await this.callOpenAI('condition', conditions);
      patientFriendlySummary = aiResponse.patientSummary;
      longitudinalTrends = aiResponse.trends;
      clinicalInsights = aiResponse.insights;
    } catch (error) {
      patientFriendlySummary = this.generateFallbackConditionSummary(conditions);
      longitudinalTrends = this.analyzeConditionTrends(conditions);
      clinicalInsights = this.extractConditionInsights(conditions);
    }

    const result: ConditionInsight = {
      id: `cond-insight-${Date.now()}`,
      patientFriendlySummary,
      longitudinalTrends,
      clinicalInsights,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Generate lab-specific insights
   */
  async generateLabInsights(
    patientId: string,
    labs: LabData[]
  ): Promise<LabInsight> {
    const cacheKey = `labs-${patientId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let patientFriendlySummary: string;
    let longitudinalTrends: TrendItem[];
    let clinicalInsights: ClinicalInsight[];

    try {
      const aiResponse = await this.callOpenAI('lab', labs);
      patientFriendlySummary = aiResponse.patientSummary;
      longitudinalTrends = aiResponse.trends;
      clinicalInsights = aiResponse.insights;
    } catch (error) {
      patientFriendlySummary = this.generateFallbackLabSummary(labs);
      longitudinalTrends = this.analyzeLabTrends(labs);
      clinicalInsights = this.extractLabInsights(labs);
    }

    const result: LabInsight = {
      id: `lab-insight-${Date.now()}`,
      patientFriendlySummary,
      longitudinalTrends,
      clinicalInsights,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Generate encounter-specific insights
   */
  async generateEncounterInsights(
    patientId: string,
    encounters: EncounterData[]
  ): Promise<EncounterInsight> {
    const cacheKey = `encounters-${patientId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let patientFriendlySummary: string;
    let longitudinalTrends: TrendItem[];
    let clinicalInsights: ClinicalInsight[];

    try {
      const aiResponse = await this.callOpenAI('encounter', encounters);
      patientFriendlySummary = aiResponse.patientSummary;
      longitudinalTrends = aiResponse.trends;
      clinicalInsights = aiResponse.insights;
    } catch (error) {
      patientFriendlySummary = this.generateFallbackEncounterSummary(encounters);
      longitudinalTrends = this.analyzeEncounterTrends(encounters);
      clinicalInsights = this.extractEncounterInsights(encounters);
    }

    const result: EncounterInsight = {
      id: `enc-insight-${Date.now()}`,
      patientFriendlySummary,
      longitudinalTrends,
      clinicalInsights,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Call the PHI-safe Vertex (BAA) gateway for AI-powered insight generation
   */
  private async callOpenAI(
    dataType: 'medication' | 'condition' | 'lab' | 'encounter',
    data: any[]
  ): Promise<{ patientSummary: string; trends: TrendItem[]; insights: ClinicalInsight[] }> {
    const systemPrompt = this.getSystemPrompt(dataType);
    const userPrompt = this.getUserPrompt(dataType, data);

    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3,
      maxTokens: 1500,
      responseMimeType: 'application/json',
    });

    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return {
      patientSummary: parsed.patientSummary || this.getFallbackSummary(dataType, data),
      trends: this.parseTrends(parsed.trends || []),
      insights: this.parseInsights(parsed.insights || []),
    };
  }

  private getSystemPrompt(dataType: string): string {
    return `You are a healthcare data analyst assistant. Your role is to analyze ${dataType} data and provide:
1. A concise, patient-friendly summary (2-3 sentences, using simple language)
2. Identified longitudinal trends (patterns over time)
3. Key clinical insights relevant to healthcare providers

CRITICAL REQUIREMENTS:
- You must NEVER provide treatment recommendations or medical advice
- All outputs are INFORMATIONAL ONLY for educational purposes
- Use phrases like "This information suggests..." or "Records indicate..."
- Never use phrases like "You should..." or "Consider taking..."
- Focus on observable patterns and data summaries only
- Do not diagnose or suggest diagnoses
- Do not recommend any actions, treatments, or lifestyle changes

Respond in JSON format with keys: patientSummary, trends, insights`;
  }

  private getUserPrompt(dataType: string, data: any[]): string {
    const dataStr = JSON.stringify(data.slice(0, 20), null, 2);
    return `Analyze this ${dataType} data and generate informational insights. Remember: NO treatment recommendations.

Data (${data.length} records, showing first 20):
${dataStr}

Provide:
1. patientSummary: A brief, patient-friendly overview (2-3 sentences)
2. trends: Array of trend objects with {type, description, timeframe, significance}
3. insights: Array of insight objects with {category, title, description, relevance, confidence}

Types for trends: improving, stable, declining, fluctuating, new
Categories for insights: pattern, correlation, frequency, timing, adherence
Relevance: patient, provider, both`;
  }

  private parseTrends(rawTrends: any[]): TrendItem[] {
    return rawTrends.map((t, i) => ({
      id: `trend-${i}-${Date.now()}`,
      type: t.type || 'stable',
      description: t.description || 'No description available',
      timeframe: t.timeframe || 'Recent period',
      significance: t.significance || 'medium',
      dataPoints: t.dataPoints,
    }));
  }

  private parseInsights(rawInsights: any[]): ClinicalInsight[] {
    return rawInsights.map((ins, i) => ({
      id: `insight-${i}-${Date.now()}`,
      category: ins.category || 'pattern',
      title: ins.title || 'Clinical Observation',
      description: ins.description || 'No description available',
      relevance: ins.relevance || 'both',
      confidence: ins.confidence || 'medium',
    }));
  }

  // Fallback methods for when AI is unavailable
  private generateFallbackMedicationSummary(medications: MedicationData[]): string {
    const active = medications.filter(m => m.status === 'active').length;
    const total = medications.length;
    return `Your medication record shows ${total} medications, with ${active} currently active. ` +
      `This summary provides an overview of your prescribed medications for reference purposes only. ` +
      `Please discuss any questions about your medications with your healthcare provider.`;
  }

  private generateFallbackConditionSummary(conditions: ConditionData[]): string {
    const active = conditions.filter(c => c.status === 'active').length;
    const resolved = conditions.filter(c => c.status === 'resolved').length;
    return `Your health record shows ${conditions.length} documented conditions, ` +
      `with ${active} active and ${resolved} resolved. This is an informational summary only. ` +
      `Your healthcare provider can explain what these conditions mean for your health.`;
  }

  private generateFallbackLabSummary(labs: LabData[]): string {
    const recent = labs.filter(l => {
      const labDate = new Date(l.date);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return labDate > monthAgo;
    }).length;
    return `Your lab records include ${labs.length} test results, with ${recent} from the past month. ` +
      `Lab values are shown for informational reference only. ` +
      `Your healthcare provider will interpret these results in the context of your overall health.`;
  }

  private generateFallbackEncounterSummary(encounters: EncounterData[]): string {
    const types = Array.from(new Set(encounters.map(e => e.type)));
    return `Your healthcare record shows ${encounters.length} visits across ${types.length} different types of appointments. ` +
      `This timeline provides a reference of your healthcare interactions. ` +
      `Visit details are summarized for your information only.`;
  }

  private getFallbackSummary(dataType: string, data: any[]): string {
    return `Your ${dataType} records contain ${data.length} entries. ` +
      `This information is provided for reference only and does not constitute medical advice.`;
  }

  // Rule-based trend analysis
  private analyzeMedicationTrends(medications: MedicationData[]): TrendItem[] {
    const trends: TrendItem[] = [];
    const active = medications.filter(m => m.status === 'active');
    const discontinued = medications.filter(m => m.status === 'stopped' || m.status === 'discontinued');

    if (active.length > 0) {
      trends.push({
        id: `med-trend-active-${Date.now()}`,
        type: 'stable',
        description: `${active.length} medication(s) currently active in your regimen`,
        timeframe: 'Current',
        significance: 'medium',
        dataPoints: active.length,
      });
    }

    if (discontinued.length > 0) {
      trends.push({
        id: `med-trend-discontinued-${Date.now()}`,
        type: 'stable',
        description: `${discontinued.length} medication(s) have been discontinued historically`,
        timeframe: 'Historical',
        significance: 'low',
        dataPoints: discontinued.length,
      });
    }

    return trends;
  }

  private analyzeConditionTrends(conditions: ConditionData[]): TrendItem[] {
    const trends: TrendItem[] = [];
    const active = conditions.filter(c => c.status === 'active');
    const resolved = conditions.filter(c => c.status === 'resolved');

    if (active.length > 0) {
      trends.push({
        id: `cond-trend-active-${Date.now()}`,
        type: 'stable',
        description: `${active.length} active condition(s) documented in your health record`,
        timeframe: 'Current',
        significance: 'medium',
        dataPoints: active.length,
      });
    }

    if (resolved.length > 0) {
      trends.push({
        id: `cond-trend-resolved-${Date.now()}`,
        type: 'improving',
        description: `${resolved.length} condition(s) have been marked as resolved`,
        timeframe: 'Historical',
        significance: 'medium',
        dataPoints: resolved.length,
      });
    }

    return trends;
  }

  private analyzeLabTrends(labs: LabData[]): TrendItem[] {
    const trends: TrendItem[] = [];
    const abnormal = labs.filter(l => l.abnormal);
    const normal = labs.filter(l => !l.abnormal);

    if (labs.length > 0) {
      const abnormalPercentage = Math.round((abnormal.length / labs.length) * 100);
      trends.push({
        id: `lab-trend-overall-${Date.now()}`,
        type: abnormalPercentage > 30 ? 'fluctuating' : 'stable',
        description: `${normal.length} of ${labs.length} lab results within reference ranges (${100 - abnormalPercentage}%)`,
        timeframe: 'Overall record',
        significance: abnormalPercentage > 30 ? 'high' : 'medium',
        dataPoints: labs.length,
      });
    }

    return trends;
  }

  private analyzeEncounterTrends(encounters: EncounterData[]): TrendItem[] {
    const trends: TrendItem[] = [];
    const types = encounters.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      trends.push({
        id: `enc-trend-type-${Date.now()}`,
        type: 'stable',
        description: `Most frequent visit type: ${mostCommon[0]} (${mostCommon[1]} visits)`,
        timeframe: 'Historical',
        significance: 'low',
        dataPoints: mostCommon[1],
      });
    }

    return trends;
  }

  // Rule-based insight extraction
  private extractMedicationInsights(medications: MedicationData[]): ClinicalInsight[] {
    const insights: ClinicalInsight[] = [];
    const active = medications.filter(m => m.status === 'active');

    if (active.length >= 5) {
      insights.push({
        id: `med-insight-polypharmacy-${Date.now()}`,
        category: 'pattern',
        title: 'Multiple Active Medications',
        description: `Patient has ${active.length} active medications. This is noted for reference only.`,
        relevance: 'provider',
        confidence: 'high',
      });
    }

    return insights;
  }

  private extractConditionInsights(conditions: ConditionData[]): ClinicalInsight[] {
    const insights: ClinicalInsight[] = [];
    const chronic = conditions.filter(c => c.status === 'active');

    if (chronic.length >= 3) {
      insights.push({
        id: `cond-insight-multimorbidity-${Date.now()}`,
        category: 'pattern',
        title: 'Multiple Active Conditions',
        description: `${chronic.length} active conditions documented. Healthcare coordination may be relevant.`,
        relevance: 'provider',
        confidence: 'high',
      });
    }

    return insights;
  }

  private extractLabInsights(labs: LabData[]): ClinicalInsight[] {
    const insights: ClinicalInsight[] = [];
    const abnormal = labs.filter(l => l.abnormal);

    if (abnormal.length > 0) {
      insights.push({
        id: `lab-insight-abnormal-${Date.now()}`,
        category: 'pattern',
        title: 'Lab Results Outside Reference Range',
        description: `${abnormal.length} lab result(s) are flagged outside reference ranges. Provider review recommended.`,
        relevance: 'both',
        confidence: 'high',
      });
    }

    return insights;
  }

  private extractEncounterInsights(encounters: EncounterData[]): ClinicalInsight[] {
    const insights: ClinicalInsight[] = [];
    
    // Check for frequent visits
    const recentEncounters = encounters.filter(e => {
      const date = new Date(e.date);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return date > threeMonthsAgo;
    });

    if (recentEncounters.length >= 5) {
      insights.push({
        id: `enc-insight-frequency-${Date.now()}`,
        category: 'frequency',
        title: 'Recent Healthcare Utilization',
        description: `${recentEncounters.length} healthcare encounters in the past 3 months noted for reference.`,
        relevance: 'provider',
        confidence: 'high',
      });
    }

    return insights;
  }

  /**
   * Generate cross-domain insights by analyzing relationships between data types
   */
  private async generateCrossDomainInsights(
    medications: MedicationData[],
    conditions: ConditionData[],
    labs: LabData[],
    encounters: EncounterData[]
  ): Promise<ClinicalInsight[]> {
    const insights: ClinicalInsight[] = [];

    // Medication-condition correlation observation
    const activeMeds = medications.filter(m => m.status === 'active').length;
    const activeConditions = conditions.filter(c => c.status === 'active').length;

    if (activeMeds > 0 && activeConditions > 0) {
      insights.push({
        id: `cross-med-cond-${Date.now()}`,
        category: 'correlation',
        title: 'Medication-Condition Overview',
        description: `${activeMeds} active medications documented alongside ${activeConditions} active conditions.`,
        relevance: 'provider',
        confidence: 'high',
      });
    }

    // Lab-encounter timing observation
    const recentLabs = labs.filter(l => {
      const date = new Date(l.date);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date > monthAgo;
    });

    if (recentLabs.length > 0 && encounters.length > 0) {
      insights.push({
        id: `cross-lab-enc-${Date.now()}`,
        category: 'timing',
        title: 'Recent Lab Activity',
        description: `${recentLabs.length} lab tests documented in the past month, correlating with healthcare visits.`,
        relevance: 'both',
        confidence: 'medium',
      });
    }

    return insights;
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache for a specific patient
   */
  clearPatientCache(patientId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(k => k.includes(patientId));
    keysToDelete.forEach(k => this.cache.delete(k));
  }

  /**
   * Get provider-specific disclaimer
   */
  getProviderDisclaimer(): string {
    return PROVIDER_DISCLAIMER;
  }

  /**
   * Get patient-specific disclaimer
   */
  getPatientDisclaimer(): string {
    return INFORMATIONAL_DISCLAIMER;
  }
}

export const aiFhirInsightsService = new AIFHIRInsightsService();
