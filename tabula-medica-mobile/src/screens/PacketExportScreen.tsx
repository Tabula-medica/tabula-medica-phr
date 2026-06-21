import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import api from "../services/api";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Feather } from "@expo/vector-icons";

interface ExportOptions {
  includeConditions: boolean;
  includeMedications: boolean;
  includeLabResults: boolean;
  includeVitals: boolean;
  includeImmunizations: boolean;
  includeProcedures: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

interface ExportResponse {
  pdfUrl: string;
  filename: string;
  generatedAt: string;
  noCdsCompliance: {
    disclaimer: string;
    notForClinicalDecisionMaking: boolean;
  };
}

export default function PacketExportScreen() {
  const [options, setOptions] = useState<ExportOptions>({
    includeConditions: true,
    includeMedications: true,
    includeLabResults: true,
    includeVitals: true,
    includeImmunizations: true,
    includeProcedures: true,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      // Create packet job
      const createRes = await api.post<{ id: string; status: string }>("/api/packets", options);
      const jobId = createRes.data.id;
      
      // Poll until ready (simplified - in production use proper polling)
      await new Promise((resolve) => setTimeout(resolve, 4000));
      
      // Get download URL
      const statusRes = await api.get<ExportResponse>(`/api/packets/${jobId}`);
      return {
        pdfUrl: `${api.defaults.baseURL}/api/packets/${jobId}/download`,
        filename: `health-records-${jobId}.pdf`,
        generatedAt: new Date().toISOString(),
        noCdsCompliance: statusRes.data.noCdsCompliance,
      };
    },
    onSuccess: async (data) => {
      try {
        const fileUri = FileSystem.documentDirectory + data.filename;
        const downloadResult = await FileSystem.downloadAsync(data.pdfUrl, fileUri);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: "application/pdf",
            dialogTitle: "Share Health Record Packet",
          });
        } else {
          Alert.alert("Success", "PDF saved to your device");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to download the PDF. Please try again.");
      }
    },
    onError: () => {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    },
  });

  function toggleOption(key: keyof ExportOptions) {
    if (typeof options[key] === "boolean") {
      setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }

  const sections = [
    { key: "includeConditions", label: "Health Conditions", icon: "heart" },
    { key: "includeMedications", label: "Medications", icon: "thermometer" },
    { key: "includeLabResults", label: "Lab Results", icon: "activity" },
    { key: "includeVitals", label: "Vital Signs", icon: "trending-up" },
    { key: "includeImmunizations", label: "Immunizations", icon: "shield" },
    { key: "includeProcedures", label: "Procedures", icon: "tool" },
  ] as const;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Feather name="file-text" size={32} color="#0F766E" />
          <Text style={styles.headerTitle}>Export Health Record Packet</Text>
          <Text style={styles.headerSubtitle}>
            Generate a PDF summary of your health records to share with providers
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Include Sections</Text>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={styles.optionRow}
            onPress={() => toggleOption(section.key)}
            testID={`toggle-${section.key}`}
          >
            <View style={styles.optionInfo}>
              <Feather
                name={section.icon as keyof typeof Feather.glyphMap}
                size={20}
                color="#0F766E"
              />
              <Text style={styles.optionLabel}>{section.label}</Text>
            </View>
            <View
              style={[
                styles.checkbox,
                options[section.key] && styles.checkboxChecked,
              ]}
            >
              {options[section.key] && (
                <Feather name="check" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.exportButton, exportMutation.isPending && styles.exportButtonDisabled]}
          onPress={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          testID="button-export-pdf"
        >
          {exportMutation.isPending ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.exportButtonText}>Generating PDF...</Text>
            </>
          ) : (
            <>
              <Feather name="download" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Generate PDF Packet</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Feather name="info" size={16} color="#0369A1" />
          <Text style={styles.infoText}>
            Your PDF will include a cover page, table of contents, and all selected sections with
            dates and provider information.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          For informational purposes only. Not for clinical decision-making. Always verify
          information with your healthcare provider.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 12,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  optionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0F766E",
    borderColor: "#0F766E",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#E0F2FE",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#0369A1",
    lineHeight: 18,
  },
  disclaimer: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#92400E",
    textAlign: "center",
  },
});
