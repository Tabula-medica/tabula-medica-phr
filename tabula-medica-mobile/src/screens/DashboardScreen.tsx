import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

interface DashboardData {
  upcomingAppointments: number;
  activeMedications: number;
  recentConditions: number;
  unreadMessages: number;
  recentLabs: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboard, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get<DashboardData>("/api/dashboard");
      return res.data;
    },
    staleTime: 60000,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const quickActions = [
    { id: "symptom-checker", title: "Symptom Checker", icon: "thermometer", screen: "SymptomChecker" },
    { id: "records", title: "Timeline", icon: "clock", screen: "RecordsTimeline" },
    { id: "medications", title: "Medications", icon: "heart", screen: "Medications" },
    { id: "labs", title: "Lab Results", icon: "activity", screen: "Labs" },
    { id: "doctor", title: "Find Doctor", icon: "user-plus", screen: "ConnectDoctor" },
    { id: "export", title: "Export PDF", icon: "file-text", screen: "PacketExport" },
    { id: "ehr", title: "Connect EHR", icon: "upload-cloud", screen: "EHRConnection" },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F766E" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name || "Patient"}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Feather name="calendar" size={20} color="#0F766E" />
          <Text style={styles.statNumber}>{dashboard?.upcomingAppointments || 0}</Text>
          <Text style={styles.statLabel}>Appointments</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="heart" size={20} color="#0F766E" />
          <Text style={styles.statNumber}>{dashboard?.activeMedications || 0}</Text>
          <Text style={styles.statLabel}>Medications</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="activity" size={20} color="#0F766E" />
          <Text style={styles.statNumber}>{dashboard?.recentLabs || 0}</Text>
          <Text style={styles.statLabel}>Lab Results</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={() => navigation.navigate(action.screen as never)}
            testID={`button-action-${action.id}`}
          >
            <Feather name={action.icon as keyof typeof Feather.glyphMap} size={24} color="#0F766E" />
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Find Doctor Banner */}
      <TouchableOpacity
        style={styles.ehrBanner}
        onPress={() => navigation.navigate("ConnectDoctor" as never)}
        testID="button-find-doctor"
      >
        <View style={styles.ehrBannerContent}>
          <Feather name="user-plus" size={24} color="#0F766E" />
          <View style={styles.ehrBannerText}>
            <Text style={styles.ehrBannerTitle}>Find a Doctor</Text>
            <Text style={styles.ehrBannerSubtitle}>Connect with healthcare providers</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="#0F766E" />
      </TouchableOpacity>

      {/* EHR Connection Banner */}
      <TouchableOpacity
        style={styles.ehrBanner}
        onPress={() => navigation.navigate("EHRConnection" as never)}
        testID="button-connect-ehr"
      >
        <View style={styles.ehrBannerContent}>
          <Feather name="upload-cloud" size={24} color="#0F766E" />
          <View style={styles.ehrBannerText}>
            <Text style={styles.ehrBannerTitle}>Import Health Records</Text>
            <Text style={styles.ehrBannerSubtitle}>Connect to Epic, Cerner, and more</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="#0F766E" />
      </TouchableOpacity>

      <View style={styles.complianceBanner}>
        <Feather name="shield" size={16} color="#065F46" />
        <Text style={styles.complianceText}>
          Your data is protected with HIPAA-compliant encryption
        </Text>
      </View>

      <Text style={styles.disclaimerText}>
        For informational purposes only. Not for clinical decision-making.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 16,
    color: "#D1FAE5",
  },
  name: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F766E",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  actionCard: {
    width: "30%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    marginTop: 8,
    textAlign: "center",
  },
  complianceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    marginTop: 24,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  complianceText: {
    fontSize: 12,
    color: "#065F46",
  },
  ehrBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 16,
    marginTop: 24,
    backgroundColor: "#F0FDFA",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#5EEAD4",
  },
  ehrBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  ehrBannerText: {
    flex: 1,
  },
  ehrBannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F766E",
  },
  ehrBannerSubtitle: {
    fontSize: 12,
    color: "#14B8A6",
    marginTop: 2,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginHorizontal: 16,
    marginBottom: 24,
  },
});
