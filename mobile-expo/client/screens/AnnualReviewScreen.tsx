import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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

const LOCAL_PHARMACIES = [
  "CVS Pharmacy", "Walgreens", "Walmart Pharmacy", "Rite Aid",
  "Kroger Pharmacy", "Costco Pharmacy", "Sam's Club Pharmacy",
  "Target (CVS)", "Publix Pharmacy", "H-E-B Pharmacy",
];

function formatReviewDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never reviewed";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AnnualReviewScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/patient-profile"],
  });

  const [primaryPhysician, setPrimaryPhysician] = useState("");
  const [primaryPhysicianPhone, setPrimaryPhysicianPhone] = useState("");
  const [primaryPhysicianNpi, setPrimaryPhysicianNpi] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [pharmacyPhone, setPharmacyPhone] = useState("");
  const [mailOrderPharmacy, setMailOrderPharmacy] = useState("");
  const [pharmacySavingsPrograms, setPharmacySavingsPrograms] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [providerSearchQuery, setProviderSearchQuery] = useState("");
  const [providerSearchResults, setProviderSearchResults] = useState<any[]>([]);
  const [isSearchingProviders, setIsSearchingProviders] = useState(false);
  const [showProviderResults, setShowProviderResults] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [reviewComplete, setReviewComplete] = useState(false);

  React.useEffect(() => {
    if (profile && !initialized) {
      setPrimaryPhysician(profile.primaryPhysician || "");
      setPrimaryPhysicianPhone(profile.primaryPhysicianPhone || "");
      setPrimaryPhysicianNpi(profile.primaryPhysicianNpi || "");
      setPharmacy(profile.pharmacy || "");
      setPharmacyPhone(profile.pharmacyPhone || "");
      setMailOrderPharmacy(profile.mailOrderPharmacy || "");
      setPharmacySavingsPrograms(profile.pharmacySavingsPrograms || []);
      setInitialized(true);
    }
  }, [profile, initialized]);

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProviderSearch = useCallback((text: string) => {
    setProviderSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 2) {
      setProviderSearchResults([]);
      setShowProviderResults(false);
      return;
    }
    setIsSearchingProviders(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const url = new URL("/api/provider-search", getApiUrl());
        url.searchParams.set("q", text);
        const resp = await fetch(url.toString(), {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (resp.ok) {
          const data = await resp.json();
          setProviderSearchResults(data.results || []);
          setShowProviderResults(true);
        }
      } catch {}
      setIsSearchingProviders(false);
    }, 400);
  }, []);

  const selectProvider = useCallback((prov: any) => {
    const name = `${prov.firstName} ${prov.lastName}${prov.credential ? `, ${prov.credential}` : ""}`;
    setPrimaryPhysician(name);
    setPrimaryPhysicianPhone(prov.phone || "");
    setPrimaryPhysicianNpi(prov.npi || "");
    setShowProviderResults(false);
    setProviderSearchQuery("");
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }, []);

  const toggleSavingsProgram = useCallback((name: string) => {
    setPharmacySavingsPrograms(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/patient-profile/annual-review", {
          primaryPhysician,
          primaryPhysicianPhone,
          primaryPhysicianNpi,
          pharmacy,
          pharmacyPhone,
          mailOrderPharmacy,
          pharmacySavingsPrograms,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-profile"] });
      setReviewComplete(true);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const lastReview = profile?.annualReviewCompletedAt;
  const daysSinceReview = daysSince(lastReview);
  const isDue = daysSinceReview >= 365;

  const STEPS = [
    { title: "Primary Care Provider", icon: "user" as const, desc: "Is your primary care doctor still the right fit?" },
    { title: "Preferred Pharmacy", icon: "map-pin" as const, desc: "Where do you prefer to pick up prescriptions?" },
    { title: "Mail Order & Savings", icon: "dollar-sign" as const, desc: "Are you getting the best medication prices?" },
  ];

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: headerHeight + 100 }} />
      </View>
    );
  }

  if (reviewComplete) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["2xl"],
            paddingHorizontal: Spacing.xl,
            alignItems: "center",
          }}
        >
          <Animated.View entering={FadeInDown.springify()} style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: `${theme.success}15` }]}>
              <Feather name="check-circle" size={48} color={theme.success} />
            </View>
            <ThemedText style={[styles.successTitle, { color: theme.text }]}>
              Annual Review Complete
            </ThemedText>
            <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
              Your care team and pharmacy preferences have been updated. We'll remind you next year to review again.
            </ThemedText>
            <ThemedText style={[styles.successDate, { color: theme.primary }]}>
              Reviewed on {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </ThemedText>
            <Pressable
              testID="button-done-review"
              onPress={() => navigation.goBack()}
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={[styles.doneButtonText, { color: "#fff" }]}>Done</ThemedText>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["2xl"],
          paddingHorizontal: Spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <View style={[styles.headerCard, { backgroundColor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)", borderColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)" }]}>
            <Feather name="calendar" size={20} color="#6366F1" />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                Annual Health Review
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Taking a few minutes each year to review your care choices keeps you in control of your health journey.
              </ThemedText>
              {lastReview ? (
                <View style={styles.lastReviewRow}>
                  <Feather name="clock" size={12} color={isDue ? theme.warning : theme.success} />
                  <ThemedText style={{ color: isDue ? theme.warning : theme.success, fontSize: 12, marginLeft: 4, fontWeight: "500" }}>
                    Last reviewed: {formatReviewDate(lastReview)} ({daysSinceReview} days ago)
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.lastReviewRow}>
                  <Feather name="info" size={12} color={theme.info} />
                  <ThemedText style={{ color: theme.info, fontSize: 12, marginLeft: 4 }}>
                    First time review
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        <View style={styles.stepIndicatorRow}>
          {STEPS.map((step, idx) => (
            <Pressable
              key={idx}
              testID={`step-indicator-${idx}`}
              onPress={() => setCurrentStep(idx)}
              style={[styles.stepIndicator, {
                backgroundColor: currentStep === idx ? `${theme.primary}15` : "transparent",
                borderColor: currentStep >= idx ? theme.primary : theme.border,
              }]}
            >
              <Feather name={step.icon} size={14} color={currentStep >= idx ? theme.primary : theme.textSecondary} />
              <ThemedText style={{ fontSize: 11, color: currentStep >= idx ? theme.primary : theme.textSecondary, marginLeft: 4, fontWeight: currentStep === idx ? "600" : "400" }}>
                {idx + 1}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.stepHeader, { borderColor: `${theme.primary}20` }]}>
            <Feather name={STEPS[currentStep].icon} size={16} color={theme.primary} />
            <ThemedText style={[styles.stepTitle, { color: theme.primary }]}>
              {STEPS[currentStep].title}
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
            {STEPS[currentStep].desc}
          </ThemedText>

          {currentStep === 0 ? (
            <View>
              {primaryPhysician ? (
                <View style={[styles.selectedCard, { backgroundColor: `${theme.success}08`, borderColor: `${theme.success}25` }]}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>
                      {primaryPhysician}
                    </ThemedText>
                    {primaryPhysicianNpi ? (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>NPI: {primaryPhysicianNpi}</ThemedText>
                    ) : null}
                    {primaryPhysicianPhone ? (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>{primaryPhysicianPhone}</ThemedText>
                    ) : null}
                  </View>
                  <Pressable
                    testID="button-clear-provider"
                    onPress={() => { setPrimaryPhysician(""); setPrimaryPhysicianPhone(""); setPrimaryPhysicianNpi(""); }}
                  >
                    <Feather name="edit-2" size={16} color={theme.primary} />
                  </Pressable>
                </View>
              ) : null}

              {!primaryPhysician ? (
                <>
                  <View style={styles.inputGroup}>
                    <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Search by Provider Name
                    </ThemedText>
                    <TextInput
                      testID="input-provider-search-review"
                      style={[styles.inputField, {
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                        borderColor: showProviderResults ? theme.primary : theme.border,
                        color: theme.text,
                      }]}
                      value={providerSearchQuery}
                      onChangeText={handleProviderSearch}
                      placeholder="Search NPI registry (e.g. Smith, John)"
                      placeholderTextColor={theme.textSecondary + "60"}
                      autoCapitalize="words"
                    />
                    {isSearchingProviders ? (
                      <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.xs }} />
                    ) : null}
                    {showProviderResults && providerSearchResults.length > 0 ? (
                      <View style={[styles.searchResults, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                        {providerSearchResults.slice(0, 6).map((prov, idx) => (
                          <Pressable
                            key={`${prov.npi}-${idx}`}
                            testID={`review-provider-result-${idx}`}
                            onPress={() => selectProvider(prov)}
                            style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
                          >
                            <View style={{ flex: 1 }}>
                              <ThemedText style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                                {prov.firstName} {prov.lastName}{prov.credential ? `, ${prov.credential}` : ""}
                              </ThemedText>
                              <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>{prov.specialty}</ThemedText>
                              <ThemedText style={{ color: theme.textSecondary, fontSize: 10 }}>{prov.address}</ThemedText>
                            </View>
                            <ThemedText style={{ color: theme.primary, fontSize: 10 }}>NPI: {prov.npi}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    {showProviderResults && !isSearchingProviders && providerSearchResults.length === 0 && providerSearchQuery.length >= 2 ? (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: Spacing.xs }}>
                        No providers found. Enter details manually below.
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Or enter manually</ThemedText>
                    <TextInput
                      testID="input-provider-name-manual"
                      style={[styles.inputField, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: theme.border, color: theme.text }]}
                      value={primaryPhysician}
                      onChangeText={setPrimaryPhysician}
                      placeholder="Doctor's name"
                      placeholderTextColor={theme.textSecondary + "60"}
                    />
                    <TextInput
                      testID="input-provider-phone-manual"
                      style={[styles.inputField, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: theme.border, color: theme.text, marginTop: Spacing.sm }]}
                      value={primaryPhysicianPhone}
                      onChangeText={setPrimaryPhysicianPhone}
                      placeholder="Phone number"
                      placeholderTextColor={theme.textSecondary + "60"}
                      keyboardType="phone-pad"
                    />
                  </View>
                </>
              ) : null}

              <View style={[styles.tipCard, { backgroundColor: `${theme.info}06`, borderColor: `${theme.info}15` }]}>
                <Feather name="info" size={14} color={theme.info} />
                <ThemedText style={{ color: theme.info, fontSize: 12, flex: 1, marginLeft: Spacing.sm }}>
                  Your primary care provider is your health advocate. If you've moved, changed insurance, or want a fresh perspective, this is a good time to update.
                </ThemedText>
              </View>
            </View>
          ) : null}

          {currentStep === 1 ? (
            <View>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Preferred local pharmacy
                </ThemedText>
                <View style={styles.chipRow}>
                  {LOCAL_PHARMACIES.map(ph => {
                    const isActive = pharmacy === ph;
                    return (
                      <Pressable
                        key={ph}
                        testID={`chip-local-${ph.toLowerCase().replace(/\s/g, '-')}`}
                        onPress={() => { setPharmacy(isActive ? "" : ph); try { Haptics.selectionAsync(); } catch {} }}
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
                <TextInput
                  testID="input-pharmacy-custom"
                  style={[styles.inputField, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: theme.border, color: theme.text, marginTop: Spacing.sm }]}
                  value={LOCAL_PHARMACIES.includes(pharmacy) ? "" : pharmacy}
                  onChangeText={setPharmacy}
                  placeholder="Or type your pharmacy name"
                  placeholderTextColor={theme.textSecondary + "60"}
                />
                <TextInput
                  testID="input-pharmacy-phone"
                  style={[styles.inputField, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: theme.border, color: theme.text, marginTop: Spacing.sm }]}
                  value={pharmacyPhone}
                  onChangeText={setPharmacyPhone}
                  placeholder="Pharmacy phone (optional)"
                  placeholderTextColor={theme.textSecondary + "60"}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={[styles.sectionDivider, { borderColor: `${theme.primary}20`, marginTop: Spacing.lg }]}>
                <Feather name="package" size={16} color={theme.primary} />
                <ThemedText style={[styles.sectionDividerText, { color: theme.primary }]}>Mail Order Pharmacy</ThemedText>
              </View>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
                Get medications delivered to your door
              </ThemedText>
              <View style={styles.chipRow}>
                {MAIL_ORDER_PHARMACIES.map(ph => {
                  const isActive = mailOrderPharmacy === ph;
                  return (
                    <Pressable
                      key={ph}
                      testID={`chip-mail-review-${ph.toLowerCase().replace(/\s/g, '-')}`}
                      onPress={() => { setMailOrderPharmacy(isActive ? "" : ph); try { Haptics.selectionAsync(); } catch {} }}
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
          ) : null}

          {currentStep === 2 ? (
            <View>
              <View style={[styles.tipCard, { backgroundColor: `${theme.success}06`, borderColor: `${theme.success}15`, marginBottom: Spacing.lg }]}>
                <Feather name="trending-down" size={14} color={theme.success} />
                <ThemedText style={{ color: theme.success, fontSize: 12, flex: 1, marginLeft: Spacing.sm }}>
                  Many patients save 50-80% on prescriptions by using discount programs. Select the ones you use or want to try.
                </ThemedText>
              </View>
              <View style={styles.chipRow}>
                {PHARMACY_SAVINGS.map(prog => {
                  const isActive = pharmacySavingsPrograms.includes(prog.name);
                  return (
                    <Pressable
                      key={prog.name}
                      testID={`chip-savings-review-${prog.name.toLowerCase().replace(/\s/g, '-')}`}
                      onPress={() => toggleSavingsProgram(prog.name)}
                      style={[styles.savingsChip, {
                        backgroundColor: isActive ? `${theme.success}10` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                        borderColor: isActive ? theme.success : theme.border,
                        borderWidth: isActive ? 1.5 : 1,
                      }]}
                    >
                      {isActive ? (
                        <Feather name="check" size={12} color={theme.success} style={{ marginRight: 4 }} />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.chipText, isActive ? { color: theme.success, fontWeight: "600" } : { color: theme.text }]}>
                          {prog.name}
                        </ThemedText>
                        <ThemedText style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                          {prog.desc}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <Pressable
              testID="button-prev-step"
              onPress={() => setCurrentStep(s => s - 1)}
              style={[styles.navButton, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: theme.border }]}
            >
              <Feather name="chevron-left" size={16} color={theme.text} />
              <ThemedText style={{ color: theme.text, fontSize: 14, marginLeft: 4 }}>Back</ThemedText>
            </Pressable>
          ) : <View />}

          {currentStep < STEPS.length - 1 ? (
            <Pressable
              testID="button-next-step"
              onPress={() => setCurrentStep(s => s + 1)}
              style={[styles.navButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginRight: 4 }}>Next</ThemedText>
              <Feather name="chevron-right" size={16} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              testID="button-save-review"
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={[styles.navButton, { backgroundColor: theme.success, opacity: saveMutation.isPending ? 0.7 : 1 }]}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={16} color="#fff" />
                  <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 4 }}>Complete Review</ThemedText>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={[styles.reassuranceCard, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
          <Feather name="heart" size={14} color={theme.primary} />
          <ThemedText style={{ color: theme.textSecondary, fontSize: 11, flex: 1, marginLeft: Spacing.sm, lineHeight: 16 }}>
            By regularly reviewing your care team and pharmacy preferences, you become a more active participant in your own healthcare. Small actions build lifelong health empowerment.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, marginBottom: Spacing.lg },
  headerTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  headerSubtitle: { fontSize: 13, lineHeight: 18 },
  lastReviewRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.sm },
  stepIndicatorRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  stepIndicator: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1 },
  stepHeader: { flexDirection: "row", alignItems: "center", paddingBottom: Spacing.sm, borderBottomWidth: 1, marginBottom: Spacing.sm },
  stepTitle: { fontSize: 16, fontWeight: "600", marginLeft: Spacing.sm },
  stepDesc: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 12, fontWeight: "500", marginBottom: Spacing.xs },
  inputField: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  chipText: { fontSize: 13 },
  savingsChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: 4, minWidth: "45%" },
  selectedCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md },
  searchResults: { borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs, maxHeight: 250 },
  searchResultRow: { padding: Spacing.sm, borderBottomWidth: 0.5, flexDirection: "row", alignItems: "center" },
  sectionDivider: { flexDirection: "row", alignItems: "center", paddingBottom: Spacing.xs, borderBottomWidth: 1, marginBottom: Spacing.sm },
  sectionDividerText: { fontSize: 14, fontWeight: "600", marginLeft: Spacing.sm },
  tipCard: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.md },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing["2xl"], marginBottom: Spacing.lg },
  navButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: 12, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: "transparent" },
  reassuranceCard: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  successContainer: { alignItems: "center", paddingTop: Spacing["3xl"] },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  successTitle: { fontSize: 22, fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" },
  successSubtitle: { fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  successDate: { fontSize: 13, fontWeight: "600", marginBottom: Spacing["2xl"] },
  doneButton: { paddingHorizontal: Spacing["3xl"], paddingVertical: 14, borderRadius: BorderRadius.full },
  doneButtonText: { fontSize: 16, fontWeight: "600" },
});
