import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface ClinicalCategory {
  count: number;
  items: string[];
}

interface ClinicalSummary {
  conditions: ClinicalCategory;
  medications: ClinicalCategory;
  allergies: ClinicalCategory;
  immunizations: ClinicalCategory;
}

interface FHIRPatient {
  resourceType: string;
  id: string;
  meta: { lastUpdated: string };
  active: boolean;
  name: { use: string; family: string; given: string[]; text: string }[];
  gender: string;
  birthDate: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  telecom: { system: string; value: string; use?: string }[];
  address: { line?: string[]; city?: string; state?: string; postalCode?: string; use?: string }[];
  identifier: { type: string; value: string }[];
  communication: any[];
  extension: any[];
  _userId?: string;
  _profileCompleteness?: number;
  _recordCount?: number;
  _bloodType?: string;
  _emergencyContacts?: { name: string; phone: string; relationship: string }[];
  _insuranceInfo?: { type: string; provider: string; policyNumber: string }[];
  _clinicalSummary?: ClinicalSummary;
}

interface FHIRBundle {
  resourceType: string;
  type: string;
  total: number;
  link: { relation: string; url: string }[];
  entry: { fullUrl: string; resource: FHIRPatient }[];
}

type SortField = "family" | "given" | "birthdate" | "gender" | "death-date" | "conditions" | "medications" | "allergies" | "immunizations";
type SortDir = "asc" | "desc";
type ClinicalFilterType = "conditions" | "medications" | "allergies" | "immunizations";

const PAGE_SIZE = 10;

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Last Name", value: "family" },
  { label: "First Name", value: "given" },
  { label: "Date of Birth", value: "birthdate" },
  { label: "Gender", value: "gender" },
  { label: "Date of Death", value: "death-date" },
  { label: "Conditions", value: "conditions" },
  { label: "Medications", value: "medications" },
  { label: "Allergies", value: "allergies" },
  { label: "Immunizations", value: "immunizations" },
];

