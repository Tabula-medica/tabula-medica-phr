import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface PatientProfile {
  id: string;
  userId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  preferredPronouns: string | null;
  maritalStatus: string | null;
  preferredLanguage: string | null;
  ethnicity: string | null;
  sexualOrientation: string | null;
  genderIdentity: string | null;
  tribalAffiliation: string | null;
  relatedPersons: RelatedPerson[];
  insuranceCoverageStatus: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  emergencyContacts: EmergencyContact[];
  insuranceInfo: InsuranceInfo[];
  bloodType: string | null;
  organDonor: boolean;
  advanceDirectives: boolean;
  primaryPhysician: string | null;
  primaryPhysicianPhone: string | null;
  preferredPharmacy: string | null;
  pharmacyPhone: string | null;
  profileCompleteness: number;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberId?: string;
  effectiveDate?: string;
  type: "primary" | "secondary" | "tertiary";
}

interface RelatedPerson {
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
}

interface MedicalSummary {
  conditions: { id: string; title: string; date: string; summary: string }[];
  medications: { id: string; title: string; date: string; summary: string }[];
  allergies: { id: string; title: string; date: string; summary: string }[];
  immunizations: { id: string; title: string; date: string; summary: string }[];
  procedures: { id: string; title: string; date: string; summary: string }[];
  recentVitals: { id: string; title: string; date: string; summary: string }[];
  totalRecords: number;
}

type SectionName = "demographics" | "contact" | "emergency" | "insurance" | "medical";

interface SectionHeaderProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  isEditing: boolean;
  onEditPress: () => void;
  onSavePress: () => void;
  isSaving?: boolean;
  theme: typeof Colors.light;
}

