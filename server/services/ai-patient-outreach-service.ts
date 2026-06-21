import OpenAI from 'openai';
import { logPhiAccess } from '../security/hipaa-audit';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

const NO_CDS_COMPLIANCE = "FOR INFORMATIONAL PURPOSES ONLY - NOT FOR CLINICAL DECISION-MAKING. This AI-generated content is intended for administrative and operational use only. All patient communications must be reviewed by qualified healthcare staff before sending.";

export interface PatientCriteria {
  id: string;
  name: string;
  description: string;
  criteriaType: 'overdue_screening' | 'abnormal_lab' | 'missed_appointment' | 'medication_refill' | 'wellness_check' | 'chronic_care' | 'custom';
  conditions: CriteriaCondition[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  enabled: boolean;
  createdAt: string;
}

export interface CriteriaCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'days_since' | 'days_until';
  value: string | number;
}

export interface IdentifiedPatient {
  id: string;
  patientId: string;
  patientName: string;
  criteriaId: string;
  criteriaName: string;
  matchedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  contactPreference: 'sms' | 'email' | 'both';
  phone?: string;
  email?: string;
  lastContact?: string;
  outreachStatus: 'pending' | 'scheduled' | 'sent' | 'delivered' | 'responded' | 'failed';
}

export interface OutreachMessage {
  id: string;
  patientId: string;
  patientName: string;
  channel: 'sms' | 'email';
  subject?: string;
  content: string;
  generatedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  status: 'draft' | 'approved' | 'scheduled' | 'sent' | 'delivered' | 'failed';
  campaignId?: string;
  templateId?: string;
  aiGenerated: boolean;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  description: string;
  criteriaId: string;
  templateId?: string;
  channel: 'sms' | 'email' | 'both';
  status: 'draft' | 'active' | 'paused' | 'completed';
  scheduledStart?: string;
  scheduledEnd?: string;
  patientsIdentified: number;
  messagesSent: number;
  responsesReceived: number;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'screening_reminder' | 'lab_followup' | 'appointment_reminder' | 'medication_refill' | 'wellness' | 'general';
  channel: 'sms' | 'email';
  subject?: string;
  content: string;
  variables: string[];
  createdAt: string;
}

export interface ScheduledAppointment {
  id: string;
  patientId: string;
  patientName: string;
  appointmentType: string;
  scheduledDate: string;
  scheduledTime: string;
  provider?: string;
  location?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdFromOutreach: boolean;
  outreachMessageId?: string;
  createdAt: string;
}

