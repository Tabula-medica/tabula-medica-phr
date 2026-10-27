import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

type SourceType = "fhir" | "manual" | "tefca" | "aggregator" | "wearable" | "upload" | "unknown";

interface CodingInfo {
  system?: string;
  code?: string;
  display?: string;
}

interface ProvenanceBadgeProps {
  sourceType: SourceType;
  sourceOrg?: string;
  dateCreated?: string;
  dateImported?: string;
  recordType?: string;
  coding?: CodingInfo;
  rawData?: object;
  compact?: boolean;
  onPress?: () => void;
}

const SOURCE_CONFIG: Record<SourceType, {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  colorKey: "success" | "warning" | "primary" | "textSecondary" | "info";
}> = {
  fhir: { label: "FHIR", icon: "database", colorKey: "success" },
  manual: { label: "Manual Entry", icon: "edit-3", colorKey: "warning" },
  tefca: { label: "TEFCA Network", icon: "globe", colorKey: "primary" },
  aggregator: { label: "Health Aggregator", icon: "layers", colorKey: "primary" },
  wearable: { label: "Wearable Device", icon: "watch", colorKey: "info" },
  upload: { label: "Patient Upload", icon: "upload", colorKey: "warning" },
  unknown: { label: "Unknown Source", icon: "help-circle", colorKey: "textSecondary" },
};

const CODING_SYSTEMS: Record<string, { name: string; abbrev: string }> = {
  "http://loinc.org": { name: "LOINC", abbrev: "LOINC" },
  "http://snomed.info/sct": { name: "SNOMED CT", abbrev: "SNOMED" },
  "http://www.nlm.nih.gov/research/umls/rxnorm": { name: "RxNorm", abbrev: "RxNorm" },
  "http://hl7.org/fhir/sid/icd-10-cm": { name: "ICD-10-CM", abbrev: "ICD-10" },
  "http://hl7.org/fhir/sid/cvx": { name: "CVX (Vaccines)", abbrev: "CVX" },
  "http://www.ama-assn.org/go/cpt": { name: "CPT", abbrev: "CPT" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RawDataModal({
  visible,
  onClose,
  rawData,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  rawData: object;
  theme: typeof Colors.light;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[modalStyles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[modalStyles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="h4">Original Record Data</ThemedText>
          <Pressable onPress={onClose} style={modalStyles.closeButton} accessibilityRole="button" accessibilityLabel="Close original record data">
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={[modalStyles.content, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={modalStyles.rawText}>
            {JSON.stringify(rawData, null, 2)}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

export function ProvenanceBadge({
  sourceType,
  sourceOrg,
  dateCreated,
  dateImported,
  recordType,
  coding,
  rawData,
  compact = false,
  onPress,
}: ProvenanceBadgeProps) {
  const { theme } = useTheme();
  const [showRawData, setShowRawData] = useState(false);
  const config = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.unknown;
  const color = theme[config.colorKey as keyof typeof theme] as string;
  
  const codingSystem = coding?.system ? CODING_SYSTEMS[coding.system] : null;

  if (compact) {
    return (
      <Pressable
        style={[styles.compactBadge, { backgroundColor: `${color}15` }]}
        onPress={onPress}
        disabled={!onPress}
      >
        <Feather name={config.icon} size={10} color={color} />
        <ThemedText style={[styles.compactText, { color }]}>
          {config.label}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <>
      <View
        style={[styles.badge, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
      >
        <View style={[styles.headerRow]}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
            <Feather name={config.icon} size={14} color={color} />
          </View>
          <View style={styles.sourceInfo}>
            <View style={styles.sourceRow}>
              <ThemedText style={[styles.sourceType, { color }]}>
                {config.label}
              </ThemedText>
              {sourceOrg ? (
                <ThemedText style={[styles.sourceOrg, { color: theme.textSecondary }]} numberOfLines={1}>
                  {sourceOrg}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.detailsGrid, { borderTopColor: theme.border }]}>
          {dateCreated ? (
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Created
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {formatDate(dateCreated)}
              </ThemedText>
            </View>
          ) : null}
          
          {dateImported ? (
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Imported
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {formatDateTime(dateImported)}
              </ThemedText>
            </View>
          ) : null}
          
          {recordType ? (
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Type
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {recordType}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {coding?.code ? (
          <View style={[styles.codingRow, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="hash" size={12} color={theme.textSecondary} />
            <View style={styles.codingInfo}>
              {codingSystem ? (
                <View style={[styles.codingBadge, { backgroundColor: `${theme.primary}20` }]}>
                  <ThemedText style={[styles.codingSystem, { color: theme.primary }]}>
                    {codingSystem.abbrev}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText style={[styles.codingCode, { color: theme.text }]}>
                {coding.code}
              </ThemedText>
              {coding.display ? (
                <ThemedText style={[styles.codingDisplay, { color: theme.textSecondary }]} numberOfLines={1}>
                  {coding.display}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}

        {rawData ? (
          <Pressable
            style={[styles.viewOriginalButton, { borderTopColor: theme.border }]}
            onPress={() => setShowRawData(true)}
          >
            <Feather name="file-text" size={14} color={theme.primary} />
            <ThemedText style={[styles.viewOriginalText, { color: theme.primary }]}>
              View Original
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.primary} />
          </Pressable>
        ) : null}
      </View>

      {rawData ? (
        <RawDataModal
          visible={showRawData}
          onClose={() => setShowRawData(false)}
          rawData={rawData}
          theme={theme}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceInfo: {
    flex: 1,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sourceType: {
    fontSize: 12,
    fontWeight: "600",
  },
  sourceOrg: {
    fontSize: 11,
    flex: 1,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  detailItem: {
    minWidth: 80,
  },
  detailLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  codingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  codingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  codingBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  codingSystem: {
    fontSize: 10,
    fontWeight: "700",
  },
  codingCode: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  codingDisplay: {
    fontSize: 10,
    flex: 1,
  },
  viewOriginalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  viewOriginalText: {
    fontSize: 12,
    fontWeight: "600",
  },
  compactBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 2,
  },
  compactText: {
    fontSize: 9,
    fontWeight: "600",
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  rawText: {
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 18,
  },
});

export default ProvenanceBadge;
