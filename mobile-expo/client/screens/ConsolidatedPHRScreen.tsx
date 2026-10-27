import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import AIChartSummary from "@/components/AIChartSummary";
import FilterSortBar, { CollapsibleGroup } from "@/components/FilterSortBar";
import type { SortOption, FilterChip } from "@/components/FilterSortBar";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/context/LanguageContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

type SectionKey =
  | "overview"
  | "conditions"
  | "medications"
  | "allergies"
  | "immunizations"
  | "labs"
  | "vitals"
  | "appointments";

interface SectionTab {
  key: SectionKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}


function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SourceBadge({ source, theme }: { source: string; theme: any }) {
  const { t } = useLanguage();
  const color =
    source === "clinical"
      ? theme.success
      : source === "intake-form"
        ? theme.info
        : source === "medication-tracker"
          ? theme.recordMedication
          : theme.warning;
  const label =
    source === "clinical"
      ? t.phr.badges.ehr
      : source === "intake-form"
        ? t.phr.badges.intake
        : source === "medication-tracker"
          ? t.phr.badges.tracker
          : source === "self-reported"
            ? t.phr.badges.self
            : t.phr.badges.other;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <ThemedText style={[styles.badgeText, { color }]}>{label}</ThemedText>
    </View>
  );
}

function isPatientEntered(source: string | undefined): boolean {
  return source === "intake-form" || source === "self-reported" || source === "medication-tracker";
}

const PATIENT_DATA_COLOR = "#2563EB";

function RecordTitle({ title, source, theme }: { title: string; source?: string; theme: any }) {
  return (
    <ThemedText type="body" style={{ color: isPatientEntered(source) ? PATIENT_DATA_COLOR : theme.text }}>
      {title}
    </ThemedText>
  );
}

