/**
 * Centralized NO-CDS (No Clinical Decision Support) Guardrail Layer
 * 
 * Ensures all AI-generated content across the platform uses informational,
 * non-prescriptive language. This is a critical compliance requirement.
 * 
 * HIPAA Safe Harbor: AI outputs are informational tools for qualified
 * healthcare professionals, not clinical decision support systems.
 */

export const NO_CDS_POLICY = `=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice, prescriptions, or care plans
- Use prescriptive language (should, must, recommend, advise, prescribe)
- Make prognostic or diagnostic statements
- Suggest specific medications, dosages, or procedures

YOUR ROLE IS STRICTLY LIMITED TO:
- Organizing and summarizing existing documented health data
- Identifying statistical patterns and trends for provider review
- Flagging data points outside reference ranges
- Generating administrative and workflow content
- Presenting documented information in structured formats

ALL OUTPUT MUST:
- Use observational language (e.g., "data indicates", "records show", "values noted")
- Include disclaimer that content requires provider review
- Avoid any language that could be construed as clinical guidance
=== END NO-CDS POLICY ===`;

export const NO_CDS_DISCLAIMER = `DISCLAIMER: AI-generated content is for INFORMATIONAL and OPERATIONAL purposes only. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals based on their independent clinical judgment.`;

export const NO_CDS_DISCLAIMER_SHORT = `AI-generated informational content only. Not clinical decision support. Requires provider review.`;

const PRESCRIPTIVE_REPLACEMENTS: [RegExp, string][] = [
  [/\brecommend(s|ed|ing|ation|ations)?\b/gi, "data indicates"],
  [/\bshould\b/gi, "may"],
  [/\bmust\b/gi, "may"],
  [/\badvis(e|es|ed|ing)\b/gi, "note"],
  [/\bprescrib(e|es|ed|ing)\b/gi, "document"],
  [/\bdiagnos(e|es|ed|ing)\b/gi, "identify"],
  [/\btreat(s|ed|ing)?\b(?!\s*(as|like))/gi, "address"],
  [/\byou need to\b/gi, "it may be helpful to"],
  [/\bhas to\b/gi, "may"],
  [/\brequire(s|d)?\b/gi, "may benefit from"],
  [/\burgently\b/gi, "notably"],
  [/\bimmediate(ly)? (start|begin|initiate)\b/gi, "consider reviewing"],
  [/\bwe strongly\b/gi, "data"],
  [/\bI recommend\b/gi, "records indicate"],
  [/\bpatient should\b/gi, "patient may"],
  [/\bstart (taking|using|this)\b/gi, "consider"],
  [/\bstop (taking|using)\b/gi, "review"],
  [/\bincrease (the |your )?(dose|dosage|medication)\b/gi, "review dosage with provider"],
  [/\bdecrease (the |your )?(dose|dosage|medication)\b/gi, "review dosage with provider"],
  [/\badjust (the |your )?(dose|dosage|medication|treatment)\b/gi, "review with provider"],
  [/\bcontraindicated\b/gi, "flagged for review"],
  [/\bseek (medical |immediate )?(care|attention|help)\b/gi, "consider consulting provider"],
  [/\btake (this |the )?(medication|medicine|drug|pill)\b/gi, "review medication plan with provider"],
  [/\binitiate (treatment|therapy|medication)\b/gi, "consider reviewing"],
  [/\bdiscontinue\b/gi, "review continuation with provider"],
];

export function sanitizeNoCDS(text: string): string {
  if (!text || typeof text !== "string") return text;
  let result = text;
  for (const [pattern, replacement] of PRESCRIPTIVE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeNoCDSObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === "string") return sanitizeNoCDS(obj) as T;
  if (Array.isArray(obj)) return obj.map(sanitizeNoCDSObject) as T;
  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = sanitizeNoCDSObject(value);
    }
    return sanitized as T;
  }
  return obj;
}

export function wrapPromptWithNoCDS(prompt: string): string {
  return `${NO_CDS_POLICY}\n\n${prompt}`;
}

