import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface Claim {
  id: string;
  patientId: string;
  claimNumber: string;
  dateOfService: string;
  dateSubmitted: string;
  provider: string;
  facilityType: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  totalCharged: number;
  allowedAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  status: "pending" | "approved" | "denied" | "partial" | "under_review";
  category: string;
  description: string;
}

export interface ClaimsAnalysis {
  totalClaims: number;
  totalCharged: number;
  totalPaid: number;
  totalPatientResponsibility: number;
  averageProcessingDays: number;
  approvalRate: number;
  denialRate: number;
  byCategory: Record<string, { count: number; charged: number; paid: number }>;
  byStatus: Record<string, number>;
  byProvider: Record<string, { count: number; totalCharged: number }>;
  monthlyTrends: { month: string; claims: number; charged: number; paid: number }[];
  topDiagnoses: { code: string; description: string; count: number }[];
  topProcedures: { code: string; description: string; count: number; avgCost: number }[];
}

export interface AIClaimsInsight {
  category: string;
  insight: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  potentialSavings?: number;
}

const diagnosisDescriptions: Record<string, string> = {
  "E11.9": "Type 2 diabetes mellitus without complications",
  "I10": "Essential (primary) hypertension",
  "J06.9": "Acute upper respiratory infection",
  "M54.5": "Low back pain",
  "F32.9": "Major depressive disorder",
  "K21.0": "Gastroesophageal reflux disease",
  "J45.909": "Unspecified asthma",
  "E78.5": "Hyperlipidemia",
  "G43.909": "Migraine, unspecified",
  "N39.0": "Urinary tract infection"
};

const procedureDescriptions: Record<string, string> = {
  "99213": "Office visit, established patient, low complexity",
  "99214": "Office visit, established patient, moderate complexity",
  "99215": "Office visit, established patient, high complexity",
  "99203": "Office visit, new patient, low complexity",
  "99204": "Office visit, new patient, moderate complexity",
  "80053": "Comprehensive metabolic panel",
  "85025": "Complete blood count with differential",
  "71046": "Chest X-ray, 2 views",
  "93000": "Electrocardiogram, routine",
  "36415": "Venipuncture"
};

// Generate sample claims data
function generateSampleClaims(patientId: string): Claim[] {
  const claims: Claim[] = [];
  const providers = ["Primary Care Associates", "City Hospital", "Specialty Clinic", "Urgent Care Center", "Regional Medical Center"];
  const categories = ["Preventive Care", "Chronic Disease Management", "Acute Care", "Diagnostic", "Specialist Visit"];
  const statuses: Claim["status"][] = ["approved", "approved", "approved", "pending", "denied", "partial", "under_review"];
  
  const diagnosisCodes = Object.keys(diagnosisDescriptions);
  const procedureCodes = Object.keys(procedureDescriptions);

  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const dateOfService = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dateSubmitted = new Date(dateOfService.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    const totalCharged = 100 + Math.floor(Math.random() * 2000);
    const allowedAmount = totalCharged * (0.5 + Math.random() * 0.4);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const paidAmount = status === "approved" ? allowedAmount * 0.8 : 
                       status === "partial" ? allowedAmount * 0.4 :
                       status === "denied" ? 0 : allowedAmount * 0.6;
    
    claims.push({
      id: generateId("claim"),
      patientId,
      claimNumber: `CLM${Date.now().toString().slice(-8)}${i}`,
      dateOfService: dateOfService.toISOString().split("T")[0],
      dateSubmitted: dateSubmitted.toISOString().split("T")[0],
      provider: providers[Math.floor(Math.random() * providers.length)],
      facilityType: ["Office", "Hospital", "Clinic", "Emergency"][Math.floor(Math.random() * 4)],
      diagnosisCodes: [diagnosisCodes[Math.floor(Math.random() * diagnosisCodes.length)]],
      procedureCodes: [procedureCodes[Math.floor(Math.random() * procedureCodes.length)]],
      totalCharged,
      allowedAmount,
      paidAmount,
      patientResponsibility: allowedAmount - paidAmount,
      status,
      category: categories[Math.floor(Math.random() * categories.length)],
      description: procedureDescriptions[procedureCodes[Math.floor(Math.random() * procedureCodes.length)]]
    });
  }

  return claims.sort((a, b) => new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime());
}

const patientClaims: Map<string, Claim[]> = new Map();

