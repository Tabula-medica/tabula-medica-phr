export interface Patient {
  id: string;
  resourceType: 'Patient';
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    text?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
}

export interface Condition {
  id: string;
  resourceType: 'Condition';
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface Medication {
  id: string;
  resourceType: 'MedicationRequest' | 'MedicationStatement';
  status?: string;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
  }>;
}

export interface Observation {
  id: string;
  resourceType: 'Observation';
  status?: string;
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  effectiveDateTime?: string;
}

export interface Appointment {
  id: string;
  resourceType: 'Appointment';
  status?: string;
  start?: string;
  end?: string;
  description?: string;
  participant?: Array<{
    actor?: {
      reference?: string;
      display?: string;
    };
    status?: string;
  }>;
}

export interface HealthRecord {
  patient: Patient;
  conditions: Condition[];
  medications: Medication[];
  observations: Observation[];
  appointments: Appointment[];
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AISummary {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  generatedAt: string;
}
