// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface ImagingStudy {
  id: string;
  modality: string; // CT, MRI, X-Ray, Ultrasound, PET, etc.
  bodyPart: string;
  studyDate: string;
  orderingProvider?: string;
  indication?: string;
  status: string;
}

export interface ImagingReport {
  studyId: string;
  reportText: string;
  findings?: string;
  impression?: string;
  radiologist?: string;
  reportDate: string;
}

export interface DiagnosticFinding {
  finding: string;
  location?: string;
  significance: 'normal' | 'incidental' | 'notable' | 'critical';
  followUpMentioned?: boolean;
}

export interface ImagingAnalysisResult {
  studyId: string;
  studyType: string;
  bodyPart: string;
  studyDate: string;
  summary: string;
  keyFindings: DiagnosticFinding[];
  technicalNotes: string[];
  comparisonNotes: string[];
  patientFriendlySummary: string;
  terminology: Array<{
    term: string;
    definition: string;
  }>;
  generatedAt: string;
  disclaimer: string;
}

const IMAGING_CACHE = new Map<string, { result: ImagingAnalysisResult; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export class AIImagingDiagnosticService {
  async analyzeImagingReport(study: ImagingStudy, report: ImagingReport): Promise<ImagingAnalysisResult> {
    const cacheKey = `imaging-${study.id}`;
    const cached = IMAGING_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return this.generateFallbackAnalysis(study, report);
      }
      
      const prompt = this.buildAnalysisPrompt(study, report);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical documentation assistant that helps organize and explain imaging report content in plain language.

CRITICAL COMPLIANCE REQUIREMENTS:
- You are STRICTLY PROHIBITED from providing clinical decision support, treatment recommendations, or diagnostic conclusions
- All outputs are INFORMATIONAL ONLY for documentation review and patient understanding
- You ONLY summarize and explain what the radiologist has already documented
- Never suggest diagnoses, additional imaging, or clinical actions
- Your role is to make existing documentation more accessible, not to interpret images
- Always include appropriate disclaimers
- When explaining medical terms, provide educational definitions only

Your role is to help patients and caregivers understand the documented findings in their imaging reports by providing plain-language explanations of medical terminology and organizing the information clearly.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.generateFallbackAnalysis(study, report);
      }

      const parsed = JSON.parse(content);
      const result = this.parseAIResponse(study, report, parsed);
      
      IMAGING_CACHE.set(cacheKey, { result, timestamp: Date.now() });
      return result;

    } catch (error) {
      console.error("AI imaging analysis failed:", error);
      return this.generateFallbackAnalysis(study, report);
    }
  }

  async explainImagingTerm(term: string): Promise<{ term: string; definition: string; context: string }> {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return {
          term,
          definition: "A medical imaging term. Please consult your healthcare provider for a detailed explanation.",
          context: "Medical imaging reports"
        };
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical educator explaining radiology terminology to patients in simple terms. Provide clear, educational definitions without any clinical interpretation or medical advice.`
          },
          {
            role: "user",
            content: `Explain the medical imaging term "${term}" in simple, patient-friendly language. Return JSON: {"term": "${term}", "definition": "simple explanation", "context": "where this term is commonly used in imaging"}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("Term explanation failed:", error);
    }

    return {
      term,
      definition: "A medical imaging term. Please consult your healthcare provider for a detailed explanation.",
      context: "Medical imaging reports"
    };
  }

  private buildAnalysisPrompt(study: ImagingStudy, report: ImagingReport): string {
    return `Analyze and summarize this imaging report for documentation review. This is INFORMATIONAL ONLY - do NOT provide diagnostic conclusions or recommendations.

Study Information:
- Type: ${study.modality}
- Body Part: ${study.bodyPart}
- Date: ${study.studyDate}
- Indication: ${study.indication || 'Not specified'}

Radiologist Report:
${report.reportText}

${report.findings ? `Findings Section: ${report.findings}` : ''}
${report.impression ? `Impression Section: ${report.impression}` : ''}

Return JSON with the following structure:
{
  "summary": "Brief summary of what the study examined and documented findings",
  "keyFindings": [
    {
      "finding": "Description of documented finding",
      "location": "Anatomical location if mentioned",
      "significance": "normal|incidental|notable|critical based on radiologist's language",
      "followUpMentioned": true/false
    }
  ],
  "technicalNotes": ["Any technical aspects mentioned (contrast, positioning, etc.)"],
  "comparisonNotes": ["Any comparisons to prior studies mentioned"],
  "patientFriendlySummary": "Plain-language explanation of what the report says for patient understanding",
  "terminology": [
    {
      "term": "Medical term used in report",
      "definition": "Simple explanation of what it means"
    }
  ]
}

Focus on organizing and explaining the documented content. Do not add interpretations beyond what the radiologist wrote.`;
  }

  private parseAIResponse(study: ImagingStudy, report: ImagingReport, parsed: any): ImagingAnalysisResult {
    return {
      studyId: study.id,
      studyType: study.modality,
      bodyPart: study.bodyPart,
      studyDate: study.studyDate,
      summary: parsed.summary || `${study.modality} study of ${study.bodyPart} performed on ${study.studyDate}.`,
      keyFindings: (parsed.keyFindings || []).map((f: any) => ({
        finding: f.finding || '',
        location: f.location,
        significance: f.significance || 'normal',
        followUpMentioned: f.followUpMentioned || false
      })),
      technicalNotes: parsed.technicalNotes || [],
      comparisonNotes: parsed.comparisonNotes || [],
      patientFriendlySummary: parsed.patientFriendlySummary || 
        `This ${study.modality} scan examined your ${study.bodyPart}. Please discuss the detailed findings with your healthcare provider.`,
      terminology: parsed.terminology || [],
      generatedAt: new Date().toISOString(),
      disclaimer: "INFORMATIONAL ONLY: This summary explains the documented radiologist findings and does not constitute diagnostic interpretation or medical advice. The original report and images should be reviewed by qualified healthcare providers for clinical decision-making."
    };
  }

  private generateFallbackAnalysis(study: ImagingStudy, report: ImagingReport): ImagingAnalysisResult {
    const findings = this.extractBasicFindings(report);
    const terminology = this.extractCommonTerms(report.reportText);

    return {
      studyId: study.id,
      studyType: study.modality,
      bodyPart: study.bodyPart,
      studyDate: study.studyDate,
      summary: `${study.modality} imaging study of the ${study.bodyPart} performed on ${study.studyDate}. ${study.indication ? `Clinical indication: ${study.indication}.` : ''}`,
      keyFindings: findings,
      technicalNotes: this.extractTechnicalNotes(report.reportText),
      comparisonNotes: this.extractComparisonNotes(report.reportText),
      patientFriendlySummary: `This is a ${study.modality} scan that looked at your ${study.bodyPart}. Your healthcare provider can explain the specific findings and what they mean for your care.`,
      terminology,
      generatedAt: new Date().toISOString(),
      disclaimer: "INFORMATIONAL ONLY: This summary explains the documented radiologist findings and does not constitute diagnostic interpretation or medical advice. The original report and images should be reviewed by qualified healthcare providers for clinical decision-making."
    };
  }

  private extractBasicFindings(report: ImagingReport): DiagnosticFinding[] {
    const findings: DiagnosticFinding[] = [];
    const text = (report.findings || report.reportText).toLowerCase();

    // Look for common finding patterns
    if (text.includes('normal') || text.includes('unremarkable') || text.includes('no acute')) {
      findings.push({
        finding: 'Normal/unremarkable findings documented',
        significance: 'normal',
        followUpMentioned: false
      });
    }

    if (text.includes('follow') || text.includes('recommend')) {
      findings.push({
        finding: 'Follow-up mentioned in report',
        significance: 'notable',
        followUpMentioned: true
      });
    }

    if (text.includes('incidental')) {
      findings.push({
        finding: 'Incidental finding(s) noted',
        significance: 'incidental',
        followUpMentioned: false
      });
    }

    if (findings.length === 0) {
      findings.push({
        finding: 'Please review the full report with your healthcare provider',
        significance: 'normal',
        followUpMentioned: false
      });
    }

    return findings;
  }

  private extractTechnicalNotes(text: string): string[] {
    const notes: string[] = [];
    const lower = text.toLowerCase();

    if (lower.includes('contrast')) notes.push('Contrast agent used in study');
    if (lower.includes('non-contrast')) notes.push('Study performed without contrast');
    if (lower.includes('limited') && lower.includes('motion')) notes.push('Motion artifact noted');
    if (lower.includes('suboptimal')) notes.push('Technical limitations noted');

    return notes;
  }

  private extractComparisonNotes(text: string): string[] {
    const notes: string[] = [];
    const lower = text.toLowerCase();

    if (lower.includes('compared to') || lower.includes('comparison')) {
      notes.push('Comparison to prior study documented');
    }
    if (lower.includes('stable') || lower.includes('unchanged')) {
      notes.push('Findings noted as stable compared to prior');
    }
    if (lower.includes('interval change') || lower.includes('new')) {
      notes.push('Interval changes from prior study noted');
    }

    return notes;
  }

  private extractCommonTerms(text: string): Array<{ term: string; definition: string }> {
    const termDefinitions: Record<string, string> = {
      'opacity': 'An area that appears denser or whiter on the image',
      'lucency': 'An area that appears darker or more transparent on the image',
      'effusion': 'Fluid collection in a body cavity',
      'consolidation': 'An area where the normally air-filled lung tissue has become solid',
      'nodule': 'A small rounded growth or mass',
      'lesion': 'An area of abnormal tissue',
      'atelectasis': 'Partial or complete collapse of lung tissue',
      'edema': 'Swelling caused by excess fluid',
      'stenosis': 'Narrowing of a passage or vessel',
      'enhancement': 'Increased brightness after contrast injection',
      'calcification': 'Deposits of calcium in tissue',
      'artifact': 'Image distortion not related to the patient anatomy'
    };

    const found: Array<{ term: string; definition: string }> = [];
    const lower = text.toLowerCase();

    for (const [term, definition] of Object.entries(termDefinitions)) {
      if (lower.includes(term)) {
        found.push({ term, definition });
      }
    }

    return found.slice(0, 6); // Limit to 6 terms
  }
}

export const aiImagingDiagnosticService = new AIImagingDiagnosticService();
