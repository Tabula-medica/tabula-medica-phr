import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: CDC public health data enrichment is for INFORMATIONAL AND AWARENESS PURPOSES ONLY. This does NOT constitute medical advice, clinical decision support, or treatment recommendations. All health decisions must be made in consultation with qualified healthcare professionals.";

const aiEnabled = true;

export interface PatientDemographics {
  patientId: string;
  name: string;
  age: number;
  gender: string;
  state: string;
  county?: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  lastVaccinations?: { vaccine: string; date: string }[];
}

export interface CDCHealthAdvisory {
  id: string;
  type: "outbreak" | "vaccination" | "environmental" | "seasonal" | "travel";
  title: string;
  summary: string;
  severity: "low" | "moderate" | "high" | "critical";
  relevanceScore: number;
  relevanceReason: string;
  recommendations: string[];
  effectiveDate: string;
  expirationDate?: string;
  sourceUrl?: string;
  noCdsDisclaimer: string;
}

export interface VaccinationRecommendation {
  id: string;
  vaccineName: string;
  vaccineType: string;
  recommendedFor: string;
  dueStatus: "overdue" | "due_soon" | "up_to_date" | "not_applicable";
  lastDose?: string;
  nextDueDate?: string;
  cdcScheduleLink: string;
  localCoverageRate?: number;
  notes: string[];
  noCdsDisclaimer: string;
}

