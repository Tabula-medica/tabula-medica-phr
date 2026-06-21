import OpenAI from "openai";
import crypto from "crypto";

let openai: OpenAI | null = null;
try {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  console.log("[AIFHIRDataSummarization] OpenAI client configured");
} catch (error) {
  console.log("[AIFHIRDataSummarization] OpenAI client not configured, using fallback responses");
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This summary is for informational and educational purposes only. It does NOT constitute clinical decision support, diagnosis, or medical advice. All information requires verification by qualified healthcare professionals before use in clinical decisions. Always consult with your healthcare provider for medical guidance.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][FHIRDataSummarization] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

function generateId(): string {
  return `fhir-sum-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export type DataViewType = "medications" | "conditions" | "labs" | "encounters" | "comprehensive";
export type AudienceType = "patient" | "provider" | "caregiver";
export type SummaryStyle = "brief" | "detailed" | "narrative";

export interface FHIRMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: "active" | "stopped" | "on-hold" | "completed" | "cancelled";
  startDate?: string;
  endDate?: string;
  prescriber?: string;
  reason?: string;
  instructions?: string;
}

export interface FHIRCondition {
  id: string;
  name: string;
  code?: string;
  codeSystem?: string;
  clinicalStatus: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved";
  verificationStatus?: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted";
  severity?: "mild" | "moderate" | "severe";
  onsetDate?: string;
  abatementDate?: string;
  category?: string;
  bodySite?: string;
  notes?: string;
}

export interface FHIRLabResult {
  id: string;
  testName: string;
  loincCode?: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  interpretation?: "normal" | "low" | "high" | "critical" | "abnormal";
  date: string;
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled";
  performer?: string;
  specimen?: string;
}

export interface FHIREncounter {
  id: string;
  type: string;
  status: "planned" | "arrived" | "in-progress" | "finished" | "cancelled";
  class?: "ambulatory" | "emergency" | "inpatient" | "observation" | "virtual";
  startDate: string;
  endDate?: string;
  provider?: string;
  facility?: string;
  reasonForVisit?: string;
  diagnosis?: string[];
  notes?: string;
}

export interface PatientFHIRData {
  patientId: string;
  patientName?: string;
  medications?: FHIRMedication[];
  conditions?: FHIRCondition[];
  labResults?: FHIRLabResult[];
  encounters?: FHIREncounter[];
}

export interface TrendAnalysis {
  metric: string;
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  direction?: "increasing" | "decreasing" | "unchanged";
  description: string;
  dataPoints?: { date: string; value: string | number }[];
  significance: "high" | "medium" | "low";
}

export interface KeyHighlight {
  category: "attention" | "positive" | "informational" | "change";
  title: string;
  description: string;
  relatedData?: string[];
  priority: "high" | "medium" | "low";
}

export interface DataViewSummary {
  id: string;
  patientId: string;
  viewType: DataViewType;
  audience: AudienceType;
  generatedAt: string;
  naturalLanguageSummary: string;
  sections: SummarySection[];
  trends: TrendAnalysis[];
  highlights: KeyHighlight[];
  itemCount: number;
  timeframeStart?: string;
  timeframeEnd?: string;
  disclaimer: string;
}

export interface SummarySection {
  title: string;
  content: string;
  dataType: string;
  itemCount: number;
}

export interface ComprehensiveSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overallSummary: string;
  medicationsSummary: DataViewSummary | null;
  conditionsSummary: DataViewSummary | null;
  labsSummary: DataViewSummary | null;
  encountersSummary: DataViewSummary | null;
  crossDataInsights: CrossDataInsight[];
  longitudinalTrends: TrendAnalysis[];
  keyHighlights: KeyHighlight[];
  disclaimer: string;
}

export interface CrossDataInsight {
  title: string;
  description: string;
  relatedCategories: DataViewType[];
  insight: string;
  significance: "high" | "medium" | "low";
}

export interface SummarizationRequest {
  patientId: string;
  viewType: DataViewType;
  audience: AudienceType;
  style?: SummaryStyle;
  timeframeDays?: number;
  focusAreas?: string[];
  includetrends?: boolean;
  includeHighlights?: boolean;
}

const summaryCache = new Map<string, DataViewSummary | ComprehensiveSummary>();

const AUDIENCE_PROMPTS: Record<AudienceType, string> = {
  patient: `You are creating a health summary for a PATIENT. Use plain, everyday language that anyone can understand:
- Avoid medical jargon - explain terms simply
- Use friendly, reassuring tone while being factual
- Focus on what matters for daily life and self-care
- Highlight what's going well and what needs attention
- Explain the "what" and "why" in simple terms
- Use analogies when helpful`,

  provider: `You are creating a clinical summary for a HEALTHCARE PROVIDER. Use professional medical language:
- Include relevant clinical terminology and codes
- Focus on clinically significant findings
- Highlight trends and patterns requiring attention
- Note any gaps or data quality concerns
- Be concise but thorough
- Organize by clinical priority`,

  caregiver: `You are creating a summary for a CAREGIVER (family member or care partner). Balance accessibility with detail:
- Use clear language but include important medical terms with explanations
- Focus on practical care coordination information
- Highlight medication schedules and upcoming needs
- Note changes that may require attention
- Include actionable information for care support`
};

const VIEW_TYPE_PROMPTS: Record<DataViewType, string> = {
  medications: `Summarize the patient's MEDICATION list:
- Group medications by purpose/condition
- Note any recent changes (new, stopped, dose changes)
- Highlight important timing or administration instructions
- Note any potential concerns (multiple medications for same condition, etc.)
- Include adherence-relevant information`,

  conditions: `Summarize the patient's HEALTH CONDITIONS:
- Organize by active vs resolved conditions
- Note severity and how well controlled
- Highlight any recent diagnosis changes
- Connect related conditions
- Note any conditions requiring monitoring`,

  labs: `Summarize the patient's LABORATORY RESULTS:
- Highlight values outside normal range
- Identify trends over time (improving, worsening, stable)
- Group related tests together
- Note any critical or concerning values
- Connect lab values to known conditions when relevant`,

  encounters: `Summarize the patient's HEALTHCARE ENCOUNTERS:
- Provide overview of visit frequency and types
- Highlight key visits and their outcomes
- Note patterns in care (regular follow-ups, emergency visits)
- Summarize main reasons for visits
- Note care coordination across providers`,

  comprehensive: `Create a COMPREHENSIVE health summary covering all available data:
- Provide integrated view across medications, conditions, labs, and encounters
- Identify connections between different data types
- Highlight the most important information across categories
- Note overall health trajectory
- Identify any gaps or coordination needs`
};

class AIFHIRDataSummarizationService {
  async summarizeFHIRData(
    data: PatientFHIRData,
    request: SummarizationRequest,
    userId: string
  ): Promise<DataViewSummary | ComprehensiveSummary> {
    logHipaaAudit("SUMMARIZE_FHIR_DATA", userId, 
      `Generating ${request.viewType} summary for patient ${hashIdentifier(request.patientId)} as ${request.audience}`);

    const cacheKey = `${request.patientId}-${request.viewType}-${request.audience}-${request.timeframeDays || 'all'}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && new Date().getTime() - new Date(cached.generatedAt).getTime() < 300000) {
      logHipaaAudit("CACHE_HIT", userId, `Returning cached summary for ${hashIdentifier(request.patientId)}`);
      return cached;
    }

    if (request.viewType === "comprehensive") {
      return this.generateComprehensiveSummary(data, request, userId);
    }

    return this.generateDataViewSummary(data, request, userId);
  }

  private async generateDataViewSummary(
    data: PatientFHIRData,
    request: SummarizationRequest,
    userId: string
  ): Promise<DataViewSummary> {
    const viewData = this.extractViewData(data, request.viewType);
    const prompt = this.buildPrompt(viewData, request);
    
    let naturalLanguageSummary: string;
    let trends: TrendAnalysis[] = [];
    let highlights: KeyHighlight[] = [];

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: `${AUDIENCE_PROMPTS[request.audience]}\n\n${VIEW_TYPE_PROMPTS[request.viewType]}\n\nIMPORTANT: Present ONLY factual information from the data provided. Do NOT provide medical advice, treatment recommendations, or clinical decision support. This is for informational purposes only.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          naturalLanguageSummary = parsed.summary || this.generateFallbackSummary(viewData, request);
          trends = parsed.trends || this.generateFallbackTrends(viewData, request);
          highlights = parsed.highlights || this.generateFallbackHighlights(viewData, request);
        } else {
          naturalLanguageSummary = this.generateFallbackSummary(viewData, request);
          trends = this.generateFallbackTrends(viewData, request);
          highlights = this.generateFallbackHighlights(viewData, request);
        }
      } catch (error) {
        console.error("[AIFHIRDataSummarization] OpenAI error:", error);
        naturalLanguageSummary = this.generateFallbackSummary(viewData, request);
        trends = this.generateFallbackTrends(viewData, request);
        highlights = this.generateFallbackHighlights(viewData, request);
      }
    } else {
      naturalLanguageSummary = this.generateFallbackSummary(viewData, request);
      trends = this.generateFallbackTrends(viewData, request);
      highlights = this.generateFallbackHighlights(viewData, request);
    }

    const summary: DataViewSummary = {
      id: generateId(),
      patientId: request.patientId,
      viewType: request.viewType,
      audience: request.audience,
      generatedAt: new Date().toISOString(),
      naturalLanguageSummary,
      sections: this.buildSections(viewData, request),
      trends,
      highlights,
      itemCount: this.getItemCount(viewData),
      disclaimer: NO_CDS_DISCLAIMER
    };

    const cacheKey = `${request.patientId}-${request.viewType}-${request.audience}-${request.timeframeDays || 'all'}`;
    summaryCache.set(cacheKey, summary);

    logHipaaAudit("SUMMARY_GENERATED", userId, 
      `Generated ${request.viewType} summary with ${summary.itemCount} items for ${hashIdentifier(request.patientId)}`);

    return summary;
  }

  private async generateComprehensiveSummary(
    data: PatientFHIRData,
    request: SummarizationRequest,
    userId: string
  ): Promise<ComprehensiveSummary> {
    const medicationsRequest = { ...request, viewType: "medications" as DataViewType };
    const conditionsRequest = { ...request, viewType: "conditions" as DataViewType };
    const labsRequest = { ...request, viewType: "labs" as DataViewType };
    const encountersRequest = { ...request, viewType: "encounters" as DataViewType };

    const [medicationsSummary, conditionsSummary, labsSummary, encountersSummary] = await Promise.all([
      data.medications?.length ? this.generateDataViewSummary(data, medicationsRequest, userId) : null,
      data.conditions?.length ? this.generateDataViewSummary(data, conditionsRequest, userId) : null,
      data.labResults?.length ? this.generateDataViewSummary(data, labsRequest, userId) : null,
      data.encounters?.length ? this.generateDataViewSummary(data, encountersRequest, userId) : null
    ]);

    const crossDataInsights = this.generateCrossDataInsights(data, request);
    const longitudinalTrends = this.generateLongitudinalTrends(data);
    const keyHighlights = this.aggregateKeyHighlights(
      medicationsSummary?.highlights || [],
      conditionsSummary?.highlights || [],
      labsSummary?.highlights || [],
      encountersSummary?.highlights || []
    );

    let overallSummary: string;

    if (openai) {
      try {
        const summaryPrompt = this.buildComprehensivePrompt(data, request, {
          medicationsSummary,
          conditionsSummary,
          labsSummary,
          encountersSummary
        });

        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: `${AUDIENCE_PROMPTS[request.audience]}\n\nCreate an integrated health overview that connects information across all health data categories. Focus on the big picture while highlighting what matters most.\n\nIMPORTANT: Present ONLY factual information from the data provided. Do NOT provide medical advice or clinical decision support.`
            },
            {
              role: "user",
              content: summaryPrompt
            }
          ],
          max_completion_tokens: 3000
        });

        overallSummary = response.choices[0]?.message?.content || this.generateFallbackComprehensiveSummary(data, request);
      } catch (error) {
        console.error("[AIFHIRDataSummarization] OpenAI comprehensive error:", error);
        overallSummary = this.generateFallbackComprehensiveSummary(data, request);
      }
    } else {
      overallSummary = this.generateFallbackComprehensiveSummary(data, request);
    }

    const comprehensive: ComprehensiveSummary = {
      id: generateId(),
      patientId: request.patientId,
      generatedAt: new Date().toISOString(),
      overallSummary,
      medicationsSummary,
      conditionsSummary,
      labsSummary,
      encountersSummary,
      crossDataInsights,
      longitudinalTrends,
      keyHighlights,
      disclaimer: NO_CDS_DISCLAIMER
    };

    const cacheKey = `${request.patientId}-comprehensive-${request.audience}-${request.timeframeDays || 'all'}`;
    summaryCache.set(cacheKey, comprehensive);

    logHipaaAudit("COMPREHENSIVE_SUMMARY_GENERATED", userId, 
      `Generated comprehensive summary for ${hashIdentifier(request.patientId)}`);

    return comprehensive;
  }

  private extractViewData(data: PatientFHIRData, viewType: DataViewType): any {
    switch (viewType) {
      case "medications": return data.medications || [];
      case "conditions": return data.conditions || [];
      case "labs": return data.labResults || [];
      case "encounters": return data.encounters || [];
      default: return data;
    }
  }

  private buildPrompt(viewData: any, request: SummarizationRequest): string {
    const dataJson = JSON.stringify(viewData, null, 2);
    
    return `Analyze the following ${request.viewType} data and generate a JSON response with:
1. "summary": A natural language summary appropriate for ${request.audience === 'patient' ? 'a patient' : request.audience === 'provider' ? 'a healthcare provider' : 'a caregiver'}
2. "trends": Array of trend analyses with { metric, trend, direction, description, significance }
3. "highlights": Array of key highlights with { category, title, description, priority }

Data to analyze:
${dataJson}

${request.focusAreas?.length ? `Focus especially on: ${request.focusAreas.join(', ')}` : ''}
${request.timeframeDays ? `Consider data from the last ${request.timeframeDays} days` : ''}

Remember: Only present factual information. Do not provide medical advice.`;
  }

  private buildComprehensivePrompt(
    data: PatientFHIRData,
    request: SummarizationRequest,
    summaries: {
      medicationsSummary: DataViewSummary | null;
      conditionsSummary: DataViewSummary | null;
      labsSummary: DataViewSummary | null;
      encountersSummary: DataViewSummary | null;
    }
  ): string {
    const parts: string[] = [];
    
    parts.push(`Create a comprehensive health overview for ${request.audience === 'patient' ? 'a patient' : request.audience === 'provider' ? 'a healthcare provider' : 'a caregiver'}.`);
    
    if (summaries.conditionsSummary) {
      parts.push(`\n**Health Conditions:**\n${summaries.conditionsSummary.naturalLanguageSummary}`);
    }
    if (summaries.medicationsSummary) {
      parts.push(`\n**Medications:**\n${summaries.medicationsSummary.naturalLanguageSummary}`);
    }
    if (summaries.labsSummary) {
      parts.push(`\n**Laboratory Results:**\n${summaries.labsSummary.naturalLanguageSummary}`);
    }
    if (summaries.encountersSummary) {
      parts.push(`\n**Healthcare Visits:**\n${summaries.encountersSummary.naturalLanguageSummary}`);
    }

    parts.push(`\n\nProvide an integrated overview that connects these different aspects of health data, highlighting the most important information and any notable patterns or connections.`);

    return parts.join('\n');
  }

  private buildSections(viewData: any, request: SummarizationRequest): SummarySection[] {
    const sections: SummarySection[] = [];
    
    if (!Array.isArray(viewData) || viewData.length === 0) {
      return sections;
    }

    switch (request.viewType) {
      case "medications":
        const activeMeds = viewData.filter((m: FHIRMedication) => m.status === 'active');
        const stoppedMeds = viewData.filter((m: FHIRMedication) => m.status === 'stopped');
        
        if (activeMeds.length > 0) {
          sections.push({
            title: "Active Medications",
            content: activeMeds.map((m: FHIRMedication) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` - ${m.frequency}` : ''}`).join('; '),
            dataType: "medication_active",
            itemCount: activeMeds.length
          });
        }
        if (stoppedMeds.length > 0) {
          sections.push({
            title: "Recently Stopped Medications",
            content: stoppedMeds.map((m: FHIRMedication) => m.name).join('; '),
            dataType: "medication_stopped",
            itemCount: stoppedMeds.length
          });
        }
        break;

      case "conditions":
        const activeConditions = viewData.filter((c: FHIRCondition) => c.clinicalStatus === 'active');
        const resolvedConditions = viewData.filter((c: FHIRCondition) => c.clinicalStatus === 'resolved' || c.clinicalStatus === 'remission');
        
        if (activeConditions.length > 0) {
          sections.push({
            title: "Active Conditions",
            content: activeConditions.map((c: FHIRCondition) => `${c.name}${c.severity ? ` (${c.severity})` : ''}`).join('; '),
            dataType: "condition_active",
            itemCount: activeConditions.length
          });
        }
        if (resolvedConditions.length > 0) {
          sections.push({
            title: "Resolved/In Remission",
            content: resolvedConditions.map((c: FHIRCondition) => c.name).join('; '),
            dataType: "condition_resolved",
            itemCount: resolvedConditions.length
          });
        }
        break;

      case "labs":
        const abnormalLabs = viewData.filter((l: FHIRLabResult) => l.interpretation && l.interpretation !== 'normal');
        const recentLabs = viewData.slice(0, 10);
        
        if (abnormalLabs.length > 0) {
          sections.push({
            title: "Abnormal Results",
            content: abnormalLabs.map((l: FHIRLabResult) => `${l.testName}: ${l.value}${l.unit ? ` ${l.unit}` : ''} (${l.interpretation})`).join('; '),
            dataType: "lab_abnormal",
            itemCount: abnormalLabs.length
          });
        }
        sections.push({
          title: "Recent Tests",
          content: recentLabs.map((l: FHIRLabResult) => `${l.testName}: ${l.value}${l.unit ? ` ${l.unit}` : ''}`).join('; '),
          dataType: "lab_recent",
          itemCount: recentLabs.length
        });
        break;

      case "encounters":
        const recentEncounters = viewData.slice(0, 5);
        sections.push({
          title: "Recent Healthcare Visits",
          content: recentEncounters.map((e: FHIREncounter) => `${e.type} on ${new Date(e.startDate).toLocaleDateString()}${e.provider ? ` with ${e.provider}` : ''}`).join('; '),
          dataType: "encounter_recent",
          itemCount: recentEncounters.length
        });
        break;
    }

    return sections;
  }

  private getItemCount(viewData: any): number {
    return Array.isArray(viewData) ? viewData.length : 0;
  }

  private generateFallbackSummary(viewData: any, request: SummarizationRequest): string {
    if (!Array.isArray(viewData) || viewData.length === 0) {
      return `No ${request.viewType} data is currently available.`;
    }

    const count = viewData.length;
    const audienceIntro = request.audience === 'patient' 
      ? "Here's an overview of your" 
      : request.audience === 'provider' 
        ? "Clinical summary of" 
        : "Care summary of";

    switch (request.viewType) {
      case "medications":
        const activeMeds = viewData.filter((m: FHIRMedication) => m.status === 'active');
        return `${audienceIntro} medications: You have ${count} medications on record, with ${activeMeds.length} currently active. ${activeMeds.slice(0, 3).map((m: FHIRMedication) => m.name).join(', ')}${activeMeds.length > 3 ? `, and ${activeMeds.length - 3} more` : ''}.`;
      
      case "conditions":
        const activeConditions = viewData.filter((c: FHIRCondition) => c.clinicalStatus === 'active');
        return `${audienceIntro} health conditions: There are ${count} conditions documented, with ${activeConditions.length} currently active. ${activeConditions.slice(0, 3).map((c: FHIRCondition) => c.name).join(', ')}${activeConditions.length > 3 ? `, and ${activeConditions.length - 3} more` : ''}.`;
      
      case "labs":
        const abnormal = viewData.filter((l: FHIRLabResult) => l.interpretation && l.interpretation !== 'normal');
        return `${audienceIntro} laboratory results: ${count} test results are on file. ${abnormal.length > 0 ? `${abnormal.length} result${abnormal.length > 1 ? 's are' : ' is'} outside the normal range.` : 'All recent results are within normal ranges.'}`;
      
      case "encounters":
        return `${audienceIntro} healthcare visits: ${count} encounters are documented. Most recent visits include ${viewData.slice(0, 3).map((e: FHIREncounter) => e.type).join(', ')}.`;
      
      default:
        return `${count} items found in ${request.viewType} data.`;
    }
  }

  private generateFallbackTrends(viewData: any, request: SummarizationRequest): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];
    
    if (!Array.isArray(viewData) || viewData.length < 2) {
      return trends;
    }

    switch (request.viewType) {
      case "medications":
        const activeMeds = viewData.filter((m: FHIRMedication) => m.status === 'active');
        trends.push({
          metric: "Active Medications",
          trend: "stable",
          description: `Currently ${activeMeds.length} active medications`,
          significance: activeMeds.length > 5 ? "high" : "medium"
        });
        break;
      
      case "labs":
        const abnormalCount = viewData.filter((l: FHIRLabResult) => l.interpretation && l.interpretation !== 'normal').length;
        const abnormalRatio = abnormalCount / viewData.length;
        trends.push({
          metric: "Abnormal Results Ratio",
          trend: abnormalRatio > 0.3 ? "fluctuating" : "stable",
          direction: abnormalRatio > 0.3 ? "increasing" : "unchanged",
          description: `${abnormalCount} of ${viewData.length} results outside normal range`,
          significance: abnormalRatio > 0.3 ? "high" : "low"
        });
        break;
    }

    return trends;
  }

  private generateFallbackHighlights(viewData: any, request: SummarizationRequest): KeyHighlight[] {
    const highlights: KeyHighlight[] = [];
    
    if (!Array.isArray(viewData) || viewData.length === 0) {
      return highlights;
    }

    switch (request.viewType) {
      case "medications":
        const activeMeds = viewData.filter((m: FHIRMedication) => m.status === 'active');
        if (activeMeds.length > 5) {
          highlights.push({
            category: "informational",
            title: "Multiple Active Medications",
            description: `${activeMeds.length} medications are currently active. Ensure all providers are aware of your complete medication list.`,
            priority: "medium"
          });
        }
        break;
      
      case "labs":
        const criticalLabs = viewData.filter((l: FHIRLabResult) => l.interpretation === 'critical');
        if (criticalLabs.length > 0) {
          highlights.push({
            category: "attention",
            title: "Critical Lab Values",
            description: `${criticalLabs.length} test result${criticalLabs.length > 1 ? 's require' : ' requires'} attention: ${criticalLabs.map((l: FHIRLabResult) => l.testName).join(', ')}`,
            relatedData: criticalLabs.map((l: FHIRLabResult) => l.id),
            priority: "high"
          });
        }
        break;

      case "conditions":
        const severeConditions = viewData.filter((c: FHIRCondition) => c.severity === 'severe' && c.clinicalStatus === 'active');
        if (severeConditions.length > 0) {
          highlights.push({
            category: "attention",
            title: "Severe Active Conditions",
            description: `${severeConditions.length} condition${severeConditions.length > 1 ? 's are' : ' is'} marked as severe: ${severeConditions.map((c: FHIRCondition) => c.name).join(', ')}`,
            priority: "high"
          });
        }
        break;
    }

    return highlights;
  }

  private generateCrossDataInsights(data: PatientFHIRData, request: SummarizationRequest): CrossDataInsight[] {
    const insights: CrossDataInsight[] = [];

    if (data.medications && data.conditions) {
      const diabetesMeds = data.medications.filter(m => 
        m.name.toLowerCase().includes('metformin') || 
        m.name.toLowerCase().includes('insulin') ||
        m.reason?.toLowerCase().includes('diabetes')
      );
      const diabetesCondition = data.conditions.find(c => 
        c.name.toLowerCase().includes('diabetes')
      );
      
      if (diabetesMeds.length > 0 && diabetesCondition) {
        insights.push({
          title: "Diabetes Management",
          description: `${diabetesMeds.length} medication${diabetesMeds.length > 1 ? 's are' : ' is'} being used for diabetes management`,
          relatedCategories: ["medications", "conditions"],
          insight: `Active diabetes with ${diabetesMeds.length} related medication${diabetesMeds.length > 1 ? 's' : ''}`,
          significance: "medium"
        });
      }
    }

    if (data.labResults && data.conditions) {
      const a1cResults = data.labResults.filter(l => 
        l.testName.toLowerCase().includes('a1c') || l.testName.toLowerCase().includes('hemoglobin a1c')
      );
      if (a1cResults.length > 0) {
        const latest = a1cResults[0];
        insights.push({
          title: "Lab-Condition Connection",
          description: `Latest HbA1c result: ${latest.value}${latest.unit || '%'}`,
          relatedCategories: ["labs", "conditions"],
          insight: `Monitoring data available for chronic condition management`,
          significance: latest.interpretation === 'high' ? "high" : "medium"
        });
      }
    }

    return insights;
  }

  private generateLongitudinalTrends(data: PatientFHIRData): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];

    if (data.encounters && data.encounters.length > 2) {
      const sorted = [...data.encounters].sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      
      trends.push({
        metric: "Healthcare Utilization",
        trend: "stable",
        description: `${sorted.length} encounters recorded`,
        significance: "low"
      });
    }

    if (data.medications) {
      const activeCount = data.medications.filter(m => m.status === 'active').length;
      trends.push({
        metric: "Medication Count",
        trend: activeCount > 7 ? "fluctuating" : "stable",
        direction: activeCount > 7 ? "increasing" : "unchanged",
        description: `${activeCount} active medications`,
        significance: activeCount > 7 ? "medium" : "low"
      });
    }

    return trends;
  }

  private aggregateKeyHighlights(...highlightArrays: KeyHighlight[][]): KeyHighlight[] {
    const all = highlightArrays.flat();
    return all
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10);
  }

  private generateFallbackComprehensiveSummary(data: PatientFHIRData, request: SummarizationRequest): string {
    const parts: string[] = [];
    const intro = request.audience === 'patient' 
      ? "Here is an overview of your health information:"
      : request.audience === 'provider'
        ? "Comprehensive patient summary:"
        : "Care overview for your records:";
    
    parts.push(intro);

    if (data.conditions?.length) {
      const active = data.conditions.filter(c => c.clinicalStatus === 'active');
      parts.push(`\n\n**Health Conditions:** ${data.conditions.length} documented (${active.length} active)`);
      if (active.length > 0) {
        parts.push(`Active: ${active.slice(0, 4).map(c => c.name).join(', ')}${active.length > 4 ? '...' : ''}`);
      }
    }

    if (data.medications?.length) {
      const active = data.medications.filter(m => m.status === 'active');
      parts.push(`\n\n**Medications:** ${active.length} active medications`);
      if (active.length > 0) {
        parts.push(`Current: ${active.slice(0, 4).map(m => m.name).join(', ')}${active.length > 4 ? '...' : ''}`);
      }
    }

    if (data.labResults?.length) {
      const abnormal = data.labResults.filter(l => l.interpretation && l.interpretation !== 'normal');
      parts.push(`\n\n**Laboratory Results:** ${data.labResults.length} results on file`);
      if (abnormal.length > 0) {
        parts.push(`${abnormal.length} result${abnormal.length > 1 ? 's' : ''} outside normal range`);
      }
    }

    if (data.encounters?.length) {
      parts.push(`\n\n**Healthcare Visits:** ${data.encounters.length} encounters documented`);
    }

    return parts.join('\n');
  }

  async getSamplePatientData(patientId: string): Promise<PatientFHIRData> {
    return {
      patientId,
      patientName: "Sample Patient",
      medications: [
        { id: "med-1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", status: "active", startDate: "2023-06-15", reason: "Type 2 Diabetes" },
        { id: "med-2", name: "Lisinopril", dosage: "10mg", frequency: "Once daily", status: "active", startDate: "2023-01-10", reason: "Hypertension" },
        { id: "med-3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", status: "active", startDate: "2023-03-22", reason: "High Cholesterol" },
        { id: "med-4", name: "Aspirin", dosage: "81mg", frequency: "Once daily", status: "active", startDate: "2022-11-05", reason: "Cardiovascular prevention" },
        { id: "med-5", name: "Omeprazole", dosage: "20mg", frequency: "Once daily before breakfast", status: "stopped", startDate: "2023-01-01", endDate: "2024-06-01" }
      ],
      conditions: [
        { id: "cond-1", name: "Type 2 Diabetes Mellitus", clinicalStatus: "active", severity: "moderate", onsetDate: "2021-03-15", category: "Endocrine" },
        { id: "cond-2", name: "Essential Hypertension", clinicalStatus: "active", severity: "mild", onsetDate: "2020-08-22", category: "Cardiovascular" },
        { id: "cond-3", name: "Hyperlipidemia", clinicalStatus: "active", severity: "mild", onsetDate: "2022-01-10", category: "Metabolic" },
        { id: "cond-4", name: "Seasonal Allergies", clinicalStatus: "active", severity: "mild", onsetDate: "2015-04-01", category: "Immunologic" },
        { id: "cond-5", name: "Appendectomy", clinicalStatus: "resolved", onsetDate: "2010-07-20", abatementDate: "2010-07-22", category: "Surgical" }
      ],
      labResults: [
        { id: "lab-1", testName: "Hemoglobin A1c", value: 7.2, unit: "%", referenceRange: "4.0-5.6", interpretation: "high", date: "2024-12-15", status: "final" },
        { id: "lab-2", testName: "Fasting Glucose", value: 142, unit: "mg/dL", referenceRange: "70-100", interpretation: "high", date: "2024-12-15", status: "final" },
        { id: "lab-3", testName: "Total Cholesterol", value: 195, unit: "mg/dL", referenceRange: "<200", interpretation: "normal", date: "2024-12-15", status: "final" },
        { id: "lab-4", testName: "LDL Cholesterol", value: 110, unit: "mg/dL", referenceRange: "<100", interpretation: "high", date: "2024-12-15", status: "final" },
        { id: "lab-5", testName: "HDL Cholesterol", value: 52, unit: "mg/dL", referenceRange: ">40", interpretation: "normal", date: "2024-12-15", status: "final" },
        { id: "lab-6", testName: "Creatinine", value: 0.9, unit: "mg/dL", referenceRange: "0.7-1.3", interpretation: "normal", date: "2024-12-15", status: "final" },
        { id: "lab-7", testName: "Blood Pressure", value: "138/88", unit: "mmHg", referenceRange: "<120/80", interpretation: "high", date: "2024-12-20", status: "final" }
      ],
      encounters: [
        { id: "enc-1", type: "Office Visit", status: "finished", class: "ambulatory", startDate: "2024-12-20", provider: "Dr. Smith", facility: "Primary Care Clinic", reasonForVisit: "Diabetes follow-up" },
        { id: "enc-2", type: "Lab Work", status: "finished", class: "ambulatory", startDate: "2024-12-15", facility: "Quest Diagnostics", reasonForVisit: "Routine labs" },
        { id: "enc-3", type: "Annual Physical", status: "finished", class: "ambulatory", startDate: "2024-09-10", provider: "Dr. Smith", facility: "Primary Care Clinic", reasonForVisit: "Preventive care" },
        { id: "enc-4", type: "Telehealth Visit", status: "finished", class: "virtual", startDate: "2024-07-22", provider: "Dr. Johnson", reasonForVisit: "Medication review" }
      ]
    };
  }
}

export const aiFHIRDataSummarizationService = new AIFHIRDataSummarizationService();