export function appendDisclaimer(content: string, short = false): string {
  const disclaimer = short ? NO_CDS_DISCLAIMER_SHORT : NO_CDS_DISCLAIMER;
  if (content.includes(disclaimer)) return content;
  return `${content}\n\n${disclaimer}`;
}

export interface NoCDSAuditEntry {
  timestamp: string;
  service: string;
  action: string;
  originalContainedPrescriptive: boolean;
  sanitized: boolean;
}

const auditLog: NoCDSAuditEntry[] = [];

export function logNoCDSCompliance(service: string, action: string, originalText: string, sanitizedText: string): void {
  auditLog.push({
    timestamp: new Date().toISOString(),
    service,
    action,
    originalContainedPrescriptive: originalText !== sanitizedText,
    sanitized: originalText !== sanitizedText,
  });
  if (auditLog.length > 10000) {
    auditLog.splice(0, auditLog.length - 5000);
  }
}

export function getNoCDSAuditLog(limit = 100): NoCDSAuditEntry[] {
  return auditLog.slice(-limit);
}

export function validateNoCDSCompliance(text: string): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  const checks: [RegExp, string][] = [
    [/\brecommend(s|ed|ing|ation)?\b/i, "Contains prescriptive 'recommend'"],
    [/\bshould\b/i, "Contains directive 'should'"],
    [/\bmust\b/i, "Contains directive 'must'"],
    [/\badvis(e|es|ed|ing)\b/i, "Contains prescriptive 'advise'"],
    [/\bprescrib(e|es|ed|ing)\b/i, "Contains prescriptive 'prescribe'"],
    [/\byou need to\b/i, "Contains directive 'you need to'"],
    [/\bstart taking\b/i, "Contains treatment directive 'start taking'"],
    [/\bstop taking\b/i, "Contains treatment directive 'stop taking'"],
    [/\bI recommend\b/i, "Contains first-person recommendation"],
    [/\bdiagnosis is\b/i, "Contains diagnostic statement"],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(text)) {
      violations.push(message);
    }
  }
  return { compliant: violations.length === 0, violations };
}

export const NO_CDS_SYSTEM_PROMPTS = {
  patientSummary: wrapPromptWithNoCDS(
    `You are a healthcare data organizer. Produce a comprehensive patient record overview from the provided health data. Use observational language only. Frame all output as documented data observations, not clinical guidance.`
  ),
  referralLetter: wrapPromptWithNoCDS(
    `You are a clinical correspondence assistant. Draft a professional referral letter based on documented patient information. Present documented findings only. Do not add clinical opinions beyond what is explicitly documented.`
  ),
  differentialDx: wrapPromptWithNoCDS(
    `You are a medical literature reference tool. Based on the provided symptoms, list conditions commonly associated with these symptom patterns in peer-reviewed medical literature. Frame all output as literature references, not clinical assessments. Include confidence levels based on symptom pattern matching.`
  ),
  trendAnalysis: wrapPromptWithNoCDS(
    `You are a clinical data analyst. Analyze the provided health data for statistical trends and patterns. Present observations as data-driven findings for provider review. Do not interpret clinical significance.`
  ),
  documentSummary: wrapPromptWithNoCDS(
    `You are a clinical documentation specialist. Summarize clinical documentation while preserving key information. Extract and organize data points without adding clinical interpretation.`
  ),
  taskGeneration: wrapPromptWithNoCDS(
    `You are an administrative workflow assistant. Generate prioritized task lists based on patient panel data and operational needs. Focus on administrative, follow-up, and coordination tasks only.`
  ),
  clinicalNotes: wrapPromptWithNoCDS(
    `You are a clinical documentation assistant generating SOAP-style notes from documented data. Present documented findings in structured format without adding clinical interpretation or recommendations.`
  ),
  healthEducation: wrapPromptWithNoCDS(
    `You are a health information organizer. Present general health education content from established medical reference sources. Frame all content as general health information, not personalized medical advice.`
  ),
  riskAnalysis: wrapPromptWithNoCDS(
    `You are a population health data analyst. Identify statistical risk patterns from documented health data. Present findings as data observations with confidence scores, not clinical predictions.`
  ),
};
