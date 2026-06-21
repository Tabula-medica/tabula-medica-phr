import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (apiKey && apiKey !== 'dummy-key' && baseURL) {
      openaiClient = new OpenAI({
        apiKey,
        baseURL,
      });
    }
  }
  return openaiClient;
}

function logAudit(action: string, details: Record<string, unknown>, outcome: 'success' | 'failure') {
  logPhiAccess({
    action: 'read',
    userId: 'system',
    resourceType: 'ai_engagement_chatbot',
    resourceId: `chatbot-${Date.now()}`,
    details: JSON.stringify({ operation: action, ...details, outcome }),
    ipAddress: 'internal',
    timestamp: new Date().toISOString()
  });
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    entities?: Record<string, string>;
    confidence?: number;
  };
}

export interface ChatConversation {
  id: string;
  patientId: string;
  patientName: string;
  messages: ChatMessage[];
  context: {
    appointments?: AppointmentContext[];
    conditions?: string[];
    medications?: string[];
    preferences?: PatientPreferences;
  };
  status: 'active' | 'closed' | 'escalated';
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentContext {
  id: string;
  date: string;
  time: string;
  type: string;
  providerName: string;
  location: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
}

export interface PatientPreferences {
  preferredLanguage: string;
  communicationChannel: 'email' | 'sms' | 'portal' | 'phone';
  healthLiteracyLevel: 'basic' | 'intermediate' | 'advanced';
  reminderFrequency: 'low' | 'medium' | 'high';
}

export interface PersonalizedEducation {
  id: string;
  patientId: string;
  title: string;
  content: string;
  summary: string;
  category: 'condition_management' | 'medication' | 'lifestyle' | 'preventive' | 'nutrition' | 'mental_health';
  readingLevel: 'simple' | 'intermediate' | 'detailed';
  relatedConditions: string[];
  relatedMedications: string[];
  keyTakeaways: string[];
  actionItems: string[];
  estimatedReadTime: number;
  aiPersonalizationNote: string;
  delivered: boolean;
  viewed: boolean;
  createdAt: string;
  noCdsCompliance: string;
}

export interface FollowUpCommunication {
  id: string;
  patientId: string;
  patientName: string;
  type: 'appointment_followup' | 'medication_check' | 'wellness_check' | 'feedback_request' | 'care_plan_update';
  subject: string;
  message: string;
  aiGeneratedContent: string;
  priority: 'low' | 'medium' | 'high';
  channel: 'email' | 'sms' | 'portal';
  status: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'responded';
  scheduledAt?: string;
  sentAt?: string;
  responseReceived?: boolean;
  responseText?: string;
  createdAt: string;
  noCdsCompliance: string;
}

export interface FeedbackCollection {
  id: string;
  patientId: string;
  patientName: string;
  type: 'satisfaction_survey' | 'experience_rating' | 'nps_score' | 'open_feedback';
  questions: FeedbackQuestion[];
  responses: FeedbackResponse[];
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  aiSentimentAnalysis?: {
    overallSentiment: 'positive' | 'neutral' | 'negative';
    keyThemes: string[];
    improvementAreas: string[];
    commendations: string[];
    followUpRecommended: boolean;
    aiInsights: string;
  };
  createdAt: string;
  completedAt?: string;
  noCdsCompliance: string;
}

export interface FeedbackQuestion {
  id: string;
  text: string;
  type: 'rating' | 'multiple_choice' | 'text' | 'yes_no' | 'nps';
  required: boolean;
  options?: string[];
}

export interface FeedbackResponse {
  questionId: string;
  value: string | number;
  timestamp: string;
}

const conversationStore = new Map<string, ChatConversation>();
const educationStore = new Map<string, PersonalizedEducation>();
const followUpStore = new Map<string, FollowUpCommunication>();
const feedbackStore = new Map<string, FeedbackCollection>();

const NO_CDS_NOTICE = "INFORMATIONAL ONLY - AI-generated content for patient engagement purposes. Not intended for clinical decision-making. Always consult healthcare providers for medical advice.";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

class AIProactivePatientEngagementChatbotService {
  
