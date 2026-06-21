import { storage } from "../storage";

export interface Demographics {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  pronouns?: string;
  preferredName?: string;
  maritalStatus?: string;
  ethnicity?: string;
  race?: string;
  primaryLanguage: string;
  interpreterNeeded?: boolean;
  socialSecurityLastFour?: string;
}

export interface ContactDetails {
  email: string;
  phone: string;
  alternatePhone?: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  preferredContactMethod: 'email' | 'phone' | 'mail';
  bestTimeToContact?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  isPrimary: boolean;
  canMakeDecisions: boolean;
  notes?: string;
}

export interface InsuranceInfo {
  id: string;
  type: 'primary' | 'secondary' | 'tertiary';
  insurerName: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberDob: string;
  relationshipToSubscriber: string;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  outOfPocketMax?: number;
  coverageStatus: 'active' | 'pending' | 'terminated';
  phoneNumber?: string;
  preAuthRequired?: boolean;
}

export interface MedicalHistorySummary {
  conditions: Array<{
    id: string;
    name: string;
    code: string;
    codeSystem: string;
    status: string;
    onsetDate?: string;
    severity?: string;
  }>;
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    status: string;
    prescribedDate?: string;
  }>;
  allergies: Array<{
    id: string;
    substance: string;
    reaction: string;
    severity: string;
    onsetDate?: string;
  }>;
  procedures: Array<{
    id: string;
    name: string;
    date: string;
    status: string;
    performer?: string;
  }>;
  immunizations: Array<{
    id: string;
    vaccine: string;
    date: string;
    status: string;
    doseNumber?: number;
  }>;
  recentVitals: {
    bloodPressure?: { systolic: number; diastolic: number; date: string };
    heartRate?: { value: number; date: string };
    weight?: { value: number; unit: string; date: string };
    height?: { value: number; unit: string; date: string };
    bmi?: { value: number; date: string };
  };
  upcomingAppointments: Array<{
    id: string;
    type: string;
    provider: string;
    date: string;
    location?: string;
  }>;
}

export interface PatientProfile {
  id: string;
  demographics: Demographics;
  contactDetails: ContactDetails;
  emergencyContacts: EmergencyContact[];
  insuranceInfo: InsuranceInfo[];
  medicalHistory: MedicalHistorySummary;
  preferences: {
    notificationPreferences: {
      appointmentReminders: boolean;
      medicationReminders: boolean;
      labResults: boolean;
      marketingCommunications: boolean;
    };
    accessibilitySettings: {
      fontSize: 'normal' | 'large' | 'extra-large';
      highContrast: boolean;
      screenReaderOptimized: boolean;
    };
    communicationPreferences: {
      preferredPharmacy?: string;
      preferredProvider?: string;
    };
  };
  lastUpdated: string;
  createdAt: string;
  completionPercentage: number;
}

