import { Router } from "express";
import { wearableIntegrationService } from "./services/wearable-integration-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { randomUUID } from "crypto";

const router = Router();

// ============================================
// DATA CONSENT MANAGEMENT
// ============================================

interface DataConsent {
  id: string;
  patientId: string;
  dataSource: string;
  dataTypes: string[];
  consentGiven: boolean;
  consentDate: string;
  expirationDate?: string;
  purpose: string;
  canShare: boolean;
  shareWith: string[];
  auditLog: Array<{
    action: string;
    timestamp: string;
    actor: string;
  }>;
}

// All fields are optional to support granular consent-based filtering
// Only fields for which user has granted consent will be populated
interface ConsolidatedHealthData {
  vitals?: {
    heartRate?: { current: number; resting: number; trend: "up" | "down" | "stable" };
    bloodOxygen?: { current: number; trend: "up" | "down" | "stable" };
    hrv?: { current: number; average: number; trend: "up" | "down" | "stable" };
  };
  activity?: {
    stepsToday?: number;
    stepsGoal?: number;
    stepsProgress?: number;
    activeMinutes?: number;
    caloriesBurned?: number;
    distance?: number;
    floors?: number;
    weeklyTrend?: Array<{ date: string; steps: number }>;
  };
  sleep?: {
    lastNight: {
      totalHours: number;
      deepSleepPercent: number;
      remSleepPercent: number;
      efficiency: number;
      score?: number;
    } | null;
    weeklyAverage: number;
    trend: "improving" | "declining" | "stable";
  };
  sources: Array<{
    id: string;
    name: string;
    provider: string;
    lastSync: string;
    status: string;
    dataTypes: string[];
  }>;
  lastUpdated: string;
}

// In-memory consent store
const consentsStore: Map<string, DataConsent[]> = new Map();

// Initialize sample consents
function initializeSampleConsents(): void {
  const patientId = "patient-001";
  consentsStore.set(patientId, [
    {
      id: "consent-001",
      patientId,
      dataSource: "fitbit",
      dataTypes: ["steps", "heart_rate", "sleep", "activity"],
      consentGiven: true,
      consentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expirationDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: "Personal health tracking and record integration",
      canShare: true,
      shareWith: ["primary_care_provider"],
      auditLog: [
        { action: "consent_granted", timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), actor: "patient" }
      ]
    },
    {
      id: "consent-002",
      patientId,
      dataSource: "apple_health",
      dataTypes: ["steps", "heart_rate", "hrv", "sleep", "blood_oxygen"],
      consentGiven: true,
      consentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: "Personal health tracking and record integration",
      canShare: false,
      shareWith: [],
      auditLog: [
        { action: "consent_granted", timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), actor: "patient" }
      ]
    }
  ]);
}

initializeSampleConsents();

// Get all data consents for a patient
router.get("/api/health-data/consents", async (req, res) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    await logPhiAccess({
      action: "read",
      resourceType: "DataConsent",
      patientId,
      userId: patientId
    });

    const consents = consentsStore.get(patientId) || [];
    res.json({
      success: true,
      consents,
      disclaimer: "You control your health data. Review and manage which sources can share data with your health record."
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error getting consents:", error);
    res.status(500).json({ error: "Failed to get data consents" });
  }
});