class AIPatientOutreachService {
  private criteria: Map<string, PatientCriteria> = new Map();
  private identifiedPatients: Map<string, IdentifiedPatient> = new Map();
  private messages: Map<string, OutreachMessage> = new Map();
  private campaigns: Map<string, OutreachCampaign> = new Map();
  private templates: Map<string, MessageTemplate> = new Map();
  private appointments: Map<string, ScheduledAppointment> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeDefaultCriteria();
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: MessageTemplate[] = [
      {
        id: 'tmpl-screening-sms',
        name: 'Screening Reminder SMS',
        category: 'screening_reminder',
        channel: 'sms',
        content: 'Hi {{patientName}}, this is {{clinicName}}. Your {{screeningType}} screening is overdue. Please call us at {{phoneNumber}} to schedule. Reply STOP to opt out.',
        variables: ['patientName', 'clinicName', 'screeningType', 'phoneNumber'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'tmpl-screening-email',
        name: 'Screening Reminder Email',
        category: 'screening_reminder',
        channel: 'email',
        subject: 'Important: Your {{screeningType}} Screening is Due',
        content: 'Dear {{patientName}},\n\nOur records indicate that your {{screeningType}} screening is overdue. Regular screenings are important for maintaining your health.\n\nPlease contact us at {{phoneNumber}} or reply to this email to schedule your appointment.\n\nBest regards,\n{{clinicName}}',
        variables: ['patientName', 'clinicName', 'screeningType', 'phoneNumber'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'tmpl-lab-sms',
        name: 'Lab Follow-up SMS',
        category: 'lab_followup',
        channel: 'sms',
        content: 'Hi {{patientName}}, your recent lab results require follow-up. Please call {{clinicName}} at {{phoneNumber}} to discuss. Reply STOP to opt out.',
        variables: ['patientName', 'clinicName', 'phoneNumber'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'tmpl-lab-email',
        name: 'Lab Results Follow-up Email',
        category: 'lab_followup',
        channel: 'email',
        subject: 'Action Required: Follow-up on Your Recent Lab Results',
        content: 'Dear {{patientName}},\n\nYour recent lab results require attention from your healthcare provider. Please contact us to schedule a follow-up appointment.\n\nCall: {{phoneNumber}}\n\nThis is an important health matter and we recommend scheduling at your earliest convenience.\n\nBest regards,\n{{clinicName}}',
        variables: ['patientName', 'clinicName', 'phoneNumber'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'tmpl-appt-sms',
        name: 'Appointment Reminder SMS',
        category: 'appointment_reminder',
        channel: 'sms',
        content: 'Reminder: {{patientName}}, you have an appointment at {{clinicName}} on {{appointmentDate}} at {{appointmentTime}}. Reply C to confirm or call {{phoneNumber}} to reschedule.',
        variables: ['patientName', 'clinicName', 'appointmentDate', 'appointmentTime', 'phoneNumber'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'tmpl-refill-sms',
        name: 'Medication Refill SMS',
        category: 'medication_refill',
        channel: 'sms',
        content: 'Hi {{patientName}}, your {{medicationName}} prescription may need a refill soon. Contact {{clinicName}} at {{phoneNumber}} if you need assistance. Reply STOP to opt out.',
        variables: ['patientName', 'medicationName', 'clinicName', 'phoneNumber'],
        createdAt: new Date().toISOString()
      }
    ];

    defaultTemplates.forEach(t => this.templates.set(t.id, t));
  }

  private initializeDefaultCriteria(): void {
    const defaultCriteria: PatientCriteria[] = [
      {
        id: 'crit-mammogram',
        name: 'Overdue Mammogram Screening',
        description: 'Women 40+ who have not had a mammogram in the past 12 months',
        criteriaType: 'overdue_screening',
        conditions: [
          { field: 'age', operator: 'greater_than', value: 40 },
          { field: 'gender', operator: 'equals', value: 'female' },
          { field: 'lastMammogram', operator: 'days_since', value: 365 }
        ],
        priority: 'high',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'crit-colonoscopy',
        name: 'Overdue Colonoscopy',
        description: 'Adults 45+ who have not had a colonoscopy in 10 years',
        criteriaType: 'overdue_screening',
        conditions: [
          { field: 'age', operator: 'greater_than', value: 45 },
          { field: 'lastColonoscopy', operator: 'days_since', value: 3650 }
        ],
        priority: 'medium',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'crit-hba1c',
        name: 'Abnormal HbA1c Results',
        description: 'Diabetic patients with HbA1c > 7.0 requiring follow-up',
        criteriaType: 'abnormal_lab',
        conditions: [
          { field: 'diagnosis', operator: 'contains', value: 'diabetes' },
          { field: 'lastHbA1c', operator: 'greater_than', value: 7.0 }
        ],
        priority: 'high',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'crit-wellness',
        name: 'Annual Wellness Visit Due',
        description: 'Patients who have not had a wellness visit in 12 months',
        criteriaType: 'wellness_check',
        conditions: [
          { field: 'lastWellnessVisit', operator: 'days_since', value: 365 }
        ],
        priority: 'low',
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ];

    defaultCriteria.forEach(c => this.criteria.set(c.id, c));
  }

  async identifyPatientsForOutreach(criteriaId?: string): Promise<{ patients: IdentifiedPatient[]; noCdsCompliance: string }> {
    logPhiAccess({
      action: 'read',
      resourceType: 'PatientOutreach',
      resourceId: criteriaId || 'all',
      userId: 'system',
      details: 'Identifying patients for outreach'
    });

    const activeCriteria = criteriaId 
      ? [this.criteria.get(criteriaId)].filter(Boolean) as PatientCriteria[]
      : Array.from(this.criteria.values()).filter(c => c.enabled);

    const simulatedPatients: IdentifiedPatient[] = [];

    for (const criteria of activeCriteria) {
      const patientCount = Math.floor(Math.random() * 5) + 1;
      
      for (let i = 0; i < patientCount; i++) {
        const patientId = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const patient: IdentifiedPatient = {
          id: `ident-${Date.now()}-${i}`,
          patientId,
          patientName: this.generatePatientName(),
          criteriaId: criteria.id,
          criteriaName: criteria.name,
          matchedAt: new Date().toISOString(),
          priority: criteria.priority,
          reason: criteria.description,
          contactPreference: Math.random() > 0.5 ? 'sms' : 'email',
          phone: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          email: `patient${Math.floor(Math.random() * 1000)}@example.com`,
          outreachStatus: 'pending'
        };
        
        simulatedPatients.push(patient);
        this.identifiedPatients.set(patient.id, patient);
      }
    }

    return { patients: simulatedPatients, noCdsCompliance: NO_CDS_COMPLIANCE };
  }

  private generatePatientName(): string {
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }

  async generatePersonalizedMessage(
    patientId: string,
    channel: 'sms' | 'email',
    scenario: string,
    context: Record<string, string>
  ): Promise<{ message: OutreachMessage; noCdsCompliance: string }> {
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachMessage',
      resourceId: patientId,
      userId: 'system',
      details: `Generating ${channel} message for scenario: ${scenario}`
    });

    const patient = Array.from(this.identifiedPatients.values()).find(p => p.patientId === patientId);
    const patientName = patient?.patientName || context.patientName || 'Patient';

    let content: string;
    let subject: string | undefined;

    try {
      const prompt = channel === 'sms' 
        ? `Generate a brief, professional SMS message (max 160 characters) for a healthcare patient outreach scenario.
           
           Scenario: ${scenario}
           Patient Name: ${patientName}
           Additional Context: ${JSON.stringify(context)}
           
           Requirements:
           - Be warm but professional
           - Include a clear call to action
           - Mention the clinic name if provided
           - Keep under 160 characters
           - Do not include any medical advice
           
           Generate only the message text, no explanations.`
        : `Generate a professional healthcare email for patient outreach.
           
           Scenario: ${scenario}
           Patient Name: ${patientName}
           Additional Context: ${JSON.stringify(context)}
           
           Requirements:
           - Professional and empathetic tone
           - Clear subject line (prefix with "Subject: ")
           - Include greeting and closing
           - Clear call to action
           - Do not include any medical advice or diagnoses
           - Keep the email concise but complete
           
           Format:
           Subject: [subject line]
           
           [email body]`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a healthcare communication specialist. Generate patient-friendly outreach messages that are warm, professional, and HIPAA-compliant. Never include specific medical information or diagnoses in messages.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const generatedText = response.choices[0]?.message?.content || '';

      if (channel === 'email') {
        const subjectMatch = generatedText.match(/Subject:\s*(.+?)(?:\n|$)/i);
        subject = subjectMatch ? subjectMatch[1].trim() : `Healthcare Update for ${patientName}`;
        content = generatedText.replace(/Subject:\s*.+?\n/i, '').trim();
      } else {
        content = generatedText.slice(0, 160);
      }
    } catch (error) {
      console.error('[AIPatientOutreach] OpenAI error:', error);
      content = this.getFallbackMessage(channel, scenario, patientName, context);
      if (channel === 'email') {
        subject = `Healthcare Update - Action Required`;
      }
    }

    const message: OutreachMessage = {
      id: `msg-${Date.now()}`,
      patientId,
      patientName,
      channel,
      subject,
      content,
      generatedAt: new Date().toISOString(),
      status: 'draft',
      aiGenerated: true
    };

    this.messages.set(message.id, message);

    return { message, noCdsCompliance: NO_CDS_COMPLIANCE };
  }

  private getFallbackMessage(channel: 'sms' | 'email', scenario: string, patientName: string, context: Record<string, string>): string {
    const clinicName = context.clinicName || 'Your Healthcare Provider';
    const phoneNumber = context.phoneNumber || '555-123-4567';

    if (channel === 'sms') {
      switch (scenario) {
        case 'screening_reminder':
          return `Hi ${patientName}, your health screening is due. Please call ${clinicName} at ${phoneNumber} to schedule.`;
        case 'lab_followup':
          return `Hi ${patientName}, please call ${clinicName} at ${phoneNumber} regarding your recent lab results.`;
        case 'appointment_reminder':
          return `Reminder: ${patientName}, you have an upcoming appointment. Call ${phoneNumber} for details.`;
        default:
          return `Hi ${patientName}, ${clinicName} would like to connect with you. Please call ${phoneNumber}.`;
      }
    } else {
      return `Dear ${patientName},\n\nThis is a message from ${clinicName}. We would like to connect with you regarding your healthcare needs.\n\nPlease contact us at ${phoneNumber} at your earliest convenience.\n\nBest regards,\n${clinicName}`;
    }
  }

  async scheduleAppointment(
    patientId: string,
    appointmentType: string,
    preferredDate: string,
    preferredTime: string,
    outreachMessageId?: string
  ): Promise<{ appointment: ScheduledAppointment; noCdsCompliance: string }> {
    logPhiAccess({
      action: 'write',
      resourceType: 'Appointment',
      resourceId: patientId,
      userId: 'system',
      details: `Scheduling ${appointmentType} appointment`
    });

    const patient = Array.from(this.identifiedPatients.values()).find(p => p.patientId === patientId);

    const appointment: ScheduledAppointment = {
      id: `appt-${Date.now()}`,
      patientId,
      patientName: patient?.patientName || 'Unknown Patient',
      appointmentType,
      scheduledDate: preferredDate,
      scheduledTime: preferredTime,
      status: 'pending',
      createdFromOutreach: !!outreachMessageId,
      outreachMessageId,
      createdAt: new Date().toISOString()
    };

    this.appointments.set(appointment.id, appointment);

    if (patient) {
      patient.outreachStatus = 'scheduled';
    }

    return { appointment, noCdsCompliance: NO_CDS_COMPLIANCE };
  }

  async createCampaign(data: {
    name: string;
    description: string;
    criteriaId: string;
    channel: 'sms' | 'email' | 'both';
    templateId?: string;
    scheduledStart?: string;
  }): Promise<{ campaign: OutreachCampaign; noCdsCompliance: string }> {
    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachCampaign',
      resourceId: 'new',
      userId: 'system',
      details: `Creating outreach campaign: ${data.name}`
    });

    const campaign: OutreachCampaign = {
      id: `camp-${Date.now()}`,
      name: data.name,
      description: data.description,
      criteriaId: data.criteriaId,
      templateId: data.templateId,
      channel: data.channel,
      status: 'draft',
      scheduledStart: data.scheduledStart,
      patientsIdentified: 0,
      messagesSent: 0,
      responsesReceived: 0,
      createdAt: new Date().toISOString()
    };

    this.campaigns.set(campaign.id, campaign);

    return { campaign, noCdsCompliance: NO_CDS_COMPLIANCE };
  }

  async sendMessage(messageId: string): Promise<{ success: boolean; message: OutreachMessage; noCdsCompliance: string }> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    logPhiAccess({
      action: 'write',
      resourceType: 'OutreachMessage',
      resourceId: messageId,
      userId: 'system',
      details: `Sending ${message.channel} message to patient ${message.patientId}`
    });

    message.status = 'sent';
    message.sentAt = new Date().toISOString();

    setTimeout(() => {
      message.status = 'delivered';
      message.deliveredAt = new Date().toISOString();
    }, 2000);

    const patient = Array.from(this.identifiedPatients.values()).find(p => p.patientId === message.patientId);
    if (patient) {
      patient.outreachStatus = 'sent';
      patient.lastContact = new Date().toISOString();
    }

    return { success: true, message, noCdsCompliance: NO_CDS_COMPLIANCE };
  }

