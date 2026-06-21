/**
 * CDS Hooks Service - HL7 CDS Hooks Integration for Provider Decision Support
 * 
 * This service implements the HL7 CDS Hooks specification for querying external
 * clinical decision support services based on patient context.
 * 
 * STRICT COMPLIANCE: All outputs are INFORMATIONAL ONLY.
 * This service does NOT provide treatment recommendations or medical advice.
 * All alerts/suggestions include mandatory disclaimers.
 * 
 * Supported Hooks:
 * - patient-view: Triggered when patient record is opened
 * - order-select: Triggered when an order is being selected
 * - medication-prescribe: Triggered when medications are being prescribed
 * - order-sign: Triggered when orders are being signed
 * - encounter-start: Triggered at encounter start
 * - encounter-discharge: Triggered at discharge
 */

import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

// Initialize OpenAI client for AI-enhanced CDS analysis
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// CRITICAL: Informational disclaimer for all CDS outputs
const INFORMATIONAL_DISCLAIMER = `
⚠️ INFORMATIONAL ONLY - NOT MEDICAL ADVICE
This information is provided for educational and informational purposes only.
It does NOT constitute medical advice, diagnosis, or treatment recommendations.
Clinical judgment by qualified healthcare providers is required for all patient care decisions.
Always verify information with authoritative clinical sources before taking any action.
`;

// CDS Hooks specification types
export interface CDSHook {
  id: string;
  hook: CDSHookType;
  title: string;
  description: string;
  usageRequirements?: string;
  prefetch?: Record<string, string>;
}

export type CDSHookType = 
  | 'patient-view'
  | 'order-select'
  | 'medication-prescribe'
  | 'order-sign'
  | 'encounter-start'
  | 'encounter-discharge';

export interface CDSRequest {
  hook: CDSHookType;
  hookInstance: string;
  context: CDSContext;
  prefetch?: Record<string, any>;
  fhirServer?: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
}

export interface CDSContext {
  userId?: string;
  patientId: string;
  encounterId?: string;
  medications?: MedicationContext[];
  conditions?: ConditionContext[];
  labResults?: LabContext[];
  orders?: OrderContext[];
  draftOrders?: DraftOrder[];
}

export interface MedicationContext {
  resourceType: 'MedicationRequest' | 'MedicationStatement';
  id: string;
  code: string;
  display: string;
  status: string;
  dosage?: string;
  rxnormCode?: string;
}

export interface ConditionContext {
  resourceType: 'Condition';
  id: string;
  code: string;
  display: string;
  clinicalStatus: string;
  onsetDate?: string;
  icd10Code?: string;
}

export interface LabContext {
  resourceType: 'Observation';
  id: string;
  code: string;
  display: string;
  value: number;
  unit: string;
  referenceRange?: { low?: number; high?: number };
  effectiveDate: string;
  loincCode?: string;
}

export interface OrderContext {
  resourceType: 'ServiceRequest' | 'MedicationRequest';
  id: string;
  code: string;
  display: string;
  status: string;
}

export interface DraftOrder {
  resourceType: string;
  id: string;
  code: string;
  display: string;
}

// CDS Response types per HL7 specification
export interface CDSResponse {
  cards: CDSCard[];
  systemActions?: SystemAction[];
  disclaimer: string;
  generatedAt: string;
}

export interface CDSCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: CDSSource;
  suggestions?: CDSSuggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: OverrideReason[];
  links?: CDSLink[];
  isInformationalOnly: true; // Always true - strict compliance
}

export interface CDSSource {
  label: string;
  url?: string;
  icon?: string;
  topic?: {
    code: string;
    system: string;
    display: string;
  };
}

export interface CDSSuggestion {
  label: string;
  uuid: string;
  isRecommended?: boolean;
  actions: SuggestionAction[];
}

export interface SuggestionAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any;
  resourceId?: string;
}