// Update consent settings
router.post("/api/health-data/consents", async (req, res) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";
    const { dataSource, dataTypes, consentGiven, purpose, canShare, shareWith } = req.body;

    if (!dataSource || !dataTypes || typeof consentGiven !== "boolean") {
      return res.status(400).json({ error: "dataSource, dataTypes, and consentGiven are required" });
    }

    const consents = consentsStore.get(patientId) || [];
    const existingIndex = consents.findIndex(c => c.dataSource === dataSource);

    const now = new Date().toISOString();
    const newConsent: DataConsent = {
      id: existingIndex >= 0 ? consents[existingIndex].id : randomUUID(),
      patientId,
      dataSource,
      dataTypes,
      consentGiven,
      consentDate: now,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: purpose || "Personal health tracking",
      canShare: canShare || false,
      shareWith: shareWith || [],
      auditLog: existingIndex >= 0 
        ? [...consents[existingIndex].auditLog, { action: consentGiven ? "consent_updated" : "consent_revoked", timestamp: now, actor: "patient" }]
        : [{ action: "consent_granted", timestamp: now, actor: "patient" }]
    };

    if (existingIndex >= 0) {
      consents[existingIndex] = newConsent;
    } else {
      consents.push(newConsent);
    }

    consentsStore.set(patientId, consents);

    await logPhiAccess({
      action: "write",
      resourceType: "DataConsent",
      patientId,
      userId: patientId,
      details: `${consentGiven ? "granted" : "revoked"} consent for ${dataSource}`
    });

    res.json({
      success: true,
      consent: newConsent,
      message: consentGiven ? "Consent granted successfully" : "Consent revoked successfully"
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error updating consent:", error);
    res.status(500).json({ error: "Failed to update consent" });
  }
});

// Revoke consent for a data source
router.delete("/api/health-data/consents/:consentId", async (req, res) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";
    const { consentId } = req.params;

    const consents = consentsStore.get(patientId) || [];
    const consentIndex = consents.findIndex(c => c.id === consentId);

    if (consentIndex === -1) {
      return res.status(404).json({ error: "Consent not found" });
    }

    const consent = consents[consentIndex];
    consent.consentGiven = false;
    consent.auditLog.push({
      action: "consent_revoked",
      timestamp: new Date().toISOString(),
      actor: "patient"
    });

    await logPhiAccess({
      action: "delete",
      resourceType: "DataConsent",
      patientId,
      userId: patientId,
      details: `revoked consent for ${consent.dataSource}`
    });

    res.json({
      success: true,
      message: `Consent revoked for ${consent.dataSource}`,
      consent
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error revoking consent:", error);
    res.status(500).json({ error: "Failed to revoke consent" });
  }
});

// ============================================
// CONSOLIDATED HEALTH DATA DASHBOARD
// ============================================

