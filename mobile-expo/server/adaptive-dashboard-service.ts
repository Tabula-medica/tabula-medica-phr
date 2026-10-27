import crypto from "crypto";

// ============================================
// Interfaces
// ============================================

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  priority: number;
  size: "small" | "medium" | "large" | "full";
  position: { row: number; col: number };
  dataSource: string;
  refreshInterval: number;
  visibility: boolean;
  conditionRelevance: string[];
  config: Record<string, any>;
}

export interface DashboardConfig {
  id: string;
  userId: string;
  layout: DashboardWidget[];
  riskLevel: "low" | "moderate" | "high" | "critical";
  primaryConditions: string[];
  lastUpdated: Date;
  adaptationHistory: AdaptationEntry[];
}

export interface RiskAssessment {
  overall: "low" | "moderate" | "high" | "critical";
  factors: Array<{ name: string; score: number; trend: "improving" | "stable" | "worsening" }>;
  lastAssessed: Date;
  recommendedActions: string[];
}

export interface ConditionProfile {
  conditions: string[];
  medications: string[];
  allergies: string[];
  lastVisit: Date | null;
  upcomingAppointments: Array<{ date: Date; type: string; provider: string }>;
  activeAlerts: string[];
}

export interface AdaptationRule {
  id: string;
  condition: string;
  triggerMetric: string;
  threshold: number;
  action: "show" | "hide" | "promote" | "demote";
  widgetType: string;
  priority: number;
}

export interface DashboardTheme {
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    alertColor: string;
    riskIndicator: string;
  };
}

interface AdaptationEntry {
  timestamp: Date;
  reason: string;
  changes: string[];
  trigger: string;
}

interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  defaultSize: "small" | "medium" | "large" | "full";
  defaultPriority: number;
  defaultRefreshInterval: number;
  dataSource: string;
  conditionRelevance: string[];
  category: string;
}

interface PresetLayout {
  id: string;
  name: string;
  description: string;
  widgets: string[];
  targetConditions: string[];
}

// ============================================
// Widget Library
// ============================================

const WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    type: "vital_signs_monitor",
    title: "Vital Signs Monitor",
    description: "Real-time vitals including blood pressure, heart rate, SpO2, and temperature",
    defaultSize: "large",
    defaultPriority: 1,
    defaultRefreshInterval: 30,
    dataSource: "vitals",
    conditionRelevance: ["cardiac", "respiratory", "hypertension", "general"],
    category: "vitals",
  },
  {
    type: "lab_trends",
    title: "Lab Result Trends",
    description: "Lab result trends over time with reference ranges",
    defaultSize: "medium",
    defaultPriority: 3,
    defaultRefreshInterval: 3600,
    dataSource: "labs",
    conditionRelevance: ["general", "diabetes", "kidney", "liver"],
    category: "labs",
  },
  {
    type: "medication_tracker",
    title: "Medication Tracker",
    description: "Current medications with adherence tracking and refill reminders",
    defaultSize: "medium",
    defaultPriority: 2,
    defaultRefreshInterval: 300,
    dataSource: "medications",
    conditionRelevance: ["general", "diabetes", "cardiac", "mental_health"],
    category: "medications",
  },
  {
    type: "appointment_calendar",
    title: "Appointment Calendar",
    description: "Upcoming appointments and scheduling",
    defaultSize: "medium",
    defaultPriority: 4,
    defaultRefreshInterval: 1800,
    dataSource: "appointments",
    conditionRelevance: ["general"],
    category: "scheduling",
  },
  {
    type: "condition_summary",
    title: "Condition Summary",
    description: "Active conditions overview with status and management plans",
    defaultSize: "medium",
    defaultPriority: 2,
    defaultRefreshInterval: 3600,
    dataSource: "conditions",
    conditionRelevance: ["general"],
    category: "conditions",
  },
  {
    type: "risk_score_gauge",
    title: "Risk Score Gauge",
    description: "Overall health risk gauge visualization with breakdown",
    defaultSize: "small",
    defaultPriority: 1,
    defaultRefreshInterval: 1800,
    dataSource: "risk_assessment",
    conditionRelevance: ["general", "cardiac", "diabetes"],
    category: "risk",
  },
  {
    type: "bmi_tracker",
    title: "BMI Tracker",
    description: "Weight and BMI trend chart with goal tracking",
    defaultSize: "medium",
    defaultPriority: 5,
    defaultRefreshInterval: 86400,
    dataSource: "vitals",
    conditionRelevance: ["obesity", "diabetes", "general", "wellness"],
    category: "vitals",
  },
  {
    type: "blood_pressure_chart",
    title: "Blood Pressure Chart",
    description: "Blood pressure trend with target zones and alerts",
    defaultSize: "medium",
    defaultPriority: 2,
    defaultRefreshInterval: 300,
    dataSource: "vitals",
    conditionRelevance: ["cardiac", "hypertension", "kidney"],
    category: "vitals",
  },
  {
    type: "glucose_monitor",
    title: "Glucose Monitor",
    description: "Blood glucose trend with meal markers and insulin tracking",
    defaultSize: "large",
    defaultPriority: 1,
    defaultRefreshInterval: 60,
    dataSource: "glucose",
    conditionRelevance: ["diabetes", "metabolic"],
    category: "vitals",
  },
  {
    type: "a1c_progress",
    title: "HbA1c Progress",
    description: "HbA1c progress toward target with historical comparison",
    defaultSize: "small",
    defaultPriority: 2,
    defaultRefreshInterval: 86400,
    dataSource: "labs",
    conditionRelevance: ["diabetes"],
    category: "labs",
  },
  {
    type: "cholesterol_panel",
    title: "Cholesterol Panel",
    description: "Lipid panel comparison with targets (LDL, HDL, triglycerides)",
    defaultSize: "medium",
    defaultPriority: 3,
    defaultRefreshInterval: 86400,
    dataSource: "labs",
    conditionRelevance: ["cardiac", "metabolic", "diabetes"],
    category: "labs",
  },
  {
    type: "activity_tracker",
    title: "Activity Tracker",
    description: "Physical activity summary with step count, exercise minutes, and calories",
    defaultSize: "medium",
    defaultPriority: 5,
    defaultRefreshInterval: 300,
    dataSource: "activity",
    conditionRelevance: ["wellness", "cardiac", "obesity", "diabetes"],
    category: "wellness",
  },
  {
    type: "sleep_quality",
    title: "Sleep Quality",
    description: "Sleep patterns including duration, quality score, and sleep stages",
    defaultSize: "medium",
    defaultPriority: 6,
    defaultRefreshInterval: 86400,
    dataSource: "sleep",
    conditionRelevance: ["wellness", "mental_health", "general"],
    category: "wellness",
  },
  {
    type: "mental_health_score",
    title: "Mental Health Score",
    description: "PHQ-9 and GAD-7 screening trends with mood tracking",
    defaultSize: "medium",
    defaultPriority: 2,
    defaultRefreshInterval: 86400,
    dataSource: "mental_health",
    conditionRelevance: ["mental_health", "depression", "anxiety"],
    category: "mental_health",
  },
  {
    type: "allergy_alerts",
    title: "Allergy Alerts",
    description: "Active allergy notifications and cross-reactivity warnings",
    defaultSize: "small",
    defaultPriority: 1,
    defaultRefreshInterval: 3600,
    dataSource: "allergies",
    conditionRelevance: ["general", "allergy"],
    category: "safety",
  },
  {
    type: "immunization_status",
    title: "Immunization Status",
    description: "Vaccination status with upcoming due dates",
    defaultSize: "small",
    defaultPriority: 7,
    defaultRefreshInterval: 86400,
    dataSource: "immunizations",
    conditionRelevance: ["general", "pediatric", "geriatric"],
    category: "preventive",
  },
  {
    type: "care_gap_alerts",
    title: "Care Gap Alerts",
    description: "Overdue screenings, preventive care reminders, and follow-up alerts",
    defaultSize: "medium",
    defaultPriority: 1,
    defaultRefreshInterval: 3600,
    dataSource: "care_gaps",
    conditionRelevance: ["general", "geriatric", "oncology"],
    category: "preventive",
  },
  {
    type: "ai_health_summary",
    title: "AI Health Summary",
    description: "AI-generated health narrative summarizing recent trends and insights",
    defaultSize: "large",
    defaultPriority: 3,
    defaultRefreshInterval: 86400,
    dataSource: "ai_summary",
    conditionRelevance: ["general"],
    category: "insights",
  },
  {
    type: "treatment_efficacy",
    title: "Treatment Efficacy",
    description: "Treatment response visualization comparing outcomes to expected targets",
    defaultSize: "medium",
    defaultPriority: 3,
    defaultRefreshInterval: 86400,
    dataSource: "treatments",
    conditionRelevance: ["oncology", "chronic", "general"],
    category: "treatments",
  },
  {
    type: "symptom_diary",
    title: "Symptom Diary",
    description: "Symptom logging and trends with severity tracking",
    defaultSize: "medium",
    defaultPriority: 4,
    defaultRefreshInterval: 3600,
    dataSource: "symptoms",
    conditionRelevance: ["chronic", "mental_health", "oncology", "general"],
    category: "self_report",
  },
  {
    type: "nutrition_tracker",
    title: "Nutrition Tracker",
    description: "Dietary goals and tracking including macros and micronutrients",
    defaultSize: "medium",
    defaultPriority: 6,
    defaultRefreshInterval: 3600,
    dataSource: "nutrition",
    conditionRelevance: ["wellness", "diabetes", "obesity", "cardiac"],
    category: "wellness",
  },
  {
    type: "hydration_monitor",
    title: "Hydration Monitor",
    description: "Water intake tracking with daily goal and reminders",
    defaultSize: "small",
    defaultPriority: 7,
    defaultRefreshInterval: 1800,
    dataSource: "hydration",
    conditionRelevance: ["wellness", "kidney", "general"],
    category: "wellness",
  },
];

// ============================================
// Preset Layouts
// ============================================