export default function FHIRPatientSearchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchName, setSearchName] = useState("");
  const [searchDOB, setSearchDOB] = useState("");
  const [searchMRN, setSearchMRN] = useState("");
  const [searchGender, setSearchGender] = useState("");
  const [searchDeathDate, setSearchDeathDate] = useState("");
  const [searchDeceased, setSearchDeceased] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<FHIRPatient | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includeClinical, setIncludeClinical] = useState(true);
  const [sortField, setSortField] = useState<SortField>("family");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [clinicalFilter, setClinicalFilter] = useState<ClinicalFilterType | "">("");
  const [expandedClinicalId, setExpandedClinicalId] = useState<string | null>(null);

  const [submittedSearch, setSubmittedSearch] = useState<{
    name: string; dob: string; mrn: string; gender: string;
    deathDate: string; deceased: string; page: number;
    sort: string; includeClinical: boolean;
  } | null>(null);

  const buildQueryString = (s: typeof submittedSearch) => {
    if (!s) return "";
    const params = new URLSearchParams();
    params.set("_count", String(PAGE_SIZE));
    params.set("_offset", String(s.page * PAGE_SIZE));
    params.set("_sort", (s.sort.startsWith("-") ? "" : "") + s.sort);
    if (s.name.trim()) params.set("name", s.name.trim());
    if (s.dob.trim()) params.set("birthdate", s.dob.trim());
    if (s.mrn.trim()) params.set("identifier", s.mrn.trim());
    if (s.gender.trim()) params.set("gender", s.gender.trim());
    if (s.deathDate.trim()) params.set("death-date", s.deathDate.trim());
    if (s.deceased.trim()) params.set("deceased", s.deceased.trim());
    if (s.includeClinical) params.set("_include_clinical", "true");
    return params.toString();
  };

  const searchQueryString = submittedSearch ? buildQueryString(submittedSearch) : "";

  const fetchFHIR = async (path: string) => {
    const userId = await AsyncStorage.getItem("@tabula_medica_user_id");
    const headers: Record<string, string> = {};
    if (userId) headers["x-user-id"] = userId;
    const baseUrl = getApiUrl();
    const fullUrl = new URL(path, baseUrl).toString();
    const res = await fetch(fullUrl, { headers, credentials: "include" });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${res.status}: ${errText.substring(0, 100)}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      throw new Error("Invalid response type from server");
    }
    return await res.json();
  };

  const { data: searchResults, isLoading, isFetching, error: searchError } = useQuery<FHIRBundle>({
    queryKey: ["fhir-patient-search", searchQueryString],
    queryFn: () => fetchFHIR(`/api/fhir/Patient?${searchQueryString}`),
    enabled: !!submittedSearch,
  });

  const { data: patientDetail, isLoading: detailLoading } = useQuery<FHIRPatient>({
    queryKey: ["fhir-patient-detail", selectedPatient?.id],
    queryFn: () => fetchFHIR(`/api/fhir/Patient/${selectedPatient!.id}`),
    enabled: !!selectedPatient?.id && detailModalVisible,
  });

  const filteredEntries = useMemo(() => {
    if (!searchResults?.entry) return [];
    if (!clinicalFilter) return searchResults.entry;
    return searchResults.entry.filter((e) => {
      const cs = e.resource._clinicalSummary;
      if (!cs) return true;
      return cs[clinicalFilter].count > 0;
    });
  }, [searchResults, clinicalFilter]);

  const handleSearch = () => {
    setCurrentPage(0);
    const sortStr = sortDir === "desc" ? `-${sortField}` : sortField;
    setSubmittedSearch({
      name: searchName, dob: searchDOB, mrn: searchMRN, gender: searchGender,
      deathDate: searchDeathDate, deceased: searchDeceased, page: 0,
      sort: sortStr, includeClinical,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setSearchName("");
    setSearchDOB("");
    setSearchMRN("");
    setSearchGender("");
    setSearchDeathDate("");
    setSearchDeceased("");
    setCurrentPage(0);
    setSubmittedSearch(null);
    setClinicalFilter("");
    setSortField("family");
    setSortDir("asc");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setShowSortPicker(false);
    if (submittedSearch) {
      const newDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
      const newField = field;
      const sortStr = newDir === "desc" ? `-${newField}` : newField;
      setCurrentPage(0);
      setSubmittedSearch({ ...submittedSearch, page: 0, sort: sortStr });
    }
  };

  const handleViewPatient = (patient: FHIRPatient) => {
    setSelectedPatient(patient);
    setDetailModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const totalPages = searchResults ? Math.ceil(searchResults.total / PAGE_SIZE) : 0;

  const genderOptions = [
    { label: "All", value: "" },
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
    { label: "Other", value: "other" },
  ];

  const deceasedOptions = [
    { label: "All", value: "" },
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ];

  const clinicalFilterOptions: { label: string; value: ClinicalFilterType | "" }[] = [
    { label: "All", value: "" },
    { label: "Has Conditions", value: "conditions" },
    { label: "Has Medications", value: "medications" },
    { label: "Has Allergies", value: "allergies" },
    { label: "Has Immunizations", value: "immunizations" },
  ];

  const renderClinicalBadge = (label: string, count: number, color: string, icon: keyof typeof Feather.glyphMap) => (
    <View style={[styles.clinicalBadge, { backgroundColor: color + "12" }]}>
      <Feather name={icon} size={10} color={color} />
      <ThemedText type="caption" style={{ color, marginLeft: 3, fontSize: 11 }}>
        {count} {label}
      </ThemedText>
    </View>
  );

  const renderClinicalDetail = (items: string[], color: string) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.clinicalDetailList}>
        {items.map((item, i) => (
          <View key={i} style={[styles.clinicalDetailItem, { backgroundColor: color + "08" }]}>
            <View style={[styles.clinicalDot, { backgroundColor: color }]} />
            <ThemedText type="caption" style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
              {item}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  };

  const renderPatientRow = ({ item }: { item: { fullUrl: string; resource: FHIRPatient } }) => {
    const p = item.resource;
    const nameText = p.name?.[0]?.text || "Unknown";
    const dob = p.birthDate || "N/A";
    const gender = p.gender || "N/A";
    const phone = p.telecom?.find(t => t.system === "phone")?.value;
    const email = p.telecom?.find(t => t.system === "email")?.value;
    const mrn = p.identifier?.find(i => i.type === "MRN")?.value;
    const isDeceased = p.deceasedBoolean || !!p.deceasedDateTime;
    const cs = p._clinicalSummary;
    const isExpanded = expandedClinicalId === p.id;

    return (
      <Card
        elevation={1}
        onPress={() => handleViewPatient(p)}
        style={styles.patientCard}
      >
        <View style={styles.patientRow}>
          <View style={[styles.avatarCircle, { backgroundColor: isDeceased ? theme.error + "20" : theme.primary + "20" }]}>
            <Feather name="user" size={20} color={isDeceased ? theme.error : theme.primary} />
          </View>
          <View style={styles.patientInfo}>
            <View style={styles.nameRow}>
              <ThemedText type="h4" testID={`text-patient-name-${p.id}`} style={{ flex: 1 }}>{nameText}</ThemedText>
              {isDeceased ? (
                <View style={[styles.deceasedBadge, { backgroundColor: theme.error + "15" }]}>
                  <ThemedText type="caption" style={{ color: theme.error, fontSize: 10, fontWeight: "600" }}>
                    Deceased
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.patientMeta}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={12} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  {dob}
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <Feather name="user" size={12} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  {gender}
                </ThemedText>
              </View>
              {mrn ? (
                <View style={styles.metaItem}>
                  <Feather name="hash" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                    {mrn}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {isDeceased && p.deceasedDateTime ? (
              <View style={[styles.metaItem, { marginTop: 2 }]}>
                <Feather name="x-circle" size={12} color={theme.error} />
                <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>
                  Died: {p.deceasedDateTime}
                </ThemedText>
              </View>
            ) : null}
            {phone || email ? (
              <View style={styles.patientContact}>
                {phone ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {phone}
                  </ThemedText>
                ) : null}
                {email ? (
                  <ThemedText type="caption" style={{ color: theme.link }} numberOfLines={1}>
                    {email}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            {cs ? (
              <View style={styles.clinicalSection}>
                <Pressable
                  testID={`button-toggle-clinical-${p.id}`}
                  style={styles.clinicalBadgeRow}
                  onPress={() => {
                    setExpandedClinicalId(isExpanded ? null : p.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {cs.conditions.count > 0 ? renderClinicalBadge("Cond", cs.conditions.count, "#EF4444", "activity") : null}
                  {cs.medications.count > 0 ? renderClinicalBadge("Meds", cs.medications.count, "#8B5CF6", "package") : null}
                  {cs.allergies.count > 0 ? renderClinicalBadge("Allrg", cs.allergies.count, "#F59E0B", "alert-triangle") : null}
                  {cs.immunizations.count > 0 ? renderClinicalBadge("Immun", cs.immunizations.count, "#10B981", "shield") : null}
                  {cs.conditions.count === 0 && cs.medications.count === 0 && cs.allergies.count === 0 && cs.immunizations.count === 0 ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary, fontStyle: "italic" }}>
                      No clinical records
                    </ThemedText>
                  ) : null}
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={theme.textSecondary}
                    style={{ marginLeft: "auto" }}
                  />
                </Pressable>
                {isExpanded ? (
                  <View style={[styles.clinicalExpanded, { borderTopColor: theme.border }]}>
                    {cs.conditions.count > 0 ? (
                      <View style={styles.clinicalCategory}>
                        <ThemedText type="caption" style={{ color: "#EF4444", fontWeight: "600", marginBottom: 4 }}>
                          Conditions ({cs.conditions.count})
                        </ThemedText>
                        {renderClinicalDetail(cs.conditions.items, "#EF4444")}
                      </View>
                    ) : null}
                    {cs.medications.count > 0 ? (
                      <View style={styles.clinicalCategory}>
                        <ThemedText type="caption" style={{ color: "#8B5CF6", fontWeight: "600", marginBottom: 4 }}>
                          Medications ({cs.medications.count})
                        </ThemedText>
                        {renderClinicalDetail(cs.medications.items, "#8B5CF6")}
                      </View>
                    ) : null}
                    {cs.allergies.count > 0 ? (
                      <View style={styles.clinicalCategory}>
                        <ThemedText type="caption" style={{ color: "#F59E0B", fontWeight: "600", marginBottom: 4 }}>
                          Allergies ({cs.allergies.count})
                        </ThemedText>
                        {renderClinicalDetail(cs.allergies.items, "#F59E0B")}
                      </View>
                    ) : null}
                    {cs.immunizations.count > 0 ? (
                      <View style={styles.clinicalCategory}>
                        <ThemedText type="caption" style={{ color: "#10B981", fontWeight: "600", marginBottom: 4 }}>
                          Immunizations ({cs.immunizations.count})
                        </ThemedText>
                        {renderClinicalDetail(cs.immunizations.items, "#10B981")}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Card>
    );
  };

  const renderDetailSection = (title: string, icon: keyof typeof Feather.glyphMap, children: React.ReactNode) => (
    <View style={[styles.detailSection, { borderBottomColor: theme.border }]}>
      <View style={styles.detailSectionHeader}>
        <Feather name={icon} size={16} color={theme.primary} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );

  const detail = patientDetail || selectedPatient;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Card elevation={1} style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <View style={styles.searchTitleRow}>
              <Feather name="search" size={20} color={theme.primary} />
              <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Patient Search</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              FHIR R4 Patient resource search with clinical data
            </ThemedText>
          </View>

          <View style={styles.searchField}>
            <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Patient Name
            </ThemedText>
            <TextInput
              testID="input-patient-name"
              style={[styles.input, {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Search by name..."
              placeholderTextColor={theme.textSecondary}
              value={searchName}
              onChangeText={setSearchName}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="words"
            />
          </View>

          <Pressable
            testID="button-toggle-filters"
            style={styles.filterToggle}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Feather name="sliders" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
              {showFilters ? "Hide Filters" : "More Filters"}
            </ThemedText>
            <Feather
              name={showFilters ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.primary}
              style={{ marginLeft: Spacing.xs }}
            />
          </Pressable>

          {showFilters ? (
            <View style={styles.additionalFilters}>
              <View style={styles.searchField}>
                <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Date of Birth
                </ThemedText>
                <TextInput
                  testID="input-patient-dob"
                  style={[styles.input, {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  value={searchDOB}
                  onChangeText={setSearchDOB}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.searchField}>
                <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  MRN / Identifier
                </ThemedText>
                <TextInput
                  testID="input-patient-mrn"
                  style={[styles.input, {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholder="Medical Record Number"
                  placeholderTextColor={theme.textSecondary}
                  value={searchMRN}
                  onChangeText={setSearchMRN}
                />
              </View>

              <View style={styles.searchField}>
                <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Gender
                </ThemedText>
                <View style={styles.chipRow}>
                  {genderOptions.map(opt => (
                    <Pressable
                      key={opt.value}
                      testID={`button-gender-${opt.value || "all"}`}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: searchGender === opt.value ? theme.primary : theme.backgroundSecondary,
                          borderColor: searchGender === opt.value ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setSearchGender(opt.value)}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: searchGender === opt.value ? "#FFFFFF" : theme.text }}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={[styles.sectionDivider, { borderTopColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  Deceased Filters
                </ThemedText>
              </View>

              <View style={styles.searchField}>
                <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Deceased Status
                </ThemedText>
                <View style={styles.chipRow}>
                  {deceasedOptions.map(opt => (
                    <Pressable
                      key={opt.value}
                      testID={`button-deceased-${opt.value || "all"}`}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: searchDeceased === opt.value ? theme.error : theme.backgroundSecondary,
                          borderColor: searchDeceased === opt.value ? theme.error : theme.border,
                        },
                      ]}
                      onPress={() => setSearchDeceased(opt.value)}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: searchDeceased === opt.value ? "#FFFFFF" : theme.text }}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.searchField}>
                <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Date of Death
                </ThemedText>
                <TextInput
                  testID="input-patient-death-date"
                  style={[styles.input, {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholder="YYYY-MM-DD (exact, geYYYY-MM-DD, leYYYY-MM-DD)"
                  placeholderTextColor={theme.textSecondary}
                  value={searchDeathDate}
                  onChangeText={setSearchDeathDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={[styles.sectionDivider, { borderTopColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  Display Options
                </ThemedText>
              </View>

              <Pressable
                testID="button-toggle-clinical"
                style={styles.toggleRow}
                onPress={() => setIncludeClinical(!includeClinical)}
              >
                <Feather
                  name={includeClinical ? "check-square" : "square"}
                  size={18}
                  color={includeClinical ? theme.primary : theme.textSecondary}
                />
                <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>
                  Include clinical summary (Conditions, Medications, Allergies, Immunizations)
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.searchActions}>
            <Pressable
              testID="button-fhir-search"
              style={[styles.searchButton, { backgroundColor: theme.primary }]}
              onPress={handleSearch}
            >
              {isFetching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="search" size={18} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.searchButtonText}>Search</ThemedText>
                </>
              )}
            </Pressable>
            <Pressable
              testID="button-clear"
              style={[styles.clearButton, { borderColor: theme.border }]}
              onPress={handleClear}
            >
              <Feather name="x" size={18} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                Clear
              </ThemedText>
            </Pressable>
          </View>
        </Card>

        {submittedSearch ? (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <ThemedText type="h3">Results</ThemedText>
              {searchResults ? (
                <View style={[styles.countBadge, { backgroundColor: theme.primary + "15" }]}>
                  <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                    {searchResults.total} patient{searchResults.total !== 1 ? "s" : ""}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.toolbarRow}>
              <Pressable
                testID="button-sort-picker"
                style={[styles.toolbarButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowSortPicker(!showSortPicker)}
              >
                <Feather name="bar-chart-2" size={14} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.text, marginLeft: 4 }}>
                  {SORT_OPTIONS.find(o => o.value === sortField)?.label || "Sort"}
                </ThemedText>
                <Feather
                  name={sortDir === "asc" ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={theme.primary}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>

              {includeClinical ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {clinicalFilterOptions.map(opt => (
                    <Pressable
                      key={opt.value}
                      testID={`button-clinical-filter-${opt.value || "all"}`}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: clinicalFilter === opt.value ? theme.primary : theme.backgroundSecondary,
                          borderColor: clinicalFilter === opt.value ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setClinicalFilter(opt.value)}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: clinicalFilter === opt.value ? "#FFFFFF" : theme.text, fontSize: 11 }}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {showSortPicker ? (
              <Card elevation={2} style={styles.sortPickerCard}>
                {SORT_OPTIONS.map(opt => {
                  const isActive = sortField === opt.value;
                  const clinicalOnlySort = ["conditions", "medications", "allergies", "immunizations"].includes(opt.value);
                  if (clinicalOnlySort && !includeClinical) return null;
                  return (
                    <Pressable
                      key={opt.value}
                      testID={`button-sort-${opt.value}`}
                      style={[styles.sortOption, isActive ? { backgroundColor: theme.primary + "10" } : null]}
                      onPress={() => handleSort(opt.value)}
                    >
                      <ThemedText type="small" style={{ color: isActive ? theme.primary : theme.text, fontWeight: isActive ? "600" : "400" }}>
                        {opt.label}
                      </ThemedText>
                      {isActive ? (
                        <Feather
                          name={sortDir === "asc" ? "arrow-up" : "arrow-down"}
                          size={14}
                          color={theme.primary}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </Card>
            ) : null}

            {searchError ? (
              <View style={styles.emptyState}>
                <Feather name="alert-circle" size={48} color={theme.error + "80"} />
                <ThemedText type="body" style={{ color: theme.error, marginTop: Spacing.md, textAlign: "center" }}>
                  Search error
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
                  {(searchError as Error).message}
                </ThemedText>
              </View>
            ) : isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  Searching patients...
                </ThemedText>
              </View>
            ) : filteredEntries.length > 0 ? (
              <>
                <FlatList
                  data={filteredEntries}
                  keyExtractor={(item) => item.resource.id}
                  renderItem={renderPatientRow}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                />

                {totalPages > 1 ? (
                  <View style={styles.pagination}>
                    <Pressable
                      testID="button-prev-page"
                      style={[
                        styles.pageButton,
                        { borderColor: theme.border },
                        currentPage === 0 ? { opacity: 0.4 } : null,
                      ]}
                      onPress={() => {
                        if (currentPage > 0 && submittedSearch) {
                          const newPage = currentPage - 1;
                          setCurrentPage(newPage);
                          setSubmittedSearch({ ...submittedSearch, page: newPage });
                        }
                      }}
                      disabled={currentPage === 0}
                    >
                      <Feather name="chevron-left" size={18} color={theme.text} />
                    </Pressable>

                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Page {currentPage + 1} of {totalPages}
                    </ThemedText>

                    <Pressable
                      testID="button-next-page"
                      style={[
                        styles.pageButton,
                        { borderColor: theme.border },
                        currentPage >= totalPages - 1 ? { opacity: 0.4 } : null,
                      ]}
                      onPress={() => {
                        if (currentPage < totalPages - 1 && submittedSearch) {
                          const newPage = currentPage + 1;
                          setCurrentPage(newPage);
                          setSubmittedSearch({ ...submittedSearch, page: newPage });
                        }
                      }}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <Feather name="chevron-right" size={18} color={theme.text} />
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="users" size={48} color={theme.textSecondary + "40"} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  No patients found
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
                  {clinicalFilter ? "Try removing the clinical filter or adjusting search criteria" : "Try adjusting your search criteria"}
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.textSecondary + "40"} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              Search for patients
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
              Enter a name, date of birth, MRN, or use filters to find patient records
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="h3">Patient Detail</ThemedText>
            <Pressable
              testID="button-close-detail"
              onPress={() => {
                setDetailModalVisible(false);
                setSelectedPatient(null);
              }}
              style={[styles.closeButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {detailLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : detail ? (
              <>
                <View style={styles.patientHeader}>
                  <View style={[styles.largeAvatar, { backgroundColor: (detail.deceasedBoolean ? theme.error : theme.primary) + "20" }]}>
                    <Feather name="user" size={32} color={detail.deceasedBoolean ? theme.error : theme.primary} />
                  </View>
                  <ThemedText type="h2" style={{ marginTop: Spacing.md }}>
                    {detail.name?.[0]?.text || "Unknown"}
                  </ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: detail.active ? theme.success + "20" : theme.error + "20" }]}>
                    <View style={[styles.statusDot, { backgroundColor: detail.active ? theme.success : theme.error }]} />
                    <ThemedText type="caption" style={{ color: detail.active ? theme.success : theme.error, marginLeft: 4 }}>
                      {detail.active ? "Active" : "Inactive"}
                    </ThemedText>
                  </View>
                  {detail.deceasedBoolean || detail.deceasedDateTime ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.error + "15", marginTop: Spacing.xs }]}>
                      <Feather name="x-circle" size={12} color={theme.error} />
                      <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>
                        Deceased{detail.deceasedDateTime ? `: ${detail.deceasedDateTime}` : ""}
                      </ThemedText>
                    </View>
                  ) : null}
                  {detail._profileCompleteness != null ? (
                    <View style={styles.completenessRow}>
                      <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                        <View style={[styles.progressFill, { width: `${detail._profileCompleteness}%`, backgroundColor: theme.primary }]} />
                      </View>
                      <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                        {detail._profileCompleteness}% complete
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                {renderDetailSection("Demographics", "user", (
                  <View style={styles.detailGrid}>
                    <DetailRow label="Full Name" value={detail.name?.[0]?.text} theme={theme} />
                    <DetailRow label="Family Name" value={detail.name?.[0]?.family} theme={theme} />
                    <DetailRow label="Given Name(s)" value={detail.name?.[0]?.given?.join(", ")} theme={theme} />
                    <DetailRow label="Gender" value={detail.gender} theme={theme} />
                    <DetailRow label="Date of Birth" value={detail.birthDate} theme={theme} />
                    {detail.deceasedDateTime ? <DetailRow label="Date of Death" value={detail.deceasedDateTime} theme={theme} /> : null}
                    {detail._bloodType ? <DetailRow label="Blood Type" value={detail._bloodType} theme={theme} /> : null}
                  </View>
                ))}

                {detail._clinicalSummary ? renderDetailSection("Clinical Summary", "clipboard", (
                  <View style={styles.detailGrid}>
                    <DetailRow label="Conditions" value={String(detail._clinicalSummary.conditions.count)} theme={theme} />
                    {detail._clinicalSummary.conditions.items.length > 0 ? (
                      <View style={{ paddingLeft: Spacing.md, marginBottom: Spacing.sm }}>
                        {detail._clinicalSummary.conditions.items.map((item, i) => (
                          <ThemedText key={i} type="caption" style={{ color: theme.textSecondary }}>
                            {item}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                    <DetailRow label="Medications" value={String(detail._clinicalSummary.medications.count)} theme={theme} />
                    {detail._clinicalSummary.medications.items.length > 0 ? (
                      <View style={{ paddingLeft: Spacing.md, marginBottom: Spacing.sm }}>
                        {detail._clinicalSummary.medications.items.map((item, i) => (
                          <ThemedText key={i} type="caption" style={{ color: theme.textSecondary }}>
                            {item}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                    <DetailRow label="Allergies" value={String(detail._clinicalSummary.allergies.count)} theme={theme} />
                    {detail._clinicalSummary.allergies.items.length > 0 ? (
                      <View style={{ paddingLeft: Spacing.md, marginBottom: Spacing.sm }}>
                        {detail._clinicalSummary.allergies.items.map((item, i) => (
                          <ThemedText key={i} type="caption" style={{ color: theme.textSecondary }}>
                            {item}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                    <DetailRow label="Immunizations" value={String(detail._clinicalSummary.immunizations.count)} theme={theme} />
                    {detail._clinicalSummary.immunizations.items.length > 0 ? (
                      <View style={{ paddingLeft: Spacing.md, marginBottom: Spacing.sm }}>
                        {detail._clinicalSummary.immunizations.items.map((item, i) => (
                          <ThemedText key={i} type="caption" style={{ color: theme.textSecondary }}>
                            {item}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )) : null}

                {detail.telecom?.length > 0 ? renderDetailSection("Contact", "phone", (
                  <View style={styles.detailGrid}>
                    {detail.telecom.map((t, i) => (
                      <DetailRow
                        key={i}
                        label={`${t.system}${t.use ? ` (${t.use})` : ""}`}
                        value={t.value}
                        theme={theme}
                      />
                    ))}
                  </View>
                )) : null}

                {detail.address?.length > 0 ? renderDetailSection("Address", "map-pin", (
                  <View style={styles.detailGrid}>
                    {detail.address.map((a, i) => (
                      <DetailRow
                        key={i}
                        label={a.use || "Address"}
                        value={[...(a.line || []), a.city, a.state, a.postalCode].filter(Boolean).join(", ")}
                        theme={theme}
                      />
                    ))}
                  </View>
                )) : null}

                {detail.identifier?.length > 0 ? renderDetailSection("Identifiers", "hash", (
                  <View style={styles.detailGrid}>
                    {detail.identifier.map((id, i) => (
                      <DetailRow key={i} label={id.type} value={id.value} theme={theme} />
                    ))}
                  </View>
                )) : null}

                {detail._emergencyContacts?.length ? renderDetailSection("Emergency Contacts", "alert-circle", (
                  <View style={styles.detailGrid}>
                    {detail._emergencyContacts.map((c, i) => (
                      <View key={i} style={styles.emergencyContact}>
                        <DetailRow label="Name" value={c.name} theme={theme} />
                        <DetailRow label="Phone" value={c.phone} theme={theme} />
                        <DetailRow label="Relationship" value={c.relationship} theme={theme} />
                      </View>
                    ))}
                  </View>
                )) : null}

                {detail._insuranceInfo?.length ? renderDetailSection("Insurance", "shield", (
                  <View style={styles.detailGrid}>
                    {detail._insuranceInfo.map((ins, i) => (
                      <View key={i} style={styles.emergencyContact}>
                        <DetailRow label="Type" value={ins.type} theme={theme} />
                        <DetailRow label="Provider" value={ins.provider} theme={theme} />
                        <DetailRow label="Policy #" value={ins.policyNumber} theme={theme} />
                      </View>
                    ))}
                  </View>
                )) : null}

                {detail._recordCount != null ? renderDetailSection("Records", "file-text", (
                  <DetailRow label="Total Records" value={String(detail._recordCount)} theme={theme} />
                )) : null}

                <View style={styles.fhirIdSection}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    FHIR Resource ID
                  </ThemedText>
                  <View style={[styles.idBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="link" size={12} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4, fontFamily: "monospace" }}>
                      Patient/{detail.id}
                    </ThemedText>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, theme }: { label: string; value?: string | null; theme: any }) {
  if (!value) return null;
  return (
    <View style={detailRowStyles.row}>
      <ThemedText type="caption" style={{ color: theme.textSecondary, width: 110 }}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: Spacing.xs,
    alignItems: "flex-start",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchCard: {
    marginBottom: Spacing.lg,
  },
  searchHeader: {
    marginBottom: Spacing.lg,
  },
  searchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchField: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  additionalFilters: {
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  sectionDivider: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  searchButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  resultsSection: {
    marginTop: Spacing.sm,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  sortPickerCard: {
    marginBottom: Spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  countBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  patientCard: {
    marginBottom: 0,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  patientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  deceasedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  patientMeta: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientContact: {
    marginTop: Spacing.xs,
    gap: 2,
  },
  clinicalSection: {
    marginTop: Spacing.sm,
  },
  clinicalBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  clinicalBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  clinicalExpanded: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  clinicalCategory: {
    marginBottom: Spacing.sm,
  },
  clinicalDetailList: {
    gap: 3,
  },
  clinicalDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  clinicalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 6,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["5xl"],
  },
  patientHeader: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  largeAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completenessRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    width: "80%",
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  detailSection: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  detailGrid: {
    gap: 2,
  },
  emergencyContact: {
    marginBottom: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  fhirIdSection: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
});
