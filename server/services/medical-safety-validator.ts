import { randomUUID } from "crypto";

interface SafetyCheckResult {
  id: string;
  timestamp: string;
  passed: boolean;
  checks: SafetyCheck[];
  summary: string;
  overallRisk: "low" | "medium" | "high" | "critical";
}

interface SafetyCheck {
  name: string;
  category: "cds_compliance" | "hallucination" | "phi_leakage" | "prompt_injection" | "bias" | "toxicity" | "accuracy";
  passed: boolean;
  severity: "low" | "medium" | "high" | "critical";
  details: string;
  remediation?: string;
}

const CDS_FORBIDDEN_PATTERNS = [
  /you should (take|stop|start|change|increase|decrease)/i,
  /I (recommend|suggest|advise|prescribe)/i,
  /diagnosis (is|suggests|indicates|confirms)/i,
  /treatment (plan|recommendation|should)/i,
  /you (have|probably have|likely have|may have) (a |an )?(disease|condition|disorder|syndrome|infection)/i,
  /take \d+ ?(mg|ml|mcg|units?)/i,
  /stop taking/i,
  /do not take/i,
  /seek (immediate|emergency|urgent) (medical )?care/i,
];

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{9}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b/,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
  /\bMRN[:\s#]*\d{4,}\b/i,
  /\bDOB[:\s]*\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all |your |previous )?instructions/i,
  /forget (all |your |previous )?instructions/i,
  /you are now/i,
  /system prompt/i,
  /override (your |the )?safety/i,
  /pretend (you are|to be)/i,
  /act as (a |an )?doctor/i,
  /jailbreak/i,
];

class MedicalSafetyValidatorService {
  constructor() {
    console.log("[MedicalSafety] Validator initialized");
    console.log("[MedicalSafety] Checks: NO-CDS compliance, PHI leakage, prompt injection, hallucination markers");
    console.log("[MedicalSafety] Integrated with CI/CD pipeline for pre-deployment validation");
  }

