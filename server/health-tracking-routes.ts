import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "./db";
import {
  healthGoalsTable,
  goalProgressTable,
  vitalSignsTable,
  monitoringAlertsTable,
  healthGoalTypes,
  healthGoalStatuses,
  vitalSignTypes,
  monitoringAlertSeverities,
  monitoringAlertStatuses,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, userId: string | null, resourceId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][Health-Tracking] ${timestamp} - ${action} - User:${userId ? hashIdentifier(userId) : "NONE"} - Resource:${resourceId} - ${details}`);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", null, req.path, "No authenticated session");
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  if (req.query.profileId && req.query.profileId !== sessionUserId) {
    logHipaaAudit("ACCESS_DENIED", sessionUserId, req.path, `Attempted access to profileId:${hashIdentifier(req.query.profileId as string)}`);
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  if (req.body?.profileId && req.body.profileId !== sessionUserId) {
    logHipaaAudit("ACCESS_DENIED", sessionUserId, req.path, `Attempted access to profileId:${hashIdentifier(req.body.profileId)}`);
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  (req.query as any).profileId = sessionUserId;
  if (req.body) {
    req.body.profileId = sessionUserId;
  }
  next();
}

const VITAL_THRESHOLDS: Record<string, { low?: number; high?: number; critical_low?: number; critical_high?: number; unit: string }> = {
  blood_pressure_systolic: { low: 90, high: 140, critical_low: 70, critical_high: 180, unit: "mmHg" },
  blood_pressure_diastolic: { low: 60, high: 90, critical_low: 40, critical_high: 120, unit: "mmHg" },
  heart_rate: { low: 60, high: 100, critical_low: 40, critical_high: 150, unit: "bpm" },
  blood_glucose: { low: 70, high: 140, critical_low: 54, critical_high: 250, unit: "mg/dL" },
  weight: { unit: "lbs" },
  temperature: { low: 97, high: 99.5, critical_low: 95, critical_high: 103, unit: "°F" },
  oxygen_saturation: { low: 95, critical_low: 90, unit: "%" },
  respiratory_rate: { low: 12, high: 20, critical_low: 8, critical_high: 30, unit: "breaths/min" },
};

async function checkVitalThresholds(profileId: string, vitalType: string, value: number, vitalSignId: string) {
  const thresholds = VITAL_THRESHOLDS[vitalType];
  if (!thresholds) return;

  let severity: "low" | "medium" | "high" | "critical" | null = null;
  let message = "";

  if (thresholds.critical_high && value >= thresholds.critical_high) {
    severity = "critical";
    message = `Critical high ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (threshold: ${thresholds.critical_high})`;
  } else if (thresholds.critical_low && value <= thresholds.critical_low) {
    severity = "critical";
    message = `Critical low ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (threshold: ${thresholds.critical_low})`;
  } else if (thresholds.high && value >= thresholds.high) {
    severity = "high";
    message = `High ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (normal: <${thresholds.high})`;
  } else if (thresholds.low && value <= thresholds.low) {
    severity = "medium";
    message = `Low ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (normal: >${thresholds.low})`;
  }

  if (severity) {
    await db.insert(monitoringAlertsTable).values({
      profileId,
      vitalSignId,
      alertType: "vital_threshold",
      severity,
      title: `Abnormal ${vitalType.replace(/_/g, " ")} reading`,
      message,
      threshold: thresholds.high?.toString() || thresholds.low?.toString() || "",
      actualValue: value.toString(),
      status: "pending",
    });

    logHipaaAudit("ALERT_CREATED", profileId, vitalSignId, `${severity} severity alert for ${vitalType}`);
  }
}

router.use(requireAuth);
router.use(enforceSessionUserId);

const createGoalSchema = z.object({
  profileId: z.string(),
  goalType: z.enum(healthGoalTypes),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  targetValue: z.string(),
  targetUnit: z.string(),
  baselineValue: z.string().optional(),
  startDate: z.string(),
  targetDate: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
  reminderFrequency: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/goals", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const status = req.query.status as string | undefined;

    let query = db.select().from(healthGoalsTable).where(eq(healthGoalsTable.profileId, profileId));

    if (status) {
      query = db.select().from(healthGoalsTable).where(
        and(eq(healthGoalsTable.profileId, profileId), eq(healthGoalsTable.status, status))
      );
    }

    const goals = await query.orderBy(desc(healthGoalsTable.priority), desc(healthGoalsTable.createdAt));

    logHipaaAudit("GOALS_READ", profileId, "health_goals", `Retrieved ${goals.length} goals`);

    res.json({
      success: true,
      goals,
      noCdsDisclaimer: "This information is for personal tracking only and does not constitute medical advice. Consult your healthcare provider for medical decisions.",
    });
  } catch (error) {
    console.error("[Health Tracking] Error fetching goals:", error);
    res.status(500).json({ success: false, error: "Failed to fetch health goals" });
  }
});

router.post("/goals", async (req: Request, res: Response) => {
  try {
    const data = createGoalSchema.parse(req.body);

    const [goal] = await db.insert(healthGoalsTable).values({
      ...data,
      currentValue: data.baselineValue,
      status: "active",
    }).returning();

    logHipaaAudit("GOAL_CREATED", data.profileId, goal.id, `Created goal: ${data.title}`);

    res.status(201).json({ success: true, goal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid goal data", details: error.errors });
    }
    console.error("[Health Tracking] Error creating goal:", error);
    res.status(500).json({ success: false, error: "Failed to create health goal" });
  }
});

router.patch("/goals/:goalId", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const profileId = (req as any).authenticatedUserId;
    const updates = req.body;

    const [existing] = await db.select().from(healthGoalsTable).where(eq(healthGoalsTable.id, goalId));
    if (!existing || existing.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Goal not found" });
    }

    const [updated] = await db.update(healthGoalsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(healthGoalsTable.id, goalId))
      .returning();

    logHipaaAudit("GOAL_UPDATED", profileId, goalId, `Updated goal: ${updated.title}`);

    res.json({ success: true, goal: updated });
  } catch (error) {
    console.error("[Health Tracking] Error updating goal:", error);
    res.status(500).json({ success: false, error: "Failed to update health goal" });
  }
});

router.delete("/goals/:goalId", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const profileId = (req as any).authenticatedUserId;

    const [existing] = await db.select().from(healthGoalsTable).where(eq(healthGoalsTable.id, goalId));
    if (!existing || existing.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Goal not found" });
    }

    await db.delete(healthGoalsTable).where(eq(healthGoalsTable.id, goalId));

    logHipaaAudit("GOAL_DELETED", profileId, goalId, `Deleted goal: ${existing.title}`);

    res.json({ success: true, message: "Goal deleted" });
  } catch (error) {
    console.error("[Health Tracking] Error deleting goal:", error);
    res.status(500).json({ success: false, error: "Failed to delete health goal" });
  }
});

const createProgressSchema = z.object({
  goalId: z.string().uuid(),
  recordedOn: z.string(),
  value: z.string(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

router.get("/goals/:goalId/progress", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const profileId = (req as any).authenticatedUserId;

    const [goal] = await db.select().from(healthGoalsTable).where(eq(healthGoalsTable.id, goalId));
    if (!goal || goal.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Goal not found" });
    }

    const progress = await db.select()
      .from(goalProgressTable)
      .where(eq(goalProgressTable.goalId, goalId))
      .orderBy(desc(goalProgressTable.recordedOn));

    logHipaaAudit("PROGRESS_READ", profileId, goalId, `Retrieved ${progress.length} progress entries`);

    res.json({ success: true, goal, progress });
  } catch (error) {
    console.error("[Health Tracking] Error fetching progress:", error);
    res.status(500).json({ success: false, error: "Failed to fetch goal progress" });
  }
});

router.post("/goals/:goalId/progress", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const profileId = (req as any).authenticatedUserId;

    const [goal] = await db.select().from(healthGoalsTable).where(eq(healthGoalsTable.id, goalId));
    if (!goal || goal.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Goal not found" });
    }

    const data = createProgressSchema.parse({ ...req.body, goalId });

    const [entry] = await db.insert(goalProgressTable).values({
      goalId: data.goalId,
      recordedOn: data.recordedOn,
      value: data.value,
      notes: data.notes,
      source: data.source || "manual",
    }).returning();

    await db.update(healthGoalsTable)
      .set({ currentValue: data.value, updatedAt: new Date() })
      .where(eq(healthGoalsTable.id, goalId));

    logHipaaAudit("PROGRESS_CREATED", profileId, goalId, `Added progress: ${data.value}`);

    res.status(201).json({ success: true, entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid progress data", details: error.errors });
    }
    console.error("[Health Tracking] Error creating progress:", error);
    res.status(500).json({ success: false, error: "Failed to add progress entry" });
  }
});

const createVitalSchema = z.object({
  profileId: z.string(),
  vitalType: z.enum(vitalSignTypes),
  value: z.string(),
  unit: z.string(),
  recordedAt: z.string().optional(),
  source: z.string().optional(),
  deviceId: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/vitals", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const vitalType = req.query.vitalType as string | undefined;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let vitals;
    if (vitalType) {
      vitals = await db.select()
        .from(vitalSignsTable)
        .where(and(
          eq(vitalSignsTable.profileId, profileId),
          eq(vitalSignsTable.vitalType, vitalType),
          gte(vitalSignsTable.recordedAt, startDate)
        ))
        .orderBy(desc(vitalSignsTable.recordedAt));
    } else {
      vitals = await db.select()
        .from(vitalSignsTable)
        .where(and(
          eq(vitalSignsTable.profileId, profileId),
          gte(vitalSignsTable.recordedAt, startDate)
        ))
        .orderBy(desc(vitalSignsTable.recordedAt));
    }

    logHipaaAudit("VITALS_READ", profileId, "vital_signs", `Retrieved ${vitals.length} readings`);

    res.json({
      success: true,
      vitals,
      thresholds: VITAL_THRESHOLDS,
      noCdsDisclaimer: "Vital sign readings are for informational purposes only. Abnormal readings require professional medical evaluation.",
    });
  } catch (error) {
    console.error("[Health Tracking] Error fetching vitals:", error);
    res.status(500).json({ success: false, error: "Failed to fetch vital signs" });
  }
});

router.post("/vitals", async (req: Request, res: Response) => {
  try {
    const data = createVitalSchema.parse(req.body);

    const [vital] = await db.insert(vitalSignsTable).values({
      profileId: data.profileId,
      vitalType: data.vitalType,
      value: data.value,
      unit: data.unit,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
      source: data.source || "manual",
      deviceId: data.deviceId,
      notes: data.notes,
    }).returning();

    await checkVitalThresholds(data.profileId, data.vitalType, parseFloat(data.value), vital.id);

    logHipaaAudit("VITAL_CREATED", data.profileId, vital.id, `Recorded ${data.vitalType}: ${data.value} ${data.unit}`);

    res.status(201).json({ success: true, vital });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid vital data", details: error.errors });
    }
    console.error("[Health Tracking] Error recording vital:", error);
    res.status(500).json({ success: false, error: "Failed to record vital sign" });
  }
});

router.post("/vitals/batch", async (req: Request, res: Response) => {
  try {
    const { readings } = req.body;
    const profileId = (req as any).authenticatedUserId;

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ success: false, error: "Readings array is required" });
    }

    const vitals = [];
    for (const reading of readings) {
      const data = createVitalSchema.parse({ ...reading, profileId });

      const [vital] = await db.insert(vitalSignsTable).values({
        profileId: data.profileId,
        vitalType: data.vitalType,
        value: data.value,
        unit: data.unit,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
        source: data.source || "manual",
        deviceId: data.deviceId,
        notes: data.notes,
      }).returning();

      await checkVitalThresholds(data.profileId, data.vitalType, parseFloat(data.value), vital.id);
      vitals.push(vital);
    }

    logHipaaAudit("VITALS_BATCH_CREATED", profileId, "vital_signs", `Recorded ${vitals.length} readings`);

    res.status(201).json({ success: true, vitals });
  } catch (error) {
    console.error("[Health Tracking] Error batch recording vitals:", error);
    res.status(500).json({ success: false, error: "Failed to record vital signs" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const status = req.query.status as string | undefined;

    let alerts;
    if (status) {
      alerts = await db.select()
        .from(monitoringAlertsTable)
        .where(and(
          eq(monitoringAlertsTable.profileId, profileId),
          eq(monitoringAlertsTable.status, status)
        ))
        .orderBy(desc(monitoringAlertsTable.createdAt));
    } else {
      alerts = await db.select()
        .from(monitoringAlertsTable)
        .where(eq(monitoringAlertsTable.profileId, profileId))
        .orderBy(desc(monitoringAlertsTable.createdAt));
    }

    logHipaaAudit("ALERTS_READ", profileId, "monitoring_alerts", `Retrieved ${alerts.length} alerts`);

    res.json({ success: true, alerts });
  } catch (error) {
    console.error("[Health Tracking] Error fetching alerts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch alerts" });
  }
});

router.patch("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const profileId = (req as any).authenticatedUserId;

    const [existing] = await db.select().from(monitoringAlertsTable).where(eq(monitoringAlertsTable.id, alertId));
    if (!existing || existing.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    const [updated] = await db.update(monitoringAlertsTable)
      .set({ status: "acknowledged", acknowledgedAt: new Date(), acknowledgedBy: profileId })
      .where(eq(monitoringAlertsTable.id, alertId))
      .returning();

    logHipaaAudit("ALERT_ACKNOWLEDGED", profileId, alertId, `Acknowledged alert: ${existing.title}`);

    res.json({ success: true, alert: updated });
  } catch (error) {
    console.error("[Health Tracking] Error acknowledging alert:", error);
    res.status(500).json({ success: false, error: "Failed to acknowledge alert" });
  }
});

router.get("/insights", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;

    const activeGoals = await db.select()
      .from(healthGoalsTable)
      .where(and(eq(healthGoalsTable.profileId, profileId), eq(healthGoalsTable.status, "active")))
      .orderBy(desc(healthGoalsTable.priority));

    const recentVitals = await db.select()
      .from(vitalSignsTable)
      .where(eq(vitalSignsTable.profileId, profileId))
      .orderBy(desc(vitalSignsTable.recordedAt))
      .limit(50);

    const pendingAlerts = await db.select()
      .from(monitoringAlertsTable)
      .where(and(eq(monitoringAlertsTable.profileId, profileId), eq(monitoringAlertsTable.status, "pending")));

    const goalProgress: Array<{
      goal: typeof activeGoals[0];
      progressPercentage: number;
      trend: "improving" | "declining" | "stable";
      recommendation: string;
    }> = [];

    for (const goal of activeGoals) {
      const progress = await db.select()
        .from(goalProgressTable)
        .where(eq(goalProgressTable.goalId, goal.id))
        .orderBy(desc(goalProgressTable.recordedOn))
        .limit(10);

      let progressPercentage = 0;
      let trend: "improving" | "declining" | "stable" = "stable";
      let recommendation = "";

      if (goal.baselineValue && goal.targetValue && goal.currentValue) {
        const baseline = parseFloat(goal.baselineValue);
        const target = parseFloat(goal.targetValue);
        const current = parseFloat(goal.currentValue);

        if (target !== baseline) {
          progressPercentage = Math.min(100, Math.max(0, ((current - baseline) / (target - baseline)) * 100));
        }

        if (progress.length >= 2) {
          const recent = parseFloat(progress[0].value);
          const previous = parseFloat(progress[1].value);
          const isIncreaseGood = target > baseline;

          if (recent > previous) {
            trend = isIncreaseGood ? "improving" : "declining";
          } else if (recent < previous) {
            trend = isIncreaseGood ? "declining" : "improving";
          }
        }

        if (progressPercentage < 25) {
          recommendation = `Consider breaking this goal into smaller milestones. Focus on consistent daily habits.`;
        } else if (progressPercentage < 50) {
          recommendation = `Good progress! Maintain your current routine and track regularly.`;
        } else if (progressPercentage < 75) {
          recommendation = `Excellent work! You're more than halfway to your goal.`;
        } else {
          recommendation = `Almost there! Keep up the great work to reach your target.`;
        }
      }

      goalProgress.push({ goal, progressPercentage, trend, recommendation });
    }

    const vitalTrends: Record<string, { latest: number; average: number; trend: string; status: string }> = {};
    const vitalsByType = recentVitals.reduce((acc, v) => {
      if (!acc[v.vitalType]) acc[v.vitalType] = [];
      acc[v.vitalType].push(parseFloat(v.value));
      return acc;
    }, {} as Record<string, number[]>);

    for (const [type, values] of Object.entries(vitalsByType)) {
      const latest = values[0];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const threshold = VITAL_THRESHOLDS[type];
      let status = "normal";
      let trend = "stable";

      if (threshold) {
        if (threshold.critical_high && latest >= threshold.critical_high) status = "critical";
        else if (threshold.critical_low && latest <= threshold.critical_low) status = "critical";
        else if (threshold.high && latest >= threshold.high) status = "elevated";
        else if (threshold.low && latest <= threshold.low) status = "low";
      }

      if (values.length >= 3) {
        const recentAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const olderAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
        if (recentAvg > olderAvg * 1.05) trend = "increasing";
        else if (recentAvg < olderAvg * 0.95) trend = "decreasing";
      }

      vitalTrends[type] = { latest, average, trend, status };
    }

    const wellnessTips = [
      activeGoals.some(g => g.goalType === "exercise_frequency")
        ? "Remember: Even 10 minutes of walking can boost your mood and energy."
        : null,
      activeGoals.some(g => g.goalType === "weight_loss")
        ? "Tip: Focus on whole foods and stay hydrated - small changes add up over time."
        : null,
      vitalTrends.blood_pressure_systolic?.status === "elevated"
        ? "Consider reducing sodium intake and practicing stress-relief techniques."
        : null,
      vitalTrends.blood_glucose?.status === "elevated"
        ? "Monitor carbohydrate intake and maintain regular meal times."
        : null,
      "Stay consistent with your health tracking - regular monitoring helps identify patterns.",
    ].filter(Boolean);

    const riskAssessments: Array<{ condition: string; riskLevel: string; factors: string[]; recommendations: string[] }> = [];

    if (vitalTrends.blood_pressure_systolic?.status === "elevated" || vitalTrends.blood_pressure_diastolic?.status === "elevated") {
      riskAssessments.push({
        condition: "Hypertension",
        riskLevel: vitalTrends.blood_pressure_systolic?.status === "critical" ? "High" : "Moderate",
        factors: ["Elevated blood pressure readings"],
        recommendations: ["Continue monitoring", "Consult your healthcare provider", "Consider lifestyle modifications"],
      });
    }

    const glucoseStatus = vitalTrends.blood_glucose?.status;
    if (glucoseStatus === "elevated" || glucoseStatus === "critical") {
      riskAssessments.push({
        condition: "Glucose Management",
        riskLevel: glucoseStatus === "critical" ? "High" : "Moderate",
        factors: ["Elevated blood glucose readings"],
        recommendations: ["Monitor carbohydrate intake", "Maintain regular meal schedule", "Discuss with your doctor"],
      });
    }

    logHipaaAudit("INSIGHTS_READ", profileId, "health_insights", "Generated personalized insights");

    res.json({
      success: true,
      insights: {
        goalProgress,
        vitalTrends,
        pendingAlerts: pendingAlerts.length,
        wellnessTips,
        riskAssessments,
        lastUpdated: new Date().toISOString(),
      },
      noCdsDisclaimer: "These insights are for informational purposes only and do not constitute medical advice. Always consult your healthcare provider for medical decisions.",
    });
  } catch (error) {
    console.error("[Health Tracking] Error generating insights:", error);
    res.status(500).json({ success: false, error: "Failed to generate health insights" });
  }
});

