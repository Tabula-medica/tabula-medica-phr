import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiPatientOutreachService } from './services/ai-patient-outreach-service';
import { logPhiAccess } from './security/hipaa-audit';

const router = Router();

const NO_CDS_COMPLIANCE = "FOR INFORMATIONAL PURPOSES ONLY - NOT FOR CLINICAL DECISION-MAKING. This AI-generated content is intended for administrative and operational use only. All patient communications must be reviewed by qualified healthcare staff before sending.";

const identifyPatientsSchema = z.object({
  criteriaId: z.string().optional()
});

router.post('/identify-patients', async (req: Request, res: Response) => {
  try {
    const data = identifyPatientsSchema.parse(req.body);
    
    logPhiAccess({
      action: 'read',
      resourceType: 'PatientIdentification',
      resourceId: data.criteriaId || 'all',
      userId: 'system',
      details: `Identifying patients for outreach${data.criteriaId ? ` using criteria ${data.criteriaId}` : ''}`
    });

    const result = await aiPatientOutreachService.identifyPatientsForOutreach(data.criteriaId);
    res.json({ ...result, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to identify patients', message: String(error) });
  }
});

router.get('/patients', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'IdentifiedPatient',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing identified patients for outreach'
    });

    const patients = aiPatientOutreachService.getAllIdentifiedPatients();
    res.json({ items: patients, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get patients', message: String(error) });
  }
});

const generateMessageSchema = z.object({
  patientId: z.string(),
  channel: z.enum(['sms', 'email']),
  scenario: z.string(),
  context: z.record(z.string()).optional()
});

router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    const data = generateMessageSchema.parse(req.body);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachMessage',
      resourceId: data.patientId,
      userId: 'system',
      details: `Generating ${data.channel} message for scenario: ${data.scenario}`
    });

    const result = await aiPatientOutreachService.generatePersonalizedMessage(
      data.patientId,
      data.channel,
      data.scenario,
      data.context || {}
    );
    res.json({ ...result, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate message', message: String(error) });
  }
});

router.get('/messages', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'OutreachMessage',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing outreach messages'
    });

    const messages = aiPatientOutreachService.getAllMessages();
    res.json({ items: messages, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages', message: String(error) });
  }
});

const messageIdParamSchema = z.object({
  messageId: z.string().min(1)
});

router.post('/messages/:messageId/approve', (req: Request, res: Response) => {
  try {
    const params = messageIdParamSchema.parse(req.params);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachMessage',
      resourceId: params.messageId,
      userId: 'system',
      details: 'Approving outreach message'
    });

    const message = aiPatientOutreachService.approveMessage(params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve message', message: String(error) });
  }
});

router.post('/messages/:messageId/send', async (req: Request, res: Response) => {
  try {
    const params = messageIdParamSchema.parse(req.params);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachMessage',
      resourceId: params.messageId,
      userId: 'system',
      details: 'Sending outreach message to patient'
    });

    const result = await aiPatientOutreachService.sendMessage(params.messageId);
    res.json({ ...result, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message', message: String(error) });
  }
});

const scheduleAppointmentSchema = z.object({
  patientId: z.string(),
  appointmentType: z.string(),
  preferredDate: z.string(),
  preferredTime: z.string(),
  outreachMessageId: z.string().optional()
});

router.post('/schedule-appointment', async (req: Request, res: Response) => {
  try {
    const data = scheduleAppointmentSchema.parse(req.body);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'Appointment',
      resourceId: data.patientId,
      userId: 'system',
      details: `Scheduling ${data.appointmentType} appointment for ${data.preferredDate}`
    });

    const result = await aiPatientOutreachService.scheduleAppointment(
      data.patientId,
      data.appointmentType,
      data.preferredDate,
      data.preferredTime,
      data.outreachMessageId
    );
    res.json({ ...result, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule appointment', message: String(error) });
  }
});

router.get('/appointments', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'Appointment',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing scheduled appointments from outreach'
    });

    const appointments = aiPatientOutreachService.getAllAppointments();
    res.json({ items: appointments, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get appointments', message: String(error) });
  }
});

const createCampaignSchema = z.object({
  name: z.string(),
  description: z.string(),
  criteriaId: z.string(),
  channel: z.enum(['sms', 'email', 'both']),
  templateId: z.string().optional(),
  scheduledStart: z.string().optional()
});

router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const data = createCampaignSchema.parse(req.body);
    
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachCampaign',
      resourceId: 'new',
      userId: 'system',
      details: `Creating outreach campaign: ${data.name}`
    });

    const result = await aiPatientOutreachService.createCampaign(data);
    res.json({ ...result, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create campaign', message: String(error) });
  }
});

router.get('/campaigns', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'OutreachCampaign',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing outreach campaigns'
    });

    const campaigns = aiPatientOutreachService.getAllCampaigns();
    res.json({ items: campaigns, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get campaigns', message: String(error) });
  }
});

router.get('/criteria', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'PatientCriteria',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing patient identification criteria'
    });

    const criteria = aiPatientOutreachService.getAllCriteria();
    res.json({ items: criteria, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get criteria', message: String(error) });
  }
});

const updateCriteriaSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
});

router.patch('/criteria/:criteriaId', (req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'write',
      resourceType: 'PatientCriteria',
      resourceId: req.params.criteriaId,
      userId: 'system',
      details: 'Updating patient criteria'
    });

    const updates = updateCriteriaSchema.parse(req.body);
    const criteria = aiPatientOutreachService.updateCriteria(req.params.criteriaId, updates);
    if (!criteria) {
      return res.status(404).json({ error: 'Criteria not found' });
    }
    res.json({ criteria, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update criteria', message: String(error) });
  }
});

router.get('/templates', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'MessageTemplate',
      resourceId: 'list',
      userId: 'system',
      details: 'Viewing message templates'
    });

    const templates = aiPatientOutreachService.getAllTemplates();
    res.json({ items: templates, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get templates', message: String(error) });
  }
});

router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      action: 'read',
      resourceType: 'OutreachDashboard',
      resourceId: 'aggregate',
      userId: 'system',
      details: 'Viewing outreach dashboard'
    });

    const dashboard = aiPatientOutreachService.getOutreachDashboard();
    res.json({ ...dashboard, noCdsCompliance: NO_CDS_COMPLIANCE });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard', message: String(error) });
  }
});

export function registerAIPatientOutreachRoutes(app: any) {
  app.use('/api/patient-outreach', router);
  console.log('[Routes] AI Patient Outreach routes registered at /api/patient-outreach/*');
}