export interface OverrideReason {
  code: string;
  display: string;
  system?: string;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface SystemAction {
  type: string;
  description: string;
  resource?: any;
}

// Audit logging interface
interface CDSAuditLog {
  timestamp: string;
  hookType: CDSHookType;
  patientId: string;
  providerId?: string;
  cardsGenerated: number;
  action: 'invoked' | 'cards_returned' | 'suggestion_accepted' | 'override';
  details?: string;
}

// External CDS Service configuration
interface CDSServiceConfig {
  id: string;
  name: string;
  baseUrl: string;
  supportedHooks: CDSHookType[];
  enabled: boolean;
  priority: number;
}

class CDSHooksService {
  private auditLogs: CDSAuditLog[] = [];
  private externalServices: CDSServiceConfig[] = [];
  private registeredHooks: CDSHook[] = [];

  constructor() {
    this.initializeHooks();
    this.initializeExternalServices();
    console.log('[CDSHooks] Service initialized with strict informational-only compliance');
    console.log('[CDSHooks] Registered hooks:', this.registeredHooks.map(h => h.id).join(', '));
  }

  private initializeHooks(): void {
    this.registeredHooks = [
      {
        id: 'tabula-patient-view',
        hook: 'patient-view',
        title: 'Patient View Informational Alerts',
        description: 'Provides informational alerts when patient record is opened. NOT medical advice.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          conditions: 'Condition?patient={{context.patientId}}',
          medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
          observations: 'Observation?patient={{context.patientId}}&category=laboratory'
        }
      },
      {
        id: 'tabula-medication-prescribe',
        hook: 'medication-prescribe',
        title: 'Medication Information Alerts',
        description: 'Provides informational drug interaction alerts. NOT prescribing recommendations.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
          allergies: 'AllergyIntolerance?patient={{context.patientId}}'
        }
      },
      {
        id: 'tabula-order-select',
        hook: 'order-select',
        title: 'Order Selection Information',
        description: 'Provides informational context for order selection. NOT ordering recommendations.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          conditions: 'Condition?patient={{context.patientId}}'
        }
      },
      {
        id: 'tabula-encounter-start',
        hook: 'encounter-start',
        title: 'Encounter Start Information',
        description: 'Provides relevant patient information at encounter start. NOT care plan recommendations.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          recentEncounters: 'Encounter?patient={{context.patientId}}&_sort=-date&_count=5'
        }
      },
      {
        id: 'tabula-order-sign',
        hook: 'order-sign',
        title: 'Order Signing Information',
        description: 'Provides informational context before order signing. NOT treatment recommendations.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}'
        }
      },
      {
        id: 'tabula-encounter-discharge',
        hook: 'encounter-discharge',
        title: 'Discharge Information',
        description: 'Provides informational alerts at discharge. NOT discharge planning recommendations.',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
        }
      }
    ];
  }

  private initializeExternalServices(): void {
    // Configure mock external CDS services (would be real endpoints in production)
    this.externalServices = [
      {
        id: 'cds-reference',
        name: 'CDS Reference Service',
        baseUrl: 'https://cds-hooks.sandbox.org/services',
        supportedHooks: ['patient-view', 'medication-prescribe'],
        enabled: false, // Disabled by default - use internal AI
        priority: 1
      },
      {
        id: 'drug-interaction-service',
        name: 'Drug Interaction Reference',
        baseUrl: 'https://drug-interactions.example.org/cds',
        supportedHooks: ['medication-prescribe', 'order-sign'],
        enabled: false,
        priority: 2
      }
    ];
  }

  /**
   * Get list of available CDS hooks (discovery endpoint)
   */
  getAvailableHooks(): { services: CDSHook[] } {
    return { services: this.registeredHooks };
  }

  /**
   * Invoke a CDS hook and generate informational cards
   */
  async invokeHook(request: CDSRequest): Promise<CDSResponse> {
    const startTime = Date.now();
    
    // Log hook invocation
    this.logAudit({
      timestamp: new Date().toISOString(),
      hookType: request.hook,
      patientId: request.context.patientId,
      providerId: request.context.userId,
      cardsGenerated: 0,
      action: 'invoked'
    });

    let cards: CDSCard[] = [];

    try {
      // Generate cards based on hook type
      switch (request.hook) {
        case 'patient-view':
          cards = await this.generatePatientViewCards(request);
          break;
        case 'medication-prescribe':
          cards = await this.generateMedicationCards(request);
          break;
        case 'order-select':
          cards = await this.generateOrderSelectCards(request);
          break;
        case 'order-sign':
          cards = await this.generateOrderSignCards(request);
          break;
        case 'encounter-start':
          cards = await this.generateEncounterStartCards(request);
          break;
        case 'encounter-discharge':
          cards = await this.generateDischargeCards(request);
          break;
        default:
          console.warn(`[CDSHooks] Unknown hook type: ${request.hook}`);
      }
    } catch (error) {
      console.error('[CDSHooks] Error generating cards:', error);
      cards = [{
        uuid: this.generateUUID(),
        summary: 'CDS service temporarily unavailable',
        detail: 'Unable to generate informational alerts at this time. Please consult authoritative clinical sources directly.',
        indicator: 'info',
        source: {
          label: 'Tabula Medica CDS',
          topic: { code: 'error', system: 'internal', display: 'Service Error' }
        },
        isInformationalOnly: true
      }];
    }

    // Log cards returned
    this.logAudit({
      timestamp: new Date().toISOString(),
      hookType: request.hook,
      patientId: request.context.patientId,
      providerId: request.context.userId,
      cardsGenerated: cards.length,
      action: 'cards_returned',
      details: `Generated in ${Date.now() - startTime}ms`
    });

    return {
      cards,
      disclaimer: INFORMATIONAL_DISCLAIMER,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate cards for patient-view hook
   */
  private async generatePatientViewCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;

    // Check for conditions that warrant informational alerts
    if (ctx.conditions && ctx.conditions.length > 0) {
      const activeConditions = ctx.conditions.filter(c => c.clinicalStatus === 'active');
      
      // Check for chronic conditions
      const chronicConditions = activeConditions.filter(c => 
        c.display.toLowerCase().includes('diabetes') ||
        c.display.toLowerCase().includes('hypertension') ||
        c.display.toLowerCase().includes('chronic')
      );

      if (chronicConditions.length > 0) {
        cards.push({
          uuid: this.generateUUID(),
          summary: `Active Chronic Conditions: ${chronicConditions.length}`,
          detail: `This patient has ${chronicConditions.length} documented chronic condition(s): ${chronicConditions.map(c => c.display).join(', ')}. This is informational context only and does not constitute care recommendations.`,
          indicator: 'info',
          source: {
            label: 'Tabula Medica - Condition Registry',
            topic: { code: 'chronic-conditions', system: 'tabula', display: 'Chronic Conditions' }
          },
          links: [{
            label: 'View Condition Details',
            url: '/conditions',
            type: 'smart'
          }],
          isInformationalOnly: true
        });
      }
    }

    // Check for medication count (polypharmacy awareness)
    if (ctx.medications && ctx.medications.length >= 5) {
      cards.push({
        uuid: this.generateUUID(),
        summary: `Multiple Active Medications: ${ctx.medications.length}`,
        detail: `This patient has ${ctx.medications.length} active medications documented. This is informational context for medication review awareness. Always verify current medication list with the patient.`,
        indicator: ctx.medications.length >= 10 ? 'warning' : 'info',
        source: {
          label: 'Tabula Medica - Medication Registry',
          topic: { code: 'polypharmacy', system: 'tabula', display: 'Polypharmacy Awareness' }
        },
        links: [{
          label: 'View Medication List',
          url: '/medications',
          type: 'smart'
        }],
        isInformationalOnly: true
      });
    }

    // Check for abnormal lab values
    if (ctx.labResults && ctx.labResults.length > 0) {
      const abnormalLabs = ctx.labResults.filter(lab => {
        if (!lab.referenceRange) return false;
        const { low, high } = lab.referenceRange;
        return (low !== undefined && lab.value < low) || (high !== undefined && lab.value > high);
      });

      if (abnormalLabs.length > 0) {
        cards.push({
          uuid: this.generateUUID(),
          summary: `Lab Values Outside Reference Range: ${abnormalLabs.length}`,
          detail: `${abnormalLabs.length} lab result(s) are documented outside standard reference ranges: ${abnormalLabs.map(l => `${l.display}: ${l.value} ${l.unit}`).join('; ')}. This is informational context only. Clinical interpretation requires professional judgment.`,
          indicator: 'warning',
          source: {
            label: 'Tabula Medica - Lab Registry',
            topic: { code: 'abnormal-labs', system: 'tabula', display: 'Lab Results' }
          },
          links: [{
            label: 'View Lab History',
            url: '/labs',
            type: 'smart'
          }],
          isInformationalOnly: true
        });
      }
    }

    // AI-enhanced contextual information if OpenAI is configured
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && cards.length > 0) {
      try {
        const aiCard = await this.generateAIContextCard(ctx, 'patient-view');
        if (aiCard) cards.push(aiCard);
      } catch (error) {
        console.warn('[CDSHooks] AI enhancement unavailable:', error);
      }
    }

    return cards;
  }

  /**
   * Generate cards for medication-prescribe hook
   */
  private async generateMedicationCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;
    
    // Check for potential drug interactions (informational only)
    if (ctx.medications && ctx.medications.length >= 2) {
      // Known interaction patterns (informational reference)
      const knownInteractionPatterns = [
        { drugs: ['warfarin', 'aspirin'], severity: 'warning', info: 'Both affect blood coagulation' },
        { drugs: ['metformin', 'contrast'], severity: 'warning', info: 'Renal function consideration' },
        { drugs: ['ssri', 'maoi'], severity: 'critical', info: 'Serotonin syndrome risk documented in literature' },
        { drugs: ['ace inhibitor', 'potassium'], severity: 'warning', info: 'Electrolyte monitoring often recommended' },
        { drugs: ['statin', 'fibrate'], severity: 'warning', info: 'Muscle-related effects documented' }
      ];

      const medicationNames = ctx.medications.map(m => m.display.toLowerCase());
      
      for (const pattern of knownInteractionPatterns) {
        const matchCount = pattern.drugs.filter(drug => 
          medicationNames.some(name => name.includes(drug))
        ).length;

        if (matchCount >= 2) {
          cards.push({
            uuid: this.generateUUID(),
            summary: `Drug Interaction Reference: ${pattern.drugs.join(' + ')}`,
            detail: `Literature reference: ${pattern.info}. This is informational context from published references. It is NOT a recommendation to change therapy. Clinical judgment is required.`,
            indicator: pattern.severity as 'warning' | 'critical',
            source: {
              label: 'Drug Interaction Reference Database',
              topic: { code: 'drug-interaction', system: 'tabula', display: 'Drug Interactions' }
            },
            overrideReasons: [
              { code: 'clinically-aware', display: 'Clinically aware of this information' },
              { code: 'patient-specific', display: 'Patient-specific factors considered' },
              { code: 'benefit-outweighs', display: 'Benefits documented in clinical notes' }
            ],
            isInformationalOnly: true
          });
        }
      }
    }

    // Check draft orders if available
    if (ctx.draftOrders && ctx.draftOrders.length > 0) {
      const medOrders = ctx.draftOrders.filter(o => o.resourceType === 'MedicationRequest');
      if (medOrders.length > 0) {
        cards.push({
          uuid: this.generateUUID(),
          summary: `Draft Medication Order Context`,
          detail: `${medOrders.length} medication order(s) pending: ${medOrders.map(o => o.display).join(', ')}. This is a reminder to review against current medication list and patient conditions.`,
          indicator: 'info',
          source: {
            label: 'Tabula Medica - Order Context',
            topic: { code: 'draft-orders', system: 'tabula', display: 'Draft Orders' }
          },
          isInformationalOnly: true
        });
      }
    }

    return cards;
  }

  /**
   * Generate cards for order-select hook
   */
  private async generateOrderSelectCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;

    if (ctx.conditions && ctx.conditions.length > 0) {
      // Provide condition context for order selection
      const relevantConditions = ctx.conditions.filter(c => c.clinicalStatus === 'active');
      
      if (relevantConditions.length > 0) {
        cards.push({
          uuid: this.generateUUID(),
          summary: 'Active Conditions Context',
          detail: `Patient has ${relevantConditions.length} active condition(s) documented: ${relevantConditions.map(c => c.display).join(', ')}. This context is provided for informational awareness during order selection.`,
          indicator: 'info',
          source: {
            label: 'Tabula Medica - Patient Context',
            topic: { code: 'patient-context', system: 'tabula', display: 'Patient Context' }
          },
          isInformationalOnly: true
        });
      }
    }

    return cards;
  }

  /**
   * Generate cards for order-sign hook
   */
  private async generateOrderSignCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;

    // Pre-sign verification context
    if (ctx.orders && ctx.orders.length > 0) {
      cards.push({
        uuid: this.generateUUID(),
        summary: `${ctx.orders.length} Order(s) Ready for Signature`,
        detail: `Orders pending signature: ${ctx.orders.map(o => o.display).join(', ')}. This is a verification reminder. Ensure all orders have been reviewed for appropriateness.`,
        indicator: 'info',
        source: {
          label: 'Tabula Medica - Order Verification',
          topic: { code: 'order-sign', system: 'tabula', display: 'Order Signing' }
        },
        isInformationalOnly: true
      });
    }

    return cards;
  }

  /**
   * Generate cards for encounter-start hook
   */
  private async generateEncounterStartCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;

    // Provide encounter context
    cards.push({
      uuid: this.generateUUID(),
      summary: 'Encounter Started - Patient Context Available',
      detail: `Patient ID: ${ctx.patientId}. Review patient history, current medications, and active conditions for encounter context. This is informational context only.`,
      indicator: 'info',
      source: {
        label: 'Tabula Medica - Encounter Context',
        topic: { code: 'encounter-start', system: 'tabula', display: 'Encounter Start' }
      },
      links: [
        { label: 'View Patient Summary', url: `/patient/${ctx.patientId}`, type: 'smart' },
        { label: 'View Medications', url: `/patient/${ctx.patientId}/medications`, type: 'smart' }
      ],
      isInformationalOnly: true
    });

    return cards;
  }

  /**
   * Generate cards for encounter-discharge hook
   */
  private async generateDischargeCards(request: CDSRequest): Promise<CDSCard[]> {
    const cards: CDSCard[] = [];
    const ctx = request.context;

    // Discharge context reminder
    if (ctx.medications && ctx.medications.length > 0) {
      cards.push({
        uuid: this.generateUUID(),
        summary: 'Discharge Medication Review Reminder',
        detail: `Patient has ${ctx.medications.length} active medication(s). This is a reminder to review and document medication reconciliation at discharge. This is NOT a medication list recommendation.`,
        indicator: 'info',
        source: {
          label: 'Tabula Medica - Discharge Context',
          topic: { code: 'discharge-meds', system: 'tabula', display: 'Discharge Medications' }
        },
        isInformationalOnly: true
      });
    }

    return cards;
  }

  /**
   * Generate AI-enhanced contextual information card
   */
  private async generateAIContextCard(ctx: CDSContext, hookType: CDSHookType): Promise<CDSCard | null> {
    if (!openai) return null;

    const contextSummary = {
      conditions: ctx.conditions?.map(c => c.display) || [],
      medications: ctx.medications?.map(m => m.display) || [],
      recentLabs: ctx.labResults?.slice(0, 5).map(l => `${l.display}: ${l.value} ${l.unit}`) || []
    };

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `You are a clinical information summarizer. You provide INFORMATIONAL CONTEXT ONLY.
You NEVER provide medical advice, treatment recommendations, or clinical decisions.
You only summarize existing documented information and highlight general educational context.
Always emphasize that clinical judgment by qualified providers is required.
Keep responses concise (2-3 sentences max).`
          },
          {
            role: 'user',
            content: `Provide a brief informational summary for a ${hookType} context with:
Conditions: ${contextSummary.conditions.join(', ') || 'None documented'}
Medications: ${contextSummary.medications.join(', ') || 'None documented'}
Recent Labs: ${contextSummary.recentLabs.join(', ') || 'None available'}

Remember: INFORMATIONAL ONLY. No recommendations.`
          }
        ],
        max_completion_tokens: 200
      });

      const summary = response.choices[0]?.message?.content;
      if (!summary) return null;

      return {
        uuid: this.generateUUID(),
        summary: 'AI-Enhanced Patient Context Summary',
        detail: `${summary}\n\n⚠️ This AI-generated summary is for informational purposes only and does not constitute clinical advice.`,
        indicator: 'info',
        source: {
          label: 'Tabula Medica AI Context',
          topic: { code: 'ai-summary', system: 'tabula-ai', display: 'AI Context Summary' }
        },
        isInformationalOnly: true
      };
    } catch (error) {
      console.warn('[CDSHooks] AI context generation failed:', error);
      return null;
    }
  }

  /**
   * Log suggestion acceptance for audit trail
   */
  logSuggestionAccepted(hookType: CDSHookType, patientId: string, suggestionId: string, providerId?: string): void {
    this.logAudit({
      timestamp: new Date().toISOString(),
      hookType,
      patientId,
      providerId,
      cardsGenerated: 0,
      action: 'suggestion_accepted',
      details: `Suggestion ${suggestionId} acknowledged`
    });
  }

  /**
   * Log override action for audit trail
   */
  logOverride(hookType: CDSHookType, patientId: string, cardId: string, reason: string, providerId?: string): void {
    this.logAudit({
      timestamp: new Date().toISOString(),
      hookType,
      patientId,
      providerId,
      cardsGenerated: 0,
      action: 'override',
      details: `Card ${cardId} overridden: ${reason}`
    });
  }

  /**
   * Get audit logs for compliance
   */
  getAuditLogs(filters?: { patientId?: string; hookType?: CDSHookType; startDate?: string; endDate?: string }): CDSAuditLog[] {
    let logs = [...this.auditLogs];

    if (filters?.patientId) {
      logs = logs.filter(l => l.patientId === filters.patientId);
    }
    if (filters?.hookType) {
      logs = logs.filter(l => l.hookType === filters.hookType);
    }
    if (filters?.startDate) {
      logs = logs.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }

    return logs;
  }

  private logAudit(log: CDSAuditLog): void {
    this.auditLogs.push(log);
    // Keep last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
    
    // HIPAA-compliant audit logging using centralized audit system
    logPhiAccess({
      userId: log.userId || 'system',
      patientId: log.patientId,
      resourceType: 'CDSHooks',
      action: 'read',
      userRole: 'provider',
      ipAddress: 'internal',
      userAgent: 'cds-hooks-service',
      requestPath: `/api/cds-hooks/${log.hookType}`,
      requestMethod: 'POST',
      details: `[CDSHooks] ${log.action}: ${log.hookType} - Hook ${log.hookId}, Cards: ${log.cardsReturned || 0}, Info-only compliance: true`
    }).catch(err => {
      console.error('[CDSHooks] HIPAA audit logging failed:', err);
    });
  }

  private generateUUID(): string {
    return 'cds-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  /**
   * Get external CDS service configurations
   */
  getExternalServices(): CDSServiceConfig[] {
    return this.externalServices;
  }

  /**
   * Test external CDS service connectivity
   */
  async testExternalService(serviceId: string): Promise<{ success: boolean; message: string }> {
    const service = this.externalServices.find(s => s.id === serviceId);
    if (!service) {
      return { success: false, message: 'Service not found' };
    }
    
    // In production, would actually test connectivity
    return { 
      success: false, 
      message: 'External service testing disabled in sample mode. Configure real endpoints for production use.' 
    };
  }
}

// Export singleton instance
export const cdsHooksService = new CDSHooksService();