router.get("/api/health-data/consolidated", async (req, res) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    // Check consents - enforce granular data type filtering
    const consents = consentsStore.get(patientId) || [];
    const activeConsents = consents.filter(c => c.consentGiven);

    if (activeConsents.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "No data sources connected. Connect wearable devices and grant consent to see your health data.",
        requiresConsent: true
      });
    }

    // Build set of consented data types across all sources
    const consentedDataTypes = new Set<string>();
    const consentedSources = new Set<string>();
    activeConsents.forEach(c => {
      consentedSources.add(c.dataSource);
      c.dataTypes.forEach(dt => consentedDataTypes.add(dt));
    });

    // Helper to check if a specific data type is consented
    const hasConsentFor = (dataType: string): boolean => consentedDataTypes.has(dataType);

    // Only fetch data from wearable service for consented data types (minimize data exposure)
    const devices = await wearableIntegrationService.getConnectedDevices(patientId);
    const summary = await wearableIntegrationService.getSummary(patientId);
    
    // Conditionally fetch data based on consent - only process consented data types
    const stepsData = hasConsentFor("steps") 
      ? await wearableIntegrationService.getStepsData(patientId, 7) 
      : [];
    const sleepData = hasConsentFor("sleep") 
      ? await wearableIntegrationService.getSleepData(patientId, 7) 
      : [];
    const hrvData = hasConsentFor("hrv") 
      ? await wearableIntegrationService.getHrvData(patientId, 7) 
      : [];

    // Calculate trends - only use data for which consent exists
    const calculateTrend = (data: number[]): "up" | "down" | "stable" => {
      if (data.length < 2) return "stable";
      const recent = data.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, data.length);
      const older = data.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, data.length);
      if (recent > older * 1.05) return "up";
      if (recent < older * 0.95) return "down";
      return "stable";
    };

    const sleepTrend = (): "improving" | "declining" | "stable" => {
      if (!hasConsentFor("sleep") || sleepData.length < 2) return "stable";
      const recentAvg = sleepData.slice(-3).reduce((a, s) => a + (s.sleepScore || s.sleepEfficiency), 0) / Math.min(3, sleepData.length);
      const olderAvg = sleepData.slice(0, 3).reduce((a, s) => a + (s.sleepScore || s.sleepEfficiency), 0) / Math.min(3, sleepData.length);
      if (recentAvg > olderAvg * 1.05) return "improving";
      if (recentAvg < olderAvg * 0.95) return "declining";
      return "stable";
    };

    // Build consolidated data with granular consent filtering
    // Only include data sections for which consent exists
    const consolidatedData: Partial<ConsolidatedHealthData> & { lastUpdated: string; sources: any[] } = {
      lastUpdated: new Date().toISOString(),
      sources: []
    };

    // Vitals section - only include consented data types
    // IMPORTANT: Do not derive trends from non-consented data types to prevent data leakage
    if (hasConsentFor("heart_rate") || hasConsentFor("hrv")) {
      consolidatedData.vitals = {} as any;
      
      if (hasConsentFor("heart_rate")) {
        // Heart rate trend: only use HRV-derived trend if HRV is also consented
        // Otherwise, return "stable" to prevent HRV data inference leakage
        const heartRateTrend: "up" | "down" | "stable" = hasConsentFor("hrv") 
          ? calculateTrend(hrvData.map(h => h.avgHrv)) 
          : "stable";
        
        consolidatedData.vitals!.heartRate = {
          current: summary.restingHeartRate + Math.floor(Math.random() * 10),
          resting: summary.restingHeartRate,
          trend: heartRateTrend
        };
      }
      
      if (hasConsentFor("hrv")) {
        consolidatedData.vitals!.hrv = {
          current: hrvData.length > 0 ? hrvData[hrvData.length - 1].avgHrv : summary.avgHrv,
          average: summary.avgHrv,
          trend: calculateTrend(hrvData.map(h => h.avgHrv))
        };
      }
    }

    // Activity section - only include consented data types
    if (hasConsentFor("steps") || hasConsentFor("activity") || hasConsentFor("calories")) {
      consolidatedData.activity = {} as any;
      
      if (hasConsentFor("steps")) {
        consolidatedData.activity!.stepsToday = summary.todaySteps;
        consolidatedData.activity!.stepsGoal = 10000;
        consolidatedData.activity!.stepsProgress = Math.min(100, Math.round((summary.todaySteps / 10000) * 100));
        consolidatedData.activity!.distance = stepsData.length > 0 ? stepsData[stepsData.length - 1].distance : 0;
        consolidatedData.activity!.floors = stepsData.length > 0 ? stepsData[stepsData.length - 1].floors : undefined;
        consolidatedData.activity!.weeklyTrend = stepsData.map(s => ({ date: s.date, steps: s.steps }));
      }
      
      if (hasConsentFor("activity")) {
        consolidatedData.activity!.activeMinutes = summary.activeMinutesToday;
      }
      
      if (hasConsentFor("calories")) {
        consolidatedData.activity!.caloriesBurned = summary.caloriesBurnedToday;
      }
    }

    // Sleep section - only if sleep data type is consented
    if (hasConsentFor("sleep")) {
      consolidatedData.sleep = {
        lastNight: summary.lastNightSleep ? {
          totalHours: summary.lastNightSleep.totalMinutes / 60,
          deepSleepPercent: Math.round((summary.lastNightSleep.deepSleepMinutes / summary.lastNightSleep.totalMinutes) * 100),
          remSleepPercent: Math.round((summary.lastNightSleep.remSleepMinutes / summary.lastNightSleep.totalMinutes) * 100),
          efficiency: summary.lastNightSleep.sleepEfficiency,
          score: summary.lastNightSleep.sleepScore
        } : null,
        weeklyAverage: sleepData.length > 0 
          ? sleepData.reduce((a, s) => a + s.totalMinutes, 0) / sleepData.length / 60 
          : 0,
        trend: sleepTrend()
      };
    }

    // Only include sources with active consent - filter by consented sources
    consolidatedData.sources = devices
      .filter(d => consentedSources.has(d.provider))
      .map(d => {
        const consent = activeConsents.find(c => c.dataSource === d.provider);
        return {
          id: d.id,
          name: d.name,
          provider: d.provider,
          lastSync: d.lastSync,
          status: d.status,
          dataTypes: consent?.dataTypes || []
        };
      });

    // Track which data sections are actually returned (based on consent AND data availability)
    const availableSections: string[] = [];
    const returnedDataTypes: string[] = [];
    
    if (consolidatedData.vitals) {
      availableSections.push("vitals");
      if (consolidatedData.vitals.heartRate) returnedDataTypes.push("heart_rate");
      if (consolidatedData.vitals.hrv) returnedDataTypes.push("hrv");
    }
    if (consolidatedData.activity) {
      availableSections.push("activity");
      if (consolidatedData.activity.stepsToday !== undefined) returnedDataTypes.push("steps");
      if (consolidatedData.activity.activeMinutes !== undefined) returnedDataTypes.push("activity");
      if (consolidatedData.activity.caloriesBurned !== undefined) returnedDataTypes.push("calories");
    }
    if (consolidatedData.sleep) {
      availableSections.push("sleep");
      returnedDataTypes.push("sleep");
    }

    // Audit logging: log only the ACTUAL data types returned, not all consented types
    await logPhiAccess({
      action: "read",
      resourceType: "ConsolidatedHealthData",
      patientId,
      userId: patientId,
      details: `Returned sections: [${availableSections.join(", ")}], data types: [${returnedDataTypes.join(", ")}]`
    });

    res.json({
      success: true,
      data: consolidatedData,
      consents: activeConsents.map(c => ({ dataSource: c.dataSource, dataTypes: c.dataTypes })),
      consentedDataTypes: Array.from(consentedDataTypes),
      availableSections,
      partialData: availableSections.length < 3,
      partialDataMessage: availableSections.length < 3 
        ? `Showing ${availableSections.join(", ")} data based on your consent settings. Grant additional consents to see more health data.`
        : undefined,
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This consolidated health data is for informational purposes only and does NOT constitute medical advice. Always consult with your healthcare provider for medical decisions."
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error getting consolidated data:", error);
    res.status(500).json({ error: "Failed to get consolidated health data" });
  }
});

