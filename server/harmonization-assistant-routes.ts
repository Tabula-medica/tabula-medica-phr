import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { 
  aiHarmonizationAssistantService,
  ProfileType,
  SuggestionStatus,
  SuggestionPriority,
  SuggestionCategory,
} from "./services/ai-harmonization-assistant";

import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>): void {
  console.log(`[HIPAA_AUDIT][HarmonizationAssistant] ${action}`, JSON.stringify(details));
}

const idParamSchema = z.object({
  id: z.string().min(1),
});

const profileTypeSchema = z.enum(["us-core", "hl7-fhir-r4", "custom", "c-cda", "ips", "mcode"]);

const createProfileSchema = z.object({
  name: z.string().min(1),
  type: profileTypeSchema,
  baseUrl: z.string().min(1),
  version: z.string().min(1),
  resourceTypes: z.array(z.string()),
  extensions: z.array(z.object({
    url: z.string(),
    name: z.string(),
    type: z.string(),
    cardinality: z.string(),
    description: z.string(),
    appliesTo: z.array(z.string()),
  })).optional().default([]),
  constraints: z.array(z.object({
    id: z.string(),
    path: z.string(),
    severity: z.enum(["error", "warning", "information"]),
    human: z.string(),
    expression: z.string().optional(),
  })).optional().default([]),
  terminology: z.array(z.object({
    path: z.string(),
    valueSet: z.string(),
    strength: z.enum(["required", "extensible", "preferred", "example"]),
    description: z.string().optional(),
  })).optional().default([]),
  sourceSystem: z.string().optional(),
});

const updateProfileSchema = createProfileSchema.partial();

const analyzeProfileSchema = z.object({
  compareWith: profileTypeSchema.optional(),
});

const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
});

const rejectSuggestionSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const inconsistencyFiltersSchema = z.object({
  profileId: z.string().min(1).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  type: z.string().min(1).optional(),
}).optional();

const suggestionFiltersSchema = z.object({
  status: z.enum(["pending", "applied", "rejected", "partially_applied"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  category: z.enum(["mapping", "profile", "terminology", "structure", "validation", "transformation"]).optional(),
}).optional();

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_HARMONIZATION_DASHBOARD", {});
    const dashboard = aiHarmonizationAssistantService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[HarmonizationAssistant] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as ProfileType | undefined;
    logHipaaAudit("LIST_PROFILES", { type });
    const profiles = aiHarmonizationAssistantService.getProfiles(type);
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error("[HarmonizationAssistant] List profiles error:", error);
    res.status(500).json({ success: false, error: "Failed to list profiles" });
  }
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid profile ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("VIEW_PROFILE", { profileId: hashIdentifier(id) });
    const profile = aiHarmonizationAssistantService.getProfile(id);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[HarmonizationAssistant] Get profile error:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const parseResult = createProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.message });
    }
    logHipaaAudit("CREATE_PROFILE", { name: parseResult.data.name, type: parseResult.data.type });
    const profile = aiHarmonizationAssistantService.createProfile(parseResult.data);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    console.error("[HarmonizationAssistant] Create profile error:", error);
    res.status(500).json({ success: false, error: "Failed to create profile" });
  }
});

router.patch("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid profile ID" });
    }
    const { id } = paramResult.data;
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.message });
    }
    logHipaaAudit("UPDATE_PROFILE", { profileId: hashIdentifier(id) });
    const profile = aiHarmonizationAssistantService.updateProfile(id, parseResult.data);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[HarmonizationAssistant] Update profile error:", error);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

router.post("/profiles/:id/analyze", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid profile ID" });
    }
    const { id } = paramResult.data;
    const parseResult = analyzeProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body: " + parseResult.error.message });
    }
    const { compareWith } = parseResult.data;
    
    logHipaaAudit("ANALYZE_PROFILE", { profileId: hashIdentifier(id), compareWith });
    const analysis = await aiHarmonizationAssistantService.analyzeProfile(id, compareWith);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error("[HarmonizationAssistant] Analyze profile error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to analyze profile" });
  }
});

router.post("/mappings/:id/analyze", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid mapping ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("ANALYZE_MAPPING", { mappingId: hashIdentifier(id) });
    const analysis = await aiHarmonizationAssistantService.analyzeMapping(id);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error("[HarmonizationAssistant] Analyze mapping error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to analyze mapping" });
  }
});

