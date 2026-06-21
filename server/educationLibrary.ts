import { Router, Request, Response } from "express";
import * as educationService from "./services/educationLibraryService";
import {
  libraryContentGenerationRequestSchema,
  contentApprovalActionSchema,
  libraryContentFilterSchema,
} from "@shared/schema";

const router = Router();

router.get("/content", async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as any,
      category: req.query.category as any,
      status: req.query.status as any,
      readingLevel: req.query.readingLevel as any,
      aiGenerated: req.query.aiGenerated === "true" ? true : req.query.aiGenerated === "false" ? false : undefined,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    
    const content = educationService.getAllContent(filters);
    res.json({ content, total: content.length });
  } catch (error: any) {
    console.error("[EducationLibrary] Error fetching content:", error);
    res.status(500).json({ error: "Failed to fetch education content" });
  }
});

router.get("/content/:id", async (req: Request, res: Response) => {
  try {
    const content = educationService.getContentById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    
    educationService.recordContentView(req.params.id);
    res.json(content);
  } catch (error: any) {
    console.error("[EducationLibrary] Error fetching content:", error);
    res.status(500).json({ error: "Failed to fetch content" });
  }
});

router.get("/faqs", async (req: Request, res: Response) => {
  try {
    const filters = {
      category: req.query.category as any,
      status: req.query.status as any,
      search: req.query.search as string,
    };
    
    const faqs = educationService.getAllFAQs(filters);
    res.json({ faqs, total: faqs.length });
  } catch (error: any) {
    console.error("[EducationLibrary] Error fetching FAQs:", error);
    res.status(500).json({ error: "Failed to fetch FAQs" });
  }
});

router.get("/faqs/:id", async (req: Request, res: Response) => {
  try {
    const faq = educationService.getFAQById(req.params.id);
    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }
    
    educationService.recordFAQView(req.params.id);
    res.json(faq);
  } catch (error: any) {
    console.error("[EducationLibrary] Error fetching FAQ:", error);
    res.status(500).json({ error: "Failed to fetch FAQ" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = educationService.getCurationStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[EducationLibrary] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch curation stats" });
  }
});

router.post("/generate/article", async (req: Request, res: Response) => {
  try {
    const parseResult = libraryContentGenerationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
    }
    
    const request = parseResult.data;
    const user = (req as any).user;
    const generatedBy = user?.claims?.sub || "care-team-member";
    
    console.log(`[EducationLibrary] Generating article: ${request.topic}`);
    const generatedArticle = await educationService.generateArticle(request);
    const content = educationService.createEducationContent(generatedArticle, request, generatedBy);
    
    res.json({ 
      message: "Article generated and submitted for review",
      content,
      generated: generatedArticle,
    });
  } catch (error: any) {
    console.error("[EducationLibrary] Error generating article:", error);
    res.status(500).json({ error: "Failed to generate article" });
  }
});

router.post("/generate/faqs", async (req: Request, res: Response) => {
  try {
    const parseResult = libraryContentGenerationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
    }
    
    const request = parseResult.data;
    const count = req.body.count || 5;
    const user = (req as any).user;
    const generatedBy = user?.claims?.sub || "care-team-member";
    
    console.log(`[EducationLibrary] Generating ${count} FAQs: ${request.topic}`);
    const generatedFAQs = await educationService.generateFAQs(request, count);
    
    const createdFAQs = generatedFAQs.faqs.map(faq => 
      educationService.createFAQFromGenerated(faq, request, generatedBy)
    );
    
    res.json({ 
      message: `${createdFAQs.length} FAQs generated and submitted for review`,
      faqs: createdFAQs,
      generated: generatedFAQs,
    });
  } catch (error: any) {
    console.error("[EducationLibrary] Error generating FAQs:", error);
    res.status(500).json({ error: "Failed to generate FAQs" });
  }
});

router.post("/generate/video-script", async (req: Request, res: Response) => {
  try {
    const parseResult = libraryContentGenerationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
    }
    
    const request = parseResult.data;
    console.log(`[EducationLibrary] Generating video script: ${request.topic}`);
    
    const videoScript = await educationService.generateVideoScript(request);
    
    res.json({ 
      message: "Video script generated",
      script: videoScript,
    });
  } catch (error: any) {
    console.error("[EducationLibrary] Error generating video script:", error);
    res.status(500).json({ error: "Failed to generate video script" });
  }
});

router.post("/content/:id/approve", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const approvedBy = user?.claims?.sub || "care-team-admin";
    const notes = req.body.notes;
    
    const content = educationService.approveContent(req.params.id, approvedBy, notes);
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    
    res.json({ message: "Content approved", content });
  } catch (error: any) {
    console.error("[EducationLibrary] Error approving content:", error);
    res.status(500).json({ error: "Failed to approve content" });
  }
});

router.post("/content/:id/reject", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const rejectedBy = user?.claims?.sub || "care-team-admin";
    const reason = req.body.reason || "Content did not meet quality standards";
    
    const content = educationService.rejectContent(req.params.id, rejectedBy, reason);
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    
    res.json({ message: "Content rejected", content });
  } catch (error: any) {
    console.error("[EducationLibrary] Error rejecting content:", error);
    res.status(500).json({ error: "Failed to reject content" });
  }
});

router.post("/faqs/:id/approve", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const approvedBy = user?.claims?.sub || "care-team-admin";
    
    const faq = educationService.approveFAQ(req.params.id, approvedBy);
    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }
    
    res.json({ message: "FAQ approved", faq });
  } catch (error: any) {
    console.error("[EducationLibrary] Error approving FAQ:", error);
    res.status(500).json({ error: "Failed to approve FAQ" });
  }
});

router.post("/faqs/:id/reject", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const rejectedBy = user?.claims?.sub || "care-team-admin";
    const reason = req.body.reason || "FAQ did not meet quality standards";
    
    const faq = educationService.rejectFAQ(req.params.id, rejectedBy, reason);
    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }
    
    res.json({ message: "FAQ rejected", faq });
  } catch (error: any) {
    console.error("[EducationLibrary] Error rejecting FAQ:", error);
    res.status(500).json({ error: "Failed to reject FAQ" });
  }
});

router.post("/content/:id/feedback", async (req: Request, res: Response) => {
  try {
    const helpful = req.body.helpful === true;
    educationService.recordContentFeedback(req.params.id, helpful);
    res.json({ message: "Feedback recorded" });
  } catch (error: any) {
    console.error("[EducationLibrary] Error recording feedback:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

router.post("/faqs/:id/feedback", async (req: Request, res: Response) => {
  try {
    const helpful = req.body.helpful === true;
    educationService.recordFAQFeedback(req.params.id, helpful);
    res.json({ message: "Feedback recorded" });
  } catch (error: any) {
    console.error("[EducationLibrary] Error recording feedback:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

export default router;
