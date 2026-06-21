import type { Express, Request, Response } from "express";

const COMP_AI_API_BASE = "https://api.trycomp.ai";
const COMP_AI_ENTERPRISE_BASE = "https://enterprise-api.trycomp.ai";

const SUPPORTED_FRAMEWORKS = [
  "soc2_type1",
  "soc2_type2",
  "iso_27001",
  "hipaa",
  "gdpr",
  "pci_dss",
  "iso_42001",
  "nen_7510",
  "iso_9001",
] as const;

type CompAiFramework = (typeof SUPPORTED_FRAMEWORKS)[number];

interface CompAiOrgResponse {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string | null;
  onboardingCompleted: boolean;
  hasAccess: boolean;
  primaryColor: string | null;
  createdAt: string;
  authType: string;
}

interface CompAiCertificate {
  framework: CompAiFramework;
  fileName: string;
  fileSize: number;
  updatedAt: string;
}

interface CompAiSignedUrlResponse {
  signedUrl: string;
  fileName: string;
  fileSize: number;
}

function getApiKey(): string | null {
  return process.env.COMP_AI_API_KEY || null;
}

function getOrgId(): string | null {
  return process.env.COMP_AI_ORG_ID || null;
}

function getEnterpriseSecret(): string | null {
  return process.env.COMP_AI_ENTERPRISE_SECRET || null;
}

function buildHeaders(includeOrg = true): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("COMP_AI_API_KEY not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  const orgId = getOrgId();
  if (includeOrg && orgId) {
    headers["X-Organization-Id"] = orgId;
  }

  return headers;
}

export function registerCompAiRoutes(app: Express) {
  app.get("/api/compai/status", async (_req: Request, res: Response) => {
    try {
      const apiKey = getApiKey();
      const orgId = getOrgId();
      const enterpriseSecret = getEnterpriseSecret();

      res.json({
        success: true,
        data: {
          connected: !!apiKey,
          hasOrgId: !!orgId,
          hasEnterpriseAccess: !!enterpriseSecret,
          supportedFrameworks: SUPPORTED_FRAMEWORKS,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/compai/organization", async (_req: Request, res: Response) => {
    try {
      const headers = buildHeaders();

      const response = await fetch(`${COMP_AI_API_BASE}/v1/organization`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `Comp AI API error: ${response.status} ${response.statusText}`,
          details: errorText,
        });
      }

      const data: CompAiOrgResponse = await response.json();
      res.json({ success: true, data });
    } catch (error: any) {
      if (error.message === "COMP_AI_API_KEY not configured") {
        return res.status(503).json({
          success: false,
          error: "Comp AI not configured. Please set COMP_AI_API_KEY.",
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/compai/certificates", async (_req: Request, res: Response) => {
    try {
      const headers = buildHeaders();
      const orgId = getOrgId();
      if (!orgId) {
        return res.status(400).json({
          success: false,
          error: "COMP_AI_ORG_ID not configured",
        });
      }

      const response = await fetch(
        `${COMP_AI_API_BASE}/v1/trust-portal/compliance-resources/list`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ organizationId: orgId }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `Comp AI API error: ${response.status} ${response.statusText}`,
          details: errorText,
        });
      }

      const certificates: CompAiCertificate[] = await response.json();

      const frameworkMap: Record<string, string> = {
        soc2_type1: "SOC 2 Type I",
        soc2_type2: "SOC 2 Type II",
        iso_27001: "ISO 27001",
        hipaa: "HIPAA",
        gdpr: "GDPR",
        pci_dss: "PCI DSS",
        iso_42001: "ISO 42001",
        nen_7510: "NEN 7510",
        iso_9001: "ISO 9001",
      };

      const targetFrameworks = [
        "soc2_type1",
        "soc2_type2",
        "iso_27001",
        "hipaa",
        "gdpr",
      ];

      const enriched = SUPPORTED_FRAMEWORKS.map((fw) => {
        const cert = certificates.find((c) => c.framework === fw);
        return {
          framework: fw,
          displayName: frameworkMap[fw] || fw,
          hasCertificate: !!cert,
          fileName: cert?.fileName || null,
          fileSize: cert?.fileSize || null,
          updatedAt: cert?.updatedAt || null,
          isTargetFramework: targetFrameworks.includes(fw),
        };
      });

      res.json({
        success: true,
        data: {
          certificates: enriched,
          totalCertificates: certificates.length,
          targetFrameworksCovered: enriched.filter(
            (e) => e.isTargetFramework && e.hasCertificate,
          ).length,
          targetFrameworksTotal: targetFrameworks.length,
        },
      });
    } catch (error: any) {
      if (error.message === "COMP_AI_API_KEY not configured") {
        return res.status(503).json({
          success: false,
          error: "Comp AI not configured. Please set COMP_AI_API_KEY.",
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post(
    "/api/compai/certificates/download",
    async (req: Request, res: Response) => {
      try {
        const { framework } = req.body;
        if (
          !framework ||
          !SUPPORTED_FRAMEWORKS.includes(framework as CompAiFramework)
        ) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid framework" });
        }

        const headers = buildHeaders();
        const orgId = getOrgId();
        if (!orgId) {
          return res
            .status(400)
            .json({ success: false, error: "COMP_AI_ORG_ID not configured" });
        }

        const response = await fetch(
          `${COMP_AI_API_BASE}/v1/trust-portal/compliance-resources/signed-url`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ organizationId: orgId, framework }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({
            success: false,
            error: `Comp AI API error: ${response.status} ${response.statusText}`,
            details: errorText,
          });
        }

        const data: CompAiSignedUrlResponse = await response.json();
        res.json({ success: true, data });
      } catch (error: any) {
        if (error.message === "COMP_AI_API_KEY not configured") {
          return res.status(503).json({
            success: false,
            error: "Comp AI not configured. Please set COMP_AI_API_KEY.",
          });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  app.post(
    "/api/compai/workflow/analyze",
    async (req: Request, res: Response) => {
      try {
        const enterpriseSecret = getEnterpriseSecret();
        if (!enterpriseSecret) {
          return res.status(503).json({
            success: false,
            error:
              "Enterprise API not configured. Set COMP_AI_ENTERPRISE_SECRET.",
          });
        }

        const response = await fetch(
          `${COMP_AI_ENTERPRISE_BASE}/api/tasks-automation/workflow/analyze`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-secret": enterpriseSecret,
            },
            body: JSON.stringify(req.body),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({
            success: false,
            error: `Comp AI Enterprise API error: ${response.status}`,
            details: errorText,
          });
        }

        const data = await response.json();
        res.json({ success: true, data });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );
}
