import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight, FadeOutLeft } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { CodeLookup, type CodeResult } from "@/components/ui";
import { MedicalAutoComplete } from "@/components/MedicalAutoComplete";
import { AIValidationBanner } from "@/components/AIValidationBanner";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const STEPS = [
  { key: "demographics", title: "Demographics", icon: "user" as const, desc: "Personal information" },
  { key: "medicalHistory", title: "Medical History", icon: "heart" as const, desc: "Past & current conditions" },
  { key: "allergies", title: "Allergies", icon: "alert-triangle" as const, desc: "Known allergies & reactions" },
  { key: "medications", title: "Medications", icon: "package" as const, desc: "Current medications" },
  { key: "socialHistory", title: "Social History", icon: "users" as const, desc: "Lifestyle & habits" },
  { key: "insurance", title: "Insurance", icon: "shield" as const, desc: "Coverage information" },
];

interface IntakeData {
  id: string;
  status: string;
  demographics: any;
  medicalHistory: any;
  allergies: any;
  currentMedications: any;
  socialHistory: any;
  insuranceInfo: any;
  completedSteps: number[];
  currentStep: number;
  cdsResults: any;
}

export default function PatientIntakeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme: colors } = useTheme();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const [demographics, setDemographics] = useState({
    firstName: "", lastName: "", dateOfBirth: "", gender: "",
    phone: "", email: "", addressLine1: "", addressLine2: "",
    city: "", state: "", zipCode: "", race: "", ethnicity: "",
    preferredLanguage: "English", maritalStatus: "",
  });

  const [medicalHistory, setMedicalHistory] = useState({
    conditions: [{ name: "", diagnosedYear: "", status: "active" }],
    surgeries: [{ name: "", year: "" }],
    familyHistory: [{ condition: "", relation: "" }],
    currentSymptoms: [""],
  });

  const [allergiesData, setAllergiesData] = useState({
    allergies: [{ allergen: "", reaction: "", severity: "mild" }],
    noKnownAllergies: false,
  });

  const [medicationsData, setMedicationsData] = useState({
    medications: [{ name: "", dosage: "", frequency: "", prescribedBy: "" }],
    noCurrentMedications: false,
  });

  const [socialHistory, setSocialHistory] = useState({
    smokingStatus: "", alcoholUse: "", exerciseFrequency: "",
    occupation: "", livingSituation: "", dietaryPreferences: "",
    substanceUse: "none", stressLevel: "",
  });

  const [medCodes, setMedCodes] = useState<Record<number, { rxnormCode?: string; npiNumber?: string }>>({});
  const [validationIssues, setValidationIssues] = useState<Array<{ type: "error" | "warning" | "info"; field: string; message: string; suggestion?: string }>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidation, setShowValidation] = useState(true);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [insuranceData, setInsuranceData] = useState({
    provider: "", memberId: "", groupNumber: "",
    planType: "", policyHolderName: "", policyHolderDob: "",
    relationshipToInsured: "self",
    hasSecondary: false,
    secondaryProvider: "", secondaryMemberId: "",
  });

  const { data: currentIntake } = useQuery<IntakeData | null>({
    queryKey: ["/api/intake/current"],
  });

  useEffect(() => {
    if (currentIntake && currentIntake.id && !intakeId) {
      setIntakeId(currentIntake.id);
      setCurrentStep(currentIntake.currentStep || 0);
      if (currentIntake.demographics) setDemographics(prev => ({ ...prev, ...currentIntake.demographics }));
      if (currentIntake.medicalHistory) setMedicalHistory(prev => ({ ...prev, ...currentIntake.medicalHistory }));
      if (currentIntake.allergies) setAllergiesData(prev => ({ ...prev, ...currentIntake.allergies }));
      if (currentIntake.currentMedications) setMedicationsData(prev => ({ ...prev, ...currentIntake.currentMedications }));
      if (currentIntake.socialHistory) setSocialHistory(prev => ({ ...prev, ...currentIntake.socialHistory }));
      if (currentIntake.insuranceInfo) setInsuranceData(prev => ({ ...prev, ...currentIntake.insuranceInfo }));
    }
  }, [currentIntake]);

  const createIntake = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", new URL("/api/intake", getApiUrl()).toString());
      return res.json();
    },
    onSuccess: (data) => {
      setIntakeId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/intake/current"] });
    },
  });

  const saveStep = useMutation({
    mutationFn: async ({ step, data }: { step: number; data: any }) => {
      if (!intakeId) return;
      const res = await apiRequest("PUT", new URL(`/api/intake/${intakeId}/step`, getApiUrl()).toString(), { step, data });
      return res.json();
    },
  });

  const completeIntake = useMutation({
    mutationFn: async () => {
      if (!intakeId) return;
      const res = await apiRequest("POST", new URL(`/api/intake/${intakeId}/complete`, getApiUrl()).toString());
      return res.json();
    },
    onSuccess: (data) => {
      setCompletionData(data);
      setShowCompletionModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/intake/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient/health-summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  useEffect(() => {
    if (!intakeId && !currentIntake) {
      createIntake.mutate();
    }
  }, []);

  const startIntake = useCallback(() => {
    if (!intakeId) {
      createIntake.mutate();
    }
  }, [intakeId]);

  const getStepData = (step: number) => {
    switch (step) {
      case 0: return demographics;
      case 1: return medicalHistory;
      case 2: return allergiesData;
      case 3: return { ...medicationsData, medCodes };
      case 4: return socialHistory;
      case 5: return insuranceData;
      default: return {};
    }
  };

  const goToNextStep = useCallback(async () => {
    try {
      const data = getStepData(currentStep);
      if (intakeId) {
        await saveStep.mutateAsync({ step: currentStep, data });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else if (intakeId) {
        completeIntake.mutate();
      }
    } catch (err) {
      console.warn("Failed to save step:", err);
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    }
  }, [currentStep, intakeId, demographics, medicalHistory, allergiesData, medicationsData, socialHistory, insuranceData]);

  const triggerValidation = useCallback(() => {
    const hasConditions = medicalHistory.conditions.some((c: any) => c.name?.trim());
    const hasAllergies = !allergiesData.noKnownAllergies && allergiesData.allergies.some((a: any) => a.allergen?.trim());
    const hasMeds = !medicationsData.noCurrentMedications && medicationsData.medications.some((m: any) => m.name?.trim());
    if (!hasConditions && !hasAllergies && !hasMeds) return;
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    validationTimerRef.current = setTimeout(async () => {
      try {
        setIsValidating(true);
        setShowValidation(true);
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}/api/intake/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medicalHistory, allergies: allergiesData, medications: medicationsData }),
        });
        if (res.ok) {
          const result = await res.json();
          setValidationIssues(result.issues || []);
        }
      } catch (err) {
        console.warn("Validation error:", err);
      } finally {
        setIsValidating(false);
      }
    }, 1500);
  }, [medicalHistory, allergiesData, medicationsData]);

  useEffect(() => {
    if (currentStep >= 1 && currentStep <= 3) {
      triggerValidation();
    }
    return () => { if (validationTimerRef.current) clearTimeout(validationTimerRef.current); };
  }, [currentStep]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep]);

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    options?: { multiline?: boolean; keyboardType?: any }
  ) => (
    <View style={styles.inputGroup}>
      <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          { color: colors.text, borderColor: `${colors.textSecondary}30`, backgroundColor: `${colors.backgroundDefault}` },
          options?.multiline ? styles.multilineInput : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={`${colors.textSecondary}60`}
        multiline={options?.multiline}
        keyboardType={options?.keyboardType}
        testID={`input-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
    </View>
  );

  const renderSelect = (
    label: string,
    value: string,
    options: string[],
    onSelect: (val: string) => void
  ) => (
    <View style={styles.inputGroup}>
      <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      <View style={styles.selectRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${opt}`}
            accessibilityState={{ selected: value === opt }}
            style={[
              styles.selectOption,
              { borderColor: `${colors.textSecondary}30` },
              value === opt ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
            ]}
            onPress={() => {
              onSelect(opt);
              Haptics.selectionAsync();
            }}
            testID={`select-${label.toLowerCase().replace(/\s+/g, "-")}-${opt.toLowerCase()}`}
          >
            <ThemedText style={[styles.selectText, value === opt ? { color: "#fff" } : { color: colors.text }]}>
              {opt}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderDemographics = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Please provide your personal information. All data is encrypted and HIPAA-compliant.
      </ThemedText>
      {renderInput("First Name", demographics.firstName, (v) => setDemographics(p => ({ ...p, firstName: v })))}
      {renderInput("Last Name", demographics.lastName, (v) => setDemographics(p => ({ ...p, lastName: v })))}
      {renderInput("Date of Birth", demographics.dateOfBirth, (v) => setDemographics(p => ({ ...p, dateOfBirth: v })), "MM/DD/YYYY")}
      {renderSelect("Gender", demographics.gender, ["Male", "Female", "Non-binary", "Other", "Prefer not to say"], (v) => setDemographics(p => ({ ...p, gender: v })))}
      {renderInput("Phone", demographics.phone, (v) => setDemographics(p => ({ ...p, phone: v })), "(555) 555-5555", { keyboardType: "phone-pad" })}
      {renderInput("Email", demographics.email, (v) => setDemographics(p => ({ ...p, email: v })), "email@example.com", { keyboardType: "email-address" })}
      {renderInput("Street Address", demographics.addressLine1, (v) => setDemographics(p => ({ ...p, addressLine1: v })))}
      {renderInput("Apt/Suite", demographics.addressLine2, (v) => setDemographics(p => ({ ...p, addressLine2: v })))}
      {renderInput("City", demographics.city, (v) => setDemographics(p => ({ ...p, city: v })))}
      {renderInput("State", demographics.state, (v) => setDemographics(p => ({ ...p, state: v })))}
      {renderInput("Zip Code", demographics.zipCode, (v) => setDemographics(p => ({ ...p, zipCode: v })), "12345", { keyboardType: "numeric" })}
      {renderSelect("Marital Status", demographics.maritalStatus, ["Single", "Married", "Divorced", "Widowed", "Separated"], (v) => setDemographics(p => ({ ...p, maritalStatus: v })))}
      {renderInput("Preferred Language", demographics.preferredLanguage, (v) => setDemographics(p => ({ ...p, preferredLanguage: v })))}
      {renderInput("Race", demographics.race, (v) => setDemographics(p => ({ ...p, race: v })))}
      {renderInput("Ethnicity", demographics.ethnicity, (v) => setDemographics(p => ({ ...p, ethnicity: v })))}
    </Animated.View>
  );

  const addListItem = (setter: Function, field: string, template: any) => {
    setter((prev: any) => ({
      ...prev,
      [field]: [...prev[field], template],
    }));
  };

  const updateListItem = (setter: Function, field: string, index: number, key: string, value: string) => {
    setter((prev: any) => ({
      ...prev,
      [field]: prev[field].map((item: any, i: number) =>
        i === index ? (typeof item === "string" ? value : { ...item, [key]: value }) : item
      ),
    }));
  };

  const removeListItem = (setter: Function, field: string, index: number) => {
    setter((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index),
    }));
  };

  const renderMedicalHistory = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Tell us about your medical history so we can provide better care.
      </ThemedText>

      <ThemedText style={[styles.subSectionLabel, { color: colors.text }]}>Current / Past Conditions</ThemedText>
      {medicalHistory.conditions.map((cond: any, idx: number) => (
        <Card key={idx} style={styles.listItemCard}>
          <View style={styles.listItemHeader}>
            <ThemedText style={[styles.listItemIndex, { color: colors.primary }]}>#{idx + 1}</ThemedText>
            {idx > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove condition ${idx + 1}`} onPress={() => removeListItem(setMedicalHistory, "conditions", idx)} testID={`remove-condition-${idx}`}>
                <Feather name="x-circle" size={18} color={colors.error} />
              </Pressable>
            ) : null}
          </View>
          <MedicalAutoComplete
            label="Condition"
            value={cond.name}
            onChangeText={(v) => updateListItem(setMedicalHistory, "conditions", idx, "name", v)}
            onSelect={(v) => updateListItem(setMedicalHistory, "conditions", idx, "name", v)}
            category="conditions"
            placeholder="e.g., Hypertension"
            testID={`input-condition-${idx}`}
          />
          {renderInput("Year Diagnosed", cond.diagnosedYear, (v) => updateListItem(setMedicalHistory, "conditions", idx, "diagnosedYear", v), "e.g., 2020")}
          {renderSelect("Status", cond.status, ["active", "resolved", "managed"], (v) => updateListItem(setMedicalHistory, "conditions", idx, "status", v))}
        </Card>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Add condition" style={[styles.addButton, { borderColor: colors.primary }]} onPress={() => addListItem(setMedicalHistory, "conditions", { name: "", diagnosedYear: "", status: "active" })} testID="add-condition">
        <Feather name="plus" size={16} color={colors.primary} />
        <ThemedText style={[styles.addButtonText, { color: colors.primary }]}>Add Condition</ThemedText>
      </Pressable>

      <ThemedText style={[styles.subSectionLabel, { color: colors.text }]}>Past Surgeries</ThemedText>
      {medicalHistory.surgeries.map((surg: any, idx: number) => (
        <Card key={idx} style={styles.listItemCard}>
          <View style={styles.listItemHeader}>
            <ThemedText style={[styles.listItemIndex, { color: colors.primary }]}>#{idx + 1}</ThemedText>
            {idx > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove surgery ${idx + 1}`} onPress={() => removeListItem(setMedicalHistory, "surgeries", idx)}>
                <Feather name="x-circle" size={18} color={colors.error} />
              </Pressable>
            ) : null}
          </View>
          <MedicalAutoComplete
            label="Surgery"
            value={surg.name}
            onChangeText={(v) => updateListItem(setMedicalHistory, "surgeries", idx, "name", v)}
            onSelect={(v) => updateListItem(setMedicalHistory, "surgeries", idx, "name", v)}
            category="surgeries"
            placeholder="e.g., Appendectomy"
            testID={`input-surgery-${idx}`}
          />
          {renderInput("Year", surg.year, (v) => updateListItem(setMedicalHistory, "surgeries", idx, "year", v), "e.g., 2018")}
        </Card>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Add surgery" style={[styles.addButton, { borderColor: colors.primary }]} onPress={() => addListItem(setMedicalHistory, "surgeries", { name: "", year: "" })} testID="add-surgery">
        <Feather name="plus" size={16} color={colors.primary} />
        <ThemedText style={[styles.addButtonText, { color: colors.primary }]}>Add Surgery</ThemedText>
      </Pressable>

      <ThemedText style={[styles.subSectionLabel, { color: colors.text }]}>Family History</ThemedText>
      {medicalHistory.familyHistory.map((fh: any, idx: number) => (
        <Card key={idx} style={styles.listItemCard}>
          <View style={styles.listItemHeader}>
            <ThemedText style={[styles.listItemIndex, { color: colors.primary }]}>#{idx + 1}</ThemedText>
            {idx > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove family history ${idx + 1}`} onPress={() => removeListItem(setMedicalHistory, "familyHistory", idx)}>
                <Feather name="x-circle" size={18} color={colors.error} />
              </Pressable>
            ) : null}
          </View>
          <MedicalAutoComplete
            label="Condition"
            value={fh.condition}
            onChangeText={(v) => updateListItem(setMedicalHistory, "familyHistory", idx, "condition", v)}
            onSelect={(v) => updateListItem(setMedicalHistory, "familyHistory", idx, "condition", v)}
            category="family_conditions"
            placeholder="e.g., Diabetes"
            testID={`input-family-condition-${idx}`}
          />
          {renderInput("Relation", fh.relation, (v) => updateListItem(setMedicalHistory, "familyHistory", idx, "relation", v), "e.g., Mother")}
        </Card>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Add family history" style={[styles.addButton, { borderColor: colors.primary }]} onPress={() => addListItem(setMedicalHistory, "familyHistory", { condition: "", relation: "" })} testID="add-family-history">
        <Feather name="plus" size={16} color={colors.primary} />
        <ThemedText style={[styles.addButtonText, { color: colors.primary }]}>Add Family History</ThemedText>
      </Pressable>

      <ThemedText style={[styles.subSectionLabel, { color: colors.text }]}>Current Symptoms</ThemedText>
      {medicalHistory.currentSymptoms.map((symptom: string, idx: number) => (
        <View key={idx} style={styles.symptomRow}>
          <View style={{ flex: 1 }}>
            <MedicalAutoComplete
              label=""
              value={symptom}
              onChangeText={(v) => updateListItem(setMedicalHistory, "currentSymptoms", idx, "", v)}
              onSelect={(v) => updateListItem(setMedicalHistory, "currentSymptoms", idx, "", v)}
              category="symptoms"
              placeholder="e.g., Headache"
              testID={`input-symptom-${idx}`}
            />
          </View>
          {idx > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove symptom ${idx + 1}`} onPress={() => removeListItem(setMedicalHistory, "currentSymptoms", idx)} style={styles.removeSymptom}>
              <Feather name="x" size={16} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Add symptom" style={[styles.addButton, { borderColor: colors.primary }]} onPress={() => addListItem(setMedicalHistory, "currentSymptoms", "")} testID="add-symptom">
        <Feather name="plus" size={16} color={colors.primary} />
        <ThemedText style={[styles.addButtonText, { color: colors.primary }]}>Add Symptom</ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderAllergies = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        List any known allergies, including drug, food, and environmental allergies.
      </ThemedText>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="No Known Allergies"
        accessibilityState={{ checked: allergiesData.noKnownAllergies }}
        style={[styles.toggleRow, { borderColor: `${colors.textSecondary}30` }]}
        onPress={() => {
          setAllergiesData(p => ({ ...p, noKnownAllergies: !p.noKnownAllergies }));
          Haptics.selectionAsync();
        }}
        testID="toggle-no-allergies"
      >
        <View style={[styles.checkbox, allergiesData.noKnownAllergies ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: `${colors.textSecondary}50` }]}>
          {allergiesData.noKnownAllergies ? <Feather name="check" size={14} color="#fff" /> : null}
        </View>
        <ThemedText style={[styles.toggleText, { color: colors.text }]}>No Known Allergies (NKDA)</ThemedText>
      </Pressable>

      {!allergiesData.noKnownAllergies ? (
        <>
          {allergiesData.allergies.map((allergy: any, idx: number) => (
            <Card key={idx} style={styles.listItemCard}>
              <View style={styles.listItemHeader}>
                <ThemedText style={[styles.listItemIndex, { color: colors.warning }]}>#{idx + 1}</ThemedText>
                {idx > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove allergy ${idx + 1}`} onPress={() => removeListItem(setAllergiesData, "allergies", idx)}>
                    <Feather name="x-circle" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
              <MedicalAutoComplete
                label="Allergen"
                value={allergy.allergen}
                onChangeText={(v) => updateListItem(setAllergiesData, "allergies", idx, "allergen", v)}
                onSelect={(v) => updateListItem(setAllergiesData, "allergies", idx, "allergen", v)}
                category="allergies"
                placeholder="e.g., Penicillin"
                testID={`input-allergen-${idx}`}
              />
              <MedicalAutoComplete
                label="Reaction"
                value={allergy.reaction}
                onChangeText={(v) => updateListItem(setAllergiesData, "allergies", idx, "reaction", v)}
                onSelect={(v) => updateListItem(setAllergiesData, "allergies", idx, "reaction", v)}
                category="reactions"
                placeholder="e.g., Hives, Swelling"
                testID={`input-reaction-${idx}`}
              />
              {renderSelect("Severity", allergy.severity, ["mild", "moderate", "severe", "life-threatening"], (v) => updateListItem(setAllergiesData, "allergies", idx, "severity", v))}
            </Card>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add allergy" style={[styles.addButton, { borderColor: colors.warning }]} onPress={() => addListItem(setAllergiesData, "allergies", { allergen: "", reaction: "", severity: "mild" })} testID="add-allergy">
            <Feather name="plus" size={16} color={colors.warning} />
            <ThemedText style={[styles.addButtonText, { color: colors.warning }]}>Add Allergy</ThemedText>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );

  const renderMedications = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        List all medications you are currently taking, including prescriptions, over-the-counter, and supplements.
      </ThemedText>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="No Current Medications"
        accessibilityState={{ checked: medicationsData.noCurrentMedications }}
        style={[styles.toggleRow, { borderColor: `${colors.textSecondary}30` }]}
        onPress={() => {
          setMedicationsData(p => ({ ...p, noCurrentMedications: !p.noCurrentMedications }));
          Haptics.selectionAsync();
        }}
        testID="toggle-no-medications"
      >
        <View style={[styles.checkbox, medicationsData.noCurrentMedications ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: `${colors.textSecondary}50` }]}>
          {medicationsData.noCurrentMedications ? <Feather name="check" size={14} color="#fff" /> : null}
        </View>
        <ThemedText style={[styles.toggleText, { color: colors.text }]}>No Current Medications</ThemedText>
      </Pressable>

      {!medicationsData.noCurrentMedications ? (
        <>
          {medicationsData.medications.map((med: any, idx: number) => (
            <Card key={idx} style={styles.listItemCard}>
              <View style={styles.listItemHeader}>
                <ThemedText style={[styles.listItemIndex, { color: colors.primary }]}>#{idx + 1}</ThemedText>
                {idx > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove medication ${idx + 1}`} onPress={() => removeListItem(setMedicationsData, "medications", idx)}>
                    <Feather name="x-circle" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
              <CodeLookup
                type="rxnorm"
                label="Medication Name"
                value={med.name}
                onChangeText={(v) => updateListItem(setMedicationsData, "medications", idx, "name", v)}
                onSelect={(item: CodeResult) => {
                  updateListItem(setMedicationsData, "medications", idx, "name", item.display);
                  setMedCodes(prev => ({ ...prev, [idx]: { ...prev[idx], rxnormCode: item.code } }));
                }}
                selectedCode={medCodes[idx]?.rxnormCode}
                placeholder="Search medications (e.g., Lisinopril)"
                testID={`input-medication-name-${idx}`}
              />
              {renderInput("Dosage", med.dosage, (v) => updateListItem(setMedicationsData, "medications", idx, "dosage", v), "e.g., 10mg")}
              {renderInput("Frequency", med.frequency, (v) => updateListItem(setMedicationsData, "medications", idx, "frequency", v), "e.g., Once daily")}
              <CodeLookup
                type="npi"
                label="Prescribed By"
                value={med.prescribedBy}
                onChangeText={(v) => updateListItem(setMedicationsData, "medications", idx, "prescribedBy", v)}
                onSelect={(item: CodeResult) => {
                  const providerName = item.credential 
                    ? `${item.firstName} ${item.lastName}, ${item.credential}`
                    : `${item.firstName} ${item.lastName}`;
                  updateListItem(setMedicationsData, "medications", idx, "prescribedBy", providerName);
                  setMedCodes(prev => ({ ...prev, [idx]: { ...prev[idx], npiNumber: item.npi } }));
                }}
                selectedCode={medCodes[idx]?.npiNumber}
                placeholder="Search providers (e.g., Dr. Smith)"
                testID={`input-prescribed-by-${idx}`}
              />
            </Card>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add medication" style={[styles.addButton, { borderColor: colors.primary }]} onPress={() => addListItem(setMedicationsData, "medications", { name: "", dosage: "", frequency: "", prescribedBy: "" })} testID="add-medication">
            <Feather name="plus" size={16} color={colors.primary} />
            <ThemedText style={[styles.addButtonText, { color: colors.primary }]}>Add Medication</ThemedText>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );

  const renderSocialHistory = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        This information helps provide holistic care. Your responses are confidential and protected.
      </ThemedText>

      {renderSelect("Smoking Status", socialHistory.smokingStatus, ["Never", "Former", "Current", "Occasional"], (v) => setSocialHistory(p => ({ ...p, smokingStatus: v })))}
      {renderSelect("Alcohol Use", socialHistory.alcoholUse, ["None", "Social", "Moderate", "Heavy"], (v) => setSocialHistory(p => ({ ...p, alcoholUse: v })))}
      {renderSelect("Exercise Frequency", socialHistory.exerciseFrequency, ["None", "1-2x/week", "3-4x/week", "5+/week"], (v) => setSocialHistory(p => ({ ...p, exerciseFrequency: v })))}
      {renderInput("Occupation", socialHistory.occupation, (v) => setSocialHistory(p => ({ ...p, occupation: v })))}
      {renderSelect("Living Situation", socialHistory.livingSituation, ["Alone", "With family", "With roommate", "Assisted living"], (v) => setSocialHistory(p => ({ ...p, livingSituation: v })))}
      {renderInput("Dietary Preferences", socialHistory.dietaryPreferences, (v) => setSocialHistory(p => ({ ...p, dietaryPreferences: v })), "e.g., Vegetarian, No restrictions")}
      {renderSelect("Substance Use", socialHistory.substanceUse, ["none", "marijuana", "other", "prefer not to say"], (v) => setSocialHistory(p => ({ ...p, substanceUse: v })))}
      {renderSelect("Stress Level", socialHistory.stressLevel, ["Low", "Moderate", "High", "Very High"], (v) => setSocialHistory(p => ({ ...p, stressLevel: v })))}
    </Animated.View>
  );

  const renderInsurance = () => (
    <Animated.View entering={FadeInRight.duration(300)}>
      <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Provide your insurance details for billing and coverage verification.
      </ThemedText>

      {renderInput("Insurance Provider", insuranceData.provider, (v) => setInsuranceData(p => ({ ...p, provider: v })), "e.g., Blue Cross Blue Shield")}
      {renderInput("Member ID", insuranceData.memberId, (v) => setInsuranceData(p => ({ ...p, memberId: v })))}
      {renderInput("Group Number", insuranceData.groupNumber, (v) => setInsuranceData(p => ({ ...p, groupNumber: v })))}
      {renderSelect("Plan Type", insuranceData.planType, ["HMO", "PPO", "EPO", "POS", "HDHP", "Medicare", "Medicaid"], (v) => setInsuranceData(p => ({ ...p, planType: v })))}
      {renderInput("Policy Holder Name", insuranceData.policyHolderName, (v) => setInsuranceData(p => ({ ...p, policyHolderName: v })))}
      {renderInput("Policy Holder DOB", insuranceData.policyHolderDob, (v) => setInsuranceData(p => ({ ...p, policyHolderDob: v })), "MM/DD/YYYY")}
      {renderSelect("Relationship to Insured", insuranceData.relationshipToInsured, ["self", "spouse", "child", "other"], (v) => setInsuranceData(p => ({ ...p, relationshipToInsured: v })))}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I have secondary insurance"
        accessibilityState={{ checked: insuranceData.hasSecondary }}
        style={[styles.toggleRow, { borderColor: `${colors.textSecondary}30`, marginTop: Spacing.md }]}
        onPress={() => {
          setInsuranceData(p => ({ ...p, hasSecondary: !p.hasSecondary }));
          Haptics.selectionAsync();
        }}
        testID="toggle-secondary-insurance"
      >
        <View style={[styles.checkbox, insuranceData.hasSecondary ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: `${colors.textSecondary}50` }]}>
          {insuranceData.hasSecondary ? <Feather name="check" size={14} color="#fff" /> : null}
        </View>
        <ThemedText style={[styles.toggleText, { color: colors.text }]}>I have secondary insurance</ThemedText>
      </Pressable>

      {insuranceData.hasSecondary ? (
        <>
          {renderInput("Secondary Provider", insuranceData.secondaryProvider, (v) => setInsuranceData(p => ({ ...p, secondaryProvider: v })))}
          {renderInput("Secondary Member ID", insuranceData.secondaryMemberId, (v) => setInsuranceData(p => ({ ...p, secondaryMemberId: v })))}
        </>
      ) : null}
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderDemographics();
      case 1: return renderMedicalHistory();
      case 2: return renderAllergies();
      case 3: return renderMedications();
      case 4: return renderSocialHistory();
      case 5: return renderInsurance();
      default: return null;
    }
  };

  const renderCompletionModal = () => (
    <Modal visible={showCompletionModal} transparent animationType="fade" testID="completion-modal">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
          <View style={[styles.completionIconCircle, { backgroundColor: `${colors.success}15` }]}>
            <Feather name="check-circle" size={48} color={colors.success} />
          </View>
          <ThemedText style={[styles.completionTitle, { color: colors.text }]}>Intake Complete</ThemedText>
          <ThemedText style={[styles.completionDesc, { color: colors.textSecondary }]}>
            Your health information has been submitted and clinical analysis has been initiated.
          </ThemedText>

          {completionData?.cdsResults?.alerts && completionData.cdsResults.alerts.length > 0 ? (
            <View style={styles.cdsAlertSection}>
              <ThemedText style={[styles.cdsAlertTitle, { color: colors.text }]}>
                Clinical Insights ({completionData.cdsResults.alerts.length})
              </ThemedText>
              {completionData.cdsResults.alerts.slice(0, 3).map((alert: any, idx: number) => (
                <Card key={idx} style={{ ...styles.cdsAlertCard, borderLeftColor: alert.severity === "critical" ? colors.error : alert.severity === "high" ? colors.warning : colors.primary, borderLeftWidth: 3 }}>
                  <ThemedText style={[styles.cdsAlertName, { color: colors.text }]} numberOfLines={2}>{alert.title}</ThemedText>
                  <ThemedText style={[styles.cdsAlertDesc, { color: colors.textSecondary }]} numberOfLines={3}>{alert.description}</ThemedText>
                </Card>
              ))}
            </View>
          ) : null}

          {completionData?.cdsResults?.drugInteractions && completionData.cdsResults.drugInteractions.length > 0 ? (
            <View style={styles.cdsAlertSection}>
              <ThemedText style={[styles.cdsAlertTitle, { color: colors.error }]}>
                Drug Interactions Found ({completionData.cdsResults.drugInteractions.length})
              </ThemedText>
              {completionData.cdsResults.drugInteractions.slice(0, 2).map((interaction: any, idx: number) => (
                <Card key={idx} style={{ ...styles.cdsAlertCard, borderLeftColor: colors.error, borderLeftWidth: 3 }}>
                  <ThemedText style={[styles.cdsAlertName, { color: colors.text }]}>
                    {interaction.drug1} + {interaction.drug2}
                  </ThemedText>
                  <ThemedText style={[styles.cdsAlertDesc, { color: colors.textSecondary }]} numberOfLines={2}>{interaction.description}</ThemedText>
                </Card>
              ))}
            </View>
          ) : null}

          <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            This is not medical advice. Please consult your healthcare provider for diagnosis and treatment decisions.
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done, close intake form"
            style={[styles.completionButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setShowCompletionModal(false);
              navigation.goBack();
            }}
            testID="button-done"
          >
            <ThemedText style={styles.completionButtonText}>Done</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (!intakeId) {
    return (
      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={styles.welcomeSection}>
            <View style={[styles.welcomeIconCircle, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="clipboard" size={48} color={colors.primary} />
            </View>
            <ThemedText style={[styles.welcomeTitle, { color: colors.text }]}>Patient Intake Form</ThemedText>
            <ThemedText style={[styles.welcomeDesc, { color: colors.textSecondary }]}>
              Complete your health information in 6 easy steps. Your data is encrypted and HIPAA-compliant. You can save your progress and return at any time.
            </ThemedText>

            <View style={styles.stepsList}>
              {STEPS.map((step, idx) => (
                <Animated.View key={step.key} entering={FadeInDown.delay(100 + idx * 80)}>
                  <View style={styles.stepsListItem}>
                    <View style={[styles.stepListIcon, { backgroundColor: `${colors.primary}10` }]}>
                      <Feather name={step.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.stepListInfo}>
                      <ThemedText style={[styles.stepListTitle, { color: colors.text }]}>{step.title}</ThemedText>
                      <ThemedText style={[styles.stepListDesc, { color: colors.textSecondary }]}>{step.desc}</ThemedText>
                    </View>
                    <ThemedText style={[styles.stepListNum, { color: colors.textSecondary }]}>{idx + 1}</ThemedText>
                  </View>
                </Animated.View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Begin intake"
              accessibilityState={{ disabled: createIntake.isPending }}
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={startIntake}
              disabled={createIntake.isPending}
              testID="button-start-intake"
            >
              {createIntake.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <ThemedText style={styles.startButtonText}>Begin Intake</ThemedText>
                  <Feather name="arrow-right" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.progressBar, { paddingTop: headerHeight + Spacing.xs }]}>
        <View style={styles.progressSteps}>
          {STEPS.map((step, idx) => (
            <Pressable
              key={step.key}
              accessibilityRole="button"
              accessibilityLabel={`Step ${idx + 1}: ${step.title}${idx < currentStep ? ", completed" : idx === currentStep ? ", current" : ""}`}
              accessibilityState={{ selected: idx === currentStep }}
              style={styles.progressStep}
              onPress={() => {
                if (idx <= currentStep) setCurrentStep(idx);
              }}
              testID={`step-indicator-${idx}`}
            >
              <View
                style={[
                  styles.progressDot,
                  idx < currentStep ? { backgroundColor: colors.success } :
                  idx === currentStep ? { backgroundColor: colors.primary } :
                  { backgroundColor: `${colors.textSecondary}30` },
                ]}
              >
                {idx < currentStep ? (
                  <Feather name="check" size={12} color="#fff" />
                ) : (
                  <ThemedText style={[styles.progressDotText, idx === currentStep ? { color: "#fff" } : { color: colors.textSecondary }]}>
                    {idx + 1}
                  </ThemedText>
                )}
              </View>
              <ThemedText
                style={[
                  styles.progressLabel,
                  idx === currentStep ? { color: colors.primary, fontWeight: "600" } : { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {step.title}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: `${colors.textSecondary}20` }]}>
          <View style={[styles.progressFill, { width: `${((currentStep + 1) / STEPS.length) * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.formContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepHeader}>
          <Feather name={STEPS[currentStep].icon} size={24} color={colors.primary} />
          <ThemedText style={[styles.stepTitle, { color: colors.text }]}>
            {STEPS[currentStep].title}
          </ThemedText>
          <ThemedText style={[styles.stepCounter, { color: colors.textSecondary }]}>
            Step {currentStep + 1} of {STEPS.length}
          </ThemedText>
        </View>

        {currentStep >= 1 && currentStep <= 3 ? (
          <AIValidationBanner
            issues={validationIssues}
            isValidating={isValidating}
            onDismiss={() => { setShowValidation(false); setValidationIssues([]); }}
          />
        ) : null}

        {renderCurrentStep()}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + Spacing.sm, backgroundColor: colors.backgroundDefault, borderTopColor: `${colors.textSecondary}15` }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous step"
          accessibilityState={{ disabled: currentStep === 0 }}
          style={[styles.navButton, styles.navButtonOutline, { borderColor: currentStep === 0 ? `${colors.textSecondary}30` : colors.primary }]}
          onPress={goToPrevStep}
          disabled={currentStep === 0}
          testID="button-prev"
        >
          <Feather name="arrow-left" size={18} color={currentStep === 0 ? colors.textSecondary : colors.primary} />
          <ThemedText style={[styles.navButtonText, { color: currentStep === 0 ? colors.textSecondary : colors.primary }]}>Back</ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={currentStep === STEPS.length - 1 ? "Submit intake form" : "Next step"}
          accessibilityState={{ disabled: saveStep.isPending || completeIntake.isPending }}
          style={[styles.navButton, styles.navButtonFilled, { backgroundColor: currentStep === STEPS.length - 1 ? colors.success : colors.primary }]}
          onPress={goToNextStep}
          disabled={saveStep.isPending || completeIntake.isPending}
          testID="button-next"
        >
          {saveStep.isPending || completeIntake.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <ThemedText style={styles.navButtonFilledText}>
                {currentStep === STEPS.length - 1 ? "Submit" : "Next"}
              </ThemedText>
              <Feather name={currentStep === STEPS.length - 1 ? "check" : "arrow-right"} size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

      {renderCompletionModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  welcomeSection: { alignItems: "center", paddingTop: Spacing.xl },
  welcomeIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  welcomeTitle: { fontSize: 26, fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" },
  welcomeDesc: { fontSize: 14, lineHeight: 22, textAlign: "center", paddingHorizontal: Spacing.md, marginBottom: Spacing.xl },
  stepsList: { width: "100%", marginBottom: Spacing.xl },
  stepsListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  stepListIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepListInfo: { flex: 1, marginLeft: Spacing.md },
  stepListTitle: { fontSize: 15, fontWeight: "600" },
  stepListDesc: { fontSize: 12, marginTop: 2 },
  stepListNum: { fontSize: 14, fontWeight: "600", width: 24, textAlign: "center" },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    width: "100%",
  },
  startButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  progressBar: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  progressSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  progressDotText: { fontSize: 11, fontWeight: "700" },
  progressLabel: { fontSize: 9, textAlign: "center" },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Spacing.md,
  },
  stepTitle: { fontSize: 20, fontWeight: "700", flex: 1 },
  stepCounter: { fontSize: 13 },
  stepDescription: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  selectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectOption: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectText: { fontSize: 13 },
  subSectionLabel: { fontSize: 16, fontWeight: "600", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  listItemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  listItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  listItemIndex: { fontSize: 13, fontWeight: "700" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  addButtonText: { fontSize: 14, fontWeight: "600" },
  symptomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  symptomInput: { flex: 1 },
  removeSymptom: { marginLeft: Spacing.sm, padding: 4 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontSize: 14, fontWeight: "500" },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.md,
    zIndex: 10,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  navButtonOutline: {
    borderWidth: 1,
  },
  navButtonFilled: {},
  navButtonText: { fontSize: 15, fontWeight: "600" },
  navButtonFilledText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: "100%",
    maxHeight: "85%",
  },
  completionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  completionTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: Spacing.sm },
  completionDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: Spacing.lg },
  cdsAlertSection: { marginBottom: Spacing.md },
  cdsAlertTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.sm },
  cdsAlertCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  cdsAlertName: { fontSize: 13, fontWeight: "600" },
  cdsAlertDesc: { fontSize: 12, marginTop: 2 },
  disclaimerText: { fontSize: 11, fontStyle: "italic", textAlign: "center", marginVertical: Spacing.md, lineHeight: 16 },
  completionButton: {
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  completionButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
