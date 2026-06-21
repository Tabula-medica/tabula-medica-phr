import OpenAI from "openai";
import { storage } from "../storage";
import { NO_CDS_DISCLAIMER_SHORT } from "../security/no-cds-guardrails";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface FactClaim {
  id: string;
  text: string;
  category: "medication" | "condition" | "lab_result" | "vital_sign" | "procedure" | "allergy" | "demographic" | "appointment" | "general";
  verified: boolean;
  confidence: number;
  sourceFound: boolean;
  sourceReference?: string;
  sourceValue?: string;
  discrepancy?: string;
}

export interface AccuracyReport {
  summaryId: string;
  patientId: string;
  generatedAt: string;
  totalClaims: number;
  verifiedClaims: number;
  unverifiedClaims: number;
  discrepancies: number;
  accuracyScore: number;
  confidenceLevel: "high" | "medium" | "low";
  claims: FactClaim[];
  guardrailsPassed: boolean;
  noCdsCompliant: boolean;
  sourceDataTimestamp: string;
  warnings: string[];
  recommendations: string[];
}

export interface VerificationRequest {
  summaryText: string;
  patientId: string;
  summaryType?: string;
}

function generateClaimId(): string {
  return `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function extractFactClaims(summaryText: string): Promise<Omit<FactClaim, "verified" | "sourceFound" | "sourceReference" | "sourceValue" | "discrepancy">[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical fact extractor. Given a patient health summary, extract individual factual claims that can be verified against source records.

For each claim, provide:
- "text": The exact factual claim from the summary
- "category": One of: medication, condition, lab_result, vital_sign, procedure, allergy, demographic, appointment, general
- "confidence": How specific/verifiable the claim is (0.0-1.0, where 1.0 = very specific and checkable)

Return a JSON array of claims. Focus on extractable, verifiable facts (medication names, dosages, lab values, conditions, dates).
Do NOT include opinions, recommendations, or general health education statements.

Respond ONLY with a valid JSON array.`,
        },
        {
          role: "user",
          content: summaryText.slice(0, 4000),
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || '{"claims":[]}';
    const parsed = JSON.parse(content);
    const claims = Array.isArray(parsed) ? parsed : parsed.claims || [];

    return claims.map((c: any) => ({
      id: generateClaimId(),
      text: String(c.text || ""),
      category: c.category || "general",
      confidence: typeof c.confidence === "number" ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
    }));
  } catch (error: any) {
    console.error("[SummaryAccuracy] Claim extraction error:", error?.message);
    return extractClaimsFallback(summaryText);
  }
}

function extractClaimsFallback(text: string): Omit<FactClaim, "verified" | "sourceFound" | "sourceReference" | "sourceValue" | "discrepancy">[] {
  const claims: Omit<FactClaim, "verified" | "sourceFound" | "sourceReference" | "sourceValue" | "discrepancy">[] = [];

  const medPatterns = [
    /(?:taking|prescribed|on)\s+(\w+(?:\s+\w+)?)\s+(\d+\s*(?:mg|mcg|ml|units?))/gi,
    /(\w+(?:tin|pril|olol|ide|ine|ate|one|ium))\s+(\d+\s*(?:mg|mcg))/gi,
  ];
  for (const pattern of medPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        id: generateClaimId(),
        text: match[0],
        category: "medication",
        confidence: 0.8,
      });
    }
  }

  const labPatterns = [
    /(?:HbA1c|A1C|hemoglobin\s+A1c)\s*(?:of|:|\s)\s*([\d.]+)\s*%?/gi,
    /(?:blood\s+pressure|BP)\s*(?:of|:|\s)\s*(\d{2,3}\/\d{2,3})/gi,
    /(?:cholesterol|LDL|HDL|triglycerides?)\s*(?:of|:|\s)\s*([\d.]+)\s*(?:mg\/dL)?/gi,
    /(?:glucose|blood\s+sugar)\s*(?:of|:|\s)\s*([\d.]+)\s*(?:mg\/dL)?/gi,
    /(?:eGFR|GFR)\s*(?:of|:|\s)\s*([\d.]+)/gi,
    /(?:BMI)\s*(?:of|:|\s)\s*([\d.]+)/gi,
  ];
  for (const pattern of labPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        id: generateClaimId(),
        text: match[0],
        category: "lab_result",
        confidence: 0.9,
      });
    }
  }

  const condPatterns = [
    /(?:diagnosed\s+with|has|history\s+of)\s+((?:type\s+[12]\s+)?diabetes|hypertension|asthma|COPD|heart\s+failure|coronary\s+artery\s+disease|chronic\s+kidney|obesity|depression|anxiety)/gi,
  ];
  for (const pattern of condPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        id: generateClaimId(),
        text: match[0],
        category: "condition",
        confidence: 0.85,
      });
    }
  }

  const allergyPatterns = [
    /(?:allergic\s+to|allergy\s+to|known\s+allergy)\s+([\w\s,]+?)(?:\.|,|\band\b)/gi,
  ];
  for (const pattern of allergyPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        id: generateClaimId(),
        text: match[0],
        category: "allergy",
        confidence: 0.85,
      });
    }
  }

  return claims;
}

