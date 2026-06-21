import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { Feather } from "@expo/vector-icons";

interface LabResult {
  id: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange?: {
    low?: number;
    high?: number;
  };
  status: "normal" | "abnormal" | "critical";
  date: string;
  category?: string;
}

export default function LabsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: labs, isLoading } = useQuery({
    queryKey: ["labs"],
    queryFn: async () => {
      const res = await api.get<LabResult[]>("/api/fhir/observations?category=laboratory");
      return res.data;
    },
  });

  const categories = [...new Set(labs?.map((l) => l.category || "Other"))];

  const filteredLabs = selectedCategory
    ? labs?.filter((l) => (l.category || "Other") === selectedCategory)
    : labs;

  function getStatusColor(status: LabResult["status"]) {
    switch (status) {
      case "normal":
        return "#10B981";
      case "abnormal":
        return "#F59E0B";
      case "critical":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  }

  function getStatusIcon(status: LabResult["status"]) {
    switch (status) {
      case "normal":
        return "check-circle";
      case "abnormal":
        return "alert-triangle";
      case "critical":
        return "alert-octagon";
      default:
        return "minus-circle";
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
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
            testID="button-category-all"
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat)}
              testID={`button-category-${cat}`}
            >
              <Text
                style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredLabs?.map((lab) => (
          <View key={lab.id} style={styles.labCard}>
            <View style={styles.labHeader}>
              <View style={styles.labInfo}>
                <Text style={styles.labName}>{lab.testName}</Text>
                <Text style={styles.labDate}>
                  {new Date(lab.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lab.status) + "20" }]}>
                <Feather
                  name={getStatusIcon(lab.status) as keyof typeof Feather.glyphMap}
                  size={14}
                  color={getStatusColor(lab.status)}
                />
              </View>
            </View>

            <View style={styles.valueRow}>
              <Text style={styles.labValue}>
                {lab.value} <Text style={styles.labUnit}>{lab.unit}</Text>
              </Text>
              {lab.referenceRange && (
                <Text style={styles.referenceRange}>
                  Ref: {lab.referenceRange.low}-{lab.referenceRange.high} {lab.unit}
                </Text>
              )}
            </View>

            {lab.referenceRange && (
              <View style={styles.rangeBar}>
                <View style={styles.rangeTrack}>
                  <View
                    style={[
                      styles.rangeIndicator,
                      {
                        left: `${Math.min(100, Math.max(0, ((lab.value - (lab.referenceRange.low || 0)) / ((lab.referenceRange.high || 100) - (lab.referenceRange.low || 0))) * 100))}%`,
                        backgroundColor: getStatusColor(lab.status),
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )) || (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No lab results found</Text>
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
  categoryBar: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxHeight: 56,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#0F766E",
  },
  categoryText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
  },
  categoryTextActive: {
    color: "#fff",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  labCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  labHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  labInfo: {
    flex: 1,
  },
  labName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  labDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statusBadge: {
    padding: 6,
    borderRadius: 8,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  labValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F766E",
  },
  labUnit: {
    fontSize: 14,
    fontWeight: "normal",
    color: "#6B7280",
  },
  referenceRange: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  rangeBar: {
    marginTop: 8,
  },
  rangeTrack: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    position: "relative",
  },
  rangeIndicator: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    top: -2,
    marginLeft: -4,
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
