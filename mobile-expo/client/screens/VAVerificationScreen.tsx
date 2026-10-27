import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

interface VerificationResult {
  verified: boolean;
  referralNumber: string;
  veteranName: string;
  eligibilityStatus: "eligible" | "pending" | "expired" | "not_found";
  authorizationExpires?: string;
  authorizedServices: string[];
  ccnNetwork: string;
  vaFacility: string;
  vaStationId: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  eligible: { color: "#10B981", icon: "check-circle", label: "Eligible" },
  pending: { color: "#F59E0B", icon: "clock", label: "Pending Review" },
  expired: { color: "#EF4444", icon: "x-circle", label: "Expired" },
  not_found: { color: "#6B7280", icon: "help-circle", label: "Not Found" },
};

export default function VAVerificationScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [referralNumber, setReferralNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canVerify = referralNumber.length > 3 && lastName.length > 1;

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const url = new URL("/api/optum-edi/verify-referral", getApiUrl());
      const res = await apiRequest("POST", url.toString(), {
        referralNumber,
        veteranLastName: lastName,
        veteranDOB: dob || undefined,
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check your information and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const statusConfig = result ? STATUS_CONFIG[result.eligibilityStatus] || STATUS_CONFIG.not_found : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                <Feather name="flag" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontWeight: "700" }}>VA Community Care</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Referral Verification (Lane B)</ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, color: theme.textSecondary }}>
              If you have a VA Community Care referral, verify it here. Once verified, the VA pays the provider directly through the Optum CCN network. Your cost: $0.
            </ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm }}>
              <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}>
                <Feather name="shield" size={10} color="#10B981" />
                <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>VA AUTHORIZED</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: "#3B82F615", borderColor: "#3B82F630" }]}>
                <Feather name="zap" size={10} color="#3B82F6" />
                <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>OPTUM CCN</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF630" }]}>
                <Feather name="file-text" size={10} color="#8B5CF6" />
                <ThemedText type="small" style={{ color: "#8B5CF6", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>837P v5010</ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
          <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Verify Your Referral</ThemedText>

          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: 6 }}>Referral Number *</ThemedText>
          <TextInput
            testID="input-referral"
            value={referralNumber}
            onChangeText={setReferralNumber}
            placeholder="CCN-2026-123456"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Referral number"
            autoCapitalize="characters"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          />

          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: 6, marginTop: Spacing.md }}>Last Name *</ThemedText>
          <TextInput
            testID="input-last-name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Your last name as on VA records"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Last name"
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          />

          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: 6, marginTop: Spacing.md }}>Date of Birth (optional)</ThemedText>
          <TextInput
            testID="input-dob"
            value={dob}
            onChangeText={setDob}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Date of birth"
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          />

          <Pressable
            testID="button-verify"
            onPress={handleVerify}
            disabled={!canVerify || verifying}
            style={[styles.verifyButton, { backgroundColor: canVerify ? "#10B981" : theme.backgroundTertiary }]}
            accessibilityRole="button"
            accessibilityLabel={verifying ? "Verifying referral" : "Verify Referral"}
            accessibilityState={{ disabled: !canVerify || verifying }}
          >
            <Feather name={verifying ? "loader" : "check-circle"} size={18} color="#FFF" />
            <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>
              {verifying ? "Verifying..." : "Verify Referral"}
            </ThemedText>
          </Pressable>
        </Card>

        {error ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <Card style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="alert-circle" size={18} color="#EF4444" />
                <ThemedText type="body" style={{ color: "#EF4444", fontWeight: "600", marginLeft: 8, flex: 1 }}>{error}</ThemedText>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {result ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: (statusConfig?.color || "#6B7280") + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                  <Feather name={statusConfig?.icon || "help-circle"} size={24} color={statusConfig?.color || "#6B7280"} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Verification Result</ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: (statusConfig?.color || "#6B7280") + "15" }]}>
                    <ThemedText type="small" style={{ color: statusConfig?.color, fontWeight: "700", fontSize: 11 }}>{statusConfig?.label}</ThemedText>
                  </View>
                </View>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Referral Number</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "700" }}>{result.referralNumber}</ThemedText>
              </View>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>CCN Network</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{result.ccnNetwork.toUpperCase()}</ThemedText>
              </View>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>VA Facility</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{result.vaFacility}</ThemedText>
              </View>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Station ID</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{result.vaStationId}</ThemedText>
              </View>
              {result.authorizationExpires ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Auth Expires</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "600" }}>{result.authorizationExpires}</ThemedText>
                </View>
              ) : null}

              {result.authorizedServices.length > 0 ? (
                <View style={{ marginTop: Spacing.sm }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 6 }}>AUTHORIZED SERVICES</ThemedText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {result.authorizedServices.map((svc, i) => (
                      <View key={i} style={[styles.serviceBadge, { backgroundColor: "#10B98115" }]}>
                        <Feather name="check" size={10} color="#10B981" />
                        <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600", fontSize: 10, marginLeft: 4 }}>{svc}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>

            {result.eligibilityStatus === "eligible" ? (
              <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
                <View style={{ backgroundColor: "#10B98115", borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather name="dollar-sign" size={18} color="#10B981" />
                    <ThemedText type="subtitle" style={{ fontWeight: "700", color: "#10B981", marginLeft: 8 }}>Your Cost: $0.00</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: "#10B981", marginTop: 4, lineHeight: 18 }}>
                    VA will pay the provider directly through Optum CCN within 30 days. You owe nothing.
                  </ThemedText>
                </View>

                <Pressable
                  testID="button-book-with-va"
                  onPress={() => navigation.navigate("Booking")}
                  style={[styles.verifyButton, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Book appointment with VA coverage"
                >
                  <Feather name="calendar" size={18} color="#FFF" />
                  <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>Book Appointment with VA Coverage</ThemedText>
                </Pressable>
              </Card>
            ) : null}
          </Animated.View>
        ) : null}

        <Card style={{ padding: Spacing.md, marginTop: Spacing.sm }}>
          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 6 }}>How VA Community Care Works</ThemedText>
          {[
            "Your VA provider issues a Community Care referral",
            "You choose an in-network provider (Tabula Direct Access)",
            "Verify your referral here to confirm eligibility",
            "Book your appointment — your cost is $0",
            "After your visit, the provider bills VA via Optum CCN",
            "VA pays the provider within 30 days",
          ].map((step, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 1 }}>
                <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", fontSize: 10 }}>{i + 1}</ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, lineHeight: 18 }}>{step}</ThemedText>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14 },
  verifyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, alignSelf: "flex-start", marginTop: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5 },
  serviceBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
});