async function verifyClaimsAgainstRecords(
  claims: Omit<FactClaim, "verified" | "sourceFound" | "sourceReference" | "sourceValue" | "discrepancy">[],
  patientId: string
): Promise<FactClaim[]> {
  let medications: any[] = [];
  let labResults: any[] = [];
  let conditions: any[] = [];
  let allergies: any[] = [];

  try { medications = await storage.getMedicationsByPatient(patientId); } catch {}
  try { labResults = await storage.getLabResultsByPatient(patientId); } catch {}
  try { conditions = await storage.getConditionSpecificPROMs(patientId); } catch {}
  try { allergies = await storage.getAllergiesByPatient(patientId); } catch {}

  return claims.map((claim) => {
    const result: FactClaim = {
      ...claim,
      verified: false,
      sourceFound: false,
    };

    const claimLower = claim.text.toLowerCase();

    switch (claim.category) {
      case "medication": {
        const found = medications.find((m: any) => {
          const medName = (m.name || m.medicationName || "").toLowerCase();
          return claimLower.includes(medName) || medName.includes(claimLower.split(/\s+/)[0]?.toLowerCase() || "");
        });
        if (found) {
          result.sourceFound = true;
          result.sourceReference = `Medication record: ${found.name || found.medicationName}`;
          result.sourceValue = `${found.name || found.medicationName} ${found.dosage || ""} ${found.frequency || ""}`.trim();
          result.verified = true;
        }
        break;
      }
      case "condition": {
        const found = conditions.find((c: any) => {
          const condName = (c.conditionType || c.name || "").toLowerCase();
          return claimLower.includes(condName) || condName.split(/\s+/).some((w: string) => claimLower.includes(w));
        });
        if (found) {
          result.sourceFound = true;
          result.sourceReference = `Condition record: ${found.conditionType || found.name}`;
          result.sourceValue = found.conditionType || found.name;
          result.verified = true;
        }
        break;
      }
      case "lab_result": {
        const found = labResults.find((l: any) => {
          const testName = (l.testName || l.name || "").toLowerCase();
          return claimLower.includes(testName) || testName.split(/\s+/).some((w: string) => w.length > 2 && claimLower.includes(w));
        });
        if (found) {
          result.sourceFound = true;
          result.sourceReference = `Lab result: ${found.testName || found.name} (${found.date || found.collectedAt || ""})`;
          result.sourceValue = `${found.value} ${found.unit || ""}`.trim();
          const claimValue = claimLower.match(/([\d.]+)/)?.[1];
          if (claimValue && found.value && String(found.value) !== claimValue) {
            result.discrepancy = `Summary says ${claimValue}, record shows ${found.value}`;
            result.verified = false;
          } else {
            result.verified = true;
          }
        }
        break;
      }
      case "allergy": {
        const found = allergies.find((a: any) => {
          const allergen = (a.allergen || a.name || "").toLowerCase();
          return claimLower.includes(allergen) || allergen.split(/\s+/).some((w: string) => w.length > 2 && claimLower.includes(w));
        });
        if (found) {
          result.sourceFound = true;
          result.sourceReference = `Allergy record: ${found.allergen || found.name}`;
          result.sourceValue = `${found.allergen || found.name} (${found.reaction || found.severity || ""})`.trim();
          result.verified = true;
        }
        break;
      }
      default:
        result.confidence = Math.max(0.3, result.confidence - 0.2);
        break;
    }

    return result;
  });
}