  getAllCriteria(): PatientCriteria[] {
    return Array.from(this.criteria.values());
  }

  getAllTemplates(): MessageTemplate[] {
    return Array.from(this.templates.values());
  }

  getAllCampaigns(): OutreachCampaign[] {
    return Array.from(this.campaigns.values());
  }

  getAllIdentifiedPatients(): IdentifiedPatient[] {
    return Array.from(this.identifiedPatients.values());
  }

  getAllMessages(): OutreachMessage[] {
    return Array.from(this.messages.values());
  }

  getAllAppointments(): ScheduledAppointment[] {
    return Array.from(this.appointments.values());
  }

  getOutreachDashboard(): {
    totalPatients: number;
    pendingOutreach: number;
    messagesSent: number;
    appointmentsScheduled: number;
    activeCampaigns: number;
    responseRate: number;
  } {
    const patients = this.getAllIdentifiedPatients();
    const messages = this.getAllMessages();
    const appointments = this.getAllAppointments();
    const campaigns = this.getAllCampaigns();

    const sentMessages = messages.filter(m => m.status === 'sent' || m.status === 'delivered');
    const respondedPatients = patients.filter(p => p.outreachStatus === 'responded');

    return {
      totalPatients: patients.length,
      pendingOutreach: patients.filter(p => p.outreachStatus === 'pending').length,
      messagesSent: sentMessages.length,
      appointmentsScheduled: appointments.filter(a => a.createdFromOutreach).length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      responseRate: sentMessages.length > 0 ? (respondedPatients.length / sentMessages.length) * 100 : 0
    };
  }

  updateCriteria(id: string, updates: Partial<PatientCriteria>): PatientCriteria | null {
    const criteria = this.criteria.get(id);
    if (!criteria) return null;

    const updated = { ...criteria, ...updates };
    this.criteria.set(id, updated);
    return updated;
  }

  approveMessage(messageId: string): OutreachMessage | null {
    const message = this.messages.get(messageId);
    if (!message) return null;

    message.status = 'approved';
    return message;
  }
}

export const aiPatientOutreachService = new AIPatientOutreachService();
