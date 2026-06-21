import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";

const REVENUECAT_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || "";
const PRO_ENTITLEMENT_ID = "pro";

export interface EntitlementResult {
  entitled: boolean;
  tier: "free" | "pro" | "family";
  customerId: string;
  activeEntitlements: string[];
}

export interface GatedRequest extends Request {
  entitlement?: EntitlementResult;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitized = { ...details };
  if (sanitized.customerId && typeof sanitized.customerId === "string") {
    sanitized.customerId = hashIdentifier(sanitized.customerId);
  }
  console.log(
    `[HIPAA-AUDIT][Gatekeeper] ${timestamp} - ${action}`,
    JSON.stringify(sanitized)
  );
}

async function getRevenueCatClient(): Promise<any> {
  try {
    const rcModule = await import("../replit_integrations/revenuecat");
    return await rcModule.getUncachableRevenueCatClient();
  } catch {
    const { createClient } = await import("@replit/revenuecat-sdk/client");
    const apiKey = process.env.REVENUECAT_API_KEY;
    if (!apiKey) return null;
    return createClient({
      baseUrl: "https://api.revenuecat.com/v2",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }
}

async function resolveEntitlements(customerId: string): Promise<EntitlementResult> {
  const result: EntitlementResult = {
    entitled: false,
    tier: "free",
    customerId,
    activeEntitlements: [],
  };

  if (!REVENUECAT_PROJECT_ID || !customerId) return result;

  try {
    const client = await getRevenueCatClient();
    if (!client) return result;

    const { listCustomerActiveEntitlements } = await import("@replit/revenuecat-sdk");
    const { data, error } = await listCustomerActiveEntitlements({
      client,
      path: {
        project_id: REVENUECAT_PROJECT_ID,
        customer_id: customerId,
      },
    });

    if (error || !data?.items) return result;

    result.activeEntitlements = data.items.map((e: any) => e.lookup_key || e.entitlement_id);

    if (result.activeEntitlements.includes("family")) {
      result.tier = "family";
      result.entitled = true;
    } else if (result.activeEntitlements.includes(PRO_ENTITLEMENT_ID)) {
      result.tier = "pro";
      result.entitled = true;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Gatekeeper] Entitlement resolution failed:", message);
  }

  return result;
}

export function requireProEntitlement() {
  return async (req: GatedRequest, res: Response, next: NextFunction) => {
    const customerId =
      req.body?.revenueCatCustomerId ||
      req.query?.revenueCatCustomerId ||
      req.headers["x-revenuecat-customer-id"];

    if (!customerId || typeof customerId !== "string") {
      logHipaaAudit("GATEKEEPER_NO_CUSTOMER_ID", { path: req.path });
      return res.status(401).json({
        error: "Customer identification required",
        paywallTrigger: true,
        upgradeUrl: "/subscription",
        reason: "missing_customer_id",
      });
    }

    const entitlement = await resolveEntitlements(customerId);
    req.entitlement = entitlement;

    logHipaaAudit("GATEKEEPER_CHECK", {
      customerId,
      path: req.path,
      entitled: entitlement.entitled,
      tier: entitlement.tier,
    });

    if (!entitlement.entitled) {
      return res.status(403).json({
        error: "Pro subscription required",
        paywallTrigger: true,
        tier: entitlement.tier,
        upgradeUrl: "/subscription",
        reason: "not_entitled",
        entitlementRequired: PRO_ENTITLEMENT_ID,
        message: "Upgrade to Pro to unlock AI-powered health summaries, unlimited FHIR connections, and more.",
      });
    }

    next();
  };
}

export function gateWithPreview<T>(options: {
  generatePreview: (fullData: T) => Partial<T> & { _preview: true; _masked: true };
}) {
  return async (req: GatedRequest, res: Response, next: NextFunction) => {
    const customerId =
      req.body?.revenueCatCustomerId ||
      req.query?.revenueCatCustomerId ||
      req.headers["x-revenuecat-customer-id"];

    if (!customerId || typeof customerId !== "string") {
      req.entitlement = {
        entitled: false,
        tier: "free",
        customerId: "",
        activeEntitlements: [],
      };
      next();
      return;
    }

    const entitlement = await resolveEntitlements(customerId);
    req.entitlement = entitlement;

    logHipaaAudit("GATE_PREVIEW_CHECK", {
      customerId,
      path: req.path,
      entitled: entitlement.entitled,
      tier: entitlement.tier,
    });

    next();
  };
}

export function maskSummaryForFreeUser(fullSummary: any): any {
  const lines = (fullSummary.summary || "").split("\n");
  const previewLines: string[] = [];
  let sectionCount = 0;

  for (const line of lines) {
    if (line.startsWith("**") || line.startsWith("## ") || line.startsWith("# ")) {
      sectionCount++;
    }
    if (sectionCount <= 2) {
      previewLines.push(line);
    } else {
      break;
    }
  }

  const maskedSummary = previewLines.join("\n") +
    "\n\n--- Pro Subscription Required ---\n" +
    "Upgrade to see your complete health summary including medications, lab results, immunizations, allergies, encounters, and data quality analysis.";

  const maskedResourceCounts: Record<string, string | number> = {};
  const types = Object.keys(fullSummary.resourceCounts || {});
  for (let i = 0; i < types.length; i++) {
    if (i < 2) {
      maskedResourceCounts[types[i]] = fullSummary.resourceCounts[types[i]];
    } else {
      maskedResourceCounts[types[i]] = "***";
    }
  }

  return {
    _preview: true,
    _masked: true,
    patientId: fullSummary.patientId,
    generatedAt: fullSummary.generatedAt,
    demographics: fullSummary.demographics,
    summary: maskedSummary,
    resourceCounts: maskedResourceCounts,
    deduplicationStats: {
      totalResources: fullSummary.deduplicationStats?.totalResources ?? 0,
      uniqueResources: "***",
      duplicatesRemoved: "***",
    },
    paywallTrigger: true,
    upgradeUrl: "/subscription",
    upgradeMessage: "Unlock your complete AI health summary with a Pro subscription.",
    availableSections: ["Patient Overview", "Active Conditions"],
    lockedSections: [
      "Medications",
      "Recent Lab Results",
      "Immunizations",
      "Allergies",
      "Recent Encounters",
      "Data Quality Notes",
    ],
  };
}

export function maskFhirBundleForFreeUser(bundle: any): any {
  const entries = bundle?.entry || [];
  const total = bundle?.total ?? entries.length;

  const previewEntries = entries.slice(0, 3).map((entry: any) => {
    const r = entry.resource;
    return {
      resource: {
        resourceType: r?.resourceType,
        id: r?.id,
        meta: { lastUpdated: r?.meta?.lastUpdated },
        _masked: true,
      },
      fullUrl: entry.fullUrl,
    };
  });

  return {
    _preview: true,
    _masked: true,
    resourceType: bundle?.resourceType || "Bundle",
    type: bundle?.type || "searchset",
    total,
    entry: previewEntries,
    paywallTrigger: true,
    upgradeUrl: "/subscription",
    upgradeMessage: `${total} resources found. Upgrade to Pro to view all records.`,
    visibleCount: previewEntries.length,
    hiddenCount: Math.max(0, total - previewEntries.length),
  };
}