function checkNoCdsCompliance(text: string): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  const prescriptivePatterns = [
    { pattern: /\byou should\b/gi, label: "Prescriptive language: 'you should'" },
    { pattern: /\bI recommend\b/gi, label: "Direct recommendation" },
    { pattern: /\btake this medication\b/gi, label: "Medication instruction" },
    { pattern: /\bstart taking\b/gi, label: "Treatment instruction" },
    { pattern: /\bstop taking\b/gi, label: "Treatment instruction" },
    { pattern: /\bincrease your dose\b/gi, label: "Dosage instruction" },
    { pattern: /\bdecrease your dose\b/gi, label: "Dosage instruction" },
    { pattern: /\byou have been diagnosed\b/gi, label: "Diagnostic statement" },
    { pattern: /\byou must\b/gi, label: "Prescriptive language: 'you must'" },
    { pattern: /\burgently needs?\b/gi, label: "Urgency language" },
  ];

  for (const { pattern, label } of prescriptivePatterns) {
    if (pattern.test(text)) {
      violations.push(label);
    }
  }

  return { compliant: violations.length === 0, violations };
}

export async function verifySummaryAccuracy(request: VerificationRequest): Promise<AccuracyReport> {
  const { summaryText, patientId, summaryType } = request;

  const rawClaims = await extractFactClaims(summaryText);
  const verifiedClaims = await verifyClaimsAgainstRecords(rawClaims, patientId);

  const noCdsCheck = checkNoCdsCompliance(summaryText);

  const verified = verifiedClaims.filter((c) => c.verified).length;
  const unverified = verifiedClaims.filter((c) => !c.verified && !c.discrepancy).length;
  const discrepancies = verifiedClaims.filter((c) => c.discrepancy).length;
  const total = verifiedClaims.length;

  const accuracyScore = total > 0 ? Math.round((verified / total) * 100) : 0;

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (discrepancies > 0) {
    warnings.push(`${discrepancies} factual discrepanc${discrepancies === 1 ? 'y' : 'ies'} detected between summary and source records`);
    recommendations.push("Review flagged discrepancies and update summary with correct values from source records");
  }

  if (unverified > 0) {
    warnings.push(`${unverified} claim${unverified === 1 ? '' : 's'} could not be verified against available records`);
    recommendations.push("Ensure all claims in the summary can be traced to specific source records");
  }

  if (!noCdsCheck.compliant) {
    warnings.push(`NO-CDS compliance violations detected: ${noCdsCheck.violations.join(", ")}`);
    recommendations.push("Remove prescriptive language and replace with observational statements");
  }

  if (total === 0) {
    warnings.push("No verifiable factual claims were extracted from this summary");
    recommendations.push("Summary may be too vague — include specific data points from patient records");
  }

  const confidenceLevel: "high" | "medium" | "low" =
    accuracyScore >= 85 && noCdsCheck.compliant ? "high" :
    accuracyScore >= 60 ? "medium" : "low";

  return {
    summaryId: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    generatedAt: new Date().toISOString(),
    totalClaims: total,
    verifiedClaims: verified,
    unverifiedClaims: unverified,
    discrepancies,
    accuracyScore,
    confidenceLevel,
    claims: verifiedClaims,
    guardrailsPassed: noCdsCheck.compliant,
    noCdsCompliant: noCdsCheck.compliant,
    sourceDataTimestamp: new Date().toISOString(),
    warnings,
    recommendations,
  };
}

