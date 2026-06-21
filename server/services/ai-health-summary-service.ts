import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI();
  }
} catch (error) {
  console.log("[AIHealthSummary] OpenAI client not available");
}

export interface HealthTimelineEvent {
  id: string;
  date: string;
  type: "condition" | "medication" | "appointment" | "observation" | "procedure" | "immunization" | "document";
  title: string;
  description: string;
  category: string;
  severity?: "low" | "medium" | "high";
  status?: string;
  icon?: string;
  relatedItems?: string[];
}

export interface HealthSummary {
  overview: string;
  keyInsights: Array<{
    category: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    actionable: boolean;
    action?: string;
  }>;
  recentConditions: Array<{
    name: string;
    status: string;
    onsetDate: string;
    severity: string;
  }>;
  activeMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    purpose: string;
    adherenceRate: number;
  }>;
  upcomingAppointments: Array<{
    type: string;
    provider: string;
    date: string;
    location: string;
  }>;
  latestVitals: Array<{
    name: string;
    value: string;
    unit: string;
    date: string;
    trend: "improving" | "stable" | "concerning";
    isNormal: boolean;
  }>;
  healthScore: number;
  riskAlerts: Array<{
    type: string;
    message: string;
    severity: "warning" | "critical" | "info";
  }>;
  lastUpdated: string;
  disclaimer: string;
}