// Get data access audit log
router.get("/api/health-data/audit-log", async (req, res) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const consents = consentsStore.get(patientId) || [];
    const auditLog = consents.flatMap(c => 
      c.auditLog.map(log => ({
        ...log,
        dataSource: c.dataSource,
        consentId: c.id
      }))
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      auditLog,
      message: "Review who accessed your health data and when"
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error getting audit log:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

// Available data sources for connection
router.get("/api/health-data/available-sources", async (req, res) => {
  try {
    res.json({
      success: true,
      sources: [
        {
          id: "fitbit",
          name: "Fitbit",
          description: "Sync activity, sleep, and heart rate data from your Fitbit device",
          dataTypes: ["steps", "sleep", "heart_rate", "activity", "calories"],
          icon: "fitbit",
          connected: false
        },
        {
          id: "apple_health",
          name: "Apple Health",
          description: "Import health data from Apple Health on your iPhone or Apple Watch",
          dataTypes: ["steps", "sleep", "heart_rate", "hrv", "blood_oxygen", "activity"],
          icon: "apple",
          connected: false
        },
        {
          id: "google_fit",
          name: "Google Fit",
          description: "Sync fitness and wellness data from Google Fit",
          dataTypes: ["steps", "sleep", "heart_rate", "activity", "calories"],
          icon: "google_fit",
          connected: false
        },
        {
          id: "garmin",
          name: "Garmin Connect",
          description: "Import training and health metrics from Garmin devices",
          dataTypes: ["steps", "sleep", "heart_rate", "hrv", "activity", "stress"],
          icon: "garmin",
          connected: false
        },
        {
          id: "samsung_health",
          name: "Samsung Health",
          description: "Sync health data from Samsung Galaxy devices and wearables",
          dataTypes: ["steps", "sleep", "heart_rate", "activity", "stress"],
          icon: "samsung",
          connected: false
        }
      ]
    });
  } catch (error) {
    console.error("[ConsolidatedHealth] Error getting available sources:", error);
    res.status(500).json({ error: "Failed to get available sources" });
  }
});

export default router;
