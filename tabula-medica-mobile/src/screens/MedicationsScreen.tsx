import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { Feather } from "@expo/vector-icons";

interface Medication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  status: "active" | "stopped" | "on-hold";
  prescriber?: string;
  startDate?: string;
  instructions?: string;
}

export default function MedicationsScreen() {
  const { data: medications, isLoading } = useQuery({
    queryKey: ["medications"],
    queryFn: async () => {
      const res = await api.get<Medication[]>("/api/fhir/medications");
      return res.data;
    },
  });

  const activeMeds = medications?.filter((m) => m.status === "active") || [];
  const inactiveMeds = medications?.filter((m) => m.status !== "active") || [];

  function getStatusColor(status: Medication["status"]) {
    switch (status) {
      case "active":
        return "#10B981";
      case "on-hold":
        return "#F59E0B";
      case "stopped":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {activeMeds.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Medications</Text>
            {activeMeds.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.medCard}
                testID={`button-medication-${med.id}`}
              >
                <View style={styles.medIcon}>
                  <Feather name="thermometer" size={20} color="#0F766E" />
                </View>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.name}</Text>
                  {med.dosage && (
                    <Text style={styles.medDosage}>{med.dosage}</Text>
                  )}
                  {med.frequency && (
                    <Text style={styles.medFrequency}>{med.frequency}</Text>
                  )}
                  {med.instructions && (
                    <Text style={styles.medInstructions}>{med.instructions}</Text>
                  )}
                </View>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(med.status) }]} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {inactiveMeds.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Past Medications</Text>
            {inactiveMeds.map((med) => (
              <View key={med.id} style={[styles.medCard, styles.inactiveCard]}>
                <View style={[styles.medIcon, styles.inactiveIcon]}>
                  <Feather name="thermometer" size={20} color="#9CA3AF" />
                </View>
                <View style={styles.medInfo}>
                  <Text style={[styles.medName, styles.inactiveText]}>{med.name}</Text>
                  {med.dosage && (
                    <Text style={[styles.medDosage, styles.inactiveText]}>{med.dosage}</Text>
                  )}
                  <Text style={styles.stoppedLabel}>
                    {med.status === "on-hold" ? "On Hold" : "Stopped"}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {medications?.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="thermometer" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No medications on file</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          For informational purposes only. Not for clinical decision-making.
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
    marginTop: 8,
  },
  medCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inactiveCard: {
    opacity: 0.7,
  },
  medIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  inactiveIcon: {
    backgroundColor: "#F3F4F6",
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  medDosage: {
    fontSize: 14,
    color: "#0F766E",
    fontWeight: "500",
  },
  medFrequency: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  inactiveText: {
    color: "#6B7280",
  },
  stoppedLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
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