  async validateAIOutput(output: string, context?: { promptType?: string; model?: string }): Promise<SafetyCheckResult> {
    const checks: SafetyCheck[] = [];

    checks.push(this.checkCDSCompliance(output));
    checks.push(this.checkPHILeakage(output));
    checks.push(this.checkHallucinationMarkers(output));
    checks.push(this.checkPromptInjection(output));
    checks.push(this.checkDisclaimerPresence(output));
    checks.push(this.checkConfidenceCalibration(output));

    const passed = checks.every((c) => c.passed || c.severity === "low");
    const maxSeverity = checks.reduce((max, c) => {
      if (!c.passed) {
        const order = { low: 0, medium: 1, high: 2, critical: 3 };
        return order[c.severity] > order[max] ? c.severity : max;
      }
      return max;
    }, "low" as SafetyCheck["severity"]);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      passed,
      checks,
      summary: passed
        ? "All medical safety checks passed"
        : `${checks.filter((c) => !c.passed).length} safety issue(s) detected (${maxSeverity} severity)`,
      overallRisk: maxSeverity,
    };
  }

  private checkCDSCompliance(output: string): SafetyCheck {
    const violations: string[] = [];
    for (const pattern of CDS_FORBIDDEN_PATTERNS) {
      const match = output.match(pattern);
      if (match) violations.push(match[0]);
    }

    return {
      name: "NO-CDS Compliance",
      category: "cds_compliance",
      passed: violations.length === 0,
      severity: violations.length > 0 ? "critical" : "low",
      details: violations.length > 0
        ? `Found ${violations.length} potential CDS violation(s): ${violations.slice(0, 3).join(", ")}`
        : "No clinical decision support language detected",
      remediation: violations.length > 0 ? "Remove or rephrase clinical recommendations. Use informational language only." : undefined,
    };
  }

  private checkPHILeakage(output: string): SafetyCheck {
    const leaks: string[] = [];
    for (const pattern of PHI_PATTERNS) {
      if (pattern.test(output)) leaks.push(pattern.source);
    }

    return {
      name: "PHI Leakage Detection",
      category: "phi_leakage",
      passed: leaks.length === 0,
      severity: leaks.length > 0 ? "critical" : "low",
      details: leaks.length > 0
        ? `Detected ${leaks.length} potential PHI pattern(s) in output`
        : "No PHI patterns detected in output",
      remediation: leaks.length > 0 ? "Redact or mask all personally identifiable health information before display." : undefined,
    };
  }

  private checkHallucinationMarkers(output: string): SafetyCheck {
    const markers = [
      { pattern: /studies show|research (has )?shown|according to (a |recent )?stud/i, label: "Unsourced study claim" },
      { pattern: /\d{1,3}% (of patients|of people|chance|probability|likelihood)/i, label: "Unverified statistic" },
      { pattern: /always|never|guaranteed|100%|certain(ly)?/i, label: "Absolute certainty claim" },
      { pattern: /FDA approved for|FDA-approved/i, label: "Regulatory claim" },
    ];

    const found = markers.filter((m) => m.pattern.test(output));

    return {
      name: "Hallucination Risk Assessment",
      category: "hallucination",
      passed: found.length <= 1,
      severity: found.length > 2 ? "high" : found.length > 0 ? "medium" : "low",
      details: found.length > 0
        ? `Found ${found.length} hallucination risk marker(s): ${found.map((f) => f.label).join(", ")}`
        : "No hallucination markers detected",
      remediation: found.length > 0 ? "Add citations or qualify claims with 'consult your healthcare provider' language." : undefined,
    };
  }

  private checkPromptInjection(input: string): SafetyCheck {
    const injections = PROMPT_INJECTION_PATTERNS.filter((p) => p.test(input));

    return {
      name: "Prompt Injection Detection",
      category: "prompt_injection",
      passed: injections.length === 0,
      severity: injections.length > 0 ? "high" : "low",
      details: injections.length > 0
        ? `Detected ${injections.length} prompt injection pattern(s)`
        : "No prompt injection patterns detected",
      remediation: injections.length > 0 ? "Sanitize input and enforce system prompt boundaries." : undefined,
    };
  }

  private checkDisclaimerPresence(output: string): SafetyCheck {
    const hasDisclaimer = /not medical advice|informational (purposes )?only|consult.*(doctor|provider|physician|healthcare)/i.test(output);
    const isClinical = /diagnosis|treatment|medication|prescription|lab result|condition/i.test(output);

    return {
      name: "Disclaimer Presence",
      category: "accuracy",
      passed: !isClinical || hasDisclaimer,
      severity: isClinical && !hasDisclaimer ? "medium" : "low",
      details: !isClinical
        ? "Non-clinical content — disclaimer not required"
        : hasDisclaimer
          ? "Appropriate disclaimer found in clinical output"
          : "Clinical content detected without informational disclaimer",
      remediation: isClinical && !hasDisclaimer ? "Add standard disclaimer: 'This information is for informational purposes only and does not constitute medical advice.'" : undefined,
    };
  }

  private checkConfidenceCalibration(output: string): SafetyCheck {
    const confidenceMentions = output.match(/confidence[:\s]*(\d+)/gi) || [];
    const highConfidence = confidenceMentions.filter((m) => {
      const num = parseInt(m.match(/\d+/)?.[0] || "0");
      return num > 95;
    });

    return {
      name: "Confidence Calibration",
      category: "accuracy",
      passed: highConfidence.length === 0,
      severity: highConfidence.length > 0 ? "medium" : "low",
      details: highConfidence.length > 0
        ? `Found ${highConfidence.length} overconfident assertion(s) (>95%)`
        : "Confidence levels appear properly calibrated",
      remediation: highConfidence.length > 0 ? "Cap displayed confidence at 95% and add uncertainty language." : undefined,
    };
  }

  async validatePromptTemplate(template: string): Promise<SafetyCheckResult> {
    const checks: SafetyCheck[] = [];

    const hasNoCDS = /NO.?CDS|no clinical decision support/i.test(template);
    checks.push({
      name: "NO-CDS Policy in Prompt",
      category: "cds_compliance",
      passed: hasNoCDS,
      severity: hasNoCDS ? "low" : "critical",
      details: hasNoCDS ? "NO-CDS policy found in prompt template" : "NO-CDS policy MISSING from prompt template",
      remediation: !hasNoCDS ? "Add NO-CDS policy section to all medical AI prompts." : undefined,
    });

    const hasGuardrails = /you must never|do not|strictly limited/i.test(template);
    checks.push({
      name: "Safety Guardrails in Prompt",
      category: "cds_compliance",
      passed: hasGuardrails,
      severity: hasGuardrails ? "low" : "high",
      details: hasGuardrails ? "Safety guardrails found in prompt" : "No explicit safety guardrails in prompt",
      remediation: !hasGuardrails ? "Add explicit constraints about what the AI must NOT do." : undefined,
    });

    const passed = checks.every((c) => c.passed);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      passed,
      checks,
      summary: passed ? "Prompt template passes all safety checks" : "Prompt template has safety issues",
      overallRisk: passed ? "low" : "high",
    };
  }
}

export const medicalSafetyValidator = new MedicalSafetyValidatorService();
