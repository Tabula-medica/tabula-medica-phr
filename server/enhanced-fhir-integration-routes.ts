import { Router, Request, Response } from "express";
import {
  createCustomProfile,
  getCustomProfile,
  getAllCustomProfiles,
  updateCustomProfile,
  deleteCustomProfile,
  createDataSource,
  getDataSource,
  getAllDataSources,
  getDataSourcesByType,
  updateDataSource,
  deleteDataSource,
  getMappingPreset,
  getAllMappingPresets,
  getMappingPresetsByType,
  createMappingPreset,
  transformWearableToFhir,
  transformPharmacyToFhir,
  runTransformationPipeline,
  getTransformationPipeline,
  getRecentPipelines,
  getIntegrationStats,
  getLOINCCodeForWearableType,
  getSupportedWearableDataTypes,
  DataSourceType,
  MappingPresetType,
} from "./services/enhanced-fhir-data-integration";

const router = Router();

const NO_CDS_DISCLAIMER = "This data integration is for informational and interoperability purposes only. It does not constitute medical advice or clinical decision support.";

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = getIntegrationStats();
    res.json({ ...stats, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting stats:", error);
    res.status(500).json({ error: "Failed to get integration statistics" });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const { name, description, baseResourceType, profileUrl, version, status, extensions, customFields, validationRules, mappingHints } = req.body;

    if (!name || !baseResourceType || !profileUrl) {
      return res.status(400).json({ error: "Name, baseResourceType, and profileUrl are required" });
    }

    const profile = createCustomProfile({
      name,
      description: description || "",
      baseResourceType,
      profileUrl,
      version: version || "1.0.0",
      status: status || "draft",
      extensions: extensions || [],
      customFields: customFields || [],
      validationRules: validationRules || [],
      mappingHints: mappingHints || [],
    });

    res.status(201).json({ profile, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error creating profile:", error);
    res.status(500).json({ error: "Failed to create custom profile" });
  }
});

router.get("/profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = getAllCustomProfiles();
    res.json({ profiles, count: profiles.length, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting profiles:", error);
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.get("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = getCustomProfile(profileId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ profile, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting profile:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.put("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const updates = req.body;

    const profile = updateCustomProfile(profileId, updates);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ profile, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.delete("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const deleted = deleteCustomProfile(profileId);

    if (!deleted) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[EnhancedFHIR] Error deleting profile:", error);
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

router.post("/data-sources", async (req: Request, res: Response) => {
  try {
    const { name, description, type, provider, connectionConfig, dataFormat, mappingPresetId, customProfileIds, isActive, syncStatus } = req.body;

    if (!name || !type || !provider) {
      return res.status(400).json({ error: "Name, type, and provider are required" });
    }

    const source = createDataSource({
      name,
      description: description || "",
      type: type as DataSourceType,
      provider,
      connectionConfig: connectionConfig || { authType: "none" },
      dataFormat: dataFormat || "json",
      mappingPresetId,
      customProfileIds: customProfileIds || [],
      isActive: isActive !== false,
      syncStatus: syncStatus || "idle",
    });

    res.status(201).json({ dataSource: source, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error creating data source:", error);
    res.status(500).json({ error: "Failed to create data source" });
  }
});

router.get("/data-sources", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const sources = type ? getDataSourcesByType(type as DataSourceType) : getAllDataSources();
    res.json({ dataSources: sources, count: sources.length, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting data sources:", error);
    res.status(500).json({ error: "Failed to get data sources" });
  }
});

router.get("/data-sources/:sourceId", async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const source = getDataSource(sourceId);

    if (!source) {
      return res.status(404).json({ error: "Data source not found" });
    }

    res.json({ dataSource: source, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting data source:", error);
    res.status(500).json({ error: "Failed to get data source" });
  }
});

router.put("/data-sources/:sourceId", async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const updates = req.body;

    const source = updateDataSource(sourceId, updates);

    if (!source) {
      return res.status(404).json({ error: "Data source not found" });
    }

    res.json({ dataSource: source, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error updating data source:", error);
    res.status(500).json({ error: "Failed to update data source" });
  }
});

router.delete("/data-sources/:sourceId", async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const deleted = deleteDataSource(sourceId);

    if (!deleted) {
      return res.status(404).json({ error: "Data source not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[EnhancedFHIR] Error deleting data source:", error);
    res.status(500).json({ error: "Failed to delete data source" });
  }
});

router.get("/presets", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const presets = type ? getMappingPresetsByType(type as MappingPresetType) : getAllMappingPresets();
    res.json({ presets, count: presets.length, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting presets:", error);
    res.status(500).json({ error: "Failed to get mapping presets" });
  }
});

router.get("/presets/:presetId", async (req: Request, res: Response) => {
  try {
    const { presetId } = req.params;
    const preset = getMappingPreset(presetId);

    if (!preset) {
      return res.status(404).json({ error: "Mapping preset not found" });
    }

    res.json({ preset, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting preset:", error);
    res.status(500).json({ error: "Failed to get mapping preset" });
  }
});

router.post("/presets", async (req: Request, res: Response) => {
  try {
    const { name, description, type, sourceType, targetResourceTypes, mappingRules, codeSystemMappings, validationProfile } = req.body;

    if (!name || !type || !sourceType || !targetResourceTypes) {
      return res.status(400).json({ error: "Name, type, sourceType, and targetResourceTypes are required" });
    }

    const preset = createMappingPreset({
      name,
      description: description || "",
      type: type as MappingPresetType,
      sourceType: sourceType as DataSourceType,
      targetResourceTypes,
      mappingRules: mappingRules || [],
      codeSystemMappings: codeSystemMappings || [],
      validationProfile,
    });

    res.status(201).json({ preset, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error creating preset:", error);
    res.status(500).json({ error: "Failed to create mapping preset" });
  }
});

router.post("/transform/wearable", async (req: Request, res: Response) => {
  try {
    const { patientId, dataType, value, timestamp, deviceId, provider, accuracy } = req.body;

    if (!patientId || !dataType || value === undefined) {
      return res.status(400).json({ error: "PatientId, dataType, and value are required" });
    }

    const result = transformWearableToFhir(patientId, dataType, value, timestamp || new Date().toISOString(), {
      deviceId,
      provider,
      accuracy,
    });

    res.json({ resource: result, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[EnhancedFHIR] Error transforming wearable data:", error);
    res.status(400).json({ error: error.message || "Failed to transform wearable data" });
  }
});

router.post("/transform/pharmacy", async (req: Request, res: Response) => {
  try {
    const { patientId, rxNumber, ndc, drugName, dosage, quantity, refillsRemaining, fillDate, pharmacyName, pharmacyNPI, prescriberId, daysSupply } = req.body;

    if (!patientId || !rxNumber || !ndc || !drugName || !fillDate) {
      return res.status(400).json({ error: "PatientId, rxNumber, ndc, drugName, and fillDate are required" });
    }

    const result = transformPharmacyToFhir(patientId, {
      rxNumber,
      ndc,
      drugName,
      dosage,
      quantity,
      refillsRemaining,
      fillDate,
      pharmacyName,
      pharmacyNPI,
      prescriberId,
      daysSupply,
    });

    res.json({ medicationRequest: result.medicationRequest, medicationDispense: result.medicationDispense, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[EnhancedFHIR] Error transforming pharmacy data:", error);
    res.status(400).json({ error: error.message || "Failed to transform pharmacy data" });
  }
});

router.post("/pipelines/:sourceId/run", async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const { records, profileIds, validateOutput } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Records array is required and must not be empty" });
    }

    const pipeline = await runTransformationPipeline(sourceId, records, { profileIds, validateOutput });

    res.json({
      pipelineId: pipeline.id,
      status: pipeline.status,
      statistics: pipeline.statistics,
      outputResources: pipeline.outputResources,
      errors: pipeline.errors,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error: any) {
    console.error("[EnhancedFHIR] Error running pipeline:", error);
    res.status(400).json({ error: error.message || "Failed to run transformation pipeline" });
  }
});

router.get("/pipelines", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const pipelines = getRecentPipelines(limit);
    res.json({
      pipelines: pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        dataSourceId: p.dataSourceId,
        status: p.status,
        statistics: p.statistics,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      })),
      count: pipelines.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting pipelines:", error);
    res.status(500).json({ error: "Failed to get pipelines" });
  }
});

router.get("/pipelines/:pipelineId", async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const pipeline = getTransformationPipeline(pipelineId);

    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }

    res.json({ pipeline, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting pipeline:", error);
    res.status(500).json({ error: "Failed to get pipeline" });
  }
});

router.get("/loinc/wearable/:dataType", async (req: Request, res: Response) => {
  try {
    const { dataType } = req.params;
    const loincInfo = getLOINCCodeForWearableType(dataType);

    if (!loincInfo) {
      return res.status(404).json({ error: `Unknown wearable data type: ${dataType}`, supportedTypes: getSupportedWearableDataTypes() });
    }

    res.json({ ...loincInfo, dataType, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting LOINC code:", error);
    res.status(500).json({ error: "Failed to get LOINC code" });
  }
});

router.get("/loinc/wearable", async (_req: Request, res: Response) => {
  try {
    const dataTypes = getSupportedWearableDataTypes();
    const mappings = dataTypes.map((type) => ({
      dataType: type,
      ...getLOINCCodeForWearableType(type),
    }));
    res.json({ mappings, count: mappings.length, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[EnhancedFHIR] Error getting LOINC mappings:", error);
    res.status(500).json({ error: "Failed to get LOINC mappings" });
  }
});

export default router;