const PRESET_LAYOUTS: PresetLayout[] = [
  {
    id: "general_wellness",
    name: "General Wellness",
    description: "Default wellness-focused layout for healthy patients",
    widgets: [
      "vital_signs_monitor", "condition_summary", "appointment_calendar",
      "medication_tracker", "activity_tracker", "sleep_quality",
      "nutrition_tracker", "hydration_monitor", "bmi_tracker",
      "immunization_status", "ai_health_summary",
    ],
    targetConditions: ["general", "wellness"],
  },
  {
    id: "cardiac_care",
    name: "Cardiac Care",
    description: "Optimized for patients with cardiovascular conditions",
    widgets: [
      "vital_signs_monitor", "blood_pressure_chart", "cholesterol_panel",
      "risk_score_gauge", "medication_tracker", "activity_tracker",
      "condition_summary", "care_gap_alerts", "lab_trends",
      "appointment_calendar", "ai_health_summary", "nutrition_tracker",
    ],
    targetConditions: ["cardiac", "hypertension"],
  },
  {
    id: "diabetes_management",
    name: "Diabetes Management",
    description: "Focused on glucose monitoring and diabetes care",
    widgets: [
      "glucose_monitor", "a1c_progress", "medication_tracker",
      "vital_signs_monitor", "nutrition_tracker", "bmi_tracker",
      "risk_score_gauge", "lab_trends", "activity_tracker",
      "care_gap_alerts", "condition_summary", "appointment_calendar",
    ],
    targetConditions: ["diabetes", "metabolic"],
  },
  {
    id: "oncology_monitoring",
    name: "Oncology Monitoring",
    description: "Tailored for cancer patients undergoing treatment",
    widgets: [
      "vital_signs_monitor", "treatment_efficacy", "lab_trends",
      "medication_tracker", "symptom_diary", "care_gap_alerts",
      "risk_score_gauge", "condition_summary", "appointment_calendar",
      "ai_health_summary", "mental_health_score", "nutrition_tracker",
    ],
    targetConditions: ["oncology", "cancer"],
  },
  {
    id: "prenatal_care",
    name: "Prenatal Care",
    description: "Designed for expectant mothers and prenatal monitoring",
    widgets: [
      "vital_signs_monitor", "appointment_calendar", "medication_tracker",
      "bmi_tracker", "nutrition_tracker", "symptom_diary",
      "lab_trends", "condition_summary", "hydration_monitor",
      "sleep_quality", "activity_tracker", "ai_health_summary",
    ],
    targetConditions: ["prenatal", "pregnancy"],
  },
  {
    id: "geriatric_care",
    name: "Geriatric Care",
    description: "Optimized for elderly patients with multiple conditions",
    widgets: [
      "vital_signs_monitor", "medication_tracker", "care_gap_alerts",
      "risk_score_gauge", "condition_summary", "appointment_calendar",
      "allergy_alerts", "immunization_status", "lab_trends",
      "blood_pressure_chart", "activity_tracker", "ai_health_summary",
    ],
    targetConditions: ["geriatric", "elderly"],
  },
  {
    id: "mental_health",
    name: "Mental Health",
    description: "Focused on mental health monitoring and wellness",
    widgets: [
      "mental_health_score", "symptom_diary", "medication_tracker",
      "sleep_quality", "activity_tracker", "appointment_calendar",
      "condition_summary", "ai_health_summary", "nutrition_tracker",
      "hydration_monitor", "vital_signs_monitor", "care_gap_alerts",
    ],
    targetConditions: ["mental_health", "depression", "anxiety"],
  },
];

// ============================================
// Adaptation Rules
// ============================================

function generateAdaptationRules(): AdaptationRule[] {
  return [
    { id: "diabetes_glucose", condition: "diabetes", triggerMetric: "glucose", threshold: 180, action: "promote", widgetType: "glucose_monitor", priority: 1 },
    { id: "diabetes_a1c", condition: "diabetes", triggerMetric: "a1c", threshold: 7.0, action: "promote", widgetType: "a1c_progress", priority: 1 },
    { id: "diabetes_meds", condition: "diabetes", triggerMetric: "medication_adherence", threshold: 80, action: "promote", widgetType: "medication_tracker", priority: 2 },
    { id: "cardiac_bp", condition: "cardiac", triggerMetric: "systolic_bp", threshold: 140, action: "promote", widgetType: "blood_pressure_chart", priority: 1 },
    { id: "cardiac_cholesterol", condition: "cardiac", triggerMetric: "ldl", threshold: 130, action: "promote", widgetType: "cholesterol_panel", priority: 2 },
    { id: "cardiac_vitals", condition: "cardiac", triggerMetric: "heart_rate", threshold: 100, action: "promote", widgetType: "vital_signs_monitor", priority: 1 },
    { id: "high_risk_care_gaps", condition: "high_risk", triggerMetric: "risk_score", threshold: 70, action: "show", widgetType: "care_gap_alerts", priority: 1 },
    { id: "high_risk_vitals", condition: "high_risk", triggerMetric: "risk_score", threshold: 70, action: "promote", widgetType: "vital_signs_monitor", priority: 1 },
    { id: "low_risk_activity", condition: "low_risk", triggerMetric: "risk_score", threshold: 30, action: "promote", widgetType: "activity_tracker", priority: 3 },
    { id: "low_risk_sleep", condition: "low_risk", triggerMetric: "risk_score", threshold: 30, action: "promote", widgetType: "sleep_quality", priority: 4 },
    { id: "low_risk_nutrition", condition: "low_risk", triggerMetric: "risk_score", threshold: 30, action: "promote", widgetType: "nutrition_tracker", priority: 5 },
    { id: "depression_mental", condition: "depression", triggerMetric: "phq9_score", threshold: 10, action: "promote", widgetType: "mental_health_score", priority: 1 },
    { id: "depression_symptom", condition: "depression", triggerMetric: "phq9_score", threshold: 10, action: "show", widgetType: "symptom_diary", priority: 2 },
    { id: "anxiety_mental", condition: "anxiety", triggerMetric: "gad7_score", threshold: 10, action: "promote", widgetType: "mental_health_score", priority: 1 },
    { id: "anxiety_symptom", condition: "anxiety", triggerMetric: "gad7_score", threshold: 10, action: "show", widgetType: "symptom_diary", priority: 2 },
    { id: "obesity_bmi", condition: "obesity", triggerMetric: "bmi", threshold: 30, action: "promote", widgetType: "bmi_tracker", priority: 2 },
    { id: "obesity_nutrition", condition: "obesity", triggerMetric: "bmi", threshold: 30, action: "promote", widgetType: "nutrition_tracker", priority: 3 },
    { id: "kidney_hydration", condition: "kidney", triggerMetric: "creatinine", threshold: 1.3, action: "promote", widgetType: "hydration_monitor", priority: 2 },
    { id: "oncology_treatment", condition: "oncology", triggerMetric: "treatment_cycle", threshold: 1, action: "promote", widgetType: "treatment_efficacy", priority: 1 },
    { id: "oncology_symptoms", condition: "oncology", triggerMetric: "symptom_count", threshold: 3, action: "promote", widgetType: "symptom_diary", priority: 2 },
  ];
}

