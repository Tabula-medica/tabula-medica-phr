import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirCustomMappingEngine } from "./services/fhir-custom-mapping-engine";

const router = Router();

/**
 * FHIR Custom Mapping Routes
 * 
 * Provides API endpoints for managing custom FHIR mappings,
 * custom profiles, and mapping execution.
 */

// Validation schemas
const fhirVersionSchema = z.enum(["R4", "R5"]);

const fieldMappingSchema = z.object({
  id: z.string(),
  sourceField: z.string(),
  targetField: z.string(),
  dataType: z.string(),
  required: z.boolean(),
  transformation: z.object({
    type: z.string(),
    params: z.record(z.any())
  }).optional(),
  defaultValue: z.any().optional(),
  condition: z.object({
    field: z.string(),
    operator: z.enum(["equals", "not_equals", "contains", "exists", "not_exists"]),
    value: z.any().optional()
  }).optional()
});

const createMappingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  version: z.string().default("1.0.0"),
  fhirVersion: fhirVersionSchema,
  sourceEntityType: z.string().min(1, "Source entity type is required"),
  targetResourceType: z.string().min(1, "Target resource type is required"),
  targetProfile: z.string().optional(),
  fieldMappings: z.array(fieldMappingSchema).default([]),
  extensionMappings: z.array(z.any()).default([]),
  nestedMappings: z.array(z.any()).default([]),
  validationRules: z.array(z.any()).default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  createdBy: z.string().default("user")
});

const updateMappingSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  fhirVersion: fhirVersionSchema.optional(),
  sourceEntityType: z.string().optional(),
  targetResourceType: z.string().optional(),
  targetProfile: z.string().optional(),
  fieldMappings: z.array(fieldMappingSchema).optional(),
  extensionMappings: z.array(z.any()).optional(),
  nestedMappings: z.array(z.any()).optional(),
  validationRules: z.array(z.any()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

const createProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  fhirVersion: fhirVersionSchema,
  baseResourceType: z.string().min(1, "Base resource type is required"),
  profileUrl: z.string().url("Profile URL must be a valid URL"),
  constraints: z.array(z.any()).default([]),
  extensions: z.array(z.any()).default([]),
  mustSupportFields: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fhirVersion: fhirVersionSchema.optional(),
  baseResourceType: z.string().optional(),
  profileUrl: z.string().url().optional(),
  constraints: z.array(z.any()).optional(),
  extensions: z.array(z.any()).optional(),
  mustSupportFields: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

const executeMappingSchema = z.object({
  mappingId: z.string().min(1, "mappingId is required"),
  sourceEntity: z.record(z.any())
});

const executeByTypeSchema = z.object({
  sourceEntityType: z.string().min(1, "sourceEntityType is required"),
  sourceEntity: z.record(z.any()),
  fhirVersion: fhirVersionSchema.optional()
});

// Get service metadata
router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    service: "FHIR Custom Mapping Engine",
    version: "1.0.0",
    fhirVersions: ["R4", "R5"],
    dataTypes: fhirCustomMappingEngine.getDataTypes(),
    transformationTypes: fhirCustomMappingEngine.getTransformationTypes(),
    localEntityTypes: fhirCustomMappingEngine.getLocalEntityTypes()
  });
});

// Get statistics
router.get("/statistics", (req: Request, res: Response) => {
  const stats = fhirCustomMappingEngine.getStatistics();
  res.json(stats);
});

// Mapping CRUD
router.get("/mappings", (req: Request, res: Response) => {
  const fhirVersion = req.query.fhirVersion as "R4" | "R5" | undefined;
  if (fhirVersion && fhirVersion !== "R4" && fhirVersion !== "R5") {
    return res.status(400).json({ error: "Invalid FHIR version" });
  }
  const mappings = fhirCustomMappingEngine.getMappings(fhirVersion);
  res.json(mappings);
});

router.get("/mappings/:id", (req: Request, res: Response) => {
  const mapping = fhirCustomMappingEngine.getMapping(req.params.id);
  if (!mapping) {
    return res.status(404).json({ error: "Mapping not found" });
  }
  res.json(mapping);
});

