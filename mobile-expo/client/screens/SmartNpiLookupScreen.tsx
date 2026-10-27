import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface ProviderResult {
  npi: string;
  firstName: string;
  lastName: string;
  credential: string;
  specialty: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  organizationName: string;
}

const SPECIALTIES = [
  "Internal Medicine",
  "Family Medicine",
  "Pediatrics",
  "Cardiology",
  "Dermatology",
  "Orthopedic Surgery",
  "Obstetrics & Gynecology",
  "Psychiatry",
  "Ophthalmology",
  "Neurology",
  "General Surgery",
  "Emergency Medicine",
  "Radiology",
  "Anesthesiology",
  "Oncology",
  "Endocrinology",
  "Gastroenterology",
  "Pulmonology",
  "Nephrology",
  "Rheumatology",
  "Allergy & Immunology",
  "Urology",
  "Physical Therapy",
  "Pharmacy",
  "Nurse Practitioner",
  "Physician Assistant",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

function ProviderCard({ provider, colors, isDark, onCall, onCopy, onShare }: {
  provider: ProviderResult;
  colors: any;
  isDark: boolean;
  onCall: (phone: string) => void;
  onCopy: (npi: string) => void;
  onShare: (provider: ProviderResult) => void;
}) {
  const isOrg = !provider.lastName && provider.organizationName;
  const displayName = isOrg
    ? provider.organizationName
    : `${provider.firstName} ${provider.lastName}${provider.credential ? `, ${provider.credential}` : ""}`;

  return (
    <View
      testID={`npi-card-${provider.npi}`}
      style={[styles.card, {
        backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundDefault,
        borderColor: colors.border,
      }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary + "15" }]}>
          <Feather name={isOrg ? "briefcase" : "user"} size={20} color={colors.primary} />
        </View>
        <View style={styles.cardHeaderText}>
          <ThemedText style={[styles.providerName, { color: colors.text }]} numberOfLines={2}>
            {displayName}
          </ThemedText>
          {provider.specialty ? (
            <ThemedText style={[styles.specialty, { color: colors.primary }]} numberOfLines={1}>
              {provider.specialty}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={[styles.npiBadge, { backgroundColor: colors.primary + "10" }]}>
        <Feather name="hash" size={12} color={colors.primary} />
        <ThemedText style={[styles.npiText, { color: colors.primary }]}>NPI {provider.npi}</ThemedText>
      </View>

      {provider.address ? (
        <View style={styles.infoRow}>
          <Feather name="map-pin" size={14} color={colors.textSecondary} />
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={2}>
            {provider.address}
          </ThemedText>
        </View>
      ) : null}

      {provider.phone ? (
        <View style={styles.infoRow}>
          <Feather name="phone" size={14} color={colors.textSecondary} />
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
            {provider.phone}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        {provider.phone ? (
          <Pressable
            testID={`npi-call-${provider.npi}`}
            style={[styles.actionBtn, { backgroundColor: colors.success + "10" }]}
            onPress={() => onCall(provider.phone)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${displayName}`}
          >
            <Feather name="phone-call" size={14} color={colors.success} />
            <ThemedText style={[styles.actionLabel, { color: colors.success }]}>Call</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          testID={`npi-copy-${provider.npi}`}
          style={[styles.actionBtn, { backgroundColor: colors.primary + "10" }]}
          onPress={() => onCopy(provider.npi)}
          accessibilityRole="button"
          accessibilityLabel={`Copy NPI ${provider.npi}`}
        >
          <Feather name="copy" size={14} color={colors.primary} />
          <ThemedText style={[styles.actionLabel, { color: colors.primary }]}>Copy NPI</ThemedText>
        </Pressable>
        <Pressable
          testID={`npi-share-${provider.npi}`}
          style={[styles.actionBtn, { backgroundColor: colors.info + "10" }]}
          onPress={() => onShare(provider)}
          accessibilityRole="button"
          accessibilityLabel={`Share ${displayName} details`}
        >
          <Feather name="share-2" size={14} color={colors.info} />
          <ThemedText style={[styles.actionLabel, { color: colors.info }]}>Share</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function SmartNpiLookupScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedNpi, setCopiedNpi] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const { checkFeature, promptProps, isSubscribed } = useFeatureGate();

  const queryEnabled = debouncedQuery.length >= 2 && isSubscribed;

  const { data: results = [], isLoading: isSearching, isError, refetch } = useQuery<ProviderResult[]>({
    queryKey: ["/api/provider-search", debouncedQuery, stateFilter, specialtyFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ q: debouncedQuery });
      if (stateFilter) params.set("state", stateFilter);
      if (specialtyFilter) params.set("specialty", specialtyFilter);
      const res = await apiRequest("GET", `/api/provider-search?${params.toString()}`);
      const data = await res.json();
      return data.results || [];
    },
    enabled: queryEnabled,
    staleTime: 60_000,
  });

  const hasSearched = queryEnabled;

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 2) {
      setDebouncedQuery("");
      return;
    }
    if (!checkFeature("npi_lookup")) {
      setDebouncedQuery("");
      return;
    }
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 400);
  }, [checkFeature]);

  const handleFilterChange = useCallback((_newState: string, _newSpecialty: string) => {
  }, []);

  const selectState = useCallback((st: string) => {
    const val = stateFilter === st ? "" : st;
    setStateFilter(val);
    setShowStateDropdown(false);
    handleFilterChange(val, specialtyFilter);
  }, [stateFilter, specialtyFilter, handleFilterChange]);

  const selectSpecialty = useCallback((sp: string) => {
    const val = specialtyFilter === sp ? "" : sp;
    setSpecialtyFilter(val);
    setShowSpecialtyDropdown(false);
    handleFilterChange(stateFilter, val);
  }, [stateFilter, specialtyFilter, handleFilterChange]);

  const handleCall = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(`tel:${cleaned}`).catch(() => {});
  }, []);

  const handleCopy = useCallback(async (npi: string) => {
    await Clipboard.setStringAsync(npi);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopiedNpi(npi);
    setTimeout(() => setCopiedNpi(null), 2000);
  }, []);

  const handleShare = useCallback(async (provider: ProviderResult) => {
    const isOrg = !provider.lastName && provider.organizationName;
    const name = isOrg ? provider.organizationName : `${provider.firstName} ${provider.lastName}${provider.credential ? `, ${provider.credential}` : ""}`;
    const msg = [
      name,
      provider.specialty ? `Specialty: ${provider.specialty}` : "",
      `NPI: ${provider.npi}`,
      provider.address ? `Address: ${provider.address}` : "",
      provider.phone ? `Phone: ${provider.phone}` : "",
    ].filter(Boolean).join("\n");

    try {
      await Share.share({ message: msg, title: `Provider: ${name}` });
    } catch {}
  }, []);

  const clearAll = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setStateFilter("");
    setSpecialtyFilter("");
  }, []);

  const renderProvider = useCallback(({ item }: { item: ProviderResult }) => (
    <ProviderCard
      provider={item}
      colors={colors}
      isDark={isDark}
      onCall={handleCall}
      onCopy={handleCopy}
      onShare={handleShare}
    />
  ), [colors, isDark, handleCall, handleCopy, handleShare]);

  const activeFilters = useMemo(() => {
    const f: string[] = [];
    if (stateFilter) f.push(stateFilter);
    if (specialtyFilter) f.push(specialtyFilter);
    return f;
  }, [stateFilter, specialtyFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.npi}
        renderItem={renderProvider}
        contentContainerStyle={[styles.listContent, {
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={[styles.searchContainer, {
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundDefault,
              borderColor: colors.border,
            }]}>
              <View style={styles.searchInputRow}>
                <Feather name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  testID="npi-search-input"
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search provider name or organization..."
                  placeholderTextColor={colors.textSecondary + "80"}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  autoCapitalize="words"
                  returnKeyType="search"
                  accessibilityLabel="Search provider name or organization"
                  onSubmitEditing={() => { if (!checkFeature("npi_lookup")) return; setDebouncedQuery(searchQuery); }}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Clear search">
                    <Feather name="x" size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filterRow}>
                <Pressable
                  testID="npi-state-filter"
                  style={[styles.filterChip, {
                    backgroundColor: stateFilter ? colors.primary + "15" : "transparent",
                    borderColor: stateFilter ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setShowStateDropdown(!showStateDropdown); setShowSpecialtyDropdown(false); }}
                  accessibilityRole="button"
                  accessibilityLabel="Filter by state"
                >
                  <Feather name="map-pin" size={12} color={stateFilter ? colors.primary : colors.textSecondary} />
                  <ThemedText style={[styles.filterLabel, { color: stateFilter ? colors.primary : colors.textSecondary }]}>
                    {stateFilter || "State"}
                  </ThemedText>
                  <Feather name="chevron-down" size={12} color={stateFilter ? colors.primary : colors.textSecondary} />
                </Pressable>

                <Pressable
                  testID="npi-specialty-filter"
                  style={[styles.filterChip, {
                    backgroundColor: specialtyFilter ? colors.primary + "15" : "transparent",
                    borderColor: specialtyFilter ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setShowSpecialtyDropdown(!showSpecialtyDropdown); setShowStateDropdown(false); }}
                  accessibilityRole="button"
                  accessibilityLabel="Filter by specialty"
                >
                  <Feather name="briefcase" size={12} color={specialtyFilter ? colors.primary : colors.textSecondary} />
                  <ThemedText style={[styles.filterLabel, { color: specialtyFilter ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
                    {specialtyFilter || "Specialty"}
                  </ThemedText>
                  <Feather name="chevron-down" size={12} color={specialtyFilter ? colors.primary : colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {showStateDropdown ? (
              <View style={[styles.dropdown, {
                backgroundColor: colors.backgroundDefault,
                borderColor: colors.border,
              }]}>
                <FlatList
                  data={US_STATES}
                  keyExtractor={(item) => item}
                  numColumns={5}
                  renderItem={({ item }) => (
                    <Pressable
                      testID={`npi-state-${item}`}
                      style={[styles.stateChip, {
                        backgroundColor: stateFilter === item ? colors.primary : "transparent",
                        borderColor: stateFilter === item ? colors.primary : colors.border,
                      }]}
                      onPress={() => selectState(item)}
                    >
                      <ThemedText style={[styles.stateChipText, {
                        color: stateFilter === item ? "#FFFFFF" : colors.text,
                      }]}>{item}</ThemedText>
                    </Pressable>
                  )}
                  scrollEnabled={false}
                />
              </View>
            ) : null}

            {showSpecialtyDropdown ? (
              <View style={[styles.dropdown, {
                backgroundColor: colors.backgroundDefault,
                borderColor: colors.border,
                maxHeight: 250,
              }]}>
                <FlatList
                  data={SPECIALTIES}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <Pressable
                      testID={`npi-specialty-${item.replace(/\s+/g, "-").toLowerCase()}`}
                      style={[styles.specialtyRow, {
                        backgroundColor: specialtyFilter === item ? colors.primary + "10" : "transparent",
                        borderBottomColor: colors.border,
                      }]}
                      onPress={() => selectSpecialty(item)}
                    >
                      <ThemedText style={[styles.specialtyRowText, {
                        color: specialtyFilter === item ? colors.primary : colors.text,
                        fontWeight: specialtyFilter === item ? "700" : "400",
                      }]}>{item}</ThemedText>
                      {specialtyFilter === item ? (
                        <Feather name="check" size={16} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  )}
                />
              </View>
            ) : null}

            {activeFilters.length > 0 ? (
              <View style={styles.activeFiltersRow}>
                {activeFilters.map((f) => (
                  <View key={f} style={[styles.activeFilterBadge, { backgroundColor: colors.primary + "15" }]}>
                    <ThemedText style={[styles.activeFilterText, { color: colors.primary }]}>{f}</ThemedText>
                    <Pressable onPress={() => {
                      if (US_STATES.includes(f)) selectState(f);
                      else selectSpecialty(f);
                    }}>
                      <Feather name="x" size={12} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Searching NPI Registry...
                </ThemedText>
              </View>
            ) : null}

            {isError ? (
              <View style={styles.emptyState}>
                <Feather name="alert-circle" size={40} color={colors.error} />
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>Search failed</ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Could not reach the NPI Registry. Check your connection and try again.
                </ThemedText>
                <Pressable
                  testID="npi-retry-btn"
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry search"
                >
                  <Feather name="refresh-cw" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : !isSearching && hasSearched && results.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="search" size={40} color={colors.textSecondary + "40"} />
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No providers found</ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Try a different name, or adjust your state and specialty filters
                </ThemedText>
              </View>
            ) : null}

            {!hasSearched && !isSearching ? (
              <View style={styles.emptyState}>
                <View style={[styles.heroIcon, { backgroundColor: colors.primary + "10" }]}>
                  <Feather name="shield" size={32} color={colors.primary} />
                </View>
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>NPI Provider Lookup</ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Search the CMS National Provider Registry to find and verify healthcare providers, organizations, and pharmacies
                </ThemedText>
                <View style={styles.tipContainer}>
                  <View style={styles.tipRow}>
                    <Feather name="user" size={14} color={colors.primary} />
                    <ThemedText style={[styles.tipText, { color: colors.textSecondary }]}>
                      Search by provider name (e.g. "Smith", "John Smith")
                    </ThemedText>
                  </View>
                  <View style={styles.tipRow}>
                    <Feather name="briefcase" size={14} color={colors.primary} />
                    <ThemedText style={[styles.tipText, { color: colors.textSecondary }]}>
                      Search by organization (e.g. "Mayo Clinic", "CVS")
                    </ThemedText>
                  </View>
                  <View style={styles.tipRow}>
                    <Feather name="filter" size={14} color={colors.primary} />
                    <ThemedText style={[styles.tipText, { color: colors.textSecondary }]}>
                      Filter by state and specialty for targeted results
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {hasSearched && results.length > 0 ? (
              <ThemedText style={[styles.resultCount, { color: colors.textSecondary }]}>
                {results.length} provider{results.length !== 1 ? "s" : ""} found
              </ThemedText>
            ) : null}
          </View>
        }
        ListFooterComponent={
          copiedNpi ? (
            <View style={[styles.toast, { backgroundColor: colors.success }]}>
              <Feather name="check" size={14} color="#FFFFFF" />
              <ThemedText style={styles.toastText}>NPI {copiedNpi} copied</ThemedText>
            </View>
          ) : null
        }
      />
      <UpgradePrompt {...promptProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  searchContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 120,
  },
  dropdown: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stateChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    margin: 2,
    flex: 1,
    alignItems: "center",
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  specialtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  specialtyRowText: {
    fontSize: 14,
  },
  activeFiltersRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  activeFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing["3xl"],
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
  tipContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tipText: {
    fontSize: 13,
    flex: 1,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  specialty: {
    fontSize: 13,
    fontWeight: "500",
  },
  npiBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  npiText: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    flex: 1,
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginTop: Spacing.md,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
