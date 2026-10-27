import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

const RELATIONSHIPS = [
  "Spouse/Partner", "Child", "Parent", "Sibling", "Grandparent", "Grandchild",
  "Guardian", "Dependent", "Other",
];

const WIZARD_STEPS = ["basics", "contact", "medical", "insurance", "verify"] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const STEP_LABELS: Record<WizardStep, string> = {
  basics: "Basic Info",
  contact: "Contact",
  medical: "Medical",
  insurance: "Insurance",
  verify: "Verification",
};

interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  relationship: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  blood_type?: string;
  primary_physician?: string;
  pharmacy?: string;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  surgeries?: string[];
  immunizations?: string[];
  verification_status: string;
  is_minor: boolean;
  avatar_color: string;
  profile_completeness: number;
  created_at: string;
}

function MemberCard({ member, onPress, theme, isDark }: { member: FamilyMember; onPress: () => void; theme: any; isDark: boolean }) {
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase();
  const completeness = member.profile_completeness || 0;
  const verColor = member.verification_status === "verified" ? "#10b981" : member.verification_status === "pending" ? "#f59e0b" : "#6b7280";

  return (
    <Pressable testID={`family-member-${member.id}`} onPress={onPress} style={[styles.memberCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.avatar, { backgroundColor: member.avatar_color || "#3B82F6" }]}>
        <ThemedText style={styles.avatarText}>{initials}</ThemedText>
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.memberName, { color: theme.text }]}>
          {member.first_name} {member.last_name}
        </ThemedText>
        <View style={styles.memberMeta}>
          <ThemedText style={[styles.memberRelation, { color: theme.textSecondary }]}>{member.relationship}</ThemedText>
          {member.is_minor ? (
            <View style={[styles.badge, { backgroundColor: "#3b82f620" }]}>
              <ThemedText style={[styles.badgeText, { color: "#3b82f6" }]}>Minor</ThemedText>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: `${verColor}20` }]}>
            <ThemedText style={[styles.badgeText, { color: verColor }]}>
              {member.verification_status === "verified" ? "Verified" : "Pending"}
            </ThemedText>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, { backgroundColor: `${theme.primary}15` }]}>
            <View style={[styles.progressFill, { width: `${completeness}%`, backgroundColor: theme.primary }]} />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>{completeness}%</ThemedText>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function FamilyHubScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { checkFeature, promptProps } = useFeatureGate();

  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("basics");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", middleName: "", relationship: "",
    dateOfBirth: "", gender: "", phone: "", email: "",
    bloodType: "", primaryPhysician: "", pharmacy: "",
    conditions: "", allergies: "", medications: "",
    insuranceProvider: "", insurancePolicyNumber: "", insuranceGroupNumber: "",
    verificationMethod: "", guardianConsent: false,
  });

  const { data: members = [], isLoading } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("POST", "/api/family-members", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      setShowWizard(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/family-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      setShowDetail(false);
      setSelectedMember(null);
    },
  });

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", middleName: "", relationship: "", dateOfBirth: "", gender: "", phone: "", email: "", bloodType: "", primaryPhysician: "", pharmacy: "", conditions: "", allergies: "", medications: "", insuranceProvider: "", insurancePolicyNumber: "", insuranceGroupNumber: "", verificationMethod: "", guardianConsent: false });
    setWizardStep("basics");
  };

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName || !form.relationship) {
      if (Platform.OS === "web") { alert("Please fill in first name, last name, and relationship"); } else { Alert.alert("Required", "Please fill in first name, last name, and relationship"); }
      return;
    }
    addMutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      middleName: form.middleName || undefined,
      relationship: form.relationship,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      bloodType: form.bloodType || undefined,
      primaryPhysician: form.primaryPhysician || undefined,
      pharmacy: form.pharmacy || undefined,
      conditions: form.conditions ? form.conditions.split(",").map(s => s.trim()) : undefined,
      allergies: form.allergies ? form.allergies.split(",").map(s => s.trim()) : undefined,
      medications: form.medications ? form.medications.split(",").map(s => s.trim()) : undefined,
      insuranceInfo: form.insuranceProvider ? { provider: form.insuranceProvider, policyNumber: form.insurancePolicyNumber, groupNumber: form.insuranceGroupNumber } : undefined,
      verificationMethod: form.verificationMethod || undefined,
      guardianConsent: form.guardianConsent,
    });
  };

  const stepIdx = WIZARD_STEPS.indexOf(wizardStep);
  const canNext = stepIdx < WIZARD_STEPS.length - 1;
  const canPrev = stepIdx > 0;

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
  const inputBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  const renderInput = (label: string, key: keyof typeof form, placeholder: string, opts?: { multiline?: boolean; keyboardType?: any }) => (
    <View style={styles.fieldGroup}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <TextInput
        testID={`input-${key}`}
        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }, opts?.multiline ? { height: 80, textAlignVertical: "top" } : {}]}
        value={String(form[key])}
        onChangeText={(v) => setForm(prev => ({ ...prev, [key]: v }))}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={opts?.multiline}
        keyboardType={opts?.keyboardType}
      />
    </View>
  );

  const renderWizardContent = () => {
    switch (wizardStep) {
      case "basics":
        return (
          <View>
            {renderInput("First Name *", "firstName", "Enter first name")}
            {renderInput("Last Name *", "lastName", "Enter last name")}
            {renderInput("Middle Name", "middleName", "Enter middle name")}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Relationship *</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {RELATIONSHIPS.map(r => (
                  <Pressable
                    key={r}
                    testID={`rel-${r}`}
                    onPress={() => { setForm(prev => ({ ...prev, relationship: r })); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
                    style={[styles.chip, { backgroundColor: form.relationship === r ? theme.primary : inputBg, borderColor: form.relationship === r ? theme.primary : inputBorder }]}
                  >
                    <ThemedText style={[styles.chipText, { color: form.relationship === r ? "#fff" : theme.text }]}>{r}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {renderInput("Date of Birth", "dateOfBirth", "YYYY-MM-DD")}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</ThemedText>
              <View style={styles.chipRow}>
                {["Male", "Female", "Non-binary", "Other"].map(g => (
                  <Pressable
                    key={g}
                    onPress={() => setForm(prev => ({ ...prev, gender: g }))}
                    style={[styles.chip, { backgroundColor: form.gender === g ? theme.primary : inputBg, borderColor: form.gender === g ? theme.primary : inputBorder }]}
                  >
                    <ThemedText style={[styles.chipText, { color: form.gender === g ? "#fff" : theme.text }]}>{g}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );
      case "contact":
        return (
          <View>
            {renderInput("Phone Number", "phone", "Enter phone number", { keyboardType: "phone-pad" })}
            {renderInput("Email Address", "email", "Enter email address", { keyboardType: "email-address" })}
          </View>
        );
      case "medical":
        return (
          <View>
            {renderInput("Blood Type", "bloodType", "e.g., O+, A-, B+")}
            {renderInput("Primary Physician", "primaryPhysician", "Doctor's name")}
            {renderInput("Pharmacy", "pharmacy", "Pharmacy name")}
            {renderInput("Conditions", "conditions", "Comma-separated (e.g., Asthma, Diabetes)", { multiline: true })}
            {renderInput("Allergies", "allergies", "Comma-separated (e.g., Penicillin, Peanuts)", { multiline: true })}
            {renderInput("Current Medications", "medications", "Comma-separated (e.g., Metformin 500mg)", { multiline: true })}
          </View>
        );
      case "insurance":
        return (
          <View>
            {renderInput("Insurance Provider", "insuranceProvider", "e.g., Blue Cross Blue Shield")}
            {renderInput("Policy Number", "insurancePolicyNumber", "Enter policy number")}
            {renderInput("Group Number", "insuranceGroupNumber", "Enter group number")}
            <View style={[styles.infoBox, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}15` }]}>
              <Feather name="camera" size={14} color={theme.primary} />
              <ThemedText style={[styles.infoBoxText, { color: theme.text }]}>
                Insurance card photo upload is available in your Patient Profile under Insurance Information.
              </ThemedText>
            </View>
          </View>
        );
      case "verify":
        return (
          <View>
            <View style={[styles.verifyCard, { backgroundColor: `${"#f59e0b"}08`, borderColor: `${"#f59e0b"}20` }]}>
              <Feather name="shield" size={20} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.verifyTitle, { color: theme.text }]}>Identity Verification</ThemedText>
                <ThemedText style={[styles.verifyText, { color: theme.textSecondary }]}>
                  For HIPAA compliance, family member access requires legal verification of relationship. You can complete verification now or later.
                </ThemedText>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Verification Method</ThemedText>
              {[
                { key: "birth_certificate", label: "Birth Certificate", icon: "file-text" as const, desc: "For children/dependents" },
                { key: "marriage_certificate", label: "Marriage Certificate", icon: "heart" as const, desc: "For spouse/partner" },
                { key: "power_of_attorney", label: "Power of Attorney", icon: "briefcase" as const, desc: "For elderly parents/guardians" },
                { key: "court_order", label: "Court Order / Legal Guardian", icon: "shield" as const, desc: "Court-appointed guardianship" },
                { key: "self_attestation", label: "Self-Attestation", icon: "check-circle" as const, desc: "Attestation pending document upload" },
              ].map(v => (
                <Pressable
                  key={v.key}
                  testID={`verify-${v.key}`}
                  onPress={() => setForm(prev => ({ ...prev, verificationMethod: v.key }))}
                  style={[styles.verifyOption, {
                    backgroundColor: form.verificationMethod === v.key ? `${theme.primary}10` : inputBg,
                    borderColor: form.verificationMethod === v.key ? theme.primary : inputBorder,
                  }]}
                >
                  <Feather name={v.icon} size={16} color={form.verificationMethod === v.key ? theme.primary : theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.verifyOptLabel, { color: theme.text }]}>{v.label}</ThemedText>
                    <ThemedText style={[styles.verifyOptDesc, { color: theme.textSecondary }]}>{v.desc}</ThemedText>
                  </View>
                  {form.verificationMethod === v.key ? <Feather name="check" size={16} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </View>
            {form.relationship === "Child" || form.relationship === "Dependent" ? (
              <Pressable
                testID="toggle-consent"
                onPress={() => setForm(prev => ({ ...prev, guardianConsent: !prev.guardianConsent }))}
                style={[styles.consentRow, { borderColor: inputBorder }]}
              >
                <View style={[styles.checkbox, { borderColor: form.guardianConsent ? theme.primary : inputBorder, backgroundColor: form.guardianConsent ? theme.primary : "transparent" }]}>
                  {form.guardianConsent ? <Feather name="check" size={12} color="#fff" /> : null}
                </View>
                <ThemedText style={[styles.consentText, { color: theme.text }]}>
                  I confirm I am the legal guardian and have authority to manage health records for this minor.
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        );
    }
  };

  const renderMemberDetail = () => {
    if (!selectedMember) return null;
    const m = selectedMember;
    const detailItems = [
      { icon: "user" as const, label: "Name", value: `${m.first_name} ${m.middle_name ? m.middle_name + " " : ""}${m.last_name}` },
      { icon: "users" as const, label: "Relationship", value: m.relationship },
      { icon: "calendar" as const, label: "Date of Birth", value: m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString() : "Not set" },
      { icon: "heart" as const, label: "Gender", value: m.gender || "Not set" },
      { icon: "phone" as const, label: "Phone", value: m.phone || "Not set" },
      { icon: "mail" as const, label: "Email", value: m.email || "Not set" },
      { icon: "droplet" as const, label: "Blood Type", value: m.blood_type || "Not set" },
      { icon: "user" as const, label: "Physician", value: m.primary_physician || "Not set" },
      { icon: "plus-square" as const, label: "Pharmacy", value: m.pharmacy || "Not set" },
    ];

    return (
      <Modal visible={showDetail} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.modalHeader, { borderColor: cardBorder }]}>
            <Pressable testID="close-detail" onPress={() => { setShowDetail(false); setSelectedMember(null); }}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Family Member</ThemedText>
            <Pressable testID="delete-member" onPress={() => {
              if (Platform.OS === "web") { if (confirm("Remove this family member?")) deleteMutation.mutate(m.id); }
              else { Alert.alert("Remove", "Remove this family member?", [{ text: "Cancel" }, { text: "Remove", style: "destructive", onPress: () => deleteMutation.mutate(m.id) }]); }
            }}>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.detailHeader}>
              <View style={[styles.detailAvatar, { backgroundColor: m.avatar_color || "#3B82F6" }]}>
                <ThemedText style={styles.detailAvatarText}>
                  {`${m.first_name?.[0] || ""}${m.last_name?.[0] || ""}`.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.detailName, { color: theme.text }]}>{m.first_name} {m.last_name}</ThemedText>
              <ThemedText style={[styles.detailRelation, { color: theme.textSecondary }]}>{m.relationship}</ThemedText>
            </View>

            {detailItems.map((item, i) => (
              <View key={i} style={[styles.detailRow, { borderColor: cardBorder }]}>
                <Feather name={item.icon} size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>{item.label}</ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>{item.value}</ThemedText>
              </View>
            ))}

            {(m.conditions?.length || 0) > 0 ? (
              <View style={[styles.listSection, { borderColor: cardBorder }]}>
                <ThemedText style={[styles.listTitle, { color: theme.text }]}>Conditions</ThemedText>
                {m.conditions?.map((c, i) => (
                  <View key={i} style={styles.listItem}>
                    <View style={[styles.listDot, { backgroundColor: "#ef4444" }]} />
                    <ThemedText style={[styles.listText, { color: theme.text }]}>{c}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {(m.allergies?.length || 0) > 0 ? (
              <View style={[styles.listSection, { borderColor: cardBorder }]}>
                <ThemedText style={[styles.listTitle, { color: theme.text }]}>Allergies</ThemedText>
                {m.allergies?.map((a, i) => (
                  <View key={i} style={styles.listItem}>
                    <View style={[styles.listDot, { backgroundColor: "#f59e0b" }]} />
                    <ThemedText style={[styles.listText, { color: theme.text }]}>{a}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {(m.medications?.length || 0) > 0 ? (
              <View style={[styles.listSection, { borderColor: cardBorder }]}>
                <ThemedText style={[styles.listTitle, { color: theme.text }]}>Medications</ThemedText>
                {m.medications?.map((med, i) => (
                  <View key={i} style={styles.listItem}>
                    <View style={[styles.listDot, { backgroundColor: "#8b5cf6" }]} />
                    <ThemedText style={[styles.listText, { color: theme.text }]}>{med}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <UpgradePrompt {...promptProps} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={[styles.summaryCard, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}20` }]}>
            <View style={[styles.summaryIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="users" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>My Family</ThemedText>
              <ThemedText style={[styles.summarySub, { color: theme.textSecondary }]}>
                {members.length > 0 ? `${members.length} family member${members.length !== 1 ? "s" : ""} managed` : "Add family members to manage their health data"}
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {members.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>FAMILY MEMBERS</ThemedText>
            {members.map((m, idx) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(idx * 50).duration(300)}>
                <MemberCard
                  member={m}
                  onPress={() => { setSelectedMember(m); setShowDetail(true); }}
                  theme={theme}
                  isDark={isDark}
                />
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Pressable
            testID="button-add-family-member"
            onPress={() => { if (!checkFeature("family_hub")) return; resetForm(); setShowWizard(true); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} }}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="user-plus" size={18} color="#fff" />
            <ThemedText style={styles.addButtonText}>Add Family Member</ThemedText>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <View style={[styles.securityNote, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Feather name="lock" size={14} color="#10b981" />
            <ThemedText style={[styles.securityText, { color: theme.textSecondary }]}>
              Family data is encrypted and HIPAA-compliant. Each member's records are isolated and access-controlled.
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      {renderMemberDetail()}

      <Modal visible={showWizard} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.modalHeader, { borderColor: cardBorder }]}>
            <Pressable testID="close-wizard" onPress={() => setShowWizard(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Add Family Member</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <View style={[styles.stepIndicator, { borderColor: cardBorder }]}>
            {WIZARD_STEPS.map((step, i) => (
              <View key={step} style={styles.stepItem}>
                <View style={[styles.stepDot, {
                  backgroundColor: i <= stepIdx ? theme.primary : inputBg,
                  borderColor: i <= stepIdx ? theme.primary : inputBorder,
                }]}>
                  {i < stepIdx ? <Feather name="check" size={10} color="#fff" /> : (
                    <ThemedText style={[styles.stepNum, { color: i <= stepIdx ? "#fff" : theme.textSecondary }]}>{i + 1}</ThemedText>
                  )}
                </View>
                <ThemedText style={[styles.stepLabel, { color: i === stepIdx ? theme.primary : theme.textSecondary }]}>
                  {STEP_LABELS[step]}
                </ThemedText>
              </View>
            ))}
          </View>

          <ScrollView contentContainerStyle={[styles.wizardContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
            <Animated.View key={wizardStep} entering={FadeIn.duration(200)}>
              {renderWizardContent()}
            </Animated.View>
          </ScrollView>

          <View style={[styles.wizardFooter, { backgroundColor: theme.backgroundDefault, borderColor: cardBorder, paddingBottom: insets.bottom + Spacing.sm }]}>
            <Pressable
              testID="wizard-prev"
              onPress={() => { if (canPrev) setWizardStep(WIZARD_STEPS[stepIdx - 1]); }}
              style={[styles.wizardBtn, { backgroundColor: canPrev ? cardBg : "transparent", borderColor: canPrev ? cardBorder : "transparent" }]}
              disabled={!canPrev}
            >
              <ThemedText style={[styles.wizardBtnText, { color: canPrev ? theme.text : "transparent" }]}>Back</ThemedText>
            </Pressable>
            {canNext ? (
              <Pressable
                testID="wizard-next"
                onPress={() => setWizardStep(WIZARD_STEPS[stepIdx + 1])}
                style={[styles.wizardBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={[styles.wizardBtnText, { color: "#fff" }]}>Next</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                testID="wizard-submit"
                onPress={handleSubmit}
                style={[styles.wizardBtn, { backgroundColor: "#10b981" }]}
                disabled={addMutation.isPending}
              >
                <ThemedText style={[styles.wizardBtnText, { color: "#fff" }]}>
                  {addMutation.isPending ? "Adding..." : "Add Member"}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  summaryIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  summaryTitle: { fontSize: 18, fontWeight: "700" },
  summarySub: { fontSize: 13, marginTop: 1 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: Spacing.sm },
  memberCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs, gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberName: { fontSize: 16, fontWeight: "600" },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  memberRelation: { fontSize: 12 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  badgeText: { fontSize: 10, fontWeight: "600" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 10, width: 28 },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  securityNote: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  securityText: { fontSize: 12, lineHeight: 17, flex: 1 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  stepIndicator: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1 },
  stepItem: { alignItems: "center", gap: 2 },
  stepDot: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  stepNum: { fontSize: 10, fontWeight: "600" },
  stepLabel: { fontSize: 10, fontWeight: "500" },
  wizardContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  wizardFooter: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, position: "absolute", bottom: 0, left: 0, right: 0 },
  wizardBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: "center", borderWidth: 1 },
  wizardBtnText: { fontSize: 15, fontWeight: "600" },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  textInput: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, fontSize: 15 },
  chipScroll: { marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 13, fontWeight: "500" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginTop: Spacing.sm },
  infoBoxText: { fontSize: 12, lineHeight: 17, flex: 1 },
  verifyCard: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  verifyTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  verifyText: { fontSize: 13, lineHeight: 19 },
  verifyOption: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.xs },
  verifyOptLabel: { fontSize: 14, fontWeight: "500" },
  verifyOptDesc: { fontSize: 11, marginTop: 1 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginTop: Spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, justifyContent: "center", alignItems: "center", marginTop: 2 },
  consentText: { fontSize: 13, lineHeight: 19, flex: 1 },
  detailHeader: { alignItems: "center", paddingVertical: Spacing.lg },
  detailAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },
  detailAvatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  detailName: { fontSize: 22, fontWeight: "700" },
  detailRelation: { fontSize: 14, marginTop: 2 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 13, width: 90 },
  detailValue: { fontSize: 14, flex: 1, fontWeight: "500" },
  listSection: { paddingTop: Spacing.md, borderTopWidth: 1, marginTop: Spacing.sm },
  listTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.xs },
  listItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: 3 },
  listDot: { width: 6, height: 6, borderRadius: 3 },
  listText: { fontSize: 13 },
});