export interface DiseasePrevalence {
  id: string;
  disease: string;
  location: string;
  prevalenceRate: number;
  trend: "increasing" | "stable" | "decreasing";
  riskLevel: "low" | "moderate" | "high";
  patientRiskFactors: string[];
  preventionMeasures: string[];
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export interface EnvironmentalAlert {
  id: string;
  type: "air_quality" | "water_quality" | "pollen" | "heat" | "cold" | "uv";
  location: string;
  level: "good" | "moderate" | "unhealthy" | "hazardous";
  description: string;
  healthImpact: string;
  affectedConditions: string[];
  recommendations: string[];
  validUntil: string;
  noCdsDisclaimer: string;
}

export interface PatientCDCEnrichment {
  patientId: string;
  patientName: string;
  enrichmentDate: string;
  location: {
    state: string;
    county?: string;
  };
  healthAdvisories: CDCHealthAdvisory[];
  vaccinationRecommendations: VaccinationRecommendation[];
  diseasePrevalence: DiseasePrevalence[];
  environmentalAlerts: EnvironmentalAlert[];
  aiPersonalizedInsights?: string[];
  riskSummary: {
    overallRiskLevel: "low" | "moderate" | "high";
    topRisks: string[];
    protectiveFactors: string[];
  };
  noCdsDisclaimer: string;
}

function generateSampleAdvisories(patient: PatientDemographics): CDCHealthAdvisory[] {
  const advisories: CDCHealthAdvisory[] = [];
  const now = new Date();
  
  if (now.getMonth() >= 9 || now.getMonth() <= 2) {
    advisories.push({
      id: `adv-flu-${patient.patientId}`,
      type: "seasonal",
      title: "Flu Season Advisory",
      summary: `Influenza activity is elevated in ${patient.state}. The CDC recommends annual flu vaccination for everyone 6 months and older.`,
      severity: "moderate",
      relevanceScore: 0.9,
      relevanceReason: "Seasonal flu is active in your area",
      recommendations: [
        "Get your annual flu shot if you haven't already",
        "Wash hands frequently with soap and water",
        "Avoid close contact with sick individuals",
        "Cover coughs and sneezes"
      ],
      effectiveDate: now.toISOString(),
      expirationDate: new Date(now.getFullYear(), 3, 1).toISOString(),
      sourceUrl: "https://www.cdc.gov/flu/",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (patient.age >= 65) {
    advisories.push({
      id: `adv-senior-${patient.patientId}`,
      type: "vaccination",
      title: "Senior Vaccination Recommendations",
      summary: "Adults 65+ should ensure they are up to date on recommended vaccines including pneumococcal, shingles, and annual flu vaccines.",
      severity: "moderate",
      relevanceScore: 0.95,
      relevanceReason: "Age-based recommendation for adults 65+",
      recommendations: [
        "Review vaccination history with your healthcare provider",
        "Consider pneumococcal vaccine if not previously received",
        "Get high-dose flu vaccine recommended for seniors",
        "Discuss shingles vaccine if not previously vaccinated"
      ],
      effectiveDate: now.toISOString(),
      sourceUrl: "https://www.cdc.gov/vaccines/schedules/hcp/imz/adult.html",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (patient.conditions.some(c => c.toLowerCase().includes("diabetes"))) {
    advisories.push({
      id: `adv-diabetes-${patient.patientId}`,
      type: "outbreak",
      title: "Diabetes & Infection Risk Advisory",
      summary: "People with diabetes may be at higher risk for certain infections. CDC recommends staying current on vaccinations and monitoring blood sugar during illness.",
      severity: "moderate",
      relevanceScore: 0.88,
      relevanceReason: "Relevant to your diabetes condition",
      recommendations: [
        "Keep vaccinations up to date (flu, pneumonia, hepatitis B)",
        "Monitor blood sugar more closely when ill",
        "Have a sick-day management plan",
        "Contact healthcare provider if symptoms worsen"
      ],
      effectiveDate: now.toISOString(),
      sourceUrl: "https://www.cdc.gov/diabetes/",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (patient.conditions.some(c => c.toLowerCase().includes("asthma") || c.toLowerCase().includes("copd"))) {
    advisories.push({
      id: `adv-respiratory-${patient.patientId}`,
      type: "environmental",
      title: "Respiratory Condition Environmental Alert",
      summary: "Air quality and environmental factors can affect respiratory conditions. Stay informed about local air quality and seasonal triggers.",
      severity: "moderate",
      relevanceScore: 0.92,
      relevanceReason: "Relevant to your respiratory condition",
      recommendations: [
        "Check local air quality index daily",
        "Limit outdoor activity on high pollution days",
        "Keep rescue medications accessible",
        "Consider wearing a mask during high pollen seasons"
      ],
      effectiveDate: now.toISOString(),
      sourceUrl: "https://www.cdc.gov/asthma/",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  return advisories;
}

function generateVaccinationRecommendations(patient: PatientDemographics): VaccinationRecommendation[] {
  const recommendations: VaccinationRecommendation[] = [];
  const now = new Date();
  
  const fluVax = patient.lastVaccinations?.find(v => v.vaccine.toLowerCase().includes("flu"));
  const fluYear = fluVax ? new Date(fluVax.date).getFullYear() : 0;
  const currentFluSeason = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  
  recommendations.push({
    id: `vax-flu-${patient.patientId}`,
    vaccineName: "Influenza (Flu) Vaccine",
    vaccineType: patient.age >= 65 ? "High-dose or adjuvanted flu vaccine" : "Standard flu vaccine",
    recommendedFor: "Everyone 6 months and older, annually",
    dueStatus: fluYear >= currentFluSeason ? "up_to_date" : "due_soon",
    lastDose: fluVax?.date,
    nextDueDate: new Date(currentFluSeason, 8, 1).toISOString(),
    cdcScheduleLink: "https://www.cdc.gov/flu/prevent/vaccinations.htm",
    localCoverageRate: 52.3,
    notes: patient.age >= 65 
      ? ["High-dose flu vaccine is recommended for adults 65+"]
      : ["Annual vaccination is recommended before flu season peaks"],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
  
  if (patient.age >= 50) {
    const shinglesVax = patient.lastVaccinations?.find(v => v.vaccine.toLowerCase().includes("shingles") || v.vaccine.toLowerCase().includes("zoster"));
    recommendations.push({
      id: `vax-shingles-${patient.patientId}`,
      vaccineName: "Shingles Vaccine (Shingrix)",
      vaccineType: "Recombinant zoster vaccine",
      recommendedFor: "Adults 50 years and older",
      dueStatus: shinglesVax ? "up_to_date" : "due_soon",
      lastDose: shinglesVax?.date,
      cdcScheduleLink: "https://www.cdc.gov/vaccines/vpd/shingles/index.html",
      localCoverageRate: 31.5,
      notes: [
        "Two doses needed, 2-6 months apart",
        "Recommended even if you've had shingles before"
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (patient.age >= 65) {
    const pneumoVax = patient.lastVaccinations?.find(v => v.vaccine.toLowerCase().includes("pneumo"));
    recommendations.push({
      id: `vax-pneumo-${patient.patientId}`,
      vaccineName: "Pneumococcal Vaccine",
      vaccineType: "PCV20 or PCV15 followed by PPSV23",
      recommendedFor: "Adults 65+ and those with certain medical conditions",
      dueStatus: pneumoVax ? "up_to_date" : "due_soon",
      lastDose: pneumoVax?.date,
      cdcScheduleLink: "https://www.cdc.gov/vaccines/vpd/pneumo/index.html",
      localCoverageRate: 67.2,
      notes: [
        "Protects against pneumonia and meningitis",
        "Discuss timing with your healthcare provider"
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  const tdapVax = patient.lastVaccinations?.find(v => 
    v.vaccine.toLowerCase().includes("tdap") || v.vaccine.toLowerCase().includes("tetanus"));
  const tdapAge = tdapVax ? (now.getTime() - new Date(tdapVax.date).getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 99;
  
  recommendations.push({
    id: `vax-tdap-${patient.patientId}`,
    vaccineName: "Tdap/Td (Tetanus, Diphtheria, Pertussis)",
    vaccineType: "Tdap booster",
    recommendedFor: "All adults, Td booster every 10 years",
    dueStatus: tdapAge < 10 ? "up_to_date" : "due_soon",
    lastDose: tdapVax?.date,
    nextDueDate: tdapVax 
      ? new Date(new Date(tdapVax.date).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString()
      : now.toISOString(),
    cdcScheduleLink: "https://www.cdc.gov/vaccines/vpd/dtap-tdap-td/index.html",
    localCoverageRate: 43.1,
    notes: ["Td/Tdap booster recommended every 10 years"],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
  
  const covidVax = patient.lastVaccinations?.find(v => v.vaccine.toLowerCase().includes("covid"));
  recommendations.push({
    id: `vax-covid-${patient.patientId}`,
    vaccineName: "COVID-19 Vaccine",
    vaccineType: "Updated 2024-2025 COVID-19 vaccine",
    recommendedFor: "Everyone 6 months and older",
    dueStatus: covidVax && (now.getTime() - new Date(covidVax.date).getTime()) < 365 * 24 * 60 * 60 * 1000 
      ? "up_to_date" : "due_soon",
    lastDose: covidVax?.date,
    cdcScheduleLink: "https://www.cdc.gov/covid/vaccines/",
    localCoverageRate: 22.8,
    notes: [
      "Updated vaccine recommended annually",
      patient.age >= 65 ? "Additional doses may be recommended for adults 65+" : ""
    ].filter(Boolean),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
  
  return recommendations;
}

function generateDiseasePrevalence(patient: PatientDemographics): DiseasePrevalence[] {
  const prevalence: DiseasePrevalence[] = [];
  const now = new Date();
  
  prevalence.push({
    id: `prev-flu-${patient.patientId}`,
    disease: "Influenza",
    location: patient.state,
    prevalenceRate: now.getMonth() >= 10 || now.getMonth() <= 2 ? 4.2 : 0.8,
    trend: now.getMonth() >= 9 && now.getMonth() <= 11 ? "increasing" : 
           now.getMonth() >= 0 && now.getMonth() <= 2 ? "stable" : "decreasing",
    riskLevel: now.getMonth() >= 10 || now.getMonth() <= 2 ? "high" : "low",
    patientRiskFactors: patient.age >= 65 ? ["Age 65+", "Higher risk of complications"] :
                        patient.conditions.some(c => c.toLowerCase().includes("diabetes")) 
                          ? ["Chronic condition", "Elevated infection risk"] : [],
    preventionMeasures: [
      "Annual flu vaccination",
      "Frequent handwashing",
      "Avoiding close contact with sick individuals"
    ],
    lastUpdated: now.toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
  
  prevalence.push({
    id: `prev-covid-${patient.patientId}`,
    disease: "COVID-19",
    location: patient.state,
    prevalenceRate: 1.8,
    trend: "stable",
    riskLevel: "moderate",
    patientRiskFactors: [
      ...(patient.age >= 65 ? ["Age 65+"] : []),
      ...(patient.conditions.some(c => c.toLowerCase().includes("diabetes")) ? ["Diabetes"] : []),
      ...(patient.conditions.some(c => c.toLowerCase().includes("heart")) ? ["Heart condition"] : []),
      ...(patient.conditions.some(c => c.toLowerCase().includes("respiratory") || c.toLowerCase().includes("asthma")) ? ["Respiratory condition"] : [])
    ],
    preventionMeasures: [
      "Stay up to date on COVID-19 vaccines",
      "Good ventilation in indoor spaces",
      "Consider masking in crowded settings"
    ],
    lastUpdated: now.toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
  
  if (patient.state === "Texas" || patient.state === "Florida" || patient.state === "California") {
    prevalence.push({
      id: `prev-rsv-${patient.patientId}`,
      disease: "RSV (Respiratory Syncytial Virus)",
      location: patient.state,
      prevalenceRate: 2.1,
      trend: now.getMonth() >= 9 ? "increasing" : "stable",
      riskLevel: patient.age >= 60 ? "moderate" : "low",
      patientRiskFactors: patient.age >= 60 ? ["Age 60+", "RSV vaccine now available"] : [],
      preventionMeasures: [
        "RSV vaccine for adults 60+",
        "Handwashing",
        "Avoiding close contact when ill"
      ],
      lastUpdated: now.toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  return prevalence;
}

function generateEnvironmentalAlerts(patient: PatientDemographics): EnvironmentalAlert[] {
  const alerts: EnvironmentalAlert[] = [];
  const now = new Date();
  const month = now.getMonth();
  
  if (month >= 3 && month <= 5) {
    alerts.push({
      id: `env-pollen-${patient.patientId}`,
      type: "pollen",
      location: patient.state,
      level: "moderate",
      description: "Spring pollen levels are elevated. Tree and grass pollens are common triggers.",
      healthImpact: "May trigger allergies, asthma symptoms, and respiratory irritation",
      affectedConditions: ["Asthma", "Allergies", "COPD", "Respiratory conditions"],
      recommendations: [
        "Check daily pollen forecasts",
        "Keep windows closed during high pollen times",
        "Shower after spending time outdoors",
        "Consider over-the-counter antihistamines"
      ],
      validUntil: new Date(now.getFullYear(), 5, 30).toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (month >= 5 && month <= 8) {
    alerts.push({
      id: `env-heat-${patient.patientId}`,
      type: "heat",
      location: patient.state,
      level: patient.age >= 65 ? "unhealthy" : "moderate",
      description: "Summer heat advisories are in effect. Extreme heat can pose health risks.",
      healthImpact: "Risk of heat exhaustion, dehydration, and heat stroke",
      affectedConditions: ["Heart disease", "Diabetes", "Kidney disease", "Medications affecting heat tolerance"],
      recommendations: [
        "Stay hydrated - drink plenty of water",
        "Avoid strenuous outdoor activity during peak heat",
        "Stay in air-conditioned spaces when possible",
        "Check on elderly neighbors and family members"
      ],
      validUntil: new Date(now.getFullYear(), 8, 30).toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  if (month >= 6 && month <= 8 && (patient.state === "California" || patient.state === "Oregon" || patient.state === "Washington")) {
    alerts.push({
      id: `env-airquality-${patient.patientId}`,
      type: "air_quality",
      location: patient.state,
      level: "unhealthy",
      description: "Wildfire smoke may affect air quality. Sensitive groups should take precautions.",
      healthImpact: "Respiratory irritation, aggravation of existing conditions",
      affectedConditions: ["Asthma", "COPD", "Heart disease", "Lung conditions"],
      recommendations: [
        "Monitor local air quality index (AQI)",
        "Keep windows and doors closed",
        "Use air purifiers with HEPA filters",
        "Limit outdoor activities when AQI is unhealthy"
      ],
      validUntil: new Date(now.getFullYear(), 9, 31).toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
  
  return alerts;
}

async function generateAIInsights(patient: PatientDemographics, enrichment: Partial<PatientCDCEnrichment>): Promise<string[]> {
  if (!aiEnabled) {
    return [
      `Based on your location in ${patient.state} and health profile, staying current on vaccinations is important.`,
      "Regular check-ins with your healthcare provider can help you stay on top of preventive care.",
      "Monitor local health advisories to stay informed about conditions in your area."
    ];
  }

  try {
    const prompt = `You are a public health information assistant. Based on the following patient profile and CDC data, provide 3-4 personalized health awareness insights. Keep responses general and educational - NOT medical advice.

Patient: ${patient.age} year old ${patient.gender} in ${patient.state}
Conditions: ${patient.conditions.join(", ") || "None listed"}

Active advisories: ${enrichment.healthAdvisories?.map(a => a.title).join(", ") || "None"}
Vaccination status: ${enrichment.vaccinationRecommendations?.filter(v => v.dueStatus !== "up_to_date").length || 0} vaccines may need attention

Provide brief, actionable awareness points. Format as a JSON array of strings.

IMPORTANT: Include a reminder that these are general health awareness points and not personalized medical advice.`;

    const content = (await generatePhiSafeText({
      user: prompt,
      temperature: 0.7,
      maxTokens: 500,
    })) || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [content];
  } catch (error) {
    console.error("[PatientCDCEnrichment] AI insights error:", error);
    return [
      `Based on your location in ${patient.state}, seasonal health factors may be relevant.`,
      "Review your vaccination history with your healthcare provider.",
      "Stay informed about local health conditions through official CDC sources."
    ];
  }
}

export async function enrichPatientWithCDCData(userId: string, patient: PatientDemographics): Promise<PatientCDCEnrichment> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "PatientCDCEnrichment",
    details: `Enrich patient ${patient.patientId} with CDC public health data`
  });
  
  const healthAdvisories = generateSampleAdvisories(patient);
  const vaccinationRecommendations = generateVaccinationRecommendations(patient);
  const diseasePrevalence = generateDiseasePrevalence(patient);
  const environmentalAlerts = generateEnvironmentalAlerts(patient);
  
  const enrichment: Partial<PatientCDCEnrichment> = {
    patientId: patient.patientId,
    patientName: patient.name,
    enrichmentDate: new Date().toISOString(),
    location: {
      state: patient.state,
      county: patient.county
    },
    healthAdvisories,
    vaccinationRecommendations,
    diseasePrevalence,
    environmentalAlerts
  };
  
  const aiInsights = await generateAIInsights(patient, enrichment);
  
  const overallRiskLevel = 
    healthAdvisories.some(a => a.severity === "critical" || a.severity === "high") ||
    diseasePrevalence.some(d => d.riskLevel === "high") ? "high" :
    healthAdvisories.some(a => a.severity === "moderate") ||
    diseasePrevalence.some(d => d.riskLevel === "moderate") ? "moderate" : "low";
  
  const topRisks = [
    ...healthAdvisories.filter(a => a.severity !== "low").map(a => a.title),
    ...diseasePrevalence.filter(d => d.riskLevel !== "low").map(d => d.disease)
  ].slice(0, 3);
  
  const protectiveFactors = vaccinationRecommendations
    .filter(v => v.dueStatus === "up_to_date")
    .map(v => `${v.vaccineName} vaccination current`);
  
  return {
    ...enrichment,
    aiPersonalizedInsights: aiInsights,
    riskSummary: {
      overallRiskLevel,
      topRisks,
      protectiveFactors
    },
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  } as PatientCDCEnrichment;
}

export async function getPatientCDCEnrichmentById(userId: string, patientId: string): Promise<PatientCDCEnrichment> {
  const samplePatients: Record<string, PatientDemographics> = {
    "patient-1": {
      patientId: "patient-1",
      name: "John Smith",
      age: 68,
      gender: "male",
      state: "California",
      county: "Los Angeles",
      conditions: ["Type 2 Diabetes", "Hypertension"],
      medications: ["Metformin", "Lisinopril"],
      allergies: ["Penicillin"],
      lastVaccinations: [
        { vaccine: "Flu", date: "2024-10-15" },
        { vaccine: "COVID-19", date: "2024-09-20" }
      ]
    },
    "patient-2": {
      patientId: "patient-2",
      name: "Jane Doe",
      age: 45,
      gender: "female",
      state: "Texas",
      conditions: ["Asthma"],
      medications: ["Albuterol"],
      allergies: [],
      lastVaccinations: [
        { vaccine: "Flu", date: "2023-10-01" }
      ]
    },
    "patient-3": {
      patientId: "patient-3",
      name: "Robert Johnson",
      age: 72,
      gender: "male",
      state: "Florida",
      conditions: ["COPD", "Heart Disease"],
      medications: ["Spiriva", "Metoprolol"],
      allergies: ["Sulfa"],
      lastVaccinations: [
        { vaccine: "Flu", date: "2024-10-01" },
        { vaccine: "Pneumonia", date: "2023-01-15" },
        { vaccine: "Shingles", date: "2022-06-01" }
      ]
    }
  };
  
  const patient = samplePatients[patientId] || samplePatients["patient-1"];
  return enrichPatientWithCDCData(userId, patient);
}

export async function getAllPatientsWithCDCRisks(userId: string): Promise<{
  patients: Array<{
    patientId: string;
    patientName: string;
    overallRiskLevel: string;
    topRisks: string[];
    advisoryCount: number;
    vaccinesDue: number;
  }>;
  summary: {
    totalPatients: number;
    highRiskCount: number;
    moderateRiskCount: number;
    lowRiskCount: number;
    totalAdvisories: number;
  };
  noCdsDisclaimer: string;
}> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "PatientCDCRiskList",
    details: "View all patients with CDC risk data"
  });
  
  const patientIds = ["patient-1", "patient-2", "patient-3"];
  const enrichedPatients = await Promise.all(
    patientIds.map(id => getPatientCDCEnrichmentById(userId, id))
  );
  
  const patients = enrichedPatients.map(e => ({
    patientId: e.patientId,
    patientName: e.patientName,
    overallRiskLevel: e.riskSummary.overallRiskLevel,
    topRisks: e.riskSummary.topRisks,
    advisoryCount: e.healthAdvisories.length,
    vaccinesDue: e.vaccinationRecommendations.filter(v => v.dueStatus !== "up_to_date").length
  }));
  
  return {
    patients,
    summary: {
      totalPatients: patients.length,
      highRiskCount: patients.filter(p => p.overallRiskLevel === "high").length,
      moderateRiskCount: patients.filter(p => p.overallRiskLevel === "moderate").length,
      lowRiskCount: patients.filter(p => p.overallRiskLevel === "low").length,
      totalAdvisories: patients.reduce((sum, p) => sum + p.advisoryCount, 0)
    },
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}
