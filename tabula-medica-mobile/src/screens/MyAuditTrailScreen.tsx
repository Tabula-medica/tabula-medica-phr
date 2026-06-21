import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

type Tab = "access" | "disclosures" | "activity";

interface AccessEvent {
  id: string;
  occurredAt: string;
  actor: string;
  organization?: string;
  resource: string;
  purpose?: string;
}

interface DisclosureEvent {
  id: string;
  occurredAt: string;
  recipient: string;
  reason: string;
  channel?: string;
}

interface ActivityEvent {
  id: string;
  occurredAt: string;
  action: string;
  detail?: string;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function MyAuditTrailScreen() {
  const [tab, setTab] = useState<Tab>("access");

  const accessQ = useQuery<{ events: AccessEvent[] }>({
    queryKey: ["audit-trail", "access"],
    queryFn: async () => (await api.get("/api/my-audit-trail/access")).data,
    enabled: tab === "access",
  });

  const disclosuresQ = useQuery<{ events: DisclosureEvent[] }>({
    queryKey: ["audit-trail", "disclosures"],
    queryFn: async () => (await api.get("/api/my-audit-trail/disclosures")).data,
    enabled: tab === "disclosures",
  });

  const activityQ = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["audit-trail", "activity"],
    queryFn: async () => (await api.get("/api/my-audit-trail/activity")).data,
    enabled: tab === "activity",
  });

  async function downloadSignedReport() {
    try {
      const resp = await api.get("/api/my-audit-trail/signed-report");
      const { keyId, signature } = resp.data || {};
      Alert.alert(
        "Signed report ready",
        `Your tamper-evident audit report is ready.\n\nKey: ${keyId || "unknown"}\nSignature: ${
          signature ? signature.slice(0, 16) + "…" : "missing"
        }\n\nVerify the signature at /api/reports/verify on the web app.`,
      );
    } catch (e: any) {
      Alert.alert("Could not generate report", e?.message || "Please try again.");
    }
  }

  return (
    <View style={styles.container} testID="screen-my-audit-trail">
      <View style={styles.tabs}>
        <TabBtn active={tab === "access"} label="Access" onPress={() => setTab("access")} testID="tab-access" />
        <TabBtn
          active={tab === "disclosures"}
          label="Disclosures"
          onPress={() => setTab("disclosures")}
          testID="tab-disclosures"
        />
        <TabBtn
          active={tab === "activity"}
          label="My activity"
          onPress={() => setTab("activity")}
          testID="tab-activity"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "access" && (
          <List
            isLoading={accessQ.isLoading}
            empty="No one has accessed your records yet."
            items={accessQ.data?.events || []}
            render={(e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.cardTitle}>{e.actor}</Text>
                {e.organization ? <Text style={styles.cardSub}>{e.organization}</Text> : null}
                <Text style={styles.cardMeta}>
                  {e.resource} · {formatWhen(e.occurredAt)}
                </Text>
                {e.purpose ? <Text style={styles.cardPurpose}>Purpose: {e.purpose}</Text> : null}
              </View>
            )}
          />
        )}
        {tab === "disclosures" && (
          <List
            isLoading={disclosuresQ.isLoading}
            empty="You have not disclosed records to anyone yet."
            items={disclosuresQ.data?.events || []}
            render={(e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.cardTitle}>{e.recipient}</Text>
                <Text style={styles.cardSub}>{e.reason}</Text>
                <Text style={styles.cardMeta}>
                  {e.channel ? `${e.channel} · ` : ""}
                  {formatWhen(e.occurredAt)}
                </Text>
              </View>
            )}
          />
        )}
        {tab === "activity" && (
          <List
            isLoading={activityQ.isLoading}
            empty="No activity recorded yet."
            items={activityQ.data?.events || []}
            render={(e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.cardTitle}>{e.action}</Text>
                {e.detail ? <Text style={styles.cardSub}>{e.detail}</Text> : null}
                <Text style={styles.cardMeta}>{formatWhen(e.occurredAt)}</Text>
              </View>
            )}
          />
        )}

        <TouchableOpacity
          style={styles.signedBtn}
          onPress={downloadSignedReport}
          testID="button-download-signed-report"
        >
          <Feather name="download" size={16} color="#fff" />
          <Text style={styles.signedBtnText}>Download tamper-evident report</Text>
        </TouchableOpacity>
        <Text style={styles.signedHint}>
          Cryptographically signed (Ed25519). Anyone can verify it at /api/reports/verify.
        </Text>
      </ScrollView>
    </View>
  );
}

function TabBtn({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      testID={testID}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function List<T>({
  isLoading,
  empty,
  items,
  render,
}: {
  isLoading: boolean;
  empty: string;
  items: T[];
  render: (item: T) => JSX.Element;
}) {
  if (isLoading) return <ActivityIndicator style={{ marginTop: 24 }} color="#0F766E" />;
  if (!items.length) return <Text style={styles.empty}>{empty}</Text>;
  return <>{items.map(render)}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  tabActive: { backgroundColor: "#ECFDF5" },
  tabText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#0F766E", fontWeight: "700" },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 13, color: "#4B5563", marginTop: 2 },
  cardMeta: { fontSize: 12, color: "#6B7280", marginTop: 6 },
  cardPurpose: { fontSize: 12, color: "#0F766E", marginTop: 4, fontStyle: "italic" },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 24, fontSize: 14 },
  signedBtn: {
    marginTop: 18,
    backgroundColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  signedBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  signedHint: { fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 6 },
});
