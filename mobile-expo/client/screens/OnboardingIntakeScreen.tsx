import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, FadeIn } from "react-native-reanimated";
import { useMutation, useQuery } from "@tanstack/react-query";
import WebView from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getOnboardingTranslation, COMMON_CONDITIONS, COMMON_SURGERIES, FAMILY_HISTORY_CONDITIONS, FAMILY_RELATION_OPTIONS } from "@/screens/onboarding-translations";
import VoiceFAB from "@/components/VoiceFAB";
import {
  COMMON_CONDITIONS_WITH_ICD, COMMON_SURGERIES_WITH_CPT,
  COMMON_ALLERGIES, COMMON_MEDICATIONS, SOCIAL_HISTORY_ICD_CODES,
  COUNTRY_CODES,
  type MedicationOption,
} from "@/screens/clinical-data";

interface OnboardingIntakeScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const STEPS = [
  { key: "personal", title: "Personal Information", icon: "user" as const, subtitle: "Tell us about yourself" },
  { key: "contact", title: "Contact & Address", icon: "map-pin" as const, subtitle: "How to reach you" },
  { key: "medical", title: "Medical History", icon: "heart" as const, subtitle: "Your health background" },
  { key: "allergiesMeds", title: "Allergies & Medications", icon: "alert-triangle" as const, subtitle: "Current treatments & sensitivities" },
  { key: "lifestyle", title: "Lifestyle & Wellness", icon: "sun" as const, subtitle: "Daily habits matter" },
  { key: "providers", title: "Your Care Team", icon: "briefcase" as const, subtitle: "Physicians & pharmacy" },
  { key: "connect", title: "Import Records", icon: "download" as const, subtitle: "Connect your health systems" },
  { key: "consent", title: "Review & Agree", icon: "check-circle" as const, subtitle: "Privacy & terms" },
];