class ClaimsAnalysisService {
  getClaims(patientId: string): Claim[] {
    if (!patientClaims.has(patientId)) {
      patientClaims.set(patientId, generateSampleClaims(patientId));
    }
    return patientClaims.get(patientId)!;
  }

  analyzeClaimsData(patientId: string): ClaimsAnalysis {
    const claims = this.getClaims(patientId);
    
    const byCategory: Record<string, { count: number; charged: number; paid: number }> = {};
    const byStatus: Record<string, number> = {};
    const byProvider: Record<string, { count: number; totalCharged: number }> = {};
    const diagnosisCounts: Record<string, number> = {};
    const procedureCounts: Record<string, { count: number; totalCost: number }> = {};
    const monthlyData: Record<string, { claims: number; charged: number; paid: number }> = {};

    let totalCharged = 0;
    let totalPaid = 0;
    let totalPatientResponsibility = 0;

    for (const claim of claims) {
      totalCharged += claim.totalCharged;
      totalPaid += claim.paidAmount;
      totalPatientResponsibility += claim.patientResponsibility;

      // By category
      if (!byCategory[claim.category]) {
        byCategory[claim.category] = { count: 0, charged: 0, paid: 0 };
      }
      byCategory[claim.category].count++;
      byCategory[claim.category].charged += claim.totalCharged;
      byCategory[claim.category].paid += claim.paidAmount;

      // By status
      byStatus[claim.status] = (byStatus[claim.status] || 0) + 1;

      // By provider
      if (!byProvider[claim.provider]) {
        byProvider[claim.provider] = { count: 0, totalCharged: 0 };
      }
      byProvider[claim.provider].count++;
      byProvider[claim.provider].totalCharged += claim.totalCharged;

      // Diagnosis counts
      for (const code of claim.diagnosisCodes) {
        diagnosisCounts[code] = (diagnosisCounts[code] || 0) + 1;
      }

      // Procedure counts
      for (const code of claim.procedureCodes) {
        if (!procedureCounts[code]) {
          procedureCounts[code] = { count: 0, totalCost: 0 };
        }
        procedureCounts[code].count++;
        procedureCounts[code].totalCost += claim.totalCharged;
      }

      // Monthly trends
      const month = claim.dateOfService.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { claims: 0, charged: 0, paid: 0 };
      }
      monthlyData[month].claims++;
      monthlyData[month].charged += claim.totalCharged;
      monthlyData[month].paid += claim.paidAmount;
    }

    const approvedClaims = claims.filter(c => c.status === "approved" || c.status === "partial").length;
    const deniedClaims = claims.filter(c => c.status === "denied").length;