class AIHealthSummaryService {
  private generateMockFHIRData() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const daysAgo = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return formatDate(d);
    };
    const daysFromNow = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return formatDate(d);
    };

    return {
      conditions: [
        { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: daysAgo(730), severity: "moderate", code: "E11.9" },
        { name: "Essential Hypertension", status: "active", onsetDate: daysAgo(1095), severity: "mild", code: "I10" },
        { name: "Hyperlipidemia", status: "active", onsetDate: daysAgo(365), severity: "mild", code: "E78.5" },
        { name: "Seasonal Allergies", status: "resolved", onsetDate: daysAgo(180), severity: "mild", code: "J30.1" },
      ],
      medications: [
        { name: "Metformin", dosage: "1000mg", frequency: "Twice daily", purpose: "Blood sugar control", startDate: daysAgo(700), adherenceRate: 92 },
        { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", purpose: "Blood pressure control", startDate: daysAgo(1000), adherenceRate: 88 },
        { name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", purpose: "Cholesterol management", startDate: daysAgo(350), adherenceRate: 95 },
        { name: "Aspirin", dosage: "81mg", frequency: "Once daily", purpose: "Cardiovascular protection", startDate: daysAgo(365), adherenceRate: 90 },
      ],
      appointments: [
        { type: "Endocrinology Follow-up", provider: "Dr. Sarah Chen", date: daysFromNow(7), location: "Diabetes Care Center", status: "scheduled" },
        { type: "Annual Physical", provider: "Dr. Michael Roberts", date: daysFromNow(21), location: "Primary Care Clinic", status: "scheduled" },
        { type: "Lab Work - A1C", provider: "Quest Diagnostics", date: daysFromNow(5), location: "Lab Center", status: "scheduled" },
      ],
      vitals: [
        { name: "Blood Pressure", value: "138/88", unit: "mmHg", date: daysAgo(2), trend: "stable", isNormal: false },
        { name: "Blood Glucose (Fasting)", value: "142", unit: "mg/dL", date: daysAgo(1), trend: "concerning", isNormal: false },
        { name: "Weight", value: "185", unit: "lbs", date: daysAgo(2), trend: "stable", isNormal: true },
        { name: "Heart Rate", value: "72", unit: "bpm", date: daysAgo(2), trend: "stable", isNormal: true },
        { name: "HbA1c", value: "7.2", unit: "%", date: daysAgo(30), trend: "improving", isNormal: false },
        { name: "LDL Cholesterol", value: "118", unit: "mg/dL", date: daysAgo(60), trend: "improving", isNormal: true },
      ],
      recentProcedures: [
        { name: "Retinal Exam", date: daysAgo(90), result: "Normal, no diabetic retinopathy" },
        { name: "Foot Examination", date: daysAgo(45), result: "Normal sensation, no ulcers" },
      ],
      immunizations: [
        { name: "Influenza Vaccine", date: daysAgo(120), status: "completed" },
        { name: "Pneumococcal Vaccine", date: daysAgo(365), status: "completed" },
      ],
    };
  }

  async generateHealthSummary(patientId: string): Promise<HealthSummary> {
    const fhirData = this.generateMockFHIRData();
    
    let aiOverview = "";
    let aiInsights: HealthSummary["keyInsights"] = [];

    try {
      if (!openai) {
        throw new Error("OpenAI client not configured");
      }
      
      const prompt = `Based on this patient health data, generate a personalized health summary:

FHIR Data:
- Conditions: ${JSON.stringify(fhirData.conditions)}
- Medications: ${JSON.stringify(fhirData.medications)}
- Upcoming Appointments: ${JSON.stringify(fhirData.appointments)}
- Recent Vitals: ${JSON.stringify(fhirData.vitals)}
- Recent Procedures: ${JSON.stringify(fhirData.recentProcedures)}

Generate a JSON response with:
1. "overview": A 2-3 sentence personalized health overview for the patient (friendly, encouraging tone)
2. "insights": Array of 3-4 key health insights, each with:
   - "category": (e.g., "Diabetes Management", "Heart Health", "Preventive Care")
   - "title": Short insight title
   - "description": 1-2 sentence explanation
   - "priority": "high" | "medium" | "low"
   - "actionable": boolean
   - "action": Optional action recommendation

Important: This is for informational purposes only, not medical advice. Keep tone supportive and patient-friendly.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      aiOverview = result.overview || "";
      aiInsights = result.insights || [];
    } catch (error) {
      console.log("[AIHealthSummary] OpenAI unavailable, using fallback summary");
      aiOverview = "Your health journey is progressing well. You're managing multiple chronic conditions with good medication adherence. Keep up your regular appointments and monitoring to stay on track.";
      aiInsights = [
        {
          category: "Diabetes Management",
          title: "Blood Sugar Trending Higher",
          description: "Your fasting glucose is slightly elevated. Consider reviewing your diet and exercise routine before your next endocrinology visit.",
          priority: "high",
          actionable: true,
          action: "Schedule A1C lab work before your upcoming appointment",
        },
        {
          category: "Heart Health",
          title: "Blood Pressure Needs Attention",
          description: "Recent readings show your blood pressure is above target. Consistent medication timing and reduced sodium intake may help.",
          priority: "medium",
          actionable: true,
          action: "Monitor BP daily and log readings",
        },
        {
          category: "Medication Adherence",
          title: "Strong Medication Compliance",
          description: "You're taking your medications consistently with 88-95% adherence rates. This is excellent for managing your conditions.",
          priority: "low",
          actionable: false,
        },
        {
          category: "Preventive Care",
          title: "Upcoming Annual Physical",
          description: "Your annual physical is scheduled in 3 weeks. This is a great opportunity to discuss your overall health goals.",
          priority: "medium",
          actionable: true,
          action: "Prepare questions for your doctor",
        },
      ];
    }

    const healthScore = this.calculateHealthScore(fhirData);
    const riskAlerts = this.generateRiskAlerts(fhirData);

    return {
      overview: aiOverview,
      keyInsights: aiInsights,
      recentConditions: fhirData.conditions.map(c => ({
        name: c.name,
        status: c.status,
        onsetDate: c.onsetDate,
        severity: c.severity,
      })),
      activeMedications: fhirData.medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        purpose: m.purpose,
        adherenceRate: m.adherenceRate,
      })),
      upcomingAppointments: fhirData.appointments.map(a => ({
        type: a.type,
        provider: a.provider,
        date: a.date,
        location: a.location,
      })),
      latestVitals: fhirData.vitals.map(v => ({
        name: v.name,
        value: v.value,
        unit: v.unit,
        date: v.date,
        trend: v.trend as "improving" | "stable" | "concerning",
        isNormal: v.isNormal,
      })),
      healthScore,
      riskAlerts,
      lastUpdated: new Date().toISOString(),
      disclaimer: "This summary is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider for medical decisions.",
    };
  }

  async getHealthTimeline(patientId: string): Promise<HealthTimelineEvent[]> {
    const fhirData = this.generateMockFHIRData();
    const events: HealthTimelineEvent[] = [];
    let eventId = 1;

    fhirData.conditions.forEach(c => {
      events.push({
        id: `event-${eventId++}`,
        date: c.onsetDate,
        type: "condition",
        title: c.name,
        description: `Diagnosed with ${c.name}`,
        category: "Diagnosis",
        severity: c.severity === "moderate" ? "medium" : c.severity === "severe" ? "high" : "low",
        status: c.status,
        icon: "stethoscope",
      });
    });

    fhirData.medications.forEach(m => {
      events.push({
        id: `event-${eventId++}`,
        date: m.startDate,
        type: "medication",
        title: `Started ${m.name}`,
        description: `${m.dosage} ${m.frequency} for ${m.purpose}`,
        category: "Medication",
        severity: "low",
        status: "active",
        icon: "pill",
      });
    });

    fhirData.appointments.forEach(a => {
      events.push({
        id: `event-${eventId++}`,
        date: a.date,
        type: "appointment",
        title: a.type,
        description: `${a.provider} at ${a.location}`,
        category: "Appointment",
        severity: "low",
        status: a.status,
        icon: "calendar",
      });
    });

    fhirData.recentProcedures.forEach(p => {
      events.push({
        id: `event-${eventId++}`,
        date: p.date,
        type: "procedure",
        title: p.name,
        description: p.result,
        category: "Procedure",
        severity: "low",
        status: "completed",
        icon: "clipboard-check",
      });
    });

    fhirData.immunizations.forEach(i => {
      events.push({
        id: `event-${eventId++}`,
        date: i.date,
        type: "immunization",
        title: i.name,
        description: `Immunization administered`,
        category: "Immunization",
        severity: "low",
        status: i.status,
        icon: "syringe",
      });
    });

    fhirData.vitals.filter(v => !v.isNormal).forEach(v => {
      events.push({
        id: `event-${eventId++}`,
        date: v.date,
        type: "observation",
        title: `${v.name}: ${v.value} ${v.unit}`,
        description: v.trend === "concerning" ? "Value outside normal range" : "Monitoring required",
        category: "Vital Sign",
        severity: v.trend === "concerning" ? "medium" : "low",
        status: v.trend,
        icon: "activity",
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private calculateHealthScore(fhirData: ReturnType<typeof this.generateMockFHIRData>): number {
    let score = 100;
    
    const activeConditions = fhirData.conditions.filter(c => c.status === "active");
    score -= activeConditions.length * 5;
    
    const abnormalVitals = fhirData.vitals.filter(v => !v.isNormal);
    score -= abnormalVitals.length * 3;
    
    const avgAdherence = fhirData.medications.reduce((sum, m) => sum + m.adherenceRate, 0) / fhirData.medications.length;
    score += (avgAdherence - 80) * 0.2;
    
    const concerningTrends = fhirData.vitals.filter(v => v.trend === "concerning");
    score -= concerningTrends.length * 4;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private generateRiskAlerts(fhirData: ReturnType<typeof this.generateMockFHIRData>): HealthSummary["riskAlerts"] {
    const alerts: HealthSummary["riskAlerts"] = [];
    
    const concerningVitals = fhirData.vitals.filter(v => v.trend === "concerning");
    concerningVitals.forEach(v => {
      alerts.push({
        type: "vital_trend",
        message: `${v.name} is trending in a concerning direction (${v.value} ${v.unit})`,
        severity: "warning",
      });
    });

    const abnormalVitals = fhirData.vitals.filter(v => !v.isNormal && v.trend !== "concerning");
    if (abnormalVitals.length >= 2) {
      alerts.push({
        type: "multiple_abnormal",
        message: `Multiple vital signs are outside normal ranges. Discuss with your healthcare provider.`,
        severity: "info",
      });
    }

    const lowAdherence = fhirData.medications.filter(m => m.adherenceRate < 80);
    if (lowAdherence.length > 0) {
      alerts.push({
        type: "medication_adherence",
        message: `Some medications have lower adherence rates. Set reminders to stay on track.`,
        severity: "info",
      });
    }

    return alerts;
  }
}

export const aiHealthSummaryService = new AIHealthSummaryService();
