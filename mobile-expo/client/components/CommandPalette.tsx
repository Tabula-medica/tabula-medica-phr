import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Modal,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import * as Haptics from "expo-haptics";

type FeatherIcon = React.ComponentProps<typeof Feather>["name"];

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "navigation" | "action" | "patient" | "setting";
  icon: FeatherIcon;
  screen?: string;
  onAction?: () => void;
  keywords?: string[];
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  navigation: { label: "Navigate", color: "#2196F3" },
  action: { label: "Action", color: "#8B5CF6" },
  patient: { label: "Patient", color: "#10B981" },
  setting: { label: "Setting", color: "#F59E0B" },
};

function buildCommandItems(): CommandItem[] {
  return [
    { id: "home", title: "Home Dashboard", subtitle: "Overview & health summary", category: "navigation", icon: "home", screen: "HomeTab", keywords: ["dashboard", "main"] },
    { id: "timeline", title: "Health Timeline", subtitle: "Chronological health events", category: "navigation", icon: "clock", screen: "TimelineTab", keywords: ["events", "history", "chronological"] },
    { id: "records", title: "Health Records", subtitle: "Browse records by category", category: "navigation", icon: "folder", screen: "RecordsTab", keywords: ["files", "documents", "browse"] },
    { id: "profile", title: "Profile", subtitle: "Account settings & features", category: "navigation", icon: "user", screen: "ProfileTab", keywords: ["account", "me"] },

    { id: "clinical-ai-audit", title: "Clinical AI Audit", subtitle: "Confidence scores & source grounding", category: "navigation", icon: "shield", screen: "ClinicalAiAudit", keywords: ["ai", "confidence", "audit", "gemini", "xai"] },
    { id: "health-dashboard", title: "Health Dashboard", subtitle: "Charts, trends & risk scores", category: "navigation", icon: "activity", screen: "HealthDashboard", keywords: ["analytics", "charts", "trends"] },
    { id: "savings-hub", title: "Savings Hub", subtitle: "Drug coupons & affordable imaging", category: "navigation", icon: "dollar-sign", screen: "SavingsHub", keywords: ["coupons", "drugs", "discount", "cost"] },
    { id: "vital-charts", title: "Vital Signs & Growth", subtitle: "Vitals, BMI & growth charts", category: "navigation", icon: "heart", screen: "VitalCharts", keywords: ["vitals", "bmi", "weight", "blood pressure"] },
    { id: "connect-records", title: "Connect Health Records", subtitle: "Import from 50,000+ systems", category: "navigation", icon: "link", screen: "ConnectHealthRecords", keywords: ["import", "fhir", "ehr", "epic", "cerner"] },
    { id: "medication-tracker", title: "Medication Tracker", subtitle: "Track doses & set reminders", category: "navigation", icon: "thermometer", screen: "MedicationAdherence", keywords: ["meds", "pills", "rx", "prescriptions"] },
    { id: "care-team", title: "Care Team", subtitle: "Your providers & specialists", category: "navigation", icon: "users", screen: "CareTeam", keywords: ["doctors", "providers", "specialists"] },
    { id: "appointments", title: "Appointments", subtitle: "Schedule & manage visits", category: "navigation", icon: "calendar", screen: "AppointmentScheduling", keywords: ["schedule", "visit", "booking"] },
    { id: "lab-results", title: "Lab Results", subtitle: "View lab work & test results", category: "navigation", icon: "file-text", screen: "LabResults", keywords: ["labs", "blood", "tests", "panels"] },
    { id: "safety-alerts", title: "Health Alerts", subtitle: "Drug interactions & recalls", category: "navigation", icon: "alert-triangle", screen: "SafetyAlerts", keywords: ["alerts", "warnings", "interactions", "recalls"] },
    { id: "secure-messaging", title: "Secure Messages", subtitle: "Message your care team", category: "navigation", icon: "message-square", screen: "SecureMessaging", keywords: ["chat", "message", "inbox"] },
    { id: "preventive-care", title: "Preventive Care", subtitle: "Screenings & vaccinations", category: "navigation", icon: "check-circle", screen: "PreventiveCare", keywords: ["screening", "vaccines", "immunization", "wellness"] },
    { id: "family-hub", title: "My Family", subtitle: "Family member records", category: "navigation", icon: "users", screen: "FamilyHub", keywords: ["family", "dependents", "children", "spouse"] },
    { id: "annual-review", title: "Annual Health Review", subtitle: "Yearly care team review", category: "navigation", icon: "clipboard", screen: "AnnualReview", keywords: ["annual", "yearly", "review", "checkup"] },
    { id: "pre-visit", title: "Pre-Visit Summary", subtitle: "Prepare for your appointment", category: "navigation", icon: "file-plus", screen: "PreVisitSummary", keywords: ["visit", "prepare", "summary"] },
    { id: "post-visit", title: "Post-Visit Summary", subtitle: "AI summary with action items", category: "navigation", icon: "file-minus", screen: "PostVisitSummary", keywords: ["visit", "followup", "summary"] },
    { id: "claims-eob", title: "Claims & Benefits", subtitle: "Insurance claims & EOB tracker", category: "navigation", icon: "credit-card", screen: "InsuranceClaimsEOB", keywords: ["insurance", "claims", "eob", "billing", "copay"] },
    { id: "card-scan", title: "Card Scanner", subtitle: "Scan insurance & pharmacy cards (BIN/PCN)", category: "navigation", icon: "camera", screen: "CardScan", keywords: ["scan", "card", "insurance", "bin", "pcn", "pharmacy", "ocr", "photo"] },
    { id: "womens-health", title: "Women's Health", subtitle: "Cycle tracking & wellness", category: "navigation", icon: "heart", screen: "WomensHealth", keywords: ["womens", "fertility", "menstrual", "reproductive"] },
    { id: "fertility-cycle", title: "Fertility & Cycle", subtitle: "Cycle optimization dashboard", category: "navigation", icon: "sunrise", screen: "FertilityCycleDashboard", keywords: ["fertility", "ovulation", "cycle"] },
    { id: "menopausal", title: "Menopausal Resilience", subtitle: "Menopause management tools", category: "navigation", icon: "sun", screen: "MenopausalResilience", keywords: ["menopause", "hrt", "perimenopause"] },
    { id: "education-hub", title: "Learning Center", subtitle: "Health education articles", category: "navigation", icon: "book-open", screen: "EducationHub", keywords: ["education", "articles", "learn", "library"] },
    { id: "community", title: "Community", subtitle: "Connect with others", category: "navigation", icon: "globe", screen: "Community", keywords: ["community", "social", "forum"] },
    { id: "telehealth", title: "Telehealth", subtitle: "Video consultations", category: "navigation", icon: "video", screen: "Telehealth", keywords: ["video", "call", "virtual", "telemedicine"] },
    { id: "ai-assistant", title: "AI Health Assistant", subtitle: "Ask questions about your health", category: "navigation", icon: "cpu", screen: "AIAssistant", keywords: ["ai", "chatbot", "assistant", "ask"] },
    { id: "ask-data", title: "Ask Your Data", subtitle: "Natural language health queries", category: "navigation", icon: "search", screen: "NaturalLanguageQuery", keywords: ["search", "query", "nlp", "ask"] },

    { id: "tefca-hub", title: "TEFCA Hub", subtitle: "National exchange network", category: "navigation", icon: "globe", screen: "TEFCAHub", keywords: ["tefca", "exchange", "qhin", "interop"] },
    { id: "tefca-partners", title: "TEFCA Partners", subtitle: "Partner management", category: "navigation", icon: "briefcase", screen: "TEFCAPartnerManagement", keywords: ["partners", "qhin"] },
    { id: "provider-dashboard", title: "Provider Dashboard", subtitle: "Clinical workflow overview", category: "navigation", icon: "monitor", screen: "ProviderDashboard", keywords: ["provider", "clinical", "workflow"] },
    { id: "audit-log", title: "Audit Log", subtitle: "System activity log", category: "navigation", icon: "list", screen: "AuditLog", keywords: ["audit", "log", "activity", "security"] },
    { id: "consent-management", title: "Data Permissions", subtitle: "Manage consent & sharing", category: "navigation", icon: "lock", screen: "ConsentManagement", keywords: ["consent", "permissions", "privacy", "sharing"] },
    { id: "trust-security", title: "Trust & Security", subtitle: "Security settings & compliance", category: "navigation", icon: "shield", screen: "Trust", keywords: ["security", "trust", "compliance", "hipaa"] },
    { id: "compliance-alerts", title: "Compliance Monitoring", subtitle: "HIPAA & SOC2 compliance", category: "navigation", icon: "alert-circle", screen: "ComplianceAlerts", keywords: ["compliance", "hipaa", "soc2", "hitrust"] },
    { id: "analytics", title: "AI Analytics", subtitle: "Charts, trends & risk scores", category: "navigation", icon: "bar-chart-2", screen: "AnalyticsDashboard", keywords: ["analytics", "charts", "trends", "risk"] },
    { id: "platform-analytics", title: "Platform Analytics", subtitle: "Enterprise usage metrics", category: "navigation", icon: "trending-up", screen: "EnterprisePlatformAnalytics", keywords: ["enterprise", "analytics", "metrics", "usage"] },
    { id: "settings", title: "Settings", subtitle: "App preferences & configuration", category: "setting", icon: "settings", screen: "UserSettings", keywords: ["preferences", "config", "options"] },
    { id: "share-records", title: "Share Records", subtitle: "Share with providers or family", category: "navigation", icon: "share-2", screen: "Share", keywords: ["share", "export", "send"] },
    { id: "qr-share", title: "QR Share", subtitle: "Share via QR code", category: "navigation", icon: "maximize", screen: "QRShare", keywords: ["qr", "code", "scan", "share"] },

    { id: "patient-search", title: "Patient Search", subtitle: "Find patient records via FHIR", category: "patient", icon: "search", screen: "FHIRPatientSearch", keywords: ["patient", "search", "find", "lookup"] },
    { id: "patient-profile", title: "My Profile", subtitle: "Personal & demographic info", category: "patient", icon: "user", screen: "PatientProfile", keywords: ["demographics", "personal", "info"] },
    { id: "health-record", title: "My Health Record", subtitle: "Consolidated PHR", category: "patient", icon: "file", screen: "ConsolidatedPHR", keywords: ["phr", "record", "consolidated"] },
    { id: "health-goals", title: "Health Goals", subtitle: "Track objectives & mood", category: "patient", icon: "target", screen: "HealthGoals", keywords: ["goals", "objectives", "targets", "tracking"] },

    { id: "npi-lookup", title: "NPI Provider Lookup", subtitle: "Search the CMS NPI Registry", category: "action", icon: "hash", screen: "SmartNpiLookup", keywords: ["npi", "provider", "registry", "lookup", "doctor", "nurse", "pharmacy", "organization", "cms"] },
    { id: "baa-agreements", title: "BAA Agreements", subtitle: "Track Business Associate Agreements", category: "action", icon: "file-plus", screen: "BaaAgreements", keywords: ["baa", "business", "associate", "agreement", "hipaa", "compliance", "partner", "document"] },
    { id: "compliance-export", title: "Compliance Export", subtitle: "Encrypted PDF/CSV export of audit & TEFCA data", category: "action", icon: "download", screen: "ComplianceExport", keywords: ["compliance", "export", "encrypted", "pdf", "csv", "audit", "tefca", "hipaa", "download"] },
    { id: "network-health", title: "Network Health", subtitle: "Real-time partner endpoint status dashboard", category: "action", icon: "activity", screen: "NetworkHealth", keywords: ["network", "health", "status", "endpoint", "partner", "tefca", "qhin", "traffic", "light", "latency", "uptime", "monitoring"] },
    { id: "fhir-viewer", title: "FHIR R4 Viewer", subtitle: "View patient FHIR R4 data via TEFCA exchange", category: "action", icon: "file-text", screen: "FhirViewer", keywords: ["fhir", "r4", "viewer", "patient", "data", "tefca", "conditions", "medications", "observations", "health", "records", "uscdi"] },
    { id: "soc2-compliance", title: "SOC 2 Compliance", subtitle: "Continuous compliance monitoring dashboard", category: "action", icon: "shield", screen: "Soc2Compliance", keywords: ["soc", "2", "compliance", "audit", "evidence", "trust", "service", "criteria", "controls", "security", "report", "monitoring"] },
    { id: "fhir-data-hub", title: "API Data Hub", subtitle: "Manage partner app FHIR data access & scopes", category: "navigation", icon: "globe", screen: "FhirDataHub", keywords: ["fhir", "api", "data", "hub", "partner", "oauth", "scopes", "access", "log"] },
    { id: "audit-analytics", title: "Audit Analytics", subtitle: "PHI access heatmaps, anomaly detection, and alerts", category: "action", icon: "bar-chart-2", screen: "AdminAuditVisualization", keywords: ["admin", "audit", "analytics", "visualization", "heatmap", "anomaly", "detection", "alerts", "access", "patterns", "phi"] },
    { id: "action-export", title: "Export Health Packet", subtitle: "Download records as PDF/FHIR", category: "action", icon: "download", screen: "PacketExport", keywords: ["export", "download", "pdf", "fhir"] },
    { id: "action-document", title: "Generate Document", subtitle: "Create medical documents", category: "action", icon: "edit-3", screen: "DocumentGeneration", keywords: ["document", "generate", "create", "letter"] },
    { id: "action-soap", title: "AI SOAP Note", subtitle: "Generate clinical notes", category: "action", icon: "edit", screen: "AISOAPNote", keywords: ["soap", "note", "clinical", "encounter"] },
    { id: "action-ambient", title: "Visit Recording", subtitle: "Record & transcribe encounters", category: "action", icon: "mic", screen: "AmbientEncounter", keywords: ["record", "ambient", "transcribe", "encounter"] },
  ];
}