function SectionHeader({ title, icon, isEditing, onEditPress, onSavePress, isSaving, theme }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}15` }]}>
          <Feather name={icon} size={16} color={theme.primary} />
        </View>
        <ThemedText type="h4" style={{ color: theme.text }}>{title}</ThemedText>
      </View>
      <Pressable
        onPress={isEditing ? onSavePress : onEditPress}
        style={({ pressed }) => [
          styles.editButton,
          { backgroundColor: isEditing ? theme.primary : `${theme.primary}15`, opacity: pressed ? 0.7 : 1 },
        ]}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={isEditing ? "#fff" : theme.primary} />
        ) : (
          <>
            <Feather name={isEditing ? "check" : "edit-2"} size={14} color={isEditing ? "#fff" : theme.primary} />
            <ThemedText type="small" style={{ color: isEditing ? "#fff" : theme.primary, marginLeft: 4 }}>
              {isEditing ? "Save" : "Edit"}
            </ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

interface FormFieldProps {
  label: string;
  value: string | null | undefined;
  isEditing: boolean;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  theme: typeof Colors.light;
  isDark: boolean;
}

function FormField({ label, value, isEditing, onChangeText, placeholder, keyboardType, theme, isDark }: FormFieldProps) {
  return (
    <View style={styles.formField}>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>{label}</ThemedText>
      {isEditing ? (
        <TextInput
          style={[
            styles.input,
            { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: theme.text, borderColor: theme.border },
          ]}
          value={value || ""}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType}
        />
      ) : (
        <ThemedText type="body" style={{ color: value ? theme.text : theme.textSecondary }}>
          {value || "Not provided"}
        </ThemedText>
      )}
    </View>
  );
}

interface PickerFieldProps {
  label: string;
  value: string | null | undefined;
  options: { label: string; value: string }[];
  isEditing: boolean;
  onSelect: (value: string) => void;
  theme: typeof Colors.light;
  isDark: boolean;
}

function PickerField({ label, value, options, isEditing, onSelect, theme, isDark }: PickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.formField}>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>{label}</ThemedText>
      {isEditing ? (
        <>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={[
              styles.input,
              styles.pickerButton,
              { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", borderColor: theme.border },
            ]}
          >
            <ThemedText type="body" style={{ color: value ? theme.text : theme.textSecondary }}>
              {options.find(o => o.value === value)?.label || "Select..."}
            </ThemedText>
            <Feather name="chevron-down" size={16} color={theme.textSecondary} />
          </Pressable>
          {showPicker ? (
            <View style={[styles.pickerOptions, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              {options.map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => { onSelect(option.value); setShowPicker(false); }}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    { backgroundColor: pressed ? `${theme.primary}10` : "transparent" },
                  ]}
                >
                  <ThemedText type="body" style={{ color: theme.text }}>{option.label}</ThemedText>
                  {value === option.value ? <Feather name="check" size={16} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <ThemedText type="body" style={{ color: value ? theme.text : theme.textSecondary }}>
          {options.find(o => o.value === value)?.label || "Not provided"}
        </ThemedText>
      )}
    </View>
  );
}

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Other", value: "other" },
  { label: "Prefer not to say", value: "prefer-not-to-say" },
];

const PRONOUN_OPTIONS = [
  { label: "He/Him", value: "he/him" },
  { label: "She/Her", value: "she/her" },
  { label: "They/Them", value: "they/them" },
  { label: "Other", value: "other" },
];

const MARITAL_STATUS_OPTIONS = [
  { label: "Single", value: "single" },
  { label: "Married", value: "married" },
  { label: "Divorced", value: "divorced" },
  { label: "Widowed", value: "widowed" },
  { label: "Domestic Partnership", value: "domestic-partnership" },
];

const SEXUAL_ORIENTATION_OPTIONS = [
  { label: "Straight or heterosexual", value: "straight" },
  { label: "Lesbian, gay, or homosexual", value: "homosexual" },
  { label: "Bisexual", value: "bisexual" },
  { label: "Something else", value: "other" },
  { label: "Don't know", value: "unknown" },
  { label: "Choose not to disclose", value: "not-disclosed" },
];

const GENDER_IDENTITY_OPTIONS = [
  { label: "Man", value: "male" },
  { label: "Woman", value: "female" },
  { label: "Transgender man", value: "transgender-male" },
  { label: "Transgender woman", value: "transgender-female" },
  { label: "Non-binary", value: "non-binary" },
  { label: "Genderqueer", value: "genderqueer" },
  { label: "Something else", value: "other" },
  { label: "Choose not to disclose", value: "not-disclosed" },
];

const INSURANCE_COVERAGE_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Draft", value: "draft" },
  { label: "Entered in Error", value: "entered-in-error" },
];

const BLOOD_TYPE_OPTIONS = [
  { label: "A+", value: "A+" },
  { label: "A-", value: "A-" },
  { label: "B+", value: "B+" },
  { label: "B-", value: "B-" },
  { label: "AB+", value: "AB+" },
  { label: "AB-", value: "AB-" },
  { label: "O+", value: "O+" },
  { label: "O-", value: "O-" },
  { label: "Unknown", value: "unknown" },
];

export default function PatientProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [editingSection, setEditingSection] = useState<SectionName | null>(null);
  const [formData, setFormData] = useState<Partial<PatientProfile>>({});

  const { data: profile, isLoading: profileLoading } = useQuery<PatientProfile>({
    queryKey: ["/api/patient-profile"],
  });

  const { data: medicalSummary, isLoading: summaryLoading } = useQuery<MedicalSummary>({
    queryKey: ["/api/patient-profile/medical-summary"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PatientProfile> & { section: SectionName }) => {
      const response = await axiosInstance.patch("/api/patient-profile", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-profile"] });
      setEditingSection(null);
      setFormData({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("Update failed:", error);
      Alert.alert("Error", "Failed to save changes. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleEdit = useCallback((section: SectionName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingSection(section);
    setFormData(profile || {});
  }, [profile]);

  const handleSave = useCallback((section: SectionName) => {
    if (section === "demographics") {
      if (!formData.middleName || formData.middleName.trim() === "") {
        Alert.alert(
          "Middle Name Required (USCDI)",
          "Per HHS/ONC patient matching guidelines, middle name is required to reduce duplicate records.\n\nPlease enter:\n\n• Your FULL middle name (spell out, avoid initials)\n• 'NMN' if you have No Middle Name\n• 'UNK' if Unknown",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "No Middle Name (NMN)", 
              onPress: () => {
                updateMutation.mutate({ ...formData, middleName: "NMN", section });
              }
            },
            { 
              text: "Unknown (UNK)", 
              onPress: () => {
                updateMutation.mutate({ ...formData, middleName: "UNK", section });
              }
            },
          ]
        );
        return;
      }
    }
    updateMutation.mutate({ ...formData, section });
  }, [formData, updateMutation]);

  const handleCancel = useCallback(() => {
    setEditingSection(null);
    setFormData({});
  }, []);

  const updateFormField = useCallback((field: keyof PatientProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Not provided";
    try {
      return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return dateString;
    }
  };

  if (profileLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading profile...
        </ThemedText>
      </View>
    );
  }

  const completenessPercentage = profile?.profileCompleteness || 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.springify()} style={[styles.completenessCard, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <View style={styles.completenessHeader}>
          <ThemedText type="h4" style={{ color: theme.text }}>Profile Completeness</ThemedText>
          <ThemedText type="h2" style={{ color: theme.primary }}>{completenessPercentage}%</ThemedText>
        </View>
        <View style={[styles.progressBar, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
          <Animated.View entering={FadeIn.delay(300)} style={[styles.progressFill, { width: `${completenessPercentage}%`, backgroundColor: completenessPercentage >= 80 ? theme.success : completenessPercentage >= 50 ? theme.warning : theme.error }]} />
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          {completenessPercentage >= 80 ? "Your profile is well filled out" : completenessPercentage >= 50 ? "Add more details to improve your profile" : "Complete your profile for better care"}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <SectionHeader
          title="Demographics"
          icon="user"
          isEditing={editingSection === "demographics"}
          onEditPress={() => handleEdit("demographics")}
          onSavePress={() => handleSave("demographics")}
          isSaving={updateMutation.isPending && editingSection === "demographics"}
          theme={theme}
        />
        <View style={styles.formGrid}>
          <FormField label="First Name" value={editingSection === "demographics" ? formData.firstName : profile?.firstName} isEditing={editingSection === "demographics"} onChangeText={(v) => updateFormField("firstName", v)} theme={theme} isDark={isDark} />
          <FormField label="Last Name" value={editingSection === "demographics" ? formData.lastName : profile?.lastName} isEditing={editingSection === "demographics"} onChangeText={(v) => updateFormField("lastName", v)} theme={theme} isDark={isDark} />
        </View>
        <View style={styles.formField}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>Middle Name (USCDI Required)</ThemedText>
          {editingSection === "demographics" ? (
            <View>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: theme.text, borderColor: theme.border },
                ]}
                value={formData.middleName || ""}
                onChangeText={(v) => updateFormField("middleName", v)}
                placeholder="Full middle name (spell out, avoid initials)"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>
                Per HHS/ONC guidelines: Enter full middle name (not just initial). If truly no middle name, enter "NMN". If unknown, enter "UNK".
              </ThemedText>
            </View>
          ) : (
            <View>
              <ThemedText type="body" style={{ color: profile?.middleName ? theme.text : theme.error }}>
                {profile?.middleName || "Required for patient matching"}
              </ThemedText>
              {!profile?.middleName ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  Enter full name, "NMN" (No Middle Name), or "UNK" (Unknown)
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>
        <View style={styles.formField}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>Date of Birth</ThemedText>
          {editingSection === "demographics" ? (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: theme.text, borderColor: theme.border },
              ]}
              value={formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString("en-US") : ""}
              onChangeText={(text) => {
                const parsed = new Date(text);
                if (!isNaN(parsed.getTime())) {
                  updateFormField("dateOfBirth", parsed.toISOString());
                }
              }}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={theme.textSecondary}
            />
          ) : (
            <ThemedText type="body" style={{ color: profile?.dateOfBirth ? theme.text : theme.textSecondary }}>
              {formatDate(profile?.dateOfBirth)}
            </ThemedText>
          )}
        </View>
        <View style={styles.formGrid}>
          <PickerField label="Gender" value={editingSection === "demographics" ? formData.gender : profile?.gender} options={GENDER_OPTIONS} isEditing={editingSection === "demographics"} onSelect={(v) => updateFormField("gender", v)} theme={theme} isDark={isDark} />
          <PickerField label="Pronouns" value={editingSection === "demographics" ? formData.preferredPronouns : profile?.preferredPronouns} options={PRONOUN_OPTIONS} isEditing={editingSection === "demographics"} onSelect={(v) => updateFormField("preferredPronouns", v)} theme={theme} isDark={isDark} />
        </View>
        <View style={styles.formGrid}>
          <PickerField label="Marital Status" value={editingSection === "demographics" ? formData.maritalStatus : profile?.maritalStatus} options={MARITAL_STATUS_OPTIONS} isEditing={editingSection === "demographics"} onSelect={(v) => updateFormField("maritalStatus", v)} theme={theme} isDark={isDark} />
          <FormField label="Preferred Language" value={editingSection === "demographics" ? formData.preferredLanguage : profile?.preferredLanguage} isEditing={editingSection === "demographics"} onChangeText={(v) => updateFormField("preferredLanguage", v)} placeholder="e.g., English" theme={theme} isDark={isDark} />
        </View>
        <View style={[styles.uscdiDivider, { borderBottomColor: theme.border }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>USCDI v3 Demographics (2026 Mandate)</ThemedText>
        </View>
        <View style={styles.formGrid}>
          <PickerField label="Sexual Orientation" value={editingSection === "demographics" ? formData.sexualOrientation : profile?.sexualOrientation} options={SEXUAL_ORIENTATION_OPTIONS} isEditing={editingSection === "demographics"} onSelect={(v) => updateFormField("sexualOrientation", v)} theme={theme} isDark={isDark} />
          <PickerField label="Gender Identity" value={editingSection === "demographics" ? formData.genderIdentity : profile?.genderIdentity} options={GENDER_IDENTITY_OPTIONS} isEditing={editingSection === "demographics"} onSelect={(v) => updateFormField("genderIdentity", v)} theme={theme} isDark={isDark} />
        </View>
        <FormField label="Tribal Affiliation" value={editingSection === "demographics" ? formData.tribalAffiliation : profile?.tribalAffiliation} isEditing={editingSection === "demographics"} onChangeText={(v) => updateFormField("tribalAffiliation", v)} placeholder="Federally recognized tribe name" theme={theme} isDark={isDark} />
        {editingSection === "demographics" ? (
          <Pressable onPress={handleCancel} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <SectionHeader
          title="Contact Information"
          icon="phone"
          isEditing={editingSection === "contact"}
          onEditPress={() => handleEdit("contact")}
          onSavePress={() => handleSave("contact")}
          isSaving={updateMutation.isPending && editingSection === "contact"}
          theme={theme}
        />
        <View style={styles.formGrid}>
          <FormField label="Phone Number" value={editingSection === "contact" ? formData.phone : profile?.phone} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("phone", v)} keyboardType="phone-pad" theme={theme} isDark={isDark} />
          <FormField label="Email Address" value={editingSection === "contact" ? formData.email : profile?.email} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("email", v)} keyboardType="email-address" theme={theme} isDark={isDark} />
        </View>
        <FormField label="Address Line 1" value={editingSection === "contact" ? formData.addressLine1 : profile?.addressLine1} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("addressLine1", v)} theme={theme} isDark={isDark} />
        <FormField label="Address Line 2" value={editingSection === "contact" ? formData.addressLine2 : profile?.addressLine2} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("addressLine2", v)} placeholder="Apt, Suite, etc." theme={theme} isDark={isDark} />
        <View style={styles.formGrid}>
          <FormField label="City" value={editingSection === "contact" ? formData.city : profile?.city} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("city", v)} theme={theme} isDark={isDark} />
          <FormField label="State" value={editingSection === "contact" ? formData.state : profile?.state} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("state", v)} theme={theme} isDark={isDark} />
        </View>
        <View style={styles.formGrid}>
          <FormField label="ZIP Code" value={editingSection === "contact" ? formData.zipCode : profile?.zipCode} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("zipCode", v)} keyboardType="numeric" theme={theme} isDark={isDark} />
          <FormField label="Country" value={editingSection === "contact" ? formData.country : profile?.country} isEditing={editingSection === "contact"} onChangeText={(v) => updateFormField("country", v)} placeholder="e.g., USA" theme={theme} isDark={isDark} />
        </View>
        {editingSection === "contact" ? (
          <Pressable onPress={handleCancel} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <SectionHeader
          title="Emergency Contacts"
          icon="alert-circle"
          isEditing={editingSection === "emergency"}
          onEditPress={() => handleEdit("emergency")}
          onSavePress={() => handleSave("emergency")}
          isSaving={updateMutation.isPending && editingSection === "emergency"}
          theme={theme}
        />
        {profile?.emergencyContacts && profile.emergencyContacts.length > 0 ? (
          profile.emergencyContacts.map((contact, index) => (
            <View key={index} style={[styles.contactCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
              <View style={styles.contactHeader}>
                <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>{contact.name}</ThemedText>
                <View style={[styles.relationshipBadge, { backgroundColor: `${theme.primary}15` }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>{contact.relationship}</ThemedText>
                </View>
              </View>
              <View style={styles.contactDetails}>
                <View style={styles.contactRow}>
                  <Feather name="phone" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>{contact.phone}</ThemedText>
                </View>
                {contact.email ? (
                  <View style={styles.contactRow}>
                    <Feather name="mail" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>{contact.email}</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
            <Feather name="user-plus" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              No emergency contacts added
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
              Add contacts for emergencies
            </ThemedText>
          </View>
        )}
        {editingSection === "emergency" ? (
          <Pressable onPress={handleCancel} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <SectionHeader
          title="Insurance Information"
          icon="credit-card"
          isEditing={editingSection === "insurance"}
          onEditPress={() => handleEdit("insurance")}
          onSavePress={() => handleSave("insurance")}
          isSaving={updateMutation.isPending && editingSection === "insurance"}
          theme={theme}
        />
        {profile?.insuranceInfo && profile.insuranceInfo.length > 0 ? (
          profile.insuranceInfo.map((insurance, index) => (
            <View key={index} style={[styles.insuranceCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
              <View style={styles.insuranceHeader}>
                <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>{insurance.provider}</ThemedText>
                <View style={[styles.insuranceTypeBadge, { backgroundColor: insurance.type === "primary" ? `${theme.primary}15` : `${theme.warning}15` }]}>
                  <ThemedText type="small" style={{ color: insurance.type === "primary" ? theme.primary : theme.warning }}>
                    {insurance.type.charAt(0).toUpperCase() + insurance.type.slice(1)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.insuranceDetails}>
                <View style={styles.insuranceRow}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Policy #:</ThemedText>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: 4 }}>{insurance.policyNumber}</ThemedText>
                </View>
                {insurance.groupNumber ? (
                  <View style={styles.insuranceRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Group #:</ThemedText>
                    <ThemedText type="small" style={{ color: theme.text, marginLeft: 4 }}>{insurance.groupNumber}</ThemedText>
                  </View>
                ) : null}
                {insurance.subscriberName ? (
                  <View style={styles.insuranceRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Subscriber:</ThemedText>
                    <ThemedText type="small" style={{ color: theme.text, marginLeft: 4 }}>{insurance.subscriberName}</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
            <Feather name="file-plus" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              No insurance information added
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
              Add your insurance for billing
            </ThemedText>
          </View>
        )}
        {editingSection === "insurance" ? (
          <Pressable onPress={handleCancel} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <SectionHeader
          title="Medical Information"
          icon="heart"
          isEditing={editingSection === "medical"}
          onEditPress={() => handleEdit("medical")}
          onSavePress={() => handleSave("medical")}
          isSaving={updateMutation.isPending && editingSection === "medical"}
          theme={theme}
        />
        <View style={styles.formGrid}>
          <PickerField label="Blood Type" value={editingSection === "medical" ? formData.bloodType : profile?.bloodType} options={BLOOD_TYPE_OPTIONS} isEditing={editingSection === "medical"} onSelect={(v) => updateFormField("bloodType", v)} theme={theme} isDark={isDark} />
          <View style={styles.formField}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>Organ Donor</ThemedText>
            {editingSection === "medical" ? (
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => updateFormField("organDonor", true)}
                  style={[styles.toggleOption, formData.organDonor === true && { backgroundColor: `${theme.success}20` }]}
                >
                  <Feather name="check" size={14} color={formData.organDonor === true ? theme.success : theme.textSecondary} />
                  <ThemedText type="small" style={{ color: formData.organDonor === true ? theme.success : theme.textSecondary, marginLeft: 4 }}>Yes</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => updateFormField("organDonor", false)}
                  style={[styles.toggleOption, formData.organDonor === false && { backgroundColor: `${theme.error}20` }]}
                >
                  <Feather name="x" size={14} color={formData.organDonor === false ? theme.error : theme.textSecondary} />
                  <ThemedText type="small" style={{ color: formData.organDonor === false ? theme.error : theme.textSecondary, marginLeft: 4 }}>No</ThemedText>
                </Pressable>
              </View>
            ) : (
              <ThemedText type="body" style={{ color: profile?.organDonor !== undefined ? theme.text : theme.textSecondary }}>
                {profile?.organDonor === true ? "Yes" : profile?.organDonor === false ? "No" : "Not specified"}
              </ThemedText>
            )}
          </View>
        </View>
        <View style={styles.formGrid}>
          <FormField label="Primary Physician" value={editingSection === "medical" ? formData.primaryPhysician : profile?.primaryPhysician} isEditing={editingSection === "medical"} onChangeText={(v) => updateFormField("primaryPhysician", v)} placeholder="Dr. Name" theme={theme} isDark={isDark} />
          <FormField label="Physician Phone" value={editingSection === "medical" ? formData.primaryPhysicianPhone : profile?.primaryPhysicianPhone} isEditing={editingSection === "medical"} onChangeText={(v) => updateFormField("primaryPhysicianPhone", v)} keyboardType="phone-pad" theme={theme} isDark={isDark} />
        </View>
        <View style={styles.formGrid}>
          <FormField label="Preferred Pharmacy" value={editingSection === "medical" ? formData.preferredPharmacy : profile?.preferredPharmacy} isEditing={editingSection === "medical"} onChangeText={(v) => updateFormField("preferredPharmacy", v)} theme={theme} isDark={isDark} />
          <FormField label="Pharmacy Phone" value={editingSection === "medical" ? formData.pharmacyPhone : profile?.pharmacyPhone} isEditing={editingSection === "medical"} onChangeText={(v) => updateFormField("pharmacyPhone", v)} keyboardType="phone-pad" theme={theme} isDark={isDark} />
        </View>
        {editingSection === "medical" ? (
          <Pressable onPress={handleCancel} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(600).springify()} style={[styles.section, { backgroundColor: theme.backgroundDefault, ...Shadows.glass }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="activity" size={16} color={theme.primary} />
            </View>
            <ThemedText type="h4" style={{ color: theme.text }}>Health Summary</ThemedText>
          </View>
          {medicalSummary ? (
            <View style={[styles.recordsBadge, { backgroundColor: `${theme.primary}15` }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>{medicalSummary.totalRecords} records</ThemedText>
            </View>
          ) : null}
        </View>
        {summaryLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.lg }} />
        ) : medicalSummary ? (
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
              <Feather name="heart" size={20} color="#EF4444" />
              <ThemedText type="h3" style={{ color: theme.text, marginTop: 4 }}>{medicalSummary.conditions.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Conditions</ThemedText>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
              <Feather name="thermometer" size={20} color="#8B5CF6" />
              <ThemedText type="h3" style={{ color: theme.text, marginTop: 4 }}>{medicalSummary.medications.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Medications</ThemedText>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
              <Feather name="alert-triangle" size={20} color="#F59E0B" />
              <ThemedText type="h3" style={{ color: theme.text, marginTop: 4 }}>{medicalSummary.allergies.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Allergies</ThemedText>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
              <Feather name="shield" size={20} color="#10B981" />
              <ThemedText type="h3" style={{ color: theme.text, marginTop: 4 }}>{medicalSummary.immunizations.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Immunizations</ThemedText>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }]}>
            <Feather name="file-text" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              No health records yet
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
              Connect a data source to import records
            </ThemedText>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  completenessCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  completenessHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: Spacing.sm },
  editButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  uscdiDivider: { borderBottomWidth: 1, paddingBottom: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.md },
  formGrid: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  formField: { flex: 1, marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16 },
  pickerButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerOptions: { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 4, overflow: "hidden" },
  pickerOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  cancelButton: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: "center", marginTop: Spacing.md },
  contactCard: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  contactHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  relationshipBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  contactDetails: { gap: 4 },
  contactRow: { flexDirection: "row", alignItems: "center" },
  insuranceCard: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  insuranceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  insuranceTypeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  insuranceDetails: { gap: 4 },
  insuranceRow: { flexDirection: "row", alignItems: "center" },
  emptyState: { padding: Spacing.xl, borderRadius: BorderRadius.sm, alignItems: "center" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  summaryItem: { flex: 1, minWidth: "45%", padding: Spacing.md, borderRadius: BorderRadius.sm, alignItems: "center" },
  recordsBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  toggleRow: { flexDirection: "row", gap: Spacing.sm },
  toggleOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
});
