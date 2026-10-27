// @ts-nocheck
import type { Express, Request, Response } from "express";
import { checkDrugInteractions } from "./care-access-service";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { requireFeature } from "./subscription-service";

const USPSTF_RULES = [
  {
    id: "colorectal",
    name: "Colorectal cancer screening",
    description: "A test to check for colorectal (colon) cancer",
    whyItMatters: "Colorectal cancer is the second leading cause of cancer death. Screening catches it early when it is most treatable, or prevents it entirely by removing pre-cancerous polyps.",
    minAge: 45, maxAge: 75,
    sexes: ["male", "female", "other"],
    intervalYears: 10,
    intervalDescription: "Every 10 years (colonoscopy) or every 1-3 years (stool tests)",
    gradeLabel: "USPSTF Grade A",
    coveredByInsurance: true,
    estimatedTimeMinutes: 30,
    conditionExclusions: [] as string[],
    loinc: "34898-8",
    cptCode: "45378",
    specialty: "gastroenterology",
  },
  {
    id: "breast_cancer",
    name: "Breast cancer screening (mammogram)",
    description: "An X-ray of the breast to check for cancer",
    whyItMatters: "Mammograms find breast cancer early, often before a lump can be felt. Early detection significantly improves survival rates.",
    minAge: 40, maxAge: 74,
    sexes: ["female"],
    intervalYears: 2,
    intervalDescription: "Every 1-2 years starting at age 40",
    gradeLabel: "USPSTF Grade B",
    coveredByInsurance: true,
    estimatedTimeMinutes: 20,
    conditionExclusions: [] as string[],
    loinc: "24606-6",
    cptCode: "77067",
    specialty: "radiology",
  },
  {
    id: "cervical_cancer",
    name: "Cervical cancer screening (Pap smear)",
    description: "A swab test to check cells in the cervix for cancer or pre-cancer",
    whyItMatters: "Cervical cancer is highly preventable. Regular screening finds abnormal cells before they become cancer.",
    minAge: 21, maxAge: 65,
    sexes: ["female"],
    intervalYears: 3,
    intervalDescription: "Every 3 years (Pap alone) or every 5 years (Pap + HPV test)",
    gradeLabel: "USPSTF Grade A",
    coveredByInsurance: true,
    estimatedTimeMinutes: 15,
    conditionExclusions: [] as string[],
    loinc: "10524-7",
    cptCode: "88175",
    specialty: "obstetrics-gynecology",
  },
  {
    id: "lung_cancer",
    name: "Lung cancer screening (low-dose CT)",
    description: "A low-radiation CT scan of the chest",
    whyItMatters: "Lung cancer causes more deaths than any other cancer. Low-dose CT screening reduces lung cancer mortality by 20% in high-risk adults.",
    minAge: 50, maxAge: 80,
    sexes: ["male", "female", "other"],
    intervalYears: 1,
    intervalDescription: "Every year for current or former heavy smokers (20+ pack-years)",
    gradeLabel: "USPSTF Grade B",
    coveredByInsurance: true,
    estimatedTimeMinutes: 15,
    conditionExclusions: [] as string[],
    requiresCondition: "smoker",
    loinc: "24627-2",
    cptCode: "71271",
    specialty: "pulmonology",
  },
  {
    id: "diabetes",
    name: "Prediabetes and type 2 diabetes screening",
    description: "A blood sugar test (A1C or fasting glucose)",
    whyItMatters: "Over 88 million Americans have prediabetes and most don't know it. Catching it early allows lifestyle changes that can prevent or delay type 2 diabetes.",
    minAge: 35, maxAge: 70,
    sexes: ["male", "female", "other"],
    intervalYears: 3,
    intervalDescription: "Every 3 years for overweight or obese adults ages 35-70",
    gradeLabel: "USPSTF Grade B",
    coveredByInsurance: true,
    estimatedTimeMinutes: 10,
    conditionExclusions: ["diabetes"],
    loinc: "4548-4",
    cptCode: "83036",
    specialty: "laboratory",
  },
  {
    id: "hypertension",
    name: "High blood pressure screening",
    description: "A blood pressure measurement",
    whyItMatters: "High blood pressure has no symptoms but doubles heart attack and stroke risk. It is easily treated when caught early.",
    minAge: 18, maxAge: 999,
    sexes: ["male", "female", "other"],
    intervalYears: 1,
    intervalDescription: "Every year for adults 40+, every 3-5 years for adults 18-39 with normal BP",
    gradeLabel: "USPSTF Grade A",
    coveredByInsurance: true,
    estimatedTimeMinutes: 5,
    conditionExclusions: ["hypertension", "high blood pressure"],
    loinc: "55284-4",
    cptCode: "99213",
    specialty: "primary-care",
  },
  {
    id: "depression",
    name: "Depression screening",
    description: "A short questionnaire about mood and mental health",
    whyItMatters: "Depression affects 1 in 10 adults and is highly treatable. Most people with depression are not diagnosed.",
    minAge: 18, maxAge: 999,
    sexes: ["male", "female", "other"],
    intervalYears: 1,
    intervalDescription: "Every year at routine checkups",
    gradeLabel: "USPSTF Grade B",
    coveredByInsurance: true,
    estimatedTimeMinutes: 5,
    conditionExclusions: ["depression", "major depressive disorder"],
    loinc: "44249-1",
    cptCode: "96127",
    specialty: "behavioral-health",
  },
  {
    id: "statin",
    name: "Cardiovascular risk / statin use assessment",
    description: "A cholesterol blood panel and cardiovascular risk calculation",
    whyItMatters: "Statins reduce heart attack and stroke risk by 25-35% in eligible adults. The USPSTF recommends assessing all adults 40-75 with cardiovascular risk factors.",
    minAge: 40, maxAge: 75,
    sexes: ["male", "female", "other"],
    intervalYears: 5,
    intervalDescription: "Every 5 years unless already on a statin",
    gradeLabel: "USPSTF Grade B",
    coveredByInsurance: true,
    estimatedTimeMinutes: 10,
    conditionExclusions: ["hyperlipidemia", "statin therapy"],
    loinc: "2093-3",
    cptCode: "80061",
    specialty: "laboratory",
  },
];

