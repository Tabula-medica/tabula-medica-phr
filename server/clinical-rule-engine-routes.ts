import { Router, Request, Response } from "express";
import { 
  clinicalRuleTemplateEngine, 
  RuleDomain, 
  PopulationView,
  PatientContext 
} from "./services/clinical-rule-template-engine";

const router = Router();

router.get("/metadata", async (req: Request, res: Response) => {
  try {
    const metadata = await clinicalRuleTemplateEngine.getEngineMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting metadata:", error);
    res.status(500).json({ error: "Failed to get engine metadata" });
  }
});

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const domain = req.query.domain as RuleDomain | undefined;
    
    const rules = await clinicalRuleTemplateEngine.getRuleTemplates(userId, domain);
    res.json({ 
      rules,
      count: rules.length,
      disclaimer: "This information is for educational purposes only and does NOT constitute medical advice."
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting rules:", error);
    res.status(500).json({ error: "Failed to get rule templates" });
  }
});

router.get("/rules/:ruleId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { ruleId } = req.params;
    
    const rule = await clinicalRuleTemplateEngine.getRuleTemplate(userId, ruleId);
    if (!rule) {
      return res.status(404).json({ error: "Rule template not found" });
    }
    res.json({ 
      rule,
      disclaimer: "This information is for educational purposes only and does NOT constitute medical advice."
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting rule:", error);
    res.status(500).json({ error: "Failed to get rule template" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const template = req.body;
    
    if (!template.domain || !template.name) {
      return res.status(400).json({ error: "domain and name are required" });
    }
    
    const rule = await clinicalRuleTemplateEngine.createRuleTemplate(userId, template);
    res.status(201).json({ 
      rule,
      message: "Rule template created successfully"
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error creating rule:", error);
    res.status(500).json({ error: "Failed to create rule template" });
  }
});

router.patch("/rules/:ruleId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { ruleId } = req.params;
    const updates = req.body;
    
    const rule = await clinicalRuleTemplateEngine.updateRuleTemplate(userId, ruleId, updates);
    if (!rule) {
      return res.status(404).json({ error: "Rule template not found" });
    }
    res.json({ 
      rule,
      message: "Rule template updated successfully"
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error updating rule:", error);
    res.status(500).json({ error: "Failed to update rule template" });
  }
});

router.get("/citations", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const ruleId = req.query.ruleId as string | undefined;
    
    const citations = await clinicalRuleTemplateEngine.getCitations(userId, ruleId);
    res.json({ 
      citations,
      count: citations.length,
      disclaimer: "Citations are provided for reference. Always verify with authoritative sources."
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting citations:", error);
    res.status(500).json({ error: "Failed to get citations" });
  }
});

router.post("/generate-tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientContext } = req.body;
    
    if (!patientContext || !patientContext.patientId || !patientContext.profileId) {
      return res.status(400).json({ error: "patientContext with patientId and profileId is required" });
    }
    
    const context: PatientContext = {
      patientId: patientContext.patientId,
      profileId: patientContext.profileId,
      dateOfBirth: patientContext.dateOfBirth || new Date().toISOString(),
      ageMonths: patientContext.ageMonths || 0,
      ageYears: patientContext.ageYears || 0,
      conditions: patientContext.conditions || [],
      medications: patientContext.medications || [],
      allergies: patientContext.allergies || [],
      riskFlags: patientContext.riskFlags || [],
      labResults: patientContext.labResults || [],
      procedures: patientContext.procedures || [],
      immunizations: patientContext.immunizations || [],
      familyHistory: patientContext.familyHistory || [],
      isPregnant: patientContext.isPregnant || false,
      populationView: patientContext.populationView || "standard"
    };
    
    const result = await clinicalRuleTemplateEngine.generateTasksForPatient(userId, context);
    res.json(result);
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error generating tasks:", error);
    res.status(500).json({ error: "Failed to generate tasks" });
  }
});

router.get("/tasks/:patientId/:profileId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId, profileId } = req.params;
    
    const tasks = await clinicalRuleTemplateEngine.getGeneratedTasks(userId, patientId, profileId);
    res.json({ 
      tasks,
      count: tasks.length,
      disclaimer: "This information is for educational purposes only and does NOT constitute medical advice."
    });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting tasks:", error);
    res.status(500).json({ error: "Failed to get generated tasks" });
  }
});

router.get("/domains", async (req: Request, res: Response) => {
  try {
    const domains: { id: RuleDomain; name: string; description: string }[] = [
      { id: "diabetes_screening", name: "Diabetes Screening", description: "A1c tests, eye exams, foot exams, kidney labs per ADA guidelines" },
      { id: "vaccine_reminder", name: "Vaccine Reminders", description: "Flu, COVID, pneumonia, shingles vaccines per CDC/ACIP guidelines" },
      { id: "cancer_followup", name: "Cancer Follow-up", description: "Survivorship visits, surveillance labs per ASCO/NCCN guidelines" },
      { id: "pediatric_schedule", name: "Pediatric Schedule", description: "Well-child visits, developmental screenings per AAP Bright Futures" },
      { id: "geriatric_care", name: "Geriatric Care", description: "Medication reviews, falls prevention, cognitive screening per AGS guidelines" },
      { id: "preventive_care", name: "Preventive Care", description: "Cancer screenings, wellness visits per USPSTF recommendations" },
      { id: "chronic_disease", name: "Chronic Disease", description: "Condition-specific monitoring and management tasks" },
      { id: "medication_adherence", name: "Medication Adherence", description: "Refill reminders, drug interaction checks" }
    ];
    res.json({ domains });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting domains:", error);
    res.status(500).json({ error: "Failed to get domains" });
  }
});

router.get("/populations", async (req: Request, res: Response) => {
  try {
    const populations: { id: PopulationView; name: string; description: string; features: string[] }[] = [
      { 
        id: "standard", 
        name: "Standard View", 
        description: "Default view for general adult patients",
        features: ["Full detail", "Standard text size", "All features"]
      },
      { 
        id: "pediatric", 
        name: "Pediatric View", 
        description: "Optimized for children and adolescents",
        features: ["Age-appropriate language", "Parent/guardian focus", "Developmental milestones"]
      },
      { 
        id: "geriatric", 
        name: "Geriatric View", 
        description: "Senior-friendly with simplified content",
        features: ["Large text", "Simplified language", "Voice enabled", "High contrast", "Medication focus"]
      },
      { 
        id: "caregiver", 
        name: "Caregiver View", 
        description: "For family caregivers managing care",
        features: ["Multi-profile support", "Care coordination", "Reminder management"]
      },
      { 
        id: "accessibility", 
        name: "Accessibility View", 
        description: "Enhanced for users with disabilities",
        features: ["Screen reader optimized", "High contrast", "Keyboard navigation"]
      },
      { 
        id: "oncology", 
        name: "Oncology View", 
        description: "Cancer-specific features and tracking",
        features: ["Treatment timeline", "Symptom tracking", "Survivorship focus"]
      }
    ];
    res.json({ populations });
  } catch (error) {
    console.error("[ClinicalRuleEngine] Error getting populations:", error);
    res.status(500).json({ error: "Failed to get populations" });
  }
});

export function registerClinicalRuleEngineRoutes(app: any) {
  app.use("/api/clinical-rules", router);
  console.log("[ClinicalRuleEngine] Routes registered at /api/clinical-rules/*");
  console.log("[ClinicalRuleEngine] Endpoints: /metadata, /rules, /citations, /generate-tasks, /tasks, /domains, /populations");
}
