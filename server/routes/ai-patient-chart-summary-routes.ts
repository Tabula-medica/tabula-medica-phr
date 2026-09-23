import { Router, type Request, type Response } from "express";
import { generatePhiSafeText } from "../services/ai-gateway";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  profiles,
  medicationsTable,
  medicalHistoryTable,
  allergiesTable,
} from "@shared/schema";
import { aiPatientSummariesTable } from "@shared/schema";
import { requireFeature, type AuthRequest } from "../middleware/require-feature";

const router = Router();

const MODEL_VERSION = "gpt-5/2025-08-07";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGENERATE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const DISCLAIMER =
  "AI-generated overview for orientation only — not medical advice. Always confirm details with your clinician.";

interface SummarySection {
  title: string;
  items: Array<{ label: string; detail?: string; priority?: "low" | "medium" | "high" }>;
  emptyMessage: string;
}

interface PatientChartSummary {
  generatedAt: string;
  modelVersion: string;
  modelGenerated: boolean;
  disclaimer: string;
  headline: string;
  sections: {
    activeConditions: SummarySection;
    activeMedications: SummarySection;
    recentLabsOrAllergies: SummarySection;
    next90Days: SummarySection;
  };
}

const aiEnabled = true;

async function resolveAccountIdFromSession(req: AuthRequest): Promise<string | null> {
  const sub = req.user?.claims?.sub;
  const email = req.user?.claims?.email;
  if (!sub && !email) return null;
  try {
    if (email) {
      const [acct] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (acct?.id) return acct.id;
    }
  } catch {
    // fall through
  }
  return null;
}

async function fetchPrimaryProfile(accountId: string) {
  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .orderBy(desc(profiles.createdAt))
    .limit(1);
  return p ?? null;
}

interface ChartContext {
  conditions: Array<{ condition: string; status: string; diagnosedDate: string | null }>;
  medications: Array<{ name: string; dose: string | null; frequency: string | null; status: string }>;
  allergies: Array<{ allergen: string; reaction: string | null; severity: string | null }>;
  hasAnyData: boolean;
}

async function fetchChartContext(profileId: string): Promise<ChartContext> {
  const [conditions, medications, allergies] = await Promise.all([
    db
      .select({
        condition: medicalHistoryTable.condition,
        status: medicalHistoryTable.status,
        diagnosedDate: medicalHistoryTable.diagnosedDate,
      })
      .from(medicalHistoryTable)
      .where(eq(medicalHistoryTable.profileId, profileId))
      .limit(20),
    db
      .select({
        name: medicationsTable.name,
        dose: medicationsTable.dose,
        frequency: medicationsTable.frequency,
        status: medicationsTable.status,
      })
      .from(medicationsTable)
      .where(eq(medicationsTable.profileId, profileId))
      .limit(20),
    db
      .select({
        allergen: allergiesTable.allergen,
        reaction: allergiesTable.reaction,
        severity: allergiesTable.severity,
      })
      .from(allergiesTable)
      .where(eq(allergiesTable.profileId, profileId))
      .limit(20),
  ]);

  return {
    conditions: conditions.map((c) => ({
      condition: c.condition,
      status: c.status,
      diagnosedDate: c.diagnosedDate ? String(c.diagnosedDate) : null,
    })),
    medications: medications.map((m) => ({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      status: m.status,
    })),
    allergies: allergies.map((a) => ({
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity,
    })),
    hasAnyData:
      conditions.length > 0 || medications.length > 0 || allergies.length > 0,
  };
}

