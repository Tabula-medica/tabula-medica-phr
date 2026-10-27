import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Switch,
  Platform,
  Linking,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import * as MailComposer from "expo-mail-composer";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { api, getUserId } from "@/lib/api";
import { useAccessibility, FONT_SIZE_LABELS, type FontSizeLevel } from "@/context/AccessibilityContext";
import { useLanguage } from "@/context/LanguageContext";

interface AppSettings {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  autoSyncEnabled: boolean;
}

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
  theme: typeof Colors.light;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  danger,
  theme,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { opacity: pressed && onPress ? 0.7 : 1 },
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={danger ? "This is a destructive action" : undefined}
    >
      <View
        style={[
          styles.settingsIcon,
          {
            backgroundColor: danger
              ? `${theme.error}15`
              : `${theme.primary}15`,
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={danger ? theme.error : theme.primary}
        />
      </View>
      <View style={styles.settingsContent}>
        <ThemedText
          type="body"
          style={{ color: danger ? theme.error : theme.text }}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement ? (
        rightElement
      ) : onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

function SettingsSection({
  title,
  children,
  theme,
  isDark,
  index,
}: {
  title: string;
  children: React.ReactNode;
  theme: typeof Colors.light;
  isDark: boolean;
  index: number;
}) {
  return (
    <Animated.View 
      entering={FadeInDown.delay(100 + index * 50).springify()}
      style={styles.section}
    >
      <ThemedText
        type="caption"
        style={[styles.sectionTitle, { color: theme.textSecondary }]}
        accessibilityRole="header"
      >
        {title.toUpperCase()}
      </ThemedText>
      <View
        style={[
          styles.sectionContent, 
          { 
            backgroundColor: theme.backgroundDefault,
            ...Shadows.glass,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

interface MenuItem {
  group: "health" | "care" | "security" | "settings" | "deepdive";
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  screen?: string;
  searchTerms: string;
}

const MENU_ITEMS: MenuItem[] = [
  { group: "health", icon: "refresh-cw", title: "Annual Health Review", subtitle: "Review your care team and pharmacy choices", screen: "AnnualReview", searchTerms: "annual review yearly care team pharmacy provider doctor update" },
  { group: "health", icon: "layers", title: "Complete Health Timeline", subtitle: "Unified chronological view of all your health events", screen: "UnifiedHealthSummary", searchTerms: "timeline chronological summary unified complete health history all events" },
  { group: "health", icon: "clipboard", title: "Pre-Visit Summary", subtitle: "AI review of symptoms before your appointment", screen: "PreVisitSummary", searchTerms: "pre visit summary review symptoms appointment prepare questions" },
  { group: "health", icon: "file-text", title: "Post-Visit Summary", subtitle: "Record visit and get AI summary with action items", screen: "PostVisitSummary", searchTerms: "post visit summary recording transcript notes action items todo follow up" },
  { group: "health", icon: "link", title: "Connect Records", subtitle: "Import from 50,000+ health systems", screen: "ConnectHealthRecords", searchTerms: "connect records import fasten health tefca ehr provider hospital data sources connections" },
  { group: "health", icon: "file-text", title: "My Health Record", subtitle: "Consolidated health record", screen: "ConsolidatedPHR", searchTerms: "health record phr medical records" },
  { group: "health", icon: "user", title: "My Profile", subtitle: "Personal and demographic info", screen: "PatientProfile", searchTerms: "profile personal info demographics" },
  { group: "health", icon: "heart", title: "Medication Tracker", subtitle: "Track doses and set reminders", screen: "MedicationAdherence", searchTerms: "medication tracker doses reminders adherence pills" },
  { group: "health", icon: "calendar", title: "Appointments", subtitle: "Schedule and manage visits", screen: "AppointmentScheduling", searchTerms: "appointments schedule calendar booking" },
  { group: "health", icon: "trending-up", title: "Vital Signs", subtitle: "Trends, charts, and growth data", screen: "VitalCharts", searchTerms: "vital signs growth charts blood pressure weight" },
  { group: "health", icon: "target", title: "Goals & Journal", subtitle: "Track objectives, symptoms, and mood", screen: "HealthGoals", searchTerms: "health goals objectives targets wellness journal symptoms mood diary notes" },
  { group: "health", icon: "activity", title: "Lab Results", subtitle: "View lab work and test results", screen: "LabResults", searchTerms: "lab results tests blood work" },
  { group: "health", icon: "dollar-sign", title: "Savings Hub", subtitle: "Drug coupons and affordable imaging", screen: "SavingsHub", searchTerms: "savings coupons discounts drug medication radiology imaging affordable cost" },
  { group: "health", icon: "credit-card", title: "Claims & Benefits", subtitle: "Insurance claims, EOB, copay, and deductible tracker", screen: "InsuranceClaimsEOB", searchTerms: "insurance claims EOB explanation benefits copay deductible coinsurance out of pocket cost tracker billing" },
  { group: "health", icon: "book-open", title: "Insurance Navigator", subtitle: "Learn copays, deductibles, networks, and prior auth", screen: "InsuranceLearning", searchTerms: "insurance learning copay deductible out of network prior authorization referral coinsurance animated education" },
  { group: "health", icon: "heart", title: "Direct Access (Uninsured)", subtitle: "Medicare-rate healthcare for uninsured patients", screen: "UninsuredPlatform", searchTerms: "uninsured no insurance direct access medicare rates CPT code discount affordable healthcare signup" },
  { group: "health", icon: "dollar-sign", title: "Rate Calculator", subtitle: "2026 Medicare PFS rate lookup by CPT code", screen: "RateCalculator", searchTerms: "rate calculator medicare CPT code price lookup physician fee schedule RVU conversion factor cost" },
  { group: "health", icon: "search", title: "Find a Provider", subtitle: "HRSA clinic finder + network providers", screen: "ProviderSearch", searchTerms: "provider search HRSA FQHC clinic find doctor community health center sliding scale" },
  { group: "health", icon: "calendar", title: "Book Appointment", subtitle: "Schedule visit with payment lane selection", screen: "Booking", searchTerms: "book appointment schedule visit payment lane self-pay VA veteran community care" },
  { group: "health", icon: "flag", title: "VA Verification", subtitle: "Verify VA Community Care referral", screen: "VAVerification", searchTerms: "VA veteran community care referral verification optum CCN lane B military" },
  { group: "health", icon: "compass", title: "Care Access", subtitle: "Free clinics, Medicaid check, drug savings, mental health", screen: "CareAccess", searchTerms: "care access free clinic FQHC medicaid CHIP eligibility drug savings GoodRx behavioral mental health SAMHSA uninsured underinsured sliding scale" },
  { group: "health", icon: "file-text", title: "Prior Authorization", subtitle: "Generate PA letters from your health record", screen: "PriorAuth", searchTerms: "prior authorization PA pre-approval insurance denial appeal letter medication coverage drug cost" },
  { group: "health", icon: "alert-triangle", title: "Drug Interactions", subtitle: "FDA interaction check for your medications", screen: "DrugInteractions", searchTerms: "drug interaction medication safety FDA openFDA contraindication warning pharmacy" },
  { group: "health", icon: "activity", title: "Health Screenings", subtitle: "USPSTF preventive screenings for your age", screen: "CareGaps", searchTerms: "care gap screening preventive USPSTF mammogram colonoscopy Pap blood pressure diabetes cholesterol depression overdue" },
  { group: "health", icon: "smile", title: "Dental Records", subtitle: "Open Dental practice integration", screen: "OpenDental", searchTerms: "dental records open dental teeth tooth crown cleaning prophylaxis periodontal xray radiograph filling cavity treatment plan CDT procedure oral hygiene dentist" },
  { group: "health", icon: "smile", title: "Dentrix Records", subtitle: "Henry Schein Dentrix integration", screen: "Dentrix", searchTerms: "dentrix henry schein dental practice management teeth tooth crown cleaning prophylaxis periodontal xray radiograph filling cavity treatment plan CDT procedure endodontic root canal clinical notes" },
  { group: "health", icon: "smile", title: "Eaglesoft Records", subtitle: "Patterson Eaglesoft integration", screen: "Eaglesoft", searchTerms: "eaglesoft patterson dental practice management teeth implant composite crown cleaning prophylaxis periodontal xray CBCT radiograph treatment plan CDT procedure ledger account balance insurance coverage" },

  { group: "care", icon: "message-circle", title: "Messages", subtitle: "Secure provider messaging", screen: "SecureMessaging", searchTerms: "secure messaging encrypted chat provider sms" },
  { group: "care", icon: "heart", title: "Care Team", subtitle: "Your healthcare providers", screen: "CareTeam", searchTerms: "care team providers doctors nurses" },
  { group: "care", icon: "video", title: "Telehealth", subtitle: "Virtual consultations", screen: "Telehealth", searchTerms: "telehealth virtual video consultation visit" },
  { group: "care", icon: "compass", title: "Care Pathways", subtitle: "Guided care plans", screen: "CarePathways", searchTerms: "care pathways plans guided treatment" },
  { group: "care", icon: "book-open", title: "Learning Center", subtitle: "Health education and articles", screen: "EducationHub", searchTerms: "education library learning resources articles" },
  { group: "care", icon: "globe", title: "Community", subtitle: "Health forums and challenges", screen: "Community", searchTerms: "community forums health groups support team challenges" },
  { group: "care", icon: "check-circle", title: "Preventive Care", subtitle: "USPSTF screenings, vaccinations, and age-based guidelines", screen: "PreventiveCare", searchTerms: "preventive care screening USPSTF vaccination immunization colonoscopy mammogram PSA pap smear cholesterol calcium score bone density DEXA lung cancer hepatitis HIV flu shot shingles HPV age guidelines" },
  { group: "care", icon: "heart", title: "Women's Health", subtitle: "Pregnancy, screenings, and reproductive care", screen: "WomensHealth", searchTerms: "womens health pregnancy prenatal postpartum menstrual cycle fertility menopause screening mammography pap smear reproductive" },
  { group: "care", icon: "target", title: "Fertility & Cycle", subtitle: "MIRA hormone tracking, cycle optimization, and provider sharing", screen: "FertilityCycleDashboard", searchTerms: "fertility cycle ovulation MIRA hormone LH estrogen progesterone FSH BBT basal body temperature fertile window luteal phase tracking conception pregnancy planning provider coaching" },
  { group: "care", icon: "sun", title: "Menopausal Resilience", subtitle: "Hormone tracking, resilience scoring, bone density, ApoB, sleep, and provider counseling", screen: "MenopausalResilience", searchTerms: "menopause perimenopause resilience score estradiol progesterone testosterone thyroid TSH bone density DEXA muscle mass sarcopenia ApoB cardiovascular sleep efficiency HRT hormone replacement therapy provider counseling remediation" },
  { group: "care", icon: "eye", title: "Dermatology", subtitle: "Skin health and condition reference", screen: "Dermatology", searchTerms: "dermatology skin conditions eczema psoriasis acne melanoma rash rosacea vitiligo fungal UV sunscreen ABCDE mole" },
  { group: "care", icon: "code", title: "Genetic Screening", subtitle: "Newborn disease screening protocols", screen: "GeneticScreening", searchTerms: "genetic screening newborn RUSP PKU sickle cell cystic fibrosis SMA SCID thalassemia G6PD metabolic hereditary" },
  { group: "care", icon: "users", title: "My Family", subtitle: "Add and manage family members' health data", screen: "FamilyHub", searchTerms: "family members hub children parents spouse dependent caregiver onboarding add manage guardian minor" },
  { group: "care", icon: "sun", title: "Family Care", subtitle: "Prenatal, newborn, and family health", screen: "PrenatalGuidelines", searchTerms: "prenatal care pregnancy guidelines trimester screening newborn tests baby infant RUSP metabolic family" },

  { group: "security", icon: "shield", title: "Trust & Security", subtitle: "Biometrics, encryption, and settings", screen: "Trust", searchTerms: "trust security settings encryption biometric authentication face id fingerprint" },
  { group: "security", icon: "user-check", title: "Consent Management", subtitle: "Manage data sharing permissions", screen: "ConsentManagement", searchTerms: "consent management data sharing permissions" },
  { group: "security", icon: "file-text", title: "Privacy Policy", subtitle: "Updated Feb 2026", screen: "PrivacyPractices", searchTerms: "privacy policy practices data protection" },
  { group: "security", icon: "clipboard", title: "Audit Log", subtitle: "Access and activity history", screen: "AuditLog", searchTerms: "audit log access activity history compliance" },
  { group: "security", icon: "file-plus", title: "BAA Agreements", subtitle: "Track signed BAA documents", screen: "BaaAgreements", searchTerms: "baa business associate agreement hipaa compliance partner document" },
  { group: "security", icon: "download", title: "Compliance Export", subtitle: "Encrypted PDF/CSV export of audit & TEFCA data", screen: "ComplianceExport", searchTerms: "compliance export encrypted pdf csv audit tefca hipaa download" },
  { group: "security", icon: "activity", title: "Network Health", subtitle: "Real-time partner endpoint status", screen: "NetworkHealth", searchTerms: "network health status endpoint partner tefca qhin traffic light latency uptime monitoring" },
  { group: "security", icon: "file-text", title: "FHIR R4 Viewer", subtitle: "View patient data via TEFCA exchange", screen: "FhirViewer", searchTerms: "fhir r4 viewer patient data tefca conditions medications observations health records uscdi" },
  { group: "security", icon: "shield", title: "SOC 2 Compliance", subtitle: "Continuous compliance monitoring dashboard", screen: "Soc2Compliance", searchTerms: "soc 2 compliance audit evidence trust service criteria controls security availability monitoring report" },
  { group: "security", icon: "globe", title: "API Data Hub", subtitle: "Manage partner app access to your FHIR data", screen: "FhirDataHub", searchTerms: "fhir api data hub partner apps oauth scopes access log" },
  { group: "security", icon: "bar-chart-2", title: "Audit Analytics", subtitle: "PHI access heatmaps, anomaly detection, and alerts", screen: "AdminAuditVisualization", searchTerms: "admin audit analytics visualization heatmap anomaly detection alerts access patterns phi" },

  { group: "settings", icon: "settings", title: "Account Settings", subtitle: "Profile, preferences, and sync", screen: "UserSettings", searchTerms: "account settings profile preferences notifications privacy consent data sources auto sync automatic synchronization" },
  { group: "settings", icon: "bell", title: "Notifications & Reminders", subtitle: "Alerts, push notifications, and schedules", searchTerms: "notifications push alerts reminders medication appointment scheduling" },
  { group: "settings", icon: "share-2", title: "Share & Export", subtitle: "Share records, QR codes, and exports", screen: "Share", searchTerms: "share records providers family export qr code packet pdf download" },

  { group: "settings", icon: "watch", title: "Connected Devices", subtitle: "Wearables and health devices", screen: "DeviceManagement", searchTerms: "connected devices wearables fitbit apple watch" },
  { group: "settings", icon: "mail", title: "Feedback & Suggestions", subtitle: "Send feedback to info@tabulamedica.digital", screen: "__feedback__", searchTerms: "feedback suggestions contact email support help" },
  ...(process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === "true"
    ? ([
        { group: "settings", icon: "credit-card", title: "Subscription", subtitle: "Manage your plan and billing", screen: "Subscription", searchTerms: "subscription plan billing pricing upgrade downgrade trial professional enterprise government free basic" },
        { group: "settings", icon: "award", title: "Upgrade to Pro", subtitle: "AI Deduplication, IMLC, MHMDA Compliance", screen: "Paywall", searchTerms: "pro upgrade paywall professional premium subscription purchase buy" },
      ] satisfies MenuItem[])
    : ([] as MenuItem[])),

  { group: "deepdive", icon: "cpu", title: "AI Health Assistant", subtitle: "Insights, follow-ups, and smart alerts", screen: "ClinicalWorkflow", searchTerms: "clinical workflow ai follow-up suggestions notes alerts smart documentation chart intelligence" },
  { group: "deepdive", icon: "shield", title: "Clinical AI Audit", subtitle: "AI confidence, source grounding & verification", screen: "ClinicalAiAudit", searchTerms: "clinical ai audit confidence explainability source grounding verification rlhf" },
  { group: "deepdive", icon: "bar-chart-2", title: "Analytics", subtitle: "Charts, trends, and risk scores", screen: "AnalyticsDashboard", searchTerms: "health analytics statistics advanced data trends patterns chart intelligence risk" },
  { group: "deepdive", icon: "search", title: "Ask Your Data", subtitle: "Natural language health queries", screen: "NaturalLanguageQuery", searchTerms: "natural language query search ask question ai history assistant" },
  { group: "deepdive", icon: "alert-triangle", title: "Safety Alerts", subtitle: "Drug interactions and recalls", screen: "SafetyAlerts", searchTerms: "safety alerts drug recall fda warnings interactions" },
  { group: "deepdive", icon: "file-plus", title: "Generate Document", subtitle: "AI-powered health documents", screen: "DocumentGeneration", searchTerms: "document generation referral letter summary lab report medication ai clinical" },
  { group: "deepdive", icon: "layout", title: "Provider Tools", subtitle: "Dashboard, tasks, and collaboration", screen: "ProviderDashboard", searchTerms: "provider dashboard overview clinical tasks collaboration automations workflow" },
  { group: "deepdive", icon: "link", title: "Integrations", subtitle: "FHIR, TEFCA, and connections", screen: "Interoperability", searchTerms: "interoperability fhir connections smart apps enterprise ehr tefca qhin partner" },
  { group: "deepdive", icon: "hash", title: "NPI Provider Lookup", subtitle: "Search the CMS NPI Registry", screen: "SmartNpiLookup", searchTerms: "npi provider lookup search registry cms partner autofill doctor nurse pharmacy organization" },
  { group: "deepdive", icon: "trending-up", title: "Platform Analytics", subtitle: "Population health, cost savings, and ACO quality", screen: "EnterprisePlatformAnalytics", searchTerms: "enterprise platform analytics population health cost savings duplicate testing ACO quality HEDIS MSSP shared savings insurance" },
  { group: "deepdive", icon: "bar-chart", title: "ROI Tracker", subtitle: "Internal waste, AI accuracy, and time savings", screen: "ROITracker", searchTerms: "roi tracker return investment waste monitor duplicate savings ai accuracy time saved demo report HIMSS sales benchmark ghost savings data integrity" },
  { group: "deepdive", icon: "file-text", title: "Document Verification", subtitle: "Multi-model extraction, HITL review, and benchmarking", screen: "DocumentVerification", searchTerms: "document verification extraction multi-model voting consensus HITL review audit trail golden dataset benchmark CER WER accuracy clinical range validation OCR quality gate" },
];

const GROUP_CONFIG = {
  health: { icon: "heart" as keyof typeof Feather.glyphMap, title: "My Health", color: "" },
  care: { icon: "users" as keyof typeof Feather.glyphMap, title: "Care & Support", color: "#0ea5e9" },
  security: { icon: "shield" as keyof typeof Feather.glyphMap, title: "Privacy & Security", color: "#22c55e" },
  settings: { icon: "settings" as keyof typeof Feather.glyphMap, title: "Settings", color: "#8b5cf6" },
  deepdive: { icon: "cpu" as keyof typeof Feather.glyphMap, title: "AI & Advanced Tools", color: "#f59e0b" },
} as const;

function GroupHeader({ 
  icon, title, count, isExpanded, onPress, color, theme 
}: { 
  icon: keyof typeof Feather.glyphMap;
  title: string;
  count: number;
  isExpanded: boolean;
  onPress: () => void;
  color: string;
  theme: typeof Colors.light;
}) {
  return (
    <Pressable 
      onPress={onPress}
      style={[styles.groupHeader, { backgroundColor: theme.backgroundDefault }]}
      testID={`group-${title.toLowerCase().replace(/\s/g, '-')}`}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} items`}
      accessibilityState={{ expanded: isExpanded }}
      accessibilityHint={isExpanded ? "Double tap to collapse" : "Double tap to expand"}
    >
      <View style={[styles.groupIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>{title}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{count} items</ThemedText>
      </View>
      <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user, signOut } = useAuthContext();
  const navigation = useNavigation<any>();
  const { settings: accessibilitySettings, viewMode, setViewMode, toggleSimplifiedMode, toggleLargeText, toggleHighContrast, toggleReducedMotion, toggleReadAloud, setFontSizeLevel, fontScale } = useAccessibility();
  const { t, language, setLanguage, supportedLanguages, languageInfo } = useLanguage();

  const [settings, setSettings] = useState<AppSettings>({
    biometricEnabled: false,
    notificationsEnabled: true,
    autoSyncEnabled: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    health: true,
    care: false,
    security: false,
    settings: false,
    deepdive: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userId = await getUserId();
      if (userId) {
        const userData = await api.users.get(userId);
        setSettings({
          biometricEnabled: userData.biometricEnabled,
          notificationsEnabled: userData.notificationsEnabled,
          autoSyncEnabled: userData.autoSyncEnabled,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      const userId = await getUserId();
      if (userId) {
        await api.users.update(userId, { [key]: value });
      }
    } catch (error) {
      setSettings(settings);
      Alert.alert("Settings Error", "Failed to save your setting. Please try again.");
    }
  };

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t.profile.signOutConfirm, t.profile.signOutMessage, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.signOut,
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }, [signOut, t]);

  const handleDeleteAccount = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      t.profile.deleteConfirmTitle,
      t.profile.deleteConfirmMessage,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.delete,
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t.profile.deleteConfirmTitle,
              "This is your final confirmation. Delete your account?",
              [
                { text: t.common.cancel, style: "cancel" },
                {
                  text: t.profile.deleteForever,
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const userId = await getUserId();
                      if (userId) {
                        await api.users.delete(userId);
                      }
                    } catch (error) {
                      console.error("Error deleting account:", error);
                    }
                    await signOut();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [signOut, t]);

  const handleExportPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const userId = await getUserId();
      if (!userId) {
        Alert.alert("Error", "Please sign in to export your records");
        return;
      }
      const pdfUrl = api.export.getPdfUrl();
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `tabula-medica-records-${new Date().toISOString().split("T")[0]}.pdf`;
        const headers = new Headers();
        headers.append("x-user-id", userId);
        fetch(pdfUrl, { headers })
          .then((response) => response.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          });
      } else {
        await WebBrowser.openBrowserAsync(`${pdfUrl}?userId=${userId}`);
      }
    } catch (error) {
      console.error("Export PDF error:", error);
      Alert.alert("Error", "Failed to export records. Please try again.");
    }
  };

  const handleOpenSettings = async () => {
    if (Platform.OS !== "web") {
      try {
        await Linking.openSettings();
      } catch {
        console.log("Cannot open settings");
      }
    }
  };

  const toggleGroup = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const healthColor = theme.primary;

  const filteredItems = searchQuery.length > 0
    ? MENU_ITEMS.filter(item => {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.searchTerms.toLowerCase().includes(q);
      })
    : [];

  const handleFeedbackEmail = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
        await MailComposer.composeAsync({
          recipients: ["info@tabulamedica.digital"],
          subject: "Tabula Medica - Feedback & Suggestions",
          body: "\n\n---\nSent from Tabula Medica App",
        });
      } else {
        await Linking.openURL("mailto:info@tabulamedica.digital?subject=Tabula%20Medica%20-%20Feedback%20%26%20Suggestions");
      }
    } catch {
      try {
        await Linking.openURL("mailto:info@tabulamedica.digital?subject=Tabula%20Medica%20-%20Feedback%20%26%20Suggestions");
      } catch {
        Alert.alert("Email", "Send your feedback to info@tabulamedica.digital");
      }
    }
  };

  const navigateToScreen = (screen: string) => {
    if (screen === "__feedback__") {
      handleFeedbackEmail();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen);
  };

  const getSwitchProps = (item: MenuItem) => {
    if (item.title === "Biometric Auth") return { value: settings.biometricEnabled, onChange: (v: boolean) => updateSetting("biometricEnabled", v), testID: "switch-biometric" };
    if (item.title === "Auto Sync") return { value: settings.autoSyncEnabled, onChange: (v: boolean) => updateSetting("autoSyncEnabled", v), testID: "switch-auto-sync" };
    if (item.title === "Notifications") return { value: settings.notificationsEnabled, onChange: (v: boolean) => updateSetting("notificationsEnabled", v), testID: "switch-notifications" };
    return null;
  };

  const renderMenuItem = (item: MenuItem, index: number, showDivider: boolean) => {
    const switchProps = getSwitchProps(item);
    return (
      <React.Fragment key={`${item.group}-${item.title}`}>
        <SettingsRow
          icon={item.icon}
          title={item.title}
          subtitle={item.subtitle}
          onPress={switchProps ? undefined : (item.screen ? () => navigateToScreen(item.screen!) : undefined)}
          theme={theme}
          rightElement={switchProps ? (
            <Switch value={switchProps.value} onValueChange={switchProps.onChange} trackColor={{ true: theme.primary }} testID={switchProps.testID} />
          ) : undefined}
        />
        {showDivider ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
      </React.Fragment>
    );
  };

  const renderGroup = (groupKey: "health" | "care" | "security" | "settings" | "deepdive", sectionIndex: number) => {
    const config = GROUP_CONFIG[groupKey];
    const color = groupKey === "health" ? healthColor : config.color;
    const items = MENU_ITEMS.filter(i => i.group === groupKey);
    const isExpanded = expandedGroups[groupKey];

    return (
      <Animated.View key={groupKey} entering={FadeInDown.delay(100 + sectionIndex * 50).springify()} style={styles.groupContent}>
        <GroupHeader
          icon={config.icon}
          title={config.title}
          count={items.length}
          isExpanded={isExpanded}
          onPress={() => toggleGroup(groupKey)}
          color={color}
          theme={theme}
        />
        {isExpanded ? (
          <View
            style={[
              styles.sectionContent,
              {
                backgroundColor: theme.backgroundDefault,
                ...Shadows.glass,
              },
            ]}
          >
            {items.map((item, idx) => renderMenuItem(item, idx, idx < items.length - 1))}
          </View>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        entering={FadeInDown.springify()}
        style={[
          styles.profileCard, 
          { 
            backgroundColor: theme.backgroundDefault,
            ...Shadows.glass,
          },
        ]}
      >
        <Image
          source={require("../../assets/images/avatar-preset.png")}
          style={styles.avatar}
          resizeMode="cover"
          accessibilityLabel="Profile photo"
        />
        <View style={styles.profileInfo}>
          <ThemedText type="h3">{user?.name || "Patient"}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {user?.email || "patient@tabulamedica.com"}
          </ThemedText>
        </View>
      </Animated.View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, borderWidth: 1 }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            placeholder="Search settings..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Search settings"
            accessibilityHint="Type to filter settings and features"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, fontSize: 16, color: theme.text, paddingVertical: 0 }}
            testID="input-search-settings"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} testID="button-clear-search">
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searchQuery.length > 0 ? (
        <View style={styles.groupContent}>
          {filteredItems.length > 0 ? (
            <View
              style={[
                styles.sectionContent,
                {
                  backgroundColor: theme.backgroundDefault,
                  ...Shadows.glass,
                },
              ]}
            >
              {filteredItems.map((item, idx) => renderMenuItem(item, idx, idx < filteredItems.length - 1))}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: Spacing["3xl"] }}>
              <Feather name="search" size={32} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No results found
              </ThemedText>
            </View>
          )}
        </View>
      ) : (
        <View>
          {renderGroup("health", 0)}
          {renderGroup("care", 1)}
          {renderGroup("security", 2)}
          {renderGroup("settings", 3)}
          {renderGroup("deepdive", 4)}
        </View>
      )}

      <SettingsSection title="View Modes" theme={theme} isDark={isDark} index={8}>
        {([
          { key: "standard", icon: "layout" as keyof typeof Feather.glyphMap, title: "Standard View", subtitle: "Full feature access with complete details" },
          { key: "simplified", icon: "maximize-2" as keyof typeof Feather.glyphMap, title: "Simplified Mode", subtitle: "Larger text, fewer options, focus on today" },
          { key: "caregiver", icon: "heart" as keyof typeof Feather.glyphMap, title: "Caregiver Mode", subtitle: "Task checklist, medications, emergency share QR" },
          { key: "cancer_track", icon: "calendar" as keyof typeof Feather.glyphMap, title: "Cancer Track Mode", subtitle: "Extended timeline, side effects, 10+ year follow-ups" },
        ] as const).map((mode, idx) => (
          <React.Fragment key={mode.key}>
            {idx > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
            <SettingsRow
              icon={mode.icon}
              title={mode.title}
              subtitle={mode.subtitle}
              theme={theme}
              rightElement={
                <View style={[styles.radioCircle, viewMode === mode.key ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined]}>
                  {viewMode === mode.key ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                </View>
              }
              onPress={() => setViewMode(mode.key)}
            />
          </React.Fragment>
        ))}
      </SettingsSection>

      <SettingsSection title="Text Size" theme={theme} isDark={isDark} index={9}>
        <View style={styles.fontSizeSection}>
          <View style={styles.fontSizeHeader}>
            <View style={[styles.settingsIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="type" size={18} color={theme.primary} />
            </View>
            <View style={styles.settingsContent}>
              <ThemedText type="body">Text Size</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Currently: {FONT_SIZE_LABELS[accessibilitySettings.fontSizeLevel]}
              </ThemedText>
            </View>
          </View>
          <View style={styles.fontSizeOptions}>
            {(["small", "normal", "large", "extraLarge"] as FontSizeLevel[]).map((level) => {
              const isActive = accessibilitySettings.fontSizeLevel === level;
              const previewSizes: Record<FontSizeLevel, number> = {
                small: 12,
                normal: 14,
                large: 18,
                extraLarge: 22,
              };
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFontSizeLevel(level);
                  }}
                  style={[
                    styles.fontSizeOption,
                    {
                      backgroundColor: isActive ? theme.primary : `${theme.primary}08`,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                  accessibilityLabel={`Set text size to ${FONT_SIZE_LABELS[level]}`}
                  testID={`font-size-${level}`}
                >
                  <ThemedText
                    type="body"
                    style={{
                      fontSize: previewSizes[level],
                      fontWeight: "700",
                      color: isActive ? "#FFFFFF" : theme.text,
                      textAlign: "center",
                    }}
                  >
                    Aa
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: isActive ? "#FFFFFF" : theme.textSecondary,
                      textAlign: "center",
                      marginTop: 2,
                    }}
                  >
                    {FONT_SIZE_LABELS[level]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.fontSizePreview, { backgroundColor: `${theme.primary}06`, borderColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Preview:
            </ThemedText>
            <ThemedText type="body">
              Your health records are important.
            </ThemedText>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title="Read Aloud" theme={theme} isDark={isDark} index={10}>
        <SettingsRow
          icon="volume-2"
          title="Read Aloud"
          subtitle="Show a button to have content read to you"
          theme={theme}
          rightElement={
            <Switch
              value={accessibilitySettings.readAloudEnabled}
              onValueChange={toggleReadAloud}
              trackColor={{ true: theme.primary }}
              accessibilityLabel="Toggle read aloud feature"
            />
          }
        />
        {accessibilitySettings.readAloudEnabled ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={[styles.readAloudInfo, { backgroundColor: `${theme.info}08` }]}>
              <Feather name="info" size={16} color={theme.info} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                A speaker button will appear on health records and details screens. Tap it to have the content read aloud.
              </ThemedText>
            </View>
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Display" theme={theme} isDark={isDark} index={11}>
        <SettingsRow
          icon="sun"
          title="High Contrast"
          subtitle="WCAG 2.1 compliant high contrast mode"
          theme={theme}
          rightElement={
            <Switch
              value={accessibilitySettings.highContrast}
              onValueChange={toggleHighContrast}
              trackColor={{ true: theme.primary }}
              accessibilityLabel="Toggle high contrast mode"
            />
          }
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <SettingsRow
          icon="pause-circle"
          title="Reduced Motion"
          subtitle="Minimize animations for comfort"
          theme={theme}
          rightElement={
            <Switch
              value={accessibilitySettings.reducedMotion}
              onValueChange={toggleReducedMotion}
              trackColor={{ true: theme.primary }}
              accessibilityLabel="Toggle reduced motion"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t.profile.language} theme={theme} isDark={isDark} index={12}>
        {supportedLanguages.map((lang, idx) => (
          <React.Fragment key={lang.code}>
            {idx > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
            <SettingsRow
              icon="globe"
              title={lang.nativeName}
              subtitle={lang.name}
              theme={theme}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLanguage(lang.code);
              }}
              rightElement={
                <View style={[styles.radioCircle, language === lang.code ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined]}>
                  {language === lang.code ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                </View>
              }
            />
          </React.Fragment>
        ))}
      </SettingsSection>

      <SettingsSection title="Account" theme={theme} isDark={isDark} index={13}>
        <SettingsRow
          icon="log-out"
          title={t.common.signOut}
          onPress={handleLogout}
          danger
          theme={theme}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <SettingsRow
          icon="trash-2"
          title={t.profile.deleteAccount}
          subtitle={t.profile.deleteAccountDesc}
          onPress={handleDeleteAccount}
          danger
          theme={theme}
        />
      </SettingsSection>

      <ThemedText
        type="caption"
        style={[styles.version, { color: theme.textSecondary }]}
      >
        Tabula Medica v1.0.0{"\n"}HIPAA Compliant | SOC 2 readiness in flight
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsContent: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  fontSizeSection: {
    padding: Spacing.lg,
  },
  fontSizeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  fontSizeOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fontSizeOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizePreview: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: 4,
  },
  readAloudInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  groupContent: {
    marginBottom: Spacing.lg,
  },
});
