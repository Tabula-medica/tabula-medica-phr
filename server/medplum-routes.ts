import { Router, Request, Response } from "express";
import { z } from "zod";
import { medplumService } from "./services/medplum-client-service";
import { summarizePatient } from "./summarizer";
import {
  requireProEntitlement,
  gateWithPreview,
  maskSummaryForFreeUser,
  maskFhirBundleForFreeUser,
  GatedRequest,
} from "./middleware/revenuecat-gatekeeper";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await medplumService.getStatus();
    res.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

const searchPatientsSchema = z.object({
  name: z.string().optional(),
  identifier: z.string().optional(),
  birthdate: z.string().optional(),
  gender: z.string().optional(),
  _count: z.coerce.number().min(1).max(100).optional(),
  _offset: z.coerce.number().min(0).optional(),
});

router.get("/Patient", async (req: Request, res: Response) => {
  try {
    const params = searchPatientsSchema.parse(req.query);
    const bundle = await medplumService.searchPatients(params);
    res.json(bundle);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

router.get("/Patient/:id", async (req: Request, res: Response) => {
  try {
    const patient = await medplumService.getPatient(req.params.id);
    res.json(patient);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get(
  "/Patient/:id/$everything",
  gateWithPreview({ generatePreview: maskFhirBundleForFreeUser }),
  async (req: GatedRequest, res: Response) => {
    try {
      const bundle = await medplumService.getPatientEverything(req.params.id);

      if (req.entitlement && !req.entitlement.entitled) {
        return res.status(200).json(maskFhirBundleForFreeUser(bundle));
      }

      res.json(bundle);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  }
);

const summarizeSchema = z.object({
  patientId: z.string().min(1),
  revenueCatCustomerId: z.string().min(1),
});

router.post(
  "/summarize",
  requireProEntitlement(),
  async (req: GatedRequest, res: Response) => {
    try {
      const { patientId } = summarizeSchema.parse(req.body);
      const result = await summarizePatient(patientId);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("No FHIR resources") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

router.post(
  "/summarize/preview",
  gateWithPreview({ generatePreview: maskSummaryForFreeUser }),
  async (req: GatedRequest, res: Response) => {
    try {
      const { patientId } = summarizeSchema.parse(req.body);
      const result = await summarizePatient(patientId);

      if (req.entitlement && !req.entitlement.entitled) {
        return res.status(200).json(maskSummaryForFreeUser(result));
      }

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("No FHIR resources") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

const searchResourcesSchema = z.object({
  _count: z.coerce.number().min(1).max(100).optional(),
  _offset: z.coerce.number().min(0).optional(),
});

router.get("/:resourceType", async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    const baseParams = searchResourcesSchema.parse(req.query);
    const queryParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === "string") queryParams[key] = val;
    }
    const bundle = await medplumService.searchResources(resourceType, queryParams);
    res.json(bundle);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(err instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

router.get("/:resourceType/:id", async (req: Request, res: Response) => {
  try {
    const resource = await medplumService.getResource(req.params.resourceType, req.params.id);
    res.json(resource);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/:resourceType", async (req: Request, res: Response) => {
  try {
    const resource = { ...req.body, resourceType: req.params.resourceType };
    const created = await medplumService.createResource(resource);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put("/:resourceType/:id", async (req: Request, res: Response) => {
  try {
    const resource = { ...req.body, resourceType: req.params.resourceType, id: req.params.id };
    const updated = await medplumService.updateResource(resource);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
