import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";

const TRACKED_KEYS = [
  "FASTEN_HEALTH_API_KEY",
  "FASTEN_HEALTH_CLIENT_ID",
  "FASTEN_HEALTH_REDIRECT_URL",
  "EPIC_CLIENT_ID",
  "GOOGLE_API_KEY",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "CARE_BRIDGE_SECRET",
  "PHI_ENCRYPTION_KEY",
  "PHI_ENCRYPTION_SALT",
  "GITHUB_PAT",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "EXPO_TOKEN",
  "VITE_GCIP_API_KEY",
  "VITE_REVENUECAT_IOS_KEY",
  "VITE_REVENUECAT_ANDROID_KEY",
  "VITE_REVENUECAT_WEB_KEY",
] as const;

function fingerprint(value: string | undefined): {
  loaded: boolean;
  length: number;
  last4: string | null;
} {
  if (!value) return { loaded: false, length: 0, last4: null };
  return {
    loaded: true,
    length: value.length,
    last4: value.length >= 4 ? value.slice(-4) : "***",
  };
}

export function registerIntegrationsDebugRoutes(app: Express): void {
  app.get(
    "/api/health/integrations",
    isAuthenticated as any,
    async (_req: Request, res: Response) => {
      try {
        const entries = TRACKED_KEYS.map((key) => ({
          key,
          ...fingerprint(process.env[key]),
        }));
        res.json({
          generatedAt: new Date().toISOString(),
          nodeEnv: process.env.NODE_ENV ?? "unknown",
          fingerprints: entries,
        });
      } catch (err) {
        console.error("[integrations-debug] failed:", err);
        res.status(500).json({ error: "Failed to inspect integration env" });
      }
    },
  );

  console.log(
    "[Routes] Integrations debug route registered at /api/health/integrations (auth required, last4 only)",
  );
}
