import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import { NO_CDS_DISCLAIMER_SHORT } from "../security/no-cds-guardrails";
import type {
  CareGapAnalysisRequest,
  CareGapAnalysisResponse,
  UspstfRecommendation,
  CareGap,
  CareGapPriority,
  Patient,
} from "@shared/schema";

export async function analyzePatientCareGaps(
  request: CareGapAnalysisRequest
): Promise<CareGapAnalysisResponse> {
  const patient = await storage.getPatient(request.patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }

  const dob = new Date(patient.dateOfBirth);
  const today = new Date();
  const age = Math.floor(
    (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  const recommendations = await storage.getUspstfRecommendations(
    age,
    patient.gender,
    request.focusCategories?.[0]
  );

  const existingCareGaps = await storage.getPatientCareGaps(request.patientId);
  const vaccinations = request.includeVaccinations
    ? await storage.getPatientVaccinations(request.patientId)
    : [];
  const claims = request.includeClaims
    ? await storage.getPatientClaimsSummary(request.patientId)
    : [];

  const patientRecords = request.includeFhirRecords
    ? await storage.getMedicalRecordsByPatient(request.patientId)
    : [];

  const patientContext = buildPatientContext(
    patient,
    age,
    recommendations,
    existingCareGaps,
    vaccinations,
    claims,
    patientRecords
  );

  const aiAnalysis = await performAIAnalysis(patientContext, recommendations);

  const newCareGaps: CareGap[] = [];
  for (const finding of aiAnalysis.identifiedGaps) {
    const recommendation = recommendations.find(
      (r) => r.code === finding.recommendationCode || r.title.toLowerCase().includes(finding.recommendationCode.toLowerCase())
    );
    if (recommendation) {
      const existing = existingCareGaps.find(
        (g) => g.recommendationId === recommendation.id
      );
      if (!existing) {
        const careGap = await storage.createCareGap({
          patientId: request.patientId,
          recommendationId: recommendation.id,
          status: "open",
          priority: finding.priority as CareGapPriority,
          dueDate: finding.dueDate,
          aiReasoning: finding.reasoning,
        });
        newCareGaps.push(careGap);
      }
    }
  }

  const allCareGaps = [...existingCareGaps, ...newCareGaps];

  const vaccineGaps = analyzeVaccineGaps(vaccinations, recommendations, age);

  return {
    patientId: request.patientId,
    analysisDate: new Date().toISOString(),
    careGaps: allCareGaps,
    summary: aiAnalysis.summary,
    keyFindings: aiAnalysis.keyFindings,
    prioritizedRecommendations: aiAnalysis.identifiedGaps.map((gap) => {
      const rec = recommendations.find(
        (r) => r.code === gap.recommendationCode || r.title.toLowerCase().includes(gap.recommendationCode.toLowerCase())
      );
      return {
        recommendation: rec || ({} as UspstfRecommendation),
        priority: gap.priority as CareGapPriority,
        reasoning: gap.reasoning,
        evidenceFromRecords: gap.evidenceFromRecords || [],
      };
    }),
    vaccineGaps,
    confidenceScore: aiAnalysis.confidenceScore,
    dataSources: [
      {
        type: "FHIR Records",
        recordCount: patientRecords.length,
        dateRange: getDateRange(patientRecords.map((r) => r.date)),
      },
      {
        type: "Claims",
        recordCount: claims.length,
        dateRange: getDateRange(claims.map((c) => c.serviceDate)),
      },
      {
        type: "Vaccinations",
        recordCount: vaccinations.length,
        dateRange: getDateRange(vaccinations.map((v) => v.administrationDate)),
      },
    ],
  };
}

function buildPatientContext(
  patient: Patient,
  age: number,
  recommendations: UspstfRecommendation[],
  existingGaps: CareGap[],
  vaccinations: any[],
  claims: any[],
  records: any[]
): string {
  const addressedRecommendations = existingGaps
    .filter((g) => g.status === "addressed")
    .map((g) => g.recommendation?.title);

  const recentProcedures = records
    .filter((r: { type: string }) => r.type === "procedure")
    .slice(0, 10)
    .map((r: { title: string; date: string }) => `${r.title} (${r.date})`);

  const recentLabResults = records
    .filter((r) => r.type === "lab_result")
    .slice(0, 10)
    .map((r) => `${r.title}: ${r.description || "N/A"} (${r.date})`);

  const vaccineList = vaccinations
    .slice(0, 10)
    .map((v) => `${v.vaccineName} (${v.administrationDate})`);

  const claimsProcedures = claims
    .flatMap((c) => c.procedureCodes)
    .slice(0, 20);

  return `
Patient Information:
- Age: ${age} years old
- Gender: ${patient.gender}
- Date of Birth: ${patient.dateOfBirth}

Applicable USPSTF Recommendations for this patient (${recommendations.length} total):
${recommendations.map((r) => `- [${r.grade}] ${r.title}: ${r.description} (Ages ${r.ageRangeStart}-${r.ageRangeEnd}, Frequency: ${r.frequency})`).join("\n")}

Already Addressed Screenings/Recommendations:
${addressedRecommendations.length > 0 ? addressedRecommendations.join(", ") : "None recorded"}

Recent Medical Procedures (from FHIR records):
${recentProcedures.length > 0 ? recentProcedures.join("\n") : "No recent procedures"}

Recent Lab Results (from FHIR records):
${recentLabResults.length > 0 ? recentLabResults.join("\n") : "No recent lab results"}

Vaccination History:
${vaccineList.length > 0 ? vaccineList.join("\n") : "No vaccination records"}

Claims Procedure Codes:
${claimsProcedures.length > 0 ? claimsProcedures.join(", ") : "No claims data"}
`;
}

interface AIAnalysisResult {
  summary: string;
  keyFindings: string[];
  identifiedGaps: {
    recommendationCode: string;
    priority: string;
    reasoning: string;
    dueDate?: string;
    evidenceFromRecords?: string[];
  }[];
  confidenceScore: number;
}

async function performAIAnalysis(
  patientContext: string,
  recommendations: UspstfRecommendation[]
): Promise<AIAnalysisResult> {
  const systemPrompt = `You are a care gap analysis tool that reviews patient records to identify gaps based on USPSTF preventive care guidelines. ${NO_CDS_DISCLAIMER_SHORT}

Your task is to:
1. Review the patient's medical history, procedures, lab results, and vaccination records
2. Compare against applicable USPSTF guidelines for their age and gender
3. Identify any missing or overdue preventive screenings and vaccinations
4. Categorize findings based on evidence strength and documentation gaps

Important guidelines:
- Provide informational analysis only, not clinical recommendations
- Base conclusions on documented evidence from the patient's records
- Consider screening intervals and when services were last performed
- Grade priority as: critical (data indicates immediate gap), high (overdue by >1 year), medium (due within 6 months), low (informational)
- Be conservative - only flag gaps where there is clear evidence of missing care

Respond in JSON format with the following structure:
{
  "summary": "Brief 2-3 sentence summary of the patient's preventive care status",
  "keyFindings": ["Array of 3-5 key observations about the patient's care"],
  "identifiedGaps": [
    {
      "recommendationCode": "USPSTF code or title of the recommendation",
      "priority": "critical|high|medium|low",
      "reasoning": "Explanation of why this is a gap based on patient records",
      "dueDate": "ISO date string if applicable",
      "evidenceFromRecords": ["Array of specific records that informed this finding"]
    }
  ],
  "confidenceScore": 0.0-1.0
}`;

  try {
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: `Analyze the following patient data and identify care gaps:\n\n${patientContext}`,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!content) {
      return getDefaultAnalysis(recommendations);
    }

    const parsed = JSON.parse(content) as AIAnalysisResult;
    return {
      summary: parsed.summary || "Care gap analysis completed.",
      keyFindings: parsed.keyFindings || [],
      identifiedGaps: parsed.identifiedGaps || [],
      confidenceScore: parsed.confidenceScore || 0.7,
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    return getDefaultAnalysis(recommendations);
  }
}

function getDefaultAnalysis(
  recommendations: UspstfRecommendation[]
): AIAnalysisResult {
  const gradeAPriority: CareGapPriority = "high";
  const gradeBPriority: CareGapPriority = "medium";

  return {
    summary:
      "Based on available records, several preventive care gaps were identified for provider review.",
    keyFindings: [
      "Patient records were analyzed against USPSTF guidelines",
      "Data indicates some screenings may be due based on age and gender",
      "Vaccination status data reviewed for completeness",
    ],
    identifiedGaps: recommendations.slice(0, 5).map((r) => ({
      recommendationCode: r.code,
      priority: r.grade === "A" ? gradeAPriority : gradeBPriority,
      reasoning: `${r.title} is indicated per USPSTF guidelines for patients aged ${r.ageRangeStart}-${r.ageRangeEnd}. No recent record found in patient history.`,
      evidenceFromRecords: [],
    })),
    confidenceScore: 0.6,
  };
}

function analyzeVaccineGaps(
  vaccinations: any[],
  recommendations: UspstfRecommendation[],
  age: number
) {
  const vaccineRecommendations = recommendations.filter(
    (r) => r.category === "immunization"
  );

  return vaccineRecommendations.map((rec) => {
    const relatedVaccines = vaccinations.filter((v) =>
      v.vaccineName.toLowerCase().includes(rec.title.toLowerCase().split(" ")[0])
    );

    const lastDose = relatedVaccines.sort(
      (a, b) =>
        new Date(b.administrationDate).getTime() -
        new Date(a.administrationDate).getTime()
    )[0];

    let status: "overdue" | "due_soon" | "up_to_date" = "overdue";
    let nextDueDate: string | undefined;

    if (lastDose) {
      const lastDoseDate = new Date(lastDose.administrationDate);
      const monthsSinceLastDose = Math.floor(
        (Date.now() - lastDoseDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );

      if (rec.frequencyMonths === 0) {
        status = "up_to_date";
      } else if (monthsSinceLastDose < rec.frequencyMonths) {
        status = "up_to_date";
        const nextDue = new Date(lastDoseDate);
        nextDue.setMonth(nextDue.getMonth() + rec.frequencyMonths);
        nextDueDate = nextDue.toISOString().split("T")[0];

        if (monthsSinceLastDose >= rec.frequencyMonths - 2) {
          status = "due_soon";
        }
      } else {
        status = "overdue";
      }
    }

    return {
      vaccineName: rec.title,
      status,
      lastDose: lastDose?.administrationDate,
      nextDueDate,
      recommendation: rec.patientEducation,
    };
  });
}

function getDateRange(dates: string[]): { start: string; end: string } {
  if (dates.length === 0) {
    return { start: "", end: "" };
  }

  const sorted = dates
    .filter((d) => d)
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 0) {
    return { start: "", end: "" };
  }

  return {
    start: sorted[0].toISOString().split("T")[0],
    end: sorted[sorted.length - 1].toISOString().split("T")[0],
  };
}

export async function generateAISummary(patientId: string): Promise<string> {
  const summary = await storage.getPatientPreventiveSummary(patientId);
  if (!summary) {
    return "Unable to generate summary - patient not found.";
  }

  const openGaps = summary.careGaps.filter((g) => g.status === "open");
  const upcomingVaccines = summary.vaccinationHistory
    .filter((v) => v.nextDoseDate)
    .slice(0, 3);

  try {
    const content = await generatePhiSafeText({
      system: `You are a patient-friendly health information assistant. Generate a brief, encouraging summary of a patient's preventive care status. Use simple language suitable for patients. Do not provide medical advice - only summarize their current status as general health information and note that discussing findings with their healthcare provider is an option. ${NO_CDS_DISCLAIMER_SHORT}`,
      user: `Patient: ${summary.patientName}, Age ${summary.age}
Compliance Score: ${summary.overallComplianceScore}%
Open Care Gaps: ${openGaps.map((g) => g.recommendation.title).join(", ") || "None"}
Upcoming Vaccinations: ${upcomingVaccines.map((v) => v.vaccineName).join(", ") || "None scheduled"}

Generate a 3-4 sentence patient-friendly summary of their preventive care status.`,
      temperature: 0.7,
      maxTokens: 300,
    });

    return (
      content ||
      "Your preventive care summary is being prepared. Please check back later."
    );
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return `Your preventive care compliance score is ${summary.overallComplianceScore}%. ${
      openGaps.length > 0
        ? `Data indicates ${openGaps.length} identified gap(s) in preventive screenings that your healthcare provider may review.`
        : "You are up to date with recommended screenings."
    }`;
  }
}