    return {
      totalClaims: claims.length,
      totalCharged,
      totalPaid,
      totalPatientResponsibility,
      averageProcessingDays: 7 + Math.random() * 7,
      approvalRate: approvedClaims / claims.length,
      denialRate: deniedClaims / claims.length,
      byCategory,
      byStatus,
      byProvider,
      monthlyTrends: Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12),
      topDiagnoses: Object.entries(diagnosisCounts)
        .map(([code, count]) => ({
          code,
          description: diagnosisDescriptions[code] || "Unknown",
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topProcedures: Object.entries(procedureCounts)
        .map(([code, data]) => ({
          code,
          description: procedureDescriptions[code] || "Unknown",
          count: data.count,
          avgCost: data.totalCost / data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }

  async getAIInsights(patientId: string): Promise<{
    insights: AIClaimsInsight[];
    summary: string;
    noCdsCompliance: string;
  }> {
    const analysis = this.analyzeClaimsData(patientId);
    const NO_CDS_DISCLAIMER = "FINANCIAL AND ADMINISTRATIVE INFORMATION ONLY. This analysis covers billing, costs, and insurance processing. It is NOT medical advice, does NOT interpret health conditions, and does NOT suggest when to seek medical care. Contact your insurance company or healthcare provider with questions.";

    if (!openai) {
      return {
        insights: this.generateRuleBasedInsights(analysis),
        summary: `Analysis of ${analysis.totalClaims} claims shows ${(analysis.approvalRate * 100).toFixed(1)}% approval rate with $${analysis.totalPatientResponsibility.toFixed(2)} in patient responsibility. ${NO_CDS_DISCLAIMER}`,
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare BILLING and INSURANCE assistant. You ONLY discuss:
- Claim approval/denial rates and appeal processes
- Cost breakdowns and payment responsibilities
- Insurance processing times and procedures
- How to read Explanation of Benefits (EOB) documents
- Payment plan options and financial assistance programs

ABSOLUTE RULES - VIOLATIONS CAUSE HARM:
1. NEVER mention health conditions, symptoms, or diagnoses
2. NEVER suggest seeking medical care or seeing a doctor
3. NEVER interpret what diagnosis or procedure codes mean clinically
4. NEVER comment on treatment patterns or care utilization
5. ONLY discuss money, billing, insurance processing, and claims

End EVERY response with: "[DISCLAIMER: Financial information only. Not medical advice.]"

Format insights as: [CATEGORY] | [BILLING/COST INSIGHT] | [ADMINISTRATIVE ACTION] | [PRIORITY]`
          },
          {
            role: "user",
            content: `Claims billing summary (financial data only):
- Total Claims: ${analysis.totalClaims}
- Total Billed: $${analysis.totalCharged.toFixed(2)}
- Insurance Paid: $${analysis.totalPaid.toFixed(2)}
- Patient Owes: $${analysis.totalPatientResponsibility.toFixed(2)}
- Approval Rate: ${(analysis.approvalRate * 100).toFixed(1)}%
- Denial Rate: ${(analysis.denialRate * 100).toFixed(1)}%

Provide 3-4 billing/insurance insights about costs and claims processing only.`
          }
        ],
        max_tokens: 600
      });

      const content = response.choices[0]?.message?.content || "";
      const lines = content.split("\n").filter(l => l.trim());
      
      let summary = `Billing analysis of ${analysis.totalClaims} claims: ${(analysis.approvalRate * 100).toFixed(1)}% approved, $${analysis.totalPatientResponsibility.toFixed(2)} patient responsibility.`;
      const insights: AIClaimsInsight[] = [];

      for (const line of lines) {
        if (line.includes("|")) {
          const parts = line.split("|").map(p => p.trim());
          if (parts.length >= 4) {
            insights.push({
              category: parts[0].replace(/^\[|\]$/g, ""),
              insight: parts[1],
              recommendation: parts[2],
              priority: (parts[3].toLowerCase().includes("high") ? "high" : 
                        parts[3].toLowerCase().includes("low") ? "low" : "medium") as AIClaimsInsight["priority"]
            });
          }
        }
      }

      return {
        insights: insights.length > 0 ? insights : this.generateRuleBasedInsights(analysis),
        summary: summary + " " + NO_CDS_DISCLAIMER,
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    } catch (error) {
      console.error("Error generating AI insights:", error);
      return {
        insights: this.generateRuleBasedInsights(analysis),
        summary: `Analysis of ${analysis.totalClaims} claims shows ${(analysis.approvalRate * 100).toFixed(1)}% approval rate. ${NO_CDS_DISCLAIMER}`,
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    }
  }

  private generateRuleBasedInsights(analysis: ClaimsAnalysis): AIClaimsInsight[] {
    const insights: AIClaimsInsight[] = [];

    if (analysis.denialRate > 0.1) {
      insights.push({
        category: "Claims Review",
        insight: `${(analysis.denialRate * 100).toFixed(1)}% of claims were denied, which is above average.`,
        recommendation: "Review denied claims for appeal opportunities. Contact your insurer to understand denial reasons.",
        priority: "high"
      });
    }

    if (analysis.totalPatientResponsibility > 1000) {
      insights.push({
        category: "Cost Management",
        insight: `Patient responsibility totals $${analysis.totalPatientResponsibility.toFixed(2)} over this period.`,
        recommendation: "Ask about payment plans or financial assistance programs if needed.",
        priority: "medium"
      });
    }

    const topProvider = Object.entries(analysis.byProvider).sort((a, b) => b[1].count - a[1].count)[0];
    if (topProvider) {
      insights.push({
        category: "Provider Utilization",
        insight: `Most visits (${topProvider[1].count}) are with ${topProvider[0]}.`,
        recommendation: "Verify this provider is in-network to maximize coverage benefits.",
        priority: "low"
      });
    }

    if (analysis.averageProcessingDays > 14) {
      insights.push({
        category: "Processing Time",
        insight: `Average claim processing time is ${analysis.averageProcessingDays.toFixed(1)} days.`,
        recommendation: "Contact your insurer if claims are pending beyond 30 days.",
        priority: "medium"
      });
    }

    return insights;
  }
}

export const claimsAnalysisService = new ClaimsAnalysisService();
