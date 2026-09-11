import { generatePhiSafeText } from "./services/ai-gateway";

export interface TranslatedImagingReport {
  id: string;
  originalReportId: string;
  whatWasScanned: {
    modality: string;
    bodyPart: string;
    description: string;
  };
  keyFindings: Array<{
    finding: string;
    quote: string;
    explanation: string;
  }>;
  impression: {
    quote: string;
    plainLanguage: string;
  };
  scaryTermDefinitions: Array<{
    term: string;
    definition: string;
    reassurance: string;
  }>;
  disclaimer: string;
  generatedAt: string;
}

const MANDATORY_DISCLAIMER = "This is informational only; please discuss with your clinician.";

const FORBIDDEN_PHRASES = [
  /\bcancer\b/gi,
  /\bcancerous\b/gi,
  /\bmalignant\b/gi,
  /\bmalignancy\b/gi,
  /\byou need follow[- ]?up\b/gi,
  /\byou should follow[- ]?up\b/gi,
  /\bmust follow[- ]?up\b/gi,
  /\brequires? follow[- ]?up\b/gi,
  /\bseek immediate\b/gi,
  /\bgo to (the )?emergency\b/gi,
];

const SAFE_REPLACEMENTS: Record<string, string> = {
  "cancer": "area requiring further evaluation",
  "cancerous": "abnormal",
  "malignant": "concerning",
  "malignancy": "abnormal finding",
};

function sanitizeText(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  for (const pattern of FORBIDDEN_PHRASES) {
    sanitized = sanitized.replace(pattern, (match) => {
      const lower = match.toLowerCase();
      return SAFE_REPLACEMENTS[lower] || "area of concern";
    });
  }
  
  return sanitized;
}

function sanitizeTranslatedReport(report: TranslatedImagingReport): TranslatedImagingReport {
  report.disclaimer = MANDATORY_DISCLAIMER;
  
  if (report.whatWasScanned) {
    report.whatWasScanned.description = sanitizeText(report.whatWasScanned.description);
  }
  
  report.keyFindings = report.keyFindings.map(finding => ({
    ...finding,
    finding: sanitizeText(finding.finding),
    explanation: sanitizeText(finding.explanation),
  }));
  
  if (report.impression) {
    report.impression.plainLanguage = sanitizeText(report.impression.plainLanguage);
  }
  
  report.scaryTermDefinitions = report.scaryTermDefinitions.map(term => ({
    ...term,
    definition: sanitizeText(term.definition),
    reassurance: sanitizeText(term.reassurance),
  }));
  
  return report;
}

const SAFE_FRAMING_RULES = `
CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. NEVER use the word "cancer" - use phrases like "abnormal cells" or "area requiring further evaluation" if needed
2. NEVER say "you need follow up" or any variation - do not give recommendations
3. ALWAYS include the disclaimer: "This is informational only; please discuss with your clinician."
4. Provide ONLY benign, reassuring explanations for medical terms
5. Quote directly from the report for findings and impressions
6. Explain terms in plain language without causing alarm
7. Focus on WHAT was found, not what it MEANS for the patient's health
8. Do not interpret severity or make prognostic statements
`;