  async processMessage(
    conversationId: string,
    patientId: string,
    message: string
  ): Promise<{ response: string; intent: string; suggestedActions?: string[] }> {
    logAudit('CHATBOT_MESSAGE', { conversationId, patientId, messageLength: message.length }, 'success');
    
    let conversation = conversationStore.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        patientId,
        patientName: 'Patient',
        messages: [],
        context: {
          appointments: [
            {
              id: 'apt-1',
              date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              time: '10:00 AM',
              type: 'Annual Physical',
              providerName: 'Dr. Sarah Johnson',
              location: 'Primary Care Clinic, Room 203',
              status: 'scheduled'
            },
            {
              id: 'apt-2',
              date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              time: '2:30 PM',
              type: 'Lab Work',
              providerName: 'Quest Diagnostics',
              location: 'Lab Center, Building B',
              status: 'scheduled'
            }
          ],
          conditions: ['Type 2 Diabetes', 'Hypertension'],
          medications: ['Metformin 500mg', 'Lisinopril 10mg'],
          preferences: {
            preferredLanguage: 'English',
            communicationChannel: 'portal',
            healthLiteracyLevel: 'intermediate',
            reminderFrequency: 'medium'
          }
        },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      conversationStore.set(conversationId, conversation);
    }
    
    const userMessage: ChatMessage = {
      id: generateId('msg'),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(userMessage);
    
    const intent = this.detectIntent(message);
    let response: string;
    let suggestedActions: string[] = [];
    
    const openai = getOpenAI();
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful, empathetic healthcare assistant chatbot. Your role is to help patients with:
- Appointment reminders and scheduling questions
- Basic health queries (educational only, NOT medical advice)
- Medication reminders
- Navigation of healthcare services

IMPORTANT RULES:
1. NEVER provide medical diagnoses or treatment recommendations
2. Always encourage patients to consult their healthcare provider for medical concerns
3. Be warm, supportive, and patient-centered
4. Keep responses concise but helpful
5. For health questions, provide general educational information only
6. Always include a disclaimer that this is not medical advice

Patient Context:
- Upcoming appointments: ${JSON.stringify(conversation.context.appointments)}
- Conditions: ${conversation.context.conditions?.join(', ') || 'None specified'}
- Medications: ${conversation.context.medications?.join(', ') || 'None specified'}

Respond helpfully to the patient's message.`
            },
            ...conversation.messages.slice(-10).map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            })),
            { role: 'user', content: message }
          ],
          max_completion_tokens: 500
        });
        
        response = completion.choices[0]?.message?.content || this.getFallbackResponse(intent, conversation);
      } catch (error) {
        console.log('[ChatbotService] OpenAI error, using fallback:', error);
        response = this.getFallbackResponse(intent, conversation);
      }
    } else {
      response = this.getFallbackResponse(intent, conversation);
    }
    
    suggestedActions = this.getSuggestedActions(intent);
    
    const assistantMessage: ChatMessage = {
      id: generateId('msg'),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      metadata: { intent, confidence: 0.85 }
    };
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = new Date().toISOString();
    
    return { response, intent, suggestedActions };
  }
  
  private detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('when') && lowerMessage.includes('see')) {
      return 'appointment_inquiry';
    }
    if (lowerMessage.includes('remind') || lowerMessage.includes('reminder')) {
      return 'reminder_request';
    }
    if (lowerMessage.includes('medication') || lowerMessage.includes('medicine') || lowerMessage.includes('drug') || lowerMessage.includes('prescription')) {
      return 'medication_inquiry';
    }
    if (lowerMessage.includes('symptom') || lowerMessage.includes('feel') || lowerMessage.includes('pain') || lowerMessage.includes('sick')) {
      return 'health_query';
    }
    if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
      return 'appointment_change';
    }
    if (lowerMessage.includes('result') || lowerMessage.includes('lab') || lowerMessage.includes('test')) {
      return 'results_inquiry';
    }
    if (lowerMessage.includes('thank') || lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return 'closing';
    }
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return 'greeting';
    }
    
    return 'general_inquiry';
  }
  
  private getFallbackResponse(intent: string, conversation: ChatConversation): string {
    const appointments = conversation.context.appointments || [];
    
    switch (intent) {
      case 'greeting':
        return `Hello! I'm your healthcare assistant. I can help you with appointment reminders, basic health questions, and navigating our services. How can I assist you today?`;
        
      case 'appointment_inquiry':
        if (appointments.length > 0) {
          const upcoming = appointments[0];
          return `You have an upcoming ${upcoming.type} appointment on ${upcoming.date} at ${upcoming.time} with ${upcoming.providerName} at ${upcoming.location}. Would you like me to set a reminder or help you prepare for this visit?`;
        }
        return `I don't see any upcoming appointments in your schedule. Would you like help scheduling one?`;
        
      case 'reminder_request':
        return `I'd be happy to help with reminders! I can send you appointment reminders via your preferred channel (currently set to ${conversation.context.preferences?.communicationChannel || 'portal'}). Would you like me to confirm your upcoming appointments?`;
        
      case 'medication_inquiry':
        const meds = conversation.context.medications || [];
        if (meds.length > 0) {
          return `Based on your records, you're taking: ${meds.join(', ')}. Remember to take your medications as prescribed. If you have questions about your medications, please contact your healthcare provider or pharmacist. ${NO_CDS_NOTICE}`;
        }
        return `I don't have medication information on file. Please check with your healthcare provider for your current medication list.`;
        
      case 'health_query':
        return `I understand you may have health concerns. While I can provide general educational information, I'm not able to provide medical advice or diagnoses. For any health concerns, please contact your healthcare provider. Would you like help scheduling an appointment? ${NO_CDS_NOTICE}`;
        
      case 'appointment_change':
        return `I understand you'd like to modify your appointment. I can help you request a cancellation or rescheduling. Please note that changes may require 24-48 hours notice. Would you like me to send a request to the scheduling team?`;
        
      case 'results_inquiry':
        return `Lab results and test results are available through your patient portal once reviewed by your provider. If you have questions about your results, please schedule a follow-up with your healthcare provider. Would you like help with that?`;
        
      case 'closing':
        return `Thank you for using our healthcare assistant! If you have more questions, feel free to reach out anytime. Take care!`;
        
      default:
        return `I'm here to help with appointment scheduling, reminders, and general healthcare navigation. Could you please tell me more about what you need? ${NO_CDS_NOTICE}`;
    }
  }
  
  private getSuggestedActions(intent: string): string[] {
    switch (intent) {
      case 'appointment_inquiry':
        return ['View all appointments', 'Set reminder', 'Prepare for visit'];
      case 'reminder_request':
        return ['Set appointment reminder', 'Set medication reminder', 'Update preferences'];
      case 'medication_inquiry':
        return ['View medications', 'Set medication reminder', 'Contact pharmacy'];
      case 'health_query':
        return ['Schedule appointment', 'View health resources', 'Message provider'];
      case 'appointment_change':
        return ['Cancel appointment', 'Reschedule appointment', 'Contact scheduling'];
      case 'results_inquiry':
        return ['View results', 'Schedule follow-up', 'Message provider'];
      default:
        return ['View appointments', 'Health resources', 'Contact support'];
    }
  }
  
  async generatePersonalizedEducation(
    patientId: string,
    conditions: string[],
    medications: string[],
    treatmentPlan?: string,
    healthLiteracyLevel: 'basic' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<PersonalizedEducation> {
    logAudit('GENERATE_EDUCATION', { patientId, conditions, medications }, 'success');
    
    const id = generateId('edu');
    let content = '';
    let summary = '';
    let keyTakeaways: string[] = [];
    let actionItems: string[] = [];
    let aiPersonalizationNote = '';
    
    const openai = getOpenAI();
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a patient education content generator. Create personalized, easy-to-understand health education content.

IMPORTANT:
1. Adjust language complexity based on health literacy level: ${healthLiteracyLevel}
2. Focus on practical, actionable information
3. Never provide specific medical advice or dosing recommendations
4. Always encourage consulting healthcare providers
5. Be encouraging and supportive

Generate educational content in JSON format with:
{
  "title": "Brief, engaging title",
  "summary": "2-3 sentence overview",
  "content": "Main educational content (3-4 paragraphs)",
  "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action 1", "Action 2"],
  "personalizationNote": "Brief note on how this was personalized"
}`
            },
            {
              role: 'user',
              content: `Create personalized education for a patient with:
- Conditions: ${conditions.join(', ') || 'General wellness'}
- Medications: ${medications.join(', ') || 'None specified'}
- Treatment plan: ${treatmentPlan || 'General health maintenance'}
- Health literacy: ${healthLiteracyLevel}`
            }
          ],
          max_completion_tokens: 1000,
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
        content = parsed.content || '';
        summary = parsed.summary || '';
        keyTakeaways = parsed.keyTakeaways || [];
        actionItems = parsed.actionItems || [];
        aiPersonalizationNote = parsed.personalizationNote || '';
        
        const education: PersonalizedEducation = {
          id,
          patientId,
          title: parsed.title || `Health Information for ${conditions[0] || 'Your Wellness'}`,
          content,
          summary,
          category: this.categorizeEducation(conditions),
          readingLevel: this.mapLiteracyToReading(healthLiteracyLevel),
          relatedConditions: conditions,
          relatedMedications: medications,
          keyTakeaways,
          actionItems,
          estimatedReadTime: Math.ceil(content.split(' ').length / 200),
          aiPersonalizationNote,
          delivered: false,
          viewed: false,
          createdAt: new Date().toISOString(),
          noCdsCompliance: NO_CDS_NOTICE
        };
        
        educationStore.set(id, education);
        return education;
      } catch (error) {
        console.log('[EducationService] OpenAI error, using fallback:', error);
      }
    }
    
    const education: PersonalizedEducation = {
      id,
      patientId,
      title: `Understanding ${conditions[0] || 'Your Health'}`,
      content: this.getFallbackEducationContent(conditions, healthLiteracyLevel),
      summary: `Learn about managing ${conditions.join(' and ') || 'your health'} with practical tips and resources.`,
      category: this.categorizeEducation(conditions),
      readingLevel: this.mapLiteracyToReading(healthLiteracyLevel),
      relatedConditions: conditions,
      relatedMedications: medications,
      keyTakeaways: [
        'Regular monitoring is key to managing your health',
        'Follow your prescribed treatment plan',
        'Stay in touch with your healthcare team'
      ],
      actionItems: [
        'Schedule your next check-up',
        'Review your medication schedule',
        'Keep a health journal'
      ],
      estimatedReadTime: 3,
      aiPersonalizationNote: 'Content customized based on your conditions and reading preferences',
      delivered: false,
      viewed: false,
      createdAt: new Date().toISOString(),
      noCdsCompliance: NO_CDS_NOTICE
    };
    
    educationStore.set(id, education);
    return education;
  }
  
  private categorizeEducation(conditions: string[]): PersonalizedEducation['category'] {
    const conditionText = conditions.join(' ').toLowerCase();
    if (conditionText.includes('diabetes') || conditionText.includes('hypertension')) return 'condition_management';
    if (conditionText.includes('depression') || conditionText.includes('anxiety')) return 'mental_health';
    if (conditionText.includes('diet') || conditionText.includes('weight')) return 'nutrition';
    return 'lifestyle';
  }
  
  private mapLiteracyToReading(level: string): 'simple' | 'intermediate' | 'detailed' {
    switch (level) {
      case 'basic': return 'simple';
      case 'advanced': return 'detailed';
      default: return 'intermediate';
    }
  }
  
  private getFallbackEducationContent(conditions: string[], level: string): string {
    const condition = conditions[0] || 'your health';
    
    if (level === 'basic') {
      return `Taking care of ${condition} is important for your health. Here are simple steps you can take every day:

1. Take your medicine at the same time each day
2. Eat healthy foods like fruits and vegetables
3. Move your body - even a short walk helps
4. Get enough sleep
5. See your doctor for regular check-ups

If you have questions or feel unwell, always talk to your doctor. They are there to help you stay healthy.`;
    }
    
    return `Managing ${condition} effectively requires a comprehensive approach that includes medication adherence, lifestyle modifications, and regular monitoring.

Key aspects of managing your condition include:
- Medication Management: Take prescribed medications as directed. Set reminders if needed.
- Lifestyle Factors: A balanced diet, regular physical activity, and adequate sleep contribute significantly to your overall health.
- Monitoring: Track relevant health metrics and symptoms to share with your healthcare team.
- Communication: Maintain open dialogue with your healthcare providers about any concerns or changes.

Remember, your healthcare team is your partner in health. Don't hesitate to reach out with questions or concerns.`;
  }
  
  async createFollowUpCommunication(
    patientId: string,
    patientName: string,
    type: FollowUpCommunication['type'],
    context?: { appointmentDate?: string; providerName?: string; reason?: string }
  ): Promise<FollowUpCommunication> {
    logAudit('CREATE_FOLLOWUP', { patientId, type, context }, 'success');
    
    const id = generateId('followup');
    let subject = '';
    let message = '';
    let aiGeneratedContent = '';
    
    const openai = getOpenAI();
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a healthcare communication specialist. Generate warm, professional follow-up messages for patients.

Guidelines:
1. Be empathetic and patient-centered
2. Keep messages concise but complete
3. Include clear next steps when applicable
4. Never include medical advice
5. Encourage patient engagement

Generate in JSON format:
{
  "subject": "Brief, clear subject line",
  "message": "Complete message body",
  "aiNote": "Brief note on personalization approach"
}`
            },
            {
              role: 'user',
              content: `Generate a ${type} follow-up for patient ${patientName}. Context: ${JSON.stringify(context || {})}`
            }
          ],
          max_completion_tokens: 500,
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
        subject = parsed.subject || '';
        message = parsed.message || '';
        aiGeneratedContent = parsed.aiNote || '';
      } catch (error) {
        console.log('[FollowUpService] OpenAI error, using fallback:', error);
      }
    }
    
    if (!subject || !message) {
      const fallback = this.getFallbackFollowUp(type, patientName, context);
      subject = fallback.subject;
      message = fallback.message;
      aiGeneratedContent = 'Template-based communication';
    }
    
    const followUp: FollowUpCommunication = {
      id,
      patientId,
      patientName,
      type,
      subject,
      message,
      aiGeneratedContent,
      priority: type === 'medication_check' ? 'high' : 'medium',
      channel: 'portal',
      status: 'draft',
      createdAt: new Date().toISOString(),
      noCdsCompliance: NO_CDS_NOTICE
    };
    
    followUpStore.set(id, followUp);
    return followUp;
  }
  
  private getFallbackFollowUp(
    type: FollowUpCommunication['type'],
    patientName: string,
    context?: { appointmentDate?: string; providerName?: string; reason?: string }
  ): { subject: string; message: string } {
    switch (type) {
      case 'appointment_followup':
        return {
          subject: 'Following Up After Your Recent Visit',
          message: `Dear ${patientName},\n\nWe hope you're doing well after your recent appointment${context?.appointmentDate ? ` on ${context.appointmentDate}` : ''}${context?.providerName ? ` with ${context.providerName}` : ''}.\n\nIf you have any questions about your visit or need any additional information, please don't hesitate to reach out. We're here to support your health journey.\n\nBest regards,\nYour Healthcare Team`
        };
      case 'medication_check':
        return {
          subject: 'Checking In About Your Medications',
          message: `Dear ${patientName},\n\nWe're reaching out to see how you're doing with your medications. It's important to take your medications as prescribed for the best health outcomes.\n\nIf you're experiencing any concerns or side effects, please contact your healthcare provider. They can help address any issues you may have.\n\nTake care,\nYour Healthcare Team`
        };
      case 'wellness_check':
        return {
          subject: 'Your Health Matters to Us',
          message: `Dear ${patientName},\n\nWe wanted to check in and see how you're doing. Regular wellness check-ins help us support your health goals.\n\nIf there's anything we can help with or if you'd like to schedule an appointment, please let us know.\n\nWishing you well,\nYour Healthcare Team`
        };
      case 'feedback_request':
        return {
          subject: 'We Value Your Feedback',
          message: `Dear ${patientName},\n\nYour experience matters to us. We'd love to hear about your recent healthcare experience so we can continue to improve our services.\n\nPlease take a moment to share your feedback through our patient portal.\n\nThank you,\nYour Healthcare Team`
        };
      default:
        return {
          subject: 'Update from Your Healthcare Team',
          message: `Dear ${patientName},\n\nWe wanted to share an important update with you. Please check your patient portal for more details.\n\nIf you have any questions, we're here to help.\n\nBest regards,\nYour Healthcare Team`
        };
    }
  }
  
  async createFeedbackCollection(
    patientId: string,
    patientName: string,
    type: FeedbackCollection['type']
  ): Promise<FeedbackCollection> {
    logAudit('CREATE_FEEDBACK', { patientId, type }, 'success');
    
    const id = generateId('feedback');
    const questions = this.generateFeedbackQuestions(type);
    
    const feedback: FeedbackCollection = {
      id,
      patientId,
      patientName,
      type,
      questions,
      responses: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      noCdsCompliance: NO_CDS_NOTICE
    };
    
    feedbackStore.set(id, feedback);
    return feedback;
  }
  
  private generateFeedbackQuestions(type: FeedbackCollection['type']): FeedbackQuestion[] {
    switch (type) {
      case 'satisfaction_survey':
        return [
          { id: 'q1', text: 'How would you rate your overall experience?', type: 'rating', required: true },
          { id: 'q2', text: 'How satisfied were you with the quality of care received?', type: 'rating', required: true },
          { id: 'q3', text: 'Was the staff courteous and helpful?', type: 'yes_no', required: true },
          { id: 'q4', text: 'Did you feel your concerns were addressed?', type: 'yes_no', required: true },
          { id: 'q5', text: 'Any additional comments or suggestions?', type: 'text', required: false }
        ];
      case 'nps_score':
        return [
          { id: 'nps1', text: 'On a scale of 0-10, how likely are you to recommend us to friends or family?', type: 'nps', required: true },
          { id: 'nps2', text: 'What is the primary reason for your score?', type: 'text', required: false }
        ];
      case 'experience_rating':
        return [
          { id: 'exp1', text: 'How easy was it to schedule your appointment?', type: 'rating', required: true },
          { id: 'exp2', text: 'How would you rate the wait time?', type: 'rating', required: true },
          { id: 'exp3', text: 'How well did the provider explain things?', type: 'rating', required: true },
          { id: 'exp4', text: 'Was the facility clean and comfortable?', type: 'yes_no', required: true }
        ];
      default:
        return [
          { id: 'open1', text: 'Please share your feedback with us:', type: 'text', required: true }
        ];
    }
  }
  
  async submitFeedbackResponse(
    feedbackId: string,
    responses: FeedbackResponse[]
  ): Promise<FeedbackCollection> {
    const feedback = feedbackStore.get(feedbackId);
    if (!feedback) {
      throw new Error('Feedback collection not found');
    }
    
    feedback.responses = responses;
    feedback.status = 'completed';
    feedback.completedAt = new Date().toISOString();
    
    const openai = getOpenAI();
    if (openai && responses.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Analyze patient feedback and provide insights. Return JSON:
{
  "overallSentiment": "positive|neutral|negative",
  "keyThemes": ["theme1", "theme2"],
  "improvementAreas": ["area1"],
  "commendations": ["praise1"],
  "followUpRecommended": true/false,
  "aiInsights": "Brief summary of findings"
}`
            },
            {
              role: 'user',
              content: `Analyze this feedback: ${JSON.stringify(responses)}`
            }
          ],
          max_completion_tokens: 500,
          response_format: { type: 'json_object' }
        });
        
        feedback.aiSentimentAnalysis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (error) {
        console.log('[FeedbackService] OpenAI error:', error);
        feedback.aiSentimentAnalysis = {
          overallSentiment: 'neutral',
          keyThemes: ['Patient feedback received'],
          improvementAreas: [],
          commendations: [],
          followUpRecommended: false,
          aiInsights: 'Feedback collected successfully. Manual review recommended.'
        };
      }
    }
    
    logAudit('SUBMIT_FEEDBACK', { feedbackId, responseCount: responses.length }, 'success');
    return feedback;
  }
  
  getConversation(conversationId: string): ChatConversation | undefined {
    return conversationStore.get(conversationId);
  }
  
  getPatientEducation(patientId: string): PersonalizedEducation[] {
    return Array.from(educationStore.values()).filter(e => e.patientId === patientId);
  }
  
  getPatientFollowUps(patientId: string): FollowUpCommunication[] {
    return Array.from(followUpStore.values()).filter(f => f.patientId === patientId);
  }
  
  getPatientFeedback(patientId: string): FeedbackCollection[] {
    return Array.from(feedbackStore.values()).filter(f => f.patientId === patientId);
  }
  
  getAllEducation(): PersonalizedEducation[] {
    return Array.from(educationStore.values());
  }
  
  getAllFollowUps(): FollowUpCommunication[] {
    return Array.from(followUpStore.values());
  }
  
  getAllFeedback(): FeedbackCollection[] {
    return Array.from(feedbackStore.values());
  }
  
  async sendFollowUp(followUpId: string): Promise<FollowUpCommunication> {
    const followUp = followUpStore.get(followUpId);
    if (!followUp) {
      throw new Error('Follow-up communication not found');
    }
    
    followUp.status = 'sent';
    followUp.sentAt = new Date().toISOString();
    logAudit('SEND_FOLLOWUP', { followUpId }, 'success');
    
    return followUp;
  }
  
  markEducationViewed(educationId: string): PersonalizedEducation | undefined {
    const education = educationStore.get(educationId);
    if (education) {
      education.viewed = true;
      logAudit('EDUCATION_VIEWED', { educationId }, 'success');
    }
    return education;
  }
  
  getDashboard(): {
    stats: {
      activeConversations: number;
      educationCreated: number;
      pendingFollowUps: number;
      feedbackCollected: number;
      avgSentiment: string;
    };
    recentConversations: ChatConversation[];
    recentEducation: PersonalizedEducation[];
    recentFollowUps: FollowUpCommunication[];
    recentFeedback: FeedbackCollection[];
  } {
    const conversations = Array.from(conversationStore.values());
    const education = Array.from(educationStore.values());
    const followUps = Array.from(followUpStore.values());
    const feedback = Array.from(feedbackStore.values());
    
    const completedFeedback = feedback.filter(f => f.status === 'completed' && f.aiSentimentAnalysis);
    const sentiments = completedFeedback.map(f => f.aiSentimentAnalysis?.overallSentiment).filter(Boolean);
    const avgSentiment = sentiments.length > 0 
      ? sentiments.filter(s => s === 'positive').length > sentiments.length / 2 ? 'positive' : 'neutral'
      : 'neutral';
    
    return {
      stats: {
        activeConversations: conversations.filter(c => c.status === 'active').length,
        educationCreated: education.length,
        pendingFollowUps: followUps.filter(f => f.status === 'draft' || f.status === 'scheduled').length,
        feedbackCollected: completedFeedback.length,
        avgSentiment
      },
      recentConversations: conversations.slice(-5),
      recentEducation: education.slice(-5),
      recentFollowUps: followUps.slice(-5),
      recentFeedback: feedback.slice(-5)
    };
  }
}

export const aiProactivePatientEngagementChatbotService = new AIProactivePatientEngagementChatbotService();

console.log('[AIProactiveEngagementChatbot] Service initialized with NO-CDS compliance');
console.log('[AIProactiveEngagementChatbot] Features: Chatbot, Personalized Education, Follow-up Communication, Feedback Collection');