export function getAccuracyChecklist(): {
  category: string;
  checks: { id: string; name: string; description: string; status: string; implementation: string }[];
}[] {
  return [
    {
      category: "Source Grounding",
      checks: [
        { id: "sg-1", name: "Data Provenance Tracking", description: "Every AI-generated claim links back to a specific source record with EHR/FHIR resource ID", status: "active", implementation: "server/explainability.ts — DataProvenance interface tracks source system, record ID, FHIR resource type" },
        { id: "sg-2", name: "Source-Grounded Display", description: "Side-by-side view of original clinical text vs AI-generated summary", status: "active", implementation: "client/src/components/translation/SourceGroundedSummary.tsx — sentence-by-sentence verification UI" },
        { id: "sg-3", name: "Evidence Citations", description: "Numbered citations linking summary sentences to source documents (labs, meds, encounters)", status: "active", implementation: "server/explainability.ts — EvidenceCitation interface with relevance scoring" },
        { id: "sg-4", name: "Confidence Scoring", description: "Every insight rated High/Medium/Low based on data completeness and recency", status: "active", implementation: "server/explainability.ts — weighted confidence scoring across multiple factors" },
      ],
    },
    {
      category: "Fact Verification",
      checks: [
        { id: "fv-1", name: "Automated Claim Extraction", description: "AI extracts individual verifiable claims (medications, values, conditions) from summaries", status: "active", implementation: "server/services/summary-accuracy-service.ts — GPT-4o structured extraction with regex fallback" },
        { id: "fv-2", name: "Record Cross-Referencing", description: "Each claim is checked against patient medications, labs, conditions, and allergy records", status: "active", implementation: "server/services/summary-accuracy-service.ts — verifyClaimsAgainstRecords function" },
        { id: "fv-3", name: "Value Discrepancy Detection", description: "Numeric values in summaries are compared against source record values", status: "active", implementation: "server/services/summary-accuracy-service.ts — lab_result verification with value comparison" },
        { id: "fv-4", name: "Accuracy Score Calculation", description: "Percentage of claims that can be verified against source records", status: "active", implementation: "server/services/summary-accuracy-service.ts — AccuracyReport with verified/unverified/discrepancy counts" },
      ],
    },
    {
      category: "Safety Guardrails",
      checks: [
        { id: "gr-1", name: "NO-CDS Compliance", description: "Summaries cannot contain clinical decision support, diagnoses, or treatment recommendations", status: "active", implementation: "server/security/no-cds-guardrails.ts — prescriptive language replacement; prompt-level enforcement" },
        { id: "gr-2", name: "Prescriptive Language Detection", description: "Regex patterns detect and flag 'should', 'must', 'recommend', 'prescribe' language", status: "active", implementation: "server/security/no-cds-guardrails.ts — PRESCRIPTIVE_REPLACEMENTS with 15+ patterns" },
        { id: "gr-3", name: "Mandatory Disclaimers", description: "Every AI output includes 'informational only' disclaimer", status: "active", implementation: "NO_CDS_DISCLAIMER appended to all AI-generated content" },
        { id: "gr-4", name: "Prompt Injection Prevention", description: "User input sanitized to prevent AI jailbreak attempts", status: "active", implementation: "server/security/prompt-sanitizer.ts — detectPotentialInjection, wrapUntrustedContent" },
        { id: "gr-5", name: "Medical Advice Blocking", description: "AI refuses requests for diagnoses, dosage changes, or treatment plans", status: "active", implementation: "server/ai-guardrail-service.ts — pattern matching with refusal responses" },
      ],
    },
    {
      category: "Transparency & Auditability",
      checks: [
        { id: "ta-1", name: "Reasoning Step Logging", description: "Every AI decision logs retrieval, classification, rule matching, and analysis steps", status: "active", implementation: "server/explainability.ts — ReasoningStep with action, input, output, and timing" },
        { id: "ta-2", name: "AI Model Provenance", description: "Model ID, version, temperature, and prompt template tracked for every generation", status: "active", implementation: "server/explainability.ts — AIModelInfo interface" },
        { id: "ta-3", name: "User Feedback Loop", description: "Users can rate accuracy and report errors on AI-generated content", status: "active", implementation: "client/src/components/ai-summary-feedback.tsx — star ratings, ReportErrorDialog" },
        { id: "ta-4", name: "PHI Access Auditing", description: "All data accessed for summary generation logged with HIPAA-compliant audit trail", status: "active", implementation: "server/security/hipaa-audit.ts — 7-year retention, WORM audit logs" },
      ],
    },
  ];
}