router.post("/mappings", (req: Request, res: Response) => {
  try {
    const parsed = createMappingSchema.parse(req.body);
    const mapping = fhirCustomMappingEngine.createMapping(parsed);
    res.status(201).json(mapping);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put("/mappings/:id", (req: Request, res: Response) => {
  try {
    const parsed = updateMappingSchema.parse(req.body);
    const mapping = fhirCustomMappingEngine.updateMapping(req.params.id, parsed);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete("/mappings/:id", (req: Request, res: Response) => {
  try {
    const deleted = fhirCustomMappingEngine.deleteMapping(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Profile CRUD
router.get("/profiles", (req: Request, res: Response) => {
  const fhirVersion = req.query.fhirVersion as "R4" | "R5" | undefined;
  if (fhirVersion && fhirVersion !== "R4" && fhirVersion !== "R5") {
    return res.status(400).json({ error: "Invalid FHIR version" });
  }
  const profiles = fhirCustomMappingEngine.getProfiles(fhirVersion);
  res.json(profiles);
});

router.get("/profiles/:id", (req: Request, res: Response) => {
  const profile = fhirCustomMappingEngine.getProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found" });
  }
  res.json(profile);
});

router.post("/profiles", (req: Request, res: Response) => {
  try {
    const parsed = createProfileSchema.parse(req.body);
    const profile = fhirCustomMappingEngine.createProfile(parsed);
    res.status(201).json(profile);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put("/profiles/:id", (req: Request, res: Response) => {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    const profile = fhirCustomMappingEngine.updateProfile(req.params.id, parsed);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete("/profiles/:id", (req: Request, res: Response) => {
  const deleted = fhirCustomMappingEngine.deleteProfile(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Profile not found" });
  }
  res.json({ success: true });
});

// Templates
router.get("/templates", (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const templates = fhirCustomMappingEngine.getTemplates(category);
  res.json(templates);
});

router.get("/templates/:id", (req: Request, res: Response) => {
  const template = fhirCustomMappingEngine.getTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json(template);
});

router.post("/templates/:id/create-mapping", (req: Request, res: Response) => {
  try {
    const mapping = fhirCustomMappingEngine.createMappingFromTemplate(
      req.params.id,
      req.body
    );
    res.status(201).json(mapping);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Execute mapping
router.post("/execute", (req: Request, res: Response) => {
  try {
    const parsed = executeMappingSchema.parse(req.body);
    const result = fhirCustomMappingEngine.executeMapping(
      parsed.mappingId, 
      parsed.sourceEntity
    );
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

// Execute mapping by source entity type
router.post("/execute-by-type", (req: Request, res: Response) => {
  try {
    const parsed = executeByTypeSchema.parse(req.body);
    
    const mapping = fhirCustomMappingEngine.getMappingBySource(
      parsed.sourceEntityType,
      parsed.fhirVersion || "R4"
    );

    if (!mapping) {
      return res.status(404).json({
        error: `No active mapping found for source type: ${parsed.sourceEntityType}`
      });
    }

    const result = fhirCustomMappingEngine.executeMapping(mapping.id, parsed.sourceEntity);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

// Get available FHIR resources for a version
router.get("/resources/:version", (req: Request, res: Response) => {
  const version = req.params.version as "R4" | "R5";
  if (version !== "R4" && version !== "R5") {
    return res.status(400).json({ error: "Invalid FHIR version" });
  }
  
  const resources = fhirCustomMappingEngine.getAvailableResources(version);
  res.json(resources);
});

// Get fields for a resource type
router.get("/resources/:version/:resourceType/fields", (req: Request, res: Response) => {
  const fields = fhirCustomMappingEngine.getResourceFields(req.params.resourceType);
  res.json(fields);
});

// Validate a mapping configuration with bidirectional sync checks
router.post("/mappings/:id/validate", (req: Request, res: Response) => {
  try {
    const mapping = fhirCustomMappingEngine.getMapping(req.params.id);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }

    const errors: Array<{ field: string; message: string; severity: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const syncIssues: Array<{ type: string; message: string; severity: string }> = [];

    // === BASIC MAPPING VALIDATION ===
    
    // Validate required field mappings exist
    if (mapping.fieldMappings.length === 0) {
      warnings.push({ field: "fieldMappings", message: "No field mappings defined" });
    }

    // Check for duplicate target fields
    const targetFields = new Set<string>();
    const sourceFields = new Set<string>();
    for (const fm of mapping.fieldMappings) {
      if (targetFields.has(fm.targetField)) {
        errors.push({ 
          field: fm.targetField, 
          message: `Duplicate target field: ${fm.targetField}`, 
          severity: "error" 
        });
      }
      targetFields.add(fm.targetField);
      sourceFields.add(fm.sourceField);

      // Validate required field has source
      if (fm.required && !fm.sourceField && !fm.defaultValue) {
        errors.push({ 
          field: fm.sourceField, 
          message: `Required field ${fm.targetField} has no source or default value`, 
          severity: "error" 
        });
      }
    }

    // Check validation rules reference existing fields
    for (const rule of mapping.validationRules) {
      const hasField = mapping.fieldMappings.some(fm => fm.targetField === rule.field);
      if (!hasField) {
        warnings.push({ 
          field: rule.field, 
          message: `Validation rule references non-existent field: ${rule.field}` 
        });
      }
    }

    // === BIDIRECTIONAL SYNC VALIDATION ===
    
    // 1. Check for reciprocal mapping (import/export roundtrip capability)
    const allMappings = fhirCustomMappingEngine.getMappings();
    const hasReciprocalMapping = allMappings.some(m => 
      m.id !== mapping.id && 
      m.sourceEntityType === mapping.targetResourceType && 
      m.targetResourceType === mapping.sourceEntityType
    );
    
    if (!hasReciprocalMapping) {
      syncIssues.push({
        type: "missing_reciprocal",
        message: `No reciprocal mapping found for ${mapping.targetResourceType} -> ${mapping.sourceEntityType}. Bidirectional sync may lose data.`,
        severity: "warning"
      });
    }

    // 2. Check for data loss risk in transformations
    for (const fm of mapping.fieldMappings) {
      if (fm.transformation) {
        // One-way transformations that may cause data loss
        if (fm.transformation.type === "concat") {
          syncIssues.push({
            type: "irreversible_transform",
            message: `Field '${fm.targetField}' uses concat transformation which cannot be reversed on import.`,
            severity: "warning"
          });
        }
        if (fm.transformation.type === "uppercase" || fm.transformation.type === "lowercase") {
          syncIssues.push({
            type: "case_loss",
            message: `Field '${fm.targetField}' uses ${fm.transformation.type} transformation - original case will be lost on roundtrip.`,
            severity: "info"
          });
        }
        if (fm.transformation.type === "custom_script") {
          syncIssues.push({
            type: "unverified_script",
            message: `Field '${fm.targetField}' uses custom script - ensure script is reversible for bidirectional sync.`,
            severity: "warning"
          });
        }
      }
    }

    // 3. Check FHIR required fields coverage
    const fhirRequiredFields: Record<string, string[]> = {
      Patient: ["resourceType", "id"],
      Observation: ["resourceType", "status", "code"],
      Condition: ["resourceType", "clinicalStatus", "subject"],
      MedicationRequest: ["resourceType", "status", "intent", "medication[x]", "subject"],
      Procedure: ["resourceType", "status", "code", "subject"],
      Encounter: ["resourceType", "status", "class", "type"],
      AllergyIntolerance: ["resourceType", "clinicalStatus", "patient"],
      Immunization: ["resourceType", "status", "vaccineCode", "patient", "occurrence[x]"],
      DiagnosticReport: ["resourceType", "status", "code"],
      CarePlan: ["resourceType", "status", "intent", "subject"]
    };

    const requiredForResource = fhirRequiredFields[mapping.targetResourceType] || [];
    for (const reqField of requiredForResource) {
      const hasMappingForField = mapping.fieldMappings.some(fm => 
        fm.targetField === reqField || fm.targetField.startsWith(reqField + ".")
      );
      if (!hasMappingForField && reqField !== "resourceType") {
        syncIssues.push({
          type: "missing_required_fhir_field",
          message: `FHIR ${mapping.targetResourceType} requires '${reqField}' but no mapping is defined.`,
          severity: "error"
        });
      }
    }

    // 4. Check for identifier consistency (critical for sync)
    const hasIdMapping = mapping.fieldMappings.some(fm => fm.targetField === "id" || fm.targetField.includes("identifier"));
    if (!hasIdMapping) {
      syncIssues.push({
        type: "missing_identifier",
        message: "No identifier mapping defined. Resources cannot be tracked for bidirectional sync without identifiers.",
        severity: "error"
      });
    }

    // 5. Import/Export consistency check - verify field coverage
    const exportOnlyFields = mapping.fieldMappings.filter(fm => fm.required && !fm.defaultValue);
    if (exportOnlyFields.length > 0 && !hasReciprocalMapping) {
      syncIssues.push({
        type: "export_only_fields",
        message: `${exportOnlyFields.length} required field(s) may fail on import without source data.`,
        severity: "warning"
      });
    }

    // Count sync issues by severity
    const syncErrors = syncIssues.filter(i => i.severity === "error");
    const syncWarnings = syncIssues.filter(i => i.severity === "warning");

    // Calculate quality score including sync issues
    const baseScore = 100;
    const errorPenalty = (errors.length + syncErrors.length) * 15;
    const warningPenalty = (warnings.length + syncWarnings.length) * 5;
    const fieldBonus = Math.min(mapping.fieldMappings.length * 2, 20);
    const reciprocalBonus = hasReciprocalMapping ? 10 : 0;
    const score = Math.max(0, Math.min(100, baseScore - errorPenalty - warningPenalty + fieldBonus + reciprocalBonus));

    res.json({
      valid: errors.length === 0 && syncErrors.length === 0,
      mappingId: req.params.id,
      errors: [...errors, ...syncErrors.map(e => ({ field: e.type, message: e.message, severity: e.severity }))],
      warnings: [...warnings, ...syncWarnings.map(w => ({ field: w.type, message: w.message }))],
      syncValidation: {
        hasReciprocalMapping,
        syncIssues,
        importExportConsistent: syncErrors.length === 0,
        bidirectionalReady: syncErrors.length === 0 && syncWarnings.length < 3
      },
      score
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get validation results for all mappings
router.get("/validation-results", (req: Request, res: Response) => {
  const mappings = fhirCustomMappingEngine.getMappings();
  const results: Record<string, any> = {};

  for (const mapping of mappings) {
    const errors: Array<{ field: string; message: string; severity: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (mapping.fieldMappings.length === 0) {
      warnings.push({ field: "fieldMappings", message: "No field mappings defined" });
    }

    const targetFields = new Set<string>();
    for (const fm of mapping.fieldMappings) {
      if (targetFields.has(fm.targetField)) {
        errors.push({ field: fm.targetField, message: `Duplicate target field`, severity: "error" });
      }
      targetFields.add(fm.targetField);
    }

    const score = Math.max(0, Math.min(100, 100 - errors.length * 15 - warnings.length * 5 + Math.min(mapping.fieldMappings.length * 2, 20)));

    results[mapping.id] = {
      valid: errors.length === 0,
      mappingId: mapping.id,
      errors,
      warnings,
      score
    };
  }

  res.json(results);
});

// PATCH endpoint for partial updates
router.patch("/mappings/:id", (req: Request, res: Response) => {
  try {
    const parsed = updateMappingSchema.parse(req.body);
    const mapping = fhirCustomMappingEngine.updateMapping(req.params.id, parsed);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

export function registerFHIRCustomMappingRoutes(app: any): void {
  app.use("/api/fhir-mapping", router);
  console.log("[Routes] FHIR Custom Mapping routes registered at /api/fhir-mapping/*");
}