// ============================================
// Theme Generation
// ============================================

function getThemeForRisk(riskLevel: "low" | "moderate" | "high" | "critical"): DashboardTheme {
  const themes: Record<string, DashboardTheme> = {
    low: {
      colorScheme: {
        primary: "#22c55e",
        secondary: "#86efac",
        accent: "#15803d",
        background: "#f0fdf4",
        alertColor: "#166534",
        riskIndicator: "green",
      },
    },
    moderate: {
      colorScheme: {
        primary: "#eab308",
        secondary: "#fde047",
        accent: "#a16207",
        background: "#fefce8",
        alertColor: "#854d0e",
        riskIndicator: "yellow",
      },
    },
    high: {
      colorScheme: {
        primary: "#f97316",
        secondary: "#fdba74",
        accent: "#c2410c",
        background: "#fff7ed",
        alertColor: "#9a3412",
        riskIndicator: "orange",
      },
    },
    critical: {
      colorScheme: {
        primary: "#ef4444",
        secondary: "#fca5a5",
        accent: "#b91c1c",
        background: "#fef2f2",
        alertColor: "#991b1b",
        riskIndicator: "red",
      },
    },
  };
  return themes[riskLevel];
}

// ============================================
// AdaptiveDashboardService
// ============================================

export class AdaptiveDashboardService {
  private dashboards: Map<string, DashboardConfig> = new Map();
  private adaptationRules: AdaptationRule[];
  private stats = {
    dashboardsGenerated: 0,
    adaptationsApplied: 0,
    widgetsAdded: 0,
    widgetsRemoved: 0,
    riskAssessments: 0,
  };

  constructor() {
    this.adaptationRules = generateAdaptationRules();
    console.log("[Dashboard] AdaptiveDashboardService initialized");
    console.log(`[Dashboard] Loaded ${WIDGET_LIBRARY.length} widget types`);
    console.log(`[Dashboard] Loaded ${this.adaptationRules.length} adaptation rules`);
    console.log(`[Dashboard] Loaded ${PRESET_LAYOUTS.length} preset layouts`);
  }

  generateDashboard(userId: string, conditionProfile: ConditionProfile): DashboardConfig {
    console.log(`[Dashboard] Generating dashboard for user ${userId}`);

    const riskLevel = this.calculateRiskFromProfile(conditionProfile);
    const relevantWidgets = this.selectWidgetsForProfile(conditionProfile, riskLevel);
    const layout = this.buildLayout(relevantWidgets, riskLevel);

    const config: DashboardConfig = {
      id: crypto.randomUUID(),
      userId,
      layout,
      riskLevel,
      primaryConditions: [...conditionProfile.conditions],
      lastUpdated: new Date(),
      adaptationHistory: [
        {
          timestamp: new Date(),
          reason: "Initial dashboard generation",
          changes: [`Created dashboard with ${layout.length} widgets`],
          trigger: "generation",
        },
      ],
    };

    this.dashboards.set(userId, config);
    this.stats.dashboardsGenerated++;

    console.log(`[Dashboard] Generated dashboard with ${layout.length} widgets, risk: ${riskLevel}`);
    return config;
  }

  updateDashboard(userId: string, newData: Partial<ConditionProfile>): DashboardConfig | null {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return null;
    }

    console.log(`[Dashboard] Updating dashboard for user ${userId}`);

    const changes: string[] = [];

    if (newData.conditions) {
      const newConditions = newData.conditions.filter(
        (c) => !dashboard.primaryConditions.includes(c)
      );
      if (newConditions.length > 0) {
        dashboard.primaryConditions.push(...newConditions);
        changes.push(`Added conditions: ${newConditions.join(", ")}`);

        for (const condition of newConditions) {
          const condWidgets = this.getConditionSpecificWidgets([condition]);
          for (const w of condWidgets) {
            const exists = dashboard.layout.some((lw) => lw.type === w.type);
            if (!exists) {
              const widget = this.createWidget(w, dashboard.layout.length);
              dashboard.layout.push(widget);
              changes.push(`Added widget: ${w.title}`);
            }
          }
        }
      }
    }

