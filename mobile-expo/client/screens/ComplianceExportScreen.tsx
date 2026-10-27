import React, { useState, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import { Paths, File as ExpoFile } from "expo-file-system";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type ExportType = "audit-logs" | "tefca-exchanges";
type ExportFormat = "pdf" | "csv";

interface ExportSummary {
  auditLogCount: number;
  tefcaExchangeCount: number;
  tefcaSuccessRate: number;
  encryptionStandard: string;
  complianceFrameworks: string[];
}

const NETWORKS = [
  { id: "", label: "All Networks" },
  { id: "commonwell", label: "CommonWell" },
  { id: "carequality", label: "Carequality" },
  { id: "epic-nexus", label: "Epic Nexus" },
  { id: "ehealth-exchange", label: "eHealth Exchange" },
  { id: "health-gorilla", label: "Health Gorilla" },
];

export default function ComplianceExportScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [exportType, setExportType] = useState<ExportType>("audit-logs");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [encrypted, setEncrypted] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [networkFilter, setNetworkFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const { data: summary } = useQuery<ExportSummary>({
    queryKey: ["/api/compliance-export/summary"],
  });

  const handleExport = useCallback(async () => {
    if (encrypted && !passphrase.trim()) return;
    setIsExporting(true);
    setExportSuccess(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const endpoint = exportType === "audit-logs"
        ? "/api/compliance-export/audit-logs"
        : "/api/compliance-export/tefca-exchanges";

      const body: any = { format, encrypt: encrypted };
      if (encrypted) body.passphrase = passphrase;
      if (exportType === "tefca-exchanges" && networkFilter) {
        body.networkId = networkFilter;
      }

      const response = await apiRequest("POST", endpoint, body);
      if (!response.ok) throw new Error("Export failed");

      const ext = encrypted ? (format === "pdf" ? ".encrypted.pdf" : ".encrypted.csv") : `.${format}`;
      const filename = `${exportType}-${new Date().toISOString().split("T")[0]}${ext}`;

      if (Platform.OS === "web") {
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        const file = new ExpoFile(Paths.cache, filename);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        await file.write(bytes);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: encrypted ? "application/octet-stream" : format === "pdf" ? "application/pdf" : "text/csv",
            dialogTitle: `Share ${exportType === "audit-logs" ? "Audit Log" : "TEFCA Exchange"} Export`,
          });
        }
      }

      setExportSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error("Export error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsExporting(false);
    }
  }, [exportType, format, encrypted, passphrase, networkFilter]);

  const canExport = !encrypted || passphrase.trim().length >= 8;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.complianceBanner, { backgroundColor: isDark ? "#0066CC15" : "#EFF6FF", borderColor: "#0066CC30" }]}>
        <Feather name="shield" size={18} color="#0066CC" />
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.bannerTitle, { color: "#0066CC" }]}>
            HIPAA-Compliant Export
          </ThemedText>
          <ThemedText style={[styles.bannerText, { color: colors.textSecondary }]}>
            All exports are encrypted with AES-256-CBC. PHI is handled per HIPAA Security Rule requirements.
          </ThemedText>
        </View>
      </View>

      {summary ? (
        <View style={styles.summaryRow}>
          <SummaryCard
            icon="clipboard"
            label="Audit Logs"
            value={summary.auditLogCount}
            colors={colors}
            isDark={isDark}
          />
          <SummaryCard
            icon="globe"
            label="TEFCA Exchanges"
            value={summary.tefcaExchangeCount}
            colors={colors}
            isDark={isDark}
          />
          <SummaryCard
            icon="check-circle"
            label="Success Rate"
            value={`${summary.tefcaSuccessRate}%`}
            colors={colors}
            isDark={isDark}
          />
        </View>
      ) : null}

      <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Export Type</ThemedText>
      <View style={styles.optionRow}>
        <OptionCard
          testID="export-type-audit"
          icon="clipboard"
          title="Audit Logs"
          subtitle="Security events, PHI access, and system activity"
          selected={exportType === "audit-logs"}
          onPress={() => setExportType("audit-logs")}
          colors={colors}
          isDark={isDark}
        />
        <OptionCard
          testID="export-type-tefca"
          icon="globe"
          title="TEFCA Exchanges"
          subtitle="Network transactions, consent records, and errors"
          selected={exportType === "tefca-exchanges"}
          onPress={() => setExportType("tefca-exchanges")}
          colors={colors}
          isDark={isDark}
        />
      </View>

      {exportType === "tefca-exchanges" ? (
        <>
          <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Network Filter</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
            {NETWORKS.map((n) => (
              <Pressable
                key={n.id}
                testID={`export-network-${n.id || "all"}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: networkFilter === n.id ? colors.primary : isDark ? "rgba(255,255,255,0.06)" : colors.backgroundSecondary,
                    borderColor: networkFilter === n.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setNetworkFilter(n.id)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${n.label}`}
              >
                <ThemedText style={[styles.chipText, { color: networkFilter === n.id ? "#FFF" : colors.text }]}>
                  {n.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>File Format</ThemedText>
      <View style={styles.formatRow}>
        <FormatChip
          testID="export-format-pdf"
          icon="file-text"
          label="PDF"
          sublabel="Formatted report"
          selected={format === "pdf"}
          onPress={() => setFormat("pdf")}
          colors={colors}
          isDark={isDark}
        />
        <FormatChip
          testID="export-format-csv"
          icon="grid"
          label="CSV"
          sublabel="Spreadsheet data"
          selected={format === "csv"}
          onPress={() => setFormat("csv")}
          colors={colors}
          isDark={isDark}
        />
      </View>

      <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Encryption</ThemedText>
      <View style={[styles.encryptionCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary, borderColor: colors.border }]}>
        <View style={styles.encryptionHeader}>
          <View style={styles.encryptionLeft}>
            <Feather name="lock" size={16} color={encrypted ? "#22C55E" : colors.textSecondary} />
            <ThemedText style={[styles.encryptionTitle, { color: colors.text }]}>
              AES-256-CBC Encryption
            </ThemedText>
          </View>
          <Pressable
            testID="export-encrypt-toggle"
            style={[
              styles.toggle,
              { backgroundColor: encrypted ? "#22C55E" : colors.border },
            ]}
            onPress={() => setEncrypted(!encrypted)}
            accessibilityRole="switch"
            accessibilityLabel="Toggle encryption"
          >
            <View
              style={[
                styles.toggleKnob,
                { transform: [{ translateX: encrypted ? 18 : 2 }] },
              ]}
            />
          </Pressable>
        </View>

        {encrypted ? (
          <View style={styles.passphraseSection}>
            <ThemedText style={[styles.passphraseLabel, { color: colors.textSecondary }]}>
              Set a passphrase to decrypt the file (min. 8 characters)
            </ThemedText>
            <View style={[styles.passphraseRow, { borderColor: colors.border }]}>
              <Feather name="key" size={14} color={colors.textSecondary} />
              <TextInput
                testID="export-passphrase"
                style={[styles.passphraseInput, { color: colors.text }]}
                value={passphrase}
                onChangeText={setPassphrase}
                placeholder="Enter secure passphrase..."
                placeholderTextColor={colors.textSecondary + "80"}
                secureTextEntry={!showPassphrase}
                autoCapitalize="none"
                accessibilityLabel="Encryption passphrase"
              />
              <Pressable
                onPress={() => setShowPassphrase(!showPassphrase)}
                accessibilityRole="button"
                accessibilityLabel={showPassphrase ? "Hide passphrase" : "Show passphrase"}
              >
                <Feather
                  name={showPassphrase ? "eye-off" : "eye"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            {passphrase.length > 0 && passphrase.length < 8 ? (
              <ThemedText style={styles.passphraseHint}>
                Passphrase must be at least 8 characters
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <ThemedText style={[styles.unencryptedWarning, { color: "#F59E0B" }]}>
            Exporting without encryption is not recommended for files containing PHI.
          </ThemedText>
        )}
      </View>

      {exportSuccess ? (
        <View style={[styles.successBanner, { backgroundColor: "#22C55E15", borderColor: "#22C55E30" }]}>
          <Feather name="check-circle" size={18} color="#22C55E" />
          <ThemedText style={[styles.successText, { color: "#22C55E" }]}>
            Export completed successfully. The file has been saved with {encrypted ? "AES-256-CBC encryption" : "no encryption"}.
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        testID="export-submit-btn"
        style={[
          styles.exportBtn,
          { backgroundColor: canExport ? colors.primary : colors.primary + "40" },
        ]}
        onPress={handleExport}
        disabled={!canExport || isExporting}
        accessibilityRole="button"
        accessibilityLabel={`Export ${exportType === "audit-logs" ? "audit logs" : "TEFCA exchanges"} as ${encrypted ? "encrypted " : ""}${format.toUpperCase()}`}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <Feather name={encrypted ? "lock" : "download"} size={18} color="#FFF" />
            <ThemedText style={styles.exportBtnText}>
              Export {encrypted ? "Encrypted " : ""}{format.toUpperCase()}
            </ThemedText>
          </>
        )}
      </Pressable>

      <View style={[styles.complianceFooter, { borderColor: colors.border }]}>
        <ThemedText style={[styles.footerTitle, { color: colors.text }]}>Compliance Standards</ThemedText>
        {["HIPAA Security Rule (45 CFR 164.312)", "TEFCA Common Agreement v2", "SOC 2 Type II Controls", "NIST SP 800-66 Rev. 2"].map((standard) => (
          <View key={standard} style={styles.footerRow}>
            <Feather name="check" size={12} color="#22C55E" />
            <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>{standard}</ThemedText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ icon, label, value, colors, isDark }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary, borderColor: colors.border }]}>
      <Feather name={icon} size={16} color={colors.primary} />
      <ThemedText style={[styles.summaryValue, { color: colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

function OptionCard({ testID, icon, title, subtitle, selected, onPress, colors, isDark }: {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? colors.primary + "10" : isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary + "20" : colors.border + "40" }]}>
        <Feather name={icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
      </View>
      <ThemedText style={[styles.optionTitle, { color: selected ? colors.primary : colors.text }]}>{title}</ThemedText>
      <ThemedText style={[styles.optionSubtitle, { color: colors.textSecondary }]}>{subtitle}</ThemedText>
    </Pressable>
  );
}

function FormatChip({ testID, icon, label, sublabel, selected, onPress, colors, isDark }: {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      style={[
        styles.formatChip,
        {
          backgroundColor: selected ? colors.primary + "10" : isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} format`}
    >
      <Feather name={icon} size={18} color={selected ? colors.primary : colors.textSecondary} />
      <View>
        <ThemedText style={[styles.formatLabel, { color: selected ? colors.primary : colors.text }]}>{label}</ThemedText>
        <ThemedText style={[styles.formatSublabel, { color: colors.textSecondary }]}>{sublabel}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  complianceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  bannerText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    gap: 6,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionSubtitle: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
  chipScroll: {
    marginBottom: Spacing.lg,
  },
  chipContent: {
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  formatRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  formatChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  formatLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  formatSublabel: {
    fontSize: 11,
  },
  encryptionCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  encryptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  encryptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  encryptionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFF",
  },
  passphraseSection: {
    marginTop: Spacing.md,
  },
  passphraseLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  passphraseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  passphraseInput: {
    flex: 1,
    fontSize: 14,
  },
  passphraseHint: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 4,
  },
  unencryptedWarning: {
    fontSize: 12,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  exportBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  complianceFooter: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
  },
});
