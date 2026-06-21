import { Router, type Request, type Response } from "express";
import { hitrustCSFMappingService } from "../services/hitrust-csf-mapping-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json(hitrustCSFMappingService.getMetadata());
});

router.get("/dashboard", (_req: Request, res: Response) => {
  res.json(hitrustCSFMappingService.getDashboard());
});

router.get("/controls", (req: Request, res: Response) => {
  const { domainId, status, riskRating } = req.query;
  const controls = hitrustCSFMappingService.getControls({
    domainId: domainId as string,
    status: status as string,
    riskRating: riskRating as string,
  });
  res.json({ controls, total: controls.length });
});

router.get("/controls/:controlId", (req: Request, res: Response) => {
  const control = hitrustCSFMappingService.getControlById(req.params.controlId);
  if (!control) {
    return res.status(404).json({ error: "Control not found" });
  }
  res.json(control);
});

router.get("/domains", (_req: Request, res: Response) => {
  res.json({ domains: hitrustCSFMappingService.getDomains() });
});

router.get("/assessments", (_req: Request, res: Response) => {
  res.json({ assessments: hitrustCSFMappingService.getAssessments() });
});

router.get("/cross-framework-mapping", (_req: Request, res: Response) => {
  res.json({ mappings: hitrustCSFMappingService.getCrossFrameworkMapping() });
});

router.get("/gap-analysis", (_req: Request, res: Response) => {
  res.json(hitrustCSFMappingService.getGapAnalysis());
});

export default router;
