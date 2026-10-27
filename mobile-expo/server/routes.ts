import type { Express } from "express";
import { createServer, type Server } from "node:http";

import { createSharedContext } from "./routes/_shared";
import { registerClinical1Routes } from "./routes/clinical-1";
import { registerPatientRoutes } from "./routes/patient";
import { registerClinical2Routes } from "./routes/clinical-2";
import { registerCollab1Routes } from "./routes/collab-1";
import { registerCollab2Routes } from "./routes/collab-2";
import { registerIntegrations1Routes } from "./routes/integrations-1";
import { registerClinical3Routes } from "./routes/clinical-3";
import { registerClinical4Routes } from "./routes/clinical-4";
import { registerClinical5Routes } from "./routes/clinical-5";
import { registerIntegrations2Routes } from "./routes/integrations-2";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerClinical6Routes } from "./routes/clinical-6";
import { registerRoadmapRoutes } from "./routes/roadmap-routes";
import { registerProviderOnboardingRoutes } from "./routes/provider-onboarding-routes";
import { registerAiReviewRoutes } from "./routes/ai-review-routes";
import { registerVoiceRoutes } from "./routes/voice-routes";
import { registerSeoRoutes } from "./routes/seo-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  const ctx = await createSharedContext();

  // Execution order matches the original monolith exactly: each chunk below is a
  // contiguous slice of the original registerRoutes() body, in source order.
  // DO NOT REORDER — Express middleware (`app.use(mw)`) only applies to routes
  // registered AFTER it, so any reordering silently changes runtime behavior.
  registerClinical1Routes(app, ctx);
  registerPatientRoutes(app, ctx);
  registerClinical2Routes(app, ctx);
  registerCollab1Routes(app, ctx);
  registerCollab2Routes(app, ctx);
  registerIntegrations1Routes(app, ctx);
  registerClinical3Routes(app, ctx);
  registerClinical4Routes(app, ctx);
  registerClinical5Routes(app, ctx);
  registerIntegrations2Routes(app, ctx);
  registerAnalyticsRoutes(app, ctx);
  registerClinical6Routes(app, ctx);
  registerRoadmapRoutes(app);
  registerProviderOnboardingRoutes(app);
  registerAiReviewRoutes(app);
  registerVoiceRoutes(app);
  // SEO endpoints: /sitemap.xml, /robots.txt, /llms.txt — primary registration
  // is in server/index.ts (before static middleware) so dist/web cannot shadow
  // them.  This secondary registration is a safety net for any test harness that
  // calls registerRoutes() directly without going through server/index.ts.
  registerSeoRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