function EmptySection({ message, icon, theme }: { message: string; icon: keyof typeof Feather.glyphMap; theme: any }) {
  return (
    <View style={styles.emptySection}>
      <Feather name={icon} size={40} color={theme.textSecondary} style={{ opacity: 0.4 }} />
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
        {message}
      </ThemedText>
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  count,
  color,
  theme,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  count: number;
  color: string;
  theme: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryCard,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1, ...Shadows.small },
      ]}
      testID={`summary-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <View style={[styles.summaryIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <ThemedText type="h3" style={{ color: theme.text }}>
        {count}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SectionHeader({ title, count, theme }: { title: string; count?: number; theme: any }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="h4" style={{ color: theme.text }}>
        {title}
      </ThemedText>
      {count != null ? (
        <View style={[styles.countBadge, { backgroundColor: `${theme.primary}15` }]}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
            {count}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function matchesSearch(item: any, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const searchable = [
    item.title, item.name, item.summary, item.provider,
    item.facility, item.category, item.condition,
    item.dosage, item.frequency, item.instructions,
    item.details?.value, item.details?.unit,
  ].filter(Boolean).join(" ").toLowerCase();
  return searchable.includes(q);
}

function matchesFilters(item: any, filters: Set<string> | undefined): boolean {
  if (!filters || filters.size === 0) return true;
  const source = item.source || "other";
  if (filters.has(source)) return true;
  if (item.severity && filters.has(item.severity)) return true;
  if (item.status && filters.has(item.status)) return true;
  if (item.isActive !== undefined) {
    if (filters.has("active") && item.isActive) return true;
    if (filters.has("inactive") && !item.isActive) return true;
  }
  return false;
}

function sortItems(items: any[], sortKey: string, ascending: boolean): any[] {
  return [...items].sort((a, b) => {
    let valA: any, valB: any;
    switch (sortKey) {
      case "date":
        valA = new Date(a.date || a.scheduledAt || 0).getTime();
        valB = new Date(b.date || b.scheduledAt || 0).getTime();
        break;
      case "name":
        valA = (a.title || a.name || "").toLowerCase();
        valB = (b.title || b.name || "").toLowerCase();
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      case "severity": {
        const sevOrder: Record<string, number> = { severe: 3, moderate: 2, mild: 1 };
        valA = sevOrder[a.severity] || 0;
        valB = sevOrder[b.severity] || 0;
        break;
      }
      case "provider":
        valA = (a.provider || "").toLowerCase();
        valB = (b.provider || "").toLowerCase();
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      default:
        valA = 0;
        valB = 0;
    }
    return ascending ? valA - valB : valB - valA;
  });
}

const SOURCE_FILTERS: FilterChip[] = [
  { key: "clinical", label: "EHR / Clinical", active: false },
  { key: "self-reported", label: "Self-Reported", active: false },
  { key: "intake-form", label: "Intake Form", active: false },
  { key: "medication-tracker", label: "Med Tracker", active: false },
];

const COMMON_SORT_OPTIONS: SortOption[] = [
  { key: "date", label: "Date", icon: "calendar" },
  { key: "name", label: "Name", icon: "type" },
];

export default function ConsolidatedPHRScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const tabScrollRef = useRef<ScrollView>(null);
  const [searchQueries, setSearchQueries] = useState<Record<SectionKey, string>>({
    overview: "", conditions: "", medications: "", allergies: "",
    immunizations: "", labs: "", vitals: "", appointments: "",
  });
  const [sortConfigs, setSortConfigs] = useState<Record<SectionKey, { key: string; ascending: boolean }>>({
    overview: { key: "date", ascending: false },
    conditions: { key: "date", ascending: false },
    medications: { key: "name", ascending: true },
    allergies: { key: "name", ascending: true },
    immunizations: { key: "date", ascending: false },
    labs: { key: "date", ascending: false },
    vitals: { key: "date", ascending: false },
    appointments: { key: "date", ascending: true },
  });
  const [activeFilterSets, setActiveFilterSets] = useState<Record<string, Set<string>>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "active-conditions": true, "surgical-history": false,
    "active-meds": true, "other-meds": false,
    "upcoming-appts": true, "past-appts": false,
  });

  const updateSearch = useCallback((section: SectionKey, query: string) => {
    setSearchQueries(prev => ({ ...prev, [section]: query }));
  }, []);
  const updateSort = useCallback((section: SectionKey, key: string) => {
    setSortConfigs(prev => ({ ...prev, [section]: { key, ascending: true } }));
  }, []);
  const toggleSortDirection = useCallback((section: SectionKey) => {
    setSortConfigs(prev => ({ ...prev, [section]: { ...prev[section], ascending: !prev[section].ascending } }));
  }, []);
  const toggleFilter = useCallback((section: string, filterKey: string) => {
    setActiveFilterSets(prev => {
      const current = new Set(prev[section] || []);
      if (current.has(filterKey)) current.delete(filterKey); else current.add(filterKey);
      return { ...prev, [section]: current };
    });
  }, []);
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }, []);

  const sections: SectionTab[] = useMemo(() => [
    { key: "overview", label: t.phr.overview, icon: "grid" },
    { key: "conditions", label: t.phr.conditions, icon: "heart" },
    { key: "medications", label: t.phr.medications, icon: "package" },
    { key: "allergies", label: t.phr.allergies, icon: "alert-circle" },
    { key: "immunizations", label: t.phr.vaccines, icon: "shield" },
    { key: "labs", label: t.phr.labs, icon: "activity" },
    { key: "vitals", label: t.phr.vitals, icon: "thermometer" },
    { key: "appointments", label: t.phr.appointments, icon: "calendar" },
  ], [t]);

  const {
    data: phr,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<any>({
    queryKey: ["/api/phr/consolidated"],
    staleTime: 60000,
  });

  const handleTabPress = (key: SectionKey, index: number) => {
    setActiveSection(key);
    tabScrollRef.current?.scrollTo({ x: Math.max(0, index * 90 - 60), animated: true });
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading your health record...
        </ThemedText>
      </View>
    );
  }

  if (isError || !phr) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Unable to load your health record
        </ThemedText>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
        >
          <ThemedText type="body" style={{ color: "#FFF" }}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }

  const renderOverview = () => {
    const s = phr.summary;
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        {phr.patientInfo ? (
          <View style={[styles.patientCard, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
            <View style={[styles.patientAvatar, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="user" size={28} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {phr.patientInfo.name || "Patient"}
              </ThemedText>
              {phr.patientInfo.dateOfBirth ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  DOB: {formatDate(phr.patientInfo.dateOfBirth)}
                </ThemedText>
              ) : null}
              {phr.patientInfo.gender ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {phr.patientInfo.gender}{phr.patientInfo.bloodType ? ` | Blood: ${phr.patientInfo.bloodType}` : ""}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}

        <AIChartSummary phrData={phr} />

        <View style={styles.summaryGrid}>
          <SummaryCard icon="heart" label={t.phr.summaryCards.conditions} count={s.conditionsCount} color={theme.error} theme={theme} onPress={() => setActiveSection("conditions")} />
          <SummaryCard icon="package" label={t.phr.summaryCards.medications} count={s.medicationsCount} color={theme.recordMedication} theme={theme} onPress={() => setActiveSection("medications")} />
          <SummaryCard icon="alert-circle" label={t.phr.summaryCards.allergies} count={s.allergiesCount} color={theme.warning} theme={theme} onPress={() => setActiveSection("allergies")} />
          <SummaryCard icon="shield" label={t.phr.summaryCards.vaccines} count={s.immunizationsCount} color={theme.success} theme={theme} onPress={() => setActiveSection("immunizations")} />
          <SummaryCard icon="activity" label={t.phr.summaryCards.labResults} count={s.labResultsCount} color={theme.info} theme={theme} onPress={() => setActiveSection("labs")} />
          <SummaryCard icon="calendar" label={t.phr.summaryCards.upcoming} count={s.upcomingAppointmentsCount} color={theme.primary} theme={theme} onPress={() => setActiveSection("appointments")} />
        </View>

        <View style={styles.colorLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PATIENT_DATA_COLOR }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Patient-entered data</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.text }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Imported / clinical records</ThemedText>
          </View>
        </View>

        {s.lastUpdated ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
            Last updated: {formatDate(s.lastUpdated)}
          </ThemedText>
        ) : null}

        {phr.patientInfo?.emergencyContact ? (
          <View style={[styles.emergencyCard, { backgroundColor: `${theme.error}08`, borderColor: `${theme.error}30` }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
              <Feather name="phone" size={14} color={theme.error} />
              <ThemedText type="caption" style={{ color: theme.error, marginLeft: Spacing.xs, fontWeight: "600" }}>
                {t.phr.emergencyContact}
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.text }}>
              {phr.patientInfo.emergencyContact.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {phr.patientInfo.emergencyContact.relationship} | {phr.patientInfo.emergencyContact.phone}
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const renderConditions = () => {
    const conditions = phr.medicalHistory?.conditions || [];
    const diagnoses = phr.medicalHistory?.intakeDiagnoses || [];
    const surgeries = phr.medicalHistory?.surgeries || [];
    const query = searchQueries.conditions;
    const sort = sortConfigs.conditions;
    const filters = activeFilterSets["conditions"];

    const filteredDiagnoses = sortItems(diagnoses.filter((d: any) => matchesSearch(d, query) && matchesFilters(d, filters)), sort.key, sort.ascending);
    const filteredConditions = sortItems(conditions.filter((c: any) => matchesSearch(c, query) && matchesFilters(c, filters)), sort.key, sort.ascending);
    const filteredSurgeries = sortItems(surgeries.filter((s: any) => matchesSearch(s, query) && matchesFilters(s, filters)), sort.key, sort.ascending);
    const totalFiltered = filteredDiagnoses.length + filteredConditions.length;
    const totalAll = diagnoses.length + conditions.length + surgeries.length;
    const filterChips = SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false }));

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("conditions", q)}
          searchPlaceholder="Search conditions..."
          sortOptions={[...COMMON_SORT_OPTIONS, { key: "provider", label: "Provider", icon: "user" }]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("conditions", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("conditions")}
          filterChips={filterChips}
          onFilterToggle={(k) => toggleFilter("conditions", k)}
          resultCount={totalAll > 0 ? totalFiltered + filteredSurgeries.length : undefined}
          theme={theme}
        />
        {totalAll === 0 ? (
          <EmptySection message={t.phr.empty.conditions} icon="heart" theme={theme} />
        ) : (
          <>
            <CollapsibleGroup title="Active Conditions" count={totalFiltered} icon="heart" iconColor={theme.error}
              expanded={expandedGroups["active-conditions"] !== false} onToggle={() => toggleGroup("active-conditions")} theme={theme}>
              {totalFiltered === 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching conditions</ThemedText>
              ) : null}
              {filteredDiagnoses.map((d: any, i: number) => (
                <View key={`dx-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                  <View style={[styles.recordIcon, { backgroundColor: `${theme.error}12` }]}>
                    <Feather name="heart" size={16} color={theme.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RecordTitle title={d.name} source={d.source} theme={theme} />
                    {d.code ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>ICD-10: {d.code}</ThemedText>) : null}
                    {d.category ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{d.category}</ThemedText>) : null}
                  </View>
                  <SourceBadge source={d.source} theme={theme} />
                </View>
              ))}
              {filteredConditions.map((c: any, i: number) => (
                <View key={`cond-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                  <View style={[styles.recordIcon, { backgroundColor: `${theme.recordVisit}12` }]}>
                    <Feather name={c.type === "visit" ? "clipboard" : "heart"} size={16} color={theme.recordVisit} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RecordTitle title={c.title} source={c.source} theme={theme} />
                    {c.provider ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{c.provider}</ThemedText>) : null}
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(c.date)}</ThemedText>
                  </View>
                  <SourceBadge source={c.source} theme={theme} />
                </View>
              ))}
            </CollapsibleGroup>
            {surgeries.length > 0 ? (
              <CollapsibleGroup title="Surgical History" count={filteredSurgeries.length} icon="scissors" iconColor={theme.warning}
                expanded={expandedGroups["surgical-history"] !== false} onToggle={() => toggleGroup("surgical-history")} theme={theme}>
                {filteredSurgeries.map((s: any, i: number) => (
                  <View key={`surg-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                    <View style={[styles.recordIcon, { backgroundColor: `${theme.warning}12` }]}>
                      <Feather name="scissors" size={16} color={theme.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RecordTitle title={s.name} source={s.source} theme={theme} />
                      {s.code ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>CPT: {s.code}</ThemedText>) : null}
                    </View>
                    <SourceBadge source={s.source} theme={theme} />
                  </View>
                ))}
              </CollapsibleGroup>
            ) : null}
          </>
        )}
      </Animated.View>
    );
  };

  const renderMedications = () => {
    const meds = phr.medications || [];
    const query = searchQueries.medications;
    const sort = sortConfigs.medications;
    const filters = activeFilterSets["medications"];
    const statusFilterChips: FilterChip[] = [
      { key: "active", label: "Active", active: filters?.has("active") || false },
      { key: "inactive", label: "Inactive", active: filters?.has("inactive") || false },
      ...SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false })),
    ];
    const allFiltered = sortItems(meds.filter((m: any) => matchesSearch(m, query) && matchesFilters(m, filters)), sort.key, sort.ascending);
    const activeFiltered = allFiltered.filter((m: any) => m.isActive);
    const othersFiltered = allFiltered.filter((m: any) => !m.isActive);

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("medications", q)}
          searchPlaceholder="Search medications..."
          sortOptions={[...COMMON_SORT_OPTIONS]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("medications", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("medications")}
          filterChips={statusFilterChips}
          onFilterToggle={(k) => toggleFilter("medications", k)}
          resultCount={meds.length > 0 ? allFiltered.length : undefined}
          theme={theme}
        />
        {meds.length === 0 ? (
          <EmptySection message={t.phr.empty.medications} icon="package" theme={theme} />
        ) : (
          <>
            <CollapsibleGroup title="Active Medications" count={activeFiltered.length} icon="check-circle" iconColor={theme.success}
              expanded={expandedGroups["active-meds"] !== false} onToggle={() => toggleGroup("active-meds")} theme={theme}>
              {activeFiltered.length === 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching active medications</ThemedText>
              ) : null}
              {activeFiltered.map((m: any, i: number) => (
                <View key={`active-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                  <View style={[styles.recordIcon, { backgroundColor: `${theme.success}12` }]}>
                    <Feather name="check-circle" size={16} color={theme.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RecordTitle title={m.name || m.title} source={m.source} theme={theme} />
                    {m.dosage ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{m.dosage} | {m.frequency?.replace(/_/g, " ")}</ThemedText>) : null}
                    {m.instructions ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{m.instructions}</ThemedText>) : null}
                  </View>
                  <SourceBadge source={m.source} theme={theme} />
                </View>
              ))}
            </CollapsibleGroup>
            {othersFiltered.length > 0 ? (
              <CollapsibleGroup title="Other Medications" count={othersFiltered.length} icon="package" iconColor={theme.recordMedication}
                expanded={expandedGroups["other-meds"] !== false} onToggle={() => toggleGroup("other-meds")} theme={theme}>
                {othersFiltered.map((m: any, i: number) => (
                  <View key={`med-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                    <View style={[styles.recordIcon, { backgroundColor: `${theme.recordMedication}12` }]}>
                      <Feather name="package" size={16} color={theme.recordMedication} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RecordTitle title={m.name || m.title} source={m.source} theme={theme} />
                      {m.category ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{m.category}</ThemedText>) : null}
                      {m.date ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(m.date)}</ThemedText>) : null}
                    </View>
                    <SourceBadge source={m.source} theme={theme} />
                  </View>
                ))}
              </CollapsibleGroup>
            ) : null}
          </>
        )}
      </Animated.View>
    );
  };

  const renderAllergies = () => {
    const allergies = phr.allergies || [];
    const query = searchQueries.allergies;
    const sort = sortConfigs.allergies;
    const filters = activeFilterSets["allergies"];
    const severityFilterChips: FilterChip[] = [
      { key: "severe", label: "Severe", active: filters?.has("severe") || false },
      { key: "moderate", label: "Moderate", active: filters?.has("moderate") || false },
      { key: "mild", label: "Mild", active: filters?.has("mild") || false },
      ...SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false })),
    ];
    const filtered = sortItems(allergies.filter((a: any) => matchesSearch(a, query) && matchesFilters(a, filters)), sort.key, sort.ascending);

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("allergies", q)}
          searchPlaceholder="Search allergies..."
          sortOptions={[...COMMON_SORT_OPTIONS, { key: "severity", label: "Severity", icon: "alert-triangle" }]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("allergies", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("allergies")}
          filterChips={severityFilterChips}
          onFilterToggle={(k) => toggleFilter("allergies", k)}
          resultCount={allergies.length > 0 ? filtered.length : undefined}
          theme={theme}
        />
        {allergies.length === 0 ? (
          <EmptySection message={t.phr.empty.allergies} icon="alert-circle" theme={theme} />
        ) : filtered.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching allergies</ThemedText>
        ) : null}
        {filtered.map((a: any, i: number) => (
          <View key={`allergy-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
            <View style={[styles.recordIcon, { backgroundColor: `${theme.warning}12` }]}>
              <Feather name="alert-triangle" size={16} color={theme.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <RecordTitle title={a.title || a.name} source={a.source} theme={theme} />
              {a.category ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{a.category}</ThemedText>) : null}
              {a.severity ? (
                <View style={[styles.severityBadge, {
                  backgroundColor: a.severity === "severe" ? `${theme.error}15` : a.severity === "moderate" ? `${theme.warning}15` : `${theme.success}15`
                }]}>
                  <ThemedText style={{ fontSize: 11, fontWeight: "600",
                    color: a.severity === "severe" ? theme.error : a.severity === "moderate" ? theme.warning : theme.success,
                  }}>{a.severity.charAt(0).toUpperCase() + a.severity.slice(1)}</ThemedText>
                </View>
              ) : null}
              {a.date ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(a.date)}</ThemedText>) : null}
            </View>
            <SourceBadge source={a.source} theme={theme} />
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderImmunizations = () => {
    const immunizations = phr.immunizations || [];
    const query = searchQueries.immunizations;
    const sort = sortConfigs.immunizations;
    const filters = activeFilterSets["immunizations"];
    const filterChips = SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false }));
    const filtered = sortItems(immunizations.filter((v: any) => matchesSearch(v, query) && matchesFilters(v, filters)), sort.key, sort.ascending);

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("immunizations", q)}
          searchPlaceholder="Search immunizations..."
          sortOptions={[...COMMON_SORT_OPTIONS, { key: "provider", label: "Provider", icon: "user" }]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("immunizations", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("immunizations")}
          filterChips={filterChips}
          onFilterToggle={(k) => toggleFilter("immunizations", k)}
          resultCount={immunizations.length > 0 ? filtered.length : undefined}
          theme={theme}
        />
        {immunizations.length === 0 ? (
          <EmptySection message={t.phr.empty.vaccines} icon="shield" theme={theme} />
        ) : filtered.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching immunizations</ThemedText>
        ) : null}
        {filtered.map((v: any, i: number) => (
          <View key={`vax-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
            <View style={[styles.recordIcon, { backgroundColor: `${theme.success}12` }]}>
              <Feather name="check-circle" size={16} color={theme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <RecordTitle title={v.title || v.name} source={v.source} theme={theme} />
              {v.provider ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{v.provider}</ThemedText>) : null}
              {v.date ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(v.date)}</ThemedText>) : null}
            </View>
            <SourceBadge source={v.source} theme={theme} />
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderLabs = () => {
    const labs = phr.labResults || [];
    const query = searchQueries.labs;
    const sort = sortConfigs.labs;
    const filters = activeFilterSets["labs"];
    const filterChips = SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false }));
    const filtered = sortItems(labs.filter((l: any) => matchesSearch(l, query) && matchesFilters(l, filters)), sort.key, sort.ascending);

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("labs", q)}
          searchPlaceholder="Search lab results..."
          sortOptions={[...COMMON_SORT_OPTIONS, { key: "provider", label: "Provider", icon: "user" }]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("labs", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("labs")}
          filterChips={filterChips}
          onFilterToggle={(k) => toggleFilter("labs", k)}
          resultCount={labs.length > 0 ? filtered.length : undefined}
          theme={theme}
        />
        {labs.length === 0 ? (
          <EmptySection message={t.phr.empty.labs} icon="activity" theme={theme} />
        ) : filtered.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching lab results</ThemedText>
        ) : null}
        {filtered.map((l: any, i: number) => (
          <View key={`lab-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
            <View style={[styles.recordIcon, { backgroundColor: `${theme.recordLab}12` }]}>
              <Feather name="file-text" size={16} color={theme.recordLab} />
            </View>
            <View style={{ flex: 1 }}>
              <RecordTitle title={l.title} source={l.source} theme={theme} />
              {l.summary ? (<ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>{l.summary}</ThemedText>) : null}
              {l.provider ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{l.provider} | {l.facility || ""}</ThemedText>) : null}
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(l.date)}</ThemedText>
            </View>
            <SourceBadge source={l.source} theme={theme} />
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderVitals = () => {
    const vitals = phr.vitals || [];
    const query = searchQueries.vitals;
    const sort = sortConfigs.vitals;
    const filters = activeFilterSets["vitals"];
    const filterChips = SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false }));
    const filtered = sortItems(vitals.filter((v: any) => matchesSearch(v, query) && matchesFilters(v, filters)), sort.key, sort.ascending);

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("vitals", q)}
          searchPlaceholder="Search vitals..."
          sortOptions={[...COMMON_SORT_OPTIONS]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("vitals", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("vitals")}
          filterChips={filterChips}
          onFilterToggle={(k) => toggleFilter("vitals", k)}
          resultCount={vitals.length > 0 ? filtered.length : undefined}
          theme={theme}
        />
        {vitals.length === 0 ? (
          <EmptySection message={t.phr.empty.vitals} icon="thermometer" theme={theme} />
        ) : filtered.length === 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No matching vitals</ThemedText>
        ) : null}
        {filtered.map((v: any, i: number) => (
          <View key={`vital-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
            <View style={[styles.recordIcon, { backgroundColor: `${theme.info}12` }]}>
              <Feather name="thermometer" size={16} color={theme.info} />
            </View>
            <View style={{ flex: 1 }}>
              <RecordTitle title={v.title} source={v.source} theme={theme} />
              {v.summary ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{v.summary}</ThemedText>) : null}
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(v.date)}</ThemedText>
            </View>
            <SourceBadge source={v.source} theme={theme} />
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderAppointments = () => {
    const upcoming = phr.appointments?.upcoming || [];
    const past = phr.appointments?.past || [];
    const allAppts = [...upcoming.map((a: any) => ({ ...a, _group: "upcoming" })), ...past.map((a: any) => ({ ...a, _group: "past" }))];
    const query = searchQueries.appointments;
    const sort = sortConfigs.appointments;
    const filters = activeFilterSets["appointments"];
    const statusFilterChips: FilterChip[] = [
      { key: "confirmed", label: "Confirmed", active: filters?.has("confirmed") || false },
      { key: "pending", label: "Pending", active: filters?.has("pending") || false },
      ...SOURCE_FILTERS.map(f => ({ ...f, active: filters?.has(f.key) || false })),
    ];
    const filteredAll = sortItems(allAppts.filter((a: any) => matchesSearch(a, query) && matchesFilters(a, filters)), sort.key, sort.ascending);
    const filteredUpcoming = filteredAll.filter((a: any) => a._group === "upcoming");
    const filteredPast = filteredAll.filter((a: any) => a._group === "past");

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <FilterSortBar
          searchQuery={query}
          onSearchChange={(q) => updateSearch("appointments", q)}
          searchPlaceholder="Search appointments..."
          sortOptions={[...COMMON_SORT_OPTIONS, { key: "provider", label: "Provider", icon: "user" }]}
          activeSort={sort.key}
          onSortChange={(k) => updateSort("appointments", k)}
          sortAscending={sort.ascending}
          onSortDirectionToggle={() => toggleSortDirection("appointments")}
          filterChips={statusFilterChips}
          onFilterToggle={(k) => toggleFilter("appointments", k)}
          resultCount={allAppts.length > 0 ? filteredAll.length : undefined}
          theme={theme}
        />
        {allAppts.length === 0 ? (
          <EmptySection message={t.phr.empty.appointments} icon="calendar" theme={theme} />
        ) : (
          <>
            <CollapsibleGroup title="Upcoming Appointments" count={filteredUpcoming.length} icon="calendar" iconColor={theme.primary}
              expanded={expandedGroups["upcoming-appts"] !== false} onToggle={() => toggleGroup("upcoming-appts")} theme={theme}>
              {filteredUpcoming.length === 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, padding: Spacing.md, textAlign: "center" }}>No upcoming appointments</ThemedText>
              ) : null}
              {filteredUpcoming.map((a: any, i: number) => (
                <View key={`upcoming-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                  <View style={[styles.recordIcon, { backgroundColor: `${theme.primary}12` }]}>
                    <Feather name="calendar" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RecordTitle title={a.title} source={a.source} theme={theme} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>{formatDateTime(a.scheduledAt)}</ThemedText>
                    {a.provider ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{a.provider}{a.facility ? ` at ${a.facility}` : ""}</ThemedText>) : null}
                    {a.duration ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{a.duration} min</ThemedText>) : null}
                    <View style={[styles.statusBadge, { backgroundColor: a.status === "confirmed" ? `${theme.success}15` : `${theme.info}15` }]}>
                      <ThemedText style={{ fontSize: 11, fontWeight: "600", color: a.status === "confirmed" ? theme.success : theme.info }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </CollapsibleGroup>
            {past.length > 0 ? (
              <CollapsibleGroup title="Past Appointments" count={filteredPast.length} icon="check-square" iconColor={theme.textSecondary}
                expanded={expandedGroups["past-appts"] !== false} onToggle={() => toggleGroup("past-appts")} theme={theme}>
                {filteredPast.map((a: any, i: number) => (
                  <View key={`past-${i}`} style={[styles.recordRow, { backgroundColor: theme.backgroundDefault, ...Shadows.small }]}>
                    <View style={[styles.recordIcon, { backgroundColor: `${theme.textSecondary}12` }]}>
                      <Feather name="check-square" size={16} color={theme.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RecordTitle title={a.title} source={a.source} theme={theme} />
                      {a.provider ? (<ThemedText type="small" style={{ color: theme.textSecondary }}>{a.provider}</ThemedText>) : null}
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(a.scheduledAt)}</ThemedText>
                    </View>
                  </View>
                ))}
              </CollapsibleGroup>
            ) : null}
          </>
        )}
      </Animated.View>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "conditions":
        return renderConditions();
      case "medications":
        return renderMedications();
      case "allergies":
        return renderAllergies();
      case "immunizations":
        return renderImmunizations();
      case "labs":
        return renderLabs();
      case "vitals":
        return renderVitals();
      case "appointments":
        return renderAppointments();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabBarContainer, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {sections.map((section, index) => {
            const isActive = activeSection === section.key;
            return (
              <Pressable
                key={section.key}
                onPress={() => handleTabPress(section.key, index)}
                style={[
                  styles.tabItem,
                  {
                    backgroundColor: isActive ? theme.primary : "transparent",
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                ]}
                testID={`phr-tab-${section.key}`}
              >
                <Feather
                  name={section.icon}
                  size={14}
                  color={isActive ? "#FFF" : theme.textSecondary}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: isActive ? "#FFF" : theme.textSecondary,
                    fontWeight: isActive ? "700" : "500",
                    marginLeft: 4,
                  }}
                >
                  {section.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingTop: Spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={theme.primary} />
        }
      >
        {renderActiveSection()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  tabBarContainer: {
    zIndex: 10,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  contentScroll: {
    flex: 1,
  },
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  summaryCard: {
    width: "31%",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 100,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  emergencyCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  severityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  emptySection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  colorLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
