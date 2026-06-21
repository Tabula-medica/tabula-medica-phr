/**
 * Record Observations Service
 * 
 * Identifies patterns in health records and generates discussion prompts.
 * 
 * SAFETY GUIDELINES:
 * - NO medication interaction advice
 * - NO interpretation of whether results are good/bad/abnormal
 * - NO clinical recommendations
 * - Quote-first approach: always quote the record before explaining
 * - Only generate discussion prompts for clinician
 * 
 * Approved safe verbs: "shows", "states", "refers to", "means"
 */

export interface MedicationObservation {
  type: "medication_list";
  medications: Array<{
    name: string;
    dosage: string;
    source: string;
    date: string;
  }>;
  discussionPrompts: string[];
  disclaimer: string;
}

export interface FindingObservation {
  type: "finding";
  quote: string;
  source: string;
  date: string;
  category: string;
  explanation: string;
  discussionPrompts: string[];
}

export interface RecordObservations {
  medicationObservations: MedicationObservation | null;
  findingObservations: FindingObservation[];
  disclaimer: string;
}

/**
 * Generate medication list observation (NO interaction advice)
 * Only quotes medications and provides discussion prompts
 */
export function getMedicationObservation(
  medications: Array<{ name: string; dosage: string; source: string; date: string }>
): MedicationObservation | null {
  if (medications.length === 0) return null;

  // Generate safe discussion prompts - no interaction warnings
  const discussionPrompts = [
    "Can you review my current medication list together?",
    "Are there any questions I should ask about taking these medications?",
    "Is this medication list up to date?",
  ];

  // Add prompt if multiple medications are listed
  if (medications.length >= 3) {
    discussionPrompts.push(
      "With multiple medications listed, what should I know about my regimen?"
    );
  }

  return {
    type: "medication_list",
    medications,
    discussionPrompts,
    disclaimer: "Informational only. Not medical advice.",
  };
}

/**
 * Generate finding observations from records (NO interpretation)
 * Only quotes findings and provides discussion prompts
 */
export function getFindingObservations(
  records: Array<{
    type: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    source: string;
    date: string;
  }>
): FindingObservation[] {
  const observations: FindingObservation[] = [];

  for (const record of records) {
    // Build the quote from the record
    let quote = `${record.type}: ${record.value}`;
    if (record.unit) quote += ` ${record.unit}`;
    if (record.referenceRange) quote += ` (Reference: ${record.referenceRange})`;

    // Generate safe explanation using approved verbs
    const explanation = `This record shows ${record.type.toLowerCase()} as documented.`;

    // Safe discussion prompts
    const discussionPrompts = [
      `What does this ${record.type.toLowerCase()} result mean in my situation?`,
      "Is this value expected given my history?",
      "Should this be rechecked, and if so when?",
    ];

    // Add reference range prompt if present
    if (record.referenceRange) {
      discussionPrompts.push(
        "Can you explain what the reference range means for me?"
      );
    }

    observations.push({
      type: "finding",
      quote,
      source: record.source,
      date: record.date,
      category: record.type,
      explanation,
      discussionPrompts,
    });
  }

  return observations;
}

/**
 * Generate trend observation from multiple records of same type (NO interpretation)
 */
export function getTrendObservation(
  recordType: string,
  values: Array<{ value: string; date: string; source: string }>
): FindingObservation | null {
  if (values.length < 2) return null;

  // Build quote listing the values chronologically
  const sortedValues = [...values].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const quoteLines = sortedValues.map(
    (v) => `${v.value} (${v.source}, ${v.date})`
  );
  const quote = `${recordType} values: ${quoteLines.join(" → ")}`;

  return {
    type: "finding",
    quote,
    source: "Multiple records",
    date: sortedValues[sortedValues.length - 1].date,
    category: recordType,
    explanation: `This shows ${recordType.toLowerCase()} values from multiple records over time.`,
    discussionPrompts: [
      `Can you help me understand what these ${recordType.toLowerCase()} values mean over time?`,
      "Is this pattern expected given my history?",
      "What factors might affect these values?",
    ],
  };
}

