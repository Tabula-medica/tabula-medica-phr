import crypto from "crypto";
import OpenAI from "openai";
import type { SupportedLanguage } from "./unified-ai-onboarding-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][AccessibilityPopulation] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

export type PopulationType = "general" | "geriatric" | "pediatric" | "cancer" | "special_needs" | "disability" | "caregiver";
export type DisabilityType = "visual" | "hearing" | "motor" | "cognitive" | "multiple" | "none";

export interface AccessibilitySettings {
  userId: string;
  population: PopulationType;
  disabilities: DisabilityType[];
  language: SupportedLanguage;
  textSize: "small" | "medium" | "large" | "extra_large";
  contrastMode: "normal" | "high" | "dark";
  screenReaderOptimized: boolean;
  voiceNavigationEnabled: boolean;
  simplifiedView: boolean;
  reducedMotion: boolean;
  autoReadContent: boolean;
  keyboardNavigationOnly: boolean;
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
  audioDescriptions: boolean;
  captionsEnabled: boolean;
  hapticFeedback: boolean;
  touchTargetSize: "standard" | "large" | "extra_large";
  readingLevel: "simple" | "standard" | "technical";
  medicationFocusMode: boolean;
  emergencyContactsQuickAccess: boolean;
  caregiverModeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PopulationProfile {
  id: string;
  userId: string;
  populationType: PopulationType;
  age?: number;
  primaryConditions: string[];
  careTeamContacts: CareTeamContact[];
  emergencyContacts: EmergencyContact[];
  specialInstructions: string[];
  preferredCommunication: ("text" | "voice" | "video" | "in_person")[];
  medicationReminders: boolean;
  appointmentReminders: boolean;
  healthEducationPreferences: string[];
  customizations: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CareTeamContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  facilityName?: string;
  isPrimary: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isHealthcareProxy: boolean;
  canAccessRecords: boolean;
}

export interface PopulationSpecificUI {
  population: PopulationType;
  dashboardLayout: DashboardLayout;
  quickActions: QuickAction[];
  prioritizedSections: string[];
  hiddenSections: string[];
  navigationStyle: "tabs" | "sidebar" | "bottom_nav" | "voice_first";
  defaultPage: string;
  welcomeMessage: string;
  helpResources: HelpResource[];
}

export interface DashboardLayout {
  columns: number;
  cardSize: "compact" | "standard" | "large";
  showImages: boolean;
  showCharts: boolean;
  primaryColor: string;
  fontFamily: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  voiceCommand: string;
  priority: number;
  population: PopulationType[];
}

export interface HelpResource {
  id: string;
  title: string;
  description: string;
  type: "video" | "article" | "audio" | "interactive";
  url: string;
  language: SupportedLanguage;
  population: PopulationType[];
}

const accessibilitySettings: Map<string, AccessibilitySettings> = new Map();
const populationProfiles: Map<string, PopulationProfile> = new Map();

const defaultPopulationUI: Record<PopulationType, PopulationSpecificUI> = {
  general: {
    population: "general",
    dashboardLayout: { columns: 3, cardSize: "standard", showImages: true, showCharts: true, primaryColor: "blue", fontFamily: "Inter" },
    quickActions: [
      { id: "qa1", label: "View Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 1, population: ["general"] },
      { id: "qa2", label: "Appointments", icon: "calendar", route: "/appointments", voiceCommand: "show appointments", priority: 2, population: ["general"] },
      { id: "qa3", label: "Messages", icon: "mail", route: "/messages", voiceCommand: "show messages", priority: 3, population: ["general"] },
    ],
    prioritizedSections: ["appointments", "medications", "messages", "documents"],
    hiddenSections: [],
    navigationStyle: "sidebar",
    defaultPage: "/",
    welcomeMessage: "Welcome to Tabula Medica",
    helpResources: [],
  },
  geriatric: {
    population: "geriatric",
    dashboardLayout: { columns: 2, cardSize: "large", showImages: true, showCharts: false, primaryColor: "blue", fontFamily: "Arial" },
    quickActions: [
      { id: "gqa1", label: "My Medications", icon: "pill", route: "/medications", voiceCommand: "show my medications", priority: 1, population: ["geriatric"] },
      { id: "gqa2", label: "Call Doctor", icon: "phone", route: "/care-team", voiceCommand: "call my doctor", priority: 2, population: ["geriatric"] },
      { id: "gqa3", label: "Emergency Contact", icon: "alert", route: "/emergency", voiceCommand: "call emergency contact", priority: 3, population: ["geriatric"] },
      { id: "gqa4", label: "Appointments", icon: "calendar", route: "/appointments", voiceCommand: "show appointments", priority: 4, population: ["geriatric"] },
    ],
    prioritizedSections: ["medications", "care_team", "emergency", "appointments"],
    hiddenSections: ["analytics", "research", "advanced_settings"],
    navigationStyle: "bottom_nav",
    defaultPage: "/medications",
    welcomeMessage: "Hello! Tap any button to get started.",
    helpResources: [
      { id: "gh1", title: "How to View Your Medications", description: "Simple guide to viewing your medicine list", type: "video", url: "/help/medications", language: "en", population: ["geriatric"] },
    ],
  },
  pediatric: {
    population: "pediatric",
    dashboardLayout: { columns: 2, cardSize: "large", showImages: true, showCharts: true, primaryColor: "teal", fontFamily: "Nunito" },
    quickActions: [
      { id: "pqa1", label: "Vaccines", icon: "vaccine", route: "/immunizations", voiceCommand: "show vaccines", priority: 1, population: ["pediatric"] },
      { id: "pqa2", label: "Growth Chart", icon: "chart", route: "/growth", voiceCommand: "show growth chart", priority: 2, population: ["pediatric"] },
      { id: "pqa3", label: "Appointments", icon: "calendar", route: "/appointments", voiceCommand: "show appointments", priority: 3, population: ["pediatric"] },
      { id: "pqa4", label: "Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 4, population: ["pediatric"] },
    ],
    prioritizedSections: ["immunizations", "growth", "appointments", "wellness"],
    hiddenSections: ["billing", "advanced_settings"],
    navigationStyle: "tabs",
    defaultPage: "/",
    welcomeMessage: "Welcome to your child's health portal",
    helpResources: [],
  },
  cancer: {
    population: "cancer",
    dashboardLayout: { columns: 2, cardSize: "standard", showImages: true, showCharts: true, primaryColor: "purple", fontFamily: "Inter" },
    quickActions: [
      { id: "cqa1", label: "Treatment Schedule", icon: "calendar", route: "/treatments", voiceCommand: "show treatments", priority: 1, population: ["cancer"] },
      { id: "cqa2", label: "Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 2, population: ["cancer"] },
      { id: "cqa3", label: "Lab Results", icon: "flask", route: "/labs", voiceCommand: "show lab results", priority: 3, population: ["cancer"] },
      { id: "cqa4", label: "Care Team", icon: "users", route: "/care-team", voiceCommand: "show care team", priority: 4, population: ["cancer"] },
      { id: "cqa5", label: "Symptom Tracker", icon: "activity", route: "/symptoms", voiceCommand: "log symptoms", priority: 5, population: ["cancer"] },
    ],
    prioritizedSections: ["treatments", "medications", "labs", "symptoms", "care_team", "support"],
    hiddenSections: [],
    navigationStyle: "sidebar",
    defaultPage: "/treatments",
    welcomeMessage: "Your cancer care dashboard",
    helpResources: [
      { id: "ch1", title: "Understanding Your Treatment Plan", description: "Guide to navigating your treatment schedule", type: "article", url: "/help/treatment-plan", language: "en", population: ["cancer"] },
    ],
  },
  special_needs: {
    population: "special_needs",
    dashboardLayout: { columns: 2, cardSize: "large", showImages: true, showCharts: false, primaryColor: "green", fontFamily: "OpenDyslexic" },
    quickActions: [
      { id: "snqa1", label: "Daily Schedule", icon: "clock", route: "/schedule", voiceCommand: "show schedule", priority: 1, population: ["special_needs"] },
      { id: "snqa2", label: "Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 2, population: ["special_needs"] },
      { id: "snqa3", label: "Call for Help", icon: "phone", route: "/help-call", voiceCommand: "call for help", priority: 3, population: ["special_needs"] },
    ],
    prioritizedSections: ["schedule", "medications", "help", "care_team"],
    hiddenSections: ["analytics", "research", "advanced_settings", "billing"],
    navigationStyle: "bottom_nav",
    defaultPage: "/schedule",
    welcomeMessage: "Welcome! Tap a button to start.",
    helpResources: [],
  },
  disability: {
    population: "disability",
    dashboardLayout: { columns: 2, cardSize: "large", showImages: true, showCharts: true, primaryColor: "blue", fontFamily: "Inter" },
    quickActions: [
      { id: "dqa1", label: "Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 1, population: ["disability"] },
      { id: "dqa2", label: "Appointments", icon: "calendar", route: "/appointments", voiceCommand: "show appointments", priority: 2, population: ["disability"] },
      { id: "dqa3", label: "Assistive Services", icon: "accessibility", route: "/assistive", voiceCommand: "show assistive services", priority: 3, population: ["disability"] },
      { id: "dqa4", label: "Care Team", icon: "users", route: "/care-team", voiceCommand: "show care team", priority: 4, population: ["disability"] },
    ],
    prioritizedSections: ["medications", "appointments", "assistive", "care_team"],
    hiddenSections: [],
    navigationStyle: "voice_first",
    defaultPage: "/",
    welcomeMessage: "Welcome to your accessible health portal",
    helpResources: [],
  },
  caregiver: {
    population: "caregiver",
    dashboardLayout: { columns: 3, cardSize: "standard", showImages: true, showCharts: true, primaryColor: "indigo", fontFamily: "Inter" },
    quickActions: [
      { id: "cgqa1", label: "Patient Overview", icon: "user", route: "/patient-overview", voiceCommand: "show patient overview", priority: 1, population: ["caregiver"] },
      { id: "cgqa2", label: "Medications", icon: "pill", route: "/medications", voiceCommand: "show medications", priority: 2, population: ["caregiver"] },
      { id: "cgqa3", label: "Appointments", icon: "calendar", route: "/appointments", voiceCommand: "show appointments", priority: 3, population: ["caregiver"] },
      { id: "cgqa4", label: "Care Notes", icon: "clipboard", route: "/care-notes", voiceCommand: "show care notes", priority: 4, population: ["caregiver"] },
      { id: "cgqa5", label: "Provider Messages", icon: "mail", route: "/messages", voiceCommand: "show messages", priority: 5, population: ["caregiver"] },
    ],
    prioritizedSections: ["patient_overview", "medications", "appointments", "care_notes", "messages"],
    hiddenSections: [],
    navigationStyle: "sidebar",
    defaultPage: "/patient-overview",
    welcomeMessage: "Caregiver Dashboard",
    helpResources: [
      { id: "cgh1", title: "Caregiver Quick Start Guide", description: "How to manage patient records as a caregiver", type: "article", url: "/help/caregiver-guide", language: "en", population: ["caregiver"] },
    ],
  },
};

export function initializeAccessibilitySettings(
  userId: string,
  population: PopulationType = "general",
  language: SupportedLanguage = "en"
): AccessibilitySettings {
  const settings: AccessibilitySettings = {
    userId,
    population,
    disabilities: [],
    language,
    textSize: population === "geriatric" ? "large" : "medium",
    contrastMode: "normal",
    screenReaderOptimized: false,
    voiceNavigationEnabled: population === "disability",
    simplifiedView: population === "geriatric" || population === "special_needs",
    reducedMotion: false,
    autoReadContent: false,
    keyboardNavigationOnly: false,
    colorBlindMode: "none",
    audioDescriptions: false,
    captionsEnabled: false,
    hapticFeedback: true,
    touchTargetSize: population === "geriatric" ? "extra_large" : "standard",
    readingLevel: population === "geriatric" || population === "special_needs" ? "simple" : "standard",
    medicationFocusMode: population === "geriatric" || population === "cancer",
    emergencyContactsQuickAccess: population === "geriatric" || population === "disability",
    caregiverModeEnabled: population === "caregiver",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  accessibilitySettings.set(userId, settings);
  logHipaaAudit("INIT_ACCESSIBILITY", userId, `Initialized accessibility settings for ${population}`);
  return settings;
}

export function getAccessibilitySettings(userId: string): AccessibilitySettings | undefined {
  return accessibilitySettings.get(userId);
}

export function updateAccessibilitySettings(
  userId: string,
  updates: Partial<AccessibilitySettings>
): AccessibilitySettings | undefined {
  const existing = accessibilitySettings.get(userId);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  accessibilitySettings.set(userId, updated);
  logHipaaAudit("UPDATE_ACCESSIBILITY", userId, `Updated accessibility settings: ${Object.keys(updates).join(", ")}`);
  return updated;
}

export function initializePopulationProfile(
  userId: string,
  populationType: PopulationType,
  age?: number
): PopulationProfile {
  const profile: PopulationProfile = {
    id: generateId("pop"),
    userId,
    populationType,
    age,
    primaryConditions: [],
    careTeamContacts: [],
    emergencyContacts: [],
    specialInstructions: [],
    preferredCommunication: ["text"],
    medicationReminders: true,
    appointmentReminders: true,
    healthEducationPreferences: [],
    customizations: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  populationProfiles.set(userId, profile);
  logHipaaAudit("INIT_POPULATION_PROFILE", userId, `Initialized ${populationType} population profile`);
  return profile;
}

export function getPopulationProfile(userId: string): PopulationProfile | undefined {
  return populationProfiles.get(userId);
}

export function updatePopulationProfile(
  userId: string,
  updates: Partial<PopulationProfile>
): PopulationProfile | undefined {
  const existing = populationProfiles.get(userId);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  populationProfiles.set(userId, updated);
  logHipaaAudit("UPDATE_POPULATION_PROFILE", userId, `Updated population profile`);
  return updated;
}

export function getPopulationUI(population: PopulationType): PopulationSpecificUI {
  return defaultPopulationUI[population] || defaultPopulationUI.general;
}

export function addEmergencyContact(
  userId: string,
  contact: Omit<EmergencyContact, "id">
): EmergencyContact | undefined {
  const profile = populationProfiles.get(userId);
  if (!profile) return undefined;

  const newContact: EmergencyContact = {
    id: generateId("ec"),
    ...contact,
  };

  profile.emergencyContacts.push(newContact);
  profile.updatedAt = new Date().toISOString();
  logHipaaAudit("ADD_EMERGENCY_CONTACT", userId, `Added emergency contact: ${contact.name}`);
  return newContact;
}

export function addCareTeamContact(
  userId: string,
  contact: Omit<CareTeamContact, "id">
): CareTeamContact | undefined {
  const profile = populationProfiles.get(userId);
  if (!profile) return undefined;

  const newContact: CareTeamContact = {
    id: generateId("ct"),
    ...contact,
  };

  profile.careTeamContacts.push(newContact);
  profile.updatedAt = new Date().toISOString();
  logHipaaAudit("ADD_CARE_TEAM_CONTACT", userId, `Added care team contact: ${contact.name}`);
  return newContact;
}

export async function generateSimplifiedContent(
  content: string,
  readingLevel: "simple" | "standard" | "technical",
  language: SupportedLanguage = "en"
): Promise<string> {
  if (readingLevel === "technical") return content;

  try {
    const levelInstruction = readingLevel === "simple"
      ? "Rewrite this for a 6th-grade reading level. Use very simple words and short sentences. Avoid all medical jargon."
      : "Rewrite this for a high school reading level. Explain any medical terms used.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `${levelInstruction} Keep the same meaning but make it easier to understand. NEVER provide medical advice.` 
        },
        { role: "user", content },
      ],
      max_completion_tokens: 500,
    });

    return response.choices[0]?.message?.content || content;
  } catch (error) {
    console.error("[AccessibilityPopulation] Simplify content error:", error);
    return content;
  }
}

export function getSupportedPopulations(): Record<PopulationType, { name: string; description: string }> {
  return {
    general: { name: "General", description: "Standard health portal experience" },
    geriatric: { name: "Geriatric/Senior", description: "Optimized for seniors with larger text, simplified navigation, and medication focus" },
    pediatric: { name: "Pediatric", description: "Child-focused with growth tracking, immunizations, and parent-friendly interface" },
    cancer: { name: "Cancer Care", description: "Treatment-focused with symptom tracking, lab monitoring, and care team coordination" },
    special_needs: { name: "Special Needs", description: "Simplified interface with visual schedules and caregiver support" },
    disability: { name: "Disability", description: "Fully accessible with voice navigation, screen reader optimization, and adaptive controls" },
    caregiver: { name: "Caregiver", description: "Multi-patient management with care notes and provider coordination" },
  };
}

export function getSupportedDisabilityTypes(): Record<DisabilityType, { name: string; accommodations: string[] }> {
  return {
    visual: { 
      name: "Visual Impairment", 
      accommodations: ["Screen reader optimization", "High contrast mode", "Large text", "Audio descriptions"] 
    },
    hearing: { 
      name: "Hearing Impairment", 
      accommodations: ["Captions", "Visual alerts", "Text-based communication"] 
    },
    motor: { 
      name: "Motor Impairment", 
      accommodations: ["Keyboard navigation", "Voice navigation", "Large touch targets"] 
    },
    cognitive: { 
      name: "Cognitive Disability", 
      accommodations: ["Simplified view", "Simple language", "Visual schedules", "Reduced distractions"] 
    },
    multiple: { 
      name: "Multiple Disabilities", 
      accommodations: ["Full accessibility suite", "Personalized accommodations"] 
    },
    none: { 
      name: "None", 
      accommodations: [] 
    },
  };
}

console.log("[AccessibilityPopulation] Service initialized with geriatric, pediatric, cancer, special needs, and disability support");