export async function translateImagingReport(
  reportText: string,
  patientId: string
): Promise<TranslatedImagingReport> {
  const prompt = `You are a radiology report translator that helps patients understand their imaging reports. 

${SAFE_FRAMING_RULES}

Analyze this radiology report and extract:

1. WHAT WAS SCANNED: Identify the imaging modality (CT, MRI, X-ray, Ultrasound, etc.), body part, and brief description of the exam.

2. KEY FINDINGS: Extract 3-5 important findings, quoting directly from the report. For each finding, provide a simple plain-language explanation that is reassuring and informational.

3. IMPRESSION: Quote the radiologist's impression section and provide a plain-language summary.

4. SCARY TERM DEFINITIONS: Identify any medical terms that might concern a patient and provide benign, reassuring definitions. Common examples:
   - "nodule" = a small rounded area that can be completely normal
   - "opacity" = an area that appears lighter on the image, very common
   - "lesion" = simply means "area of interest"
   - "mass" = any area that appears different, often benign

RADIOLOGY REPORT:
${reportText}

Respond in JSON format:
{
  "whatWasScanned": {
    "modality": "CT Scan",
    "bodyPart": "Chest",
    "description": "CT scan of the chest with contrast"
  },
  "keyFindings": [
    {
      "finding": "Clear lung fields",
      "quote": "Lungs are clear bilaterally without focal consolidation",
      "explanation": "Your lungs appear healthy with no concerning areas"
    }
  ],
  "impression": {
    "quote": "No acute cardiopulmonary process",
    "plainLanguage": "The heart and lungs look normal on this scan"
  },
  "scaryTermDefinitions": [
    {
      "term": "bilateral",
      "definition": "Simply means 'on both sides'",
      "reassurance": "This is a standard descriptive term radiologists use"
    }
  ]
}`;

  try {
    const content = await generatePhiSafeText({
      system: "You are a patient-friendly radiology report translator. You help patients understand their imaging reports without causing alarm. You NEVER use the word 'cancer', NEVER give follow-up recommendations, and ALWAYS encourage discussing with their clinician.",
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const result = JSON.parse(content || "{}");

    const translatedReport = {
      id: `img-trans-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      originalReportId: `report-${Date.now()}`,
      whatWasScanned: result.whatWasScanned || {
        modality: "Imaging Study",
        bodyPart: "Unknown",
        description: "Medical imaging examination",
      },
      keyFindings: result.keyFindings || [],
      impression: result.impression || {
        quote: "See full report",
        plainLanguage: "Please review the full report with your provider",
      },
      scaryTermDefinitions: result.scaryTermDefinitions || [],
      disclaimer: "This is informational only; please discuss with your clinician.",
      generatedAt: new Date().toISOString(),
    };

    return sanitizeTranslatedReport(translatedReport);
  } catch (error) {
    console.error("[ImagingTranslator] Translation error:", error);
    return {
      id: `img-trans-${Date.now()}`,
      originalReportId: `report-${Date.now()}`,
      whatWasScanned: {
        modality: "Unknown",
        bodyPart: "Unknown",
        description: "Unable to parse imaging report",
      },
      keyFindings: [],
      impression: {
        quote: "",
        plainLanguage: "Unable to translate report. Please review with your provider.",
      },
      scaryTermDefinitions: [],
      disclaimer: "This is informational only; please discuss with your clinician.",
      generatedAt: new Date().toISOString(),
    };
  }
}

const mockTranslatedReports: TranslatedImagingReport[] = [
  {
    id: "img-trans-1",
    originalReportId: "report-ct-chest-001",
    whatWasScanned: {
      modality: "CT Scan",
      bodyPart: "Chest",
      description: "CT scan of the chest with intravenous contrast to evaluate the lungs and surrounding structures",
    },
    keyFindings: [
      {
        finding: "Normal heart size",
        quote: "Heart size is within normal limits",
        explanation: "Your heart appears to be a healthy, normal size",
      },
      {
        finding: "Clear lungs",
        quote: "Lungs are clear bilaterally without focal consolidation or pleural effusion",
        explanation: "Both of your lungs look clear and healthy, with no fluid buildup",
      },
      {
        finding: "Small lymph nodes",
        quote: "A few small mediastinal lymph nodes are present, none meeting criteria for enlargement",
        explanation: "Some small lymph nodes were seen - this is completely normal. Everyone has lymph nodes, and these are a normal size",
      },
      {
        finding: "Normal bones",
        quote: "No suspicious osseous lesions identified",
        explanation: "The bones visible on the scan look normal",
      },
    ],
    impression: {
      quote: "No acute cardiopulmonary abnormality. Small mediastinal lymph nodes, likely reactive.",
      plainLanguage: "Overall, your chest scan looks normal. The small lymph nodes mentioned are very common and typically not a concern.",
    },
    scaryTermDefinitions: [
      {
        term: "bilateral",
        definition: "Simply means 'on both sides'",
        reassurance: "Radiologists use this standard term to describe findings on both the left and right sides",
      },
      {
        term: "mediastinal",
        definition: "The area in the middle of your chest between your lungs",
        reassurance: "This is just a location descriptor, like saying 'in your chest'",
      },
      {
        term: "reactive lymph nodes",
        definition: "Lymph nodes that are slightly active, often from fighting off a cold or infection",
        reassurance: "This is very common and usually means your immune system is working normally",
      },
      {
        term: "pleural effusion",
        definition: "Fluid around the lungs (which was NOT found in your scan)",
        reassurance: "The report confirms you do NOT have this",
      },
    ],
    disclaimer: "This is informational only; please discuss with your clinician.",
    generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "img-trans-2",
    originalReportId: "report-mri-brain-001",
    whatWasScanned: {
      modality: "MRI",
      bodyPart: "Brain",
      description: "MRI of the brain without contrast to evaluate for headaches",
    },
    keyFindings: [
      {
        finding: "Normal brain structure",
        quote: "Brain parenchyma demonstrates normal signal intensity throughout",
        explanation: "The brain tissue looks healthy with normal appearance",
      },
      {
        finding: "Normal ventricles",
        quote: "Ventricles are normal in size and configuration",
        explanation: "The fluid-filled spaces in your brain are a normal size and shape",
      },
      {
        finding: "No mass effect",
        quote: "No evidence of mass effect or midline shift",
        explanation: "Everything is in its normal position with no pressure on any structures",
      },
    ],
    impression: {
      quote: "Unremarkable MRI of the brain. No acute intracranial abnormality.",
      plainLanguage: "Your brain MRI looks completely normal with nothing concerning found.",
    },
    scaryTermDefinitions: [
      {
        term: "parenchyma",
        definition: "The main tissue of an organ - in this case, brain tissue",
        reassurance: "This is just the medical term for brain tissue",
      },
      {
        term: "ventricles",
        definition: "Normal fluid-filled spaces inside the brain",
        reassurance: "Everyone has ventricles - they're a normal part of brain anatomy",
      },
      {
        term: "unremarkable",
        definition: "Nothing unusual or concerning was found",
        reassurance: "In radiology, 'unremarkable' is great news - it means everything looks normal!",
      },
    ],
    disclaimer: "This is informational only; please discuss with your clinician.",
    generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function getTranslatedReports(patientId: string): Promise<TranslatedImagingReport[]> {
  return mockTranslatedReports;
}

export async function getTranslatedReportById(
  reportId: string,
  patientId: string
): Promise<TranslatedImagingReport | null> {
  return mockTranslatedReports.find(r => r.id === reportId) || null;
}