router.get("/inconsistencies", async (req: Request, res: Response) => {
  try {
    const filterResult = inconsistencyFiltersSchema.safeParse(req.query);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: "Invalid filter parameters" });
    }
    const filters = filterResult.data || {};
    
    logHipaaAudit("LIST_INCONSISTENCIES", { filters });
    const inconsistencies = aiHarmonizationAssistantService.getInconsistencies(filters);
    res.json({ success: true, data: inconsistencies });
  } catch (error) {
    console.error("[HarmonizationAssistant] List inconsistencies error:", error);
    res.status(500).json({ success: false, error: "Failed to list inconsistencies" });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const filterResult = suggestionFiltersSchema.safeParse(req.query);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: "Invalid filter parameters" });
    }
    const filters = filterResult.data || {};
    
    logHipaaAudit("LIST_SUGGESTIONS", { filters });
    const suggestions = aiHarmonizationAssistantService.getSuggestions(filters);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("[HarmonizationAssistant] List suggestions error:", error);
    res.status(500).json({ success: false, error: "Failed to list suggestions" });
  }
});

router.get("/suggestions/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("VIEW_SUGGESTION", { suggestionId: hashIdentifier(id) });
    const suggestion = aiHarmonizationAssistantService.getSuggestion(id);
    if (!suggestion) {
      return res.status(404).json({ success: false, error: "Suggestion not found" });
    }
    res.json({ success: true, data: suggestion });
  } catch (error) {
    console.error("[HarmonizationAssistant] Get suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to get suggestion" });
  }
});

router.post("/suggestions/:id/apply", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("APPLY_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const result = await aiHarmonizationAssistantService.applySuggestion(id, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[HarmonizationAssistant] Apply suggestion error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to apply suggestion" });
  }
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const parseResult = rejectSuggestionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }
    const userId = getUserId(req);
    
    logHipaaAudit("REJECT_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const suggestion = await aiHarmonizationAssistantService.rejectSuggestion(id, userId, parseResult.data.reason);
    res.json({ success: true, data: suggestion });
  } catch (error: any) {
    console.error("[HarmonizationAssistant] Reject suggestion error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to reject suggestion" });
  }
});

router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("START_CONVERSATION", { userId: hashIdentifier(userId) });
    const conversation = aiHarmonizationAssistantService.startConversation(userId);
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error("[HarmonizationAssistant] Start conversation error:", error);
    res.status(500).json({ success: false, error: "Failed to start conversation" });
  }
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("VIEW_CONVERSATION", { conversationId: hashIdentifier(id) });
    const conversation = aiHarmonizationAssistantService.getConversation(id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }
    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error("[HarmonizationAssistant] Get conversation error:", error);
    res.status(500).json({ success: false, error: "Failed to get conversation" });
  }
});

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID" });
    }
    const { id } = paramResult.data;
    const parseResult = chatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    
    logHipaaAudit("CHAT_MESSAGE", { conversationId: hashIdentifier(id) });
    const response = await aiHarmonizationAssistantService.chat(id, parseResult.data.message);
    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error("[HarmonizationAssistant] Chat error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process message" });
  }
});

router.post("/bulk-apply", async (req: Request, res: Response) => {
  try {
    const suggestionIdsSchema = z.object({
      suggestionIds: z.array(z.string().min(1)),
    });
    const parseResult = suggestionIdsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Suggestion IDs are required" });
    }
    const userId = getUserId(req);
    
    logHipaaAudit("BULK_APPLY_SUGGESTIONS", { count: parseResult.data.suggestionIds.length, userId: hashIdentifier(userId) });
    
    const results = [];
    for (const suggestionId of parseResult.data.suggestionIds) {
      try {
        const result = await aiHarmonizationAssistantService.applySuggestion(suggestionId, userId);
        results.push(result);
      } catch (error: any) {
        results.push({
          suggestionId,
          success: false,
          error: error.message,
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    res.json({ 
      success: true, 
      data: { 
        total: parseResult.data.suggestionIds.length,
        applied: successCount,
        failed: parseResult.data.suggestionIds.length - successCount,
        results,
      } 
    });
  } catch (error) {
    console.error("[HarmonizationAssistant] Bulk apply error:", error);
    res.status(500).json({ success: false, error: "Failed to bulk apply suggestions" });
  }
});

export default router;