class ComprehensivePatientProfileService {
  private profiles: Map<string, PatientProfile> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[PatientProfile] Comprehensive Patient Profile Service initialized");
  }

  private initializeSampleData(): void {
    const sampleProfile: PatientProfile = {
      id: "patient-1",
      demographics: {
        firstName: "Sarah",
        lastName: "Johnson",
        middleName: "Marie",
        dateOfBirth: "1985-06-15",
        gender: "female",
        pronouns: "she/her",
        preferredName: "Sarah",
        maritalStatus: "married",
        ethnicity: "Not Hispanic or Latino",
        race: "White",
        primaryLanguage: "English",
        interpreterNeeded: false,
        socialSecurityLastFour: "4532"
      },
      contactDetails: {
        email: "sarah.johnson@email.com",
        phone: "(555) 123-4567",
        alternatePhone: "(555) 987-6543",
        address: {
          street1: "123 Main Street",
          street2: "Apt 4B",
          city: "San Francisco",
          state: "CA",
          zipCode: "94102",
          country: "United States"
        },
        preferredContactMethod: "email",
        bestTimeToContact: "Morning (9am-12pm)"
      },
      emergencyContacts: [
        {
          id: "ec-1",
          name: "Michael Johnson",
          relationship: "Spouse",
          phone: "(555) 234-5678",
          alternatePhone: "(555) 345-6789",
          email: "michael.j@email.com",
          isPrimary: true,
          canMakeDecisions: true,
          notes: "Works from home, available anytime"
        },
        {
          id: "ec-2",
          name: "Emily Chen",
          relationship: "Sister",
          phone: "(555) 456-7890",
          email: "emily.chen@email.com",
          isPrimary: false,
          canMakeDecisions: false
        }
      ],
      insuranceInfo: [
        {
          id: "ins-1",
          type: "primary",
          insurerName: "Blue Cross Blue Shield",
          planName: "PPO Gold",
          memberId: "XYZ123456789",
          groupNumber: "GRP001234",
          subscriberName: "Sarah Johnson",
          subscriberDob: "1985-06-15",
          relationshipToSubscriber: "Self",
          effectiveDate: "2024-01-01",
          copay: 30,
          deductible: 1500,
          outOfPocketMax: 6000,
          coverageStatus: "active",
          phoneNumber: "1-800-555-0100",
          preAuthRequired: false
        },
        {
          id: "ins-2",
          type: "secondary",
          insurerName: "Aetna",
          planName: "Dental Plus",
          memberId: "DNT987654321",
          subscriberName: "Michael Johnson",
          subscriberDob: "1983-03-22",
          relationshipToSubscriber: "Spouse",
          effectiveDate: "2024-01-01",
          coverageStatus: "active",
          phoneNumber: "1-800-555-0200"
        }
      ],
      medicalHistory: {
        conditions: [
          {
            id: "cond-1",
            name: "Type 2 Diabetes Mellitus",
            code: "44054006",
            codeSystem: "SNOMED-CT",
            status: "active",
            onsetDate: "2020-03-15",
            severity: "moderate"
          },
          {
            id: "cond-2",
            name: "Essential Hypertension",
            code: "59621000",
            codeSystem: "SNOMED-CT",
            status: "active",
            onsetDate: "2019-08-22",
            severity: "mild"
          }
        ],
        medications: [
          {
            id: "med-1",
            name: "Metformin",
            dosage: "500mg",
            frequency: "Twice daily",
            status: "active",
            prescribedDate: "2020-03-20"
          },
          {
            id: "med-2",
            name: "Lisinopril",
            dosage: "10mg",
            frequency: "Once daily",
            status: "active",
            prescribedDate: "2019-09-01"
          }
        ],
        allergies: [
          {
            id: "allergy-1",
            substance: "Penicillin",
            reaction: "Rash, hives",
            severity: "moderate",
            onsetDate: "2005-05-10"
          },
          {
            id: "allergy-2",
            substance: "Shellfish",
            reaction: "Anaphylaxis",
            severity: "severe",
            onsetDate: "2010-07-15"
          }
        ],
        procedures: [
          {
            id: "proc-1",
            name: "Appendectomy",
            date: "2015-11-20",
            status: "completed",
            performer: "Dr. Robert Wilson"
          }
        ],
        immunizations: [
          {
            id: "imm-1",
            vaccine: "Influenza, seasonal",
            date: "2025-10-15",
            status: "completed",
            doseNumber: 1
          },
          {
            id: "imm-2",
            vaccine: "COVID-19 mRNA",
            date: "2025-09-01",
            status: "completed",
            doseNumber: 5
          }
        ],
        recentVitals: {
          bloodPressure: { systolic: 128, diastolic: 82, date: "2026-01-15" },
          heartRate: { value: 72, date: "2026-01-15" },
          weight: { value: 155, unit: "lbs", date: "2026-01-15" },
          height: { value: 65, unit: "in", date: "2026-01-15" },
          bmi: { value: 25.8, date: "2026-01-15" }
        },
        upcomingAppointments: [
          {
            id: "appt-1",
            type: "Follow-up",
            provider: "Dr. Sarah Chen",
            date: "2026-02-15T09:00:00",
            location: "Diabetes Care Center"
          },
          {
            id: "appt-2",
            type: "Annual Physical",
            provider: "Dr. Michael Roberts",
            date: "2026-02-22T10:30:00",
            location: "Primary Care Clinic"
          }
        ]
      },
      preferences: {
        notificationPreferences: {
          appointmentReminders: true,
          medicationReminders: true,
          labResults: true,
          marketingCommunications: false
        },
        accessibilitySettings: {
          fontSize: "normal",
          highContrast: false,
          screenReaderOptimized: false
        },
        communicationPreferences: {
          preferredPharmacy: "CVS Pharmacy - Market Street",
          preferredProvider: "Dr. Sarah Chen"
        }
      },
      lastUpdated: new Date().toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
      completionPercentage: 92
    };

    this.profiles.set("patient-1", sampleProfile);
    console.log("[PatientProfile] Sample patient profile initialized");
  }

  async getProfile(patientId: string): Promise<PatientProfile | null> {
    return this.profiles.get(patientId) || null;
  }

  async updateDemographics(patientId: string, demographics: Partial<Demographics>): Promise<PatientProfile | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    profile.demographics = { ...profile.demographics, ...demographics };
    profile.lastUpdated = new Date().toISOString();
    profile.completionPercentage = this.calculateCompletionPercentage(profile);
    this.profiles.set(patientId, profile);
    return profile;
  }

  async updateContactDetails(patientId: string, contactDetails: Partial<ContactDetails>): Promise<PatientProfile | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    profile.contactDetails = { 
      ...profile.contactDetails, 
      ...contactDetails,
      address: { ...profile.contactDetails.address, ...(contactDetails.address || {}) }
    };
    profile.lastUpdated = new Date().toISOString();
    profile.completionPercentage = this.calculateCompletionPercentage(profile);
    this.profiles.set(patientId, profile);
    return profile;
  }

  async addEmergencyContact(patientId: string, contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    const newContact: EmergencyContact = {
      ...contact,
      id: `ec-${Date.now()}`
    };

    if (contact.isPrimary) {
      profile.emergencyContacts.forEach(c => c.isPrimary = false);
    }

    profile.emergencyContacts.push(newContact);
    profile.lastUpdated = new Date().toISOString();
    profile.completionPercentage = this.calculateCompletionPercentage(profile);
    this.profiles.set(patientId, profile);
    return newContact;
  }

  async updateEmergencyContact(patientId: string, contactId: string, updates: Partial<EmergencyContact>): Promise<EmergencyContact | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    const index = profile.emergencyContacts.findIndex(c => c.id === contactId);
    if (index === -1) return null;

    if (updates.isPrimary) {
      profile.emergencyContacts.forEach(c => c.isPrimary = false);
    }

    profile.emergencyContacts[index] = { ...profile.emergencyContacts[index], ...updates };
    profile.lastUpdated = new Date().toISOString();
    this.profiles.set(patientId, profile);
    return profile.emergencyContacts[index];
  }

  async deleteEmergencyContact(patientId: string, contactId: string): Promise<boolean> {
    const profile = this.profiles.get(patientId);
    if (!profile) return false;

    const initialLength = profile.emergencyContacts.length;
    profile.emergencyContacts = profile.emergencyContacts.filter(c => c.id !== contactId);
    
    if (profile.emergencyContacts.length < initialLength) {
      profile.lastUpdated = new Date().toISOString();
      profile.completionPercentage = this.calculateCompletionPercentage(profile);
      this.profiles.set(patientId, profile);
      return true;
    }
    return false;
  }

  async addInsurance(patientId: string, insurance: Omit<InsuranceInfo, 'id'>): Promise<InsuranceInfo | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    const newInsurance: InsuranceInfo = {
      ...insurance,
      id: `ins-${Date.now()}`
    };

    profile.insuranceInfo.push(newInsurance);
    profile.lastUpdated = new Date().toISOString();
    profile.completionPercentage = this.calculateCompletionPercentage(profile);
    this.profiles.set(patientId, profile);
    return newInsurance;
  }

  async updateInsurance(patientId: string, insuranceId: string, updates: Partial<InsuranceInfo>): Promise<InsuranceInfo | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    const index = profile.insuranceInfo.findIndex(i => i.id === insuranceId);
    if (index === -1) return null;

    profile.insuranceInfo[index] = { ...profile.insuranceInfo[index], ...updates };
    profile.lastUpdated = new Date().toISOString();
    this.profiles.set(patientId, profile);
    return profile.insuranceInfo[index];
  }

  async deleteInsurance(patientId: string, insuranceId: string): Promise<boolean> {
    const profile = this.profiles.get(patientId);
    if (!profile) return false;

    const initialLength = profile.insuranceInfo.length;
    profile.insuranceInfo = profile.insuranceInfo.filter(i => i.id !== insuranceId);
    
    if (profile.insuranceInfo.length < initialLength) {
      profile.lastUpdated = new Date().toISOString();
      profile.completionPercentage = this.calculateCompletionPercentage(profile);
      this.profiles.set(patientId, profile);
      return true;
    }
    return false;
  }

  async updatePreferences(patientId: string, preferences: Partial<PatientProfile['preferences']>): Promise<PatientProfile | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;

    profile.preferences = {
      notificationPreferences: { ...profile.preferences.notificationPreferences, ...(preferences.notificationPreferences || {}) },
      accessibilitySettings: { ...profile.preferences.accessibilitySettings, ...(preferences.accessibilitySettings || {}) },
      communicationPreferences: { ...profile.preferences.communicationPreferences, ...(preferences.communicationPreferences || {}) }
    };
    profile.lastUpdated = new Date().toISOString();
    this.profiles.set(patientId, profile);
    return profile;
  }

  private calculateCompletionPercentage(profile: PatientProfile): number {
    let completed = 0;
    let total = 0;

    const checkField = (value: any) => {
      total++;
      if (value !== undefined && value !== null && value !== '') completed++;
    };

    checkField(profile.demographics.firstName);
    checkField(profile.demographics.lastName);
    checkField(profile.demographics.dateOfBirth);
    checkField(profile.demographics.gender);
    checkField(profile.demographics.primaryLanguage);
    checkField(profile.contactDetails.email);
    checkField(profile.contactDetails.phone);
    checkField(profile.contactDetails.address.street1);
    checkField(profile.contactDetails.address.city);
    checkField(profile.contactDetails.address.state);
    checkField(profile.contactDetails.address.zipCode);
    
    total++;
    if (profile.emergencyContacts.length > 0) completed++;
    
    total++;
    if (profile.insuranceInfo.length > 0) completed++;

    return Math.round((completed / total) * 100);
  }

  async getMedicalHistorySummary(patientId: string): Promise<MedicalHistorySummary | null> {
    const profile = this.profiles.get(patientId);
    if (!profile) return null;
    return profile.medicalHistory;
  }
}

export const comprehensivePatientProfileService = new ComprehensivePatientProfileService();
