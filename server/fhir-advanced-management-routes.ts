import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirBulkOperations, BulkOperationRequest } from "./services/fhir-bulk-operations";
import { fhirAccessControl, Permission } from "./services/fhir-access-control";
import { fhirAdvancedSearch, SearchQuery } from "./services/fhir-advanced-search";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function logHipaaAudit(action: string, resource: string, userId: string = "system") {
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} - ${action} on ${resource} by ${userId}`);
}

const bulkOperationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  operation: z.enum(["create", "update", "delete"]),
  targetSystems: z.array(z.string()).min(1),
  resources: z.array(z.object({
    resourceType: z.string(),
    resourceId: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  })).min(1),
});

const searchQuerySchema = z.object({
  resourceTypes: z.array(z.string()).default([]),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum([
      "eq", "ne", "gt", "lt", "ge", "le",
      "contains", "starts_with", "ends_with",
      "in", "not_in", "between", "is_null", "is_not_null"
    ]),
    value: z.unknown(),
    valueEnd: z.unknown().optional(),
  })).default([]),
  sort: z.array(z.object({
    field: z.string(),
    order: z.enum(["asc", "desc"]),
  })).default([]),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  includeTotal: z.boolean().default(true),
  includeReferences: z.boolean().optional(),
  fullTextQuery: z.string().optional(),
});

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  roles: z.array(z.string()).min(1),
  resourceTypes: z.array(z.string()).min(1),
  permissions: z.array(z.enum(["read", "write", "delete", "share", "admin"])).min(1),
  conditions: z.array(z.object({
    type: z.enum(["attribute", "time", "location", "purpose", "relationship"]),
    attribute: z.string().optional(),
    operator: z.enum(["equals", "contains", "in", "not_in", "greater_than", "less_than"]),
    value: z.union([z.string(), z.array(z.string()), z.number()]),
  })).optional(),
  priority: z.number().min(1).max(100),
  enabled: z.boolean(),
});

router.post("/bulk/create", async (req: Request, res: Response) => {
  try {
    const validated = bulkOperationSchema.parse(req.body);
    const userId = getUserId(req);

    const operation = await fhirBulkOperations.createBulkOperation(
      validated as BulkOperationRequest,
      userId
    );

    logHipaaAudit("BULK_OPERATION_CREATED", `operation/${operation.id}`, userId);

    res.json({ success: true, data: operation });
  } catch (error) {
    console.error("[AdvMgmt] Error creating bulk operation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to create bulk operation",
    });
  }
});

router.post("/bulk/:operationId/execute", async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const userId = getUserId(req);

    const operation = await fhirBulkOperations.executeBulkOperation(operationId, userId);

    logHipaaAudit("BULK_OPERATION_EXECUTED", `operation/${operationId}`, userId);

    res.json({ success: true, data: operation });
  } catch (error) {
    console.error("[AdvMgmt] Error executing bulk operation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute bulk operation",
    });
  }
});

router.get("/bulk/operations", async (req: Request, res: Response) => {
  try {
    const { status, operation, createdBy } = req.query;

    const operations = await fhirBulkOperations.listOperations({
      status: status as "pending" | "in_progress" | "completed" | "failed" | "partial" | undefined,
      operation: operation as "create" | "update" | "delete" | undefined,
      createdBy: createdBy as string | undefined,
    });

    logHipaaAudit("BULK_OPERATIONS_LIST", "operations");

    res.json({ success: true, data: operations });
  } catch (error) {
    console.error("[AdvMgmt] Error listing bulk operations:", error);
    res.status(500).json({ success: false, error: "Failed to list bulk operations" });
  }
});

router.get("/bulk/operations/:operationId", async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const operation = await fhirBulkOperations.getOperation(operationId);
    
    if (!operation) {
      return res.status(404).json({ success: false, error: "Operation not found" });
    }

    logHipaaAudit("BULK_OPERATION_VIEW", `operation/${operationId}`);
    res.json({ success: true, data: operation });
  } catch (error) {
    console.error("[AdvMgmt] Error getting bulk operation:", error);
    res.status(500).json({ success: false, error: "Failed to get bulk operation" });
  }
});

router.post("/bulk/:operationId/cancel", async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const userId = getUserId(req);

    const operation = await fhirBulkOperations.cancelOperation(operationId, userId);

    logHipaaAudit("BULK_OPERATION_CANCELLED", `operation/${operationId}`, userId);
    res.json({ success: true, data: operation });
  } catch (error) {
    console.error("[AdvMgmt] Error cancelling bulk operation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel bulk operation",
    });
  }
});

router.post("/bulk/:operationId/retry", async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const userId = getUserId(req);

    const operation = await fhirBulkOperations.retryFailedItems(operationId, userId);

    logHipaaAudit("BULK_OPERATION_RETRY", `operation/${operationId}`, userId);
    res.json({ success: true, data: operation });
  } catch (error) {
    console.error("[AdvMgmt] Error retrying bulk operation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to retry bulk operation",
    });
  }
});

router.get("/bulk/systems", async (_req: Request, res: Response) => {
  try {
    const systems = fhirBulkOperations.getSupportedSystems();
    res.json({ success: true, data: systems });
  } catch (error) {
    console.error("[AdvMgmt] Error getting systems:", error);
    res.status(500).json({ success: false, error: "Failed to get supported systems" });
  }
});

router.get("/bulk/stats", async (_req: Request, res: Response) => {
  try {
    const stats = fhirBulkOperations.getOperationStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[AdvMgmt] Error getting stats:", error);
    res.status(500).json({ success: false, error: "Failed to get operation stats" });
  }
});

router.post("/access/check", async (req: Request, res: Response) => {
  try {
    const { userId, userRole, userAttributes, resourceType, resourceId, resourceAttributes, action } = req.body;

    const decision = await fhirAccessControl.checkAccess({
      userId: userId || "anonymous",
      userRole: userRole || "guest",
      userAttributes,
      resourceType,
      resourceId,
      resourceAttributes,
      action: action as Permission,
    });

    res.json({ success: true, data: decision });
  } catch (error) {
    console.error("[AdvMgmt] Error checking access:", error);
    res.status(500).json({ success: false, error: "Failed to check access" });
  }
});

router.get("/access/policies", async (req: Request, res: Response) => {
  try {
    const { enabled, role } = req.query;

    const policies = await fhirAccessControl.listPolicies({
      enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
      role: role as string | undefined,
    });

    logHipaaAudit("ACCESS_POLICIES_LIST", "policies");
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error("[AdvMgmt] Error listing policies:", error);
    res.status(500).json({ success: false, error: "Failed to list policies" });
  }
});

router.post("/access/policies", async (req: Request, res: Response) => {
  try {
    const validated = policySchema.parse(req.body);
    const policy = await fhirAccessControl.createPolicy(validated);

    logHipaaAudit("ACCESS_POLICY_CREATED", `policy/${policy.id}`);
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[AdvMgmt] Error creating policy:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to create policy",
    });
  }
});

router.get("/access/policies/:policyId", async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    const policy = await fhirAccessControl.getPolicy(policyId);
    
    if (!policy) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }

    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[AdvMgmt] Error getting policy:", error);
    res.status(500).json({ success: false, error: "Failed to get policy" });
  }
});

router.patch("/access/policies/:policyId", async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    const policy = await fhirAccessControl.updatePolicy(policyId, req.body);

    logHipaaAudit("ACCESS_POLICY_UPDATED", `policy/${policyId}`);
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[AdvMgmt] Error updating policy:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update policy",
    });
  }
});

router.delete("/access/policies/:policyId", async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    await fhirAccessControl.deletePolicy(policyId);

    logHipaaAudit("ACCESS_POLICY_DELETED", `policy/${policyId}`);
    res.json({ success: true, message: "Policy deleted" });
  } catch (error) {
    console.error("[AdvMgmt] Error deleting policy:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete policy",
    });
  }
});

router.get("/access/audit", async (req: Request, res: Response) => {
  try {
    const { userId, resourceType, decision, startDate, endDate, limit } = req.query;

    const entries = await fhirAccessControl.getAuditLog({
      userId: userId as string | undefined,
      resourceType: resourceType as string | undefined,
      decision: decision as "allowed" | "denied" | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    logHipaaAudit("ACCESS_AUDIT_VIEW", "audit-log");
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("[AdvMgmt] Error getting audit log:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

router.get("/access/stats", async (_req: Request, res: Response) => {
  try {
    const stats = fhirAccessControl.getAccessStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[AdvMgmt] Error getting access stats:", error);
    res.status(500).json({ success: false, error: "Failed to get access stats" });
  }
});

router.get("/access/roles", async (_req: Request, res: Response) => {
  try {
    const roles = fhirAccessControl.getRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error("[AdvMgmt] Error getting roles:", error);
    res.status(500).json({ success: false, error: "Failed to get roles" });
  }
});

router.post("/search", async (req: Request, res: Response) => {
  try {
    const validated = searchQuerySchema.parse(req.body);
    const results = await fhirAdvancedSearch.search(validated as SearchQuery);

    logHipaaAudit("FHIR_SEARCH", "resources");
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("[AdvMgmt] Error searching:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to search",
    });
  }
});

router.post("/search/save", async (req: Request, res: Response) => {
  try {
    const { name, description, query, isPublic } = req.body;
    const userId = getUserId(req);

    const savedSearch = await fhirAdvancedSearch.saveSearch({
      name,
      description,
      query,
      userId,
      isPublic,
    });

    logHipaaAudit("SEARCH_SAVED", `saved-search/${savedSearch.id}`, userId);
    res.json({ success: true, data: savedSearch });
  } catch (error) {
    console.error("[AdvMgmt] Error saving search:", error);
    res.status(400).json({ success: false, error: "Failed to save search" });
  }
});

router.get("/search/saved", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const savedSearches = await fhirAdvancedSearch.getSavedSearches(userId);
    res.json({ success: true, data: savedSearches });
  } catch (error) {
    console.error("[AdvMgmt] Error getting saved searches:", error);
    res.status(500).json({ success: false, error: "Failed to get saved searches" });
  }
});

router.post("/search/saved/:searchId/execute", async (req: Request, res: Response) => {
  try {
    const { searchId } = req.params;
    const results = await fhirAdvancedSearch.executeSavedSearch(searchId);

    logHipaaAudit("SAVED_SEARCH_EXECUTED", `saved-search/${searchId}`);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("[AdvMgmt] Error executing saved search:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute saved search",
    });
  }
});

router.delete("/search/saved/:searchId", async (req: Request, res: Response) => {
  try {
    const { searchId } = req.params;
    const userId = getUserId(req);

    await fhirAdvancedSearch.deleteSavedSearch(searchId, userId);

    logHipaaAudit("SAVED_SEARCH_DELETED", `saved-search/${searchId}`, userId);
    res.json({ success: true, message: "Saved search deleted" });
  } catch (error) {
    console.error("[AdvMgmt] Error deleting saved search:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete saved search",
    });
  }
});

router.get("/search/resource-types", async (_req: Request, res: Response) => {
  try {
    const resourceTypes = fhirAdvancedSearch.getResourceTypes();
    res.json({ success: true, data: resourceTypes });
  } catch (error) {
    console.error("[AdvMgmt] Error getting resource types:", error);
    res.status(500).json({ success: false, error: "Failed to get resource types" });
  }
});

router.get("/search/sources", async (_req: Request, res: Response) => {
  try {
    const sources = fhirAdvancedSearch.getSources();
    res.json({ success: true, data: sources });
  } catch (error) {
    console.error("[AdvMgmt] Error getting sources:", error);
    res.status(500).json({ success: false, error: "Failed to get sources" });
  }
});

router.get("/search/fields/:resourceType", async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    const fields = fhirAdvancedSearch.getSearchableFields(resourceType);
    res.json({ success: true, data: fields });
  } catch (error) {
    console.error("[AdvMgmt] Error getting searchable fields:", error);
    res.status(500).json({ success: false, error: "Failed to get searchable fields" });
  }
});

export default router;
