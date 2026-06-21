import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiProactivePatientEngagementChatbotService } from "./services/ai-proactive-patient-engagement-chatbot-service";

const router = Router();

const NO_CDS_COMPLIANCE = 'INFORMATIONAL ONLY - AI-generated content for patient engagement purposes. Not intended for clinical decision-making.';

const chatMessageSchema = z.object({
  conversationId: z.string(),
  patientId: z.string(),
  message: z.string().min(1)
});

router.post('/chat/message', async (req: Request, res: Response) => {
  try {
    const validation = chatMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }
    
    const { conversationId, patientId, message } = validation.data;
    const result = await aiProactivePatientEngagementChatbotService.processMessage(
      conversationId,
      patientId,
      message
    );
    
    res.json({
      ...result,
      noCdsCompliance: NO_CDS_COMPLIANCE
    });
  } catch (error) {
    console.error('[ChatbotRoutes] Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message', message: String(error) });
  }
});

router.get('/chat/conversation/:conversationId', (req: Request, res: Response) => {
  try {
    const conversation = aiProactivePatientEngagementChatbotService.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ ...conversation, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversation', message: String(error) });
  }
});

const generateEducationSchema = z.object({
  patientId: z.string(),
  conditions: z.array(z.string()),
  medications: z.array(z.string()).optional().default([]),
  treatmentPlan: z.string().optional(),
  healthLiteracyLevel: z.enum(['basic', 'intermediate', 'advanced']).optional().default('intermediate')
});

router.post('/education/generate', async (req: Request, res: Response) => {
  try {
    const validation = generateEducationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }
    
    const { patientId, conditions, medications, treatmentPlan, healthLiteracyLevel } = validation.data;
    const education = await aiProactivePatientEngagementChatbotService.generatePersonalizedEducation(
      patientId,
      conditions,
      medications,
      treatmentPlan,
      healthLiteracyLevel
    );
    
    res.json({ ...education, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    console.error('[EducationRoutes] Error generating education:', error);
    res.status(500).json({ error: 'Failed to generate education content', message: String(error) });
  }
});

router.get('/education/patient/:patientId', (req: Request, res: Response) => {
  try {
    const education = aiProactivePatientEngagementChatbotService.getPatientEducation(req.params.patientId);
    res.json({ items: education, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get patient education', message: String(error) });
  }
});

router.get('/education/all', (_req: Request, res: Response) => {
  try {
    const education = aiProactivePatientEngagementChatbotService.getAllEducation();
    res.json({ items: education, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get education content', message: String(error) });
  }
});

router.post('/education/:educationId/viewed', (req: Request, res: Response) => {
  try {
    const education = aiProactivePatientEngagementChatbotService.markEducationViewed(req.params.educationId);
    if (!education) {
      return res.status(404).json({ error: 'Education content not found' });
    }
    res.json({ ...education, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as viewed', message: String(error) });
  }
});

const createFollowUpSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  type: z.enum(['appointment_followup', 'medication_check', 'wellness_check', 'feedback_request', 'care_plan_update']),
  context: z.object({
    appointmentDate: z.string().optional(),
    providerName: z.string().optional(),
    reason: z.string().optional()
  }).optional()
});

router.post('/followup/create', async (req: Request, res: Response) => {
  try {
    const validation = createFollowUpSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }
    
    const { patientId, patientName, type, context } = validation.data;
    const followUp = await aiProactivePatientEngagementChatbotService.createFollowUpCommunication(
      patientId,
      patientName,
      type,
      context
    );
    
    res.json({ ...followUp, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    console.error('[FollowUpRoutes] Error creating follow-up:', error);
    res.status(500).json({ error: 'Failed to create follow-up', message: String(error) });
  }
});

router.get('/followup/patient/:patientId', (req: Request, res: Response) => {
  try {
    const followUps = aiProactivePatientEngagementChatbotService.getPatientFollowUps(req.params.patientId);
    res.json({ items: followUps, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get follow-ups', message: String(error) });
  }
});

router.get('/followup/all', (_req: Request, res: Response) => {
  try {
    const followUps = aiProactivePatientEngagementChatbotService.getAllFollowUps();
    res.json({ items: followUps, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get follow-ups', message: String(error) });
  }
});

router.post('/followup/:followUpId/send', async (req: Request, res: Response) => {
  try {
    const followUp = await aiProactivePatientEngagementChatbotService.sendFollowUp(req.params.followUpId);
    res.json({ ...followUp, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send follow-up', message: String(error) });
  }
});

const createFeedbackSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  type: z.enum(['satisfaction_survey', 'experience_rating', 'nps_score', 'open_feedback'])
});

router.post('/feedback/create', async (req: Request, res: Response) => {
  try {
    const validation = createFeedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }
    
    const { patientId, patientName, type } = validation.data;
    const feedback = await aiProactivePatientEngagementChatbotService.createFeedbackCollection(
      patientId,
      patientName,
      type
    );
    
    res.json({ ...feedback, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    console.error('[FeedbackRoutes] Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback', message: String(error) });
  }
});

router.get('/feedback/patient/:patientId', (req: Request, res: Response) => {
  try {
    const feedback = aiProactivePatientEngagementChatbotService.getPatientFeedback(req.params.patientId);
    res.json({ items: feedback, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get patient feedback', message: String(error) });
  }
});

router.get('/feedback/all', (_req: Request, res: Response) => {
  try {
    const feedback = aiProactivePatientEngagementChatbotService.getAllFeedback();
    res.json({ items: feedback, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get feedback', message: String(error) });
  }
});

const submitFeedbackSchema = z.object({
  responses: z.array(z.object({
    questionId: z.string(),
    value: z.union([z.string(), z.number()]),
    timestamp: z.string()
  }))
});

router.post('/feedback/:feedbackId/submit', async (req: Request, res: Response) => {
  try {
    const validation = submitFeedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }
    
    const feedback = await aiProactivePatientEngagementChatbotService.submitFeedbackResponse(
      req.params.feedbackId,
      validation.data.responses
    );
    
    res.json({ ...feedback, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    console.error('[FeedbackRoutes] Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback', message: String(error) });
  }
});

router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const dashboard = aiProactivePatientEngagementChatbotService.getDashboard();
    res.json({
      ...dashboard,
      noCdsCompliance: NO_CDS_COMPLIANCE
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard', message: String(error) });
  }
});

export function registerAIProactiveEngagementChatbotRoutes(app: any) {
  app.use('/api/ai-engagement-chatbot', router);
  console.log('[Routes] AI Proactive Patient Engagement Chatbot routes registered at /api/ai-engagement-chatbot/*');
}