const TAB_SCREENS: string[] = ["HomeTab", "TimelineTab", "RecordsTab", "ProfileTab"];
const ROOT_SCREENS: string[] = ["AIAssistant"];

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  navigationRef: NavigationContainerRefWithCurrent<any>;
}

export function CommandPalette({ visible, onClose, navigationRef }: CommandPaletteProps) {
  const { theme: colors } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const items = useMemo(() => buildCommandItems(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15);
    const q = query.toLowerCase();
    return items.filter((item) => {
      const searchable = [item.title, item.subtitle || "", ...(item.keywords || [])].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [query, items]);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    setSelectedIndex(filtered.length > 0 ? 0 : -1);
  }, [query, filtered.length]);

  const executeCommand = useCallback((item: CommandItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();

    if (item.onAction) {
      item.onAction();
      return;
    }

    if (!item.screen || !navigationRef.isReady()) return;

    const nav = navigationRef as any;
    if (TAB_SCREENS.includes(item.screen)) {
      nav.navigate("Main", { screen: item.screen });
    } else if (ROOT_SCREENS.includes(item.screen)) {
      nav.navigate(item.screen);
    } else {
      nav.navigate("Main", {
        screen: "ProfileTab",
        params: { screen: item.screen },
      });
    }
  }, [navigationRef, onClose]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e.nativeEvent?.key;
    if (key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault?.();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (key === "ArrowUp" && filtered.length > 0) {
      e.preventDefault?.();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (key === "Enter" && selectedIndex >= 0 && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    } else if (key === "Escape") {
      onClose();
    }
  }, [filtered, selectedIndex, executeCommand, onClose]);

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < filtered.length && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index: selectedIndex, animated: true, viewOffset: 60 });
      } catch {}
    }
  }, [selectedIndex, filtered.length]);

  const renderItem = useCallback(({ item, index }: { item: CommandItem; index: number }) => {
    const isSelected = index === selectedIndex;
    const cat = CATEGORIES[item.category];
    return (
      <Pressable
        testID={`cmd-item-${item.id}`}
        style={[
          styles.item,
          { backgroundColor: isSelected ? colors.primary + "12" : "transparent" },
          isSelected && { borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
        onPress={() => executeCommand(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle || ""}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[styles.iconContainer, { backgroundColor: cat.color + "15" }]}>
          <Feather name={item.icon} size={18} color={cat.color} />
        </View>
        <View style={styles.itemContent}>
          <ThemedText style={[styles.itemTitle, { color: colors.text }]}>{item.title}</ThemedText>
          {item.subtitle ? (
            <ThemedText style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</ThemedText>
          ) : null}
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: cat.color + "15" }]}>
          <ThemedText style={[styles.categoryText, { color: cat.color }]}>{cat.label}</ThemedText>
        </View>
      </Pressable>
    );
  }, [selectedIndex, colors, executeCommand]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View
          style={[styles.palette, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}
        >
          <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
            <Feather name="search" size={20} color={colors.textSecondary} />
            <TextInput
              ref={inputRef}
              testID="cmd-search-input"
              style={[styles.input, { color: colors.text }]}
              placeholder="Search commands, screens, features..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              onKeyPress={handleKeyPress}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => {
                if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]);
              }}
            />
            <Pressable
              testID="cmd-close-btn"
              onPress={onClose}
              style={[styles.escBadge, { backgroundColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Close command palette"
            >
              <ThemedText style={[styles.escText, { color: colors.textSecondary }]}>ESC</ThemedText>
            </Pressable>
          </View>

          {filtered.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              getItemLayout={(_, index) => ({ length: 60, offset: 60 * index, index })}
            />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="search" size={32} color={colors.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No results for "{query}"
              </ThemedText>
            </View>
          )}

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.footerHints}>
              <View style={styles.hintGroup}>
                <View style={[styles.keyBadge, { backgroundColor: colors.border }]}>
                  <ThemedText style={[styles.keyText, { color: colors.textSecondary }]}>↑↓</ThemedText>
                </View>
                <ThemedText style={[styles.hintLabel, { color: colors.textSecondary }]}>navigate</ThemedText>
              </View>
              <View style={styles.hintGroup}>
                <View style={[styles.keyBadge, { backgroundColor: colors.border }]}>
                  <ThemedText style={[styles.keyText, { color: colors.textSecondary }]}>↵</ThemedText>
                </View>
                <ThemedText style={[styles.hintLabel, { color: colors.textSecondary }]}>select</ThemedText>
              </View>
              <View style={styles.hintGroup}>
                <View style={[styles.keyBadge, { backgroundColor: colors.border }]}>
                  <ThemedText style={[styles.keyText, { color: colors.textSecondary }]}>esc</ThemedText>
                </View>
                <ThemedText style={[styles.hintLabel, { color: colors.textSecondary }]}>close</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.resultCount, { color: colors.textSecondary }]}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpen]);
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 80,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  palette: {
    width: "90%",
    maxWidth: 640,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    maxHeight: 500,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 25px 50px rgba(0,0,0,0.25)" },
      default: { elevation: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 },
    }),
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  escBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  escText: {
    fontSize: 11,
    fontWeight: "600",
  },
  list: {
    maxHeight: 360,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    height: 60,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  footerHints: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  hintGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  keyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keyText: {
    fontSize: 11,
    fontWeight: "600",
  },
  hintLabel: {
    fontSize: 11,
  },
  resultCount: {
    fontSize: 11,
  },
});