    if (newData.activeAlerts && newData.activeAlerts.length > 0) {
      const hasAlertWidget = dashboard.layout.some((w) => w.type === "care_gap_alerts");
      if (!hasAlertWidget) {
        const alertDef = WIDGET_LIBRARY.find((w) => w.type === "care_gap_alerts")!;
        const widget = this.createWidget(alertDef, 0);
        widget.priority = 1;
        dashboard.layout.unshift(widget);
        changes.push("Added care gap alerts widget due to active alerts");
      }
    }

    if (changes.length > 0) {
      dashboard.lastUpdated = new Date();
      dashboard.adaptationHistory.push({
        timestamp: new Date(),
        reason: "Dashboard updated with new patient data",
        changes,
        trigger: "data_update",
      });
      this.stats.adaptationsApplied++;
    }

    this.reassignPositions(dashboard.layout);
    this.dashboards.set(userId, dashboard);

    console.log(`[Dashboard] Updated dashboard with ${changes.length} changes`);
    return dashboard;
  }

  getRiskAssessment(userId: string, metrics: Record<string, number>): RiskAssessment {
    console.log(`[Dashboard] Calculating risk assessment for user ${userId}`);
    this.stats.riskAssessments++;

    const factors: RiskAssessment["factors"] = [];
    let totalScore = 0;
    let factorCount = 0;

    if (metrics.systolic_bp !== undefined) {
      const bpScore = metrics.systolic_bp > 180 ? 90 : metrics.systolic_bp > 140 ? 60 : metrics.systolic_bp > 120 ? 30 : 10;
      factors.push({ name: "Blood Pressure", score: bpScore, trend: metrics.systolic_bp > 140 ? "worsening" : "stable" });
      totalScore += bpScore;
      factorCount++;
    }

    if (metrics.heart_rate !== undefined) {
      const hrScore = metrics.heart_rate > 120 ? 80 : metrics.heart_rate > 100 ? 50 : metrics.heart_rate < 50 ? 60 : 10;
      factors.push({ name: "Heart Rate", score: hrScore, trend: "stable" });
      totalScore += hrScore;
      factorCount++;
    }

    if (metrics.glucose !== undefined) {
      const glucoseScore = metrics.glucose > 300 ? 90 : metrics.glucose > 200 ? 70 : metrics.glucose > 140 ? 40 : 10;
      factors.push({ name: "Blood Glucose", score: glucoseScore, trend: metrics.glucose > 200 ? "worsening" : "stable" });
      totalScore += glucoseScore;
      factorCount++;
    }

    if (metrics.a1c !== undefined) {
      const a1cScore = metrics.a1c > 10 ? 90 : metrics.a1c > 8 ? 65 : metrics.a1c > 7 ? 40 : 10;
      factors.push({ name: "HbA1c", score: a1cScore, trend: metrics.a1c > 8 ? "worsening" : "stable" });
      totalScore += a1cScore;
      factorCount++;
    }

    if (metrics.bmi !== undefined) {
      const bmiScore = metrics.bmi > 40 ? 80 : metrics.bmi > 35 ? 60 : metrics.bmi > 30 ? 40 : metrics.bmi < 18.5 ? 50 : 10;
      factors.push({ name: "BMI", score: bmiScore, trend: "stable" });
      totalScore += bmiScore;
      factorCount++;
    }

    if (metrics.spo2 !== undefined) {
      const spo2Score = metrics.spo2 < 90 ? 95 : metrics.spo2 < 94 ? 60 : metrics.spo2 < 96 ? 30 : 5;
      factors.push({ name: "Oxygen Saturation", score: spo2Score, trend: metrics.spo2 < 94 ? "worsening" : "stable" });
      totalScore += spo2Score;
      factorCount++;
    }

    if (metrics.phq9_score !== undefined) {
      const phqScore = metrics.phq9_score > 20 ? 85 : metrics.phq9_score > 15 ? 65 : metrics.phq9_score > 10 ? 45 : metrics.phq9_score > 5 ? 25 : 5;
      factors.push({ name: "Depression Screening (PHQ-9)", score: phqScore, trend: metrics.phq9_score > 15 ? "worsening" : "stable" });
      totalScore += phqScore;
      factorCount++;
    }

    if (metrics.ldl !== undefined) {
      const ldlScore = metrics.ldl > 190 ? 80 : metrics.ldl > 160 ? 60 : metrics.ldl > 130 ? 40 : 10;
      factors.push({ name: "LDL Cholesterol", score: ldlScore, trend: "stable" });
      totalScore += ldlScore;
      factorCount++;
    }

    if (metrics.creatinine !== undefined) {
      const creatScore = metrics.creatinine > 2.0 ? 80 : metrics.creatinine > 1.5 ? 55 : metrics.creatinine > 1.3 ? 30 : 10;
      factors.push({ name: "Creatinine", score: creatScore, trend: metrics.creatinine > 1.5 ? "worsening" : "stable" });
      totalScore += creatScore;
      factorCount++;
    }

    if (factorCount === 0) {
      factors.push({ name: "General Health", score: 20, trend: "stable" });
      totalScore = 20;
      factorCount = 1;
    }

    const avgScore = totalScore / factorCount;
    const overall: RiskAssessment["overall"] =
      avgScore >= 75 ? "critical" : avgScore >= 55 ? "high" : avgScore >= 35 ? "moderate" : "low";

    const recommendedActions: string[] = [];
    if (overall === "critical") {
      recommendedActions.push("Immediate clinical review recommended");
      recommendedActions.push("Increase monitoring frequency");
      recommendedActions.push("Contact care team for urgent assessment");
    } else if (overall === "high") {
      recommendedActions.push("Schedule follow-up appointment within 1 week");
      recommendedActions.push("Review current medication regimen");
      recommendedActions.push("Increase vital sign monitoring");
    } else if (overall === "moderate") {
      recommendedActions.push("Schedule routine follow-up within 1 month");
      recommendedActions.push("Continue current care plan with monitoring");
    } else {
      recommendedActions.push("Continue preventive care and wellness activities");
      recommendedActions.push("Maintain regular check-up schedule");
    }

    const assessment: RiskAssessment = {
      overall,
      factors,
      lastAssessed: new Date(),
      recommendedActions,
    };

    const dashboard = this.dashboards.get(userId);
    if (dashboard && dashboard.riskLevel !== overall) {
      dashboard.riskLevel = overall;
      dashboard.adaptationHistory.push({
        timestamp: new Date(),
        reason: `Risk level changed to ${overall}`,
        changes: [`Risk level updated from ${dashboard.riskLevel} to ${overall}`],
        trigger: "risk_assessment",
      });
      dashboard.lastUpdated = new Date();
      this.dashboards.set(userId, dashboard);
    }

    console.log(`[Dashboard] Risk assessment: ${overall} (avg score: ${avgScore.toFixed(1)})`);
    return assessment;
  }

  getWidgetLibrary(): WidgetDefinition[] {
    console.log(`[Dashboard] Returning widget library (${WIDGET_LIBRARY.length} widgets)`);
    return [...WIDGET_LIBRARY];
  }

  addWidget(userId: string, widgetType: string, config?: Record<string, any>): DashboardWidget | null {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return null;
    }

    const widgetDef = WIDGET_LIBRARY.find((w) => w.type === widgetType);
    if (!widgetDef) {
      console.log(`[Dashboard] Unknown widget type: ${widgetType}`);
      return null;
    }

    const exists = dashboard.layout.some((w) => w.type === widgetType);
    if (exists) {
      console.log(`[Dashboard] Widget ${widgetType} already exists for user ${userId}`);
      return null;
    }

    const widget = this.createWidget(widgetDef, dashboard.layout.length);
    if (config) {
      widget.config = { ...widget.config, ...config };
    }

    dashboard.layout.push(widget);
    dashboard.lastUpdated = new Date();
    dashboard.adaptationHistory.push({
      timestamp: new Date(),
      reason: `Manually added widget: ${widgetDef.title}`,
      changes: [`Added ${widgetDef.title} widget`],
      trigger: "manual",
    });

    this.reassignPositions(dashboard.layout);
    this.dashboards.set(userId, dashboard);
    this.stats.widgetsAdded++;

    console.log(`[Dashboard] Added widget ${widgetType} for user ${userId}`);
    return widget;
  }

  removeWidget(userId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return false;
    }

    const idx = dashboard.layout.findIndex((w) => w.id === widgetId);
    if (idx === -1) {
      console.log(`[Dashboard] Widget ${widgetId} not found for user ${userId}`);
      return false;
    }

    const removed = dashboard.layout.splice(idx, 1)[0];
    dashboard.lastUpdated = new Date();
    dashboard.adaptationHistory.push({
      timestamp: new Date(),
      reason: `Removed widget: ${removed.title}`,
      changes: [`Removed ${removed.title} widget`],
      trigger: "manual",
    });

    this.reassignPositions(dashboard.layout);
    this.dashboards.set(userId, dashboard);
    this.stats.widgetsRemoved++;

    console.log(`[Dashboard] Removed widget ${removed.title} for user ${userId}`);
    return true;
  }

  reorderWidgets(userId: string, widgetOrder: string[]): DashboardConfig | null {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return null;
    }

    const reordered: DashboardWidget[] = [];
    for (const widgetId of widgetOrder) {
      const widget = dashboard.layout.find((w) => w.id === widgetId);
      if (widget) {
        reordered.push(widget);
      }
    }

    for (const widget of dashboard.layout) {
      if (!reordered.some((w) => w.id === widget.id)) {
        reordered.push(widget);
      }
    }

    dashboard.layout = reordered;
    this.reassignPositions(dashboard.layout);
    dashboard.lastUpdated = new Date();
    dashboard.adaptationHistory.push({
      timestamp: new Date(),
      reason: "Manual widget reorder",
      changes: ["Widget order updated by user"],
      trigger: "manual",
    });

    this.dashboards.set(userId, dashboard);
    console.log(`[Dashboard] Reordered widgets for user ${userId}`);
    return dashboard;
  }

  getAdaptationHistory(userId: string): AdaptationEntry[] {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return [];
    }
    console.log(`[Dashboard] Returning ${dashboard.adaptationHistory.length} adaptation entries for user ${userId}`);
    return [...dashboard.adaptationHistory];
  }

  getConditionSpecificWidgets(conditions: string[]): WidgetDefinition[] {
    const normalizedConditions = conditions.map((c) => c.toLowerCase());
    const conditionMap: Record<string, string[]> = {
      diabetes: ["diabetes", "metabolic", "type 2 diabetes", "type 1 diabetes", "diabetic"],
      cardiac: ["cardiac", "heart", "cardiovascular", "heart failure", "coronary", "hypertension"],
      oncology: ["oncology", "cancer", "tumor", "malignant", "chemotherapy"],
      mental_health: ["depression", "anxiety", "mental_health", "bipolar", "ptsd", "schizophrenia"],
      respiratory: ["respiratory", "asthma", "copd", "pulmonary"],
      kidney: ["kidney", "renal", "ckd", "chronic kidney disease"],
      obesity: ["obesity", "overweight", "morbid obesity"],
      prenatal: ["prenatal", "pregnancy", "pregnant", "obstetric"],
      geriatric: ["geriatric", "elderly"],
    };

    const matchedCategories = new Set<string>();
    for (const condition of normalizedConditions) {
      for (const [category, keywords] of Object.entries(conditionMap)) {
        if (keywords.some((kw) => condition.includes(kw) || kw.includes(condition))) {
          matchedCategories.add(category);
        }
      }
    }

    if (matchedCategories.size === 0) {
      matchedCategories.add("general");
    }

    const relevantWidgets = WIDGET_LIBRARY.filter((w) =>
      w.conditionRelevance.some(
        (cr) => matchedCategories.has(cr) || normalizedConditions.includes(cr)
      )
    );

    console.log(`[Dashboard] Found ${relevantWidgets.length} widgets for conditions: ${conditions.join(", ")}`);
    return relevantWidgets;
  }

  applyAdaptationRules(userId: string, metrics: Record<string, number>): { changes: string[]; rulesApplied: AdaptationRule[] } {
    const dashboard = this.dashboards.get(userId);
    if (!dashboard) {
      console.log(`[Dashboard] No dashboard found for user ${userId}`);
      return { changes: [], rulesApplied: [] };
    }

    console.log(`[Dashboard] Applying adaptation rules for user ${userId}`);

    const changes: string[] = [];
    const rulesApplied: AdaptationRule[] = [];
    const conditions = dashboard.primaryConditions.map((c) => c.toLowerCase());

    const riskAssessment = this.getRiskAssessment(userId, metrics);
    if (riskAssessment.overall === "high" || riskAssessment.overall === "critical") {
      conditions.push("high_risk");
    } else if (riskAssessment.overall === "low") {
      conditions.push("low_risk");
    }

    for (const rule of this.adaptationRules) {
      const conditionMatch = conditions.some(
        (c) => c.includes(rule.condition) || rule.condition.includes(c)
      );
      if (!conditionMatch) continue;

      const metricValue = metrics[rule.triggerMetric];
      if (metricValue === undefined) continue;

      const thresholdExceeded =
        rule.action === "promote" || rule.action === "show"
          ? metricValue >= rule.threshold
          : metricValue <= rule.threshold;

      if (!thresholdExceeded) continue;

      rulesApplied.push(rule);

      switch (rule.action) {
        case "promote": {
          const widgetIdx = dashboard.layout.findIndex((w) => w.type === rule.widgetType);
          if (widgetIdx > 0) {
            const widget = dashboard.layout.splice(widgetIdx, 1)[0];
            widget.priority = Math.max(1, rule.priority);
            dashboard.layout.unshift(widget);
            changes.push(`Promoted ${widget.title} to top (rule: ${rule.id})`);
          }
          break;
        }
        case "show": {
          const exists = dashboard.layout.some((w) => w.type === rule.widgetType);
          if (!exists) {
            const widgetDef = WIDGET_LIBRARY.find((w) => w.type === rule.widgetType);
            if (widgetDef) {
              const widget = this.createWidget(widgetDef, 0);
              widget.priority = rule.priority;
              dashboard.layout.unshift(widget);
              changes.push(`Added ${widgetDef.title} widget (rule: ${rule.id})`);
            }
          } else {
            const widget = dashboard.layout.find((w) => w.type === rule.widgetType);
            if (widget && !widget.visibility) {
              widget.visibility = true;
              changes.push(`Made ${widget.title} visible (rule: ${rule.id})`);
            }
          }
          break;
        }
        case "hide": {
          const widget = dashboard.layout.find((w) => w.type === rule.widgetType);
          if (widget && widget.visibility) {
            widget.visibility = false;
            changes.push(`Hidden ${widget.title} (rule: ${rule.id})`);
          }
          break;
        }
        case "demote": {
          const widget = dashboard.layout.find((w) => w.type === rule.widgetType);
          if (widget) {
            widget.priority = Math.min(10, widget.priority + 2);
            changes.push(`Demoted ${widget.title} (rule: ${rule.id})`);
          }
          break;
        }
      }
    }

    if (riskAssessment.overall === "high" || riskAssessment.overall === "critical") {
      for (const widget of dashboard.layout) {
        if (widget.refreshInterval > 300) {
          widget.refreshInterval = Math.max(60, Math.floor(widget.refreshInterval / 2));
        }
      }
      changes.push("Increased refresh intervals for high-risk monitoring");
    }

    if (changes.length > 0) {
      this.reassignPositions(dashboard.layout);
      dashboard.riskLevel = riskAssessment.overall;
      dashboard.lastUpdated = new Date();
      dashboard.adaptationHistory.push({
        timestamp: new Date(),
        reason: `Adaptation rules applied (${rulesApplied.length} rules triggered)`,
        changes,
        trigger: "adaptation_rules",
      });
      this.stats.adaptationsApplied++;
      this.dashboards.set(userId, dashboard);
    }

    console.log(`[Dashboard] Applied ${rulesApplied.length} rules, ${changes.length} changes`);
    return { changes, rulesApplied };
  }

  getPresetLayouts(): PresetLayout[] {
    console.log(`[Dashboard] Returning ${PRESET_LAYOUTS.length} preset layouts`);
    return [...PRESET_LAYOUTS];
  }

  getStats(): typeof this.stats & { activeDashboards: number; totalWidgetTypes: number; totalRules: number; totalPresets: number } {
    return {
      ...this.stats,
      activeDashboards: this.dashboards.size,
      totalWidgetTypes: WIDGET_LIBRARY.length,
      totalRules: this.adaptationRules.length,
      totalPresets: PRESET_LAYOUTS.length,
    };
  }

  getTheme(userId: string): DashboardTheme {
    const dashboard = this.dashboards.get(userId);
    const riskLevel = dashboard?.riskLevel || "low";
    return getThemeForRisk(riskLevel);
  }

  getDashboard(userId: string): DashboardConfig | null {
    return this.dashboards.get(userId) || null;
  }

  // ============================================
  // Private helpers
  // ============================================

  private calculateRiskFromProfile(profile: ConditionProfile): "low" | "moderate" | "high" | "critical" {
    let score = 0;

    const highRiskConditions = ["cancer", "heart failure", "ckd", "copd", "stroke", "sepsis"];
    const moderateRiskConditions = ["diabetes", "hypertension", "asthma", "depression", "obesity"];

    for (const condition of (profile.conditions || [])) {
      const lower = condition.toLowerCase();
      if (highRiskConditions.some((c) => lower.includes(c))) {
        score += 30;
      } else if (moderateRiskConditions.some((c) => lower.includes(c))) {
        score += 15;
      } else {
        score += 5;
      }
    }

    if ((profile.medications || []).length > 5) score += 15;
    else if ((profile.medications || []).length > 3) score += 8;

    if ((profile.allergies || []).length > 3) score += 10;

    if ((profile.activeAlerts || []).length > 0) score += (profile.activeAlerts || []).length * 10;

    if (score >= 70) return "critical";
    if (score >= 45) return "high";
    if (score >= 20) return "moderate";
    return "low";
  }

  private selectWidgetsForProfile(profile: ConditionProfile, riskLevel: string): WidgetDefinition[] {
    const conditionWidgets = this.getConditionSpecificWidgets(profile.conditions);

    const coreWidgets = WIDGET_LIBRARY.filter((w) =>
      ["vital_signs_monitor", "condition_summary", "appointment_calendar", "medication_tracker", "risk_score_gauge"].includes(w.type)
    );

    const allWidgets = new Map<string, WidgetDefinition>();
    for (const w of coreWidgets) allWidgets.set(w.type, w);
    for (const w of conditionWidgets) allWidgets.set(w.type, w);

    if (riskLevel === "high" || riskLevel === "critical") {
      const careGaps = WIDGET_LIBRARY.find((w) => w.type === "care_gap_alerts");
      const allergyAlerts = WIDGET_LIBRARY.find((w) => w.type === "allergy_alerts");
      if (careGaps) allWidgets.set(careGaps.type, careGaps);
      if (allergyAlerts) allWidgets.set(allergyAlerts.type, allergyAlerts);
    }

    if (riskLevel === "low") {
      const wellnessWidgets = WIDGET_LIBRARY.filter((w) => w.category === "wellness");
      for (const w of wellnessWidgets) allWidgets.set(w.type, w);
    }

    if (profile.allergies.length > 0) {
      const allergyWidget = WIDGET_LIBRARY.find((w) => w.type === "allergy_alerts");
      if (allergyWidget) allWidgets.set(allergyWidget.type, allergyWidget);
    }

    const aiSummary = WIDGET_LIBRARY.find((w) => w.type === "ai_health_summary");
    if (aiSummary) allWidgets.set(aiSummary.type, aiSummary);

    return Array.from(allWidgets.values());
  }

  private buildLayout(widgetDefs: WidgetDefinition[], riskLevel: string): DashboardWidget[] {
    const sorted = [...widgetDefs].sort((a, b) => a.defaultPriority - b.defaultPriority);

    const widgets: DashboardWidget[] = sorted.map((def, index) => this.createWidget(def, index));

    if (riskLevel === "high" || riskLevel === "critical") {
      for (const widget of widgets) {
        if (widget.refreshInterval > 300) {
          widget.refreshInterval = Math.max(60, Math.floor(widget.refreshInterval / 2));
        }
      }
    }

    return widgets;
  }

  private createWidget(def: WidgetDefinition, index: number): DashboardWidget {
    const colsPerRow = 2;
    return {
      id: crypto.randomUUID(),
      type: def.type,
      title: def.title,
      priority: def.defaultPriority,
      size: def.defaultSize,
      position: {
        row: Math.floor(index / colsPerRow),
        col: index % colsPerRow,
      },
      dataSource: def.dataSource,
      refreshInterval: def.defaultRefreshInterval,
      visibility: true,
      conditionRelevance: [...def.conditionRelevance],
      config: {},
    };
  }

  private reassignPositions(widgets: DashboardWidget[]): void {
    const colsPerRow = 2;
    widgets.forEach((widget, index) => {
      widget.position = {
        row: Math.floor(index / colsPerRow),
        col: index % colsPerRow,
      };
    });
  }
}

// ============================================
// Singleton & Initialization
// ============================================

export const adaptiveDashboardService = new AdaptiveDashboardService();

export function initializeAdaptiveDashboard(): void {
  console.log("[Dashboard] Adaptive Dashboard Service ready");
  console.log(`[Dashboard] Stats: ${JSON.stringify(adaptiveDashboardService.getStats())}`);
}