/**
 * Get all observations from a document summary
 */
export async function getDocumentObservations(
  documentContent: string,
  documentMetadata: { name: string; type: string; date: string; source: string }
): Promise<RecordObservations> {
  // Extract medications from content (simple pattern matching)
  const medicationPatterns = [
    /(\w+)\s+(\d+\s*mg|\d+\s*mcg)\s*(daily|twice daily|once daily|as needed)?/gi,
  ];
  
  const medications: Array<{ name: string; dosage: string; source: string; date: string }> = [];
  
  for (const pattern of medicationPatterns) {
    let match;
    while ((match = pattern.exec(documentContent)) !== null) {
      medications.push({
        name: match[1],
        dosage: match[2] + (match[3] ? ` ${match[3]}` : ""),
        source: documentMetadata.source,
        date: documentMetadata.date,
      });
    }
  }

  // Extract lab values (simple pattern matching)
  const labPatterns = [
    /(\w+(?:\s+\w+)?)\s*:\s*([\d.]+)\s*(%|mg\/dL|mmol\/L|g\/dL|U\/L)?/gi,
  ];
  
  const findings: Array<{
    type: string;
    value: string;
    unit?: string;
    source: string;
    date: string;
  }> = [];

  for (const pattern of labPatterns) {
    let match;
    while ((match = pattern.exec(documentContent)) !== null) {
      findings.push({
        type: match[1],
        value: match[2],
        unit: match[3],
        source: documentMetadata.source,
        date: documentMetadata.date,
      });
    }
  }

  return {
    medicationObservations: getMedicationObservation(medications),
    findingObservations: getFindingObservations(findings),
    disclaimer: "Informational only. Not medical advice.",
  };
}

/**
 * Mock observations for sample
 */
export function getMockObservations(): RecordObservations {
  return {
    medicationObservations: {
      type: "medication_list",
      medications: [
        { name: "Metformin", dosage: "500mg twice daily", source: "Primary Care Clinic", date: "2024-01-15" },
        { name: "Lisinopril", dosage: "10mg daily", source: "Primary Care Clinic", date: "2024-01-15" },
        { name: "Atorvastatin", dosage: "20mg daily", source: "Primary Care Clinic", date: "2024-01-15" },
      ],
      discussionPrompts: [
        "Can you review my current medication list together?",
        "Are there any questions I should ask about taking these medications?",
        "Is this medication list up to date?",
        "With multiple medications listed, what should I know about my regimen?",
      ],
      disclaimer: "Informational only. Not medical advice.",
    },
    findingObservations: [
      {
        type: "finding",
        quote: "HbA1c: 6.8% (Reference: <5.7% normal, 5.7-6.4% prediabetes, ≥6.5% diabetes)",
        source: "Quest Diagnostics",
        date: "2024-01-10",
        category: "HbA1c",
        explanation: "This record shows HbA1c as documented with the reference range from the lab.",
        discussionPrompts: [
          "What does this HbA1c result mean in my situation?",
          "Is this value expected given my history?",
          "Should this be rechecked, and if so when?",
          "Can you explain what the reference range means for me?",
        ],
      },
      {
        type: "finding",
        quote: "Blood Pressure values: 132/86 mmHg (Primary Care, 2023-10-15) → 128/84 mmHg (Primary Care, 2024-01-15)",
        source: "Multiple records",
        date: "2024-01-15",
        category: "Blood Pressure",
        explanation: "This shows blood pressure values from multiple records over time.",
        discussionPrompts: [
          "Can you help me understand what these blood pressure values mean over time?",
          "Is this pattern expected given my history?",
          "What factors might affect these values?",
        ],
      },
    ],
    disclaimer: "Informational only. Not medical advice.",
  };
}
