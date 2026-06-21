import { Express, Request, Response } from "express";
import { aiFhirProfilingEngine, FHIRProfile, ProfileStatus } from "./services/ai-fhir-profiling-engine";
import { requireRole } from "./rbac";
import { logPhiAccess } from "./security/hipaa-audit";

export function registerAIFHIRProfilingRoutes(app: Express): void {
  
  app.post("/api/fhir-profiling/analyze", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { resources, options } = req.body as {
        resources: Array<{ resourceType: string; resource: Record<string, unknown> }>;
        options?: { targetProfile?: string; detectPatterns?: boolean; suggestProfiles?: boolean };
      };

      if (!resources || !Array.isArray(resources) || resources.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Resources array is required and must not be empty" 
        });
      }

      const userId = (req as any).user?.claims?.sub || "anonymous";
      await logPhiAccess({
        action: "read",
        resourceType: "FHIRProfile",
        resourceId: "bulk-analysis",
        userId,
        timestamp: new Date().toISOString(),
        details: `Analyzing ${resources.length} resources for profiling patterns`,
      });

      const analysis = await aiFhirProfilingEngine.analyzeResources(resources, options || {});
      
      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Analysis error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to analyze resources" 
      });
    }
  });

  app.get("/api/fhir-profiling/analyses", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const analyses = await aiFhirProfilingEngine.listAnalyses();
      res.json({
        success: true,
        analyses,
      });
    } catch (error) {
      console.error("[FHIRProfiling] List analyses error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to list analyses" 
      });
    }
  });

  app.get("/api/fhir-profiling/analyses/:id", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const analysis = await aiFhirProfilingEngine.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ 
          success: false, 
          error: "Analysis not found" 
        });
      }
      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Get analysis error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get analysis" 
      });
    }
  });

  app.post("/api/fhir-profiling/analyses/:analysisId/apply/:suggestionId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { analysisId, suggestionId } = req.params;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      const profile = await aiFhirProfilingEngine.applySuggestion(suggestionId, analysisId, userId);
      
      if (!profile) {
        return res.status(404).json({ 
          success: false, 
          error: "Suggestion or analysis not found, or suggestion type not applicable" 
        });
      }

      await logPhiAccess({
        action: "write",
        resourceType: "FHIRProfile",
        resourceId: profile.id,
        userId,
        timestamp: new Date().toISOString(),
        details: `Applied suggestion ${suggestionId} to create profile: ${profile.name}`,
      });

      res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Apply suggestion error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to apply suggestion" 
      });
    }
  });

  app.get("/api/fhir-profiling/profiles", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { resourceType, status, aiGenerated, tags } = req.query;
      
      const filters: {
        resourceType?: string;
        status?: ProfileStatus;
        aiGenerated?: boolean;
        tags?: string[];
      } = {};

      if (resourceType) filters.resourceType = String(resourceType);
      if (status) filters.status = status as ProfileStatus;
      if (aiGenerated !== undefined) filters.aiGenerated = aiGenerated === "true";
      if (tags) filters.tags = String(tags).split(",");

      const profiles = await aiFhirProfilingEngine.listProfiles(filters);
      
      res.json({
        success: true,
        profiles,
        count: profiles.length,
      });
    } catch (error) {
      console.error("[FHIRProfiling] List profiles error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to list profiles" 
      });
    }
  });

  app.get("/api/fhir-profiling/profiles/:id", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const profile = await aiFhirProfilingEngine.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found" 
        });
      }
      res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Get profile error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get profile" 
      });
    }
  });

  app.get("/api/fhir-profiling/profiles/by-url/:url(*)", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.url);
      const profile = await aiFhirProfilingEngine.getProfileByUrl(url);
      if (!profile) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found for URL" 
        });
      }
      res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Get profile by URL error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get profile by URL" 
      });
    }
  });

  app.post("/api/fhir-profiling/profiles", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const profileData = req.body as Omit<FHIRProfile, "id" | "createdAt" | "updatedAt" | "metadata">;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      if (!profileData.name || !profileData.url || !profileData.resourceType) {
        return res.status(400).json({ 
          success: false, 
          error: "name, url, and resourceType are required" 
        });
      }

      const profile = await aiFhirProfilingEngine.createProfile({
        ...profileData,
        createdBy: userId,
      });

      await logPhiAccess({
        action: "write",
        resourceType: "FHIRProfile",
        resourceId: profile.id,
        userId,
        timestamp: new Date().toISOString(),
        details: `Created custom FHIR profile: ${profile.name}`,
      });

      res.status(201).json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Create profile error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to create profile" 
      });
    }
  });

  app.patch("/api/fhir-profiling/profiles/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const updates = req.body as Partial<FHIRProfile>;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      const profile = await aiFhirProfilingEngine.updateProfile(req.params.id, updates);
      
      if (!profile) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found" 
        });
      }

      await logPhiAccess({
        action: "write",
        resourceType: "FHIRProfile",
        resourceId: profile.id,
        userId,
        timestamp: new Date().toISOString(),
        details: `Updated FHIR profile: ${profile.name}`,
      });

      res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Update profile error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update profile" 
      });
    }
  });

  app.delete("/api/fhir-profiling/profiles/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub || "anonymous";
      const deleted = await aiFhirProfilingEngine.deleteProfile(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found" 
        });
      }

      await logPhiAccess({
        action: "delete",
        resourceType: "FHIRProfile",
        resourceId: req.params.id,
        userId,
        timestamp: new Date().toISOString(),
        details: `Deleted FHIR profile`,
      });

      res.json({
        success: true,
        message: "Profile deleted",
      });
    } catch (error) {
      console.error("[FHIRProfiling] Delete profile error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to delete profile" 
      });
    }
  });

  app.post("/api/fhir-profiling/profiles/:profileId/link-mapping/:mappingId", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { profileId, mappingId } = req.params;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      const linked = await aiFhirProfilingEngine.linkProfileToDataMapping(profileId, mappingId);
      
      if (!linked) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found" 
        });
      }

      await logPhiAccess({
        action: "write",
        resourceType: "FHIRProfile",
        resourceId: profileId,
        userId,
        timestamp: new Date().toISOString(),
        details: `Linked profile to data mapping: ${mappingId}`,
      });

      res.json({
        success: true,
        message: "Profile linked to data mapping",
      });
    } catch (error) {
      console.error("[FHIRProfiling] Link mapping error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to link profile to mapping" 
      });
    }
  });

  app.delete("/api/fhir-profiling/profiles/:profileId/unlink-mapping/:mappingId", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const { profileId, mappingId } = req.params;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      const unlinked = await aiFhirProfilingEngine.unlinkProfileFromDataMapping(profileId, mappingId);
      
      if (!unlinked) {
        return res.status(404).json({ 
          success: false, 
          error: "Profile not found" 
        });
      }

      await logPhiAccess({
        action: "write",
        resourceType: "FHIRProfile",
        resourceId: profileId,
        userId,
        timestamp: new Date().toISOString(),
        details: `Unlinked profile from data mapping: ${mappingId}`,
      });

      res.json({
        success: true,
        message: "Profile unlinked from data mapping",
      });
    } catch (error) {
      console.error("[FHIRProfiling] Unlink mapping error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to unlink profile from mapping" 
      });
    }
  });

  app.get("/api/fhir-profiling/profiles/for-mapping/:mappingId", requireRole("admin", "provider"), async (req: Request, res: Response) => {
    try {
      const profiles = await aiFhirProfilingEngine.getProfilesForDataMapping(req.params.mappingId);
      
      res.json({
        success: true,
        profiles,
        count: profiles.length,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Get profiles for mapping error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get profiles for mapping" 
      });
    }
  });

  app.get("/api/fhir-profiling/standard-profiles", async (_req: Request, res: Response) => {
    try {
      const standardProfiles = aiFhirProfilingEngine.getStandardProfiles();
      const usCoreExtensions = aiFhirProfilingEngine.getUSCoreExtensions();
      
      res.json({
        success: true,
        standardProfiles,
        usCoreExtensions,
      });
    } catch (error) {
      console.error("[FHIRProfiling] Get standard profiles error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get standard profiles" 
      });
    }
  });

  console.log("[Routes] AI FHIR Profiling Engine routes registered at /api/fhir-profiling");
}
