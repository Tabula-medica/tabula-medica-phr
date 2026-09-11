import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import {
  aiPolicyDraftingService,
  PolicyCategory,
  RegulatoryFramework
} from "./services/ai-policy-drafting";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  const userId = getUserId(req);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else {
      sanitized[key] = value;
    }
  }
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "PolicyDraftingAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitized
  })}`);
}

const categoryEnum = z.enum([
  "access_control", "retention", "encryption", "audit", 
  "consent", "breach_response", "data_classification", "vendor_management"
]);

const frameworkEnum = z.enum([
  "HIPAA", "GDPR", "SOC2", "HITECH", "CCPA", "NIST", "PCI_DSS", "FDA"
]);

const generateSuggestionsSchema = z.object({
  targetCategory: categoryEnum,
  targetFrameworks: z.array(frameworkEnum).min(1),
  existingPolicies: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    policyType: z.string().optional(),
    regulation: z.string().optional()
  })).optional().default([]),
  organizationContext: z.string().optional()
});

const generateRuleSchema = z.object({
  category: categoryEnum,
  description: z.string().min(10)
});

const generateSectionSchema = z.object({
  sectionTitle: z.string().min(3),
  policyCategory: categoryEnum,
  frameworks: z.array(frameworkEnum).min(1)
});

const createDraftSchema = z.object({
  templateId: z.string().nullable().optional(),
  category: categoryEnum,
  frameworks: z.array(frameworkEnum).min(1)
});

const policyRuleActionEnum = z.enum(["allow", "deny", "require_approval", "log", "encrypt", "anonymize"]);

const dataPolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  condition: z.string(),
  action: policyRuleActionEnum,
  priority: z.number(),
  isEnabled: z.boolean(),
  exceptions: z.array(z.string())
});

const updateDraftSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "review", "approved", "active"]).optional(),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    order: z.number(),
    aiGenerated: z.boolean()
  })).optional(),
  rules: z.array(dataPolicyRuleSchema).optional(),
  effectiveDate: z.string().optional(),
  reviewDate: z.string().optional(),
  owner: z.string().optional()
});

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as PolicyCategory | undefined;
    
    logHipaaAudit("LIST_POLICY_TEMPLATES", "policy_templates", req, { category });
    
    const templates = aiPolicyDraftingService.listTemplates(category);
    res.json({ templates });
  } catch (error) {
    console.error("[PolicyDraftingAPI] List templates error:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const template = aiPolicyDraftingService.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    logHipaaAudit("VIEW_POLICY_TEMPLATE", "policy_template", req, { templateId: req.params.id });
    res.json(template);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Get template error:", error);
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.post("/suggestions", async (req: Request, res: Response) => {
  try {
    const parseResult = generateSuggestionsSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const userId = getUserId(req);
    const { targetCategory, targetFrameworks, existingPolicies, organizationContext } = parseResult.data;
    
    logHipaaAudit("GENERATE_POLICY_SUGGESTIONS", "policy_draft", req, {
      category: targetCategory,
      frameworks: targetFrameworks
    });
    
    const suggestions = await aiPolicyDraftingService.generatePolicySuggestions(
      {
        existingPolicies: existingPolicies as any,
        targetCategory,
        targetFrameworks,
        organizationContext
      },
      userId
    );
    
    res.json(suggestions);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Generate suggestions error:", error);
    res.status(500).json({ error: "Failed to generate policy suggestions" });
  }
});

router.post("/generate-rule", async (req: Request, res: Response) => {
  try {
    const parseResult = generateRuleSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const userId = getUserId(req);
    const { category, description } = parseResult.data;
    
    logHipaaAudit("GENERATE_RULE_SUGGESTION", "policy_rule", req, { category });
    
    const result = await aiPolicyDraftingService.generateRuleSuggestion(category, description, userId);
    res.json(result);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Generate rule error:", error);
    res.status(500).json({ error: "Failed to generate rule suggestion" });
  }
});

router.post("/generate-section", async (req: Request, res: Response) => {
  try {
    const parseResult = generateSectionSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const userId = getUserId(req);
    const { sectionTitle, policyCategory, frameworks } = parseResult.data;
    
    logHipaaAudit("GENERATE_SECTION_CONTENT", "policy_section", req, { 
      sectionTitle, 
      policyCategory 
    });
    
    const result = await aiPolicyDraftingService.generateSectionContent(
      sectionTitle, 
      policyCategory, 
      frameworks, 
      userId
    );
    res.json(result);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Generate section error:", error);
    res.status(500).json({ error: "Failed to generate section content" });
  }
});

router.post("/drafts", async (req: Request, res: Response) => {
  try {
    const parseResult = createDraftSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const userId = getUserId(req);
    const { templateId, category, frameworks } = parseResult.data;
    
    logHipaaAudit("CREATE_POLICY_DRAFT", "policy_draft", req, { templateId, category });
    
    const draft = aiPolicyDraftingService.createDraft(templateId || null, category, frameworks, userId);
    res.status(201).json(draft);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Create draft error:", error);
    res.status(500).json({ error: "Failed to create policy draft" });
  }
});

router.get("/drafts", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const category = req.query.category as PolicyCategory | undefined;
    
    logHipaaAudit("LIST_POLICY_DRAFTS", "policy_drafts", req, { status, category });
    
    const drafts = aiPolicyDraftingService.listDrafts({ status, category });
    res.json({ 
      drafts: drafts.map(d => ({
        id: d.id,
        title: d.title,
        category: d.category,
        status: d.status,
        version: d.version,
        regulatoryFrameworks: d.regulatoryFrameworks,
        sectionsCount: d.sections.length,
        rulesCount: d.rules.length,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      })),
      total: drafts.length
    });
  } catch (error) {
    console.error("[PolicyDraftingAPI] List drafts error:", error);
    res.status(500).json({ error: "Failed to list drafts" });
  }
});

router.get("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const draft = aiPolicyDraftingService.getDraft(req.params.id);
    
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    logHipaaAudit("VIEW_POLICY_DRAFT", "policy_draft", req, { draftId: req.params.id });
    res.json(draft);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Get draft error:", error);
    res.status(500).json({ error: "Failed to get draft" });
  }
});

router.patch("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const parseResult = updateDraftSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const userId = getUserId(req);
    
    logHipaaAudit("UPDATE_POLICY_DRAFT", "policy_draft", req, { 
      draftId: req.params.id,
      updatedFields: Object.keys(parseResult.data)
    });
    
    const updated = aiPolicyDraftingService.updateDraft(req.params.id, parseResult.data as any, userId);
    
    if (!updated) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("[PolicyDraftingAPI] Update draft error:", error);
    res.status(500).json({ error: "Failed to update draft" });
  }
});

router.delete("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("DELETE_POLICY_DRAFT", "policy_draft", req, { draftId: req.params.id });
    
    const deleted = aiPolicyDraftingService.deleteDraft(req.params.id, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json({ success: true, message: "Draft deleted" });
  } catch (error) {
    console.error("[PolicyDraftingAPI] Delete draft error:", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

router.get("/best-practices", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as PolicyCategory;
    const framework = req.query.framework as RegulatoryFramework;
    
    if (!category || !framework) {
      return res.status(400).json({ 
        error: "Missing required parameters: category and framework" 
      });
    }
    
    logHipaaAudit("GET_BEST_PRACTICES", "policy_best_practices", req, { category, framework });
    
    const bestPractices = aiPolicyDraftingService.getBestPractices(category, framework);
    res.json({ bestPractices });
  } catch (error) {
    console.error("[PolicyDraftingAPI] Best practices error:", error);
    res.status(500).json({ error: "Failed to get best practices" });
  }
});

export default router;