const AI_TIPS: Record<string, string> = {
  personal: "Your name and date of birth help us match you to your medical records across healthcare systems. Middle name is important for accurate record matching.",
  contact: "Emergency contacts are vital for your safety. We'll only use your contact info for health-related notifications you opt into.",
  medical: "Sharing your medical history helps our AI provide more relevant health insights and flag potential drug interactions.",
  allergiesMeds: "Accurate allergy and medication data can prevent dangerous interactions. Even over-the-counter supplements matter.",
  lifestyle: "Lifestyle factors account for up to 80% of health outcomes. This helps us tailor recommendations to your real life.",
  providers: "Adding your physician and pharmacy helps us coordinate your care and send prescriptions when needed.",
  connect: "Connecting your health records imports labs, imaging, medications, and visit notes automatically from your providers.",
  consent: "Your data is encrypted end-to-end and HIPAA compliant. You control who sees your information.",
};

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"];
const PRONOUN_OPTIONS = ["He/Him", "She/Her", "They/Them", "Other"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated", "Domestic Partner"];
const SMOKING_OPTIONS = ["Never", "Former", "Current - Light", "Current - Heavy"];
const ALCOHOL_OPTIONS = ["None", "Occasional", "Moderate", "Heavy"];
const EXERCISE_OPTIONS = ["Sedentary", "Light (1-2 days/week)", "Moderate (3-4 days/week)", "Active (5+ days/week)"];
const STRESS_OPTIONS = ["Low", "Moderate", "High", "Very High"];
const DIET_OPTIONS = ["No restrictions", "Vegetarian", "Vegan", "Gluten-free", "Keto", "Mediterranean", "Halal", "Kosher", "Other"];
const RELATIONSHIP_OPTIONS = ["Spouse", "Parent", "Child", "Sibling", "Grandparent", "Legal Guardian", "Caregiver", "Friend", "Other"];
const ETHNICITY_OPTIONS = ["Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"];
const RACE_OPTIONS = ["American Indian or Alaska Native", "Asian", "South Asian / Indian", "Black or African American", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races", "Other", "Prefer not to say"];
const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "Portuguese", "Arabic", "Urdu", "Farsi",
  "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Odia", "Nepali",
  "Mandarin", "Cantonese",
  "Swahili", "Amharic", "Hausa", "Yoruba", "Igbo", "Zulu", "Somali", "Tigrinya", "Afrikaans",
  "Russian", "Korean", "Japanese", "Vietnamese", "Tagalog", "Thai", "Burmese", "Khmer", "Indonesian", "Malay",
  "German", "Italian", "Polish", "Haitian Creole", "Turkish", "Pashto",
  "Other",
];
const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe"];
const CONDITION_STATUS = ["Active", "Resolved", "Managed"];

export default function OnboardingIntakeScreen({ onComplete, onSkip }: OnboardingIntakeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showFastenConnect, setShowFastenConnect] = useState(false);
  const [fastenConnectionMade, setFastenConnectionMade] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedSurgeries, setSelectedSurgeries] = useState<string[]>([]);
  const [selectedFamilyConditions, setSelectedFamilyConditions] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedMedications, setSelectedMedications] = useState<{ med: MedicationOption; strength: string; frequency: string }[]>([]);
  const [countryCode, setCountryCode] = useState("+1");
  const [showCountryCodes, setShowCountryCodes] = useState(false);
  const [pharmacySearchQuery, setPharmacySearchQuery] = useState("");
  const [pharmacySearchResults, setPharmacySearchResults] = useState<any[]>([]);
  const [isSearchingPharmacy, setIsSearchingPharmacy] = useState(false);
  const [showPharmacyResults, setShowPharmacyResults] = useState(false);
  const [pharmacyZipSearch, setPharmacyZipSearch] = useState("");
  const [nmnAutoAssigned, setNmnAutoAssigned] = useState(false);

  const [personal, setPersonal] = useState({
    firstName: "", middleName: "", lastName: "",
    dateOfBirth: "", gender: "", pronouns: "",
    maritalStatus: "", preferredLanguage: "English",
    ethnicity: "", race: "",
  });

  const [contact, setContact] = useState({
    phone: "", email: "", addressLine1: "", addressLine2: "",
    city: "", state: "", zipCode: "",
    emergencyName: "", emergencyPhone: "", emergencyRelation: "",
  });

  const [medical, setMedical] = useState({
    conditions: [{ name: "", diagnosedYear: "", status: "Active" }],
    surgeries: [{ name: "", year: "" }],
    familyHistory: [{ condition: "", relation: "" }],
    noConditions: false, noSurgeries: false, noFamilyHistory: false,
  });

  const [allergyMed, setAllergyMed] = useState({
    allergies: [{ allergen: "", reaction: "", severity: "Mild" }],
    medications: [{ name: "", dosage: "", frequency: "" }],
    noAllergies: false, noMedications: false,
  });

  const [lifestyle, setLifestyle] = useState({
    smokingStatus: "", alcoholUse: "", exerciseFrequency: "",
    dietaryPreferences: "", stressLevel: "", occupation: "",
  });

  const [providers, setProviders] = useState({
    primaryPhysician: "", primaryPhysicianPhone: "", primaryPhysicianNpi: "",
    pharmacy: "", pharmacyPhone: "",
    mailOrderPharmacy: "",
    pharmacySavingsPrograms: [] as string[],
    bloodType: "", organDonor: false, advanceDirectives: false,
  });
  const [providerSearchQuery, setProviderSearchQuery] = useState("");
  const [providerSearchResults, setProviderSearchResults] = useState<any[]>([]);
  const [isSearchingProviders, setIsSearchingProviders] = useState(false);
  const [showProviderResults, setShowProviderResults] = useState(false);

  const [consent, setConsent] = useState({
    hipaaConsent: false, termsAccepted: false,
    dataSharingConsent: false,
  });

  const { data: fastenConfig } = useQuery<{
    configured: boolean;
    publicId: string | null;
  }>({
    queryKey: ["/api/fasten/config"],
    retry: 1,
  });

  const { data: existingProfile } = useQuery<any>({
    queryKey: ["/api/patient-onboarding/status"],
  });

  const isFastenAvailable = fastenConfig?.configured && fastenConfig?.publicId;

  const t = useCallback((key: string) => getOnboardingTranslation(key, personal.preferredLanguage), [personal.preferredLanguage]);

  const toggleCondition = useCallback((condition: string) => {
    setSelectedConditions(prev =>
      prev.includes(condition) ? prev.filter(c => c !== condition) : [...prev, condition]
    );
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const toggleSurgery = useCallback((surgery: string) => {
    setSelectedSurgeries(prev =>
      prev.includes(surgery) ? prev.filter(s => s !== surgery) : [...prev, surgery]
    );
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const toggleFamilyCondition = useCallback((condition: string) => {
    setSelectedFamilyConditions(prev =>
      prev.includes(condition) ? prev.filter(c => c !== condition) : [...prev, condition]
    );
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const toggleAllergyChip = useCallback((allergen: string) => {
    setSelectedAllergies(prev =>
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    );
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const toggleMedicationChip = useCallback((med: MedicationOption) => {
    setSelectedMedications(prev => {
      const exists = prev.find(m => m.med.name === med.name);
      if (exists) return prev.filter(m => m.med.name !== med.name);
      return [...prev, { med, strength: med.strengths[0], frequency: med.frequencies[0] }];
    });
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const updateSelectedMedStrength = useCallback((medName: string, strength: string) => {
    setSelectedMedications(prev => prev.map(m => m.med.name === medName ? { ...m, strength } : m));
  }, []);

  const updateSelectedMedFrequency = useCallback((medName: string, frequency: string) => {
    setSelectedMedications(prev => prev.map(m => m.med.name === medName ? { ...m, frequency } : m));
  }, []);

  const formatDOB = useCallback((text: string) => {
    const digits = text.replace(/\D/g, "");
    let formatted = "";
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    } else {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    }
    updatePersonal("dateOfBirth", formatted);
  }, []);

  const searchProviderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProviderSearch = useCallback((text: string) => {
    setProviderSearchQuery(text);
    if (searchProviderTimeout.current) clearTimeout(searchProviderTimeout.current);
    if (text.trim().length < 2) {
      setProviderSearchResults([]);
      setShowProviderResults(false);
      return;
    }
    setIsSearchingProviders(true);
    setShowProviderResults(true);
    searchProviderTimeout.current = setTimeout(async () => {
      try {
        const resp: any = await apiRequest("GET", `/api/provider-search?q=${encodeURIComponent(text)}`);
        setProviderSearchResults(resp.results || []);
      } catch {
        setProviderSearchResults([]);
      } finally {
        setIsSearchingProviders(false);
      }
    }, 400);
  }, []);

  const selectProvider = useCallback((provider: any) => {
    const name = `${provider.firstName} ${provider.lastName}${provider.credential ? `, ${provider.credential}` : ""}`;
    updateProviders("primaryPhysician", name);
    updateProviders("primaryPhysicianPhone", provider.phone);
    updateProviders("primaryPhysicianNpi", provider.npi);
    setProviderSearchQuery(name);
    setShowProviderResults(false);
    setProviderSearchResults([]);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }, []);

  const pharmacySearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePharmacySearch = useCallback((text: string, zip?: string) => {
    setPharmacySearchQuery(text);
    if (pharmacySearchTimeout.current) clearTimeout(pharmacySearchTimeout.current);
    const nameOk = text.trim().length >= 2;
    const zipOk = (zip || pharmacyZipSearch).trim().length >= 3;
    if (!nameOk && !zipOk) {
      setPharmacySearchResults([]);
      setShowPharmacyResults(false);
      return;
    }
    setIsSearchingPharmacy(true);
    setShowPharmacyResults(true);
    pharmacySearchTimeout.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (nameOk) params.set("q", text.trim());
        if (zipOk) params.set("zip", (zip || pharmacyZipSearch).trim());
        const resp: any = await apiRequest("GET", `/api/pharmacy-search?${params.toString()}`);
        setPharmacySearchResults(resp.results || []);
      } catch {
        setPharmacySearchResults([]);
      } finally {
        setIsSearchingPharmacy(false);
      }
    }, 400);
  }, [pharmacyZipSearch]);

  const selectPharmacy = useCallback((pharmacy: any) => {
    updateProviders("pharmacy", pharmacy.name);
    updateProviders("pharmacyPhone", pharmacy.phone);
    setPharmacySearchQuery(pharmacy.name);
    setShowPharmacyResults(false);
    setPharmacySearchResults([]);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }, []);

  const toggleSavingsProgram = useCallback((program: string) => {
    setProviders(p => ({
      ...p,
      pharmacySavingsPrograms: p.pharmacySavingsPrograms.includes(program)
        ? p.pharmacySavingsPrograms.filter(s => s !== program)
        : [...p.pharmacySavingsPrograms, program],
    }));
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emergencyContacts = contact.emergencyName.trim()
        ? [{ name: contact.emergencyName, phone: contact.emergencyPhone, relationship: contact.emergencyRelation }]
        : [];

      await apiRequest("POST", "/api/patient-onboarding", {
        demographics: {
          firstName: personal.firstName,
          middleName: personal.middleName || "NMN",
          lastName: personal.lastName,
          dateOfBirth: personal.dateOfBirth,
          gender: personal.gender,
          pronouns: personal.pronouns,
          phone: countryCode && contact.phone ? `${countryCode} ${contact.phone}` : contact.phone,
          email: contact.email,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          city: contact.city,
          state: contact.state,
          zipCode: contact.zipCode,
          maritalStatus: personal.maritalStatus,
          preferredLanguage: personal.preferredLanguage,
          ethnicity: personal.ethnicity,
          race: personal.race,
        },
        emergencyContacts,
        consent: {
          hipaaConsent: consent.hipaaConsent,
          termsAccepted: consent.termsAccepted,
          dataSharingConsent: consent.dataSharingConsent,
        },
      });

      const manualConditions = medical.noConditions ? [] : medical.conditions.filter(c => c.name.trim());
      const chipConditions = selectedConditions.map(c => {
        const match = COMMON_CONDITIONS_WITH_ICD.find(cc => cc.name === c);
        return { name: c, diagnosedYear: "", status: "Active", icd10: match?.icd10 || "" };
      });
      const conditions = [...chipConditions, ...manualConditions];

      const manualSurgeries = medical.noSurgeries ? [] : medical.surgeries.filter(s => s.name.trim());
      const chipSurgeries = selectedSurgeries.map(s => {
        const match = COMMON_SURGERIES_WITH_CPT.find(cs => cs.name === s);
        return { name: s, year: "", cpt: match?.cpt || "" };
      });
      const surgeries = [...chipSurgeries, ...manualSurgeries];

      const manualFamily = medical.noFamilyHistory ? [] : medical.familyHistory.filter(f => f.condition.trim());
      const chipFamily = selectedFamilyConditions.map(c => ({ condition: c, relation: "" }));
      const familyHistory = [...chipFamily, ...manualFamily];

      const manualMedications = allergyMed.noMedications ? [] : allergyMed.medications.filter(m => m.name.trim());
      const chipMedications = selectedMedications.map(sm => ({ name: sm.med.name, dosage: sm.strength, frequency: sm.frequency }));
      const medications = [...chipMedications, ...manualMedications];

      const manualAllergies = allergyMed.noAllergies ? [] : allergyMed.allergies.filter(a => a.allergen.trim());
      const chipAllergies = selectedAllergies.map(a => ({ allergen: a, reaction: "", severity: "Mild" }));
      const allergies = [...chipAllergies, ...manualAllergies];

      await apiRequest("POST", "/api/onboarding/health-profile-setup", {
        conditions: conditions.map(c => ({ name: c.name, diagnosedYear: c.diagnosedYear, status: c.status, icd10: (c as any).icd10 || "" })),
        surgeries: surgeries.map(s => ({ name: s.name, year: s.year, cpt: (s as any).cpt || "" })),
        familyHistory: familyHistory.map(f => ({ condition: f.condition, relation: f.relation })),
        medications: medications.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
        allergies: allergies.map(a => ({ allergen: a.allergen, reaction: a.reaction, severity: a.severity })),
        activityLevel: lifestyle.exerciseFrequency,
        socialHistory: {
          smokingStatus: lifestyle.smokingStatus,
          smokingIcd10: lifestyle.smokingStatus && lifestyle.smokingStatus !== "Never" ? (lifestyle.smokingStatus.startsWith("Former") ? "Z87.891" : "F17.210") : "",
          alcoholUse: lifestyle.alcoholUse,
          alcoholIcd10: lifestyle.alcoholUse && lifestyle.alcoholUse !== "None" ? (lifestyle.alcoholUse === "Heavy" ? "F10.10" : "Z72.1") : "",
          exerciseFrequency: lifestyle.exerciseFrequency,
          exerciseIcd10: lifestyle.exerciseFrequency === "Sedentary" ? "Z72.3" : "",
          stressLevel: lifestyle.stressLevel,
          stressIcd10: lifestyle.stressLevel && lifestyle.stressLevel !== "Low" ? "Z73.3" : "",
          dietaryPreferences: lifestyle.dietaryPreferences,
          occupation: lifestyle.occupation,
          occupationIcd10: lifestyle.occupation.trim() ? "Z57.9" : "",
        },
      });

      if (providers.primaryPhysician.trim() || providers.bloodType || providers.pharmacy.trim() || providers.mailOrderPharmacy || providers.pharmacySavingsPrograms.length > 0) {
        await apiRequest("PATCH", "/api/patient-profile", {
          primaryPhysician: providers.primaryPhysician,
          primaryPhysicianPhone: providers.primaryPhysicianPhone,
          primaryPhysicianNpi: providers.primaryPhysicianNpi,
          pharmacy: providers.pharmacy,
          pharmacyPhone: providers.pharmacyPhone,
          mailOrderPharmacy: providers.mailOrderPharmacy,
          pharmacySavingsPrograms: providers.pharmacySavingsPrograms,
          bloodType: providers.bloodType,
          organDonor: providers.organDonor,
          advanceDirectives: providers.advanceDirectives,
        });
      }
    },
    onSuccess: () => {
      setIsSaving(false);
      setSaveError(null);
      onComplete();
    },
    onError: (error: any) => {
      setIsSaving(false);
      setSaveError(error?.message || "Failed to save your information. Please try again.");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    },
  });

  const handleNext = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSaveError(null);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      if (!consent.hipaaConsent || !consent.termsAccepted) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
        return;
      }
      setIsSaving(true);
      saveMutation.mutate();
    }
  }, [currentStep, consent, saveMutation]);

  const handleBack = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onComplete();
  }, [onComplete]);

  const updatePersonal = (field: string, value: string) => setPersonal(p => ({ ...p, [field]: value }));
  const updateContact = (field: string, value: string) => setContact(c => ({ ...c, [field]: value }));
  const updateLifestyle = (field: string, value: string) => setLifestyle(l => ({ ...l, [field]: value }));
  const updateProviders = (field: string, value: any) => setProviders(p => ({ ...p, [field]: value }));

  // Voice fill highlight: briefly highlights the input that was just filled via voice command
  const [voiceHighlightField, setVoiceHighlightField] = useState<string | null>(null);
  const voiceHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVoiceFill = useCallback((field: string, value: string) => {
    const personalFields: Record<string, boolean> = {
      firstName: true, middleName: true, lastName: true,
      dateOfBirth: true, gender: true, preferredName: true,
    };
    const contactFields: Record<string, boolean> = {
      phone: true, email: true, addressLine1: true,
      addressLine2: true, city: true, state: true, zipCode: true,
    };
    const lifestyleFields: Record<string, boolean> = {
      exerciseFrequency: true, smokingStatus: true, alcoholUse: true,
      stressLevel: true, occupation: true, dietaryPreferences: true,
    };
    const providerFields: Record<string, boolean> = {
      primaryPhysician: true, pharmacy: true, bloodType: true,
    };
    if (personalFields[field]) updatePersonal(field, value);
    else if (contactFields[field]) updateContact(field, value);
    else if (lifestyleFields[field]) updateLifestyle(field, value);
    else if (providerFields[field]) updateProviders(field, value);
    // Briefly highlight the filled field for visual confirmation (1.5 s)
    if (voiceHighlightTimerRef.current) clearTimeout(voiceHighlightTimerRef.current);
    setVoiceHighlightField(field);
    voiceHighlightTimerRef.current = setTimeout(() => setVoiceHighlightField(null), 1500);
  }, []);

  const addCondition = () => setMedical(m => ({ ...m, conditions: [...m.conditions, { name: "", diagnosedYear: "", status: "Active" }] }));
  const removeCondition = (idx: number) => setMedical(m => ({ ...m, conditions: m.conditions.filter((_, i) => i !== idx) }));
  const updateCondition = (idx: number, field: string, value: string) => setMedical(m => ({ ...m, conditions: m.conditions.map((c, i) => i === idx ? { ...c, [field]: value } : c) }));

  const addSurgery = () => setMedical(m => ({ ...m, surgeries: [...m.surgeries, { name: "", year: "" }] }));
  const removeSurgery = (idx: number) => setMedical(m => ({ ...m, surgeries: m.surgeries.filter((_, i) => i !== idx) }));
  const updateSurgery = (idx: number, field: string, value: string) => setMedical(m => ({ ...m, surgeries: m.surgeries.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  const addFamilyHistory = () => setMedical(m => ({ ...m, familyHistory: [...m.familyHistory, { condition: "", relation: "" }] }));
  const removeFamilyHistory = (idx: number) => setMedical(m => ({ ...m, familyHistory: m.familyHistory.filter((_, i) => i !== idx) }));
  const updateFamilyHistory = (idx: number, field: string, value: string) => setMedical(m => ({ ...m, familyHistory: m.familyHistory.map((f, i) => i === idx ? { ...f, [field]: value } : f) }));

  const addAllergy = () => setAllergyMed(a => ({ ...a, allergies: [...a.allergies, { allergen: "", reaction: "", severity: "Mild" }] }));
  const removeAllergy = (idx: number) => setAllergyMed(a => ({ ...a, allergies: a.allergies.filter((_, i) => i !== idx) }));
  const updateAllergy = (idx: number, field: string, value: string) => setAllergyMed(a => ({ ...a, allergies: a.allergies.map((al, i) => i === idx ? { ...al, [field]: value } : al) }));

  const addMedication = () => setAllergyMed(a => ({ ...a, medications: [...a.medications, { name: "", dosage: "", frequency: "" }] }));
  const removeMedication = (idx: number) => setAllergyMed(a => ({ ...a, medications: a.medications.filter((_, i) => i !== idx) }));
  const updateMedication = (idx: number, field: string, value: string) => setAllergyMed(a => ({ ...a, medications: a.medications.map((m, i) => i === idx ? { ...m, [field]: value } : m) }));

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const step = STEPS[currentStep];

  const renderInput = (label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; keyboardType?: any; multiline?: boolean; testID?: string; fieldName?: string }) => {
    const isVoiceFilled = !!opts?.fieldName && voiceHighlightField === opts.fieldName;
    return (
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        <TextInput
          testID={opts?.testID || `input-${label.toLowerCase().replace(/\s/g, '-')}`}
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: isVoiceFilled ? theme.primary : theme.border,
            borderWidth: isVoiceFilled ? 2 : 1,
            color: theme.text,
          }]}
          value={value}
          onChangeText={onChange}
          placeholder={opts?.placeholder || label}
          placeholderTextColor={theme.textSecondary + "60"}
          keyboardType={opts?.keyboardType}
          multiline={opts?.multiline}
          autoCapitalize="words"
        />
      </View>
    );
  };

  const renderChipSelect = (label: string, options: string[], selected: string, onSelect: (v: string) => void) => (
    <View style={styles.inputGroup}>
      <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={styles.chipRow}>
        {options.map(opt => {
          const isActive = selected === opt;
          return (
            <Pressable
              key={opt}
              testID={`chip-${opt.toLowerCase().replace(/\s/g, '-')}`}
              onPress={() => { onSelect(opt); try { Haptics.selectionAsync(); } catch {} }}
              style={[styles.chip, {
                backgroundColor: isActive ? `${theme.primary}15` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                borderColor: isActive ? theme.primary : theme.border,
                borderWidth: isActive ? 1.5 : 1,
              }]}
            >
              <ThemedText style={[styles.chipText, isActive ? { color: theme.primary, fontWeight: "600" } : { color: theme.text }]}>
                {opt}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderAITip = () => (
    <Animated.View entering={FadeIn.delay(200)} style={[styles.aiTipCard, { backgroundColor: `${theme.info}08`, borderColor: `${theme.info}20` }]}>
      <View style={[styles.aiTipIcon, { backgroundColor: `${theme.info}15` }]}>
        <Feather name="cpu" size={14} color={theme.info} />
      </View>
      <View style={styles.aiTipContent}>
        <ThemedText style={[styles.aiTipLabel, { color: theme.info }]}>{t("AI Insight")}</ThemedText>
        <ThemedText style={[styles.aiTipText, { color: theme.textSecondary }]}>
          {AI_TIPS[step.key] || "Complete this section to improve your health profile."}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderToggleRow = (label: string, value: boolean, onToggle: (v: boolean) => void) => (
    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
      <ThemedText style={{ color: theme.text, fontSize: 15, flex: 1 }}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.border, true: `${theme.primary}50` }}
        thumbColor={value ? theme.primary : isDark ? "#666" : "#ccc"}
      />
    </View>
  );

  const renderListItem = (
    fields: { label: string; value: string; onChange: (v: string) => void; flex?: number }[],
    chipField?: { label: string; options: string[]; value: string; onSelect: (v: string) => void },
    onRemove?: () => void
  ) => (
    <View style={[styles.listItemCard, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
      <View style={styles.listItemFields}>
        {fields.map((f, i) => (
          <View key={i} style={[styles.listItemField, f.flex ? { flex: f.flex } : null]}>
            <TextInput
              style={[styles.listItemInput, {
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fff",
              }]}
              value={f.value}
              onChangeText={f.onChange}
              placeholder={f.label}
              placeholderTextColor={theme.textSecondary + "60"}
              autoCapitalize="words"
            />
          </View>
        ))}
      </View>
      {chipField ? (
        <View style={[styles.chipRow, { marginTop: 6 }]}>
          {chipField.options.map(opt => {
            const isActive = chipField.value === opt;
            return (
              <Pressable key={opt} onPress={() => chipField.onSelect(opt)}
                style={[styles.miniChip, {
                  backgroundColor: isActive ? `${theme.primary}15` : "transparent",
                  borderColor: isActive ? theme.primary : theme.border,
                }]}
              >
                <ThemedText style={[styles.miniChipText, isActive ? { color: theme.primary, fontWeight: "600" } : { color: theme.textSecondary }]}>
                  {opt}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {onRemove ? (
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove item">
          <Feather name="x" size={16} color={theme.error} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderAddButton = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={[styles.addBtn, { borderColor: theme.primary }]}>
      <Feather name="plus" size={16} color={theme.primary} />
      <ThemedText style={[styles.addBtnText, { color: theme.primary }]}>{label}</ThemedText>
    </Pressable>
  );

  const renderStepPersonal = () => (
    <View style={styles.stepContent}>
      {renderChipSelect(t("Preferred Language"), LANGUAGE_OPTIONS, personal.preferredLanguage, v => updatePersonal("preferredLanguage", v))}
      {renderInput(t("First Name *"), personal.firstName, v => updatePersonal("firstName", v), { testID: "input-first-name", fieldName: "firstName" })}
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("Middle Name")}</ThemedText>
        <TextInput
          testID="input-middle-name"
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: theme.border,
            color: theme.text,
          }]}
          value={personal.middleName}
          onChangeText={(v) => {
            updatePersonal("middleName", v);
            setNmnAutoAssigned(false);
          }}
          onBlur={() => {
            if (!personal.middleName.trim()) {
              updatePersonal("middleName", "NMN");
              setNmnAutoAssigned(true);
            }
          }}
          placeholder={t("Leave blank if none")}
          placeholderTextColor={theme.textSecondary + "60"}
          autoCapitalize="characters"
          accessibilityLabel={t("Middle name")}
          accessibilityHint={t("Leave blank if you have no middle name. NMN will be assigned.")}
        />
        <ThemedText
          type="caption"
          style={{ color: nmnAutoAssigned ? theme.primary : theme.textSecondary, marginTop: 4 }}
          accessibilityLiveRegion="polite"
        >
          {nmnAutoAssigned
            ? t("NMN (No Middle Name) assigned to your record.")
            : t("If no middle name, leave blank. NMN will be assigned for lab matching.")}
        </ThemedText>
        {nmnAutoAssigned && personal.firstName.trim() ? (
          <ThemedText
            type="caption"
            style={{ color: theme.text, marginTop: 2, fontWeight: '600' }}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {`${personal.firstName.trim().toUpperCase()} NMN ${personal.lastName.trim().toUpperCase()}`}
          </ThemedText>
        ) : null}
      </View>
      {renderInput(t("Last Name *"), personal.lastName, v => updatePersonal("lastName", v), { testID: "input-last-name", fieldName: "lastName" })}
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("Date of Birth *")}</ThemedText>
        <TextInput
          testID="input-dob"
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: theme.border,
            color: theme.text,
          }]}
          value={personal.dateOfBirth}
          onChangeText={formatDOB}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={theme.textSecondary + "60"}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      {renderChipSelect(t("Gender"), GENDER_OPTIONS.map(o => t(o)), personal.gender ? t(personal.gender) : "", v => { const idx = GENDER_OPTIONS.map(o => t(o)).indexOf(v); updatePersonal("gender", idx >= 0 ? GENDER_OPTIONS[idx] : v); })}
      {renderChipSelect(t("Pronouns"), PRONOUN_OPTIONS.map(o => t(o)), personal.pronouns ? t(personal.pronouns) : "", v => { const idx = PRONOUN_OPTIONS.map(o => t(o)).indexOf(v); updatePersonal("pronouns", idx >= 0 ? PRONOUN_OPTIONS[idx] : v); })}
      {renderChipSelect(t("Marital Status"), MARITAL_OPTIONS.map(o => t(o)), personal.maritalStatus ? t(personal.maritalStatus) : "", v => { const idx = MARITAL_OPTIONS.map(o => t(o)).indexOf(v); updatePersonal("maritalStatus", idx >= 0 ? MARITAL_OPTIONS[idx] : v); })}
      {renderChipSelect(t("Ethnicity"), ETHNICITY_OPTIONS.map(o => t(o)), personal.ethnicity ? t(personal.ethnicity) : "", v => { const idx = ETHNICITY_OPTIONS.map(o => t(o)).indexOf(v); updatePersonal("ethnicity", idx >= 0 ? ETHNICITY_OPTIONS[idx] : v); })}
      {renderChipSelect(t("Race"), RACE_OPTIONS.map(o => t(o)), personal.race ? t(personal.race) : "", v => { const idx = RACE_OPTIONS.map(o => t(o)).indexOf(v); updatePersonal("race", idx >= 0 ? RACE_OPTIONS[idx] : v); })}
    </View>
  );

  const renderStepContact = () => (
    <View style={styles.stepContent}>
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("Phone Number *")}</ThemedText>
        <View style={styles.rowFields}>
          <Pressable
            testID="button-country-code"
            onPress={() => setShowCountryCodes(!showCountryCodes)}
            style={[styles.countryCodeBtn, {
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
              borderColor: theme.border,
            }]}
          >
            <ThemedText style={{ color: theme.text, fontSize: 15 }}>{countryCode}</ThemedText>
            <Feather name="chevron-down" size={14} color={theme.textSecondary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextInput
              testID="input-phone"
              style={[styles.inputField, {
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                borderColor: theme.border,
                color: theme.text,
              }]}
              value={contact.phone}
              onChangeText={v => updateContact("phone", v)}
              placeholder="(555) 123-4567"
              placeholderTextColor={theme.textSecondary + "60"}
              keyboardType="phone-pad"
            />
          </View>
        </View>
        {showCountryCodes ? (
          <View style={[styles.searchResultsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, maxHeight: 200 }]}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {COUNTRY_CODES.map(cc => (
                <Pressable
                  key={cc.code}
                  onPress={() => { setCountryCode(cc.dial); setShowCountryCodes(false); }}
                  style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
                >
                  <ThemedText style={{ color: theme.text, fontSize: 14, flex: 1 }}>{cc.name}</ThemedText>
                  <ThemedText style={{ color: theme.primary, fontSize: 14 }}>{cc.dial}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      {renderInput(t("Email"), contact.email, v => updateContact("email", v), { keyboardType: "email-address", testID: "input-email", fieldName: "email" })}
      {renderInput(t("Street Address"), contact.addressLine1, v => updateContact("addressLine1", v), { fieldName: "addressLine1" })}
      {renderInput(t("Apt / Suite"), contact.addressLine2, v => updateContact("addressLine2", v), { fieldName: "addressLine2" })}
      <View style={styles.rowFields}>
        <View style={{ flex: 2 }}>{renderInput(t("City"), contact.city, v => updateContact("city", v), { fieldName: "city" })}</View>
        <View style={{ flex: 1 }}>{renderInput(t("State"), contact.state, v => updateContact("state", v), { fieldName: "state" })}</View>
        <View style={{ flex: 1 }}>{renderInput(t("Zip"), contact.zipCode, v => updateContact("zipCode", v), { keyboardType: "number-pad", fieldName: "zipCode" })}</View>
      </View>
      <View style={[styles.sectionDivider, { borderColor: theme.border }]} />
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Emergency Contact")}</ThemedText>
      {renderInput(t("Contact Name"), contact.emergencyName, v => updateContact("emergencyName", v))}
      {renderInput(t("Contact Phone"), contact.emergencyPhone, v => updateContact("emergencyPhone", v), { keyboardType: "phone-pad" })}
      {renderChipSelect(t("Relationship"), RELATIONSHIP_OPTIONS.map(o => t(o)), contact.emergencyRelation ? t(contact.emergencyRelation) : "", v => { const idx = RELATIONSHIP_OPTIONS.map(o => t(o)).indexOf(v); updateContact("emergencyRelation", idx >= 0 ? RELATIONSHIP_OPTIONS[idx] : v); })}
    </View>
  );

  const renderStepMedical = () => (
    <View style={styles.stepContent}>
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Health Conditions")}</ThemedText>
      {renderToggleRow(t("No known conditions"), medical.noConditions, v => { setMedical(m => ({ ...m, noConditions: v })); if (v) setSelectedConditions([]); })}
      {!medical.noConditions ? (
        <>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Common Conditions")}</ThemedText>
          <ThemedText style={[styles.chipSectionHint, { color: theme.textSecondary }]}>{t("Select any that apply")}</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_CONDITIONS_WITH_ICD.map(({ name: condition, icd10 }) => {
              const isActive = selectedConditions.includes(condition);
              return (
                <Pressable
                  key={condition}
                  testID={`chip-condition-${condition.toLowerCase().replace(/\s/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleCondition(condition)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{t(condition)}</ThemedText>
                  <ThemedText style={[styles.codeText, { color: isActive ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>{icd10}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.sectionDivider, { borderColor: theme.border, marginTop: Spacing.md }]} />
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Other Conditions")}</ThemedText>
          {medical.conditions.map((c, idx) => (
            <View key={`cond-${idx}`}>
              {renderListItem(
                [
                  { label: t("Condition"), value: c.name, onChange: v => updateCondition(idx, "name", v), flex: 2 },
                  { label: t("Year"), value: c.diagnosedYear, onChange: v => updateCondition(idx, "diagnosedYear", v), flex: 1 },
                ],
                { label: t("Status"), options: CONDITION_STATUS.map(o => t(o)), value: t(c.status), onSelect: v => { const idx2 = CONDITION_STATUS.map(o => t(o)).indexOf(v); updateCondition(idx, "status", idx2 >= 0 ? CONDITION_STATUS[idx2] : v); } },
                medical.conditions.length > 1 ? () => removeCondition(idx) : undefined
              )}
            </View>
          ))}
          {renderAddButton(t("Add Condition"), addCondition)}
        </>
      ) : null}

      <View style={[styles.sectionDivider, { borderColor: theme.border }]} />
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Surgeries")}</ThemedText>
      {renderToggleRow(t("No prior surgeries"), medical.noSurgeries, v => { setMedical(m => ({ ...m, noSurgeries: v })); if (v) setSelectedSurgeries([]); })}
      {!medical.noSurgeries ? (
        <>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Common Surgeries")}</ThemedText>
          <ThemedText style={[styles.chipSectionHint, { color: theme.textSecondary }]}>{t("Select any that apply")}</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_SURGERIES_WITH_CPT.map(({ name: surgery, cpt }) => {
              const isActive = selectedSurgeries.includes(surgery);
              return (
                <Pressable
                  key={surgery}
                  testID={`chip-surgery-${surgery.toLowerCase().replace(/[\s()\/]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleSurgery(surgery)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{t(surgery)}</ThemedText>
                  <ThemedText style={[styles.codeText, { color: isActive ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>CPT {cpt}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.sectionDivider, { borderColor: theme.border, marginTop: Spacing.md }]} />
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Other Surgeries")}</ThemedText>
          {medical.surgeries.map((s, idx) => (
            <View key={`surg-${idx}`}>
              {renderListItem(
                [
                  { label: t("Surgery"), value: s.name, onChange: v => updateSurgery(idx, "name", v), flex: 2 },
                  { label: t("Year"), value: s.year, onChange: v => updateSurgery(idx, "year", v), flex: 1 },
                ],
                undefined,
                medical.surgeries.length > 1 ? () => removeSurgery(idx) : undefined
              )}
            </View>
          ))}
          {renderAddButton(t("Add Surgery"), addSurgery)}
        </>
      ) : null}

      <View style={[styles.sectionDivider, { borderColor: theme.border }]} />
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Family History")}</ThemedText>
      {renderToggleRow(t("No known family history"), medical.noFamilyHistory, v => { setMedical(m => ({ ...m, noFamilyHistory: v })); if (v) setSelectedFamilyConditions([]); })}
      {!medical.noFamilyHistory ? (
        <>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Hereditary / Genetic Conditions")}</ThemedText>
          <ThemedText style={[styles.chipSectionHint, { color: theme.textSecondary }]}>{t("Select any that apply")}</ThemedText>
          <View style={styles.chipRow}>
            {FAMILY_HISTORY_CONDITIONS.map(condition => {
              const isActive = selectedFamilyConditions.includes(condition);
              return (
                <Pressable
                  key={condition}
                  testID={`chip-family-${condition.toLowerCase().replace(/[\s()\/,<>]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleFamilyCondition(condition)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{t(condition)}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.sectionDivider, { borderColor: theme.border, marginTop: Spacing.md }]} />
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Other Family Conditions")}</ThemedText>
          {medical.familyHistory.map((f, idx) => (
            <View key={`fam-${idx}`}>
              {renderListItem(
                [
                  { label: t("Condition"), value: f.condition, onChange: v => updateFamilyHistory(idx, "condition", v), flex: 2 },
                ],
                { label: t("Affected Relative"), options: FAMILY_RELATION_OPTIONS.map(o => t(o)), value: f.relation ? t(f.relation) : "", onSelect: v => { const idx2 = FAMILY_RELATION_OPTIONS.map(o => t(o)).indexOf(v); updateFamilyHistory(idx, "relation", idx2 >= 0 ? FAMILY_RELATION_OPTIONS[idx2] : v); } },
                medical.familyHistory.length > 1 ? () => removeFamilyHistory(idx) : undefined
              )}
            </View>
          ))}
          {renderAddButton(t("Add Family History"), addFamilyHistory)}
        </>
      ) : null}
    </View>
  );

  const renderStepAllergiesMeds = () => (
    <View style={styles.stepContent}>
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Allergies")}</ThemedText>
      {renderToggleRow(t("No known allergies (NKDA)"), allergyMed.noAllergies, v => { setAllergyMed(a => ({ ...a, noAllergies: v })); if (v) setSelectedAllergies([]); })}
      {!allergyMed.noAllergies ? (
        <>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>Drug Allergies</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_ALLERGIES.filter(a => a.category === "drug").map(({ name }) => {
              const isActive = selectedAllergies.includes(name);
              return (
                <Pressable
                  key={name}
                  testID={`chip-allergy-${name.toLowerCase().replace(/[\s\/()]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleAllergyChip(name)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>Food Allergies</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_ALLERGIES.filter(a => a.category === "food").map(({ name }) => {
              const isActive = selectedAllergies.includes(name);
              return (
                <Pressable
                  key={name}
                  testID={`chip-allergy-${name.toLowerCase().replace(/[\s\/()]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleAllergyChip(name)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>Environmental Allergies</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_ALLERGIES.filter(a => a.category === "environmental").map(({ name }) => {
              const isActive = selectedAllergies.includes(name);
              return (
                <Pressable
                  key={name}
                  testID={`chip-allergy-${name.toLowerCase().replace(/[\s\/()]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleAllergyChip(name)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.sectionDivider, { borderColor: theme.border, marginTop: Spacing.md }]} />
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Other Allergies")}</ThemedText>
          {allergyMed.allergies.map((a, idx) => (
            <View key={`allergy-${idx}`}>
              {renderListItem(
                [
                  { label: t("Allergen"), value: a.allergen, onChange: v => updateAllergy(idx, "allergen", v), flex: 2 },
                  { label: t("Reaction"), value: a.reaction, onChange: v => updateAllergy(idx, "reaction", v), flex: 1 },
                ],
                { label: t("Severity"), options: SEVERITY_OPTIONS.map(o => t(o)), value: t(a.severity), onSelect: v => { const idx2 = SEVERITY_OPTIONS.map(o => t(o)).indexOf(v); updateAllergy(idx, "severity", idx2 >= 0 ? SEVERITY_OPTIONS[idx2] : v); } },
                allergyMed.allergies.length > 1 ? () => removeAllergy(idx) : undefined
              )}
            </View>
          ))}
          {renderAddButton(t("Add Allergy"), addAllergy)}
        </>
      ) : null}

      <View style={[styles.sectionDivider, { borderColor: theme.border }]} />
      <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Current Medications")}</ThemedText>
      {renderToggleRow(t("No current medications"), allergyMed.noMedications, v => { setAllergyMed(a => ({ ...a, noMedications: v })); if (v) setSelectedMedications([]); })}
      {!allergyMed.noMedications ? (
        <>
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>Common Medications</ThemedText>
          <ThemedText style={[styles.chipSectionHint, { color: theme.textSecondary }]}>Tap to add, then set strength and dosing</ThemedText>
          <View style={styles.chipRow}>
            {COMMON_MEDICATIONS.map(med => {
              const isActive = selectedMedications.some(m => m.med.name === med.name);
              return (
                <Pressable
                  key={med.name}
                  testID={`chip-med-${med.name.toLowerCase().replace(/[\s()\/]/g, '-')}`}
                  style={[styles.chip, { backgroundColor: isActive ? theme.primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: isActive ? theme.primary : theme.border }]}
                  onPress={() => toggleMedicationChip(med)}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#fff" : theme.text }]}>{med.name}</ThemedText>
                  <ThemedText style={[styles.codeText, { color: isActive ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>{med.linkedCondition}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          {selectedMedications.length > 0 ? (
            <View style={{ marginTop: Spacing.md }}>
              <ThemedText style={[styles.chipSectionLabel, { color: theme.text }]}>Selected Medications - Set Strength & Dosing</ThemedText>
              {selectedMedications.map(({ med, strength, frequency }) => (
                <View key={med.name} style={[styles.listItemCard, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}20` }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>{med.name}</ThemedText>
                    <Pressable onPress={() => toggleMedicationChip(med)} hitSlop={8}>
                      <Feather name="x" size={16} color={theme.error} />
                    </Pressable>
                  </View>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 4 }}>For: {med.linkedCondition}</ThemedText>
                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 4 }]}>Strength</ThemedText>
                  <View style={[styles.chipRow, { marginBottom: 6 }]}>
                    {med.strengths.map(s => (
                      <Pressable
                        key={s}
                        onPress={() => updateSelectedMedStrength(med.name, s)}
                        style={[styles.miniChip, {
                          backgroundColor: strength === s ? `${theme.primary}15` : "transparent",
                          borderColor: strength === s ? theme.primary : theme.border,
                        }]}
                      >
                        <ThemedText style={[styles.miniChipText, strength === s ? { color: theme.primary, fontWeight: "600" } : { color: theme.textSecondary }]}>{s}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Frequency</ThemedText>
                  <View style={styles.chipRow}>
                    {med.frequencies.map(f => (
                      <Pressable
                        key={f}
                        onPress={() => updateSelectedMedFrequency(med.name, f)}
                        style={[styles.miniChip, {
                          backgroundColor: frequency === f ? `${theme.primary}15` : "transparent",
                          borderColor: frequency === f ? theme.primary : theme.border,
                        }]}
                      >
                        <ThemedText style={[styles.miniChipText, frequency === f ? { color: theme.primary, fontWeight: "600" } : { color: theme.textSecondary }]}>{f}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <View style={[styles.sectionDivider, { borderColor: theme.border, marginTop: Spacing.md }]} />
          <ThemedText style={[styles.chipSectionLabel, { color: theme.textSecondary }]}>{t("Other Medications")}</ThemedText>
          {allergyMed.medications.map((m, idx) => (
            <View key={`med-${idx}`}>
              {renderListItem(
                [
                  { label: t("Medication"), value: m.name, onChange: v => updateMedication(idx, "name", v), flex: 2 },
                  { label: t("Dosage"), value: m.dosage, onChange: v => updateMedication(idx, "dosage", v), flex: 1 },
                ],
                undefined,
                allergyMed.medications.length > 1 ? () => removeMedication(idx) : undefined
              )}
            </View>
          ))}
          {renderAddButton(t("Add Medication"), addMedication)}
        </>
      ) : null}
    </View>
  );

  const getIcdForLifestyle = (category: string) => {
    const codes = SOCIAL_HISTORY_ICD_CODES.filter(c => c.category === category);
    return codes.length > 0 ? codes[0].icd10 : "";
  };

  const renderStepLifestyle = () => (
    <View style={styles.stepContent}>
      <View>
        {renderChipSelect(t("Smoking Status"), SMOKING_OPTIONS.map(o => t(o)), lifestyle.smokingStatus ? t(lifestyle.smokingStatus) : "", v => { const idx = SMOKING_OPTIONS.map(o => t(o)).indexOf(v); updateLifestyle("smokingStatus", idx >= 0 ? SMOKING_OPTIONS[idx] : v); })}
        {lifestyle.smokingStatus && lifestyle.smokingStatus !== "Never" ? (
          <ThemedText style={[styles.icdCodeLabel, { color: theme.textSecondary }]}>ICD-10: {lifestyle.smokingStatus.startsWith("Former") ? "Z87.891" : "F17.210"}</ThemedText>
        ) : null}
      </View>
      <View>
        {renderChipSelect(t("Alcohol Use"), ALCOHOL_OPTIONS.map(o => t(o)), lifestyle.alcoholUse ? t(lifestyle.alcoholUse) : "", v => { const idx = ALCOHOL_OPTIONS.map(o => t(o)).indexOf(v); updateLifestyle("alcoholUse", idx >= 0 ? ALCOHOL_OPTIONS[idx] : v); })}
        {lifestyle.alcoholUse && lifestyle.alcoholUse !== "None" ? (
          <ThemedText style={[styles.icdCodeLabel, { color: theme.textSecondary }]}>ICD-10: {lifestyle.alcoholUse === "Heavy" ? "F10.10" : "Z72.1"}</ThemedText>
        ) : null}
      </View>
      <View>
        {renderChipSelect(t("Exercise Frequency"), EXERCISE_OPTIONS, lifestyle.exerciseFrequency, v => updateLifestyle("exerciseFrequency", v))}
        {lifestyle.exerciseFrequency === "Sedentary" ? (
          <ThemedText style={[styles.icdCodeLabel, { color: theme.textSecondary }]}>ICD-10: Z72.3</ThemedText>
        ) : null}
      </View>
      <View>
        {renderChipSelect(t("Stress Level"), STRESS_OPTIONS.map(o => t(o)), lifestyle.stressLevel ? t(lifestyle.stressLevel) : "", v => { const idx = STRESS_OPTIONS.map(o => t(o)).indexOf(v); updateLifestyle("stressLevel", idx >= 0 ? STRESS_OPTIONS[idx] : v); })}
        {lifestyle.stressLevel && lifestyle.stressLevel !== "Low" ? (
          <ThemedText style={[styles.icdCodeLabel, { color: theme.textSecondary }]}>ICD-10: Z73.3</ThemedText>
        ) : null}
      </View>
      {renderChipSelect(t("Dietary Preferences"), DIET_OPTIONS.map(o => t(o)), lifestyle.dietaryPreferences ? t(lifestyle.dietaryPreferences) : "", v => { const idx = DIET_OPTIONS.map(o => t(o)).indexOf(v); updateLifestyle("dietaryPreferences", idx >= 0 ? DIET_OPTIONS[idx] : v); })}
      <View>
        {renderInput(t("Occupation"), lifestyle.occupation, v => updateLifestyle("occupation", v), { fieldName: "occupation" })}
        {lifestyle.occupation.trim() ? (
          <ThemedText style={[styles.icdCodeLabel, { color: theme.textSecondary }]}>ICD-10: Z57.9</ThemedText>
        ) : null}
      </View>
    </View>
  );

  const MAIL_ORDER_PHARMACIES = [
    "Amazon Pharmacy", "Express Scripts", "CVS Caremark", "OptumRx",
    "Cigna Home Delivery", "Humana Pharmacy", "Kaiser Permanente Mail Order",
    "Costco Mail Order", "PillPack by Amazon",
  ];

  const PHARMACY_SAVINGS = [
    { name: "GoodRx", desc: "Free coupons for prescriptions" },
    { name: "Mark Cuban Cost Plus Drugs", desc: "Transparent low-cost medications" },
    { name: "Amazon Pharmacy", desc: "Prime member discounts" },
    { name: "RxSaver", desc: "Compare pharmacy prices" },
    { name: "SingleCare", desc: "Free prescription discount card" },
    { name: "Blink Health", desc: "Discounted medication delivery" },
    { name: "NeedyMeds", desc: "Patient assistance programs" },
    { name: "ScriptSave WellRx", desc: "Savings up to 80% off" },
  ];

  const renderStepProviders = () => (
    <View style={styles.stepContent}>
      <View style={[styles.sectionDivider, { borderColor: `${theme.primary}20` }]}>
        <Feather name="user" size={16} color={theme.primary} />
        <ThemedText style={[styles.sectionDividerText, { color: theme.primary }]}>
          {t("Primary Care Provider")}
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
          {t("Search by Provider Name")}
        </ThemedText>
        <TextInput
          testID="input-provider-search"
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: showProviderResults ? theme.primary : theme.border,
            color: theme.text,
          }]}
          value={providerSearchQuery}
          onChangeText={handleProviderSearch}
          placeholder="Search by name or clinic (e.g. Smith, Mayo Clinic)"
          placeholderTextColor={theme.textSecondary + "60"}
          autoCapitalize="words"
        />
        {isSearchingProviders ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.xs }} />
        ) : null}
        {showProviderResults && providerSearchResults.length > 0 ? (
          <View style={[styles.searchResultsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            {providerSearchResults.slice(0, 8).map((prov, idx) => (
              <Pressable
                key={`${prov.npi}-${idx}`}
                testID={`provider-result-${idx}`}
                onPress={() => selectProvider(prov)}
                style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>
                    {prov.firstName} {prov.lastName}{prov.credential ? `, ${prov.credential}` : ""}
                  </ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {prov.specialty}
                  </ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {prov.address}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: theme.primary, fontSize: 11 }}>NPI: {prov.npi}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {showProviderResults && !isSearchingProviders && providerSearchResults.length === 0 && providerSearchQuery.length >= 2 ? (
          <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: Spacing.xs }}>
            No providers found. You can enter details manually below.
          </ThemedText>
        ) : null}
      </View>

      {providers.primaryPhysician ? (
        <View style={[styles.selectedProviderCard, { backgroundColor: `${theme.success}10`, borderColor: `${theme.success}30` }]}>
          <Feather name="check-circle" size={16} color={theme.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>
              {providers.primaryPhysician}
            </ThemedText>
            {providers.primaryPhysicianNpi ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>
                NPI: {providers.primaryPhysicianNpi}
              </ThemedText>
            ) : null}
            {providers.primaryPhysicianPhone ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>
                {providers.primaryPhysicianPhone}
              </ThemedText>
            ) : null}
          </View>
          <Pressable onPress={() => {
            updateProviders("primaryPhysician", "");
            updateProviders("primaryPhysicianPhone", "");
            updateProviders("primaryPhysicianNpi", "");
            setProviderSearchQuery("");
          }}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <>
          {renderInput(t("Primary Physician"), providers.primaryPhysician, v => updateProviders("primaryPhysician", v), { fieldName: "primaryPhysician" })}
          {renderInput(t("Physician Phone"), providers.primaryPhysicianPhone, v => updateProviders("primaryPhysicianPhone", v), { keyboardType: "phone-pad" })}
        </>
      )}

      <View style={[styles.sectionDivider, { borderColor: `${theme.primary}20`, marginTop: Spacing.lg }]}>
        <Feather name="map-pin" size={16} color={theme.primary} />
        <ThemedText style={[styles.sectionDividerText, { color: theme.primary }]}>
          {t("Preferred Pharmacy")}
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Search by Pharmacy Name</ThemedText>
        <TextInput
          testID="input-pharmacy-search"
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: showPharmacyResults ? theme.primary : theme.border,
            color: theme.text,
          }]}
          value={pharmacySearchQuery}
          onChangeText={v => handlePharmacySearch(v)}
          placeholder="Search pharmacies (e.g. CVS, Walgreens)"
          placeholderTextColor={theme.textSecondary + "60"}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Search by Zip Code</ThemedText>
        <TextInput
          testID="input-pharmacy-zip"
          style={[styles.inputField, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            borderColor: theme.border,
            color: theme.text,
          }]}
          value={pharmacyZipSearch}
          onChangeText={v => { setPharmacyZipSearch(v); if (v.length >= 3 || pharmacySearchQuery.length >= 2) handlePharmacySearch(pharmacySearchQuery, v); }}
          placeholder="Enter zip code"
          placeholderTextColor={theme.textSecondary + "60"}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      {isSearchingPharmacy ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.xs }} />
      ) : null}
      {showPharmacyResults && pharmacySearchResults.length > 0 ? (
        <View style={[styles.searchResultsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          {pharmacySearchResults.slice(0, 8).map((ph, idx) => (
            <Pressable
              key={`${ph.npi}-${idx}`}
              testID={`pharmacy-result-${idx}`}
              onPress={() => selectPharmacy(ph)}
              style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>{ph.name}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{ph.address}</ThemedText>
                {ph.phone ? <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>{ph.phone}</ThemedText> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showPharmacyResults && !isSearchingPharmacy && pharmacySearchResults.length === 0 && (pharmacySearchQuery.length >= 2 || pharmacyZipSearch.length >= 3) ? (
        <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: Spacing.xs }}>
          No pharmacies found. You can enter details manually below.
        </ThemedText>
      ) : null}

      {providers.pharmacy ? (
        <View style={[styles.selectedProviderCard, { backgroundColor: `${theme.success}10`, borderColor: `${theme.success}30`, marginTop: Spacing.sm }]}>
          <Feather name="check-circle" size={16} color={theme.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>{providers.pharmacy}</ThemedText>
            {providers.pharmacyPhone ? <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>{providers.pharmacyPhone}</ThemedText> : null}
          </View>
          <Pressable onPress={() => { updateProviders("pharmacy", ""); updateProviders("pharmacyPhone", ""); setPharmacySearchQuery(""); }}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <>
          {renderInput(t("Preferred Pharmacy"), providers.pharmacy, v => updateProviders("pharmacy", v), { placeholder: "Or enter manually", fieldName: "pharmacy" })}
          {renderInput(t("Pharmacy Phone"), providers.pharmacyPhone, v => updateProviders("pharmacyPhone", v), { keyboardType: "phone-pad" })}
        </>
      )}

      <View style={[styles.sectionDivider, { borderColor: `${theme.primary}20`, marginTop: Spacing.lg }]}>
        <Feather name="package" size={16} color={theme.primary} />
        <ThemedText style={[styles.sectionDividerText, { color: theme.primary }]}>
          {t("Mail Order Pharmacy")}
        </ThemedText>
      </View>
      <View style={styles.inputGroup}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Select a mail-order pharmacy for home delivery
        </ThemedText>
        <View style={styles.chipRow}>
          {MAIL_ORDER_PHARMACIES.map(ph => {
            const isActive = providers.mailOrderPharmacy === ph;
            return (
              <Pressable
                key={ph}
                testID={`chip-mail-${ph.toLowerCase().replace(/\s/g, '-')}`}
                onPress={() => {
                  updateProviders("mailOrderPharmacy", isActive ? "" : ph);
                  try { Haptics.selectionAsync(); } catch {}
                }}
                style={[styles.chip, {
                  backgroundColor: isActive ? `${theme.primary}15` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                  borderColor: isActive ? theme.primary : theme.border,
                  borderWidth: isActive ? 1.5 : 1,
                }]}
              >
                <ThemedText style={[styles.chipText, isActive ? { color: theme.primary, fontWeight: "600" } : { color: theme.text }]}>
                  {ph}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.sectionDivider, { borderColor: `${theme.info}20`, marginTop: Spacing.lg }]}>
        <Feather name="dollar-sign" size={16} color={theme.info} />
        <ThemedText style={[styles.sectionDividerText, { color: theme.info }]}>
          Prescription Savings Programs
        </ThemedText>
      </View>
      <View style={[styles.savingsTip, { backgroundColor: `${theme.info}08`, borderColor: `${theme.info}20` }]}>
        <Feather name="info" size={14} color={theme.info} />
        <ThemedText style={{ color: theme.info, fontSize: 12, flex: 1 }}>
          Select programs you use or want to explore for lower medication costs
        </ThemedText>
      </View>
      <View style={styles.inputGroup}>
        <View style={styles.chipRow}>
          {PHARMACY_SAVINGS.map(prog => {
            const isActive = providers.pharmacySavingsPrograms.includes(prog.name);
            return (
              <Pressable
                key={prog.name}
                testID={`chip-savings-${prog.name.toLowerCase().replace(/\s/g, '-')}`}
                onPress={() => toggleSavingsProgram(prog.name)}
                style={[styles.savingsChip, {
                  backgroundColor: isActive ? `${theme.success}12` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                  borderColor: isActive ? theme.success : theme.border,
                  borderWidth: isActive ? 1.5 : 1,
                }]}
              >
                <ThemedText style={[styles.chipText, isActive ? { color: theme.success, fontWeight: "600" } : { color: theme.text }]}>
                  {prog.name}
                </ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                  {prog.desc}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.sectionDivider, { borderColor: `${theme.primary}20`, marginTop: Spacing.lg }]}>
        <Feather name="heart" size={16} color={theme.primary} />
        <ThemedText style={[styles.sectionDividerText, { color: theme.primary }]}>
          {t("Additional Health Info")}
        </ThemedText>
      </View>
      {renderChipSelect(t("Blood Type"), BLOOD_TYPES, providers.bloodType, v => updateProviders("bloodType", v))}
      {renderToggleRow(t("Organ Donor"), providers.organDonor, v => updateProviders("organDonor", v))}
      {renderToggleRow(t("Advance Directives on File"), providers.advanceDirectives, v => updateProviders("advanceDirectives", v))}
    </View>
  );

  const handleStitchEvent = useCallback((event: any) => {
    if (event?.type === "patient.connection_success" || event?.type === "patient.connection_pending") {
      setFastenConnectionMade(true);
    }
    if (event?.type === "widget.complete") {
      setShowFastenConnect(false);
    }
  }, []);

  const handleWebViewMessage = useCallback((messageEvent: any) => {
    try {
      const data = JSON.parse(messageEvent.nativeEvent.data);
      if (data.source === "fasten-stitch") handleStitchEvent(data.event);
    } catch {}
  }, [handleStitchEvent]);

  const getStitchHtml = (): string => {
    const publicId = fastenConfig?.publicId || "";
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link href="https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.css" rel="stylesheet">
      <script src="https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.js" type="module"></script>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:${isDark ? "#1a1a2e" : "#f8f9fa"};min-height:100vh}fasten-stitch-element{display:block;width:100%;min-height:100vh}</style>
    </head><body>
      <fasten-stitch-element public-id="${publicId}"></fasten-stitch-element>
      <script>const el=document.querySelector('fasten-stitch-element');if(el){el.addEventListener('eventBus',(e)=>{const event=JSON.parse(e.detail.data);const msg=JSON.stringify({source:'fasten-stitch',event:event});if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){window.ReactNativeWebView.postMessage(msg)}else if(window.parent&&window.parent!==window){window.parent.postMessage(msg,window.location.origin)}})}</script>
    </body></html>`;
  };

  const fastenIframeRef = useRef<any>(null);

  React.useEffect(() => {
    if (Platform.OS !== "web" || !showFastenConnect) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.source === "fasten-stitch") handleStitchEvent(data.event);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [showFastenConnect, handleStitchEvent]);

  const renderStepConnect = () => {
    if (showFastenConnect) {
      if (Platform.OS === "web") {
        return (
          <View style={styles.stepContent}>
            <Pressable onPress={() => setShowFastenConnect(false)} style={[styles.addBtn, { borderColor: theme.textSecondary, marginBottom: Spacing.md }]}>
              <Feather name="arrow-left" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.addBtnText, { color: theme.textSecondary }]}>{t("Back to options")}</ThemedText>
            </Pressable>
            <View style={{ height: 500, borderRadius: BorderRadius.md, overflow: "hidden" }}>
              <iframe
                ref={fastenIframeRef}
                srcDoc={getStitchHtml()}
                style={{ width: "100%", height: "100%", border: "none" } as any}
                title="Fasten Connect"
                allow="camera;microphone"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              />
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.stepContent, { flex: 1 }]}>
          <Pressable onPress={() => setShowFastenConnect(false)} style={[styles.addBtn, { borderColor: theme.textSecondary, marginBottom: Spacing.md }]}>
            <Feather name="arrow-left" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.addBtnText, { color: theme.textSecondary }]}>{t("Back to options")}</ThemedText>
          </Pressable>
          <WebView
            source={{ html: getStitchHtml() }}
            style={{ flex: 1, minHeight: 400 }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            )}
          />
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        {fastenConnectionMade ? (
          <Animated.View entering={FadeInDown} style={[styles.successBanner, { backgroundColor: `${theme.success}10`, borderColor: `${theme.success}30` }]}>
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText style={[{ color: theme.success, fontWeight: "600", flex: 1 }]}>Records connected successfully</ThemedText>
          </Animated.View>
        ) : null}

        {isFastenAvailable ? (
          <Pressable
            testID="button-fasten-connect"
            onPress={() => { setShowFastenConnect(true); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} }}
            style={[styles.connectOptionCard, { backgroundColor: `${theme.primary}08`, borderColor: theme.primary }]}
          >
            <View style={[styles.connectOptionIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="link" size={24} color={theme.primary} />
            </View>
            <View style={styles.connectOptionContent}>
              <ThemedText style={[styles.connectOptionTitle, { color: theme.text }]}>{t("Connect Health Systems")}</ThemedText>
              <ThemedText style={[styles.connectOptionDesc, { color: theme.textSecondary }]}>
                Import records from 50,000+ hospitals, labs, and clinics. Your data will be automatically organized.
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.primary} />
          </Pressable>
        ) : null}

        <View style={[styles.connectOptionCard, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
          <View style={[styles.connectOptionIcon, { backgroundColor: `${theme.textSecondary}15` }]}>
            <Feather name="edit-3" size={24} color={theme.textSecondary} />
          </View>
          <View style={styles.connectOptionContent}>
            <ThemedText style={[styles.connectOptionTitle, { color: theme.text }]}>{t("Manual Entry Complete")}</ThemedText>
            <ThemedText style={[styles.connectOptionDesc, { color: theme.textSecondary }]}>
              You've already entered your health information in previous steps. You can connect records later from Settings.
            </ThemedText>
          </View>
          <Feather name="check" size={20} color={theme.success} />
        </View>
      </View>
    );
  };

  const renderStepConsent = () => {
    const filledFields = [
      personal.firstName, personal.lastName, personal.dateOfBirth,
      contact.phone,
    ].filter(Boolean).length;
    const conditionCount = (medical.noConditions ? 0 : medical.conditions.filter(c => c.name.trim()).length) + selectedConditions.length;
    const surgeryCount = (medical.noSurgeries ? 0 : medical.surgeries.filter(s => s.name.trim()).length) + selectedSurgeries.length;
    const familyCount = (medical.noFamilyHistory ? 0 : medical.familyHistory.filter(f => f.condition.trim()).length) + selectedFamilyConditions.length;
    const allergyCount = allergyMed.noAllergies ? 0 : allergyMed.allergies.filter(a => a.allergen.trim()).length;
    const medCount = allergyMed.noMedications ? 0 : allergyMed.medications.filter(m => m.name.trim()).length;

    return (
      <View style={styles.stepContent}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
          <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>{t("Profile Summary")}</ThemedText>
          <View style={styles.summaryRow}>
            <Feather name="user" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {personal.firstName ? `${personal.firstName} ${personal.middleName ? personal.middleName + " " : ""}${personal.lastName}` : "Name not provided"}
            </ThemedText>
          </View>
          {personal.dateOfBirth ? (
            <View style={styles.summaryRow}>
              <Feather name="calendar" size={16} color={theme.primary} />
              <ThemedText style={{ color: theme.text, flex: 1 }}>DOB: {personal.dateOfBirth}</ThemedText>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Feather name="heart" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {conditionCount > 0 ? `${conditionCount} condition${conditionCount > 1 ? "s" : ""}` : "No conditions"} recorded
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Feather name="scissors" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {surgeryCount > 0 ? `${surgeryCount} surger${surgeryCount > 1 ? "ies" : "y"}` : "No surgeries"} recorded
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Feather name="users" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {familyCount > 0 ? `${familyCount} family condition${familyCount > 1 ? "s" : ""}` : "No family history"} recorded
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Feather name="alert-triangle" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {allergyCount > 0 ? `${allergyCount} allergy/allergies` : "NKDA"} recorded
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <Feather name="package" size={16} color={theme.primary} />
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {medCount > 0 ? `${medCount} medication${medCount > 1 ? "s" : ""}` : "No medications"} recorded
            </ThemedText>
          </View>
          {fastenConnectionMade ? (
            <View style={styles.summaryRow}>
              <Feather name="link" size={16} color={theme.success} />
              <ThemedText style={{ color: theme.success, flex: 1 }}>Health records connected</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.sectionDivider, { borderColor: theme.border }]} />

        <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>{t("Legal Agreements")}</ThemedText>

        <Pressable
          testID="toggle-hipaa"
          onPress={() => setConsent(c => ({ ...c, hipaaConsent: !c.hipaaConsent }))}
          style={[styles.consentRow, {
            borderColor: consent.hipaaConsent ? theme.primary : theme.border,
            backgroundColor: consent.hipaaConsent ? `${theme.primary}05` : "transparent",
          }]}
        >
          <View style={[styles.consentCheckbox, {
            backgroundColor: consent.hipaaConsent ? theme.primary : "transparent",
            borderColor: consent.hipaaConsent ? theme.primary : theme.border,
          }]}>
            {consent.hipaaConsent ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <View style={styles.consentTextWrap}>
            <ThemedText style={[styles.consentLabel, { color: theme.text }]}>{t("HIPAA Acknowledgment *")}</ThemedText>
            <ThemedText style={[styles.consentDesc, { color: theme.textSecondary }]}>
              I acknowledge the Notice of Privacy Practices and understand how my health information may be used.
            </ThemedText>
          </View>
        </Pressable>

        <Pressable
          testID="toggle-terms"
          onPress={() => setConsent(c => ({ ...c, termsAccepted: !c.termsAccepted }))}
          style={[styles.consentRow, {
            borderColor: consent.termsAccepted ? theme.primary : theme.border,
            backgroundColor: consent.termsAccepted ? `${theme.primary}05` : "transparent",
          }]}
        >
          <View style={[styles.consentCheckbox, {
            backgroundColor: consent.termsAccepted ? theme.primary : "transparent",
            borderColor: consent.termsAccepted ? theme.primary : theme.border,
          }]}>
            {consent.termsAccepted ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <View style={styles.consentTextWrap}>
            <ThemedText style={[styles.consentLabel, { color: theme.text }]}>{t("Terms of Service *")}</ThemedText>
            <ThemedText style={[styles.consentDesc, { color: theme.textSecondary }]}>
              I agree to the Terms of Service and platform usage agreement.
            </ThemedText>
          </View>
        </Pressable>

        <Pressable
          testID="toggle-data-sharing"
          onPress={() => setConsent(c => ({ ...c, dataSharingConsent: !c.dataSharingConsent }))}
          style={[styles.consentRow, {
            borderColor: consent.dataSharingConsent ? theme.primary : theme.border,
            backgroundColor: consent.dataSharingConsent ? `${theme.primary}05` : "transparent",
          }]}
        >
          <View style={[styles.consentCheckbox, {
            backgroundColor: consent.dataSharingConsent ? theme.primary : "transparent",
            borderColor: consent.dataSharingConsent ? theme.primary : theme.border,
          }]}>
            {consent.dataSharingConsent ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <View style={styles.consentTextWrap}>
            <ThemedText style={[styles.consentLabel, { color: theme.text }]}>{t("Data Sharing (Optional)")}</ThemedText>
            <ThemedText style={[styles.consentDesc, { color: theme.textSecondary }]}>
              Allow sharing health data with connected providers for coordinated care.
            </ThemedText>
          </View>
        </Pressable>

        {!consent.hipaaConsent || !consent.termsAccepted ? (
          <View style={[styles.warningBanner, { backgroundColor: `${theme.warning}10`, borderColor: `${theme.warning}30` }]}>
            <Feather name="info" size={16} color={theme.warning} />
            <ThemedText style={[{ color: theme.warning, fontSize: 13, flex: 1 }]}>
              HIPAA acknowledgment and Terms of Service are required to continue.
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step.key) {
      case "personal": return renderStepPersonal();
      case "contact": return renderStepContact();
      case "medical": return renderStepMedical();
      case "allergiesMeds": return renderStepAllergiesMeds();
      case "lifestyle": return renderStepLifestyle();
      case "providers": return renderStepProviders();
      case "connect": return renderStepConnect();
      case "consent": return renderStepConsent();
      default: return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 0) {
      return personal.firstName.trim().length > 0 && personal.lastName.trim().length > 0 && personal.dateOfBirth.trim().length > 0;
    }
    if (currentStep === 1) {
      return contact.phone.trim().length > 0;
    }
    if (currentStep === STEPS.length - 1) return consent.hipaaConsent && consent.termsAccepted;
    return true;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          {currentStep > 0 ? (
            <Pressable testID="button-onboarding-back" onPress={handleBack} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Feather name="chevron-left" size={24} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <View style={styles.headerCenter}>
            <ThemedText style={[styles.headerStepText, { color: theme.textSecondary }]}>
              {t("Step")} {currentStep + 1} {t("of")} {STEPS.length}
            </ThemedText>
          </View>
          <Pressable testID="button-onboarding-skip" onPress={handleSkip} style={styles.headerBtn}>
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>{t("Skip")}</ThemedText>
          </Pressable>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={step.key} entering={FadeInDown.duration(250)}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconWrap, { backgroundColor: `${theme.primary}12` }]}>
                <Feather name={step.icon} size={24} color={theme.primary} />
              </View>
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>{t(step.title)}</ThemedText>
              <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>{t(step.subtitle)}</ThemedText>
            </View>

            {renderAITip()}
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInUp} style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm, backgroundColor: theme.backgroundRoot }]}>
        {saveError ? (
          <View style={[styles.errorBanner, { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}30` }]}>
            <Feather name="alert-circle" size={16} color={theme.error} />
            <ThemedText style={[{ color: theme.error, fontSize: 13, flex: 1 }]}>{saveError}</ThemedText>
          </View>
        ) : null}
        <Pressable
          testID="button-onboarding-continue"
          style={[styles.continueBtn, { backgroundColor: canProceed() && !isSaving ? theme.primary : theme.border }]}
          onPress={handleNext}
          disabled={!canProceed() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ThemedText style={styles.continueBtnText}>
                {saveError ? t("Retry") : currentStep === STEPS.length - 1 ? t("Complete Setup") : t("Continue")}
              </ThemedText>
              <Feather name={currentStep === STEPS.length - 1 ? "check" : "arrow-right"} size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </Animated.View>

      <VoiceFAB
        onFillField={handleVoiceFill}
        onConfirm={handleNext}
        onCancel={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBtn: { width: 50, height: 40, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerStepText: { fontSize: 13, fontWeight: "500" },
  skipText: { fontSize: 14, fontWeight: "500" },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: Spacing.xs },
  progressFill: { height: "100%", borderRadius: 2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  stepHeader: { alignItems: "center", paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  stepIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  stepSubtitle: { fontSize: 14, marginTop: 4, textAlign: "center" },
  aiTipCard: { flexDirection: "row", borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  aiTipIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  aiTipContent: { flex: 1 },
  aiTipLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  aiTipText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  stepContent: { gap: Spacing.sm },
  inputGroup: { marginBottom: Spacing.xs },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.sm, fontSize: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  chipText: { fontSize: 13 },
  codeText: { fontSize: 10, marginTop: 1 },
  icdCodeLabel: { fontSize: 11, marginTop: -4, marginBottom: Spacing.xs },
  countryCodeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.sm, minWidth: 70 },
  chipSectionLabel: { fontSize: 14, fontWeight: "600", marginTop: Spacing.sm, marginBottom: 2 },
  chipSectionHint: { fontSize: 12, marginBottom: Spacing.sm },
  miniChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  miniChipText: { fontSize: 11 },
  rowFields: { flexDirection: "row", gap: Spacing.sm },
  sectionDivider: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, borderTopWidth: 1, paddingTop: Spacing.md, marginVertical: Spacing.md },
  sectionDividerText: { fontSize: 15, fontWeight: "700" },
  searchResultsContainer: { borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs, maxHeight: 280, overflow: "hidden" },
  searchResultRow: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderBottomWidth: 1, gap: Spacing.sm },
  selectedProviderCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  savingsChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, marginRight: Spacing.xs, marginBottom: Spacing.xs, minWidth: 100 },
  savingsTip: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  subSectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.xs },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, marginBottom: Spacing.xs },
  listItemCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, position: "relative" },
  listItemFields: { flexDirection: "row", gap: Spacing.sm },
  listItemField: {},
  listItemInput: { borderWidth: 1, borderRadius: BorderRadius.xs, paddingHorizontal: Spacing.sm, paddingVertical: Platform.OS === "ios" ? Spacing.sm : 6, fontSize: 14 },
  removeBtn: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: Spacing.sm, borderWidth: 1, borderStyle: "dashed", borderRadius: BorderRadius.md, marginTop: Spacing.xs },
  addBtnText: { fontSize: 14, fontWeight: "500" },
  connectOptionCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.md },
  connectOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  connectOptionContent: { flex: 1 },
  connectOptionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  connectOptionDesc: { fontSize: 13, lineHeight: 19 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  summaryCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.lg, gap: Spacing.md },
  summaryTitle: { fontSize: 17, fontWeight: "700", marginBottom: Spacing.xs },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  consentRow: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderWidth: 1.5, borderRadius: BorderRadius.md, gap: Spacing.md, marginBottom: Spacing.sm },
  consentCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center", marginTop: 2 },
  consentTextWrap: { flex: 1 },
  consentLabel: { fontSize: 15, fontWeight: "700" },
  consentDesc: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  warningBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  webViewLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
});
