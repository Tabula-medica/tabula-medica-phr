import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";

const RIGHTS: Array<{
  id: "access" | "rectification" | "erasure" | "portability" | "restriction" | "objection";
  title: string;
  cite: string;
  desc: string;
  endpoint: string;
  danger?: boolean;
}> = [
  {
    id: "access",
    title: "Right of access",
    cite: "Art. 15",
    desc: "Receive a copy of personal data we process about you.",
    endpoint: "/api/gdpr/access-request",
  },
  {
    id: "rectification",
    title: "Right to rectification",
    cite: "Art. 16",
    desc: "Correct inaccurate or incomplete personal data.",
    endpoint: "/api/gdpr/correction-request",
  },
  {
    id: "erasure",
    title: "Right to erasure",
    cite: "Art. 17",
    desc: "Request deletion of your personal data ('right to be forgotten').",
    endpoint: "/api/gdpr/delete-request",
    danger: true,
  },
  {
    id: "portability",
    title: "Right to portability",
    cite: "Art. 20",
    desc: "Receive your data in a structured, machine-readable format (FHIR R4 JSON).",
    endpoint: "/api/gdpr/portability-request",
  },
  {
    id: "restriction",
    title: "Right to restriction",
    cite: "Art. 18",
    desc: "Restrict processing of your data while a request is reviewed.",
    endpoint: "/api/gdpr/restriction-request",
  },
  {
    id: "objection",
    title: "Right to object",
    cite: "Art. 21",
    desc: "Object to processing based on legitimate interests.",
    endpoint: "/api/gdpr/objection-request",
  },
];

export default function GdprScreen() {
  function submit(r: (typeof RIGHTS)[number]) {
    Alert.alert(
      r.title,
      `Submit this ${r.title.toLowerCase()} request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          style: r.danger ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.post(r.endpoint, { framework: "gdpr" });
              Alert.alert(
                "Request received",
                "We will respond within 30 days as required by GDPR Article 12.",
              );
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.message || e?.message || "Could not submit request.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container} testID="screen-gdpr">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Feather name="globe" size={18} color="#1E40AF" />
          <Text style={styles.bannerText}>
            EU/UK rights under the General Data Protection Regulation. We respond within 30 days.
          </Text>
        </View>

        {RIGHTS.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cite}>{r.cite}</Text>
            <Text style={styles.desc}>{r.desc}</Text>
            <TouchableOpacity
              style={[styles.cta, r.danger && styles.ctaDanger]}
              onPress={() => submit(r)}
              testID={`button-gdpr-${r.id}`}
            >
              <Text style={styles.ctaText}>Submit request</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.footer}>
          Controller: Tabula Medica, Inc. · DPO: privacy@tabulamedica.health
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  bannerText: { flex: 1, fontSize: 13, color: "#1E3A8A", fontWeight: "500" },
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
    backgroundColor: "#1E40AF",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  ctaDanger: { backgroundColor: "#DC2626" },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footer: { textAlign: "center", color: "#6B7280", fontSize: 11, marginTop: 12 },
});