function fallbackSummary(ctx: ChartContext): PatientChartSummary {
  const activeConds = ctx.conditions
    .filter((c) => c.status === "active")
    .slice(0, 6)
    .map((c) => ({
      label: c.condition,
      detail: c.diagnosedDate ? `Since ${c.diagnosedDate}` : undefined,
    }));
  const activeMeds = ctx.medications
    .filter((m) => m.status === "active")
    .slice(0, 6)
    .map((m) => ({
      label: m.name,
      detail: [m.dose, m.frequency].filter(Boolean).join(" · ") || undefined,
    }));
  const allergyItems = ctx.allergies.slice(0, 6).map((a) => ({
    label: a.allergen,
    detail: a.reaction
      ? `Reaction: ${a.reaction}${a.severity ? ` (${a.severity})` : ""}`
      : a.severity ?? undefined,
    priority:
      a.severity?.toLowerCase() === "severe" ? ("high" as const) : undefined,
  }));

  const headline = ctx.hasAnyData
    ? `You have ${activeConds.length} active condition${activeConds.length === 1 ? "" : "s"}, ${activeMeds.length} active medication${activeMeds.length === 1 ? "" : "s"}, and ${ctx.allergies.length} allergy record${ctx.allergies.length === 1 ? "" : "s"} on file.`
    : "Your chart is empty so far. Connect a provider or add a record to start your AI summary.";

  return {
    generatedAt: new Date().toISOString(),
    modelVersion: "fallback/heuristic",
    modelGenerated: false,
    disclaimer: DISCLAIMER,
    headline,
    sections: {
      activeConditions: {
        title: "Active Conditions",
        items: activeConds,
        emptyMessage: "No active conditions on file.",
      },
      activeMedications: {
        title: "Active Medications",
        items: activeMeds,
        emptyMessage: "No active medications on file.",
      },
      recentLabsOrAllergies: {
        title: "Allergies & Alerts",
        items: allergyItems,
        emptyMessage: "No allergies or recent alerts on file.",
      },
      next90Days: {
        title: "Suggested for the Next 90 Days",
        items: ctx.hasAnyData
          ? [
              {
                label: "Confirm your active medication list with your primary clinician.",
              },
              {
                label: "Check whether any condition is due for follow-up labs or imaging.",
              },
            ]
          : [
              {
                label: "Connect a hospital, clinic, or pharmacy to import your records automatically.",
              },
            ],
        emptyMessage: "No suggestions yet — add some records first.",
      },
    },
  };
}

async function llmSummary(ctx: ChartContext): Promise<PatientChartSummary> {
  if (!aiEnabled || !ctx.hasAnyData) return fallbackSummary(ctx);

  const userContext = JSON.stringify(
    {
      activeConditions: ctx.conditions.filter((c) => c.status === "active"),
      activeMedications: ctx.medications.filter((m) => m.status === "active"),
      allergies: ctx.allergies,
    },
    null,
    2,
  );

  const systemPrompt = `You are a careful, plain-language patient health summarizer. You speak directly to the patient (use "you", not "the patient"). You do NOT diagnose, NOT prescribe, NOT provide medical advice. You produce a short structured overview the patient can review at a glance on their dashboard.

Respond ONLY in this JSON shape (all fields required):
{
  "headline": string (1 sentence, plain language, friendly, NOT alarming),
  "activeConditions":  { "items": [{ "label": string, "detail": string?, "priority": "low"|"medium"|"high"? }] },
  "activeMedications": { "items": [{ "label": string, "detail": string?, "priority": "low"|"medium"|"high"? }] },
  "recentLabsOrAllergies": { "items": [{ "label": string, "detail": string?, "priority": "low"|"medium"|"high"? }] },
  "next90Days": { "items": [{ "label": string, "detail": string?, "priority": "low"|"medium"|"high"? }] }
}
Each section maximum 6 items. Each label maximum 60 characters. Keep tone warm and concise. Severe allergies should be marked priority "high".`;

  try {
    const raw = await generatePhiSafeText({
      system: systemPrompt,
      user: userContext,
      responseMimeType: "application/json",
    });
    const parsed = JSON.parse(raw || "{}");

    const buildSection = (
      title: string,
      data: unknown,
      emptyMessage: string,
    ): SummarySection => {
      const items = Array.isArray((data as { items?: unknown[] })?.items)
        ? ((data as { items: unknown[] }).items as Array<Record<string, unknown>>)
            .slice(0, 6)
            .map((it) => ({
              label: typeof it.label === "string" ? it.label.slice(0, 80) : "",
              detail:
                typeof it.detail === "string" ? it.detail.slice(0, 160) : undefined,
              priority:
                it.priority === "high" || it.priority === "medium" || it.priority === "low"
                  ? (it.priority as "low" | "medium" | "high")
                  : undefined,
            }))
            .filter((it) => it.label.length > 0)
        : [];
      return { title, items, emptyMessage };
    };

    return {
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      modelGenerated: true,
      disclaimer: DISCLAIMER,
      headline:
        typeof parsed.headline === "string"
          ? parsed.headline.slice(0, 240)
          : fallbackSummary(ctx).headline,
      sections: {
        activeConditions: buildSection(
          "Active Conditions",
          parsed.activeConditions,
          "No active conditions on file.",
        ),
        activeMedications: buildSection(
          "Active Medications",
          parsed.activeMedications,
          "No active medications on file.",
        ),
        recentLabsOrAllergies: buildSection(
          "Recent Labs & Allergies",
          parsed.recentLabsOrAllergies,
          "Nothing flagged in the last 30 days.",
        ),
        next90Days: buildSection(
          "Suggested for the Next 90 Days",
          parsed.next90Days,
          "No suggestions yet.",
        ),
      },
    };
  } catch (err) {
    console.error("[ai-patient-chart-summary] LLM failed, using fallback:", err);
    return fallbackSummary(ctx);
  }
}

