import { Router, Request, Response } from "express";
import {
  generateRecommendations,
  getPatientRecommendations,
  getAllRecommendations,
  updateRecommendationStatus,
  getRecommendationStats,
  RecommendationContext,
} from "./services/educationRecommendationService";

const router = Router();

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const context: RecommendationContext = req.body;
    
    if (!context.patient || !context.patient.id) {
      return res.status(400).json({ error: "Patient information is required" });
    }

    const recommendations = await generateRecommendations(context);
    res.json(recommendations);
  } catch (error) {
    console.error("[EducationRecommendation] Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const recommendations = getPatientRecommendations(req.params.patientId);
    if (!recommendations) {
      return res.status(404).json({ error: "No recommendations found for this patient" });
    }
    res.json(recommendations);
  } catch (error) {
    console.error("[EducationRecommendation] Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.get("/all", async (req: Request, res: Response) => {
  try {
    const allRecommendations = getAllRecommendations();
    res.json(allRecommendations);
  } catch (error) {
    console.error("[EducationRecommendation] Error fetching all recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = getRecommendationStats();
    res.json(stats);
  } catch (error) {
    console.error("[EducationRecommendation] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch recommendation stats" });
  }
});

router.post("/patient/:patientId/recommendation/:recommendationId/status", async (req: Request, res: Response) => {
  try {
    const { patientId, recommendationId } = req.params;
    const { status } = req.body;

    if (!["viewed", "dismissed", "helpful", "not_helpful"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be: viewed, dismissed, helpful, or not_helpful" });
    }

    const updated = updateRecommendationStatus(patientId, recommendationId, status);
    if (!updated) {
      return res.status(404).json({ error: "Recommendation not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("[EducationRecommendation] Error updating status:", error);
    res.status(500).json({ error: "Failed to update recommendation status" });
  }
});

router.post("/generate-for-patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { conditions, medications, allergies, riskLevel, carePlans, recentInteractions, preferences } = req.body;

    const context: RecommendationContext = {
      patient: {
        id: patientId,
        name: req.body.patientName || "Patient",
        conditions: conditions || [],
        activeMedications: medications || [],
        allergies: allergies || [],
        riskLevel: riskLevel || "low",
        riskFactors: req.body.riskFactors || [],
      },
      carePlans: carePlans || [],
      recentInteractions: recentInteractions || [],
      viewedContentIds: req.body.viewedContentIds || [],
      preferences: preferences || {},
    };

    const recommendations = await generateRecommendations(context);
    res.json(recommendations);
  } catch (error) {
    console.error("[EducationRecommendation] Error generating for patient:", error);
    res.status(500).json({ error: "Failed to generate recommendations for patient" });
  }
});

export default router;
