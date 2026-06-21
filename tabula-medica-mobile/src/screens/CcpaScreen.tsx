import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";

interface NoticeCategory {
  category: string;
  collected: boolean;
  examples?: string;
}
interface Notice {
  controller: string;
  doWeSell: boolean;
  doWeShareForCBA: boolean;
  retention: string;
  categories: NoticeCategory[];
}

export default function CcpaScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"rights" | "notice">("rights");

  const noticeQ = useQuery<{ notice: Notice }>({
    queryKey: ["ccpa", "notice"],
    queryFn: async () => (await api.get("/api/ccpa/notice-at-collection")).data,
  });

  const optOut = useMutation({
    mutationFn: async () => (await api.post("/api/ccpa/confirm-opt-out", {})).data,
    onSuccess: () => {
      Alert.alert(
        "Confirmed",
        "Your opt-out preference is recorded. Tabula Medica does not sell or share personal information.",
      );
      qc.invalidateQueries({ queryKey: ["ccpa"] });
    },
    onError: (e: any) =>
      Alert.alert("Could not save preference", e?.response?.data?.message || e?.message || "Try again."),
  });

  const limitSpi = useMutation({
    mutationFn: async () => (await api.post("/api/ccpa/limit-spi", {})).data,
    onSuccess: () =>
      Alert.alert("Saved", "We will limit use of your sensitive personal information to permitted purposes only."),
    onError: (e: any) =>
      Alert.alert("Could not save preference", e?.response?.data?.message || e?.message || "Try again."),
  });

  function requestRight(kind: "access" | "delete" | "portability" | "correction") {
    Alert.alert(
      "Submit request",
      `Submit a ${kind} request under CCPA?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              await api.post(`/api/gdpr/${kind}-request`, { framework: "ccpa" });
              Alert.alert("Request received", "We will respond within 45 days.");
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.message || e?.message || "Could not submit request.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container} testID="screen-ccpa">
      <View style={styles.banner} testID="banner-no-sell">
        <Feather name="shield" size={18} color="#0F766E" />
        <Text style={styles.bannerText}>Tabula Medica does not sell or share your personal information.</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "rights" && styles.tabActive]}
          onPress={() => setTab("rights")}
          testID="tab-rights"
        >
          <Text style={[styles.tabText, tab === "rights" && styles.tabTextActive]}>Your rights</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "notice" && styles.tabActive]}
          onPress={() => setTab("notice")}
          testID="tab-notice"
        >
          <Text style={[styles.tabText, tab === "notice" && styles.tabTextActive]}>Notice at collection</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "rights" && (
          <>
            <RightCard
              title="Right to know"
              cite="§1798.100 / §1798.110"
              desc="Receive a copy of your personal information."
              ctaLabel="Request a copy"
              onPress={() => requestRight("access")}
              testID="button-right-know"
            />
            <RightCard
              title="Right to delete"
              cite="§1798.105"
              desc="Permanently delete your account, with a 30-day grace period."
              ctaLabel="Delete my account"
              danger
              onPress={() => requestRight("delete")}
              testID="button-right-delete"
            />
            <RightCard
              title="Right to portability"
              cite="§1798.130"
              desc="Get your data as a FHIR R4 JSON bundle."
              ctaLabel="Export my data"
              onPress={() => requestRight("portability")}
              testID="button-right-portability"
            />
            <RightCard
              title="Right to correct"
              cite="§1798.106"
              desc="Correct inaccurate personal information."
              ctaLabel="Submit correction"
              onPress={() => requestRight("correction")}
              testID="button-right-correct"
            />
            <RightCard
              title="Do not sell or share"
              cite="§1798.120 / §1798.135"
              desc="Confirm your opt-out (Tabula Medica already does not sell or share)."
              ctaLabel={optOut.isPending ? "Saving..." : "Confirm opt-out"}
              onPress={() => optOut.mutate()}
              testID="button-opt-out"
            />
            <RightCard
              title="Limit sensitive PI"
              cite="§1798.121"
              desc="Limit our use of sensitive personal information to permitted purposes only."
              ctaLabel={limitSpi.isPending ? "Saving..." : "Limit SPI use"}
              onPress={() => limitSpi.mutate()}
              testID="button-limit-spi"
            />
          </>
        )}

        {tab === "notice" && (
          <>
            {noticeQ.isLoading ? (
              <ActivityIndicator color="#0F766E" style={{ marginTop: 24 }} />
            ) : noticeQ.data?.notice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeRow}>
                  <Text style={styles.noticeLabel}>Controller: </Text>
                  {noticeQ.data.notice.controller}
                </Text>
                <Text style={styles.noticeRow}>
                  <Text style={styles.noticeLabel}>Do we sell? </Text>
                  {noticeQ.data.notice.doWeSell ? "Yes" : "No"}
                </Text>
                <Text style={styles.noticeRow}>
                  <Text style={styles.noticeLabel}>Cross-context behavioral ads? </Text>
                  {noticeQ.data.notice.doWeShareForCBA ? "Yes" : "No"}
                </Text>
                <Text style={styles.noticeRow}>
                  <Text style={styles.noticeLabel}>Retention: </Text>
                  {noticeQ.data.notice.retention}
                </Text>
                <Text style={[styles.noticeLabel, { marginTop: 12, marginBottom: 6 }]}>
                  Categories collected
                </Text>
                {noticeQ.data.notice.categories.map((c) => (
                  <View key={c.category} style={styles.catRow}>
                    <Feather
                      name={c.collected ? "check-circle" : "x-circle"}
                      size={14}
                      color={c.collected ? "#0F766E" : "#9CA3AF"}
                    />
                    <Text style={styles.catText}>{c.category}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>Notice unavailable. Try again later.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RightCard({
  title,
  cite,
  desc,
  ctaLabel,
  onPress,
  danger,
  testID,
}: {
  title: string;
  cite: string;
  desc: string;
  ctaLabel: string;
  onPress: () => void;
  danger?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cite}>{cite}</Text>
      <Text style={styles.desc}>{desc}</Text>
      <TouchableOpacity
        style={[styles.cta, danger && styles.ctaDanger]}
        onPress={onPress}
        testID={testID}
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    margin: 12,
    padding: 12,
    borderRadius: 12,
  },
  bannerText: { flex: 1, fontSize: 13, color: "#065F46", fontWeight: "500" },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 8,
  },
  tab: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: "#fff", alignItems: "center" },
  tabActive: { backgroundColor: "#ECFDF5" },
  tabText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#0F766E", fontWeight: "700" },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cite: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  desc: { fontSize: 13, color: "#4B5563", marginTop: 8, lineHeight: 18 },
  cta: {
    marginTop: 12,
    backgroundColor: "#0F766E",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  ctaDanger: { backgroundColor: "#DC2626" },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  noticeBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noticeRow: { fontSize: 13, color: "#374151", marginBottom: 4 },
  noticeLabel: { fontWeight: "600", color: "#111827" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  catText: { fontSize: 13, color: "#374151", flex: 1 },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 24, fontSize: 14 },
});