async function loadCached(accountId: string) {
  const [row] = await db
    .select()
    .from(aiPatientSummariesTable)
    .where(eq(aiPatientSummariesTable.accountId, accountId))
    .limit(1);
  return row ?? null;
}

async function saveCached(
  accountId: string,
  summary: PatientChartSummary,
  forceRegenerate: boolean,
) {
  const existing = await loadCached(accountId);
  const now = new Date();
  if (existing) {
    await db
      .update(aiPatientSummariesTable)
      .set({
        summary: summary as unknown as Record<string, unknown>,
        generatedAt: now,
        modelVersion: summary.modelVersion,
        ...(forceRegenerate ? { lastRegenerateAt: now } : {}),
      })
      .where(eq(aiPatientSummariesTable.accountId, accountId));
  } else {
    await db.insert(aiPatientSummariesTable).values({
      accountId,
      summary: summary as unknown as Record<string, unknown>,
      modelVersion: summary.modelVersion,
      tokenCost: 0,
      lastRegenerateAt: forceRegenerate ? now : null,
    });
  }
}

// GET /api/ai-patient-chart-summary/me
router.get("/me", requireFeature("ai_summaries"), async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  const cached = await loadCached(accountId);
  if (cached) {
    const age = Date.now() - new Date(cached.generatedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return res.json({
        success: true,
        cached: true,
        ageMs: age,
        summary: cached.summary as unknown as PatientChartSummary,
      });
    }
  }

  const profile = await fetchPrimaryProfile(accountId);
  if (!profile) {
    const empty = fallbackSummary({
      conditions: [],
      medications: [],
      allergies: [],
      hasAnyData: false,
    });
    await saveCached(accountId, empty, false);
    return res.json({ success: true, cached: false, ageMs: 0, summary: empty });
  }

  const ctx = await fetchChartContext(profile.id);
  const fresh = await llmSummary(ctx);
  await saveCached(accountId, fresh, false);
  return res.json({ success: true, cached: false, ageMs: 0, summary: fresh });
});

// POST /api/ai-patient-chart-summary/regenerate
router.post(
  "/regenerate",
  requireFeature("ai_summaries"),
  async (req: AuthRequest, res: Response) => {
    const accountId = await resolveAccountIdFromSession(req);
    if (!accountId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const cached = await loadCached(accountId);
    if (cached?.lastRegenerateAt) {
      const since = Date.now() - new Date(cached.lastRegenerateAt).getTime();
      if (since < REGENERATE_COOLDOWN_MS) {
        const waitMs = REGENERATE_COOLDOWN_MS - since;
        return res.status(429).json({
          success: false,
          error: "Please wait before regenerating again.",
          retryAfterMs: waitMs,
        });
      }
    }

    const profile = await fetchPrimaryProfile(accountId);
    const ctx = profile
      ? await fetchChartContext(profile.id)
      : { conditions: [], medications: [], allergies: [], hasAnyData: false };
    const fresh = await llmSummary(ctx);
    await saveCached(accountId, fresh, true);
    return res.json({ success: true, cached: false, ageMs: 0, summary: fresh });
  },
);

export default router;