export function registerNewFeatureRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
): void {

  app.post("/api/users/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;
      const { token, platform, deviceModel } = req.body as {
        token: string; platform: string; deviceModel?: string;
      };
      if (!token || !platform) return res.status(400).json({ error: "token and platform required" });
      const validPlatforms = ["ios", "android", "web"];
      if (!validPlatforms.includes(platform)) return res.status(400).json({ error: "invalid platform" });
      try {
        await db.execute(sql`
          INSERT INTO user_push_tokens (user_id, token, platform, device_model, updated_at)
          VALUES (${userId}, ${token}, ${platform}, ${deviceModel ?? null}, NOW())
          ON CONFLICT (user_id, platform) DO UPDATE
            SET token = EXCLUDED.token, device_model = EXCLUDED.device_model, updated_at = NOW()
        `);
      } catch {
        console.warn("[PushToken] Table may not exist yet — token registration skipped");
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[PushToken] Error:", err);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  app.get("/api/prior-auth/items", requireAuth, requireFeature("prior_auth"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;

      const { storage } = await import("./storage");
      const records = await (storage as any).getHealthRecordsByType?.(userId, "medication") ?? [];

      const PA_REQUIRED_PATTERNS = [
        /humira|adalimumab/i, /enbrel|etanercept/i, /keytruda|pembrolizumab/i,
        /ozempic|semaglutide/i, /wegovy/i, /mounjaro|tirzepatide/i,
        /skyrizi|risankizumab/i, /dupixent|dupilumab/i, /xolair|omalizumab/i,
        /jardiance|empagliflozin/i, /farxiga|dapagliflozin/i,
        /entresto|sacubitril/i, /eliquis|apixaban/i, /xarelto|rivaroxaban/i,
      ];

      const items = records
        .filter((r: any) => PA_REQUIRED_PATTERNS.some(p => p.test(r.title ?? "")))
        .map((r: any, i: number) => ({
          id: r.id ?? `pa_${i}`,
          type: "medication" as const,
          name: r.title ?? "Medication",
          reason: "This medication commonly requires insurance pre-approval due to its cost.",
          status: "action_needed" as const,
          insurancePlan: "Your insurance plan",
          urgency: "routine" as const,
          estimatedCostWithout: 800,
          letterGenerated: false,
        }));

      res.json({ items });
    } catch (err) {
      console.error("[PriorAuth] Error:", err);
      res.json({ items: [] });
    }
  });

  app.post("/api/prior-auth/generate-letter", requireAuth, requireFeature("prior_auth"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;
      const { itemId } = req.body as { itemId: string };

      let letter: string;
      try {
        const { generatePriorAuthJustification } = await import("./ai-clinical-documentation");
        const { storage } = await import("./storage");

        const user = await storage.getUser(userId);
        const records = await (storage as any).getHealthRecords?.(userId) ?? [];
        const conditions = records.filter((r: any) => r.type === "condition").map((r: any) => r.title);
        const medications = records.filter((r: any) => r.type === "medication").map((r: any) => r.title);

        letter = await generatePriorAuthJustification({
          medicationOrProcedure: itemId,
          patientAge: user?.dateOfBirth
            ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / 31536000000)
            : undefined,
          diagnoses: conditions,
          currentMedications: medications,
          clinicalJustification: `Patient has been diagnosed with relevant conditions requiring this treatment.`,
        });
      } catch {
        letter = `To Whom It May Concern,\n\nI am writing to request prior authorization for the above-referenced medication/procedure for my patient.\n\nClinical Justification: This treatment is medically necessary based on the patient's documented diagnosis and clinical history. Alternative treatments have been considered and/or tried.\n\nPlease contact my office if you require additional clinical information.\n\nSincerely,\n[Your Provider's Name]\n[Signature]`;
      }

      res.json({
        content: letter,
        generatedAt: new Date().toISOString(),
        itemName: itemId,
      });
    } catch (err) {
      console.error("[PriorAuth] Letter generation error:", err);
      res.status(500).json({ error: "Failed to generate letter" });
    }
  });

  app.get("/api/care-gaps", requireAuth, requireFeature("care_gaps"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;
      const { storage } = await import("./storage");

      const user = await storage.getUser(userId);
      const records = await (storage as any).getHealthRecords?.(userId) ?? [];

      const age = user?.dateOfBirth
        ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / 31536000000)
        : 45;
      const sex = (user as any)?.biologicalSex ?? (user as any)?.gender ?? "other";

      const conditions = records
        .filter((r: any) => r.type === "condition")
        .map((r: any) => (r.title ?? "").toLowerCase());

      const screeningHistory = records.filter((r: any) =>
        ["screening", "procedure", "imaging", "lab"].includes(r.type ?? "")
      );

      const gaps = USPSTF_RULES
        .filter(rule => {
          if (age < rule.minAge || age > rule.maxAge) return false;
          if (!rule.sexes.includes("other") && !rule.sexes.includes(sex)) return false;
          if (rule.conditionExclusions?.some((exc: string) =>
            conditions.some((c: string) => c.includes(exc))
          )) return false;
          if ((rule as any).requiresCondition) {
            const req = (rule as any).requiresCondition;
            if (!conditions.some((c: string) => c.includes(req))) return false;
          }
          return true;
        })
        .map(rule => {
          const lastScreening = screeningHistory
            .filter((r: any) => (r.title ?? "").toLowerCase().includes(
              rule.name.split(" ")[0].toLowerCase()
            ))
            .sort((a: any, b: any) =>
              new Date(b.recordedDate ?? 0).getTime() -
              new Date(a.recordedDate ?? 0).getTime()
            )[0];

          const lastDate = lastScreening?.recordedDate
            ? new Date(lastScreening.recordedDate)
            : null;

          const intervalMs = rule.intervalYears * 365.25 * 24 * 60 * 60 * 1000;
          const nextDue = lastDate ? new Date(lastDate.getTime() + intervalMs) : new Date(0);
          const now = new Date();
          const monthsUntilDue = (nextDue.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000);

          let status: "overdue" | "due_soon" | "up_to_date";
          if (!lastDate || now > nextDue) status = "overdue";
          else if (monthsUntilDue <= 3) status = "due_soon";
          else status = "up_to_date";

          return {
            id: rule.id,
            screeningName: rule.name,
            description: rule.description,
            whyItMatters: rule.whyItMatters,
            status,
            lastDoneDate: lastDate?.toISOString() ?? null,
            nextDueDate: status !== "up_to_date" ? null : nextDue.toISOString(),
            intervalDescription: rule.intervalDescription,
            ageRange: `Ages ${rule.minAge}${rule.maxAge < 900 ? `-${rule.maxAge}` : "+"}`,
            gradeLabel: rule.gradeLabel,
            coveredByInsurance: rule.coveredByInsurance,
            estimatedTimeMinutes: rule.estimatedTimeMinutes,
            cptCode: (rule as any).cptCode ?? null,
            specialty: (rule as any).specialty ?? null,
          };
        });

      const upToDate = gaps.filter(g => g.status === "up_to_date").length;
      const completionPct = gaps.length > 0
        ? Math.round((upToDate / gaps.length) * 100)
        : 100;

      res.json({ gaps, patientAge: age, completionPct });
    } catch (err) {
      console.error("[CareGaps] Error:", err);
      res.json({ gaps: [], patientAge: 0, completionPct: 0 });
    }
  });

  app.get("/api/medications/interactions", requireAuth, requireFeature("drug_interactions"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any)._authenticatedUserId as string;
      const { storage } = await import("./storage");

      const records = await (storage as any).getHealthRecords?.(userId) ?? [];
      const medications = records
        .filter((r: any) => r.type === "medication")
        .map((r: any) => r.title ?? "")
        .filter(Boolean)
        .slice(0, 10);

      if (medications.length < 2) {
        return res.json({
          interactions: [],
          majorCount: 0,
          moderateCount: 0,
          checkedAt: new Date().toISOString(),
          medicationsChecked: medications,
        });
      }

      const result = await checkDrugInteractions(medications);
      res.json(result);
    } catch (err) {
      console.error("[DrugInteractions] Error:", err);
      res.json({ interactions: [], majorCount: 0, moderateCount: 0, checkedAt: new Date().toISOString(), medicationsChecked: [] });
    }
  });
}