router.get("/ai-context", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;

    const goals = await db.select()
      .from(healthGoalsTable)
      .where(eq(healthGoalsTable.profileId, profileId))
      .orderBy(desc(healthGoalsTable.priority));

    const recentVitals = await db.select()
      .from(vitalSignsTable)
      .where(eq(vitalSignsTable.profileId, profileId))
      .orderBy(desc(vitalSignsTable.recordedAt))
      .limit(20);

    const alerts = await db.select()
      .from(monitoringAlertsTable)
      .where(and(eq(monitoringAlertsTable.profileId, profileId), eq(monitoringAlertsTable.status, "pending")));

    const context = {
      activeGoals: goals.filter(g => g.status === "active").map(g => ({
        type: g.goalType,
        title: g.title,
        target: `${g.targetValue} ${g.targetUnit}`,
        current: g.currentValue ? `${g.currentValue} ${g.targetUnit}` : "Not recorded",
        startDate: g.startDate,
        targetDate: g.targetDate,
      })),
      recentVitals: recentVitals.map(v => ({
        type: v.vitalType,
        value: `${v.value} ${v.unit}`,
        recordedAt: v.recordedAt,
      })),
      pendingAlerts: alerts.map(a => ({
        type: a.alertType,
        severity: a.severity,
        message: a.message,
        createdAt: a.createdAt,
      })),
    };

    logHipaaAudit("AI_CONTEXT_READ", profileId, "health_ai_context", "Provided AI context data");

    res.json({
      success: true,
      context,
      noCdsDisclaimer: "AI responses based on this context are for educational purposes only.",
    });
  } catch (error) {
    console.error("[Health Tracking] Error fetching AI context:", error);
    res.status(500).json({ success: false, error: "Failed to fetch AI context" });
  }
});

export default router;
